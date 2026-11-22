/** Guide pages of the advanced-circuit and processing-unit suppliers: site/advanced-circuits/ and site/processing-units/
 * (index.html, layout.svg, the import string, manifest, native report, README and any kept earlier version).
 * Every figure on a page is read from the family's own manifest, native report and decoded blueprint, never typed here.
 * A family gets a page only when its native report passes for the exact blueprint SHA-256; otherwise its folder is
 * removed and the reason returned. The preview geometry is the tracked snapshot of the essentials guides.
 * CLI: node scripts/circuit-supplier-pages.mjs   (run from factorio-command-center/; no game data needed)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {decodeBlueprint} from './blueprints.mjs';
import {renderFlightPlanPage} from './flight-plan-shell.mjs';
import {exactNativeEvidence,groupPorts,footprint,counts,preview,table,STYLE,SCRIPT} from './workshop-guides.mjs';
import {checkVersions,versionsSection,VERSIONS_SCRIPT,VERSIONS_STYLE} from './blueprint-versions.mjs';
import {dedupeIcons} from './essentials-pages.mjs';
import {suppliersLine,SUPPLIERS_STYLE} from './suppliers.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const SUPPLIER_IDS=['advanced-circuits','processing-units'];
const MODEL='scripts/essentials-pages/preview-model.json';
const hash=s=>createHash('sha256').update(s).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=s=>s.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
const words=s=>s.replaceAll('-',' ');
const json=s=>JSON.stringify(s,null,2).replaceAll('<','\\u003c');
const num=n=>Number.isFinite(n)?String(Number(n.toFixed(2))):'—';
const tile=p=>`(${Math.floor(p.x)}, ${Math.floor(p.y)})`;
const EXTRA=SUPPLIERS_STYLE;
// Items said without a plural ("from stone and coal", not "stones").
const UNCOUNTABLE=new Set(['stone','coal','sulfur','wood','iron-ore','copper-ore','uranium-ore','scrap']);
const REPRODUCE=id=>[
 `node scripts/${id}/generate.mjs        # writes blueprint-sources/${id}/${id}.txt and manifest.json; needs the prototype dump (FACTORIO_RAW)`,
 `node --test tests/${id}.test.mjs`,
 `node scripts/${id}/validate.mjs        # full native protocol; needs a local Factorio 2.1.24 install, run headless with a private profile under .cache/${id}/`
];

/** Read both families. Each record says whether its exact import has passing native evidence. */
export async function loadSuppliers(root=ROOT,ids=SUPPLIER_IDS){
 const records=[];
 for(const id of ids){
  const dir=path.join(root,'blueprint-sources',id),[m]=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  if(m?.id!==id)throw Error(`${id}: unexpected manifest`);
  const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim(),bp=decodeBlueprint(code)?.blueprint;
  if(!bp?.entities?.length)throw Error(`${id}: empty blueprint`);
  const report=JSON.parse(await fs.readFile(path.join(dir,'native-report.json'),'utf8').catch(()=>'null'));
  const evidence=exactNativeEvidence(m,code,report);
  const qualified=evidence.passed&&m.status==='qualified'&&m.blueprintSha256===hash(code);
  const versions=qualified&&m.versions?.length>1?await checkVersions(m,dir):[];
  records.push({id,dir,m,code,bp,report,evidence,qualified,versions,reason:qualified?'':(evidence.passed?'Manifest status is not qualified':evidence.reason)});
 }
 return records;
}

/** Embedded item and fluid icons for a page: icon(id) is a data URI, chip(id) the icon with the item's name. */
export async function makeIcons(root){
 const catalog=JSON.parse(await fs.readFile(path.join(root,'site/data/catalog.json'),'utf8')),iconPaths=new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.icon])),cache=new Map();
 const exists=f=>fs.access(f).then(()=>true,()=>false);
 async function icon(id){if(!cache.has(id)){let file=`assets/icons/${id}.png`;if(!await exists(path.join(root,'site',file)))file=iconPaths.get(id);if(!/^assets\/(?:icons|flight-icons)\/[\w.-]+\.png$/.test(file||''))throw Error(`Missing repository icon: ${id}`);const bytes=await fs.readFile(path.join(root,'site',file)),info=await sharp(bytes).metadata(),s=Math.min(64,info.width,info.height);cache.set(id,'data:image/png;base64,'+(await sharp(bytes).extract({left:0,top:0,width:s,height:s}).png().toBuffer()).toString('base64'));}return cache.get(id);}
 const chip=async id=>`<img class="item-icon" src="${await icon(id)}" alt=""> ${esc(pretty(id))}`;
 return {icon,chip};
}

// Other rate families with the same files use the same page (scripts/production-science-small/page.mjs): ids names them,
// eyebrow heads the page and links(m) is the cross-link line under the summary (the Suppliers line by default).
// noun names the build in the sentence about a full exit ("supplier" on the supplier pages, "module" on a science module).
export async function buildCircuitSupplierPages({root=ROOT,ids=SUPPLIER_IDS,eyebrow='SUPPLIERS',links=m=>suppliersLine(m.id),noun='supplier'}={}){
 const records=await loadSuppliers(root,ids),built=[],notPublished=[];
 const model=JSON.parse(await fs.readFile(path.join(root,MODEL),'utf8'));
 const {icon,chip}=await makeIcons(root);
 for(const r of records){
  const out=path.join(root,'site',r.id);
  if(!r.qualified){await fs.rm(out,{recursive:true,force:true});notPublished.push({id:r.id,reason:r.reason});continue;}
  const {m,code,bp,report,evidence,versions,dir}=r,res=evidence.result,product=m.products[0];
  if(m.prototypeSha256!==model.prototypeSha256)throw Error(`${m.id}: preview prototype mismatch`);
  const f=footprint(bp,model);for(const key of Object.keys(f))if(m.footprint?.[key]!==f[key])throw Error(`${m.id}: footprint mismatch ${key}`);
  const construction=counts(bp.entities.map(e=>e.name)),machines=counts(bp.entities.map(e=>e.recipe).filter(Boolean));
  if(JSON.stringify(Object.entries(construction).sort())!==JSON.stringify(Object.entries(m.construction||{}).sort()))throw Error(`${m.id}: construction mismatch`);
  const ports=groupPorts(m.ports),marker=new Map(ports.map(p=>[p.entity,p.marker]));
  for(const p of ports)if(!bp.entities.some(e=>e.entity_number===p.entity))throw Error(`${m.id}: port references missing entity ${p.entity}`);
  const at=p=>bp.entities.find(e=>e.entity_number===p.entity).position;
  const svg=dedupeIcons(await preview(bp,model,ports,icon));
  // Entrances: the panel figure of the manifest and what the native run drew through that very entrance.
  const entrances=[...m.inputs,...(m.fluids||[])];
  const drawn=p=>[...(res.inputs||[]),...(res.fluids||[])].find(x=>x.entity===p.entity)?.acceptedPerMinute;
  const inputRows=await Promise.all(entrances.map(async p=>`<tr><th>${esc(marker.get(p.entity)??'')}</th><td>${await chip(p.item)}</td><td>${p.kind==='fluid'?'Pipe':'Belt'}</td><td>${esc(p.externalSide||'west')} · ${tile(at(p))}</td><td>${num(p.perMinute)}</td><td>${num(drawn(p))}</td></tr>`));
  const shared=Object.entries(entrances.reduce((a,p)=>(a[p.item]=[...(a[p.item]||[]),p],a),{})).filter(([,list])=>list.length>1)
   .map(([item,list])=>`${pretty(item)} arrives on ${list.length} entrances (${list.map(p=>`${marker.get(p.entity)} at ${tile(at(p))}`).join(' and ')}); together ${num(list.reduce((a,p)=>a+p.perMinute,0))} per minute.`);
  const exit=m.outputs[0];
  const outputRows=[`<tr><td>${await chip(product)}</td><td>${esc(marker.get(exit.entity))} · ${tile(at(exit))}</td><td>${esc(exit.externalSide)} · ${esc(exit.transport)}</td><td>${esc(m.outputCaps?.[product]??exit.cap??'')}</td><td>${num(m.targets[product])}</td><td>${num(res.outputsPerMinute[product])}</td><td>${num(res.recovery?.outputsPerMinute?.[product])}</td></tr>`];
  // Power: the marked substation and how many there are, from the blueprint itself.
  const power=ports.find(p=>p.kind==='power'),substations=construction.substation||0,wires=(bp.wires||[]).filter(w=>w[1]===5&&w[3]===5).length;
  const sub=power&&at(power),subSize=Math.ceil((model.entities.substation.size[1][0]-model.entities.substation.size[0][0]));
  const powerText=power?`the substation marked P, at tiles (${Math.floor(sub.x-subSize/2)}–${Math.floor(sub.x+subSize/2-.01)}, ${Math.floor(sub.y-subSize/2)}–${Math.floor(sub.y+subSize/2-.01)})`:'any substation';
  const machineRows=Object.entries(machines).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`);
  const machineTotal=Object.values(machines).reduce((a,b)=>a+b,0);
  // Earlier version kept selectable (manifest "versions", newest first; checked against its files).
  const versionFiles={};
  for(const v of versions.slice(1))for(const file of [v.file,v.manifest,v.report].filter(Boolean))versionFiles[file]=await fs.readFile(path.join(dir,file),'utf8');
  const versionHtml=versions.length>1?await versionsSection({versions,products:m.products,codes:versions.map((v,i)=>i?versionFiles[v.file].trim():code),chip,esc,name:pretty}):'';
  const minutes=report.protocolMinutes,checks=Object.entries(res.checks||{}),underfed=m.measured?.underfed;
  const inputItems=[...new Set(entrances.map(p=>p.item))];
  const lede=`Makes ${num(m.targets[product])} ${words(product)}s per minute (measured ${num(res.outputsPerMinute[product])}) from ${inputItems.map(item=>words(item)+(entrances.find(p=>p.item===item).kind==='fluid'||UNCOUNTABLE.has(item)?'':'s')).join(', ').replace(/, ([^,]*)$/,' and $1')}, and sends them out on the ${esc(exit.externalSide)} side on one red belt. It makes its own intermediate parts inside.`;
  const html=`<html><head><title>${esc(m.name)}</title><style>${STYLE}${EXTRA}${versionHtml?VERSIONS_STYLE:''}</style></head><body><aside><a href="#import">Import &amp; layout</a>${versionHtml?'<a href="#versions">Versions</a>':''}<a href="#inputs">Inputs</a><a href="#outputs">Output &amp; rate</a><a href="#size">Size &amp; machines</a><a href="#power">Power</a><a href="#evidence">Native evidence</a><a href="#reproduce">Reproduce</a></aside><main><div class="workshop-guide" data-page="${esc(m.id)}"><p class="eyebrow">${esc(eyebrow)} · 22 NOVEMBER 2026 · EXACT SAVED LAYOUT</p><h1>${esc(m.name)}</h1><p class="lede">${lede}</p><p class="evidence matched" data-evidence="matched">Native production tested · ${esc(evidence.reason)}</p><p>${f.width} × ${f.height} = ${f.width*f.height} tiles · ${bp.entities.length} entities · ${machineTotal} assembling machine 2 · ${substations} substation${substations===1?"":"s"} · red transport · no modules</p>${await links(m)}<p><a href="../index.html?collection=flight-plans#blueprints">Open in the library</a></p><section id="import"><h2>Import &amp; build</h2><ol><li>Copy the import string, then use Factorio’s Import string.</li><li>Build every saved entity; keep the inserter filters, the underground pairs and the dead-end belts as saved.</li><li>Feed each numbered entrance on the west with its labelled material (see Inputs) and connect electricity at ${esc(powerText)}.</li><li>Take the ${esc(words(product))}s from the exit on the east, ${tile(at(exit))}. A full exit pauses the ${noun} on purpose.</li></ol><div class="actions"><a class="button primary" href="${esc(m.file)}" download>Download import</a><button id="copy-import">Copy import</button><a class="button" href="layout.svg">Full-size SVG</a><button data-zoom="fit">Fit layout</button><button data-zoom="detail">Tile detail</button></div><p id="copy-status" role="status" aria-live="polite"></p><div class="layout-map" tabindex="0"><img src="layout.svg" alt="Exact saved ${esc(m.name)} layout with numbered connections"></div><p class="muted">Schematic of the saved entity positions. Arrows show direction, dashed pale lines join underground belts, gold lines are power wires. Blue markers are entrances, green markers are the output, P is electricity. Tiles count from the top-left tile (0, 0).</p><details id="import-details"><summary>Complete import string · manual offline copy</summary><textarea id="import-code" readonly aria-label="Complete blueprint import string">${esc(code)}</textarea></details></section>${versionHtml}<section id="inputs"><h2>Inputs</h2><p>Panel is the figure on the entrance’s display panel at the target rate. Measured is what the native run drew through that entrance in its ${esc(minutes.measureMinutes)}-minute window with every entrance fed at exactly its panel figure; extra supply simply backs up on the entrance belt.</p>${table(['#','Material','Carried by','Side · tile','Panel / min','Measured / min'],inputRows)}${shared.length?`<p>${shared.map(esc).join(' ')}</p>`:''}</section><section id="outputs"><h2>Output &amp; rate</h2>${table(['Product','Exit · tile','Side · carrier','Cap','Target / min','Measured / min','Recovery / min'],outputRows)}<p>Recovery is the rate after the exit was blocked and released. The exit holds ${esc(m.outputCaps?.[product]??'')} ${esc(words(product))}s when nothing takes them, and every machine then stops.</p><h3>Setup notes</h3><ul>${(m.setupNotes||[]).map(n=>`<li>${esc(n)}</li>`).join('')}</ul></section><section id="size"><h2>Size &amp; machines</h2><p>${f.width} × ${f.height} = ${f.width*f.height} tiles (${num(f.width*f.height/m.targets[product])} tiles per ${esc(words(product))} per minute). ${bp.entities.length} entities, ${machineTotal} assembling machine 2.</p>${table(['Recipe','Machines'],machineRows)}</section><section id="power"><h2>Power</h2><p>The blueprint holds ${substations} substation${substations===1?"":"s"}${wires?`, linked to one another by ${wires} copper wires`:''}. Connect electricity at ${esc(powerText)}: run a wire from your network to it, or place the module inside a substation’s reach of an existing pole. This report does not record the electric power the module draws.</p></section><section id="evidence"><h2>Native evidence</h2><p>Factorio ${esc(report.gameVersion)} Space Age, headless, exact import string with SHA-256 <span class="hash">${esc(m.blueprintSha256)}</span>. Protocol: ${esc(minutes.warmupMinutes)} min warm-up, ${esc(minutes.measureMinutes)} min measured, ${esc(minutes.blockedMinutes)} min with the exit blocked, ${esc(minutes.settleMinutes)} min settle, ${esc(minutes.recoveryMinutes)} min recovery. Result: ${num(res.outputsPerMinute[product])} per minute steady and ${num(res.recovery?.outputsPerMinute?.[product])} in recovery against a target of ${num(m.targets[product])}; the exit held ${esc(res.blocked?.collectionPauseStock?.[0]?.count)} when blocked.${underfed?` Fed ${num(underfed.feedScale*100)}% of every panel figure, the same string made ${num(underfed.steadyPerMinute?.[product])} per minute.`:''} ${checks.length?`${checks.filter(([,v])=>v===true).length} of ${checks.length} native checks passed.`:''}</p><p><a href="native-report.json">Native report</a> · <a href="manifest.json">Source manifest</a> · <a href="README.md">Offline notes</a></p></section><section id="reproduce"><h2>Reproduce</h2><p>From <code>factorio-command-center/</code> in the source repository:</p><pre><code>${REPRODUCE(m.id).map(esc).join('\n')}</code></pre></section><details><summary>Construction &amp; exact identity</summary><h3>Entity counts</h3>${table(['Entity','Count'],Object.entries(construction).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`))}<p class="hash">Blueprint SHA-256: ${esc(m.blueprintSha256)}<br>Prototype SHA-256: ${esc(m.prototypeSha256)}</p></details></div></main><script>${SCRIPT}${versionHtml?VERSIONS_SCRIPT:''}</script></body></html>`;
  const files={...versionFiles,'index.html':renderFlightPlanPage(html,{page:m.id,rootPrefix:'../'}),'layout.svg':svg,[m.file]:code+'\n','manifest.json':json([m])+'\n','native-report.json':json(report)+'\n','README.md':await fs.readFile(path.join(dir,'README.md'),'utf8')};
  await fs.rm(out,{recursive:true,force:true});
  for(const [file,value] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(out,file)),{recursive:true});await fs.writeFile(path.join(out,file),value);}
  built.push({id:m.id,blueprintSha256:m.blueprintSha256,footprint:f,versions:versions.map(v=>v.label),files:Object.keys(files).length});
 }
 return {built,notPublished};
}
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildCircuitSupplierPages(),null,2));
