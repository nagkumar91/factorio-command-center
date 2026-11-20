// Essentials landing page and guides under file://: local links resolve, no horizontal scroll at phone
// width, and Copy falls back to selecting the import string. Run after `npm run build`.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../site/',import.meta.url);
const data=JSON.parse(await fs.readFile(new URL('essentials/data.json',root),'utf8'));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const pages=['essentials/index.html',...data.published.map(p=>p.page)];
 assert.equal(data.published.length,4);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  for(const file of pages){
   await page.goto(new URL(file,root).href);
   assert.equal(await page.locator('main h1').count(),1,file);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,file+' scrolls sideways at '+width);
   for(const href of await page.locator('a[href]').evaluateAll(a=>a.map(e=>e.getAttribute('href')))){
    if(!href||href.startsWith('#')||/^[a-z]+:/i.test(href))continue;
    const url=new URL(href,page.url());url.hash='';url.search='';await fs.access(url);
   }
   for(const src of await page.locator('img[src],script[src],link[href]').evaluateAll(n=>n.map(e=>e.getAttribute('src')||e.getAttribute('href'))))assert.ok(!/^(?:https?:)?\/\//.test(src),file+' loads '+src);
  }
 }
 await page.goto(new URL('essentials/index.html',root).href);
 await page.locator('[data-copy="book"]').click();
 assert.match(await page.locator('#copy-status').textContent(),/selected/);
 assert.equal(await page.evaluate(()=>getSelection().toString()||document.activeElement.value.slice(document.activeElement.selectionStart,document.activeElement.selectionEnd)),(await fs.readFile(new URL('essentials/essentials-book.txt',root),'utf8')).trim());
 assert.equal(await page.locator('#pairing tbody tr').count(),4);
 assert.match(await page.locator('#pairing tbody tr').last().textContent(),/All three together.*4$/);
 await page.goto(new URL('six-science/index.html',root).href);
 await page.locator('#copy-import').click();
 assert.equal(await page.locator('#import-details').evaluate(d=>d.open),true);
 assert.deepEqual(errors,[]);console.log('Essentials pages: landing page, four guides, local links, phone width and copy fallback passed.');
}finally{await browser.close();}
