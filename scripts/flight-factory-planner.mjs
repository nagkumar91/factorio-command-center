import {EPS, materialKey} from './flight-factory-model.mjs';
import {solveLinearProgram} from './flight-factory-solver.mjs';
import {stochasticDependencyAudit} from './flight-native-statistics.mjs';

const tidy = n => Math.abs(n) < 1e-10 ? 0 : Number(n.toPrecision(12));
const description = (model, key) => { const g = model.goods.get(key); return {id: g.id, type: g.type}; };
const compare = (a, b) => materialKey(a).localeCompare(materialKey(b));

function preferredRecipe(model, key) {
  return [...(model.producers.get(key) || [])].sort((a, b) => Number(b.id === model.goods.get(key)?.id) - Number(a.id === model.goods.get(key)?.id)
    || Number(a.hidden) - Number(b.hidden) || a.ingredients.length - b.ingredients.length || a.id.localeCompare(b.id))[0];
}

export function variantBoundary(model, targetKey, mode, supplied) {
  const raw = new Set(model.rawSources.keys()); raw.delete(targetKey);
  if (mode === 'raw') return raw;
  if (!['intermediary', 'mixed'].includes(mode)) throw new Error(`Unknown factory mode: ${mode}`);
  if (supplied) return new Set([...raw, ...supplied.map(i => typeof i === 'string' ? i : materialKey(i))].filter(k => k !== targetKey));
  const recipe = preferredRecipe(model, targetKey);
  if (!recipe) return raw;
  if (mode === 'intermediary') return new Set([...raw, ...recipe.ingredients.map(materialKey)].filter(k => k !== targetKey));
  // Mixed imports complex direct ingredients; simple ingredients are made from
  // natural resources. The chosen boundary is saved, never inferred in the UI.
  const simple = key => raw.has(key) || (model.producers.get(key) || []).some(r => r.ingredients.every(i => raw.has(materialKey(i))));
  return new Set([...raw, ...recipe.ingredients.filter(i => !simple(materialKey(i))).map(materialKey)].filter(k => k !== targetKey));
}

export function auditBalance(plan, model) {
  const totals = new Map(), consumed = new Map(), produced = new Map();
  const add = (map, key, amount) => map.set(key, (map.get(key) || 0) + amount);
  const byId = new Map(model.recipes.map(r => [r.id, r]));
  for (const step of plan.steps) {
    const recipe = byId.get(step.recipe);
    if (!recipe) throw new Error(`Unknown plan recipe ${step.recipe}`);
    for (const i of recipe.ingredients) add(consumed, materialKey(i), step.craftsPerSecond * i.amount);
    for (const i of recipe.results) add(produced, materialKey(i), step.craftsPerSecond * i.expectedAmount);
  }
  for (const [key, n] of produced) add(totals, key, n);
  for (const [key, n] of consumed) add(totals, key, -n);
  for (const input of plan.inputs) add(totals, materialKey(input), input.perSecond);
  add(totals, materialKey(plan.target), -plan.target.perSecond);
  for (const s of plan.surplus) add(totals, materialKey(s), -s.perSecond);
  const rows = [...totals].map(([key, residual]) => ({...description(model, key), producedPerSecond: tidy(produced.get(key) || 0), consumedPerSecond: tidy(consumed.get(key) || 0), residual: tidy(residual)})).sort(compare);
  const maxResidual = Math.max(0, ...rows.map(r => Math.abs(r.residual)));
  return {passed: maxResidual < 1e-6, maxResidual, rows};
}

export function classifyStochasticTarget(model, steps, target, surplus = []) {
  // Use the same installed-recipe dependency walk as native evaluation. An
  // unused random seed is not a random dependency of a deterministic product.
  const audit = stochasticDependencyAudit({stochastic: true, entities: steps.map(s => ({recipe: s.recipe})),
    outputs: [{type: target.type, name: target.id}]}, model.raw);
  const variable = new Map(audit.variableMaterials.map(p => [p.material, p]));
  const stochastic = variable.has(materialKey(target));
  return {stochastic, stochasticSurplus: surplus.filter(p => variable.has(materialKey(p))).map(p => ({...p, dependency: variable.get(materialKey(p))})),
    stochasticDependencyAudit: {...audit, declaredStochastic: stochastic, eligibleOutputKeys: stochastic ? audit.eligibleOutputKeys : [],
      policy: 'Installed selected-recipe target dependency; unused random surplus is reported separately.'}};
}

export function planFactory(model, target, {mode = 'raw', perSecond = 1 / 60, supplied, maxRecipes = 700, excludedRecipes = [], triedCycleFallback = false} = {}) {
  const targetKey = typeof target === 'string' ? `item:${target}` : materialKey(target);
  if (!model.goods.has(targetKey)) throw new Error(`Unknown installed material ${targetKey}`);
  if (!Number.isFinite(perSecond) || perSecond <= 0 || perSecond > 1000) throw new Error('Target rate must be positive and at most 1000/s');
  const boundary = variantBoundary(model, targetKey, mode, supplied);
  const available = new Set(boundary), executable = new Set();
  for (const recipe of model.recipes) for (const i of recipe.ingredients) {
    const k = materialKey(i);
    if (recipe.results.some(p => materialKey(p) === k) && (model.rawSources.has(k) || model.reachable.has(k) || model.manualSources.has(k))) available.add(k);
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const recipe of model.recipes) if (!executable.has(recipe.id) && recipe.ingredients.every(i => available.has(materialKey(i)))) {
      executable.add(recipe.id);
      for (const p of recipe.results) if (!available.has(materialKey(p))) { available.add(materialKey(p)); expanded = true; }
    }
  }
  const selected = new Map(), visiting = new Set(), materials = new Set([targetKey]);
  function visit(key) {
    materials.add(key);
    if (boundary.has(key) || visiting.has(key)) return;
    visiting.add(key);
    for (const r of model.producers.get(key) || []) {
      if (!executable.has(r.id) || excludedRecipes.includes(r.id)) continue;
      selected.set(r.id, r);
      for (const p of r.results) materials.add(materialKey(p));
      for (const i of r.ingredients) visit(materialKey(i));
    }
  }
  visit(targetKey);
  const base = {schemaVersion: 1, prototypeSha256: model.prototypeSha256, surface: model.surface, mode, target: {...description(model, targetKey), perSecond},
    assumptions: ['Normal-quality machines; no modules, beacons, or researched productivity bonuses.',
      'Raw inputs are mined, harvested or pumped materials delivered at the factory boundary; mining and farming infrastructure is external.',
      'All recipe unlocks and construction technologies must be researched by the player. No research is granted by these blueprints.',
      'Rates are steady-state material balances. Rounded machine counts supply capacity; transport, spoilage, start-up and sustained rates require native tests.']};
  if (!selected.size) return {...base, status: 'unsupported', reason: model.recipeProducts.has(targetKey) ? 'No supported, reachable recipe route on this surface.' : 'No crafting recipe: extraction, launch, spoilage, script or unavailable item.', steps: [], inputs: [], surplus: []};
  if (selected.size > maxRecipes) return {...base, status: 'unsupported', reason: `Recipe closure exceeds ${maxRecipes} recipes`, steps: [], inputs: [], surplus: []};
  const recipes = [...selected.values()].sort((a, b) => a.id.localeCompare(b.id));
  const imports = [...materials].filter(k => boundary.has(k)).sort();
  const keys = [...materials].sort();
  const columns = [...recipes.map(r => r.net), ...imports.map(k => new Map([[k, 1]]))];
  const A = keys.map(k => columns.map(col => -(col.get(k) || 0)));
  const b = keys.map(k => k === targetKey ? -perSecond : 0);
  // Small strictly positive craft costs rule out gratuitous circulation. Natural
  // inputs carry cost too, so shared co-products offset upstream demand globally.
  const ordinaryMachines = new Set(['assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3', 'electric-furnace', 'chemical-plant', 'oil-refinery', 'centrifuge']);
  const ordinaryCategories = new Set(['crafting', 'basic-crafting', 'advanced-crafting', 'crafting-with-fluid', 'smelting', 'chemistry', 'oil-processing', 'centrifuging']);
  const c = [...recipes.map(r => {
    const advancedHandling = ordinaryMachines.has(r.machine) || ordinaryCategories.has(r.category) ? 0 : 2 * r.results.reduce((sum, p) => sum + p.expectedAmount * (p.type === 'fluid' ? .01 : 1), 0);
    return -(0.01 + r.time / r.speed * 0.05 + advancedHandling + (r.hidden ? 1 : 0));
  }), ...imports.map(k => -(model.goods.get(k).type === 'fluid' ? 0.001 : 0.1))];
  const solution = solveLinearProgram(A, b, c);
  if (solution.status !== 'optimal') return {...base, status: 'unsupported', reason: `No balanced ${mode} solution (${solution.status}); unresolved inputs: ${keys.filter(k => !boundary.has(k) && !model.producers.has(k)).join(', ') || 'cyclic or surface-limited production'}`, steps: [], inputs: [], surplus: []};
  const steps = recipes.flatMap((r, i) => {
    const rate = solution.x[i]; if (rate < EPS) return [];
    const exact = rate * r.time / r.speed, count = Math.max(1, Math.ceil(exact - EPS));
    return [{recipe: r.id, machine: r.machine, craftsPerSecond: tidy(rate), machineCount: count, exactMachineCount: tidy(exact), utilization: tidy(exact / count),
      craftingSpeed: r.speed, intrinsicProductivity: r.productivity, unlockTechnologies: r.unlockTechnologies,
      ingredients: r.ingredients.map(i => ({...i, perSecond: tidy(i.amount * rate)})),
      results: r.results.map(i => ({...i, perSecond: tidy(i.expectedAmount * rate)})), fuel: r.fuel,
      stochastic: r.results.some(p => p.probability !== 1 || (p.amountMin !== undefined && p.amountMin !== p.amountMax))}];
  });
  const inputs = imports.flatMap((key, i) => solution.x[recipes.length + i] > EPS ? [{...description(model, key), perSecond: tidy(solution.x[recipes.length + i]),
    source: model.rawSources.has(key) ? 'natural-resource' : 'supplied-intermediate', sources: model.rawSources.get(key) || [], obtainableFromRaw: model.reachable.has(key)}] : []);
  const net = new Map(keys.map(key => [key, 0]));
  for (let i = 0; i < columns.length; i++) for (const [key, amount] of columns[i]) net.set(key, net.get(key) + amount * solution.x[i]);
  net.set(targetKey, net.get(targetKey) - perSecond);
  const surplus = [...net].filter(([, n]) => n > EPS).map(([key, n]) => ({...description(model, key), perSecond: tidy(n), handling: 'Export continuously; finite storage eventually blocks production.'}));
  // Determine executable start-up order. A mathematically balanced catalyst loop
  // can still require a seed. Never silently turn that into a raw-input claim.
  const startupAvailable = new Set(inputs.map(materialKey)), started = new Set();
  let progress = true;
  while (progress) {
    progress = false;
    for (const step of steps) if (!started.has(step.recipe) && step.ingredients.every(i => startupAvailable.has(materialKey(i)))) {
      started.add(step.recipe); step.results.forEach(i => startupAvailable.add(materialKey(i))); progress = true;
    }
  }
  const startupStock = [];
  for (const step of steps.filter(s => !started.has(s.recipe))) for (const i of step.ingredients.filter(i => !startupAvailable.has(materialKey(i)))) {
    const old = startupStock.find(s => materialKey(s) === materialKey(i));
    if (old) old.amount = Math.max(old.amount, Math.ceil(i.amount * step.machineCount));
    else startupStock.push({...description(model, materialKey(i)), amount: Math.ceil(i.amount * step.machineCount), reason: 'Selected steady-state cycle cannot start empty.',
      sources: model.rawSources.get(materialKey(i)) || (model.manualSources.has(materialKey(i)) ? [model.manualSources.get(materialKey(i))] : [{kind: 'separate-recipe-bootstrap', recipeIds: (model.producers.get(materialKey(i)) || []).map(r => r.id)}])});
  }
  // Downstream recipes can require a large batch of the same seed material.
  // Seed only the local producers when those finite stocks start the entire
  // selected network; do not require every downstream batch as initial stock.
  const localSeeds = startupStock.flatMap(stock => {
    const producers = steps.filter(s => s.results.some(p => materialKey(p) === materialKey(stock)) && s.ingredients.some(i => materialKey(i) === materialKey(stock)));
    return producers.length ? [{...stock, amount: producers.reduce((n, s) => n + Math.ceil(s.ingredients.filter(i => materialKey(i) === materialKey(stock)).reduce((a, i) => a + i.amount, 0) * s.machineCount), 0)}] : [];
  });
  if (localSeeds.length) {
    const bootstrap = new Set([...inputs.map(materialKey), ...localSeeds.map(materialKey)]), complete = new Set();
    let advance = true;
    while (advance) { advance = false; for (const s of steps) if (!complete.has(s.recipe) && s.ingredients.every(i => bootstrap.has(materialKey(i)))) { complete.add(s.recipe); s.results.forEach(p => bootstrap.add(materialKey(p))); advance = true; } }
    if (complete.size === steps.length) startupStock.splice(0, startupStock.length, ...localSeeds);
  }
  if (startupStock.length && !triedCycleFallback) {
    const cycles = steps.filter(s => !started.has(s.recipe) && s.ingredients.some(i => s.results.some(p => materialKey(p) === materialKey(i)))).map(s => s.recipe);
    if (cycles.length) {
      const alternate = planFactory(model, target, {mode, perSecond, supplied, maxRecipes, excludedRecipes: [...excludedRecipes, ...cycles], triedCycleFallback: true});
      if (alternate.status === 'planned' && !alternate.startupStock.length) {
        alternate.warnings.push(`Selected a startable route instead of seed-dependent cycles: ${cycles.join(', ')}.`);
        return alternate;
      }
    }
  }
  const stochastic = classifyStochasticTarget(model, steps, base.target, surplus);
  base.assumptions.push(`Random recipe output affects the target dependency: ${stochastic.stochastic ? 'yes' : 'no'}. Random surplus: ${stochastic.stochasticSurplus.map(p => p.id).join(', ') || 'none'}.`);
  const warnings = [];
  if (steps.some(s => s.stochastic)) warnings.push('Random result rates are expectations, not guaranteed yields. Native throughput needs repeated measurement windows; target randomness follows its actual selected-recipe dependencies.');
  if (steps.some(s => [...s.ingredients, ...s.results].some(p => model.goods.get(materialKey(p))?.spoilTicks))) warnings.push('Spoilage losses are not included in stoichiometric demand; measure them in the native run.');
  if (steps.some(s => s.fuel)) warnings.push('Burner fuel is included at active crafting consumption; idle fuel and spoilage can increase demand.');
  if (inputs.some(i => !i.obtainableFromRaw)) warnings.push('Some supplied intermediates have no supported raw-source route; importing them is an explicit external dependency.');
  if (startupStock.length) warnings.push('Startup stock is separate from continuous inputs. This layout cannot start from raw inputs alone.');
  const plan = {...base, status: 'planned', planningMethod: 'global-net-stoichiometric-linear-program', objective: 'Weighted imports, active machine time and advanced-machine handling. Ordinary machines preferred; not a claim of global layout optimality.',
    steps, inputs: inputs.sort(compare), surplus: surplus.sort(compare), startupStock: startupStock.sort(compare), rawOnly: inputs.every(i => i.source === 'natural-resource') && !startupStock.length,
    ...stochastic, warnings, machineCount: steps.reduce((n, s) => n + s.machineCount, 0)};
  plan.requiredResearch = requiredResearch(model, steps);
  plan.balance = auditBalance(plan, model);
  if (!plan.balance.passed) throw new Error(`LP residual failed for ${targetKey}: ${JSON.stringify(plan.balance.rows.filter(r => Math.abs(r.residual) > 1e-6))}`);
  return plan;
}

export function requiredResearch(model, steps, entityNames = []) {
  const recipeNames = new Set(steps.map(s => s.recipe));
  const entities = new Set([...steps.map(s => s.machine), ...entityNames]);
  for (const good of model.goods.values()) if (good.type === 'item' && entities.has(good.prototype.place_result)) {
    const options = model.producers.get(materialKey(good)) || [];
    const recipe = options.find(r => r.id === good.id) || options.find(r => !r.hidden);
    if (recipe) recipeNames.add(recipe.id);
  }
  const technology = model.raw.technology || {}, chosen = new Set(), requirements = [];
  function closure(name, into, seen = new Set()) {
    if (seen.has(name)) return; seen.add(name);
    for (const p of technology[name]?.prerequisites || []) closure(p, into, seen);
    into.add(name);
  }
  for (const id of recipeNames) {
    const recipe = model.recipes.find(r => r.id === id);
    if (!recipe || recipe.prototype.enabled !== false) continue;
    const alternatives = recipe.unlockTechnologies.map(name => { const technologies = new Set(); closure(name, technologies); return {name, technologies}; }).sort((a, b) => a.technologies.size - b.technologies.size || a.name.localeCompare(b.name));
    if (alternatives.length) { alternatives[0].technologies.forEach(t => chosen.add(t)); requirements.push({recipe: id, unlockAlternatives: recipe.unlockTechnologies, selected: alternatives[0].name}); }
  }
  return {technologies: [...chosen].sort(), requirements, policy: 'Required research listed for the player; blueprint import never grants it. Infinite productivity research excluded from the rate model.'};
}
