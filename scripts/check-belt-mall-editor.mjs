import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// FBE currently predates the Space Age equipment in this blueprint. Record the
// actual import result rather than silently replacing unsupported entities.
const code = (await fs.readFile('mall/compact_turbo_tesla_mall.txt', 'utf8')).trim();
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1040 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [], consoleJobs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleJobs.push(Promise.all(message.args().map(a => a.jsonValue().catch(() => message.text()))).then(values => errors.push(values)));
  });
  await page.goto('https://fbe.teoxoy.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#loadingScreen.active').waitFor({ state: 'hidden', timeout: 90000 });
  const settings = page.getByText('Close Settings', { exact: true });
  if (await settings.isVisible()) await settings.click();
  await page.evaluate(text => navigator.clipboard.writeText(text), code);
  await page.locator('#editor').click({ position: { x: 800, y: 520 } });
  await page.keyboard.press('Meta+KeyV');
  const notice = page.getByText('Blueprint with modded items not supported yet.', { exact: false });
  await notice.waitFor({ state: 'visible', timeout: 30000 });
  const message = await notice.innerText();
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/belt-mall-fbe-import.png' });
  await Promise.all(consoleJobs);
  const report = { url: page.url(), checkedAt: new Date().toISOString(), blueprintSha256: createHash('sha256').update(code).digest('hex'), result: 'unsupported-entities', message, errors };
  await fs.writeFile('test-results/belt-mall-fbe-import.json', JSON.stringify(report, null, 2) + '\n');
  await fs.copyFile('test-results/belt-mall-fbe-import.json', 'mall/compact_turbo_tesla_mall.fbe-check.json');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
