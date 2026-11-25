// Writes prototypes.json, the pinned game data this mall reads (tests and generator need nothing else).
//   node scripts/requested-malls/assembler-3-mall/snapshot.mjs <data-raw-dump.json>
// The dump is the native `--dump-data` output of the installed Factorio 2.1.24 Space Age (vanilla, no mods).
// Recipes and items are read from the dump here. Entity geometry and the technology tree are checked against
// the dump and taken from the blue-tier mall's snapshot, which was made from the same dump (same SHA-256).
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { HERE, json, sha } from './lib.mjs';
import { prototypes as blueTier } from '../blue-tier-mall/lib.mjs';

const dumpFile = process.argv[2];
assert(dumpFile, 'usage: snapshot.mjs <data-raw-dump.json>');
const raw = await fs.readFile(dumpFile);
const dump = JSON.parse(raw);
const blue = await blueTier();
assert.equal(sha(raw), blue.provenance.rawSha256, 'the dump must be the one the blue-tier snapshot was made from');

const MACHINE_RECIPES = ['copper-cable', 'electronic-circuit', 'advanced-circuit', 'speed-module', 'iron-gear-wheel', 'assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3'];
const BUILT = ['assembling-machine-2', 'fast-inserter', 'fast-transport-belt', 'passive-provider-chest', 'medium-electric-pole', 'display-panel'];
const RAW = ['iron-plate', 'copper-plate', 'steel-plate', 'plastic-bar'];
const recipeKeys = ['type', 'name', 'enabled', 'energy_required', 'ingredients', 'results', 'categories', 'category'];
const recipes = {};
for (const name of [...MACHINE_RECIPES, ...BUILT.filter(n => n !== 'assembling-machine-2')]) recipes[name] = Object.fromEntries(Object.entries(dump.recipe[name]).filter(([k]) => recipeKeys.includes(k)));
for (const name of ['assembling-machine-2']) recipes[name] = Object.fromEntries(Object.entries(dump.recipe[name]).filter(([k]) => recipeKeys.includes(k)));
const itemTypes = ['item', 'module', 'tool', 'capsule', 'ammo', 'armor', 'gun', 'repair-tool', 'item-with-entity-data'];
const items = {};
for (const name of [...new Set([...RAW, ...MACHINE_RECIPES, ...MACHINE_RECIPES.flatMap(n => dump.recipe[n].ingredients.map(v => v.name)), ...BUILT])].sort()) {
  const type = itemTypes.find(t => dump[t]?.[name]);
  assert(type, 'item prototype ' + name);
  const proto = dump[type][name];
  items[name] = { name, stack_size: proto.stack_size, ...(proto.place_result ? { place_result: proto.place_result } : {}) };
}
// The entities this mall builds, from the blue-tier snapshot, cross-checked against the dump.
const entities = Object.fromEntries(BUILT.map(n => [n, blue.entities[n]]));
const box = b => JSON.stringify(b);
for (const [name, e] of Object.entries(entities)) {
  const proto = Object.values(dump).map(group => group?.[name]).find(v => v && typeof v === 'object' && v.type === e.type);
  assert(proto, 'entity prototype ' + name);
  assert.equal(box(proto.selection_box), box(e.selection_box), name + ' selection_box');
  if (proto.collision_box) assert.equal(box(proto.collision_box), box(e.collision_box), name + ' collision_box');
  if (e.crafting_speed) assert.equal(proto.crafting_speed, e.crafting_speed);
  if (e.supply_area_distance) assert.equal(proto.supply_area_distance, e.supply_area_distance);
  if (e.inventory_size) assert.equal(proto.inventory_size, e.inventory_size);
}
const technologies = blue.technologies;
for (const [n, t] of Object.entries(technologies)) assert.equal(JSON.stringify(t.effects || null), JSON.stringify(dump.technology[n].effects || null), 'technology ' + n);
const out = {
  schema: 1, gameVersion: blue.gameVersion, activeMods: blue.activeMods,
  provenance: { ...blue.provenance, method: 'Native --dump-data in a new isolated config/mod/write directory; no save loaded (same dump as the blue-tier mall snapshot, SHA-256 checked)', note: 'Recipes and items read from the dump by snapshot.mjs; entities and technologies cross-checked against it.' },
  absent: {}, recipes, entities, items, fluids: {}, technologies,
};
await fs.writeFile(path.join(HERE, 'prototypes.json'), json(out));
console.log(JSON.stringify({ recipes: Object.keys(recipes).length, entities: Object.keys(entities).length, items: Object.keys(items).length, technologies: Object.keys(technologies).length, sha256: sha(JSON.stringify(out, null, 2) + '\n') }));
