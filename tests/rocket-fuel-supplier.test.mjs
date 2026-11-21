// rocket-fuel-supplier: manifest, string, native report and layout rules (CONTRACT sections 3-13, rocket-fuel-supplier.md).
// Runs without the prototype dump: sizes and items come from inline tables; only the regeneration test needs the dump.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const id='rocket-fuel-supplier';
const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir=`blueprint-sources/${id}/`;
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
// A missing or stale report must fail, not skip: read it inside the tests that need it.
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const allowed=new Set(['assembling-machine-2','chemical-plant','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','pipe','pipe-to-ground','passive-provider-chest','substation','medium-electric-pole','constant-combinator','arithmetic-combinator','decider-combinator','display-panel']);
// Selection-box sizes (1x1 unless listed), rotated for east/west; the item that places each entity is its own name.
const size={'assembling-machine-2':[3,3],'chemical-plant':[3,3],substation:[2,2],'decider-combinator':[1,2],'arithmetic-combinator':[1,2]};
const tile=e=>[Math.floor(e.position.x),Math.floor(e.position.y)];
const vec=d=>({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d||0];
const reachOf=e=>e.name==='long-handed-inserter'?2:1;
// direction is the side an arm picks from: pick = tile + v * reach, drop = tile - v * reach.
const pickTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x+dx*r,y+dy*r];};
const dropTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x-dx*r,y-dy*r];};
const box=e=>{let[w,h]=size[e.name]||[1,1];if([4,12].includes(e.direction))[w,h]=[h,w];return{left:e.position.x-w/2,right:e.position.x+w/2,top:e.position.y-h/2,bottom:e.position.y+h/2};};
const covers=(e,x,y)=>{const b=box(e);return x+.5>b.left&&x+.5<b.right&&y+.5>b.top&&y+.5<b.bottom;};
const entityAt=(x,y)=>entities.find(e=>covers(e,x,y));
const fmt=n=>String(Math.round(n*10)/10);

test('one record; product, target, cap, nominal demand and machines are the spec values',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,id);assert.equal(m.file,id+'.txt');assert.equal(m.class,'rate');assert.equal(m.name,'Rocket-fuel supplier · 6/min');assert.equal(bp.label,m.name);
 assert.deepEqual(m.products,['rocket-fuel']);assert.deepEqual(m.targets,{'rocket-fuel':6});assert.deepEqual(m.outputCaps,{'rocket-fuel':8});
 assert.deepEqual(m.recipeAudit.externalPerMinute,{'light-oil':660});
 assert.deepEqual(m.recipeAudit.craftsPerMinute,{'rocket-fuel':6,'solid-fuel-from-light-oil':60});
 assert.deepEqual(m.machineCounts,{'rocket-fuel':2,'solid-fuel-from-light-oil':1});
 assert.deepEqual(m.loopControl,[]);assert.equal(m.stockControl.mode,'belt-exit');assert.equal(m.stockControl.exit,m.outputs[0].entity);
 assert.deepEqual(m.protocol,{warmupMinutes:15,measureMinutes:30,blockedMinutes:10,settleMinutes:5,recoveryMinutes:10});
 assert.equal(bp.version,562954249961473);assert.deepEqual(bp.icons.map(i=>i.signal.name),['rocket-fuel']);
 assert(['qualified','native-validation-pending'].includes(m.status));
});

test('blueprint, native report, prototypes, harness and validator hashes agree',async()=>{
 const report=await loadReport();
 const evidence=report.builds.find(b=>b.id===m.id);
 assert(evidence,'native build evidence missing');
 assert.equal(hash(code),m.blueprintSha256);
 assert.equal(evidence.blueprintSha256,m.blueprintSha256,'native report is stale for blueprint');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);
 assert.equal(report.gameVersion,'2.1.24');
 assert(!report.short,'an exploration report is not a qualification');
 assert.equal(report.harnessSha256,hash(await read(`scripts/${id}/control.lua`)),'native harness changed since report');
 assert.equal(report.validatorSha256,hash(await read(`scripts/${id}/validate.mjs`)),'validator changed since report');
 for(const field of ['dataHarnessSha256','configurationSha256'])assert.match(report[field],/^[a-f0-9]{64}$/);
 for(const[k,v]of Object.entries(m.protocol))assert.equal(report.protocolMinutes[k],v,'report protocol '+k);
});

test('native report passes the rate-class formula, recomputed from its numbers',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id);
 assert.equal(m.status,'qualified');assert.equal(report.passed,true);assert.equal(r.passed,true);
 assert(Object.values(r.checks).every(Boolean),'every named check passed');
 const floor=m.targets['rocket-fuel']*.95;
 assert(r.outputsPerMinute['rocket-fuel']>=floor,'steady rate');assert(r.recovery.outputsPerMinute['rocket-fuel']>=floor,'recovery rate');
 assert.equal(r.machines.length,3);assert.equal(r.gateWiringChecked,true,'exit gate wiring checked natively');assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 for(const x of r.machines)assert(x.measuredCrafts>=.95*m.protocol.measureMinutes*60*x.nativeCraftingSpeed/x.nativeRecipeEnergy,'full-rate crafts '+x.entity);
 assert.equal(r.inputs.length,0);
 assert.equal(r.fluids.length,1);assert(r.fluids.every(p=>p.acceptedDuringMeasurement>0&&p.productiveConsumers.length===3&&p.connectedConsumers.length===3),'light oil reaches and feeds all three machines');
 assert(r.outputPorts.every(p=>p.collectedDuringMeasurement>0),'output delivered');
 assert(r.blocked.collectionPauseStock.every(p=>p.count===8&&p.capacity===8&&p.maxDuringBlocked<=8),'exit holds exactly 8');
 assert(r.blocked.collectionPauseStock.every(p=>p.lanes[0]===4&&p.lanes[1]===4),'4 per lane');
 assert(r.blocked.machinesStoppedInLastMinute,'machines stop while blocked');
 assert(r.powered&&r.externalApproachesClear&&r.exactRecipeChecks>0&&r.importedEntities===entities.length);
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);
 // Throttled feeding: every entrance drew at most its panel figure.
 for(const p of [...r.inputs,...r.fluids]){const port=m.ports.find(q=>q.entity===p.entity);assert(p.measuredPerMinute<=port.perMinute+1e-6,'draw within panel '+p.item);}
 assert.equal(m.measured.steadyPerMinute,r.outputsPerMinute['rocket-fuel']);
});

test('one west light-oil pipe entrance with its panel; one east belt exit on the bottom row',()=>{
 const inputs=m.ports.filter(p=>p.kind==='input'),fluids=m.ports.filter(p=>p.kind==='fluid');
 assert.deepEqual(inputs,[]);assert.deepEqual(fluids.map(p=>p.item),['light-oil']);
 assert.deepEqual(m.inputs,inputs);assert.deepEqual(m.fluids,fluids);
 assert.equal(entities.filter(e=>e.name==='display-panel').length,1);
 for(const p of fluids){
  const e=byId.get(p.entity);assert.equal(e.name,'pipe');assert.equal(p.direction,undefined);
  assert.equal(p.externalSide,'west');assert.deepEqual(p.items,[p.item]);
  assert.equal(p.nominalPerMinute,660);assert.equal(p.nominalPerMinute,m.recipeAudit.externalPerMinute[p.item]);assert(p.perMinute>=p.nominalPerMinute,'supply at or above nominal');
  const panel=byId.get(p.displayEntity);assert.equal(panel.name,'display-panel');assert.equal(panel.always_show,true);
  assert.deepEqual(panel.icon,{type:'fluid',name:p.item});
  assert.equal(panel.text,`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min`);
  const [px,py]=tile(e),[lx,ly]=tile(panel);assert(Math.hypot(px-lx,py-ly)<=4,'panel within 4 tiles');assert(!(ly===py&&lx<px),'panel not west of the entrance on its row');
  for(let k=1;k<=3;k++)assert(!entityAt(px-k,py),'west approach clear');
  assert.equal(px,m.footprint.left,'entrance on the west edge');
 }
 const outputs=m.ports.filter(p=>p.kind==='output');assert.equal(outputs.length,1);assert.deepEqual(m.outputs,outputs);
 const o=outputs[0];assert.equal(o.item,'rocket-fuel');assert.equal(o.externalSide,'east');assert.equal(o.transport,'belt');assert.equal(o.cap,8);assert.equal(o.direction,4);
 const exit=byId.get(o.entity);assert.equal(exit.name,'fast-transport-belt');assert.equal(exit.direction,4);
 const [ex,ey]=tile(exit);
 const behind=entityAt(ex-1,ey);assert(behind&&behind.name==='fast-transport-belt'&&behind.direction===4,'exit fed straight from behind');
 for(const y of [ey-1,ey+1]){const side=entityAt(ex,y);assert(!(side&&/belt/.test(side.name)&&side.direction===(y<ey?8:0)),'nothing side-loads the exit');}
 for(let k=1;k<=3;k++)assert(!entityAt(ex+k,ey),'east approach clear');
 assert.equal(ex+1,m.footprint.right,'exit on the east edge');assert.equal(ey,m.footprint.bottom-1,'exit on the bottom row');
 assert.deepEqual(m.supplierLinks,[{consumer:'rocket-supplies',item:'rocket-fuel',exitRowFromTop:ey-m.footprint.top,perMinute:6}]);
 const power=m.ports.filter(p=>p.kind==='power');assert.equal(power.length,1);assert.equal(byId.get(power[0].entity).name,'substation');
 assert.equal(entities.filter(e=>e.name==='substation').length,1);
 // The only wires: red, from the exit tile (hold reader) to the two solid-fuel arms, each span at most 8 tiles.
 const gate=m.stockControl.gate;assert.equal(gate.reader,o.entity);assert.equal(gate.readerMode,'per-tile-hold');
 assert.deepEqual(exit.control_behavior,{circuit_read_hand_contents:true,circuit_contents_read_mode:1});
 assert.equal(bp.wires.length,2);const net=new Set([o.entity]);
 for(const w of bp.wires){assert.equal(w[1],1);assert.equal(w[3],1);const a=byId.get(w[0]),b=byId.get(w[2]);assert(Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y)<=8,'wire span');net.add(w[0]);net.add(w[2]);}
 assert.deepEqual([...net].sort((a,b)=>a-b),[o.entity,...gate.arms].sort((a,b)=>a-b));
 for(const armId of gate.arms){const arm=byId.get(armId);assert.deepEqual(arm.control_behavior,{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:'rocket-fuel',quality:'normal'},comparator:'<',constant:8}});}
});

test('allowed entities, arm settings, machines, hand-offs and the lanes of the two output arms',()=>{
 for(const e of entities){
  assert(allowed.has(e.name),e.name);assert.equal(e.quality??'normal','normal');
  assert(!/-module/.test(JSON.stringify(e.items??{})),'installed module '+e.entity_number);
  if(e.name==='fast-inserter'||e.name==='long-handed-inserter')assert.equal(e.override_stack_size,1);
  if(e.name==='bulk-inserter')assert.equal(e.override_stack_size,2);
  if(e.name==='chemical-plant')assert.equal(e.recipe,'solid-fuel-from-light-oil');
  if(e.recipe==='rocket-fuel')assert.equal(e.name,'assembling-machine-2');
  assert.equal(e.tags?.flight_science_entity,e.entity_number);
 }
 assert(!entities.some(e=>e.recipe&&!['rocket-fuel','solid-fuel-from-light-oil'].includes(e.recipe)),'no other recipe (no circuits, no concrete)');
 assert(!entities.some(e=>/chest|combinator|medium-electric-pole/.test(e.name)),'no chests, combinators or medium poles');
 const counts={};for(const e of entities)if(e.recipe)counts[e.recipe]=(counts[e.recipe]||0)+1;assert.deepEqual(counts,m.machineCounts);
 const plant=entities.find(e=>e.name==='chemical-plant'),fuel=entities.filter(e=>e.recipe==='rocket-fuel');
 // Hand-offs: each gated arm picks from the plant and drops into a different rocket-fuel machine.
 assert.deepEqual(m.armRoles.handOff,m.stockControl.gate.arms);
 const fed=m.armRoles.handOff.map(i=>byId.get(i)).map(a=>{assert.equal(a.name,'fast-inserter');assert.equal(entityAt(...pickTile(a)),plant);return entityAt(...dropTile(a));});
 assert.deepEqual(new Set(fed),new Set(fuel));
 // Output arms: one drops onto a south-running column from the north (right lane, the exit's south lane after
 // the corner); the other drops onto the corner tile from the west (north lane). Measured natively (lane probe).
 assert.equal(m.armRoles.output.length,2);
 const outs=m.armRoles.output.map(i=>byId.get(i)).map(a=>{assert(fuel.includes(entityAt(...pickTile(a))));return{arm:a,to:entityAt(...dropTile(a))};});
 const column=outs.find(d=>d.arm.direction===0&&d.to.direction===8),corner=outs.find(d=>d.arm.direction===12&&d.to.direction===4);
 assert(column&&corner,'one column drop, one corner drop');
 const [cx,cy]=tile(corner.to);assert.equal(entityAt(cx,cy-1).direction,8,'corner is fed by the column');assert.equal(tile(column.to)[0],cx);
 assert.equal(entityAt(cx-1,cy),corner.arm,'nothing feeds the corner from behind: it is a curve');
 assert.equal(cy,m.footprint.bottom-1,'corner on the exit row');
});

test('footprint, area goal and bill of materials recomputed from the decoded string',()=>{
 const bs=entities.map(box);
 const f={left:Math.min(...bs.map(b=>b.left)),top:Math.min(...bs.map(b=>b.top)),right:Math.max(...bs.map(b=>b.right)),bottom:Math.max(...bs.map(b=>b.bottom))};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);
 assert.equal(m.areaGoal.achievedTiles,f.width*f.height);
 assert.deepEqual({goal:m.areaGoal.goalTiles,stretch:m.areaGoal.stretchTiles,fallback:m.areaGoal.fallbackTiles},{goal:78,stretch:66,fallback:110});
 assert(m.areaGoal.achievedTiles<=m.areaGoal.stretchTiles,'meets the stretch goal');
 const bill={};for(const e of entities)bill[e.name]=(bill[e.name]||0)+1;
 assert.deepEqual(m.billOfMaterials.items,bill);assert.deepEqual(m.construction,Object.fromEntries(Object.entries(bill).sort()));
 assert.equal(bp.tiles,undefined,'no tiles');
});

test('generator is reproducible and leaves the published folder byte-identical',async t=>{
 // Skip only when the dump cannot be opened (a machine without it, or the dump made unreadable).
 if(!await fs.open(rawPath,'r').then(h=>h.close().then(()=>true),()=>false)){t.skip('Pinned local prototype dump is not readable here (set FACTORIO_RAW); regeneration not checked');return;}
 const out=`.cache/${id}/test-regenerate`;
 await fs.mkdir(new URL(out+'/',root),{recursive:true});
 await fs.copyFile(new URL(dir+'native-report.json',root),new URL(out+'/native-report.json',root));
 await promisify(execFile)(process.execPath,[`scripts/${id}/generate.mjs`,'--variant',m.variant,'--supply',m.supply,'--out',out],{cwd:rootPath});
 assert.equal((await read(out+'/'+id+'.txt')).toString(),(await read(dir+id+'.txt')).toString());
 assert.equal((await read(out+'/manifest.json')).toString(),(await read(dir+'manifest.json')).toString());
});
