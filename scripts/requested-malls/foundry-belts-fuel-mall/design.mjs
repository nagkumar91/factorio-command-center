// Layout and control program of the foundry belts and fuel mall: the foundry mall without the assembling machine 3
// line and the platform kit, re-packed, with the rocket fuel supply attached below it as a section of its own.
// Pure function of the pinned prototypes and a few knobs; generate.mjs writes the published files.
//
// Tiles: x east from 0, y south from 0; an entity at tile (x, y) has its centre at (x + .5, y + .5); multi-tile
// entities are placed by their top-left tile. 34 wide. Rows, north to south:
//    0, 1       north strip: the calcite, plastic and tungsten carbide entrances, the four chests, the caps, rule bank
//    2          arms between the strip and the ring
//    3 .. 8     the ring (one closed clockwise loop of red belt, 34 x 6) around the circuit machines, U1 (the small
//               finals), the refined concrete machine, the brick furnace and the two shadow machines; their arms on row 7
//    9          arms between the ring and the casting band
//   10 .. 14    casting band, west to east: cable foundry, molten copper foundry, the lava column, molten iron foundry,
//               the one casting foundry (plate, gear, stick, concrete, steel), the belt foundry U2, the lubricant tank
//   15, 16      lava pipe and iron pipes, the stone arms and the stone belt, the water pump and the water entrance
//   17 .. 26    the rocket fuel section: the stand-alone rocket fuel supply tile for tile (three refineries, two
//               crackers, three solid fuel plants, three assemblers), its exit belt turned into a chest
import assert from 'node:assert/strict';
import { sha, encodeKeeping, distance, envelope, technologyClosure, box, blueprintVersion, FUEL } from './lib.mjs';
import { products as productList, GROUP_NAMES, FUEL_STACKS } from './bill.mjs';

const N = 0, E = 4, S = 8, W = 12;
export const LEVEL = { 1: 4, 2: 3, 3: 2, 4: 1 };  // priority group -> level signal (higher runs first)
export const WEIGHT = (level, rank) => level * 100000 + rank * 1000;
// Ring stock limits. `arm`: an arm that adds the item to the ring works only while the ring holds fewer (ring reader).
// `rule`: a recipe-switching machine is told to make the item only while the stock in sight holds fewer.
export const RING_ARM_CAPS = Object.freeze({ 'copper-cable': 24, 'electronic-circuit': 30, 'advanced-circuit': 14, 'refined-concrete': 30, 'plastic-bar': 12, 'tungsten-carbide': 8, calcite: 8, stone: 6, 'stone-brick': 10 });
export const RING_RULE_CAPS = Object.freeze({
  'iron-plate': 24, 'steel-plate': 20, 'iron-gear-wheel': 30, 'iron-stick': 8, concrete: 40,
  'transport-belt': 12, 'underground-belt': 6, splitter: 3, 'fast-transport-belt': 6, 'fast-underground-belt': 6, 'fast-splitter': 3, inserter: 8, 'fast-inserter': 6,
});
// The belt foundry's products and, when it gives a recipe up, the ingredients it had loaded go into a buffer chest; one
// arm puts an item from the chest on the ring only while the ring holds fewer than this (finished products: FINAL_ON_RING).
export const FINAL_ON_RING = 8;
export const TANK_READY = 500;          // lubricant counts as present while its tank holds at least this much
export const STALL = Object.freeze({ U1: 54000, U2: 18000 });  // ticks without progress before a switching machine gives up a recipe it cannot start
export const LEVEL_HOLD = 7200;   // ticks a lower level must last before the level in force drops to it
export const IDLE_WEIGHT = 50000, REAL_WEIGHT = 100000;
export const FUEL_ROW = 17;       // the fuel section's row 0
// Entrance figures for the panels (a minute). Fuel: from the recipes at 12 rocket fuel a minute (calcite rounded up).
// Mall part: lava and calcite are both lava foundries flat out, plastic is the one advanced circuit machine flat out;
// tungsten carbide, lubricant and water are set above the highest draw the native rate windows measured.
export const PANEL = Object.freeze({ lava: 15000, calcite: 30, 'plastic-bar': 30, 'tungsten-carbide': 40, lubricant: 160, waterMall: 750, 'sulfuric-acid': 880, coal: 352, 'calcite-fuel': 71, waterFuel: 1320, [FUEL]: 12 });
const SIZE = { foundry: 5, 'oil-refinery': 5, 'assembling-machine-3': 3, 'chemical-plant': 3, 'electric-furnace': 3, 'storage-tank': 3, substation: 2 };
const COMBINATORS = ['decider-combinator', 'arithmetic-combinator', 'selector-combinator'];
const item = name => ({ name }), recipe = name => ({ type: 'recipe', name }), fluid = name => ({ type: 'fluid', name }), virtual = name => ({ type: 'virtual', name });
const EACH = virtual('signal-each'), EVERYTHING = virtual('signal-everything');
const networks = n => ({ red: n.includes('R'), green: n.includes('G') });
const atom = (signal, nets, comparator, rhs, rhsNets = 'RG') => ({ first_signal: signal, first_signal_networks: networks(nets), comparator, ...(typeof rhs === 'number' ? { constant: rhs } : { second_signal: rhs, second_signal_networks: networks(rhsNets) }) });
const dnf = terms => terms.flatMap((term, t) => term.map((a, i) => ({ ...a, ...(t === 0 && i === 0 ? {} : { compare_type: i === 0 ? 'or' : 'and' }) })));
const whitelist = names => ({ use_filters: true, filter_mode: 'whitelist', filters: names.map((name, i) => ({ index: i + 1, name, quality: 'normal', comparator: '=' })) });

export function design(p, options = {}) {
  assert(/^2\.1\.\d+$/.test(p.gameVersion));
  const PRODUCTS = productList(p);
  const CAPS = Object.fromEntries(PRODUCTS.map(v => [v.key, v.cap]));
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
  const panel = (x, y, text, name, type = 'item') => { assert(y > 0, 'a panel on the top row would reach over the edge'); const e = add('display-panel', x, y, { text, always_show: true, icon: type === 'item' ? { name } : { type, name } }); M.panels.push({ entity: e.entity_number, text }); return e; };
  const belt = (x, y, direction, extra = {}) => add('fast-transport-belt', x, y, { direction, ...extra });
  const pipe = (x, y) => add('pipe', x, y);
  const ptg = (x, y, open) => add('pipe-to-ground', x, y, { direction: open });
  // An arm's blueprint direction is the side it picks up from; it drops on the opposite side. Hand sizes are pinned.
  const HAND = { 'fast-inserter': 1, 'bulk-inserter': 2 };
  function arm(kind, x, y, from, role, o = {}) {
    const e = add(kind, x, y, { direction: from, override_stack_size: HAND[kind], ...(o.items ? whitelist(o.items) : {}), ...(o.blacklist ? { use_filters: true, filter_mode: 'blacklist' } : {}), ...(o.setFilters && !o.blacklist ? { use_filters: true } : {}) });
    const cb = {};
    if (o.cap) { cb.circuit_enabled = true; cb.circuit_condition = { first_signal: item(o.cap), comparator: '<', constant: armCaps[o.cap] }; join('RING', RED, e); }
    if (o.deficit) { cb.circuit_enabled = true; cb.circuit_condition = { first_signal: item(o.deficit), comparator: '<', constant: 0 }; join('GREEN', GREEN, e); }
    if (o.setFilters) cb.circuit_set_filters = true;
    if (o.hand) { cb.circuit_read_hand_contents = true; cb.circuit_hand_read_mode = 1; }
    if (Object.keys(cb).length) e.control_behavior = cb;
    M.arms.push({ entity: e.entity_number, kind, role, ...(o.items ? { items: o.items } : {}), ...(o.cap ? { ringCap: o.cap, limit: armCaps[o.cap] } : {}), ...(o.deficit ? { deficit: o.deficit } : {}), ...(o.from ? { from: o.from } : {}), ...(o.to ? { to: o.to } : {}), ...(o.section ? { section: o.section } : {}) });
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
  const copyOf = (x, y, vertical) => comb('arithmetic-combinator', x, y, vertical, { arithmetic_conditions: { first_signal: EACH, second_constant: 1, operation: '*', output_signal: EACH } });

  // =================================================================== the ring (rows 3 and 8, columns 0 and 33)
  const RX0 = 0, RX1 = 33, RY0 = 3, RY1 = 8;
  const ring = [];
  const rb = (x, y, d) => ring.push(belt(x, y, d, { control_behavior: { circuit_read_hand_contents: false, circuit_contents_read_mode: 0 } }));
  for (let x = RX0; x < RX1; x++) rb(x, RY0, E);
  for (let y = RY0; y < RY1; y++) rb(RX1, y, S);
  for (let x = RX1; x > RX0; x--) rb(x, RY1, W);
  for (let y = RY1; y > RY0; y--) rb(RX0, y, N);
  const reader = ring[14];
  reader.control_behavior = { circuit_read_hand_contents: true, circuit_contents_read_mode: 2 };
  for (const b of ring) join('RING', RED, b);

  // =================================================================== casting band (rows 10..14) and the two rows under it
  // Fluid ports (measured in 2.1): a recipe with one fluid ingredient uses both input ports of a machine as one box, a
  // recipe with one fluid product both output ports, and a recipe change pushes what is left in a box out through any of
  // its ports. So no machine has two ports of one kind on the pipes of two fluids: the casting foundry gets its water
  // through a pump standing on that port. The lava foundries lie on their sides: lava in on one side, metal out on the
  // other, straight into the next foundry's ports.
  const cableFoundry = machine('foundry', 0, 10, 'cable', { direction: W, recipe: 'casting-copper-cable' });
  const moltenCopper = machine('foundry', 6, 10, 'molten-copper', { direction: W, recipe: 'molten-copper-from-lava' });
  const moltenIron = machine('foundry', 12, 10, 'molten-iron', { direction: E, recipe: 'molten-iron-from-lava' });
  const caster = machine('foundry', 18, 10, 'caster-C', { direction: N, control_behavior: { set_recipe: true, read_contents: true } }, { switching: true });
  const u2 = machine('foundry', 24, 10, 'U2', { direction: N, control_behavior: { set_recipe: true, read_contents: true, read_working: true, working_signal: virtual('signal-W'), read_recipe_finished: true, recipe_finished_signal: virtual('signal-P') } }, { switching: true });
  const copperPipes = [pipe(5, 11), pipe(5, 13)];
  // lava: entrance on the west edge of row 15, under the copper foundry's stone arm, up the column between the two lava foundries
  const lava = []; for (let x = 0; x <= 6; x++) lava.push(pipe(x, 15));
  lava.push(ptg(7, 15, W), ptg(9, 15, E), pipe(10, 15), pipe(11, 15), pipe(11, 14), pipe(11, 13), pipe(11, 12), pipe(11, 11));
  // molten iron: from the iron lava foundry's lower east port down and along row 15 to the casting foundry's first port
  const ironPipes = [pipe(17, 13), pipe(17, 14), pipe(17, 15), pipe(18, 15), pipe(19, 15)];
  // stone: one arm under each lava foundry, the belt on row 16 leaves west
  arm('bulk-inserter', 8, 15, N, 'stone out', { from: moltenCopper.entity_number });
  arm('bulk-inserter', 14, 15, N, 'stone out', { from: moltenIron.entity_number });
  const stoneBelt = []; for (let x = 14; x >= 0; x--) stoneBelt.push(belt(x, 16, W));
  // lubricant: tank in the band, pipes under the belt foundry, entrance on the east edge of row 14
  const lubTank = add('storage-tank', 29, 12);
  const lubPipes = [pipe(33, 14), pipe(32, 14)]; for (let x = 31; x >= 25; x--) lubPipes.push(pipe(x, 15));
  join('GREEN', GREEN, lubTank);

  // =================================================================== rocket fuel section (rows 17..26)
  // The stand-alone rocket fuel supply (scripts/vulcanus-supplies/rocket-fuel), tile for tile, 17 rows down. Changed:
  // its exit belt ends at an arm into a passive provider chest, its four output arms work only while that chest is
  // below its cap, and its water pipe is fed from the mall's water entrance through the row above.
  const fy = y => y + FUEL_ROW;
  const refineries = [2, 7, 12].map((x, i) => machine('oil-refinery', x, fy(1), `liquefaction-${i + 1}`, { recipe: 'simple-coal-liquefaction', direction: S }, { section: 'fuel' }));
  const crackers = [machine('chemical-plant', 18, fy(1), 'heavy-cracking-1', { recipe: 'heavy-oil-cracking', mirror: true }, { section: 'fuel' }), machine('chemical-plant', 22, fy(1), 'heavy-cracking-2', { recipe: 'heavy-oil-cracking' }, { section: 'fuel' })];
  const pairs = [{ sx: 25, ax: 29, y: 1, dir: S, n: 1 }, { sx: 18, ax: 22, y: 5, dir: N, n: 2 }, { sx: 25, ax: 29, y: 5, dir: N, n: 3 }].map(v => ({ ...v,
    solid: machine('chemical-plant', v.sx, fy(v.y), `solid-fuel-${v.n}`, { recipe: 'solid-fuel-from-light-oil', ...(v.dir ? { direction: v.dir } : {}) }, { section: 'fuel' }),
    rocket: machine('assembling-machine-3', v.ax, fy(v.y), `rocket-fuel-${v.n}`, { recipe: 'rocket-fuel', ...(v.dir ? { direction: v.dir } : {}) }, { section: 'fuel' }) }));
  const acidPipes = []; for (let x = 0; x <= 15; x++) acidPipes.push(pipe(x, fy(0)));
  const coalEntrance = belt(0, fy(6), E), calciteFuelEntrance = belt(0, fy(8), E);
  const fuelBelt = [belt(1, fy(6), S), belt(1, fy(8), N)]; for (let x = 1; x <= 15; x++) fuelBelt.push(belt(x, fy(7), E));
  const heavyPipes = [];
  refineries.forEach((r, i) => {
    const cx = [4, 9, 14][i];
    for (const x of [cx - 1, cx, cx + 1]) arm('fast-inserter', x, fy(6), S, 'coal and calcite in', { to: r.entity_number, section: 'fuel' });
    heavyPipes.push(ptg(cx + 2, fy(6), N), ptg(cx + 2, fy(8), S), pipe(cx + 2, fy(9)));
  });
  for (let x = 7; x <= 17; x++) if (![11, 16].includes(x)) heavyPipes.push(pipe(x, fy(9)));
  heavyPipes.push(ptg(17, fy(8), S), ptg(17, fy(1), N), pipe(17, fy(0)), pipe(18, fy(0)), ptg(19, fy(0), W), ptg(23, fy(0), E), pipe(24, fy(0)));
  const fuelWater = [pipe(20, fy(0)), pipe(21, fy(0)), pipe(22, fy(0))];
  const lightPipes = []; for (let x = 18; x <= 30; x++) lightPipes.push(pipe(x, fy(4)));
  for (const v of pairs) arm('fast-inserter', v.sx + 3, fy(v.y + 1), W, 'solid fuel hand-off', { from: v.solid.entity_number, to: v.rocket.entity_number, section: 'fuel' });
  // rocket fuel: three arms onto one belt (row 26 east, up column 32, into column 33 flowing south), one arm into the chest
  const fuelOutBelt = []; for (let x = 23; x <= 31; x++) fuelOutBelt.push(belt(x, fy(9), E));
  fuelOutBelt.push(belt(32, fy(9), N), belt(32, fy(8), N), belt(32, fy(7), E));
  for (let y = 2; y <= 7; y++) fuelOutBelt.push(belt(33, fy(y), S));
  const fuelChest = add('passive-provider-chest', 33, fy(9));
  join('GREEN', GREEN, fuelChest);
  const fuelArms = [
    arm('fast-inserter', 32, fy(2), W, 'rocket fuel out', { deficit: FUEL, from: pairs[0].rocket.entity_number, section: 'fuel' }),
    arm('fast-inserter', 23, fy(8), N, 'rocket fuel out', { deficit: FUEL, from: pairs[1].rocket.entity_number, section: 'fuel' }),
    arm('fast-inserter', 30, fy(8), N, 'rocket fuel out', { deficit: FUEL, from: pairs[2].rocket.entity_number, section: 'fuel' }),
    arm('fast-inserter', 33, fy(8), N, 'chest', { deficit: FUEL, section: 'fuel' }),
  ];
  const fuelSubs = [add('substation', 4, fy(8)), add('substation', 18, fy(8)), add('substation', 32, fy(0))];

  // =================================================================== water (rows 15, 16): one entrance for both parts
  // Entrance on the east edge of row 16, under the ground to the pipe over the fuel section's water inlet. The casting
  // foundry's water port is fed by a pump standing on it; the refined concrete machine by an underground pipe.
  const waterPump = add('pump', 21, 15, { direction: N });
  const waterPipes = [pipe(22, 16), ptg(23, 16, W), ptg(33, 16, E), pipe(20, 16), ptg(20, 15, S), ptg(20, 7, N)];

  // =================================================================== ring arms of the casting band (row 9)
  arm('bulk-inserter', 4, 9, S, 'ring feed', { items: ['copper-cable'], cap: 'copper-cable', from: cableFoundry.entity_number });
  arm('fast-inserter', 8, 9, N, 'ring input', { items: ['calcite'], to: moltenCopper.entity_number });
  arm('fast-inserter', 14, 9, N, 'ring input', { items: ['calcite'], to: moltenIron.entity_number });
  arm('fast-inserter', 16, 9, S, 'ring feed', { items: ['stone'], cap: 'stone', from: moltenIron.entity_number });
  for (const x of [18, 20]) arm('bulk-inserter', x, 9, S, 'switching output', { from: caster.entity_number });
  arm('fast-inserter', 22, 9, N, 'ring input', { items: ['stone-brick'], to: caster.entity_number });
  const u2In = [24, 25, 26].map(x => arm('bulk-inserter', x, 9, N, 'switching input', { blacklist: true, setFilters: true, to: u2.entity_number }));
  // Everything that leaves the belt foundry goes into a buffer chest first (east of it), and from there onto the ring
  // item by item while the ring has room for that item. Measured without the chest: when the foundry gave up a
  // half-loaded recipe it put some 150 ingredients on the ring at once, the lane filled, its arms could not empty it,
  // and a foundry that cannot be emptied takes no new recipe: the mall stood still.
  const u2Buffer = add('steel-chest', 30, 10);
  const u2Out = [arm('bulk-inserter', 29, 10, W, 'switching output to buffer', { from: u2.entity_number, to: u2Buffer.entity_number, hand: true })];
  const bufferArm = arm('bulk-inserter', 30, 9, S, 'buffer to ring', { setFilters: true, hand: 'HANDS', from: u2Buffer.entity_number });

  // =================================================================== inside the ring (machines rows 4..6, arms row 7)
  const inside = (recipeName, x, extra = {}) => machine('assembling-machine-3', x, 4, recipeName, { recipe: recipeName, ...extra });
  const ec = inside('electronic-circuit', 1);
  for (const x of [1, 2]) arm('bulk-inserter', x, 7, S, 'ring input', { items: ['iron-plate', 'copper-cable'], to: ec.entity_number });
  arm('bulk-inserter', 3, 7, N, 'ring feed', { items: ['electronic-circuit'], cap: 'electronic-circuit', from: ec.entity_number });
  const ac = inside('advanced-circuit', 4);
  for (const x of [4, 5]) arm('bulk-inserter', x, 7, S, 'ring input', { items: ['electronic-circuit', 'plastic-bar', 'copper-cable'], to: ac.entity_number });
  arm('fast-inserter', 6, 7, N, 'ring feed', { items: ['advanced-circuit'], cap: 'advanced-circuit', from: ac.entity_number });
  const u1 = machine('assembling-machine-3', 9, 4, 'U1', { control_behavior: { set_recipe: true, read_contents: true, read_working: true, working_signal: virtual('signal-W'), read_recipe_finished: true, recipe_finished_signal: virtual('signal-P') } }, { switching: true });
  const u1Shadow = machine('assembling-machine-3', 12, 4, 'U1-shadow', { control_behavior: { set_recipe: true, read_ingredients: true } }, { shadow: true });
  const u1In = [9, 10].map(x => arm('bulk-inserter', x, 7, S, 'switching input', { blacklist: true, setFilters: true, to: u1.entity_number }));
  const u1Out = [arm('bulk-inserter', 11, 7, N, 'switching output', { from: u1.entity_number, hand: true })];
  // brick furnace: stone comes off the ring (the iron lava foundry puts a little on it), bricks go back onto it
  const furnace = machine('electric-furnace', 15, 4, 'stone-brick');
  arm('fast-inserter', 15, 7, S, 'ring input', { items: ['stone'], to: furnace.entity_number });
  arm('fast-inserter', 17, 7, N, 'ring feed', { items: ['stone-brick'], cap: 'stone-brick', from: furnace.entity_number });
  // refined concrete: its own machine (water from below, under the casting band and the ring)
  const refined = inside('refined-concrete', 19, { direction: S });
  arm('bulk-inserter', 19, 7, S, 'ring input', { items: ['concrete', 'iron-stick', 'steel-plate'], to: refined.entity_number });
  arm('bulk-inserter', 21, 7, N, 'ring feed', { items: ['refined-concrete'], cap: 'refined-concrete', from: refined.entity_number });
  const u2Shadow = machine('assembling-machine-3', 27, 4, 'U2-shadow', { control_behavior: { set_recipe: true, read_ingredients: true } }, { shadow: true });
  const subs = { west: add('substation', 7, 6), east: add('substation', 25, 6) };

  // =================================================================== north strip: entrances and chests
  // an entrance: two belt tiles from the north edge, one arm onto the ring
  const entranceBelt = (x, itemName) => { const tiles = [belt(x, 0, S), belt(x, 1, S)]; arm('fast-inserter', x, 2, N, 'entrance to ring', { items: [itemName], cap: itemName }); return tiles; };
  const calciteBelt = entranceBelt(1, 'calcite'), plasticBelt = entranceBelt(3, 'plastic-bar'), carbideBelt = entranceBelt(5, 'tungsten-carbide');
  const CHESTS = [
    { id: 'OUT-1', x: 22, label: 'OUT: express belt, underground, splitter', icon: 'express-transport-belt', items: ['express-transport-belt', 'express-underground-belt', 'express-splitter'] },
    { id: 'OUT-2', x: 24, label: 'OUT: fast + bulk inserter', icon: 'bulk-inserter', items: ['fast-inserter', 'bulk-inserter'] },
    { id: 'OUT-3', x: 26, label: 'OUT: electric mining drill', icon: 'electric-mining-drill', items: ['electric-mining-drill'] },
    { id: 'OUT-4', x: 28, label: 'OUT: foundry', icon: 'foundry', items: ['foundry'] },
  ];
  for (const c of CHESTS) {
    c.chest = add('passive-provider-chest', c.x, 1); join('GREEN', GREEN, c.chest);
    c.panel = panel(c.x + 1, 1, c.label, c.icon);
    c.arm = c.items.length === 1 ? arm('fast-inserter', c.x, 2, S, 'chest', { items: c.items, deficit: c.items[0] }) : arm('fast-inserter', c.x, 2, S, 'chest', { setFilters: true, hand: 'HANDS' });
  }
  const fuelOut = { id: 'OUT-5', label: `OUT: rocket fuel ${PANEL[FUEL]}/min (chest)`, icon: FUEL, items: [FUEL], chest: fuelChest, arm: fuelArms[3], panel: panel(31, fy(8), `OUT: rocket fuel ${PANEL[FUEL]}/min (chest)`, FUEL) };

  // =================================================================== the control program
  const wanted = n => atom(item(n), 'RG', '<', 0), wantedTwo = n => atom(item(n), 'RG', '<', -1);
  const have = (n, k) => atom(item(n), 'R', '≥', k);
  const below = (n, k) => atom(item(n), 'R', '<', k ?? ruleCaps[n]);
  const self = r => atom(recipe(r), 'G', '>', 0);
  const lub = atom(fluid('lubricant'), 'G', '≥', TANK_READY);
  const half = n => Math.ceil(ruleCaps[n] / 2);
  const ALWAYS = atom(virtual('signal-L'), 'G', '≥', 0);
  // A recipe-switching machine that reads its own contents must never be left without a recipe signal, so each is
  // parked on a recipe it can never start: its ingredients never come within reach of its arms.
  const IDLE = { foundry: 'iron-ore-melting', 'assembling-machine-3': 'wooden-chest' };
  const idleNow = r => atom(recipe(r), 'R', '=', 0), craftingNow = r => atom(recipe(r), 'R', '>', 0);
  // The condition of a rule in two halves: while the machine is not crafting r, one craft's ingredients must be in sight;
  // while it crafts r, a second craft's must be, and for a final the product must be short by more than the craft in progress.
  const twoPhase = (r, first, second, haves) => [[...first, idleNow(r), ...haves.map(([n, k]) => have(n, k))], [...second, craftingNow(r), ...haves.map(([n, k]) => have(n, 2 * k))]];
  const cross = (alternatives, f) => alternatives.flatMap(f);
  const final = (pr, o = {}) => cross(o.alt || [[]], alt => twoPhase(pr, [...(o.first || [wanted(pr)]), ...(o.extra || []), ...alt], [...(o.second || [wantedTwo(pr)]), ...(o.extra || []), ...alt], o.have || []));
  const batch = (i, lo, hi, o = {}) => cross(o.alt || [[]], alt => [...twoPhase(i, [...alt, below(i, lo)], [...alt, below(i, lo)], o.have || []), ...twoPhase(i, [...alt, self(i), below(i, hi)], [...alt, self(i), below(i, hi)], o.have || [])]);
  const cast = (r, i, base = []) => [[...base, below(i, half(i))], [...base, self(r), below(i)]];
  const forBulk = [atom(item('fast-inserter'), 'RG', '≥', 0), wanted('bulk-inserter'), have('advanced-circuit', 1)];
  const EB = 'express-transport-belt', EUG = 'express-underground-belt', ES = 'express-splitter';
  const RULES = [
    // ---- U2: the foundry that makes the three belt tiers and the foundry itself (lubricant on its fluid box)
    { m: 'U2', r: 'transport-belt', g: 1, k: 99, t: batch('transport-belt', 5, ruleCaps['transport-belt'], { alt: [[wanted(EB), lub], [wanted(EUG), lub], [wanted(ES), lub]] }) },
    { m: 'U2', r: 'underground-belt', g: 1, k: 97, t: batch('underground-belt', 2, ruleCaps['underground-belt'], { alt: [[wanted(EUG), lub]], have: [['transport-belt', 5]] }) },
    { m: 'U2', r: 'splitter', g: 1, k: 95, t: batch('splitter', 1, ruleCaps.splitter, { alt: [[wanted(ES), lub, have('advanced-circuit', 10)]], have: [['transport-belt', 4]] }) },
    { m: 'U2', r: 'fast-transport-belt', g: 1, k: 93, t: batch('fast-transport-belt', 1, ruleCaps['fast-transport-belt'], { alt: [[wanted(EB), lub]], have: [['transport-belt', 1]] }) },
    { m: 'U2', r: 'fast-underground-belt', g: 1, k: 91, t: batch('fast-underground-belt', 2, ruleCaps['fast-underground-belt'], { alt: [[wanted(EUG), lub]], have: [['underground-belt', 2]] }) },
    { m: 'U2', r: 'fast-splitter', g: 1, k: 89, t: batch('fast-splitter', 1, ruleCaps['fast-splitter'], { alt: [[wanted(ES), lub, have('advanced-circuit', 10)]], have: [['splitter', 1]] }) },
    { m: 'U2', r: EB, g: 1, k: 87, t: final(EB, { extra: [lub], have: [['fast-transport-belt', 1]] }) },
    { m: 'U2', r: EUG, g: 1, k: 85, t: final(EUG, { extra: [lub], have: [['fast-underground-belt', 2]] }) },
    { m: 'U2', r: ES, g: 1, k: 83, t: final(ES, { extra: [lub], have: [['advanced-circuit', 10], ['fast-splitter', 1]] }) },
    { m: 'U2', r: 'foundry', g: 4, k: 30, t: final('foundry', { extra: [lub], have: [['tungsten-carbide', 4], ['refined-concrete', 20]] }) },
    // ---- U1: the assembling machine 3 that makes the inserters and the drills
    { m: 'U1', r: 'inserter', g: 2, k: 61, t: batch('inserter', 1, ruleCaps.inserter, { alt: [[wanted('fast-inserter')], forBulk] }) },
    { m: 'U1', r: 'fast-inserter', g: 2, k: 60, t: [...final('fast-inserter', { have: [['inserter', 1]] }), ...batch('fast-inserter', 1, ruleCaps['fast-inserter'], { alt: [forBulk], have: [['inserter', 1]] })] },
    { m: 'U1', r: 'bulk-inserter', g: 2, k: 58, t: final('bulk-inserter', { extra: [atom(item('fast-inserter'), 'RG', '≥', 0)], have: [['advanced-circuit', 1], ['fast-inserter', 1]] }) },
    { m: 'U1', r: 'electric-mining-drill', g: 3, k: 50, t: final('electric-mining-drill') },
    // ---- the casting foundry (weights are ranks only; they never reach the level network). Each item is cast
    // from half its limit up to the limit (a latch, so the foundry does not flip between recipes).
    { m: 'caster-C', r: 'casting-iron', k: 6, t: cast('casting-iron', 'iron-plate') },
    { m: 'caster-C', r: 'casting-iron-gear-wheel', k: 5, t: cast('casting-iron-gear-wheel', 'iron-gear-wheel') },
    { m: 'caster-C', r: 'casting-iron-stick', k: 3, t: cast('casting-iron-stick', 'iron-stick', [wanted('foundry')]) },
    { m: 'caster-C', r: 'concrete-from-molten-iron', k: 2, t: cast('concrete-from-molten-iron', 'concrete', [wanted('foundry'), have('stone-brick', 5)]) },
    { m: 'caster-C', r: 'casting-steel', k: 1, t: cast('casting-steel', 'steel-plate') },
    { m: 'caster-C', r: IDLE.foundry, idle: true, t: [[ALWAYS]] },
  ];
  // ---- cells: two-tile places for combinators. Vertical cells [x, y] cover (x, y) and (x, y + 1); horizontal cells
  // [x, y, false] cover (x, y) and (x + 1, y).
  const V = (x, y) => [x, y, true], H = (x, y) => [x, y, false];
  const BANK = { // by machine: rule deciders first, then the machine's selector
    U1: [V(8, 0), V(9, 0), V(10, 0), V(11, 0), V(12, 0)],
    U2: [V(13, 0), V(14, 0), V(15, 0), V(16, 0), V(17, 0), V(18, 0), V(19, 0), V(20, 0), V(21, 0), H(18, 2), H(20, 2)],
    'caster-C': [V(23, 10), V(17, 10), H(22, 15), H(15, 15), V(24, 6), H(12, 15), V(23, 12)],
  };
  const selector = (x, y, vertical) => comb('selector-combinator', x, y, vertical, { operation: 'select', select_max: true, index_constant: 0 });
  const selectors = {};
  for (const name of ['U2', 'U1', 'caster-C']) {
    const cells = [...BANK[name]];
    for (const rule of RULES.filter(v => v.m === name)) {
      const [x, y, vertical] = cells.shift();
      const weight = rule.idle ? 1 : rule.g ? WEIGHT(LEVEL[rule.g], rule.k) : rule.k * 1000;
      const d = decider(x, y, vertical, rule.t, [{ signal: recipe(rule.r), copy_count_from_input: false, constant: weight }]);
      // a casting rule counts the ring and the casting foundry only: what a machine has loaded is no longer stock
      join(name.startsWith('caster') ? 'CAST' : 'LOOSE', RED, d, 'in'); join('GREEN', GREEN, d, 'in');
      join('CAND-' + name, RED, d, 'out');
      // a product rule is a candidate for the level; a casting rule only shows itself on GREEN (its latch reads it there)
      if (rule.g) join('ACT', GREEN, d, 'out'); else if (!rule.idle) join('GREEN', GREEN, d, 'out');
      M.rules.push({ entity: d.entity_number, machine: rule.m, recipe: rule.r, ...(rule.g ? { group: rule.g, level: LEVEL[rule.g] } : {}), ...(rule.idle ? { idle: true } : {}), weight, terms: rule.t.length });
    }
    selectors[name] = selector(...cells.shift());
    join('CAND-' + name, RED, selectors[name], 'in');
    assert.equal(cells.length, 0, name + ' bank cells left over');
  }
  // global: level = floor(top weight / 100000), the floor of the level's weight band, candidates copied onto GREEN
  const top = comb('selector-combinator', 0, 0, true, { operation: 'select', select_max: true, index_constant: 0 });
  join('ACT', GREEN, top, 'in'); join('TOP', RED, top, 'out');
  const levelCalc = comb('arithmetic-combinator', 7, 0, true, { arithmetic_conditions: { first_signal: EACH, second_constant: 100000, operation: '/', output_signal: virtual('signal-L') } });
  join('TOP', RED, levelCalc, 'in'); join('LEVEL-NOW', GREEN, levelCalc, 'out');
  // The level in force: it rises at once and falls only after the lower reading has lasted LEVEL_HOLD ticks.
  const L_ = virtual('signal-L'), A_ = virtual('signal-A');
  const levelRise = decider(6, 2, false, [[atom(L_, 'G', '≥', L_, 'R')], [atom(A_, 'R', '>', LEVEL_HOLD)]], [{ signal: L_, copy_count_from_input: true, networks: networks('G') }]);
  const levelKeep = decider(8, 2, false, [[atom(L_, 'G', '<', L_, 'R'), atom(A_, 'R', '≤', LEVEL_HOLD)]], [{ signal: L_, copy_count_from_input: true, networks: networks('R') }, { signal: A_, copy_count_from_input: true, networks: networks('R') }, { signal: A_, copy_count_from_input: false, constant: 1 }]);
  for (const d of [levelRise, levelKeep]) { join('LEVEL-NOW', GREEN, d, 'in'); join('LEVEL', RED, d, 'in'); join('LEVEL', RED, d, 'out'); join('GREEN', GREEN, d, 'out'); }
  const floorCalc = comb('arithmetic-combinator', 10, 2, false, { arithmetic_conditions: { first_signal: virtual('signal-L'), second_constant: 100000, operation: '*', output_signal: virtual('signal-F') } });
  join('LEVEL', RED, floorCalc, 'in'); join('GREEN', GREEN, floorCalc, 'out');
  const actCopy = copyOf(12, 2, false);
  join('ACT', GREEN, actCopy, 'in'); join('GREEN', GREEN, actCopy, 'out');
  // the ring is copied once for the casting rules (with the casting foundry's contents) and once for everything else
  const ringCopy = copyOf(9, 9, false);
  join('RING', RED, ringCopy, 'in'); join('CAST', RED, ringCopy, 'out');
  const castCopy = copyOf(11, 9, false);
  join('RING', RED, castCopy, 'in'); join('LOOSE', RED, castCopy, 'out');
  // the casting foundry takes its recipe straight from its selector; its contents count as stock for its rules
  join('SET-caster-C', RED, selectors['caster-C'], 'out'); join('SET-caster-C', RED, caster);
  const casterCopy = copyOf(24, 16, false);
  join('SET-caster-C', RED, casterCopy, 'in'); join('CAST', RED, casterCopy, 'out');

  // Per recipe-switching machine (U1, U2): see the foundry mall's design for the full account. The recipe in force is
  // frozen while the machine loads and crafts; it follows the pick only on the tick a craft finishes, while the
  // machine is parked, or after `stall` ticks without a finished craft.
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
    const timer = decider(...cells.timer, [[atom(H_, 'R', '>', 0), atom(P_, 'R', '=', 0), atom(T_, 'R', '<', 1000000)]], [{ signal: T_, copy_count_from_input: true, networks: networks('R') }, { signal: T_, copy_count_from_input: false, constant: 1 }]);
    // "parked": no real recipe is in force, or a craft has just finished and the pick is to park (so the recipe wire is never empty)
    const boot = decider(...cells.boot, [[atom(EVERYTHING, 'R', '<', REAL_WEIGHT)], [atom(P_, 'R', '>', 0), atom(recipe(IDLE[m.name]), 'G', '>', 0)]], [{ signal: B_, copy_count_from_input: false, constant: 1 }]);
    join('NEW-' + name, GREEN, take, 'in'); join('NEW-' + name, GREEN, boot, 'in');
    for (const [e, side] of [[take, 'in'], [take, 'out'], [hold, 'in'], [hold, 'out'], [timer, 'in'], [timer, 'out'], [boot, 'in'], [boot, 'out'], [m, 'io']]) join(SET, RED, e, side);
    const copy = decider(...cells.copy, [[atom(EACH, 'R', '<', IDLE_WEIGHT)]], pass('R'));
    join(SET, RED, copy, 'in'); join('LOOSE', RED, copy, 'out');
    const pending = decider(...cells.pending, [[atom(W_, 'R', '>', 0), atom(EACH, 'R', '≥', REAL_WEIGHT)], [atom(P_, 'R', '>', 0), atom(EACH, 'R', '≥', REAL_WEIGHT)]], [{ signal: EACH, copy_count_from_input: false, constant: 1 }]);
    join(SET, RED, pending, 'in'); join('LOOSE', RED, pending, 'out');
    const diode = decider(...cells.diode, [[atom(EACH, 'R', '≥', IDLE_WEIGHT)]], pass('R'));
    join(SET, RED, diode, 'in'); join('NEED-' + name, GREEN, diode, 'out'); join('NEED-' + name, GREEN, shadow);
    const negate = comb('arithmetic-combinator', ...cells.negate, { arithmetic_conditions: { first_signal: EACH, second_constant: -1, operation: '*', output_signal: EACH } });
    join('NEED-' + name, GREEN, negate, 'in');
    const delay = copyOf(...cells.delay);
    join(SET, RED, delay, 'in');
    const limiter = decider(...cells.limiter, [[atom(EACH, 'G', '<', 0), atom(EACH, 'G', '>', -IDLE_WEIGHT), atom(EACH, 'RG', '≥', 0)]], [{ signal: EACH, copy_count_from_input: false, constant: 1 }]);
    join('DELAY-' + name, RED, delay, 'out'); join('DELAY-' + name, RED, limiter, 'in'); join('NEG-' + name, GREEN, negate, 'out'); join('NEG-' + name, GREEN, limiter, 'in');
    join('LOAD-' + name, RED, limiter, 'out'); for (const a of inArms) join('LOAD-' + name, RED, a);
    const handCopy = copyOf(...cells.hands);
    for (const a of outArms) join('OUT-HAND-' + name, GREEN, a); join('OUT-HAND-' + name, GREEN, handCopy, 'in'); join('LOOSE', RED, handCopy, 'out');
    return { machine: m.entity_number, shadow: shadow.entity_number, handCopy: handCopy.entity_number, outputArms: outArms.map(a => a.entity_number), selector: selectors[name].entity_number, idleRecipe: IDLE[m.name], stallTicks: stall, gate: gate.entity_number, park: park.entity_number, take: take.entity_number, hold: hold.entity_number, timer: timer.entity_number, boot: boot.entity_number, copy: copy.entity_number, pending: pending.entity_number, diode: diode.entity_number, negate: negate.entity_number, delay: delay.entity_number, limiter: limiter.entity_number, inputArms: inArms.map(a => a.entity_number) };
  }
  const controllers = {
    U1: controller('U1', u1, u1Shadow, u1In, u1Out, { gate: H(14, 2), park: H(16, 2), take: V(7, 4), hold: V(22, 4), timer: V(23, 4), boot: H(22, 7), copy: V(24, 4), pending: H(22, 6), diode: V(18, 4), negate: V(18, 6), delay: V(8, 4), limiter: H(12, 7), hands: H(5, 9) }),
    U2: controller('U2', u2, u2Shadow, u2In, u2Out, { gate: V(25, 4), park: V(26, 4), take: V(31, 10), hold: V(32, 10), timer: V(33, 10), boot: H(29, 11), copy: V(30, 4), pending: V(31, 4), diode: V(32, 4), negate: H(30, 6), delay: H(30, 7), limiter: H(27, 9), hands: V(32, 12) }),
  };

  // the buffer chest's arm: its filter is every item that is in the chest and below its limit on the ring
  const bufferLimits = { ...Object.fromEntries(['iron-plate', 'iron-gear-wheel', 'steel-plate'].map(n => [n, ruleCaps[n]])), ...Object.fromEntries(['electronic-circuit', 'advanced-circuit', 'tungsten-carbide', 'refined-concrete'].map(n => [n, armCaps[n]])),
    ...Object.fromEntries(['transport-belt', 'underground-belt', 'splitter', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter'].map(n => [n, ruleCaps[n]])), ...Object.fromEntries([EB, EUG, ES, 'foundry'].map(n => [n, FINAL_ON_RING])) };
  const bufferRing = copyOf(32, 6, true), bufferCaps = constant(33, 9, Object.entries(bufferLimits).map(([n, k]) => [item(n), -k]));
  const bufferFilter = decider(31, 9, false, [[atom(EACH, 'G', '>', 0), atom(EACH, 'R', '<', 0)]], [{ signal: EACH, copy_count_from_input: false, constant: 1 }]);
  join('RING', RED, bufferRing, 'in'); join('BUFFER-ROOM', RED, bufferRing, 'out'); join('BUFFER-ROOM', RED, bufferCaps); join('BUFFER-ROOM', RED, bufferFilter, 'in');
  join('BUFFER-CHEST', GREEN, u2Buffer); join('BUFFER-CHEST', GREEN, bufferFilter, 'in');
  join('BUFFER-FILTER', RED, bufferFilter, 'out'); join('BUFFER-FILTER', RED, bufferArm);
  // what lies in the chest and what its arm carries stay in sight of the rules (one copy each, like every other path)
  const bufferChestCopy = copyOf(26, 16, false), bufferHandCopy = copyOf(28, 16, false);
  join('BUFFER-CHEST', GREEN, bufferChestCopy, 'in'); join('LOOSE', RED, bufferChestCopy, 'out');
  join('BUFFER-HAND', GREEN, bufferArm); join('BUFFER-HAND', GREEN, bufferHandCopy, 'in'); join('LOOSE', RED, bufferHandCopy, 'out');
  // caps: one constant combinator (positive numbers), negated onto GREEN
  const capsCombinator = constant(30, 1, PRODUCTS.map(v => [item(v.item), v.cap]));
  const capsPanel = panel(31, 1, 'CAPS: edit a number here', 'constant-combinator');
  const negate = comb('arithmetic-combinator', 30, 0, false, { arithmetic_conditions: { first_signal: EACH, second_constant: -1, operation: '*', output_signal: EACH } });
  join('CAPS', RED, capsCombinator); join('CAPS', RED, negate, 'in'); join('GREEN', GREEN, negate, 'out');
  // multi-product chests: the arm's filter is the set of declared items the chest is short of
  const CHEST_CELLS = { 'OUT-1': { decider: H(22, 0), list: [23, 2], hands: H(26, 0) }, 'OUT-2': { decider: H(24, 0), list: [25, 2], hands: H(28, 0) } };
  for (const ch of CHESTS.filter(v => v.items.length > 1)) {
    const cells = CHEST_CELLS[ch.id];
    const d = decider(...cells.decider, [[atom(EACH, 'G', '<', 0), atom(EACH, 'R', '>', 0)]], [{ signal: EACH, copy_count_from_input: false, constant: 1 }]);
    const list = constant(...cells.list, ch.items.map(n => [item(n), 1]));
    join('LIST-' + ch.id, RED, list); join('LIST-' + ch.id, RED, d, 'in'); join('GREEN', GREEN, d, 'in');
    join('FILTER-' + ch.id, RED, d, 'out'); join('FILTER-' + ch.id, RED, ch.arm);
    // what a chest arm carries counts as loose stock (each arm has its own hand wire and copy)
    const copy = copyOf(...cells.hands);
    join('HAND-' + ch.id, GREEN, ch.arm); join('HAND-' + ch.id, GREEN, copy, 'in'); join('LOOSE', RED, copy, 'out');
    ch.decider = d.entity_number; ch.list = list.entity_number; ch.handCopy = copy.entity_number;
  }

  // =================================================================== labels
  const ports = [];
  const port = (id, kind, name, tile, external, label, labelAt, extra = {}) => { const sign = panel(labelAt[0], labelAt[1], label, name, kind === 'fluid' ? 'fluid' : 'item'); ports.push({ id, item: name, key: extra.key || name, kind, mode: kind === 'fluid' ? 'pipe' : 'belt', entity: tile.entity_number, position: tile.position, externalContact: external, panel: sign.entity_number, label, ...extra }); };
  port('IN-1', 'fluid', 'lava', lava[0], { x: -0.5, y: 15.5 }, `IN: lava ${PANEL.lava}/min (pipe, west edge, the row below)`, [5, 14], { side: 'west', perMinute: PANEL.lava, section: 'mall' });
  port('IN-2', 'item', 'calcite', calciteBelt[0], { x: 1.5, y: -0.5 }, `IN: calcite ${PANEL.calcite}/min (belt, north edge)`, [2, 1], { side: 'north', flow: 'south', perMinute: PANEL.calcite, section: 'mall' });
  port('IN-3', 'item', 'plastic-bar', plasticBelt[0], { x: 3.5, y: -0.5 }, `IN: plastic ${PANEL['plastic-bar']}/min (belt, north edge)`, [4, 1], { side: 'north', flow: 'south', perMinute: PANEL['plastic-bar'], section: 'mall' });
  port('IN-4', 'item', 'tungsten-carbide', carbideBelt[0], { x: 5.5, y: -0.5 }, `IN: tungsten carbide ${PANEL['tungsten-carbide']}/min (belt, north edge)`, [6, 1], { side: 'north', flow: 'south', perMinute: PANEL['tungsten-carbide'], section: 'mall' });
  port('IN-5', 'fluid', 'lubricant', lubPipes[0], { x: 34.5, y: 14.5 }, `IN: lubricant ${PANEL.lubricant}/min (pipe, east edge, the row below)`, [33, 13], { side: 'east', perMinute: PANEL.lubricant, section: 'mall' });
  port('IN-6', 'fluid', 'water', waterPipes[2], { x: 34.5, y: 16.5 }, `IN: water ${PANEL.waterFuel + PANEL.waterMall}/min (pipe, east edge, the row below): ${PANEL.waterFuel} fuel + ${PANEL.waterMall} foundries`, [33, 15], { side: 'east', perMinute: PANEL.waterFuel + PANEL.waterMall, section: 'both', perMinuteBySection: { fuel: PANEL.waterFuel, mall: PANEL.waterMall } });
  port('OUT-STONE', 'item', 'stone', stoneBelt.at(-1), { x: -0.5, y: 16.5 }, 'OUT: surplus stone (belt, this row, leaves west)', [15, 16], { side: 'west', flow: 'west', exit: true, section: 'mall' });
  port('IN-7', 'fluid', 'sulfuric-acid', acidPipes[0], { x: -0.5, y: fy(0) + 0.5 }, `IN: sulfuric acid ${PANEL['sulfuric-acid']}/min (pipe, west edge, the row above)`, [1, fy(1)], { side: 'west', perMinute: PANEL['sulfuric-acid'], section: 'fuel' });
  port('IN-8', 'item', 'coal', coalEntrance, { x: -0.5, y: fy(6) + 0.5 }, `IN: coal ${PANEL.coal}/min (belt, west edge, the row below)`, [0, fy(5)], { side: 'west', flow: 'east', perMinute: PANEL.coal, section: 'fuel' });
  port('IN-9', 'item', 'calcite', calciteFuelEntrance, { x: -0.5, y: fy(8) + 0.5 }, `IN: calcite ${PANEL['calcite-fuel']}/min for the fuel (belt, west edge, the row above)`, [0, fy(9)], { side: 'west', flow: 'east', key: 'calcite-fuel', perMinute: PANEL['calcite-fuel'], section: 'fuel' });
  const powerPanel = panel(32, fy(3), 'POWER: connect the substation above', 'substation');

  // =================================================================== wires
  const wires = [];
  const reach = e => (e.name === 'substation' ? p.entities.substation.maximum_wire_distance : p.entities[e.name].circuit_wire_max_distance) - (COMBINATORS.includes(e.name) ? 1 : 0);
  // substations carry LOOSE (red) and GREEN (green) across the mall, the fuel section's carry GREEN to its arms and chest
  for (const s of Object.values(subs)) { join('LOOSE', RED, s); join('GREEN', GREEN, s); }
  join('GREEN', GREEN, fuelSubs[2]); join('GREEN', GREEN, fuelSubs[1]); join('LOOSE', RED, fuelSubs[2]);
  if (options.relays) for (const [x, y, ...pairs] of options.relays) relay(x, y, ...pairs);
  for (const [x, y, ...pairs] of RELAYS) relay(x, y, ...pairs);
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
        const got = [...reached].map(j => `${nodes[j].e.name}@${nodes[j].e.position.x},${nodes[j].e.position.y}`);
        throw new Error(`net ${name} is not connected: cannot reach ${missing.slice(0, 6).join(' | ')} from ${got.slice(0, 12).join(' | ')}`);
      }
      const a = nodes[best.i], b = nodes[best.j];
      wires.push([a.e.entity_number, a.connector, b.e.entity_number, b.connector]);
      reached.add(best.j);
    }
    netReport[name] = { color: net.color === RED ? 'red' : 'green', members: nodes.map(n => [n.e.entity_number, n.connector]) };
  }
  // power: the two substations inside the ring and the fuel section's three, one chain; the entry is the east one of the fuel section
  const copper = [[subs.west, subs.east], [subs.east, fuelSubs[2]], [fuelSubs[2], fuelSubs[1]], [fuelSubs[1], fuelSubs[0]]];
  for (const [a, b] of copper) { assert(distance(a, b) <= p.entities.substation.maximum_wire_distance, 'substation chain'); wires.push([a.entity_number, 5, b.entity_number, 5]); }

  // =================================================================== blueprint and manifest
  const icons = ['foundry', 'express-transport-belt', 'bulk-inserter', FUEL].map((name, i) => ({ index: i + 1, signal: { name } }));
  const blueprint = { blueprint: { item: 'blueprint', label: 'Foundry belts and fuel mall | express belts, inserters, drills, foundries | 12 rocket fuel a minute', description: `Factorio ${p.gameVersion} Space Age, Vulcanus. North edge: calcite, plastic and tungsten carbide belts. West edge: lava pipe, the surplus stone belt, then the fuel section's sulfuric acid pipe, coal belt and calcite belt. East edge: lubricant pipe, water pipe. Four passive provider chests on the north side fill in list order: express belts, inserters, drills, foundries. The rocket fuel section at the bottom fills its own chest in the south-east corner and does not wait for the list. Caps: the constant combinator next to the chests. Power: the marked substation. No modules or beacons. See the README for ports and the native test.`, version: blueprintVersion(p.gameVersion), icons, entities, wires } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const names = [...new Set(entities.map(e => e.name))].sort();
  const counts = list => Object.fromEntries([...new Set(list.map(e => e.name))].sort().map(n => [n, list.filter(e => e.name === n).length]));
  const mallEntities = entities.filter(e => e.position.y < FUEL_ROW), fuelEntities = entities.filter(e => e.position.y > FUEL_ROW);
  const footprint = { ...envelope(entities, p), includes: 'all entities: machines, arms, belts, pipes, tanks, combinators, panels, substations, chests; external supply excluded', counts: counts(entities), entities: entities.length,
    mallPart: { ...envelope(mallEntities, p), entities: mallEntities.length }, fuelPart: { ...envelope(fuelEntities, p), entities: fuelEntities.length } };
  const recipesUsed = [...new Set([...M.machines.filter(m => m.recipe).map(m => m.recipe), ...RULES.map(r => r.r), 'stone-brick', IDLE['assembling-machine-3']])];
  const tech = technologyClosure(p, recipesUsed, names);
  const ringBelts = ring.length, turnTiles = 4, laneCapacity = (ringBelts - turnTiles) * 4;
  // Lane room. An arm drops on the far lane of the belt it faces, so everything put on the ring from outside the loop
  // rides the inner lane and everything put on from inside rides the outer lane.
  const insideLoop = e => e.position.x > RX0 + 1 && e.position.x < RX1 && e.position.y > RY0 + 1 && e.position.y < RY1;
  const laneLimits = { inner: 0, outer: 0 }, laneOf = {};
  for (const [name, limit] of Object.entries(armCaps)) { const a = M.arms.find(v => v.ringCap === name); laneOf[name] = insideLoop(entities[a.entity - 1]) ? 'outer' : 'inner'; laneLimits[laneOf[name]] += limit; }
  for (const [name, limit] of Object.entries(ruleCaps)) { const rule = RULES.find(v => !v.idle && p.recipes[v.r].results.some(x => x.name === name)); laneOf[name] = rule.m === 'U1' ? 'outer' : 'inner'; laneLimits[laneOf[name]] += limit; }
  const chestOf = v => (v.independent ? fuelOut : CHESTS.find(c => c.items.includes(v.item)));
  const manifest = {
    schema: 1, id: 'foundry-belts-fuel-mall', revision: 1, candidateSha256: hash, requiredGameVersion: p.gameVersion, prototypeSha256: options.prototypeSha256, surface: 'vulcanus',
    intendedUse: 'on-demand mall on Vulcanus from lava and calcite: express belts, fast and bulk inserters, electric mining drills and foundries, each kept at its cap in passive provider chests and made in that order; and, as a section of its own, 12 rocket fuel a minute from coal into a fifth chest',
    groups: GROUP_NAMES.map((name, i) => ({ group: i + 1, name, level: LEVEL[i + 1], products: PRODUCTS.filter(v => v.group === i + 1).map(v => v.key) })),
    independent: PRODUCTS.filter(v => v.independent).map(v => v.key),
    products: PRODUCTS, caps: CAPS, capSignals: Object.fromEntries(PRODUCTS.map(v => [v.key, v.item])),
    stock: PRODUCTS.map(v => ({ key: v.key, item: v.item, output: chestOf(v).id, chest: chestOf(v).chest.entity_number })),
    capsCombinator: { entity: capsCombinator.entity_number, panel: capsPanel.entity_number, position: capsCombinator.position, negate: negate.entity_number },
    ringArmCaps: armCaps, ringRuleCaps: ruleCaps, tankReady: TANK_READY, panelFigures: PANEL,
    equipment: { inserters: HAND, transport: 'fast-transport-belt', power: 'substation', modules: 0, beacons: 0, quality: 'normal' },
    footprint, ports, power: { entry: fuelSubs[2].entity_number, panel: powerPanel.entity_number, label: 'POWER: connect the substation above', externalPolePosition: { x: 37, y: fy(1) }, externalSourcePosition: { x: 40, y: fy(1) }, substations: [...Object.values(subs), ...fuelSubs].map(e => e.entity_number) },
    outputs: [...CHESTS, fuelOut].map(ch => ({ id: ch.id, items: ch.items, chest: ch.chest.entity_number, arm: ch.arm.entity_number, panel: ch.panel.entity_number, label: ch.label, position: ch.chest.position, ...(ch.decider ? { decider: ch.decider, list: ch.list, handCopy: ch.handCopy } : {}) })),
    machines: M.machines, arms: M.arms, rules: M.rules, controllers, relays: M.relays, panels: M.panels,
    ring: { belts: ring.map(e => e.entity_number), reader: reader.entity_number, tiles: ringBelts, turnTiles, laneCapacity, bound: Math.floor(laneCapacity * 2 * 0.75), laneLimits, laneOf },
    lines: { calcite: calciteBelt.map(e => e.entity_number), stone: stoneBelt.map(e => e.entity_number), plastic: plasticBelt.map(e => e.entity_number), carbide: carbideBelt.map(e => e.entity_number), fuelIn: [coalEntrance, calciteFuelEntrance, ...fuelBelt].map(e => e.entity_number), fuelOut: fuelOutBelt.map(e => e.entity_number) },
    fluids: { lava: lava.map(e => e.entity_number), 'molten-copper': copperPipes.map(e => e.entity_number), 'molten-iron': ironPipes.map(e => e.entity_number), water: [waterPump, ...waterPipes, ...fuelWater].map(e => e.entity_number), lubricant: [lubTank, ...lubPipes].map(e => e.entity_number), 'sulfuric-acid': acidPipes.map(e => e.entity_number), 'heavy-oil': heavyPipes.map(e => e.entity_number), 'light-oil': lightPipes.map(e => e.entity_number) },
    tanks: { lubricant: lubTank.entity_number },
    buffer: { chest: u2Buffer.entity_number, arm: bufferArm.entity_number, feed: u2Out[0].entity_number, filter: bufferFilter.entity_number, limits: bufferCaps.entity_number, ringCopy: bufferRing.entity_number, chestCopy: bufferChestCopy.entity_number, handCopy: bufferHandCopy.entity_number, itemLimits: bufferLimits, finalOnRing: FINAL_ON_RING },
    pumps: [{ entity: waterPump.entity_number, fluid: 'water', from: fuelWater[1].entity_number, to: caster.entity_number }],
    fuel: { row: FUEL_ROW, source: 'blueprint-sources/vulcanus-supplies/rocket-fuel', target: PANEL[FUEL], stacks: FUEL_STACKS, chest: fuelChest.entity_number, arms: fuelArms.map(a => a.entity_number), machines: M.machines.filter(m => m.section === 'fuel').map(m => m.entity) },
    casterCopy: casterCopy.entity_number, idleRecipes: IDLE, idleWeight: IDLE_WEIGHT, realWeight: REAL_WEIGHT, levelHoldTicks: LEVEL_HOLD,
    global: { top: top.entity_number, level: levelCalc.entity_number, levelRise: levelRise.entity_number, levelKeep: levelKeep.entity_number, floor: floorCalc.entity_number, candidateCopy: actCopy.entity_number, ringCopy: ringCopy.entity_number, castCopy: castCopy.entity_number },
    nets: netReport, technologyClosure: tech.closure, recipes: recipesUsed,
    status: { static: 'static-audit.json', native: 'native-report.json; qualified only when that report passed for candidateSha256' },
  };
  return { blueprint, code, hash, manifest, footprint, ports, tech, entities, occupied };
}
// posts that carry a wire across a gap too long for one hop: [x, y, net, color, ...]
const RELAYS = [[14, 7, 'SET-U1', 1]];

// A character map of the layout for the README and for debugging.
export function asciiMap(d, p) {
  const { bounds } = d.footprint, rows = [];
  const glyph = e => ({ foundry: 'F', 'oil-refinery': 'R', 'assembling-machine-3': 'A', 'chemical-plant': 'C', 'electric-furnace': 'K', 'storage-tank': 'T', pump: 'p', substation: 'S', 'fast-transport-belt': { 0: '^', 4: '>', 8: 'v', 12: '<' }[e.direction || 0], pipe: '=', 'pipe-to-ground': 'u', 'fast-inserter': 'i', 'bulk-inserter': 'b', 'passive-provider-chest': 'P', 'steel-chest': 'B', 'display-panel': '!', 'constant-combinator': 'c', 'decider-combinator': 'd', 'arithmetic-combinator': 'a', 'selector-combinator': 's' }[e.name] || '?');
  const grid = new Map();
  for (const e of d.blueprint.blueprint.entities) { const b = box(e, p, 'selection_box'); for (let x = Math.floor(b.left + 0.01); x < Math.ceil(b.right - 0.01); x++) for (let y = Math.floor(b.top + 0.3); y < Math.ceil(b.bottom - 0.01); y++) grid.set(`${x},${y}`, glyph(e)); }
  for (let y = bounds.top; y < bounds.bottom; y++) { let line = ''; for (let x = bounds.left; x < bounds.right; x++) line += grid.get(`${x},${y}`) || '.'; rows.push(String(y).padStart(4) + ' ' + line); }
  return rows.join('\n');
}
