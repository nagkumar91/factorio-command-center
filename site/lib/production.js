(() => {
'use strict';
const sum = (map, id, n) => map.set(id, (map.get(id) || 0) + n);
const tidy = n => Math.round(n * 1e6) / 1e6;

function planProduction(targets, data, { supplied = [] } = {}) {
  const recipes = new Map(data.recipes.map(r => [r.id, r]));
  const boundary = new Set([...data.rawResources, ...supplied]);
  const demand = new Map(), targetMap = new Map(), nodes = new Map(), visiting = new Set();
  if (!Array.isArray(targets) || !targets.length || targets.length > 100) throw new Error('Choose between 1 and 100 finished products.');
  for (const t of targets) {
    if (!Number.isSafeInteger(t.count) || t.count < 1 || t.count > 1000000) throw new Error('Use whole quantities between 1 and 1,000,000.');
    if (!/^[a-z0-9-]+$/.test(t.id)) throw new Error('Choose an item from the product list.');
    if (data.goods && !data.goods.includes(t.id)) throw new Error('Choose an available item or fluid from the product list.');
    sum(demand, t.id, t.count); sum(targetMap, t.id, t.count);
  }
  function producer(id) { return boundary.has(id) ? null : recipes.get(data.defaults[id]); }
  function visit(id) {
    const recipe = producer(id);
    if (!recipe) return null;
    if (visiting.has(recipe.id)) throw new Error(`The route for ${id} has a loop. Supply that intermediate separately.`);
    if (nodes.has(recipe.id)) return recipe.id;
    if (recipe.results.some(p => p.probability !== 1)) throw new Error(`The route for ${id} has random yields. Supply it separately.`);
    visiting.add(recipe.id);
    const node = { recipe, suppliers: new Set(), incoming: 0 };
    for (const ingredient of recipe.ingredients) {
      const parent = visit(ingredient.id);
      if (parent) node.suppliers.add(parent);
    }
    nodes.set(recipe.id, node); visiting.delete(recipe.id);
    return recipe.id;
  }
  for (const id of targetMap.keys()) visit(id);
  for (const n of nodes.values()) for (const id of n.suppliers) nodes.get(id).incoming++;
  const queue = [...nodes.values()].filter(n => !n.incoming), made = new Map(), steps = [];
  while (queue.length) {
    const node = queue.shift(), r = node.recipe;
    const crafts = Math.max(0, ...r.results.filter(p => producer(p.id)?.id === r.id).map(p => Math.ceil(((demand.get(p.id) || 0) - (made.get(p.id) || 0) - 1e-9) / p.amount)));
    for (const p of r.ingredients) sum(demand, p.id, p.amount * crafts);
    for (const p of r.results) sum(made, p.id, p.amount * crafts);
    steps.push({ id: r.id, crafts, ingredients: r.ingredients.map(p => ({ ...p, amount: tidy(p.amount * crafts) })), results: r.results.map(p => ({ ...p, amount: tidy(p.amount * crafts) })), seconds: crafts * r.time });
    for (const id of node.suppliers) { const parent = nodes.get(id); if (--parent.incoming === 0) queue.push(parent); }
  }
  if (steps.length !== nodes.size) throw new Error('This route contains a production loop. Supply one of its intermediates separately.');
  const raw = [], intermediates = [], surplus = [], external = [];
  for (const [id, amount] of demand) {
    if (!producer(id)) { raw.push({ id, count: tidy(amount) }); if (!boundary.has(id)) external.push(id); }
    else if (amount > (targetMap.get(id) || 0)) intermediates.push({ id, count: tidy(made.get(id) || 0), used: tidy(amount - (targetMap.get(id) || 0)) });
  }
  for (const [id, amount] of made) if (amount - (demand.get(id) || 0) > 1e-6) surplus.push({ id, count: tidy(amount - (demand.get(id) || 0)) });
  const alphabetical = rows => rows.sort((a, b) => a.id.localeCompare(b.id));
  return { targets: [...targetMap].map(([id, count]) => ({ id, count })), raw: alphabetical(raw), intermediates: alphabetical(intermediates), surplus: alphabetical(surplus), external, steps: steps.reverse() };
}

function analyzeBlueprint(object, data) {
  const recipeMap = new Map(data.recipes.map(r => [r.id, r]));
  const entities = [], recipeCounts = new Map(), missing = new Set();
  function walk(node) {
    if (node.blueprint_book) for (const b of node.blueprint_book.blueprints || []) walk(b);
    if (node.blueprint) entities.push(...(node.blueprint.entities || []));
  }
  walk(object);
  // Furnaces select recipes from their feed, not from blueprint settings.
  // Our generated mall explicitly records that feed's intended smelting recipe.
  const declaredSmelting = e => {
    const recipe = e.tags?.production_recipe || e.tags?.mall_recipe;
    return data.entities[e.name]?.type === 'furnace' && data.entities[e.name]?.categories?.includes(recipeMap.get(recipe)?.category) ? recipe : null;
  };
  for (const e of entities) {
    const recipe = e.recipe || data.entities[e.name]?.fixedRecipe || declaredSmelting(e);
    if (recipe && recipeMap.has(recipe)) sum(recipeCounts, recipe, 1); else if (recipe) missing.add(recipe);
  }
  const consumed = new Set(), produced = new Set(), seeds = new Set(), types = new Set(), names = new Set();
  for (const e of entities) { names.add(e.name); types.add(data.entities[e.name]?.type); }
  for (const id of recipeCounts.keys()) {
    const r = recipeMap.get(id);
    for (const p of r.ingredients) consumed.add(p.id);
    for (const p of r.results) produced.add(p.id);
    for (const p of r.ingredients) if (r.results.some(q => q.id === p.id)) seeds.add(p.id);
  }
  const netOutputs = [...seeds].filter(id => {
    const users = [...recipeCounts.keys()].map(r => recipeMap.get(r)).filter(r => r.ingredients.some(p => p.id === id));
    return users.length && users.every(r => r.results.filter(p => p.id === id).reduce((n,p) => n + p.amount * p.probability, 0) > r.ingredients.filter(p => p.id === id).reduce((n,p) => n + p.amount, 0));
  });
  for (const e of entities) {
    const fuel = data.entities[e.name]?.fuelCategories || [];
    if (fuel.includes('nutrients')) consumed.add('nutrients');
    if (fuel.includes('food')) consumed.add('bioflux');
  }
  // Fusion's fuel and fluid conversions are entity behavior, not configured
  // crafting recipes. Include them before classifying the coolant loop.
  if (types.has('fusion-reactor')) {
    consumed.add('fusion-power-cell'); consumed.add('fluoroketone-cold');
    produced.add('fusion-plasma');
  }
  if (types.has('fusion-generator')) {
    consumed.add('fusion-plasma'); produced.add('fluoroketone-hot');
  }
  const fusionLoop = types.has('fusion-reactor') && types.has('fusion-generator') && recipeCounts.has('fluoroketone-cooling');
  if (fusionLoop) seeds.add('fluoroketone-cold');
  const inputs = [...consumed].filter(id => !produced.has(id)), outputs = [...produced].filter(id => !consumed.has(id)), internal = [...produced].filter(id => consumed.has(id));
  const notes = [], serviceInputs = [], serviceOutputs = [];
  let kind = recipeCounts.size ? 'Production' : 'Infrastructure';
  const count = id => entities.filter(e => e.name === id).length;
  if (recipeCounts.size) {
    notes.push('Inputs are recipe ingredients and recognized machine fuels or fluids supplied from outside. Outputs are products not consumed by another included process. Check belt, pipe, and robot connections in-game; this analysis does not simulate routing or throughput.');
    serviceInputs.push('Power for machines and inserters');
  }
  if (names.has('space-platform-hub')) { kind = 'Space platform'; serviceInputs.push('Asteroids, platform supplies, and fuel appropriate to the route'); serviceOutputs.push('Space transport or orbital production'); notes.push('Internal recipes also supply the platform itself. Keep ammunition, fuel, and waste handling running. Destination and travel performance depend on the platform schedule and equipment.'); }
  if (types.has('solar-panel') || types.has('accumulator')) {
    if (!recipeCounts.size && !names.has('space-platform-hub')) kind = 'Power';
    if (types.has('solar-panel')) { serviceInputs.push('Sunlight'); serviceOutputs.push('Electricity during daylight'); }
    if (types.has('accumulator')) { serviceInputs.push('Surplus grid electricity to charge accumulators'); serviceOutputs.push('Stored electricity when the grid needs it'); }
    if (count('solar-panel')) notes.push(`${count('solar-panel')} solar panels: ${(count('solar-panel') * 60 / 1000).toLocaleString('en-US')} MW peak at normal quality and 100% solar intensity. Actual power varies with surface and daylight.`);
    if (count('accumulator')) notes.push(`${count('accumulator')} accumulators: ${count('accumulator') * 5} MJ storage at normal quality. These placed entities do not manufacture solar panels or accumulators.`);
  }
  if (names.has('nuclear-reactor')) { if (kind !== 'Space platform') kind = 'Power'; serviceInputs.push('Uranium fuel cells', 'Water for heat exchangers'); serviceOutputs.push('Heat; electricity when connected to turbines', 'Used-up uranium fuel cells'); notes.push('Remove spent fuel and connect the heat exchangers, turbines, and water supply. Startup and reactor neighbour bonuses affect power.'); }
  if (names.has('heating-tower')) { if (!recipeCounts.size && kind !== 'Space platform') kind = 'Power'; serviceInputs.push('Burnable fuel for heating towers'); serviceOutputs.push('Heat for connected buildings or heat exchangers'); }
  if (types.has('fusion-reactor') || types.has('fusion-generator')) {
    if (kind !== 'Space platform') kind = 'Power';
    serviceInputs.push('External electricity to start reactors and coolant cooling');
    if (types.has('fusion-generator')) serviceOutputs.push('Electricity from fusion generators');
    if (fusionLoop) notes.push('Charge the coolant circuit with cold fluoroketone before starting. Reactors turn it into plasma; generators return hot fluoroketone; the cooling plants restore cold coolant. With connected pipes, this is a circulating startup supply, not a continuous hot-coolant import or a cold-coolant product. Fuel cells must be replenished.');
  }
  if (types.has('burner-generator')) { if (!recipeCounts.size) kind = 'Power'; serviceInputs.push('Burnable fuel'); serviceOutputs.push('Electricity'); }
  if (types.has('boiler') || types.has('generator')) { if (!recipeCounts.size && kind === 'Infrastructure') kind = 'Power'; serviceInputs.push('Water or steam at the required temperature', 'Heat or boiler fuel, where applicable'); serviceOutputs.push('Steam or electricity'); }
  if (types.has('mining-drill')) { if (!recipeCounts.size) kind = 'Mining'; serviceInputs.push('A matching resource patch', 'Mining power; required extraction fluid for that resource'); serviceOutputs.push('Mined resources determined by the patch'); }
  if (types.has('agricultural-tower')) { serviceInputs.push('Seeds and suitable planting terrain'); serviceOutputs.push('Harvested fruit'); }
  if (types.has('asteroid-collector')) { serviceInputs.push('Asteroids along the platform route'); serviceOutputs.push('Collected asteroid chunks'); }
  const declaredFurnaces = entities.filter(e => !e.recipe && declaredSmelting(e));
  if (declaredFurnaces.length) notes.push(`${declaredFurnaces.length} furnaces/recyclers have labeled processing feeds in this layout. The analysis includes those recipes; the machines select their actual recipe from the supplied ingredient.`);
  const furnaces = entities.filter(e => data.entities[e.name]?.type === 'furnace' && !e.recipe && !declaredSmelting(e));
  if (furnaces.length) {
    if (!recipeCounts.size && kind === 'Infrastructure') kind = names.has('recycler') ? 'Recycling' : 'Smelting';
    if (names.has('recycler')) { serviceInputs.push('Items to recycle and electricity'); serviceOutputs.push('Recipe-dependent recovered ingredients, often with random yields'); }
    if (furnaces.some(e => e.name !== 'recycler')) { serviceInputs.push('Smeltable ore, stone, or iron plates', 'Furnace power or fuel'); serviceOutputs.push('Iron/copper plates, bricks, or steel, depending on the supplied ingredient'); }
    notes.push(`${furnaces.length} furnace/recycler entities choose their recipe from what you feed them. Their inputs and outputs are described separately from configured assembler recipes.`);
  }
  const unconfigured = entities.filter(e => data.entities[e.name]?.type === 'assembling-machine' && !e.recipe && !data.entities[e.name]?.fixedRecipe).length;
  if (unconfigured) notes.push(`${unconfigured} crafting machines have no saved recipe. Configure them in-game; their ingredients cannot be inferred here.`);
  if (types.has('roboport')) {
    serviceInputs.push('Power, robots, and items in the logistics network');
    if (!recipeCounts.size && kind === 'Infrastructure') { kind = 'Logistics'; serviceOutputs.push('Robot coverage and delivery of supplied items'); }
  }
  if (names.has('requester-chest')) {
    serviceInputs.push('Powered logistics coverage and logistic robots for requester chests, or fill them by hand');
    if (!types.has('roboport')) notes.push('Requester chests are included, but no roboports are placed in this layout. Connect it to your existing logistics network or add roboport coverage.');
  }
  if (!recipeCounts.size && ['Infrastructure', 'Logistics'].includes(kind)) {
    if ([...types].some(t => t?.includes('rail') || t === 'train-stop')) { kind = 'Transport'; serviceInputs.push('Trains, fuel, cargo, and a matching schedule'); serviceOutputs.push('The same cargo at its destination'); }
    else if ([...types].some(t => t?.includes('turret'))) { kind = 'Defense'; serviceInputs.push('Ammunition, fuel, or electricity for the installed weapons'); serviceOutputs.push('Area defense'); }
    else if (!serviceOutputs.length) { serviceInputs.push('Items or fluids supplied by your factory; power where needed'); serviceOutputs.push('Storage, routing, or supporting infrastructure'); }
    notes.push('This layout has no configured manufacturing recipes. Construction materials are not operating ingredients.');
  }
  if (seeds.size) notes.push('Supply the listed startup stock and keep it circulating; it is not a finished output.');
  if (missing.size) notes.push('Some saved recipes are unavailable in the indexed game. Their inputs and outputs are not included.');
  if ([...recipeCounts].some(([id]) => recipeMap.get(id).results.some(p => p.probability !== 1))) notes.push('At least one recipe has random yields. Recipe results are probabilities, not guaranteed output per craft.');
  return { kind, inputs: inputs.sort(), outputs: outputs.sort(), netOutputs: netOutputs.sort(), internal: internal.sort(), seeds: [...seeds].sort(), recipes: [...recipeCounts].map(([id, count]) => ({ id, count })), missing: [...missing], serviceInputs: [...new Set(serviceInputs)], serviceOutputs: [...new Set(serviceOutputs)], notes };
}
globalThis.FactorioProduction = { planProduction, analyzeBlueprint };
})();
