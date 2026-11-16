// Default verifies the indexed release. --fixtures exercises UI offline while native agents run.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import {RELEASE_GROUP,todayRecords,verifyToday,renderToday} from '../scripts/todays-flight-builds.mjs';
const site=path.resolve('site'),fixtures=process.argv.includes('--fixtures');
const atlas=JSON.parse(await fs.readFile(path.join(site,'data/atlas.json'))),catalog=JSON.parse(await fs.readFile(path.join(site,'data/catalog.json')));
if(fixtures){
 for(const b of atlas.blueprints)if(['compact-expansion-workshop','rgby-science','five-science'].some(f=>b.file?.startsWith('sources/designed-blueprints/'+f+'/')))b.releaseGroup=RELEASE_GROUP;
 for(const [folder,section,products,inputs,purpose] of [
  ['robot-logistics-workshop','Robots and logistics',['construction-robot','logistic-robot','roboport','passive-provider-chest','storage-chest'],['iron-plate','copper-plate','steel-plate','plastic-bar','water','sulfuric-acid','lubricant'],'Robot production'],
  ['inserter-workshop','Inserters',['inserter','long-handed-inserter','fast-inserter','bulk-inserter'],['iron-plate','copper-plate','plastic-bar'],'Production']
 ]){
  const b=structuredClone(atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/compact-expansion-workshop/')));
  Object.assign(b,{id:'fixture-'+folder,name:'Fixture '+folder,releaseGroup:RELEASE_GROUP,category:section,section,purpose,products,file:'sources/designed-blueprints/'+folder+'/blueprint.txt',sourceURL:folder+'/index.html',measuredOutputsPerMinute:undefined});
  Object.assign(b.analysis,{kind:purpose,inputs,outputs:products,netOutputs:products});
  b.validation.note='UI fixture only; not native qualification.';atlas.blueprints.push(b);
 }
}
const entries=todayRecords(atlas);if(!fixtures)await verifyToday(entries,site);
const nav={};vm.createContext(nav);vm.runInContext(await fs.readFile(path.join(site,'flight-plans.js'),'utf8'),nav);
const overview=renderToday(entries,nav.FlightPlans.links('../','today-overview'),catalog);
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');let name=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
  const file=path.resolve(site,'.'+name);if(!file.startsWith(site+path.sep))throw Error('Outside site');
  res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');
  if(name==='/data/atlas.js')res.end('globalThis.FactorioData.atlas='+JSON.stringify(atlas));
  else if(name==='/data/atlas.json')res.end(JSON.stringify(atlas));
  else if(name==='/todays-flight-builds/index.html')res.end(overview);
  else res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'})});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[],external=[];
await context.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
await context.addInitScript(()=>{localStorage.setItem('factorio-analytics-opt-out','1');Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const count=async n=>{await page.waitForFunction(n=>document.querySelectorAll('.blueprint-card').length===n,n);};
try{
 await page.goto(base+'index.html?collection=today#blueprints');await page.reload();await count(9);
 assert.equal(await page.locator('#blueprint-source').inputValue(),"Today's flight builds");
 await page.locator('#blueprint-input-menu').getByRole('button',{name:/Needs intermediate parts/}).click();await count(9);
 assert.equal(await page.locator('#blueprint-source').inputValue(),"Today's flight builds");
 const ids=await page.locator('.blueprint-actions [data-action="blueprint-details"]').evaluateAll(els=>els.map(e=>e.dataset.id));
 assert.deepEqual(ids.sort(),entries.map(b=>b.id).sort());
 for(const section of ['Robots and logistics','Inserters','Science · five packs from plates','Science · four packs from plates'])assert.ok(await page.locator('#blueprint-category option').filter({hasText:section}).count());
 await page.locator('#blueprint-category').selectOption('Inserters');await count(1);
 await page.locator('#blueprint-category').selectOption('All');await page.locator('#blueprint-kind').selectOption('Robot production');await count(1);
 await page.locator('#blueprint-kind').selectOption('All');await page.locator('#blueprint-direction').selectOption('inputs');await page.locator('#blueprint-search').fill('plastic');
 const expectedPlastic=entries.filter(b=>b.analysis.inputs.includes('plastic-bar')).length;await count(expectedPlastic);
 await page.locator('#blueprint-search').fill('water');await count(entries.filter(b=>b.analysis.inputs.includes('water')).length);
 await page.locator('#blueprint-direction').selectOption('outputs');await page.locator('#blueprint-search').fill('robot');await count(1);
 await page.locator('#blueprint-source').selectOption('Long game flight plans and strategies');
 assert.ok(await page.locator('.blueprint-card').count()>1,'Earlier robot versions stay searchable');
 for(const folder of ['rgby-science','five-science']){
  await page.goto(base+'index.html?collection=today#blueprints');await page.reload();await count(9);
  await page.locator('#blueprint-category').selectOption(folder==='five-science'?'Science · five packs from plates':'Science · four packs from plates');await count(3);
 }
 await page.goto(base+'index.html?collection=flight-plans#blueprints');assert.equal(await page.locator('#blueprint-source').inputValue(),'Long game flight plans and strategies');
 await page.goto(base+'index.html?collection=optimized#blueprints');assert.equal(await page.locator('#blueprint-source').inputValue(),'Autosaved · optimized v2');
 await page.goto(base+'todays-flight-builds/index.html');assert.equal(await page.locator('[data-build-id]').count(),9);
 await page.locator('[data-copy]').first().click();assert.equal(await page.evaluate(()=>window.__copied),entries[0].code);
 assert.equal(await page.getByRole('link',{name:'Open all nine in the main library →'}).getAttribute('href'),'../index.html?collection=today#blueprints');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile summary fits viewport');
 await page.locator('[data-flight-menu]').click();assert.equal(await page.locator('[data-flight-menu]').getAttribute('aria-expanded'),'true');
 await page.keyboard.press('Escape');assert.equal(await page.locator('[data-flight-menu]').getAttribute('aria-expanded'),'false');
 await page.goto(base+'index.html?collection=today#blueprints');await page.reload();await count(9);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(`${fixtures?'OFFLINE FIXTURES':'INDEXED RELEASE'}: nine imports; sections, purpose, plastic/fluid inputs, robot outputs, earlier versions, science variants, old URLs, copy and mobile layout passed.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
