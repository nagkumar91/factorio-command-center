import assert from 'node:assert/strict';
import {powerStarterLayout} from './compact-starter-layout.mjs';
import {addInputDisplays} from './starter-input-displays.mjs';

export function makeTransportLoop({recipes,products,raw,rawInputs,columns=4,pitch=6,minimumStock=16,limitOverrides={},inputGates={},inputReserveByRecipe={},splitInputFilters=false,inputInserterCounts={}}){
 const proto=new Map(Object.values(raw).flatMap(group=>Object.values(group)).filter(p=>p.selection_box).map(p=>[p.name,p]));
 const entities=[],wires=[],ports=[],loop=[],controlled=[],cells=[];
 const occupied=new Map(),pipes=new Map(),terminals=new Map(),tunnels=[];
 const key=(x,y)=>x+','+y,dirs=[0,4,8,12],vector={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]};
 const limits={};
 for(const id of rawInputs.filter(id=>!raw.fluid[id]))limits[id]=id==='coal'?16:48;
 for(const id of recipes)for(const i of raw.recipe[id].ingredients.filter(i=>i.type==='item'))limits[i.name]=Math.max(limits[i.name]||minimumStock,i.amount*2);
 Object.assign(limits,{'iron-plate':100,'copper-plate':64,'copper-cable':80,'iron-gear-wheel':Math.max(limits['iron-gear-wheel']||0,80)});
 Object.assign(limits,limitOverrides);
 const consumed=new Set(recipes.flatMap(id=>raw.recipe[id].ingredients.filter(i=>i.type==='item').map(i=>i.name)));
 const machineFor=recipe=>recipe.category==='smelting'?'steel-furnace':['assembling-machine-2','chemical-plant','oil-refinery','foundry'].find(id=>raw['assembling-machine'][id].crafting_categories.includes(recipe.category||'crafting'));
 let rows=Math.ceil(recipes.length/columns);if(rows%2)rows++;
 const rowY=[0];for(let row=0;row<rows-1;row++)rowY.push(rowY.at(-1)+(recipes.slice(row*columns,(row+1)*columns).some(id=>['oil-refinery','foundry'].includes(machineFor(raw.recipe[id])))?9:7));
 const lastY=rowY.at(-1),right=4+columns*pitch+1;
 function add(name,x,y,extra={},centered=false){
  const p=proto.get(name);assert(p,name);
  const position=centered?{x,y}:{x:x+.5,y:y+.5};
  let [[a,b],[c,d]]=p.selection_box;if(name==='display-panel')[a,b,c,d]=[-.5,-.5,.5,.5];
  if([4,12].includes(extra.direction))[a,b,c,d]=[b,a,d,c];
  const tiles=[];
  for(let u=Math.floor(position.x+a+.01);u<position.x+c-.01;u++)for(let v=Math.floor(position.y+b+.01);v<position.y+d-.01;v++){
   assert(!occupied.has(key(u,v)),name+' overlaps '+occupied.get(key(u,v))?.name+' at '+key(u,v));tiles.push(key(u,v));
  }
  const e={entity_number:entities.length+1,name,position,...extra};e.tags={...e.tags,starter_entity:e.entity_number};entities.push(e);for(const k of tiles)occupied.set(k,e);return e;
 }
 function belt(x,y,d,onLoop=true){const e=add('transport-belt',x,y,{direction:d,tags:{transport_loop:onLoop}});if(onLoop)loop.push(e.entity_number);return e;}
 for(let row=0;row<rows;row++){
  const y=rowY[row],left=row===0||row===rows-1?0:2;
  for(let x=left;x<=right;x++)belt(x,y,row%2?(x===left?(row===rows-1?0:8):12):(x===right?8:4));
  if(row<rows-1)for(let v=y+1;v<rowY[row+1];v++)belt(row%2?2:right,v,8);
 }
 for(let y=1;y<lastY;y++)belt(0,y,0);
 const reader=occupied.get(key(3,0));reader.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
 const condition=(item,constant,comparator='<')=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator,constant}});
 const arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
 const filters=items=>({use_filters:true,filters:items.map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))});
 function terminal(x,y,net,fluid,outward){
  assert(Number.isInteger(x)&&Number.isInteger(y),'Off-grid pipe '+net);
  assert(!occupied.has(key(x,y)),'Blocked pipe '+net+' at '+key(x,y));
  assert(!terminals.has(key(x,y))||terminals.get(key(x,y)).net===net,'Conflicting fluid terminal');
  terminals.set(key(x,y),{x,y,net,fluid,outward});
 }
 function fluidPorts(e,recipe,replacements={}){
  const r=raw.recipe[recipe],p=proto.get(e.name);
  for(const type of ['input','output']){
   const values=(type==='input'?r.ingredients:r.results).filter(v=>v.type==='fluid'),boxes=p.fluid_boxes.filter(b=>b.production_type===type);
   for(const [i,v]of values.entries())for(const c of boxes[(v.fluidbox_index||i+1)-1].pipe_connections){
    const d=((c.direction||0)+(e.direction||0))%16;let [x,y]=c.position;
    for(let turn=0;turn<(e.direction||0);turn+=4)[x,y]=[-y,x];
    const [dx,dy]=vector[d];terminal(e.position.x+x+dx-.5,e.position.y+y+dy-.5,replacements[v.name]||v.name,v.name,d);
   }
  }
 }
 const outputCreated=new Set();
 for(const [slot,id]of recipes.entries()){
  const r=raw.recipe[id],name=machineFor(r);assert(name,'No machine for '+id);
  const x=4+(slot%columns)*pitch,y=rowY[Math.floor(slot/columns)],large=['foundry','oil-refinery'].includes(name),furnace=name==='steel-furnace';
  const fluid=[...r.ingredients,...r.results].some(p=>p.type==='fluid');
  const e=add(name,furnace?x+2:x+(large?3.5:2.5),furnace?y+3:y+(large?4.5:3.5),{direction:fluid&&name!=='oil-refinery'?4:0,...(furnace?{}:{recipe:id}),tags:{production_recipe:id}},true);
  const ingredients=r.ingredients.filter(i=>i.type==='item').map(i=>i.name);if(furnace)ingredients.push('coal');
  if(ingredients.length){
   const groups=furnace||ingredients.length===1?[ingredients]:splitInputFilters?[ingredients.filter((_,i)=>i%2===0),ingredients.filter((_,i)=>i%2===1)]:[ingredients,ingredients];
   for(const [index,group]of groups.entries()){
    const reserved=group.find(item=>inputReserveByRecipe[id]?.[item]!==undefined);
    const gate=inputGates[id]||(reserved?{item:reserved,constant:inputReserveByRecipe[id][reserved]}:null);
    const input=arm(x+1+index,y+1,0,{...filters(group),...(gate?{control_behavior:condition(gate.item,gate.constant,gate.comparator||'>')}:{})});
    if(gate)controlled.push(input);
   }
  }
  const result=r.results.find(p=>p.type==='item');
  if(result){
   if(consumed.has(result.name))controlled.push(arm(x+(furnace?2:large?4:3),y+1,8,{control_behavior:condition(result.name,limits[result.name])}));
   if((products.includes(result.name)||result.name==='solid-fuel')&&!outputCreated.has(result.name)){
    outputCreated.add(result.name);
    const outputIndex=result.name==='solid-fuel'?products.length+1:products.indexOf(result.name)+1;
    const bottom=y+(large?7:5),out=add('wooden-chest',x+(large?3:2),bottom+1,{bar:result.name==='solid-fuel'?16:1,tags:{transport_output:result.name,transport_output_index:outputIndex}});
    const output=arm(x+(large?3:2),bottom,0,consumed.has(result.name)?{control_behavior:condition(result.name,Math.floor(limits[result.name]/2),'≥')}:{});
    if(consumed.has(result.name))controlled.push(output);
    ports.push({kind:'output',index:outputIndex,label:'OUT '+outputIndex+' · '+result.name,entity:out.entity_number,items:[result.name],x:out.position.x,y:out.position.y});
   }
  }
  if(fluid)fluidPorts(e,id,id==='solid-fuel-from-petroleum-gas'?{'petroleum-gas':'fuel-feed'}:{});
  cells.push({recipe:id,entity:e.entity_number});
 }
 const rawOrder=['iron-ore','copper-ore','coal','stone','wood','water','crude-oil','tungsten-ore','calcite'];
 for(const item of rawInputs){
  const index=rawOrder.indexOf(item),y=2+index*3,label=String.fromCharCode(65+index)+' · '+item.replaceAll('-',' ');
  if(raw.fluid[item]){terminal(-8,y,item,item,4);ports.push({kind:'fluid',label,items:[item],x:-7.5,y:y+.5,externalSide:'west'});}
  else{
   assert(y<lastY,'Input beyond belt loop: '+item);
   const inletCount=inputInserterCounts[item]||1;assert([1,2].includes(inletCount),'Unsupported inlet count: '+item);
   for(let x=-8;x<=-2;x++)belt(x,y,inletCount===2&&x===-2?8:4,false);
   controlled.push(arm(-1,y,12,{...filters([item]),control_behavior:condition(item,limits[item])}));
   if(inletCount===2){
    belt(-2,y+1,4,false);
    controlled.push(arm(-1,y+1,12,{...filters([item]),control_behavior:condition(item,limits[item])}));
   }
   ports.push({kind:'input',label,items:[item],entity:occupied.get(key(-8,y)).entity_number,x:-7.5,y:y+.5,externalSide:'west',direction:4});
  }
 }
 if(recipes.includes('solid-fuel-from-petroleum-gas')){
  const x=recipes.length<=(rows-1)*columns?7:right+5,y=lastY+4;
  const tank=add('storage-tank',x,y,{tags:{fluid:'petroleum-gas'}},false);
  terminal(x-1,y-2,'petroleum-gas','petroleum-gas',0);
  const pump=add('pump',x+5.5,y,{direction:8,control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'fluid',name:'petroleum-gas'},comparator:'>',constant:500}}},true);
  terminal(x+5,y-2,'petroleum-gas','petroleum-gas',0);terminal(x+5,y+1,'fuel-feed','petroleum-gas',8);
  wires.push([tank.entity_number,1,pump.entity_number,1]);
 }
 for(const p of ports.filter(p=>['input','fluid'].includes(p.kind))){
  for(const [x,y]of [[p.x-.5,p.y-1.5],[p.x-1.5,p.y-.5]]){assert(!occupied.has(key(x,y)),'Blocked raw entrance display');occupied.set(key(x,y),{name:'reserved raw entrance'});}
 }
// Fluid autorouter. Underground connections can cross belts and machines, but
// never overlap another underground span on the same axis. Surface ports from
// different networks must not touch. Each endpoint is connected to its network.
const bounds={minX:-12,maxX:right+13,minY:-3,maxY:lastY+15};
function openings(p) { return p.direction === undefined ? dirs : [p.direction]; }
function free(x,y,net,face) {
  if(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY) return false;
  const k=key(x,y), old=pipes.get(k), t=terminals.get(k);
  if (old) return old.net===net && face===undefined && old.direction===undefined;
  if (occupied.has(k) || (t && t.net!==net)) return false;
  for(const d of face===undefined?dirs:[face]) {
    const [dx,dy]=vector[d], n=pipes.get(key(x+dx,y+dy)), terminalNeighbor=terminals.get(key(x+dx,y+dy));
    if(n && n.net!==net && openings(n).includes((d+8)%16)) return false;
    if(terminalNeighbor && terminalNeighbor.net!==net) return false;
  }
  return true;
}
function undergroundFree(x,y,x2,y2) {
  const vertical=x===x2, a=vertical?y:x,b=vertical?y2:x2,line=vertical?x:y;
  return !tunnels.some(t=>t.vertical===vertical&&t.line===line&&Math.max(t.a,Math.min(a,b))<=Math.min(t.b,Math.max(a,b)));
}
class Heap {
  a=[];
  push(v){let i=this.a.push(v)-1;while(i){const p=(i-1)>>1;if(this.a[p].f<=v.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}
  pop(){const top=this.a[0],v=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(this.a[c].f>=v.f)break;this.a[i]=this.a[c];i=c;}this.a[i]=v;}return top;}
}
function route(start, goals, net) {
  const queue=new Heap(), seen=new Map();
  const goalKeys=new Set(goals.map(g=>key(g.x,g.y)));
  const h=(x,y)=>Math.min(...goals.map(g=>Math.abs(x-g.x)+Math.abs(y-g.y)));
  queue.push({x:start.x,y:start.y,d:start.outward,g:0,f:h(start.x,start.y),prev:null,used:new Set(),spans:[]});
  let finish;
  while(queue.a.length){
    const s=queue.pop(), sk=`${s.x},${s.y},${s.d}`;
    if(seen.has(sk)&&seen.get(sk)<=s.g)continue;seen.set(sk,s.g);
    if(goalKeys.has(key(s.x,s.y))){finish=s;break;}
    if(free(s.x,s.y,net)) for(const d of dirs){
      const [dx,dy]=vector[d],x=s.x+dx,y=s.y+dy;
      if(s.used.has(key(x,y)))continue;
      if(!free(x,y,net))continue;
      queue.push({x,y,d,g:s.g+1.2,f:s.g+1.2+h(x,y),prev:s,used:new Set([...s.used,key(s.x,s.y)]),spans:s.spans,step:{type:'pipe',x:s.x,y:s.y}});
    }
    const [dx,dy]=vector[s.d];
    if(!pipes.has(key(s.x,s.y)) && free(s.x,s.y,net,(s.d+8)%16)) for(let len=2;len<=10;len++){
      const ex=s.x+dx*len,ey=s.y+dy*len,nx=ex+dx,ny=ey+dy;
      if(s.used.has(key(ex,ey))||s.used.has(key(nx,ny)))continue;
      if(terminals.has(key(ex,ey)) || !free(ex,ey,net,s.d) || !undergroundFree(s.x,s.y,ex,ey))continue;
      const span={vertical:s.x===ex,line:s.x===ex?s.x:s.y,a:Math.min(s.x===ex?s.y:s.x,s.x===ex?ey:ex),b:Math.max(s.x===ex?s.y:s.x,s.x===ex?ey:ex)};
      if(s.spans.some(t=>t.vertical===span.vertical&&t.line===span.line&&Math.max(t.a,span.a)<=Math.min(t.b,span.b)))continue;
      if(!free(nx,ny,net))continue;
      const cost=len+1.8;
      queue.push({x:nx,y:ny,d:s.d,g:s.g+cost,f:s.g+cost+h(nx,ny),prev:s,used:new Set([...s.used,key(s.x,s.y),key(ex,ey)]),spans:[...s.spans,span],step:{type:'tunnel',x:s.x,y:s.y,ex,ey,d:s.d}});
    }
  }
  assert(finish,`No fluid route for ${net}: ${key(start.x,start.y)} to ${goals.length} connected pipes`);
  const steps=[];for(let n=finish;n.prev;n=n.prev)steps.push(n.step);steps.reverse();
  return steps;
}
function putPipe(x,y,net,fluid,direction){
  const k=key(x,y),old=pipes.get(k);if(old){assert(old.net===net&&direction===undefined&&old.direction===undefined,`Repeated fluid placement ${net} at ${k}, existing ${JSON.stringify(old)}, new direction ${direction}`);return;}
  assert(free(x,y,net,direction),`Fluid conflict at ${k} for ${net}`);
  const e=add(direction===undefined?'pipe':'pipe-to-ground',x,y,{...(direction===undefined?{}:{direction}),tags:{mall_fluid:fluid,mall_net:net}});
  pipes.set(k,{net,fluid,direction,entity:e.entity_number});
}
const groups=new Map();
for(const t of terminals.values()){if(!groups.has(t.net))groups.set(t.net,[]);groups.get(t.net).push(t);}
// Route the shared fluid networks before the dedicated pump outlets.
const order=[...groups.keys()].sort((a,b)=>groups.get(b).length-groups.get(a).length);
for(const net of order){
  const pending=[...groups.get(net)], first=pending.shift(), connected=[first];
  putPipe(first.x,first.y,net,first.fluid);
  while(pending.length){
    let best;
    const goals=[...pipes].filter(([k,p])=>p.net===net&&p.direction===undefined).map(([k])=>{const [x,y]=k.split(',').map(Number);return{x,y};});
    for(const [i,t] of pending.entries())for(const g of goals){const d=Math.abs(t.x-g.x)+Math.abs(t.y-g.y);if(!best||d<best.d)best={i,t,g,d};}
    const steps=route(best.t,goals,net);
    for(const step of steps){
      if(step.type==='pipe')putPipe(step.x,step.y,net,best.t.fluid);
      else{
        putPipe(step.x,step.y,net,best.t.fluid,(step.d+8)%16);putPipe(step.ex,step.ey,net,best.t.fluid,step.d);
        const vertical=step.x===step.ex;
        tunnels.push({vertical,line:vertical?step.x:step.y,a:Math.min(vertical?step.y:step.x,vertical?step.ey:step.ex),b:Math.max(vertical?step.y:step.x,vertical?step.ey:step.ex)});
      }
    }
    connected.push(best.t);pending.splice(best.i,1);
  }

}


 for(const port of ports.filter(p=>p.kind==='fluid'))port.entity=occupied.get(key(port.x-.5,port.y-.5)).entity_number;
 const blueprint={item:'blueprint',version:562949958467584,entities,wires:[]};
 const info=addInputDisplays(blueprint,{ports,setupNotes:[]});
 const dummy={entity_number:Math.max(...blueprint.entities.map(e=>e.entity_number))+1,name:'small-electric-pole',position:{x:-7.5,y:-1.5}};blueprint.entities.push(dummy);
 ports.push({kind:'power',label:'P · External power',items:[],entity:dummy.entity_number,x:dummy.position.x,y:dummy.position.y});
 const poles=powerStarterLayout(blueprint,ports,raw);wires.push(...blueprint.wires);
 // The green network carries only the circulating-belt count. The fuel pump
 // uses its separate red tank signal.
 const greenDegree=new Map(),greenEdge=(a,b)=>{wires.push([a.entity_number,2,b.entity_number,2]);for(const e of [a,b])greenDegree.set(e.entity_number,(greenDegree.get(e.entity_number)||0)+1);};
 const byId=new Map(blueprint.entities.map(e=>[e.entity_number,e]));
 for(const [a,,b]of blueprint.wires)greenEdge(byId.get(a),byId.get(b));
 const reached=new Set(poles),pending=new Set([reader,...controlled]);
 while(pending.size){let best;
  for(const a of reached)for(const b of pending){const distance=Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);if(distance<=9&&(greenDegree.get(a.entity_number)||0)<5&&(!best||distance<best.distance))best={a,b,distance};}
  assert(best,'Cannot reach belt controller');greenEdge(best.a,best.b);reached.add(best.b);pending.delete(best.b);
 }
 blueprint.wires=wires;blueprint.icons=products.map((name,i)=>({index:i+1,signal:{type:'item',name}}));
 ports.sort((a,b)=>(a.kind==='output'?a.index:99)-(b.kind==='output'?b.index:99));
 const present=new Set([...rawInputs,...recipes.flatMap(id=>raw.recipe[id].results.filter(v=>v.type==='item').map(v=>v.name))]);
 for(const item of Object.keys(limits))if(!present.has(item))delete limits[item];
 assert(Object.values(limits).reduce((a,b)=>a+b,0)<loop.length*6,'Too much stock for the circulating belt');
 return {blueprint,ports,inputDisplays:info.inputDisplays,setupNotes:info.setupNotes,machineCount:recipes.length,recipes,loopControl:{reader:reader.entity_number,controlled:controlled.map(e=>e.entity_number),loop,limits,requiredTechnology:'circuit-network'}};
}
