import fs from 'node:fs';
import assert from 'node:assert/strict';
import { decodeBlueprint, encodeBlueprint } from './blueprints.mjs';

const raw = JSON.parse(fs.readFileSync('.cache/factorio/script-output/data-raw-dump.json'));
const all = Object.values(raw).flatMap(Object.values);
const proto = new Map(all.filter(p => p.collision_box).map(p => [p.name, p]));
const stacks = new Map(all.filter(p => p.stack_size).map(p => [p.name, p.stack_size]));
const extension = decodeBlueprint(fs.readFileSync('mall/robot_extension_5x5.txt', 'utf8')).blueprint;
const entities = [], wires = [], cells = [], poles = [], feeds = [], valves = [];
const occupied = new Map(), pipes = new Map(), terminals = new Map(), tunnels = [], extensionIds = new Map();
const key = (x, y) => `${x},${y}`;
const dirs = [0, 4, 8, 12], vector = {0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]};
const outputs = {roboport:20,'construction-robot':200,'logistic-robot':200,'big-electric-pole':100};
const buffers = {'iron-plate':100,'copper-plate':100,'steel-plate':50,'iron-gear-wheel':200,'iron-stick':100,'copper-cable':400,'electronic-circuit':300,'advanced-circuit':150,pipe:100,'engine-unit':50,'electric-engine-unit':50,'flying-robot-frame':30,'plastic-bar':400,sulfur:100,battery:100};
function add(name, x, y, extra = {}, centered = false) {
  const p = proto.get(name); assert(p, name);
  const position = centered ? {x,y} : {x:x+.5,y:y+.5};
  let [[a,b],[c,d]] = p.selection_box;
  if ([4,12].includes(extra.direction)) [a,b,c,d]=[b,a,d,c];
  const tiles=[];
  for(let u=Math.floor(position.x+a+.01);u<position.x+c-.01;u++)for(let v=Math.floor(position.y+b+.01);v<position.y+d-.01;v++){
    assert(!occupied.has(key(u,v)),`${name} at ${position.x},${position.y} overlaps ${occupied.get(key(u,v))?.name} at ${u},${v}`);
    tiles.push(key(u,v));
  }
  const e={entity_number:entities.length+1,name,position,...extra};
  entities.push(e);for(const k of tiles)occupied.set(k,e);return e;
}
for(const source of extension.entities){
  const {entity_number,name,position,...extra}=source;
  const e=add(name,position.x,position.y,{...extra,tags:{...extra.tags,mall_extension_id:entity_number}},true);
  extensionIds.set(entity_number,e.entity_number);if(name==='big-electric-pole')poles.push(e);
}
for(const [a,ca,b,cb] of extension.wires)wires.push([extensionIds.get(a),ca,extensionIds.get(b),cb]);
function terminal(x,y,net,fluid,outward){
  assert(Number.isInteger(x)&&Number.isInteger(y),`Off-grid terminal: ${net} ${x},${y}`);
  assert(!occupied.has(key(x,y)),`Blocked terminal ${net} ${x},${y}`);
  const old=terminals.get(key(x,y));assert(!old||old.net===net,`Terminal conflict: ${net}`);
  const t={x,y,net,fluid,outward};terminals.set(key(x,y),t);return t;
}
function fluidPorts(e,recipe,replacements={}){
  const r=raw.recipe[recipe],boxes=proto.get(e.name).fluid_boxes;
  for(const kind of ['input','output']){
    const values=(kind==='input'?r.ingredients:r.results).filter(p=>p.type==='fluid');
    const available=boxes.filter(b=>b.production_type===kind);
    for(const [i,value] of values.entries())for(const connection of available[i].pipe_connections){
      const direction=((connection.direction||0)+(e.direction||0))%16;
      let [px,py]=connection.position;
      for(let turn=0;turn<(e.direction||0);turn+=4)[px,py]=[-py,px];
      const [dx,dy]=vector[direction];
      terminal(e.position.x+px+dx-.5,e.position.y+py+dy-.5,replacements[value.name]||value.name,value.name,direction);
    }
  }
}
const condition=(item,cap)=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:cap}});
function station(recipe,x,y){
  const r=raw.recipe[recipe];assert(r,recipe);
  const name=['iron-plate','copper-plate','steel-plate'].includes(recipe)?'electric-furnace':recipe==='advanced-oil-processing'?'oil-refinery':
    ['lubricant','heavy-oil-cracking','light-oil-cracking','plastic-bar','sulfur','sulfuric-acid','battery'].includes(recipe)?'chemical-plant':'assembling-machine-3';
  const machine=add(name,x+(name==='oil-refinery'?2:1),y+(name==='oil-refinery'?2:1),{
    ...(name==='electric-furnace'?{}:{recipe}),tags:{mall_recipe:recipe,mall_role:outputs[recipe]?'output':'intermediate'},
  });
  const ingredients=r.ingredients.filter(p=>p.type==='item'),product=r.results.find(p=>p.type==='item');
  let input,output,inputInserter,outputInserter;
  if(ingredients.length){
    input=add('requester-chest',x+4,y,{request_filters:{sections:[{index:1,filters:ingredients.map((p,i)=>({
      index:i+1,name:p.name,quality:'normal',comparator:'=',count:Math.max(16,p.amount*2,Math.min(stacks.get(p.name),Math.ceil(20*(proto.get(name).crafting_speed||1)/(r.energy_required||.5)*p.amount))),
    }))}]},tags:{mall_request_for:recipe,mall_role:'requester'}});
    inputInserter=add('stack-inserter',x+3,y,{direction:4,override_stack_size:4});
  }
  if(product){
    const cap=outputs[recipe]||buffers[recipe];assert(cap,`Missing buffer ${recipe}`);
    output=add('passive-provider-chest',x+4,y+2,{bar:Math.ceil(cap/stacks.get(product.name)),tags:{mall_product:product.name,mall_limit:cap,mall_role:outputs[recipe]?'output':'intermediate'}});
    outputInserter=add('stack-inserter',x+3,y+2,{direction:12,override_stack_size:outputs[recipe]?1:4,control_behavior:condition(product.name,cap)});
    wires.push([output.entity_number,1,outputInserter.entity_number,1]);
  }
  cells.push({recipe,machine:machine.entity_number,input:input?.entity_number,output:output?.entity_number,inputInserter:inputInserter?.entity_number,outputInserter:outputInserter?.entity_number,final:!!outputs[recipe]});
  if(r.ingredients.some(p=>p.type==='fluid')||r.results.some(p=>p.type==='fluid'))fluidPorts(machine,recipe,
    recipe==='heavy-oil-cracking'?{'heavy-oil':'heavy-cracking-feed'}:recipe==='lubricant'?{'heavy-oil':'lubricant-feed'}:{});
}
const dry=[...Array(16).fill('iron-plate'),...Array(8).fill('copper-plate'),...Array(8).fill('steel-plate'),
  'iron-gear-wheel','iron-gear-wheel','iron-stick','copper-cable','copper-cable',
  ...Array(3).fill('electronic-circuit'),...Array(4).fill('advanced-circuit'),'pipe','engine-unit','engine-unit',
  ...Array(4).fill('flying-robot-frame'),...Object.keys(outputs)];
dry.forEach((recipe,i)=>station(recipe,3+(i%16)*6,3+Math.floor(i/16)*5));
assert.equal(dry.length,55);
const wet=['advanced-oil-processing','lubricant','heavy-oil-cracking','light-oil-cracking','plastic-bar','sulfur','sulfuric-acid','battery','battery','electric-engine-unit','electric-engine-unit'];
wet.forEach((recipe,i)=>station(recipe,3+i*8,35));
const robots=['construction-robot','logistic-robot'].map(recipe=>cells.find(c=>c.recipe===recipe));
wires.push([robots[0].output,1,robots[1].output,1]);
for(const [i,cell] of robots.entries()){
  entities[cell.inputInserter-1].control_behavior={circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:cell.recipe,quality:'normal'},comparator:'≤',second_signal:{type:'item',name:robots[1-i].recipe,quality:'normal'}}};
  wires.push([cell.output,1,cell.inputInserter,1]);
}
for(const [i,item] of ['iron-ore','iron-ore','copper-ore','copper-ore','coal'].entries()){
  const x=37+i*4,y=28;
  const e=add('passive-provider-chest',x,y,{tags:{mall_input:item}});feeds.push({item,entity:e.entity_number,x,y});
  add('display-panel',x,y+2,{text:`Supply ${item}`,icon:{type:'item',name:item},always_show:true});
}
add('display-panel',27,27,{text:'Add 200 starter logistic robots to the nearby roboports',icon:{type:'item',name:'logistic-robot'},always_show:true});
for(const [x,fluid,downstream,threshold,comparator,pumpFluid] of [
  [18,'heavy-oil','heavy-cracking-feed',2000,'>','heavy-oil'],[38,'lubricant','lubricant-feed',1500,'<','heavy-oil'],
]){
  const y=46,tank=add('storage-tank',x,y,{tags:{mall_net:fluid,mall_fluid:fluid}});
  terminal(x-1,y-2,fluid,fluid,0);
  const pump=add('pump',x+4.5,y,{direction:8,control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'fluid',name:fluid},comparator,constant:threshold}}},true);
  terminal(x+4,y-2,pumpFluid,pumpFluid,0);terminal(x+4,y+1,downstream,pumpFluid,8);
  wires.push([tank.entity_number,1,pump.entity_number,1]);valves.push({fluid,tank:tank.entity_number,pump:pump.entity_number,threshold,comparator});
}
const fluidInputs=[{fluid:'water',x:94,y:31},{fluid:'crude-oil',x:98,y:31}];
for(const p of fluidInputs){terminal(p.x,p.y,p.fluid,p.fluid,8);add('display-panel',p.x,p.y-2,{text:`Connect ${p.fluid}`,icon:{type:'fluid',name:p.fluid},always_show:true});}
function tileBox(e){let [[a,b],[c,d]]=proto.get(e.name).selection_box;if([4,12].includes(e.direction))[a,b,c,d]=[b,a,d,c];return{x1:Math.floor(e.position.x+a+.01),y1:Math.floor(e.position.y+b+.01),x2:Math.ceil(e.position.x+c-.01),y2:Math.ceil(e.position.y+d-.01)};}
function distance(a,b){return Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);}
function covered(p,e){const r=proto.get(p.name).supply_area_distance,b=tileBox(e);return b.x1<p.position.x+r&&b.x2>p.position.x-r&&b.y1<p.position.y+r&&b.y2>p.position.y-r;}
function substationFits(x,y){for(const u of [x-1,x])for(const v of [y-1,y])if(occupied.has(key(u,v))||terminals.has(key(u,v)))return false;return true;}
let missing=entities.filter(e=>proto.get(e.name).energy_source?.type==='electric'&&!poles.some(p=>covered(p,e)));
while(missing.length){
  let best;
  for(let y=1;y<=49;y++)for(let x=1;x<=99;x++){
    if(!substationFits(x,y))continue;
    const candidate={name:'substation',position:{x,y}},coveredEntities=missing.filter(e=>covered(candidate,e)),score=coveredEntities.length;
    const centrality=coveredEntities.reduce((s,e)=>s+distance(candidate,e),0);
    if(score&&(!best||score>best.score||(score===best.score&&centrality<best.centrality)))best={x,y,score,centrality};
  }
  assert(best,'Could not cover every consumer with substations');const p=add('substation',best.x,best.y,{},true);poles.push(p);missing=missing.filter(e=>!covered(p,e));
}
const reached=new Set([poles[0]]);
while(reached.size<poles.length){
  let best;
  for(const a of reached)for(const b of poles)if(!reached.has(b)&&distance(a,b)<=Math.min(proto.get(a.name).maximum_wire_distance,proto.get(b.name).maximum_wire_distance)&&(!best||distance(a,b)<best.d))best={a,b,d:distance(a,b)};
  assert(best,'Disconnected power grid');wires.push([best.a.entity_number,5,best.b.entity_number,5]);reached.add(best.b);
}

// Fluid autorouter. Underground connections can cross belts and machines, but
// never overlap another underground span on the same axis. Surface ports from
// different networks must not touch. Each endpoint is connected to its network.
const bounds={minX:1,maxX:99,minY:27,maxY:49};
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
  console.log(`Routed ${net}: ${groups.get(net).length} ports`);
}

for(const e of entities)e.tags={...e.tags,mall_id:e.entity_number};
const seen=new Set(),uniqueWires=wires.filter(([a,ca,b,cb])=>{const k=a<b?`${a}:${ca}-${b}:${cb}`:`${b}:${cb}-${a}:${ca}`;if(seen.has(k))return false;seen.add(k);return true;});
const factory=entities.filter(e=>!e.tags.mall_extension_id),boxes=factory.map(tileBox);
const factoryBounds={minX:Math.min(...boxes.map(b=>b.x1)),minY:Math.min(...boxes.map(b=>b.y1)),maxX:Math.max(...boxes.map(b=>b.x2)),maxY:Math.max(...boxes.map(b=>b.y2))};
assert(factoryBounds.minX>=0&&factoryBounds.maxX<=100&&factoryBounds.minY>=0&&factoryBounds.maxY<=50,'Factory must fit two 50-tile extension cells');
assert(!entities.some(e=>/belt|splitter|loader/.test(e.name)),'No belt transport permitted');
const description=[
  'Robot-fed expansion mall: roboports, construction robots, logistic robots and big electric poles. Supply only iron ore, copper ore, coal, water, crude oil and electricity. Smelting, steel, gears, iron sticks, cable, circuits, plastic, sulfur/acid, batteries, engines, lubricant and flying robot frames are all made inside.',
  'No belts. Every solid intermediate travels through requester and passive-provider chests using logistic robots; stack inserters load and unload machines. All chests have configured requests or stock limits. Ingredient and intermediate inserters move batches of four, with requester buffers of at least sixteen per ingredient. Finished outputs move one at a time for exact stock limits.',
  'Add 200 starter logistic robots to the two nearby roboports before starting. Produced robots remain in output chests until collected or placed into roboports. Building materials and starter robots are required in addition to operating raw inputs.',
  'The factory fits two adjacent 50x50 cells of your Robot Extension (5x5). All 25 original roboports, 85 big poles, original copper links and snapping settings are preserved. Align matching roboports over a clear extension bay; substations supply the new factory.',
  'Heavy oil makes lubricant, with surplus cracked above a 2000-unit tank reserve. Lubricant production pauses above 1500 units in its tank. Light oil is cracked to petroleum for plastic and sulfur. All oil products are consumed internally; full stocks pause the mall normally.',
  'Normal-quality inputs and equipment. Tested with Factorio 2.0 + Space Age; stack inserters must be supplied as construction materials. Final stock targets: 20 roboports, 200 construction robots, 200 logistic robots, 100 big electric poles.',
].join('\n\n');
const blueprint={blueprint:{item:'blueprint',label:'Robot Expansion Mall - Raw Inputs',description,version:extension.version,
  'snap-to-grid':extension['snap-to-grid'],'absolute-snapping':extension['absolute-snapping'],'position-relative-to-grid':extension['position-relative-to-grid'],
  icons:Object.keys(outputs).map((name,i)=>({index:i+1,signal:{type:'item',name}})),entities,wires:uniqueWires}};
fs.mkdirSync('.cache/robot-expansion-mall',{recursive:true});
fs.writeFileSync('mall/robot_expansion_mall.json',JSON.stringify(blueprint,null,2)+'\n');
fs.writeFileSync('mall/robot_expansion_mall.txt',encodeBlueprint(blueprint)+'\n');
fs.writeFileSync('.cache/robot-expansion-mall/manifest.json',JSON.stringify({cells,outputs,feeds,valves,fluidInputs,factoryBounds,powerPoint:{x:-75,y:-98},starterRobots:200,
  extension:{entities:extension.entities,entityIds:Object.fromEntries(extensionIds)},roboports:entities.filter(e=>e.name==='roboport').map(e=>e.entity_number),
  seedPorts:entities.filter(e=>e.name==='roboport'&&e.position.y===25&&[25,75].includes(e.position.x)).map(e=>e.entity_number),
  substations:entities.filter(e=>e.name==='substation').length},null,2)+'\n');
console.log(`Robot mall: ${entities.length} entities; ${cells.length} machines; ${entities.filter(e=>e.name==='substation').length} substations; factory ${JSON.stringify(factoryBounds)}.`);
