// Space launch kit: one ground blueprint that builds, once, the rocket silo, the cargo landing pad,
// the space platform starter pack and every item the white-platform and white-pack-receiver
// blueprints need, each in its own passive provider chest capped at its count.
// Pure Node and reproducible. Counts live only in scripts/launch-kit/bill.json.
// Usage: FACTORIO_RAW=<data-raw-dump.json> node scripts/launch-kit/generate.mjs [outDir]
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {encodeBlueprint} from '../blueprints.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
import {powerInsideLayout} from './power.mjs';
import {writeReadme} from './readme.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RAW = process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
export const ID = 'launch-kit';
export const LABEL = 'Space launch kit · silo, pad, starter pack and platform parts';
export const BOUNDARY = ['concrete', 'steel-plate', 'copper-plate', 'plastic-bar', 'iron-plate', 'stone-brick', 'electronic-circuit', 'lubricant', 'sulfuric-acid'];
export const FLUIDS = ['lubricant', 'sulfuric-acid'];
// The five finals whose ingredients are too expensive to over-load: one craft at a time, latched.
export const EXACT = ['rocket-silo', 'cargo-landing-pad', 'space-platform-starter-pack', 'asteroid-collector', 'crusher'];
// Entrance supply the kit is qualified at (items or fluid per minute), computed from the bill by one rule so a
// bill change needs no hand tuning (edit bill.json, run this generator, run the full protocol):
//   designMinutes = the longest machine chain of this bill (crafts x craft time / speed / machines of that recipe)
//   solids:  perMinute = roundUp(SOLID_HEADROOM x perKit / designMinutes)
//   fluids:  perMinute = roundUp(FLUID_HEADROOM x perKit / designMinutes)   (fluids are judged on consumed amounts)
// roundUp keeps whole numbers at 10 and above and one decimal below; no entrance is planned below SUPPLY_RULE.minimum.
export const SUPPLY_RULE = {solidHeadroom: 1.05, fluidHeadroom: 1.25, minimum: 0.5};
const roundUpSupply = v => v >= 10 ? Math.ceil(v - 1e-9) : Math.ceil(v * 10 - 1e-9) / 10;
export function supplyFor(item, perKit, designMinutes, rule = SUPPLY_RULE) {
  const headroom = FLUIDS.includes(item) ? rule.fluidHeadroom : rule.solidHeadroom;
  return Math.max(rule.minimum, roundUpSupply(headroom * perKit / designMinutes));
}

const sha = s => createHash('sha256').update(s).digest('hex');
const N = 0, E = 4, S = 8, W = 12;
const itemSignal = name => ({type: 'item', name, quality: 'normal'});
const virtual = name => ({type: 'virtual', name});
const filters = items => ({use_filters: true, filters: items.map((name, i) => ({index: i + 1, name, quality: 'normal', comparator: '='}))});
const cond = (item, comparator, constant, signal = itemSignal(item)) => ({circuit_enabled: true, circuit_condition: {first_signal: signal, comparator, constant}});

export function loadBill(file = path.join(HERE, 'bill.json')) {
  const bill = JSON.parse(fsSync.readFileSync(file, 'utf8'));
  assert.equal(bill.schema, 1);
  for (const r of bill.items) {
    r.cap = r.count + r.spare;
    assert(Number.isInteger(r.cap) && r.cap >= 0 && r.cap <= r.max, `cap of ${r.item} must be within 0..${r.max}`);
    // Optional shares: how much of count goes to the platform request and to the receiver (spares stay in the chests).
    if (r.platform != null || r.receiver != null)
      assert.equal((r.platform ?? 0) + (r.receiver ?? 0), r.count, `count of ${r.item} must equal its platform + receiver shares`);
  }
  return bill;
}

// Item weights in kg (game value / 1000, contract section 2) for the items a rocket lifts to the platform. The harness
// re-checks each against prototypes.item[name].weight in the native run; a mismatch fails the run.
export const WEIGHT_KG = {'space-platform-foundation': 20, 'asteroid-collector': 100, crusher: 100, 'assembling-machine-2': 20, 'electric-furnace': 20,
  'fast-inserter': 20, 'solar-panel': 20, accumulator: 20, 'constant-combinator': 20, 'arithmetic-combinator': 20, 'decider-combinator': 20,
  'space-platform-starter-pack': 1000};
export const ROCKET_LIFT_KG = 1000;

/** Rockets needed to lift the platform part of the kit: the starter pack flies alone, then the platform request in full rockets. */
export function launchPlan(bill) {
  const platformRequest = Object.fromEntries(bill.items.filter(r => r.platform > 0).map(r => [r.item, r.platform]));
  for (const n of Object.keys(platformRequest)) assert(WEIGHT_KG[n] > 0, 'no inline weight for ' + n);
  const platformRequestKg = Object.entries(platformRequest).reduce((a, [n, c]) => a + WEIGHT_KG[n] * c, 0);
  const cargoRockets = Math.ceil(platformRequestKg / ROCKET_LIFT_KG);
  const starterPackRockets = bill.items.some(r => r.item === 'space-platform-starter-pack' && r.count > 0) ? 1 : 0;
  return {platformRequest, platformRequestKg, rocketLiftKg: ROCKET_LIFT_KG, cargoRockets, starterPackRockets, totalRockets: cargoRockets + starterPackRockets,
    wholeRockets: platformRequestKg % ROCKET_LIFT_KG === 0,
    weightKg: Object.fromEntries(Object.keys({...platformRequest, ...(starterPackRockets ? {'space-platform-starter-pack': 1} : {})}).sort().map(n => [n, WEIGHT_KG[n]])),
    note: 'Only the platform shares fly: the silo, the pad and the receiver items stay on the ground, and the spares stay in the chests. Rockets leave only full (1,000 kg), so a request that is not a whole number of rockets leaves the remainder unbuilt.'};
}

/** Whole-kit demand from the bill down to the supplied materials (recipe expansion from the dump). */
export function kitDemand(raw, bill) {
  const external = {}, crafts = {};
  const expand = (item, n) => {
    if (BOUNDARY.includes(item)) { external[item] = (external[item] || 0) + n; return; }
    const r = raw.recipe[item]; assert(r, 'missing recipe ' + item);
    const out = r.results.find(p => p.name === item).amount;
    crafts[item] = (crafts[item] || 0) + n / out;
    for (const i of r.ingredients) expand(i.name, n * i.amount / out);
  };
  for (const r of bill.items) if (r.cap > 0) expand(r.item, r.cap);
  const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6]));
  return {externalPerKit: round(external), craftsPerKit: round(crafts), recipeIngredients: Object.fromEntries(Object.keys(crafts).sort().map(n => [n, raw.recipe[n].ingredients]))};
}

/** The manifest's `measured` block, derived only from a full-protocol native report. */
export function measuredFromReport(report) {
  const r = report.builds[0], f = r.fill || {};
  const list = x => Array.isArray(x) ? x : Object.values(x || {});
  const round = (n, d = 2) => n == null ? null : Math.round(n * 10 ** d) / 10 ** d;
  return {
    passed: report.passed, kitMinutes: round(f.kitMinutes), refillMinutes: round(r.refill?.minutes),
    completion: list(f.order).map(item => ({item, minute: round(f.completedMinute[item])})),
    entrances: (r.entrances || []).map(e => ({item: e.item, perMinute: e.perMinute, perKit: e.perKit, measuredPerKit: e.measuredPerKit, consumedPerKit: e.consumedPerKit, consumedRatio: e.consumedRatio, rule: e.rule, ratio: e.ratio, averageDrawPerMinute: e.averageDrawPerMinute, peakMinuteDraw: e.peakMinuteDraw})),
    idleStockAtKit: f.idleStock ? {ring: f.idleStock.ring, machineOutputs: f.idleStock.machineOutputs, fluids: Object.fromEntries(Object.entries(f.idleStock.fluids || {}).map(([k, v]) => [k, round(v, 1)]))} : null,
    refillDoneMinute: Object.fromEntries(Object.entries(r.refill?.doneMinute || {}).map(([k, v]) => [k, round(v)])),
    ringMaxStock: r.ringOverall?.maxStock, failures: r.failures || []};
}

export function build(raw, bill, tweak = {}) {
  const CAP = Object.fromEntries(bill.items.map(r => [r.item, r.cap]));
  const KIT = bill.items.map(r => r.item);
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
  const wire = (a, b, ac = 1, bc = 1) => { const d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y); assert(d <= 8.01, `wire too long ${a.name}#${a.entity_number} ${b.name}#${b.entity_number} ${d.toFixed(2)}`); wires.push([a.entity_number, ac, b.entity_number, bc]); };
  // An arm's direction is the side it picks up from.
  const arm = (x, y, from, o = {}) => add(o.name || 'fast-inserter', x, y, {direction: from, override_stack_size: o.name === 'bulk-inserter' ? 2 : 1, ...(o.items ? filters(o.items) : {}), ...(o.cb ? {control_behavior: o.cb} : {})});
  const machines = [];
  const machine = (recipe, x0, y0, o = {}) => {
    const name = o.name || 'assembling-machine-2';
    const e = place({entity_number: next++, name, position: {x: x0 + 1.5, y: y0 + 1.5}, ...(o.direction ? {direction: o.direction} : {}), recipe, ...(o.cb ? {control_behavior: o.cb} : {})});
    machineCounts[recipe] = (machineCounts[recipe] || 0) + 1;
    machines.push({recipe, entity: e.entity_number, e}); return e;
  };
  const combinator = (name, x, y, control_behavior, vertical = true) => place({entity_number: next++, name, position: vertical ? {x: x + .5, y: y + 1} : {x: x + 1, y: y + .5}, direction: vertical ? 0 : 4, control_behavior});

  // ---------------------------------------------------------------- ring
  // A dented rectangle: top row 0 east, column 34 south past the small chests, row 10 west,
  // column 30 south past the exact machines, row 26 west, column 3 north.
  // Iron-chain limits (iron, gear, pipe, engine, electric engine) are kept low: whatever sits there when the kit is
  // complete is iron drawn but not used, and the iron entrance has the smallest margin of all.
  const L = {iron: 12, 'steel-plate': 24, 'copper-plate': 8, 'electronic-circuit': 16, 'plastic-bar': 28, concrete: 16, 'stone-brick': 4,
    'iron-gear-wheel': 4, pipe: 4, 'copper-cable': 24, 'engine-unit': 3, 'advanced-circuit': 6, 'processing-unit': 6, 'electric-engine-unit': 4,
    'low-density-structure': 6, 'space-platform-foundation': 6, ...(tweak.limits || {})};
  L['iron-plate'] = L.iron; delete L.iron;
  const FINAL_LIMIT = tweak.finalLimit ?? 2;
  const RING_FINALS = KIT.filter(i => !EXACT.includes(i) && i !== 'space-platform-foundation');
  for (const p of RING_FINALS) L[p] = FINAL_LIMIT;
  const GEAR_IRON_RESERVE = tweak.gearIronReserve ?? 10, PIPE_IRON_RESERVE = tweak.pipeIronReserve ?? 2;
  // Layouts: 'narrow' (32 x 27, published), 'compact' (33 x 27) and 'wide' (37 x 27), the last two kept in history/.
  const layoutName = tweak.layout ?? 'narrow';
  const compact = layoutName !== 'wide', narrow = layoutName === 'narrow';
  const EC = narrow ? 31 : compact ? 32 : 36;  // east chest column
  const RS = EC - 2, RX = EC - 6;          // ring column past the small chests, ring column past the exact machines
  if (narrow) L.inserter = 4;
  const waypoints = [[3, 0], [RS, 0], [RS, 10], [RX, 10], [RX, 26], [3, 26]];
  const ringTiles = [];
  for (let i = 0; i < waypoints.length; i++) {
    const [x0, y0] = waypoints[i], [x1, y1] = waypoints[(i + 1) % waypoints.length];
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    for (let x = x0, y = y0; x !== x1 || y !== y1; x += dx, y += dy) ringTiles.push([x, y]);
  }
  const dirOf = (a, b) => b[0] > a[0] ? E : b[0] < a[0] ? W : b[1] > a[1] ? S : N;
  const loop = ringTiles.map((t, i) => belt(t[0], t[1], dirOf(t, ringTiles[(i + 1) % ringTiles.length])));
  for (const e of loop) e.control_behavior = {circuit_read_hand_contents: true, circuit_contents_read_mode: 1};
  for (let i = 0; i < loop.length; i++) wire(loop[i], loop[(i + 1) % loop.length]);
  const ringAt = (x, y) => { const e = at(x, y); assert(e && loop.includes(e), `no ring tile at ${x},${y}`); return e; };
  const controlled = [], reserveArms = [], capGated = [], greenRelays = [], ringGatedInputs = [];
  // Arm next to the ring: the ring tile it touches is the pickup or drop tile.
  const touch = (e) => { const v = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]}[e.direction]; const far = e.name === 'long-handed-inserter' ? 2 : 1;
    const p = [Math.floor(e.position.x), Math.floor(e.position.y)]; const pick = [p[0] + v[0] * far, p[1] + v[1] * far], drop = [p[0] - v[0] * far, p[1] - v[1] * far];
    const r = [pick, drop].map(q => at(...q)).find(t => t && loop.includes(t)); assert(r, 'arm not at the ring ' + e.entity_number); return r; };
  const ringOut = (x, y, from, item) => { const e = arm(x, y, from, {items: [item], cb: cond(item, '<', L[item])}); wire(e, touch(e)); controlled.push(e.entity_number); return e; };
  const ringIn = (x, y, from, items, o = {}) => {
    const e = arm(x, y, from, {items, name: o.name});
    if (o.reserve !== undefined) { e.control_behavior = cond(items[0], '>', o.reserve); wire(e, touch(e)); reserveArms.push({entity: e.entity_number, item: items[0], reserve: o.reserve}); }
    if (o.cap) { e.control_behavior = cond(o.cap, '<', 0); wire(e, touch(e)); capGated.push({entity: e.entity_number, product: o.cap, ring: true}); }
    if (o.below) { e.control_behavior = cond(o.below, '<', L[o.below]); wire(e, touch(e)); ringGatedInputs.push({entity: e.entity_number, item: o.below, comparator: '<', limit: L[o.below]}); }
    if (o.reserve === undefined && !o.cap && !o.below) greenRelays.push(e);
    return e;
  };
  const plain = (x, y, from, items, o = {}) => { const e = arm(x, y, from, {items, name: o.name}); if (o.relay !== false) greenRelays.push(e); return e; };

  // ---------------------------------------------------------------- west entrances
  const panelsWanted = [];
  const input = (item, entrance, extra = {}) => { const p = {kind: 'input', label: item, items: [item], item, entity: entrance.entity_number, x: entrance.position.x, y: entrance.position.y, position: entrance.position, externalSide: 'west', direction: 4, ...extra}; ports.push(p); panelsWanted.push([item, p]); return p; };
  const fluidIn = (item, pipe) => { const p = {kind: 'fluid', label: item, items: [item], item, entity: pipe.entity_number, x: pipe.position.x, y: pipe.position.y, position: pipe.position, externalSide: 'west'}; ports.push(p); panelsWanted.push([item, p]); return p; };
  const admissions = {};
  const simpleEntrance = (item, y) => { const e = belt(0, y, E); belt(1, y, E); const a = ringOut(2, y, W, item); admissions[item] = [a.entity_number]; input(item, e, {staticStorage: 2 * 8 + L[item]}); };
  simpleEntrance('concrete', 0);
  simpleEntrance('plastic-bar', 2);
  simpleEntrance('iron-plate', 4);
  simpleEntrance('stone-brick', 6);
  // Fluid pipes per fluid (for the declared static storage of each fluid entrance).
  const fluidPipes = {};
  const pipesSince = (fluid, first) => { fluidPipes[fluid] = entities.filter(e => e.entity_number >= first && /^pipe/.test(e.name)); };
  // Sulfuric acid: to the battery plant (8,5) and the processing-unit machine (20,21).
  {
    const first = next;
    const p = add('pipe', 0, 8); fluidIn('sulfuric-acid', p);
    add('pipe-to-ground', 1, 8, {direction: W}); add('pipe-to-ground', 8, 8, {direction: E});
    for (const [x, y] of [[9, 8], [9, 7], [9, 6], [9, 5], [8, 5]]) add('pipe', x, y);
    add('pipe-to-ground', 10, 8, {direction: W}); add('pipe-to-ground', 19, 8, {direction: E}); add('pipe', 20, 8);
    add('pipe-to-ground', 20, 9, {direction: N}); add('pipe-to-ground', 20, 17, {direction: S});
    add('pipe-to-ground', 20, 18, {direction: N}); add('pipe-to-ground', 20, 21, {direction: S});
    pipesSince('sulfuric-acid', first);
  }
  // Lubricant: to the electric-engine machine's south input (11,5).
  {
    const first = next;
    const p = add('pipe', 0, 10); fluidIn('lubricant', p);
    add('pipe-to-ground', 1, 10, {direction: W}); add('pipe-to-ground', 11, 10, {direction: E});
    for (const [x, y] of [[12, 10], [12, 9], [12, 8], [12, 7], [12, 6], [12, 5], [11, 5]]) add('pipe', x, y);
    pipesSince('lubricant', first);
  }
  // Copper: ring share at (2,17), then under the ring to the copper lane on row 19 (both lanes copper).
  {
    const e = belt(0, 17, E); belt(1, 17, S); belt(1, 18, E);
    admissions['copper-plate'] = [ringOut(2, 17, W, 'copper-plate').entity_number];
    add('fast-underground-belt', 2, 18, {direction: E, type: 'input'}); add('fast-underground-belt', 4, 18, {direction: E, type: 'output'});
    belt(5, 18, S); for (let x = 5; x <= (compact ? 13 : 12); x++) belt(x, 19, E);
    input('copper-plate', e);
  }
  // Steel (north lane) and electronic circuits (south lane) side-load onto the lane belt on row 20.
  {
    const e = belt(0, 19, E); belt(1, 19, S);
    admissions['steel-plate'] = [ringOut(2, 19, W, 'steel-plate').entity_number];
    input('steel-plate', e);
    belt(1, 20, E); add('fast-underground-belt', 2, 20, {direction: E, type: 'input'}); add('fast-underground-belt', 4, 20, {direction: E, type: 'output'});
    for (let x = 5; x <= (narrow ? 20 : compact ? 21 : 25); x++) belt(x, 20, E);
    const c = belt(0, 25, E); belt(1, 25, N); for (let y = 24; y >= 21; y--) belt(1, y, N);
    admissions['electronic-circuit'] = [ringOut(2, 22, W, 'electronic-circuit').entity_number];
    input('electronic-circuit', c);
  }

  // ---------------------------------------------------------------- top row of machines (ring row 0, arms row 1)
  machine('iron-gear-wheel', 4, 2); ringIn(4, 1, N, ['iron-plate'], {reserve: GEAR_IRON_RESERVE}); ringOut(5, 1, S, 'iron-gear-wheel');
  // The engine and electric-engine machines load ingredients only while their product is below its ring limit, so
  // they stop with an empty output instead of a full one when the kit is complete (spare engines are spare iron).
  const gateChain = tweak.gateChain ?? true;
  machine('engine-unit', 7, 2); ringIn(7, 1, N, ['steel-plate', 'pipe', 'iron-gear-wheel'], gateChain ? {below: 'engine-unit'} : {}); ringOut(8, 1, S, 'engine-unit');
  machine('electric-engine-unit', 10, 2, {direction: S}); ringIn(10, 1, N, ['electronic-circuit', 'engine-unit'], gateChain ? {below: 'electric-engine-unit'} : {}); ringOut(11, 1, S, 'electric-engine-unit');
  // AM1 runs only while the AM2 chest deficit exceeds the AM1s already made (in AM1's output and AM2's input):
  // both machines read their contents onto a local red network, an arithmetic combinator turns the AM1 count
  // into the AM2 signal for the AM1 ingredient arm, whose green side carries the AM2 chest deficit.
  const am1 = machine('assembling-machine-1', 13, 2, {cb: {read_contents: true}});
  const am1Arm = arm(13, 1, N, {items: ['electronic-circuit', 'iron-gear-wheel'], cb: cond('assembling-machine-2', '<', 0)});
  capGated.push({entity: am1Arm.entity_number, product: 'assembling-machine-2', ring: false, pipeline: true});
  plain(16, 3, W, ['assembling-machine-1']);
  const am2 = machine('assembling-machine-2', 17, 2, {cb: {read_contents: true}});
  const am1Count = combinator('arithmetic-combinator', 14, 5, {arithmetic_conditions: {first_signal: itemSignal('assembling-machine-1'), second_constant: 1, operation: '*', output_signal: itemSignal('assembling-machine-2')}}, false);
  wire(am1, am2); wire(am1Count, am1, 1, 1); wire(am1Count, am1Arm, 3, 1);
  // Iron goes in by its own arm, one craft at a time (iron-plate < 9 on the machines' red network), so the AM1
  // machine never holds more than one craft of iron while it waits for gears (it held 27 spare iron before).
  const am1Iron = raw.recipe['assembling-machine-1'].ingredients.find(i => i.name === 'iron-plate').amount;
  const am1IronArm = arm(14, 1, N, {items: ['iron-plate'], cb: cond('iron-plate', '<', am1Iron)}); wire(am1IronArm, am1);
  const am1Pipeline = {arm: am1Arm.entity_number, combinator: am1Count.entity_number, ironArm: am1IronArm.entity_number, ironPerCraft: am1Iron, machines: [am1.entity_number, am2.entity_number]};
  ringIn(17, 1, N, ['steel-plate', 'electronic-circuit', 'iron-gear-wheel'], {cap: 'assembling-machine-2'}); ringOut(18, 1, S, 'assembling-machine-2');
  if (narrow) {
    // Inserters reach the fast-inserter machine over the ring (no hand-off column).
    machine('inserter', 20, 2); ringIn(20, 1, N, ['electronic-circuit', 'iron-gear-wheel', 'iron-plate'], {cap: 'fast-inserter'}); ringOut(21, 1, S, 'inserter');
    machine('fast-inserter', 23, 2); ringIn(23, 1, N, ['electronic-circuit', 'iron-plate', 'inserter'], {cap: 'fast-inserter'}); ringOut(24, 1, S, 'fast-inserter');
  } else {
    machine('inserter', 20, 2); ringIn(20, 1, N, ['electronic-circuit', 'iron-gear-wheel', 'iron-plate'], {cap: 'fast-inserter'}); plain(23, 3, W, ['inserter']);
    machine('fast-inserter', 24, 2); ringIn(24, 1, N, ['electronic-circuit', 'iron-plate'], {cap: 'fast-inserter'}); ringOut(25, 1, S, 'fast-inserter');
  }
  if (compact) {
    const px = RS - 3;
    machine('pipe', px, 2); ringIn(px, 1, N, ['iron-plate'], {reserve: PIPE_IRON_RESERVE}); ringOut(px + 1, 1, S, 'pipe');
    // The dent under the small-chest column: substation, ring row 10 below it.
    machine('substation', px, 6); ringIn(px, 9, S, ['steel-plate', 'advanced-circuit', 'copper-cable'], {cap: 'substation'}); ringOut(px + 1, 9, N, 'substation');
  } else {
    machine('substation', 27, 2); ringIn(27, 1, N, ['steel-plate', 'advanced-circuit', 'copper-cable'], {cap: 'substation'}); ringOut(28, 1, S, 'substation');
    machine('steel-chest', 31, 2); ringIn(31, 1, N, ['steel-plate'], {cap: 'passive-provider-chest'}); plain(32, 5, N, ['steel-chest']);
    machine('passive-provider-chest', 31, 6); ringIn(31, 9, S, ['electronic-circuit', 'advanced-circuit'], {cap: 'passive-provider-chest'}); ringOut(32, 9, N, 'passive-provider-chest');
  }
  // ---------------------------------------------------------------- west column of machines (ring column 3, arms column 4)
  machine('battery', 5, 5, {name: 'chemical-plant', direction: E}); ringIn(4, 6, W, ['iron-plate', 'copper-plate'], {cap: 'accumulator'}); plain(6, 8, N, ['battery']);
  machine('accumulator', 5, 9); ringIn(4, 9, W, ['iron-plate'], {cap: 'accumulator'}); ringOut(4, 10, E, 'accumulator');
  machine('solar-panel', 5, 12); ringIn(4, 12, W, ['steel-plate', 'electronic-circuit', 'copper-plate'], {cap: 'solar-panel'}); ringOut(4, 13, E, 'solar-panel');
  if (compact) {
    // Steel chest in the middle, fed from the steel lane by a long arm, straight into the provider-chest machine.
    machine('passive-provider-chest', 5, 15); ringIn(4, 15, W, ['electronic-circuit', 'advanced-circuit'], {cap: 'passive-provider-chest'}); ringOut(4, 16, E, 'passive-provider-chest');
    machine('steel-chest', 9, 15);
    const scArm = arm(10, 18, S, {name: 'long-handed-inserter', items: ['steel-plate'], cb: cond('passive-provider-chest', '<', 0)});
    capGated.push({entity: scArm.entity_number, product: 'passive-provider-chest', ring: false});
    plain(8, 16, E, ['steel-chest']);
  } else {
    machine('electric-furnace', 5, 15); ringIn(4, 15, W, ['steel-plate', 'advanced-circuit', 'stone-brick'], {cap: 'electric-furnace'}); ringOut(4, 16, E, 'electric-furnace');
  }
  // ---------------------------------------------------------------- east column inside (ring column RX, arms column RX - 1)
  {
    const ax = RX - 1, mx = RX - 4, rows = compact ? [10, 13, 16, 19] : [11, 14, 17];
    const list = ['decider-combinator', 'arithmetic-combinator', 'constant-combinator', ...(compact ? ['electric-furnace'] : [])];
    for (const [i, item] of list.entries()) {
      const y = rows[i];
      machine(item, mx, y);
      ringIn(ax, y, E, item === 'electric-furnace' ? ['steel-plate', 'advanced-circuit', 'stone-brick'] : ['copper-cable', 'electronic-circuit'], {cap: item});
      ringOut(ax, y + 1, W, item);
    }
  }
  // ---------------------------------------------------------------- bottom row (lanes on rows 19/20, arms row 21, ring row 26, arms row 25)
  machine('low-density-structure', 4, 22);
  plain(5, 21, N, ['copper-plate'], {name: 'long-handed-inserter'}); plain(6, 21, N, ['copper-plate'], {name: 'long-handed-inserter'});
  ringIn(4, 25, S, ['steel-plate', 'plastic-bar']); ringOut(5, 25, N, 'low-density-structure');
  const foundation = machine('space-platform-foundation', 7, 22);
  plain(7, 21, N, ['steel-plate']); plain(8, 21, N, ['steel-plate']);
  const foundationCableArm = arm(10, 23, E, {items: ['copper-cable'], cb: cond(null, '>', 0, virtual('signal-F'))});
  ringOut(7, 25, N, 'space-platform-foundation');
  machine('copper-cable', 11, 22);
  plain(11, 21, N, ['copper-plate'], {name: 'long-handed-inserter'}); plain(12, 21, N, ['copper-plate'], {name: 'long-handed-inserter'}); plain(13, 21, N, ['copper-plate'], {name: 'long-handed-inserter'});
  plain(14, 23, W, ['copper-cable']); ringOut(11, 25, N, 'copper-cable');
  machine('advanced-circuit', 15, 22);
  plain(15, 21, N, ['electronic-circuit']); ringIn(15, 25, S, ['plastic-bar']); ringOut(16, 25, N, 'advanced-circuit'); plain(18, 23, W, ['advanced-circuit']);
  machine('processing-unit', 19, 22);
  plain(19, 21, N, ['electronic-circuit']); if (!narrow) plain(21, 21, N, ['electronic-circuit']); ringOut(19, 25, N, 'processing-unit');
  if (narrow) ringIn(20, 25, S, ['advanced-circuit']);
  if (narrow) {
    // The second advanced-circuit machine puts its circuits on the ring; the processing-unit machine takes them there.
    machine('advanced-circuit', 22, 22); ringIn(22, 25, S, ['plastic-bar', 'copper-cable']); ringIn(23, 25, S, ['electronic-circuit']); ringOut(24, 25, N, 'advanced-circuit');
  } else machine('advanced-circuit', 23, 22);
  if (narrow) {}
  else if (compact) { ringIn(23, 25, S, ['plastic-bar', 'copper-cable']); ringIn(24, 25, S, ['electronic-circuit']); }
  else { plain(24, 21, N, ['electronic-circuit']); ringIn(23, 25, S, ['plastic-bar', 'copper-cable']); }
  if (!narrow) plain(22, 23, E, ['advanced-circuit']);
  if (!compact) { machine('pipe', 26, 22); ringIn(26, 25, S, ['iron-plate'], {reserve: PIPE_IRON_RESERVE}); ringOut(27, 25, N, 'pipe'); }

  // ---------------------------------------------------------------- east: chests, cap combinator, exact machines
  const outputs = [], chestArms = [], chests = [];
  const capComb = add('constant-combinator', EC, 11, {direction: 0, control_behavior: {sections: {sections: [{index: 1, filters: KIT.map((item, i) => ({index: i + 1, type: 'item', name: item, quality: 'normal', comparator: '=', count: -CAP[item]}))}]}}});
  const outputPort = (item, chest, armEntity) => { const p = {kind: 'output', label: item, items: [item], item, entity: chest.entity_number, x: chest.position.x, y: chest.position.y, position: chest.position, externalSide: 'east', cap: CAP[item], arm: armEntity.entity_number}; ports.push(p); outputs.push(p); };
  const SMALL_ORDER = ['space-platform-foundation', 'solar-panel', 'fast-inserter', 'assembling-machine-2', 'electric-furnace', 'accumulator', 'constant-combinator', 'arithmetic-combinator', 'decider-combinator', 'passive-provider-chest', 'substation'];
  for (const [y, item] of SMALL_ORDER.entries()) {
    const a = arm(EC - 1, y, W, {items: [item], cb: item === 'space-platform-foundation' ? cond(null, '>', 0, virtual('signal-C')) : cond(item, '<', 0)});
    const c = add('passive-provider-chest', EC, y);
    wire(a, c, 2, 2); chestArms.push(a.entity_number); chests.push(c.entity_number); outputPort(item, c, a);
  }
  const exactSpec = {}, latches = [];
  const EXACT_ROWS = {'rocket-silo': 12, crusher: 15, 'asteroid-collector': 18, 'space-platform-starter-pack': 21, 'cargo-landing-pad': 24};
  const X = EC - 4, A = EC - 5;  // exact machines' west column and their west arms
  const EXACT_ARMS = {
    'rocket-silo': [[X, 11, N, 'steel-plate'], [X + 1, 11, N, 'concrete'], [X + 2, 11, N, 'pipe'], [A, 12, W, 'processing-unit'], [A, 13, W, 'electric-engine-unit']],
    crusher: [[A, 15, W, 'low-density-structure'], [A, 16, W, 'steel-plate'], [A, 17, W, 'electric-engine-unit']],
    'asteroid-collector': [[A, 18, W, 'low-density-structure'], [A, 19, W, 'electric-engine-unit'], [A, 20, W, 'processing-unit']],
    'space-platform-starter-pack': [[A, 21, W, 'space-platform-foundation'], [A, 22, W, 'steel-plate'], [A, 23, W, 'processing-unit']],
    'cargo-landing-pad': [[A, 24, W, 'concrete'], [A, 25, W, 'steel-plate'], [A, 26, W, 'processing-unit']]};
  // East-column placement of each exact machine's output row and latch decider (vertical, top tile).
  const EXACT_OUT = compact ? {'rocket-silo': 13, crusher: 16, 'asteroid-collector': 19, 'space-platform-starter-pack': 21, 'cargo-landing-pad': 24} : null;
  const EXACT_DEC = compact ? {'rocket-silo': [EC - 1, 11], crusher: [EC - 1, 14], 'asteroid-collector': [EC - 1, 17], 'space-platform-starter-pack': [EC, 22], 'cargo-landing-pad': [EC - 1, 22]} : null;
  let spMachine;
  for (const product of EXACT) {
    const y0 = EXACT_ROWS[product];
    const m = machine(product, X, y0, {cb: {read_contents: true}});
    if (product === 'space-platform-starter-pack') spMachine = m;
    const recipe = raw.recipe[product];
    const amount = Object.fromEntries(recipe.ingredients.map(i => [i.name, i.amount]));
    assert.deepEqual(Object.keys(amount).sort(), EXACT_ARMS[product].map(a => a[3]).sort(), 'exact arms for ' + product);
    const ingredientArms = EXACT_ARMS[product].map(([x, y, from, item]) => { const a = arm(x, y, from, {items: [item], cb: cond(item, '<', amount[item])}); wire(a, m); return {entity: a.entity_number, item, amount: amount[item]}; });
    const outY = EXACT_OUT ? EXACT_OUT[product] : y0 + 1;
    const out = arm(EC - 1, outY, W, {items: [product], cb: {circuit_read_hand_contents: true, circuit_hand_read_mode: 1}}); wire(out, m);
    const chest = add('passive-provider-chest', EC, outY); chests.push(chest.entity_number); outputPort(product, chest, out);
    const [dx0, dy0] = EXACT_DEC ? EXACT_DEC[product] : [EC - 1, y0 - 1];
    const d = combinator('decider-combinator', dx0, dy0, {decider_conditions: {conditions: [{first_signal: itemSignal(product), comparator: '≥', constant: 0}],
      outputs: recipe.ingredients.map(i => ({signal: itemSignal(i.name), copy_count_from_input: false, constant: 100000}))}});
    wire(d, m, 1, 1); wire(d, m, 3, 1); wire(d, chest, 2, 2);
    latches.push({product, machine: m.entity_number, decider: d.entity_number, outputArm: out.entity_number, chest: chest.entity_number, ingredientArms, block: 100000});
  }
  // Silo reserves: the silo's processing-unit and electric-engine arms load only while the ring holds
  // more than a reserve of that item, so the silo (first on the ring) leaves enough for the smaller
  // exact finals. One decider per item reads the ring and writes a block onto the silo's network.
  const siloLatch = latches.find(l => l.product === 'rocket-silo');
  const siloMachine = entities.find(e => e.entity_number === siloLatch.machine);
  const SILO_RESERVE = {'processing-unit': tweak.puReserve ?? 2, 'electric-engine-unit': tweak.eeReserve ?? 2};
  const siloReserves = [];
  for (const [item, reserve, at, ringTile] of [['processing-unit', SILO_RESERVE['processing-unit'], compact ? [RS - 7, 8] : [EC, 14], [RS, 10]], ['electric-engine-unit', SILO_RESERVE['electric-engine-unit'], compact ? [RS - 7, 9] : [EC, 17], compact ? [RX, 10] : [RX, 18]]]) {
    const d = combinator('decider-combinator', at[0], at[1], {decider_conditions: {conditions: [{first_signal: itemSignal(item), comparator: '≤', constant: reserve, first_signal_networks: {red: true, green: false}}],
      outputs: [{signal: itemSignal(item), copy_count_from_input: false, constant: 100000}]}}, !compact);
    wire(d, ringAt(...ringTile), 1, 1); wire(d, siloMachine, 3, 1);
    siloReserves.push({item, reserve, decider: d.entity_number, block: 100000});
  }
  // Green cap chain down the chest column.
  const chestEntities = chests.map(id => entities.find(e => e.entity_number === id)).sort((a, b) => a.position.y - b.position.y);
  for (let i = 1; i < chestEntities.length; i++) wire(chestEntities[i - 1], chestEntities[i], 2, 2);
  wire(capComb, chestEntities.find(c => c.position.y === 10.5), 2, 2);
  // Foundation gate: the foundation machine's cable arm runs while the foundation chest is below its cap
  // or the starter-pack machine still lacks foundation (its local red network reads below 60).
  const spLatch = latches.find(l => l.product === 'space-platform-starter-pack');
  const spChest = entities.find(e => e.entity_number === spLatch.chest);
  const spFoundation = raw.recipe['space-platform-starter-pack'].ingredients.find(i => i.name === 'space-platform-foundation').amount;
  const fGate = combinator('decider-combinator', EC, compact ? 17 : 20, {decider_conditions: {conditions: [
    {first_signal: itemSignal('space-platform-foundation'), comparator: '<', constant: 0, first_signal_networks: {red: false, green: true}},
    {first_signal: itemSignal('space-platform-foundation'), comparator: '<', constant: spFoundation, first_signal_networks: {red: true, green: false}, compare_type: 'or'}],
    outputs: [{signal: virtual('signal-F'), copy_count_from_input: false, constant: 1}]}});
  const spOut = entities.find(e => e.entity_number === spLatch.outputArm);
  const spNear = g => !compact ? spMachine : [spMachine, spOut].sort((a, b) => Math.hypot(a.position.x - g.position.x, a.position.y - g.position.y) - Math.hypot(b.position.x - g.position.x, b.position.y - g.position.y))[0];
  const nearestChest = g => !compact ? spChest : chestEntities.slice().sort((a, b) => Math.hypot(a.position.x - g.position.x, a.position.y - g.position.y) - Math.hypot(b.position.x - g.position.x, b.position.y - g.position.y))[0];
  wire(fGate, spNear(fGate), 1, 1); wire(fGate, nearestChest(fGate), 2, 2); wire(fGate, nearestChest(fGate), 4, 2);
  // Foundation first to the starter pack: the foundation chest arm runs while that chest is below its cap
  // AND the starter-pack machine already holds its 60 foundation (or is latched).
  const cGate = combinator('decider-combinator', EC, compact ? 14 : 23, {decider_conditions: {conditions: [
    {first_signal: itemSignal('space-platform-foundation'), comparator: '<', constant: 0, first_signal_networks: {red: false, green: true}},
    {first_signal: itemSignal('space-platform-foundation'), comparator: '≥', constant: spFoundation, first_signal_networks: {red: true, green: false}, compare_type: 'and'}],
    outputs: [{signal: virtual('signal-C'), copy_count_from_input: false, constant: 1}]}});
  wire(cGate, spNear(cGate), 1, 1); wire(cGate, nearestChest(cGate), 2, 2); wire(cGate, nearestChest(cGate), 4, 2);
  capGated.push({entity: foundationCableArm.entity_number, product: 'space-platform-foundation', signal: 'signal-F', ring: false});

  // ---------------------------------------------------------------- green relays to every cap-gated arm
  {
    const byId = id => entities.find(e => e.entity_number === id);
    const net = [capComb, ...chestEntities, ...chestArms.map(byId)];
    const targets = capGated.map(c => byId(c.entity));
    const relays = [...greenRelays];
    const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
    const inNet = new Set(net.map(e => e.entity_number));
    for (const t of targets.sort((a, b) => (b.position.x + b.position.y) - (a.position.x + a.position.y))) {
      if (inNet.has(t.entity_number)) continue;
      // Shortest path (by hops, then length) from the network through relays and targets to t.
      const nodes = [...new Map([...net, ...relays, ...targets].map(e => [e.entity_number, e])).values()];
      const prevOf = new Map(), seen = new Set(), queue = [];
      for (const e of nodes) if (inNet.has(e.entity_number)) { queue.push(e); seen.add(e.entity_number); }
      let found = false;
      while (queue.length && !found) {
        const a = queue.shift();
        const cands = nodes.filter(b => !seen.has(b.entity_number) && dist(a, b) <= 7.5).sort((p, q) => dist(a, p) - dist(a, q));
        for (const b of cands) { seen.add(b.entity_number); prevOf.set(b.entity_number, a); queue.push(b); if (b === t) { found = true; break; } }
      }
      assert(found, 'green chain cannot reach ' + t.entity_number);
      for (let b = t; !inNet.has(b.entity_number); b = prevOf.get(b.entity_number)) { const a = prevOf.get(b.entity_number); wire(a, b, 2, 2); inNet.add(b.entity_number); net.push(b); }
    }
  }
  const greenRelayIds = [...new Set(wires.filter(w => w[1] === 2 && w[3] === 2).flatMap(w => [w[0], w[2]]))].filter(id => greenRelays.some(e => e.entity_number === id));

  // ---------------------------------------------------------------- panels within 4 tiles of each entrance
  const SPOTS = {concrete: [[0, 1]], 'plastic-bar': [[0, 3]], 'iron-plate': [[0, 5]], 'stone-brick': [[0, 7]], 'sulfuric-acid': [[0, 9]], lubricant: [[0, 11]], 'copper-plate': [[0, 16]], 'steel-plate': [[0, 20]], 'electronic-circuit': [[0, 24]]};
  for (const [item, p] of panelsWanted) {
    const [x, y] = SPOTS[item][0];
    assert(!occupied.has(key(x, y)) && Math.hypot(x - Math.floor(p.x), y - Math.floor(p.y)) <= 4);
    const panel = add('display-panel', x, y, {icon: {type: FLUIDS.includes(item) ? 'fluid' : 'item', name: item}, always_show: true, text: ''});
    p.displayEntity = panel.entity_number;
  }

  // ---------------------------------------------------------------- power inside the rectangle
  const shapeRaw = {...raw, container: {...raw.container, ...raw['logistic-container']}, 'arithmetic-combinator': {...raw['arithmetic-combinator'], ...raw['decider-combinator'], ...raw['constant-combinator']}};
  const before = starterBounds(entities, shapeRaw);
  ports.push({kind: 'power', label: 'External electricity', items: []});
  const layout = {entities, wires, next, place};
  const power = tweak.skipPower ? {substations: 0, mediumPoles: 0} : powerInsideLayout(layout, ports, raw, before, {maxMediumPoles: 4, allow: tweak.powerSpots});
  next = layout.next;
  const footprint = starterBounds(entities, shapeRaw);
  assert.deepEqual(footprint, before, 'power grew the footprint');

  // ---------------------------------------------------------------- fluid static storage
  // What a fluid entrance can take without any craft: every pipe of that fluid plus one input fluid box of each
  // machine whose recipe uses it (volumes from the dump). Fluids are judged on consumed amounts because this
  // is far above 15% of a kit's demand.
  const fluidStorage = {};
  for (const fluid of FLUIDS) {
    const pipes = fluidPipes[fluid].reduce((a, e) => a + raw[e.name][e.name].fluid_box.volume, 0);
    const boxes = machines.filter(m => raw.recipe[m.recipe].ingredients.some(i => i.name === fluid))
      .reduce((a, m) => a + Math.max(...raw['assembling-machine'][m.e.name].fluid_boxes.filter(f => f.production_type === 'input').map(f => f.volume)), 0);
    fluidStorage[fluid] = pipes + boxes;
  }
  // ---------------------------------------------------------------- demand, supply and panel text
  const demand = kitDemand(raw, bill);
  const chainMinutes = Object.fromEntries(Object.entries(demand.craftsPerKit).map(([r, n]) => [r, n * (raw.recipe[r].energy_required ?? .5) / (r === 'battery' ? 1 : .75) / 60 / (machineCounts[r] || 1)]));
  const longestChainMinutes = Math.max(...Object.values(chainMinutes));
  const designMinutes = Math.round(longestChainMinutes * 100) / 100;
  for (const p of ports.filter(p => p.kind === 'input' || p.kind === 'fluid')) {
    p.perKit = Math.round(demand.externalPerKit[p.item] ?? 0);
    p.perMinute = tweak.supply?.[p.item] ?? supplyFor(p.item, demand.externalPerKit[p.item] ?? 0, designMinutes);
    assert(p.perMinute > 0, 'no supply for ' + p.item);
    if (p.kind === 'fluid') p.staticStorage = fluidStorage[p.item];
    const panel = entities.find(e => e.entity_number === p.displayEntity);
    panel.text = `IN: ${p.item}\nWEST · ${Math.round(p.perMinute * 10) / 10}/min · ${p.perKit} per kit`;
  }
  for (const e of entities) e.tags = {...e.tags, flight_science_entity: e.entity_number};

  const capacity = 8 * loop.length, maximumStock = Object.values(L).reduce((a, b) => a + b, 0);
  assert(maximumStock <= .6 * capacity, `ring limits ${maximumStock} exceed 60% of ${capacity}`);
  const machineTotal = Object.values(machineCounts).reduce((a, b) => a + b, 0);
  const description = `Factorio 2.1.24 Space Age. Builds one launch kit and stops: rocket silo, cargo landing pad, space platform starter pack and the white-platform and white-pack-receiver items, each in its own passive provider chest on the east side, capped by one constant combinator (one negative number per item). ${machineTotal} machines (assembling machine 2, one chemical plant for batteries), no modules. WEST inputs, one labelled entrance each: concrete (from the concrete supplier), plastic, iron, stone brick, sulfuric acid, lubricant, copper, steel, electronic circuits (from the green-circuit supplier). Take items out of a chest and exactly those are made again. Preserve the red ring wires, the green cap wires, the five latch deciders and their red wires, the two silo reserve deciders, the foundation-first decider, the foundation gate decider, the AM1 combinator and iron arm wires, and all arm filters and conditions. Supply electricity at the marked substation.`;
  const KIT_ICONS = ['rocket-silo', 'cargo-landing-pad', 'space-platform-starter-pack', 'space-platform-foundation'];
  const bp = {item: 'blueprint', version: 562954249961473, label: LABEL, description, entities, wires, icons: KIT_ICONS.map((name, i) => ({index: i + 1, signal: {type: 'item', name}}))};
  const code = encodeBlueprint({blueprint: bp});

  const machineFor = item => machines.filter(m => m.recipe === item).map(m => m.entity);
  const inputs = ports.filter(p => p.kind === 'input'), fluids = ports.filter(p => p.kind === 'fluid');
  const productSlack = Object.fromEntries(KIT.filter(i => !EXACT.includes(i)).map(i => [i, (L[i] || 0) + 2]));
  const bom = Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length]));
  const manifest = {
    id: ID, name: LABEL, file: ID + '.txt', blueprintSha256: sha(code), prototypeSha256: null,
    class: 'kit', status: 'native-validation-pending',
    products: [...new Set(machines.map(m => m.recipe))].sort(), finals: KIT, targets: {}, outputCaps: CAP,
    bill: {sources: bill.sources, spareRule: bill.spareRule, items: bill.items.map(({item, count, spare, max, cap, platform, receiver}) => ({item, count, spare, cap, max, platform, receiver}))},
    recipeAudit: demand,
    inputs: inputs.map(p => ({...p})), fluids: fluids.map(p => ({...p})), outputs: outputs.map(p => ({...p})), ports,
    machineCounts, machines: machines.map(m => ({recipe: m.recipe, entity: m.entity})),
    finalMachines: Object.fromEntries(KIT.map(i => [i, machineFor(i)])),
    footprint, areaGoal: {goalTiles: 900, stretchTiles: 780, fallbackTiles: 1250, achievedTiles: footprint.width * footprint.height},
    loopControl: [{name: ID + '-ring', reader: loop[0].entity_number, readerMode: 'per-tile-hold', loop: loop.map(e => e.entity_number), controlled, limits: L, capacity, maximumStock, uncountedTiles: [], reserveArms, ringGatedInputs}],
    ringLimitFor: Object.fromEntries(KIT.map(i => [i, L[i] ?? null])),
    productSlack,
    stockControl: {mode: 'chest-condition', combinator: capComb.entity_number, chests, arms: chestArms, caps: CAP, network: 'green', capGatedArms: capGated, greenRelays: greenRelayIds,
      exactLatches: latches, am1Pipeline, siloReserves: {machine: siloMachine.entity_number, deciders: siloReserves}, foundationChestGate: {decider: cGate.entity_number, arm: chestArms[0], signal: 'signal-C'}, foundationGate: {decider: fGate.entity_number, arm: foundationCableArm.entity_number, signal: 'signal-F', starterPackMachine: spMachine.entity_number, starterPackFoundation: spFoundation}},
    admissions,
    supplyRule: {...SUPPLY_RULE, designMinutes, longestChain: Object.entries(chainMinutes).sort((a, b) => b[1] - a[1])[0][0],
      text: 'perMinute = roundUp(headroom x perKit / designMinutes), headroom ' + SUPPLY_RULE.solidHeadroom + ' for belts and ' + SUPPLY_RULE.fluidHeadroom + ' for fluids, at least ' + SUPPLY_RULE.minimum + '; designMinutes is the longest machine chain of this bill; whole numbers at 10 and above, one decimal below.'},
    protocol: {kitLimitMinutes: Math.max(90, Math.ceil(1.5 * longestChainMinutes)), holdMinutes: 15, refillLimitMinutes: 30, longHoldMinutes: 30,
      holdQuietMinutes: 10, longHoldQuietMinutes: 20, perKitTolerance: 1.15,
      perKitRule: 'measuredPerKit (accepted from start to kit completion) <= perKitTolerance x perKit. Where (perKitTolerance - 1) x perKit is smaller than the entrance\'s own static storage (staticStorage on the port: for a belt its dead-end entrance belt, 8 items per tile, plus its ring limit; for a fluid every pipe of that fluid plus one input fluid box of each machine using it) the rule is applied to consumedPerKit (accepted minus what still sits on belts, the ring, machine inputs, arm hands, pipes and fluid boxes at kit completion). With the current layout this applies to stone-brick, lubricant and sulfuric-acid.',
      refill: {'fast-inserter': 'half', 'space-platform-foundation': 50, 'asteroid-collector': 1, 'solar-panel': 'half', 'cargo-landing-pad': 1},
      stragglerLimits: {'processing-unit': 4, 'electric-engine-unit': 4, 'low-density-structure': 4, concrete: 20}},
    construction: bom,
    billOfMaterials: {items: bom},
    launch: launchPlan(bill),
    power: {substations: power.substations, mediumPoles: power.mediumPoles},
    supplierLinks: [],
    setupNotes: [description],
  };
  const top = footprint.top;
  manifest.supplierLinks = [
    {supplier: 'concrete-supplier', item: 'concrete', copies: 1, entranceRowFromTop: Math.floor(inputs.find(p => p.item === 'concrete').y) - top, perMinute: inputs.find(p => p.item === 'concrete').perMinute},
    {supplier: 'green-circuits', item: 'electronic-circuit', copies: 1, entranceRowFromTop: Math.floor(inputs.find(p => p.item === 'electronic-circuit').y) - top, perMinute: inputs.find(p => p.item === 'electronic-circuit').perMinute,
      note: 'One green-circuits copy (360/min) covers the kit and rocket supplies together; split its exit belt between them.'}];
  manifest.setupNotes.push(
    'Feed each west entrance with its labelled material only. Concrete comes from one concrete-supplier and electronic circuits from one green-circuits copy (placed directly west, exit on the entrance row).',
    'Caps live in one constant combinator at the east edge (one negative number per item). Each chest arm runs only while its item is below its cap; the five expensive finals (silo, pad, starter pack, collector, crusher) load exactly one craft at a time behind a latch decider, so they never take a second craft\'s ingredients.',
    'Take items out of a chest and exactly those are made again; nothing else crafts.');
  return {code, manifest, bp};
}

async function main() {
  const out = process.argv[2] || 'blueprint-sources/' + ID;
  const bytes = await fs.readFile(RAW), raw = JSON.parse(bytes);
  const tweak = process.env.LAUNCH_KIT_TWEAK ? JSON.parse(process.env.LAUNCH_KIT_TWEAK) : {};
  // Exploration only: LAUNCH_KIT_BILL=<file> builds from another bill (the published string always uses bill.json).
  const {code, manifest} = build(raw, process.env.LAUNCH_KIT_BILL ? loadBill(process.env.LAUNCH_KIT_BILL) : loadBill(), tweak);
  manifest.prototypeSha256 = sha(bytes);
  await fs.mkdir(out, {recursive: true});
  await fs.mkdir(`.cache/${ID}`, {recursive: true});
  await fs.writeFile(out + '/' + ID + '.txt', code + '\n');
  let report; try { report = JSON.parse(await fs.readFile(out + '/native-report.json')); } catch {}
  if (report && report.builds?.[0]?.blueprintSha256 === manifest.blueprintSha256 && !report.short) {
    manifest.status = report.passed ? 'qualified' : 'native-validation-pending';
    manifest.nativeReport = 'native-report.json';
    manifest.measured = measuredFromReport(report);
  }
  await fs.writeFile(out + '/manifest.json', JSON.stringify([manifest], null, 2) + '\n');
  await writeReadme(out);
  console.log(JSON.stringify({out, footprint: manifest.footprint, area: manifest.areaGoal.achievedTiles, machines: Object.values(manifest.machineCounts).reduce((a, b) => a + b, 0), power: manifest.power, ringStock: manifest.loopControl[0].maximumStock + '/' + manifest.loopControl[0].capacity, blueprintSha256: manifest.blueprintSha256, status: manifest.status}));
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
