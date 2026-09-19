import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from '../scripts/blueprints.mjs';
import {starterConfigurationHash} from '../scripts/starter-verification.mjs';
const root='blueprint-sources/early-game';
const read=file=>JSON.parse(fs.readFileSync(file));
const manifest=read(root+'/manifest.json'),research=read(root+'/research.json');
const evidence=read(root+'/validation.json'),atlas=read('site/data/atlas.json'),catalog=read('site/data/catalog.json');
const leaves=book=>book.blueprint_book?book.blueprint_book.blueprints.flatMap(leaves):[encodeBlueprint({blueprint:book.blueprint})];
test('research collection is complete and every production module accepts only raw materials',()=>{
 assert.deepEqual(manifest.flatMap(b=>b.products).sort(),research.expectedProducts);
 assert.equal(new Set(manifest.map(b=>b.id)).size,manifest.length);
 const allowed=new Set(['big-electric-pole','medium-electric-pole','transport-belt','underground-belt','splitter','steel-furnace','assembling-machine-2','chemical-plant','oil-refinery','inserter','wooden-chest','pipe','pipe-to-ground','display-panel']);
 for(const info of manifest){
  assert.equal(info.rawOnly,true);assert.equal(info.products.length,1);
  const object=decodeBlueprint(fs.readFileSync(root+'/'+info.file,'utf8'));
  for(const e of object.blueprint.entities){assert.ok(allowed.has(e.name),info.id+' '+e.name);assert.ok(!e.quality||e.quality==='normal');assert.ok(!e.items?.length);}
  assert.deepEqual(blueprintMaterials(object,catalog).excluded,[]);
  const power=info.ports.filter(p=>p.kind==='power');assert.equal(power.length,1);
  const inputs=info.ports.filter(p=>['input','fluid'].includes(p.kind));
  assert.deepEqual(inputs.flatMap(p=>p.items),info.rawInputs);
  for(const port of inputs){
   assert.equal(port.items.length,1);const index=research.rawInputs.indexOf(port.items[0]);assert.ok(index>=0);
   assert.equal(port.x,inputs[0].x);
   assert.deepEqual(object.blueprint.entities.find(e=>e.entity_number===port.entity).position,{x:port.x,y:port.y});
  }
  const ordered=[...inputs].sort((a,b)=>a.y-b.y);
  assert.deepEqual(ordered.map(p=>p.items[0]),research.rawInputs.filter(id=>info.rawInputs.includes(id)));
  for(let i=1;i<ordered.length;i++)assert.ok(ordered[i].y-ordered[i-1].y>=2,info.id+' has no room for its input signs');
  assert.ok(info.researchClosure.includes(info.unlock));assert.ok(info.requires.every(t=>info.researchClosure.includes(t)));
  assert.ok(info.researchClosure.includes('electric-energy-distribution-1'));
  for(const [machine,technology]of [['assembling-machine-2','automation-2'],['steel-furnace','advanced-material-processing']])if(object.blueprint.entities.some(e=>e.name===machine))assert.ok(info.researchClosure.includes(technology),info.id+' lacks '+technology);
  assert.ok(!info.researchClosure.some(id=>/robotics|logistic-system/.test(id)));
  const indexed=atlas.blueprints.find(b=>b.id===info.id);
  assert.ok(indexed.analysis.inputs.every(id=>research.rawInputs.includes(id)),info.id+' exposes an intermediate');
 }
});
test('compact modules have a connected big/medium pole grid and never increase their footprint',()=>{
 for(const info of manifest){
  const {entities,wires}=decodeBlueprint(fs.readFileSync(root+'/'+info.file,'utf8')).blueprint;
  const poles=entities.filter(e=>e.name.endsWith('-electric-pole')),byId=new Map(poles.map(e=>[e.entity_number,e]));
  assert.equal(poles.filter(e=>e.name==='big-electric-pole').length,1);
  assert.ok(poles.some(e=>e.name==='medium-electric-pole'));
  assert.ok(poles.every(e=>['big-electric-pole','medium-electric-pole'].includes(e.name)));
  const port=info.ports.find(p=>p.kind==='power'),dock=byId.get(port.entity);
  assert.equal(dock.name,'big-electric-pole');assert.deepEqual(dock.position,{x:port.x,y:port.y});
  const neighbors=new Map(poles.map(p=>[p.entity_number,new Set()]));
  for(const [a,connectorA,b,connectorB]of wires){
   assert.equal(connectorA,5);assert.equal(connectorB,5);assert.notEqual(a,b);
   assert.ok(byId.has(a)&&byId.has(b));
   const pa=byId.get(a),pb=byId.get(b),reach=pa.name===pb.name&&pa.name==='big-electric-pole'?32:9;
   assert.ok(Math.hypot(pa.position.x-pb.position.x,pa.position.y-pb.position.y)<=reach+.00001,info.id+' wire exceeds pole reach');
   neighbors.get(a).add(b);neighbors.get(b).add(a);
  }
  for(const links of neighbors.values())assert.ok(links.size<=5);
  const pending=[dock.entity_number],connected=new Set();
  while(pending.length){const id=pending.pop();if(!connected.has(id)){connected.add(id);pending.push(...neighbors.get(id));}}
  assert.equal(connected.size,poles.length,info.id+' has disconnected poles');
  const {before,after,polesBefore,polesAfter}=info.compaction;
  assert.deepEqual(after,atlas.blueprints.find(b=>b.id===info.id).footprint);
  assert.ok(after.width*after.height<=before.width*before.height,info.id+' grew');
  assert.equal(polesAfter,poles.length);assert.ok(polesAfter<=polesBefore);
 }
});
test('every raw entrance has an optional matching display without blocking its supply',()=>{
 const production=read('site/data/production.json');
 for(const info of manifest){
  const {entities,wires=[]}=decodeBlueprint(fs.readFileSync(root+'/'+info.file,'utf8')).blueprint;
  const inputs=info.ports.filter(p=>['input','fluid'].includes(p.kind));
  assert.deepEqual(info.inputDisplays,{optional:true,requiredTechnology:'circuit-network'});
  assert.equal(entities.filter(e=>e.name==='display-panel').length,inputs.length);
  for(const p of inputs){
   const sign=entities.find(e=>e.entity_number===p.displayEntity);
   assert.equal(sign?.name,'display-panel');assert.equal(sign.tags.input_display,p.entity);
   assert.deepEqual(sign.icon,{type:p.kind==='fluid'?'fluid':'item',name:p.items[0]});
   assert.equal(sign.text.split('\n')[0],p.label+' ↓');assert.match(sign.text,/from the left/);
   assert.equal(sign.always_show,true);assert.equal(sign.show_in_chart,false);assert.equal(sign.control_behavior,undefined);
   assert.deepEqual(sign.position,{x:p.x,y:p.y-1});
   assert.ok(wires.every(w=>w[0]!==sign.entity_number&&w[2]!==sign.entity_number));
   for(const e of entities.filter(e=>e.entity_number!==sign.entity_number)){
    const size=production.entities[e.name]?.size||[[-.5,-.5],[.5,.5]];
    let w=Math.ceil(size[1][0]-size[0][0]),h=Math.ceil(size[1][1]-size[0][1]);
    if(e.name==='display-panel')w=h=1;
    if([4,12].includes(e.direction))[w,h]=[h,w];
    assert.ok(Math.abs(e.position.x-sign.position.x)>=(w+1)/2||Math.abs(e.position.y-sign.position.y)>=(h+1)/2,info.id+' display overlaps '+e.name);
    assert.ok(Math.abs(e.position.x-(p.x-1))>=(w+1)/2||Math.abs(e.position.y-p.y)>=(h+1)/2,info.id+' blocks external feed');
   }
  }
  assert.ok(info.setupNotes.some(n=>n.includes('leave their ghosts unbuilt')));
 }
});
test('published raw modules and nested research books match exact native delivery evidence',()=>{
 const book=decodeBlueprint(fs.readFileSync('site/sources/collections/early-game.txt','utf8'));
 assert.deepEqual(leaves(book),manifest.map(info=>fs.readFileSync(root+'/'+info.file,'utf8').trim()));
 for(const info of manifest){
  const source=fs.readFileSync(root+'/'+info.file,'utf8').trim(),b=atlas.blueprints.find(b=>b.id===info.id);
  assert.ok(b?.starter);assert.equal(b.code,source);assert.equal(fs.readFileSync('site/sources/early-game/'+info.file,'utf8').trim(),source);
  const result=evidence.builds.find(t=>t.id===info.id&&t.blueprintSha256===createHash('sha256').update(source).digest('hex'));
  assert.ok(result?.passed,info.id);assert.equal(b.validation.status,'game-tested');
  assert.equal(result.portConfigurationSha256,starterConfigurationHash(info));
  assert.deepEqual(result.testedTechnologies,info.researchClosure);assert.deepEqual(result.rawInputs,info.rawInputs);
  assert.deepEqual(result.inputDisplays,{verified:info.ports.filter(p=>p.displayEntity).length,optional:true,requiredTechnology:'circuit-network'});
  const entities=decodeBlueprint(source).blueprint.entities;
  assert.deepEqual(result.powerNetwork,{bigPoles:1,mediumPoles:entities.filter(e=>e.name==='medium-electric-pole').length,poweredConsumers:entities.filter(e=>['assembling-machine-2','chemical-plant','oil-refinery','inserter'].includes(e.name)).length});
  assert.ok(result.firstOutputTick>0);for(const count of Object.values(result.outputPorts))assert.ok(count>0);
  for(const product of info.products)assert.ok(result.delivered[product]>0,product);
  for(const machine of result.machines)assert.ok(machine.products>0,info.id+' '+machine.recipe);
  if(result.removedAtHalfTime>0)assert.equal(result.restartedAfterCollection,true,info.id+' did not restart');
 }
 for(const stage of research.stages.filter(s=>s.modules.length)){
  const expected=manifest.filter(b=>b.unlock===stage.id);
  assert.deepEqual(stage.modules,expected.map(b=>b.id));
  const pack=decodeBlueprint(fs.readFileSync('site/sources/early-game/unlocks/'+stage.id+'.txt','utf8'));
  assert.deepEqual(leaves(pack),expected.map(b=>fs.readFileSync(root+'/'+b.file,'utf8').trim()));
 }
 assert.deepEqual(fs.readdirSync('site/sources/early-game/unlocks').filter(f=>f.endsWith('.txt')).sort(),research.stages.filter(s=>s.modules.length).map(s=>s.id+'.txt').sort(),'No obsolete research packs may serve older machine tiers');
});
test('community references retain attribution and stay separate from raw-only modules',()=>{
 for(const info of read(root+'/community-manifest.json')){
  assert.match(info.sourceURL,/^https:\/\/www.factorio.school\/view\//);assert.ok(info.author);
  const b=atlas.blueprints.find(b=>b.id===info.id);assert.equal(b.starter,false);assert.equal(b.legacyStarter,true);
  assert.equal(b.collection,'Community starter references');assert.equal(b.validation.status,'game-tested');
 }
});
