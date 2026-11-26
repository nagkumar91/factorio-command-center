// Foundry belts and fuel mall: generator, bill, static audit and the stored native report. Needs neither the game
// nor the raw dump: everything is read from the pinned prototypes, the published folders and the rocket fuel supply.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PROJECT, PUBLISHED, PROTOCOL, QUALIFICATION, FLUID_SCENARIOS, FUEL_SCENARIOS, FUEL, scenarioSummary, prototypes, readJson, sha, decode, exists } from '../scripts/requested-malls/foundry-belts-fuel-mall/lib.mjs';
import { design, LEVEL, RING_ARM_CAPS, RING_RULE_CAPS, FUEL_ROW, PANEL } from '../scripts/requested-malls/foundry-belts-fuel-mall/design.mjs';
import { products, fullBill, expand, needsOf, OUTSIDE, route } from '../scripts/requested-malls/foundry-belts-fuel-mall/bill.mjs';
import { auditFor } from '../scripts/requested-malls/foundry-belts-fuel-mall/audit.mjs';

const p = await prototypes();
const committed = (await fs.readFile(path.join(PUBLISHED, 'blueprint.txt'), 'utf8')).trim();
const manifest = await readJson(path.join(PUBLISHED, 'manifest.json'));
const d = design(p, { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), committedCode: committed });
const report = await exists(path.join(PUBLISHED, 'native-report.json')) ? await readJson(path.join(PUBLISHED, 'native-report.json')) : null;
const big = await readJson(path.join(PROJECT, 'blueprint-sources/requested-malls/foundry-mall/manifest.json'));
const supplyDir = path.join(PROJECT, 'blueprint-sources/vulcanus-supplies/rocket-fuel'), supply = await readJson(path.join(supplyDir, 'manifest.json'));

test('pinned prototypes: Factorio 2.1.25, the same raw dump as the foundry mall, the rocket fuel chain', async () => {
  const other = await readJson(path.join(PROJECT, 'scripts/requested-malls/foundry-mall/prototypes.json'));
  assert.equal(p.gameVersion, '2.1.25');
  assert.equal(p.provenance.rawSha256, other.provenance.rawSha256);
  assert.deepEqual(p.provenance.sourceHashes, other.provenance.sourceHashes);
  assert.equal(p.items[FUEL].stack_size, 20);
  assert.deepEqual(p.facts.rocket, { silo: 'rocket-silo', rocketPartsRequired: 50, partRecipe: 'rocket-part', rocketFuelPerPart: 1 });
  assert.deepEqual(p.recipes['rocket-fuel'].ingredients.map(v => [v.name, v.amount]), [['solid-fuel', 10], ['light-oil', 10]]);
  assert.deepEqual(p.recipes['simple-coal-liquefaction'].ingredients.map(v => [v.name, v.amount]), [['coal', 10], ['calcite', 2], ['sulfuric-acid', 25]]);
  for (const name of ['foundry', 'express-transport-belt', 'express-splitter']) assert(p.recipes[name].categories.includes('metallurgy'), name + ' can be made in a foundry');
});

test('products: the request in list order with its caps; rocket fuel is ten stacks and outside the order', () => {
  const list = products(p);
  assert.deepEqual(list.filter(v => !v.independent).map(v => [v.group, v.item, v.cap]), [[1, 'express-transport-belt', 100], [1, 'express-underground-belt', 50], [1, 'express-splitter', 50], [2, 'fast-inserter', 50], [2, 'bulk-inserter', 50], [3, 'electric-mining-drill', 50], [4, 'foundry', 20]]);
  assert.deepEqual(list.filter(v => v.independent).map(v => [v.item, v.cap]), [[FUEL, 200]]);
  assert.equal(200, 10 * p.items[FUEL].stack_size);
  assert.equal(200 / (p.facts.rocket.rocketPartsRequired * p.facts.rocket.rocketFuelPerPart), 4, 'four rockets\' worth');
  assert(!list.some(v => /assembling-machine|silo|platform|landing|collector|crusher|solar|accumulator|combinator|chest|substation/.test(v.item)), 'no assembling machine 3, no kit');
  assert.deepEqual(manifest.products, list);
  assert.deepEqual(manifest.independent, [FUEL]);
});

test('bill: only the declared entrances; the fuel section at 12 a minute is the stand-alone supply\'s figures', () => {
  const bill = fullBill(p);
  for (const v of products(p)) for (const name of needsOf(p, v)) assert(OUTSIDE.includes(name), `${v.item} needs ${name}`);
  assert.deepEqual(needsOf(p, { item: FUEL }).sort(), ['calcite-fuel', 'coal', 'sulfuric-acid', 'water']);
  assert.deepEqual(needsOf(p, { item: 'foundry' }).sort(), ['calcite', 'lava', 'lubricant', 'tungsten-carbide', 'water']);
  assert(!needsOf(p, { item: 'express-splitter' }).includes('sulfuric-acid'), 'the mall part needs no sulfuric acid');
  const one = expand(p, { [FUEL]: 12 }).outside;
  assert.deepEqual({ coal: Math.round(one.coal), calcite: Math.round(one['calcite-fuel'] * 10) / 10, acid: Math.round(one['sulfuric-acid']), water: Math.round(one.water) }, { coal: 352, calcite: 70.4, acid: 880, water: 1320 });
  assert.deepEqual({ coal: supply.sizing.perMinute.coal, calcite: supply.sizing.perMinute.calcite, acid: supply.sizing.perMinute['sulfuric-acid'], water: supply.sizing.perMinute.water }, { coal: 352, calcite: 70.4, acid: 880, water: 1320 });
  assert.deepEqual([PANEL.coal, PANEL['calcite-fuel'], PANEL['sulfuric-acid'], PANEL.waterFuel, PANEL[FUEL]], [352, 71, 880, 1320, 12]);
  assert.equal(route(p, 'iron-gear-wheel').recipe, 'casting-iron-gear-wheel');
  assert.deepEqual(manifest.bill.fullFill, bill.fullFill);
});

test('generator is deterministic and the committed string is the generated blueprint', () => {
  assert.deepEqual(decode(committed), d.blueprint);
  assert.equal(d.code, committed);
  assert.equal(sha(committed), manifest.candidateSha256);
  assert.deepEqual(d.manifest.footprint, manifest.footprint);
  assert.deepEqual(d.manifest.nets, manifest.nets);
  assert.deepEqual(manifest.nativeProtocol, JSON.parse(JSON.stringify(PROTOCOL)));
});

test('size: 34 x 27 in all, mall part 34 x 17, fuel part 34 x 10, no gap; smaller than the big mall alone', () => {
  const f = manifest.footprint;
  assert.deepEqual([f.width, f.height, f.area], [34, 27, 918]);
  assert.deepEqual([f.mallPart.width, f.mallPart.height, f.mallPart.area], [34, 17, 578]);
  assert.deepEqual([f.fuelPart.width, f.fuelPart.height, f.fuelPart.area], [34, 10, 340]);
  assert.equal(f.mallPart.area + f.fuelPart.area, f.area);
  assert.deepEqual([big.footprint.area, supply.footprint.area], [1056, 340]);
  assert(f.area < big.footprint.area && f.mallPart.area < 0.6 * big.footprint.area);
  assert.deepEqual([f.counts.foundry, f.counts['assembling-machine-3'], f.counts['oil-refinery'], f.counts['chemical-plant']], [5, 9, 3, 5]);
  assert(f.counts.foundry < big.footprint.counts.foundry && f.counts['decider-combinator'] < big.footprint.counts['decider-combinator']);
});

test('the fuel section is the stand-alone rocket fuel supply tile for tile, but for its exit, its panels and its hand sizes', async () => {
  const theirs = decode(await fs.readFile(path.join(supplyDir, 'blueprint.txt'), 'utf8')).blueprint.entities;
  const ours = decode(committed).blueprint.entities.filter(e => e.position.y > FUEL_ROW);
  const key = (e, dy = 0) => `${e.name}@${e.position.x},${e.position.y + dy}|${e.direction || 0}|${e.recipe || ''}|${e.mirror ? 'M' : ''}`;
  const kept = e => !['display-panel'].includes(e.name);
  const a = new Set(theirs.filter(kept).map(e => key(e, FUEL_ROW))), b = new Set(ours.filter(kept).map(e => key(e)));
  const onlyTheirs = [...a].filter(k => !b.has(k)), onlyOurs = [...b].filter(k => !a.has(k));
  // theirs only: the exit tile and the two belt tiles this layout turns; ours only: the turned tiles, the last arm and the chest
  assert.deepEqual(onlyTheirs.map(k => k.split('|')[0]).sort(), ['fast-transport-belt@32.5,26.5', 'fast-transport-belt@33.5,25.5', 'fast-transport-belt@33.5,26.5']);
  assert.deepEqual(onlyOurs.map(k => k.split('|')[0]).sort(), ['fast-inserter@33.5,25.5', 'fast-transport-belt@32.5,24.5', 'fast-transport-belt@32.5,25.5', 'fast-transport-belt@32.5,26.5', 'passive-provider-chest@33.5,26.5']);
  for (const name of ['oil-refinery', 'chemical-plant', 'assembling-machine-3', 'pipe', 'pipe-to-ground', 'substation']) assert.equal(ours.filter(e => e.name === name).length, theirs.filter(e => e.name === name).length, name);
  assert(ours.filter(e => e.name === 'fast-inserter').every(e => e.override_stack_size === 1));
});

test('static audit passes for the committed blueprint and matches the stored audit', async () => {
  const audit = await auditFor(decode(committed), manifest, p);
  assert.deepEqual(audit.errors, []);
  const stored = await readJson(path.join(PUBLISHED, 'static-audit.json'));
  assert.equal(stored.passed, true);
  assert.equal(stored.checksTotal, audit.checksTotal);
});

test('fluid ports: the audit refuses the casting foundry with its water pump replaced by plain pipes', async () => {
  const bad = structuredClone(decode(committed)), pump = bad.blueprint.entities[manifest.pumps[0].entity - 1], next = bad.blueprint.entities.length + 1;
  Object.assign(pump, { name: 'pipe', position: { x: pump.position.x, y: pump.position.y - 0.5 } }); delete pump.direction;
  bad.blueprint.entities.push({ entity_number: next, name: 'pipe', position: { x: pump.position.x, y: pump.position.y + 1 } });
  const badManifest = structuredClone(manifest); badManifest.fluids.water.push(next); badManifest.pumps = [];
  const refused = await auditFor(bad, badManifest, p);
  assert(refused.errors.some(e => e.startsWith('No machine has two ports of one kind')));
  assert.deepEqual(refused.checks.find(c => c.name.startsWith('No machine has two ports of one kind')).detail.map(v => [v.machine, v.kind, [...v.fluids].sort()]), [['caster-C', 'input', ['molten-iron', 'water']]]);
});

test('caps: one combinator, positive numbers, every product once, rocket fuel included; five passive provider chests', () => {
  const es = decode(committed).blueprint.entities, caps = es[manifest.capsCombinator.entity - 1].control_behavior.sections.sections[0].filters;
  assert.equal(caps.length, manifest.products.length);
  for (const v of manifest.products) assert.equal(caps.find(c => c.name === v.item).count, v.cap, v.key);
  assert.equal(caps.find(c => c.name === FUEL).count, 200);
  assert.deepEqual(manifest.outputs.map(o => [o.id, o.items.length]), [['OUT-1', 3], ['OUT-2', 2], ['OUT-3', 1], ['OUT-4', 1], ['OUT-5', 1]]);
  assert.equal(es.filter(e => e.name === 'passive-provider-chest').length, 5);
  assert.equal(es[manifest.fuel.chest - 1].name, 'passive-provider-chest');
});

test('control program: levels follow the list, every listed product has a rule at its level, rocket fuel has none', () => {
  assert.deepEqual(LEVEL, { 1: 4, 2: 3, 3: 2, 4: 1 });
  for (const v of manifest.products.filter(x => !x.independent)) assert(manifest.rules.some(r => r.recipe === v.item && r.level === LEVEL[v.group]), v.item);
  assert(!manifest.rules.some(r => r.recipe === FUEL));
  assert(!manifest.arms.some(a => a.level), 'no level-gated arm is left');
  assert.deepEqual(manifest.ringArmCaps, { ...RING_ARM_CAPS });
  assert.deepEqual(manifest.ringRuleCaps, { ...RING_RULE_CAPS });
  assert(manifest.ring.laneLimits.inner <= 0.75 * manifest.ring.laneCapacity && manifest.ring.laneLimits.outer <= 0.75 * manifest.ring.laneCapacity);
  assert.deepEqual([...new Set(manifest.rules.filter(r => r.machine === 'caster-C').map(r => r.recipe))], ['casting-iron', 'casting-iron-gear-wheel', 'casting-iron-stick', 'concrete-from-molten-iron', 'casting-steel', 'iron-ore-melting']);
  // the fuel section: no machine on a wire; only its four output arms and its chest read the cap
  const wired = new Set(Object.values(manifest.nets).flatMap(n => n.members.map(([id]) => id)));
  assert(manifest.fuel.machines.every(id => !wired.has(id)));
  assert.equal(manifest.fuel.arms.length, 4);
});

test('ports and labels: nine entrances with their figures, one stone exit, one power connection', async () => {
  const ports = await readJson(path.join(PUBLISHED, 'ports.json'));
  assert.deepEqual(ports.inputs.map(v => v.key).sort(), [...PROTOCOL.inputs].sort());
  assert.deepEqual(ports.inputs.filter(v => v.item === 'calcite').map(v => [v.key, v.side, v.section]), [['calcite', 'north', 'mall'], ['calcite-fuel', 'west', 'fuel']]);
  assert.deepEqual(ports.inputs.filter(v => v.section === 'fuel').map(v => v.key).sort(), ['calcite-fuel', 'coal', 'sulfuric-acid']);
  assert.deepEqual(ports.inputs.filter(v => v.section === 'both').map(v => v.key), ['water']);
  assert.deepEqual(ports.exits.map(v => v.item), ['stone']);
  assert.equal(ports.candidateSha256, manifest.candidateSha256);
  const es = decode(committed).blueprint.entities;
  for (const v of [...ports.inputs, ...ports.exits]) assert(es[v.panel - 1].name === 'display-panel' && es[v.panel - 1].text === v.label);
  for (const v of ports.inputs) assert(v.label.includes(`${v.perMinute}/min`), v.id);
});

test('the big foundry mall and the rocket fuel supply are as published', async () => {
  // their generated folders are read here, never written by this mall's tools
  assert.equal(big.id, 'foundry-mall');
  assert.equal(sha((await fs.readFile(path.join(PROJECT, 'blueprint-sources/requested-malls/foundry-mall/blueprint.txt'), 'utf8')).trim()), big.candidateSha256);
  assert.equal(sha((await fs.readFile(path.join(supplyDir, 'blueprint.txt'), 'utf8')).trim()), supply.candidateSha256);
  assert.notEqual(manifest.candidateSha256, big.candidateSha256);
});

test('stored native report: for exactly this string, every scenario passed', { skip: !report && 'no native report stored yet' }, async () => {
  assert.equal(report.blueprintSha256, manifest.candidateSha256, 'the report is for the committed string');
  assert.equal(report.passed, true);
  assert.equal(report.gameVersion, '2.1.25');
  assert.deepEqual(Object.keys(report.scenarios).sort(), [...QUALIFICATION].sort());
  const full = ['fill', 'rate', ...FUEL_SCENARIOS, ...QUALIFICATION.filter(n => n.endsWith(':full'))];
  for (const n of QUALIFICATION) { const s = report.scenarios[n]; assert.equal(s.passed, true, n); assert.equal(s.blueprintSha256, manifest.candidateSha256, n); assert.equal(s.surface, 'vulcanus'); assert.equal(s.capsName, full.includes(n) ? 'full' : 'reduced', n); }
  const fill = report.scenarios.fill.phases[0];
  assert.deepEqual(fill.caps, manifest.caps, 'the fill ran at the published caps');
  assert.equal(fill.endedBy, 'caps');
  // list order: every product of a group reached its cap before any product of the next group did
  for (let g = 1; g < 4; g++) {
    const last = Math.max(...manifest.products.filter(v => v.group === g).map(v => fill.reached[v.key])), first = Math.min(...manifest.products.filter(v => v.group === g + 1).map(v => fill.reached[v.key]));
    assert(last <= first, `group ${g} was full (${last}) before a product of group ${g + 1} was (${first})`);
  }
  for (const s of Object.values(report.scenarios)) assert(s.ringPeakTotal <= manifest.ring.bound);
  // withheld entrances: what needs the entrance stays short, everything else fills; the fuel's own entrances stop only rocket fuel
  for (const input of PROTOCOL.withheldInputs) {
    const [withheld, returned] = report.scenarios['skip:' + input].phases;
    assert.equal(withheld.endedBy, 'caps', input); assert.equal(returned.endedBy, 'caps', input);
    for (const key of report.dependents[input]) assert(withheld.stock[key] < withheld.caps[key], `${key} cannot be at its cap without ${input}`);
    for (const v of manifest.products) if (!report.dependents[input].includes(v.key)) assert.equal(withheld.stock[v.key], withheld.caps[v.key], `${v.key} fills without ${input}`);
  }
  for (const input of ['coal', 'sulfuric-acid', 'calcite-fuel']) assert.deepEqual(report.dependents[input], [FUEL]);
  // hand-back: express belts are refilled with tungsten carbide still cut, at both cap sets
  for (const n of PROTOCOL.handbackScenarios) { const ph = report.scenarios[n].phases; assert.equal(ph[2].endedBy, 'caps', n); assert.equal(ph[3].endedBy, 'caps', n); assert.notEqual(ph[3].holding.U2.recipe, 'none', n); }
  assert.deepEqual(report.dependents.water.sort(), ['foundry', FUEL].sort());
  for (const input of ['lava', 'calcite']) assert(!report.dependents[input].includes(FUEL));
});

test('stored native report: rocket fuel at 12 a minute in every condition, its chest stops at exactly its cap', { skip: !report && 'no native report stored yet' }, () => {
  const lo = PROTOCOL.fuelTarget - PROTOCOL.fuelTolerance, hi = PROTOCOL.fuelTarget + PROTOCOL.fuelTolerance;
  const windows = [['fuel:idle', 2], ['fuel:filling', 1], ['both:emptied', 2], ['both:emptied', 5]];
  for (const [n, i] of windows) {
    const ph = report.scenarios[n].phases[i], minutes = ph.ticks / 3600, rate = ph.collected[FUEL] / minutes;
    assert.equal(ph.ticks, PROTOCOL.fuelWindowTicks, n);
    assert(rate >= lo && rate <= hi, `${n}: ${rate} a minute`);
    // its own entrances were held to their panel figures
    for (const [key, figure] of [['coal', PANEL.coal], ['calcite-fuel', PANEL['calcite-fuel']], ['sulfuric-acid', PANEL['sulfuric-acid']]]) assert(ph.accepted[key] / minutes <= figure + 0.5, `${n}: ${key}`);
    assert(ph.accepted.water / minutes <= PANEL.waterFuel + PANEL.waterMall + 0.5, n);
  }
  assert(report.scenarios['fuel:idle'].phases[2].accepted.water / 30 <= PANEL.waterFuel + 0.5, 'water at the fuel figure alone while the mall part is idle');
  // while the mall part works: express belts in one window, foundries in the other
  assert(report.scenarios['both:emptied'].phases[2].collected['express-transport-belt'] > 0);
  assert(report.scenarios['both:emptied'].phases[5].collected.foundry > 0);
  // exactly the cap, and still: the fill ends with 200, the one-hour hold changes no chest and no rocket fuel assembler crafts
  assert.equal(report.scenarios.fill.phases[0].stock[FUEL], 200);
  const hold = report.scenarios.hold.phases.find(v => v.name.startsWith('one-hour'));
  assert.equal(hold.stock[FUEL], hold.caps[FUEL]); assert.equal(hold.finalCrafts, 0);
  assert.equal(report.scenarios.hold.checks.find(c => c.name.endsWith('no chest changed')).passed, true);
  // the mall part's fill with and without the fuel section
  const noFuel = report.scenarios['fill:no-fuel'].phases[0];
  assert.equal(noFuel.stock[FUEL], 0); assert.equal(noFuel.endedBy, 'caps');
  for (const v of manifest.products.filter(x => !x.independent)) assert.equal(noFuel.stock[v.key], v.cap, v.key);
});

test('stored native report: fluid safety everywhere, construction orders, placements', { skip: !report && 'no native report stored yet' }, async () => {
  const sum = Object.fromEntries(Object.entries(report.scenarios).map(([k, v]) => [k, scenarioSummary(v)]));
  for (const [n, v] of Object.entries(sum)) {
    assert.deepEqual(v.foreignFluids, [], n); assert.deepEqual(v.joinedBoxes, [], n); assert.deepEqual(v.strayRecipes, [], n);
    assert(report.scenarios[n].segmentsWatched >= 8, n + ' reads every fluid segment');
    if (FLUID_SCENARIOS.includes(n) && !v.matrix) assert.equal(v.phases.at(-1).endedBy, 'caps', n + ' ends with every cap reached');
  }
  const cases = Object.entries(PROTOCOL.matrixNetworks).reduce((k, [role, nets]) => { const r = (PROTOCOL.matrixRecipes[role] || [...new Set(manifest.rules.filter(x => x.machine === role).map(x => x.recipe))]).length; return k + r * (r - 1) * 2 ** nets.length; }, 0);
  assert.equal(sum.ports.matrix.cases, cases); assert.deepEqual(sum.ports.matrix.leaks, []); assert.deepEqual(sum.ports.matrix.joins, []);
  for (const n of PROTOCOL.buildOrders) { const c = sum['build:' + n].construction; assert.equal(c.mode, n.startsWith('robots') ? 'robots' : 'script', n); assert(c.ticks > 0); }
  for (const n of PROTOCOL.placements) { const pl = sum['place:' + n].placement; assert.equal(pl.name, n); assert.equal(pl.mirrored, n.startsWith('flip')); }
  const status = await readJson(path.join(PUBLISHED, 'native-status.json'));
  assert.equal(status.candidateSha256, manifest.candidateSha256);
  assert.equal(status.status, 'passed');
  const readme = await fs.readFile(path.join(PUBLISHED, 'README.md'), 'utf8');
  assert(readme.includes(manifest.candidateSha256) && readme.includes('**qualified**') && readme.includes('### Fluid safety (reduced caps)') && readme.includes('you do not need the stand-alone rocket fuel supply'));
  // panel figures of the mall part are not below what the unrestricted rate windows drew
  for (const ph of report.scenarios.rate.phases.filter(v => v.perMinute)) { const minutes = ph.ticks / 3600; for (const [key, figure] of [['lava', PANEL.lava], ['calcite', PANEL.calcite], ['plastic-bar', PANEL['plastic-bar']], ['tungsten-carbide', PANEL['tungsten-carbide']], ['lubricant', PANEL.lubricant]]) assert(ph.accepted[key] / minutes <= figure, `${ph.name}: ${key} ${ph.accepted[key] / minutes} over its panel figure ${figure}`); }
});
