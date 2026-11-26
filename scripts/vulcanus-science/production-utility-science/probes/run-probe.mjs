// Runs one native probe (a control.lua plus a JSON payload) in a private headless profile under .cache/vulcanus-science/probe-<name>/
// (Factorio 2.1.25; its own config, write-data and mod directory; never the player's). Used by the probes beside this file.
//   import { runProbe } from './run-probe.mjs';  const out = await runProbe('name', luaFile, payload, { ticks })
// With ticks = 0 the probe runs in --create only (on_init); otherwise the save is then benchmarked for that many ticks.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../../../..');
export const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
// Machine-wide budget, counted before every launch: at most 10 Factorio processes, 4 while a game without --config (the
// player's own) is running. The count includes other agents' headless games.
export function budget() {
  let lines = [];
  try { lines = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n').filter(l => l.includes('MacOS/factorio') && !l.includes('/bin/ps')); } catch {}
  const playerGame = lines.some(l => !l.includes('--config'));
  const total = playerGame ? 4 : 10;
  return { free: total - lines.length, total, running: lines.length, playerGame };
}
export async function slot() { for (;;) { if (budget().free > 0) return; await new Promise(r => setTimeout(r, 3000)); } }
export async function runProbe(name, luaFile, payload, { ticks = 0 } = {}) {
  const root = path.join(PROJECT, '.cache/vulcanus-science', 'probe-' + name), mods = path.join(root, 'mods'), mod = path.join(mods, 'probe');
  await fs.rm(root, { recursive: true, force: true }); await fs.mkdir(mod, { recursive: true });
  await fs.copyFile(luaFile, path.join(mod, 'control.lua'));
  await fs.writeFile(path.join(mod, 'payload.lua'), 'return [====[' + JSON.stringify(payload) + ']====]');
  await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'probe', version: '1.0.0', title: 'probe', author: 'local', factorio_version: '2.1', dependencies: ['base', 'space-age'] }));
  await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: ['base', 'elevated-rails', 'quality', 'space-age', 'probe'].map(n => ({ name: n, enabled: true })) }));
  await fs.writeFile(path.join(root, 'config.ini'), `[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[other]\ncheck-updates=false\nautosave-interval=0\nupdate-runner-threads-count=1\n`);
  await fs.writeFile(path.join(root, 'map.json'), JSON.stringify({ seed: 1, width: 512, height: 512, peaceful_mode: true, autoplace_controls: {}, default_enable_all_autoplace_controls: false }));
  const game = async args => { await slot(); return run(path.join(app, 'Contents/MacOS/factorio'), ['--config', path.join(root, 'config.ini'), '--mod-directory', mods, ...args], { timeout: 1800000, maxBuffer: 256e6, cwd: root }).catch(e => { throw new Error((e.stdout || '').split('\n').filter(l => /rror|PROBE/.test(l)).slice(-15).join('\n') || e.message); }); };
  await game(['--create', path.join(root, 't.zip'), '--map-gen-settings', path.join(root, 'map.json')]);
  if (ticks > 0) await game(['--benchmark', path.join(root, 't.zip'), '--benchmark-ticks', String(ticks), '--benchmark-runs', '1']);
  await fs.rm(path.join(root, 't.zip'), { force: true });
  return JSON.parse(await fs.readFile(path.join(root, 'script-output/probe.json'), 'utf8'));
}
