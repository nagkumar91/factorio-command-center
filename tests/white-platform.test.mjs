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
const dir='blueprint-sources/white-platform/';
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities,tiles=bp.tiles;
// A missing report must fail, not skip: read it inside the tests that need it.
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
let rawReadable=false;try{await fs.access(rawPath,fs.constants.R_OK);rawReadable=true;}catch{}

// Inline tables (no dump needed): tile size at direction 0 (crusher 2 wide 3 tall, combinators 1 wide 2 tall),
// the item that builds each entity, and the game's item weights in kg (CONTRACT section 2).
const SIZE={'space-platform-hub':[8,8],'assembling-machine-2':[3,3],'electric-furnace':[3,3],'asteroid-collector':[3,3],'solar-panel':[3,3],accumulator:[2,2],crusher:[2,3],'fast-inserter':[1,1],'constant-combinator':[1,1],'arithmetic-combinator':[1,2],'decider-combinator':[1,2]};
const WEIGHT={'space-platform-foundation':20,'asteroid-collector':100,crusher:100,'assembling-machine-2':20,'electric-furnace':20,'fast-inserter':20,'solar-panel':20,accumulator:20,'constant-combinator':20,'arithmetic-combinator':20,'decider-combinator':20,'space-platform-starter-pack':1000};
const ALLOWED=new Set(Object.keys(SIZE));
const key=(x,y)=>x+','+y;
const cells=e=>{let [w,h]=SIZE[e.name];if([4,12].includes(e.direction))[w,h]=[h,w];const out=[];for(let x=Math.round(e.position.x-w/2);x<Math.round(e.position.x+w/2);x++)for(let y=Math.round(e.position.y-h/2);y<Math.round(e.position.y+h/2);y++)out.push([x,y]);return out;};
const tileSet=new Set(tiles.map(t=>key(t.position.x,t.position.y)));
const byId=new Map(entities.map(e=>[e.entity_number,e]));
const hub=entities.find(e=>e.name==='space-platform-hub');
const wiredRed=(a,b)=>bp.wires.some(w=>(w[0]===a&&w[2]===b||w[0]===b&&w[2]===a)&&w[1]===1&&w[3]===1);

test('one record; product, target, cap, class and protocol are the spec values',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,'white-platform');assert.equal(m.file,'white-platform.txt');assert.equal(m.class,'platform');
 assert.equal(m.name,'White-pack platform · 60/min in Nauvis orbit');assert.equal(bp.label,m.name);
 assert.deepEqual(m.products,['space-science-pack']);assert.deepEqual(m.targets,{'space-science-pack':60});
 assert.deepEqual(m.outputCaps,{'space-science-pack':2000});
 assert.deepEqual(m.inputs,[]);assert.deepEqual(m.fluids,[]);assert.deepEqual(m.loopControl,[]);
 assert.equal(m.ports.length,1);assert.deepEqual(m.outputs,m.ports);
 const p=m.ports[0];assert.equal(p.kind,'output');assert.equal(p.item,'space-science-pack');assert.equal(p.entity,hub.entity_number);assert.equal(p.cap,2000);assert.equal(p.ceiling,2100);
 assert.deepEqual(m.recipeAudit.externalPerMinute,{});
 assert.deepEqual(m.recipeAudit.craftsPerMinute,{'space-science-pack':12,'iron-plate':24,'metallic-asteroid-crushing':1.2,'carbonic-asteroid-crushing':1.2,'oxide-asteroid-crushing':2.4});
 assert.deepEqual(m.stockControl.ceilings,{'space-science-pack':2100,'iron-ore':100,carbon:100,ice:100,'iron-plate':130,'metallic-asteroid-chunk':16,'carbonic-asteroid-chunk':16,'oxide-asteroid-chunk':16});
 for(const [k,v] of Object.entries({buildLimitMinutes:10,warmupMinutes:60,measureMinutes:120,blockedMinutes:30,recoveryMinutes:60}))assert(m.protocol[k]>=v,k);
 assert(m.protocol.recoveryMeasuredMinutes<=m.protocol.recoveryMinutes);assert.equal(m.protocol.rocketDeliveryLimitMinutes,60);assert.equal(m.protocol.minimumFreeSlots,5);
 assert.deepEqual(m.supplierLinks,[]);
});

test('blueprint, native report, prototypes, harness and validator hashes agree',async()=>{
 const report=await loadReport();
 const evidence=report.builds.find(b=>b.id===m.id);
 assert(evidence,'native build evidence missing');
 assert.equal(hash(code),m.blueprintSha256);
 assert.equal(evidence.blueprintSha256,m.blueprintSha256,'native report is stale for blueprint');
 const [receiver]=JSON.parse(await read('blueprint-sources/white-pack-receiver/manifest.json'));
 assert.equal(evidence.receiverBlueprintSha256,receiver.blueprintSha256,'the end-to-end run used the published receiver');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);
 assert.equal(report.gameVersion,'2.1.24');
 assert(!report.short,'an exploration report is not a qualification');
 assert.equal(report.harnessSha256,hash(await read('scripts/white-platform/control.lua')),'native harness changed since report');
 assert.equal(report.validatorSha256,hash(await read('scripts/white-platform/validate.mjs')),'validator changed since report');
 for(const field of ['dataHarnessSha256','configurationSha256'])assert.match(report[field],/^[a-f0-9]{64}$/);
 for(const [k,v] of Object.entries(m.protocol))assert.equal(report.protocolMinutes[k],v,'report protocol '+k);
 assert.match(report.feedPolicy,/One inventory write/);
});

test('native report passes the platform formula, recomputed from its numbers',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id);
 assert.equal(m.status,'qualified');assert.equal(report.passed,true);assert.equal(r.passed,true);
 assert(Object.values(r.checks).every(Boolean),'every named check');
 const floor=m.targets['space-science-pack']*.95;
 assert(r.steady.collectedPerMinute>=floor&&r.steady.madePerMinute>=floor,'steady');
 assert(r.recovery.collectedPerMinute>=floor&&r.recovery.madePerMinute>=floor,'recovery');
 assert.equal(r.recovery.minutes,m.protocol.recoveryMeasuredMinutes);
 assert.equal(r.machines.length,6);assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 // the four science machines ran at full speed: 120 min * 60 s / (15 s / 0.75) = 360 crafts each
 for(const x of r.machines.filter(x=>x.recipe==='space-science-pack'))assert(x.measuredCrafts>=.95*m.protocol.measureMinutes*3,'full-rate science '+x.x+','+x.y);
 assert.equal(r.collectors.length,4);assert(r.collectors.every(c=>c.deliveredDuringMeasurement>0));
 assert.equal(r.blocked.chest,2000);assert(r.blocked.chestMaxDuringBlocked<=2000);assert(r.blocked.pad>=1000);
 assert(r.blocked.hubPacks>=2000&&r.blocked.hubPacks<=2100);assert.equal(r.blocked.scienceCraftsInHold,0);
 for(const [n,c] of Object.entries(m.stockControl.ceilings))assert((r.stocks.maximum[n]??0)<=c,'ceiling '+n);
 assert(r.stocks.lowestFreeSlots>=5);
 assert.equal(r.power.lowPowerTicks,0);
 const counts=Object.values(r.loss.entityCounts);assert(counts.every(c=>c===entities.length),'no entity lost');
 assert.equal(r.loss.damagedEntities,0);assert.equal(r.loss.damagedTiles,0);assert.equal(r.loss.asteroidsSeen,0);
 assert(r.build.ok&&r.build.seconds<=m.protocol.buildLimitMinutes*60);assert.deepEqual(r.build.leftoverConstructionItems,{});
 assert.equal(r.build.foundationTiles,m.foundationTiles);assert.equal(r.build.requestMissing,true);assert.equal(r.build.hubReadContents,true);
 assert.equal(r.ghosts.entity,entities.length-1);assert.equal(r.ghosts.tile,m.newFoundationTiles);
 assert(r.firstPodSecondsAfterBuild<=300);
 // run two: the game launched the starter pack and four full rockets, and the platform finished building
 const d=report.rocketDelivery;assert.equal(d.passed,true);
 assert.equal(d.launches.length,m.billOfMaterials.totalRockets);
 assert.deepEqual(d.launches[0].cargo,{'space-platform-starter-pack':1});
 assert(d.launches.slice(1).every(l=>l.weightKg===1000));
 assert(d.builtMinutes<=m.protocol.rocketDeliveryLimitMinutes);assert.deepEqual(d.leftInChests,{});
});

test('only platform entities of the closed list, every kit item type used, arm settings',()=>{
 for(const e of entities)assert(ALLOWED.has(e.name),'not allowed on the platform: '+e.name);
 for(const n of ALLOWED)assert(entities.some(e=>e.name===n),'unused item type '+n);
 assert.equal(entities.filter(e=>e.name==='space-platform-hub').length,1);
 assert.deepEqual(hub.position,{x:0,y:0});assert.equal(hub.request_missing_construction_materials,true);
 assert(!bp['snap-to-grid']&&!bp['absolute-snapping'],'no grid snapping: the hub anchors the paste');
 for(const e of entities.filter(e=>e.name==='fast-inserter'))assert.equal(e.override_stack_size,1);
 for(const e of entities.filter(e=>e.items||e.modules))assert.fail('no modules or item requests');
 assert.equal(bp.version,562954249961473);assert.equal(bp.icons[0].signal.name,'space-science-pack');
 assert(bp.tiles.every(t=>t.name==='space-platform-foundation'));
});

test('machine counts and recipes recomputed from the string',()=>{
 const counts={};
 for(const e of entities){
  if(e.name==='assembling-machine-2'){assert.equal(e.recipe,'space-science-pack');counts[e.recipe]=(counts[e.recipe]||0)+1;}
  if(e.name==='crusher'){assert.equal(e.recipe,undefined);assert.equal(e.control_behavior?.set_recipe,true);counts['asteroid-crushing-set-by-circuit']=(counts['asteroid-crushing-set-by-circuit']||0)+1;}
  if(e.name==='electric-furnace'){assert.equal(e.recipe,undefined);counts['iron-plate']=(counts['iron-plate']||0)+1;}
 }
 assert.deepEqual(counts,m.machineCounts);
 assert.deepEqual(m.machineCounts,{'space-science-pack':4,'iron-plate':1,'asteroid-crushing-set-by-circuit':1});
 // four collectors, one per side, each filtered by the circuit network
 const collectors=entities.filter(e=>e.name==='asteroid-collector');
 assert.deepEqual(collectors.map(e=>e.direction??0).sort((a,b)=>a-b),[0,4,8,12]);
 assert(collectors.every(e=>e.control_behavior?.circuit_set_filters===true));
});

test('footprint, tiles and geometry: everything on foundation, collector fronts clear, no overlap',()=>{
 const xs=tiles.map(t=>t.position.x),ys=tiles.map(t=>t.position.y);
 const f={left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs)+1,bottom:Math.max(...ys)+1};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);
 assert.equal(m.foundationTiles,tiles.length);assert.equal(tileSet.size,tiles.length);
 assert.equal(m.newFoundationTiles,tiles.length-100);
 for(let x=-5;x<=4;x++)for(let y=-5;y<=4;y++)assert(tileSet.has(key(x,y)),'starter square tile '+x+','+y);
 assert.equal(m.areaGoal.achievedTiles,tiles.length);assert(tiles.length<=m.areaGoal.goalTiles);
 const used=new Map();
 for(const e of entities)for(const [x,y] of cells(e)){assert(!used.has(key(x,y)),'overlap at '+x+','+y);used.set(key(x,y),e);if(e.name!=='asteroid-collector')assert(tileSet.has(key(x,y)),e.name+' off foundation at '+x+','+y);}
 // a collector: foundation under its two rear rows, nothing (not even foundation) in its outer row and four rows beyond
 const out={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]};
 for(const c of entities.filter(e=>e.name==='asteroid-collector')){
  const [dx,dy]=out[c.direction??0],cx=Math.floor(c.position.x),cy=Math.floor(c.position.y);
  for(let d=1;d<=5;d++)for(let s=-1;s<=1;s++){const x=cx+dx*d+(dy?s:0),y=cy+dy*d+(dx?s:0);assert(!tileSet.has(key(x,y)),'foundation in front of collector at '+x+','+y);const o=used.get(key(x,y));assert(!o||o===c,'entity in front of collector at '+x+','+y);}
  for(let back=0;back<=1;back++)for(let s=-1;s<=1;s++){const x=cx-dx*back+(dy?s:0),y=cy-dy*back+(dx?s:0);assert(tileSet.has(key(x,y)),'collector rear rows need foundation at '+x+','+y);}
 }
 // one connected piece of foundation
 const seen=new Set([key(0,0)]),todo=[[0,0]];while(todo.length){const [x,y]=todo.pop();for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=key(x+a,y+b);if(tileSet.has(k)&&!seen.has(k)){seen.add(k);todo.push([x+a,y+b]);}}}
 assert.equal(seen.size,tiles.length);
 // circuit wires at most 8 tiles centre to centre
 for(const [a,,b] of bp.wires){const p=byId.get(a).position,q=byId.get(b).position;assert(Math.hypot(p.x-q.x,p.y-q.y)<=8,'wire '+a+'-'+b);}
});

test('bill of materials, platform request and rockets recomputed from the string',()=>{
 const items={};for(const e of entities)if(e.name!=='space-platform-hub')items[e.name]=(items[e.name]||0)+1;
 items['space-platform-foundation']=tiles.length;
 const b=m.billOfMaterials;
 assert.deepEqual(b.items,Object.fromEntries(Object.entries(items).sort(([a],[c])=>a<c?-1:1)));
 assert.deepEqual(b.starterPackProvides,{'space-platform-foundation':110});
 const request={...items,'space-platform-foundation':tiles.length-110};
 assert.deepEqual(b.platformRequest,Object.fromEntries(Object.entries(request).sort(([a],[c])=>a<c?-1:1)));
 for(const [n,kg] of Object.entries(b.weightKg))assert.equal(kg,WEIGHT[n],'weight '+n);
 const kg=Object.entries(b.platformRequest).reduce((a,[n,c])=>a+WEIGHT[n]*c,0);
 assert.equal(b.requestedWeightKg,kg);assert.equal(kg%1000,0,'a whole number of rockets');assert.equal(kg,4000,'goal: four cargo rockets');
 assert.equal(b.rocketLiftKg,1000);assert.equal(b.cargoRockets,4);assert.equal(b.starterPackRockets,1);assert.equal(b.totalRockets,5);
 assert.equal(b.rocketCargo.length,5);assert.deepEqual(b.rocketCargo[0],{'space-platform-starter-pack':1});
 const sum={};for(const c of b.rocketCargo.slice(1)){let w=0;for(const [n,v] of Object.entries(c)){sum[n]=(sum[n]||0)+v;w+=WEIGHT[n]*v;}assert.equal(w,1000,'full rocket');}
 assert.deepEqual(Object.fromEntries(Object.entries(sum).sort(([a],[c])=>a<c?-1:1)),b.platformRequest);
 // kit ranges (launch-kit.md section 2)
 const ranges={'space-platform-foundation':300,'asteroid-collector':8,crusher:6,'assembling-machine-2':10,'electric-furnace':4,'fast-inserter':44,'solar-panel':30,accumulator:10,'constant-combinator':10,'arithmetic-combinator':10,'decider-combinator':10};
 for(const [n,c] of Object.entries(b.platformRequest))assert(c>=1&&c<=ranges[n],n);
 assert.deepEqual(m.construction,Object.fromEntries(Object.entries({...items,'space-platform-hub':1}).filter(([n])=>n!=='space-platform-foundation').sort(([a],[c])=>a<c?-1:1)));
});

test('control: hub stock conditions, furnace filter, chunk values on green, one crusher with its recipe set by the clock',()=>{
 const arms=entities.filter(e=>e.name==='fast-inserter');
 const cond=e=>e.control_behavior?.circuit_condition;
 const science=arms.filter(e=>cond(e)?.first_signal?.name==='space-science-pack');
 assert.equal(science.length,4);
 for(const a of science){assert.equal(cond(a).comparator,'<');assert.equal(cond(a).constant,2000);assert(wiredRed(hub.entity_number,a.entity_number),'science arm on the hub red wire');}
 const furnaceArm=arms.find(e=>e.use_filters);assert.equal(furnaceArm.filters[0].name,'iron-ore');assert.equal(cond(furnaceArm).first_signal.name,'iron-plate');assert.equal(cond(furnaceArm).constant,100);
 assert.equal(arms.filter(e=>e.use_filters).length,1);
 const gates=arms.filter(e=>cond(e)?.first_signal?.name==='signal-G');assert.equal(gates.length,1);
 const feedArm=gates[0];assert.equal(feedArm.entity_number,m.productionClock.recipeClock.feed.arm);
 assert.equal(cond(feedArm).comparator,'>');assert(!wiredRed(hub.entity_number,feedArm.entity_number),'the feed arm is not on the hub network');
 // unconditioned arms: product and collector arms
 assert.equal(arms.filter(e=>!cond(e)).length,arms.length-6);
 const constant=entities.find(e=>e.name==='constant-combinator');
 const filters=constant.control_behavior.sections.sections[0].filters;
 for(const n of ['metallic-asteroid-chunk','carbonic-asteroid-chunk','oxide-asteroid-chunk'])assert.equal(filters.find(f=>f.name===n).count,m.stockControl.caps.chunk);
 assert.equal(filters.find(f=>f.name==='signal-T').count,1);
 const negate=entities.find(e=>e.name==='arithmetic-combinator').control_behavior.arithmetic_conditions;
 assert.equal(negate.operation,'*');assert.equal(negate.second_constant,-1);assert.equal(negate.first_signal.name,'signal-each');
 const deciders=entities.filter(e=>e.name==='decider-combinator');assert.equal(deciders.length,5);
 const timer=byId.get(m.productionClock.timer);assert.equal(timer.control_behavior.decider_conditions.conditions[0].constant,900);
 assert(bp.wires.some(w=>w[0]===timer.entity_number&&w[2]===timer.entity_number&&w[1]===4&&w[3]===2),'timer feeds back on green');
 // the crusher: no fixed recipe, set by the circuit network, never on a green wire (item signals could pick a recipe)
 const rc=m.productionClock.recipeClock,crusher=byId.get(rc.crusher);
 assert.equal(crusher.name,'crusher');assert.equal(crusher.recipe,undefined);assert.deepEqual(crusher.control_behavior,{set_recipe:true});
 assert(!bp.wires.some(w=>(w[0]===crusher.entity_number&&w[1]===2)||(w[2]===crusher.entity_number&&w[3]===2)),'crusher has no green wire');
 // the recipe network: red wires joining the crusher, its feed arm and the four clock deciders' outputs, nothing else
 const node=(e,c)=>e+':'+c,adj=new Map();
 const isRed=(e,c)=>{const n=byId.get(e).name;return /combinator/.test(n)?c===1||c===3:c===1;};
 for(const [a,ca,b,cb] of bp.wires)if(isRed(a,ca)&&isRed(b,cb)){for(const [x,y] of [[node(a,ca),node(b,cb)],[node(b,cb),node(a,ca)]]){if(!adj.has(x))adj.set(x,[]);adj.get(x).push(y);}}
 const seen=new Set([node(crusher.entity_number,1)]),todo=[...seen];while(todo.length){for(const y of adj.get(todo.pop())||[])if(!seen.has(y)){seen.add(y);todo.push(y);}}
 const recipeDeciders=Object.values(rc.recipeDeciders).map(d=>d.decider);
 assert.deepEqual([...seen].sort(),[node(crusher.entity_number,1),node(feedArm.entity_number,1),...[...recipeDeciders,rc.feed.decider].map(d=>node(d,3))].sort(),'recipe network members');
 // one recipe decider per crushing recipe: its recipe signal (value 1) while T is in its window and its product is below the cap
 const crushStock={'oxide-asteroid-crushing':'ice','metallic-asteroid-crushing':'iron-ore','carbonic-asteroid-crushing':'carbon'};
 assert.deepEqual(Object.keys(rc.recipeDeciders).sort(),Object.keys(crushStock).sort());
 const spans=[];
 for(const [recipe,g] of Object.entries(rc.recipeDeciders)){
  const d=byId.get(g.decider),dc=d.control_behavior.decider_conditions;
  assert.deepEqual(dc.outputs,[{signal:{type:'recipe',name:recipe},copy_count_from_input:false}]);
  assert(wiredRed(hub.entity_number,d.entity_number),'recipe decider reads the hub on red '+recipe);
  assert.equal(g.stock,crushStock[recipe]);assert.equal(g.cap,m.stockControl.caps[g.stock]);
  for(const c of dc.conditions){if(c.first_signal.name==='signal-T')assert.deepEqual(c.first_signal_networks,{red:false,green:true});else{assert.deepEqual(c.first_signal_networks,{red:true,green:false});assert.equal(c.first_signal.name,g.stock);assert.equal(c.constant,g.cap);}}
  assert.equal(dc.conditions.length,3*g.windows.length);
  g.windows.forEach(([from,to],i)=>{assert.equal(dc.conditions[3*i].constant,from);assert.equal(dc.conditions[3*i].comparator,'≥');assert.equal(dc.conditions[3*i+1].constant,to);spans.push([from,to]);});
 }
 // the recipe windows tile the whole period without overlap (T counts 1..900)
 spans.sort((a,b)=>a[0]-b[0]);assert.equal(spans[0][0],1);for(let i=1;i<spans.length;i++)assert.equal(spans[i][0],spans[i-1][1]);assert.equal(spans.at(-1)[1],m.productionClock.period+1);
 // the feed decider: signal-G for the first 19 ticks of each recipe window, only while the accumulators hold their floor
 const feed=byId.get(rc.feed.decider),fc=feed.control_behavior.decider_conditions;
 assert.deepEqual(fc.outputs,[{signal:{type:'virtual',name:'signal-G'},copy_count_from_input:false}]);
 assert.deepEqual(rc.feed.windows.map(w=>w[0]),spans.map(w=>w[0]));for(const [from,to] of rc.feed.windows)assert.equal(to-from,19);
 const floor=m.power.chargeFloorPercent;assert(floor>0&&floor<100);assert.equal(rc.feed.chargeFloorPercent,floor);
 assert.equal(fc.conditions.length,3*rc.feed.windows.length);
 for(const c of fc.conditions)assert.deepEqual(c.first_signal_networks,{red:false,green:true});
 rc.feed.windows.forEach(([from,to],i)=>{assert.equal(fc.conditions[3*i].constant,from);assert.equal(fc.conditions[3*i+1].constant,to);assert.equal(fc.conditions[3*i+2].first_signal.name,'signal-A');assert.equal(fc.conditions[3*i+2].comparator,'≥');assert.equal(fc.conditions[3*i+2].constant,floor);});
 // the accumulator that reads its charge is on the green network
 const reader=byId.get(m.power.chargeReader);assert.equal(reader.name,'accumulator');assert.deepEqual(reader.control_behavior,{output_signal:{type:'virtual',name:'signal-A'}});
 assert(bp.wires.some(w=>(w[0]===reader.entity_number&&w[1]===2)||(w[2]===reader.entity_number&&w[3]===2)),'charge reader on green');
});

test('generator reproduces the committed string and manifest byte for byte',{skip:rawReadable?false:'prototype dump not readable here: regenerating the string needs FACTORIO_RAW'},async()=>{
 const out=fileURLToPath(new URL('.cache/white-platform/test-regenerate/',root));
 await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
 await fs.copyFile(new URL(dir+'native-report.json',root),out+'native-report.json');
 await promisify(execFile)(process.execPath,['scripts/white-platform/generate.mjs','--out',out],{cwd:rootPath,env:{...process.env,FACTORIO_RAW:rawPath}});
 assert.equal(await fs.readFile(out+'white-platform.txt','utf8'),(await read(dir+'white-platform.txt')).toString());
 assert.equal(await fs.readFile(out+'manifest.json','utf8'),(await read(dir+'manifest.json')).toString());
 assert(existsSync(out+'native-report.json'));
});
