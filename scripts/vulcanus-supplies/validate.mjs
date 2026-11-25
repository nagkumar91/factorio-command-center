// Native qualification of a Vulcanus supply blueprint (Factorio 2.1.25, Space Age), headless, in a private profile under
// .cache/vulcanus-supplies/<id>/. Never touches the player's game data, saves or mod profile.
//
//   node scripts/vulcanus-supplies/validate.mjs <id>                       the full protocol: every scenario of <id>/scenario.mjs; writes native-report.json and native-status.json
//   node scripts/vulcanus-supplies/validate.mjs <id> --explore [--source <folder>] [--modes throttled] [--scenario <module>] [--keep name]
//                                                                           exploration: never writes native-report.json; --keep stores exploration-<name>-report.json beside the blueprint
// The game is run once per scenario, in parallel; each run is a fresh save, force, surface and mod directory.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { HERE, PROJECT, PROTOCOL, published, prototypes, fluidSlots, readJson, json, sha, decode, technologyClosure } from './lib.mjs';
import { fixtureOf } from './package.mjs';
import { auditBlueprint } from './audit.mjs';
import { summarize } from './summary.mjs';

const args = process.argv.slice(2);
const id = args[0];
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

const scenarioModule = await import(path.join(HERE, option('--scenario') || `${id}/scenario.mjs`));
let scenarios = scenarioModule.scenarios(manifest);
const modes = option('--modes') ? option('--modes').split(',') : Object.keys(scenarios);
for (const m of modes) assert(scenarios[m], 'unknown scenario ' + m);

const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const data = path.join(app, 'Contents/data'), binary = path.join(app, 'Contents/MacOS/factorio');
await fs.access(binary, fs.constants.X_OK);
const versions = {};
for (const name of Object.keys(p.activeMods)) {
  versions[name] = JSON.parse(await fs.readFile(path.join(data, name, 'info.json'), 'utf8')).version;
  assert.equal(versions[name], manifest.requiredGameVersion, `Wrong installed ${name} version`);
}
for (const [file, expected] of Object.entries(p.provenance.sourceHashes)) assert.equal(sha(await fs.readFile(path.join(data, file))), expected, `Installed game source differs from the prototype snapshot: ${file}`);

const control = await fs.readFile(path.join(HERE, 'control.lua'), 'utf8');
const closure = manifest.technologyClosure;
const recipes = [...new Set(manifest.machines.map(m => m.recipe))];
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const root = process.env.VULCANUS_RUN_ROOT ? path.resolve(process.env.VULCANUS_RUN_ROOT) : path.join(PROJECT, '.cache', 'vulcanus-supplies', id, `native-${stamp}-${process.pid}`);
const runnerSha256 = sha(await fs.readFile(new URL(import.meta.url)));
const nativeControlSha256 = sha(control);

async function runMode(mode) {
  const scenario = scenarios[mode];
  const work = path.join(root, mode), mods = path.join(work, 'mods'), mod = path.join(mods, 'vulcanus-supply-validation');
  await fs.mkdir(mod, { recursive: true });
  const configuration = {
    schema: 1, blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, nativeControlSha256, runnerSha256,
    gameVersion: manifest.requiredGameVersion, activeMods: versions, blueprint: code, entities: bp.blueprint.entities, manifest: fixtureOf(manifest, bp, p),
    technologyClosure: closure,
    recipePrototypes: Object.fromEntries(recipes.map(n => [n, { ingredients: p.recipes[n].ingredients, results: p.recipes[n].results, energy: p.recipes[n].energy_required ?? 0.5 }])),
    machineSpeed: Object.fromEntries(['oil-refinery', 'chemical-plant', 'assembling-machine-3'].map(n => [n, p.entities[n].crafting_speed])),
    fluids: p.fluids, protocol: PROTOCOL, scenario,
  };
  configuration.configurationSha256 = sha(JSON.stringify(configuration));
  await fs.writeFile(path.join(mod, 'fixture.lua'), `return helpers.json_to_table([====[${JSON.stringify(configuration)}]====])\n`);
  await fs.writeFile(path.join(mod, 'control.lua'), control);
  await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'vulcanus-supply-validation', version: '1.0.0', title: 'Isolated Vulcanus supply validation', author: 'local', factorio_version: '2.1', dependencies: Object.entries(versions).map(([name, version]) => `${name} = ${version}`) }));
  await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...Object.keys(versions), 'vulcanus-supply-validation'].map(name => ({ name, enabled: true })) }));
  await fs.writeFile(path.join(work, 'config.ini'), `[path]\nread-data=${data}\nwrite-data=${work}\n[other]\ncheck-updates=false\nautosave-interval=0\n`);
  await fs.writeFile(path.join(work, 'map-gen-settings.json'), JSON.stringify({ seed: PROTOCOL.seed, width: 32, height: 32, peaceful_mode: true }));
  const timings = [];
  async function game(gameArgs, label) {
    const start = Date.now(); let output = '';
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(binary, ['--config', path.join(work, 'config.ini'), '--mod-directory', mods, ...gameArgs], { cwd: work });
      // Polite on a shared machine: background priority for the headless run only.
      if (process.platform === 'darwin' && child.pid) execFile('/usr/bin/taskpolicy', ['-B', '-p', String(child.pid)], () => {});
      child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
      child.on('error', reject); child.on('close', resolve);
    });
    await fs.writeFile(path.join(work, label + '.log'), output);
    timings.push({ label, exitCode, elapsedSeconds: (Date.now() - start) / 1000 });
    assert.equal(exitCode, 0, `${mode} ${label} failed; see ${path.join(work, label + '.log')}\n${output.slice(-2500)}`);
  }
  const save = path.join(work, 'isolated.zip');
  await game(['--create', save, '--map-gen-settings', path.join(work, 'map-gen-settings.json')], 'create');
  const ticks = scenario.phases.reduce((n, ph) => n + ph.ticks, 0);
  await game(['--benchmark', save, '--benchmark-ticks', String(ticks + 1), '--benchmark-runs', '1'], 'benchmark');
  const report = JSON.parse(await fs.readFile(path.join(work, 'script-output/vulcanus-supplies/native-report.json'), 'utf8'));
  assert.equal(report.blueprintSha256, configuration.blueprintSha256);
  assert.equal(report.configurationSha256, configuration.configurationSha256);
  assert.equal(report.prototypeSha256, configuration.prototypeSha256);
  assert.equal(report.gameVersion, configuration.gameVersion);
  assert.equal(report.actualTicks, ticks);
  report.elapsedSeconds = Object.fromEntries(timings.map(t => [t.label, t.elapsedSeconds]));
  await fs.rm(save, { force: true });
  return report;
}

const reports = Object.fromEntries(await Promise.all(modes.map(async m => [m, await runMode(m)])));
const passed = Object.values(reports).every(r => r.passed === true) && modes.length === Object.keys(scenarios).length;
const first = Object.values(reports)[0];
const combined = {
  schema: 2, passed, exploration: explore || undefined, failures: Object.fromEntries(Object.entries(reports).map(([m, r]) => [m, r.failures])),
  blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, fluidSlotsSha256: manifest.fluidSlotsSha256,
  gameVersion: first.gameVersion, activeMods: first.activeMods, nativeControlSha256, runnerSha256, scenarioSha256: sha(JSON.stringify(Object.fromEntries(modes.map(m => [m, scenarios[m]])))),
  nativeCommand: 'node scripts/vulcanus-supplies/validate.mjs ' + args.join(' '), protocol: PROTOCOL, technologyClosure: closure,
  footprint: manifest.footprint, runs: reports,
};
combined.measured = summarize(combined, manifest);
await fs.mkdir(root, { recursive: true });
await fs.writeFile(path.join(root, 'native-report.json'), json(combined));
if (!explore) {
  await fs.writeFile(path.join(source, 'native-report.json'), json(combined));
  await fs.writeFile(path.join(source, 'native-status.json'), json({ candidateSha256: combined.blueprintSha256, gameVersion: combined.gameVersion, status: passed ? 'passed' : 'failed', nativeProductionValidated: passed, report: 'native-report.json', safety: 'Fresh private write-data, config, mod directory, force, Vulcanus surface and save for every scenario. Only the declared entrances, the declared exits and external power are touched.', scenarios: modes }));
} else if (option('--keep')) await fs.writeFile(path.join(source, `exploration-${option('--keep')}-report.json`), json(combined));
console.log(JSON.stringify({ passed, exploration: explore, blueprintSha256: combined.blueprintSha256, failures: combined.failures, measured: combined.measured, run: path.relative(PROJECT, root) }, null, 2));
if (!passed) process.exitCode = 1;
