import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../../blueprints.mjs';
import {powerStarterLayout,starterBounds} from '../../science-factory/local-ports/compact-shared-layout.mjs';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const out=path.join(root,'blueprint-sources/flight-science-sided/compact');
const bytes=await fs.readFile(path.join(root,'.cache/flight-21/script-output/data-raw-dump.json'));
const raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
const entities=[],wires=[],ports=[],loops=[],occupied=new Set(),counts={},blocks=[];
let next=1;
function add(name,x,y,extra={}){
 const r=name==='assembling-machine-2'?1:0;
 for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++){
  assert(!occupied.has(`${a},${b}`),`collision ${name} ${a},${b}`);occupied.add(`${a},${b}`);
 }
 const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);return e;
}
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
const condition=(item,n)=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:n}});
const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
const wire=(a,b)=>wires.push([a.entity_number,1,b.entity_number,1]);
const at=(x,y)=>entities.find(e=>e.position.x===x+.5&&e.position.y===y+.5);
const rep=(n,r)=>Array(n).fill(r);
function input(item,rate,x,y,block){const inlet=belt(x,y,4);ports.push({kind:'input',label:`${item} · ${block}`,items:[item],entity:inlet.entity_number,x:inlet.position.x,y:inlet.position.y,direction:4,externalSide:'west',perMinute:rate,block});return inlet;}
function machine(recipe,x,y){counts[recipe]=(counts[recipe]||0)+1;return add('assembling-machine-2',x,y,{recipe});}
function arm(x,y,d,item,loop,limit){const a=add('fast-inserter',x,y,{direction:d,override_stack_size:1,...(item?filter(item):{}),...(loop?{control_behavior:condition(item,limit)}:{})});if(loop){wire(a,loop);return a.entity_number;}return a;}
function ring(name,W,H,Y,limits,X=0){
 const belts=[];for(let x=0;x<=W;x++)belts.push(belt(X+x,Y,x===W?8:4));
 for(let y=1;y<=H;y++)belts.push(belt(X+W,Y+y,y===H?12:8));
 for(let x=W-1;x>=0;x--)belts.push(belt(X+x,Y+H,x===0?0:12));
 for(let y=H-1;y>0;y--)belts.push(belt(X,Y+y,0));
 belts[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
 for(let i=0;i<belts.length;i++)wire(belts[i],belts[(i+1)%belts.length]);
 const control={name,reader:belts[0].entity_number,controlled:[],capacity:belts.length*8,limits};loops.push(control);
 return control;
}
function loopFeed(item,rate,arms,row,Y,control){
 input(item,rate,-7,Y+row,control.name);for(let x=-6;x<=-3;x++)belt(x,Y+row,4);
 add('fast-underground-belt',-2,Y+row,{direction:4,type:'input'});add('fast-underground-belt',2,Y+row,{direction:4,type:'output'});
 if(arms>1){for(let i=0;i<arms;i++)belt(3,Y+row+i,i===arms-1?12:8);for(let i=1;i<arms;i++)belt(2,Y+row+i,0);}
 for(let i=0;i<arms;i++)control.controlled.push(arm(1,Y+row+i,4,item,at(0,Y+row+i),control.limits[item]));
}
function collect(item,W,y){
 arm(W+1,y,12,item);
 if(W<89){for(let x=W+2;x<90;x++){
   if(W===35&&[37,52].includes(x))add('fast-underground-belt',x,y,{direction:4,type:'input'});
   else if(W===35&&[39,54].includes(x))add('fast-underground-belt',x,y,{direction:4,type:'output'});
   else if(!(W===35&&[38,53].includes(x)))belt(x,y,4);
  }arm(90,y,12,item);}
 const chest=add('wooden-chest',91,y,{bar:1});
 ports.push({kind:'output',label:item,items:[item],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,perMinute:60,externalSide:'east'});
}

// Four-pack loop. High-volume iron and coal bypass the mixed-ingredient inlet.
const top=[...rep(7,'automation-science-pack'),'iron-gear-wheel','transport-belt','inserter',...rep(9,'logistic-science-pack'),...rep(7,'military-science-pack'),'iron-gear-wheel'];
const bottom=[...rep(17,'chemical-science-pack'),'iron-gear-wheel','firearm-magazine',...rep(3,'piercing-rounds-magazine'),...rep(6,'grenade')];
const W=89,H=12;
const limits={'copper-plate':36,'steel-plate':20,sulfur:40,coal:240,'stone-wall':40,'electronic-circuit':70,'advanced-circuit':110,'engine-unit':80,'iron-gear-wheel':140,'transport-belt':48,inserter:60,'firearm-magazine':48,'piercing-rounds-magazine':48,grenade:56,'automation-science-pack':32,'logistic-science-pack':32,'chemical-science-pack':64,'military-science-pack':32};
const science=ring('Four-pack block',W,H,0,limits);
for(const [side,recipes]of [['top',top],['bottom',bottom]])for(const [i,recipe]of recipes.entries()){
 const x=4+i*3,y=side==='top'?-3:H+3,ay=side==='top'?-1:H+1,dir=side==='top'?8:0;
 machine(recipe,x,y);for(const dx of [-1,0])arm(x+dx,ay,dir);
 science.controlled.push(arm(x+1,ay,(dir+8)%16,recipe,at(x+1,side==='top'?0:H),limits[recipe]));
}
// Coal travels directly to the grenade end of the bottom row; three arms feed
// the loop immediately before the consumers, with the original stock control.
input('coal',300,-7,1,science.name);for(let x=-6;x<=-3;x++)belt(x,1,4);
add('fast-underground-belt',-2,1,{direction:4,type:'input'});add('fast-underground-belt',2,1,{direction:4,type:'output'});
for(let x=3;x<=W-4;x++)belt(x,1,x===W-4?8:4);
for(let y=2;y<=H-2;y++)belt(W-4,y,y===H-2?4:8);
for(let x=W-3;x<=W-2;x++)belt(x,H-2,4);
for(let x=W-4;x<=W-2;x++)science.controlled.push(arm(x,H-1,0,'coal',at(x,H),limits.coal));
const feeds=[['copper-plate',90],['steel-plate',15],['sulfur',30],['stone-wall',60],['electronic-circuit',60],['advanced-circuit',90],['engine-unit',60]];
for(const [i,[item,rate]]of feeds.entries())loopFeed(item,rate,1,2+i,0,science);
input('iron-plate',660,-7,-6,science.name);const ironTurn=W-1;
for(let x=-6;x<=ironTurn;x++)belt(x,-6,x===ironTurn?8:4);
for(let y=-5;y<=-3;y++)belt(ironTurn,y,8);
add('fast-underground-belt',ironTurn,-2,{direction:8,type:'input'});add('fast-underground-belt',ironTurn,2,{direction:8,type:'output'});
for(let y=3;y<=H-3;y++)belt(ironTurn,y,8);
add('fast-underground-belt',ironTurn,H-2,{direction:8,type:'input'});add('fast-underground-belt',ironTurn,H+2,{direction:8,type:'output'});
for(let y=H+3;y<=H+6;y++)belt(ironTurn,y,y===H+6?12:8);
for(let x=ironTurn-1;x>=3;x--)belt(x,H+6,12);
for(const [side,recipes]of [['top',top],['bottom',bottom]])for(const [i,recipe]of recipes.entries())if(raw.recipe[recipe].ingredients.some(i=>i.name==='iron-plate')){
 const x=4+i*3,y=side==='top'?-5:H+5,d=side==='top'?0:8;
 for(let a=0;a<(['iron-gear-wheel','inserter'].includes(recipe)?2:1);a++)arm(x-a,y,d);
}
const products=['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack','production-science-pack','utility-science-pack'];
for(const [i,item]of products.slice(0,4).entries())collect(item,W,2+i*3);
blocks.push({name:science.name,bounds:{left:-7,top:-6,right:92,bottom:19},products:products.slice(0,4)});

// Purple/yellow loop excludes high-volume rail ingredients. Its rail belt is
// supplied by a separate short production loop immediately to the right.
const Y=28,AW=35,AH=12;
const advancedLimits={'electric-furnace':24,'productivity-module':24,'low-density-structure':70,'processing-unit':50,'flying-robot-frame':24,'production-science-pack':48,'utility-science-pack':48};
const advanced=ring('Purple/yellow block',AW,AH,Y,advancedLimits);
for(let i=0;i<10;i++){
 const x=4+i*3;machine('production-science-pack',x,Y-3);
 for(const dx of [-1,0])arm(x+dx,Y-1,8);
 arm(x,Y-5,0,'rail');
 advanced.controlled.push(arm(x+1,Y-1,0,'production-science-pack',at(x+1,Y),advancedLimits['production-science-pack']));
 machine('utility-science-pack',x,Y+AH+3);
 for(const dx of [-1,0])arm(x+dx,Y+AH+1,0);
 advanced.controlled.push(arm(x+1,Y+AH+1,8,'utility-science-pack',at(x+1,Y+AH),advancedLimits['utility-science-pack']));
}
for(let x=3;x<=50;x++)belt(x,Y-6,12);
for(const [i,[item,rate]]of [['electric-furnace',20],['productivity-module',20],['low-density-structure',60],['processing-unit',40],['flying-robot-frame',20]].entries())loopFeed(item,rate,1,i+1,Y,advanced);
const railLimits={stone:80,'steel-plate':80,'iron-stick':80};
const railLoop=ring('Rail production',15,10,Y,railLimits,38);
for(let i=0;i<4;i++){
 const x=40+i*3;machine('rail',x,Y-3);
 for(const [j,item]of ['stone','steel-plate','iron-stick'].entries())arm(x+j-1,Y-1,8,item);
 arm(x-1,Y-5,8);arm(x,Y-5,8);
}
for(const x of [43,46]){
 machine('iron-stick',x,Y+13);arm(x,Y+15,8,'iron-plate');
 for(const dx of [-1,1])railLoop.controlled.push(arm(x+dx,Y+11,8,'iron-stick',at(x+dx,Y+10),railLimits['iron-stick']));
}
// Two left entrances deliver raw rail ingredients to the short loop without
// adding either item to the purple/yellow ingredient belt.
input('stone',300,-7,20,railLoop.name);
for(let x=-6;x<=36;x++)belt(x,20,x===36?8:4);
add('fast-underground-belt',36,21,{direction:8,type:'input'});add('fast-underground-belt',36,25,{direction:8,type:'output'});
for(let y=26;y<=30;y++)belt(36,y,y===30?4:8);
add('fast-underground-belt',37,30,{direction:4,type:'input'});add('fast-underground-belt',39,30,{direction:4,type:'output'});
for(let x=40;x<=51;x++)belt(x,30,4);
input('steel-plate',300,-7,21,railLoop.name);
for(let x=-6;x<=55;x++){
 if(x===34)add('fast-underground-belt',x,21,{direction:4,type:'input'});
 else if(x===38)add('fast-underground-belt',x,21,{direction:4,type:'output'});
 else if(x<34||x>38)belt(x,21,x===55?8:4);
}
for(let y=22;y<=31;y++)belt(55,y,8);
for(let y=29;y<=31;y++){
 railLoop.controlled.push(arm(y+20,29,8,'stone',at(y+20,28),railLimits.stone));
 railLoop.controlled.push(arm(54,y,4,'steel-plate',at(53,y),railLimits['steel-plate']));
}
input('iron-plate',150,-7,46,railLoop.name);
for(let x=-6;x<=48;x++)belt(x,46,x===48?0:4);
belt(48,45,0);belt(48,44,12);for(let x=42;x<48;x++)belt(x,44,12);
collect('production-science-pack',AW,Y+5);collect('utility-science-pack',AW,Y+8);
blocks.push({name:advanced.name,bounds:{left:-7,top:Y-6,right:36,bottom:47},products:products.slice(4),outputCorridors:[{left:36,right:92,y:Y+5},{left:36,right:92,y:Y+8}]});
blocks.push({name:railLoop.name,bounds:{left:36,top:20,right:56,bottom:47},products:['rail'],externalInputs:[{item:'stone',x:-6.5,y:20.5},{item:'steel-plate',x:-6.5,y:21.5},{item:'iron-plate',x:-6.5,y:46.5}]});

ports.push({kind:'power',label:'Power',items:[],entity:0,x:0,y:0});
const bp={item:'blueprint',version:562954249961472,label:'Compact six science packs · left in / right out · 60/min',entities,wires:[],icons:products.slice(2).map((name,i)=>({index:i+1,signal:{type:'item',name}}))};

for(const p of ports.filter(p=>p.kind!=='power')){
 let x,y;
 if(p.kind==='output'){x=p.x+1-.5;y=p.y+1-.5;}
 else {
  const startY=Math.floor(p.y);let found=false;
  for(let dy=0;dy<4&&!found;dy++)for(let sx=4;sx<20;sx++)if(!occupied.has(`${sx},${startY+dy}`)){x=sx;y=startY+dy;found=true;break;}
  assert(found,'No free input label position');
 }
 const sign=add('display-panel',x,y,{icon:{type:'item',name:p.items[0]},text:`${p.kind==='input'?'IN':'OUT'} ${p.label}: ${p.perMinute}/min (${p.x}, ${p.y})`,always_show:true});
 p.displayEntity=sign.entity_number;
}
powerStarterLayout(bp,[...ports,{kind:'input',x:-8,y:-8}],raw);bp.wires.push(...wires);
for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
bp.description='Six packs at 60/min target. All material entrances on the left; all six collection chests on the right. Finished green/red circuits, engines, processing units, LDS, frames, furnaces and productivity module 1s are external inputs. Iron and steel each have two labeled entrances. No fluids, bots, installed modules or quality bonuses. Keep red wires and stock controls. Factorio 2.1.24 flight-save recipes.';
const code=encodeBlueprint({blueprint:bp}),footprint=starterBounds(bp.entities,raw),id='compact-six-pack-sided-60';
const inputs=ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:p.direction,perMinute:p.perMinute,block:p.block}));
const boundary=Object.fromEntries([...new Set(inputs.map(p=>p.item))].sort().map(item=>[item,inputs.filter(p=>p.item===item).reduce((sum,p)=>sum+p.perMinute,0)]));
assert.deepEqual(boundary,{'advanced-circuit':90,coal:300,'copper-plate':90,'electric-furnace':20,'electronic-circuit':60,'engine-unit':60,'flying-robot-frame':20,'iron-plate':810,'low-density-structure':60,'processing-unit':40,'productivity-module':20,stone:300,'stone-wall':60,'steel-plate':315,sulfur:30});
const manifest={id,name:bp.label,file:id+'.txt',products,targetPerMinute:60,blueprintSha256:sha(code),prototypeSha256:sha(bytes),gameVersion:'2.1.24',ports,footprint,machineCounts:counts,inputs,inputsPerMinute:boundary,outputs:ports.filter(p=>p.kind==='output').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:60})),blocks,loopControl:loops,setupNotes:[bp.description,'Input rates are recipe demand at exactly 60/min each, excluding startup stock. Supply surplus when running above target.'],attribution:'Original local layout derived from the project four-pack sided science generator; advanced two-colour block designed for this task.',verification:'Use the matching native-report.json; generation alone is not proof.'};
await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,id+'.txt'),code+'\n');await fs.writeFile(path.join(out,id+'.json'),JSON.stringify({blueprint:bp},null,2)+'\n');await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,footprint,area:footprint.width*footprint.height,machines:counts,blueprintSha256:manifest.blueprintSha256},null,2));
