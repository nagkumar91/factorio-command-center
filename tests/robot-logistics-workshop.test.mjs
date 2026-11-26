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
const targets={'construction-robot':10,'logistic-robot':10,roboport:1,'storage-chest':4,'passive-provider-chest':4,'requester-chest':4};
const ringProducts=Object.keys(targets).filter(p=>p!=='requester-chest');
const products=Object.keys(targets);
const nominal={'iron-plate':520,'copper-plate':659,'steel-plate':181,'plastic-bar':154,'sulfuric-acid':800,lubricant:300};
const officialSha='289d0de81102a710f16fc989a5df399facdef91c100901da87e5e69b4d911495'; // Factorio 2.1.25 Space Age, vanilla (--dump-data)
const rawDefault='/Users/nagkumar/clawd/workspaces/.claude/tmp-robot-requester-product/dump/write/script-output/data-raw-dump.json';
const sorted=v=>[...v].sort();
const names=v=>sorted(v.map(p=>p.item));
const ingredients=v=>sorted(v.map(i=>`${i.type}:${i.name}:${i.amount}`));
function rate(actual,item,context){assert(Number.isFinite(actual),`${context}: missing ${item}`);assert(actual>=targets[item]*.95,`${context}: ${item} ${actual} < ${targets[item]*.95}/min`);}

test('chosen robot targets, chest rates and official recipe boundary are exact',()=>{
 assert.deepEqual(m.targets,targets);
 assert.deepEqual(sorted(m.products),sorted(products));
 assert.deepEqual(m.recipeAudit.externalPerMinute,nominal);
 assert.equal(m.recipeAudit.craftsPerMinute['electronic-circuit'],310);
 assert.equal(m.recipeAudit.craftsPerMinute['advanced-circuit'],77);
 assert.equal(m.recipeAudit.craftsPerMinute['copper-cable'],619);
 assert.equal(m.recipeAudit.craftsPerMinute['requester-chest'],4);
 assert.equal(m.recipeAudit.craftsPerMinute['steel-chest'],12);
 assert.deepEqual(names(m.inputs),sorted(['iron-plate','copper-plate','steel-plate','plastic-bar']));
 assert.deepEqual(names(m.fluids),sorted(['sulfuric-acid','lubricant']));
 for(const p of [...m.inputs,...m.fluids]){
  assert.equal(p.externalSide,'west');assert.equal(p.perMinute,nominal[p.item]);assert(byId.has(p.entity));
 }
 const required=['copper-cable','electronic-circuit','advanced-circuit','iron-gear-wheel','pipe','engine-unit','electric-engine-unit','battery','flying-robot-frame','steel-chest',...products];
 for(const p of products)assert.equal(entities.filter(e=>e.recipe===p).length,1,'one machine for '+p);
 for(const recipe of required)assert(entities.some(e=>e.recipe===recipe),`internal recipe missing: ${recipe}`);
});

test('source, native report, official prototypes, harness and validator hashes agree',async()=>{
 assert(evidence,'native build evidence missing');
 assert.equal(hash(code),m.blueprintSha256);
 assert.equal(evidence.blueprintSha256,m.blueprintSha256,'native report is stale for blueprint');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);
 assert.equal(report.gameVersion,'2.1.25');
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
  // The collector's dynamic filters hold five items at most, so the five ring-borne products have a filter gate each ...
  if(p.item!=='requester-chest')assert.equal(gates.length,1,`one independent chest filter gate for ${p.item}`);
  // ... and the requester chest has none: it never reaches the collector.
  else assert.equal(gates.length,0,'the requester chest must not take a collector filter slot');
 }
 assert.equal(Object.keys(m.stockControl.deciders).length,5);assert.deepEqual(sorted(Object.keys(m.stockControl.deciders)),sorted(ringProducts));
 assert.equal(evidence.stockNetworksIsolated,true);
});

test('the requester chest machine fills the output chest through its own gated inserter, capped by the chest count',()=>{
 const direct=m.stockControl.directProducts['requester-chest'];assert(direct);
 const chest=byId.get(m.stockControl.chest),arm=byId.get(direct.inserter),machine=entities.find(e=>e.recipe==='requester-chest');
 assert.equal(machine.name,'assembling-machine-2');assert.equal(direct.cap,50);assert.equal(m.outputCaps['requester-chest'],50);
 // The inserter stands on the chest's west side and picks from the machine's east edge; direction is the pickup side (west).
 assert.equal(arm.name,'fast-inserter');assert.equal(arm.direction,12);
 assert.deepEqual([arm.position.x+1,arm.position.y],[chest.position.x,chest.position.y]);
 assert(Math.abs(machine.position.x+2-arm.position.x)<1e-9&&machine.position.y-1<=arm.position.y&&arm.position.y<=machine.position.y+1,'machine beside the inserter');
 const token=m.productionClock.robotTokens['requester-chest'];assert.equal(token.output,arm.entity_number);assert.equal(token.permission,direct.permission);
 assert.equal(arm.control_behavior.circuit_condition.first_signal.name,'signal-G');
 const permission=byId.get(token.permission).control_behavior.decider_conditions.conditions;
 assert.deepEqual(permission[0],{first_signal:{type:'item',name:'requester-chest',quality:'normal'},comparator:'<',constant:50});
 // The permission decider reads the chest's red counts, never the ring: wires 1:1 between the chest and the decider input, and no ring tile on its red input.
 assert(bp.wires.some(([a,ac,b,bc])=>a===chest.entity_number&&ac===1&&b===token.permission&&bc===1),'chest red wire to the permission decider');
 const ring=new Set(m.loopControl[0].loop);
 assert(!bp.wires.some(([a,ac,b,bc])=>(b===token.permission&&bc===1&&ring.has(a))||(a===token.permission&&ac===1&&ring.has(b))),'requester permission decider must not read the ring');
 // The machine's one ring arm takes the three ingredients; its east approach (three tiles from the chest) stays clear.
 const feed=entities.filter(e=>e.name==='fast-inserter'&&e.use_filters&&e.filters?.length===3&&e.filters.some(f=>f.name==='steel-chest')&&Math.abs(e.position.x-machine.position.x)<=1&&e.position.y===machine.position.y+2);
 assert.equal(feed.length,1);assert.deepEqual(sorted(feed[0].filters.map(f=>f.name)),sorted(['steel-chest','electronic-circuit','advanced-circuit']));
 for(let k=1;k<=3;k++)assert(!entities.some(e=>e.position.y===chest.position.y&&e.position.x===chest.position.x+k),'east approach blocked at '+k);
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

test('all six steady/recovery rates reach 95 percent and closed caps are exact',()=>{
 assert.equal(report.passed,true,'report not qualified');assert.equal(evidence.passed,true,'build not qualified');
 assert(report.measurementMinutes>0);assert(evidence.recovery.measurementMinutes>0);
 assert.deepEqual(names(evidence.outputPorts),sorted(products));
 for(const item of products){rate(evidence.outputsPerMinute[item],item,'steady');rate(evidence.recovery.outputsPerMinute[item],item,'recovery');const out=evidence.outputPorts.find(p=>p.item===item);assert.equal(out.entity,m.outputs.find(p=>p.item===item).entity);assert(out.collectedDuringMeasurement>0);}
 assert.equal(evidence.recovery.pauseMode,'natural-product-stocking-collection-paused-no-product-fixtures');
 assert(evidence.recovery.blockedOutputFilled.every(p=>p.inserted===0),'closed stocking must use real production, not inserted products');
 const closed=evidence.recovery.collectionPauseStock;assert.deepEqual(names(closed),sorted(products));
 for(const p of closed){assert.equal(p.count,m.outputCaps[p.item]);assert.equal(p.capacity,m.outputCaps[p.item]);assert.equal(p.entity,m.stockControl.chest);}
});

test('each of six independent stock tests reaches its cap without starving the other five',()=>{
 const phases=evidence.independentStockCapTests;assert.equal(phases?.length,6);
 assert.deepEqual(sorted(phases.map(p=>p.blockedProduct)),sorted(products));
 for(const phase of phases){assert.equal(phase.finalBlockedStock,m.outputCaps[phase.blockedProduct],`blocked cap: ${phase.blockedProduct}`);assert(phase.measurementMinutes>0);const others=products.filter(p=>p!==phase.blockedProduct);assert.deepEqual(sorted(Object.keys(phase.outputsPerMinute)),sorted(others));for(const item of others)rate(phase.outputsPerMinute[item],item,`${phase.blockedProduct} held at cap`);}
});

test('compact four-row ring: 52 x 21 footprint, 56 machines, west entrances in the original order',async()=>{
 assert.deepEqual(m.footprint,{left:-2,top:-4,right:50,bottom:17,width:52,height:21});
 assert.equal(m.areaTiles??m.footprint.width*m.footprint.height,1092);
 assert.equal(entities.filter(e=>e.name==='assembling-machine-2').length,53);
 assert.equal(entities.filter(e=>e.name==='chemical-plant').length,3);
 assert.equal(m.machineCounts['iron-gear-wheel'],1);
 assert.equal(Object.values(m.machineCounts).reduce((a,b)=>a+b,0),56);
 assert.equal(entities.filter(e=>e.name==='long-handed-inserter').length,0,'compact layout uses fast and bulk arms only');
 assert.equal(entities.filter(e=>e.name==='substation').length,3);
 const west=[...m.inputs,...m.fluids].sort((a,b)=>a.y-b.y).map(p=>p.item);
 assert.deepEqual(west,['sulfuric-acid','plastic-bar','copper-plate','iron-plate','steel-plate','lubricant'],'entrance order north to south');
 const loop=m.loopControl[0];assert.equal(loop.capacity,960);assert.equal(Object.values(loop.limits).reduce((a,b)=>a+b,0),loop.maximumStock);assert(loop.maximumStock<loop.capacity*.6,'ring limits well under capacity');
});

test('superseded 106 x 24 version is kept with its own qualified report',async()=>{
 const h=dir+'history/two-row-rail-c1c984d3/';
 const [old]=JSON.parse(await read(h+'manifest.json'));const oldCode=(await read(h+old.file)).toString().trim();
 assert.equal(hash(oldCode),old.blueprintSha256);assert(old.blueprintSha256.startsWith('c1c984d3'));
 assert.equal(old.footprint.width*old.footprint.height,2544);
 const oldReport=JSON.parse(await read(h+'native-report.json'));assert.equal(oldReport.passed,true);
 assert.equal(oldReport.builds[0].blueprintSha256,old.blueprintSha256);
 assert.match((await read(h+'NOTE.md')).toString(),/superseded/);
 assert(m.footprint.width*m.footprint.height<old.footprint.width*old.footprint.height*.95,'replacement must be at least 5% smaller');
});

test('output caps are one full stack of each product; the five-product and twenty-robot versions are kept and listed',async()=>{
 const caps={'construction-robot':50,'logistic-robot':50,roboport:10,'storage-chest':50,'passive-provider-chest':50,'requester-chest':50};
 const fiveCaps={'construction-robot':50,'logistic-robot':50,roboport:10,'storage-chest':50,'passive-provider-chest':50};
 const oldCaps={'construction-robot':20,'logistic-robot':20,roboport:2,'storage-chest':10,'passive-provider-chest':10};
 assert.deepEqual(m.outputCaps,caps);assert.deepEqual(m.stockControl.caps,caps);
 // Closed hold and selective settles outlast the slowest cap (50 chests at about 4.4 per minute).
 assert(m.protocol.blockedMinutes>=15&&m.protocol.selectiveSettleMinutes>=15&&m.protocol.selectivePhases===6);
 assert.deepEqual(report.protocolMinutes,{warmup:15,measure:30,blocked:m.protocol.blockedMinutes,settle:m.protocol.settleMinutes,recovery:m.protocol.recoveryMinutes,phases:6,phase:m.protocol.selectiveSettleMinutes+m.protocol.selectiveMeasureMinutes,phaseSettle:m.protocol.selectiveSettleMinutes});
 for(const item of products)assert(evidence.recovery.capReachedMinute[item]<=m.protocol.blockedMinutes,`${item} cap reached after the closed hold`);
 for(const phase of evidence.independentStockCapTests)assert(phase.capReachedMinute<=m.protocol.selectiveSettleMinutes,`${phase.blockedProduct} cap reached after the selective settle`);
 for(const phase of evidence.independentStockCapTests)assert.equal(phase.settlingMinutes,m.protocol.selectiveSettleMinutes);
 // The five-product string this one replaced: kept complete with its own passing report.
 const five=dir+'history/five-products-full-stack/';
 const [fiveManifest]=JSON.parse(await read(five+'manifest.json'));const fiveCode=(await read(five+fiveManifest.file)).toString().trim();
 assert.equal(hash(fiveCode),'ee80fa8d4c6cb047bfb7b84725209fb3b56bb36904b547c633b702dc2c3038de');assert.equal(fiveManifest.blueprintSha256,hash(fiveCode));
 assert.deepEqual(fiveManifest.outputCaps,fiveCaps);assert.notEqual(fiveManifest.blueprintSha256,m.blueprintSha256);
 const fiveReport=JSON.parse(await read(five+'native-report.json'));assert.equal(fiveReport.passed,true);assert.equal(fiveReport.builds[0].blueprintSha256,fiveManifest.blueprintSha256);assert.equal(fiveReport.gameVersion,'2.1.24');
 assert.match((await read(five+'NOTE.md')).toString(),/requester/i);
 assert.equal(fiveManifest.footprint.width*fiveManifest.footprint.height,1071);
 // The oldest string differs from the five-product string only in its five cap deciders (and the description naming them).
 const old=dir+'history/twenty-robot-caps/';
 const [oldManifest]=JSON.parse(await read(old+'manifest.json'));const oldCode=(await read(old+oldManifest.file)).toString().trim();
 assert.equal(hash(oldCode),'7799803137e2407df1c55de9a8e090a03bbc8d45c5f55f4c633e9ab877ca15fc');assert.equal(oldManifest.blueprintSha256,hash(oldCode));
 assert.deepEqual(oldManifest.outputCaps,oldCaps);
 const oldReport=JSON.parse(await read(old+'native-report.json'));assert.equal(oldReport.passed,true);assert.equal(oldReport.builds[0].blueprintSha256,oldManifest.blueprintSha256);
 assert.match((await read(old+'NOTE.md')).toString(),/twenty/i);
 const fiveBp=decodeBlueprint(fiveCode).blueprint,oldBp=decodeBlueprint(oldCode).blueprint;assert.equal(oldBp.entities.length,fiveBp.entities.length);
 const gates=new Set(Object.values(fiveManifest.stockControl.deciders));assert.equal(gates.size,5);
 const mask=e=>{const c=structuredClone(e);if(gates.has(c.entity_number))for(const d of c.control_behavior.decider_conditions.conditions)d.constant='cap';return c;};
 assert.deepEqual(oldBp.entities.map(mask),fiveBp.entities.map(mask));assert.deepEqual(oldBp.wires,fiveBp.wires);
 assert.deepEqual(oldManifest.loopControl,fiveManifest.loopControl);assert.deepEqual(oldManifest.productionClock,fiveManifest.productionClock);assert.deepEqual(oldManifest.footprint,fiveManifest.footprint);
 // The six-product string keeps every earlier entrance, the output chest tile and the five filter deciders' caps; it adds one column and the requester machine.
 const tile=p=>[p.kind,p.items[0],p.externalSide,p.x,p.y];
 assert.deepEqual(m.ports.filter(p=>['input','fluid'].includes(p.kind)).map(tile),fiveManifest.ports.filter(p=>['input','fluid'].includes(p.kind)).map(tile),'entrances unchanged');
 const chestTile=x=>[x.position.x,x.position.y];assert.deepEqual(chestTile(byId.get(m.stockControl.chest)),chestTile(fiveBp.entities.find(e=>e.entity_number===fiveManifest.stockControl.chest)),'output chest tile unchanged');
 assert.deepEqual(m.loopControl[0].limits,fiveManifest.loopControl[0].limits);
 assert.deepEqual(m.versions.map(v=>v.label),['Requester chests','Full-stack caps','Twenty-robot caps']);
 assert.deepEqual(m.versions.map(v=>v.blueprintSha256),[m.blueprintSha256,fiveManifest.blueprintSha256,oldManifest.blueprintSha256]);
 assert.deepEqual(m.versions.map(v=>v.file),[m.file,'history/five-products-full-stack/'+m.file,'history/twenty-robot-caps/'+m.file]);
 assert.deepEqual(m.versions.map(v=>[v.tiles,v.machines]),[[1092,56],[1071,55],[1071,55]]);
 for(const v of m.versions)for(const side of ['steady','recovery'])for(const item of Object.keys(v.outputsPerMinute[side]))assert(v.outputsPerMinute[side][item]>=targets[item]*.95,`${v.label} ${side} ${item}`);
 assert.deepEqual(Object.keys(m.versions[0].outputsPerMinute.steady).sort(),sorted(products));
 // Stack sizes and chest slots (needs the prototype dump; skipped without it).
 const rawPath=process.env.FACTORIO_RAW||rawDefault;
 const bytes=await fs.readFile(rawPath).catch(()=>null);
 if(bytes){const raw=JSON.parse(bytes);let slots=0;for(const item of products){assert.equal(caps[item],raw.item[item].stack_size,`${item} cap is one full stack`);slots+=Math.ceil(caps[item]/raw.item[item].stack_size);}assert(slots<=raw['logistic-container']['passive-provider-chest'].inventory_size);
  // The reason for the separate inserter: every inserter holds at most five filters.
  for(const [name,i] of Object.entries(raw.inserter))assert(i.filter_count<=5,name);}
});
