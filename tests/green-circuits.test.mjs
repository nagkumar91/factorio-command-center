import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
// The dump counts as installed only when it can be opened (a file that exists but cannot be read skips too).
const readable=p=>{try{closeSync(openSync(p,'r'));return true;}catch{return false;}};
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
// Belt flow, tile to tile. A belt's direction is its direction of travel. An underground entry hands to its paired
// exit: the nearest underground belt on its line within reach (7), which must be an exit facing the same way. A belt
// tile takes items from behind or from a side, never head-on; an underground entry only from behind; an underground
// exit takes nothing on the surface.
const isBelt=e=>!!e&&/belt/.test(e.name),dirOf=e=>e.direction||0;
const beltAt=(x,y)=>entities.find(e=>isBelt(e)&&tile(e)[0]===x&&tile(e)[1]===y);
function nextBelt(e){
 const[x,y]=tile(e),[dx,dy]=vec(dirOf(e));
 if(e.name==='fast-underground-belt'&&e.type==='input'){
  for(let k=1;k<=7;k++){const o=beltAt(x+dx*k,y+dy*k);if(o&&o.name==='fast-underground-belt'&&[dirOf(e),(dirOf(e)+8)%16].includes(dirOf(o))){assert(o.type==='output'&&dirOf(o)===dirOf(e),`underground entry at ${x},${y} pairs with an exit`);return o;}}
  assert.fail(`underground entry at ${x},${y} has no exit within reach`);
 }
 const t=beltAt(x+dx,y+dy);if(!t)return null;
 if(t.name==='fast-underground-belt')return t.type==='input'&&dirOf(t)===dirOf(e)?t:null;
 return (dirOf(t)+8)%16===dirOf(e)?null:t;
}
const follow=start=>{const seen=[];for(let e=start;e&&!seen.includes(e);e=nextBelt(e))seen.push(e);return seen;};
const spot=e=>tile(e).join(',');

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
 assert.equal(m.variant,'single-aisle');assert.equal(m.name,'Green-circuit supplier · 360/min');
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
 // Full rate, not only "crafted": each machine's crafts over the measured window are at least 95% of its maximum,
 // and each machine read `working` at every one-second sample of the window.
 for(const x of r.machines){
  assert(x.measuredCrafts>=.95*m.protocol.measureMinutes*60*x.nativeCraftingSpeed/x.nativeRecipeEnergy,'full-rate crafts '+x.entity);
  assert.deepEqual(x.statusSamples,{working:m.protocol.measureMinutes*60},'working at every sample '+x.entity);
 }
 // The entrances took what the recipes need, no more: the plate belt backs up and never leaks.
 for(const p of r.inputs)assert.equal(p.acceptedPerMinute,m.recipeAudit.externalPerMinute[p.item],'accepted '+p.item);
 // Exit lanes (transport line 1 is the north lane of an east-facing belt): both carry circuits, they add up to
 // what was collected, and the published figures are the measured ones: 270 north, 90 south.
 const lanes=r.outputPorts[0].collectedByLane;
 assert.equal(lanes.length,2);assert(lanes.every(n=>n>0),'both exit lanes carry circuits');
 assert.equal(lanes[0]+lanes[1],r.outputPorts[0].collectedDuringMeasurement);
 assert.deepEqual(m.measured.exitLanesPerMinute,{north:lanes[0]/m.protocol.measureMinutes,south:lanes[1]/m.protocol.measureMinutes});
 assert.deepEqual(m.measured.exitLanesPerMinute,{north:270,south:90});
 assert.equal(m.measured.steadyPerMinute,r.outputsPerMinute['electronic-circuit']);assert.equal(m.measured.recoveryPerMinute,r.recovery.outputsPerMinute['electronic-circuit']);
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
 // One substation, so there is no wire at all.
 const subs=entities.filter(e=>e.name==='substation');assert.equal(subs.length,1,'one substation');
 assert.equal(m.construction.substation,1);
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
 // Input arms pick from the shared two-item plate belt on the middle aisle row: one fast arm per machine, the
 // top row's from the north side and the bottom row's from the south side of the same tile. Each has a
 // one-item whitelist for its machine's plate. Some plate tiles are underground belt ends.
 assert.equal(m.armRoles.input.length,10);
 const plateBelt=new Set(),plateTiles=new Set(),fedMachines=new Set();
 for(const armId of m.armRoles.input){
  const arm=byId.get(armId);assert.equal(arm.name,'fast-inserter');
  assert.equal(arm.override_stack_size,1);assert(arm.use_filters,'input arm filtered '+armId);
  assert.equal(arm.filters.length,1);assert.equal(arm.filter_mode??'whitelist','whitelist');
  const fed=machineAt(...dropTile(arm)),src=entityAt(...pickTile(arm));
  assert(fed,'input arm drops into a machine '+armId);
  assert(isBelt(src),'input arm picks from a belt '+armId);plateBelt.add(src.position.y);plateTiles.add(src);fedMachines.add(fed);
  assert.equal(arm.filters[0].name,fed.recipe==='copper-cable'?'copper-plate':'iron-plate');
 }
 assert.equal(plateBelt.size,1,'every input arm picks from the one plate row');
 assert.equal(fedMachines.size,10,'every machine has its own input arm');assert.equal(plateTiles.size,5,'one plate tile per machine pair');
 const counts2=m.armRoles.input.map(id=>byId.get(id).name).reduce((a,n)=>(a[n]=(a[n]||0)+1,a),{});
 assert.deepEqual(counts2,{'fast-inserter':10});
 assert(!entities.some(e=>e.name==='long-handed-inserter'),'no long-handed arms');
 // Output arms: one unfiltered fast arm per circuit machine, dropping on a plain belt tile (the far lane).
 assert.equal(m.armRoles.output.length,4);
 const dropTiles=new Set(),emptied=new Set();
 for(const armId of m.armRoles.output){
  const arm=byId.get(armId);assert.equal(arm.name,'fast-inserter');assert(!arm.use_filters,'output arm unfiltered');
  const from=machineAt(...pickTile(arm));assert.equal(from?.recipe,'electronic-circuit','output arm picks from a circuit machine');emptied.add(from);
  const to=entityAt(...dropTile(arm));assert(to&&to.name==='fast-transport-belt','output arm drops on a belt tile');dropTiles.add(to);
 }
 assert.equal(emptied.size,4,'every circuit machine has its own output arm');assert.equal(dropTiles.size,2,'one drop tile per machine pair');
 // Gap arms: 4 bulk and 4 fast, machine to machine, cable machine to circuit machine.
 assert.equal(m.armRoles.gap.length,8);
 for(const armId of m.armRoles.gap){const arm=byId.get(armId);assert(!arm.use_filters);assert.equal(machineAt(...pickTile(arm))?.recipe,'copper-cable');assert.equal(machineAt(...dropTile(arm))?.recipe,'electronic-circuit');}
 assert.equal(entities.filter(e=>/inserter/.test(e.name)).length,22);
 assert.deepEqual([...m.armRoles.gap,...m.armRoles.input,...m.armRoles.output].sort((a,b)=>a-b),entities.filter(e=>/inserter/.test(e.name)).map(e=>e.entity_number).sort((a,b)=>a-b),'every arm has a role');
 assert.equal(bp.version,562954249961472);assert.deepEqual(bp.icons.map(i=>i.signal.name),['electronic-circuit']);
});

test('two belts share the aisle and never meet: plates reach every plate tile, circuits reach the exit',()=>{
 const exit=byId.get(m.outputs[0].entity),belts=entities.filter(isBelt);
 // Plate belt: everything downstream of the two entrances.
 const plates=new Set();for(const p of m.inputs)for(const e of follow(byId.get(p.entity)))plates.add(e);
 for(const armId of m.armRoles.input)assert(plates.has(entityAt(...pickTile(byId.get(armId)))),'plate belt reaches the tile of input arm '+armId);
 assert(!plates.has(exit),'plates never reach the exit');
 // The two entrances side-load one straight tile from opposite sides: one material per lane.
 const merges=m.inputs.map(p=>follow(byId.get(p.entity))[2]);assert.equal(merges[0],merges[1]);
 const merge=merges[0],[mx,my]=tile(merge),[fx,fy]=vec(dirOf(merge));assert(!isBelt(beltAt(mx-fx,my-fy)),'nothing behind the entrance merge tile');
 const sides=m.inputs.map(p=>tile(follow(byId.get(p.entity))[1]));assert.deepEqual(sides.map(([x,y])=>[x-mx,y-my]),[[0,-1],[0,1]],'copper from the north side, iron from the south side');
 // The plate belt has one end, a dead end: its last tile faces an arm, not a belt.
 const plateEnds=[...plates].filter(e=>!nextBelt(e));assert.equal(plateEnds.length,1);
 const[ex,ey]=tile(plateEnds[0]),[vx,vy]=vec(dirOf(plateEnds[0]));assert.equal(entityAt(ex+vx,ey+vy)?.name,'fast-inserter','the plate belt ends facing an arm');
 assert.equal(plateEnds[0].name,'fast-transport-belt');
 // Circuit belt: everything downstream of the four output arms; every path ends at the exit.
 const circuits=new Set();
 for(const armId of m.armRoles.output){const path=follow(entityAt(...dropTile(byId.get(armId))));assert.equal(path.at(-1),exit,'circuits from output arm '+armId+' reach the exit');for(const e of path)circuits.add(e);}
 assert.equal(nextBelt(exit),null);
 for(const e of circuits)assert(!plates.has(e),'plates and circuits share no tile: '+spot(e));
 assert.equal(plates.size+circuits.size,belts.length,'every belt tile belongs to the plate belt or the circuit belt');
 // No arm can put a plate on the circuit belt or a circuit on the plate belt.
 for(const e of entities.filter(e=>/inserter/.test(e.name))){const to=entityAt(...dropTile(e)),from=entityAt(...pickTile(e));assert(!plates.has(to),'no arm drops on the plate belt');assert(!circuits.has(from),'no arm picks from the circuit belt');}
 // Underground pairs: four, each within reach, none nested inside another on the same line.
 const entries=belts.filter(e=>e.name==='fast-underground-belt'&&e.type==='input'),exits=belts.filter(e=>e.name==='fast-underground-belt'&&e.type==='output');
 assert.equal(entries.length,4);assert.equal(exits.length,4);assert.equal(new Set(entries.map(nextBelt)).size,4);
 assert.equal(m.construction['fast-underground-belt'],8);assert.equal(m.construction['fast-transport-belt'],belts.length-8);
});

test('same entrance and exit tiles as the version it replaces; that version is kept',async()=>{
 const old=JSON.parse(await read(dir+'history/twin-belt-21af4618/manifest.json'))[0];
 assert.equal(old.blueprintSha256,'21af4618a276bd193831ab3d281a23eb7839cb9e74364124b0db604c92569e56');
 const where=x=>x.ports.filter(p=>p.kind!=='power').map(p=>[p.kind,p.item,p.x,p.y,p.externalSide]);
 assert.deepEqual(where(m),where(old));
 assert.deepEqual(where(m),[['input','copper-plate',.5,3.5,'west'],['input','iron-plate',.5,5.5,'west'],['output','electronic-circuit',18.5,5.5,'east']]);
 assert.deepEqual(m.targets,old.targets);assert.deepEqual(m.outputCaps,old.outputCaps);assert.deepEqual(m.machineCounts,old.machineCounts);assert.deepEqual(m.protocol,old.protocol);
 assert.deepEqual(m.recipeAudit,old.recipeAudit);
 // At least 5% fewer tiles than the version it replaces, and no wider or taller.
 const area=x=>x.footprint.width*x.footprint.height;
 assert.equal(area(old),190);assert.equal(area(m),171);assert(area(m)<=.95*area(old));
 assert(m.footprint.width<=old.footprint.width&&m.footprint.height<=old.footprint.height);
 // Every history folder holds a string, a manifest for that string, a full-protocol report for it and a note;
 // "qualified" in a history manifest means its own report passed.
 for(const folder of ['twin-belt-21af4618','single-aisle-even-lanes','outer-output-belts','straight-exit-east-column','side-loaded-exit']){
  const h=dir+'history/'+folder+'/',hm=JSON.parse(await read(h+'manifest.json'))[0],hr=JSON.parse(await read(h+'native-report.json'));
  assert.equal(hash((await read(h+hm.file)).toString().trim()),hm.blueprintSha256,folder);
  assert.equal(hr.builds[0].blueprintSha256,hm.blueprintSha256,folder);assert(!hr.short,folder);
  assert.equal(hm.status,hr.passed&&hr.builds[0].passed?'qualified':'not-qualified',folder);
  assert((await read(h+'NOTE.md')).toString().length>80,folder+' note');
 }
 // The even-lanes alternative: one column wider, 180 per lane, still at least 5% under 190.
 const even=JSON.parse(await read(dir+'history/single-aisle-even-lanes/manifest.json'))[0];
 assert.equal(even.status,'qualified');assert.equal(area(even),180);assert.deepEqual(even.measured.exitLanesPerMinute,{north:180,south:180});
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
 assert.deepEqual([f.width,f.height],[19,9]);assert.equal(m.areaGoal.achievedTiles,171);
});

test('generator is reproducible: the same variant gives the same string',async t=>{
 if(!readable(rawPath)){t.skip('Pinned local prototype dump is not installed (set FACTORIO_RAW)');return;}
 const out='.cache/green-circuits/test-regenerate';
 await promisify(execFile)(process.execPath,['scripts/green-circuits/generate.mjs','--variant',m.variant,'--out',out],{cwd:rootPath});
 const again=(await read(out+'/green-circuits.txt')).toString().trim();
 assert.equal(hash(again),m.blueprintSha256);
});
