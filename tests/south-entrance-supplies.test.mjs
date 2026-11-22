// South entrance supplies of the compact six-pack tier: library records, the guide block, the README table and the list
// mechanism (a later factory appears by adding its folder). Run after `npm run build`. No game data needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {loadSouthEntrances,southSuppliesBlock,recoveryOf,BLOCK_START,BLOCK_END,LINK_START} from '../scripts/south-entrance-supplies.mjs';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const read=p=>fs.readFile(p,'utf8');
const FAMILY='flight-science-sided',SOUTH=path.join('blueprint-sources',FAMILY);
const atlas=JSON.parse(await read('site/data/atlas.json'));
const {compact,entrances,factories}=await loadSouthEntrances();
const num=n=>Number(n.toFixed(2)).toLocaleString('en-US');
const text=h=>h.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ');
const BUILT={'electric-furnace-supply':{product:'electric-furnace',width:15,height:7,rate:20,machines:{'electric-furnace':3}},
 'productivity-module-supply':{product:'productivity-module',width:25,height:7,rate:20,machines:{'productivity-module':7}},
 'low-density-structure-supply':{product:'low-density-structure',width:34,height:13,rate:60,machines:{'low-density-structure':20}},
 'processing-unit-supply':{product:'processing-unit',width:36,height:7,rate:40,machines:{'processing-unit':9}},
 'flying-robot-frame-supply':{product:'flying-robot-frame',width:31,height:15,rate:20,machines:{'flying-robot-frame':9,pipe:1,'iron-gear-wheel':1,'engine-unit':5,'electric-engine-unit':5,battery:3}}};

test('the compact tier has five south entrances; five factories each feed one at its entrance rate, none is left in progress',()=>{
 assert.deepEqual(entrances.map(e=>e.item),['electric-furnace','productivity-module','low-density-structure','processing-unit','flying-robot-frame']);
 assert.deepEqual(factories.map(f=>f.id),Object.keys(BUILT).sort());
 for(const f of factories){
  const want=BUILT[f.id],m=f.m,entrance=entrances.find(e=>e.item===want.product);
  assert.ok(f.qualified,f.id);assert.equal(m.products[0],want.product);assert.equal(sha(f.code),m.blueprintSha256);
  assert.equal(m.outputs[0].perMinute,entrance.perMinute,f.id+': makes exactly what its entrance takes');
  // Made at the panel figures: the rate is the entrance rate (the frame factory's 20.03 steady and 20.67 recovery are within its pass bar).
  assert.ok(Math.abs(f.build.outputsPerMinute[want.product]-want.rate)<=want.rate*.01+.001,f.id+': '+f.build.outputsPerMinute[want.product]);assert.ok(Math.abs(recoveryOf(f.build,want.product)-want.rate)<=want.rate*.05,f.id+' recovery');
  assert.equal(f.build.feedScale??1,1,'the block shows the run at the panel figures');
  assert.deepEqual([m.footprint.width,m.footprint.height],[want.width,want.height]);assert.deepEqual(m.machineCounts,want.machines);
  assert.ok(m.prototypeSha256.startsWith('33912441'),'the family flight-21 profile, not the vanilla dump');
  assert.equal(decodeBlueprint(f.code).blueprint.entities.length>0,true);
  for(const p of m.ports.filter(p=>p.kind==='input'||p.kind==='fluid'))assert.equal(p.externalSide,'west');
  assert.equal(m.ports.find(p=>p.kind==='output').externalSide,'east');
 }
});

test('library: one record each in the family\'s collection and style, products and inputs searchable',()=>{
 const sample=atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/flight-science-sided/green-circuit-supply.txt');
 assert.ok(sample,'the family\'s existing supply record');
 for(const f of factories){
  const rec=atlas.blueprints.find(b=>b.file===`sources/designed-blueprints/${FAMILY}/heavy-supplies/${f.id}/${f.m.file}`);
  assert.ok(rec,f.id);
  assert.equal(rec.collection,sample.collection);assert.equal(rec.section,sample.section);assert.equal(rec.purpose,sample.purpose);
  assert.deepEqual(rec.products,f.m.products);assert.deepEqual([...rec.analysis.inputs].sort(),[...f.m.inputs.map(p=>p.item),...(f.m.fluids||[]).map(p=>p.item??p.fluid)].sort(),f.id+': belts and pipes are both inputs');
  assert.equal(rec.validation.status,'game-tested');assert.equal(rec.blueprintSha256,f.m.blueprintSha256);assert.equal(rec.recommendedProducts,undefined,'no recommendation changes');
 }
 // Rocket supplies keeps its recommendation for processing units.
 assert.ok(atlas.blueprints.find(b=>b.file?.includes('/rocket-supplies/rocket-supplies.txt')).recommendedProducts.includes('processing-unit'));
 assert.equal(atlas.blueprints.filter(b=>b.recommendedProducts?.includes('processing-unit')).length,1);
 // The three existing supplies and the science tiers are as before.
 for(const id of ['green-circuit-supply','advanced-circuit-supply','engine-supply'])assert.ok(atlas.blueprints.some(b=>b.file===`sources/designed-blueprints/${FAMILY}/${id}.txt`),id);
});

test('guide: the South entrance supplies block sits with the supply factories, one row per entrance, links only for built factories',async()=>{
 const html=await read(`site/${FAMILY}/index.html`);
 assert.equal(html.split(BLOCK_START).length,2,'one block');assert.equal(html.split(LINK_START).length,2,'one pointer');
 const block=html.slice(html.indexOf(BLOCK_START),html.indexOf(BLOCK_END)),t=text(block);
 assert.ok(html.indexOf('<section id="supplies">')<html.indexOf(BLOCK_START)&&html.indexOf(BLOCK_START)<html.indexOf('<section id="compare">'),'inside the supply factories section');
 assert.ok(html.indexOf('<section id="compact">')<html.indexOf(LINK_START)&&html.indexOf(LINK_START)<html.indexOf('<section id="supplies">'),'a pointer in the Compact section');
 assert.ok(html.includes('href="#south-entrance-supplies"')&&html.includes('id="south-entrance-supplies"'));
 assert.equal((block.match(/<tr data-entrance=/g)||[]).length,5);assert.equal((block.match(/data-factory=/g)||[]).length,5);
 entrances.forEach((e,i)=>assert.ok(t.includes(`South entrance ${i+1} of 5 · ${e.item.replaceAll('-',' ')} · ${num(e.perMinute)}/min · (${e.position.x}, ${e.position.y})`),e.item));
 for(const f of factories){
  const row=block.match(new RegExp(`<tr data-entrance="${f.m.products[0]}" data-factory="${f.id}">[\\s\\S]*?</tr>`))[0],r=text(row);
  assert.ok(r.includes(`${f.m.footprint.width} × ${f.m.footprint.height} tiles`)&&r.includes(`${num(f.build.outputsPerMinute[f.m.products[0]])} recovery ${num(recoveryOf(f.build,f.m.products[0]))}`),f.id);
  for(const p of f.m.inputs)assert.ok(r.includes(`${p.item.replaceAll('-',' ')} ${num(p.perMinute)}`),f.id+' '+p.item);
  const dir=`heavy-supplies/${f.id}/`;
  for(const l of [f.m.file,'native-report.json','manifest.json','README.md']){assert.ok(row.includes(`href="${dir}${l}"`),f.id+' '+l);await fs.access(`site/${FAMILY}/${dir}${l}`);}
  assert.ok(row.includes('data-south-copy')&&block.includes(`id="south-code-${f.id}"`)&&!block.includes("<textarea")&&!block.includes("<article"));
  assert.equal(sha(await read(`site/${FAMILY}/${dir}${f.m.file}`)),f.m.blueprintSha256);
 }
 assert.ok(!block.includes('In progress'),'no entrance is left in progress');
 for(const f of factories.filter(f=>f.m.fluids?.length)){const r=text(block.match(new RegExp(`<tr data-entrance="${f.m.products[0]}" data-factory="${f.id}">[\\s\\S]*?</tr>`))[0]);for(const x of f.m.fluids)assert.ok(r.includes(`${(x.item||x.fluid).replaceAll('-',' ')} ${num(x.perMinute)} (pipe)`),f.id+' fluid');}
 // The existing supply factories on the page are untouched.
 for(const id of ['green-circuit-supply','advanced-circuit-supply','engine-supply'])assert.ok(html.includes(`<article id="${id}">`),id);
});

test('the list takes more: a folder missing from the list reads "in progress" and adding it turns its row to built; the block is idempotent',async()=>{
 const root='.cache/south-supplies-test';
 await fs.rm(root,{recursive:true,force:true});
 await fs.cp(SOUTH,path.join(root,SOUTH),{recursive:true});
 const folder=id=>path.join(root,SOUTH,'heavy-supplies',id);
 // Without the two last factories the block is as it was with three: those two entrances are in progress, without links.
 for(const id of ['processing-unit-supply','flying-robot-frame-supply'])await fs.rm(folder(id),{recursive:true,force:true});
 const three=await southSuppliesBlock(root);
 assert.equal(three.count.built,3);
 for(const item of ['processing-unit','flying-robot-frame']){
  const row=three.html.match(new RegExp(`<tr data-entrance="${item}">[\\s\\S]*?</tr>`))[0];
  assert.ok(row.includes('In progress')&&!row.includes('href=')&&!row.includes('<button'),item+' is in progress, no links');
 }
 // Putting the processing-unit factory back (a copy of the published folder) turns its row to built and leaves the frame row in progress.
 await fs.cp(path.join(SOUTH,'heavy-supplies/processing-unit-supply'),folder('processing-unit-supply'),{recursive:true});
 const four=await southSuppliesBlock(root);
 assert.equal(four.count.built,4);
 assert.ok(/<tr data-entrance="processing-unit" data-factory="processing-unit-supply">/.test(four.html)&&!/<tr data-entrance="processing-unit">/.test(four.html));
 assert.ok(/<tr data-entrance="flying-robot-frame">/.test(four.html));
 await fs.rm(root,{recursive:true,force:true});
 const five=await southSuppliesBlock();
 assert.equal(five.count.built,5);assert.equal(five.html,(await southSuppliesBlock()).html,'deterministic');
});

test('README: the validated supply factories table gains the five rows, with the manifests\' figures; the 80% frame run is stated, not a pass bar',async()=>{
 const readme=await read(`${SOUTH}/README.md`),rows=readme.split('\n').filter(l=>/^\| (Green|Red|Engines|Electric|Productivity|Low-density|Processing|Flying)/.test(l));
 assert.equal(rows.length,8);
 const label={'electric-furnace':'Electric furnaces','productivity-module':'Productivity modules','low-density-structure':'Low-density structures','processing-unit':'Processing units','flying-robot-frame':'Flying robot frames'};
 for(const f of factories){
  const row=rows.find(r=>r.startsWith(`| ${label[f.m.products[0]]} |`));assert.ok(row,f.id);
  const cells=row.split('|').map(c=>c.trim());
  const inputs=[...f.m.inputs.map(p=>`${p.item.replaceAll('-',' ')}s ${num(p.perMinute)}`),...(f.m.fluids||[]).map(p=>`${(p.item||p.fluid).replaceAll('-',' ')} ${num(p.perMinute)} (pipe)`)];
  const want=inputs.join('; ').replace(/^./,c=>c.toUpperCase());
  assert.equal(cells[2],f.id==='flying-robot-frame-supply'?'Iron plates 120; copper plates 40; steel plates 40; electronic circuits 100; lubricant 300 (pipe); sulfuric acid 800 (pipe)':want,f.id+' inputs');
  if(f.id==='flying-robot-frame-supply'){assert.deepEqual(new Set(inputs.map(x=>x.replace(/ \d.*/,''))),new Set(['iron plates','copper plates','steel plates','electronic circuits','lubricant','sulfuric acid']));}
  assert.equal(cells[3],f.build.outputsPerMinute[f.m.products[0]].toFixed(2));
  assert.equal(cells[4],`${f.m.footprint.width} × ${f.m.footprint.height}`);
  assert.ok(cells[5].startsWith(String(Object.values(f.m.machineCounts).reduce((a,b)=>a+b,0)===24?24:Object.values(f.m.machineCounts)[0])),f.id+' machines');
 }
 assert.ok(readme.includes('15.97 steady, 15.00')&&readme.includes('is not a pass bar'));
 assert.ok(!readme.includes('are in progress'));
});
