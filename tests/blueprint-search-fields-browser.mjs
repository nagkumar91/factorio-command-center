import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=pathToFileURL(process.cwd()+'/site/index.html').href;
const titles=async()=>(await page.locator('.blueprint-card h3').evaluateAll(n=>n.map(e=>e.textContent.trim())));
const search=async(direction,query)=>{await page.locator('#blueprint-direction').selectOption(direction);await page.locator('#blueprint-search').fill(query);return titles();};
// Every result page of one search (broad inputs such as copper plate fill several pages of 24).
const searchAll=async(direction,query)=>{const found=[...await search(direction,query)];const next=page.locator('[data-action="blueprint-page"][data-id="1"]');while(await next.count()&&await next.isEnabled()){await next.click();found.push(...await titles());}return found;};
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
 // Space launch round: output searches find each product's design; input searches find the consumers
 // of light oil and concrete. The receiver delivers packs but crafts nothing; rocket supplies only passes
 // rocket fuel through, so neither appears where it would claim production.
 const concrete='Concrete supplier · 45/min',fuel='Rocket-fuel supplier · 6/min',kit='Space launch kit · silo, pad, starter pack and platform parts',supplies='Rocket supplies · 6 rockets per hour',platform='White-pack platform · 60/min in Nauvis orbit',receiver='White-pack receiver · landing pad to chest';
 await page.goto(url+'?collection=flight-plans#blueprints');await page.reload();await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 for(const [query,want] of [['rocket silo',[kit]],['space science pack',[platform,receiver]],['concrete',[concrete]],['rocket fuel',[fuel]],['processing unit',[supplies]],['low density structure',[supplies]]]){const found=await search('outputs',query);for(const title of want)assert.ok(found.includes(title),'outputs: '+query+' gave '+found.join(' | '));}
 assert.ok(!(await search('outputs','rocket fuel')).includes(supplies),'rocket supplies passes rocket fuel through');
 assert.ok((await search('inputs','light oil')).includes(fuel),'inputs: light oil');
 const concreteUsers=await search('inputs','concrete');assert.ok(concreteUsers.includes(kit),'inputs: concrete finds the kit');assert.ok(!concreteUsers.includes(concrete),'the concrete supplier does not need concrete');
 assert.ok((await search('inputs','rocket fuel')).includes(supplies),'inputs: rocket fuel finds rocket supplies');
 await page.goto(url+'?collection=space-launch#blueprints');await page.reload();await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 assert.equal(await page.locator('#blueprint-source').inputValue(),'Space launch · 21 November');
 assert.deepEqual([...await titles()].sort(),[concrete,fuel,kit,supplies,platform,receiver].sort(),'space launch view lists exactly the six');
 assert.ok((await page.locator('.collection-banner').textContent()).includes('Space launch builds'));
 assert.deepEqual(await search('inputs','light oil'),[fuel]);
 assert.deepEqual(await search('inputs','concrete'),[kit]);
 assert.deepEqual(await search('outputs','rocket fuel'),[fuel]);
 assert.deepEqual([...await search('outputs','space science pack')].sort(),[platform,receiver].sort());
 // Electric smelter pass-through: found by name and machine, by its plates as outputs and by its ores as inputs.
 const smelter='Electric smelter · ore through east, plates south';
 await page.goto(url+'?collection=flight-plans#blueprints');await page.reload();await page.getByRole('heading',{name:'Blueprint library',exact:true}).waitFor();
 for(const [direction,query] of [['all','smelter'],['all','electric furnace'],['outputs','iron plate'],['outputs','copper plate'],['inputs','iron ore'],['inputs','copper ore']]){const found=await search(direction,query);assert.ok(found.includes(smelter),direction+': '+query+' gave '+found.length+' cards without the smelter');}
 assert.ok(!(await search('outputs','iron ore')).includes(smelter),'forwarded ore is not a product');
 // Circuit suppliers: found by name, by product (output search) and by each operating input (input search).
 const advanced='Advanced-circuit supplier · 187.5/min',processing='Processing-unit supplier · 27/min';
 for(const [direction,query,want] of [['all','advanced circuit',[advanced]],['all','processing unit',[processing]],['outputs','advanced circuit',[advanced]],['outputs','processing unit',[processing]],['inputs','plastic bar',[advanced,processing]],['inputs','copper plate',[advanced,processing]],['inputs','iron plate',[advanced,processing]],['inputs','sulfuric acid',[processing]]]){const found=await searchAll(direction,query);for(const title of want)assert.ok(found.includes(title),direction+': '+query+' gave '+found.length+' cards without '+title);}
 assert.ok(!(await search('inputs','sulfuric acid')).includes(advanced),'advanced circuits need no acid');
 assert.ok(!(await search('inputs','advanced circuit')).includes(advanced),'the advanced-circuit supplier does not need advanced circuits');
 assert.ok(!(await search('outputs','plastic bar')).includes(processing),'plastic is an input, not a product');
 // Circuit colours are names for three items: green = electronic circuit, red = advanced circuit, blue = processing unit (a colour
 // query matches what it matched before and, in addition, the item it names). The plastic bar suppliers: three sizes, one card.
 const green='Green-circuit supplier · 360/min',plastic='Plastic bar supplier · three sizes';
 for(const [direction,query,want] of [['outputs','green circuit',[green]],['outputs','green circuits',[green]],['outputs','Green Circuit',[green]],['outputs','red circuit',[advanced]],['outputs','red circuits',[advanced]],['outputs','blue circuit',[processing]],['outputs','blue circuits',[processing]],['all','red circuit',[advanced]],['all','blue circuit',[processing]],['all','green circuit',[green]],
  ['outputs','plastic',[plastic]],['outputs','plastic bar',[plastic]],['all','plastic',[plastic,advanced,processing]],['inputs','coal',[plastic]],['inputs','petroleum gas',[plastic]]]){const found=await searchAll(direction,query);for(const title of want)assert.ok(found.includes(title),direction+': '+query+' gave '+found.length+' cards without '+title+': '+found.slice(0,6).join(' | '));}
 assert.ok(!(await searchAll('inputs','petroleum gas')).includes(advanced),'advanced circuits need no gas');
 assert.ok(!(await searchAll('inputs','coal')).includes(processing),'processing units need no coal');
 assert.ok(!(await searchAll('outputs','red circuit')).includes(processing),'red is not blue');
 assert.ok(!(await searchAll('outputs','blue circuit')).includes(advanced),'blue is not red');
 assert.ok(!(await searchAll('outputs','green circuit')).includes(advanced),'green is not red');
 assert.equal((await searchAll('outputs','plastic')).filter(t=>t===plastic).length,1,'three sizes are one card');
 console.log('Produces this item: red circuit '+(await searchAll('outputs','red circuit')).length+' cards, blue circuit '+(await searchAll('outputs','blue circuit')).length+' cards, green circuit '+(await searchAll('outputs','green circuit')).length+' cards, plastic '+(await searchAll('outputs','plastic')).length+' cards');
 // Oil products supplier: found by each of its five products (output search) and by its three inputs (input search).
 const oil='Oil products supplier';
 for(const [direction,query] of [['outputs','oil'],['outputs','petroleum gas'],['outputs','sulfuric acid'],['outputs','lubricant'],['outputs','light oil'],['outputs','sulfur'],['inputs','crude oil'],['inputs','water'],['inputs','iron plate'],['all','oil products']]){const found=await searchAll(direction,query);assert.ok(found.includes(oil),direction+': '+query+' gave '+found.length+' cards without the oil products supplier: '+found.slice(0,6).join(' | '));}
 for(const [direction,query] of [['inputs','petroleum gas'],['inputs','light oil'],['inputs','lubricant'],['inputs','sulfuric acid'],['inputs','sulfur'],['outputs','crude oil'],['outputs','iron plate']]){assert.ok(!(await searchAll(direction,query)).includes(oil),direction+': '+query+' is not an oil products '+(direction==='inputs'?'input':'output'));}
 // The plastic supplier takes the gas: petroleum gas as an output finds the oil supplier and as an input finds the plastic supplier.
 assert.ok((await searchAll('inputs','petroleum gas')).includes(plastic)&&(await searchAll('outputs','petroleum gas')).includes(oil));
 assert.deepEqual(errors,[]);console.log('Blueprint search fields: lab-connected science and forestry builds are findable by output search; the essentials, the space launch builds, the electric smelter and the circuit suppliers are findable by input and output.');
}finally{await browser.close();}
