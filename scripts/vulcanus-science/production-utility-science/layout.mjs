// Layout builder of the Vulcanus science blueprint: collision-checked entities on a tile grid, belt and pipe routers that dive
// under whatever is in the way, and an ASCII picture. Coordinates are tiles (x east, y south); add() takes the top-left tile.
// Nothing here knows about the game beyond entity sizes and underground reach, both taken from the pinned prototypes.
import assert from 'node:assert/strict';
import { N, E, S, W, VEC, opposite } from './lib.mjs';

export const SQUARE = { foundry: 5, 'assembling-machine-3': 3, 'chemical-plant': 3, 'electric-furnace': 3, substation: 2, 'storage-tank': 3 };
// Width and height in tiles for an entity name and direction.
export function sizeOf(name, direction = 0) {
  if (SQUARE[name]) return [SQUARE[name], SQUARE[name]];
  if (/splitter$/.test(name)) return direction % 8 === 0 ? [2, 1] : [1, 2];
  if (/^(decider|arithmetic|selector)-combinator$/.test(name) || name === 'pump') return direction % 8 === 0 ? [1, 2] : [2, 1];
  return [1, 1];
}
export const dirOf = (a, b) => (b[0] > a[0] ? E : b[0] < a[0] ? W : b[1] > a[1] ? S : N);
export const BELT_KIND = { fast: ['fast-transport-belt', 'fast-underground-belt', 'fast-splitter'], express: ['express-transport-belt', 'express-underground-belt', 'express-splitter'] };

export class Layout {
  constructor(p) { this.p = p; this.entities = []; this.grid = new Map(); this.wires = []; }
  key(x, y) { return x + ',' + y; }
  at(x, y) { return this.grid.get(this.key(x, y)); }
  free(x, y) { return !this.grid.has(this.key(x, y)); }
  add(name, x, y, extra = {}, meta = {}) {
    const [w, h] = sizeOf(name, extra.direction || 0);
    const e = { entity_number: this.entities.length + 1, name, position: { x: x + w / 2, y: y + h / 2 }, ...extra };
    if (!e.direction) delete e.direction;
    Object.defineProperty(e, 'tile', { value: { x, y, w, h }, enumerable: false });
    Object.defineProperty(e, 'meta', { value: meta, enumerable: false, writable: true });
    for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) {
      const k = this.key(x + u, y + v), o = this.grid.get(k);
      if (o) throw new Error(`${name} at ${x},${y} collides with ${o.name} #${o.entity_number} (${o.meta.note || o.recipe || ''}) at ${k}`);
      this.grid.set(k, e);
    }
    this.entities.push(e);
    return e;
  }
  remove(e) {
    for (let u = 0; u < e.tile.w; u++) for (let v = 0; v < e.tile.h; v++) this.grid.delete(this.key(e.tile.x + u, e.tile.y + v));
    this.entities.splice(this.entities.indexOf(e), 1);
    this.entities.forEach((x, i) => { x.entity_number = i + 1; });
  }
  // ---- machines and arms
  machine(name, x, y, recipe, direction = N, meta = {}, extra = {}) { return this.add(name, x, y, { direction, ...(recipe ? { recipe } : {}), ...extra }, { role: recipe, ...meta }); }
  // An arm's blueprint direction is the side it picks up from; it drops on the opposite side. Hand sizes are pinned.
  arm(kind, x, y, from, meta = {}, extra = {}) {
    const name = { fast: 'fast-inserter', bulk: 'bulk-inserter', long: 'long-handed-inserter' }[kind];
    return this.add(name, x, y, { direction: from, override_stack_size: kind === 'bulk' ? 2 : 1, ...extra }, meta);
  }
  panel(x, y, text, name, type = 'item') { return this.add('display-panel', x, y, { text, always_show: true, icon: type === 'item' ? { name } : { type, name } }, { note: text }); }
  // ---- belts. A path is a list of corner points; belts are laid from the first point to the last (inclusive), each pointing
  // at the next tile; the last tile keeps the direction of its segment unless `end` says otherwise. Where a tile is taken the
  // belt dives: the tile before becomes an underground entrance and the first free tile after becomes the exit.
  beltPath(kind, pts, { end, note, into } = {}) {
    const [beltName, ugName] = BELT_KIND[kind], max = this.p.entities[ugName].max_distance;
    const tiles = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], d = dirOf(a, b), v = VEC[d];
      assert(a[0] === b[0] || a[1] === b[1], 'belt path segments are axis-aligned: ' + JSON.stringify([a, b]));
      for (let x = a[0], y = a[1]; x !== b[0] || y !== b[1]; x += v[0], y += v[1]) tiles.push({ x, y, d });
      if (i + 2 === pts.length) tiles.push({ x: b[0], y: b[1], d: end ?? d });
    }
    if (pts.length === 1) tiles.push({ x: pts[0][0], y: pts[0][1], d: end ?? E });
    if (into) { const last = tiles.pop(); assert(!this.free(last.x, last.y), `belt ${note || ''} runs into nothing at ${last.x},${last.y}`); }
    const made = [], pathId = (this.paths = (this.paths || 0) + 1);
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (this.free(t.x, t.y)) { made.push(this.add(beltName, t.x, t.y, { direction: t.d }, { note, kind })); continue; }
      // dive: the previous tile becomes the entrance
      const prev = made.at(-1), pt = tiles[i - 1];
      assert(prev && pt && pt.d === t.d && prev.name === beltName && prev.tile.x === pt.x && prev.tile.y === pt.y, `belt ${note || ''} cannot dive at ${t.x},${t.y}: no straight belt tile before it (taken by ${this.at(t.x, t.y).name})`);
      // an underground entrance must be fed from behind: a belt entering it from the side would lose a lane
      const behind = this.at(pt.x - VEC[t.d][0], pt.y - VEC[t.d][1]);
      assert(i >= 2 ? tiles[i - 2].d === t.d : behind && /belt/.test(behind.name) && (behind.direction || 0) === t.d, `belt ${note || ''} would dive at a corner at ${pt.x},${pt.y}`);
      this.remove(prev); made.pop();
      made.push(this.add(ugName, pt.x, pt.y, { direction: pt.d, type: 'input' }, { note, kind }));
      let j = i;
      // stay under while tiles are taken; a single free tile with a taken one right behind it is passed under too
      const taken = k => k < tiles.length && !this.free(tiles[k].x, tiles[k].y);
      while (j < tiles.length && (taken(j) || (taken(j + 1) && tiles[j + 1].d === t.d && j + 2 - (i - 1) <= max))) {
        const o = this.at(tiles[j].x, tiles[j].y);
        assert(tiles[j].d === t.d, `belt ${note || ''} meets a corner while underground at ${tiles[j].x},${tiles[j].y}`);
        assert(!(o && o.name === ugName && (o.direction || 0) % 8 === t.d % 8), `belt ${note || ''} would pass under an underground of its own kind on its own axis at ${tiles[j].x},${tiles[j].y}`);
        j++;
      }
      assert(j < tiles.length && tiles[j].d === t.d, `belt ${note || ''} has no exit after ${t.x},${t.y}`);
      assert(j - (i - 1) <= max, `belt ${note || ''} underground too long (${j - (i - 1)} > ${max}) from ${pt.x},${pt.y}`);
      made.push(this.add(ugName, tiles[j].x, tiles[j].y, { direction: t.d, type: 'output' }, { note, kind }));
      i = j;
    }
    made.forEach((e, i) => { e.meta.path = pathId; e.meta.first = i === 0; e.meta.into = !!into && i === made.length - 1; });
    return made;
  }
  // Belts that run into a belt of another path without being meant to: every junction must be the last tile of a path laid
  // with `into`, or feed the first tile of the path it continues.
  strayJunctions() {
    const out = [];
    for (const e of this.entities) {
      if (!/belt$/.test(e.name) || (e.name.includes('underground') && e.type === 'input')) continue;
      const v = VEC[e.direction || 0], f = this.at(e.tile.x + v[0], e.tile.y + v[1]);
      if (!f || !/belt$/.test(f.name) || f.meta.path === e.meta.path) continue;
      if ((f.direction || 0) === opposite(e.direction || 0)) { out.push([e.tile.x, e.tile.y, 'head-on']); continue; }
      if (!e.meta.into && !f.meta.first) out.push([e.tile.x, e.tile.y, e.meta.note, '->', f.meta.note]);
    }
    return out;
  }
  splitter(kind, x, y, d, extra = {}, meta = {}) { return this.add(BELT_KIND[kind][2], x, y, { direction: d, ...extra }, { kind, ...meta }); }
  // ---- pipes. Same idea: plain pipes along the path; where a tile is taken, or where a plain pipe would touch a pipe of
  // another fluid, the line goes underground (pipe-to-ground pair, at most `max` tiles apart).
  pipePath(fluid, pts, { note, forceUnder = () => false } = {}) {
    const max = this.p.entities['pipe-to-ground'].fluid_boxes[0].pipe_connections.find(c => c.connection_type === 'underground').max_underground_distance;
    const tiles = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], d = dirOf(a, b), v = VEC[d];
      assert(a[0] === b[0] || a[1] === b[1], 'pipe path segments are axis-aligned: ' + JSON.stringify([a, b]));
      for (let x = a[0], y = a[1]; x !== b[0] || y !== b[1]; x += v[0], y += v[1]) tiles.push({ x, y, d });
      if (i + 2 === pts.length) tiles.push({ x: b[0], y: b[1], d });
    }
    if (pts.length === 1) tiles.push({ x: pts[0][0], y: pts[0][1], d: E });
    // a plain pipe opens on all four sides: it may not stand beside a pipe or a pipe-to-ground mouth of another fluid
    const foreignBeside = t => [N, E, S, W].some(s => { const o = this.at(t.x + VEC[s][0], t.y + VEC[s][1]); if (!o || o.meta.fluid === undefined || o.meta.fluid === fluid) return false; if (o.name === 'pipe') return true; if (o.name === 'pipe-to-ground') return (o.direction || 0) === opposite(s); return false; });
    const own = t => { const o = this.at(t.x, t.y); return o && o.meta.fluid === fluid && o.name === 'pipe' ? o : null; };
    const taken = t => !this.free(t.x, t.y) && !own(t);
    const plainOk = t => this.free(t.x, t.y) && !foreignBeside(t) && !forceUnder(t.x, t.y);
    const made = [], mine = new Set();
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (own(t)) { made.push(own(t)); continue; }          // joins a pipe of its own fluid that is already there
      if (plainOk(t)) { const e = this.add('pipe', t.x, t.y, {}, { fluid, note }); mine.add(e); made.push(e); continue; }
      // dive. A free tile takes the mouth itself (its sides are closed); a taken tile needs the tile before it.
      let from = i;
      if (taken(t)) {
        const prev = made.at(-1), pt = tiles[i - 1];
        assert(prev && pt && pt.d === t.d && prev.name === 'pipe' && mine.has(prev) && prev.tile.x === pt.x && prev.tile.y === pt.y, `pipe ${fluid} cannot dive at ${t.x},${t.y}: no straight pipe of this path before it`);
        this.remove(prev); made.pop(); from = i - 1;
      }
      const ft = tiles[from];
      made.push(this.add('pipe-to-ground', ft.x, ft.y, { direction: opposite(ft.d) }, { fluid, note }));
      // surface on the first free tile that is not followed by a taken one
      let j = from + 1;
      while (j < tiles.length && (taken(tiles[j]) || own(tiles[j]) || (j + 1 < tiles.length && tiles[j + 1].d === t.d && taken(tiles[j + 1]) && j + 2 - from <= max))) {
        const o = this.at(tiles[j].x, tiles[j].y);
        assert(tiles[j].d === ft.d, `pipe ${fluid} meets a corner while underground at ${tiles[j].x},${tiles[j].y}`);
        assert(!(o && o.name === 'pipe-to-ground' && (o.direction || 0) % 8 === ft.d % 8), `pipe ${fluid} would pass under a pipe-to-ground on its own axis at ${tiles[j].x},${tiles[j].y}`);
        j++;
      }
      assert(j < tiles.length && tiles[j].d === ft.d, `pipe ${fluid} has no exit after ${ft.x},${ft.y}`);
      assert(j - from <= max, `pipe ${fluid} underground too long (${j - from} > ${max}) from ${ft.x},${ft.y}`);
      made.push(this.add('pipe-to-ground', tiles[j].x, tiles[j].y, { direction: ft.d }, { fluid, note }));
      i = j;
    }
    return made;
  }
  ptg(fluid, x, y, mouth, note) { return this.add('pipe-to-ground', x, y, { direction: mouth }, { fluid, note }); }
  pipe(fluid, x, y, note) { return this.add('pipe', x, y, {}, { fluid, note }); }
  // A view of this layout turned a quarter clockwise: local (x, y) stands at (ox - y, oy + x), local east is south.
  // Only what the turned band uses: machines, arms, single pipes, belt and pipe paths.
  quarter(ox, oy) {
    const L = this, pt = ([x, y]) => [ox - y, oy + x], dir = d => (d + 4) % 16;
    const corner = (name, x, y, d) => { const [w, h] = sizeOf(name, d); const [gx] = pt([x, y + h - 1]); const [, gy] = pt([x, y]); return [gx, gy]; };
    return {
      machine: (name, x, y, recipe, d, meta) => L.machine(name, ...corner(name, x, y, d), recipe, dir(d), meta),
      arm: (kind, x, y, from, meta, extra) => L.arm(kind, ...pt([x, y]), dir(from), meta, extra),
      pipe: (fluid, x, y, note) => L.pipe(fluid, ...pt([x, y]), note),
      beltPath: (kind, pts, o = {}) => L.beltPath(kind, pts.map(pt), { ...o, ...(o.end !== undefined ? { end: dir(o.end) } : {}) }),
      pipePath: (fluid, pts, o) => L.pipePath(fluid, pts.map(pt), o),
      pt,
    };
  }
  bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of this.entities) { x0 = Math.min(x0, e.tile.x); y0 = Math.min(y0, e.tile.y); x1 = Math.max(x1, e.tile.x + e.tile.w - 1); y1 = Math.max(y1, e.tile.y + e.tile.h - 1); }
    return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }
  // Move everything so the envelope's top-left tile is (0, 0).
  normalize() {
    const b = this.bounds();
    for (const e of this.entities) { e.position.x -= b.x0; e.position.y -= b.y0; e.tile.x -= b.x0; e.tile.y -= b.y0; }
    const grid = new Map();
    for (const e of this.entities) for (let u = 0; u < e.tile.w; u++) for (let v = 0; v < e.tile.h; v++) grid.set(this.key(e.tile.x + u, e.tile.y + v), e);
    this.grid = grid;
    return { dx: -b.x0, dy: -b.y0 };
  }
}

// ---- ASCII picture: one character per tile.
const RECIPE_GLYPH = {
  'molten-iron-from-lava': 'I', 'molten-copper-from-lava': 'C', 'casting-iron': 'p', 'casting-copper': 'q', 'casting-steel': 's', 'casting-iron-gear-wheel': 'g', 'casting-iron-stick': 't', 'casting-pipe': 'j', 'casting-copper-cable': 'c', 'casting-low-density-structure': 'L',
  'electronic-circuit': 'G', 'advanced-circuit': 'R', 'processing-unit': 'U', 'productivity-module': 'M', 'electric-furnace': 'F', rail: 'r', 'production-science-pack': 'P', 'utility-science-pack': 'Y', 'flying-robot-frame': 'Z', 'engine-unit': 'E', 'electric-engine-unit': 'X', battery: 'B',
};
export function glyph(e) {
  const d = e.direction || 0, arrow = { 0: '^', 4: '>', 8: 'v', 12: '<' }[d];
  if (e.recipe) return RECIPE_GLYPH[e.recipe] || '?';
  switch (e.name) {
    case 'electric-furnace': return 'K';
    case 'pipe': return '=';
    case 'pipe-to-ground': return { 0: 'n', 4: 'e', 8: 'u', 12: 'w' }[d];
    case 'substation': return '#';
    case 'fast-transport-belt': case 'express-transport-belt': return arrow;
    case 'fast-underground-belt': case 'express-underground-belt': return e.type === 'input' ? '(' : ')';
    case 'fast-splitter': case 'express-splitter': return '%';
    case 'fast-inserter': return 'i';
    case 'bulk-inserter': return 'b';
    case 'long-handed-inserter': return 'l';
    case 'display-panel': return '!';
    case 'passive-provider-chest': return '$';
    case 'storage-tank': return 'T';
    case 'pump': return '&';
    case 'constant-combinator': case 'decider-combinator': case 'arithmetic-combinator': return 'd';
    default: return '?';
  }
}
export const LEGEND = '`I` `C` lava foundries (molten iron, molten copper) · `p` iron plate · `q` copper plate · `s` steel · `t` iron stick · `g` gear · `j` pipe · `c` copper cable · `L` low density structure (foundries, 5 × 5) · `G` electronic circuit · `R` advanced circuit · `U` processing unit · `M` productivity module · `F` electric furnace (the item) · `r` rail · `P` production science · `Y` utility science · `Z` flying robot frame · `E` engine · `X` electric engine (assembling machines 3, 3 × 3) · `B` battery (chemical plant) · `K` brick furnace · `#` substation · `$` provider chest · `!` panel · `d` combinator · `^ > v <` belt · `( )` underground belt in and out · `%` splitter · `=` pipe · `n e u w` pipe-to-ground (the letter is the side its mouth faces: north, east, south = u, west) · `i` fast, `b` bulk, `l` long-handed inserter';
export function ascii(entities) {
  const grid = new Map(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of entities) {
    const [w, h] = sizeOf(e.name, e.direction || 0), tx = Math.round(e.position.x - w / 2), ty = Math.round(e.position.y - h / 2);
    for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) grid.set(`${tx + u},${ty + v}`, glyph(e));
    x0 = Math.min(x0, tx); y0 = Math.min(y0, ty); x1 = Math.max(x1, tx + w - 1); y1 = Math.max(y1, ty + h - 1);
  }
  const rows = [];
  for (let y = y0; y <= y1; y++) { let r = ''; for (let x = x0; x <= x1; x++) r += grid.get(`${x},${y}`) || '.'; rows.push(r); }
  return { rows, x0, y0 };
}
