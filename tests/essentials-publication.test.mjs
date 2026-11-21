// Essentials round publication: library records, search fields, coverage, guide pages and the landing page.
// Run after `npm run build` (site/data/atlas.json and the generated pages are build outputs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {exactNativeEvidence} from '../scripts/workshop-guides.mjs';
import {ESSENTIALS_IDS,ESSENTIALS_RELEASE,loadEssentials,pairing,dedupeIcons} from '../scripts/essentials-pages.mjs';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const atlas=JSON.parse(await fs.readFile('site/data/atlas.json','utf8'));
const CONTRACT={
 'green-circuits':{section:'Circuits',purpose:'Circuit production',inputs:['iron-plate','copper-plate'],outputs:['electronic-circuit']},
 'essentials-mall':{section:'Building essentials',purpose:'Production',inputs:['iron-plate','copper-plate','steel-plate','stone-brick','plastic-bar','electronic-circuit'],outputs:['assembling-machine-2','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','bulk-inserter','electric-furnace','electric-mining-drill']},
 'robot-essentials':{section:'Robots and logistics',purpose:'Robot production',inputs:['iron-plate','copper-plate','steel-plate','plastic-bar','electronic-circuit','sulfuric-acid','lubricant'],outputs:['construction-robot','logistic-robot','roboport','storage-chest','passive-provider-chest']},
 'six-science':{section:'Science · six packs from supplied circuits',purpose:'Science production',inputs:['iron-plate','copper-plate','steel-plate','stone-brick','stone','coal','plastic-bar','sulfur','electronic-circuit','sulfuric-acid','lubricant'],outputs:['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack','production-science-pack','utility-science-pack']}
};
const sorted=a=>[...a].sort();
const records=await loadEssentials();
const published=records.filter(r=>r.qualified);
const recordFor=id=>atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/'+id+'/'));

test('every published essentials blueprint has exact-hash passing native evidence',()=>{
 assert.deepEqual(records.map(r=>r.id),ESSENTIALS_IDS);
 for(const r of published){
  assert.equal(sha(r.code),r.m.blueprintSha256,r.id);
  assert.equal(r.report.passed,true,r.id);
  assert.ok(r.report.builds.some(b=>b.blueprintSha256===r.m.blueprintSha256&&b.passed===true),r.id);
 }
 // A stale report never qualifies.
 const r=published[0],stale=structuredClone(r.report);stale.builds[0].blueprintSha256='0'.repeat(64);
 assert.equal(exactNativeEvidence(r.m,r.code,stale).passed,false);
});

test('library records carry the search fields: inputs, outputs, section, category and purpose',()=>{
 for(const r of published){
  const b=recordFor(r.id),want=CONTRACT[r.id];assert.ok(b,r.id);
  assert.equal(b.collection,'Long game flight plans and strategies');
  assert.equal(b.releaseGroup,ESSENTIALS_RELEASE);
  assert.equal(b.lifecycle,'current');
  for(const field of ['section','category','purpose'])assert.ok(typeof b[field]==='string'&&b[field].length,r.id+' '+field);
  assert.equal(b.section,want.section);assert.equal(b.category,want.section);assert.equal(b.purpose,want.purpose);
  assert.ok(b.analysis.inputs.length&&b.products.length&&b.analysis.outputs.length,r.id);
  assert.deepEqual(sorted(b.analysis.inputs),sorted(want.inputs),r.id+' inputs');
  assert.deepEqual(sorted(b.products),sorted(want.outputs),r.id+' products');
  assert.deepEqual(b.analysis.outputs,b.products);
  assert.equal(b.validation.status,'game-tested');assert.equal(b.validation.blueprintSha256,b.blueprintSha256);assert.equal(b.blueprintSha256,r.m.blueprintSha256);
  assert.deepEqual(sorted(b.recommendedProducts),sorted(want.outputs),r.id+' recommendation');
  for(const id of b.products)assert.ok(b.measuredOutputsPerMinute[id]>0,r.id+' '+id);
  if(r.m.greenCircuitSupply)assert.ok(b.setupNotes.some(n=>/supplied electronic circuits/.test(n)&&n.includes(String(r.m.greenCircuitSupply.copiesOfGreenCircuits)+' green-circuit supplier')),r.id+' circuit note');
 }
 // The earlier "today" group keeps exactly nine entries.
 assert.equal(atlas.blueprints.filter(b=>b.releaseGroup==='flight-workshops-20261117').length,9);
 assert.equal(atlas.blueprints.filter(b=>b.releaseGroup===ESSENTIALS_RELEASE).length,published.length);
});

test('each product of each new design is covered, led by the new design',()=>{
 for(const r of published){const b=recordFor(r.id);
  for(const id of b.products){const item=atlas.coverage.items.find(i=>i.id===id);assert.ok(item,id);assert.ok(item.builds.includes(b.id),r.id+' '+id);assert.equal(item.builds[0],b.id,r.id+' leads '+id);}}
 // Superseded workshops stay listed as alternatives; the inserter workshop keeps the two arms the mall does not make.
 const inserters=atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/inserter-workshop/'));
 assert.deepEqual(sorted(inserters.recommendedProducts),['inserter','long-handed-inserter']);
 const robots=atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/robot-logistics-workshop/'));
 assert.ok(atlas.coverage.items.find(i=>i.id==='logistic-robot').builds.includes(robots.id));
});

test('guide pages and the landing page are offline, exact and complete',async()=>{
 for(const r of published){
  const html=await fs.readFile(`site/${r.id}/index.html`,'utf8');
  assert.ok(html.includes(r.m.blueprintSha256),r.id);
  assert.ok(html.includes(r.code.slice(0,200)),r.id+' import string');
  assert.equal((await fs.readFile(`site/${r.id}/${r.m.file}`,'utf8')).trim(),r.code);
  assert.equal(JSON.parse(await fs.readFile(`site/${r.id}/native-report.json`,'utf8')).passed,true);
  // Supply advice follows the evidence: panel figures only when a panel-supply run passed for this exact string.
  if(r.panelSupply){
   const panel=JSON.parse(await fs.readFile(`site/${r.id}/panel-supply-report.json`,'utf8'));
   assert.equal(exactNativeEvidence(r.m,r.code,panel).passed,true,r.id+' panel supply report');
   assert.ok(html.includes('href="panel-supply-report.json"'),r.id+' links the panel supply report');
   assert.match(html,/panel figures are enough/,r.id);assert.doesNotMatch(html,/Plan supply for the Measured column/,r.id);
  }else assert.match(html,/Plan supply for the Measured column/,r.id);
  for(const p of [...r.m.inputs,...r.m.fluids])assert.ok(html.includes(`(${p.x}, ${p.y})`),r.id+' entrance '+p.item);
  assert.ok(html.includes(`node scripts/${r.id}/generate.mjs`),r.id+' reproduce');
  assert.doesNotMatch(html,/(?:src|href)="(?:https?:)?\/\//,r.id+' no network URLs');
  assert.doesNotMatch(await fs.readFile(`site/${r.id}/layout.svg`,'utf8'),/href="https?:/);
 }
 const landing=await fs.readFile('site/essentials/index.html','utf8');
 assert.ok(records.find(r=>r.id==='robot-essentials').panelSupply,'robot essentials carries its passing panel-supply run');
 assert.doesNotMatch(landing,/(?:src|href)="(?:https?:)?\/\//);
 for(const r of published){assert.ok(landing.includes(`href="../${r.id}/index.html"`),r.id);assert.ok(landing.includes(`href="../${r.id}/native-report.json"`),r.id);assert.ok(landing.includes(r.m.blueprintSha256),r.id);}
 const book=decodeBlueprint(await fs.readFile('site/essentials/essentials-book.txt','utf8')).blueprint_book;
 assert.equal(book.blueprints.length,published.length);
 for(const [i,r] of published.entries())assert.deepEqual(book.blueprints[i].blueprint,r.bp);
 const nav=await fs.readFile('site/flight-plans.js','utf8');assert.match(nav,/href:'essentials\/index\.html'/);
});

test('pairing table: copies of the supplier per consumer and for all three',()=>{
 const p=pairing(records);
 assert.equal(p.perCopy,360);
 assert.deepEqual(Object.fromEntries(p.rows.map(r=>[r.id,r.copies])),{'essentials-mall':1,'robot-essentials':1,'six-science':3});
 for(const r of p.rows){assert.equal(r.copies,Math.ceil(r.nominal/360));assert.ok(r.measured<=r.copies*360,r.id+' measured draw fits');}
 assert.equal(p.total.copies,4);assert.equal(p.total.measuredCopies,4);
});

test('layout icons are embedded once per recipe',()=>{
 const img='<image href="data:image/png;base64,AAAA" x="1" y="2" width="3" height="3"/>';
 const out=dedupeIcons(`<svg viewBox="0 0 9 9">${img}${img.replace('x="1"','x="5"')}</svg>`);
 assert.equal(out.match(/data:image/g).length,1);assert.equal(out.match(/<use /g).length,2);
});
