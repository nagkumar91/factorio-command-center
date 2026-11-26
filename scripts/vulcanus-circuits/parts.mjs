// The building blocks the three Vulcanus circuit blueprints share, as functions that place entities on a Layout. Every block is
// 13 rows tall: a top row of machines (rows 0-4), a corridor (rows 5-7) and a bottom row of machines (rows 8-12).
//   rows 5 and 7  arms of the top and the bottom machines, and the two metal trunks: molten copper under row 5, molten iron under row 7
//   row 6         the belt both rows share
// Lava foundries and casting foundries stand turned (ports east and west) with a pipe column between them, so their north and
// south sides are free for arms. Molten copper lives in the top half of the lava block and molten iron in the bottom half; the
// two never share a column.
import assert from 'node:assert/strict';
import { N, E, S, W, VEC, opposite, MAX_UNDERGROUND } from './lib.mjs';

export const TOP = 2, BOTTOM = 10, MID = 6, ARM_T = 5, ARM_B = 7;   // centre rows of the two machine rows, the belt row, the two arm rows
export const RECIPE = { copperLava: 'molten-copper-from-lava', ironLava: 'molten-iron-from-lava', plate: 'casting-iron', cable: 'casting-copper-cable', ec: 'electronic-circuit', ac: 'advanced-circuit', pu: 'processing-unit' };

// ---- recipe arithmetic (from the pinned prototypes) ------------------------------------------------------------------------
export function rates(p) {
  const r = n => p.recipes[n], amount = (recipe, name, list = 'results') => r(recipe)[list].find(v => v.name === name)?.amount ?? 0;
  const foundry = p.entities.foundry, am3 = p.entities['assembling-machine-3'];
  const prod = 1 + foundry.effect_receiver.base_effect.productivity;
  assert.equal(am3.effect_receiver, undefined, 'assembling machine 3 has no built-in productivity');
  const crafts = (machine, recipe) => 60 * machine.crafting_speed / r(recipe).energy_required;   // crafts a minute, one machine
  return {
    prod, amount,
    foundryCrafts: n => crafts(foundry, n), am3Crafts: n => crafts(am3, n),
    // one foundry, per minute, at full speed
    cablePerFoundry: crafts(foundry, RECIPE.cable) * amount(RECIPE.cable, 'copper-cable') * prod,
    platePerFoundry: crafts(foundry, RECIPE.plate) * amount(RECIPE.plate, 'iron-plate') * prod,
    moltenPerLavaFoundry: crafts(foundry, RECIPE.copperLava) * amount(RECIPE.copperLava, 'molten-copper') * prod,
    // what a chain needs per minute for its electronic circuits, cable and plates
    demand({ ec = 0, ac = 0, pu = 0 }) {
      const acAll = ac + pu * amount(RECIPE.pu, 'advanced-circuit', 'ingredients');
      const ecAll = ec + acAll * amount(RECIPE.ac, 'electronic-circuit', 'ingredients') + pu * amount(RECIPE.pu, 'electronic-circuit', 'ingredients');
      const cable = ecAll * amount(RECIPE.ec, 'copper-cable', 'ingredients') + acAll * amount(RECIPE.ac, 'copper-cable', 'ingredients');
      const plate = ecAll * amount(RECIPE.ec, 'iron-plate', 'ingredients');
      const cableCrafts = cable / (amount(RECIPE.cable, 'copper-cable') * prod), plateCrafts = plate / (amount(RECIPE.plate, 'iron-plate') * prod);
      const moltenCopper = cableCrafts * amount(RECIPE.cable, 'molten-copper', 'ingredients'), moltenIron = plateCrafts * amount(RECIPE.plate, 'molten-iron', 'ingredients');
      const copperLavaCrafts = moltenCopper / (amount(RECIPE.copperLava, 'molten-copper') * prod), ironLavaCrafts = moltenIron / (amount(RECIPE.ironLava, 'molten-iron') * prod);
      const lavaCrafts = copperLavaCrafts + ironLavaCrafts;
      return {
        ec: ecAll, ac: acAll, pu, cable, plate, cableCrafts, plateCrafts, moltenCopper, moltenIron, copperLavaCrafts, ironLavaCrafts,
        lava: lavaCrafts * amount(RECIPE.copperLava, 'lava', 'ingredients'), calcite: lavaCrafts * amount(RECIPE.copperLava, 'calcite', 'ingredients'),
        stone: (copperLavaCrafts * amount(RECIPE.copperLava, 'stone') + ironLavaCrafts * amount(RECIPE.ironLava, 'stone')) * prod,
        plastic: acAll * amount(RECIPE.ac, 'plastic-bar', 'ingredients'), acid: pu * amount(RECIPE.pu, 'sulfuric-acid', 'ingredients'),
      };
    },
  };
}

// ---- underground pipe trunks ---------------------------------------------------------------------------------------------
// A trunk runs east along one corridor row, underground wherever it can. `stops` are the columns where it must come up as
// plain pipe: { from, to } (a run of plain pipes from column `from` to column `to`, joined by whatever stands beside it).
// Between two stops it dives; where a dive would be longer than the game allows it surfaces on two free tiles in between.
export function trunk(L, y, stops) {
  const placed = [];
  for (let i = 0; i < stops.length; i++) {
    const st = stops[i];
    for (let x = st.from; x <= st.to; x++) if (L.free(x, y)) placed.push(L.pipe(x, y));
    const next = stops[i + 1];
    if (!next) break;
    let a = st.to + 1;                       // the tile where the dive starts (open end west)
    const b = next.from - 1;                 // the tile where it comes up (open end east)
    if (a === b) { placed.push(L.pipe(a, y)); continue; }   // one tile between two stops: a plain pipe joins them
    if (a > b) continue;
    assert(L.free(a, y) && L.free(b, y), `trunk row ${y}: no room to dive at ${a} or to come up at ${b}`);
    placed.push(L.ptg(a, y, W));
    while (b - a > MAX_UNDERGROUND) {
      let m = null;
      for (let x = Math.min(a + MAX_UNDERGROUND, b - 2); x > a; x--) if (L.free(x, y) && L.free(x + 1, y) && x + 1 < b) { m = x; break; }
      assert(m, `trunk row ${y}: no two free tiles to surface between ${a} and ${b}`);
      placed.push(L.ptg(m, y, E), L.ptg(m + 1, y, W));
      a = m + 1;
    }
    placed.push(L.ptg(b, y, E));
  }
  return placed;
}

// ---- lava block -----------------------------------------------------------------------------------------------------------
// West end of every blueprint. Columns (from x0): 0-2 entrances and exit, 3 lava, 4-8 the first lava foundry of each metal, 9 the
// metal column (molten copper rows 1-5, molten iron rows 7-11), and with pairs = 2: 10-14 the second foundries, 15 lava, 16 kept
// empty. Lava by pipe at (x0, 3); calcite on a yellow belt at (x0, 6); stone leaves on a red belt at (x0, 7).
// Row 6 carries two belts braided: stone (red, west) and calcite (yellow, east, underground where stone is on the surface).
export function lavaBlock(L, x0, pairs) {
  assert(pairs === 1 || pairs === 2);
  const X = x => x0 + x;
  const out = { copperLava: [], ironLava: [] };
  // foundries: the first pair takes lava from the west and gives metal east; the second pair the other way round
  const cols = pairs === 2 ? [{ cx: 6, d: E }, { cx: 12, d: W }] : [{ cx: 6, d: E }];
  for (const c of cols) {
    out.copperLava.push(L.machine('foundry', X(c.cx), TOP, RECIPE.copperLava, c.d, 'lava foundry (molten copper)', 'copper-lava'));
    out.ironLava.push(L.machine('foundry', X(c.cx), BOTTOM, RECIPE.ironLava, c.d, 'lava foundry (molten iron)', 'iron-lava'));
  }
  // lava: entrance, the west lava column, and for two pairs the east lava column joined under row 6
  out.lavaEntrance = L.pipe(X(0), 3); L.pipes(X(1), 3, X(2), 3);
  L.pipes(X(3), 1, X(3), 11);
  if (pairs === 2) { L.hop(X(4), MID, X(14), MID); L.pipes(X(15), 1, X(15), 11); }
  // metal column: copper above the belt row, iron below it; the belt row between them stays a belt
  L.pipes(X(9), 1, X(9), ARM_T); L.pipes(X(9), ARM_B, X(9), 11);
  out.copperStart = X(9); out.ironStart = X(9);
  // calcite (yellow, east): surfaces on two tiles beside each foundry pair
  out.calciteEntrance = L.belt('yellow', 'calcite', X(0), MID, E); L.belt('yellow', 'calcite', X(1), MID, E);
  L.dive('yellow', 'calcite', X(2), MID, X(5), MID);
  if (pairs === 2) L.dive('yellow', 'calcite', X(6), MID, X(11), MID);
  // stone (red, west): dropped beside each pair, then down to row 7 and out under the lava column
  if (pairs === 2) { L.belt('red', 'stone', X(13), MID, W); L.dive('red', 'stone', X(12), MID, X(10), MID); L.belt('red', 'stone', X(9), MID, W); }
  L.belt('red', 'stone', X(8), MID, W); L.belt('red', 'stone', X(7), MID, S); L.belt('red', 'stone', X(7), ARM_B, W);
  L.dive('red', 'stone', X(6), ARM_B, X(2), ARM_B); L.belt('red', 'stone', X(1), ARM_B, W);
  out.stoneExit = L.belt('red', 'stone', X(0), ARM_B, W);
  // arms: calcite in (fast, filtered) and stone out (bulk), one of each per foundry
  const pick = pairs === 2 ? [5, 11] : [5], drop = pairs === 2 ? [8, 13] : [8];
  cols.forEach((c, i) => {
    L.arm('fast-inserter', X(pick[i]), ARM_T, S, 'calcite belt -> lava foundry (molten copper)', 'calcite');
    L.arm('fast-inserter', X(pick[i]), ARM_B, N, 'calcite belt -> lava foundry (molten iron)', 'calcite');
    L.arm('bulk-inserter', X(drop[i]), ARM_T, N, 'lava foundry (molten copper) -> stone belt', 'stone');
    L.arm('bulk-inserter', X(drop[i]), ARM_B, S, 'lava foundry (molten iron) -> stone belt', 'stone');
  });
  out.width = pairs === 2 ? 17 : 11;
  out.substation = L.add('substation', X(1), 9);
  return out;
}

// ---- iron block -----------------------------------------------------------------------------------------------------------
// Casting foundries for iron plate, two rows, dropping plates on the belt of row 6 (it runs east into the circuit core).
// Columns (from x0): an iron pipe column, a foundry pair fed from the west, a foundry pair fed from the east, the next pipe column...
// `count` foundry columns (each a top and a bottom foundry).
export function ironBlock(L, x0, count, { substations = false } = {}) {
  const out = { foundries: [], junctions: [], drops: [], crossings: [] };
  let x = x0;
  for (let i = 0; i < count; i++) {
    const westFed = i % 2 === 0;
    // with `substations`, every pipe column after the first has a substation east of it on rows 5-6 (the plate belt dives under both)
    const sub = substations && westFed && i > 0;
    if (westFed) { L.pipes(x, 1, x, 11); out.junctions.push(x); out.crossings.push({ from: x - 1, to: sub ? x + 3 : x + 1 }); if (sub) L.add('substation', x + 1, ARM_T); x += 1; }
    const cx = x + 2;
    out.foundries.push(L.machine('foundry', cx, TOP, RECIPE.plate, westFed ? E : W, 'foundry (iron plate)', 'cast-iron'), L.machine('foundry', cx, BOTTOM, RECIPE.plate, westFed ? E : W, 'foundry (iron plate)', 'cast-iron'));
    // the first pair hands over at its east end: the two tiles west of that hold a substation and the surfacing copper trunk
    const ax = i === 0 || sub ? cx + 2 : cx;
    L.arm('bulk-inserter', ax, ARM_T, N, 'iron plate foundry -> plate belt');
    L.arm('bulk-inserter', ax, ARM_B, S, 'iron plate foundry -> plate belt');
    out.drops.push(ax);
    x += 5;
    if (!westFed && i === count - 1) { L.pipes(x, 1, x, 11); out.junctions.push(x); out.crossings.push({ from: x - 1, to: x + 1 }); x += 1; }
  }
  out.width = x - x0;
  return out;
}
// The plate belt of an iron block: from its first drop tile east to `end`, diving under the pipe columns it crosses. `cross` lists
// them as columns (the belt dives one tile before and comes up one tile after) or as { from, to } dives.
export function plateBelt(L, start, end, cross, tier = 'red') {
  const hops = new Map(cross.map(c => (typeof c === 'number' ? { from: c - 1, to: c + 1 } : c)).filter(c => c.from >= start && c.to <= end).map(c => [c.from, c.to]));
  for (let x = start; x <= end; x++) {
    if (hops.has(x)) { L.dive(tier, 'plates', x, MID, hops.get(x), MID); x = hops.get(x); } else L.belt(tier, 'plates', x, MID, E);
  }
}

// ---- circuit core ---------------------------------------------------------------------------------------------------------
// `count` triplets side by side, each 13 columns: assembling machine 3, cable foundry, assembling machine 3, in a top band and a
// mirrored bottom band. Cable never touches a belt: two bulk arms carry it from the foundry into each machine. Plates come on
// row 6 (both bands take from it); circuits leave on row 0 (top band) and row 12 (bottom band), diving under the foundries.
// A substation stands in every triplet on rows 5-6; the plate belt and the copper trunk pass under it.
export function circuitCore(L, x0, count, { plateFrom, plateTier = 'red', productTier = 'red', lines = ['circuits', 'circuits'], plateOn = false }) {
  const out = { triplets: [], copperStops: [], machines: [], cable: [], substations: [] };
  let plateAt = plateFrom;          // next free column of the plate belt
  for (let i = 0; i < count; i++) {
    const b = x0 + 13 * i, last = i === count - 1;
    const cfT = L.machine('foundry', b + 6, TOP, RECIPE.cable, N, 'foundry (copper cable)', 'cast-cable');
    const cfB = L.machine('foundry', b + 6, BOTTOM, RECIPE.cable, S, 'foundry (copper cable)', 'cast-cable');
    out.cable.push(cfT, cfB);
    for (const [ax, gap, from] of [[b + 1, b + 3, E], [b + 11, b + 9, W]]) {
      out.machines.push(L.machine('assembling-machine-3', ax, TOP + 1, RECIPE.ec, N, 'assembling machine 3 (electronic circuit)', 'electronic-circuit'));
      out.machines.push(L.machine('assembling-machine-3', ax, BOTTOM - 1, RECIPE.ec, N, 'assembling machine 3 (electronic circuit)', 'electronic-circuit'));
      for (const y of [TOP + 1, TOP + 2, BOTTOM - 2, BOTTOM - 1]) L.arm('bulk-inserter', gap, y, from, 'cable foundry -> electronic circuit machine (copper cable)');
      L.arm('bulk-inserter', ax, ARM_T, S, 'plate belt -> electronic circuit machine (iron plate)');
      L.arm('bulk-inserter', ax, ARM_B, N, 'plate belt -> electronic circuit machine (iron plate)');
      L.arm('bulk-inserter', ax, 1, S, 'electronic circuit machine -> circuit belt (top)');
      L.arm('bulk-inserter', ax, 11, N, 'electronic circuit machine -> circuit belt (bottom)');
    }
    out.substations.push(L.add('substation', b + 2, ARM_T));
    // plate belt: on the surface up to the first machine, under the substation and the copper link, then on to the second machine
    for (let x = plateAt; x <= b; x++) L.belt(plateTier, 'plates', x, MID, E);
    L.dive(plateTier, 'plates', b + 1, MID, b + 7, MID);
    for (let x = b + 8; x <= (last && !plateOn ? b + 11 : b + 12); x++) L.belt(plateTier, 'plates', x, MID, E);
    plateAt = b + 13;
    // copper: plain pipes under the top foundry (both of its ports), down across the belt row to one port of the bottom foundry
    L.pipes(b + 6, MID, b + 6, ARM_B); L.pipe(b + 5, ARM_B);
    out.copperStops.push({ from: b + 5, to: b + 7 });
    // circuit belts: rows 0 and 12, under the foundry
    for (const [y, line] of [[0, lines[0]], [12, lines[1]]]) {
      for (let x = b; x <= b + 2; x++) L.belt(productTier, line, x, y, E);
      L.dive(productTier, line, b + 3, y, b + 9, y);
      for (let x = b + 10; x <= b + 12; x++) L.belt(productTier, line, x, y, E);
    }
    out.triplets.push(b);
  }
  out.end = x0 + 13 * count;      // first column east of the core
  return out;
}

// ---- circuit core with cable taps -------------------------------------------------------------------------------------------
// `count` units side by side, each 11 columns: an assembling machine 3 (electronic circuit), a cable foundry, and on the foundry's
// other side one bulk arm that puts cable on a short belt. In a top band and a mirrored bottom band. Circuits leave on row 0 and
// row 12 as in circuitCore; the cable belt of each foundry side-loads that same belt from inside, so the belt carries two lanes
// east: circuits on its outer lane, cable on its inner lane. Plates come on row 6.
export function tapCore(L, x0, count, { plateFrom, plateTier = 'red', tier = 'red' }) {
  const out = { units: [], copperStops: [], machines: [], cable: [], substations: [] };
  let plateAt = plateFrom;
  for (let i = 0; i < count; i++) {
    const b = x0 + 11 * i, last = i === count - 1, ax = b + 1;
    out.cable.push(L.machine('foundry', b + 6, TOP, RECIPE.cable, N, 'foundry (copper cable)', 'cast-cable'), L.machine('foundry', b + 6, BOTTOM, RECIPE.cable, S, 'foundry (copper cable)', 'cast-cable'));
    out.machines.push(L.machine('assembling-machine-3', ax, TOP + 1, RECIPE.ec, N, 'assembling machine 3 (electronic circuit)', 'electronic-circuit'));
    out.machines.push(L.machine('assembling-machine-3', ax, BOTTOM - 1, RECIPE.ec, N, 'assembling machine 3 (electronic circuit)', 'electronic-circuit'));
    for (const y of [TOP + 1, TOP + 2, BOTTOM - 2, BOTTOM - 1]) L.arm('bulk-inserter', b + 3, y, E, 'cable foundry -> electronic circuit machine (copper cable)');
    L.arm('bulk-inserter', ax, ARM_T, S, 'plate belt -> electronic circuit machine (iron plate)');
    L.arm('bulk-inserter', ax, ARM_B, N, 'plate belt -> electronic circuit machine (iron plate)');
    L.arm('bulk-inserter', ax, 1, S, 'electronic circuit machine -> feed belt (top)');
    L.arm('bulk-inserter', ax, 11, N, 'electronic circuit machine -> feed belt (bottom)');
    // cable taps: one bulk arm per foundry onto a three-tile belt that side-loads the feed belt
    L.arm('bulk-inserter', b + 9, TOP + 1, W, 'cable foundry -> cable belt (top)');
    L.arm('bulk-inserter', b + 9, BOTTOM - 1, W, 'cable foundry -> cable belt (bottom)');
    L.run(tier, 'feed-top', b + 10, TOP + 1, b + 10, 1); L.run(tier, 'feed-bottom', b + 10, BOTTOM - 1, b + 10, 11);
    out.substations.push(L.add('substation', b + 2, ARM_T));
    for (let x = plateAt; x <= (last ? b + 1 : b); x++) L.belt(plateTier, 'plates', x, MID, E);
    if (!last) { L.dive(plateTier, 'plates', b + 1, MID, b + 7, MID); plateAt = b + 8; }
    L.pipes(b + 6, MID, b + 6, ARM_B); L.pipe(b + 5, ARM_B);
    out.copperStops.push({ from: b + 5, to: b + 7 });
    for (const [y, line] of [[0, 'feed-top'], [12, 'feed-bottom']]) {
      for (let x = b; x <= b + 2; x++) L.belt(tier, line, x, y, E);
      L.dive(tier, line, b + 3, y, b + 9, y);
      L.belt(tier, line, b + 10, y, E);
    }
    out.units.push(b);
  }
  out.end = x0 + 11 * count;
  return out;
}

// ---- advanced circuit block ---------------------------------------------------------------------------------------------
// Assembling machines 3 in pairs, a top band and a mirrored bottom band. Each machine takes electronic circuits and cable from the
// feed belt on its outer side (row 0 or 12, two lanes), plastic from the yellow belt of row 6 and puts its circuits on the red belt
// of row 6. Row 6 is two belts braided, as in the lava block: the red belt (east, to the exit) dives under the two tiles where
// the yellow plastic belt (west, from the east edge) is on the surface. `gaps` lists the pairs that are two columns wider and
// hold a substation between their machines.
export function acBlock(L, x0, pairs, gaps, { recipe = RECIPE.ac, role = 'assembling machine 3 (advanced circuit)', group = 'advanced-circuit', product = 'advanced', input = 'plastic', ports = true } = {}) {
  const out = { machines: [], substations: [] };
  let p = x0, lastCentre = null, prev = null;
  for (let k = 0; k < pairs; k++) {
    const wide = gaps.includes(k), a2 = p + (wide ? 5 : 3), len = wide ? 8 : 6;
    for (const [ax, drop, pick] of [[p + 1, p, p + 2], [a2 + 1, a2 + 2, a2]]) {
      out.machines.push(L.machine('assembling-machine-3', ax, TOP + 1, recipe, N, role, group), L.machine('assembling-machine-3', ax, BOTTOM - 1, recipe, N, role, group));
      L.arm('bulk-inserter', ax, 1, N, 'feed belt (top) -> machine (electronic circuit, copper cable)');
      L.arm('bulk-inserter', ax, 11, S, 'feed belt (bottom) -> machine (electronic circuit, copper cable)');
      L.arm('fast-inserter', pick, ARM_T, S, 'plastic belt -> machine'); L.arm('fast-inserter', pick, ARM_B, N, 'plastic belt -> machine');
      L.arm('fast-inserter', drop, ARM_T, N, 'machine -> product belt'); L.arm('fast-inserter', drop, ARM_B, S, 'machine -> product belt');
      lastCentre = ax;
    }
    if (wide) out.substations.push(L.add('substation', p + 3, TOP));
    // row 6: red [belt][in] ... [out][belt], yellow between them on the surface, flowing west
    L.belt('red', product, p, MID, E);
    L.dive('red', product, p + 1, MID, p + len - 2, MID);
    L.belt('red', product, p + len - 1, MID, E);
    out.yellow ??= [];
    out.yellow.push({ in: p + 2, out: p + len - 3, mid: wide ? [p + 3, p + 4] : [] });
    p += len;
  }
  const e0 = p;
  if (ports) {
    // the product belt turns down to row 7 and leaves east; plastic comes in beside it on row 6
    L.belt('red', product, e0, MID, S); L.run('red', product, e0, ARM_B, e0 + 2, ARM_B);
    out.exit = L.at(e0 + 2, ARM_B);
    out.entrance = L.belt('yellow', input, e0 + 2, MID, W);
    plasticBelt(L, out.yellow, e0 + 1, input);
  }
  // feed belts: on from the core to the last machine
  out.feedEnd = lastCentre; out.end = e0 + 3; out.east = e0;
  return out;
}
// The yellow plastic belt of an advanced circuit block, flowing west: it dives at column `from` and surfaces in every pair, ending in the first.
export function plasticBelt(L, yellow, from, input = 'plastic') {
  for (let k = yellow.length - 1; k >= 0; k--) {
    const y = yellow[k];
    L.dive('yellow', input, from, MID, y.out, MID);
    for (const x of [...y.mid].reverse()) L.belt('yellow', input, x, MID, W);
    if (k === 0) L.belt('yellow', input, y.in, MID, W); else from = y.in;
  }
}

// ---- processing unit block ------------------------------------------------------------------------------------------------
// Assembling machines 3 in wide pairs (8 columns: machine, two columns, machine) and one single at the east end, a top band and
// a mirrored bottom band. Each machine takes electronic circuits from the feed belt on its outer side, advanced circuits from the
// red belt of row 6 and puts its processing units on the yellow belt of row 6 (the two are braided: where one is on the surface
// the other is underground). The two machines of a pair face each other across the two columns between them; sulfuric acid stands
// there, on a pipe that reaches both ports and comes down from an underground trunk in row 1 (row 11 below). A substation stands
// under those pipes on rows 4-5. The red belt arrives underground at column x0 + 2.
export function puBlock(L, x0, pairs) {
  const out = { machines: [], acidStops: [], substations: [] };
  const role = 'assembling machine 3 (processing unit)', group = 'processing-unit';
  const machine = (ax, facing) => { out.machines.push(L.machine('assembling-machine-3', ax, TOP + 1, RECIPE.pu, facing, role, group), L.machine('assembling-machine-3', ax, BOTTOM - 1, RECIPE.pu, facing, role, group)); L.arm('bulk-inserter', ax, 1, N, 'feed belt (top) -> machine (electronic circuit)'); L.arm('bulk-inserter', ax, 11, S, 'feed belt (bottom) -> machine (electronic circuit)'); };
  const arms = (drop, pick) => {
    L.arm('fast-inserter', pick, ARM_T, S, 'advanced circuit belt -> machine'); L.arm('fast-inserter', pick, ARM_B, N, 'advanced circuit belt -> machine');
    L.arm('fast-inserter', drop, ARM_T, N, 'machine -> product belt'); L.arm('fast-inserter', drop, ARM_B, S, 'machine -> product belt');
  };
  let p = x0;
  for (let k = 0; k < pairs; k++) {
    machine(p + 1, E); machine(p + 6, W);
    arms(p, p + 2); arms(p + 7, p + 5);
    // acid: from the stop of the trunk (row 1 / row 11) down to the tile between the two ports, and the tile beside it
    L.pipes(p + 3, 2, p + 3, 3); L.pipe(p + 4, 3); L.pipes(p + 3, 9, p + 3, 10); L.pipe(p + 4, 9);
    out.acidStops.push(p + 3);
    out.substations.push(L.add('substation', p + 3, 4));
    // row 6: product (yellow, east) on the outer tiles, advanced circuits (red, east) on the four tiles between
    L.belt('yellow', 'product', p, MID, E); L.dive('yellow', 'product', p + 1, MID, p + 6, MID); L.belt('yellow', 'product', p + 7, MID, E);
    if (k > 0) L.ug('red', 'advanced', p + 2, MID, E, 'output');
    L.belt('red', 'advanced', p + 3, MID, E); L.belt('red', 'advanced', p + 4, MID, E); L.ug('red', 'advanced', p + 5, MID, E, 'input');
    p += 8;
  }
  // the single machine: it faces the acid column that also joins the two trunks, and the product belt dives under that column
  machine(p + 1, E); arms(p, p + 2);
  const q = p + 3;
  L.pipes(q, 1, q, 11);
  L.belt('yellow', 'product', p, MID, E); L.dive('yellow', 'product', p + 1, MID, q + 1, MID);
  out.exit = L.belt('yellow', 'product', q + 2, MID, E);
  L.ug('red', 'advanced', p + 2, MID, E, 'output');
  out.acidEntrance = L.pipe(q + 2, 1); L.pipe(q + 1, 1);
  out.acidColumn = q; out.feedEnd = p + 1; out.end = q + 3;
  return out;
}
