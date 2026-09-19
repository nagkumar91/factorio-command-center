import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const base=process.env.TEST_URL||pathToFileURL(path.resolve('site/index.html')).href;
const manifest=JSON.parse(await fs.readFile('blueprint-sources/early-game/manifest.json'));
const research=JSON.parse(await fs.readFile('blueprint-sources/early-game/research.json'));
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
if(base.startsWith('file:'))await context.setOffline(true);
await context.addInitScript(()=>localStorage.setItem('factorio-analytics-opt-out','1'));
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
const url=new URL(base);url.searchParams.set('collection','early-game');url.hash='blueprints';
try{
 await page.goto(url.href);await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 assert.equal(await page.locator('#blueprint-source').inputValue(),'Early game · no robots');
 assert.ok((await page.locator('.results-heading').textContent()).includes(manifest.length+' builds'));
 assert.equal(await page.locator('.blueprint-card h3').first().textContent(),manifest[0].name);
 const stages=research.stages.filter(s=>s.modules.length);
 assert.equal(await page.locator('[data-action="starter-unlock"]').count(),stages.length);
 await page.locator('.starter-roadmap summary').click();
 const stage=stages.find(s=>s.id==='gate');
 await page.locator(`[data-action="starter-unlock"][data-id="${stage.id}"]`).click();
 assert.equal(await page.locator('.blueprint-card').count(),stage.modules.length);
 await page.locator('[data-action="explore-feature"][data-id="early-game"]').first().click();
 await page.locator('#blueprint-direction').selectOption('outputs');
 // Exercise all modules, including those beyond the first page.
 for(const info of manifest){
  await page.locator('#blueprint-search').fill(info.products[0]);
  await page.locator(`[data-action="blueprint-details"][data-id="${info.id}"]`).first().click();
  await page.getByText('Layout tested in Factorio',{exact:true}).waitFor();
  const setup=await page.locator('.cell-setup').textContent();assert.ok(setup.includes('No robots required'));assert.ok(setup.includes('external electricity'));
  assert.ok(setup.includes('big electric pole marked P'));assert.ok(setup.includes('Medium electric poles'));assert.ok(setup.includes('Electric energy distribution 1'));
  assert.ok(setup.includes('Press Alt'));assert.ok(setup.includes('Display panels need Circuit network'));assert.ok(setup.includes('leave their ghosts unbuilt'));
  const preview=page.locator('.detail-layout');await preview.waitFor();assert.match(await preview.getAttribute('src'),/\?v=[a-f0-9]{12}$/);await page.waitForFunction(()=>document.querySelector('.detail-layout')?.complete);assert.ok(await preview.evaluate(i=>i.naturalWidth>0));
  await page.locator('[data-action="copy-blueprint"]').click();const code=await page.evaluate(()=>navigator.clipboard.readText());
  assert.equal(code,(await fs.readFile('blueprint-sources/early-game/'+info.file,'utf8')).trim());
  assert.equal(decodeBlueprint(code).blueprint.entities.some(e=>/roboport|requester|infinity/.test(e.name)),false);
  assert.equal(decodeBlueprint(code).blueprint.entities.some(e=>['assembling-machine-1','stone-furnace','small-electric-pole'].includes(e.name)),false);
  for(const pole of ['big-electric-pole','medium-electric-pole'])assert.ok(decodeBlueprint(code).blueprint.entities.some(e=>e.name===pole));
  assert.equal(decodeBlueprint(code).blueprint.entities.filter(e=>e.name==='display-panel').length,info.ports.filter(p=>p.displayEntity).length);
  assert.equal(await page.locator('.cell-setup a[download]').getAttribute('href'),'sources/early-game/unlocks/'+info.unlock+'.txt');
  if(info.id==='early-raw-inserter'){
   assert.ok(setup.includes('assembling machine 2'));assert.ok(setup.includes('steel furnaces'));
   await page.locator('[data-action="crate-blueprint"]').click();const command=await page.locator('#command-output').inputValue();assert.match(command,/assembling-machine-2/);assert.match(command,/steel-furnace/);assert.match(command,/steel-chest/);assert.match(command,/big-electric-pole/);assert.match(command,/medium-electric-pole/);assert.ok(!/assembling-machine-1|stone-furnace|small-electric-pole|roboport|requester-chest|passive-provider-chest|infinity-chest/.test(command));
  }
  await page.locator('[data-action="close-modal"]').click();
 }
 await page.locator('#blueprint-search').fill('');
 assert.equal(await page.getByRole('link',{name:'Download starter book'}).getAttribute('href'),'sources/collections/early-game.txt');
 await page.locator('[data-action="explore-feature"][data-id="all"]').first().click();assert.equal(await page.locator('#blueprint-source').inputValue(),'All');
 await page.locator('[data-action="explore-feature"][data-id="early-game"]').first().click();
 await fs.mkdir('test-results',{recursive:true});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow at '+width);
  await page.screenshot({path:`test-results/early-game-${width}.png`,fullPage:false,animations:'disabled'});
 }
 assert.deepEqual(errors,[]);console.log('Starter browser passed: '+manifest.length+' raw modules, research filters, labeled previews, exact copies, construction crate, book links and responsive views.');
}finally{await browser.close();}
