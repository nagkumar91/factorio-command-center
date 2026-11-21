// Concrete supplier: 45 concrete per minute from stone bricks, iron ore and piped water, on one red belt exit.
// One assembling machine 2 faces west so its water input meets the west entrance pipe directly; stone bricks and
// iron ore arrive on two dead-end entrance stubs beside it, one fast arm each. Two fast arms take concrete out,
// one per lane of the exit belt, so the exit tile (fed from behind) holds exactly 8 when blocked:
//  - one arm drops onto an east-running belt of the exit row (from the north, or straight away from it), which the
//    game fills on its right (south) lane;
//  - the other drops onto a short stub that ends running south and side-loads the exit row: the north lane.
// Published variant: seven-by-five (7 x 5 = 35). The earlier four-row (9 x 4) and five-row (8 x 5) are in history/.
// (Lane rules measured natively: scripts/concrete-supplier/probes/lanes.lua, results/lanes.json.)
//
// Pure Node and reproducible: the same variant, supply figures and raw dump give the same blueprint string.
// Usage: node scripts/concrete-supplier/generate.mjs [--variant seven-by-five|four-row|five-row] [--out dir]
//        [--supply nominal|margin] (entrance figures; the published set is in SUPPLY below)
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerWithinLayout} from './power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const id='concrete-supplier';
const variantName=flag('variant',process.env.CONCRETE_VARIANT||'seven-by-five');
const supplyName=flag('supply',process.env.CONCRETE_SUPPLY||'nominal');
const out=flag('out',process.env.CONCRETE_OUT||'blueprint-sources/'+id);
await fs.mkdir('.cache/'+id,{recursive:true});
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');

const product='concrete',target=45,exitCap=8;
const targets={[product]:target},products=[product];
const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10};
const inputsOrder=['stone-brick','water','iron-ore'];
const fluidInputs=new Set(['water']);
// Entrance supply figures (contract section 5 rule 3). "margin" is the contract's starting point
// (nominal x 1.05, rounded up); "nominal" is the recipe demand itself. The published set is the lowest
// that passed the full protocol (see README).
const SUPPLY={margin:{'stone-brick':24,'iron-ore':4.8,water:473},nominal:{'stone-brick':22.5,'iron-ore':4.5,water:450}};
const supply=SUPPLY[supplyName];assert(supply,'unknown supply set '+supplyName);

// ---------- recipe audit from the raw dump ----------
const am2=raw['assembling-machine']['assembling-machine-2'];
assert.equal(am2.crafting_speed,0.75);
const recipe=raw.recipe[product];
assert.deepEqual(recipe.categories,['crafting-with-fluid']);
const energy=recipe.energy_required??0.5,made=recipe.results.find(r=>r.name===product).amount;
const craftsPerMinute={[product]:target/made};
const externalPerMinute=Object.fromEntries(recipe.ingredients.map(i=>[i.name,i.amount*craftsPerMinute[product]]));
assert.deepEqual(Object.keys(externalPerMinute).sort(),[...inputsOrder].sort());
const machinesExact={[product]:craftsPerMinute[product]/(60*am2.crafting_speed/energy)};
const machineCounts={[product]:Math.ceil(machinesExact[product]-1e-9)};
assert.equal(machineCounts[product],1);
for(const item of inputsOrder)assert(supply[item]>=externalPerMinute[item]-1e-9,'supply below nominal '+item);

// ---------- placement with collision checks ----------
let next=1;const entities=[],wires=[],ports=[],occupied=new Map();
const key=(x,y)=>`${x},${y}`;
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function place(e){const p=protoOf(e.name);assert(p,e.name);let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}entities.push(e);return e;}
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra});
const at=(x,y)=>occupied.get(key(x,y));
const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
const fast=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const belt=(x,y,d,extra={})=>add('fast-transport-belt',x,y,{direction:d,...extra});
const pipe=(x,y)=>add('pipe',x,y);
const entrance={},armRoles={input:[],output:[]};let machine,exitBelt,labelSpots;

const VARIANTS={
 // 9 x 4: machine on rows 1..3 facing west; row 0 holds the three panels and the substation.
 'four-row':()=>{
  machine=add('assembling-machine-2',2,1,{position:{x:3.5,y:2.5},direction:12,recipe:product});
  entrance['stone-brick']=belt(0,1,4);armRoles.input.push(fast(1,1,12,filter('stone-brick')));
  entrance.water=pipe(0,2);pipe(1,2);
  entrance['iron-ore']=belt(0,3,4);armRoles.input.push(fast(1,3,12,filter('iron-ore')));
  // South lane: the lower arm drops onto (6,3), a belt running straight away from it.
  armRoles.output.push(fast(5,3,12));belt(6,3,4);
  // North lane: the upper arm drops onto (6,2), which turns south at (7,2) and side-loads (7,3).
  armRoles.output.push(fast(5,2,12));belt(6,2,4);belt(7,2,8);
  belt(7,3,4);exitBelt=belt(8,3,4);
  labelSpots={'stone-brick':[0,0],water:[1,0],'iron-ore':[2,0]};
 },
 // 8 x 5: machine on rows 0..2 facing west; the exit row runs under an arm row, the lower lane from an arm
 // north of it, the upper lane from a stub that side-loads it.
 'five-row':()=>{
  machine=add('assembling-machine-2',2,0,{position:{x:3.5,y:1.5},direction:12,recipe:product});
  entrance['stone-brick']=belt(0,0,4);armRoles.input.push(fast(1,0,12,filter('stone-brick')));
  entrance.water=pipe(0,1);pipe(1,1);
  entrance['iron-ore']=belt(0,2,4);armRoles.input.push(fast(1,2,12,filter('iron-ore')));
  armRoles.output.push(fast(4,3,0));belt(4,4,4);belt(5,4,4);
  armRoles.output.push(fast(5,2,12));belt(6,2,8);belt(6,3,8);
  belt(6,4,4);exitBelt=belt(7,4,4);
  labelSpots={'stone-brick':[0,3],water:[1,3],'iron-ore':[0,4]};
 },
 // 7 x 5 (published; from the review of 926ac81b7): five-row with the upper arm's stub folded back west, so the
 // exit sits one column closer. The lower arm (4,3) drops from the north onto (4,4), which runs east: south lane.
 // The upper arm (5,2) drops onto (6,2) south, (6,3) west, (5,3) south, which side-loads (5,4) from the north:
 // north lane. (5,4) feeds the exit (6,4) from behind. Substation in the 2 x 2 hole at x 2..3, y 3..4.
 'seven-by-five':()=>{
  machine=add('assembling-machine-2',2,0,{position:{x:3.5,y:1.5},direction:12,recipe:product});
  entrance['stone-brick']=belt(0,0,4);armRoles.input.push(fast(1,0,12,filter('stone-brick')));
  entrance.water=pipe(0,1);pipe(1,1);
  entrance['iron-ore']=belt(0,2,4);armRoles.input.push(fast(1,2,12,filter('iron-ore')));
  armRoles.output.push(fast(4,3,0));belt(4,4,4);
  armRoles.output.push(fast(5,2,12));belt(6,2,8);belt(6,3,12);belt(5,3,8);
  belt(5,4,4);exitBelt=belt(6,4,4);
  labelSpots={'stone-brick':[0,3],water:[1,3],'iron-ore':[0,4]};
 },
};
assert(VARIANTS[variantName],'unknown variant '+variantName);VARIANTS[variantName]();
machineCounts[product]=entities.filter(e=>e.recipe===product).length;assert.equal(machineCounts[product],1);
// The exit is fed straight from behind and nothing side-loads it.
{const [ex,ey]=[Math.floor(exitBelt.position.x),Math.floor(exitBelt.position.y)];const behind=at(ex-1,ey);
 assert(behind?.name==='fast-transport-belt'&&behind.direction===4,'exit fed from behind');
 assert(!(at(ex,ey-1)?.name==='fast-transport-belt'&&at(ex,ey-1).direction===8),'nothing side-loads the exit');}

// ---------- ports and labels ----------
const fmt=n=>String(Math.round(n*10)/10);
const port=(kind,item,e,extra)=>{const p={kind,label:item,items:[item],item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},...extra};ports.push(p);return p;};
const inputPorts=inputsOrder.map(item=>port(fluidInputs.has(item)?'fluid':'input',item,entrance[item],{externalSide:'west',...(fluidInputs.has(item)?{}:{direction:4}),nominalPerMinute:externalPerMinute[item],perMinute:supply[item]}));
const outputPort=port('output',product,exitBelt,{externalSide:'east',direction:4,transport:'belt',cap:exitCap});
for(const p of inputPorts){const [x,y]=labelSpots[p.item];const e=add('display-panel',x,y,{icon:{type:fluidInputs.has(p.item)?'fluid':'item',name:p.item},text:`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min`,always_show:true});p.displayEntity=e.entity_number;}
ports.push({kind:'power',label:'External electricity',items:[]});

// ---------- power: one substation inside the production rectangle ----------
const rawBounds={...raw,container:{...raw.container,...raw['logistic-container']}};
const before=starterBounds(entities,rawBounds);
const power=powerWithinLayout({entities,wires,next,place:e=>place(e)},ports,raw,{within:before});
next=Math.max(...entities.map(e=>e.entity_number))+1;
const footprint=starterBounds(entities,rawBounds);
assert.deepEqual(footprint,before,'power must not grow the rectangle');
assert.equal(power.substations,1);assert.equal(power.mediumPoles,0);
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
// Contract section 13: the exit is on the bottom row at the east edge.
assert.equal(exitBelt.position.y+.5,footprint.bottom,'exit on the bottom row');
assert.equal(exitBelt.position.x+.5,footprint.right,'exit on the east edge');

// ---------- blueprint ----------
const description=`Official 2.1.24 Space Age; one assembling machine 2 making concrete, no modules, red belts, fast inserters, one substation. WEST: stone bricks ${fmt(supply['stone-brick'])}/min (top belt), water ${fmt(supply.water)}/min (pipe), iron ore ${fmt(supply['iron-ore'])}/min (bottom belt); each belt may carry its item on either lane. EAST: one red belt exit on the bottom row, ${target} concrete/min, on both lanes; it holds 8 when the consumer stops taking concrete, and the machine then stops by itself. Keep the two output arms where they are: one fills each lane of the exit. Supply electricity at the substation.`;
const bp={item:'blueprint',version:562954249961473,label:'Concrete supplier · 45/min',description,entities,wires,icons:[{index:1,signal:{type:'item',name:product}}]};
const code=encodeBlueprint({blueprint:bp});
// Status comes only from a full-protocol report for this exact string in the output folder.
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
 recipeAudit:{externalPerMinute,craftsPerMinute,machinesExact,recipeIngredients:{[product]:recipe.ingredients}},
 inputs:ports.filter(p=>p.kind==='input'),fluids:ports.filter(p=>p.kind==='fluid'),outputs:ports.filter(p=>p.kind==='output'),ports,
 machineCounts,footprint,areaGoal:{goalTiles:40,stretchTiles:36,fallbackTiles:60,achievedTiles:footprint.width*footprint.height},
 loopControl:[],stockControl:{mode:'belt-exit',exit:exitBelt.entity_number,cap:exitCap,lanes:'one output arm per lane; the exit tile is fed from behind and holds 4 per lane',gate:'none: once the exit belt is full the machine stops by itself on a full output (status full_output, measured in the blocked phase)'},
 armRoles:{input:armRoles.input.map(e=>e.entity_number),output:armRoles.output.map(e=>e.entity_number)},
 protocol,construction,
 billOfMaterials:{items:billItems},
 supplierLinks:[{consumer:'launch-kit',item:product,exitRowFromTop,perMinute:target}],
 setupNotes:[description,`Place this supplier west of the launch kit with its exit row (row ${exitRowFromTop} from its top) on the kit's concrete entrance row and join them with a straight red belt. One copy covers the kit (the kit's concrete panel is 23 a minute).`,'Feed stone bricks, iron ore and water at or above the panel figures; extra simply backs up on the entrance belts and in the pipe.'],
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/'+id+'.txt',code+'\n');
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,variant:variantName,supply:supplyName,out,footprint,area:footprint.width*footprint.height,machineCounts,externalPerMinute,construction,status,blueprintSha256:manifest.blueprintSha256}));
