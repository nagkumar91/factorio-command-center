// The 2026-11-21 compact layouts against the versions they replaced (history/annex-below-386ecb95),
// plus the two helpers the review added: the second tunnelling pass and the qualified-status stamp.
// Reads only committed files; needs no prototype dump.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {buryPlainRuns} from '../scripts/five-science/bury.mjs';
import {qualifiedStatus} from '../scripts/five-science/status.mjs';

const dir = new URL('../blueprint-sources/five-science/', import.meta.url);
const old = new URL('history/annex-below-386ecb95/', dir);
const read = (base, file) => JSON.parse(fs.readFileSync(new URL(file, base)));
const current = read(dir, 'manifest.json'), previous = read(old, 'manifest.json');
const sha = code => createHash('sha256').update(code).digest('hex');
const sizes = {'five-science-30': [132, 92], 'five-science-30-labs-15': [141, 92], 'five-science-30-labs-30': [149, 92]};
const port = p => [p.kind, p.item ?? null, p.externalSide ?? null];

for (const m of current) test(m.id + ' is smaller than the replaced version with the same interface', () => {
  const was = previous.find(p => p.id === m.id);
  assert.ok(was, 'replaced version kept in history');
  assert.equal(sha(fs.readFileSync(new URL(was.file, old), 'utf8').trim()), was.blueprintSha256);
  assert.deepEqual([m.footprint.width, m.footprint.height], sizes[m.id]);
  assert.ok(m.footprint.width * m.footprint.height <= .95 * was.footprint.width * was.footprint.height, 'at least 5% fewer tiles');
  assert.deepEqual(m.products, was.products);
  assert.deepEqual(m.machineCounts, was.machineCounts, 'same machines and recipes');
  assert.equal(m.construction['assembling-machine-2'], was.construction['assembling-machine-2']);
  assert.equal(m.construction['chemical-plant'], was.construction['chemical-plant']);
  assert.equal(m.construction.lab ?? 0, was.construction.lab ?? 0);
  // Same entrances and exits, same sides, same order; the purple bank's six entrances are two rows higher.
  assert.deepEqual(m.ports.filter(p => p.kind !== 'power').map(port), was.ports.filter(p => p.kind !== 'power').map(port));
  for (const [a, b] of m.ports.filter(p => p.kind !== 'power').map((p, i) => [p, was.ports.filter(q => q.kind !== 'power')[i]])) {
    assert.equal(a.x, b.x);
    assert.ok(a.y === b.y || a.bank !== 'Four-pack core' && a.y === b.y - 2, a.item + ' entrance row');
  }
  assert.equal(m.status, 'native-qualified');
  if (m.researchProbe) assert.equal(m.labAnnex.side, 'east');
});

test('the replaced versions passed their own native report, and the new report is at least as good', () => {
  const was = read(old, 'native-report.json'), now = read(dir, 'native-report.json');
  for (const m of current) {
    const a = was.builds.find(b => b.id === m.id), b = now.builds.find(b => b.id === m.id && b.blueprintSha256 === m.blueprintSha256);
    assert.ok(a.passed && b.passed);
    if (m.researchProbe) assert.ok(b.researchProbe.unitsPerMinute >= 29.5 && b.researchProbe.allActive);
    else assert.ok(b.outputsPerMinute['production-science-pack'] >= a.outputsPerMinute['production-science-pack']);
  }
  for (const run of now.runs) assert.equal(run.validatorSha256, was.runs[0].validatorSha256, 'same validator');
  for (const run of now.runs) assert.equal(run.harnessSha256, was.runs[0].harnessSha256, 'same harness');
});

test('the purple finishing component report matches its revised snapshot', () => {
  const c = new URL('components/purple/', dir), [m] = read(c, 'manifest.json'), r = read(c, 'native-report.json');
  assert.equal(sha(fs.readFileSync(new URL(m.file, c), 'utf8').trim()), m.blueprintSha256);
  const b = r.builds.find(b => b.blueprintSha256 === m.blueprintSha256);
  assert.ok(r.passed && b?.passed);
  assert.ok(b.outputsPerMinute['production-science-pack'] >= 30 && b.recovery.outputsPerMinute['production-science-pack'] >= 30);
  // Iron plates enter the ring from inside: a filtered admission arm at (1.5, 1.5) dropping south.
  const e = decodeBlueprint(fs.readFileSync(new URL(m.file, c), 'utf8').trim()).blueprint.entities;
  const iron = e.filter(x => /inserter$/.test(x.name) && x.control_behavior?.circuit_enabled && x.filters?.some(f => f.name === 'iron-plate'));
  assert.equal(iron.length, 1, 'one gated iron admission arm');
  assert.deepEqual([iron[0].position, iron[0].direction], [{x: 1.5, y: 1.5}, 8]);
  // The west rail assembler's third pickup arm takes stone and iron sticks.
  assert.ok(e.some(x => x.name === 'bulk-inserter' && x.filters?.map(f => f.name).join() === 'stone,iron-stick'));
});

test('qualified status needs a passing run for the exact string', async () => {
  const path = new URL('.', dir).pathname.replace(/\/$/, '');
  for (const m of current) assert.equal(await qualifiedStatus(path, m), 'native-qualified');
  assert.equal(await qualifiedStatus(path, {...current[0], blueprintSha256: '0'.repeat(64)}), 'candidate-native-validation-pending');
  assert.equal(await qualifiedStatus(path + '/no-such-folder', current[0]), 'candidate-native-validation-pending');
});

const belt = (n, x, y, direction = 4) => ({entity_number: n, name: 'fast-transport-belt', position: {x: x + .5, y: y + .5}, direction});
test('second tunnelling pass buries only plain carriers', () => {
  // A 20-tile eastbound run; an arm picks from x=10 and a belt side-loads x=15 from the north.
  const entities = Array.from({length: 20}, (_, x) => belt(x + 1, x, 0));
  entities.push({entity_number: 30, name: 'fast-inserter', position: {x: 10.5, y: 1.5}, direction: 0});
  entities.push(belt(31, 15, -1, 8));
  const bp = {entities: structuredClone(entities), wires: []};
  const r = buryPlainRuns(bp, {keep: [1, 20]});
  assert.ok(r.pairs.length >= 1 && r.removed > 0);
  const at = x => bp.entities.find(e => Math.floor(e.position.x) === x && Math.floor(e.position.y) === 0);
  for (const x of [0, 10, 15, 19]) assert.equal(at(x)?.name, 'fast-transport-belt', 'tile ' + x + ' stays a surface belt');
  for (const p of r.pairs) {
    const a = bp.entities.find(e => e.entity_number === p.input), b = bp.entities.find(e => e.entity_number === p.output);
    assert.equal(a.type, 'input'); assert.equal(b.type, 'output');
    assert.ok(p.span >= 4 && p.span <= 7);
    assert.equal(a.direction, 4); assert.equal(b.direction, 4);
  }
  // Nothing eligible: nothing changes.
  const untouched = {entities: structuredClone(entities), wires: []};
  assert.deepEqual(buryPlainRuns(untouched, {eligible: () => false}), {pairs: [], removed: 0});
  assert.deepEqual(untouched.entities, entities);
});
