import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.context().setOffline(true);
const url=pathToFileURL(process.cwd()+'/site/index.html').href;
try{
 await page.goto(url+'?collection=flight-plans#blueprints');await page.reload();await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 assert.equal(await page.locator('#blueprint-source').inputValue(),'Long game flight plans and strategies');
 await page.locator('#blueprint-search').fill('solid fuel');assert.ok(await page.locator('.blueprint-card').count()>=2);
 await page.locator('#blueprint-direction').selectOption('inputs');assert.ok(await page.locator('.blueprint-card').count()>=2);
 await page.locator('#blueprint-search').fill('solid fuel');await page.getByRole('button',{name:'Explore Complete connected science · Ore + solid fuel',exact:true}).click();assert.ok((await page.locator('#modal').innerText()).includes('36.00/min'));assert.ok((await page.locator('#modal').innerText()).includes('gear tap unused'));await page.locator('#modal').evaluate(e=>e.close());
 await page.locator('#blueprint-search').fill('');await page.locator('#blueprint-category').selectOption('Forestry');assert.ok(await page.locator('.blueprint-card').count()>=7);
 await page.locator('#blueprint-kind').selectOption('Forestry');assert.ok(await page.locator('.blueprint-card').count()>=7);
 // Selecting another collection must clear the stale section filter.
 await page.locator('#blueprint-kind').selectOption('All');await page.locator('#blueprint-source').selectOption('Autosaved · optimized v2');assert.equal(await page.locator('#blueprint-category').inputValue(),'All');assert.ok((await page.locator('.results-heading').innerText()).includes('125 builds'));
 await page.locator('#blueprint-direction').selectOption('outputs');await page.locator('#blueprint-search').fill('solar panel');assert.ok(await page.locator('.blueprint-card').count()>0);
 await page.locator('#blueprint-search').fill('');await page.locator('#blueprint-source').selectOption('Flight factories · historical mod profile');assert.ok((await page.locator('.results-heading').innerText()).includes('898 builds'));await page.locator('.layout-link').first().click();assert.ok((await page.locator('#modal').innerText()).includes('Historical mod-profile'));await page.locator('#modal').evaluate(e=>e.close());
 await page.setViewportSize({width:390,height:844});await page.goto(url+'?collection=flight-plans#blueprints');await page.reload();await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/tmp/factorio-catalogue-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.goto(url+'?collection=flight-plans#blueprints');await page.reload();await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();await page.screenshot({path:'/tmp/factorio-catalogue-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Offline catalogue: collection/section/purpose/input/output filters, detail proofs, history and mobile layout passed.');
}finally{await browser.close();}
