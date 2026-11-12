import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  for(const route of ['index.html','flight-forest/index.html','flight-science/index.html','flight-science-sided/index.html#compact','flight-science-sided/full/index.html']){
   await page.goto(pathToFileURL(path.resolve('site',route.split('#')[0])).href+(route.includes('#')?'#compact':''));
   await page.evaluate(()=>document.fonts.ready);
   assert.ok(await page.locator('.flight-category').count());
   assert.equal(await page.locator('aside a[href$="flight-science-sided/index.html#compact"]').count(),1);
   assert.equal(await page.locator('aside a[href$="flight-science/index.html"]').count(),1);
   for(const link of await page.locator('aside a').all()){
    const target=await link.evaluate(a=>a.href);const url=new URL(target);
    const fs=await import('node:fs/promises');const {fileURLToPath}=await import('node:url');
    const html=await fs.readFile(fileURLToPath(url),'utf8');
    if(url.hash && !url.pathname.endsWith('/site/index.html'))assert.ok(html.includes(`id="${url.hash.slice(1)}"`),`Unresolved ${target}`); // Root SPA routes are exercised by tests/browser.mjs.
   }
   if(route==='flight-science-sided/index.html#compact'){
    const assertTarget=async tier=>{
     await page.waitForFunction(id=>{const e=document.getElementById(id);const r=e.getBoundingClientRect();return r.top>=0&&r.top<innerHeight},tier);
     const heading=page.locator('#'+tier).locator('h1,h2,h3').first();
     const box=await heading.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=1000,`${tier} heading outside viewport`);
     assert.equal(await page.locator('#flight-sidebar').evaluate(e=>e.getBoundingClientRect().top),0);
     if(width===390){
      const menu=await page.locator('[data-flight-menu]').boundingBox();
      const bar=await page.locator('.topbar').boundingBox();
      assert.ok(menu&&menu.y>=0&&menu.y+menu.height<=1000,'Mobile menu must remain visible at deep anchors');
      assert.ok(box.y>=bar.y+bar.height,'Tier heading must clear sticky header');
     }
    };
    await assertTarget('compact');
    for(const tier of ['fully-integrated','hybrid','compact','supplies','compare']){
     assert.equal(await page.locator(`aside a[href="#${tier}"]`).count(),1);
     if(width===390)await page.locator('[data-flight-menu]').click();
     await page.locator(`aside a[href="#${tier}"]`).click();await assertTarget(tier);
    }
    if(width===390)await page.locator('[data-flight-menu]').click();
    await page.locator('aside a[href="#compact"]').click();await assertTarget('compact');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' overflow '+width);
   if(route!=='index.html'){
    assert.ok(await page.locator('textarea').count());
    if(width===390){const b=page.locator('[data-flight-menu]');await b.click();assert.equal(await b.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await b.getAttribute('aria-expanded'),'false');}
   }else assert.equal(await page.locator('.flight-plan-card').count(),4);
   if(route.endsWith('#compact')){
    if(width===390)await page.locator('[data-flight-menu]').click();
    await page.locator('aside a[href="#compact"]').click();
    const box=await page.locator('#compact > h2').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=1000);
    if(width===390){const menu=await page.locator('[data-flight-menu]').boundingBox();const bar=await page.locator('.topbar').boundingBox();assert.ok(menu.y>=0&&menu.y+menu.height<=1000);assert.ok(box.y>=bar.y+bar.height);}
   }
   if(width===390&&route!=='index.html'){
    await page.waitForFunction(()=>document.querySelector('#flight-sidebar').getBoundingClientRect().right<=1);
    assert.ok(await page.locator('[data-flight-menu]').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'Mobile menu must be unobscured');
   }
   await page.screenshot({path:`/tmp/flight-ui-${route.replace(/\.html/g,'').replace(/[^a-z0-9-]+/gi,'-')}-${width}.png`});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Flight plans: index cards, exact links, offline pages, mobile navigation, no overflow/errors passed');
}finally{await browser.close();}
