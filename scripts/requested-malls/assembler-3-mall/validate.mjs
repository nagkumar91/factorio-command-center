// Native qualification of the assembling-machine-3 supply mall (Factorio 2.1.24, Space Age), headless, in a private
// profile under .cache/assembler-3-mall/. Never touches the player's game data.
//
// Full protocol:  node scripts/requested-malls/assembler-3-mall/validate.mjs
//   fill from empty to two full provider chests, collect, refill, collect, 5 min input outage, recovery, 1 h hold at full stock,
//   10 min resume, 30 min of both chests emptied every second (15 min warm-up), 30 min of only the AM3 chest emptied.
//   Writes native-report.json and native-status.json next to the blueprint. Takes about twenty minutes.
// Exploration:    node scripts/requested-malls/assembler-3-mall/validate.mjs --explore [--source <folder>]
//                   [--sequence fill,rate-both] [--protocol fillLimitTicks=216000,rateMeasureTicks=18000] [--skip-audit]
//   Exploration never writes a report next to the blueprint; its report stays in the run folder.
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { HERE, PROJECT, PUBLISHED, ID, PROTOCOL, prototypes, readJson, json, sha, decode, technologyClosure } from './lib.mjs';
import { auditBlueprint } from './audit.mjs';
import { comparePinned } from './pinned-check.mjs';

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

const protocol = { ...PROTOCOL, sequence: [...PROTOCOL.sequence] };
if (explore && option('--protocol')) for (const pair of option('--protocol').split(',')) { const [k, v] = pair.split('='); assert(k in protocol && Number.isFinite(Number(v)), 'unknown protocol field ' + k); protocol[k] = Number(v); }
if (explore && option('--sequence')) protocol.sequence = option('--sequence').split(',');
if (!explore) assert.deepEqual(manifest.nativeProtocol, { ...PROTOCOL }, 'A full run uses exactly the qualifying protocol');
const limits = { fill: protocol.fillLimitTicks, refill: protocol.refillLimitTicks, outage: protocol.outageTicks, recovery: protocol.recoveryLimitTicks, hold: protocol.holdTicks, resume: protocol.resumeTicks, 'rate-both': protocol.rateWarmupTicks + protocol.rateMeasureTicks, 'rate-am3': protocol.am2FullLimitTicks + protocol.rateWarmupTicks + protocol.rateMeasureTicks };
for (const name of protocol.sequence) assert(name in limits, 'unknown phase ' + name);
const ticks = protocol.sequence.reduce((n, name) => n + limits[name], 0) + 600;

const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const data = path.join(app, 'Contents/data'), binary = path.join(app, 'Contents/MacOS/factorio');
await fs.access(binary, fs.constants.X_OK);
const versions = {};
for (const name of ['base', 'elevated-rails', 'quality', 'recycler', 'space-age'].filter(n => existsSync(path.join(data, n, 'info.json')))) versions[name] = JSON.parse(await fs.readFile(path.join(data, name, 'info.json'), 'utf8')).version;
assert(new Set(Object.values(versions)).size === 1, 'The four official packages must have one version: ' + JSON.stringify(versions));

const control = await fs.readFile(path.join(HERE, 'control.lua'), 'utf8');
const closure = manifest.technologyClosure || technologyClosure(p, manifest.recipes, [...new Set(bp.blueprint.entities.map(e => e.name))]).closure;
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const work = path.join(process.env.AM3_MALL_WORK || path.join(PROJECT, '.cache', ID), `native-${stamp}-${process.pid}`), mods = path.join(work, 'mods'), mod = path.join(mods, 'assembler-3-mall-validation');
await fs.mkdir(mods, { recursive: true });
// The pinned prototypes were dumped from Factorio 2.1.24. The installed game may be a later patch release: it qualifies only if a fresh
// native dump of the installed game equals every pinned recipe, entity, item and technology record.
await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: Object.keys(versions).map(name => ({ name, enabled: true })) }));
await fs.writeFile(path.join(work, 'config.ini'), `[path]\nread-data=${data}\nwrite-data=${work}\n[other]\ncheck-updates=false\nautosave-interval=0\n`);
await new Promise((resolve, reject) => { const c = spawn(binary, ['--config', path.join(work, 'config.ini'), '--mod-directory', mods, '--dump-data'], { cwd: work, stdio: 'ignore' }); c.on('error', reject); c.on('close', code => code === 0 ? resolve() : reject(new Error('dump-data failed ' + code))); });
const dumpFile = path.join(work, 'script-output/data-raw-dump.json'), dumpBytes = await fs.readFile(dumpFile);
const pinnedCheck = comparePinned(p, JSON.parse(dumpBytes));
assert.deepEqual(pinnedCheck.mismatches, [], 'The installed game differs from the pinned prototypes');
await fs.rm(dumpFile, { force: true });
const installedGame = { version: versions.base, pinnedVersion: manifest.requiredGameVersion, dumpSha256: sha(dumpBytes), pinnedRecordsChecked: pinnedCheck.checked, mismatches: pinnedCheck.mismatches };
const configuration = {
  schema: 1, blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256,
  nativeControlSha256: sha(control), runnerSha256: sha(await fs.readFile(new URL(import.meta.url))),
  gameVersion: versions.base, installedGame, activeMods: versions,
  blueprint: code, entities: bp.blueprint.entities, manifest,
  technologyClosure: closure,
  recipePrototypes: Object.fromEntries(manifest.recipes.map(n => [n, { ingredients: p.recipes[n].ingredients, results: p.recipes[n].results }])),
  protocol,
};
configuration.configurationSha256 = sha(JSON.stringify(configuration));
await fs.mkdir(mod, { recursive: true });
await fs.writeFile(path.join(mod, 'fixture.lua'), `return helpers.json_to_table([====[${JSON.stringify(configuration)}]====])\n`);
await fs.writeFile(path.join(mod, 'control.lua'), control);
await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'assembler-3-mall-validation', version: '1.0.0', title: 'Isolated assembler-3 mall validation', author: 'local', factorio_version: '2.1', dependencies: Object.entries(versions).map(([n, v]) => `${n} = ${v}`) }));
await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...Object.keys(versions), 'assembler-3-mall-validation'].map(name => ({ name, enabled: true })) }));
await fs.writeFile(path.join(work, 'map-gen-settings.json'), JSON.stringify({ seed: protocol.seed, width: 32, height: 32, peaceful_mode: true }));

const timings = [];
// The control script logs ASSEMBLER_3_MALL_RESULT once its report is written; the game would otherwise idle to the tick bound.
async function game(gameArgs, label, stopOn) {
  const start = Date.now(); let output = '', stopped = false;
  const log = createWriteStream(path.join(work, label + '.log'));
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(binary, ['--config', path.join(work, 'config.ini'), '--mod-directory', mods, ...gameArgs], { cwd: work });
    const take = b => { const s = String(b); output = (output + s).slice(-20000); log.write(s); if (stopOn && !stopped && output.includes(stopOn)) { stopped = true; setTimeout(() => child.kill('SIGTERM'), 2000); } };
    child.stdout.on('data', take); child.stderr.on('data', take);
    child.on('error', reject); child.on('close', (c, signal) => resolve(stopped ? 0 : c));
  });
  log.end();
  timings.push({ label, exitCode, elapsedSeconds: (Date.now() - start) / 1000 });
  assert.equal(exitCode, 0, `${label} failed; see ${path.join(work, label + '.log')}\n${output.slice(-2500)}`);
}
const save = path.join(work, 'isolated-mall.zip');
await game(['--create', save, '--map-gen-settings', path.join(work, 'map-gen-settings.json')], 'create');
await game(['--benchmark', save, '--benchmark-ticks', String(ticks), '--benchmark-runs', '1'], 'benchmark', 'ASSEMBLER_3_MALL_RESULT');
const report = JSON.parse(await fs.readFile(path.join(work, 'script-output/assembler-3-mall/native-report.json'), 'utf8'));
assert.equal(report.blueprintSha256, configuration.blueprintSha256);
assert.equal(report.configurationSha256, configuration.configurationSha256);
assert.equal(report.prototypeSha256, configuration.prototypeSha256);
assert.equal(report.gameVersion, configuration.gameVersion);
report.installedGame = installedGame;
report.runnerSha256 = configuration.runnerSha256;
if (explore) report.exploration = true;
await fs.rm(save, { force: true });
const minutes = t => t === undefined ? 'never' : (t / 3600).toFixed(1);
const summary = {
  passed: report.passed, exploration: explore, blueprintSha256: report.blueprintSha256, failures: report.failures, ticks: report.actualTicks, gameHours: +(report.actualTicks / 216000).toFixed(2),
  fillMinutes: Object.fromEntries(Object.entries(report.fillTimes || {}).map(([k, v]) => [k, { am2: minutes(v.am2), am3: minutes(v.am3) }])),
  rates: Object.fromEntries(Object.entries(report.windows || {}).map(([k, w]) => [k, { removedPerMinute: w.removedPerMinute, craftsPerMinute: w.craftsPerMinute, inputsPerMinute: w.inputsPerMinute }])),
  ringPeakTotal: report.ringPeakTotal, ringPeaks: report.ringPeaks, crafts: report.crafts, run: path.relative(PROJECT, work), wallSeconds: timings.map(t => t.elapsedSeconds),
};
await fs.writeFile(path.join(work, 'native-report.json'), json(report));
if (!explore) {
  await fs.writeFile(path.join(source, 'native-report.json'), json(report));
  await fs.writeFile(path.join(source, 'native-status.json'), json({ candidateSha256: report.blueprintSha256, configurationSha256: report.configurationSha256, gameVersion: versions.base, status: report.passed ? 'passed' : 'failed', nativeProductionValidated: report.passed === true, report: 'native-report.json', safety: 'Fresh private write-data, config, mod directory, force, surface and save. Only the four entrance belts and outside power are supplied.', protocol, simulatedTicks: report.actualTicks }));
}
console.log(JSON.stringify(summary, null, 2));
if (!report.passed) process.exitCode = 1;
