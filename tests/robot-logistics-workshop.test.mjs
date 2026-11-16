import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root=new URL('../',import.meta.url);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/robot-logistics-workshop/';
const records=JSON.parse(await read(dir+'manifest.json'));
assert.equal(records.length,1,'one workshop entry');
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
const report=JSON.parse(await read(dir+'native-report.json'));
const evidence=report.builds.find(b=>b.id===m.id);
const targets={'construction-robot':10,'logistic-robot':10,roboport:1,'storage-chest':4,'passive-provider-chest':4};
const products=Object.keys(targets);
const nominal={'iron-plate':500,'copper-plate':621,'steel-plate':149,'plastic-bar':146,'sulfuric-acid':800,lubricant:300};
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const sorted=v=>[...v].sort();
const names=v=>sorted(v.map(p=>p.item));
const ingredients=v=>sorted(v.map(i=>`${i.type}:${i.name}:${i.amount}`));
function rate(actual,item,context){assert(Number.isFinite(actual),`${context}: missing ${item}`);assert(actual>=targets[item]*.95,`${context}: ${item} ${actual} < ${targets[item]*.95}/min`);}

test('chosen robot targets, chest rates and official recipe boundary are exact',()=>{
 assert.deepEqual(m.targets,targets);
 assert.deepEqual(sorted(m.products),sorted(products));
 assert.deepEqual(m.recipeAudit.externalPerMinute,nominal);
 assert.equal(m.recipeAudit.craftsPerMinute['electronic-circuit'],290);
 assert.equal(m.recipeAudit.craftsPerMinute['advanced-circuit'],73);
 assert.equal(m.recipeAudit.craftsPerMinute['copper-cable'],581);
 assert.deepEqual(names(m.inputs),sorted(['iron-plate','copper-plate','steel-plate','plastic-bar']));
 assert.deepEqual(names(m.fluids),sorted(['sulfuric-acid','lubricant']));
 for(const p of [...m.inputs,...m.fluids]){
  assert.equal(p.externalSide,'west');assert.equal(p.perMinute,nominal[p.item]);assert(byId.has(p.entity));
 }
 const required=['copper-cable','electronic-circuit','advanced-circuit','iron-gear-wheel','pipe','engine-unit','electric-engine-unit','battery','flying-robot-frame','steel-chest',...products];
 for(const recipe of required)assert(entities.some(e=>e.recipe===recipe),`internal recipe missing: ${recipe}`);
});

test('source, native report, official prototypes, harness and validator hashes agree',async()=>{
 assert(evidence,'native build evidence missing');
 assert.equal(hash(code),m.blueprintSha256);
 assert.equal(evidence.blueprintSha256,m.blueprintSha256,'native report is stale for blueprint');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);
 assert.equal(report.gameVersion,'2.1.24');
 assert.equal(report.harnessSha256,hash(await read('scripts/robot-logistics-workshop/control.lua')),'native harness changed since report');
 assert.equal(report.validatorSha256,hash(await read('scripts/robot-logistics-workshop/validate.mjs')),'validator changed since report');
 for(const field of ['dataHarnessSha256','configurationSha256'])assert.match(report[field],/^[a-f0-9]{64}$/);
});

test('six west entrances have six distinct visible material markers',()=>{
 const materialPorts=m.ports.filter(p=>p.kind==='input'||p.kind==='fluid');
 assert.equal(materialPorts.length,6);
 assert.equal(new Set(materialPorts.map(p=>p.entity)).size,6);
 assert.equal(new Set(materialPorts.map(p=>p.displayEntity)).size,6);
 assert.equal(entities.filter(e=>e.name==='display-panel').length,6);
 for(const p of materialPorts){const marker=byId.get(p.displayEntity);assert.equal(marker?.name,'display-panel');assert.equal(marker.icon?.name,p.items[0]);assert(marker.always_show);assert.match(marker.text,/WEST/i);assert(marker.text.includes(p.items[0]));}
});

test('AM2, red transport, substations and no installed modules',()=>{
 for(const e of entities){
  if(e.recipe)assert.equal(e.name,e.recipe==='battery'?'chemical-plant':'assembling-machine-2');
  if(/(?:transport-belt|underground-belt|splitter)$/.test(e.name))assert(['fast-transport-belt','fast-underground-belt','fast-splitter'].includes(e.name),e.name);
  if(e.name.endsWith('inserter'))assert(['fast-inserter','bulk-inserter','long-handed-inserter'].includes(e.name),e.name);
  assert.notEqual(e.name,'beacon');
  assert(!/"[^"\n]*-module(?:-\d+)?"/.test(JSON.stringify(e.items??{})),`installed module: ${e.entity_number}`);
 }
 assert(entities.some(e=>e.name==='substation'));
 assert.equal(m.ports.filter(p=>p.kind==='power').length,1);
 for(const loop of m.loopControl){
  assert(loop.loop.length>0);
  for(const id of loop.loop){const belt=byId.get(id);assert(belt,`loop tile missing ${id}`);assert.equal(belt.control_behavior?.circuit_read_hand_contents,true);assert.equal(belt.control_behavior?.circuit_contents_read_mode,1,'stock must read each tile in hold mode');}
 }
});

test('all outputs share one east provider with independent caps and isolated filter logic',()=>{
 assert.deepEqual(names(m.outputs),sorted(products));
 const ids=new Set(m.outputs.map(p=>p.entity));assert.equal(ids.size,1);
 const chest=byId.get([...ids][0]);assert.equal(chest?.name,'passive-provider-chest');
 assert.equal(entities.filter(e=>e.name==='passive-provider-chest').length,1);
 assert(chest.bar===undefined||chest.bar===0,'shared provider slot bar must be unrestricted');
 assert.deepEqual(sorted(Object.keys(m.outputCaps)),sorted(products));
 assert.deepEqual(m.stockControl.caps,m.outputCaps);assert.equal(m.stockControl.chest,chest.entity_number);
 const collector=byId.get(m.stockControl.collector);assert(collector?.name.endsWith('inserter'));assert(collector.use_filters);assert(collector.control_behavior?.circuit_set_filters);
 for(const p of m.outputs){
  assert.equal(p.externalSide,'east');assert.equal(p.cap,m.outputCaps[p.item]);assert(Number.isInteger(p.cap)&&p.cap>0);
  const gates=entities.filter(e=>e.name==='decider-combinator'&&e.control_behavior?.decider_conditions?.conditions?.some(c=>c.first_signal?.name===p.item&&c.comparator==='<'&&c.constant===p.cap)&&e.control_behavior.decider_conditions.outputs?.some(o=>o.signal?.name===p.item&&!o.copy_count_from_input));
  assert.equal(gates.length,1,`one independent chest filter gate for ${p.item}`);
 }
 assert.equal(evidence.stockNetworksIsolated,true);
});

test('saved clock settings equal encoded combinator periods and windows',()=>{
 if(!m.productionClock)return;
 for(const [i,item]of m.products.entries()){
  if(!m.productionClock.periodTicks[item])continue;
  const signal='signal-'+String.fromCharCode(65+i);
  const modulo=entities.filter(e=>e.control_behavior?.arithmetic_conditions?.operation==='%'&&e.control_behavior.arithmetic_conditions.output_signal?.name===signal);
  assert.equal(modulo.length,1);assert.equal(modulo[0].control_behavior.arithmetic_conditions.second_constant,m.productionClock.periodTicks[item]);
  if(m.productionClock.robotTokens?.[item]){
   const t=m.productionClock.robotTokens[item];assert(byId.has(t.latch)&&byId.has(t.permission)&&byId.has(t.handReset));const arm=byId.get(t.output);assert.equal(arm.control_behavior.circuit_read_hand_contents,true);assert.equal(arm.control_behavior.circuit_hand_read_mode,1);assert.equal(m.productionClock.periodTicks[item],Math.floor(3600/(m.targets[item]*m.productionClock.headroom[item])));
  }else{
   const windows=entities.flatMap(e=>e.control_behavior?.decider_conditions?.conditions??[]).filter(c=>c.first_signal?.name===signal&&c.comparator==='<');
   assert.equal(windows.length,1);assert.equal(windows[0].constant,m.productionClock.pickupWindowTicks);
  }
 }
});

test('native import, every machine, each material route, fluids, power and hand baseline qualify',()=>{
 assert(evidence);assert.equal(evidence.importedEntities,entities.length);
 assert.equal(evidence.powered,true);assert.equal(evidence.externalApproachesClear,true);assert(evidence.exactRecipeChecks>0);
 const machines=entities.filter(e=>e.recipe);assert.equal(evidence.machines.length,machines.length);
 assert.equal(new Set(evidence.machines.map(p=>p.entity)).size,machines.length);
 for(const e of machines){const n=evidence.machines.find(n=>n.entity===e.entity_number);assert(n,`native machine ${e.entity_number} missing`);assert.equal(n.recipe,e.recipe);assert.equal(n.actualRecipe,e.recipe);assert(n.measuredCrafts>0,`idle machine ${e.entity_number}: ${e.recipe}`);assert.deepEqual(ingredients(n.nativeIngredients),ingredients(m.recipeAudit.recipeIngredients[e.recipe]));}
 assert.deepEqual(names(evidence.inputs),names(m.inputs));
 for(const p of m.inputs){const n=evidence.inputs.find(n=>n.entity===p.entity&&n.item===p.item);assert(n?.acceptedDuringMeasurement>0);assert(n.productiveRoute?.length>=2);assert.equal(n.productiveRoute[0],p.entity);for(const id of n.productiveRoute)assert(byId.has(id));const end=n.productiveRoute.at(-1);assert(evidence.machines.some(n=>n.entity===end&&n.measuredCrafts>0),`unproductive route: ${p.item}`);}
 assert.deepEqual(names(evidence.fluids),names(m.fluids));
 for(const p of m.fluids){const n=evidence.fluids.find(n=>n.entity===p.entity&&n.item===p.item);assert(n?.acceptedDuringMeasurement>0);assert(n.productiveConsumers?.length>0);for(const id of n.productiveConsumers)assert(evidence.machines.some(n=>n.entity===id&&n.measuredCrafts>0));}
 assert.equal(evidence.inserterCapacityResearch.fast,0);assert.equal(evidence.inserterCapacityResearch.bulkUnlockBonus,1);
 const bulk=entities.filter(e=>e.name==='bulk-inserter');assert.equal(evidence.bulkInserters.length,bulk.length);
 for(const e of bulk){const n=evidence.bulkInserters.find(n=>n.entity===e.entity_number);assert(n);assert(n.observedMaxHand>0&&n.observedMaxHand<=2,'bulk hand exceeds unlock baseline of two');}
});

test('all five steady/recovery rates reach 95 percent and closed caps are exact',()=>{
 assert.equal(report.passed,true,'report not qualified');assert.equal(evidence.passed,true,'build not qualified');
 assert(report.measurementMinutes>0);assert(evidence.recovery.measurementMinutes>0);
 assert.deepEqual(names(evidence.outputPorts),sorted(products));
 for(const item of products){rate(evidence.outputsPerMinute[item],item,'steady');rate(evidence.recovery.outputsPerMinute[item],item,'recovery');const out=evidence.outputPorts.find(p=>p.item===item);assert.equal(out.entity,m.outputs.find(p=>p.item===item).entity);assert(out.collectedDuringMeasurement>0);}
 assert.equal(evidence.recovery.pauseMode,'natural-five-product-stocking-collection-paused-no-product-fixtures');
 assert(evidence.recovery.blockedOutputFilled.every(p=>p.inserted===0),'closed stocking must use real production, not inserted products');
 const closed=evidence.recovery.collectionPauseStock;assert.deepEqual(names(closed),sorted(products));
 for(const p of closed){assert.equal(p.count,m.outputCaps[p.item]);assert.equal(p.capacity,m.outputCaps[p.item]);assert.equal(p.entity,m.stockControl.chest);}
});

test('each of five independent stock tests reaches its cap without starving the other four',()=>{
 const phases=evidence.independentStockCapTests;assert.equal(phases?.length,5);
 assert.deepEqual(sorted(phases.map(p=>p.blockedProduct)),sorted(products));
 for(const phase of phases){assert.equal(phase.finalBlockedStock,m.outputCaps[phase.blockedProduct],`blocked cap: ${phase.blockedProduct}`);assert(phase.measurementMinutes>0);const others=products.filter(p=>p!==phase.blockedProduct);assert.deepEqual(sorted(Object.keys(phase.outputsPerMinute)),sorted(others));for(const item of others)rate(phase.outputsPerMinute[item],item,`${phase.blockedProduct} held at cap`);}
});
