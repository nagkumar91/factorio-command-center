// Layout of the coal-plastic-lubricant supply. A pure function of the pinned prototypes and the fluid-slot table.
// Tiles (x east, y south), 32 x 10. Machines: 3 oil refineries (simple coal liquefaction), 1 heavy-oil cracker, 1 light-oil cracker,
// 1 plastic plant, 1 lubricant plant. No circuit wire: the fluids balance by themselves (see the README).
// The cracker, the light-oil cracker and the plastic plant touch each other: their fluid boxes connect directly, no pipe between them.
//
//   row 0        sulfuric acid over the refineries (west entrance (0,0)); plastic exit (19,0); water over the crackers, water entrance (27,0)
//   rows 1..5    refineries R0 R1 R2 (cols 2..16, facing south), plastic plant P (cols 18..20), light-oil cracker L (cols 21..23, rows 1..3),
//                heavy-oil cracker H (cols 24..26, rows 3..5)
//   row 6        refinery arms (three each), heavy-oil pipes-to-ground, P's coal arm; lubricant plant U (cols 28..30, rows 6..8)
//   row 7        the one belt: coal on one lane, calcite on the other (entrances (0,6) coal and (0,8) calcite side-load onto (1,7))
//   rows 8..9    heavy-oil pipes-to-ground out, heavy-oil row 9 east, up column 27 to H and U
import assert from 'node:assert/strict';
import { Layout, N, E, S, W } from '../lib.mjs';
import { assemble } from '../package.mjs';

export const ID = 'coal-plastic-lubricant';
export const TARGETS = { 'plastic-bar': 60, lubricant: 300 };

// Recipe arithmetic behind the machine counts and the panel figures, from the pinned recipes.
export function sizing(p) {
  const r = n => p.recipes[n];
  const amt = (rec, name) => [...rec.ingredients, ...rec.results].find(v => v.name === name).amount;
  const t = rec => rec.energy_required ?? 0.5;
  const plastic = r('plastic-bar'), lub = r('lubricant'), hc = r('heavy-oil-cracking'), lc = r('light-oil-cracking'), coal = r('simple-coal-liquefaction');
  const plasticCrafts = TARGETS['plastic-bar'] / amt(plastic, 'plastic-bar');
  const gas = plasticCrafts * amt(plastic, 'petroleum-gas');
  const lightCrafts = gas / amt(lc, 'petroleum-gas'), light = lightCrafts * amt(lc, 'light-oil');
  const heavyCrackCrafts = light / amt(hc, 'light-oil'), heavyForPlastic = heavyCrackCrafts * amt(hc, 'heavy-oil');
  const lubCrafts = TARGETS.lubricant / amt(lub, 'lubricant'), heavyForLub = lubCrafts * amt(lub, 'heavy-oil');
  const heavy = heavyForPlastic + heavyForLub, liqCrafts = heavy / amt(coal, 'heavy-oil');
  const perCraft = { coal: amt(coal, 'coal'), calcite: amt(coal, 'calcite'), 'sulfuric-acid': amt(coal, 'sulfuric-acid') };
  const perMinute = {
    coal: liqCrafts * perCraft.coal + plasticCrafts * amt(plastic, 'coal'), calcite: liqCrafts * perCraft.calcite, 'sulfuric-acid': liqCrafts * perCraft['sulfuric-acid'],
    water: heavyCrackCrafts * amt(hc, 'water') + lightCrafts * amt(lc, 'water'),
  };
  const requiredCraftsPerMinute = { 'simple-coal-liquefaction': liqCrafts, 'heavy-oil-cracking': heavyCrackCrafts, 'light-oil-cracking': lightCrafts, 'plastic-bar': plasticCrafts, lubricant: lubCrafts };
  const cost = {
    coalPerPlasticBar: (heavyForPlastic / TARGETS['plastic-bar'] / amt(coal, 'heavy-oil')) * perCraft.coal + amt(plastic, 'coal') / amt(plastic, 'plastic-bar'),
    coalPerLubricant: perCraft.coal / amt(coal, 'heavy-oil'),
  };
  return { targets: TARGETS, requiredCraftsPerMinute, perMinute, cost, heavyOilPerMinute: { forPlastic: heavyForPlastic, forLubricant: heavyForLub, total: heavy }, refineryCapacityHeavyPerMinute: 3 * 60 / t(coal) * amt(coal, 'heavy-oil') };
}

export function design(p, slots, options = {}) {
  const z = sizing(p);
  const L = new Layout(), roles = new Map(), routes = [];
  const machine = (name, cx, cy, extra, role) => { const e = L.machine(name, cx, cy, extra); roles.set(e.entity_number, role); return e; };
  const refineries = [4, 9, 14].map((cx, i) => machine('oil-refinery', cx, 3, { recipe: 'simple-coal-liquefaction', direction: S }, `liquefaction-${i + 1}`));
  const plastic = machine('chemical-plant', 19, 4, { recipe: 'plastic-bar', direction: E }, 'plastic');
  const light = machine('chemical-plant', 22, 2, { recipe: 'light-oil-cracking', direction: E }, 'light-cracking');
  const heavy = machine('chemical-plant', 25, 4, { recipe: 'heavy-oil-cracking', direction: E }, 'heavy-cracking');
  const lub = machine('chemical-plant', 29, 7, { recipe: 'lubricant', direction: W }, 'lubricant');
  // ---- acid: one pipe row over the three refineries ----
  const acid = []; for (let x = 0; x <= 15; x++) acid.push(L.pipe(x, 0));
  // ---- the one belt (row 7): coal from the north and calcite from the south side-load onto its first tile, one lane each ----
  const coalEntrance = L.belt(0, 6, E), coalFeeder = L.belt(1, 6, S), calciteEntrance = L.belt(0, 8, E), calciteFeeder = L.belt(1, 8, N);
  const belt = []; for (let x = 1; x <= 20; x++) belt.push(L.belt(x, 7, E));
  const beltIds = belt.map(b => b.entity_number);
  // ---- refinery arms and heavy-oil outputs (pipe-to-ground under the belt) ----
  refineries.forEach((r, i) => {
    const cx = [4, 9, 14][i];
    for (const x of [cx - 1, cx, cx + 1]) { const a = L.fast(x, 6, S); routes.push({ inserter: a.entity_number, label: `belt -> refinery ${i + 1} (arm at ${x},6)`, sourceBelts: beltIds, destEntity: r.entity_number }); }
    L.ptg(cx + 2, 6, N); L.ptg(cx + 2, 8, S); L.pipe(cx + 2, 9);
  });
  // ---- plastic plant: coal arm from the belt, plastic arm onto the exit belt ----
  const coalArm = L.fast(19, 6, S); routes.push({ inserter: coalArm.entity_number, label: 'belt -> plastic plant (coal)', sourceBelts: beltIds, destEntity: plastic.entity_number });
  const exit2 = L.belt(19, 0, N), exit1 = L.belt(19, 1, N);
  const plasticArm = L.fast(19, 2, S); routes.push({ inserter: plasticArm.entity_number, label: 'plastic plant -> exit belt (plastic bars)', sourceEntity: plastic.entity_number, destBelts: [exit1.entity_number] });
  // ---- heavy-oil row 9 east to column 27, up to the cracker (27,5) and the lubricant plant (27,6) and (27,8) ----
  for (let x = 7; x <= 27; x++) if (![11, 16].includes(x)) L.pipe(x, 9);
  for (let y = 5; y <= 8; y++) L.pipe(27, y);
  // ---- water: over the crackers to the light-oil cracker (24,1) and down to the cracker (27,3) ----
  const waterInlet = L.pipe(27, 0); for (const x of [24, 25, 26]) L.pipe(x, 0);
  L.pipe(24, 1); for (const y of [1, 2, 3]) L.pipe(27, y);
  // ---- lubricant exit ----
  const lubExit = L.pipe(31, 6);
  // ---- power: three substations; the entry one is at the north-east ----
  const subWest = L.add('substation', 4, 8), subMid = L.add('substation', 17, 1), subEast = L.add('substation', 29, 1);
  // ---- panels ----
  const figures = Object.fromEntries(Object.entries(z.perMinute).map(([k, v]) => [k, Math.round(v)]));
  const entries = [
    { id: 'IN-1', item: 'coal', kind: 'belt', side: 'west', entity: coalEntrance, perMinute: figures.coal, panelAt: [0, 5] },
    { id: 'IN-2', item: 'calcite', kind: 'belt', side: 'west', entity: calciteEntrance, perMinute: figures.calcite, panelAt: [0, 9] },
    { id: 'IN-3', item: 'sulfuric-acid', kind: 'pipe', side: 'west', entity: acid[0], perMinute: figures['sulfuric-acid'], panelAt: [1, 1], icon: 'fluid' },
    { id: 'IN-4', item: 'water', kind: 'pipe', side: 'north', entity: waterInlet, perMinute: figures.water, panelAt: [28, 1], icon: 'fluid' },
  ];
  const inputs = entries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `IN: ${en.item} ${en.perMinute}/min`, en.item, en.icon || 'item') }));
  const outEntries = [
    { id: 'OUT-1', item: 'plastic-bar', kind: 'belt', side: 'north', entity: exit2, perMinute: TARGETS['plastic-bar'], panelAt: [20, 1] },
    { id: 'OUT-2', item: 'lubricant', kind: 'pipe', side: 'east', entity: lubExit, perMinute: TARGETS.lubricant, panelAt: [31, 7], icon: 'fluid' },
  ];
  const outputs = outEntries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `OUT: ${en.item} ${en.perMinute}/min`, en.item, en.icon || 'item') }));
  const powerLabel = 'POWER: connect substation';
  const powerPanel = L.panel(31, 1, powerLabel, 'substation');
  const d = {
    id: ID, layout: L, label: 'Coal plastic and lubricant | 3 refineries | 60 plastic and 300 lubricant a minute',
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus. West: coal (row 6) and calcite (row 8) belts, sulfuric acid pipe (row 0); north: water pipe; connect power to the north-east substation. Plastic bars leave on a belt at the north edge, lubricant by pipe at the east edge. Simple coal liquefaction, no circuits. No modules or beacons. See the README for ports and the native test.`,
    icons: ['plastic-bar', 'lubricant', 'oil-refinery', 'coal'], roles, routes, inputs, outputs,
    power: { entry: subEast, panel: powerPanel, label: powerLabel, externalPole: { x: 34, y: 2 } },
    products: ['plastic-bar', 'lubricant'], recipes: ['simple-coal-liquefaction', 'heavy-oil-cracking', 'light-oil-cracking', 'plastic-bar', 'lubricant'],
    footprintIncludes: 'all entities, panels, substations, belts, pipes and underground pipes; external supply excluded',
    intendedUse: 'plastic bars on a belt and lubricant by pipe from coal, calcite, sulfuric acid and water, by simple coal liquefaction and oil cracking',
    targets: TARGETS,
    equipment: { machines: ['oil-refinery', 'chemical-plant'], inserter: 'fast-inserter', transport: 'fast-transport-belt', power: 'substation', modules: 0, beacons: 0, quality: 'normal' },
    sizing: { ...z, requiredCraftsPerMinute: z.requiredCraftsPerMinute, laneMerge: { tile: belt[0].entity_number, feeders: 2, length: belt.length } },
  };
  return assemble(d, p, slots, options);
}
