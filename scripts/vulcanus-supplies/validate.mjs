// Native qualification of a Vulcanus supply blueprint (Factorio 2.1.25, Space Age), headless, in a private profile under
// .cache/vulcanus-supplies/<id>/. Never touches the player's game data, saves or mod profile.
//
//   node scripts/vulcanus-supplies/validate.mjs <id>                       the full protocol: every scenario of <id>/scenario.mjs; writes native-report.json and native-status.json
//   node scripts/vulcanus-supplies/validate.mjs <id> --explore [--source <folder>] [--modes throttled] [--scenario <module>] [--keep name]
//                                                                           exploration: never writes native-report.json; --keep stores exploration-<name>-report.json beside the blueprint
// The game is run once per scenario, side by side as far as the machine's instance budget allows (see instances.mjs); each run is a
// fresh save, force, surface and mod directory, with one update thread.
// A scenario may ask for the blueprint to be built piece by piece (build) or placed turned or mirrored (place); see placement.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { HERE, PROJECT, PROTOCOL, published, prototypes, fluidSlots, memberPins, readJson, json, sha, decode } from './lib.mjs';
import { auditBlueprint } from './audit.mjs';
import { summarize } from './summary.mjs';
import { placed, buildOrder } from './placement.mjs';
import { GAME_DATA, BINARY, profile, game } from './instances.mjs';

const args = process.argv.slice(2);
const id = args[0];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
assert(id && !id.startsWith('--'), 'usage: validate.mjs <id> [--explore] ...');
const explore = args.includes('--explore');
const source = option('--source') ? path.resolve(option('--source')) : published(id);
const [manifest, p, slots] = await Promise.all([readJson(path.join(source, 'manifest.json')), prototypes(id), fluidSlots(id)]);
const code = (await fs.readFile(path.join(source, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code);
assert.equal(sha(code), manifest.candidateSha256, 'manifest does not describe this blueprint string');
assert.equal(sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), manifest.prototypeSha256, 'prototype snapshot mismatch');
assert.equal(sha(await fs.readFile(path.join(HERE, 'fluid-slots.json'))), manifest.fluidSlotsSha256, 'fluid slot table mismatch');
for (const [key, value] of Object.entries(await memberPins(id))) assert.equal(manifest[key], value, 'member pin mismatch: ' + key);
const audit = auditBlueprint(bp, manifest, p, slots);
assert.equal(audit.passed, true, 'Static audit is a prerequisite: ' + JSON.stringify(audit.errors));

const scenarioModule = await import(path.join(HERE, option('--scenario') || `${id}/scenario.mjs`));
let scenarios = scenarioModule.scenarios(manifest);
const modes = option('--modes') ? option('--modes').split(',') : Object.keys(scenarios);
for (const m of modes) assert(scenarios[m], 'unknown scenario ' + m);

await fs.access(BINARY, fs.constants.X_OK);
const versions = {};
for (const name of Object.keys(p.activeMods)) {
  versions[name] = JSON.parse(await fs.readFile(path.join(GAME_DATA, name, 'info.json'), 'utf8')).version;
  assert.equal(versions[name], manifest.requiredGameVersion, `Wrong installed ${name} version`);
}
for (const [file, expected] of Object.entries(p.provenance.sourceHashes)) assert.equal(sha(await fs.readFile(path.join(GAME_DATA, file))), expected, `Installed game source differs from the prototype snapshot: ${file}`);

const control = await fs.readFile(path.join(HERE, 'control.lua'), 'utf8');
const closure = manifest.technologyClosure;
const recipes = [...new Set(manifest.machines.map(m => m.recipe))];
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const root = process.env.VULCANUS_RUN_ROOT ? path.resolve(process.env.VULCANUS_RUN_ROOT) : path.join(PROJECT, '.cache', 'vulcanus-supplies', id, `native-${stamp}-${process.pid}`);
const runnerSha256 = sha(await fs.readFile(new URL(import.meta.url)));
const nativeControlSha256 = sha(control);

async function runMode(mode) {
  const { build, place, group, length, ...scenario } = scenarios[mode];
  const work = path.join(root, mode), mods = path.join(work, 'mods'), mod = path.join(mods, 'vulcanus-supply-validation');
  await profile(work, mods);
  await fs.mkdir(mod, { recursive: true });
  const lie = placed(bp, manifest, p, slots, place || 'north');
  const endsEarly = scenario.phases.some(ph => ph.endWhen);
  const configuration = {
    schema: 1, blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, nativeControlSha256, runnerSha256,
    gameVersion: manifest.requiredGameVersion, activeMods: versions, blueprint: lie.blueprint || code, entities: lie.entities, manifest: lie.fixture,
    technologyClosure: closure,
    recipePrototypes: Object.fromEntries(recipes.map(n => [n, { ingredients: p.recipes[n].ingredients, results: p.recipes[n].results, energy: p.recipes[n].energy_required ?? 0.5 }])),
    machineSpeed: Object.fromEntries(['oil-refinery', 'chemical-plant', 'assembling-machine-3'].map(n => [n, p.entities[n].crafting_speed])),
    fluids: p.fluids, protocol: PROTOCOL, scenario: { ...scenario, ...(endsEarly ? { endsEarly: true } : {}) },
    ...(build ? { build: { name: build.order, order: buildOrder(bp, build.order), perStep: build.perStep, stepTicks: build.stepTicks } } : {}),
    ...(lie.place ? { place: lie.place } : {}),
  };
  configuration.configurationSha256 = sha(JSON.stringify(configuration));
  await fs.writeFile(path.join(mod, 'fixture.lua'), `return helpers.json_to_table([====[${JSON.stringify(configuration)}]====])\n`);
  await fs.writeFile(path.join(mod, 'control.lua'), control);
  await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'vulcanus-supply-validation', version: '1.0.0', title: 'Isolated Vulcanus supply validation', author: 'local', factorio_version: '2.1', dependencies: Object.entries(versions).map(([name, version]) => `${name} = ${version}`) }));
  await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...Object.keys(versions), 'vulcanus-supply-validation'].map(name => ({ name, enabled: true })) }));
  await fs.writeFile(path.join(work, 'map-gen-settings.json'), JSON.stringify({ seed: PROTOCOL.seed, width: 32, height: 32, peaceful_mode: true }));
  const timings = {};
  const save = path.join(work, 'isolated.zip');
  await game(work, mods, ['--create', save, '--map-gen-settings', path.join(work, 'map-gen-settings.json')], 'create', timings);
  const ticks = scenario.phases.reduce((n, ph) => n + ph.ticks, 0);
  const output = await game(work, mods, ['--benchmark', save, '--benchmark-ticks', String(ticks + 1), '--benchmark-runs', '1'], 'benchmark', timings);
  await fs.rm(save, { force: true });
  const report = JSON.parse(await fs.readFile(path.join(work, 'script-output/vulcanus-supplies/native-report.json'), 'utf8'));
  assert.equal(report.blueprintSha256, configuration.blueprintSha256);
  assert.equal(report.configurationSha256, configuration.configurationSha256);
  assert.equal(report.prototypeSha256, configuration.prototypeSha256);
  assert.equal(report.gameVersion, configuration.gameVersion);
  if (endsEarly) assert(report.actualTicks <= ticks, 'a goal-ended run is never longer than its limits'); else assert.equal(report.actualTicks, ticks);
  report.elapsedSeconds = timings;
  if (group !== undefined) { report.group = group; report.length = length; report.simulatedMinutes = Math.round(report.actualTicks / 360) / 10; }
  // the wall time of the simulated part, from the game's own clock in the log
  const first = /^\s*([\d.]+) Script .*VULCANUS_SUPPLY_START/m.exec(output), done = /^\s*([\d.]+) Script .*VULCANUS_SUPPLY_RESULT/m.exec(output);
  if (first && done) { report.activeWallSeconds = Math.round((Number(done[1]) - Number(first[1])) * 1000) / 1000; report.updatesPerSecond = Math.round(report.actualTicks / Math.max(report.activeWallSeconds, 0.001)); }
  if (explore) console.error(JSON.stringify({ scenario: mode, passed: report.passed, failures: report.failures, simulatedMinutes: Math.round(report.actualTicks / 360) / 10, wall: report.activeWallSeconds, ups: report.updatesPerSecond, phases: report.phases.map(ph => `${ph.name}: ${Math.round(ph.minutes * 10) / 10} min${ph.endedBy ? ' (' + ph.endedBy + ')' : ''}, out ${Object.values(ph.drawnPerMinute).map(v => Math.round(v.measured * 100) / 100).join('/')}, foreign ${ph.mixedSeconds}`) }));
  return report;
}

const started = Date.now();
const reports = Object.fromEntries(await Promise.all(modes.map(async m => [m, await runMode(m)])));
const passed = Object.values(reports).every(r => r.passed === true) && modes.length === Object.keys(scenarios).length;
const first = Object.values(reports)[0];
const combined = {
  schema: 2, passed, exploration: explore || undefined, failures: Object.fromEntries(Object.entries(reports).map(([m, r]) => [m, r.failures])),
  blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, fluidSlotsSha256: manifest.fluidSlotsSha256,
  ...(manifest.memberPrototypeSha256 ? { memberPrototypeSha256: manifest.memberPrototypeSha256, memberFluidSlotsSha256: manifest.memberFluidSlotsSha256 } : {}),
  gameVersion: first.gameVersion, activeMods: first.activeMods, nativeControlSha256, runnerSha256, scenarioSha256: sha(JSON.stringify(Object.fromEntries(modes.map(m => [m, scenarios[m]])))),
  nativeCommand: 'node scripts/vulcanus-supplies/validate.mjs ' + args.join(' '), protocol: PROTOCOL, technologyClosure: closure,
  footprint: manifest.footprint, ...(scenarioModule.GROUPS ? { groups: scenarioModule.GROUPS, wallSecondsTotal: Math.round((Date.now() - started) / 100) / 10 } : {}), runs: reports,
};
combined.measured = summarize(combined, manifest);
await fs.mkdir(root, { recursive: true });
await fs.writeFile(path.join(root, 'native-report.json'), json(combined));
if (!explore) {
  await fs.writeFile(path.join(source, 'native-report.json'), json(combined));
  await fs.writeFile(path.join(source, 'native-status.json'), json({ candidateSha256: combined.blueprintSha256, gameVersion: combined.gameVersion, status: passed ? 'passed' : 'failed', nativeProductionValidated: passed, report: 'native-report.json', safety: 'Fresh private write-data, config, mod directory, force, Vulcanus surface and save for every scenario. Only the declared entrances, the declared exits and external power are touched.', scenarios: modes }));
} else if (option('--keep')) await fs.writeFile(path.join(source, `exploration-${option('--keep')}-report.json`), json(combined));
console.log(JSON.stringify({ passed, exploration: explore, blueprintSha256: combined.blueprintSha256, failures: Object.fromEntries(Object.entries(combined.failures).filter(([, f]) => Object.keys(f).length)), steady: combined.measured.steady, wallSeconds: (Date.now() - started) / 1000, run: path.relative(PROJECT, root) }, null, 2));
if (!passed) process.exitCode = 1;
