// Tile grid for the six-science generator. Coordinates are integer tiles:
// x grows east, y grows south; a 1x1 entity on tile (x, y) sits at (x+.5, y+.5).
// The router is the shared belt router of the hybrid layout (read-only import).
import assert from 'node:assert/strict';
import {Layout} from '../flight-science-sided/hybrid/layout.mjs';

export const N = 0, E = 4, S = 8, W = 12;
export const STEP = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};
export const opposite = d => (d + 8) % 16;
const key = (x, y) => `${x},${y}`;

export function footprintCells(e) {
  const name = e.name, d = e.direction ?? 0;
  let w = 1, h = 1;
  if (name === 'assembling-machine-2' || name === 'chemical-plant') w = h = 3;
  else if (name === 'substation') w = h = 2;
  else if (name === 'fast-splitter') { if (d === 0 || d === 8) w = 2; else h = 2; }
  else if (name.endsWith('-combinator') && name !== 'constant-combinator') { if (d === 0 || d === 8) h = 2; else w = 2; }
  const left = e.position.x - w / 2, top = e.position.y - h / 2;
  const cells = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    const cx = left + x, cy = top + y;
    assert(Number.isInteger(cx) && Number.isInteger(cy), `grid parity ${name} ${e.position.x},${e.position.y}`);
    cells.push([cx, cy]);
  }
  return cells;
}

export class Grid extends Layout {
  constructor(raw) { super(raw); this.notes = []; }
  place(e) {
    for (const [x, y] of footprintCells(e)) {
      const k = key(x, y);
      assert(!this.grid.has(k), `Collision ${e.name} #${e.entity_number} at ${k} with ${this.grid.get(k)?.name} #${this.grid.get(k)?.entity_number} (${this.grid.get(k)?.tags?.block})`);
      this.grid.set(k, e);
    }
    this.entities.push(e);
  }
  free(x, y) { return !this.grid.has(key(x, y)); }
  addAt(name, position, extra = {}) {
    const e = {entity_number: this.next++, name, position, ...extra};
    this.place(e);
    return e;
  }
  tile(name, x, y, extra = {}) { return this.addAt(name, {x: x + .5, y: y + .5}, extra); }
  belt(x, y, d, extra = {}) { return this.tile('fast-transport-belt', x, y, {direction: d, ...extra}); }
  underground(x, y, d, type, extra = {}) { return this.tile('fast-underground-belt', x, y, {direction: d, type, ...extra}); }
  // (x, y) is the west tile of a north/south splitter or the north tile of an east/west splitter.
  splitter(x, y, d, extra = {}) {
    const position = d === N || d === S ? {x: x + 1, y: y + .5} : {x: x + .5, y: y + 1};
    return this.addAt('fast-splitter', position, {direction: d, ...extra});
  }
  machine(x, y, recipe, extra = {}) {
    const name = recipe === 'battery' ? 'chemical-plant' : 'assembling-machine-2';
    return this.tile(name, x, y, {recipe, ...extra});
  }
  arm(name, x, y, pickupDirection, extra = {}) {
    const stack = name === 'bulk-inserter' ? 2 : 1;
    return this.tile(name, x, y, {direction: pickupDirection, override_stack_size: stack, ...extra});
  }
  pipe(x, y, fluid, extra = {}) { return this.tile('pipe', x, y, {...extra, tags: {...extra.tags, six_fluid: fluid}}); }
  wire(a, b, color = 1) {
    const ida = typeof a === 'number' ? a : a.entity_number, idb = typeof b === 'number' ? b : b.entity_number;
    const ea = this.entities.find(e => e.entity_number === ida), eb = this.entities.find(e => e.entity_number === idb);
    const d = Math.hypot(ea.position.x - eb.position.x, ea.position.y - eb.position.y);
    assert(d <= 8.01, `wire too long ${d.toFixed(2)} between ${ida} and ${idb}`);
    this.wires.push([ida, color, idb, color]);
  }
  render(bounds) {
    const glyph = e => {
      if (!e) return ' ';
      const n = e.name, d = e.direction ?? 0;
      if (n === 'fast-transport-belt') return {0: '^', 4: '>', 8: 'v', 12: '<'}[d];
      if (n === 'fast-underground-belt') return e.type === 'input' ? 'U' : 'u';
      if (n === 'fast-splitter') return 'S';
      if (n === 'fast-inserter') return 'i';
      if (n === 'long-handed-inserter') return 'l';
      if (n === 'bulk-inserter') return 'b';
      if (n === 'assembling-machine-2') return 'M';
      if (n === 'chemical-plant') return 'C';
      if (n === 'pipe') return '=';
      if (n === 'pipe-to-ground') return 'p';
      if (n === 'substation') return '#';
      if (n === 'medium-electric-pole') return '+';
      if (n === 'passive-provider-chest') return 'P';
      if (n === 'display-panel') return 'D';
      return '?';
    };
    let xs = [], ys = [];
    for (const k of this.grid.keys()) { const [x, y] = k.split(',').map(Number); xs.push(x); ys.push(y); }
    const b = bounds || {left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys)};
    const lines = [];
    for (let y = b.top; y <= b.bottom; y++) {
      let line = String(y).padStart(4) + ' ';
      for (let x = b.left; x <= b.right; x++) {
        const e = this.grid.get(key(x, y));
        let g = glyph(e);
        if (e && (e.name === 'assembling-machine-2' || e.name === 'chemical-plant')) {
          const cx = Math.floor(e.position.x), cy = Math.floor(e.position.y);
          if (x === cx && y === cy) g = (e.tags?.glyph || e.recipe[0]).toUpperCase();
          else g = '.';
        }
        line += g;
      }
      lines.push(line);
    }
    return lines.join('\n');
  }
}

export const filterOf = items => ({use_filters: true, filters: items.map((name, i) => ({index: i + 1, name, quality: 'normal', comparator: '='}))});
export const below = (item, n) => ({circuit_enabled: true, circuit_condition: {first_signal: {type: 'item', name: item, quality: 'normal'}, comparator: '<', constant: n}});
export const above = (item, n) => ({circuit_enabled: true, circuit_condition: {first_signal: {type: 'item', name: item, quality: 'normal'}, comparator: '>', constant: n}});
export const holdReader = {circuit_read_hand_contents: true, circuit_contents_read_mode: 1};
