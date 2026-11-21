// One-dimensional layout compaction for the routed four-pack factory.
//
// Every interaction of the routed layout is kept exactly: belt hand-offs, side
// loads, splitter cells, inserter pickups and drops, underground pairs, pipe
// joints, pole coverage and wire reach. The only things that change are the
// lengths of plain pass-through belt runs and of underground spans, and the
// empty space between parts that do not touch. `topology` describes a layout
// by those interactions; `compactLayout` refuses a result whose description
// differs from the routed one. Native qualification still belongs to the caller.
import assert from 'node:assert/strict';

const STEP = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};
const TRANSPOSE = {0: 12, 12: 0, 4: 8, 8: 4};
const THREE = new Set(['assembling-machine-2', 'chemical-plant', 'lab']);
const BELT_REACH = 7, PIPE_REACH = 10, CIRCUIT_REACH = 9;
const POLES = {'medium-electric-pole': {supply: 3.5, wire: 9}, 'big-electric-pole': {supply: 2, wire: 32}};
const SLACK = 0.05;
const key = (x, y) => x + ',' + y;

function kindOf(e) {
  const n = e.name;
  if (n === 'fast-transport-belt') return 'belt';
  if (n === 'fast-underground-belt') return 'ug';
  if (n === 'fast-splitter') return 'splitter';
  if (/inserter$/.test(n)) return 'arm';
  if (n === 'pipe') return 'pipe';
  if (n === 'pipe-to-ground') return 'ptg';
  if (THREE.has(n)) return 'machine';
  if (POLES[n]) return 'pole';
  if (/chest$/.test(n)) return 'chest';
  if (n === 'display-panel') return 'panel';
  throw new Error('compact: unsupported entity ' + n);
}
function dims(e) {
  if (THREE.has(e.name)) return [3, 3];
  if (e.name === 'big-electric-pole') return [2, 2];
  if (e.name === 'fast-splitter') return [0, 8].includes(e.direction ?? 0) ? [2, 1] : [1, 2];
  return [1, 1];
}
const fluidRecipes = new Set(['battery', 'processing-unit', 'electric-engine-unit', 'sulfuric-acid', 'plastic-bar', 'lubricant']);
const wetMachine = e => e.name === 'chemical-plant' || fluidRecipes.has(e.recipe);
const powered = v => v.kind === 'machine' || v.kind === 'arm';

// A view is the layout seen along one axis: `l` is the coordinate being
// compacted, `t` the other one. The y view is the transposed layout.
function makeView(entities, axis) {
  const nodes = [], grid = new Map();
  for (const e of entities) {
    for (const f of ['pickup_position', 'drop_position']) assert(!e[f], 'compact: custom inserter vectors are not supported');
    const [w0, h0] = dims(e), L = e.position.x - w0 / 2, T = e.position.y - h0 / 2, d0 = e.direction ?? 0;
    assert(Number.isInteger(L) && Number.isInteger(T), 'compact: off-grid entity ' + e.entity_number);
    assert(STEP[d0], 'compact: diagonal direction ' + e.entity_number);
    const v = axis === 'x' ? {l: L, t: T, w: w0, h: h0, d: d0} : {l: T, t: L, w: h0, h: w0, d: TRANSPOSE[d0]};
    Object.assign(v, {e, id: e.entity_number, kind: kindOf(e), index: nodes.length});
    nodes.push(v);
    for (let x = v.l; x < v.l + v.w; x++) for (let y = v.t; y < v.t + v.h; y++) {
      assert(!grid.has(key(x, y)), 'compact: overlap at ' + key(x, y) + ' (' + axis + ' view)');
      grid.set(key(x, y), v);
    }
  }
  return {nodes, grid, byId: new Map(nodes.map(v => [v.id, v]))};
}
// Tiles an entity acts on: where a belt delivers, where an arm picks or drops,
// where a pipe opens.
function emissions(v) {
  const [dx, dy] = STEP[v.d];
  if (v.kind === 'belt' || v.kind === 'ug' && v.e.type === 'output') return [{x: v.l + dx, y: v.t + dy, k: 'flow', cell: 0}];
  if (v.kind === 'splitter') {
    const out = [];
    for (let x = v.l; x < v.l + v.w; x++) for (let y = v.t; y < v.t + v.h; y++) out.push({x: x + dx, y: y + dy, k: 'flow', cell: out.length});
    return out;
  }
  if (v.kind === 'arm') {
    const r = v.e.name === 'long-handed-inserter' ? 2 : 1;
    return [{x: v.l - r * dx, y: v.t - r * dy, k: 'arm', cell: 0}, {x: v.l + r * dx, y: v.t + r * dy, k: 'arm', cell: 1}];
  }
  if (v.kind === 'pipe') return Object.values(STEP).map(([sx, sy], cell) => ({x: v.l + sx, y: v.t + sy, k: 'fluid', cell}));
  if (v.kind === 'ptg') return [{x: v.l + dx, y: v.t + dy, k: 'fluid', cell: 0}];
  return [];
}
// Reciprocal nearest partner along a line, as the game pairs tunnels.
function partners(nodes, kind, reach) {
  const ends = nodes.filter(v => v.kind === kind), pairs = new Map();
  for (const a of ends) {
    // A belt tunnel runs along its direction from input to output; a pipe
    // tunnel runs away from its surface opening.
    const forward = kind === 'ug' ? (a.e.type === 'input' ? 1 : -1) : -1, [dx, dy] = STEP[a.d];
    let best = null, bestSpan = Infinity;
    for (const b of ends) {
      if (b === a) continue;
      if (kind === 'ug' ? b.d !== a.d || b.e.type === a.e.type : b.d !== (a.d + 8) % 16) continue;
      const ox = b.l - a.l, oy = b.t - a.t;
      if (ox * dy !== oy * dx) continue;
      const span = (ox * dx + oy * dy) * forward;
      if (span >= 1 && span <= reach && span < bestSpan) { best = b; bestSpan = span; }
    }
    pairs.set(a.id, best ? best.id : null);
  }
  for (const [a, b] of pairs) assert(b !== null && pairs.get(b) === a, 'compact: unpaired or ambiguous ' + kind + ' ' + a);
  return pairs;
}
// Tunnel ends that face one another along one line within reach: the game can
// re-pair such ends while a blueprint is revived, so their set must not grow.
function opposed(nodes) {
  const ends = nodes.filter(v => v.kind === 'ug'), out = [];
  for (const a of ends) for (const b of ends) {
    if (a.id >= b.id || b.d !== (a.d + 8) % 16) continue;
    const [dx, dy] = STEP[a.d], ox = b.l - a.l, oy = b.t - a.t;
    if (ox * dy === oy * dx && Math.abs(ox * dx + oy * dy) <= BELT_REACH) out.push(a.id + '~' + b.id + '@' + Math.abs(ox * dx + oy * dy));
  }
  return out;
}
function coveredBy(v, p) {
  const s = POLES[p.e.name].supply - SLACK;
  return Math.abs(v.l + v.w / 2 - p.l - p.w / 2) < s + v.w / 2 && Math.abs(v.t + v.h / 2 - p.t - p.h / 2) < s + v.h / 2;
}
function wireReach(view, [a, ac, b, bc]) {
  const va = view.byId.get(a), vb = view.byId.get(b);
  assert(va && vb, 'compact: wire to a missing entity');
  const copper = ac === 5 && bc === 5;
  if (copper) assert(va.kind === 'pole' && vb.kind === 'pole', 'compact: copper wire off a pole');
  // The power planner saves wires at exactly full reach, so reach is not shortened here.
  return {va, vb, reach: (copper ? Math.min(POLES[va.e.name].wire, POLES[vb.e.name].wire) : CIRCUIT_REACH) + 1e-6};
}

/** Describes a layout by its interactions; `gone` lists removed pass-through belts. */
export function topology(blueprint, gone = new Set()) {
  const view = makeView(blueprint.entities, 'x'), {nodes, grid} = view, lines = [];
  const resolve = (v, m) => {
    let x = m.x, y = m.y, target = grid.get(key(x, y));
    while (target && gone.has(target.id)) {
      assert(target.kind === 'belt' && target.d === v.d && m.k === 'flow', 'compact: removed entity was not a pass-through belt');
      const [dx, dy] = STEP[target.d]; x += dx; y += dy; target = grid.get(key(x, y));
    }
    return {target, x, y};
  };
  for (const v of nodes) {
    if (gone.has(v.id)) continue;
    for (const m of emissions(v)) {
      const {target, x, y} = resolve(v, m);
      if (m.k === 'fluid') {
        // A pipe opening only counts against something that carries fluid and faces it.
        if (!target || !['pipe', 'ptg', 'machine'].includes(target.kind)) continue;
        if (target.kind === 'ptg') { const [dx, dy] = STEP[target.d]; if (target.l + dx !== v.l || target.t + dy !== v.t) continue; }
      }
      // Record where on the target the action lands and how the two are turned.
      const where = target ? ':' + (x - target.l) + '/' + (y - target.t) + ':' + (target.d - v.d + 16) % 16 : '';
      lines.push(m.k + ' ' + v.id + '.' + m.cell + '>' + (target ? target.id + where : 'none'));
    }
  }
  for (const kind of ['ug', 'ptg']) for (const [a, b] of partners(nodes, kind, kind === 'ug' ? BELT_REACH : PIPE_REACH)) lines.push(kind + ' ' + a + '=' + b);
  for (const o of opposed(nodes)) lines.push('opposed ' + o);
  const wet = nodes.filter(v => v.kind === 'machine' && wetMachine(v.e));
  for (const a of wet) for (const b of wet) if (a.id < b.id) {
    const gapX = Math.max(a.l, b.l) - Math.min(a.l + a.w, b.l + b.w), gapY = Math.max(a.t, b.t) - Math.min(a.t + a.h, b.t + b.h);
    if (gapX <= 0 && gapY <= 0) lines.push('wet ' + a.id + '|' + b.id + ':' + (b.l - a.l) + '/' + (b.t - a.t));
  }
  const poles = nodes.filter(v => v.kind === 'pole'), problems = [];
  for (const v of nodes) if (powered(v) && !poles.some(p => coveredBy(v, p))) problems.push('unpowered ' + v.e.name + ' ' + v.id);
  for (const w of blueprint.wires || []) {
    const {va, vb, reach} = wireReach(view, w);
    if (Math.hypot(va.l + va.w / 2 - vb.l - vb.w / 2, va.t + va.h / 2 - vb.t - vb.h / 2) > reach) problems.push('wire out of reach ' + w.join(','));
  }
  return {lines: lines.sort(), problems};
}

function solve(count, edges, floor) {
  const value = new Array(count).fill(floor), out = Array.from({length: count}, () => []);
  for (const [a, b, c] of edges) out[a].push([b, c]);
  const queue = Array.from({length: count}, (_, i) => i), queued = new Array(count).fill(true), visits = new Array(count).fill(0);
  for (let head = 0; head < queue.length; head++) {
    const a = queue[head]; queued[a] = false;
    assert(++visits[a] <= count + 1, 'compact: contradictory constraints');
    for (const [b, c] of out[a]) if (value[a] + c > value[b]) { value[b] = value[a] + c; if (!queued[b]) { queued[b] = true; queue.push(b); } }
  }
  return value;
}

function pass(blueprint, axis, rules) {
  const view = makeView(blueprint.entities, axis), {nodes, grid, byId} = view, edges = [];
  const atLeast = (a, b, c) => edges.push([a.index, b.index, c]);            // b.l - a.l >= c
  const exactly = (a, b) => { atLeast(a, b, b.l - a.l); atLeast(b, a, a.l - b.l); };
  const fixed = new Set(rules.fixed);
  for (const w of blueprint.wires || []) { fixed.add(w[0]); fixed.add(w[2]); }
  const acts = new Map(nodes.map(v => [v.id, emissions(v)])), feeders = new Map(), touched = new Set();
  for (const v of nodes) for (const m of acts.get(v.id)) {
    const target = grid.get(key(m.x, m.y)); if (!target) continue;
    if (m.k === 'flow') { if (!feeders.has(target.id)) feeders.set(target.id, []); feeders.get(target.id).push(v); } else touched.add(target.id);
  }
  // A plain belt that only passes items straight on, along the compaction axis.
  const before = new Map();
  for (const v of nodes) {
    if (v.kind !== 'belt' || ![4, 12].includes(v.d) || fixed.has(v.id) || touched.has(v.id) || v.e.control_behavior || v.e.tags?.rgby_component) continue;
    const from = feeders.get(v.id) || [];
    if (from.length !== 1 || from[0].d !== v.d || !['belt', 'ug', 'splitter'].includes(from[0].kind)) continue;
    const ahead = grid.get(key(v.l + STEP[v.d][0], v.t));
    if (!ahead || !['belt', 'ug', 'splitter'].includes(ahead.kind)) continue;
    before.set(v.id, from[0]);
  }
  const rows = new Map();
  for (const v of nodes) for (let y = v.t; y < v.t + v.h; y++) { if (!rows.has(y)) rows.set(y, []); rows.get(y).push(v); }
  for (const row of rows.values()) row.sort((a, b) => a.l - b.l);
  const leftOf = (y, x) => { let best; for (const v of rows.get(y) || []) if (v.l + v.w - 1 < x) best = v; else break; return best; };
  const rightOf = (y, x) => (rows.get(y) || []).find(v => v.l > x);
  // Keep the order of everything sharing a row; pass-through belts may fold onto their feeder.
  for (const row of rows.values()) for (let i = 1; i < row.length; i++) {
    const a = row[i - 1], b = row[i];
    atLeast(a, b, before.get(b.id) === a || before.get(a.id) === b ? 0 : a.w);
  }
  for (const v of nodes) for (const m of acts.get(v.id)) {
    const target = grid.get(key(m.x, m.y));
    if (target) {
      if (m.k === 'flow' && before.get(target.id) === v) { if (v.d === 4) atLeast(target, v, -1); else atLeast(v, target, -1); }
      else exactly(v, target);
      continue;
    }
    // An empty tile that something acts on stays empty.
    const offset = m.x - v.l, inRow = m.y >= v.t && m.y < v.t + v.h;
    const left = leftOf(m.y, m.x), right = rightOf(m.y, m.x);
    if (left && left !== v && !(inRow && offset > 0)) atLeast(left, v, left.w - offset);
    if (right && right !== v && !(inRow && offset < 0)) atLeast(v, right, offset + 1);
  }
  for (const [kind, reach] of [['ug', BELT_REACH], ['ptg', PIPE_REACH]]) {
    const pairs = partners(nodes, kind, reach), ends = nodes.filter(v => v.kind === kind);
    for (const [a, b] of pairs) if (a < b) {
      const va = byId.get(a), vb = byId.get(b);
      if (va.t !== vb.t) exactly(va, vb);
      else { const [lo, hi] = va.l < vb.l ? [va, vb] : [vb, va]; atLeast(lo, hi, 1); atLeast(hi, lo, lo.l - hi.l); }
    }
    for (const a of ends) for (const b of ends) {
      if (a.id >= b.id || pairs.get(a.id) === b.id) continue;
      const across = [0, 8].includes(a.d), acrossB = [0, 8].includes(b.d);
      if (across && acrossB && Math.abs(a.t - b.t) <= reach + 1) {
        // Tunnel ends running across the axis never slide onto one line within reach.
        if (a.l !== b.l) { const [lo, hi] = a.l < b.l ? [a, b] : [b, a]; atLeast(lo, hi, 1); }
      } else if (kind === 'ug' && !across && !acrossB && a.t === b.t && a.d !== b.d) {
        // Unrelated ends on one line keep their distance when near, and stay out of reach when far.
        const [lo, hi] = a.l < b.l ? [a, b] : [b, a];
        if (hi.l - lo.l <= reach + 1) exactly(lo, hi); else atLeast(lo, hi, reach + 2);
      }
    }
  }
  // Fluid machines of different blocks never come into contact.
  const wet = nodes.filter(v => v.kind === 'machine' && wetMachine(v.e));
  for (const a of wet) for (const b of wet) if (a.id < b.id && a.t < b.t + b.h + 1 && b.t < a.t + a.h + 1) {
    const [lo, hi] = a.l <= b.l ? [a, b] : [b, a];
    if (hi.l - lo.l <= lo.w) exactly(lo, hi); else atLeast(lo, hi, lo.w + 1);
  }
  const poles = nodes.filter(v => v.kind === 'pole');
  for (const v of nodes) if (powered(v)) {
    const centre = p => Math.max(Math.abs(v.l + v.w / 2 - p.l - p.w / 2), Math.abs(v.t + v.h / 2 - p.t - p.h / 2));
    const p = poles.filter(p => coveredBy(v, p)).sort((a, b) => centre(a) - centre(b) || a.id - b.id)[0];
    assert(p, 'compact: unpowered ' + v.e.name + ' ' + v.id);
    // |centre(v) - centre(p)| < m, with centre(v) - centre(p) = v.l - p.l + shift.
    const m = POLES[p.e.name].supply - SLACK + v.w / 2, shift = v.w / 2 - p.w / 2;
    atLeast(v, p, 1 - Math.ceil(m - shift)); atLeast(p, v, Math.floor(-m - shift) + 1);
  }
  for (const w of blueprint.wires || []) {
    const {va, vb, reach} = wireReach(view, w), dy = va.t + va.h / 2 - vb.t - vb.h / 2;
    if (reach * reach < dy * dy) continue;                  // out of reach whatever this axis does
    const m = Math.sqrt(reach * reach - dy * dy), shift = vb.w / 2 - va.w / 2, now = vb.l - va.l + shift;   // centre(b) - centre(a)
    // A wire the routed layout already saves beyond reach stays beyond reach; every other wire stays within it.
    if (now > m) atLeast(va, vb, Math.floor(m - shift) + 1);
    else if (now < -m) atLeast(vb, va, 1 - Math.ceil(-m - shift));
    else { atLeast(va, vb, Math.ceil(-m - shift - 1e-9)); atLeast(vb, va, -Math.floor(m - shift + 1e-9)); }
  }
  if (axis === 'x') {
    const west = rules.west.map(id => byId.get(id)), east = rules.east.map(id => byId.get(id));
    for (let i = 1; i < west.length; i++) exactly(west[0], west[i]);
    for (let i = 1; i < east.length; i++) exactly(east[0], east[i]);
    // Exits stay on the east edge of the whole layout.
    for (const c of east.slice(0, 1)) for (const v of nodes) if (v !== c) atLeast(v, c, v.w - c.w);
  }
  for (const [a, b, mode] of rules.ties) {
    const va = byId.get(a), vb = byId.get(b);
    if (mode === 'rigid' || va.l === vb.l) exactly(va, vb);
    else { const [lo, hi] = va.l < vb.l ? [va, vb] : [vb, va]; atLeast(hi, lo, lo.l - hi.l); }
  }
  const floor = Math.min(...nodes.map(v => v.l)), value = solve(nodes.length, edges, floor), gone = new Set();
  for (const v of nodes) { const from = before.get(v.id); if (from && value[from.index] === value[v.index]) gone.add(v.id); }
  let moved = 0;
  for (const v of nodes) {
    if (value[v.index] !== v.l) moved++;
    if (axis === 'x') v.e.position.x = value[v.index] + v.w / 2; else v.e.position.y = value[v.index] + v.w / 2;
  }
  blueprint.entities = blueprint.entities.filter(e => !gone.has(e.entity_number));
  return {moved, gone};
}
function bounds(entities) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const e of entities) { const [w, h] = dims(e); left = Math.min(left, e.position.x - w / 2); right = Math.max(right, e.position.x + w / 2); top = Math.min(top, e.position.y - h / 2); bottom = Math.max(bottom, e.position.y + h / 2); }
  return {left, top, right, bottom, width: right - left, height: bottom - top};
}

/**
 * compactLayout(blueprint, rules) -> report. Edits entity positions in place and
 * removes folded pass-through belts. rules: west / east = exterior port entity
 * ids kept on their edge and in one column; ties = [a, b, 'rigid' | 'near'] for
 * signs that stay with their port; fixed = entity ids that are never folded.
 */
export function compactLayout(blueprint, {west = [], east = [], ties = [], fixed = []} = {}) {
  const rules = {west, east, ties, fixed: [...fixed, ...west, ...east, ...ties.flat().filter(Number.isInteger)]};
  const start = bounds(blueprint.entities), reference = structuredClone({entities: blueprint.entities, wires: blueprint.wires});
  const first = topology(reference);
  assert(!first.problems.some(p => p.startsWith('unpowered')), 'compact: routed layout has unpowered parts');
  const removed = new Set(), order = [];
  for (let round = 0; round < 12; round++) {
    let changed = 0;
    for (const axis of ['x', 'y']) { const r = pass(blueprint, axis, rules); for (const id of r.gone) removed.add(id); changed += r.moved + r.gone.size; order.push({axis, moved: r.moved, folded: r.gone.size}); }
    if (!changed) break;
    assert(round < 11, 'compact: no fixed point');
  }
  const expected = topology(reference, removed), actual = topology(blueprint);
  assert.deepEqual(actual.problems, first.problems, 'compact: power or wire reach changed');
  assert.deepEqual(actual.lines, expected.lines, 'compact: an interaction changed');
  const end = bounds(blueprint.entities);
  return {before: start, after: end, tilesBefore: start.width * start.height, tilesAfter: end.width * end.height, foldedBelts: removed.size, wiresSavedBeyondReach: first.problems.length, interactionsChecked: actual.lines.length, passes: order.filter(p => p.moved || p.folded)};
}
