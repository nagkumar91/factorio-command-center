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
  assert.equal(await page.title(),'Hybrid six science packs · 60/min');
  assert.equal(await page.locator('h1').textContent(),'Hybrid six science packs');
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
