// Run after index-designed-blueprints.mjs. Everything is embedded for offline use.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const RELEASE_GROUP='flight-workshops-20261117';
export const TODAY_FOLDERS={'compact-expansion-workshop':1,'rgby-science':3,'five-science':3,'robot-logistics-workshop':1,'inserter-workshop':1};
const sha=code=>createHash('sha256').update(code.trim()).digest('hex');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function todayRecords(atlas){
 const entries=atlas.blueprints.filter(b=>b.releaseGroup===RELEASE_GROUP);
 if(entries.length!==9||new Set(entries.map(b=>b.id)).size!==9)throw Error('Today requires exactly nine distinct indexed imports');
 for(const [folder,count] of Object.entries(TODAY_FOLDERS))if(entries.filter(b=>b.file.startsWith('sources/designed-blueprints/'+folder+'/')).length!==count)throw Error('Unexpected today count for '+folder);
 return entries;
}
export async function verifyToday(entries,siteRoot){
 for(const b of entries){
  const code=await fs.readFile(path.join(siteRoot,b.file),'utf8');
  if(sha(code)!==b.blueprintSha256||code.trim()!==b.code.trim())throw Error('Indexed import fingerprint mismatch: '+b.id);
  if(b.validation?.status!=='game-tested'||b.validation.blueprintSha256!==b.blueprintSha256||!b.validation.report)throw Error('Missing exact native evidence: '+b.id);
  const report=JSON.parse(await fs.readFile(path.join(siteRoot,b.validation.report),'utf8'));
  if(report.passed!==true||!report.builds?.some(p=>p.passed===true&&p.blueprintSha256===b.blueprintSha256))throw Error('Native evidence failed or stale: '+b.id);
 }
}
export function renderToday(entries,nav,catalog){
 const names=new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.name]));
 const label=id=>names.get(id)||id.replaceAll('-',' ');
 const list=ids=>ids.length?ids.map(id=>`<span class="product-token">${esc(label(id))}</span>`).join(' '):'None exported · connected research';
 const cards=entries.map(b=>`<article class="today-card" data-build-id="${esc(b.id)}"><div class="eyebrow">${esc(b.section)} · ${esc(b.purpose)}</div><h2>${esc(b.name)}</h2><p>${esc(b.author)} · ${esc(b.collection)}</p><img class="today-preview" src="../${esc(b.preview)}" alt="Layout of ${esc(b.name)}" loading="lazy"><dl><dt>Operating inputs · external electricity</dt><dd>${list(b.analysis.inputs)}</dd><dt>Finished outputs</dt><dd>${list(b.products)}</dd><dt>Footprint</dt><dd>${esc(b.footprint?.width)} × ${esc(b.footprint?.height)} tiles · ${esc(b.entityCount)} entities</dd><dt>Construction materials</dt><dd>${b.entries.map(p=>`${esc(p.count)} ${esc(label(p.id))}`).join(' · ')}</dd><dt>Measured status</dt><dd>${esc(b.validation.note)}</dd></dl><p class="hash">Blueprint SHA-256: <code>${esc(b.blueprintSha256)}</code></p><div class="today-actions"><button class="button primary" data-copy="${esc(b.id)}">Copy import</button><a class="button secondary" href="../${esc(b.file)}" download>Download import</a><a class="button secondary" href="../${esc(b.sourceURL)}">Workshop guide</a><a class="source-link" href="../${esc(b.validation.report)}">Exact native evidence</a></div><details><summary>Import string and setup</summary><p>${b.setupNotes.map(esc).join(' ')}</p><textarea readonly aria-label="${esc(b.name)} import string">${esc(b.code)}</textarea></details></article>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#171a1c"><title>Today's flight builds · Factorio Command Center</title><link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../flight-plans.css"><link rel="stylesheet" href="today.css"></head><body class="flight-workshop"><a class="skip-link" href="#main">Skip to content</a><aside class="sidebar" id="flight-sidebar" aria-label="Workshop navigation"><a class="flight-brand" href="../index.html"><span>FACTORIO<small>COMMAND CENTER</small></span></a><div class="flight-context">${nav}</div></aside><div class="workspace"><header class="topbar"><button class="icon-button mobile-menu" data-flight-menu aria-controls="flight-sidebar" aria-expanded="false">☰ Workshops</button><a href="../index.html?collection=today#blueprints">Today's flight builds in the library →</a></header><main id="main" class="today-guide"><span class="eyebrow">SESSION · 16–17 NOVEMBER 2026</span><h1>Today's flight builds</h1><p>Nine imports from one session spanning midnight: compact expansion, four-pack science and its two lab variants, five-pack science and its two lab variants, robot logistics and inserters.</p><p><a class="button primary" href="../index.html?collection=today#blueprints">Open all nine in the main library →</a></p><p>Use the library to combine section, purpose, operating-input and finished-output filters. Each import below has matching native evidence for its exact SHA-256. Connected lab variants consume science internally; construction materials describe placement, not production.</p><p role="status" id="copy-status" aria-live="polite"></p><div class="today-grid">${cards}</div></main></div><script src="../flight-plans.js"></script><script src="today.js"></script></body></html>`;
}
export async function generateToday(siteRoot=path.resolve('site')){
 const atlas=JSON.parse(await fs.readFile(path.join(siteRoot,'data/atlas.json'),'utf8'));
 const catalog=JSON.parse(await fs.readFile(path.join(siteRoot,'data/catalog.json'),'utf8'));
 const entries=todayRecords(atlas);await verifyToday(entries,siteRoot);
 const context={};vm.createContext(context);vm.runInContext(await fs.readFile(path.join(siteRoot,'flight-plans.js'),'utf8'),context);
 await fs.mkdir(path.join(siteRoot,'todays-flight-builds'),{recursive:true});
 await fs.writeFile(path.join(siteRoot,'todays-flight-builds/index.html'),renderToday(entries,context.FlightPlans.links('../','today-overview'),catalog));
 return {count:entries.length,releaseGroup:RELEASE_GROUP,url:'index.html?collection=today#blueprints'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(await generateToday()));
