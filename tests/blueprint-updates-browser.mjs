import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

await import('../site/data/community.js');
const seed = globalThis.FactorioData.community.blueprints.find(blueprint => !blueprint.isBook && blueprint.analysis);
assert.ok(seed, 'The browser fixture needs one indexed blueprint record.');
const clone = value => JSON.parse(JSON.stringify(value));
const existingId = seed.id;
const existingV1 = clone(seed);
existingV1.name = 'Blueprint update fixture v1';
const existingV2 = clone(seed);
existingV2.name = 'Blueprint update fixture v2';
const added = clone(seed);
added.id = 'blueprint-update-fixture-new';
added.name = 'Blueprint update new record';
const revisions = { existingV1: '1'.repeat(64), existingV2: '2'.repeat(64), added: '3'.repeat(64) };
let phase = 1;
let newAttempts = 0;
const manifests = [
  {
    schemaVersion: 1,
    revision: 'a'.repeat(64),
    blueprints: [{ id: existingId, name: existingV1.name, colour: 'Fixture', revision: revisions.existingV1, url: 'data/transport-workshops/test-existing.json', blueprintSha256: '4'.repeat(64) }]
  },
  {
    schemaVersion: 1,
    revision: 'b'.repeat(64),
    blueprints: [
      { id: existingId, name: existingV2.name, colour: 'Fixture', revision: revisions.existingV2, url: 'data/transport-workshops/test-existing.json', blueprintSha256: '5'.repeat(64) },
      { id: added.id, name: added.name, colour: 'Fixture', revision: revisions.added, url: 'data/transport-workshops/test-new.json', blueprintSha256: '6'.repeat(64) }
    ]
  }
];

const siteRoot = path.resolve('site');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!['GET', 'HEAD'].includes(request.method) || pathname.split('/').some(part => part.startsWith('.'))) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    let target = path.resolve(siteRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(siteRoot + path.sep)) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    const file = await fs.readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 400);
    response.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : { channel: 'chrome' }), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
await context.addInitScript(() => {
  const nativeFetch = window.fetch.bind(window);
  window.__blueprintFetches = [];
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/\/data\/(transport-workshops|early-game|science-factories|power-workshops)\//.test(url)) window.__blueprintFetches.push({ url, cache: init.cache || 'default' });
    return nativeFetch(input, init);
  };
});
const page = await context.newPage();
const errors = [];
const manifestRequests = [];
const recordRequests = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/data/transport-workshops/index.json', route => {
  manifestRequests.push(phase);
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(manifests[phase - 1]) });
});
await page.route('**/data/transport-workshops/test-existing.json', route => {
  recordRequests.push('existing');
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(phase === 1 ? existingV1 : existingV2) });
});
await page.route('**/data/transport-workshops/test-new.json', route => {
  recordRequests.push('new');
  newAttempts += 1;
  if (newAttempts === 1) return route.fulfill({ status: 503, contentType: 'text/plain', body: 'temporary fixture failure' });
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(added) });
});

try {
  await page.goto(`${base}/#blueprints`);
  await page.getByRole('heading', { name: 'Blueprint library', exact: true }).waitFor();
  await page.locator('#blueprint-source').selectOption('Transport workshops');
  const transportColours = await page.evaluate(() => FactorioData.atlas.blueprints.filter(blueprint => blueprint.workshop).map(blueprint => blueprint.colour));
  const transportBanner = await page.locator('.collection-banner').innerText();
  for (const colour of transportColours) assert.match(transportBanner, new RegExp(colour, 'i'));
  if (!transportColours.some(colour => colour === 'Green')) assert.doesNotMatch(transportBanner, /green adds tungsten ore/i);
  await page.locator('#blueprint-source').selectOption('All');
  await page.locator('#blueprint-search').fill('Blueprint update');
  await page.getByRole('heading', { name: existingV1.name, exact: true }).waitFor();
  assert.equal(await page.locator('#blueprint-updates-action').isHidden(), true, 'Initial records apply automatically.');
  assert.deepEqual(recordRequests, ['existing']);
  const fetchModes = await page.evaluate(() => window.__blueprintFetches);
  assert.ok(fetchModes.filter(request => request.url.endsWith('/index.json')).every(request => request.cache === 'no-store'));
  assert.ok(fetchModes.filter(request => !request.url.endsWith('/index.json')).every(request => request.cache === 'force-cache'));
  assert.deepEqual(fetchModes.filter(request => /\/data\/(early-game|science-factories|power-workshops)\//.test(request.url) && !request.url.endsWith('/index.json')), [], 'Current bundled revisions do not refetch their immutable records.');

  await page.locator('a.nav-link[href="#crates"]').click();
  await page.getByRole('heading', { name: 'Crate builder', exact: true }).waitFor();
  await page.locator('#item-search').fill('iron plate');
  await page.locator('[data-action="add-item"][data-id="iron-plate"]').click();
  await page.locator('#quantity-0').fill('777');
  assert.equal(await page.locator('#quantity-0').inputValue(), '777');

  await page.locator('a.nav-link[href="#blueprints"]').click();
  await page.getByRole('heading', { name: 'Blueprint library', exact: true }).waitFor();
  await page.locator(`[data-action="blueprint-details"][data-id="${existingId}"]`).first().click();
  await page.locator('#dialog-title').waitFor();
  assert.equal(await page.locator('#dialog-title').textContent(), existingV1.name);
  await page.locator('[data-action="copy-blueprint"]').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), existingV1.code);

  let navigations = 0;
  page.on('framenavigated', () => { navigations += 1; });
  const urlBeforeApply = page.url();
  phase = 2;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('#blueprint-updates-action').waitFor({ state: 'visible' });
  assert.equal(page.url(), urlBeforeApply, 'Polling does not navigate the open page.');
  assert.equal(manifestRequests.length, 2);
  assert.deepEqual(recordRequests, ['existing', 'existing', 'new'], 'Only changed/new record files are fetched.');

  await page.evaluate(() => document.getElementById('blueprint-updates-action').click());
  await page.locator('#blueprint-updates-action').waitFor({ state: 'hidden' });
  assert.equal(navigations, 0, 'Applying an update never reloads or navigates.');
  assert.equal(page.url(), urlBeforeApply, 'Applying an update preserves the current route.');
  assert.equal(await page.locator('#blueprint-search').inputValue(), 'Blueprint update', 'Applying an update preserves explorer filters.');
  assert.equal(await page.locator('#dialog-title').textContent(), existingV1.name, 'An open modal stays on its displayed revision.');
  await page.locator('[data-action="copy-blueprint"]').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), existingV1.code, 'Modal actions stay pinned to the displayed revision.');
  await page.locator('[data-action="close-modal"]').click();

  await page.locator('a.nav-link[href="#crates"]').click();
  await page.getByRole('heading', { name: 'Crate builder', exact: true }).waitFor();
  assert.equal(await page.locator('#quantity-0').inputValue(), '777', 'Applying an update preserves crate state.');

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('#blueprint-updates-action').waitFor({ state: 'visible' });
  assert.deepEqual(recordRequests, ['existing', 'existing', 'new', 'new'], 'A failed record fetch is retried.');
  assert.equal(await page.locator('#blueprint-updates-action').textContent(), 'Blueprint update available');
  await page.locator('#blueprint-updates-action').click();
  await page.locator('#blueprint-updates-action').waitFor({ state: 'hidden' });

  await page.locator('a.nav-link[href="#blueprints"]').click();
  await page.getByRole('heading', { name: 'Blueprint library', exact: true }).waitFor();
  assert.equal(await page.locator('#blueprint-search').inputValue(), 'Blueprint update', 'Explorer filters survive the merge.');
  assert.equal(await page.locator('.blueprint-card h3').count(), 2, 'The changed and new records are both visible.');
  assert.equal(await page.getByRole('heading', { name: existingV2.name, exact: true }).count(), 1, 'The changed record replaces the old record.');
  assert.equal(await page.locator('.blueprint-card').filter({ hasText: existingV2.name }).count(), 1, 'The changed record is not duplicated.');
  assert.equal(await page.locator('.blueprint-card').filter({ hasText: added.name }).count(), 1, 'The new record is inserted once.');

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(100);
  assert.deepEqual(recordRequests, ['existing', 'existing', 'new', 'new'], 'Unchanged revisions stay in the in-memory cache.');
  assert.deepEqual(errors, []);
  console.log('Blueprint update browser passed: initial merge, changed/new staged records, user-applied merge, route/filter/crate preservation, no reload, no duplicates, and revision caching.');
} finally {
  await browser.close();
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}
