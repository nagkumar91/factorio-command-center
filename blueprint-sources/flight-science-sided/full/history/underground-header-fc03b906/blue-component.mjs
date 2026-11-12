// Compose the separately native-tested red-circuit and engine workshops without
// moving their machines or changing their stock-control logic.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../../blueprints.mjs';
import {Layout} from '../hybrid/layout.mjs';
import {starterBounds} from '../../science-factory/local-ports/compact-shared-layout.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export async function makeBlueComponent(raw,root,out){
 const l=new Layout(raw),source=path.join(out,'components'),manifest=JSON.parse(await fs.readFile(path.join(source,'blue-manifest.json'))),frozen=[];
 await fs.mkdir(path.join(out,'components'),{recursive:true});
 async function addComponent(id,x,y){
  const m=manifest.find(m=>m.id===id),code=(await fs.readFile(path.join(source,m.file),'utf8')).trim();assert.equal(sha(code),m.blueprintSha256);
  const b=decodeBlueprint(code).blueprint,c=l.import(b,m,x,y);frozen.push(m);await fs.writeFile(path.join(out,'components',m.file),code+'\n');return c;
 }
 const red=await addComponent('advanced-circuit-supply',5,8),engine=await addComponent('engine-supply',5,32);
 // Add a green/wire support pair inside the imported workshop's spare top
 // space. The frozen standalone source stays unchanged; the final factory's
 // native report qualifies this headroom improvement.
 const redLoop=l.loops.find(loop=>loop.name==='advanced-circuit-supply/advanced');assert(redLoop);
 const greenControl=structuredClone(l.entities.find(e=>e.entity_number===red.map.get(101)).control_behavior),wireControl=structuredClone(l.entities.find(e=>e.entity_number===red.map.get(113)).control_behavior);
 const supportArm=(x,y,d,item,control)=>{
  const e=l.add('fast-inserter',x+5,y+8,{direction:d,override_stack_size:1,use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}],...(control?{control_behavior:structuredClone(control)}:{}),tags:{blue_headroom:true}});
  if(control){const adjacent=l.at(x+5,8);assert(adjacent);l.wires.push([e.entity_number,1,adjacent.entity_number,1]);redLoop.controlled.push(e.entity_number);}return e;
 };
 for(let x=35;x<=42;x++)l.belt(x+5,2,4);
 l.add('assembling-machine-2',42,5,{recipe:'electronic-circuit',tags:{blue_headroom:true}});l.add('assembling-machine-2',46,5,{recipe:'copper-cable',tags:{blue_headroom:true}});
 supportArm(37,-5,0,'iron-plate');supportArm(41,-5,0,'copper-plate');
 supportArm(39,-4,4,'copper-cable');supportArm(39,-3,4,'copper-cable');
 supportArm(37,-1,0,'electronic-circuit',greenControl);supportArm(41,-1,0,'copper-cable',wireControl);supportArm(42,-1,0,'copper-cable',wireControl);
 red.modifications={addedMachines:{'electronic-circuit':1,'copper-cable':1},purpose:'Remove the exact 90/min red-circuit production ceiling for blue-science recovery.'};
 const X=72,Y=10,W=30,H=6,loop=[],controlled=[],limits={'advanced-circuit':64,'engine-unit':48,sulfur:24};
 const filter=n=>({use_filters:true,filters:[{index:1,name:n,quality:'normal',comparator:'='}]}),condition=n=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:n},comparator:'<',constant:limits[n]}});
 const wire=(a,b)=>l.wires.push([a.entity_number,1,b.entity_number,1]);
 for(let x=0;x<=W;x++)loop.push(l.belt(X+x,Y,x===W?8:4));
 for(let y=1;y<=H;y++)loop.push(l.belt(X+W,Y+y,y===H?12:8));
 for(let x=W-1;x>=0;x--)loop.push(l.belt(X+x,Y+H,x===0?0:12));
 for(let y=H-1;y>0;y--)loop.push(l.belt(X,Y+y,0));
 loop[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
 const arm=(x,y,d,extra={})=>l.add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
 for(const [side,n]of [['top',9],['bottom',8]])for(let i=0;i<n;i++){
  const x=X+4+i*3,y=Y+(side==='top'?-3:H+3),ay=Y+(side==='top'?-1:H+1),d=side==='top'?8:0;
  l.add('assembling-machine-2',x,y,{recipe:'chemical-science-pack'});for(const dx of [-1,0])arm(x+dx,ay,d);
  arm(x+1,Y+(side==='top'?-5:H+5),side==='top'?8:0,filter('chemical-science-pack'));
 }
 const inputs=[];
 for(const [i,[item,rate]]of [['advanced-circuit',90],['engine-unit',60],['sulfur',30]].entries()){
  const row=Y+1+i,source=l.belt(X-7,row,4);for(let x=X-6;x<=X-2;x++)l.belt(x,row,4);
  const a=arm(X-1,row,12,{...filter(item),control_behavior:condition(item)});wire(a,l.at(X,row));controlled.push(a.entity_number);
  const p={kind:'input',label:item,items:[item],entity:source.entity_number,x:source.position.x,y:source.position.y,direction:4,externalSide:'west',perMinute:rate};inputs.push(p);l.ports.push(p);
 }
 l.loops.push({name:'Blue science consumer',reader:loop[0].entity_number,controlled,capacity:loop.length*8,limits});
 const outputColumn=X+W+2;
 for(const row of [Y-6,Y+H+6])for(let x=X+5;x<=outputColumn;x++)l.belt(x,row,x===outputColumn?(row<Y?8:0):4);
 for(let row=Y-5;row<Y+3;row++)l.belt(outputColumn,row,8);
 for(let row=Y+H+5;row>Y+3;row--)l.belt(outputColumn,row,0);
 l.belt(outputColumn,Y+3,4);arm(outputColumn+1,Y+3,12,filter('chemical-science-pack'));const chest=l.add('wooden-chest',outputColumn+2,Y+3,{bar:1});l.ports.push({kind:'output',label:'Blue science',items:['chemical-science-pack'],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,perMinute:60,externalSide:'east'});
 const options={minX:-2,maxX:112,minY:-1,maxY:44,startDirection:4,endDirection:4},connections=[];
 for(const c of [red,engine]){
  const p=c.ports.find(p=>p.kind==='output'),target=inputs.find(p2=>p2.items[0]===p.items[0]);l.remove(p.entity);const e=l.belt(Math.floor(p.x),Math.floor(p.y),4);l.ports=l.ports.filter(q=>q!==p&&q!==target);const blocked=new Set(inputs.filter(q=>q!==target).flatMap(q=>[1,2,3].map(d=>`${Math.floor(q.x)-d},${Math.floor(q.y)}`)));const route=l.route(e.position,{x:target.x,y:target.y},{...options,blocked});connections.push({item:p.items[0],source:e.entity_number,target:target.entity,route});
 }
 const sulfur=inputs.find(p=>p.items[0]==='sulfur'),s=l.belt(-2,24,4);l.route(s.position,{x:sulfur.x,y:sulfur.y},options);Object.assign(sulfur,{entity:s.entity_number,x:s.position.x,y:s.position.y});
 await fs.writeFile(path.join(out,'components/blue-manifest.json'),JSON.stringify(frozen,null,2)+'\n');
 const machineCounts={};for(const e of l.entities)if(e.recipe)machineCounts[e.recipe]=(machineCounts[e.recipe]||0)+1;
 return {entities:l.entities,wires:l.wires,ports:l.ports,loops:l.loops,footprint:starterBounds(l.entities,raw),machineCounts,components:l.components.map(({map,ports,...c})=>c),connections};
}
