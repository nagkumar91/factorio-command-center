// Launching headless Factorio for the Vulcanus circuit blueprints: one private profile per run under .cache/vulcanus-circuits/
// (its own write-data, config and mod directory; never the player's game data, saves or mod profile) and the machine-wide
// instance budget, counted before every launch: at most 10 Factorio processes in total, 4 while a game without --config (the
// player's own) is running; while other headless games are running this family takes about a third of the headless slots.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile, execFileSync } from 'node:child_process';

export const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
export const gameData = path.join(app, 'Contents/data'), binary = path.join(app, 'Contents/MacOS/factorio');
export const MODS = ['base', 'elevated-rails', 'quality', 'space-age'];
const ours = new Set();
export function budget() {
  let lines = [];
  try { lines = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n').filter(l => l.includes('MacOS/factorio') && !l.includes('/bin/ps')); } catch {}
  const playerGame = lines.some(l => !l.includes('--config'));
  const others = lines.filter(l => l.includes('--config') && ![...ours].some(pid => l.trim().startsWith(String(pid) + ' '))).length;
  const total = playerGame ? 4 : 10, headless = total - (playerGame ? 1 : 0);
  const mine = Number(process.env.VULCANUS_CIRCUITS_SLOTS) || (others > 0 ? Math.max(1, Math.floor(headless / 3)) : headless);
  return { free: Math.min(total - lines.length, mine - ours.size), total, running: lines.length, playerGame, others, ours: ours.size };
}
export async function slot() { for (;;) { if (budget().free > 0) return; await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500)); } }
// One game process. Resolves with its console output; rejects with the last error lines when it exits non-zero.
export async function game(work, mods, gameArgs, label, timings = {}) {
  await slot();
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
      if (exitCode !== 0) reject(new Error(`${label} failed; see ${path.join(work, label + '.txt')}\n${output.split('\n').filter(l => /rror|VULCANUS_CIRCUITS|PROBE/.test(l)).slice(-12).map(l => l.slice(0, 400)).join('\n')}`)); else resolve(output);
    });
  });
}
// A private profile: mod directory with one script mod (control.lua and a JSON payload), config and map settings.
// One update thread: these factories are far too small to gain from the game's multithreaded update.
export async function profile(work, modName, controlText, payload, map = { width: 512, height: 512 }) {
  const mods = path.join(work, 'mods'), mod = path.join(mods, modName);
  await fs.rm(work, { recursive: true, force: true });
  await fs.mkdir(mod, { recursive: true });
  const versions = {};
  for (const name of MODS) versions[name] = JSON.parse(await fs.readFile(path.join(gameData, name, 'info.json'), 'utf8')).version;
  await fs.writeFile(path.join(mod, 'fixture.lua'), `return helpers.json_to_table([====[${JSON.stringify(payload)}]====])\n`);
  await fs.writeFile(path.join(mod, 'control.lua'), controlText);
  await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: modName, version: '1.0.0', title: modName, author: 'local', factorio_version: '2.1', dependencies: Object.entries(versions).map(([n, v]) => `${n} = ${v}`) }));
  await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...MODS, modName].map(n => ({ name: n, enabled: true })) }));
  await fs.writeFile(path.join(work, 'config.ini'), `[path]\nread-data=${gameData}\nwrite-data=${work}\n[other]\ncheck-updates=false\nautosave-interval=0\nupdate-runner-threads-count=1\n`);
  await fs.writeFile(path.join(work, 'map-gen-settings.json'), JSON.stringify({ seed: 21026, width: map.width, height: map.height, peaceful_mode: true, autoplace_controls: {}, default_enable_all_autoplace_controls: false }));
  return { mods, versions, save: path.join(work, 'isolated.zip'), mapSettings: path.join(work, 'map-gen-settings.json') };
}
