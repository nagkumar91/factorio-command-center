import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const DATES = 'blueprint-sources/release-dates.json';
const FORMAT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?Z)?$/;
const read = async path => JSON.parse(await fs.readFile(path, 'utf8'));

test('every designed blueprint has a release date', async () => {
  const [atlas, dates] = await Promise.all([read('site/data/atlas.json'), read(DATES)]);
  const designed = atlas.blueprints.filter(b => b.designedCollection || b.id?.startsWith('designed-'));
  assert.ok(designed.length > 1000, 'the designed collection is indexed');
  const lines = designed.filter(b => !dates[b.blueprintSha256]).map(b => `  "${b.blueprintSha256}": "${new Date().toISOString().slice(0, 10)}",   // ${b.name}`);
  assert.deepEqual(lines, [], `Designed blueprint without a release date. Add one line per blueprint to ${DATES} (key: the blueprint string's sha256, value: the date it is first published as YYYY-MM-DD), then run npm run build:\n${lines.join('\n')}`);
  for (const b of designed) assert.equal(b.releasedAt, dates[b.blueprintSha256], `${b.id} was indexed with an out-of-date release date: run npm run build`);
});

test('release dates file holds only valid hashes and dates', async () => {
  for (const [sha, date] of Object.entries(await read(DATES))) {
    assert.match(sha, /^[0-9a-f]{64}$/, `${DATES}: key is not a sha256: ${sha}`);
    assert.match(date, FORMAT, `${DATES}: ${sha} needs YYYY-MM-DD (or YYYY-MM-DDTHH:MMZ), got ${date}`);
    assert.ok(Number.isFinite(Date.parse(date)), `${DATES}: ${sha} is not a real date: ${date}`);
  }
});

// The ordering rule, from site/explorer.js, with no browser and no game data.
const context = { URLSearchParams, location: { search: '' }, localStorage: { getItem: () => null }, document: { addEventListener: () => {} } };
vm.createContext(context);
vm.runInContext(await fs.readFile('site/explorer.js', 'utf8'), context);
const { newestFirst, isNewRelease, create } = context.FactorioExplorer;
const designed = (id, releasedAt, extra = {}) => ({ id, designedCollection: true, lifecycle: 'current', validation: { status: 'game-tested' }, releasedAt, ...extra });

test('newest release first; ties and every other card keep their existing order', () => {
  const list = [
    { id: 'community' }, designed('old', '2026-11-11T10:00Z'), designed('new-a', '2026-11-25T08:00Z'),
    designed('archived', '2026-11-26', { lifecycle: 'archive' }), designed('untested', '2026-11-26', { validation: { status: 'untested' } }),
    designed('undated', undefined), { id: 'starter', starter: true, order: 1 }, designed('new-b', '2026-11-25T08:00Z'), designed('newest', '2026-11-26T09:00Z'),
    designed('day-only', '2026-11-25')
  ];
  const ids = [...newestFirst(list)].map(b => b.id);
  assert.deepEqual(ids, ['newest', 'new-a', 'new-b', 'day-only', 'old', 'community', 'archived', 'untested', 'undated', 'starter']);
  assert.deepEqual(list.filter(b => !isNewRelease(b)).map(b => b.id), ids.slice(5), 'non-released cards keep exactly their order');
});

test('a list with no new release is returned unchanged', () => {
  const list = [{ id: 'a' }, { id: 'b', starter: true, order: 1 }];
  assert.equal(newestFirst(list), list);
});

test('library views: newest first in All and the designed collection, curated collections untouched', () => {
  const FLIGHT = 'Long game flight plans and strategies', STARTER = 'Early game · no robots', TODAY = "Today's flight builds", VERSIONS = 'Science design versions · 2.1';
  const base = (id, collection, extra = {}) => ({ id, name: id, collection, category: 'Production', section: 'Production', file: id, products: ['iron-plate'], icons: [], entries: [], entityCount: 1, analysis: { kind: 'Production', inputs: ['iron-ore'], outputs: ['iron-plate'], netOutputs: ['iron-plate'], recipes: [], serviceInputs: [], serviceOutputs: [] }, ...extra });
  const records = [
    base('autosaved', 'Autosaved'),
    base('starter-2', STARTER, { starter: true, order: 2 }), base('starter-1', STARTER, { starter: true, order: 1 }),
    base('flight-old', FLIGHT, designed('', '2026-11-11T10:00Z')), base('flight-new', FLIGHT, designed('', '2026-11-26T09:00Z')),
    base('today-old', FLIGHT, { ...designed('', '2026-11-12T10:00Z'), releaseGroup: 'flight-workshops-20261117' }), base('today-new', FLIGHT, { ...designed('', '2026-11-20T10:00Z'), releaseGroup: 'flight-workshops-20261117' }),
    base('version-old', VERSIONS, designed('', '2026-11-12T10:00Z')), base('version-new', VERSIONS, designed('', '2026-11-16T10:00Z'))
  ];
  for (const r of records) r.id = r.name;
  const explorer = create({ catalog: { items: [{ id: 'iron-plate', name: 'Iron plate' }], fluids: [] }, atlas: { coverage: { items: [] } }, library: { blueprints: records }, production: { recipes: [] }, community: {}, esc: v => String(v ?? ''), image: () => '', svg: () => '', number: String, heading: () => '', searchField: () => '', empty: () => '', renderPage: () => {} });
  const cards = () => [...explorer.blueprintsPage().matchAll(/class="layout-link" data-action="blueprint-details" data-id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(cards().slice(0, 6), ['flight-new', 'today-new', 'version-new', 'today-old', 'version-old', 'flight-old'], 'All view: designed current builds, newest first');
  assert.deepEqual(cards().slice(6).sort(), ['autosaved', 'starter-1', 'starter-2']);
  explorer.handleChange({ id: 'blueprint-source', value: FLIGHT });
  assert.deepEqual(cards(), ['flight-new', 'today-new', 'today-old', 'flight-old'], 'designed collection: newest first');
  explorer.handleChange({ id: 'blueprint-source', value: TODAY });
  assert.deepEqual(cards(), ['today-old', 'today-new'], 'dated release collection keeps registration order');
  explorer.handleChange({ id: 'blueprint-source', value: VERSIONS });
  assert.deepEqual(cards(), ['version-old', 'version-new'], 'other collections keep their order');
  explorer.handleChange({ id: 'blueprint-source', value: STARTER });
  assert.deepEqual(cards(), ['starter-1', 'starter-2'], 'early-game collection keeps its explicit order');
});
