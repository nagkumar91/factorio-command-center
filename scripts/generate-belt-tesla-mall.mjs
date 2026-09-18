import fs from 'node:fs';
import assert from 'node:assert/strict';
import { decodeBlueprint, encodeBlueprint } from './blueprints.mjs';

// A single, unbranched circulating belt. Its inventory is read once, and each
// producer has a per-item limit. Final products go straight to capped chests.
const raw = JSON.parse(fs.readFileSync('.cache/factorio/script-output/data-raw-dump.json'));
const all = Object.values(raw).flatMap(x => Object.values(x));
const proto = new Map(all.filter(p => p.collision_box).map(p => [p.name, p]));
const stacks = new Map(all.filter(p => p.stack_size).map(p => [p.name, p.stack_size]));
const entities = [], wires = [], cells = [], feeds = [], loop = [], poles = [], controlled = [];
const occupied = new Map(), pipes = new Map(), terminals = new Map(), tunnels = [];
const key = (x, y) => `${x},${y}`;
const dirs = [0, 4, 8, 12];
const vector = { 0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0] };
const extension = decodeBlueprint(fs.readFileSync('mall/robot_extension_5x5.txt', 'utf8')).blueprint;
const origin = { x: 15, y: 19 };
const extensionIds = new Map();
const underpasses = [{ left: 5, right: 12, y: 56 }, { left: 33, right: 36, y: 56 }, { left: 55, right: 62, y: 56 }];
const outputs = {
  'express-transport-belt': 400, 'express-underground-belt': 100, 'express-splitter': 50,
  'bulk-inserter': 100, 'long-handed-inserter': 100, 'medium-electric-pole': 100,
  'big-electric-pole': 50, substation: 50, 'pipe-to-ground': 100, 'storage-tank': 20,
  'small-lamp': 100, 'logistic-robot': 100, 'construction-robot': 100, roboport: 10,
  'repair-pack': 200, 'tesla-turret': 10,
};
const limits = {
  'iron-ore': 300, 'copper-ore': 300, coal: 100, stone: 60, 'holmium-ore': 40,
  'iron-plate': 640, 'copper-plate': 480, 'steel-plate': 100,
  'copper-cable': 600, 'iron-gear-wheel': 160, 'iron-stick': 40,
  'electronic-circuit': 400, 'advanced-circuit': 120, 'processing-unit': 40,
  'plastic-bar': 300, sulfur: 40, battery: 60, 'engine-unit': 32,
  'electric-engine-unit': 24, 'flying-robot-frame': 24, pipe: 60,
  'transport-belt': 60, 'fast-transport-belt': 40, 'underground-belt': 32,
  'fast-underground-belt': 24, splitter: 24, 'fast-splitter': 24,
  inserter: 40, 'fast-inserter': 32, 'holmium-plate': 80,
  superconductor: 100, supercapacitor: 30, teslagun: 4,
};
function add(name, x, y, extra = {}, centered = false) {
  const p = proto.get(name); assert(p, name);
  const position = centered ? { x, y } : { x: x + .5, y: y + .5 };
  let [[a, b], [c, d]] = p.selection_box;
  if ([4, 12].includes(extra.direction)) [a, b, c, d] = [b, a, d, c];
  const tiles = [];
  for (let u = Math.floor(position.x + a + .01); u < position.x + c - .01; u++) {
    for (let v = Math.floor(position.y + b + .01); v < position.y + d - .01; v++) {
      assert(!occupied.has(key(u, v)), `${name} ${position.x},${position.y} overlaps ${occupied.get(key(u, v))?.name} at ${u},${v}`);
      tiles.push(key(u, v));
    }
  }
  const e = { entity_number: entities.length + 1, name, position, ...extra };
  entities.push(e); for (const k of tiles) occupied.set(k, e);
  return e;
}
function belt(x, y, direction, onLoop = true) {
  const tunnel = onLoop && underpasses.find(t => t.y === y && x >= t.left && x <= t.right);
  if (tunnel && x !== tunnel.left && x !== tunnel.right) return;
  const e = add(tunnel ? 'turbo-underground-belt' : 'turbo-transport-belt', x, y, {
    direction, ...(tunnel ? { type: x === tunnel.right ? 'input' : 'output' } : {}), tags: { mall_loop: onLoop },
  });
  if (onLoop) loop.push(e.entity_number);
  return e;
}
// Preserve every entity and copper connection in the user's extension. Its
// original bounding box and snapping settings also preserve placement alignment.
for (const source of extension.entities) {
  const { entity_number, name, position, ...extra } = source;
  const e = add(name, position.x - origin.x, position.y - origin.y,
    { ...extra, tags: { ...extra.tags, mall_extension_id: entity_number } }, true);
  extensionIds.set(entity_number, e.entity_number);
  if (name === 'big-electric-pole') poles.push(e);
}
for (const [a, ca, b, cb] of extension.wires || []) wires.push([extensionIds.get(a), ca, extensionIds.get(b), cb]);
// Ten horizontal runs and a separate west-side return: every item revisits
// every manufacturing station. There are no belt branches or lane mergers.
for (let row = 0; row < 10; row++) {
  const y = row * 8;
  const left = row === 0 || row === 9 ? 0 : 2;
  for (let x = left; x <= 74; x++) {
    let d = row % 2 ? 12 : 4;
    if (row % 2 === 0 && x === 74) d = 8;
    if (row % 2 && x === left) d = row === 9 ? 0 : 8;
    belt(x, y, d);
  }
  if (row < 9) for (let y2 = y + 1; y2 < y + 8; y2++) belt(row % 2 ? 2 : 74, y2, 8);
}
for (let y = 1; y < 72; y++) belt(0, y, 0);
const reader = occupied.get(key(3, 0));
reader.control_behavior = { circuit_read_hand_contents: true, circuit_contents_read_mode: 2 };

function condition(item, cap) {
  return { circuit_enabled: true, circuit_condition: { first_signal: { type: 'item', name: item, quality: 'normal' }, comparator: '<', constant: cap } };
}
function inserter(x, y, d, extra = {}) {
  return add('stack-inserter', x, y, { direction: d, override_stack_size: 1, ...extra });
}
function terminal(x, y, net, fluid, outward) {
  assert(Number.isInteger(x) && Number.isInteger(y), `Off-grid fluid terminal ${net} ${x},${y}`);
  assert(!occupied.has(key(x, y)), `Blocked fluid terminal ${net} at ${x},${y}: ${occupied.get(key(x, y))?.name}`);
  const old = terminals.get(key(x, y));
  assert(!old || old.net === net, `Conflicting fluid terminals ${key(x,y)}`);
  const t = { x, y, net, fluid, outward };
  terminals.set(key(x, y), t);
  return t;
}
function fluidPorts(e, recipe, replacements = {}) {
  const r = raw.recipe[recipe], p = proto.get(e.name);
  const boxes = p.fluid_boxes || [p.fluid_box];
  for (const kind of ['input', 'output']) {
    const values = (kind === 'input' ? r.ingredients : r.results).filter(v => v.type === 'fluid');
    const available = boxes.filter(b => b.production_type === kind);
    for (const [i, value] of values.entries()) {
      const b = available[i]; assert(b, `No ${kind} fluid box ${recipe}`);
      for (const connection of b.pipe_connections) {
        const direction = ((connection.direction || 0) + (e.direction || 0)) % 16;
        let [px, py] = connection.position;
        for (let turn = 0; turn < (e.direction || 0); turn += 4) [px, py] = [-py, px];
        const [dx, dy] = vector[direction];
        terminal(e.position.x + px + dx - .5, e.position.y + py + dy - .5,
          replacements[value.name] || value.name, value.name, direction);
      }
    }
  }
}
function station(recipe, slot) {
  const r = raw.recipe[recipe]; assert(r, recipe);
  const x = 4 + (slot % 10) * 7 + ({ 0: -1, 70: -2, 77: -3 }[slot] || 0), y = Math.floor(slot / 10) * 8;
  const category = r.category || 'crafting';
  const name = category === 'smelting' ? 'electric-furnace' :
    category === 'electromagnetics' || ['electronic-circuit', 'advanced-circuit', 'processing-unit'].includes(recipe) ? 'electromagnetic-plant' :
    recipe === 'advanced-oil-processing' ? 'oil-refinery' :
    ['lubricant', 'heavy-oil-cracking', 'light-oil-cracking', 'plastic-bar', 'sulfur', 'sulfuric-acid', 'battery', 'holmium-solution'].includes(recipe) ? 'chemical-plant' : 'assembling-machine-3';
  const em = name === 'electromagnetic-plant', ref = name === 'oil-refinery';
  const fluid = r.ingredients.some(p => p.type === 'fluid') || r.results.some(p => p.type === 'fluid');
  const direction = !em && !ref && fluid ? 4 : 0;
  const machine = add(name, em ? x + 3 : x + 3, em || ref ? y + 4 : y + 3, {
    direction, ...(name === 'electric-furnace' ? {} : { recipe }),
    tags: { mall_recipe: recipe, mall_role: outputs[recipe] ? 'output' : 'intermediate' },
  }, em);
  const solid = r.ingredients.filter(p => p.type === 'item');
  const product = r.results.find(p => p.type === 'item');
  let input, secondInput, output, outputInserter;
  if (solid.length) input = inserter(x + (em ? 1 : 2), y + 1, 0, {
    override_stack_size: name === 'electric-furnace' ? 4 : 1,
    use_filters: true, filters: solid.map((p, i) => ({ index: i + 1, name: p.name, quality: 'normal', comparator: '=' })),
  });
  if (solid.length > 1) secondInput = inserter(x + (em ? 2 : 3), y + 1, 0, {
    use_filters: true, filters: solid.map((p, i) => ({ index: i + 1, name: p.name, quality: 'normal', comparator: '=' })),
  });
  for (const arm of [input, secondInput].filter(Boolean)) {
    assert(['turbo-transport-belt', 'turbo-underground-belt'].includes(occupied.get(key(arm.position.x - .5, y))?.name), `No accessible input belt for ${recipe}`);
  }
  if (product) {
    const cap = outputs[recipe];
    if (cap) {
      output = add('passive-provider-chest', x + 3, y + (em ? 7 : 6), {
        bar: Math.ceil(cap / stacks.get(product.name)), tags: { mall_product: product.name, mall_limit: cap, mall_role: 'output' },
      });
      outputInserter = inserter(x + 3, y + (em ? 6 : 5), 0, { control_behavior: condition(product.name, cap) });
      wires.push([output.entity_number, 1, outputInserter.entity_number, 1]);
    } else {
      assert(limits[product.name], `Missing circulating stock limit: ${product.name}`);
      outputInserter = inserter(x + 4, y + 1, 8, {
        override_stack_size: (r.energy_required || .5) >= 10 ? 1 : 4,
        control_behavior: condition(product.name, limits[product.name]),
      });
      controlled.push(outputInserter);
      assert(['turbo-transport-belt', 'turbo-underground-belt'].includes(occupied.get(key(x + 4, y))?.name), `No accessible output belt for ${recipe}`);
    }
  }
  cells.push({ recipe, machine: machine.entity_number, input: input?.entity_number, secondInput: secondInput?.entity_number, output: output?.entity_number, outputInserter: outputInserter?.entity_number });
  if (fluid) fluidPorts(machine, recipe, recipe === 'heavy-oil-cracking' ? { 'heavy-oil': 'heavy-cracking-feed' } :
    recipe === 'light-oil-cracking' ? { 'light-oil': 'light-cracking-feed' } : recipe === 'lubricant' ? { 'heavy-oil': 'lubricant-feed' } : {});
}
const recipes = [
  ...Array(16).fill('iron-plate'), ...Array(8).fill('copper-plate'), ...Array(8).fill('steel-plate'),
  ...Array(3).fill('iron-gear-wheel'), ...Array(3).fill('copper-cable'),
  ...Array(4).fill('electronic-circuit'), ...Array(4).fill('advanced-circuit'),
  ...Array(2).fill('engine-unit'), ...Array(2).fill('flying-robot-frame'), 'iron-stick', 'pipe',
  'transport-belt', 'fast-transport-belt', 'underground-belt', 'fast-underground-belt', 'splitter', 'fast-splitter', 'inserter', 'fast-inserter',
  'bulk-inserter', 'long-handed-inserter', 'medium-electric-pole', 'big-electric-pole', 'substation', 'pipe-to-ground',
  'storage-tank', 'small-lamp', 'logistic-robot', 'construction-robot', 'roboport', 'repair-pack',
  'advanced-oil-processing', 'lubricant', 'heavy-oil-cracking', 'light-oil-cracking', 'plastic-bar', 'sulfur', 'sulfuric-acid', 'battery', 'holmium-solution',
  'express-transport-belt', 'express-underground-belt', 'express-splitter', 'electric-engine-unit', 'holmium-plate', 'processing-unit',
  'superconductor', 'electrolyte', 'supercapacitor', 'teslagun', 'tesla-turret',
];
recipes.forEach(station);
assert.equal(recipes.length, 92);

// Balance finished robot stocks so the first assembler on the belt cannot
// monopolize the frame supply during startup or after a large collection.
const robots = ['logistic-robot', 'construction-robot'].map(recipe => cells.find(c => c.recipe === recipe));
wires.push([robots[0].output, 1, robots[1].output, 1]);
for (const [i, cell] of robots.entries()) for (const id of [cell.input, cell.secondInput]) {
  entities[id - 1].control_behavior = { circuit_enabled: true, circuit_condition: {
    first_signal: { type: 'item', name: cell.recipe, quality: 'normal' }, comparator: '≤',
    second_signal: { type: 'item', name: robots[1 - i].recipe, quality: 'normal' },
  } };
  wires.push([cell.output, 1, id, 1]);
}

for (const [i, item] of ['iron-ore', 'copper-ore', 'coal', 'holmium-ore', 'stone'].entries()) {
  const y = 8 + i * 8;
  for (let x = -12; x <= -2; x++) belt(x, y, 4, false);
  const input = inserter(-1, y, 12, { override_stack_size: 4, use_filters: true,
    filters: [{ index: 1, name: item, quality: 'normal', comparator: '=' }], control_behavior: condition(item, limits[item]),
  });
  controlled.push(input); feeds.push({ item, x: -12, y, belt: occupied.get(key(-12, y)).entity_number, inserter: input.entity_number });
  add('display-panel', -10, y + 2, { text: item, icon: { type: 'item', name: item }, always_show: true });
}

// Reserve light oil for superconductors and heavy oil for electrolyte/lubricant.
// Distinct network names downstream of each pump prevent the router bypassing it.
const valves = [];
for (const [i, fluid, downstream, threshold, comparator, pumpFluid] of [
  [0, 'heavy-oil', 'heavy-cracking-feed', 1000, '>', 'heavy-oil'],
  [1, 'light-oil', 'light-cracking-feed', 500, '>', 'light-oil'],
  [2, 'lubricant', 'lubricant-feed', 1500, '<', 'heavy-oil'],
]) {
  const x = 22 + i * 12, y = 76;
  const tank = add('storage-tank', x, y, { tags: { mall_fluid: fluid, mall_net: fluid } });
  terminal(x - 1, y - 2, fluid, fluid, 0);
  const pump = add('pump', x + 4.5, y, { direction: 8, control_behavior: {
    circuit_enabled: true, circuit_condition: { first_signal: { type: 'fluid', name: fluid }, comparator, constant: threshold },
  } }, true);
  terminal(x + 4, y - 2, pumpFluid, pumpFluid, 0);
  terminal(x + 4, y + 1, downstream, pumpFluid, 8);
  wires.push([tank.entity_number, 1, pump.entity_number, 1]);
  valves.push({ tank: tank.entity_number, pump: pump.entity_number, fluid, downstream, threshold, comparator });
}
const fluidInputs = [{ fluid: 'water', x: 78, y: 54 }, { fluid: 'crude-oil', x: 82, y: 54 }];
for (const input of fluidInputs) {
  terminal(input.x, input.y, input.fluid, input.fluid, 8);
  add('display-panel', input.x, input.y - 2, { text: `Connect ${input.fluid}`, icon: { type: 'fluid', name: input.fluid }, always_show: true });
}

function distance(a,b) { return Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y); }
function tileBox(e) {
  let [[a,b],[c,d]] = proto.get(e.name).selection_box;
  if ([4,12].includes(e.direction)) [a,b,c,d]=[b,a,d,c];
  return {x1:Math.floor(e.position.x+a+.01),y1:Math.floor(e.position.y+b+.01),x2:Math.ceil(e.position.x+c-.01),y2:Math.ceil(e.position.y+d-.01)};
}
function covered(p,e) {
  const r=proto.get(p.name).supply_area_distance,b=tileBox(e);
  return b.x1<p.position.x+r && b.x2>p.position.x-r && b.y1<p.position.y+r && b.y2>p.position.y-r;
}
function substationFits(x,y) {
  for(const u of [x-1,x])for(const v of [y-1,y])if(occupied.has(key(u,v))||terminals.has(key(u,v)))return false;
  return true;
}
const consumers=entities.filter(e=>proto.get(e.name).energy_source?.type==='electric');
let missing=consumers.filter(e=>!poles.some(p=>covered(p,e)));
while(missing.length){
  let best;
  for(let y=1-origin.y;y<=99-origin.y;y++)for(let x=4-origin.x;x<=99-origin.x;x++){
    if(!substationFits(x,y))continue;
    const candidate={name:'substation',position:{x,y}};
    const coveredEntities=missing.filter(e=>covered(candidate,e));
    const score=coveredEntities.length;
    const centrality=coveredEntities.reduce((s,e)=>s+distance(candidate,e),0);
    if(score && (!best || score>best.score || (score===best.score && centrality<best.centrality)))best={x,y,score,centrality};
  }
  assert(best,`No substation location covers ${missing.length} remaining consumers`);
  const p=add('substation',best.x,best.y,{},true);poles.push(p);
  missing=missing.filter(e=>!covered(p,e));
}
const wireRange=e=>proto.get(e.name).maximum_wire_distance || proto.get(e.name).circuit_wire_max_distance || 9;
function wireable(a,b){return distance(a,b)<=Math.min(wireRange(a),wireRange(b));}
const reached = new Set([poles[0]]);
while (reached.size < poles.length) {
  let best;
  for (const a of reached) for (const b of poles) if (!reached.has(b) && wireable(a,b) && (!best || distance(a,b) < best.d)) best={a,b,d:distance(a,b)};
  assert(best, 'Disconnected power grid');
  for (const connector of [5, 2]) wires.push([best.a.entity_number,connector,best.b.entity_number,connector]);
  reached.add(best.b);
}
const greenReached = new Set(poles), pending = new Set([reader,...controlled]);
const relays = entities.filter(e=>e.name==='stack-inserter');
while(pending.size){
  let best;
  for(const a of greenReached)for(const b of pending)if(wireable(a,b)&&(!best||distance(a,b)<best.d))best={a,b,d:distance(a,b)};
  if(!best){
    for(const a of greenReached)for(const b of relays)if(!greenReached.has(b)&&wireable(a,b)){
      const score=Math.min(...[...pending].map(e=>distance(b,e)));
      if(!best||score<best.score)best={a,b,score};
    }
  }
  assert(best,'No green circuit path to remaining inserters');
  wires.push([best.a.entity_number,2,best.b.entity_number,2]);greenReached.add(best.b);pending.delete(best.b);
}

// Fluid autorouter. Underground connections can cross belts and machines, but
// never overlap another underground span on the same axis. Surface ports from
// different networks must not touch. Each endpoint is connected to its network.
const bounds={minX:-2,maxX:84,minY:44,maxY:80};
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

for(const e of entities){e.tags={...e.tags,mall_id:e.entity_number};e.position.x+=origin.x;e.position.y+=origin.y;}
for(const p of [...feeds,...fluidInputs,...terminals.values()]){p.x+=origin.x;p.y+=origin.y;}
const seenWires=new Set();
const uniqueWires=wires.filter(([a,ca,b,cb])=>{
  const k=a<b?`${a}:${ca}-${b}:${cb}`:`${b}:${cb}-${a}:${ca}`;
  if(seenWires.has(k))return false;seenWires.add(k);return true;
});
const factoryEntities=entities.filter(e=>!e.tags.mall_extension_id), factoryBoxes=factoryEntities.map(tileBox);
const factoryBounds={minX:Math.min(...factoryBoxes.map(b=>b.x1)),minY:Math.min(...factoryBoxes.map(b=>b.y1)),maxX:Math.max(...factoryBoxes.map(b=>b.x2)),maxY:Math.max(...factoryBoxes.map(b=>b.y2))};
assert(factoryBounds.minX>=0&&factoryBounds.minY>=0&&factoryBounds.maxX<=100&&factoryBounds.maxY<=100,'Mall must fit within a 2 by 2 bay of the extension');
const description=[
  'Substation-powered turbo mall integrated into the supplied Robot Extension (5x5). All 25 roboports and 85 big electric poles retain their original positions and connections. Match its roboports when placing over an existing extension.',
  'The factory fits inside a 100 x 100 tile bay of the 50-tile robot grid. Turbo underground belts pass beneath the reserved roboport/pole positions. Normal-quality substations supply the machines.',
  'Turbo belts and filtered stack inserters move every ingredient. Logistic robots are optional for collecting finished products; production itself needs none.',
  'Feed the five labeled west-side belts with iron ore, copper ore, coal, holmium ore and stone. Connect water/crude oil at the east edge and connect power.',
  'Makes the original solid mall outputs plus roboports, repair packs and Tesla turrets. The entire Tesla chain is included: holmium solution/plates, blue circuits, superconductors, electrolyte, supercapacitors and Tesla guns.',
  'Light oil supplies superconductors first; surplus is cracked to petroleum gas. Heavy-oil and lubricant reserves are controlled by wired pumps.',
  'Keep the circulating belt and green wires intact: one sensor counts belt contents; filtered inserters and stock limits keep ingredients circulating. Output chest limits are adjustable. All equipment is normal quality.',
  'Space Age technologies, turbo belts, stack inserters and electromagnetic plants are required as construction materials. These top-tier transport items need to be built/imported before placing this mall.',
].join('\n\n');
const blueprint={blueprint:{item:'blueprint',label:'Substation Turbo Mall - 5x5 Robot Extension',description,version:562949958467584,
  'snap-to-grid':extension['snap-to-grid'],'absolute-snapping':extension['absolute-snapping'],'position-relative-to-grid':extension['position-relative-to-grid'],
  icons:[{signal:{type:'item',name:'substation'},index:1},{signal:{type:'item',name:'roboport'},index:2},{signal:{type:'item',name:'repair-pack'},index:3},{signal:{type:'item',name:'tesla-turret'},index:4}],entities,wires:uniqueWires}};
fs.mkdirSync('.cache/belt-tesla-mall',{recursive:true});
fs.writeFileSync('mall/compact_turbo_tesla_mall.json',JSON.stringify(blueprint,null,2)+'\n');
fs.writeFileSync('mall/compact_turbo_tesla_mall.txt',encodeBlueprint(blueprint)+'\n');
fs.writeFileSync('.cache/belt-tesla-mall/manifest.json',JSON.stringify({cells,outputs,limits,feeds,fluidInputs,loop,reader:reader.entity_number,valves,powerPoint:{x:-75,y:-98},terminals:[...terminals.values()],factoryBounds,extension:{file:'mall/robot_extension_5x5.txt',entities:extension.entities,entityIds:Object.fromEntries(extensionIds),roboportIds:entities.filter(e=>e.name==='roboport').map(e=>e.entity_number)},substations:entities.filter(e=>e.name==='substation').length},null,2));
console.log(`Wrote substation mall: ${entities.length} entities, ${recipes.length} machines, ${loop.length} loop belts, ${entities.filter(e=>e.name==='substation').length} substations; factory bounds ${JSON.stringify(factoryBounds)}.`);
