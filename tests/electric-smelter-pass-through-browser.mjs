// Electric smelter pass-through guide under file://: local links resolve, no horizontal scroll at phone width,
// the import string on the page is the published one, and the navigation links to the page. Run after `npm run build`.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=new URL('../site/',import.meta.url),file='electric-smelter-pass-through/index.html';
const [m]=JSON.parse(await fs.readFile(new URL('electric-smelter-pass-through/manifest.json',root),'utf8'));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  await page.goto(new URL(file,root).href);
  assert.equal(await page.locator('main h1').textContent(),m.name);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'scrolls sideways at '+width);
  for(const href of await page.locator('a[href]').evaluateAll(a=>a.map(e=>e.getAttribute('href')))){
   if(!href||href.startsWith('#')||/^[a-z]+:/i.test(href))continue;
   const url=new URL(href,page.url());url.hash='';url.search='';await fs.access(url);
  }
  for(const src of await page.locator('img[src],script[src],link[href]').evaluateAll(n=>n.map(e=>e.getAttribute('src')||e.getAttribute('href'))))assert.ok(!/^(?:https?:)?\/\//.test(src),'loads '+src);
 }
 const code=await page.locator('#import-code').inputValue();
 assert.equal(createHash('sha256').update(code.trim()).digest('hex'),m.blueprintSha256);
 assert.equal(await page.locator('#measured tbody tr').count(),7);
 assert.equal(await page.locator('#measured tbody tr .evidence.matched').count(),6,'six qualifying scenarios pass');
 assert.ok((await page.locator('main').textContent()).includes('autosaved-f3d991e31c13c301'));
 assert.equal(await page.locator('.sidebar a[aria-current="page"]').getAttribute('href'),'../electric-smelter-pass-through/index.html');
 await page.locator('#copy-import').click();
 assert.equal(await page.locator('#import-details').evaluate(d=>d.open),true);
 assert.deepEqual(errors,[]);console.log('Electric smelter guide: exact import, seven scenario rows, local links, phone width and navigation passed.');
}finally{await browser.close();}
