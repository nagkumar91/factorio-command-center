// early-flight-seven: the seven early AM1 workshops. Manifest, strings, pole wires, ports, native report and generator.
// Runs without the prototype dump and without the game; only the wire-reach check reads the dump, and skips without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {derivePorts, footprint, tilesOf} from '../scripts/early-flight-seven/ports.mjs';
import {designs, floors, wireReach, poleWires, scienceCompaction} from '../scripts/early-flight-seven/generate.mjs';
import {protocol} from '../scripts/early-flight-seven/protocol.mjs';

const root = new URL('../', import.meta.url), rootPath = fileURLToPath(root);
const dir = 'blueprint-sources/early-flight-seven/';
const read = p => fs.readFile(new URL(p, root), 'utf8');
const hash = s => createHash('sha256').update(s).digest('hex');
const manifest = JSON.parse(await read(dir + 'manifest.json'));
const loadReport = async () => JSON.parse(await read(dir + 'native-report.json'));
const strings = Object.fromEntries(await Promise.all(manifest.map(async m => [m.file, (await read(dir + m.file)).trim()])));
const blueprintOf = file => decodeBlueprint(strings[file]).blueprint;
const allowed = new Set(['assembling-machine-1', 'steel-furnace', 'transport-belt', 'underground-belt', 'splitter', 'inserter', 'medium-electric-pole', 'big-electric-pole', 'wooden-chest', 'display-panel']);
const production = e => !['medium-electric-pole', 'big-electric-pole'].includes(e.name) && !(e.name === 'display-panel' && /^P · /.test(e.text || ''));
const shape = e => JSON.stringify([e.name, e.position, e.direction || 0, e.recipe || null, e.type || null, e.bar ?? null, e.text || null]);

test('seven records in the published order, files and SHA-256 match, footprints and counts read from the strings', () => {
  assert.deepEqual(manifest.map(m => m.file), designs.map(d => d.file));
  for (const m of manifest) {
    assert.equal(m.sha256, hash(strings[m.file]), m.file);
    assert.equal(m.blueprintSha256, m.sha256, m.file);
    const bp = blueprintOf(m.file), ports = derivePorts(bp, m.products);
    assert.deepEqual(m.footprint, ports.footprint, m.file);
    assert.equal(m.entities, bp.entities.length, m.file);
    assert.equal(m.AM1, bp.entities.filter(e => e.name === 'assembling-machine-1').length, m.file);
    assert.equal(m.steelFurnaces, bp.entities.filter(e => e.name === 'steel-furnace').length, m.file);
  }
  const fp = Object.fromEntries(manifest.map(m => [m.file, m.footprint.join('x')]));
  assert.deepEqual(fp, {'01-red-green-science.txt': '31x52', '02-red-belts.txt': '17x16', '03-red-undergrounds.txt': '14x31', '04-red-splitters.txt': '24x34', '05-assembling-machine-2.txt': '18x55', '06-medium-poles.txt': '24x19', '07-big-poles.txt': '24x19'});
});

test('only the early tiers: AM1, steel furnaces, yellow belts, plain inserters, wooden chests; no modules or beacons', () => {
  for (const m of manifest) for (const e of blueprintOf(m.file).entities) {
    assert.ok(allowed.has(e.name), m.file + ' ' + e.name);
    assert.equal(e.items, undefined, m.file + ' carries modules or items');
  }
});

test('no two entities share a tile, and every one-tile entity sits on the same grid as the rest of its string', () => {
  for (const m of manifest) {
    const seen = new Set(), entities = blueprintOf(m.file).entities;
    // A string's one-tile entities all sit on whole numbers or all on halves; two-by-two entities on the other one.
    const half = v => Math.abs(v % 1) === 0.5;
    const oneTileHalf = half(entities.find(e => e.name === 'transport-belt').position.x);
    for (const e of entities) {
      const [x0, y0, x1, y1] = tilesOf(e);
      for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) { const k = x + ',' + y; assert.ok(!seen.has(k), `${m.file} overlap at ${k} (${e.name})`); seen.add(k); }
      if (['transport-belt', 'underground-belt', 'inserter', 'wooden-chest', 'display-panel', 'medium-electric-pole'].includes(e.name)) {
        assert.equal(half(e.position.x), oneTileHalf, `${m.file} ${e.name} ${e.position.x}`); assert.equal(half(e.position.y), oneTileHalf, `${m.file} ${e.name} ${e.position.y}`);
      }
      if (['steel-furnace', 'big-electric-pole'].includes(e.name)) {
        assert.equal(half(e.position.x), !oneTileHalf, `${m.file} ${e.name} ${e.position.x}`); assert.equal(half(e.position.y), !oneTileHalf, `${m.file} ${e.name} ${e.position.y}`);
      }
    }
  }
});

test('pole wires travel in the string: a spanning tree over every pole, within copper reach, between entities that exist', () => {
  for (const m of manifest) {
    const bp = blueprintOf(m.file), byNumber = new Map(bp.entities.map(e => [e.entity_number, e]));
    const poles = bp.entities.filter(e => wireReach[e.name]);
    assert.ok(bp.entities.every(e => e.neighbours === undefined), m.file + ' still carries 1.1 neighbours');
    assert.equal(bp.wires.length, poles.length - 1, m.file);
    const parent = new Map(poles.map(p => [p.entity_number, p.entity_number]));
    const find = n => { while (parent.get(n) !== n) n = parent.get(n); return n; };
    for (const [a, ca, b, cb] of bp.wires) {
      const pa = byNumber.get(a), pb = byNumber.get(b);
      assert.ok(pa && pb && wireReach[pa.name] && wireReach[pb.name], `${m.file} wire ${a}-${b} names a missing or non-pole entity`);
      assert.equal(ca, 5); assert.equal(cb, 5);
      assert.ok(Math.hypot(pa.position.x - pb.position.x, pa.position.y - pb.position.y) <= Math.min(wireReach[pa.name], wireReach[pb.name]), `${m.file} wire ${a}-${b} too long`);
      parent.set(find(a), find(b));
    }
    assert.equal(new Set(poles.map(p => find(p.entity_number))).size, 1, m.file + ' poles form more than one network');
    assert.deepEqual(bp.wires, poleWires(bp.entities), m.file);
  }
});

test('inlets on the west edge in A, B, C order per cell; one product chest per product at one stack; a labelled grid pole', () => {
  const letters = {'01-red-green-science.txt': 'ABCABC', '02-red-belts.txt': 'AC', '03-red-undergrounds.txt': 'AC', '04-red-splitters.txt': 'ABC', '05-assembling-machine-2.txt': 'ABC', '06-medium-poles.txt': 'ABC', '07-big-poles.txt': 'ABC'};
  for (const m of manifest) {
    const ports = derivePorts(blueprintOf(m.file), m.products);
    assert.equal(ports.inputs.map(p => p.letter).join(''), letters[m.file], m.file);
    assert.ok(ports.inputs.every(p => p.side === 'west'), m.file);
    assert.deepEqual(ports.outputs.map(p => p.item), m.products, m.file);
    assert.ok(ports.outputs.every(p => p.bar === 1), m.file + ' chest not limited to one stack');
    assert.deepEqual(m.ports.inputs, ports.inputs.map(p => ({letter: p.letter, item: p.item, side: p.side, row: p.row})), m.file);
  }
  // The science workshop: both science chests on one row, the P panel beside the grid pole.
  const science = blueprintOf('01-red-green-science.txt'), ports = derivePorts(science, manifest[0].products);
  assert.equal(new Set(ports.outputs.map(p => p.row)).size, 1);
  const panel = science.entities.find(e => e.name === 'display-panel' && /^P · /.test(e.text));
  assert.ok(Math.hypot(panel.position.x - ports.power.position.x, panel.position.y - ports.power.position.y) < 2);
});

test('production entities are exactly those of the published strings kept in history, less pass-through belts', async () => {
  for (const d of designs) {
    const oldCode = (await read(`${dir}history/${d.history}/${d.file}`)).trim(), old = decodeBlueprint(oldCode).blueprint;
    assert.equal(hash(oldCode), manifest.find(m => m.file === d.file).previous.sha256);
    const now = blueprintOf(d.file);
    let expected = old.entities.filter(production);
    if (d.file === '01-red-green-science.txt') {
      // The green cell (leftmost tile at x >= 23) moved five tiles west; its three inlet belts lost the five tiles at
      // x = 18..22 that crossed the old gap. Nothing else of either cell moved, turned or changed recipe.
      const c = scienceCompaction;
      expected = expected
        .filter(e => !(e.name === 'transport-belt' && c.inletRows.includes(e.position.y) && e.position.x >= c.gap[0] && e.position.x <= c.gap[1]))
        .map(e => tilesOf(e)[0] >= c.greenLeft ? {...e, position: {...e.position, x: e.position.x + c.shift}} : e);
      assert.equal(old.entities.filter(production).length - expected.length, 15);
    }
    // Cut lines: every entity on one is a straight belt running across it; everything past it moves one tile closer.
    // Cut lines count from the rectangle's top-left, which the inlet panels set in every workshop.
    const box = footprint(d.file === '01-red-green-science.txt' ? expected : old.entities), rows = (d.cut?.rows || []).map(i => box.top + i), cols = (d.cut?.cols || []).map(i => box.left + i);
    const onCut = e => { const [x0, y0] = tilesOf(e); return rows.includes(y0) || cols.includes(x0); };
    for (const e of expected.filter(onCut)) {
      assert.equal(e.name, 'transport-belt', d.file);
      const [, y0] = tilesOf(e);
      assert.ok(rows.includes(y0) ? [0, 8].includes(e.direction || 0) : [4, 12].includes(e.direction || 0), d.file + ' cut belt does not run across its line');
    }
    expected = expected.filter(e => !onCut(e)).map(e => {
      const [x0, y0] = tilesOf(e);
      return {...e, position: {x: e.position.x - cols.filter(a => a < x0).length, y: e.position.y - rows.filter(a => a < y0).length}};
    });
    assert.deepEqual(now.entities.filter(production).map(shape), expected.map(shape), d.file);
    assert.equal(now.label, old.label, d.file);
    assert.deepEqual(now.icons, old.icons, d.file);
    assert.ok((await read(`${dir}history/${d.history}/NOTE.md`)).trim().split('\n').length === 1);
  }
  // The science workshop: the five off-grid trunk poles are gone (the cells' medium poles reach each other).
  const science = blueprintOf('01-red-green-science.txt');
  assert.equal(science.entities.filter(e => e.name === 'big-electric-pole').length, 2);
  // Tiles: at least 5 % fewer in 01, 02 and 05; 03, 06 and 07 lose 3 to 4 %; 04 has no pass-through line.
  const before = {'01-red-green-science.txt': 37 * 57, '02-red-belts.txt': 18 * 16, '03-red-undergrounds.txt': 14 * 32, '04-red-splitters.txt': 24 * 34, '05-assembling-machine-2.txt': 18 * 60, '06-medium-poles.txt': 25 * 19, '07-big-poles.txt': 25 * 19};
  for (const m of manifest) assert.ok(m.footprint[0] * m.footprint[1] <= before[m.file], m.file);
  for (const f of ['01-red-green-science.txt', '02-red-belts.txt', '05-assembling-machine-2.txt']) assert.ok(footprint(blueprintOf(f).entities).tiles <= 0.95 * before[f], f);
});

test('the book holds the seven strings in order', async () => {
  const book = decodeBlueprint((await read(dir + 'seven-workshops-book.txt')).trim()).blueprint_book;
  assert.deepEqual(book.blueprints.map(b => b.index), [0, 1, 2, 3, 4, 5, 6]);
  for (const [i, m] of manifest.entries()) assert.deepEqual(book.blueprints[i].blueprint, blueprintOf(m.file), m.file);
});

test('native report: full protocol passed for every exact SHA-256, floors met, every inlet stopped while blocked', async () => {
  const report = await loadReport();
  assert.equal(report.passed, true);
  assert.equal(report.gameVersion, '2.1.24');
  const {phasesRun, feedFactor, ...declared} = report.protocol;
  assert.deepEqual(declared, protocol);
  assert.deepEqual(phasesRun, {warmupMinutes: 240, measureMinutes: 60, blockedMinutes: 180, settleMinutes: 10, recoveryMinutes: 60});
  assert.equal(feedFactor, null);
  for (const m of manifest) {
    const b = report.builds.find(x => x.id === m.file);
    assert.ok(b, m.file);
    assert.equal(b.blueprintSha256, m.sha256, m.file);
    assert.equal(b.passed, true, m.file);
    assert.deepEqual(b.failures, []);
    // Lua writes an empty list as {}.
    for (const k of ['unpowered', 'lostGhosts', 'displaced']) assert.equal(Object.keys(b[k] || {}).length, 0, m.file + ' ' + k);
    assert.equal(b.substitutePowerPole, false);
    assert.deepEqual([b.boundingTiles.width, b.boundingTiles.height], m.footprint);
    assert.equal(m.status, 'native-verified');
    assert.deepEqual(m.minimumPerMinute, floors[m.file]);
    for (const [item, floor] of Object.entries(floors[m.file])) {
      assert.ok(b.outputsPerMinute[item] >= floor, `${m.file} ${item} ${b.outputsPerMinute[item]} < ${floor}`);
      assert.ok(b.recovery.outputsPerMinute[item] >= protocol.recoveryShare * floor, m.file + ' recovery');
      assert.equal(m.measuredPerMinute[item], Math.round(b.outputsPerMinute[item] * 1000) / 1000);
    }
    assert.ok(b.hold.acceptedInTail.every(p => p.count === 0), m.file + ' still drew material while blocked');
    assert.equal(Object.keys(b.hold.tailCrafts || {}).length, 0, m.file);
    assert.ok(b.machines.every(x => x.measuredCrafts > 0), m.file + ' idle machine');
  }
});

test('published claims: README and page carry the manifest footprints and measured rates, and no stale untested claim', async () => {
  const readme = await read(dir + 'README.txt'), page = await read(dir + 'index.html');
  for (const m of manifest) {
    assert.ok(readme.includes(`${m.file}: ${m.footprint.join(' x ')}`), m.file);
    assert.ok(page.includes(`${m.footprint.join(' × ')}`), m.file);
    for (const v of Object.values(m.measuredPerMinute)) assert.ok(readme.includes(v.toFixed(2)) && page.includes(v.toFixed(2)), m.file);
  }
  assert.ok(!/have not had a fresh native production test/.test(readme + page));
  for (const m of manifest) assert.ok(!/no native production-rate evidence|evidence does not apply/.test(blueprintOf(m.file).description), m.file);
});

test('generator re-run reproduces the folder byte for byte, without the game or the dump', async () => {
  const out = `.cache/early-flight-seven/test-regenerate-${process.pid}`;
  await fs.rm(new URL(out, root), {recursive: true, force: true});
  await promisify(execFile)(process.execPath, ['scripts/early-flight-seven/generate.mjs', '--out', out], {cwd: rootPath});
  for (const f of [...manifest.map(m => m.file), 'seven-workshops-book.txt', 'manifest.json', 'README.txt', 'index.html'])
    assert.equal(await read(`${out}/${f}`), await read(dir + f), f);
  await fs.rm(new URL(out, root), {recursive: true, force: true});
});

test('copper wire reach constants equal the 2.1.24 prototypes', async t => {
  const rawPath = process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
  let raw;
  try { raw = JSON.parse(await fs.readFile(rawPath, 'utf8')); } catch { t.skip('Pinned local prototype dump is not readable here (set FACTORIO_RAW)'); return; }
  for (const [name, reach] of Object.entries(wireReach)) assert.equal(raw['electric-pole'][name].maximum_wire_distance, reach, name);
});
