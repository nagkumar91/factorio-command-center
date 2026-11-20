import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=pathToFileURL(process.cwd()+'/site/index.html').href;
const titles=async()=>(await page.locator('.blueprint-card h3').evaluateAll(n=>n.map(e=>e.textContent.trim())));
const search=async(direction,query)=>{await page.locator('#blueprint-direction').selectOption(direction);await page.locator('#blueprint-search').fill(query);return titles();};
try{
 await page.goto(url+'?collection=flight-plans#blueprints');await page.reload();await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 assert.equal(await page.locator('#blueprint-source').inputValue(),'Long game flight plans and strategies');
 const four='Four-pack science · 30/min · 15 connected labs',five='Five-pack science · 30/min · 30 connected labs · substations',nursery='Renewable tree nursery · solar powered';
 assert.ok((await search('outputs','utility science pack')).includes(four),'outputs: utility science pack');
 assert.ok((await search('outputs','production science pack')).includes(five),'outputs: production science pack');
 assert.ok((await search('outputs','pollution')).includes(nursery),'outputs: pollution');
 const all=await search('all','utility science pack');assert.ok(all.some(t=>/connected labs/.test(t)),'all: utility science pack');
 await page.locator('#blueprint-search').fill('utility science pack');
 const card=page.locator('.blueprint-card').filter({has:page.locator('h3',{hasText:four})});assert.equal(await card.count(),1);
 assert.ok((await card.first().textContent()).includes('MAKES AND USES INSIDE'),'card label');
 await card.first().getByRole('button',{name:/Explore/}).click();assert.ok((await page.locator('#modal').textContent()).includes('Made and used inside'),'detail line');
 // Essentials round: an output search for one product of each design finds it, and an input search
 // for electronic circuits finds the three consumers (the supplier produces them instead).
 const supplier='Green-circuit supplier · 360/min',mall='Essentials mall · eight building products on demand',robots='Robot essentials · 5/5/0.5/2/2 per minute',six='Six-pack science · 30/min each';
 await page.keyboard.press('Escape');await page.locator('#modal').evaluate(d=>d.open&&d.close());await page.locator('#blueprint-search').fill('');
 for(const [query,title] of [['electronic circuit',supplier],['electric mining drill',mall],['roboport',robots],['military science pack',six]]){const found=await search('outputs',query);assert.ok(found.includes(title),'outputs: '+query+' gave '+found.join(' | '));}
 const consumers=await search('inputs','electronic circuit');for(const title of [mall,robots,six])assert.ok(consumers.includes(title),'inputs: electronic circuit finds '+title);assert.ok(!consumers.includes(supplier),'the supplier does not need circuits');
 await page.goto(url+'?collection=essentials#blueprints');await page.reload();await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 assert.equal(await page.locator('#blueprint-source').inputValue(),'Essentials · 21 November');
 assert.deepEqual([...await titles()].sort(),[supplier,mall,robots,six].sort(),'essentials view lists exactly the four');
 assert.ok((await page.locator('.collection-banner').textContent()).includes('Essentials builds'));
 assert.deepEqual([...await search('inputs','electronic circuit')].sort(),[mall,robots,six].sort());
 assert.deepEqual(await search('outputs','electronic circuit'),[supplier]);
 assert.deepEqual(errors,[]);console.log('Blueprint search fields: lab-connected science and forestry builds are findable by output search; the essentials are findable by input and output.');
}finally{await browser.close();}
