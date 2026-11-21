// Rocket supplies: processing units and low density structures at 5 per minute each, plus rocket fuel
// passed through from the rocket-fuel supplier, all three in passive provider chests on the east edge
// (400 each, one chest bar each). Spec: .claude/tmp-factorio-space-launch/specs/rocket-supplies.md.
//
// Layout (published variant "two-rows-tight", 14 x 12; see README.md):
//   row 0      rocket fuel: west entrance, buried east, then down the chest column to an arm above its chest
//   row 1      sulfuric acid entrance and header (pipes and pipe-to-ground), one substation over rows 0-1
//   rows 2-4   north row, outside the ring: AC PU PU LDS; the PU machines take acid from the header
//   row 5      their arms (ingredients from the ring, products onto it)
//   row 6      ring top (flows east)                                \  one single-loop ring (30 tiles),
//   row 7      arms of the inner row                                 | per-tile hold readers, every
//   rows 8-10  inner row, inside the ring: cable AC LDS             | tile on one red network
//   row 11     ring bottom (flows west)                             /
//   column 0:  four gated entrance belts (copper, plastic, steel, circuits from the north) side-loading
//              onto ONE lane of the ring's west column; column 13: the three chests, rows 5-7.
// The four entrance limits share that one lane (4 slots per ring tile): they are kept at or below 75%
// of it so copper can still merge when circuits and plastic are in surplus (review of 2026-11-21).
//
//   node scripts/rocket-supplies/generate.mjs                     writes blueprint-sources/rocket-supplies
//   RS_OUT=.cache/rocket-supplies/candidate RS_OPTIONS='{...}' node scripts/rocket-supplies/generate.mjs
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerFiveLayout} from './power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const id='rocket-supplies';
await fs.mkdir('.cache/'+id,{recursive:true});
let bytes;
try{bytes=await fs.readFile(RAW);}catch{throw Error('The Factorio 2.1.24 prototype dump is needed to generate '+id+'; set FACTORIO_RAW (tried '+RAW+')');}
const raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
const OUT=process.env.RS_OUT||'blueprint-sources/'+id;
// The published design. Other variants are history candidates (see README.md "Tried and rejected").
const PUBLISHED_VARIANT='two-rows-tight';
const options={
 variant:PUBLISHED_VARIANT,
 // perMinute: 'nominal' (the recipe demand, the lowest figure the contract allows; the published
 // design passes the full protocol there), 'start' (nominal x 1.05 rounded up), or {item: figure}.
 perMinute:'nominal',
 // Ring limits: an entrance gate or product arm puts its item on the ring only while the ring holds fewer.
 // The four entrance gates side-load onto one lane of the ring: circuits and plastic stay low so that,
 // when they are in surplus, copper still finds room (circuits 40 / plastic 20 starved copper and
 // low density structures fell to 4.1-4.6 per minute with a backed-up circuit belt).
 limits:{'electronic-circuit':24,'copper-plate':40,'plastic-bar':12,'steel-plate':6,'processing-unit':4,'low-density-structure':4},
 ...JSON.parse(process.env.RS_OPTIONS||'{}')};

// ---------------------------------------------------------------- spec values
const PU='processing-unit',LDS='low-density-structure',RF='rocket-fuel',GREEN='electronic-circuit',COPPER='copper-plate',PLASTIC='plastic-bar',STEEL='steel-plate',ACID='sulfuric-acid';
const products=[PU,LDS],passThrough=[RF];
const targets={[RF]:5,[PU]:5,[LDS]:5};
const outputCaps={[RF]:400,[PU]:400,[LDS]:400};
const boundary=[GREEN,COPPER,PLASTIC,STEEL,ACID];
const itemProto=name=>raw.item?.[name]||raw.tool?.[name];
const stack=Object.fromEntries(Object.keys(outputCaps).map(n=>[n,itemProto(n).stack_size]));
for(const[n,cap]of Object.entries(outputCaps))assert(Number.isInteger(cap/stack[n]),'cap of '+n+' must be whole stacks for the chest bar');
const bars=Object.fromEntries(Object.keys(outputCaps).map(n=>[n,outputCaps[n]/stack[n]]));

// ---------------------------------------------------------------- recipe audit (from the dump)
const am2=raw['assembling-machine']['assembling-machine-2'];
const energy=r=>raw.recipe[r].energy_required??0.5;
const required={},crafts={};
function expand(item,n){
 if(boundary.includes(item)){required[item]=(required[item]||0)+n;return;}
 const r=raw.recipe[item];assert(r,'recipe '+item);const made=r.results.find(p=>p.name===item).amount;
 crafts[item]=(crafts[item]||0)+n/made;for(const i of r.ingredients)expand(i.name,n*i.amount/made);
}
for(const p of products)expand(p,targets[p]);
const round3=v=>Math.round(v*1000)/1000;
for(const k of Object.keys(required))required[k]=round3(required[k]);
for(const k of Object.keys(crafts))crafts[k]=round3(crafts[k]);
const perMachine=Object.fromEntries(Object.keys(crafts).map(r=>[r,round3(60*am2.crafting_speed/energy(r))]));
const machinesNeeded=Object.fromEntries(Object.keys(crafts).map(r=>[r,Math.ceil(crafts[r]/perMachine[r]-1e-9)]));
assert.deepEqual(machinesNeeded,{[PU]:2,'advanced-circuit':2,'copper-cable':1,[LDS]:2},'machine counts drifted from the spec');
for(const r of Object.keys(crafts))assert(raw.recipe[r].categories.some(c=>am2.crafting_categories.includes(c)),'assembling machine 2 cannot craft '+r);
// nominalPerMinute: recipe demand at the targets. perMinute: the supply the blueprint is qualified at
// (start nominal x 1.05 rounded up: whole numbers at 10 and above, one decimal below; lowered only with a passing run).
const nominal={[RF]:targets[RF],...required};
const startSupply=v=>{const s=v*1.05;return s>=10?Math.ceil(s-1e-9):Math.ceil(s*10-1e-9)/10;};
const startPerMinute=Object.fromEntries(Object.entries(nominal).map(([k,v])=>[k,startSupply(v)]));
const supply=Object.fromEntries(Object.entries(nominal).map(([k,v])=>[k,options.perMinute==='nominal'?v:options.perMinute==='start'?startPerMinute[k]:options.perMinute[k]??startPerMinute[k]]));
for(const[k,v]of Object.entries(supply))assert(v>=nominal[k],'perMinute below nominal for '+k);
const fmt=v=>String(Math.round(v*10)/10);

// ---------------------------------------------------------------- placement grid
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
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra});
const belt=(x,y,d,extra={})=>add('fast-transport-belt',x,y,{direction:d,...extra});
const sig=name=>({type:raw.fluid?.[name]?'fluid':'item',name,quality:'normal'});
const filters=items=>({use_filters:true,filters:items.map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))});
const arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const cond=(item,comparator,constant)=>({circuit_enabled:true,circuit_condition:{first_signal:sig(item),comparator,constant}});
// direction is the side an arm picks from: 0 picks at y-1 and drops at y+1.
const N=0,E=4,S=8,W=12;

// ---------------------------------------------------------------- geometry
const AC='advanced-circuit',CABLE='copper-cable';
// Variants. Consumers of shared plates sit downstream (east) of the advanced-circuit line on the
// eastbound ring top: cable and advanced circuits take their copper and plastic first, the
// low-density machines take the rest, so no reserve gate is needed.
//  inner-row (30x8): one inner row PU AC C AC PU LDS LDS with direct hand-offs (cable and advanced
//             circuits never touch a belt); each processing-unit machine takes its acid from a pipe
//             in the neighbouring gap, fed by pipe-to-ground under the ring top.
//  ring-ac (28x8): AC C AC with cable hand-offs; advanced circuits ride the ring.
//  ring-all (26x8): no gaps; cable and advanced circuits ride the ring.
//  two-rows (15x12): four machines north of the ring top (outside the ring) and three inside it,
//             all on one ring top; the processing-unit machines sit in the north row and take acid
//             straight from the header row above them.
const inner=(row,extra)=>({topology:'inner',row,Y_RF:0,Y_ACID:1,TOP:2,BOTTOM:7,...extra});
const variants={
 'inner-row':inner([PU,'gap',AC,'gap',CABLE,'gap',AC,'gap',PU,LDS,LDS],{acid:'gap',bays:[[10,1],[20,1]]}),
 'ring-ac':inner([AC,'gap',CABLE,'gap',AC,PU,PU,LDS,LDS],{acid:'north',acOnRing:true,bays:[[9,1],[21,1]]}),
 'ring-all':inner([AC,CABLE,AC,PU,PU,LDS,LDS],{acid:'north',acOnRing:true,cableOnRing:true,bays:[[7,1],[19,1]]}),
 'two-rows':{topology:'two-rows',Y_RF:0,Y_ACID:1,TOP:6,BOTTOM:11,EAST:12,acid:'header',acOnRing:true,cableOnRing:true,bays:[[10,1]],rfFeed:'side',
  // [recipe, west x, arms as [dx, whitelist | 'out']]
  north:[[AC,0,[[1,[GREEN,PLASTIC,CABLE]],[2,'out']]],[PU,3,[[0,[GREEN,AC]],[2,'out']]],[PU,6,[[0,[GREEN,AC]],[2,'out']]],[LDS,9,[[0,[COPPER]],[1,[STEEL,PLASTIC]],[2,'out']]]],
  inside:[[CABLE,2,[[0,[COPPER]],[2,'out']]],[AC,5,[[0,[GREEN,PLASTIC]],[1,[CABLE]],[2,'out']]],[LDS,8,[[0,[COPPER]],[1,[STEEL,PLASTIC]],[2,'out']]]]},
};
// two-rows-tight (14x12): the ring's east column moves next to the inner row (x=11) and the
// rocket-fuel belt comes down the chest column, its arm dropping into the chest from above.
variants['two-rows-tight']={...variants['two-rows'],EAST:11,bays:[[9,1]],rfFeed:'above'};
// two-rows-cable-last (14x12): the inner row runs low density structure, advanced circuit, cable from
// the west, and the cable machine picks its copper at its east column. Both low-density copper arms
// (x=2 and x=9) then come before the cable arm (x=10) on the ring top, so when copper is short the
// processing-unit line, not the low-density line, waits for it. The inner low-density machine takes
// all three ingredients through one arm, which keeps x=3 free for the copper entrance's panel.
variants['two-rows-cable-last']={...variants['two-rows-tight'],
 inside:[[LDS,2,[[0,[COPPER,STEEL,PLASTIC]],[2,'out']]],[AC,5,[[0,[GREEN,PLASTIC]],[1,[CABLE]],[2,'out']]],[CABLE,8,[[0,'out'],[2,[COPPER]]]]]};
const V=variants[options.variant];assert(V,'unknown variant '+options.variant);
const {Y_RF,Y_ACID,TOP,BOTTOM}=V;
const acOnRing=V.acOnRing===true;
const cableOnRing=V.cableOnRing===true;
const limits=Object.fromEntries(Object.entries({...options.limits,...(acOnRing?{[AC]:8}:{}),...(cableOnRing?{[CABLE]:16}:{}),...options.extraLimits}).filter(([,v])=>v!=null));
// Inner topology: the slots of the one inner row.
const slots=[];if(V.topology==='inner'){let x=2;for(const s of V.row){if(s==='gap'){slots.push({gap:true,x});x+=1;}else{slots.push({recipe:s,x,cx:x+1});x+=3;}}}
const EAST=V.EAST??slots.at(-1).cx+2; // ring east column

// Ring: top y=TOP east, east column south, bottom y=BOTTOM west, west column x=1 north.
const loop=[];
for(let x=1;x<EAST;x++)loop.push(belt(x,TOP,E));
for(let y=TOP;y<BOTTOM;y++)loop.push(belt(EAST,y,S));
for(let x=EAST;x>1;x--)loop.push(belt(x,BOTTOM,W));
for(let y=BOTTOM;y>TOP;y--)loop.push(belt(1,y,N));
for(const e of loop)e.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:1};
const ringNodes=loop.map(e=>({entity:e,connector:1}));
const roles={entranceGates:[],productArms:[],intermediateArms:[],productGated:[],handOff:[],chestArms:[]};
const gate=(e,item,comparator,constant,role)=>{e.control_behavior={...e.control_behavior,...cond(item,comparator,constant)};ringNodes.push({entity:e,connector:1});roles[role].push(e.entity_number);return e;};
const line=recipe=>recipe===LDS?LDS:PU; // the product whose ring count gates this machine's ingredient arms
// One arm on an arms row next to the ring top. side 'inside': arms row TOP+1, machine to the south;
// side 'north': arms row TOP-1, machine to the north. 'out' arms put the machine's product on the ring.
function machineArm(recipe,x,side,what){
 const y=side==='inside'?TOP+1:TOP-1;
 const inDir=side==='inside'?N:S,outDir=side==='inside'?S:N;
 if(what==='out'){
  const product=recipe===PU||recipe===LDS;
  return gate(arm(x,y,outDir),recipe,'<',limits[recipe],product?'productArms':'intermediateArms');
 }
 return gate(arm(x,y,inDir,filters(what)),line(recipe),'<',limits[line(recipe)],'productGated');
}

const acidDrops=[];
const machines=[];
if(V.topology==='inner'){
 const ARMS=TOP+1,MID=TOP+3;
 // A processing-unit machine faces its acid input into its neighbouring gap (inner-row) or keeps
 // the default north input (ring-ac, ring-all).
 for(const s of slots.filter(s=>!s.gap)){
  let direction=0;
  if(s.recipe===PU&&V.acid==='gap'){
   const i=slots.indexOf(s);
   if(slots[i+1]?.gap){direction=E;acidDrops.push({x:slots[i+1].x,kind:'gap'});}
   else{direction=W;acidDrops.push({x:slots[i-1].x,kind:'gap'});}
  }else if(s.recipe===PU)acidDrops.push({x:s.cx,kind:'north'});
  s.entity=add('assembling-machine-2',s.cx,MID,{recipe:s.recipe,...(direction?{direction}:{})});
  machines.push(s);
 }
 // Arms on the arms row: every ingredient arm runs only while its line's product is below its ring
 // limit (processing units for the five machines of that line, low density structures for the two
 // others); every arm that puts an item on the ring runs only while that item is below its limit.
 for(const s of machines){
  const L=s.x,C=s.cx,R=s.x+2;
  if(s.recipe===PU){machineArm(PU,L,'inside',acOnRing?[GREEN,AC]:[GREEN]);machineArm(PU,R,'inside','out');}
  else if(s.recipe===AC){machineArm(AC,L,'inside',[GREEN,PLASTIC]);if(cableOnRing)machineArm(AC,C,'inside',[CABLE]);if(acOnRing)machineArm(AC,R,'inside','out');}
  else if(s.recipe===CABLE){machineArm(CABLE,L,'inside',[COPPER]);if(cableOnRing)machineArm(CABLE,R,'inside','out');}
  else if(s.recipe===LDS){machineArm(LDS,L,'inside',[COPPER]);machineArm(LDS,C,'inside',[STEEL,PLASTIC]);machineArm(LDS,R,'inside','out');}
 }
 // Hand-off arms in the gaps: cable to both advanced-circuit machines, and (inner-row) each
 // advanced-circuit machine to its processing-unit machine.
 for(const g of slots.filter(s=>s.gap)){
  const i=slots.indexOf(g),west=slots[i-1],east=slots[i+1];
  const pair=[west.recipe,east.recipe];
  const from=pair.includes(CABLE)?(west.recipe===CABLE?'west':'east'):(west.recipe===AC?'west':'east');
  // A gap next to a processing-unit machine carries its acid (pipe-to-ground, then pipe); the arm sits below.
  const y=pair.includes(PU)?MID+1:MID;
  roles.handOff.push(arm(g.x,y,from==='west'?W:E).entity_number);
 }
}else{
 for(const[side,list,cy]of [['north',V.north,TOP-3],['inside',V.inside,TOP+3]])for(const[recipe,x,arms]of list){
  const s={recipe,x,cx:x+1,side};
  s.entity=add('assembling-machine-2',s.cx,cy,{recipe});machines.push(s);
  if(recipe===PU){assert.equal(side,'north','processing units take acid from the header row');acidDrops.push({x:s.cx,kind:'header'});}
  for(const[dx,what]of arms)machineArm(recipe,x+dx,side,what);
 }
 acidDrops.sort((a,b)=>a.x-b.x);
}
for(const s of machines)machineCounts[s.recipe]=(machineCounts[s.recipe]||0)+1;
acidDrops.sort((a,b)=>a.x-b.x);

// ---------------------------------------------------------------- entrances (west, column 0)
function port(kind,item,e){
 const p={kind,label:item,items:[item],item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},externalSide:'west',...(kind==='input'?{direction:4}:{}),nominalPerMinute:nominal[item],perMinute:supply[item]};
 ports.push(p);return p;
}
// Rocket fuel: the northernmost entrance (row 0); its belt is placed after the acid and the panels.
const rfEntrance=belt(0,Y_RF,E);port('input',RF,rfEntrance);
// Ring admission gates: each entrance belt side-loads onto the west column and runs only while
// the ring holds fewer of its item than the limit. The circuit entrance is the southernmost.
[COPPER,PLASTIC,STEEL,GREEN].forEach((item,i)=>{const g=belt(0,BOTTOM-4+i,E);gate(g,item,'<',limits[item],'entranceGates');port('input',item,g);});

// Sulfuric acid: entrance (0,1); header along row 1 (pipe-to-ground hops), a jog to row 0 above each
// drop, where a pipe-to-ground runs under the ring top to row 3 (into a north input) or row 4 (then
// a pipe on row 5 into the machine's side input from the gap).
const pipe=(x,y)=>add('pipe',x,y);
const ptg=(x,y,d)=>add('pipe-to-ground',x,y,{direction:d}); // d: the above-ground side
const acidEntrance=pipe(0,Y_ACID);port('fluid',ACID,acidEntrance);
function header(from,to){ // fill row 1 from x=from to x=to inclusive, ending in a pipe at x=to
 let x=from;
 while(to-x>=3){const end=Math.min(x+9,to-1);ptg(x,Y_ACID,W);ptg(end,Y_ACID,E);x=end+1;}
 for(;x<=to;x++)pipe(x,Y_ACID);
}
if(V.acid==='header'){
 // The processing-unit machines sit right below the header row: a pipe over each one's north input.
 let x=1;for(const d of acidDrops){header(x,d.x);x=d.x+1;}
}else{
 const ARMS=TOP+1,MID=TOP+3;
 let x=1,onTop=false;
 acidDrops.forEach((d,i)=>{
  if(!onTop){header(x,d.x-1);pipe(d.x-1,Y_RF);}
  pipe(d.x,Y_RF);ptg(d.x,Y_ACID,N);
  if(d.kind==='gap'){ptg(d.x,MID-1,S);pipe(d.x,MID);}else ptg(d.x,ARMS,S);
  const n=acidDrops[i+1];
  if(n&&n.x-d.x<=4){for(let k=d.x+1;k<n.x;k++)pipe(k,Y_RF);onTop=true;}
  else if(n){pipe(d.x+1,Y_RF);pipe(d.x+1,Y_ACID);x=d.x+2;onTop=false;}
 });
}

// Substation bays (2x2 over rows 0-1) are kept free here and filled by the power helper.
const bays=options.bays||V.bays;
const bayCells=new Set(bays.flatMap(([x,y])=>[[x-1,y-1],[x,y-1],[x-1,y],[x,y]].map(([a,b])=>key(a,b))));
const isFree=(x,y)=>!occupied.has(key(x,y))&&!bayCells.has(key(x,y));

// Rocket fuel belt: row 0 from the entrance to the east column, buried in underground pairs at
// most 6 apart wherever a pipe or a substation bay is in the way (shortest plan by a small search);
// at the east column it turns down to row 1 and an arm puts it into the north chest.
{
 const best=new Map();best.set(EAST,{cost:0,plan:[]});
 for(let x=EAST-1;x>=1;x--){
  if(!isFree(x,Y_RF))continue;
  let choice;
  const nb=best.get(x+1);if(nb)choice={cost:nb.cost+1,plan:[['belt',x],...nb.plan]};
  for(let k=x+2;k<=Math.min(x+6,EAST-1);k++){
   if(!isFree(k,Y_RF))continue;const nk=best.get(k+1);if(!nk)continue;
   const c=nk.cost+2+.01*(k-x);if(!choice||c<choice.cost)choice={cost:c,plan:[['hop',x,k],...nk.plan]};
  }
  if(choice)best.set(x,choice);
 }
 const path=best.get(1);assert(path,'no rocket-fuel route along row 0');
 for(const step of path.plan){
  if(step[0]==='belt')belt(step[1],Y_RF,E);
  else{add('fast-underground-belt',step[1],Y_RF,{direction:E,type:'input'});add('fast-underground-belt',step[2],Y_RF,{direction:E,type:'output'});}
 }
 if((V.rfFeed||'side')==='side'){
  // Down the east column to the rocket-fuel chest row (buried when three or more tiles); an arm
  // east of it puts the fuel into the chest.
  belt(EAST,Y_RF,S);
  const rfRow=TOP-1;
  if(rfRow-1-Y_RF>=3){add('fast-underground-belt',EAST,Y_RF+1,{direction:S,type:'input'});add('fast-underground-belt',EAST,rfRow-1,{direction:S,type:'output'});}
  else for(let y=Y_RF+1;y<rfRow;y++)belt(EAST,y,S);
  belt(EAST,rfRow,E);
 }else{
  // Along row 0 over the arm column, then down the chest column to an arm above the chest.
  belt(EAST,Y_RF,E);belt(EAST+1,Y_RF,E);belt(EAST+2,Y_RF,S);
  for(let y=Y_RF+1;y<TOP-2;y++)belt(EAST+2,y,S);
 }
}

// ---------------------------------------------------------------- labels
// One panel per entrance within 4 tiles (straight line) of it, never west of the entrance on its
// row, never in a bay or on a tile the rocket-fuel belt needs. The assignment minimises the summed
// distance over all entrances (small exhaustive search).
const entrancePorts=ports.filter(p=>p.kind==='input'||p.kind==='fluid').sort((a,b)=>a.y-b.y);
const rfReserved=new Set();
const candidates=entrancePorts.map(p=>{
 const list=[];
 for(let x=0;x<=Math.floor(p.x)+4;x++)for(let y=Y_RF;y<=BOTTOM;y++){
  if(!isFree(x,y)||rfReserved.has(key(x,y)))continue;
  if(y===Math.floor(p.y)&&x<Math.floor(p.x))continue;
  const d=Math.hypot(x+.5-p.x,y+.5-p.y);if(d<=4)list.push({x,y,d});
 }
 return list.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
});
let bestAssignment;
(function search(i,used,sum,chosen){
 if(bestAssignment&&sum>=bestAssignment.sum)return;
 if(i===entrancePorts.length){bestAssignment={sum,chosen:[...chosen]};return;}
 for(const c of candidates[i]){const k=key(c.x,c.y);if(used.has(k))continue;used.add(k);chosen.push(c);search(i+1,used,sum+c.d,chosen);chosen.pop();used.delete(k);}
})(0,new Set(),0,[]);
assert(bestAssignment,'no panel assignment');
entrancePorts.forEach((p,i)=>{
 const spot=options.panelSpots?.[p.item]?{x:options.panelSpots[p.item][0],y:options.panelSpots[p.item][1]}:bestAssignment.chosen[i];
 const text=`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min`;
 const e=add('display-panel',spot.x,spot.y,{icon:{type:p.kind==='fluid'?'fluid':'item',name:p.item},text,always_show:true});p.displayEntity=e.entity_number;
});

// ---------------------------------------------------------------- outputs (east): RF, PU, LDS from the north
const chestX=EAST+2,armX=EAST+1;
const chests={};
const chestRows={[RF]:TOP-1,[PU]:TOP,[LDS]:TOP+1};
for(const item of [RF,PU,LDS]){
 const above=item===RF&&V.rfFeed==='above';
 const a=above?arm(chestX,chestRows[item]-1,N,filters([item])):arm(armX,chestRows[item],W,filters([item]));roles.chestArms.push(a.entity_number);
 chests[item]=add('passive-provider-chest',chestX,chestRows[item],{bar:bars[item]});
 ports.push({kind:'output',label:item,items:[item],item,entity:chests[item].entity_number,x:chests[item].position.x,y:chests[item].position.y,position:{...chests[item].position},externalSide:'east',cap:outputCaps[item],bar:bars[item],arm:a.entity_number});
}

// ---------------------------------------------------------------- circuit wiring: one red ring network
const wireLength=8;
{
 const nodes=ringNodes,inTree=new Set([0]);
 const d=(a,b)=>Math.hypot(a.entity.position.x-b.entity.position.x,a.entity.position.y-b.entity.position.y);
 while(inTree.size<nodes.length){
  let best;
  for(const i of inTree)for(let j=0;j<nodes.length;j++){if(inTree.has(j))continue;const dist=d(nodes[i],nodes[j]);if(dist<=wireLength&&(!best||dist<best.dist))best={i,j,dist};}
  assert(best,'ring network cannot be wired within '+wireLength+' tiles');
  inTree.add(best.j);
  wires.push([nodes[best.i].entity.entity_number,1,nodes[best.j].entity.entity_number,1]);
 }
}

// ---------------------------------------------------------------- power
const preBounds=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
ports.push({kind:'power',label:'External electricity',items:[],entity:0,x:0,y:0});
const layout={entities,wires,next,place,allowPole:e=>e.name==='substation'&&bays.some(([x,y])=>e.position.x===x&&e.position.y===y)};
powerFiveLayout(layout,ports,raw);next=layout.next;
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

// ---------------------------------------------------------------- blueprint
const label='Rocket supplies · 6 rockets per hour';
const description='Factorio 2.1.24 Space Age, normal quality: assembling machine 2 only, no modules, red belts, fast inserters. Makes processing units and low density structures at 5 per minute each and passes rocket fuel through, so the three rocket ingredients (50 of each per rocket) wait side by side in three passive provider chests on the EAST edge: rocket fuel, processing units, low density structures from the north, 400 each (chest bars). WEST entrances: rocket fuel (northernmost, from one rocket-fuel supplier), copper plate, plastic bar, steel plate, electronic circuits (southernmost, from a green-circuit supplier) on belts and sulfuric acid by pipe; each panel gives the supply to plan for. Supply electricity at '+(entities.filter(e=>e.name==='substation').length>1?'either substation':'the substation')+'. Preserve the red wires on the ring tiles, entrance belts and arms (per-tile hold readers and stock limits), the arm filters and the chest bars.';
const bp={item:'blueprint',version:562954249961473,label,description,entities,wires,icons:[RF,PU,LDS].map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
const code=encodeBlueprint({blueprint:bp});
const boundsRaw={...raw,container:{...raw.container,...raw['logistic-container']}};
const footprint=starterBounds(entities,boundsRaw);
assert.deepEqual(footprint,preBounds,'power grew the rectangle');
const capacity=loop.length*8,maximumStock=Object.values(limits).reduce((a,b)=>a+b,0);
assert(maximumStock<=0.6*capacity,`ring limits ${maximumStock} above 60% of ${capacity}`);
const lapSeconds=loop.length/3.75;
// Each limit covers the item's flow during one lap.
for(const item of [GREEN,COPPER,PLASTIC,STEEL])assert(limits[item]>=Math.ceil(supply[item]*lapSeconds/60),'limit below one lap of flow: '+item);
// All four belt entrances side-load onto the same lane of the ring's west column (4 slots per tile).
// Their limits together must leave a quarter of that lane free, or a surplus item fills it and the
// others cannot merge.
const entranceLaneShare=[GREEN,COPPER,PLASTIC,STEEL].reduce((a,item)=>a+limits[item],0),entranceLaneSlots=4*loop.length;
assert(entranceLaneShare<=0.75*entranceLaneSlots,`entrance limits ${entranceLaneShare} above 75% of the shared entrance lane (${entranceLaneSlots} slots)`);
// Placement rules for the supplier links (contract section 13).
const entranceRows=ports.filter(p=>p.kind==='input'||p.kind==='fluid').map(p=>({item:p.item,row:Math.floor(p.y)-footprint.top}));
const rowOf=item=>entranceRows.find(r=>r.item===item).row;
assert.equal(rowOf(RF),Math.min(...entranceRows.map(r=>r.row)),'rocket fuel is the northernmost entrance');
assert.equal(rowOf(GREEN),Math.max(...entranceRows.map(r=>r.row)),'electronic circuits are the southernmost entrance');
const clearRowsNorthOfCircuits=(()=>{let n=0;for(let r=rowOf(GREEN)-1;r>=0&&!entranceRows.some(e=>e.row===r);r--)n++;return n;})();

// ---------------------------------------------------------------- report-derived fields
let status='native-validation-pending',measured;
try{
 const r=JSON.parse(await fs.readFile(OUT+'/native-report.json'));const b=r.builds?.[0];
 if(r.passed===true&&r.short!==true&&b?.blueprintSha256===sha(code)){
  status='qualified';
  measured={
   steadyPerMinute:b.outputsPerMinute,recoveryPerMinute:b.recovery.outputsPerMinute,
   blockedChestStock:Object.fromEntries(b.blocked.collectionPauseStock.map(p=>[p.item,p.count])),
   entranceDrawPerMinute:Object.fromEntries([...b.inputs,...b.fluids].map(p=>[p.item,p.measuredPerMinute])),
   ringMaximumStock:b.loopSamples[id].maxStock,reportCreatedAt:r.createdAt};
 }
}catch{}

const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:140,settleMinutes:5,recoveryMinutes:10,stopAcceptingWindowMinutes:5,...options.protocol};
const portView=kind=>ports.filter(p=>p.kind===kind);
const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length]));
const manifest={
 id,name:label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'rate',status,
 ...(measured?{measured}:{}),
 variant:options.variant,
 products,passThrough,targets,outputCaps,
 recipeAudit:{externalPerMinute:required,nominalPerMinute:nominal,startPerMinute,qualifiedPerMinute:supply,craftsPerMinute:crafts,craftsPerMachinePerMinute:perMachine,machinesExact:machinesNeeded,
  recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,raw.recipe[n].ingredients])),
  energyRequired:Object.fromEntries(Object.keys(crafts).map(n=>[n,energy(n)])),craftingSpeed:am2.crafting_speed,stackSize:stack},
 inputs:portView('input'),fluids:portView('fluid'),outputs:portView('output'),ports,
 machineCounts,footprint,
 areaGoal:{goalTiles:260,stretchTiles:230,fallbackTiles:340,achievedTiles:footprint.width*footprint.height},
 loopControl:[{name:id,reader:loop[0].entity_number,readerMode:'per-tile-hold',loop:loop.map(e=>e.entity_number),
  controlled:[...roles.entranceGates,...roles.productArms,...roles.intermediateArms],productGated:roles.productGated,uncountedTiles:0,
  limits,capacity,maximumStock,entranceLane:{share:entranceLaneShare,slots:entranceLaneSlots,maximumFraction:0.75},lapSeconds:Math.round(lapSeconds*100)/100}],
 armRoles:roles,
 stockControl:{mode:'bar',chests:Object.fromEntries(Object.entries(chests).map(([k,e])=>[k,e.entity_number])),bars,caps:outputCaps},
 protocol,
 construction,
 billOfMaterials:{items:construction},
 supplierLinks:[
  {supplier:'rocket-fuel-supplier',item:RF,copies:1,entranceRowFromTop:rowOf(RF),perMinute:supply[RF]},
  {supplier:'green-circuits',item:GREEN,copies:1,entranceRowFromTop:rowOf(GREEN),perMinute:supply[GREEN],
   clearRowsNorth:clearRowsNorthOfCircuits,
   ...(clearRowsNorthOfCircuits<5?{note:`${clearRowsNorthOfCircuits?'Only '+clearRowsNorthOfCircuits+' clear rows':'No clear row'} north of the circuit entrance (the copper, plastic and steel entrances sit on the rows just above it, all four side-loading onto the ring's west column), so a green-circuits copy cannot sit directly west with its exit on this row without covering the copper, plastic, steel and acid approaches: place it further south or west and bring its belt in on row ${rowOf(GREEN)}.`}:{})},
 ],
 setupNotes:[
  description,
  `Supply per minute (the entrance panels): ${ports.filter(p=>p.kind==='input'||p.kind==='fluid').map(p=>p.item+' '+fmt(p.perMinute)).join(', ')}. One rocket-fuel supplier (6 per minute) covers the rocket fuel; one green-circuit supplier (360 per minute) covers these ${fmt(supply[GREEN])} circuits and the launch kit's together, split its exit belt between them.`,
  'Feed the silo from the three east chests: 50 rocket fuel, 50 processing units and 50 low density structures make one rocket. The chests stop at 400 each (8 rockets: the five launches of the space-launch campaign, 250 of each ingredient, plus three spare) and the factory stops by itself; it restarts as soon as items are taken.',
  'If circuits (a split green-circuit belt) and acid (an open pipe) arrive above their panels, supply copper at 150 per minute: the processing-unit line then runs at up to 7.5 per minute and its cable takes 30 copper per minute, so with copper at exactly 120 low density structures run at 4.5 per minute until the processing-unit chest is full (blueprint-sources/rocket-supplies/above-panels.json).',
  'Do not remove the chest bars or the red wires: the bars are the caps, and the ring stock limits keep the ring from clogging.',
 ],
};
await fs.mkdir(OUT,{recursive:true});
await fs.writeFile(OUT+'/'+id+'.txt',code+'\n');
await fs.writeFile(OUT+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,out:OUT,status,footprint,area:footprint.width*footprint.height,machines:Object.values(machineCounts).reduce((a,b)=>a+b,0),entities:entities.length,nominal,supply,blueprintSha256:manifest.blueprintSha256,maximumStock,capacity,lapSeconds}));
