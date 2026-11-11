import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGame, energy, materialKey, machinePorts} from '../scripts/flight-factory-model.mjs';
import {planFactory, auditBalance} from '../scripts/flight-factory-planner.mjs';
import {solveLinearProgram} from '../scripts/flight-factory-solver.mjs';

function game(recipes, resources = ['ore'], extra = {}) {
  const names = new Set([...resources, ...recipes.flatMap(r => [...r.ingredients, ...r.results].map(p => p.name))]);
  return normalizeGame({item: Object.fromEntries([...names].map(name => [name, {type: 'item', name, stack_size: 100}])),
    resource: Object.fromEntries(resources.map(name => [name, {type: 'resource', name, autoplace: {}, minable: {result: name}}])),
    recipe: Object.fromEntries(recipes.map(r => [r.name, {type: 'recipe', enabled: true, energy_required: 1, ...r}])),
    'assembling-machine': {assembler: {type: 'assembling-machine', name: 'assembler', crafting_categories: ['crafting'], crafting_speed: 1, energy_source: {type: 'electric'}, collision_box: [[-1.2, -1.2], [1.2, 1.2]]}}, ...extra});
}
const p = (name, amount = 1, other = {}) => ({name, amount, ...other});
const recipe = (name, ingredients, results) => ({name, ingredients, results});
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('three physical fluid boxes use the native outer ports for two unindexed recipe fluids', () => {
  const machine = {fluid_boxes: [-2, 0, 2].map(x => ({production_type: 'input', pipe_connections: [{direction: 8, position: [x, 2]}]}))};
  const recipe = {ingredients: [{id: 'fluorine', type: 'fluid'}, {id: 'ammonia', type: 'fluid'}], results: []};
  assert.deepEqual(machinePorts(machine, recipe).map(p => p.connection.position), [[-2, 2], [2, 2]]);
  recipe.ingredients[1].fluidboxIndex = 2;
  assert.deepEqual(machinePorts(machine, recipe).map(p => p.connection.position), [[-2, 2], [0, 2]], 'explicit recipe indices stay authoritative');
});

test('shared demand and co-products are balanced globally without duplicating upstream recipes', () => {
  const model = game([
    recipe('split', [p('ore')], [p('a', 2), p('b', 3)]),
    recipe('left', [p('a', 2)], [p('left')]), recipe('right', [p('b', 3)], [p('right')]),
    recipe('target', [p('left'), p('right')], [p('target')]),
  ]);
  const plan = planFactory(model, 'target', {perSecond: 1});
  assert.equal(plan.status, 'planned'); near(plan.inputs[0].perSecond, 1);
  near(plan.steps.find(s => s.recipe === 'split').craftsPerSecond, 1);
  assert.deepEqual(plan.surplus, []); assert.equal(plan.balance.passed, true);
});

test('alternative recipes use co-products before adding fresh upstream demand', () => {
  const model = game([recipe('split', [p('ore')], [p('a', 2), p('b')]), recipe('a', [p('ore', 10)], [p('a')]),
    recipe('b', [p('ore', 10)], [p('b')]), recipe('target', [p('a'), p('b')], [p('target')])]);
  const plan = planFactory(model, 'target', {perSecond: 1});
  near(plan.inputs[0].perSecond, 1); near(plan.surplus.find(p => p.id === 'a').perSecond, 1);
  assert.equal(plan.steps.some(s => s.recipe === 'a' || s.recipe === 'b'), false);
});

test('unbootstrappable production cycles do not become free raw factories', () => {
  const model = game([recipe('cycle', [p('seed')], [p('seed', 2), p('target')])]);
  assert.equal(planFactory(model, 'target').status, 'unsupported');
  const imported = planFactory(model, 'target', {mode: 'intermediary'});
  assert.equal(imported.status, 'planned'); assert.equal(imported.rawOnly, false);
  assert.ok(imported.startupStock.length || imported.inputs.some(p => p.id === 'seed'));
});

test('selected catalyst cycles explicitly report startup stock even when a seed recipe exists', () => {
  const model = game([recipe('seed', [p('ore', 100)], [p('seed')]), recipe('cycle', [p('seed')], [p('seed', 2), p('target')])]);
  const plan = planFactory(model, 'target');
  assert.equal(plan.status, 'planned'); assert.equal(plan.rawOnly, false);
  assert.ok(plan.startupStock.some(s => s.id === 'seed'));
});

test('random yields and result ranges use expectations and are explicitly flagged', () => {
  const model = game([recipe('extract', [p('ore')], [p('target', 1, {probability: .1}), {name: 'waste', amount_min: 1, amount_max: 3}])]);
  const plan = planFactory(model, 'target', {perSecond: 1});
  near(plan.inputs[0].perSecond, 10); near(plan.surplus.find(p => p.id === 'waste').perSecond, 20);
  assert.equal(plan.stochastic, true); assert.match(plan.warnings.join(' '), /expectations/);
});

test('unused random surplus does not make a deterministic target stochastic', () => {
  const model = game([recipe('extract', [p('ore')], [p('target'), p('seed', 1, {probability: .02})])]);
  const plan = planFactory(model, 'target', {perSecond: 1});
  assert.equal(plan.stochastic, false);
  assert.deepEqual(plan.stochasticSurplus.map(p => p.id), ['seed']);
  assert.deepEqual(plan.stochasticDependencyAudit.eligibleOutputKeys, []);
  near(plan.inputs[0].perSecond, 1);
});

test('random target dependencies propagate through selected intermediate recipes', () => {
  const model = game([recipe('extract', [p('ore')], [p('seed', 1, {probability: .1}), p('waste')]),
    recipe('grow', [p('seed')], [p('intermediate')]), recipe('target', [p('intermediate')], [p('target')])]);
  const plan = planFactory(model, 'target', {perSecond: 1});
  assert.equal(plan.stochastic, true);
  assert.deepEqual(plan.stochasticDependencyAudit.eligibleOutputKeys, ['item:target']);
  assert.deepEqual(plan.stochasticDependencyAudit.variableMaterials.find(p => p.material === 'item:target').dependsOn, ['item:intermediate']);
  near(plan.inputs[0].perSecond, 10);
  const imported = planFactory(model, 'target', {mode: 'intermediary'});
  assert.equal(imported.stochastic, false, 'an imported ingredient does not inherit an unplaced upstream recipe');
  const constantRange = planFactory(game([recipe('fixed', [p('ore')], [{name: 'target', amount_min: 2, amount_max: 2}])]), 'target');
  assert.equal(constantRange.stochastic, false);
});

test('intrinsic productivity respects catalyst exclusions and fuel is a physical input', () => {
  const model = game([recipe('target', [p('ore')], [p('target', 3, {ignored_by_productivity: 1})])], ['ore'], {
    item: {ore: {type: 'item', name: 'ore', stack_size: 100}, target: {type: 'item', name: 'target', stack_size: 100}, coal: {type: 'item', name: 'coal', stack_size: 100, fuel_category: 'chemical', fuel_value: '4MJ'}},
    resource: {ore: {type: 'resource', name: 'ore', autoplace: {}, minable: {result: 'ore'}}, coal: {type: 'resource', name: 'coal', autoplace: {}, minable: {result: 'coal'}}},
    'assembling-machine': {burner: {name: 'burner', type: 'assembling-machine', collision_box: [[-1, -1], [1, 1]], crafting_categories: ['crafting'], crafting_speed: 2,
      effect_receiver: {base_effect: {productivity: .5}}, energy_source: {type: 'burner', fuel_categories: ['chemical'], effectivity: 1}, energy_usage: '1MW'}},
  });
  const plan = planFactory(model, 'target', {perSecond: 4});
  near(plan.inputs.find(p => p.id === 'ore').perSecond, 1); near(plan.inputs.find(p => p.id === 'coal').perSecond, .125);
  near(plan.steps[0].exactMachineCount, .5); assert.equal(energy('4MJ'), 4e6);
});

test('mode boundaries remain explicit and do not silently import missing raw ingredients', () => {
  const model = game([recipe('a', [p('ore')], [p('a')]), recipe('b', [p('a')], [p('b')]), recipe('target', [p('a'), p('b')], [p('target')])]);
  const raw = planFactory(model, 'target', {mode: 'raw'}), mixed = planFactory(model, 'target', {mode: 'mixed'}), intermediate = planFactory(model, 'target', {mode: 'intermediary'});
  assert.deepEqual(raw.inputs.map(materialKey), ['item:ore']);
  assert.deepEqual(mixed.inputs.map(materialKey), ['item:b', 'item:ore']);
  assert.deepEqual(intermediate.inputs.map(materialKey), ['item:a', 'item:b']);
  assert.equal(raw.rawOnly, true); assert.equal(mixed.rawOnly, false);
  assert.throws(() => planFactory(model, 'target', {perSecond: NaN}), /rate/);
});

test('balance audit catches missing shared intermediates independently of stored status', () => {
  const model = game([recipe('a', [p('ore')], [p('a')]), recipe('target', [p('a', 2)], [p('target')])]);
  const plan = planFactory(model, 'target', {perSecond: 1});
  plan.steps.find(s => s.recipe === 'a').craftsPerSecond /= 2;
  assert.equal(auditBalance(plan, model).passed, false);
});

test('coverage excludes self-recycling and locked virtual items, while retaining the full audit', () => {
  const model = game([recipe('target', [p('ore')], [p('target')]),
    {...recipe('ghost-recycling', [p('ghost')], [p('ghost', .25)]), hidden: true, category: 'recycling'},
    {...recipe('editor', [p('ore')], [p('editor')]), enabled: false, hidden: true}]);
  assert.equal(model.recipeProducts.has('item:ghost'), true);
  assert.equal(model.eligibleProducts.has('item:ghost'), false);
  assert.equal(model.eligibleProducts.has('item:editor'), false);
  assert.equal(model.eligibleProducts.has('item:target'), true);
});

test('a natural seed remains finite startup stock, not a continuous target import', () => {
  const model = game([recipe('breeding', [p('fish', 2), p('ore')], [p('fish', 3)])], ['ore', 'fish']);
  const plan = planFactory(model, 'fish');
  assert.equal(plan.status, 'planned'); assert.equal(plan.rawOnly, false);
  assert.deepEqual(plan.inputs.map(i => i.id), ['ore']);
  assert.equal(plan.startupStock.find(s => s.id === 'fish').amount, 2);
});

test('simplex agrees with independently enumerated polygon vertices', () => {
  let seed = 481;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let t = 0; t < 100; t++) {
    const A = [[1, 0], [0, 1], [-1, -1], ...Array.from({length: 4}, () => [1 + random() * 10, 1 + random() * 10])];
    const b = [10, 10, -1, ...Array.from({length: 4}, () => 20 + random() * 40)], c = [random() * 2 - 1, random() * 2 - 1];
    const constraints = [...A, [-1, 0], [0, -1]], rhs = [...b, 0, 0]; let best = -Infinity;
    for (let i = 0; i < constraints.length; i++) for (let j = i + 1; j < constraints.length; j++) {
      const [a, d] = constraints[i], [e, f] = constraints[j], det = a * f - d * e;
      if (Math.abs(det) < 1e-10) continue;
      const x = (rhs[i] * f - d * rhs[j]) / det, y = (a * rhs[j] - rhs[i] * e) / det;
      if (constraints.every((r, k) => r[0] * x + r[1] * y <= rhs[k] + 1e-8)) best = Math.max(best, c[0] * x + c[1] * y);
    }
    const actual = solveLinearProgram(A, b, c);
    assert.equal(actual.status, 'optimal'); near(actual.objective, best);
  }
  assert.equal(solveLinearProgram([[1], [-1]], [1, -2], [1]).status, 'infeasible');
  assert.equal(solveLinearProgram([[-1]], [0], [1]).status, 'unbounded');
});
