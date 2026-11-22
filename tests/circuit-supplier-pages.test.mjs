// Advanced-circuit and processing-unit suppliers on the website: library records, guide pages, navigation entries and the
// "Suppliers" cross-links. Run after `npm run build` (atlas and guide pages are build outputs). No game data needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {SUPPLIER_IDS,loadSuppliers} from '../scripts/circuit-supplier-pages.mjs';
import {SUPPLIERS,suppliersLine} from '../scripts/suppliers.mjs';
import '../site/flight-plans.js';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const read=p=>fs.readFile(p,'utf8');
const atlas=JSON.parse(await read('site/data/atlas.json'));
const records=await loadSuppliers();
const recordFor=id=>atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/'+id+'/'+id+'.txt');
const num=n=>String(Number(n.toFixed(2)));
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");

test('both suppliers have exact-hash passing native evidence, so both are published',()=>{
 assert.deepEqual(records.map(r=>r.id),SUPPLIER_IDS);
 assert.deepEqual(SUPPLIER_IDS,['advanced-circuits','processing-units']);
 for(const r of records){
  assert.equal(sha(r.code),r.m.blueprintSha256,r.id);
  assert.ok(r.qualified,r.id+': '+r.reason);
  assert.ok(r.report.builds.some(b=>b.blueprintSha256===r.m.blueprintSha256&&b.passed===true),r.id);
 }
});

test('an unqualified family gets no page: a failing report is refused',async()=>{
 const root='.cache/circuit-pages-test';
 await fs.rm(root,{recursive:true,force:true});
 for(const id of SUPPLIER_IDS)await fs.cp('blueprint-sources/'+id,path.join(root,'blueprint-sources',id),{recursive:true});
 const file=path.join(root,'blueprint-sources/advanced-circuits/native-report.json'),report=JSON.parse(await read(file));
 report.builds[0].passed=false;await fs.writeFile(file,JSON.stringify(report));
 const [advanced,units]=await loadSuppliers(root);
 assert.equal(advanced.qualified,false);assert.equal(units.qualified,true);
 await fs.rm(root,{recursive:true,force:true});
});

test('library: one card each in the flight-plans collection, section Circuits, with products and operating inputs for the searches',async()=>{
 const want={'advanced-circuits':{products:['advanced-circuit'],inputs:['copper-plate','iron-plate','plastic-bar']},'processing-units':{products:['processing-unit'],inputs:['copper-plate','iron-plate','plastic-bar','sulfuric-acid']}};
 const green=atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/green-circuits/green-circuits.txt');
 for(const r of records){
  const b=recordFor(r.id);assert.ok(b,r.id+' is in the library');
  assert.equal(b.collection,'Long game flight plans and strategies');
  assert.equal(b.section,green.section,'same section as the green-circuit supplier');assert.equal(b.purpose,green.purpose,'same purpose as the green-circuit supplier');
  assert.deepEqual(b.products,want[r.id].products);
  assert.deepEqual([...b.analysis.inputs].sort(),want[r.id].inputs);
  assert.equal(b.validation.status,'game-tested');assert.equal(b.blueprintSha256,r.m.blueprintSha256);
  assert.ok(b.preview&&await fs.access('site/'+b.preview).then(()=>true,()=>false),r.id+' has a preview image');
  assert.equal(atlas.blueprints.filter(x=>x.file?.startsWith('sources/designed-blueprints/'+r.id+'/')&&!x.file.includes('/history/')).length,1,'one card per family');
 }
 assert.equal(recordFor('processing-units').publication.version,2,'the replaced layout is selectable');
 assert.equal(recordFor('advanced-circuits').publication,undefined);
 // A processing-unit supplier does not take over rocket supplies' recommendation.
 assert.ok(atlas.blueprints.find(b=>b.file?.includes('/rocket-supplies/rocket-supplies.txt')).recommendedProducts.includes('processing-unit'));
});

test('guide pages: rate, inputs table, output, size, machines, power, buttons and the native evidence, all from the family files',async()=>{
 for(const r of records){
  const {m,res=r.evidence.result}=r,product=m.products[0];
  const html=await read(`site/${r.id}/index.html`),main=decode(html.match(/<main\b[\s\S]*<\/main>/)[0]);
  assert.ok(html.includes(`data-page="${r.id}"`));
  assert.ok(main.includes(`${num(m.targets[product])} ${product.replaceAll('-',' ')}s per minute (measured ${num(res.outputsPerMinute[product])})`),r.id+': target and measured rate');
  assert.ok(main.includes(`${m.footprint.width} × ${m.footprint.height} = ${m.footprint.width*m.footprint.height} tiles`),r.id+': size');
  assert.ok(main.includes(`${r.bp.entities.length} entities`));
  for(const [recipe,list] of Object.entries(Object.groupBy(r.bp.entities.filter(e=>e.recipe),e=>e.recipe)))assert.ok(html.includes(`<tr><th>${recipe.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase())}</th><td>${list.length}</td></tr>`),r.id+' machines for '+recipe);
  // One row per entrance, with its tile and panel figure; copper enters twice on the advanced-circuit supplier.
  for(const p of [...m.inputs,...(m.fluids||[])]){
   const row=new RegExp(`${p.item.replaceAll('-',' ')}[\\s\\S]{0,80}?west · \\(${Math.floor(p.x)}, ${Math.floor(p.y)}\\)`,'i');
   assert.match(html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' '),row,r.id+' entrance '+p.item+' at '+Math.floor(p.x)+','+Math.floor(p.y));
   assert.ok(html.includes(`<td>${num(p.perMinute)}</td>`),r.id+' panel figure '+p.perMinute);
  }
  const exit=m.outputs[0];assert.ok(main.includes(`(${Math.floor(exit.x)}, ${Math.floor(exit.y)})`),'exit tile');
  assert.ok(main.includes(`The blueprint holds ${m.construction.substation} substations`),r.id+': power');
  assert.ok(main.includes('substation marked P'));
  // Copy and download of the exact string, the native evidence and the manifest, SVG and README beside the page.
  assert.ok(html.includes('id="copy-import"')&&html.includes(`href="${m.file}" download`));
  assert.ok(html.includes('href="native-report.json"')&&html.includes(r.m.blueprintSha256));
  assert.equal((await read(`site/${r.id}/${m.file}`)).trim(),r.code);
  for(const f of ['layout.svg','manifest.json','native-report.json','README.md'])await fs.access(`site/${r.id}/${f}`);
  assert.equal(sha(await read(`site/${r.id}/native-report.json`)),sha(JSON.stringify(r.report,null,2).replaceAll('<','\\u003c')+'\n'));
  assert.ok(html.includes('data-suppliers'));
 }
 // Advanced circuits: the two copper entrances are named and added up.
 const advanced=await read('site/advanced-circuits/index.html');
 assert.match(decode(advanced),/Copper plate arrives on 2 entrances \(1 at \(0, 1\) and 4 at \(0, 13\)\); together 937\.5 per minute\./);
 // Processing units: the earlier layout is offered, nowhere else.
 const units=await read('site/processing-units/index.html');
 assert.match(units,/Two tested versions: which to choose/);assert.ok(!advanced.includes('id="versions"'));
});

test('navigation: one entry each, every figure in its words is the family manifest figure, icons exist',async()=>{
 const plans=globalThis.FlightPlans.plans;
 for(const r of records){
  const plan=plans.find(p=>p.id===r.id);assert.ok(plan,r.id+' is in the navigation');
  assert.equal(plan.href,`${r.id}/index.html`);
  const product=r.m.products[0];
  assert.ok(plan.detail.includes(`${num(r.m.targets[product])} ${product.replaceAll('-',' ')}s per minute`),plan.detail);
  assert.ok(plan.detail.includes(`${r.m.footprint.width} × ${r.m.footprint.height} tiles`),plan.detail);
  await fs.access(`site/assets/icons/${plan.icon}.png`);
 }
 assert.equal(new Set(plans.map(p=>p.id)).size,plans.length);
});

test('"Suppliers" cross-link: the five guide pages link to one another, and each names itself without a link',async()=>{
 assert.deepEqual(SUPPLIERS.map(s=>s.id),['green-circuits','advanced-circuits','processing-units','plastic-bars','oil-products']);
 for(const s of SUPPLIERS){
  const html=await read(`site/${s.id}/index.html`);
  assert.equal((html.match(/data-suppliers/g)||[]).length,1,s.id);
  assert.ok(!html.includes('Circuit suppliers:'),s.id+': the old line is replaced');
  assert.ok(html.includes(suppliersLine(s.id)),s.id);
  for(const other of SUPPLIERS.filter(o=>o.id!==s.id)){assert.ok(html.includes(`<a href="../${other.id}/index.html" data-supplier="${other.id}">${other.label}</a>`),`${s.id} links ${other.id}`);await fs.access(`site/${other.id}/index.html`);}
  assert.ok(html.includes(`<strong aria-current="page" data-supplier="${s.id}">`),s.id+' marks itself');
 }
});
