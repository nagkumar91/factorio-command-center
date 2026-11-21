// Layout of the blue-tier on-demand mall. Pure function of the pinned prototypes and a few knobs;
// generate.mjs writes the published files, validate.mjs and the tests read them back.
//
// Rows, north to south (tile y):  -2 input chests and the collector bend of the ring
//                                 -1 chest feed arms, labels
//                                  0 ring, westbound      1 ring, eastbound
//                                  2 machine arms and four of the five poles
//                                3-5 seven assembling machines 2 (three direct hand-offs in the gaps)
//                                  6 lubricant pipe
import assert from 'node:assert/strict';
import { sha, encodeKeeping, distance, filters, condition, envelope, technologyClosure, PROTOCOL } from './lib.mjs';

export const PRODUCTS = ['express-transport-belt', 'express-underground-belt', 'express-splitter', 'inserter', 'long-handed-inserter', 'fast-inserter', 'bulk-inserter'];
export const STOCK_CAPS = Object.freeze({ 'express-transport-belt': 30, 'express-underground-belt': 10, 'express-splitter': 5, inserter: 5, 'long-handed-inserter': 5, 'fast-inserter': 5, 'bulk-inserter': 5 });
export const INPUT_ORDER = ['iron-gear-wheel', 'iron-plate', 'electronic-circuit', 'advanced-circuit', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter'];
export const DEFAULT_INPUT_CAPS = Object.freeze({ 'iron-gear-wheel': 20, 'iron-plate': 8, 'electronic-circuit': 14, 'advanced-circuit': 8, 'fast-transport-belt': 4, 'fast-underground-belt': 2, 'fast-splitter': 2 });
const N = 0, E = 4, S = 8, W = 12;

export function design(p, reference, options = {}) {
  assert.equal(p.gameVersion, '2.1.24');
  const inputCaps = { ...DEFAULT_INPUT_CAPS, ...(options.inputCaps || {}) };
  const entities = [], loop = [], controlled = [], poles = [], cells = [], ports = [];
  function add(name, x, y, extra = {}) {
    const e = { entity_number: entities.length + 1, name, position: { x: x + 0.5, y: y + 0.5 }, ...extra };
    entities.push(e); return e;
  }
  const byId = id => entities[id - 1];
  const belt = (x, y, direction) => { const e = add('fast-transport-belt', x, y, { direction }); loop.push(e.entity_number); return e; };
  // An arm's blueprint direction is the side it picks up from; it drops on the opposite side.
  const arm = (x, y, direction, names, extra = {}) => add('fast-inserter', x, y, { direction, override_stack_size: 1, ...filters(names), ...extra });
  const panel = (x, y, text, name, type = 'item') => add('display-panel', x, y, { text, always_show: true, icon: { type, name } });

  // Seven machines in one row; the row is the whole width (24 tiles). The four inserter machines keep
  // one-tile gaps for the direct hand-offs, the three express machines touch.
  // West to east is also the order the ring serves them, small recipes first, as in the first version.
  const order = ['bulk-inserter', 'fast-inserter', 'inserter', 'long-handed-inserter', 'express-splitter', 'express-underground-belt', 'express-transport-belt'];
  const centre = { 'bulk-inserter': 1, 'fast-inserter': 5, inserter: 9, 'long-handed-inserter': 13, 'express-splitter': 16, 'express-underground-belt': 19, 'express-transport-belt': 22 };
  const east = 23, bend = 19;

  // One counter-clockwise ring, two rows tall, no branches, side-loads, splitters or undergrounds.
  // Inputs dropped on the westbound row reach the machines after a short trip round the west end,
  // so a small stock on the ring already carries the full feed rate. At the east end the ring bends
  // north around the output chest so that two collectors reach the one chest.
  belt(0, 0, S); belt(0, 1, E);
  for (let x = 1; x < east; x++) belt(x, 1, E);
  belt(east, 1, N); belt(east, 0, N); belt(east, -1, N);
  for (let x = east; x > bend; x--) belt(x, -2, W);
  belt(bend, -2, S); belt(bend, -1, S);
  for (let x = bend; x >= 1; x--) belt(x, 0, W);
  const reader = byId(loop[5]);
  reader.control_behavior = { circuit_read_hand_contents: true, circuit_contents_read_mode: 2 };

  // Seven input chests on the north edge, in the published order, one slot each.
  for (const [i, item] of INPUT_ORDER.entries()) {
    const x = 1 + i * 2, cap = inputCaps[item];
    const chest = add('steel-chest', x, -2, { bar: 1 });
    const feed = arm(x, -1, N, [item], { control_behavior: condition(item, cap) });
    controlled.push(feed);
    const label = `IN ${i + 1}: ${item} | N -> S`;
    const sign = panel(x + 1, -1, label, item);
    ports.push({ id: `IN-${i + 1}`, item, kind: 'item', mode: 'boundary-chest', side: 'north', flow: 'south', position: chest.position, externalContact: { x: chest.position.x, y: chest.position.y - 1 }, chest: chest.entity_number, inserter: feed.entity_number, panel: sign.entity_number, label, loopCap: cap, consumers: PRODUCTS.filter(n => p.recipes[n].ingredients.some(v => v.name === item)) });
  }

  // Arm tiles above each machine. The splitter and underground machines run on one ingredient arm:
  // the tile over the underground machine holds a pole and the tile west of the splitter arms is out of pole reach.
  const armTiles = { 'express-splitter': { ingredients: [16], product: 17 }, 'express-underground-belt': { ingredients: [18], product: 20 } };
  for (const recipe of order) {
    const x = centre[recipe], express = recipe.startsWith('express');
    const machine = add('assembling-machine-2', x, 4, { direction: express ? S : N, recipe });
    const solids = p.recipes[recipe].ingredients.filter(v => v.type === 'item' && !['inserter', 'fast-inserter'].includes(v.name)).map(v => v.name);
    const tiles = armTiles[recipe] || { ingredients: [x - 1, x + 1], product: x };
    const inputArms = tiles.ingredients.map(ax => arm(ax, 2, N, solids).entity_number);
    const output = arm(tiles.product, 2, S, [recipe], { control_behavior: condition(recipe, STOCK_CAPS[recipe]) });
    controlled.push(output);
    cells.push({ recipe, product: recipe, machine: machine.entity_number, inputArms, outputArm: output.entity_number, stockCap: STOCK_CAPS[recipe], directInputs: [] });
  }
  cells.sort((a, b) => PRODUCTS.indexOf(a.recipe) - PRODUCTS.indexOf(b.recipe));
  const cell = recipe => cells.find(c => c.recipe === recipe);
  // Always-on machine-to-machine hand-offs: a full output stock never starves the next recipe.
  const directTransfers = [];
  for (const [from, to, x, direction] of [['inserter', 'long-handed-inserter', 11, W], ['inserter', 'fast-inserter', 7, E], ['fast-inserter', 'bulk-inserter', 3, E]]) {
    const a = arm(x, 4, direction, [from]);
    const transfer = { item: from, source: cell(from).machine, destination: cell(to).machine, inserter: a.entity_number };
    directTransfers.push(transfer); cell(to).directInputs.push(transfer);
  }

  // Lubricant: one straight pipe along the south edge, open at the west edge, tapped by the three express machines.
  const pipes = [];
  for (let x = 0; x <= centre['express-transport-belt']; x++) pipes.push(add('pipe', x, 6).entity_number);
  const fluidLabel = 'IN 8: lubricant | W -> E';
  const fluidPanel = panel(centre['express-transport-belt'] + 1, 6, fluidLabel, 'lubricant', 'fluid');
  ports.push({ id: 'IN-8', item: 'lubricant', kind: 'fluid', mode: 'pipe', side: 'west', flow: 'east', position: byId(pipes[0]).position, externalContact: { x: -0.5, y: 6.5 }, pipe: pipes[0], panel: fluidPanel.entity_number, label: fluidLabel, consumers: PRODUCTS.slice(0, 3) });

  // Seven products exceed the five filter slots of one arm: two collectors feed the one provider.
  const provider = add('passive-provider-chest', bend + 2, 0);
  const collectNorth = arm(bend + 2, -1, N, PRODUCTS.slice(0, 5));
  const collectEast = arm(bend + 3, 0, E, PRODUCTS.slice(5));
  const outputLabel = 'OUT: 3 express belts + 4 inserters | one provider';
  const outputPanel = panel(bend + 1, -1, outputLabel, 'passive-provider-chest');

  // Five poles: one in each hand-off gap, one over the underground machine, one inside the collector bend.
  for (const [x, y] of [[3, 2], [7, 2], [11, 2], [19, 2], [bend + 3, -1]]) poles.push(add('medium-electric-pole', x, y));
  const powerLabel = 'POWER: connect medium pole | external electricity';
  const powerPanel = panel(0, -1, powerLabel, 'medium-electric-pole');

  // 2.1 blueprint wires belong to entities. A tuple is stored once at its source.
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
  tree(poles, 5, () => p.entities['medium-electric-pole'].maximum_wire_distance);
  tree([reader, provider, ...controlled], 2, (a, b) => Math.min(p.entities[a.name].circuit_wire_max_distance, p.entities[b.name].circuit_wire_max_distance));

  const blueprint = { blueprint: { item: 'blueprint', label: 'Blue-tier on-demand mall | AM2 | seven products', description: 'Factorio 2.1.24 Space Age. Seven solid input chests along north; lubricant west; connect power. One output provider. Stock caps include circulating products. No stack inserters, modules or beacons. See the README for ports and the native test.', version: Number((2n << 48n) + (1n << 32n) + (24n << 16n)), icons: [PRODUCTS[0], 'fast-inserter', 'bulk-inserter', 'passive-provider-chest'].map((name, i) => ({ index: i + 1, signal: { type: 'item', name } })), entities } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const footprint = { ...envelope(entities, p), includes: 'all entities, panels, poles, fluid inlet and output chest; external supply excluded', counts: Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length])), entities: entities.length };
  const tech = technologyClosure(p, PRODUCTS, [...new Set(entities.map(e => e.name))]);
  const output = { chest: provider.entity_number, collectors: [collectNorth.entity_number, collectEast.entity_number], panel: outputPanel.entity_number, label: outputLabel, position: provider.position };
  const power = { entryPole: poles[0].entity_number, panel: powerPanel.entity_number, label: powerLabel, externalPolePosition: { x: -1.5, y: -3.5 }, poles: poles.map(e => e.entity_number) };
  const manifest = {
    schema: 1, id: 'blue-tier-mall', revision: 2, candidateSha256: hash, requiredGameVersion: '2.1.24', prototypeSha256: options.prototypeSha256,
    reference, intendedUse: 'on-demand stock replenishment; no items/min target', products: PRODUCTS, stockCaps: { ...STOCK_CAPS },
    equipment: { machine: 'assembling-machine-2', inserter: 'fast-inserter', transport: 'fast-transport-belt', undergroundPolicy: 'No underground belts or pipes in the layout', modules: 0, beacons: 0, quality: 'normal' },
    footprint, inputPorts: ports, cells, directTransfers, loop, reader: reader.entity_number, pipes, output, power,
    technologyClosure: tech.closure, nativeProtocol: { ...PROTOCOL },
    status: { static: 'static-audit.json', native: 'native-report.json; qualified only when that report passed for candidateSha256' },
  };
  return { blueprint, code, hash, manifest, footprint, ports, tech, order, centre };
}
