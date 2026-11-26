// Shared helpers of the Vulcanus supply blueprints (coal-plastic-lubricant, tungsten-carbide and rocket-fuel): layout builder,
// fluid-network model, blueprint codec, static checks used by the generators, audits, the native validator and the tests.
// What is not specific to these blueprints comes unchanged from the blue-tier mall's helpers (never copied).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
export { sha, readJson, json, encode, encodeKeeping, decode, vector, coord, distance, allWires, rotate, box, intersects, contact, inside, envelope, technologyClosure } from '../requested-malls/blue-tier-mall/lib.mjs';
import { readJson, sha, rotate, box, intersects, contact, inside } from '../requested-malls/blue-tier-mall/lib.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../..');
export const IDS = ['coal-plastic-lubricant', 'tungsten-carbide'];
// Every member. The first two were qualified by the two-scenario supply protocol; later members add their own scenario groups.
export const MEMBERS = [...IDS, 'rocket-fuel'];
export const published = id => path.join(process.env.VULCANUS_SUPPLIES_PUBLISHED ? path.resolve(process.env.VULCANUS_SUPPLIES_PUBLISHED) : path.join(PROJECT, 'blueprint-sources/vulcanus-supplies'), id);
export const exists = file => fs.access(file).then(() => true, () => false);
// The family pins (prototypes.json, fluid-slots.json) are fixed: the two first members' manifests carry their hashes. A later member that
// needs more recipes, items or fluid-port tables keeps its own additions beside its design (<id>/prototypes.json, <id>/fluid-slots.json);
// they are laid over the family pins and may add entries but never change one.
export const memberFile = (id, file) => id ? path.join(HERE, id, file) : null;
const overlay = (base, extra, groups, what) => {
  const out = { ...base };
  for (const g of groups) { out[g] = { ...base[g] }; for (const [k, v] of Object.entries(extra[g] || {})) { if (k in base[g] && JSON.stringify(base[g][k]) !== JSON.stringify(v)) throw new Error(`member ${what} changes the family pin ${g}.${k}`); out[g][k] = v; } }
  return out;
};
export async function prototypes(id) {
  const base = await readJson(path.join(HERE, 'prototypes.json')), file = memberFile(id, 'prototypes.json');
  if (!file || !(await exists(file))) return base;
  const extra = await readJson(file);
  if (extra.gameVersion !== base.gameVersion || extra.provenance.rawSha256 !== base.provenance.rawSha256) throw new Error('member prototypes come from another game dump');
  return { ...overlay(base, extra, ['recipes', 'entities', 'items', 'fluids'], 'prototypes'), ...(extra.facts ? { facts: extra.facts } : {}) };
}
export async function fluidSlots(id) {
  const base = await readJson(path.join(HERE, 'fluid-slots.json')), file = memberFile(id, 'fluid-slots.json');
  if (!file || !(await exists(file))) return base;
  const extra = await readJson(file);
  if (extra.gameVersion !== base.gameVersion) throw new Error('member fluid slots come from another game version');
  return { ...overlay(base, extra, ['slots'], 'fluid slots'), ...(extra.ports ? { ports: extra.ports } : {}), ...(extra.unusedPorts ? { unusedPorts: extra.unusedPorts } : {}) };
}
// Hashes of a member's own pin files (empty for the first two members, which have none).
export async function memberPins(id) {
  const out = {};
  for (const [key, file] of [['memberPrototypeSha256', 'prototypes.json'], ['memberFluidSlotsSha256', 'fluid-slots.json']]) { const f = memberFile(id, file); if (f && await exists(f)) out[key] = sha(await fs.readFile(f)); }
  return out;
}
// The 64-bit version number a blueprint of this game version carries (major, minor, patch, build).
export const blueprintVersion = gameVersion => { const [a, b, c] = gameVersion.split('.').map(BigInt); return Number((a << 48n) + (b << 32n) + (c << 16n)); };

export const N = 0, E = 4, S = 8, W = 12;
export const VEC = { 0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0] };
export const opposite = d => (d + 8) % 16;
// Whole-tile size of every entity these blueprints use (the rest are one tile).
export const SIZE = { 'oil-refinery': 5, 'chemical-plant': 3, 'assembling-machine-3': 3, substation: 2 };
export const sizeOf = name => SIZE[name] || 1;
export const MACHINES = ['oil-refinery', 'chemical-plant', 'assembling-machine-3'];

// ---------------------------------------------------------------------------------------------------------------------------
// Layout builder: collision-checked entities on a tile grid. Coordinates are tiles (x east, y south); add() takes the top-left
// tile, machine() the centre tile. The blueprint position of an entity is the centre of its tiles.
export class Layout {
  constructor() { this.entities = []; this.grid = new Map(); this.ox = 0; this.oy = 0; }
  key(x, y) { return x + ',' + y; }
  at(x, y) { return this.grid.get(this.key(x, y)); }
  add(name, x, y, extra = {}) {
    const s = sizeOf(name), e = { entity_number: this.entities.length + 1, name, position: { x: x + s / 2, y: y + s / 2 }, ...extra };
    if (!e.direction) delete e.direction;
    if (!e.mirror) delete e.mirror;
    Object.defineProperty(e, 'tile', { value: { x, y, s }, enumerable: false });
    for (let u = 0; u < s; u++) for (let v = 0; v < s; v++) {
      const k = this.key(x + u, y + v);
      if (this.grid.has(k)) throw new Error(`${name} at ${x},${y} collides with ${this.grid.get(k).name} #${this.grid.get(k).entity_number} at ${k}`);
      this.grid.set(k, e);
    }
    this.entities.push(e);
    return e;
  }
  machine(name, cx, cy, extra = {}) { const s = sizeOf(name), h = (s - 1) / 2; return this.add(name, cx - h, cy - h, extra); }
  pipe(x, y) { return this.add('pipe', x, y); }
  ptg(x, y, d) { return this.add('pipe-to-ground', x, y, { direction: d }); }
  belt(x, y, d) { return this.add('fast-transport-belt', x, y, { direction: d }); }
  ug(x, y, d, type) { return this.add('fast-underground-belt', x, y, { direction: d, type }); }
  // An inserter's direction is the side it picks up from; it drops on the opposite side.
  fast(x, y, pickupSide, extra = {}) { return this.add('fast-inserter', x, y, { direction: pickupSide, ...extra }); }
  long(x, y, pickupSide, extra = {}) { return this.add('long-handed-inserter', x, y, { direction: pickupSide, ...extra }); }
  panel(x, y, text, name, type = 'item') { return this.add('display-panel', x, y, { text, always_show: true, icon: { type, name } }); }
  free(x, y) { return !this.grid.has(this.key(x, y)); }
  bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of this.entities) { x0 = Math.min(x0, e.tile.x); y0 = Math.min(y0, e.tile.y); x1 = Math.max(x1, e.tile.x + e.tile.s - 1); y1 = Math.max(y1, e.tile.y + e.tile.s - 1); }
    return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }
  // Shift everything so the top-left tile of the envelope is (0, 0) in tile terms and return the blueprint entities (no helper fields).
  // The blueprint is centred on the origin tile grid; the entities keep their tile metadata for later checks.
  blueprintEntities() { return this.entities.map(e => ({ ...e })); }
}

// ASCII picture of a layout, one character per tile, for the READMEs and for design work.
export function glyph(e) {
  const d = e.direction || 0;
  switch (e.name) {
    case 'pipe': return '=';
    case 'pipe-to-ground': return { 0: '^', 4: '>', 8: 'v', 12: '<' }[d];
    case 'oil-refinery': return 'R';
    case 'chemical-plant': return { 'heavy-oil-cracking': 'H', 'light-oil-cracking': 'L', plastic: 'P', 'plastic-bar': 'P', lubricant: 'U', carbon: 'C', 'solid-fuel-from-light-oil': 'S' }[e.recipe] || 'C';
    case 'assembling-machine-3': return 'A';
    case 'substation': return '#';
    case 'fast-transport-belt': return { 0: 'n', 4: 'e', 8: 's', 12: 'w' }[d];
    case 'fast-underground-belt': return e.type === 'input' ? 'u' : 'o';
    case 'fast-inserter': return 'i';
    case 'long-handed-inserter': return 'l';
    case 'display-panel': return 'D';
    default: return '?';
  }
}
export function ascii(entities) {
  const L = { grid: new Map() };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of entities) {
    const s = sizeOf(e.name), tx = Math.round(e.position.x - s / 2), ty = Math.round(e.position.y - s / 2);
    for (let u = 0; u < s; u++) for (let v = 0; v < s; v++) L.grid.set(`${tx + u},${ty + v}`, glyph(e));
    x0 = Math.min(x0, tx); y0 = Math.min(y0, ty); x1 = Math.max(x1, tx + s - 1); y1 = Math.max(y1, ty + s - 1);
  }
  const rows = [];
  for (let y = y0; y <= y1; y++) { let r = ''; for (let x = x0; x <= x1; x++) r += L.grid.get(`${x},${y}`) || '.'; rows.push(r); }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Fluid-network model. It encodes only what the pinned native probe (fluid-slots.json) and the native import check show.
//  - pipe: connects on all four sides.
//  - pipe-to-ground facing d: a normal connection on side d, an underground connection on side d+8 that pairs with the nearest
//    pipe-to-ground on that axis facing back, at most 10 tiles apart. A perpendicular pipe-to-ground between the ends does not join.
//  - machines: the tiles of fluid-slots.json (target tile offsets from the machine centre, per recipe, direction and mirroring).
//    Both tiles of a box a recipe uses with one fluid are one box (the game merges them).
export const MAX_UNDERGROUND = 10;
const slotKey = e => `${e.name}|${e.recipe}`;
const dirKey = e => 'd' + (e.direction || 0) + (e.mirror ? 'M' : '');
export function machineBoxes(e, slots) {
  const table = slots.slots[slotKey(e)];
  if (!table) return [];
  const boxes = table[dirKey(e)];
  if (!boxes) throw new Error(`no slot table for ${slotKey(e)} ${dirKey(e)}`);
  const s = sizeOf(e.name), half = (s - 1) / 2, cx = Math.round(e.position.x - 0.5), cy = Math.round(e.position.y - 0.5);
  return boxes.map((b, index) => ({
    index, fluid: b.fluid, flow: b.flow,
    ends: b.targets.map(([dx, dy]) => {
      // The target tile is outside the machine; the inner tile is the machine tile next to it, on the axis where it lies outside.
      const side = Math.abs(dx) > half ? (dx > 0 ? E : W) : (dy > 0 ? S : N);
      const [vx, vy] = VEC[side];
      return { tile: { x: cx + dx - vx, y: cy + dy - vy }, target: { x: cx + dx, y: cy + dy }, side };
    }),
  }));
}
export function analyzeFluids(entities, slots) {
  const tilesOf = e => { const s = sizeOf(e.name), x0 = Math.round(e.position.x - s / 2), y0 = Math.round(e.position.y - s / 2), out = []; for (let u = 0; u < s; u++) for (let v = 0; v < s; v++) out.push({ x: x0 + u, y: y0 + v }); return out; };
  const key = (x, y) => x + ',' + y, byTile = new Map();
  for (const e of entities) for (const t of tilesOf(e)) byTile.set(key(t.x, t.y), e);
  const ends = [];
  for (const e of entities) {
    const tx = Math.floor(e.position.x), ty = Math.floor(e.position.y), d = e.direction || 0;
    if (e.name === 'pipe') for (const s of [N, E, S, W]) ends.push({ e, node: `${e.entity_number}:p`, tile: { x: tx, y: ty }, side: s, kind: 'normal' });
    else if (e.name === 'pipe-to-ground') {
      ends.push({ e, node: `${e.entity_number}:p`, tile: { x: tx, y: ty }, side: d, kind: 'normal' });
      ends.push({ e, node: `${e.entity_number}:p`, tile: { x: tx, y: ty }, side: opposite(d), kind: 'ug' });
    } else if (MACHINES.includes(e.name)) {
      for (const b of machineBoxes(e, slots)) for (const end of b.ends) ends.push({ e, node: `${e.entity_number}:${b.index}`, tile: end.tile, side: end.side, kind: 'normal', fluid: b.fluid, flow: b.flow, box: b.index });
    }
  }
  const edges = [], problems = [], normalAt = new Map();
  for (const n of ends) if (n.kind === 'normal') { const k = key(n.tile.x, n.tile.y) + ':' + n.side; normalAt.set(k, [...(normalAt.get(k) || []), n]); }
  for (const n of ends) {
    if (n.kind === 'normal') {
      const [vx, vy] = VEC[n.side], t = { x: n.tile.x + vx, y: n.tile.y + vy };
      for (const m of normalAt.get(key(t.x, t.y) + ':' + opposite(n.side)) || []) if (m.e !== n.e && n.node < m.node) edges.push([n.node, m.node, n, m]);
    } else {
      const [vx, vy] = VEC[n.side]; let paired = null;
      for (let k = 1; k <= MAX_UNDERGROUND; k++) {
        const o = byTile.get(key(n.tile.x + vx * k, n.tile.y + vy * k));
        if (!o || o.name !== 'pipe-to-ground') continue;
        const od = o.direction || 0;
        if (od === n.side || od === opposite(n.side)) { if (od === n.side) paired = o; else problems.push(`pipe-to-ground #${n.e.entity_number} meets one facing the same way (#${o.entity_number})`); break; }
      }
      if (!paired) problems.push(`unpaired underground of pipe-to-ground #${n.e.entity_number}`);
      else if (n.e.entity_number < paired.entity_number) edges.push([n.node, `${paired.entity_number}:p`, n, null]);
    }
  }
  const parent = new Map(), find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const add = a => { if (!parent.has(a)) parent.set(a, a); };
  for (const n of ends) add(n.node);
  for (const [a, b] of edges) { add(a); add(b); parent.set(find(a), find(b)); }
  const comps = new Map();
  for (const n of ends) { const r = find(n.node), c = comps.get(r) || { fluids: new Set(), nodes: new Set(), entities: new Set(), boxes: [] }; c.nodes.add(n.node); c.entities.add(n.e.entity_number); if (n.fluid) { c.fluids.add(n.fluid); c.boxes.push({ entity: n.e.entity_number, box: n.box, fluid: n.fluid, flow: n.flow }); } comps.set(r, c); }
  const components = [...comps.values()].map((c, i) => ({ id: i + 1, fluids: [...c.fluids].sort(), entities: [...c.entities].sort((a, b) => a - b), boxes: dedupe(c.boxes) }));
  for (const c of components) if (c.fluids.length > 1) problems.push(`mixed network #${c.id}: ${c.fluids.join(' + ')}`);
  const fluidOf = new Map();
  for (const c of components) for (const id of c.entities) fluidOf.set(id, c.fluids[0] || null);
  const pairs = [...new Set(edges.map(([a, b]) => { const x = Number(a.split(':')[0]), y = Number(b.split(':')[0]); return Math.min(x, y) + '-' + Math.max(x, y); }))].map(k => k.split('-').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { components, problems, fluidOf, ends, edges: pairs };
}
const dedupe = list => { const seen = new Set(); return list.filter(b => { const k = b.entity + ':' + b.box; if (seen.has(k)) return false; seen.add(k); return true; }); };

// Ports of a machine that its recipe does not use (a member's own fluid-slots.json lists them from the native probe): the tile outside
// the machine a pipe would stand on (target), the machine tile behind it (tile) and the side of the machine it is on.
export function unusedPortTiles(e, slots) {
  const table = slots.unusedPorts?.[slotKey(e)];
  if (!table) return [];
  const list = table[dirKey(e)];
  if (!list) throw new Error(`no unused-port table for ${slotKey(e)} ${dirKey(e)}`);
  const half = (sizeOf(e.name) - 1) / 2, cx = Math.round(e.position.x - 0.5), cy = Math.round(e.position.y - 0.5);
  return list.map(([dx, dy]) => { const side = Math.abs(dx) > half ? (dx > 0 ? E : W) : (dy > 0 ? S : N), [vx, vy] = VEC[side]; return { target: { x: cx + dx, y: cy + dy }, tile: { x: cx + dx - vx, y: cy + dy - vy }, side }; });
}
// The two port rules of the brief, on the static model:
//  - every port a recipe uses meets either nothing or an opening of exactly its own fluid, and every fluid box is connected at least once;
//  - no pipe opening (pipe, the open end of a pipe-to-ground, another machine's port) faces a port the recipe does not use.
export function portRules(entities, slots) {
  const fluid = analyzeFluids(entities, slots), key = (x, y) => x + ',' + y;
  const openAt = new Map();   // tile -> the normal openings standing on it
  for (const n of fluid.ends) if (n.kind === 'normal') openAt.set(key(n.tile.x, n.tile.y), [...(openAt.get(key(n.tile.x, n.tile.y)) || []), n]);
  const facing = (target, side) => (openAt.get(key(target.x, target.y)) || []).filter(n => n.side === opposite(side));
  const wrong = [], unconnected = [], faced = [];
  for (const e of entities.filter(v => MACHINES.includes(v.name))) {
    for (const b of machineBoxes(e, slots)) {
      let met = 0;
      for (const end of b.ends) for (const n of facing(end.target, end.side)) {
        const other = n.fluid ?? fluid.fluidOf.get(n.e.entity_number);
        if (other === b.fluid) met++; else wrong.push({ machine: e.entity_number, box: b.fluid, meets: other ?? 'an empty run', at: end.target });
      }
      if (!met) unconnected.push({ machine: e.entity_number, box: b.fluid });
    }
    const mine = unusedPortTiles(e, slots);
    for (const u of mine) {
      for (const n of facing(u.target, u.side)) faced.push({ machine: e.entity_number, at: u.target, by: n.e.entity_number });
      for (const o of entities.filter(v => v !== e && MACHINES.includes(v.name))) for (const w of unusedPortTiles(o, slots)) if (w.tile.x === u.target.x && w.tile.y === u.target.y && w.target.x === u.tile.x && w.target.y === u.tile.y) faced.push({ machine: e.entity_number, at: u.target, by: o.entity_number, unusedToo: true });
    }
  }
  const unused = entities.filter(v => MACHINES.includes(v.name)).map(e => ({ entity: e.entity_number, tiles: unusedPortTiles(e, slots).map(u => u.target) })).filter(u => u.tiles.length);
  return { wrong, unconnected, faced, unused, edges: fluid.edges, fluid };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Static checks shared by both audits.
export function tileBox(e, p) { return box(e, p); }
export function collisions(entities, p) {
  const out = [];
  for (let i = 0; i < entities.length; i++) for (let j = i + 1; j < entities.length; j++) if (intersects(box(entities[i], p), box(entities[j], p))) out.push([entities[i].entity_number, entities[j].entity_number]);
  return out;
}
// The tile an inserter takes from and drops on, and the entity standing there.
export function insertTiles(e, p) {
  const pick = contact(e, p, 'pickup'), drop = contact(e, p, 'drop');
  return { pickup: { x: Math.floor(pick.x), y: Math.floor(pick.y) }, drop: { x: Math.floor(drop.x), y: Math.floor(drop.y) } };
}
export function entityAt(entities, p, tile) {
  const point = { x: tile.x + 0.5, y: tile.y + 0.5 };
  return entities.find(e => inside(point, box(e, p, 'collision_box')));
}
// Power: every electric entity must have a substation whose supply area touches its box; substations wire to each other within reach.
export function powerCoverage(entities, p) {
  const poles = entities.filter(e => e.name === 'substation');
  const reach = p.entities.substation.supply_area_distance;
  const covered = (e, pl) => intersects(box(e, p), { left: pl.position.x - reach, right: pl.position.x + reach, top: pl.position.y - reach, bottom: pl.position.y + reach });
  const electric = entities.filter(e => p.entities[e.name]?.energy_source?.type === 'electric');
  return { poles, electric, unpowered: electric.filter(e => !poles.some(pl => covered(e, pl))).map(e => e.entity_number) };
}

// The research an operator needs: every recipe the blueprint's entities and products need, with prerequisites, in research order.
// Wrapper over the shared closure that also reports the technologies the machines' recipes come from.

// The native protocol constants every full run uses (the scenarios themselves are in each blueprint's scenario.mjs).
export const PROTOCOL = Object.freeze({
  seed: 21025, externalPowerWatts: 10000000,
  surface: 'vulcanus (game.planets.vulcanus.create_surface, ground set to volcanic-ash-flats, all natural entities removed)',
  research: 'exactly manifest.technologyClosure, nothing else; inserter capacity bonus zero',
  feed: 'belts: items put on the entrance belt (generous: both lanes kept full; throttled: a credit of perMinute/3600 per tick, capped at 8, one item per credit on alternating lanes); pipes: fluid put into one outside pipe (generous: kept full; throttled: perMinute/3600 per tick plus the refused carry, capped at one second)',
  draw: 'belt exits: everything on the exit tile removed every four ticks, or a per-minute credit; pipe exits: fluid removed from one outside pipe every tick (all, or perMinute/3600 plus the unmet carry, capped at one second)',
});
