// Recipe arithmetic of the Vulcanus science blueprint, from the pinned prototypes only: what 60 packs a minute of each kind need,
// per recipe, with the foundry's built-in +50% productivity where the recipe allows productivity, and the whole machines that makes.
import { TARGET } from './design.mjs';
// Which machine makes which recipe in this blueprint.
export const MAKER = {
  'production-science-pack': 'assembling-machine-3', 'utility-science-pack': 'assembling-machine-3', 'electric-furnace': 'assembling-machine-3', 'productivity-module': 'assembling-machine-3', rail: 'assembling-machine-3',
  'processing-unit': 'assembling-machine-3', 'flying-robot-frame': 'assembling-machine-3', 'electric-engine-unit': 'assembling-machine-3', 'engine-unit': 'assembling-machine-3', 'advanced-circuit': 'assembling-machine-3', 'electronic-circuit': 'assembling-machine-3',
  battery: 'chemical-plant', 'stone-brick': 'electric-furnace',
  'casting-low-density-structure': 'foundry', 'casting-steel': 'foundry', 'casting-iron': 'foundry', 'casting-copper': 'foundry', 'casting-iron-gear-wheel': 'foundry', 'casting-iron-stick': 'foundry', 'casting-pipe': 'foundry', 'casting-copper-cable': 'foundry',
  'molten-iron-from-lava': 'foundry', 'molten-copper-from-lava': 'foundry',
};
// The recipe that makes each intermediate here (casting wherever a casting recipe exists).
export const SOURCE = { 'low-density-structure': 'casting-low-density-structure', 'steel-plate': 'casting-steel', 'iron-plate': 'casting-iron', 'copper-plate': 'casting-copper', 'iron-gear-wheel': 'casting-iron-gear-wheel', 'iron-stick': 'casting-iron-stick', pipe: 'casting-pipe', 'copper-cable': 'casting-copper-cable', 'molten-iron': 'molten-iron-from-lava', 'molten-copper': 'molten-copper-from-lava' };
export const OUTSIDE = ['lava', 'calcite', 'plastic-bar', 'sulfuric-acid', 'lubricant'];
export function bill(p, perMinute = TARGET) {
  const crafts = {}, outside = Object.fromEntries(OUTSIDE.map(n => [n, 0])), made = {}, used = {};
  const prod = name => (MAKER[name] === 'foundry' && p.recipes[name].allow_productivity ? 1 + p.entities.foundry.effect_receiver.base_effect.productivity : 1);
  const need = (item, amount) => {
    if (OUTSIDE.includes(item)) { outside[item] += amount; return; }
    if (item === 'stone') { used.stone = (used.stone || 0) + amount; return; }
    const name = SOURCE[item] || item, r = p.recipes[name], out = r.results.find(v => v.name === item).amount * prod(name), n = amount / out;
    crafts[name] = (crafts[name] || 0) + n;
    for (const v of r.results) if (v.name !== item) made[v.name] = (made[v.name] || 0) + v.amount * prod(name) * n;
    for (const v of r.ingredients) need(v.name, v.amount * n);
  };
  need('production-science-pack', perMinute); need('utility-science-pack', perMinute);
  const machines = {};
  for (const [name, n] of Object.entries(crafts)) {
    const r = p.recipes[name], m = MAKER[name], perMachine = 60 * p.entities[m].crafting_speed / r.energy_required;
    machines[name] = { machine: m, craftsPerMinute: n, perMachine, exact: n / perMachine, whole: Math.ceil(n / perMachine - 1e-9) };
  }
  return { perMinute, crafts, machines, outside, stone: { made: made.stone, used: used.stone, surplus: made.stone - used.stone } };
}
