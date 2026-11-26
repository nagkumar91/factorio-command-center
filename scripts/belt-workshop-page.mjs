/** Guide page of the on-demand belt workshop: site/belt-workshop/ (index.html, layout.svg, string, manifest, native report, the
 * three probe reports, README, data.json). It has the structure of the inserter workshop's guide (scripts/workshop-guides.mjs:
 * numbered connections, nominal and measured material use, rate / cap / recovery table, recipe unlocks, exact identity) and adds
 * what this workshop's README explains: required versus nominal supply with the probes that measured both, and how the ring
 * works (the README's own section). Every figure is read from the manifest, the reports and the README, never typed here.
 * The page is written only when the native report passes for the exact SHA-256; otherwise the folder is removed.
 * CLI: node scripts/belt-workshop-page.mjs   (run from factorio-command-center/; no game data needed)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {decodeBlueprint} from './blueprints.mjs';
import {renderFlightPlanPage} from './flight-plan-shell.mjs';
import {exactNativeEvidence,groupPorts,footprint,counts,recipeUnlocks,nominalDemand,prototypeMatches,preview,table,STYLE,SCRIPT} from './workshop-guides.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ID='belt-workshop';
const PROBES=[['stated-supply','Stated supply'],['nominal-supply','Nominal supply'],['long-block','Long block']];
const hash=s=>createHash('sha256').update(s).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=s=>s.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
const json=s=>JSON.stringify(s,null,2).replaceAll('<','\\u003c');
const num=n=>Number.isFinite(n)?String(Number(n.toFixed(2))):'—';
const readJSON=async f=>JSON.parse(await fs.readFile(f,'utf8'));

/** A section of README.md as HTML: paragraphs, bullet lists, **bold** and `code` (the only Markdown it uses). */
export function readmeSection(readme,title){
 const section=readme.split(/^## /m).find(s=>s.startsWith(title+'\n'));
 if(!section)throw Error(`README has no "${title}" section`);
 const inline=t=>esc(t).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
 const out=[];let list=null;
 for(const line of section.split('\n').slice(1)){
  const bullet=line.match(/^- (.*)$/);
  if(bullet){(list??=[]).push(`<li>${inline(bullet[1])}</li>`);continue;}
  if(list){out.push(`<ul>${list.join('')}</ul>`);list=null;}
  if(line.trim())out.push(`<p>${inline(line.trim())}</p>`);
 }
 if(list)out.push(`<ul>${list.join('')}</ul>`);
 return out.join('');
}

/** The exact-hash evidence the page and the library rely on. */
export async function loadBelt(root=ROOT){
 const dir=path.join(root,'blueprint-sources',ID),[m]=await readJSON(path.join(dir,'manifest.json'));
 if(m?.id!==ID)throw Error(`${ID}: unexpected manifest`);
 const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim(),bp=decodeBlueprint(code)?.blueprint;
 if(!bp?.entities?.length)throw Error(`${ID}: empty blueprint`);
 const report=await readJSON(path.join(dir,'native-report.json')).catch(()=>null);
 const evidence=exactNativeEvidence(m,code,report);
 const probes={};
 for(const [id] of PROBES)probes[id]=await readJSON(path.join(dir,`probe-${id}-report.json`)).catch(()=>null);
 const readme=await fs.readFile(path.join(dir,'README.md'),'utf8');
 return {dir,m,code,bp,report,evidence,probes,readme,qualified:evidence.passed&&m.status!=='unverified'&&m.blueprintSha256===hash(code)};
}

export async function buildBeltPage({root=ROOT}={}){
 const r=await loadBelt(root),out=path.join(root,'site',ID);
 if(!r.qualified){await fs.rm(out,{recursive:true,force:true});return {id:ID,published:false,reason:r.evidence.reason};}
 const {dir,m,code,bp,report,evidence,probes,readme}=r;
 const model=await readJSON(path.join(root,'blueprint-sources/workshop-preview-model.json'));
 if(!prototypeMatches(m,model))throw Error(`${ID}: preview prototype mismatch`);
 const f=footprint(bp,model);for(const key of Object.keys(f))if(m.footprint?.[key]!==f[key])throw Error(`${ID}: footprint mismatch ${key}`);
 const construction=counts(bp.entities.map(e=>e.name)),machines=counts(bp.entities.map(e=>e.recipe).filter(Boolean));
 if(JSON.stringify(Object.entries(construction).sort())!==JSON.stringify(Object.entries(m.construction||{}).sort()))throw Error(`${ID}: construction mismatch`);
 const ports=groupPorts(m.ports),unlocks=recipeUnlocks(bp,model),nominal=nominalDemand(m,model);
 for(const p of ports)if(!bp.entities.some(e=>e.entity_number===p.entity))throw Error(`${ID}: port references missing entity ${p.entity}`);
 const catalog=await readJSON(path.join(root,'site/data/catalog.json')),iconPaths=new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.icon])),cache=new Map();
 const exists=x=>fs.access(x).then(()=>true,()=>false);
 async function icon(id){if(!cache.has(id)){let file=`assets/icons/${id}.png`;if(!await exists(path.join(root,'site',file)))file=iconPaths.get(id);if(!/^assets\/(?:icons|flight-icons)\/[\w.-]+\.png$/.test(file||''))throw Error(`Missing repository icon: ${id}`);const bytes=await fs.readFile(path.join(root,'site',file)),info=await sharp(bytes).metadata(),s=Math.min(64,info.width,info.height);cache.set(id,'data:image/png;base64,'+(await sharp(bytes).extract({left:0,top:0,width:s,height:s}).png().toBuffer()).toString('base64'));}return cache.get(id);}
 const chip=async id=>`<img class="item-icon" src="${await icon(id)}" alt=""> ${esc(pretty(id))}`;
 const svg=await preview(bp,model,ports,icon),res=evidence.result;
 const pos=p=>bp.entities.find(e=>e.entity_number===p.entity)?.position||p.position||p;
 const portRows=await Promise.all(ports.map(async p=>`<li><strong>${p.marker} · ${(await Promise.all(p.items.map(chip))).join(' / ')||'External power'}</strong> — ${esc(p.kind)}; entity ${p.entity}, (${pos(p).x}, ${pos(p).y}). ${esc(p.externalSide||'')}</li>`));
 const rateRows=await Promise.all(m.products.map(async id=>`<tr><th>${await chip(id)}</th><td>${num(m.targets[id])}</td><td>${num(res.outputsPerMinute[id])}</td><td>${num(res.recovery?.outputsPerMinute?.[id])}</td><td>${esc(m.outputCaps[id])}</td></tr>`));
 const tick=v=>v===true?'pass':'<strong>fail</strong>';
 // Supply: required (the draw with every chest emptied, rounded up) versus nominal (recipe arithmetic for the targets).
 const need=m.requiredInputsPerMinute,nom=m.nominalInputsPerMinute,drawn=res.consumptionPerMinute;
 const supplyRows=await Promise.all(Object.keys(need).map(async id=>`<tr><th>${await chip(id)}</th><td>${num(need[id])}</td><td>${num(drawn[id])}</td><td>${num(nom[id])}</td></tr>`));
 const probeRows=[];
 for(const [id,label] of PROBES){
  const p=probes[id];if(!p)continue;const b=p.builds[0],failed=Object.entries(b.checks||{}).filter(([,v])=>v!==true).map(([k])=>k);
  const supply=p.supplyPerMinute?Object.entries(p.supplyPerMinute).map(([k,v])=>`${words(k)} ${num(v)}`).join(', '):'a full belt on each entrance';
  const steady=m.products.map(i=>`${num(b.outputsPerMinute[i])}`).join(' / '),rec=m.products.map(i=>`${num(b.recovery?.outputsPerMinute?.[i])}`).join(' / ');
  const held=id==='long-block'?`${num(b.recovery.blockedMinutes)} min`:`${num(report.builds[0].recovery.blockedMinutes)} min`;
  probeRows.push(`<tr><th scope="row"><a href="probe-${id}-report.json">${esc(label)}</a></th><td>${esc(supply)}</td><td>${held}</td><td>${esc(steady)}</td><td>${esc(rec)}</td><td>${p.passed===true?'pass':`<strong>recorded failure</strong>: ${esc(failed.join(', ')||'see report')}`}</td></tr>`);
 }
 const nominalFailed=probes['nominal-supply']&&probes['nominal-supply'].passed!==true;
 const gears=m.gearsPerMinuteAtTargets,circuits=m.circuitsPerMinuteAtTargets;
 const notes=[...(Array.isArray(m.notes)?m.notes:[m.notes])];
 const link=`<p class="suppliers">See also: <a href="../inserter-workshop/index.html" data-workshop="inserter-workshop">Inserter workshop · four arms</a> (the same ring for inserters) · Belt workshop</p>`;
 const html=`<html><head><title>${esc(m.name)}</title><style>${STYLE}.suppliers{padding:10px 14px;border:1px solid #465249;border-radius:6px;background:#1b2621}</style></head><body><aside><a href="#import">Import &amp; layout</a><a href="#connections">Connections</a><a href="#rates">Rates &amp; recovery</a><a href="#supply">Supply</a><a href="#ring">How the ring works</a><a href="#research">Recipe unlocks</a></aside><main><div class="workshop-guide" data-page="${ID}"><p class="eyebrow">PLATE-FED WORKSHOP · EXACT SAVED LAYOUT</p><h1>${esc(m.name)}</h1><p class="lede">Six on-demand belt products: ${m.products.map(i=>pretty(i).toLowerCase()).join(', ').replace(/, ([^,]*)$/,' and $1')}. Supply iron plates and copper plates; gears and circuits are made inside. Each product has its own chest that stops at one stack: ${m.products.map(i=>`${num(m.outputCaps[i])} ${pretty(i).toLowerCase()}s`).join(', ').replace(/, ([^,]*)$/,' and $1')}.</p><p class="evidence matched" data-evidence="matched">Native production tested · ${esc(evidence.reason)}</p><p>${f.width} × ${f.height} tiles · ${bp.entities.length} entities · ${construction['assembling-machine-2']||0} AM2 · ${construction.substation||0} substations · red transport · no installed modules</p>${link}<section id="import"><h2>Import &amp; build</h2><ol><li>Download or copy the complete import, then use Factorio’s Import string.</li><li>Build all saved entities and preserve filters, stock controls, chest caps and circuit wires.</li><li>Supply both numbered inputs on the west; connect external electricity at P. Let internal buffers prime.</li><li>Remove finished goods for continuous output. Full storage intentionally pauses manufacture.</li></ol><div class="actions"><a class="button primary" href="${esc(m.file)}" download>Download import</a><button id="copy-import">Copy import</button><a class="button" href="layout.svg">Full-size SVG</a><button data-zoom="fit">Fit layout</button><button data-zoom="detail">Tile detail</button></div><p id="copy-status" role="status" aria-live="polite"></p><div class="layout-map" tabindex="0"><img src="layout.svg" alt="Exact saved ${esc(m.name)} positions and numbered connections"></div><p class="muted">Recipe and substation icons identify the saved entities. Arrows show direction, dashed pale lines join underground belts, gold lines show power wires and red/green lines show circuit wires. Each physical receiver has one marker. This is a schematic, not a game screenshot.</p><details id="import-details"><summary>Complete import string · manual offline copy</summary><textarea id="import-code" readonly aria-label="Complete blueprint import string">${esc(code)}</textarea></details></section><section id="connections"><h2>Numbered connections &amp; materials</h2><ol class="ports">${portRows.join('')}</ol><h3>Nominal material demand / min</h3><p>Calculated from the exact snapshot recipes at this manifest’s target rates, without productivity. This is a planning formula, not a measured promise; see Supply for what to give each entrance.</p>${table(['Material','Nominal / min'],Object.entries(nominal).map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${Number(n.toFixed(3))}</td></tr>`))}<h3>Measured material use / min</h3>${table(['Material','Measured / min'],Object.entries(drawn).map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${Number(n).toFixed(2)}</td></tr>`))}</section><section id="rates"><h2>Measured rate, stock caps &amp; blocked recovery</h2>${table(['Product','Target / min','Measured / min','Recovery / min','Stock cap'],rateRows)}<p>Targets describe continuous collection with every chest emptied each second, not production into full storage. Recovery rates measure restarted collection after the chests were held full. Native measurement: ${esc(report.measurementMinutes)} minutes after ${esc(report.warmupMinutes)} of warm-up; blocked ${esc(res.recovery.blockedMinutes)} minutes. Each chest stops at exactly its cap, and after half a stack is taken from one chest it refills while the other five stay full.</p><ul>${notes.map(n=>`<li>${esc(typeof n==='string'?n:JSON.stringify(n))}</li>`).join('')}</ul></section><section id="supply"><h2>Supply: required versus nominal</h2><p>Give each entrance <strong>${Object.entries(need).map(([k,v])=>`${num(v)} ${pretty(k).toLowerCase()}s`).join(' and ')}</strong> a minute (required): the measured draw with all six chests emptied at once, rounded up. The recipe arithmetic for exactly the targets is lower (nominal), but the workshop does not share a short supply in the target proportions.${nominalFailed?' Offered only the nominal figures it did not reach every steady target, a recorded failure kept on purpose. With chests that are mostly full, as an on-demand workshop normally runs, any supply works: it only sets how fast a chest refills.':''}</p>${table(['Material','Required / min','Measured draw / min','Nominal / min'],supplyRows)}<p>The targets are ${num(gears)} gears and ${num(circuits)} circuits a minute at the declared rates; gears are the scarce ingredient.</p><h3>Probes</h3><p>Same protocol as the native run with the feed or the hold changed. Rates are ${m.products.map(i=>pretty(i).toLowerCase()).join(' / ')}, steady then recovery.</p>${table(['Probe','Entrances offered','Held full','Steady / min','Recovery / min','Result'],probeRows)}</section><section id="ring"><h2>How the ring works</h2>${readmeSection(readme,'How it works')}</section><section id="research"><h2>Required recipe unlocks from saved machines</h2><p>This list follows recipes actually saved in the import. Unlock these technologies and their prerequisites before startup. Native validation may enable recipes directly; it does not prove that an under-researched force can run the workshop.</p>${table(['Saved recipe','Unlock'],unlocks.map(u=>`<tr><th>${esc(pretty(u.recipe))}</th><td>${u.enabled?'Available initially':u.technologies.length?u.technologies.map(t=>esc(pretty(t))).join(' / '):'No unlock found; inspect prototype'}</td></tr>`))}</section><details><summary>Construction, recipe machine counts &amp; exact identity</summary><h3>Construction materials · entity counts</h3>${table(['Entity','Count'],Object.entries(construction).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`))}<h3>Machines per saved recipe</h3>${table(['Recipe','Machines'],Object.entries(machines).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`))}<p class="hash">Blueprint SHA-256: ${esc(m.blueprintSha256)}<br>Prototype SHA-256: ${esc(m.prototypeSha256)}</p><p>Evidence: <a href="native-report.json">Native report</a>${PROBES.filter(([id])=>probes[id]).map(([id,label])=>` · <a href="probe-${id}-report.json">${esc(label)} probe</a>`).join('')} · <a href="manifest.json">Source manifest</a> · <a href="data.json">Guide data</a> · <a href="README.md">Offline instructions</a></p></details></div></main><script>${SCRIPT}</script></body></html>`;
 const data={manifest:m,evidence,footprint:f,construction,machineCounts:machines,ports,nominalMaterialsPerMinute:nominal};
 const files={'index.html':renderFlightPlanPage(html,{page:ID,rootPrefix:'../'}),'layout.svg':svg,[m.file]:code+'\n','manifest.json':json([m])+'\n','data.json':json(data)+'\n','native-report.json':json(report)+'\n','README.md':readme,...Object.fromEntries(PROBES.filter(([id])=>probes[id]).map(([id])=>[`probe-${id}-report.json`,json(probes[id])+'\n']))};
 await fs.rm(out,{recursive:true,force:true});
 for(const [file,value] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(out,file)),{recursive:true});await fs.writeFile(path.join(out,file),value);}
 return {id:ID,published:true,blueprintSha256:m.blueprintSha256,footprint:f,files:Object.keys(files).length};
}
function words(s){return s.replaceAll('-',' ');}
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildBeltPage(),null,2));
