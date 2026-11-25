// Layout of the tungsten-carbide supply: one carbon plant and one assembling machine 3 on a single belt of ore (one lane) and coal
// (the other lane), sulfuric acid by pipe, tungsten carbide on one belt exit. A pure function of the pinned prototypes.
//
// Tiles (x east, y south), 12 x 7:
//   row 0       acid pipe over both machines (west entrance at (0,0))
//   rows 1..3   carbon plant C (cols 3..5), carbon arm (6,2), assembling machine 3 A (cols 7..9), exit arm (10,2), exit belt (11,2)
//   row 4       coal arms (3,4) (4,4), ore arms (7,4) (8,4); coal feeder belt (1,4)
//   row 5       the one belt, east; row 6: ore feeder belt (1,6); entrances (0,4) coal and (0,6) tungsten ore
import assert from 'node:assert/strict';
import { Layout, N, E, S, W, analyzeFluids } from '../lib.mjs';
import { assemble } from '../package.mjs';

export const ID = 'tungsten-carbide';
// Per-minute targets and the recipe arithmetic behind the panel figures.
export function sizing(p) {
  const tc = p.recipes['tungsten-carbide'], carbon = p.recipes.carbon;
  const amount = (r, name) => [...r.ingredients, ...r.results].find(v => v.name === name).amount;
  const time = r => r.energy_required ?? 0.5;
  const carbonCraftsPerMinute = 60 / time(carbon) * p.entities['chemical-plant'].crafting_speed;   // the carbon plant is the limit
  const tcCraftsPerMinute = 60 / time(tc) * p.entities['assembling-machine-3'].crafting_speed;       // what the assembler could do
  const target = Math.floor(Math.min(carbonCraftsPerMinute * amount(carbon, 'carbon') / amount(tc, 'carbon'), tcCraftsPerMinute));
  return {
    carbonCraftsPerMinute, tcCraftsPerMinute, targetPerMinute: target,
    perMinute: {
      'tungsten-ore': target * amount(tc, 'tungsten-ore'),
      coal: target * amount(tc, 'carbon') / amount(carbon, 'carbon') * amount(carbon, 'coal'),
      'sulfuric-acid': target * amount(tc, 'sulfuric-acid') + target * amount(tc, 'carbon') / amount(carbon, 'carbon') * amount(carbon, 'sulfuric-acid'),
    },
  };
}

export function design(p, slots, options = {}) {
  const z = sizing(p);
  const L = new Layout(), roles = new Map(), routes = [];
  const carbon = L.machine('chemical-plant', 4, 2, { recipe: 'carbon', direction: N }); roles.set(carbon.entity_number, 'carbon');
  const am3 = L.machine('assembling-machine-3', 8, 2, { recipe: 'tungsten-carbide', direction: N }); roles.set(am3.entity_number, 'tungsten-carbide');
  // Acid: one pipe row over both machines; the carbon plant's two input tiles and the assembler's one input tile are on it.
  const acidPipes = []; for (let x = 0; x <= 8; x++) acidPipes.push(L.pipe(x, 0));
  const arm = (x, y, pickup, from, to, label) => { const a = L.fast(x, y, pickup); routes.push({ inserter: a.entity_number, label, ...from, ...to }); return a; };
  // Belt: coal arrives from the north and ore from the south onto the first tile of one east-going belt, one lane each.
  const coalEntrance = L.belt(0, 4, E), coalFeeder = L.belt(1, 4, S);
  const oreEntrance = L.belt(0, 6, E), oreFeeder = L.belt(1, 6, N);
  const belt = [L.belt(1, 5, E)]; for (let x = 2; x <= 8; x++) belt.push(L.belt(x, 5, E));
  const beltIds = belt.map(b => b.entity_number);
  const coalArms = [3, 4].map(x => arm(x, 4, S, { sourceBelts: beltIds }, { destEntity: carbon.entity_number }, `coal belt -> carbon plant (arm at ${x},4)`));
  const oreArms = [7, 8].map(x => arm(x, 4, S, { sourceBelts: beltIds }, { destEntity: am3.entity_number }, `tungsten ore belt -> assembler (arm at ${x},4)`));
  const carbonArm = arm(6, 2, W, { sourceEntity: carbon.entity_number }, { destEntity: am3.entity_number }, 'carbon plant -> assembler (carbon)');
  const exitBelt = L.belt(11, 2, E);
  const exitArm = arm(10, 2, W, { sourceEntity: am3.entity_number }, { destBelts: [exitBelt.entity_number] }, 'assembler -> exit belt (tungsten carbide)');
  const sub = L.add('substation', 10, 4);
  const entries = [
    { id: 'IN-1', item: 'coal', kind: 'belt', side: 'west', entity: coalEntrance, perMinute: Math.round(z.perMinute.coal), text: 'IN: coal', panelAt: [2, 4] },
    { id: 'IN-2', item: 'tungsten-ore', kind: 'belt', side: 'west', entity: oreEntrance, perMinute: Math.round(z.perMinute['tungsten-ore']), text: 'IN: tungsten-ore', panelAt: [2, 6] },
    { id: 'IN-3', item: 'sulfuric-acid', kind: 'pipe', side: 'west', entity: acidPipes[0], perMinute: Math.round(z.perMinute['sulfuric-acid']), text: 'IN: sulfuric-acid', panelAt: [1, 1], icon: 'fluid' },
  ];
  const inputs = entries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `${en.text} ${en.perMinute}/min`, en.item, en.icon || 'item') }));
  const out = { id: 'OUT-1', item: 'tungsten-carbide', kind: 'belt', side: 'east', entity: exitBelt, perMinute: z.targetPerMinute };
  const outputs = [{ ...out, panel: L.panel(11, 1, `OUT: tungsten-carbide ${out.perMinute}/min`, 'tungsten-carbide') }];
  const powerLabel = 'POWER: connect substation';
  const powerPanel = L.panel(10, 6, powerLabel, 'substation');
  // The outside substation stands three tiles east of the entry substation, inside its wire reach.
  const d = {
    id: ID, layout: L, label: 'Tungsten carbide supply | AM3 | 60 a minute from ore, coal and acid',
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus. West: tungsten ore (row 6) and coal (row 4) belts, sulfuric acid pipe (row 0); connect power to the substation. East: tungsten carbide on one belt exit. Carbon is made inside. No modules or beacons. See the README for ports and the native test.`,
    icons: ['tungsten-carbide', 'carbon', 'assembling-machine-3', 'substation'], roles, routes, inputs, outputs,
    power: { entry: sub, panel: powerPanel, label: powerLabel, externalPole: { x: 15, y: 5 } },
    products: ['tungsten-carbide'], recipes: ['carbon', 'tungsten-carbide'], footprintIncludes: 'all entities, panels, substation, belts and the acid pipe; external supply excluded',
    intendedUse: 'tungsten carbide on a belt from tungsten ore, coal and sulfuric acid; carbon is made inside',
    targets: { 'tungsten-carbide': z.targetPerMinute },
    equipment: { machines: ['chemical-plant', 'assembling-machine-3'], inserter: 'fast-inserter', transport: 'fast-transport-belt', power: 'substation', modules: 0, beacons: 0, quality: 'normal' },
    sizing: { ...z, requiredCraftsPerMinute: { carbon: z.targetPerMinute, 'tungsten-carbide': z.targetPerMinute }, laneMerge: { tile: belt[0].entity_number, feeders: 2, length: belt.length } },
  };
  return assemble(d, p, slots, options);
}
