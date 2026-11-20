import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/green-circuits/';
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
// A missing report must fail, not skip: read it inside the tests that need it.
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const allowed=new Set(['assembling-machine-2','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','pipe','pipe-to-ground','passive-provider-chest','substation','medium-electric-pole','constant-combinator','arithmetic-combinator','decider-combinator','display-panel']);
const tile=e=>[Math.floor(e.position.x),Math.floor(e.position.y)];
const reachOf=e=>e.name==='long-handed-inserter'?2:1;
const vec=d=>({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d||0];
// direction is the side an arm picks from: pick = tile + v * reach, drop = tile - v * reach.
const pickTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x+dx*r,y+dy*r];};
const dropTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x-dx*r,y-dy*r];};
const entityAt=(x,y)=>entities.find(e=>e.name!=='assembling-machine-2'&&e.name!=='substation'&&tile(e)[0]===x&&tile(e)[1]===y);
const machineAt=(x,y)=>entities.find(e=>e.name==='assembling-machine-2'&&Math.abs(e.position.x-(x+.5))<=1.01&&Math.abs(e.position.y-(y+.5))<=1.01);

test('one record; product, target, cap and recipe boundary are the spec values',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,'green-circuits');assert.equal(m.file,'green-circuits.txt');assert.equal(m.class,'rate');
 assert.deepEqual(m.products,['electronic-circuit']);
 assert.equal(m.targets['electronic-circuit'],360);assert.deepEqual(m.targets,{'electronic-circuit':360});
 assert.deepEqual(m.outputCaps,{'electronic-circuit':8});
 assert.deepEqual(m.recipeAudit.externalPerMinute,{'iron-plate':360,'copper-plate':540});
 assert.deepEqual(m.recipeAudit.craftsPerMinute,{'electronic-circuit':360,'copper-cable':540});
 assert.deepEqual(m.machineCounts,{'copper-cable':6,'electronic-circuit':4});
 assert.deepEqual(m.loopControl,[]);assert.equal(m.stockControl.mode,'belt-exit');
 for(const[k,v]of Object.entries({warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10}))assert(m.protocol[k]>=v,k);
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
 assert.equal(report.harnessSha256,hash(await read('scripts/green-circuits/control.lua')),'native harness changed since report');
 assert.equal(report.validatorSha256,hash(await read('scripts/green-circuits/validate.mjs')),'validator changed since report');
 for(const field of ['dataHarnessSha256','configurationSha256'])assert.match(report[field],/^[a-f0-9]{64}$/);
 for(const[k,v]of Object.entries(m.protocol))assert.equal(report.protocolMinutes[k],v,'report protocol '+k);
});

test('native report passes the rate-class formula, recomputed from its numbers',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id);
 assert.equal(m.status,'qualified');
 assert.equal(report.passed,true);assert.equal(r.passed,true);
 const t=m.targets['electronic-circuit']*.95;
 assert(r.outputsPerMinute['electronic-circuit']>=t,'steady rate');
 assert(r.recovery.outputsPerMinute['electronic-circuit']>=t,'recovery rate');
 assert.equal(r.machines.length,10);assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 // Full rate, not only "crafted": each machine's crafts over the measured window are at least 95% of its maximum.
 // (One circuit machine reads ingredient_shortage at half its one-second samples yet makes every craft: its
 // cable arrives just in time. The crafts count is the measure.)
 for(const x of r.machines)assert(x.measuredCrafts>=.95*m.protocol.measureMinutes*60*x.nativeCraftingSpeed/x.nativeRecipeEnergy,'full-rate crafts '+x.entity);
 assert.equal(r.inputs.length,2);assert(r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute.length>0),'entrances productive');
 assert(r.outputPorts.every(p=>p.collectedDuringMeasurement>0),'output delivered');
 assert(r.blocked.collectionPauseStock.every(p=>p.count===8&&p.capacity===8&&p.maxDuringBlocked<=8),'exit holds exactly 8');
 assert(r.blocked.machinesStoppedInLastMinute,'machines stop while blocked');
 assert(r.powered&&r.externalApproachesClear&&r.exactRecipeChecks>0);
 assert.equal(r.bulkInserters.length,4);assert(r.bulkInserters.every(a=>a.observedMaxHand<=2&&a.observedMaxHand>0));
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);
});

test('two west entrances with labelled display panels; one east belt exit',()=>{
 const inputs=m.ports.filter(p=>p.kind==='input');
 assert.deepEqual(inputs.map(p=>p.item).sort(),['copper-plate','iron-plate']);
 assert.deepEqual(m.inputs.map(p=>p.item).sort(),['copper-plate','iron-plate']);
 assert.deepEqual(m.fluids,[]);
 assert.equal(new Set(inputs.map(p=>p.entity)).size,2);assert.equal(new Set(inputs.map(p=>p.displayEntity)).size,2);
 assert.equal(entities.filter(e=>e.name==='display-panel').length,2);
 for(const p of inputs){
  const belt=byId.get(p.entity);assert.equal(belt.name,'fast-transport-belt');assert.equal(belt.direction,4);
  assert.equal(p.externalSide,'west');assert.equal(p.direction,4);assert.deepEqual(p.items,[p.item]);
  assert.equal(p.perMinute,m.recipeAudit.externalPerMinute[p.item]);
  const panel=byId.get(p.displayEntity);assert.equal(panel.name,'display-panel');assert.equal(panel.always_show,true);
  assert.deepEqual(panel.icon,{type:'item',name:p.item});
  assert.equal(panel.text,`IN: ${p.item}\nWEST · ${Math.round(p.perMinute*10)/10}/min at nominal target`);
  const [px,py]=tile(belt),[lx,ly]=tile(panel);assert(Math.hypot(px-lx,py-ly)<=4,'panel within 4 tiles');assert(!(ly===py&&lx<px),'panel not west of the entrance on its row');
  for(let k=1;k<=3;k++)assert(!entities.some(e=>tile(e)[0]===px-k&&tile(e)[1]===py),'west approach clear');
 }
 const outputs=m.ports.filter(p=>p.kind==='output');
 assert.equal(outputs.length,1);const o=outputs[0];
 assert.equal(o.item,'electronic-circuit');assert.equal(o.externalSide,'east');assert.equal(o.transport,'belt');assert.equal(o.cap,8);
 const exit=byId.get(o.entity);assert.equal(exit.name,'fast-transport-belt');assert.equal(exit.direction,4);
 const [ex,ey]=tile(exit);
 // The exit is fed from behind (a side-loaded end tile holds 6, not 8): the tile west of it flows east into it.
 const behind=entityAt(ex-1,ey);assert(behind&&/belt/.test(behind.name)&&behind.direction===4&&behind.type!=='input','exit fed straight from behind');
 for(const y of [ey-1,ey+1]){const side=entityAt(ex,y);assert(!(side&&/belt/.test(side.name)&&side.direction===(y<ey?8:0)),'nothing side-loads the exit');}for(let k=1;k<=3;k++)assert(!entities.some(e=>tile(e)[0]===ex+k&&tile(e)[1]===ey),'east approach clear');
 assert.equal(Math.ceil(exit.position.x),m.footprint.right,'exit on the east edge');
 for(const p of inputs)assert(byId.get(p.entity).position.x-.5>=m.footprint.left,'entrance inside the rectangle');
 const power=m.ports.filter(p=>p.kind==='power');assert.equal(power.length,1);assert.equal(byId.get(power[0].entity).name,'substation');
 // Every wire is a copper power wire between substations (connector 5); no circuit wires and no chests.
 const subs=entities.filter(e=>e.name==='substation');assert.equal(subs.length,2,'two substations');
 assert.equal((bp.wires||[]).length,subs.length-1);
 for(const w of bp.wires||[]){assert.equal(w[1],5);assert.equal(w[3],5);assert.equal(byId.get(w[0]).name,'substation');assert.equal(byId.get(w[2]).name,'substation');}
 assert(!entities.some(e=>/chest|combinator/.test(e.name)),'no chests or combinators');
});

test('allowed entities, arm settings, machines and bulk arms in the machine gaps',()=>{
 for(const e of entities){
  assert(allowed.has(e.name),e.name);
  assert.equal(e.quality??'normal','normal');
  assert(!/-module/.test(JSON.stringify(e.items??{})),'installed module '+e.entity_number);
  if(e.name==='fast-inserter'||e.name==='long-handed-inserter')assert.equal(e.override_stack_size,1);
  if(e.name==='bulk-inserter')assert.equal(e.override_stack_size,2);
  if(e.recipe)assert.equal(e.name,'assembling-machine-2');
  assert.equal(e.tags?.flight_science_entity,e.entity_number);
 }
 assert(!entities.some(e=>e.name==='medium-electric-pole'),'substations alone power the build');
 const counts={};for(const e of entities)if(e.recipe)counts[e.recipe]=(counts[e.recipe]||0)+1;
 assert.deepEqual(counts,m.machineCounts);
 assert.equal(counts['copper-cable'],6);assert.equal(counts['electronic-circuit'],4);
 const bulks=entities.filter(e=>e.name==='bulk-inserter');assert.equal(bulks.length,4);
 for(const b of bulks){
  const[x,y]=tile(b),west=machineAt(x-2,y),east=machineAt(x+2,y);
  assert(west&&east,'bulk arm sits in a machine gap');
  const from=b.direction===12?west:east,to=b.direction===12?east:west;
  assert.equal(from.recipe,'copper-cable');assert.equal(to.recipe,'electronic-circuit');
 }
 // Input arms pick from the shared two-item plate belt: fast arms (top row) and long-handed arms reaching
 // over the circuit belt (bottom row). Each has a one-item whitelist for its machine's plate.
 assert.equal(m.armRoles.input.length,15);
 const plateBelt=new Set();
 for(const armId of m.armRoles.input){
  const arm=byId.get(armId);assert(['fast-inserter','long-handed-inserter'].includes(arm.name),arm.name);
  assert.equal(arm.override_stack_size,1);assert(arm.use_filters,'input arm filtered '+armId);
  assert.equal(arm.filters.length,1);assert.equal(arm.filter_mode??'whitelist','whitelist');
  const fed=machineAt(...dropTile(arm)),src=entityAt(...pickTile(arm));
  assert(fed,'input arm drops into a machine '+armId);
  assert(src&&src.name==='fast-transport-belt','input arm picks from a belt '+armId);plateBelt.add(src.position.y);
  assert.equal(arm.filters[0].name,fed.recipe==='copper-cable'?'copper-plate':'iron-plate');
 }
 assert.equal(plateBelt.size,1,'every input arm picks from the one plate belt');
 const counts2=m.armRoles.input.map(id=>byId.get(id).name).reduce((a,n)=>(a[n]=(a[n]||0)+1,a),{});
 assert.deepEqual(counts2,{'fast-inserter':5,'long-handed-inserter':10});
 // Output arms: each picks from a circuit machine and drops on the circuit belt, which ends at the exit.
 assert.equal(m.armRoles.output.length,6);
 const exitY=tile(byId.get(m.outputs[0].entity))[1];
 for(const armId of m.armRoles.output){
  const arm=byId.get(armId);assert(!arm.use_filters,'output arm unfiltered');
  assert.equal(machineAt(...pickTile(arm))?.recipe,'electronic-circuit','output arm picks from a circuit machine');
  const to=entityAt(...dropTile(arm));assert(to&&/belt/.test(to.name)&&tile(to)[1]===exitY,'output arm drops on the circuit belt');
 }
 assert(!plateBelt.has(byId.get(m.outputs[0].entity).position.y),'plates and circuits use different belts');
 assert.equal(bp.version,562954249961472);assert.deepEqual(bp.icons.map(i=>i.signal.name),['electronic-circuit']);
});

test('footprint matches the decoded string and beats the baseline',()=>{
 // Selection-box sizes of the allowed entities (1x1 unless listed), rotated for east/west, so the check
 // needs no prototype dump (CI has none).
 const size={'assembling-machine-2':[3,3],substation:[2,2],'decider-combinator':[1,2],'arithmetic-combinator':[1,2],'constant-combinator':[1,1]};
 const xs=[],ys=[];
 for(const e of entities){let[w,h]=size[e.name]||[1,1];if([4,12].includes(e.direction))[w,h]=[h,w];xs.push(e.position.x-w/2,e.position.x+w/2);ys.push(e.position.y-h/2,e.position.y+h/2);}
 const f={left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);
 assert.equal(m.areaGoal.achievedTiles,f.width*f.height);
 assert(m.areaGoal.achievedTiles<=364,'must beat or equal the 364-tile baseline');
 assert.equal(m.areaGoal.goalTiles,286);assert.equal(m.areaGoal.stretchTiles,273);
});

test('generator is reproducible: the same variant gives the same string',async t=>{
 if(!existsSync(rawPath)){t.skip('Pinned local prototype dump is not installed (set FACTORIO_RAW)');return;}
 const out='.cache/green-circuits/test-regenerate';
 await promisify(execFile)(process.execPath,['scripts/green-circuits/generate.mjs','--variant',m.variant,'--out',out],{cwd:rootPath});
 const again=(await read(out+'/green-circuits.txt')).toString().trim();
 assert.equal(hash(again),m.blueprintSha256);
});
