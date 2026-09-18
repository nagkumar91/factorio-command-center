import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {createStore} from '../analytics/store.mjs';
import {checkSite} from '../ops/healthcheck.mjs';
import {createHandlers,loadLabels} from '../analytics/server.mjs';

const store=createStore({dbPath:':memory:',labels:await loadLabels(path.resolve('site'))});
const dashboard=await fs.readFile('analytics/dashboard.html','utf8');
const payloads=[],errors=[];
let handlers,base;
const server=http.createServer(async(req,res)=>{
 if(req.url==='/broken/'){res.setHeader('Content-Type','text/html');res.end('<h1>Every craftable item</h1><script>throw new Error("broken fixture")</script>');return;}
 if(req.url.startsWith('/collect')){let body='';for await(const chunk of req)body+=chunk;payloads.push(JSON.parse(body));try{store.ingest(JSON.parse(body),base);res.writeHead(202);}catch{res.writeHead(400);}res.end();return;}
 if(req.url.startsWith('/api/')||req.url==='/dashboard'){if(req.url==='/dashboard')req.url='/';return handlers.admin(req,res);}
 if(req.url==='/analytics-config.js'){res.setHeader('Content-Type','text/javascript');res.end('globalThis.FactorioAnalyticsConfig='+JSON.stringify({endpoint:base+'/collect',origins:[base]})+';');return;}
 try{const name=new URL(req.url,base).pathname;const file=path.join('site',name==='/'?'index.html':name);const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
handlers=createHandlers({store,allowedOrigins:[base],dashboard});
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
async function flush(){await page.evaluate(()=>FactorioAnalytics.flush());await new Promise(r=>setTimeout(r,100));}
try{
 await page.goto(base+'/#coverage');await page.locator('#coverage-search').fill('this text must stay private');await page.locator('#coverage-search').fill('tesla ammo');
 await page.locator('.coverage-item [data-action="blueprint-details"]').click();
 await page.locator('[data-action="copy-blueprint"]').click();
 await page.getByText('Blueprint string copied.',{exact:false}).waitFor();
 await page.locator('[data-action="crate-blueprint"]').click();await page.locator('[data-action="copy-output"]').click();await page.locator('[data-action="close-modal"]').click();
 await page.goto(base+'/#production');await page.locator('[data-action="production-preset"][data-id="robots"]').click();await page.locator('[data-action="production-export"]').click();await flush();
 const collected=payloads.flatMap(p=>p.events);
 for(const name of ['page_view','search_used','blueprint_open','blueprint_copy','construction_crate','command_copy','production_plan','plan_export'])assert.ok(collected.some(e=>e.event===name),name);
 assert.ok(!JSON.stringify(payloads).includes('this text must stay private'));assert.ok(!JSON.stringify(payloads).includes('/c '));assert.equal(store.report().summary.visitors,1);
 assert.equal(store.report().summary.sessions,1,'session persists through navigation');
 const trafficBefore=payloads.length;
 const healthy=await checkSite(browser,'github',base+'/','coverage');assert.equal(healthy.ok,true,healthy.error);
 assert.equal(payloads.length,trafficBefore,'synthetic visits do not increase visitor analytics');
 const broken=await checkSite(browser,'pi',base+'/broken/','coverage');assert.equal(broken.httpStatus,200);assert.equal(broken.ok,false);assert.match(broken.error,/broken fixture/);
 const missing=await checkSite(browser,'pi',base+'/missing/','coverage');assert.equal(missing.httpStatus,404);assert.equal(missing.ok,false);
 await page.locator('[data-action="analytics-settings"]').click();await page.getByRole('button',{name:'Turn off usage analytics'}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('factorio-analytics-visitor')),null);
 const before=payloads.length;await page.locator('[data-action="close-modal"]').click();await page.goto(base+'/#blueprints');await flush();assert.equal(payloads.length,before,'opt out persists through reload');
 // Browser privacy signals must suppress both storage and network collection.
 for(const signal of ['doNotTrack','globalPrivacyControl']){
  const privateContext=await browser.newContext();await privateContext.addInitScript(signal=>Object.defineProperty(navigator,signal,{get:()=>signal==='doNotTrack'?'1':true}),signal);
  const privatePage=await privateContext.newPage();await privatePage.goto(base+'/#coverage');assert.equal(await privatePage.evaluate(()=>FactorioAnalytics.status().enabled),false);assert.equal(await privatePage.evaluate(()=>localStorage.getItem('factorio-analytics-visitor')),null);await privatePage.evaluate(()=>FactorioAnalytics.flush());await privateContext.close();
 }
 assert.equal(payloads.length,before);
 const offline=await browser.newContext();await offline.setOffline(true);const local=await offline.newPage();await local.goto(pathToFileURL(path.resolve('site/index.html')).href+'#coverage');assert.equal(await local.evaluate(()=>FactorioAnalytics.status().enabled),false);await offline.close();
 await page.goto(base+'/dashboard');await page.locator('#visitors').filter({hasText:'1'}).waitFor();assert.equal(await page.locator('#blueprints tbody tr').count(),1);
 await page.locator('#period').selectOption('30');await page.waitForFunction(()=>document.querySelectorAll('.day').length===30);
 await page.locator('.day').last().click();assert.match(await page.locator('#chart-detail').textContent(),/visitors/);
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/analytics-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'test-results/analytics-mobile.png',fullPage:true});
 // Render an empty report and a server failure without fabricating counts.
 await page.route('**/api/report?*',route=>route.fulfill({json:{...store.report(),firstEvent:null,summary:{visitors:0,sessions:0,pageViews:0,actions:0,recent:0},pages:[],actions:[],blueprints:[],sources:[],devices:[],sites:[],activity:[]}}));
 await page.locator('#refresh').click();await page.locator('#empty-notice').waitFor();
 await page.route('**/api/report?*',route=>route.fulfill({status:503,body:'Unavailable'}));await page.locator('#refresh').click();await page.getByText('Refresh failed. Showing the last report.').waitFor();
 assert.deepEqual(errors,[]);console.log('Analytics browser passed: live app actions, privacy controls, offline use, visitor/session counts, dashboard charts, empty/error states and mobile.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
