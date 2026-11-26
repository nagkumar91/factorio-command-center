// The bill of the foundry belts and fuel mall: what is stocked, in which priority group, by which recipe in which
// machine, and what one item or one full fill costs at the entrances. Pure functions of the pinned prototypes.
import path from 'node:path';
import { FUEL } from './lib.mjs';

// Priority groups in the order of the request (1 = highest). Rocket fuel is not in the list: its section shares no
// machine with the rest and runs whenever its chest is short.
export const GROUP_NAMES = ['express belts', 'inserters', 'electric mining drill', 'foundry'];
export const STOCK = [
  { group: 1, item: 'express-transport-belt', cap: 100 }, { group: 1, item: 'express-underground-belt', cap: 50 }, { group: 1, item: 'express-splitter', cap: 50 },
  { group: 2, item: 'fast-inserter', cap: 50 }, { group: 2, item: 'bulk-inserter', cap: 50 },
  { group: 3, item: 'electric-mining-drill', cap: 50 },
  { group: 4, item: 'foundry', cap: 20 },
];
export const FUEL_STACKS = 10;
// The products with their group and cap. Rocket fuel: ten stacks, four rockets' worth; no group.
export function products(p) {
  const list = STOCK.map(s => ({ ...s, key: s.item }));
  list.push({ group: 0, independent: true, item: FUEL, key: FUEL, cap: FUEL_STACKS * p.items[FUEL].stack_size });
  return list;
}

// Where each item or fluid comes from. Outside inputs are named by their entrance key: the fuel section has its own
// calcite belt ('calcite-fuel') and the mall part takes calcite on another ('calcite').
export const OUTSIDE = ['lava', 'calcite', 'plastic-bar', 'tungsten-carbide', 'lubricant', 'water', 'sulfuric-acid', 'coal', 'calcite-fuel'];
const CAST = { 'iron-plate': 'casting-iron', 'steel-plate': 'casting-steel', 'iron-gear-wheel': 'casting-iron-gear-wheel', 'iron-stick': 'casting-iron-stick', 'copper-cable': 'casting-copper-cable', concrete: 'concrete-from-molten-iron', 'molten-iron': 'molten-iron-from-lava', 'molten-copper': 'molten-copper-from-lava' };
const FOUNDRY_ITEMS = ['transport-belt', 'underground-belt', 'splitter', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'express-transport-belt', 'express-underground-belt', 'express-splitter', 'foundry'];
const FUEL_CHAIN = { [FUEL]: ['rocket-fuel', 'assembling-machine-3'], 'solid-fuel': ['solid-fuel-from-light-oil', 'chemical-plant'], 'light-oil': ['heavy-oil-cracking', 'chemical-plant'], 'heavy-oil': ['simple-coal-liquefaction', 'oil-refinery'] };
export function route(p, item, fuel = false) {
  if (item === 'stone') return null;
  if (item === 'calcite') return null;
  if (OUTSIDE.includes(item)) return null;
  if (FUEL_CHAIN[item]) return { recipe: FUEL_CHAIN[item][0], machine: FUEL_CHAIN[item][1], fuel: true };
  if (CAST[item]) return { recipe: CAST[item], machine: 'foundry' };
  if (FOUNDRY_ITEMS.includes(item)) return { recipe: item, machine: 'foundry' };
  if (item === 'stone-brick') return { recipe: 'stone-brick', machine: 'electric-furnace' };
  if (!p.recipes[item]) throw new Error('No route for ' + item);
  return { recipe: item, machine: 'assembling-machine-3' };
}
// Products per craft: the foundry's built-in +50% applies to every recipe it runs.
export const productivity = (p, machine) => 1 + (p.entities[machine].effect_receiver?.base_effect?.productivity || 0);
export const yieldOf = (p, r, item) => p.recipes[r.recipe].results.find(v => v.name === item).amount * productivity(p, r.machine);

// Expand a demand {item: count} down to the entrances. Expected values: productivity bonus products count as fractions.
export function expand(p, demand) {
  const need = new Map(), crafts = {}, outside = {}, order = [];
  // inside the fuel chain calcite and water come from the fuel section's own entrances
  const visit = (item, fuel) => { if (order.some(o => o.item === item)) return; const r = route(p, item); if (r) for (const v of p.recipes[r.recipe].ingredients) visit(v.name, fuel || !!r.fuel); order.push({ item, fuel: fuel || !!r?.fuel }); };
  for (const item of Object.keys(demand)) visit(item, false);
  for (const [item, n] of Object.entries(demand)) need.set(item, (need.get(item) || 0) + n);
  let stoneMade = 0;
  const fuelNeed = new Map();
  for (const { item } of [...order].reverse()) {
    for (const [bucket, inFuel] of [[need, false], [fuelNeed, true]]) {
      const n = bucket.get(item) || 0;
      if (!n) continue;
      const r = route(p, item);
      if (!r) { if (item === 'stone') continue; const key = item === 'calcite' && inFuel ? 'calcite-fuel' : item; outside[key] = (outside[key] || 0) + n; continue; }
      const c = n / yieldOf(p, r, item);
      crafts[r.recipe] = (crafts[r.recipe] || 0) + c;
      const into = inFuel || r.fuel ? fuelNeed : need;
      for (const v of p.recipes[r.recipe].ingredients) into.set(v.name, (into.get(v.name) || 0) + v.amount * c);
      const stone = p.recipes[r.recipe].results.find(v => v.name === 'stone');
      if (stone) stoneMade += stone.amount * productivity(p, r.machine) * c;
    }
  }
  const stoneUsed = need.get('stone') || 0;
  return { crafts, outside, moltenIron: need.get('molten-iron') || 0, moltenCopper: need.get('molten-copper') || 0, stoneMade, stoneUsed, stoneSurplus: stoneMade - stoneUsed };
}
// The entrances a product cannot be made without.
export const needsOf = (p, v) => Object.keys(expand(p, { [v.item]: 1 }).outside);
export function fullBill(p) {
  const list = products(p), round = v => Math.round(v * 100) / 100;
  const tidy = e => ({ ...Object.fromEntries(OUTSIDE.map(k => [k, round(e.outside[k] || 0)])), moltenIron: round(e.moltenIron), moltenCopper: round(e.moltenCopper), stoneMade: round(e.stoneMade), stoneUsed: round(e.stoneUsed), stoneSurplus: round(e.stoneSurplus) });
  const demand = rows => { const d = {}; for (const v of rows) d[v.item] = (d[v.item] || 0) + v.cap; return d; };
  const perItem = Object.fromEntries(list.map(v => [v.key, tidy(expand(p, { [v.item]: 1 }))]));
  const perGroup = Object.fromEntries([1, 2, 3, 4].map(g => [g, tidy(expand(p, demand(list.filter(v => v.group === g))))]));
  const total = expand(p, demand(list));
  // the fuel section at its design rate: crafts a minute for 12 rocket fuel a minute
  const one = expand(p, { [FUEL]: 1 });
  return { products: list, perItem, perGroup, fuelStock: tidy(expand(p, demand(list.filter(v => v.independent)))), fuelPerItem: tidy(one), fullFill: { ...tidy(total), crafts: Object.fromEntries(Object.entries(total.crafts).map(([k, v]) => [k, round(v)])) } };
}
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const { prototypes } = await import('./lib.mjs');
  console.log(JSON.stringify(fullBill(await prototypes()), null, 1));
}
