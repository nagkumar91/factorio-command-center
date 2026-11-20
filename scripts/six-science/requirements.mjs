// Recipe audit from the raw dump: crafts per minute and external demand at
// 30 packs per minute for each of the six ground science packs.
export const PRODUCTS = ['automation-science-pack', 'logistic-science-pack', 'military-science-pack', 'chemical-science-pack', 'production-science-pack', 'utility-science-pack'];
export const EXTERNAL = ['copper-plate', 'electronic-circuit', 'iron-plate', 'plastic-bar', 'steel-plate', 'stone-brick', 'coal', 'stone', 'sulfur', 'sulfuric-acid', 'lubricant'];
export const SPEC_DEMAND = {'copper-plate': 1035, 'electronic-circuit': 900, 'iron-plate': 585, 'plastic-bar': 520, 'steel-plate': 367.5,
  'stone-brick': 250, coal: 150, stone: 150, sulfur: 15, 'sulfuric-acid': 500, lubricant: 150};

export function calculateRequirements(raw, target = 30) {
  const crafts = {}, external = Object.fromEntries(EXTERNAL.map(i => [i, 0])), recipeIngredients = {};
  const need = (item, perMinute) => {
    if (EXTERNAL.includes(item)) { external[item] += perMinute; return; }
    const recipe = raw.recipe[item];
    if (!recipe) throw Error('No recipe for ' + item);
    const out = recipe.results.find(r => r.name === item).amount;
    const n = perMinute / out;
    crafts[item] = (crafts[item] || 0) + n;
    recipeIngredients[item] = recipe.ingredients.map(i => ({type: i.type || 'item', name: i.name, amount: i.amount}));
    for (const i of recipe.ingredients) need(i.name, n * i.amount);
  };
  for (const p of PRODUCTS) need(p, target);
  const round = v => Math.round(v * 1000) / 1000;
  return {targetPerMinute: target, externalPerMinute: Object.fromEntries(Object.entries(external).map(([k, v]) => [k, round(v)])),
    craftsPerMinute: Object.fromEntries(Object.entries(crafts).map(([k, v]) => [k, round(v)])), recipeIngredients};
}

// Machine counts needed at the declared targets, from the dump's crafting speeds.
export function machinesNeeded(raw, req) {
  const out = {};
  for (const [recipe, perMinute] of Object.entries(req.craftsPerMinute)) {
    const r = raw.recipe[recipe], machine = recipe === 'battery' ? raw['assembling-machine']['chemical-plant'] : raw['assembling-machine']['assembling-machine-2'];
    out[recipe] = Math.round(perMinute * (r.energy_required ?? .5) / 60 / machine.crafting_speed * 1000) / 1000;
  }
  return out;
}
