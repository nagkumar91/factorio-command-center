import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash}from'node:crypto';import{encodeBlueprint}from'../blueprints.mjs';import{powerStarterLayout,starterBounds}from'../science-factory/local-ports/compact-shared-layout.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname),out=path.join(root,'blueprint-sources/flight-science-sided'),bytes=await fs.readFile(path.join(root,'.cache/flight-21/script-output/data-raw-dump.json')),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex'),manifests=JSON.parse(await fs.readFile(path.join(out,'manifest.json')).catch(()=>Buffer.from('[]'))).filter(m=>!['green-circuit-supply','advanced-circuit-supply','engine-supply'].includes(m.id));
for(const kind of ['green','advanced','engine']){
const entities=[],wires=[],ports=[],occupied=new Map(),counts={};let next=1,reader,loop=[],limits={},controlled=[];
const key=(x,y)=>`${x},${y}`;function add(name,x,y,extra={}){const r=name==='assembling-machine-2'?1:0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++){assert(!occupied.has(key(a,b)),`overlap ${kind} ${name} ${a},${b}`);occupied.set(key(a,b),true);}const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);return e;}
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d}),arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});const machine=(r,x,y)=>{counts[r]=(counts[r]||0)+1;return add('assembling-machine-2',x,y,{recipe:r});};
const filter=n=>({use_filters:true,filters:[{index:1,name:n,quality:'normal',comparator:'='}]}),cond=n=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:n,quality:'normal'},comparator:'<',constant:limits[n]}});
function control(e,n){e.control_behavior=cond(n);controlled.push(e.entity_number);const closest=loop.reduce((a,b)=>Math.hypot(a.position.x-e.position.x,a.position.y-e.position.y)<Math.hypot(b.position.x-e.position.x,b.position.y-e.position.y)?a:b);wires.push([e.entity_number,1,closest.entity_number,1]);}
function input(item,x,y,rate){const e=belt(x,y,4);ports.push({kind:'input',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute:rate});return e;}
function output(item,x,y,rate){arm(x,y,12,filter(item));const e=add('steel-chest',x+1,y,{bar:2});ports.push({kind:'output',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,externalSide:'east',perMinute:rate});}
function ring(W,H){for(let x=0;x<=W;x++)loop.push(belt(x,0,x===W?8:4));for(let y=1;y<=H;y++)loop.push(belt(W,y,y===H?12:8));for(let x=W-1;x>=0;x--)loop.push(belt(x,H,x===0?0:12));for(let y=H-1;y>0;y--)loop.push(belt(0,y,0));reader=loop[0];reader.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};for(let i=0;i<loop.length;i++)wires.push([loop[i].entity_number,1,loop[(i+1)%loop.length].entity_number,1]);}
if(kind==='green'){
machine('copper-cable',0,0);machine('electronic-circuit',4,0);input('copper-plate',-7,0,90);for(let x=-6;x<=-3;x++)belt(x,0,4);arm(-2,0,12);arm(2,-1,12);arm(2,0,12);input('iron-plate',-7,3,60);for(let x=-6;x<=4;x++)belt(x,3,4);arm(4,2,8);output('electronic-circuit',6,0,60);
}else if(kind==='advanced'){
const W=44,H=4;limits={'electronic-circuit':70,'copper-cable':140,'plastic-bar':60,'advanced-circuit':64};ring(W,H);
const top=[['copper-cable',4],['electronic-circuit',8],['copper-cable',12],['copper-cable',17],['electronic-circuit',21],['copper-cable',25],['copper-cable',30],['copper-cable',33]];
for(const [r,x]of top){machine(r,x,-3);arm(x,-5,0);if(r==='electronic-circuit'||x>=30){for(let a=0;a<(r==='copper-cable'?2:1);a++)control(arm(x+a,-1,0),r);}}
for(const [x,d]of [[6,12],[10,4],[19,12],[23,4]]){arm(x,-4,d);arm(x,-3,d);}
// Two single-material entrances side-load opposite lanes of one raw-material belt.
input('iron-plate',-7,-8,180);for(let x=-6;x<=-4;x++)belt(x,-8,x===-4?8:4);belt(-4,-7,8);
input('copper-plate',-7,-4,450);for(let x=-6;x<=-5;x++)belt(x,-4,x===-5?0:4);belt(-5,-5,0);for(let x=-6;x<=34;x++)belt(x,-6,4);
for(let i=0;i<13;i++){const x=4+i*3;machine('advanced-circuit',x,H+3);arm(x-1,H+1,0);arm(x,H+1,0);control(arm(x+1,H+1,8),'advanced-circuit');}
input('plastic-bar',-7,1,180);for(let x=-6;x<=-3;x++)belt(x,1,4);add('fast-underground-belt',-2,1,{direction:4,type:'input'});add('fast-underground-belt',2,1,{direction:4,type:'output'});belt(3,1,8);belt(3,2,12);belt(2,2,12);for(const y of [1,2])control(arm(1,y,4,filter('plastic-bar')),'plastic-bar');output('advanced-circuit',W+1,2,90);
}else{
const W=32,H=5;limits={'iron-plate':100,'steel-plate':36,'iron-gear-wheel':32,pipe:48,'engine-unit':40};ring(W,H);
const top=['iron-gear-wheel',...Array(7).fill('engine-unit'),'pipe'],bottom=['pipe',...Array(7).fill('engine-unit')];
for(const [side,recipes]of [['top',top],['bottom',bottom]])for(const [i,r]of recipes.entries()){const x=4+i*3,y=side==='top'?-3:H+3,ay=side==='top'?-1:H+1,d=side==='top'?8:0;machine(r,x,y);arm(x-1,ay,d);arm(x,ay,d);control(arm(x+1,ay,(d+8)%16),r);}
input('iron-plate',-7,1,240);for(let x=-6;x<=-3;x++)belt(x,1,4);belt(-2,1,8);belt(-2,2,8);for(const y of [1,2])control(arm(-1,y,12,filter('iron-plate')),'iron-plate');input('steel-plate',-7,3,60);for(let x=-6;x<=-3;x++)belt(x,3,4);add('fast-underground-belt',-2,3,{direction:4,type:'input'});add('fast-underground-belt',2,3,{direction:4,type:'output'});control(arm(1,3,4,filter('steel-plate')),'steel-plate');output('engine-unit',W+1,2,60);
}
ports.push({kind:'power',label:'External electricity',items:[],entity:0,x:0,y:0});const product=kind==='green'?'electronic-circuit':kind==='advanced'?'advanced-circuit':'engine-unit',rate=kind==='advanced'?90:60,id=kind==='engine'?'engine-supply':kind==='green'?'green-circuit-supply':'advanced-circuit-supply';const bp={item:'blueprint',version:562954249961472,label:`${id} · ${rate}/min`,entities,wires:[],icons:[{index:1,signal:{type:'item',name:product}}]};for(const p of ports.filter(p=>p.kind!=='power'))add('display-panel',Math.floor(p.x)+(p.kind==='input'?-1:1),Math.floor(p.y),{tags:{temporary_port_clearance:true}});
powerStarterLayout(bp,[...ports,{kind:'input',x:-8,y:-10}],raw);bp.entities=bp.entities.filter(e=>!e.tags?.temporary_port_clearance);bp.wires.push(...wires);
let eid=Math.max(...bp.entities.map(e=>e.entity_number))+1;
for(const p of ports.filter(p=>p.kind!=='power')){
 const options=[[0,-1],[0,1],[1,-1],[1,1],[2,-1],[2,1]],bounds=starterBounds(bp.entities,raw);
 const size=e=>e.name==='assembling-machine-2'?3:e.name==='big-electric-pole'?2:1;
 const free=(x,y)=>!bp.entities.some(e=>Math.abs(e.position.x-x)<(size(e)+1)/2&&Math.abs(e.position.y-y)<(size(e)+1)/2);
 const available=options.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(q=>free(q.x,q.y));
 available.sort((a,b)=>{const area=q=>(Math.max(bounds.right,q.x+.5)-Math.min(bounds.left,q.x-.5))*(Math.max(bounds.bottom,q.y+.5)-Math.min(bounds.top,q.y-.5));return area(a)-area(b);});
 assert(available.length,'No display location');const q=available[0];bp.entities.push({entity_number:eid++,name:'display-panel',position:q,icon:{type:'item',name:p.items[0]},text:`${p.kind}: ${p.label} ${p.perMinute}/min`,always_show:true});p.displayEntity=eid-1;
}
for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};bp.description='One inlet per material on the left; collect the output on the right. AM2, fast inserters, red belts, no modules. Keep circuit stock controls where present. Wire is directly inserted into green-circuit assemblers.';
const code=encodeBlueprint({blueprint:bp}),footprint=starterBounds(bp.entities,raw),m={id,file:id+'.txt',name:bp.label,products:[product],targetPerMinute:rate,blueprintSha256:sha(code),prototypeSha256:sha(bytes),ports,inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:4,perMinute:p.perMinute})),outputs:ports.filter(p=>p.kind==='output').map(p=>({item:product,entity:p.entity,position:{x:p.x,y:p.y},perMinute:rate})),machineCounts:counts,footprint,loopControl:reader?[{name:kind,reader:reader.entity_number,controlled,capacity:loop.length*8,limits}]:[],setupNotes:[bp.description],status:'awaiting-native-validation'};await fs.writeFile(path.join(out,m.file),code+'\n');manifests.push(m);console.log({id,footprint,counts});}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifests,null,2)+'\n');
