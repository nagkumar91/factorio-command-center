// Native qualification of the express belt mall (Factorio 2.1.24, Space Age), headless, in a private
// profile under .cache/express-belt-mall/. Never touches the player's game data, saves or mod profile.
//
// Full protocol:  node scripts/requested-malls/express-belt-mall/validate.mjs
//   fill from empty, collect, refill, collect, five-minute input outage, recovery, then the rate phase
//   (15 min warm-up, 30 min measured, all three chests emptied every second). Lengths: PROTOCOL in lib.mjs.
//   Writes native-report.json and native-status.json next to the blueprint.
// Exploration:    node scripts/requested-malls/express-belt-mall/validate.mjs --explore [--source <folder>]
//                   [--ticks stockFillTicks=216000,measureTicks=18000] [--withhold plastic-bar=216000] [--keep hold] [--skip-audit]
//   Exploration never writes native-report.json. --keep <name> stores its report beside the blueprint as
//   exploration-<name>-report.json (the run's own output, never edited). --withhold <item>=<tick> leaves that
//   input unsupplied (lubricant included) until that tick.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { HERE, PROJECT, PUBLISHED, ID, PROTOCOL, prototypes, readJson, json, sha, decode, technologyClosure } from './lib.mjs';
import { auditBlueprint } from './audit.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const explore = args.includes('--explore');
const source = option('--source') ? path.resolve(option('--source')) : PUBLISHED;
const [manifest, p] = await Promise.all([readJson(path.join(source, 'manifest.json')), prototypes()]);
const code = (await fs.readFile(path.join(source, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code);
assert.equal(sha(code), manifest.candidateSha256, 'manifest does not describe this blueprint string');
assert.equal(sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), manifest.prototypeSha256, 'prototype snapshot mismatch');
const audit = auditBlueprint(bp, manifest, p);
if (!(explore && args.includes('--skip-audit'))) assert.equal(audit.passed, true, 'Static audit is a prerequisite: ' + JSON.stringify(audit.errors));

const protocol = { ...PROTOCOL };
if (explore && option('--ticks')) for (const pair of option('--ticks').split(',')) { const [k, v] = pair.split('='); assert(k in protocol && Number.isFinite(Number(v)), 'unknown protocol field ' + k); protocol[k] = Number(v); }
if (!explore) assert.deepEqual(manifest.nativeProtocol, { ...PROTOCOL }, 'A full run uses exactly the qualifying protocol');

const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const data = path.join(app, 'Contents/data'), binary = path.join(app, 'Contents/MacOS/factorio');
await fs.access(binary, fs.constants.X_OK);
const versions = {};
for (const name of ['base', 'quality', 'elevated-rails', 'space-age']) {
  versions[name] = JSON.parse(await fs.readFile(path.join(data, name, 'info.json'), 'utf8')).version;
  assert.equal(versions[name], manifest.requiredGameVersion, `Wrong installed ${name} version`);
}
for (const [file, expected] of Object.entries(p.provenance.sourceHashes)) assert.equal(sha(await fs.readFile(path.join(data, file))), expected, `Installed game source differs from the prototype snapshot: ${file}`);

const control = await fs.readFile(path.join(HERE, 'control.lua'), 'utf8');
const closure = manifest.technologyClosure || technologyClosure(p, manifest.products, [...new Set(bp.blueprint.entities.map(e => e.name))]).closure;
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const work = process.env.EXPRESS_RUN_ROOT ? path.resolve(process.env.EXPRESS_RUN_ROOT) : path.join(PROJECT, '.cache', ID, `native-${stamp}-${process.pid}`), mods = path.join(work, 'mods'), mod = path.join(mods, 'express-belt-mall-validation');
await fs.mkdir(mod, { recursive: true });
const recipes = [...new Set(manifest.cells.map(c => c.recipe))];
const configuration = {
  schema: 1, blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256,
  nativeControlSha256: sha(control), runnerSha256: sha(await fs.readFile(new URL(import.meta.url))),
  gameVersion: manifest.requiredGameVersion, activeMods: versions,
  blueprint: code, entities: bp.blueprint.entities, manifest,
  technologyClosure: closure,
  recipePrototypes: Object.fromEntries(recipes.map(n => [n, { ingredients: p.recipes[n].ingredients, results: p.recipes[n].results }])),
  protocol,
};
if (explore && option('--withhold')) configuration.withhold = Object.fromEntries(option('--withhold').split(',').map(v => { const [k, n] = v.split('='); return [k, Number(n)]; }));
configuration.configurationSha256 = sha(JSON.stringify(configuration));
await fs.writeFile(path.join(mod, 'fixture.lua'), `return helpers.json_to_table([====[${JSON.stringify(configuration)}]====])\n`);
await fs.writeFile(path.join(mod, 'control.lua'), control);
await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'express-belt-mall-validation', version: '1.0.0', title: 'Isolated express belt mall validation', author: 'local', factorio_version: '2.1', dependencies: Object.entries(versions).map(([name, version]) => `${name} = ${version}`) }));
await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...Object.keys(versions), 'express-belt-mall-validation'].map(name => ({ name, enabled: true })) }));
await fs.writeFile(path.join(work, 'config.ini'), `[path]\nread-data=${data}\nwrite-data=${work}\n[other]\ncheck-updates=false\nautosave-interval=0\n`);
await fs.writeFile(path.join(work, 'map-gen-settings.json'), JSON.stringify({ seed: protocol.seed, width: 32, height: 32, peaceful_mode: true }));

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
  assert.equal(exitCode, 0, `${label} failed; see ${path.join(work, label + '.log')}\n${output.slice(-2500)}`);
}
const save = path.join(work, 'isolated-mall.zip');
await game(['--create', save, '--map-gen-settings', path.join(work, 'map-gen-settings.json')], 'create');
const ticks = protocol.stockFillTicks + protocol.refillTicks + protocol.outageTicks + protocol.recoveryTicks + protocol.warmupTicks + protocol.measureTicks;
await game(['--benchmark', save, '--benchmark-ticks', String(ticks + 1), '--benchmark-runs', '1'], 'benchmark');
const report = JSON.parse(await fs.readFile(path.join(work, 'script-output/express-belt-mall/native-report.json'), 'utf8'));
assert.equal(report.blueprintSha256, configuration.blueprintSha256);
assert.equal(report.configurationSha256, configuration.configurationSha256);
assert.equal(report.prototypeSha256, configuration.prototypeSha256);
assert.equal(report.gameVersion, configuration.gameVersion);
assert.equal(report.actualTicks, ticks);
report.runnerSha256 = configuration.runnerSha256;
report.nativeCommand = 'node scripts/requested-malls/express-belt-mall/validate.mjs' + (explore ? ' ' + args.join(' ') : '');
report.elapsedSeconds = Object.fromEntries(timings.map(t => [t.label, t.elapsedSeconds]));
if (explore) report.exploration = true;
await fs.rm(save, { force: true });
const minutes = t => t === undefined ? 'never' : (t / 3600).toFixed(1);
const summary = { passed: report.passed, exploration: explore, blueprintSha256: report.blueprintSha256, failures: report.failures, minutesToFullStock: Object.fromEntries(Object.values(report.stockTiming || {}).map(t => [t.phase, { all: minutes(t.allTick), each: Object.fromEntries(Object.entries(t.reached || {}).map(([k, v]) => [k, minutes(v)])) }])), phases: report.phases.map(ph => [ph.phase, Object.values(ph.stock).join('/')]), perMinute: report.measured?.outputsPerMinute, inputsPerMinute: report.measured?.inputsPerMinute, ringPeakTotal: report.ringPeakTotal, ringBound: report.ringBound, crafts: report.crafts, hold: report.holdAtFirstFull?.fullSinceTick, run: path.relative(PROJECT, work) };
await fs.writeFile(path.join(work, 'native-report.json'), json(report));
if (!explore) {
  await fs.writeFile(path.join(source, 'native-report.json'), json(report));
  await fs.writeFile(path.join(source, 'native-status.json'), json({ candidateSha256: report.blueprintSha256, configurationSha256: report.configurationSha256, gameVersion: versions.base, status: report.passed ? 'passed' : 'failed', nativeProductionValidated: report.passed === true, report: 'native-report.json', safety: 'Fresh private write-data, config, mod directory, force, surface and save. Only the three entrance belts, the external lubricant pipe and external power are supplied.', protocol, simulatedTicks: ticks }));
} else if (option('--keep')) await fs.writeFile(path.join(source, `exploration-${option('--keep')}-report.json`), json(report));
console.log(JSON.stringify(summary, null, 2));
if (!report.passed) process.exitCode = 1;
