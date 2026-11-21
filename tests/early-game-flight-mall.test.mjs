// Early Flight science and red-belt mall (blueprint-sources/early-game/early-flight-science-mall.*): manifest, string,
// pole wires, ports, cell packing, native report, README claims and generator. Adapted from the early-flight-seven
// unit test. Runs without the prototype dump and without the game; only the prototype-constant check reads the dump,
// and skips without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {derivePorts, footprint, tilesOf} from '../scripts/early-game/ports.mjs';
import {floors, wireReach, supplyDistance, tunnelReach, poleWires, unsupplied, crossings, history, layout, rebuild} from '../scripts/early-game/generate.mjs';
import {protocol} from '../scripts/early-game/protocol.mjs';

const root = new URL('../', import.meta.url), rootPath = fileURLToPath(root);
const dir = 'blueprint-sources/early-game/';
const read = p => fs.readFile(new URL(p, root), 'utf8');
const hash = s => createHash('sha256').update(s).digest('hex');
const manifest = JSON.parse(await read(dir + 'early-flight-science-mall.json'));
const code = (await read(dir + manifest.blueprintFile)).trim(), bp = decodeBlueprint(code).blueprint;
const oldCode = (await read(`${dir}${history}/early-flight-science-mall.txt`)).trim(), old = decodeBlueprint(oldCode).blueprint;
const oldManifest = JSON.parse(await read(`${dir}${history}/early-flight-science-mall.json`));
const allowed = new Set(['assembling-machine-1', 'steel-furnace', 'transport-belt', 'underground-belt', 'splitter', 'inserter', 'medium-electric-pole', 'big-electric-pole', 'wooden-chest', 'display-panel']);
const isPole = e => e.name === 'medium-electric-pole' || e.name === 'big-electric-pole';
const production = e => !isPole(e) && !(e.name === 'display-panel' && /^P · /.test(e.text || ''));
const shape = e => JSON.stringify([e.name, e.direction || 0, e.recipe || null, e.type || null, e.bar ?? null, e.text || null]);

test('manifest matches the string: SHA-256, footprint, counts, ports', () => {
  assert.equal(manifest.sha256, hash(code));
  assert.equal(manifest.blueprintSha256, manifest.sha256);
  const ports = derivePorts(bp, manifest.outputs);
  assert.deepEqual(manifest.footprint, ports.footprint);
  assert.deepEqual(manifest.footprint, [32, 235]);
  assert.equal(manifest.tiles, 32 * 235);
  assert.equal(manifest.entities, bp.entities.length);
  const counts = {};
  for (const e of bp.entities) counts[e.name] = (counts[e.name] || 0) + 1;
  assert.deepEqual(manifest.entityCounts, counts);
  // Same machines as the published version: only poles, the P panel and 15 feed-belt tiles changed in number.
  for (const name of ['assembling-machine-1', 'steel-furnace', 'inserter', 'splitter', 'underground-belt', 'wooden-chest', 'medium-electric-pole']) assert.equal(counts[name], oldManifest.entityCounts[name], name);
  assert.equal(counts['transport-belt'], oldManifest.entityCounts['transport-belt'] - 3 * layout.logisticShift);
  assert.equal(manifest.previous.sha256, hash(oldCode));
  assert.equal(oldManifest.sha256, hash(oldCode));
});

test('at least 5% fewer tiles than the version it replaces, with the same products and raw inputs', () => {
  const was = footprint(old.entities);
  assert.deepEqual([was.width, was.height], [37, 277]);
  assert.deepEqual(manifest.previous.footprint, [37, 277]);
  assert.ok(manifest.tiles <= 0.95 * was.tiles, `${manifest.tiles} vs ${was.tiles}`);
  assert.deepEqual(manifest.outputs, oldManifest.outputs);
  assert.deepEqual(manifest.rawInputs, oldManifest.rawInputs);
  assert.deepEqual(manifest.equipment, oldManifest.equipment);
});

test('only the early tiers: AM1, steel furnaces, yellow belts, plain inserters, wooden chests; no modules', () => {
  for (const e of bp.entities) {
    assert.ok(allowed.has(e.name), e.name);
    assert.equal(e.items, undefined, e.name + ' carries modules or items');
  }
});

test('no two entities share a tile, and every entity sits on the tile grid of the string', () => {
  const seen = new Set(), half = v => Math.abs(v % 1) === 0.5;
  for (const e of bp.entities) {
    const [x0, y0, x1, y1] = tilesOf(e);
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) { const k = x + ',' + y; assert.ok(!seen.has(k), `overlap at ${k} (${e.name})`); seen.add(k); }
    // One-tile entities on whole numbers, two-by-two ones on halves, three-by-three on whole numbers.
    if (e.name === 'splitter') continue;
    const even = e.name === 'steel-furnace' || e.name === 'big-electric-pole';
    assert.equal(half(e.position.x), even, `${e.name} ${e.position.x}`);
    assert.equal(half(e.position.y), even, `${e.name} ${e.position.y}`);
  }
  // The published version had 23 trunk big poles and its P panel off this grid.
  const offGrid = old.entities.filter(e => (e.name === 'big-electric-pole' && !(half(e.position.x) && half(e.position.y))) || (e.name === 'display-panel' && (half(e.position.x) || half(e.position.y))));
  assert.equal(offGrid.length, 24);
});

test('pole wires travel in the string: a spanning tree over every pole, within copper reach, between entities that exist', () => {
  const byNumber = new Map(bp.entities.map(e => [e.entity_number, e])), poles = bp.entities.filter(isPole);
  assert.ok(bp.entities.every(e => e.neighbours === undefined), 'still carries 1.1 neighbours');
  assert.ok(old.wires === undefined && old.entities.filter(e => e.neighbours).length === 31, 'the published version carried only 1.1 neighbours');
  assert.equal(bp.wires.length, poles.length - 1);
  const parent = new Map(poles.map(p => [p.entity_number, p.entity_number]));
  const find = n => { while (parent.get(n) !== n) n = parent.get(n); return n; };
  for (const [a, ca, b, cb] of bp.wires) {
    const pa = byNumber.get(a), pb = byNumber.get(b);
    assert.ok(pa && pb && isPole(pa) && isPole(pb), `wire ${a}-${b} names a missing or non-pole entity`);
    assert.equal(ca, 5); assert.equal(cb, 5);
    assert.ok(Math.hypot(pa.position.x - pb.position.x, pa.position.y - pb.position.y) <= Math.min(wireReach[pa.name], wireReach[pb.name]), `wire ${a}-${b} too long`);
    parent.set(find(a), find(b));
  }
  assert.equal(new Set(poles.map(p => find(p.entity_number))).size, 1, 'poles form more than one network');
  assert.deepEqual(bp.wires, poleWires(bp.entities).wires);
  assert.deepEqual(unsupplied(bp.entities), [], 'an assembler or inserter outside every supply area');
  assert.equal(manifest.power.copperWires, bp.wires.length);
  assert.equal(manifest.power.linkPoles, bp.entities.filter(e => e.tags?.flight_mall_power_trunk).length);
});

test('22 inlets on the west edge in the published order; eight one-stack product chests; science chests on one row; labelled grid pole', () => {
  const ports = derivePorts(bp, manifest.outputs), was = derivePorts(old, manifest.outputs);
  assert.equal(ports.inputs.length, 22);
  assert.ok(ports.inputs.every(p => p.side === 'west'));
  assert.deepEqual(ports.inputs.map(p => p.letter + ' ' + p.item), was.inputs.map(p => p.letter + ' ' + p.item));
  assert.deepEqual(manifest.inputPorts, ports.inputs.map(p => ({letter: p.letter, item: p.item, side: p.side, row: p.row})));
  assert.deepEqual(ports.outputs.map(p => p.item), manifest.outputs);
  assert.ok(ports.outputs.every(p => p.bar === 1), 'chest not limited to one stack');
  // Outputs keep their north-to-south order too.
  const order = ps => [...ps].sort((a, b) => a.row - b.row || a.column - b.column).map(p => p.item);
  assert.deepEqual(order(ports.outputs), order(was.outputs));
  const science = ports.outputs.filter(p => p.item.endsWith('science-pack'));
  assert.equal(science[0].row, science[1].row);
  const panel = bp.entities.find(e => e.name === 'display-panel' && /^P · /.test(e.text));
  assert.ok(Math.hypot(panel.position.x - ports.power.position.x, panel.position.y - ports.power.position.y) < 2);
  assert.equal(tilesOf(panel)[1], ports.origin[1], 'P panel on the top row');
});

// Cells of a string, read independently of the generator: bands of occupied rows, and the science band split into
// the automation cell (west, south of row -12) and the logistic cell with its feed belts and panels.
function cellsOf(entities) {
  const rows = new Set();
  for (const e of entities.filter(production)) { const [, y0, , y1] = tilesOf(e); for (let y = y0; y < y1; y++) rows.add(y); }
  const sorted = [...rows].sort((a, b) => a - b), bands = [];
  for (const y of sorted) { const last = bands.at(-1); if (last && y === last[1]) last[1] = y + 1; else bands.push([y, y + 1]); }
  return {bands, cellOf: e => { const [x0, y0] = tilesOf(e), i = bands.findIndex(([a, b]) => y0 >= a && y0 < b); return i > 0 ? 'item ' + i : (e.tags?.flight_mall_raw_feed || x0 >= 18 || y0 < -12 ? 'logistic' : 'automation'); }};
}

// Each published cell and the offset that carries it onto the new string (found from the cell's first assembler).
function placeCells() {
  const {bands, cellOf} = cellsOf(old.entities);
  const now = bp.entities.filter(production), key = e => shape(e) + '@' + e.position.x + ',' + e.position.y;
  const nowByKey = new Map(now.map(e => [key(e), e])), groups = new Map();
  for (const e of old.entities.filter(production)) { const c = cellOf(e); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(e); }
  // The logistic cell's inlet panels and feed belts stay at the west edge while the cell moves.
  const fixed = e => e.tags?.flight_mall_raw_feed || (e.name === 'display-panel' && tilesOf(e)[0] === 0 && tilesOf(e)[1] < -12);
  const placed = new Map(), cellOfNew = new Map();
  for (const [cell, list] of groups) {
    const anchor = list.find(e => e.name === 'assembling-machine-1');
    const offsets = now.filter(e => e.name === anchor.name && e.recipe === anchor.recipe).map(t => [t.position.x - anchor.position.x, t.position.y - anchor.position.y]);
    const fits = ([dx, dy]) => list.filter(e => !fixed(e)).every(e => nowByKey.has(key({...e, position: {x: e.position.x + dx, y: e.position.y + dy}})));
    const offset = offsets.find(fits);
    placed.set(cell, {list, offset});
    if (!offset) continue;
    for (const e of list) {
      const moved = fixed(e) ? e : {...e, position: {x: e.position.x + offset[0], y: e.position.y + offset[1]}}, twin = nowByKey.get(key(moved));
      if (twin) cellOfNew.set(twin.entity_number, cell);
    }
  }
  return {bands, placed, cellOfNew, now};
}

test('every cell is the published cell moved as one piece; only the logistic feed belts are shorter', () => {
  const {bands, placed, cellOfNew, now} = placeCells();
  assert.equal(bands.length, 7, 'the published version has seven bands of cells');
  assert.equal(placed.size, 8);
  let feedLost = 0, previousBottom = null;
  for (const [cell, {list, offset}] of placed) {
    assert.ok(offset, cell + ' did not move as one piece');
    assert.equal(offset[0], cell === 'logistic' ? -layout.logisticShift : 0, cell);
    feedLost += list.length - [...cellOfNew.values()].filter(c => c === cell).length;
  }
  assert.equal(feedLost, 3 * layout.logisticShift);
  assert.equal(cellOfNew.size, now.length, 'an entity of the new string belongs to no published cell');
  // Item cells keep their north-to-south order and stand directly below one another.
  for (let i = 1; i <= 6; i++) {
    const tiles = [...cellOfNew].filter(([, c]) => c === 'item ' + i).map(([n]) => tilesOf(bp.entities.find(e => e.entity_number === n)));
    const top = Math.min(...tiles.map(t => t[1])), bottom = Math.max(...tiles.map(t => t[3]));
    if (previousBottom !== null) assert.equal(top, previousBottom + layout.cellGap, 'item ' + i);
    previousBottom = bottom;
  }
  assert.equal(bp.label, old.label);
  assert.deepEqual(bp.icons, old.icons);
});

test('cells stand side by side without acting on one another, and the check sees a real crossing', () => {
  const {cellOfNew} = placeCells();
  assert.deepEqual(crossings(bp.entities, cellOfNew), []);
  // Synthetic: an inserter of cell a that takes from a chest of cell b.
  const a = {entity_number: 1, name: 'inserter', position: {x: 0, y: 0}, direction: 0}, b = {entity_number: 2, name: 'wooden-chest', position: {x: 0, y: -1}};
  assert.equal(crossings([a, b], new Map([[1, 'a'], [2, 'b']])).length, 1);
  // Synthetic: an underground entrance of cell a facing an exit of cell b within tunnel reach.
  const u = {entity_number: 3, name: 'underground-belt', type: 'input', position: {x: 0, y: 0}, direction: 8}, v = {entity_number: 4, name: 'underground-belt', type: 'output', position: {x: 0, y: tunnelReach}, direction: 8};
  assert.ok(crossings([u, v], new Map([[3, 'a'], [4, 'b']])).length >= 1);
});

test('native report: full protocol passed for this exact SHA-256, floors met, every inlet stopped while blocked', async () => {
  const report = JSON.parse(await read(dir + manifest.nativeReport));
  assert.equal(report.passed, true);
  assert.equal(report.gameVersion, '2.1.24');
  const {phasesRun, ...declared} = report.protocol;
  assert.deepEqual(declared, protocol);
  assert.deepEqual(phasesRun, {warmupMinutes: 240, measureMinutes: 60, blockedMinutes: 180, settleMinutes: 10, recoveryMinutes: 60});
  assert.equal(report.builds.length, 1);
  const b = report.builds[0];
  assert.equal(b.blueprintSha256, manifest.sha256);
  assert.equal(b.passed, true);
  assert.deepEqual(b.failures, []);
  for (const k of ['unpowered', 'lostGhosts', 'displaced']) assert.equal(Object.keys(b[k] || {}).length, 0, k);
  assert.equal(b.substitutePowerPole, false);
  assert.deepEqual([b.boundingTiles.width, b.boundingTiles.height], manifest.footprint);
  assert.equal(manifest.status, 'native-verified');
  assert.deepEqual(manifest.minimumPerMinute, floors);
  assert.deepEqual(Object.keys(floors).sort(), [...manifest.outputs].sort());
  for (const [item, floor] of Object.entries(floors)) {
    assert.ok(b.outputsPerMinute[item] >= floor, `${item} ${b.outputsPerMinute[item]} < ${floor}`);
    assert.ok(b.recovery.outputsPerMinute[item] >= protocol.recoveryShare * floor, item + ' recovery');
    assert.equal(manifest.measuredPerMinute[item], Math.round(b.outputsPerMinute[item] * 1000) / 1000);
  }
  assert.equal(b.inputs.length, 22);
  assert.ok(b.inputs.every(p => p.acceptedDuringMeasurement > 0));
  assert.ok(b.hold.acceptedInTail.every(p => p.count === 0), 'still drew material while blocked');
  assert.equal(Object.keys(b.hold.tailCrafts || {}).length, 0);
  assert.equal(b.machines.length, 49);
  assert.ok(b.machines.every(x => x.measuredCrafts > 0), 'idle machine');
});

test('published claims: the README carries the manifest size, counts and measured rates, and no stale claim', async () => {
  const readme = await read(dir + 'early-flight-science-mall.md'), c = manifest.entityCounts;
  assert.ok(readme.includes(`${manifest.footprint[0]} × ${manifest.footprint[1]} tiles (${manifest.tiles} tiles)`));
  for (const [n, what] of [[c['assembling-machine-1'], 'assembling machine 1s'], [c['steel-furnace'], 'steel furnaces'], [c['transport-belt'], 'yellow belts'], [c['underground-belt'], 'underground-belt endpoints'], [c['splitter'], 'yellow splitters'], [c['wooden-chest'], 'one-stack wooden output chests'], [c['big-electric-pole'], 'big and'], [c['medium-electric-pole'], 'medium electric poles']]) assert.ok(readme.includes(`${n} ${what}`), what);
  for (const v of Object.values(manifest.measuredPerMinute)) assert.ok(readme.includes(v.toFixed(2)));
  assert.ok(!/rates are intentionally not claimed|has not had a native combined production test|grouped along the east edge|internal big-pole trunk/.test(readme));
  assert.ok(!/internal big-pole trunk links all cells/.test(bp.description));
  assert.equal((await read(`${dir}${history}/NOTE.md`)).trim().split('\n').length, 1);
});

test('generator re-run reproduces the files byte for byte, without the game or the dump', async () => {
  const out = `.cache/early-flight-science-mall/test-regenerate-${process.pid}`;
  await fs.rm(new URL(out, root), {recursive: true, force: true});
  await promisify(execFile)(process.execPath, ['scripts/early-game/generate.mjs', '--out', out], {cwd: rootPath});
  for (const f of ['early-flight-science-mall.txt', 'early-flight-science-mall.json', 'early-flight-science-mall.md'])
    assert.equal(await read(`${out}/${f}`), await read(dir + f), f);
  // The generator keeps the committed string only when it decodes to exactly the rebuilt blueprint; prove that directly.
  const {blueprint} = rebuild((await read(`${dir}${history}/early-flight-science-mall.txt`)).trim());
  assert.deepEqual(decodeBlueprint(await read(dir + 'early-flight-science-mall.txt')), {blueprint}, 'committed string decodes to the generated blueprint');
  await fs.rm(new URL(out, root), {recursive: true, force: true});
});

test('pole and tunnel constants equal the 2.1.24 prototypes', async t => {
  const rawPath = process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
  let raw;
  try { raw = JSON.parse(await fs.readFile(rawPath, 'utf8')); } catch { t.skip('Pinned local prototype dump is not readable here (set FACTORIO_RAW)'); return; }
  for (const [name, reach] of Object.entries(wireReach)) assert.equal(raw['electric-pole'][name].maximum_wire_distance, reach, name);
  for (const [name, d] of Object.entries(supplyDistance)) assert.equal(raw['electric-pole'][name].supply_area_distance, d, name);
  assert.equal(raw['underground-belt']['underground-belt'].max_distance, tunnelReach);
});
