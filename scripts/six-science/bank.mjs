// Advanced-circuit lane bank. No ring: every belt lane carries one item.
// Rows (y relative to Q at by):
//   by-1 M  module output lane (east part), fed by long-handed arms reaching over Q
//   by   C  copper for the cable makers (west part), Q east of it:
//          Q south lane circuits (fed from the north through a curve), Q north lane advanced circuits
//   by+1 arms   by+2..4 north row: 5 cable makers, 9 advanced-circuit machines, 4 productivity-module machines
//   by+5 arms   by+6 R: north lane plastic (side-loaded), south lane cable (dropped by the cable makers)
//   by+7 arms   by+8..10 south row: 16 advanced-circuit machines (17 slots, the east one empty)
//   by+11 arms  by+12 S: north lane circuits (side-loaded), south lane advanced circuits
import {N, E, S, W, filterOf, below, holdReader} from './grid.mjs';

// `southEmpty` lists south-row slots left without a machine (S still runs their length to the export ring).
export function bank(L, raw, bx, by, {cable = 5, north = 9, south = 17, southEmpty = [16], modules = 4, moduleCap = 8, qShort = false, qLoader = null, powerGaps = [], cWest = bx - 2} = {}) {
  const tag = {block: 'bank'};
  const arm = (name, x, y, d, items, extra = {}) => L.arm(name, x, y, d, {...filterOf(items), tags: {...tag, ...extra}});
  const slotX = i => bx + 3 * i; // left tile of slot i
  const feeds = [];
  // C: copper for the cable makers, both lanes.
  const cEnd = slotX(cable) - 1;
  let cStart;
  for (let x = cWest; x <= cEnd; x++) { const b = L.belt(x, by, x === cEnd ? S : E, {tags: {...tag, lane: 'copper'}}); cStart ??= b; }
  feeds.push({item: 'copper-plate', entry: cStart, approach: E, block: 'bank', lane: 'both'});
  // Q: starts east of the cable makers; circuits arrive through a curve from the north
  // after a side-load onto the west lane of a southbound belt (west lane -> Q south lane).
  const qx = cEnd + 1, qEnd = slotX(cable + north + modules);
  let qTarget;
  if (qLoader) {
    // Circuits are loaded onto the right lane of a short belt west of the bank (side-load from
    // the south), which runs east along row by-1 and turns south into Q: east, south, east keeps
    // the right lane, so circuits arrive on Q's south lane.
    const lx = qLoader.x;
    L.belt(lx, by - 1, E, {tags: {...tag, lane: 'q-stub'}});
    qTarget = L.belt(lx + 1, by - 1, E, {tags: {...tag, lane: 'q-target'}});
    for (let x = lx + 2; x < qx; x++) L.belt(x, by - 1, E, {tags: {...tag, lane: 'q-tap'}});
    L.belt(qx, by - 1, S, {tags: {...tag, lane: 'q-drop'}});
  } else if (qShort) {
    // Two-row stub: the side-load lands on the tile just above Q's curve.
    L.belt(qx, by - 2, S, {tags: {...tag, lane: 'q-stub'}});
    qTarget = L.belt(qx, by - 1, S, {tags: {...tag, lane: 'q-target'}});
  } else {
    L.belt(qx, by - 3, S, {tags: {...tag, lane: 'q-stub'}});
    qTarget = L.belt(qx, by - 2, S, {tags: {...tag, lane: 'q-target'}});
    L.belt(qx, by - 1, S, {tags: {...tag, lane: 'q-drop'}});
  }
  for (let x = qx; x <= qEnd; x++) L.belt(x, by, E, {tags: {...tag, lane: 'q'}});
  feeds.push({item: 'electronic-circuit', entry: qTarget, approach: qLoader ? N : E, block: 'bank', lane: 'q-south'});
  // R: plastic side-loaded from the north at the west end.
  L.belt(bx - 2, by + 6, E, {tags: {...tag, lane: 'r-stub'}});
  const rTarget = L.belt(bx - 1, by + 6, E, {tags: {...tag, lane: 'r-target'}});
  const rEnd = Math.max(slotX(cable + north) - 2, slotX(south) - 1);
  // Power gaps: a 2x2 substation sits on rows by+5..by+6 at slotX(g)+2..+3; R tunnels under it.
  const gapCells = new Set(powerGaps.flatMap(g => [slotX(g) + 2, slotX(g) + 3]));
  for (let x = bx; x <= rEnd; x++) {
    if (gapCells.has(x)) continue;
    if (gapCells.has(x + 1)) L.underground(x, by + 6, E, 'input', {tags: {...tag, lane: 'r-gap'}});
    else if (gapCells.has(x - 1)) L.underground(x, by + 6, E, 'output', {tags: {...tag, lane: 'r-gap'}});
    else L.belt(x, by + 6, E, {tags: {...tag, lane: 'r'}});
  }
  feeds.push({item: 'plastic-bar', entry: rTarget, approach: S, block: 'bank', lane: 'r-north'});
  // S: circuits side-loaded from the north at the west end.
  L.belt(bx - 2, by + 12, E, {tags: {...tag, lane: 's-stub'}});
  const sTarget = L.belt(bx - 1, by + 12, E, {tags: {...tag, lane: 's-target'}});
  const sEnd = slotX(south);
  for (let x = bx; x <= sEnd; x++) L.belt(x, by + 12, E, {tags: {...tag, lane: 's'}});
  feeds.push({item: 'electronic-circuit', entry: sTarget, approach: S, block: 'bank', lane: 's-north'});
  // North row.
  for (let i = 0; i < cable + north; i++) {
    const left = slotX(i), recipe = i < cable ? 'copper-cable' : 'advanced-circuit';
    L.machine(left + 1, by + 3, recipe, {tags: {...tag, glyph: i < cable ? 'k' : 'v'}});
    if (recipe === 'copper-cable') {
      arm('bulk-inserter', left + 1, by + 1, N, ['copper-plate'], {role: 'lane-feed'});
      arm('bulk-inserter', left + 1, by + 5, N, ['copper-cable'], {role: 'lane-output'});
    } else {
      arm('fast-inserter', left, by + 1, N, ['electronic-circuit'], {role: 'lane-feed'});
      arm('fast-inserter', left + 2, by + 1, S, ['advanced-circuit'], {role: 'lane-output'});
      arm('fast-inserter', left + 1, by + 5, S, ['copper-cable', 'plastic-bar'], {role: 'lane-feed'});
    }
  }
  // South row.
  for (let i = 0; i < south; i++) {
    if (southEmpty.includes(i)) continue;
    const left = slotX(i);
    L.machine(left + 1, by + 9, 'advanced-circuit', {tags: {...tag, glyph: 'v'}});
    arm('fast-inserter', left + (powerGaps.includes(i) ? 1 : 2), by + 7, N, ['copper-cable', 'plastic-bar'], {role: 'lane-feed'});
    arm('fast-inserter', left, by + 11, S, ['electronic-circuit'], {role: 'lane-feed'});
    arm('fast-inserter', left + 1, by + 11, N, ['advanced-circuit'], {role: 'lane-output'});
  }
  // Module machines at the east end of the north row: circuits and advanced circuits from Q,
  // output by a long-handed arm over Q onto the module lane M, which reads every tile.
  const mLeft = slotX(cable + north), mTiles = [], mArms = [];
  for (let i = 0; i < modules; i++) {
    const left = mLeft + 3 * i;
    L.machine(left + 1, by + 3, 'productivity-module', {tags: {...tag, glyph: 'o'}});
    arm('fast-inserter', left, by + 1, N, ['electronic-circuit', 'advanced-circuit'], {role: 'lane-feed'});
    mArms.push(arm('long-handed-inserter', left + 1, by + 1, S, ['productivity-module'], {role: 'lane-output'}));
  }
  for (let x = mLeft + 1; x <= qEnd; x++) mTiles.push(L.belt(x, by - 1, E, {control_behavior: {...holdReader}, tags: {...tag, lane: 'modules'}}));
  for (let i = 1; i < mTiles.length; i++) L.wire(mTiles[i - 1], mTiles[i]);
  for (const a of mArms) { a.control_behavior = below('productivity-module', moduleCap); L.wire(a, L.at(Math.floor(a.position.x), by - 1)); }
  const mOut = mTiles.at(-1);
  // Advanced circuits leave Q's east end (straight down to the export ring) and S's east end.
  arm('fast-inserter', qEnd, by + 1, N, ['advanced-circuit'], {role: 'lane-export'});
  let qOut;
  for (let y = by + 2; y <= by + 5; y++) qOut = L.belt(qEnd, y, S, {tags: {...tag, export: 'advanced-circuit'}});
  const sOut = L.at(sEnd, by + 12);
  return {feeds, powerHoles: powerGaps.map(g => [slotX(g) + 2, by + 5]), moduleLane: {tiles: mTiles, cap: moduleCap, arms: mArms.map(a => a.entity_number)}, outputs: {modules: mOut, qAdvanced: qOut, sAdvanced: sOut},
    machineSlots: {north: cable + north, south: south - southEmpty.length}, extent: {left: bx - 2, right: qEnd, top: by - (qLoader ? 1 : qShort ? 2 : 3), bottom: by + 12}};
}
