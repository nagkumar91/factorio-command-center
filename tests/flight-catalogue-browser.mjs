import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixture, blueprintCode, blueprintSha256, randomOutput} from './flight-catalogue-fixture.mjs';

// Test-only resources stay in memory. Serve no source files outside site/.
const root = path.resolve('site');
let servedData = fixture;
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf'};
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const memory = {
    '/flight-factories-data.js': ['text/javascript', 'globalThis.FLIGHT_FACTORIES=' + JSON.stringify(servedData) + ';'],
    '/flight-catalogue-fixture.txt': ['text/plain', blueprintCode],
    '/flight-catalogue-fixture-report.json': ['application/json', JSON.stringify({passed: true, blueprintSha256, fixture: true})],
    '/flight-catalogue-fixture-history.json': ['application/json', JSON.stringify({runs: [], fixture: true})],
    '/flight-catalogue-fixture-plan.json': ['application/json', JSON.stringify({fixture: true, target: {id: 'iron-gear-wheel', perSecond: 1 / 60}})]
  }[pathname];
  if (memory) { res.writeHead(200, {'Content-Type': memory[0]}); res.end(memory[1]); return; }
  try {
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + path.sep)) throw new Error('outside site');
    const contents = await fs.readFile(file);
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}); res.end(contents);
  } catch { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/flight-factories.html`;
const browser = await chromium.launch({...(process.env.BROWSER_EXECUTABLE ? {executablePath: process.env.BROWSER_EXECUTABLE} : {channel: 'chrome'}), headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, locale: 'en-US', acceptDownloads: true});
context.setDefaultTimeout(15000);
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => errors.push(request.url() + ' ' + request.failure()?.errorText));
page.on('response', response => { if (response.status() >= 400) errors.push(response.url() + ' HTTP ' + response.status()); });
const checkWidth = async width => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal page overflow at ${width}px`);
async function reset(view = 'factories') {
  if (await page.locator('#factory-detail').evaluate(e => e.open)) await page.getByRole('button', {name: 'Close factory details'}).click();
  await page.locator(`[data-view="${view}"]`).click();
  await page.locator(`[data-view="${view}"][aria-current="page"]`).waitFor();
  await page.locator('#flight-search').fill('');
  await page.locator('#flight-variant').selectOption('all');
  await page.locator('#flight-evidence').selectOption('all');
}
try {
  await page.goto(base);
  await page.getByRole('heading', {name: 'Factories for the flight.', exact: true}).waitFor();
  assert.equal(await page.locator('.factory-card').count(), 5);
  assert.match(await page.locator('#summary').innerText(), /3\s*\/\s*6/);
  assert.match(await page.locator('#summary .tested').innerText(), /^1\s/);
  await page.locator('#flight-search').fill('water');
  assert.equal(await page.locator('.factory-card').count(), 1, 'Search includes feed materials');
  await page.locator('#flight-search').fill('');
  await page.locator('#flight-variant').selectOption('intermediate');
  assert.equal(await page.locator('.factory-card').count(), 2, 'Intermediary alias is supported');
  await reset();
  await page.locator('#flight-evidence').selectOption('native-tested');
  assert.equal(await page.locator('.factory-card').count(), 1, 'Stale SHA must not receive native badge');
  await page.locator('[data-factory="gear-raw"] .button').click();
  const dialog = page.locator('#factory-detail');
  await dialog.getByRole('heading', {name: 'Iron gear wheel', exact: true}).waitFor();
  assert.equal(await dialog.locator('svg [data-display-entity]').count(), 2);
  assert.match((await dialog.locator('[data-input="iron-plate"] .input-label').innerText()).replace(/\s+/g, ' '), /IN A · Iron plate ↓.*Feed the belt from the left.*Display 1/);
  assert.match((await dialog.locator('[data-input="water"] .input-label').innerText()).replace(/\s+/g, ' '), /IN B · Water ↓.*Connect water to the pipe.*Display 2/);
  assert.equal(await dialog.locator('[data-input="water"] td:last-child small').innerText(), 'fluid/min');
  assert.equal(await dialog.locator('[data-input="iron-plate"] td:last-child small').innerText(), 'items/min');
  assert.match(await dialog.locator('.detail-target').innerText(), /Calculated output target/);
  assert.match(await dialog.locator('.measured-output').innerText(), /30 minutes measured after 10 minutes of warmup/);
  assert.equal(await dialog.locator('[data-measured-output="iron-gear-wheel"] strong').innerText(), '0.8');
  assert.equal(await dialog.locator('[data-measured-output="water"] small').innerText(), 'fluid/min');
  assert.match(await dialog.locator('.detail-target').innerText(), /1 items\/min/);
  assert.match(await dialog.locator('.input-basis').innerText(), /calculated target of 1 items\/min/);
  assert.equal(await dialog.getByRole('link', {name: /Evidence history/}).getAttribute('href'), 'flight-catalogue-fixture-history.json');
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('link', {name: 'Download blueprint (.txt)', exact: true}).click()]);
  const downloaded = await fs.readFile(await download.path(), 'utf8');
  assert.equal(downloaded, blueprintCode);
  assert.equal(createHash('sha256').update(downloaded).digest('hex'), blueprintSha256);
  await fs.mkdir('test-results', {recursive: true});
  await dialog.evaluate(e => e.scrollTop = 0);
  await page.screenshot({path: 'test-results/flight-catalogue-detail-desktop.png'});
  await page.keyboard.press('Escape');
  assert.equal(await dialog.evaluate(e => e.open), false);
  await reset('coverage');
  assert.equal(await page.locator('.coverage-row').count(), fixture.items.length);
  assert.match(await page.locator('[data-product="assembling-machine-3"] .coverage-state').innerText(), /No matching plan/, 'Construction machines are not produced outputs');
  await page.locator('#flight-evidence').selectOption('unavailable');
  assert.equal(await page.locator('.coverage-row').count(), 3);
  await page.locator('#flight-search').fill('unknown-modded');
  assert.match(await page.locator('#results').innerText(), /No supported machine/);
  await reset();
  await page.locator('#flight-evidence').selectOption('unverified');
  assert.equal(await page.locator('.factory-card').count(), 1);
  await page.locator('[data-factory="cable-stale"] .button').click();
  await dialog.locator('.evidence.unverified').waitFor();
  assert.equal(await dialog.locator('.evidence.unverified').count(), 1);
  assert.equal(await dialog.getByRole('link', {name: /Read matching native/}).count(), 0);
  assert.equal(await dialog.locator('.measured-output').count(), 0);
  await reset();
  await page.locator('#flight-search').fill('no such product');
  await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
  assert.equal(await page.locator('.factory-card').count(), 5);
  await page.screenshot({path: 'test-results/flight-catalogue-desktop.png'});
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({width, height: 900}); await checkWidth(width);
    await page.locator('[data-factory="gear-raw"] .button').click();
    await dialog.getByRole('heading', {name: 'Iron gear wheel', exact: true}).waitFor(); await checkWidth(width);
    assert.ok(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), `No horizontal dialog overflow at ${width}px`);
    if (width === 390) await page.screenshot({path: 'test-results/flight-catalogue-detail-mobile.png'});
    await dialog.getByRole('button', {name: 'Close factory details'}).click();
    await page.locator('[data-view="coverage"]').click();
    await page.locator('[data-view="coverage"][aria-current="page"]').waitFor(); await checkWidth(width);
    await page.locator('[data-view="profile"]').click(); await checkWidth(width);
    await page.getByRole('heading', {name: 'Your map & mod profile', exact: true}).waitFor();
    await page.locator('[data-view="factories"]').click();
    await page.locator('[data-view="factories"][aria-current="page"]').waitFor();
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: 'test-results/flight-catalogue-mobile.png'});
  servedData = {...fixture, factories: [...fixture.factories, ...Array.from({length: 34}, (_, i) => ({...fixture.factories[1], id: 'more-' + i}))]};
  await page.goto(base); assert.equal(await page.locator('.factory-card').count(), 30);
  await page.getByRole('button', {name: 'Show 9 more', exact: true}).click();
  assert.equal(await page.locator('.factory-card').count(), 39);
  servedData = JSON.parse(JSON.stringify(fixture));
  servedData.factories[0].validation.outputs[0] = randomOutput;
  servedData.factories[0].validation.throughputPassed = true;
  await page.goto(base + '?case=random-yield#factory=gear-raw');
  await dialog.locator('.rate-interval').waitFor();
  assert.match(await dialog.locator('[data-measured-output="iron-gear-wheel"] .rate-interval').innerText(), /95% interval\s*7\.02–9\.08/);
  assert.equal(await dialog.locator('[data-measured-output="water"] .random-yield-note').count(), 0);
  assert.doesNotMatch(await dialog.locator('.measured-output').innerText(), /Steady production check passed/);
  assert.match(await dialog.locator('.random-interpretation').innerText(), /do not guarantee each minute/);
  await dialog.locator('.stochastic-tests summary').click();
  assert.match(await dialog.locator('.stochastic-tests').innerText(), /Test level: 5%; p = 0\.540/);
  assert.match(await dialog.locator('.stochastic-tests').innerText(), /independent Poisson arrivals/);
  assert.equal(await dialog.locator('.ci-assumption').innerText(), randomOutput.rateConfidenceInterval.assumption);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width, height: 1000});
    await dialog.locator('.measured-output').scrollIntoViewIfNeeded();
    assert.ok(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Random-yield evidence must fit at ' + width);
    if (width !== 320) await page.screenshot({path: `test-results/flight-catalogue-random-yield-${width}.png`});
  }
  servedData = JSON.parse(JSON.stringify(fixture));
  Object.assign(servedData.factories[0].validation, {status: 'native-failed', passed: false, failures: ['No repeated output at the declared boundary.']});
  await page.goto(base + '?case=native-failed#factory=gear-raw');
  await dialog.locator('.evidence.native-failed').waitFor();
  assert.match(await dialog.locator('.detail-evidence').innerText(), /No repeated output/);
  assert.equal(await dialog.getByRole('link', {name: /Evidence history/}).count(), 1);
  assert.equal(await dialog.getByRole('link', {name: 'Download blueprint (.txt)', exact: true}).count(), 0);
  assert.equal(await dialog.locator('.measured-output').count(), 0);
  await reset();
  await page.locator('#flight-evidence').selectOption('native-failed');
  assert.equal(await page.locator('.factory-card').count(), 1);
  assert.match(await page.locator('#summary .tested').innerText(), /^0\s/);
  servedData = {schemaVersion: 1, profile: {name: 'Awaiting data', mods: []}, items: [], factories: []};
  await page.goto(base);
  await page.getByRole('heading', {name: 'The flight catalogue is awaiting its data', exact: true}).waitFor();
  assert.equal(await page.locator('.factory-card').count(), 0);
  assert.equal(await page.getByRole('link', {name: /Download blueprint/}).count(), 0);
  const offline = await browser.newContext({viewport: {width: 390, height: 844}, offline: true});
  await offline.addInitScript(data => Object.defineProperty(globalThis, 'FLIGHT_FACTORIES', {get: () => data, set: () => {}}), fixture);
  const offlinePage = await offline.newPage(); offlinePage.on('pageerror', error => errors.push(error.message));
  await offlinePage.goto(pathToFileURL(path.resolve('site/flight-factories.html')).href);
  await offlinePage.locator('[data-factory="gear-raw"] .button').click();
  await offlinePage.locator('#factory-detail').getByRole('heading', {name: 'Iron gear wheel', exact: true}).waitFor();
  assert.equal(await offlinePage.locator('#factory-detail svg [data-display-entity]').count(), 2);
  await offline.close();
  assert.deepEqual(errors, []);
  console.log('Flight catalogue browser passed: search, raw/mixed/intermediate filters, coverage gaps, exact-SHA evidence, labeled item/fluid panels, local download bytes, pagination, empty state, responsive layouts, and offline file opening.');
} catch (error) {
  console.error(await page.evaluate(() => ({hash: location.hash, title: document.querySelector('#catalogue-title')?.textContent, results: document.querySelector('#results')?.textContent?.slice(0, 600), selection: [...document.querySelectorAll('select')].map(e => e.value)})));
  console.error('Browser errors:', errors);
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
