// Remove transport-only rows/columns while preserving the actual connection
// graph, then cover the machines with a connected medium/big pole network.
const directions=[[0,-1],[1,0],[0,1],[-1,0]];
const vector=d=>directions[(d||0)/4];
const key=(x,y)=>x+','+y;
const beltNames=new Set(['transport-belt','underground-belt','splitter']);
const poleNames=new Set(['small-electric-pole','medium-electric-pole','big-electric-pole']);
const rotate=([x,y],d)=>{for(let n=0;n<(d||0);n+=4)[x,y]=[-y,x];return [x,y];};
const prototypesCache=new WeakMap();
function prototypes(raw){
 if(!prototypesCache.has(raw)){
  const map=new Map();
  for(const kind of ['assembling-machine','furnace','inserter','electric-pole','transport-belt','underground-belt','splitter','pipe','pipe-to-ground','pump','storage-tank','container','display-panel'])for(const p of Object.values(raw[kind]||{}))map.set(p.name,p);
  prototypesCache.set(raw,map);
 }
 return prototypesCache.get(raw);
}
export function starterBounds(entities,raw){
 const boxes=entities.map(e=>entityBox(e,raw));
 const left=Math.min(...boxes.map(b=>b.left)),top=Math.min(...boxes.map(b=>b.top));
 const right=Math.max(...boxes.map(b=>b.right)),bottom=Math.max(...boxes.map(b=>b.bottom));
 return {left,top,right,bottom,width:right-left,height:bottom-top};
}
function entityBox(e,raw){
 const p=prototypes(raw).get(e.name);if(!p)throw Error('Unknown entity '+e.name);
 const box=p.selection_box;let w=Math.ceil(box[1][0]-box[0][0]),h=Math.ceil(box[1][1]-box[0][1]);
 if(e.name==='display-panel')w=h=1;
 if([4,12].includes(e.direction))[w,h]=[h,w];
 return {left:e.position.x-w/2,right:e.position.x+w/2,top:e.position.y-h/2,bottom:e.position.y+h/2};
}
function tileGrid(entities,raw){
 const grid=new Map();
 for(const e of entities){const b=entityBox(e,raw);for(let x=b.left;x<b.right;x++)for(let y=b.top;y<b.bottom;y++){
  const k=key(x,y);if(grid.has(k))throw Error('Overlapping '+e.name+' and '+grid.get(k).name+' at '+k);grid.set(k,e);
 }}
 return grid;
}
function addEdge(graph,a,b){if(!graph.has(a))graph.set(a,new Set());graph.get(a).add(b);}
function tunnelEdges(entities,graph){
 for(const name of ['underground-belt','pipe-to-ground']){
  const fluid=name==='pipe-to-ground',ends=entities.filter(e=>e.name===name),reach=fluid?10:5;
  const inward=e=>((e.direction||0)+(fluid||e.type==='output'?8:0))%16;
  for(const a of ends){
   const d=inward(a),[dx,dy]=vector(d);
   const nearest=ends.filter(b=>b!==a&&inward(b)===(d+8)%16).map(b=>({b,span:(b.position.x-a.position.x)*dx+(b.position.y-a.position.y)*dy})).filter(v=>v.span>0&&v.span<=reach&&(dx?v.b.position.y===a.position.y:v.b.position.x===a.position.x)).sort((a,b)=>a.span-b.span)[0]?.b;
   if(!nearest||nearest.tags?.tunnel!==a.tags?.tunnel)throw Error('Changed underground pairing');
   if(fluid||a.type==='input')addEdge(graph,a.entity_number,nearest.entity_number);
  }
 }
}
function connections(entities,raw,grid){
 const graph=new Map(),contacts=new Map(),fluidPorts=new Map();
 const at=(x,y)=>grid.get(key(Math.floor(x),Math.floor(y)));
 for(const e of entities){
  const id=e.entity_number,[dx,dy]=vector(e.direction);
  if(beltNames.has(e.name)&&!(e.name==='underground-belt'&&e.type==='input')){
   const b=entityBox(e,raw);
   for(let x=b.left;x<b.right;x++)for(let y=b.top;y<b.bottom;y++){
    const next=grid.get(key(x+dx,y+dy));if(next&&next!==e&&beltNames.has(next.name))addEdge(graph,id,next.entity_number);
   }
  }
  if(e.name==='inserter')for(const [role,sign]of [['pickup',1],['drop',-1]])contacts.set(id+':'+role,at(e.position.x+dx*sign,e.position.y+dy*sign)?.entity_number||0);
  const port=(x,y,d,fluid)=>fluidPorts.set(key(x,y)+','+d,{id,fluid,x,y,d});
  if(e.name==='pipe')for(let d=0;d<16;d+=4)port(e.position.x,e.position.y,d,e.tags?.fluid);
  if(e.name==='pipe-to-ground')port(e.position.x,e.position.y,e.direction||0,e.tags?.fluid);
  const p=prototypes(raw).get(e.name),r=raw.recipe[e.recipe||e.tags?.production_recipe];
  if(p.fluid_boxes&&r)for(const [type,list]of [['input',r.ingredients],['output',r.results]]){
   const fluids=Object.values(list||{}).filter(f=>f.type==='fluid'),boxes=p.fluid_boxes.filter(b=>b.production_type===type);
   fluids.forEach((f,i)=>{const box=boxes[(f.fluidbox_index||i+1)-1];if(!box)throw Error('Missing machine fluid port');
    for(const c of box.pipe_connections){const [x,y]=rotate(c.position,e.direction);port(e.position.x+x,e.position.y+y,((c.direction||0)+(e.direction||0))%16,f.name);}
   });
  }
 }
 for(const a of fluidPorts.values()){
  const [dx,dy]=vector(a.d),b=fluidPorts.get(key(a.x+dx,a.y+dy)+','+(a.d+8)%16);
  if(b&&b.id!==a.id){if(a.fluid!==b.fluid)throw Error('Fluid mixing');addEdge(graph,a.id,b.id);}
 }
 tunnelEdges(entities,graph);
 return {graph,contacts};
}
function sameConnections(before,after,removed){
 if(before.contacts.size!==after.contacts.size)return false;
 for(const [id,target]of before.contacts)if(removed.has(target)||after.contacts.get(id)!==target)return false;
 const expected=new Map();
 for(const [id,targets]of before.graph){
  if(removed.has(id))continue;
  const pending=[...targets],seen=new Set();
  while(pending.length){const target=pending.pop();if(seen.has(target))continue;seen.add(target);
   if(removed.has(target))pending.push(...(before.graph.get(target)||[]));
   else if(target!==id)addEdge(expected,id,target);
  }
 }
 const edges=graph=>[...graph].flatMap(([a,targets])=>[...targets].filter(b=>a!==b).map(b=>a+':'+b)).sort().join(',');
 return edges(expected)===edges(after.graph);
}
function compressTransport(entities,ports,raw){
 const protectedIds=new Set(ports.map(p=>p.entity));
 const cuts={columns:0,rows:0};let changed=true;
 while(changed){changed=false;
  for(const axis of ['x','y']){
   let grid=tileGrid(entities,raw),before=connections(entities,raw,grid),bounds=starterBounds(entities,raw);
   const low=axis==='x'?'left':'top',high=axis==='x'?'right':'bottom';
   for(let line=bounds[low];line<bounds[high]-1;line++){
    const onLine=entities.filter(e=>{const b=entityBox(e,raw);return b[low]<=line&&b[high]>line;});
    if(onLine.some(e=>protectedIds.has(e.entity_number)||!['transport-belt','pipe'].includes(e.name)))continue;
    if(onLine.some(e=>{
     const [dx,dy]=axis==='x'?[1,0]:[0,1];
     const a=grid.get(key(Math.floor(e.position.x)-dx,Math.floor(e.position.y)-dy)),b=grid.get(key(Math.floor(e.position.x)+dx,Math.floor(e.position.y)+dy));
     if(a?.name!==e.name||b?.name!==e.name)return true;
     if(e.name==='transport-belt')return !(axis==='x'?[4,12]:[0,8]).includes(e.direction||0)||a.direction!==e.direction||b.direction!==e.direction||a.tags.material!==e.tags.material||b.tags.material!==e.tags.material;
     return a.tags.fluid!==e.tags.fluid||b.tags.fluid!==e.tags.fluid;
    }))continue;
    const removed=new Set(onLine.map(e=>e.entity_number));
    const next=entities.filter(e=>!removed.has(e.entity_number)).map(e=>({...e,position:{...e.position,[axis]:e.position[axis]-(e.position[axis]>line+.5?1:0)}}));
    let nextGrid,nextConnections;
    try{nextGrid=tileGrid(next,raw);nextConnections=connections(next,raw,nextGrid);}catch{continue;}
    if(!sameConnections(before,nextConnections,removed))continue;
    entities=next;grid=nextGrid;before=nextConnections;bounds=starterBounds(entities,raw);
    cuts[axis==='x'?'columns':'rows']++;changed=true;line--;
   }
  }
 }
 const byId=new Map(entities.map(e=>[e.entity_number,e]));
 for(const port of ports){const e=byId.get(port.entity);if(e){port.x=e.position.x;port.y=e.position.y;}}
 return {entities,cuts};
}
function covers(pole,consumer,raw){
 const p=prototypes(raw).get(pole.name),box=prototypes(raw).get(consumer.name).collision_box;
 let w=(box[1][0]-box[0][0])/2,h=(box[1][1]-box[0][1])/2;
 if([4,12].includes(consumer.direction))[w,h]=[h,w];
 return Math.abs(pole.position.x-consumer.position.x)<p.supply_area_distance+w-.001&&Math.abs(pole.position.y-consumer.position.y)<p.supply_area_distance+h-.001;
}
const separation=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);
function wireTree(poles,raw){
 const connected=new Set([poles[0].entity_number]),wires=[],degree=new Map();
 while(connected.size<poles.length){let edge;
  for(const a of poles.filter(p=>connected.has(p.entity_number)))for(const b of poles.filter(p=>!connected.has(p.entity_number))){
   if((degree.get(a.entity_number)||0)>=5||(degree.get(b.entity_number)||0)>=5)continue;
   const distance=separation(a,b),reach=Math.min(prototypes(raw).get(a.name).maximum_wire_distance,prototypes(raw).get(b.name).maximum_wire_distance);
   if(distance<=reach+.00001&&(!edge||distance<edge.distance))edge={a,b,distance};
  }
  if(!edge)break;
  connected.add(edge.b.entity_number);wires.push([edge.a.entity_number,5,edge.b.entity_number,5]);
  for(const p of [edge.a,edge.b])degree.set(p.entity_number,(degree.get(p.entity_number)||0)+1);
 }
 return {connected,wires};
}
function placePower(entities,ports,raw,nextId){
 const grid=tileGrid(entities,raw),bounds=starterBounds(entities,raw),consumers=entities.filter(e=>prototypes(raw).get(e.name).energy_source?.type==='electric');
 const inputs=ports.filter(p=>['input','fluid'].includes(p.kind));
 const left=Math.floor(Math.min(...inputs.map(p=>p.x))),poles=[];
 const free=(name,position)=>{const box=entityBox({name,position},raw);for(let x=box.left;x<box.right;x++)for(let y=box.top;y<box.bottom;y++)if(grid.has(key(x,y)))return false;return true;};
 const add=(name,position)=>{const e={entity_number:nextId++,name,position,tags:{starter_entity:nextId-1}};entities.push(e);poles.push(e);const b=entityBox(e,raw);for(let x=b.left;x<b.right;x++)for(let y=b.top;y<b.bottom;y++)grid.set(key(x,y),e);return e;};
 let dock;
 for(let x=left+1;x<=left+5;x++)for(let y=bounds.top-1;y<=bounds.top+6;y++){
  const position={x,y};if(!free('big-electric-pole',position))continue;
  // Keep every external belt/pipe approach open, including fluid outputs.
  if(ports.some(p=>['input','fluid','fluid-output'].includes(p.kind)&&p.y>y-1&&p.y<y+1&&p.x<x+1&&p.x>=x-1))continue;
  const area=(Math.max(bounds.right,x+1)-Math.min(bounds.left,x-1))*(Math.max(bounds.bottom,y+1)-Math.min(bounds.top,y-1));
  const score=area*100+(x-left)+(y-bounds.top)*2;
  if(!dock||score<dock.score)dock={position,score};
 }
 if(!dock)throw Error('No room for big power connection');
 const big=add('big-electric-pole',dock.position);
 const candidates=[];
 for(let x=left;x<bounds.right;x++)for(let y=Math.min(bounds.top,big.position.y-1);y<bounds.bottom;y++){
  const position={x:x+.5,y:y+.5};if(free('medium-electric-pole',position))candidates.push({name:'medium-electric-pole',position});
 }
 let uncovered=consumers.filter(e=>!covers(big,e,raw));
 while(uncovered.length||poles.length===1){let best;
  for(const candidate of candidates){
   if(!free(candidate.name,candidate.position))continue;
   const covered=uncovered.filter(e=>covers(candidate,e,raw)).length;
   const all=consumers.filter(e=>covers(candidate,e,raw)).length;if(!covered&&uncovered.length||!all)continue;
   const distance=Math.min(...poles.map(p=>separation(p,candidate)));
   const score=covered*1000+all-distance;
   if(!best||score>best.score)best={candidate,score};
  }
  if(!best)throw Error('No space to power '+uncovered.map(e=>e.entity_number).join(','));
  const added=add(best.candidate.name,best.candidate.position);uncovered=uncovered.filter(e=>!covers(added,e,raw));
 }
 for(let bridge=0;bridge<200;bridge++){
  const {connected}=wireTree(poles,raw);if(connected.size===poles.length)break;
  const wired=poles.filter(p=>connected.has(p.entity_number)),unwired=poles.filter(p=>!connected.has(p.entity_number));
  const oldDistance=Math.min(...wired.flatMap(a=>unwired.map(b=>separation(a,b))));let best;
  for(const candidate of candidates){
   if(!free(candidate.name,candidate.position)||!wired.some(p=>separation(p,candidate)<=9))continue;
   const distance=Math.min(...unwired.map(p=>separation(p,candidate)));
   if(distance>=oldDistance-.01)continue;
   if(!best||distance<best.distance)best={candidate,distance};
  }
  if(!best)throw Error('Cannot connect the medium pole network');add(best.candidate.name,best.candidate.position);
 }
 // Remove redundant coverage and bridge poles only if the grid stays connected.
 for(let i=poles.length-1;i>0;i--){
  if(poles.length<=2)break;
  const remaining=poles.filter((_,j)=>i!==j);
  if(consumers.every(e=>remaining.some(p=>covers(p,e,raw)))&&wireTree(remaining,raw).connected.size===remaining.length){
   entities.splice(entities.indexOf(poles[i]),1);poles.splice(i,1);
  }
 }
 const tree=wireTree(poles,raw);if(tree.connected.size!==poles.length)throw Error('Disconnected final power grid');
 if(!consumers.every(e=>poles.some(p=>covers(p,e,raw))))throw Error('Unpowered consumer');
 const power=ports.find(p=>p.kind==='power');Object.assign(power,{entity:big.entity_number,x:big.position.x,y:big.position.y});
 return {wires:tree.wires,poles};
}
export function compactStarterLayout(blueprint,ports,raw){
 const before=starterBounds(blueprint.entities,raw),oldPoles=blueprint.entities.filter(e=>poleNames.has(e.name)).length;
 const stripped=blueprint.entities.filter(e=>!poleNames.has(e.name));
 const {entities,cuts}=compressTransport(stripped,ports,raw);
 const nextId=Math.max(...entities.map(e=>e.entity_number))+1;
 const power=placePower(entities,ports,raw,nextId);
 blueprint.entities=entities;blueprint.wires=power.wires;
 const after=starterBounds(entities,raw);
 return {before:{width:before.width,height:before.height},after:{width:after.width,height:after.height},cuts,polesBefore:oldPoles,polesAfter:power.poles.length};
}

// Circulating belts and circuit wires must keep their complete loop intact.
// These layouts share the pole placement routine without shortening transport.
export function powerStarterLayout(blueprint,ports,raw){
 const entities=blueprint.entities.filter(e=>!poleNames.has(e.name));
 const power=placePower(entities,ports,raw,Math.max(...entities.map(e=>e.entity_number))+1);
 blueprint.entities=entities;blueprint.wires=power.wires;return power.poles;
}

export const starterPowerNote='Connect external electricity to the big electric pole marked P. Medium electric poles distribute it inside the module. Unlock Electric energy distribution 1 before building. Smelting and every intermediate recipe are included.';
export const starterConnectionNote='Follow the A–G input displays on the left: A iron ore, B copper ore, C coal, D stone, E wood, F water and G crude oil. Only required inputs are present. Port spacing varies to save space; use the labeled preview when connecting each module.';
