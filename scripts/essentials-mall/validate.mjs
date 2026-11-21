// Native qualification for the essentials mall (adapted from scripts/robot-logistics-workshop/validate.mjs).
// Full protocol:   node scripts/essentials-mall/validate.mjs
// Exploration:     ESSENTIALS_EXPLORE=1 ESSENTIALS_PHASES=5,10,0,0,0 ESSENTIALS_CAP=none node scripts/essentials-mall/validate.mjs
//   ESSENTIALS_SOURCE=<dir> validates a candidate folder; ESSENTIALS_HOLD=<minutes> changes the cap-phase hold;
//   ESSENTIALS_SUPPLY='{"iron-plate":379}' caps entrances at so many items per minute (exploration only);
//   exploration never writes native-report.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';

const run = promisify(execFile), sha = s => createHash('sha256').update(s).digest('hex');
const id = 'essentials-mall';
const explore = process.env.ESSENTIALS_EXPLORE === '1';
const source = process.env.ESSENTIALS_SOURCE || 'blueprint-sources/' + id;
const rawPath = process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes = await fs.readFile(rawPath), raw = JSON.parse(bytes);
const [b] = JSON.parse(await fs.readFile(source + '/manifest.json'));
b.code = (await fs.readFile(source + '/' + b.file, 'utf8')).trim();
if (b.prototypeSha256 !== sha(bytes)) throw Error('Prototype SHA mismatch');
if (sha(b.code) !== b.blueprintSha256) throw Error('Code SHA mismatch');
b.entities = decodeBlueprint(b.code).blueprint.entities;
b.recipeIngredients = Object.fromEntries(Object.keys(b.machineCounts).map(n => [n, raw.recipe[n].ingredients]));

const proto = b.protocol;
let minutes = [proto.warmupMinutes, proto.measureMinutes, proto.blockedMinutes, proto.settleMinutes, proto.recoveryMinutes];
if (explore && process.env.ESSENTIALS_PHASES) minutes = process.env.ESSENTIALS_PHASES.split(',').map(Number);
const [warmup, measure, blocked, settle, recovery] = minutes.map(m => Math.round(m * 3600));
let capProducts = b.products;
if (explore && process.env.ESSENTIALS_CAP) capProducts = process.env.ESSENTIALS_CAP === 'none' ? [] : process.env.ESSENTIALS_CAP === 'all' ? b.products : process.env.ESSENTIALS_CAP.split(',');
if (!explore && (minutes.join() !== [10, 20, 5, 5, 10].join() || capProducts.length !== 8)) throw Error('Full protocol must run 10/20/5/5/10 and all eight cap phases');
const fillLimitTicks = Object.fromEntries(Object.entries(proto.fillLimitMinutes).map(([k, v]) => [k, v * 3600]));
const refillLimitTicks = Object.fromEntries(Object.entries(proto.refillLimitMinutes).map(([k, v]) => [k, v * 3600]));
// Exploration only: ESSENTIALS_HOLD=<minutes> lengthens (or shortens) every cap-phase hold.
const holdMinutes = explore && process.env.ESSENTIALS_HOLD ? Number(process.env.ESSENTIALS_HOLD) : proto.holdMinutes;
const holdTicks = holdMinutes * 3600, resumeSettleTicks = proto.resumeSettleMinutes * 3600;
const base = warmup + measure + blocked + settle + recovery;
const capBound = capProducts.reduce((n, p) => n + fillLimitTicks[p] + holdTicks + refillLimitTicks[p] + resumeSettleTicks + 120, 0);
const totalTicks = base + capBound + 600;

const root = path.resolve(process.env.ESSENTIALS_RUN_ROOT || `.cache/${id}/native-${Date.now()}`);
const app = path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents');
const mod = root + '/mods/essentials_mall_test';
await fs.mkdir(mod, {recursive: true});
await fs.writeFile(root + '/mods/mod-list.json', JSON.stringify({mods: ['base', 'elevated-rails', 'quality', 'recycler', 'space-age', 'essentials_mall_test'].map(name => ({name, enabled: true}))}));
await fs.writeFile(mod + '/info.json', JSON.stringify({name: 'essentials_mall_test', version: '1.0.0', title: 'Private essentials mall qualification', author: 'local', factorio_version: '2.1', dependencies: ['base = 2.1.24', 'space-age']}));
await fs.copyFile('scripts/' + id + '/control.lua', mod + '/control.lua');
await fs.writeFile(mod + '/data.lua', '-- No prototypes added.\n');
// Exploration only: ESSENTIALS_SUPPLY='{"iron-plate":379,...}' caps entrances at so many items per minute.
const supply = explore && process.env.ESSENTIALS_SUPPLY ? JSON.parse(process.env.ESSENTIALS_SUPPLY) : undefined;
const payload = {build: b, phases: {warmup, measure, blocked, settle, recovery}, capProducts, fillLimitTicks, refillLimitTicks, holdTicks, resumeSettleTicks, debugTopology: process.env.ESSENTIALS_DEBUG === '1', ...(supply ? {supply} : {})};
await fs.writeFile(mod + '/payload.lua', 'return [====[' + JSON.stringify(payload) + ']====]');
await fs.writeFile(root + '/config.ini', `[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root + '/map.json', JSON.stringify({seed: 12345, width: 32, height: 32, default_enable_all_autoplace_controls: false}));

async function game(args, file, allowComplete = false) {
  const task = run(app + '/MacOS/factorio', ['--config', root + '/config.ini', '--mod-directory', root + '/mods', ...args], {timeout: 4 * 3600 * 1000, maxBuffer: 64e6});
  if (process.platform === 'darwin' && task.child?.pid) await run('/usr/bin/taskpolicy', ['-B', '-p', String(task.child.pid)]).catch(() => {});
  try { const r = await task; await fs.writeFile(root + '/' + file, r.stdout + r.stderr); }
  catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    await fs.writeFile(root + '/' + file, out);
    if (allowComplete && out.includes('ESSENTIALS_HARNESS_COMPLETE')) return;
    throw Error(root + '/' + file + '\n' + out.slice(-3000));
  }
}
console.log(root);
const started = Date.now();
await game(['--create', root + '/test.zip', '--map-gen-settings', root + '/map.json'], 'create.log');
await game(['--benchmark', root + '/test.zip', '--benchmark-ticks', String(process.env.ESSENTIALS_IMPORT_ONLY === '1' ? 61 : totalTicks), '--benchmark-runs', '1'], 'benchmark.log', true);
if (process.env.ESSENTIALS_IMPORT_ONLY === '1') { console.log('Import, geometry, wiring, approaches and power checks passed.'); process.exit(0); }

const r = JSON.parse(await fs.readFile(root + '/script-output/result.json'));
r.blueprintSha256 = b.blueprintSha256;
const t = b.targets, caps = b.outputCaps;
const fails = [];
const need = (ok, msg) => { if (!ok) fails.push(msg); };
need(r.complete === true, 'run did not complete');
for (const p of b.products) {
  need((r.outputsPerMinute?.[p] ?? 0) >= t[p], `steady ${p} ${r.outputsPerMinute?.[p]?.toFixed?.(2)} < ${t[p]}`);
  need((r.recovery?.outputsPerMinute?.[p] ?? 0) >= t[p], `recovery ${p} ${r.recovery?.outputsPerMinute?.[p]?.toFixed?.(2)} < ${t[p]}`);
}
for (const m of r.machines || []) need(m.measuredCrafts > 0, `idle machine ${m.entity} ${m.recipe}`);
for (const p of r.inputs || []) need(p.acceptedDuringMeasurement > 0 && p.productiveRoute?.length >= 2, `entrance ${p.item} not productive`);
for (const p of r.outputPorts || []) need(p.collectedDuringMeasurement > 0, `output ${p.item} delivered nothing`);
need(r.powered && r.stockNetworksIsolated && r.externalApproachesClear && r.exactRecipeChecks > 0, 'native wiring/power/recipe checks');
need((r.ringOverall?.violations ?? 1) === 0 && (r.ringOverall?.maxStock ?? Infinity) < .9 * b.loopControl[0].capacity, `ring reached ${r.ringOverall?.maxStock} of ${b.loopControl[0].capacity}`);
for (const p of b.products) need((r.blocked?.chestMax?.[p] ?? 0) <= caps[p], `blocked chest ${p} over cap`);
need(Object.keys(r.chestOverCap || {}).length === 0, 'a chest exceeded its cap');
for (const h of r.bulkInserters || []) need(h.observedMaxHand <= 2, `bulk hand ${h.observedMaxHand} > 2 at ${h.entity}`);
const capTests = r.capTests || [];
need(capTests.length === capProducts.length, `cap tests ran ${capTests.length} of ${capProducts.length}`);
for (const c of capTests) {
  const p = c.product, cps = [];
  if (!c.filled) cps.push(`fill timed out at ${c.fillEndStock}/${c.cap}`);
  if (c.filled) {
    if (c.holdMismatches !== 0) cps.push(`hold mismatches ${c.holdMismatches}`);
    if (c.ringLimit != null && c.holdRingMax > c.ringLimit) cps.push(`ring ${c.holdRingMax} > limit ${c.ringLimit}`);
    const allowed = p === 'fast-inserter' ? c.consumerCraftsLastHalf : 0;
    if (!(c.finalCraftsLastHalf <= allowed)) cps.push(`final machine crafted ${c.finalCraftsLastHalf} in the last 5 hold minutes (allowed ${allowed})`);
    for (const [q, n] of Object.entries(c.othersPerMinute || {})) if (n < t[q]) cps.push(`${q} ${n.toFixed(2)} < ${t[q]} during hold`);
    if (!c.refilled) cps.push(`refill timed out at ${c.refillEndStock}/${c.cap}`);
  }
  c.passed = cps.length === 0; c.failures = cps;
  if (cps.length) fails.push(`cap ${p}: ${cps.join('; ')}`);
}
r.failures = fails;
r.passed = fails.length === 0;
const report = {
  gameVersion: '2.1.24', prototypeSha256: sha(bytes), harnessSha256: sha(await fs.readFile(mod + '/control.lua')), dataHarnessSha256: sha(await fs.readFile(mod + '/data.lua')),
  validatorSha256: sha(await fs.readFile('scripts/' + id + '/validate.mjs')), configurationSha256: sha(await fs.readFile(mod + '/payload.lua')),
  protocol: {warmupMinutes: minutes[0], measureMinutes: minutes[1], blockedMinutes: minutes[2], settleMinutes: minutes[3], recoveryMinutes: minutes[4], capProducts, holdMinutes, resumeSettleMinutes: proto.resumeSettleMinutes, fillLimitMinutes: proto.fillLimitMinutes, refillLimitMinutes: proto.refillLimitMinutes},
  warmupMinutes: minutes[0], measurementMinutes: minutes[1], createdAt: new Date().toISOString(), wallSeconds: Math.round((Date.now() - started) / 1000),
  short: explore || undefined, ...(supply ? {supplyPerMinute: supply} : {}), variant: b.variant, builds: [r], passed: r.passed,
};
const target = explore ? `.cache/${id}/explore-report.json` : source + '/native-report.json';
await fs.writeFile(target, JSON.stringify(report, null, 2) + '\n');
if (explore) await fs.writeFile(root + '/report.json', JSON.stringify(report, null, 2) + '\n');
else {
  const manifest = JSON.parse(await fs.readFile(source + '/manifest.json'));
  manifest[0].status = r.passed ? 'qualified' : 'not-qualified';
  manifest[0].nativeReport = 'native-report.json';
  manifest[0].measured = {steadyPerMinute: r.outputsPerMinute, recoveryPerMinute: r.recovery?.outputsPerMinute, failures: fails};
  await fs.writeFile(source + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
}
const round = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Math.round(v * 100) / 100]));
console.log(JSON.stringify({passed: r.passed, steady: round(r.outputsPerMinute), recovery: round(r.recovery?.outputsPerMinute), ring: r.ringOverall?.maxStock, failures: fails.slice(0, 30), wallSeconds: report.wallSeconds, target}, null, 1));
process.exitCode = r.passed ? 0 : 1;
