// Advanced-circuit supplier: 25 assembling machine 2 on advanced circuits (187.5/min) with their own copper cable and
// electronic circuits, from copper plates, iron plates and plastic bars. Sibling of scripts/green-circuits.
//
// Layout (published variant `outer-exits`, 14 rows): two machine rows (top y 2..4, bottom y 9..11) face one aisle of
// four rows: arm row y5, belt X1 y6 (plastic on the north lane, electronic circuits on the south lane), belt X2 y7
// (copper cable on both lanes), arm row y8. Each machine row also has an outer arm row and an outer belt row (y1/y0 on
// top, y12/y13 at the bottom). The west part of an outer belt row carries plates to the producers above or below it;
// the east part collects advanced circuits from the red-circuit machines. The two outer collectors meet at the east
// edge: the bottom one climbs the last column under the machines and side-loads the exit tile, which the top one
// feeds from behind.
//  - Top row, west to east: five pairs `cable | bulk arm | electronic circuit` (the cable machine hands all its cable
//    to its circuit machine; the circuit machine tops up from X2 with a long-handed arm and drops circuits on X1),
//    `--top-cable` cable machines that drop cable on X2 with long-handed arms, then red-circuit machines.
//  - Bottom row: `--bottom-cable` cable machines that drop cable on X2 with a bulk arm, then red-circuit machines.
//  - A red-circuit machine takes circuits and plastic from X1 and cable from X2 (one fast arm, one long-handed arm)
//    and drops its product on its outer belt.
// Substations stand in two-tile holes of the aisle, where X1 and X2 pass underground.
//
// Pure Node and reproducible: the same variant and raw dump give the same blueprint string.
// Usage: node scripts/advanced-circuits/generate.mjs [--variant outer-exits] [--out dir]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerWithinLayout} from './power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const variantName=flag('variant',process.env.AC_VARIANT||'outer-exits');
const id='advanced-circuits',out=flag('out',process.env.AC_OUT||'blueprint-sources/'+id);
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');

// Variants. pairs: electronic-circuit machines, each with one cable machine handing it cable through a bulk arm.
// topCable: cable machines in the top row dropping on X2 (long-handed arms); bottomCable: in the bottom row (bulk).
// topReds/bottomReds: red-circuit machines per row; topGap: empty columns between the top producers and reds.
// holes: the west column of each two-column substation hole in the aisle.
// split: cable per minute expected from the bottom cable machines (sets the two copper panel figures).
const VARIANTS={
 'outer-exits':{pairs:5,topCable:2,bottomCable:4,topReds:7,bottomReds:18,topGap:1,holes:[5,17,32,50,59],bottomCableMinute:675,exitCap:7},
 // Compaction screens (2026-11-22), not published. module: one half of a stack, written as entities for
 // scripts/advanced-circuits/stack.mjs (exit 'bottom': the bottom collector ends straight at (last,13), the top
 // collector climbs down the last column and side-loads it from the north). chain: the top-row circuit machines sit in
 // one green-supplier chain C E C E C ... (outer cable machines bulk arms, inner ones a fast arm to each side).
 'stack-half-north':{module:true,exit:'bottom',width:36,pairs:3,topCable:1,bottomCable:2,topReds:3,bottomReds:10,topGap:0,holes:[5,17,29],bottomCableMinute:300,exitCap:0},
 'stack-half-south':{module:true,exit:'bottom',width:36,pairs:3,topCable:1,bottomCable:2,topReds:3,bottomReds:9,topGap:0,holes:[5,17,29],bottomCableMinute:300,exitCap:0},
 'green-chain':{chain:true,pairs:5,topCable:1,bottomCable:4,topReds:6,bottomReds:19,topGap:2,holes:[5,20,35,44,59],bottomCableMinute:615,exitCap:7},
};
const variant=VARIANTS[variantName];assert(variant,'unknown variant '+variantName);

// exitCap: what the exit tile holds when nothing takes circuits: 4 on the north lane, fed from behind, and 3 on the
// south lane, side-loaded by the climbing collector (measured natively).
const product='advanced-circuit',exitCap=variant.exitCap;
const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:10,settleMinutes:5,recoveryMinutes:10}; // 10 blocked minutes: the long collectors take about 4 to fill

// ---------- recipe audit from the raw dump ----------
const speed=raw['assembling-machine']['assembling-machine-2'].crafting_speed;
const perMachine=n=>60*speed*raw.recipe[n].results.find(r=>r.name===n).amount/(raw.recipe[n].energy_required??.5);
// Target: advanced circuits used by the six ground science packs at 30 of each per minute, directly and through
// sub-recipes (electric furnaces, productivity modules, processing units), counted down every recipe chain from the
// dump; then rounded up to whole assembling machine 2.
const SCIENCE=['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack','production-science-pack','utility-science-pack'];
const demandBy={};
function demand(item,n,path){
 if(item===product){demandBy[path]=(demandBy[path]||0)+n;return;}
 const r=raw.recipe[item];if(!r||path.split(' > ').length>8)return; // the recipe named after the item; plates and other raw items have none or end the chain
 const made=r.results.find(p=>p.name===item);if(!made)return;
 for(const i of r.ingredients)if(i.type==='item')demand(i.name,n*i.amount/(made.amount??1),path?path+' > '+item:item);
}
for(const pack of SCIENCE)demand(pack,30,'');
const demandPerMinute=Object.values(demandBy).reduce((a,n)=>a+n,0);
const redMachines=Math.ceil(demandPerMinute/perMachine(product)-1e-9);
assert(demandPerMinute>=60&&demandPerMinute<=240,'demand outside 60..240 per minute: the rule says use 120 instead');
if(!variant.module)assert.equal(variant.topReds+variant.bottomReds,redMachines,'the variant must build exactly the rounded-up machine count');
const target=(variant.module?variant.topReds+variant.bottomReds:redMachines)*perMachine(product);
const boundary=new Set(['iron-plate','copper-plate','plastic-bar']);
const required={},crafts={};
function expand(item,n){if(boundary.has(item)){required[item]=(required[item]||0)+n;return;}const r=raw.recipe[item];assert(r,item);const made=r.results.find(p=>p.name===item).amount;crafts[item]=(crafts[item]||0)+n/made;for(const i of r.ingredients)expand(i.name,n*i.amount/made);}
expand(product,target);
const machinesExact=Object.fromEntries(Object.entries(crafts).map(([n,c])=>[n,c*(raw.recipe[n].results.find(r=>r.name===n).amount)/perMachine(n)]));

// ---------- placement with collision checks ----------
let next=1;const entities=[],wires=[],ports=[],occupied=new Map(),machineCounts={};
const key=(x,y)=>`${x},${y}`;
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function place(e){const p=protoOf(e.name);assert(p,e.name);let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}entities.push(e);return e;}
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra});
const at=(x,y)=>occupied.get(key(x,y));
const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d}),dive=(x,y,d,type)=>add('fast-underground-belt',x,y,{direction:d,type});

// ---------- machines ----------
// Rows: top machines y 2..4 (outer arm row y1, outer belt y0; aisle arm row y5), bottom y 9..11 (aisle arm row y8,
// outer arm row y12, outer belt y13). X1 = y6, X2 = y7.
const ROWS={top:{y:2,outerArm:1,outerBelt:0,innerArm:5,fastBelt:6,longBelt:7,toMachine:0,fromMachine:8},
 bottom:{y:9,outerArm:12,outerBelt:13,innerArm:8,fastBelt:7,longBelt:6,toMachine:8,fromMachine:0}};
// Arm direction is the side the arm picks from: 0 north, 4 east, 8 south, 12 west. An arm in the top inner row picking
// from the aisle faces 8 (south); dropping into the aisle it picks from the machine (0, north). Mirrored at the bottom.
const machines=[];
function machine(kind,row,x,recipe){
 const R=ROWS[row],m=add('assembling-machine-2',x+1,R.y+1,{position:{x:x+1.5,y:R.y+1.5},recipe});
 machineCounts[recipe]=(machineCounts[recipe]||0)+1;const rec={kind,row,x,recipe,entity:m};machines.push(rec);return rec;
}
const top=[],bottom=[];
let tx=3;
if(variant.chain){
 // C E C E ... C: every machine followed by a one-column gap except the last.
 for(let i=0;i<=variant.pairs;i++){top.push(machine(i===0?'chain-cable-first':i===variant.pairs?'chain-cable-last':'chain-cable','top',tx,'copper-cable'));tx+=4;if(i<variant.pairs){top.push(machine('circuit','top',tx,'electronic-circuit'));tx+=4;}}
 tx-=1;
}else for(let i=0;i<variant.pairs;i++){top.push(machine(i===variant.pairs-1?'last-pair-cable':'pair-cable','top',tx,'copper-cable'));tx+=4;top.push(machine('circuit','top',tx,'electronic-circuit'));tx+=3;}
for(let i=0;i<variant.topCable;i++){top.push(machine('long-cable','top',tx,'copper-cable'));tx+=3;}
tx+=variant.topGap;
for(let i=0;i<variant.topReds;i++){top.push(machine('red','top',tx,product));tx+=3;}
let bx=0;
for(let i=0;i<variant.bottomCable;i++){bottom.push(machine('bulk-cable','bottom',bx,'copper-cable'));bx+=3;}
for(let i=0;i<variant.bottomReds;i++){bottom.push(machine('red','bottom',bx,product));bx+=3;}
const width=variant.width??Math.max(tx,bx),last=width-1;assert(width>=Math.max(tx,bx)); // the east column carries the climbing collector
if(!variant.module)for(const [n,c] of Object.entries(machinesExact))assert(machineCounts[n]>=c-1e-9,`${n} needs ${c} machines, built ${machineCounts[n]}`);

// ---------- arms ----------
const holeCols=new Set(variant.holes.flatMap(c=>[c,c+1]));
const ugEnds=new Set(variant.holes.flatMap(c=>[c-1,c+2]));
const touch={X1:new Map(),X2:new Map(),top:new Map(),bottom:new Map()}; // column -> 'pick'|'drop'
// Roles: gap (cable machine to its circuit machine), input (plate arms), cableOut/circuitOut (onto the aisle belts),
// cableIn (circuit machines topping up cable from X2), aisleIn (red-circuit machines from X1 and X2), output (product).
const armRoles={gap:[],input:[],output:[],cableOut:[],circuitOut:[],cableIn:[],aisleIn:[]};
const beltOf=(row,type)=>{const R=ROWS[row];const y=type==='long'?R.longBelt:R.fastBelt;return y===6?'X1':'X2';};
// Inner arms: [{type:'fast'|'long'|'bulk', act:'pick'|'drop', role}]; outer arms likewise on the outer belt.
const NEEDS={
 'pair-cable':{outer:[{type:'fast',act:'pick',item:'copper-plate',role:'input'}],inner:[]},
 // The last pair: its circuit machine is the one that runs short of iron (the ones upstream take a little more), so its
 // cable machine also drops spare cable on X2 instead of stopping on a full output.
 'last-pair-cable':{outer:[{type:'fast',act:'pick',item:'copper-plate',role:'input'}],inner:[{type:'long',act:'drop',role:'cableOut'}]},
 circuit:{outer:[{type:'fast',act:'pick',item:'iron-plate',role:'input'}],inner:[{type:'fast',act:'drop',role:'circuitOut'},{type:'long',act:'pick',role:'cableIn'}]},
 'long-cable':{outer:[{type:'fast',act:'pick',item:'copper-plate',role:'input'}],inner:[{type:'long',act:'drop',role:'cableOut'},{type:'long',act:'drop',role:'cableOut'},{type:'long',act:'drop',role:'cableOut'}]},
 'bulk-cable':{outer:[{type:'fast',act:'pick',item:'copper-plate',role:'input'}],inner:[{type:'bulk',act:'drop',role:'cableOut'}]},
 'chain-cable-first':{outer:[{type:'fast',act:'pick',item:'copper-plate',role:'input'}],inner:[]},
 'chain-cable':{outer:[{type:'fast',act:'pick',item:'copper-plate',role:'input'}],inner:[]},
 'chain-cable-last':{outer:[{type:'fast',act:'pick',item:'copper-plate',role:'input'}],inner:[{type:'long',act:'drop',role:'cableOut'}]},
 red:{outer:[{type:'fast',act:'drop',role:'output'}],inner:[{type:'fast',act:'pick',role:'aisleIn'},{type:'long',act:'pick',role:'aisleIn'}]},
};
const armOf=(type,x,y,d,extra={})=>add(type==='long'?'long-handed-inserter':type==='bulk'?'bulk-inserter':'fast-inserter',x,y,{direction:d,override_stack_size:type==='bulk'?2:1,...extra});
const panels={top:new Set([0]),bottom:new Set([0])}; // display panels on (0,0) and (0,12)
for(const m of machines){
 const R=ROWS[m.row],cols=[m.x,m.x+1,m.x+2].filter(c=>c!==last);
 // Inner arms: never in a hole column; drops never on an underground end; picks anywhere on the belt.
 const inner=NEEDS[m.kind].inner,free=cols.filter(c=>!holeCols.has(c)&&c>=2); // X1 starts at 1, X2 at 2 (the stub is (1,7))
 const order=[...inner].sort((a,b)=>(a.act==='drop'?0:1)-(b.act==='drop'?0:1));
 const used=new Set();
 for(const a of order){
  // Drops prefer a surface tile; a drop on an underground end of a hole is allowed when nothing else is free.
  const c=free.find(c=>!used.has(c)&&!(a.act==='drop'&&ugEnds.has(c)))??free.find(c=>!used.has(c));
  assert(c!==undefined,`no inner column for ${m.kind} at ${m.row} ${m.x}`);used.add(c);
  const belt=beltOf(m.row,a.type==='long'?'long':'fast');touch[belt].set(c,touch[belt].get(c)==='drop'?'drop':a.act); // a tile may serve an arm from each side
  const e=armOf(a.type,c,R.innerArm,a.act==='pick'?(m.row==='top'?8:0):(m.row==='top'?0:8));armRoles[a.role].push(e.entity_number);
 }
 const outerUsed=new Set();
 for(const a of NEEDS[m.kind].outer){
  const c=cols.find(c=>!outerUsed.has(c)&&!panels[m.row].has(c));assert(c!==undefined);outerUsed.add(c);
  touch[m.row].set(c,a.act);
  const e=armOf(a.type,c,R.outerArm,a.act==='pick'?(m.row==='top'?0:8):(m.row==='top'?8:0),a.item?filter(a.item):{});armRoles[a.role].push(e.entity_number);
 }
}
// Gap arms: each pair's cable machine hands all its cable to its circuit machine through one bulk arm (hand 2).
for(const m of top.filter(m=>/pair-cable/.test(m.kind))){const e=add('bulk-inserter',m.x+3,3,{direction:12,override_stack_size:2});armRoles.gap.push(e.entity_number);}
// Chain gap arms as in green-circuits: the two end cable machines hand all their cable to their one neighbour through a
// bulk arm; each inner cable machine gives to both neighbours through one fast arm per side.
for(const m of top.filter(m=>/chain-cable/.test(m.kind))){
 if(m.kind!=='chain-cable-last'){const e=m.kind==='chain-cable-first'?add('bulk-inserter',m.x+3,3,{direction:12,override_stack_size:2}):add('fast-inserter',m.x+3,3,{direction:12,override_stack_size:1});armRoles.gap.push(e.entity_number);}
 if(m.kind!=='chain-cable-first'){const e=m.kind==='chain-cable-last'?add('bulk-inserter',m.x-1,3,{direction:4,override_stack_size:2}):add('fast-inserter',m.x-1,3,{direction:4,override_stack_size:1});armRoles.gap.push(e.entity_number);}
}

// ---------- belts ----------
const entrance={};
// Top-left corner: copper (0,1) and iron (0,2) side-load the north-facing merge tile (1,1) from opposite sides, which
// turns east at (1,0): copper on the north lane of the top plate belt, iron on its south lane.
entrance['copper-plate:upper']=belt(0,1,4);belt(1,1,0);
entrance['iron-plate']=belt(0,2,4);belt(1,2,4);belt(2,2,0);belt(2,1,12);
belt(1,0,4);
// Top plate belt: (1..end,0); the last tile turns south into its last arm, a dead end.
const topPick=[...touch.top].filter(([,a])=>a==='pick').map(([c])=>c),topDrop=[...touch.top].filter(([,a])=>a==='drop').map(([c])=>c);
const ptEnd=Math.max(...topPick);assert(ptEnd<Math.min(...topDrop),'top plate belt must end before the first collector drop');
for(let x=2;x<ptEnd;x++)belt(x,0,4);belt(ptEnd,0,8);
// Top collector O1 from its first drop to the exit tile at (last,0), fed from behind.
const o1Start=Math.min(...topDrop);for(let x=o1Start;x<last;x++)belt(x,0,4);
// exit 'bottom' (stack halves): the top collector climbs down the last column instead, and the exit is (last,13).
const exitBelt=variant.exit==='bottom'?(belt(last,0,8),dive(last,1,8,'input'),dive(last,6,8,'output'),belt(last,7,8),dive(last,8,8,'input'),dive(last,12,8,'output'),null):belt(last,0,4);
// Bottom copper: entrance (0,13), plate belt to its last pick, which turns north into its arm.
const botPick=[...touch.bottom].filter(([,a])=>a==='pick').map(([c])=>c),botDrop=[...touch.bottom].filter(([,a])=>a==='drop').map(([c])=>c);
const pbEnd=Math.max(...botPick);assert(pbEnd<Math.min(...botDrop));
// In a stack the shared row must read the same from both halves, so its plate belt ends facing east into an empty tile.
if(variant.exit==='bottom')assert(Math.min(...botDrop)>pbEnd+1,'the shared plate belt needs an empty tile after it');
entrance['copper-plate:lower']=belt(0,13,4);for(let x=1;x<pbEnd;x++)belt(x,13,4);belt(pbEnd,13,variant.exit==='bottom'?4:0);
// Bottom collector O2 from its first drop east, then up the last column to side-load the exit tile from the south:
// (last,13) turns north, underground (last,12)->(last,8), surface (last,7), underground (last,6)->(last,1).
const o2Start=Math.min(...botDrop);for(let x=o2Start;x<last;x++)belt(x,13,4);
const bottomExit=variant.exit==='bottom'?belt(last,13,4):(belt(last,13,0),dive(last,12,0,'input'),dive(last,8,0,'output'),belt(last,7,0),dive(last,6,0,'input'),dive(last,1,0,'output'),null);
// Plastic: entrance (0,5) turns south at (1,5) and side-loads the start of X1 (1,6) from the north (north lane); the
// one-tile stub (1,7) facing north is the second side input that keeps (1,6) a straight tile (not a curve).
entrance['plastic-bar']=belt(0,5,4);belt(1,5,8);belt(1,7,0);
// Aisle belts: surface where an arm touches them, underground across substation holes and across untouched runs of
// four or more columns. The last tile turns away from the climbing collector (X1 north, X2 south): a dead end.
function aisle(y,name,start,end,endDir){
 const t=touch[name];
 const absent=new Set([...holeCols].filter(c=>c>start&&c<end));
 // untouched runs of 4+ columns: bury the inner ones
 let run=[];const flush=()=>{if(run.length>=4)for(const c of run.slice(1,-1))absent.add(c);run=[];};
 for(let c=start+1;c<end;c++){if(!t.has(c)&&!holeCols.has(c)&&!ugEnds.has(c))run.push(c);else flush();}flush();
 const tiles=[];let c=start;
 while(c<=end){
  if(absent.has(c+1)&&c+1<=end){
   let q=c+1;while(absent.has(q+1))q++;const exitC=q+1;
   assert(exitC-c<=7,`underground too long on ${name} ${c}->${exitC}`);
   assert(holeCols.has(c+1)||t.get(c)!=='drop'&&t.get(exitC)!=='drop',`drop on an underground end ${name} ${c}/${exitC}`);
   tiles.push(dive(c,y,4,'input'),dive(exitC,y,4,'output'));c=exitC+1;
  }else{tiles.push(c===end?belt(c,y,endDir):belt(c,y,4));c++;}
 }
 for(const [col] of t)assert(at(col,y)&&/belt/.test(at(col,y).name),`${name} has no belt under its arm at ${col}`);
 return tiles;
}
aisle(6,'X1',1,last-1,0);
const x2Start=Math.min(...touch.X2.keys());assert(x2Start>=2);
aisle(7,'X2',x2Start,last-1,8);

// ---------- recipe split between the two copper entrances ----------
const cablePerCopper=raw.recipe['copper-cable'].results[0].amount/raw.recipe['copper-cable'].ingredients[0].amount;
const lowerCopper=variant.bottomCableMinute/cablePerCopper,upperCopper=required['copper-plate']-lowerCopper;
assert(lowerCopper<=variant.bottomCable*perMachine('copper-cable')/cablePerCopper+1e-9,'bottom cable machines cannot use the lower copper');
const pairCopper=variant.pairs*perMachine('copper-cable')/cablePerCopper;
if(!variant.module&&!variant.chain)assert(upperCopper>=pairCopper-1e-9&&upperCopper<=(variant.pairs+variant.topCable)*perMachine('copper-cable')/cablePerCopper+1e-9,'upper copper out of range');

// A stack half: write its entities (no panels, no power) for stack.mjs and stop.
if(variant.module){
 const moduleOut=flag('module-out');assert(moduleOut,'--module-out file required for a module variant');
 await fs.writeFile(moduleOut,JSON.stringify({variant:variantName,width,entities,entrances:Object.fromEntries(Object.entries(entrance).map(([k,e])=>[k,e.entity_number])),exit:bottomExit.entity_number,machineCounts,required,upperCopper,lowerCopper,target,holes:variant.holes,armRoles},null,1));
 console.log(JSON.stringify({module:variantName,width,machineCounts,required,upperCopper,lowerCopper,target}));process.exit(0);
}
// ---------- ports and labels ----------
const port=(kind,item,e,extra)=>{const p={kind,label:item,items:[item],item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},...extra};ports.push(p);return p;};
const fmt=n=>String(Math.round(n*10)/10);
const inputSpecs=[['copper-plate:upper','copper-plate',upperCopper,[0,0]],['iron-plate','iron-plate',required['iron-plate'],[0,3]],['plastic-bar','plastic-bar',required['plastic-bar'],[0,4]],['copper-plate:lower','copper-plate',lowerCopper,[0,12]]];
const inputPorts=inputSpecs.map(([k,item,perMinute,spot])=>({p:port('input',item,entrance[k],{externalSide:'west',direction:4,perMinute}),spot}));
const outputPort=port('output',product,exitBelt,{externalSide:'east',direction:4,transport:'belt',cap:exitCap});
for(const {p,spot:[x,y]} of inputPorts){const e=add('display-panel',x,y,{icon:{type:'item',name:p.item},text:`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min at nominal target`,always_show:true});p.displayEntity=e.entity_number;}
ports.push({kind:'power',label:'External electricity',items:[]});

// ---------- power: substations in the aisle holes ----------
for(const c of variant.holes)for(const [x,y] of [[c,6],[c+1,6],[c,7],[c+1,7]])assert(!at(x,y),'substation hole must be free '+x+','+y);
const before=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
const power=powerWithinLayout({entities,wires,next,place:e=>place(e)},ports,raw,{within:before});
next=Math.max(...entities.map(e=>e.entity_number))+1;
const footprint=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
assert.deepEqual(footprint,before,'power must not grow the rectangle');assert.equal(power.mediumPoles,0);
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

// ---------- blueprint ----------
const count=n=>entities.filter(e=>e.name===n).length;
const description=`Official 2.1.24 Space Age; ${machineCounts[product]} assembling machine 2 on advanced circuits, ${machineCounts['electronic-circuit']} on electronic circuits and ${machineCounts['copper-cable']} on copper cable; no modules, no beacons; red belts, fast, long-handed and bulk inserters, ${power.substations} substations. WEST: copper plates ${fmt(upperCopper)}/min (row 1, top plate belt), iron plates ${fmt(required['iron-plate'])}/min (row 2, top plate belt), plastic bars ${fmt(required['plastic-bar'])}/min (row 5, aisle) and copper plates ${fmt(lowerCopper)}/min (row 13, bottom plate belt); each may arrive on both lanes. EAST: one red belt exit on row 0, ${fmt(target)} advanced circuits/min. Keep the plate filters, the bulk arms between each cable machine and its circuit machine, the stub at (1,7), the underground pairs and the dead ends at the east ends of the belts. Supply electricity at any substation.`;
const bp={item:'blueprint',version:562954249961472,label:`Advanced-circuit supplier · ${fmt(target)}/min`,description,entities,wires,icons:[{index:1,signal:{type:'item',name:product}}]};
// zlib's compressed bytes differ between builds (the Linux CI runner and this Mac give different strings for the same
// JSON). Keep the committed string when it decodes to exactly this blueprint, so its SHA-256 and native report stay valid.
const json=JSON.stringify({blueprint:bp});
const committed=await fs.readFile(out+'/'+id+'.txt','utf8').then(s=>s.trim(),()=>null);
const decodes=text=>{try{return inflateSync(Buffer.from(text.slice(1),'base64')).toString('utf8')===json;}catch{return false;}};
const code=committed&&decodes(committed)?committed:encodeBlueprint({blueprint:bp});
// Status comes only from a full-protocol report for this exact string in the output folder.
let status='unverified',measured;
try{const report=JSON.parse(await fs.readFile(out+'/native-report.json','utf8'));const r=report.builds?.find(b=>b.blueprintSha256===sha(code));
 if(r&&!report.short){status=r.passed&&report.passed?'qualified':'not-qualified';const mm=report.protocolMinutes.measureMinutes;
  measured={steadyPerMinute:r.outputsPerMinute[product],recoveryPerMinute:r.recovery?.outputsPerMinute?.[product],blockedExitStock:r.blocked?.collectionPauseStock?.[0]?.count,reportCreatedAt:report.createdAt,
   exitLanesPerMinute:{north:r.outputPorts[0].collectedByLane[0]/mm,south:r.outputPorts[0].collectedByLane[1]/mm},
   inputsPerMinute:r.inputs.map(p=>({item:p.item,entity:p.entity,perMinute:p.perMinute,measuredPerMinute:p.measuredPerMinute})),
   underfed:r.underfed&&{feedScale:r.underfed.feedScale,steadyPerMinute:r.underfed.steadyPerMinute?.[product],recoveryPerMinute:r.underfed.recoveryPerMinute?.[product]}};}}catch{}
const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,count(n)]));
const manifest={
 id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'rate',status,...(measured?{measured}:{}),
 variant:variantName,layout:variant,
 products:[product],targets:{[product]:target},outputCaps:{[product]:exitCap},
 targetDerivation:{rule:'advanced circuits used by the six ground science packs at 30/min each (directly and through every sub-recipe), rounded up to whole assembling machine 2',sciencePacksPerMinute:30,demandPerMinute,demandByChain:Object.fromEntries(Object.entries(demandBy).sort()),perMachinePerMinute:perMachine(product),machines:redMachines},
 recipeAudit:{externalPerMinute:required,craftsPerMinute:crafts,machinesExact,recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,raw.recipe[n].ingredients]))},
 inputs:ports.filter(p=>p.kind==='input'),fluids:[],outputs:ports.filter(p=>p.kind==='output'),ports,
 machineCounts,footprint,tiles:footprint.width*footprint.height,tilesPerUnitPerMinute:Math.round(footprint.width*footprint.height/target*1000)/1000,
 loopControl:[],stockControl:{mode:'belt-exit',exit:exitBelt.entity_number,cap:exitCap},
 armRoles,protocol,construction,entityCount:entities.length,
 setupNotes:[description,`Belt the exit east to the advanced-circuit entrances of the consumers. The exit holds ${exitCap} circuits when nothing takes them, and every machine then stops.`,'Feed each entrance at least its panel figure; extra plates and plastic back up on the entrance belts.'],
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/'+id+'.txt',code+'\n');
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,variant:variantName,out,footprint,area:footprint.width*footprint.height,target,machineCounts,required,upperCopper,lowerCopper,construction,substations:power.substations,blueprintSha256:manifest.blueprintSha256}));
