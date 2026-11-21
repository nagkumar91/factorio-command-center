// Ring bands. Each band has two rings side by side (west ring touches the
// manifold, east ring touches the export ring) and is fed by rear lane belts.
// Band X and band Y share a two-belt rear zone: fast arms reach the near belt,
// long-handed arms the far one.
import {N, E, S, W, filterOf} from './grid.mjs';
import {Ring, machine, admitWest, transfer, slotGeometry} from './ring.mjs';
import {laneBelt} from './lanes.mjs';

const ri = (k, items) => ({side: 'ring', k, role: 'in', ...(items ? {items} : {})});
const ro = (k = 2) => ({side: 'ring', k, role: 'out'});
const r2o = (k = 2) => ({side: 'ring2', k, role: 'out'});
const rear = (k, items, name) => ({side: 'rear', k, role: 'in', items, ...(name ? {name} : {})});
const LONG = 'long-handed-inserter', BULK = 'bulk-inserter';

// Geometry constants of the whole layout (tile coordinates).
export const G = {
  westX0: 2, eastX0: 29, xRingY: 19, yRingY: 38,
  westW: 25, eastW: 22, h: 6,
  exportX: 53, exportTop: 7, exportBottom: 43,
  topRearGaps: [1, 14, 27, 44], sharedGaps: [0, 14, 27],
  // Extra 2x2 cells kept open for substations (x, y of the north-west tile).
  holes: [[9, 51], [28, 51], [42, 51]],
  // Processor circuit belt D starts at column 0; its tap leaves the circuit spine near row 44.
  dStartX: 1, dTapY: 44,
  // Columns the west ends of the rear lane belts move east (narrower manifold experiments).
  feedShift: 1, bandXShift: 0,
  // Rail cell: west column of the west rail machine and the row of the rail belt.
  railCell: {x: -10, beltY: 52},
  // Gears and pipes for the engines on the frames ring come from the blue ring's machines over the export
  // ring and the utility ring (false: the utility ring's bottom row makes them itself, two more machines).
  relayGearAndPipe: true,
  // Inside-row slots left empty for substations: [ring id, slot].
  insideHoles: [['red-green-military', 5], ['blue', 3], ['blue', 6], ['utility-production', 3], ['utility-production', 6]],
};

export function bandX(L, raw) {
  const oy = G.xRingY;
  const B = new Ring(L, {id: 'red-green-military', x0: G.westX0, y0: oy, w: G.westW, h: G.h,
    limits: {'iron-gear-wheel': 32, inserter: 12, 'transport-belt': 12, 'firearm-magazine': 12, grenade: 12, 'piercing-rounds-magazine': 12, 'stone-wall': 24,
      'electronic-circuit': 12, sulfur: 8, 'automation-science-pack': 8, 'logistic-science-pack': 8, 'military-science-pack': 8}});
  const A = new Ring(L, {id: 'blue', x0: G.eastX0, y0: oy, w: G.eastW, h: G.h,
    limits: {'iron-gear-wheel': 16, pipe: 24, 'engine-unit': 24, 'advanced-circuit': 24, sulfur: 8, 'chemical-science-pack': 12,
      'automation-science-pack': 8, 'logistic-science-pack': 8, 'military-science-pack': 8}});
  const m = (ring, row, slot, recipe, arms, glyph) => machine(L, raw, ring, {row, slot, recipe, arms, glyph});
  // B top row: iron | coal rear belt.
  m(B, 'top', 0, 'iron-gear-wheel', [rear(1, ['iron-plate']), rear(2, ['iron-plate']), ro()], 'g');
  m(B, 'top', 1, 'inserter', [rear(2, ['iron-plate']), ri(1, ['iron-gear-wheel', 'electronic-circuit']), ro()], 'i');
  m(B, 'top', 2, 'transport-belt', [rear(2, ['iron-plate']), ri(1, ['iron-gear-wheel']), ro()], 't');
  m(B, 'top', 3, 'firearm-magazine', [rear(0, ['iron-plate']), ro()], 'f');
  m(B, 'top', 4, 'military-science-pack', undefined, 'm');
  for (const i of [5, 6, 7]) m(B, 'top', i, 'grenade', [rear(0, ['iron-plate', 'coal']), rear(1, ['iron-plate', 'coal']), ro()], 'n');
  // Four logistic machines make exactly 30/min; the governor never asks for more (slot 4 stays empty).
  for (const i of [0, 1, 2, 3]) m(B, 'inside', i, 'logistic-science-pack', [ri(0), r2o()], 'l');
  for (const i of [6, 7]) m(B, 'inside', i, 'military-science-pack', [ri(0), r2o()], 'm');
  // B bottom row: shared zone (near belt brick | plastic, far belt copper | steel).
  for (const i of [0, 1, 2, 3]) m(B, 'bottom', i, 'automation-science-pack', [rear(0, ['copper-plate'], LONG), ri(1, ['iron-gear-wheel']), ro()], 'a');
  m(B, 'bottom', 4, 'military-science-pack', undefined, 'm');
  // One piercing-rounds machine makes exactly the 7.5/min military science takes (slot 6 stays empty).
  m(B, 'bottom', 5, 'piercing-rounds-magazine', [rear(0, ['copper-plate', 'steel-plate'], LONG), ri(1, ['firearm-magazine']), ro()], 'r');
  m(B, 'bottom', 7, 'stone-wall', [rear(0, ['stone-brick']), rear(1, ['stone-brick']), ro()], 'w');
  // A: gear and pipe from the iron rear lane, blue packs, engines on the far steel lane.
  m(A, 'top', 0, 'iron-gear-wheel', [rear(0, ['iron-plate']), ro()], 'g');
  m(A, 'top', 1, 'pipe', [rear(0, ['iron-plate']), ro()], 'p');
  for (const i of [2, 3, 4, 5, 6]) m(A, 'top', i, 'chemical-science-pack', undefined, 'c');
  // Eight chemical machines (five on top, three inside) make exactly 30/min.
  for (const i of [0, 1, 2]) m(A, 'inside', i, 'chemical-science-pack', [ri(0), r2o()], 'c');
  for (let i = 0; i < 7; i++) m(A, 'bottom', i, 'engine-unit', [ri(0, ['iron-gear-wheel', 'pipe']), rear(1, ['steel-plate'], LONG), ro()], 'e');
  const feeds = [
    admitWest(L, B, 'electronic-circuit', oy + 1),
    admitWest(L, B, 'sulfur', oy + 2),
  ];
  transfer(L, B, A, 'sulfur', oy + 1);
  transfer(L, B, A, 'automation-science-pack', oy + 2);
  transfer(L, B, A, 'logistic-science-pack', oy + 3);
  transfer(L, B, A, 'military-science-pack', oy + 4);
  feeds.push(...laneBelt(L, 'band-x-rear', -4 + G.bandXShift, G.eastX0 + G.eastW - 1, oy - 6, {north: 'iron-plate', south: 'coal'}, 'north+south', {}, G.topRearGaps));
  return {rings: [B, A], feeds};
}

// Shared rear zone between band X (above) and band Y (below).
export function sharedZone(L) {
  const y1 = G.xRingY + G.h + 6, y2 = y1 + 1, xe = G.eastX0 + G.eastW - 1;
  return [
    ...laneBelt(L, 'shared-near-x', -4 + G.feedShift, xe, y1, {north: 'stone-brick', south: 'plastic-bar'}, 'south-curve', {}, G.sharedGaps),
    ...laneBelt(L, 'shared-near-y', -6 + G.feedShift, xe, y2, {north: 'copper-plate', south: 'steel-plate'}, 'north+south', {}, G.sharedGaps),
  ];
}

export function bandY(L, raw) {
  const oy = G.yRingY;
  const Y1 = new Ring(L, {id: 'frames-processors', x0: G.westX0, y0: oy, w: G.westW, h: G.h,
    limits: {'iron-plate': 16, 'copper-plate': 12, 'steel-plate': 16, 'electronic-circuit': 24, 'plastic-bar': 16, 'advanced-circuit': 16, battery: 24, 'low-density-structure': 12,
      'flying-robot-frame': 8, 'engine-unit': 12, 'electric-engine-unit': 12, 'processing-unit': 12, 'iron-gear-wheel': 12, pipe: 16}});
  const Y2 = new Ring(L, {id: 'utility-production', x0: G.eastX0, y0: oy, w: G.eastW, h: G.h,
    limits: {'advanced-circuit': 32, 'productivity-module': 8, 'flying-robot-frame': 8, 'low-density-structure': 24, 'processing-unit': 12,
      'electric-furnace': 8, 'utility-science-pack': 12, 'production-science-pack': 12, 'iron-gear-wheel': 12, pipe: 16}});
  const m = (ring, row, slot, recipe, arms, glyph, direction) => machine(L, raw, ring, {row, slot, recipe, arms, glyph, direction});
  // Y1 top: two battery plants (acid pipes on the rear arm row), six LDS on the shared zone.
  for (const i of [0, 1]) m(Y1, 'top', i, 'battery', [ri(0, ['iron-plate', 'copper-plate']), ro()], 'b', 0);
  for (const i of [2, 5, 6, 7]) m(Y1, 'top', i, 'low-density-structure', [rear(0, ['copper-plate', 'steel-plate']), rear(1, ['plastic-bar'], LONG), ro()], 'd');
  // Slots 3 and 4 leave a window for a substation in the shared zone: one rear arm each, plastic from the ring.
  m(Y1, 'top', 3, 'low-density-structure', [rear(0, ['copper-plate', 'steel-plate']), ri(0, ['plastic-bar']), ro()], 'd');
  m(Y1, 'top', 4, 'low-density-structure', [rear(2, ['copper-plate', 'steel-plate']), ri(0, ['plastic-bar']), ro()], 'd');
  for (let i = 0; i < 5; i++) m(Y1, 'inside', i, 'flying-robot-frame', [ri(0), r2o()], 'r');
  for (const i of [5, 6, 7]) m(Y1, 'inside', i, 'engine-unit', [ri(0), r2o()], 'e');
  // Y1 bottom: electric engines (lubricant on the rear arm row) and processors
  // (circuits | advanced circuits rear belt D, acid through pipe-to-ground under D).
  for (const i of [0, 1, 2]) m(Y1, 'bottom', i, 'electric-engine-unit', [ri(0), ro()], 'u', 8);
  for (let i = 3; i < 8; i++) m(Y1, 'bottom', i, 'processing-unit', [rear(0, ['electronic-circuit'], BULK), ri(0, ['advanced-circuit']), ro()], 'x', 8);
  // Y2 top: furnaces and LDS on the shared zone.
  for (const i of [0, 1]) m(Y2, 'top', i, 'electric-furnace', [rear(0, ['steel-plate']), rear(1, ['stone-brick'], LONG), rear(2, ['stone-brick'], LONG), ri(0, ['advanced-circuit']), ro()], 'z');
  // Ten low-density machines in all (six on Y1, four here) make exactly the 30/min utility science takes.
  for (let i = 2; i < 6; i++) m(Y2, 'top', i, 'low-density-structure', [rear(0, ['copper-plate', 'steel-plate']), rear(1, ['plastic-bar'], LONG), ro()], 'd');
  for (const i of [0, 1, 2, 4, 5]) m(Y2, 'inside', i, 'utility-science-pack', [ri(0), r2o()], 'y');
  // Y2 bottom: production packs (rails from rear belt R1).
  for (let i = 0; i < 5; i++) m(Y2, 'bottom', i, 'production-science-pack', [ri(0, ['electric-furnace', 'productivity-module']), rear(2, ['rail'], BULK), ro()], 'q');
  if (!G.relayGearAndPipe) {
    m(Y2, 'bottom', 5, 'iron-gear-wheel', [rear(0, ['iron-plate']), ro()], 'g');
    m(Y2, 'bottom', 6, 'pipe', [rear(0, ['iron-plate']), ro()], 'p');
  }
  const feeds = [
    admitWest(L, Y1, 'iron-plate', oy + 1),
    admitWest(L, Y1, 'copper-plate', oy + 2),
    admitWest(L, Y1, 'steel-plate', oy + 3),
    admitWest(L, Y1, 'electronic-circuit', oy + 4),
    admitWest(L, Y1, 'plastic-bar', oy + 5),
  ];
  transfer(L, Y1, Y2, 'flying-robot-frame', oy + 1);
  transfer(L, Y1, Y2, 'low-density-structure', oy + 2);
  transfer(L, Y1, Y2, 'processing-unit', oy + 3);
  transfer(L, Y2, Y1, 'iron-gear-wheel', oy + 4);
  transfer(L, Y2, Y1, 'pipe', oy + 5);
  transfer(L, Y2, Y1, 'advanced-circuit', oy + 6);
  // Fluids: battery acid on Y1's top rear arm row, lubricant on Y1's bottom rear arm row,
  // processor acid through pipe-to-ground pairs under D to a header below.
  const pipes = {acid: [], lube: []};
  const geo = (row, i) => slotGeometry(Y1, row, i);
  for (let x = geo('top', 0).left; x <= geo('top', 1).left + 2; x++) pipes.acid.push(L.pipe(x, oy - 5, 'sulfuric-acid', {tags: {block: Y1.id}}));
  for (let x = geo('bottom', 0).cx; x <= geo('bottom', 2).cx; x++) pipes.lube.push(L.pipe(x, oy + G.h + 5, 'lubricant', {tags: {block: Y1.id}}));
  const dy = oy + G.h + 6, headerY = dy + 2;
  for (let i = 3; i < 8; i++) {
    const cx = geo('bottom', i).cx;
    L.tile('pipe-to-ground', cx, oy + G.h + 5, {direction: N, tags: {block: Y1.id, six_fluid: 'sulfuric-acid'}});
    L.tile('pipe-to-ground', cx, dy + 1, {direction: S, tags: {block: Y1.id, six_fluid: 'sulfuric-acid'}});
  }
  for (let x = geo('bottom', 3).cx; x <= geo('bottom', 7).cx; x++) pipes.acid.push(L.pipe(x, headerY, 'sulfuric-acid', {tags: {block: Y1.id}}));
  // D: circuits on both lanes for the processors. It starts at column 0 as a curve fed from the
  // north (the circuit tap comes down column 0), and its last tile turns north (dead end).
  const dEnd = geo('bottom', 7).left + 2;
  let dStart;
  for (let x = G.dStartX; x < dEnd; x++) { const b = L.belt(x, dy, E, {tags: {block: 'processor-circuits', lane: 'run'}}); dStart ??= b; }
  L.belt(dEnd, dy, N, {tags: {block: 'processor-circuits', lane: 'end'}});
  feeds.push({item: 'electronic-circuit', entry: dStart, approach: S, block: 'processor-circuits', lane: 'both', tapY: G.dTapY});
  // R1: rails for the production row (the iron lane that comes with them from the rail cell ends here
  // unused when gears and pipes are relayed). Its first tile is a curve fed from the south by the
  // rail belt (routed in generate.mjs), so both lanes keep their item.
  const r1x = dEnd + 1, r1 = [];
  const r1End = G.relayGearAndPipe ? slotGeometry(Y2, 'bottom', 4).left + 2 : slotGeometry(Y2, 'bottom', 6).left;
  for (let x = r1x; x <= r1End; x++) r1.push(L.belt(x, dy, E, {tags: {block: 'rails', lane: 'run'}}));
  // Rail cell in the south-west manifold corner: rail | stick | rail above the rail belt RB.
  // RB: iron side-loaded on its north lane at the west end, rails dropped on its south lane.
  const c = G.railCell, rb = c.beltY, my = rb - 3, iy = rb - 6;
  const tag = {tags: {block: 'rail-cell'}};
  L.machine(c.x + 1, my, 'rail', {tags: {block: 'rail-cell', glyph: 'R'}});
  L.machine(c.x + 5, my, 'iron-stick', {tags: {block: 'rail-cell', glyph: 'K'}});
  L.machine(c.x + 9, my, 'rail', {tags: {block: 'rail-cell', glyph: 'R'}});
  L.arm('fast-inserter', c.x + 3, my, E, {...filterOf(['iron-stick']), ...tag});
  L.arm('fast-inserter', c.x + 7, my, W, {...filterOf(['iron-stick']), ...tag});
  L.arm(BULK, c.x + 1, rb - 1, N, {...filterOf(['rail']), ...tag});
  L.arm(BULK, c.x + 10, rb - 1, N, {...filterOf(['rail']), ...tag});
  L.arm('fast-inserter', c.x + 5, rb - 1, S, {...filterOf(['iron-plate']), ...tag});
  for (const x of [c.x, c.x + 2, c.x + 8, c.x + 9]) L.arm('fast-inserter', x, my - 2, N, {...filterOf(['stone', 'steel-plate']), ...tag});
  // Input belt above the cell: stone on the south lane (curve column at c.x), steel on the north lane.
  feeds.push(...laneBelt(L, 'rail-inputs', c.x, c.x + 9, iy, {north: 'steel-plate', south: 'stone'}, 'south-curve-short'));
  const rbFeeds = laneBelt(L, 'rail-belt', c.x - 2, c.x + 10, rb, {north: 'iron-plate'});
  feeds.push(...rbFeeds);
  const railBelt = {from: L.at(c.x + 10, rb), to: r1[0]};
  return {rings: [Y1, Y2], feeds, pipes, railBelt};
}

// Export ring on the east edge: two belts wide, collects packs and carries
// advanced circuits and modules between the bank and the east rings.
export function exportRing(L, raw, rings) {
  const x0 = G.exportX, top = G.exportTop, bottom = G.exportBottom;
  const R = new Ring(L, {id: 'export', x0, y0: top, w: 1, h: bottom - top, counterClockwise: true,
    limits: {'advanced-circuit': 64, 'productivity-module': 8, 'automation-science-pack': 12, 'logistic-science-pack': 12,
      'military-science-pack': 12, 'chemical-science-pack': 12, 'production-science-pack': 12, 'utility-science-pack': 12,
      ...(G.relayGearAndPipe ? {'iron-gear-wheel': 8, pipe: 12} : {})}});
  const [, A, , Y2] = rings;
  const xy = G.xRingY, yy = G.yRingY;
  for (const [item, dy] of [['automation-science-pack', 1], ['logistic-science-pack', 2], ['military-science-pack', 3], ['chemical-science-pack', 4]]) transfer(L, A, R, item, xy + dy);
  transfer(L, R, A, 'advanced-circuit', xy + 5);
  transfer(L, Y2, R, 'production-science-pack', yy + 1);
  transfer(L, Y2, R, 'utility-science-pack', yy + 2);
  transfer(L, R, Y2, 'advanced-circuit', yy + 3, BULK);
  transfer(L, R, Y2, 'productivity-module', yy + 4);
  if (G.relayGearAndPipe) {
    // The blue ring's gear and pipe machines also make the 10 gears and 20 pipes a minute the engines on the
    // frames ring take; they ride the export ring down to the utility ring, which hands them west.
    transfer(L, A, R, 'iron-gear-wheel', xy);
    transfer(L, A, R, 'pipe', xy + G.h);
    transfer(L, R, Y2, 'iron-gear-wheel', yy);
    transfer(L, R, Y2, 'pipe', yy + 5);
  }
  // Six adjacent output chests, one stack each, filtered fast arms.
  const products = ['automation-science-pack', 'logistic-science-pack', 'military-science-pack', 'chemical-science-pack', 'production-science-pack', 'utility-science-pack'];
  const chests = products.map((item, j) => {
    const y = xy + 1 + j;
    const arm = L.arm('fast-inserter', x0 + 2, y, W, {...filterOf([item]), tags: {block: 'export', role: 'output', stock_item: item}});
    const chest = L.tile('passive-provider-chest', x0 + 3, y, {bar: 1, tags: {block: 'export', output: item}});
    return {item, chest, arm};
  });
  return {ring: R, chests};
}

// Controlled admission onto the export ring from a belt beside it.
export function admitExport(L, R, item, side, y, name = 'fast-inserter') {
  const x0 = R.x0;
  const armX = side === 'west' ? x0 - 1 : x0 + 2, beltX = side === 'west' ? x0 - 2 : x0 + 3;
  const belt = L.belt(beltX, y, side === 'west' ? E : W, {tags: {block: 'export', feed: item}});
  const arm = L.arm(name, armX, y, side === 'west' ? W : E, {...filterOf([item]), tags: {block: 'export', role: 'controlled-feed', stock_item: item}});
  R.limit(arm, item, R.at(side === 'west' ? x0 : x0 + 1, y));
  return {item, entry: belt, approach: side === 'west' ? E : S};
}
