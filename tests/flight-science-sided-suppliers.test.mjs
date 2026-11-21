import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

// The three supply factories after the 2026-11-21 review. The red-circuit and
// engine factories replaced larger versions that are kept under history/.
const dir = new URL('../blueprint-sources/flight-science-sided/', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const manifests = JSON.parse(fs.readFileSync(new URL('manifest.json', dir)));
const report = JSON.parse(fs.readFileSync(new URL('native-report.json', dir)));
const byId = Object.fromEntries(manifests.map(m => [m.id, m]));
const expected = {
  'green-circuit-supply': {width: 16, height: 5, counts: {'copper-cable': 1, 'electronic-circuit': 1}},
  'advanced-circuit-supply': {width: 49, height: 16, counts: {'copper-cable': 6, 'electronic-circuit': 2, 'advanced-circuit': 12}},
  'engine-supply': {width: 40, height: 13, counts: {'iron-gear-wheel': 1, 'engine-unit': 14, pipe: 2}},
};
const portSignature = m => ({
  inputs: m.inputs.map(p => p.item),
  inputSides: m.ports.filter(p => p.kind === 'input').map(p => p.externalSide),
  outputs: m.outputs.map(p => p.item),
  outputSides: m.ports.filter(p => p.kind === 'output').map(p => p.externalSide),
  rates: [...m.inputs, ...m.outputs].map(p => p.perMinute),
});

for (const [id, want] of Object.entries(expected)) test(`${id}: size, assemblers and exact-hash qualification`, () => {
  const m = byId[id];
  assert(m, id);
  assert.equal(m.footprint.width, want.width);
  assert.equal(m.footprint.height, want.height);
  assert.deepEqual(m.machineCounts, want.counts);
  const code = fs.readFileSync(new URL(m.file, dir), 'utf8').trim();
  assert.equal(sha(code), m.blueprintSha256);
  assert.equal(m.status, 'native-verified');
  const machines = decodeBlueprint(code).blueprint.entities.filter(e => e.name === 'assembling-machine-2');
  assert.equal(machines.length, Object.values(want.counts).reduce((a, b) => a + b, 0));
  const proof = report.builds.find(b => b.id === id && b.blueprintSha256 === m.blueprintSha256);
  assert(proof?.passed && report.short === false && report.warmupMinutes === 15 && report.measurementMinutes === 30);
  assert(m.products.every(n => proof.outputsPerMinute[n] >= m.targetPerMinute - .5 && proof.recovery.outputsPerMinute[n] >= m.targetPerMinute - .5));
});

for (const id of ['advanced-circuit-supply', 'engine-supply']) test(`${id}: previous version kept, same interface, smaller and at least as fast`, () => {
  const m = byId[id], previous = m.previousVersion;
  assert(previous?.folder && previous.blueprintSha256 && previous.reason);
  const folder = new URL(previous.folder + '/', dir);
  assert(fs.readFileSync(new URL('NOTE.md', folder), 'utf8').trim().length > 0);
  const [old] = JSON.parse(fs.readFileSync(new URL('manifest.json', folder)));
  const code = fs.readFileSync(new URL(old.file, folder), 'utf8').trim();
  assert.equal(sha(code), previous.blueprintSha256);
  assert.equal(old.blueprintSha256, previous.blueprintSha256);
  const oldReport = JSON.parse(fs.readFileSync(new URL('native-report.json', folder)));
  const oldProof = oldReport.builds.find(b => b.id === id && b.blueprintSha256 === previous.blueprintSha256);
  assert(oldProof?.passed);
  assert.deepEqual(portSignature(m), portSignature(old));
  assert(m.footprint.width * m.footprint.height <= .95 * old.footprint.width * old.footprint.height);
  const machines = counts => Object.values(counts).reduce((a, b) => a + b, 0);
  assert(machines(m.machineCounts) <= machines(old.machineCounts));
  const proof = report.builds.find(b => b.id === id && b.blueprintSha256 === m.blueprintSha256);
  assert(m.products.every(n => proof.outputsPerMinute[n] >= oldProof.outputsPerMinute[n]));
});
