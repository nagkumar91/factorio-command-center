// Space launch landing page and guides under file://: local links resolve, no horizontal scroll at phone
// width, the eight steps are in order, and Copy falls back to selecting the import string. Run after `npm run build`.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../site/',import.meta.url);
const data=JSON.parse(await fs.readFile(new URL('space-launch/data.json',root),'utf8'));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const pages=['space-launch/index.html',...data.published.map(p=>p.page)];
 assert.ok(data.published.length>0);
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
   // Every layout drawing loads.
   for(const ok of await page.locator('img').evaluateAll(n=>n.map(i=>i.complete&&i.naturalWidth>0)))assert.ok(ok,file+' has a broken image');
  }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.goto(new URL('space-launch/index.html',root).href);
 assert.deepEqual(await page.locator('section.step h2').evaluateAll(n=>n.map(e=>e.textContent.trim().split(/\s+/)[0])),['1','2','3','4','5','6','7','8']);
 assert.equal(await page.locator('#flight-sidebar a[aria-current="page"][href="../space-launch/index.html"]').count(),1,'flight-plans navigation marks the page');
 await page.locator('[data-copy="book"]').click();
 assert.match(await page.locator('#copy-status').textContent(),/selected/);
 assert.equal(await page.evaluate(()=>getSelection().toString()||document.activeElement.value.slice(document.activeElement.selectionStart,document.activeElement.selectionEnd)),(await fs.readFile(new URL('space-launch/space-launch-book.txt',root),'utf8')).trim());
 // One copy button per blueprint on the path, the circuit supplier included.
 for(const id of ['green-circuits',...data.published.map(p=>p.id)])assert.equal(await page.locator(`[data-copy="${id}"]`).count(),1,id);
 assert.equal(await page.locator('#suppliers table').last().locator('tbody tr').count(),data.interfaces.length);
 if(data.rocketPlan)assert.equal(await page.locator('#paste tbody tr').count(),data.rocketPlan.totalRockets);
 if(data.kit)assert.equal(await page.locator('#kit tbody tr').count(),data.kit.items.length);
 await page.locator('a[href="../essentials/index.html"]').first().click();
 assert.match(page.url(),/essentials\/index\.html$/);
 assert.equal(await page.locator('a[href="../space-launch/index.html"]').count()>0,true,'essentials links back');
 const guide=data.published.find(p=>p.id==='white-platform')||data.published[0];
 await page.goto(new URL(guide.page,root).href);
 await page.locator('#copy-import').click();
 assert.equal(await page.locator('#import-details').evaluate(d=>d.open),true);
 assert.deepEqual(errors,[]);console.log(`Space launch pages: landing page, ${data.published.length} guides, local links, phone width, eight steps and copy fallback passed.`);
}finally{await browser.close();}
