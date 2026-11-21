// rocket-supplies: unit checks of the published string, manifest and native report.
// Runs without the prototype dump (sizes, stacks and recipe demand are inline below); only the
// regeneration test needs the dump and skips without it. Report and hash checks fail, never skip.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {accessSync,constants} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const id='rocket-supplies',dir='blueprint-sources/'+id+'/';
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0];
const code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
// A missing report must fail, not skip: read it inside the tests that need it.
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';

const PU='processing-unit',LDS='low-density-structure',RF='rocket-fuel';
// Spec values (rocket-supplies.md sections 2 and 3) and the recipe demand at 5 per minute of each
// product, from the 2.1.24 dump: processing unit 20 circuits + 2 advanced circuits + 5 acid (10 s);
// advanced circuit 2 circuits + 2 plastic + 4 cable (6 s); cable 1 copper -> 2 (0.5 s);
// low density structure 20 copper + 2 steel + 5 plastic (15 s).
const targets={[RF]:5,[PU]:5,[LDS]:5};
const caps={[RF]:400,[PU]:400,[LDS]:400};
const stackSize={[RF]:20,[PU]:100,[LDS]:50};
const nominal={[RF]:5,'electronic-circuit':120,'copper-plate':120,'plastic-bar':45,'steel-plate':10,'sulfuric-acid':25};
const allowed=new Set(['assembling-machine-2','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','pipe','pipe-to-ground','passive-provider-chest','substation','medium-electric-pole','constant-combinator','arithmetic-combinator','decider-combinator','display-panel']);
const allowedRecipes=new Set([PU,LDS,'advanced-circuit','copper-cable']);
const size={'assembling-machine-2':[3,3],substation:[2,2],'decider-combinator':[1,2],'arithmetic-combinator':[1,2],'constant-combinator':[1,1]};
const tile=e=>[Math.floor(e.position.x),Math.floor(e.position.y)];
const vec=d=>({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d||0];
const reachOf=e=>e.name==='long-handed-inserter'?2:1;
// direction is the side an arm picks from: pick = tile + v * reach, drop = tile - v * reach.
const pickTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x+dx*r,y+dy*r];};
const dropTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x-dx*r,y-dy*r];};
const cellsOf=e=>{let[w,h]=size[e.name]||[1,1];if([4,12].includes(e.direction))[w,h]=[h,w];const out=[];for(let x=Math.round(e.position.x-w/2);x<e.position.x+w/2;x++)for(let y=Math.round(e.position.y-h/2);y<e.position.y+h/2;y++)out.push([x,y]);return out;};
const grid=new Map();for(const e of entities)for(const[x,y]of cellsOf(e))grid.set(x+','+y,e);
const at=(x,y)=>grid.get(x+','+y);
const fmt=v=>String(Math.round(v*10)/10);
const sorted=v=>[...v].sort();

test('one record; products, targets, caps, pass-through and supply figures are the spec values',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,id);assert.equal(m.file,id+'.txt');assert.equal(m.class,'rate');
 assert.equal(m.name,'Rocket supplies · 6 rockets per hour');
 assert.deepEqual(m.products,[PU,LDS]);assert.deepEqual(m.passThrough,[RF]);
 assert.deepEqual(m.targets,targets);assert.deepEqual(m.outputCaps,caps);
 assert.deepEqual(m.recipeAudit.nominalPerMinute,nominal);
 assert.deepEqual(m.recipeAudit.craftsPerMinute,{[PU]:5,'advanced-circuit':10,'copper-cable':20,[LDS]:5});
 for(const p of [...m.inputs,...m.fluids]){
  assert.equal(p.nominalPerMinute,nominal[p.item],'nominal '+p.item);
  assert(p.perMinute>=p.nominalPerMinute,'perMinute below nominal '+p.item);
 }
 assert.equal(m.stockControl.mode,'bar');
 for(const k of ['warmupMinutes','measureMinutes','blockedMinutes','settleMinutes','recoveryMinutes'])assert(m.protocol[k]>={warmupMinutes:15,measureMinutes:30,blockedMinutes:95,settleMinutes:5,recoveryMinutes:10}[k],k);
});

test('blueprint, native report, prototypes, harness and validator hashes agree',async()=>{
 const report=await loadReport();
 const evidence=report.builds.find(b=>b.id===m.id);
 assert(evidence,'native build evidence missing');
 assert.equal(hash(code),m.blueprintSha256);
 assert.equal(evidence.blueprintSha256,m.blueprintSha256,'native report is stale for this string');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);
 assert.equal(report.gameVersion,'2.1.24');
 assert(!report.short,'an exploration report is not a qualification');
 assert.equal(report.harnessSha256,hash(await read('scripts/'+id+'/control.lua')),'native harness changed since the report');
 assert.equal(report.validatorSha256,hash(await read('scripts/'+id+'/validate.mjs')),'validator changed since the report');
 for(const field of ['dataHarnessSha256','configurationSha256'])assert.match(report[field],/^[a-f0-9]{64}$/);
 for(const k of ['warmupMinutes','measureMinutes','blockedMinutes','settleMinutes','recoveryMinutes','stopAcceptingWindowMinutes'])assert.equal(report.protocolMinutes[k],m.protocol[k],'report protocol '+k);
});

test('native report passes the rate-class formula, recomputed from its numbers',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id);
 assert.equal(m.status,'qualified');
 assert.equal(report.passed,true);assert.equal(r.passed,true);assert.equal(r.complete,true);
 for(const[item,target]of Object.entries(targets)){
  assert(r.outputsPerMinute[item]>=.95*target,'steady '+item);
  assert(r.recovery.outputsPerMinute[item]>=.95*target,'recovery '+item);
 }
 const machineTotal=Object.values(m.machineCounts).reduce((a,b)=>a+b,0);
 assert.equal(r.machines.length,machineTotal);assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 assert.equal(r.inputs.length,m.inputs.length);
 for(const p of r.inputs){
  assert(p.acceptedDuringMeasurement>0&&p.productiveRoute.length>0,'entrance productive '+p.item);
  const port=m.inputs.find(q=>q.item===p.item);
  assert(p.measuredPerMinute<=port.perMinute+1e-9,'draw within the panel figure '+p.item);
 }
 // Rocket fuel passes through: its route ends at its own chest.
 const rf=r.inputs.find(p=>p.item===RF);assert.equal(rf.productiveRoute.at(-1),m.outputs.find(o=>o.item===RF).entity);
 assert.equal(r.fluids.length,1);
 for(const f of r.fluids){
  assert(f.acceptedDuringMeasurement>0&&f.measuredPerMinute<=m.fluids[0].perMinute+1e-9);
  assert(f.productiveConsumers.length===m.machineCounts[PU]&&f.productiveConsumers.every(e=>byId.get(e)?.recipe===PU),'acid reaches both processing-unit machines');
 }
 assert(r.outputPorts.length===3&&r.outputPorts.every(p=>p.collectedDuringMeasurement>0),'outputs delivered');
 assert.equal(r.blocked.collectionPauseStock.length,3);
 for(const p of r.blocked.collectionPauseStock)assert(p.count===400&&p.capacity===400&&p.maxDuringBlocked<=400,'chest exactly 400 at the end of the blocked phase: '+p.item);
 assert(r.blocked.machinesStoppedInLastMinute&&r.blocked.machinesAtBlockEnd.every(x=>x.craftsInLastMinute===0),'no craft in the last blocked minute');
 const rfStop=r.blocked.entranceAcceptance.find(a=>a.item===RF);assert(rfStop.blocked>0&&rfStop.inStopWindow===0,'rocket-fuel entrance stopped accepting');
 const loop=m.loopControl[0];assert(r.loopSamples[loop.name].maxStock<.9*loop.capacity,'ring below 90%');
 assert(r.powered&&r.externalApproachesClear&&r.stockNetworksIsolated&&r.exactRecipeChecks>0);
 assert(r.bulkInserters.every(a=>a.observedMaxHand<=2));
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);
 for(const[k,v]of Object.entries(r.checks))assert.equal(v,true,'check '+k);
 assert.deepEqual(m.measured.steadyPerMinute,r.outputsPerMinute);
 // Pacing, read back and sampled natively: the clock period, every step, and the logic output on every sample.
 assert.equal(r.checks.pacing,true,'pacing check present');
 const pace=r.pacing;
 assert.equal(pace.wiringVerified,true);assert.equal(pace.clockPeriodTicks,m.pacing.periodTicks);
 assert.equal(pace.clockBadSteps,0);assert(pace.clockWraps>=2&&pace.clockSteps>=2*m.pacing.periodTicks-2,'two full clock periods read tick by tick');
 assert(pace.logicSamples>10000,'logic sampled once a second through the run');
 assert.equal(pace.logicMismatchOneTickLater,0,'logic output equals its conditions one tick later');
 assert.equal(pace.foreignSignalsOnEnableNetwork,0);
 // Both branches were seen: the window open and closed, the reserves present (blocked phase) and missing.
 assert(pace.logicWindowSamples>0&&pace.logicWindowSamples<pace.logicSamples);
 assert(pace.logicFreeSamples>0&&pace.logicFreeSamples<pace.logicSamples);
 // At the panel figures the ring never held both reserves while measured: the machines ran in the window only.
 assert.equal(pace.measurement.samples,m.protocol.measureMinutes*60);
 assert.equal(pace.measurement.free,0,'no measured second with both reserves on the ring');
 // The machines follow the clock two ticks late, so a second read at an edge of the window can differ.
 assert(Math.abs(pace.measurement.enabled-pace.measurement.window)<=.01*pace.measurement.samples,'paced machines enabled in the window only');
 const share=pace.measurement.window/pace.measurement.samples;
 assert(Math.abs(share-m.pacing.windowTicks/m.pacing.periodTicks)<.01,'window share of the measured seconds');
});

test('west entrances: exact materials, one belt or pipe and one labelled panel each; rocket fuel north, circuits south',()=>{
 const entrances=[...m.inputs,...m.fluids];
 assert.deepEqual(sorted(m.inputs.map(p=>p.item)),sorted([RF,'copper-plate','plastic-bar','steel-plate','electronic-circuit']));
 assert.deepEqual(m.fluids.map(p=>p.item),['sulfuric-acid']);
 assert.deepEqual(sorted(m.ports.filter(p=>p.kind==='input'||p.kind==='fluid').map(p=>p.entity)),sorted(entrances.map(p=>p.entity)));
 assert.equal(new Set(entrances.map(p=>p.entity)).size,6);assert.equal(new Set(entrances.map(p=>p.displayEntity)).size,6);
 assert.equal(entities.filter(e=>e.name==='display-panel').length,6);
 const left=m.footprint.left;
 for(const p of entrances){
  const e=byId.get(p.entity);
  assert.equal(e.name,p.kind==='input'?'fast-transport-belt':'pipe');
  if(p.kind==='input'){assert.equal(e.direction,4);assert.equal(p.direction,4);}
  assert.equal(p.externalSide,'west');assert.deepEqual(p.items,[p.item]);
  assert.equal(e.position.x-.5,left,'entrance on the west edge');
  const panel=byId.get(p.displayEntity);assert.equal(panel.name,'display-panel');assert.equal(panel.always_show,true);
  assert.deepEqual(panel.icon,{type:p.kind==='fluid'?'fluid':'item',name:p.item});
  assert.equal(panel.text,`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min`);
  const[px,py]=tile(e),[lx,ly]=tile(panel);
  assert(Math.hypot(px-lx,py-ly)<=4,'panel within 4 tiles '+p.item);assert(!(ly===py&&lx<px),'panel not west of the entrance on its row');
  for(let k=1;k<=3;k++)assert(!at(px-k,py),'west approach clear '+p.item);
 }
 const rows=entrances.map(p=>({item:p.item,y:Math.floor(p.y)}));
 assert.equal(rows.find(r=>r.item===RF).y,Math.min(...rows.map(r=>r.y)),'rocket fuel is the northernmost entrance');
 assert.equal(rows.find(r=>r.item==='electronic-circuit').y,Math.max(...rows.map(r=>r.y)),'circuits are the southernmost entrance');
 // No other entrance of any kind sits outside the declared ones.
 assert(!m.ports.some(p=>p.externalSide==='north'||p.externalSide==='south'));
});

test('east outputs: three passive provider chests in one column, rocket fuel, processing units, low density structures from the north, bars as caps',()=>{
 assert.deepEqual(m.outputs.map(o=>o.item),[RF,PU,LDS]);
 const chests=m.outputs.map(o=>byId.get(o.entity));
 assert(chests.every(c=>c.name==='passive-provider-chest'));
 assert.equal(entities.filter(e=>e.name==='passive-provider-chest').length,3,'no other chest');
 const xs=new Set(chests.map(c=>c.position.x));assert.equal(xs.size,1,'one column');
 assert.equal(chests[0].position.x+.5,m.footprint.right,'on the east edge');
 for(let i=1;i<3;i++)assert.equal(chests[i].position.y,chests[i-1].position.y+1,'side by side, in order');
 for(const o of m.outputs){
  const c=byId.get(o.entity);
  assert.equal(o.externalSide,'east');assert.equal(o.cap,400);assert.deepEqual(o.items,[o.item]);
  assert.equal(c.bar,caps[o.item]/stackSize[o.item],'chest bar of '+o.item);assert.equal(c.bar*stackSize[o.item],o.cap);
  assert.equal(m.stockControl.chests[o.item],o.entity);
  const[cx,cy]=tile(c);for(let k=1;k<=3;k++)assert(!at(cx+k,cy),'east approach clear '+o.item);
  // Exactly one arm drops into each chest; it is a fast arm with a whitelist of that item only.
  const feeders=entities.filter(e=>/inserter/.test(e.name)&&dropTile(e)[0]===cx&&dropTile(e)[1]===cy);
  assert.equal(feeders.length,1,'one arm into '+o.item);
  assert.equal(feeders[0].name,'fast-inserter');assert.equal(feeders[0].use_filters,true);assert.deepEqual(feeders[0].filters.map(f=>f.name),[o.item]);
  assert(!(bp.wires||[]).some(w=>w[0]===o.entity||w[2]===o.entity),'chest unwired: the bar is the cap');
 }
});

test('only allowed entities, arm settings, recipes and machine counts',()=>{
 for(const e of entities){
  assert(allowed.has(e.name),e.name);
  assert.equal(e.quality??'normal','normal');
  assert(!/-module/.test(JSON.stringify(e.items??{})),'installed module '+e.entity_number);
  if(e.name==='fast-inserter'||e.name==='long-handed-inserter')assert.equal(e.override_stack_size,1);
  if(e.name==='bulk-inserter')assert.equal(e.override_stack_size,2);
  if(e.recipe){assert.equal(e.name,'assembling-machine-2');assert(allowedRecipes.has(e.recipe),'forbidden recipe '+e.recipe);}
  assert.equal(e.tags?.flight_science_entity,e.entity_number);
 }
 assert(!entities.some(e=>['electronic-circuit','rocket-fuel','concrete'].includes(e.recipe)),'no circuit, rocket-fuel or concrete recipe');
 assert.deepEqual(sorted(entities.filter(e=>/combinator/.test(e.name)).map(e=>e.entity_number)),sorted([m.pacing.clock,m.pacing.logic]),'the only combinators are the pacing clock and logic');
 const counts={};for(const e of entities)if(e.recipe)counts[e.recipe]=(counts[e.recipe]||0)+1;
 assert.deepEqual(counts,m.machineCounts);
 assert.deepEqual(counts,{[PU]:2,'advanced-circuit':2,'copper-cable':1,[LDS]:2});
 // Arms that pick from a belt carrying several item types are whitelisted.
 for(const e of entities.filter(e=>/inserter/.test(e.name))){
  const src=at(...pickTile(e));
  if(src&&/belt/.test(src.name)){assert.equal(e.use_filters,true,'filtered belt pick '+e.entity_number);assert((e.filter_mode??'whitelist')==='whitelist');}
 }
 assert.equal(bp.version,562954249961473);
 assert.deepEqual(bp.icons.map(i=>i.signal.name),[RF,PU,LDS]);
 assert.equal(bp.label,m.name);
 const power=m.ports.filter(p=>p.kind==='power');assert.equal(power.length,1);assert.equal(byId.get(power[0].entity).name,'substation');
 assert(entities.filter(e=>e.name==='medium-electric-pole').length<=4);
 for(const w of bp.wires||[])if(w[1]===5||w[3]===5)assert(byId.get(w[0]).name==='substation'&&byId.get(w[2]).name==='substation','copper wires only between substations');
});

test('footprint and bill of materials match the decoded string',()=>{
 const xs=[],ys=[];
 for(const e of entities){let[w,h]=size[e.name]||[1,1];if([4,12].includes(e.direction))[w,h]=[h,w];xs.push(e.position.x-w/2,e.position.x+w/2);ys.push(e.position.y-h/2,e.position.y+h/2);}
 const f={left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);
 assert.equal(m.areaGoal.achievedTiles,f.width*f.height);
 assert.equal(m.areaGoal.goalTiles,260);assert.equal(m.areaGoal.stretchTiles,230);assert.equal(m.areaGoal.fallbackTiles,340);
 assert(m.areaGoal.achievedTiles<=m.areaGoal.fallbackTiles);
 const items={};for(const e of entities)items[e.name]=(items[e.name]||0)+1;
 assert.deepEqual(m.billOfMaterials.items,items);assert.deepEqual(m.construction,items);
 assert(!bp.tiles,'no tiles');
});

test('single loop: closed ring, per-tile hold readers on one red network, gated admissions and product arms',()=>{
 assert.equal(m.loopControl.length,1);
 const loop=m.loopControl[0];
 assert.equal(loop.readerMode,'per-tile-hold');assert.equal(loop.capacity,8*loop.loop.length);
 assert.equal(loop.maximumStock,Object.values(loop.limits).reduce((a,b)=>a+b,0));
 assert(loop.maximumStock<=.6*loop.capacity,'limits within 60% of capacity');
 // The four belt entrances side-load onto one lane of the ring (4 slots per tile): their limits leave a
 // quarter of it free so copper can merge while circuits and plastic are in surplus.
 const entranceShare=['electronic-circuit','copper-plate','plastic-bar','steel-plate'].reduce((a,k)=>a+loop.limits[k],0);
 assert(entranceShare<=.75*4*loop.loop.length,'entrance limits '+entranceShare+' above 75% of the shared entrance lane');
 assert.deepEqual(loop.entranceLane,{share:entranceShare,slots:4*loop.loop.length,maximumFraction:.75});
 const tiles=loop.loop.map(n=>byId.get(n));
 for(const e of tiles){assert.equal(e.name,'fast-transport-belt');assert.deepEqual(e.control_behavior,{circuit_read_hand_contents:true,circuit_contents_read_mode:1});}
 // Closed: each tile points at the next one.
 tiles.forEach((e,i)=>{const n=tiles[(i+1)%tiles.length],[x,y]=tile(e),[dx,dy]=vec(e.direction);assert.deepEqual(tile(n),[x+dx,y+dy],'ring breaks at '+e.entity_number);});
 // One red network holds every ring tile, every conditioned belt and arm, and the input of the
 // pacing logic. The only green wires belong to the pacing (next test).
 const pacingEntities=new Set([m.pacing.clock,m.pacing.logic,...m.pacing.machines,...m.pacing.relays]);
 const parent=new Map();const find=a=>{while(parent.get(a)!==a&&parent.has(a))a=parent.get(a);return a;};
 const node=(id,c)=>{const k=id+':'+c;if(!parent.has(k))parent.set(k,k);return k;};
 for(const w of bp.wires||[]){if(w[1]===5)continue;
  const A=byId.get(w[0]),B=byId.get(w[2]);assert(Math.hypot(A.position.x-B.position.x,A.position.y-B.position.y)<=8,'wire at most 8 tiles');
  if(w[1]!==1||w[3]!==1){assert(pacingEntities.has(w[0])&&pacingEntities.has(w[2]),'a wire that is not ring red joins pacing entities only');continue;}
  const a=find(node(w[0],w[1])),b=find(node(w[2],w[3]));parent.set(a,b);}
 const ring=find(node(loop.reader,1));
 for(const e of tiles)assert.equal(find(node(e.entity_number,1)),ring);
 // Red wires touch ring tiles, conditioned belts and arms, and the logic input: nothing else.
 const redAllowed=new Set([...loop.loop,...loop.controlled,...loop.productGated,m.pacing.logic]);
 for(const w of bp.wires||[])if(w[1]===1&&w[3]===1){assert(redAllowed.has(w[0])&&redAllowed.has(w[2]),'red wire outside the ring network');assert.equal(find(node(w[0],1)),ring);}
 const conditioned=entities.filter(e=>e.control_behavior?.circuit_condition);
 assert.deepEqual(sorted(conditioned.map(e=>e.entity_number)),sorted([...loop.controlled,...loop.productGated,...m.pacing.machines]));
 for(const e of conditioned){assert.equal(e.control_behavior.circuit_enabled,true);if(!m.pacing.machines.includes(e.entity_number))assert.equal(find(node(e.entity_number,1)),ring);}
 // Admission gates and every arm that puts an item on the ring: item < its limit.
 for(const n of loop.controlled){
  const e=byId.get(n),c=e.control_behavior.circuit_condition;
  assert.equal(c.comparator,'<');assert.equal(c.constant,loop.limits[c.first_signal.name],'limit of '+c.first_signal.name);
  if(e.name==='fast-transport-belt'){const p=m.inputs.find(q=>q.entity===n);assert(p&&p.item===c.first_signal.name,'gate reads its own item');}
  else{const[dx,dy]=dropTile(e);assert(tiles.some(t=>tile(t)[0]===dx&&tile(t)[1]===dy),'controlled arm drops on the ring');}
 }
 // Every ingredient arm of the processing-unit line waits on processing units, of the low-density line on low density structures.
 for(const n of loop.productGated){
  const e=byId.get(n),c=e.control_behavior.circuit_condition,fed=at(...dropTile(e));
  assert.equal(fed.name,'assembling-machine-2');assert.equal(c.comparator,'<');
  assert.equal(c.first_signal.name,fed.recipe===LDS?LDS:PU);assert.equal(c.constant,loop.limits[c.first_signal.name]);
 }
 // Every machine ingredient arm that picks from the ring is product-gated.
 for(const e of entities.filter(e=>/inserter/.test(e.name))){
  const src=at(...pickTile(e)),dst=at(...dropTile(e));
  if(src&&loop.loop.includes(src.entity_number)&&dst?.name==='assembling-machine-2')assert(loop.productGated.includes(e.entity_number),'ungated ingredient arm '+e.entity_number);
 }
});

test('pacing: a clock and a logic decider enable both processing-unit machines in a window, or freely while the ring holds both reserves',()=>{
 const pc=m.pacing,loop=m.loopControl[0];
 assert.deepEqual(Object.keys(pc).sort(),['clock','clockSignal','craftsPerMinuteAtTargets','craftsPerMinuteFree','craftsPerMinuteInWindow','enableSignal','leftForLowDensityAtPanels','logic','machines','periodTicks','processingUnitsPerMinuteInWindow','recipe','relays','reserves','windowTicks'].sort());
 const clock=byId.get(pc.clock),logic=byId.get(pc.logic);
 assert.equal(clock.name,'decider-combinator');assert.equal(logic.name,'decider-combinator');
 // Both stand on tiles that were empty before (the arm column north of the chests): the rectangle is unchanged.
 assert.deepEqual([m.footprint.width,m.footprint.height],[14,12]);assert.equal(m.areaGoal.achievedTiles,168);
 for(const e of [clock,logic])for(const[x,y]of cellsOf(e))assert(x>=m.footprint.left&&x<m.footprint.right&&y>=m.footprint.top&&y<m.footprint.bottom,'pacing decider inside the rectangle');
 // The paced machines are exactly the processing-unit machines; nothing relays.
 assert.equal(pc.recipe,PU);assert.deepEqual(pc.relays,[]);
 assert.deepEqual(sorted(pc.machines),sorted(entities.filter(e=>e.recipe===PU).map(e=>e.entity_number)));
 const T={type:'virtual',name:'signal-T'},E={type:'virtual',name:'signal-E'};
 assert.equal(pc.clockSignal,T.name);assert.equal(pc.enableSignal,E.name);
 // Clock: counts 0..period-1 by adding one to its own output each tick.
 assert.deepEqual(clock.control_behavior,{decider_conditions:{conditions:[{first_signal:T,comparator:'<',constant:pc.periodTicks-1}],
  outputs:[{signal:T,copy_count_from_input:true},{signal:T,copy_count_from_input:false,constant:1}]}});
 // Logic: window (green) OR copper reserve AND plastic reserve (red, the ring).
 const item=name=>({type:'item',name,quality:'normal'});
 assert.deepEqual(pc.reserves,{'copper-plate':20,'plastic-bar':6});
 assert.deepEqual(logic.control_behavior,{decider_conditions:{conditions:[
  {first_signal:T,comparator:'<',constant:pc.windowTicks,first_signal_networks:{red:false,green:true}},
  {first_signal:item('copper-plate'),comparator:'≥',constant:20,first_signal_networks:{red:true,green:false},compare_type:'or'},
  {first_signal:item('plastic-bar'),comparator:'≥',constant:6,first_signal_networks:{red:true,green:false},compare_type:'and'}],
  outputs:[{signal:E,copy_count_from_input:false,constant:1}]}});
 // A reserve is about half of the item's ring limit: reached only when the item arrives faster than it is used.
 for(const[name,reserve]of Object.entries(pc.reserves))assert(reserve>=.4*loop.limits[name]&&reserve<=.6*loop.limits[name],'reserve of '+name);
 for(const n of pc.machines)assert.deepEqual(byId.get(n).control_behavior,{circuit_enabled:true,circuit_condition:{first_signal:E,comparator:'>',constant:0}});
 // Wires (combinator connectors: 1 input red, 2 input green, 3 output red, 4 output green).
 const wires=(bp.wires||[]).filter(w=>w[1]!==5);
 const has=(a,ca,b,cb)=>wires.some(w=>(w[0]===a&&w[1]===ca&&w[2]===b&&w[3]===cb)||(w[0]===b&&w[1]===cb&&w[2]===a&&w[3]===ca));
 assert(has(pc.clock,4,pc.clock,2),'clock output wired to its own input (green)');
 assert(has(pc.clock,4,pc.logic,2),'clock output to the logic input (green)');
 const green=wires.filter(w=>w[1]!==1||w[3]!==1);
 assert.equal(green.length,2+pc.machines.length,'two clock wires and one green wire per paced machine');
 // The enable network: logic output and both machines, nothing else.
 const group=new Set([pc.logic+':4']);
 for(let grew=true;grew;){grew=false;for(const w of green){const a=w[0]+':'+w[1],b=w[2]+':'+w[3];if(group.has(a)!==group.has(b)){group.add(a);group.add(b);grew=true;}}}
 assert.deepEqual(sorted([...group]),sorted([pc.logic+':4',...pc.machines.map(n=>n+':2')]));
 // The logic input reads the ring on red; the clock and the paced machines carry no red wire.
 const red=wires.filter(w=>w[1]===1&&w[3]===1);
 const logicRed=red.filter(w=>w[0]===pc.logic||w[2]===pc.logic);
 assert.equal(logicRed.length,1);
 const other=logicRed[0][0]===pc.logic?logicRed[0][2]:logicRed[0][0];
 assert([...loop.loop,...loop.controlled,...loop.productGated].includes(other),'logic input wired into the ring network');
 for(const n of [pc.clock,...pc.machines])assert(!red.some(w=>w[0]===n||w[2]===n),'no red wire on '+n);
 // Arithmetic: two machines at 4.5 per minute, enabled window/period of the time.
 assert.equal(pc.craftsPerMinuteFree,9);assert.equal(pc.craftsPerMinuteAtTargets,5);
 const inWindow=Math.round(9*pc.windowTicks/pc.periodTicks*1000)/1000;
 assert.equal(pc.craftsPerMinuteInWindow,inWindow);assert.equal(pc.processingUnitsPerMinuteInWindow,inWindow);
 assert(inWindow>=5.05&&inWindow<=5.125,'the window allows the target plus 1% to 2.5%: '+inWindow);
 // What the window leaves the low-density line when plastic and copper arrive at exactly their panels:
 // a processing unit takes 4 plastic (2 advanced circuits) and 4 copper (8 cable).
 assert.deepEqual(pc.leftForLowDensityAtPanels,{'plastic-bar':Math.round((45-4*inWindow)*1000)/1000,'copper-plate':Math.round((120-4*inWindow)*1000)/1000});
 assert(pc.leftForLowDensityAtPanels['plastic-bar']>=.98*25&&pc.leftForLowDensityAtPanels['copper-plate']>=.98*100);
 // The harness reads the clock once a second: the period shares no factor with 60.
 const gcd=(a,b)=>b?gcd(b,a%b):a;assert.equal(gcd(pc.periodTicks,60),1);
});

test('supply above the panels: evidence for this string; every feed at or above the panels keeps every floor',async()=>{
 const above=JSON.parse(await read(dir+'above-panels.json'));
 assert.equal(above.blueprintSha256,m.blueprintSha256,'above-panels.json is stale for this string');
 for(const k of ['warmupMinutes','measureMinutes','blockedMinutes','settleMinutes','recoveryMinutes'])assert.equal(above.protocolMinutes[k],m.protocol[k],'full-length run: '+k);
 const by=Object.fromEntries(above.scenarios.map(s=>[s.name,s]));
 const names=['saturated','all-150-percent','all-105-percent','circuits','circuits-acid','circuits-130-acid','circuits-acid-steel','circuits-acid-copper-150','all-but-plastic','all-but-copper',
  'circuits-plastic','circuits-360-plastic','circuits-plastic-acid','circuits-plastic-copper-150','circuits-plastic-acid-copper-150','circuits-plastic-copper-steel','plastic-50-rest-high','copper-130-rest-high','acid','steel','plastic','copper'];
 assert.deepEqual(sorted(Object.keys(by)),sorted(names));
 for(const name of names){
  const s=by[name];
  assert(s.passedExceptDraw,name+' failed '+s.failedChecks.join(','));
  for(const item of Object.keys(targets)){assert(s.steadyPerMinute[item]>=.95*targets[item],name+' steady '+item);assert(s.recoveryPerMinute[item]>=.95*targets[item],name+' recovery '+item);}
  for(const v of Object.values(s.blockedChestStock))assert.equal(v,400);
  for(const v of Object.values(s.blockedChestMaximum))assert.equal(v,400,name+' chest never above its cap');
  assert(s.machinesStoppedInLastBlockedMinute);assert(s.ringMaximumStock<.9*m.loopControl[0].capacity);
  // No entrance is fed below its panel.
  if(s.feed!=='saturated')for(const[item,v]of Object.entries(s.feed))assert(v>=nominal[item],name+' feeds '+item+' below its panel');
 }
 // Circuits and acid in surplus with plastic or copper at exactly its panel: the processing-unit
 // machines are held to the window, so the low-density line keeps its share (the earlier string
 // made 3.0 per minute here).
 for(const name of ['circuits-acid','circuits-acid-steel','circuits-acid-copper-150','all-but-plastic','all-but-copper','circuits-plastic-acid']){
  const s=by[name];
  assert(s.steadyPerMinute[PU]<=m.pacing.processingUnitsPerMinuteInWindow+.07,name+' processing units held to the window');
  assert(s.steadyPerMinute[LDS]>=4.9&&s.recoveryPerMinute[LDS]>=4.9,name+' low density structures');
  assert.equal(s.pacingFreeShare<.02,true,name+' ring below the reserves');
 }
 // Copper and plastic both well above their panels: the reserves stay on the ring and both lines run faster.
 for(const name of ['saturated','all-150-percent']){
  const s=by[name];assert(s.steadyPerMinute[PU]>=7.4&&s.steadyPerMinute[LDS]>=5.9,name+' runs free');assert(s.pacingFreeShare>=.5,name+' reserves on the ring most of the time');
 }
});

test('the replaced string is kept with its evidence',async()=>{
 const old='blueprint-sources/'+id+'/history/unpaced-b10cbc28/';
 const oldCode=(await read(old+id+'.txt')).toString().trim();
 assert.equal(hash(oldCode),'b10cbc287a0104307b394c9d2dbb11d82f2fedf12251126fa42aa3585b4fd106');
 const oldManifest=JSON.parse(await read(old+'manifest.json'))[0],oldReport=JSON.parse(await read(old+'native-report.json'));
 assert.equal(oldManifest.blueprintSha256,hash(oldCode));assert.equal(oldReport.builds[0].blueprintSha256,hash(oldCode));assert.equal(oldReport.passed,true);
 assert.match((await read(old+'NOTE.md')).toString(),/replaced/i);
 // Same rectangle and machines as the current string; the current one adds only the two deciders.
 assert.deepEqual(oldManifest.footprint,m.footprint);assert.deepEqual(oldManifest.machineCounts,m.machineCounts);
 assert.deepEqual({...oldManifest.construction,'decider-combinator':2},m.construction);
 for(const k of ['inputs','fluids','outputs'])assert.deepEqual(oldManifest[k].map(p=>[p.item,p.x,p.y,p.externalSide,p.perMinute??p.cap]),m[k].map(p=>[p.item,p.x,p.y,p.externalSide,p.perMinute??p.cap]),'same '+k+' in the same places');
 // The defect it was replaced for, measured on it with the same feeds as the current string.
 const wider=JSON.parse(await read(old+'above-panels-wider.json'));
 assert.equal(wider.blueprintSha256,hash(oldCode));
 const by=Object.fromEntries(wider.scenarios.map(s=>[s.name,s]));
 assert(by['circuits-acid'].steadyPerMinute[LDS]<=3.1&&by['circuits'].recoveryPerMinute[LDS]<=3.2,'low density structures starved with circuits above the panel');
 assert(wider.scenarios.filter(s=>!s.passedExceptDraw).length>=10);
});

test('supplier links follow the contract placement rules',()=>{
 const top=m.footprint.top;
 const rowOf=item=>Math.floor([...m.inputs,...m.fluids].find(p=>p.item===item).y)-top;
 const fuel=m.supplierLinks.find(l=>l.supplier==='rocket-fuel-supplier'),green=m.supplierLinks.find(l=>l.supplier==='green-circuits');
 assert.deepEqual([fuel.item,fuel.copies,fuel.entranceRowFromTop,fuel.perMinute],[RF,1,rowOf(RF),m.inputs.find(p=>p.item===RF).perMinute]);
 assert.deepEqual([green.item,green.copies,green.entranceRowFromTop,green.perMinute],['electronic-circuit',1,rowOf('electronic-circuit'),m.inputs.find(p=>p.item==='electronic-circuit').perMinute]);
 if(green.clearRowsNorth<5)assert.match(green.note,/clear row/);
});

test('generator is reproducible: same string and byte-identical manifest',async t=>{
 try{accessSync(rawPath,constants.R_OK);}catch{t.skip('Pinned local prototype dump is not installed or not readable (set FACTORIO_RAW)');return;}
 const out='.cache/'+id+'/test-regenerate';
 await fs.rm(new URL(out,root),{recursive:true,force:true});await fs.mkdir(new URL(out,root),{recursive:true});
 await fs.copyFile(new URL(dir+'native-report.json',root),new URL(out+'/native-report.json',root));
 await promisify(execFile)(process.execPath,['scripts/'+id+'/generate.mjs'],{cwd:rootPath,env:{...process.env,RS_OUT:out,RS_OPTIONS:''}});
 assert.equal((await read(out+'/'+id+'.txt')).toString(),(await read(dir+id+'.txt')).toString());
 assert.equal((await read(out+'/manifest.json')).toString(),(await read(dir+'manifest.json')).toString());
});
