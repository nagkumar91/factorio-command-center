// Design of the Vulcanus science blueprint: production and utility science packs, 60 a minute each, from lava and calcite.
// Pure function of the pinned prototypes: design(p, slots, options) -> blueprint, manifest, ports, footprint.
//
// Plan (x east, y south). Two molten trunks run down the west edge (iron x = 0, copper x = 2); every band takes its metal from
// them at its west end ("head": foundries above and below one belt, each side loading its own lane) and does its assembling
// east of the head ("body"). Belts between bands run in the bus east of the bodies.
//   S  lava foundries: molten iron and copper, stone, calcite
//   P  production science: steel and stick head, rail machines handing rails straight to the pack machines
//   F  electric furnaces (the item): steel head with the brick furnaces under it, and the productivity modules
//   R  advanced circuits: cable head, two rows
//   G  electronic circuits: plate head, cable foundries handing cable straight to the circuit machines
//   U  processing units, Y utility science with frames, engines, batteries and low density structures
import assert from 'node:assert/strict';
import { N, E, S, W, VEC, opposite, sha, encodeKeeping, technologyClosure, blueprintVersion } from './lib.mjs';
import { Layout, sizeOf } from './layout.mjs';
import { bill } from './bill.mjs';

export const TARGET = 60;                       // packs per minute, each
export const HAND = { 'fast-inserter': 1, 'bulk-inserter': 2, 'long-handed-inserter': 1 };

export function build(p, options = {}) {
  const L = new Layout(p);
  const F = (recipe, x, y, d, role, on = L) => on.machine('foundry', x, y, recipe, d, { role: role || recipe });
  const A = (recipe, x, y, d = N, role, on = L) => on.machine('assembling-machine-3', x, y, recipe, d, { role: role || recipe });
  const arm = (kind, x, y, from, what, extra, on = L) => on.arm(kind, x, y, from, { what }, extra);
  const only = name => ({ use_filters: true, filter_mode: 'whitelist', filters: [{ index: 1, name, quality: 'normal', comparator: '=' }] });
  const X = { iron: 0, copper: 2, west: 4, tap: 5 };
  const R = {};   // named rows and columns, for the routes and the manifest

  // =============================================================================================== S: lava foundries
  // Row 0 lava main; rows 1-5 foundries (lava ports north, molten ports south); row 6 stone arms, the calcite arm and the molten
  // pipe-to-ground; row 7 stone belt; row 8 calcite belt; rows 9/11 the molten risers surface; row 10 iron main, row 12 copper main.
  const SX = 6, IRON_LAVA = 5, COPPER_LAVA = 4, SXE = SX + 5 * (IRON_LAVA + COPPER_LAVA) - 1, ironEnd = SX + 5 * IRON_LAVA - 1;
  for (let c = 0; c < IRON_LAVA + COPPER_LAVA; c++) {
    const x = SX + 5 * c, iron = c < IRON_LAVA, fluid = iron ? 'molten-iron' : 'molten-copper';
    F(iron ? 'molten-iron-from-lava' : 'molten-copper-from-lava', x, 1, S);
    arm('bulk', x, 6, N, 'stone'); arm('bulk', x + 4, 6, N, 'stone');
    arm('long', x + 2, 6, S, 'calcite');
    L.ptg(fluid, x + 1, 6, N); L.ptg(fluid, x + 1, iron ? 9 : 11, S);
  }
  // ---- the two trunks, then the belts that pipes have to dive under
  const IRON_TRUNK_END = 87, COPPER_TRUNK_END = 70, WEST = -2;
  L.pipePath('molten-iron', [[X.iron, 10], [X.iron, IRON_TRUNK_END]], { note: 'iron trunk' });
  L.pipePath('molten-copper', [[X.copper, 12], [X.copper, COPPER_TRUNK_END]], { note: 'copper trunk' });
  const STONE_ROW = 43, PXW = 24, STONE_DOWN = 59;
  // stone of the copper group: east, down, west through the rail machines, down, west under the brick furnaces and out
  R.stoneC = L.beltPath('express', [[ironEnd + 1, 7], [STONE_DOWN, 7], [STONE_DOWN, 27], [PXW, 27], [PXW, STONE_ROW], [WEST, STONE_ROW]], { note: 'stone' });
  // stone of the iron group: west, down, east along row 9, under that column and onto its east lane, so that the rail machines
  // and the brick furnaces draw on the stone of both groups
  R.stoneI = L.beltPath('express', [[ironEnd, 7], [X.west, 7], [X.west, 9], [STONE_DOWN + 2, 9], [STONE_DOWN + 2, 8], [STONE_DOWN, 8]], { note: 'stone', into: true });
  R.calcite = L.beltPath('fast', [[WEST, 8], [SXE, 8]], { note: 'calcite' });
  // plastic that the first advanced-circuit row leaves over: west along row 52, down the west side to the low density structures
  const FB = 37, EY = 70, RB = 60;               // EY: first row of the south strip (its copper main); RB: the cable row
  R.plasticWest = L.beltPath('fast', [[59, RB - 8], [7, RB - 8], [7, RB - 4], [X.west, RB - 4], [X.west, EY + 28]], { end: E, note: 'plastic-bar' });
  // steel for the engine machines: from the first furnace-steel foundry down the west side to the engine row
  R.steelTap = L.beltPath('fast', [[6, FB], [X.tap, FB], [X.tap, EY + 9]], { end: E, note: 'steel-plate' });
  R.lava = L.pipePath('lava', [[WEST, 0], [SXE, 0]], { note: 'lava main' });
  // ---- molten mains: iron along row 10, copper along row 12, both on to the circuit band in the east
  const GXC = 79, GY = 1;                       // the circuit band: its plate belt runs down column 79 from row 1
  L.pipePath('molten-iron', [[X.iron, 10], [GXC - 7, 10]], { note: 'iron main' });
  L.pipePath('molten-copper', [[GXC - 9, 12], [X.copper, 12]], { note: 'copper main' });
  // A branch of a trunk to the east along one row. The iron branch starts with a pipe-to-ground beside the trunk and surfaces
  // east of the copper trunk and of whatever runs down the west side.
  const ironBranch = (y, x1) => { let out = 3; for (let x = 3; x <= 6; x++) if (!L.free(x, y)) out = x + 1; L.ptg('molten-iron', 1, y, W); L.ptg('molten-iron', out, y, E); return L.pipePath('molten-iron', [[out + 1, y], [x1, y]]); };
  const copperBranch = (y, x1) => L.pipePath('molten-copper', [[X.copper, y], [x1, y]]);

  // =============================================================================================== P: production science
  // Belt row 21 carries steel (south lane, three foundries above) and iron sticks (north lane, one foundry below). East of the
  // head three rail machines stand between two pack machines each and hand them the rails. Row 20 packs out, row 27 stone,
  // row 28 electric furnaces and productivity modules.
  const PB = 21, PX = 25, PXE = PX + 32;
  ironBranch(PB - 7, 19);
  for (let i = 0; i < 3; i++) { F('casting-steel', 6 + 5 * i, PB - 6, S, 'steel for rails'); arm('bulk', 8 + 5 * i, PB - 1, N, 'steel-plate'); }
  F('casting-iron-stick', 11, PB + 2, N); arm('bulk', 12, PB + 1, S, 'iron-stick'); arm('bulk', 14, PB + 1, S, 'iron-stick');
  ironBranch(PB + 7, 14);
  for (let k = 0; k < 3; k++) {
    const x0 = PX + 11 * k;
    for (const px of [x0, x0 + 8]) {
      A('production-science-pack', px, PB + 2);
      arm('long', px + 1, PB + 1, S, 'production-science-pack');
      arm('long', px + 1, PB + 5, S, 'electric-furnace + productivity-module');
    }
    A('rail', x0 + 4, PB + 2);
    arm('bulk', x0 + 4, PB + 1, N, 'steel-plate + iron-stick'); arm('bulk', x0 + 6, PB + 1, N, 'steel-plate + iron-stick');
    arm('bulk', x0 + 5, PB + 5, S, 'stone');
    arm('bulk', x0 + 3, PB + 3, E, 'rail'); arm('bulk', x0 + 7, PB + 3, W, 'rail');
  }
  L.beltPath('fast', [[6, PB], [PXE, PB]], { note: 'steel-plate + iron-stick' });

  // =============================================================================================== F: electric furnaces, modules
  // Belt row 37: steel (south lane, three foundries above) and stone bricks (north lane, six furnaces below). Two machines
  // make electric furnaces east of the head; four make productivity modules under them. Row 44 takes both products.
  const FXB = 27;
  ironBranch(FB - 7, 19);
  for (let i = 0; i < 3; i++) { F('casting-steel', 6 + 5 * i, FB - 6, S, 'steel for furnaces'); arm('bulk', 8 + 5 * i, FB - 1, N, 'steel-plate'); }
  arm('bulk', 6, FB - 1, N, 'steel-plate');           // the first foundry also feeds the steel belt to the engine machines
  for (let i = 0; i < 6; i++) { L.machine('electric-furnace', 6 + 3 * i, FB + 2, null, N, { role: 'stone-brick' }); arm('fast', 7 + 3 * i, FB + 1, S, 'stone-brick'); arm('fast', 7 + 3 * i, FB + 5, S, 'stone'); }
  for (let i = 0; i < 2; i++) {
    const x = FXB + 3 * i;
    A('electric-furnace', x, FB + 2);
    arm('bulk', x, FB + 1, N, 'steel-plate + stone-brick'); arm('bulk', x + 2, FB + 1, N, 'steel-plate + stone-brick');
    arm('fast', x, FB + 5, S, 'advanced-circuit'); arm('long', x + 2, FB + 5, N, 'electric-furnace');
  }
  // four module machines, the exact count: a fifth takes advanced circuits the furnace machines need for as long as it is
  // filling its belt (measured with five: production science at 56.4 a minute after a start without plastic)
  for (let i = 0; i < 4; i++) {
    const x = FXB + 3 * i;
    A('productivity-module', x, FB + 9);
    arm('fast', x + 1, FB + 8, S, 'productivity-module'); arm('fast', x, FB + 12, S, 'electronic-circuit'); arm('long', x + 2, FB + 12, S, 'advanced-circuit');
  }
  L.beltPath('fast', [[7, FB], [FXB + 5, FB]], { note: 'steel-plate + stone-brick' });
  L.beltPath('fast', [[FXB, FB + 7], [60, FB + 7], [60, 28], [PX + 1, 28]], { note: 'electric-furnace + productivity-module' });

  // =============================================================================================== R: advanced circuits
  // Row 60 carries cable on both lanes (one foundry above, one below). Twelve machines above it and twelve below (two gaps
  // of two tiles for substations) take cable
  // from it with long arms, circuits from their outer near belt (rows 53, 67), plastic from the far belt (rows 52, 68) and
  // put advanced circuits on rows 59 and 61.
  const RX = 23, RED_X = [0, 3, 6, 11, 14, 17, 20, 23, 28, 31, 34, 37].map(v => RX + v), RXE = RED_X.at(-1) + 2, RHX = 17;
  copperBranch(RB - 7, RHX + 3); copperBranch(RB + 7, RHX + 3);
  F('casting-copper-cable', RHX, RB - 6, S, 'cable for advanced circuits'); F('casting-copper-cable', RHX, RB + 2, N, 'cable for advanced circuits');
  for (const c of [0, 2, 4]) { arm('bulk', RHX + c, RB - 1, N, 'copper-cable'); arm('bulk', RHX + c, RB + 1, S, 'copper-cable'); }
  for (const x of RED_X) {
    A('advanced-circuit', x, RB - 5); A('advanced-circuit', x, RB + 3);
    arm('fast', x, RB - 6, N, 'electronic-circuit'); arm('long', x + 2, RB - 6, N, 'plastic-bar');
    arm('fast', x, RB - 2, N, 'advanced-circuit'); arm('long', x + 2, RB - 2, S, 'copper-cable');
    arm('fast', x, RB + 2, S, 'advanced-circuit'); arm('long', x + 2, RB + 2, N, 'copper-cable');
    arm('fast', x, RB + 6, S, 'electronic-circuit'); arm('long', x + 2, RB + 6, S, 'plastic-bar');
  }
  L.beltPath('fast', [[RHX, RB], [RXE, RB]], { note: 'copper-cable' });

  // =============================================================================================== G: electronic circuits
  // Turned a quarter: the plate belt runs south down column 79. North end: four plate foundries on each side of it. Then, on
  // each side: machine, cable foundry, machine, cable foundry, machine, twice. Each cable foundry hands cable to the machines
  // before and after it; the circuits leave on columns 73 and 85, going south.
  const G = L.quarter(GXC, GY);
  for (let i = 0; i < 4; i++) {
    const x = 5 * i;
    F('casting-iron', x, -6, S, 'plates for circuits', G); F('casting-iron', x, 2, N, 'plates for circuits', G);
    for (const c of [1, 3]) { arm('bulk', x + c, -1, N, 'iron-plate', undefined, G); arm('bulk', x + c, 1, S, 'iron-plate', undefined, G); }
  }
  const GBODY = 21, cableX = [];
  for (const gx of [GBODY, GBODY + 23]) for (const up of [true, false]) {
    const ay = up ? -4 : 2, fy = up ? -5 : 1, portRow = up ? -6 : 6, pick = up ? -1 : 1, out = up ? -5 : 5;
    for (const fx of [gx + 4, gx + 14]) { F('casting-copper-cable', fx, fy, up ? S : N, 'cable for circuits', G); G.pipe('molten-copper', fx + 1, portRow); if (up) cableX.push(fx + 1); }
    for (const ax of [gx, gx + 10, gx + 20]) {
      A('electronic-circuit', ax, ay, N, undefined, G);
      arm('bulk', ax + 1, pick, up ? S : N, 'iron-plate', undefined, G); arm('bulk', ax + 1, out, up ? S : N, 'electronic-circuit', undefined, G);
    }
    for (const [x, from] of [[gx + 3, E], [gx + 9, W], [gx + 13, E], [gx + 19, W]]) for (const dy of [0, 2]) arm('bulk', x, ay + dy, from, 'copper-cable', undefined, G);
  }
  const GLEN = GBODY + 45;
  G.beltPath('express', [[0, 0], [GLEN, 0]], { note: 'iron-plate' });
  for (const side of [-1, 1]) {
    G.pipePath('molten-iron', [[-1, 7 * side], [18, 7 * side]], { note: 'iron for plates' });
    G.pipePath('molten-copper', [[cableX[0], 7 * side], [cableX.at(-1), 7 * side]], { note: 'copper for cable' });
  }
  L.pipePath('molten-iron', [[GXC - 7, GY - 1], [GXC + 7, GY - 1]], { note: 'iron for plates' });
  L.pipePath('molten-copper', [[GXC - 9, 12], [GXC - 9, GY + cableX[0]], [GXC - 7, GY + cableX[0]]], { note: 'copper for cable' });
  L.pipePath('molten-copper', [[GXC - 9, GY + 20], [GXC + 9, GY + 20], [GXC + 9, GY + cableX[0]], [GXC + 7, GY + cableX[0]]], { note: 'copper for cable' });
  R.greenWest = G.beltPath('express', [[GBODY, 6], [GLEN + 1, 6]], { note: 'electronic-circuit' });
  R.greenEast = G.beltPath('express', [[GBODY, -6], [GLEN + 1, -6]], { note: 'electronic-circuit' });


  // =============================================================================================== south strip
  // Rows 70-72: copper main, risers, iron main. Under them, west to east: engines and electric engines (gear and pipe foundry
  // head), low density structures, batteries (plate head), then processing units over utility science over frames.
  copperBranch(EY, 39); const ironStrip = ironBranch(EY + 2, 44);
  // ---- engines: gear (south lane) and pipe (north lane) on row 80, steel on row 79, engines and circuits on row 86
  F('casting-iron-gear-wheel', 6, EY + 4, S); L.pipe('molten-iron', 7, EY + 3); L.pipe('molten-iron', 9, EY + 3);
  F('casting-pipe', 6, EY + 12, N); ironBranch(EY + 17, 9);
  arm('fast', 7, EY + 9, N, 'iron-gear-wheel'); arm('fast', 8, EY + 11, S, 'pipe');
  L.beltPath('fast', [[6, EY + 10], [18, EY + 10]], { note: 'iron-gear-wheel + pipe' });
  L.beltPath('fast', [[6, EY + 9], [19, EY + 9]], { note: 'steel-plate' });
  for (let i = 0; i < 3; i++) {
    const x = 11 + 3 * i;
    A('engine-unit', x, EY + 12); arm('fast', x, EY + 11, N, 'iron-gear-wheel + pipe'); arm('long', x + 2, EY + 11, N, 'steel-plate'); arm('fast', x + 1, EY + 15, N, 'engine-unit');
    A('electric-engine-unit', x, EY + 18, S); arm('fast', x + 1, EY + 17, N, 'engine-unit + electronic-circuit'); arm('fast', x, EY + 21, N, 'electric-engine-unit');
    L.ptg('lubricant', x + 1, EY + 21, N); L.ptg('lubricant', x + 1, EY + 23, S);
  }
  R.lube = L.pipePath('lubricant', [[12, EY + 24], [18, EY + 24]], { note: 'lubricant main' });
  // ---- low density structures: plastic on row 80, structures out on row 81
  for (let i = 0; i < 3; i++) {
    const x = 23 + 5 * i, cx = x + 2;
    F('casting-low-density-structure', x, EY + 4, S);
    L.pipe('molten-iron', cx + 1, EY + 3); L.ptg('molten-copper', cx - 1, EY + 3, S); L.ptg('molten-copper', cx - 1, EY + 1, N);
    arm('fast', cx - 1, EY + 9, S, 'plastic-bar'); arm('long', cx + 1, EY + 9, N, 'low-density-structure');
  }
  // ---- batteries: iron plate (south lane) and copper plate (north lane) on row 80, batteries out on row 81
  F('casting-iron', 40, EY + 4, S, 'plates for batteries'); L.pipe('molten-iron', 41, EY + 3); L.pipe('molten-iron', 43, EY + 3);
  F('casting-copper', 40, EY + 12, E, 'plates for batteries'); L.pipePath('molten-copper', [[39, EY], [39, EY + 15]], { note: 'copper for plates' });
  arm('fast', 42, EY + 9, N, 'iron-plate'); arm('fast', 42, EY + 11, S, 'copper-plate');
  L.beltPath('fast', [[40, EY + 10], [54, EY + 10]], { note: 'iron-plate + copper-plate' });
  for (let i = 0; i < 3; i++) {
    const x = 46 + 3 * i;
    L.machine('chemical-plant', x, EY + 6, 'battery', N, { role: 'battery' });
    arm('fast', x, EY + 9, S, 'iron-plate + copper-plate'); arm('long', x + 2, EY + 9, N, 'battery');
  }
  // ---- processing units (row 76), utility science (row 82), frames (row 88)
  const YX = 59, Y_X = [0, 3, 6, 11, 14, 17].map(v => YX + v);
  for (const x of Y_X) {
    A('processing-unit', x, EY + 6, N);
    L.ptg('sulfuric-acid', x + 1, EY + 5, S); L.ptg('sulfuric-acid', x + 1, EY + 3, N);
    arm('bulk', x, EY + 5, N, 'electronic-circuit', only('electronic-circuit')); arm('fast', x + 2, EY + 5, N, 'advanced-circuit', only('advanced-circuit'));
    arm('fast', x + 1, EY + 9, N, 'processing-unit');
    A('utility-science-pack', x, EY + 12);
    // the pack arm stands upstream of the machine's own processing-unit arm: the first machine in the row gets units too
    arm('fast', x + 2, EY + 11, N, 'processing-unit'); arm('fast', x, EY + 11, S, 'utility-science-pack');
    arm('fast', x + 1, EY + 15, S, 'flying-robot-frame + low-density-structure');
    A('flying-robot-frame', x, EY + 18);
    arm('fast', x + 1, EY + 17, S, 'flying-robot-frame');
    arm('fast', x, EY + 21, S, 'electric-engine-unit + battery'); arm('long', x + 2, EY + 21, S, 'steel-plate + electronic-circuit');
  }
  const YXE = Y_X.at(-1) + 2, TX = YXE + 1;   // TX: the column east of the strip where two belts are merged, one lane each
  R.acid = L.pipePath('sulfuric-acid', [[46, EY + 5], [55, EY + 5], [55, EY + 2], [YXE - 1, EY + 2]], { note: 'acid main' });


  // =============================================================================================== routes
  const SOUTH = EY + 32;
  // ---- production science packs to their chest
  R.purple = L.beltPath('fast', [[PX, PB - 1], [58, PB - 1], [58, PB - 3]], { note: 'production-science-pack' });
  // ---- advanced circuits: both rows east, pooled on column 64; north to the modules and the furnace machines, south to the processing units
  L.splitter('fast', 63, RB + 1, E, { output_priority: 'right' }, { note: 'advanced circuits: south first' });
  L.beltPath('fast', [[64, RB + 1], [64, RB - 9], [25, RB - 9], [25, FB + 6], [FXB + 5, FB + 6]], { note: 'advanced-circuit' });
  L.beltPath('fast', [[RX, RB - 1], [64, RB - 1]], { note: 'advanced-circuit', into: true });
  L.beltPath('fast', [[RX, RB + 1], [62, RB + 1]], { note: 'advanced-circuit' });
  // ---- plastic: in at the north edge, down column 66; the far belts of both advanced-circuit rows
  L.splitter('express', RX - 1, RB + 8, N, {}, { note: 'circuits to both rows' });
  R.plastic = L.beltPath('fast', [[66, 0], [66, RB - 10]], { note: 'plastic-bar' });
  L.splitter('fast', 66, RB - 9, S, {}, { note: 'plastic to both rows' });
  L.beltPath('fast', [[66, RB - 8], [59, RB - 8]], { note: 'plastic-bar', into: true });
  L.beltPath('fast', [[67, RB - 8], [67, RB + 8], [RX + 1, RB + 8]], { note: 'plastic-bar' });
  L.beltPath('fast', [[23, EY + 11], [37, EY + 11], [37, EY + 19], [57, EY + 19], [57, EY + 16], [YXE, EY + 16]], { note: 'low-density-structure + flying-robot-frame' });
  L.beltPath('fast', [[X.west + 1, EY + 28], [38, EY + 28], [38, EY + 10], [23, EY + 10]], { note: 'plastic-bar' });
  // ---- circuits of the west column: a share to the south strip, a share to the modules, the rest to the advanced circuits
  L.splitter('express', 73, GY + GLEN + 2, S, {}, { note: 'circuits: strip / rows' });
  L.beltPath('express', [[73, EY], [71, EY]], { note: 'electronic-circuit' });
  L.splitter('express', 70, EY - 1, W, {}, { note: 'circuits: modules / advanced circuits' });
  L.beltPath('express', [[69, EY - 1], [69, FB + 13], [FXB, FB + 13]], { note: 'electronic-circuit' });
  L.beltPath('express', [[69, EY], [66, EY], [66, EY - 1], [RX - 1, EY - 1]], { end: N, note: 'electronic-circuit' });
  L.beltPath('express', [[RX, RB + 7], [RXE, RB + 7]], { note: 'electronic-circuit' });
  L.beltPath('express', [[RX - 1, RB + 7], [RX - 1, RB - 7], [RXE, RB - 7]], { note: 'electronic-circuit' });
  // ---- the south strip's own belts
  L.beltPath('express', [[TX, EY + 4], [YX, EY + 4]], { note: 'electronic-circuit + advanced-circuit' });
  L.beltPath('fast', [[TX, EY + 23], [YX, EY + 23]], { note: 'steel-plate + electronic-circuit' });
  R.yellow = L.beltPath('fast', [[YX, EY + 10], [TX, EY + 10]], { note: 'processing-unit + utility-science-pack' });
  L.beltPath('fast', [[11, EY + 22], [YXE - 1, EY + 22]], { note: 'electric-engine-unit + battery' });
  L.beltPath('fast', [[46, EY + 11], [55, EY + 11], [55, EY + 22]], { note: 'battery', into: true });
  // ---- advanced circuits and circuits to the processing units: one lane each of row 74
  L.beltPath('fast', [[64, RB + 2], [64, EY + 1], [TX + 2, EY + 1], [TX + 2, EY + 6], [TX, EY + 6], [TX, EY + 4]], { note: 'advanced-circuit', into: true });
  L.beltPath('express', [[85, GY + GLEN + 2], [85, EY + 2], [TX, EY + 2], [TX, EY + 4]], { note: 'electronic-circuit', into: true });
  // ---- circuits for the frames (north side of row 93) and the electric engines (north lane of row 86)
  L.beltPath('express', [[74, EY], [87, EY], [87, EY + 18]], { note: 'electronic-circuit' });
  L.splitter('express', 87, EY + 19, S, {}, { note: 'circuits: frames / electric engines' });
  L.beltPath('express', [[87, EY + 20], [87, EY + 21], [TX, EY + 21], [TX, EY + 23]], { note: 'electronic-circuit', into: true });
  L.beltPath('express', [[88, EY + 20], [88, EY + 26], [21, EY + 26], [21, EY + 16], [11, EY + 16]], { note: 'electronic-circuit' });
  // ---- steel for the frames: the engine steel belt goes on along the south edge and joins row 93 from the south
  L.beltPath('fast', [[20, EY + 9], [20, EY + 30], [TX, EY + 30], [TX, EY + 23]], { note: 'steel-plate', into: true });
  // ---- acid and lubricant in at the south edge
  R.acidPort = L.pipePath('sulfuric-acid', [[46, EY + 5], [45, EY + 5], [45, SOUTH]], { note: 'acid in' });
  R.lubePort = L.pipePath('lubricant', [[15, EY + 24], [15, SOUTH]], { note: 'lubricant in' });
  Object.assign(R, { WEST, SOUTH, STONE_ROW, PB, TX, EY });
  assert.deepEqual(L.strayJunctions(), [], 'a belt runs into another it was not meant to feed');

  return { L, X, R, only };
}

// The pack governor (the six-pack science design's, one per chest): a timer counts up one a tick, the chest arm runs while the
// timer shows a whole period, and every pack it lifts takes one period off. No pack leaves faster than 3600 / period a minute,
// so with every stock upstream full the build draws what its panels say. Nothing is handed over for `startDelay` ticks after
// power-on, so belts and machines fill first.
export const GOVERNOR = Object.freeze({ period: 3600 / TARGET, bias: 1000, banked: 10, startDelay: 36000 });
function governor(L, wires, item, armAt, armFrom, chestAt, at, panelAt) {
  const g = GOVERNOR, each = { type: 'virtual', name: 'signal-each' }, sig = { type: 'item', name: item, quality: 'normal' };
  const arm = L.arm('fast', ...armAt, armFrom, { what: item, governed: true }, {
    use_filters: true, filter_mode: 'whitelist', filters: [{ index: 1, name: item, quality: 'normal', comparator: '=' }],
    control_behavior: { circuit_enabled: true, circuit_condition: { first_signal: sig, comparator: '≥', constant: g.bias + g.startDelay + g.period }, circuit_read_hand_contents: true, circuit_hand_read_mode: 0 } });
  const chest = L.add('passive-provider-chest', ...chestAt, { bar: 5 }, { note: item });
  const constant = L.add('constant-combinator', ...at.constant, { control_behavior: { sections: { sections: [{ index: 1, filters: [{ index: 1, type: 'item', name: item, quality: 'normal', comparator: '=', count: g.bias }] }] } } }, { note: 'governor' });
  const counter = L.add('decider-combinator', ...at.counter, { control_behavior: { decider_conditions: { conditions: [{ first_signal: each, comparator: '<', constant: g.bias + g.startDelay + g.banked * g.period, first_signal_networks: { red: false, green: true } }], outputs: [{ signal: each, copy_count_from_input: false, constant: 1 }] } } }, { note: 'governor' });
  const memory = L.add('arithmetic-combinator', ...at.memory, { control_behavior: { arithmetic_conditions: { first_signal: each, second_constant: 1, operation: '*', output_signal: each } } }, { note: 'governor' });
  const subtractor = L.add('arithmetic-combinator', ...at.subtractor, { control_behavior: { arithmetic_conditions: { first_signal: each, second_constant: -g.period, operation: '*', output_signal: each } } }, { note: 'governor' });
  const RED = 1, GREEN = 2, OUT_RED = 3, OUT_GREEN = 4;
  wires.push([constant, GREEN, arm, GREEN], [counter, GREEN, constant, GREEN], [memory, OUT_GREEN, constant, GREEN], [subtractor, RED, arm, RED], [counter, OUT_RED, memory, RED], [memory, OUT_RED, memory, RED], [subtractor, OUT_RED, memory, RED]);
  const panel = L.panel(...panelAt, `OUT: ${item} ${TARGET}/min, chest holds 1,000. First packs ${g.startDelay / 3600} min after power-on`, item);
  return { item, arm, chest, constant, counter, memory, subtractor, panel };
}

const ELECTRIC = /^(foundry|assembling-machine-3|chemical-plant|electric-furnace|fast-inserter|bulk-inserter|long-handed-inserter|constant-combinator|decider-combinator|arithmetic-combinator)$/;
// Substations: greedy cover of every powered entity from the free 2 x 2 spots, then joined into one copper network.
function substations(L, p, wires) {
  const reach = p.entities.substation.supply_area_distance, wire = p.entities.substation.maximum_wire_distance, b = L.bounds();
  const need = L.entities.filter(e => ELECTRIC.test(e.name)), covered = new Set(), chosen = [];
  const spots = [];
  for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) if (L.free(x, y) && L.free(x + 1, y) && L.free(x, y + 1) && L.free(x + 1, y + 1)) spots.push([x, y]);
  const covers = ([x, y], e) => e.tile.x < x + 1 + reach && e.tile.x + e.tile.w > x + 1 - reach && e.tile.y < y + 1 + reach && e.tile.y + e.tile.h > y + 1 - reach;
  const freeNow = ([x, y]) => L.free(x, y) && L.free(x + 1, y) && L.free(x, y + 1) && L.free(x + 1, y + 1);
  while (covered.size < need.length) {
    let best = null, gain = 0;
    for (const s of spots) { if (!freeNow(s)) continue; let n = 0; for (const e of need) if (!covered.has(e) && covers(s, e)) n++; if (n > gain) { gain = n; best = s; } }
    if (!best) throw new Error('No free spot for a substation near ' + JSON.stringify(need.filter(e => !covered.has(e)).slice(0, 6).map(e => [e.name, e.tile.x, e.tile.y])));
    chosen.push(L.add('substation', best[0], best[1], {}, { note: 'power' }));
    for (const e of need) if (covers(best, e)) covered.add(e);
  }
  // one copper network: join components through the closest pair, adding a relay substation where the gap is too wide
  const dist = (a, c) => Math.hypot(a.position.x - c.position.x, a.position.y - c.position.y);
  for (;;) {
    const comp = new Map(chosen.map(e => [e, e])), find = e => { while (comp.get(e) !== e) e = comp.get(e); return e; };
    for (const a of chosen) for (const c of chosen) if (a !== c && dist(a, c) <= wire) comp.set(find(a), find(c));
    const roots = new Set(chosen.map(find));
    if (roots.size === 1) break;
    let best = null;
    for (const a of chosen) for (const c of chosen) if (find(a) !== find(c)) { const d = dist(a, c); if (!best || d < best.d) best = { a, c, d }; }
    // a relay on the free spot nearest the midpoint that reaches at least one of the two
    const mid = { x: (best.a.position.x + best.c.position.x) / 2, y: (best.a.position.y + best.c.position.y) / 2 };
    const ok = spots.filter(freeNow).map(s => ({ s, da: Math.hypot(s[0] + 1 - best.a.position.x, s[1] + 1 - best.a.position.y), dc: Math.hypot(s[0] + 1 - best.c.position.x, s[1] + 1 - best.c.position.y) })).filter(v => v.da <= wire && v.dc < best.d - 0.5).sort((u, v) => (u.dc - v.dc) || (u.da - v.da));
    if (!ok.length) throw new Error('Cannot join the substations');
    chosen.push(L.add('substation', ok[0].s[0], ok[0].s[1], {}, { note: 'power relay' }));
  }
  const linked = new Set([chosen[0]]);
  while (linked.size < chosen.length) {
    let best = null;
    for (const a of linked) for (const c of chosen) if (!linked.has(c)) { const d = dist(a, c); if (d <= wire && (!best || d < best.d)) best = { a, c, d }; }
    wires.push([best.a, 5, best.c, 5]); linked.add(best.c);
  }
  return chosen;
}

export function design(p, slots, options = {}) {
  const { L, R } = build(p), wires = [], B = bill(p);
  const up = (v, step) => Math.ceil(v / step - 1e-9) * step;
  const figures = { lava: up(B.outside.lava, 500), calcite: up(B.outside.calcite, 1), 'plastic-bar': up(B.outside['plastic-bar'], 10), 'sulfuric-acid': up(B.outside['sulfuric-acid'], 10), lubricant: up(B.outside.lubricant, 10), stone: Math.round(B.stone.surplus) };
  // ---- chests and governors
  const purple = governor(L, wires, 'production-science-pack', [58, R.PB - 4], S, [58, R.PB - 5], { constant: [57, R.PB - 5], counter: [56, R.PB - 5], memory: [55, R.PB - 5], subtractor: [57, R.PB - 4] }, [58, R.PB - 6]);
  const yellow = governor(L, wires, 'utility-science-pack', [R.TX + 1, R.EY + 10], W, [R.TX + 2, R.EY + 10], { constant: [R.TX + 3, R.EY + 10], counter: [R.TX + 1, R.EY + 11], memory: [R.TX + 2, R.EY + 11], subtractor: [R.TX + 3, R.EY + 11] }, [R.TX + 2, R.EY + 9]);
  // ---- ports: the entity on the edge, its outside contact tile and its panel
  const portDefs = [
    { id: 'IN-1', item: 'lava', kind: 'pipe', side: 'west', at: [R.WEST, 0], panel: [R.WEST, 1] },
    { id: 'IN-2', item: 'calcite', kind: 'belt', side: 'west', at: [R.WEST, 8], panel: [R.WEST, 9] },
    { id: 'IN-3', item: 'plastic-bar', kind: 'belt', side: 'north', at: [66, 0], panel: [65, 0] },
    { id: 'IN-4', item: 'sulfuric-acid', kind: 'pipe', side: 'south', at: [45, R.SOUTH], panel: [44, R.SOUTH] },
    { id: 'IN-5', item: 'lubricant', kind: 'pipe', side: 'south', at: [15, R.SOUTH], panel: [14, R.SOUTH] },
    { id: 'OUT-STONE', item: 'stone', kind: 'belt', side: 'west', at: [R.WEST, R.STONE_ROW], panel: [R.WEST, R.STONE_ROW + 1], exit: true },
  ];
  for (const d of portDefs) {
    d.entity = L.at(...d.at);
    assert(d.entity && (d.kind === 'pipe' ? d.entity.name === 'pipe' : /transport-belt$/.test(d.entity.name)), 'port entity ' + d.id);
    d.perMinute = figures[d.item];
    d.label = `${d.exit ? 'OUT' : 'IN'}: ${d.item} ${d.perMinute}/min` + (d.exit ? ' surplus, take it away' : '');
    d.panelEntity = L.panel(...d.panel, d.label, d.item, d.kind === 'pipe' ? 'fluid' : 'item');
  }
  // ---- power
  const poles = substations(L, p, wires);
  const entry = poles.reduce((a, c) => (c.tile.x + c.tile.y * 0.01 < a.tile.x + a.tile.y * 0.01 ? c : a));
  let powerPanelAt = null; const bb = L.bounds();
  for (const [dx, dy] of [[2, 0], [2, 1], [-1, 0], [-1, 1], [0, -1], [1, -1], [0, 2], [1, 2]]) if (!powerPanelAt && entry.tile.x + dx >= bb.x0 && entry.tile.x + dx <= bb.x1 && entry.tile.y + dy >= bb.y0 && entry.tile.y + dy <= bb.y1 && L.free(entry.tile.x + dx, entry.tile.y + dy)) powerPanelAt = [entry.tile.x + dx, entry.tile.y + dy];
  const powerPanel = L.panel(...powerPanelAt, 'POWER: connect this substation', 'substation');
  const { dx, dy } = L.normalize();
  const b = L.bounds();
  assert(b.x0 === 0 && b.y0 === 0);
  // ---- blueprint
  const entities = L.entities.map(e => ({ ...e }));
  const bpWires = wires.map(([a, ca, c, cc]) => [a.entity_number, ca, c.entity_number, cc]);
  const blueprint = { blueprint: { item: 'blueprint', label: 'Vulcanus science | production + utility packs 60/min each | lava + calcite', description: `Factorio ${p.gameVersion} Space Age, Vulcanus. Makes ${TARGET} production and ${TARGET} utility science packs a minute from lava and calcite; plastic, sulfuric acid and lubricant come in. Ports are labelled with their per-minute figures: lava and calcite on the west edge (north-west corner), surplus stone out on the west edge, plastic on the north edge, sulfuric acid and lubricant on the south edge. Each pack has its own passive provider chest (1,000 packs). Power: the marked substation. No modules, no beacons, every recipe fixed. See the README.`, version: blueprintVersion(p.gameVersion), icons: ['production-science-pack', 'utility-science-pack', 'foundry', 'assembling-machine-3'].map((name, i) => ({ index: i + 1, signal: { name } })), entities, wires: bpWires } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const counts = Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length]));
  const footprint = { width: b.width, height: b.height, area: b.width * b.height, bounds: { left: 0, top: 0, right: b.width, bottom: b.height }, includes: 'every entity of the blueprint', entities: entities.length, counts };
  const vec = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] };
  const ports = portDefs.map(d => { const t = d.entity.tile, v = vec[d.side]; return { id: d.id, item: d.item, kind: d.kind, side: d.side, exit: !!d.exit, entity: d.entity.entity_number, tile: { x: t.x, y: t.y }, externalContact: { x: t.x + v[0], y: t.y + v[1] }, perMinute: d.perMinute, panel: d.panelEntity.entity_number, label: d.label }; });
  const machines = L.entities.filter(e => /^(foundry|assembling-machine-3|chemical-plant|electric-furnace)$/.test(e.name)).map(e => ({ entity: e.entity_number, name: e.name, recipe: e.recipe || 'stone-brick', role: e.meta.role || e.recipe, tile: { x: e.tile.x, y: e.tile.y } }));
  const built = {};
  for (const m of machines) built[m.recipe] = (built[m.recipe] || 0) + 1;
  const outputs = [purple, yellow].map(g => ({ item: g.item, chest: g.chest.entity_number, arm: g.arm.entity_number, tile: { x: g.chest.tile.x, y: g.chest.tile.y }, bar: 5, capacity: 5 * p.items[g.item].stack_size, panel: g.panel.entity_number,
    governor: { constant: g.constant.entity_number, counter: g.counter.entity_number, memory: g.memory.entity_number, subtractor: g.subtractor.entity_number } }));
  const tech = technologyClosure(p, ['production-science-pack', 'utility-science-pack'], [...new Set(entities.map(e => e.name)), ...Object.keys(built)]);
  const manifest = {
    schema: 1, id: 'production-utility-science', revision: 1, candidateSha256: hash, requiredGameVersion: p.gameVersion, prototypeSha256: options.prototypeSha256, fluidSlotsSha256: options.fluidSlotsSha256,
    surface: 'vulcanus', intendedUse: 'Production and utility science packs on Vulcanus from lava and calcite; plastic, sulfuric acid and lubricant supplied.',
    targets: { 'production-science-pack': TARGET, 'utility-science-pack': TARGET }, passFloor: 57,
    equipment: { inserters: HAND, belts: ['fast-transport-belt', 'express-transport-belt'], power: 'substation', modules: 0, beacons: 0, quality: 'normal' },
    footprint, ports, outputs, governor: { ...GOVERNOR, perMinute: TARGET, enableAt: GOVERNOR.bias + GOVERNOR.startDelay + GOVERNOR.period },
    power: { entry: entry.entity_number, panel: powerPanel.entity_number, label: 'POWER: connect this substation', tile: { x: entry.tile.x, y: entry.tile.y }, externalPole: { x: -3, y: entry.tile.y + 1 }, substations: poles.map(e => e.entity_number) },
    machines, machinesBuilt: built, bill: B,
    technologyClosure: tech.closure,
    status: { static: 'static-audit.json', native: 'native-report.json; qualified only when that report passed for candidateSha256' },
  };
  return { blueprint, code, hash, manifest, footprint, ports, layout: L, offset: { dx, dy } };
}
