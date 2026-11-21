// Essentials mall: eight building products on demand around one controlled
// red-belt ring. Pure Node and reproducible: the same variant always gives the
// same blueprint string. Usage:
//   FACTORIO_RAW=<data-raw-dump.json> node scripts/essentials-mall/generate.mjs [variant] [outDir]
// Without arguments it writes the published candidate to blueprint-sources/essentials-mall.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
import {powerInsideLayout} from './power.mjs';
import {VARIANTS, PUBLISHED_VARIANT, VERSIONS} from './variants.mjs';
import {familyVersions} from '../blueprint-versions.mjs';

export const RAW = process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
export const ID = 'essentials-mall';
export const LABEL = 'Essentials mall · eight building products on demand';

// Spec section 1: declared floors (targets) and stock caps.
export const TARGETS = {'assembling-machine-2': 2, 'fast-transport-belt': 8, 'fast-underground-belt': 1.5, 'fast-splitter': 1, 'fast-inserter': 6, 'bulk-inserter': 1, 'electric-furnace': 1, 'electric-mining-drill': 3};
export const CAPS = {'assembling-machine-2': 50, 'fast-transport-belt': 200, 'fast-underground-belt': 50, 'fast-splitter': 25, 'fast-inserter': 50, 'bulk-inserter': 25, 'electric-furnace': 25, 'electric-mining-drill': 50};
export const PRODUCTS = Object.keys(TARGETS);
export const BOUNDARY = ['iron-plate', 'copper-plate', 'steel-plate', 'stone-brick', 'plastic-bar', 'electronic-circuit'];

const sha = s => createHash('sha256').update(s).digest('hex');
const itemSignal = name => ({type: 'item', name, quality: 'normal'});
const virtual = name => ({type: 'virtual', name});
const filters = items => ({use_filters: true, filters: items.map((name, i) => ({index: i + 1, name, quality: 'normal', comparator: '='}))});
const below = (item, n) => ({circuit_enabled: true, circuit_condition: {first_signal: itemSignal(item), comparator: '<', constant: n}});
const above = (item, n) => ({circuit_enabled: true, circuit_condition: {first_signal: itemSignal(item), comparator: '>', constant: n}});
// A clock window is '=' n, '<' n (a leading range) or '>' n (a trailing range) on signal-P.
const phaseWindow = w => typeof w === 'number' ? {cmp: '=', n: w} : w;
const phaseIs = w => { const {cmp, n} = phaseWindow(w); return {circuit_enabled: true, circuit_condition: {first_signal: virtual('signal-P'), comparator: cmp, constant: n}}; };
const phasesOf = (w, N) => { const {cmp, n} = phaseWindow(w); return [...Array(N).keys()].filter(p => cmp === '=' ? p === n : cmp === '<' ? p < n : p > n); };
const fmt = n => String(Math.round(n * 10) / 10);

/** Recipe expansion from the declared floors down to the supplied boundary materials. */
export function recipeAudit(raw, targets = TARGETS) {
  const external = {}, crafts = {};
  const expand = (item, n) => {
    if (BOUNDARY.includes(item)) { external[item] = (external[item] || 0) + n; return; }
    const r = raw.recipe[item]; assert(r, 'missing recipe ' + item);
    const out = r.results.find(p => p.name === item).amount;
    crafts[item] = (crafts[item] || 0) + n / out;
    for (const i of r.ingredients) expand(i.name, n * i.amount / out);
  };
  for (const [p, n] of Object.entries(targets)) expand(p, n);
  const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6]));
  return {externalPerMinute: round(external), craftsPerMinute: round(crafts), recipeIngredients: Object.fromEntries(Object.keys(crafts).sort().map(n => [n, raw.recipe[n].ingredients]))};
}

export function build(raw, v) {
  let next = 1;
  const entities = [], wires = [], ports = [], occupied = new Map(), machineCounts = {};
  const key = (x, y) => `${x},${y}`;
  const protoOf = name => Object.values(raw).map(g => g?.[name]).find(p => p?.selection_box);
  function place(e) {
    const p = protoOf(e.name); assert(p, e.name);
    let w = Math.ceil(p.selection_box[1][0] - p.selection_box[0][0]), h = Math.ceil(p.selection_box[1][1] - p.selection_box[0][1]);
    if (e.name === 'display-panel') w = h = 1;
    if ([4, 12].includes(e.direction)) [w, h] = [h, w];
    for (let x = Math.floor(e.position.x - w / 2 + .01); x < e.position.x + w / 2 - .01; x++)
      for (let y = Math.floor(e.position.y - h / 2 + .01); y < e.position.y + h / 2 - .01; y++) {
        assert(!occupied.has(key(x, y)), `Collision ${e.name} at ${x},${y} with ${occupied.get(key(x, y))?.name}`);
        occupied.set(key(x, y), e);
      }
    entities.push(e); return e;
  }
  const add = (name, x, y, extra = {}) => place({entity_number: next++, name, position: {x: x + .5, y: y + .5}, ...extra});
  const at = (x, y) => occupied.get(key(x, y));
  const belt = (x, y, d) => add('fast-transport-belt', x, y, {direction: d});
  const arm = (x, y, d, extra = {}) => add(extra.name || 'fast-inserter', x, y, {direction: d, override_stack_size: (extra.name === 'bulk-inserter' ? 2 : 1), ...extra});
  const wire = (a, b, ac = 1, bc = 1) => wires.push([a.entity_number, ac, b.entity_number, bc]);
  // Combinators lie east-west (tiles x..x+1, y) unless `vertical` (tiles x, y..y+1).
  const combinator = (name, x, y, control_behavior, vertical = false) => place({entity_number: next++, name, position: vertical ? {x: x + .5, y: y + 1} : {x: x + 1, y: y + .5}, direction: vertical ? 0 : 4, control_behavior});

  const W = v.ringEast; // east column of the ring
  const H = v.ringBottom ?? 6; // ring bottom row y (5 when the inside row has one arm row)
  const rearArmY = H + 5, rearY = H + 6; // rear iron band behind the bottom row
  const limits = {...v.limits};

  // ---- Ring: top east, east column south, bottom west, west column north.
  const loop = [];
  for (let x = 0; x <= W; x++) loop.push(belt(x, 0, x === W ? 8 : 4));
  for (let y = 1; y <= H; y++) loop.push(belt(W, y, y === H ? 12 : 8));
  for (let x = W - 1; x >= 0; x--) loop.push(belt(x, H, x === 0 ? 0 : 12));
  for (let y = H - 1; y >= 1; y--) loop.push(belt(0, y, 0));
  for (const e of loop) e.control_behavior = {circuit_read_hand_contents: true, circuit_contents_read_mode: 1};
  for (let i = 0; i < loop.length; i++) wire(loop[i], loop[(i + 1) % loop.length]);
  const ringAt = (x, y) => { const e = at(x, y); assert(e && loop.includes(e), `no ring tile at ${x},${y}`); return e; };
  const N = v.phases || 4;
  const controlled = [], clockArms = Object.fromEntries([...Array(N).keys()].map(k => [k, []])), reserveArms = [], greenSide = [], capGatedArms = [];
  const ringControl = (e, item, near) => { e.control_behavior = below(item, limits[item]); wire(e, near); controlled.push(e.entity_number); };

  // ---- Machines. Rows: top (finals), inside, bottom (rear iron).
  const machines = [];
  const machine = (recipe, slot, row) => {
    const x0 = v.slotX(slot), cy = {top: -3, inside: 3, bottom: H + 3}[row];
    const m = add('assembling-machine-2', x0 + 1, cy, {recipe});
    machineCounts[recipe] = (machineCounts[recipe] || 0) + 1;
    const rec = {recipe, slot, row, x0, entity: m.entity_number, m};
    machines.push(rec); return rec;
  };
  // Input arm from the ring into a machine; outputs onto the ring.
  const feed = (rec, dx, items, opts = {}) => {
    const {row, x0} = rec, x = x0 + dx;
    const [ay, d, ry] = row === 'top' ? [-1, 8, 0] : row === 'inside' ? [1, 0, 0] : [H + 1, 0, H];
    const e = arm(x, ay, d, {...(opts.name ? {name: opts.name} : {}), ...filters(items)});
    if (opts.phase !== undefined) { e.control_behavior = phaseIs(opts.phase); wire(e, ringAt(x, ry)); for (const k of phasesOf(opts.phase, N)) clockArms[k].push(e.entity_number); }
    if (opts.reserve !== undefined) { e.control_behavior = above(items[0], opts.reserve); wire(e, ringAt(x, ry)); reserveArms.push({entity: e.entity_number, item: items[0], reserve: opts.reserve}); }
    // Green-side arms: a stock gate on the product's chest signal, or a plain relay for the green chain.
    if (opts.capGate) { e.control_behavior = {circuit_enabled: true, circuit_condition: {first_signal: itemSignal(opts.capGate), comparator: '<', constant: 0}}; greenSide.push(e); capGatedArms.push({entity: e.entity_number, product: opts.capGate}); }
    if (opts.relay) greenSide.push(e);
    return e;
  };
  const output = (rec, dx, item = rec.recipe) => {
    const {row, x0} = rec, x = x0 + dx;
    // With `insideOutTop` the inside row has one arm row: its outputs also go to the top belt.
    const [ay, d, ry] = row === 'top' ? [-1, 0, 0] : row === 'inside' ? (v.insideOutTop ? [1, 8, 0] : [5, 0, H]) : [H + 1, 8, H];
    const e = arm(x, ay, d, filters([item]));
    ringControl(e, item, ringAt(x, ry));
    return e;
  };
  const rear = (rec, dx, opts = {}) => {
    const e = arm(rec.x0 + dx, rearArmY, 8, {...(opts.name ? {name: opts.name} : {}), ...filters(opts.items || ['iron-plate'])});
    // A rear iron arm gated on its product's chest signal stops a machine that delivers straight to its chest.
    if (opts.capGate) { e.control_behavior = {circuit_enabled: true, circuit_condition: {first_signal: itemSignal(opts.capGate), comparator: '<', constant: 0}}; greenSide.push(e); capGatedArms.push({entity: e.entity_number, product: opts.capGate}); }
    return e;
  };

  // A machine's own product handed to its neighbour behind the bottom row: the arm drops it on a
  // short dead-end belt (tiles x..x+`tiles`-1 of the rear row, east-bound, apart from the iron belt)
  // that the neighbour's rear arm picks from. The arm is bounded by the belt's few slots, and may
  // also carry a clock window or a ring reserve.
  const rearOutput = (rec, dx, opts = {}) => {
    const x = rec.x0 + dx, e = arm(x, rearArmY, 0, {...(opts.name ? {name: opts.name} : {}), ...filters([rec.recipe])});
    const handOff = []; for (let k = 0; k < (opts.tiles || 2); k++) handOff.push(belt(x + k, rearY, 4).entity_number);
    if (opts.phase !== undefined) { e.control_behavior = phaseIs(opts.phase); wire(e, ringAt(x, H)); for (const k of phasesOf(opts.phase, N)) clockArms[k].push(e.entity_number); }
    if (opts.reserve !== undefined) { e.control_behavior = above(rec.recipe, opts.reserve); wire(e, ringAt(x, H)); reserveArms.push({entity: e.entity_number, item: rec.recipe, reserve: opts.reserve}); }
    rearOutputs.push({entity: e.entity_number, item: rec.recipe, from: rec.entity, belt: handOff});
    return e;
  };
  const rearOutputs = [];
  for (const [slot, recipe] of v.top.entries()) if (recipe) machine(recipe, slot + 1, 'top');
  for (const [slot, recipe] of v.inside.entries()) if (recipe && recipe !== 'bay') machine(recipe, slot + 1, 'inside');
  for (const [slot, recipe] of v.bottom.entries()) if (recipe) machine(recipe, slot + 1, 'bottom');
  const byRecipe = r => machines.filter(m => m.recipe === r);

  // Arm plans per recipe (dx 0..2 within the slot). Each entry: [dx, kind, items|item, opts].
  const plans = v.arms;
  const finalOutputs = {}, directChests = [];
  for (const rec of machines) {
    const plan = plans[`${rec.recipe}@${rec.row}${rec.slot}`] || plans[`${rec.recipe}@${rec.row}`] || plans[rec.recipe]; assert(plan, 'no arm plan for ' + rec.recipe);
    for (const [dx, kind, items, opts = {}] of plan) {
      if (kind === 'in') feed(rec, dx, items, opts);
      else if (kind === 'out') { const e = output(rec, dx); finalOutputs[rec.recipe] = e.entity_number; }
      else if (kind === 'rear') rear(rec, dx, items || opts);
      else if (kind === 'chest') directChests.push({rec, dx});
      else if (kind === 'rearOut') rearOutput(rec, dx, items || opts);
      else if (kind === 'none') {}
      else throw Error('bad arm kind ' + kind);
    }
  }

  // ---- Fast-inserter feed gate. The fast-inserter machine's ingredient arm runs while its chest is
  // below the cap (green) OR the ring holds fewer than `ringBelow` fast inserters (red), so a full
  // fast-inserter chest never starves the bulk-inserter machine of its fast-inserter ingredient.
  let feedGate = null;
  if (v.feedGate) {
    const {item, at: [fx, fy], ringTile, ringBelow} = v.feedGate;
    const g = capGatedArms.find(c => c.product === item); assert(g, 'no cap-gated arm for ' + item);
    const feedArm = entities.find(e => e.entity_number === g.entity);
    feedArm.control_behavior = {circuit_enabled: true, circuit_condition: {first_signal: virtual('signal-F'), comparator: '>', constant: 0}};
    const d = combinator('decider-combinator', fx, fy, {decider_conditions: {conditions: [
      {first_signal: itemSignal(item), comparator: '<', constant: 0, first_signal_networks: {red: false, green: true}},
      {first_signal: itemSignal(item), comparator: '<', constant: ringBelow, first_signal_networks: {red: true, green: false}, compare_type: 'or'}],
      outputs: [{signal: virtual('signal-F'), copy_count_from_input: false, constant: 1}]}});
    wire(ringAt(...ringTile), d, 1, 1); wire(feedArm, d, 2, 2); wire(feedArm, d, 2, 4);
    feedGate = {item, decider: d.entity_number, arm: feedArm.entity_number, ringBelow, signal: 'signal-F'};
  }

  // ---- West admissions (one entrance per material, each its own row).
  const panelsWanted = [];
  const input = (item, entrance, extra = {}) => {
    const p = {kind: 'input', label: item, items: [item], item, entity: entrance.entity_number, x: entrance.position.x, y: entrance.position.y, position: entrance.position, externalSide: 'west', direction: 4, ...extra};
    ports.push(p); return p;
  };
  const west = v.westLeft; // westmost column of the blueprint
  const admissions = {};
  for (const {item, rows, arm: armName} of v.westFeeds) {
    if (v.gatedEntrances) {
      // The entrance belt itself is the admission: it side-loads onto the ring's west column and
      // runs only while the item's ring count is below its limit.
      assert(west === -1 && rows.length === 1, 'gated entrances sit in the one-column west zone');
      const entrance = belt(west, rows[0], 4);
      ringControl(entrance, item, ringAt(0, rows[0])); admissions[item] = [entrance.entity_number];
      input(item, entrance, {admission: 'gated-entrance-belt'}); panelsWanted.push(item);
      continue;
    }
    // Entrance belt at (west, rows[0]) running east, then down a short column behind the arms.
    const y0 = rows[0];
    const entrance = belt(west, y0, 4);
    for (let x = west + 1; x <= -2; x++) {
      const last = x === -2;
      belt(x, y0, last && rows.length > 1 ? 8 : 4);
    }
    for (let j = 1; j < rows.length; j++) belt(-2, rows[j], j === rows.length - 1 ? 4 : 8);
    admissions[item] = [];
    for (const y of rows) {
      const e = arm(-1, y, 12, {...(armName ? {name: armName} : {}), ...filters([item])});
      ringControl(e, item, ringAt(0, y)); admissions[item].push(e.entity_number);
    }
    input(item, entrance);
    panelsWanted.push(item);
  }
  // Plastic (or `v.cornerFeed.item`) along y=-2, admitted at (0,-1) onto the corner (0,0).
  {
    const item = v.cornerFeed?.item || 'plastic-bar', y = -2, entrance = belt(west, y, 4);
    for (let x = west + 1; x <= 0; x++) belt(x, y, 4);
    const e = arm(0, -1, 0, {...(v.cornerFeed?.arm ? {name: v.cornerFeed.arm} : {}), ...filters([item])}); ringControl(e, item, ringAt(0, 0)); admissions[item] = [e.entity_number];
    input(item, entrance); panelsWanted.push(item);
  }
  // Iron: entrance at the rear row; a splitter sends one branch up to the ring admission at (0,7).
  // With `ironLift` the entrance runs straight into the rear belt and one bulk arm at (0,11) lifts
  // iron onto a short belt (0,10)-(0,8) for the same admission arm.
  if (!v.noRear) {
    const item = 'iron-plate', entrance = belt(west, rearY, 4);
    let bx;
    if (v.ironLift) {
      assert(west === -1, 'iron lift needs the one-column west zone'); bx = 0;
      arm(0, rearY - 1, 8, {name: 'bulk-inserter', ...filters([item])});
      for (let y = rearY - 2; y >= H + 2; y--) belt(0, y, 0);
    } else {
      for (let x = west + 1; x < -2; x++) belt(x, rearY, 4);
      const sx = west + 1; bx = west + 2; // splitter column, branch column
      place({entity_number: next++, name: 'fast-splitter', position: {x: sx + .5, y: rearY}, direction: 4});
      // Upper branch: north from (bx, rearY-1) to row 8, ending at (0,8) where the admission arm picks.
      if (bx === 0) for (let y = rearY - 1; y >= H + 2; y--) belt(0, y, 0);
      else { for (let y = rearY - 1; y >= H + 3; y--) belt(bx, y, 0); belt(bx, H + 2, 4); for (let x = bx + 1; x <= 0; x++) belt(x, H + 2, 4); }
    }
    const e = arm(0, H + 1, 8, filters([item])); ringControl(e, item, ringAt(0, H)); admissions[item] = [e.entity_number];
    // Rear belt: both lanes iron, dead end at the last rear arm.
    const rearEnd = Math.max(...entities.filter(e => e.name.endsWith('inserter') && e.position.y === rearArmY + .5 && e.filters?.[0]?.name === 'iron-plate').map(e => e.position.x - .5));
    // A substation hole in the rear band is bridged by one underground pair.
    const gap = v.rearGap || [];
    for (let x = bx; x <= rearEnd; x++) {
      if (gap.includes(x)) continue;
      if (gap.length && x === Math.min(...gap) - 1) add('fast-underground-belt', x, rearY, {direction: 4, type: 'input'});
      else if (gap.length && x === Math.max(...gap) + 1) add('fast-underground-belt', x, rearY, {direction: 4, type: 'output'});
      else belt(x, rearY, 4);
    }
    input(item, entrance); panelsWanted.push(item);
  }

  // ---- East: chest column, cap arms on green, the direct fast-belt chest.
  const chestX = W + 2, chestArmX = W + 1;
  const outputs = [], chestArms = [], chests = [];
  const capComb = add('constant-combinator', v.capCombinator[0], v.capCombinator[1], {direction: 0, control_behavior: {sections: {sections: [{index: 1, filters: PRODUCTS.map((item, i) => ({index: i + 1, type: 'item', name: item, quality: 'normal', comparator: '=', count: -CAPS[item]}))}]}}});
  const capGate = item => ({circuit_enabled: true, circuit_condition: {first_signal: itemSignal(item), comparator: '<', constant: 0}});
  let previousChest = capComb;
  const outputPort = (item, chest, armEntity) => {
    const p = {kind: 'output', label: item, items: [item], item, entity: chest.entity_number, x: chest.position.x, y: chest.position.y, position: chest.position, externalSide: 'east', cap: CAPS[item], arm: armEntity.entity_number};
    ports.push(p); outputs.push(p);
  };
  // Fast transport belt: long-handed arm straight from its machine to its chest.
  {
    const fb = byRecipe('fast-transport-belt')[0]; assert(fb.row === 'top' && fb.x0 + 2 === W - 1, 'fast-belt machine must be in the last top slot');
    const y = -3, chest = add('passive-provider-chest', chestX, y), e = arm(W, y, 12, {name: 'long-handed-inserter', ...filters(['fast-transport-belt']), control_behavior: capGate('fast-transport-belt')});
    wire(e, chest, 2, 2); wire(previousChest, chest, 2, 2); previousChest = chest; chestArms.push(e.entity_number); chests.push(chest.entity_number);
    finalOutputs['fast-transport-belt'] = e.entity_number;
    outputPort('fast-transport-belt', chest, e);
  }
  let chestReserve = null;
  for (const [i, item] of v.eastOrder.entries()) {
    const y = i; assert(y <= H);
    const reserve = v.chestReserve?.item === item ? v.chestReserve : null;
    const e = arm(chestArmX, y, 12, {...filters([item]), control_behavior: reserve ? {circuit_enabled: true, circuit_condition: {first_signal: virtual('signal-R'), comparator: '>', constant: 0}} : capGate(item)});
    const chest = add('passive-provider-chest', chestX, y);
    wire(e, chest, 2, 2); wire(previousChest, chest, 2, 2); previousChest = chest; chestArms.push(e.entity_number); chests.push(chest.entity_number);
    outputPort(item, chest, e);
    if (reserve) {
      // One decider: R = 1 while the chest (green) is below its cap AND the ring (red) holds more
      // than the reserve, so the ingredient stock for the consuming machine stays on the ring.
      const [dx, dy] = reserve.at;
      const d = combinator('decider-combinator', dx, dy, {decider_conditions: {conditions: [
        {first_signal: itemSignal(item), comparator: '<', constant: 0, first_signal_networks: {red: false, green: true}},
        {first_signal: itemSignal(item), comparator: '>', constant: reserve.reserve, first_signal_networks: {red: true, green: false}, compare_type: 'and'}],
        outputs: [{signal: virtual('signal-R'), copy_count_from_input: false, constant: 1}]}});
      wire(ringAt(...reserve.ringTile), d, 1, 1); wire(chest, d, 2, 2); wire(chest, d, 2, 4);
      chestReserve = {item, reserve: reserve.reserve, decider: d.entity_number, arm: e.entity_number, chest: chest.entity_number, signal: 'signal-R'};
    }
  }
  // A machine in the rear corner can deliver straight down into its own chest in the same east column.
  for (const {rec, dx} of directChests) {
    const item = rec.recipe, x = rec.x0 + dx; assert(x === chestX, 'a direct chest sits in the east chest column');
    const e = arm(x, rearArmY, 0, {...filters([item]), control_behavior: capGate(item)}), chest = add('passive-provider-chest', x, rearY);
    wire(e, chest, 2, 2); wire(previousChest, chest, 2, 2); previousChest = chest; chestArms.push(e.entity_number); chests.push(chest.entity_number);
    finalOutputs[item] = e.entity_number;
    outputPort(item, chest, e);
  }
  assert.deepEqual([...outputs.map(p => p.item)].sort(), [...PRODUCTS].sort());

  // ---- Green chain: relay arms (no condition, no red wire) carry the cap network to
  // machine arms gated on their product's chest signal. Each hop is at most 8 tiles.
  if (greenSide.length) {
    const net = [capComb, ...entities.filter(e => chests.includes(e.entity_number) || chestArms.includes(e.entity_number))];
    const todo = [...greenSide], dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
    while (todo.length) {
      let best;
      for (const a of todo) for (const b of net) { const d = dist(a, b); if (d <= 8 && (!best || d < best.d)) best = {a, b, d}; }
      assert(best, 'green chain cannot reach ' + todo.map(e => e.entity_number));
      wire(best.a, best.b, 2, 2); net.push(best.a); todo.splice(todo.indexOf(best.a), 1);
    }
  }

  // ---- Clock: T counts ticks, U = T / 600, P = U % 4 on the ring's red network.
  const [[tx, ty, tUp], [dx2, dy2, dUp], [px, py, pUp]] = v.clockTiles; // a third entry 'upright' or 'flat' sets one combinator's orientation
  const arith = (x, y, first, op, k, out, upright) => combinator('arithmetic-combinator', x, y, {arithmetic_conditions: {first_signal: virtual(first), second_constant: k, operation: op, output_signal: virtual(out)}}, upright === undefined ? !!v.clockVertical : upright === 'upright');
  const timer = arith(tx, ty, 'signal-T', '+', 1, 'signal-T', tUp);
  const divide = arith(dx2, dy2, 'signal-T', '/', v.windowTicks, 'signal-U', dUp);
  const phase = arith(px, py, 'signal-U', '%', N, 'signal-P', pUp);
  wires.push([timer.entity_number, 3, timer.entity_number, 1], [timer.entity_number, 3, divide.entity_number, 1], [divide.entity_number, 3, phase.entity_number, 1]);
  wire(phase, ringAt(...v.clockRingTile), 3, 1);

  // ---- Entrance labels within 4 tiles, never on an entrance row west of its entrance.
  for (const item of panelsWanted) {
    const p = ports.find(q => q.kind === 'input' && q.item === item), px = Math.floor(p.x), py = Math.floor(p.y);
    const spots = v.panelSpots[item] || [];
    let placed;
    for (const [x, y] of spots) {
      if (occupied.has(key(x, y))) continue;
      if (Math.hypot(x - px, y - py) > 4) continue;
      if (ports.some(q => q.kind === 'input' && Math.floor(q.y) === y && x < q.x)) continue;
      placed = add('display-panel', x, y, {icon: itemSignal(item), always_show: true, text: ''}); break;
    }
    assert(placed, 'no panel spot for ' + item);
    p.displayEntity = placed.entity_number;
  }

  // ---- Power inside the production rectangle.
  const shapeRaw = {...raw, container: {...raw.container, ...raw['logistic-container']}, 'arithmetic-combinator': {...raw['arithmetic-combinator'], ...raw['decider-combinator'], ...raw['constant-combinator']}};
  const before = starterBounds(entities, shapeRaw);
  ports.push({kind: 'power', label: 'External electricity', items: []});
  const layout = {entities, wires, next, place};
  const power = powerInsideLayout(layout, ports, raw, before, {maxMediumPoles: 4, allow: v.powerSpots});
  next = layout.next;
  const footprint = starterBounds(entities, shapeRaw);
  assert.deepEqual(footprint, before, 'power grew the footprint');

  // Every circuit wire must be within reach (9 tiles for every entity used here).
  { const byNumber = new Map(entities.map(e => [e.entity_number, e]));
    for (const [a, ac, b, bc] of wires) if (ac <= 4 && bc <= 4) { const p = byNumber.get(a).position, q = byNumber.get(b).position; assert(Math.hypot(p.x - q.x, p.y - q.y) <= 9, `circuit wire ${a}-${b} is longer than 9 tiles`); } }

  // ---- Demand, labels and text.
  const audit = recipeAudit(raw);
  for (const p of ports.filter(p => p.kind === 'input')) {
    p.perMinute = audit.externalPerMinute[p.item];
    const panel = entities.find(e => e.entity_number === p.displayEntity);
    panel.text = `IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min at nominal target`;
  }
  for (const e of entities) e.tags = {...e.tags, flight_science_entity: e.entity_number};

  const capacity = 8 * loop.length, maximumStock = Object.values(limits).reduce((a, b) => a + b, 0);
  assert(maximumStock <= .6 * capacity, `ring limits ${maximumStock} exceed 60% of ${capacity}`);
  const machineTotal = Object.values(machineCounts).reduce((a, b) => a + b, 0);
  const numberWord = n => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] || String(n);
  const clockedFinals = [...new Set(Object.values(clockArms).flat().map(id => machineOf(id)))];
  const preserve = ['the red ring wires', 'the green cap wires', 'all arm filters', ...(v.gatedEntrances ? ['the entrance belt conditions'] : []), 'the gear clock', ...(rearOutputs.length ? ['the two-tile gear belt behind the drill'] : []), 'the fast-inserter reserve decider', ...(feedGate ? ['the fast-inserter feed decider'] : [])];
  const description = `Factorio 2.1.24 Space Age. ${machineTotal} assembling machine 2 (no modules), red belts, fast/long-handed/bulk arms. WEST inputs, one labelled entrance each: iron plates, electronic circuits, copper plates, steel plates, stone bricks, plastic bars. EAST: eight passive provider chests in one column, one product each; each stops at its own cap, set in the constant combinator beside the fast-belt chest (edit one number). Gears, cable, red circuits, yellow belts, undergrounds, splitters, inserters and AM1 are made inside. Preserve ${preserve.slice(0, -1).join(', ')} and ${preserve.at(-1)}. Supply electricity at the marked substation.`;
  const bp = {item: 'blueprint', version: 562954249961472, label: LABEL, description, entities, wires,
    icons: ['assembling-machine-2', 'fast-transport-belt', 'bulk-inserter', 'electric-mining-drill'].map((name, i) => ({index: i + 1, signal: {type: 'item', name}}))};
  const code = encodeBlueprint({blueprint: bp});

  const ringLimitFor = Object.fromEntries(PRODUCTS.map(p => [p, limits[p] ?? null]));
  const loopControl = [{name: ID + '-ring', reader: loop[0].entity_number, readerMode: 'per-tile-hold', loop: loop.map(e => e.entity_number), controlled, limits, capacity, maximumStock, uncountedTiles: []}];
  const inputs = ports.filter(p => p.kind === 'input');
  // Which machines take iron from the rear belt, and which from the ring (for the setup notes).
  const rearArmXs = entities.filter(e => e.name.endsWith('inserter') && e.position.y === rearArmY + .5 && e.filters?.[0]?.name === 'iron-plate' && !(v.ironLift && e.position.x === .5)).map(e => e.position.x);
  const rearUsers = [...new Set(machines.filter(m => m.row === 'bottom' && rearArmXs.some(x => x > m.x0 && x < m.x0 + 3)).map(m => m.recipe))];
  const ringIronUsers = [...new Set(machines.filter(m => (plans[`${m.recipe}@${m.row}${m.slot}`] || plans[`${m.recipe}@${m.row}`] || plans[m.recipe]).some(([, kind, items]) => kind === 'in' && items.includes('iron-plate'))).map(m => m.recipe))];
  const count = r => machines.filter(m => m.recipe === r).length;
  const words = ['', 'one', 'two', 'three', 'four'];
  const list = rs => { const one = rs.filter(r => count(r) === 1), many = rs.filter(r => count(r) > 1);
    const parts = [...many.map(r => `${words[count(r)]} ${r} machines`), ...(one.length ? [`the ${one.length > 1 ? one.slice(0, -1).join(', ') + ' and ' + one.at(-1) + ' machines' : one[0] + ' machine'}`] : [])];
    return parts.join(' and '); };
  const rearNote = v.noRear ? `Iron enters on a gated belt that side-loads onto the ring's outer lane; the ${list(ringIronUsers).replace(/^the /, '')} take it from the ring.` : `Iron mostly goes to the rear belt behind the bottom row, which feeds ${list(rearUsers)}. The ${list(ringIronUsers).replace(/^the /, '')} take iron from the ring, which gets it through one admission arm${v.ironLift ? ' fed by a bulk arm that lifts iron off the rear belt' : ' fed by a splitter branch'}.`;
  const manifest = {
    id: ID, name: LABEL, file: ID + '.txt', blueprintSha256: sha(code), prototypeSha256: null,
    class: 'on-demand', variant: v.name, status: 'native-validation-pending',
    products: PRODUCTS, targets: TARGETS, outputCaps: CAPS,
    recipeAudit: audit,
    inputs: inputs.map(p => ({...p})), fluids: [], outputs: outputs.map(p => ({...p})), ports,
    machineCounts, machines: machines.map(m => ({recipe: m.recipe, row: m.row, slot: m.slot, entity: m.entity})),
    finalMachines: Object.fromEntries(PRODUCTS.map(p => [p, byRecipe(p).map(m => m.entity)])),
    footprint, areaGoal: {goalTiles: 442, stretchTiles: 400, achievedTiles: footprint.width * footprint.height},
    loopControl, ringLimitFor,
    stockControl: {mode: 'chest-condition', combinator: capComb.entity_number, chests, arms: chestArms, caps: CAPS, network: 'green', chestReserve, feedGate, capGatedArms, greenRelays: greenSide.filter(e => !capGatedArms.some(c => c.entity === e.entity_number)).map(e => e.entity_number)},
    productionClock: {timer: timer.entity_number, divide: divide.entity_number, phase: phase.entity_number, windowTicks: v.windowTicks, phases: N, cycleTicks: N * v.windowTicks,
      phaseAssignment: Object.fromEntries(Object.entries(clockArms).map(([k, ids]) => [k, ids.map(id => ({arm: id, recipe: machineOf(id)}))])), reserveArms, ...(rearOutputs.length ? {rearOutputs} : {})},
    admissions,
    protocol: {warmupMinutes: 10, measureMinutes: 20, blockedMinutes: 5, settleMinutes: 5, recoveryMinutes: 10, capPhases: true, holdMinutes: 10, resumeSettleMinutes: 2,
      fillLimitMinutes: Object.fromEntries(PRODUCTS.map(p => [p, Math.max(10, Math.ceil(2 * CAPS[p] / TARGETS[p]))])),
      refillLimitMinutes: Object.fromEntries(PRODUCTS.map(p => [p, Math.max(5, Math.ceil(CAPS[p] / TARGETS[p]))]))},
    construction: Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length])),
    power: {substations: power.substations, mediumPoles: power.mediumPoles},
    greenCircuitSupply: {perMinute: audit.externalPerMinute['electronic-circuit'], copiesOfGreenCircuits: Math.ceil(audit.externalPerMinute['electronic-circuit'] / 360)},
    setupNotes: [description,
      'Feed each west entrance with its labelled material only; the harness feeds every entrance as a full red belt. ' + rearNote,
      'Electronic circuits are a supplied input (84/min at the floors, more when one product is drawn alone); one green-circuits supplier covers this mall.',
      'Caps live in one constant combinator next to the fast-belt chest (one negative number per product). Each chest arm runs only while its product is below its cap.',
      feedGate
        ? `Fast inserters are also a bulk-inserter ingredient. The fast-inserter machine's inserter-feed arm runs while the fast-inserter chest is below its cap or the ring holds fewer than ${feedGate.ringBelow} fast inserters (one decider), so the bulk-inserter machine keeps getting fast inserters while that chest is full. A second decider lets the fast-inserter chest arm take only fast inserters above a ring reserve of ${chestReserve.reserve}.`
        : 'Fast inserters are also a bulk-inserter ingredient: their feed arm stops while the fast-inserter chest is full, and a decider keeps a reserve of fast inserters on the ring for the bulk-inserter machine.',
      rearOutputs.length
        ? `Gear arms of the ${numberWord(clockedFinals.length)} gear-hungry top-row finals take turns in a ${numberWord(N)}-window clock (${fmt(v.windowTicks / 60)} s each, every window owned); the drill gets its gears straight from the gear machine beside it over a two-tile belt; yellow belts, inserters and AM1 take gears freely because their own ring limits bound them.`
        : 'Gear arms of the six gear-hungry finals take turns in an eight-window clock (7.5 s each); yellow belts, inserters and AM1 take gears freely because their own ring limits bound them.',
      v.supplyNote || "Plan supply above the entrance panels if all eight products should hold their floors at once: the panels are recipe totals at the floors, and products early on the ring run above them and take material first. Exploration measurements (full-length runs with a throttled-feed copy of the harness, not part of the qualification): with every entrance fed at exactly its panel figure and all eight products drawn, assembling machine 2 made 0/min (floor 2) and bulk inserters 0.25/min (floor 1); the other six held their floors. The floors need about the measured draw: 195 electronic circuits, 722 iron, 38 steel, 27 stone brick, 30 plastic and 30 copper per minute, two to three times the panels. Circuits alone limited to 360/min (one green-circuits copy) with every other entrance unlimited kept all eight above their floors. With less supply the mall still fills every chest in turn; only the all-eight-at-once floors are lost."]
  };
  function machineOf(id) { const arm = entities.find(e => e.entity_number === id); const m = machines.find(m => Math.abs(m.m.position.x - arm.position.x) <= 1.5 && Math.abs(m.m.position.y - arm.position.y) <= 2.5); return m?.recipe; }
  return {code, manifest, bp};
}

async function main() {
  const bytes = await fs.readFile(RAW), raw = JSON.parse(bytes);
  const name = process.argv[2] || PUBLISHED_VARIANT, out = process.argv[3] || 'blueprint-sources/' + ID;
  let v = VARIANTS[name]; assert(v, 'unknown variant ' + name);
  // Exploration only: ESSENTIALS_TWEAK='{"limits":{...},"windowTicks":600}' overrides a named variant.
  if (process.env.ESSENTIALS_TWEAK) { const t = JSON.parse(process.env.ESSENTIALS_TWEAK); v = {...v, ...t, limits: {...v.limits, ...(t.limits || {})}, arms: {...v.arms, ...(t.arms || {})}, name: v.name + "+tweak"}; }
  const {code, manifest} = build(raw, v);
  manifest.prototypeSha256 = sha(bytes);
  await fs.mkdir(out, {recursive: true});
  await fs.writeFile(out + '/' + ID + '.txt', code + '\n');
  // Keep any recorded status/history fields the validator wrote for this same string.
  let old; try { old = JSON.parse(await fs.readFile(out + '/manifest.json'))[0]; } catch {}
  if (old?.blueprintSha256 === manifest.blueprintSha256 && old.status) { manifest.status = old.status; if (old.nativeReport) manifest.nativeReport = old.nativeReport; if (old.measured) manifest.measured = old.measured; }
  // The published variant lists every tested version (current first) with its own size, machines and measured
  // rates; older versions are read from blueprint-sources/essentials-mall/history/ wherever the output goes.
  if (name === PUBLISHED_VARIANT && !process.env.ESSENTIALS_TWEAK) {
    const versions = await familyVersions(out, [{label: VERSIONS[0].label, summary: VERSIONS[0].summary, file: ID + '.txt', report: 'native-report.json', width: manifest.footprint.width, height: manifest.footprint.height}]);
    const home = 'blueprint-sources/' + ID;
    for (const v of VERSIONS.slice(1)) versions.push(...(await familyVersions(home, [{label: v.label, summary: v.summary, file: v.folder + '/' + ID + '.txt', manifest: v.folder + '/manifest.json', report: v.folder + '/native-report.json'}])));
    assert.equal(VERSIONS[0].variant, name);
    manifest.versions = versions;
  }
  await fs.writeFile(out + '/manifest.json', JSON.stringify([manifest], null, 2) + '\n');
  console.log(JSON.stringify({variant: name, out, footprint: manifest.footprint, area: manifest.areaGoal.achievedTiles, machines: Object.values(manifest.machineCounts).reduce((a, b) => a + b, 0), power: manifest.power, ringStock: manifest.loopControl[0].maximumStock + '/' + manifest.loopControl[0].capacity, blueprintSha256: manifest.blueprintSha256}));
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
