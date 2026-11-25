// Layout of the assembling-machine-3 supply mall. Pure function of the pinned prototypes and a few knobs;
// generate.mjs writes the published files, validate.mjs and the tests read them back.
//
// Two arrangements are built from the same data; the published one is the smaller selection envelope.
//   two-row  machines on both sides of a two-row ring. Tile rows, north to south:
//              -4..-2 north machines     -1 north arms     0 ring, westbound     1 ring, eastbound
//               2 south arms            3..5 south machines
//   one-row  all eight machines on the south side of the ring; the same west entrances.
// West to east in two-row (centre tile x):
//   north  electronic-circuit 5 | copper-cable 9 | advanced-circuit 13 | speed-module 17
//   south  assembling-machine-1 5 | iron-gear-wheel 9 | assembling-machine-2 13 | [chest gap] | assembling-machine-3 19
import assert from 'node:assert/strict';
import { sha, encodeKeeping, distance, filters, condition, envelope, technologyClosure, box, intersects, PROTOCOL } from './lib.mjs';

const N = 0, E = 4, S = 8, W = 12;
export const PRODUCTS = ['assembling-machine-2', 'assembling-machine-3'];
export const RECIPES = ['copper-cable', 'electronic-circuit', 'advanced-circuit', 'speed-module', 'iron-gear-wheel', 'assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3'];
// The four materials that enter, in the order of the west entrances, north to south.
export const INPUT_ORDER = ['iron-plate', 'steel-plate', 'copper-plate', 'plastic-bar'];
// Caps on the ring. Entrance items: how much of the material may ride the ring. Products: how much of the item may ride the ring.
export const DEFAULT_CAPS = Object.freeze({ 'iron-plate': 12, 'steel-plate': 4, 'copper-plate': 12, 'plastic-bar': 8, 'electronic-circuit': 20, 'assembling-machine-1': 3, 'speed-module': 3 });

const SIDES = { north: { arm: -1, mid: -3, inDir: S, outDir: N }, south: { arm: 2, mid: 4, inDir: N, outDir: S } };
// Arms between a machine and the ring: [dx from the machine centre, kind, items]. Items that the machine gets by a direct hand-off
// are filtered out below, and an arm left without items is dropped.
const ARMS = {
  'electronic-circuit': [[-1, 'in', ['iron-plate']], [1, 'out']],
  'copper-cable': [[-1, 'in', ['copper-plate']]],
  'advanced-circuit': [[-1, 'in', ['electronic-circuit']], [1, 'in', ['plastic-bar']]],
  'speed-module': [[-1, 'in', ['electronic-circuit']], [1, 'out']],
  'iron-gear-wheel': [[-1, 'in', ['iron-plate']]],
  'assembling-machine-1': [[-1, 'in', ['iron-plate', 'electronic-circuit']], [1, 'out']],
  'assembling-machine-2': [[-1, 'in', ['electronic-circuit', 'steel-plate']], [1, 'in', ['assembling-machine-1']]],
  'assembling-machine-3': [[-1, 'in', ['speed-module']]],
};
export const PLANS = {
  'two-row': {
    machines: { 'electronic-circuit': ['north', 5], 'copper-cable': ['north', 9], 'advanced-circuit': ['north', 13], 'speed-module': ['north', 17], 'assembling-machine-1': ['south', 5], 'iron-gear-wheel': ['south', 9], 'assembling-machine-2': ['south', 13], 'assembling-machine-3': ['south', 19] },
    handoffs: [['copper-cable', 'electronic-circuit'], ['copper-cable', 'advanced-circuit'], ['advanced-circuit', 'speed-module'], ['iron-gear-wheel', 'assembling-machine-1'], ['iron-gear-wheel', 'assembling-machine-2']],
    power: { pole: [19, -2], panel: [19, -3], external: [21.5, -1.5] },
  },
  'one-row': {
    machines: { 'electronic-circuit': ['south', 5], 'copper-cable': ['south', 9], 'advanced-circuit': ['south', 13], 'speed-module': ['south', 17], 'assembling-machine-3': ['south', 21], 'assembling-machine-2': ['south', 27], 'iron-gear-wheel': ['south', 31], 'assembling-machine-1': ['south', 35] },
    handoffs: [['copper-cable', 'electronic-circuit'], ['copper-cable', 'advanced-circuit'], ['advanced-circuit', 'speed-module'], ['speed-module', 'assembling-machine-3'], ['iron-gear-wheel', 'assembling-machine-1'], ['iron-gear-wheel', 'assembling-machine-2']],
    power: { pole: [36, -2], panel: [36, -1], external: [38.5, -1.5] },
  },
};
const CHEST_SOURCE = 'assembling-machine-2', CHEST_USER = 'assembling-machine-3';
export const EXTERNAL = ['iron-plate', 'copper-plate', 'steel-plate', 'plastic-bar'];

// What one assembling machine 3 costs in the four entrance materials, expanded from the recipes (item -> amount).
export function rawPerProduct(p, item = 'assembling-machine-3', amount = 1, totals = {}) {
  const recipe = RECIPES.map(r => p.recipes[r]).find(r => r.results[0].name === item);
  if (!recipe) { totals[item] = (totals[item] || 0) + amount; return totals; }
  const crafts = amount / recipe.results[0].amount;
  for (const v of recipe.ingredients) rawPerProduct(p, v.name, v.amount * crafts, totals);
  return totals;
}

export function design(p, options = {}) {
  assert.equal(p.gameVersion, '2.1.24');
  const arrangement = options.arrangement || 'two-row', plan = PLANS[arrangement];
  assert(plan, 'unknown arrangement ' + arrangement);
  const entities = [], loop = [], controlled = [], poles = [], ports = [], cells = [];
  function add(name, x, y, extra = {}) {
    const e = { entity_number: entities.length + 1, name, position: { x: x + 0.5, y: y + 0.5 }, ...extra };
    entities.push(e); return e;
  }
  const byId = id => entities[id - 1];
  const belt = (x, y, direction) => { const e = add('fast-transport-belt', x, y, { direction }); loop.push(e.entity_number); return e; };
  // An arm's blueprint direction is the side it picks up from; it drops on the opposite side.
  const arm = (x, y, direction, names, extra = {}) => add('fast-inserter', x, y, { direction, override_stack_size: 1, ...filters(names), ...extra });
  const panel = (x, y, text, name) => add('display-panel', x, y, { text, always_show: true, icon: { type: 'item', name } });
  const product = recipe => p.recipes[recipe].results[0].name;

  // ---- Data pass: what rides the ring, which arms each machine has -------------------------------------------------------------
  const centre = Object.fromEntries(Object.entries(plan.machines).map(([r, [side, x]]) => [r, { side, x }]));
  const handoffInto = Object.fromEntries(RECIPES.map(r => [r, plan.handoffs.filter(([, to]) => to === r).map(([from]) => from)]));
  const providedDirect = r => [...handoffInto[r].map(product), ...(r === CHEST_USER ? [product(CHEST_SOURCE)] : [])];
  const ringProducts = RECIPES.filter(r => !PRODUCTS.includes(r) && RECIPES.some(c => c !== r && p.recipes[c].ingredients.some(v => v.name === product(r)) && !handoffInto[c].includes(r))).map(product);
  const caps = Object.fromEntries([...INPUT_ORDER, ...ringProducts].map(n => [n, { ...DEFAULT_CAPS, ...(options.caps || {}) }[n]]));
  for (const [n, c] of Object.entries(caps)) assert(Number.isInteger(c) && c > 0, 'cap for ' + n);
  const armSpec = {};
  for (const r of RECIPES) {
    const wanted = p.recipes[r].ingredients.map(v => v.name).filter(n => !providedDirect(r).includes(n));
    const arms = [];
    for (const [dx, kind, names] of ARMS[r]) {
      if (kind === 'in') { const own = names.filter(n => wanted.includes(n)); if (own.length) arms.push({ dx, kind, names: own }); }
      else if (ringProducts.includes(product(r))) arms.push({ dx, kind, names: [product(r)] });
    }
    assert.deepEqual([...arms.filter(a => a.kind === 'in').flatMap(a => a.names)].sort(), [...wanted].sort(), `ring ingredient arms of ${r}`);
    armSpec[r] = arms;
  }
  // The west edge needs a ring corner column; the east end sits one tile past the last arm that touches the ring.
  const lastArm = Math.max(3, ...RECIPES.flatMap(r => armSpec[r].map(a => centre[r].x + a.dx)));
  const east = lastArm + 1;

  // ---- One counter-clockwise ring, two rows tall, no branches, side-loads, splitters or undergrounds ------------------------------
  belt(0, 0, S); belt(0, 1, E);
  for (let x = 1; x < east; x++) belt(x, 1, E);
  belt(east, 1, N); belt(east, 0, W);
  for (let x = east - 1; x >= 1; x--) belt(x, 0, W);
  const reader = byId(loop.find(id => byId(id).position.x === 11.5 && byId(id).position.y === 0.5));
  reader.control_behavior = { circuit_read_hand_contents: true, circuit_contents_read_mode: 2 };

  // ---- Four west entrances: a short belt stub ends beside a capped feed arm that lifts onto the ring ----------------------------
  // north pair: IN-1 on row -3 turns south at x = 3, IN-2 on row -2 ends at x = 1; arms at y = -1 drop on the westbound row.
  // south pair: IN-3 on row 3 ends at x = 1, IN-4 on row 4 turns north at x = 3; arms at y = 2 drop on the eastbound row.
  const stubSpecs = [
    { row: -3, tiles: [[0, -3, E], [1, -3, E], [2, -3, E], [3, -3, S], [3, -2, S]], armAt: [3, -1], armDir: N, panelAt: [2, -2] },
    { row: -2, tiles: [[0, -2, E], [1, -2, E]], armAt: [1, -1], armDir: N, panelAt: [0, -1] },
    { row: 3, tiles: [[0, 3, E], [1, 3, E]], armAt: [1, 2], armDir: S, panelAt: [0, 2] },
    { row: 4, tiles: [[0, 4, E], [1, 4, E], [2, 4, E], [3, 4, N], [3, 3, N]], armAt: [3, 2], armDir: S, panelAt: [0, 5] },
  ];
  const consumersOf = item => RECIPES.filter(r => p.recipes[r].ingredients.some(v => v.name === item));
  for (const [i, spec] of stubSpecs.entries()) {
    const item = INPUT_ORDER[i];
    const stub = spec.tiles.map(([x, y, d]) => add('fast-transport-belt', x, y, { direction: d }));
    const feed = arm(spec.armAt[0], spec.armAt[1], spec.armDir, [item], { control_behavior: condition(item, caps[item]) });
    controlled.push(feed);
    const label = `IN: ${item}`;
    const sign = panel(spec.panelAt[0], spec.panelAt[1], label, item);
    const [sx, sy] = spec.tiles[0];
    ports.push({ id: `IN-${i + 1}`, item, kind: 'belt', side: 'west', flow: 'east', entrance: stub[0].position, externalContact: { x: sx - 0.5, y: sy + 0.5 }, stub: stub.map(e => e.entity_number), stubEnd: stub.at(-1).entity_number, inserter: feed.entity_number, panel: sign.entity_number, label, loopCap: caps[item], consumers: consumersOf(item) });
  }

  // ---- Machines, their ring arms and the direct hand-offs -------------------------------------------------------------------------
  for (const recipe of RECIPES) {
    const { side, x } = centre[recipe], s = SIDES[side];
    const machine = add('assembling-machine-2', x, s.mid, { recipe });
    const cell = { recipe, product: product(recipe), side, machine: machine.entity_number, inputArms: [], outputArm: null, ringProduct: ringProducts.includes(product(recipe)) ? product(recipe) : null, directInputs: [], outputChest: null };
    for (const a of armSpec[recipe]) {
      if (a.kind === 'in') cell.inputArms.push(arm(x + a.dx, s.arm, s.inDir, a.names).entity_number);
      else {
        const out = arm(x + a.dx, s.arm, s.outDir, a.names, { control_behavior: condition(a.names[0], caps[a.names[0]]) });
        controlled.push(out); cell.outputArm = out.entity_number;
      }
    }
    cells.push(cell);
  }
  const cell = recipe => cells.find(c => c.recipe === recipe);
  const directTransfers = [];
  for (const [from, to] of plan.handoffs) {
    const a = centre[from], b = centre[to];
    assert(a.side === b.side && Math.abs(a.x - b.x) === 4, `hand-off ${from} -> ${to} needs touching neighbours`);
    const gap = Math.min(a.x, b.x) + 2, direction = a.x < b.x ? W : E;
    const inserter = arm(gap, SIDES[a.side].mid, direction, [product(from)]);
    const transfer = { item: product(from), source: cell(from).machine, destination: cell(to).machine, inserter: inserter.entity_number };
    directTransfers.push(transfer); cell(to).directInputs.push(transfer);
  }

  // ---- Output chests: each product has its own provider chest and nothing else enters it ----------------------------------------
  // Three tiles between the two machines (assembling machine 2 and 3 are six tile columns apart): at the middle row
  // [arm | chest | arm] carries assembling machine 2 out of its machine and, always on, into the assembling machine 3;
  // one tile below, the assembling machine 3 drops into its own chest. Chests are limited to one slot (bar 1) = one stack of 50.
  const src = centre[CHEST_SOURCE], dst = centre[CHEST_USER];
  assert(src.side === 'south' && dst.side === 'south' && Math.abs(src.x - dst.x) === 6, 'the two machines frame the chest gap');
  const westOfGap = src.x < dst.x, g0 = Math.min(src.x, dst.x) + 2, gm = g0 + 1, row = SIDES.south;
  const gapSource = westOfGap ? g0 : g0 + 2, gapUser = westOfGap ? g0 + 2 : g0;
  const chest2Row = row.mid + 1, label1Row = row.mid - 1;
  const chest1 = add('passive-provider-chest', gm, row.mid, { bar: 1 });
  const chest2 = add('passive-provider-chest', gm, chest2Row, { bar: 1 });
  const toChest1 = arm(gapSource, row.mid, westOfGap ? W : E, [CHEST_SOURCE]);
  const toUser = arm(gapUser, row.mid, westOfGap ? W : E, [CHEST_SOURCE]);
  const toChest2 = arm(gapUser, chest2Row, westOfGap ? E : W, [CHEST_USER]);
  const label1 = 'OUT: assembling machine 2', label2 = 'OUT: assembling machine 3';
  const panel1 = panel(gm, label1Row, label1, CHEST_SOURCE);
  const panel2 = panel(gapSource, chest2Row, label2, CHEST_USER);
  const chestTransfer = { item: CHEST_SOURCE, source: chest1.entity_number, destination: cell(CHEST_USER).machine, inserter: toUser.entity_number };
  cell(CHEST_USER).directInputs.push(chestTransfer);
  cell(CHEST_SOURCE).outputChest = chest1.entity_number; cell(CHEST_USER).outputChest = chest2.entity_number;
  const outputs = [
    { id: 'OUT-1', item: CHEST_SOURCE, chest: chest1.entity_number, producer: cell(CHEST_SOURCE).machine, producerArm: toChest1.entity_number, takenBy: { machine: cell(CHEST_USER).machine, inserter: toUser.entity_number }, panel: panel1.entity_number, label: label1, position: chest1.position },
    { id: 'OUT-2', item: CHEST_USER, chest: chest2.entity_number, producer: cell(CHEST_USER).machine, producerArm: toChest2.entity_number, takenBy: null, panel: panel2.entity_number, label: label2, position: chest2.position },
  ];

  // ---- Power: one labelled entry pole, then medium poles on free tiles until every inserter and machine is covered -------------------
  const powerLabel = 'POWER: connect medium pole | external electricity';
  const entry = add('medium-electric-pole', plan.power.pole[0], plan.power.pole[1]); poles.push(entry);
  const powerPanel = panel(plan.power.panel[0], plan.power.panel[1], powerLabel, 'medium-electric-pole');
  const bounds = envelope(entities, p).bounds, supply = p.entities['medium-electric-pole'].supply_area_distance, reach = p.entities['medium-electric-pole'].maximum_wire_distance;
  const electric = () => entities.filter(e => p.entities[e.name].energy_source?.type === 'electric');
  const covers = (pole, e) => { const r = supply; return intersects(box(e, p), { left: pole.position.x - r, right: pole.position.x + r, top: pole.position.y - r, bottom: pole.position.y + r }); };
  const free = (x, y) => { const probe = { name: 'medium-electric-pole', position: { x: x + 0.5, y: y + 0.5 } }; return !entities.some(e => intersects(box(probe, p), box(e, p))); };
  for (;;) {
    const uncovered = electric().filter(e => !poles.some(pole => covers(pole, e)));
    if (!uncovered.length) break;
    let best;
    for (let y = bounds.top; y < bounds.bottom; y++) for (let x = bounds.left; x < bounds.right; x++) {
      if (!free(x, y)) continue;
      const probe = { position: { x: x + 0.5, y: y + 0.5 } };
      if (!poles.some(pole => distance(pole, probe) <= reach)) continue;
      const n = uncovered.filter(e => covers(probe, e)).length;
      if (n && (!best || n > best.n)) best = { x, y, n };
    }
    assert(best, 'no pole position covers the remaining machines and arms');
    poles.push(add('medium-electric-pole', best.x, best.y));
  }

  // ---- 2.1 blueprint wires belong to entities. A tuple is stored once at its source ----------------------------------------------
  const wire = (a, connector, b) => { (a.wires ||= []).push([a.entity_number, connector, b.entity_number, connector]); };
  { // copper: minimum tree over the poles
    const done = new Set([poles[0]]);
    while (done.size < poles.length) {
      let best;
      for (const a of done) for (const b of poles) if (!done.has(b)) { const d = distance(a, b); if (d <= reach && (!best || d < best.d)) best = { a, b, d }; }
      assert(best, 'Disconnected copper network');
      wire(best.a, 5, best.b); done.add(best.b);
    }
  }
  { // green: the reader and every capped arm. Plain arms may relay when two nodes are further apart than one wire reaches.
    const limit = (a, b) => Math.min(p.entities[a.name].circuit_wire_max_distance, p.entities[b.name].circuit_wire_max_distance);
    const required = [reader, ...controlled], relays = entities.filter(e => e.name === 'fast-inserter' && !controlled.includes(e));
    const tree = new Set([reader]);
    while (required.some(n => !tree.has(n))) {
      let found; // shortest chain of new nodes, each hung from the node before it, the first from a node already in the tree
      for (const target of required.filter(n => !tree.has(n))) {
        const parent = new Map(), seen = new Set(tree), queue = [...tree];
        while (queue.length && !parent.has(target)) {
          const a = queue.shift();
          for (const b of [target, ...relays.filter(r => !tree.has(r))]) if (!seen.has(b) && distance(a, b) <= limit(a, b)) { seen.add(b); parent.set(b, a); if (b !== target) queue.push(b); }
        }
        if (!parent.has(target)) continue;
        const chain = []; for (let n = target; !tree.has(n); n = parent.get(n)) chain.unshift([parent.get(n), n]);
        if (!found || chain.length < found.length) found = chain;
      }
      assert(found, 'Disconnected green circuit');
      for (const [from, to] of found) { wire(from, 2, to); tree.add(to); }
    }
  }

  const blueprint = { blueprint: { item: 'blueprint', label: 'Assembling machine 3 supply | AM2 | from plates', description: 'Factorio 2.1.24 Space Age. Four belt entrances on the west edge (iron plate, steel plate, copper plate, plastic bar); connect power at the labelled pole. Makes assembling machine 2 and 3, each into its own passive provider chest. Assembling machine 2 only, no modules or beacons. See the README for tiles and the native test.', version: Number((2n << 48n) + (1n << 32n) + (24n << 16n)), icons: ['assembling-machine-3', 'assembling-machine-2', 'passive-provider-chest'].map((name, i) => ({ index: i + 1, signal: { type: 'item', name } })), entities } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const footprint = { ...envelope(entities, p), includes: 'all entities, labels, poles and both provider chests; the four external entrance belts and outside power excluded', counts: Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length])), entities: entities.length };
  const tech = technologyClosure(p, RECIPES, [...new Set(entities.map(e => e.name))]);
  const power = { entryPole: entry.entity_number, panel: powerPanel.entity_number, label: powerLabel, externalPolePosition: { x: plan.power.external[0], y: plan.power.external[1] }, poles: poles.map(e => e.entity_number) };
  const manifest = {
    schema: 1, id: 'assembler-3-mall', revision: 1, arrangement, candidateSha256: hash, requiredGameVersion: '2.1.24', prototypeSha256: options.prototypeSha256,
    intendedUse: 'assembling machines 2 and 3 from smelted plates, one provider chest each',
    products: [...PRODUCTS], recipes: [...RECIPES], ringCaps: { ...caps },
    equipment: { machine: 'assembling-machine-2', inserter: 'fast-inserter', transport: 'fast-transport-belt', pole: 'medium-electric-pole', undergroundPolicy: 'No underground belts or pipes in the layout', modules: 0, beacons: 0, quality: 'normal' },
    footprint, inputPorts: ports, cells, directTransfers, loop, reader: reader.entity_number, outputs, power,
    laneRoom: { ringCaps: Object.values(caps).reduce((a, b) => a + b, 0), handOvershootAllowance: controlled.length, maxCirculating: Object.values(caps).reduce((a, b) => a + b, 0) + controlled.length },
    technologyClosure: tech.closure, nativeProtocol: { ...PROTOCOL },
    status: { static: 'static-audit.json', native: 'native-report.json; qualified only when that report passed for candidateSha256' },
  };
  return { blueprint, code, hash, manifest, footprint, ports, tech, cells, caps, centre, arrangement };
}
