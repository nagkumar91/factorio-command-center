// Native probe behind fluid-slots.json (Factorio 2.1.25, headless, private config and mod directory under .cache/vulcanus-supplies/probe-fluid-slots).
//   node scripts/vulcanus-supplies/probes/fluid-slots.mjs [--write]      prints the table; --write replaces scripts/vulcanus-supplies/fluid-slots.json
// Every machine and recipe the two blueprints use is imported from a blueprint in every direction, unmirrored and mirrored, on a Vulcanus
// surface; the offsets of the tile a pipe must occupy are read with get_fluid_box_pipe_connections.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { deflateSync } from 'node:zlib';
import { HERE, PROJECT, json } from '../lib.mjs';
const run = promisify(execFile);
const ents = []; let n = 1;
const add = (name, x, y, extra) => { ents.push({ entity_number: n, name, position: { x, y }, ...extra, tags: { id: n } }); n++; };
let x = 3;
for (const mirror of [false, true]) for (const d of [0, 4, 8, 12]) { add('oil-refinery', x + 0.5, 3.5, { direction: d, recipe: 'simple-coal-liquefaction', ...(mirror ? { mirror: true } : {}) }); x += 7; }
['heavy-oil-cracking', 'light-oil-cracking', 'lubricant', 'plastic-bar', 'carbon'].forEach((r, i) => { let cx = 3; for (const mirror of [false, true]) for (const d of [0, 4, 8, 12]) { add('chemical-plant', cx + 0.5, 12.5 + i * 5, { direction: d, recipe: r, ...(mirror ? { mirror: true } : {}) }); cx += 5; } });
let x2 = 3; for (const d of [0, 4, 8, 12]) { add('assembling-machine-3', x2 + 0.5, 40.5, { direction: d, recipe: 'tungsten-carbide' }); x2 += 5; }
const code = '0' + deflateSync(JSON.stringify({ blueprint: { item: 'blueprint', version: Number((2n << 48n) + (1n << 32n) + (25n << 16n)), entities: ents } })).toString('base64');
const root = path.join(PROJECT, '.cache/vulcanus-supplies/probe-fluid-slots'), mods = path.join(root, 'mods'), mod = path.join(mods, 'probe');
const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
await fs.rm(root, { recursive: true, force: true }); await fs.mkdir(mod, { recursive: true });
await fs.copyFile(path.join(HERE, 'probes/fluid-slots.lua'), path.join(mod, 'control.lua'));
await fs.writeFile(path.join(mod, 'payload.lua'), 'return [====[' + JSON.stringify({ code }) + ']====]');
await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'probe', version: '1.0.0', title: 'probe', author: 'local', factorio_version: '2.1', dependencies: ['base', 'space-age'] }));
await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: ['base', 'elevated-rails', 'quality', 'recycler', 'space-age', 'probe'].map(name => ({ name, enabled: true })) }));
await fs.writeFile(path.join(root, 'config.ini'), `[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[other]\ncheck-updates=false\n`);
await fs.writeFile(path.join(root, 'map.json'), JSON.stringify({ seed: 1, width: 32, height: 32 }));
const game = args => run(path.join(app, 'Contents/MacOS/factorio'), ['--config', path.join(root, 'config.ini'), '--mod-directory', mods, ...args], { timeout: 600000, maxBuffer: 64e6 });
await game(['--create', path.join(root, 't.zip'), '--map-gen-settings', path.join(root, 'map.json')]);
const probe = JSON.parse(await fs.readFile(path.join(root, 'script-output/probe.json'), 'utf8'));
const slots = {};
for (const e of probe.ents) { const k = e.name + '|' + e.recipe; slots[k] ??= {}; slots[k]['d' + e.dir + (e.mirror ? 'M' : '')] = e.boxes.map(b => ({ fluid: b.filter, flow: b.conns[0].flow, targets: b.conns.map(c => c.target.map(Math.round)) })); }
const out = { schema: 1, gameVersion: '2.1.25', surface: 'vulcanus', method: 'scripts/vulcanus-supplies/probes/fluid-slots.mjs: each machine and recipe imported from a blueprint in every direction, unmirrored and mirrored; get_fluid_box_pipe_connections of every fluid box (offsets of the tile a pipe must occupy, from the machine centre). Boxes a recipe does not use are merged by the game; both tiles of a merged box carry the same fluid.', slots };
if (process.argv.includes('--write')) await fs.writeFile(path.join(HERE, 'fluid-slots.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out) === JSON.stringify(JSON.parse(await fs.readFile(path.join(HERE, 'fluid-slots.json'), 'utf8'))) ? 'identical to fluid-slots.json' : 'differs from fluid-slots.json');
