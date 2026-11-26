// Native probe behind fluid-slots.json (Factorio 2.1.25, headless, private profile under .cache/vulcanus-science/probe-fluid-slots).
//   node scripts/vulcanus-science/production-utility-science/probes/fluid-slots.mjs [--write]
// Every machine and fixed recipe of the build is imported from a blueprint in every direction, unmirrored and mirrored, on a Vulcanus
// surface. Read per fluid box: its filter and its pipe connections (the tile a pipe must occupy, from the machine centre), first
// alone and then with a pipe on every tile around the machine (which connections really join). Also the game's own flip rule
// (LuaEntity.flip on each axis). --write replaces fluid-slots.json beside the generator.
import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { HERE, json, prototypes, technologyClosure, blueprintVersion } from '../lib.mjs';
import { runProbe } from './run-probe.mjs';
const p = await prototypes();
export const MACHINE_RECIPES = {
  foundry: ['molten-iron-from-lava', 'molten-copper-from-lava', 'casting-iron', 'casting-copper', 'casting-steel', 'casting-iron-gear-wheel', 'casting-iron-stick', 'casting-pipe', 'casting-copper-cable', 'casting-low-density-structure'],
  'assembling-machine-3': ['processing-unit', 'electric-engine-unit', 'electronic-circuit'],
  'chemical-plant': ['battery'],
};
const ents = []; let n = 1, row = 0;
for (const [name, recipes] of Object.entries(MACHINE_RECIPES)) for (const recipe of recipes) {
  let col = 0;
  for (const mirror of [false, true]) for (const d of [0, 4, 8, 12]) { ents.push({ entity_number: n, name, position: { x: -40 + col * 10 + 0.5, y: -70 + row * 10 + 0.5 }, direction: d, recipe, ...(mirror ? { mirror: true } : {}), tags: { id: n } }); n++; col++; }
  row++;
}
const code = '0' + deflateSync(JSON.stringify({ blueprint: { item: 'blueprint', version: blueprintVersion(p.gameVersion), entities: ents } })).toString('base64');
const tech = technologyClosure(p, ['production-science-pack', 'utility-science-pack'], ['foundry', 'assembling-machine-3', 'chemical-plant', 'bulk-inserter', 'pipe-to-ground', ...Object.values(MACHINE_RECIPES).flat()]);
const probe = await runProbe('fluid-slots', path.join(HERE, 'probes/fluid-slots.lua'), { code, technologies: tech.closure });
if (probe.import !== 0) throw new Error('blueprint import');
const key = e => 'd' + e.dir + (e.mirror ? 'M' : '');
const slots = {}, flips = {}, notes = [];
for (const e of probe.ents) {
  const k = e.name + '|' + e.recipe;
  const list = Array.isArray(e.boxes) ? e.boxes : [];
  if (list.length) slots[k] ??= {};
  // a box is listed when it has a filter; a box without a filter must have no connection that joined a pipe
  for (const b of list) if (!b.filter && (b.conns || []).some?.(c => c.connected)) notes.push(`${k} ${key(e)}: box ${b.index} without a filter joined a pipe`);
  if (!list.length) continue;
  slots[k][key(e)] = list.filter(b => b.filter).map(b => ({ fluid: b.filter, flow: b.conns[0].flow, targets: b.conns.map(c => c.target.map(Math.round)), joined: b.conns.map(c => c.connected === 'pipe') }));
}
// The flip rule is one table per machine. A machine whose recipe has no fluid refuses the flip (it has no ports to move) and is listed apart.
const refused = new Set();
for (const f of probe.flips) {
  const k = f.name, from = 'd' + f.dir + (f.mirror ? 'M' : ''), to = 'd' + f.toDir + (f.toMirror ? 'M' : ''), axis = f.horizontal ? 'horizontal' : 'vertical';
  if (!f.ok) { refused.add(`${f.name}|${f.recipe}`); continue; }
  flips[k] ??= {}; flips[k][axis] ??= {};
  if (flips[k][axis][from] && flips[k][axis][from] !== to) throw new Error('flip rule depends on the recipe: ' + k);
  flips[k][axis][from] = to;
}
flips.refused = [...refused].sort();
const out = { schema: 1, gameVersion: p.gameVersion, surface: 'vulcanus', method: 'scripts/vulcanus-science/production-utility-science/probes/fluid-slots.mjs: each machine and fixed recipe imported from a blueprint in every direction, unmirrored and mirrored; get_fluid_box_pipe_connections of every fluid box with a filter (offsets of the tile a pipe must occupy, from the machine centre), read again with a pipe on every tile around the machine (joined). Both connection tiles of a box a one-fluid recipe uses carry that fluid: the game merges the second port into the first. flips: the direction and mirroring LuaEntity.flip leaves each machine with, per axis; a machine whose recipe has no fluid refuses the flip and stays as it is (flips.refused).', research: { technologies: tech.closure.length, inserterStackSizeBonus: probe.bonus.stack, bulkInserterCapacityBonus: probe.bonus.bulk }, notes, slots, flips };
if (process.argv.includes('--write')) await fs.writeFile(path.join(HERE, 'fluid-slots.json'), JSON.stringify(out, null, 1) + '\n');
if (process.argv.includes('--raw')) console.log(JSON.stringify(probe.ents.filter(e => e.dir === 0 || e.dir === 4).map(e => ({ k: e.name + '|' + e.recipe + ' ' + key(e), before: e.before, boxes: e.boxes }))));
const committed = await fs.readFile(path.join(HERE, 'fluid-slots.json'), 'utf8').catch(() => '');
console.log(committed && JSON.stringify(out) === JSON.stringify(JSON.parse(committed)) ? 'identical to fluid-slots.json' : 'differs from fluid-slots.json');
console.log(JSON.stringify({ bonus: probe.bonus, notes }));
