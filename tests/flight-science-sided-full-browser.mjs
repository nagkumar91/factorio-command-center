import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';

const root=path.resolve(new URL('..',import.meta.url).pathname),site=path.join(root,'site');
const screenshots=path.join(root,'scripts/flight-science-sided/full/.cache/browser');
await fs.mkdir(screenshots,{recursive:true});
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(site,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(site+path.sep))throw Error('Invalid path');
  res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.json')?'application/json':'text/plain');
  res.end(await fs.readFile(file));
 }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}/flight-science-sided/full/`;
 const response=await page.goto(url);assert.equal(response.status(),200);
 await page.locator('.map img').evaluate(async img=>{await img.decode();});
 assert(await page.locator('.map img').evaluate(img=>img.naturalWidth>1000));
 assert.equal(await page.locator('h1').count(),1);
 await page.getByRole('button',{name:'Tile detail'}).click();
 assert(await page.locator('.map').evaluate(e=>e.classList.contains('detail')));
 await page.getByRole('button',{name:'Fit layout'}).click();
 assert(!(await page.locator('.map').evaluate(e=>e.classList.contains('detail'))));
 await page.screenshot({path:path.join(screenshots,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile page overflows');
 await page.screenshot({path:path.join(screenshots,'mobile.png'),fullPage:true});
 await page.getByText('Import string',{exact:true}).click();
 const importText=await page.getByRole('textbox',{name:'Blueprint import string'}).inputValue();
 assert(importText.startsWith('0')&&importText.length>1000);
 const download=await page.getByRole('link',{name:'Download blueprint'}).getAttribute('href');
 assert.equal((await (await page.request.get(url+download)).text()).trim(),importText);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,screenshots}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
