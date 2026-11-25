// Native qualification of the foundry mall (Factorio 2.1.25, Space Age, a Vulcanus surface), headless. Every scenario
// is its own Factorio instance with a private write-data, config and mod directory under .cache/foundry-mall/ and its
// own fresh import of the same blueprint string; scenarios run side by side. Never touches the player's game data,
// saves or mod profile.
//
// Full protocol:  node scripts/requested-malls/foundry-mall/validate.mjs
//   fill (full caps, then refill, outage and recovery at reduced caps), rate (full caps), hold, caps, single and one
//   scenario per withheld outside input (reduced caps). Writes one native-report.json and native-status.json.
// Exploration:    node scripts/requested-malls/foundry-mall/validate.mjs --explore --scenario fill,rate,skip:lubricant
//                   [--source <folder>] [--caps full|reduced] [--limit <ticks>] [--keep <name>] [--bonus stack,bulk]
//                   [--skip-audit] [--script-mode full|supply|none --ticks <n>] [--control <file>]
//   Exploration never writes native-report.json. --keep stores the merged report beside the blueprint as
//   exploration-<name>-report.json. --caps overrides every scenario's starting caps (tuning runs use reduced).
// Instances: at most 6 headless Factorio processes on the machine in total (4 while the player's own game runs),
// counted before every launch; at most 3 of ours while the one-minute load is above 12.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { HERE, PROJECT, PUBLISHED, ID, PROTOCOL, prototypes, readJson, json, sha, decode } from './lib.mjs';
import { expand, OUTSIDE } from './bill.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const explore = args.includes('--explore');
const source = option('--source') ? path.resolve(option('--source')) : PUBLISHED;
const [manifest, p] = await Promise.all([readJson(path.join(source, 'manifest.json')), prototypes()]);
const code = (await fs.readFile(path.join(source, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code);
assert.equal(sha(code), manifest.candidateSha256, 'manifest does not describe this blueprint string');
assert.equal(sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), manifest.prototypeSha256, 'prototype snapshot mismatch');
if (!(explore && args.includes('--skip-audit'))) {
  const { auditBlueprint } = await import('./audit.mjs');
  const audit = auditBlueprint(bp, manifest, p);
  assert.equal(audit.passed, true, 'Static audit is a prerequisite: ' + JSON.stringify(audit.errors));
}
const protocol = { ...PROTOCOL };
if (explore && option('--limit')) protocol.fillLimitTicks = protocol.skipLimitTicks = Number(option('--limit'));
if (!explore) assert.deepEqual(manifest.nativeProtocol, JSON.parse(JSON.stringify(PROTOCOL)), 'A full run uses exactly the qualifying protocol');

// ---- caps: the published caps, and the reduced set most scenarios run at (a tenth, at least 2, never above the cap)
const reduce = cap => cap <= 2 ? cap : Math.max(2, Math.ceil(cap / protocol.reducedDivisor));
const FULL = { ...manifest.caps, 'signal-K': manifest.kitShare };
const REDUCED = Object.fromEntries(Object.entries(FULL).map(([k, v]) => [k, reduce(v)]));
const capSets = { full: FULL, reduced: REDUCED };
// Which products need which outside input (from the pinned recipes).
const needs = Object.fromEntries(manifest.products.map(v => [v.item, Object.keys(expand(p, { [v.item]: 1 }).outside)]));
const dependents = input => manifest.products.filter(v => needs[v.item].includes(input)).map(v => v.item);
const QUIET = Object.fromEntries(['U1', 'U2', 'rocket-silo', 'assembling-machine-3', 'assembling-machine-2', 'assembling-machine-1', 'space-platform-foundation', 'processing-unit', 'speed-module', 'electric-engine-unit', 'engine-unit', 'battery'].map(r => [r, true]));
const SETTLE = protocol.settleSeconds;
const fill = (name, extra = {}) => ({ name, mode: 'until_caps', limit: protocol.fillLimitTicks, expect: 'caps', settleSeconds: SETTLE, ...extra });
const edited = (caps, f) => Object.fromEntries(protocol.capEditItems.map(k => [k, f(caps[k])]));
function scenario(name) {
  if (name === 'fill') return { caps: 'full', phases: [
    fill('fill from empty'),
    fill('refill after complete collection', { collectAtStart: true, setCaps: REDUCED }),
    { name: 'five-minute outage of every input', mode: 'ticks', ticks: protocol.outageTicks, collectAtStart: true, withhold: OUTSIDE },
    fill('recovery after the outage') ] };
  // Rates: the mall is strictly sequential by group, so emptying every chest at once only ever shows group 1.
  // After a full fill, each group in turn has its own chest contents taken every second (15 min warm-up, 30 min
  // measured) while the groups above it stay full; the first pair of phases empties every chest, as the brief asks.
  if (name === 'rate') return { caps: 'full', phases: [
    fill('fill from empty'),
    { name: 'rate warm-up: every chest emptied', mode: 'ticks', ticks: protocol.rateWarmupTicks, collectEvery: 60 },
    { name: 'rate: every chest emptied', mode: 'ticks', ticks: protocol.rateMeasureTicks, collectEvery: 60, measure: true, expect: 'rate', rateItems: manifest.groups[0].products },
    ...manifest.groups.slice(1).flatMap(g => [
      fill(`refill before the group ${g.group} rate`),
      { name: `rate warm-up: group ${g.group}`, mode: 'ticks', ticks: protocol.rateWarmupTicks, collectEvery: 60, collectItems: g.products },
      { name: `rate: group ${g.group} (${g.name})`, mode: 'ticks', ticks: protocol.rateMeasureTicks, collectEvery: 60, collectItems: g.products, measure: true, expect: 'rate', rateItems: g.products } ]) ] };
  if (name === 'hold') return { caps: 'reduced', phases: [
    fill('fill from empty'),
    { name: 'settle at full stock', mode: 'ticks', ticks: protocol.settleTicks },
    { name: 'one-hour hold at full stock', mode: 'ticks', ticks: protocol.holdTicks, expect: 'unchanged', quietRoles: QUIET },
    fill('refill after collection', { collectAtStart: true }) ] };
  if (name === 'caps') return { caps: 'reduced', phases: [
    fill('fill from empty'),
    fill('caps raised', { setCaps: edited(REDUCED, v => Math.ceil(v * 1.5) + 1) }),
    fill('caps lowered, those products collected', { setCaps: edited(REDUCED, v => Math.max(1, Math.floor(v / 2))), collectAtStart: protocol.capEditItems }),
    fill('caps restored', { setCaps: edited(REDUCED, v => v) }) ] };
  if (name === 'single') return { caps: 'reduced', phases: [fill('fill from empty'), ...protocol.singleRefills.map(item => fill('single refill: ' + item, { collectAtStart: [item], measure: true }))] };
  if (name.startsWith('skip:')) {
    const input = name.slice(5), dep = dependents(input), all = dep.length === manifest.products.length;
    return { caps: 'reduced', phases: [
      all ? { name: `withheld ${input}: nothing can be made`, mode: 'ticks', ticks: protocol.skipDeadTicks, withhold: [input], expect: 'nothing' }
        : { name: `withheld ${input}`, mode: 'until_caps', limit: protocol.skipLimitTicks, withhold: [input], except: dep, expect: 'caps_except', settleSeconds: protocol.skipSettleSeconds },
      fill(`after ${input} returned`) ] };
  }
  if (name === 'cost') return { caps: 'full', phases: [{ name: 'script cost', mode: 'ticks', ticks: Number(option('--ticks') || 36000) }] };
  if (name === 'custom') return JSON.parse(option('--phases'));
  assert.fail('unknown scenario ' + name);
}
const QUALIFICATION = ['fill', 'rate', 'hold', 'caps', 'single', ...protocol.withheldInputs.map(n => 'skip:' + n)];
const names = explore ? (option('--scenario') || 'fill').split(',') : QUALIFICATION;

const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const data = path.join(app, 'Contents/data'), binary = path.join(app, 'Contents/MacOS/factorio');
await fs.access(binary, fs.constants.X_OK);
const versions = {};
for (const name of ['base', 'quality', 'elevated-rails', 'space-age']) {
  versions[name] = JSON.parse(await fs.readFile(path.join(data, name, 'info.json'), 'utf8')).version;
  assert.equal(versions[name], manifest.requiredGameVersion, `Wrong installed ${name} version`);
}
for (const [file, expected] of Object.entries(p.provenance.sourceHashes)) assert.equal(sha(await fs.readFile(path.join(data, file))), expected, `Installed game source differs from the prototype snapshot: ${file}`);
const control = await fs.readFile(option('--control') ? path.resolve(option('--control')) : path.join(HERE, 'control.lua'), 'utf8');
const runnerSha256 = sha(await fs.readFile(new URL(import.meta.url)));
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const root = process.env.FOUNDRY_RUN_ROOT ? path.resolve(process.env.FOUNDRY_RUN_ROOT) : path.join(PROJECT, '.cache', ID, `native-${stamp}-${process.pid}`);

// ---- instance budget, checked before every launch
const ours = new Set();
function budget() {
  let lines = [];
  try { lines = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n').filter(l => l.includes('MacOS/factorio') && !l.includes('/bin/ps')); } catch {}
  const playerGame = lines.some(l => !l.includes('--config'));
  const total = playerGame ? 4 : 6, mine = os.loadavg()[0] > 12 ? 3 : total;
  return { free: Math.min(total - lines.length, mine - ours.size), total, running: lines.length, playerGame };
}
async function slot() { for (;;) { if (budget().free > 0) return; await new Promise(r => setTimeout(r, 3000)); } }
function game(work, mods, gameArgs, label, timings) {
  return new Promise((resolve, reject) => {
    const start = Date.now(); let output = '';
    const child = spawn(binary, ['--config', path.join(work, 'config.ini'), '--mod-directory', mods, ...gameArgs], { cwd: work });
    ours.add(child.pid);
    if (process.platform === 'darwin' && child.pid) execFile('/usr/bin/taskpolicy', ['-B', '-p', String(child.pid)], () => {});
    child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
    child.on('error', e => { ours.delete(child.pid); reject(e); });
    child.on('close', async exitCode => {
      ours.delete(child.pid);
      await fs.writeFile(path.join(work, label + '.txt'), output);
      timings[label] = (Date.now() - start) / 1000;
      if (exitCode !== 0) reject(new Error(`${label} failed; see ${path.join(work, label + '.txt')}\n${output.split('\n').filter(l => /rror|FOUNDRY/.test(l)).slice(-12).join('\n')}`)); else resolve(output);
    });
  });
}
async function run(name) {
  const work = path.join(root, name.replace(':', '-')), mods = path.join(work, 'mods'), mod = path.join(mods, 'foundry-mall-validation');
  await fs.mkdir(mod, { recursive: true });
  const sc = scenario(name), capsName = explore && option('--caps') ? option('--caps') : sc.caps;
  const configuration = {
    schema: 2, scenario: name, capsName, startCaps: capSets[capsName], blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, nativeControlSha256: sha(control), runnerSha256,
    gameVersion: manifest.requiredGameVersion, activeMods: versions, blueprint: code, entities: bp.blueprint.entities, manifest, technologyClosure: manifest.technologyClosure,
    recipePrototypes: Object.fromEntries(manifest.recipes.map(n => [n, { ingredients: p.recipes[n].ingredients, results: p.recipes[n].results }])),
    fluidTemperature: Object.fromEntries(Object.values(p.fluids).map(f => [f.name, f.default_temperature])),
    externalPowerWatts: protocol.externalPowerWatts, samplingTicks: protocol.samplingTicks, phases: sc.phases,
    ...(option('--script-mode') ? { scriptMode: option('--script-mode') } : {}),
    ...(option('--trace') ? { trace: JSON.parse(option('--trace')) } : {}),
    ...(args.includes('--fluid-debug') ? { fluidDebug: true } : {}),
    ...(option('--bonus') ? { bonus: { stack: Number(option('--bonus').split(',')[0]), bulk: Number(option('--bonus').split(',')[1]) } } : {}),
  };
  configuration.configurationSha256 = sha(JSON.stringify(configuration));
  await fs.writeFile(path.join(mod, 'fixture.lua'), `return helpers.json_to_table([====[${JSON.stringify(configuration)}]====])\n`);
  await fs.writeFile(path.join(mod, 'control.lua'), control);
  await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'foundry-mall-validation', version: '1.0.0', title: 'Isolated foundry mall validation', author: 'local', factorio_version: '2.1', dependencies: Object.entries(versions).map(([n, version]) => `${n} = ${version}`) }));
  await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...Object.keys(versions), 'foundry-mall-validation'].map(n => ({ name: n, enabled: true })) }));
  // One update thread: this factory is far too small to gain from the game's multithreaded update, whose fixed
  // per-tick hand-off cost was measured at 15 times the single-thread tick. The simulation itself is the same.
  await fs.writeFile(path.join(work, 'config.ini'), `[path]\nread-data=${data}\nwrite-data=${work}\n[other]\ncheck-updates=false\nautosave-interval=0\nupdate-runner-threads-count=${process.env.FOUNDRY_UPDATE_THREADS || 1}\n`);
  await fs.writeFile(path.join(work, 'map-gen-settings.json'), JSON.stringify({ seed: protocol.seed, width: 32, height: 32, peaceful_mode: true, autoplace_controls: {}, default_enable_all_autoplace_controls: false }));
  const timings = {}, save = path.join(work, 'isolated-mall.zip');
  await slot();
  await game(work, mods, ['--create', save, '--map-gen-settings', path.join(work, 'map-gen-settings.json')], 'create', timings);
  const ticks = sc.phases.reduce((n, ph) => n + (ph.mode === 'ticks' ? ph.ticks : ph.limit), 0) + 10;
  await slot();
  const output = await game(work, mods, ['--benchmark', save, '--benchmark-ticks', String(ticks), '--benchmark-runs', '1'], 'benchmark', timings);
  await fs.rm(save, { force: true });
  const report = JSON.parse(await fs.readFile(path.join(work, 'script-output/foundry-mall/native-report.json'), 'utf8'));
  if (!Array.isArray(report.failures)) report.failures = [];   // an empty Lua table arrives as {}
  assert.equal(report.blueprintSha256, configuration.blueprintSha256);
  assert.equal(report.configurationSha256, configuration.configurationSha256);
  assert.equal(report.gameVersion, configuration.gameVersion);
  const performed = /Performed (\d+) updates in ([\d.]+) ms/.exec(output);
  report.runnerSha256 = runnerSha256; report.wallSeconds = timings.benchmark; report.createSeconds = timings.create; report.benchmarkTicks = ticks;
  if (performed) report.benchmark = { updates: Number(performed[1]), milliseconds: Number(performed[2]), updatesPerSecond: Math.round(Number(performed[1]) / Number(performed[2]) * 1000) };
  // the report is written at the last goal; the wall time up to then, from the game's own clock in the log
  const done = /^\s*([\d.]+) Script .*FOUNDRY_MALL_RESULT/m.exec(output), first = /^\s*([\d.]+) Script .*FOUNDRY_MALL_START/m.exec(output);
  if (done && first) { report.activeWallSeconds = Number(done[1]) - Number(first[1]); report.activeUpdatesPerSecond = Math.round(report.actualTicks / report.activeWallSeconds); report.timesRealTime = Math.round(report.activeUpdatesPerSecond / 6) / 10; }
  await fs.writeFile(path.join(work, 'native-report.json'), json(report));
  return report;
}
const minutes = t => t === undefined ? 'never' : Math.round(t / 360) / 10;
const started = Date.now();
const reports = Object.fromEntries(await Promise.all(names.map(async name => {
  const r = await run(name);
  console.log(JSON.stringify({ scenario: name, caps: r.capsName, passed: r.passed, failures: r.failures, ticks: r.actualTicks, activeWallSeconds: r.activeWallSeconds, ups: r.activeUpdatesPerSecond, xRealTime: r.timesRealTime, phases: r.phases.map(ph => ({ name: ph.name, minutes: minutes(ph.ticks), endedBy: ph.endedBy, levels: Object.fromEntries(Object.entries(ph.levelTicks).map(([k, v]) => [k, minutes(v)])), reached: Object.fromEntries(Object.entries(ph.reached).sort((a, b) => a[1] - b[1]).map(([k, v]) => [k, minutes(v)])), short: Object.fromEntries(Object.entries(ph.stock).filter(([k, v]) => v < (ph.caps || r.caps)[k])), switches: ph.switches, peak: ph.peak, gatedActive: ph.gatedActive })), ringPeakTotal: r.ringPeakTotal, ringBound: r.ringBound }));
  return [name, r];
})));
const passed = names.every(n => reports[n].passed);
const merged = {
  schema: 2, passed, blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, gameVersion: versions.base, activeMods: versions, surface: manifest.surface, runnerSha256, nativeControlSha256: sha(control),
  nativeCommand: 'node scripts/requested-malls/foundry-mall/validate.mjs' + (explore ? ' ' + args.join(' ') : ''), ...(explore ? { exploration: true } : {}),
  failures: names.flatMap(n => reports[n].failures.map(f => `${n}: ${f}`)), wallSecondsTotal: (Date.now() - started) / 1000,
  capSets, dependents: Object.fromEntries(protocol.withheldInputs.map(n => [n, dependents(n)])),
  scenarios: Object.fromEntries(names.map(n => [n, reports[n]])),
};
await fs.writeFile(path.join(root, 'native-report.json'), json(merged));
if (explore) {
  if (option('--keep')) await fs.writeFile(path.join(source, `exploration-${option('--keep')}-report.json`), json(merged));
} else {
  assert(names.every(n => reports[n].blueprintSha256 === manifest.candidateSha256), 'every scenario ran the same blueprint string');
  await fs.writeFile(path.join(source, 'native-report.json'), json(merged));
  await fs.writeFile(path.join(source, 'native-status.json'), json({ candidateSha256: manifest.candidateSha256, gameVersion: versions.base, status: passed ? 'passed' : 'failed', nativeProductionValidated: passed, report: 'native-report.json', scenarios: Object.fromEntries(names.map(n => [n, { passed: reports[n].passed, caps: reports[n].capsName, configurationSha256: reports[n].configurationSha256, simulatedTicks: reports[n].actualTicks, activeWallSeconds: reports[n].activeWallSeconds, updatesPerSecond: reports[n].activeUpdatesPerSecond }])), safety: 'One fresh private write-data, config, mod directory, force, Vulcanus surface and save per scenario. Only the declared entrances, a sink on the stone exit and outside power are supplied.', protocol }));
}
console.log(JSON.stringify({ passed, wallSeconds: merged.wallSecondsTotal, run: path.relative(PROJECT, root) }));
if (!passed) process.exitCode = 1;
