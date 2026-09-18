import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { normalizeEntries, planCrates, crateSlots, generateCrateCommand, generateGiveCommand } from '../scripts/packer.mjs';
import { blueprintMaterials, decodeBlueprint, encodeBlueprint } from '../scripts/blueprints.mjs';
const catalog = JSON.parse(await fs.readFile('site/data/catalog.json', 'utf8'));
const row = (id, count, quality = 'normal') => ({ id, count, quality });

test('exact capacity and overflow preserve every requested item', () => {
  const exact = planCrates([row('iron-plate', 4800)], catalog);
  assert.equal(exact.chests, 1);
  const overflow = planCrates([row('iron-plate', 4801), row('copper-plate', 42)], catalog);
  assert.equal(overflow.chests, 2);
  const all = [...crateSlots(overflow, catalog, 0), ...crateSlots(overflow, catalog, 1)];
  assert.equal(all.reduce((n, r) => n + r.count, 0), 4843);
  assert.deepEqual(crateSlots(overflow, catalog, 1), [row('iron-plate', 1), row('copper-plate', 42)]);
});
test('equal items merge only when their qualities match', () => {
  assert.deepEqual(normalizeEntries([row('iron-plate', 5), row('iron-plate', 7), row('iron-plate', 3, 'legendary')], catalog), [row('iron-plate', 12), row('iron-plate', 3, 'legendary')]);
  assert.equal(planCrates([row('iron-plate', 1), row('iron-plate', 1, 'rare')], catalog).slots, 2);
});
test('invalid inputs and oversized batches cannot produce commands', () => {
  for (const bad of [0, -1, 1.5, NaN, Infinity, '', 1000001]) assert.throws(() => generateCrateCommand([row('iron-plate', bad)], catalog));
  assert.throws(() => generateCrateCommand([row('not-an-item', 1)], catalog));
  assert.throws(() => generateCrateCommand([row('iron-plate', 1, 'unknown')], catalog));
  assert.throws(() => generateCrateCommand([row('nuclear-reactor', 1000000)], catalog), /500/);
  assert.throws(() => generateGiveCommand('"; os.execute("bad")', 1));
  assert.equal(generateCrateCommand([], catalog), '');
});
test('normal chest capacity is independent of item quality', () => {
  assert.equal(planCrates([row('iron-plate', 4801, 'legendary')], catalog).chests, 2);
});
test('all locally indexed icons exist', async () => {
  await Promise.all(catalog.items.map(async i => { assert.ok(i.icon, i.id); await fs.access('site/' + i.icon); }));
});
test('blueprint books count rails, tiles, modules, and quality without hidden hub items', () => {
  const input = { blueprint_book: { blueprints: [
    { blueprint: { entities: [
      { name: 'curved-rail-a' },
      { name: 'assembling-machine-3', quality: 'rare', items: [{ id: { name: 'speed-module-3', quality: 'epic' }, items: { in_inventory: [{ inventory: 4, stack: 0 }, { inventory: 4, stack: 1, count: 2 }] } }] },
      { name: 'space-platform-hub' },
      { name: 'logistic-chest-passive-provider' }
    ], tiles: [{ name: 'stone-path' }, { name: 'stone-path' }, { name: 'refined-hazard-concrete-right' }] } },
    { blueprint_book: { blueprints: [{ blueprint: { entities: [{ name: 'beacon', items: { 'speed-module-3': 2 } }] } }] } }
  ] } };
  const result = blueprintMaterials(input, catalog);
  const amounts = Object.fromEntries(result.entries.map(r => [r.id + ':' + r.quality, r.count]));
  assert.equal(amounts['rail:normal'], 3);
  assert.equal(amounts['stone-brick:normal'], 2);
  assert.equal(amounts['refined-hazard-concrete:normal'], 1);
  assert.equal(amounts['passive-provider-chest:normal'], 1);
  assert.equal(amounts['assembling-machine-3:rare'], 1);
  assert.equal(amounts['speed-module-3:epic'], 3);
  assert.equal(amounts['speed-module-3:normal'], 2);
  assert.equal(result.blueprintCount, 2);
  assert.deepEqual(result.excluded, ['space-platform-hub']);
  assert.deepEqual(decodeBlueprint(encodeBlueprint(input)), input);
});
test('every indexed blueprint loadout validates against the game catalog', async () => {
  const library = JSON.parse(await fs.readFile('site/data/library.json', 'utf8'));
  for (const bp of library.blueprints) {
    assert.ok(bp.code.startsWith('0'), bp.file);
    normalizeEntries(bp.entries, catalog);
    assert.ok(decodeBlueprint(bp.code), bp.file);
  }
});
