// Isolated installed-game model. Never read the vanilla site catalogue.
export const values = value => Object.values(value || {});
export const materialKey = ({type = 'item', id, name}) => `${type}:${id || name}`;
export const EPS = 1e-8;
export function energy(value) {
  const match = /^(\d+(?:\.\d+)?)\s*([kMGT]?)\s*[JW]$/.exec(String(value));
  return match ? Number(match[1]) * ({'': 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12}[match[2]]) : 0;
}
export function part(value, result = false) {
  if (Array.isArray(value)) value = {name: value[0], amount: value[1]};
  const amount = value.amount ?? ((value.amount_min || 0) + (value.amount_max || 0)) / 2;
  return {id: value.name, type: value.type || 'item', amount, probability: result ? value.probability ?? 1 : 1,
    ignoredByProductivity: value.ignored_by_productivity || 0,
    ...(value.amount_min !== undefined ? {amountMin: value.amount_min, amountMax: value.amount_max} : {}),
    ...(value.fluidbox_index ? {fluidboxIndex: value.fluidbox_index} : {}),
    ...Object.fromEntries(['temperature', 'minimum_temperature', 'maximum_temperature'].filter(k => value[k] !== undefined).map(k => [k, value[k]]))};
}
export function surfaceAllows(conditions, properties) {
  return values(conditions).every(c => Number.isFinite(properties[c.property]) && properties[c.property] >= (c.min ?? -Infinity) && properties[c.property] <= (c.max ?? Infinity));
}
export function machinePorts(machine, recipe) {
  const ports = [];
  for (const [kind, list] of [['input', recipe.ingredients], ['output', recipe.results]]) {
    const boxes = values(machine.fluid_boxes).filter(b => b.production_type === kind || b.production_type === 'input-output');
    const fluids = list.filter(i => i.type === 'fluid'), used = new Set();
    // Native 2.0.77 merges three unfiltered physical boxes into two recipe
    // boxes as [0,1] and [2]. Connecting the second fluid to physical box 1
    // therefore feeds the first ingredient's network. Explicit indices and
    // filtered boxes retain their declared mapping.
    const mergedThreeIntoTwo = boxes.length === 3 && fluids.length === 2 && !boxes.some(b => b.filter) && !fluids.some(p => p.fluidboxIndex);
    for (let fluidIndex = 0; fluidIndex < fluids.length; fluidIndex++) {
      const p = fluids[fluidIndex];
      const index = p.fluidboxIndex ? p.fluidboxIndex - 1 : mergedThreeIntoTwo ? fluidIndex * 2 : boxes.findIndex((b, i) => !used.has(i) && (!b.filter || b.filter === p.id));
      const box = boxes[index];
      const connection = values(box?.pipe_connections).find(c => c.connection_type !== 'linked' && Array.isArray(c.position) && [0, 4, 8, 12].includes(c.direction));
      if (!box || used.has(index) || (box.filter && box.filter !== p.id) || !connection) return null;
      used.add(index); ports.push({...p, kind, connection});
    }
  }
  return ports;
}

export function normalizeGame(raw, {surface = 'nauvis', prototypeSha256 = null, manualSources = [], seededResources = []} = {}) {
  const properties = Object.fromEntries(values(raw['surface-property']).map(p => [p.name, p.default_value]));
  Object.assign(properties, raw.planet?.[surface]?.surface_properties || {});
  const goods = new Map(), entities = new Map();
  for (const [type, group] of Object.entries(raw)) for (const p of values(group)) {
    if (p.stack_size !== undefined || type === 'fluid') goods.set(materialKey({type: type === 'fluid' ? 'fluid' : 'item', id: p.name}), {
      id: p.name, type: type === 'fluid' ? 'fluid' : 'item', prototypeType: type, hidden: !!p.hidden || (p.flags || []).includes('hidden'),
      subgroup: p.subgroup, stackSize: p.stack_size, spoilTicks: p.spoil_ticks, spoilResult: p.spoil_result, prototype: p});
    if (p.collision_box || p.selection_box) entities.set(p.name, p);
  }
  const unlocked = new Map();
  for (const tech of values(raw.technology)) for (const effect of values(tech.effects)) if (effect.type === 'unlock-recipe') {
    if (!unlocked.has(effect.recipe)) unlocked.set(effect.recipe, []);
    unlocked.get(effect.recipe).push(tech.name);
  }
  const rawSources = new Map();
  const natural = (p, kind) => {
    const products = p.minable?.result ? [{name: p.minable.result, amount: p.minable.count || 1}] : values(p.minable?.results);
    for (const product of products) {
      const key = materialKey(product);
      if (!goods.has(key)) continue;
      if (!rawSources.has(key)) rawSources.set(key, []);
      rawSources.get(key).push({kind, entity: p.name, requiredFluid: p.minable.required_fluid || null, extractionIncluded: false});
    }
  };
  const map = raw.planet?.[surface]?.map_gen_settings;
  const entitySettings = map?.autoplace_settings?.entity?.settings;
  for (const type of ['resource', 'tree', 'plant', 'fish', 'simple-entity']) for (const p of values(raw[type])) {
    // Natural prototypes without autoplace (notably EON scrap) are not renewable raw inputs.
    if (!p.autoplace || (['resource', 'simple-entity'].includes(type) && entitySettings && !Object.hasOwn(entitySettings, p.name))) continue;
    natural(p, type === 'resource' ? 'mining' : 'harvest');
  }
  const tileSettings = map?.autoplace_settings?.tile?.settings;
  for (const tile of values(raw.tile)) if (tile.fluid && (!tileSettings || Object.hasOwn(tileSettings, tile.name))) {
    const key = `fluid:${tile.fluid}`;
    if (!rawSources.has(key)) rawSources.set(key, []);
    rawSources.get(key).push({kind: 'offshore-pumping', tile: tile.name, extractionIncluded: false});
  }
  for (const source of seededResources) {
    const resource = raw.resource?.[source.entity];
    if (!resource || !(source.amount > 0)) continue;
    natural(resource, 'seeded-resource-extraction');
    for (const sources of rawSources.values()) for (const entry of sources) if (entry.kind === 'seeded-resource-extraction' && entry.entity === source.entity) Object.assign(entry, source, {renewable: false});
  }
  const machines = [...entities.values()].filter(p => ['assembling-machine', 'furnace'].includes(p.type));
  const recipeProducts = new Map(), eligibleProducts = new Map(), recipes = [], excludedRecipes = [];
  for (const p of values(raw.recipe).sort((a, b) => a.name.localeCompare(b.name))) {
    const ingredients = values(p.ingredients).map(i => part(i));
    const results = (p.result ? [{name: p.result, amount: p.result_count || 1}] : values(p.results)).map(i => part(i, true));
    const recipe = {id: p.name, category: p.category || 'crafting', time: p.energy_required ?? 0.5, ingredients, results,
      hidden: !!p.hidden, unlockTechnologies: unlocked.get(p.name) || [], surfaceConditions: values(p.surface_conditions), prototype: p};
    for (const result of results) {
      const key = materialKey(result);
      if (!recipeProducts.has(key)) recipeProducts.set(key, []);
      recipeProducts.get(key).push(p.name);
      const output = results.filter(r => materialKey(r) === key).reduce((sum, r) => sum + r.amount * r.probability, 0);
      const input = ingredients.filter(r => materialKey(r) === key).reduce((sum, r) => sum + r.amount, 0);
      if (!p.parameter && !p.hidden && (p.enabled !== false || unlocked.has(p.name)) && output > input + EPS && !goods.get(key)?.hidden && result.id !== 'rocket-part') {
        if (!eligibleProducts.has(key)) eligibleProducts.set(key, []);
        if (!eligibleProducts.get(key).includes(p.name)) eligibleProducts.get(key).push(p.name);
      }
    }
    let reason = p.parameter ? 'parameter-recipe' : !results.length ? 'no-products' : null;
    if (!reason && p.hidden && /recycling/.test(recipe.category)) reason = 'hidden-recycling-route';
    if (!reason && p.enabled === false && !recipe.unlockTechnologies.length) reason = 'no-research-unlock';
    if (!reason && !surfaceAllows(p.surface_conditions, properties)) reason = 'surface-requirements';
    if (!reason && [...ingredients, ...results].some(i => !goods.has(materialKey(i)) || !Number.isFinite(i.amount) || i.amount <= 0 || i.probability <= 0)) reason = 'invalid-or-virtual-material';
    const candidates = machines.filter(m => (m.crafting_categories || []).includes(recipe.category) && (!m.fixed_recipe || m.fixed_recipe === recipe.id)
      && surfaceAllows(m.surface_conditions, properties) && machinePorts(m, recipe) && m.crafting_speed > 0
      && !m.crafting_speed_quality_multiplier
      && ['electric', 'burner', 'void'].includes(m.energy_source?.type));
    // Prefer electrically powered, zero-productivity machines where possible. This
    // keeps small factories accessible; unique mod categories still use mod machines.
    const ordinary = name => ({'assembling-machine-2': 0, 'assembling-machine-1': 1, 'assembling-machine-3': 2, 'electric-furnace': 0, 'chemical-plant': 0, 'oil-refinery': 0, centrifuge: 0}[name] ?? 10);
    candidates.sort((a, b) => Number(a.energy_source?.type !== 'electric') - Number(b.energy_source?.type !== 'electric')
      || (a.effect_receiver?.base_effect?.productivity || 0) - (b.effect_receiver?.base_effect?.productivity || 0)
      || ordinary(a.name) - ordinary(b.name) || a.crafting_speed - b.crafting_speed || a.name.localeCompare(b.name));
    const machine = candidates[0];
    if (!reason && !machine) reason = 'unsupported-machine-or-process';
    if (reason) { excludedRecipes.push({id: recipe.id, reason}); continue; }
    const base = machine.effect_receiver?.base_effect || {};
    const speed = machine.crafting_speed * (1 + (base.speed || 0));
    const productivity = Math.max(0, Math.min(base.productivity || 0, p.maximum_productivity ?? 3));
    const inParts = ingredients.map(i => ({...i}));
    const outParts = results.map(i => ({...i, expectedAmount: i.amount * i.probability + Math.max(0, i.amount - i.ignoredByProductivity) * i.probability * productivity}));
    let fuel = null;
    if (machine.energy_source.type === 'burner') {
      const categories = machine.energy_source.fuel_categories || [machine.energy_source.fuel_category || 'chemical'];
      const choices = [...goods.values()].filter(g => g.type === 'item' && categories.includes(g.prototype.fuel_category) && energy(g.prototype.fuel_value) > 0);
      choices.sort((a, b) => Number(!rawSources.has(materialKey(a))) - Number(!rawSources.has(materialKey(b))) || a.id.localeCompare(b.id));
      const selected = choices[0];
      if (!selected || !energy(machine.energy_usage)) { excludedRecipes.push({id: recipe.id, reason: 'unmodeled-machine-fuel'}); continue; }
      const perCraft = energy(machine.energy_usage) * (1 + (base.consumption || 0)) * recipe.time / speed / ((machine.energy_source.effectivity || 1) * energy(selected.prototype.fuel_value));
      fuel = {id: selected.id, type: 'item', amount: perCraft, probability: 1, fuel: true}; inParts.push(fuel);
      if (selected.prototype.burnt_result) outParts.push({id: selected.prototype.burnt_result, type: 'item', expectedAmount: perCraft, amount: perCraft, probability: 1, burntFuel: true});
    }
    const net = new Map();
    for (const i of inParts) net.set(materialKey(i), (net.get(materialKey(i)) || 0) - i.amount);
    for (const i of outParts) net.set(materialKey(i), (net.get(materialKey(i)) || 0) + i.expectedAmount);
    recipes.push({...recipe, ingredients: inParts, results: outParts, machine: machine.name, speed, productivity, fuel, net});
  }
  const producers = new Map();
  for (const recipe of recipes) for (const [key, amount] of recipe.net) if (amount > EPS) {
    if (!producers.has(key)) producers.set(key, []);
    producers.get(key).push(recipe);
  }
  const reachable = new Set(rawSources.keys()), reachableRecipes = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const recipe of recipes) if (!reachableRecipes.has(recipe.id) && recipe.ingredients.every(i => reachable.has(materialKey(i)))) {
      reachableRecipes.add(recipe.id);
      for (const p of recipe.results) if (!reachable.has(materialKey(p))) { reachable.add(materialKey(p)); changed = true; }
    }
  }
  const manualSourceMap = new Map(manualSources.map(source => [`item:${source.item}`, {...source, kind: 'manual-scripted-exchange', automatedThroughput: false}]));
  return {raw, surface, properties, prototypeSha256, goods, entities, recipes, recipeProducts, eligibleProducts, producers, rawSources, excludedRecipes, reachable, reachableRecipes, manualSources: manualSourceMap};
}
