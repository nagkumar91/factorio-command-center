/** Recipe-derived, steady-state RGBYP material audit. No modules, beacons,
 * productivity, research bonuses, construction materials, or transport losses.
 * Pass the installed data.raw dump itself; no recipes are supplied from memory.
 */
export const DEFAULT_TARGETS = Object.freeze({
  'automation-science-pack': 30,
  'logistic-science-pack': 30,
  'chemical-science-pack': 30,
  'utility-science-pack': 30,
  'production-science-pack': 30,
});
export const EXTERNAL_INPUTS = Object.freeze([
  'iron-plate', 'copper-plate', 'steel-plate', 'plastic-bar',
  'sulfur', 'sulfuric-acid', 'lubricant', 'stone', 'stone-brick',
]);
const HEADROOM_FACTOR = 1.2;

function positive(value, description) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${description}: expected a finite positive number`);
  }
  return value;
}

/**
 * Rates are items/minute or fluid units/minute; crafts are recipe executions/min.
 * Custom targets use science prototype names; omitted packs have target zero.
 * Ideal machine counts are fractional, with separate whole-machine recommendations.
 * This is an independent material/rate audit, not native throughput evidence.
 */
export function calculateRequirements(raw, targets = DEFAULT_TARGETS) {
  if (!raw?.recipe || !targets || typeof targets !== 'object' || Array.isArray(targets)) {
    throw new Error('Expected data.raw recipes and a science target map');
  }
  const finalOutputsPerMinute = Object.fromEntries(Object.keys(DEFAULT_TARGETS).map(name => [name, 0]));
  for (const [name, rate] of Object.entries(targets)) {
    if (!Object.hasOwn(DEFAULT_TARGETS, name)) throw new Error(`Unsupported science target: ${name}`);
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
      throw new Error(`Invalid target rate for ${name}`);
    }
    finalOutputsPerMinute[name] = rate;
  }
  const externalPerMinute = Object.fromEntries(EXTERNAL_INPUTS.map(name => [name, 0]));
  const craftsPerMinute = {};
  const recipes = new Map();
  const machineNames = ['assembling-machine-2', 'chemical-plant'];

  function recipeFor(name) {
    if (recipes.has(name)) return recipes.get(name);
    const recipe = raw.recipe[name];
    if (!recipe) throw new Error(`Missing internal recipe: ${name}; external boundary is fixed`);
    // Reject recipes requiring a solver for co-products, random yields, or recycling.
    const result = recipe.results?.[0];
    if (recipe.results?.length !== 1 || result?.name !== name ||
        (result.probability !== undefined && result.probability !== 1) ||
        result.amount_min !== undefined || result.amount_max !== undefined ||
        !Array.isArray(recipe.ingredients)) {
      throw new Error(`Unsupported deterministic single-product recipe: ${name}`);
    }
    const outputAmount = positive(result.amount, `${name} result amount`);
    const seconds = positive(recipe.energy_required ?? 0.5, `${name} craft time`);
    const categories = recipe.categories ?? [recipe.category ?? 'crafting'];
    if (!Array.isArray(categories) || !categories.length) throw new Error(`Invalid categories: ${name}`);
    const machine = machineNames.find(candidate =>
      raw['assembling-machine']?.[candidate]?.crafting_categories?.some(category => categories.includes(category)));
    if (!machine) throw new Error(`No permitted machine for recipe: ${name}`);
    const speed = positive(raw['assembling-machine'][machine].crafting_speed, `${machine} crafting speed`);
    for (const ingredient of recipe.ingredients) {
      if (typeof ingredient.name !== 'string') throw new Error(`Invalid ingredient in ${name}`);
      positive(ingredient.amount, `${name} ingredient amount`);
    }
    const info = { recipe, outputAmount, seconds, machine, speed };
    recipes.set(name, info);
    return info;
  }

  function expand(name, rate, ancestors = new Set()) {
    if (!rate) return;
    if (Object.hasOwn(externalPerMinute, name)) {
      externalPerMinute[name] += rate;
      return;
    }
    if (ancestors.has(name)) throw new Error(`Recipe cycle: ${[...ancestors, name].join(' -> ')}`);
    const { recipe, outputAmount } = recipeFor(name);
    const crafts = rate / outputAmount;
    craftsPerMinute[name] = (craftsPerMinute[name] ?? 0) + crafts;
    const next = new Set([...ancestors, name]);
    for (const ingredient of recipe.ingredients) expand(ingredient.name, crafts * ingredient.amount, next);
  }
  for (const [name, rate] of Object.entries(finalOutputsPerMinute)) expand(name, rate);

  const idealMachines = {};
  const machines = {};
  for (const name of Object.keys(craftsPerMinute).sort()) {
    const { machine, speed, seconds, outputAmount } = recipes.get(name);
    const ideal = craftsPerMinute[name] * seconds / (60 * speed);
    idealMachines[name] = ideal;
    machines[name] = {
      machine, craftingSpeed: speed, craftSeconds: seconds, outputPerCraft: outputAmount,
      craftsPerMinute: craftsPerMinute[name], outputPerMinute: craftsPerMinute[name] * outputAmount,
      idealCount: ideal, minimumCount: Math.ceil(ideal),
      recommendedCount: Math.ceil(ideal * HEADROOM_FACTOR),
    };
  }

  // Belt speed is tiles/tick: 60 ticks/sec, 4 items/tile/lane, 2 lanes.
  const redBeltPerMinute = positive(raw['transport-belt']?.['fast-transport-belt']?.speed,
    'red belt speed') * 60 * 4 * 2 * 60;
  const copperDemand = externalPerMinute['copper-plate'];
  const copper = {
    demandPerMinute: copperDemand,
    redBeltCapacityPerMinute: redBeltPerMinute,
    redBeltLaneCapacityPerMinute: redBeltPerMinute / 2,
    utilization: copperDemand / redBeltPerMinute,
    sparePerMinute: redBeltPerMinute - copperDemand,
    nearCapacity: copperDemand >= redBeltPerMinute * 0.9,
    exceedsCapacity: copperDemand > redBeltPerMinute,
    recommendedCapacityPerMinute: copperDemand * HEADROOM_FACTOR,
    recommendedRedBelts: Math.ceil(copperDemand * HEADROOM_FACTOR / redBeltPerMinute),
  };
  const researchingSpeed = positive(raw.lab?.lab?.researching_speed ?? 1, 'base lab researching speed');
  if (!raw.lab?.lab || !Object.keys(DEFAULT_TARGETS).every(name => raw.lab.lab.inputs?.includes(name))) {
    throw new Error('Base lab must accept all five science packs');
  }
  // This formula applies to research consuming one of EACH of the five packs per unit.
  const setsPerMinute = Math.min(...Object.values(finalOutputsPerMinute));
  return {
    finalOutputsPerMinute, externalPerMinute, craftsPerMinute, idealMachines, machines,
    headroomFactor: HEADROOM_FACTOR,
    recommendedExternalPerMinute: Object.fromEntries(Object.entries(externalPerMinute)
      .map(([name, rate]) => [name, rate * HEADROOM_FACTOR])),
    baseLabCapacity: {
      assumption: 'One of each RGBYP pack per research unit; no modules or research-speed bonuses',
      researchingSpeed, setsPerMinute,
      formula: 'labs = setsPerMinute * researchUnitSeconds / (60 * researchingSpeed)',
      labsPerResearchUnitSecond: setsPerMinute / (60 * researchingSpeed),
      labsFor30SecondResearch: setsPerMinute * 30 / (60 * researchingSpeed),
      labsFor60SecondResearch: setsPerMinute * 60 / (60 * researchingSpeed),
    },
    headroom: {
      factor: HEADROOM_FACTOR,
      externalPerMinute: Object.fromEntries(Object.entries(externalPerMinute).map(([name, rate]) => [name, rate * HEADROOM_FACTOR])),
      copper,
      recommendations: copper.nearCapacity ? [
        `Copper demand is ${copperDemand}/min against ${redBeltPerMinute}/min on a full two-lane red belt.`,
        `Provide at least ${copper.recommendedCapacityPerMinute}/min copper capacity (20% above demand); use ${copper.recommendedRedBelts} red belts or equivalent faster transport with balanced lanes.`,
        'Use the recommended machine counts for 20% nominal capacity above demand; check inserters and shared intermediate belts separately.',
      ] : ['Use the recommended machine counts and external supply rates for 20% nominal capacity above demand.'],
    },
  };
}
