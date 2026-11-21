// Native production protocol for the Luna compact builds (Factorio 2.1.24, Space Age, no other mods).
// It is the protocol that qualified the original trials: the flight native runner with the same
// 2.1 solid-recipe adapter as experiments/luna-compaction/native.mjs, 15 simulated minutes of
// warm-up, then 30 measured minutes in three windows, inputs only at the declared belts, outputs
// only from the declared ports, external electricity at one saved pole.
// Everything it writes stays under .cache/<cache id>/ (private config, mods, saves, logs).
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

export const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FULL = {warmupTicks: 54000, measurementTicks: 108000, windows: 3};
const replace = (source, from, to) => {
  if (!source.includes(from)) throw Error('Adapter source contract changed: ' + from);
  return source.replaceAll(from, to);
};

async function adapter(cacheRoot) {
  const scratch = path.join(cacheRoot, 'adapter');
  await fs.mkdir(scratch, {recursive: true});
  let runner = await fs.readFile(path.join(project, 'scripts/flight-native-run.mjs'), 'utf8');
  let control = await fs.readFile(path.join(project, 'scripts/flight-native-control.lua'), 'utf8');
  runner = replace(runner, "const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');", `const project = ${JSON.stringify(project)};`);
  runner = replace(runner, "'.cache/flight-native'", JSON.stringify(path.relative(project, path.join(cacheRoot, 'native'))));
  runner = runner.replace(/from '(\.\/flight-[^']+)'/g, (_, file) => `from '${pathToFileURL(path.join(project, 'scripts', file)).href}'`);
  runner = replace(runner, '2.0.77', '2.1.24');
  runner = replace(runner, "factorio_version:'2.0'", "factorio_version:'2.1'");
  control = replace(control, '2.0.77', '2.1.24');
  control = replace(control, "e.type=='furnace' and defines.inventory.furnace_source or defines.inventory.assembling_machine_input", 'defines.inventory.crafter_input');
  // 2.1 removed LuaEntity.fluidbox. These builds are solid-only; reject fluids instead of skipping them.
  control = replace(control, "local recipe=e.get_recipe()\n    local fluids={}", "local recipe=e.get_recipe()\n    for _,v in pairs(recipe.prototype.ingredients) do check(v.type~='fluid','solid-only protocol') end\n    for _,v in pairs(recipe.prototype.products) do check(v.type~='fluid','solid-only protocol') end\n    local fluids={}");
  const fluidStart = control.indexOf('    for i=1,#e.fluidbox do');
  const fluidEnd = control.indexOf('    local burner=e.burner', fluidStart);
  if (fluidStart < 0 || fluidEnd < 0) throw Error('Fluid diagnostic contract changed');
  control = control.slice(0, fluidStart) + control.slice(fluidEnd);
  const controlPath = path.join(scratch, 'control.lua');
  runner = replace(runner, "path.join(project,'scripts/flight-native-control.lua')", JSON.stringify(controlPath));
  await fs.writeFile(controlPath, control);
  await fs.writeFile(path.join(scratch, 'run.mjs'), runner);
  return path.join(scratch, 'run.mjs');
}

/** Run the protocol for one prepared spec. Returns the runner's report for that id. */
export async function runLunaNative({cacheId, spec, code, raw = process.env.FACTORIO_RAW, timing = FULL, quiet = false}) {
  if (!raw) throw Error('Set FACTORIO_RAW to the official Factorio 2.1.24 Space Age prototype dump');
  const cacheRoot = path.join(project, '.cache', cacheId);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const work = path.join(cacheRoot, 'spec-' + stamp);
  await fs.mkdir(work, {recursive: true});
  const mods = path.join(cacheRoot, 'vanilla-mods');
  await fs.mkdir(mods, {recursive: true});
  await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({mods: ['base', 'elevated-rails', 'quality', 'recycler', 'space-age'].map(name => ({name, enabled: true}))}, null, 1) + '\n');
  const {createHash} = await import('node:crypto');
  const sha = text => createHash('sha256').update(text).digest('hex');
  const rawBytes = await fs.readFile(raw);
  const blueprintPath = path.relative(project, path.join(work, spec.id + '.txt'));
  await fs.writeFile(path.join(project, blueprintPath), code + '\n');
  const full = {...spec, blueprintPath, blueprintSha256: sha(code), prototypeDumpSha256: sha(rawBytes), rateToleranceFraction: .01, ...timing};
  const specsPath = path.join(work, 'specs.json');
  await fs.writeFile(specsPath, JSON.stringify({prototypeDumpSha256: full.prototypeDumpSha256, factories: [full]}, null, 2) + '\n');
  const run = await adapter(cacheRoot);
  const output = [];
  const code0 = await new Promise(resolve => {
    const child = spawn(process.execPath, [run, '--specs', path.relative(project, specsPath), '--prototype', raw, '--mods', path.relative(project, mods), '--workers', '1'], {cwd: project});
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output.push(String(chunk)); if (!quiet) process.stdout.write(chunk); });
    child.on('exit', resolve);
  });
  const match = output.join('').match(/Native report: (\S+summary\.json)/);
  if (!match) throw Error('Native runner produced no report (exit ' + code0 + '):\n' + output.join('').slice(-3000));
  const reportPath = path.join(project, path.dirname(match[1]), spec.id + '.json');
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  return {report, reportPath, exitCode: code0, summaryPath: path.join(project, match[1])};
}
