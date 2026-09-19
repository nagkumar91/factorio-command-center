import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const site=path.resolve('site');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(request,response)=>{
 try{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=path.resolve(site,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(site+path.sep))throw Error('outside site');
  response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  response.end(await fs.readFile(file));
 }catch{response.writeHead(404);response.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));

const atlas=JSON.parse(await fs.readFile('site/data/atlas.json'));
const records=atlas.blueprints.filter(record=>record.scienceFactory);
assert.ok(records.length,'The science collection must contain a verified factory');
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'en-US'});
await context.addInitScript(()=>{
 localStorage.setItem('factorio-analytics-opt-out','1');
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedBlueprint=text;}}});
});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const format=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
try{
 const url=process.env.WEBSITE_URL||`http://127.0.0.1:${server.address().port}/`;
 await page.goto(url+'?collection=science-factories#blueprints');
 await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 assert.equal(await page.locator('.blueprint-card').count(),records.length);
 for(const record of records){
  assert.equal(record.validation.status,'game-tested');
  assert.equal(record.rawInputs.length,6);
  assert.equal(record.products.length,4);
  assert.ok(record.products.every(id=>record.benchmark.perMinute[id]>=29.8));
  const card=page.locator('.blueprint-card').filter({has:page.locator(`[data-action="blueprint-details"][data-id="${record.id}"]`)});
  assert.equal(await card.count(),1);
  assert.equal(await card.locator('.input-rates tr').count(),6);
  assert.equal(await card.locator('.output-rates tr').count(),4);
  await card.locator('[data-action="blueprint-details"]').first().click();
  for(const [kind,ids,values] of [['input',record.rawInputs,record.benchmark.inputPerMinute],['output',record.products,record.benchmark.perMinute]]){
   for(const id of ids){
    const value=await page.locator(`#modal .${kind}-rates [data-rate-item="${id}"] td`).innerText();
    assert.equal(value.replace(/(?:items|fluid)\/min/,'').trim(),format(values[id]));
   }
  }
  await page.locator('#modal [data-action="copy-blueprint"]').click();
  assert.equal(await page.evaluate(()=>window.__copiedBlueprint),record.code,'Copy must use the native-tested saved string');
  for(const originalVersion of record.publication?.history||[]){
   const original=JSON.parse(await fs.readFile(path.join('site',originalVersion.url)));
   await page.locator('#blueprint-version').selectOption(String(originalVersion.version));
   await page.waitForFunction(version=>document.querySelector('#blueprint-version')?.value===String(version)&&!document.querySelector('#blueprint-version')?.disabled,originalVersion.version);
   await page.locator('#modal [data-action="copy-blueprint"]').click();
   assert.equal(await page.evaluate(()=>window.__copiedBlueprint),original.code,`Version ${originalVersion.version} must still copy its original tested blueprint`);
   await page.locator('#blueprint-version').selectOption(String(record.publication.version));
   await page.waitForFunction(version=>document.querySelector('#blueprint-version')?.value===String(version)&&!document.querySelector('#blueprint-version')?.disabled,record.publication.version);
   await page.locator('#modal [data-action="copy-blueprint"]').click();
   assert.equal(await page.evaluate(()=>window.__copiedBlueprint),record.code,'Switching back must restore the compact tested blueprint');
  }
  await page.locator('[data-action="close-modal"]').click();
 }
 await page.locator('#blueprint-input-menu').getByRole('button',{name:/From raw materials/}).click();
 await page.locator('#blueprint-source').selectOption('Science factories');
 assert.equal(await page.locator('.blueprint-card').count(),records.length,'Both furnace choices must remain in the raw-material filter');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Science cards must fit mobile width');
 await fs.mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/science-factories-390.png'});
 assert.deepEqual(errors,[]);
 console.log(`Science browser passed: ${records.length} factories, direct collection link, six inputs, four measured outputs, exact copied strings, raw filter and mobile width.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
