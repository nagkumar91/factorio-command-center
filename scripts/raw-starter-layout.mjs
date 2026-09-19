// Small, independent production cells. Every net carries one material.
// Routing may use yellow underground belts only after Logistics is available.
import {starterMachineFor,starterMachineResearch} from './starter-machines.mjs';
const directions=[[0,-1,0],[1,0,4],[0,1,8],[-1,0,12]];
const key=(x,y)=>x+','+y;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
class Heap{
 constructor(){this.a=[];}
 push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p].score<=v.score)break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}
 pop(){const result=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].score<this.a[c].score)c++;if(this.a[c].score>=last.score)break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return result;}
}
export function recipeChain(product,raw,rawInputs,selectRecipe){
 const nodes=[],seen=new Set(),active=new Set();
 function visit(item){
  if(rawInputs.has(item)||seen.has(item))return;
  if(active.has(item))throw Error('Recipe cycle: '+item);
  active.add(item);
  const recipe=selectRecipe(item);
  if(!recipe)throw Error('No early recipe: '+item);
  for(const i of Object.values(recipe.ingredients||{}))visit(i.name);
  active.delete(item);seen.add(item);nodes.push({item,recipe});
 }
 visit(product);return nodes;
}
export function makeRawLayout({product,nodes,raw,technologies,attempt=0,consumerPriority}){
 const entities=[],occupied=new Map(),reserved=new Map(),nets=new Map(),ports=[],poles=[];
 const pitch=attempt<12?8:attempt<64?9:attempt<192?10:12;
 const choices=[Math.ceil(Math.sqrt(nodes.length)),1,Math.floor(Math.sqrt(nodes.length)),Math.ceil(Math.sqrt(nodes.length))+1];
 const cols=Math.max(1,Math.min(5,choices[attempt%4]));
 const margin=4+Math.floor(attempt/8),maxX=9+cols*pitch+margin,maxY=Math.max(18,8+Math.ceil(nodes.length/cols)*pitch)+margin;
 let next=1,activeRecipe;
 const netFor=item=>{if(!nets.has(item))nets.set(item,{item,fluid:!!raw.fluid[item],targets:[]});return nets.get(item);};
 function add(name,x,y,props={},w=1,h=1){
  const entity={entity_number:next++,name,position:{x,y},...props};
  entity.tags={...props.tags,starter_entity:entity.entity_number};
  for(let tx=Math.round(x-w/2);tx<x+w/2-.01;tx++)for(let ty=Math.round(y-h/2);ty<y+h/2-.01;ty++){
   const k=key(tx,ty);if(occupied.has(k))throw Error('Overlap '+name+' '+k);occupied.set(k,{entity,fluid:props.tags?.fluid});
  }
  entities.push(entity);return entity;
 }
 function reserve(item,p,source=false){
  const k=key(p.x,p.y);if(occupied.has(k)||reserved.has(k))throw Error('Port overlap '+item+' '+k);
  const net=netFor(item);reserved.set(k,item);if(source)net.source=p;else {if(activeRecipe)p.targetRecipe=activeRecipe;net.targets.push(p);}
 }
 function inserter(item,x,y,d,source=false){
  const [dx,dy]=directions.find(a=>a[2]===d);
  add('inserter',x+.5,y+.5,{direction:d});
  // Direction points toward pickup. Sources are the inserter's drop tile.
  reserve(item,{x:x+dx*(source?-1:1),y:y+dy*(source?-1:1),stopDirection:(d+8)%16},source);
 }
 function pole(x,y){poles.push(add('small-electric-pole',x+.5,y+.5));}
 let finalEntity;
 const placement=[...nodes.keys()];
 if(attempt>=4){
  let seed=attempt*134775813+1;
  for(let i=placement.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[placement[i],placement[j]]=[placement[j],placement[i]];}
 }
 nodes.forEach((node,nodeIndex)=>{
  activeRecipe=node.recipe.name;
  const index=placement[nodeIndex];
  // Alternate rows keep related stages close when crossing a row boundary.
  const row=Math.floor(index/cols),column=row%2?cols-1-index%cols:index%cols;
  const cx=8+column*pitch,cy=5+row*pitch;
  const r=node.recipe,category=r.category||'crafting';
  const machine=starterMachineFor(r,raw);
  if(!machine)throw Error('Unsupported machine for '+r.name);
  const proto=raw.furnace[machine]||raw['assembling-machine'][machine];
  const required=starterMachineResearch[machine];
  if(required&&!technologies.has(required))throw Error('Needs '+required+': '+r.name);
  const w=Math.ceil(proto.selection_box[1][0]-proto.selection_box[0][0]),h=Math.ceil(proto.selection_box[1][1]-proto.selection_box[0][1]);
  const mx=cx+(w%2)/2,my=cy+(h%2)/2;
  const machineEntity=add(machine,mx,my,{...(category==='smelting'?{}:{recipe:r.name}),tags:{production_recipe:r.name}},w,h);
  const solid=Object.values(r.ingredients||{}).filter(i=>i.type!=='fluid');
  const fluidInputs=Object.values(r.ingredients||{}).filter(i=>i.type==='fluid');
  const fluidResults=Object.values(r.results||{}).filter(i=>i.type==='fluid');
  if(category==='smelting'){
   inserter(solid[0].name,cx-2,cy-1,12);
   inserter('coal',cx,cy+1,8);
   if(node.item===product){add('inserter',cx+1.5,cy-.5,{direction:12});finalEntity=add('wooden-chest',cx+2.5,cy-.5,{bar:1});}
   else inserter(node.item,cx+1,cy-1,12,true);
   pole(cx-2,cy-2);pole(cx+1,cy+1);
  }else{
   const radius=(w-1)/2;
   // Keep top/bottom corners free for power, and fluid ports on their own tiles.
   const slots=[[-radius-1,0,12],[0,-radius-1,0],[0,radius+1,8],[-radius-1,-1,12],[-radius-1,1,12],[1,radius+1,8],[-1,radius+1,8]];
   const fluidTiles=new Set();
   for(const [type,list]of [['input',fluidInputs],['output',fluidResults]]){
    const boxes=(proto.fluid_boxes||[]).filter(b=>b.production_type===type);
    list.forEach((f,i)=>{
     const box=boxes[(f.fluidbox_index||i+1)-1],connection=box.pipe_connections[0],d=connection.direction;
     const [dx,dy]=directions.find(a=>a[2]===d);
     const p={x:Math.round(mx+connection.position[0]+dx-.5),y:Math.round(my+connection.position[1]+dy-.5)};
     fluidTiles.add(key(p.x,p.y));
     add('pipe',p.x+.5,p.y+.5,{tags:{fluid:f.name}});
     // Keep the tile immediately outside each machine connection available.
     // This prevents an unrelated belt from sealing the only approach.
     reserve(f.name,{x:p.x+dx,y:p.y+dy,stopDirection:type==='input'?(d+8)%16:d},type==='output');
    });
   }
   let used=0;
   for(const i of solid){
    let slot;while(used<slots.length){const s=slots[used++];if(!fluidTiles.has(key(cx+s[0],cy+s[1]))) {slot=s;break;}}
    if(!slot)throw Error('Too many solid ports: '+r.name);
    inserter(i.name,cx+slot[0],cy+slot[1],slot[2]);
   }
   if(!raw.fluid[node.item]){
    if(node.item===product){add('inserter',cx+radius+1.5,cy+.5,{direction:12});finalEntity=add('wooden-chest',cx+radius+2.5,cy+.5,{bar:1});}
    else inserter(node.item,cx+radius+1,cy,12,true);
   }
   // Refinery side poles can reach all fluid equipment; assembler corners cover inserters.
   for(const dx of [-radius-1,radius+1])for(const dy of [-radius-1,radius+1])pole(cx+dx,cy+dy);
  }
 });
 if(raw.fluid[product]){
  finalEntity=add('pipe',.5,23.5,{tags:{fluid:product,output_fluid:product}});
  reserve(product,{x:1,y:23,stopDirection:12});
 }
 const rawOrder=['iron-ore','copper-ore','coal','stone','wood','water','crude-oil'];
 for(const net of nets.values())if(!net.source){
  const row=rawOrder.indexOf(net.item);if(row<0)throw Error('Intermediate exposed as input: '+net.item);
  const y=2+row*3;
  const entity=add(net.fluid?'pipe':'transport-belt',.5,y+.5,{...(net.fluid?{}:{direction:4}),tags:net.fluid?{fluid:net.item}:{material:net.item}});
  ports.push({kind:net.fluid?'fluid':'input',label:net.item,entity:entity.entity_number,items:[net.item],x:.5,y:y+.5,direction:4,externalSide:'west'});
  // Protect the first inward tile so another route cannot block an entrance.
  // It may turn or enter an underground connection after the ordinary port.
  net.source={x:1,y};
  reserved.set(key(net.source.x,net.source.y),net.item);
  net.sourceDirection=4;
 }
 function canUse(x,y,net,goal,extra=false){
  if(x<1||x>maxX||y<0||y>maxY)return false;
  const k=key(x,y),occ=occupied.get(k),res=reserved.get(k);
  if(occ)return false;
  if(res&&!(x===goal.x&&y===goal.y&&res===net.item))return false;
  if(net.fluid){
   for(const [dx,dy]of directions){
    const p=occupied.get(key(x+dx,y+dy));
    if(p?.fluid&&p.fluid!==net.item)return false;
    const other=reserved.get(key(x+dx,y+dy));
    if(other&&raw.fluid[other]&&other!==net.item)return false;
   }
  }
  return true;
 }
 function route(start,goal,net,previous){
  const queue=new Heap(),best=new Map(),initial={x:start.x,y:start.y,dir:previous??net.sourceDirection??start.stopDirection??-1,jump:0,g:0,score:distance(start,goal)};
  const tunnelName=net.fluid?'pipe-to-ground':'underground-belt',reach=net.fluid?10:5;
  const priorEnds=[];
  for(const [position,cell]of occupied){
   const e=cell.entity;
   if(e?.name===tunnelName){
    const [x,y]=position.split(',').map(Number);
    priorEnds.push({x,y,inward:((e.direction||0)+(net.fluid||e.type==='output'?8:0))%16});
   }else if(cell.routingTunnel!==undefined&&cell.fluid===(net.fluid?net.item:null)){
    const [x,y]=position.split(',').map(Number);priorEnds.push({x,y,inward:cell.routingTunnel});
   }
  }
  function clearTunnel(p,x,y,d){
   const ends=[...priorEnds];
   for(let q=p;q?.prev;q=q.prev)if(q.span>1){ends.push({x:q.prev.x,y:q.prev.y,inward:q.dir},{x:q.x,y:q.y,inward:(q.dir+8)%16});}
   for(const a of [{x:p.x,y:p.y,inward:d},{x,y,inward:(d+8)%16}])for(const b of ends){
    if(b.inward!==(a.inward+8)%16)continue;
    const [dx,dy]=directions.find(v=>v[2]===a.inward),span=(b.x-a.x)*dx+(b.y-a.y)*dy;
    if(span>0&&span<=reach&&(dx?b.y===a.y:b.x===a.x))return false;
   }
   return true;
  }
  const stateKey=p=>key(p.x,p.y)+','+p.dir+','+p.jump;
  queue.push(initial);best.set(stateKey(initial),0);
  let iterations=0;
  while(queue.a.length&&iterations++<100000){
   const p=queue.pop();if(p.g!==best.get(stateKey(p)))continue;
   if(p.x===goal.x&&p.y===goal.y&&!p.jump){
    const path=[];let q=p;while(q.prev){path.push(q);q=q.prev;}path.reverse();return path;
   }
   for(const [dx,dy,d]of directions){
    if(p.dir>=0&&d===(p.dir+8)%16)continue;
    if(p.jump&&d!==p.dir)continue;
    if(net.external&&p.x===0&&d!==4)continue;
    const push=(x,y,g,jump,span)=>{
     for(let ancestor=p;ancestor;ancestor=ancestor.prev)if(ancestor.x===x&&ancestor.y===y)return;
     const q={x,y,dir:d,jump,g,score:g+distance({x,y},goal),prev:p,span};
     const k=stateKey(q);if(g<(best.get(k)??Infinity)){best.set(k,g);queue.push(q);}
    };
    if(canUse(p.x+dx,p.y+dy,net,goal))push(p.x+dx,p.y+dy,p.g+1+(p.dir>=0&&p.dir!==d?.25:0),0,1);
    const tunnels=net.fluid||technologies.has('logistics');
    // Port tiles remain ordinary belts/pipes, so inserters always have a visible pickup.
    const sourceTunnel=!net.external&&p.x===start.x&&p.y===start.y;
    if(!tunnels||p.jump||(p.dir>=0&&p.dir!==d)||(reserved.has(key(p.x,p.y))&&!sourceTunnel)||occupied.has(key(p.x,p.y)))continue;
    for(let span=2;span<=(net.fluid?10:5);span++){
     const x=p.x+dx*span,y=p.y+dy*span;
     if(!canUse(x,y,net,goal)||reserved.has(key(x,y)))continue;
     let blocked=false;for(let j=1;j<span;j++)if(occupied.has(key(p.x+dx*j,p.y+dy*j))||reserved.has(key(p.x+dx*j,p.y+dy*j)))blocked=true;
     if(blocked&&clearTunnel(p,x,y,d))push(x,y,p.g+span+3,1,span);
    }
   }
  }
  throw Error('No route '+net.item+' to '+key(goal.x,goal.y));
 }
 function placeNet(net){
  let start=net.source,previous;
  const targets=net.targets.slice(),path=[{...start,span:1}];
  while(targets.length){
   targets.sort((a,b)=>distance(start,a)-distance(start,b)||a.y-b.y);
   // Change target order between attempts to escape a blocked corridor.
   const goal=targets.splice(attempt%4===3&&targets.length>1?1:0,1)[0];
   const segment=route(start,goal,net,previous);
   for(let i=0;i<segment.length;i++){
    const prev=path.at(-1),step=segment[i];
    if(step.span>1){prev.tunnelStart=true;prev.direction=step.dir;step.tunnelEnd=true;step.direction=step.dir;prev.tunnelKey=step.tunnelKey=entities.length+':'+path.length;}
    else if(!prev.tunnelEnd)prev.direction=step.dir;
    if(occupied.has(key(step.x,step.y)))throw Error('Route repeated tile');
    path.push(step);
   }
   // Commit this segment's occupied cells before continuing the same net.
   for(const step of path)occupied.set(key(step.x,step.y),{routing:true,fluid:net.fluid?net.item:null,routingTunnel:step.tunnelStart?step.direction:step.tunnelEnd?(step.direction+8)%16:undefined});
   // The last target is a normal belt: let the next segment turn away from it.
   start=goal;previous=segment.at(-1)?.dir??previous;
  }
  if(!net.fluid&&start.stopDirection!==undefined)path.at(-1).direction=start.stopDirection;
  // Replace temporary reservations with the actual saved transport entities.
  for(const p of path)occupied.delete(key(p.x,p.y));
  for(const p of path){
   const tunnel=p.tunnelStart||p.tunnelEnd;
   const props=net.fluid?{...(tunnel?{direction:p.tunnelStart?(p.direction+8)%16:p.direction}:{}),tags:{fluid:net.item,tunnel:p.tunnelKey}}:
    {direction:p.direction??previous??4,...(tunnel?{type:p.tunnelStart?'input':'output'}:{}),tags:{material:net.item,tunnel:p.tunnelKey}};
   const entity=add(net.fluid?(tunnel?'pipe-to-ground':'pipe'):(tunnel?'underground-belt':'transport-belt'),p.x+.5,p.y+.5,props);
   occupied.get(key(p.x,p.y)).fluid=net.fluid?net.item:null;
   if(p===path[0]&&net.external)ports.push({kind:net.fluid?'fluid':'input',label:net.item,entity:entity.entity_number,items:[net.item],x:p.x+.5,y:p.y+.5,direction:4,externalSide:'west'});
  }
 }
 const routed=[];
 for(const net of [...nets.values()].sort((a,b)=>b.targets.length-a.targets.length)){
  if(net.fluid||net.targets.length<2||!technologies.has('logistics')){routed.push(net);continue;}
  // A balanced branch gives each consumer a share immediately. A serial line
  // would let a fast gear/circuit assembler starve all consumers behind it.
  const n=net.targets.length,w=n,h=2*n,targets=net.targets.slice().sort((a,b)=>a.y-b.y||a.x-b.x);
  let best;
  for(let x=3;x<=maxX-w;x++)for(let y=1;y<=maxY-h;y++){
   let clear=true;
   for(let a=x;a<x+w&&clear;a++)for(let b=y-1;b<y+h;b++)if(occupied.has(key(a,b))||reserved.has(key(a,b))){clear=false;break;}
   if(!clear)continue;
   const score=distance(net.source,{x,y:y-1})+targets.reduce((total,t,i)=>total+distance(t,{x:x+Math.min(i,n-2)+(i===n-1?1:0),y:y+2*Math.min(i,n-2)+1}),0);
   if(!best||score<best.score)best={x,y,score};
  }
  if(!best)throw Error('No splitter space for '+net.item);
  const {x,y}=best,entry={x,y:y-1,stopDirection:8};
  reserved.set(key(entry.x,entry.y),net.item);
  routed.push({...net,targets:[entry]});
  const outputs=[];
  for(let i=0;i<n-1;i++){
   add('splitter',x+i+1,y+2*i+.5,{direction:8,tags:{material:net.item}},2,1);
   outputs.push({x:x+i,y:y+2*i+1});
   if(i<n-2)add('transport-belt',x+i+1.5,y+2*i+1.5,{direction:8,tags:{material:net.item}});
   else outputs.push({x:x+i+1,y:y+2*i+1});
  }
  for(const output of outputs){
   reserved.set(key(output.x,output.y),net.item);
   const order=consumerPriority?.[net.item];
   if(order){const priority=target=>{const i=order.indexOf(target.targetRecipe);return i<0?order.length:i;};targets.sort((a,b)=>priority(a)-priority(b)||distance(output,a)-distance(output,b));}
   else targets.sort((a,b)=>distance(output,a)-distance(output,b));
   routed.push({item:net.item,fluid:false,source:output,sourceDirection:8,targets:[targets.shift()]});
  }
 }
 const ordered=routed.sort((a,b)=>(b.fluid-a.fluid)||(b.targets.length-a.targets.length)||a.item.localeCompare(b.item));
 if(attempt%4===1)ordered.reverse();
 if(attempt%4===2)ordered.sort((a,b)=>a.item.localeCompare(b.item));
 for(const net of ordered)placeNet(net);
 pole(0,0);
 ports.push({kind:'power',label:'P · External power',items:[],entity:poles.at(-1).entity_number,x:.5,y:.5});
 // Saved copper wires connect the whole build; no automatic connection assumed.
 const wired=new Set([poles[0]?.entity_number]),wires=[];
 let bridges=0;
 while(wired.size<poles.length){
  let edge;
  for(const a of poles.filter(p=>wired.has(p.entity_number)))for(const b of poles.filter(p=>!wired.has(p.entity_number))){
   const d=Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);
   if(d<=7.5&&(!edge||d<edge.d))edge={a,b,d};
  }
  if(!edge){
   if(bridges++>nodes.length*8)throw Error('Disconnected pole grid');
   let bridge;
   for(const a of poles.filter(p=>wired.has(p.entity_number)))for(const b of poles.filter(p=>!wired.has(p.entity_number))){
    for(let x=Math.floor(a.position.x)-7;x<=a.position.x+7;x++)for(let y=Math.floor(a.position.y)-7;y<=a.position.y+7;y++){
     if(x<1||y<0||occupied.has(key(x,y))||reserved.has(key(x,y)))continue;
     const da=Math.hypot(x+.5-a.position.x,y+.5-a.position.y),db=Math.hypot(x+.5-b.position.x,y+.5-b.position.y);
     if(da>7.5||db>7.5)continue;
     if(!bridge||da+db<bridge.score)bridge={x,y,score:da+db};
    }
   }
   if(!bridge)throw Error('Disconnected pole grid');
   pole(bridge.x,bridge.y);continue;
  }
  wires.push([edge.a.entity_number,5,edge.b.entity_number,5]);wired.add(edge.b.entity_number);
 }
 // Reject ambiguous automatic underground pairings before the native test.
 const underground=entities.filter(e=>e.name==='underground-belt');
 for(const a of underground){
  const inward=e=>((e.direction||0)+(e.type==='output'?8:0))%16;
  const d=inward(a),[dx,dy]=directions.find(v=>v[2]===d);
  // Factorio can reverse an underground end to pair two opposing inputs.
  // Check the nearest physically facing end, including the opposite flow.
  const paired=underground.filter(b=>b!==a&&inward(b)===(d+8)%16).map(b=>({b,d:(b.position.x-a.position.x)*dx+(b.position.y-a.position.y)*dy})).filter(v=>v.d>0&&v.d<=5&&(dx? v.b.position.y===a.position.y:v.b.position.x===a.position.x)).sort((a,b)=>a.d-b.d)[0];
  if(!paired||paired.b.tags.tunnel!==a.tags.tunnel)throw Error('Ambiguous underground '+a.tags.material);
 }
 const undergroundPipes=entities.filter(e=>e.name==='pipe-to-ground');
 for(const a of undergroundPipes){
  const d=((a.direction||0)+8)%16,[dx,dy]=directions.find(v=>v[2]===d);
  const paired=undergroundPipes.filter(b=>b!==a&&(b.direction||0)===d).map(b=>({b,d:(b.position.x-a.position.x)*dx+(b.position.y-a.position.y)*dy})).filter(v=>v.d>0&&v.d<=10&&(dx?v.b.position.y===a.position.y:v.b.position.x===a.position.x)).sort((a,b)=>a.d-b.d)[0];
  if(!paired||paired.b.tags.tunnel!==a.tags.tunnel)throw Error('Ambiguous underground pipe '+a.tags.fluid);
 }
 ports.push({kind:raw.fluid[product]?'fluid-output':'output',label:'OUT · '+product,entity:finalEntity.entity_number,items:[product],x:finalEntity.position.x,y:finalEntity.position.y});
 const minX=Math.min(...entities.map(e=>e.position.x)),maxPX=Math.max(...entities.map(e=>e.position.x));
 const minY=Math.min(...entities.map(e=>e.position.y)),maxPY=Math.max(...entities.map(e=>e.position.y));
 const dx=Math.round((minX+maxPX)/2),dy=Math.round((minY+maxPY)/2);
 for(const e of entities){e.position.x-=dx;e.position.y-=dy;}
 for(const p of ports){p.x-=dx;p.y-=dy;}
 return {blueprint:{item:'blueprint',version:562949958467584,entities,wires,icons:[{index:1,signal:{type:raw.fluid[product]?'fluid':'item',name:product}}]},ports,machines:nodes.length,pitch};
}
