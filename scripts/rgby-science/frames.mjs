// Local frame workshop for 30 utility science/min. All coordinates are local.
import assert from 'node:assert/strict';
import {powerStarterLayout,starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export function makeFrames(raw) {
 const entities=[],wires=[],ports=[],occupied=new Map(),machineCounts={},loop=[],controlled=[];
 const key=(x,y)=>`${x},${y}`;
 function add(name,x,y,extra={}) {
  const w=name==='fast-splitter'?1:['assembling-machine-2','chemical-plant'].includes(name)?3:1,h=name==='fast-splitter'?2:w;
  for(let dx=0;dx<w;dx++)for(let dy=0;dy<h;dy++)assert(!occupied.has(key(x-Math.floor(w/2)+dx,y-Math.floor(h/2)+dy)),`Collision ${name} ${x},${y}`);
  const e={entity_number:entities.length+1,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);
  for(let dx=0;dx<w;dx++)for(let dy=0;dy<h;dy++)occupied.set(key(x-Math.floor(w/2)+dx,y-Math.floor(h/2)+dy),e);
  return e;
 }
 const wire=(a,b)=>wires.push([a.entity_number,1,b.entity_number,1]);
 const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
 const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
 const limits={'iron-plate':48,'copper-plate':24,'steel-plate':32,'electronic-circuit':64,'iron-gear-wheel':16,pipe:24,battery:40,'engine-unit':16,'electric-engine-unit':16,'flying-robot-frame':12};
 const condition=item=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:limits[item]}});
 const width=27;
 for(let x=0;x<=width;x++)loop.push(belt(x,0,4));
 loop.push(belt(width,3,12));
 for(let x=width-1;x>=0;x--)loop.push(belt(x,3,x===0?0:12));
 for(let y=2;y>=1;y--)loop.push(belt(0,y,0));
 for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
 const reader=loop[0];reader.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
 // Tested two-lane recirculation balancer: splitter then independent side loads.
 add('fast-splitter',width+1,1,{position:{x:width+1.5,y:1},direction:4});
 for(const [dx,dy,d] of [[2,0,4],[3,0,8],[3,1,8],[3,2,8],[3,3,12],[2,3,12],[1,3,12],[2,1,8],[2,5,4],[3,5,0],[3,4,0]]){const e=belt(width+dx,dy,d); const nearest=[...loop].sort((a,b)=>Math.hypot(a.position.x-e.position.x,a.position.y-e.position.y)-Math.hypot(b.position.x-e.position.x,b.position.y-e.position.y))[0];wire(e,nearest);loop.push(e);}
 add('fast-underground-belt',width+2,2,{direction:8,type:'input'});
 add('fast-underground-belt',width+2,4,{direction:8,type:'output'});
 function control(e,item,near){e.control_behavior=condition(item);wire(e,near);controlled.push(e.entity_number);}
 const slots=[];
 const top=['battery','battery','engine-unit','engine-unit','engine-unit','pipe','iron-gear-wheel'];
 let cx=3;
 for(const recipe of top){slots.push({recipe,x:cx,y:-3});cx+=3;}
 const bottom=[...Array(5).fill('flying-robot-frame'),...Array(3).fill('electric-engine-unit')];
 bottom.forEach((recipe,i)=>slots.push({recipe,x:3+i*3,y:6}));
 for(const s of slots){
  const top=s.y<0,inputD=top?8:0,ay=top?-1:4;
  add(s.recipe==='battery'?'chemical-plant':'assembling-machine-2',s.x,s.y,{recipe:s.recipe,direction:s.recipe==='electric-engine-unit'?8:0});
  machineCounts[s.recipe]=(machineCounts[s.recipe]||0)+1;
  for(const dx of [-1,0])add('fast-inserter',s.x+dx,ay,{direction:inputD,override_stack_size:1});
  const output=add('fast-inserter',s.x+1,ay,{direction:(inputD+8)%16,override_stack_size:1});
  control(output,s.recipe,occupied.get(key(s.x+1,top?0:3)));
 }
 for(const [y,item,rate] of [[0,'iron-plate',60],[1,'copper-plate',20],[2,'steel-plate',20],[3,'electronic-circuit',50]]){
  const source=belt(-3,y,4);belt(-2,y,4);
  const arm=add('fast-inserter',-1,y,{direction:12,override_stack_size:1,...filter(item)});control(arm,item,occupied.get(key(0,y)));
  ports.push({kind:'input',items:[item],label:`Frames · ${item}`,entity:source.entity_number,x:source.position.x,y:source.position.y,direction:4,externalSide:'west',perMinute:rate});
 }
 // Battery input is north-west at direction 0; AM2 input is south at direction 8.
 for(const [recipe,item,rate,y,offset] of [['battery','sulfuric-acid',400,-5,-1],['electric-engine-unit','lubricant',150,8,0]]){
  const xs=slots.filter(s=>s.recipe===recipe).map(s=>s.x+offset);
  for(let x=Math.min(...xs);x<=Math.max(...xs);x++)add('pipe',x,y);
  const p=add('pipe',Math.min(...xs),y+(y<0?-1:1));
  ports.push({kind:'fluid',items:[item],label:`Frames · ${item}`,entity:p.entity_number,x:p.position.x,y:p.position.y,externalSide:y<0?'north':'south',perMinute:rate});
 }
 const output=add('steel-chest',32,3),arm=add('fast-inserter',31,3,{direction:12,override_stack_size:1,...filter('flying-robot-frame')});
 ports.push({kind:'output',items:['flying-robot-frame'],label:'Frames · east output chest',entity:output.entity_number,x:output.position.x,y:output.position.y,externalSide:'east',perMinute:10});
 ports.push({kind:'power',items:[],label:'Frames · external electricity',entity:0,x:0,y:0});
 const bp={entities,wires};
 // Raw dumps can classify steel chests as logistic containers; helper expects container.
 const helperRaw={...raw,container:{...raw['logistic-container'],...raw.container}};
 powerStarterLayout(bp,ports,helperRaw);
 bp.wires.push(...wires);
 // Pole placement may replace the array; ensure all imported identities match.
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

 const capacity=loop.length*8,maximumStock=Object.values(limits).reduce((a,b)=>a+b,0);
 assert(maximumStock<capacity*.75);
 return {entities:bp.entities,wires:bp.wires,ports,loopControl:[{name:'Frames',reader:reader.entity_number,controlled,loop:loop.map(e=>e.entity_number),limits,capacity,maximumStock,width}],machineCounts,footprint:starterBounds(bp.entities,helperRaw)};
}
