// Foundry mall: generator, bill, static audit and the stored native report. Needs neither the game nor the raw dump:
// everything is read from the pinned prototypes and the published folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PUBLISHED, PROTOCOL, QUALIFICATION, FLUID_SCENARIOS, scenarioSummary, prototypes, readJson, sha, decode, exists } from '../scripts/requested-malls/foundry-mall/lib.mjs';
import { EARLIER } from '../scripts/requested-malls/foundry-mall/readme.mjs';
import { design, LEVEL, RING_ARM_CAPS, RING_RULE_CAPS } from '../scripts/requested-malls/foundry-mall/design.mjs';
import { loadKit, products, fullBill, expand, OUTSIDE, route } from '../scripts/requested-malls/foundry-mall/bill.mjs';
import { auditBlueprint } from '../scripts/requested-malls/foundry-mall/audit.mjs';

const p = await prototypes(), kit = await loadKit();
const committed = (await fs.readFile(path.join(PUBLISHED, 'blueprint.txt'), 'utf8')).trim();
const manifest = await readJson(path.join(PUBLISHED, 'manifest.json'));
const d = design(p, kit, { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), committedCode: committed });
const report = await exists(path.join(PUBLISHED, 'native-report.json')) ? await readJson(path.join(PUBLISHED, 'native-report.json')) : null;

test('pinned prototypes: Factorio 2.1.25, the foundry and the recipes the mall relies on', () => {
  assert.equal(p.gameVersion, '2.1.25');
  assert.equal(p.entities.foundry.crafting_speed, 4);
  assert.equal(p.entities.foundry.effect_receiver.base_effect.productivity, 0.5);
  assert.deepEqual(p.entities.foundry.crafting_categories, ['metallurgy']);
  for (const belt of ['transport-belt', 'express-transport-belt', 'express-splitter', 'foundry']) assert(p.recipes[belt].categories.includes('metallurgy'), belt + ' can be made in a foundry');
  assert.deepEqual(p.recipes['molten-iron-from-lava'].ingredients.map(v => [v.name, v.amount]), [['lava', 500], ['calcite', 1]]);
  assert.deepEqual(p.recipes['molten-iron-from-lava'].results.map(v => [v.name, v.amount]), [['molten-iron', 250], ['stone', 10]]);
  assert.deepEqual(p.recipes.foundry.ingredients.map(v => v.name).sort(), ['electronic-circuit', 'lubricant', 'refined-concrete', 'steel-plate', 'tungsten-carbide']);
  assert.equal(p.planets.vulcanus.surface_properties.pressure, 4000);
  assert.equal(p.recipes.foundry.surface_conditions[0].min, 4000);
});

test('products: the request in list order, the kit from the launch-kit bill, one stack for every stock product', async () => {
  const list = products(p, kit), bill = await readJson(path.join(HERE, '../../launch-kit/bill.json'));
  assert.deepEqual(list.filter(v => v.group === 1).map(v => v.item), ['assembling-machine-3']);
  assert.deepEqual(list.filter(v => v.group === 2).map(v => [v.item, v.cap]), bill.items.map(v => [v.item, v.count + v.spare]));
  assert.deepEqual(list.filter(v => v.group === 3).map(v => v.item), ['express-transport-belt', 'express-underground-belt', 'express-splitter']);
  assert.deepEqual(list.filter(v => v.group === 4).map(v => v.item), ['fast-inserter', 'bulk-inserter']);
  assert.deepEqual(list.filter(v => v.group > 4).map(v => v.item), ['electric-mining-drill', 'foundry']);
  for (const v of list.filter(v => v.group !== 2)) assert.equal(v.cap, p.items[v.item].stack_size, v.item);
  // two fast-inserter stocks: the kit's 19 (group 2, kit chest) and a full stack (group 4, inserter chest)
  assert.deepEqual(list.filter(v => v.item === 'fast-inserter').map(v => [v.key, v.group, v.cap]), [['fast-inserter (kit)', 2, 19], ['fast-inserter', 4, 50]]);
  assert.equal(new Set(list.map(v => v.key)).size, list.length);
  assert.deepEqual(manifest.stock.filter(v => v.item === 'fast-inserter').map(v => v.output), ['OUT-2', 'OUT-4']);
  assert.deepEqual(manifest.products, list);
});

test('bill of materials: only the declared outside inputs, stone is a surplus', async () => {
  const bill = await fullBill(p), f = bill.fullFill;
  for (const v of products(p, kit)) for (const name of Object.keys(expand(p, { [v.item]: 1 }).outside)) assert(OUTSIDE.includes(name), `${v.item} needs ${name}`);
  for (const name of ['lava', 'calcite', 'plastic-bar', 'tungsten-carbide', 'sulfuric-acid', 'lubricant', 'water']) assert(f[name] > 0, name);
  assert(f.stoneSurplus > 0 && f.stoneUsed > 0 && Math.abs(f.stoneMade - f.stoneUsed - f.stoneSurplus) < 0.02);
  assert.equal(route(p, 'iron-gear-wheel').recipe, 'casting-iron-gear-wheel');
  assert.equal(route(p, 'express-transport-belt').machine, 'foundry');
  assert.equal(Math.round(expand(p, { foundry: 3 }).outside['tungsten-carbide']), 100);   // the foundry's +50%: three foundries from two crafts
  assert.deepEqual(manifest.bill.fullFill, bill.fullFill);
});

test('generator is deterministic and the committed string is the generated blueprint', () => {
  assert.deepEqual(decode(committed), d.blueprint);
  assert.equal(d.code, committed, 'the committed string is kept when it decodes to the generated blueprint');
  assert.equal(d.hash, manifest.candidateSha256);
  assert.equal(sha(committed), manifest.candidateSha256);
  assert.deepEqual(d.manifest.footprint, manifest.footprint);
  assert.deepEqual(d.manifest.nets, manifest.nets);
  assert.deepEqual(manifest.nativeProtocol, JSON.parse(JSON.stringify(PROTOCOL)));
});

test('static audit passes for the committed blueprint and matches the stored audit', async () => {
  const audit = auditBlueprint(decode(committed), manifest, p);
  assert.deepEqual(audit.errors, []);
  const stored = await readJson(path.join(PUBLISHED, 'static-audit.json'));
  assert.equal(stored.passed, true);
  assert.equal(stored.checksTotal, audit.checksTotal);
});

test('caps: one combinator, positive numbers, every product once; chests declare every product once', () => {
  const es = decode(committed).blueprint.entities, caps = es[manifest.capsCombinator.entity - 1].control_behavior.sections.sections[0].filters;
  assert.equal(caps.length, manifest.products.length);
  for (const v of manifest.products) assert.equal(caps.find(f => f.name === manifest.capSignals[v.key]).count, v.cap, v.key);
  assert.equal(caps.find(f => f.name === 'signal-K').count, 19);
  assert.equal(caps.find(f => f.name === 'fast-inserter').count, 50);
  assert.deepEqual(manifest.outputs.flatMap(o => o.items).sort(), manifest.products.map(v => v.item).sort());
  assert.equal(es.filter(e => e.name === 'passive-provider-chest').length, 5);
});

test('control program: levels follow the list, every product has a rule at its level, lane limits fit', () => {
  assert.deepEqual(LEVEL, { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 });
  for (const v of manifest.products) assert(manifest.rules.some(r => r.recipe === v.item && r.level === LEVEL[v.group]), v.item);
  assert(manifest.rules.filter(r => r.recipe === 'fast-inserter').map(r => r.level).sort().join() === '3,5', 'fast inserters at the kit level and at the inserter level');
  assert.deepEqual(manifest.ringArmCaps, { ...RING_ARM_CAPS });
  assert.deepEqual(manifest.ringRuleCaps, { ...RING_RULE_CAPS });
  assert(manifest.ring.laneLimits.inner <= manifest.ring.laneCapacity && manifest.ring.laneLimits.outer <= manifest.ring.laneCapacity);
  assert.equal(manifest.equipment.power, 'substation');
  assert.deepEqual(manifest.footprint.counts.substation, 4);
});

test('ports and labels: seven entrances, one stone exit, one power connection', async () => {
  const ports = await readJson(path.join(PUBLISHED, 'ports.json'));
  assert.deepEqual(ports.inputs.map(v => v.item).sort(), ['calcite', 'lava', 'lubricant', 'plastic-bar', 'sulfuric-acid', 'tungsten-carbide', 'water']);
  assert.deepEqual(ports.exits.map(v => v.item), ['stone']);
  assert.equal(ports.candidateSha256, manifest.candidateSha256);
  const es = decode(committed).blueprint.entities;
  for (const v of [...ports.inputs, ...ports.exits]) assert(es[v.panel - 1].name === 'display-panel' && es[v.panel - 1].text === v.label);
});

test('fluid ports: no machine has two ports of one kind on the pipes of two fluids; a pump stands on each second-fluid port', () => {
  const es = decode(committed).blueprint.entities, audit = auditBlueprint(decode(committed), manifest, p);
  const named = name => audit.checks.find(c => c.name.startsWith(name));
  assert.equal(named('No machine has two ports of one kind').passed, true);
  assert.equal(named('Each pump stands directly between').passed, true);
  assert.deepEqual(manifest.pumps.map(v => [v.fluid, manifest.machines.find(x => x.entity === v.to).role]), [['molten-copper', 'caster-S'], ['water', 'caster-G']]);
  assert.equal(es.filter(e => e.name === 'pump').length, 2);
  // the joint that was published before: the copper pump replaced by two plain pipes. The audit must refuse it.
  const bad = structuredClone(decode(committed)), pump = bad.blueprint.entities[manifest.pumps[0].entity - 1], next = bad.blueprint.entities.length + 1;
  Object.assign(pump, { name: 'pipe', position: { x: pump.position.x, y: pump.position.y - 0.5 } }); delete pump.direction;
  bad.blueprint.entities.push({ entity_number: next, name: 'pipe', position: { x: pump.position.x, y: pump.position.y + 1 } });
  const badManifest = structuredClone(manifest); badManifest.fluids['molten-copper'].push(next); badManifest.pumps = badManifest.pumps.slice(1);
  const refused = auditBlueprint(bad, badManifest, p);
  assert(refused.errors.some(e => e.startsWith('No machine has two ports of one kind')), 'the earlier joint fails the static audit');
  assert.deepEqual(refused.checks.find(c => c.name.startsWith('No machine has two ports of one kind')).detail.map(v => [v.machine, v.kind, [...v.fluids].sort()]), [['caster-S', 'input', ['molten-copper', 'molten-iron']]]);
});

test('same ports, chests, caps combinator and footprint as the string published before', () => {
  assert.equal(`${manifest.footprint.width} x ${manifest.footprint.height}`, '32 x 33');
  assert.equal(manifest.footprint.entities, 443);
  const b = manifest.footprint.bounds, tile = v => [Math.floor(v.x) - b.left, Math.floor(v.y) - b.top];
  assert.deepEqual(manifest.ports.map(v => [v.id, ...tile(v.position)]), [['IN-1', 0, 2], ['IN-2', 0, 0], ['OUT-STONE', 0, 1], ['IN-3', 29, 4], ['IN-4', 6, 32], ['IN-5', 29, 31], ['IN-6', 19, 32], ['IN-7', 23, 32]]);
  assert.deepEqual(manifest.outputs.map(v => [v.id, ...tile(v.position)]), [['OUT-1', 13, 28], ['OUT-2', 14, 28], ['OUT-3', 20, 28], ['OUT-4', 21, 28], ['OUT-5', 22, 28]]);
  assert.deepEqual(tile(manifest.capsCombinator.position), [13, 30]);
});

test('stored native report: for exactly this string, every scenario passed, list order measured at full caps', { skip: !report && 'no native report stored yet' }, async () => {
  assert.equal(report.blueprintSha256, manifest.candidateSha256, 'the report is for the committed string');
  assert.equal(report.passed, true);
  assert.equal(report.gameVersion, '2.1.25');
  const names = QUALIFICATION;
  assert.deepEqual(Object.keys(report.scenarios).sort(), [...names].sort());
  for (const n of names) { const s = report.scenarios[n]; assert.equal(s.passed, true, n); assert.equal(s.blueprintSha256, manifest.candidateSha256, n); assert.equal(s.surface, 'vulcanus'); assert.equal(s.pressure, 4000); assert.equal(s.capsName, n === 'fill' || n === 'rate' ? 'full' : 'reduced', n); }
  const fill = report.scenarios.fill.phases[0];
  assert.deepEqual(fill.caps, manifest.caps, 'the fill ran at the published caps');
  assert.equal(fill.endedBy, 'caps');
  // list order: every product of a group reached its cap before any product of the next group did
  for (let g = 1; g < 6; g++) {
    const last = Math.max(...manifest.products.filter(v => v.group === g).map(v => fill.reached[v.key])), first = Math.min(...manifest.products.filter(v => v.group === g + 1).map(v => fill.reached[v.key]));
    assert(last <= first, `group ${g} was full (${last}) before a product of group ${g + 1} was (${first})`);
  }
  for (const s of Object.values(report.scenarios)) { assert(s.ringPeakTotal <= manifest.ring.bound); for (const ph of s.phases) assert.equal(ph.gatedActive, 0, ph.name); }
  for (const input of ['plastic-bar', 'tungsten-carbide', 'sulfuric-acid', 'lubricant', 'water']) {
    const [withheld, returned] = report.scenarios['skip:' + input].phases;
    assert.equal(withheld.endedBy, 'caps', input); assert.equal(returned.endedBy, 'caps', input);
    for (const item of report.dependents[input]) assert(withheld.stock[item] < withheld.caps[item], `${item} cannot be at its cap without ${input}`);
  }
  // the two fast-inserter stocks: each chest at its own cap, and refilling one never moves the other
  assert.equal(fill.stock['fast-inserter (kit)'], 19); assert.equal(fill.stock['fast-inserter'], 50);
  assert(fill.reached['fast-inserter (kit)'] < fill.reached['fast-inserter']);
  for (const key of ['fast-inserter (kit)', 'fast-inserter']) {
    const ph = report.scenarios.single.phases.find(v => v.name === 'single refill: ' + key);
    assert(ph.collectedAtStart[key] > 0 && Object.keys(ph.collectedAtStart).length === 1 && ph.endedBy === 'caps', key);
    assert.equal(ph.stock[key], ph.caps[key]);
    assert.equal(report.scenarios.single.checks.find(c => c.name === `single refill: ${key}: no other stock moved`).passed, true);
  }
  // fluid safety: nothing foreign anywhere, ever; no joined box; no stray recipe; the mall fills after every disturbance
  const sum = Object.fromEntries(Object.entries(report.scenarios).map(([k, v]) => [k, scenarioSummary(v)]));
  for (const [n, v] of Object.entries(sum)) {
    assert.deepEqual(v.foreignFluids, [], n); assert.deepEqual(v.joinedBoxes, [], n); assert.deepEqual(v.strayRecipes, [], n);
    assert(report.scenarios[n].segmentsWatched >= 8, n + ' reads every fluid segment');
    if (FLUID_SCENARIOS.includes(n) && !v.matrix) assert.equal(v.phases.at(-1).endedBy, 'caps', n + ' ends with every cap reached');
  }
  const cases = Object.entries(PROTOCOL.matrixNetworks).reduce((k, [role, nets]) => { const r = (PROTOCOL.matrixRecipes[role] || [...new Set(manifest.rules.filter(x => x.machine === role).map(x => x.recipe))]).length; return k + r * (r - 1) * 2 ** nets.length; }, 0);
  assert.equal(sum.ports.matrix.cases, cases); assert.deepEqual(sum.ports.matrix.leaks, []); assert.deepEqual(sum.ports.matrix.joins, []);
  assert.equal(report.scenarios.ports.checks.find(c => c.name.startsWith('port matrix: all')).passed, true);
  for (const n of PROTOCOL.buildOrders) { const c = sum['build:' + n].construction; assert.equal(c.mode, n.startsWith('robots') ? 'robots' : 'script', n); assert(c.ticks > 0); }
  assert(sum['build:copper-foundry-last'].construction.ticks > PROTOCOL.buildGapTicks);
  for (const n of PROTOCOL.placements) { const pl = sum['place:' + n].placement; assert.equal(pl.name, n); assert.equal(pl.mirrored, n.startsWith('flip')); assert.equal(pl.blueprintSha256 === manifest.candidateSha256, !n.startsWith('flip'), n); }
  assert.deepEqual(FLUID_SCENARIOS.filter(n => !sum[n]), []);
  const status = await readJson(path.join(PUBLISHED, 'native-status.json'));
  assert.equal(status.candidateSha256, manifest.candidateSha256);
  assert.equal(status.status, 'passed');
  const readme = await fs.readFile(path.join(PUBLISHED, 'README.md'), 'utf8');
  assert(readme.includes(manifest.candidateSha256) && readme.includes('**qualified**') && readme.includes('Reduced caps') && readme.includes('### Fluid safety (reduced caps)') && readme.includes('If you already placed the earlier string'));
});

test('the string published before fails the same fluid scenarios (stored summary of that run)', { skip: !report && 'no native report stored yet' }, async () => {
  const earlier = await readJson(path.join(PUBLISHED, EARLIER.file));
  assert.equal(earlier.blueprintSha256, EARLIER.sha);
  assert.notEqual(earlier.blueprintSha256, manifest.candidateSha256);
  assert.equal(earlier.passed, false);
  assert.deepEqual(Object.keys(earlier.scenarios).sort(), [...FLUID_SCENARIOS, 'recover:flush'].sort());
  // the open joint in every scenario; molten iron in the copper pipes in the matrix and with the stone exit blocked; stuck for good there
  for (const [n, v] of Object.entries(earlier.scenarios)) { assert.equal(v.passed, false, n); if (n !== 'recover:flush') assert.equal(report.scenarios[n].passed, true, n); }
  const joint = v => (v.matrix ? v.matrix.joins : v.joinedBoxes).some(j => j.machine === 'caster-S' && j.recipe === 'casting-steel' && j.box === 'molten-iron' && j.joinedTo === 'molten-copper');
  for (const [n, v] of Object.entries(earlier.scenarios)) assert(joint(v), n);
  assert.deepEqual(earlier.scenarios.ports.matrix.leaks.map(k => [k.machine, k.from, k.empty.join()]).sort(), [['caster-S', 'casting-steel', 'molten-copper'], ['caster-S', 'casting-steel', 'molten-copper']]);
  const stone = earlier.scenarios['late:stone-exit'];
  assert.deepEqual(stone.foreignFluids.map(f => [f.network, f.held]), [['molten-copper', 'molten-iron']]);
  assert.notEqual(stone.phases.at(-1).endedBy, 'caps'); assert.equal(stone.phases.at(-1).productsShort, manifest.products.length);
  assert.equal(scenarioSummary(report.scenarios['late:stone-exit']).phases.at(-1).endedBy, 'caps');
  // first aid on that string: connecting the stone exit alone does not help; flushing the copper pipes does
  const aid = earlier.scenarios['recover:flush'].phases;
  assert.equal(aid[1].productsShort, manifest.products.length); assert.deepEqual(aid[2].flushed.map(v => [v.network, v.held]), [['molten-copper', 'molten-iron']]); assert.equal(aid[2].endedBy, 'caps');
});
