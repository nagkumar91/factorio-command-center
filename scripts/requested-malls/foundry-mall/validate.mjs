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
//   exploration-<name>-report.json. --evidence <file> writes a short summary of the run (per scenario: verdict,
//   failed checks, foreign fluids, joined fluid boxes, stray recipes, phases), used to keep the result of the new
//   fluid scenarios on an earlier published string beside the current one. --caps overrides every scenario's starting caps (tuning runs use reduced).
// Instances: at most 10 headless Factorio processes on the machine in total (4 while the player's own game runs),
// counted before every launch; about half of that for this run while another agent's headless games are running or
// the one-minute load is above 16.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { HERE, PROJECT, PUBLISHED, ID, PROTOCOL, QUALIFICATION, prototypes, readJson, json, sha, decode, encode, scenarioSummary } from './lib.mjs';
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
const FULL = { ...manifest.caps };
const REDUCED = Object.fromEntries(Object.entries(FULL).map(([k, v]) => [k, reduce(v)]));
const capSets = { full: FULL, reduced: REDUCED };
// Which products need which outside input (from the pinned recipes).
const needs = Object.fromEntries(manifest.products.map(v => [v.key, Object.keys(expand(p, { [v.item]: 1 }).outside)]));
const dependents = input => manifest.products.filter(v => needs[v.key].includes(input)).map(v => v.key);
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
  if (name === 'single') return { caps: 'reduced', phases: [fill('fill from empty'), ...protocol.singleRefills.map(item => fill('single refill: ' + item, { collectAtStart: [item], measure: true, untouched: true }))] };
  if (name.startsWith('skip:')) {
    const input = name.slice(5), dep = dependents(input), all = dep.length === manifest.products.length;
    return { caps: 'reduced', phases: [
      all ? { name: `withheld ${input}: nothing can be made`, mode: 'ticks', ticks: protocol.skipDeadTicks, withhold: [input], expect: 'nothing' }
        : { name: `withheld ${input}`, mode: 'until_caps', limit: protocol.skipLimitTicks, withhold: [input], except: dep, expect: 'caps_except', settleSeconds: protocol.skipSettleSeconds },
      fill(`after ${input} returned`) ] };
  }
  // ---- fluid safety
  if (name === 'ports') {
    const cases = [];
    for (const [role, networks] of Object.entries(protocol.matrixNetworks)) {
      const recipes = protocol.matrixRecipes[role] || [...new Set(manifest.rules.filter(r => r.machine === role).map(r => r.recipe))];
      const states = networks.reduce((list, n) => list.flatMap(st => [{ ...st, [n]: true }, { ...st, [n]: false }]), [Object.fromEntries(['molten-iron', 'molten-copper', 'water', 'lubricant'].map(n => [n, true]))]);
      for (const from of recipes) for (const to of recipes) if (from !== to) for (const state of states) cases.push({ machine: role, from, to, state });
    }
    return { caps: 'reduced', matrix: { caseTicks: protocol.matrixCaseTicks, cases, machines: Object.fromEntries(Object.keys(protocol.matrixNetworks).map(r => [r, true])), drivers: { x: -5.5, y: 1.5 } }, phases: [{ name: 'port matrix', mode: 'ticks', ticks: cases.length * protocol.matrixCaseTicks + 120, withhold: OUTSIDE, expect: 'never' }] };
  }
  if (name.startsWith('build:')) {
    const order = name.slice(6);
    if (order.startsWith('robots-')) return { caps: 'reduced', robots: { count: Number(order.slice(7)), roboport: { x: -8, y: -2 }, chests: [{ x: -9.5, y: 1.5 }, { x: -8.5, y: 1.5 }, { x: -7.5, y: 1.5 }, { x: -6.5, y: 1.5 }], limit: protocol.robotLimitTicks }, phases: [fill('fill after construction by robots')] };
    return { caps: 'reduced', build: { name: order, order: buildOrder(order), perStep: 1, stepTicks: protocol.buildStepTicks }, phases: [fill('fill after piecemeal construction')] };
  }
  if (name === 'late:power') return { caps: 'reduced', phases: [
    { name: 'no power for five minutes', mode: 'ticks', ticks: protocol.latePowerTicks, withhold: ['power'], expect: 'nothing' },
    fill('fill after power arrived') ] };
  // the stone exit is not connected: the stone belt fills and the lava foundries stop, one before the other
  if (name === 'late:stone-exit') return { caps: 'reduced', phases: [
    { name: 'stone exit blocked for an hour', mode: 'ticks', ticks: protocol.blockedStoneTicks, withhold: ['stone exit'], expect: 'never' },
    fill('fill after the stone exit was connected') ] };
  // first aid for a string whose pipes took a foreign fluid: connect the stone exit (does not help by itself), then flush
  if (name === 'recover:flush') return { caps: 'reduced', phases: [
    { name: 'stone exit blocked for an hour', mode: 'ticks', ticks: protocol.blockedStoneTicks, withhold: ['stone exit'], expect: 'never' },
    { name: 'stone exit connected, nothing flushed, twenty minutes', mode: 'ticks', ticks: 72000, expect: 'never' },
    fill('fill after every pipe run holding a foreign fluid was flushed', { flush: true }) ] };
  if (name === 'starve:supply') return { caps: 'reduced', phases: [
    fill('fill from empty'),
    { name: 'lava cut for ten minutes, every chest emptied', mode: 'ticks', ticks: protocol.cutTicks, collectAtStart: true, withhold: ['lava'], expect: 'never' },
    fill('recovery after the lava cut'),
    { name: 'calcite cut for ten minutes, every chest emptied', mode: 'ticks', ticks: protocol.cutTicks, collectAtStart: true, withhold: ['calcite'], expect: 'never' },
    fill('recovery after the calcite cut') ] };
  if (name === 'starve:foundry') return { caps: 'reduced', phases: [
    fill('fill from empty'),
    { name: 'molten copper foundry stopped for fifteen minutes, every chest emptied', mode: 'ticks', ticks: protocol.stopTicks, collectAtStart: true, stop: ['molten-copper'], expect: 'never' },
    fill('recovery after the molten copper stop'),
    { name: 'molten iron foundry stopped for fifteen minutes, every chest emptied', mode: 'ticks', ticks: protocol.stopTicks, collectAtStart: true, stop: ['molten-iron'], expect: 'never' },
    fill('recovery after the molten iron stop') ] };
  // an entrance delivers less than the two lava foundries take (lava: units a second, they take 250; calcite: items a minute, they take 30)
  if (name.startsWith('thin:')) { const input = name.slice(5); return { caps: 'reduced', phases: [
    { name: `thin ${input} from a cold start`, mode: 'ticks', ticks: protocol.thinTicks, thin: { [input]: protocol.thinSupply[input] }, collectEvery: 60, expect: 'never' },
    fill(`fill after ${input} came in full`) ] }; }
  if (name.startsWith('place:')) return { caps: 'reduced', place: name.slice(6), phases: [fill('fill from empty')] };
  if (name === 'cost') return { caps: 'full', phases: [{ name: 'script cost', mode: 'ticks', ticks: Number(option('--ticks') || 36000) }] };
  if (name === 'custom') return JSON.parse(option('--phases'));
  assert.fail('unknown scenario ' + name);
}
// ---- piecemeal construction orders (seeded, so a run can be repeated)
function shuffled(list, seed) {
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out;
}
function buildOrder(name) {
  const all = bp.blueprint.entities, ids = list => list.map(e => e.entity_number);
  const PIPES = ['pipe', 'pipe-to-ground', 'storage-tank', 'pump'], MACHINES = ['foundry', 'assembling-machine-3', 'chemical-plant', 'electric-furnace', 'substation'], COMBINATORS = ['decider-combinator', 'arithmetic-combinator', 'selector-combinator', 'constant-combinator'];
  const split = test => [shuffled(ids(all.filter(test)), 11), shuffled(ids(all.filter(e => !test(e))), 12)];
  const foundry = role => manifest.machines.find(m => m.role === role).entity;
  if (name.startsWith('shuffle-')) return shuffled(ids(all), Number(name.slice(8)));
  if (name === 'pipes-first') return split(e => PIPES.includes(e.name)).flat();
  if (name === 'machines-first') return split(e => MACHINES.includes(e.name)).flat();
  if (name === 'combinators-last') return split(e => !COMBINATORS.includes(e.name)).flat();
  // one lava foundry arrives ten minutes after everything else: one molten metal exists for a long time and the other does not
  if (name === 'copper-foundry-last') return [...shuffled(ids(all.filter(e => e.entity_number !== foundry('molten-copper'))), 13), -protocol.buildGapTicks, foundry('molten-copper')];
  if (name === 'iron-foundry-last') return [...shuffled(ids(all.filter(e => e.entity_number !== foundry('molten-iron'))), 14), -protocol.buildGapTicks, foundry('molten-iron')];
  assert.fail('unknown build order ' + name);
}
// ---- the blueprint as it lies when placed turned (the game turns it: build direction) or mirrored (a mirror image
// is written here as its own string: positions and directions mirrored, the mirror flag set on the machines whose
// fluid ports are not symmetric, the storage tanks on their other diagonal; the game has no script call that flips a blueprint)
const TURNS = { none: 0, rot90: 1, rot180: 2, rot270: 3, flipH: 0, flipV: 0 };
function placeAs(kind = 'none') {
  if (kind === 'none') return { entities: bp.blueprint.entities, manifest, blueprint: code };
  const k = TURNS[kind], flip = kind === 'flipH' ? 'h' : kind === 'flipV' ? 'v' : null;
  const zero = v => (v === 0 ? 0 : v);
  const pos = ({ x, y }) => { if (flip === 'h') x = -x; if (flip === 'v') y = -y; for (let i = 0; i < k; i++) [x, y] = [-y, x]; return { x: zero(x), y: zero(y) }; };
  const dir = d => { d = d || 0; if (flip === 'h') d = (16 - d) % 16; if (flip === 'v') d = (24 - d) % 16; return (d + 4 * k) % 16; };
  const MIRRORED = ['foundry', 'chemical-plant'];
  const entities = bp.blueprint.entities.map(e => ({ ...e, position: pos(e.position), direction: dir(e.direction),
    ...(flip && MIRRORED.includes(e.name) ? { mirror: !e.mirror } : {}), ...(flip && e.name === 'storage-tank' ? { direction: (dir(e.direction) + 4) % 8 } : {}) }));
  const pole = manifest.power.externalPolePosition;
  const placed = { ...manifest, ports: manifest.ports.map(v => ({ ...v, externalContact: pos(v.externalContact), ...(v.exit ? { sinkDirection: dir(12) } : {}) })),
    power: { ...manifest.power, externalPolePosition: pos(pole), externalSourcePosition: pos({ x: pole.x - 3, y: pole.y }) } };
  const blueprint = flip ? encode({ blueprint: { ...bp.blueprint, entities } }) : code;
  return { entities, manifest: placed, blueprint, place: { name: kind, direction: 4 * k, mirrored: !!flip, blueprintSha256: sha(blueprint) } };
}
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
  const others = lines.filter(l => l.includes('--config') && ![...ours].some(pid => l.trim().startsWith(String(pid) + ' '))).length;
  const total = playerGame ? 4 : 10, mine = others > 0 || os.loadavg()[0] > 16 ? Math.ceil(total / 2) : total;
  return { free: Math.min(total - lines.length, mine - ours.size), total, running: lines.length, playerGame, others };
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
      if (exitCode !== 0) reject(new Error(`${label} failed; see ${path.join(work, label + '.txt')}\n${output.split('\n').filter(l => /rror|FOUNDRY/.test(l)).slice(-12).map(l => l.slice(0, 300)).join('\n')}`)); else resolve(output);
    });
  });
}
async function run(name) {
  const work = path.join(root, name.replace(':', '-')), mods = path.join(work, 'mods'), mod = path.join(mods, 'foundry-mall-validation');
  await fs.mkdir(mod, { recursive: true });
  const sc = scenario(name), capsName = explore && option('--caps') ? option('--caps') : sc.caps, placed = placeAs(sc.place);
  const configuration = {
    schema: 2, scenario: name, capsName, startCaps: capSets[capsName], blueprintSha256: manifest.candidateSha256, prototypeSha256: manifest.prototypeSha256, nativeControlSha256: sha(control), runnerSha256,
    gameVersion: manifest.requiredGameVersion, activeMods: versions, blueprint: placed.blueprint, entities: placed.entities, manifest: placed.manifest, technologyClosure: manifest.technologyClosure,
    ...(placed.place ? { place: placed.place } : {}), ...(sc.build ? { build: sc.build } : {}), ...(sc.robots ? { robots: sc.robots } : {}), ...(sc.matrix ? { matrix: sc.matrix } : {}),
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
  // an exploration keeps the other scenarios when one instance stops with an error; a qualifying run does not
  const r = await run(name).catch(e => { if (!explore) throw e; return { scenario: name, passed: false, failures: ['the instance stopped: ' + String(e.message).split('\n').slice(0, 3).join(' | ').slice(0, 600)], phases: [], caps: {}, crashed: true }; });
  console.log(JSON.stringify({ scenario: name, caps: r.capsName, passed: r.passed, failures: r.failures, ticks: r.actualTicks, activeWallSeconds: r.activeWallSeconds, ups: r.activeUpdatesPerSecond, xRealTime: r.timesRealTime, phases: r.phases.map(ph => ({ name: ph.name, minutes: minutes(ph.ticks), endedBy: ph.endedBy, levels: Object.fromEntries(Object.entries(ph.levelTicks).map(([k, v]) => [k, minutes(v)])), reached: Object.fromEntries(Object.entries(ph.reached).sort((a, b) => a[1] - b[1]).map(([k, v]) => [k, minutes(v)])), short: Object.fromEntries(Object.entries(ph.stock).filter(([k, v]) => v < (ph.caps || r.caps)[k])), switches: ph.switches, peak: ph.peak, gatedActive: ph.gatedActive })), ringPeakTotal: r.ringPeakTotal, ringBound: r.ringBound, construction: r.construction && { ...r.construction, deferred: (r.construction.deferred || []).length }, fluidFaults: r.fluidFaults, portJoins: r.portJoins, matrix: r.matrix && { cases: r.matrix.cases, leaks: r.matrix.leaks, joins: r.matrix.joins } }));
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
if (explore && option('--evidence')) await fs.writeFile(path.resolve(option('--evidence')), json({ schema: 1, kind: 'summary of an exploration run of the foundry mall validator', blueprintSha256: manifest.candidateSha256, gameVersion: versions.base, nativeControlSha256: sha(control), runnerSha256, nativeCommand: merged.nativeCommand.replace(/--(source|evidence) \S+ ?/g, '').trim(), passed, limitTicks: protocol.fillLimitTicks, scenarios: Object.fromEntries(names.map(n => [n, scenarioSummary(reports[n])])) }));
if (explore) {
  if (option('--keep')) await fs.writeFile(path.join(source, `exploration-${option('--keep')}-report.json`), json(merged));
} else {
  assert(names.every(n => reports[n].blueprintSha256 === manifest.candidateSha256), 'every scenario ran the same blueprint string');
  await fs.writeFile(path.join(source, 'native-report.json'), json(merged));
  await fs.writeFile(path.join(source, 'native-status.json'), json({ candidateSha256: manifest.candidateSha256, gameVersion: versions.base, status: passed ? 'passed' : 'failed', nativeProductionValidated: passed, report: 'native-report.json', scenarios: Object.fromEntries(names.map(n => [n, { passed: reports[n].passed, caps: reports[n].capsName, configurationSha256: reports[n].configurationSha256, simulatedTicks: reports[n].actualTicks, activeWallSeconds: reports[n].activeWallSeconds, updatesPerSecond: reports[n].activeUpdatesPerSecond }])), safety: 'One fresh private write-data, config, mod directory, force, Vulcanus surface and save per scenario. Only the declared entrances, a sink on the stone exit and outside power are supplied.', protocol }));
}
console.log(JSON.stringify({ passed, wallSeconds: merged.wallSecondsTotal, run: path.relative(PROJECT, root) }));
if (!passed) process.exitCode = 1;
