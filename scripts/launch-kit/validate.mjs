// Native qualification for the launch kit (adapted from scripts/essentials-mall/validate.mjs).
// Full protocol:  node scripts/launch-kit/validate.mjs
// Exploration:    LAUNCH_KIT_EXPLORE=1 [LAUNCH_KIT_PHASES=kitLimit,hold,refillLimit,longHold] [LAUNCH_KIT_SATURATE=1]
//                 [LAUNCH_KIT_SOURCE=<dir>] node scripts/launch-kit/validate.mjs
//   SPACE_EXPLORE=1 (the contract's name) works the same as LAUNCH_KIT_EXPLORE=1.
//   LAUNCH_KIT_FIRST_LAUNCH=<minute>|never (exploration only) plays a save that has never created a space platform:
//   the recipes of the trigger technologies space-platform and space-science-pack stay disabled until that game minute.
//   Exploration writes .cache/launch-kit/explore-report.json and never touches native-report.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';
import {measuredFromReport} from './generate.mjs';
import {writeReadme} from './readme.mjs';

const run = promisify(execFile), sha = s => createHash('sha256').update(s).digest('hex');
const id = 'launch-kit';
const explore = process.env.LAUNCH_KIT_EXPLORE === '1' || process.env.SPACE_EXPLORE === '1';
const source = process.env.LAUNCH_KIT_SOURCE || 'blueprint-sources/' + id;
const rawPath = process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes = await fs.readFile(rawPath), raw = JSON.parse(bytes);
const [b] = JSON.parse(await fs.readFile(source + '/manifest.json'));
b.code = (await fs.readFile(source + '/' + b.file, 'utf8')).trim();
if (b.prototypeSha256 !== sha(bytes)) throw Error('Prototype SHA mismatch');
if (sha(b.code) !== b.blueprintSha256) throw Error('Code SHA mismatch');
b.entities = decodeBlueprint(b.code).blueprint.entities;
b.recipeIngredients = Object.fromEntries(Object.keys(b.machineCounts).map(n => [n, raw.recipe[n].ingredients]));

const proto = b.protocol;
let phases = [proto.kitLimitMinutes, proto.holdMinutes, proto.refillLimitMinutes, proto.longHoldMinutes];
if (explore && process.env.LAUNCH_KIT_PHASES) phases = process.env.LAUNCH_KIT_PHASES.split(',').map(Number);
if (!explore && (proto.kitLimitMinutes < 90 || proto.holdMinutes < 15 || proto.refillLimitMinutes < 30 || proto.longHoldMinutes < 30)) throw Error('Full protocol must run kit limit >= 90, hold >= 15, refill limit >= 30, long hold >= 30 minutes');
const [kitLimit, hold, refillLimit, longHold] = phases;
const saturate = explore && process.env.LAUNCH_KIT_SATURATE === '1';
if (!explore && process.env.LAUNCH_KIT_FIRST_LAUNCH) throw Error('LAUNCH_KIT_FIRST_LAUNCH is exploration only');
// In Factorio 2.1.24 the trigger technology space-platform (create a space platform) is the only unlock of these five recipes,
// and space-science-pack (build an asteroid collector) of the last one.
const FIRST_LAUNCH_LOCKED = ['asteroid-collector', 'crusher', 'metallic-asteroid-crushing', 'oxide-asteroid-crushing', 'carbonic-asteroid-crushing', 'space-science-pack'];
const firstLaunchAt = explore ? process.env.LAUNCH_KIT_FIRST_LAUNCH : undefined;
if (firstLaunchAt && firstLaunchAt !== 'never' && !(Number(firstLaunchAt) > 0)) throw Error('LAUNCH_KIT_FIRST_LAUNCH must be a minute above 0 or never');
const firstLaunch = firstLaunchAt ? {locked: FIRST_LAUNCH_LOCKED, unlockTick: firstLaunchAt === 'never' ? undefined : Math.round(Number(firstLaunchAt) * 3600)} : undefined;
const protocol = {kitLimitTicks: kitLimit * 3600, holdTicks: hold * 3600, refillLimitTicks: refillLimit * 3600, longHoldTicks: longHold * 3600,
  holdQuietTicks: Math.min(proto.holdQuietMinutes, hold) * 3600, longHoldQuietTicks: Math.min(proto.longHoldQuietMinutes, longHold) * 3600, refill: proto.refill};
const totalTicks = (kitLimit + hold + refillLimit + longHold + 2) * 3600;

const root = path.resolve(process.env.LAUNCH_KIT_RUN_ROOT || `.cache/${id}/native-${Date.now()}`);
const app = path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents');
const mod = root + '/mods/launch_kit_test';
await fs.mkdir(mod, {recursive: true});
await fs.writeFile(root + '/mods/mod-list.json', JSON.stringify({mods: ['base', 'elevated-rails', 'quality', 'recycler', 'space-age', 'launch_kit_test'].map(name => ({name, enabled: true}))}));
await fs.writeFile(mod + '/info.json', JSON.stringify({name: 'launch_kit_test', version: '1.0.0', title: 'Private launch kit qualification', author: 'local', factorio_version: '2.1', dependencies: ['base = 2.1.24', 'space-age']}));
await fs.copyFile('scripts/' + id + '/control.lua', mod + '/control.lua');
await fs.writeFile(mod + '/data.lua', '-- No prototypes added.\n');
// Fields the generator rewrites from the report are left out of the hashed configuration.
const {status, measured, nativeReport, ...build} = b;
const payload = {build, protocol, saturate, firstLaunch};
await fs.writeFile(mod + '/payload.lua', 'return [====[' + JSON.stringify(payload) + ']====]');
await fs.writeFile(root + '/config.ini', `[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root + '/map.json', JSON.stringify({seed: 12345, width: 32, height: 32, default_enable_all_autoplace_controls: false}));

async function game(args, file, allowComplete = false) {
  const task = run(app + '/MacOS/factorio', ['--config', root + '/config.ini', '--mod-directory', root + '/mods', ...args], {timeout: 4 * 3600 * 1000, maxBuffer: 64e6});
  if (process.platform === 'darwin' && task.child?.pid) await run('/usr/bin/taskpolicy', ['-B', '-p', String(task.child.pid)]).catch(() => {});
  try { const r = await task; await fs.writeFile(root + '/' + file, r.stdout + r.stderr); if (allowComplete) throw Error('benchmark ended before the harness completed: ' + root + '/' + file); }
  catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    if (out) await fs.writeFile(root + '/' + file, out);
    if (allowComplete && out.includes('LAUNCH_KIT_HARNESS_COMPLETE')) return;
    throw Error(root + '/' + file + '\n' + (out || String(e)).slice(-3000));
  }
}
console.log(root);
const started = Date.now();
await game(['--create', root + '/test.zip', '--map-gen-settings', root + '/map.json'], 'create.log');
await game(['--benchmark', root + '/test.zip', '--benchmark-ticks', String(process.env.LAUNCH_KIT_IMPORT_ONLY === '1' ? 61 : totalTicks), '--benchmark-runs', '1'], 'benchmark.log', process.env.LAUNCH_KIT_IMPORT_ONLY !== '1');
if (process.env.LAUNCH_KIT_IMPORT_ONLY === '1') { console.log('Import, geometry, wiring, approaches and power checks passed.'); process.exit(0); }

const r = JSON.parse(await fs.readFile(root + '/script-output/result.json'));
r.blueprintSha256 = b.blueprintSha256;
const caps = b.outputCaps, exact = b.stockControl.exactLatches.map(l => l.product);
const fails = [];
const need = (ok, msg) => { if (!ok) fails.push(msg); };
const arr = x => Array.isArray(x) ? x : Object.values(x || {});
need(r.complete === true, 'run did not complete every phase');
for (const [name, kg] of Object.entries(b.launch.weightKg)) need(r.weightsKg?.[name] === kg, `weight of ${name}: game ${r.weightsKg?.[name]} kg, manifest ${kg} kg`);
need(r.fill?.complete === true && r.fill.kitMinutes <= kitLimit, `kit not complete within ${kitLimit} minutes`);
need(r.powered && r.stockNetworksIsolated && r.externalApproachesClear && r.exactRecipeChecks > 0, 'native wiring/power/recipe checks');
need((r.ringOverall?.violations ?? 1) === 0 && (r.ringOverall?.maxStock ?? Infinity) < .9 * b.loopControl[0].capacity, `ring reached ${r.ringOverall?.maxStock} of ${b.loopControl[0].capacity}`);
need(Object.keys(r.chestOverCap || {}).length === 0, 'a chest exceeded its cap: ' + JSON.stringify(r.chestOverCap));
for (const h of arr(r.bulkInserters)) need(h.observedMaxHand <= 2, `bulk hand ${h.observedMaxHand} > 2 at ${h.entity}`);
if (r.fill?.complete) {
  const f = r.fill;
  for (const item of ['rocket-silo', 'cargo-landing-pad', 'space-platform-starter-pack'])
    need(f.finishedAtKit[item] === caps[item] && f.productionStats[item] === caps[item], `${item} crafted ${f.finishedAtKit[item]} (statistics ${f.productionStats[item]}) by kit completion, cap ${caps[item]}`);
  for (const item of exact) need(f.finishedAtKit[item] === caps[item], `exact ${item} completed ${f.finishedAtKit[item]} crafts by kit completion, cap ${caps[item]}`);
  // Spec section 10 over section 8: a foundation cap of 0 must not stop the starter pack, so with a starter-pack cap
  // above 0 the foundation machine may make the starter pack's foundation (plus its ring slack), and no more.
  const fg = b.stockControl.foundationGate;
  for (const [item, cap] of Object.entries(caps)) {
    if (cap > 0) need((f.finishedAtKit[item] ?? 0) > 0, `${item} machine never crafted`);
    else if (item === 'space-platform-foundation' && caps['space-platform-starter-pack'] > 0) {
      const allowed = fg.starterPackFoundation * caps['space-platform-starter-pack'] + b.productSlack[item];
      need((f.finishedAtKit[item] ?? 0) <= allowed, `${item} has cap 0 and its machine crafted ${f.finishedAtKit[item]}, more than the starter pack's ${allowed}`);
    } else need((f.finishedAtKit[item] ?? 0) === 0, `${item} has cap 0 but its machine crafted`);
  }
  r.entrances = [];
  for (const p of [...b.inputs, ...b.fluids]) {
    const measuredPerKit = Math.round((f.acceptedAtKit[p.item] ?? 0) * 10) / 10;
    // Belt contents include the ring tiles.
    const consumed = measuredPerKit - (f.idleStock.belts[p.item] || 0) - (f.idleStock.machineInputs[p.item] || 0) - (f.idleStock.hands[p.item] || 0) - (f.idleStock.fluids[p.item] || 0);
    const e = {item: p.item, perMinute: p.perMinute, perKit: p.perKit, measuredPerKit, ratio: Math.round(measuredPerKit / p.perKit * 1000) / 1000, consumedPerKit: Math.round(consumed * 10) / 10,
      averageDrawPerMinute: Math.round(measuredPerKit / f.kitMinutes * 10) / 10, peakMinuteDraw: Math.round((f.peakMinuteDraw[p.item] ?? 0) * 10) / 10};
    r.entrances.push(e);
    // An entrance the bill gives no demand (every user at cap 0) need not accept or route anything.
    if (p.perKit > 0) need(measuredPerKit > 0, `entrance ${p.item} accepted nothing`);
    // Spec deviation (README): a material whose 15% margin is smaller than its own static storage is checked on what was consumed.
    e.rule = (proto.perKitTolerance - 1) * p.perKit < (p.staticStorage || 0) ? 'consumed' : 'accepted';
    e.consumedRatio = Math.round(e.consumedPerKit / p.perKit * 1000) / 1000;
    if (!(p.perKit > 0)) e.rule = 'no-demand';
    else if (e.rule === 'accepted') need(e.ratio <= proto.perKitTolerance, `entrance ${p.item} accepted ${measuredPerKit} by kit completion, more than ${proto.perKitTolerance} x ${p.perKit}`);
    else need(e.consumedRatio <= proto.perKitTolerance, `entrance ${p.item} consumed ${e.consumedPerKit} by kit completion, more than ${proto.perKitTolerance} x ${p.perKit} (accepted ${measuredPerKit}, static storage ${p.staticStorage})`);
  }
  const demanded = new Set([...b.inputs, ...b.fluids].filter(p => p.perKit > 0).map(p => p.item));
  for (const p of arr(r.routes)) if (demanded.has(p.item)) need(p.route && p.route.length >= 2, `entrance ${p.item} has no productive route`);
}
for (const [name, h] of [['hold', r.hold], ['long hold', r.longHold]]) {
  if (!h) { need(false, `${name} not reached`); continue; }
  need(h.mismatches === 0, `${name}: ${h.mismatches} chest samples off their caps (last ${JSON.stringify(h.lastMismatch)})`);
  need(Object.keys(h.quietCrafts).length === 0, `${name}: final machines crafted in the last ${h.quietMinutes} minutes ${JSON.stringify(h.quietCrafts)}`);
  for (const [item, n] of Object.entries(h.slackMax || {})) need(n <= b.productSlack[item], `${name}: ${n} ${item} outside its chest, slack ${b.productSlack[item]}`);
  if (name === 'hold') {
    const total = {};
    for (const [item, x] of Object.entries(h.exact)) {
      for (const [k, n] of Object.entries(x.input)) total[k] = (total[k] || 0) + n;
      need(!x.output[item], `${item} machine holds a finished product`);
      need(!x.crafting, `${item} machine is crafting during the hold`);
    }
    for (const [k, lim] of Object.entries(proto.stragglerLimits)) need((total[k] || 0) <= lim, `exact machines hold ${total[k]} ${k} after the fill, at most ${lim}`);
    h.exactStragglers = total;
  }
}
if (r.refill) {
  const f = r.refill;
  need(f.complete === true && f.minutes <= refillLimit, `selective refill incomplete after ${f.minutes} minutes: ${JSON.stringify(f.endChests)}`);
  need(f.otherChestMismatches === 0, `refill: other chests left their caps ${f.otherChestMismatches} times (${JSON.stringify(f.lastMismatch)})`);
  for (const [item, n] of Object.entries(f.removed)) if (n > 0) need((f.crafts[item] ?? 0) >= 1, `refill: ${item} machine crafted nothing new`);
  for (const [item, n] of Object.entries(f.crafts)) if (!(item in f.removed) && n > 0) need(false, `refill: ${item} machine crafted ${n} though nothing was removed`);
  if (f.removed['cargo-landing-pad'] > 0) need(f.crafts['cargo-landing-pad'] === f.removed['cargo-landing-pad'], `refill: cargo landing pad crafted ${f.crafts['cargo-landing-pad']}, removed ${f.removed['cargo-landing-pad']}`);
} else need(false, 'selective refill not reached');
r.failures = fails;
r.passed = fails.length === 0;
const report = {
  gameVersion: '2.1.24', prototypeSha256: sha(bytes), harnessSha256: sha(await fs.readFile(mod + '/control.lua')), dataHarnessSha256: sha(await fs.readFile(mod + '/data.lua')),
  validatorSha256: sha(await fs.readFile('scripts/' + id + '/validate.mjs')), configurationSha256: sha(await fs.readFile(mod + '/payload.lua')),
  protocol: {kitLimitMinutes: kitLimit, holdMinutes: hold, refillLimitMinutes: refillLimit, longHoldMinutes: longHold, holdQuietMinutes: protocol.holdQuietTicks / 3600, longHoldQuietMinutes: protocol.longHoldQuietTicks / 3600,
    refill: proto.refill, perKitTolerance: proto.perKitTolerance, perKitRule: proto.perKitRule, stragglerLimits: proto.stragglerLimits, throttled: !saturate},
  createdAt: new Date().toISOString(), wallSeconds: Math.round((Date.now() - started) / 1000),
  short: explore || undefined, firstLaunch: firstLaunch && {lockedRecipes: firstLaunch.locked, unlockMinute: firstLaunch.unlockTick === undefined ? 'never' : firstLaunch.unlockTick / 3600}, builds: [r], passed: r.passed,
};
const target = explore ? `.cache/${id}/explore-report.json` : source + '/native-report.json';
await fs.writeFile(target, JSON.stringify(report, null, 2) + '\n');
await fs.writeFile(root + '/report.json', JSON.stringify(report, null, 2) + '\n');
if (!explore) {
  const manifest = JSON.parse(await fs.readFile(source + '/manifest.json'));
  manifest[0].status = r.passed ? 'qualified' : 'native-validation-pending';
  manifest[0].nativeReport = 'native-report.json';
  manifest[0].measured = measuredFromReport(report);
  await fs.writeFile(source + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  await writeReadme(source);
}
console.log(JSON.stringify({passed: r.passed, kitMinutes: r.fill?.kitMinutes, completedMinute: firstLaunch ? r.fill?.completedMinute : undefined, refillMinutes: r.refill?.minutes, ring: r.ringOverall?.maxStock, entrances: (r.entrances || []).map(e => `${e.item} ${e.measuredPerKit}/${e.perKit} (${e.ratio})`), failures: fails.slice(0, 40), wallSeconds: report.wallSeconds, target}, null, 1));
process.exitCode = r.passed ? 0 : 1;
