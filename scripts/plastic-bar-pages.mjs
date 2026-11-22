/** Guide page of the plastic-bar suppliers: site/plastic-bars/ (index.html, one layout.svg, string, native report per size,
 * manifest and README). The three sizes are shown side by side; every figure is read from the family's manifest, its three
 * native reports, the decoded blueprints and README.md (the pairing table is the README's own table), never typed here.
 * The page is written only when every size has a passing native report for its exact SHA-256; otherwise its folder is
 * removed and the reason returned. The preview geometry is the tracked snapshot of the essentials guides.
 * CLI: node scripts/plastic-bar-pages.mjs   (run from factorio-command-center/; no game data needed)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from './blueprints.mjs';
import {renderFlightPlanPage} from './flight-plan-shell.mjs';
import {exactNativeEvidence,groupPorts,footprint,counts,preview,table,STYLE} from './workshop-guides.mjs';
import {checkVersions,versionsSection,VERSIONS_SCRIPT,VERSIONS_STYLE} from './blueprint-versions.mjs';
import {dedupeIcons} from './essentials-pages.mjs';
import {makeIcons} from './circuit-supplier-pages.mjs';
import {suppliersLine,SUPPLIERS_STYLE} from './suppliers.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ID='plastic-bars';
const MODEL='scripts/essentials-pages/preview-model.json';
const SIZE_ORDER=['small','medium','large'];
const hash=s=>createHash('sha256').update(s).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=s=>s.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
const words=s=>s.replaceAll('-',' ');
const json=s=>JSON.stringify(s,null,2).replaceAll('<','\\u003c');
const num=n=>Number.isFinite(n)?Number(n.toFixed(2)).toLocaleString('en-US'):'—';
const tile=p=>`(${Math.floor(p.x)}, ${Math.floor(p.y)})`;
const REPRODUCE=[
 `node scripts/${ID}/generate.mjs                      # writes the three strings and manifest.json`,
 `node --test tests/${ID}.test.mjs`,
 `node scripts/${ID}/validate.mjs --size small         # full native protocol, writes native-report-small.json (also medium, large); needs a local Factorio 2.1.24 install, run headless with a private profile under .cache/${ID}/`
];

/** The README's own pairing table ("Which size for which blueprint"): header cells and rows, inline code kept as code. */
export function pairingTable(readme){
 const section=readme.split(/^## /m).find(s=>s.startsWith('Which size for which blueprint'));
 if(!section)throw Error('README has no "Which size for which blueprint" section');
 const rows=section.split('\n').filter(l=>/^\|/.test(l)).map(l=>l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
 if(rows.length<3||!/^-+:?$|^:?-+:?$/.test(rows[1][0]))throw Error('pairing table not found in README');
 const [head,,...body]=rows;
 return {head,body};
}
const cell=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>');

/** Read the three sizes. Each record says whether its exact import has passing native evidence. */
export async function loadPlasticBars(root=ROOT){
 const dir=path.join(root,'blueprint-sources',ID),entries=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 const sizes=[];
 for(const size of SIZE_ORDER){
  const m=entries.find(e=>e.size===size);if(!m||m.family!==ID)throw Error(`${ID}: no ${size} record`);
  const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim(),bp=decodeBlueprint(code)?.blueprint;
  if(!bp?.entities?.length)throw Error(`${m.id}: empty blueprint`);
  const report=JSON.parse(await fs.readFile(path.join(dir,m.reportFile),'utf8').catch(()=>'null'));
  const evidence=exactNativeEvidence(m,code,report);
  sizes.push({size,m,code,bp,report,evidence,qualified:evidence.passed&&m.status==='qualified'&&m.blueprintSha256===hash(code)&&report?.feedScale===1});
 }
 const current=entries.find(e=>e.versions?.length>1);
 const versions=sizes.every(s=>s.qualified)&&current?await checkVersions(current,dir):[];
 const readme=await fs.readFile(path.join(dir,'README.md'),'utf8');
 return {dir,entries,sizes,current,versions,readme,qualified:sizes.every(s=>s.qualified),reason:sizes.filter(s=>!s.qualified).map(s=>`${s.size}: ${s.evidence.passed?'not qualified in its manifest':s.evidence.reason}`).join('; ')};
}

export async function buildPlasticBarPages({root=ROOT}={}){
 const family=await loadPlasticBars(root),out=path.join(root,'site',ID);
 if(!family.qualified){await fs.rm(out,{recursive:true,force:true});return {id:ID,published:false,reason:family.reason};}
 const {dir,versions,readme}=family,product='plastic-bar';
 const model=JSON.parse(await fs.readFile(path.join(root,MODEL),'utf8'));
 const {icon,chip}=await makeIcons(root);
 const per=family.sizes.map(s=>{
  const {m,bp,report,evidence}=s,res=evidence.result;
  if(m.prototypeSha256!==model.prototypeSha256)throw Error(`${m.id}: preview prototype mismatch`);
  const f=footprint(bp,model);for(const key of Object.keys(f))if(m.footprint?.[key]!==f[key])throw Error(`${m.id}: footprint mismatch ${key}`);
  const construction=counts(bp.entities.map(e=>e.name));
  if(JSON.stringify(Object.entries(construction).sort())!==JSON.stringify(Object.entries(m.construction||{}).sort()))throw Error(`${m.id}: construction mismatch`);
  for(const p of m.ports)if(!bp.entities.some(e=>e.entity_number===p.entity))throw Error(`${m.id}: port references missing entity ${p.entity}`);
  const ports=groupPorts(m.ports),at=p=>bp.entities.find(e=>e.entity_number===p.entity).position;
  return {...s,res,f,construction,ports,at,drawn:item=>[...(res.inputs||[]),...(res.fluids||[])].find(x=>x.item===item)?.acceptedPerMinute,plants:m.machineCounts[product]};
 });
 const svgs=Object.fromEntries(await Promise.all(per.map(async s=>[s.size,dedupeIcons(await preview(s.bp,model,s.ports,icon))])));
 const t=s=>s.m.targets[product];
 const sizeRows=per.map(s=>`<tr data-size="${s.size}"><th scope="row">${esc(pretty(s.size))}</th><td>${s.plants}</td><td>${s.f.width} × ${s.f.height} = ${s.f.width*s.f.height}</td><td>${s.bp.entities.length}</td><td>${num(s.drawn('coal'))}</td><td>${num(s.drawn('petroleum-gas'))}</td><td>${num(t(s))}</td><td>${num(s.res.outputsPerMinute[product])}<br><small>recovery ${num(s.res.recovery?.outputsPerMinute?.[product])}</small></td><td>${num(s.m.exitLanes.north)} / ${num(s.m.exitLanes.south)}</td><td>${esc(s.m.outputCaps[product])}</td></tr>`);
 // Ports: coal, gas and exit; where all sizes agree on a tile it is said once, otherwise per size.
 const kindOf={coal:'input','petroleum-gas':'fluid',[product]:'output'};
 const portRow=async item=>{
  const ofSize=per.map(s=>({s,p:s.m.ports.find(p=>p.item===item&&p.kind===kindOf[item])}));
  const byTile=new Map();for(const {s,p} of ofSize)byTile.set(tile(s.at(p)),[...(byTile.get(tile(s.at(p)))||[]),s.size]);
  const where=[...byTile].map(([tl,list])=>byTile.size===1?`${tl} · every size`:`${tl} · ${list.join(' and ')}`).join('<br>');
  const first=ofSize[0].p,ids=[...new Set(ofSize.map(({s,p})=>new Map(s.ports.map(q=>[q.entity,q.marker])).get(p.entity)))];
  const side=first.externalSide,carrier=first.kind==='fluid'?'Pipe':'Belt';
  const rate=item===product?'':ofSize.map(({s,p})=>`${pretty(s.size)} ${num(p.perMinute)}`).join(' · ');
  return `<tr><th>${esc(ids.join(' / '))}</th><td>${await chip(item)}</td><td>${carrier} · ${esc(side)}</td><td>${where}</td><td>${rate?esc(rate):'Output'}</td></tr>`;
 };
 const portRows=[await portRow('coal'),await portRow('petroleum-gas'),await portRow(product)];
 const gasNote=per[0].m.fluids[0].connection;
 const powerTiles=new Set(per.map(s=>{const p=s.at(s.ports.find(q=>q.kind==='power'));return `(${Math.floor(p.x-1)}–${Math.floor(p.x)}, ${Math.floor(p.y-1)}–${Math.floor(p.y)})`;}));
 const pairing=pairingTable(readme);
 const pairRows=pairing.body.map(r=>`<tr>${r.map((c,i)=>i===0?`<th scope="row">${cell(c)}</th>`:`<td>${cell(c)}</td>`).join('')}</tr>`);
 const versionFiles={};
 for(const s of per)for(const file of [s.m.file,s.m.reportFile])versionFiles[file]=await fs.readFile(path.join(dir,file),'utf8');
 const codes=versions.map(v=>per.find(s=>s.m.blueprintSha256===v.blueprintSha256).code);
 const versionHtml=await versionsSection({versions,products:[product],codes,chip,esc,name:pretty,alternatives:true,noun:'size'});
 const minutes=per[0].report.protocolMinutes;
 // Where the petroleum gas comes from: the oil products supplier's own manifest (its gas export and the copies each size needs).
 const oil=await fs.readFile(path.join(root,'blueprint-sources/oil-products/manifest.json'),'utf8').then(t=>JSON.parse(t)[0],()=>null);
 const oilCopies=size=>oil?.pairing?.find(p=>p.family==='plastic-supplier'&&p.id===size)?.copies,oilGas=oil?.outputs?.find(p=>p.item==='petroleum-gas');
 const oilText=oil&&oilGas&&oil.status==='qualified'&&per.every(s=>oilCopies(s.size))?`<p class="oil-source" data-oil-source>Petroleum gas: the <a href="../oil-products/index.html">oil products supplier</a> makes it (${num(oil.targets['petroleum-gas'])} per minute from one copy), gas port to gas port: its outlet at ${tile(oilGas.tile)} to this supplier's gas inlet at (0, 0). ${oilCopies('small')===1&&oilCopies('medium')===1?'One copy feeds a small or a medium size':`${oilCopies('small')} copy for a small and ${oilCopies('medium')} for a medium`}; ${oilCopies('large')} ${oilCopies('large')===1?'copy feeds':'copies feed'} a large.</p>`:'';
 const lede=`Makes plastic bars from coal on one belt and petroleum gas in one pipe, and sends them out on the east side on one red belt, in three sizes: ${per.map(s=>`${s.size} ${num(t(s))} per minute`).join(', ').replace(/, ([^,]*)$/,' and $1')}. The medium size is the one to start from; the pairing table says which size each library blueprint needs.`;
 const evidenceRows=per.map(s=>`<tr><th scope="row">${esc(pretty(s.size))}</th><td>${num(s.res.outputsPerMinute[product])}</td><td>${num(s.res.recovery?.outputsPerMinute?.[product])}</td><td>${num(t(s))}</td><td>${esc(s.res.blocked?.collectionPauseStock?.[0]?.count)}</td><td>${Object.values(s.res.checks||{}).filter(v=>v===true).length} of ${Object.keys(s.res.checks||{}).length}</td><td><a href="${esc(s.m.reportFile)}">${esc(s.m.reportFile)}</a></td><td class="hash">${esc(s.m.blueprintSha256)}</td></tr>`);
 const layouts=per.map(s=>`<h3 id="layout-${s.size}">${esc(pretty(s.size))} · ${s.f.width} × ${s.f.height}</h3><div class="layout-map" tabindex="0"><img src="layout-${s.size}.svg" alt="Exact saved ${esc(s.m.name)} layout with numbered connections"></div><p><a href="layout-${s.size}.svg">Full-size SVG</a></p>`).join('');
 const html=`<html><head><title>Plastic bar supplier · three sizes</title><style>${STYLE}${SUPPLIERS_STYLE}${VERSIONS_STYLE}</style></head><body><aside><a href="#sizes">Sizes side by side</a><a href="#versions">Import &amp; download</a><a href="#layouts">Layouts</a><a href="#ports">Ports</a><a href="#power">Power</a><a href="#pairing">Which size</a><a href="#evidence">Native evidence</a><a href="#reproduce">Reproduce</a></aside><main><div class="workshop-guide" data-page="${ID}"><p class="eyebrow">SUPPLIERS · 22 NOVEMBER 2026 · EXACT SAVED LAYOUT</p><h1>Plastic bar supplier · three sizes</h1><p class="lede">${esc(lede)}</p><p class="evidence matched" data-evidence="matched">Native production tested · all three sizes passed their full native protocol for their exact import string.</p>${suppliersLine(ID)}<p><a href="../index.html?collection=flight-plans#blueprints">Open in the library</a></p>${oilText}<section id="sizes"><h2>Sizes side by side</h2><p>Each row is one size. Coal and petroleum gas are what the native run drew with every entrance fed at exactly its panel figure; output is measured over its ${esc(minutes.measureMinutes)}-minute window. Exit lanes are bars per minute on the north and south lane of the exit belt.</p>${table(['Size','Chemical plants','Tiles','Entities','Coal in / min','Petroleum gas in / min','Target / min','Measured / min','Exit lanes N / S','Exit cap'],sizeRows)}<p>Parts in every size: chemical plants, red belts, bulk and long-handed inserters (plus fast inserters in the large), pipes, pipe-to-ground and one substation; no modules.</p></section>${versionHtml}<section id="layouts"><h2>Layouts</h2><p class="muted">Schematics of the saved entity positions. Arrows show direction, dashed pale lines join underground belts, gold lines are power wires. Blue markers are entrances, green markers are the output, P is electricity. Tiles count from the top-left tile (0, 0).</p>${layouts}</section><section id="ports"><h2>Ports</h2><p>The coal belt and the gas pipe are on the same tiles in every size, so a size can be swapped for another without moving the inputs.</p>${table(['#','Item','Carried by · side','Tile','Panel per minute'],portRows)}<ul><li>Coal: one belt from the west; coal may be on either lane or both.</li><li>Petroleum gas: ${esc(gasNote)}.</li></ul></section><section id="power"><h2>Power</h2><p>One substation per module, ${powerTiles.size===1?`at tiles ${esc([...powerTiles][0])}`:'in the top plant row'}, marked P on the layout. Connect your electric network to it; the one substation covers the whole module. These reports do not record the electric power a size draws.</p></section><section id="pairing"><h2>Which size for which blueprint</h2><p>Plastic bars each library blueprint needs, from the family README. Panel is the blueprint's own published figure; measured is its native draw where one is published. One red belt carries 1,800 per minute, so several suppliers' outputs can share a belt.</p>${table(pairing.head.map(esc),pairRows)}</section><section id="evidence"><h2>Native evidence</h2><p>Factorio ${esc(per[0].report.gameVersion)} Space Age, headless, each exact import string fed exactly its panel figures. Protocol: ${esc(minutes.warmupMinutes)} min warm-up, ${esc(minutes.measureMinutes)} min measured, ${esc(minutes.blockedMinutes)} min with the exit blocked, ${esc(minutes.settleMinutes)} min settle, ${esc(minutes.recoveryMinutes)} min recovery.</p>${table(['Size','Steady / min','Recovery / min','Target / min','Exit held when blocked','Native checks passed','Report','Blueprint SHA-256'],evidenceRows)}<p><a href="manifest.json">Source manifest</a> · <a href="README.md">Offline notes</a></p></section><section id="reproduce"><h2>Reproduce</h2><p>From <code>factorio-command-center/</code> in the source repository:</p><pre><code>${REPRODUCE.map(esc).join('\n')}</code></pre></section></div></main><script>${VERSIONS_SCRIPT}</script></body></html>`;
 const files={...versionFiles,'index.html':renderFlightPlanPage(html,{page:ID,rootPrefix:'../'}),'manifest.json':json(family.entries)+'\n','README.md':readme,...Object.fromEntries(per.map(s=>[`layout-${s.size}.svg`,svgs[s.size]])),...Object.fromEntries(per.map(s=>[s.m.reportFile,json(s.report)+'\n']))};
 for(const s of per)files[s.m.file]=s.code+'\n';
 await fs.rm(out,{recursive:true,force:true});
 for(const [file,value] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(out,file)),{recursive:true});await fs.writeFile(path.join(out,file),value);}
 return {id:ID,published:true,sizes:per.map(s=>({size:s.size,blueprintSha256:s.m.blueprintSha256,footprint:s.f})),versions:versions.map(v=>v.label),files:Object.keys(files).length};
}
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildPlasticBarPages(),null,2));
