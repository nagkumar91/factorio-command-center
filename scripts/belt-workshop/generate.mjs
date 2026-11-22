// On-demand belt workshop: one stock-controlled belt ring, the inserter workshop's design for belts.
//
//   node scripts/belt-workshop/generate.mjs
//
// Writes blueprint-sources/belt-workshop/{belt-workshop.txt,manifest.json}. A re-run leaves both
// byte-identical: the manifest says "native-verified-declared-inputs" only when the committed
// native-report.json passed for the exact SHA-256 this run produced, otherwise "native-validation-pending".
// When the committed string decodes to exactly this blueprint it is kept, so another zlib build (the public
// Linux runner's) cannot change the published string.
//
// For screening ideas: BELT_WORKSHOP_OUT writes a trial copy to another folder, and BELT_WORKSHOP_TRY is a
// JSON object of layout switches (phases, limits, reserves, longArm, ringGearArms). The published design is
// the one with no switches set.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';

const DEFAULT_RAW='/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const rawBytes=await fs.readFile(process.env.FACTORIO_RAW||DEFAULT_RAW),raw=JSON.parse(rawBytes);
const root=process.env.BELT_WORKSHOP_OUT||'blueprint-sources/belt-workshop',id='belt-workshop';
const attempt={longArm:true,riser:true,ringGearArms:{west:false,middle:false},...JSON.parse(process.env.BELT_WORKSHOP_TRY||'{}')};
// Blueprint format version of Factorio 2.1.24, the same number every other 2.1 design here carries.
const BLUEPRINT_VERSION=562954249961472;

// Chests down the east edge, red tier first.
const products=['fast-transport-belt','fast-underground-belt','fast-splitter','transport-belt','underground-belt','splitter'];
const caps=Object.fromEntries(products.map(name=>[name,raw.item[name].stack_size]));
const feeds=['iron-plate','copper-plate'];
// Ring stock caps: an arm that adds an item to the ring works only while the ring holds fewer than this.
const limits={'iron-plate':40,'copper-plate':16,'iron-gear-wheel':32,'electronic-circuit':16,'transport-belt':16,'underground-belt':8,splitter:4,'fast-transport-belt':8,'fast-underground-belt':4,'fast-splitter':4,...attempt.limits};
// Optional export reserves (screening only): an export arm that leaves this many on the ring.
const reserves={...attempt.reserves};
const targets={'fast-transport-belt':30,'fast-underground-belt':3.5,'fast-splitter':4,'transport-belt':10,'underground-belt':6,splitter:2,...attempt.targets};
// The supply to give each entrance: the measured full-drain draw rounded up. The stated-supply probe feeds
// exactly these figures and must pass the same checks as the full-belt protocol.
const fullDrainSupplyPerMinute={'iron-plate':960,'copper-plate':130,...attempt.supply};
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
// Clockwise: east along row 0, south down column 17, west along row 6, north up column 1. One tile of row 0
// is bridged by an underground pair so a long-handed arm can pass gears across the ring.
const RING={left:1,right:17,top:0,bottom:6},TOP_BRIDGE=attempt.longArm?15:null;
const ring=[],ringAt=new Map();
function ringTile(x,y,direction){
 const bridge=TOP_BRIDGE&&y===RING.top&&Math.abs(x-TOP_BRIDGE)===1?(x<TOP_BRIDGE?'input':'output'):null;
 if(TOP_BRIDGE&&y===RING.top&&x===TOP_BRIDGE)return;
 const e=bridge?underground(x,y,direction,bridge):belt(x,y,direction);ring.push(e);ringAt.set(x+','+y,e);
}
for(let x=RING.left;x<=RING.right;x++)ringTile(x,RING.top,x===RING.right?SOUTH:EAST);
for(let y=RING.top+1;y<=RING.bottom;y++)ringTile(RING.right,y,y===RING.bottom?WEST:SOUTH);
for(let x=RING.right-1;x>=RING.left;x--)ringTile(x,RING.bottom,x===RING.left?NORTH:WEST);
for(let y=RING.bottom-1;y>RING.top;y--)ringTile(RING.left,y,NORTH);
const at=(x,y)=>{const e=ringAt.get(x+','+y);assert(e,`no ring tile at ${x},${y}`);return e;};
// One whole-belt hold reader publishes the ring's stock on a red wire that follows the ring. Underground
// pieces carry no wire: the wire steps over the bridge from belt to belt.
const wired=ring.filter(e=>e.name==='fast-transport-belt'),reader=wired[0];
reader.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
for(let i=0;i<wired.length;i++)redWire(wired[i],wired[(i+1)%wired.length]);
const nearestWired=(x,y)=>wired.slice().sort((a,b)=>Math.hypot(a.position.x-x-.5,a.position.y-y-.5)-Math.hypot(b.position.x-x-.5,b.position.y-y-.5))[0];
const controlled=[];
const onRingWire=(e,x,y)=>{redWire(e,nearestWired(x,y));controlled.push(e.entity_number);return e;};

// ---- machines --------------------------------------------------------------------------------------
const machines=[];
const machine=(recipe,cx,cy)=>{const m=add('assembling-machine-2',cx,cy,{recipe});machines.push({recipe,entity:m.entity_number});return m;};
// The clock shares the ring's gears, yellow belts and circuits between the yellow makers. A 30 second
// cycle has twelve phases of 2.5 seconds; each yellow maker's ingredient arms work only in its phases. The
// red makers' arms always work.
const PHASE={type:'virtual',name:'signal-P'};
const phases={'underground-belt':['>',7],splitter:['<',6],...attempt.phases};
// The yellow belt chest is last in line for yellow belts; its export arm works only in its phases, so the
// yellow makers upstream keep a share of the belts when every chest is emptied at once.
const exportPhases={'transport-belt':['<',8],...attempt.exportPhases};
const phaseGate=Object.fromEntries(Object.entries(phases).filter(([,gate])=>gate).map(([name,[comparator,constant]])=>[name,enabledWhile(PHASE,comparator,constant)]));

// Top row, above ring row 0, in ring order: each maker is downstream of the makers of its ingredients.
// Arms at cx-1 and cx take ingredients from the ring; the arm at cx+1 puts the product on the ring.
const topLoads={
 'iron-gear-wheel':[['iron-plate'],['iron-plate']],
 'underground-belt':[['iron-plate','transport-belt'],['iron-plate','transport-belt']],
 splitter:[['electronic-circuit','iron-plate','transport-belt'],['electronic-circuit','iron-plate','transport-belt']],
 'fast-splitter':[['splitter','iron-gear-wheel','electronic-circuit'],['splitter','iron-gear-wheel','electronic-circuit']],
 // The bridge tile sits below this maker's middle: one ingredient arm, and gears also come by the long arm.
 'fast-underground-belt':attempt.longArm?[['underground-belt','iron-gear-wheel']]:[['underground-belt','iron-gear-wheel'],['underground-belt','iron-gear-wheel']],
};
function topStation(recipe,cx){
 machine(recipe,cx,-3);
 topLoads[recipe].forEach((items,i)=>{const gate=phaseGate[recipe];const e=arm(cx-1+i,-1,SOUTH,items,gate);if(gate)onRingWire(e,cx-1+i,0);});
 onRingWire(arm(cx+1,-1,NORTH,[recipe],belowCap(recipe)),cx+1,0);
}
['iron-gear-wheel','underground-belt','splitter','fast-splitter','fast-underground-belt'].forEach((recipe,i)=>topStation(recipe,3+3*i));

// Inside row: cable, green, cable, gear. Both cable assemblers hand wire straight to the green assembler
// between them; wire never goes on the ring. The gear assembler inside the ring lays its gears on the
// outer lane of ring row 6 and hands gears across ring row 0 to the red underground maker by a long arm.
machine('copper-cable',3,3);arm(2,1,NORTH,['copper-plate']);arm(3,1,NORTH,['copper-plate']);arm(5,3,WEST,['copper-cable']);
machine('electronic-circuit',7,3);arm(7,1,NORTH,['iron-plate']);onRingWire(arm(8,5,NORTH,['electronic-circuit'],belowCap('electronic-circuit')),8,6);
machine('copper-cable',11,3);arm(10,1,NORTH,['copper-plate']);arm(11,1,NORTH,['copper-plate']);arm(9,3,EAST,['copper-cable']);
machine('iron-gear-wheel',15,3);arm(14,1,NORTH,['iron-plate']);arm(16,1,NORTH,['iron-plate']);onRingWire(arm(16,5,NORTH,['iron-gear-wheel'],belowCap('iron-gear-wheel')),16,6);
if(attempt.longArm)longArm(TOP_BRIDGE,RING.top,SOUTH,['iron-gear-wheel']);

// Bottom row: three gear assemblers fed iron straight from the buried iron branch, and the red belt maker
// between the west and middle ones, which hand it gears directly. Its yellow belts come off ring row 6.
machine('iron-gear-wheel',2,9);arm(0,9,WEST,['iron-plate']);arm(0,10,WEST,['iron-plate']);
if(attempt.ringGearArms.west)onRingWire(arm(2,7,SOUTH,['iron-gear-wheel'],belowCap('iron-gear-wheel')),2,6);
machine('fast-transport-belt',6,9);arm(4,9,WEST,['iron-gear-wheel']);arm(8,9,EAST,['iron-gear-wheel']);
arm(5,7,NORTH,['transport-belt']);arm(6,7,NORTH,['transport-belt']);onRingWire(arm(7,7,SOUTH,['fast-transport-belt'],belowCap('fast-transport-belt')),7,6);
machine('iron-gear-wheel',10,9);arm(12,9,EAST,['iron-plate']);arm(12,10,EAST,['iron-plate']);
if(attempt.ringGearArms.middle)onRingWire(arm(10,7,SOUTH,['iron-gear-wheel'],belowCap('iron-gear-wheel')),10,6);
// The yellow belt maker takes iron from the same branch and gears off ring row 6, and lays its belts on row 6
// upstream of the red belt maker: red belts get yellow belts first, the yellow belt chest gets what is left.
machine('transport-belt',16,9);arm(14,9,WEST,['iron-plate']);arm(14,10,WEST,['iron-plate']);
arm(15,7,NORTH,['iron-gear-wheel']);arm(17,7,NORTH,['iron-gear-wheel']);onRingWire(arm(16,7,SOUTH,['transport-belt'],belowCap('transport-belt')),16,6);

// ---- west entrances --------------------------------------------------------------------------------
// Each material enters once on its own row. Arms in column 0 lift it onto the ring's west column while the
// ring holds less than its cap. The iron belt then dives under the copper row, feeds the west gear
// assembler, runs east along the bottom edge and turns north between the middle and east gear assemblers.
const ports=[];
function entrance(itemName,e){ports.push({kind:'input',item:itemName,items:[itemName],entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position,direction:EAST,externalSide:'west'});}
const feedArm=(itemName,row)=>onRingWire(arm(0,row,WEST,[itemName],belowCap(itemName)),1,row);
const panel=(index,itemName,row,x,y,note='')=>add('display-panel',x,y,{icon:{type:'item',name:itemName},text:`IN ${index}: ${itemName}\nWEST entrance, row ${row}.${note}`,always_show:true});
entrance('iron-plate',belt(-2,1,EAST));belt(-1,1,SOUTH);underground(-1,2,SOUTH,'input');feedArm('iron-plate',1);feedArm('iron-plate',2);
panel(1,'iron-plate',1,-2,2,' The ring arms and all four gear assemblers share this one entrance.');
underground(-1,9,SOUTH,'output');belt(-1,10,SOUTH);belt(-1,11,EAST);
for(let x=0;x<=12;x++)belt(x,11,EAST);
for(let y=11;y>=8;y--)belt(13,y,NORTH);
// The riser: the branch passes under ring row 6 into the ring, and one arm standing inside lays iron on the
// outer lane of ring row 0, just upstream of the inside gear assembler's arms. Arms outside the ring can only
// reach the inner lane, which carries every product.
if(attempt.riser){underground(13,7,NORTH,'input');underground(13,5,NORTH,'output');for(let y=4;y>=2;y--)belt(13,y,NORTH);onRingWire(arm(13,1,SOUTH,['iron-plate'],belowCap('iron-plate')),13,0);}
entrance('copper-plate',belt(-2,3,EAST));belt(-1,3,SOUTH);belt(-1,4,EAST);feedArm('copper-plate',3);feedArm('copper-plate',4);
panel(2,'copper-plate',3,-2,4,' Copper only makes wire for the circuits.');

// ---- east exits ------------------------------------------------------------------------------------
// One passive provider chest per product, limited to one stack.
for(const [i,name] of products.entries()){
 const y=i+1,reserve=reserves[name]||0;
 const gate=exportPhases[name]?enabledWhile(PHASE,...exportPhases[name]):reserve?enabledWhile(item(name),'>',reserve):{};
 const e=arm(RING.right+1,y,WEST,[name],gate);
 if(gate.control_behavior)redWire(e,at(RING.right,y));
 const chest=add('passive-provider-chest',RING.right+2,y,{bar:1});
 ports.push({kind:'output',item:name,items:[name],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:chest.position,externalSide:'east',cap:caps[name],reserve});
}

// ---- clock -----------------------------------------------------------------------------------------
// A constant 1 plus the counter's own output, taken modulo the period: the counter runs 0 to 1799 for ever
// and never reaches the 32-bit limit. The phase combinator reads the counter alone, on a green wire, and
// divides by the phase length. They stand in the free tiles of the inside row; the phase goes onto the ring.
const virtual=name=>({type:'virtual',name});
const combinator=(x,y,operation,first,output,constant)=>add('arithmetic-combinator',x,y,{position:{x:x+1,y:y+.5},direction:EAST,control_behavior:{arithmetic_conditions:{first_signal:virtual(first),second_constant:constant,operation,output_signal:virtual(output)}}});
const PERIOD=1800,WINDOWS=12,WINDOW=PERIOD/WINDOWS;
const one=add('constant-combinator',4,5,{direction:EAST,control_behavior:{sections:{sections:[{index:1,filters:[{index:1,type:'virtual',name:'signal-T',quality:'normal',comparator:'=',count:1}]}]}}});
const counter=combinator(2,5,'%','signal-T','signal-T',PERIOD),phase=combinator(10,5,'/','signal-T','signal-P',WINDOW);
circuitWires.push([one.entity_number,1,counter.entity_number,1],[counter.entity_number,3,counter.entity_number,1],[counter.entity_number,4,phase.entity_number,2],[phase.entity_number,3,nearestWired(11,6).entity_number,1]);
const clock={constant:one.entity_number,timer:counter.entity_number,phase:phase.entity_number};

// ---- power -----------------------------------------------------------------------------------------
// Four substations, one at each corner of the ring; the first is the electricity port.
const substations=[[0,-2],[18,-2],[0,8],[19,8]].map(([x,y])=>add('substation',x,y,{position:{x,y}}));
const copperWires=[[substations[0],substations[1]],[substations[0],substations[2]],[substations[1],substations[3]]];
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

// ---- recipe arithmetic -----------------------------------------------------------------------------
// Plates and gears for a set of product rates, walked down the recipes in the prototype dump.
function demand(rates,stopAt=feeds){
 const need={};
 const walk=(name,amount)=>{if(stopAt.includes(name)){need[name]=(need[name]||0)+amount;return;}const r=raw.recipe[name],made=r.results.find(x=>x.name===name).amount;for(const i of r.ingredients)walk(i.name,amount*i.amount/made);};
 for(const [name,rate] of Object.entries(rates))walk(name,rate);
 return Object.fromEntries(Object.entries(need).sort().map(([name,n])=>[name,Math.round(n*1e6)/1e6]));
}
const plateDemand=rates=>{const need=demand(rates);return Object.fromEntries(feeds.map(name=>[name,need[name]||0]));};

// ---- write -----------------------------------------------------------------------------------------
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
const blueprint={item:'blueprint',version:BLUEPRINT_VERSION,label:'On-demand belt workshop · red and yellow',
 description:'WEST iron and copper plates. EAST six one-stack passive providers: red belts, undergrounds and splitters, then yellow. Internal gears, wire and green circuits; AM2, red belts, bulk arms at unlock capacity 2. Preserve stock circuits, clock and the yellow belt reserve.',
 icons:products.slice(0,3).map((name,i)=>({index:i+1,signal:{type:'item',name}})),entities,
 wires:[...copperWires.map(([a,b])=>[a.entity_number,5,b.entity_number,5]),...circuitWires]};
// Keep the committed string when it decodes to exactly this blueprint.
const committed=await fs.readFile(`${root}/${id}.txt`,'utf8').then(t=>t.trim(),()=>null);
const sameBlueprint=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint});}catch{return false;}};
const code=committed&&sameBlueprint(committed)?committed:encodeBlueprint({blueprint}),blueprintSha256=createHash('sha256').update(code).digest('hex');
const phaseList=gate=>Array.from({length:WINDOWS},(_,p)=>p).filter(p=>!gate||{'<':p<gate[1],'>':p>gate[1],'=':p===gate[1]}[gate[0]]);
const count=names=>names.reduce((counts,name)=>(counts[name]=(counts[name]||0)+1,counts),{});
const inputs=ports.filter(p=>p.kind==='input'),outputs=ports.filter(p=>p.kind==='output');
const record={id,name:blueprint.label,file:id+'.txt',blueprintSha256,products,
 outputCaps:caps,
 requiredInputsPerMinute:fullDrainSupplyPerMinute,nominalInputsPerMinute:plateDemand(targets),
 gearsPerMinuteAtTargets:demand(targets,[...feeds,'iron-gear-wheel'])['iron-gear-wheel'],
 circuitsPerMinuteAtTargets:demand(targets,[...feeds,'electronic-circuit'])['electronic-circuit'],
 inputs,optionalInputs:[],outputs,ports,machines,machineCounts:count(machines.map(m=>m.recipe)),construction:count(entities.map(e=>e.name)),footprint,
 loopControl:[{name:id,reader:reader.entity_number,controlled,
  clock:{...clock,periodTicks:PERIOD,windowTicks:WINDOW,phases:WINDOWS,phasesByMaker:Object.fromEntries(['underground-belt','splitter'].map(name=>[name,phaseList(phases[name])]))},
  loop:ring.map(e=>e.entity_number),capacity,maximumStock:stock,limits}],
 targets,
 notes:[
  `One ${footprint.width}x${footprint.height} ring with ${machines.length} assemblers, the inserter workshop's design for belts: red belt, red underground and red splitter chests, then the three yellow ones.`,
  'Supply: with all six chests emptied at once the workshop draws about 960 iron and 130 copper plates a minute; give it that. At exactly the recipe figures for the targets the red tier holds and the yellow belt and yellow splitter chests fall below target.',
  'Gears are the scarce ingredient: four gear assemblers make 360 a minute. Two of them hand all their gears straight to the red belt maker; the other two put theirs on the ring for the yellow belt maker and the red splitter and red underground makers, and the inside one also hands gears across the ring to the red underground maker by a long arm.',
  'The yellow belt maker lays its belts upstream of the red belt maker, the yellow underground and splitter makers work only in their clock phases, and the yellow belt chest is last in line and fills only in its phases.',
  'Independent one-stack provider caps: 100 belts, 50 undergrounds, 50 splitters. No intermediate injection; baseline bulk hand 2, fast bonus zero.'],
 prototypeSha256:createHash('sha256').update(rawBytes).digest('hex')};
// Qualified only by a committed passing report for exactly this string.
const report=await fs.readFile(root+'/native-report.json','utf8').then(JSON.parse,()=>null);
const proven=report?.passed===true&&report.builds?.some(b=>b.id===id&&b.blueprintSha256===blueprintSha256&&b.passed===true);
record.status=proven?'native-verified-declared-inputs':'native-validation-pending';
if(proven)record.nativeReport='native-report.json';
await fs.mkdir(root,{recursive:true});
await fs.writeFile(root+'/'+id+'.txt',code+'\n');
await fs.writeFile(root+'/manifest.json',JSON.stringify([record],null,2)+'\n');
console.log(JSON.stringify({blueprintSha256,status:record.status,footprint,construction:record.construction,machineCounts:record.machineCounts,ringCapacity:capacity,maximumStock:stock,nominal:record.nominalInputsPerMinute,gears:record.gearsPerMinuteAtTargets,circuits:record.circuitsPerMinuteAtTargets},null,2));
