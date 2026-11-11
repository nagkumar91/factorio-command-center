// Run after the publication adapter to verify real local artifacts, without deploying.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const contextData = vm.createContext({URL, Intl});
const dataScript = await fs.readFile('site/flight-factories-data.js', 'utf8');
vm.runInContext(dataScript, contextData);
vm.runInContext(await fs.readFile('site/flight-factories-model.js', 'utf8'), contextData);
const M = contextData.FlightFactories, data = M.normalize(contextData.FLIGHT_FACTORIES);
const factory = data.factories.find(f => f.product === 'logistic-robot' && f.variant === 'raw') || data.factories.find(f => f.blueprint?.preview);
const panels = factory?.blueprint?.entities?.filter(e => e.name === 'display-panel') || [];
assert.ok(factory?.blueprint?.preview, 'Publish at least one real factory preview before running this suite.');
assert.ok(factory.inputs.length, 'Published factory should declare its boundary feeds.');
const siteRoot = await fs.realpath('site');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain', '.json': 'application/json'};
// Exercise the served download with the same published snapshot while native runs may continue exporting.
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = await fs.realpath(path.resolve(siteRoot, '.' + pathname));
    if (!file.startsWith(siteRoot + path.sep)) throw new Error('Outside public site');
    const bytes = pathname === '/flight-factories-data.js' ? dataScript : await fs.readFile(file);
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({...(process.env.BROWSER_EXECUTABLE ? {executablePath: process.env.BROWSER_EXECUTABLE} : {channel: 'chrome'}), headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1050}, locale: 'en-US', offline: true});
context.setDefaultTimeout(15000);
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => errors.push(request.url() + ' ' + request.failure()?.errorText));
const base = pathToFileURL(path.resolve('site/flight-factories.html')).href;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function bookMembers(node) {
  if (node.blueprint) return [node.blueprint];
  assert.ok(node.blueprint_book?.blueprints, 'Every book entry must be a blueprint or nested book.');
  return node.blueprint_book.blueprints.flatMap(bookMembers);
}
function memberCounts(members) {
  const counts = new Map();
  for (const member of members) { const hash = fingerprint(member); counts.set(hash, (counts.get(hash) || 0) + 1); }
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}
try {
  await fs.mkdir('test-results', {recursive: true});
  await page.goto(base);
  if (data.profile.book) {
    const book = data.profile.book;
    const bookLink = page.locator('#book-download').getByRole('link', {name: /Open verified blueprint book/});
    await bookLink.waitFor();
    assert.equal(await bookLink.getAttribute('href'), book.path);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width, height: 900});
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await bookLink.boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= 900, 'Book must be visible near the top without switching tabs at ' + width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Book link must fit the viewport at ' + width);
      if (width !== 320) await page.screenshot({path: `test-results/flight-catalogue-published-book-${width}.png`});
    }
    const [textTab] = await Promise.all([context.waitForEvent('page'), bookLink.click()]);
    await textTab.waitForLoadState('domcontentloaded');
    const offlineText = (await textTab.locator('body').innerText()).trim();
    assert.equal(createHash('sha256').update(offlineText).digest('hex'), book.sha256, 'Offline book link must open the exact import string.');
    await textTab.close();
    const servedContext = await browser.newContext({viewport: {width: 1440, height: 1050}, acceptDownloads: true});
    servedContext.setDefaultTimeout(15000);
    const servedPage = await servedContext.newPage();
    await servedPage.goto(`http://127.0.0.1:${server.address().port}/flight-factories.html`);
    const servedLink = servedPage.locator('#book-download').getByRole('link', {name: /Download verified blueprint book/});
    const [download] = await Promise.all([servedPage.waitForEvent('download'), servedLink.click()]);
    const bytes = await fs.readFile(await download.path());
    assert.equal(createHash('sha256').update(bytes).digest('hex'), book.sha256, 'Downloaded book bytes must match the advertised SHA-256.');
    assert.deepEqual(bytes, await fs.readFile(path.join('site', book.path)));
    const decoded = decodeBlueprint(bytes.toString('utf8'));
    assert.ok(decoded?.blueprint_book, 'Download must decode as a Factorio blueprint book.');
    const members = bookMembers(decoded);
    assert.equal(members.length, book.count, 'Decoded blueprint count must match the advertised layout count.');
    const native = data.factories.filter(f => M.evidence(f, data.profile).id === 'native-tested');
    assert.equal(native.length, book.count, 'Book must contain exactly the published verified layouts.');
    const expected = await Promise.all(native.map(async f => {
      const source = await fs.readFile(path.join('site', f.blueprint.path));
      assert.equal(createHash('sha256').update(source).digest('hex'), f.blueprint.sha256);
      return decodeBlueprint(source.toString('utf8')).blueprint;
    }));
    assert.deepEqual(memberCounts(members), memberCounts(expected), 'Book members must be the exact native-verified layouts; no failed or untested substitutions.');
    await servedContext.close();
    console.log(`Verified blueprint book download: ${book.count} exact native-tested layouts; SHA-256 ${book.sha256}.`);
  } else assert.equal(await page.locator('#book-download a').count(), 0);
  await page.setViewportSize({width: 1440, height: 1050});
  await page.goto(base + '#factory=' + encodeURIComponent(factory.id));
  const dialog = page.locator('#factory-detail');
  await dialog.getByRole('heading', {name: factory.name, exact: true}).waitFor();
  await dialog.locator('.preview img').waitFor();
  await page.waitForFunction(() => { const img = document.querySelector('#factory-detail .preview img'); return img?.complete && img.naturalWidth > 0; });
  assert.equal(await dialog.locator('.input-rates tbody tr').count(), factory.inputs.length);
  for (const input of factory.inputs) {
    const row = dialog.locator(`[data-input="${input.id}"]`);
    assert.match(await row.locator('.input-label').innerText(), new RegExp('Display ' + (panels.findIndex(p => p.entity_number === input.displayEntity) + 1)));
    assert.equal(await row.locator('td:last-child small').innerText(), input.type === 'fluid' ? 'fluid/min' : 'items/min');
  }
  if (M.downloadable(factory)) {
    const code = (await fs.readFile(path.join('site', factory.blueprint.path), 'utf8')).trim();
    assert.equal(createHash('sha256').update(code).digest('hex'), factory.blueprint.sha256);
    assert.equal(await dialog.getByRole('link', {name: 'Download blueprint (.txt)', exact: true}).count(), 1);
  } else assert.equal(await dialog.getByRole('link', {name: 'Download blueprint (.txt)', exact: true}).count(), 0);
  const expectedEvidence = M.evidence(factory, data.profile).id;
  assert.equal(await dialog.locator('.evidence.' + expectedEvidence).count(), 1);
  const measured = M.measurement(factory, data.profile);
  assert.equal(await dialog.locator('.measured-rates tbody tr').count(), measured?.rows.length || 0);
  const historyPath = M.localPath(factory.source?.diagnosticsPath);
  assert.equal(await dialog.getByRole('link', {name: /Evidence history/}).count(), historyPath ? 1 : 0);
  if (historyPath) {
    assert.equal(await dialog.getByRole('link', {name: /Evidence history/}).getAttribute('href'), historyPath);
    JSON.parse(await fs.readFile(path.join('site', historyPath), 'utf8'));
  }
  for (const input of factory.inputs) {
    const panel = panels.find(p => p.entity_number === input.displayEntity);
    assert.equal(panel?.icon?.name, input.id, 'Blueprint display panel icon must match its declared feed.');
    assert.ok(panel.text, 'Actual display text must be present.');
  }
  await page.screenshot({path: 'test-results/flight-catalogue-published-robot-desktop.png'});
  await dialog.locator('.input-rates').scrollIntoViewIfNeeded();
  await page.screenshot({path: 'test-results/flight-catalogue-published-inputs.png'});
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({width, height: 900});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflow at ' + width);
    assert.ok(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Dialog overflow at ' + width);
  }
  await page.setViewportSize({width: 390, height: 900});
  await dialog.evaluate(e => e.scrollTop = 0);
  await page.screenshot({path: 'test-results/flight-catalogue-published-robot-mobile.png'});
  await dialog.getByRole('button', {name: 'Close factory details'}).click();
  await page.locator('[data-view="profile"]').click();
  await page.getByRole('heading', {name: 'Your map & mod profile', exact: true}).waitFor();
  if(data.profile.map?.evidencePath){
    const proofLink=page.getByRole('link',{name:'Loaded-save verification',exact:true});
    assert.equal(await proofLink.getAttribute('href'),data.profile.map.evidencePath);
    const [proofTab]=await Promise.all([context.waitForEvent('page'),proofLink.click()]);
    await proofTab.waitForLoadState('domcontentloaded');
    const proof=JSON.parse(await proofTab.locator('body').innerText());
    assert.equal(proof.passed,true);assert.equal(proof.maxResourcePerEntity,4294967295);
    await proofTab.close();
  }
  await page.waitForFunction(() => { const img = document.querySelector('.profile-preview'); return !img || (img.complete && img.naturalWidth > 0); });
  await page.screenshot({path: 'test-results/flight-catalogue-published-profile.png'});
  const measuredFactory = data.factories.find(f => M.measurement(f, data.profile));
  if (measuredFactory) {
    const measurement = M.measurement(measuredFactory, data.profile);
    await page.goto(base + '#factory=' + encodeURIComponent(measuredFactory.id));
    await dialog.getByRole('heading', {name: measuredFactory.name, exact: true}).waitFor();
    assert.match(await dialog.locator('.input-basis').innerText(), new RegExp('calculated target of ' + M.formatRate(measuredFactory.outputPerMinute)));
    assert.match(await dialog.locator('.measured-output').innerText(), new RegExp(M.formatRate(measurement.minutes) + ' minutes measured'));
    for (const output of measurement.rows) {
      const row = dialog.locator(`[data-measured-output="${output.id}"]`);
      assert.equal(await row.locator('strong').innerText(), M.formatRate(output.perMinute));
      assert.equal(await row.locator('small').innerText(), output.type === 'fluid' ? 'fluid/min' : 'items/min');
    }
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width, height: 1050});
      await dialog.locator('.measured-output').scrollIntoViewIfNeeded();
      assert.ok(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Measured balance overflow at ' + width);
      if (width !== 320) await page.screenshot({path: `test-results/flight-catalogue-published-measured-${width}.png`});
    }
  }
  const randomFactory = data.factories.find(f => M.measurement(f, data.profile)?.rows.some(row => M.randomYieldEvidence(row)));
  if (randomFactory) {
    const measurement = M.measurement(randomFactory, data.profile);
    await page.goto(base + '#factory=' + encodeURIComponent(randomFactory.id));
    await dialog.getByRole('heading', {name: randomFactory.name, exact: true}).waitFor();
    await dialog.locator('.random-interpretation').waitFor();
    for (const output of measurement.rows) {
      const row = dialog.locator(`[data-measured-output="${output.id}"]`), random = M.randomYieldEvidence(output);
      assert.equal(await row.locator('.random-yield-note').count(), random ? 1 : 0);
      assert.equal(await row.locator('.rate-interval').count(), random?.interval ? 1 : 0);
      if (random?.interval) {
        const interval = random.interval;
        const displayed = (await row.locator('.rate-interval').innerText()).replace(/\s+/g, ' ');
        assert.equal(displayed, `${M.formatRate(interval.confidence * 100)}% interval ${M.formatRate(interval.lowerPerMinute)}–${M.formatRate(interval.upperPerMinute)}`);
      }
    }
    await dialog.locator('.stochastic-tests summary').click();
    assert.match(await dialog.locator('.random-interpretation').innerText(), /do not guarantee each minute/);
    assert.deepEqual(await dialog.locator('.ci-assumption').allTextContents(), Array.from(measurement.rows, row => M.randomYieldEvidence(row)?.interval?.assumption).filter(Boolean));
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width, height: 1050});
      await dialog.locator('.measured-output').scrollIntoViewIfNeeded();
      assert.ok(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Published random-yield evidence overflow at ' + width);
      if (width !== 320) await page.screenshot({path: `test-results/flight-catalogue-published-random-${width}.png`});
    }
    console.log(`Published stochastic evidence verified: ${randomFactory.id}; supplied confidence bounds and stationarity assumptions, with deterministic co-products kept distinct.`);
  } else console.log('Published snapshot contains no conditional-Poisson rows yet; fixture browser covers the stochastic display.');
  assert.deepEqual(errors, []);
  console.log(`Published flight catalogue browser passed offline: ${data.items.length} products, ${data.factories.length} variants; ${factory.id}, ${factory.inputs.length} real labeled inputs, ${expectedEvidence}, map profile, and responsive detail.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
