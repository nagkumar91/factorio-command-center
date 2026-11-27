// Writes the pinned prototype snapshot the Vulcanus supply blueprints are designed and tested against: the few fields they use,
// taken from the official --dump-data output of the installed game (Factorio 2.1.25, Space Age, vanilla, all five official mods).
//   FACTORIO_RAW=<path to data-raw-dump.json> node scripts/vulcanus-supplies/pin-prototypes.mjs
// The dump comes from `factorio --dump-data` run with an isolated config and mod directory (no save loaded). The provenance block
// holds the hashes of the installed game files it came from; validate.mjs re-checks them before every native run.
// Tests never need the dump or the game: they read prototypes.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { HERE, sha, json } from './lib.mjs';

const raw = process.env.FACTORIO_RAW;
if (!raw) throw new Error('Set FACTORIO_RAW to the data-raw-dump.json of the installed game');
const bytes = await fs.readFile(raw), dump = JSON.parse(bytes);
const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const gameData = path.join(app, 'Contents/data');
const MODS = ['base', 'elevated-rails', 'quality', 'recycler', 'space-age'];
const versions = {};
for (const name of MODS) versions[name] = JSON.parse(await fs.readFile(path.join(gameData, name, 'info.json'), 'utf8')).version;
if (new Set(Object.values(versions)).size !== 1) throw new Error('The five official mods must share one version: ' + JSON.stringify(versions));
const SOURCES = ['base/info.json', 'space-age/info.json', 'base/prototypes/recipe.lua', 'space-age/prototypes/recipe.lua', 'base/prototypes/technology.lua', 'space-age/prototypes/technology.lua', 'base/prototypes/entity/entities.lua', 'space-age/prototypes/entity/entities.lua', 'base/prototypes/fluid.lua', 'space-age/prototypes/fluid.lua'];
const provenance = {
  method: 'Native --dump-data in a new isolated config/mod/write directory; no save loaded; trimmed to the fields these blueprints use by pin-prototypes.mjs',
  rawSha256: sha(bytes),
  sourceHashes: Object.fromEntries(await Promise.all(SOURCES.map(async file => [file, sha(await fs.readFile(path.join(gameData, file)))]))),
};

const ENTITIES = {
  'oil-refinery': ['assembling-machine'], 'chemical-plant': ['assembling-machine'], 'assembling-machine-3': ['assembling-machine'],
  'fast-inserter': ['inserter'], 'long-handed-inserter': ['inserter'], 'fast-transport-belt': ['transport-belt'], 'fast-underground-belt': ['underground-belt'],
  pipe: ['pipe'], 'pipe-to-ground': ['pipe-to-ground'], substation: ['electric-pole'], 'display-panel': ['display-panel'],
};
const PRODUCT_RECIPES = ['simple-coal-liquefaction', 'heavy-oil-cracking', 'light-oil-cracking', 'plastic-bar', 'lubricant', 'carbon', 'tungsten-carbide'];
const KEEP = ['name', 'type', 'collision_box', 'selection_box', 'crafting_speed', 'crafting_categories', 'energy_usage', 'pickup_position', 'insert_position', 'rotation_speed', 'extension_speed', 'supply_area_distance', 'maximum_wire_distance', 'max_distance', 'circuit_wire_max_distance', 'speed', 'surface_conditions', 'module_slots', 'allowed_effects'];
const group = (name, types) => { for (const t of types) if (dump[t]?.[name]) return dump[t][name]; throw new Error('Not in the dump: ' + name); };
function entity(name, types) {
  const e = group(name, types), out = {};
  for (const k of KEEP) if (e[k] !== undefined) out[k] = e[k];
  if (e.energy_source) out.energy_source = Object.fromEntries(['type', 'usage_priority', 'drain'].filter(k => e.energy_source[k] !== undefined).map(k => [k, e.energy_source[k]]));
  if (e.fluid_boxes) out.fluid_boxes = e.fluid_boxes.map(b => ({ production_type: b.production_type, volume: b.volume, pipe_connections: b.pipe_connections.map(c => ({ flow_direction: c.flow_direction, direction: c.direction, position: c.position })) }));
  if (e.fluid_box) out.fluid_box = { volume: e.fluid_box.volume, pipe_connections: e.fluid_box.pipe_connections.map(c => ({ direction: c.direction, position: c.position, connection_type: c.connection_type, max_underground_distance: c.max_underground_distance })) };
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
const recipe = name => {
  const r = dump.recipe[name];
  return { type: 'recipe', name, categories: r.categories || [r.category || 'crafting'], enabled: r.enabled === false ? false : true, ...(r.energy_required !== undefined ? { energy_required: r.energy_required } : {}), ingredients: r.ingredients, results: r.results };
};
const out = { schema: 1, gameVersion: versions.base, activeMods: versions, provenance, recipes: {}, entities: {}, items: {}, fluids: {}, technologies: {} };
for (const name of [...PRODUCT_RECIPES, ...Object.keys(ENTITIES)]) out.recipes[name] = recipe(name);
for (const [name, types] of Object.entries(ENTITIES)) out.entities[name] = entity(name, types);
const itemNames = new Set([...Object.keys(ENTITIES), 'coal', 'calcite', 'tungsten-ore', 'carbon', 'tungsten-carbide', 'plastic-bar']);
for (const name of [...itemNames].sort()) {
  const i = Object.values(dump).map(g => g[name]).find(v => v?.stack_size && v.type !== 'recipe' && v.type !== 'technology');
  if (!i) continue;
  out.items[name] = { name, stack_size: i.stack_size, ...(i.place_result ? { place_result: i.place_result } : {}) };
}
for (const name of ['sulfuric-acid', 'water', 'heavy-oil', 'light-oil', 'petroleum-gas', 'lubricant']) out.fluids[name] = { name, default_temperature: dump.fluid[name].default_temperature };
for (const t of Object.values(dump.technology)) out.technologies[t.name] = { name: t.name, prerequisites: t.prerequisites, effects: t.effects, unit: t.unit, research_trigger: t.research_trigger };
// A later member's own additions (see lib.mjs: prototypes(id)): only what the family pin lacks, from the same raw dump.
//   FACTORIO_RAW=<dump> node scripts/vulcanus-supplies/pin-prototypes.mjs rocket-fuel      writes rocket-fuel/prototypes.json, leaves prototypes.json alone
const MEMBERS = { 'rocket-fuel': { recipes: ['solid-fuel-from-light-oil', 'rocket-fuel'], items: ['solid-fuel', 'rocket-fuel'], fluids: [],
  // what a rocket takes, for the README's "how often does this fill one": the silo's part count and the rocket fuel in one part
  facts: () => ({ rocket: { silo: 'rocket-silo', rocketPartsRequired: dump['rocket-silo']['rocket-silo'].rocket_parts_required, partRecipe: dump['rocket-silo']['rocket-silo'].fixed_recipe, rocketFuelPerPart: dump.recipe[dump['rocket-silo']['rocket-silo'].fixed_recipe].ingredients.find(v => v.name === 'rocket-fuel').amount } }) } };
MEMBERS['plastic-v2'] = { recipes: ['advanced-oil-processing', 'empty-crude-oil-barrel', 'empty-water-barrel', 'passive-provider-chest'], items: ['crude-oil-barrel', 'water-barrel', 'barrel'], fluids: ['crude-oil'], entities: [['passive-provider-chest', ['logistic-container']]] };
const member = process.argv[2];
if (member) {
  const spec = MEMBERS[member];
  if (!spec) throw new Error('No member pin list for ' + member);
  const family = JSON.parse(await fs.readFile(path.join(HERE, 'prototypes.json'), 'utf8'));
  if (family.provenance.rawSha256 !== provenance.rawSha256) throw new Error('This dump is not the one the family pin came from');
  const item = name => { const i = Object.values(dump).map(g => g[name]).find(v => v?.stack_size && v.type !== 'recipe' && v.type !== 'technology'); return { name, stack_size: i.stack_size, ...(i.fuel_value ? { fuel_value: i.fuel_value } : {}) }; };
  const extra = { schema: 1, member, gameVersion: versions.base, provenance: { method: 'Same raw dump as ../prototypes.json; only the recipes and items that file lacks', rawSha256: provenance.rawSha256, familyPrototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))) },
    recipes: Object.fromEntries(spec.recipes.map(n => [n, recipe(n)])), entities: Object.fromEntries((spec.entities || []).map(([n, types]) => [n, entity(n, types)])), items: Object.fromEntries(spec.items.map(n => [n, item(n)])), fluids: Object.fromEntries(spec.fluids.map(n => [n, { name: n, default_temperature: dump.fluid[n].default_temperature }])), ...(spec.facts ? { facts: spec.facts() } : {}) };
  for (const g of ['recipes', 'entities', 'items', 'fluids']) for (const k of Object.keys(extra[g])) if (family[g][k]) throw new Error(`${g}.${k} is already in the family pin`);
  await fs.writeFile(path.join(HERE, member, 'prototypes.json'), json(extra));
  console.log(JSON.stringify({ written: member + '/prototypes.json', recipes: Object.keys(extra.recipes), items: Object.keys(extra.items) }));
  process.exit(0);
}
await fs.writeFile(path.join(HERE, 'prototypes.json'), json(out));
console.log(JSON.stringify({ written: 'prototypes.json', gameVersion: out.gameVersion, recipes: Object.keys(out.recipes).length, entities: Object.keys(out.entities).length, items: Object.keys(out.items).length, technologies: Object.keys(out.technologies).length }));
