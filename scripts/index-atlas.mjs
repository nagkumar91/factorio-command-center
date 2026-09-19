import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from './blueprints.mjs';
import {blueprintPreview} from './blueprint-preview.mjs';
import {indexStarterCollections} from './index-starters.mjs';
import {indexTransportWorkshops} from './index-transport-workshops.mjs';
import {indexScienceFactories} from './index-science-factories.mjs';
import {indexPowerWorkshops} from './index-power-workshops.mjs';
import {blueprintCoverage} from './blueprint-coverage.mjs';
import {writeData} from './write-data.mjs';
import '../site/lib/production.js';
const [catalog,production,library,community]=await Promise.all(['catalog','production','library','community'].map(async n=>JSON.parse(await fs.readFile(`site/data/${n}.json`,'utf8'))));
const analyze=FactorioProduction.analyzeBlueprint;
for(const b of community.blueprints){const object=decodeBlueprint(b.code);b.analysis=analyze(object,production);Object.assign(b,blueprintMaterials(object,catalog));}
for(const b of library.blueprints)Object.assign(b,blueprintMaterials(decodeBlueprint(b.code),catalog));
community.local=Object.fromEntries(library.blueprints.map(b=>[b.id,analyze(decodeBlueprint(b.code),production)]));
const sources=[],blueprints=[],existing=[...library.blueprints.map(b=>({...b,analysis:community.local[b.id]})),...community.blueprints];
const clean=s=>String(s||'').replace(/\[(?:item|entity|fluid|virtual-signal)=[^\]]+\]/g,'').trim();
for(const file of (await fs.readdir('blueprint-sources/curated')).filter(x=>x.endsWith('.source.json')).sort()){
 const source=JSON.parse(await fs.readFile('blueprint-sources/curated/'+file,'utf8'));sources.push(source);
 const string=await fs.readFile('blueprint-sources/curated/'+source.id+'.txt','utf8');
 const localSource='sources/collections/'+source.id+'.txt';await fs.mkdir('site/sources/collections',{recursive:true});await fs.writeFile('site/'+localSource,string);
 async function walk(node,parents=[]){
  if(node.blueprint_book)for(const b of node.blueprint_book.blueprints||[])await walk(b,[...parents,clean(node.blueprint_book.label||'Book')]);
  if(!node.blueprint)return;
  const b=node.blueprint,object={blueprint:b},id='curated-'+crypto.createHash('sha256').update(JSON.stringify(object)).digest('hex').slice(0,16);
  if(blueprints.some(x=>x.id===id))return;
  const analysis=analyze(object,production),material=blueprintMaterials(object,catalog);
  const parameterized=(b.parameters?.length||0)>0||(b.entities||[]).some(e=>/^parameter-/.test(e.recipe||''));
  blueprints.push({id,name:clean(b.label)||parents.at(-1)||source.id,collection:'Community additions',category:parents.at(-1)||'Specialist production',section:parents.join(' / ')||source.id,author:source.author,file:source.id,isBook:false,icons:(b.icons||[]).map(i=>i.signal?.name).filter(Boolean),sources:[source.url,localSource],sourceURL:source.url,...material,code:encodeBlueprint(object),analysis,parameterized,validation:{status:'recipe-checked',note:'Imported from the credited author; recipes and construction items checked against the installed game. Routing and throughput have not been simulated.'},preview:await blueprintPreview(b,id,production)});
 }
 await walk(decodeBlueprint(string));
}
let manifest=[];try{manifest=JSON.parse(await fs.readFile('blueprint-sources/generated/manifest.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
let validation={};try{validation=JSON.parse(await fs.readFile('blueprint-sources/generated/validation.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
for(const info of manifest){
 const string=await fs.readFile('blueprint-sources/generated/'+info.file,'utf8'),object=decodeBlueprint(string),b=object.blueprint;
 const localSource='sources/recipe-cells/'+info.file;await fs.mkdir('site/sources/recipe-cells',{recursive:true});await fs.writeFile('site/'+localSource,string);
 const sha=crypto.createHash('sha256').update(string.trim()).digest('hex'),test=validation.cells?.find(c=>c.id===info.id&&c.blueprintSha256===sha&&c.passed);
 blueprints.push({...info,name:clean(b.label),collection:'Recipe cells',category:info.category||'Robot production cells',section:'Compact single-recipe production',isBook:false,icons:[info.product],sources:[localSource,'sources/recipe-cells/README.md'],...blueprintMaterials(object,catalog),code:encodeBlueprint(object),analysis:analyze(object,production),products:[info.product],validation:test?{status:'game-tested',note:`Produced ${test.produced} ${info.product} in an isolated Factorio ${validation.gameVersion} production test using the saved inserters and feed connections.`}:{status:'untested',note:'Generated recipe cell; in-game production verification pending.'},preview:await blueprintPreview(b,info.id,production)});
}
try{await fs.copyFile('blueprint-sources/generated/README.md','site/sources/recipe-cells/README.md');}catch(e){if(e.code!=='ENOENT')throw e;}
const starters=await indexStarterCollections(catalog,production);
blueprints.push(...starters.blueprints);sources.push(...starters.sources);
const transport=await indexTransportWorkshops(catalog,production);
blueprints.push(...transport.blueprints);sources.push(...transport.sources);
const science=await indexScienceFactories(catalog,production);
blueprints.push(...science.blueprints);sources.push(...science.sources);
const power=await indexPowerWorkshops(catalog,production);
blueprints.push(...power.blueprints);sources.push(...power.sources);
const coverage=blueprintCoverage(catalog,production,[...existing,...blueprints]);
await writeData('library',library);await writeData('community',community);await writeData('atlas',{sources,blueprints,coverage,starterResearch:starters.research,updatedAt:new Date().toISOString()});
console.log(JSON.stringify({added:blueprints.length,community:blueprints.filter(b=>b.collection==='Community additions').length,cells:manifest.length,covered:coverage.covered,total:coverage.total,missing:coverage.missing},null,2));
