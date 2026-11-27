// Plastic v2 supply for Vulcanus (blueprint-sources/vulcanus-supplies/plastic-v2): plastic bars on one belt exit and nothing else, from crude oil
// barrels, water barrels and coal. Needs only the pinned data beside the generators and the committed files; no game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, published, prototypes, fluidSlots, memberPins, readJson, encode, encodeKeeping, decode, sha, envelope, analyzeFluids, portRules } from '../scripts/vulcanus-supplies/lib.mjs';
import { auditBlueprint } from '../scripts/vulcanus-supplies/audit.mjs';
import { summarize } from '../scripts/vulcanus-supplies/summary.mjs';
import { design, sizing, TARGETS, ID } from '../scripts/vulcanus-supplies/plastic-v2/design.mjs';
import { readme } from '../scripts/vulcanus-supplies/plastic-v2/readme.mjs';
import { scenarios, FLOOR_SHARE } from '../scripts/vulcanus-supplies/plastic-v2/scenario.mjs';

const [p, slots, family] = await Promise.all([prototypes(ID), fluidSlots(ID), prototypes()]);
const prototypeSha256 = sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256 = sha(await fs.readFile(path.join(HERE, 'fluid-slots.json')));
const dir = published(ID);
const m = await readJson(path.join(dir, 'manifest.json'));
const code = (await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code), es = bp.blueprint.entities;
const report = await readJson(path.join(dir, 'native-report.json')).catch(() => null);
const status = await readJson(path.join(dir, 'native-status.json')).catch(() => null);

test('plastic-v2: the family pins are unchanged; the member pins add the advanced oil, barrel and chest data from the same dump', () => {
  for (const g of ['recipes', 'entities', 'items', 'fluids']) for (const [k, v] of Object.entries(family[g])) assert.deepEqual(p[g][k], v, `${g}.${k}`);
  for (const r of ['advanced-oil-processing', 'empty-crude-oil-barrel', 'empty-water-barrel']) assert.ok(p.recipes[r] && !family.recipes[r], r);
  assert.deepEqual(p.recipes['empty-crude-oil-barrel'].ingredients.map(v => [v.name, v.amount]), [['crude-oil-barrel', 1]]);
  assert.deepEqual(p.recipes['empty-crude-oil-barrel'].results.map(v => [v.name, v.amount]), [['crude-oil', 50], ['barrel', 1]]);
  assert.deepEqual(p.recipes['empty-water-barrel'].results.map(v => [v.name, v.amount]), [['water', 50], ['barrel', 1]]);
  assert.equal(p.recipes['empty-crude-oil-barrel'].energy_required, 0.2);
  assert.deepEqual(p.recipes['advanced-oil-processing'].results.map(v => [v.name, v.amount]), [['heavy-oil', 25], ['light-oil', 45], ['petroleum-gas', 55]]);
  assert.deepEqual(p.recipes['advanced-oil-processing'].ingredients.map(v => [v.name, v.amount]).sort(), [['crude-oil', 100], ['water', 50]]);
  assert.equal(p.entities['assembling-machine-3'].crafting_speed, 1.25);
  assert.ok(p.entities['assembling-machine-3'].crafting_categories.includes('crafting-with-fluid'));
});

test('plastic-v2: the recipes give 97.5 petroleum gas a refinery craft, one refinery tops out at 116.9 plastic a minute, and the barrel figures follow', () => {
  const z = sizing(p, 60);
  assert.equal(z.gasPerAopTotal, 97.5);
  assert.deepEqual(z.machinesNeeded, { 'plastic-bar': 1, 'advanced-oil-processing': 1, 'heavy-oil-cracking': 1, 'light-oil-cracking': 1, 'empty-crude-oil-barrel': 1, 'empty-water-barrel': 1 });
  assert.ok(Math.abs(z.requiredCraftsPerMinute['advanced-oil-processing'] - 600 / 97.5) < 1e-9);
  assert.ok(Math.abs(z.perMinute['crude-oil-barrel'] - 600 / 97.5 * 2) < 1e-9, 'a barrel is 50 of the refinery craft\'s 100 crude');
  assert.equal(Math.round(sizing(p, 60).maxPlasticPerMinute * 10) / 10, 117);
  const zt = sizing(p, TARGETS['plastic-bar']);
  assert.ok(zt.maxPlasticPerMinute >= TARGETS['plastic-bar']);
  assert.deepEqual(zt.machinesNeeded, z.machinesNeeded, 'the same six machines carry the chosen target');
  assert.deepEqual(sizing(p, 120).machinesNeeded, { 'plastic-bar': 1, 'advanced-oil-processing': 2, 'heavy-oil-cracking': 1, 'light-oil-cracking': 1, 'empty-crude-oil-barrel': 1, 'empty-water-barrel': 1 });
  assert.deepEqual(sizing(p, 240).machinesNeeded, { 'plastic-bar': 2, 'advanced-oil-processing': 3, 'heavy-oil-cracking': 1, 'light-oil-cracking': 2, 'empty-crude-oil-barrel': 1, 'empty-water-barrel': 1 });
  assert.deepEqual(m.inputPorts.map(x => x.item), ['crude-oil-barrel', 'water-barrel', 'coal']);
  assert.deepEqual(m.outputPorts.map(x => [x.item, x.perMinute]), [['plastic-bar', TARGETS['plastic-bar']]]);
  assert.ok(m.inputPorts.every(x => x.kind === 'belt' && x.side === 'west'), 'no pipe entrance: the water is barrels too');
  for (const x of m.inputPorts) assert.ok(x.perMinute >= zt.perMinute[x.item] - 1e-9 && x.perMinute <= zt.perMinute[x.item] + 0.5 + 1e-9, x.item);
});

test('plastic-v2: plastic bars are the only product and the only belt output; the empty barrels stay in one chest; fluids stay inside', () => {
  assert.deepEqual(m.products, ['plastic-bar']);
  assert.equal(m.outputPorts.length, 1);
  assert.equal(m.outputPorts[0].kind, 'belt');
  assert.deepEqual(m.machines.map(x => x.recipe), ['advanced-oil-processing', 'heavy-oil-cracking', 'plastic-bar', 'empty-crude-oil-barrel', 'light-oil-cracking', 'empty-water-barrel']);
  assert.ok(!/lubricant|coal-liquefaction|calcite|sulfuric/i.test(JSON.stringify({ ...m, measured: undefined, technologyClosure: undefined })), 'no lubricant, liquefaction or acid');
  assert.equal(m.collectors.length, 1);
  assert.equal(m.collectors[0].item, 'barrel');
  assert.equal(es.filter(e => e.name === 'passive-provider-chest').length, 1);
  // every fluid network is one fluid and every machine fluid box is connected; no pipe entrance or exit exists
  const fluid = analyzeFluids(es, slots);
  assert.deepEqual(fluid.problems, []);
  assert.deepEqual(fluid.components.map(c => c.fluids), [['water'], ['crude-oil'], ['heavy-oil'], ['light-oil'], ['petroleum-gas']]);
  assert.ok(es.every(e => !/stack-inserter|bulk-inserter|beacon|foundry|requester|storage-tank|pump/.test(e.name)) && es.every(e => !e.items));
  // the arms: crude and water barrels in, empties to the one chest, coal in, plastic out
  assert.equal(es.filter(e => /inserter/.test(e.name)).length, 6);
  assert.equal(m.routes.length, 6);
});

test('plastic-v2: passes the static audit, port rules included', () => {
  const audit = auditBlueprint(bp, m, p, slots);
  assert.equal(audit.passed, true, JSON.stringify(audit.errors));
  const rules = portRules(es, slots);
  assert.deepEqual([rules.wrong, rules.unconnected, rules.faced], [[], [], []]);
  assert.equal(rules.unused.length, 3, 'the plastic plant and the two barrel assemblers have unused ports; the refinery and crackers use every port');
});

test('plastic-v2: string, manifest and pinned data identify the same exact blueprint; the generator reproduces it', async () => {
  assert.equal(sha(code), m.candidateSha256);
  assert.equal(m.prototypeSha256, prototypeSha256);
  assert.equal(m.fluidSlotsSha256, fluidSlotsSha256);
  const pins = await memberPins(ID);
  assert.deepEqual(Object.keys(pins).sort(), ['memberFluidSlotsSha256', 'memberPrototypeSha256']);
  assert.deepEqual(pins, { memberPrototypeSha256: m.memberPrototypeSha256, memberFluidSlotsSha256: m.memberFluidSlotsSha256 });
  assert.equal(JSON.stringify(decode(encode(bp))), JSON.stringify(bp));
  assert.equal(encodeKeeping(bp, code), code);
  const d = design(p, slots, { prototypeSha256, fluidSlotsSha256, ...pins, committedCode: code + '\n' });
  assert.equal(d.code, code); assert.equal(d.hash, m.candidateSha256);
  const { measured, outputsPerMinute, inputsPerMinute, ...rest } = m;
  assert.deepEqual(JSON.parse(JSON.stringify(d.manifest)), rest);
  const env = envelope(es, p);
  assert.deepEqual([env.width, env.height, env.area], [10, 18, 180]);
  assert.deepEqual([m.footprint.width, m.footprint.height, m.footprint.area], [10, 18, 180]);
  const text = await fs.readFile(path.join(dir, 'README.md'), 'utf8');
  assert.ok(text.includes(m.candidateSha256));
  const proven = report && report.passed && report.blueprintSha256 === m.candidateSha256 ? report : null;
  assert.equal(text, readme(d, auditBlueprint(d.blueprint, d.manifest, p, slots), proven, p, report));
});

test('plastic-v2: the native report, if present, is for exactly this string and passed every scenario at the 95% floor', t => {
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
    for (const ph of run.phases) { assert.equal(ph.mixedSeconds, 0, `${mode}/${ph.name} held a foreign fluid`); assert.equal(Object.keys(ph.foreign).length, 0, 'an empty Lua table is written as {}'); }
  }
  assert.equal(FLOOR_SHARE, 0.95);
  assert.ok(report.measured.steady.throttled.outputsPerMinute['plastic-bar'] >= TARGETS['plastic-bar'] * 0.95);
  assert.deepEqual(m.measured, report.measured);
  assert.equal(JSON.stringify(summarize(report, m)), JSON.stringify(report.measured));
});

test('plastic-v2: the existing plastic-only and coal-plastic-lubricant folders are untouched', async t => {
  const { execFileSync } = await import('node:child_process');
  let out;
  try { out = execFileSync('git', ['status', '--porcelain', '--', 'blueprint-sources/vulcanus-supplies/plastic-only', 'blueprint-sources/vulcanus-supplies/coal-plastic-lubricant', 'scripts/vulcanus-supplies/plastic-only', 'scripts/vulcanus-supplies/coal-plastic-lubricant'], { encoding: 'utf8' }); } catch { return t.skip('no git'); }
  assert.equal(out.trim(), '');
});
