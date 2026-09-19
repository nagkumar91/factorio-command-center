import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from '../scripts/blueprints.mjs';
import {starterConfigurationHash} from '../scripts/starter-verification.mjs';
import {transportWorkshopConfigs} from '../scripts/transport-workshop-configs.mjs';
const root='blueprint-sources/transport-workshops';
const read=file=>JSON.parse(fs.readFileSync(file));
const manifest=read(root+'/manifest.json'),functional=read(root+'/validation.json'),throughput=read(root+'/throughput.json');
const catalog=read('site/data/catalog.json');
const published=read('site/data/transport-workshops/index.json');
const blueprints=published.blueprints.map(b=>read('site/'+b.url));
const raw=new Set(['iron-ore','copper-ore','coal','water','crude-oil','tungsten-ore','calcite']);
test('each transport colour combines its three outputs with raw-only production and labeled inputs',()=>{
 assert.deepEqual(manifest.map(b=>b.colour),Object.entries(transportWorkshopConfigs).filter(([,c])=>c.publicationStatus!=='draft').map(([colour])=>colour));
 const prefixes=['','fast-','express-','turbo-'];
 for(const [index,info]of manifest.entries()){
  assert.equal(info.rawOnly,true);assert.equal(info.workshop,true);
  assert.deepEqual(info.products,['transport-belt','underground-belt','splitter'].map(id=>prefixes[info.order]+id));
  const object=decodeBlueprint(fs.readFileSync(root+'/'+info.file,'utf8')),entities=object.blueprint.entities;
  const productionCells=entities.filter(e=>e.tags?.production_recipe);
  assert.equal(productionCells.length,info.machineCount);
  assert.deepEqual(productionCells.map(e=>e.tags.production_recipe),info.recipes);
  assert.deepEqual(blueprintMaterials(object,catalog).excluded,[]);
  for(const e of entities){
   assert.ok(!/roboport|robot|requester|provider|infinity|beacon|small-electric-pole|assembling-machine-1|stone-furnace/.test(e.name),info.id+' '+e.name);
   assert.ok(!e.quality||e.quality==='normal');assert.ok(!e.items?.length);
  }
  for(const entity of ['assembling-machine-2','steel-furnace','big-electric-pole','medium-electric-pole'])assert.ok(entities.some(e=>e.name===entity),info.id+' '+entity);
  const inputs=info.ports.filter(p=>['input','fluid'].includes(p.kind)),outputs=info.ports.filter(p=>p.kind==='output');
  assert.deepEqual(inputs.flatMap(p=>p.items),info.rawInputs);
  assert.ok(info.rawInputs.every(item=>raw.has(item)));
  assert.deepEqual(outputs.flatMap(p=>p.items).sort(),[...info.products,...info.sideProducts].sort());
  assert.deepEqual(outputs.map(p=>p.index),outputs.map((_,i)=>i+1));
  assert.deepEqual(outputs.flatMap(p=>p.items),[...info.products,...info.sideProducts]);
  assert.equal(new Set(outputs.map(p=>p.entity)).size,outputs.length);
  for(const p of inputs){
   const display=entities.find(e=>e.entity_number===p.displayEntity);
   assert.equal(display?.name,'display-panel');assert.equal(display.icon.name,p.items[0]);
   assert.deepEqual(display.position,{x:p.x,y:p.y-1});assert.match(display.text,/from the left/);
  }
  for(const t of ['circuit-network','automation-2','advanced-material-processing','electric-energy-distribution-1'])assert.ok(info.researchClosure.includes(t));
  assert.ok(info.requires.every(t=>info.researchClosure.includes(t)));
  if(info.colour!=='Green')assert.ok(!info.researchClosure.some(t=>/robotics|logistic-system/.test(t)));
  // Space travel has robot research prerequisites; the green layout contains no robots.
  assert.equal(info.surface.name,info.colour==='Green'?'Vulcanus':'Nauvis');assert.equal(info.surface.properties.pressure,info.colour==='Green'?4000:1000);
  assert.equal(entities.some(e=>e.name==='foundry'),info.colour==='Green');
  const indexed=blueprints.find(b=>b.id===info.id);
  assert.ok(indexed.analysis.inputs.every(id=>info.rawInputs.includes(id)),info.id+' requires an intermediate');
  assert.deepEqual(indexed.footprint,info.footprint);
 }
});
test('all output chests replenish and measured rates match the exact downloadable layouts',()=>{
 for(const report of [functional,throughput]){
  assert.equal(report.gameVersion,catalog.version);assert.equal(report.mapSeed,12345);
  assert.equal(report.simulatedMinutes,45);
 }
 const book=decodeBlueprint(fs.readFileSync('site/sources/collections/transport-workshops.txt','utf8')).blueprint_book;
 assert.equal(book.blueprints.length,manifest.length);
 for(const [i,info]of manifest.entries()){
  const code=fs.readFileSync(root+'/'+info.file,'utf8').trim();
  assert.equal(encodeBlueprint({blueprint:book.blueprints[i].blueprint}),code);
  assert.equal(fs.readFileSync('site/sources/transport-workshops/'+info.file,'utf8').trim(),code);
  const sha=createHash('sha256').update(code).digest('hex'),configuration=starterConfigurationHash(info);
  const b=blueprints.find(b=>b.id===info.id);assert.equal(b.code,code);assert.equal(b.validation.status,'game-tested');
  for(const report of [functional,throughput]){
   const r=report.builds.find(b=>b.id===info.id);assert.ok(r?.passed,info.id);
   assert.equal(r.blueprintSha256,sha);assert.equal(r.portConfigurationSha256,configuration);
   assert.deepEqual(r.rawInputs,info.rawInputs);assert.deepEqual(r.testedTechnologies,info.researchClosure);
   assert.equal(r.powerNetwork.bigPoles,1);assert.ok(r.powerNetwork.mediumPoles>0);
   for(const m of r.machines)assert.ok(m.products>0,info.id+' '+m.recipe);
   assert.equal(r.loopControl.readerVerified,true);assert.equal(r.loopControl.controlledInserters,info.loopControl.controlled.length);
   assert.equal(r.inputDisplays.verified,info.rawInputs.length);
  }
  const f=functional.builds.find(b=>b.id===info.id),m=throughput.builds.find(b=>b.id===info.id);
  assert.equal(f.restartedAfterCollection,true);
  for(const p of info.ports.filter(p=>p.kind==='output')){assert.ok(f.drainedPorts[p.entity]>0);assert.equal(f.restartedPorts[p.entity],true);}
  assert.equal(m.throughput.measuredMinutes,30);assert.equal(m.throughput.warmupMinutes,15);
  for(const item of [...info.products,...info.sideProducts]){
   assert.ok(m.throughput.collected[item]>0,info.id+' '+item);
   assert.equal(m.throughput.perMinute[item],m.throughput.collected[item]/m.throughput.measuredMinutes);
  }
  assert.deepEqual(b.benchmark.perMinute,m.throughput.perMinute);
 }
});
