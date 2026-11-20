// A closed clockwise ring of fast belts with machine rows around it.
// Ring corner (x0, y0) is the north-west tile; the east column is x0 + w,
// the bottom belt is y0 + h. Every ring tile reads its own contents (hold)
// and all ring tiles share one red network.
import assert from 'node:assert/strict';
import {N, E, S, W, filterOf, below, above, holdReader} from './grid.mjs';

export class Ring {
  constructor(L, {id, x0, y0, w, h, limits, counterClockwise = false}) {
    Object.assign(this, {L, id, x0, y0, w, h, limits: {...limits}, counterClockwise});
    this.tiles = [];
    this.controlled = [];
    this.byKey = new Map();
    const push = (x, y, d) => {
      const e = L.belt(x, y, d, {control_behavior: {...holdReader}, tags: {block: id, ring: id}});
      this.tiles.push(e);
      this.byKey.set(x + ',' + y, e);
    };
    if (!counterClockwise) {
      for (let x = x0; x < x0 + w; x++) push(x, y0, E);
      for (let y = y0; y < y0 + h; y++) push(x0 + w, y, S);
      for (let x = x0 + w; x > x0; x--) push(x, y0 + h, W);
      for (let y = y0 + h; y > y0; y--) push(x0, y, N);
    } else {
      for (let y = y0; y < y0 + h; y++) push(x0, y, S);
      for (let x = x0; x < x0 + w; x++) push(x, y0 + h, E);
      for (let y = y0 + h; y > y0; y--) push(x0 + w, y, N);
      for (let x = x0 + w; x > x0; x--) push(x, y0, W);
    }
    for (let i = 0; i < this.tiles.length; i++) L.wire(this.tiles[i], this.tiles[(i + 1) % this.tiles.length]);
  }
  at(x, y) { const e = this.byKey.get(x + ',' + y); assert(e, `${this.id}: no ring tile at ${x},${y}`); return e; }
  // An arm that puts `item` on this ring: enabled while ring count < limit.
  limit(arm, item, tile) {
    assert(this.limits[item] > 0, `${this.id}: no limit for ${item}`);
    arm.control_behavior = below(item, this.limits[item]);
    this.L.wire(arm, tile);
    this.controlled.push(arm.entity_number);
  }
  // An arm feeding an upstream consumer: enabled while ring count > reserve.
  reserve(arm, item, n, tile) {
    arm.control_behavior = above(item, n);
    this.L.wire(arm, tile);
    this.controlled.push(arm.entity_number);
  }
  record() {
    const capacity = this.tiles.length * 8, maximumStock = Object.values(this.limits).reduce((a, b) => a + b, 0);
    assert(maximumStock <= .6 * capacity, `${this.id}: limit sum ${maximumStock} above 60% of ${capacity}`);
    return {name: this.id, reader: this.tiles[0].entity_number, readerMode: 'per-tile-hold', loop: this.tiles.map(e => e.entity_number),
      controlled: [...this.controlled], limits: {...this.limits}, capacity, maximumStock, lapSeconds: +(this.tiles.length / 3.75).toFixed(2)};
  }
}

// Machine slots. Row 'top': machine centre y0-3, ring arms y0-1, rear arms y0-5, rear belt y0-6.
// Row 'inside' (needs h >= 6): centre y0+3, arms y0+1 (top belt) and y0+5 (bottom belt).
// Row 'bottom': centre y0+h+3, ring arms y0+h+1, rear arms y0+h+5, rear belt y0+h+6.
// Slot i occupies x0+1+3i .. x0+3+3i.
export function slotGeometry(ring, row, i) {
  const {x0, y0, h} = ring, left = x0 + 1 + 3 * i, cx = left + 1;
  if (row === 'top') return {cx, cy: y0 - 3, left, ring: {y: y0 - 1, belt: y0, toRing: N, fromRing: S}, rear: {y: y0 - 5, belt: y0 - 6, fromRear: N, toRear: S}};
  if (row === 'inside') return {cx, cy: y0 + 3, left, ring: {y: y0 + 1, belt: y0, toRing: S, fromRing: N}, ring2: {y: y0 + 5, belt: y0 + h, toRing: N, fromRing: S}};
  if (row === 'bottom') return {cx, cy: y0 + h + 3, left, ring: {y: y0 + h + 1, belt: y0 + h, toRing: S, fromRing: N}, rear: {y: y0 + h + 5, belt: y0 + h + 6, fromRear: S, toRear: N}};
  throw Error('row ' + row);
}

const solids = (raw, recipe) => raw.recipe[recipe].ingredients.filter(i => i.type !== 'fluid').map(i => i.name);

// Place a machine with its arms. arms: [{side:'ring'|'ring2'|'rear', k:0..2, role:'in'|'out', items, name, reserve:[item,n]}]
// Defaults: ring input at k=0 for every ring-supplied ingredient, ring output at k=2.
export function machine(L, raw, ring, {row, slot, recipe, arms, direction, glyph}) {
  const g = slotGeometry(ring, row, slot);
  const m = L.machine(g.cx, g.cy, recipe, {...(direction !== undefined ? {direction} : {}), tags: {block: ring.id, glyph}});
  const product = raw.recipe[recipe].results[0].name;
  arms ??= [{side: 'ring', k: 0, role: 'in'}, {side: 'ring', k: 2, role: 'out'}];
  const rearItems = new Set(arms.filter(a => a.side === 'rear' && a.role === 'in').flatMap(a => a.items || []));
  const made = [];
  for (const a of arms) {
    const side = g[a.side];
    assert(side, `${ring.id} ${recipe}: no ${a.side} side on ${row}`);
    const x = g.left + a.k, y = side.y;
    const name = a.name || 'fast-inserter';
    if (a.side === 'rear') {
      const items = a.role === 'in' ? a.items : [product];
      const arm = L.arm(name, x, y, a.role === 'in' ? side.fromRear : side.toRear, {...filterOf(items), tags: {block: ring.id, role: a.role === 'in' ? 'rear-feed' : 'rear-output'}});
      made.push(arm);
      continue;
    }
    if (a.role === 'in') {
      const items = a.items || solids(raw, recipe).filter(i => !rearItems.has(i));
      const arm = L.arm(name, x, y, side.fromRing, {...filterOf(items), tags: {block: ring.id, role: 'ring-feed'}});
      if (a.reserve) ring.reserve(arm, a.reserve[0], a.reserve[1], ring.at(x, side.belt));
      made.push(arm);
    } else {
      const arm = L.arm(name, x, y, side.toRing, {...filterOf([product]), tags: {block: ring.id, role: 'machine-output', stock_item: product}});
      ring.limit(arm, product, ring.at(x, side.belt));
      made.push(arm);
    }
  }
  return {machine: m, arms: made, geometry: g};
}

// West admission: arm at (x0-1, y) picks from a feed belt at (x0-2, y) and drops on the ring's west column.
// n arms stack downwards on a short vertical feed belt; returns the feed entry tile.
export function admitWest(L, ring, item, y, n = 1, name = 'fast-inserter') {
  const {x0} = ring;
  const feed = [];
  for (let j = 0; j < n; j++) {
    const b = L.belt(x0 - 2, y + j, n === 1 ? E : j === n - 1 ? E : S, {tags: {block: ring.id, feed: item}});
    feed.push(b);
    const arm = L.arm(name, x0 - 1, y + j, W, {...filterOf([item]), tags: {block: ring.id, role: 'controlled-feed', stock_item: item}});
    ring.limit(arm, item, ring.at(x0, y + j));
  }
  return {item, entry: feed[0], approach: E, block: ring.id};
}

// Admission from above into the top belt through an empty top-row slot (a notch).
export function admitTop(L, ring, item, x, name = 'fast-inserter') {
  const {y0} = ring;
  const b = L.belt(x, y0 - 2, S, {tags: {block: ring.id, feed: item}});
  const arm = L.arm(name, x, y0 - 1, N, {...filterOf([item]), tags: {block: ring.id, role: 'controlled-feed', stock_item: item}});
  ring.limit(arm, item, ring.at(x, y0));
  return {item, entry: b, approach: S, block: ring.id};
}

// Export from the east column onto an east-facing belt start at (x0+w+2, y).
export function exportEast(L, ring, item, y) {
  const {x0, w} = ring;
  L.arm('fast-inserter', x0 + w + 1, y, W, {...filterOf([item]), tags: {block: ring.id, role: 'export', stock_item: item}});
  const start = L.belt(x0 + w + 2, y, E, {tags: {block: ring.id, export: item}});
  return {item, start, block: ring.id};
}

// Transfer between two rings whose facing columns are two tiles apart.
// The arm is enabled while the receiving ring holds fewer than its limit.
export function transfer(L, from, to, item, y, name = 'fast-inserter') {
  const eastward = from.x0 + from.w + 2 === to.x0, westward = to.x0 + to.w + 2 === from.x0;
  assert(eastward || westward, `transfer ${from.id}->${to.id} not adjacent`);
  const x = eastward ? from.x0 + from.w + 1 : to.x0 + to.w + 1;
  const arm = L.arm(name, x, y, eastward ? W : E, {...filterOf([item]), tags: {block: to.id, role: 'controlled-feed', stock_item: item, transfer: from.id}});
  to.limit(arm, item, to.at(eastward ? to.x0 : to.x0 + to.w, y));
  return arm;
}
