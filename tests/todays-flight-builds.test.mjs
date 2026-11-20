import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {RELEASE_GROUP,TODAY_FOLDERS,todayRecords,verifyToday,renderToday} from '../scripts/todays-flight-builds.mjs';
const fixture=()=>Object.entries(TODAY_FOLDERS).flatMap(([folder,count])=>Array.from({length:count},(_,i)=>({id:folder+i,releaseGroup:RELEASE_GROUP,file:`sources/designed-blueprints/${folder}/${i}.txt`,code:'fixture '+folder+i,section:folder,purpose:'Production',name:folder+i,author:'Original author',collection:'Long game flight plans and strategies',products:['iron-plate'],analysis:{inputs:['copper-plate']},entries:[{id:'assembling-machine-2',count:3}],footprint:{width:24,height:17},entityCount:3,setupNotes:['Retain controls'],sourceURL:folder+'/index.html',preview:'preview.svg',validation:{status:'game-tested',note:'Measured fixture'}})));
test('Today selects exactly nine existing records without duplicating their collection',()=>{
 const records=fixture(),old={...records[0],id:'old',releaseGroup:undefined};
 assert.deepEqual(todayRecords({blueprints:[old,...records]}),records);
 assert.throws(()=>todayRecords({blueprints:records.slice(1)}),/nine/);
 assert.throws(()=>todayRecords({blueprints:[...records.slice(1),records[1]]}),/distinct/);
 const wrong=structuredClone(records);wrong[0].file=wrong.at(-1).file;
 assert.throws(()=>todayRecords({blueprints:wrong}),/count/);
 assert.ok(records.every(b=>b.collection==='Long game flight plans and strategies'));
});
test('Summary admits only exact import, manifest-index and passing report fingerprints',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'today-proof-'));
 const b=fixture()[0];b.blueprintSha256=createHash('sha256').update(b.code).digest('hex');b.validation.blueprintSha256=b.blueprintSha256;b.validation.report='report.json';
 await fs.mkdir(path.dirname(path.join(dir,b.file)),{recursive:true});await fs.writeFile(path.join(dir,b.file),b.code);
 const report={passed:true,builds:[{passed:true,blueprintSha256:b.blueprintSha256}]};
 try{
  await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report));await verifyToday([b],dir);
  b.validation.blueprintSha256='stale';await assert.rejects(verifyToday([b],dir),/Missing exact/);b.validation.blueprintSha256=b.blueprintSha256;
  report.builds[0].blueprintSha256='stale';await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report));await assert.rejects(verifyToday([b],dir),/failed or stale/);
  await fs.writeFile(path.join(dir,b.file),'changed');await assert.rejects(verifyToday([b],dir),/fingerprint/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Overview embeds nine copyable imports, local evidence, construction and guide links',()=>{
 const html=renderToday(fixture(),'<nav>Workshops</nav>',{items:[],fluids:[]});
 assert.equal((html.match(/data-build-id=/g)||[]).length,9);
 assert.equal((html.match(/<textarea /g)||[]).length,9);
 assert.match(html,/index.html\?collection=today#blueprints/);
 assert.match(html,/Construction materials/);assert.match(html,/24 × 17/);
 assert.doesNotMatch(html,/https?:\/\//);
});
test('Virtual scope composes section, purpose, operating inputs and finished outputs',async()=>{
 const atlas=JSON.parse(await fs.readFile('site/data/atlas.json'));
 const catalog=JSON.parse(await fs.readFile('site/data/catalog.json'));
 const records=fixture();
 records[7]={...records[7],section:'Robots and logistics',products:['construction-robot','logistic-robot','roboport','passive-provider-chest','storage-chest'],analysis:{inputs:['iron-plate','plastic-bar','water','lubricant']}};
 records[8]={...records[8],section:'Inserters',products:['inserter','long-handed-inserter','fast-inserter','bulk-inserter'],analysis:{inputs:['iron-plate','plastic-bar']}};
 for(const b of records){b.category=b.section;b.icons=[];b.analysis={...b.analysis,kind:b===records[7]?'Robot production':'Production',outputs:b.products,netOutputs:b.products,recipes:[],serviceOutputs:[]};}
 const old={...records[7],id:'old-robot',releaseGroup:undefined};
 const context={URLSearchParams,location:{search:'?collection=today'},localStorage:{getItem:()=>null},document:{addEventListener:()=>{}}};vm.createContext(context);vm.runInContext(await fs.readFile('site/explorer.js','utf8'),context);
 const ui={catalog,atlas,library:{blueprints:[...records,old]},production:{recipes:[]},community:{},esc:s=>String(s??''),image:()=>'',svg:()=>'',number:String,heading:()=>'',searchField:()=>'',empty:()=>'',renderPage:()=>{}};
 const explorer=context.FactorioExplorer.create(ui),html=()=>explorer.blueprintsPage();
 const count=()=>Number(html().match(/(\d+) builds · page/)[1]);
 assert.equal(count(),9);assert.doesNotMatch(html(),/data-id="old-robot"/);
 explorer.handleClick('blueprint-boundary','parts');assert.equal(count(),9);assert.match(html(),/Today's flight builds/);
 explorer.handleClick('blueprint-boundary','raw');assert.equal(count(),0);
 explorer.handleClick('blueprint-boundary','all');assert.equal(count(),9);
 assert.match(html(),/value="Robots and logistics"/);assert.match(html(),/value="Inserters"/);
 explorer.handleChange({id:'blueprint-category',value:'Inserters'});assert.equal(count(),1);
 explorer.handleChange({id:'blueprint-category',value:'All'});explorer.handleChange({id:'blueprint-kind',value:'Robot production'});assert.equal(count(),1);
 explorer.handleChange({id:'blueprint-kind',value:'All'});explorer.handleChange({id:'blueprint-direction',value:'inputs'});explorer.handleInput({id:'blueprint-search',value:'plastic'});assert.equal(count(),2);
 explorer.handleInput({id:'blueprint-search',value:'water'});assert.equal(count(),1);
 explorer.handleChange({id:'blueprint-direction',value:'outputs'});explorer.handleInput({id:'blueprint-search',value:'robot'});assert.equal(count(),1);
 explorer.handleChange({id:'blueprint-source',value:'Long game flight plans and strategies'});assert.equal(count(),2);
});
test('Registration tags existing science variants in place and gates the new workshops',async()=>{
 const source=await fs.readFile('scripts/index-designed-blueprints.mjs','utf8');
 assert.match(source,/todayFolders\.has\(releaseFolder\)/);
 assert.match(source,/report\.passed!==true\|\|!proof\|\|info\.blueprintSha256!==sha/);
 assert.match(source,/entries\.at\(-1\)\.recommendedProducts=\[\.\.\.info\.products\]/);
 const atlas=JSON.parse(await fs.readFile('site/data/atlas.json'));
 for(const folder of ['rgby-science','five-science']){
  const builds=atlas.blueprints.filter(b=>b.file?.startsWith('sources/designed-blueprints/'+folder+'/'));
  assert.equal(builds.length,3,'Existing science records remain registered once');
  assert.equal(builds.filter(b=>b.purpose==='Science research'&&b.products.length===0&&b.coverageExcluded).length,2);
 }
});
test('Recommended workshop products lead coverage while earlier versions remain available',async()=>{
 const {blueprintCoverage}=await import('../scripts/blueprint-coverage.mjs');
 const source=await fs.readFile('scripts/index-designed-blueprints.mjs','utf8');
 const context={};vm.createContext(context);vm.runInContext(source.split('// BEGIN workshop recommendation promotion')[1].split('// END workshop recommendation promotion')[0],context);
 for(const folder of ['robot-logistics-workshop','inserter-workshop']){
  const [manifest]=JSON.parse(await fs.readFile(`blueprint-sources/${folder}/manifest.json`));
  const products=manifest.products;
  const make=(id,recommendedProducts,entityCount)=>({id,products,recommendedProducts,entityCount,blueprintSha256:'exact',validation:{status:'game-tested',blueprintSha256:'exact'},analysis:{outputs:products,netOutputs:products,missing:[]}});
  const newest=make('new',[],500),old=make('old',[...products,'electric-furnace'],10);
  const science=make('science',['production-science-pack','utility-science-pack'],1);science.products=['production-science-pack','utility-science-pack'];science.analysis.outputs=science.products;science.analysis.netOutputs=science.products;
  const records=[old,science,newest],oldCode=JSON.stringify({products:old.products,analysis:old.analysis});
  const invalid=structuredClone(newest);invalid.validation.blueprintSha256='stale';
  assert.throws(()=>context.promoteWorkshop([old,invalid],invalid),/exact-hash/);
  assert.deepEqual(old.recommendedProducts,[...products,'electric-furnace'],'Invalid proof cannot demote earlier recommendations');
  context.promoteWorkshop(records,newest);
  assert.deepEqual(old.recommendedProducts,['electric-furnace'],'Remove only superseded product recommendations');
  assert.deepEqual(science.recommendedProducts,['production-science-pack','utility-science-pack'],'Science promotion is preserved');
  assert.equal(JSON.stringify({products:old.products,analysis:old.analysis}),oldCode,'Earlier blueprint outputs and analysis are preserved');
  const catalog={items:[...products.map(id=>({id})),{id:'substation'}]};
  const production={recipes:catalog.items.map(({id})=>({id,results:[{type:'item',id,amount:1,probability:1}]}))};
  const coverage=blueprintCoverage(catalog,production,records);
  for(const id of products)assert.deepEqual(coverage.items.find(i=>i.id===id).builds,['new','old']);
  assert.deepEqual(coverage.items.find(i=>i.id==='substation').builds,[],'Construction-only substations do not count as outputs');
 }
});

// The essentials round (21 November) supersedes these recommendations: the essentials mall leads fast
// inserters, robot essentials leads storage chests and six-pack science leads the ground packs. The
// 17 November workshops stay registered and listed in coverage as alternatives.
test('Actual release coverage keeps the today workshops listed behind their essentials successors',async t=>{
 const atlas=JSON.parse(await fs.readFile('site/data/atlas.json'));
 const find=folder=>atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/'+folder+'/'));
 const workshops=['inserter-workshop','robot-logistics-workshop'].map(find);
 if(workshops.some(b=>!b))return t.skip('Run after the parent indexes both exact-hash qualified workshops');
 for(const [id,workshop,successor] of [['fast-inserter',workshops[0],find('essentials-mall')],['storage-chest',workshops[1],find('robot-essentials')]]){
  assert.equal(workshop.validation.status,'game-tested');assert.equal(workshop.validation.blueprintSha256,workshop.blueprintSha256);
  const builds=atlas.coverage.items.find(i=>i.id===id).builds;
  assert.equal(builds[0],successor.id,`${id} must recommend the essentials successor first`);
  assert.ok(builds.includes(workshop.id),`${id} keeps the today workshop listed`);
  assert.ok(!workshop.recommendedProducts.includes(id));
  assert.ok(atlas.blueprints.filter(b=>b.id!==successor.id&&b.recommendedProducts?.includes(id)).length===0,'Earlier product recommendations are superseded');
 }
 assert.deepEqual([...workshops[0].recommendedProducts].sort(),['inserter','long-handed-inserter'],'The inserter workshop keeps the arms the mall does not make');
 const compact=find('compact-expansion-workshop');
 assert.ok(compact.products.includes('fast-inserter'),'Earlier compact blueprint stays available');
 assert.ok(!compact.recommendedProducts.includes('fast-inserter'));
 const six=find('six-science');
 for(const folder of ['rgby-science','five-science']){const b=atlas.blueprints.find(b=>b.file?.startsWith('sources/designed-blueprints/'+folder+'/')&&b.products.length);assert.ok(b,'Plate-fed science stays registered');for(const id of b.products)assert.ok(atlas.coverage.items.find(i=>i.id===id).builds.includes(b.id),folder+' stays listed for '+id);}
 for(const id of six.products)assert.equal(atlas.coverage.items.find(i=>i.id===id).builds[0],six.id);
});
