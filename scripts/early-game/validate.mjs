// Native qualification of the Early Flight science and red-belt mall (one string, eight products, 22 west inlets).
// Adapted from the early-flight-seven validator Claude Fable 5.2 wrote for the same production cells; the mall is those
// seven workshops stacked into one stamp, so it runs the same protocol on the same checks.
// Full protocol:  node scripts/early-game/validate.mjs
// Screen:         MALL_SCREEN=1 [MALL_PHASES=warmup,measure,hold,settle,recovery] [MALL_FILE=<string file>]
//                 [MALL_TOLERATE=1] [MALL_REWIRE=1] [MALL_CENSUS=1] node scripts/early-game/validate.mjs
//   A screen never writes native-report.json. MALL_FILE screens another string (for example a history version) with
//   the manifest's products and floors. MALL_TOLERATE=1 builds a string whose entities overlap and reports the ghosts
//   that were lost, instead of stopping. MALL_REWIRE=1 stands every pole again as a hand-placed pole, which wires itself
//   to its neighbours. MALL_CENSUS=1 reports how the items held by the mall changed over the last blocked minutes.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';
import {derivePorts} from './ports.mjs';
import {protocol} from './protocol.mjs';

const run = promisify(execFile), sha = s => createHash('sha256').update(s).digest('hex');
const screen = process.env.MALL_SCREEN === '1';
const source = 'blueprint-sources/early-game';
const manifestFile = source + '/early-flight-science-mall.json';

let minutes = [protocol.warmupMinutes, protocol.measureMinutes, protocol.blockedMinutes, protocol.settleMinutes, protocol.recoveryMinutes];
if (screen) minutes = (process.env.MALL_PHASES || '20,30,0,0,0').split(',').map(Number);
const [warmup, measure, hold, settle, recovery] = minutes.map(m => Math.round(m * 3600));
const holdTail = Math.min(hold, protocol.blockedTailMinutes * 3600);

const m = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const file = screen && process.env.MALL_FILE ? process.env.MALL_FILE : source + '/' + m.blueprintFile;
const code = (await fs.readFile(file, 'utf8')).trim(), blueprint = decodeBlueprint(code).blueprint;
if (!process.env.MALL_FILE && m.blueprintSha256 !== sha(code)) throw Error('Code SHA mismatch: ' + file);
const products = m.outputs, ports = derivePorts(blueprint, products);
const builds = [{id: m.blueprintFile, file: path.relative(source, file), code, blueprintSha256: sha(code), entities: blueprint.entities.map(e => ({name: e.name, position: e.position, direction: e.direction, recipe: e.recipe, bar: e.bar})), products, inputs: ports.inputs, outputs: ports.outputs, power: ports.power, ports, minimumPerMinute: m.minimumPerMinute || {}}];

const root = path.resolve(process.env.MALL_RUN_ROOT || `.cache/early-flight-science-mall/native-${Date.now()}`);
const app = path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents');
const mod = root + '/mods/early_flight_mall_test';
await fs.mkdir(mod, {recursive: true});
await fs.writeFile(root + '/mods/mod-list.json', JSON.stringify({mods: ['base', 'elevated-rails', 'quality', 'recycler', 'space-age', 'early_flight_mall_test'].map(name => ({name, enabled: true}))}));
await fs.writeFile(mod + '/info.json', JSON.stringify({name: 'early_flight_mall_test', version: '1.0.0', title: 'Private early flight mall qualification', author: 'local', factorio_version: '2.1', dependencies: ['base = 2.1.24', 'space-age']}));
await fs.copyFile(new URL('./control.lua', import.meta.url), mod + '/control.lua');
await fs.writeFile(mod + '/payload.lua', 'return [====[' + JSON.stringify({builds, phases: {warmup, measure, hold, holdTail, settle, recovery}, tolerateLostGhosts: screen && process.env.MALL_TOLERATE === '1', rewirePoles: screen && process.env.MALL_REWIRE === '1', census: screen && process.env.MALL_CENSUS === '1'}) + ']====]');
await fs.writeFile(root + '/config.ini', `[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root + '/map.json', JSON.stringify({seed: 12345, width: 32, height: 32, default_enable_all_autoplace_controls: false}));
async function game(args, name) {
  try { const r = await run(app + '/MacOS/factorio', ['--config', root + '/config.ini', '--mod-directory', root + '/mods', ...args], {timeout: 3600000, maxBuffer: 64e6}); await fs.writeFile(root + '/' + name, r.stdout + r.stderr); }
  catch (e) { await fs.writeFile(root + '/' + name, (e.stdout || '') + (e.stderr || '')); throw Error(root + '/' + name + '\n' + (e.stdout || '').slice(-2500)); }
}
console.log(root);
await game(['--create', root + '/test.zip', '--map-gen-settings', root + '/map.json'], 'create.log');
await game(['--benchmark', root + '/test.zip', '--benchmark-ticks', String(warmup + measure + hold + settle + recovery + 1), '--benchmark-runs', '1'], 'benchmark.log');
const report = JSON.parse(await fs.readFile(root + '/script-output/result.json', 'utf8'));

for (const r of report.builds) {
  const b = builds.find(x => x.id === r.id);
  r.file = b.file; r.blueprintSha256 = b.blueprintSha256;
  r.footprint = b.ports.footprint; r.tiles = b.ports.tiles; r.counts = b.ports.counts;
  r.ports = {inputs: b.inputs.map(p => ({letter: p.letter, item: p.item, side: p.side, row: p.row})), outputs: b.outputs.map(p => ({item: p.item, column: p.column, row: p.row, bar: p.bar})), power: {column: b.power.column, row: b.power.row}};
  const failures = [];
  if (!r.powered) failures.push('not powered');
  if (r.boundingTiles.width !== r.footprint[0] || r.boundingTiles.height !== r.footprint[1]) failures.push('native bounding rectangle differs from the computed footprint');
  if (r.lostGhosts?.length) failures.push('overlapping entities: ' + r.lostGhosts.join('; '));
  if (r.displaced?.length) failures.push('not built where the string puts it: ' + r.displaced.join('; '));
  if (r.unpowered?.length) failures.push('unpowered: ' + r.unpowered.join('; '));
  if (r.substitutePowerPole) failures.push('the labelled power pole was not built');
  if (r.itemsOnGround) failures.push('items on the ground');
  for (const m of r.machines) if (!(m.measuredCrafts > 0)) failures.push('idle machine ' + (m.recipe || m.name) + ' at ' + m.x + ',' + m.y);
  for (const item of b.products) {
    if (!(r.outputsPerMinute[item] > 0)) failures.push('no ' + item + ' collected');
    if (b.minimumPerMinute[item] && r.outputsPerMinute[item] < b.minimumPerMinute[item]) failures.push(item + ' below its floor');
  }
  for (const p of r.inputs) {
    if (!(p.acceptedDuringMeasurement > 0)) failures.push('inlet ' + p.letter + ' row ' + p.row + ' accepted nothing');
    if (!(r.consumptionPerMinute[p.item] > 0)) failures.push(p.item + ' never consumed');
  }
  if (hold > 0) {
    if (!r.hold || !r.recovery) failures.push('blocked hold or recovery missing');
    else {
      for (const p of r.hold.acceptedInTail) if (p.count > 0) failures.push('inlet ' + p.letter + ' row ' + p.row + ' still accepted material at the end of the blocked hold');
      if (r.hold.working > 0) failures.push('a machine still worked at the end of the blocked hold');
      if (r.hold.tailCrafts?.length) failures.push('machines still crafting in the last ' + protocol.blockedTailMinutes + ' blocked minutes: ' + r.hold.tailCrafts.join('; '));
      if (r.hold.itemsOnGround) failures.push('items on the ground after the blocked hold');
      for (const item of b.products) {
        if (r.hold.chest[item] !== r.blockedFixture[item]) failures.push(item + ' chest did not stay at one stack while blocked');
        if (!(r.recovery.outputsPerMinute[item] > 0)) failures.push('no ' + item + ' after the blocked hold');
        if (b.minimumPerMinute[item] && r.recovery.outputsPerMinute[item] < protocol.recoveryShare * b.minimumPerMinute[item]) failures.push(item + ' below ' + protocol.recoveryShare + ' of its floor after the blocked hold');
      }
    }
  }
  r.failures = failures; r.passed = failures.length === 0 && hold > 0;
}
report.gameVersion = '2.1.24';
report.protocol = {...protocol, phasesRun: {warmupMinutes: minutes[0], measureMinutes: minutes[1], blockedMinutes: minutes[2], settleMinutes: minutes[3], recoveryMinutes: minutes[4]}};
report.passed = !screen && report.builds.every(b => b.passed);
report.createdAt = new Date().toISOString();
await fs.writeFile(root + '/native-report.json', JSON.stringify(report, null, 2) + '\n');
if (!screen) await fs.writeFile(source + '/early-flight-science-mall-native-report.json', JSON.stringify(report, null, 2) + '\n');
const short = n => Math.round(n * 1000) / 1000;
console.log(JSON.stringify(report.builds.map(b => ({id: b.id, passed: b.passed, failures: b.failures, footprint: b.footprint.join(' x '), outputs: Object.fromEntries(Object.entries(b.outputsPerMinute).map(([k, v]) => [k, short(v)])), recovery: b.recovery && Object.fromEntries(Object.entries(b.recovery.outputsPerMinute).map(([k, v]) => [k, short(v)])), accepted: b.inputs.map(i => i.letter + ' ' + i.item + ' ' + short(i.acceptedPerMinute)), consumed: Object.fromEntries(Object.entries(b.consumptionPerMinute).map(([k, v]) => [k, short(v)])), machines: b.machines.map(m => (m.recipe || m.name) + ' ' + m.measuredCrafts + ' ' + JSON.stringify(m.statusSamples))})), null, 1));
process.exitCode = screen || report.passed ? 0 : 1;
