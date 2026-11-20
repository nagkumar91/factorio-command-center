// Six-pack science generator (pure, reproducible). Usage:
//   FACTORIO_RAW=<dump> node scripts/six-science/generate.mjs [--draft]
// Writes blueprint-sources/six-science/{six-science.txt,manifest.json} unless --draft.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
import {optimizeUnderground} from '../rgby-science/underground.mjs';
import {routeFluid} from '../rgby-science/fluids.mjs';
import {Grid, N, E, S, W, STEP, filterOf, holdReader} from './grid.mjs';
import {bank} from './bank.mjs';
import {bandX, sharedZone, bandY, exportRing, admitExport, G} from './bands.mjs';
import {powerFiveLayout} from './power.mjs';
import {buryStraightRuns} from './bury.mjs';
import {calculateRequirements, machinesNeeded, PRODUCTS, SPEC_DEMAND} from './requirements.mjs';

const draft = process.argv.includes('--draft');
const bytes = await fs.readFile(process.env.FACTORIO_RAW), raw = JSON.parse(bytes);
raw.container = {...raw.container, ...raw['logistic-container']};
const sha = v => createHash('sha256').update(v).digest('hex');
const req = calculateRequirements(raw);
assert.deepEqual(req.externalPerMinute, SPEC_DEMAND, 'external demand differs from the spec table');

export const LAYOUT = {westEdge: -20, spineX: {'electronic-circuit': -6, 'copper-plate': -9, 'iron-plate': -12, 'steel-plate': -15, 'plastic-bar': -18}, headerTop: -1, headerStep: 2, maxY: 52, minY: -1, qLoader: {x: -5}, bankPowerGaps: [1, 6, 11, 15],
  singleRows: {'stone-brick': 26, coal: 14, sulfur: 21, stone: 45}, fluidRows: {'sulfuric-acid': 34, lubricant: 46},
  ...(process.env.SIX_LAYOUT ? JSON.parse(process.env.SIX_LAYOUT) : {})};
if (process.env.SIX_HOLES) G.holes = JSON.parse(process.env.SIX_HOLES);
if (process.env.SIX_G) Object.assign(G, JSON.parse(process.env.SIX_G));
const L = new Grid(raw);
const bk = bank(L, raw, 0, 0, {qShort: LAYOUT.qShort === true, qLoader: LAYOUT.qLoader || null, powerGaps: LAYOUT.bankPowerGaps || [], ...(LAYOUT.bankCWest !== undefined ? {cWest: LAYOUT.bankCWest} : {})});
G.holes = [...G.holes, ...bk.powerHoles];
const bx = bandX(L, raw);
const sz = sharedZone(L);
const by = bandY(L, raw);
const rings = [...bx.rings, ...by.rings];
const ex = exportRing(L, raw, rings);
const R = ex.ring;
// Q's advanced circuits drop onto the export ring's north-east corner.
const qArm = L.arm('fast-inserter', G.exportX + 1, G.exportTop - 1, N, {...filterOf(['advanced-circuit']), tags: {block: 'export', role: 'controlled-feed', stock_item: 'advanced-circuit'}});
R.limit(qArm, 'advanced-circuit', R.at(G.exportX + 1, G.exportTop));
const mFeed = admitExport(L, R, 'productivity-module', 'east', 14);
// S ends one tile west of the export ring's west column; a bulk arm admits its advanced circuits directly.
{
  const sx = Math.floor(bk.outputs.sAdvanced.position.x), sy = Math.floor(bk.outputs.sAdvanced.position.y);
  assert.equal(sx + 2, G.exportX, 'S must end two tiles west of the export ring');
  const a = L.arm('bulk-inserter', sx + 1, sy, W, {...filterOf(['advanced-circuit']), tags: {block: 'export', role: 'controlled-feed', stock_item: 'advanced-circuit'}});
  R.limit(a, 'advanced-circuit', R.at(G.exportX, sy));
}

const feeds = [...bk.feeds, ...bx.feeds, ...sz, ...by.feeds];
const rawFeeds = feeds;
const approachTile = f => { const [dx, dy] = STEP[f.approach]; return {x: Math.floor(f.entry.position.x) - dx, y: Math.floor(f.entry.position.y) - dy}; };
const key = (x, y) => x + ',' + y;

// Manifold: one entrance per material. Materials with several feed points get a
// southbound spine with priority splitter taps; the others enter on their own row.
const W0 = LAYOUT.westEdge;
const ports = [], taps = [];
const byItem = new Map();
for (const f of rawFeeds) { if (!byItem.has(f.item)) byItem.set(f.item, []); byItem.get(f.item).push(f); }
const spineItems = Object.keys(LAYOUT.spineX).sort((a, b) => LAYOUT.spineX[b] - LAYOUT.spineX[a]);
const entranceTiles = {};
for (const [i, item] of spineItems.entries()) {
  const xs = LAYOUT.spineX[item], yh = LAYOUT.headerTop + LAYOUT.headerStep * i, list = byItem.get(item);
  assert(list?.length >= 2, 'spine without taps ' + item);
  const wanted = list.map(f => ({f, y: f.tapY ?? approachTile(f).y})).sort((a, b) => a.y - b.y);
  const used = [];
  for (const w of wanted) {
    let row;
    for (let d = 0; d < 12 && row === undefined; d++) for (const y of d ? [w.y - d, w.y + d] : [w.y]) {
      if (y > yh + 1 && used.every(u => Math.abs(u - y) >= 2) && L.free(xs + 1, y)) { row = y; break; }
    }
    assert(row !== undefined, 'no tap row for ' + item + ' near ' + w.y);
    used.push(row); w.row = row;
  }
  wanted.sort((a, b) => a.row - b.row);
  const last = wanted.at(-1).row, splitRows = new Set(wanted.slice(0, -1).map(w => w.row - 1));
  const entry = L.belt(W0, yh, E, {tags: {block: 'manifold', entrance: item}});
  entranceTiles[item] = entry;
  for (let x = W0 + 1; x < xs; x++) L.belt(x, yh, E, {tags: {block: 'manifold', header: item}});
  L.belt(xs, yh, S, {tags: {block: 'manifold', spine: item}});
  for (let y = yh + 1; y <= last; y++) {
    if (splitRows.has(y)) L.splitter(xs, y, S, {output_priority: 'left', tags: {block: 'manifold', tap: item}});
    else if (!(L.at(xs, y))) L.belt(xs, y, S, {tags: {block: 'manifold', spine: item}});
  }
  for (const w of wanted) {
    const start = w.row === last ? L.at(xs, last) : L.belt(xs + 1, w.row, E, {tags: {block: 'manifold', tap: item}});
    taps.push({item, f: w.f, start, startDirection: E});
  }
}
// Single-consumer materials: entrance on a row of their own, routed to the feed.
const singleRows = LAYOUT.singleRows || {'stone-brick': 30, coal: 14, sulfur: 21, stone: 55};
for (const [item, list] of byItem) {
  if (spineItems.includes(item)) continue;
  assert.equal(list.length, 1, item + ' has several feeds but no spine');
  const y = singleRows[item];
  const entry = L.belt(W0, y, E, {tags: {block: 'manifold', entrance: item}});
  entranceTiles[item] = entry;
  taps.push({item, f: list[0], start: entry, startDirection: E});
}

// Tiles that must stay open: every feed's approach tile, three tiles west of every
// entrance and three tiles east of every chest.
const fluidRows = LAYOUT.fluidRows || {'sulfuric-acid': 34, lubricant: 48};
const powerCells = new Set();
for (const [hx, hy] of G.holes) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { assert(L.free(hx + dx, hy + dy), 'hole occupied ' + hx + ',' + hy); powerCells.add(key(hx + dx, hy + dy)); }
for (const g of G.topRearGaps) for (const dy of [0, 1]) for (const dx of [0, 1]) powerCells.add(key(g + dx, G.xRingY - 6 + dy));
for (const g of G.sharedGaps) for (const dy of [0, 1]) for (const dx of [0, 1]) powerCells.add(key(g + dx, G.xRingY + G.h + 6 + dy));
const reservedFor = target => {
  const s = new Set();
  for (const f of feeds) if (f !== target) { const a = approachTile(f); s.add(key(a.x, a.y)); }
  for (const e of Object.values(entranceTiles)) for (let k = 1; k <= 3; k++) s.add(key(Math.floor(e.position.x) - k, Math.floor(e.position.y)));
  for (const c of ex.chests) for (let k = 1; k <= 3; k++) s.add(key(Math.floor(c.chest.position.x) + k, Math.floor(c.chest.position.y)));
  for (const k of powerCells) s.add(k);
  for (const y of Object.values(fluidRows)) for (let k = 0; k <= 2; k++) s.add(key(W0 + k, y));
  return s;
};
const routeOptions = {minX: W0, maxX: G.exportX + 3, minY: LAYOUT.minY, maxY: LAYOUT.maxY};
const routeLog = [];
function connect(start, f, label, startDirection) {
  const target = {x: f.entry.position.x, y: f.entry.position.y};
  try {
    const plan = L.route({x: start.position.x, y: start.position.y}, target, {...routeOptions, blocked: reservedFor(f), endDirection: f.approach, ...(startDirection !== undefined ? {startDirection} : {})});
    routeLog.push({label, tiles: plan.length});
  } catch (e) {
    console.error('route failed', label, JSON.stringify(start.position), '->', JSON.stringify(target), f.approach);
    if (draft) { console.log(L.render()); }
    throw e;
  }
}
// Internal transport first: bank to export ring, export ring to processors.
// Module lane continues straight down the east edge to the export ring; every tile reads into the lane count.
{
  const tiles = bk.moduleLane.tiles, mx = Math.floor(bk.outputs.modules.position.x), my = Math.floor(bk.outputs.modules.position.y);
  const path = [L.belt(mx + 1, my, E, {control_behavior: {...holdReader}, tags: {block: 'bank', lane: 'modules'}})];
  for (let y = my; y < Math.floor(mFeed.entry.position.y); y++) path.push(L.belt(mx + 2, y, S, {control_behavior: {...holdReader}, tags: {block: 'bank', lane: 'modules'}}));
  L.wire(tiles.at(-1), path[0]);
  for (let i = 1; i < path.length; i++) L.wire(path[i - 1], path[i]);
  tiles.push(...path);
}
// Rail belt: from the rail cell in the south-west corner to the curve at the west end of R1.
{
  const {from, to} = by.railBelt;
  const plan = L.route({x: from.position.x, y: from.position.y}, {x: to.position.x, y: to.position.y}, {...routeOptions, blocked: reservedFor(null), startDirection: E, endDirection: N});
  routeLog.push({label: 'rail belt', tiles: plan.length});
}
for (const t of taps.sort((a, b) => Number(spineItems.includes(a.item)) - Number(spineItems.includes(b.item)) || Math.floor(b.start.position.x) - Math.floor(a.start.position.x) || a.f.entry.position.y - b.f.entry.position.y))
  connect(t.start, t.f, `${t.item} -> ${t.f.block}/${t.f.lane || 'feed'}`, t.startDirection);

// Fluids: one west entrance each, routed to the block pipes.
const fluidPorts = {};
for (const e of L.entities) if (e.tags?.six_fluid) e.tags.rgby_fluid = e.tags.six_fluid;
for (const [fluid, y] of Object.entries(fluidRows)) {
  const p = L.pipe(W0, y, fluid, {tags: {block: 'manifold', entrance: fluid, rgby_fluid: fluid, rgby_manifold: true}});
  fluidPorts[fluid] = p;
  entranceTiles[fluid] = p;
  const targets = fluid === 'lubricant' ? [by.pipes.lube[0]] : [by.pipes.acid[0], by.pipes.acid.find(q => q.position.y > G.yRingY)];
  for (const t of targets) {
    try { routeFluid(L, fluid, p.position, t.position, {minX: W0, maxX: G.exportX, minY: LAYOUT.minY, maxY: LAYOUT.maxY, blocked: reservedFor(null)}); }
    catch (e) { if (draft) await fs.writeFile('.cache/six-science/draft-map.txt', L.render() + '\n'); throw e; }
  }
}

// Display panels beside every entrance (never on the entrance row west of it).
const perMinute = v => Math.round(v * 10) / 10;
for (const [item, e] of Object.entries(entranceTiles)) {
  const ex0 = Math.floor(e.position.x), ey = Math.floor(e.position.y);
  let panel;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, -1], [1, 1], [2, -1], [2, 1], [0, -2], [0, 2], [3, -1], [3, 1]]) {
    if (L.free(ex0 + dx, ey + dy)) {
      const fluid = item === 'sulfuric-acid' || item === 'lubricant';
      panel = L.tile('display-panel', ex0 + dx, ey + dy, {icon: {type: fluid ? 'fluid' : 'item', name: item}, text: `IN: ${item}\nWEST · ${perMinute(req.externalPerMinute[item])}/min at nominal target`, always_show: true, tags: {block: 'manifold', label: item}});
      break;
    }
  }
  assert(panel, 'no panel space for ' + item);
  const fluid = item === 'sulfuric-acid' || item === 'lubricant';
  ports.push({kind: fluid ? 'fluid' : 'input', label: item, item, items: [item], entity: e.entity_number, x: e.position.x, y: e.position.y, position: {...e.position},
    externalSide: 'west', ...(fluid ? {} : {direction: E}), perMinute: req.externalPerMinute[item], displayEntity: panel.entity_number});
}
for (const c of ex.chests) ports.push({kind: 'output', label: c.item, item: c.item, items: [c.item], entity: c.chest.entity_number, x: c.chest.position.x, y: c.chest.position.y, position: {...c.chest.position}, externalSide: 'east', cap: 200});

// Power: substations only inside the production rectangle.
const before = starterBounds(L.entities, raw);
const powerPort = {kind: 'power', label: 'External electricity', items: [], entity: 0, x: W0 + 2, y: LAYOUT.headerTop + 6};
const fixed = [...G.holes.map(([hx, hy]) => [hx + 1, hy + 1]),
  ...G.topRearGaps.map(g => [g + 1, G.xRingY - 5]), ...G.sharedGaps.map(g => [g + 1, G.xRingY + G.h + 7]),
  ...G.insideHoles.map(([id, slot]) => { const r = [...rings].find(r => r.id === id); return [r.x0 + 2 + 3 * slot, r.y0 + 3]; })];
const powerReport = {};
const power = powerFiveLayout(L, [...ports, powerPort], raw, {bounds: before, fixed, report: powerReport});
if (powerReport.uncoveredAfterFixed.length) console.error('not covered by planned substations:', JSON.stringify(powerReport.uncoveredAfterFixed));
const after = starterBounds(L.entities, raw);
assert.deepEqual(after, before, 'power grew the footprint');

for (const e of L.entities) e.tags = {...e.tags, flight_science_entity: e.entity_number};
const allPorts = [...ports, powerPort];
const bp = {item: 'blueprint', version: 562954249961472, label: 'Six-pack science · 30/min each',
  description: 'Makes automation, logistic, military, chemical, production and utility science packs at 30/min each from supplied iron, copper, steel, stone brick, stone, coal, plastic, sulfur, electronic circuits, sulfuric acid and lubricant (all entrances on the west, one per material, each labelled). Six passive provider chests on the east hold 200 of each pack. Advanced circuits, engines, frames, processors, low-density structures, rails, furnaces and modules are made inside. Keep every belt reader, red wire and inserter condition; they cap the stock on each ring.',
  icons: PRODUCTS.slice(0, 4).map((name, i) => ({index: i + 1, signal: {type: 'item', name}})), entities: L.entities, wires: L.wires};
const underground = optimizeUnderground(bp, allPorts);
assert(!underground.aborted, 'underground optimizer aborted: ' + underground.aborted);
// Second pass: bury straight runs the shared optimizer leaves because they sit next to an underground or splitter.
const buried = buryStraightRuns(bp, allPorts);
const footprint = starterBounds(bp.entities, raw);
const code = encodeBlueprint({blueprint: bp});

const machineCounts = {};
for (const e of bp.entities) if (e.recipe) machineCounts[e.recipe] = (machineCounts[e.recipe] || 0) + 1;
const construction = {};
for (const e of bp.entities) construction[e.name] = (construction[e.name] || 0) + 1;
const loopControl = [...rings, R].map(r => r.record());
const summary = {footprint, area: footprint.width * footprint.height, machines: Object.values(machineCounts).reduce((a, b) => a + b, 0), entities: bp.entities.length,
  power: {substations: power.substations, mediumPoles: power.mediumPoles}, underground: underground.saved, buried, sha: sha(code)};
console.log(JSON.stringify(summary));
if (draft) console.log(routeLog.sort((a, b) => b.tiles - a.tiles).slice(0, 14).map(r => r.label + ' ' + r.tiles).join('\n'));
await fs.mkdir('.cache/six-science', {recursive: true});
if (draft) { await fs.writeFile('.cache/six-science/draft-map.txt', L.render() + '\n'); process.exit(0); }

const dir = 'blueprint-sources/six-science';
await fs.mkdir(dir, {recursive: true});
const id = 'six-science';
// Status follows the published evidence: qualified only when the existing report passed for this exact string.
let status = 'candidate-native-validation-pending';
try {
  const r = JSON.parse(await fs.readFile(dir + '/native-report.json'));
  if (r.passed === true && r.short !== true && r.builds?.find(b => b.id === id)?.passed === true && r.builds.find(b => b.id === id).blueprintSha256 === sha(code)) status = 'qualified';
} catch {}
const manifest = {
  id, name: bp.label, file: id + '.txt', blueprintSha256: sha(code), prototypeSha256: sha(bytes), class: 'rate', status,
  products: PRODUCTS, targets: Object.fromEntries(PRODUCTS.map(p => [p, 30])), outputCaps: Object.fromEntries(PRODUCTS.map(p => [p, 200])),
  recipeAudit: {externalPerMinute: req.externalPerMinute, craftsPerMinute: req.craftsPerMinute, recipeIngredients: req.recipeIngredients, machinesExact: machinesNeeded(raw, req)},
  inputs: allPorts.filter(p => p.kind === 'input'), fluids: allPorts.filter(p => p.kind === 'fluid'), outputs: allPorts.filter(p => p.kind === 'output'), ports: allPorts,
  machineCounts, footprint, areaGoal: {goalTiles: 4400, stretchTiles: 3600, fallbackTiles: 6600, achievedTiles: footprint.width * footprint.height},
  loopControl,
  laneControl: [{name: 'module-lane', readerMode: 'per-tile-hold', tiles: bk.moduleLane.tiles.map(e => e.entity_number), controlled: bk.moduleLane.arms, limits: {'productivity-module': bk.moduleLane.cap},
    note: 'Module output arms run only while the module lane holds fewer than the cap; the lane is a dead-end single-item belt, not a ring.'}],
  stockControl: {mode: 'bar', bar: 1, chests: ex.chests.map(c => ({item: c.item, chest: c.chest.entity_number, arm: c.arm.entity_number}))},
  protocol: {warmupMinutes: 15, measureMinutes: 30, blockedMinutes: 10, settleMinutes: 5, recoveryMinutes: 10},
  construction, underground: {saved: underground.saved, pairs: underground.pairs.length, straightRunsSaved: buried.saved, straightRunsPairs: buried.pairs},
  power: {substations: power.substations, mediumPoles: power.mediumPoles, dock: power.dock},
  greenCircuitSupply: {perMinute: req.externalPerMinute['electronic-circuit'], copiesOfGreenCircuits: Math.ceil(req.externalPerMinute['electronic-circuit'] / 360)},
  setupNotes: [bp.description, 'Supply both lanes of every west entrance belt; the copper entrance carries 1,035/min.',
    `Needs ${req.externalPerMinute['electronic-circuit']} electronic circuits per minute: ${Math.ceil(req.externalPerMinute['electronic-circuit'] / 360)} copies of the green-circuits supplier (360/min each).`,
    'Power enters at the marked substation; one electric network.',
    "Plan supply for the measured draw, not the entrance panels: the panels are recipe totals at 30/min, and packs early on the shared spines run above target and take material first. Exploration measurements (full-length runs with a throttled-feed copy of the harness, not part of the qualification): with every entrance fed at exactly its panel figure, production science made 16.6/min and utility 24.0/min against 30, with 7 machines idle; at 1.05x the panels production made 19.5/min, at 1.10x 23.1/min, and at 1.15x every pack held its target. Fed at the measured draw (about 966 electronic circuits, 1,105 copper, 661 iron, 389 steel, 550 plastic, 274 stone brick, 169 coal, 158 stone, 15.8 sulfur, 557 sulfuric acid and 169 lubricant per minute, 5 to 13% above the panels) every pack held its target. Circuits alone limited to 1,080/min (three green-circuits copies) with every other entrance unlimited also passed."],
};
await fs.writeFile(dir + '/' + manifest.file, code + '\n');
await fs.writeFile(dir + '/manifest.json', JSON.stringify([manifest], null, 2) + '\n');
await fs.writeFile('.cache/six-science/map.txt', L.render() + '\n');
