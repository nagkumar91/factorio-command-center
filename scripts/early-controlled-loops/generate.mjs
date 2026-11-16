import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
import {powerStarterLayout,starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
const rawPath=process.env.FACTORIO_RAW||'.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const raw=JSON.parse(await fs.readFile(rawPath));
const out='blueprint-sources/early-controlled-loops';await fs.mkdir(out,{recursive:true});
const specs=[
{id:'science-loop',name:'Red + green science',recipes:['iron-gear-wheel','transport-belt','inserter','automation-science-pack','logistic-science-pack'],products:['automation-science-pack','logistic-science-pack'],feeds:['iron-plate','copper-plate','electronic-circuit'],optional:['iron-gear-wheel'],limits:{'iron-plate':40,'copper-plate':16,'electronic-circuit':16,'iron-gear-wheel':24,'transport-belt':8,inserter:8,'automation-science-pack':8,'logistic-science-pack':8}},
{id:'transport-loop',name:'Red belts + undergrounds + splitters',recipes:['iron-gear-wheel','transport-belt','underground-belt','splitter','fast-transport-belt','fast-underground-belt','fast-splitter'],products:['fast-transport-belt','fast-underground-belt','fast-splitter'],feeds:['iron-plate','electronic-circuit'],optional:['iron-gear-wheel'],limits:{'iron-plate':32,'electronic-circuit':20,'iron-gear-wheel':64,'transport-belt':12,'underground-belt':4,splitter:2,'fast-transport-belt':4,'fast-underground-belt':4,'fast-splitter':2}},
{id:'machines-poles-loop',name:'AM2 + medium poles + big poles',recipes:['iron-gear-wheel','assembling-machine-1','assembling-machine-2','copper-cable','iron-stick','medium-electric-pole','big-electric-pole'],products:['assembling-machine-2','medium-electric-pole','big-electric-pole'],feeds:['iron-plate','copper-plate','steel-plate','electronic-circuit'],optional:['copper-cable','iron-stick'],limits:{'iron-plate':32,'copper-plate':16,'steel-plate':20,'electronic-circuit':24,'iron-gear-wheel':24,'copper-cable':24,'iron-stick':24,'assembling-machine-1':2,'assembling-machine-2':2,'medium-electric-pole':4,'big-electric-pole':4}}
];
const version=decodeBlueprint(await fs.readFile('blueprint-sources/flight-science/rgb-60.txt','utf8')).blueprint.version;
const manifests=[],books=[];
for(const spec of specs){
 let id=1;const entities=[],wires=[],occupied=new Set(),ports=[],machines=[],controlled=[],loop=[];
 const width=3*Math.ceil(spec.recipes.length/2)+3,height=8;
 function add(name,x,y,extra={}){const size=name==='assembling-machine-1'?3:1;for(let a=x-(size-1)/2;a<=x+(size-1)/2;a++)for(let b=y-(size-1)/2;b<=y+(size-1)/2;b++){assert(!occupied.has(`${a},${b}`),`${name} collision ${a},${b}`);occupied.add(`${a},${b}`);}const e={entity_number:id++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);return e;}
 const belt=(x,y,d)=>add('transport-belt',x,y,{direction:d});
 const arm=(x,y,d,extra={})=>add('inserter',x,y,{direction:d,override_stack_size:1,...extra});
 const wire=(a,b)=>wires.push([a.entity_number,1,b.entity_number,1]);
 const cond=item=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:spec.limits[item]}});
 const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
 for(let x=0;x<=width;x++)loop.push(belt(x,0,x===width?8:4));
 for(let y=1;y<=height;y++)loop.push(belt(width,y,y===height?12:8));
 for(let x=width-1;x>=0;x--)loop.push(belt(x,height,x===0?0:12));
 for(let y=height-1;y>=1;y--)loop.push(belt(0,y,0));
 const reader=loop[0];reader.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
 for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
 const loopAt=(x,y)=>loop.find(e=>e.position.x===x+.5&&e.position.y===y+.5);
 for(const [i,recipe]of spec.recipes.entries()){
  const top=i<Math.ceil(spec.recipes.length/2),slot=top?i:i-Math.ceil(spec.recipes.length/2),cx=3+3*slot,cy=top?-3:height+3,ay=top?-1:height+1,d=top?8:0;
  const m=add('assembling-machine-1',cx,cy,{recipe});machines.push({recipe,entity:m.entity_number});
  for(const dx of [-1,0]){const reserve=spec.id==='transport-loop'?({'iron-gear-wheel':16,'transport-belt':12}[recipe]):spec.id==='machines-poles-loop'?({'iron-gear-wheel':16,'assembling-machine-1':10,'iron-stick':4}[recipe]):undefined; const extra=reserve===undefined?{}:{control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:'iron-plate',quality:'normal'},comparator:'>',constant:reserve}}};const phase=spec.id==='transport-loop'?{'fast-transport-belt':0,'fast-underground-belt':1,'fast-splitter':2}[recipe]:undefined;if(phase!==undefined)extra.control_behavior={circuit_enabled:true,circuit_condition:{first_signal:{type:'virtual',name:'signal-P'},comparator:'=',constant:phase}};const e=arm(cx+dx,ay,d,extra);if(reserve!==undefined||phase!==undefined)controlled.push(e.entity_number);wire(e,loopAt(cx+dx,top?0:height));}
  const e=arm(cx+1,ay,(d+8)%16,{control_behavior:cond(recipe)});wire(e,loopAt(cx+1,top?0:height));controlled.push(e.entity_number);
 }
 function inlet(item,i,optional){const right=optional,x=right?width:-0,y=1+2*i,armX=right?width+1:-1,dir=right?4:12;
  const last=right?width+5:-5,first=right?width+2:-2;
  for(let a=Math.min(first,last);a<=Math.max(first,last);a++)belt(a,y,right?12:4);
  const e=arm(armX,y,dir,{...filter(item),control_behavior:cond(item)});wire(e,loopAt(x,y));controlled.push(e.entity_number);
  const external=entities.find(e=>e.name==='transport-belt'&&e.position.x===last+.5&&e.position.y===y+.5);
  add('display-panel',last,y-1,{icon:{type:'item',name:item},text:`${optional?'OPTIONAL':'INPUT'}: ${item}\nStock gated. ${optional?'Internal production pauses when supplied here.':'Connect a belt at this labeled entrance.'}`,always_show:true});
  ports.push({kind:'input',label:item,items:[item],item,entity:external.entity_number,x:external.position.x,y:external.position.y,direction:right?12:4,externalSide:right?'east':'west',optional});
 }
 spec.feeds.forEach((item,i)=>inlet(item,i,false));spec.optional.forEach((item,i)=>inlet(item,i,true));
 for(const [i,item]of spec.products.entries()){
  const x=3+4*i,e=arm(x,1,0,filter(item)),chest=add('iron-chest',x,2,{bar:1});wire(e,loopAt(x,0));
  add('display-panel',x,4,{icon:{type:'item',name:item},text:`OUT: ${item}\nOne-stack chest; collect or belt out. Upgrade to passive provider after researching it.`,always_show:true});
  ports.push({kind:'output',items:[item],item,entity:chest.entity_number,x:chest.position.x,y:chest.position.y});
 }
 if(spec.id==='transport-loop'){
  const v=name=>({type:'virtual',name});
  function comb(x,operation,first,second,out,constant){const e=add('arithmetic-combinator',x,6,{direction:4,position:{x:x+1,y:6.5},control_behavior:{arithmetic_conditions:{first_signal:v(first),...(constant!==undefined?{second_constant:constant}:{second_signal:v(second)}),operation,output_signal:v(out)}}});assert(!occupied.has(`${x+1},6`));occupied.add(`${x+1},6`);return e;}
  const timer=comb(3,'+','signal-T',null,'signal-T',1),divide=comb(6,'/','signal-T',null,'signal-U',600),phase=comb(9,'%','signal-U',null,'signal-P',3);
  wires.push([timer.entity_number,3,timer.entity_number,1],[timer.entity_number,3,divide.entity_number,1],[divide.entity_number,3,phase.entity_number,1],[phase.entity_number,3,loopAt(9,height).entity_number,1]);
 }
 assert(Object.values(spec.limits).reduce((a,b)=>a+b,0)<loop.length*8*.75,'loop overstock');
 ports.push({kind:'power',items:[],entity:0,x:0,y:0});
 const bp={item:'blueprint',version,label:`Early controlled loop · ${spec.name} · AM1`,description:'Single yellow-belt loop with entire-belt stock reading. Red wires gate each external feed and assembler output by its own stock cap. Basic filtered inserters, AM1, no modules. Circuit network required. Supply plates/intermediates at the labeled inlets. Optional taps can supplement internal production. Output chests limited to one stack. Preserve the red wires and belt reader.',icons:spec.products.map((name,i)=>({index:i+1,signal:{type:'item',name}})),entities};
 powerStarterLayout(bp,ports,raw);bp.wires.push(...wires);for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 const code=encodeBlueprint({blueprint:bp});await fs.writeFile(`${out}/${spec.id}.txt`,code+'\n');
 const m={id:spec.id,name:spec.name,file:spec.id+'.txt',blueprintSha256:createHash('sha256').update(code).digest('hex'),products:spec.products,inputs:ports.filter(p=>p.kind==='input'&&!p.optional).map(p=>({...p,position:{x:p.x,y:p.y}})),optionalInputs:ports.filter(p=>p.optional),outputs:ports.filter(p=>p.kind==='output'),ports,machineCounts:Object.fromEntries(spec.recipes.map(r=>[r,1])),machines,footprint:starterBounds(bp.entities,raw),construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length])),loopControl:[{name:spec.id,reader:reader.entity_number,controlled,loop:loop.map(e=>e.entity_number),capacity:loop.length*8,maximumStock:Object.values(spec.limits).reduce((a,b)=>a+b,0),limits:spec.limits}],status:'candidate-native-validation-pending'};
 manifests.push(m);books.push({index:books.length,blueprint:bp});console.log(spec.id,m.footprint.width,m.footprint.height,m.construction);
}
await fs.writeFile(`${out}/manifest.json`,JSON.stringify(manifests,null,2)+'\n');await fs.writeFile(`${out}/controlled-loops-book.txt`,encodeBlueprint({blueprint_book:{item:'blueprint-book',version,label:'Early Flight · Three controlled production loops',active_index:0,blueprints:books}})+'\n');
