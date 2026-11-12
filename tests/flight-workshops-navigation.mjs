import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=new URL('../site/',import.meta.url);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  await page.goto(new URL('index.html#commands',root).href);
  for(const section of ['flight-robots','flight-forest','flight-science-sided']){const href=section+'/index.html'+(section==='flight-science-sided'?'#compact':'');assert.equal(await page.locator(`nav,aside`).locator(`a[href="${href}"]`).count(),1);}
  for(const section of ['flight-robots','flight-forest','flight-science-sided']){
   await page.goto(new URL(section+'/index.html',root).href);
   assert.equal(await page.locator('h1').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   for(const href of await page.locator('a[href]').evaluateAll(a=>a.map(e=>e.getAttribute('href')))){
    if(!href||href.startsWith('#')||/^[a-z]+:/i.test(href))continue;
    const url=new URL(href,page.url());url.hash='';url.search='';
    await fs.access(url);
   }
  }
  await page.goto(new URL('flight-factories.html',root).href);
  for(const section of ['flight-robots','flight-forest','flight-science-sided'])assert.equal(await page.locator(`a[href="${section}/index.html"]`).count(),1);
 }
 assert.deepEqual(errors,[]);console.log('Workshop navigation: sidebar, catalogue links, local downloads and desktop/mobile layouts passed.');
}finally{await browser.close();}
