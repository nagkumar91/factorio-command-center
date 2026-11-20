// Six-pack science native validator. Adapted from scripts/robot-logistics-workshop/validate.mjs:
// private --config and --mod-directory under .cache/six-science, headless --create then --benchmark,
// taskpolicy -B, one update thread, 2.1.24 version check in the mod. Phase lengths come from
// manifest.protocol. ESSENTIALS_EXPLORE=1 runs shorter phases (SIX_WARMUP, SIX_MEASURE, SIX_BLOCKED,
// SIX_SETTLE, SIX_RECOVERY minutes) and writes .cache/six-science/explore-report.json only.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';

const run = promisify(execFile), sha = s => createHash('sha256').update(s).digest('hex');
const source = process.env.SIX_SOURCE || 'blueprint-sources/six-science';
const rawPath = process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes = await fs.readFile(rawPath), raw = JSON.parse(bytes);
const explore = process.env.ESSENTIALS_EXPLORE === '1';
if (process.env.SIX_REPORT_ONLY === '1' && !explore) throw Error('SIX_REPORT_ONLY reads an existing result.json; allowed only with ESSENTIALS_EXPLORE=1');
const builds = JSON.parse(await fs.readFile(source + '/manifest.json'));
for (const b of builds) {
  b.code = (await fs.readFile(source + '/' + b.file, 'utf8')).trim();
  if (b.prototypeSha256 !== sha(bytes)) throw Error('Prototype SHA mismatch ' + b.id);
  if (sha(b.code) !== b.blueprintSha256) throw Error('Code SHA mismatch ' + b.id);
  b.entities = decodeBlueprint(b.code).blueprint.entities;
  b.recipeIngredients = Object.fromEntries(Object.keys(b.machineCounts).map(n => [n, raw.recipe[n].ingredients]));
}
const proto = builds[0].protocol;
const minutes = explore ? {
  warmup: Number(process.env.SIX_WARMUP || 10), measure: Number(process.env.SIX_MEASURE || 10), blocked: Number(process.env.SIX_BLOCKED || 0),
  settle: Number(process.env.SIX_SETTLE || 0), recovery: Number(process.env.SIX_RECOVERY || 0),
} : {warmup: proto.warmupMinutes, measure: proto.measureMinutes, blocked: proto.blockedMinutes, settle: proto.settleMinutes, recovery: proto.recoveryMinutes};
if (!explore) for (const [k, min] of Object.entries({warmup: 15, measure: 30, blocked: 10, settle: 5, recovery: 10})) if (minutes[k] < min) throw Error(`protocol ${k} below the minimum`);
const phases = Object.fromEntries(Object.entries(minutes).map(([k, v]) => [k, Math.round(v * 3600)]));
const totalTicks = Object.values(phases).reduce((a, b) => a + b, 0) + 1;
const root = path.resolve(process.env.SIX_RUN_ROOT || '.cache/six-science/native-' + Date.now());
const app = path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'), mod = root + '/mods/six_science_test';
await fs.mkdir(mod, {recursive: true});
await fs.writeFile(root + '/mods/mod-list.json', JSON.stringify({mods: ['base', 'elevated-rails', 'quality', 'recycler', 'space-age', 'six_science_test'].map(name => ({name, enabled: true}))}));
await fs.writeFile(mod + '/info.json', JSON.stringify({name: 'six_science_test', version: '1.0.0', title: 'Private six-pack qualification', author: 'local', factorio_version: '2.1', dependencies: ['base = 2.1.24', 'space-age']}));
await fs.copyFile('scripts/six-science/control.lua', mod + '/control.lua');
await fs.writeFile(mod + '/payload.lua', 'return [====[' + JSON.stringify({builds, phases, debugTopology: process.env.SIX_DEBUG === '1'}) + ']====]');
await fs.writeFile(mod + '/data.lua', '-- No prototypes added.\n');
await fs.writeFile(root + '/config.ini', `[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root + '/map.json', JSON.stringify({seed: 12345, width: 32, height: 32, default_enable_all_autoplace_controls: false}));
async function game(args, file) {
  try {
    const task = run(app + '/MacOS/factorio', ['--config', root + '/config.ini', '--mod-directory', root + '/mods', ...args], {timeout: 3 * 3600 * 1000, maxBuffer: 64e6});
    if (process.platform === 'darwin' && task.child?.pid) await run('/usr/bin/taskpolicy', ['-B', '-p', String(task.child.pid)]).catch(() => {});
    const r = await task;
    await fs.writeFile(root + '/' + file, r.stdout + r.stderr);
  } catch (e) {
    await fs.writeFile(root + '/' + file, (e.stdout || '') + (e.stderr || ''));
    throw Error(root + '/' + file + '\n' + (e.stdout || '').slice(-3000));
  }
}
console.log(root, JSON.stringify(minutes));
const started = Date.now();
if (process.env.SIX_REPORT_ONLY !== '1') await game(['--create', root + '/test.zip', '--map-gen-settings', root + '/map.json'], 'create.log');
if (process.env.SIX_REPORT_ONLY !== '1') await game(['--benchmark', root + '/test.zip', '--benchmark-ticks', String(process.env.SIX_IMPORT_ONLY === '1' ? 61 : totalTicks), '--benchmark-runs', '1'], 'benchmark.log');
if (process.env.SIX_IMPORT_ONLY === '1') { console.log('Import, geometry, ring wiring, exterior approaches and power passed.'); process.exit(0); }
const report = JSON.parse(String(await fs.readFile(root + '/script-output/result.json')).replace(/([:\[,])(-?nan|-?inf)([,}\]])/g, '$1null$3'));
Object.assign(report, {gameVersion: '2.1.24', prototypeSha256: sha(bytes), harnessSha256: sha(await fs.readFile(mod + '/control.lua')), dataHarnessSha256: sha(await fs.readFile(mod + '/data.lua')),
  validatorSha256: sha(await fs.readFile('scripts/six-science/validate.mjs')), configurationSha256: sha(await fs.readFile(mod + '/payload.lua')),
  protocol: {warmupMinutes: minutes.warmup, measureMinutes: minutes.measure, blockedMinutes: minutes.blocked, settleMinutes: minutes.settle, recoveryMinutes: minutes.recovery},
  short: explore, createdAt: new Date().toISOString(), wallSeconds: Math.round((Date.now() - started) / 1000)});
for (const r of report.builds) {
  const b = builds.find(b => b.id === r.id);
  // The harness writes the SHA it was given; a result from another string never gets this one's SHA.
  if (r.blueprintSha256 !== b.blueprintSha256) throw Error(`result.json was produced for ${r.blueprintSha256}, manifest has ${b.blueprintSha256}`);
  r.fluids = Array.isArray(r.fluids) ? r.fluids : [];
  const floor = p => b.targets[p] * .95;
  const checks = {
    steady: b.products.every(p => r.outputsPerMinute[p] >= floor(p)),
    recovery: minutes.recovery > 0 && b.products.every(p => r.recovery?.outputsPerMinute?.[p] >= floor(p)),
    everyMachineCrafted: r.machines.every(m => m.measuredCrafts > 0),
    entrances: r.inputs.every(p => p.acceptedDuringMeasurement > 0 && p.productiveRoute?.length),
    fluids: r.fluids.length === b.fluids.length && r.fluids.every(p => p.acceptedDuringMeasurement > 0 && p.productiveConsumers?.length),
    outputsDelivered: r.outputPorts.every(p => p.collectedDuringMeasurement > 0),
    exactCaps: minutes.blocked > 0 && (r.recovery?.collectionPauseStock || []).length === b.outputs.length && r.recovery.collectionPauseStock.every(p => p.count === p.capacity && p.maxDuringBlocked <= p.capacity),
    ringsBelow90: Object.values(r.loopSamplesFinal || r.loopSamples).every(s => s.maxStock < .9 * s.capacity),
    wiring: r.stockNetworksIsolated === true,
    geometryAndPower: r.powered === true && r.externalApproachesClear === true && r.exactRecipeChecks > 0,
    bulkHand: r.observedMaxHand <= 2,
  };
  r.checks = checks;
  r.passed = Object.values(checks).every(Boolean);
}
report.passed = !explore && report.builds.every(b => b.passed);
const out = explore ? '.cache/six-science/explore-report.json' : source + '/native-report.json';
await fs.writeFile(out, JSON.stringify(report, null, 2) + '\n');
if (!explore) {
  // Record the outcome for this exact string in the manifest (the string and its SHA are unchanged).
  const manifest = JSON.parse(await fs.readFile(source + '/manifest.json'));
  for (const b of manifest) { const r = report.builds.find(r => r.id === b.id); b.status = r?.passed && r.blueprintSha256 === b.blueprintSha256 ? 'qualified' : 'not-qualified'; }
  await fs.writeFile(source + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
}
console.log(JSON.stringify(report.builds.map(r => ({id: r.id, passed: r.passed, checks: r.checks, rates: r.outputsPerMinute, recovery: r.recovery?.outputsPerMinute,
  idle: r.machines.filter(m => !m.measuredCrafts).map(m => m.recipe + '@' + m.x + ',' + m.y), wallSeconds: report.wallSeconds})), null, 2));
process.exitCode = report.passed ? 0 : 1;
