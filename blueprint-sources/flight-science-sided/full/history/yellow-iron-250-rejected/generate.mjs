import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../../blueprints.mjs';
import {makeBlueComponent} from './blue-component.mjs';
import {powerStarterLayout,starterBounds} from '../../science-factory/local-ports/compact-shared-layout.mjs';
const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const out=path.join(root,'blueprint-sources/flight-science-sided/full');await fs.mkdir(out,{recursive:true});
const bytes=await fs.readFile(path.join(root,'.cache/flight-21/script-output/data-raw-dump.json')),raw=JSON.parse(bytes),sha=v=>createHash('sha256').update(v).digest('hex');
const externals=new Set(['iron-plate','copper-plate','steel-plate','plastic-bar','sulfur','coal','stone-wall','stone','sulfuric-acid','lubricant']);
const products=['automation-science-pack','logistic-science-pack','chemical-science-pack','military-science-pack','production-science-pack','utility-science-pack'];
const configs=[{name:'Red and green',targets:{[products[0]]:60,[products[1]]:60}},{name:'Blue',targets:{[products[2]]:60}},{name:'Military',targets:{[products[3]]:60}},...Array.from({length:3},(_,i)=>({name:`Purple ${i+1}`,targets:{[products[4]]:20}})),...Array.from({length:3},(_,i)=>({name:`Yellow ${i+1}`,targets:{[products[5]]:20}}))];
function expand(targets){const demand={},crafts={};function f(n,r){demand[n]=(demand[n]||0)+r;if(externals.has(n))return;const re=raw.recipe[n];assert(re,'Missing recipe '+n);const amount=re.results.find(i=>i.name===n).amount;crafts[n]=(crafts[n]||0)+r/amount;for(const i of re.ingredients)f(i.name,r/amount*i.amount);}for(const [n,r]of Object.entries(targets))f(n,r);return {demand,crafts};}
const total=expand(Object.fromEntries(products.map(n=>[n,60])));
const entities=[],wires=[],ports=[],blocks=[],machineCounts={},occupied=new Map();let next=1;
const key=(x,y)=>`${x},${y}`;
function add(name,x,y,extra={}){const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};const size=['assembling-machine-2','chemical-plant','electric-furnace'].includes(name)?3:1;for(let a=x-(size-1)/2;a<=x+(size-1)/2;a++)for(let b=y-(size-1)/2;b<=y+(size-1)/2;b++){assert(!occupied.has(key(a,b)),`Overlap ${name} ${x},${y} with ${occupied.get(key(a,b))?.name}`);occupied.set(key(a,b),e);}entities.push(e);return e;}
const belt=(x,y,d,tags={})=>add('fast-transport-belt',x,y,{direction:d,tags});
const filter=n=>({use_filters:true,filters:[{index:1,name:n,quality:'normal',comparator:'='}]});
const condition=(n,count)=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:n},comparator:'<',constant:count}});
function wire(a,b){wires.push([a.entity_number,1,b.entity_number,1]);}
let offsetY=0;
for(const config of configs){
 if(config.name==='Blue'){
  const c=await makeBlueComponent(raw,root,out),dy=offsetY-c.footprint.top,map=new Map();
  for(const original of c.entities){const extra=structuredClone(original);delete extra.entity_number;delete extra.position;extra.tags={...extra.tags,block:'Blue composed',source_entity:original.entity_number};const e=add(original.name,Math.floor(original.position.x),Math.floor(original.position.y+dy),extra);map.set(original.entity_number,e.entity_number);}
  for(const w of c.wires)wires.push([map.get(w[0]),w[1],map.get(w[2]),w[3]]);
  for(const p of c.ports)ports.push({...p,entity:map.get(p.entity),y:p.y+dy,label:'Blue · '+p.label,block:'Blue composed'});
  for(const loop of c.loops)blocks.push({...loop,name:'Blue / '+loop.name,reader:map.get(loop.reader),controlled:loop.controlled.map(id=>map.get(id)),x:0,y:dy,width:c.footprint.right-3,components:c.components,connections:c.connections});
  for(const [recipe,count]of Object.entries(c.machineCounts))machineCounts[recipe]=(machineCounts[recipe]||0)+count;
  offsetY=c.footprint.bottom+dy+4;continue;
 }
 const {demand,crafts}=expand(config.targets),counts={};
 for(const [n,c]of Object.entries(crafts)){const speed=n==='battery'?1:n==='stone-brick'?2:.75;counts[n]=Math.ceil(c*(raw.recipe[n].energy_required||.5)/(60*speed)*1.02-1e-8);}
 // Every green circuit assembler has two adjacent wire assemblers; their copper
 // comes from a separate rear belt and no green-circuit wire touches the loop.
 const rearPlastic=config.name.startsWith('Yellow'),rearStickIron=config.name.startsWith('Purple');
 const rearStickIronRate=rearStickIron?crafts['iron-stick']:0;
 const rearPlasticRate=rearPlastic?crafts['advanced-circuit']*2:0;
 const green=counts['electronic-circuit']||0;
 const otherWire=(demand['copper-cable']||0)-3*(demand['electronic-circuit']||0);
 counts['copper-cable']=2*green+(otherWire>0?Math.ceil(otherWire/180*1.05):0);
 if(!counts['copper-cable'])delete counts['copper-cable'];
 const top=[];for(let i=0;i<green;i++)top.push({recipe:'copper-cable',direct:true},{recipe:'electronic-circuit'},{recipe:'copper-cable',direct:true});
 const bottom=rearPlastic?Array.from({length:counts['advanced-circuit']},()=>({recipe:'advanced-circuit'})):[];
 for(const [recipe,count]of Object.entries(counts)){
  if(recipe==='electronic-circuit'||rearPlastic&&recipe==='advanced-circuit')continue;
  const remaining=recipe==='copper-cable'?count-2*green:count;
  const needsCopper=raw.recipe[recipe].ingredients.some(i=>i.name==='copper-plate');
  const wet=raw.recipe[recipe].ingredients.some(i=>i.type==='fluid');
  for(let i=0;i<remaining;i++){
   const slot={recipe};
   if(needsCopper||wet&&recipe!=='electric-engine-unit')top.push(slot);
   else if(recipe==='electric-engine-unit')bottom.push(slot);
   else (bottom.length<top.length?bottom:top).push(slot);
  }
 }
 if(rearStickIron){const index=top.findIndex(s=>s.recipe==='iron-stick');if(index>=0)bottom.push(...top.splice(index,1));}
 const feeds=Object.entries(demand).filter(([n])=>externals.has(n)&&!['copper-plate','sulfuric-acid','lubricant'].includes(n)).map(([item,rate])=>({item,rate,arms:Math.max(1,Math.ceil(rate/95))})).sort((a,b)=>a.rate-b.rate);
 let col=2;for(const f of feeds){f.x=col;col+=f.arms+3;}
 if(rearPlastic)feeds.find(f=>f.item==='plastic-bar').rate-=rearPlasticRate;
 if(rearStickIron)feeds.find(f=>f.item==='iron-plate').rate-=rearStickIronRate;
 const first=col+3,width=first+Math.max(top.length,bottom.length)*4+3;
 const minY=Math.min(demand['sulfuric-acid']?-14:-9,-4-feeds.length*2),maxY=counts['electric-engine-unit']?13:rearStickIron?9:8;
 const y=offsetY-minY;
 const balanced=false;
 const loop=[];
 for(let x=0;x<=width;x++){loop.push(belt(x,y,x===width&&!balanced?8:4,{block:config.name,role:'circulation'}));loop.push(belt(x,y+3,x===0?0:12,{block:config.name,role:'circulation'}));}
 for(let dy=1;dy<=2;dy++){loop.push(belt(0,y+dy,0,{block:config.name,role:'circulation'}));if(!balanced)loop.push(belt(width,y+dy,8,{block:config.name,role:'circulation'}));}
 const ordered=[...loop].sort((a,b)=>{const idx=e=>e.position.y===y+.5?e.position.x:e.position.x===width+.5?width+e.position.y-y: e.position.y===y+3.5?2*width+4-e.position.x:2*width+8-e.position.y+y;return idx(a)-idx(b);});
 for(let i=0;i<ordered.length;i++)wire(ordered[i],ordered[(i+1)%ordered.length]);
 ordered[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
 if(balanced){
  const splitter=add('fast-splitter',width+1,y,{position:{x:width+1.5,y:y+1},direction:4,tags:{block:config.name,role:'lane-balancer'}});assert(!occupied.has(key(width+1,y+1)));occupied.set(key(width+1,y+1),splitter);
  for(const [dx,dy,d]of [[2,0,4],[3,0,8],[3,1,8],[3,2,8],[3,3,12],[2,3,12],[1,3,12],[2,1,8],[2,5,4],[3,5,0],[3,4,0]]){
   const e=belt(width+dx,y+dy,d,{block:config.name,role:'lane-balancer'});const near=[...loop].sort((a,b)=>Math.hypot(a.position.x-e.position.x,a.position.y-e.position.y)-Math.hypot(b.position.x-e.position.x,b.position.y-e.position.y))[0];wire(e,near);loop.push(e);
  }
  add('fast-underground-belt',width+2,y+2,{direction:8,type:'input',tags:{block:config.name,role:'lane-balancer'}});
  add('fast-underground-belt',width+2,y+4,{direction:8,type:'output',tags:{block:config.name,role:'lane-balancer'}});
 }

 const limits={};for(const n of Object.keys(demand)){if(['copper-plate','sulfuric-acid','lubricant'].includes(n))continue;const rate=n==='copper-cable'?otherWire:demand[n];limits[n]=products.includes(n)?32:Math.max(16,Math.ceil(rate*loop.length/225*(externals.has(n)?.9:.8)+16));}
 const rawStock=Object.entries(limits).filter(([n])=>externals.has(n)).reduce((a,[,v])=>a+v,0),madeStock=Object.entries(limits).filter(([n])=>!externals.has(n)).reduce((a,[,v])=>a+v,0);
 for(const n of Object.keys(limits)){const stock=externals.has(n)?rawStock:madeStock;if(stock>loop.length*4*.82)limits[n]=Math.max(8,Math.floor(limits[n]*loop.length*4*.82/stock));}
 for(const [n,r] of Object.entries(config.targets))limits[n]=Math.ceil(r*loop.length/225*1.5+16);
 const controlled=[];const nearest=e=>[...loop].sort((a,b)=>Math.hypot(a.position.x-e.position.x,a.position.y-e.position.y)-Math.hypot(b.position.x-e.position.x,b.position.y-e.position.y))[0];
 function control(e,n){e.tags={...e.tags,stock_item:n};e.control_behavior=condition(n,limits[n]);wire(e,nearest(e));controlled.push(e.entity_number);}
 const slots=[];
 for(const [side,row]of [['top',top],['bottom',bottom]])for(const [i,s]of row.entries()){
  const x=first+i*4,cy=y+(side==='top'?-3:6),ay=y+(side==='top'?-1:4),inputD=side==='top'?8:0;
  const machine=s.recipe==='battery'?'chemical-plant':s.recipe==='stone-brick'?'electric-furnace':'assembling-machine-2';
  const m=add(machine,x,cy,{...(machine==='electric-furnace'?{}:{recipe:s.recipe}),direction:s.recipe==='electric-engine-unit'?8:0,tags:{block:config.name,production_recipe:s.recipe,direct_wire:!!s.direct}});machineCounts[s.recipe]=(machineCounts[s.recipe]||0)+1;s.entity=m.entity_number;s.x=x;s.y=cy;s.side=side;slots.push(s);
  if(s.recipe!=='copper-cable'&&!(rearStickIron&&s.recipe==='iron-stick')){
   const solids=raw.recipe[s.recipe].ingredients.filter(i=>i.type!=='fluid'&&i.name!=='copper-plate'&&!(s.recipe==='electronic-circuit'&&i.name==='copper-cable'));
   if(solids.length)for(const dx of [-1,0])add('fast-inserter',x+dx,ay,{direction:inputD,override_stack_size:1,...(s.recipe==='stone-brick'?filter('stone'):rearPlastic&&s.recipe==='advanced-circuit'?{use_filters:true,filters:['electronic-circuit','copper-cable'].map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))}:{}),tags:{block:config.name,role:'input'}});
  }
  if(!s.direct){
   const outputXs=s.recipe==='copper-cable'||rearStickIron&&s.recipe==='iron-stick'?[0,1]:[1];
   for(const dx of outputXs){const e=add('fast-inserter',x+dx,ay,{direction:(inputD+8)%16,override_stack_size:1,tags:{block:config.name,role:'output'}});control(e,s.recipe);}
  }
  if(raw.recipe[s.recipe].ingredients.some(i=>i.name==='copper-plate'))add('fast-inserter',x,y-5,{direction:0,override_stack_size:1,...filter('copper-plate'),tags:{block:config.name,role:'copper-feed'}});
 }
 for(let i=0;i<top.length;i++)if(top[i].recipe==='electronic-circuit'){
  for(const [neighbor,d]of [[top[i-1],12],[top[i+1],4]])for(const dy of [-1,0])add('fast-inserter',Math.min(top[i].x,neighbor.x)+2,y-3+dy,{direction:d,override_stack_size:1,...filter('copper-cable'),tags:{block:config.name,role:'direct-wire'}});
 }
 // Bound stock by item travel time, rather than filling the entire loop.
 // Excess recirculating stock consumes the free gaps needed by later feeders.
 const circumference=2*width+6,flowIndex=s=>s.side==='top'?s.x:2*width+3-s.x;
 const transit={};
 for(const item of Object.keys(limits)){
  if(products.includes(item))continue;
  const consumers=slots.flatMap(s=>{if(s.recipe==='electronic-circuit'&&item==='copper-cable'||rearPlastic&&s.recipe==='advanced-circuit'&&item==='plastic-bar'||rearStickIron&&s.recipe==='iron-stick'&&item==='iron-plate')return [];const ingredient=raw.recipe[s.recipe].ingredients.find(v=>v.name===item);return ingredient?[{index:flowIndex(s),rate:crafts[s.recipe]*ingredient.amount/counts[s.recipe],amount:ingredient.amount}]:[];});
  const demandRate=consumers.reduce((a,c)=>a+c.rate,0);
  const f=feeds.find(f=>f.item===item);
  const producers=f?[{index:f.x+f.arms/2,remaining:demandRate}]:slots.filter(s=>s.recipe===item&&!s.direct).map(s=>({index:flowIndex(s),remaining:0}));
  if(!producers.length||!consumers.length)continue;
  if(!f)for(const p of producers)p.remaining=demandRate/producers.length;
  let travelling=0;
  for(const c of consumers){let remaining=c.rate;for(const p of [...producers].sort((a,b)=>(c.index-a.index+circumference)%circumference-(c.index-b.index+circumference)%circumference)){const flow=Math.min(remaining,p.remaining);travelling+=flow*((c.index-p.index+circumference)%circumference)/225;p.remaining-=flow;remaining-=flow;if(remaining<1e-8)break;}}
  limits[item]=Math.max(f?24:16,...consumers.map(c=>c.amount*4),Math.ceil(travelling*1.35+8));transit[item]={targetFlow:demandRate,inTransit:travelling,stockLimit:limits[item]};
 }
 if(config.name.startsWith('Yellow')){limits['electronic-circuit']=400;transit['electronic-circuit'].stockLimit=400;limits['iron-plate']=250;transit['iron-plate'].stockLimit=250;}
 const stockBudget={raw:Object.entries(limits).filter(([n])=>externals.has(n)).reduce((a,[,v])=>a+v,0),manufactured:Object.entries(limits).filter(([n])=>!externals.has(n)).reduce((a,[,v])=>a+v,0),perLaneCapacity:loop.length*4};
 assert(stockBudget.raw<=stockBudget.perLaneCapacity&&stockBudget.manufactured<=stockBudget.perLaneCapacity,'Loop lane stock exceeds capacity '+config.name);
 for(const id of controlled){const e=entities.find(e=>e.entity_number===id);e.control_behavior=condition(e.tags.stock_item,limits[e.tags.stock_item]);}
 for(const [i,f]of feeds.entries()){
  const row=y-4-i*2;
  for(let x=-2;x<=f.x;x++)belt(x,row,x===f.x?8:4,{material:f.item,block:config.name});
  for(let by=row+1;by<=y-3;by++)belt(f.x,by,8,{material:f.item,block:config.name});
  add('fast-underground-belt',f.x,y-2,{direction:8,type:'input',tags:{material:f.item,block:config.name}});
  add('fast-underground-belt',f.x,y+1,{direction:8,type:'output',tags:{material:f.item,block:config.name}});
  belt(f.x,y+2,4,{material:f.item,block:config.name});
  for(let a=1;a<=f.arms;a++){
   belt(f.x+a,y+2,4,{material:f.item,block:config.name});
   const arm=add('fast-inserter',f.x+a,y+1,{direction:8,override_stack_size:1,...filter(f.item),tags:{block:config.name,role:'controlled-feed'}});control(arm,f.item);
  }
  const e=occupied.get(key(-2,row));ports.push({kind:'input',items:[f.item],label:`${config.name} · ${f.item}`,entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute:f.rate,block:config.name});
 }
 // Each block's copper belt is independent, including the high copper draw of LDS.
 if(demand['copper-plate']){
  const row=y-4-feeds.length*2,turn=first-2,last=Math.max(...slots.filter(s=>raw.recipe[s.recipe].ingredients.some(i=>i.name==='copper-plate')).map(s=>s.x));
  for(let x=-2;x<=turn;x++)belt(x,row,x===turn&&row<y-6?8:4,{material:'copper-plate',block:config.name});
  for(let by=row+1;by<=y-6;by++)belt(turn,by,by===y-6?4:8,{material:'copper-plate',block:config.name});
  for(let x=turn+1;x<=last;x++)belt(x,y-6,4,{material:'copper-plate',block:config.name});
  const e=occupied.get(key(-2,row));ports.push({kind:'input',items:['copper-plate'],label:`${config.name} · copper plates`,entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute:demand['copper-plate'],block:config.name});
 }
 if(rearPlastic){
  const reds=slots.filter(s=>s.recipe==='advanced-circuit');assert(reds.every(s=>s.side==='bottom'));
  const row=y+9,last=Math.max(...reds.map(s=>s.x));for(let x=-2;x<=last;x++)belt(x,row,4,{material:'plastic-bar',role:'dedicated-red-plastic',block:config.name});
  for(const s of reds)add('fast-inserter',s.x,y+8,{direction:8,override_stack_size:1,...filter('plastic-bar'),tags:{block:config.name,role:'dedicated-red-plastic'}});
  const e=occupied.get(key(-2,row));ports.push({kind:'input',items:['plastic-bar'],label:`${config.name} · red-circuit plastic`,entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute:rearPlasticRate,block:config.name});
 }
 if(rearStickIron){
  const sticks=slots.filter(s=>s.recipe==='iron-stick');assert(sticks.every(s=>s.side==='bottom'));
  const row=y+9,last=Math.max(...sticks.map(s=>s.x));for(let x=-2;x<=last;x++)belt(x,row,4,{material:'iron-plate',role:'dedicated-stick-iron',block:config.name});
  for(const s of sticks)add('fast-inserter',s.x,y+8,{direction:8,override_stack_size:1,...filter('iron-plate'),tags:{block:config.name,role:'dedicated-stick-iron'}});
  const e=occupied.get(key(-2,row));ports.push({kind:'input',items:['iron-plate'],label:`${config.name} · iron-stick iron`,entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute:rearStickIronRate,block:config.name});
 }
 // Fluid headers cross solid belts only through explicit underground pairs.
 function pipeLine(row,start,end,item){
  for(let x=start;x<=end;){if(occupied.has(key(x,row))){throw Error(`Pipe obstacle without clearance ${x},${row}`);}
   if(occupied.has(key(x+1,row))){let finish=x+2;while(occupied.has(key(finish,row)))finish++;assert(finish-x<=10,'Pipe span');add('pipe-to-ground',x,row,{direction:12,tags:{fluid:item}});add('pipe-to-ground',finish,row,{direction:4,tags:{fluid:item}});x=finish+1;}else {add('pipe',x,row,{tags:{fluid:item}});x++;}}
 }
 for(const item of ['sulfuric-acid','lubricant'])if(demand[item]){
  const wet=slots.filter(s=>raw.recipe[s.recipe].ingredients.some(i=>i.name===item));
  const header=y+(item==='lubricant'?12:-13),cols=wet.map(s=>s.x+(s.recipe==='battery'?-1:0));
  pipeLine(header,-2,Math.max(...cols),item);
  for(const s of wet){const x=s.x+(s.recipe==='battery'?-1:0);if(item==='lubricant'){add('pipe-to-ground',x,y+8,{direction:0,tags:{fluid:item}});add('pipe-to-ground',x,y+11,{direction:8,tags:{fluid:item}});}else{add('pipe-to-ground',x,y-5,{direction:8,tags:{fluid:item}});add('pipe-to-ground',x,y-12,{direction:0,tags:{fluid:item}});}}
  const e=occupied.get(key(-2,header));ports.push({kind:'fluid',items:[item],label:`${config.name} · ${item}`,entity:e.entity_number,x:e.position.x,y:e.position.y,externalSide:'west',perMinute:demand[item],block:config.name});
 }
 for(const [i,[item,rate]]of Object.entries(config.targets).entries()){
  const row=balanced?y-2:y+1+i;
  if(balanced){add('fast-inserter',width,y-1,{direction:8,override_stack_size:1,...filter(item)});belt(width,row,4,{material:item,role:'science-output'});belt(width+1,row,4,{material:item,role:'science-output'});}
  else add('fast-inserter',width+1,row,{direction:12,override_stack_size:1,...filter(item)});
  const chest=add('wooden-chest',width+2,row,{bar:1});
  ports.push({kind:'output',items:[item],label:`${config.name} · ${item}`,entity:chest.entity_number,x:chest.position.x,y:chest.position.y,externalSide:'east',perMinute:rate,block:config.name});
 }
 blocks.push({name:config.name,balanced,targets:config.targets,machineCounts:counts,x:0,y,width,reader:ordered[0].entity_number,controlled,capacity:loop.length*8,transitModel:transit,stockBudget,stockLimits:limits,maximumStock:Object.values(limits).reduce((a,b)=>a+b,0)});
 offsetY=y+maxY+4;
}
// All collected science reaches one common right boundary.
const outputX=Math.max(...blocks.map(b=>b.width))+4;
for(const p of ports.filter(p=>p.kind==='output')){
 const x=Math.floor(p.x),y=Math.floor(p.y),chest=occupied.get(key(x,y));occupied.delete(key(x,y));
 for(let bx=x;bx<outputX-1;bx++)belt(bx,y,4,{material:p.items[0],role:'science-output'});
 add('fast-inserter',outputX-1,y,{direction:12,override_stack_size:1,...filter(p.items[0])});
 chest.position.x=outputX+.5;occupied.set(key(outputX,y),chest);p.x=chest.position.x;p.cap=raw.item[p.items[0]].stack_size;
}
// Replace local solid approaches with a shared material manifold. Copper and
// iron are partitioned into capacity-limited trunks; other solids have one inlet.
// Each tap uses a splitter and crosses foreign trunks below grade.
const localInputs=ports.filter(p=>p.kind==='input'),materials=[...new Set(localInputs.map(p=>p.items[0]))];
const channels=[];
for(const item of materials){let lane;for(const p of localInputs.filter(p=>p.items[0]===item).sort((a,b)=>a.y-b.y)){if(!lane||lane.rate+p.perMinute>1400){lane={item,ports:[],rate:0};channels.push(lane);}lane.ports.push(p);lane.rate+=p.perMinute;}}
// The input side is ordered by item, with adjacent parallel copper / iron inlets.
channels.forEach((c,i)=>{c.x=-6-i*4;});
const left=-10-channels.length*4;
const minHeader=-channels.length*3-4;
const globalInputs=[];
function ug(x1,x2,y,item){add('fast-underground-belt',x1,y,{direction:4,type:'input',tags:{material:item}});add('fast-underground-belt',x2,y,{direction:4,type:'output',tags:{material:item}});}
for(const [i,c]of channels.entries()){
 const header=minHeader+i*3,maxY=Math.max(...c.ports.map(p=>Math.floor(p.y)));
 for(let x=left;x<=c.x;x++)belt(x,header,x===c.x?8:4,{material:c.item,role:'trunk-inlet'});
 const tapRows=new Set(c.ports.map(p=>Math.floor(p.y)-1));
 for(let y=header+1;y<=maxY;y++){
  if(tapRows.has(y)){
   // North/south splitter spans two horizontal cells.
   const e={entity_number:next++,name:'fast-splitter',position:{x:c.x+1,y:y+.5},direction:8,tags:{material:c.item,role:'trunk-tap'}};
   for(const x of [c.x,c.x+1]){assert(!occupied.has(key(x,y)),'splitter overlap');occupied.set(key(x,y),e);}entities.push(e);
  }else belt(c.x,y,8,{material:c.item,role:'trunk'});
 }
 for(const p of c.ports){const row=Math.floor(p.y);let x=c.x+1;belt(x,row,4,{material:c.item,role:'tap'});x++;
  while(x<-2){const foreign=channels.find(t=>t.x===x+1);if(foreign){ug(x,x+2,row,c.item);x+=3;}else{belt(x,row,4,{material:c.item,role:'tap'});x++;}}
 }
 const e=occupied.get(key(left,header));globalInputs.push({kind:'input',items:[c.item],label:`${c.item}${channels.filter(v=>v.item===c.item).length>1?' · branch '+(channels.filter(v=>v.item===c.item).indexOf(c)+1):''}`,entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute:c.rate,branches:c.ports.map(p=>p.block)});
}
ports.splice(0,ports.length,...ports.filter(p=>p.kind!=='input'),...globalInputs);
// Extend fluid ports to the same west boundary; their rows avoid solid taps.
for(const p of ports.filter(p=>p.kind==='fluid')){
 const row=Math.floor(p.y),item=p.items[0];
 for(let x=left;x<-2;){if(x+1<-2&&occupied.has(key(x+1,row))){let finish=x+2;while(occupied.has(key(finish,row)))finish++;assert(finish-x<=10,`fluid manifold span ${item} row ${row} from ${x} to ${finish} ${JSON.stringify([...occupied].filter(([k])=>k.endsWith(','+row)).map(([k,v])=>[k,v.name]))}`);add('pipe-to-ground',x,row,{direction:12,tags:{fluid:item}});add('pipe-to-ground',finish,row,{direction:4,tags:{fluid:item}});x=finish+1;}else{add('pipe',x,row,{tags:{fluid:item}});x++;}}
 const e=occupied.get(key(left,row));Object.assign(p,{entity:e.entity_number,x:e.position.x,y:e.position.y});
}
const inputTotals={};for(const p of ports.filter(p=>p.kind==='input'||p.kind==='fluid'))inputTotals[p.items[0]]=(inputTotals[p.items[0]]||0)+p.perMinute;
assert.deepEqual(Object.keys(inputTotals).sort(),[...externals].sort(),'External item set');
for(const item of externals)assert(Math.abs(inputTotals[item]-total.demand[item])<1e-6,`External input total ${item}: ${inputTotals[item]} versus ${total.demand[item]}`);
// Reserve approach tiles and label every connection before placing power.
for(const p of ports){
 const x=Math.floor(p.x),y=Math.floor(p.y),candidates=p.kind==='output'?[[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]:[[1,-1],[1,1],[2,-1],[2,1],[0,-1],[0,1]];
 const d=candidates.find(([dx,dy])=>!occupied.has(key(x+dx,y+dy))&&!ports.some(q=>{const qx=Math.floor(q.x),qy=Math.floor(q.y);return qy===y+dy&&((q.externalSide==='west'&&x+dx<qx&&x+dx>=qx-3)||(q.externalSide==='east'&&x+dx>qx&&x+dx<=qx+3));}));assert(d,'No label location '+p.label);
 const e=add('display-panel',x+d[0],y+d[1],{icon:{type:p.kind==='fluid'?'fluid':'item',name:p.items[0]},text:`${p.kind==='output'?'OUT':'IN'} ${p.label}\n${p.perMinute}/min at target · ${p.kind==='output'?'collect to the right':'feed from the left'}`,always_show:true});p.displayEntity=e.entity_number;
}
ports.push({kind:'power',label:'External electricity',items:[],entity:0,x:left,y:minHeader});
const bp={item:'blueprint',version:562954249961472,label:'Six science packs · all intermediates inside · 60/min each',entities,wires:[],icons:products.slice(0,4).map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
powerStarterLayout(bp,ports,raw);bp.wires.push(...wires);
for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
bp.description='Factorio 2.1.24. Simultaneous red, green, blue, military, purple and yellow science: target 60/min each. All intermediates, batteries and stone bricks built inside. AM2, electric furnaces, chemical plants, red belts and fast inserters. No modules, robots or inserter stack bonus. Feed all labeled solid/fluid ports from the left; collect science from right-side chests. Preserve the red circuit wires: local stock controls prevent circulation belts from filling. External electricity required.';
const code=encodeBlueprint({blueprint:bp}),footprint=starterBounds(bp.entities,raw),id='six-pack-integrated-60';
const manifest={id,file:id+'.txt',name:bp.label,blueprintSha256:sha(code),prototypeSha256:sha(bytes),gameVersion:'2.1.24',products,targetPerMinute:60,targets:Object.fromEntries(products.map(n=>[n,60])),inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:4,perMinute:p.perMinute,branches:p.branches})),fluids:ports.filter(p=>p.kind==='fluid').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:p.perMinute,block:p.block})),outputs:ports.filter(p=>p.kind==='output').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:p.perMinute,cap:p.cap,block:p.block})),ports,footprint,machineCounts,recipeCraftsPerMinute:total.crafts,externalInputsPerMinute:Object.fromEntries(Object.entries(total.demand).filter(([n])=>externals.has(n))),construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].sort().map(n=>[n,bp.entities.filter(e=>e.name===n).length])),loopControl:blocks,setupNotes:[bp.description],optimization:{scope:'Deterministic partitioned production layout with direct green-circuit wire insertion; no global optimality claim.'},status:'candidate-awaiting-exact-hash-native-validation'};
await fs.writeFile(path.join(out,id+'.txt'),code+'\n');await fs.writeFile(path.join(out,id+'.json'),JSON.stringify({blueprint:bp},null,2)+'\n');await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');console.log(JSON.stringify({id,footprint,machineCounts,channels:channels.map(c=>({item:c.item,rate:c.rate})),entities:bp.entities.length}));
