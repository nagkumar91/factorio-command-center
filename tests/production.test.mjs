import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { decodeBlueprint, blueprintMaterials } from '../scripts/blueprints.mjs';
import { normalizeEntries } from '../scripts/packer.mjs';
import '../site/lib/production.js';
const { planProduction, analyzeBlueprint } = globalThis.FactorioProduction;
const production = JSON.parse(await fs.readFile('site/data/production.json', 'utf8'));
const community = JSON.parse(await fs.readFile('site/data/community.json', 'utf8'));
const catalog = JSON.parse(await fs.readFile('site/data/catalog.json', 'utf8'));
const amounts = rows => Object.fromEntries(rows.map(r => [r.id, r.count]));

test('supplied fusion blueprint packs all 152 placements and separates fuel from circulating coolant', async () => {
  const object = decodeBlueprint(await fs.readFile('power/fusion_reactor_1_2gw.txt', 'utf8'));
  assert.equal(object.blueprint.label, 'Fusion Reactor (1.2GW)');
  const materials = blueprintMaterials(object, catalog);
  assert.equal(materials.entityCount, 152);
  assert.deepEqual(materials.excluded, []);
  assert.deepEqual(amounts(materials.entries), { pipe: 60, 'pipe-to-ground': 48, 'fusion-generator': 24, 'cryogenic-plant': 4, substation: 4, 'requester-chest': 4, inserter: 4, 'fusion-reactor': 4 });
  assert.ok(materials.entries.every(r => r.quality === 'normal'));
  const a = analyzeBlueprint(object, production);
  assert.deepEqual(a.inputs, ['fusion-power-cell']);
  assert.deepEqual(a.outputs, []);
  assert.deepEqual(a.internal, ['fluoroketone-cold', 'fluoroketone-hot', 'fusion-plasma']);
  assert.deepEqual(a.seeds, ['fluoroketone-cold']);
  assert.ok(a.serviceOutputs.includes('Electricity from fusion generators'));
  assert.ok(a.notes.some(n => n.includes('no roboports')));
  assert.equal(a.recipes.find(r => r.id === 'fluoroketone-cooling').count, 4);
});
test('fusion without cooling requires fresh coolant and exposes the hot return', () => {
  const a = analyzeBlueprint({ blueprint: { entities: [{ name: 'fusion-reactor' }, { name: 'fusion-generator' }] } }, production);
  assert.deepEqual(a.inputs, ['fluoroketone-cold', 'fusion-power-cell']);
  assert.deepEqual(a.outputs, ['fluoroketone-hot']);
  assert.deepEqual(a.seeds, []);
});
test('fusion supply plan manufactures fresh coolant and fuel from mined and extracted inputs', () => {
  const targets = [{ id: 'fusion-power-cell', count: 20 }, { id: 'fluoroketone-cold', count: 4000 }];
  const result = planProduction(targets, production);
  assert.deepEqual(result.external, []);
  for (const id of ['fusion-power-cell', 'fluoroketone', 'fluoroketone-cooling', 'lithium', 'lithium-plate', 'ammoniacal-solution-separation', 'holmium-plate', 'holmium-solution']) assert.ok(result.steps.some(s => s.id === id), id);
  for (const id of ['ammoniacal-solution', 'lithium-brine', 'fluorine', 'holmium-ore']) assert.ok(result.raw.some(r => r.id === id), id);
  for (const id of ['ammonia', 'fluoroketone-cold', 'fluoroketone-hot']) assert.ok(!result.raw.some(r => r.id === id), id);
  const stock = new Map(result.raw.map(r => [r.id, r.count]));
  for (const step of result.steps) {
    for (const p of step.ingredients) { assert.ok((stock.get(p.id) || 0) + 1e-6 >= p.amount, step.id + ': ' + p.id); stock.set(p.id, (stock.get(p.id) || 0) - p.amount); }
    for (const p of step.results) stock.set(p.id, (stock.get(p.id) || 0) + p.amount);
  }
  for (const t of targets) assert.ok(stock.get(t.id) >= t.count);
});

test('robot expansion mall makes its four outputs from five raw inputs with no belts', async () => {
  const object = decodeBlueprint(await fs.readFile('mall/robot_expansion_mall.txt', 'utf8'));
  const analysis = analyzeBlueprint(object, production);
  assert.deepEqual(analysis.inputs, ['coal', 'copper-ore', 'crude-oil', 'iron-ore', 'water']);
  assert.deepEqual(analysis.outputs, ['big-electric-pole', 'construction-robot', 'logistic-robot', 'roboport']);
  for (const item of ['iron-plate', 'copper-plate', 'steel-plate', 'iron-stick', 'iron-gear-wheel', 'copper-cable', 'electronic-circuit', 'advanced-circuit', 'plastic-bar', 'sulfur', 'sulfuric-acid', 'battery', 'pipe', 'engine-unit', 'electric-engine-unit', 'flying-robot-frame', 'lubricant', 'heavy-oil', 'light-oil', 'petroleum-gas']) assert.ok(analysis.internal.includes(item), item);
  assert.equal(analysis.missing.length, 0);
  const b = object.blueprint;
  assert.ok(!b.entities.some(e => /belt|splitter|loader/.test(e.name)));
  const requests = new Set(b.entities.flatMap(e => (e.request_filters?.sections || []).flatMap(s => (s.filters || []).map(f => f.name))));
  const supplied = new Set([...analysis.inputs, ...analysis.internal]);
  for (const name of requests) assert.ok(supplied.has(name), `Missing internal source for ${name}`);
  const extension = decodeBlueprint(await fs.readFile('mall/robot_extension_5x5.txt', 'utf8')).blueprint;
  for (const original of extension.entities) {
    const e = b.entities.find(e => e.tags?.mall_extension_id === original.entity_number);
    assert.equal(e?.name, original.name);
    assert.deepEqual(e.position, original.position);
  }
  for (const key of ['snap-to-grid', 'absolute-snapping', 'position-relative-to-grid']) assert.deepEqual(b[key], extension[key]);
});

test('belt mall includes the complete Tesla chain and repair packs from raw feeds', async () => {
  const object = decodeBlueprint((await fs.readFile('mall/compact_turbo_tesla_mall.txt', 'utf8')).trim());
  const analysis = analyzeBlueprint(object, production);
  assert.deepEqual(analysis.inputs, ['coal', 'copper-ore', 'crude-oil', 'holmium-ore', 'iron-ore', 'stone', 'water']);
  assert.deepEqual([...analysis.outputs].sort(), [
    'big-electric-pole', 'bulk-inserter', 'construction-robot', 'express-splitter',
    'express-transport-belt', 'express-underground-belt', 'logistic-robot',
    'long-handed-inserter', 'medium-electric-pole', 'pipe-to-ground', 'repair-pack',
    'roboport', 'small-lamp', 'storage-tank', 'substation', 'tesla-turret',
  ].sort());
  for (const item of ['light-oil', 'superconductor', 'supercapacitor', 'teslagun', 'electrolyte', 'holmium-plate']) {
    assert.ok(analysis.internal.includes(item), item);
  }
  assert.equal(analysis.missing.length, 0);
  assert.ok(!object.blueprint.entities.some(e => ['requester-chest', 'medium-electric-pole'].includes(e.name)));
});

test('substation mall preserves the supplied 5x5 robot extension and its placement grid', async () => {
  const mall = decodeBlueprint(await fs.readFile('mall/compact_turbo_tesla_mall.txt', 'utf8')).blueprint;
  const extension = decodeBlueprint(await fs.readFile('mall/robot_extension_5x5.txt', 'utf8')).blueprint;
  const kept = mall.entities.filter(e => e.tags?.mall_extension_id);
  assert.equal(kept.length, 110);
  assert.equal(mall.entities.filter(e => e.name === 'roboport').length, 25);
  assert.equal(mall.entities.filter(e => e.name === 'big-electric-pole').length, 85);
  assert.equal(mall.entities.filter(e => e.name === 'substation').length, 22);
  const ids = new Map();
  for (const original of extension.entities) {
    const e = kept.find(e => e.tags.mall_extension_id === original.entity_number);
    assert.equal(e.name, original.name);
    assert.deepEqual(e.position, original.position);
    ids.set(original.entity_number, e.entity_number);
  }
  for (const key of ['snap-to-grid', 'absolute-snapping', 'position-relative-to-grid']) assert.deepEqual(mall[key], extension[key]);
  const wireKey = ([a, ca, b, cb]) => a < b ? `${a}:${ca}-${b}:${cb}` : `${b}:${cb}-${a}:${ca}`;
  const wires = new Set(mall.wires.map(wireKey));
  for (const [a, ca, b, cb] of extension.wires) assert.ok(wires.has(wireKey([ids.get(a), ca, ids.get(b), cb])));
});

test('new roboport mall consumes both oil byproducts and includes its declared ore smelting', async () => {
  const object = JSON.parse(await fs.readFile('mall/closed_oil_roboport_mall.json', 'utf8'));
  const analysis = analyzeBlueprint(object, production);
  assert.deepEqual(analysis.inputs, ['coal', 'copper-ore', 'crude-oil', 'iron-ore', 'water']);
  assert.ok(analysis.outputs.includes('roboport'));
  assert.ok(analysis.outputs.includes('express-underground-belt'));
  assert.ok(!analysis.outputs.includes('light-oil'));
  assert.ok(!analysis.outputs.includes('heavy-oil'));
  assert.ok(analysis.internal.includes('iron-stick'));
  assert.equal(analysis.missing.length, 0);
  assert.equal(analysis.recipes.find(r => r.id === 'iron-plate').count, 16);
});
test('furnace annotations do not turn an unrelated crafting recipe into smelting', () => {
  const analysis = analyzeBlueprint({ blueprint: { entities: [
    { name: 'electric-furnace', tags: { mall_recipe: 'roboport' } },
    { name: 'assembling-machine-3', tags: { mall_recipe: 'iron-plate' } },
  ] } }, production);
  assert.equal(analysis.recipes.length, 0);
  assert.ok(analysis.notes.some(n => n.includes('choose their recipe')));
});

test('solar panel starts at ores and aggregates cable batches before rounding', () => {
  const one = planProduction([{ id: 'solar-panel', count: 1 }], production);
  assert.deepEqual(amounts(one.raw), { 'copper-ore': 28, 'iron-ore': 40 });
  assert.deepEqual(amounts(one.surplus), { 'copper-cable': 1 });
  const two = planProduction([{ id: 'solar-panel', count: 1 }, { id: 'solar-panel', count: 1 }], production);
  assert.deepEqual(amounts(two.raw), { 'copper-ore': 55, 'iron-ore': 80 });
  assert.equal(two.surplus.length, 0);
});
test('accumulator manufactures acid despite mineable acid on another planet', () => {
  const result = planProduction([{ id: 'accumulator', count: 1 }], production);
  assert.deepEqual(amounts(result.raw), { 'copper-ore': 5, 'crude-oil': 300, 'iron-ore': 9, water: 500 });
  assert.ok(result.steps.some(s => s.id === 'sulfuric-acid'));
  assert.equal(result.external.length, 0);
});
test('installed substation recipe uses copper cable and combines shared circuits', () => {
  const recipe = production.recipes.find(r => r.id === 'substation');
  assert.equal(recipe.ingredients.find(p => p.id === 'copper-cable').amount, 6);
  const result = planProduction([{ id: 'substation', count: 1 }], production);
  assert.deepEqual(amounts(result.raw), { coal: 5, 'copper-ore': 28, 'crude-oil': 200, 'iron-ore': 60, water: 100 });
});
test('shared oil refining credits all three products from the same crafts', () => {
  const result = planProduction([{ id: 'heavy-oil', count: 50 }, { id: 'light-oil', count: 90 }, { id: 'petroleum-gas', count: 110 }], production);
  assert.deepEqual(amounts(result.raw), { 'crude-oil': 200, water: 100 });
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].crafts, 2);
  assert.equal(result.surplus.length, 0);
});
test('combined finished/intermediate order conserves ingredients in executable step order', () => {
  const targets = [{ id: 'solar-panel', count: 100 }, { id: 'accumulator', count: 84 }, { id: 'substation', count: 8 }, { id: 'construction-robot', count: 50 }, { id: 'logistic-robot', count: 50 }, { id: 'copper-cable', count: 10 }];
  const result = planProduction(targets, production);
  const stock = new Map(result.raw.map(r => [r.id, r.count]));
  for (const step of result.steps) {
    assert.ok(Number.isInteger(step.crafts) && step.crafts > 0);
    for (const p of step.ingredients) {
      assert.ok((stock.get(p.id) || 0) + 1e-6 >= p.amount, `${step.id} is missing ${p.id}`);
      stock.set(p.id, (stock.get(p.id) || 0) - p.amount);
    }
    for (const p of step.results) stock.set(p.id, (stock.get(p.id) || 0) + p.amount);
  }
  for (const t of targets) { assert.ok(stock.get(t.id) >= t.count); stock.set(t.id, stock.get(t.id) - t.count); }
  for (const [id, count] of stock) assert.equal(count, amounts(result.surplus)[id] || 0, id);
});
test('supplied intermediates stop expansion at the selected factory boundary', () => {
  const result = planProduction([{ id: 'solar-panel', count: 1 }], production, { supplied: ['iron-plate', 'copper-plate', 'steel-plate'] });
  assert.deepEqual(amounts(result.raw), { 'copper-plate': 28, 'iron-plate': 15, 'steel-plate': 5 });
  assert.ok(!result.steps.some(s => s.id === 'steel-plate'));
});
test('unselected random-yield routes remain explicit outside supplies', () => {
  const result = planProduction([{ id: 'uranium-fuel-cell', count: 10 }], production);
  assert.ok(result.external.includes('uranium-235'));
  assert.ok(result.external.includes('uranium-238'));
  assert.ok(!result.steps.some(s => s.id === 'uranium-processing'));
});
test('bad counts, unknown products, and recipe cycles fail clearly', () => {
  for (const count of ['', 0, -1, 1.5, NaN, Infinity, 1000001]) assert.throws(() => planProduction([{ id: 'solar-panel', count }], production));
  assert.throws(() => planProduction([{ id: 'fake-item', count: 1 }], production), /available/);
  const part = id => ({ id, amount: 1, probability: 1 });
  const cyclic = { rawResources: [], defaults: { a: 'a', b: 'b' }, recipes: [{ id: 'a', ingredients: [part('b')], results: [part('a')] }, { id: 'b', ingredients: [part('a')], results: [part('b')] }] };
  assert.throws(() => planProduction([{ id: 'a', count: 1 }], cyclic), /loop/);
});
test('solar factory exposes operational feeds and three products; solar power has service outputs', () => {
  const factories = community.blueprints.filter(b => b.section === 'Solar, Accumulators, and Substations');
  assert.equal(factories.length, 2);
  for (const b of factories) {
    assert.deepEqual(b.analysis.inputs, ['coal', 'copper-plate', 'iron-plate', 'petroleum-gas', 'steel-plate', 'water']);
    assert.deepEqual(b.analysis.outputs, ['accumulator', 'solar-panel', 'substation']);
    assert.ok(b.analysis.internal.includes('battery'));
  }
  const power = community.blueprints.find(b => b.name === 'Solar Block');
  assert.equal(power.analysis.kind, 'Power');
  assert.deepEqual(power.analysis.outputs, []);
  assert.ok(power.analysis.serviceOutputs.includes('Electricity during daylight'));
});
test('robot factory includes frames, engines, batteries, and both robot types', () => {
  const b = community.blueprints.find(b => b.name === 'Robots (AM2)');
  for (const id of ['flying-robot-frame', 'electric-engine-unit', 'battery']) assert.ok(b.analysis.internal.includes(id));
  for (const id of ['construction-robot', 'logistic-robot', 'roboport']) assert.ok(b.analysis.outputs.includes(id));
  assert.ok(b.analysis.inputs.includes('lubricant'));
});
test('heating towers burn ordinary fuel and are not confused with nuclear reactors', () => {
  const heating = analyzeBlueprint({ blueprint: { entities: [{ name: 'heating-tower' }] } }, production);
  assert.ok(heating.serviceInputs.includes('Burnable fuel for heating towers'));
  assert.ok(!heating.serviceInputs.includes('Uranium fuel cells'));
});
test('all imported strings decode, have explainers and local previews, and pack valid build materials', async () => {
  assert.equal(community.masterCount, 546);
  assert.equal(community.pageCount, 481);
  assert.equal(community.blueprints.length, 632);
  for (const b of community.blueprints) {
    const decoded = decodeBlueprint(b.code);
    assert.ok(decoded.blueprint, b.name);
    assert.ok(b.analysis.notes.length || b.analysis.serviceOutputs.length, b.name);
    assert.deepEqual(b.entries, blueprintMaterials(decoded, catalog).entries, b.name);
    assert.deepEqual(b.analysis, analyzeBlueprint(decoded, production), b.name);
    normalizeEntries(b.entries, catalog);
    await fs.access('site/' + b.preview);
  }
  for (const f of catalog.fluids) await fs.access('site/' + f.icon);
});
