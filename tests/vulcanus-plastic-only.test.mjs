// Plastic-only supply for Vulcanus (blueprint-sources/vulcanus-supplies/plastic-only): plastic bars on one belt exit and nothing else.
// Needs only the pinned data beside the generators and the committed files; no game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, published, prototypes, fluidSlots, memberPins, readJson, encode, encodeKeeping, decode, sha, envelope, analyzeFluids, portRules } from '../scripts/vulcanus-supplies/lib.mjs';
import { auditBlueprint } from '../scripts/vulcanus-supplies/audit.mjs';
import { summarize } from '../scripts/vulcanus-supplies/summary.mjs';
import { design, sizing, TARGETS, ID } from '../scripts/vulcanus-supplies/plastic-only/design.mjs';
import { readme } from '../scripts/vulcanus-supplies/plastic-only/readme.mjs';
import { scenarios, FLOOR_SHARE } from '../scripts/vulcanus-supplies/plastic-only/scenario.mjs';

const [p, slots, family] = await Promise.all([prototypes(ID), fluidSlots(ID), prototypes()]);
const prototypeSha256 = sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256 = sha(await fs.readFile(path.join(HERE, 'fluid-slots.json')));
const dir = published(ID);
const m = await readJson(path.join(dir, 'manifest.json'));
const code = (await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code), es = bp.blueprint.entities;
const report = await readJson(path.join(dir, 'native-report.json')).catch(() => null);
const status = await readJson(path.join(dir, 'native-status.json')).catch(() => null);

test('plastic-only: the family pins are unchanged and the recipes give one plastic plant at 30 crafts a minute', () => {
  for (const g of ['recipes', 'entities', 'items', 'fluids']) assert.deepEqual(p[g], family[g]);
  const amounts = r => Object.fromEntries([...p.recipes[r].ingredients.map(v => [v.name, -v.amount]), ...p.recipes[r].results.map(v => [v.name, v.amount])]);
  assert.deepEqual(amounts('plastic-bar'), { coal: -1, 'petroleum-gas': -20, 'plastic-bar': 2 });
  assert.equal(p.recipes['plastic-bar'].energy_required, 1);
  const z = sizing(p);
  assert.deepEqual(z.requiredCraftsPerMinute, { 'plastic-bar': 30 });
  assert.deepEqual(z.machinesNeeded, { 'plastic-bar': 1 });
  assert.deepEqual(z.perMinute, { coal: 30, 'petroleum-gas': 600 });
  // the on-site gas arithmetic quoted in the README: 2 refineries, 1 heavy cracker, 1 light cracker
  assert.deepEqual(z.onSite.machines, { 'oil-refinery': 2, 'heavy-oil-cracking': 1, 'light-oil-cracking': 1 });
  assert.deepEqual(z.onSite.perMinute, { coal: 270, calcite: 48, 'sulfuric-acid': 600, water: 1800 });
  assert.deepEqual(m.inputPorts.map(x => [x.item, x.perMinute]), [['coal', 30], ['petroleum-gas', 600]]);
  assert.deepEqual(m.outputPorts.map(x => [x.item, x.perMinute]), [['plastic-bar', 60]]);
});

test('plastic-only: the only product, recipe and machine is plastic; no lubricant anywhere', () => {
  assert.deepEqual(m.products, ['plastic-bar']);
  assert.deepEqual(m.machines.map(x => x.recipe), ['plastic-bar']);
  assert.equal(m.outputPorts.length, 1);
  assert.equal(m.outputPorts[0].kind, 'belt');
  assert.ok(!/lubricant/i.test(JSON.stringify(bp)), 'no lubricant in the string');
  assert.ok(!/lubricant/i.test(JSON.stringify({ ...m, measured: undefined, technologyClosure: undefined })), 'no lubricant in the manifest');
  assert.ok(es.filter(e => e.recipe).every(e => e.recipe === 'plastic-bar'));
  assert.equal(es.filter(e => e.name === 'pipe' || e.name === 'pipe-to-ground').length, 1);
  assert.deepEqual(analyzeFluids(es, slots).components.map(c => c.fluids), [['petroleum-gas']]);
  assert.ok(es.every(e => !/oil-refinery|stack-inserter|bulk-inserter|beacon|foundry/.test(e.name)) && es.every(e => !e.items));
});

test('plastic-only: passes the static audit, port rules included', () => {
  const audit = auditBlueprint(bp, m, p, slots);
  assert.equal(audit.passed, true, JSON.stringify(audit.errors));
  const rules = portRules(es, slots);
  assert.deepEqual([rules.wrong, rules.unconnected, rules.faced], [[], [], []]);
  assert.equal(rules.unused[0].tiles.length, 2, 'the plant has two unused ports and both face nothing');
});

test('plastic-only: string, manifest and pinned data identify the same exact blueprint; the generator reproduces it', async () => {
  assert.equal(sha(code), m.candidateSha256);
  assert.equal(m.prototypeSha256, prototypeSha256);
  assert.equal(m.fluidSlotsSha256, fluidSlotsSha256);
  assert.deepEqual(await memberPins(ID), { memberFluidSlotsSha256: m.memberFluidSlotsSha256 });
  assert.equal(JSON.stringify(decode(encode(bp))), JSON.stringify(bp));
  assert.equal(encodeKeeping(bp, code), code);
  const d = design(p, slots, { prototypeSha256, fluidSlotsSha256, ...(await memberPins(ID)), committedCode: code + '\n' });
  assert.equal(d.code, code); assert.equal(d.hash, m.candidateSha256);
  const { measured, outputsPerMinute, inputsPerMinute, ...rest } = m;
  assert.deepEqual(JSON.parse(JSON.stringify(d.manifest)), rest);
  const env = envelope(es, p);
  assert.deepEqual([env.width, env.height, env.area], [6, 5, 30]);
  assert.deepEqual([m.footprint.width, m.footprint.height, m.footprint.area], [6, 5, 30]);
  const text = await fs.readFile(path.join(dir, 'README.md'), 'utf8');
  assert.ok(text.includes(m.candidateSha256));
  const proven = report && report.passed && report.blueprintSha256 === m.candidateSha256 ? report : null;
  assert.equal(text, readme(d, auditBlueprint(d.blueprint, d.manifest, p, slots), proven, p, report));
});

test('plastic-only: the native report, if present, is for exactly this string and passed every scenario at the 95% floor', t => {
  if (!report) return t.skip('static only: no native report');
  assert.equal(report.blueprintSha256, m.candidateSha256);
  assert.equal(report.passed, true);
  assert.equal(status.candidateSha256, m.candidateSha256);
  assert.equal(status.status, 'passed');
  const want = scenarios(m);
  assert.deepEqual(Object.keys(report.runs).sort(), Object.keys(want).sort());
  assert.equal(report.scenarioSha256, sha(JSON.stringify(Object.fromEntries(Object.keys(want).map(k => [k, want[k]])))));
  for (const [mode, run] of Object.entries(report.runs)) {
    assert.equal(run.passed, true, mode);
    assert.ok(run.checks.every(c => c.passed));
    for (const ph of run.phases) assert.equal(ph.mixedSeconds, 0, `${mode}/${ph.name} held a foreign fluid`);
  }
  assert.equal(FLOOR_SHARE, 0.95);
  assert.ok(report.measured.steady.throttled.outputsPerMinute['plastic-bar'] >= 57);
  assert.deepEqual(m.measured, report.measured);
  assert.equal(JSON.stringify(summarize(report, m)), JSON.stringify(report.measured));
});

test('plastic-only: the existing coal-plastic-lubricant folder is untouched', async t => {
  const { execFileSync } = await import('node:child_process');
  let out;
  try { out = execFileSync('git', ['status', '--porcelain', '--', 'blueprint-sources/vulcanus-supplies/coal-plastic-lubricant', 'scripts/vulcanus-supplies/coal-plastic-lubricant'], { encoding: 'utf8' }); } catch { return t.skip('no git'); }
  assert.equal(out.trim(), '');
});
