// Native qualification of a Vulcanus circuit blueprint (Factorio 2.1.25, Space Age, a Vulcanus surface), headless. Every
// scenario is its own Factorio instance with a private write-data, config and mod directory under .cache/vulcanus-circuits/<id>/
// and its own fresh import of the same blueprint string. Never touches the player's game data, saves or mod profile.
//
//   node scripts/vulcanus-circuits/validate.mjs <id>                    the full protocol (scenario.mjs); writes native-report.json and native-status.json
//   node scripts/vulcanus-circuits/validate.mjs <id> --explore [--scenario a,b] [--source <folder>] [--keep <name>]
//                                                                       exploration: never writes native-report.json
// Instances: at most 10 Factorio processes on the machine (4 while the player's own game runs), counted before every launch;
// about a third of the headless slots while other headless games are running (native.mjs).
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { HERE, PROJECT, published, prototypes, fluidSlots, readJson, json, sha, decode, encode } from './lib.mjs';
import { auditBlueprint } from './audit.mjs';
import { PROTOCOL, scenarios as scenarioList, buildOrder } from './scenario.mjs';
import { summarize } from './summary.mjs';
import { profile, game, gameData, MODS } from './native.mjs';

const args = process.argv.slice(2), id = args[0];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
assert(id && !id.startsWith('--'), 'usage: validate.mjs <id> [--explore] ...');
const explore = args.includes('--explore');
const source = option('--source') ? path.resolve(option('--source')) : published(id);
const [manifest, p, slots] = await Promise.all([readJson(path.join(source, 'manifest.json')), prototypes(), fluidSlots()]);
const code = (await fs.readFile(path.join(source, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code);
assert.equal(sha(code), manifest.candidateSha256, 'manifest does not describe this blueprint string');
assert.equal(sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), manifest.prototypeSha256, 'prototype snapshot mismatch');
assert.equal(sha(await fs.readFile(path.join(HERE, 'fluid-slots.json'))), manifest.fluidSlotsSha256, 'fluid slot table mismatch');
const audit = auditBlueprint(bp, manifest, p, slots);
assert.equal(audit.passed, true, 'Static audit is a prerequisite: ' + JSON.stringify(audit.errors));
if (!explore) assert.deepEqual(manifest.nativeProtocol, JSON.parse(JSON.stringify(PROTOCOL)), 'A full run uses exactly the qualifying protocol');
const all = scenarioList(manifest);
const names = explore && option('--scenario') ? option('--scenario').split(',') : Object.keys(all);
for (const n of names) assert(all[n], 'unknown scenario ' + n);

const versions = {};
for (const name of MODS) { versions[name] = JSON.parse(await fs.readFile(path.join(gameData, name, 'info.json'), 'utf8')).version; assert.equal(versions[name], manifest.requiredGameVersion, `Wrong installed ${name} version`); }
for (const [file, expected] of Object.entries(p.provenance.sourceHashes)) assert.equal(sha(await fs.readFile(path.join(gameData, file))), expected, `Installed game source differs from the prototype snapshot: ${file}`);
const control = await fs.readFile(path.join(HERE, 'control.lua'), 'utf8');
const runnerSha256 = sha(await fs.readFile(new URL(import.meta.url))), nativeControlSha256 = sha(control);
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const root = process.env.VULCANUS_CIRCUITS_RUN_ROOT ? path.resolve(process.env.VULCANUS_CIRCUITS_RUN_ROOT) : path.join(PROJECT, '.cache', 'vulcanus-circuits', id, `native-${stamp}-${process.pid}`);

// ---- the blueprint as it lies when placed turned (the game turns it: build direction) or mirrored (a mirror image is
// written here as its own string: positions and directions mirrored, the mirror flag set on the foundries, whose ports are not
// symmetric; the game has no script call that flips a blueprint)
const TURNS = { rot90: 1, rot180: 2, rot270: 3 };
function placeAs(kind) {
  const k = TURNS[kind] || 0, flip = kind === 'flipH' ? 'h' : kind === 'flipV' ? 'v' : null;
  const zero = v => (v === 0 ? 0 : v);
  const vec = ([x, y]) => { if (flip === 'h') x = -x; if (flip === 'v') y = -y; for (let i = 0; i < k; i++) [x, y] = [-y, x]; return [zero(x), zero(y)]; };
  const pos = ({ x, y }) => { const [a, b] = vec([x, y]); return { x: a, y: b }; };
  const dir = d => { d = d || 0; if (flip === 'h') d = (16 - d) % 16; if (flip === 'v') d = (24 - d) % 16; return (d + 4 * k) % 16; };
  const entities = bp.blueprint.entities.map(e => ({ ...e, position: pos(e.position), direction: dir(e.direction), ...(flip && e.name === 'foundry' ? { mirror: !e.mirror } : {}) }));
  const centre = t => ({ x: t.x + 0.5, y: t.y + 0.5 });
  const port = x => ({ id: x.id, item: x.item, kind: x.kind, entity: x.entity, contact: pos(centre(x.externalContact)), approach: x.approach.map(t => pos(centre(t))) });
  const OUT = { west: 12, east: 4, north: 0, south: 8 };
  const pole = manifest.power.externalPole;
  const M = {
    surface: manifest.surface, product: manifest.product, target: manifest.target,
    inputs: manifest.inputPorts.map(port),
    outputs: manifest.outputPorts.map(x => ({ ...port(x), product: !!x.product, sinkDirection: dir(OUT[x.side]) })),
    power: { entry: manifest.power.entry, externalPole: pos(pole), externalSource: pos({ x: pole.x - 3, y: pole.y }) },
    machines: manifest.machines.map(v => ({ entity: v.entity, recipe: v.recipe, role: v.role, group: v.group })),
    machineBoxes: Object.fromEntries(Object.entries(manifest.machineBoxes).map(([n, boxes]) => [n, boxes.map(b => ({ fluid: b.fluid, flow: b.flow, targets: b.targets.map(vec) }))])),
    fluidOf: manifest.fluidOf, fluidComponents: manifest.fluidComponents.map(c => ({ id: c.id, fluid: c.fluid, entities: c.entities })),
    beltLines: manifest.beltLines, routes: manifest.routes.map(r => ({ inserter: r.inserter, hand: r.hand, filter: r.filter, from: r.from, to: r.to })),
  };
  const w = manifest.footprint.width / 2, h = manifest.footprint.height / 2;
  const blueprint = flip ? encode({ blueprint: { ...bp.blueprint, entities: entities.map(({ direction, ...e }) => (direction ? { ...e, direction } : e)) } }) : code;
  return { entities, M, blueprint, half: k % 2 ? { x: h, y: w } : { x: w, y: h }, ...(kind ? { place: { name: kind, direction: 4 * k, mirrored: !!flip, blueprintSha256: sha(blueprint) } } : {}) };
}
const recipes = [...new Set(manifest.machines.map(v => v.recipe))];
const tracked = [...new Set(recipes.flatMap(n => [...p.recipes[n].ingredients, ...p.recipes[n].results]).map(v => v.type + ':' + v.name))];

async function run(name) {
  const sc = all[name], placed = placeAs(sc.place), work = path.join(root, name.replace(':', '-'));
  const construction = sc.build ? { name: sc.build, order: buildOrder(sc.build, bp.blueprint.entities, manifest), perStep: PROTOCOL.buildPerStep, stepTicks: PROTOCOL.buildStepTicks } : null;
  const configuration = {
    schema: 1, scenarioName: name, blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, nativeControlSha256, runnerSha256,
    gameVersion: manifest.requiredGameVersion, activeMods: versions, blueprint: placed.blueprint, entities: placed.entities, manifest: placed.M, half: placed.half,
    anchor: bp.blueprint.entities.findIndex(e => e.entity_number === manifest.power.entry) + 1, technologyClosure: manifest.technologyClosure,
    ...(placed.place ? { place: placed.place } : {}), ...(construction ? { build: construction } : {}), ...(sc.bonus ? { bonus: sc.bonus } : {}),
    recipePrototypes: Object.fromEntries(recipes.map(n => [n, { ingredients: p.recipes[n].ingredients, results: p.recipes[n].results, energy: p.recipes[n].energy_required }])),
    machineSpeed: Object.fromEntries(['foundry', 'assembling-machine-3'].map(n => [n, p.entities[n].crafting_speed])),
    machineProductivity: Object.fromEntries(['foundry', 'assembling-machine-3'].map(n => [n, p.entities[n].effect_receiver?.base_effect?.productivity || 0])),
    trackedItems: tracked.filter(v => v.startsWith('item:')).map(v => v.slice(5)), trackedFluids: tracked.filter(v => v.startsWith('fluid:')).map(v => v.slice(6)),
    fluidTemperature: Object.fromEntries(Object.values(p.fluids).map(f => [f.name, f.default_temperature])), planet: p.planets.vulcanus.surface_properties,
    protocol: PROTOCOL, scenario: { description: sc.description, length: sc.length, phases: sc.phases },
    // self-test of the fluid watch, exploration only: --sabotage <network fluid>,<foreign fluid>[,<tick>]
    ...(explore && option('--sabotage') ? { sabotage: { network: option('--sabotage').split(',')[0], fluid: option('--sabotage').split(',')[1], tick: Number(option('--sabotage').split(',')[2] || 7200) } } : {}),
  };
  configuration.configurationSha256 = sha(JSON.stringify(configuration));
  const span = Math.max(manifest.footprint.width, manifest.footprint.height) + 64;
  const prof = await profile(work, 'vulcanus-circuits-validation', control, configuration, { width: Math.ceil(span / 32) * 32 + 64, height: Math.ceil(span / 32) * 32 + 64 });
  const timings = {};
  await game(work, prof.mods, ['--create', prof.save, '--map-gen-settings', prof.mapSettings], 'create', timings);
  const buildTicks = construction ? Math.ceil(construction.order.filter(v => v > 0).length / construction.perStep + 20) * construction.stepTicks + construction.order.filter(v => v < 0).reduce((n, v) => n - v, 0) : 0;
  const ticks = sc.phases.reduce((n, ph) => n + (ph.mode === 'ticks' ? ph.ticks : ph.limit), 0) + buildTicks + 120;
  const output = await game(work, prof.mods, ['--benchmark', prof.save, '--benchmark-ticks', String(ticks), '--benchmark-runs', '1'], 'benchmark', timings);
  await fs.rm(prof.save, { force: true });
  const report = JSON.parse(await fs.readFile(path.join(work, 'script-output/vulcanus-circuits/native-report.json'), 'utf8'));
  for (const k of ['failures', 'fluidFaults', 'portJoins', 'lineFaults']) if (!Array.isArray(report[k])) report[k] = [];   // an empty Lua table arrives as {}
  assert.equal(report.blueprintSha256, configuration.blueprintSha256);
  assert.equal(report.configurationSha256, configuration.configurationSha256);
  assert.equal(report.gameVersion, configuration.gameVersion);
  report.wallSeconds = timings.benchmark; report.createSeconds = timings.create; report.benchmarkTicks = ticks;
  // the report is written at the last phase; the wall time up to then, from the game's own clock in the log
  const done = /^\s*([\d.]+) Script .*VULCANUS_CIRCUITS_RESULT/m.exec(output), first = /^\s*([\d.]+) Script .*VULCANUS_CIRCUITS_START/m.exec(output);
  if (done && first) { report.activeWallSeconds = Number(done[1]) - Number(first[1]); report.timesRealTime = Math.round(report.actualTicks / 60 / Math.max(report.activeWallSeconds, 0.001)); }
  await fs.writeFile(path.join(work, 'native-report.json'), json(report));
  if (!args.includes('--keep-runs')) await fs.rm(path.join(work, 'mods'), { recursive: true, force: true });
  return report;
}
const started = Date.now();
const reports = Object.fromEntries(await Promise.all(names.map(async name => {
  // an exploration keeps the other scenarios when one instance stops with an error; a qualifying run does not
  const r = await run(name).catch(e => { if (!explore) throw e; return { passed: false, failures: ['the instance stopped: ' + String(e.message).split('\n').slice(0, 6).join(' | ').slice(0, 900)], phases: [], fluidFaults: [], portJoins: [], lineFaults: [], crashed: true, actualTicks: 0 }; });
  const product = manifest.outputPorts.find(o => o.product).id, stone = manifest.outputPorts.find(o => o.byproduct).id;
  console.log(JSON.stringify({ scenario: name, passed: r.passed, failures: r.failures, gameMinutes: Math.round(r.actualTicks / 360) / 10, wall: r.activeWallSeconds, xRealTime: r.timesRealTime, construction: r.construction,
    phases: r.phases.map(ph => ({ name: ph.name, min: Math.round(ph.ticks / 360) / 10, by: ph.endedBy, product: Math.round(ph.drawnPerMinute[product].measured * 10) / 10, stone: Math.round(ph.drawnPerMinute[stone].measured * 10) / 10, fed: Object.fromEntries(Object.entries(ph.fedPerMinute).map(([k, v]) => [k, Math.round(v.measured * 10) / 10])), groups: Object.fromEntries(Object.entries(ph.groups).map(([g, v]) => [g, Math.round(v.craftsPerMinute * 10) / 10])) })),
    fluidFaults: r.fluidFaults, portJoins: r.portJoins, lineFaults: r.lineFaults }));
  return [name, r];
})));
const complete = names.length === Object.keys(all).length;
const passed = names.every(n => reports[n].passed === true) && (explore || complete);
const merged = {
  schema: 1, passed, ...(explore ? { exploration: true } : {}), blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, fluidSlotsSha256: manifest.fluidSlotsSha256,
  gameVersion: versions.base, activeMods: versions, surface: manifest.surface, runnerSha256, nativeControlSha256, scenarioSha256: sha(JSON.stringify(Object.fromEntries(names.map(n => [n, all[n]])))),
  nativeCommand: 'node scripts/vulcanus-circuits/validate.mjs ' + args.filter(a => a !== '--keep-runs').join(' '), protocol: PROTOCOL, technologyClosure: manifest.technologyClosure, footprint: manifest.footprint,
  failures: names.flatMap(n => reports[n].failures.map(f => `${n}: ${f}`)), wallSecondsTotal: (Date.now() - started) / 1000,
  scenarios: Object.fromEntries(names.map(n => [n, reports[n]])),
};
merged.measured = summarize(merged.scenarios, manifest);
await fs.mkdir(root, { recursive: true });
await fs.writeFile(path.join(root, 'native-report.json'), json(merged));
if (!explore) {
  assert(names.every(n => reports[n].blueprintSha256 === manifest.candidateSha256), 'every scenario ran the same blueprint string');
  await fs.writeFile(path.join(source, 'native-report.json'), json(merged));
  await fs.writeFile(path.join(source, 'native-status.json'), json({ candidateSha256: manifest.candidateSha256, gameVersion: versions.base, status: passed ? 'passed' : 'failed', nativeProductionValidated: passed, report: 'native-report.json',
    scenarios: Object.fromEntries(names.map(n => [n, { passed: reports[n].passed, length: reports[n].length, configurationSha256: reports[n].configurationSha256, simulatedTicks: reports[n].actualTicks, activeWallSeconds: reports[n].activeWallSeconds }])),
    safety: 'One fresh private write-data, config, mod directory, force, Vulcanus surface and save per scenario. Only the declared entrances, a belt beyond each declared exit and outside power are supplied.' }));
} else if (option('--keep')) await fs.writeFile(path.join(source, `exploration-${option('--keep')}-report.json`), json(merged));
console.log(JSON.stringify({ passed, exploration: explore, wallSeconds: merged.wallSecondsTotal, measured: { generous: merged.measured.generous && { product: merged.measured.generous.productPerMinute, stone: merged.measured.generous.stonePerMinute, draw: merged.measured.generous.drawPerMinute }, throttled: merged.measured.throttled && { product: merged.measured.throttled.productPerMinute, stone: merged.measured.throttled.stonePerMinute, draw: merged.measured.throttled.drawPerMinute } }, run: path.relative(PROJECT, root) }));
if (!passed) process.exitCode = 1;
