// Re-run the preserved standalone annex harness without touching a user profile.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyEvidence} from './export.mjs';
const directory = path.dirname(fileURLToPath(import.meta.url));
const {spec, report: original} = await verifyEvidence();
if (!process.argv.includes('--run')) {
  console.log('Preserved evidence verified for 15 and 30 labs. Use --run with FACTORIO_APP set to rerun in .cache/rgby-labs.');
} else {
  assert.ok(process.env.FACTORIO_APP, 'Set FACTORIO_APP to the Factorio .app bundle');
  const app = path.resolve(process.env.FACTORIO_APP), binary = path.join(app, 'Contents/MacOS/factorio');
  const run = promisify(execFile), version = (await run(binary, ['--version'])).stdout.match(/Version: (\d+\.\d+\.\d+)/)[1];
  assert.equal(version, spec.gameVersion, 'Preserved test requires the recorded game version');
  const root = path.resolve(directory, '../../../../.cache/rgby-labs', `preserved-${Date.now()}`);
  const mod = path.join(root, 'mods/rgby_lab_test_1.0.0');
  await fs.mkdir(mod, {recursive: true});
  for (const [source, target] of [['native-control.lua', 'control.lua'], ['native-data.lua', 'data.lua']])
    await fs.copyFile(path.join(directory, source), path.join(mod, target));
  await fs.writeFile(path.join(mod, 'payload.lua'), 'return [====[' + JSON.stringify(spec.builds) + ']====]');
  await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({name: 'rgby_lab_test', version: '1.0.0', title: 'Isolated lab annex test',
    author: 'local', factorio_version: version.split('.').slice(0, 2).join('.'), dependencies: [`base = ${version}`]}));
  // Match the built-in expansion modules observed in the original create log explicitly.
  await fs.writeFile(path.join(root, 'mods/mod-list.json'), JSON.stringify({mods: ['base', 'elevated-rails', 'recycler', 'quality', 'space-age', 'rgby_lab_test'].map(name => ({name, enabled: true}))}));
  await fs.writeFile(path.join(root, 'config.ini'), `[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
  await fs.writeFile(path.join(root, 'map.json'), JSON.stringify({seed: 12345, width: 32, height: 32, default_enable_all_autoplace_controls: false}));
  async function factorio(args, log) {
    try {
      const result = await run(binary, ['--config', path.join(root, 'config.ini'), '--mod-directory', path.join(root, 'mods'), ...args], {timeout: 110000, maxBuffer: 8e6});
      await fs.writeFile(path.join(root, log), result.stdout + result.stderr);
    } catch (error) {
      await fs.writeFile(path.join(root, log), (error.stdout || '') + (error.stderr || ''));
      throw new Error(`Native run failed; see ${path.join(root, log)}`);
    }
  }
  await factorio(['--create', path.join(root, 'test.zip'), '--map-gen-settings', path.join(root, 'map.json')], 'create.log');
  await factorio(['--benchmark', path.join(root, 'test.zip'), '--benchmark-ticks', String(spec.ticks), '--benchmark-runs', '1'], 'benchmark.log');
  const report = JSON.parse(await fs.readFile(path.join(root, 'script-output/report.json')));
  Object.assign(report, {gameVersion: version, prototypeSha256: original.prototypeSha256,
    entityWireSha256: original.entityWireSha256,
    preservedSpecSha256: createHash('sha256').update(await fs.readFile(path.join(directory, 'native-spec.json'))).digest('hex'),
    scope: spec.scope});
  await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(path.join(root, 'report.json'));
  assert.equal(report.passed, true);
  assert.deepEqual(report.builds.map(b => b.labs.length), [15, 30]);
}
