// Shared helpers of the Vulcanus circuit blueprints (electronic-circuits, advanced-circuits, processing-units): layout builder,
// fluid-network model, blueprint codec and the constants of the native protocol. What is not specific to this family comes
// unchanged from the blue-tier mall's helpers (never copied).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
export { sha, readJson, json, encode, encodeKeeping, decode, vector, coord, distance, allWires, rotate, box, intersects, contact, inside, envelope, technologyClosure } from '../requested-malls/blue-tier-mall/lib.mjs';
import { readJson } from '../requested-malls/blue-tier-mall/lib.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../..');
// The members that are published (each is added when its own native qualification has passed).
export const IDS = ['electronic-circuits', 'advanced-circuits', 'processing-units'];
export const published = id => path.join(process.env.VULCANUS_CIRCUITS_PUBLISHED ? path.resolve(process.env.VULCANUS_CIRCUITS_PUBLISHED) : path.join(PROJECT, 'blueprint-sources/vulcanus-circuits'), id);
export const prototypes = () => readJson(path.join(HERE, 'prototypes.json'));
export const fluidSlots = () => readJson(path.join(HERE, 'fluid-slots.json'));
export const exists = file => fs.access(file).then(() => true, () => false);
// The 64-bit version number a blueprint of this game version carries (major, minor, patch, build).
export const blueprintVersion = gameVersion => { const [a, b, c] = gameVersion.split('.').map(BigInt); return Number((a << 48n) + (b << 32n) + (c << 16n)); };

export const N = 0, E = 4, S = 8, W = 12;
export const VEC = { 0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0] };
export const opposite = d => (d + 8) % 16;
export const DIR_NAME = { 0: 'north', 4: 'east', 8: 'south', 12: 'west' };
// Whole-tile size of every entity these blueprints use (the rest are one tile).
export const SIZE = { foundry: 5, 'assembling-machine-3': 3, substation: 2 };
export const sizeOf = name => SIZE[name] || 1;
export const MACHINES = ['foundry', 'assembling-machine-3'];
export const BELT_TIERS = { yellow: ['transport-belt', 'underground-belt'], red: ['fast-transport-belt', 'fast-underground-belt'], blue: ['express-transport-belt', 'express-underground-belt'] };
export const BELTS = Object.values(BELT_TIERS).map(v => v[0]), UNDERGROUNDS = Object.values(BELT_TIERS).map(v => v[1]);
export const isBelt = e => BELTS.includes(e.name) || UNDERGROUNDS.includes(e.name);
export const isArm = e => /inserter$/.test(e.name);
// Hand sizes are pinned in the blueprint: with only the bulk inserter researched a bulk arm carries 2 and the others 1, and an
// override never lets an arm carry more than the research allows, so these are the sizes that hold at every research level.
export const HAND = { 'fast-inserter': 1, 'bulk-inserter': 2, 'long-handed-inserter': 1 };

// ---------------------------------------------------------------------------------------------------------------------------
// Layout builder: collision-checked entities on a tile grid. Coordinates are tiles (x east, y south); add() takes the top-left
// tile, machine() the centre tile. The blueprint position of an entity is the centre of its tiles.
export class Layout {
  constructor() { this.entities = []; this.grid = new Map(); this.lines = new Map(); this.routes = []; this.roles = new Map(); }
  key(x, y) { return x + ',' + y; }
  at(x, y) { return this.grid.get(this.key(x, y)); }
  free(x, y) { return !this.grid.has(this.key(x, y)); }
  add(name, x, y, extra = {}) {
    const s = sizeOf(name), e = { entity_number: this.entities.length + 1, name, position: { x: x + s / 2, y: y + s / 2 }, ...extra };
    if (!e.direction) delete e.direction;
    Object.defineProperty(e, 'tile', { value: { x, y, s }, enumerable: false });
    for (let u = 0; u < s; u++) for (let v = 0; v < s; v++) {
      const k = this.key(x + u, y + v);
      if (this.grid.has(k)) throw new Error(`${name} at ${x},${y} collides with ${this.grid.get(k).name} #${this.grid.get(k).entity_number} at ${k}`);
      this.grid.set(k, e);
    }
    this.entities.push(e);
    return e;
  }
  // A machine by its centre tile, with its role (what it is for) and group (the machines that are stopped or built together).
  machine(name, cx, cy, recipe, direction, role, group = role) {
    const h = (sizeOf(name) - 1) / 2, e = this.add(name, cx - h, cy - h, { direction, recipe });
    this.roles.set(e.entity_number, { role, group });
    return e;
  }
  pipe(x, y) { return this.add('pipe', x, y); }
  // A run of plain pipes from (x0, y0) to (x1, y1), both included (one of the two coordinates is constant).
  pipes(x0, y0, x1, y1) { const out = []; for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) out.push(this.pipe(x, y)); return out; }
  // A pipe-to-ground: `open` is the side of its open end; the underground runs the other way.
  ptg(x, y, open) { return this.add('pipe-to-ground', x, y, { direction: open }); }
  // An underground pipe hop along a row or column: open ends face outward.
  hop(x0, y0, x1, y1) { const d = x0 === x1 ? (y1 > y0 ? S : N) : (x1 > x0 ? E : W); return [this.ptg(x0, y0, opposite(d)), this.ptg(x1, y1, d)]; }
  // Belts carry the name of the line they belong to (what may ride on it); the audit recomputes the lines from the string.
  belt(tier, line, x, y, d) { const e = this.add(BELT_TIERS[tier][0], x, y, { direction: d }); this.lineOf(line).push(e); return e; }
  ug(tier, line, x, y, d, type) { const e = this.add(BELT_TIERS[tier][1], x, y, { direction: d, type }); this.lineOf(line).push(e); return e; }
  // A straight run of belt from (x0, y0) to (x1, y1) flowing that way, both ends included.
  run(tier, line, x0, y0, x1, y1) { const d = x0 === x1 ? (y1 > y0 ? S : N) : (x1 > x0 ? E : W), [vx, vy] = VEC[d], out = []; for (let x = x0, y = y0; ; x += vx, y += vy) { out.push(this.belt(tier, line, x, y, d)); if (x === x1 && y === y1) break; } return out; }
  // An underground belt hop flowing from (x0, y0) to (x1, y1).
  dive(tier, line, x0, y0, x1, y1) { const d = x0 === x1 ? (y1 > y0 ? S : N) : (x1 > x0 ? E : W); return [this.ug(tier, line, x0, y0, d, 'input'), this.ug(tier, line, x1, y1, d, 'output')]; }
  lineOf(name) { if (!this.lines.has(name)) this.lines.set(name, []); return this.lines.get(name); }
  // An arm: `from` is the side it picks up from; it drops on the opposite side. Its hand size is pinned.
  arm(kind, x, y, from, label, filter) {
    const e = this.add(kind, x, y, { direction: from, override_stack_size: HAND[kind], ...(filter ? { use_filters: true, filter_mode: 'whitelist', filters: [{ index: 1, name: filter, quality: 'normal', comparator: '=' }] } : {}) });
    this.routes.push({ inserter: e.entity_number, label });
    return e;
  }
  panel(x, y, text, name, type = 'item') { return this.add('display-panel', x, y, { text, always_show: true, icon: { type, name } }); }
  bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of this.entities) { x0 = Math.min(x0, e.tile.x); y0 = Math.min(y0, e.tile.y); x1 = Math.max(x1, e.tile.x + e.tile.s - 1); y1 = Math.max(y1, e.tile.y + e.tile.s - 1); }
    return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }
}

// The tiles an entity stands on, from its blueprint position.
export function tilesOf(e) {
  const s = sizeOf(e.name), x0 = Math.round(e.position.x - s / 2), y0 = Math.round(e.position.y - s / 2), out = [];
  for (let u = 0; u < s; u++) for (let v = 0; v < s; v++) out.push({ x: x0 + u, y: y0 + v });
  return out;
}
export const tileOf = e => ({ x: Math.floor(e.position.x), y: Math.floor(e.position.y) });
export const tileMap = entities => { const m = new Map(); for (const e of entities) for (const t of tilesOf(e)) m.set(t.x + ',' + t.y, e); return m; };

// ASCII picture of a layout, one character per tile.
export function glyph(e) {
  const d = e.direction || 0, arrow = { 0: '^', 4: '>', 8: 'v', 12: '<' }[d];
  if (e.name === 'pipe') return '=';
  if (e.name === 'pipe-to-ground') return { 0: 'n', 4: 'e', 8: 's', 12: 'w' }[d];
  if (e.name === 'foundry') return { 'molten-copper-from-lava': 'C', 'molten-iron-from-lava': 'I', 'casting-iron': 'P', 'casting-copper-cable': 'K' }[e.recipe] || 'F';
  if (e.name === 'assembling-machine-3') return { 'electronic-circuit': 'G', 'advanced-circuit': 'R', 'processing-unit': 'B' }[e.recipe] || 'A';
  if (e.name === 'substation') return '#';
  if (BELTS.includes(e.name)) return arrow;
  if (UNDERGROUNDS.includes(e.name)) return e.type === 'input' ? 'u' : 'o';
  if (e.name === 'bulk-inserter') return 'b';
  if (e.name === 'fast-inserter') return 'i';
  if (e.name === 'long-handed-inserter') return 'l';
  if (e.name === 'display-panel') return '!';
  return '?';
}
export function ascii(entities) {
  const grid = new Map();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of entities) for (const t of tilesOf(e)) { grid.set(t.x + ',' + t.y, glyph(e)); x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y); }
  const rows = [];
  for (let y = y0; y <= y1; y++) { let r = ''; for (let x = x0; x <= x1; x++) r += grid.get(x + ',' + y) || '.'; rows.push(r); }
  return rows;
}
export const LEGEND = '`C` lava foundry (molten copper), `I` lava foundry (molten iron), `P` foundry casting iron plate, `K` foundry casting copper cable, `G` assembling machine 3 (electronic circuit), `R` assembling machine 3 (advanced circuit), `B` assembling machine 3 (processing unit), `#` substation, `!` display panel, `=` pipe, `n e s w` pipe-to-ground (the letter is the side of its open end; its underground runs the other way), `^ > v <` belt (the way it runs), `u`/`o` underground belt in/out, `b` bulk inserter, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0.';

// ---------------------------------------------------------------------------------------------------------------------------
// Fluid model. It encodes only what the pinned native probe (fluid-slots.json) shows.
//  - pipe: connects on all four sides.
//  - pipe-to-ground with open side d: a normal connection on side d, an underground connection on the other side that pairs
//    with the nearest pipe-to-ground on that line facing back, at most 10 tiles away. One facing the same way in between blocks it.
//  - machines: the target tiles of fluid-slots.json per recipe, direction and mirroring. Both tiles of a box that a one-fluid
//    recipe uses are one box. A port that no box of the recipe uses joins nothing (probe: unfilteredBoxesInert).
export const MAX_UNDERGROUND = 10;
const slotKey = e => `${e.name}|${e.recipe}`;
const dirKey = e => 'd' + (e.direction || 0) + (e.mirror ? 'M' : '');
const centreTile = e => ({ x: Math.round(e.position.x - 0.5), y: Math.round(e.position.y - 0.5) });
// A port as the tile outside the machine a pipe must stand on (target) and the side of the machine it is on.
function portAt(e, dx, dy) {
  const half = (sizeOf(e.name) - 1) / 2, c = centreTile(e);
  const side = Math.abs(dx) > half ? (dx > 0 ? E : W) : (dy > 0 ? S : N);
  return { target: { x: c.x + dx, y: c.y + dy }, side };
}
export function machineBoxes(e, slots) {
  const table = slots.slots[slotKey(e)];
  if (!table) throw new Error(`no fluid slot table for ${slotKey(e)}`);
  // (a machine whose recipe has no fluid has no ports to turn: the game reports it facing north whatever the blueprint says)
  const boxes = table[dirKey(e)] ?? (Object.values(table).every(b => b.length === 0) ? [] : undefined);
  if (!boxes) throw new Error(`no fluid slot table for ${slotKey(e)} ${dirKey(e)}`);
  return boxes.map((b, index) => ({ index, fluid: b.fluid, flow: b.flow, ends: b.targets.map(([dx, dy]) => portAt(e, dx, dy)) }));
}
// Every pipe connection the machine's prototype has, whatever the recipe: a foundry has two on its output side and two on the
// opposite side (one tile either side of the middle), an assembling machine 3 one in the middle of its facing side and one opposite.
export function allPorts(e) {
  const d = e.direction || 0, half = (sizeOf(e.name) - 1) / 2 + 1, out = [];
  for (const side of [d, opposite(d)]) {
    const [vx, vy] = VEC[side];
    for (const k of e.name === 'foundry' ? [-1, 1] : [0]) out.push(portAt(e, vx * half + (vx ? 0 : k), vy * half + (vy ? 0 : k)));
  }
  return out;
}
export function unusedPorts(e, slots) {
  const used = new Set(machineBoxes(e, slots).flatMap(b => b.ends.map(en => en.target.x + ',' + en.target.y)));
  return allPorts(e).filter(q => !used.has(q.target.x + ',' + q.target.y));
}
export function analyzeFluids(entities, slots) {
  const key = (x, y) => x + ',' + y, byTile = tileMap(entities);
  const ends = [], problems = [];
  for (const e of entities) {
    const t = tileOf(e), d = e.direction || 0;
    if (e.name === 'pipe') for (const s of [N, E, S, W]) ends.push({ e, node: `${e.entity_number}:p`, tile: t, side: s, kind: 'normal' });
    else if (e.name === 'pipe-to-ground') {
      ends.push({ e, node: `${e.entity_number}:p`, tile: t, side: d, kind: 'normal' });
      ends.push({ e, node: `${e.entity_number}:p`, tile: t, side: opposite(d), kind: 'ug' });
    } else if (MACHINES.includes(e.name)) {
      // a machine end sits on the target tile and faces back at the machine
      for (const b of machineBoxes(e, slots)) for (const en of b.ends) ends.push({ e, node: `${e.entity_number}:${b.index}`, tile: en.target, side: opposite(en.side), kind: 'machine', fluid: b.fluid, flow: b.flow, box: b.index });
    }
  }
  const edges = [];
  const normalAt = new Map();
  for (const n of ends) if (n.kind === 'normal') { const k = key(n.tile.x, n.tile.y) + ':' + n.side; normalAt.set(k, [...(normalAt.get(k) || []), n]); }
  const joinedEnds = new Set();
  for (const n of ends) {
    if (n.kind === 'normal') {
      const [vx, vy] = VEC[n.side], t = { x: n.tile.x + vx, y: n.tile.y + vy };
      for (const m of normalAt.get(key(t.x, t.y) + ':' + opposite(n.side)) || []) if (m.e !== n.e && n.node < m.node) edges.push([n.node, m.node]);
    } else if (n.kind === 'machine') {
      // the port joins whatever stands on its target tile with a connection facing the machine
      const o = byTile.get(key(n.tile.x, n.tile.y));
      if (!o) continue;
      if (o.name === 'pipe' || (o.name === 'pipe-to-ground' && (o.direction || 0) === n.side)) { edges.push([n.node, `${o.entity_number}:p`]); joinedEnds.add(n); }
      else if (MACHINES.includes(o.name)) problems.push(`machine #${n.e.entity_number} has a ${n.fluid} port against machine #${o.entity_number}`);
    } else {
      const [vx, vy] = VEC[n.side]; let paired = null;
      for (let k = 1; k <= MAX_UNDERGROUND; k++) {
        const o = byTile.get(key(n.tile.x + vx * k, n.tile.y + vy * k));
        if (!o || o.name !== 'pipe-to-ground') continue;
        const od = o.direction || 0;
        if (od === n.side || od === opposite(n.side)) { if (od === n.side) paired = o; else problems.push(`pipe-to-ground #${n.e.entity_number} meets one facing the same way (#${o.entity_number})`); break; }
      }
      if (!paired) problems.push(`unpaired underground of pipe-to-ground #${n.e.entity_number}`);
      else if (n.e.entity_number < paired.entity_number) edges.push([n.node, `${paired.entity_number}:p`]);
    }
  }
  const parent = new Map(), find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const add = a => { if (!parent.has(a)) parent.set(a, a); };
  for (const n of ends) add(n.node);
  for (const [a, b] of edges) { add(a); add(b); parent.set(find(a), find(b)); }
  const comps = new Map();
  for (const n of ends) {
    const r = find(n.node), c = comps.get(r) || { fluids: new Set(), entities: new Set(), boxes: new Map(), pipes: 0 };
    c.entities.add(n.e.entity_number);
    if (n.kind === 'machine') { c.fluids.add(n.fluid); c.boxes.set(n.e.entity_number + ':' + n.box, { entity: n.e.entity_number, box: n.box, fluid: n.fluid, flow: n.flow }); } else c.pipes++;
    comps.set(r, c);
  }
  const components = [...comps.values()].map(c => ({ fluids: [...c.fluids].sort(), entities: [...c.entities].sort((a, b) => a - b), boxes: [...c.boxes.values()], pipes: c.pipes })).sort((a, b) => a.entities[0] - b.entities[0]).map((c, i) => ({ id: i + 1, ...c }));
  for (const c of components) {
    if (c.fluids.length > 1) problems.push(`mixed network #${c.id}: ${c.fluids.join(' + ')}`);
    if (c.fluids.length === 0) problems.push(`pipes that touch no machine port: network #${c.id} (entities ${c.entities.slice(0, 4).join(', ')})`);
    if (c.pipes === 0) problems.push(`machine #${c.boxes[0].entity} has a ${c.fluids[0]} box on no pipe`);
  }
  const fluidOf = new Map();
  for (const c of components) for (const id of c.entities) fluidOf.set(id, c.fluids[0] || null);
  // The rule a released blueprint broke: a port the recipe does not use must face no pipe opening and no other machine's port.
  const stray = [];
  for (const e of entities.filter(e => MACHINES.includes(e.name))) for (const q of unusedPorts(e, slots)) {
    const o = byTile.get(key(q.target.x, q.target.y));
    if (!o) continue;
    const facing = opposite(q.side);
    if (o.name === 'pipe' || (o.name === 'pipe-to-ground' && (o.direction || 0) === facing)) stray.push(`unused port of #${e.entity_number} (${e.recipe}) faces ${o.name} #${o.entity_number} at ${q.target.x},${q.target.y}`);
    else if (MACHINES.includes(o.name) && machineBoxes(o, slots).some(b => b.ends.some(en => { const [vx, vy] = VEC[en.side]; const edge = { x: en.target.x - vx, y: en.target.y - vy }; return tilesOf(o).some(t => t.x === edge.x && t.y === edge.y) && tilesOf(e).some(t => t.x === en.target.x && t.y === en.target.y); }))) stray.push(`unused port of #${e.entity_number} faces a used port of machine #${o.entity_number}`);
  }
  return { components, problems, fluidOf, stray, joinedEnds: [...joinedEnds].map(n => ({ entity: n.e.entity_number, box: n.box, target: n.tile })) };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Belts: which belt entity feeds which, undergrounds paired by tier, and the connected lines.
export function beltGraph(entities, p) {
  const belts = entities.filter(isBelt), at = new Map(belts.map(b => [tileOf(b).x + ',' + tileOf(b).y, b]));
  const problems = [], next = new Map(), pair = new Map(), deadEnds = [];
  const front = b => { const t = tileOf(b), v = VEC[b.direction || 0]; return at.get((t.x + v[0]) + ',' + (t.y + v[1])); };
  for (const b of belts) {
    if (UNDERGROUNDS.includes(b.name) && b.type === 'input') {
      const t = tileOf(b), v = VEC[b.direction || 0], max = p.entities[b.name].max_distance;
      let out = null;
      for (let k = 1; k <= max; k++) {
        const o = at.get((t.x + v[0] * k) + ',' + (t.y + v[1] * k));
        if (o && o.name === b.name && ((o.direction || 0) === (b.direction || 0) || (o.direction || 0) === opposite(b.direction || 0))) { if (o.type === 'output' && (o.direction || 0) === (b.direction || 0)) out = o; break; }
      }
      if (!out) problems.push(`underground belt #${b.entity_number} has no exit within reach`); else { pair.set(b.entity_number, out); next.set(b.entity_number, out); }
    } else {
      const f = front(b);
      if (!f) continue;
      const fd = f.direction || 0, bd = b.direction || 0;
      // head-on: nothing passes; the belt ends there (the calcite belt ends against the stone belt's underground entrance)
      if (fd === opposite(bd)) { deadEnds.push([b.entity_number, f.entity_number]); continue; }
      if (UNDERGROUNDS.includes(f.name) && f.type === 'output' && fd === bd) { problems.push(`belt #${b.entity_number} runs into the back of underground exit #${f.entity_number}`); continue; }
      if (UNDERGROUNDS.includes(f.name) && fd !== bd) { problems.push(`belt #${b.entity_number} side-loads underground belt #${f.entity_number}`); continue; }
      next.set(b.entity_number, f);
    }
  }
  const paired = new Set([...pair.values()].map(o => o.entity_number));
  for (const b of belts) if (UNDERGROUNDS.includes(b.name) && b.type === 'output' && !paired.has(b.entity_number)) problems.push(`underground belt exit #${b.entity_number} has no entrance`);
  // connected lines: everything joined by a feed (straight, turn, side-load or underground)
  const parent = new Map(belts.map(b => [b.entity_number, b.entity_number])), find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  for (const [a, b] of next) parent.set(find(a), find(b.entity_number));
  const groups = new Map();
  for (const b of belts) { const r = find(b.entity_number); groups.set(r, [...(groups.get(r) || []), b.entity_number]); }
  return { belts, at, next, pair, problems, deadEnds, lines: [...groups.values()].map(g => g.sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]) };
}

// The tile an inserter takes from and drops on.
import { contact as contactOf, box as boxOf, intersects as hits, inside as within } from '../requested-malls/blue-tier-mall/lib.mjs';
export function insertTiles(e, p) {
  const pick = contactOf(e, p, 'pickup'), drop = contactOf(e, p, 'drop');
  return { pickup: { x: Math.floor(pick.x), y: Math.floor(pick.y) }, drop: { x: Math.floor(drop.x), y: Math.floor(drop.y) } };
}
// Power: every electric entity must have a substation whose supply area touches its box.
export function powerCoverage(entities, p) {
  const poles = entities.filter(e => e.name === 'substation'), reach = p.entities.substation.supply_area_distance;
  const covered = (e, pl) => hits(boxOf(e, p), { left: pl.position.x - reach, right: pl.position.x + reach, top: pl.position.y - reach, bottom: pl.position.y + reach });
  const electric = entities.filter(e => p.entities[e.name]?.energy_source?.type === 'electric');
  return { poles, electric, unpowered: electric.filter(e => !poles.some(pl => covered(e, pl))).map(e => e.entity_number) };
}
