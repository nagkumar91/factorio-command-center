// Headless Factorio instances on a shared machine: at most 10 game processes in total, at most 4 while the player's own game (a factorio
// process without --config) is running, counted before every launch. While other headless games are running this run takes about a third
// of the total. Every instance here is started with its own --config, write-data and mod directory; the player's game is never touched.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, execFile, execFileSync } from 'node:child_process';

export const APP = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
export const GAME_DATA = path.join(APP, 'Contents/data'), BINARY = path.join(APP, 'Contents/MacOS/factorio');
const ours = new Set();
export function budget() {
  let lines = [];
  try { lines = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n').filter(l => l.includes('MacOS/factorio') && !l.includes('/bin/ps')); } catch {}
  const playerGame = lines.some(l => !l.includes('--config'));
  const others = lines.filter(l => l.includes('--config') && ![...ours].some(pid => l.trim().startsWith(String(pid) + ' '))).length;
  const total = playerGame ? 4 : 10, mine = others > 0 ? Math.max(1, Math.floor(total / 3)) : total - (playerGame ? 1 : 0);
  return { free: Math.min(total - lines.length, mine - ours.size), total, running: lines.length, playerGame, others, mine };
}
let queue = Promise.resolve();
// One launch at a time passes the count, so two scenarios never take the same free place.
export function slot() {
  const turn = queue.then(async () => { for (;;) { if (budget().free > 0) return; await new Promise(r => setTimeout(r, 2000)); } });
  queue = turn.catch(() => {});
  return turn;
}
// Private profile: config, write-data and mods under one folder. One update thread: a factory this small loses time to the game's
// multithreaded update (measured on the foundry mall: about 12 times slower); the simulation is the same.
export async function profile(work, mods) {
  await fs.mkdir(mods, { recursive: true });
  await fs.writeFile(path.join(work, 'config.ini'), `[path]\nread-data=${GAME_DATA}\nwrite-data=${work}\n[other]\ncheck-updates=false\nautosave-interval=0\nupdate-runner-threads-count=${process.env.VULCANUS_UPDATE_THREADS || 1}\n`);
}
// Runs the game once in that profile; resolves with its output, rejects when it exits with an error. Holds its place until it exits.
export async function game(work, mods, gameArgs, label, timings = {}) {
  await slot();
  return new Promise((resolve, reject) => {
    const start = Date.now(); let output = '';
    const child = spawn(BINARY, ['--config', path.join(work, 'config.ini'), '--mod-directory', mods, ...gameArgs], { cwd: work });
    ours.add(child.pid);
    // Polite on a shared machine: background priority for the headless run only.
    if (process.platform === 'darwin' && child.pid) execFile('/usr/bin/taskpolicy', ['-B', '-p', String(child.pid)], () => {});
    child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
    child.on('error', e => { ours.delete(child.pid); reject(e); });
    child.on('close', async exitCode => {
      ours.delete(child.pid);
      await fs.writeFile(path.join(work, label + '.log'), output);
      timings[label] = (Date.now() - start) / 1000;
      if (exitCode !== 0) reject(new Error(`${label} failed (exit ${exitCode}); see ${path.join(work, label + '.log')}\n${output.split('\n').filter(l => /rror|VULCANUS/.test(l)).slice(-12).map(l => l.slice(0, 400)).join('\n')}`)); else resolve(output);
    });
  });
}
