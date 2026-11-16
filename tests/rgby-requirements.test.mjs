import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateRequirements, DEFAULT_TARGETS, EXTERNAL_INPUTS } from '../scripts/rgby-science/requirements.mjs';

// Portable relevant fields from the exact native 2.1.24 prototype snapshot.
const dump = fs.readFileSync(new URL('./fixtures/rgby-prototypes.json', import.meta.url));
const raw = JSON.parse(dump);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

// Independently hand-balanced from this dump's ingredient and batch quantities.
const expectedExternal = {
  'iron-plate': 1025, 'copper-plate': 1795, 'steel-plate': 110,
  'plastic-bar': 320, sulfur: 15, 'sulfuric-acid': 500, lubricant: 150,
};
const expectedCrafts = {
  'automation-science-pack': 30, 'logistic-science-pack': 30,
  'chemical-science-pack': 15, 'utility-science-pack': 10,
  'iron-gear-wheel': 115, inserter: 30, 'transport-belt': 15,
  'electronic-circuit': 650, 'copper-cable': 1145, 'advanced-circuit': 85,
  'engine-unit': 40, pipe: 80, 'processing-unit': 20,
  'low-density-structure': 30, 'flying-robot-frame': 10,
  'electric-engine-unit': 10, battery: 20,
};

test('pins the portable fixture and its original native prototype profile', () => {
  assert.equal(createHash('sha256').update(dump).digest('hex'), '2027108829dab62d20ac9490443226c45400077b536efddeeee5dad39eec720c');
  const native=JSON.parse(fs.readFileSync(new URL('../blueprint-sources/rgby-science/native-report.json',import.meta.url)));
  assert.equal(raw.sourcePrototypeSha256,native.prototypeSha256);
});

test('30 RGBY/min expands every intermediate to the fixed external boundary', () => {
  const r = calculateRequirements(raw);
  assert.deepEqual(r.finalOutputsPerMinute, DEFAULT_TARGETS);
  assert.deepEqual(r.externalPerMinute, expectedExternal);
  assert.deepEqual(r.craftsPerMinute, expectedCrafts);
  assert.deepEqual(Object.keys(r.externalPerMinute).sort(), [...EXTERNAL_INPUTS].sort());
  for (const name of ['electronic-circuit', 'advanced-circuit', 'processing-unit',
    'iron-gear-wheel', 'engine-unit', 'electric-engine-unit', 'flying-robot-frame', 'low-density-structure']) {
    assert.ok(r.craftsPerMinute[name] > 0);
    assert.equal(r.externalPerMinute[name], undefined);
  }
});

test('independent whole-factory flow balance closes for every product and ingredient', () => {
  const r = calculateRequirements(raw);
  const net = { ...r.externalPerMinute };
  for (const [name, crafts] of Object.entries(r.craftsPerMinute)) {
    for (const product of raw.recipe[name].results) net[product.name] = (net[product.name] ?? 0) + crafts * product.amount;
    for (const ingredient of raw.recipe[name].ingredients) net[ingredient.name] = (net[ingredient.name] ?? 0) - crafts * ingredient.amount;
  }
  for (const [name, amount] of Object.entries(net)) close(amount, r.finalOutputsPerMinute[name] ?? 0);
  // Copper = cable crafts + LDS copper + red science copper + battery copper.
  assert.equal(r.externalPerMinute['copper-plate'], 1145 + 30 * 20 + 30 + 20);
  // Iron = gears + circuits + inserters + belt batches + pipes + batteries.
  assert.equal(r.externalPerMinute['iron-plate'], 115 * 2 + 650 + 30 + 15 + 80 + 20);
});

test('ideal rates use AM2 speed, chemical plant speed, recipe time and batch yield', () => {
  const r = calculateRequirements(raw);
  const expected = {
    'automation-science-pack': 10 / 3, 'logistic-science-pack': 4,
    'chemical-science-pack': 8, 'utility-science-pack': 14 / 3,
    'iron-gear-wheel': 23 / 18, inserter: 1 / 3, 'transport-belt': 1 / 6,
    'electronic-circuit': 65 / 9, 'copper-cable': 229 / 18,
    'advanced-circuit': 34 / 3, 'engine-unit': 80 / 9, pipe: 8 / 9,
    'processing-unit': 40 / 9, 'low-density-structure': 10,
    'flying-robot-frame': 40 / 9, 'electric-engine-unit': 20 / 9, battery: 4 / 3,
  };
  assert.deepEqual(Object.keys(r.idealMachines).sort(), Object.keys(expected).sort());
  for (const [name, count] of Object.entries(expected)) {
    close(r.idealMachines[name], count);
    const m = r.machines[name];
    assert.equal(m.machine, name === 'battery' ? 'chemical-plant' : 'assembling-machine-2');
    assert.equal(m.minimumCount, Math.ceil(count));
    assert.equal(m.recommendedCount, Math.ceil(count * 1.2));
    close(count * m.craftingSpeed * 60 / m.craftSeconds * m.outputPerCraft, m.outputPerMinute);
  }
});

test('flags near-saturated copper belt and provides 20% transport and supply headroom', () => {
  const r = calculateRequirements(raw);
  assert.equal(r.headroom.copper.redBeltCapacityPerMinute, 1800);
  assert.equal(r.headroom.copper.redBeltLaneCapacityPerMinute, 900);
  assert.equal(r.headroom.copper.sparePerMinute, 5);
  close(r.headroom.copper.utilization, 1795 / 1800);
  assert.equal(r.headroom.copper.nearCapacity, true);
  assert.equal(r.headroom.copper.exceedsCapacity, false);
  assert.equal(r.headroom.copper.recommendedCapacityPerMinute, 2154);
  assert.equal(r.headroom.copper.recommendedRedBelts, 2);
  for (const [name, rate] of Object.entries(expectedExternal)) close(r.recommendedExternalPerMinute[name], rate * 1.2);
  assert.match(r.headroom.recommendations.join(' '), /balanced lanes/);
  const double = calculateRequirements(raw, Object.fromEntries(Object.keys(DEFAULT_TARGETS).map(n => [n, 60])));
  assert.equal(double.headroom.copper.exceedsCapacity, true);
  assert.equal(double.headroom.copper.sparePerMinute, -1790);
});

test('base lab capacity depends on research unit duration and all four supply rates', () => {
  const { baseLabCapacity: lab } = calculateRequirements(raw);
  assert.equal(lab.researchingSpeed, 1);
  assert.equal(lab.setsPerMinute, 30);
  assert.equal(lab.labsPerResearchUnitSecond, 0.5);
  assert.equal(lab.labsFor30SecondResearch, 15);
  assert.equal(lab.labsFor60SecondResearch, 30);
  assert.match(lab.formula, /researchUnitSeconds/);
  const unequal = calculateRequirements(raw, { ...DEFAULT_TARGETS, 'utility-science-pack': 15 });
  assert.equal(unequal.baseLabCapacity.labsFor60SecondResearch, 15);
});

test('custom targets, zero targets and independent linear scaling are supported without mutation', () => {
  const before = JSON.stringify(raw.recipe['transport-belt']);
  const totals = Object.fromEntries(EXTERNAL_INPUTS.map(n => [n, 0]));
  for (const name of Object.keys(DEFAULT_TARGETS)) {
    const r = calculateRequirements(raw, { [name]: 30 });
    for (const input of EXTERNAL_INPUTS) totals[input] += r.externalPerMinute[input];
    assert.equal(r.finalOutputsPerMinute[name], 30);
  }
  assert.deepEqual(totals, expectedExternal);
  const half = calculateRequirements(raw, Object.fromEntries(Object.keys(DEFAULT_TARGETS).map(n => [n, 15])));
  for (const n of EXTERNAL_INPUTS) close(half.externalPerMinute[n], expectedExternal[n] / 2);
  const zero = calculateRequirements(raw, {});
  assert.deepEqual(zero.craftsPerMinute, {});
  assert.equal(zero.baseLabCapacity.setsPerMinute, 0);
  assert.equal(zero.headroom.copper.nearCapacity, false);
  assert.equal(JSON.stringify(raw.recipe['transport-belt']), before);
});

// Isolate the needed prototypes for negative/mutation tests, avoiding dump-sized copies.
function fixture() {
  return structuredClone({ recipe: Object.fromEntries(Object.keys(expectedCrafts).map(n => [n, raw.recipe[n]])),
    'assembling-machine': Object.fromEntries(['assembling-machine-2', 'chemical-plant'].map(n => [n, {
      crafting_speed: raw['assembling-machine'][n].crafting_speed,
      crafting_categories: raw['assembling-machine'][n].crafting_categories,
    }])),
    'transport-belt': { 'fast-transport-belt': { speed: 0.0625 } },
    lab: { lab: { researching_speed: 1, inputs: Object.keys(DEFAULT_TARGETS) } },
  });
}

test('reads altered recipe amounts, durations, machine speeds and belt speeds from raw', () => {
  const f = fixture();
  f.recipe['low-density-structure'].ingredients.find(i => i.name === 'copper-plate').amount = 21;
  f.recipe['utility-science-pack'].energy_required = 42;
  f['assembling-machine']['assembling-machine-2'].crafting_speed = 1.5;
  f['assembling-machine']['chemical-plant'].crafting_speed = 2;
  f['transport-belt']['fast-transport-belt'].speed = 0.125;
  const r = calculateRequirements(f);
  assert.equal(r.externalPerMinute['copper-plate'], 1825);
  close(r.idealMachines['utility-science-pack'], 14 / 3);
  close(r.idealMachines.battery, 2 / 3);
  assert.equal(r.headroom.copper.redBeltCapacityPerMinute, 3600);
});

test('rejects invalid targets and incomplete or unsupported internal chains', () => {
  for (const rate of [-1, NaN, Infinity, '30', null]) {
    assert.throws(() => calculateRequirements(raw, { 'automation-science-pack': rate }), /Invalid target/);
  }
  assert.throws(() => calculateRequirements(raw, { 'processing-unit': 30 }), /Unsupported science/);
  assert.throws(() => calculateRequirements(raw, null), /target map/);
  assert.throws(() => calculateRequirements({}, {}), /data.raw/);
  const missing = fixture();
  delete missing.recipe['processing-unit'];
  assert.throws(() => calculateRequirements(missing), /Missing internal recipe: processing-unit/);
  const cycle = fixture();
  cycle.recipe['copper-cable'].ingredients = [{ name: 'electronic-circuit', amount: 1 }];
  assert.throws(() => calculateRequirements(cycle), /Recipe cycle/);
  const unsupported = fixture();
  unsupported['assembling-machine']['assembling-machine-2'].crafting_categories = [];
  assert.throws(() => calculateRequirements(unsupported), /No permitted machine/);
  for (const change of [
    f => { f.recipe.battery.results[0].probability = 0.5; },
    f => { f.recipe.battery.results.push({ name: 'water', amount: 1 }); },
    f => { f.recipe.battery.energy_required = 0; },
    f => { f.recipe.battery.ingredients[0].amount = -1; },
  ]) {
    const f = fixture(); change(f);
    assert.throws(() => calculateRequirements(f));
  }
});
