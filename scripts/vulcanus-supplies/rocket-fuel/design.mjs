// Layout of the rocket-fuel supply. A pure function of the pinned prototypes and the fluid-slot tables (family pins plus this member's own).
// Tiles (x east, y south), 34 x 10. Machines: 3 oil refineries (simple coal liquefaction), 2 heavy-oil crackers, 3 solid-fuel plants,
// 3 assembling machines 3 (rocket fuel). No circuit wire, no by-product: every fluid is used up inside.
// The west half (columns 0 to 17) is the refinery row of the coal-plastic-lubricant supply, tile for tile: same entrances, same belt.
//
//   row 0        sulfuric acid over the refineries (west entrance (0,0)); heavy oil and water over the crackers, water entrance (21,0)
//   rows 1..5    refineries R1 R2 R3 (cols 2..16, facing south)
//   rows 1..3    crackers H1 (cols 18..20, mirrored) and H2 (cols 22..24), solid-fuel plant S1 (cols 25..27), its arm (28,2), assembler A1 (cols 29..31)
//   row 4        the light-oil pipe (cols 18..30): crackers and S1/A1 above it, S2/A2 and S3/A3 below it
//   rows 5..7    solid-fuel plant S2 (cols 18..20), arm (21,6), assembler A2 (cols 22..24), solid-fuel plant S3 (cols 25..27), arm (28,6), assembler A3 (cols 29..31)
//   row 6        refinery arms (three each) and heavy-oil pipes-to-ground
//   row 7        the one belt: coal on one lane, calcite on the other (entrances (0,6) coal and (0,8) calcite side-load onto (1,7))
//   rows 8..9    heavy-oil pipes-to-ground out, heavy-oil row 9 east to column 17, then under the ground up column 17 to row 0
//   row 9, col 33  rocket-fuel belt: row 9 east from (23,9), column 33 south from (33,2), exit (33,9) on the east edge
import { Layout, N, E, S, W } from '../lib.mjs';
import { assemble } from '../package.mjs';

export const ID = 'rocket-fuel';
export const TARGETS = { 'rocket-fuel': 12 };

// Recipe arithmetic behind the machine counts and the panel figures, from the pinned recipes.
export function sizing(p) {
  const r = n => p.recipes[n];
  const amt = (rec, name) => [...rec.ingredients, ...rec.results].find(v => v.name === name).amount;
  const t = rec => rec.energy_required ?? 0.5;
  const rocket = r('rocket-fuel'), solid = r('solid-fuel-from-light-oil'), hc = r('heavy-oil-cracking'), coal = r('simple-coal-liquefaction');
  const speed = n => p.entities[n].crafting_speed;
  const rocketCrafts = TARGETS['rocket-fuel'] / amt(rocket, 'rocket-fuel');
  const solidFuel = rocketCrafts * amt(rocket, 'solid-fuel'), solidCrafts = solidFuel / amt(solid, 'solid-fuel');
  const lightForSolid = solidCrafts * amt(solid, 'light-oil'), lightForRocket = rocketCrafts * amt(rocket, 'light-oil'), light = lightForSolid + lightForRocket;
  const crackCrafts = light / amt(hc, 'light-oil'), heavy = crackCrafts * amt(hc, 'heavy-oil'), liqCrafts = heavy / amt(coal, 'heavy-oil');
  const perCraft = { coal: amt(coal, 'coal'), calcite: amt(coal, 'calcite'), 'sulfuric-acid': amt(coal, 'sulfuric-acid') };
  const tidy = v => Math.round(v * 1e6) / 1e6;
  const perMinute = { coal: tidy(liqCrafts * perCraft.coal), calcite: tidy(liqCrafts * perCraft.calcite), 'sulfuric-acid': tidy(liqCrafts * perCraft['sulfuric-acid']), water: tidy(crackCrafts * amt(hc, 'water')) };
  const requiredCraftsPerMinute = { 'simple-coal-liquefaction': liqCrafts, 'heavy-oil-cracking': crackCrafts, 'solid-fuel-from-light-oil': solidCrafts, 'rocket-fuel': rocketCrafts };
  // crafts a minute one machine can do, and the whole machines the arithmetic asks for
  const each = { 'simple-coal-liquefaction': 60 * speed('oil-refinery') / t(coal), 'heavy-oil-cracking': 60 * speed('chemical-plant') / t(hc), 'solid-fuel-from-light-oil': 60 * speed('chemical-plant') / t(solid), 'rocket-fuel': 60 * speed('assembling-machine-3') / t(rocket) };
  const machinesNeeded = Object.fromEntries(Object.entries(requiredCraftsPerMinute).map(([k, v]) => [k, Math.ceil(v / each[k] - 1e-9)]));
  const per = v => v / TARGETS['rocket-fuel'];
  const cost = { coalPerRocketFuel: per(perMinute.coal), calcitePerRocketFuel: per(perMinute.calcite), acidPerRocketFuel: per(perMinute['sulfuric-acid']), waterPerRocketFuel: per(perMinute.water) };
  return { targets: TARGETS, requiredCraftsPerMinute, craftsPerMinuteEach: each, machinesNeeded, perMinute, cost, lightOilPerMinute: { forSolidFuel: lightForSolid, forRocketFuel: lightForRocket, total: light }, heavyOilPerMinute: heavy, solidFuelPerMinute: solidFuel,
    // a rocket: the silo's part count times the rocket fuel in one rocket part (pinned from the game dump)
    rocket: { rocketFuelEach: p.facts.rocket.rocketPartsRequired * p.facts.rocket.rocketFuelPerPart, minutesEach: p.facts.rocket.rocketPartsRequired * p.facts.rocket.rocketFuelPerPart / TARGETS['rocket-fuel'] } };
}

export function design(p, slots, options = {}) {
  const z = sizing(p);
  const L = new Layout(), roles = new Map(), routes = [];
  const machine = (name, cx, cy, extra, role) => { const e = L.machine(name, cx, cy, extra); roles.set(e.entity_number, role); return e; };
  const refineries = [4, 9, 14].map((cx, i) => machine('oil-refinery', cx, 3, { recipe: 'simple-coal-liquefaction', direction: S }, `liquefaction-${i + 1}`));
  // The two crackers take water on the tiles next to the gap between them (one water run) and heavy oil on their outer tiles: H1 is mirrored.
  const crackers = [machine('chemical-plant', 19, 2, { recipe: 'heavy-oil-cracking', direction: N, mirror: true }, 'heavy-cracking-1'), machine('chemical-plant', 23, 2, { recipe: 'heavy-oil-cracking', direction: N }, 'heavy-cracking-2')];
  // Three pairs: a solid-fuel plant hands its solid fuel straight to its own assembler. The pair above the light-oil pipe faces south, the two below north.
  const pairs = [{ sx: 26, ax: 30, cy: 2, dir: S, n: 1 }, { sx: 19, ax: 23, cy: 6, dir: N, n: 2 }, { sx: 26, ax: 30, cy: 6, dir: N, n: 3 }].map(v => ({
    ...v, solid: machine('chemical-plant', v.sx, v.cy, { recipe: 'solid-fuel-from-light-oil', direction: v.dir }, `solid-fuel-${v.n}`), rocket: machine('assembling-machine-3', v.ax, v.cy, { recipe: 'rocket-fuel', direction: v.dir }, `rocket-fuel-${v.n}`) }));
  // ---- acid: one pipe row over the three refineries ----
  const acid = []; for (let x = 0; x <= 15; x++) acid.push(L.pipe(x, 0));
  // ---- the one belt (row 7): coal from the north and calcite from the south side-load onto its first tile, one lane each ----
  const coalEntrance = L.belt(0, 6, E), coalFeeder = L.belt(1, 6, S), calciteEntrance = L.belt(0, 8, E), calciteFeeder = L.belt(1, 8, N);
  const belt = []; for (let x = 1; x <= 15; x++) belt.push(L.belt(x, 7, E));
  const beltIds = belt.map(b => b.entity_number);
  // ---- refinery arms and heavy-oil outputs (pipe-to-ground under the belt) ----
  refineries.forEach((r, i) => {
    const cx = [4, 9, 14][i];
    for (const x of [cx - 1, cx, cx + 1]) { const a = L.fast(x, 6, S); routes.push({ inserter: a.entity_number, label: `belt -> refinery ${i + 1} (arm at ${x},6)`, sourceBelts: beltIds, destEntity: r.entity_number }); }
    L.ptg(cx + 2, 6, N); L.ptg(cx + 2, 8, S); L.pipe(cx + 2, 9);
  });
  // ---- heavy oil: row 9 east to column 17, under the ground up column 17 (rows 8 to 1), row 0 to H1 (18,0); under the water pipes to H2 (24,0) ----
  for (let x = 7; x <= 17; x++) if (![11, 16].includes(x)) L.pipe(x, 9);
  L.ptg(17, 8, S); L.ptg(17, 1, N); L.pipe(17, 0); L.pipe(18, 0);
  L.ptg(19, 0, W); L.ptg(23, 0, E); L.pipe(24, 0);
  // ---- water: three pipes on row 0 between the crackers; the middle one is the entrance ----
  L.pipe(20, 0); const waterInlet = L.pipe(21, 0); L.pipe(22, 0);
  // ---- light oil: one pipe row between the upper and the lower machines ----
  for (let x = 18; x <= 30; x++) L.pipe(x, 4);
  // ---- solid fuel: one arm from each plant into its assembler ----
  for (const v of pairs) { const a = L.fast(v.sx + 2, v.cy, W); routes.push({ inserter: a.entity_number, label: `solid-fuel plant ${v.n} -> assembler ${v.n} (solid fuel)`, sourceEntity: v.solid.entity_number, destEntity: v.rocket.entity_number }); }
  // ---- rocket fuel: row 9 east from (23,9) and column 33 south from (33,2), which side-loads onto the exit tile (33,9) ----
  const exitRow = []; for (let x = 23; x <= 32; x++) exitRow.push(L.belt(x, 9, E));
  const exit = L.belt(33, 9, E);
  const exitColumn = []; for (let y = 2; y <= 8; y++) exitColumn.push(L.belt(33, y, S));
  const out1 = L.fast(32, 2, W); routes.push({ inserter: out1.entity_number, label: 'assembler 1 -> exit belt (rocket fuel)', sourceEntity: pairs[0].rocket.entity_number, destBelts: [exitColumn[0].entity_number] });
  const out2 = L.fast(23, 8, N); routes.push({ inserter: out2.entity_number, label: 'assembler 2 -> exit belt (rocket fuel)', sourceEntity: pairs[1].rocket.entity_number, destBelts: [exitRow[0].entity_number] });
  const out3 = L.fast(30, 8, N); routes.push({ inserter: out3.entity_number, label: 'assembler 3 -> exit belt (rocket fuel)', sourceEntity: pairs[2].rocket.entity_number, destBelts: [exitRow[7].entity_number] });
  // ---- power: three substations; the entry one is at the north-east ----
  const subWest = L.add('substation', 4, 8), subMid = L.add('substation', 18, 8), subEast = L.add('substation', 32, 0);
  // ---- panels ----
  // Coal, acid and water are whole numbers from the recipes; calcite (70.4) is rounded up so the panel never asks for less than is used.
  const figures = Object.fromEntries(Object.entries(z.perMinute).map(([k, v]) => [k, Math.ceil(v - 1e-9)]));
  const entries = [
    { id: 'IN-1', item: 'coal', kind: 'belt', side: 'west', entity: coalEntrance, perMinute: figures.coal, panelAt: [0, 5] },
    { id: 'IN-2', item: 'calcite', kind: 'belt', side: 'west', entity: calciteEntrance, perMinute: figures.calcite, panelAt: [0, 9] },
    { id: 'IN-3', item: 'sulfuric-acid', kind: 'pipe', side: 'west', entity: acid[0], perMinute: figures['sulfuric-acid'], panelAt: [1, 1], icon: 'fluid' },
    { id: 'IN-4', item: 'water', kind: 'pipe', side: 'north', entity: waterInlet, perMinute: figures.water, panelAt: [21, 1], icon: 'fluid' },
  ];
  const inputs = entries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `IN: ${en.item} ${en.perMinute}/min`, en.item, en.icon || 'item') }));
  const outEntries = [{ id: 'OUT-1', item: 'rocket-fuel', kind: 'belt', side: 'east', entity: exit, perMinute: TARGETS['rocket-fuel'], panelAt: [32, 8] }];
  const outputs = outEntries.map(en => ({ ...en, panel: L.panel(en.panelAt[0], en.panelAt[1], `OUT: ${en.item} ${en.perMinute}/min`, en.item, en.icon || 'item') }));
  const powerLabel = 'POWER: connect substation';
  const powerPanel = L.panel(32, 3, powerLabel, 'substation');
  const d = {
    id: ID, layout: L, label: 'Coal rocket fuel | 3 refineries | 12 rocket fuel a minute',
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus. West: coal (row 6) and calcite (row 8) belts, sulfuric acid pipe (row 0); north: water pipe; connect power to the north-east substation. Rocket fuel leaves on a belt at the east edge. Simple coal liquefaction, heavy oil cracking, solid fuel, rocket fuel; no circuits, no modules or beacons. See the README for ports and the native test.`,
    icons: ['rocket-fuel', 'solid-fuel', 'oil-refinery', 'coal'], roles, routes, inputs, outputs,
    power: { entry: subEast, panel: powerPanel, label: powerLabel, externalPole: { x: 36, y: 1 } },
    products: ['rocket-fuel'], recipes: ['simple-coal-liquefaction', 'heavy-oil-cracking', 'solid-fuel-from-light-oil', 'rocket-fuel'],
    footprintIncludes: 'all entities, panels, substations, belts, pipes and underground pipes; external supply excluded',
    intendedUse: 'rocket fuel on a belt from coal, calcite, sulfuric acid and water, by simple coal liquefaction, heavy oil cracking and solid fuel from light oil',
    targets: TARGETS,
    equipment: { machines: ['oil-refinery', 'chemical-plant', 'assembling-machine-3'], inserter: 'fast-inserter', transport: 'fast-transport-belt', power: 'substation', modules: 0, beacons: 0, quality: 'normal' },
    fluidSafety: true,
    sizing: { ...z, laneMerge: { tile: belt[0].entity_number, feeders: 2, length: belt.length } },
    // the exit belt: every tile that carries rocket fuel, and the one side-load onto the exit tile
    extra: { exitBelt: { row: exitRow.map(b => b.entity_number), column: exitColumn.map(b => b.entity_number), exit: exit.entity_number } },
  };
  return assemble(d, p, slots, options);
}
