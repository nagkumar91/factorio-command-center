// Low-density structure supply factory for the compact six-pack tier (flight-save 2.1.24 recipes).
// Pure layout code: no file access. generate.mjs and the tests import it.
import assert from 'node:assert/strict';
import {powerStarterLayout,starterBounds} from '../../../science-factory/local-ports/compact-shared-layout.mjs';

export const id='low-density-structure-supply';
export const product='low-density-structure';
export const targetPerMinute=60;
export const familyPrototypeSha256='33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f';
export const description='One inlet per material on the left; collect the output on the right. AM2, fast inserters, red belts, no modules, no circuit dependency. Copper plates arrive on both lanes of one belt; a splitter gives each assembler row its own copper lane. Steel (north lane) and plastic (south lane) share the middle belt. Finished structures leave on the far lane of each outer belt and two filtered inserters fill the collection chest.';

const N=0,E=4,S=8,W=12;
const ceilTo=(v,step=1)=>Math.ceil(v/step-1e-9)*step;

/** Recipe arithmetic from the prototype data: machines rounded up, per-minute figures for the inlets. */
export function recipeFigures(raw){
 const recipe=raw.recipe[product],am2=raw['assembling-machine']['assembling-machine-2'];
 assert(recipe&&am2,'prototype data lacks the recipe or the assembler');
 assert.equal(recipe.results.length,1);assert.equal(recipe.results[0].name,product);
 assert(recipe.categories?.some(c=>am2.crafting_categories.includes(c))??am2.crafting_categories.includes(recipe.category||'crafting'));
 const perMachine=recipe.results[0].amount*am2.crafting_speed*60/recipe.energy_required;
 const machines=ceilTo(targetPerMinute/perMachine);
 const crafts=targetPerMinute/recipe.results[0].amount;
 const inputs=Object.fromEntries(recipe.ingredients.map(i=>[i.name,crafts*i.amount]));
 const lanePerMinute=raw['transport-belt']['fast-transport-belt'].speed*3600*4;// tiles per tick x 3600 ticks per minute x 4 items per lane per tile
 return {recipe:{energy:recipe.energy_required,ingredients:recipe.ingredients,results:recipe.results},craftingSpeed:am2.crafting_speed,perMachine,machines,inputs,lanePerMinute};
}

function grid(){
 const entities=[],occupied=new Map();let next=1;
 const key=(x,y)=>`${x},${y}`;
 function add(name,x,y,extra={},w=1,h=1,cx=x+w/2,cy=y+h/2){
  for(let a=x;a<x+w;a++)for(let b=y;b<y+h;b++){assert(!occupied.has(key(a,b)),`overlap ${name} at ${a},${b} with ${occupied.get(key(a,b))}`);occupied.set(key(a,b),name);}
  const e={entity_number:next++,name,position:{x:cx,y:cy},...extra};entities.push(e);return e;
 }
 return {entities,occupied,key,add};
}

/**
 * Two rows of `n` assemblers sharing one middle belt (steel lane, plastic lane).
 * Outer belts: copper on the lane next to the row, finished structures on the far lane.
 * Returns the entry tiles the feed network must reach.
 */
function rowPair(g,y0,n,machine,arm,belt,start=-4){
 const end=3*n-1;// first column east of the last assembler
 for(let i=0;i<n;i++){
  const cx=3*i;
  machine(cx-1,y0+2);arm(cx-1,y0+1,N);arm(cx,y0+1,S);arm(cx-1,y0+5,S);// copper in, structure out, steel/plastic in
  machine(cx-1,y0+8);arm(cx-1,y0+11,S);arm(cx,y0+11,N);arm(cx-1,y0+7,N);
 }
 // Outer belts start one tile behind the copper side-load so it lands on one lane only.
 for(let x=start;x<end;x++){belt(x,y0,E);belt(x,y0+12,E);}
 for(let x=-1;x<=3*(n-1)-1;x++)belt(x,y0+6,E);
 belt(end,y0,S);for(let y=y0+1;y<=y0+4;y++)belt(end,y,S);
 belt(end,y0+12,N);for(let y=y0+8;y<=y0+11;y++)belt(end,y,N);
 (g.pairs||=[]).push({y0,n,end});
 return {end,topSideload:{x:-3,y:y0+1},bottomSideload:{x:-3,y:y0+11},junction:{x:-2,y:y0+6}};
}

/** Screening alternative: two rows of ten with a separate copper column west of the junction, 35 x 13. */
function twinRowsWide(g,ctx){
 const {belt,arm,machine,splitter,underground,input,output}=ctx;
 const pair=rowPair(g,0,10,machine,arm,belt,-4);
 belt(-2,6,E);
 input('steel-plate',-5,5);belt(-4,5,E);belt(-3,5,E);belt(-2,5,S);
 input('plastic-bar',-5,7);belt(-4,7,E);belt(-3,7,E);belt(-2,7,N);
 input('copper-plate',-5,10);splitter(-4,9,E);
 belt(-3,9,N);underground(-3,8,N,'input');underground(-3,2,N,'output');belt(-3,1,N);
 belt(-3,10,S);belt(-3,11,S);
 output(pair.end,6,[{x:pair.end,y:5,d:N},{x:pair.end,y:7,d:S}]);
 return {panels:{'copper-plate':{x:-5,y:11},'steel-plate':{x:-5,y:4},'plastic-bar':{x:-5,y:8},[product]:{x:pair.end-1,y:6}}};
}

/**
 * The selected arrangement: two rows of ten, 34 x 13. The copper tunnel runs under the steel/plastic junction
 * in column -2, so the copper side-loads, the junction and the tunnel share one column.
 */
function twinRows(g,ctx){
 const {belt,arm,machine,splitter,underground,input,output}=ctx;
 const pair=rowPair(g,0,10,machine,arm,belt,-3);
 belt(-2,6,E);
 input('steel-plate',-4,5);belt(-3,5,E);belt(-2,5,S);
 input('plastic-bar',-4,7);belt(-3,7,E);belt(-2,7,N);
 input('copper-plate',-4,10);splitter(-3,9,E);
 belt(-2,9,N);underground(-2,8,N,'input');underground(-2,2,N,'output');belt(-2,1,N);
 belt(-2,10,S);belt(-2,11,S);
 output(pair.end,6,[{x:pair.end,y:5,d:N},{x:pair.end,y:7,d:S}]);
 return {panels:{'copper-plate':{x:-4,y:11},'steel-plate':{x:-4,y:4},'plastic-bar':{x:-4,y:8},[product]:{x:pair.end-1,y:6}}};
}

/** Pair feed network shared by both arrangements: copper splitter and tunnel, steel/plastic junction. */
function pairFeed(ctx,y0){
 const {belt,splitter,underground}=ctx;
 belt(-2,y0+6,E);
 belt(-4,y0+5,E);belt(-3,y0+5,E);belt(-2,y0+5,S);
 belt(-4,y0+7,E);belt(-3,y0+7,E);belt(-2,y0+7,N);
 splitter(-4,y0+9,E);
 belt(-3,y0+9,N);underground(-3,y0+8,N,'input');underground(-3,y0+2,N,'output');belt(-3,y0+1,N);
 belt(-3,y0+10,S);belt(-3,y0+11,S);
}

/**
 * Screening alternative: four rows of five, two stacked row pairs. One splitter per material feeds both pairs;
 * each pair keeps its own outlet chest (two chests), which already departs from the family's single chest.
 */
function stackedRows(g,ctx){
 const {belt,splitter,underground,input,output,arm,machine}=ctx;
 const a=rowPair(g,0,5,machine,arm,belt),b=rowPair(g,13,5,machine,arm,belt);
 pairFeed(ctx,0);pairFeed(ctx,13);
 // Steel: splitter rows 5-6; vertical in column -6 down to the lower pair.
 input('steel-plate',-12,5);for(let x=-11;x<=-8;x++)belt(x,5,E);splitter(-7,5,E);belt(-6,5,E);belt(-5,5,E);
 belt(-6,6,S);for(let y=7;y<=17;y++)belt(-6,y,S);belt(-6,18,E);belt(-5,18,E);
 // Plastic: splitter rows 7-8; the upper branch tunnels under the steel column, the lower runs down column -8.
 input('plastic-bar',-12,7);for(let x=-11;x<=-10;x++)belt(x,7,E);splitter(-9,7,E);belt(-8,7,E);underground(-7,7,E,'input');underground(-5,7,E,'output');
 belt(-8,8,S);for(let y=9;y<=19;y++)belt(-8,y,S);belt(-8,20,E);for(let x=-7;x<=-5;x++)belt(x,20,E);
 // Copper: splitter rows 10-11; the upper branch tunnels under both columns, the lower runs down column -10.
 input('copper-plate',-12,10);splitter(-11,10,E);belt(-10,10,E);underground(-9,10,E,'input');underground(-5,10,E,'output');
 belt(-10,11,S);for(let y=12;y<=22;y++)belt(-10,y,S);belt(-10,23,E);for(let x=-9;x<=-5;x++)belt(x,23,E);
 output(a.end,6,[{x:a.end,y:5,d:N},{x:a.end,y:7,d:S}]);output(b.end,19,[{x:b.end,y:18,d:N},{x:b.end,y:20,d:S}]);
 return {panels:{'copper-plate':{x:-12,y:11},'steel-plate':{x:-12,y:4},'plastic-bar':{x:-12,y:8},[product]:[{x:a.end-1,y:6},{x:b.end-1,y:19}]}};
}

export function buildBlueprint(raw,variant='twin-rows'){
 const figures=recipeFigures(raw);
 const g=grid(),ports=[],counts={},panelsAt={};
 const belt=(x,y,d)=>g.add('fast-transport-belt',x,y,{direction:d});
 const arm=(x,y,d,extra={})=>g.add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
 const machine=(x,y)=>{counts[product]=(counts[product]||0)+1;return g.add('assembling-machine-2',x,y,{recipe:product},3,3);};
 const splitter=(x,y,d)=>g.add('fast-splitter',x,y,{direction:d},1,2);
 const underground=(x,y,d,type)=>g.add('fast-underground-belt',x,y,{direction:d,type});
 const filter=n=>({use_filters:true,filters:[{index:1,name:n,quality:'normal',comparator:'='}]});
 const input=(item,x,y)=>{const e=belt(x,y,E);ports.push({kind:'input',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:E,externalSide:'west',perMinute:figures.inputs[item]});return e;};
 const output=(x,y,arms)=>{const c=g.add('steel-chest',x,y,{bar:2});for(const a of arms)arm(a.x,a.y,a.d,filter(product));ports.push({kind:'output',label:product,items:[product],entity:c.entity_number,x:c.position.x,y:c.position.y,externalSide:'east',perMinute:targetPerMinute});return c;};
 const ctx={belt,arm,machine,splitter,underground,input,output};
 const layout=({'twin-rows':twinRows,'twin-rows-wide':twinRowsWide,'stacked-rows':stackedRows})[variant];assert(layout,'unknown variant '+variant);
 const {panels}=layout(g,ctx);
 assert.equal(counts[product],figures.machines,'assembler count must match the recipe arithmetic');
 // Display panels sit beside their port inside the rectangle, placed before power so poles avoid them.
 const used={};for(const p of ports){let q=panels[p.items[0]];if(Array.isArray(q))q=q[used[p.items[0]]=(used[p.items[0]]??-1)+1];const e=g.add('display-panel',q.x,q.y,{icon:{type:'item',name:p.items[0]},text:`${p.kind}: ${p.label} ${p.perMinute}/min`,always_show:true});p.displayEntity=e.entity_number;}
 ports.push({kind:'power',label:'External electricity',items:[],entity:0,x:0,y:0});
 const bp={item:'blueprint',version:562954249961472,label:`${id} · ${targetPerMinute}/min`,description,entities:g.entities,wires:[],icons:[{index:1,signal:{type:'item',name:product}}]};
 const before=starterBounds(bp.entities,raw);
 powerStarterLayout(bp,ports,raw);
 const footprint=starterBounds(bp.entities,raw);
 assert.deepEqual(footprint,before,'power must not grow the rectangle');
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 return {bp,ports,counts,footprint,figures,laneChecks:laneChecks(bp,g.pairs)};
}

/** Belt lanes beside the assemblers that must carry one kind of item only (line 1 = left lane, 2 = right lane). */
function laneChecks(bp,pairs){
 const at=(x,y)=>bp.entities.find(e=>e.name==='fast-transport-belt'&&e.position.x===x+.5&&e.position.y===y+.5)?.entity_number;
 const row=(y,from,to)=>{const ids=[];for(let x=from;x<=to;x++){const e=at(x,y);assert(e,`no belt at ${x},${y}`);ids.push(e);}return ids;};
 const checks=[];
 for(const {y0,n} of pairs){
  const last=3*n-2,top=row(y0,-2,last),bottom=row(y0+12,-2,last),middle=row(y0+6,-1,3*(n-1)-1);
  checks.push({name:`row pair ${y0} top belt north lane`,entities:top,line:1,allowed:[product]},{name:`row pair ${y0} top belt south lane`,entities:top,line:2,allowed:['copper-plate']},
   {name:`row pair ${y0} bottom belt north lane`,entities:bottom,line:1,allowed:['copper-plate']},{name:`row pair ${y0} bottom belt south lane`,entities:bottom,line:2,allowed:[product]},
   {name:`row pair ${y0} middle belt north lane`,entities:middle,line:1,allowed:['steel-plate']},{name:`row pair ${y0} middle belt south lane`,entities:middle,line:2,allowed:['plastic-bar']});
 }
 return checks;
}

export function manifestFor({ports,counts,footprint,figures},code,sha,prototypeSha256){
 const inputs=ports.filter(p=>p.kind==='input'),outputs=ports.filter(p=>p.kind==='output');
 return {id,file:id+'.txt',name:`${id} · ${targetPerMinute}/min`,products:[product],targetPerMinute,blueprintSha256:sha(code),prototypeSha256,ports,
  inputs:inputs.map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:E,perMinute:p.perMinute})),
  outputs:outputs.map(p=>({item:product,entity:p.entity,position:{x:p.x,y:p.y},perMinute:targetPerMinute})),
  machineCounts:counts,footprint,loopControl:[],setupNotes:[description],
  recipeArithmetic:{assemblerCraftingSpeed:figures.craftingSpeed,secondsPerCraft:figures.recipe.energy,perAssemblerPerMinute:figures.perMachine,assemblers:figures.machines,inputsPerMinute:figures.inputs,redBeltLanePerMinute:figures.lanePerMinute},
  status:'awaiting-native-validation'};
}
