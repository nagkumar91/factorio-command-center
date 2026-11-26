// Rocket-fuel supply for Vulcanus (blueprint-sources/vulcanus-supplies/rocket-fuel), the third member of the Vulcanus supplies family.
// Needs only the pinned data beside the generators and the committed files; no game and no raw prototype dump.
// The one check against the raw dump runs only when FACTORIO_RAW points at one, and is skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, IDS, MEMBERS, published, prototypes, fluidSlots, memberPins, readJson, encode, encodeKeeping, decode, sha, envelope, exists, analyzeFluids, portRules, machineBoxes, unusedPortTiles } from '../scripts/vulcanus-supplies/lib.mjs';
import { auditBlueprint } from '../scripts/vulcanus-supplies/audit.mjs';
import { summarize } from '../scripts/vulcanus-supplies/summary.mjs';
import { placed, buildOrder, PLACEMENTS } from '../scripts/vulcanus-supplies/placement.mjs';
import { design, sizing, TARGETS, ID } from '../scripts/vulcanus-supplies/rocket-fuel/design.mjs';
import { readme } from '../scripts/vulcanus-supplies/rocket-fuel/readme.mjs';
import { scenarios, GROUPS, FLOOR_SHARE, FLUID_READ_TICKS, BUILD, BUILD_ORDERS, PLACED, HAND_BONUSES, REACH_WINDOW_MINUTES, REACH_LIMIT_MINUTES, HOLD_MINUTES } from '../scripts/vulcanus-supplies/rocket-fuel/scenario.mjs';

const [p, slots, family] = await Promise.all([prototypes(ID), fluidSlots(ID), prototypes()]);
const prototypeSha256 = sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256 = sha(await fs.readFile(path.join(HERE, 'fluid-slots.json')));
const pins = await memberPins(ID);
const dir = published(ID);
const [m, report, status] = await Promise.all([readJson(path.join(dir, 'manifest.json')), readJson(path.join(dir, 'native-report.json')), readJson(path.join(dir, 'native-status.json'))]);
const code = (await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code), es = bp.blueprint.entities;
const byId = id => es.find(e => e.entity_number === id);
const FLOOR = +(TARGETS['rocket-fuel'] * FLOOR_SHARE).toFixed(2);
const out = m.outputPorts[0];
const want = scenarios(m), names = Object.keys(want);

test('rocket-fuel: it is a member of the family and the first two members are as they were', () => {
  assert.deepEqual(MEMBERS, [...IDS, ID]);
  assert.deepEqual(IDS, ['coal-plastic-lubricant', 'tungsten-carbide']);
  // the member's own pins add to the family pins and change none of them
  for (const g of ['recipes', 'entities', 'items', 'fluids']) for (const [k, v] of Object.entries(family[g])) assert.deepEqual(p[g][k], v, `${g}.${k}`);
  assert.deepEqual(Object.keys(p.recipes).filter(k => !family.recipes[k]).sort(), ['rocket-fuel', 'solid-fuel-from-light-oil']);
  assert.deepEqual(Object.keys(p.items).filter(k => !family.items[k]).sort(), ['rocket-fuel', 'solid-fuel']);
});

test('rocket-fuel: the recipes are the pinned 2.1.25 ones and give the machine counts and the panel figures at 12 a minute', () => {
  const amounts = r => Object.fromEntries([...p.recipes[r].ingredients.map(v => [v.name, -v.amount]), ...p.recipes[r].results.map(v => [v.name, v.amount])]);
  assert.deepEqual(amounts('simple-coal-liquefaction'), { coal: -10, calcite: -2, 'sulfuric-acid': -25, 'heavy-oil': 50 });
  assert.deepEqual(amounts('heavy-oil-cracking'), { water: -30, 'heavy-oil': -40, 'light-oil': 30 });
  assert.deepEqual(amounts('solid-fuel-from-light-oil'), { 'light-oil': -10, 'solid-fuel': 1 });
  assert.deepEqual(amounts('rocket-fuel'), { 'solid-fuel': -10, 'light-oil': -10, 'rocket-fuel': 1 });
  assert.deepEqual(['simple-coal-liquefaction', 'heavy-oil-cracking', 'solid-fuel-from-light-oil', 'rocket-fuel'].map(r => p.recipes[r].energy_required), [5, 2, 1, 15]);
  assert.deepEqual(['oil-refinery', 'chemical-plant', 'assembling-machine-3'].map(n => p.entities[n].crafting_speed), [1, 1, 1.25]);
  const z = sizing(p);
  assert.deepEqual(z.requiredCraftsPerMinute, { 'simple-coal-liquefaction': 35.2, 'heavy-oil-cracking': 44, 'solid-fuel-from-light-oil': 120, 'rocket-fuel': 12 });
  assert.deepEqual(z.perMinute, { coal: 352, calcite: 70.4, 'sulfuric-acid': 880, water: 1320 });
  assert.deepEqual(z.machinesNeeded, { 'simple-coal-liquefaction': 3, 'heavy-oil-cracking': 2, 'solid-fuel-from-light-oil': 2, 'rocket-fuel': 3 });
  const built = r => m.machines.filter(x => x.recipe === r).length;
  // whole machines from the arithmetic, and the one stated spare: a third solid-fuel plant, one for each assembling machine
  assert.deepEqual(Object.fromEntries(Object.keys(z.machinesNeeded).map(r => [r, built(r)])), { ...z.machinesNeeded, 'solid-fuel-from-light-oil': 3 });
  assert.equal(m.machines.length, 11);
  assert.ok(Math.abs(z.cost.coalPerRocketFuel - 352 / 12) < 1e-9);
  assert.deepEqual(p.facts.rocket, { silo: 'rocket-silo', rocketPartsRequired: 50, partRecipe: 'rocket-part', rocketFuelPerPart: 1 });
  assert.deepEqual(z.rocket, { rocketFuelEach: 50, minutesEach: 50 / 12 });
  assert.deepEqual(m.inputPorts.map(x => [x.item, x.perMinute]), [['coal', 352], ['calcite', 71], ['sulfuric-acid', 880], ['water', 1320]]);
  assert.deepEqual(m.sizing, JSON.parse(JSON.stringify({ ...z, laneMerge: m.sizing.laneMerge })));
});

test('rocket-fuel: passes the static audit, port rules included', () => {
  const audit = auditBlueprint(bp, m, p, slots);
  assert.equal(audit.passed, true, JSON.stringify(audit.errors));
  assert.ok(audit.checksTotal >= 40);
  for (const name of ['Every port a recipe uses meets an opening of exactly its own fluid or nothing, and every fluid box of every machine is connected', 'No pipe, pipe-to-ground opening or machine port faces a port the recipe does not use', 'Fluid connections and unused-port tiles equal the manifest', 'The exit belt is two unbranched lines that meet on the exit tile, one from behind and one from the side']) assert.ok(audit.checks.find(c => c.name === name)?.passed, name);
});

test('rocket-fuel: string, manifest and pinned data identify the same exact blueprint', () => {
  assert.equal(sha(code), m.candidateSha256);
  assert.equal(m.prototypeSha256, prototypeSha256);
  assert.equal(m.fluidSlotsSha256, fluidSlotsSha256);
  assert.ok(pins.memberPrototypeSha256 && pins.memberFluidSlotsSha256);
  assert.equal(m.memberPrototypeSha256, pins.memberPrototypeSha256);
  assert.equal(m.memberFluidSlotsSha256, pins.memberFluidSlotsSha256);
  assert.equal(JSON.stringify(decode(encode(bp))), JSON.stringify(bp));
  assert.equal(encodeKeeping(bp, code), code);
  const changed = structuredClone(bp); changed.blueprint.entities[0].position.x += 1;
  assert.notEqual(encodeKeeping(changed, code), code, 'a different blueprint never keeps the committed string');
});

test('rocket-fuel: the generator reproduces the published string, manifest, ports and README from the pinned data', async () => {
  const options = { prototypeSha256, fluidSlotsSha256, ...pins };
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
  assert.equal(ports.candidateSha256, m.candidateSha256);
  const text = await fs.readFile(path.join(dir, 'README.md'), 'utf8');
  assert.ok(text.includes(m.candidateSha256));
  assert.equal(text, readme(d, auditBlueprint(d.blueprint, d.manifest, p, slots), report, p, report), 'README is the generator output');
  assert.equal(JSON.stringify(summarize(report, m)), JSON.stringify(report.measured));
  assert.deepEqual(await readJson(path.join(dir, 'static-audit.json')), JSON.parse(JSON.stringify(auditBlueprint(bp, m, p, slots))));
});

test('rocket-fuel: only the allowed entities, one belt exit, four labelled entrances on the edges, substations only', () => {
  const allowed = ['oil-refinery', 'chemical-plant', 'assembling-machine-3', 'fast-inserter', 'fast-transport-belt', 'pipe', 'pipe-to-ground', 'substation', 'display-panel'];
  assert.deepEqual([...new Set(es.map(e => e.name))].sort(), [...allowed].sort());
  assert.ok(es.every(e => !e.items && !e.quality && !e.override_stack_size && !e.control_behavior && !e.filters));
  assert.ok(es.filter(e => ['oil-refinery', 'chemical-plant', 'assembling-machine-3'].includes(e.name)).every(e => p.recipes[e.recipe]), 'every machine has a fixed recipe saved in the blueprint');
  const env = envelope(es, p);
  assert.deepEqual([env.width, env.height, env.area, es.length], [34, 10, 340, m.footprint.entities]);
  assert.deepEqual([env.bounds.left, env.bounds.top], [0, 0]);
  assert.deepEqual(m.inputPorts.map(x => [x.item, x.kind, x.side, x.tile.x, x.tile.y]), [['coal', 'belt', 'west', 0, 6], ['calcite', 'belt', 'west', 0, 8], ['sulfuric-acid', 'pipe', 'west', 0, 0], ['water', 'pipe', 'north', 21, 0]]);
  assert.deepEqual(m.outputPorts.map(x => [x.item, x.kind, x.side, x.tile.x, x.tile.y, x.perMinute]), [['rocket-fuel', 'belt', 'east', 33, 9, 12]]);
  for (const x of m.inputPorts) assert.equal(byId(x.panel).text, `IN: ${x.item} ${x.perMinute}/min`);
  assert.equal(byId(out.panel).text, 'OUT: rocket-fuel 12/min');
  assert.equal(byId(m.power.panel).text, m.power.label);
  assert.equal(byId(m.power.entry).name, 'substation');
  // the west entrances stand on the same tiles as the coal-to-plastic supply's, so the two line up
  return readJson(path.join(published('coal-plastic-lubricant'), 'manifest.json')).then(sibling => {
    for (const item of ['coal', 'calcite', 'sulfuric-acid']) assert.deepEqual(m.inputPorts.find(x => x.item === item).tile, sibling.inputPorts.find(x => x.item === item).tile, item);
  });
});

test('rocket-fuel: four networks, one fluid each; every used port on its own fluid; no opening in front of an unused port', () => {
  const fl = analyzeFluids(es, slots), rules = portRules(es, slots);
  assert.deepEqual(fl.problems, []);
  assert.deepEqual(fl.components.map(c => c.fluids).sort(), [['heavy-oil'], ['light-oil'], ['sulfuric-acid'], ['water']]);
  assert.deepEqual([rules.wrong, rules.unconnected, rules.faced], [[], [], []]);
  assert.deepEqual(rules.edges, m.fluidEdges);
  assert.deepEqual(rules.unused, m.unusedPorts);
  assert.equal(m.unusedPorts.reduce((n, u) => n + u.tiles.length, 0), 15);
  // every fluid box of every machine: all of its ports stand on the one network of its own fluid
  const networkOf = new Map(); for (const c of fl.components) for (const id of c.entities) networkOf.set(id, c);
  for (const e of es.filter(v => m.machines.some(x => x.entity === v.entity_number))) {
    assert.equal(networkOf.get(e.entity_number) !== undefined, true);
    for (const b of machineBoxes(e, slots)) for (const end of b.ends) {
      const at = es.find(v => Math.floor(v.position.x) === end.target.x && Math.floor(v.position.y) === end.target.y && ['pipe', 'pipe-to-ground'].includes(v.name));
      assert.ok(at, `machine #${e.entity_number} ${b.fluid} port at ${end.target.x},${end.target.y} stands on a pipe`);
      assert.equal(fl.fluidOf.get(at.entity_number), b.fluid);
    }
    // nothing with a fluid box stands in front of a port the recipe does not use
    for (const u of unusedPortTiles(e, slots)) assert.ok(!es.some(v => ['pipe', 'pipe-to-ground', 'oil-refinery', 'chemical-plant', 'assembling-machine-3'].includes(v.name) && Math.abs(v.position.x - (u.target.x + 0.5)) < 0.6 && Math.abs(v.position.y - (u.target.y + 0.5)) < 0.6));
  }
});

test('rocket-fuel: the member port table is the native probe output for every machine, direction and mirroring it can lie in', async () => {
  const own = await readJson(path.join(HERE, ID, 'fluid-slots.json'));
  assert.equal(own.gameVersion, '2.1.25');
  assert.deepEqual(Object.keys(own.slots), ['chemical-plant|solid-fuel-from-light-oil', 'assembling-machine-3|rocket-fuel']);
  assert.equal(Object.keys(own.slots['chemical-plant|solid-fuel-from-light-oil']).length, 8);
  assert.equal(Object.keys(own.slots['assembling-machine-3|rocket-fuel']).length, 4);
  assert.deepEqual(Object.keys(own.unusedPorts).sort(), ['assembling-machine-3|rocket-fuel', 'chemical-plant|heavy-oil-cracking', 'chemical-plant|solid-fuel-from-light-oil', 'oil-refinery|simple-coal-liquefaction']);
  // used and unused tiles together are every port of the machine type, and they never overlap
  for (const [key, table] of Object.entries(own.unusedPorts)) for (const [d, unused] of Object.entries(table)) {
    const used = slots.slots[key][d].flatMap(b => b.targets).map(t => t.join(',')), all = own.ports[key.split('|')[0]][d];
    assert.deepEqual([...used, ...unused.map(t => t.join(','))].sort(), [...all].sort(), `${key} ${d}`);
  }
  assert.deepEqual(own.unusedPorts['chemical-plant|heavy-oil-cracking'].d0, [], 'a cracker uses all four of its ports');
});

test('rocket-fuel: turned three ways and mirrored on each axis the static model keeps the same networks, connections and port rules', () => {
  for (const kind of Object.keys(PLACEMENTS)) {
    const lie = placed(bp, m, p, slots, kind);
    assert.equal(lie.entities.length, es.length);
    if (kind === 'north') { assert.equal(lie.blueprint, null); continue; }
    const rules = portRules(lie.entities, slots);
    assert.deepEqual([rules.wrong, rules.unconnected, rules.faced], [[], [], []], kind);
    assert.deepEqual(rules.edges, m.fluidEdges, kind);
    assert.equal(lie.place.mirrored, kind.startsWith('flip'));
    if (lie.place.mirrored) {
      const mirror = decode(lie.blueprint).blueprint.entities;
      assert.ok(mirror.filter(e => ['oil-refinery', 'chemical-plant'].includes(e.name)).every(e => !!e.mirror !== !!byId(e.entity_number).mirror), 'the mirror flag of every refinery and chemical plant is swapped');
    } else assert.equal(lie.blueprint, null, 'a turned placement builds the published string');
  }
  assert.deepEqual(PLACED.map(k => PLACEMENTS[k] !== undefined), PLACED.map(() => true));
  for (const order of BUILD_ORDERS) assert.deepEqual([...buildOrder(bp, order)].sort((a, b) => a - b), es.map(e => e.entity_number).sort((a, b) => a - b), order);
  const first = name => es.find(e => e.entity_number === buildOrder(bp, name)[0]).name;
  assert.ok(['pipe', 'pipe-to-ground'].includes(first('pipes-first')) && !['pipe', 'pipe-to-ground', 'display-panel', 'fast-inserter', 'fast-transport-belt'].includes(first('machines-first')));
});

test('rocket-fuel: the native report passed every scenario of every group for exactly this string', () => {
  assert.equal(report.passed, true);
  assert.equal(report.exploration, undefined);
  assert.equal(report.blueprintSha256, m.candidateSha256);
  assert.equal(report.prototypeSha256, m.prototypeSha256);
  assert.equal(report.memberPrototypeSha256, m.memberPrototypeSha256);
  assert.equal(report.memberFluidSlotsSha256, m.memberFluidSlotsSha256);
  assert.equal(report.gameVersion, m.requiredGameVersion);
  assert.deepEqual(Object.keys(report.runs), names, 'the scenarios the report ran are the scenarios the code defines now');
  assert.equal(report.scenarioSha256, sha(JSON.stringify(want)));
  assert.deepEqual(report.groups, GROUPS);
  assert.deepEqual(report.technologyClosure, m.technologyClosure);
  assert.equal(status.candidateSha256, m.candidateSha256);
  assert.equal(status.status, 'passed');
  assert.deepEqual(status.scenarios, names);
  for (const [name, run] of Object.entries(report.runs)) {
    assert.equal(run.passed, true, name);
    assert.equal(Object.keys(run.failures).length, 0, 'an empty Lua table is written as {}');
    assert.equal(run.blueprintSha256, m.candidateSha256);
    assert.equal(run.nativeControlSha256, report.nativeControlSha256);
    assert.equal(run.surface.name, 'vulcanus');
    assert.ok(run.checks.length > 100, name);
    assert.ok(run.checks.every(c => c.passed), name);
    assert.equal(run.blueprintEntityCount, es.length);
    assert.equal(run.group, want[name].group); assert.equal(run.length, want[name].length);
    assert.deepEqual(run.phases.map(ph => ph.name), want[name].phases.map(ph => ph.name));
    // fluids: the game's connection list equalled the static one, no opening faced an unused port, and every fluid box was read every
    // four ticks of every phase with no foreign fluid in any reading
    const check = text => run.checks.find(c => c.name === text);
    assert.equal(check('every fluid connection the game made is one of the static model, and none is missing').detail.connections, m.fluidEdges.length, name);
    assert.equal(check('no pipe opening faces a machine port the recipe does not use').detail.unusedPortTiles, 15, name);
    assert.ok(check('the pipes, undergrounds and machine boxes form exactly the static fluid networks, one fluid each'));
    assert.ok(check('only the entrance and exit pipes connect to anything outside the blueprint'));
    for (const ph of run.phases) {
      assert.equal(ph.mixedSeconds, 0, `${name}/${ph.name} held a foreign fluid`);
      assert.equal(ph.fluidReadEveryTicks, FLUID_READ_TICKS);
      assert.equal(ph.fluidReads, Math.round(ph.minutes * 3600 / FLUID_READ_TICKS), `${name}/${ph.name}`);
      assert.equal(Object.keys(ph.foreign).length, 0);
    }
  }
});

test('rocket-fuel: full-length supply protocol, generous and at exactly the panel figures', () => {
  for (const mode of ['generous', 'throttled']) {
    const run = report.runs[mode];
    assert.equal(run.length, 'full');
    assert.deepEqual(run.phases.map(ph => [ph.name, ph.minutes]), [['warm-up', 15], ['steady', 30], ['exit blocked', 30], ['release', 15], ['input outage', 5], ['recovery', 20]]);
    const steady = run.phases[1], blocked = run.phases[2], release = run.phases[3], recovery = run.phases[5];
    assert.equal(steady.measuredMinutes, 30);
    assert.ok(steady.drawnPerMinute[out.id].measured >= FLOOR, mode);
    assert.equal(steady.machines.length, m.machines.length);
    for (const mm of steady.machines) assert.ok(mm.products > 0, mm.role + ' crafted');
    // blocked: nothing leaves, nothing crafts in the last five minutes, no machine is working at the end, the entrances take nothing
    assert.equal(blocked.drawnPerMinute[out.id].phase, 0);
    assert.ok(blocked.machines.every(mm => mm.productsInLastMinutes === 0 && mm.statusAtEnd !== 'working'));
    for (const x of m.inputPorts) assert.equal(blocked[`tailFed_${x.id}`], 0, `${mode}: ${x.item} still taken at the end of the block`);
    assert.ok(release.recovery[out.id].secondsToReach <= 600 && release.drawnPerMinute[out.id].measured >= FLOOR);
    assert.ok(Object.values(run.phases[4].feed).every(v => v === 'none'), 'the outage cuts every input');
    assert.ok(recovery.recovery[out.id].secondsToReach <= 900 && recovery.drawnPerMinute[out.id].measured >= FLOOR);
  }
  const th = report.runs.throttled, steady = th.phases[1];
  for (const x of m.inputPorts) {
    assert.equal(th.phases[0].feed[x.id], x.perMinute, 'the throttled run was offered exactly the panel figure');
    const fed = steady.fedPerMinute[x.id].measured;
    assert.ok(fed <= x.perMinute + 1e-6 && fed >= 0.99 * x.perMinute, `${x.item}: took ${fed}, panel ${x.perMinute}`);
  }
  assert.ok(Object.values(report.runs.generous.phases[1].feed).every(v => v === 'generous'));
  // the published rate is the throttled one; the generous one is the ceiling of three refineries
  assert.equal(m.outputsPerMinute['rocket-fuel'], report.measured.steady.throttled.outputsPerMinute['rocket-fuel']);
  assert.ok(m.outputsPerMinute['rocket-fuel'] >= FLOOR && m.outputsPerMinute['rocket-fuel'] <= 12.05);
  assert.ok(report.measured.steady.generous.outputsPerMinute['rocket-fuel'] <= 12 * 36 / 35.2 + 0.01);
});

test('rocket-fuel: shortened runs reach the rate by themselves and hold it for ten measured minutes', () => {
  const short = names.filter(n => want[n].length === 'shortened');
  assert.equal(short.length, names.length - 2);
  for (const name of short) {
    const run = report.runs[name], reach = run.phases.find(ph => ph.endedBy), hold = run.phases.at(-1);
    assert.equal(reach.endedBy, 'goal', name);
    assert.ok(reach.minutes >= REACH_WINDOW_MINUTES && reach.minutes <= REACH_LIMIT_MINUTES && reach.limitMinutes === REACH_LIMIT_MINUTES);
    // the goal itself: the floor over the last five whole minutes of the reach phase
    const lastFive = reach.perMinute.slice(-REACH_WINDOW_MINUTES).reduce((n, row) => n + (row.drawn[out.id] || 0), 0);
    assert.ok(lastFive >= FLOOR * REACH_WINDOW_MINUTES, name);
    assert.deepEqual([hold.name, hold.minutes, hold.measuredMinutes], ['rate held', HOLD_MINUTES, HOLD_MINUTES]);
    assert.ok(hold.drawnPerMinute[out.id].measured >= FLOOR, `${name}: ${hold.drawnPerMinute[out.id].measured}`);
    for (const mm of hold.machines) assert.ok(mm.products > 0, `${name}: ${mm.role} crafted`);
  }
  // group 2: the input was really withheld for 20 minutes from a cold start, the others at their panel figures, and nothing came out
  for (const x of m.inputPorts) {
    const run = report.runs[`withheld-${x.item}`], first = run.phases[0];
    assert.equal(run.group, 2);
    assert.equal(first.minutes, 20);
    assert.equal(first.feed[x.id], 'none');
    for (const y of m.inputPorts) if (y !== x) assert.equal(first.feed[y.id], y.perMinute);
    assert.equal(first.fedPerMinute[x.id].phase, 0);
    assert.equal(first.drawnPerMinute[out.id].phase, 0);
    assert.equal(run.phases[1].feed[x.id], x.perMinute);
  }
  // group 3: five build orders, power late, each input late, the exit not connected for an hour, bigger hands
  for (const order of BUILD_ORDERS) {
    const run = report.runs[`build-${order}`];
    assert.equal(run.group, 3);
    assert.deepEqual([run.construction.order, run.construction.perStep, run.construction.stepTicks], [order, BUILD.perStep, BUILD.stepTicks]);
    assert.equal(run.construction.finishedAtTick, es.length * BUILD.stepTicks, 'one entity a step, none refused');
    assert.equal(Object.keys(run.construction.deferred).length, 0);
    assert.ok(Object.values(run.phases[0].feed).every(v => v === 'generous'), 'entrances live while it is built');
    assert.ok(run.checks.some(c => c.name.startsWith('no modules #')) && !run.checks.some(c => c.name.startsWith('the blueprint was built completely')));
  }
  assert.deepEqual([report.runs['late-power'].phases[0].power, report.runs['late-power'].phases[0].minutes, report.runs['late-power'].phases[0].drawnPerMinute[out.id].phase], [false, 10, 0]);
  for (const x of m.inputPorts) {
    const first = report.runs[`late-${x.item}`].phases[0];
    assert.deepEqual([first.minutes, first.feed[x.id], first.fedPerMinute[x.id].phase, first.drawnPerMinute[out.id].phase], [5, 'none', 0, 0]);
    if (x.kind === 'pipe') assert.deepEqual(first.absent, [x.id], 'the outside pipe did not exist');
  }
  const idle = report.runs['exit-unconnected'].phases[0];
  assert.deepEqual([idle.minutes, idle.drawnPerMinute[out.id].phase], [60, 0]);
  assert.ok(idle.machines.every(mm => mm.productsInLastMinutes === 0 && mm.statusAtEnd !== 'working'));
  for (const bonus of HAND_BONUSES) assert.ok(report.runs[`hand-size-${1 + bonus}`].checks.find(c => c.name === `inserter capacity bonus is ${bonus} for this force, as the scenario asks`).passed);
  assert.ok(names.filter(n => !n.startsWith('hand-size-')).every(n => report.runs[n].checks.find(c => c.name === 'inserter capacity bonus is zero for this force').passed));
  // group 4: three turns by the game and two mirror images, each with every entity where the placement expects it
  for (const kind of PLACED) {
    const run = report.runs[`place-${kind}`];
    assert.equal(run.group, 4);
    assert.deepEqual([run.place.name, run.place.direction, run.place.mirrored], [kind, kind.startsWith('rot') ? Number(kind.slice(3)) / 90 * 4 : 0, kind.startsWith('flip')]);
    for (const text of ['every ghost lies where the placement under test expects it', 'every entity imported at its exact position, direction, mirroring and type', 'every machine fluid box has exactly the connection tiles of the static model']) assert.ok(run.checks.find(c => c.name === text).passed, `${kind}: ${text}`);
    assert.ok(Object.entries(run.phases[0].feed).every(([id, v]) => v === m.inputPorts.find(x => x.id === id).perMinute));
  }
});

test('rocket-fuel: the index registers it only from its own passing native report', async () => {
  const text = await fs.readFile(new URL('../scripts/index-designed-blueprints.mjs', import.meta.url), 'utf8');
  assert.ok(text.includes(`'rocket-fuel'`) && text.includes('Supplies · Vulcanus') && text.includes('proof.blueprintSha256!==m.candidateSha256'));
  const atlas = await readJson(new URL('../site/sources/designed-blueprints/catalogue-audit.json', import.meta.url)).catch(() => null);
  if (!atlas) return;
  const entry = atlas.entries.find(e => e.blueprintSha256 === m.candidateSha256);
  assert.ok(entry, 'the library lists this exact string');
  assert.deepEqual([entry.section, entry.validation, entry.outputs], ['Supplies · Vulcanus', 'game-tested', ['rocket-fuel']]);
});

const mutate = (name, edit, expected) => test(`rocket-fuel: audit rejects ${name}`, () => {
  const copy = structuredClone(bp);
  edit(copy.blueprint.entities, copy);
  const audit = auditBlueprint(copy, m, p, slots);
  assert.equal(audit.passed, false);
  assert.ok(audit.errors.some(e => e.includes(expected)), JSON.stringify(audit.errors));
});
const add = (list, name, x, y, extra = {}) => list.push({ entity_number: 990 + list.length, name, position: { x: x + 0.5, y: y + 0.5 }, ...extra });
mutate('a pipe in front of an unused refinery output', list => add(list, 'pipe', 2, 6), 'faces a port the recipe does not use');
mutate('a pipe in front of an unused solid-fuel output', list => add(list, 'pipe', 25, 8), 'faces a port the recipe does not use');
mutate('a pipe-to-ground opening onto an unused assembling-machine port', list => add(list, 'pipe-to-ground', 30, 0, { direction: 8 }), 'faces a port the recipe does not use');
mutate('a pipe joining the heavy-oil riser to the light-oil pipe', list => add(list, 'pipe', 17, 4), 'Fluid');
mutate('a pipe joining the acid row to the heavy oil', list => add(list, 'pipe', 16, 0), 'Fluid');
mutate('the west cracker not mirrored (its heavy-oil port would stand on the water)', list => { delete list.find(e => e.recipe === 'heavy-oil-cracking' && e.mirror).mirror; }, 'Machines are exactly');
mutate('a turned assembling machine', list => { const e = list.find(v => v.recipe === 'rocket-fuel'); e.direction = ((e.direction || 0) + 4) % 16; }, 'Machines are exactly');
mutate('a missing light-oil pipe under an assembling machine', list => { list.splice(list.findIndex(e => e.name === 'pipe' && e.position.x === 30.5 && e.position.y === 4.5), 1); }, 'every fluid box of every machine is connected');
mutate('a missing substation', list => { list.splice(list.findIndex(e => e.name === 'substation' && e.entity_number !== m.power.entry), 1); }, 'Substation');
mutate('a reversed entrance belt', list => { const b = list.find(e => e.entity_number === m.inputPorts[0].entity); b.direction = ((b.direction || 0) + 8) % 16; }, 'face inward');
mutate('a turned inserter', list => { const a = list.find(e => /inserter/.test(e.name)); a.direction = ((a.direction || 0) + 8) % 16; }, 'picks up from and drops onto');
mutate('an altered panel text', list => { list.find(e => e.entity_number === m.inputPorts[0].panel).text = 'IN: nothing'; }, 'display panel');
mutate('a machine with another recipe', list => { list.find(e => e.recipe === 'rocket-fuel').recipe = 'carbon'; }, 'Machines are exactly');
mutate('a bulk inserter', list => { list.find(e => /inserter/.test(e.name)).name = 'bulk-inserter'; }, 'entity names');
mutate('a broken exit belt', list => { const b = list.find(e => e.entity_number === m.exitBelt.column[3]); b.direction = 4; }, 'exit belt');

test('rocket-fuel: member pins equal the raw dump (runs only when FACTORIO_RAW is set and readable)', async t => {
  const rawPath = process.env.FACTORIO_RAW;
  if (!rawPath || !(await exists(rawPath))) return t.skip('no FACTORIO_RAW dump');
  const dump = JSON.parse(await fs.readFile(rawPath, 'utf8')), own = await readJson(path.join(HERE, ID, 'prototypes.json'));
  assert.equal(sha(await fs.readFile(rawPath)), own.provenance.rawSha256);
  assert.equal(own.provenance.familyPrototypeSha256, prototypeSha256);
  for (const [name, r] of Object.entries(own.recipes)) {
    assert.deepEqual(r.ingredients, dump.recipe[name].ingredients, name);
    assert.deepEqual(r.results, dump.recipe[name].results, name);
    assert.equal(r.energy_required, dump.recipe[name].energy_required, name);
  }
  for (const [name, i] of Object.entries(own.items)) assert.equal(i.stack_size, dump.item[name].stack_size, name);
  assert.equal(own.facts.rocket.rocketPartsRequired, dump['rocket-silo']['rocket-silo'].rocket_parts_required);
  assert.equal(own.facts.rocket.rocketFuelPerPart, dump.recipe['rocket-part'].ingredients.find(v => v.name === 'rocket-fuel').amount);
});

test('rocket-fuel: the two first members\' blueprint folders are untouched (checked through git when available)', async t => {
  const { execFileSync } = await import('node:child_process');
  let status;
  try { status = execFileSync('git', ['status', '--porcelain', '--', ...IDS.map(id => 'blueprint-sources/vulcanus-supplies/' + id)], { encoding: 'utf8' }); } catch { return t.skip('no git checkout'); }
  assert.equal(status.trim(), '');
});
