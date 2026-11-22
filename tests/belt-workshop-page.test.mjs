// Belt workshop on the website: library record (registered like the inserter workshop), guide page, navigation entry and the
// cross-link with the inserter workshop guide. Run after `npm run build` (atlas and guide pages are build outputs). No game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadBelt,readmeSection,ID} from '../scripts/belt-workshop-page.mjs';
import '../site/flight-plans.js';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const read=p=>fs.readFile(p,'utf8');
const atlas=JSON.parse(await read('site/data/atlas.json'));
const belt=await loadBelt(),m=belt.m;
const num=n=>String(Number(n.toFixed(2)));
const text=h=>h.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ');
const record=id=>atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/'+id+'/'));

test('exact-hash evidence: the native report passes for this string; the nominal probe is a recorded failure and the other probes pass',()=>{
 assert.equal(sha(belt.code),m.blueprintSha256);assert.ok(belt.qualified,belt.evidence.reason);
 assert.equal(belt.probes['stated-supply'].passed,true);assert.equal(belt.probes['long-block'].passed,true);
 assert.equal(belt.probes['nominal-supply'].passed,false);
 assert.deepEqual(Object.entries(belt.probes['nominal-supply'].builds[0].checks).filter(([,v])=>v!==true).map(([k])=>k),['steady']);
});

test('an unqualified copy gets no page: a failing report is refused',async()=>{
 const root='.cache/belt-page-test';
 await fs.rm(root,{recursive:true,force:true});
 await fs.cp('blueprint-sources/belt-workshop',path.join(root,'blueprint-sources/belt-workshop'),{recursive:true});
 const file=path.join(root,'blueprint-sources/belt-workshop/native-report.json'),report=JSON.parse(await read(file));
 report.builds[0].passed=false;report.passed=false;await fs.writeFile(file,JSON.stringify(report));
 assert.equal((await loadBelt(root)).qualified,false);
 await fs.rm(root,{recursive:true,force:true});
});

test('library: registered like the inserter workshop (same collection and purpose, a section of its own), six belt products, two plate inputs',async()=>{
 const b=record(ID),i=record('inserter-workshop');
 assert.ok(b&&i);assert.equal(atlas.blueprints.filter(x=>x.file?.startsWith('sources/designed-blueprints/'+ID+'/')).length,1);
 assert.equal(b.collection,i.collection);assert.equal(b.purpose,i.purpose);assert.equal(b.section,'Belts');
 assert.deepEqual([...b.products].sort(),[...m.products].sort());assert.deepEqual(m.products.length,6);
 assert.deepEqual([...b.analysis.inputs].sort(),['copper-plate','iron-plate']);
 assert.equal(b.blueprintSha256,m.blueprintSha256);assert.equal(b.validation.status,'game-tested');assert.equal(b.publication,undefined);
 assert.ok(b.preview&&await fs.access('site/'+b.preview).then(()=>true,()=>false));
 assert.deepEqual(b.measuredOutputsPerMinute,belt.evidence.result.outputsPerMinute);
 // Recommendations nobody holds are taken; the essentials mall keeps the red belt products it is pinned to.
 const mall=record('essentials-mall');
 for(const p of m.products){const holders=atlas.blueprints.filter(x=>x.recommendedProducts?.includes(p)).map(x=>x.id);assert.equal(holders.length,1,p+' has one recommended build');}
 for(const p of mall.recommendedProducts.filter(p=>m.products.includes(p)))assert.ok(!b.recommendedProducts.includes(p),p+' stays with the essentials mall');
 assert.deepEqual([...b.recommendedProducts].sort(),m.products.filter(p=>!mall.recommendedProducts.includes(p)).sort());
});

test('guide page: targets and measured rates, caps, required versus nominal supply, probes, the ring section from the README, evidence links',async()=>{
 const html=await read(`site/${ID}/index.html`),t=text(html),res=belt.evidence.result;
 assert.ok(html.includes(`data-page="${ID}"`));assert.equal(sha(await read(`site/${ID}/${m.file}`)),m.blueprintSha256);
 for(const f of ['layout.svg','manifest.json','native-report.json','data.json','README.md','probe-stated-supply-report.json','probe-nominal-supply-report.json','probe-long-block-report.json'])await fs.access(`site/${ID}/${f}`);
 assert.ok(html.includes('id="copy-import"')&&html.includes(`href="${m.file}" download`));
 for(const id of m.products){
  const name=id.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
  assert.ok(t.includes(`${name} ${num(m.targets[id])} ${num(res.outputsPerMinute[id])} ${num(res.recovery.outputsPerMinute[id])} ${m.outputCaps[id]}`),id+': target, steady, recovery and cap in one row');
 }
 assert.ok(t.includes(`${m.footprint.width} × ${m.footprint.height} tiles`)&&t.includes(`${m.machineCounts['iron-gear-wheel']?13:13} AM2`));
 // Required (the stated figures) versus nominal (the recipe arithmetic), and what was measured.
 assert.ok(t.includes(`Give each entrance ${num(m.requiredInputsPerMinute['iron-plate'])} iron plates and ${num(m.requiredInputsPerMinute['copper-plate'])} copper plates a minute (required)`));
 assert.ok(t.includes(`Iron plate ${num(m.requiredInputsPerMinute['iron-plate'])} ${num(res.consumptionPerMinute['iron-plate'])} ${num(m.nominalInputsPerMinute['iron-plate'])}`));
 assert.ok(t.includes(`Copper plate ${num(m.requiredInputsPerMinute['copper-plate'])} ${num(res.consumptionPerMinute['copper-plate'])} ${num(m.nominalInputsPerMinute['copper-plate'])}`));
 assert.match(t,/recorded failure\s*:\s*steady/);assert.ok(t.includes('Stated supply')&&t.includes('Long block'));
 const long=belt.probes['long-block'].builds[0].recovery.blockedMinutes;assert.ok(t.includes(`${long} min`),'the long hold');
 // The ring section is the README's own.
 assert.ok(html.includes('<section id="ring"><h2>How the ring works</h2>'));
 const ring=text(readmeSection(belt.readme,'How it works'));assert.ok(ring.length>1500&&t.includes(ring.slice(0,200)));
 assert.match(t,/Clock\s*:\s*a constant 1 plus the counter/);
 for(const f of ['native-report.json','probe-stated-supply-report.json','probe-nominal-supply-report.json','probe-long-block-report.json','manifest.json'])assert.ok(html.includes(`href="${f}"`),f);
 assert.throws(()=>readmeSection(belt.readme,'Nothing here'),/no "Nothing here" section/);
});

test('cross-link: the belt and inserter workshop guides link to each other',async()=>{
 const beltHtml=await read(`site/${ID}/index.html`),insHtml=await read('site/inserter-workshop/index.html');
 assert.ok(beltHtml.includes('href="../inserter-workshop/index.html" data-workshop="inserter-workshop"'));
 assert.ok(insHtml.includes('href="../belt-workshop/index.html" data-workshop="belt-workshop"')&&(insHtml.match(/data-see-also/g)||[]).length===1);
 await fs.access('site/inserter-workshop/index.html');await fs.access(`site/${ID}/index.html`);
 // The inserter guide is otherwise as before: still its own page with its own data.
 assert.ok(insHtml.includes('data-page="inserter-workshop"'));
});

test('navigation: one entry whose figures are the manifest figures; icon exists',async()=>{
 const plan=globalThis.FlightPlans.plans.find(p=>p.id===ID);assert.ok(plan);assert.equal(plan.href,`${ID}/index.html`);
 assert.ok(plan.detail.includes(`${m.footprint.width} × ${m.footprint.height} tiles`)&&plan.detail.includes('six chests')&&plan.detail.includes('one stack'),plan.detail);
 assert.equal(m.products.length,6);assert.ok(new Set(Object.values(m.outputCaps)).size===2&&Math.max(...Object.values(m.outputCaps))===100,'one stack is 100 belts or 50 others');
 await fs.access(`site/assets/icons/${plan.icon}.png`);
 assert.equal(new Set(globalThis.FlightPlans.plans.map(p=>p.id)).size,globalThis.FlightPlans.plans.length);
});

test('search aliases: red belt and yellow belt are in the library matcher as additions',async()=>{
 const js=await read('site/explorer.js');
 assert.match(js,/red belts\?\\b\/g, 'fast transport belt'\], \[\/\\byellow belts\?\\b\/g, 'transport belt'/);
 assert.match(js,/const matches = \(text, query\) => \{\s*if \(matchesWords\(text, query\)\) return true;/);
});
