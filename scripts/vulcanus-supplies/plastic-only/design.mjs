// Layout of the plastic-only supply: plastic bars and nothing else. A pure function of the pinned prototypes and the fluid-slot tables
// (family pins plus this member's own unused-port table). Tiles (x east, y south), 6 x 5. One chemical plant, one inserter in, one out.
// The inputs are the two the plastic recipe itself takes, coal and petroleum gas. No lubricant, no light or heavy oil, no acid, no water,
// no calcite, no refinery: the gas comes from outside (the README says what making it on site would cost).
//
//   rows 0..1    substation (cols 4..5, the power entry); the plastic plant's two unused ports (0,0) and (2,0) face nothing
//   rows 1..3    plastic plant P (cols 0..2, facing south); coal panel (3,1); coal arm (3,2) from the coal belt (4,2)..(5,2); plastic arm (3,3) onto the exit belt (4,3)..(5,3)
//   row 4        petroleum gas pipe (0,4) (west entrance) onto the plant's input tile; gas panel (1,4); plastic panel (3,4); power panel (4,4)
import { Layout, N, E, S, W } from '../lib.mjs';
import { assemble } from '../package.mjs';

export const ID = 'plastic-only';
export const TARGETS = { 'plastic-bar': 60 };

// Recipe arithmetic behind the machine count and the panel figures, from the pinned recipes.
export function sizing(p) {
  const r = n => p.recipes[n];
  const amt = (rec, name) => [...rec.ingredients, ...rec.results].find(v => v.name === name).amount;
  const t = rec => rec.energy_required ?? 0.5;
  const speed = p.entities['chemical-plant'].crafting_speed;
  const plastic = r('plastic-bar');
  const crafts = TARGETS['plastic-bar'] / amt(plastic, 'plastic-bar');
  const perMinute = { coal: crafts * amt(plastic, 'coal'), 'petroleum-gas': crafts * amt(plastic, 'petroleum-gas') };
  const eachCraftsPerMinute = 60 * speed / t(plastic);
  // What the gas would cost if it were made here instead (arithmetic only, not built): the coal-to-plastic chemistry of the
  // coal-plastic-lubricant supply with the lubricant branch left out.
  const hc = r('heavy-oil-cracking'), lc = r('light-oil-cracking'), liq = r('simple-coal-liquefaction');
  const lightCrafts = perMinute['petroleum-gas'] / amt(lc, 'petroleum-gas'), crackCrafts = lightCrafts * amt(lc, 'light-oil') / amt(hc, 'light-oil'), heavy = crackCrafts * amt(hc, 'heavy-oil'), liqCrafts = heavy / amt(liq, 'heavy-oil');
  const onSite = {
    craftsPerMinute: { 'simple-coal-liquefaction': liqCrafts, 'heavy-oil-cracking': crackCrafts, 'light-oil-cracking': lightCrafts },
    machines: { 'oil-refinery': Math.ceil(liqCrafts / (60 * p.entities['oil-refinery'].crafting_speed / t(liq)) - 1e-9), 'heavy-oil-cracking': Math.ceil(crackCrafts / (60 * speed / t(hc)) - 1e-9), 'light-oil-cracking': Math.ceil(lightCrafts / (60 * speed / t(lc)) - 1e-9) },
    perMinute: { coal: liqCrafts * amt(liq, 'coal') + perMinute.coal, calcite: liqCrafts * amt(liq, 'calcite'), 'sulfuric-acid': liqCrafts * amt(liq, 'sulfuric-acid'), water: crackCrafts * amt(hc, 'water') + lightCrafts * amt(lc, 'water') },
  };
  return { targets: TARGETS, requiredCraftsPerMinute: { 'plastic-bar': crafts }, craftsPerMinuteEach: { 'plastic-bar': eachCraftsPerMinute }, machinesNeeded: { 'plastic-bar': Math.ceil(crafts / eachCraftsPerMinute - 1e-9) }, perMinute, maxPlasticPerMinute: eachCraftsPerMinute * amt(plastic, 'plastic-bar'), onSite };
}

export function design(p, slots, options = {}) {
  const z = sizing(p);
  const L = new Layout(), roles = new Map(), routes = [];
  const plant = L.machine('chemical-plant', 1, 2, { recipe: 'plastic-bar', direction: S }); roles.set(plant.entity_number, 'plastic');
  // ---- gas: one pipe on the plant's input tile (the box has two tiles, one pipe is enough) ----
  const gas = L.pipe(0, 4);
  // ---- coal: belt in from the east edge, ends in front of the arm ----
  const coalEntrance = L.belt(5, 2, W), coalEnd = L.belt(4, 2, W);
  const coalArm = L.fast(3, 2, E); routes.push({ inserter: coalArm.entity_number, label: 'coal belt -> plastic plant (coal)', sourceBelts: [coalEnd.entity_number], destEntity: plant.entity_number });
  // ---- plastic: arm onto a two-tile exit belt to the east edge ----
  const exitBelt = L.belt(4, 3, E), exit = L.belt(5, 3, E);
  const plasticArm = L.fast(3, 3, W); routes.push({ inserter: plasticArm.entity_number, label: 'plastic plant -> exit belt (plastic bars)', sourceEntity: plant.entity_number, destBelts: [exitBelt.entity_number] });
  // ---- power: one substation, the entry ----
  const sub = L.add('substation', 4, 0);
  // ---- panels ----
  const figures = { coal: Math.round(z.perMinute.coal), 'petroleum-gas': Math.round(z.perMinute['petroleum-gas']) };
  const entries = [
    { id: 'IN-1', item: 'coal', kind: 'belt', side: 'east', entity: coalEntrance, perMinute: figures.coal, panelAt: [3, 1] },
    { id: 'IN-2', item: 'petroleum-gas', kind: 'pipe', side: 'west', entity: gas, perMinute: figures['petroleum-gas'], panelAt: [1, 4], icon: 'fluid' },
  ];
  const inputs = entries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `IN: ${en.item} ${en.perMinute}/min`, en.item, en.icon || 'item') }));
  const outEntries = [{ id: 'OUT-1', item: 'plastic-bar', kind: 'belt', side: 'east', entity: exit, perMinute: TARGETS['plastic-bar'], panelAt: [3, 4] }];
  const outputs = outEntries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `OUT: ${en.item} ${en.perMinute}/min`, en.item) }));
  const powerLabel = 'POWER: connect substation';
  const powerPanel = L.panel(4, 4, powerLabel, 'substation');
  const d = {
    id: ID, layout: L, label: 'Plastic only | 1 chemical plant | 60 plastic bars a minute from coal and petroleum gas',
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus. East: coal belt (row 2) in, plastic bars on one belt out (row 3); west: petroleum gas pipe (row 4); connect power to the substation. Plastic bars are the only product and the only thing that comes out. No circuits, modules or beacons. See the README for ports and the native test.`,
    icons: ['plastic-bar', 'coal', 'chemical-plant', 'substation'], roles, routes, inputs, outputs,
    power: { entry: sub, panel: powerPanel, label: powerLabel, externalPole: { x: 9, y: 1 } },
    products: ['plastic-bar'], recipes: ['plastic-bar'],
    footprintIncludes: 'all entities, panels, substation, belts and the gas pipe; external supply excluded',
    intendedUse: 'plastic bars on one belt exit and nothing else, from coal on a belt and petroleum gas by pipe',
    targets: TARGETS,
    equipment: { machines: ['chemical-plant'], inserter: 'fast-inserter', transport: 'fast-transport-belt', power: 'substation', modules: 0, beacons: 0, quality: 'normal' },
    fluidSafety: true,
    sizing: z,
  };
  return assemble(d, p, slots, options);
}
