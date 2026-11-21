// White-pack platform: 60 space science packs per minute in Nauvis orbit, from asteroid chunks only.
// A hub-centred platform: every machine stands next to the hub and takes its ingredients from the hub with one
// fast inserter and returns its products with another. No belts, no chests, no poles, no defence (Nauvis orbit
// spawns only chunks; CONTRACT section 2 fact 2). Collection is circuit-limited (collectors pick a chunk type only
// while the hub holds fewer than chunkCap of it), every crushed and smelted intermediate has a hub stock cap,
// the science machines stop at the pack cap, and a crusher clock decides when crushing happens. The published
// variant (seventeen-wide) has one crusher whose recipe the clock sets (oxide, metallic, carbonic in turn), six
// solar panels and four accumulators in a 17 x 16 rectangle, and asks rockets for exactly 4,000 kg (four cargo
// rockets). single-crusher-six-panels is the same bill in 19 x 16 (published before it); the earlier variants
// with three fixed-recipe crushers ask for 5,000 kg.
//
// The blueprint includes the hub entity (it anchors the paste to the real hub and keeps the hub's
// request_missing_construction_materials on) and every foundation tile, starter square included.
//
// Pure Node and reproducible: the same variant and raw dump give the same string and manifest.
// Usage: node scripts/white-platform/generate.mjs [--variant hub-ring] [--out dir]
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const id='white-platform';
const variantName=flag('variant',process.env.WP_VARIANT||'seventeen-wide');
const out=flag('out',process.env.WP_OUT||'blueprint-sources/'+id);
await fs.mkdir('.cache/'+id,{recursive:true});
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');

// Variants. Every variant keeps the hub-centred slots; they differ in power and in the stock values.
//  panels: solar panels (corner blocks first, then outward); accumulators: placed west of the north-west block.
//  chunkCap: collectors pick a chunk type only while the hub holds fewer than this.
//  power: 'corners-outward' (the planning prototype: corner blocks, then outward on all four sides, accumulators
//  west of the north-west block) or an explicit list of panel and accumulator centres.
const stock={chunkCap:6,oreCap:60,carbonCap:60,iceCap:60,plateCap:100,packCap:2000};
// Corner blocks of the 16 x 16 core (x and y from -8 to 7), one per turn.
const corners=[[6.5,-6.5],[6.5,6.5],[-6.5,6.5],[-6.5,-6.5]];
// South band (rows 8..9) accumulators, clear of the south collector's front (x -1..1): tiles x-1..x, y 8..9.
// Power of the 17 x 16 layout: four corner panels (the two east ones one column further east), two panels in the
// west side's machine slots; accumulators behind the crusher (the first one reads its charge) and in the two gaps.
const compactPower={panels:[[-6.5,-6.5],[7.5,-6.5],[7.5,6.5],[-6.5,6.5],[-6.5,-3.5],[-6.5,3.5]],accumulators:[[8,2],[8,4],[5,-6],[5,6]]};
const VARIANTS={
 'hub-ring':{...stock,panels:10,accumulators:1,power:'corners-outward'},
 // Same items, chunk value 4 instead of 6 (white-platform.md section 2: the fallback if free slots run low).
 'hub-ring-four-chunks':{...stock,chunkCap:4,panels:10,accumulators:1,power:'corners-outward'},
 // Two panels traded for four accumulators (same weight, 2 tiles fewer), placed in an east band (x 8..10) and a
 // south band (rows 8..9): 19 x 18 instead of 22 x 22.
 'bands-eight-panels':{...stock,panels:8,accumulators:5,power:{panels:[...corners,[9.5,-6.5],[9.5,-3.5],[9.5,2.5],[9.5,5.5]],accumulators:[[-7,9],[-5,9],[-3,9],[5,9],[7,9]]}},
 // Three panels traded for six accumulators (3 tiles fewer).
 'bands-seven-panels':{...stock,panels:7,accumulators:7,power:{panels:[...corners,[9.5,-6.5],[9.5,-3.5],[9.5,2.5]],accumulators:[[9,5],[9,7],[-7,9],[-5,9],[-3,9],[5,9],[7,9]]}},
 // Four panels traded for eight accumulators (4 tiles fewer); 1,080 kW of panels against about 1,000 kW average demand.
 'bands-six-panels':{...stock,panels:6,accumulators:9,power:{panels:[...corners,[9.5,-6.5],[9.5,-3.5]],accumulators:[[9,2],[9,4],[9,6],[-7,9],[-5,9],[-3,9],[3,9],[5,9],[7,9]]}},
 // One crusher whose recipe is set by the circuit network (clock windows), on the south side next to the furnace;
 // the west side keeps only its collector. Two crushers, twelve tiles and four arms fewer, one feed decider more:
 // with seven panels and two accumulators the request is exactly 4,000 kg (four cargo rockets).
 'single-crusher':{...stock,singleCrusher:true,goalKg:4000,panels:7,accumulators:2,power:{panels:[...corners,[9.5,-6.5],[9.5,-3.5],[9.5,2.5]],accumulators:[[9,5],[9,7]]}},
 // Same machines; one panel traded for two accumulators (same weight, 1 tile fewer): 1,080 kW of panels and
 // 1,200 kW of accumulator output for the peaks. The first accumulator reads its charge (signal-A) onto the green
 // network and the feed decider opens the crusher arm only while the charge is at least chargeFloor percent,
 // so the crusher waits while the accumulators recharge (start-up and restart after a full hub).
 // Five panels (900 kW, below the measured full-rate demand of about 970 kW) and six accumulators, 1 tile fewer.
 'single-crusher-five-panels':{...stock,singleCrusher:true,goalKg:4000,chargeFloor:30,panels:5,accumulators:6,power:{panels:[...corners,[9.5,-6.5]],accumulators:[[-7,-4],[9,-4],[9,2],[9,4],[9,6],[9,8]]}},
 // The same without the charge gate (the comparison run for the gate).
 'single-crusher-six-panels-no-gate':{...stock,singleCrusher:true,goalKg:4000,panels:6,accumulators:4,power:{panels:[...corners,[9.5,-6.5],[9.5,-3.5]],accumulators:[[-7,-4],[9,2],[9,4],[9,6]]}},
 'single-crusher-six-panels':{...stock,singleCrusher:true,goalKg:4000,chargeFloor:30,panels:6,accumulators:4,power:{panels:[...corners,[9.5,-6.5],[9.5,-3.5]],accumulators:[[-7,-4],[9,2],[9,4],[9,6]]}},
 // The same machines, arms, combinators, panels, accumulators and 247 tiles packed into 17 x 16 instead of 19 x 16:
 // the two panels of the east band stand in the west side's two free machine slots, the crusher stands on the east
 // side turned 2 wide, two accumulators stand behind it and the other two in the two-column gaps that open when the
 // north-east and south-east corner panels move one column east. The same request, tile for tile and item for item.
 'seventeen-wide':{...stock,layout:'compact',singleCrusher:true,goalKg:4000,chargeFloor:30,panels:6,accumulators:4,power:compactPower},
 // Exploration only (never published): the same layout with collectors on fewer sides, to measure the chunk supply.
 'seventeen-wide-north-south':{...stock,layout:'compact',probe:true,collectorSides:'ns',singleCrusher:true,chargeFloor:30,panels:6,accumulators:4,power:compactPower},
 'seventeen-wide-three-collectors':{...stock,layout:'compact',probe:true,collectorSides:'nes',singleCrusher:true,chargeFloor:30,panels:6,accumulators:4,power:compactPower},
 'seventeen-wide-south':{...stock,layout:'compact',probe:true,collectorSides:'s',singleCrusher:true,chargeFloor:30,panels:6,accumulators:4,power:compactPower},
};
const variant=VARIANTS[variantName];assert(variant,'unknown variant '+variantName);

// Item weights in kg (game value / 1000), from the game's own values (plan/results/facts-run-facts.json);
// the harness re-checks each against prototypes.item[name].weight. Rocket lift: 1,000 kg.
export const WEIGHT_KG={'space-platform-foundation':20,'asteroid-collector':100,crusher:100,'assembling-machine-2':20,'electric-furnace':20,'fast-inserter':20,'solar-panel':20,accumulator:20,'constant-combinator':20,'arithmetic-combinator':20,'decider-combinator':20,'space-platform-starter-pack':1000};
const ROCKET_LIFT_KG=1000;
// The starter pack places the 10 x 10 foundation square (x and y from -5 to 4) and leaves 10 foundation in the hub.
const STARTER={placedTiles:100,hubFoundation:10,square:[-5,4]};

const target=60,product='space-science-pack';
const caps={chunk:variant.chunkCap,'iron-ore':variant.oreCap,carbon:variant.carbonCap,ice:variant.iceCap,'iron-plate':variant.plateCap,[product]:variant.packCap};
// Diagnostic ceilings the harness enforces (white-platform.md section 2).
const ceilings={[product]:2100,'iron-ore':100,carbon:100,ice:100,'iron-plate':130,'metallic-asteroid-chunk':16,'carbonic-asteroid-chunk':16,'oxide-asteroid-chunk':16};
const protocol={buildLimitMinutes:10,warmupMinutes:60,measureMinutes:120,blockedMinutes:105,holdMinutes:15,recoveryMinutes:60,recoveryMeasuredMinutes:45,rocketDeliveryLimitMinutes:60,minimumFreeSlots:5};

// ---------- placement ----------
const entities=[],wires=[],tiles=new Map();
const size=name=>{const g=Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);assert(g,name);const b=g.selection_box;return [Math.ceil(b[1][0]-b[0][0]),Math.ceil(b[1][1]-b[0][1])];};
const occupied=new Map(),key=(x,y)=>x+','+y;
function footprintCells(e){let [w,h]=size(e.name);if([4,12].includes(e.direction))[w,h]=[h,w];const cells=[];for(let x=Math.round(e.position.x-w/2);x<Math.round(e.position.x+w/2);x++)for(let y=Math.round(e.position.y-h/2);y<Math.round(e.position.y+h/2);y++)cells.push([x,y]);return cells;}
const add=e=>{e.entity_number=entities.length+1;for(const [x,y] of footprintCells(e)){assert(!occupied.has(key(x,y)),`collision ${e.name} at ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}entities.push(e);return e.entity_number;};
const tile=(x,y)=>tiles.set(key(x,y),{position:{x,y},name:'space-platform-foundation'});
// Each side of the hub is described in north-side coordinates and turned k quarter turns clockwise
// (k = 0 north, 1 east, 2 south, 3 west): (x, y) -> (-y, x) once per turn; directions turn by 4.
const rot=([x,y],k)=>{for(let i=0;i<k;i++)[x,y]=[-y,x];return [x,y];};
const rect=(x1,y1,x2,y2,k)=>{for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++){const [cx,cy]=rot([x+.5,y+.5],k);tile(Math.floor(cx),Math.floor(cy));}};
for(let x=STARTER.square[0];x<=STARTER.square[1];x++)for(let y=STARTER.square[0];y<=STARTER.square[1];y++)tile(x,y);
const hub=add({name:'space-platform-hub',position:{x:0,y:0},request_filters:{sections:[{index:1},{index:2,active:false}],request_from_buffers:true},request_missing_construction_materials:true,providing_to_other_platforms:false});
const item=n=>({type:'item',name:n}),virtual=n=>({type:'virtual',name:n});
const roles={ingredient:[],product:[],collector:[],gated:[]},machines=[],collectors=[];
const gateArms=[];
function arm(pos,dir,k,o={}){
 const [x,y]=rot(pos,k);const e={name:'fast-inserter',position:{x,y},direction:(dir+4*k)%16,override_stack_size:1};
 if(o.filter){e.use_filters=true;e.filters=[{index:1,name:o.filter,quality:'normal',comparator:'='}];}
 if(o.cond)e.control_behavior={circuit_enabled:true,circuit_condition:{first_signal:item(o.cond[0]),comparator:'<',constant:o.cond[1]}};
 if(o.gate)e.control_behavior={circuit_enabled:true,circuit_condition:{first_signal:virtual('signal-G'),comparator:'>',constant:0}};
 const n=add(e);if(o.cond)wires.push([hub,1,n,1]);if(o.gate)gateArms.push({arm:n,recipe:o.gate});return n;
}
// A machine slot on the north side: 'W' (tiles x -5..-3) or 'E' (tiles 2..4). Its two arms stand on the starter
// ring (row -5): the ingredient arm picks from the hub (south) and drops into the machine, the product arm the reverse.
function machineSlot(slot,kind,k){
 if(!kind)return null;
 const cx=slot==='W'?-3.5:3.5,inX=slot==='W'?-3.5:2.5,outX=slot==='W'?-2.5:3.5,x1=slot==='W'?-5:2;
 let n;
 if(kind.circuitCrusher){
  // No fixed recipe: the recipe deciders of the clock set it (control_behavior.set_recipe, as the game writes it).
  const [x,y]=rot([cx,-6],k);n=add({name:'crusher',position:{x,y},direction:(4+4*k)%16,control_behavior:{set_recipe:true}});rect(x1,-7,x1+2,-6,k);
  roles.ingredient.push(feedArm=arm([inX,-4.5],8,k,{gate:'feed'}));
  roles.product.push(arm([outX,-4.5],0,k));
  machines.push({entity:n,recipe:CIRCUIT_CRUSHING,recipes:Object.keys(crushingStock),side:'nesw'[k],slot});
  return n;
 }
 if(kind.crusher){
  const [x,y]=rot([cx,-6],k);n=add({name:'crusher',position:{x,y},direction:(4+4*k)%16,recipe:kind.crusher,recipe_quality:'normal'});rect(x1,-7,x1+2,-6,k);
  roles.ingredient.push(arm([inX,-4.5],8,k,{gate:kind.crusher}));
 }else{
  const [x,y]=rot([cx,-6.5],k);const e={name:kind.name,position:{x,y}};if(kind.recipe){e.recipe=kind.recipe;e.recipe_quality='normal';}n=add(e);rect(x1,-8,x1+2,-6,k);
  roles.ingredient.push(arm([inX,-4.5],8,k,{cond:kind.cond,filter:kind.filter}));
 }
 roles.product.push(arm([outX,-4.5],0,k));
 machines.push({entity:n,recipe:kind.crusher||kind.recipe||'iron-plate',side:'nesw'[k],slot});
 return n;
}
const science={name:'assembling-machine-2',recipe:product,cond:[product,caps[product]]};
const crusher=(recipe,stock)=>({crusher:recipe,stock});
const furnace={name:'electric-furnace',cond:['iron-plate',caps['iron-plate']],filter:'iron-ore'};
// machineCounts key for the one crusher whose recipe the circuit sets (single-crusher variant).
const CIRCUIT_CRUSHING='asteroid-crushing-set-by-circuit';
const crushingStock={'oxide-asteroid-crushing':'ice','metallic-asteroid-crushing':'iron-ore','carbonic-asteroid-crushing':'carbon'};
const chunkTypes=['metallic-asteroid-chunk','carbonic-asteroid-chunk','oxide-asteroid-chunk'];
let feedArm=null,sides=null,constant=null,negate=null,timer=null,recipeClock=null;
const greenChain=new Set(),gates={};
const period=900;
const T=virtual('signal-T'),G={red:false,green:true},R={red:true,green:false};
const nearestGreen=(x,y)=>entities.filter(e=>greenChain.has(e.entity_number)).sort((p,q)=>Math.hypot(p.position.x-x,p.position.y-y)-Math.hypot(q.position.x-x,q.position.y-y)||p.entity_number-q.entity_number)[0].entity_number;
// The 17 x 16 layout, placed explicitly (absolute tile centres; an arm's direction is the side it picks from).
function placeCompact(){
 const sides=variant.collectorSides||'nesw';
 const scienceMachine=(x,y,inArm,outArm,side)=>{const n=add({name:science.name,position:{x,y},recipe:science.recipe,recipe_quality:'normal'});for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)tile(Math.floor(x)+dx,Math.floor(y)+dy);
  roles.ingredient.push(arm(inArm.slice(0,2),inArm[2],0,{cond:science.cond}));roles.product.push(arm(outArm.slice(0,2),outArm[2],0));machines.push({entity:n,recipe:product,side});return n;};
 // Collection network first, as in the earlier layouts: chunk values and the clock tick, and minus the hub contents.
 constant=add({name:'constant-combinator',position:{x:-1.5,y:-4.5},control_behavior:{sections:{sections:[{index:1,filters:[...chunkTypes.map((n,i)=>({index:i+1,name:n,quality:'normal',comparator:'=',count:caps.chunk})),{index:4,type:'virtual',name:'signal-T',quality:'normal',comparator:'=',count:1}]}]}}});
 negate=add({name:'arithmetic-combinator',position:{x:1,y:-4.5},direction:4,control_behavior:{arithmetic_conditions:{first_signal:virtual('signal-each'),second_constant:-1,operation:'*',output_signal:virtual('signal-each')}}});
 wires.push([hub,1,negate,1],[negate,4,constant,2]);greenChain.add(constant);
 // A collector: foundation under its two rear rows only; its arm stands on the ring between it and the hub.
 const collector=(side,x,y,direction,rear,armAt)=>{if(!sides.includes(side))return null;const n=add({name:'asteroid-collector',position:{x,y},direction,control_behavior:{circuit_set_filters:true}});for(const [tx,ty] of rear)tile(tx,ty);
  collectors.push({entity:n,side});roles.collector.push(arm(armAt,direction,0));greenChain.add(n);return n;};
 const span=(a,b)=>{const out=[];for(let i=a;i<=b;i++)out.push(i);return out;};
 // North: science, collector, science.
 scienceMachine(-3.5,-6.5,[-3.5,-4.5,8],[-2.5,-4.5,0],'n');
 const north=collector('n',-0.5,-6.5,0,span(-2,0).flatMap(x=>[[x,-7],[x,-6]]),[-0.5,-4.5]);
 scienceMachine(2.5,-6.5,[2.5,-4.5,8],[3.5,-4.5,0],'n');
 // East: science, collector, and the crusher turned 2 wide (tiles x 5..6, y 1..3).
 scienceMachine(6.5,-3.5,[4.5,-3.5,12],[4.5,-2.5,4],'e');
 const east=collector('e',6.5,-0.5,4,span(-2,0).flatMap(y=>[[5,y],[6,y]]),[4.5,-1.5]);
 const crusherEntity=add({name:'crusher',position:{x:6,y:2.5},direction:8,control_behavior:{set_recipe:true}});for(const x of [5,6])for(const y of [1,2,3])tile(x,y);
 roles.ingredient.push(feedArm=arm([4.5,1.5],12,0,{gate:'feed'}));roles.product.push(arm([4.5,2.5],4,0));
 machines.push({entity:crusherEntity,recipe:CIRCUIT_CRUSHING,recipes:Object.keys(crushingStock),side:'e'});
 // South: furnace, collector, science.
 const furnaceEntity=add({name:furnace.name,position:{x:-3.5,y:6.5}});for(const x of [-5,-4,-3])for(const y of [5,6,7])tile(x,y);
 roles.ingredient.push(arm([-3.5,4.5],0,0,{cond:furnace.cond,filter:furnace.filter}));roles.product.push(arm([-2.5,4.5],8,0));
 machines.push({entity:furnaceEntity,recipe:'iron-plate',side:'s'});
 const south=collector('s',-0.5,6.5,8,span(-2,0).flatMap(x=>[[x,5],[x,6]]),[-0.5,4.5]);
 scienceMachine(2.5,6.5,[2.5,4.5,0],[3.5,4.5,8],'s');
 // West: only its collector (the two slots beside it hold solar panels).
 const west=collector('w',-6.5,-0.5,12,span(-2,0).flatMap(y=>[[-7,y],[-6,y]]),[-4.5,-0.5]);
 // Clock (two tiles south of the crusher, the only combinator off the ring) and the four clock deciders on the ring.
 timer=add({name:'decider-combinator',position:{x:6,y:4.5},direction:4,control_behavior:{decider_conditions:{conditions:[{first_signal:T,constant:period}],outputs:[{signal:T}],else_outputs:[]}}});
 tile(5,4);tile(6,4);
 const recipeWindows={'oxide-asteroid-crushing':[[1,226],[451,676]],'metallic-asteroid-crushing':[[226,451]],'carbonic-asteroid-crushing':[[676,901]]};
 const feedWindows=[[1,20],[226,245],[451,470],[676,695]];
 const where={'oxide-asteroid-crushing':[4.5,0,0],'metallic-asteroid-crushing':[4.5,4,0],'carbonic-asteroid-crushing':[1,4.5,4]};
 const recipeDeciders={};
 for(const [recipe,stock] of Object.entries(crushingStock)){
  const [x,y,direction]=where[recipe],conditions=[];
  recipeWindows[recipe].forEach(([from,to],i)=>{
   const c={first_signal:T,constant:from,comparator:'≥',first_signal_networks:G};if(i>0)c.compare_type='or';
   conditions.push(c,{first_signal:T,constant:to,first_signal_networks:G,compare_type:'and'},{first_signal:{name:stock},constant:caps[stock],first_signal_networks:R,compare_type:'and'});
  });
  const d=add({name:'decider-combinator',position:{x,y},direction,control_behavior:{decider_conditions:{conditions,outputs:[{signal:{type:'recipe',name:recipe},copy_count_from_input:false}],else_outputs:[]}}});
  wires.push([hub,1,d,1]);greenChain.add(d);
  recipeDeciders[recipe]={decider:d,windows:recipeWindows[recipe],stock,cap:caps[stock]};
 }
 const feedConditions=[];
 feedWindows.forEach(([from,to],i)=>{const c={first_signal:T,constant:from,comparator:'≥',first_signal_networks:G};if(i>0)c.compare_type='or';feedConditions.push(c,{first_signal:T,constant:to,first_signal_networks:G,compare_type:'and'});
  if(variant.chargeFloor)feedConditions.push({first_signal:virtual('signal-A'),constant:variant.chargeFloor,comparator:'≥',first_signal_networks:G,compare_type:'and'});});
 const feed=add({name:'decider-combinator',position:{x:-4.5,y:3},direction:0,control_behavior:{decider_conditions:{conditions:feedConditions,outputs:[{signal:virtual('signal-G'),copy_count_from_input:false}],else_outputs:[]}}});
 greenChain.add(feed);
 const rd=r=>recipeDeciders[r].decider,oxide=rd('oxide-asteroid-crushing'),metallic=rd('metallic-asteroid-crushing'),carbonic=rd('carbonic-asteroid-crushing');
 // Collection network (green): the constant combinator, the negating combinator's output, the four collectors, the
 // clock and the green inputs of the four clock deciders, joined as a tree. No machine is on it.
 wires.push([negate,4,oxide,2],[oxide,2,metallic,2],[metallic,2,timer,2],[timer,4,timer,2],[metallic,2,carbonic,2],[carbonic,2,feed,2]);
 if(north)wires.push([constant,2,north,2]);if(west)wires.push([constant,2,west,2]);if(east)wires.push([oxide,2,east,2]);if(south)wires.push([carbonic,2,south,2]);
 // The recipe network (red, decider outputs): the four clock deciders, the feed arm and the crusher, nothing else.
 wires.push([feed,3,carbonic,3],[carbonic,3,metallic,3],[metallic,3,feedArm,1],[oxide,3,feedArm,1],[feedArm,1,crusherEntity,1]);
 gates.feed={decider:feed,arm:feedArm,windows:feedWindows};
 recipeClock={crusher:crusherEntity,recipeDeciders,feed:{decider:feed,arm:feedArm,windows:feedWindows,...(variant.chargeFloor?{chargeFloorPercent:variant.chargeFloor}:{})}};
}
if(variant.layout==='compact')placeCompact();else{
 sides=variant.singleCrusher
  ?[[science,science],[science,science],[{circuitCrusher:true},furnace],[null,null]]
  :[[science,science],[science,science],[crusher('oxide-asteroid-crushing','ice'),crusher('metallic-asteroid-crushing','iron-ore')],[crusher('carbonic-asteroid-crushing','carbon'),furnace]];
 // Collection network (green): constant combinator (chunk values, clock tick) and an arithmetic combinator
 // that writes minus the hub contents. Collectors see chunkCap - count per chunk type.
 constant=add({name:'constant-combinator',position:{x:-1.5,y:-4.5},control_behavior:{sections:{sections:[{index:1,filters:[...chunkTypes.map((n,i)=>({index:i+1,name:n,quality:'normal',comparator:'=',count:caps.chunk})),{index:4,type:'virtual',name:'signal-T',quality:'normal',comparator:'=',count:1}]}]}}});
 negate=add({name:'arithmetic-combinator',position:{x:1,y:-4.5},direction:4,control_behavior:{arithmetic_conditions:{first_signal:virtual('signal-each'),second_constant:-1,operation:'*',output_signal:virtual('signal-each')}}});
 wires.push([hub,1,negate,1],[negate,4,constant,2]);
 let last=constant;greenChain.add(constant);
 sides.forEach(([west,east],k)=>{
  const mw=machineSlot('W',west,k);
  const [x,y]=rot([-0.5,-6.5],k);
  // A collector needs foundation under its two rear rows only; its outer row and four rows in front stay open.
  const col=add({name:'asteroid-collector',position:{x,y},direction:(4*k)%16,control_behavior:{circuit_set_filters:true}});rect(-2,-7,0,-6,k);
  collectors.push({entity:col,side:'nesw'[k]});
  roles.collector.push(arm([-0.5,-4.5],0,k));
  const me=machineSlot('E',east,k);
  // The circuit-set crusher stays off the green network (its item signals could select a recipe).
  for(const n of [mw,col,me]){if(n==null||(west?.circuitCrusher&&n===mw))continue;wires.push([last,2,n,2]);last=n;greenChain.add(n);}
 });
 // Crusher clock: T counts 1..period on the green network; one gate decider per crusher sends G = 1 to its
 // ingredient arm during its windows while its product is below the cap. At most one crusher runs at a time.
 const windows={'oxide-asteroid-crushing':[[1,20],[451,470]],'metallic-asteroid-crushing':[[226,245]],'carbonic-asteroid-crushing':[[676,695]]};
 const stockOf={'oxide-asteroid-crushing':'ice','metallic-asteroid-crushing':'iron-ore','carbonic-asteroid-crushing':'carbon'};
 const sideOf={'oxide-asteroid-crushing':2,'metallic-asteroid-crushing':1,'carbonic-asteroid-crushing':3};
 timer=add({name:'decider-combinator',position:{x:1.5,y:-6},direction:0,control_behavior:{decider_conditions:{conditions:[{first_signal:T,constant:period}],outputs:[{signal:T}],else_outputs:[]}}});
 tile(1,-7);tile(1,-6);wires.push([timer,2,constant,2],[timer,4,timer,2]);
 if(variant.singleCrusher){
  // One recipe decider per crushing recipe sends that recipe's signal (value 1) on the red "recipe network" for its
  // whole window while its product is below the cap; the crusher sets its recipe from it. The windows tile the
  // 900-tick period (oxide twice), so the recipe changes four times per period and leftovers go to the crusher's dump
  // inventory, which its product arm empties into the hub. A feed decider sends signal-G for the first 19 ticks of
  // each window to the crusher's ingredient arm: at most one chunk per window, crushed in 2 s, long before the window ends.
  const recipeWindows={'oxide-asteroid-crushing':[[1,226],[451,676]],'metallic-asteroid-crushing':[[226,451]],'carbonic-asteroid-crushing':[[676,901]]};
  const feedWindows=[[1,20],[226,245],[451,470],[676,695]];
  const crusherEntity=machines.find(m=>m.recipe===CIRCUIT_CRUSHING).entity;
  const recipeDeciders={};
  for(const [recipe,stock] of Object.entries(crushingStock)){
   const side=sideOf[recipe],[x,y]=rot([1.0,-4.5],side);
   const conditions=[];
   recipeWindows[recipe].forEach(([from,to],i)=>{
    const c={first_signal:T,constant:from,comparator:'≥',first_signal_networks:G};if(i>0)c.compare_type='or';
    conditions.push(c,{first_signal:T,constant:to,first_signal_networks:G,compare_type:'and'},{first_signal:{name:stock},constant:caps[stock],first_signal_networks:R,compare_type:'and'});
   });
   const d=add({name:'decider-combinator',position:{x,y},direction:(4+4*side)%16,control_behavior:{decider_conditions:{conditions,outputs:[{signal:{type:'recipe',name:recipe},copy_count_from_input:false}],else_outputs:[]}}});
   wires.push([hub,1,d,1],[d,2,nearestGreen(x,y),2]);
   recipeDeciders[recipe]={decider:d,windows:recipeWindows[recipe],stock,cap:caps[stock]};
  }
  const [fx,fy]=rot([-3,-4.5],3);
  const feedConditions=[];
  feedWindows.forEach(([from,to],i)=>{const c={first_signal:T,constant:from,comparator:'≥',first_signal_networks:G};if(i>0)c.compare_type='or';feedConditions.push(c,{first_signal:T,constant:to,first_signal_networks:G,compare_type:'and'});
   if(variant.chargeFloor)feedConditions.push({first_signal:virtual('signal-A'),constant:variant.chargeFloor,comparator:'≥',first_signal_networks:G,compare_type:'and'});});
  const feed=add({name:'decider-combinator',position:{x:fx,y:fy},direction:(4+4*3)%16,control_behavior:{decider_conditions:{conditions:feedConditions,outputs:[{signal:virtual('signal-G'),copy_count_from_input:false}],else_outputs:[]}}});
  wires.push([feed,2,nearestGreen(fx,fy),2]);
  // The recipe network (red, decider outputs): west recipe decider, feed decider, south recipe decider, the feed arm,
  // the east recipe decider and the crusher. Neither the hub nor the green network is on it.
  const rd=r=>recipeDeciders[r].decider;
  wires.push([rd('carbonic-asteroid-crushing'),3,feed,3],[feed,3,rd('oxide-asteroid-crushing'),3],[rd('oxide-asteroid-crushing'),3,feedArm,1],[rd('metallic-asteroid-crushing'),3,feedArm,1],[feedArm,1,crusherEntity,1]);
  gates.feed={decider:feed,arm:feedArm,windows:feedWindows};
  recipeClock={crusher:crusherEntity,recipeDeciders,feed:{decider:feed,arm:feedArm,windows:feedWindows,...(variant.chargeFloor?{chargeFloorPercent:variant.chargeFloor}:{})}};
 }
 for(const {arm:a,recipe} of gateArms){
  if(variant.singleCrusher)break;
  const [x,y]=rot([1.0,-4.5],sideOf[recipe]);const stock=stockOf[recipe];
  const conditions=[];
  windows[recipe].forEach(([from,to],i)=>{
   const c={first_signal:T,constant:from,comparator:'≥',first_signal_networks:G};if(i>0)c.compare_type='or';
   conditions.push(c,{first_signal:T,constant:to,first_signal_networks:G,compare_type:'and'},{first_signal:{name:stock},constant:caps[stock],first_signal_networks:R,compare_type:'and'});
  });
  const d=add({name:'decider-combinator',position:{x,y},direction:(4+4*sideOf[recipe])%16,control_behavior:{decider_conditions:{conditions,outputs:[{signal:virtual('signal-G'),copy_count_from_input:false}],else_outputs:[]}}});
  wires.push([hub,1,d,1],[d,3,a,1]);
  const near=entities.filter(e=>greenChain.has(e.entity_number)).sort((p,q)=>Math.hypot(p.position.x-x,p.position.y-y)-Math.hypot(q.position.x-x,q.position.y-y)||p.entity_number-q.entity_number)[0];
  wires.push([d,2,near.entity_number,2]);
  gates[recipe]={decider:d,arm:a,windows:windows[recipe],stock,cap:caps[stock]};
 }
}
// Solar panels and accumulators.
const panel=([x,y])=>{add({name:'solar-panel',position:{x,y}});for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)tile(Math.floor(x)+dx,Math.floor(y)+dy);};
const accumulator=([x,y])=>{add({name:'accumulator',position:{x,y}});for(const dx of [-1,0])for(const dy of [-1,0])tile(x+dx,y+dy);};
if(variant.power==='corners-outward'){
 // one corner block per turn first, then outward
 const spots=[[6.5,-6.5],[9.5,-6.5],[6.5,-9.5],[9.5,-9.5],[12.5,-6.5],[6.5,-12.5]];
 let placed=0;
 outer:for(const s of spots)for(let k=0;k<4;k++){if(placed>=variant.panels)break outer;panel(rot(s,k));placed++;}
 for(let i=0;i<variant.accumulators;i++)accumulator([-9-2*i,-5]);
}else{for(const p of variant.power.panels)panel(p);for(const a of variant.power.accumulators)accumulator(a);}
let chargeReader=null;
if(variant.chargeFloor){
 // The first listed accumulator sends its charge (signal-A, percent) to the green network; all accumulators on one
 // electric network charge and discharge together.
 const e=entities.find(e=>e.name==='accumulator');e.control_behavior={output_signal:virtual('signal-A')};chargeReader=e.entity_number;
 wires.push([chargeReader,2,nearestGreen(e.position.x,e.position.y),2]);
}
assert.equal(entities.filter(e=>e.name==='solar-panel').length,variant.panels);assert.equal(entities.filter(e=>e.name==='accumulator').length,variant.accumulators);
// All foundation is one 4-connected piece (the hub builds tiles outward from the starter square).
{const seen=new Set([key(0,0)]),todo=[[0,0]];while(todo.length){const [x,y]=todo.pop();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=key(x+dx,y+dy);if(tiles.has(k)&&!seen.has(k)){seen.add(k);todo.push([x+dx,y+dy]);}}}assert.equal(seen.size,tiles.size,'foundation must be connected');}
// Every entity stands on foundation (collectors: their two rear rows).
for(const e of entities){if(e.name==='asteroid-collector')continue;for(const [x,y] of footprintCells(e))assert(tiles.has(key(x,y)),`${e.name} #${e.entity_number} off foundation at ${x},${y}`);}
// Nothing on the four rows in front of a collector (its outer row included).
// Checked from each collector's own position and direction (the outward step), so it holds for every layout.
for(const c of collectors){const e=entities[c.entity-1],[dx,dy]={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]}[e.direction??0],cx=Math.floor(e.position.x),cy=Math.floor(e.position.y);
 for(let d=1;d<=5;d++)for(let s=-1;s<=1;s++){const x=cx+dx*d+(dy?s:0),y=cy+dy*d+(dx?s:0),o=occupied.get(key(x,y));assert(!o||o===e,`entity ${o?.name} in front of collector ${c.entity}`);assert(!tiles.has(key(x,y)),'foundation in front of collector');}
 for(let back=0;back<=1;back++)for(let s=-1;s<=1;s++)assert(tiles.has(key(cx-dx*back+(dy?s:0),cy-dy*back+(dx?s:0))),'collector rear rows need foundation');}
// Circuit wires at most 8 tiles centre to centre.
const byNumber=n=>entities[n-1];
for(const [a,,b] of wires){const p=byNumber(a).position,q=byNumber(b).position;assert(Math.hypot(p.x-q.x,p.y-q.y)<=8,`wire ${a}-${b} too long`);}
for(const e of entities)if(e.name!=='space-platform-hub')e.tags={flight_science_entity:e.entity_number};

// ---------- recipe audit from the dump ----------
const speedOf={'assembling-machine-2':raw['assembling-machine']['assembling-machine-2'].crafting_speed,'electric-furnace':raw.furnace['electric-furnace'].crafting_speed,crusher:raw['assembling-machine'].crusher.crafting_speed};
const recipe=n=>{const r=raw.recipe[n];assert(r,n);return {energy:r.energy_required??.5,ingredients:r.ingredients,results:r.results};};
const amountOf=(list,name)=>list.filter(p=>p.name===name).reduce((a,p)=>a+(p.amount??1)*(p.probability??1),0);
const sciencePerCraft=amountOf(recipe(product).results,product);
const craftsPerMinute={[product]:target/sciencePerCraft};
const need={};for(const i of recipe(product).ingredients)need[i.name]=i.amount*craftsPerMinute[product];
craftsPerMinute['iron-plate']=need['iron-plate']/amountOf(recipe('iron-plate').results,'iron-plate');
need['iron-ore']=craftsPerMinute['iron-plate']*amountOf(recipe('iron-plate').ingredients,'iron-ore');
const crushing={'metallic-asteroid-crushing':'iron-ore','carbonic-asteroid-crushing':'carbon','oxide-asteroid-crushing':'ice'};
const chunksPerMinute={};
for(const [r,stock] of Object.entries(crushing)){
 const rr=recipe(r);craftsPerMinute[r]=need[stock]/amountOf(rr.results,stock);
 const chunk=rr.ingredients[0].name,back=rr.results.find(p=>p.name===chunk);
 chunksPerMinute[chunk]=craftsPerMinute[r]*(1-(back?.independent_probability??0));
}
const machineOf=r=>r===product?'assembling-machine-2':r==='iron-plate'?'electric-furnace':'crusher';
const perMachine=Object.fromEntries(Object.keys(craftsPerMinute).map(r=>[r,60*speedOf[machineOf(r)]/recipe(r).energy]));
const machineCounts={};for(const m of machines)machineCounts[m.recipe]=(machineCounts[m.recipe]||0)+1;
if(variant.singleCrusher){
 // One crusher shares its time: at most one craft per window, and all crushing together within one machine.
 const windowsPerMinute=r=>recipeClock.recipeDeciders[r].windows.length*3600/period;
 for(const r of Object.keys(crushingStock)){assert(windowsPerMinute(r)>=craftsPerMinute[r]*2,`${r}: ${windowsPerMinute(r)} windows/min for ${craftsPerMinute[r]} crafts/min`);}
 assert(Object.keys(crushingStock).reduce((a,r)=>a+craftsPerMinute[r]/perMachine[r],0)<=machineCounts[CIRCUIT_CRUSHING]*0.5,'one crusher has the time');
}
for(const [r,c] of Object.entries(craftsPerMinute)){if(variant.singleCrusher&&crushingStock[r])continue;assert(machineCounts[r]*perMachine[r]>=c-1e-9,`${r}: ${machineCounts[r]} machines cannot make ${c} crafts/min`);}
assert.equal(machineCounts[product]*perMachine[product]*sciencePerCraft,target,'science machines at full speed make exactly the target');

// ---------- bill of materials and rocket weight ----------
const itemFor=name=>{const hits=Object.values(raw.item).filter(i=>i.place_result===name).map(i=>i.name);assert(hits.length>=1,'no item places '+name);return hits.includes(name)?name:hits.sort()[0];};
const tileItem=Object.values(raw.item).find(i=>i.place_as_tile?.result==='space-platform-foundation')?.name;assert.equal(tileItem,'space-platform-foundation');
const items={};for(const e of entities){if(e.name==='space-platform-hub')continue;const it=itemFor(e.name);items[it]=(items[it]||0)+1;}
items[tileItem]=tiles.size;
const sortObj=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a<b?-1:1));
const starterPackProvides={[tileItem]:STARTER.placedTiles+STARTER.hubFoundation};
const platformRequest=sortObj(Object.fromEntries(Object.entries(items).map(([n,c])=>[n,c-(starterPackProvides[n]||0)]).filter(([,c])=>c>0)));
for(const n of Object.keys(items))assert(WEIGHT_KG[n]>0,'no inline weight for '+n);
const requestedWeightKg=Object.entries(platformRequest).reduce((a,[n,c])=>a+WEIGHT_KG[n]*c,0);
if(!variant.probe)assert.equal(requestedWeightKg%ROCKET_LIFT_KG,0,`requested weight ${requestedWeightKg} kg is not a whole number of rockets`);
if(!variant.probe)assert.equal(requestedWeightKg,variant.goalKg??5000,'goal: exactly '+((variant.goalKg??5000)/ROCKET_LIFT_KG)+' cargo rockets');
// Kit count ranges (launch-kit.md section 2) and the closed item list (CONTRACT section 3).
const ranges={'space-platform-foundation':300,'asteroid-collector':8,crusher:6,'assembling-machine-2':10,'electric-furnace':4,'fast-inserter':44,'solar-panel':30,accumulator:10,'constant-combinator':10,'arithmetic-combinator':10,'decider-combinator':10};
assert.deepEqual(Object.keys(platformRequest).sort(),Object.keys(ranges).sort(),'every kit item type used, nothing else');
for(const [n,c] of Object.entries(platformRequest))assert(c>=1&&c<=ranges[n],`${n} ${c} outside the kit range`);

// ---------- footprint ----------
const xs=[...tiles.values()].map(t=>t.position.x),ys=[...tiles.values()].map(t=>t.position.y);
const footprint={left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs)+1,bottom:Math.max(...ys)+1};footprint.width=footprint.right-footprint.left;footprint.height=footprint.bottom-footprint.top;
const newFoundationTiles=tiles.size-STARTER.placedTiles;

const panelsKw=variant.panels*180;
const description=`Factorio 2.1.24 Space Age, normal quality. Stationary in Nauvis orbit, no thrusters, no fuel, no defence (Nauvis orbit sends only small chunks). Makes ${target} space science packs per minute from asteroid chunks and keeps them in the hub (stops at ${caps[product]}); a cargo landing pad on Nauvis that requests packs receives them by itself. 4 asteroid collectors (one per side), ${variant.singleCrusher?'1 crusher (its recipe set by the circuit clock: oxide, metallic, carbonic in turn)':'3 crushers (oxide, metallic, carbonic)'}, 1 electric furnace, 4 assembling machine 2, ${variant.panels} solar panels, ${variant.accumulators} accumulator${variant.accumulators===1?'':'s'}. Paste it anywhere on a platform made from one starter pack: it snaps to the hub. Keep the hub's "request missing construction materials" on: the platform then asks rockets for exactly ${requestedWeightKg} kg (${requestedWeightKg/ROCKET_LIFT_KG} full rockets). Keep the wires: hub contents on red to the conditioned arms and the negating combinator; chunk values (${caps.chunk} each) and the crusher clock on green${variant.singleCrusher?'; the crusher\'s recipe signals on their own red wire':''}.`;
const bp={item:'blueprint',label:'White-pack platform · 60/min in Nauvis orbit',description,icons:[{index:1,signal:{type:'item',name:product}}],entities,wires,tiles:[...tiles.values()],version:562954249961473};
const finalCode=encodeBlueprint({blueprint:bp});

// ---------- status and measured values from the committed report ----------
let status='native-validation-pending',measured,rocketCargo=null;
try{
 const report=JSON.parse(await fs.readFile(out+'/native-report.json','utf8'));
 const r=report.builds?.find(b=>b.id===id&&b.blueprintSha256===sha(finalCode));
 if(r&&!report.short){
  status=r.passed&&report.passed?'qualified':'not-qualified';
  rocketCargo=report.rocketDelivery?.launches?.map(l=>l.cargo)??null;
  measured={steadyPerMinute:r.steady?.collectedPerMinute,madePerMinute:r.steady?.madePerMinute,recoveryPerMinute:r.recovery?.collectedPerMinute,recoveryMadePerMinute:r.recovery?.madePerMinute,buildSeconds:r.build?.seconds,firstPodSeconds:r.firstPodSecondsAfterBuild,averageKw:r.power?.averageKw,peakKw:r.power?.peakKw,lowPowerTicks:r.power?.lowPowerTicks,lowestAccumulatorMJ:r.power?.lowestAccumulatorMJ,lowestFreeSlots:r.stocks?.lowestFreeSlots,maximumStock:r.stocks?.maximum,blockedHubPacks:r.blocked?.hubPacks,rocketLaunches:report.rocketDelivery?.launches?.length,rocketDeliveryMinutes:report.rocketDelivery?.builtMinutes,reportCreatedAt:report.createdAt};
 }
}catch{}

const hubPort={kind:'output',label:product,items:[product],item:product,entity:hub,x:0,y:0,position:{x:0,y:0},externalSide:'hub',cap:caps[product],ceiling:ceilings[product]};
const construction=sortObj(Object.fromEntries([...new Set(entities.map(e=>e.name))].map(n=>[n,entities.filter(e=>e.name===n).length])));
const manifest={
 id,name:bp.label,file:id+'.txt',blueprintSha256:sha(finalCode),prototypeSha256:sha(bytes),class:'platform',status,...(measured?{measured}:{}),
 variant:variantName,layout:variant,
 products:[product],targets:{[product]:target},outputCaps:{[product]:caps[product]},
 recipeAudit:{externalPerMinute:{},craftsPerMinute,chunksPerMinute,itemsPerMinute:need,perMachineCraftsPerMinute:perMachine,recipeIngredients:Object.fromEntries(Object.keys(craftsPerMinute).map(r=>[r,raw.recipe[r].ingredients]))},
 inputs:[],fluids:[],outputs:[hubPort],ports:[hubPort],
 machineCounts,machines,collectors,
 footprint,foundationTiles:tiles.size,newFoundationTiles,
 areaGoal:{goalTiles:283,goalRectangle:'22 x 22',achievedTiles:tiles.size,achievedRectangle:`${footprint.width} x ${footprint.height}`},
 loopControl:[],
 stockControl:{mode:'hub-condition',hub,caps,ceilings,minimumFreeSlots:protocol.minimumFreeSlots,
  armRoles:roles,collectionNetwork:{constant,negate,collectors:collectors.map(c=>c.entity),chunkCap:caps.chunk},
  rule:`Science ingredient arms run while the hub holds fewer than ${caps[product]} packs (red wire from the hub); the furnace arm (iron-ore filter) while plates < ${caps['iron-plate']}; each crusher arm only in its clock window and while its product (ice, iron ore, carbon) < its cap; collectors pick a chunk type only while the hub holds fewer than ${caps.chunk} of it.`},
 productionClock:variant.singleCrusher?{timer,period,signal:'signal-T',gates,recipeClock,note:'One crusher, recipe set by circuit: each recipe decider holds its recipe signal for its whole window (225 ticks) while its product is below the cap; the feed decider opens the ingredient arm for the first 19 ticks of each window, shorter than one fast-inserter cycle, so the crusher gets at most one chunk per window and crushes it in 2 s. Leftovers at a recipe change go to the dump inventory and the product arm returns them to the hub.'}:{timer,period,signal:'signal-T',gates,note:'A window is 19 ticks, shorter than one fast-inserter cycle, so a crusher gets at most one chunk per window and crushes it in 2 s; no two crushers run together.'},
 power:{solarPanels:variant.panels,accumulators:variant.accumulators,panelKwInNauvisOrbit:180,supplyKw:panelsKw,...(chargeReader?{chargeReader,chargeFloorPercent:variant.chargeFloor}:{})},
 protocol,construction,
 billOfMaterials:{items:sortObj(items),starterPackProvides,platformRequest,weightKg:sortObj(Object.fromEntries(Object.keys({...platformRequest,'space-platform-starter-pack':1}).map(n=>[n,WEIGHT_KG[n]]))),requestedWeightKg,rocketLiftKg:ROCKET_LIFT_KG,cargoRockets:requestedWeightKg/ROCKET_LIFT_KG,starterPackRockets:1,totalRockets:requestedWeightKg/ROCKET_LIFT_KG+1,rocketCargo},
 supplierLinks:[],
 receiver:'white-pack-receiver',
 setupNotes:[
  description,
  'Paste the blueprint anywhere on the platform: it contains the hub and snaps to the real hub. Do not use grid snapping.',
  'Keep the hub setting "request missing construction materials" on (the blueprint sets it). Without it the platform never asks for the parts.',
  `Rockets leave only when full (1,000 kg). The platform asks for exactly ${requestedWeightKg} kg, which is ${requestedWeightKg/ROCKET_LIFT_KG} full rockets after the starter-pack rocket; any change to the bill must keep a whole number of rockets.`,
  'Tick "automatic requests from space platforms" on the rocket silo once.',
  'Packs reach the ground through the white-pack receiver (a landing pad that requests space science packs); no click is needed after it is built.',
 ],
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/'+id+'.txt',finalCode+'\n');
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
// ASCII map for the README and for reviewing a change (written to the cache, not to the source folder).
const glyph={'space-platform-hub':'H','assembling-machine-2':'A','electric-furnace':'F','asteroid-collector':'C','solar-panel':'S','fast-inserter':'i','decider-combinator':'d',accumulator:'B','constant-combinator':'k','arithmetic-combinator':'a',crusher:'X'};
const grid=new Map();for(const t of tiles.values())grid.set(key(t.position.x,t.position.y),'.');
for(const e of entities)for(const [x,y] of footprintCells(e))grid.set(key(x,y),glyph[e.name]);
const lines=[];for(let y=footprint.top-1;y<=footprint.bottom;y++){let row='';for(let x=footprint.left-1;x<=footprint.right;x++)row+=grid.get(key(x,y))||' ';lines.push(row.trimEnd());}
await fs.writeFile(path.join('.cache',id,variantName+'-map.txt'),lines.join('\n')+'\n');
console.log(JSON.stringify({id,variant:variantName,out,status,footprint,foundationTiles:tiles.size,newFoundationTiles,platformRequest,requestedWeightKg,blueprintSha256:manifest.blueprintSha256}));
