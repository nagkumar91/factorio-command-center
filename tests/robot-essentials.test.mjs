import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root=new URL('../',import.meta.url);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/robot-essentials/';
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
const report=JSON.parse(await read(dir+'native-report.json'));
const evidence=report.builds.find(b=>b.id===m.id);
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const targets={'construction-robot':5,'logistic-robot':5,roboport:0.5,'storage-chest':2,'passive-provider-chest':2};
const caps={'construction-robot':20,'logistic-robot':20,roboport:2,'storage-chest':10,'passive-provider-chest':10};
const products=Object.keys(targets);
const demand={'steel-plate':74.5,'iron-plate':105,lubricant:150,'electronic-circuit':145,'sulfuric-acid':400,'copper-plate':93,'plastic-bar':73};
const periods={'construction-robot':685,'logistic-robot':666,roboport:6260,'storage-chest':1636,'passive-provider-chest':1636};
const allowed=new Set(['assembling-machine-2','chemical-plant','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','pipe','pipe-to-ground','passive-provider-chest','substation','medium-electric-pole','constant-combinator','arithmetic-combinator','decider-combinator','display-panel']);
const sorted=v=>[...v].sort();
const floor=item=>targets[item]*.95;

test('one record; string, report, prototypes, harness and validator hashes agree',async()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,'robot-essentials');assert.equal(m.file,'robot-essentials.txt');assert.equal(m.class,'rate');
 assert.equal(hash(code),m.blueprintSha256);
 assert(evidence,'native build evidence missing');
 assert.equal(evidence.blueprintSha256,m.blueprintSha256,'native report is stale for this blueprint');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);
 assert.equal(report.gameVersion,'2.1.24');
 assert.equal(report.harnessSha256,hash(await read('scripts/robot-essentials/control.lua')),'harness changed since the report');
 assert.equal(report.validatorSha256,hash(await read('scripts/robot-essentials/validate.mjs')),'validator changed since the report');
 for(const field of ['dataHarnessSha256','configurationSha256'])assert.match(report[field],/^[a-f0-9]{64}$/);
 assert.notEqual(report.short,true,'an exploration report never qualifies');
});

test('the report passes, and the pass formula recomputed from its numbers holds',()=>{
 assert.equal(report.passed,true);assert.equal(evidence.passed,true);
 const p=report.protocolMinutes;
 assert(p.warmup>=15&&p.measure>=30&&p.blocked>=8&&p.settle>=5&&p.recovery>=10&&p.phases===5&&p.phase>=15&&p.phaseSettle>=5,'protocol shorter than the spec');
 assert.deepEqual(p,{warmup:m.protocol.warmupMinutes,measure:m.protocol.measureMinutes,blocked:m.protocol.blockedMinutes,settle:m.protocol.settleMinutes,recovery:m.protocol.recoveryMinutes,phase:m.protocol.selectiveSettleMinutes+m.protocol.selectiveMeasureMinutes,phaseSettle:m.protocol.selectiveSettleMinutes,phases:m.protocol.selectivePhases});
 for(const item of products){
  assert(evidence.outputsPerMinute[item]>=floor(item),`steady ${item} ${evidence.outputsPerMinute[item]}`);
  assert(evidence.recovery.outputsPerMinute[item]>=floor(item),`recovery ${item} ${evidence.recovery.outputsPerMinute[item]}`);
  assert(evidence.outputPorts.find(o=>o.item===item).collectedDuringMeasurement>0);
 }
 const machines=entities.filter(e=>e.recipe);
 assert.equal(evidence.machines.length,machines.length);
 for(const n of evidence.machines){assert(n.measuredCrafts>0,`idle machine ${n.entity} ${n.recipe}`);assert.equal(n.actualRecipe,byId.get(n.entity).recipe);}
 assert.deepEqual(sorted(evidence.inputs.map(p=>p.item)),sorted(m.inputs.map(p=>p.item)));
 for(const p of evidence.inputs){assert(p.acceptedDuringMeasurement>0);assert(p.productiveRoute?.length>=2);const end=p.productiveRoute.at(-1);assert(evidence.machines.some(n=>n.entity===end&&n.measuredCrafts>0));}
 assert.deepEqual(sorted(evidence.fluids.map(p=>p.item)),sorted(m.fluids.map(p=>p.item)));
 for(const p of evidence.fluids){assert(p.acceptedDuringMeasurement>0);assert(p.productiveConsumers.length>0);
  const want=p.item==='lubricant'?'electric-engine-unit':'battery';
  for(const id of p.productiveConsumers){assert.equal(byId.get(id).recipe,want);assert(evidence.machines.some(n=>n.entity===id&&n.measuredCrafts>0));}}
 const closed=evidence.recovery.collectionPauseStock;assert.deepEqual(sorted(closed.map(p=>p.item)),sorted(products));
 for(const p of closed){assert.equal(p.count,caps[p.item]);assert.equal(p.entity,m.stockControl.chest);}
 assert(evidence.recovery.blockedOutputFilled.every(p=>p.inserted===0));
 const phases=evidence.independentStockCapTests;assert.equal(phases.length,5);assert.deepEqual(sorted(phases.map(p=>p.blockedProduct)),sorted(products));
 for(const phase of phases){assert.equal(phase.finalBlockedStock,caps[phase.blockedProduct]);for(const item of products.filter(p=>p!==phase.blockedProduct))assert(phase.outputsPerMinute[item]>=floor(item),`${phase.blockedProduct} phase: ${item}`);}
 for(const loop of m.loopControl){const s=evidence.loopSamples[loop.name];assert(s.maxStock<0.9*loop.capacity,'ring above 90%');}
 assert.equal(evidence.powered,true);assert.equal(evidence.externalApproachesClear,true);assert.equal(evidence.stockNetworksIsolated,true);assert(evidence.exactRecipeChecks>0);
 assert.equal(evidence.inserterCapacityResearch.fast,0);assert.equal(evidence.inserterCapacityResearch.bulkUnlockBonus,1);
 const bulk=entities.filter(e=>e.name==='bulk-inserter');assert.equal(evidence.bulkInserters.length,bulk.length);
 for(const b of evidence.bulkInserters)assert(b.observedMaxHand>0&&b.observedMaxHand<=2,'bulk hand above the unlock baseline');
});

test('products, targets, caps and the recipe boundary match the spec',()=>{
 assert.deepEqual(m.targets,targets);assert.deepEqual(m.products,products);
 assert.deepEqual(m.outputCaps,caps);assert.deepEqual(m.stockControl.caps,caps);assert.equal(m.stockControl.mode,'dynamic-filter');
 assert.deepEqual(m.recipeAudit.externalPerMinute,demand);
 assert.deepEqual(m.greenCircuitSupply,{perMinute:145,copiesOfGreenCircuits:1});
 assert.equal(m.machineCounts['advanced-circuit'],6);assert.equal(m.machineCounts['copper-cable'],1);
 assert.equal(m.machineCounts['flying-robot-frame'],5);assert.equal(m.machineCounts['engine-unit'],3);
 assert.equal(m.machineCounts['electric-engine-unit'],3);assert.equal(m.machineCounts.battery,2);
 for(const p of products)assert.equal(m.machineCounts[p],1);
 assert(!entities.some(e=>e.recipe==='electronic-circuit'),'electronic circuits are supplied, never made here');
 const counts={};for(const e of entities.filter(e=>e.recipe))counts[e.recipe]=(counts[e.recipe]||0)+1;
 assert.deepEqual(counts,m.machineCounts);
 for(const e of entities.filter(e=>e.recipe))assert.equal(e.name,e.recipe==='battery'?'chemical-plant':'assembling-machine-2');
});

test('seven west entrances with one labelled panel each; one east chest holds all five products',()=>{
 const material=m.ports.filter(p=>p.kind==='input'||p.kind==='fluid');
 assert.deepEqual(sorted(material.map(p=>p.items[0])),sorted(Object.keys(demand)));
 assert.deepEqual(sorted(m.inputs.map(p=>p.item)),sorted(['electronic-circuit','iron-plate','copper-plate','steel-plate','plastic-bar']));
 assert.deepEqual(sorted(m.fluids.map(p=>p.item)),sorted(['sulfuric-acid','lubricant']));
 assert.equal(new Set(material.map(p=>p.entity)).size,7);assert.equal(new Set(material.map(p=>p.displayEntity)).size,7);
 assert.equal(entities.filter(e=>e.name==='display-panel').length,7);
 for(const p of material){
  const e=byId.get(p.entity);assert.equal(p.externalSide,'west');assert.equal(p.perMinute,demand[p.items[0]]);
  if(p.kind==='input'){assert.equal(e.name,'fast-transport-belt');assert.equal(e.direction,4);assert.equal(p.direction,4);}else assert.equal(e.name,'pipe');
  const panel=byId.get(p.displayEntity);assert.equal(panel.name,'display-panel');assert.equal(panel.always_show,true);
  assert.deepEqual(panel.icon,{type:p.kind==='fluid'?'fluid':'item',name:p.items[0]});
  assert.equal(panel.text,`IN: ${p.items[0]}\nWEST · ${p.perMinute}/min at nominal target`);
  assert(Math.max(Math.abs(panel.position.x-e.position.x),Math.abs(panel.position.y-e.position.y))<=4);
  assert(!(panel.position.y===e.position.y&&panel.position.x<e.position.x),'panel on the entrance row');
 }
 assert.deepEqual(sorted(m.outputs.map(p=>p.item)),sorted(products));
 const ids=new Set(m.outputs.map(p=>p.entity));assert.equal(ids.size,1);
 const chest=byId.get([...ids][0]);assert.equal(chest.name,'passive-provider-chest');assert(chest.bar===undefined);
 assert.equal(entities.filter(e=>e.name==='passive-provider-chest').length,1);
 for(const p of m.outputs){assert.equal(p.externalSide,'east');assert.equal(p.cap,caps[p.item]);}
 assert.equal(chest.position.x+.5,m.footprint.right,'output chest on the east edge');
 const port=m.ports.find(p=>p.kind==='output');assert.deepEqual(port.caps,caps);assert.equal(port.externalSide,'east');
 const collector=byId.get(m.stockControl.collector);assert(collector.use_filters&&collector.control_behavior.circuit_set_filters);
 for(const item of products){
  const gates=entities.filter(e=>e.name==='decider-combinator'&&e.control_behavior?.decider_conditions?.conditions?.some(c=>c.first_signal?.name===item&&c.comparator==='<'&&c.constant===caps[item])&&e.control_behavior.decider_conditions.outputs.some(o=>o.signal?.name===item&&!o.copy_count_from_input));
  assert.equal(gates.length,1,'one cap decider for '+item);
 }
 assert.equal(m.ports.filter(p=>p.kind==='power').length,1);
});

test('only allowed entities, arm settings, no modules, wires within reach',()=>{
 for(const e of entities){
  assert(allowed.has(e.name),'entity not allowed: '+e.name);
  assert.equal(e.items,undefined,'installed items or modules on '+e.entity_number);
  assert.equal(e.quality??'normal','normal');
  assert.equal(e.tags?.flight_science_entity,e.entity_number);
  if(e.name==='fast-inserter'||e.name==='long-handed-inserter')assert.equal(e.override_stack_size,1);
  if(e.name==='bulk-inserter')assert.equal(e.override_stack_size,2);
 }
 assert(entities.filter(e=>e.name==='medium-electric-pole').length<=4);
 for(const[a,ac,b,bc]of bp.wires){if(ac===5&&bc===5)continue;const A=byId.get(a),B=byId.get(b);assert(Math.hypot(A.position.x-B.position.x,A.position.y-B.position.y)<=8,'circuit wire longer than 8 tiles');}
});

test('footprint and area goal',()=>{
 // Selection-box sizes of the allowed entities (1x1 unless listed), rotated for east/west.
 const size={'assembling-machine-2':[3,3],'chemical-plant':[3,3],substation:[2,2],'decider-combinator':[1,2],'arithmetic-combinator':[1,2],'constant-combinator':[1,1]};
 const xs=[],ys=[];
 for(const e of entities){let[w,h]=size[e.name]||[1,1];if([4,12].includes(e.direction))[w,h]=[h,w];xs.push(e.position.x-w/2,e.position.x+w/2);ys.push(e.position.y-h/2,e.position.y+h/2);}
 const f={left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);
 assert.equal(m.areaGoal.achievedTiles,f.width*f.height);
 assert.equal(m.areaGoal.goalTiles,760);assert.equal(m.areaGoal.stretchTiles,703);
 assert(f.width*f.height<1272,'not smaller than half of the 2,544-tile workshop');
});

test('ring conventions: per-tile hold readers, limits under 60%, controlled arms on the ring network',()=>{
 assert.equal(m.loopControl.length,1);
 const loop=m.loopControl[0];
 assert.equal(loop.readerMode,'per-tile-hold');
 assert.equal(loop.capacity,8*loop.loop.length);
 assert.equal(loop.maximumStock,Object.values(loop.limits).reduce((a,b)=>a+b,0));
 assert(loop.maximumStock<=0.6*loop.capacity);
 for(const id of loop.loop){const b=byId.get(id);assert.equal(b.name,'fast-transport-belt');assert.equal(b.control_behavior?.circuit_read_hand_contents,true);assert.equal(b.control_behavior?.circuit_contents_read_mode,1);}
 // Red network components from the wire list (connector 1 = red on ordinary entities, 1/3 on combinators).
 const parent=new Map(),find=k=>{while(parent.get(k)!==k){parent.set(k,parent.get(parent.get(k)));k=parent.get(k);}return k;};
 const node=(id,c)=>{const k=id+':'+c;if(!parent.has(k))parent.set(k,k);return k;};
 for(const[a,ac,b,bc]of bp.wires)parent.set(find(node(a,ac)),find(node(b,bc)));
 const ring=find(node(loop.reader,1));
 for(const id of loop.loop)assert.equal(find(node(id,1)),ring,'ring tile off the network '+id);
 for(const id of loop.controlled){const e=byId.get(id);assert.equal(find(node(id,1)),ring,'controlled entity off the ring '+id);assert.equal(e.control_behavior.circuit_condition.comparator,'<');assert.equal(e.control_behavior.circuit_condition.constant,loop.limits[e.control_behavior.circuit_condition.first_signal.name]);}
 for(const r of loop.reserves){const e=byId.get(r.entity);assert.equal(find(node(r.entity,1)),ring);assert.equal(e.control_behavior.circuit_condition.comparator,'>');assert.equal(e.control_behavior.circuit_condition.constant,r.reserve);}
 // Every arm or gate that puts an item on the ring is controlled; every ring entrance is a gate.
 for(const p of m.inputs){assert(loop.gates.includes(p.entity),'belt entrance is not a ring gate '+p.item);assert(loop.controlled.includes(p.entity),'ungated ring entrance '+p.item);}
 // Acid and lubricant never touch: flood pipes through any orthogonal neighbour (stricter than the
 // game, which needs matching connections) and through pipe-to-ground pairs; each fluid stays alone.
 const pipes=entities.filter(e=>e.name==='pipe'||e.name==='pipe-to-ground');
 const at=new Map(pipes.map(e=>[`${Math.floor(e.position.x)},${Math.floor(e.position.y)}`,e]));
 const step={0:[0,1],8:[0,-1],4:[-1,0],12:[1,0]}; // underground runs opposite to the surface side
 const neighbours=e=>{const x=Math.floor(e.position.x),y=Math.floor(e.position.y),out=[];
  for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const n=at.get(`${x+dx},${y+dy}`);if(n)out.push(n);}
  if(e.name==='pipe-to-ground'){const[dx,dy]=step[e.direction||0];for(let k=1;k<=10;k++){const n=at.get(`${x+dx*k},${y+dy*k}`);if(n?.name==='pipe-to-ground'){out.push(n);break;}}}
  return out;};
 const fluidOf=new Map();
 for(const f of m.fluids){const queue=[byId.get(f.entity)];fluidOf.set(f.entity,f.item);
  while(queue.length){const e=queue.pop();for(const n of neighbours(e)){const seen=fluidOf.get(n.entity_number);assert(!seen||seen===f.item,`${f.item} pipes touch ${seen} pipes`);if(!seen){fluidOf.set(n.entity_number,f.item);queue.push(n);}}}}
 assert.equal(fluidOf.size,pipes.length,'every pipe belongs to one fluid entrance');
 // Chest and filter networks never touch the ring.
 assert.notEqual(find(node(m.stockControl.chest,2)),ring);assert.notEqual(find(node(m.stockControl.collector,1)),ring);
});

test('latched tokens use the spec periods',()=>{
 const c=m.productionClock;assert.deepEqual(c.periodTicks,periods);
 for(const[i,item]of products.entries()){
  assert.equal(c.periodTicks[item],Math.floor(3600/(targets[item]*c.headroom[item])));
  const signal='signal-'+String.fromCharCode(65+i);
  const modulo=entities.filter(e=>e.control_behavior?.arithmetic_conditions?.operation==='%'&&e.control_behavior.arithmetic_conditions.output_signal?.name===signal);
  assert.equal(modulo.length,1);assert.equal(modulo[0].control_behavior.arithmetic_conditions.second_constant,periods[item]);
  const t=c.robotTokens[item];assert(byId.has(t.latch)&&byId.has(t.permission)&&byId.has(t.handReset));
  const arm=byId.get(t.output);assert.equal(arm.control_behavior.circuit_read_hand_contents,true);assert.equal(arm.control_behavior.circuit_hand_read_mode,1);
 }
});
