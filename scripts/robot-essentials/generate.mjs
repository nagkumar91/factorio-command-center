// Robot essentials: the smaller robot workshop (5/5/0.5/2/2 per minute).
// One single-loop ring with three machine rows, electronic circuits supplied.
// Structure and control patterns follow scripts/robot-logistics-workshop and
// scripts/rgby-science/frames.mjs; see blueprint-sources/robot-essentials/README.md.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerFiveLayout} from './power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
const id='robot-essentials';
const OUT=process.env.RE_OUT||'blueprint-sources/'+id;
// Layout options. The defaults are the published design; RE_OPTIONS overrides them
// for exploration and for reproducing history/ candidates, e.g.
// RE_OPTIONS='{"rear":true,"acid":"row","gearArms":1}' rebuilds the first qualified layout.
const options={rear:false,acid:'west',gearArms:2,cornerChest:true,...JSON.parse(process.env.RE_OPTIONS||'{}')};
// Two-speed token clock (published). The timer adds `base` every tick, which paces the products
// for supply at exactly the entrance panel figures (`nominal` times the targets). One decider,
// the supply gate, adds `boost` more while every gated item's ring stock is above its threshold:
// plastic and copper (the tightest entrances), steel, and four stocks that fall when another
// entrance or a fluid runs short (gears for iron, advanced circuits for electronic circuits,
// batteries for sulfuric acid, electric engines for lubricant). That only holds when the
// entrances deliver more than the panels say. A one-speed clock fast enough for the old measured
// rates overdraws the panels (history/one-speed-timer-d2c80909); one slow enough for the panels
// would lower the measured rates. supplyGate:false rebuilds the earlier free-running timer,
// machine order and reserves.
const supplyGate=options.supplyGate===false?null:{base:8,boost:1,...options.supplyGate,thresholds:options.supplyGate?.thresholds||{'plastic-bar':18,'copper-plate':20,'steel-plate':16,'iron-gear-wheel':10,'advanced-circuit':8,battery:6,'electric-engine-unit':3}};
const nominal={'construction-robot':0.98,'logistic-robot':0.975,roboport:1.012,'storage-chest':0.985,'passive-provider-chest':0.985,...options.nominal};

// ---------------------------------------------------------------- targets
const targets={'construction-robot':5,'logistic-robot':5,roboport:0.5,'storage-chest':2,'passive-provider-chest':2};
const products=Object.keys(targets);
const caps={'construction-robot':20,'logistic-robot':20,roboport:2,'storage-chest':10,'passive-provider-chest':10};
const headroom={'construction-robot':1.05,'logistic-robot':1.08,roboport:1.15,'storage-chest':1.1,'passive-provider-chest':1.1,...options.headroom};
// Free-running timer: one unit per tick. Two-speed clock: `base` or `base+boost` units per tick.
const periodTicks=Object.fromEntries(products.map(p=>[p,Math.floor(3600/(targets[p]*headroom[p]))]));
const periodUnits=supplyGate?Object.fromEntries(products.map(p=>[p,Math.floor(3600*supplyGate.base/(targets[p]*nominal[p]))])):periodTicks;
const boundary=['electronic-circuit','iron-plate','copper-plate','steel-plate','plastic-bar','sulfuric-acid','lubricant'];

// rear:true: plastic and cable ride a dead-end rear belt behind the advanced-circuit
// machines (two extra rows). rear:false (published): both ride the ring, plastic
// through a fifth gated entrance.
const rear=options.rear===true;
// acid:'west' (ring-fed only, published): both battery plants face west at the west ends of
// the top and bottom rows; one acid entrance feeds them through an underground
// pipe beneath the ring's west column, so no acid header row is needed.
const acidWest=!rear&&options.acid==='west';
// Ring limits (item < limit on every arm or gate that puts the item on the ring).
const limits=rear?{
 'electronic-circuit':64,'steel-plate':40,'iron-plate':40,'copper-plate':36,
 'advanced-circuit':32,'iron-gear-wheel':32,pipe:12,battery:12,
 'engine-unit':6,'electric-engine-unit':6,'flying-robot-frame':6,'steel-chest':4,
 'construction-robot':4,'logistic-robot':4,'storage-chest':4,'passive-provider-chest':4,roboport:2,
 ...options.limits}:{
 'electronic-circuit':64,'iron-plate':36,'copper-plate':32,'steel-plate':32,'plastic-bar':24,'copper-cable':52,
 'advanced-circuit':24,'iron-gear-wheel':24,pipe:12,battery:12,
 'engine-unit':6,'electric-engine-unit':6,'flying-robot-frame':6,'steel-chest':4,
 'construction-robot':4,'logistic-robot':4,'storage-chest':4,'passive-provider-chest':4,roboport:2,
 ...options.limits};
// Reserves (item > reserve) on arms that feed upstream consumers of a shared item.
const reserves={'electronic-circuit':16,'iron-plate':8,'steel-plate':8,'iron-gear-wheel':8,'advanced-circuit':8,...options.reserves};
// roboportLast (published): the roboport sits west of the three engine machines on the bottom
// row, so on the one-way ring it is the last machine offered steel, gears and advanced circuits
// and its two-craft buffer only ever takes what the others left. false is the earlier order
// (roboport east of the engines, first at their steel and gears).
const roboportLast=options.roboportLast??(options.supplyGate!==false);
// The roboport's steel and advanced-circuit arm leaves more advanced circuits on the ring
// (published: 16, earlier 8), so the ring's advanced-circuit count stays a usable health signal
// for the supply gate and the logistic robot and chest machines are never left with scraps.
const roboportAdvancedReserve=options.roboportAdvancedReserve??(options.supplyGate===false?reserves['advanced-circuit']:16);
// The cable machine is upstream of the bottom battery plant for copper; with a reserve
// (published: 8, earlier none) it cannot take the last copper on the ring.
const cableCopperReserve=options.cableCopperReserve??(options.supplyGate===false?null:8);
// The gear machine is the first iron user on the route and the roboport's 45 gears keep it
// hungry, so its reserve is higher (published: 16) than the pipe machine's (8): when iron is
// tight the ring still carries iron round to the pipe machine and the bottom battery plant.
const gearIronReserve=options.gearIronReserve??(options.supplyGate===false?reserves['iron-plate']:16);
const pipeIronReserve=options.pipeIronReserve??reserves['iron-plate'];

// ---------------------------------------------------------------- recipe audit
const required={},crafts={};
function expand(item,n){
 if(boundary.includes(item)){required[item]=(required[item]||0)+n;return;}
 const r=raw.recipe[item];assert(r,item);const made=r.results.find(p=>p.name===item).amount;
 crafts[item]=(crafts[item]||0)+n/made;for(const i of r.ingredients)expand(i.name,n*i.amount/made);
}
for(const[p,n]of Object.entries(targets))expand(p,n);
const round1=v=>Math.round(v*10)/10;
// Each product's own share of the entrance figures at its target (for the pace arithmetic).
const perProduct={};
{const total={...required},totalCrafts={...crafts};
 for(const[p,n]of Object.entries(targets)){for(const k of Object.keys(required))delete required[k];expand(p,n);perProduct[p]=Object.fromEntries(Object.entries(required).map(([k,v])=>[k,Math.round(v*1000)/1000]));}
 for(const k of Object.keys(required))delete required[k];Object.assign(required,total);for(const k of Object.keys(crafts))delete crafts[k];Object.assign(crafts,totalCrafts);}
for(const k of Object.keys(required))required[k]=round1(required[k]);
for(const k of Object.keys(crafts))crafts[k]=Math.round(crafts[k]*1000)/1000;

// ---------------------------------------------------------------- placement
let next=1;const entities=[],wires=[],ports=[],occupied=new Map(),machineCounts={};
const key=(x,y)=>`${x},${y}`;
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function cellsOf(e){
 const p=protoOf(e.name);assert(p,e.name);
 let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);
 if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];
 const out=[];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++)out.push([x,y]);return out;
}
function place(e){
 for(const[x,y]of cellsOf(e)){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}
 entities.push(e);return e;
}
const at=(x,y)=>occupied.get(key(x,y));
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra});
const belt=(x,y,d,extra={})=>add('fast-transport-belt',x,y,{direction:d,...extra});
const sig=name=>({type:raw.fluid?.[name]?'fluid':'item',name,quality:'normal'});
const virtual=name=>({type:'virtual',name});
const filters=items=>({use_filters:true,filters:items.map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))});
function arm(x,y,d,extra={}){
 const name=extra.name||'fast-inserter';
 return add(name,x,y,{direction:d,override_stack_size:name==='bulk-inserter'?2:1,...extra,name});
}
const cond=(item,comparator,constant)=>({circuit_enabled:true,circuit_condition:{first_signal:sig(item),comparator,constant}});

// ---------------------------------------------------------------- geometry
// Ring: top belt y=0 east, east column x=EAST south, bottom belt y=6 west,
// west column x=0 north. Machine slots are three tiles wide at x=3k-2..3k.
const EAST=31,TOP=0,BOTTOM=6,slotX=k=>3*k-1;
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
const toRing=(e,item,limit=limits[item])=>{e.control_behavior={...e.control_behavior,...cond(item,'<',limit)};ringNodes.push({entity:e,connector:1});controlled.push(e.entity_number);return e;};
const reserveGate=(e,item,reserve=reserves[item])=>{e.control_behavior={...e.control_behavior,...cond(item,'>',reserve)};ringNodes.push({entity:e,connector:1});reserveArms.push({entity:e.entity_number,item,reserve});return e;};

const machines=[];
function machine(recipe,cx,cy,direction=0){
 const name=recipe==='battery'?'chemical-plant':'assembling-machine-2';
 const e=add(name,cx,cy,{recipe,...(direction?{direction}:{})});
 machineCounts[recipe]=(machineCounts[recipe]||0)+1;machines.push({recipe,cx,cy,entity:e});return e;
}

// TOP ROW (y -4..-2): picks from and drops on the top belt (arms at y=-1).
const topRecipes=acidWest?['battery','iron-gear-wheel','steel-chest','copper-cable',...Array(6).fill('advanced-circuit')]:['battery','battery','steel-chest','copper-cable',...Array(6).fill('advanced-circuit')];
const productArms={};
topRecipes.forEach((recipe,i)=>{
 const cx=slotX(i+1),cy=-3;machine(recipe,cx,cy,acidWest&&recipe==='battery'?12:0);
 if(recipe==='iron-gear-wheel'){
  reserveGate(arm(cx-1,-1,8,{...filters(['iron-plate']),name:'bulk-inserter'}),'iron-plate',gearIronReserve);
  if(options.gearArms===2)reserveGate(arm(cx,-1,8,{...filters(['iron-plate']),name:'bulk-inserter'}),'iron-plate',gearIronReserve);
  toRing(arm(cx+1,-1,0),'iron-gear-wheel');
 }else if(recipe==='battery'){
  arm(cx+1,-1,8,filters(['iron-plate','copper-plate']));
  toRing(arm(cx-1,-1,0),'battery');
 }else if(recipe==='steel-chest'){
  reserveGate(arm(cx-1,-1,8,filters(['steel-plate'])),'steel-plate');
  toRing(arm(cx+1,-1,0),'steel-chest');
 }else if(recipe==='copper-cable'){
  if(cableCopperReserve===null)arm(cx-1,-1,8,filters(['copper-plate']));
  else reserveGate(arm(cx-1,-1,8,filters(['copper-plate'])),'copper-plate',cableCopperReserve);
  if(rear)arm(cx,-5,8,{name:'bulk-inserter'}); // cable to the north lane of the rear belt
  else toRing(arm(cx+1,-1,0,{name:'bulk-inserter'}),'copper-cable'); // 146 cable/min onto the ring
 }else{
  reserveGate(arm(cx-1,-1,8,filters(['electronic-circuit'])),'electronic-circuit');
  toRing(arm(cx+1,-1,0),'advanced-circuit');
  if(rear)arm(cx,-5,0); // unfiltered rear arm: plastic and cable only on the rear belt
  else arm(cx,-1,8,filters(['plastic-bar','copper-cable']));
 }
});

// INSIDE ROW (y 2..4): picks from the top belt (arms y=1), drops on the bottom belt (arms y=5).
const inside=[['flying-robot-frame',2],['flying-robot-frame',5],['bay',8],['flying-robot-frame',11],['flying-robot-frame',14],['flying-robot-frame',17],['construction-robot',20],['logistic-robot',23],['bay',26],['storage-chest',29]];
const insideFeeds={'flying-robot-frame':[['battery','electric-engine-unit'],['steel-plate','electronic-circuit']],'construction-robot':[['flying-robot-frame'],['electronic-circuit']],'logistic-robot':[['flying-robot-frame'],['advanced-circuit']],'storage-chest':[['steel-chest'],['electronic-circuit','advanced-circuit']]};
for(const[recipe,cx]of inside){
 if(recipe==='bay')continue;machine(recipe,cx,3,0);
 insideFeeds[recipe].forEach((items,j)=>arm(cx-1+j,1,0,filters(items)));
 const out=arm(cx+1,5,0);
 if(products.includes(recipe))productArms[recipe]=out;else toRing(out,recipe);
}

// BOTTOM ROW (y 8..10): picks from and drops on the bottom belt (arms at y=7).
const bottom=acidWest?['battery','electric-engine-unit','electric-engine-unit','electric-engine-unit','pipe',...(roboportLast?['roboport','engine-unit','engine-unit','engine-unit']:['engine-unit','engine-unit','engine-unit','roboport']),'passive-provider-chest']:['electric-engine-unit','electric-engine-unit','electric-engine-unit','iron-gear-wheel','pipe','engine-unit','engine-unit','engine-unit','roboport','passive-provider-chest'];
const bottomFeeds={battery:['iron-plate','copper-plate'],'electric-engine-unit':['engine-unit','electronic-circuit'],'engine-unit':['steel-plate','iron-gear-wheel','pipe'],'passive-provider-chest':['steel-chest','electronic-circuit','advanced-circuit']};
bottom.forEach((recipe,i)=>{
 const cx=slotX(i+1),cy=9;machine(recipe,cx,cy,recipe==='electric-engine-unit'?8:recipe==='battery'?12:0);
 if(recipe==='battery'&&options.acidMirror)machines.at(-1).entity.mirror=true;
 if(recipe==='roboport'){
  reserveGate(arm(cx-1,7,0,filters(['iron-gear-wheel'])),'iron-gear-wheel');
  reserveGate(arm(cx,7,0,filters(['steel-plate','advanced-circuit'])),'advanced-circuit',roboportAdvancedReserve);
 }
 if(recipe==='iron-gear-wheel'||recipe==='pipe')reserveGate(arm(cx-1,7,0,{...filters(['iron-plate']),...(recipe==='iron-gear-wheel'&&options.gearArm!=='fast'?{name:'bulk-inserter'}:{})}),'iron-plate',recipe==='pipe'?pipeIronReserve:reserves['iron-plate']);
 // Optional second iron arm in the gear machine's free front tile.
 if(recipe==='iron-gear-wheel'&&options.gearArms===2)reserveGate(arm(cx,7,0,{...filters(['iron-plate']),name:'bulk-inserter'}),'iron-plate');
 if(!['roboport','iron-gear-wheel','pipe'].includes(recipe))arm(cx-1,7,0,filters(bottomFeeds[recipe]));
 const out=arm(cx+1,7,8);
 if(products.includes(recipe))productArms[recipe]=out;else toRing(out,recipe);
});

// ---------------------------------------------------------------- ports
function port(kind,item,e,side='west'){
 const p={kind,label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position,externalSide:side,...(kind==='input'?{direction:4}:{}),perMinute:required[item]};
 ports.push(p);return p;
}
// Ring admissions: each entrance belt is itself a circuit-gated belt that
// side-loads onto the outer lane of the west column (straight tiles only).
const admissions=[['electronic-circuit',1],['iron-plate',2],['copper-plate',3],['steel-plate',4],...(rear?[]:[['plastic-bar',5]])];
const gates=[];
for(const[item,y]of admissions){const g=belt(-1,y,4);toRing(g,item);gates.push(g);port('input',item,g);}

// Rear belt (y=-6): plastic on the south lane (side-loaded at x=9 behind a
// straight dummy tile), cable on the north lane from the cable machine's bulk arm.
if(rear){
 const entrance=belt(-1,-6,4);port('input','plastic-bar',entrance);
 add('fast-underground-belt',0,-6,{direction:4,type:'input'});add('fast-underground-belt',6,-6,{direction:4,type:'output'});
 belt(7,-6,8);belt(7,-5,4);belt(8,-5,4);belt(9,-5,0);
 belt(8,-6,4); // straight dummy behind the side-load target
 const lastAdv=slotX(10);for(let x=9;x<=lastAdv;x++)belt(x,-6,4);
}
// Acid header (y=-5) to the two north-facing battery plants; lubricant header
// (y=11) to the three south-facing electric-engine machines.
const pipes={'sulfuric-acid':[],lubricant:[]};
if(acidWest){
 // Top plant (west-facing) inputs at (0,-4) and (0,-2); bottom plant input at (0,8).
 const acid=pipes['sulfuric-acid'];
 const entrance=add('pipe',-1,-3);acid.push(entrance);port('fluid','sulfuric-acid',entrance);
 for(const y of [-4,-3,-2])acid.push(add('pipe',0,y));
 acid.push(add('pipe-to-ground',0,-1,{direction:0}),add('pipe-to-ground',0,7,{direction:8}),add('pipe',0,8));
}else{
 const plants=machines.filter(m=>m.recipe==='battery');
 const end=Math.max(...plants.map(m=>m.cx+1));
 for(let x=-1;x<=end;x++){const p=add('pipe',x,-5);pipes['sulfuric-acid'].push(p);if(x===-1)port('fluid','sulfuric-acid',p);}
}
{
 const ee=machines.filter(m=>m.recipe==='electric-engine-unit');
 const lend=Math.max(...ee.map(m=>m.cx));
 for(let x=-1;x<=lend;x++){const p=add('pipe',x,11);pipes.lubricant.push(p);if(x===-1)port('fluid','lubricant',p);}
}
// Acid and lubricant never touch: no acid pipe orthogonally next to a lubricant pipe.
for(const a of pipes['sulfuric-acid'])for(const b of pipes.lubricant)assert(Math.abs(a.position.x-b.position.x)+Math.abs(a.position.y-b.position.y)>1,'acid next to lubricant');

// ---------------------------------------------------------------- output chest and collector
// cornerChest (published): the collector sits above the ring's north-east corner and picks from
// the curve at (EAST,0); the chest is above it on the east edge, so the two columns
// east of the ring disappear and their combinators move into empty tiles inside.
const cornerChest=options.cornerChest===true;
const chest=cornerChest?add('passive-provider-chest',EAST,-2):add('passive-provider-chest',EAST+2,3);
const collector=arm(cornerChest?EAST:EAST+1,cornerChest?-1:3,cornerChest?8:12,{use_filters:true,control_behavior:{circuit_set_filters:true,circuit_read_hand_contents:true,circuit_hand_read_mode:1,input_networks:{red:true,green:false},output_networks:{red:false,green:true}}});

// ---------------------------------------------------------------- combinator slots
// Free 1x2 cells; horizontal slots use direction 4, vertical slots direction 0.
const slots=[];
const hslot=(x,y)=>slots.push({x:x+1,y:y+.5,direction:4,cells:[[x,y],[x+1,y]]});
const vslot=(x,y)=>slots.push({x:x+.5,y:y+1,direction:0,cells:[[x,y],[x,y+1]]});
for(const[recipe,cx]of inside)if(recipe!=='bay')hslot(cx-1,5);
for(const bx of [7,25]){vslot(bx,1);vslot(bx+1,1);vslot(bx+2,1);vslot(bx+2,3);hslot(bx,5);}
for(let x=10;x<=29;x+=2)hslot(x,11);
if(cornerChest){vslot(EAST,-4);vslot(EAST,7);vslot(EAST,9);hslot(EAST-1,11);}
else for(let y=acidWest?-4:-5;y<=11;y++)if(y!==3)hslot(EAST+1,y);
if(rear)for(const x of [12,15,18,21,24,27])hslot(x,-5);
else if(!acidWest)for(let x=8;x<=30;x+=2)hslot(x,-5);
vslot(0,7);vslot(0,9);vslot(-1,7);vslot(0,-4);vslot(0,-2);
// Entrance labels are placed after the combinators; keep their tiles out of the slots.
const panelSpots=rear
 ?{'electronic-circuit':[-1,0],'iron-plate':[-1,-1],'copper-plate':[-1,5],'steel-plate':[-1,6],'plastic-bar':[-1,-4],'sulfuric-acid':[-1,-3],lubricant:[-1,10]}
 :{'electronic-circuit':[-1,0],'iron-plate':[-1,-1],'copper-plate':[-1,6],'steel-plate':[-1,7],'plastic-bar':[-1,8],'sulfuric-acid':[-1,-4],lubricant:[-1,10]};
if(acidWest)panelSpots['sulfuric-acid']=[-1,-2];
for(let i=slots.length-1;i>=0;i--)if(slots[i].cells.some(([x,y])=>Object.values(panelSpots).some(([px,py])=>px===x&&py===y)))slots.splice(i,1);
const free=s=>s.cells.every(([x,y])=>!occupied.has(key(x,y)));
function combinator(name,anchor,extra){
 let best;for(const s of slots){if(!free(s))continue;const d=Math.hypot(s.x-anchor.x,s.y-anchor.y);if(!best||d<best.d)best={s,d};}
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

// Collector: five deciders, product in chest+hand < cap -> product filter.
net('chest','green',{entity:chest,connector:2},{entity:collector,connector:2});
net('filters','red',{entity:collector,connector:1});
const stockDeciders={};
for(const item of products){
 const d=decider(chest.position,[c(sig(item),'<',caps[item])],[one(sig(item))],{stock_control:true});
 stockDeciders[item]=d.entity_number;net('chest','green',{entity:d,connector:2});net('filters','red',{entity:d,connector:3});
}

// Production tokens (latched): timer -> per-product modulo -> latch holds a
// token from each period start until the output arm holds the product.
const tokenSignals=['signal-K','signal-L','signal-M','signal-N','signal-O'],resetSignals=['signal-U','signal-V','signal-W','signal-Y','signal-Z'];
const robotTokens={},moduloEntities={};
const tokenParts=[];
products.forEach((item,i)=>{
 const out=productArms[item];assert(out,item);
 const token=virtual(tokenSignals[i]),reset=virtual(resetSignals[i]);
 const permission=decider(out.position,[c(sig(item),'<',limits[item]),c(token,'>',0,'and'),c(reset,'>',0,'or')],[one(virtual('signal-G'))]);
 const handReset=arithmetic(out.position,sig(item),'*',1,reset);
 out.control_behavior={circuit_enabled:true,circuit_read_hand_contents:true,circuit_hand_read_mode:1,circuit_condition:{first_signal:virtual('signal-G'),comparator:'>',constant:0}};
 net('ring','red',{entity:permission,connector:1});
 net('permission-'+item,'red',{entity:permission,connector:3},{entity:out,connector:1});
 net('hand-'+item,'green',{entity:out,connector:2},{entity:handReset,connector:2});
 net('bus','green',{entity:permission,connector:2},{entity:handReset,connector:4});
 tokenParts.push({item,i,permission,handReset,out,token,reset});
});
// Latches, modulo combinators and the timer sit together on the south row so
// the timer wire stays short; the token bus reaches the arm-side deciders.
const tokenAnchor={x:21,y:11.5,...options.tokenAnchor};
for(const t of tokenParts){
 const signal=virtual('signal-'+String.fromCharCode(65+t.i));
 // Two-speed clock: the timer moves 8 or 9 units a tick, so a period start is the one or two
 // ticks with the remainder inside one step of zero. Both signs: after about 46 days of play the
 // timer passes 2^31 and is negative, and a negative remainder is negative or zero
 // (probe-clock-wrap.mjs proves both natively).
 const start=supplyGate?[c(signal,'<',supplyGate.base+supplyGate.boost,'and'),c(signal,'>',-(supplyGate.base+supplyGate.boost),'and')]:[c(signal,'=',0,'and')];
 const latch=decider(tokenAnchor,[c(t.reset,'=',0),...start,c(t.reset,'=',0,'or'),c(t.token,'>',0,'and')],[one(t.token)]);
 const mod=arithmetic(latch.position,virtual('signal-T'),'%',periodUnits[t.item],signal);
 net('bus','green',{entity:latch,connector:2},{entity:latch,connector:4});
 net('phase-'+t.item,'red',{entity:mod,connector:3},{entity:latch,connector:1});
 net('timer','red',{entity:mod,connector:1});
 moduloEntities[t.item]=mod.entity_number;
 robotTokens[t.item]={latch:latch.entity_number,permission:t.permission.entity_number,handReset:t.handReset.entity_number,output:t.out.entity_number,tokenSignal:t.token.name,resetSignal:t.reset.name};
}
const timer=arithmetic(tokenAnchor,virtual('signal-T'),'+',supplyGate?supplyGate.base:1,virtual('signal-T'));
net('timer','red',{entity:timer,connector:3},{entity:timer,connector:1});
// Supply gate: reads the ring and, while every gated item is above its threshold, puts `boost`
// on the timer's own signal, so the timer adds base+boost that tick.
let supplyDecider;
if(supplyGate){
 supplyDecider=decider(timer.position,Object.entries(supplyGate.thresholds).map(([item,threshold],i)=>c(sig(item),'>',threshold,i?'and':undefined)),[{signal:virtual('signal-T'),copy_count_from_input:false,constant:supplyGate.boost}]);
 net('ring','red',{entity:supplyDecider,connector:1});net('timer','red',{entity:supplyDecider,connector:3});
}

// ---------------------------------------------------------------- labels
for(const p of ports.filter(p=>p.kind==='input'||p.kind==='fluid')){
 const[x,y]=panelSpots[p.items[0]];
 assert(Math.max(Math.abs(x+.5-p.x),Math.abs(y+.5-p.y))<=4,'panel too far '+p.label);
 const text=`IN: ${p.items[0]}\nWEST · ${p.perMinute}/min at nominal target`;
 const e=add('display-panel',x,y,{icon:{type:p.kind==='fluid'?'fluid':'item',name:p.items[0]},text,always_show:true});p.displayEntity=e.entity_number;
}
const outputPort={kind:'output',label:'finished-products',items:products,item:undefined,entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:chest.position,externalSide:'east',caps};
delete outputPort.item;ports.push(outputPort);

// ---------------------------------------------------------------- circuit wiring
// Prim spanning tree per network, every wire at most 8 tiles centre to centre.
const wireLength=8;
for(const[name,n]of Object.entries(networks)){
 const nodes=n.nodes,inTree=new Set([0]);
 const d=(a,b)=>Math.hypot(a.entity.position.x-b.entity.position.x,a.entity.position.y-b.entity.position.y);
 while(inTree.size<nodes.length){
  let best;
  for(const i of inTree)for(let j=0;j<nodes.length;j++){if(inTree.has(j))continue;const dist=d(nodes[i],nodes[j]);if(dist<=wireLength&&(!best||dist<best.dist))best={i,j,dist};}
  if(!best)console.error(name,nodes.map(n=>[n.entity.name,n.entity.position.x,n.entity.position.y,n.connector]));assert(best,`network ${name} cannot be wired within ${wireLength} tiles`);
  inTree.add(best.j);
  if(nodes[best.i].entity===nodes[best.j].entity&&nodes[best.i].connector===nodes[best.j].connector)continue;
  wires.push([nodes[best.i].entity.entity_number,nodes[best.i].connector,nodes[best.j].entity.entity_number,nodes[best.j].connector]);
 }
}
// A connector belongs to exactly one network.
{const owner=new Map();for(const[name,n]of Object.entries(networks))for(const node of n.nodes){const k=node.entity.entity_number+':'+node.connector;assert(!owner.has(k)||owner.get(k)===name,`connector ${k} in ${owner.get(k)} and ${name}`);owner.set(k,name);}}

// ---------------------------------------------------------------- power
ports.push({kind:'power',items:[],entity:0,x:0,y:0});
const preBounds=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']},'arithmetic-combinator':{...raw['arithmetic-combinator'],...raw['decider-combinator']}});
const bays=[[8,4],[26,4]];
const layout={entities,wires,next,place,allowPole:e=>e.name==='substation'&&bays.some(([x,y])=>e.position.x===x&&e.position.y===y)};
powerFiveLayout(layout,ports,raw);next=layout.next;
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

// ---------------------------------------------------------------- blueprint and manifest
const label='Robot essentials · 5/5/0.5/2/2 per minute';
const description='Factorio 2.1.24 Space Age, normal quality: AM2 and chemical plants, no modules, red belts, fast/bulk inserters. WEST entrances: electronic circuits, iron, copper, steel, plastic (belts) and sulfuric acid, lubricant (pipes). EAST: one passive provider chest with independent caps 20 construction robots, 20 logistic robots, 2 roboports, 10 storage chests, 10 passive provider chests. Preserve the red ring wires (per-tile hold readers), the green chest and token wires, filters and caps. '+(options.oldPowerWording?'Supply electricity at the marked substation.':'Supply electricity at either substation; the two are wired together.');
const bp={item:'blueprint',version:562954249961472,label,description,entities,wires,icons:products.slice(0,4).map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
const code=encodeBlueprint({blueprint:bp});
const boundsRaw={...raw,container:{...raw.container,...raw['logistic-container']},'arithmetic-combinator':{...raw['arithmetic-combinator'],...raw['decider-combinator'],...raw['constant-combinator']}};
const footprint=starterBounds(entities,boundsRaw);
assert.deepEqual(footprint,preBounds,'power grew the rectangle');
const capacity=loop.length*8,maximumStock=Object.values(limits).reduce((a,b)=>a+b,0);
assert(maximumStock<=0.6*capacity,`ring limits ${maximumStock} above 60% of ${capacity}`);
// Status follows the published evidence: qualified only when the existing report passed for this exact string.
let status=process.env.RE_STATUS||'native-validation-pending';
try{const r=JSON.parse(await fs.readFile(OUT+'/native-report.json'));if(!process.env.RE_STATUS&&r.passed===true&&r.short!==true&&r.builds?.[0]?.blueprintSha256===sha(code))status='qualified';}catch{}
const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:8,settleMinutes:5,recoveryMinutes:10,selectivePhases:products.length,selectiveSettleMinutes:5,selectiveMeasureMinutes:10};
const portView=kind=>ports.filter(p=>p.kind===kind).map(p=>({...p,item:p.items[0]}));
const manifest={
 id,name:label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'rate',status,
 products,targets,outputCaps:caps,
 recipeAudit:{externalPerMinute:required,...(supplyGate?{externalPerProduct:perProduct}:{}),craftsPerMinute:crafts,recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,raw.recipe[n].ingredients]))},
 ports,inputs:portView('input'),fluids:portView('fluid'),
 outputs:products.map(item=>({item,label:item,items:[item],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:chest.position,externalSide:'east',cap:caps[item]})),
 machineCounts,footprint,
 areaGoal:{goalTiles:760,stretchTiles:703,achievedTiles:footprint.width*footprint.height},
 loopControl:[{name:id,reader:loop[0].entity_number,readerMode:'per-tile-hold',loop:loop.map(e=>e.entity_number),controlled,reserves:reserveArms,gates:gates.map(e=>e.entity_number),limits,capacity,maximumStock}],
 stockControl:{mode:'dynamic-filter',collector:collector.entity_number,chest:chest.entity_number,caps,deciders:stockDeciders},
 productionClock:supplyGate?{timer:timer.entity_number,moduloEntities,robotTokens,periodUnits,unitsPerTick:{nominal:supplyGate.base,boosted:supplyGate.base+supplyGate.boost},nominal,
  tokensPerMinute:Object.fromEntries(products.map(p=>[p,{nominal:Math.round(3600*supplyGate.base/periodUnits[p]*1000)/1000,boosted:Math.round(3600*(supplyGate.base+supplyGate.boost)/periodUnits[p]*1000)/1000}])),
  supplyGate:{entity:supplyDecider.entity_number,signal:'signal-T',boost:supplyGate.boost,thresholds:supplyGate.thresholds}}
  :{headroom,timer:timer.entity_number,moduloEntities,robotTokens,periodTicks},
 protocol,
 construction:Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length])),
 setupNotes:[description,
  'Supplied electronic circuits: 145 per minute at the nominal target, one green-circuits copy (360 per minute) covers it.',
  ...(supplyGate?['The entrance panels are the supply to plan for. Fed at exactly the panel figures the workshop makes about 4.9 construction robots, 4.9 logistic robots, 0.5 roboports and 2.0 of each chest per minute (token pace '+products.map(p=>Math.round(3600*supplyGate.base/periodUnits[p]*100)/100).join(' / ')+'), all above the 95% floors; panel-supply-report.json is that full-protocol run. With more supply than the panels a boost of one eighth switches on while the ring is well stocked: about 5.5 / 5.5 / 0.57 / 2.2 / 2.2 per minute from roughly 1.25 times the panel figures upward (about 165 electronic circuits, 120 iron, 107 copper, 85 steel, 84 plastic, 450 sulfuric acid and 169 lubricant per minute when every entrance is saturated). Below the panel figures the roboport falls short first.']
   :['Plan supply above the entrance panels: the panel figures are recipe totals at the targets, but the production tokens run the products 5 to 15% above target, so the measured draw is about 163 electronic circuits, 121 iron, 107 copper, 86 steel and 85 plastic per minute (about 15% above the panels) and about 442 sulfuric acid and 165 lubricant per minute (about 10% above theirs). Fed at exactly the panel figures, logistic robots fall to about 1 per minute, because steel reaches the engine machines last; 1.10x still fails and 1.15x (the measured draw) passes (exploration measurement, not the published protocol).']),
  'Leave the shared chest unrestricted (no bar). Caps live in the five filter deciders next to the chest.',
  'The ring holds at most the stock limits in loopControl; do not remove the red wires from ring tiles or the entrance belts, which are circuit-gated.'],
 greenCircuitSupply:{perMinute:required['electronic-circuit'],copiesOfGreenCircuits:Math.ceil(required['electronic-circuit']/360)},
};
await fs.mkdir(OUT,{recursive:true});
await fs.writeFile(OUT+'/'+id+'.txt',code+'\n');
await fs.writeFile(OUT+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,out:OUT,footprint,area:footprint.width*footprint.height,machines:Object.values(machineCounts).reduce((a,b)=>a+b,0),entities:entities.length,required,blueprintSha256:manifest.blueprintSha256,maximumStock,capacity}));
