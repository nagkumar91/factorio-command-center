// Robot logistics workshop (10/10/1/4/4 per minute), compact single-ring layout.
// One closed ring with four machine rows: two outside the ring (top and bottom) and two
// inside it, back to back across a middle aisle. The aisle carries the high-volume items
// that never touch the ring: copper and iron plates for the circuit block, the battery plants
// and the gear machine, and copper cable for the advanced-circuit machines.
// See blueprint-sources/robot-logistics-workshop/README.md.
// Ring, stock limits and latched production tokens follow scripts/robot-essentials;
// the cable hand-off block follows scripts/green-circuits.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
import {familyVersions} from '../blueprint-versions.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
const id='robot-logistics-workshop';
const OUT=process.env.RLW_OUT||'blueprint-sources/'+id;
// RLW_OPTIONS overrides limits, reserves and headroom for exploration runs (never for the published string).
const options=JSON.parse(process.env.RLW_OPTIONS||'{}');

// ---------------------------------------------------------------- targets
const targets={'construction-robot':10,'logistic-robot':10,roboport:1,'storage-chest':4,'passive-provider-chest':4};
const products=Object.keys(targets);
// Output chest caps: one full stack of each product (stack sizes in the prototype dump: robots 50, roboport 10, chests 50).
// The earlier twenty-robot string (history/twenty-robot-caps) is RLW_OPTIONS='{"caps":{"construction-robot":20,"logistic-robot":20,
// "roboport":2,"storage-chest":10,"passive-provider-chest":10}}'.
const caps={'construction-robot':50,'logistic-robot':50,roboport:10,'storage-chest':50,'passive-provider-chest':50,...options.caps};
const capText=products.map(p=>caps[p]+' '+(p==='construction-robot'?'construction robots':p==='logistic-robot'?'logistic robots':p==='roboport'?'roboports':p==='storage-chest'?'storage chests':'passive provider chests')).join(', ');
// Token periods run each product a little above its target so the measured rates clear the targets.
const headroom={'construction-robot':1.02,'logistic-robot':1.08,roboport:1.18,'storage-chest':1.111,'passive-provider-chest':1.111,...options.headroom};
const periodTicks=Object.fromEntries(products.map(p=>[p,Math.floor(3600/(targets[p]*headroom[p]))]));
const boundary=['iron-plate','copper-plate','steel-plate','plastic-bar','sulfuric-acid','lubricant'];
// Ring limits: an arm puts an item on the ring only while its ring count is below the limit.
const limits={
 'electronic-circuit':120,'steel-plate':104,'plastic-bar':64,'advanced-circuit':40,'iron-gear-wheel':32,'iron-plate':32,
 battery:24,pipe:16,'engine-unit':24,'electric-engine-unit':24,'flying-robot-frame':16,'steel-chest':8,
 'construction-robot':4,'logistic-robot':4,'storage-chest':4,'passive-provider-chest':4,roboport:2,
 ...options.limits};
// Reserves: an arm that feeds a big consumer of a shared item works only while the ring holds more than the reserve.
const reserves={'electronic-circuit':32,'steel-plate':16,'iron-gear-wheel':12,'advanced-circuit':12,...options.reserves};

// ---------------------------------------------------------------- recipe audit
const required={},crafts={};
function expand(item,n){
 if(boundary.includes(item)){required[item]=(required[item]||0)+n;return;}
 const r=raw.recipe[item];assert(r,item);const made=r.results.find(p=>p.name===item).amount;
 crafts[item]=(crafts[item]||0)+n/made;for(const i of r.ingredients)expand(i.name,n*i.amount/made);
}
for(const[p,n]of Object.entries(targets))expand(p,n);

// ---------------------------------------------------------------- placement
let next=1;const entities=[],wires=[],ports=[],occupied=new Map(),machineCounts={};
const key=(x,y)=>`${x},${y}`;
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function cellsOf(e){
 const p=protoOf(e.name);assert(p,e.name);
 let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);
 if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction)&&w!==h)[w,h]=[h,w];
 const out=[];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++)out.push([x,y]);return out;
}
function place(e){
 for(const[x,y]of cellsOf(e)){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}
 entities.push(e);return e;
}
const at=(x,y)=>occupied.get(key(x,y));
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra});
const belt=(x,y,d,extra={})=>add('fast-transport-belt',x,y,{direction:d,...extra});
const under=(x,y,d,type)=>add('fast-underground-belt',x,y,{direction:d,type});
const sig=name=>({type:raw.fluid?.[name]?'fluid':'item',name,quality:'normal'});
const virtual=name=>({type:'virtual',name});
const filters=items=>({use_filters:true,filters:items.map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))});
// An arm's direction is the side it picks from. Fast arms carry 1, bulk arms 2.
function arm(x,y,d,extra={}){
 const name=extra.name||'fast-inserter';
 return add(name,x,y,{direction:d,override_stack_size:name==='bulk-inserter'?2:1,...extra,name});
}
const cond=(item,comparator,constant)=>({circuit_enabled:true,circuit_condition:{first_signal:sig(item),comparator,constant}});

// ---------------------------------------------------------------- geometry
// Ring: top belt y=0 east, east column x=EAST south, bottom belt y=12 west, west column x=0 north.
// Rows: outer top y -4..-2 (arms y=-1), inner top y 2..4 (ring arms y=1, aisle arms y=5), aisle belt y=6,
// inner bottom y 8..10 (aisle arms y=7, ring arms y=11), outer bottom y 14..16 (arms y=13).
const EAST=48,TOP=0,BOTTOM=12,AISLE=6,WEST=-2;
const loop=[];
for(let x=0;x<EAST;x++)loop.push(belt(x,TOP,4));
loop.push(belt(EAST,TOP,8));
for(let y=TOP+1;y<BOTTOM;y++)loop.push(belt(EAST,y,8));
loop.push(belt(EAST,BOTTOM,12));
for(let x=EAST-1;x>0;x--)loop.push(belt(x,BOTTOM,12));
loop.push(belt(0,BOTTOM,0));
for(let y=BOTTOM-1;y>TOP;y--)loop.push(belt(0,y,0));
// Per-tile hold readers: every ring tile reports its own contents on red.
for(const e of loop)e.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:1};

const ringNodes=loop.map(e=>({entity:e,connector:1}));
const controlled=[],reserveArms=[];
const toRing=(e,item,limit=limits[item])=>{assert(limit>0,item);e.control_behavior={...e.control_behavior,...cond(item,'<',limit)};ringNodes.push({entity:e,connector:1});controlled.push(e.entity_number);return e;};
const reserveGate=(e,item)=>{e.control_behavior={...e.control_behavior,...cond(item,'>',reserves[item])};ringNodes.push({entity:e,connector:1});reserveArms.push({entity:e.entity_number,item,reserve:reserves[item]});return e;};

const machines=[];
function machine(recipe,cx,cy,direction=0){
 const name=recipe==='battery'?'chemical-plant':'assembling-machine-2';
 const e=add(name,cx,cy,{recipe,...(direction?{direction}:{})});
 machineCounts[recipe]=(machineCounts[recipe]||0)+1;machines.push({recipe,cx,cy,entity:e});return e;
}
// The four arm rows that touch the ring. pick = side of the ring seen from the arm row.
const rows={
 outerTop:{cy:-3,armY:-1,pick:8,flow:1},
 innerTop:{cy:3,armY:1,pick:0,flow:1},
 innerBottom:{cy:9,armY:11,pick:8,flow:-1},
 outerBottom:{cy:15,armY:13,pick:0,flow:-1},
};
const productArms={};
// A ring station: input arms on the upstream tiles, the output arm on the downstream tile.
// feeds: [{items, bulk, reserve}], out: 'ring' | 'product' | null, tiles: explicit arm columns in flow order.
function station(rowName,recipe,cx,feeds,{out='ring',direction=0,tiles}={}){
 const row=rows[rowName];machine(recipe,cx,row.cy,direction);
 const columns=tiles||(row.flow>0?[cx-1,cx,cx+1]:[cx+1,cx,cx-1]);
 assert(feeds.length+(out?1:0)<=columns.length,'arm tiles '+recipe);
 feeds.forEach((f,i)=>{
  const e=arm(columns[i],row.armY,row.pick,{...filters(f.items),...(f.bulk?{name:'bulk-inserter'}:{})});
  if(f.reserve)reserveGate(e,f.reserve);
 });
 if(!out)return;
 const e=arm(columns.at(-1),row.armY,(row.pick+8)%16);
 if(out==='product')productArms[recipe]=e;else toRing(e,recipe);
}

// ---------------------------------------------------------------- outer top row (ring flows east)
// Steel, gears and pipes meet the engine machines first. The pipe machine takes its iron from the ring.
station('outerTop','pipe',1,[{items:['iron-plate'],bulk:true},{items:['iron-plate'],bulk:true}]);
for(const cx of [4,7,10,13,16])station('outerTop','engine-unit',cx,[{items:['steel-plate','iron-gear-wheel']},{items:['pipe']}]);
const frameFeeds=[{items:['battery','electric-engine-unit']},{items:['steel-plate','electronic-circuit']}];
for(const cx of [19,22,25])station('outerTop','flying-robot-frame',cx,frameFeeds);
// The four small product machines use one input arm each and stand two tiles apart; the free tiles
// between them hold the combinators.
station('outerTop','construction-robot',28,[{items:['flying-robot-frame','electronic-circuit']}],{out:'product',tiles:[27,28]});
station('outerTop','logistic-robot',33,[{items:['flying-robot-frame','advanced-circuit']}],{out:'product',tiles:[33,34]});
station('outerTop','storage-chest',38,[{items:['steel-chest','electronic-circuit','advanced-circuit']}],{out:'product',tiles:[37,38]});
station('outerTop','passive-provider-chest',43,[{items:['steel-chest','electronic-circuit','advanced-circuit']}],{out:'product',tiles:[43,44]});

// ---------------------------------------------------------------- outer bottom row (ring flows west)
// Steel and advanced circuits pass the frame machines first; the steel-chest machine and the roboport,
// the two big consumers that run furthest above target, sit at the end of the line and take what is left.
for(const cx of [43,40,37,34,31,28,25])station('outerBottom','flying-robot-frame',cx,frameFeeds);
station('outerBottom','steel-chest',22,[{items:['steel-plate'],bulk:true,reserve:'steel-plate'}],{tiles:[23,21]});
// Five electric-engine machines share three gap columns that carry the lubricant.
const motorFeeds=[{items:['engine-unit','electronic-circuit']}];
station('outerBottom','electric-engine-unit',18,motorFeeds,{direction:4,tiles:[18,17]});
station('outerBottom','electric-engine-unit',15,motorFeeds,{direction:12,tiles:[16,15]});
station('outerBottom','electric-engine-unit',11,motorFeeds,{direction:4,tiles:[11,10]});
station('outerBottom','electric-engine-unit',8,motorFeeds,{direction:12,tiles:[9,8]});
station('outerBottom','electric-engine-unit',4,motorFeeds,{direction:4,tiles:[4,3]});
station('outerBottom','roboport',1,[{items:['iron-gear-wheel'],bulk:true,reserve:'iron-gear-wheel'},{items:['steel-plate','advanced-circuit'],bulk:true,reserve:'advanced-circuit'}],{out:'product'});

// ---------------------------------------------------------------- inner rows and the aisle
// Aisle arms: top row at y=5 picks from the aisle to its south, bottom row at y=7 from its north.
const aisleRows=[{name:'innerTop',cy:3,armY:5,pick:8},{name:'innerBottom',cy:9,armY:7,pick:0}];
// West end: three battery plants around the acid gap column and the gear machine. They take their plates
// straight from plate belt A, a queue, so a plant never waits for copper while it holds iron.
station('innerTop','battery',2,[],{direction:4,tiles:[2]});arm(3,5,8,filters(['iron-plate','copper-plate']));
station('innerTop','battery',6,[],{direction:12,tiles:[7]});arm(5,5,8,filters(['iron-plate','copper-plate']));
station('innerBottom','battery',2,[],{direction:4,tiles:[1]});arm(3,7,0,filters(['iron-plate','copper-plate']));
station('innerBottom','iron-gear-wheel',6,[],{tiles:[5]});
for(const x of [5,6])arm(x,7,0,{...filters(['iron-plate']),name:'bulk-inserter'});
// Circuit block (after green-circuits): C E C E C per row, cable handed over in the gaps.
const circuitColumns=[{cx:9,recipe:'copper-cable'},{cx:13,recipe:'electronic-circuit'},{cx:17,recipe:'copper-cable'},{cx:21,recipe:'electronic-circuit'},{cx:25,recipe:'copper-cable'}];
const plateArmColumn={9:10,13:13,17:17,21:21,25:26};
for(const row of aisleRows){
 for(const c of circuitColumns){
  if(c.recipe==='electronic-circuit')station(row.name,c.recipe,c.cx,[],{tiles:[c.cx]});
  else machine(c.recipe,c.cx,row.cy);
  arm(plateArmColumn[c.cx],row.armY,row.pick,filters([c.recipe==='copper-cable'?'copper-plate':'iron-plate']));
 }
 // Outer cable machines give everything to one circuit machine (bulk, hand 2); the middle one splits (fast, hand 1 each).
 arm(11,row.cy,12,{name:'bulk-inserter'});arm(15,row.cy,4);arm(19,row.cy,12);arm(23,row.cy,4,{name:'bulk-inserter'});
 // Cable machine for the advanced-circuit machines: copper from the end of belt A, cable onto the cable belt.
 machine('copper-cable',28,row.cy);
 arm(28,row.armY,row.pick,filters(['copper-plate']));
 arm(29,row.armY,(row.pick+8)%16,{name:'bulk-inserter'});
}
// Advanced-circuit machines: circuits and plastic from the ring, cable from the aisle.
const redColumns=[31,34,37,40,43,46],cableArmColumn={31:30,34:33,37:36,40:39,43:44,46:45};
for(const row of aisleRows)for(const cx of redColumns){
 station(row.name,'advanced-circuit',cx,[{items:['electronic-circuit'],reserve:'electronic-circuit'},{items:['plastic-bar']}]);
 arm(cableArmColumn[cx],row.armY,row.pick,filters(['copper-cable']));
}
// Plate belt A: copper on the north lane, iron on the south lane; ends in a dead-end curve under the cable machines.
const entrance={};
entrance['copper-plate']=under(WEST,5,4,'input');under(1,5,4,'output');belt(2,5,8);
entrance['iron-plate']=under(WEST,7,4,'input');under(1,7,4,'output');belt(2,7,0);
const holes=[7,23,41]; // substation holes on tiles (x..x+1, 5..6); the aisle belt dives under them
function aisleBelt(from,to){
 for(let x=from;x<=to;x++){
  if(holes.some(h=>x===h||x===h+1))continue;
  if(holes.includes(x+1))under(x,AISLE,4,'input');else if(holes.includes(x-2))under(x,AISLE,4,'output');else belt(x,AISLE,4);
 }
}
aisleBelt(2,27);belt(28,AISLE,0);
// Cable belt: both lanes cable (top machine fills the south lane, bottom machine the north lane); dead end at x=46.
aisleBelt(29,46);
assert(!at(47,AISLE),'cable belt must dead-end');

// ---------------------------------------------------------------- ports
function port(kind,item,e,side='west'){
 const p={kind,label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position,externalSide:side,...(kind==='input'?{direction:4}:{}),perMinute:required[item]};
 ports.push(p);return p;
}
// Entrances north to south: acid, plastic, copper, iron, steel, lubricant.
const pipes={'sulfuric-acid':[],lubricant:[]};
const pipe=(fluid,x,y)=>{const e=add('pipe',x,y);pipes[fluid].push(e);return e;};
const dive=(fluid,x,y,d)=>{const e=add('pipe-to-ground',x,y,{direction:d});pipes[fluid].push(e);return e;};
{
 // Acid dives under the ring's west column and the first plant's arm, fills the gap column between the two
 // top plants and dives again under belt A to the bottom plant.
 const e=dive('sulfuric-acid',WEST,1,12);dive('sulfuric-acid',3,1,4);
 for(const y of [1,2,3,4])pipe('sulfuric-acid',4,y);
 dive('sulfuric-acid',4,5,0);dive('sulfuric-acid',4,7,8);
 for(const y of [8,9,10])pipe('sulfuric-acid',4,y);
 port('fluid','sulfuric-acid',e);
}
const gates=[];
// Plastic and steel wait on a one-tile entrance belt; a gated bulk arm outside the ring drops them on the
// ring's inner lane, which keeps the outer lane free for what the inner rows put on it.
function admission(item,y){const e=belt(WEST,y,4);const g=arm(WEST+1,y,12,{...filters([item]),name:'bulk-inserter'});toRing(g,item);gates.push(g);port('input',item,e);}
admission('plastic-bar',2);
port('input','copper-plate',entrance['copper-plate']);
port('input','iron-plate',entrance['iron-plate']);
// Iron for the pipe machine: an arm takes it from the iron entrance before it dives under the ring. It works
// only while the ring is short of pipes (see the iron decider), so iron arrives when the pipe machine needs it
// instead of circling as a stock.
const ironGate=arm(WEST+1,7,12,{...filters(['iron-plate']),control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:virtual('signal-P'),comparator:'>',constant:0}}});gates.push(ironGate);
admission('steel-plate',9);
{
 // Lubricant along the outer bottom arm row, underground beneath the roboport and electric-engine arms.
 const e=dive('lubricant',WEST,13,12);dive('lubricant',5,13,4);
 for(const y of [13,14,15])pipe('lubricant',6,y);
 dive('lubricant',7,13,12);dive('lubricant',12,13,4);
 for(const y of [13,14,15])pipe('lubricant',13,y);
 dive('lubricant',14,13,12);dive('lubricant',19,13,4);
 for(const y of [13,14,15])pipe('lubricant',20,y);
 port('fluid','lubricant',e);
}
for(const a of pipes['sulfuric-acid'])for(const b of pipes.lubricant)assert(Math.abs(a.position.x-b.position.x)+Math.abs(a.position.y-b.position.y)>1,'acid next to lubricant');

// ---------------------------------------------------------------- output chest and collector
// The collector sits above the ring's north-east corner and picks from the curve; the chest is above it on the east edge.
const chest=add('passive-provider-chest',EAST,-2);
const collector=arm(EAST,-1,8,{use_filters:true,control_behavior:{circuit_set_filters:true,circuit_read_hand_contents:true,circuit_hand_read_mode:1,input_networks:{red:true,green:false},output_networks:{red:false,green:true}}});

// ---------------------------------------------------------------- substations
// Three substations in aisle holes; centre row 6 reaches both outer machine rows.
const substations=holes.map(x=>place({entity_number:next++,name:'substation',position:{x:x+1,y:AISLE}}));
for(let i=1;i<substations.length;i++)wires.push([substations[i-1].entity_number,5,substations[i].entity_number,5]);

// ---------------------------------------------------------------- combinator slots
// Free 1x2 cells; horizontal slots use direction 4, vertical slots direction 0. Each slot belongs to a pool:
// 'top' (beside the product machines), 'aisle' (timer, modulo and latch cluster) or 'west' (roboport).
const slots=[];let pool='top';
const hslot=(x,y)=>slots.push({pool,x:x+1,y:y+.5,direction:4,cells:[[x,y],[x+1,y]]});
const vslot=(x,y)=>slots.push({pool,x:x+.5,y:y+1,direction:0,cells:[[x,y],[x,y+1]]});
for(const x of [29,31,35,39,41,45])hslot(x,-1);
for(const x of [30,35,40,45])hslot(x,-2);
for(const x of [30,31,35,36,40,41,45,46,47])vslot(x,-4);
vslot(47,-2);
pool='aisle';
for(const x of [31,34,37,46])hslot(x,5);
for(const x of [31,34,37,40,42,46])hslot(x,7);
for(const x of [24,27])for(const y of [1,11])hslot(x,y);
pool='west';
for(const y of [3,5,10])vslot(-1,y);
const panelSpots={'sulfuric-acid':[WEST,0],'plastic-bar':[WEST,3],'copper-plate':[WEST,4],'iron-plate':[WEST,6],'steel-plate':[WEST,8],lubricant:[WEST,12]};
const free=s=>s.cells.every(([x,y])=>!occupied.has(key(x,y)));
function combinator(name,anchor,extra){
 let best;for(const s of slots){if(s.pool!==pool||!free(s))continue;const d=Math.hypot(s.x-anchor.x,s.y-anchor.y);if(!best||d<best.d)best={s,d};}
 assert(best,'no combinator slot for '+name);
 return place({entity_number:next++,name,position:{x:best.s.x,y:best.s.y},direction:best.s.direction,...extra});
}
const decider=(anchor,conditions,outputs,tags)=>combinator('decider-combinator',anchor,{...(tags?{tags}:{}),control_behavior:{decider_conditions:{conditions,outputs}}});
const arithmetic=(anchor,first,operation,second,output)=>combinator('arithmetic-combinator',anchor,{control_behavior:{arithmetic_conditions:{first_signal:first,operation,second_constant:second,output_signal:output}}});
const c=(signal,comparator,constant,compare_type)=>({first_signal:signal,comparator,constant,...(compare_type?{compare_type}:{})});
const one=signal=>({signal,copy_count_from_input:false,constant:1});

// Networks: lists of {entity, connector}; wired below as short spanning trees.
const networks={ring:{color:'red',nodes:ringNodes}};
const net=(name,color,...nodes)=>{(networks[name]??={color,nodes:[]}).nodes.push(...nodes);};

// Iron decider: iron may enter the ring while pipes are below their limit and iron is below its own.
pool='west';
const ironDecider=decider({x:-.5,y:4},[c(sig('pipe'),'<',limits.pipe),c(sig('iron-plate'),'<',limits['iron-plate'],'and')],[one(virtual('signal-P'))]);
net('ring','red',{entity:ironDecider,connector:1});net('iron-gate','green',{entity:ironDecider,connector:4},{entity:ironGate,connector:2});

// Production tokens (latched): timer -> per-product modulo -> latch holds a token from each
// period start until the output arm holds the product; the permission decider also needs ring stock below the limit.
const tokenSignals=['signal-K','signal-L','signal-M','signal-N','signal-O'],resetSignals=['signal-U','signal-V','signal-W','signal-Y','signal-Z'];
const robotTokens={},moduloEntities={};
const tokenParts=[];
// Slot centres for each product's permission decider and hand-reset combinator, all within wire reach of its output arm.
const tokenAnchors={
 'construction-robot':[{x:30,y:-.5},{x:32,y:-.5}],'logistic-robot':[{x:36,y:-.5},{x:36,y:-1.5}],roboport:[{x:-.5,y:11},{x:-.5,y:6}],
 'storage-chest':[{x:40,y:-.5},{x:42,y:-.5}],'passive-provider-chest':[{x:46,y:-.5},{x:46,y:-1.5}]};
products.forEach((item,i)=>{
 const out=productArms[item];assert(out,item);
 const token=virtual(tokenSignals[i]),reset=virtual(resetSignals[i]);
 const[permissionAnchor,resetAnchor]=tokenAnchors[item];pool=item==='roboport'?'west':'top';
 const permission=decider(permissionAnchor,[c(sig(item),'<',limits[item]),c(token,'>',0,'and'),c(reset,'>',0,'or')],[one(virtual('signal-G'))]);
 const handReset=arithmetic(resetAnchor,sig(item),'*',1,reset);
 out.control_behavior={circuit_enabled:true,circuit_read_hand_contents:true,circuit_hand_read_mode:1,circuit_condition:{first_signal:virtual('signal-G'),comparator:'>',constant:0}};
 net('ring','red',{entity:permission,connector:1});
 net('permission-'+item,'red',{entity:permission,connector:3},{entity:out,connector:1});
 net('hand-'+item,'green',{entity:out,connector:2},{entity:handReset,connector:2});
 net('bus','green',{entity:permission,connector:2},{entity:handReset,connector:4});
 tokenParts.push({item,i,permission,handReset,out,token,reset});
});
// Collector: five deciders, product in chest + in hand < cap -> product filter.
net('chest','green',{entity:chest,connector:2},{entity:collector,connector:2});
net('filters','red',{entity:collector,connector:1});
const stockDeciders={};pool='top';
for(const item of products){
 const d=decider({x:47.5,y:-2},[c(sig(item),'<',caps[item])],[one(sig(item))],{stock_control:true});
 stockDeciders[item]=d.entity_number;net('chest','green',{entity:d,connector:2});net('filters','red',{entity:d,connector:3});
}

const tokenAnchor={x:38,y:6.5,...options.tokenAnchor};
pool='aisle';
for(const t of tokenParts){
 const signal=virtual('signal-'+String.fromCharCode(65+t.i));
 const latch=decider(tokenAnchor,[c(t.reset,'=',0),c(signal,'=',0,'and'),c(t.reset,'=',0,'or'),c(t.token,'>',0,'and')],[one(t.token)]);
 const mod=arithmetic(latch.position,virtual('signal-T'),'%',periodTicks[t.item],signal);
 net('bus','green',{entity:latch,connector:2},{entity:latch,connector:4});
 net('phase-'+t.item,'red',{entity:mod,connector:3},{entity:latch,connector:1});
 net('timer','red',{entity:mod,connector:1});
 moduloEntities[t.item]=mod.entity_number;
 robotTokens[t.item]={latch:latch.entity_number,permission:t.permission.entity_number,handReset:t.handReset.entity_number,output:t.out.entity_number,tokenSignal:t.token.name,resetSignal:t.reset.name};
}
const timer=arithmetic(tokenAnchor,virtual('signal-T'),'+',1,virtual('signal-T'));
net('timer','red',{entity:timer,connector:3},{entity:timer,connector:1});
// The substations may carry the timer wire (red) and the token bus (green) across longer gaps.
for(const e of substations){net('timer','red',{entity:e,connector:1,relay:true});net('bus','green',{entity:e,connector:2,relay:true});}

// ---------------------------------------------------------------- labels
for(const p of ports.filter(p=>p.kind==='input'||p.kind==='fluid')){
 const[x,y]=panelSpots[p.items[0]];
 assert(Math.max(Math.abs(x+.5-p.x),Math.abs(y+.5-p.y))<=2,'panel too far '+p.label);
 const text=`IN: ${p.items[0]}\nWEST · ${p.perMinute}/min at nominal target`;
 const e=add('display-panel',x,y,{icon:{type:p.kind==='fluid'?'fluid':'item',name:p.items[0]},text,always_show:true});p.displayEntity=e.entity_number;
}
const outputPort={kind:'output',label:'finished-products',items:products,entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:chest.position,externalSide:'east',caps};
ports.push(outputPort);

// ---------------------------------------------------------------- circuit wiring
// Prim spanning tree per network, every wire at most 8.8 tiles centre to centre (the game allows 9; 18 between substations).
// Relay nodes (substations) join a tree only when a required node needs them as a bridge.
const wireLength=8.8;
// Two substations may be wired over their own wire reach (18 tiles), like their copper cable.
const reach=(a,b)=>a.entity.name==='substation'&&b.entity.name==='substation'?18:wireLength;
for(const[name,n]of Object.entries(networks)){
 const nodes=n.nodes,inTree=new Set([0]);
 const d=(a,b)=>Math.hypot(a.entity.position.x-b.entity.position.x,a.entity.position.y-b.entity.position.y);
 const edges=[];
 while(nodes.some((node,j)=>!node.relay&&!inTree.has(j))){
  // Prefer a required node; fall back to a relay only when no required node is in reach.
  let best;
  for(const wantRelay of [false,true]){
   for(const i of inTree)for(let j=0;j<nodes.length;j++){if(inTree.has(j)||!!nodes[j].relay!==wantRelay)continue;const dist=d(nodes[i],nodes[j]);if(dist<=reach(nodes[i],nodes[j])&&(!best||dist<best.dist))best={i,j,dist};}
   if(best)break;
  }
  if(!best)console.error(name,nodes.map(n=>[n.entity.name,n.entity.position.x,n.entity.position.y,n.connector]));
  assert(best,`network ${name} cannot be wired within ${wireLength} tiles`);
  inTree.add(best.j);edges.push(best);
 }
 // Drop relay leaves that bridge nothing.
 for(let changed=true;changed;){changed=false;for(let k=edges.length-1;k>=0;k--){const j=edges[k].j;if(nodes[j].relay&&!edges.some(e=>e.i===j)){edges.splice(k,1);changed=true;}}}
 for(const e of edges){
  if(nodes[e.i].entity===nodes[e.j].entity&&nodes[e.i].connector===nodes[e.j].connector)continue;
  wires.push([nodes[e.i].entity.entity_number,nodes[e.i].connector,nodes[e.j].entity.entity_number,nodes[e.j].connector]);
 }
}
// A connector belongs to exactly one network.
{const owner=new Map();for(const[name,n]of Object.entries(networks))for(const node of n.nodes){const k=node.entity.entity_number+':'+node.connector;assert(!owner.has(k)||owner.get(k)===name,`connector ${k} in ${owner.get(k)} and ${name}`);owner.set(k,name);}}

// ---------------------------------------------------------------- power port, identity tags
// The east substation is the named power port: its supply area reaches free ground east of the ring.
const powerPole=substations.at(-1);
ports.push({kind:'power',items:[],entity:powerPole.entity_number,x:powerPole.position.x,y:powerPole.position.y});
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

// ---------------------------------------------------------------- blueprint and manifest
const label='Robot logistics workshop · 10/10/1/4/4 per minute';
const description='Factorio 2.1.24 Space Age, normal quality: AM2 and chemical plants, no modules, red belts, fast and bulk inserters, substations. WEST entrances north to south: sulfuric acid (pipe), plastic, copper, iron, steel (belts), lubricant (pipe). EAST: one passive provider chest with independent caps '+capText+'. All circuits, cable, gears, pipes, engines, batteries, frames and steel chests are made inside. Preserve the red ring wires (per-tile hold readers), the green chest and token wires, filters and caps. Supply electricity at any substation; the three are wired together.';
const bp={item:'blueprint',version:562954249961472,label,description,entities,wires,icons:products.slice(0,4).map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
// Keep the committed string when it decodes to exactly this blueprint (another zlib build may compress the same
// JSON differently), so its SHA-256 and native report stay valid everywhere.
const committed=await fs.readFile(OUT+'/'+id+'.txt','utf8').then(t=>t.trim(),()=>null);
const sameBlueprint=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
const code=committed&&sameBlueprint(committed)?committed:encodeBlueprint({blueprint:bp});
const boundsRaw={...raw,container:{...raw.container,...raw['logistic-container']},'arithmetic-combinator':{...raw['arithmetic-combinator'],...raw['decider-combinator'],...raw['constant-combinator']}};
const footprint=starterBounds(entities,boundsRaw);
const capacity=loop.length*8,maximumStock=Object.values(limits).reduce((a,b)=>a+b,0);
assert(maximumStock<=0.6*capacity,`ring limits ${maximumStock} above 60% of ${capacity}`);
const portView=kind=>ports.filter(p=>p.kind===kind).map(p=>({...p,item:p.items[0]}));
const manifest={
 id,name:label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),
 products,targets,outputCaps:caps,
 recipeAudit:{externalPerMinute:required,craftsPerMinute:crafts,recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,raw.recipe[n].ingredients]))},
 ports,inputs:portView('input'),fluids:portView('fluid'),
 outputs:products.map(item=>({item,entity:chest.entity_number,position:chest.position,externalSide:'east',cap:caps[item]})),
 machineCounts,footprint,areaTiles:footprint.width*footprint.height,
 loopReturnCorner:at(0,TOP).entity_number,
 loopControl:[{name:id,reader:loop[0].entity_number,readerMode:'per-tile-hold',loop:loop.map(e=>e.entity_number),controlled,reserves:reserveArms,gates:gates.map(e=>e.entity_number),ironGate:{arm:ironGate.entity_number,decider:ironDecider.entity_number,pipeLimit:limits.pipe,ironLimit:limits['iron-plate']},limits,reserveLevels:reserves,capacity,maximumStock}],
 stockControl:{mode:'five deciders, independent chest item < cap; dynamic collector filters',collector:collector.entity_number,chest:chest.entity_number,caps,deciders:stockDeciders},
 productionClock:{headroom,timer:timer.entity_number,moduloEntities,robotTokens,periodTicks},
 substations:substations.map(e=>e.entity_number),
 // Protocol minutes. The chest starts empty, so the closed hold and each selective settle must outlast the time one product
 // needs to reach its cap at the measured rate (storage chests: 50 at about 4.4 per minute is 11.4 minutes).
 protocol:{warmupMinutes:15,measureMinutes:30,blockedMinutes:15,settleMinutes:5,recoveryMinutes:10,selectivePhases:products.length,selectiveSettleMinutes:15,selectiveMeasureMinutes:10,...options.protocol},
 construction:Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length])),
 setupNotes:[description,
  'Leave the shared chest unrestricted (no bar). Caps: '+capText+'; they live in the five filter deciders. The chest has 48 slots and the five products at their caps fill five.',
  'The entrance panels show recipe totals at the targets. The production tokens run the products a little above target, so plan supply for the measured draw in the README, not for the panels.',
  'Do not remove the red wires from ring tiles or the circuit conditions on the arms; the three arms on the west edge (plastic, iron, steel) are the ring entrances.'],
};
await fs.mkdir(OUT,{recursive:true});
await fs.writeFile(OUT+'/'+id+'.txt',code+'\n');
// Tested versions, newest first (scripts/blueprint-versions.mjs): the full-stack string and the twenty-robot string it
// replaced, kept complete in history/ with its own passing report. Only for the published string when the folder holds both.
const olderDir='history/twenty-robot-caps',hasOlder=await fs.access(OUT+'/'+olderDir+'/manifest.json').then(()=>true,()=>false);
let qualified=false;
try{const r=JSON.parse(await fs.readFile(OUT+'/native-report.json'));qualified=r.passed===true&&r.short!==true&&r.builds?.[0]?.blueprintSha256===sha(code);}catch{}
if(qualified&&hasOlder&&!options.caps)manifest.versions=await familyVersions(OUT,[
 {label:'Full-stack caps',summary:'The chest holds one full stack of each product: 50 construction robots, 50 logistic robots, 10 roboports, 50 storage chests and 50 passive provider chests before the collector stops taking that product.',file:id+'.txt',width:footprint.width,height:footprint.height,report:'native-report.json'},
 {label:'Twenty-robot caps',summary:'The earlier string: the chest stops at 20 construction robots, 20 logistic robots, 2 roboports, 10 storage chests and 10 passive provider chests. Same layout, machines and rates.',file:olderDir+'/'+id+'.txt',manifest:olderDir+'/manifest.json',report:olderDir+'/native-report.json'}]);
await fs.writeFile(OUT+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,out:OUT,footprint,area:footprint.width*footprint.height,machines:Object.values(machineCounts).reduce((a,b)=>a+b,0),machineCounts,entities:entities.length,required,blueprintSha256:manifest.blueprintSha256,maximumStock,capacity}));
