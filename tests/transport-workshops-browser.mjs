import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.TEST_URL||pathToFileURL(path.resolve('site/index.html')).href;
const manifest=JSON.parse(await fs.readFile('blueprint-sources/transport-workshops/manifest.json'));
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
if(base.startsWith('file:'))await context.setOffline(true);
await context.addInitScript(()=>localStorage.setItem('factorio-analytics-opt-out','1'));
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
const url=new URL(base);url.searchParams.set('collection','transport');url.hash='blueprints';
try{
 await page.goto(url.href);await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 assert.equal(await page.locator('#blueprint-source').inputValue(),'Transport workshops');
 assert.equal(await page.locator('.blueprint-card').count(),manifest.length);
 await page.getByRole('heading',{name:'One workshop per belt colour.'}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Download transport book'}).getAttribute('href'),'sources/collections/transport-workshops.txt');
 for(const info of manifest){
  await page.locator('#blueprint-search').fill(info.colour);
  assert.equal(await page.locator('.blueprint-card').count(),1);
  await page.locator(`[data-action="blueprint-details"][data-id="${info.id}"]`).first().click();
  await page.getByText('Layout tested in Factorio',{exact:true}).waitFor();
  const setup=await page.locator('.cell-setup').allTextContents();
  assert.ok(setup.join(' ').includes('No robots required'));assert.ok(setup.join(' ').includes('Circuit network'));
  assert.equal(await page.locator('.throughput-results .output-rates tbody tr').count(),info.products.length+info.sideProducts.length);
  assert.equal(await page.locator('.throughput-results .input-rates tbody tr').count(),info.rawInputs.length);
  if(info.colour==='Green')assert.ok(setup.join(' ').includes('Vulcanus'));
  const preview=page.locator('.detail-layout');await preview.waitFor();assert.match(await preview.getAttribute('src'),/\?v=[a-f0-9]{12}$/);
  await page.waitForFunction(()=>document.querySelector('.detail-layout')?.complete);assert.ok(await preview.evaluate(i=>i.naturalWidth>0));
  await page.locator('[data-action="copy-blueprint"]').click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),(await fs.readFile('blueprint-sources/transport-workshops/'+info.file,'utf8')).trim());
  await page.locator('[data-action="crate-blueprint"]').click();const command=await page.locator('#command-output').inputValue();
  for(const name of ['assembling-machine-2','steel-furnace','big-electric-pole','medium-electric-pole'])assert.ok(command.includes(name));
  if(info.colour==='Green')assert.ok(command.includes('foundry'));
  await page.locator('[data-action="close-modal"]').click();
 }
 await page.locator('#blueprint-search').fill('');
 await fs.mkdir('test-results',{recursive:true});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow at '+width);
  await page.screenshot({path:`test-results/transport-${width}.png`,fullPage:false,animations:'disabled'});
 }
 assert.deepEqual(errors,[]);console.log('Transport browser passed: '+manifest.length+' published colours, exact copies, construction crates, labeled previews, measured rates and responsive views.');
}finally{await browser.close();}
