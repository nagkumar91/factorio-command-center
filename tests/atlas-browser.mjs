import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.TEST_URL||pathToFileURL(path.resolve('site/index.html')).href;
const atlas=JSON.parse(await fs.readFile('site/data/atlas.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
if(base.startsWith('file:'))await context.setOffline(true);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
async function coverage(){await page.goto(base+'#coverage');if(await page.locator('#modal').evaluate(e=>e.open))await page.locator('[data-action="close-modal"]').click();await page.getByRole('heading',{name:'Every craftable item',exact:true}).waitFor();await page.locator('#coverage-search').fill('');}
try{
 await coverage();assert.equal(await page.locator('.coverage-item').count(),atlas.coverage.total);
 for(const id of ['tesla-ammo','foundation','holmium-ore','metallic-asteroid-chunk']){
  await coverage();await page.locator('#coverage-search').fill(id);
  const row=page.locator(`[data-product="${id}"]`);await row.locator('[data-action="blueprint-details"]').click();
  await page.getByText('Production tested in Factorio',{exact:true}).waitFor();
  await page.locator('[data-action="copy-blueprint"]').click();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/^0e/);
  await page.locator('[data-action="crate-blueprint"]').click();assert.match(await page.locator('#command-output').inputValue(),/bulk-inserter/);await page.locator('[data-action="close-modal"]').click();
 }
 await coverage();await page.locator('#coverage-search').fill('tesla ammo');await page.locator('.coverage-item [data-action="blueprint-details"]').click();await page.locator('[data-action="plan-blueprint-inputs"]').click();await page.getByRole('heading',{name:'Production planner',exact:true}).waitFor();assert.ok(await page.locator('.recipe-steps li').count()>1);
 await coverage();for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+width);}
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/coverage-mobile.png',fullPage:false});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/coverage-desktop.png',fullPage:false});
 assert.deepEqual(errors,[]);console.log(`Atlas browser passed: ${atlas.coverage.total} item entries, blueprint copies, crates, supply planning, desktop and mobile.`);
}finally{await browser.close();}
