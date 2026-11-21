import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {designs, manifestRow, footprint} from '../scripts/recovered-workshops/generate.mjs';

const dir = 'blueprint-sources/recovered-workshops';
const sha = text => createHash('sha256').update(text.trim()).digest('hex');
const read = async file => fs.readFile(dir + '/' + file, 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
const built = Object.fromEntries(designs().map(d => [d.id, d]));
const count = (blueprint, name) => blueprint.blueprint.entities.filter(e => e.name === name).length;
const recipes = (blueprint, recipe) => blueprint.blueprint.entities.filter(e => e.recipe === recipe).length;

test('the generator reproduces every Luna string, manifest row and native spec', async () => {
  const luna = manifest.filter(row => row.id.startsWith('luna-'));
  assert.deepEqual(luna.map(row => row.id), ['luna-circuits-180', 'luna-circuits-360', 'luna-red-science-90']);
  for (const row of luna) {
    const d = built[row.id];
    assert.deepEqual(row, manifestRow(d));
    assert.equal(sha(await read(row.file)), d.blueprintSha256);
    assert.equal(row.blueprintSha256, d.blueprintSha256);
  }
  assert.deepEqual(JSON.parse(await read('luna-specs.json')), designs().map(d => d.spec));
});

test('each Luna string is qualified by a passing full-protocol report for its exact SHA-256', async () => {
  for (const row of manifest.filter(r => r.id.startsWith('luna-'))) {
    const report = JSON.parse(await read(row.report));
    assert.equal(report.blueprintSha256, row.blueprintSha256, row.id);
    assert.equal(report.passed, true, row.id);
    assert.equal(report.prototypeDumpSha256, 'ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3');
    assert.deepEqual([report.configuration.warmupTicks, report.configuration.measurementTicks, report.configuration.windows], [54000, 108000, 3]);
    for (const machine of Object.values(report.native.machines)) assert.equal(machine.statusSeconds.working, 1800, row.id + ' ' + machine.recipe);
    assert.equal(report.native.power.allConsumersConnected, true);
  }
});

test('measured rates and inputs equal the published figures', async () => {
  const expect = {
    'luna-circuits-180': ['item:electronic-circuit', 180, {'item:copper-plate': 270, 'item:iron-plate': 180}],
    'luna-circuits-360': ['item:electronic-circuit', 360, {'item:copper-plate': 540, 'item:iron-plate': 360}],
    'luna-red-science-90': ['item:automation-science-pack', 90, {'item:copper-plate': 90, 'item:iron-plate': 180}],
  };
  for (const [id, [item, rate, inputs]] of Object.entries(expect)) {
    const report = JSON.parse(await read(id + '-native.json'));
    assert.deepEqual(report.outputs[item].windowPerMinute, [rate, rate, rate], id);
    assert.deepEqual(Object.fromEntries(Object.entries(report.native.inputs).map(([k, v]) => [k, v.consumedPerMinute])), inputs, id);
  }
});

test('the circuit cells are direct hand-off cells in 9 x 11 and 18 x 11 with the old machine counts', () => {
  const one = built['luna-circuits-180'], two = built['luna-circuits-360'];
  assert.deepEqual(one.footprint, {width: 9, height: 11});
  assert.deepEqual(two.footprint, {width: 18, height: 11});
  assert.deepEqual([recipes(one.blueprint, 'copper-cable'), recipes(one.blueprint, 'electronic-circuit')], [3, 2]);
  assert.deepEqual([recipes(two.blueprint, 'copper-cable'), recipes(two.blueprint, 'electronic-circuit')], [6, 4]);
  for (const d of [one, two]) {
    for (const name of ['fast-transport-belt', 'bulk-inserter', 'beacon']) assert.equal(count(d.blueprint, name), 0, name);
    for (const e of d.blueprint.blueprint.entities) if (e.name === 'fast-inserter') assert.equal(e.override_stack_size, 1);
    assert.ok(d.blueprint.blueprint.entities.every(e => !e.items), 'no modules');
  }
});

test('circuit entrances stay on the west edge in the old order and outputs are chests west to east', () => {
  for (const [id, cells] of [['luna-circuits-180', 1], ['luna-circuits-360', 2]]) {
    const d = built[id];
    assert.deepEqual(d.spec.inputs.map(p => p.name), cells === 1 ? ['copper-plate', 'iron-plate'] : ['copper-plate', 'iron-plate', 'copper-plate', 'iron-plate']);
    const byNumber = Object.fromEntries(d.blueprint.blueprint.entities.map(e => [e.entity_number, e]));
    for (let cell = 0; cell < cells; cell++) {
      const [copper, iron] = d.spec.inputs.slice(cell * 2, cell * 2 + 2).map(p => byNumber[p.entityNumber]);
      assert.equal(copper.position.y, 0.5); assert.equal(iron.position.y, 10.5);
      assert.equal(copper.position.x, iron.position.x);
      assert.equal(copper.direction, 4); assert.equal(iron.direction, 4);
    }
    const chests = d.spec.outputs.map(p => byNumber[p.entityNumber]);
    assert.ok(chests.every(e => e.name === 'iron-chest'));
    assert.deepEqual(chests.map(e => e.position.x), [...chests.map(e => e.position.x)].sort((a, b) => a - b));
  }
});

test('red science keeps the shared-lane layout without its two empty edge columns', async () => {
  const d = built['luna-red-science-90'];
  assert.deepEqual(d.footprint, {width: 21, height: 13});
  assert.deepEqual([recipes(d.blueprint, 'iron-gear-wheel'), recipes(d.blueprint, 'automation-science-pack')], [1, 10]);
  const byNumber = Object.fromEntries(d.blueprint.blueprint.entities.map(e => [e.entity_number, e]));
  const [copper, iron] = d.spec.inputs.map(p => byNumber[p.entityNumber]);
  assert.equal(copper.direction, 8, 'copper enters from the north');
  const minX = Math.min(...d.blueprint.blueprint.entities.map(e => e.position.x));
  assert.equal(iron.position.x, minX, 'iron entrance is on the west edge');
  const below = d.blueprint.blueprint.entities.find(e => e.position.x === iron.position.x && e.position.y === iron.position.y + 1);
  assert.equal(below?.name, 'display-panel', 'the panel closes the south side so iron arrives from the west');
  const outputs = d.spec.outputs.map(p => byNumber[p.entityNumber]);
  const maxX = Math.max(...d.blueprint.blueprint.entities.map(e => e.position.x));
  assert.ok(outputs.every(e => e.direction === 4 && e.position.x === maxX), 'science leaves east');
  const old = decodeBlueprint(await read('history/edge-columns-1231f0ae/luna-red-r4.txt'));
  assert.deepEqual(footprint(old), {width: 23, height: 13});
});

test('previous versions are kept with a note, and the greens geometry source is unchanged', async () => {
  for (const [folder, file, hash] of [
    ['history/return-belt-35dd7204', 'luna-circuits-r6.txt', '35dd72044fc798b55af35a426d0b81d4856e86e893144ae998f293bc4a826399'],
    ['history/return-belt-pair-bf4d6a63', 'luna-circuits-r7-360.txt', 'bf4d6a63d8a27fa3f3c0ea32d63701eff92c93195c4b216b2c2dbcbddc3ae7ba'],
    ['history/edge-columns-1231f0ae', 'luna-red-r4.txt', '1231f0aea478ea1cb743e16978d8288631161f7821218e65ef321e4055721f85'],
  ]) {
    assert.equal(sha(await read(folder + '/' + file)), hash);
    assert.match(await read(folder + '/NOTE.md'), /Replaced 2026-11-21/);
    const report = JSON.parse(await read(folder + '/' + file.replace('.txt', '-native.json')));
    assert.equal(report.blueprintSha256, hash);
  }
  const greens = await fs.readFile('scripts/rgby-science/greens.mjs', 'utf8');
  assert.ok(greens.includes("'" + dir + '/history/return-belt-pair-bf4d6a63/luna-circuits-r7-360.txt' + "'"), 'greens geometry reads the kept 360 version');
  await assert.rejects(read('luna-circuits-r7-360.txt'), 'no duplicate copy at the top of the folder');
});

test('robot-ready forest rows and strings are unchanged', async () => {
  const forests = {'robot-autonomous-forest': 'fdd2ea61d0301678dbd03655e2356e47ef5f0f37d51c0a116df563410bfc47dd',
    'robot-standing-grove': '5592d5bbdb6f9e60bfcda552387aa0bff7f10f760d7e302e02daeeadf4483374',
    'robot-robot-serviced-forest': '47f4b0bab86267c38c998f99615e45c8e25f1cfae9e8b9e116270de0d5320fcb'};
  assert.deepEqual(manifest.filter(r => !r.id.startsWith('luna-')).map(r => [r.id, r.blueprintSha256]), Object.entries(forests));
  for (const [id, hash] of Object.entries(forests)) {
    assert.equal(sha(await read(id + '.txt')), hash);
    const report = JSON.parse(await read(id + '-native.json'));
    assert.ok(report.builds.some(b => b.blueprintSha256 === hash && b.passed));
  }
});
