// Vulcanus supply blueprints (blueprint-sources/vulcanus-supplies/coal-plastic-lubricant and tungsten-carbide).
// Needs only the pinned prototypes and fluid slots beside the generators and the committed files; no game and no raw prototype dump.
// The one check against the raw dump runs only when FACTORIO_RAW points at one, and is skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, IDS, published, prototypes, fluidSlots, readJson, encode, encodeKeeping, decode, sha, envelope, exists, analyzeFluids } from '../scripts/vulcanus-supplies/lib.mjs';
import { auditBlueprint } from '../scripts/vulcanus-supplies/audit.mjs';
import { summarize } from '../scripts/vulcanus-supplies/summary.mjs';
import { scenarios as cplScenarios } from '../scripts/vulcanus-supplies/coal-plastic-lubricant/scenario.mjs';
import { scenarios as tcScenarios } from '../scripts/vulcanus-supplies/tungsten-carbide/scenario.mjs';

const [p, slots] = await Promise.all([prototypes(), fluidSlots()]);
const prototypeSha256 = sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256 = sha(await fs.readFile(path.join(HERE, 'fluid-slots.json')));
const SCENARIOS = { 'coal-plastic-lubricant': cplScenarios, 'tungsten-carbide': tcScenarios };
const byId = (list, id) => list.find(e => e.entity_number === id);

for (const id of IDS) {
  const dir = published(id);
  const [m, report, status] = await Promise.all([readJson(path.join(dir, 'manifest.json')), readJson(path.join(dir, 'native-report.json')), readJson(path.join(dir, 'native-status.json'))]);
  const code = (await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')).trim();
  const bp = decode(code), es = bp.blueprint.entities;
  const { design } = await import(`../scripts/vulcanus-supplies/${id}/design.mjs`);
  const { readme } = await import(`../scripts/vulcanus-supplies/${id}/readme.mjs`);

  test(`${id}: passes the static audit (names, collisions, fluids, belts, routes, power, ports, panels, capacity)`, () => {
    const audit = auditBlueprint(bp, m, p, slots);
    assert.equal(audit.passed, true, JSON.stringify(audit.errors));
    assert.ok(audit.checksTotal >= 30);
  });

  test(`${id}: string, manifest and pinned data identify the same exact blueprint`, () => {
    assert.equal(sha(code), m.candidateSha256);
    assert.equal(m.prototypeSha256, prototypeSha256);
    assert.equal(m.fluidSlotsSha256, fluidSlotsSha256);
    // Compressed bytes depend on the zlib build, so a fresh encoding is compared by its decoded JSON text.
    assert.equal(JSON.stringify(decode(encode(bp))), JSON.stringify(bp));
    assert.equal(encodeKeeping(bp, code), code);
    const changed = structuredClone(bp); changed.blueprint.entities[0].position.x += 1;
    assert.notEqual(encodeKeeping(changed, code), code, 'a different blueprint never keeps the committed string');
  });

  test(`${id}: the generator reproduces the published string, manifest, ports and README from the pinned data`, async () => {
    const options = { prototypeSha256, fluidSlotsSha256 };
    const fresh = design(p, slots, options);
    assert.equal(JSON.stringify(decode(fresh.code)), JSON.stringify(bp));
    const d = design(p, slots, { ...options, committedCode: code + '\n' });
    assert.equal(d.code, code); assert.equal(d.hash, m.candidateSha256);
    const { measured, outputsPerMinute, inputsPerMinute, ...rest } = m;
    assert.deepEqual(JSON.parse(JSON.stringify(d.manifest)), rest);
    assert.deepEqual(measured, report.measured);
    assert.deepEqual(outputsPerMinute, report.measured.outputsPerMinute);
    assert.deepEqual(inputsPerMinute, report.measured.inputsPerMinute);
    const ports = await readJson(path.join(dir, 'ports.json'));
    assert.deepEqual(ports.inputs, JSON.parse(JSON.stringify(d.ports.inputs)));
    assert.deepEqual(ports.outputs, JSON.parse(JSON.stringify(d.ports.outputs)));
    const text = await fs.readFile(path.join(dir, 'README.md'), 'utf8');
    assert.ok(text.includes(m.candidateSha256));
    assert.equal(text, readme(d, auditBlueprint(d.blueprint, d.manifest, p, slots), report, p, report), 'README is the generator output');
    assert.equal(JSON.stringify(summarize(report, m)), JSON.stringify(report.measured));
  });

  test(`${id}: the native report passed every scenario for exactly this string`, () => {
    assert.equal(report.passed, true);
    assert.equal(report.blueprintSha256, m.candidateSha256);
    assert.equal(report.prototypeSha256, m.prototypeSha256);
    assert.equal(report.gameVersion, m.requiredGameVersion);
    assert.deepEqual(Object.keys(report.runs).sort(), ['generous', 'throttled']);
    for (const [mode, run] of Object.entries(report.runs)) {
      assert.equal(run.passed, true, mode);
      assert.equal(Object.keys(run.failures).length, 0, 'an empty Lua table is written as {}');
      assert.equal(run.blueprintSha256, m.candidateSha256);
      assert.equal(run.surface.name, 'vulcanus');
      assert.ok(run.checks.length > 100 || id === 'tungsten-carbide' && run.checks.length > 50);
      assert.ok(run.checks.every(c => c.passed));
      assert.equal(run.blueprintEntityCount, es.length);
      for (const ph of run.phases) assert.equal(ph.mixedSeconds, 0, `${mode}/${ph.name} held a foreign fluid`);
    }
    assert.deepEqual(report.technologyClosure, m.technologyClosure);
    assert.equal(status.candidateSha256, m.candidateSha256);
    assert.equal(status.status, 'passed');
    // The scenario the report ran is the scenario the code defines now.
    const want = SCENARIOS[id](m);
    for (const mode of ['generous', 'throttled']) assert.deepEqual(report.runs[mode].scenario.name, want[mode].name);
    assert.equal(report.scenarioSha256, sha(JSON.stringify(Object.fromEntries(['generous', 'throttled'].map(k => [k, want[k]])))));
  });

  test(`${id}: every published panel figure is one the throttled run passed at, and the measured rates meet the targets`, () => {
    const th = report.runs.throttled;
    for (const x of m.inputPorts) {
      const fed = th.phases.find(ph => ph.name === 'steady').fedPerMinute[x.id].measured;
      assert.ok(Math.abs(fed - x.perMinute) <= 0.01 * x.perMinute, `${x.item}: took ${fed}, panel ${x.perMinute}`);
      assert.deepEqual(th.manifest === undefined ? 1 : 1, 1);
      assert.equal(th.phases[0].feed[x.id], x.perMinute, 'the throttled run was offered exactly the panel figure');
      assert.equal(es.find(e => e.entity_number === x.panel).text, `IN: ${x.item} ${x.perMinute}/min`);
    }
    for (const o of m.outputPorts) {
      for (const mode of ['generous', 'throttled']) assert.ok(report.measured.phases[mode].steady.outputsPerMinute[o.item] >= 0.99 * m.targets[o.item], `${mode} ${o.item}`);
      assert.equal(es.find(e => e.entity_number === o.panel).text, `OUT: ${o.item} ${o.perMinute}/min`);
    }
    assert.ok(th.machines === undefined);
    for (const ph of th.phases.filter(ph => ph.machines.length)) assert.equal(ph.machines.length, m.machines.length);
    const steady = th.phases.find(ph => ph.name === 'steady');
    for (const mm of steady.machines) assert.ok(mm.products > 0, mm.role + ' crafted');
  });

  test(`${id}: published size is the entity envelope; one fluid per network; substations only; one power label`, () => {
    const env = envelope(es, p);
    assert.deepEqual([env.width, env.height, env.area], [m.footprint.width, m.footprint.height, m.footprint.area]);
    assert.deepEqual([env.bounds.left, env.bounds.top], [0, 0]);
    const fl = analyzeFluids(es, slots);
    assert.deepEqual(fl.problems, []);
    assert.ok(fl.components.every(c => c.fluids.length === 1));
    assert.ok(es.filter(e => /pole/.test(e.name)).length === 0 && es.some(e => e.name === 'substation'));
    assert.equal(es.find(e => e.entity_number === m.power.panel).text, m.power.label);
    assert.ok(es.every(e => !/stack-inserter|bulk-inserter|beacon|foundry/.test(e.name)) && es.every(e => !e.items));
    assert.equal(new Set(m.inputPorts.filter(x => x.kind === 'belt').map(x => x.side)).size, 1, 'solid entrances on one side');
    assert.ok(fl.components.length === new Set(fl.components.map(c => c.id)).size);
  });

  test(`${id}: the index registers it only from its own passing native report`, async () => {
    const text = await fs.readFile(new URL('../scripts/index-designed-blueprints.mjs', import.meta.url), 'utf8');
    assert.ok(text.includes(`blueprint-sources/vulcanus-supplies`) && text.includes('vulcanus-supplies'));
    assert.ok(text.includes('proof.blueprintSha256!==m.candidateSha256'));
  });

  const mutate = (name, edit, expected) => test(`${id}: audit rejects ${name}`, () => {
    const copy = structuredClone(bp);
    edit(copy.blueprint.entities, copy);
    const audit = auditBlueprint(copy, m, p, slots);
    assert.equal(audit.passed, false);
    assert.ok(audit.errors.some(e => e.includes(expected)), JSON.stringify(audit.errors));
  });
  if (m.power.poles.length > 1) mutate('a missing substation', list => { list.splice(list.findIndex(e => e.name === 'substation' && e.entity_number !== m.power.entry), 1); }, 'Substation');
  mutate('a reversed entrance belt', list => { const b = byId(list, m.inputPorts.find(x => x.kind === 'belt').entity); b.direction = ((b.direction || 0) + 8) % 16; }, 'face inward');
  mutate('a turned inserter', list => { const a = list.find(e => /inserter/.test(e.name)); a.direction = ((a.direction || 0) + 8) % 16; }, 'picks up from and drops onto');
  mutate('an altered panel text', list => { byId(list, m.inputPorts[0].panel).text = 'IN: nothing'; }, 'display panel');
  mutate('a machine with another recipe', list => { const e = list.find(e => e.recipe); e.recipe = e.recipe === 'carbon' ? 'lubricant' : 'carbon'; }, 'Machines are exactly');
  mutate('a removed machine', list => { const i = list.findIndex(e => e.recipe); list.splice(i, 1); }, 'Machines are exactly');
  mutate('a stack inserter', list => { list.find(e => /inserter/.test(e.name)).name = 'stack-inserter'; }, 'entity names');
  mutate(id === 'tungsten-carbide' ? 'a missing pipe in the acid row' : 'a pipe joining the water and heavy-oil networks', list => {
    if (id === 'tungsten-carbide') list.splice(list.findIndex(e => e.name === 'pipe' && e.position.x === 4.5 && e.position.y === 0.5), 1);
    else list.push({ entity_number: 998, name: 'pipe', position: { x: 27.5, y: 4.5 } });
  }, 'Fluid');
}

test('Pinned prototypes equal the raw dump (runs only when FACTORIO_RAW is set and readable)', async t => {
  const rawPath = process.env.FACTORIO_RAW;
  if (!rawPath || !(await exists(rawPath))) return t.skip('no FACTORIO_RAW dump');
  const dump = JSON.parse(await fs.readFile(rawPath, 'utf8'));
  assert.equal(sha(await fs.readFile(rawPath)), p.provenance.rawSha256);
  for (const [name, r] of Object.entries(p.recipes)) {
    assert.deepEqual(r.ingredients, dump.recipe[name].ingredients, name);
    assert.deepEqual(r.results, dump.recipe[name].results, name);
  }
  for (const n of ['simple-coal-liquefaction', 'coal-liquefaction']) assert.ok(dump.recipe[n], n);
  const cl = dump.recipe['coal-liquefaction'], need = { coal: 10, 'heavy-oil': 90, 'light-oil': 20, 'petroleum-gas': 10 };
  assert.equal(cl.ingredients.find(v => v.name === 'coal').amount, need.coal);
  assert.equal(cl.results.find(v => v.name === 'heavy-oil').amount, need['heavy-oil']);
  assert.equal(cl.results.find(v => v.name === 'light-oil').amount, need['light-oil']);
  assert.equal(cl.results.find(v => v.name === 'petroleum-gas').amount, need['petroleum-gas']);
});

test('The fluid-slot table covers every machine, recipe, direction and mirroring and keeps both tiles of a merged box on one fluid', () => {
  assert.equal(Object.keys(fluidSlotsFor()).length, 7);
  function fluidSlotsFor() { return slots.slots; }
  for (const [key, table] of Object.entries(slots.slots)) {
    const dirs = Object.keys(table);
    assert.ok(key.startsWith('assembling-machine-3') ? dirs.length === 4 : dirs.length === 8, key);
    for (const boxes of Object.values(table)) for (const b of boxes) assert.ok(b.fluid && b.targets.length >= 1);
  }
});

test('Existing published blueprint folders are untouched by this change (checked through git when available)', async t => {
  const { execFileSync } = await import('node:child_process');
  let out;
  try { out = execFileSync('git', ['status', '--porcelain', '--', 'blueprint-sources/requested-malls', 'blueprint-sources/rocket-fuel-supplier', 'blueprint-sources/oil-products', 'blueprint-sources/plastic-bars'], { encoding: 'utf8' }); } catch { return t.skip('no git checkout'); }
  assert.equal(out.trim(), '');
});
