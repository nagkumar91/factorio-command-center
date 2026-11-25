// The bill of the foundry mall: what is stocked, in which priority group, by which recipe in which machine,
// and what one item or one full fill costs in lava, calcite and the other outside inputs. Pure functions of the
// pinned prototypes and the launch-kit bill; the generator, the README and the tests all read this file.
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT, readJson } from './lib.mjs';

export const KIT_BILL = path.join(PROJECT, 'scripts/launch-kit/bill.json');
export const loadKit = async () => (await readJson(KIT_BILL)).items.map(v => ({ item: v.item, cap: v.count + v.spare }));

// Priority groups in the order of the request (1 = highest). `kit` is filled from scripts/launch-kit/bill.json.
export const GROUP_NAMES = ['assembling machine 3', 'white-pack platform kit', 'express belts', 'inserters', 'electric mining drill', 'foundry'];
export const STOCK = [
  { group: 1, item: 'assembling-machine-3' },
  { group: 3, item: 'express-transport-belt' }, { group: 3, item: 'express-underground-belt' }, { group: 3, item: 'express-splitter' },
  { group: 4, item: 'fast-inserter' }, { group: 4, item: 'bulk-inserter' },
  { group: 5, item: 'electric-mining-drill' },
  { group: 6, item: 'foundry' },
];
// The products with their group and cap. Fast inserters are two separate stocks: the kit's own in the kit chest at
// the kit's priority (key 'fast-inserter (kit)', cap signal K) and a full stack in the inserter chest at the inserter
// group's priority. `key` names a stock; it is the item name everywhere else.
export const KIT_FAST_INSERTERS = 'fast-inserter (kit)';
export function products(p, kit) {
  const list = [];
  for (const s of STOCK.filter(v => v.group === 1)) list.push({ ...s, key: s.item, cap: p.items[s.item].stack_size });
  for (const k of kit) list.push({ group: 2, item: k.item, key: k.item === 'fast-inserter' ? KIT_FAST_INSERTERS : k.item, cap: k.cap });
  for (const s of STOCK.filter(v => v.group > 1)) list.push({ ...s, key: s.item, cap: p.items[s.item].stack_size });
  return list;
}

// Where each item comes from. machine: the crafting machine type; outside: supplied at an entrance.
export const OUTSIDE = ['lava', 'calcite', 'plastic-bar', 'tungsten-carbide', 'sulfuric-acid', 'lubricant', 'water'];
const CAST = { 'iron-plate': 'casting-iron', 'copper-plate': 'casting-copper', 'steel-plate': 'casting-steel', 'iron-gear-wheel': 'casting-iron-gear-wheel', 'iron-stick': 'casting-iron-stick', pipe: 'casting-pipe', 'copper-cable': 'casting-copper-cable', 'low-density-structure': 'casting-low-density-structure', concrete: 'concrete-from-molten-iron', 'molten-iron': 'molten-iron-from-lava', 'molten-copper': 'molten-copper-from-lava' };
const FOUNDRY_ITEMS = ['transport-belt', 'underground-belt', 'splitter', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'express-transport-belt', 'express-underground-belt', 'express-splitter', 'foundry'];
export function route(p, item) {
  if (OUTSIDE.includes(item) || item === 'stone') return null;
  if (CAST[item]) return { recipe: CAST[item], machine: 'foundry' };
  if (FOUNDRY_ITEMS.includes(item)) return { recipe: item, machine: 'foundry' };
  if (item === 'battery') return { recipe: 'battery', machine: 'chemical-plant' };
  if (item === 'stone-brick') return { recipe: 'stone-brick', machine: 'electric-furnace' };
  if (!p.recipes[item]) throw new Error('No route for ' + item);
  return { recipe: item, machine: 'assembling-machine-3' };
}
// Products per craft of `recipe` in `machine`: the foundry's built-in +50% applies to every recipe it runs
// (measured natively for belts as well: 10 belt crafts gave 30 belts).
export const productivity = (p, machine) => 1 + (p.entities[machine].effect_receiver?.base_effect?.productivity || 0);
export const yieldOf = (p, r, item) => p.recipes[r.recipe].results.find(v => v.name === item).amount * productivity(p, r.machine);

// Expand a demand {item: count} down to the outside inputs. Returns crafts per recipe, machine seconds per recipe,
// the outside inputs, and stone made and used. Expected values: productivity bonus products are counted as fractions.
export function expand(p, demand) {
  const need = new Map(), crafts = {}, outside = {}, order = [];
  const visit = (item, seen = new Set()) => { if (order.includes(item)) return; if (seen.has(item)) throw new Error('cycle at ' + item); seen.add(item); const r = route(p, item); if (r) for (const v of p.recipes[r.recipe].ingredients) visit(v.name, seen); order.push(item); };
  for (const item of Object.keys(demand)) visit(item);
  visit('stone-brick');
  for (const [item, n] of Object.entries(demand)) need.set(item, (need.get(item) || 0) + n);
  let stoneMade = 0;
  for (const item of [...order].reverse()) {
    const n = need.get(item) || 0;
    if (!n) continue;
    const r = route(p, item);
    if (!r) { if (item === 'stone') continue; outside[item] = (outside[item] || 0) + n; continue; }
    const c = n / yieldOf(p, r, item);
    crafts[r.recipe] = (crafts[r.recipe] || 0) + c;
    for (const v of p.recipes[r.recipe].ingredients) need.set(v.name, (need.get(v.name) || 0) + v.amount * c);
    const stone = p.recipes[r.recipe].results.find(v => v.name === 'stone');
    if (stone) stoneMade += stone.amount * productivity(p, r.machine) * c;
  }
  const seconds = {};
  for (const [name, c] of Object.entries(crafts)) { const machine = Object.values(CAST).includes(name) || FOUNDRY_ITEMS.includes(name) ? 'foundry' : name === 'battery' ? 'chemical-plant' : name === 'stone-brick' ? 'electric-furnace' : 'assembling-machine-3'; seconds[name] = c * p.recipes[name].energy_required / p.entities[machine].crafting_speed; }
  const stoneUsed = need.get('stone') || 0;
  return { crafts, machineSeconds: seconds, outside, intermediates: Object.fromEntries([...need].filter(([k]) => !OUTSIDE.includes(k) && k !== 'stone')), moltenIron: need.get('molten-iron') || 0, moltenCopper: need.get('molten-copper') || 0, stoneMade, stoneUsed, stoneSurplus: stoneMade - stoneUsed };
}
export async function fullBill(p) {
  const kit = await loadKit(), list = products(p, kit);
  const round = v => Math.round(v * 100) / 100;
  const tidy = e => ({ lava: round(e.outside.lava || 0), calcite: round(e.outside.calcite || 0), 'plastic-bar': round(e.outside['plastic-bar'] || 0), 'tungsten-carbide': round(e.outside['tungsten-carbide'] || 0), 'sulfuric-acid': round(e.outside['sulfuric-acid'] || 0), lubricant: round(e.outside.lubricant || 0), water: round(e.outside.water || 0), moltenIron: round(e.moltenIron), moltenCopper: round(e.moltenCopper), stoneMade: round(e.stoneMade), stoneUsed: round(e.stoneUsed), stoneSurplus: round(e.stoneSurplus) });
  const perItem = Object.fromEntries(list.map(v => [v.key, tidy(expand(p, { [v.item]: 1 }))]));
  const perGroup = {};
  const demand = rows => { const d = {}; for (const v of rows) d[v.item] = (d[v.item] || 0) + v.cap; return d; };
  for (const g of [1, 2, 3, 4, 5, 6]) perGroup[g] = tidy(expand(p, demand(list.filter(v => v.group === g))));
  const all = demand(list);
  const total = expand(p, all);
  return { kit, products: list, perItem, perGroup, fullFill: { ...tidy(total), crafts: Object.fromEntries(Object.entries(total.crafts).map(([k, v]) => [k, round(v)])), machineMinutes: Object.fromEntries(Object.entries(total.machineSeconds).map(([k, v]) => [k, round(v / 60)])), intermediates: Object.fromEntries(Object.entries(total.intermediates).map(([k, v]) => [k, round(v)])) } };
}
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const { prototypes } = await import('./lib.mjs');
  const b = await fullBill(await prototypes());
  console.log(JSON.stringify(b, null, 1));
}
