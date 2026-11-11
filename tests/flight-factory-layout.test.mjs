import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGame, materialKey} from '../scripts/flight-factory-model.mjs';
import {planFactory} from '../scripts/flight-factory-planner.mjs';
import {generateFactoryBlueprint, provisionItemTransfers} from '../scripts/flight-factory-layout.mjs';

const box = (width = 1) => [[-width / 2 + .1, -width / 2 + .1], [width / 2 - .1, width / 2 - .1]];
function fixture({perishable = false} = {}) {
  const names = ['ore', 'copper', 'target', 'spoilage', 'logistic-robot'];
  const raw = {
    item: Object.fromEntries(names.map(name => [name, {type: 'item', name, stack_size: 100,
      ...(name === 'ore' && perishable ? {spoil_ticks: 600, spoil_result: 'spoilage'} : {})}])),
    resource: Object.fromEntries(['ore', 'copper'].map(name => [name, {type: 'resource', name, autoplace: {}, minable: {result: name}}])),
    recipe: {target: {name: 'target', type: 'recipe', ingredients: [{name: 'ore', amount: 10}, {name: 'copper', amount: 20}], results: [{name: 'target', amount: 1}]}},
    'assembling-machine': {'assembling-machine-2': {type: 'assembling-machine', name: 'assembling-machine-2', collision_box: box(3),
      crafting_categories: ['crafting'], crafting_speed: 1, energy_source: {type: 'electric'}}},
    'electric-pole': {substation: {name: 'substation', type: 'electric-pole', collision_box: box(2)}},
    container: {'steel-chest': {name: 'steel-chest', type: 'container', collision_box: box()}},
    'logistic-container': Object.fromEntries(['requester-chest', 'passive-provider-chest'].map(name => [name, {name, type: 'logistic-container', collision_box: box()}])),
    'display-panel': {'display-panel': {name: 'display-panel', type: 'display-panel', collision_box: box()}},
    inserter: Object.fromEntries(['bulk-inserter', 'stack-inserter'].map(name => [name, {name, type: 'inserter', collision_box: box(),
      rotation_speed: .04, extension_speed: .1, ...(name === 'stack-inserter' ? {stack_size_bonus: 4} : {})}])),
    'logistic-robot': {'logistic-robot': {name: 'logistic-robot', type: 'logistic-robot', collision_box: box(), speed: .05, max_payload_size: 1, energy_per_move: '5kJ', energy_per_tick: '.05kJ'}},
    roboport: {roboport: {name: 'roboport', type: 'roboport', collision_box: box(4), robot_slots_count: 7, charging_energy: '500kW', charging_offsets: [[-1, -1], [-1, 1], [1, -1], [1, 1]]}},
    'pipe-to-ground': {'pipe-to-ground': {name: 'pipe-to-ground', type: 'pipe-to-ground', collision_box: box(), fluid_box: {pipe_connections: [{connection_type: 'underground', max_underground_distance: 10}]}}},
  };
  const model = normalizeGame(raw), plan = planFactory(model, 'target');
  return {model, plan, layout: generateFactoryBlueprint(model, plan)};
}
const vector = direction => ({0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]})[direction || 0];
const point = (p, [dx, dy], sign = 1) => ({x: p.x + dx * sign, y: p.y + dy * sign});
const equalPoint = (a, b) => a.x === b.x && a.y === b.y;

test('direct boundaries retain the exact planned ingredients and summed demand', () => {
  const {plan, layout} = fixture(); assert.equal(layout.status, 'generated', layout.reason);
  const entities = layout.blueprint.entities;
  assert.deepEqual([...new Set(layout.inputs.map(materialKey))].sort(), plan.inputs.map(materialKey).sort());
  for (const expected of plan.inputs) {
    const ports = layout.inputs.filter(p => materialKey(p) === materialKey(expected));
    assert.ok(Math.abs(ports.reduce((n, p) => n + p.ratePerSecond, 0) - expected.perSecond) < 1e-9);
    for (const port of ports) {
      const arm = entities.find(e => /inserter$/.test(e.name) && equalPoint(point(e.position, vector(e.direction)), port.position));
      assert.ok(arm, 'saved inserter physically picks up from the declared boundary');
      const drop = point(arm.position, vector(arm.direction), -1);
      assert.ok(entities.some(e => e.recipe === 'target' && Math.abs(e.position.x - drop.x) <= 1 && Math.abs(e.position.y - drop.y) <= 1), 'drop is in the consuming machine');
      assert.equal(entities.find(e => e.entity_number === port.displayEntity)?.tags.flight_display_input, port.entityNumber);
    }
  }
  assert.match(layout.blueprint.description, new RegExp(`Add ${layout.logistics.robotCount} logistic robots`));
  assert.equal(layout.spec.infrastructureSeeds.reduce((n, p) => n + p.count, 0), layout.logistics.robotCount);
});

test('spoilage drains follow physical filtered arms into separate waste boundaries', () => {
  const {model, layout} = fixture({perishable: true}); assert.equal(layout.status, 'generated', layout.reason);
  assert.ok(layout.wasteOutputs.length > 0);
  assert.equal(layout.outputs.some(p => p.name === 'spoilage'), false, 'waste is never target or surplus production');
  const entities = new Map(layout.blueprint.entities.map(e => [e.entity_number, e]));
  for (const waste of layout.wasteOutputs) {
    const arm = entities.get(waste.inserterEntityNumber), source = entities.get(waste.sourceEntityNumber), chest = entities.get(waste.entityNumber);
    assert.equal(chest.name, 'steel-chest'); assert.equal(chest.tags.flight_waste, `item:${waste.name}`);
    assert.ok(equalPoint(point(arm.position, vector(arm.direction)), source.position));
    assert.ok(equalPoint(point(arm.position, vector(arm.direction), -1), chest.position));
    assert.equal(arm.use_filters, true); assert.deepEqual(arm.filters.map(f => f.name), [waste.name]);
    assert.ok(waste.spoiledFrom.every(name => model.goods.get(`item:${name}`).spoilResult === waste.name));
    assert.equal(entities.get(waste.displayEntity)?.tags.flight_display_waste, waste.entityNumber);
  }
  assert.ok(layout.wasteOutputs.some(w => entities.get(w.sourceEntityNumber).name === 'passive-provider-chest'
    && w.spoiledFrom.includes('ore')), 'stable product buffers also remove spoilage extracted from machine ingredients');
  assert.match(layout.operatingNotes.join(' '), /Continuously empty/);
  const faster = generateFactoryBlueprint(model, planFactory(model, 'target', {perSecond: .2}));
  assert.equal(faster.status, 'generated', faster.reason);
  const feed = faster.inputs.find(p => p.name === 'ore'), arm = faster.blueprint.entities.find(e => /inserter$/.test(e.name) && equalPoint(point(e.position, vector(e.direction)), feed.position));
  assert.equal(arm.name, 'bulk-inserter', 'perishable feeds cannot wait for a full stack-inserter hand');
});

test('large input batches receive parallel machine cells without changing ingredient demand', () => {
  const {model} = fixture(), plan = planFactory(model, 'target', {perSecond: 2});
  const imports = structuredClone(plan.inputs), rates = plan.steps.map(s => s.craftsPerSecond), before = plan.machineCount;
  provisionItemTransfers(model, plan);
  assert.ok(plan.machineCount > before, 'crafting capacity alone did not account for input transfer');
  assert.deepEqual(plan.inputs, imports); assert.deepEqual(plan.steps.map(s => s.craftsPerSecond), rates);
  const layout = generateFactoryBlueprint(model, plan); assert.equal(layout.status, 'generated', layout.reason);
  assert.equal(layout.spec.machineIds.length, plan.machineCount);
  for (const p of imports) assert.ok(Math.abs(layout.inputs.filter(q => materialKey(q) === materialKey(p)).reduce((n, q) => n + q.ratePerSecond, 0) - p.perSecond) < 1e-9);
});

test('perishable producers stay close to their consumers across a large stable-material chain', () => {
  const {model: original} = fixture(), raw = structuredClone(original.raw);
  const fillers = Array.from({length: 30}, (_, i) => `part-${String(i).padStart(2, '0')}`);
  for (const name of ['food', 'processed', ...fillers]) raw.item[name] = {type: 'item', name, stack_size: 100,
    ...(name === 'food' ? {spoil_ticks: 6000, spoil_result: 'spoilage'} : {})};
  raw.recipe = Object.fromEntries(fillers.map(name => [name, {name, type: 'recipe', ingredients: [{name: 'ore', amount: 1}], results: [{name, amount: 1}]}]));
  raw.recipe['a-consumer'] = {name: 'a-consumer', type: 'recipe', ingredients: [{name: 'food', amount: 10}], results: [{name: 'processed', amount: 1}]};
  raw.recipe['z-producer'] = {name: 'z-producer', type: 'recipe', ingredients: [{name: 'ore', amount: 1}], results: [{name: 'food', amount: 10}]};
  raw.recipe.target = {name: 'target', type: 'recipe', ingredients: ['processed', ...fillers].map(name => ({name, amount: 1})), results: [{name: 'target', amount: 1}]};
  const model = normalizeGame(raw), plan = planFactory(model, 'target'), before = structuredClone(plan), layout = generateFactoryBlueprint(model, plan);
  assert.equal(layout.status, 'generated', layout.reason);
  const producer = layout.blueprint.entities.find(e => e.recipe === 'z-producer'), consumer = layout.blueprint.entities.find(e => e.recipe === 'a-consumer');
  assert.ok(Math.hypot(producer.position.x - consumer.position.x, producer.position.y - consumer.position.y) <= 24,
    'fresh ingredients must not cross the unrelated stable-material factory');
  assert.deepEqual(plan, before, 'physical placement cannot alter recipe demand, boundaries or target');
});

test('crowded refinery leads can start underground crossings without disconnected or mixed pipe networks', () => {
  const {model: original} = fixture(), raw = structuredClone(original.raw);
  const fluids = ['crude-oil', 'water', 'heavy-oil', 'light-oil', 'petroleum-gas'];
  raw.fluid = Object.fromEntries(fluids.map(name => [name, {name, type: 'fluid', default_temperature: 25}]));
  for (const name of ['water', 'crude-oil']) raw.resource[name] = {name, type: 'resource', autoplace: {}, minable: {results: [{name, type: 'fluid', amount: 1}]}};
  const p = (name, amount) => ({name, type: 'fluid', amount});
  raw.recipe = {
    'advanced-oil-processing': {name: 'advanced-oil-processing', type: 'recipe', category: 'oil-processing', energy_required: 5,
      ingredients: [p('water', 50), p('crude-oil', 100)], results: [p('heavy-oil', 25), p('light-oil', 45), p('petroleum-gas', 55)]},
    'heavy-oil-cracking': {name: 'heavy-oil-cracking', type: 'recipe', category: 'chemistry', energy_required: 2,
      ingredients: [p('water', 30), p('heavy-oil', 40)], results: [p('light-oil', 30)]},
  };
  const fluidBox = (kind, x, y, direction) => ({production_type: kind, pipe_connections: [{position: [x, y], direction}]});
  raw['assembling-machine'] = {
    'oil-refinery': {name: 'oil-refinery', type: 'assembling-machine', collision_box: box(5), crafting_categories: ['oil-processing'], crafting_speed: 1, energy_source: {type: 'electric'},
      fluid_boxes: [fluidBox('input', -1, 2, 8), fluidBox('input', 1, 2, 8), ...[-2, 0, 2].map(x => fluidBox('output', x, -2, 0))]},
    'chemical-plant': {name: 'chemical-plant', type: 'assembling-machine', collision_box: box(3), crafting_categories: ['chemistry'], crafting_speed: 1, energy_source: {type: 'electric'},
      fluid_boxes: [...[-1, 1].map(x => fluidBox('input', x, -1, 0)), ...[-1, 1].map(x => fluidBox('output', x, 1, 8))]},
  };
  raw.pipe = {pipe: {name: 'pipe', type: 'pipe', collision_box: box()}};
  const model = normalizeGame(raw), plan = planFactory(model, {id: 'light-oil', type: 'fluid'}), layout = generateFactoryBlueprint(model, plan);
  assert.equal(plan.steps.length, 2); assert.equal(layout.status, 'generated', layout.reason);
  const pipes = layout.blueprint.entities.filter(e => ['pipe', 'pipe-to-ground'].includes(e.name));
  assert.ok(pipes.some(e => e.name === 'pipe-to-ground'));
  const byPosition = new Map(pipes.map(e => [`${e.position.x},${e.position.y}`, e])), byId = new Map(pipes.map(e => [e.entity_number, e]));
  const adjacent = e => {
    const found = [], directions = e.name === 'pipe' ? [0, 4, 8, 12] : [e.direction || 0];
    for (const d of directions) {
      const q = point(e.position, vector(d)), other = byPosition.get(`${q.x},${q.y}`);
      if (other && (other.name === 'pipe' || (other.direction || 0) === (d + 8) % 16)) found.push(other.entity_number);
    }
    if (e.name === 'pipe-to-ground') for (let distance = 2; distance <= 10; distance++) {
      const q = point(e.position, vector(e.direction), -distance), other = byPosition.get(`${q.x},${q.y}`);
      if (other?.name === 'pipe-to-ground' && (other.direction || 0) === ((e.direction || 0) + 8) % 16) { found.push(other.entity_number); break; }
    }
    return found;
  };
  const seen = new Set(), componentMaterials = [];
  for (const e of pipes) if (!seen.has(e.entity_number)) {
    const queue = [e.entity_number], materials = new Set();
    while (queue.length) { const id = queue.pop(); if (seen.has(id)) continue; seen.add(id); materials.add(byId.get(id).tags.flight_fluid); queue.push(...adjacent(byId.get(id))); }
    assert.equal(materials.size, 1, 'physically connected pipe networks cannot mix different fluids'); componentMaterials.push([...materials][0]);
  }
  assert.equal(componentMaterials.length, new Set(componentMaterials).size, 'each material has one connected saved pipe network');
  delete raw.recipe['heavy-oil-cracking'];
  raw.recipe['light-oil-cracking'] = {name: 'light-oil-cracking', type: 'recipe', category: 'chemistry', energy_required: 2,
    ingredients: [p('water', 30), p('light-oil', 30)], results: [p('petroleum-gas', 20)]};
  raw.recipe.target = {name: 'target', type: 'recipe', category: 'chemistry', ingredients: [{name: 'ore', amount: 1}, p('petroleum-gas', 20)], results: [{name: 'target', amount: 2}]};
  const downstreamModel = normalizeGame(raw), downstreamPlan = planFactory(downstreamModel, 'target'), downstream = generateFactoryBlueprint(downstreamModel, downstreamPlan);
  assert.equal(downstream.status, 'generated', downstream.reason);
  assert.equal(downstreamPlan.steps.length, 3, 'a blocked destination lead also admits a correctly facing tunnel');
});
