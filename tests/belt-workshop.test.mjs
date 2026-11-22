import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root=new URL('../blueprint-sources/belt-workshop/',import.meta.url);
const scripts=new URL('../scripts/belt-workshop/',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=async(name,base=root)=>JSON.parse(await fs.readFile(new URL(name,base)));
const [m]=await json('manifest.json');
const code=(await fs.readFile(new URL(m.file,root),'utf8')).trim();
const b=decodeBlueprint(code).blueprint;
const report=await json('native-report.json'),[r]=report.builds;
const at=(x,y)=>b.entities.find(e=>e.position.x===x+.5&&e.position.y===y+.5);
const condition=e=>e.control_behavior?.circuit_condition;
const RED=['fast-transport-belt','fast-underground-belt','fast-splitter'],YELLOW=['transport-belt','underground-belt','splitter'];

test('the belt workshop has matching native production, one-stack chests and demand recovery',async()=>{
 assert.equal((await json('manifest.json')).length,1);
 assert.equal(sha(code),m.blueprintSha256);
 assert.deepEqual(m.products,[...RED,...YELLOW]);
 assert.deepEqual(m.inputs.map(p=>p.item),['iron-plate','copper-plate']);assert(m.inputs.every(p=>p.externalSide==='west'));assert(m.outputs.every(p=>p.externalSide==='east'));
 assert(b.entities.every(e=>!e.items?.length&&!e.name.startsWith('express-')&&e.name!=='stack-inserter'));
 assert.equal(report.harnessSha256,sha(await fs.readFile(new URL('control.lua',scripts))));assert.equal(report.validatorSha256,sha(await fs.readFile(new URL('validate.mjs',scripts))));assert(report.passed);
 assert.equal(report.protocol,'standard');assert.equal(report.supplyPerMinute,undefined);assert.equal(report.warmupMinutes,10);assert.equal(report.measurementMinutes,10);assert.equal(r.recovery.blockedMinutes,5);
 assert.equal(r.blueprintSha256,m.blueprintSha256);assert.equal(report.prototypeSha256,m.prototypeSha256);assert.equal(m.status,'native-verified-declared-inputs');assert.equal(m.nativeReport,'native-report.json');
 assert(Object.values(r.checks).every(Boolean));
 assert(r.powered&&r.externalApproachesClear&&r.stockGateChecks>0);assert(r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute.length));assert(r.machines.every(p=>p.measuredCrafts>0));
 for(const n of m.products){
  assert(r.outputsPerMinute[n]>=m.targets[n]*.95,n+' steady');assert(r.recovery.outputsPerMinute[n]>=m.targets[n]*.95,n+' recovery');
  const port=m.outputs.find(p=>p.item===n);assert.equal(port.cap,m.outputCaps[n]);
  const stock=r.stockReplenishment.find(s=>s.item===n);assert.equal(stock.restored,port.cap);assert.equal(stock.withdrawn,port.cap/2);assert(stock.newCrafts>0&&stock.otherProvidersStayedFull);
 }
 assert.deepEqual(m.outputCaps,{'fast-transport-belt':100,'fast-underground-belt':50,'fast-splitter':50,'transport-belt':100,'underground-belt':50,splitter:50});
 // Held full: every chest exactly at its cap, no assembler crafting in the last minute, ring stock within its caps.
 assert.equal(r.recovery.collectionPauseStock.length,6);assert(r.recovery.collectionPauseStock.every(s=>s.count===s.capacity));
 assert(r.recovery.restAtPause.machines.every(x=>x.craftsInLastMinute===0));assert.deepEqual(r.recovery.restAtPause.overCap,[]);
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);assert(r.bulkInserters.some(p=>p.observedMaxHand===2));assert(r.bulkInserters.every(p=>p.observedMaxHand<=2));
 // The red belt has the largest share, and the workshop beats the essentials mall on every red product.
 assert(RED.every(n=>m.targets['fast-transport-belt']>m.targets[n]||n==='fast-transport-belt'));
 const mall={'fast-transport-belt':13.6,'fast-underground-belt':2,'fast-splitter':2.6};
 for(const n of RED)assert(m.targets[n]>mall[n],n+' does not beat the essentials mall');
});

test('the interface: plates in from the west once per material, six one-stack chests on the east',()=>{
 const rows=ports=>ports.map(p=>p.position.y);
 for(const ports of [m.inputs,m.outputs])assert.deepEqual(rows(ports),[...rows(ports)].sort((p,q)=>p-q));
 assert(m.inputs.every(p=>p.position.x===m.footprint.left+.5),'every entrance is on the west edge');
 assert(m.outputs.every(p=>p.position.x===m.footprint.right-.5),'every chest is on the east edge');
 for(const p of m.inputs){const e=b.entities.find(e=>e.entity_number===p.entity);assert.equal(e.name,'fast-transport-belt');assert.equal(e.direction,4);}
 for(const p of m.outputs){const e=b.entities.find(e=>e.entity_number===p.entity);assert.equal(e.name,'passive-provider-chest');assert.equal(e.bar,1,'one stack');}
 // One display panel per entrance.
 assert.deepEqual(b.entities.filter(e=>e.name==='display-panel').map(e=>e.icon.name),['iron-plate','copper-plate']);
 // The inserter workshop's tiers: assembling machine 2, red belts, bulk and long-handed arms, substations, no modules.
 const allowed=new Set(['assembling-machine-2','fast-transport-belt','fast-underground-belt','bulk-inserter','long-handed-inserter','passive-provider-chest','substation','display-panel','arithmetic-combinator','constant-combinator']);
 assert(b.entities.every(e=>allowed.has(e.name)&&!e.items&&(e.quality??'normal')==='normal'));
 assert(b.entities.filter(e=>e.name==='bulk-inserter').every(e=>e.override_stack_size===2));
 // Gears, wire and circuits are made inside: no entrance for them.
 for(const n of ['iron-gear-wheel','copper-cable','electronic-circuit'])assert(m.machineCounts[n]>0&&!m.inputs.some(p=>p.item===n));
});

test('the layout is one ring within 24 x 16 and 14 assemblers',()=>{
 assert(m.footprint.width<=24&&m.footprint.height<=16);
 const machines=Object.values(m.machineCounts).reduce((p,q)=>p+q,0);assert(machines<=14);
 assert.equal(b.entities.filter(e=>e.name==='assembling-machine-2').length,machines);
 const count=name=>b.entities.filter(e=>e.name===name).length;
 assert.deepEqual(m.construction,Object.fromEntries([...new Set(b.entities.map(e=>e.name))].map(n=>[n,count(n)])));
 // No two entities share a tile.
 const tiles=new Set();
 for(const e of b.entities){const size={'assembling-machine-2':[3,3],substation:[2,2],'arithmetic-combinator':[2,1]}[e.name]||[1,1];
  for(let x=Math.round(e.position.x-size[0]/2);x<e.position.x+size[0]/2;x++)for(let y=Math.round(e.position.y-size[1]/2);y<e.position.y+size[1]/2;y++){assert(!tiles.has(x+','+y),'overlap at '+x+','+y);tiles.add(x+','+y);}}
 // The ring: each piece flows into the next and it closes.
 const [loop]=m.loopControl,ring=loop.loop.map(id=>b.entities.find(e=>e.entity_number===id));
 assert.equal(loop.capacity,ring.length*8);
 const step={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]};
 ring.forEach((e,i)=>{const next=ring[(i+1)%ring.length],[dx,dy]=step[e.direction],reach=e.name==='fast-underground-belt'&&e.type==='input'?2:1;
  assert.equal(next.position.x,e.position.x+dx*reach);assert.equal(next.position.y,e.position.y+dy*reach);});
 const reader=b.entities.find(e=>e.entity_number===loop.reader);assert.deepEqual(reader.control_behavior,{circuit_read_hand_contents:true,circuit_contents_read_mode:2});
 // Every stock gate carries its manifest cap, the caps leave lane headroom, and every gated arm is on the reader's red wire.
 assert.equal(loop.maximumStock,Object.values(loop.limits).reduce((p,q)=>p+q,0));assert(loop.maximumStock<loop.capacity*.85);
 const stockGates=b.entities.filter(e=>condition(e)?.comparator==='<'&&condition(e).first_signal.type==='item');
 for(const e of stockGates){assert.equal(condition(e).constant,loop.limits[condition(e).first_signal.name]);assert(loop.controlled.includes(e.entity_number));}
 for(const name of Object.keys(loop.limits))assert(stockGates.some(e=>condition(e).first_signal.name===name),'no gate for '+name);
 const network=new Set([loop.reader]);for(let grew=true;grew;){grew=false;for(const [p,pc,q,qc] of b.wires)if(pc===1&&qc===1&&network.has(p)!==network.has(q)){network.add(p);network.add(q);grew=true;}}
 for(const id of loop.controlled)assert(network.has(id),'gated arm off the ring wire: '+id);
 // Each chest's export arm carries only its product.
 for(const p of m.outputs){const arm=at(p.position.x-1.5,p.position.y-.5);assert.deepEqual(arm.filters.map(f=>f.name),[p.item]);}
});

test('the clock is bounded and shares belts and circuits between the yellow makers',()=>{
 const {clock}=m.loopControl[0],entity=id=>b.entities.find(e=>e.entity_number===id);
 const one=entity(clock.constant),counter=entity(clock.timer),phase=entity(clock.phase);
 assert.equal(one.name,'constant-combinator');assert.deepEqual(one.control_behavior.sections.sections[0].filters.map(f=>[f.name,f.count]),[['signal-T',1]]);
 assert.deepEqual(counter.control_behavior.arithmetic_conditions,{first_signal:{type:'virtual',name:'signal-T'},second_constant:1800,operation:'%',output_signal:{type:'virtual',name:'signal-T'}});
 assert.deepEqual(phase.control_behavior.arithmetic_conditions,{first_signal:{type:'virtual',name:'signal-T'},second_constant:150,operation:'/',output_signal:{type:'virtual',name:'signal-P'}});
 const has=(...w)=>b.wires.some(x=>JSON.stringify(x)===JSON.stringify(w));
 assert(has(one.entity_number,1,counter.entity_number,1)&&has(counter.entity_number,3,counter.entity_number,1)&&has(counter.entity_number,4,phase.entity_number,2));
 assert.deepEqual([clock.periodTicks,clock.windowTicks,clock.phases],[1800,150,12]);
 // Every phase-gated arm reads the phase off the ring wire.
 const gated=b.entities.filter(e=>condition(e)?.first_signal.name==='signal-P');
 assert(gated.length>0);for(const e of gated)assert(m.loopControl[0].controlled.includes(e.entity_number)||b.wires.some(([p,pc,q,qc])=>pc===1&&qc===1&&(p===e.entity_number||q===e.entity_number)));
 // Natively every one of the twelve phases came round during the measurement.
 assert.deepEqual(Object.keys(r.loopSamples['belt-workshop'].phaseSeconds).map(Number).sort((p,q)=>p-q),Array.from({length:12},(_,i)=>i));
});

test('the stated supply is honest and a long hold does no harm',async()=>{
 for(const [item,rate] of Object.entries(m.requiredInputsPerMinute)){assert(r.consumptionPerMinute[item]<=rate,item+' draws more than stated');assert(rate>=m.nominalInputsPerMinute[item]);}
 // Fed exactly the stated figures instead of full belts, the same string passes the same checks.
 const stated=await json('probe-stated-supply-report.json'),[s]=stated.builds;
 assert.equal(stated.protocol,'probe');assert.deepEqual(stated.supplyPerMinute,m.requiredInputsPerMinute);assert.equal(s.blueprintSha256,m.blueprintSha256);assert(stated.passed&&s.passed);
 assert.equal(stated.harnessSha256,report.harnessSha256);assert.equal(stated.validatorSha256,report.validatorSha256);
 for(const p of s.inputs)assert(p.acceptedDuringMeasurement<=m.requiredInputsPerMinute[p.item]*stated.measurementMinutes+1,'the probe offered more than stated');
 for(const n of m.products){assert(s.outputsPerMinute[n]>=m.targets[n]*.95);assert(s.recovery.outputsPerMinute[n]>=m.targets[n]*.95);}
 assert.equal(s.stockReplenishment.length,6);
 // Thirty minutes with every chest full and uncollected, then the same recovery and refill checks.
 const hold=await json('probe-long-block-report.json'),[h]=hold.builds;
 assert.equal(hold.protocol,'probe');assert.equal(h.blueprintSha256,m.blueprintSha256);assert(hold.passed&&h.passed);assert.equal(h.recovery.blockedMinutes,30);
 assert.equal(hold.harnessSha256,report.harnessSha256);
 for(const stock of h.recovery.collectionPauseStock)assert.equal(stock.count,stock.capacity);
 assert(h.recovery.restAtPause.machines.every(x=>x.craftsInLastMinute===0));assert.deepEqual(h.recovery.restAtPause.overCap,[]);
 for(const n of m.products)assert(h.recovery.outputsPerMinute[n]>=m.targets[n]*.95);
 assert(h.loopSamples['belt-workshop'].maxStock<m.loopControl[0].capacity*.9);
});

test('the generator reproduces the committed string and keeps its qualified status',async t=>{
 const raw=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
 if(!await fs.access(raw).then(()=>true,()=>false))return t.skip('prototype dump not on this machine');
 const project=fileURLToPath(new URL('..',import.meta.url)),out='.cache/belt-workshop/test-regenerate';
 await fs.rm(project+out,{recursive:true,force:true});await fs.mkdir(project+out,{recursive:true});
 try{
  const run=()=>promisify(execFile)(process.execPath,['scripts/belt-workshop/generate.mjs'],{cwd:project,env:{...process.env,FACTORIO_RAW:raw,BELT_WORKSHOP_OUT:out,BELT_WORKSHOP_TRY:''}});
  // Without a report the fresh string is pending; beside the committed report it is qualified, byte for byte.
  await run();
  assert.deepEqual(decodeBlueprint(await fs.readFile(project+out+'/'+m.file,'utf8')),decodeBlueprint(code));
  assert.equal(JSON.parse(await fs.readFile(project+out+'/manifest.json'))[0].status,'native-validation-pending');
  // With the committed string beside it the generator keeps that string, even if this zlib compresses differently.
  await fs.copyFile(new URL(m.file,root),project+out+'/'+m.file);
  await fs.copyFile(new URL('native-report.json',root),project+out+'/native-report.json');
  await run();await run();
  assert.equal(await fs.readFile(project+out+'/manifest.json','utf8'),await fs.readFile(new URL('manifest.json',root),'utf8'));
  assert.equal(await fs.readFile(project+out+'/'+m.file,'utf8'),await fs.readFile(new URL(m.file,root),'utf8'));
 }finally{await fs.rm(project+out,{recursive:true,force:true});}
});
