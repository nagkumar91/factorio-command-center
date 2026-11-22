/** Guide page of the oil products supplier: site/oil-products/ (index.html, layout.svg, string, manifest, native report, README).
 * Every figure is read from the family's manifest, native report, decoded blueprint and README (design rates, inputs, outputs
 * with side and tile, the measured scenarios, the copies each library blueprint needs), never typed here. The page is written
 * only when the native report passes for the exact SHA-256 with every required scenario; otherwise its folder is removed and
 * the reason returned. The second layout in candidates/ is evidence only: it is neither published nor offered as a version.
 * CLI: node scripts/oil-product-pages.mjs   (run from factorio-command-center/; no game data needed)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from './blueprints.mjs';
import {renderFlightPlanPage} from './flight-plan-shell.mjs';
import {groupPorts,footprint,counts,preview,table,STYLE,SCRIPT} from './workshop-guides.mjs';
import {dedupeIcons} from './essentials-pages.mjs';
import {makeIcons} from './circuit-supplier-pages.mjs';
import {suppliersLine,SUPPLIERS_STYLE} from './suppliers.mjs';
import {SIZE} from './oil-products/shared.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ID='oil-products';
const hash=s=>createHash('sha256').update(s).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=s=>s.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
const words=s=>s.replaceAll('-',' ');
const json=s=>JSON.stringify(s,null,2).replaceAll('<','\\u003c');
const num=n=>Number.isFinite(n)?Number(n.toFixed(2)).toLocaleString('en-US'):'—';
const tile=t=>`(${t.x}, ${t.y})`;
// Geometry for the shared preview renderer, from the family's own size table (selection boxes centred on 0).
const MODEL={entities:Object.fromEntries(Object.entries(SIZE).map(([n,[w,h]])=>[n,{size:[[-w/2,-h/2],[w/2,h/2]]}]))};
// Machine recipes with no icon of their own show the fluid they are about.
const RECIPE_ICON={'advanced-oil-processing':'crude-oil','heavy-oil-cracking':'heavy-oil','light-oil-cracking':'light-oil'};
const ORDER=['petroleum-gas','sulfuric-acid','lubricant','light-oil','sulfur'];
const REPRODUCE=[
 `node scripts/${ID}/generate.mjs        # writes the string, manifest, README and the second layout under candidates/`,
 `node --test tests/${ID}.test.mjs`,
 `node scripts/${ID}/validate.mjs        # full native protocol (about ten scenarios); needs a local Factorio 2.1.24 install, run headless with a private profile under .cache/${ID}/`
];

/** The exact-hash evidence: the report passes, names this string and prototype, and every required scenario passed. */
export async function loadOil(root=ROOT){
 const dir=path.join(root,'blueprint-sources',ID),[m]=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 if(m?.id!==ID)throw Error(`${ID}: unexpected manifest`);
 const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim(),bp=decodeBlueprint(code)?.blueprint;
 if(!bp?.entities?.length)throw Error(`${ID}: empty blueprint`);
 const report=JSON.parse(await fs.readFile(path.join(dir,'native-report.json'),'utf8').catch(()=>'null'));
 const builds=report?.builds||[],required=(m.scenarios||[]).filter(s=>!s.informational);
 const byId=new Map(builds.filter(b=>b.blueprintSha256===hash(code)).map(b=>[b.scenario,b]));
 const missing=(m.scenarios||[]).filter(s=>!byId.has(s.id)||byId.get(s.id).passed!==true&&!byId.get(s.id).informational).map(s=>s.id);
 const qualified=!!(report&&report.passed===true&&report.prototypeSha256===m.prototypeSha256&&m.blueprintSha256===hash(code)&&m.status==='qualified'&&required.length>=7&&!missing.length&&builds.every(b=>b.blueprintSha256===hash(code)));
 const readme=await fs.readFile(path.join(dir,'README.md'),'utf8');
 return {dir,m,code,bp,report,builds,byId,readme,qualified,reason:qualified?'':`No passing native report for this exact string${missing.length?` (not passed: ${missing.join(', ')})`:''}`};
}

export async function buildOilPage({root=ROOT}={}){
 const r=await loadOil(root),out=path.join(root,'site',ID);
 if(!r.qualified){await fs.rm(out,{recursive:true,force:true});return {id:ID,published:false,reason:r.reason};}
 const {m,code,bp,report,byId,readme,dir}=r;
 const f=footprint(bp,MODEL);for(const key of ['width','height'])if(m.footprint?.[key]!==f[key])throw Error(`${ID}: footprint mismatch ${key}`);
 if(f.left!==0||f.top!==0)throw Error(`${ID}: tiles must count from the top-left corner`);
 const construction=counts(bp.entities.map(e=>e.name));
 if(JSON.stringify(Object.entries(construction).sort())!==JSON.stringify(Object.entries(m.construction).sort()))throw Error(`${ID}: construction mismatch`);
 const {icon:rawIcon,chip}=await makeIcons(root),icon=id=>rawIcon(RECIPE_ICON[id]||id);
 const ports=groupPorts(m.ports),marker=new Map(ports.map(p=>[p.entity,p.marker]));
 for(const p of ports)if(!bp.entities.some(e=>e.entity_number===p.entity))throw Error(`${ID}: port references missing entity ${p.entity}`);
 const svg=dedupeIcons(await preview(bp,MODEL,ports,icon));
 const scenarios=m.measured.scenarios,design=scenarios.design,protocol=report.protocolMinutes;
 const inputs=m.inputs,outputs=ORDER.map(item=>m.outputs.find(p=>p.item===item));
 if(outputs.some(p=>!p))throw Error(`${ID}: an output is missing`);
 // Inputs: the panel figure and what the design run took through the entrance.
 const inputRows=await Promise.all(inputs.map(async p=>`<tr><th>${esc(marker.get(p.entity))}</th><td>${await chip(p.item)}</td><td>${esc(pretty(p.transport))}</td><td>${esc(p.externalSide)} · ${tile(p.tile)}</td><td>${num(p.perMinute)}</td><td>${num(design.fed[p.item])}</td></tr>`));
 // Outputs: the two north-side outlets are marked in the row and in the callout above the table.
 const north=outputs.filter(p=>p.externalSide==='north');
 const outputRows=await Promise.all(outputs.map(async p=>`<tr${p.externalSide==='north'?' class="north-outlet"':''}><th>${esc(marker.get(p.entity))}</th><td>${await chip(p.item)}</td><td>${esc(pretty(p.transport))}</td><td>${p.externalSide==='north'?'<strong>NORTH</strong>':esc(p.externalSide)} · ${tile(p.tile)}</td><td>${num(m.panel[p.item])}${p.perMinute===0&&m.panel[p.item]?' (up to)':''}</td><td>${num(design.drawn[p.item])}</td><td>${esc(p.note||'')}</td></tr>`));
 const northText=north.map(p=>`${words(p.item)} at ${tile(p.tile)}`).join(' and ');
 // Scenarios: required ones first, then the informational probes; blocked ones in two rows (blocked, recovery).
 const cols=[...ORDER];
 const figures=(d)=>cols.map(i=>`<td>${num(d?(d[i]??0):undefined)}</td>`).join('');
 const scRows=[];
 for(const s of m.scenarios){
  const sc=scenarios[s.id],blocked=!!s.blocked,tag=sc.informational?'informational':sc.passed?'pass':'FAIL';
  const label=esc(s.title);
  if(blocked){
   scRows.push(`<tr><th rowspan="2" scope="row">${label}</th><td>blocked</td>${figures(sc.drawn)}<td>${num(sc.fed.water)}</td><td>${num(sc.fed['crude-oil'])}</td><td>${num(sc.fed['iron-plate'])}</td><td>${num(sc.refineryCraftsPerMinute)}</td><td rowspan="2">${tag}</td></tr>`);
   scRows.push(`<tr><td>recovery</td>${figures(sc.recoveryDrawn)}<td colspan="4">back to the panel figures</td></tr>`);
  }else scRows.push(`<tr><th scope="row">${label}</th><td>measure</td>${figures(sc.drawn)}<td>${num(sc.fed.water)}</td><td>${num(sc.fed['crude-oil'])}</td><td>${num(sc.fed['iron-plate'])}</td><td>${num(sc.refineryCraftsPerMinute)}</td><td>${tag}</td></tr>`);
 }
 const heads=await Promise.all(cols.map(async i=>`<th scope="col">${await chip(i)}</th>`));
 const scTable=`<div class="table-scroll"><table class="oil-scenarios"><thead><tr><th scope="col">Scenario</th><th scope="col">Window</th>${heads.join('')}<th scope="col">Water in</th><th scope="col">Crude oil in</th><th scope="col">Iron in</th><th scope="col">Refinery crafts / min</th><th scope="col">Result</th></tr></thead><tbody>${scRows.join('')}</tbody></table></div>`;
 // What keeps running in each blocked case, from the figures: outputs still at their panel figure.
 const blockedNotes=m.scenarios.filter(s=>s.blocked).map(s=>{
  const sc=scenarios[s.id],item=s.blocked;
  const running=ORDER.filter(i=>i!==item&&m.targets[i]>0).map(i=>`${words(i)} ${num(sc.drawn[i])}`);
  return `<li><strong>${esc(s.title)}</strong>: the refineries run at ${num(sc.refineryCraftsPerMinute)} crafts per minute (${num(design.refineryCraftsPerMinute)} at the design rates); the others carry on: ${esc(running.join(', '))}. After the block they return to the panel figures.</li>`;
 });
 const light=scenarios['light-oil-660'],feed=scenarios['feed-80'],lightN=m.panel['light-oil'];
 const lightText=`<li><strong>Light oil drawn at ${num(lightN)}</strong>: light oil ${num(light.drawn['light-oil'])}, so petroleum gas falls from ${num(design.drawn['petroleum-gas'])} to ${num(light.drawn['petroleum-gas'])} per minute (${num(design.drawn['petroleum-gas']-light.drawn['petroleum-gas'])} less; every unit of light oil drawn is light oil not cracked, two thirds of it in gas, computed ${num(lightN*2/3)}); acid, lubricant and sulfur are unchanged and water in falls to ${num(light.fed.water)}.</li>`;
 const feedText=`<li><strong>Feed at 80%</strong> (crude oil ${num(feed.fed['crude-oil'])}, water ${num(feed.fed.water)}, iron ${num(feed.fed['iron-plate'])}): petroleum gas ${num(feed.drawn['petroleum-gas'])}, sulfuric acid ${num(feed.drawn['sulfuric-acid'])}, lubricant ${num(feed.drawn.lubricant)}, sulfur ${num(feed.drawn.sulfur)}; every machine kept working.</li>`;
 // Machines and size.
 const machineRows=Object.entries(m.machineCounts).map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`);
 const partRows=Object.entries(construction).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`);
 const power=ports.find(p=>p.kind==='power'),sub=bp.entities.find(e=>e.entity_number===power.entity).position;
 const mw=readme.match(/Power: about ([\d.]+ MW at full load)/)?.[1];
 // Pairing: copies each library blueprint needs, from the manifest's pairing table (also the README's table).
 const guide=async fam=>{const dirName=fam==='plastic-supplier'?'plastic-bars':fam.split('/')[0];return await fs.access(path.join(root,'site',dirName,'index.html')).then(()=>dirName,()=>null);};
 const takes=p=>[['acid','sulfuric acid'],['lubricant','lubricant'],['sulfur','sulfur'],['gas','petroleum gas'],['light','light oil']].filter(([k])=>Number.isFinite(p[k])).map(([k,n])=>`${n} ${num(p[k])}`).join(', ')||'no figure published';
 const clean=n=>n.replace(/ \(designed in parallel\)| \(unpublished branch\)/g,'').replace(/^Plastic supplier/,'Plastic bar supplier');
 const pairRows=[];
 for(const p of m.pairing){const g=await guide(p.family);pairRows.push(`<tr><th scope="row">${g?`<a href="../${g}/index.html">${esc(clean(p.name))}</a>`:esc(clean(p.name))}</th><td>${esc(takes(p))}</td><td>${p.copies===null?'on demand, no figure published':p.copies}</td></tr>`);}
 const copyOf=id=>m.pairing.find(p=>p.family==='plastic-supplier'&&p.id===id)?.copies;
 // How it joins the plastic bar supplier: gas port to gas port.
 const gas=outputs.find(p=>p.item==='petroleum-gas');
 const plasticDir=path.join(root,'blueprint-sources/plastic-bars'),plastic=await fs.readFile(path.join(plasticDir,'manifest.json'),'utf8').then(t=>JSON.parse(t),()=>null);
 const plasticGas=plastic?.find(e=>e.size==='medium')?.fluids?.[0];
 const joinText=plasticGas?`Place a plastic bar supplier to the east and join this blueprint's petroleum gas outlet at ${tile(gas.tile)} (east edge) to the plastic supplier's petroleum gas inlet at ${tile(plasticGas.tile)} (west edge, top-left corner) with pipe, gas port to gas port. One copy's ${num(m.targets['petroleum-gas'])} per minute feeds ${copyOf('small')===1&&copyOf('medium')===1?'a small (240 bars) or a medium (600 bars) plastic bar supplier':'the plastic bar supplier'}; ${copyOf('large')} copies feed a large (1,200 bars).`:'';
 const candidates=m.candidates.filter(c=>!c.published);
 const lede=`Makes ${ORDER.filter(i=>m.targets[i]>0).map(i=>`${words(i)} ${num(m.targets[i])}`).join(', ').replace(/, ([^,]*)$/,' and $1')} per minute from crude oil, water and a few iron plates, plus light oil on request (up to ${num(lightN)} per minute, at the cost of petroleum gas). Petroleum gas, sulfuric acid, lubricant and light oil leave by pipe, sulfur on a red belt.`;
 const html=`<html><head><title>${esc(m.name)}</title><style>${STYLE}${SUPPLIERS_STYLE}.north-outlet{background:#2c3a2f}.north-callout{padding:12px 14px;border:1px solid #91ddf7;border-radius:6px;background:#17303a}.oil-scenarios th,.oil-scenarios td{white-space:nowrap}</style></head><body><aside><a href="#import">Import &amp; layout</a><a href="#inputs">Inputs</a><a href="#outputs">Outputs</a><a href="#scenarios">Measured scenarios</a><a href="#size">Size &amp; machines</a><a href="#pairing">Copies needed</a><a href="#plastic">Plastic supplier</a><a href="#evidence">Native evidence</a><a href="#reproduce">Reproduce</a></aside><main><div class="workshop-guide" data-page="${ID}"><p class="eyebrow">SUPPLIERS · 22 NOVEMBER 2026 · EXACT SAVED LAYOUT</p><h1>${esc(m.name)}</h1><p class="lede">${esc(lede)}</p><p class="evidence matched" data-evidence="matched">Native production tested · every required scenario passed for this exact import string.</p><p>${f.width} × ${f.height} = ${f.width*f.height} tiles · ${bp.entities.length} entities · ${m.machineCounts['oil-refinery']} oil refineries · ${m.construction['chemical-plant']} chemical plants · ${m.construction['storage-tank']} storage tanks · ${m.construction.substation} substations · no modules</p>${suppliersLine(ID)}<p><a href="../index.html?collection=flight-plans#blueprints">Open in the library</a></p><section id="import"><h2>Import &amp; build</h2><ol><li>Copy the import string, then use Factorio’s Import string.</li><li>Build every saved entity; keep the mirrored refineries, every pipe-to-ground pair, both pumps with their conditions and the red wires as saved.</li><li>Bring crude oil, water (pipes) and iron plates (belt) to the three west entrances (see Inputs) and connect electricity at the substation marked P at ${tile({x:Math.floor(sub.x-1),y:Math.floor(sub.y-1)})}–${tile({x:Math.floor(sub.x),y:Math.floor(sub.y)})}.</li><li>Take petroleum gas, sulfuric acid and sulfur from the <strong>east</strong> edge, and lubricant and light oil from the <strong>north</strong> edge (see Outputs).</li></ol><div class="actions"><a class="button primary" href="${esc(m.file)}" download>Download import</a><button id="copy-import">Copy import</button><a class="button" href="layout.svg">Full-size SVG</a><button data-zoom="fit">Fit layout</button><button data-zoom="detail">Tile detail</button></div><p id="copy-status" role="status" aria-live="polite"></p><div class="layout-map" tabindex="0"><img src="layout.svg" alt="Exact saved ${esc(m.name)} layout with numbered connections"></div><p class="muted">Schematic of the saved entity positions. Arrows show direction, dashed pale lines join underground belts, gold lines are power wires, red lines are circuit wires. Blue markers are entrances, green markers are outputs, P is electricity. Tiles count from the top-left tile (0, 0).</p><details id="import-details"><summary>Complete import string · manual offline copy</summary><textarea id="import-code" readonly aria-label="Complete blueprint import string">${esc(code)}</textarea></details></section><section id="inputs"><h2>Inputs · west</h2><p>Panel is the figure on the entrance’s display panel. Taken is what the design run drew through that entrance over its ${esc(protocol.measureMinutes)}-minute window.</p>${table(['#','Material','Carried by','Side · tile','Panel / min','Taken / min'],inputRows)}</section><section id="outputs"><h2>Outputs · east and north</h2><p class="north-callout"><strong>Two outlets are on the north edge, not the east:</strong> ${esc(northText)}. Petroleum gas, sulfuric acid and sulfur leave east. Each outlet carries only its own product; the harness checked every outlet once a second in every scenario.</p>${table(['#','Product','Carried by','Side · tile','Panel / min','Measured, design run / min','Note'],outputRows)}</section><section id="scenarios"><h2>Measured scenarios</h2><p>One copy per scenario in one headless game: ${esc(protocol.warmupMinutes)} min warm-up and ${esc(protocol.measureMinutes)} min measured; blocked scenarios add ${esc(protocol.blockedMinutes)} min blocked, ${esc(protocol.settleMinutes)} min settle and ${esc(protocol.recoveryMinutes)} min recovery. Figures are per minute: what the harness drew at each outlet, and what it fed at each entrance. The last four are informational probes, not pass conditions.</p>${scTable}<h3>What happens in each case</h3><ul><li><strong>Design rates</strong>: ${ORDER.filter(i=>m.targets[i]>0).map(i=>`${words(i)} ${num(design.drawn[i])}`).join(', ')}; all ${m.machineCounts['oil-refinery']} refineries at ${num(design.refineryCraftsPerMinute)} crafts per minute. Petroleum gas beyond a medium plastic supplier's ${num(m.pairing.find(p=>p.family==='plastic-supplier'&&p.id==='medium').gas)} is the surplus: ${num(design.drawn['petroleum-gas']-m.pairing.find(p=>p.family==='plastic-supplier'&&p.id==='medium').gas)}.</li>${blockedNotes.join('')}${lightText}${feedText}</ul></section><section id="size"><h2>Size &amp; machines</h2><p>${f.width} × ${f.height} = ${f.width*f.height} tiles, ${bp.entities.length} entities.${mw?` The README estimates about ${esc(mw)}; the native reports do not record power draw.`:''} Electricity goes in at the substation marked P; the three substations, every refinery, plant, pump and inserter were checked to sit on one network.</p>${table(['Machine','Count'],machineRows)}<details><summary>Every part</summary>${table(['Entity','Count'],partRows)}</details></section><section id="pairing"><h2>Copies needed</h2><p>How many copies of this supplier each library blueprint needs at the panel figures of one copy (${ORDER.map(i=>`${words(i)} ${num(m.panel[i])}`).join(', ')}). Demands are from the library survey of 22 November 2026, as in the README.</p>${table(['Consumer','Takes per minute','Copies'],pairRows)}</section><section id="plastic"><h2>Joining the plastic bar supplier</h2><p>${esc(joinText)}${plastic?' <a href="../plastic-bars/index.html">Plastic bar supplier →</a>':''}</p></section><section id="evidence"><h2>Native evidence</h2><p>Factorio ${esc(report.gameVersion)} Space Age, headless, exact import string with SHA-256 <span class="hash">${esc(m.blueprintSha256)}</span>, fed exactly the panel figures. ${m.scenarios.filter(s=>!s.informational).length} required scenarios passed and ${m.scenarios.filter(s=>s.informational).length} informational probes ran. ${candidates.length?`${candidates.length} other arrangement${candidates.length===1?'':'s'} (${esc(candidates.map(c=>`${c.label}, ${c.footprint.width} × ${c.footprint.height}`).join('; '))}) also qualified; ${candidates.length===1?'it is':'they are'} kept in the repository as evidence and not offered here.`:''}</p><p><a href="native-report.json">Native report</a> · <a href="manifest.json">Source manifest</a> · <a href="README.md">Offline notes</a></p></section><section id="reproduce"><h2>Reproduce</h2><p>From <code>factorio-command-center/</code> in the source repository:</p><pre><code>${REPRODUCE.map(esc).join('\n')}</code></pre><p class="hash">Blueprint SHA-256: ${esc(m.blueprintSha256)}<br>Prototype SHA-256: ${esc(m.prototypeSha256)}</p></section></div></main><script>${SCRIPT}</script></body></html>`;
 const files={'index.html':renderFlightPlanPage(html,{page:ID,rootPrefix:'../'}),'layout.svg':svg,[m.file]:code+'\n','manifest.json':json([m])+'\n','native-report.json':json(report)+'\n','README.md':readme};
 await fs.rm(out,{recursive:true,force:true});
 for(const [file,value] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(out,file)),{recursive:true});await fs.writeFile(path.join(out,file),value);}
 return {id:ID,published:true,blueprintSha256:m.blueprintSha256,footprint:f,files:Object.keys(files).length};
}
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildOilPage(),null,2));
