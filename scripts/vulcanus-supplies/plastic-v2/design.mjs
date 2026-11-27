// Layout of the plastic-v2 supply: plastic bars from crude oil barrels, water barrels and coal. A pure function of the pinned prototypes and the
// fluid-slot tables (family pins plus this member's own). Tiles (x east, y south), 10 x 18.
// Machines: 1 oil refinery (advanced oil processing), 1 heavy-oil cracker, 1 light-oil cracker, 1 plastic plant, 2 assembling machines 3 that
// empty barrels (one crude oil, one water). The machine placement and the pipe runs below (pipes and a few undergrounds) were found by a
// scratch search over the port tables (direct contacts, then pipe runs with undergrounds, validated with the audit's own fluid model); they are
// held here as data and checked by the static audit and the native run.
//
// The positions are written in "plan" tiles (the refinery's north-west corner is (0,0)) and shifted into the blueprint by (OX, OY).
//   row -7       coal belt (entrance on the west edge) to the coal arm over the plastic plant; plastic leaves on column 2 to the north edge
//   rows -5..4   plastic plant P (x 1..3), heavy cracker H (x -2..0), light cracker L (x -4..-2, rows 1..3), refinery R (x 0..4, rows 0..4)
//   rows 5..7    water assembler W (x -4..-2) and crude assembler C (x 2..4), the empty-barrel chest between them at (0,7)
//   rows 8..10   barrel arms on row 8, water barrels on row 9 (fast arm into W), crude barrels on row 10 (long arm into C), south substation (0,8)
import { Layout, N, E, S, W } from '../lib.mjs';
import { assemble } from '../package.mjs';
import { sizing } from './sizing.mjs';

export const ID = 'plastic-v2';
export const TARGETS = { 'plastic-bar': 115 };
export { sizing };
const OX = 5, OY = 7;
const up = v => Math.ceil(v * 10 - 1e-9) / 10;

// machines: [role, recipe, name, plan tile x, plan tile y, direction, mirrored]
const MACHINES = [
  ['refinery', 'advanced-oil-processing', 'oil-refinery', 0, 0, N, false],
  ['heavy-cracking', 'heavy-oil-cracking', 'chemical-plant', -2, -3, S, true],
  ['plastic', 'plastic-bar', 'chemical-plant', 1, -4, E, false],
  ['crude-barrels', 'empty-crude-oil-barrel', 'assembling-machine-3', 2, 5, S, false],
  ['light-cracking', 'light-oil-cracking', 'chemical-plant', -4, 1, N, true],
  ['water-barrels', 'empty-water-barrel', 'assembling-machine-3', -4, 5, W, false],
];
const PIPES = [[-1, 6], [-1, 5], [0, 5], [1, 5], [-2, 0], [-1, 0], [-4, 0], [-4, -1], [2, -1], [-2, -4], [-3, -4], [-4, -4], [4, -2], [4, -1], [-4, 4], [-5, 4], [-5, -5], [4, -5], [4, -4], [4, -3]];
// underground pipes [x, y, side of the open (normal) connection]
const PTG = [[-1, 4, S], [-1, 1, N], [1, -1, E], [-3, -1, W], [-4, -2, S], [-4, -3, N], [-5, -4, N], [-5, 3, S], [3, -5, E], [-4, -5, W]];

export function design(p, slots, options = {}) {
  const z = sizing(p, TARGETS['plastic-bar']);
  const L = new Layout(), roles = new Map(), routes = [];
  const T = (x, y) => [x + OX, y + OY];
  const byRole = {};
  for (const [role, recipe, name, x, y, dir, mirror] of MACHINES) {
    const s = name === 'oil-refinery' ? 5 : 3;
    const e = L.add(name, ...T(x, y), { recipe, direction: dir, ...(mirror ? { mirror: true } : {}) });
    roles.set(e.entity_number, role); byRole[role] = e;
    void s;
  }
  for (const [x, y] of PIPES) L.pipe(...T(x, y));
  for (const [x, y, side] of PTG) L.ptg(...T(x, y), side);
  // ---- coal: belt on row -7 from the west edge, turns south at x = 1 and ends above the coal arm (1,-5)
  const coalBelts = [];
  for (let x = -5; x <= 0; x++) coalBelts.push(L.belt(...T(x, -7), E));
  coalBelts.push(L.belt(...T(1, -7), S), L.belt(...T(1, -6), S));
  const coalEntrance = coalBelts[0];
  const coalArm = L.fast(...T(1, -5), N); routes.push({ inserter: coalArm.entity_number, label: 'coal belt -> plastic plant (coal)', sourceBelts: coalBelts.map(b => b.entity_number), destEntity: byRole.plastic.entity_number });
  // ---- plastic: arm (2,-5) onto the exit belt in column 2, out at the north edge
  const exitBelts = [L.belt(...T(2, -6), N), L.belt(...T(2, -7), N)];
  const exit = exitBelts[exitBelts.length - 1];
  const plasticArm = L.fast(...T(2, -5), S); routes.push({ inserter: plasticArm.entity_number, label: 'plastic plant -> exit belt (plastic bars)', sourceEntity: byRole.plastic.entity_number, destBelts: exitBelts.map(b => b.entity_number) });
  // ---- barrels: water on row 9 (to x = -3), crude on row 10 (to x = 3)
  const crudeBelts = [], waterBelts = [];
  for (let x = -5; x <= 3; x++) crudeBelts.push(L.belt(...T(x, 10), E));
  for (let x = -5; x <= -3; x++) waterBelts.push(L.belt(...T(x, 9), E));
  const crudeEntrance = crudeBelts[0], waterEntrance = waterBelts[0];
  const crudeArm = L.long(...T(3, 8), S); routes.push({ inserter: crudeArm.entity_number, label: 'crude barrel belt -> crude barrel assembler (long-handed, over the free tile (3,9))', sourceBelts: crudeBelts.map(b => b.entity_number), destEntity: byRole['crude-barrels'].entity_number });
  const waterArm = L.fast(...T(-3, 8), S); routes.push({ inserter: waterArm.entity_number, label: 'water barrel belt -> water barrel assembler', sourceBelts: waterBelts.map(b => b.entity_number), destEntity: byRole['water-barrels'].entity_number });
  // ---- empty barrels: both assemblers hand them to one passive provider chest in the gap between them
  const chest = L.add('passive-provider-chest', ...T(0, 7));
  const emptyWater = L.fast(...T(-1, 7), W); routes.push({ inserter: emptyWater.entity_number, label: 'water barrel assembler -> empty barrel chest', sourceEntity: byRole['water-barrels'].entity_number, destEntity: chest.entity_number });
  const emptyCrude = L.fast(...T(1, 7), E); routes.push({ inserter: emptyCrude.entity_number, label: 'crude barrel assembler -> empty barrel chest', sourceEntity: byRole['crude-barrels'].entity_number, destEntity: chest.entity_number });
  // ---- power: two substations (north: the entry; south: the barrel end)
  const subNorth = L.add('substation', ...T(-1, -5)), subSouth = L.add('substation', ...T(0, 8));
  // ---- panels
  const figures = { 'crude-oil-barrel': up(z.perMinute['crude-oil-barrel']), 'water-barrel': up(z.perMinute['water-barrel']), coal: Math.round(z.perMinute.coal) };
  const entries = [
    { id: 'IN-1', item: 'crude-oil-barrel', kind: 'belt', side: 'west', entity: crudeEntrance, perMinute: figures['crude-oil-barrel'], panelAt: T(-2, 9) },
    { id: 'IN-2', item: 'water-barrel', kind: 'belt', side: 'west', entity: waterEntrance, perMinute: figures['water-barrel'], panelAt: T(-5, 8) },
    { id: 'IN-3', item: 'coal', kind: 'belt', side: 'west', entity: coalEntrance, perMinute: figures.coal, panelAt: T(-5, -6) },
  ];
  const inputs = entries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `IN: ${en.item} ${en.perMinute}/min`, en.item) }));
  const outEntries = [{ id: 'OUT-1', item: 'plastic-bar', kind: 'belt', side: 'north', entity: exit, perMinute: TARGETS['plastic-bar'], panelAt: T(3, -6) }];
  const outputs = outEntries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `OUT: ${en.item} ${en.perMinute}/min`, en.item) }));
  const chestPanel = L.panel(...T(0, 6), `EMPTY BARRELS ${Math.round(z.emptyBarrelsPerMinute)}/min: collect from the chest below`, 'barrel');
  const powerLabel = 'POWER: connect substation';
  const powerPanel = L.panel(...T(-2, -5), powerLabel, 'substation');
  const d = {
    id: ID, layout: L, label: 'Plastic v2 | crude and water barrels, coal | 1 refinery, advanced oil processing | plastic bars only',
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus. West edge: crude oil barrels (row 9), water barrels (row 10) and coal (row -7), each on its own belt; plastic bars leave on one belt at the north edge (column 2); connect power to the labelled north substation. Barrels are emptied inside, advanced oil processing and cracking make the petroleum gas; the empty barrels collect in one passive provider chest (collect them). No circuits, modules or beacons. See the README for ports and the native test.`,
    icons: ['plastic-bar', 'crude-oil-barrel', 'oil-refinery', 'coal'], roles, routes, inputs, outputs,
    power: { entry: subNorth, panel: powerPanel, label: powerLabel, externalPole: { x: 8 + OX, y: -4 + OY } },
    products: ['plastic-bar'], recipes: MACHINES.map(m => m[1]).concat(['passive-provider-chest']),
    footprintIncludes: 'all entities, panels, substations, belts, pipes, underground pipes and the empty-barrel chest; external supply excluded',
    intendedUse: 'plastic bars on one belt exit and nothing else, from crude oil barrels, water barrels and coal on belts, by advanced oil processing and oil cracking',
    targets: TARGETS,
    equipment: { machines: ['oil-refinery', 'chemical-plant', 'assembling-machine-3'], inserter: 'fast-inserter', transport: 'fast-transport-belt', power: 'substation', modules: 0, beacons: 0, quality: 'normal' },
    fluidSafety: true,
    extra: {
      extraEntities: ['passive-provider-chest'],
      collectors: [{ id: 'BUF-1', item: 'barrel', kind: 'chest', entity: chest.entity_number, tile: { x: chest.tile.x, y: chest.tile.y }, panel: L.entities[L.entities.length - 2].entity_number, label: chestPanel.text, perMinute: Math.round(z.emptyBarrelsPerMinute * 10) / 10, capacityBarrels: 48 * p.items.barrel.stack_size }],
    },
    sizing: { ...z, requiredCraftsPerMinute: z.requiredCraftsPerMinute },
  };
  return assemble(d, p, slots, options);
}
