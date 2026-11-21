import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {compactLayout, topology} from '../scripts/rgby-science/compact.mjs';

let next = 1;
const make = (name, x, y, extra = {}) => ({entity_number: next++, name, position: {x: x + .5, y: y + .5}, ...extra});
const belt = (x, y, direction) => make('fast-transport-belt', x, y, {direction});
const tile = e => [Math.floor(e.position.x), Math.floor(e.position.y)];
const find = (bp, id) => bp.entities.find(e => e.entity_number === id);

// A ten-belt run east, a turn south, one belt, then an arm into a chest under one pole.
function run({side = false} = {}) {
  next = 1;
  const row = Array.from({length: 10}, (_, x) => belt(x, 0, 4)), turn = belt(10, 0, 8), down = belt(10, 1, 8);
  const arm = make('fast-inserter', 10, 2, {direction: 0}), chest = make('iron-chest', 10, 3), pole = make('medium-electric-pole', 8, 3);
  const entities = [...row, turn, down, arm, chest, pole];
  const joiner = side ? belt(5, 1, 0) : null; if (joiner) entities.push(joiner);
  return {bp: {entities, wires: []}, row, turn, down, arm, chest, pole, joiner};
}

test('a plain belt run folds onto its feeder and every hand-off survives', () => {
  const {bp, row, turn, down, arm, chest, pole} = run(), r = compactLayout(bp, {west: [row[0].entity_number]});
  assert.equal(r.foldedBelts, 9);
  assert.deepEqual([r.before.width, r.before.height, r.after.width, r.after.height], [11, 4, 2, 4]);
  assert.deepEqual(bp.entities.map(e => e.entity_number), [row[0], turn, down, arm, chest, pole].map(e => e.entity_number));
  assert.deepEqual(tile(turn), [1, 0]); assert.deepEqual(tile(down), [1, 1]); assert.deepEqual(tile(arm), [1, 2]); assert.deepEqual(tile(chest), [1, 3]);
  assert.ok(Math.abs(pole.position.x - arm.position.x) <= 3, 'the arm keeps its pole');
  assert.deepEqual(topology(bp).problems, []);
});

test('a belt that takes a side load is never folded', () => {
  const {bp, row, joiner} = run({side: true}), r = compactLayout(bp, {west: [row[0].entity_number]});
  assert.equal(r.foldedBelts, 8);
  assert.ok(find(bp, row[5].entity_number), 'the side-loaded tile stays');
  assert.deepEqual(tile(row[5]), [1, 0]); assert.deepEqual(tile(joiner), [1, 1]);
  assert.ok(topology(bp).lines.includes(`flow ${joiner.entity_number}.0>${row[5].entity_number}:0/0:4`), 'still a side load from below');
});

test('a tunnel shortens to the obstacle it crosses and no further', () => {
  next = 1;
  const lead = belt(0, 0, 4), entry = make('fast-underground-belt', 1, 0, {direction: 4, type: 'input'}), wall = make('iron-chest', 3, 0), exit = make('fast-underground-belt', 6, 0, {direction: 4, type: 'output'}), tail = belt(7, 0, 4);
  const bp = {entities: [lead, entry, wall, exit, tail], wires: []}, r = compactLayout(bp, {west: [lead.entity_number]});
  assert.deepEqual([tile(entry)[0], tile(wall)[0], tile(exit)[0], tile(tail)[0]], [1, 2, 3, 4]);
  assert.equal(r.after.width, 5);
  assert.ok(topology(bp).lines.includes(`ug ${entry.entity_number}=${exit.entity_number}`));
});

test('exits stay in one column on the east edge and wired poles stay in reach', () => {
  next = 1;
  const a = belt(0, 0, 4), b = belt(1, 0, 4), c = belt(2, 0, 4), arm = make('fast-inserter', 3, 0, {direction: 12}), chest = make('passive-provider-chest', 4, 0);
  const far = make('iron-chest', 20, 3), p = make('medium-electric-pole', 2, 2), q = make('medium-electric-pole', 11, 2), s = make('medium-electric-pole', 20, 2);
  const bp = {entities: [a, b, c, arm, chest, far, p, q, s], wires: [[p.entity_number, 5, q.entity_number, 5], [q.entity_number, 5, s.entity_number, 5]]};
  compactLayout(bp, {west: [a.entity_number], east: [chest.entity_number]});
  const right = Math.max(...bp.entities.map(e => e.position.x));
  assert.equal(chest.position.x, right, 'nothing ends up east of the exit');
  for (const [u, , v] of bp.wires) assert.ok(Math.hypot(find(bp, u).position.x - find(bp, v).position.x, find(bp, u).position.y - find(bp, v).position.y) <= 9);
  assert.deepEqual(topology(bp).problems, []);
});

test('the description of a layout changes when an interaction changes', () => {
  const {bp, chest} = run(), before = topology(bp).lines;
  chest.position.x += 1;
  assert.notDeepEqual(topology(bp).lines, before);
  const unpowered = run(); unpowered.pole.position.x -= 4;
  assert.deepEqual(topology(unpowered.bp).problems, [`unpowered fast-inserter ${unpowered.arm.entity_number}`]);
});

const dir = new URL('../blueprint-sources/rgby-science/', import.meta.url), manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', dir)));
for (const m of manifest) test(m.id + ' is published compact: powered, wired within reach, and nothing left to fold', () => {
  const bp = decodeBlueprint(fs.readFileSync(new URL(m.file, dir), 'utf8').trim()).blueprint, saved = topology(bp);
  assert.deepEqual(saved.problems.filter(p => p.startsWith('unpowered')), []);
  // No wire is saved beyond reach: a blueprint build drops such wires (the red-circuit ring tail used to lose 14 this way).
  assert.deepEqual(saved.problems, []);
  assert.equal(m.compaction.wiresSavedBeyondReach, 0);
  assert.equal(m.compaction.tilesAfter, m.compaction.after.width * m.compaction.after.height);
  assert.ok(m.compaction.tilesAfter <= m.compaction.tilesBefore * .95, 'compaction saves at least 5% of the routed rectangle');
  assert.deepEqual([m.footprint.width, m.footprint.height], [m.compaction.after.width, m.compaction.after.height]);
  // The same rules the generator uses: entrances and exits on their edges, signs beside their entrance, lab side-loaders kept.
  const west = m.ports.filter(p => p.externalSide === 'west').map(p => p.entity), east = m.ports.filter(p => p.externalSide === 'east').map(p => p.entity);
  const ties = m.inputs.map(p => [p.entity, p.displayEntity, 'near']);
  for (const p of m.fluids) ties.push([p.entity, bp.entities.find(e => e.name === 'display-panel' && e.position.x === p.x + 1 && e.position.y === p.y + 1).entity_number, 'rigid']);
  const again = compactLayout(bp, {west, east, ties, fixed: m.labAnnex?.feedEntities ?? []});
  assert.equal(again.foldedBelts, 0); assert.deepEqual(again.passes, []);
  assert.deepEqual([again.after.width, again.after.height], [m.footprint.width, m.footprint.height]);
});
