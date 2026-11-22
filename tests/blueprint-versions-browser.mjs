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
 await page.setViewportSize({width:1440,height:1050});

 // Essentials mall: two tested versions, each with its own string, size and measured rates.
 const mall=atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/essentials-mall/essentials-mall.txt');
 assert.equal(mall.publication.version,2);
 const mallOld=JSON.parse(await fs.readFile(path.join(site,mall.publication.history[0].url)));
 await page.goto(url+'?collection=essentials#blueprints');
 await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 await page.locator('#blueprint-direction').selectOption('outputs');
 for(const id of mall.products){
  await page.locator('#blueprint-search').fill(id.replaceAll('-',' '));
  await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${mall.id}"]`).waitFor({timeout:5000});
 }
 await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${mall.id}"]`).click();
 const options=await page.locator('#blueprint-version option').allInnerTexts();
 assert.equal(options.length,2,'the mall offers both versions');
 assert.match(options[0],/Version 2 · Sixteen rows · Recommended · 23 × 16 tiles · Fast transport belt 13\.55\/min/);
 assert.match(options[1],/Version 1 · One column west · 23 × 17 tiles · Fast transport belt 14\.85\/min/);
 const compare=page.locator('#modal .version-compare');
 assert.equal(await compare.locator('tbody tr').count(),2);
 assert.match(await compare.locator('tbody tr[data-version="2"]').innerText(),/23 × 16 tiles[\s\S]*19[\s\S]*13\.55[\s\S]*recovery 13\.2/);
 assert.match(await compare.locator('tbody tr[data-version="1"]').innerText(),/23 × 17 tiles[\s\S]*19[\s\S]*14\.85[\s\S]*recovery 14\.9/);
 assert.equal(await compare.locator('tr.selected-version').getAttribute('data-version'),'2','recommended opens by default');
 await page.locator('#blueprint-version').selectOption('1');
 await page.waitForFunction(()=>document.querySelector('#blueprint-version')?.value==='1'&&!document.querySelector('#blueprint-version')?.disabled&&document.querySelector('.explainer-intro')?.textContent.includes('23 × 17'));
 assert.equal(await page.locator('#modal .version-compare tr.selected-version').getAttribute('data-version'),'1');
 assert.match(await page.locator('#modal .validation-note').innerText(),/fast-transport-belt 14\.85\/min/);
 await page.locator('#modal [data-action="copy-blueprint"]').click();
 assert.equal(await page.evaluate(()=>window.__copiedBlueprint),mallOld.code,'copy gives the one-column-west string');
 await page.locator('#blueprint-version').selectOption('2');
 await page.waitForFunction(()=>document.querySelector('#blueprint-version')?.value==='2'&&document.querySelector('.explainer-intro')?.textContent.includes('23 × 16'));
 assert.match(await page.locator('#modal .validation-note').innerText(),/fast-transport-belt 13\.55\/min/);
 await page.locator('#modal [data-action="copy-blueprint"]').click();
 assert.equal(await page.evaluate(()=>window.__copiedBlueprint),mall.code,'copy gives the sixteen-rows string');
 await page.locator('.blueprint-version-picker').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/blueprint-versions-mall-1440.png'});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'the comparison scrolls inside its box at phone width');
 await page.screenshot({path:'test-results/blueprint-versions-mall-390.png'});
 await page.locator('[data-action="close-modal"]').click();
 await page.setViewportSize({width:1440,height:1050});

 // Flight robots: two tested versions on one card, found by each of its three products.
 const robots=atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/flight-robots/robots-10-roboport-1.txt');
 assert.equal(robots.id,'designed-120a56b5bf85f2f8');assert.equal(robots.publication.version,2);
 const robotsOld=JSON.parse(await fs.readFile(path.join(site,robots.publication.history[0].url)));
 await page.goto(url+'#blueprints');
 await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 await page.locator('#blueprint-direction').selectOption('outputs');
 for(const id of ['construction-robot','logistic-robot','roboport']){
  await page.locator('#blueprint-search').fill(id.replaceAll('-',' '));
  await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${robots.id}"]`).waitFor({timeout:5000});
  assert.equal(await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${robots.id}"]`).count(),1,id+': one card, not two');
 }
 await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${robots.id}"]`).click();
 const robotOptions=await page.locator('#blueprint-version option').allInnerTexts();
 assert.equal(robotOptions.length,2,'flight robots offers both versions');
 assert.match(robotOptions[0],/Version 2 · Smaller, pair swapped · Recommended · 96 × 18 tiles · Roboport 1\/min$/,'headline: the product whose rate differs most');
 assert.match(robotOptions[1],/Version 1 · Earlier, one more assembler · 106 × 18 tiles · Roboport 1\.07\/min$/);
 const robotCompare=page.locator('#modal .version-compare');
 assert.match(await robotCompare.locator('tbody tr[data-version="2"]').innerText(),/96 × 18 tiles[\s\S]*48[\s\S]*10\.1[\s\S]*recovery 13\.67[\s\S]*10\.13[\s\S]*recovery 17\.33[\s\S]*1[\s\S]*recovery 1/);
 assert.match(await robotCompare.locator('tbody tr[data-version="1"]').innerText(),/106 × 18 tiles[\s\S]*49[\s\S]*10\.13[\s\S]*recovery 11\.33[\s\S]*10\.13[\s\S]*recovery 15[\s\S]*1\.07[\s\S]*recovery 1/);
 assert.equal(await robotCompare.locator('tr.selected-version').getAttribute('data-version'),'2','recommended opens by default');
 await page.locator('#blueprint-version').selectOption('1');
 await page.waitForFunction(()=>document.querySelector('#blueprint-version')?.value==='1'&&!document.querySelector('#blueprint-version')?.disabled&&document.querySelector('.explainer-intro')?.textContent.includes('106 × 18'));
 assert.match(await page.locator('#modal .validation-note').innerText(),/roboport 1\.07\/min/);
 await page.locator('#modal [data-action="copy-blueprint"]').click();
 assert.equal(await page.evaluate(()=>window.__copiedBlueprint),robotsOld.code,'copy gives the earlier 106 x 18 string');
 await page.locator('#blueprint-version').selectOption('2');
 await page.waitForFunction(()=>document.querySelector('#blueprint-version')?.value==='2'&&document.querySelector('.explainer-intro')?.textContent.includes('96 × 18'));
 await page.locator('#modal [data-action="copy-blueprint"]').click();
 assert.equal(await page.evaluate(()=>window.__copiedBlueprint),robots.code,'copy gives the current 96 x 18 string');
 await page.locator('.blueprint-version-picker').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/blueprint-versions-flight-robots-1440.png'});
 await page.locator('[data-action="close-modal"]').click();
 // Electric smelter: eight module versions; the picker also shows ore in per minute and power for each.
 const smelter=atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/electric-smelter-pass-through/electric-smelter-pass-through.txt');
 const [smelterManifest]=JSON.parse(await fs.readFile('blueprint-sources/electric-smelter-pass-through/manifest.json'));
 await page.goto(url+'index.html');await page.goto(url+'index.html?inputs=all#blueprints');
 await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 await page.locator('#blueprint-direction').selectOption('all');
 await page.locator('#blueprint-search').fill('smelter ore through east');
 await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${smelter.id}"]`).click();
 const smelterOptions=await page.locator('#blueprint-version option').allInnerTexts();
 assert.equal(smelterOptions.length,8,'eight module versions');
 // Alternatives, not successive versions: options are named by their label alone (no "Version N ·" prefix, which counted backwards).
 assert.match(smelterOptions[0],/^No modules · Recommended · 30 × 20 tiles · Iron plate 900\/min$/);
 assert.equal(smelterOptions[7].split(' · ')[0],'Speed modules, tier three');
 assert.ok(smelterOptions.every(o=>!/^Version \d/.test(o)),'no reversed version numbers: '+smelterOptions.join(' | '));
 const smelterCompare=page.locator('#modal .version-compare');
 assert.equal(await smelterCompare.locator('thead th[data-input-item="iron-ore"]').count(),1,'an ore-in column');
 assert.equal(await smelterCompare.locator('thead th',{hasText:'Power'}).count(),1,'a power column');
 for(const [i,v] of smelterManifest.versions.entries()){
  const row=smelterCompare.locator(`tbody tr[data-version="${8-i}"]`);
  assert.equal((await row.locator('td[data-input-item="iron-ore"]').innerText()).trim(),new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v.inputsPerMinute['iron-ore']),v.label+' ore in');
  assert.match(await row.locator('td[data-power]').innerText(),/^[\d,]+ kW$/,v.label+' power');
 }
 assert.match((await smelterCompare.locator('tbody tr[data-version="8"] th').innerText()).trim(),/^No modules Recommended$/,'comparison rows carry the label alone');
 assert.equal(await page.locator('#modal .version-downloads a').first().innerText(),'Download No modules');
 await page.locator('#blueprint-version').selectOption('4');
 await page.waitForFunction(()=>document.querySelector('#blueprint-version')?.value==='4'&&!document.querySelector('#blueprint-version')?.disabled);
 await page.locator('#modal [data-action="copy-blueprint"]').click();
 assert.equal(await page.evaluate(()=>window.__copiedBlueprint),(await fs.readFile('blueprint-sources/electric-smelter-pass-through/'+smelterManifest.versions[4].file,'utf8')).trim(),'copy gives the productivity three string');
 await page.locator('[data-action="close-modal"]').click();
 // Processing-unit supplier: two successive versions (the layout it replaced is kept), so the numbered names stay.
 const unit=atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/processing-units/processing-units.txt');
 assert.ok(unit&&unit.publication.version===2&&!('alternatives' in unit.publication),'successive versions carry no alternatives flag');
 await page.goto(url+'index.html');await page.goto(url+'index.html?inputs=all#blueprints');
 await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 await page.locator('#blueprint-direction').selectOption('all');
 await page.locator('#blueprint-search').fill('processing unit supplier');
 await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${unit.id}"]`).click();
 const unitOptions=await page.locator('#blueprint-version option').allInnerTexts();
 assert.equal(unitOptions.length,2);
 assert.match(unitOptions[0],/^Version 2 · Shared channel · Recommended · 31 × 28 tiles · Processing unit 26\.83\/min$/);
 assert.match(unitOptions[1],/^Version 1 · Twin rows · 31 × 29 tiles · Processing unit 26\.57\/min$/);
 assert.match(await page.locator('#modal .version-downloads').innerText(),/Download v2 · Shared channel[\s\S]*Download v1 · Twin rows/);
 await page.locator('[data-action="close-modal"]').click();
 // Families without recorded inputs or power keep the earlier table: no extra columns.
 await page.goto(url+'index.html');await page.goto(url+'?collection=essentials#blueprints');
 await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 await page.locator('#blueprint-direction').selectOption('all');
 await page.locator('#blueprint-search').fill('essentials mall');
 await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${mall.id}"]`).click();
 assert.equal(await page.locator('#modal .version-compare [data-input-item], #modal .version-compare [data-power]').count(),0,'mall table unchanged');
 assert.equal(await page.locator('#modal .blueprint-version-picker h4').innerText(),'Measured output per minute, by version');
 await page.locator('[data-action="close-modal"]').click();
 await page.goto(url+'index.html'); // the next library visit loads a fresh page, not a same-URL hash change

 // Every versioned design shows each version's size, machines and output per minute, or "Not measured".
 const versioned=atlas.blueprints.filter(b=>b.publication?.history?.length);
 assert.ok(versioned.length>=11,"ten earlier versioned designs plus the mall");
 for(const b of versioned){
  await page.goto(url+'#blueprints');
  await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
  await page.locator('#blueprint-search').fill(b.name);
  await page.locator(`.blueprint-actions [data-action="blueprint-details"][data-id="${b.id}"]`).click();
  const rows=page.locator('#modal .version-compare tbody tr');
  assert.equal(await rows.count(),b.publication.history.length+1,b.id+': one row per version');
  for(const text of await page.locator('#blueprint-version option').allInnerTexts())assert.match(text,/ × \d+ tiles · .+ (\d[\d.,]*\/min|Not measured)$/,b.id+': option carries size and headline rate');
  const cells=await page.locator('#modal .version-compare tbody td[data-rate-item]').allInnerTexts();
  assert.ok(cells.length>=await rows.count()&&cells.every(t=>/^(<?[\d.,]+|Not measured)(\s|$)/.test(t.trim())),b.id+': every rate cell is a number or Not measured');
  for(const text of await rows.allInnerTexts())assert.match(text,/ × \d+ tiles[\s\S]*\d/,b.id+': size and machines');
  await page.locator('[data-action="close-modal"]').click();
 }

 // Guide page: both strings, labelled, with copy and download.
 const [manifest]=JSON.parse(await fs.readFile('blueprint-sources/essentials-mall/manifest.json'));
 await page.goto(url+'essentials-mall/index.html');
 const section=page.locator('#versions');
 await section.getByRole('heading',{name:'Two tested versions: which to choose'}).waitFor();
 assert.match(await section.innerText(),/Sixteen rows \(recommended\): smallest: 23 × 16 = 368 tiles[\s\S]*One column west: 23 × 17 = 391 tiles; faster for Fast transport belt \(14\.85\/min\)/);
 for(const [i,v] of manifest.versions.entries()){
  await section.getByRole('button',{name:`Copy ${v.label} import`}).click();
  assert.equal(await page.evaluate(()=>window.__copiedBlueprint),(await fs.readFile(path.join('blueprint-sources/essentials-mall',v.file),'utf8')).trim(),v.label+' copy');
  const href=await section.getByRole('link',{name:`Download ${v.label} import`}).getAttribute('href');
  assert.equal(href,v.file);
  const response=await page.request.get(new URL(href,page.url()).href);assert.equal(response.status(),200);
  assert.equal((await response.text()).trim(),(await fs.readFile(path.join('blueprint-sources/essentials-mall',v.file),'utf8')).trim());
 }
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'guide page fits a phone');
 await section.scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/essentials-mall-versions-390.png'});
 // Flight robots guide page: the shared which-to-choose section, both strings with copy, download and report.
 const [robotManifest]=JSON.parse(await fs.readFile('blueprint-sources/flight-robots/manifest.json'));
 await page.setViewportSize({width:1440,height:1050});
 await page.goto(url+'flight-robots/index.html');
 const robotSection=page.locator('#versions');
 await robotSection.getByRole('heading',{name:'Two tested versions: which to choose'}).waitFor();
 assert.match(await robotSection.innerText(),/Smaller, pair swapped \(recommended\): smallest: 96 × 18 = 1728 tiles[\s\S]*Earlier, one more assembler: 106 × 18 = 1908 tiles; faster for Construction robot \(10\.13\/min\), Roboport \(1\.07\/min\)/);
 for(const v of robotManifest.versions){
  const code=(await fs.readFile(path.join('blueprint-sources/flight-robots',v.file),'utf8')).trim();
  await robotSection.getByRole('button',{name:`Copy ${v.label} import`}).click();
  assert.equal(await page.evaluate(()=>window.__copiedBlueprint),code,v.label+' copy');
  const href=await robotSection.getByRole('link',{name:`Download ${v.label} import`}).getAttribute('href');
  assert.equal(href,v.file);
  const response=await page.request.get(new URL(href,page.url()).href);assert.equal(response.status(),200);
  assert.equal((await response.text()).trim(),code);
  const card=robotSection.locator('.version-card').filter({hasText:v.blueprintSha256});
  const report=await page.request.get(new URL(await card.getByRole('link',{name:'Native report'}).getAttribute('href'),page.url()).href);
  assert.ok((await report.json()).builds.some(b=>b.blueprintSha256===v.blueprintSha256&&b.passed===true),v.label+' report link');
 }
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'flight robots guide page fits a phone');
 await robotSection.scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/flight-robots-versions-390.png'});
 assert.deepEqual(errors,[]);
 console.log('Versions and filters passed: recommended default, historical/current exact copies, preserved version choices, sidebar input filters, mobile width; essentials mall two versions with rates; rates for every versioned design; guide page copies and downloads; flight robots two versions in the library and on its guide page.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
