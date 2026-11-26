// Native probe behind a member's own fluid-slots.json (Factorio 2.1.25, headless, private config and mod directory under
// .cache/vulcanus-supplies/probe-ports). Never touches the player's game.
//   node scripts/vulcanus-supplies/probes/ports.mjs rocket-fuel [--write]
// For every machine and recipe of the member, in every direction, unmirrored and mirrored:
//   slots         what get_fluid_box_pipe_connections reports for every fluid box the recipe uses (the family table's format);
//   ring          a pipe put on every tile around the machine: which of them the game connected to the machine, and to which box;
//   ports         every tile where the machine type has a pipe connection at all (the ring of recipes that use every port);
//   unusedPorts   ports minus the tiles the member's recipe connects: tiles a pipe opening must never face.
// The ring and the slots must agree, or the probe fails.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { HERE, PROJECT } from '../lib.mjs';
import { profile, game } from '../instances.mjs';

const MEMBERS = {
  'rocket-fuel': {
    use: [['oil-refinery', 'simple-coal-liquefaction'], ['chemical-plant', 'heavy-oil-cracking'], ['chemical-plant', 'solid-fuel-from-light-oil'], ['assembling-machine-3', 'rocket-fuel']],
    add: ['chemical-plant|solid-fuel-from-light-oil', 'assembling-machine-3|rocket-fuel'],   // the family table has the others
    // recipes that between them use every pipe connection of the machine type
    reveal: { 'oil-refinery': ['advanced-oil-processing'], 'chemical-plant': ['heavy-oil-cracking'], 'assembling-machine-3': ['water-barrel', 'empty-water-barrel'] },
  },
};
const member = process.argv[2], spec = MEMBERS[member];
assert(spec, 'usage: ports.mjs <member> [--write]');
const pairs = [...spec.use, ...Object.entries(spec.reveal).flatMap(([name, recipes]) => recipes.map(r => [name, r]))].filter((v, i, a) => a.findIndex(w => w[0] === v[0] && w[1] === v[1]) === i);
const ents = []; let n = 1;
for (const [name, recipe] of pairs) for (const mirror of [false, true]) for (const d of [0, 4, 8, 12]) { ents.push({ entity_number: 1, name, position: { x: 0.5, y: 0.5 }, direction: d, recipe, ...(mirror ? { mirror: true } : {}), tags: { id: n } }); n++; }
const codes = ents.map(e => '0' + deflateSync(JSON.stringify({ blueprint: { item: 'blueprint', version: Number((2n << 48n) + (1n << 32n) + (25n << 16n)), entities: [e] } })).toString('base64'));
const root = path.join(PROJECT, '.cache/vulcanus-supplies/probe-ports'), mods = path.join(root, 'mods'), mod = path.join(mods, 'probe');
await fs.rm(root, { recursive: true, force: true }); await fs.mkdir(mod, { recursive: true });
await profile(root, mods);
await fs.copyFile(path.join(HERE, 'probes/ports.lua'), path.join(mod, 'control.lua'));
await fs.writeFile(path.join(mod, 'payload.lua'), 'return [====[' + JSON.stringify({ codes }) + ']====]');
await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({ name: 'probe', version: '1.0.0', title: 'probe', author: 'local', factorio_version: '2.1', dependencies: ['base', 'space-age'] }));
await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: ['base', 'elevated-rails', 'quality', 'recycler', 'space-age', 'probe'].map(name => ({ name, enabled: true })) }));
await fs.writeFile(path.join(root, 'map.json'), JSON.stringify({ seed: 1, width: 32, height: 32 }));
await game(root, mods, ['--create', path.join(root, 't.zip'), '--map-gen-settings', path.join(root, 'map.json')], 'create');
await fs.rm(path.join(root, 't.zip'), { force: true });
const probe = JSON.parse(await fs.readFile(path.join(root, 'script-output/probe.json'), 'utf8'));
assert.equal(probe.ents.length, ents.length);
const list = v => Array.isArray(v) ? v : [];   // an empty Lua table arrives as {}
const dirKey = e => 'd' + e.dir + (e.mirror ? 'M' : ''), tileKey = t => t.map(Math.round).join(',');
const slots = {}, ring = {}, ports = {}, facts = {};
for (const e of probe.ents) {
  const k = e.name + '|' + e.recipe, d = dirKey(e), boxes = list(e.boxes), around = list(e.ring);
  const table = boxes.map(b => ({ fluid: b.filter, flow: list(b.conns)[0].flow, targets: list(b.conns).map(c => c.target.map(Math.round)) }));
  // the ring agrees with the boxes: exactly the listed tiles connect, each to the box that lists it
  const fromBoxes = boxes.flatMap(b => list(b.conns).map(c => tileKey(c.target) + ' ' + b.filter)).sort(), fromRing = around.map(r => tileKey(r.target) + ' ' + r.filter).sort();
  assert.deepEqual(fromRing, fromBoxes, `${k} ${d}: pipes around the machine connect where the fluid boxes say`);
  (slots[k] ??= {})[d] = table; (ring[k] ??= {})[d] = around.map(r => tileKey(r.target)).sort();
  (facts[k] ??= {})[d] = { fluidBoxes: e.fluids_count, mirroring: e.mirror, capacities: boxes.map(b => b.capacity) };
  if (spec.reveal[e.name]?.includes(e.recipe)) (ports[e.name] ??= {})[d] = [...new Set([...(ports[e.name][d] || []), ...around.map(r => tileKey(r.target))])].sort();
}
// A machine the game does not mirror (assembling machine 3) reports mirroring false; its mirrored rows equal the unmirrored ones and are dropped.
for (const table of [slots, ring, ports, facts]) for (const [k, v] of Object.entries(table)) if (k.startsWith('assembling-machine-3')) for (const d of Object.keys(v)) if (d.endsWith('M')) delete v[d];
const unusedPorts = {};
for (const [name, recipe] of spec.use) { const k = name + '|' + recipe; unusedPorts[k] = Object.fromEntries(Object.entries(ports[name]).map(([d, all]) => [d, all.filter(t => !ring[k][d].includes(t)).map(t => t.split(',').map(Number))])); }
const family = JSON.parse(await fs.readFile(path.join(HERE, 'fluid-slots.json'), 'utf8'));
for (const [name, recipe] of spec.use) { const k = name + '|' + recipe; if (family.slots[k]) assert.deepEqual(slots[k], family.slots[k], `the family table still holds for ${k}`); }
const out = { schema: 1, member, gameVersion: '2.1.25', surface: 'vulcanus',
  method: 'scripts/vulcanus-supplies/probes/ports.mjs: each machine and recipe imported from a blueprint in every direction, unmirrored and mirrored. slots: get_fluid_box_pipe_connections of every fluid box (offsets of the tile a pipe must occupy, from the machine centre), only for the recipes the family table lacks. ports: every tile where a pipe connected to the machine under recipes that use every connection (' + Object.entries(spec.reveal).map(([m, r]) => `${m}: ${r.join(' + ')}`).join('; ') + '). unusedPorts: ports the recipe in use left unconnected when a pipe stood on every tile around the machine; no pipe opening may face them.',
  slots: Object.fromEntries(spec.add.map(k => [k, slots[k]])), ports, unusedPorts,
  facts: Object.fromEntries(spec.use.map(([a, b]) => [a + '|' + b, facts[a + '|' + b]])) };
const file = path.join(HERE, member, 'fluid-slots.json');
if (process.argv.includes('--write')) await fs.writeFile(file, JSON.stringify(out, null, 1) + '\n');
const committed = await fs.readFile(file, 'utf8').catch(() => null);
console.log(committed && JSON.stringify(JSON.parse(committed)) === JSON.stringify(out) ? `identical to ${member}/fluid-slots.json` : `differs from ${member}/fluid-slots.json`);
if (process.argv.includes('--print')) console.log(JSON.stringify(out));
