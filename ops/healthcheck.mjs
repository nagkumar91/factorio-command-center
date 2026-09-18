import {chromium} from 'playwright';
import {randomInt,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

export const pages={commands:'Command library',crates:'Crate builder',blueprints:'Blueprint library',coverage:'Every craftable item',production:'Production planner',files:'Source files',setup:'Game setup'};
export const sites={github:'https://nagkumar91.github.io/factorio-command-center/',pi:'http://127.0.0.1:18090/'};
export async function checkSite(browser,site,base,route){
 const started=Date.now(),errors=[];
 const result={id:randomUUID(),ts:new Date().toISOString(),site,route,url:base+'#'+route,synthetic:true,ok:false,httpStatus:null};
 const context=await browser.newContext({extraHTTPHeaders:{DNT:'1','X-Factorio-Healthcheck':'1'},viewport:{width:1280,height:900}});
 await context.addInitScript(()=>{localStorage.setItem('factorio-analytics-opt-out','1');Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message.slice(0,300)));
 page.on('response',response=>{if(response.status()>=400&&['document','script','stylesheet'].includes(response.request().resourceType()))errors.push('HTTP '+response.status()+' loading '+new URL(response.url()).pathname);});
 try{
  const response=await page.goto(result.url,{waitUntil:'networkidle',timeout:30000});
  result.httpStatus=response?.status()||null;
  if(result.httpStatus!==200)throw new Error('Page returned HTTP '+result.httpStatus);
  await page.getByRole('heading',{name:pages[route],exact:true}).waitFor({timeout:10000});
  if(errors.length)throw new Error(errors.join('; '));
  if(await page.evaluate(()=>globalThis.FactorioAnalytics?.status().enabled))throw new Error('Synthetic traffic was not excluded from visitor analytics');
  if(route==='coverage'){
   const expected=await page.evaluate(()=>FactorioData.atlas.coverage.total);
   if(await page.locator('.coverage-item').count()!==expected)throw new Error('Craftable item coverage did not render completely');
  }
  if(route==='blueprints'&&await page.locator('[data-action="blueprint-details"]').count()===0)throw new Error('No blueprint cards rendered');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Page overflows horizontally');
  result.ok=true;
 }catch(error){result.error=String(error.message).slice(0,1000);}
 finally{result.durationMs=Date.now()-started;await context.close();}
 return result;
}
export async function saveChecks(directory,results,phase='scheduled'){
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'healthchecks.jsonl');let rows=[];
 try{rows=(await fs.readFile(file,'utf8')).trim().split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);}catch(e){if(e.code!=='ENOENT')throw e;}
 rows=rows.filter(row=>Date.parse(row.ts)>Date.now()-90*86400000);
 rows.push(...results.map(result=>({...result,phase})));
 await fs.writeFile(file+'.tmp',rows.map(row=>JSON.stringify(row)).join('\n')+'\n',{mode:0o600});await fs.rename(file+'.tmp',file);
 const summary={updatedAt:new Date().toISOString(),phase,sites:results};
 await fs.writeFile(path.join(directory,'health-latest.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
 return summary;
}
async function main(){
 const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
 const phase=arg('--phase')||'scheduled',only=arg('--site'),selected=arg('--route');
 if(!['scheduled','verification','readiness'].includes(phase)||only&&!sites[only]||selected&&!pages[selected])throw Error('Invalid healthcheck option');
 const directory=process.env.FACTORIO_STATE_DIR||path.join(os.homedir(),'.local/share/factorio-command-center');
 const names=Object.keys(pages),route=selected||names[randomInt(names.length)],results=[];
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--disable-dev-shm-usage']});
  for(const [site,base] of Object.entries(sites))if(!only||only===site)results.push(await checkSite(browser,site,base,route));
 }catch(error){for(const site of Object.keys(sites))if((!only||only===site)&&!results.some(r=>r.site===site))results.push({id:randomUUID(),ts:new Date().toISOString(),site,route,synthetic:true,ok:false,httpStatus:null,durationMs:0,error:'Browser unavailable: '+error.message.slice(0,300)});}
 finally{await browser?.close();}
 console.log(JSON.stringify(await saveChecks(directory,results,phase)));
 process.exitCode=results.every(r=>r.ok)?0:1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
