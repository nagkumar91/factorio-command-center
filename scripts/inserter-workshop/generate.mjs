// On-demand inserter workshop: one stock-controlled belt ring, 22 x 15 tiles, 12 assembling machine 2.
//
//   node scripts/inserter-workshop/generate.mjs
//
// Writes blueprint-sources/inserter-workshop/{inserter-workshop.txt,manifest.json}. A re-run leaves both
// byte-identical: the manifest says "native-verified-declared-inputs" only when the committed
// native-report.json passed for the exact SHA-256 this run produced, otherwise "native-validation-pending".
//
// For screening ideas: INSERTER_WORKSHOP_OUT writes a trial copy to another folder, and INSERTER_WORKSHOP_TRY
// is a JSON object of layout switches (westIronArms, riserArm, greenIronArms, clock, windows, phases,
// limits). The published design is the one with no switches set.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';

const DEFAULT_RAW='/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const rawBytes=await fs.readFile(process.env.FACTORIO_RAW||DEFAULT_RAW),raw=JSON.parse(rawBytes);
const root=process.env.INSERTER_WORKSHOP_OUT||'blueprint-sources/inserter-workshop',id='inserter-workshop';
const attempt={westIronArms:2,riserArm:true,greenIronArms:2,clock:'modulo',windows:12,...JSON.parse(process.env.INSERTER_WORKSHOP_TRY||'{}')};
// Blueprint format version of Factorio 2.1.24, the same number every other 2.1 design here carries.
const BLUEPRINT_VERSION=562954249961472;

const products=['inserter','long-handed-inserter','fast-inserter','bulk-inserter'];
const feeds=['iron-plate','copper-plate','plastic-bar'];
// Ring stock caps: an arm that adds an item to the ring works only while the ring holds fewer than this.
const limits={'iron-plate':24,'copper-plate':32,'plastic-bar':2,'iron-gear-wheel':20,'copper-cable':16,'electronic-circuit':32,'advanced-circuit':2,inserter:12,'long-handed-inserter':4,'fast-inserter':8,'bulk-inserter':4,...attempt.limits};
// Normal and fast inserters are ingredients of the next tier: the export arm leaves this many on the ring.
const reserves={inserter:2,'fast-inserter':2};
const targets={inserter:15,'long-handed-inserter':15,'fast-inserter':15,'bulk-inserter':2.5};
const requestedTargets={...targets,'bulk-inserter':5};
// With all four chests emptied at once the workshop makes more than its targets and draws more plates
// than the recipe arithmetic for the targets. This is the supply to give each entrance: the measured
// full-drain draw (623 iron, 269 copper, 6.4 plastic a minute) rounded up. The stated-supply probe feeds
// exactly these figures and must pass the same rate checks as the full-belt protocol.
const fullDrainSupplyPerMinute={'iron-plate':630,'copper-plate':275,'plastic-bar':7};
const NORTH=0,EAST=4,SOUTH=8,WEST=12;

// ---- placement -------------------------------------------------------------------------------------
const prototype=name=>{const p=Object.values(raw).map(group=>group[name]).find(p=>p?.selection_box);assert(p,'unknown prototype '+name);return p;};
function tileBox(e){
 const box=prototype(e.name).selection_box;let w=Math.ceil(box[1][0]-box[0][0]),h=Math.ceil(box[1][1]-box[0][1]);
 if(e.name==='display-panel')w=h=1;
 if([EAST,WEST].includes(e.direction))[w,h]=[h,w];
 return {left:e.position.x-w/2,right:e.position.x+w/2,top:e.position.y-h/2,bottom:e.position.y+h/2};
}
const entities=[],circuitWires=[],occupied=new Map();
function add(name,x,y,extra={}){
 const e={entity_number:entities.length+1,name,position:extra.position||{x:x+.5,y:y+.5},...extra},box=tileBox(e);
 for(let u=Math.round(box.left);u<box.right;u++)for(let v=Math.round(box.top);v<box.bottom;v++){const key=u+','+v;assert(!occupied.has(key),`${name} collides at ${key} with ${occupied.get(key)}`);occupied.set(key,name);}
 entities.push(e);return e;
}
const item=name=>({type:'item',name,quality:'normal'});
const filter=names=>({use_filters:true,filters:names.map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))});
const enabledWhile=(first_signal,comparator,constant)=>({control_behavior:{circuit_enabled:true,circuit_condition:{first_signal,comparator,constant}}});
const belowCap=name=>enabledWhile(item(name),'<',limits[name]);
const belt=(x,y,direction)=>add('fast-transport-belt',x,y,{direction});
const underground=(x,y,direction,type)=>add('fast-underground-belt',x,y,{direction,type});
// A bulk inserter at its unlock hand size of two. Its direction names the side it picks up from.
const arm=(x,y,direction,items,control={})=>add('bulk-inserter',x,y,{direction,override_stack_size:2,...filter(items),...control});
const longArm=(x,y,direction,items)=>add('long-handed-inserter',x,y,{direction,...filter(items)});
const redWire=(a,b)=>circuitWires.push([a.entity_number,1,b.entity_number,1]);

// ---- the ring --------------------------------------------------------------------------------------
// Clockwise: east along row 0, south down column 17, west along row 6, north up column 1. Two tiles are
// bridged by an underground pair so a long-handed arm can pass copper cable across the ring.
const RING={left:1,right:17,top:0,bottom:6},TOP_BRIDGE=15,REAR_BRIDGE=11;
const ring=[],ringAt=new Map();
function ringTile(x,y,direction){
 const bridge=y===RING.top&&Math.abs(x-TOP_BRIDGE)===1?(x<TOP_BRIDGE?'input':'output'):y===RING.bottom&&Math.abs(x-REAR_BRIDGE)===1?(x>REAR_BRIDGE?'input':'output'):null;
 if((y===RING.top&&x===TOP_BRIDGE)||(y===RING.bottom&&x===REAR_BRIDGE))return;
 const e=bridge?underground(x,y,direction,bridge):belt(x,y,direction);ring.push(e);ringAt.set(x+','+y,e);
}
for(let x=RING.left;x<=RING.right;x++)ringTile(x,RING.top,x===RING.right?SOUTH:EAST);
for(let y=RING.top+1;y<=RING.bottom;y++)ringTile(RING.right,y,y===RING.bottom?WEST:SOUTH);
for(let x=RING.right-1;x>=RING.left;x--)ringTile(x,RING.bottom,x===RING.left?NORTH:WEST);
for(let y=RING.bottom-1;y>RING.top;y--)ringTile(RING.left,y,NORTH);
const at=(x,y)=>{const e=ringAt.get(x+','+y);assert(e,`no ring tile at ${x},${y}`);return e;};
// One whole-belt hold reader publishes the ring's stock on a red wire that follows the ring. Underground
// pieces carry no wire: the wire steps over each bridge from belt to belt.
const wired=ring.filter(e=>e.name==='fast-transport-belt'),reader=wired[0];
reader.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
for(let i=0;i<wired.length;i++)redWire(wired[i],wired[(i+1)%wired.length]);
const nearestWired=(x,y)=>wired.slice().sort((a,b)=>Math.hypot(a.position.x-x-.5,a.position.y-y-.5)-Math.hypot(b.position.x-x-.5,b.position.y-y-.5))[0];
const controlled=[];
const onRingWire=(e,x,y)=>{redWire(e,nearestWired(x,y));controlled.push(e.entity_number);return e;};

// ---- machines --------------------------------------------------------------------------------------
const machines=[];
const machine=(recipe,cx,cy)=>{const m=add('assembling-machine-2',cx,cy,{recipe});machines.push({recipe,entity:m.entity_number});return m;};
const ingredientsOf=recipe=>raw.recipe[recipe].ingredients.map(i=>i.name);
// The clock shares the ring's gears, circuits and plates between the three small tiers. A 30 second
// cycle has twelve phases of 2.5 seconds: the normal tier's ingredient arms work in phases 0 to 9, the
// long-handed tier's in 0 to 4 and the fast tier's in 6 to 11. The bulk tier's arms always work; it is
// last on the ring and takes what the others leave.
const PHASE={type:'virtual',name:'signal-P'};
const phases={inserter:['<',10],'long-handed-inserter':['<',5],'fast-inserter':['>',5],...attempt.phases};
const phaseGate=Object.fromEntries(Object.entries(phases).filter(([,gate])=>gate).map(([name,[comparator,constant]])=>[name,enabledWhile(PHASE,comparator,constant)]));

// Top row: the four inserter tiers and the red circuit, each above ring row 0.
function topStation(recipe,cx){
 machine(recipe,cx,-3);
 const all=ingredientsOf(recipe);
 // The bulk tier needs 15 gears a craft: one arm carries only gears, the other everything else.
 const loads=recipe==='bulk-inserter'?[['iron-gear-wheel'],all.filter(n=>n!=='iron-gear-wheel')]:recipe==='advanced-circuit'?[all]:[all,all];
 loads.forEach((items,i)=>{const gate=recipe==='bulk-inserter'&&i===0?undefined:phaseGate[recipe];const e=arm(cx-1+i,-1,SOUTH,items,gate);if(gate)onRingWire(e,cx-1+i,0);});
 onRingWire(arm(cx+1,-1,NORTH,[recipe],belowCap(recipe)),cx+1,0);
}
['inserter','long-handed-inserter','fast-inserter','bulk-inserter','advanced-circuit'].forEach((recipe,i)=>topStation(recipe,3+3*i));

// Inside row: cable, green, green, cable. Each cable assembler hands wire straight to the green
// assembler beside it and puts the rest on ring row 6.
function insideStation(recipe,cx){
 machine(recipe,cx,3);
 const inputs=recipe==='copper-cable'?[cx-1]:[cx-1,cx];
 for(const x of inputs)arm(x,1,NORTH,ingredientsOf(recipe));
 const outputs=recipe==='copper-cable'?[cx+1,cx]:[cx+1];
 for(const x of outputs)onRingWire(arm(x,5,NORTH,[recipe],belowCap(recipe)),x,6);
}
insideStation('copper-cable',3);insideStation('electronic-circuit',7);insideStation('electronic-circuit',11);insideStation('copper-cable',15);
arm(5,3,WEST,['copper-cable']);arm(13,3,EAST,['copper-cable']);
// Each green assembler also takes iron from ring row 6, just downstream of the riser arm.
if(attempt.greenIronArms>1)arm(7,5,SOUTH,['iron-plate']);if(attempt.greenIronArms>0)arm(10,5,SOUTH,['iron-plate']);
// Cable from the east cable assembler crosses ring row 0 into the red-circuit assembler.
longArm(TOP_BRIDGE,RING.top,SOUTH,['copper-cable']);

// Bottom row: a gear assembler at each end, the rear cable assembler whose wire crosses ring row 6 into
// the second green assembler, and the iron riser. Gears and rear cable go onto ring row 6.
function bottomStation(recipe,cx,inputColumns,outputColumns){
 machine(recipe,cx,9);
 for(const x of inputColumns)arm(x,7,NORTH,ingredientsOf(recipe));
 for(const x of outputColumns)onRingWire(arm(x,7,SOUTH,[recipe],belowCap(recipe)),x,6);
}
bottomStation('iron-gear-wheel',2,[],[3]);
bottomStation('copper-cable',10,[9],[10]);
bottomStation('iron-gear-wheel',16,[],[15]);
longArm(REAR_BRIDGE,RING.bottom,SOUTH,['copper-cable']);

// ---- west entrances --------------------------------------------------------------------------------
// Each material enters once on its own row. Arms in column 0 lift it onto the ring's west column while
// the ring holds less than its cap. The iron belt then dives under the copper and plastic rows and comes
// up between the two gear assemblers.
const ports=[];
function entrance(itemName,row,e){ports.push({kind:'input',item:itemName,items:[itemName],entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position,direction:EAST,externalSide:'west'});}
const feedArm=(itemName,row)=>onRingWire(arm(0,row,WEST,[itemName],belowCap(itemName)),1,row);
const panel=(index,itemName,row,x,y,note='')=>add('display-panel',x,y,{icon:{type:'item',name:itemName},text:`IN ${index}: ${itemName}\nWEST entrance, row ${row}.${note}`,always_show:true});
entrance('iron-plate',1,belt(-2,1,EAST));belt(-1,1,SOUTH);underground(-1,2,SOUTH,'input');for(let row=1;row<=attempt.westIronArms;row++)feedArm('iron-plate',row);
panel(1,'iron-plate',1,-2,2,' Both iron arms and the gear assemblers share this one entrance.');
// The buried iron branch: past the west gear assembler, under the bottom row, up the riser in column 13
// and under ring row 6 to a tile inside the ring. The riser arm stands inside the ring, so it lays iron on
// the ring's outer lane; the west arms lay theirs on the inner lane.
underground(-1,9,SOUTH,'output');arm(0,9,WEST,['iron-plate']);belt(-1,10,EAST);
underground(0,10,EAST,'input');underground(7,10,EAST,'output');underground(8,10,EAST,'input');underground(12,10,EAST,'output');
belt(13,10,NORTH);belt(13,9,NORTH);belt(13,8,NORTH);arm(14,9,WEST,['iron-plate']);
underground(13,7,NORTH,'input');underground(13,4,NORTH,'output');
if(attempt.riserArm)onRingWire(arm(13,5,NORTH,['iron-plate'],belowCap('iron-plate')),13,6);
entrance('copper-plate',3,belt(-2,3,EAST));belt(-1,3,SOUTH);belt(-1,4,EAST);feedArm('copper-plate',3);feedArm('copper-plate',4);
panel(2,'copper-plate',3,-2,4);
entrance('plastic-bar',5,belt(-2,5,EAST));belt(-1,5,EAST);feedArm('plastic-bar',5);
panel(3,'plastic-bar',5,-2,6);

// ---- east exits ------------------------------------------------------------------------------------
// One passive provider chest per tier, limited to one stack: a physical cap of 50.
for(const [i,name] of products.entries()){
 const y=i+1,reserve=reserves[name]||0;
 const e=arm(RING.right+1,y,WEST,[name],reserve?enabledWhile(item(name),'>',reserve):{});
 if(reserve)redWire(e,at(RING.right,y));
 const chest=add('passive-provider-chest',RING.right+2,y,{bar:1});
 ports.push({kind:'output',item:name,items:[name],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:chest.position,externalSide:'east',cap:50,reserve});
}

// ---- clock -----------------------------------------------------------------------------------------
const virtual=name=>({type:'virtual',name});
const combinator=(x,y,operation,first,output,constant)=>add('arithmetic-combinator',x,y,{position:{x:x+1,y:y+.5},direction:EAST,control_behavior:{arithmetic_conditions:{first_signal:virtual(first),second_constant:constant,operation,output_signal:virtual(output)}}});
const PERIOD=1800,WINDOWS=attempt.windows,WINDOW=PERIOD/WINDOWS;assert(Number.isInteger(WINDOW));let clock;
// The combinators stand in the free tiles of the bottom row; the phase goes onto the ring's red wire.
if(attempt.clock==='modulo'){
 // A constant 1 plus the counter's own output, taken modulo the period: the counter runs 0 to 1799 for
 // ever and never reaches the 32-bit limit. The phase combinator reads the counter alone, on a green wire,
 // and divides by the phase length.
 const one=add('constant-combinator',4,8,{direction:EAST,control_behavior:{sections:{sections:[{index:1,filters:[{index:1,type:'virtual',name:'signal-T',quality:'normal',comparator:'=',count:1}]}]}}});
 const counter=combinator(4,9,'%','signal-T','signal-T',PERIOD),phase=combinator(4,10,'/','signal-T','signal-P',WINDOW);
 circuitWires.push([one.entity_number,1,counter.entity_number,1],[counter.entity_number,3,counter.entity_number,1],[counter.entity_number,4,phase.entity_number,2],[phase.entity_number,3,nearestWired(5,6).entity_number,1]);
 clock={constant:one.entity_number,timer:counter.entity_number,phase:phase.entity_number};
}else{
 // The first version's clock, kept as a screening switch: a free-running counter, divided and taken modulo.
 const timer=combinator(4,8,'+','signal-T','signal-T',1),divide=combinator(4,9,'/','signal-T','signal-U',WINDOW),phase=combinator(4,10,'%','signal-U','signal-P',WINDOWS);
 circuitWires.push([timer.entity_number,3,timer.entity_number,1],[timer.entity_number,3,divide.entity_number,1],[divide.entity_number,3,phase.entity_number,1],[phase.entity_number,3,nearestWired(5,6).entity_number,1]);
 clock={timer:timer.entity_number,divide:divide.entity_number,phase:phase.entity_number};
}

// ---- power -----------------------------------------------------------------------------------------
// Three substations: two cover everything down to ring row 6, the third stands in the bottom row and
// covers it. The first is the electricity port.
const substations=[[0,-2],[18,-2],[7,9]].map(([x,y])=>add('substation',x,y,{position:{x,y}}));
const copperWires=[[substations[0],substations[1]],[substations[0],substations[2]]];
{const p=prototype('substation'),reach=p.supply_area_distance;
 for(const [a,b] of copperWires)assert(Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y)<=p.maximum_wire_distance,'substations too far apart');
 for(const e of entities){if(prototype(e.name).energy_source?.type!=='electric')continue;const box=tileBox(e);
  assert(substations.some(s=>box.left<s.position.x+reach-.2&&box.right>s.position.x-reach+.2&&box.top<s.position.y+reach-.2&&box.bottom>s.position.y-reach+.2),`${e.name} at ${e.position.x},${e.position.y} has no power`);}}
ports.push({kind:'power',items:[],entity:substations[0].entity_number,x:substations[0].position.x,y:substations[0].position.y,position:{...substations[0].position}});

// ---- checks on the finished layout -----------------------------------------------------------------
for(const [a,,b] of circuitWires){const p=entities[a-1],q=entities[b-1];assert(Math.hypot(p.position.x-q.position.x,p.position.y-q.position.y)<=9,'red wire too long');}
for(const e of entities.filter(e=>e.name==='fast-underground-belt'&&e.type==='input')){
 const [dx,dy]={[NORTH]:[0,-1],[EAST]:[1,0],[SOUTH]:[0,1],[WEST]:[-1,0]}[e.direction];let partner;
 for(let n=1;n<=prototype(e.name).max_distance&&!partner;n++)partner=entities.find(o=>o.name===e.name&&o.direction===e.direction&&o.position.x===e.position.x+dx*n&&o.position.y===e.position.y+dy*n);
 assert(partner?.type==='output',`underground at ${e.position.x},${e.position.y} has no exit in reach`);
}
const stock=Object.values(limits).reduce((a,b)=>a+b,0),capacity=ring.length*8;
assert(stock<capacity*.85,'ring stock caps need lane headroom');
const boxes=entities.map(tileBox),footprint={left:Math.min(...boxes.map(b=>b.left)),top:Math.min(...boxes.map(b=>b.top)),right:Math.max(...boxes.map(b=>b.right)),bottom:Math.max(...boxes.map(b=>b.bottom))};
footprint.width=footprint.right-footprint.left;footprint.height=footprint.bottom-footprint.top;

// ---- recipe arithmetic for the stated inputs -------------------------------------------------------
function plateDemand(rates){
 const need={};
 const walk=(name,amount)=>{if(feeds.includes(name)){need[name]=(need[name]||0)+amount;return;}const r=raw.recipe[name],made=r.results.find(x=>x.name===name).amount;for(const i of r.ingredients)walk(i.name,amount*i.amount/made);};
 for(const [name,rate] of Object.entries(rates))walk(name,rate);
 return Object.fromEntries(feeds.map(name=>[name,Math.round(need[name]*1e6)/1e6]));
}

// ---- write -----------------------------------------------------------------------------------------
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
const blueprint={item:'blueprint',version:BLUEPRINT_VERSION,label:'On-demand inserter workshop · four arms',
 description:'WEST iron/copper plates and plastic. EAST four capped passive providers. Internal gears, wire, green/red circuits; AM2, red belts, bulk arms at unlock capacity 2. Preserve stock circuits and upgrade reserves.',
 icons:products.map((name,i)=>({index:i+1,signal:{type:'item',name}})),entities,
 wires:[...copperWires.map(([a,b])=>[a.entity_number,5,b.entity_number,5]),...circuitWires]};
const code=encodeBlueprint({blueprint}),blueprintSha256=createHash('sha256').update(code).digest('hex');
const phaseList=gate=>Array.from({length:WINDOWS},(_,p)=>p).filter(p=>!gate||{'<':p<gate[1],'>':p>gate[1],'=':p===gate[1]}[gate[0]]);
const count=names=>names.reduce((counts,name)=>(counts[name]=(counts[name]||0)+1,counts),{});
const inputs=ports.filter(p=>p.kind==='input'),outputs=ports.filter(p=>p.kind==='output');
const size=`${footprint.width}x${footprint.height}`;
const record={id,name:blueprint.label,file:id+'.txt',blueprintSha256,products,
 outputCaps:Object.fromEntries(products.map(n=>[n,50])),
 requiredInputsPerMinute:fullDrainSupplyPerMinute,nominalInputsPerMinute:plateDemand(targets),requestedTargets,requestedInputsPerMinute:plateDemand(requestedTargets),
 inputs,optionalInputs:[],outputs,ports,machines,machineCounts:count(machines.map(m=>m.recipe)),construction:count(entities.map(e=>e.name)),footprint,
 loopControl:[{name:id,reader:reader.entity_number,controlled,
  clock:{...clock,periodTicks:PERIOD,windowTicks:WINDOW,phases:WINDOWS,...Object.fromEntries([['normalPhases','inserter'],['longPhases','long-handed-inserter'],['fastPhases','fast-inserter'],['bulkPhases','bulk-inserter']].map(([key,name])=>[key,phaseList(phases[name])]))},
  loop:ring.map(e=>e.entity_number),capacity,maximumStock:stock,limits}],
 targets,
 notes:[
  `Explicit compact on-demand alternative: bulk 2.5/min, not the requested continuous 5/min. One ${size} ring with 12 assemblers; it replaces the first 26x17 version with 13.`,
  'Supply: with all four chests emptied at once the workshop makes more than its targets and draws about 630 iron plates, 275 copper plates and 7 plastic a minute; give it that. At exactly the recipe figures for the targets (422.5, 192.5 and 5) the normal and fast tiers stay above target and the long-handed and bulk tiers fall below.',
  'Direct cable into both green assemblers, rear cable across the ring into the second green assembler, and a long-arm cable feed into red circuits. A buried branch of the iron entrance feeds both gear assemblers directly and rises inside the ring, where one arm lays iron on the ring\'s outer lane.',
  'Independent one-stack provider caps: 50 each; normal reserve 2 and fast reserve 2 on loop before export.',
  'No intermediate injection; baseline bulk hand 2, fast bonus zero.'],
 prototypeSha256:createHash('sha256').update(rawBytes).digest('hex')};
// Qualified only by a committed passing report for exactly this string.
const report=await fs.readFile(root+'/native-report.json','utf8').then(JSON.parse,()=>null);
const proven=report?.passed===true&&report.builds?.some(b=>b.id===id&&b.blueprintSha256===blueprintSha256&&b.passed===true);
record.status=proven?'native-verified-declared-inputs':'native-validation-pending';
if(proven)record.nativeReport='native-report.json';
await fs.mkdir(root,{recursive:true});
await fs.writeFile(root+'/'+id+'.txt',code+'\n');
await fs.writeFile(root+'/manifest.json',JSON.stringify([record],null,2)+'\n');
console.log(JSON.stringify({blueprintSha256,status:record.status,footprint,construction:record.construction,machineCounts:record.machineCounts,ringCapacity:capacity,maximumStock:stock},null,2));
