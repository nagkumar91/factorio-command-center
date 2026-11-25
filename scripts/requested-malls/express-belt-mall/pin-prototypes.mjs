// Writes the pinned prototype snapshot this mall's generator, audit and tests read: the few fields they use,
// taken from the official --dump-data output of the installed game (Factorio 2.1.24, Space Age, vanilla).
//   FACTORIO_RAW=<path to data-raw-dump.json> node scripts/requested-malls/express-belt-mall/pin-prototypes.mjs
// The dump comes from `factorio --dump-data` run with an isolated config and mod directory (no save loaded),
// and the provenance block holds the hashes of the game files it came from; the validator re-checks them against
// the installed game before every native run. Tests never need the dump or the game: they read prototypes.json.
//   FACTORIO_LOG=<the --dump-data console log> FACTORIO_APP=<factorio.app> (the app defaults to the Steam install)
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { HERE, PROJECT, sha, readJson, json } from './lib.mjs';

const raw = process.env.FACTORIO_RAW;
if (!raw) throw new Error('Set FACTORIO_RAW to the data-raw-dump.json of the installed game');
const bytes = await fs.readFile(raw), dump = JSON.parse(bytes);
const blue = await readJson(path.join(PROJECT, 'scripts/requested-malls/blue-tier-mall/prototypes.json'));
const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const gameData = path.join(app, 'Contents/data');
const versions = {};
for (const name of ['base', 'quality', 'elevated-rails', 'space-age']) versions[name] = JSON.parse(await fs.readFile(path.join(gameData, name, 'info.json'), 'utf8')).version;
if (new Set(Object.values(versions)).size !== 1) throw new Error('The four official mods must share one version: ' + JSON.stringify(versions));
const provenance = {
  method: 'Native --dump-data in a new isolated config/mod/write directory; no save loaded; trimmed to the fields this mall uses by pin-prototypes.mjs',
  rawSha256: sha(bytes),
  sourceHashes: Object.fromEntries(await Promise.all(Object.keys(blue.provenance.sourceHashes).map(async file => [file, sha(await fs.readFile(path.join(gameData, file)))]))),
  ...(process.env.FACTORIO_LOG ? { logSha256: sha(await fs.readFile(process.env.FACTORIO_LOG)) } : {}),
};

const group = (name, types) => { for (const t of types) if (dump[t]?.[name]) return dump[t][name]; throw new Error('Not in the dump: ' + name); };
const KEEP = ['name', 'type', 'collision_box', 'selection_box', 'crafting_speed', 'crafting_categories', 'fluid_boxes_off_when_no_fluid_recipe', 'energy_usage', 'filter_count', 'pickup_position', 'insert_position', 'rotation_speed', 'extension_speed', 'energy_per_movement', 'energy_per_rotation', 'inventory_size', 'logistic_mode', 'supply_area_distance', 'maximum_wire_distance', 'max_distance', 'circuit_wire_max_distance'];
function entity(name, types) {
  const e = group(name, types), out = {};
  for (const k of KEEP) if (e[k] !== undefined) out[k] = e[k];
  if (e.energy_source) out.energy_source = Object.fromEntries(['type', 'usage_priority', 'drain', 'emissions_per_minute'].filter(k => e.energy_source[k] !== undefined).map(k => [k, e.energy_source[k]]));
  if (e.fluid_boxes) out.fluid_boxes = e.fluid_boxes.map(b => ({ production_type: b.production_type, volume: b.volume, pipe_connections: b.pipe_connections.map(c => ({ flow_direction: c.flow_direction, direction: c.direction, position: c.position })) }));
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
const ENTITIES = { 'assembling-machine-2': ['assembling-machine'], 'fast-inserter': ['inserter'], 'fast-transport-belt': ['transport-belt'], 'fast-underground-belt': ['underground-belt'], 'passive-provider-chest': ['logistic-container'], 'medium-electric-pole': ['electric-pole'], pipe: ['pipe'], 'display-panel': ['display-panel'] };
const RECIPES = ['express-transport-belt', 'express-underground-belt', 'express-splitter', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'transport-belt', 'underground-belt', 'splitter', 'iron-gear-wheel', 'copper-cable', 'electronic-circuit', 'advanced-circuit'];
const out = { schema: 1, gameVersion: versions.base, activeMods: versions, provenance, absent: {}, recipes: {}, entities: {}, items: {}, fluids: {}, technologies: {} };
for (const name of RECIPES) {
  const r = dump.recipe[name], rec = { type: 'recipe', name, categories: r.categories || [r.category || 'crafting'], enabled: r.enabled === false ? false : true, ...(r.energy_required !== undefined ? { energy_required: r.energy_required } : {}), ingredients: r.ingredients, results: r.results };
  out.recipes[name] = rec;
}
for (const [name, types] of Object.entries(ENTITIES)) out.entities[name] = entity(name, types);
const itemNames = new Set([...RECIPES, ...Object.keys(ENTITIES), 'iron-plate', 'copper-plate', 'plastic-bar']);
for (const r of RECIPES) for (const v of [...dump.recipe[r].ingredients, ...dump.recipe[r].results]) if (v.type === 'item') itemNames.add(v.name);
for (const name of [...itemNames].sort()) {
  const i = Object.values(dump).map(g => g[name]).find(v => v?.stack_size && v.type !== 'recipe' && v.type !== 'technology');
  if (!i) continue;
  out.items[name] = { name, stack_size: i.stack_size, ...(i.place_result ? { place_result: i.place_result } : {}) };
}
out.fluids.lubricant = { name: 'lubricant', default_temperature: dump.fluid.lubricant.default_temperature };
for (const t of Object.values(dump.technology)) out.technologies[t.name] = { name: t.name, prerequisites: t.prerequisites, effects: t.effects, unit: t.unit, research_trigger: t.research_trigger };
await fs.writeFile(path.join(HERE, 'prototypes.json'), json(out));

// Cross-check against the blue-tier snapshot for everything both describe.
let compared = 0;
for (const kind of ['entities', 'recipes', 'technologies']) for (const [name, value] of Object.entries(blue[kind])) if (out[kind][name]) {
  if (JSON.stringify(sortKeys(value)) !== JSON.stringify(sortKeys(out[kind][name]))) console.log('differs from the blue-tier snapshot:', kind, name);
  compared++;
}
console.log(JSON.stringify({ written: 'prototypes.json', recipes: Object.keys(out.recipes).length, entities: Object.keys(out.entities).length, items: Object.keys(out.items).length, technologies: Object.keys(out.technologies).length, comparedWithBlueTier: compared }));
function sortKeys(v) { return Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)])) : v; }
