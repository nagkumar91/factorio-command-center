import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

// Processing-unit supply factory (flight-science-sided heavy supplies, 40/min for the Compact tier's south
// entrance). The checks on the committed files run everywhere; regeneration needs the family's 2.1.24 flight-save
// prototype dump and skips without it.
const dir = new URL('../blueprint-sources/flight-science-sided/heavy-supplies/processing-unit-supply/', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const [m] = JSON.parse(fs.readFileSync(new URL('manifest.json', dir)));
const code = fs.readFileSync(new URL(m.file, dir), 'utf8').trim();
const bp = decodeBlueprint(code).blueprint;
const report = JSON.parse(fs.readFileSync(new URL('native-report.json', dir)));
const proof = report.builds.find(b => b.id === m.id && b.blueprintSha256 === m.blueprintSha256);
const family = JSON.parse(fs.readFileSync(new URL('../blueprint-sources/flight-science-sided/catalog-manifest.json', import.meta.url)));
const byNumber = new Map(bp.entities.map(e => [e.entity_number, e]));

test('processing-unit-supply: exact-hash full native qualification at the panel figures', () => {
  assert.equal(sha(code), m.blueprintSha256);
  assert.equal(m.status, 'native-verified');
  assert(proof?.passed && report.passed);
  assert.equal(report.short, false);
  assert.equal(report.prototypeSha256, m.prototypeSha256);
  assert.equal(m.prototypeSha256, family.currentPrototypeSha256);
  assert.equal(report.harnessSha256, sha(fs.readFileSync(new URL('../scripts/flight-science-sided/heavy-supplies/processing-unit-supply/control.lua', import.meta.url))));
  assert.equal(report.feedScale, 1);
  assert.deepEqual(report.protocolMinutes, {warmupMinutes: 15, measureMinutes: 30, blockedMinutes: 5, settleMinutes: 2, recoveryMinutes: 3});
  assert.equal(m.targetPerMinute, 40);
  assert(proof.outputsPerMinute['processing-unit'] >= 38 && proof.recovery.outputsPerMinute['processing-unit'] >= 38);
  assert.equal(proof.machines.length, 9);
  assert(proof.machines.every(x => x.measuredCrafts > 0));
  assert.deepEqual(proof.wrongItemsAtOutlet, {});
  assert.equal(proof.fluids.length, 1);
  assert.equal(proof.fluids[0].productiveConsumers.length, 9);
  for (const p of [...proof.inputs, ...proof.fluids]) assert(Math.abs(p.acceptedPerMinute - p.perMinute) <= p.perMinute * .01, p.item);
});

test('processing-unit-supply: family conventions (tiers, west inlets with panels, east chest, power port)', () => {
  const allowed = new Set(['assembling-machine-2', 'fast-inserter', 'fast-transport-belt', 'pipe', 'pipe-to-ground', 'steel-chest', 'display-panel', 'medium-electric-pole', 'big-electric-pole']);
  assert(bp.entities.every(e => allowed.has(e.name)), 'entity tiers');
  const machines = bp.entities.filter(e => e.name === 'assembling-machine-2');
  assert.equal(machines.length, 9);
  assert(machines.every(e => e.recipe === 'processing-unit' && !e.items));
  assert(bp.entities.filter(e => e.name === 'fast-inserter').every(e => e.override_stack_size === 1));
  assert.deepEqual(m.machineCounts, {'processing-unit': 9});
  assert.deepEqual(m.inputs.map(p => [p.item, p.perMinute]), [['advanced-circuit', 80], ['electronic-circuit', 800]]);
  assert.deepEqual(m.fluids.map(p => [p.item, p.perMinute]), [['sulfuric-acid', 200]]);
  const left = m.footprint.left, right = m.footprint.right;
  for (const p of m.ports.filter(p => p.kind === 'input' || p.kind === 'fluid')) {
    assert.equal(p.externalSide, 'west');
    assert.equal(p.x, left + .5, p.label);
    const panel = byNumber.get(p.displayEntity);
    assert(panel?.name === 'display-panel' && panel.text.includes(p.items[0]) && panel.text.includes(String(p.perMinute)), p.label);
  }
  const [out] = m.ports.filter(p => p.kind === 'output');
  assert.equal(byNumber.get(out.entity).name, 'steel-chest');
  assert.equal(out.x, right - .5);
  assert.equal(m.ports.filter(p => p.kind === 'output').length, 1);
  assert.equal(byNumber.get(m.ports.find(p => p.kind === 'power').entity).name, 'big-electric-pole');
  assert.deepEqual(m.loopControl, []);
  assert.equal(m.footprint.width * m.footprint.height, 36 * 7);
});

const dump = ['../.cache/heavy-supplies/flight-21/script-output/data-raw-dump.json', '../.cache/flight-21/script-output/data-raw-dump.json'].map(p => new URL(p, import.meta.url)).find(u => fs.existsSync(u));
test('processing-unit-supply: regenerates the committed blueprint from the prototype dump', {skip: dump ? false : 'family prototype dump not present'}, async () => {
  if (!process.env.FLIGHT_RAW) process.env.FLIGHT_RAW = dump.pathname;
  const {build} = await import('../scripts/flight-science-sided/heavy-supplies/processing-unit-supply/generate.mjs');
  const r = await build('one-row');
  assert.equal(JSON.stringify({blueprint: r.bp}), JSON.stringify(decodeBlueprint(code)));
  assert.deepEqual(r.perMinute, {'electronic-circuit': 800, 'advanced-circuit': 80, 'sulfuric-acid': 200});
  assert.equal(r.machines, 9);
});
