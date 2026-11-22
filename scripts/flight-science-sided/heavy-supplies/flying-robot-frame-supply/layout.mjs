// Flying-robot-frame supply factory: 20 flying robot frames per minute for the Compact six-pack tier's south entrance.
// It makes its own engines (with gears and pipes), electric engines and batteries. Electronic circuits, iron, copper and
// steel plates arrive on belts; lubricant and sulfuric acid by one pipe inlet each. Everything enters on the west side.
//
// Shape (all variants): one circulating ring belt with stock control (as the family's engine-supply), machines in
// three rows of eight: an outer row north of the ring, an inner row inside it, an outer row south of it.
//   inner-fluids (published): electric engines and battery plants form the inner row. Lubricant runs along the inner
//     row's north arm row (y=1) and enters under the ring's west column by pipe-to-ground; sulfuric acid runs along the
//     inner row's south arm row (y=5), hopping under the electric-engine arms. No pipe rows outside: 31 x 15.
//   narrow-west: inner-fluids with a two-column west strip: each belt inlet is the tile its single lifting arm picks
//     from, and the panels sit between the inlets. One arm each for iron (120/min) and circuits (100/min). 30 x 15.
//     Screened 2026-11-22: 19.33/min; one fast arm lifts only about 116 iron/min onto the ring, so it is not published.
//   outer-fluids: electric engines in the north outer row with a lubricant pipe row above them, battery plants in the
//     south outer row with an acid pipe row below them; the inner row is dry. 31 x 17.
//     Screened 2026-11-22: 19.50/min; inlet queues grow (one frame assembler short of ingredients), not published.
// Ring: x=0..25, y=0 (east), x=25 (south), y=6 (west), x=0 (north). Machine columns cx=2+3i, i=0..7.
import assert from 'node:assert/strict';
import {powerStarterLayout,starterBounds} from '../../../science-factory/local-ports/compact-shared-layout.mjs';

export const TARGET=20,PRODUCT='flying-robot-frame';
export const VARIANTS=['narrow-west','inner-fluids','outer-fluids'];

// Recipe arithmetic from the prototype dump: crafts per minute, machines (rounded up) and exterior inflows.
export function arithmetic(raw){
 const recipe=n=>raw.recipe[n],machineFor=n=>recipe(n).categories?.includes('chemistry')?'chemical-plant':'assembling-machine-2';
 const speed=m=>raw['assembling-machine'][m].crafting_speed;
 const crafts={},need=(item,perMinute)=>{
  if(['iron-plate','copper-plate','steel-plate','electronic-circuit','lubricant','sulfuric-acid'].includes(item))return;
  const r=recipe(item),made=r.results.find(x=>x.name===item).amount,runs=perMinute/made;crafts[item]=(crafts[item]||0)+runs;
  for(const i of r.ingredients)need(i.name,runs*i.amount);
 };
 need(PRODUCT,TARGET);
 const external={},machines={},exact={},machine={};
 for(const [n,runs]of Object.entries(crafts)){
  const m=machineFor(n),perMachine=speed(m)*60/(recipe(n).energy_required??.5);machine[n]=m;exact[n]=runs/perMachine;machines[n]=Math.ceil(exact[n]-1e-9);
  for(const i of recipe(n).ingredients)if(!crafts[i.name])external[i.name]=(external[i.name]||0)+runs*i.amount;
 }
 return {crafts,external,machines,exact,machine};
}

export function build(variant,raw){
 assert(VARIANTS.includes(variant),'unknown variant '+variant);
 const math=arithmetic(raw);
 // Sanity: the shape below holds exactly these counts.
 assert.deepEqual(math.machines,{'flying-robot-frame':9,'electric-engine-unit':5,battery:3,'engine-unit':5,'iron-gear-wheel':1,pipe:1});
 assert.equal(math.machine.battery,'chemical-plant');
 const rate=n=>Math.round(math.external[n]);
 const entities=[],wires=[],ports=[],occupied=new Map(),counts={};let next=1;const loop=[],controlled=[];
 const key=(x,y)=>`${x},${y}`;
 function add(name,x,y,extra={}){const r=['assembling-machine-2','chemical-plant'].includes(name)?1:0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++){assert(!occupied.has(key(a,b)),`overlap ${name} ${a},${b} with ${occupied.get(key(a,b))?.name}`);}const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++)occupied.set(key(a,b),e);entities.push(e);return e;}
 const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
 const filter=n=>({use_filters:true,filters:[{index:1,name:n,quality:'normal',comparator:'='}]});
 const limits={'iron-plate':48,'copper-plate':24,'steel-plate':32,'electronic-circuit':64,'iron-gear-wheel':12,pipe:16,'engine-unit':12,'electric-engine-unit':12,battery:24,'flying-robot-frame':16};
 const cond=n=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:n,quality:'normal'},comparator:'<',constant:limits[n]}});
 const arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
 // A controlled arm is wired to the ring tile it drops onto.
 const control=(e,item,ringX,ringY)=>{e.control_behavior=cond(item);controlled.push(e.entity_number);wires.push([e.entity_number,1,occupied.get(key(ringX,ringY)).entity_number,1]);return e;};
 const machine=(recipe,x,y,direction)=>{counts[recipe]=(counts[recipe]||0)+1;return add(recipe==='battery'?'chemical-plant':'assembling-machine-2',x,y,{recipe,...(direction?{direction}:{})});};

 // Ring with an entire-belt reader, every tile wired (family loopControl).
 const W=25,H=6;
 for(let x=0;x<=W;x++)loop.push(belt(x,0,x===W?8:4));for(let y=1;y<=H;y++)loop.push(belt(W,y,y===H?12:8));for(let x=W-1;x>=0;x--)loop.push(belt(x,H,x===0?0:12));for(let y=H-1;y>0;y--)loop.push(belt(0,y,0));
 const reader=loop[0];reader.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};for(let i=0;i<loop.length;i++)wires.push([loop[i].entity_number,1,loop[(i+1)%loop.length].entity_number,1]);

 const cx=i=>2+3*i,F='flying-robot-frame',EEU='electric-engine-unit',ENG='engine-unit';
 const inner=variant!=='outer-fluids';
 const rows=inner?{
  north:Array(8).fill(F),inner:[...Array(5).fill(EEU),...Array(3).fill('battery')],south:['pipe','iron-gear-wheel',...Array(5).fill(ENG),F]}
 :{north:[...Array(5).fill(EEU),...Array(3).fill(F)],inner:[...Array(6).fill(F),'iron-gear-wheel','pipe'],south:[...Array(3).fill('battery'),...Array(5).fill(ENG)]};
 // North outer row: machines on rows -4..-2, arms on row -1 (input west of centre, controlled output east of it).
 rows.north.forEach((r,i)=>{const x=cx(i);machine(r,x,-3);arm(x-1,-1,8);control(arm(x+1,-1,0),r,x+1,0);});
 // South outer row: machines on rows 8..10 (battery plants turned so their acid inputs face south), arms on row 7.
 rows.south.forEach((r,i)=>{const x=cx(i);machine(r,x,9,r==='battery'?8:0);arm(x-1,7,0);control(arm(x+1,7,8),r,x+1,6);});
 // Inner row: machines on rows 2..4.
 rows.inner.forEach((r,i)=>{const x=cx(i);
  if(inner&&r===EEU){
   // Electric engines: lubricant from the north (row 1 is the lubricant header), arms on row 5 to and from the ring's
   // south belt. Arm pairs alternate sides so the acid hop has two free tiles between every second pair of machines.
   machine(r,x,3);const [a,b]=i%2===0?[x-1,x]:[x,x+1];arm(a,5,8);control(arm(b,5,0),r,b,6);
  }else if(inner&&r==='battery'){
   // Battery plants turned south: acid inputs at (cx±1,5) on the acid header; arms on row 1 to and from the north belt.
   machine(r,x,3,8);arm(x-1,1,0);control(arm(x+1,1,8),r,x+1,0);
  }else{machine(r,x,3);arm(x-1,1,0);control(arm(x+1,5,0),r,x+1,6);}
 });

 // Fluids. Pipe-to-ground direction is its above-ground connection.
 const fluidPort=(fluid,e,perMinute)=>ports.push({kind:'fluid',label:fluid,items:[fluid],entity:e.entity_number,x:e.position.x,y:e.position.y,externalSide:'west',perMinute});
 const westX=variant==='narrow-west'?-2:-3;
 if(inner){
  const lubIn=add('pipe-to-ground',westX,1,{direction:12});add('pipe-to-ground',1,1,{direction:4});for(let x=2;x<=cx(4);x++)add('pipe',x,1);
  const acidIn=add('pipe-to-ground',westX,5,{direction:12});
  // Hops: (-3)->(3), (4)->(9), (10)->(15); then a plain header under the three plants.
  for(const [a,b]of [[3,4],[9,10]]){add('pipe-to-ground',a,5,{direction:4});add('pipe-to-ground',b,5,{direction:12});}
  add('pipe-to-ground',15,5,{direction:4});for(let x=16;x<=cx(7)+1;x++)add('pipe',x,5);
  fluidPort('lubricant',lubIn,rate('lubricant'));fluidPort('sulfuric-acid',acidIn,rate('sulfuric-acid'));
 }else{
  const lubIn=add('pipe',-3,-5);add('pipe-to-ground',-2,-5,{direction:12});add('pipe-to-ground',1,-5,{direction:4});for(let x=2;x<=cx(4);x++)add('pipe',x,-5);
  const acidIn=add('pipe',-3,11);add('pipe-to-ground',-2,11,{direction:12});add('pipe-to-ground',0,11,{direction:4});for(let x=1;x<=cx(2)+1;x++)add('pipe',x,11);
  fluidPort('lubricant',lubIn,rate('lubricant'));fluidPort('sulfuric-acid',acidIn,rate('sulfuric-acid'));
 }

 // West strip: one belt inlet per item at x=-3; controlled arms at x=-1 lift each onto the ring's west column.
 const input=(item,x,y)=>{const e=belt(x,y,4);ports.push({kind:'input',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute:rate(item)});return e;};
 const lift=(item,y)=>control(arm(-1,y,12,filter(item)),item,0,y);
 if(variant==='narrow-west'){
  // Inlet tile = pickup tile; rows 1 and 5 hold the fluid inlets (their pipes pass under the arms and the ring).
  for(const [item,y]of [['iron-plate',0],['copper-plate',2],['steel-plate',4],['electronic-circuit',6]]){input(item,-2,y);lift(item,y);}
 }else{
   // Iron: down column -2 past two arms (rows 0 and 1).
   input('iron-plate',-3,-2);belt(-2,-2,8);belt(-2,-1,8);belt(-2,0,8);belt(-2,1,4);lift('iron-plate',0);lift('iron-plate',1);
   input('copper-plate',-3,2);belt(-2,2,4);lift('copper-plate',2);
   input('steel-plate',-3,4);belt(-2,4,4);lift('steel-plate',4);
   // Circuits: up column -2 past two arms (rows 6 and 5; row 6 drops onto the ring's south-west corner).
   input('electronic-circuit',-3,7);belt(-2,7,0);belt(-2,6,0);belt(-2,5,4);lift('electronic-circuit',5);lift('electronic-circuit',6);
 }

 // Output: one filtered arm off the east column into a steel chest limited to two slots (as the family's supplies).
 const outArm=arm(W+1,3,12,filter(F)),chest=add('steel-chest',W+2,3,{bar:2});
 ports.push({kind:'output',label:F,items:[F],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,externalSide:'east',perMinute:TARGET});

 // Display panels next to each port (fixed tiles, checked free).
 const panelAt=variant==='narrow-west'?{'iron-plate':[-2,-1],lubricant:[-1,1],'copper-plate':[-1,3],'steel-plate':[-2,3],'sulfuric-acid':[-1,5],'electronic-circuit':[-2,7],[F]:[W+2,2]}
  :variant==='inner-fluids'?{'iron-plate':[-3,-3],lubricant:[-3,0],'copper-plate':[-2,3],'steel-plate':[-3,3],'sulfuric-acid':[-3,6],'electronic-circuit':[-3,8],[F]:[W+2,2]}
  :{'iron-plate':[-3,-3],lubricant:[-3,-4],'copper-plate':[-2,3],'steel-plate':[-3,3],'sulfuric-acid':[-3,10],'electronic-circuit':[-3,8],[F]:[W+2,2]};
 for(const p of ports){const [x,y]=panelAt[p.items[0]];const fluid=p.kind==='fluid';
  const e=add('display-panel',x,y,{icon:{type:fluid?'fluid':'item',name:p.items[0]},text:`${p.kind==='output'?'output':'input'}: ${p.label} ${p.perMinute}/min`,always_show:true});p.displayEntity=e.entity_number;}

 ports.push({kind:'power',label:'External electricity',items:[],entity:0,x:0,y:0});
 const bp={item:'blueprint',version:562954249961472,label:`flying-robot-frame-supply · ${TARGET}/min`,entities,wires:[],icons:[{index:1,signal:{type:'item',name:F}}]};
 const before=starterBounds(entities,raw);
 powerStarterLayout(bp,ports,raw);bp.wires.push(...wires);
 const footprint=starterBounds(bp.entities,raw);
 assert.deepEqual(footprint,before,'power poles must not grow the rectangle');
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 bp.description=`One inlet per material on the left (iron ${rate('iron-plate')}, copper ${rate('copper-plate')}, steel ${rate('steel-plate')}, electronic circuits ${rate('electronic-circuit')}/min on belts; lubricant ${rate('lubricant')} and sulfuric acid ${rate('sulfuric-acid')}/min by pipe); collect flying robot frames on the right. AM2, chemical plants for batteries, fast inserters, red belts, no modules. Keep circuit stock controls.`;
 return {bp,ports,counts,footprint,math,loop:{name:'frame',reader:reader.entity_number,controlled,capacity:loop.length*8,limits}};
}
