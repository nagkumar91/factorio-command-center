// concrete-supplier: manifest, string, native report and layout rules (CONTRACT sections 3-13, concrete-supplier.md).
// Runs without the prototype dump: sizes and items come from inline tables; only the regeneration test needs the dump.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const id='concrete-supplier';
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
const allowed=new Set(['assembling-machine-2','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','pipe','pipe-to-ground','passive-provider-chest','substation','medium-electric-pole','constant-combinator','arithmetic-combinator','decider-combinator','display-panel']);
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
 assert.equal(m.id,id);assert.equal(m.file,id+'.txt');assert.equal(m.class,'rate');assert.equal(m.name,'Concrete supplier · 45/min');assert.equal(bp.label,m.name);
 assert.deepEqual(m.products,['concrete']);assert.deepEqual(m.targets,{concrete:45});assert.deepEqual(m.outputCaps,{concrete:8});
 assert.deepEqual(m.recipeAudit.externalPerMinute,{'stone-brick':22.5,'iron-ore':4.5,water:450});
 assert.deepEqual(m.recipeAudit.craftsPerMinute,{concrete:4.5});
 assert.deepEqual(m.machineCounts,{concrete:1});
 assert.deepEqual(m.loopControl,[]);assert.equal(m.stockControl.mode,'belt-exit');assert.equal(m.stockControl.exit,m.outputs[0].entity);
 assert.deepEqual(m.protocol,{warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10});
 assert.equal(bp.version,562954249961473);assert.deepEqual(bp.icons.map(i=>i.signal.name),['concrete']);
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
 const floor=m.targets.concrete*.95;
 assert(r.outputsPerMinute.concrete>=floor,'steady rate');assert(r.recovery.outputsPerMinute.concrete>=floor,'recovery rate');
 assert.equal(r.machines.length,1);assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 for(const x of r.machines)assert(x.measuredCrafts>=.95*m.protocol.measureMinutes*60*x.nativeCraftingSpeed/x.nativeRecipeEnergy,'full-rate crafts '+x.entity);
 assert.equal(r.inputs.length,2);assert(r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute.length>0),'belt entrances productive');
 assert.equal(r.fluids.length,1);assert(r.fluids.every(p=>p.acceptedDuringMeasurement>0&&p.productiveConsumers.length>0),'water productive');
 assert(r.outputPorts.every(p=>p.collectedDuringMeasurement>0),'output delivered');
 assert(r.blocked.collectionPauseStock.every(p=>p.count===8&&p.capacity===8&&p.maxDuringBlocked<=8),'exit holds exactly 8');
 assert(r.blocked.collectionPauseStock.every(p=>p.lanes[0]===4&&p.lanes[1]===4),'4 per lane');
 assert(r.blocked.machinesStoppedInLastMinute,'machine stops while blocked');
 assert(r.powered&&r.externalApproachesClear&&r.exactRecipeChecks>0&&r.importedEntities===entities.length);
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);
 // Throttled feeding: every entrance drew at most its panel figure.
 for(const p of [...r.inputs,...r.fluids]){const port=m.ports.find(q=>q.entity===p.entity);assert(p.measuredPerMinute<=port.perMinute+1e-6,'draw within panel '+p.item);}
 assert.equal(m.measured.steadyPerMinute,r.outputsPerMinute.concrete);
});

test('three west entrances (two belts, one pipe) with labelled panels; one east belt exit on the bottom row',()=>{
 const inputs=m.ports.filter(p=>p.kind==='input'),fluids=m.ports.filter(p=>p.kind==='fluid');
 assert.deepEqual(inputs.map(p=>p.item).sort(),['iron-ore','stone-brick']);assert.deepEqual(fluids.map(p=>p.item),['water']);
 assert.deepEqual(m.inputs,inputs);assert.deepEqual(m.fluids,fluids);
 const entrances=[...inputs,...fluids];
 assert.equal(new Set(entrances.map(p=>p.entity)).size,3);assert.equal(new Set(entrances.map(p=>p.displayEntity)).size,3);
 assert.equal(entities.filter(e=>e.name==='display-panel').length,3);
 for(const p of entrances){
  const e=byId.get(p.entity);
  if(p.kind==='input'){assert.equal(e.name,'fast-transport-belt');assert.equal(e.direction,4);assert.equal(p.direction,4);}else{assert.equal(e.name,'pipe');assert.equal(p.direction,undefined);}
  assert.equal(p.externalSide,'west');assert.deepEqual(p.items,[p.item]);
  assert.equal(p.nominalPerMinute,m.recipeAudit.externalPerMinute[p.item]);assert(p.perMinute>=p.nominalPerMinute,'supply at or above nominal');
  const panel=byId.get(p.displayEntity);assert.equal(panel.name,'display-panel');assert.equal(panel.always_show,true);
  assert.deepEqual(panel.icon,{type:p.kind==='fluid'?'fluid':'item',name:p.item});
  assert.equal(panel.text,`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min`);
  const [px,py]=tile(e),[lx,ly]=tile(panel);assert(Math.hypot(px-lx,py-ly)<=4,'panel within 4 tiles');assert(!(ly===py&&lx<px),'panel not west of the entrance on its row');
  for(let k=1;k<=3;k++)assert(!entityAt(px-k,py),'west approach clear');
 }
 // Expected figures: the published supply is the recipe demand (lowest figure that passed).
 assert.deepEqual(Object.fromEntries(entrances.map(p=>[p.item,p.nominalPerMinute])),{'stone-brick':22.5,water:450,'iron-ore':4.5});
 const outputs=m.ports.filter(p=>p.kind==='output');assert.equal(outputs.length,1);assert.deepEqual(m.outputs,outputs);
 const o=outputs[0];assert.equal(o.item,'concrete');assert.equal(o.externalSide,'east');assert.equal(o.transport,'belt');assert.equal(o.cap,8);assert.equal(o.direction,4);
 const exit=byId.get(o.entity);assert.equal(exit.name,'fast-transport-belt');assert.equal(exit.direction,4);
 const [ex,ey]=tile(exit);
 const behind=entityAt(ex-1,ey);assert(behind&&behind.name==='fast-transport-belt'&&behind.direction===4,'exit fed straight from behind');
 for(const y of [ey-1,ey+1]){const side=entityAt(ex,y);assert(!(side&&/belt/.test(side.name)&&side.direction===(y<ey?8:0)),'nothing side-loads the exit');}
 for(let k=1;k<=3;k++)assert(!entityAt(ex+k,ey),'east approach clear');
 assert.equal(ex+1,m.footprint.right,'exit on the east edge');assert.equal(ey,m.footprint.bottom-1,'exit on the bottom row');
 assert.deepEqual(m.supplierLinks,[{consumer:'launch-kit',item:'concrete',exitRowFromTop:ey-m.footprint.top,perMinute:45}]);
 const power=m.ports.filter(p=>p.kind==='power');assert.equal(power.length,1);assert.equal(byId.get(power[0].entity).name,'substation');
 assert.equal(entities.filter(e=>e.name==='substation').length,1);assert.equal((bp.wires||[]).length,0,'no wires');
});

test('allowed entities, arm settings, machine, lanes of the two output arms',()=>{
 for(const e of entities){
  assert(allowed.has(e.name),e.name);assert.equal(e.quality??'normal','normal');
  assert(!/-module/.test(JSON.stringify(e.items??{})),'installed module '+e.entity_number);
  if(e.name==='fast-inserter'||e.name==='long-handed-inserter')assert.equal(e.override_stack_size,1);
  if(e.name==='bulk-inserter')assert.equal(e.override_stack_size,2);
  if(e.recipe){assert.equal(e.name,'assembling-machine-2');assert.equal(e.recipe,'concrete');}
  assert.equal(e.tags?.flight_science_entity,e.entity_number);
 }
 assert(!entities.some(e=>['electronic-circuit','rocket-fuel'].includes(e.recipe)),'no forbidden recipe');
 assert(!entities.some(e=>/chest|combinator|medium-electric-pole/.test(e.name)),'no chests, combinators or medium poles');
 const counts={};for(const e of entities)if(e.recipe)counts[e.recipe]=(counts[e.recipe]||0)+1;assert.deepEqual(counts,m.machineCounts);
 const machine=entities.find(e=>e.recipe==='concrete');assert.equal(machine.direction,12,'machine faces west: its water input meets the entrance pipe');
 // Input arms: one filtered fast arm per belt entrance, picking from the entrance tile and dropping into the machine.
 assert.equal(m.armRoles.input.length,2);
 for(const armId of m.armRoles.input){const arm=byId.get(armId);assert.equal(arm.name,'fast-inserter');assert(arm.use_filters);
  const src=entityAt(...pickTile(arm));assert(m.inputs.some(p=>p.entity===src.entity_number),'picks from an entrance');assert.equal(arm.filters[0].name,m.inputs.find(p=>p.entity===src.entity_number).item);
  assert.equal(entityAt(...dropTile(arm)),machine,'drops into the machine');}
 // Output arms: one drops onto an east-running belt of the exit row, either straight away from it (arm west of the
 // belt) or from the north; the game fills the south lane both ways. The other drops onto a stub that ends running
 // south into an exit-row belt that is itself fed from behind, so the stub side-loads it: the north lane. Both lane
 // rules were measured natively (scripts/concrete-supplier/probes/results/lanes.json).
 assert.equal(m.armRoles.output.length,2);
 const exit=byId.get(m.outputs[0].entity),[ex,ey]=tile(exit);
 const drops=m.armRoles.output.map(i=>byId.get(i)).map(a=>{assert.equal(entityAt(...pickTile(a)),machine);return{arm:a,to:entityAt(...dropTile(a))};});
 const onRow=drops.find(d=>d.to.name==='fast-transport-belt'&&d.to.direction===4&&[12,0].includes(d.arm.direction)&&tile(d.to)[1]===ey);
 assert(onRow,'one arm drops onto an east-running exit-row belt from the west or the north');
 const stub=drops.find(d=>d!==onRow);assert.equal(stub.to.name,'fast-transport-belt');
 let cur=stub.to,steps=0;
 for(;;){const[x,y]=tile(cur),[dx,dy]=vec(cur.direction),nxt=entityAt(x+dx,y+dy);assert(nxt&&nxt.name==='fast-transport-belt','stub stays on belts');
  if(tile(nxt)[1]===ey){assert.equal(cur.direction,8,'stub enters the exit row running south');assert.equal(nxt.direction,4);
   const[tx]=tile(nxt);assert.equal(entityAt(tx-1,ey)?.direction,4,'side-load target fed from behind, so the stub side-loads it');break;}
  cur=nxt;assert(++steps<8,'stub reaches the exit row');}
});

test('footprint, area goal and bill of materials recomputed from the decoded string',()=>{
 const bs=entities.map(box);
 const f={left:Math.min(...bs.map(b=>b.left)),top:Math.min(...bs.map(b=>b.top)),right:Math.max(...bs.map(b=>b.right)),bottom:Math.max(...bs.map(b=>b.bottom))};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);
 assert.equal(m.areaGoal.achievedTiles,f.width*f.height);
 assert.deepEqual({goal:m.areaGoal.goalTiles,stretch:m.areaGoal.stretchTiles,fallback:m.areaGoal.fallbackTiles},{goal:40,stretch:36,fallback:60});
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
