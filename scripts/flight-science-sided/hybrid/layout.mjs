import assert from 'node:assert/strict';
import {powerStarterLayout, starterBounds} from '../../science-factory/local-ports/compact-shared-layout.mjs';

const clone = value => structuredClone(value);
const key = (x, y) => `${x},${y}`;
const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const belts = new Set(['fast-transport-belt', 'fast-underground-belt']);

// Geometry and wires are copied verbatim, apart from translation and identity.
// Every upstream component is frozen beside the final blueprint with its hash.
export class Layout {
  constructor(raw) {
    this.raw = raw;
    this.entities = [];
    this.wires = [];
    this.ports = [];
    this.loops = [];
    this.components = [];
    this.grid = new Map();
    this.next = 1;
  }
  add(name, x, y, extra = {}) {
    const e = {entity_number: this.next++, name, position: {x: x + .5, y: y + .5}, ...extra};
    this.place(e);
    return e;
  }
  place(e) {
    const radius = e.name === 'assembling-machine-2' ? 1 : 0;
    const x = Math.floor(e.position.x), y = Math.floor(e.position.y);
    for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
      const p = key(x + dx, y + dy);
      assert(!this.grid.has(p), `Collision: ${e.name} #${e.entity_number} at ${p} / ${this.grid.get(p)?.name}`);
      this.grid.set(p, e);
    }
    this.entities.push(e);
  }
  remove(id) {
    const e = this.entities.find(e => e.entity_number === id);
    assert(e, `Missing entity ${id}`);
    this.entities = this.entities.filter(value => value !== e);
    for (const [p, value] of this.grid) if (value === e) this.grid.delete(p);
    this.wires = this.wires.filter(w => w[0] !== id && w[2] !== id);
    return e;
  }
  import(bp, manifest, dx = 0, dy = 0) {
    const map = new Map();
    const included = bp.entities.filter(e => !e.name.endsWith('electric-pole') && e.name !== 'display-panel');
    for (const original of included) {
      const e = clone(original), id = this.next++;
      map.set(e.entity_number, id);
      e.entity_number = id;
      e.position.x += dx; e.position.y += dy;
      e.tags = {...e.tags, flight_science_entity: id, hybrid_component: manifest.id, source_entity: original.entity_number};
      this.place(e);
    }
    for (const w of bp.wires || []) if (map.has(w[0]) && map.has(w[2])) this.wires.push([map.get(w[0]), w[1], map.get(w[2]), w[3]]);
    const ports = manifest.ports.filter(p => p.kind !== 'power').map(p => {
      const copy = {...clone(p), entity: map.get(p.entity), x: p.x + dx, y: p.y + dy, component: manifest.id};
      delete copy.displayEntity;
      return copy;
    });
    this.ports.push(...ports);
    for (const loop of manifest.loopControl || []) {
      const copy = {...clone(loop), name: `${manifest.id}/${loop.name}`, reader: map.get(loop.reader), controlled: loop.controlled.map(id => map.get(id))};
      if (copy.loop) copy.loop = copy.loop.map(id => map.get(id));
      if (copy.x !== undefined) copy.x += dx;
      if (copy.y !== undefined) copy.y += dy;
      this.loops.push(copy);
    }
    const component = {id: manifest.id, blueprintSha256: manifest.blueprintSha256, translation: {x: dx, y: dy}, ports, map};
    this.components.push(component);
    return component;
  }
  at(x, y) { return this.grid.get(key(x, y)); }
  belt(x, y, d) { return this.add('fast-transport-belt', x, y, {direction: d}); }
  // A route uses only unoccupied tiles, and red underground belts of legal span.
  // It cannot tap the forward end of another belt, or pair with another tunnel.
  route(start, finish, options = {}) {
    const sx = Math.floor(start.x), sy = Math.floor(start.y), tx = Math.floor(finish.x), ty = Math.floor(finish.y);
    const minX = options.minX ?? -22, maxX = options.maxX ?? 112;
    const minY = options.minY ?? -14, maxY = options.maxY ?? 90;
    const blocked = options.blocked || new Set();
    const startId = this.at(sx, sy)?.entity_number, endId = this.at(tx, ty)?.entity_number;
    const endDirection = this.at(tx, ty)?.direction;
    const forbidden = new Set(blocked);
    for (const e of this.entities) {
      if (!belts.has(e.name) || e.name === 'fast-underground-belt' && e.type === 'input') continue;
      const [dx, dy] = dirs[(e.direction || 0) / 4], x = Math.floor(e.position.x) + dx, y = Math.floor(e.position.y) + dy;
      if (!this.at(x, y) && e.entity_number !== startId) forbidden.add(key(x, y));
    }
    const free = (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY && !forbidden.has(key(x, y)) && (!this.at(x, y) || x === tx && y === ty);
    function heapPush(heap, value) {
      let i = heap.length; heap.push(value);
      while (i) { const p = (i - 1) >> 1; if (heap[p].f <= value.f) break; heap[i] = heap[p]; i = p; }
      heap[i] = value;
    }
    function heapPop(heap) {
      const out = heap[0], last = heap.pop();
      if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++; if (heap[c].f >= last.f) break; heap[i] = heap[c]; i = c; } heap[i] = last; }
      return out;
    }
    const tunnelSafe = (x, y, ex, ey, d) => {
      const [vx, vy] = dirs[d / 4];
      for (const e of this.entities) {
        if (e.name !== 'fast-underground-belt' || e.direction !== d) continue;
        const px = Math.floor(e.position.x), py = Math.floor(e.position.y);
        if (vx ? py !== y : px !== x) continue;
        const inputSpan = (px - x) * vx + (py - y) * vy;
        const outputSpan = (ex - px) * vx + (ey - py) * vy;
        if (e.type === 'output' && inputSpan > 0 && inputSpan <= 7 || e.type === 'input' && outputSpan > 0 && outputSpan <= 7) return false;
      }
      return true;
    };
    const stateKey = (x, y, d, landed) => `${x},${y},${d},${landed ? 1 : 0}`;
    const heuristic = (x, y) => Math.abs(tx - x) + Math.abs(ty - y);
    const heap = [], costs = new Map(), prev = new Map();
    const initial = {x: sx, y: sy, d: options.startDirection ?? -1, landed: false, g: 0};
    initial.key = stateKey(initial.x, initial.y, initial.d, false); initial.f = heuristic(sx, sy);
    heapPush(heap, initial); costs.set(initial.key, 0);
    let found;
    while (heap.length) {
      const node = heapPop(heap);
      if (node.g !== costs.get(node.key)) continue;
      if (node.x === tx && node.y === ty && (!options.endDirection || node.d === options.endDirection)) { found = node; break; }
      for (let d = 0; d < 16; d += 4) {
        if ((node.landed || node.key === initial.key && options.startDirection !== undefined) && d !== node.d) continue;
        if (node.d >= 0 && d === (node.d + 8) % 16) continue;
        const [dx, dy] = dirs[d / 4];
        const add = (x, y, distance, tunnel) => {
          if (!free(x, y)) return;
          if (x === tx && y === ty && (d === (endDirection + 8) % 16 || tunnel || options.endDirection !== undefined && d !== options.endDirection)) return;
          if (tunnel && (node.d !== d || !tunnelSafe(node.x, node.y, x, y, d) || node.key === initial.key && startId || node.x === tx && node.y === ty)) return;
          const g = node.g + distance + (node.d >= 0 && node.d !== d ? 1.25 : 0) + (tunnel ? 7 : 0);
          const landed = tunnel, k = stateKey(x, y, d, landed);
          if (costs.has(k) && costs.get(k) <= g) return;
          const next = {x, y, d, landed, g, f: g + heuristic(x, y), key: k};
          costs.set(k, g); prev.set(k, {node, tunnel, distance, d}); heapPush(heap, next);
        };
        add(node.x + dx, node.y + dy, 1, false);
        if (!node.landed && node.key !== initial.key && !this.at(node.x, node.y)) for (let span = 2; span <= 7; span++) {
          // Tunnels only cross an obstacle; empty spans retain ordinary belts.
          if (Array.from({length: span - 1}, (_, i) => this.at(node.x + dx * (i + 1), node.y + dy * (i + 1))).some(Boolean)) add(node.x + dx * span, node.y + dy * span, span, true);
        }
      }
    }
    assert(found, `No route from ${sx},${sy} to ${tx},${ty}`);
    const segments = [];
    for (let node = found; node.key !== initial.key;) { const p = prev.get(node.key); segments.push({...p, to: node}); node = p.node; }
    segments.reverse();
    const plan = new Map();
    for (const s of segments) {
      const k = key(s.node.x, s.node.y);
      if (s.tunnel) { plan.set(k, {x:s.node.x,y:s.node.y,d:s.d,type:'input'}); plan.set(key(s.to.x,s.to.y),{x:s.to.x,y:s.to.y,d:s.d,type:'output'}); }
      else if (!plan.has(k)) plan.set(k,{x:s.node.x,y:s.node.y,d:s.d});
    }
    for (const p of plan.values()) {
      const old = this.at(p.x,p.y);
      if (old) { assert(old.entity_number === startId || old.entity_number === endId, 'Route overlaps'); if (old.entity_number === startId) { assert(old.name === 'fast-transport-belt'); old.direction = p.d; } }
      else this.add(p.type ? 'fast-underground-belt' : 'fast-transport-belt', p.x,p.y,{direction:p.d,...(p.type?{type:p.type}:{})});
    }
    return [...plan.values()];
  }
  finish(label, description) {
    this.ports.push({kind:'power',label:'External electricity',items:[],entity:0,x:0,y:0});
    const bp = {item:'blueprint',version:562954249961472,label,description,entities:this.entities,wires:[]};
    powerStarterLayout(bp,this.ports,this.raw);
    bp.wires.push(...this.wires);
    let eid = Math.max(...bp.entities.map(e=>e.entity_number))+1;
    // Signs sit one tile above each exterior port, leaving its approach open.
    const occupied = (x,y) => bp.entities.some(e => Math.abs(e.position.x-x)<(e.name==='assembling-machine-2'?2:e.name==='big-electric-pole'?1.5:1) && Math.abs(e.position.y-y)<(e.name==='assembling-machine-2'?2:e.name==='big-electric-pole'?1.5:1));
    for (const p of this.ports.filter(p=>p.kind!=='power')) {
      for (const [dx,dy] of [[0,-1],[0,1],[1,-1],[1,1],[2,0]]) if (!occupied(p.x+dx,p.y+dy)) {
        const sign={entity_number:eid++,name:'display-panel',position:{x:p.x+dx,y:p.y+dy},icon:{type:'item',name:p.items[0]},text:`${p.kind==='input'?'IN':'OUT'} ${p.label} · ${p.perMinute}/min`,always_show:true};
        bp.entities.push(sign);p.displayEntity=sign.entity_number;break;
      }
    }
    for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
    return {bp,footprint:starterBounds(bp.entities,this.raw)};
  }
}
