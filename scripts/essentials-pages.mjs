/** Essentials round guides: one offline page per qualified blueprint plus site/essentials/index.html.
 * CLI: node scripts/essentials-pages.mjs   (run after index-designed-blueprints.mjs)
 * Only a blueprint whose native report passes for its exact SHA-256 gets a page; the others are
 * named on the landing page as not qualified. FACTORIO_RAW optionally refreshes the tracked
 * geometry snapshot scripts/essentials-pages/preview-model.json; normal builds only read it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {decodeBlueprint,encodeBlueprint} from './blueprints.mjs';
import {renderFlightPlanPage} from './flight-plan-shell.mjs';
import {exactNativeEvidence,groupPorts,footprint,counts,refreshSnapshot,preview,table,STYLE,SCRIPT} from './workshop-guides.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ESSENTIALS_IDS=['green-circuits','essentials-mall','robot-essentials','six-science'];
export const ESSENTIALS_RELEASE='essentials-20261121';
export const SUPPLIER='green-circuits';
const MODEL='scripts/essentials-pages/preview-model.json';
const hash=s=>createHash('sha256').update(s).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=s=>s.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
const json=s=>JSON.stringify(s,null,2).replaceAll('<','\\u003c');
const num=n=>Number.isFinite(n)?String(Number(n.toFixed(2))):'—';
const LEDE={
 'green-circuits':'Makes 360 electronic circuits per minute from iron and copper plates, on one red belt leaving the east side. One copy covers the essentials mall or robot essentials; six-pack science needs three.',
 'essentials-mall':'Eight building products on demand: assembling machine 2, fast transport belts, fast underground belts, fast splitters, fast inserters, bulk inserters, electric furnaces and electric mining drills. Each product stops at its own chest cap. Gears, cable, advanced circuits and the yellow-tier parts are made inside.',
 'robot-essentials':'Construction robots, logistic robots, roboports, storage chests and passive provider chests at 5 / 5 / 0.5 / 2 / 2 per minute, in a smaller footprint than the robot logistics workshop. Batteries, engines, frames and advanced circuits are made inside.',
 'six-science':'Automation, logistic, military, chemical, production and utility science packs at 30 per minute each, from supplied plates, bricks, stone, coal, sulfur, plastic, electronic circuits and two fluids. Space science stays with the orbital cell.'
};
const REPRODUCE=id=>[
 'export FACTORIO_RAW=<Factorio 2.1.24 Space Age data-raw-dump.json>',
 `node scripts/${id}/generate.mjs        # writes blueprint-sources/${id}/${id}.txt and manifest.json`,
 `node --test tests/${id}.test.mjs`,
 `node scripts/${id}/validate.mjs        # full native protocol; needs a local Factorio 2.1.24 install, run headless with a private profile under .cache/${id}/`
];

/** Read the four sources. Each record says whether its exact import has passing native evidence. */
export async function loadEssentials(root=ROOT){
 const records=[];
 for(const id of ESSENTIALS_IDS){
  const dir=path.join(root,'blueprint-sources',id),[m]=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  if(m?.id!==id)throw Error(`${id}: unexpected manifest`);
  const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim(),bp=decodeBlueprint(code)?.blueprint;
  if(!bp?.entities?.length)throw Error(`${id}: empty blueprint`);
  const report=JSON.parse(await fs.readFile(path.join(dir,'native-report.json'),'utf8').catch(()=>'null'));
  const evidence=exactNativeEvidence(m,code,report);
  // Optional second full-protocol run with every entrance fed at exactly its panel figure: its own
  // file, or embedded in native-report.json by a validator that runs both protocols (six-science).
  const embedded=report?.panelSupply?.builds?{...report.panelSupply,gameVersion:report.gameVersion,prototypeSha256:report.prototypeSha256,
   short:report.short,passed:report.passed===true&&report.panelSupply.builds.every(b=>b.passed===true)}:null;
  const panelReport=JSON.parse(await fs.readFile(path.join(dir,'panel-supply-report.json'),'utf8').catch(()=>'null'))??embedded;
  const panelSupply=panelReport&&exactNativeEvidence(m,code,panelReport).passed?panelReport:null;
  const qualified=evidence.passed&&m.status==='qualified'&&m.blueprintSha256===hash(code);
  records.push({id,m,code,bp,report,panelSupply,evidence,qualified,reason:qualified?'':(evidence.passed?'Manifest status is not qualified':evidence.reason)});
 }
 return records;
}

/** Copies of the supplier each consumer needs, from the manifest and the measured draw. */
export function pairing(records){
 const supplier=records.find(r=>r.id===SUPPLIER&&r.qualified);
 const perCopy=supplier?.m.targets['electronic-circuit']??360;
 const rows=records.filter(r=>r.id!==SUPPLIER&&r.qualified).map(r=>{const nominal=r.m.greenCircuitSupply?.perMinute,measured=r.evidence.result?.consumptionPerMinute?.['electronic-circuit'];
  return {id:r.id,name:r.m.name,nominal,measured,copies:r.m.greenCircuitSupply?.copiesOfGreenCircuits,measuredCopies:Number.isFinite(measured)?Math.ceil(measured/perCopy):undefined};});
 const nominal=rows.reduce((a,r)=>a+(r.nominal||0),0),measured=rows.reduce((a,r)=>a+(r.measured||0),0);
 return {perCopy,rows,total:{nominal,measured,copies:Math.ceil(nominal/perCopy),measuredCopies:Math.ceil(measured/perCopy)}};
}

function measuredInput(r,p){
 const c=r.evidence.result?.consumptionPerMinute?.[p.item];if(Number.isFinite(c))return c;
 const f=r.evidence.result?.fluids?.find(x=>x.item===p.item),minutes=r.m.protocol?.measureMinutes??r.report?.measurementMinutes;
 return f&&Number.isFinite(f.acceptedDuringMeasurement)&&minutes?f.acceptedDuringMeasurement/minutes:undefined;
}

export async function buildEssentialsPages({root=ROOT,rawPath=process.env.FACTORIO_RAW}={}){
 const records=await loadEssentials(root),published=records.filter(r=>r.qualified);
 const modelFile=path.join(root,MODEL);let model;
 if(rawPath){model=await refreshSnapshot(root,rawPath,records);await fs.mkdir(path.dirname(modelFile),{recursive:true});await fs.writeFile(modelFile,json(model)+'\n');}
 else model=JSON.parse(await fs.readFile(modelFile,'utf8'));
 const catalog=JSON.parse(await fs.readFile(path.join(root,'site/data/catalog.json'),'utf8')),iconPaths=new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.icon])),cache=new Map();
 const exists=f=>fs.access(f).then(()=>true,()=>false);
 async function icon(id){if(!cache.has(id)){let file=`assets/icons/${id}.png`;if(!await exists(path.join(root,'site',file)))file=iconPaths.get(id);if(!/^assets\/(?:icons|flight-icons)\/[\w.-]+\.png$/.test(file||''))throw Error(`Missing repository icon: ${id}`);const bytes=await fs.readFile(path.join(root,'site',file)),info=await sharp(bytes).metadata(),s=Math.min(64,info.width,info.height);cache.set(id,'data:image/png;base64,'+(await sharp(bytes).extract({left:0,top:0,width:s,height:s}).png().toBuffer()).toString('base64'));}return cache.get(id);}
 const chip=async id=>`<img class="item-icon" src="${await icon(id)}" alt=""> ${esc(pretty(id))}`;
 const pairs=pairing(records),built=[];
 for(const r of published){
  const {m,code,bp,report,panelSupply,evidence}=r,res=evidence.result;
  if(m.prototypeSha256!==model.prototypeSha256)throw Error(`${m.id}: preview prototype mismatch`);
  const f=footprint(bp,model);for(const key of Object.keys(f))if(m.footprint?.[key]!==f[key])throw Error(`${m.id}: footprint mismatch ${key}`);
  const construction=counts(bp.entities.map(e=>e.name)),machines=counts(bp.entities.map(e=>e.recipe).filter(Boolean));
  if(JSON.stringify(Object.entries(construction).sort())!==JSON.stringify(Object.entries(m.construction||{}).sort()))throw Error(`${m.id}: construction mismatch`);
  const ports=groupPorts(m.ports||[...(m.inputs||[]),...(m.fluids||[]),...(m.outputs||[])]),marker=new Map(ports.map(p=>[p.entity,p.marker]));
  for(const p of ports)if(!bp.entities.some(e=>e.entity_number===p.entity))throw Error(`${m.id}: port references missing entity ${p.entity}`);
  const pos=p=>{const e=bp.entities.find(e=>e.entity_number===p.entity);return e?.position||p.position||p;};
  const svg=dedupeIcons(await preview(bp,model,ports,icon)),out=path.join(root,'site',m.id);await fs.mkdir(out,{recursive:true});
  const inputRows=await Promise.all([...m.inputs,...(m.fluids||[])].map(async p=>`<tr><th>${esc(marker.get(p.entity)??'')}</th><td>${await chip(p.item)}</td><td>${p.kind==='fluid'?'Pipe':'Belt'}</td><td>${esc(p.externalSide||'west')} · (${pos(p).x}, ${pos(p).y})</td><td>${num(p.perMinute)}</td><td>${num(measuredInput(r,p))}</td></tr>`));
  const outputRows=await Promise.all(m.products.map(async id=>{const o=m.outputs.find(p=>(p.items||[p.item]).includes(id));return `<tr><td>${await chip(id)}</td><td>${o?`${esc(marker.get(o.entity)??'')} · (${pos(o).x}, ${pos(o).y})`:''}</td><td>${esc(m.outputCaps?.[id]??o?.cap??'')}</td><td>${num(m.targets?.[id])}</td><td>${num(res.outputsPerMinute?.[id])}</td><td>${num(res.recovery?.outputsPerMinute?.[id])}</td></tr>`;}));
  const supply=m.greenCircuitSupply?pairs.rows.find(x=>x.id===m.id):null;
  const supplyText=m.id===SUPPLIER?`<p>This is the circuit supplier for the other three essentials builds. One red belt carries up to five copies' output. See the <a href="../essentials/index.html#pairing">pairing table</a>.</p>`:supply?`<p class="evidence matched">Needs supplied electronic circuits: ${num(supply.nominal)} per minute at the targets (measured draw ${num(supply.measured)} per minute). <strong>${esc(supply.copies)} cop${supply.copies===1?'y':'ies'} of the green-circuit supplier</strong> (${num(pairs.perCopy)} per minute each) cover${supply.copies===1?'s':''} it. <a href="../green-circuits/index.html">Green-circuit supplier →</a></p>`:'';
  const notes=(m.setupNotes||[]).map(n=>`<li>${esc(n)}</li>`).join('');
  const minutes=m.protocol||{};
  const html=`<html><head><title>${esc(m.name)}</title><style>${STYLE}${EXTRA}</style></head><body><aside><a href="#import">Import &amp; layout</a><a href="#inputs">Inputs</a><a href="#outputs">Outputs &amp; rates</a><a href="#reproduce">Reproduce</a></aside><main><div class="workshop-guide" data-page="${esc(m.id)}"><p class="eyebrow">ESSENTIALS · 21 NOVEMBER 2026 · EXACT SAVED LAYOUT</p><h1>${esc(m.name)}</h1><p class="lede">${esc(LEDE[m.id])}</p><p class="evidence matched" data-evidence="matched">Native production tested · ${esc(evidence.reason)}</p><p>${f.width} × ${f.height} = ${f.width*f.height} tiles · ${bp.entities.length} entities · ${construction['assembling-machine-2']||0} assembling machine 2${construction['chemical-plant']?` · ${construction['chemical-plant']} chemical plants`:''} · ${construction.substation||0} substations · red transport · no modules</p>${supplyText}<p><a href="../essentials/index.html">← All four essentials builds</a> · <a href="../index.html?collection=essentials#blueprints">Open in the library</a></p><section id="import"><h2>Import &amp; build</h2><ol><li>Copy the import string, then use Factorio’s Import string.</li><li>Build every saved entity; keep filters, circuit wires, stock caps and chest settings as saved.</li><li>Feed each numbered entrance on the west with its labelled material and connect electricity at P.</li><li>Collect the finished goods on the east. A full chest or exit pauses that product on purpose.</li></ol><div class="actions"><a class="button primary" href="${esc(m.file)}" download>Download import</a><button id="copy-import">Copy import</button><a class="button" href="layout.svg">Full-size SVG</a><button data-zoom="fit">Fit layout</button><button data-zoom="detail">Tile detail</button></div><p id="copy-status" role="status" aria-live="polite"></p><div class="layout-map" tabindex="0"><img src="layout.svg" alt="Exact saved ${esc(m.name)} layout with numbered connections"></div><p class="muted">Schematic of the saved entity positions. Arrows show direction, dashed pale lines join underground belts, gold lines are power wires and red/green lines are circuit wires. Blue markers are entrances, green markers are outputs, P is electricity.</p><details id="import-details"><summary>Complete import string · manual offline copy</summary><textarea id="import-code" readonly aria-label="Complete blueprint import string">${esc(code)}</textarea></details></section><section id="inputs"><h2>Inputs</h2><p>Nominal demand is the manifest figure on each entrance panel at the targets. Measured is what the native test drew during its ${esc(minutes.measureMinutes??'')}-minute window at the measured rates. ${panelSupply?`<strong>The panel figures are enough for this build:</strong> a full native run with every entrance fed at exactly its panel figure passed for this exact string (<a href="panel-supply-report.json">panel supply report</a>). Measured is the draw with saturated entrances, ${m.governor?'where a governor still holds every product at its target.':'where the build runs above its targets.'}`:`<strong>Plan supply for the Measured column, not the panel figure:</strong> products run above their targets and take material first, so a build fed at only the panel figures can starve its last products.`}</p>${table(['#','Material','Entrance','Side · position','Nominal / min','Measured / min'],inputRows)}</section><section id="outputs"><h2>Outputs, caps &amp; measured rates</h2>${table(['Product','Chest or exit · position','Cap',m.class==='on-demand'?'Floor / min':'Target / min','Measured / min','Recovery / min'],outputRows)}<p>Protocol: ${esc(minutes.warmupMinutes)} min warm-up, ${esc(minutes.measureMinutes)} min measured, ${esc(minutes.blockedMinutes)} min blocked, ${esc(minutes.settleMinutes)} min settle, ${esc(minutes.recoveryMinutes)} min recovery. Recovery is the rate after collection stops and restarts. ${m.class==='on-demand'?'This mall is on-demand: the floors are minimum rates while all eight chests are emptied, not a fixed output.':''}</p><h3>Setup notes</h3><ul>${notes}</ul></section><section id="reproduce"><h2>Reproduce</h2><p>From <code>factorio-command-center/</code> in the source repository:</p><pre><code>${REPRODUCE(m.id).map(esc).join('\n')}</code></pre></section><details><summary>Construction, machines &amp; exact identity</summary><h3>Construction materials · entity counts</h3>${table(['Entity','Count'],Object.entries(construction).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`))}<h3>Machines per saved recipe</h3>${table(['Recipe','Machines'],Object.entries(machines).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`))}<p class="hash">Blueprint SHA-256: ${esc(m.blueprintSha256)}<br>Prototype SHA-256: ${esc(m.prototypeSha256)}</p><p><a href="manifest.json">Source manifest</a> · <a href="native-report.json">Native report</a>${panelSupply?' · <a href="panel-supply-report.json">Panel supply report</a>':''} · <a href="README.md">Offline notes</a></p></details></div></main><script>${SCRIPT}</script></body></html>`;
  const files={'index.html':renderFlightPlanPage(html,{page:'essentials',rootPrefix:'../'}),'layout.svg':svg,[m.file]:code+'\n','manifest.json':json([m])+'\n','native-report.json':json(report)+'\n',...(panelSupply?{'panel-supply-report.json':json(panelSupply)+'\n'}:{}),'README.md':`# ${m.name}\n\nOpen index.html from disk; it needs only the parent site's styles.css, flight-plans.css, flight-plans.js and assets. No network or game install is needed.\n\nRegenerate: node scripts/essentials-pages.mjs (from factorio-command-center/).\n\nBlueprint SHA-256 ${m.blueprintSha256}; native report passed for this exact string.\n`};
  for(const [file,value] of Object.entries(files))await fs.writeFile(path.join(out,file),value);
  built.push({id:m.id,footprint:f});
 }
 // Landing page and book of the published blueprints, supplier first.
 const book={blueprint_book:{item:'blueprint-book',label:'Essentials · four builds',active_index:0,version:published[0]?.bp.version,blueprints:published.map((r,index)=>({index,blueprint:r.bp}))}};
 const bookCode=encodeBlueprint(book),landing=path.join(root,'site/essentials');await fs.mkdir(landing,{recursive:true});
 const cards=await Promise.all(published.map(async r=>{const {m,code,evidence}=r,res=evidence.result,c=counts(r.bp.entities.map(e=>e.name));
  const inputs=[...m.inputs,...(m.fluids||[])].map(p=>`<li>${esc(pretty(p.item))} · ${num(p.perMinute)}/min</li>`).join('');
  const outputs=await Promise.all(m.products.map(async id=>`<tr><td>${await chip(id)}</td><td>${esc(m.outputCaps?.[id]??'')}</td><td>${num(m.targets?.[id])}</td><td>${num(res.outputsPerMinute?.[id])}</td><td>${num(res.recovery?.outputsPerMinute?.[id])}</td></tr>`));
  return `<article class="essentials-card" id="${esc(m.id)}" data-build-id="${esc(m.id)}"><h2>${esc(m.name)}</h2><p>${m.footprint.width} × ${m.footprint.height} = ${m.footprint.width*m.footprint.height} tiles · ${c['assembling-machine-2']||0} assembling machine 2${c['chemical-plant']?` · ${c['chemical-plant']} chemical plants`:''}</p><h3>Entrances · nominal demand</h3><p>${r.panelSupply?'Panel figures. Fed at exactly these, this string passed the full native protocol; the Measured column on the guide is the draw with saturated entrances.':'Panel figures. Plan supply for the Measured column on the guide, which is higher.'}</p><ul>${inputs}</ul><h3>Outputs</h3>${table(['Product','Cap',m.class==='on-demand'?'Floor / min':'Target / min','Measured / min','Recovery / min'],outputs)}<div class="actions"><button data-copy="${esc(m.id)}">Copy import</button><a class="button primary" href="../${esc(m.id)}/index.html">Guide</a><a class="button" href="../${esc(m.id)}/native-report.json">Native report</a></div><details><summary>Import string</summary><textarea id="code-${esc(m.id)}" readonly aria-label="${esc(m.name)} import string">${esc(code)}</textarea></details><p class="hash">SHA-256 ${esc(m.blueprintSha256)}</p></article>`;}));
 const pairRows=pairs.rows.map(x=>`<tr><th><a href="../${esc(x.id)}/index.html">${esc(x.name)}</a></th><td>${num(x.nominal)}</td><td>${num(x.measured)}</td><td>${esc(x.copies)}</td></tr>`);
 pairRows.push(`<tr><th>All three together</th><td>${num(pairs.total.nominal)}</td><td>${num(pairs.total.measured)}</td><td>${pairs.total.copies}</td></tr>`);
 const missing=records.filter(r=>!r.qualified);
 const landingHtml=`<html><head><title>Essentials builds</title><style>${STYLE}${EXTRA}</style></head><body><aside><a href="#book">Blueprint book</a><a href="#pairing">Circuit pairing</a>${published.map(r=>`<a href="#${esc(r.id)}">${esc(pretty(r.id))}</a>`).join('')}</aside><main><div class="workshop-guide" data-page="essentials"><p class="eyebrow">ESSENTIALS · 21 NOVEMBER 2026</p><h1>Essentials builds</h1><p class="lede">${WORDS[published.length]} natively qualified blueprint${published.length===1?'':'s'}: a building-essentials mall, a smaller robot workshop, six-pack science, and the green-circuit supplier that feeds the other three. Each import string below passed the full native protocol for its exact SHA-256.</p><p><a class="button primary" href="../index.html?collection=essentials#blueprints">Open the essentials in the library →</a> <a class="button" href="../space-launch/index.html">Next: the space launch builds →</a></p><section id="book"><h2>Blueprint book</h2><p>One book with ${published.length===1?'the one import':`all ${WORDS[published.length].toLowerCase()} imports`}, the supplier first.</p><div class="actions"><button data-copy="book">Copy book</button><a class="button" href="essentials-book.txt" download>Download book</a></div><details><summary>Book import string</summary><textarea id="code-book" readonly aria-label="Essentials blueprint book import string">${esc(bookCode)}</textarea></details><p id="copy-status" role="status" aria-live="polite"></p></section><section id="pairing"><h2>How many green-circuit suppliers?</h2><p>Each supplier makes ${num(pairs.perCopy)} electronic circuits per minute. Copies are sized from the nominal demand; the measured draw at the measured rates also fits inside them.</p>${table(['Consumer','Nominal circuits / min','Measured circuits / min','Supplier copies'],pairRows)}</section>${cards.join('')}${missing.length?`<section><h2>Not qualified in this round</h2><ul>${missing.map(r=>`<li>${esc(r.m.name)}: ${esc(r.reason)}</li>`).join('')}</ul></section>`:''}</div></main><script>${LANDING_SCRIPT}</script></body></html>`;
 await fs.writeFile(path.join(landing,'index.html'),renderFlightPlanPage(landingHtml,{page:'essentials',rootPrefix:'../'}));
 await fs.writeFile(path.join(landing,'essentials-book.txt'),bookCode+'\n');
 await fs.writeFile(path.join(landing,'data.json'),json({releaseGroup:ESSENTIALS_RELEASE,published:published.map(r=>({id:r.id,name:r.m.name,blueprintSha256:r.m.blueprintSha256,footprint:r.m.footprint,page:r.id+'/index.html'})),notPublished:missing.map(r=>({id:r.id,reason:r.reason})),pairing:pairs,book:{file:'essentials/essentials-book.txt',sha256:hash(bookCode),blueprints:published.map(r=>r.id)}})+'\n');
 return {built,notPublished:missing.map(r=>({id:r.id,reason:r.reason})),pairing:pairs.total,bookSha256:hash(bookCode)};
}
/** Each machine icon is embedded once as a symbol and placed with <use>, instead of once per machine. */
export function dedupeIcons(svg){
 const ids=new Map();
 const body=svg.replace(/<image href="(data:[^"]+)" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"\/>/g,(_,uri,x,y,w,h)=>{if(!ids.has(uri))ids.set(uri,'icon'+ids.size);return `<use href="#${ids.get(uri)}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;});
 const defs=`<defs>${[...ids].map(([uri,id])=>`<symbol id="${id}" viewBox="0 0 1 1"><image href="${uri}" width="1" height="1"/></symbol>`).join('')}</defs>`;
 return body.replace(/(<svg\b[^>]*>)/,`$1${defs}`);
}
const WORDS=['No','One','Two','Three','Four'];
const EXTRA=`.essentials-card{border:1px solid #465249;border-radius:6px;padding:4px 18px 14px;margin:24px 0;background:#1b2621}.essentials-card ul{columns:2;padding-left:18px}pre{overflow:auto;background:#192720;padding:12px;border-radius:5px}@media(max-width:650px){.essentials-card ul{columns:1}}`;
const LANDING_SCRIPT=`document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const t=document.getElementById('code-'+b.dataset.copy),s=document.getElementById('copy-status');try{if(location.protocol==='file:'||!navigator.clipboard?.writeText)throw Error('manual');await navigator.clipboard.writeText(t.value);s.textContent='Copied';}catch{t.closest('details').open=true;t.focus();t.select();s.textContent='Import selected — press Ctrl+C or Command+C to copy';}}));`;
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildEssentialsPages(),null,2));
