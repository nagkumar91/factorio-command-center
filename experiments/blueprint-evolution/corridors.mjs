import {ALL,tiles,vectors,validateSolution} from './wfc.mjs';
const ordinary=new Set(['transport-belt','fast-transport-belt','express-transport-belt']);
const transport=new Set([...ordinary,'underground-belt','fast-underground-belt','express-underground-belt','splitter','fast-splitter','express-splitter']);
const key=(x,y)=>`${x},${y}`;
const point=e=>({x:Math.floor(e.position.x),y:Math.floor(e.position.y)});
const opposite=d=>(d+2)%4;
const rotate=(v,d)=>{let [x,y]=v;for(let i=0;i<d;i+=4)[x,y]=[-y,x];return[x,y];};
export function spatialIndex(blueprint,raw){
 const prototypes=new Map();
 for(const group of Object.values(raw))if(group&&typeof group==='object')for(const proto of Object.values(group))if(proto?.name&&proto.selection_box)prototypes.set(proto.name,proto);
 const grid=new Map(),byId=new Map();
 for(const e of blueprint.entities){
  if(byId.has(e.entity_number))throw Error('Duplicate entity ID');byId.set(e.entity_number,e);
  const proto=prototypes.get(e.name);if(!proto)throw Error('Unknown entity '+e.name);
  let w=Math.ceil(proto.selection_box[1][0]-proto.selection_box[0][0]),h=Math.ceil(proto.selection_box[1][1]-proto.selection_box[0][1]);
  if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];
  for(let x=Math.round(e.position.x-w/2);x<e.position.x+w/2-.001;x++)for(let y=Math.round(e.position.y-h/2);y<e.position.y+h/2-.001;y++){
   const k=key(x,y);if(grid.has(k))throw Error('Collision '+k);grid.set(k,e);
  }
 }
 return {grid,byId,prototypes};
}
export function findCorridors(blueprint,info,raw,{maxCells=160,padding=2}={}){
 const {grid,byId,prototypes}=spatialIndex(blueprint,raw),incoming=new Map(),outgoing=new Map(),protectedIds=new Set((info.ports||[]).map(p=>p.entity));
 const occupiedPoints=[...grid.keys()].map(k=>k.split(',').map(Number));
 const fullBounds={left:Math.min(...occupiedPoints.map(p=>p[0])),right:Math.max(...occupiedPoints.map(p=>p[0])),top:Math.min(...occupiedPoints.map(p=>p[1])),bottom:Math.max(...occupiedPoints.map(p=>p[1]))};
 for(const wire of blueprint.wires||[])for(const id of [wire[0],wire[2]])protectedIds.add(id);
 for(const e of blueprint.entities){
  if(e.control_behavior)protectedIds.add(e.entity_number);
  if(raw.inserter[e.name]){
   const proto=prototypes.get(e.name);
   for(const p of [proto.pickup_position,proto.insert_position||proto.drop_position]){
    if(!p)continue;const [dx,dy]=rotate(p,e.direction||0),target=grid.get(key(Math.floor(e.position.x+dx),Math.floor(e.position.y+dy)));
    if(target)protectedIds.add(target.entity_number);
   }
   // Keep the common one-tile contacts fixed even when a prototype uses
   // animated drop coordinates instead of an explicit drop-position field.
   const [dx,dy]=vectors[(e.direction||0)/4];
   for(const sign of [-1,1]){const target=grid.get(key(Math.floor(e.position.x+dx*sign),Math.floor(e.position.y+dy*sign)));if(target)protectedIds.add(target.entity_number);}
  }
 }
 for(const [k,e] of grid){
  if(!transport.has(e.name)||e.name.includes('underground')&&e.type==='input')continue;
  const [x,y]=k.split(',').map(Number),[dx,dy]=vectors[(e.direction||0)/4],next=grid.get(key(x+dx,y+dy));
  if(!next||next===e||!transport.has(next.name))continue;
  if(!incoming.has(next.entity_number))incoming.set(next.entity_number,new Set());incoming.get(next.entity_number).add(e.entity_number);
  if(!outgoing.has(e.entity_number))outgoing.set(e.entity_number,new Set());outgoing.get(e.entity_number).add(next.entity_number);
 }
 const editable=new Set(blueprint.entities.filter(e=>ordinary.has(e.name)&&e.tags?.material&&!protectedIds.has(e.entity_number)&&incoming.get(e.entity_number)?.size===1&&outgoing.get(e.entity_number)?.size===1).map(e=>e.entity_number));
 const visited=new Set(),models=[];
 for(const id of editable){
  const previous=[...incoming.get(id)][0];if(editable.has(previous)||visited.has(id))continue;
  const chain=[];let current=id;
  while(editable.has(current)&&!visited.has(current)){visited.add(current);chain.push(byId.get(current));current=[...outgoing.get(current)][0];}
  if(chain.length<6)continue;
  if(new Set(chain.map(e=>e.name+'|'+e.tags.material)).size!==1)continue;
  const source=chain[0],sink=chain.at(-1),removed=chain.slice(1,-1),removedIds=new Set(removed.map(e=>e.entity_number));
  const xs=removed.map(e=>point(e).x),ys=removed.map(e=>point(e).y),bounds={left:Math.min(...xs)-padding,right:Math.max(...xs)+padding,top:Math.min(...ys)-padding,bottom:Math.max(...ys)+padding};
  bounds.left=Math.max(bounds.left,fullBounds.left);bounds.right=Math.min(bounds.right,fullBounds.right);bounds.top=Math.max(bounds.top,fullBounds.top);bounds.bottom=Math.min(bounds.bottom,fullBounds.bottom);
  if((bounds.right-bounds.left+1)*(bounds.bottom-bounds.top+1)>maxCells)continue;
  const sourceP=point(source),sinkP=point(sink),sourceDirection=(source.direction||0)/4,goalDirection=(removed.at(-1).direction||0)/4;
  const first=point(removed[0]),last=point(removed.at(-1));
  const blocked=new Set([...grid].filter(([,e])=>!removedIds.has(e.entity_number)).map(([k])=>k));
  // Moving into the tile directly in front of another saved belt would add
  // a side load. Reserve that tile unless it is the intended source socket.
  for(const [k,e] of grid){
   if(!transport.has(e.name)||removedIds.has(e.entity_number)||e===source||e.name.includes('underground')&&e.type==='input')continue;
   const [x,y]=k.split(',').map(Number),[dx,dy]=vectors[(e.direction||0)/4],next=key(x+dx,y+dy);
   if(!removedIds.has(grid.get(next)?.entity_number))blocked.add(next);
  }
  const cells=[],index=new Map();
  for(let y=bounds.top;y<=bounds.bottom;y++)for(let x=bounds.left;x<=bounds.right;x++)if(!blocked.has(key(x,y))){index.set(key(x,y),cells.length);cells.push({x,y});}
  if(!index.has(key(first.x,first.y))||!index.has(key(last.x,last.y)))continue;
  const start={index:index.get(key(first.x,first.y)),side:opposite(sourceDirection)},goal={index:index.get(key(last.x,last.y)),side:goalDirection};
  const neighbors=cells.map(p=>vectors.map(([dx,dy])=>index.get(key(p.x+dx,p.y+dy))??-1));
  const domains=cells.map((_,i)=>{
   let mask=ALL;
   for(let d=0;d<4;d++)if(neighbors[i][d]<0){
    const required=i===start.index&&d===start.side?-1:i===goal.index&&d===goal.side?1:0;
    mask&=tiles.reduce((m,t,id)=>m|(t.edges[d]===required?1<<id:0),0);
   }
   return mask;
  });
  const baseline=Array(cells.length).fill(0);
  let prev=sourceP;
  for(const e of removed){const p=point(e),input=vectors.findIndex(([dx,dy])=>p.x+dx===prev.x&&p.y+dy===prev.y),output=(e.direction||0)/4;baseline[index.get(key(p.x,p.y))]=tiles.findIndex(t=>t.input===input&&t.output===output);prev=p;}
  const model={id:`corridor-${source.entity_number}-${sink.entity_number}`,material:source.tags.material,tier:source.name,cells,neighbors,domains,start,goal,baseline,bounds,source:source.entity_number,sink:sink.entity_number,removedIds:[...removedIds],removedCount:removed.length};
  if(baseline.some((tile,i)=>tile<0||!(domains[i]&(1<<tile)))||!validateSolution(model,baseline))continue;
  model.heuristic=shortestPath(model)||baseline;
  model.heuristicSaving=removed.length-model.heuristic.filter(Boolean).length;
  models.push(model);
 }
 return models.sort((a,b)=>b.heuristicSaving-a.heuristicSaving||b.removedCount-a.removedCount);
}
export function shortestPath(model){
 const queue=[{at:model.start.index,entry:model.start.side,prev:null}],seen=new Set();let end;
 for(let cursor=0;cursor<queue.length;cursor++){
  const node=queue[cursor],key=node.at+':'+node.entry;if(seen.has(key))continue;seen.add(key);
  for(let t=1;t<tiles.length;t++){
   const tile=tiles[t];if(tile.input!==node.entry||!(model.domains[node.at]&(1<<t)))continue;
   const next=model.neighbors[node.at][tile.output];
   const step={...node,tile:t};
   if(next<0){if(node.at===model.goal.index&&tile.output===model.goal.side){end=step;break;}continue;}
   let repeats=false;for(let p=node;p;p=p.prev)if(p.at===next){repeats=true;break;}if(repeats)continue;
   queue.push({at:next,entry:opposite(tile.output),prev:step});
  }
  if(end)break;
 }
 if(!end)return null;
 const choice=Array(model.cells.length).fill(0);for(let p=end;p;p=p.prev)choice[p.at]=p.tile;
 return validateSolution(model,choice)?choice:null;
}
export function applyCorridors(blueprint,changes,raw){
 const result=structuredClone(blueprint),removed=new Set(changes.flatMap(({model})=>model.removedIds));
 let id=Math.max(...result.entities.map(e=>e.entity_number))+1;
 result.entities=result.entities.filter(e=>!removed.has(e.entity_number));
 for(const {model,choice} of changes){
  if(!validateSolution(model,choice))throw Error('Invalid corridor result');
  for(let i=0;i<choice.length;i++)if(choice[i]){
   const p=model.cells[i];result.entities.push({entity_number:id,name:model.tier,position:{x:p.x+.5,y:p.y+.5},direction:tiles[choice[i]].output*4,tags:{material:model.material,starter_entity:id}});id++;
  }
 }
 spatialIndex(result,raw);return result;
}
