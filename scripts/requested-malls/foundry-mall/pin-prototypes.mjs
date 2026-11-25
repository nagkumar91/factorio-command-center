// Writes the pinned prototype snapshot this mall's generator, bill, audit and tests read: the few fields they use,
// taken from the official --dump-data output of the installed game (Factorio 2.1.25, Space Age, vanilla).
//   FACTORIO_RAW=<path to data-raw-dump.json> node scripts/requested-malls/foundry-mall/pin-prototypes.mjs
// The dump comes from `factorio --dump-data` run with an isolated config and mod directory (no save loaded).
// The provenance block holds the hashes of the game files it came from; the validator re-checks them against the
// installed game before every native run. Tests never need the dump or the game: they read prototypes.json.
//   FACTORIO_LOG=<the --dump-data console log> FACTORIO_APP=<factorio.app> (the app defaults to the Steam install)
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { HERE, sha, json } from './lib.mjs';

const raw = process.env.FACTORIO_RAW;
if (!raw) throw new Error('Set FACTORIO_RAW to the data-raw-dump.json of the installed game');
const bytes = await fs.readFile(raw), dump = JSON.parse(bytes);
const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const gameData = path.join(app, 'Contents/data');
const versions = {};
for (const name of ['base', 'quality', 'elevated-rails', 'space-age']) versions[name] = JSON.parse(await fs.readFile(path.join(gameData, name, 'info.json'), 'utf8')).version;
if (new Set(Object.values(versions)).size !== 1) throw new Error('The four official mods must share one version: ' + JSON.stringify(versions));
const SOURCES = ['base/info.json', 'space-age/info.json', 'base/prototypes/recipe.lua', 'space-age/prototypes/recipe.lua', 'base/prototypes/technology.lua', 'space-age/prototypes/technology.lua', 'base/prototypes/entity/entities.lua', 'space-age/prototypes/entity/entities.lua'];
const provenance = {
  method: 'Native --dump-data in a new isolated config/mod/write directory; no save loaded; trimmed to the fields this mall uses by pin-prototypes.mjs',
  rawSha256: sha(bytes),
  sourceHashes: Object.fromEntries(await Promise.all(SOURCES.map(async file => [file, sha(await fs.readFile(path.join(gameData, file)))]))),
  ...(process.env.FACTORIO_LOG ? { logSha256: sha(await fs.readFile(process.env.FACTORIO_LOG)) } : {}),
};

const group = (name, types) => { for (const t of types) if (dump[t]?.[name]) return dump[t][name]; throw new Error('Not in the dump: ' + name); };
const KEEP = ['name', 'type', 'collision_box', 'selection_box', 'crafting_speed', 'crafting_categories', 'fluid_boxes_off_when_no_fluid_recipe', 'energy_usage', 'active_energy_usage', 'filter_count', 'pickup_position', 'insert_position', 'rotation_speed', 'extension_speed', 'bulk', 'energy_per_movement', 'energy_per_rotation', 'inventory_size', 'logistic_mode', 'supply_area_distance', 'maximum_wire_distance', 'max_distance', 'circuit_wire_max_distance', 'speed', 'effect_receiver', 'module_slots', 'source_inventory_size', 'result_inventory_size'];
function entity(name, types) {
  const e = group(name, types), out = {};
  for (const k of KEEP) if (e[k] !== undefined) out[k] = e[k];
  if (e.energy_source) out.energy_source = Object.fromEntries(['type', 'usage_priority', 'drain', 'emissions_per_minute'].filter(k => e.energy_source[k] !== undefined).map(k => [k, e.energy_source[k]]));
  const boxes = e.fluid_boxes || (e.fluid_box ? [e.fluid_box] : null);
  if (boxes) out.fluid_boxes = boxes.map(b => ({ production_type: b.production_type, volume: b.volume, pipe_connections: b.pipe_connections.map(c => ({ flow_direction: c.flow_direction, direction: c.direction, position: c.position, ...(c.connection_type ? { connection_type: c.connection_type, max_underground_distance: c.max_underground_distance } : {}) })) }));
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
export const ENTITIES = {
  foundry: ['assembling-machine'], 'assembling-machine-3': ['assembling-machine'], 'chemical-plant': ['assembling-machine'], 'electric-furnace': ['furnace'],
  'fast-inserter': ['inserter'], 'bulk-inserter': ['inserter'], 'long-handed-inserter': ['inserter'],
  'fast-transport-belt': ['transport-belt'], 'fast-underground-belt': ['underground-belt'], pipe: ['pipe'], 'pipe-to-ground': ['pipe-to-ground'],
  substation: ['electric-pole'], 'passive-provider-chest': ['logistic-container'], 'steel-chest': ['container'], 'display-panel': ['display-panel'],
  'storage-tank': ['storage-tank'], pump: ['pump'], 'constant-combinator': ['constant-combinator'], 'decider-combinator': ['decider-combinator'], 'arithmetic-combinator': ['arithmetic-combinator'], 'selector-combinator': ['selector-combinator'],
};
// Every recipe a machine of the mall may run, plus the recipes of the entities the blueprint is built from.
export const RECIPES = [
  'molten-iron-from-lava', 'molten-copper-from-lava', 'casting-iron', 'casting-copper', 'casting-steel', 'casting-iron-gear-wheel', 'casting-iron-stick', 'casting-pipe', 'casting-copper-cable', 'casting-low-density-structure', 'concrete-from-molten-iron',
  'stone-brick', 'electronic-circuit', 'advanced-circuit', 'processing-unit', 'speed-module', 'battery', 'engine-unit', 'electric-engine-unit', 'refined-concrete', 'steel-chest',
  'assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3',
  'rocket-silo', 'cargo-landing-pad', 'space-platform-starter-pack', 'space-platform-foundation', 'asteroid-collector', 'crusher', 'electric-furnace', 'inserter', 'fast-inserter', 'solar-panel', 'accumulator', 'constant-combinator', 'arithmetic-combinator', 'decider-combinator', 'passive-provider-chest', 'substation',
  'transport-belt', 'underground-belt', 'splitter', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'express-transport-belt', 'express-underground-belt', 'express-splitter',
  'bulk-inserter', 'electric-mining-drill', 'foundry',
  // recipes this mall deliberately does not use (kept so the bill can state the comparison) and the remaining build items
  'iron-gear-wheel', 'copper-cable', 'iron-stick', 'pipe', 'low-density-structure', 'concrete',
  'chemical-plant', 'long-handed-inserter', 'pipe-to-ground', 'display-panel', 'selector-combinator', 'storage-tank', 'fast-transport-belt', 'pipe',
  // the two recipes a recipe-switching machine is parked on while it has nothing to make (their ingredients never reach it)
  'iron-ore-melting', 'wooden-chest', 'pump',
];
const out = { schema: 1, gameVersion: versions.base, activeMods: versions, provenance, absent: {}, recipes: {}, entities: {}, items: {}, fluids: {}, technologies: {}, planets: {} };
for (const name of RECIPES) {
  const r = dump.recipe[name];
  if (!r) throw new Error('No recipe ' + name);
  out.recipes[name] = { type: 'recipe', name, categories: r.categories || [r.category || 'crafting'], enabled: r.enabled === false ? false : true, energy_required: r.energy_required ?? 0.5, ingredients: r.ingredients.map(v => ({ type: v.type, name: v.name, amount: v.amount })), results: r.results.map(v => ({ type: v.type, name: v.name, amount: v.amount })), allow_productivity: r.allow_productivity === true, ...(r.surface_conditions ? { surface_conditions: r.surface_conditions } : {}) };
}
for (const [name, types] of Object.entries(ENTITIES)) out.entities[name] = entity(name, types);
const itemNames = new Set([...RECIPES.filter(r => !dump.fluid[r]), ...Object.keys(ENTITIES), 'iron-plate', 'copper-plate', 'steel-plate', 'plastic-bar', 'tungsten-carbide', 'calcite', 'stone']);
for (const r of RECIPES) for (const v of [...dump.recipe[r].ingredients, ...dump.recipe[r].results]) if (v.type === 'item') itemNames.add(v.name);
for (const name of [...itemNames].sort()) {
  const i = Object.values(dump).map(g => g[name]).find(v => v?.stack_size && v.type !== 'recipe' && v.type !== 'technology');
  if (!i) continue;
  out.items[name] = { name, stack_size: i.stack_size, ...(i.place_result ? { place_result: i.place_result } : {}), ...(i.weight ? { weight: i.weight } : {}) };
}
for (const name of ['lava', 'molten-iron', 'molten-copper', 'water', 'lubricant', 'sulfuric-acid']) out.fluids[name] = { name, default_temperature: dump.fluid[name].default_temperature };
for (const t of Object.values(dump.technology)) out.technologies[t.name] = { name: t.name, prerequisites: t.prerequisites, effects: t.effects, unit: t.unit, research_trigger: t.research_trigger };
out.planets.vulcanus = { name: 'vulcanus', surface_properties: dump.planet.vulcanus.surface_properties };
await fs.writeFile(path.join(HERE, 'prototypes.json'), json(out));
console.log(JSON.stringify({ written: 'prototypes.json', gameVersion: out.gameVersion, rawSha256: provenance.rawSha256, recipes: Object.keys(out.recipes).length, entities: Object.keys(out.entities).length, items: Object.keys(out.items).length, technologies: Object.keys(out.technologies).length }));
