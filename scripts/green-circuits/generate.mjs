// Green-circuit supplier: 360 electronic circuits per minute from iron and copper plates.
// Two mirrored rows of `C E C E C` (copper cable, electronic circuit). Cable never touches a belt: the
// outer cable machines hand all their cable to one circuit machine through a bulk arm (hand 2),
// the middle cable machine splits between both neighbours through one fast arm (hand 1) each.
// Published variant `single-aisle` (19 x 9): both rows face one aisle of three rows. The plate belt runs
// along the middle row (copper north lane, iron south lane); every machine takes its plate from it with
// one fast arm. Circuits are dropped on two short tiles of the same row; the plate belt dives under them,
// and the circuit belt leaves for the south arm row, dives under the arms there and ends at the east exit.
// `single-aisle-even-lanes` (20 x 9, history/) is the same aisle with both lanes of the exit equal.
// `twin-belt` (19 x 10, history/) has two full belts in a four-row aisle and long-handed arms. Older
// variants (history/) share one plate belt between the rows and send circuits out on two outer belts.
//
// Pure Node and reproducible: the same variant and raw dump give the same blueprint string.
// Usage: node scripts/green-circuits/generate.mjs [--variant single-aisle|single-aisle-even-lanes|twin-belt|compact|reference] [--out dir]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerWithinLayout} from './power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const variantName=flag('variant',process.env.GC_VARIANT||'single-aisle');
const id='green-circuits',out=flag('out',process.env.GC_OUT||'blueprint-sources/'+id);
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');

// Layout variants. Every variant keeps the same machines and gap arms. The four oldest differ only in how the
// two entrances merge onto the shared input belt (west) and how the two output belts reach the exit (east).
//  west 'column': entrances one column west of the first machine, the merge tile in that machine's column.
//  west 'inline': entrances under the first machine's west column, a curve turns each into a side-load.
//  east 'column': output belts run down/up a column east of the last machine and side-load the exit there
//    (the spec reference; native runs show a side-loaded end tile holds only 6 circuits, not 8).
//  east 'column-straight': as 'column', plus one straight exit tile east of the side-load merge.
//  east 'buried': output belts dive under the last cable machine's east column; side-loaded exit there (6 held).
//  east 'buried-straight': output belts dive under the last cable machine's middle column and side-load a merge
//    tile there; the input belt ends in a dead-end curve so the merge has nothing behind it; the exit is the
//    straight tile in the machine's east column, fed from behind, and holds 8.
const EAST={
 column:{column:19,exit:19,lastCable:17,buried:false},
 'column-straight':{column:19,exit:20,lastCable:17,buried:false},
 buried:{column:18,exit:18,lastCable:16,buried:true},
 'buried-straight':{column:17,exit:18,lastCable:16,buried:true,inputEndTurn:true},
};
const VARIANTS={
 reference:{west:'column',east:'column'},
 'reference-straight-exit':{west:'column',east:'column-straight'},
 'compact-side-loaded-exit':{west:'inline',east:'buried'},
 compact:{west:'inline',east:'buried-straight'},
 // twin-belt: no outer belts. Both machine rows face a middle aisle of two belts: A (plates, y=4) and B
 // (circuits, y=5). Long-handed arms reach across the belt nearer to them. Two substations in holes on row 5..6.
 'twin-belt':{twin:true,substations:2},
 // single-aisle: one aisle of three rows (arm row, belt row, arm row). Plates (P) and circuits (Q) share the
 // aisle: P stays on the middle row and dives under each circuit drop tile; Q leaves the middle row for the
 // south arm row and dives under the arms there. One substation in the only 2x2 hole that reaches every arm.
 // The entrances and the exit are on the same tiles as in twin-belt. Exit lanes: 270/min north, 90/min south.
 'single-aisle':{aisle:'single',merge:'side-load',substations:1},
 // single-aisle-even-lanes: the same aisle, one column wider (20 x 9). The two circuit pairs reach the east end on
 // different rows and side-load one merge tile from opposite sides, so each lane of the exit carries 180/min.
 'single-aisle-even-lanes':{aisle:'single',merge:'opposite-sides',substations:1},
};
const variant=VARIANTS[variantName];assert(variant,'unknown variant '+variantName);const east=EAST[variant.east]||{};

const product='electronic-circuit',target=360,exitCap=8;
const targets={[product]:target},products=[product];
const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10};

// ---------- placement with collision checks ----------
let next=1;const entities=[],wires=[],ports=[],occupied=new Map(),machineCounts={};
const key=(x,y)=>`${x},${y}`;
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function place(e){const p=protoOf(e.name);assert(p,e.name);let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}entities.push(e);return e;}
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra});
const at=(x,y)=>occupied.get(key(x,y));
const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
const fast=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const bulk=(x,y,d,extra={})=>add('bulk-inserter',x,y,{direction:d,override_stack_size:2,...extra});
const long=(x,y,d,extra={})=>add('long-handed-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const columns=[{x:1,recipe:'copper-cable'},{x:5,recipe:product},{x:9,recipe:'copper-cable'},{x:13,recipe:product},{x:17,recipe:'copper-cable'}];
const plateFor=recipe=>recipe==='copper-cable'?'copper-plate':'iron-plate';
let gapArms=[],inputArms=[],outputArms=[],exitBelt,labelSpots;const entrance={};
if(variant.aisle==='single'){
// ---------- single-aisle: machine rows y=0..2 and y=6..8; aisle rows y=3 (arms), y=4 (plate belt P, circuit drop tiles), y=5 (arms, circuit belt Q) ----------
for(const cy of [1,7])for(const c of columns){
 add('assembling-machine-2',c.x,cy,{position:{x:c.x+.5,y:cy+.5},recipe:c.recipe});machineCounts[c.recipe]=(machineCounts[c.recipe]||0)+1;
}
for(const cy of [1,7])gapArms.push(bulk(3,cy,12),fast(7,cy,4),fast(11,cy,12),bulk(15,cy,4));
const even=variant.merge==='opposite-sides';
// Every machine takes its plate through one filtered fast arm from the plate belt on row 4: the top row's arms
// on row 3, the bottom row's on row 5, both in the same column, so one belt tile serves two machines.
const plateX=even?[2,4,9,12,16]:[2,4,9,14,16];
plateX.forEach((x,c)=>{const item=plateFor(columns[c].recipe);inputArms.push(fast(x,3,8,filter(item)),fast(x,5,0,filter(item)));}); // direction = the side picked from
// Every circuit machine drops through one fast arm onto a circuit tile on row 4, one column from its plate tile.
for(const x of [5,13])outputArms.push(fast(x,3,0),fast(x,5,8));
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d}),dive=(x,y,d,type)=>add('fast-underground-belt',x,y,{direction:d,type});
// Entrances as in twin-belt, on the same tiles: copper (0,3) and iron (0,5) turn onto (1,4) from opposite sides,
// one lane each.
entrance['copper-plate']=belt(0,3,4);belt(1,3,8);entrance['iron-plate']=belt(0,5,4);belt(1,5,0);
// Plate belt P on row 4: surface (1..3), then under the west circuit tiles and the substation (4 -> 9).
for(const x of [1,2,3])belt(x,4,4);
dive(4,4,4,'input');dive(9,4,4,'output');
// Circuit belt Q, west pair: drop tile (5,4), down the free column 6 to row 5, east under the middle cable
// machine's arm (8 -> 10).
belt(5,4,4);belt(6,4,8);belt(6,5,4);belt(7,5,4);dive(8,5,4,'input');dive(10,5,4,'output');
if(!even){
 // P dives again under the east circuit tiles (10 -> 14), then one surface tile and a dead-end curve at (16,4)
 // facing the last copper arm on row 3, away from the exit.
 dive(10,4,4,'input');dive(14,4,4,'output');belt(15,4,4);belt(16,4,0);
 // East pair: drop tile (13,4) runs WEST to the gap column 11 and side-loads the merge tile (11,5) from the
 // north. From there Q dives under the east arms (12 -> 17) to the exit (18,5), a straight tile fed from
 // behind, which holds 8 when blocked. The exit is on the same tile as in twin-belt.
 belt(11,5,4);belt(13,4,12);belt(12,4,12);belt(11,4,8);
 dive(12,5,4,'input');dive(17,5,4,'output');exitBelt=belt(18,5,4);
}else{
 // Even lanes, one column wider: the west pair stays on row 5 (10 -> 11 -> 17 underground) and turns north at
 // (18,5); the east pair goes up the free column 14 to row 3, under the last arm (15 -> 17) and turns south at
 // (18,3). Both side-load the merge tile (18,4) from opposite sides, one pair per lane; the exit (19,4) is fed
 // from behind. P dives under the east circuit tiles (12 -> 15) and ends in the dead-end curve at (16,4).
 belt(10,4,4);belt(11,4,4);dive(12,4,4,'input');dive(15,4,4,'output');belt(16,4,0);
 dive(11,5,4,'input');dive(17,5,4,'output');belt(18,5,0);
 belt(13,4,4);belt(14,4,0);belt(14,3,4);dive(15,3,4,'input');dive(17,3,4,'output');belt(18,3,8);
 belt(18,4,4);exitBelt=belt(19,4,4);
 assert(!at(17,4),'the merge tile must have nothing behind it');
}
for(const [x,y] of [[7,3],[8,3],[7,4],[8,4]])assert(!at(x,y),'substation hole must be free');
assert.equal(at(16,4).direction,0,'the plate belt ends in a curve, not toward a circuit belt');
labelSpots={'copper-plate':[3,3],'iron-plate':[3,5]};
}else if(variant.twin){
// ---------- twin-belt: machine rows y=0..2 and y=7..9, belts A (y=4) and B (y=5) in the aisle ----------
for(const cy of [1,8])for(const c of columns){
 add('assembling-machine-2',c.x,cy,{position:{x:c.x+.5,y:cy+.5},recipe:c.recipe});machineCounts[c.recipe]=(machineCounts[c.recipe]||0)+1;
}
// Gap arms as in every variant: bulk (hand 2) at the outer cable machines, fast (hand 1) at the middle one.
for(const cy of [1,8])gapArms.push(bulk(3,cy,12),fast(7,cy,4),fast(11,cy,12),bulk(15,cy,4));
// Top arm row y=3 (belt A below it): one filtered fast arm per machine takes its plate from A;
// two long-handed arms per circuit machine reach over A and drop circuits on B.
for(const [x,c] of [[2,0],[6,1],[9,2],[14,3],[18,4]])inputArms.push(fast(x,3,8,filter(plateFor(columns[c].recipe)))); // direction = the side picked from
for(const x of [4,5,12,13])outputArms.push(long(x,3,0));
// Bottom arm row y=6 (belt B above it): two filtered long-handed arms per machine reach over B and take
// plates from A; one fast arm per circuit machine drops circuits on B.
for(const x of [1,2,5,6,9,10,13,14,17,18]){const c=columns.find(c=>Math.abs(c.x-x)<=1);inputArms.push(long(x,6,0,filter(plateFor(c.recipe))));}
for(const x of [4,12])outputArms.push(fast(x,6,8));
// Entrances: copper (0,3) east -> (1,3) south and iron (0,5) east -> (1,5) north both side-load A at (1,4):
// copper onto the north lane, iron onto the south lane.
entrance['copper-plate']=add('fast-transport-belt',0,3,{direction:4});add('fast-transport-belt',1,3,{direction:8});
entrance['iron-plate']=add('fast-transport-belt',0,5,{direction:4});add('fast-transport-belt',1,5,{direction:0});
// Belt A: (1..17,4) east, ending in a dead-end curve at (18,4) facing north into the last copper arm, so
// plates never reach belt B or the exit.
for(let x=1;x<=17;x++)add('fast-transport-belt',x,4,{direction:4});add('fast-transport-belt',18,4,{direction:0});
// Belt B: (4..18,5) east, buried under the two substation holes (7..8,5..6) and (15..16,5..6). The exit (18,5)
// is a straight tile fed from behind by the underground exit at (17,5), so it holds 8 circuits when blocked.
for(const x of [4,5,10,11,12,13])add('fast-transport-belt',x,5,{direction:4});
add('fast-underground-belt',6,5,{direction:4,type:'input'});add('fast-underground-belt',9,5,{direction:4,type:'output'});
add('fast-underground-belt',14,5,{direction:4,type:'input'});add('fast-underground-belt',17,5,{direction:4,type:'output'});
exitBelt=add('fast-transport-belt',18,5,{direction:4});
for(const [x,y] of [[7,5],[8,5],[7,6],[8,6],[15,5],[16,5],[15,6],[16,6]])assert(!at(x,y),'substation hole must be free');
assert.equal(at(18,4).direction,0,'belt A ends in a curve away from the exit');
labelSpots={'copper-plate':[0,4],'iron-plate':[0,6]};
}else{

// ---------- machines: two mirrored rows C E C E C ----------
const rows=[{cy:3,armY:5,pick:8,outArmY:1,outBeltY:0,outPick:8},{cy:9,armY:7,pick:0,outArmY:11,outBeltY:12,outPick:0}];
const inputY=6;
const firstCable=variant.west==='inline'?2:1;           // (1,5)/(1,7) carry the entrance curves in the inline west
const lastCable=east.lastCable;                          // the input belt must end west of the merge tile
const pickX={1:firstCable,5:5,9:10,13:13,17:lastCable};  // the middle cable machine picks beside the substation hole
const machines=[];
for(const row of rows)for(const c of columns){
 const m=add('assembling-machine-2',c.x,row.cy,{position:{x:c.x+.5,y:row.cy+.5},recipe:c.recipe});
 machines.push({entity:m,row,col:c});machineCounts[c.recipe]=(machineCounts[c.recipe]||0)+1;
}
// Gap arms: direction is the side the arm picks from. Outer cable -> circuit: bulk (hand 2, 180/min).
// Middle cable -> each circuit: fast (hand 1, 90/min). The hand sizes fix the 2:1 cable split.
for(const row of rows){
 gapArms.push(bulk(3,row.cy,12),fast(7,row.cy,4),fast(11,row.cy,12),bulk(15,row.cy,4));
}
// Input arms: one filtered fast arm per machine from the shared input belt.
for(const row of rows)for(const c of columns)inputArms.push(fast(pickX[c.x],row.armY,row.pick,filter(c.recipe==='copper-cable'?'copper-plate':'iron-plate')));
// Output arms: one fast arm per circuit machine onto the row's outer belt.
for(const row of rows)for(const c of columns.filter(c=>c.recipe===product))outputArms.push(fast(c.x,row.outArmY,row.outPick));

// ---------- belts ----------
// A belt path is a list of {x,y,d}; straight runs without pickups/drops are buried (ends at most 6 apart).
const beltTiles=[];
function path(tiles,protectedKeys){
 // Group maximal straight runs of unprotected tiles in the same direction where each tile flows into the next.
 let i=0;
 while(i<tiles.length){
  const t=tiles[i];
  if(protectedKeys.has(key(t.x,t.y))||t.curve){beltTiles.push(t);i++;continue;}
  let j=i;while(j+1<tiles.length){const a=tiles[j],b=tiles[j+1];const [dx,dy]={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]}[a.d];if(b.d!==a.d||b.curve||protectedKeys.has(key(b.x,b.y))||b.x!==a.x+dx||b.y!==a.y+dy)break;j++;}
  // tiles i..j are a straight unprotected run
  let k=i;
  while(k<=j){
   const span=Math.min(6,j-k);
   if(span>=3){tiles[k].ug='input';tiles[k+span].ug='output';beltTiles.push(tiles[k],tiles[k+span]);k+=span+1;}
   else{beltTiles.push(tiles[k]);k++;}
  }
  i=j+1;
 }
}
const exitX=east.exit,columnX=east.column;
// Input belt along y=6, buried under the substation hole (8..9, 5..6).
const inStart=variant.west==='inline'?1:0;
{
 const tiles=[];for(let x=inStart;x<=lastCable;x++){if(x===8||x===9)continue;tiles.push({x,y:inputY,d:x===lastCable&&east.inputEndTurn?0:4,ug:x===7?'input':x===10?'output':undefined});}
 // inputEndTurn: the last tile faces north into an arm, a dead-end curve that never feeds the merge tile east of it.
 for(const t of tiles)beltTiles.push(t);
}
// Output belts.
for(const row of rows){
 const y=row.outBeltY,vertical=row.outBeltY===0?8:0,dir=vertical,sign=vertical===8?1:-1;
 const tiles=[];
 for(let x=5;x<=columnX-1;x++)tiles.push({x,y,d:4});
 tiles.push({x:columnX,y,d:dir,curve:true});
 if(!east.buried)for(let k=1;k<=5;k++)tiles.push({x:columnX,y:y+sign*k,d:dir});
 else tiles.push({x:columnX,y:y+sign,d:dir,ug:'input'},{x:columnX,y:y+sign*5,d:dir,ug:'output'});
 const protectedKeys=new Set(columns.filter(c=>c.recipe===product).map(c=>key(c.x,y)));
 const preset=tiles.filter(t=>t.ug);
 path(tiles.filter(t=>!t.ug),protectedKeys);
 for(const t of preset)beltTiles.push(t);
}
// Entrances and merges.
if(variant.west==='column'){
 // copper (-1,5) east -> (0,5) south -> side-load (0,6) north lane; iron (-1,7) east -> (0,7) north -> (0,6) south lane.
 beltTiles.push({x:-1,y:5,d:4,port:'copper-plate'},{x:0,y:5,d:8},{x:-1,y:7,d:4,port:'iron-plate'},{x:0,y:7,d:0});
}else{
 // copper (0,5) east -> (1,5) south -> side-load (1,6); iron (0,7) east -> (1,7) north -> (1,6).
 beltTiles.push({x:0,y:5,d:4,port:'copper-plate'},{x:1,y:5,d:8},{x:0,y:7,d:4,port:'iron-plate'},{x:1,y:7,d:0});
}
if(columnX!==exitX)beltTiles.push({x:columnX,y:inputY,d:4});
beltTiles.push({x:exitX,y:inputY,d:4,port:'exit'});
for(const t of beltTiles){
 const e=t.ug?add('fast-underground-belt',t.x,t.y,{direction:t.d,type:t.ug}):add('fast-transport-belt',t.x,t.y,{direction:t.d});
 if(t.port==='exit')exitBelt=e;else if(t.port)entrance[t.port]=e;
}
assert(columnX!==exitX||!at(exitX-1,inputY),'a side-loaded exit must have nothing behind it');
if(columnX!==exitX){const behind=at(columnX-1,inputY);assert(!(behind?.name.includes('belt')&&behind.direction===4&&behind.type!=='input'),'the merge tile must have nothing feeding it from behind');}
assert(!at(8,5)&&!at(9,5)&&!at(8,6)&&!at(9,6),'substation hole must be free');
labelSpots=variant.west==='column'?{'copper-plate':[-1,4],'iron-plate':[-1,8]}:{'copper-plate':[3,5],'iron-plate':[3,7]};
}

// ---------- recipe audit from the raw dump ----------
const speed=raw['assembling-machine']['assembling-machine-2'].crafting_speed;
const boundary=new Set(['iron-plate','copper-plate']);
const required={},crafts={};
function expand(item,n){if(boundary.has(item)){required[item]=(required[item]||0)+n;return;}const r=raw.recipe[item];assert(r,item);const made=r.results.find(p=>p.name===item).amount;crafts[item]=(crafts[item]||0)+n/made;for(const i of r.ingredients)expand(i.name,n*i.amount/made);}
expand(product,target);
const machinesExact=Object.fromEntries(Object.entries(crafts).map(([n,c])=>[n,c/(60*speed/(raw.recipe[n].energy_required??.5))]));
for(const [n,c] of Object.entries(machinesExact))assert(machineCounts[n]>=c-1e-9,`${n} needs ${c} machines, built ${machineCounts[n]}`);

// ---------- ports and labels ----------
const port=(kind,item,e,extra)=>{const p={kind,label:item,items:[item],item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},...extra};ports.push(p);return p;};
const fmt=n=>String(Math.round(n*10)/10);
const inputPorts=['copper-plate','iron-plate'].map(item=>port('input',item,entrance[item],{externalSide:'west',direction:4,perMinute:required[item]}));
const outputPort=port('output',product,exitBelt,{externalSide:'east',direction:4,transport:'belt',cap:exitCap});
for(const p of inputPorts){const [x,y]=labelSpots[p.item];const e=add('display-panel',x,y,{icon:{type:'item',name:p.item},text:`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min at nominal target`,always_show:true});p.displayEntity=e.entity_number;}
ports.push({kind:'power',label:'External electricity',items:[]});

// ---------- power: one substation in the hole under the input belt ----------
const before=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
const power=powerWithinLayout({entities,wires,next,place:e=>place(e)},ports,raw,{within:before});
next=Math.max(...entities.map(e=>e.entity_number))+1;
const footprint=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
assert.deepEqual(footprint,before,'power must not grow the rectangle');
assert.equal(power.substations,variant.substations??1);assert.equal(power.mediumPoles,0);
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

// ---------- blueprint ----------
// The non-twin variants keep their original description so their strings stay reproducible (history/).
const exitText=variant.merge==='opposite-sides'?`one red belt exit on row 4, ${target} electronic circuits/min, ${target/2} per lane`:`one red belt exit on row 5, ${target} electronic circuits/min (${target*3/4} on the north lane, ${target/4} on the south lane)`;
const description=variant.aisle==='single'?`Official 2.1.24 Space Age; 10 assembling machine 2 (6 copper cable, 4 electronic circuit), no modules, red belts, fast and bulk inserters, one substation. WEST: copper plates ${fmt(required['copper-plate'])}/min (upper entrance) and iron plates ${fmt(required['iron-plate'])}/min (lower entrance); both may arrive on both lanes, the blueprint side-loads each onto its own lane of the plate belt (row 4). EAST: ${exitText}. Cable is handed machine to machine; keep the bulk arms (hand 2) at the outer cable machines and the fast arms at the middle one: the hand sizes fix the 2:1 cable split. Keep the plate filters on the input arms, the underground belt pairs and the dead-end curve at the east end of the plate belt. Supply electricity at the substation.`:variant.twin?`Official 2.1.24 Space Age; 10 assembling machine 2 (6 copper cable, 4 electronic circuit), no modules, red belts, fast, long-handed and bulk inserters, two substations. WEST: copper plates ${fmt(required['copper-plate'])}/min (upper entrance) and iron plates ${fmt(required['iron-plate'])}/min (lower entrance); both may arrive on both lanes, the blueprint side-loads each onto its own lane of the plate belt (row 4). EAST: one red belt exit on row 5, ${target} electronic circuits/min, one machine row per lane. Cable is handed machine to machine; keep the bulk arms (hand 2) at the outer cable machines and the fast arms at the middle one: the hand sizes fix the 2:1 cable split. Keep the plate filters on the input arms and the dead-end curve at the east end of the plate belt. Supply electricity at either substation.`:`Official 2.1.24 Space Age; 10 assembling machine 2 (6 copper cable, 4 electronic circuit), no modules, red belts, fast and bulk inserters, one substation. WEST: copper plates ${fmt(required['copper-plate'])}/min (upper entrance) and iron plates ${fmt(required['iron-plate'])}/min (lower entrance); both may arrive on both lanes, the blueprint side-loads each onto its own lane of the shared input belt. EAST: one red belt exit, ${target} electronic circuits/min, one row per lane. Cable is handed machine to machine; keep the bulk arms (hand 2) at the outer cable machines and the fast arms at the middle one: the hand sizes fix the 2:1 cable split. Supply electricity at the substation.`;
const bp={item:'blueprint',version:562954249961472,label:'Green-circuit supplier · 360/min',description,entities,wires,icons:[{index:1,signal:{type:'item',name:product}}]};
const code=encodeBlueprint({blueprint:bp});
// Status comes only from a full-protocol report for this exact string in the output folder.
let status='unverified',measured;
try{const report=JSON.parse(await fs.readFile(out+'/native-report.json','utf8'));const r=report.builds?.find(b=>b.blueprintSha256===sha(code));
 if(r&&!report.short){status=r.passed&&report.passed?'qualified':'not-qualified';measured={steadyPerMinute:r.outputsPerMinute[product],recoveryPerMinute:r.recovery?.outputsPerMinute?.[product],blockedExitStock:r.blocked?.collectionPauseStock?.[0]?.count,reportCreatedAt:report.createdAt};
  // Per-lane delivery at the exit (reports made before the harness counted lanes have none).
  const lanes=r.outputPorts?.[0]?.collectedByLane;if(Array.isArray(lanes))measured.exitLanesPerMinute={north:lanes[0]/report.protocolMinutes.measureMinutes,south:lanes[1]/report.protocolMinutes.measureMinutes};}}catch{}
const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length]));
const manifest={
 id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'rate',status,...(measured?{measured}:{}),
 variant:variantName,layout:variant,
 products,targets,outputCaps:{[product]:exitCap},
 recipeAudit:{externalPerMinute:required,craftsPerMinute:crafts,machinesExact,recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,raw.recipe[n].ingredients]))},
 inputs:ports.filter(p=>p.kind==='input'),fluids:[],outputs:ports.filter(p=>p.kind==='output'),ports,
 machineCounts,footprint,areaGoal:{goalTiles:286,stretchTiles:273,baselineTiles:364,achievedTiles:footprint.width*footprint.height},
 loopControl:[],stockControl:{mode:'belt-exit',exit:exitBelt.entity_number,cap:exitCap},
 armRoles:{gap:gapArms.map(e=>e.entity_number),input:inputArms.map(e=>e.entity_number),output:outputArms.map(e=>e.entity_number)},
 protocol,construction,
 setupNotes:[description,variant.merge==='side-load'?`Belt the exit east to the circuit entrances of the consumers. The exit holds ${exitCap} circuits when the consumer stops taking them, and every machine then stops. Sharing one red belt (1,800/min, 900 per lane): side-load the copies onto it from alternating sides, two copies per lane, four copies per belt. Joined lane for lane, three copies fill the north lane (${3*target*3/4} of 900).`:`Belt the exit east to the circuit entrances of the consumers; one red belt carries up to five copies (1,800/min). The exit holds ${exitCap} circuits when the consumer stops taking them, and every machine then stops.`,'Feed plates at or above the listed rates; extra plates simply back up on the entrance belts.'],
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/'+id+'.txt',code+'\n');
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,variant:variantName,out,footprint,area:footprint.width*footprint.height,machineCounts,required,construction,blueprintSha256:manifest.blueprintSha256}));
