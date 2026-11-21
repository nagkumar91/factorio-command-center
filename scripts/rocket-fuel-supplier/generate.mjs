// Rocket-fuel supplier: 6 rocket fuel per minute from piped light oil only, on one red belt exit.
// One chemical plant makes solid fuel from light oil and hands it machine to machine (one fast arm each) to two
// assembling machine 2 making rocket fuel. One light-oil entrance pipe feeds all three machines.
// Published variant "ell" (7 x 8): the chemical plant hands solid fuel east to the north rocket-fuel machine and
// south to the south one (which faces east and takes light oil from a pipe-to-ground pair under the hand-off arm).
// The two rocket-fuel machines fill the two lanes of the exit belt, so the exit tile (fed from behind) holds
// exactly 8 when blocked: the north machine's arm drops onto a south-running column (right lane, which becomes the
// south lane at the corner); the south machine's arm drops onto the corner tile from the west (north lane). Both
// lane rules were measured natively (scripts/concrete-supplier/probes/lanes.lua). Only fast inserters.
// (The rejected "staggered" variant, 11 x 6, used a long-handed arm and a one-tile side-load stub instead.)
// Exit gate: the two solid-fuel arms run only while the exit tile holds fewer than 8 rocket fuel (exit tile read
// in hold mode, red wire). Measured in this layout at 660/min light oil: with the gate the rocket-fuel machines
// stop about 2 minutes after the consumer stops, with nothing left in their output slots; without it they still
// stop by themselves, on a full output holding 4 rocket fuel each, but only after about 5 and 8 minutes (295 s
// and 468 s of a 10-minute blocked phase). The gate is kept for the faster, cleaner stop. (The 20-in-output
// limit from the probe is for a bare machine with no output arm and does not apply here.)
//
// Pure Node and reproducible: the same variant, supply set and raw dump give the same blueprint string.
// Usage: node scripts/rocket-fuel-supplier/generate.mjs [--variant staggered|...] [--supply nominal|margin] [--out dir]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerWithinLayout} from './power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const id='rocket-fuel-supplier';
const variantName=flag('variant',process.env.FUEL_VARIANT||'ell');
const supplyName=flag('supply',process.env.FUEL_SUPPLY||'nominal');
const out=flag('out',process.env.FUEL_OUT||'blueprint-sources/'+id);
await fs.mkdir('.cache/'+id,{recursive:true});
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');

const product='rocket-fuel',target=6,exitCap=8;
const targets={[product]:target},products=[product];
const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:10,settleMinutes:5,recoveryMinutes:10};
const fluid='light-oil';
// Entrance supply (contract section 5 rule 3): "margin" = nominal x 1.05 rounded up; "nominal" = recipe demand.
const SUPPLY={margin:{[fluid]:693},nominal:{[fluid]:660}};
const supply=SUPPLY[supplyName];assert(supply,'unknown supply set '+supplyName);

// ---------- recipe audit from the raw dump ----------
// Only solid-fuel-from-light-oil may make solid fuel here (spec section 4).
const recipeFor={'rocket-fuel':'rocket-fuel','solid-fuel':'solid-fuel-from-light-oil'};
const machineFor={'rocket-fuel':'assembling-machine-2','solid-fuel-from-light-oil':'chemical-plant'};
const speedOf=name=>raw['assembling-machine'][name].crafting_speed;
assert.equal(speedOf('assembling-machine-2'),0.75);assert.equal(speedOf('chemical-plant'),1);
assert(raw['assembling-machine']['chemical-plant'].crafting_categories.includes('chemistry'));
assert.deepEqual(raw.recipe['solid-fuel-from-light-oil'].categories,['chemistry']);
assert(raw.recipe['rocket-fuel'].categories.includes('crafting-with-fluid'));
const external={},crafts={};
function expand(item,n){if(item===fluid){external[item]=(external[item]||0)+n;return;}const name=recipeFor[item];assert(name,item);const r=raw.recipe[name];const made=r.results.find(p=>p.name===item).amount;crafts[name]=(crafts[name]||0)+n/made;for(const i of r.ingredients)expand(i.name,n*i.amount/made);}
expand(product,target);
const machinesExact=Object.fromEntries(Object.entries(crafts).map(([n,c])=>[n,c/(60*speedOf(machineFor[n])/(raw.recipe[n].energy_required??.5))]));
assert.equal(external[fluid],660);

// ---------- placement with collision checks ----------
let next=1;const entities=[],wires=[],ports=[],occupied=new Map();
const key=(x,y)=>`${x},${y}`;
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function place(e){const p=protoOf(e.name);assert(p,e.name);let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}entities.push(e);return e;}
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra});
const at=(x,y)=>occupied.get(key(x,y));
const itemSignal=name=>({type:'item',name,quality:'normal'});
const gate={circuit_enabled:true,circuit_condition:{first_signal:itemSignal(product),comparator:'<',constant:exitCap}};
const fast=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const long=(x,y,d,extra={})=>add('long-handed-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const belt=(x,y,d,extra={})=>add('fast-transport-belt',x,y,{direction:d,...extra});
const ug=(x,y,d,type)=>add('fast-underground-belt',x,y,{direction:d,type});
const pipe=(x,y)=>add('pipe',x,y);
const machine=(name,recipe,cx,cy,direction=0)=>add(name,cx,cy,{position:{x:cx+.5,y:cy+.5},direction,recipe});
const roles={handOff:[],output:[]};let entrance,exitBelt,labelSpot,gateReaderTile;

const VARIANTS={
 // 11 x 6. Row 0: the light-oil pipe. West rocket-fuel machine on rows 1..3, chemical plant on rows 1..3,
 // east rocket-fuel machine one row lower (2..4) so a long-handed arm on row 4 can reach it.
 staggered:()=>{
  for(let x=0;x<=9;x++){const p=pipe(x,0);if(x===0)entrance=p;}pipe(9,1);
  machine('assembling-machine-2','rocket-fuel',1,2);
  machine('chemical-plant','solid-fuel-from-light-oil',5,2);
  machine('assembling-machine-2','rocket-fuel',9,3);
  roles.handOff.push(fast(3,2,4,{control_behavior:gate}),fast(7,3,12,{control_behavior:gate}));
  roles.output.push(fast(2,4,0));                  // west machine -> exit row, south lane
  roles.output.push(long(7,4,4));belt(5,4,8);      // east machine -> stub (5,4) -> side-loads (5,5), north lane
  for(let x=2;x<=5;x++)belt(x,5,4);
  ug(6,5,4,'input');ug(9,5,4,'output');
  exitBelt=belt(10,5,4,{control_behavior:{circuit_read_hand_contents:true,circuit_contents_read_mode:1}});
  labelSpot=[3,1];
 },
 // 7 x 8. Row 0: the light-oil pipe; its west end is the entrance and the chemical plant's input. Chemical
 // plant (rows 1..3, west) hands solid fuel east to one rocket-fuel machine (rows 1..3) and south to the other
 // (rows 5..7, facing east so its input meets a pipe fed under the hand-off arm by a pipe-to-ground pair).
 // Lanes: the north machine's arm drops onto a south-running column (right lane, which turns into the south
 // lane at the corner); the south machine's arm drops onto the corner tile itself (north lane).
 ell:()=>{
  for(let x=0;x<=5;x++){const p=pipe(x,0);if(x===0)entrance=p;}
  add('pipe-to-ground',3,1,{direction:0});add('pipe-to-ground',3,5,{direction:8});pipe(3,6);
  machine('chemical-plant','solid-fuel-from-light-oil',1,2);
  machine('assembling-machine-2','rocket-fuel',5,2);
  machine('assembling-machine-2','rocket-fuel',1,6,4);
  roles.handOff.push(fast(3,2,12,{control_behavior:gate}),fast(2,4,0,{control_behavior:gate}));
  roles.output.push(fast(4,4,0));belt(4,5,8);belt(4,6,8);   // north machine -> column, right lane -> south lane
  belt(4,7,4);roles.output.push(fast(3,7,12));              // south machine -> corner tile, north lane
  belt(5,7,4);
  exitBelt=belt(6,7,4,{control_behavior:{circuit_read_hand_contents:true,circuit_contents_read_mode:1}});
  labelSpot=[0,4];
 },
 // 7 x 7 (from the review of 926ac81b7). NOT PUBLISHED: no 2 x 2 hole is left, so it is powered by one medium
 // electric pole and has no substation, which the contract ("substation first") and the user's substation rule do
 // not allow as written. Kept so it can be adopted at once if the user grants that exception (history/seven-square).
 // No pipe row: light oil enters on the arm row, feeds the chemical plant directly, passes under the south
 // hand-off arm by a pipe-to-ground pair and feeds both rocket-fuel machines.
 'seven-square':()=>{
  entrance=pipe(0,3);add('pipe-to-ground',1,3,{direction:12});add('pipe-to-ground',3,3,{direction:4});
  pipe(4,3);pipe(5,3);pipe(4,4);pipe(4,5);pipe(3,5);
  machine('chemical-plant','solid-fuel-from-light-oil',1,1,8);
  machine('assembling-machine-2','rocket-fuel',5,1,8);
  machine('assembling-machine-2','rocket-fuel',1,5,4);
  roles.handOff.push(fast(3,1,12,{control_behavior:gate}),fast(2,3,0,{control_behavior:gate}));
  roles.output.push(fast(6,3,0));belt(6,4,12);belt(5,4,8);belt(5,5,8);
  roles.output.push(fast(3,6,12));belt(4,6,4);belt(5,6,4);
  exitBelt=belt(6,6,4,{control_behavior:{circuit_read_hand_contents:true,circuit_contents_read_mode:1}});
  labelSpot=[3,2];
 },
};
const mediumPoleOnly=variantName==='seven-square';
assert(VARIANTS[variantName],'unknown variant '+variantName);VARIANTS[variantName]();
const machineCounts={};for(const e of entities)if(e.recipe)machineCounts[e.recipe]=(machineCounts[e.recipe]||0)+1;
for(const [n,c] of Object.entries(machinesExact))assert(machineCounts[n]>=c-1e-9,`${n} needs ${c} machines, built ${machineCounts[n]}`);
assert.deepEqual(machineCounts,{'rocket-fuel':2,'solid-fuel-from-light-oil':1});
{const [ex,ey]=[Math.floor(exitBelt.position.x),Math.floor(exitBelt.position.y)];const behind=at(ex-1,ey);
 assert(/belt/.test(behind?.name)&&behind.direction===4&&behind.type!=='input','exit fed from behind');
 assert(!(at(ex,ey-1)?.name==='fast-transport-belt'&&at(ex,ey-1).direction===8),'nothing side-loads the exit');}
// Gate wiring: exit tile -> each solid-fuel hand-off arm on red, chained nearest first (all spans <= 8 tiles).
{const d=e=>Math.hypot(e.position.x-exitBelt.position.x,e.position.y-exitBelt.position.y);let prev=exitBelt;
 for(const a of [...roles.handOff].sort((a,b)=>d(a)-d(b))){assert(Math.hypot(a.position.x-prev.position.x,a.position.y-prev.position.y)<=8,'wire span');wires.push([prev.entity_number,1,a.entity_number,1]);prev=a;}}

// ---------- ports and label ----------
const fmt=n=>String(Math.round(n*10)/10);
const port=(kind,item,e,extra)=>{const p={kind,label:item,items:[item],item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},...extra};ports.push(p);return p;};
const fluidPort=port('fluid',fluid,entrance,{externalSide:'west',nominalPerMinute:external[fluid],perMinute:supply[fluid]});
port('output',product,exitBelt,{externalSide:'east',direction:4,transport:'belt',cap:exitCap});
{const e=add('display-panel',labelSpot[0],labelSpot[1],{icon:{type:'fluid',name:fluid},text:`IN: ${fluid}\nWEST · ${fmt(fluidPort.perMinute)}/min`,always_show:true});fluidPort.displayEntity=e.entity_number;}
ports.push({kind:'power',label:'External electricity',items:[]});

// ---------- power: one substation inside the production rectangle ----------
const rawBounds={...raw,container:{...raw.container,...raw['logistic-container']}};
const before=starterBounds(entities,rawBounds);
let power;
if(mediumPoleOnly){next=Math.max(...entities.map(e=>e.entity_number))+1;const pole=add('medium-electric-pole',3,4,{tags:{five_science_power:true,five_science_power_dock:true}});
 Object.assign(ports.find(p=>p.kind==='power'),{entity:pole.entity_number,x:pole.position.x,y:pole.position.y,position:{...pole.position}});power={substations:0,mediumPoles:1};}
else power=powerWithinLayout({entities,wires,next,place:e=>place(e)},ports,raw,{within:before});
next=Math.max(...entities.map(e=>e.entity_number))+1;
const footprint=starterBounds(entities,rawBounds);
assert.deepEqual(footprint,before,'power must not grow the rectangle');
if(mediumPoleOnly){assert.equal(power.substations,0);assert.equal(power.mediumPoles,1);}else{assert.equal(power.substations,1);assert.equal(power.mediumPoles,0);}
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
assert.equal(exitBelt.position.y+.5,footprint.bottom,'exit on the bottom row');
assert.equal(exitBelt.position.x+.5,footprint.right,'exit on the east edge');

// ---------- blueprint ----------
const armWords=entities.some(e=>e.name==='long-handed-inserter')?'fast and long-handed inserters':'fast inserters';
const description=`Official 2.1.24 Space Age; one chemical plant (solid fuel from light oil) and two assembling machine 2 (rocket fuel), no modules, red belts, ${armWords}, ${mediumPoleOnly?"one medium electric pole (no substation)":"one substation"}. WEST: light oil ${fmt(supply[fluid])}/min into the ${mediumPoleOnly?"west":"top-left"} pipe; it feeds all three machines. EAST: one red belt exit on the bottom row, ${target} rocket fuel/min, one machine per lane. Solid fuel is handed machine to machine. The two solid-fuel arms are wired to the exit belt tile and run only while it holds fewer than ${exitCap} rocket fuel, so the machines stop soon after the consumer stops taking fuel and restart by themselves; keep that red wire and condition. Supply electricity at the ${mediumPoleOnly?"medium pole":"substation"}.`;
const bp={item:'blueprint',version:562954249961473,label:'Rocket-fuel supplier · 6/min',description,entities,wires,icons:[{index:1,signal:{type:'item',name:product}}]};
const code=encodeBlueprint({blueprint:bp});
let status='native-validation-pending',measured;
try{const report=JSON.parse(await fs.readFile(out+'/native-report.json','utf8'));const r=report.builds?.find(b=>b.blueprintSha256===sha(code));
 if(r&&!report.short&&r.passed&&report.passed){status='qualified';measured={steadyPerMinute:r.outputsPerMinute[product],recoveryPerMinute:r.recovery?.outputsPerMinute?.[product],blockedExitStock:r.blocked?.collectionPauseStock?.[0]?.count,entrancesPerMinute:Object.fromEntries([...r.inputs,...r.fluids].map(p=>[p.item,p.acceptedPerMinute])),machineCrafts:Object.fromEntries(r.machines.map(m=>[m.recipe+'@'+m.x+','+m.y,m.measuredCrafts])),reportCreatedAt:report.createdAt};}}catch{}
const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length]));
const itemFor=name=>{const it=Object.values(raw.item).find(i=>i.place_result===name);assert(it,'no item places '+name);return it.name;};
const billItems={};for(const e of entities){const n=itemFor(e.name);billItems[n]=(billItems[n]||0)+1;}
const exitRowFromTop=Math.floor(exitBelt.position.y)-footprint.top;
const manifest={
 id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'rate',status,...(measured?{measured}:{}),
 variant:variantName,supply:supplyName,
 products,targets,outputCaps:{[product]:exitCap},
 recipeAudit:{externalPerMinute:external,craftsPerMinute:crafts,machinesExact,recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,raw.recipe[n].ingredients])),internal:{'solid-fuel':'made by solid-fuel-from-light-oil in the chemical plant and handed directly to the rocket-fuel machines; not a product, no exit'}},
 inputs:ports.filter(p=>p.kind==='input'),fluids:ports.filter(p=>p.kind==='fluid'),outputs:ports.filter(p=>p.kind==='output'),ports,
 machineCounts,footprint,areaGoal:{goalTiles:78,stretchTiles:66,fallbackTiles:110,achievedTiles:footprint.width*footprint.height},
 loopControl:[],
 stockControl:{mode:'belt-exit',exit:exitBelt.entity_number,cap:exitCap,lanes:'one rocket-fuel machine per lane; the exit tile is fed from behind and holds 4 per lane',gate:{reader:exitBelt.entity_number,readerMode:'per-tile-hold',wire:'red',arms:roles.handOff.map(e=>e.entity_number),condition:`${product} < ${exitCap}`,why:variantName==='ell'?'faster, cleaner stop (measured in this layout at 660/min light oil): with the gate the rocket-fuel machines stop about 2 minutes after the consumer stops, with nothing left in their output slots; without it they still stop by themselves on a full output holding 4 rocket fuel each, but only after about 5 and 8 minutes (295 s and 468 s), 72 s before the last minute of a 10-minute blocked phase':'stops the rocket-fuel machines soon after the exit fills (not measured without the gate for this variant)'}},
 armRoles:{handOff:roles.handOff.map(e=>e.entity_number),output:roles.output.map(e=>e.entity_number)},
 protocol,construction,
 billOfMaterials:{items:billItems},
 supplierLinks:[{consumer:'rocket-supplies',item:product,exitRowFromTop,perMinute:target}],
 setupNotes:[description,`Place this supplier west of rocket supplies with its exit row (row ${exitRowFromTop} from its top) on the rocket-fuel entrance row and join them with a straight red belt. One copy covers rocket supplies (it takes about 5 rocket fuel a minute).`,'Feed light oil at or above the panel figure; extra simply stays in the pipe.'],
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/'+id+'.txt',code+'\n');
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,variant:variantName,supply:supplyName,out,footprint,area:footprint.width*footprint.height,machineCounts,external,crafts,machinesExact,construction,status,blueprintSha256:manifest.blueprintSha256}));
