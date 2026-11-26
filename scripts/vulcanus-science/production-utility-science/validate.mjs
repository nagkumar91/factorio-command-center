// Native qualification of the Vulcanus science blueprint (Factorio 2.1.25, Space Age, a Vulcanus surface), headless. Every
// scenario is its own Factorio instance with a private write-data, config and mod directory under .cache/vulcanus-science/
// and its own fresh import of the same blueprint string; scenarios run side by side. Never touches the player's game data,
// saves or mod profile.
//
// Full protocol:  node scripts/vulcanus-science/production-utility-science/validate.mjs
//   Writes native-report.json and native-status.json beside the blueprint.
// Exploration:    node scripts/vulcanus-science/production-utility-science/validate.mjs --explore --scenario generous,stone [--source <folder>] [--keep <name>]
//   Never writes native-report.json. --keep stores exploration-<name>-report.json beside the blueprint.
// Instances: counted on the whole machine before every launch: at most 10 Factorio processes, 4 while a game without
// --config (the player's own) is running; fewer of ours only while the one-minute load is above 16.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { HERE, PROJECT, PUBLISHED, ID, prototypes, fluidSlots, readJson, json, sha, decode, encode } from './lib.mjs';
import { PROTOCOL, FULL_LENGTH, scenarioNames, scenario, buildOrder, flipBlueprint } from './protocol.mjs';
import { auditBlueprint, analyzeFluids } from './audit.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const explore = args.includes('--explore');
const source = option('--source') ? path.resolve(option('--source')) : PUBLISHED;
const [manifest, p, slots] = await Promise.all([readJson(path.join(source, 'manifest.json')), prototypes(), fluidSlots()]);
const code = (await fs.readFile(path.join(source, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code);
assert.equal(sha(code), manifest.candidateSha256, 'manifest does not describe this blueprint string');
assert.equal(sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), manifest.prototypeSha256, 'prototype snapshot mismatch');
assert.equal(sha(await fs.readFile(path.join(HERE, 'fluid-slots.json'))), manifest.fluidSlotsSha256, 'fluid slot table mismatch');
const audit = auditBlueprint(bp, manifest, p, slots);
assert.equal(audit.passed, true, 'Static audit is a prerequisite: ' + JSON.stringify(audit.errors));
if (!explore) assert.deepEqual(manifest.nativeProtocol, JSON.parse(JSON.stringify(PROTOCOL)), 'A full run uses exactly the qualifying protocol');
const names = explore ? (option('--scenario') || 'generous').split(',') : scenarioNames();

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
const runnerSha256 = sha(await fs.readFile(new URL(import.meta.url))), nativeControlSha256 = sha(control), protocolSha256 = sha(await fs.readFile(path.join(HERE, 'protocol.mjs')));
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const root = path.join(PROJECT, '.cache', 'vulcanus-science', `native-${stamp}-${process.pid}`);

// ---- instance budget, counted on the whole machine before every launch
const ours = new Set();
function budget() {
  let lines = [];
  try { lines = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n').filter(l => l.includes('MacOS/factorio') && !l.includes('/bin/ps')); } catch {}
  const playerGame = lines.some(l => !l.includes('--config'));
  const total = playerGame ? 4 : 10, others = lines.length - ours.size;
  // when another agent's games are running, leave it about half
  const mine = Math.min(os.loadavg()[0] > 16 ? Math.max(2, Math.floor(total / 2)) : total, others > 0 ? Math.ceil(total / 2) : total, Number(process.env.VULCANUS_SCIENCE_INSTANCES || 99));
  return { free: Math.min(total - lines.length, mine - ours.size), total, running: lines.length, playerGame };
}
let launching = Promise.resolve();
const slot = () => (launching = launching.then(async () => { for (;;) { if (budget().free > 0) return; await new Promise(r => setTimeout(r, 2000)); } }));
function game(work, mods, gameArgs, label, timings) {
  return new Promise((resolve, reject) => {
    const start = Date.now(); let output = '';
    const child = spawn(binary, ['--config', path.join(work, 'config.ini'), '--mod-directory', mods, ...gameArgs], { cwd: work });
    ours.add(child.pid);
    child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
    child.on('error', e => { ours.delete(child.pid); reject(e); });
    child.on('close', async exitCode => {
      ours.delete(child.pid);
      await fs.writeFile(path.join(work, label + '.txt'), output);
      timings[label] = (Date.now() - start) / 1000;
      if (exitCode !== 0) reject(new Error(`${label} failed; see ${path.join(work, label + '.txt')}\n${output.split('\n').filter(l => /rror|VULCANUS|control.lua/.test(l)).slice(-12).join('\n')}`)); else resolve(output);
    });
  });
}
// What the harness needs to know about one placement of the blueprint (the string as published, or a flipped copy).
function placement(sc) {
  const object = sc.flip ? flipBlueprint(bp, sc.flip, slots) : bp, placed = sc.flip ? encode(object) : code;
  const es = object.blueprint.entities, flipPoint = v => (sc.flip === 'horizontal' ? { x: -v.x, y: v.y } : sc.flip === 'vertical' ? { x: v.x, y: -v.y } : v);
  const centre = t => flipPoint({ x: t.x + 0.5, y: t.y + 0.5 });
  const ports = manifest.ports.map(v => ({ id: v.id, item: v.item, kind: v.kind, exit: v.exit, entity: v.entity, perMinute: v.perMinute, externalContact: centre(v.externalContact) }));
  const fluid = analyzeFluids(es, slots, manifest.ports);
  assert.deepEqual(fluid.problems, [], 'fluid model of the placed blueprint');
  const packMachines = Object.fromEntries(manifest.outputs.map(o => [o.item, manifest.machines.filter(m => m.recipe === o.item).map(m => m.entity)]));
  const M = { surface: manifest.surface, anchor: manifest.machines.find(m => m.recipe === 'casting-iron-stick').entity, ports, outputs: manifest.outputs.map(o => ({ item: o.item, chest: o.chest, arm: o.arm, capacity: o.capacity })),
    machines: manifest.machines.map(m => ({ entity: m.entity, role: m.role })), packMachines, fluidOf: fluid.fluidOf, machineFluids: fluid.machineFluids, power: { entry: manifest.power.entry, externalPole: flipPoint(manifest.power.externalPole) } };
  return { placed, es, M };
}
async function run(name) {
  const work = path.join(root, name.replaceAll(':', '-')), mods = path.join(work, 'mods'), mod = path.join(mods, 'vulcanus-science-validation');
  await fs.mkdir(mod, { recursive: true });
  const sc = scenario(name, manifest), { placed, es, M } = placement(sc);
  const order = buildOrder(sc.build.mode === 'staged' ? sc.build.name : 'all', es);
  const recipes = [...new Set(manifest.machines.map(m => m.recipe))];
  const configuration = {
    schema: 1, scenario: name, blueprintSha256: manifest.candidateSha256, placedSha256: sha(placed), prototypeSha256: manifest.prototypeSha256, nativeControlSha256, runnerSha256, protocolSha256,
    gameVersion: manifest.requiredGameVersion, activeMods: versions, blueprint: placed, entities: es, manifest: M, technologyClosure: manifest.technologyClosure,
    recipePrototypes: Object.fromEntries(recipes.map(n => [n, { ingredients: p.recipes[n].ingredients, results: p.recipes[n].results }])),
    fluidTemperature: Object.fromEntries(Object.values(p.fluids).map(f => [f.name, f.default_temperature])),
    externalPowerWatts: PROTOCOL.externalPowerWatts, rotation: sc.rotation, flip: sc.flip, build: { ...sc.build, order }, phases: sc.phases,
    ...(explore && process.env.VS_DEBUG_TILES ? { debugTiles: process.env.VS_DEBUG_TILES.split(';').map(v => { const [x, y] = v.split(',').map(Number); return { x, y }; }) } : {}),
  };
  configuration.configurationSha256 = sha(JSON.stringify(configuration));
  await fs.writeFile(path.join(mod, 'fixture.lua'), `return helpers.json_to_table([====[${JSON.stringify(configuration)}]====])\n`);
  await fs.writeFile(path.join(mod, 'control.lua'), control);
  await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'vulcanus-science-validation', version: '1.0.0', title: 'Isolated Vulcanus science validation', author: 'local', factorio_version: '2.1', dependencies: Object.entries(versions).map(([n, version]) => `${n} = ${version}`) }));
  await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...Object.keys(versions), 'vulcanus-science-validation'].map(n => ({ name: n, enabled: true })) }));
  // One update thread: the simulation is the same and the fixed hand-off cost of the multithreaded update is avoided.
  await fs.writeFile(path.join(work, 'config.ini'), `[path]\nread-data=${data}\nwrite-data=${work}\n[other]\ncheck-updates=false\nautosave-interval=0\nupdate-runner-threads-count=1\n`);
  await fs.writeFile(path.join(work, 'map-gen-settings.json'), JSON.stringify({ seed: PROTOCOL.seed, width: 512, height: 512, peaceful_mode: true, autoplace_controls: {}, default_enable_all_autoplace_controls: false }));
  const timings = {}, save = path.join(work, 'isolated.zip');
  await slot();
  await game(work, mods, ['--create', save, '--map-gen-settings', path.join(work, 'map-gen-settings.json')], 'create', timings);
  const ticks = sc.phases.reduce((n, ph) => n + (ph.mode === 'ticks' ? ph.ticks : ph.limit), 0) + 120;
  await slot();
  const output = await game(work, mods, ['--benchmark', save, '--benchmark-ticks', String(ticks), '--benchmark-runs', '1'], 'benchmark', timings);
  await fs.rm(save, { force: true });
  const report = JSON.parse(await fs.readFile(path.join(work, 'script-output/vulcanus-science/native-report.json'), 'utf8'));
  for (const key of ['failures', 'fluidFaults']) if (!Array.isArray(report[key])) report[key] = [];
  if (report.debugTiles) console.log(JSON.stringify(report.debugTiles));   // an empty Lua table arrives as {}
  assert.equal(report.blueprintSha256, configuration.blueprintSha256);
  assert.equal(report.configurationSha256, configuration.configurationSha256);
  assert.equal(report.gameVersion, configuration.gameVersion);
  const done = /^\s*([\d.]+) Script .*VULCANUS_SCIENCE_RESULT/m.exec(output), first = /^\s*([\d.]+) Script .*VULCANUS_SCIENCE_START/m.exec(output);
  report.runnerSha256 = runnerSha256; report.protocolSha256 = protocolSha256; report.wallSeconds = timings.benchmark; report.fullLength = FULL_LENGTH.includes(name);
  if (done && first) { report.activeWallSeconds = Number(done[1]) - Number(first[1]); report.timesRealTime = Math.round(report.actualTicks / report.activeWallSeconds / 6) / 10; }
  await fs.writeFile(path.join(work, 'native-report.json'), json(report));
  return report;
}
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const started = Date.now();
const reports = Object.fromEntries(await Promise.all(names.map(async name => {
  const r = await run(name);
  console.log(JSON.stringify({ scenario: name, passed: r.passed, failures: r.failures, minutes: round(r.actualTicks / 3600), wall: r.activeWallSeconds, xRealTime: r.timesRealTime, fluidFaults: r.fluidFaultCount,
    phases: r.phases.map(ph => ({ name: ph.name, min: round(ph.minutes), by: ph.endedBy, packs: Object.values(ph.packsPerMinute).map(v => round(v, 2)), crafts: Object.values(ph.packCrafts), chests: Object.values(ph.chests) })) }));
  return [name, r];
})));
const passed = names.every(n => reports[n].passed);
// The measured block the README and the page read: rates and port draws of the two full-length rate scenarios, the stone balance.
function measured() {
  const out = { ports: {}, rates: {} };
  for (const mode of ['generous', 'throttled']) {
    const ph = reports[mode]?.phases.find(v => v.name === 'steady'); if (!ph) continue;
    out.rates[mode] = Object.fromEntries(Object.entries(ph.packsPerMinute).map(([k, v]) => [k, round(v, 2)]));
    out.ports[mode] = { ...Object.fromEntries(manifest.ports.filter(v => !v.exit).map(v => [v.item, round(ph.fedPerMinute[v.id])])), stone: round(ph.stoneOutPerMinute), 'stone made': round(ph.consumedPerMinute['stone made']), 'stone used': round(ph.consumedPerMinute['stone used']) };
  }
  return out;
}
const merged = {
  schema: 1, passed, ...(explore ? { exploration: true } : {}), blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, fluidSlotsSha256: manifest.fluidSlotsSha256, gameVersion: versions.base, activeMods: versions, surface: manifest.surface,
  runnerSha256, nativeControlSha256, protocolSha256, nativeCommand: 'node scripts/vulcanus-science/production-utility-science/validate.mjs' + (explore ? ' ' + args.join(' ') : ''),
  protocol: PROTOCOL, failures: names.flatMap(n => reports[n].failures.map(f => `${n}: ${f}`)), wallSecondsTotal: (Date.now() - started) / 1000, measured: measured(),
  scenarios: Object.fromEntries(names.map(n => [n, reports[n]])),
};
await fs.mkdir(root, { recursive: true });
await fs.writeFile(path.join(root, 'native-report.json'), json(merged));
if (explore) { if (option('--keep')) await fs.writeFile(path.join(source, `exploration-${option('--keep')}-report.json`), json(merged)); } else {
  assert(names.every(n => reports[n].blueprintSha256 === manifest.candidateSha256), 'every scenario ran the same blueprint string');
  await fs.writeFile(path.join(source, 'native-report.json'), json(merged));
  await fs.writeFile(path.join(source, 'native-status.json'), json({ candidateSha256: manifest.candidateSha256, gameVersion: versions.base, status: passed ? 'passed' : 'failed', nativeProductionValidated: passed, report: 'native-report.json',
    scenarios: Object.fromEntries(names.map(n => [n, { passed: reports[n].passed, fullLength: reports[n].fullLength, configurationSha256: reports[n].configurationSha256, placedSha256: reports[n].placedSha256, simulatedTicks: reports[n].actualTicks, activeWallSeconds: reports[n].activeWallSeconds, timesRealTime: reports[n].timesRealTime, foreignFluidFaults: reports[n].fluidFaultCount }])),
    safety: 'One fresh private write-data, config, mod directory, force, Vulcanus surface and save per scenario. Only the declared ports are supplied; packs are taken from the two chests, stone from the stone exit; outside power through the marked substation.' }));
}
console.log(JSON.stringify({ passed, wallSeconds: merged.wallSecondsTotal, run: path.relative(PROJECT, root) }));
if (!passed) process.exitCode = 1;
