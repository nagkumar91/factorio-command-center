import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const atlas=JSON.parse(await fs.readFile('site/data/atlas.json'));
const catalog=JSON.parse(await fs.readFile('site/data/catalog.json'));
const fluids=new Set(catalog.fluids.map(item=>item.id));
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'en-US'});
await context.addInitScript(()=>localStorage.setItem('factorio-analytics-opt-out','1'));
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const format=value=>value>0&&value<.01?'<0.01':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
async function checkRows(panel,record){
 for(const [selector,ids,values] of [
  ['.input-rates',record.rawInputs,record.benchmark.inputPerMinute],
  ['.output-rates',[...record.products,...(record.sideProducts||[])],record.benchmark.perMinute]
 ]){
  assert.equal(await panel.locator(selector+' tr').count(),ids.length);
  for(const id of ids){
   const cell=panel.locator(`${selector} [data-rate-item="${id}"] td`);
   const unit=fluids.has(id)?'fluid/min':'items/min';
   assert.equal(await cell.locator('small').innerText(),unit);
   assert.equal((await cell.innerText()).replace(unit,'').trim(),format(values[id]));
  }
 }
}
try{
 const url=process.env.WEBSITE_URL||pathToFileURL(path.resolve('site/index.html')).href;
 await page.goto(url+'?collection=early-game#blueprints');
 await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 for(const id of ['early-raw-military-science-pack','early-raw-chemical-science-pack','early-raw-petroleum-gas','transport-blue']){
  const record=atlas.blueprints.find(record=>record.id===id);
  assert.ok(record?.benchmark?.inputPerMinute,'Missing input rates: '+id);
  await page.locator('#blueprint-source').selectOption(record.collection);
  await page.locator('#blueprint-search').fill(record.colour||catalog.items.find(item=>item.id===record.products[0])?.name||catalog.fluids.find(item=>item.id===record.products[0]).name);
  const card=page.locator('.blueprint-card').filter({has:page.locator(`[data-action="blueprint-details"][data-id="${id}"]`)});
  assert.equal(await card.count(),1);
  await checkRows(card.locator('.card-rates'),record);
  assert.equal(await card.locator('.blueprint-content').evaluate(element=>element.lastElementChild.classList.contains('card-rates')),true);
  await card.locator('[data-action="blueprint-details"]').first().click();
  const details=page.locator('#modal .throughput-results');
  await checkRows(details,record);
  assert.match(await details.innerText(),/15 minutes to warm up, then 30 minutes measured/);
  if(id==='early-raw-military-science-pack'){
   await details.scrollIntoViewIfNeeded();
   await fs.mkdir('test-results',{recursive:true});
   await page.screenshot({path:'test-results/blueprint-rates-1440.png'});
  }
  await page.locator('[data-action="close-modal"]').click();
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#blueprint-source').selectOption('Early game · no robots');
 await page.locator('#blueprint-search').fill('Military science pack');
 await page.locator('.card-rates').scrollIntoViewIfNeeded();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Rate tables must fit mobile width');
 await page.screenshot({path:'test-results/blueprint-rates-390.png'});
 assert.deepEqual(errors,[]);
 console.log('Rate browser passed: card/detail values, items and fluids, measured context, and mobile width.');
}finally{await browser.close();}
