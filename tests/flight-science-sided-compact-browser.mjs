import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const site=path.join(root,'site/flight-science-sided/compact');
const output=path.join(root,'scripts/flight-science-sided/compact/.native/preview-check');
await fs.mkdir(output,{recursive:true});
const [manifest]=JSON.parse(await fs.readFile(path.join(site,'manifest.json')));
const code=(await fs.readFile(path.join(site,manifest.file),'utf8')).trim();
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const page=await browser.newPage({viewport});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(site,'index.html')).href);
  assert.match(await page.locator('h1').innerText(),/Compact six-pack science/);
  assert.match(await page.locator('.status').innerText(),/Native verified/);
  assert.equal(await page.locator('textarea').inputValue(),code);
  assert.equal(await page.locator('a[download]').getAttribute('href'),manifest.file);
  assert(await page.locator('.map img').evaluate(img=>img.complete&&img.naturalWidth>0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Unexpected page overflow');
  await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Tile detail'}).click();assert(await page.locator('.map').evaluate(e=>e.classList.contains('detail')));
  await page.getByRole('button',{name:'Fit layout'}).click();assert(!await page.locator('.map').evaluate(e=>e.classList.contains('detail')));
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log('Compact six-pack desktop/mobile browser checks passed. Screenshots: '+output);
}finally{await browser.close();}
