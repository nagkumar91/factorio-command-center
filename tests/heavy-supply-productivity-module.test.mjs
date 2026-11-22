import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {findProfile,recipePlan} from '../scripts/flight-science-sided/heavy-supplies/electric-furnace-supply/supply-kit.mjs';

// productivity-module-supply: 20 productivity modules (tier 1)/min for the compact six-pack tier's south entrance.
const id = 'productivity-module-supply', product = 'productivity-module';
const expected = {target: 20, width: 25, height: 7, counts: {'productivity-module': 7}, inputs: {'advanced-circuit': 100, 'electronic-circuit': 100}};

const dir = new URL(`../blueprint-sources/flight-science-sided/heavy-supplies/${id}/`, import.meta.url);
const harness = new URL('../scripts/flight-science-sided/heavy-supplies/electric-furnace-supply/control.lua', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const [m] = JSON.parse(fs.readFileSync(new URL('manifest.json', dir)));
const code = fs.readFileSync(new URL(m.file, dir), 'utf8').trim();
const bp = decodeBlueprint(code).blueprint;
const allowed = new Set(['assembling-machine-2', 'fast-transport-belt', 'fast-underground-belt', 'fast-inserter', 'steel-chest', 'display-panel', 'big-electric-pole', 'medium-electric-pole']);

test(`${id}: string, footprint, machines and inlet figures`, () => {
  assert.equal(sha(code), m.blueprintSha256);
  assert.equal(m.targetPerMinute, expected.target);
  assert.deepEqual(m.products, [product]);
  assert.equal(m.footprint.width, expected.width);
  assert.equal(m.footprint.height, expected.height);
  assert.deepEqual(m.machineCounts, expected.counts);
  assert.deepEqual(Object.fromEntries(m.inputs.map(i => [i.item, i.perMinute])), expected.inputs);
  assert.equal(m.prototypeSha256, '33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f');
});

test(`${id}: family conventions (AM2, fast inserters, red belts, no modules, one west inlet per material, east chest, panels, power port)`, () => {
  for (const e of bp.entities) assert(allowed.has(e.name), e.name);
  for (const e of bp.entities.filter(e => e.name === 'assembling-machine-2')) { assert.equal(e.recipe, product); assert(!e.items); }
  for (const e of bp.entities.filter(e => e.name === 'fast-inserter')) assert.equal(e.override_stack_size, 1);
  const inputs = m.ports.filter(p => p.kind === 'input'), outputs = m.ports.filter(p => p.kind === 'output'), power = m.ports.filter(p => p.kind === 'power');
  assert.equal(new Set(inputs.map(p => p.items[0])).size, inputs.length);
  assert(inputs.every(p => p.externalSide === 'west' && p.direction === 4 && p.x === m.footprint.left + .5));
  assert.equal(outputs.length, 1);
  assert(outputs[0].externalSide === 'east' && outputs[0].x === m.footprint.right - .5);
  const byId = new Map(bp.entities.map(e => [e.entity_number, e]));
  assert.equal(byId.get(outputs[0].entity).name, 'steel-chest');
  assert.equal(power.length, 1);
  assert.equal(byId.get(power[0].entity).name, 'big-electric-pole');
  for (const p of [...inputs, ...outputs]) {
    const panel = byId.get(p.displayEntity);
    assert.equal(panel.name, 'display-panel');
    assert.equal(panel.text, `${p.kind}: ${p.label} ${p.perMinute}/min`);
  }
  // The outlet inserter only passes the product.
  const chest = byId.get(outputs[0].entity);
  const arm = bp.entities.find(e => e.name === 'fast-inserter' && Math.abs(e.position.x - chest.position.x) + Math.abs(e.position.y - chest.position.y) === 1 && e.use_filters);
  assert.deepEqual(arm.filters.map(f => f.name), [product]);
  assert.deepEqual(m.loopControl, []);
});

test(`${id}: exact-hash native qualification at the panel figures and at 80%`, () => {
  const report = JSON.parse(fs.readFileSync(new URL('native-report.json', dir)));
  assert.equal(m.status, 'native-verified');
  assert(report.passed && report.short === false);
  assert.equal(report.harnessSha256, sha(fs.readFileSync(harness)));
  assert.equal(report.prototypeSha256, m.prototypeSha256);
  assert.deepEqual(report.protocol, {warmupMinutes: 15, measurementMinutes: 30, blockedMinutes: 5, settlingMinutes: 2, recoveryMinutes: 3});
  const [full] = report.builds, [reduced] = report.reducedFeed.builds;
  for (const [r, scale] of [[full, 1], [reduced, .8]]) {
    assert.equal(r.blueprintSha256, m.blueprintSha256);
    assert.equal(r.feedScale, scale);
    assert(r.passed && Object.values(r.checks).every(Boolean));
    assert(r.outputsPerMinute[product] >= .95 * scale * m.targetPerMinute);
    assert(r.recovery.outputsPerMinute[product] >= .95 * scale * m.targetPerMinute);
    assert.deepEqual(r.foreignAtOutlet, {});
  }
  assert(full.checks.everyAssemblerCrafted && full.machines.every(x => x.measuredCrafts > 0));
  for (const p of full.inputs) assert.equal(p.offeredPerMinute, expected.inputs[p.item]);
});

test(`${id}: recipe arithmetic from the flight-save prototype data`, async t => {
  const profile = await findProfile();
  if (!profile) return t.skip('flight-save prototype dump not available');
  const plan = recipePlan(profile.raw, product, expected.target);
  assert.deepEqual(plan, m.recipePlan);
  assert.deepEqual(Object.fromEntries(plan.inputs.map(i => [i.item, i.perMinute])), expected.inputs);
  assert.equal(plan.machines, expected.counts[product]);
});
