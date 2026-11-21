// Space launch round publication: library records, search fields, coverage, the kit bill, guide pages and
// the landing page. Run after `npm run build` (site/data/atlas.json and the generated pages are build outputs).
// Needs neither the game nor the prototype dump.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {SPACE_IDS,SPACE_RELEASE,BOOK_ORDER,loadSpaceLaunch,spaceEvidence,kitBillProblems,interfaces,firstLaunchEvidence} from '../scripts/space-launch-pages.mjs';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const atlas=JSON.parse(await fs.readFile('site/data/atlas.json','utf8'));
const KIT_ITEMS=['rocket-silo','cargo-landing-pad','space-platform-starter-pack','space-platform-foundation','asteroid-collector','crusher','assembling-machine-2','electric-furnace','fast-inserter','solar-panel','accumulator','constant-combinator','arithmetic-combinator','decider-combinator','passive-provider-chest','substation'];
// Contract section 16: section, purpose, search inputs, outputs and the recommended coverage build.
const CONTRACT={
 'concrete-supplier':{section:'Space launch · suppliers',purpose:'Production',inputs:['stone-brick','iron-ore','water'],outputs:['concrete'],recommend:['concrete']},
 'rocket-fuel-supplier':{section:'Space launch · suppliers',purpose:'Production',inputs:['light-oil'],outputs:['rocket-fuel'],recommend:['rocket-fuel']},
 'launch-kit':{section:'Space launch · kit',purpose:'Production',inputs:['iron-plate','copper-plate','steel-plate','plastic-bar','stone-brick','electronic-circuit','concrete','lubricant','sulfuric-acid'],outputs:KIT_ITEMS,recommend:['rocket-silo','cargo-landing-pad','space-platform-starter-pack','space-platform-foundation','asteroid-collector','crusher']},
 'rocket-supplies':{section:'Space launch · rocket supplies',purpose:'Production',inputs:['electronic-circuit','copper-plate','plastic-bar','steel-plate','sulfuric-acid','rocket-fuel'],outputs:['processing-unit','low-density-structure'],recommend:['processing-unit','low-density-structure']},
 // The platform has no supplied input: its collectors catch asteroid chunks in orbit (contract: "none").
 'white-platform':{section:'Space science · orbital platform',purpose:'Science production',inputs:[],outputs:['space-science-pack'],recommend:['space-science-pack']},
 'white-pack-receiver':{section:'Space science · ground receiver',purpose:'Science production',inputs:['space-science-pack'],outputs:['space-science-pack'],recommend:[]}
};
const sorted=a=>[...a].sort();
const records=await loadSpaceLaunch();
const by=Object.fromEntries(records.map(r=>[r.id,r]));
const published=records.filter(r=>r.qualified&&SPACE_IDS.includes(r.id));
const recordFor=id=>atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/'+id+'/'));

test('every published space-launch blueprint has exact-hash passing native evidence; a stale report never qualifies',()=>{
 assert.deepEqual(records.map(r=>r.id),BOOK_ORDER);
 assert.ok(published.length>0,'nothing published');
 for(const r of published){
  assert.equal(sha(r.code),r.m.blueprintSha256,r.id);
  assert.equal(r.m.status,'qualified',r.id);
  assert.equal(r.report.passed,true,r.id);
  assert.ok(r.report.builds.some(b=>b.id===r.id&&b.blueprintSha256===r.m.blueprintSha256&&b.passed===true),r.id);
  const stale=structuredClone(r.report);for(const b of stale.builds)b.blueprintSha256='0'.repeat(64);
  assert.equal(spaceEvidence(r.m,r.code,stale).passed,false,r.id+' stale');
  const failed=structuredClone(r.report);failed.passed=false;
  assert.equal(spaceEvidence(r.m,r.code,failed).passed,false,r.id+' failed');
  assert.equal(spaceEvidence(r.m,r.code,null).passed,false,r.id+' missing');
 }
 // Class rules read the numbers, not only the flag.
 const platform=by['white-platform'],slow=structuredClone(platform.report);slow.builds.find(b=>b.id==='white-platform').steady.madePerMinute=50;
 assert.equal(spaceEvidence(platform.m,platform.code,slow).passed,false);
 const kit=by['launch-kit'],late=structuredClone(kit.report);late.builds[0].fill.kitMinutes=kit.m.protocol.kitLimitMinutes+1;
 assert.equal(spaceEvidence(kit.m,kit.code,late).passed,false);
});

test('the kit bill is made from the published platform and receiver strings and covers them',()=>{
 const bill=records.bill,platform=by['white-platform'].m,receiver=by['white-pack-receiver'].m,kit=by['launch-kit'].m;
 assert.equal(bill.sources['white-platform'],sha(by['white-platform'].code));
 assert.equal(bill.sources['white-pack-receiver'],sha(by['white-pack-receiver'].code));
 assert.deepEqual(kitBillProblems(bill,platform,receiver,kit),[]);
 assert.deepEqual(sorted(Object.keys(kit.outputCaps)),sorted(KIT_ITEMS));
 for(const [id,n] of Object.entries(platform.billOfMaterials.platformRequest))assert.ok(kit.outputCaps[id]>=n,id);
 for(const [id,n] of Object.entries(receiver.billOfMaterials.items))assert.ok(kit.outputCaps[id]>=(platform.billOfMaterials.platformRequest[id]||0)+n,id);
 // The request is a whole number of full rockets, recomputed from the manifest's weight table.
 const bom=platform.billOfMaterials,kg=Object.entries(bom.platformRequest).reduce((a,[id,n])=>a+n*bom.weightKg[id],0);
 assert.equal(kg,bom.requestedWeightKg);assert.equal(kg%bom.rocketLiftKg,0);assert.equal(bom.cargoRockets,kg/bom.rocketLiftKg);assert.equal(bom.totalRockets,bom.cargoRockets+1);
 assert.equal(kit.launch.platformRequestKg,kg);assert.equal(kit.launch.totalRockets,bom.totalRockets);
 // A changed platform request is caught.
 const changed=structuredClone(platform);changed.billOfMaterials.platformRequest['solar-panel']+=1;
 assert.ok(kitBillProblems(bill,changed,receiver,kit).length);
 const other=structuredClone(platform);other.blueprintSha256='0'.repeat(64);
 assert.ok(kitBillProblems(bill,other,receiver,kit).length);
});

test('library records carry the search fields: inputs, outputs, section, category and purpose',()=>{
 for(const r of published){
  const b=recordFor(r.id),want=CONTRACT[r.id];assert.ok(b,r.id);
  assert.equal(b.collection,'Long game flight plans and strategies');
  assert.equal(b.releaseGroup,SPACE_RELEASE);
  assert.equal(b.lifecycle,'current');
  for(const field of ['section','category','purpose'])assert.ok(typeof b[field]==='string'&&b[field].length,r.id+' '+field);
  assert.equal(b.section,want.section);assert.equal(b.category,want.section);assert.equal(b.purpose,want.purpose);
  if(r.id==='white-platform')assert.deepEqual(b.analysis.inputs,[],'the platform has no supplied input');
  else assert.ok(b.analysis.inputs.length,r.id+' inputs');
  assert.ok(b.products.length&&b.analysis.outputs.length,r.id+' outputs');
  assert.deepEqual(sorted(b.analysis.inputs),sorted(want.inputs),r.id+' inputs');
  assert.deepEqual(sorted(b.products),sorted(want.outputs),r.id+' products');
  assert.deepEqual(b.analysis.outputs,b.products);
  assert.equal(b.validation.status,'game-tested');assert.equal(b.validation.blueprintSha256,b.blueprintSha256);assert.equal(b.blueprintSha256,r.m.blueprintSha256);
  assert.deepEqual(sorted(b.recommendedProducts),sorted(want.recommend),r.id+' recommendation');
  if(r.m.class!=='kit')for(const id of b.products)assert.ok(b.measuredOutputsPerMinute[id]>=57/60*(r.m.targets?.[id]??r.m.deliveryTarget?.[id]),r.id+' measured '+id);
 }
 // Setup notes the contract requires.
 const notes=id=>recordFor(id)?.setupNotes.join(' ')||'';
 if(by['launch-kit'].qualified){assert.match(notes('launch-kit'),/supplied electronic circuit: .*1 green-circuit supplier copy/);assert.match(notes('launch-kit'),/supplied concrete: .*1 concrete supplier copy/);}
 if(by['rocket-supplies'].qualified){assert.match(notes('rocket-supplies'),/supplied electronic circuit: .*1 green-circuit supplier copy/);assert.match(notes('rocket-supplies'),/supplied rocket fuel: .*1 rocket-fuel supplier copy/);}
 if(by['white-pack-receiver'].qualified)assert.match(notes('white-pack-receiver'),/one cargo landing pad.*add the space science pack request/i);
 if(by['white-platform'].qualified)assert.match(notes('white-platform'),/hub.*request missing construction materials/);
 // Final review: the first-launch order and the robot network; the campaign is five launches, the kit's concrete panel 23.
 if(by['launch-kit'].qualified){assert.match(notes('launch-kit'),/First launch: in a save that has never created a space platform, the asteroid collector and crusher recipes unlock only when the first platform is created/);assert.match(notes('launch-kit'),/the last cargo rocket waits for them/);assert.match(notes('launch-kit'),/one roboport network with logistic robots that also covers the rocket silo/);}
 if(by['rocket-supplies'].qualified){assert.match(notes('rocket-supplies'),/five launches of the space-launch campaign, 250 of each ingredient, plus three spare/);assert.doesNotMatch(notes('rocket-supplies'),/six-rocket/);}
 if(by['concrete-supplier'].qualified){assert.match(notes('concrete-supplier'),/concrete panel is 23 a minute/);assert.doesNotMatch(notes('concrete-supplier'),/25 concrete/);}
 // Earlier release groups keep their size; this round is its own group.
 assert.equal(atlas.blueprints.filter(b=>b.releaseGroup==='flight-workshops-20261117').length,9);
 assert.equal(atlas.blueprints.filter(b=>b.releaseGroup==='essentials-20261121').length,4);
 assert.equal(atlas.blueprints.filter(b=>b.releaseGroup===SPACE_RELEASE).length,published.length);
 // Not-qualified blueprints are not in the library.
 for(const r of records.filter(r=>!r.qualified&&SPACE_IDS.includes(r.id)))assert.equal(recordFor(r.id),undefined,r.id);
});

test('each product is covered by its new design; the recommended ones lead; the receiver counts for nothing',()=>{
 for(const r of published){const b=recordFor(r.id);
  if(b.coverageExcluded){for(const i of atlas.coverage.items)assert.ok(!i.builds.includes(b.id),r.id+' must not cover '+i.id);continue;}
  for(const id of b.products){const item=atlas.coverage.items.find(i=>i.id===id);assert.ok(item,id);assert.ok(item.builds.includes(b.id),r.id+' '+id);}
  for(const id of b.recommendedProducts)assert.equal(atlas.coverage.items.find(i=>i.id===id).builds[0],b.id,r.id+' leads '+id);
 }
 assert.equal(recordFor('white-pack-receiver')?.coverageExcluded??true,true);
 // Rocket fuel only passes through rocket supplies: it is not one of its products.
 const supplies=recordFor('rocket-supplies');if(supplies)assert.ok(!atlas.coverage.items.find(i=>i.id==='rocket-fuel').builds.includes(supplies.id));
 // The kit leads only its space items; the essentials mall keeps assembling machine 2 and fast inserters.
 const mall=atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/essentials-mall/'));
 for(const id of ['assembling-machine-2','fast-inserter'])assert.equal(atlas.coverage.items.find(i=>i.id===id).builds[0],mall.id,id);
 // The orbital cell stays listed for space science, behind the platform.
 const cell=atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/flight-space-science/'));
 assert.ok(cell&&atlas.coverage.items.find(i=>i.id==='space-science-pack').builds.includes(cell.id));
});

test('guide pages and the landing page are offline, exact and complete',async()=>{
 for(const r of published){
  const html=await fs.readFile(`site/${r.id}/index.html`,'utf8');
  assert.ok(html.includes(r.m.blueprintSha256),r.id);
  assert.ok(html.includes(r.code.slice(0,200)),r.id+' import string');
  assert.equal((await fs.readFile(`site/${r.id}/${r.m.file}`,'utf8')).trim(),r.code);
  assert.equal(JSON.parse(await fs.readFile(`site/${r.id}/native-report.json`,'utf8')).passed,true);
  for(const p of [...(r.m.inputs||[]),...(r.m.fluids||[])])assert.ok(html.includes(`(${p.x}, ${p.y})`),r.id+' entrance '+p.item);
  assert.match(html,new RegExp(`node scripts/${r.id==='white-pack-receiver'?'white-pack-receiver':r.id}/generate\\.mjs`),r.id+' reproduce');
  assert.doesNotMatch(html,/(?:src|href)="(?:https?:)?\/\//,r.id+' no network URLs');
  assert.doesNotMatch(await fs.readFile(`site/${r.id}/layout.svg`,'utf8'),/href="https?:/);
 }
 if(by['white-platform'].qualified)assert.equal((await fs.readFile('site/white-platform/layout.svg','utf8')).match(/class="tile"/g).length,by['white-platform'].bp.tiles.length,'every foundation tile is drawn');
 const landing=await fs.readFile('site/space-launch/index.html','utf8');
 assert.doesNotMatch(landing,/(?:src|href)="(?:https?:)?\/\//);
 for(const r of published){assert.ok(landing.includes(`href="../${r.id}/index.html"`),r.id);assert.ok(landing.includes(`href="../${r.id}/native-report.json"`),r.id);assert.ok(landing.includes(r.m.blueprintSha256),r.id);}
 // Final review: the robot network, the platform click and the first-launch order.
 if(by['launch-kit'].qualified&&by['white-platform'].qualified){
  assert.match(landing,/the rocket silo and the kit's chests must be inside one roboport network with logistic robots/);
  assert.match(landing,/The kit makes no roboports, logistic robots or requester chests/);
  assert.match(landing,/href="\.\.\/robot-essentials\/index\.html"/);
  assert.match(landing,/Cargo cannot be put into the silo by hand while the setting is on/);
  assert.match(landing,/“Build new space platform”.*choose Nauvis as the planet and the space platform starter pack, then <strong>Create<\/strong>/);
  assert.match(landing,/Leave the starter pack and the platform parts in the kit's chests/);
  assert.match(landing,/never created a space platform, the asteroid collector and crusher recipes are still locked/);
  assert.match(landing,/go on to steps 4 and 5 as soon as the silo and the starter pack are in their chests/);
  assert.match(landing,/the last cargo rocket waits for them/);
  assert.match(landing,/is for a save where a platform already exists/);
  const fl=await firstLaunchEvidence('.',by['launch-kit']);
  assert.ok(fl,'committed first-launch evidence for the exact kit string');
  assert.equal(fl.full,14);assert.equal(fl.total,16);
  assert.ok(landing.includes(`fills ${fl.full} of its ${fl.total} chests and waits`));
  const kitGuide=await fs.readFile('site/launch-kit/index.html','utf8'),platformGuide=await fs.readFile('site/white-platform/index.html','utf8');
  assert.match(kitGuide,/First launch: in a save that has never created a space platform/);
  assert.match(kitGuide,/the kit makes no roboports or logistic robots/);
  assert.match(platformGuide,/Build the rocket silo inside a roboport network with logistic robots/);
  assert.match(platformGuide,/cargo cannot be put in by hand while it is on/);
  assert.match(platformGuide,/the last cargo rocket waits until the kit has made them/);
 }
 // The eight steps in the contract's order.
 const steps=[...landing.matchAll(/<section class="step" id="([^"]+)">/g)].map(m=>m[1]);
 assert.deepEqual(steps,['suppliers','factories','kit','silo','platform','paste','receiver','packs']);
 // The book: green circuits then the round, each page identical to its standalone import.
 const book=decodeBlueprint(await fs.readFile('site/space-launch/space-launch-book.txt','utf8')).blueprint_book,inBook=BOOK_ORDER.filter(id=>by[id].qualified);
 assert.equal(book.blueprints.length,inBook.length);
 for(const [i,id] of inBook.entries())assert.deepEqual(book.blueprints[i].blueprint,by[id].bp,id);
 // The rocket plan comes from the platform's bill and rocket-delivery check.
 const data=JSON.parse(await fs.readFile('site/space-launch/data.json','utf8'));
 if(by['white-platform'].qualified){const bom=by['white-platform'].m.billOfMaterials;
  assert.equal(data.rocketPlan.totalRockets,bom.totalRockets);assert.equal(data.rocketPlan.measuredLaunches,bom.totalRockets);
  for(const n of Object.values(data.rocketPlan.campaign))assert.equal(n,bom.totalRockets*data.rocketPlan.partsPerRocket);
  for(const x of data.rocketPlan.rockets)assert.equal(x.weightKg,1000);}
 assert.deepEqual(data.published.map(p=>p.id),published.map(r=>r.id));
 // Navigation both ways and from the flight-plans list.
 const nav=await fs.readFile('site/flight-plans.js','utf8');assert.match(nav,/href:'space-launch\/index\.html'/);
 assert.match(await fs.readFile('site/essentials/index.html','utf8'),/href="\.\.\/space-launch\/index\.html"/);
 assert.match(landing,/href="\.\.\/essentials\/index\.html"/);
 assert.match(await fs.readFile('site/explorer.js','utf8'),/get\('collection'\) === 'space-launch'/);
});

test('interfaces: which supplier exit feeds which entrance, with copies',()=>{
 const rows=interfaces(records),key=r=>r.supplier+'>'+r.consumer+':'+r.item;
 const want=['concrete-supplier>launch-kit:concrete','green-circuits>launch-kit:electronic-circuit','rocket-fuel-supplier>rocket-supplies:rocket-fuel','green-circuits>rocket-supplies:electronic-circuit'].filter(k=>{const [, c]=k.match(/>([^:]+)/);return by[c].qualified;});
 assert.deepEqual(sorted(rows.map(key)),sorted(want));
 for(const r of rows){assert.equal(r.copies,1,key(r));assert.ok(r.supplierPerMinute>=r.panelPerMinute,key(r)+' one copy covers the panel figure');assert.ok(Number.isInteger(r.offset));}
 // One green-circuit supplier covers the kit and rocket supplies together.
 const circuits=rows.filter(r=>r.supplier==='green-circuits').reduce((a,r)=>a+r.panelPerMinute,0);
 assert.ok(circuits<=by['green-circuits'].m.targets['electronic-circuit']);
 // Placement rows from the manifests: the concrete supplier sits 4 rows above the kit (exit row 4, entrance row 0).
 const concrete=rows.find(r=>r.supplier==='concrete-supplier');if(concrete){assert.equal(concrete.offset,concrete.entranceRowFromTop-concrete.exitRowFromTop);assert.match(concrete.placement,/4 rows above/);}
});
