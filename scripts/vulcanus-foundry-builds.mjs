/** One page for the five Vulcanus blueprints built on 25 November 2026: the foundry mall, its two supplies (coal to plastic bars
 * and lubricant, tungsten carbide) and the two plate-fed malls (assembling machine 3, express belts): site/vulcanus-foundry-builds/
 * (index.html, vulcanus.css, one string and one layout picture per blueprint). Every figure is read from the committed manifest,
 * ports and native report of each blueprint folder when this runs, never typed here, so the page follows the data when a
 * blueprint is re-released (a new string, new caps, new draws). The prose of the caveats is read from each README.
 * The page is written only when every blueprint's native report passed for the exact SHA-256 of its blueprint.txt; otherwise this throws.
 * Styling and the copy button are the ones of the today page (../todays-flight-builds/today.css, today.js).
 * CLI: node scripts/vulcanus-foundry-builds.mjs   (run from factorio-command-center/; no game data needed)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ID='vulcanus-foundry-builds';
export const TITLE='Vulcanus foundry builds';
export const BUILT='25 November 2026';

/** The five blueprints, in page order. Only folders, groups and which README passages to quote live here; no figures. */
export const GROUPS={
 foundry:{label:'The foundry mall',lead:'The one blueprint that does the work: lava and calcite in, the finished items out in five chests.'},
 supplies:{label:'Supplies that feed the foundry mall',lead:'One copy of each covers the foundry mall (see the table above). Build them first, or at the same time.'},
 plates:{label:'Plate-fed malls (not on the foundry chain)',lead:'These two run from smelted plates that you bring yourself. They use neither the foundry mall nor its supplies.'}
};
export const BUILDS=[
 {key:'foundry-mall',dir:'requested-malls/foundry-mall',kind:'foundry',group:'foundry',caveats:[
  {section:'',only:/order of the list|^Rocket parts/},{section:'Entrances, exit, power',only:/^- /},{section:'Things to know',skip:/\bU[12]\b/}]},
 {key:'coal-plastic-lubricant',dir:'vulcanus-supplies/coal-plastic-lubricant',kind:'supply',group:'supplies',caveats:[
  {section:'What to preserve'},{section:'Power'},{section:'How it balances itself (no circuits)',only:/Taking more than/}]},
 {key:'tungsten-carbide',dir:'vulcanus-supplies/tungsten-carbide',kind:'supply',group:'supplies',caveats:[
  {section:'What to preserve'},{section:'Power'}]},
 {key:'assembler-3-mall',dir:'requested-malls/assembler-3-mall',kind:'assembler',group:'plates',caveats:[
  {section:'',only:/^- \*\*Measured rate/},{section:'Inputs: four belts on the west edge',only:/^Each entrance/},
  {section:'What it costs: one assembling machine 3',only:/^An assembling machine 2 on its own/},{section:'Native test',only:/^\*\*Game version/}]},
 {key:'express-belt-mall',dir:'requested-malls/express-belt-mall',kind:'express',group:'plates',caveats:[
  {section:'Products and recipes',only:/^Assembling machine 2 crafting speed/,sentences:/^\*\*(Plastic bars|Lubricant)/},
  {section:'Outputs',only:/^Take items by hand/},{section:'Measured rates and draw',only:/^These are measured figures/}]}
];
/** Where each foundry mall input comes from. Supplied items name the blueprint (by key) that makes them; the rest are the player's own. */
export const SUPPLIED_BY={'plastic-bar':'coal-plastic-lubricant',lubricant:'coal-plastic-lubricant','tungsten-carbide':'tungsten-carbide'};
export const OWN_SOURCE={lava:'Offshore pumps on a lava lake. There is no blueprint for this one.',calcite:'A belt from your own calcite mining. There is no blueprint for this one.',
 'sulfuric-acid':'Your own sulfuric acid source. There is no blueprint for this one.',water:'Your own water source. There is no blueprint for this one.'};

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readJSON=async f=>JSON.parse(await fs.readFile(f,'utf8'));
/** A figure as shown: at most one decimal, thousands separated. */
export const fmt=n=>Number.isFinite(n)?Number(n.toFixed(1)).toLocaleString('en-US'):'—';
const plain=t=>t.replace(/\bAM([123])\b/g,'assembling machine $1').replace(/\bOUT-STONE\b/g,'the stone exit').replace(/\\\|/g,'|');
const inline=t=>esc(plain(t)).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');

/** Lines of one README section (section '' is the text before the first "## "), without tables, code and headings; bullets lose their dash.
 * `only` keeps just the lines (as written, dash included) that match, `skip` drops the ones that match, `sentences` keeps just the matching
 * sentences of each kept line. A section that does not exist is an error. */
export function readmeLines(readme,section,only,{skip,sentences}={}){
 const parts=readme.split(/^## /m);
 const body=section===''?parts[0].split('\n').slice(1):(parts.find(s=>s.startsWith(section+'\n'))??(()=>{throw Error(`README has no "${section}" section`);})()).split('\n').slice(1);
 const out=[];let fence=false;
 for(const raw of body){
  const line=raw.trim();
  if(line.startsWith('```')){fence=!fence;continue;}
  if(fence||!line||line.startsWith('|')||line.startsWith('#'))continue;
  if(only&&!only.test(line)||skip?.test(line))continue;
  const text=line.replace(/^- /,'');
  if(sentences){const keep=text.split(/(?<=[.!?])\s+(?=[A-Z*])/).filter(x=>sentences.test(x));if(keep.length)out.push(keep.join(' '));}
  else out.push(text);
 }
 return out;
}

/** Peak draw of the foundry mall per input: the maximum, over the measured rate windows of the native report, of what the machines consumed
 * per minute. This is the derivation scripts/index-designed-blueprints.mjs registers as `drawn`; `window` names the window that set the peak. */
export function peakDraw(report){
 const drawn={},window={};let stone=0;
 for(const ph of report.scenarios.rate.phases.filter(p=>p.perMinute)){
  for(const [item,v] of Object.entries(ph.perMinute.consumed))if(v>(drawn[item]??-1)){drawn[item]=v;window[item]=ph.name.replace(/^rate:\s*/,'').replace(/^group \d+ \((.*)\)$/,'$1');}
  stone=Math.max(stone,ph.perMinute.stoneOut??0);
 }
 return {drawn,window,stone};
}

/** The exact-hash checks: the string matches the manifest and ports, and the native report passed for that string. */
export function verifyBuild(spec,{m,ports,report,code}){
 const hash=sha(code);
 if(m.id!==spec.key)throw Error(`${spec.key}: unexpected manifest id ${m.id}`);
 if(hash!==m.candidateSha256||ports.candidateSha256!==m.candidateSha256)throw Error(`${spec.key}: blueprint.txt does not match the manifest hash`);
 if(report.passed!==true||report.blueprintSha256!==hash)throw Error(`${spec.key}: no passing native report for this exact string`);
 return hash;
}

/** Everything one blueprint folder says, with the exact-hash evidence checked. */
export async function loadBuild(spec,root=ROOT){
 const dir=path.join(root,'blueprint-sources',spec.dir);
 const [m,ports,report,readme,layout,codeRaw]=await Promise.all([readJSON(path.join(dir,'manifest.json')),readJSON(path.join(dir,'ports.json')),readJSON(path.join(dir,'native-report.json')),
  fs.readFile(path.join(dir,'README.md'),'utf8'),fs.readFile(path.join(dir,'layout.svg'),'utf8'),fs.readFile(path.join(dir,'blueprint.txt'),'utf8')]);
 const code=codeRaw.trim();
 return {spec,m,ports,report,readme,layout,code,hash:verifyBuild(spec,{m,ports,report,code})};
}
export const loadBuilds=(root=ROOT)=>Promise.all(BUILDS.map(s=>loadBuild(s,root)));

const side=p=>p.side??p.label?.match(/\b(west|east|south|north)\b/)?.[1];
const tile=(p,fp)=>{const q=p.tile??p.position??p.entrance;return q?{col:Math.floor(q.x-fp.bounds.left),row:Math.floor(q.y-fp.bounds.top)}:null;};
const where=(p,fp)=>{const t=tile(p,fp);return `${side(p)?side(p)+' edge':'—'}${t?`, tile (${t.col}, ${t.row})`:''}`;};

/** The figures of one build, in one shape for all five kinds of report. */
export function describe(b,names){
 const {spec,m,ports,report}=b,fp=m.footprint,name=id=>names.get(id)||id.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
 const itemLabel=id=>{const q=id.match(/^(.*?)\s*\((.*)\)$/);return q?`${name(q[1])} (${q[2]})`:name(id);};
 const h1=b.readme.match(/^# (.+)$/m)?.[1]??m.id,[title,...rest]=h1.split(' · ');
 const v={key:spec.key,group:spec.group,kind:spec.kind,name:title.trim(),tagline:rest.join(' · '),code:b.code,hash:b.hash,gameVersion:report.gameVersion,
  size:{width:fp.width,height:fp.height,area:fp.area,entities:fp.entities},equipment:m.equipment,itemLabel,nameOf:name};
 const fluidOrBelt=p=>p.mode??p.kind;
 let needs={},outputRate={},peakWindow={},stone=null;
 if(spec.kind==='foundry'){
  const peak=peakDraw(report);needs=peak.drawn;peakWindow=peak.window;stone=peak.stone;
  for(const ph of report.scenarios.rate.phases.filter(p=>p.perMinute))for(const [item,x] of Object.entries(ph.perMinute.collected))if(x>0)outputRate[item]=x;
  v.fillMinutes=report.scenarios.fill.phases[0].ticks/3600;
 }else if(spec.kind==='supply'){
  const th=report.measured.steady.throttled;needs=th.inputsPerMinute;outputRate=th.outputsPerMinute;
 }else if(spec.kind==='assembler'){
  const w=report.windows['rate-am3'];needs=w.inputsPerMinute;outputRate=w.removedPerMinute;v.fillMinutes=report.fillTimes['fill from empty'].both/3600;
 }else{
  needs=report.measured.inputsPerMinute;outputRate=report.measured.outputsPerMinute;v.fillMinutes=report.stockTiming[0].allTick/3600;
 }
 v.needs=needs;v.outputRate=outputRate;
 v.inputs=ports.inputs.map(p=>({item:p.item,mode:fluidOrBelt(p),where:where(p,fp),label:p.label,perMinute:needs[p.item],peak:peakWindow[p.item]}));
 // exits that are belts or pipes: the foundry mall's surplus stone, the supplies' products
 const exitPorts=spec.kind==='foundry'?ports.exits:spec.kind==='supply'?ports.outputs:[];
 v.exits=exitPorts.map(p=>({item:p.item,mode:fluidOrBelt(p),where:where(p,fp),label:p.label,perMinute:spec.kind==='foundry'?stone:outputRate[p.item]}));
 v.power=ports.power?.label;
 // what it makes
 const chests=(ports.outputs||[]).filter(o=>o.chest!==undefined).map(o=>({label:o.label,where:(()=>{const t=tile(o,fp);return t?`tile (${t.col}, ${t.row})`:'—';})(),items:o.items??[o.item],cap:o.cap}));
 const capOf=item=>spec.kind==='foundry'?m.caps[item]:spec.kind==='assembler'?report.chestPeak?.[item]:chests.find(c=>c.items.includes(item))?.cap;
 const row=item=>({item,label:itemLabel(item),cap:capOf(item),perMinute:outputRate[item]});
 if(spec.kind==='foundry'){
  // the chest holding most of the group's items (a kit stock such as "fast-inserter (kit)" counts as its plain item, which another chest also lists)
  const base=i=>i.replace(/\s*\(.*\)$/,''),chestOf=items=>{const n=c=>items.filter(i=>c.items.includes(base(i))).length;return chests.reduce((best,c)=>n(c)>(best?n(best):0)?c:best,undefined);};
  const inGroups=new Set(m.groups.flatMap(g=>g.products)),extras=Object.keys(m.caps).filter(k=>!inGroups.has(k));
  const groups=m.groups.map(g=>({order:g.group,name:g.name,chest:chestOf(g.products),items:g.products.map(i=>row(i))}));
  const leftover=[];
  for(const key of extras){ // a stock that belongs to a group by its note in brackets, e.g. "fast-inserter (kit)"
   const note=(key.match(/\(([^)]*)\)/)?.[1]||'').toLowerCase(),g=note&&groups.find(x=>x.name.toLowerCase().includes(note));
   (g?g.items:leftover).push({item:key,label:itemLabel(key),cap:m.caps[key],perMinute:undefined});
  }
  if(leftover.length)groups.push({order:null,name:'Other stock',chest:undefined,items:leftover});
  v.makesGroups=groups;
 }else if(spec.kind==='supply'){
  v.makesRates=m.outputPorts.map(o=>({item:o.item,label:name(o.item),perMinute:outputRate[o.item],target:m.targets?.[o.item]}));
 }else{
  v.makesGroups=chests.map(c=>({order:null,name:null,chest:c,items:c.items.map(i=>row(i))}));
 }
 v.caveats=spec.caveats.flatMap(c=>readmeLines(b.readme,c.section,c.only,c));
 if(!v.caveats.length)throw Error(`${spec.key}: no caveats found in its README`);
 return v;
}

const table=(head,body,cls='')=>`<div class="table-scroll"><table class="vulcanus-table ${cls}"><thead><tr>${head.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
const hasRates=g=>g.some(x=>x.items.some(i=>i.perMinute!==undefined));

function makesHtml(v){
 if(v.makesRates)return `<h3>What it makes</h3>${table(['Product','Per minute (measured)'].concat(v.makesRates.some(r=>r.target!==undefined)?['Target']:[]),v.makesRates.map(r=>`<tr><td>${esc(r.label)}</td><td class="num">${fmt(r.perMinute)}</td>${v.makesRates.some(x=>x.target!==undefined)?`<td class="num">${fmt(r.target)}</td>`:''}</tr>`).join(''))}`;
 const showGroup=v.makesGroups.some(g=>g.name),rated=hasRates(v.makesGroups);
 const head=[...(showGroup?['Order','Group']:[]),'Item','Stock kept (cap)',...(rated?['Measured per minute']:[]),'Chest'];
 const body=v.makesGroups.map(g=>g.items.map((i,n)=>`<tr>${showGroup&&n===0?`<td class="num" rowspan="${g.items.length}">${esc(g.order??'—')}</td><td rowspan="${g.items.length}">${esc(g.name)}</td>`:''}<td>${esc(i.label)}</td><td class="num">${fmt(i.cap)}</td>${rated?`<td class="num">${i.perMinute===undefined?'—':fmt(i.perMinute)}</td>`:''}${n===0?`<td rowspan="${g.items.length}">${g.chest?`${esc(g.chest.label)}<br><span class="muted">${esc(g.chest.where)}</span>`:'—'}</td>`:''}</tr>`).join('')).join('');
 return `<h3>What it makes</h3>${v.kind==='foundry'?'<p>Made in the order of this table: a group waits while a group above it has something it can make. Caps are edited in one constant combinator on the blueprint.</p>':'<p>Each product has its own passive provider chest, kept at the cap shown.</p>'}${table(head,body)}`;
}
function portsHtml(v){
 const rows=[...v.inputs.map(p=>['In',p]),...v.exits.map(p=>['Out',p])];
 const body=rows.map(([dir,p])=>`<tr><td>${dir}</td><td>${esc(v.nameOf(p.item))}</td><td>${esc(p.mode)}</td><td>${esc(p.where)}<br><span class="muted">${esc(p.label)}</span></td><td class="num">${p.perMinute===undefined?'—':fmt(p.perMinute)}${p.peak?`<br><span class="muted">peak while collecting: ${esc(p.peak)}</span>`:''}</td></tr>`).join('');
 const head=v.kind==='foundry'?'Per minute (peak)':v.kind==='supply'?'Per minute (measured)':'Per minute (measured draw)';
 return `<h3>Entrances and exits</h3><p class="muted">Tiles are counted from the top-left corner of the blueprint (column, row).</p>${table(['','Item','Belt or pipe','Where',head],body)}${v.power?`<p><strong>Power:</strong> connect the labelled substation or pole (panel text <code>${esc(v.power)}</code>).</p>`:''}`;
}
function facts(v){
 const f=[['Size',`${v.size.width} × ${v.size.height} tiles (${fmt(v.size.area)} tiles), ${fmt(v.size.entities)} entities`],['Tested',`Natively in Factorio ${v.gameVersion}, for exactly this string`]];
 const e=v.equipment;
 if(e)f.push(['Built for',`${e.quality} quality items, ${e.modules?`${e.modules} modules`:'no modules'}, ${e.beacons?`${e.beacons} beacons`:'no beacons'}`]);
 if(v.fillMinutes!==undefined)f.push(['From empty to every cap',`${fmt(v.fillMinutes)} minutes (measured)`]);
 return `<dl>${f.map(([k,x])=>`<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>`;
}
function card(v){
 const g=GROUPS[v.group];
 return `<article class="today-card vulcanus-card" id="${esc(v.key)}" data-build-id="${esc(v.key)}"><div class="eyebrow">${esc(g.label)}</div><h2>${esc(v.name)}</h2>${v.tagline?`<p>${esc(v.tagline)}</p>`:''}<div class="today-actions"><button class="button primary" data-copy="${esc(v.key)}">Copy string</button><a class="button secondary" href="${esc(v.key)}.txt" download>Open the string (.txt)</a></div><img class="today-preview" src="${esc(v.key)}-layout.svg" alt="Layout of ${esc(v.name)}" loading="lazy">${facts(v)}${makesHtml(v)}${portsHtml(v)}<h3>Good to know</h3><ul>${v.caveats.map(c=>`<li>${inline(c)}</li>`).join('')}</ul><p class="hash">Blueprint SHA-256: <code>${esc(v.hash)}</code></p><details><summary>Import string</summary><textarea readonly aria-label="${esc(v.name)} import string">${esc(v.code)}</textarea></details></article>`;
}

/** The table at the top: each foundry mall input, where it comes from, the peak draw, and how many copies of its supply that is;
 * then what the two supplies need themselves. */
export function connectHtml(views){
 const mall=views.find(v=>v.kind==='foundry'),supplies=views.filter(v=>v.kind==='supply'),by=new Map(views.map(v=>[v.key,v]));
 const rows=mall.inputs.map(p=>{
  const maker=by.get(SUPPLIED_BY[p.item]);
  let from,cover='—';
  if(maker){
   const out=maker.outputRate[p.item];from=`<a href="#${esc(maker.key)}">${esc(maker.name)}</a>`;
   cover=out>0&&p.perMinute!==undefined?`One copy makes ${fmt(out)} a minute: ${p.perMinute<=out?'one copy covers it':`${Math.ceil(p.perMinute/out)} copies needed`}`:'—';
  }else from=esc(OWN_SOURCE[p.item]??'Your own source. There is no blueprint for this one.');
  return `<tr><td>${esc(mall.nameOf(p.item))}</td><td>${from}</td><td class="num">${fmt(p.perMinute)}${p.peak?`<br><span class="muted">peak while collecting: ${esc(p.peak)}</span>`:''}</td><td>${cover}</td></tr>`;
 }).join('');
 const exitRows=mall.exits.map(p=>`<tr><td>${esc(mall.nameOf(p.item))} (leaves the mall)</td><td>Leaves on a ${esc(p.mode)}, ${esc(p.where)}. Run it away from the mall, for example into lava. If it backs up, the mall stops.</td><td class="num">${fmt(p.perMinute)}</td><td>—</td></tr>`).join('');
 const items=[...new Set(supplies.flatMap(s=>s.inputs.map(p=>p.item)))];
 const feeds=items.map(item=>{const per=supplies.map(s=>s.needs[item]),total=per.reduce((a,x)=>a+(x??0),0);
  return `<tr><td>${esc(mall.nameOf(item))}</td>${per.map(x=>`<td class="num">${x===undefined?'—':fmt(x)}</td>`).join('')}<td class="num">${fmt(total)}</td></tr>`;}).join('');
 return `<section class="connect" id="how-they-connect"><h2>How they connect</h2><p>The foundry mall takes ${mall.inputs.length} inputs. Peak draw is the most each input was used in any of the measured windows of the foundry mall's native test (one product group collected at a time at full caps).</p>${table(['Foundry mall input','Where it comes from','Peak draw per minute','Supply'],rows+exitRows)}<h3>What the two supplies need themselves</h3>${table(['Item',...supplies.map(s=>s.name),'Both together'],feeds)}</section>`;
}

export function renderPage(views,nav){
 const order=Object.keys(GROUPS);
 const sections=order.map(g=>`<section class="vulcanus-group" aria-labelledby="g-${g}"><h2 class="group-title" id="g-${g}">${esc(GROUPS[g].label)}</h2><p>${esc(GROUPS[g].lead)}</p><div class="today-grid">${views.filter(v=>v.group===g).map(card).join('')}</div></section>`).join('');
 const toc=order.map(g=>`<li>${esc(GROUPS[g].label)}: ${views.filter(v=>v.group===g).map(v=>`<a href="#${esc(v.key)}">${esc(v.name)}</a>`).join(', ')}</li>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#171a1c"><title>${TITLE} · Factorio Command Center</title><link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../flight-plans.css"><link rel="stylesheet" href="../todays-flight-builds/today.css"><link rel="stylesheet" href="vulcanus.css"></head><body class="flight-workshop"><a class="skip-link" href="#main">Skip to content</a><aside class="sidebar" id="flight-sidebar" aria-label="Workshop navigation"><a class="flight-brand" href="../index.html"><span>FACTORIO<small>COMMAND CENTER</small></span></a><div class="flight-context">${nav}</div></aside><div class="workspace"><header class="topbar"><button class="icon-button mobile-menu" data-flight-menu aria-controls="flight-sidebar" aria-expanded="false">☰ Workshops</button><a href="../index.html?collection=flight-plans#blueprints">All flight blueprints in the library →</a></header><main id="main" class="today-guide vulcanus-guide"><span class="eyebrow">BUILT ${esc(BUILT.toUpperCase())} · VULCANUS</span><h1>${TITLE}</h1><p>${views.length} blueprints for Vulcanus on one page, so you can place the whole set without hunting through the library. Each one has its string to copy, its layout, its size, what it makes, what it needs, where things go in and out, and what to watch for. Every figure below is read from the blueprint's own files and its native test.</p><ul class="toc">${toc}</ul><p role="status" id="copy-status" aria-live="polite"></p>${connectHtml(views)}${sections}</main></div><script src="../flight-plans.js"></script><script src="../todays-flight-builds/today.js"></script></body></html>`;
}

export async function generate(siteRoot=path.resolve('site'),root=ROOT){
 const catalog=await readJSON(path.join(siteRoot,'data/catalog.json')),names=new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.name]));
 const builds=await loadBuilds(root),views=builds.map(b=>describe(b,names));
 const context={};vm.createContext(context);vm.runInContext(await fs.readFile(path.join(siteRoot,'flight-plans.js'),'utf8'),context);
 const out=path.join(siteRoot,ID);await fs.mkdir(out,{recursive:true});
 for(const b of builds){await fs.writeFile(path.join(out,b.spec.key+'.txt'),b.code+'\n');await fs.writeFile(path.join(out,b.spec.key+'-layout.svg'),b.layout);}
 await fs.writeFile(path.join(out,'vulcanus.css'),CSS);
 await fs.writeFile(path.join(out,'index.html'),renderPage(views,context.FlightPlans.links('../',ID)));
 return {count:views.length,id:ID};
}

const CSS=`/* Vulcanus foundry builds: additions to ../todays-flight-builds/today.css (cards, buttons, previews). Written by scripts/vulcanus-foundry-builds.mjs. */
.vulcanus-guide .toc{line-height:1.9;padding-left:20px}.vulcanus-guide h2.group-title{margin:40px 0 4px}.vulcanus-guide h3{margin:26px 0 8px}.vulcanus-guide .connect{margin:28px 0}.vulcanus-guide .muted{color:var(--muted,#9aa6a0);font-size:.85rem}
.table-scroll{overflow-x:auto;max-width:100%}.vulcanus-table{border-collapse:collapse;width:100%;font-size:.9rem}.vulcanus-table th,.vulcanus-table td{border:1px solid var(--border,#465249);padding:6px 10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.vulcanus-table th{background:#192720}.vulcanus-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.vulcanus-card ul{line-height:1.6}.vulcanus-card h3{font-size:1.1rem}.vulcanus-card details summary{cursor:pointer;margin-top:12px}.vulcanus-guide .today-grid{margin-top:16px}
@media(max-width:600px){.vulcanus-table{font-size:.8rem}.vulcanus-table th,.vulcanus-table td{padding:4px 6px}}
`;

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(await generate()));
