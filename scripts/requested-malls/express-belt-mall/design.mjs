// Layout of the express belt mall. Pure function of the pinned prototypes and a few knobs;
// generate.mjs writes the published files, validate.mjs and the tests read them back.
//
// Rows, north to south (tile y). Coordinates are tile corners; an entity at tile (x, y) has its centre at (x + .5, y + .5).
//   -4..-2  north machines (7): copper cable, electronic circuit, advanced circuit, yellow belt, yellow underground, yellow splitter, fast splitter.
//           The three output chests and their labels stand at the east end of this band.
//       -1  arms between the north machines and the ring
//    0, 1   the ring: one closed clockwise loop of red belt, two rows tall (row 0 eastbound, row 1 westbound)
//        2  arms between the ring and the south machines
//     3..5  south machines (8): three gear machines and the five that need their gears by hand-off, among them the three express makers
//        6  iron arms of the gear machines, lubricant pipe under the express makers
//        7  the iron belt (red), one underground hop over the lubricant inlet
//        (the lubricant inlet is the pipe in row 7, open to the south)
// West edge: copper (row 0) and plastic (row 1) belts end at an arm that lifts onto the ring; iron (row 3) runs past one
// ring arm and down the west edge to the iron belt, which feeds the gear machines directly.
import assert from 'node:assert/strict';
import { sha, encodeKeeping, distance, filters, condition, envelope, technologyClosure, box, intersects, blueprintVersion, PROTOCOL } from './lib.mjs';

export const PRODUCTS = ['express-transport-belt', 'express-underground-belt', 'express-splitter'];
export const MATERIALS = ['iron-plate', 'copper-plate', 'plastic-bar'];
// One stack each: the chest is limited to one slot (bar 1).
export const OUTPUT_CAPS = Object.freeze({ 'express-transport-belt': 100, 'express-underground-belt': 50, 'express-splitter': 50 });
// Ring stock caps: an arm that adds an item to the ring works only while the ring holds fewer than this.
// Ring gears are taken by the express underground maker only while the ring holds more than this: the small gear users
// (yellow belt, fast splitter, express splitter) are served first, the underground maker takes what is left over.
export const GEAR_RESERVE = 12;
export const RING_CAPS = Object.freeze({
  'iron-plate': 16, 'copper-plate': 8, 'plastic-bar': 8, 'iron-gear-wheel': 24, 'electronic-circuit': 16, 'advanced-circuit': 10,
  'transport-belt': 12, 'underground-belt': 6, splitter: 3, 'fast-transport-belt': 3, 'fast-underground-belt': 2, 'fast-splitter': 2,
  'express-transport-belt': 3, 'express-underground-belt': 3, 'express-splitter': 3,
});
const N = 0, E = 4, S = 8, W = 12;
const RING_EAST = 30;

export function design(p, options = {}) {
  assert(/^2\.1\.\d+$/.test(p.gameVersion));
  const caps = { ...RING_CAPS, ...(options.ringCaps || {}) };
  const entities = [], loop = [], controlled = [], gated = [], cells = [], directTransfers = [], ports = [], occupied = new Map();
  const size = e => (e.name === 'assembling-machine-2' ? 3 : 1);
  function add(name, x, y, extra = {}) {
    const e = { entity_number: entities.length + 1, name, position: { x: x + 0.5, y: y + 0.5 }, ...extra };
    const s = size(e), x0 = x - (s - 1) / 2, y0 = y - (s - 1) / 2;
    for (let u = 0; u < s; u++) for (let v = 0; v < s; v++) {
      const key = `${x0 + u},${y0 + v}`;
      assert(!occupied.has(key), `${name} at ${x},${y} collides with ${occupied.get(key)} at ${key}`);
      occupied.set(key, name);
    }
    entities.push(e); return e;
  }
  const byId = id => entities[id - 1];
  const belt = (x, y, direction) => add('fast-transport-belt', x, y, { direction });
  // An arm's blueprint direction is the side it picks up from; it drops on the opposite side.
  const arm = (x, y, direction, names, extra = {}) => add('fast-inserter', x, y, { direction, override_stack_size: 1, ...filters(names), ...extra });
  // An arm that adds an item to the ring works only while the ring holds fewer than the item's cap.
  const feed = (x, y, direction, name) => { const e = arm(x, y, direction, [name], { control_behavior: condition(name, caps[name]) }); controlled.push(e); return e; };
  // An arm that takes an item off the ring only while the ring holds more than a reserve of it.
  const reserve = (x, y, direction, name, constant) => { const e = arm(x, y, direction, [name], { control_behavior: { circuit_enabled: true, circuit_condition: { first_signal: { type: 'item', name, quality: 'normal' }, comparator: '>', constant } } }); gated.push(e); return e; };
  const panel = (x, y, text, name, type = 'item') => add('display-panel', x, y, { text, always_show: true, icon: { type, name } });

  // ---- the ring: clockwise, no branch, side-load, splitter or underground ----
  const ringTiles = [];
  const ring = (x, y, d) => { ringTiles.push(belt(x, y, d)); loop.push(ringTiles.at(-1).entity_number); };
  ring(0, 0, E); for (let x = 1; x < RING_EAST; x++) ring(x, 0, E);
  ring(RING_EAST, 0, S); ring(RING_EAST, 1, W);
  for (let x = RING_EAST - 1; x >= 1; x--) ring(x, 1, W);
  ring(0, 1, N);
  const reader = ringTiles.find(e => e.position.x === 5.5 && e.position.y === 1.5);
  reader.control_behavior = { circuit_read_hand_contents: true, circuit_contents_read_mode: 2 };

  // ---- machines ----
  const machines = {};
  const machine = (recipe, cx, cy, direction = N) => (machines[recipe] = add('assembling-machine-2', cx, cy, { direction, recipe }));
  const cell = (recipe, extra = {}) => { const c = { recipe, machine: machines[recipe].entity_number, ringInputArms: [], beltInputArms: [], ringOutputArm: null, directInputs: [], ...extra }; cells.push(c); return c; };
  const handoff = (x, y, direction, item, from, to) => {
    const a = arm(x, y, direction, [item]);
    const t = { item, source: machines[from].entity_number, destination: machines[to].entity_number, inserter: a.entity_number };
    directTransfers.push(t); return t;
  };

  // South band (centre row 4), west to east. Express makers touch (EUB, ESP, ETB); the others have a one-tile gap where a hand-off stands.
  const south = [['fast-underground-belt', 2], ['iron-gear-wheel#B', 6], ['express-underground-belt', 10], ['express-splitter', 13], ['express-transport-belt', 16], ['iron-gear-wheel#A', 20], ['fast-transport-belt', 24], ['iron-gear-wheel#C', 28]];
  const gearCentres = {};
  for (const [key, cx] of south) {
    const [recipe, tag] = key.split('#');
    const express = recipe.startsWith('express');
    if (tag) { gearCentres[tag] = cx; const m = add('assembling-machine-2', cx, 4, { direction: N, recipe }); machines['gear-' + tag] = m; } else machine(recipe, cx, 4, express ? S : N);
  }
  // North band (centre row -3).
  const north = [['electronic-circuit', 2], ['copper-cable', 6], ['advanced-circuit', 10], ['transport-belt', 13], ['underground-belt', 16], ['splitter', 19], ['fast-splitter', 22]];
  for (const [recipe, cx] of north) machine(recipe, cx, -3);

  // Arms on the ring side. South machines: pick from ring row 1 (arm direction N), put on it (arm direction S). North machines: the reverse.
  const sIn = (recipe, x, items) => { const a = arm(x, 2, N, items); cellOf(recipe).ringInputArms.push(a.entity_number); return a; };
  const sOut = (recipe, x, item) => { const a = feed(x, 2, S, item); cellOf(recipe).ringOutputArm = a.entity_number; return a; };
  const nIn = (recipe, x, items) => { const a = arm(x, -1, S, items); cellOf(recipe).ringInputArms.push(a.entity_number); return a; };
  const nOut = (recipe, x, item) => { const a = feed(x, -1, N, item); cellOf(recipe).ringOutputArm = a.entity_number; return a; };
  const cellOf = recipe => cells.find(c => c.recipe === recipe);

  // South cells.
  cell('fast-underground-belt'); cell('express-underground-belt'); cell('express-splitter'); cell('express-transport-belt'); cell('fast-transport-belt');
  const gears = ['B', 'A', 'C'].map(tag => { const c = { recipe: 'iron-gear-wheel', tag, machine: machines['gear-' + tag].entity_number, ringInputArms: [], beltInputArms: [], ringOutputArm: null, directInputs: [] }; cells.push(c); return c; });
  const gearCell = tag => gears.find(c => c.tag === tag);
  // Hand-offs from the gear machines; the item is the same for all five.
  const gearHand = (tag, x, direction, to) => { const t = handoff(x, 4, direction, 'iron-gear-wheel', 'gear-' + tag, to); (to.startsWith('gear') ? gearCell(to.slice(5)) : cellOf(to)).directInputs.push(t); };
  gearHand('B', 4, E, 'fast-underground-belt'); gearHand('B', 8, W, 'express-underground-belt');
  gearHand('A', 18, E, 'express-transport-belt'); gearHand('A', 22, W, 'fast-transport-belt'); gearHand('C', 26, E, 'fast-transport-belt');
  for (const [tag, cx] of Object.entries(gearCentres)) { const c = gearCell(tag); for (const x of [cx - 1, cx, cx + 1]) { const a = arm(x, 6, S, ['iron-plate']); c.beltInputArms.push(a.entity_number); } }
  { const c = gearCell('C'); const a = feed(28, 2, S, 'iron-gear-wheel'); c.ringOutputArm = a.entity_number; }
  // Ring side of the south machines.
  sIn('fast-underground-belt', 1, ['underground-belt']); sOut('fast-underground-belt', 3, 'fast-underground-belt');
  sIn('express-underground-belt', 9, ['fast-underground-belt']); sOut('express-underground-belt', 10, 'express-underground-belt');
  { const a = reserve(11, 2, N, 'iron-gear-wheel', options.gearReserve ?? GEAR_RESERVE); cellOf('express-underground-belt').ringInputArms.push(a.entity_number); }
  sIn('express-splitter', 12, ['fast-splitter', 'advanced-circuit', 'iron-gear-wheel']); sOut('express-splitter', 14, 'express-splitter');
  sIn('express-transport-belt', 15, ['fast-transport-belt']); sOut('express-transport-belt', 17, 'express-transport-belt');
  sIn('fast-transport-belt', 23, ['transport-belt']); sOut('fast-transport-belt', 25, 'fast-transport-belt');

  // Lubricant: a pipe under the three express makers (their inputs face south), one stub down through the iron belt's underground hop to the inlet pipe in row 7.
  const pipes = [];
  for (let x = 10; x <= 16; x++) pipes.push(add('pipe', x, 6).entity_number);
  // The iron belt: down the west edge, east along row 7, one underground hop over the lubricant stub.
  const ironBelt = [];
  const ib = (x, y, d, extra = {}) => { const e = add(extra.type ? 'fast-underground-belt' : 'fast-transport-belt', x, y, { direction: d, ...extra }); ironBelt.push(e.entity_number); return e; };
  const ironEntrance = ib(-2, 3, E); ib(-1, 3, E); ib(0, 3, S); for (let y = 4; y <= 6; y++) ib(0, y, S);
  for (let x = 0; x <= 29; x++) { if (x === 12) ib(x, 7, E, { type: 'input' }); else if (x === 14) ib(x, 7, E, { type: 'output' }); else if (x !== 13) ib(x, 7, E); }
  pipes.push(add('pipe', 13, 7).entity_number);

  // North cells.
  for (const [recipe] of north) cell(recipe);
  // EC <- cable -> AC: cable is high volume and never rides the ring.
  const cableHand = (x, y, direction, to) => { const t = handoff(x, y, direction, 'copper-cable', 'copper-cable', to); cellOf(to).directInputs.push(t); };
  cableHand(4, -4, E, 'electronic-circuit'); cableHand(4, -3, E, 'electronic-circuit'); cableHand(8, -3, W, 'advanced-circuit');
  nIn('electronic-circuit', 1, ['iron-plate']); nOut('electronic-circuit', 3, 'electronic-circuit');
  nIn('copper-cable', 6, ['copper-plate']);
  nIn('advanced-circuit', 9, ['electronic-circuit', 'plastic-bar']); nOut('advanced-circuit', 11, 'advanced-circuit');
  nIn('transport-belt', 12, ['iron-plate', 'iron-gear-wheel']); nOut('transport-belt', 14, 'transport-belt');
  nIn('underground-belt', 15, ['iron-plate', 'transport-belt']); nOut('underground-belt', 17, 'underground-belt');
  nIn('splitter', 18, ['electronic-circuit', 'iron-plate', 'transport-belt']); nOut('splitter', 20, 'splitter');
  nIn('fast-splitter', 21, ['splitter', 'iron-gear-wheel', 'electronic-circuit']); nOut('fast-splitter', 23, 'fast-splitter');

  // ---- west entrances: one arm each lifts the material onto the ring while the ring holds less than its cap ----
  const entry = (item, belt0, armTile, panelTile, index) => {
    const feeder = feed(armTile[0], armTile[1], W, item);
    const label = `IN: ${item}`;
    const sign = panel(panelTile[0], panelTile[1], label, item);
    return { feeder, sign, label, index };
  };
  const copperBelt = belt(-2, 0, E), plasticBelt = belt(-2, 1, E);
  const copper = entry('copper-plate', copperBelt, [-1, 0], [-2, -1], 1);
  const plastic = entry('plastic-bar', plasticBelt, [-1, 1], [-2, 2], 2);
  // Iron: one arm lifts iron onto the ring from the first tile where the iron belt turns south.
  const ironFeeder = feed(0, 2, S, 'iron-plate');
  const ironSign = panel(-2, 4, 'IN: iron-plate', 'iron-plate');
  const entranceInfo = (id, item, tile, e, sign, label, extra = {}) => ({ id, item, kind: 'item', mode: 'belt', side: 'west', flow: 'east', entrance: tile.position, position: tile.position, externalContact: { x: tile.position.x - 1, y: tile.position.y }, entranceBelt: tile.entity_number, panel: sign.entity_number, label, loopCap: caps[item], ...extra });
  ports.push(entranceInfo('IN-1', 'iron-plate', ironEntrance, null, ironSign, 'IN: iron-plate', { ringArm: ironFeeder.entity_number, feedsGearMachinesDirectly: true }));
  ports.push(entranceInfo('IN-2', 'copper-plate', copperBelt, null, copper.sign, copper.label, { ringArm: copper.feeder.entity_number }));
  ports.push(entranceInfo('IN-3', 'plastic-bar', plasticBelt, null, plastic.sign, plastic.label, { ringArm: plastic.feeder.entity_number }));
  const lubricantLabel = 'IN: lubricant';
  const lubricantPanel = panel(17, 6, lubricantLabel, 'lubricant', 'fluid');
  ports.push({ id: 'IN-4', item: 'lubricant', kind: 'fluid', mode: 'pipe', side: 'south', flow: 'north', position: byId(pipes.at(-1)).position, externalContact: { x: 13.5, y: 8.5 }, pipe: pipes.at(-1), panel: lubricantPanel.entity_number, label: lubricantLabel, consumers: PRODUCTS });

  // ---- outputs: three collector arms take their own product off the ring into their own one-stack passive provider ----
  const outputs = [];
  const outputX = { 'express-transport-belt': 25, 'express-underground-belt': 26, 'express-splitter': 27 };
  for (const name of PRODUCTS) {
    const x = outputX[name];
    const chest = add('passive-provider-chest', x, -2, { bar: 1 });
    const collector = arm(x, -1, S, [name]);
    const label = `OUT: ${name}`;
    const sign = panel(x, -3, label, name);
    outputs.push({ id: 'OUT-' + (outputs.length + 1), item: name, chest: chest.entity_number, collector: collector.entity_number, panel: sign.entity_number, label, position: chest.position, cap: OUTPUT_CAPS[name], slots: 1 });
  }
  // ---- power ----
  const poles = [];
  const pole = (x, y) => { const e = add('medium-electric-pole', x, y); poles.push(e); return e; };
  const entryPole = pole(-1, -1);
  const powerLabel = 'POWER: connect medium pole';
  const powerPanel = panel(0, -1, powerLabel, 'medium-electric-pole');
  const reach = p.entities['medium-electric-pole'].supply_area_distance, wireMax = p.entities['medium-electric-pole'].maximum_wire_distance;
  const electric = () => entities.filter(e => p.entities[e.name].energy_source?.type === 'electric');
  const covered = (e, pl) => intersects(box(e, p), { left: pl.position.x - reach, right: pl.position.x + reach, top: pl.position.y - reach, bottom: pl.position.y + reach });
  const keepClear = new Set(['-3,0', '-3,1', '-3,3']);
  const bounds = { left: -2, right: RING_EAST + 1, top: -4, bottom: 7 };
  const isFree = (x, y) => !occupied.has(`${x},${y}`) && !keepClear.has(`${x},${y}`) && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  for (;;) {
    const open = electric().filter(e => !poles.some(pl => covered(e, pl)));
    if (!open.length) break;
    let best;
    for (let y = bounds.top; y <= bounds.bottom; y++) for (let x = bounds.left; x <= bounds.right; x++) {
      if (!isFree(x, y)) continue;
      const probe = { name: 'medium-electric-pole', position: { x: x + 0.5, y: y + 0.5 } };
      if (!poles.some(pl => distance(pl, probe) <= wireMax)) continue;
      const gain = open.filter(e => covered(e, probe)).length;
      if (gain && (!best || gain > best.gain)) best = { x, y, gain };
    }
    assert(best, 'Cannot power every machine and arm');
    pole(best.x, best.y);
  }

  // ---- wires (2.1 blueprint wires belong to entities; a tuple is stored once at its source) ----
  const wire = (a, connector, b) => { (a.wires ||= []).push([a.entity_number, connector, b.entity_number, connector]); };
  function tree(nodes, connector, limit) {
    const reached = new Set([nodes[0]]);
    while (reached.size < nodes.length) {
      let best;
      for (const a of reached) for (const b of nodes) if (!reached.has(b)) {
        const d = distance(a, b);
        if (d <= limit(a, b) && (!best || d < best.d)) best = { a, b, d };
      }
      assert(best, `Disconnected wire network ${connector}`);
      wire(best.a, connector, best.b); reached.add(best.b);
    }
  }
  tree(poles, 5, () => wireMax);
  tree([reader, ...controlled, ...gated], 2, (a, b) => Math.min(p.entities[a.name].circuit_wire_max_distance, p.entities[b.name].circuit_wire_max_distance));

  const icons = ['express-transport-belt', 'express-underground-belt', 'express-splitter', 'passive-provider-chest'].map((name, i) => ({ index: i + 1, signal: { type: 'item', name } }));
  const blueprint = { blueprint: { item: 'blueprint', label: 'Express belt mall | AM2 | three express belts from plates', description: `Factorio ${p.gameVersion} Space Age. West: iron, copper and plastic belts, lubricant pipe south; connect power. Three passive provider chests (one stack each): express belt, underground, splitter. Gears, cable, circuits and the yellow and red tier are made inside. No modules or beacons. See the README for ports and the native test.`, version: blueprintVersion(p.gameVersion), icons, entities } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const footprint = { ...envelope(entities, p), includes: 'all entities, panels, poles, belts, fluid inlet and the three output chests; external supply excluded', counts: Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length])), entities: entities.length };
  const tech = technologyClosure(p, PRODUCTS, [...new Set(entities.map(e => e.name))]);
  const power = { entryPole: entryPole.entity_number, panel: powerPanel.entity_number, label: powerLabel, externalPolePosition: { x: -3.5, y: -0.5 }, poles: poles.map(e => e.entity_number) };
  // Ring room: the static bound the audit and the native run both use. Everything rides one lane of the ring at most.
  const ringBelts = loop.map(byId), turnTiles = ringBelts.filter((b, i) => (ringBelts[(i + ringBelts.length - 1) % ringBelts.length].direction || 0) !== (b.direction || 0)).length;
  const laneCapacity = (ringBelts.length - turnTiles) * 4;
  const adders = {};
  for (const e of controlled) adders[e.filters[0].name] = (adders[e.filters[0].name] || 0) + 1;
  const ringLimits = { tiles: ringBelts.length, turnTiles, laneCapacity, bound: Math.floor(laneCapacity * 0.75), adders };
  const manifest = {
    schema: 1, id: 'express-belt-mall', revision: 1, candidateSha256: hash, requiredGameVersion: p.gameVersion, prototypeSha256: options.prototypeSha256,
    intendedUse: 'on-demand express belt, underground and splitter from plates, plastic and lubricant; each product fills its own one-stack passive provider chest', products: PRODUCTS, outputCaps: { ...OUTPUT_CAPS }, ringCaps: { ...caps }, ringLimits, gearReserve: options.gearReserve ?? GEAR_RESERVE, gatedArms: gated.map(e => e.entity_number),
    equipment: { machine: 'assembling-machine-2', inserter: 'fast-inserter', transport: 'fast-transport-belt', undergroundPolicy: 'One red underground pair on the iron belt, over the lubricant inlet; the ring has none', modules: 0, beacons: 0, quality: 'normal' },
    footprint, inputPorts: ports, cells, directTransfers, loop, ironBelt, reader: reader.entity_number, pipes, outputs, power,
    technologyClosure: tech.closure, nativeProtocol: { ...PROTOCOL },
    status: { static: 'static-audit.json', native: 'native-report.json; qualified only when that report passed for candidateSha256' },
  };
  return { blueprint, code, hash, manifest, footprint, ports, tech, outputs };
}
