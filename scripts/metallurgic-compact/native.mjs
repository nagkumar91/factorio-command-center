// Native test of the compact metallurgic science pack blueprint (Factorio 2.1.25, Space Age), headless, in private profiles under
// .cache/metallurgic-compact/. Never touches the player's game data, saves or mod profile. Each scenario is its own game run.
//   node scripts/metallurgic-compact/native.mjs            the full list; writes native-report.json beside the blueprint only when all passed
//   node scripts/metallurgic-compact/native.mjs --explore [--modes a,b] [--out <folder>]   never writes into the blueprint folder
// Game processes are counted by instances.mjs of the Vulcanus supply family (at most 4 while the player's own game runs).
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { sha, readJson, json, decode } from '../vulcanus-circuits/lib.mjs';
import { GAME_DATA, BINARY, profile, game } from '../vulcanus-supplies/instances.mjs';
import { HERE, PROJECT, OUT, pins } from './generate.mjs';
import { audit } from './package.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const explore = args.includes('--explore');
const source = option('--source') ? path.resolve(option('--source')) : OUT;
const MINUTES = 3600, FLOOR = 0.99, RECOVERY = 0.95;
export const PROTOCOL = Object.freeze({
  seed: 21027, externalPowerWatts: 10000000, floorShare: FLOOR, recoveryShare: RECOVERY,
  surface: 'vulcanus (game.planets.vulcanus.create_surface, ground set to volcanic-ash-flats, all natural entities removed)',
  research: 'exactly manifest.technologyClosure, nothing else; inserter capacity bonus zero',
  feed: 'requester chests: items put into the chest, never above its request (generous: topped up at once; throttled: a credit of perMinute/3600 a tick); pipe: fluid put into one outside pipe at the entrance (generous: 1000 a tick; throttled: perMinute/3600 a tick plus the refused carry)',
  draw: 'provider chest: every pack taken out every four ticks (all), or none',
});
export function scenarios(m) {
  const target = m.target, floor = +(target * FLOOR).toFixed(2);
  const ids = m.inputPorts.map(i => i.id), all = v => Object.fromEntries(ids.map(i => [i, v]));
  const panel = Object.fromEntries(m.inputPorts.map(i => [i.id, i.panelFigure]));
  const phase = (name, minutes, feed, draw, extra = {}) => ({ name, ticks: minutes * MINUTES, feed, draw, ...extra });
  const recover = { recoverTo: { target, share: RECOVERY, withinSeconds: 300 } };
  const withheld = id => ({
    name: 'withheld:' + id, description: `${id} (${m.inputPorts.find(i => i.id === id).item}) withheld from a cold start for 20 minutes, then supplied; the other entrances offered more than needed`,
    phases: [phase('withheld', 20, { ...all('generous'), [id]: 'none' }, 'all', { expect: { maxDrawn: 0 } }), phase('supplied', 15, all('generous'), 'all', { measureFrom: 5 * MINUTES, expect: { minDrawn: floor, ...recover } })],
  });
  return {
    generous: { name: 'generous', description: 'every entrance offered more than the foundry can use; the product exit emptied, then blocked until the chest is full, then released', phases: [
      phase('warm-up', 5, all('generous'), 'all'),
      phase('steady', 20, all('generous'), 'all', { expect: { minDrawn: floor } }),
      phase('exit blocked', 15, all('generous'), 'none', { measureFrom: 5 * MINUTES, expect: { maxDrawn: 0, chestFull: true, stopped: 5 } }),
      phase('release', 10, all('generous'), 'all', { measureFrom: 3 * MINUTES, expect: { minDrawn: floor, ...recover } }),
    ] },
    panel: { name: 'panel', description: 'every entrance offered exactly the figure on its panel', phases: [
      phase('warm-up', 10, panel, 'all'),
      phase('steady', 30, panel, 'all', { expect: { minDrawn: floor } }),
    ] },
    'withheld:IN-1': withheld('IN-1'), 'withheld:IN-2': withheld('IN-2'), 'withheld:IN-3': withheld('IN-3'),
  };
}

const [{ p, slots, prototypeSha256, fluidSlotsSha256 }, manifest] = [await pins(), await readJson(path.join(source, 'manifest.json'))];
const code = (await fs.readFile(path.join(source, 'blueprint.txt'), 'utf8')).trim();
assert.equal(sha(code), manifest.candidateSha256, 'manifest does not describe this blueprint string');
assert.equal(prototypeSha256, manifest.prototypeSha256); assert.equal(fluidSlotsSha256, manifest.fluidSlotsSha256);
const staticAudit = audit(code, manifest, p, slots);
assert.equal(staticAudit.passed, true, 'Static audit is a prerequisite: ' + JSON.stringify(staticAudit.errors));
const bp = decode(code).blueprint;
// The panel figures the test feeds are the numbers written on the panels, exactly.
for (const i of manifest.inputPorts) i.panelFigure = Number(/(-?[\d,.]+)\/min/.exec(i.label)[1].replaceAll(',', ''));
const all = scenarios(manifest);
const modes = option('--modes') ? option('--modes').split(',') : Object.keys(all);
for (const m of modes) assert(all[m], 'unknown scenario ' + m);
await fs.access(BINARY, fs.constants.X_OK);
const versions = {};
for (const name of Object.keys(p.activeMods)) {
  versions[name] = JSON.parse(await fs.readFile(path.join(GAME_DATA, name, 'info.json'), 'utf8')).version;
  assert.equal(versions[name], manifest.requiredGameVersion, `Wrong installed ${name} version`);
}
for (const [file, expected] of Object.entries(p.provenance.sourceHashes)) assert.equal(sha(await fs.readFile(path.join(GAME_DATA, file))), expected, `Installed game source differs from the prototype snapshot: ${file}`);
const control = await fs.readFile(path.join(HERE, 'control.lua'), 'utf8');
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const root = path.join(PROJECT, '.cache', 'metallurgic-compact', `native-${stamp}-${process.pid}`);
const runnerSha256 = sha(await fs.readFile(fileURLToPath(import.meta.url))), nativeControlSha256 = sha(control);
const recipe = p.recipes[manifest.product];

async function runMode(mode) {
  const scenario = all[mode], work = path.join(root, mode.replace(':', '-')), mods = path.join(work, 'mods'), mod = path.join(mods, 'metallurgic-validation');
  await profile(work, mods);
  await fs.mkdir(mod, { recursive: true });
  const configuration = {
    schema: 1, blueprintSha256: manifest.candidateSha256, prototypeSha256, runnerSha256, nativeControlSha256, gameVersion: manifest.requiredGameVersion, activeMods: versions,
    blueprint: code, entities: bp.entities.map(e => ({ entity_number: e.entity_number, name: e.name, position: e.position, direction: e.direction, text: e.text })),
    manifest, technologyClosure: manifest.technologyClosure, product: manifest.product, cap: manifest.sizing.outputCap,
    recipe: { ingredients: recipe.ingredients, results: recipe.results, energy: recipe.energy_required },
    foundrySpeed: p.entities.foundry.crafting_speed, foundryProductivity: p.entities.foundry.effect_receiver.base_effect.productivity, fluidTemperature: p.fluids['molten-copper'].default_temperature,
    protocol: PROTOCOL, scenario,
  };
  configuration.configurationSha256 = sha(JSON.stringify(configuration));
  await fs.writeFile(path.join(mod, 'fixture.lua'), `return helpers.json_to_table([====[${JSON.stringify(configuration)}]====])\n`);
  await fs.writeFile(path.join(mod, 'control.lua'), control);
  await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'metallurgic-validation', version: '1.0.0', title: 'Isolated metallurgic validation', author: 'local', factorio_version: '2.1', dependencies: Object.entries(versions).map(([name, version]) => `${name} = ${version}`) }));
  await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...Object.keys(versions), 'metallurgic-validation'].map(name => ({ name, enabled: true })) }));
  await fs.writeFile(path.join(work, 'map-gen-settings.json'), JSON.stringify({ seed: PROTOCOL.seed, width: 32, height: 32, peaceful_mode: true }));
  const timings = {}, save = path.join(work, 'isolated.zip');
  await game(work, mods, ['--create', save, '--map-gen-settings', path.join(work, 'map-gen-settings.json')], 'create', timings);
  const ticks = scenario.phases.reduce((n, ph) => n + ph.ticks, 0);
  const output = await game(work, mods, ['--benchmark', save, '--benchmark-ticks', String(ticks + 1), '--benchmark-runs', '1'], 'benchmark', timings);
  await fs.rm(save, { force: true });
  const report = JSON.parse(await fs.readFile(path.join(work, 'script-output/metallurgic-compact/native-report.json'), 'utf8'));
  assert.equal(report.blueprintSha256, configuration.blueprintSha256); assert.equal(report.configurationSha256, configuration.configurationSha256);
  assert.equal(report.actualTicks, ticks);
  report.elapsedSeconds = timings;
  const first = /^\s*([\d.]+) Script .*METALLURGIC_START/m.exec(output), done = /^\s*([\d.]+) Script .*METALLURGIC_RESULT/m.exec(output);
  if (first && done) { report.activeWallSeconds = Math.round((Number(done[1]) - Number(first[1])) * 1000) / 1000; report.updatesPerSecond = Math.round(report.actualTicks / Math.max(report.activeWallSeconds, 0.001)); }
  console.error(JSON.stringify({ scenario: mode, passed: report.passed, failures: report.failures, wall: report.activeWallSeconds, phases: report.phases.map(ph => `${ph.name}: ${Math.round(ph.minutes * 10) / 10} min, out ${Math.round(ph.drawnPerMinute.measured * 100) / 100}/min, chest ${ph.chestFinal}, products ${ph.products}, ${JSON.stringify(ph.status)}`) }));
  return report;
}

const started = Date.now();
const reports = Object.fromEntries(await Promise.all(modes.map(async m => [m, await runMode(m)])));
const passed = Object.values(reports).every(r => r.passed === true) && modes.length === Object.keys(all).length;
const first = Object.values(reports)[0];
const phaseOf = (mode, name) => reports[mode]?.phases.find(ph => ph.name === name);
const measured = passed ? {
  outputsPerMinute: { [manifest.product]: { panelFigures: phaseOf('panel', 'steady').drawnPerMinute.measured, offeredMore: phaseOf('generous', 'steady').drawnPerMinute.measured } },
  inputsPerMinute: Object.fromEntries(manifest.inputPorts.map(i => [i.id, { item: i.item, panelFigure: i.panelFigure, tookAtPanelFigures: phaseOf('panel', 'steady').fedPerMinute[i.id], tookOfferedMore: phaseOf('generous', 'steady').fedPerMinute[i.id] }])),
  foundryStatusPanel: phaseOf('panel', 'steady').status, foundryStatusGenerous: phaseOf('generous', 'steady').status,
} : undefined;
const combined = {
  schema: 1, passed, exploration: explore || undefined, failures: Object.fromEntries(Object.entries(reports).map(([m, r]) => [m, r.failures])),
  blueprintSha256: manifest.candidateSha256, prototypeSha256, fluidSlotsSha256, gameVersion: first.gameVersion, activeMods: first.activeMods, nativeControlSha256, runnerSha256,
  scenarioSha256: sha(JSON.stringify(Object.fromEntries(modes.map(m => [m, all[m]])))), nativeCommand: 'node scripts/metallurgic-compact/native.mjs ' + args.join(' '), protocol: PROTOCOL,
  technologyClosure: manifest.technologyClosure, footprint: manifest.footprint, wallSecondsTotal: Math.round((Date.now() - started) / 100) / 10, runs: reports, ...(measured ? { measured } : {}),
};
await fs.mkdir(root, { recursive: true });
await fs.writeFile(path.join(root, 'native-report.json'), json(combined));
if (!explore) await fs.writeFile(path.join(source, 'native-report.json'), json(combined));
console.log(JSON.stringify({ passed, exploration: explore, blueprintSha256: combined.blueprintSha256, failures: Object.fromEntries(Object.entries(combined.failures).filter(([, f]) => f.length)), measured, wallSeconds: (Date.now() - started) / 1000, run: path.relative(PROJECT, root) }, null, 2));
if (!passed) process.exitCode = 1;
