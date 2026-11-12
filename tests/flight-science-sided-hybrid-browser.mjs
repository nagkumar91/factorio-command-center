import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const root=new URL('../',import.meta.url);
await fs.mkdir(new URL('scripts/flight-science-sided/hybrid/.cache/browser/',root),{recursive:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('site/flight-science-sided/hybrid/index.html',root).href);
  assert.equal(await page.title(),'Hybrid six science packs · ~60/min');
  assert.equal(await page.locator('h1').textContent(),'Hybrid six science packs');
  assert.equal(await page.locator('a[href="history/da625c-blueprint.txt"]').count(),1);
  assert.equal(await page.locator('a[href="history/da625c-native-report.json"]').count(),1);
  assert.equal(await page.locator('a[href="storage-stress-report.json"]').count(),1);
  for(const file of ['ac9fca-blueprint.txt','ac9fca-native-report.json','ac9fca-storage-stress-report.json'])assert.equal(await page.locator(`a[href="history/${file}"]`).count(),1);
  assert.equal(await page.locator('a[href="underground-pairing-report.json"]').count(),1);
  const body=await page.locator('body').textContent();assert(body.includes('385 fewer'));assert(body.includes('638.5'));assert(body.includes('footprint remains 114 × 75'));
  assert(await page.locator('.map img').evaluate(e=>e.complete&&e.naturalWidth>0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await page.locator('.map').evaluate(e=>e.scrollHeight<=e.clientHeight),'Fit layout must show the whole blueprint');
  await page.locator('[data-view="detail"]').click();
  assert(await page.locator('.map').evaluate(e=>e.classList.contains('detail')));
  await page.locator('[data-view="fit"]').click();
  assert(!await page.locator('.map').evaluate(e=>e.classList.contains('detail')));
  const code=(await fs.readFile(new URL('site/flight-science-sided/hybrid/hybrid-six-pack-sided-60.txt',root),'utf8')).trim();
  assert.equal(await page.locator('textarea').inputValue(),code);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:new URL(`scripts/flight-science-sided/hybrid/.cache/browser/${width}.png`,root).pathname,fullPage:true});
  await page.close();console.log(`Hybrid browser ${width}: passed`);
 }
}finally{await browser.close();}
