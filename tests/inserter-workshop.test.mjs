import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root=new URL('../blueprint-sources/inserter-workshop/',import.meta.url);
const scripts=new URL('../scripts/inserter-workshop/',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=async(name,base=root)=>JSON.parse(await fs.readFile(new URL(name,base)));
const [m]=await json('manifest.json');
const code=(await fs.readFile(new URL(m.file,root),'utf8')).trim();
const b=decodeBlueprint(code).blueprint;
const report=await json('native-report.json'),[r]=report.builds;
const at=(x,y)=>b.entities.find(e=>e.position.x===x+.5&&e.position.y===y+.5);
const condition=e=>e.control_behavior?.circuit_condition;
const FIRST_RING='history/first-ring-b69ef44b/';

test('frozen inserter mall has matching native production, independent caps and demand recovery',async()=>{
 assert.equal((await json('manifest.json')).length,1);
 assert.equal(sha(code),m.blueprintSha256);
 assert.equal(b.entities.filter(e=>e.name==='assembling-machine-2').length,12);
 assert.deepEqual(m.inputs.map(p=>p.item).sort(),['copper-plate','iron-plate','plastic-bar']);assert(m.inputs.every(p=>p.externalSide==='west'));assert(m.outputs.every(p=>p.externalSide==='east'));
 assert(b.entities.every(e=>!e.items?.length&&!e.name.startsWith('express-')&&e.name!=='stack-inserter'));
 assert.equal(report.harnessSha256,sha(await fs.readFile(new URL('control.lua',scripts))));assert.equal(report.validatorSha256,sha(await fs.readFile(new URL('validate.mjs',scripts))));assert(report.passed);
 assert.equal(report.protocol,'standard');assert.equal(report.supplyPerMinute,undefined);assert.equal(report.warmupMinutes,10);assert.equal(report.measurementMinutes,10);assert.equal(r.recovery.blockedMinutes,5);
 assert.equal(r.blueprintSha256,m.blueprintSha256);assert.equal(report.prototypeSha256,m.prototypeSha256);assert.equal(m.status,'native-verified-declared-inputs');assert.equal(m.nativeReport,'native-report.json');
 assert(r.powered&&r.externalApproachesClear&&r.stockGateChecks>0);assert(r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute.length));assert(r.machines.every(p=>p.measuredCrafts>0));
 for(const n of m.products){assert(r.outputsPerMinute[n]>=m.targets[n]*.95);assert(r.recovery.outputsPerMinute[n]>=m.targets[n]*.95);const port=m.outputs.find(p=>p.item===n);assert.equal(port.cap,m.outputCaps[n]);const stock=r.stockReplenishment.find(s=>s.item===n);assert.equal(stock.restored,port.cap);assert(stock.newCrafts>0&&stock.otherProvidersStayedFull);}
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);assert(r.bulkInserters.some(p=>p.observedMaxHand===2));assert(r.bulkInserters.every(p=>p.observedMaxHand<=2));
});

test('the interface is the first version\'s: same products, targets, caps, materials, sides and order',async()=>{
 const [old]=await json(FIRST_RING+'manifest.json');
 assert.deepEqual(m.products,old.products);assert.deepEqual(m.targets,old.targets);assert.deepEqual(m.outputCaps,old.outputCaps);
 assert.deepEqual(m.inputs.map(p=>[p.item,p.externalSide]),old.inputs.map(p=>[p.item,p.externalSide]));
 assert.deepEqual(m.outputs.map(p=>[p.item,p.externalSide,p.cap,p.reserve]),old.outputs.map(p=>[p.item,p.externalSide,p.cap,p.reserve]));
 // Entrances down the west edge in the order iron, copper, plastic; chests down the east edge in tier order.
 const rows=ports=>ports.map(p=>p.position.y);
 for(const ports of [m.inputs,m.outputs,old.inputs,old.outputs])assert.deepEqual(rows(ports),[...rows(ports)].sort((p,q)=>p-q));
 assert(m.inputs.every(p=>p.position.x===m.footprint.left+.5),'every entrance is on the west edge');
 assert(m.outputs.every(p=>p.position.x===m.footprint.right-.5),'every chest is on the east edge');
 for(const p of m.inputs){const e=b.entities.find(e=>e.entity_number===p.entity);assert.equal(e.name,'fast-transport-belt');assert.equal(e.direction,4);}
 for(const p of m.outputs){const e=b.entities.find(e=>e.entity_number===p.entity);assert.equal(e.name,'passive-provider-chest');assert.equal(e.bar,1,'one stack: a cap of 50');}
 // Same entity tiers: assembling machine 2, red belts, bulk and long-handed arms, substations, no modules.
 const allowed=new Set(['assembling-machine-2','fast-transport-belt','fast-underground-belt','bulk-inserter','long-handed-inserter','passive-provider-chest','substation','display-panel','arithmetic-combinator','constant-combinator']);
 assert(b.entities.every(e=>allowed.has(e.name)&&!e.items&&(e.quality??'normal')==='normal'));
 assert(b.entities.filter(e=>e.name==='bulk-inserter').every(e=>e.override_stack_size===2));
});

test('the layout is the 22 x 15 single ring with twelve assemblers',()=>{
 assert.deepEqual(m.footprint,{left:-2,top:-4,right:20,bottom:11,width:22,height:15});
 assert.deepEqual(m.machineCounts,{inserter:1,'long-handed-inserter':1,'fast-inserter':1,'bulk-inserter':1,'advanced-circuit':1,'copper-cable':3,'electronic-circuit':2,'iron-gear-wheel':2});
 const count=name=>b.entities.filter(e=>e.name===name).length;
 assert.deepEqual(m.construction,Object.fromEntries([...new Set(b.entities.map(e=>e.name))].map(n=>[n,count(n)])));
 assert.equal(count('substation'),3);assert.equal(count('fast-splitter'),0);assert.equal(count('display-panel'),3);
 // No two entities share a tile.
 const tiles=new Set();
 for(const e of b.entities){const size={'assembling-machine-2':[3,3],substation:[2,2],'arithmetic-combinator':[2,1]}[e.name]||[1,1];
  for(let x=Math.round(e.position.x-size[0]/2);x<e.position.x+size[0]/2;x++)for(let y=Math.round(e.position.y-size[1]/2);y<e.position.y+size[1]/2;y++){assert(!tiles.has(x+','+y),'overlap at '+x+','+y);tiles.add(x+','+y);}}
 // The ring: 42 pieces, each flowing into the next, closed; two tiles bridged for the long-handed cable arms.
 const [loop]=m.loopControl,ring=loop.loop.map(id=>b.entities.find(e=>e.entity_number===id));
 assert.equal(ring.length,42);assert.equal(loop.capacity,336);
 const step={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]};
 ring.forEach((e,i)=>{const next=ring[(i+1)%ring.length],[dx,dy]=step[e.direction],reach=e.name==='fast-underground-belt'&&e.type==='input'?2:1;
  assert.equal(next.position.x,e.position.x+dx*reach);assert.equal(next.position.y,e.position.y+dy*reach);});
 assert.equal(ring.filter(e=>e.name==='fast-underground-belt').length,4);
 for(const [x,y] of [[15,0],[11,6]]){const bridge=at(x,y);assert.equal(bridge.name,'long-handed-inserter');assert.deepEqual(bridge.filters.map(f=>f.name),['copper-cable']);}
 const reader=b.entities.find(e=>e.entity_number===loop.reader);assert.deepEqual(reader.control_behavior,{circuit_read_hand_contents:true,circuit_contents_read_mode:2});
 // Every stock gate carries its manifest cap, the caps leave lane headroom, and every gated arm is on the reader's red wire.
 assert.equal(loop.maximumStock,Object.values(loop.limits).reduce((p,q)=>p+q,0));assert(loop.maximumStock<loop.capacity*.85);
 const stockGates=b.entities.filter(e=>condition(e)?.comparator==='<'&&condition(e).first_signal.type==='item');
 for(const e of stockGates){assert.equal(condition(e).constant,loop.limits[condition(e).first_signal.name]);assert(loop.controlled.includes(e.entity_number));}
 for(const name of Object.keys(loop.limits))assert(stockGates.some(e=>condition(e).first_signal.name===name),'no gate for '+name);
 const network=new Set([loop.reader]);for(let grew=true;grew;){grew=false;for(const [p,pc,q,qc] of b.wires)if(pc===1&&qc===1&&network.has(p)!==network.has(q)){network.add(p);network.add(q);grew=true;}}
 for(const id of loop.controlled)assert(network.has(id),'gated arm off the ring wire: '+id);
 // Export arms keep the upgrade reserves.
 for(const p of m.outputs){const arm=at(p.position.x-1.5,p.position.y-.5);assert.deepEqual(arm.filters.map(f=>f.name),[p.item]);
  if(p.reserve)assert.deepEqual([condition(arm).first_signal.name,condition(arm).comparator,condition(arm).constant],[p.item,'>',p.reserve]);else assert.equal(arm.control_behavior,undefined);}
 // Iron reaches both gear assemblers and the inside of the ring by a buried branch; one arm there lays it on the ring.
 assert.equal(at(13,4).name,'fast-underground-belt');assert.equal(at(13,4).type,'output');
 const riser=at(13,5);assert.deepEqual(riser.filters.map(f=>f.name),['iron-plate']);assert.equal(riser.direction,0);assert.equal(condition(riser).constant,loop.limits['iron-plate']);
 for(const [x,y] of [[0,9],[14,9]])assert.deepEqual(at(x,y).filters.map(f=>f.name),['iron-plate']);
});

test('the clock is bounded and shares the ring between the three small tiers',()=>{
 const {clock}=m.loopControl[0],entity=id=>b.entities.find(e=>e.entity_number===id);
 const one=entity(clock.constant),counter=entity(clock.timer),phase=entity(clock.phase);
 assert.equal(one.name,'constant-combinator');assert.deepEqual(one.control_behavior.sections.sections[0].filters.map(f=>[f.name,f.count]),[['signal-T',1]]);
 // (counter + 1) modulo the period: the count can never reach the 32-bit limit that stops a free-running counter's fast tier.
 assert.deepEqual(counter.control_behavior.arithmetic_conditions,{first_signal:{type:'virtual',name:'signal-T'},second_constant:1800,operation:'%',output_signal:{type:'virtual',name:'signal-T'}});
 assert.deepEqual(phase.control_behavior.arithmetic_conditions,{first_signal:{type:'virtual',name:'signal-T'},second_constant:150,operation:'/',output_signal:{type:'virtual',name:'signal-P'}});
 const has=(...w)=>b.wires.some(x=>JSON.stringify(x)===JSON.stringify(w));
 assert(has(one.entity_number,1,counter.entity_number,1)&&has(counter.entity_number,3,counter.entity_number,1)&&has(counter.entity_number,4,phase.entity_number,2));
 assert.equal(b.entities.filter(e=>e.name==='arithmetic-combinator').length,2);
 assert.deepEqual([clock.periodTicks,clock.windowTicks,clock.phases],[1800,150,12]);
 const gates=recipe=>{const machine=b.entities.find(e=>e.recipe===recipe);return [-1,0].map(dx=>at(machine.position.x-.5+dx,-1)).map(e=>condition(e)&&[condition(e).first_signal.name,condition(e).comparator,condition(e).constant]);};
 assert.deepEqual(gates('inserter'),[['signal-P','<',10],['signal-P','<',10]]);assert.deepEqual(clock.normalPhases,[0,1,2,3,4,5,6,7,8,9]);
 assert.deepEqual(gates('long-handed-inserter'),[['signal-P','<',5],['signal-P','<',5]]);assert.deepEqual(clock.longPhases,[0,1,2,3,4]);
 assert.deepEqual(gates('fast-inserter'),[['signal-P','>',5],['signal-P','>',5]]);assert.deepEqual(clock.fastPhases,[6,7,8,9,10,11]);
 assert.deepEqual(gates('bulk-inserter'),[undefined,undefined]);
 // Natively every one of the twelve phases came round during the measurement.
 assert.deepEqual(Object.keys(r.loopSamples['inserter-workshop'].phaseSeconds).map(Number).sort((p,q)=>p-q),clock.bulkPhases);
});

test('it replaces the first version: smaller, one assembler fewer, and no rate lower',async()=>{
 const [old]=await json(FIRST_RING+'manifest.json'),oldReport=await json(FIRST_RING+'native-report.json'),[oldRun]=oldReport.builds;
 const oldCode=(await fs.readFile(new URL(FIRST_RING+old.file,root),'utf8')).trim();
 assert.equal(sha(oldCode),'b69ef44b7d7fe704407a47e9afd2a91f07cfcd2e1b5059b3a66823394d4e0876');assert.equal(old.blueprintSha256,sha(oldCode));assert.equal(oldRun.blueprintSha256,sha(oldCode));assert(oldReport.passed);
 assert((await fs.readFile(new URL(FIRST_RING+'NOTE.md',root),'utf8')).trim().split('\n').length===1);
 const area=f=>f.width*f.height,machines=x=>Object.values(x.machineCounts).reduce((p,q)=>p+q,0);
 assert.equal(area(old.footprint),442);assert.equal(area(m.footprint),330);assert(area(m.footprint)<=area(old.footprint)*.95);
 assert.equal(machines(old),13);assert.equal(machines(m),12);assert(m.construction.substation<old.construction.substation);
 for(const n of m.products){assert(r.outputsPerMinute[n]>=oldRun.outputsPerMinute[n],n+' steady rate fell');assert(r.recovery.outputsPerMinute[n]>=oldRun.recovery.outputsPerMinute[n],n+' recovery rate fell');}
 // No arm is dead and no machine waits for an ingredient through the whole run.
 assert(r.bulkInserters.every(p=>p.observedMaxHand>0));
 for(const machine of r.machines)assert(machine.statusSamples.working>0);
 assert(r.loopSamples['inserter-workshop'].maxStock<m.loopControl[0].capacity*.9);
});

test('the stated supply is honest and a long hold does no harm',async()=>{
 // Stated: the measured full-drain draw, rounded up. Recipe arithmetic for the targets is kept beside it.
 assert.deepEqual(m.requiredInputsPerMinute,{'iron-plate':630,'copper-plate':275,'plastic-bar':7});
 assert.deepEqual(m.nominalInputsPerMinute,{'iron-plate':422.5,'copper-plate':192.5,'plastic-bar':5});
 assert.deepEqual(m.requestedInputsPerMinute,{'iron-plate':560,'copper-plate':272.5,'plastic-bar':10});
 for(const [item,rate] of Object.entries(m.requiredInputsPerMinute)){assert(r.consumptionPerMinute[item]<=rate,item+' draws more than stated');assert(r.consumptionPerMinute[item]>=m.nominalInputsPerMinute[item]);}
 // Fed exactly the stated figures instead of full belts, the same string passes the same checks.
 const stated=await json('probe-stated-supply-report.json'),[s]=stated.builds;
 assert.equal(stated.protocol,'probe');assert.deepEqual(stated.supplyPerMinute,m.requiredInputsPerMinute);assert.equal(s.blueprintSha256,m.blueprintSha256);assert(stated.passed&&s.passed);
 assert.equal(stated.harnessSha256,report.harnessSha256);assert.equal(stated.validatorSha256,report.validatorSha256);
 for(const p of s.inputs)assert(p.acceptedDuringMeasurement<=m.requiredInputsPerMinute[p.item]*stated.measurementMinutes+1,'the probe offered more than stated');
 for(const n of m.products){assert(s.outputsPerMinute[n]>=m.targets[n]*.95);assert(s.recovery.outputsPerMinute[n]>=m.targets[n]*.95);}
 assert.equal(s.stockReplenishment.length,4);assert(s.stockReplenishment.every(x=>x.restored===50&&x.newCrafts>0&&x.otherProvidersStayedFull));
 // Recorded weakness: at the recipe figures for the targets a full drain starves the long-handed and bulk tiers.
 const nominal=await json('probe-nominal-supply-report.json'),[n]=nominal.builds;
 assert.equal(nominal.protocol,'probe');assert.deepEqual(nominal.supplyPerMinute,m.nominalInputsPerMinute);assert.equal(n.blueprintSha256,m.blueprintSha256);assert.equal(nominal.passed,false);
 assert(n.outputsPerMinute['long-handed-inserter']<m.targets['long-handed-inserter']*.95&&n.outputsPerMinute['bulk-inserter']<m.targets['bulk-inserter']*.95);
 assert(n.stockReplenishment.every(x=>x.restored===50),'on-demand refills still complete at the nominal supply');
 // Thirty minutes with every chest full and uncollected, then the same recovery and refill checks.
 const hold=await json('probe-long-block-report.json'),[h]=hold.builds;
 assert.equal(hold.protocol,'probe');assert.equal(h.blueprintSha256,m.blueprintSha256);assert(hold.passed&&h.passed);assert.equal(h.recovery.blockedMinutes,30);
 assert.equal(hold.harnessSha256,report.harnessSha256);
 for(const stock of h.recovery.collectionPauseStock)assert.equal(stock.count,50);
 for(const n of m.products)assert(h.recovery.outputsPerMinute[n]>=m.targets[n]*.95);
 assert(h.loopSamples['inserter-workshop'].maxStock<m.loopControl[0].capacity*.9);
});

test('the generator reproduces the committed string and keeps its qualified status',async t=>{
 const raw=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
 if(!await fs.access(raw).then(()=>true,()=>false))return t.skip('prototype dump not on this machine');
 const project=fileURLToPath(new URL('..',import.meta.url)),out='.cache/inserter-workshop/test-regenerate';
 await fs.rm(project+out,{recursive:true,force:true});await fs.mkdir(project+out,{recursive:true});
 try{
  const run=()=>promisify(execFile)(process.execPath,['scripts/inserter-workshop/generate.mjs'],{cwd:project,env:{...process.env,FACTORIO_RAW:raw,INSERTER_WORKSHOP_OUT:out,INSERTER_WORKSHOP_TRY:''}});
  // Without a report the fresh string is pending; beside the committed report it is qualified, byte for byte.
  await run();
  assert.equal((await fs.readFile(project+out+'/'+m.file,'utf8')).trim(),code);
  assert.equal(JSON.parse(await fs.readFile(project+out+'/manifest.json'))[0].status,'native-validation-pending');
  await fs.copyFile(new URL('native-report.json',root),project+out+'/native-report.json');
  await run();await run();
  assert.equal(await fs.readFile(project+out+'/manifest.json','utf8'),await fs.readFile(new URL('manifest.json',root),'utf8'));
  assert.equal(await fs.readFile(project+out+'/'+m.file,'utf8'),await fs.readFile(new URL(m.file,root),'utf8'));
 }finally{await fs.rm(project+out,{recursive:true,force:true});}
});
