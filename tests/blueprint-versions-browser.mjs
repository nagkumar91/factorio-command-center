import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const site=path.resolve('site');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(request,response)=>{
 try{const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);const file=path.resolve(site,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(site+path.sep))throw Error('outside site');response.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');response.end(await fs.readFile(file));}catch{response.writeHead(404);response.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=process.env.WEBSITE_URL||`http://127.0.0.1:${server.address().port}/`;
const atlas=JSON.parse(await fs.readFile('site/data/atlas.json'));
const latest=atlas.blueprints.find(b=>b.id==='early-raw-military-science-pack');
assert.ok(latest.publication.version >= 2);
const previous=JSON.parse(await fs.readFile(path.join(site,latest.publication.history.find(v=>v.version===1).url)));
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
await context.addInitScript(()=>{
 localStorage.setItem('factorio-analytics-opt-out','1');
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedBlueprint=text;}}});
});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(url+'?collection=early-game#blueprints');
 await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 const menu=page.locator('#blueprint-input-menu');
 assert.ok(await menu.isVisible());
 await menu.getByRole('button',{name:/From raw materials/}).click();
 assert.equal(await menu.getByRole('button',{name:/From raw materials/}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#blueprint-source').inputValue(),'All');
 const ids=await page.locator('.blueprint-card .blueprint-actions [data-action="blueprint-details"]').evaluateAll(elements=>elements.map(e=>e.dataset.id));
 assert.ok(ids.length>0&&ids.every(id=>atlas.blueprints.find(b=>b.id===id)?.rawOnly),'Raw menu lists raw modules');
 await menu.getByRole('button',{name:/Needs intermediate parts/}).click();
 assert.ok(await page.locator('.blueprint-card').count()>0);
 assert.equal(await page.locator('.starter-requires').count(),0,'Intermediate filter excludes raw-only modules');
 await menu.getByRole('button',{name:/From raw materials/}).click();
 await page.locator('#blueprint-search').fill('Military science pack');
 await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${latest.id}"]`).click();
 await page.locator('#blueprint-version').selectOption('1');
 await page.waitForFunction(()=>document.querySelector('#blueprint-version')?.value==='1'&&!document.querySelector('#blueprint-version')?.disabled&&document.querySelector('.explainer-intro')?.textContent.includes('19 × 77'));
 await page.locator('#modal [data-action="copy-blueprint"]').click();
 assert.equal(await page.evaluate(()=>window.__copiedBlueprint),previous.code,'Copy uses the selected historical string');
 assert.equal(await page.locator('#blueprint-version option').count(),latest.publication.history.length+1,'Current version remains selectable from history');
 await page.locator('#blueprint-version').selectOption(String(latest.publication.version));
 await page.waitForFunction(text=>document.querySelector('.explainer-intro')?.textContent.includes(text),`${latest.footprint.width} × ${latest.footprint.height}`);
 await page.locator('#modal [data-action="copy-blueprint"]').click();
 assert.equal(await page.evaluate(()=>window.__copiedBlueprint),latest.code);
 await fs.mkdir('test-results',{recursive:true});
 await page.locator('.blueprint-version-picker').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/blueprint-versions-1440.png'});
 await page.locator('[data-action="close-modal"]').click();
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-action="menu"]').click();
 await page.waitForFunction(()=>document.querySelector('.sidebar')?.getBoundingClientRect().left>=-0.1);
 assert.ok(await menu.getByRole('button',{name:/From raw materials/}).isVisible());
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'test-results/blueprint-filters-390.png'});
 await menu.getByRole('button',{name:/From raw materials/}).click();
 assert.equal(await page.locator('.sidebar.open').count(),0,'Choosing a mobile input filter closes navigation');
 assert.deepEqual(errors,[]);
 console.log('Versions and filters passed: recommended default, historical/current exact copies, preserved version choices, sidebar input filters, mobile width.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
