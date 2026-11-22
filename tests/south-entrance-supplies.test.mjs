// South entrance supplies of the compact six-pack tier: library records, the guide block, the README table and the list
// mechanism (a later factory appears by adding its folder). Run after `npm run build`. No game data needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {loadSouthEntrances,southSuppliesBlock,BLOCK_START,BLOCK_END,LINK_START} from '../scripts/south-entrance-supplies.mjs';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const read=p=>fs.readFile(p,'utf8');
const FAMILY='flight-science-sided',SOUTH=path.join('blueprint-sources',FAMILY);
const atlas=JSON.parse(await read('site/data/atlas.json'));
const {compact,entrances,factories}=await loadSouthEntrances();
const num=n=>Number(n.toFixed(2)).toLocaleString('en-US');
const text=h=>h.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ');
const BUILT={'electric-furnace-supply':{product:'electric-furnace',width:15,height:7,rate:20,machines:{'electric-furnace':3}},
 'productivity-module-supply':{product:'productivity-module',width:25,height:7,rate:20,machines:{'productivity-module':7}},
 'low-density-structure-supply':{product:'low-density-structure',width:34,height:13,rate:60,machines:{'low-density-structure':20}}};

test('the compact tier has five south entrances; three factories each feed one at its entrance rate, two are still to come',()=>{
 assert.deepEqual(entrances.map(e=>e.item),['electric-furnace','productivity-module','low-density-structure','processing-unit','flying-robot-frame']);
 assert.deepEqual(factories.map(f=>f.id),Object.keys(BUILT).sort());
 for(const f of factories){
  const want=BUILT[f.id],m=f.m,entrance=entrances.find(e=>e.item===want.product);
  assert.ok(f.qualified,f.id);assert.equal(m.products[0],want.product);assert.equal(sha(f.code),m.blueprintSha256);
  assert.equal(m.outputs[0].perMinute,entrance.perMinute,f.id+': makes exactly what its entrance takes');
  assert.equal(f.build.outputsPerMinute[want.product],want.rate);assert.equal(f.build.recovery.outputsPerMinute[want.product],want.rate);
  assert.deepEqual([m.footprint.width,m.footprint.height],[want.width,want.height]);assert.deepEqual(m.machineCounts,want.machines);
  assert.equal(m.prototypeSha256,'33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f','the family flight-21 profile, not the vanilla dump');
  assert.equal(decodeBlueprint(f.code).blueprint.entities.length>0,true);
  for(const p of m.ports.filter(p=>p.kind==='input'))assert.equal(p.externalSide,'west');
  assert.equal(m.ports.find(p=>p.kind==='output').externalSide,'east');
 }
 assert.ok(!factories.some(f=>['processing-unit','flying-robot-frame'].includes(f.m.products[0])));
});

test('library: one record each in the family\'s collection and style, products and inputs searchable',()=>{
 const sample=atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/flight-science-sided/green-circuit-supply.txt');
 assert.ok(sample,'the family\'s existing supply record');
 for(const f of factories){
  const rec=atlas.blueprints.find(b=>b.file===`sources/designed-blueprints/${FAMILY}/heavy-supplies/${f.id}/${f.m.file}`);
  assert.ok(rec,f.id);
  assert.equal(rec.collection,sample.collection);assert.equal(rec.section,sample.section);assert.equal(rec.purpose,sample.purpose);
  assert.deepEqual(rec.products,f.m.products);assert.deepEqual([...rec.analysis.inputs].sort(),f.m.inputs.map(p=>p.item).sort());
  assert.equal(rec.validation.status,'game-tested');assert.equal(rec.blueprintSha256,f.m.blueprintSha256);assert.equal(rec.recommendedProducts,undefined,'no recommendation changes');
 }
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
 assert.equal((block.match(/<tr data-entrance=/g)||[]).length,5);
 entrances.forEach((e,i)=>assert.ok(t.includes(`South entrance ${i+1} of 5 · ${e.item.replaceAll('-',' ')} · ${num(e.perMinute)}/min · (${e.position.x}, ${e.position.y})`),e.item));
 for(const f of factories){
  const row=block.match(new RegExp(`<tr data-entrance="${f.m.products[0]}" data-factory="${f.id}">[\\s\\S]*?</tr>`))[0],r=text(row);
  assert.ok(r.includes(`${f.m.footprint.width} × ${f.m.footprint.height} tiles`)&&r.includes(`${num(f.build.outputsPerMinute[f.m.products[0]])} recovery ${num(f.build.recovery.outputsPerMinute[f.m.products[0]])}`),f.id);
  for(const p of f.m.inputs)assert.ok(r.includes(`${p.item.replaceAll('-',' ')} ${num(p.perMinute)}`),f.id+' '+p.item);
  const dir=`heavy-supplies/${f.id}/`;
  for(const l of [f.m.file,'native-report.json','manifest.json','README.md']){assert.ok(row.includes(`href="${dir}${l}"`),f.id+' '+l);await fs.access(`site/${FAMILY}/${dir}${l}`);}
  assert.ok(row.includes('data-south-copy')&&block.includes(`id="south-code-${f.id}"`)&&!block.includes("<textarea")&&!block.includes("<article"));
  assert.equal(sha(await read(`site/${FAMILY}/${dir}${f.m.file}`)),f.m.blueprintSha256);
 }
 for(const item of ['processing-unit','flying-robot-frame']){
  const row=block.match(new RegExp(`<tr data-entrance="${item}">[\\s\\S]*?</tr>`))[0];
  assert.ok(row.includes('In progress')&&!row.includes('href=')&&!row.includes('<button'),item+' is in progress, no links');
 }
 // The existing supply factories on the page are untouched.
 for(const id of ['green-circuit-supply','advanced-circuit-supply','engine-supply'])assert.ok(html.includes(`<article id="${id}">`),id);
});

test('the list takes more: a factory folder added for processing units turns its row from in progress to built; the block is idempotent',async()=>{
 const root='.cache/south-supplies-test';
 await fs.rm(root,{recursive:true,force:true});
 await fs.cp(SOUTH,path.join(root,SOUTH),{recursive:true});
 // A copy of the productivity-module factory declared as the processing-unit factory (the numbers need not be real: the row follows the manifest).
 const from=path.join(root,SOUTH,'heavy-supplies/productivity-module-supply'),to=path.join(root,SOUTH,'heavy-supplies/processing-unit-supply');
 await fs.cp(from,to,{recursive:true});
 const [m]=JSON.parse(await read(path.join(to,'manifest.json')));m.id='processing-unit-supply';m.products=['processing-unit'];await fs.writeFile(path.join(to,'manifest.json'),JSON.stringify([m]));
 const report=JSON.parse(await read(path.join(to,'native-report.json')));report.builds[0].outputsPerMinute={'processing-unit':40};await fs.writeFile(path.join(to,'native-report.json'),JSON.stringify(report));
 const before=await southSuppliesBlock(),after=await southSuppliesBlock(root);
 assert.equal(before.count.built,3);assert.equal(after.count.built,4);
 assert.ok(/<tr data-entrance="processing-unit" data-factory="processing-unit-supply">/.test(after.html)&&!/<tr data-entrance="processing-unit">/.test(after.html));
 assert.ok(/<tr data-entrance="flying-robot-frame">/.test(after.html));
 await fs.rm(root,{recursive:true,force:true});
 assert.equal((await southSuppliesBlock()).html,before.html,'deterministic');
});

test('README: the validated supply factories table gains the three rows, with the manifests\' figures',async()=>{
 const readme=await read(`${SOUTH}/README.md`),rows=readme.split('\n').filter(l=>/^\| (Green|Red|Engines|Electric|Productivity|Low-density)/.test(l));
 assert.equal(rows.length,6);
 for(const f of factories){
  const label={'electric-furnace':'Electric furnaces','productivity-module':'Productivity modules','low-density-structure':'Low-density structures'}[f.m.products[0]];
  const row=rows.find(r=>r.startsWith(`| ${label} |`));assert.ok(row,label);
  const cells=row.split('|').map(c=>c.trim());
  const inputs=f.m.inputs.map(p=>`${p.item.replaceAll('-',' ')}s ${num(p.perMinute)}`).join('; ').replace(/^./,c=>c.toUpperCase());
  assert.equal(cells[2],inputs,label+' inputs');assert.equal(cells[3],f.build.outputsPerMinute[f.m.products[0]].toFixed(2));
  assert.equal(cells[4],`${f.m.footprint.width} × ${f.m.footprint.height}`);assert.equal(cells[5],String(Object.values(f.m.machineCounts)[0]));
 }
 assert.ok(readme.includes('are in progress'));
});
