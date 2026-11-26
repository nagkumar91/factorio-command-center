// Native probe behind fluid-slots.json (Factorio 2.1.25, headless, private profile under .cache/vulcanus-circuits/probe-ports).
//   node scripts/vulcanus-circuits/probes/ports.mjs [--write]
// Every machine and fixed recipe of the three blueprints is imported from a blueprint in every direction, unmirrored and mirrored, on
// a Vulcanus surface. Read per fluid box: its filter and its pipe connections (the tile a pipe must occupy, from the machine centre),
// first alone and then with a pipe on every tile around the machine (which connections really join, and whether any box without a
// filter joins a pipe). Also the game's own flip rule, what a foundry does with leftover fluid when its recipe is taken away, and a
// lava foundry with one or both output ports piped. --write replaces fluid-slots.json beside the generators.
import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { HERE, PROJECT, prototypes, technologyClosure, blueprintVersion } from '../lib.mjs';
import { profile, game } from '../native.mjs';
const p = await prototypes();
export const MACHINE_RECIPES = {
  foundry: ['molten-iron-from-lava', 'molten-copper-from-lava', 'casting-iron', 'casting-copper-cable'],
  'assembling-machine-3': ['processing-unit', 'electronic-circuit', 'advanced-circuit'],
};
const ents = []; let n = 1, row = 0;
for (const [name, recipes] of Object.entries(MACHINE_RECIPES)) for (const recipe of recipes) {
  let col = 0;
  for (const mirror of [false, true]) for (const d of [0, 4, 8, 12]) { ents.push({ entity_number: n, name, position: { x: -40 + col * 10 + 0.5, y: -70 + row * 10 + 0.5 }, direction: d, recipe, ...(mirror ? { mirror: true } : {}), tags: { id: n } }); n++; col++; }
  row++;
}
const code = '0' + deflateSync(JSON.stringify({ blueprint: { item: 'blueprint', version: blueprintVersion(p.gameVersion), entities: ents } })).toString('base64');
const tech = technologyClosure(p, ['processing-unit'], ['foundry', 'assembling-machine-3', 'bulk-inserter', 'pipe-to-ground', 'substation', 'storage-tank', ...Object.values(MACHINE_RECIPES).flat()]);
const work = path.join(PROJECT, '.cache/vulcanus-circuits/probe-ports');
const prof = await profile(work, 'vulcanus-circuits-probe', await fs.readFile(path.join(HERE, 'probes/ports.lua'), 'utf8'), { code, technologies: tech.closure });
await game(work, prof.mods, ['--create', prof.save, '--map-gen-settings', prof.mapSettings], 'create');
await game(work, prof.mods, ['--benchmark', prof.save, '--benchmark-ticks', '3610', '--benchmark-runs', '1'], 'benchmark');
await fs.rm(prof.save, { force: true });
const probe = JSON.parse(await fs.readFile(path.join(work, 'script-output/probe.json'), 'utf8'));
if (probe.import !== 0) throw new Error('blueprint import');
const list = v => (Array.isArray(v) ? v : []);
const key = e => 'd' + e.dir + (e.mirror ? 'M' : '');
const slots = {}, flips = {}, notes = [], inert = {};
for (const e of probe.ents) {
  const k = e.name + '|' + e.recipe, boxes = list(e.boxes);
  slots[k] ??= {};
  // a box without a filter must have joined no pipe, and no ring pipe may have joined the machine outside the listed targets
  for (const b of boxes) if (!b.filter && list(b.conns).some(c => c.connected)) notes.push(`${k} ${key(e)}: box ${b.index} without a filter joined a pipe`);
  const filtered = boxes.filter(b => b.filter);
  slots[k][key(e)] = filtered.map(b => ({ fluid: b.filter, flow: b.conns[0].flow, targets: b.conns.map(c => c.target.map(Math.round)), joined: b.conns.map(c => c.connected === 'pipe') }));
  const targets = new Set(filtered.flatMap(b => b.conns.map(c => c.target.map(Math.round).join(','))));
  const joined = list(e.ringJoined).map(q => q.map(Math.round).join(','));
  if (joined.some(q => !targets.has(q)) || joined.length !== targets.size) notes.push(`${k} ${key(e)}: ring pipes joined ${joined.join(' ')} but the filtered boxes list ${[...targets].join(' ')}`);
  inert[k] = (inert[k] ?? true) && boxes.filter(b => !b.filter).every(b => !list(b.conns).some(c => c.connected));
}
const refused = new Set();
for (const f of probe.flips) {
  const from = 'd' + f.dir + (f.mirror ? 'M' : ''), to = 'd' + f.toDir + (f.toMirror ? 'M' : ''), axis = f.horizontal ? 'horizontal' : 'vertical';
  if (!f.ok) { refused.add(`${f.name}|${f.recipe}`); continue; }
  flips[f.name] ??= {}; flips[f.name][axis] ??= {};
  if (flips[f.name][axis][from] && flips[f.name][axis][from] !== to) throw new Error('flip rule depends on the recipe: ' + f.name);
  flips[f.name][axis][from] = to;
}
flips.refused = [...refused].sort();
const round = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Math.round(v * 100) / 100]));
const out = {
  schema: 1, gameVersion: p.gameVersion, surface: 'vulcanus', pressure: probe.pressure,
  method: 'scripts/vulcanus-circuits/probes/ports.mjs: each machine and fixed recipe imported from a blueprint in every direction, unmirrored and mirrored; get_fluid_box_pipe_connections of every fluid box with a filter (offsets of the tile a pipe must occupy, from the machine centre), read again with a pipe on every tile around the machine (joined). A recipe with one fluid ingredient joins both input ports into one box, and one fluid product leaves by both output ports. unfilteredBoxesInert: no box without a filter joined any ring pipe (the unused ports of a casting foundry and of a machine without a fluid recipe connect to nothing). leftover: a casting foundry filled through the pipe on one input port (kept full, or left empty) has its recipe taken away; what the empty pipe on its other input port holds afterwards. output: a lava foundry after one minute with a pipe on one output port or on both. flips: the direction and mirroring LuaEntity.flip leaves each machine with; a machine whose recipe has no fluid refuses the flip (flips.refused).',
  research: { technologies: tech.closure.length, inserterStackSizeBonus: probe.bonus.stack, bulkInserterCapacityBonus: probe.bonus.bulk },
  notes, unfilteredBoxesInert: inert,
  leftover: list(probe.leftover).map(v => ({ recipe: v.recipe, fedPipeKeptFull: v.fedPipeKeptFull, machineHeldBefore: round(v.heldBefore), fedPipeBefore: round(v.pipeABefore), emptyPipeBefore: round(v.pipeBBefore), machineHeldAfter: round(v.heldAfter), fedPipeAfter: round(v.pipeAAfter), emptyPipeAfter: round(v.pipeBAfter) })),
  output: list(probe.output).map(v => ({ pipesOnBothOutputPorts: v.both, crafts: v.finished, machineHolds: round(v.held), westPipe: round(v.west), eastPipe: v.east ? round(v.east) : null })),
  slots, flips,
};
if (process.argv.includes('--write')) await fs.writeFile(path.join(HERE, 'fluid-slots.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ ...out, slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v.d0])) }, null, 1));
