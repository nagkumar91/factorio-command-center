// Foundry mall: generator, bill, static audit and the stored native report. Needs neither the game nor the raw dump:
// everything is read from the pinned prototypes and the published folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PUBLISHED, PROTOCOL, prototypes, readJson, sha, decode, exists } from '../scripts/requested-malls/foundry-mall/lib.mjs';
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
  assert.deepEqual(list.filter(v => v.group === 2).map(v => [v.item, v.cap]), bill.items.filter(v => v.item !== 'fast-inserter').map(v => [v.item, v.count + v.spare]));
  assert.deepEqual(list.filter(v => v.group === 3).map(v => v.item), ['express-transport-belt', 'express-underground-belt', 'express-splitter']);
  assert.deepEqual(list.filter(v => v.group === 4).map(v => v.item), ['fast-inserter', 'bulk-inserter']);
  assert.deepEqual(list.filter(v => v.group > 4).map(v => v.item), ['electric-mining-drill', 'foundry']);
  for (const v of list.filter(v => v.group !== 2)) assert.equal(v.cap, p.items[v.item].stack_size, v.item);
  assert.equal(list.find(v => v.item === 'fast-inserter').kitShare, 19);
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
  assert.equal(caps.length, manifest.products.length + 1);
  for (const v of manifest.products) assert.equal(caps.find(f => f.name === v.item).count, v.cap);
  assert.equal(caps.find(f => f.name === 'signal-K').count, 19);
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

test('stored native report: for exactly this string, every scenario passed, list order measured at full caps', { skip: !report && 'no native report stored yet' }, async () => {
  assert.equal(report.blueprintSha256, manifest.candidateSha256, 'the report is for the committed string');
  assert.equal(report.passed, true);
  assert.equal(report.gameVersion, '2.1.25');
  const names = ['fill', 'rate', 'hold', 'caps', 'single', ...PROTOCOL.withheldInputs.map(n => 'skip:' + n)];
  assert.deepEqual(Object.keys(report.scenarios).sort(), [...names].sort());
  for (const n of names) { const s = report.scenarios[n]; assert.equal(s.passed, true, n); assert.equal(s.blueprintSha256, manifest.candidateSha256, n); assert.equal(s.surface, 'vulcanus'); assert.equal(s.pressure, 4000); assert.equal(s.capsName, n === 'fill' || n === 'rate' ? 'full' : 'reduced', n); }
  const fill = report.scenarios.fill.phases[0];
  assert.deepEqual(fill.caps, manifest.caps, 'the fill ran at the published caps');
  assert.equal(fill.endedBy, 'caps');
  // list order: every product of a group reached its cap before any product of the next group did
  for (let g = 1; g < 6; g++) {
    const last = Math.max(...manifest.products.filter(v => v.group === g).map(v => fill.reached[v.item])), first = Math.min(...manifest.products.filter(v => v.group === g + 1).map(v => fill.reached[v.item]));
    assert(last <= first, `group ${g} was full (${last}) before a product of group ${g + 1} was (${first})`);
  }
  for (const s of Object.values(report.scenarios)) { assert(s.ringPeakTotal <= manifest.ring.bound); for (const ph of s.phases) assert.equal(ph.gatedActive, 0, ph.name); }
  for (const input of ['plastic-bar', 'tungsten-carbide', 'sulfuric-acid', 'lubricant', 'water']) {
    const [withheld, returned] = report.scenarios['skip:' + input].phases;
    assert.equal(withheld.endedBy, 'caps', input); assert.equal(returned.endedBy, 'caps', input);
    for (const item of report.dependents[input]) assert(withheld.stock[item] < withheld.caps[item], `${item} cannot be at its cap without ${input}`);
  }
  const status = await readJson(path.join(PUBLISHED, 'native-status.json'));
  assert.equal(status.candidateSha256, manifest.candidateSha256);
  assert.equal(status.status, 'passed');
  const readme = await fs.readFile(path.join(PUBLISHED, 'README.md'), 'utf8');
  assert(readme.includes(manifest.candidateSha256) && readme.includes('**qualified**') && readme.includes('Reduced caps'));
});
