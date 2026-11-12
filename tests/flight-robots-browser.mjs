import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('../site/flight-robots/index.html',import.meta.url).href);
 assert.equal(await page.locator('article').count(),1);assert.equal(await page.locator('.status').filter({hasText:'Native verified:'}).count(),1);assert.ok((await page.locator('article').innerText()).includes('ONE shared steel chest'));
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));await page.screenshot({path:`/tmp/flight-robots-${width}.png`});}
 await page.locator('[data-view=detail]').first().click();assert.equal(await page.locator('.map').first().evaluate(e=>e.scrollWidth>e.clientWidth),true);await page.locator('[data-view=fit]').first().click();assert.equal(await page.locator('.map').first().evaluate(e=>e.scrollWidth>e.clientWidth),false);
 assert.deepEqual(errors,[]);console.log('Robot workshop render at desktop and mobile widths, with loaded maps and no page overflow.');
}finally{await browser.close();}
