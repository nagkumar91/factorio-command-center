// Construction quantities are distinct from the bounding rectangle and operating inputs.
export function constructionMetrics(wrapper, raw) {
  const entities = (wrapper.blueprint || wrapper).entities;
  const inventory = {};
  for (const e of entities) inventory[e.name] = (inventory[e.name] || 0) + 1;
  function iron(item, active = new Set()) {
    if (item === 'iron-plate') return 1;
    if (active.has(item)) throw Error(`Recipe cycle: ${item}`);
    const recipe = raw.recipe[item];
    if (!recipe) throw Error(`Missing construction recipe: ${item}`);
    const results = recipe.results || [];
    if (results.length !== 1 || results[0].name !== item || !results[0].amount) throw Error(`Not a deterministic single-output recipe: ${item}`);
    const next = new Set([...active, item]);
    return recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.amount * iron(ingredient.name, next), 0) / results[0].amount;
  }
  const redBelts = inventory['fast-transport-belt'] || 0;
  const redUndergroundEndpoints = inventory['fast-underground-belt'] || 0;
  return {
    placedEntities: entities.length,
    inventory,
    redBelts,
    redUndergroundEndpoints,
    redBeltConstructionIronPlates: redBelts * iron('fast-transport-belt') + redUndergroundEndpoints * iron('fast-underground-belt'),
    constructionBasis: 'Normal crafting, no productivity; iron plates for red surface belts and red underground endpoints only. Not total factory cost.',
  };
}
