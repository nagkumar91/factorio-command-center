import assert from 'node:assert/strict';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
/** Three dense machine rows around a controlled loop; solids only. */
export function makeRingBlock(raw,{id,top=[],inside=[],bottom=[],feeds=[],products=[],limits,headroom=.88,balanced=false}){
 const C=Math.max(top.length,inside.length,bottom.length),W=C*3+3,H=6,entities=[],wires=[],ports=[],loop=[],controlled=[],machineCounts={};let next=1;
 const occupied=new Map();const add=(name,x,y,extra={})=>{const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};const radius=name==='assembling-machine-2'?1:0;for(let u=x-radius;u<=x+radius;u++)for(let v=y-radius;v<=y+radius;v++){assert(!occupied.has(u+','+v),id+' collision '+name+' '+u+','+v);occupied.set(u+','+v,e);}entities.push(e);return e;};
 const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d}),arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
 const filter=names=>({use_filters:true,filters:names.map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))}),wire=(a,b)=>wires.push([a.entity_number,1,b.entity_number,1]);
 const below=item=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:limits[item]}});
 for(let x=0;x<=W;x++)loop.push(belt(x,0,x===W&&!balanced?8:4));if(!balanced)for(let y=1;y<=H;y++)loop.push(belt(W,y,y===H?12:8));else loop.push(belt(W,H,12));for(let x=W-1;x>=0;x--)loop.push(belt(x,H,x===0?0:12));for(let y=H-1;y>0;y--)loop.push(belt(0,y,0));
 const at=(x,y)=>loop.find(e=>e.position.x===x+.5&&e.position.y===y+.5);loop[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
 for(const [row,recipes]of [['top',top],['inside',inside],['bottom',bottom]])for(const [i,recipe]of recipes.entries()){
  const x=3+i*3,y=row==='top'?-3:row==='inside'?3:9,ay=row==='top'?-1:row==='inside'?1:7,d=row==='top'?8:0,ly=row==='bottom'?6:0;
  add('assembling-machine-2',x,y,{recipe});machineCounts[recipe]=(machineCounts[recipe]||0)+1;
  const names=raw.recipe[recipe].ingredients.filter(i=>i.type!=='fluid').map(i=>i.name);assert(raw.recipe[recipe].ingredients.every(i=>i.type!=='fluid'),id+' wet recipe unsupported');
  const inputXs=['iron-gear-wheel','inserter'].includes(recipe)?[-1,0]:[-1];
  for(const dx of inputXs){let extra={};if(recipe==='iron-gear-wheel')extra={control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:'iron-plate',quality:'normal'},comparator:'>',constant:8}}};const a=arm(x+dx,ay,d,{...filter(names),...extra});wire(a,at(x+dx,ly));if(extra.control_behavior)controlled.push(a.entity_number);}
  const oy=row==='inside'?5:ay,od=row==='inside'?0:(d+8)%16,by=row==='inside'?6:ly;
  for(const dx of recipe==='copper-cable'?[0,1]:[1]){const a=arm(x+dx,oy,od,{...filter([recipe]),control_behavior:below(recipe)});wire(a,at(x+dx,by));controlled.push(a.entity_number);}
 }
 let inputRow=1;
 for(const f of feeds){const item=typeof f==='string'?f:f.item,n=typeof f==='string'?1:(f.arms||1),y=inputRow;assert(y+n-1<=H,id+' too many admission rows');const external=belt(-3,y,4);belt(-2,y,n>1?8:4);
  for(let j=0;j<n;j++){if(j)belt(-2,y+j,j===n-1?4:8);const a=arm(-1,y+j,12,{...filter([item]),control_behavior:below(item)});wire(a,at(0,y+j));controlled.push(a.entity_number);}
  ports.push({kind:'input',label:item,item,items:[item],entity:external.entity_number,x:external.position.x,y:external.position.y,position:external.position,direction:4,externalSide:'west',perMinute:typeof f==='object'?f.perMinute:undefined});inputRow+=n;
 }
 if(balanced){
  const split={entity_number:next++,name:'fast-splitter',position:{x:W+1.5,y:1},direction:4};for(const y of[0,1]){assert(!occupied.has((W+1)+','+y));occupied.set((W+1)+','+y,split);}entities.push(split);
  const tail=[[W+2,0,4],[W+3,0,8],...Array.from({length:H-1},(_,i)=>[W+3,i+1,8]),[W+3,H,12],[W+2,H,12],[W+1,H,12],[W+2,1,8],[W+2,H+2,4],[W+3,H+2,0],[W+3,H+1,0]];for(const[x,y,d]of tail){const e=belt(x,y,d);wire(e,loop[0]);loop.push(e);}
  add('fast-underground-belt',W+2,2,{direction:8,type:'input'});add('fast-underground-belt',W+2,H+1,{direction:8,type:'output'});
  assert(products.length===1);const item=products[0];const a=arm(W-1,H+1,0,filter([item]));wire(a,at(W-1,H));belt(W-1,H+2,8);arm(W-1,H+3,0,filter([item]));const chest=add('passive-provider-chest',W-1,H+4,{bar:1});ports.push({kind:'output',label:item,item,items:[item],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:chest.position,externalSide:'east'});
 }
 for(const [i,item]of (balanced?[]:products).entries()){const y=i*2+1;assert(y<=H,id+' too many products');const a=arm(W+1,y,12,filter([item]));wire(a,at(W,y));const chest=add('passive-provider-chest',W+2,y,{bar:1});ports.push({kind:'output',label:item,item,items:[item],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:chest.position,externalSide:'east'});}
 for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 const maximumStock=Object.values(limits).reduce((a,b)=>a+b,0);assert(maximumStock<loop.length*8*headroom,id+' stock exceeds total loop headroom');
 return{id,entities,wires,ports,machineCounts,footprint:starterBounds(entities,raw),loopControl:[{name:id,reader:loop[0].entity_number,controlled,loop:loop.map(e=>e.entity_number),capacity:loop.length*8,maximumStock,limits}]};
}
