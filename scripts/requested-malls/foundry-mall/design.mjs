// Layout and control program of the foundry mall. Pure function of the pinned prototypes, the launch-kit bill
// and a few knobs; generate.mjs writes the published files, validate.mjs and the tests read them back.
//
// Coordinates are tiles; an entity at tile (x, y) has its centre at (x + .5, y + .5); multi-tile entities are placed
// by their top-left tile. North is up. Rows, north to south:
//   -16        calcite belt (west to east, dead end)          -15  stone belt (east to west, exit on the west edge)
//   -14        lava pipe (two underground hops) and the stone and calcite arms of the two lava foundries
//   -13..-9    the two lava foundries (molten copper west, molten iron east), brick furnace in the west pocket,
//              rule bank in the east
//   -8, -7     molten manifold (iron trunk on -8, drops and the copper line on -7), water tank
//   -6..-2     casting band: plate foundry, steel/LDS foundry, circuit machine, cable/copper-plate foundry,
//              circuit machine, gear/pipe/stick/concrete/steel foundry
//   -1         arms between the casting band and the ring
//    0 .. 10   the ring (one closed clockwise loop of red belt, 30 x 11, folded twice at its east end) around the core: two bands of assembling
//              machines 3 (rows 2..4 and 6..8), their arms on rows 1 and 9, hand-off and controller row 5
//   11         arms between the ring and the south band
//   12..16     south band: electric engine machine, lubricant tank, the belt foundry, the output chests, the silo
//              machine, the plastic and tungsten carbide entrances, processing unit machine, battery plant
import assert from 'node:assert/strict';
import { sha, encodeKeeping, distance, envelope, technologyClosure, box, intersects, blueprintVersion } from './lib.mjs';
import { products as productList, route, GROUP_NAMES, KIT_FAST_INSERTERS } from './bill.mjs';

const N = 0, E = 4, S = 8, W = 12;
export const LEVEL = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 };  // priority group -> level signal (higher runs first)
export const WEIGHT = (level, rank) => level * 100000 + rank * 1000;
// Ring stock limits. `arm`: an arm that adds the item to the ring works only while the ring holds fewer (ring reader).
// `rule`: a recipe-switching machine is told to make the item only while ring + switching machines hold fewer.
export const RING_ARM_CAPS = Object.freeze({
  'iron-plate': 20, 'copper-cable': 30, 'electronic-circuit': 30, 'advanced-circuit': 14, 'speed-module': 8, 'processing-unit': 22,
  battery: 6, 'electric-engine-unit': 10, 'engine-unit': 3, 'space-platform-foundation': 8, 'assembling-machine-2': 4, 'assembling-machine-3': 2,
  'plastic-bar': 20, 'tungsten-carbide': 8, 'stone-brick': 10,
});
export const RING_RULE_CAPS = Object.freeze({
  'steel-plate': 20, 'iron-gear-wheel': 20, 'copper-cable': 40, pipe: 8, 'iron-stick': 8, concrete: 16, 'copper-plate': 8, 'low-density-structure': 22, 'refined-concrete': 30,
  'transport-belt': 12, 'underground-belt': 6, splitter: 3, 'fast-transport-belt': 6, 'fast-underground-belt': 6, 'fast-splitter': 3, inserter: 8, 'fast-inserter': 6, 'steel-chest': 1,
});
export const BRICK_STACKS = 5;
export const TANK_READY = 500;          // a fluid counts as present while its tank holds at least this much
export const STALL = Object.freeze({ 'assembling-machine-3': 10800, 'rocket-silo': 7200, U1: 54000, U2: 18000 });  // ticks without progress before a dedicated final stops holding its level, or a switching machine gives up a recipe it cannot start
export const LEVEL_HOLD = 7200;   // ticks a lower level must last before the level in force drops to it
export const IDLE_WEIGHT = 50000, REAL_WEIGHT = 100000;   // a parked machine's recipe signal; every real pick is at or above REAL_WEIGHT
const SIZE = { pump: [1, 2], foundry: 5, 'assembling-machine-3': 3, 'chemical-plant': 3, 'electric-furnace': 3, 'storage-tank': 3, substation: 2 };
const COMBINATORS = ['decider-combinator', 'arithmetic-combinator', 'selector-combinator'];
const item = name => ({ name }), recipe = name => ({ type: 'recipe', name }), fluid = name => ({ type: 'fluid', name }), virtual = name => ({ type: 'virtual', name });
const EACH = virtual('signal-each'), EVERYTHING = virtual('signal-everything');
const networks = n => ({ red: n.includes('R'), green: n.includes('G') });
// One condition atom. nets: 'R', 'G' or 'RG' (which input wires the first signal is read from).
const atom = (signal, nets, comparator, rhs, rhsNets = 'RG') => ({ first_signal: signal, first_signal_networks: networks(nets), comparator, ...(typeof rhs === 'number' ? { constant: rhs } : { second_signal: rhs, second_signal_networks: networks(rhsNets) }) });
// Disjunctive normal form (a list of AND-terms) to the game's flat condition list (AND binds tighter than OR).
const dnf = terms => terms.flatMap((term, t) => term.map((a, i) => ({ ...a, ...(t === 0 && i === 0 ? {} : { compare_type: i === 0 ? 'or' : 'and' }) })));
const whitelist = names => ({ use_filters: true, filter_mode: 'whitelist', filters: names.map((name, i) => ({ index: i + 1, name, quality: 'normal', comparator: '=' })) });

export function design(p, kit, options = {}) {
  assert(/^2\.1\.\d+$/.test(p.gameVersion));
  const PRODUCTS = productList(p, kit);
  const CAPS = Object.fromEntries(PRODUCTS.map(v => [v.key, v.cap]));
  const KIT_SHARE = PRODUCTS.find(v => v.key === KIT_FAST_INSERTERS).cap;
  // the signal that carries a stock's cap in the caps combinator: the item itself, K for the kit's fast inserters
  const capSignal = v => (v.key === KIT_FAST_INSERTERS ? { type: 'virtual', name: 'signal-K' } : { name: v.item });
  const armCaps = { ...RING_ARM_CAPS, ...(options.armCaps || {}) }, ruleCaps = { ...RING_RULE_CAPS, ...(options.ruleCaps || {}) };
  const entities = [], occupied = new Map(), M = { machines: [], arms: [], rules: [], panels: [], relays: [] };
  const sizeOf = (name, direction) => COMBINATORS.includes(name) || name === 'pump' ? ((direction || 0) % 8 === 0 ? [1, 2] : [2, 1]) : [SIZE[name] || 1, SIZE[name] || 1];
  function add(name, x, y, extra = {}) {
    const [w, h] = sizeOf(name, extra.direction);
    const e = { entity_number: entities.length + 1, name, position: { x: x + w / 2, y: y + h / 2 }, ...extra };
    for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) {
      const key = `${x + u},${y + v}`;
      assert(!occupied.has(key), `${name} at ${x},${y} collides with ${occupied.get(key)} at ${key}`);
      occupied.set(key, name);
    }
    entities.push(e); return e;
  }
  const free = (x, y) => !occupied.has(`${x},${y}`);
  // ---- circuit nets: members are joined by a spanning tree at the end ----
  const nets = new Map();
  const RED = 1, GREEN = 2;
  function join(net, color, e, side = 'io') {
    assert(e, 'join ' + net);
    if (!nets.has(net)) nets.set(net, { color, members: [] });
    const n = nets.get(net); assert.equal(n.color, color, net);
    const combinator = COMBINATORS.includes(e.name);
    assert(combinator ? side === 'in' || side === 'out' : side === 'io', `${net}: ${e.name} side ${side}`);
    n.members.push({ e, connector: color + (side === 'out' ? 2 : 0) });
    return e;
  }
  // An empty constant combinator: a neutral post that carries one red and one green wire further.
  const relay = (x, y, ...pairs) => { const e = add('constant-combinator', x, y, { control_behavior: { sections: { sections: [{ index: 1 }] } } }); M.relays.push(e.entity_number); for (let i = 0; i < pairs.length; i += 2) join(pairs[i], pairs[i + 1], e); return e; };

  const panel = (x, y, text, name, type = 'item') => { const e = add('display-panel', x, y, { text, always_show: true, icon: type === 'item' ? { name } : { type, name } }); M.panels.push({ entity: e.entity_number, text }); return e; };
  const belt = (x, y, direction, extra = {}) => add('fast-transport-belt', x, y, { direction, ...extra });
  const pipe = (x, y) => add('pipe', x, y);
  const ptg = (x, y, open) => add('pipe-to-ground', x, y, { direction: open });
  // An arm's blueprint direction is the side it picks up from; it drops on the opposite side.
  const HAND = { 'fast-inserter': 1, 'bulk-inserter': 2, 'long-handed-inserter': 1 };
  function arm(kind, x, y, from, role, o = {}) {
    const e = add(kind, x, y, { direction: from, override_stack_size: HAND[kind], ...(o.items ? whitelist(o.items) : {}), ...(o.blacklist ? { use_filters: true, filter_mode: 'blacklist' } : {}), ...(o.setFilters && !o.blacklist ? { use_filters: true } : {}) });
    const cb = {};
    if (o.cap) { cb.circuit_enabled = true; cb.circuit_condition = { first_signal: item(o.cap), comparator: '<', constant: armCaps[o.cap] }; join('RING', RED, e); }
    if (o.level) { cb.circuit_enabled = true; cb.circuit_condition = { first_signal: virtual('signal-L'), comparator: '≤', constant: o.level }; join('GREEN', GREEN, e); }
    if (o.deficit) { cb.circuit_enabled = true; cb.circuit_condition = { first_signal: item(o.deficit), comparator: '<', constant: 0 }; join('GREEN', GREEN, e); }
    if (o.when) { cb.circuit_enabled = true; cb.circuit_condition = { first_signal: recipe(o.when), comparator: '>', constant: 0 }; }
    if (o.setFilters) cb.circuit_set_filters = true;
    if (o.pulse) cb.circuit_read_hand_contents = true;
    // what the arm carries stays in sight of the rules: its hand is read (hold) onto the given net
    if (o.hand) { cb.circuit_read_hand_contents = true; cb.circuit_hand_read_mode = 1; }
    if (Object.keys(cb).length) e.control_behavior = cb;
    M.arms.push({ entity: e.entity_number, kind, role, ...(o.items ? { items: o.items } : {}), ...(o.cap ? { ringCap: o.cap, limit: armCaps[o.cap] } : {}), ...(o.level ? { level: o.level } : {}), ...(o.deficit ? { deficit: o.deficit } : {}), ...(o.machine ? { machine: o.machine } : {}), ...(o.from ? { from: o.from } : {}), ...(o.to ? { to: o.to } : {}) });
    return e;
  }
  function machine(name, x, y, role, extra = {}, info = {}) {
    const e = add(name, x, y, extra);
    M.machines.push({ entity: e.entity_number, name, role, ...(extra.recipe ? { recipe: extra.recipe } : {}), ...info });
    return e;
  }
  const comb = (name, x, y, vertical, control_behavior) => add(name, x, y, { direction: vertical ? N : E, control_behavior });
  const decider = (x, y, vertical, terms, outputs) => comb('decider-combinator', x, y, vertical, { decider_conditions: { conditions: dnf(terms), outputs } });
  const constant = (x, y, signals) => add('constant-combinator', x, y, { control_behavior: { sections: { sections: [{ index: 1, filters: signals.map(([signal, count], i) => ({ index: i + 1, ...(signal.type ? { type: signal.type } : {}), name: signal.name, quality: 'normal', comparator: '=', count })) }] } } });

  // =================================================================== the ring
  const RX0 = -1, RX1 = 28, RY0 = 0, RY1 = 10;
  const ring = [];
  const rb = (x, y, d) => ring.push(belt(x, y, d, { control_behavior: { circuit_read_hand_contents: false, circuit_contents_read_mode: 0 } }));
  // The east end folds twice (down column 28, up column 29, down column 30): 20 more tiles of lane room. Almost
  // everything is put on the ring from outside the loop, so it rides the inner lane; the fold is what keeps that lane
  // from filling up (measured: without it the lane jammed at about 300 items).
  for (let x = RX0; x < RX1; x++) rb(x, RY0, E);
  for (let y = RY0; y < RY1 - 1; y++) rb(RX1, y, S);
  rb(RX1, RY1 - 1, E);
  for (let y = RY1 - 1; y > RY0 + 1; y--) rb(RX1 + 1, y, N);
  rb(RX1 + 1, RY0 + 1, E);
  for (let y = RY0 + 1; y < RY1; y++) rb(RX1 + 2, y, S);
  for (let x = RX1 + 2; x > RX0; x--) rb(x, RY1, W);
  for (let y = RY1; y > RY0; y--) rb(RX0, y, N);
  const reader = ring[14];
  reader.control_behavior = { circuit_read_hand_contents: true, circuit_contents_read_mode: 2 };
  for (const b of ring) join('RING', RED, b);

  // =================================================================== north block: lava, molten metal, casting
  // calcite belt and stone belt
  const calciteBelt = []; for (let x = -1; x <= 9; x++) calciteBelt.push(belt(x, -16, E));
  const stoneBelt = []; for (let x = 8; x >= -1; x--) stoneBelt.push(belt(x, -15, W));
  // lava: entrance pipe, hop under the west arms, pipe at the copper foundry, hop, pipe at the iron foundry
  const lava = [pipe(-1, -14), ptg(0, -14, W), ptg(5, -14, E), pipe(6, -14), ptg(7, -14, W), ptg(10, -14, E), pipe(11, -14)];
  const moltenCopper = machine('foundry', 3, -13, 'molten-copper', { direction: S, recipe: 'molten-copper-from-lava' });
  const moltenIron = machine('foundry', 8, -13, 'molten-iron', { direction: S, recipe: 'molten-iron-from-lava' });
  arm('bulk-inserter', 3, -14, S, 'stone out', { from: moltenCopper.entity_number });
  arm('long-handed-inserter', 4, -14, N, 'calcite in', { items: ['calcite'], to: moltenCopper.entity_number });
  arm('bulk-inserter', 8, -14, S, 'stone out', { from: moltenIron.entity_number });
  arm('long-handed-inserter', 9, -14, N, 'calcite in', { items: ['calcite'], to: moltenIron.entity_number });
  // brick furnace in the west pocket: stone straight from the copper foundry, bricks down the west edge to the ring
  const furnace = machine('electric-furnace', -1, -13, 'stone-brick');
  arm('fast-inserter', 1, -14, N, 'stone to furnace', { items: ['stone'], to: furnace.entity_number });
  // Bricks are stocked in a chest (five stacks): stone only flows while metal is cast, concrete can be wanted when it is not.
  arm('fast-inserter', -1, -10, N, 'brick out', { from: furnace.entity_number });
  const brickChest = add('steel-chest', -1, -9, { bar: BRICK_STACKS });
  arm('fast-inserter', -1, -8, N, 'brick chest to belt', { items: ['stone-brick'] });
  const brickBelt = []; for (let y = -7; y <= -2; y++) brickBelt.push(belt(-1, y, S));
  arm('fast-inserter', -1, -1, N, 'brick to ring', { items: ['stone-brick'], cap: 'stone-brick' });
  // Fluid ports. A recipe with one fluid ingredient uses BOTH input ports of a foundry as one box (measured in 2.1:
  // the two boxes are joined), and a recipe with one fluid product uses both output ports. When such a recipe is
  // taken away, what is left in the box is pushed back out through either port into any pipe that will take it,
  // and an empty pipe takes anything. So no machine here has two ports of the same kind on pipes of different fluids:
  // where a foundry needs a second fluid (molten copper for low density structures, water for concrete) that port
  // is fed by a pump standing directly on it, and a pump lets nothing back.
  // manifold: copper. The copper lava foundry's two output ports are one box: the east port feeds the pump on the
  // steel/LDS foundry's copper port, the west port feeds the line (under the iron trunk) to the cable foundry.
  const copperPump = add('pump', 6, -8, { direction: S });
  const copperPipes = [copperPump, pipe(4, -8), ptg(5, -8, W), ptg(14, -8, E), pipe(15, -8), pipe(15, -7), pipe(16, -7), pipe(17, -7)];
  // manifold: iron trunk on row -8 under the iron lava foundry, everything else of it on row -7 (hops under the copper pump, the cable foundry's copper pipes and the water pump)
  const ironPipes = [pipe(11, -8), pipe(10, -8), pipe(9, -8), pipe(8, -8), pipe(8, -7), ptg(7, -7, E), ptg(4, -7, W), pipe(3, -7),
    pipe(12, -8), pipe(12, -7), ptg(13, -7, W), ptg(18, -7, E), pipe(19, -7), ptg(20, -7, W), ptg(25, -7, E), pipe(26, -7)];
  // water: entrance on the east edge, tank, the gear foundry's second box, and a hop under the casting band and the ring to the core
  // A pump stands between the tank and the gear foundry's water box. When a foundry changes recipe, the molten iron
  // left in it flows out through any connected pipe that will take it, and an empty water pipe will (measured: with
  // water not yet connected the tank filled with molten iron). A pump lets nothing back.
  const waterTank = add('storage-tank', 22, -11);
  const waterPipes = []; for (let x = 28; x >= 22; x--) waterPipes.push(pipe(x, -12));
  const waterPump = add('pump', 24, -8, { direction: S });
  waterPipes.push(waterPump, pipe(21, -11), pipe(21, -10), pipe(21, -9), pipe(21, -8), ptg(21, -7, N), ptg(21, 2, S), pipe(21, 3));
  join('GREEN', GREEN, waterTank);
  // casting band
  const plates = machine('foundry', 0, -6, 'iron-plate', { direction: S, recipe: 'casting-iron' });
  const steelFoundry = machine('foundry', 5, -6, 'caster-S', { direction: S, control_behavior: { set_recipe: true, read_contents: true } }, { switching: true });
  const ec1 = machine('assembling-machine-3', 10, -4, 'electronic-circuit', { recipe: 'electronic-circuit' });
  const cable = machine('foundry', 14, -6, 'caster-D', { direction: S, control_behavior: { set_recipe: true, read_contents: true } }, { switching: true });
  const ec2 = machine('assembling-machine-3', 20, -4, 'electronic-circuit', { recipe: 'electronic-circuit' });
  const gearFoundry = machine('foundry', 23, -6, 'caster-G', { direction: S, control_behavior: { set_recipe: true, read_contents: true } }, { switching: true });
  for (const y of [-4, -3]) { arm('bulk-inserter', 13, y, E, 'cable hand-off', { from: cable.entity_number, to: ec1.entity_number }); arm('bulk-inserter', 19, y, W, 'cable hand-off', { from: cable.entity_number, to: ec2.entity_number }); }
  for (const x of [1, 3]) arm('bulk-inserter', x, -1, N, 'ring feed', { items: ['iron-plate'], cap: 'iron-plate', from: plates.entity_number });
  for (const x of [5, 7]) arm('bulk-inserter', x, -1, N, 'switching output', { from: steelFoundry.entity_number });
  arm('fast-inserter', 9, -1, S, 'ring input', { items: ['plastic-bar'], to: steelFoundry.entity_number });
  for (const [m, x] of [[ec1, 10], [ec2, 20]]) {
    arm('bulk-inserter', x, -1, S, 'ring input', { items: ['iron-plate'], to: m.entity_number });
    arm('bulk-inserter', x + 2, -1, N, 'ring feed', { items: ['electronic-circuit'], cap: 'electronic-circuit', from: m.entity_number });
  }
  arm('bulk-inserter', 16, -1, N, 'ring feed', { items: ['copper-cable'], cap: 'copper-cable', from: cable.entity_number });
  arm('bulk-inserter', 14, -1, N, 'switching output', { items: ['copper-plate'], from: cable.entity_number });
  const cableClear = arm('bulk-inserter', 18, -1, N, 'switching output while casting copper plate', { when: 'casting-copper', from: cable.entity_number });
  for (const x of [23, 25]) arm('bulk-inserter', x, -1, N, 'switching output', { from: gearFoundry.entity_number });
  arm('fast-inserter', 27, -1, S, 'ring input', { items: ['stone-brick'], to: gearFoundry.entity_number });

  // =================================================================== core
  const core = (recipeName, x, y, extra = {}) => machine('assembling-machine-3', x, y, recipeName, { recipe: recipeName, ...extra });
  // north band (rows 2..4), arms on row 1: pick from the ring = N, put on the ring = S
  [0, 3, 6, 9].forEach(x => { const m = core('advanced-circuit', x, 2); for (const dx of [0, 1]) arm('bulk-inserter', x + dx, 1, N, 'ring input', { items: ['electronic-circuit', 'plastic-bar', 'copper-cable'], to: m.entity_number }); arm('fast-inserter', x + 2, 1, S, 'ring feed', { items: ['advanced-circuit'], cap: 'advanced-circuit', from: m.entity_number }); });
  [12, 15].forEach(x => { const m = core('speed-module', x, 2); arm('fast-inserter', x, 1, N, 'ring input', { items: ['advanced-circuit', 'electronic-circuit'], to: m.entity_number }); arm('fast-inserter', x + 2, 1, S, 'ring feed', { items: ['speed-module'], cap: 'speed-module', from: m.entity_number }); });
  const am1 = core('assembling-machine-1', 18, 2);
  arm('bulk-inserter', 18, 1, N, 'ring input', { items: ['iron-plate', 'iron-gear-wheel', 'electronic-circuit'], to: am1.entity_number });
  const u1 = machine('assembling-machine-3', 22, 2, 'U1', { direction: W, control_behavior: { set_recipe: true, read_contents: true, read_working: true, working_signal: virtual('signal-W'), read_recipe_finished: true, recipe_finished_signal: virtual('signal-P') } }, { switching: true });
  const u1Shadow = machine('assembling-machine-3', 25, 2, 'U1-shadow', { control_behavior: { set_recipe: true, read_ingredients: true } }, { shadow: true });
  const u1In = [22, 23].map(x => arm('bulk-inserter', x, 1, N, 'switching input', { blacklist: true, setFilters: true, to: u1.entity_number }));
  const u1Out = [arm('bulk-inserter', 24, 1, S, 'switching output', { from: u1.entity_number, hand: true })];
  // south band (rows 6..8), arms on row 9: pick from the ring = S, put on the ring = N
  const foundation = core('space-platform-foundation', 1, 6);
  for (const x of [1, 2]) arm('bulk-inserter', x, 9, S, 'ring input', { items: ['steel-plate', 'copper-cable'], level: 5, to: foundation.entity_number });
  arm('fast-inserter', 3, 9, N, 'ring feed', { items: ['space-platform-foundation'], cap: 'space-platform-foundation', from: foundation.entity_number });
  const engine = core('engine-unit', 4, 6);
  arm('fast-inserter', 4, 9, S, 'ring input', { items: ['steel-plate', 'iron-gear-wheel', 'pipe'], level: 5, to: engine.entity_number });
  arm('fast-inserter', 6, 9, N, 'ring feed', { items: ['engine-unit'], cap: 'engine-unit', from: engine.entity_number });
  const am3 = machine('assembling-machine-3', 10, 6, 'assembling-machine-3', { recipe: 'assembling-machine-3', control_behavior: { read_working: true, working_signal: virtual('signal-W') } });
  arm('fast-inserter', 10, 9, S, 'ring input', { items: ['assembling-machine-2', 'speed-module'], to: am3.entity_number });
  arm('fast-inserter', 12, 9, N, 'ring feed', { items: ['assembling-machine-3'], cap: 'assembling-machine-3', from: am3.entity_number });
  const am2 = core('assembling-machine-2', 19, 6);
  arm('fast-inserter', 19, 5, N, 'hand-off', { items: ['assembling-machine-1'], from: am1.entity_number, to: am2.entity_number });
  arm('bulk-inserter', 19, 9, S, 'ring input', { items: ['steel-plate', 'electronic-circuit', 'iron-gear-wheel'], to: am2.entity_number });
  arm('fast-inserter', 21, 9, N, 'ring feed', { items: ['assembling-machine-2'], cap: 'assembling-machine-2', from: am2.entity_number });

  // =================================================================== south band
  const eeu = machine('assembling-machine-3', -1, 12, 'electric-engine-unit', { direction: E, recipe: 'electric-engine-unit' });
  arm('fast-inserter', -1, 11, N, 'ring input', { items: ['electronic-circuit', 'engine-unit'], level: 5, to: eeu.entity_number });
  arm('fast-inserter', 1, 11, S, 'ring feed', { items: ['electric-engine-unit'], cap: 'electric-engine-unit', from: eeu.entity_number });
  const lubTank = add('storage-tank', 3, 13);
  const lubPipes = [pipe(5, 16), pipe(2, 13), pipe(6, 15), pipe(6, 14), pipe(6, 13)];
  join('GREEN', GREEN, lubTank);
  const u2 = machine('foundry', 7, 12, 'U2', { direction: E, control_behavior: { set_recipe: true, read_contents: true, read_working: true, working_signal: virtual('signal-W'), read_recipe_finished: true, recipe_finished_signal: virtual('signal-P') } }, { switching: true });
  const u2Shadow = machine('assembling-machine-3', 13, 6, 'U2-shadow', { control_behavior: { set_recipe: true, read_ingredients: true } }, { shadow: true });
  const u2In = [7, 8, 9].map(x => arm('bulk-inserter', x, 11, N, 'switching input', { blacklist: true, setFilters: true, to: u2.entity_number }));
  const u2Out = [10, 11].map(x => arm('bulk-inserter', x, 11, S, 'switching output', { from: u2.entity_number, hand: true }));
  // output chests: AM3, kit, [silo], express, inserters, drill + foundry
  const CHESTS = [
    { id: 'OUT-1', x: 12, label: 'OUT: assembling machine 3', icon: 'assembling-machine-3', items: ['assembling-machine-3'] },
    { id: 'OUT-2', x: 13, label: 'OUT: platform kit (16 items)', icon: 'rocket-silo', items: kit.map(k => k.item) },
    { id: 'OUT-3', x: 19, label: 'OUT: express belt, underground, splitter', icon: 'express-transport-belt', items: ['express-transport-belt', 'express-underground-belt', 'express-splitter'] },
    { id: 'OUT-4', x: 20, label: 'OUT: fast + bulk inserter', icon: 'bulk-inserter', items: ['fast-inserter', 'bulk-inserter'] },
    { id: 'OUT-5', x: 21, label: 'OUT: mining drill + foundry', icon: 'electric-mining-drill', items: ['electric-mining-drill', 'foundry'] },
  ];
  for (const c of CHESTS) {
    // the kit chest reaches GREEN through a copy that leaves its fast inserters out (they have their own count, signal Q)
    c.chest = add('passive-provider-chest', c.x, 12); join(c.id === 'OUT-2' ? 'KIT-CHEST' : 'GREEN', GREEN, c.chest);
    c.panel = panel(c.x, 13, c.label, c.icon);
    c.arm = c.items.length === 1 ? arm('fast-inserter', c.x, 11, N, 'chest', { items: c.items, deficit: c.items[0] }) : arm('fast-inserter', c.x, 11, N, 'chest', { setFilters: true, hand: 'HANDS' });
  }
  const silo = machine('assembling-machine-3', 15, 12, 'rocket-silo', { recipe: 'rocket-silo', control_behavior: { read_contents: true } });
  arm('fast-inserter', 14, 12, E, 'silo to kit chest', { from: silo.entity_number });
  const siloArms = [15, 16, 17].map(x => arm('bulk-inserter', x, 11, N, 'silo input', { setFilters: true, pulse: true, to: silo.entity_number }));
  // plastic and tungsten carbide entrances: a belt from the south edge, one arm onto the ring
  const entranceBelt = (x, itemName) => { const tiles = []; for (let y = 16; y >= 12; y--) tiles.push(belt(x, y, N)); arm('fast-inserter', x, 11, S, 'entrance to ring', { items: [itemName], cap: itemName }); return tiles; };
  const plasticBelt = entranceBelt(18, 'plastic-bar'), carbideBelt = entranceBelt(22, 'tungsten-carbide');
  const pu = machine('assembling-machine-3', 23, 12, 'processing-unit', { direction: S, recipe: 'processing-unit' });
  arm('bulk-inserter', 23, 11, N, 'ring input', { items: ['electronic-circuit', 'advanced-circuit'], level: 5, to: pu.entity_number });
  arm('fast-inserter', 25, 11, S, 'ring feed', { items: ['processing-unit'], cap: 'processing-unit', from: pu.entity_number });
  const chem = machine('chemical-plant', 26, 12, 'battery', { direction: S, recipe: 'battery' });
  arm('fast-inserter', 26, 11, N, 'ring input', { items: ['iron-plate', 'copper-plate'], level: 5, to: chem.entity_number });
  arm('fast-inserter', 28, 11, S, 'ring feed', { items: ['battery'], cap: 'battery', from: chem.entity_number });
  const acidPipes = [28, 27, 26, 25, 24].map(x => pipe(x, 15));

  // =================================================================== power: four substations, one chain
  const subs = { nw: add('substation', 1, -9), w: add('substation', 7, 7), e: add('substation', 22, 7), ne: add('substation', 19, -10) };
  const copper = [[subs.nw, subs.w], [subs.w, subs.e], [subs.e, subs.ne]];

  // =================================================================== the control program
  const wanted = n => atom(item(n), 'RG', '<', 0), wantedTwo = n => atom(item(n), 'RG', '<', -1);
  const have = (n, k) => atom(item(n), 'R', '≥', k);
  const below = (n, k) => atom(item(n), 'R', '<', k ?? ruleCaps[n]);
  const self = r => atom(recipe(r), 'G', '>', 0);
  const water = atom(fluid('water'), 'G', '≥', TANK_READY), lub = atom(fluid('lubricant'), 'G', '≥', TANK_READY);
  const levelAtMost = k => atom(virtual('signal-L'), 'G', '≤', k);
  const Q = virtual('signal-Q');   // fast inserters the kit chest still lacks (K minus what it holds)
  const half = n => Math.ceil(ruleCaps[n] / 2);
  const ALWAYS = atom(virtual('signal-L'), 'G', '≥', 0);
  // A recipe-switching machine that reads its own contents must never be left without a recipe signal: with none, the
  // item signals of what it still holds would select a recipe by themselves (measured natively). So each is parked on
  // a recipe it can never start: its ingredients never come within reach of its arms.
  const IDLE = { foundry: 'iron-ore-melting', 'assembling-machine-3': 'wooden-chest' };
  // While a switching machine crafts recipe r, its controller shows recipe r = 1 on LOOSE ("pending").
  const idleNow = r => atom(recipe(r), 'R', '=', 0), craftingNow = r => atom(recipe(r), 'R', '>', 0);
  // The condition of a rule in two halves: while the machine is not crafting r, one craft's ingredients must be in sight;
  // while it crafts r (those ingredients are still counted, but spoken for), a second craft's must be, and for a final
  // the product must be short by more than the craft in progress. A recipe is only ever changed at the end of a craft,
  // so this is what stops a batch exactly and never leaves the machine holding a recipe it cannot feed.
  const twoPhase = (r, first, second, haves) => [[...first, idleNow(r), ...haves.map(([n, k]) => have(n, k))], [...second, craftingNow(r), ...haves.map(([n, k]) => have(n, 2 * k))]];
  const cross = (alternatives, f) => alternatives.flatMap(f);
  // a final product p made by recipe p
  const final = (p, o = {}) => cross(o.alt || [[]], alt => twoPhase(p, [...(o.first || [wanted(p)]), ...(o.extra || []), ...alt], [...(o.second || [wantedTwo(p)]), ...(o.extra || []), ...alt], o.have || []));
  // an intermediate i made by recipe i in batches: start below lo, keep going (its own signal on GREEN) up to hi
  const batch = (i, lo, hi, o = {}) => cross(o.alt || [[]], alt => [...twoPhase(i, [...alt, below(i, lo)], [...alt, below(i, lo)], o.have || []), ...twoPhase(i, [...alt, self(i), below(i, hi)], [...alt, self(i), below(i, hi)], o.have || [])]);
  const cast = (r, i, base = []) => [[...base, below(i, half(i))], [...base, self(r), below(i)]];
  // Two fast-inserter stocks. The kit's: fewer in sight (ring, U1, hands) than the kit chest still lacks. The inserter
  // group's: the kit chest has its own, and the inserter chest plus what is in sight is below its cap.
  const kitInserters = atom(item('fast-inserter'), 'R', '<', Q, 'G');
  const kitFull = atom(Q, 'G', '≤', 0);
  const stockInserters = [kitFull, wanted('fast-inserter')];
  const forBulk = [kitFull, atom(item('fast-inserter'), 'RG', '≥', 0), wanted('bulk-inserter'), have('advanced-circuit', 1)];
  const EB = 'express-transport-belt', EUG = 'express-underground-belt', ES = 'express-splitter';
  // Every rule: the machine it belongs to, the recipe it selects, its group, rank within the group and its condition.
  const RULES = [
    // ---- U1: the assembling machine 3 that makes the small finals, in the bill's order
    { m: 'U1', r: 'cargo-landing-pad', g: 2, k: 90, t: final('cargo-landing-pad', { have: [['processing-unit', 10]], alt: [[have('concrete', 200)], [water]] }) },
    { m: 'U1', r: 'space-platform-starter-pack', g: 2, k: 88, t: final('space-platform-starter-pack', { have: [['processing-unit', 20]] }) },
    { m: 'U1', r: 'asteroid-collector', g: 2, k: 86, t: final('asteroid-collector', { have: [['processing-unit', 5], ['electric-engine-unit', 8], ['low-density-structure', 20]] }) },
    { m: 'U1', r: 'crusher', g: 2, k: 84, t: final('crusher', { have: [['low-density-structure', 20], ['electric-engine-unit', 10]] }) },
    { m: 'U1', r: 'electric-furnace', g: 2, k: 82, t: final('electric-furnace', { have: [['advanced-circuit', 5], ['stone-brick', 10]] }) },
    { m: 'U1', r: 'inserter', g: 2, k: 81, t: batch('inserter', 1, ruleCaps.inserter, { alt: [[kitInserters]] }) },
    { m: 'U1', r: 'fast-inserter', g: 2, k: 80, t: final('fast-inserter', { first: [kitInserters], second: [kitInserters], have: [['inserter', 1]] }) },
    { m: 'U1', r: 'solar-panel', g: 2, k: 78, t: final('solar-panel') },
    { m: 'U1', r: 'accumulator', g: 2, k: 76, t: final('accumulator', { have: [['battery', 5]] }) },
    { m: 'U1', r: 'constant-combinator', g: 2, k: 74, t: final('constant-combinator') },
    { m: 'U1', r: 'arithmetic-combinator', g: 2, k: 72, t: final('arithmetic-combinator') },
    { m: 'U1', r: 'decider-combinator', g: 2, k: 70, t: final('decider-combinator') },
    { m: 'U1', r: 'steel-chest', g: 2, k: 69, t: [[wanted('passive-provider-chest'), have('advanced-circuit', 1), below('steel-chest')]] },
    { m: 'U1', r: 'passive-provider-chest', g: 2, k: 68, t: final('passive-provider-chest', { have: [['advanced-circuit', 1], ['steel-chest', 1]] }) },
    { m: 'U1', r: 'substation', g: 2, k: 66, t: final('substation', { have: [['advanced-circuit', 5]] }) },
    { m: 'U1', r: 'inserter', g: 4, k: 61, t: batch('inserter', 1, ruleCaps.inserter, { alt: [stockInserters, forBulk] }) },
    { m: 'U1', r: 'fast-inserter', g: 4, k: 60, t: [...final('fast-inserter', { first: stockInserters, second: [kitFull, wantedTwo('fast-inserter')], have: [['inserter', 1]] }), ...batch('fast-inserter', 1, ruleCaps['fast-inserter'], { alt: [forBulk], have: [['inserter', 1]] })] },
    { m: 'U1', r: 'bulk-inserter', g: 4, k: 58, t: final('bulk-inserter', { extra: [atom(item('fast-inserter'), 'RG', '≥', 0)], have: [['advanced-circuit', 1], ['fast-inserter', 1]] }) },
    { m: 'U1', r: 'electric-mining-drill', g: 5, k: 50, t: final('electric-mining-drill') },
    { m: 'U1', r: 'refined-concrete', g: 6, k: 40, t: [[wanted('foundry'), water, below('refined-concrete')]] },
    // ---- U2: the foundry that makes the three belt tiers and the foundry itself (lubricant on its fluid box)
    { m: 'U2', r: 'transport-belt', g: 3, k: 99, t: batch('transport-belt', 5, ruleCaps['transport-belt'], { alt: [[wanted(EB), lub], [wanted(EUG), lub], [wanted(ES), lub]] }) },
    { m: 'U2', r: 'underground-belt', g: 3, k: 97, t: batch('underground-belt', 2, ruleCaps['underground-belt'], { alt: [[wanted(EUG), lub]], have: [['transport-belt', 5]] }) },
    { m: 'U2', r: 'splitter', g: 3, k: 95, t: batch('splitter', 1, ruleCaps.splitter, { alt: [[wanted(ES), lub, have('advanced-circuit', 10)]], have: [['transport-belt', 4]] }) },
    { m: 'U2', r: 'fast-transport-belt', g: 3, k: 93, t: batch('fast-transport-belt', 1, ruleCaps['fast-transport-belt'], { alt: [[wanted(EB), lub]], have: [['transport-belt', 1]] }) },
    { m: 'U2', r: 'fast-underground-belt', g: 3, k: 91, t: batch('fast-underground-belt', 2, ruleCaps['fast-underground-belt'], { alt: [[wanted(EUG), lub]], have: [['underground-belt', 2]] }) },
    { m: 'U2', r: 'fast-splitter', g: 3, k: 89, t: batch('fast-splitter', 1, ruleCaps['fast-splitter'], { alt: [[wanted(ES), lub, have('advanced-circuit', 10)]], have: [['splitter', 1]] }) },
    { m: 'U2', r: EB, g: 3, k: 87, t: final(EB, { extra: [lub], have: [['fast-transport-belt', 1]] }) },
    { m: 'U2', r: EUG, g: 3, k: 85, t: final(EUG, { extra: [lub], have: [['fast-underground-belt', 2]] }) },
    { m: 'U2', r: ES, g: 3, k: 83, t: final(ES, { extra: [lub], have: [['advanced-circuit', 10], ['fast-splitter', 1]] }) },
    { m: 'U2', r: 'foundry', g: 6, k: 30, t: final('foundry', { extra: [lub], have: [['tungsten-carbide', 4], ['refined-concrete', 20]] }) },
    // ---- the three recipe-switching casting foundries (weights are ranks only; they never reach the level network).
    // Each casts an item from half its ring limit up to the limit (a latch, so it does not flip between recipes).
    { m: 'caster-S', r: 'casting-low-density-structure', k: 3, t: cross([wanted('asteroid-collector'), wanted('crusher')], w => [[w, levelAtMost(5), have('plastic-bar', 5), below('low-density-structure', 20)], [w, levelAtMost(5), have('plastic-bar', 5), self('casting-low-density-structure'), below('low-density-structure')]]) },
    { m: 'caster-S', r: 'casting-steel', k: 1, t: cast('casting-steel', 'steel-plate') },
    { m: 'caster-S', r: IDLE.foundry, idle: true, t: [[ALWAYS]] },
    { m: 'caster-G', r: 'casting-iron-gear-wheel', k: 5, t: cast('casting-iron-gear-wheel', 'iron-gear-wheel') },
    { m: 'caster-G', r: 'casting-pipe', k: 4, t: cast('casting-pipe', 'pipe') },
    { m: 'caster-G', r: 'casting-iron-stick', k: 3, t: cast('casting-iron-stick', 'iron-stick', [wanted('foundry')]) },
    { m: 'caster-G', r: 'concrete-from-molten-iron', k: 2, t: cross([wanted('rocket-silo'), wanted('cargo-landing-pad'), wanted('foundry')], w => cast('concrete-from-molten-iron', 'concrete', [w, water, have('stone-brick', 5)])) },
    { m: 'caster-G', r: 'casting-steel', k: 1, t: cast('casting-steel', 'steel-plate') },
    { m: 'caster-G', r: IDLE.foundry, idle: true, t: [[ALWAYS]] },
    { m: 'caster-D', r: 'casting-copper', k: 2, t: cast('casting-copper', 'copper-plate') },
    { m: 'caster-D', r: 'casting-copper-cable', k: 1, own: true, t: cast('casting-copper-cable', 'copper-cable') },
    { m: 'caster-D', r: IDLE.foundry, idle: true, t: [[ALWAYS]] },
    // ---- level flags of the two dedicated finals that need nothing but lava and calcite
    { m: 'flag', r: 'assembling-machine-2', g: 2, k: 62, t: [[wanted('assembling-machine-2')]] },
    { m: 'flag', r: 'space-platform-foundation', g: 2, k: 60, t: [[wanted('space-platform-foundation')]] },
  ];
  // Rule bank: two-tile vertical cells in the north-east area. The rules of the two casting foundries stand next to
  // their foundry; everything else fills the bank west to east, tier by tier.
  const FIXED = { 'caster-S': [[13, -10], [14, -10], [15, -10]], 'caster-D': [[16, -10], [17, -10]], 'caster-G': [[25, -10], [26, -10], [27, -10], [28, -10], [25, -11, false], [27, -8, false]] };
  const bank = [];
  for (const [y, x0, x1] of [[-12, 13, 19], [-14, 13, 28], [-16, 11, 28]]) for (let x = x0; x <= x1; x++) bank.push([x, y]);
  let cell = 0;
  const nextCell = () => { for (; cell < bank.length; cell++) { const [x, y] = bank[cell]; if (free(x, y) && free(x, y + 1)) return [...bank[cell++], true]; } throw new Error('rule bank is full'); };
  const selector = (x, y) => comb('selector-combinator', x, y, true, { operation: 'select', select_max: true, index_constant: 0 });
  const selectors = { 'caster-S': selector(10, -6), U2: selector(12, -6), 'caster-D': selector(20, -6), 'caster-G': selector(22, -6), U1: selector(20, -12) };
  for (const name of Object.keys(selectors)) join('CAND-' + name, RED, selectors[name], 'in');
  for (const rule of ['caster-S', 'caster-D', 'caster-G', 'U2', 'flag', 'U1'].flatMap(m => RULES.filter(v => v.m === m))) {
    const [x, y, vertical = true] = FIXED[rule.m]?.shift() || nextCell();
    const weight = rule.idle ? 1 : rule.g ? WEIGHT(LEVEL[rule.g], rule.k) : rule.k * 1000;
    const d = decider(x, y, vertical, rule.t, [{ signal: recipe(rule.r), copy_count_from_input: false, constant: weight }]);
    // a casting rule counts the ring and the casting foundries only: what a switching machine has loaded is no longer stock
    // (the cable rule counts only the cable foundry's own buffer: the two circuit machines are fed from it by hand-off)
    join(rule.own ? 'SET-' + rule.m : rule.m.startsWith('caster') ? 'CAST' : 'LOOSE', RED, d, 'in'); join('GREEN', GREEN, d, 'in');
    if (rule.m !== 'flag') join('CAND-' + rule.m, RED, d, 'out');
    // a product rule is a candidate for the level; a casting rule only shows itself on GREEN (its latch reads it there)
    if (rule.g) join('ACT', GREEN, d, 'out'); else if (!rule.idle) join('GREEN', GREEN, d, 'out');
    M.rules.push({ entity: d.entity_number, machine: rule.m, recipe: rule.r, ...(rule.g ? { group: rule.g, level: LEVEL[rule.g] } : {}), ...(rule.idle ? { idle: true } : {}), weight, terms: rule.t.length });
  }
  // global: level = floor(top weight / 100000), the floor of the level's weight band, candidates copied onto GREEN, ring copied onto LOOSE
  const top = comb('selector-combinator', ...nextCell(), { operation: 'select', select_max: true, index_constant: 0 });
  join('ACT', GREEN, top, 'in'); join('TOP', RED, top, 'out');
  const levelCalc = comb('arithmetic-combinator', ...nextCell(), { arithmetic_conditions: { first_signal: EACH, second_constant: 100000, operation: '/', output_signal: virtual('signal-L') } });
  join('TOP', RED, levelCalc, 'in'); join('LEVEL-NOW', GREEN, levelCalc, 'out');
  // The level in force: it rises at once and falls only after the lower reading has lasted LEVEL_HOLD ticks, so a
  // group does not lose its turn in the seconds one of its rules waits for an intermediate to come round the ring.
  const L_ = virtual('signal-L'), A_ = virtual('signal-A');
  const levelRise = decider(...nextCell(), [[atom(L_, 'G', '≥', L_, 'R')], [atom(A_, 'R', '>', LEVEL_HOLD)]], [{ signal: L_, copy_count_from_input: true, networks: networks('G') }]);
  const levelKeep = decider(...nextCell(), [[atom(L_, 'G', '<', L_, 'R'), atom(A_, 'R', '≤', LEVEL_HOLD)]], [{ signal: L_, copy_count_from_input: true, networks: networks('R') }, { signal: A_, copy_count_from_input: true, networks: networks('R') }, { signal: A_, copy_count_from_input: false, constant: 1 }]);
  for (const d of [levelRise, levelKeep]) { join('LEVEL-NOW', GREEN, d, 'in'); join('LEVEL', RED, d, 'in'); join('LEVEL', RED, d, 'out'); join('GREEN', GREEN, d, 'out'); }
  const floorCalc = comb('arithmetic-combinator', ...nextCell(), { arithmetic_conditions: { first_signal: virtual('signal-L'), second_constant: 100000, operation: '*', output_signal: virtual('signal-F') } });
  join('LEVEL', RED, floorCalc, 'in'); join('GREEN', GREEN, floorCalc, 'out');
  const actCopy = comb('arithmetic-combinator', ...nextCell(), { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });
  join('ACT', GREEN, actCopy, 'in'); join('GREEN', GREEN, actCopy, 'out');
  const ringCopy = comb('arithmetic-combinator', 11, -6, true, { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });
  join('RING', RED, ringCopy, 'in'); join('CAST', RED, ringCopy, 'out');
  // LOOSE takes the ring through one copy of its own, so that an item leaving a machine, riding in a hand (read through
  // one copy as well) and landing on the ring is seen without a gap: every path to LOOSE is two ticks long.
  const castCopy = comb('arithmetic-combinator', 26, 9, false, { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });
  join('RING', RED, castCopy, 'in'); join('LOOSE', RED, castCopy, 'out');
  // posts that carry a selector's pick across the casting band and the ring to its machine
  relay(21, -5, 'PICK-U1', RED, 'ACT', GREEN); relay(21, 1, 'PICK-U1', RED, 'ACT', GREEN); relay(24, 8, 'ACT', GREEN); relay(20, 9, 'ACT', GREEN);
  relay(11, -1, 'PICK-U2', RED, 'ACT', GREEN); relay(9, 5, 'ACT', GREEN); relay(9, 8, 'SET-U2', RED, 'NEED-U2', GREEN); relay(13, -2, 'ACT', GREEN);
  // the two casting foundries take their recipe straight from their selector
  join('SET-caster-S', RED, selectors['caster-S'], 'out'); join('SET-caster-S', RED, steelFoundry);
  join('SET-caster-G', RED, selectors['caster-G'], 'out'); join('SET-caster-G', RED, gearFoundry);
  join('SET-caster-D', RED, selectors['caster-D'], 'out'); join('SET-caster-D', RED, cable); join('SET-caster-D', RED, cableClear);
  const casterCopies = {};
  for (const [name, x, y] of [['caster-S', 13, -6], ['caster-D', 19, -6], ['caster-G', 28, -6]]) {
    const copy = comb('arithmetic-combinator', x, y, true, { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });
    join('SET-' + name, RED, copy, 'in'); join('CAST', RED, copy, 'out'); casterCopies[name] = copy.entity_number;
  }

  // Per recipe-switching machine (U1, U2). Wires: PICK (the selector's choice), NEW (after the level gate, or the
  // parking recipe), SET (the recipe in force, the machine, its contents, working signal and craft-finished pulse),
  // NEED (the recipe again, and the ingredient list a never-fed shadow machine reads out for it), LOAD (what the input
  // arms must not pick up: every ingredient the machine already holds one craft of).
  //   The recipe in force is frozen while the machine loads and crafts. It follows NEW only on the tick a craft
  //   finishes (the pulse), while the machine is parked, or after `stall` ticks without a finished craft. So a recipe
  //   never changes while an arm may be carrying an ingredient for it (that arm would hold the item for good), and
  //   the rules always see which recipe is really being crafted.
  const W_ = virtual('signal-W'), P_ = virtual('signal-P'), B_ = virtual('signal-B'), T_ = virtual('signal-T'), F_ = virtual('signal-F'), H_ = virtual('signal-H');
  const pass = nets => [{ signal: EACH, copy_count_from_input: true, networks: networks(nets) }];
  function controller(name, m, shadow, inArms, outArms, cells) {
    const stall = STALL[name], SET = 'SET-' + name;
    const gate = decider(...cells.gate, [[atom(EACH, 'R', '≥', F_, 'G')]], pass('R'));
    const park = decider(...cells.park, [[atom(EVERYTHING, 'R', '<', F_, 'G')]], [{ signal: recipe(IDLE[m.name]), copy_count_from_input: false, constant: IDLE_WEIGHT }]);
    for (const d of [gate, park]) { join('PICK-' + name, RED, d, 'in'); join('GREEN', GREEN, d, 'in'); join('NEW-' + name, GREEN, d, 'out'); }
    join('PICK-' + name, RED, selectors[name], 'out');
    const take = decider(...cells.take, [[atom(P_, 'R', '>', 0), atom(EACH, 'G', '>', 0)], [atom(B_, 'R', '>', 0), atom(EACH, 'G', '>', 0)], [atom(T_, 'R', '≥', stall), atom(EACH, 'G', '>', 0)]], pass('G'));
    const hold = decider(...cells.hold, [[atom(P_, 'R', '=', 0), atom(B_, 'R', '=', 0), atom(T_, 'R', '<', stall), atom(EACH, 'R', '≥', REAL_WEIGHT)]], [...pass('R'), { signal: H_, copy_count_from_input: false, constant: 1 }]);
    // ticks the recipe has been held since the last finished craft (its own decider: a copied count inside an each-decider is the each signal's)
    const timer = decider(...cells.timer, [[atom(H_, 'R', '>', 0), atom(P_, 'R', '=', 0), atom(T_, 'R', '<', 1000000)]], [{ signal: T_, copy_count_from_input: true, networks: networks('R') }, { signal: T_, copy_count_from_input: false, constant: 1 }]);
    // "parked": no real recipe is in force, or a craft has just finished and the pick is to park. The second term
    // closes a one-tick hole: without it the recipe wire carried no recipe for one tick while the machine went from a
    // recipe to parking, and a machine that reads its own contents takes them as its recipe for that tick (measured:
    // the belt foundry showed casting-iron-gear-wheel for one tick when it parked with gear wheels left in it).
    const boot = decider(...cells.boot, [[atom(EVERYTHING, 'R', '<', REAL_WEIGHT)], [atom(P_, 'R', '>', 0), atom(recipe(IDLE[m.name]), 'G', '>', 0)]], [{ signal: B_, copy_count_from_input: false, constant: 1 }]);
    join('NEW-' + name, GREEN, take, 'in'); join('NEW-' + name, GREEN, boot, 'in');
    for (const [e, side] of [[take, 'in'], [take, 'out'], [hold, 'in'], [hold, 'out'], [timer, 'in'], [timer, 'out'], [boot, 'in'], [boot, 'out'], [m, 'io']]) join(SET, RED, e, side);
    const copy = decider(...cells.copy, [[atom(EACH, 'R', '<', IDLE_WEIGHT)]], pass('R'));
    join(SET, RED, copy, 'in'); join('LOOSE', RED, copy, 'out');
    // "crafting r": while the machine works and on the tick its craft finishes (the product is counted from the next tick)
    const pending = decider(...cells.pending, [[atom(W_, 'R', '>', 0), atom(EACH, 'R', '≥', REAL_WEIGHT)], [atom(P_, 'R', '>', 0), atom(EACH, 'R', '≥', REAL_WEIGHT)]], [{ signal: EACH, copy_count_from_input: false, constant: 1 }]);
    join(SET, RED, pending, 'in'); join('LOOSE', RED, pending, 'out');
    const diode = decider(...cells.diode, [[atom(EACH, 'R', '≥', IDLE_WEIGHT)]], pass('R'));
    join(SET, RED, diode, 'in'); join('NEED-' + name, GREEN, diode, 'out'); join('NEED-' + name, GREEN, shadow);
    const negate = comb('arithmetic-combinator', ...cells.negate, { arithmetic_conditions: { first_signal: EACH, second_constant: -1, operation: '*', output_signal: EACH } });
    join('NEED-' + name, GREEN, negate, 'in');
    // the arms learn one tick late that the machine is empty again, so the machine takes its new recipe first
    const delay = comb('arithmetic-combinator', ...cells.delay, { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });
    join(SET, RED, delay, 'in');
    const limiter = decider(...cells.limiter, [[atom(EACH, 'G', '<', 0), atom(EACH, 'G', '>', -IDLE_WEIGHT), atom(EACH, 'RG', '≥', 0)]], [{ signal: EACH, copy_count_from_input: false, constant: 1 }]);
    join('DELAY-' + name, RED, delay, 'out'); join('DELAY-' + name, RED, limiter, 'in'); join('NEG-' + name, GREEN, negate, 'out'); join('NEG-' + name, GREEN, limiter, 'in');
    join('LOAD-' + name, RED, limiter, 'out'); for (const a of inArms) join('LOAD-' + name, RED, a);
    const handCopy = comb('arithmetic-combinator', ...cells.hands, { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });
    for (const a of outArms) join('OUT-HAND-' + name, GREEN, a); join('OUT-HAND-' + name, GREEN, handCopy, 'in'); join('LOOSE', RED, handCopy, 'out');
    return { machine: m.entity_number, shadow: shadow.entity_number, handCopy: handCopy.entity_number, outputArms: outArms.map(a => a.entity_number), selector: selectors[name].entity_number, idleRecipe: IDLE[m.name], stallTicks: stall, gate: gate.entity_number, park: park.entity_number, take: take.entity_number, hold: hold.entity_number, timer: timer.entity_number, boot: boot.entity_number, copy: copy.entity_number, pending: pending.entity_number, diode: diode.entity_number, negate: negate.entity_number, delay: delay.entity_number, limiter: limiter.entity_number, inputArms: inArms.map(a => a.entity_number) };
  }
  const controllers = {
    U1: controller('U1', u1, u1Shadow, u1In, u1Out, { hands: [25, 1, false], gate: [18, 6, true], park: [17, 6, true], take: [25, 8, false], hold: [25, 6, true], timer: [22, 6, false], boot: [27, 6, true], delay: [25, 5, false], diode: [23, 5, false], copy: [21, 5, false], pending: [16, 6, true], negate: [26, 6, true], limiter: [24, 6, true] }),
    U2: controller('U2', u2, u2Shadow, u2In, u2Out, { hands: [7, 9, false], gate: [12, 5, false], park: [14, 5, false], take: [6, 5, false], hold: [4, 5, false], timer: [2, 5, false], boot: [0, 5, false], pending: [10, 5, false], diode: [3, 12, false], copy: [5, 12, false], delay: [0, 15, true], negate: [-1, 15, true], limiter: [2, 14, true] }),
  };

  // assembling machine 3 (final): holds level 6 while its chest is short and it has crafted within the stall time
  const am3Timer = decider(9, 6, true, [[atom(virtual('signal-W'), 'R', '=', 0), atom(item('assembling-machine-3'), 'G', '<', 0), atom(virtual('signal-T'), 'R', '<', 1000000)]], [{ signal: virtual('signal-T'), copy_count_from_input: true, networks: networks('R') }, { signal: virtual('signal-T'), copy_count_from_input: false, constant: 1 }]);
  const am3Flag = decider(7, 6, false, [[atom(item('assembling-machine-3'), 'G', '<', 0), atom(virtual('signal-T'), 'R', '<', STALL['assembling-machine-3'])]], [{ signal: recipe('assembling-machine-3'), copy_count_from_input: false, constant: WEIGHT(6, 90) }]);
  for (const [e, side] of [[am3, 'io'], [am3Timer, 'in'], [am3Timer, 'out'], [am3Flag, 'in']]) join('AM3-LOCAL', RED, e, side);
  join('GREEN', GREEN, am3Timer, 'in'); join('GREEN', GREEN, am3Flag, 'in'); join('ACT', GREEN, am3Flag, 'out');
  M.rules.push({ entity: am3Flag.entity_number, machine: 'flag', recipe: 'assembling-machine-3', group: 1, level: 6, weight: WEIGHT(6, 90), timer: am3Timer.entity_number, stallTicks: STALL['assembling-machine-3'] });

  // south band controllers: fixed cells on rows 15..16
  const SOUTH = { negate: [12, 15, true], share: [13, 15, true], 'OUT-2': [14, 15, true], siloFilter: [15, 15, true], siloTimer: [16, 15, true], siloFlag: [19, 15, true], 'OUT-3': [20, 15, true], 'OUT-4': [21, 15, true], 'OUT-5': [24, 16, false] };
  // caps: one constant combinator (positive numbers), negated onto GREEN; signal-K is the cap of the kit chest's fast inserters
  const capsCombinator = constant(12, 14, PRODUCTS.map(v => [capSignal(v), v.cap]));
  const capsPanel = panel(14, 14, 'CAPS: edit a number here (K = fast inserters in the kit chest)', 'constant-combinator');
  const negate = comb('arithmetic-combinator', ...SOUTH.negate, { arithmetic_conditions: { first_signal: EACH, second_constant: -1, operation: '*', output_signal: EACH } });
  // The kit chest's own fast inserters: Q = K (red: the caps) minus the chest's count (green: the chest), on GREEN.
  const share = comb('arithmetic-combinator', ...SOUTH.share, { arithmetic_conditions: { first_signal: virtual('signal-K'), first_signal_networks: networks('R'), second_signal: item('fast-inserter'), second_signal_networks: networks('G'), operation: '-', output_signal: Q } });
  for (const [e, side] of [[capsCombinator, 'io'], [negate, 'in'], [share, 'in']]) join('CAPS', RED, e, side);
  join('GREEN', GREEN, negate, 'out'); join('GREEN', GREEN, share, 'out'); join('KIT-CHEST', GREEN, share, 'in');
  // Everything else in the kit chest goes onto GREEN as usual (one tick late, like Q), the fast inserters masked out,
  // so GREEN's fast-inserter signal is the inserter chest's alone and neither chest's count can stand in for the other.
  const kitMask = constant(18, 8, [[item('fast-inserter'), 1]]);
  const kitPass = decider(16, 8, false, [[atom(EACH, 'G', '>', 0), atom(EACH, 'R', '=', 0)]], pass('G'));
  join('KIT-CHEST', GREEN, kitPass, 'in'); join('KIT-MASK', RED, kitMask); join('KIT-MASK', RED, kitPass, 'in'); join('GREEN', GREEN, kitPass, 'out');
  // multi-product chests: the arm's filter is the set of declared items the chest is short of
  for (const ch of CHESTS.filter(v => v.items.length > 1)) {
    // An arm has five filter slots. A chest with more products than that also needs the item to be on the ring right
    // now (its list is worth 1000 an item and a copy of the ring is added to it), so a product that cannot be made
    // never keeps a slot from one that is passing by.
    const wide = ch.items.length > 5;
    // Fast inserters are listed apart (3000 in the kit list, 2 in the inserter list): the kit chest takes them while it
    // lacks some (Q above 0), the inserter chest only once the kit chest has its own (Q not above 0).
    const fast = n => n === 'fast-inserter' && (ch.id === 'OUT-2' || ch.id === 'OUT-4');
    const terms = ch.id === 'OUT-2' ? [[atom(EACH, 'G', '<', 0), atom(EACH, 'R', '>', 1000), atom(EACH, 'R', '<', 3000), levelAtMost(5)], [atom(EACH, 'R', '>', 3000), atom(Q, 'G', '>', 0), levelAtMost(5)]]
      : ch.id === 'OUT-4' ? [[atom(EACH, 'G', '<', 0), atom(EACH, 'R', '=', 1)], [atom(EACH, 'G', '<', 0), atom(EACH, 'R', '=', 2), atom(Q, 'G', '≤', 0)]]
      : [[atom(EACH, 'G', '<', 0), atom(EACH, 'R', '>', wide ? 1000 : 0)]];
    const d = decider(...SOUTH[ch.id], terms, [{ signal: EACH, copy_count_from_input: false, constant: 1 }]);
    const list = constant(ch.x, 14, ch.items.map(n => [item(n), ch.id === 'OUT-2' ? (fast(n) ? 3000 : 1000) : fast(n) ? 2 : 1]));
    join('LIST-' + ch.id, RED, list); join('LIST-' + ch.id, RED, d, 'in'); join('GREEN', GREEN, d, 'in');
    if (wide) {
      const ringSeen = comb('arithmetic-combinator', 15, 9, false, { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });
      join('RING', RED, ringSeen, 'in'); join('LIST-' + ch.id, RED, ringSeen, 'out'); ch.ringSeen = ringSeen.entity_number;
    }
    join('FILTER-' + ch.id, RED, d, 'out'); join('FILTER-' + ch.id, RED, ch.arm);
    ch.decider = d.entity_number; ch.list = list.entity_number;
  }
  // What a chest arm carries counts as loose stock. Each arm has its own hand wire and copy: its filter wire must not
  // see the hand of another arm (it would pick that item up), nor may its own filter drop the item it holds.
  const HAND_CELLS = { 'OUT-2': [13, 9], 'OUT-3': [17, 9], 'OUT-4': [22, 9], 'OUT-5': [24, 9] };
  for (const ch of CHESTS.filter(v => v.items.length > 1)) {
    const copy = comb('arithmetic-combinator', ...HAND_CELLS[ch.id], false, { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });
    join('HAND-' + ch.id, GREEN, ch.arm); join('HAND-' + ch.id, GREEN, copy, 'in'); join('LOOSE', RED, copy, 'out'); ch.handCopy = copy.entity_number;
  }
  // rocket silo: loads exactly one craft while the kit chest lacks its silo and level 5 is allowed; holds level 5
  // while something was delivered within the stall time
  const siloNeed = Object.fromEntries(p.recipes['rocket-silo'].ingredients.map(v => [v.name, v.amount]));
  const siloNeeds = constant(14, 13, Object.entries(siloNeed).map(([n, k]) => [item(n), -k]));
  const siloFilter = decider(...SOUTH.siloFilter, [[atom(EACH, 'R', '<', 0), atom(item('rocket-silo'), 'RG', '<', 0), levelAtMost(5)]], [{ signal: EACH, copy_count_from_input: false, constant: 1 }]);
  for (const [e, side] of [[silo, 'io'], [siloNeeds, 'io'], [siloFilter, 'in']]) join('SILO-LOCAL', RED, e, side);
  join('GREEN', GREEN, siloFilter, 'in');
  join('SILO-ARMS', RED, siloFilter, 'out'); for (const a of siloArms) join('SILO-ARMS', RED, a);
  const siloTimer = decider(...SOUTH.siloTimer, [[atom(EVERYTHING, 'R', '≤', 1), atom(virtual('signal-T'), 'G', '<', 1000000)]], [{ signal: virtual('signal-T'), copy_count_from_input: true, networks: networks('G') }, { signal: virtual('signal-T'), copy_count_from_input: false, constant: 1 }]);
  join('SILO-ARMS', RED, siloTimer, 'in'); join('SILO-T', GREEN, siloTimer, 'in'); join('SILO-T', GREEN, siloTimer, 'out');
  const siloFlag = decider(...SOUTH.siloFlag, [[atom(item('rocket-silo'), 'G', '<', 0), atom(virtual('signal-T'), 'R', '<', STALL['rocket-silo'])]], [{ signal: recipe('rocket-silo'), copy_count_from_input: false, constant: WEIGHT(5, 95) }]);
  join('SILO-TR', RED, siloTimer, 'out'); join('SILO-TR', RED, siloFlag, 'in'); join('GREEN', GREEN, siloFlag, 'in'); join('ACT', GREEN, siloFlag, 'out');
  M.rules.push({ entity: siloFlag.entity_number, machine: 'flag', recipe: 'rocket-silo', group: 2, level: 5, weight: WEIGHT(5, 95), timer: siloTimer.entity_number, stallTicks: STALL['rocket-silo'] });

  // =================================================================== labels
  const ports = [];
  const port = (id, kind, name, tile, external, label, labelAt, extra = {}) => { const sign = panel(labelAt[0], labelAt[1], label, name, kind === 'fluid' ? 'fluid' : 'item'); ports.push({ id, item: name, kind, mode: kind === 'fluid' ? 'pipe' : 'belt', entity: tile.entity_number, position: tile.position, externalContact: external, panel: sign.entity_number, label, ...extra }); };
  port('IN-1', 'fluid', 'lava', lava[0], { x: -1.5, y: -13.5 }, 'IN: lava (pipe, west edge, two rows up)', [2, -12]);
  port('IN-2', 'item', 'calcite', calciteBelt[0], { x: -1.5, y: -15.5 }, 'IN: calcite (belt, west end of the top row)', [10, -15], { flow: 'east' });
  port('OUT-STONE', 'item', 'stone', stoneBelt.at(-1), { x: -1.5, y: -14.5 }, 'OUT: surplus stone (belt above, leaves west)', [2, -14], { flow: 'west', exit: true });
  port('IN-3', 'fluid', 'water', waterPipes[0], { x: 29.5, y: -11.5 }, 'IN: water (pipe, east edge, row above)', [28, -11]);
  port('IN-4', 'fluid', 'lubricant', lubPipes[0], { x: 5.5, y: 17.5 }, 'IN: lubricant (pipe, south edge)', [4, 16]);
  port('IN-5', 'fluid', 'sulfuric-acid', acidPipes[0], { x: 29.5, y: 15.5 }, 'IN: sulfuric acid (pipe, east edge)', [28, 16]);
  port('IN-6', 'item', 'plastic-bar', plasticBelt[0], { x: 18.5, y: 17.5 }, 'IN: plastic (belt, south edge)', [17, 16], { flow: 'north' });
  port('IN-7', 'item', 'tungsten-carbide', carbideBelt[0], { x: 22.5, y: 17.5 }, 'IN: tungsten carbide (belt, south edge)', [23, 16], { flow: 'north' });
  const powerPanel = panel(1, -10, 'POWER: connect this substation', 'substation');

  // =================================================================== wires
  const wires = [];
  const reach = e => (e.name === 'substation' ? p.entities.substation.maximum_wire_distance : p.entities[e.name].circuit_wire_max_distance) - (COMBINATORS.includes(e.name) ? 1 : 0);
  // substations carry LOOSE (red) and GREEN (green) across the mall
  for (const s of Object.values(subs)) { join('LOOSE', RED, s); join('GREEN', GREEN, s); }
  if (options.relays) for (const [x, y, ...pairs] of options.relays) relay(x, y, ...pairs);
  const netReport = {};
  for (const [name, net] of nets) {
    const nodes = net.members, reached = new Set([0]);
    while (reached.size < nodes.length) {
      let best;
      for (const i of reached) for (let j = 0; j < nodes.length; j++) if (!reached.has(j)) {
        const a = nodes[i], b = nodes[j];
        if (a.e === b.e) { if (!best || best.d > -1) best = { i, j, d: -1 }; continue; }
        const d = distance(a.e, b.e);
        if (d <= Math.min(reach(a.e), reach(b.e)) && (!best || d < best.d)) best = { i, j, d };
      }
      if (!best) {
        const missing = nodes.map((n, j) => j).filter(j => !reached.has(j)).map(j => `${nodes[j].e.name}#${nodes[j].e.entity_number}@${nodes[j].e.position.x},${nodes[j].e.position.y}`);
        const have = [...reached].map(j => `${nodes[j].e.name}@${nodes[j].e.position.x},${nodes[j].e.position.y}`);
        throw new Error(`net ${name} is not connected: cannot reach ${missing.slice(0, 6).join(' | ')} from ${have.slice(0, 12).join(' | ')}`);
      }
      const a = nodes[best.i], b = nodes[best.j];
      wires.push([a.e.entity_number, a.connector, b.e.entity_number, b.connector]);
      reached.add(best.j);
    }
    netReport[name] = { color: net.color === RED ? 'red' : 'green', members: nodes.map(n => [n.e.entity_number, n.connector]) };
  }
  for (const [a, b] of copper) { assert(distance(a, b) <= p.entities.substation.maximum_wire_distance, 'substation chain'); wires.push([a.entity_number, 5, b.entity_number, 5]); }

  // =================================================================== blueprint and manifest
  const icons = ['foundry', 'assembling-machine-3', 'rocket-silo', 'express-transport-belt'].map((name, i) => ({ index: i + 1, signal: { name } }));
  const blueprint = { blueprint: { item: 'blueprint', label: 'Foundry mall | lava + calcite | AM3, platform kit, express belts, inserters, drills, foundries', description: `Factorio ${p.gameVersion} Space Age, Vulcanus. Lava (pipe) and calcite (belt) in the north-west; plastic and tungsten carbide belts and the lubricant pipe on the south edge; water and sulfuric acid pipes on the east edge; surplus stone leaves on the belt in the north-west. Five passive provider chests on the south edge fill in list order: assembling machine 3, the white-pack platform kit, express belts, inserters, drills and foundries. Caps: the constant combinator next to the kit chest. Power: the marked substation. No modules or beacons. See the README for ports and the native test.`, version: blueprintVersion(p.gameVersion), icons, entities, wires } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const names = [...new Set(entities.map(e => e.name))].sort();
  const footprint = { ...envelope(entities, p), includes: 'all entities: machines, arms, belts, pipes, tanks, combinators, panels, substations, chests; external supply excluded', counts: Object.fromEntries(names.map(n => [n, entities.filter(e => e.name === n).length])), entities: entities.length };
  const recipesUsed = [...new Set([...M.machines.filter(m => m.recipe).map(m => m.recipe), ...RULES.map(r => r.r), 'stone-brick'])];
  const tech = technologyClosure(p, recipesUsed, names);
  const ringBelts = ring.length, turnTiles = 8, laneCapacity = (ringBelts - turnTiles) * 4;
  // Lane room. An arm drops on the far lane of the belt it faces, so everything put on the ring from outside the loop
  // rides the inner lane and everything put on from the core rides the outer lane. Limits per lane, all at once:
  const insideLoop = e => e.position.x > RX0 + 1 && e.position.x < RX1 && e.position.y > RY0 + 1 && e.position.y < RY1;
  const laneLimits = { inner: 0, outer: 0 }, laneOf = {};
  for (const [name, limit] of Object.entries(armCaps)) { const a = M.arms.find(v => v.ringCap === name); laneOf[name] = insideLoop(entities[a.entity - 1]) ? 'outer' : 'inner'; laneLimits[laneOf[name]] += limit; }
  for (const [name, limit] of Object.entries(ruleCaps)) { const rule = RULES.find(v => !v.idle && p.recipes[v.r].results.some(x => x.name === name)); laneOf[name] = rule.m === 'U1' ? 'outer' : 'inner'; laneLimits[laneOf[name]] += limit; }
  const manifest = {
    schema: 1, id: 'foundry-mall', revision: 2, candidateSha256: hash, requiredGameVersion: p.gameVersion, prototypeSha256: options.prototypeSha256, surface: 'vulcanus',
    intendedUse: 'on-demand mall on Vulcanus from lava and calcite: assembling machine 3, the white-pack platform kit, express belts, fast and bulk inserters, electric mining drills and foundries, each kept at its cap in passive provider chests, made in that order',
    groups: GROUP_NAMES.map((name, i) => ({ group: i + 1, name, level: LEVEL[i + 1], products: PRODUCTS.filter(v => v.group === i + 1).map(v => v.key) })),
    products: PRODUCTS, caps: CAPS, kitShare: KIT_SHARE, capSignals: Object.fromEntries(PRODUCTS.map(v => [v.key, capSignal(v).name])),
    stock: PRODUCTS.map(v => ({ key: v.key, item: v.item, output: CHESTS.find(c => v.key === KIT_FAST_INSERTERS ? c.id === 'OUT-2' : v.item === 'fast-inserter' ? c.id === 'OUT-4' : c.items.includes(v.item)).id, chest: CHESTS.find(c => v.key === KIT_FAST_INSERTERS ? c.id === 'OUT-2' : v.item === 'fast-inserter' ? c.id === 'OUT-4' : c.items.includes(v.item)).chest.entity_number })),
    kitChest: { need: share.entity_number, pass: kitPass.entity_number, mask: kitMask.entity_number }, capsCombinator: { entity: capsCombinator.entity_number, panel: capsPanel.entity_number, position: capsCombinator.position, negate: negate.entity_number, share: share.entity_number },
    ringArmCaps: armCaps, ringRuleCaps: ruleCaps, tankReady: TANK_READY,
    equipment: { inserters: HAND, transport: 'fast-transport-belt', power: 'substation', modules: 0, beacons: 0, quality: 'normal' },
    footprint, ports, power: { entry: subs.nw.entity_number, panel: powerPanel.entity_number, label: 'POWER: connect this substation', externalPolePosition: { x: -3, y: -8 }, substations: Object.values(subs).map(e => e.entity_number) },
    outputs: CHESTS.map(ch => ({ id: ch.id, items: ch.items, chest: ch.chest.entity_number, arm: ch.arm.entity_number, panel: ch.panel.entity_number, label: ch.label, position: ch.chest.position, ...(ch.decider ? { decider: ch.decider, list: ch.list, handCopy: ch.handCopy, ...(ch.ringSeen ? { ringSeen: ch.ringSeen } : {}) } : {}) })),
    machines: M.machines, arms: M.arms, rules: M.rules, controllers, relays: M.relays, panels: M.panels,
    ring: { belts: ring.map(e => e.entity_number), reader: reader.entity_number, tiles: ringBelts, turnTiles, laneCapacity, bound: Math.floor(laneCapacity * 2 * 0.75), laneLimits, laneOf },
    lines: { calcite: calciteBelt.map(e => e.entity_number), stone: stoneBelt.map(e => e.entity_number), brick: brickBelt.map(e => e.entity_number), plastic: plasticBelt.map(e => e.entity_number), carbide: carbideBelt.map(e => e.entity_number) },
    fluids: { lava: lava.map(e => e.entity_number), 'molten-copper': copperPipes.map(e => e.entity_number), 'molten-iron': ironPipes.map(e => e.entity_number), water: [waterTank, ...waterPipes].map(e => e.entity_number), lubricant: [lubTank, ...lubPipes].map(e => e.entity_number), 'sulfuric-acid': acidPipes.map(e => e.entity_number) },
    tanks: { water: waterTank.entity_number, lubricant: lubTank.entity_number },
    pumps: [{ entity: copperPump.entity_number, fluid: 'molten-copper', from: moltenCopper.entity_number, to: steelFoundry.entity_number }, { entity: waterPump.entity_number, fluid: 'water', from: waterTank.entity_number, to: gearFoundry.entity_number }], brickChest: { entity: brickChest.entity_number, stacks: BRICK_STACKS },
    silo: { machine: silo.entity_number, need: siloNeed, needs: siloNeeds.entity_number, filter: siloFilter.entity_number, timer: siloTimer.entity_number, arms: siloArms.map(a => a.entity_number) },
    casterCopies, idleRecipes: IDLE, idleWeight: IDLE_WEIGHT, realWeight: REAL_WEIGHT,
    levelHoldTicks: LEVEL_HOLD,
    global: { top: top.entity_number, level: levelCalc.entity_number, levelRise: levelRise.entity_number, levelKeep: levelKeep.entity_number, floor: floorCalc.entity_number, candidateCopy: actCopy.entity_number, ringCopy: ringCopy.entity_number, castCopy: castCopy.entity_number },
    nets: netReport, technologyClosure: tech.closure, recipes: recipesUsed,
    status: { static: 'static-audit.json', native: 'native-report.json; qualified only when that report passed for candidateSha256' },
  };
  return { blueprint, code, hash, manifest, footprint, ports, tech, entities, occupied };
}

// A character map of the layout for the README and for debugging.
export function asciiMap(d, p) {
  const { bounds } = d.footprint, rows = [];
  const glyph = e => ({ foundry: 'F', 'assembling-machine-3': 'A', 'chemical-plant': 'C', 'electric-furnace': 'K', 'storage-tank': 'T', pump: 'p', substation: 'S', 'fast-transport-belt': { 0: '^', 4: '>', 8: 'v', 12: '<' }[e.direction || 0], pipe: '=', 'pipe-to-ground': 'u', 'fast-inserter': 'i', 'bulk-inserter': 'b', 'long-handed-inserter': 'l', 'passive-provider-chest': 'P', 'steel-chest': 'B', 'display-panel': '!', 'constant-combinator': 'c', 'decider-combinator': 'd', 'arithmetic-combinator': 'a', 'selector-combinator': 's' }[e.name] || '?');
  const grid = new Map();
  for (const e of d.blueprint.blueprint.entities) { const b = box(e, p, 'selection_box'); for (let x = Math.floor(b.left + 0.01); x < Math.ceil(b.right - 0.01); x++) for (let y = Math.floor(b.top + 0.3); y < Math.ceil(b.bottom - 0.01); y++) grid.set(`${x},${y}`, glyph(e)); }
  for (let y = bounds.top; y < bounds.bottom; y++) { let line = ''; for (let x = bounds.left; x < bounds.right; x++) line += grid.get(`${x},${y}`) || '.'; rows.push(String(y).padStart(4) + ' ' + line); }
  return rows.join('\n');
}
