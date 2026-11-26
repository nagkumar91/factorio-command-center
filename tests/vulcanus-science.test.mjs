// Vulcanus science (production and utility packs from lava): generator, bill, static audit, fluid rules and the stored native
// report. Needs neither the game nor the raw dump: everything is read from the pinned prototypes and the published folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PUBLISHED, prototypes, fluidSlots, readJson, sha, decode } from '../scripts/vulcanus-science/production-utility-science/lib.mjs';
import { design, TARGET, GOVERNOR } from '../scripts/vulcanus-science/production-utility-science/design.mjs';
import { bill, MAKER } from '../scripts/vulcanus-science/production-utility-science/bill.mjs';
import { auditBlueprint, analyzeFluids, machinePorts, tilesOf, grid, MACHINES } from '../scripts/vulcanus-science/production-utility-science/audit.mjs';
import { PROTOCOL, FULL_LENGTH, scenarioNames, scenario, buildOrder, flipBlueprint } from '../scripts/vulcanus-science/production-utility-science/protocol.mjs';

const [p, slots] = await Promise.all([prototypes(), fluidSlots()]);
const committed = (await fs.readFile(path.join(PUBLISHED, 'blueprint.txt'), 'utf8')).trim();
const manifest = await readJson(path.join(PUBLISHED, 'manifest.json'));
const report = await readJson(path.join(PUBLISHED, 'native-report.json'));
const bp = decode(committed), es = bp.blueprint.entities;
const d = design(p, slots, { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256: sha(await fs.readFile(path.join(HERE, 'fluid-slots.json'))), committedCode: committed });

test('pinned prototypes: Factorio 2.1.25, the foundry and the recipes the build relies on', () => {
  assert.equal(p.gameVersion, '2.1.25');
  assert.equal(p.entities.foundry.crafting_speed, 4);
  assert.equal(p.entities.foundry.effect_receiver.base_effect.productivity, 0.5);
  assert.equal(p.entities['assembling-machine-3'].crafting_speed, 1.25);
  assert.deepEqual(p.recipes['production-science-pack'].ingredients.map(v => [v.name, v.amount]), [['electric-furnace', 1], ['productivity-module', 1], ['rail', 30]]);
  assert.deepEqual(p.recipes['utility-science-pack'].ingredients.map(v => [v.name, v.amount]), [['low-density-structure', 3], ['processing-unit', 2], ['flying-robot-frame', 1]]);
  assert.deepEqual(p.recipes['casting-low-density-structure'].ingredients.map(v => v.name), ['molten-iron', 'molten-copper', 'plastic-bar'], 'iron is the first fluid, copper the second');
  assert.equal(p.recipes['casting-pipe'].allow_productivity, false);
  assert.equal(p.items['production-science-pack'].stack_size * 5, 1000);
});

test('the bill: 60 packs a minute each, cast wherever a casting recipe exists, the foundry\'s +50% counted', () => {
  const b = bill(p);
  assert.equal(TARGET, 60);
  assert.deepEqual(b.outside, { lava: b.outside.lava, calcite: b.outside.calcite, 'plastic-bar': 760, 'sulfuric-acid': 1000, lubricant: 300 });
  assert.ok(Math.abs(b.outside.lava - 61511.11) < 0.01 && Math.abs(b.outside.calcite - 123.022) < 0.001);
  assert.deepEqual([Math.round(b.stone.made), b.stone.used, Math.round(b.stone.surplus)], [2244, 700, 1544]);
  assert.equal(Math.round(b.crafts['electronic-circuit']), 1560); assert.equal(Math.round(b.crafts['advanced-circuit']), 280);
  for (const [name, v] of Object.entries(b.machines)) { assert.equal(v.machine, MAKER[name]); assert.ok(manifest.machinesBuilt[name] >= v.whole, name); }
  assert.deepEqual(manifest.bill, JSON.parse(JSON.stringify(b)));
  // nothing is asked from outside that the brief did not list
  assert.deepEqual(Object.keys(b.outside).sort(), ['calcite', 'lava', 'lubricant', 'plastic-bar', 'sulfuric-acid']);
});

test('the generator reproduces the committed string and manifest', () => {
  assert.equal(d.code, committed);
  assert.equal(sha(committed), manifest.candidateSha256);
  const { nativeProtocol, ...rest } = manifest;
  assert.deepEqual(JSON.parse(JSON.stringify(d.manifest)), rest);
  assert.deepEqual(nativeProtocol, JSON.parse(JSON.stringify(PROTOCOL)));
});

test('published files agree on one SHA-256', async () => {
  const ports = await readJson(path.join(PUBLISHED, 'ports.json')), status = await readJson(path.join(PUBLISHED, 'native-status.json')), readme = await fs.readFile(path.join(PUBLISHED, 'README.md'), 'utf8');
  for (const hash of [ports.candidateSha256, report.blueprintSha256, status.candidateSha256]) assert.equal(hash, manifest.candidateSha256);
  assert.ok(readme.includes(manifest.candidateSha256));
  assert.deepEqual(await readJson(path.join(PUBLISHED, 'footprint.json')), manifest.footprint);
  for (const file of ['layout.svg', 'static-audit.json']) await fs.access(path.join(PUBLISHED, file));
});

test('counts, footprint and ports recomputed from the decoded string', () => {
  const counts = {}; for (const e of es) counts[e.name] = (counts[e.name] || 0) + 1;
  assert.deepEqual(Object.fromEntries(Object.entries(counts).sort()), manifest.footprint.counts);
  const { g, hits } = grid(es); assert.equal(hits.length, 0);
  const xs = [...g.keys()].map(k => Number(k.split(',')[0])), ys = [...g.keys()].map(k => Number(k.split(',')[1]));
  assert.deepEqual([Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1], [0, 0, manifest.footprint.width, manifest.footprint.height]);
  assert.equal(manifest.footprint.area, manifest.footprint.width * manifest.footprint.height);
  const ids = new Map(es.map(e => [e.entity_number, e]));
  assert.deepEqual(manifest.ports.map(v => [v.item, v.kind, v.side]), [['lava', 'pipe', 'west'], ['calcite', 'belt', 'west'], ['plastic-bar', 'belt', 'north'], ['sulfuric-acid', 'pipe', 'south'], ['lubricant', 'pipe', 'south'], ['stone', 'belt', 'west']]);
  for (const v of manifest.ports) {
    const e = ids.get(v.entity), pn = ids.get(v.panel);
    assert.deepEqual([Math.floor(e.position.x), Math.floor(e.position.y)], [v.tile.x, v.tile.y]);
    assert.equal(pn.text, v.label); assert.ok(pn.text.includes(`${v.perMinute}/min`));
    assert.ok(!g.has(`${v.externalContact.x},${v.externalContact.y}`), v.id + ': the tile beyond the port is free');
  }
  // machines: every one with a fixed recipe, none with a circuit connection, none beyond the allowed kinds
  const machines = es.filter(e => MACHINES.includes(e.name));
  assert.equal(machines.length, manifest.machines.length);
  for (const e of machines) { assert.ok(e.name === 'electric-furnace' ? !e.recipe : MAKER[e.recipe] === e.name, e.name + ' ' + e.recipe); assert.equal(e.control_behavior, undefined); assert.equal(e.items, undefined); }
  assert.ok(es.every(e => !/beacon|module|electromagnetic|roboport|logistic-robot|recycler|biochamber|cryogenic/.test(e.name)));
  for (const e of es) if (/inserter/.test(e.name)) assert.equal(e.override_stack_size, e.name === 'bulk-inserter' ? 2 : 1);
  // two chests, five stacks each, each with its governed arm
  assert.deepEqual(manifest.outputs.map(o => [o.item, ids.get(o.chest).name, ids.get(o.chest).bar, o.capacity]), [['production-science-pack', 'passive-provider-chest', 5, 1000], ['utility-science-pack', 'passive-provider-chest', 5, 1000]]);
  assert.equal(GOVERNOR.period, 60); assert.equal(manifest.governor.perMinute, 60);
});

test('fluid rules recomputed statically: one fluid per pipe network, every machine port on its own fluid or on nothing', () => {
  const fluid = analyzeFluids(es, slots, manifest.ports);
  assert.deepEqual(fluid.problems, []);
  assert.deepEqual([...new Set(fluid.networks.map(n => n.fluid))].sort(), ['lava', 'lubricant', 'molten-copper', 'molten-iron', 'sulfuric-acid']);
  const { g } = grid(es);
  for (const e of es) if (MACHINES.includes(e.name) && e.recipe) for (const port of machinePorts(e, slots)) {
    const o = g.get(`${port.x},${port.y}`);
    if (o && o.name === 'pipe') assert.equal(fluid.fluidOf[o.entity_number], port.fluid, `#${e.entity_number} ${e.recipe}: a pipe on its ${port.fluid} port tile carries ${fluid.fluidOf[o.entity_number]}`);
  }
  // the probe behind the model: a one-fluid foundry recipe has both input tiles on its one box; the two-fluid recipe has one tile each
  assert.deepEqual(slots.slots['foundry|casting-iron'].d0.map(b => [b.fluid, b.targets.length]), [['molten-iron', 2]]);
  assert.deepEqual(slots.slots['foundry|casting-low-density-structure'].d0.map(b => [b.fluid, b.targets]), [['molten-iron', [[-1, 3]]], ['molten-copper', [[1, 3]]]]);
  assert.equal(slots.research.bulkInserterCapacityBonus, 1);
  // flipped copies keep the rules (the game's flip rule from the same probe)
  for (const axis of ['horizontal', 'vertical']) assert.deepEqual(analyzeFluids(flipBlueprint(bp, axis, slots).blueprint.entities, slots, manifest.ports).problems, [], axis);
});

test('static audit passes for the committed string and is the stored one', async () => {
  const audit = auditBlueprint(bp, manifest, p, slots);
  assert.equal(audit.passed, true, JSON.stringify(audit.errors));
  assert.deepEqual(JSON.parse(JSON.stringify(audit)), await readJson(path.join(PUBLISHED, 'static-audit.json')));
});

test('native report: passed for exactly this string, every scenario of the protocol, rates at or above the floor, no foreign fluid', () => {
  assert.equal(report.passed, true); assert.equal(report.blueprintSha256, manifest.candidateSha256); assert.equal(report.exploration, undefined);
  assert.equal(report.gameVersion, '2.1.25'); assert.equal(report.surface, 'vulcanus');
  assert.deepEqual(Object.keys(report.scenarios), scenarioNames());
  assert.equal(scenarioNames().length, 5 + 2 + 5 + 12 + 5);
  for (const [name, s] of Object.entries(report.scenarios)) {
    assert.equal(s.passed, true, name); assert.equal(s.blueprintSha256, manifest.candidateSha256); assert.equal(s.fluidFaultCount, 0, name); assert.ok(s.fluidSweeps > 1000, name);
    assert.equal(s.fullLength, FULL_LENGTH.includes(name));
    const wanted = scenario(name, manifest);
    assert.deepEqual(s.phases.map(ph => ph.name), wanted.phases.map(ph => ph.name), name);
    for (const ph of s.phases) assert.notEqual(ph.endedBy, 'limit', `${name}: ${ph.name}`);
    const last = s.phases.at(-1);
    for (const o of manifest.outputs) if (!name.startsWith('single:') || name === 'single:' + o.item) assert.ok(last.packsPerMinute[o.item] >= PROTOCOL.passFloor, `${name}: ${o.item} ${last.packsPerMinute[o.item]}`);
    assert.equal(s.placedSha256 === manifest.candidateSha256, !name.startsWith('orient:flip-'), name + ': only the flipped placements run a derived string');
  }
  for (const mode of ['generous', 'throttled']) {
    const steady = report.scenarios[mode].phases[1];
    assert.equal(steady.minutes, 30); assert.equal(report.scenarios[mode].phases[0].minutes, 15);
    for (const o of manifest.outputs) assert.equal(report.measured.rates[mode][o.item], Math.round(steady.packsPerMinute[o.item] * 100) / 100);
  }
  // throttled: every port was offered exactly its panel figure and took no more
  const th = report.scenarios.throttled.phases[1];
  for (const v of manifest.ports.filter(v => !v.exit)) assert.ok(th.fedPerMinute[v.id] <= v.perMinute + 1e-6, v.id);
  const blocked = report.scenarios.blocked.phases;
  assert.deepEqual(Object.values(blocked[1].chests), [1000, 1000]); assert.deepEqual(Object.values(blocked[2].chests), [1000, 1000]); assert.deepEqual(Object.values(blocked[2].packCrafts), [0, 0]); assert.equal(blocked[2].minutes, 10);
  assert.deepEqual(Object.values(report.scenarios.stone.phases[2].packCrafts), [0, 0]);
  assert.equal(report.scenarios.outage.phases[1].minutes, 5);
});

test('protocol: build orders are permutations, staged builds and orientations are what the report says', () => {
  for (const name of PROTOCOL.buildOrders) { const order = buildOrder(name, es); assert.equal(new Set(order).size, es.length, name); }
  const foundries = new Set(es.filter(e => e.name === 'foundry').map(e => e.entity_number));
  assert.ok(buildOrder('foundries-last', es).slice(-foundries.size).every(n => foundries.has(n)));
  assert.ok(buildOrder('pipes-first', es).slice(0, 10).every(n => /^pipe/.test(es[n - 1].name)));
  assert.notDeepEqual(buildOrder('shuffle-1', es), buildOrder('shuffle-2', es));
  for (const name of scenarioNames().filter(n => n.startsWith('build:'))) { const s = report.scenarios[name]; assert.equal(s.build.mode, 'staged'); assert.ok(s.build.completeTick >= es.length / PROTOCOL.stagedBuild.perStep * PROTOCOL.stagedBuild.everyTicks - 60, name); assert.equal(s.build.feedAfterBuild, name.endsWith(':late')); }
  assert.deepEqual(['east', 'south', 'west'].map(o => report.scenarios['orient:' + o].rotation), [4, 8, 12]);
});
