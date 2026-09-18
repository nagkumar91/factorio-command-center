import fs from 'node:fs/promises';
import { writeData } from './write-data.mjs';

const raw = JSON.parse(await fs.readFile(process.env.FACTORIO_RAW || '.cache/factorio-vanilla/script-output/data-raw-dump.json', 'utf8'));
const catalog = JSON.parse(await fs.readFile('site/data/catalog.json', 'utf8'));
const known = new Set([...catalog.items, ...catalog.fluids].map(i => i.id));
// Rocket parts are a real silo recipe product but cannot enter item inventories.
known.add('rocket-part');
const part = p => ({ id: p.name, type: p.type || 'item', amount: p.amount ?? ((p.amount_min || 0) + (p.amount_max || 0)) / 2, probability: p.probability ?? 1, ...(p.temperature ? { temperature: p.temperature } : {}) });
const recipes = Object.values(raw.recipe).filter(r => !r.hidden && !r.parameter).map(r => ({
  id: r.name, category: r.category || 'crafting', time: r.energy_required ?? 0.5,
  ingredients: Object.values(r.ingredients || {}).map(part), results: Object.values(r.results || {}).map(part),
  surface: r.surface_conditions || [], allowProductivity: !!r.allow_productivity,
}));
const rawResources = new Set(['water', 'crude-oil', 'wood', 'raw-fish', 'yumako', 'jellynut', 'spoilage', 'scrap', 'ice', 'lava', 'ammoniacal-solution', 'fluorine', 'lithium-brine', 'metallic-asteroid-chunk', 'carbonic-asteroid-chunk', 'oxide-asteroid-chunk', 'promethium-asteroid-chunk', 'biter-egg', 'pentapod-egg']);
for (const r of Object.values(raw.resource || {})) {
  if (r.minable?.result) rawResources.add(r.minable.result);
  for (const p of r.minable?.results || []) rawResources.add(p.name);
}
// Vulcanus has acid wells, but the standard route for a Nauvis material plan
// manufactures acid from sulfur and water.
rawResources.delete('sulfuric-acid');
// Scrap recycling yields holmium probabilistically; the deterministic budget
// starts with collected ore. The coverage index links to the recycling cell.
rawResources.add('holmium-ore');
const defaults = {};
for (const r of recipes) {
  // Prefer the ordinary named recipe. Recycling, breeding, cracking, and
  // alternate planet routes must never create accidental recursion.
  const product = r.results.find(p => p.id === r.id);
  if (product && known.has(r.id) && !rawResources.has(r.id) && r.results.every(p => p.probability === 1) && !r.ingredients.some(p => p.id === r.id)) defaults[r.id] = r.id;
}
for (const id of ['heavy-oil', 'light-oil', 'petroleum-gas']) defaults[id] = 'advanced-oil-processing';
defaults['solid-fuel'] = 'solid-fuel-from-light-oil';
// These standard recipes have names different from their products. In
// particular, fresh coolant must not be sourced from a recipe that uses it.
defaults.ammonia = 'ammoniacal-solution-separation';
defaults['fluoroketone-hot'] = 'fluoroketone';
defaults['fluoroketone-cold'] = 'fluoroketone-cooling';
const entities = {};
for (const type of Object.values(raw)) for (const p of Object.values(type)) {
  if (p.selection_box) entities[p.name] = { type: p.type, size: p.selection_box, speed: p.crafting_speed, categories: p.crafting_categories, fuel: p.energy_source?.type, production: p.production, storage: p.energy_source?.buffer_capacity, fixedRecipe: p.fixed_recipe, fuelCategories: p.energy_source?.fuel_categories, surface: p.surface_conditions || [] };
}
await writeData('production', { version: catalog.version, goods: [...known], recipes, defaults, rawResources: [...rawResources], entities });
console.log(`Indexed ${recipes.length} recipes and ${Object.keys(defaults).length} default production routes.`);
