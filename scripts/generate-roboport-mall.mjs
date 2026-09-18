import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { encodeBlueprint } from './blueprints.mjs';

// All one-tile coordinates refer to tile indices; centers are at n + 0.5.
// Factorio 2.0 directions: N=0, E=4, S=8, W=12. Inserters face pickup.
const raw = JSON.parse(fs.readFileSync('.cache/factorio/script-output/data-raw-dump.json'));
const prototypes = new Map(Object.values(raw).flatMap(t => Object.values(t)).filter(p => p.collision_box).map(p => [p.name, p]));
const stacks = new Map(Object.values(raw).flatMap(t => Object.values(t)).filter(p => p.stack_size).map(p => [p.name, p.stack_size]));
const entities = [], wires = [], occupied = new Map(), fluids = new Map(), cells = [];
const key = (x, y) => `${x},${y}`;
const fluidRows = { water: -28, 'crude-oil': -24, 'heavy-oil': -20, 'light-oil': -16, 'petroleum-gas': -12, lubricant: -8, 'sulfuric-acid': -4 };
const outputs = {
  'express-transport-belt': 400, 'express-underground-belt': 100, 'express-splitter': 50,
  'bulk-inserter': 100, 'long-handed-inserter': 100, 'medium-electric-pole': 100,
  'big-electric-pole': 50, substation: 50, 'pipe-to-ground': 100, 'storage-tank': 20,
  'small-lamp': 100, 'logistic-robot': 100, 'construction-robot': 100, roboport: 10,
};
function add(name, x, y, extra = {}, centered = false) {
  const p = prototypes.get(name);
  assert(p, `Unknown entity: ${name}`);
  const position = centered ? { x, y } : { x: x + .5, y: y + .5 };
  let [[lx, ly], [rx, ry]] = p.selection_box;
  if ([4, 12].includes(extra.direction)) [lx, ly, rx, ry] = [ly, lx, ry, rx];
  const tiles = [];
  for (let tx = Math.floor(position.x + lx + .001); tx < position.x + rx - .001; tx++) {
    for (let ty = Math.floor(position.y + ly + .001); ty < position.y + ry - .001; ty++) {
      const old = occupied.get(key(tx, ty));
      assert(!old, `${name} at ${position.x},${position.y} overlaps ${old?.name} #${old?.entity_number} on ${tx},${ty}`);
      tiles.push(key(tx, ty));
    }
  }
  const entity = { entity_number: entities.length + 1, name, position, ...extra };
  entities.push(entity);
  for (const tile of tiles) occupied.set(tile, entity);
  return entity;
}
function pipe(x, y, fluid, direction) {
  const existing = occupied.get(key(x, y));
  if (existing) {
    assert(existing.name === 'pipe' && direction === undefined && fluids.get(key(x, y)) === fluid, `Conflicting pipe ${fluid} at ${x},${y}`);
    return existing;
  }
  const p = add(direction === undefined ? 'pipe' : 'pipe-to-ground', x, y, {
    ...(direction === undefined ? {} : { direction }), tags: { mall_fluid: fluid },
  });
  fluids.set(key(x, y), fluid);
  return p;
}
function horizontal(x1, x2, y, fluid) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) pipe(x, y, fluid);
}
function vertical(x, y1, y2, fluid) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) pipe(x, y, fluid);
}
// A vertical branch crosses each foreign horizontal bus underground.
function tap(fluid, x, endY) {
  const start = fluidRows[fluid];
  for (let y = start + 1; y <= endY; y++) {
    const crossing = Object.entries(fluidRows).find(([f, row]) => f !== fluid && row === y + 1);
    if (crossing) {
      pipe(x, y, fluid, 0);
      pipe(x, y + 2, fluid, 8);
      y += 2;
    } else pipe(x, y, fluid);
  }
}
const busBounds = { water: [0, 93], 'crude-oil': [0, 16], 'heavy-oil': [8, 39], 'light-oil': [10, 53],
  'petroleum-gas': [12, 81], lubricant: [20, 164], 'sulfuric-acid': [90, 107] };
for (const [fluid, y] of Object.entries(fluidRows)) horizontal(...busBounds[fluid], y, fluid);

function requester(x, y, ingredients, recipe, furnace) {
  return add('requester-chest', x, y, {
    request_filters: { sections: [{ index: 1, filters: ingredients.map((p, i) => ({
      index: i + 1, name: p.name, quality: 'normal', comparator: '=',
      count: furnace ? 100 : Math.max(20, p.amount * 2, Math.min(stacks.get(p.name) * 2, Math.ceil(30 * 1.25 / (recipe.energy_required ?? .5) * p.amount))),
    })) }] },
  });
}
function station(name, recipe, x, y, cap) {
  const r = raw.recipe[recipe];
  assert(r, `Unknown recipe ${recipe}`);
  const product = r.results.find(p => p.type === 'item');
  const machine = add(name, x, y, {
    ...(name === 'electric-furnace' ? {} : { recipe }),
    tags: { mall_recipe: recipe, mall_role: outputs[recipe] ? 'output' : 'intermediate' },
  });
  const solid = r.ingredients.filter(p => p.type === 'item');
  let input, output;
  if (solid.length) {
    input = requester(x + 3, y - 1, solid, r, name === 'electric-furnace');
    add('bulk-inserter', x + 2, y - 1, { direction: 4 });
  }
  if (product) {
    const stackSize = Object.values(raw).map(t => t[product.name]).find(p => p?.stack_size)?.stack_size;
    const limit = cap ?? outputs[recipe] ?? 100;
    output = add('passive-provider-chest', x + 3, y + 1, {
      bar: Math.max(1, Math.ceil(limit / stackSize)),
      tags: { mall_product: product.name, mall_limit: limit, mall_role: outputs[recipe] ? 'output' : 'intermediate' },
    });
    const inserter = add('bulk-inserter', x + 2, y + 1, { direction: 12,
      control_behavior: { circuit_enabled: true, circuit_condition: {
        first_signal: { type: 'item', name: product.name, quality: 'normal' }, comparator: '<', constant: limit,
      } },
    });
    wires.push([output.entity_number, 1, inserter.entity_number, 1]);
  }
  cells.push({ recipe, machine: machine.entity_number, input: input?.entity_number, output: output?.entity_number });
  return machine;
}

// Refinery ports face north; water/crude wrap around its two sides.
add('oil-refinery', 10, 8, { recipe: 'advanced-oil-processing' });
tap('heavy-oil', 8, 5); tap('light-oil', 10, 5); tap('petroleum-gas', 12, 5);
tap('water', 4, 13); horizontal(4, 9, 13, 'water'); vertical(9, 11, 13, 'water');
tap('crude-oil', 16, 15); horizontal(11, 16, 15, 'crude-oil'); vertical(11, 11, 15, 'crude-oil');

const chemistry = [
  ['lubricant', 24], ['heavy-oil-cracking', 38], ['light-oil-cracking', 52],
  ['plastic-bar', 66], ['sulfur', 80], ['sulfuric-acid', 94], ['battery', 108],
];
let lubricantPump;
for (const [recipe, x] of chemistry) {
  station('chemical-plant', recipe, x, 8, recipe === 'plastic-bar' ? 400 : 100);
  const inputs = raw.recipe[recipe].ingredients.filter(p => p.type === 'fluid');
  for (const [i, input] of inputs.entries()) {
    const column = x + (i === 0 ? -1 : 1);
    if (recipe === 'heavy-oil-cracking' && input.name === 'heavy-oil') {
      tap(input.name, column, 0);
      const pump = add('pump', column + .5, 2, { direction: 8, control_behavior: {
        circuit_enabled: true,
        circuit_condition: { first_signal: { type: 'fluid', name: 'heavy-oil' }, comparator: '>', constant: 2000 },
      } }, true);
      vertical(column, 3, 6, input.name);
      horizontal(column, x + 4, 0, input.name);
      const tank = add('storage-tank', x + 5, 2, { tags: { mall_fluid: input.name } });
      wires.push([tank.entity_number, 1, pump.entity_number, 1]);
    } else if (recipe === 'lubricant') {
      tap(input.name, column, 0);
      lubricantPump = add('pump', column + .5, 2, { direction: 8, control_behavior: {
        circuit_enabled: true,
        circuit_condition: { first_signal: { type: 'fluid', name: 'lubricant' }, comparator: '<', constant: 5000 },
      } }, true);
      vertical(column, 3, 6, input.name);
    } else tap(input.name, column, 6);
  }
  const output = raw.recipe[recipe].results.find(p => p.type === 'fluid');
  if (output) {
    tap(output.name, x - 4, 10);
    horizontal(x - 4, x - 1, 10, output.name);
  }
}
// Lubricant storage also keeps a useful reserve for the blue belt tier.
vertical(20, 10, 12, 'lubricant'); horizontal(20, 28, 12, 'lubricant');
const lubricantTank = add('storage-tank', 29, 14, { tags: { mall_fluid: 'lubricant' } });
for (const [i, recipe] of ['express-transport-belt', 'express-underground-belt', 'express-splitter', 'electric-engine-unit'].entries()) {
  const x = 122 + i * 14;
  station('assembling-machine-3', recipe, x, 8);
  tap('lubricant', x, 6);
}

const dry = [
  ...Array.from({ length: 16 }, () => ['iron-plate', 100]),
  ...Array.from({ length: 8 }, () => ['copper-plate', 100]),
  ...Array.from({ length: 8 }, () => ['steel-plate', 100]),
  ['iron-gear-wheel', 200], ['iron-gear-wheel', 200], ['iron-stick', 100],
  ['copper-cable', 400], ['copper-cable', 400],
  ['electronic-circuit', 400], ['electronic-circuit', 400],
  ['advanced-circuit', 200], ['advanced-circuit', 200], ['advanced-circuit', 200],
  ['engine-unit', 50], ['engine-unit', 50], ['flying-robot-frame', 20], ['flying-robot-frame', 20],
  ...['transport-belt', 'fast-transport-belt', 'underground-belt', 'fast-underground-belt',
    'splitter', 'fast-splitter', 'inserter', 'fast-inserter', 'bulk-inserter', 'long-handed-inserter',
    'medium-electric-pole', 'big-electric-pole', 'substation', 'pipe', 'pipe-to-ground',
    'storage-tank', 'small-lamp', 'logistic-robot', 'construction-robot', 'roboport'].map(r => [r]),
];
const rowY = [28, 38, 48, 68, 78, 88];
for (const [i, [recipe, cap]] of dry.entries()) {
  station(['iron-plate', 'copper-plate', 'steel-plate'].includes(recipe) ? 'electric-furnace' : 'assembling-machine-3',
    recipe, 10 + (i % 12) * 14, rowY[Math.floor(i / 12)], cap);
}
for (const [i, item] of ['iron-ore', 'copper-ore', 'coal'].entries()) {
  add('passive-provider-chest', 3 + i * 4, 20, { tags: { mall_input: item } });
  add('display-panel', 3 + i * 4, 22, { text: `Supply ${item}`, icon: { type: 'item', name: item }, always_show: true });
}
for (const fluid of ['water', 'crude-oil']) add('display-panel', -2, fluidRows[fluid], {
  text: `Connect ${fluid} here`, icon: { type: 'fluid', name: fluid }, always_show: true,
});
for (const x of [22, 66, 110, 150]) for (const y of [16, 56, 96]) add('roboport', x, y, {}, true);

const poles = new Map();
for (let c = 0; c < 12; c++) for (let r = 0; r < 6; r++) {
  const p = add('substation', 15 + c * 14, 8 + r * 18, {}, true);
  poles.set(key(c, r), p);
  for (const neighbor of [poles.get(key(c - 1, r)), poles.get(key(c, r - 1))].filter(Boolean)) {
    wires.push([p.entity_number, 5, neighbor.entity_number, 5]);
  }
}

const lubricantRelay = poles.get(key(1, 0));
wires.push([lubricantPump.entity_number, 2, lubricantRelay.entity_number, 2], [lubricantTank.entity_number, 2, lubricantRelay.entity_number, 2]);

const description = [
  'Robot-fed Nauvis mall. Supply iron ore, copper ore and coal to the marked provider chests; connect water and crude oil at the northwest edge, and connect power.',
  'Seed the included roboports with 200-300 logistic robots. Requires logistic-system, assembling-machine-3, electric-furnace, advanced oil processing and all output recipes researched.',
  'Light oil is cracked into petroleum gas for plastic and sulfur. Lubricant production pauses above 5,000 in its tank; heavy-oil cracking starts above 2,000 heavy oil in the wired tank. All fluid outputs are connected internally.',
  'Includes blue belts/undergrounds/splitters, bulk and long-handed inserters, medium/big poles, substations, underground pipes, tanks, lamps, both robot types and roboports (stock target 10). Iron sticks are made inside.',
  'Output chests are capped. Full buffers pause production normally. Produced robots are stocked in chests; transfer them into roboports to expand the fleet.',
].join('\n\n');
const blueprint = { blueprint: { item: 'blueprint', label: 'Closed-oil Roboport Mall', description,
  version: 562949958467584,
  icons: [{ signal: { type: 'item', name: 'roboport' }, index: 1 }, { signal: { type: 'fluid', name: 'light-oil' }, index: 2 }, { signal: { type: 'item', name: 'express-transport-belt' }, index: 3 }],
  entities, wires,
} };
for (const e of entities) e.tags = { ...e.tags, mall_id: e.entity_number };
const base = 'mall/closed_oil_roboport_mall';
fs.writeFileSync(`${base}.json`, JSON.stringify(blueprint, null, 2) + '\n');
fs.writeFileSync(`${base}.txt`, encodeBlueprint(blueprint) + '\n');
fs.mkdirSync('.cache/roboport-mall', { recursive: true });
fs.writeFileSync('.cache/roboport-mall/manifest.json', JSON.stringify({ cells, outputs, fluidRows }, null, 2));
console.log(`Wrote ${path.resolve(base)}.{json,txt}: ${entities.length} entities, ${wires.length} wires, ${cells.length} production stations.`);
