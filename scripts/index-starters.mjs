import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from './blueprints.mjs';
import {starterPreview,blueprintFootprint} from './starter-preview.mjs';
import {starterConfigurationHash} from './starter-verification.mjs';
import {validateRawRateEvidence} from './blueprint-rate-evidence.mjs';
import {jsonBytes,publishBlueprintCollection,withTransportPublicationLock} from './transport-workshop-publication.mjs';
export async function indexStarterCollections(catalog,production){
 return withTransportPublicationLock({cacheRoot:'.cache/early-game-publication'},()=>indexStarterCollectionsLocked(catalog,production));
}
async function indexStarterCollectionsLocked(catalog,production){
 const root='blueprint-sources/early-game',destination='site/sources/early-game',blueprints=[],sources=[];
 const rateRecords=[],assets=new Map(),validated=new Map();
 let throughput;
 try{throughput=JSON.parse(await fs.readFile(root+'/throughput.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.mkdir(destination+'/unlocks',{recursive:true});
 const research=JSON.parse(await fs.readFile(root+'/research.json'));
 let previousUnlocks=[];
 try{previousUnlocks=JSON.parse(await fs.readFile(destination+'/research.json')).stages.map(s=>s.id);}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const legacy of [true,false]){
  const manifest=JSON.parse(await fs.readFile(root+(legacy?'/community-manifest.json':'/manifest.json')));
  if(!legacy&&JSON.stringify(manifest.flatMap(b=>b.products).sort())!==JSON.stringify(research.expectedProducts))throw Error('Incomplete raw-input collection; regenerate the full manifest before indexing.');
  const reportFile=legacy?'community-validation.json':'validation.json';
  const evidence=JSON.parse(await fs.readFile(root+'/'+reportFile));
  const collection=legacy?'Community starter references':'Early game · no robots';
  const book={blueprint_book:{item:'blueprint-book',label:legacy?'Community starter references':'Early game · raw-material research modules',version:562949958467584,active_index:0,blueprints:[]}};
  const groups=new Map();
  for(const info of manifest){
   const code=(await fs.readFile(root+'/'+info.file,'utf8')).trim(),object=decodeBlueprint(code);
   const sha=createHash('sha256').update(code).digest('hex');
   const test=evidence.builds.find(b=>b.id===info.id&&b.blueprintSha256===sha&&b.portConfigurationSha256===starterConfigurationHash(info)&&b.passed);
   if(!test)throw Error('Missing matching native validation for '+info.id);
   const measured=!legacy&&throughput?validateRawRateEvidence(info,code,evidence,throughput).measured:undefined;
   const localSource='sources/early-game/'+info.file;await fs.writeFile('site/'+localSource,code+'\n');
   const analysis=FactorioProduction.analyzeBlueprint(object,production);
   analysis.inputs=[...new Set([...analysis.inputs,...info.ports.filter(p=>['input','fluid'].includes(p.kind)).flatMap(p=>p.items)])].filter(id=>!info.products.includes(id)).sort();
   if(info.kind==='routing')analysis.inputs=[];
   if(info.kind==='power')analysis.serviceInputs=['Water from an offshore pump','Coal on the fuel belt'];
   if(info.rawOnly&&analysis.inputs.some(id=>!research.rawInputs.includes(id)))throw Error('Processed external input in '+info.id);
   const delivered=Object.entries(test.delivered).map(([id,n])=>Math.round(n)+' '+id).join(', ');
   const note=info.rawOnly?
    'Passed '+evidence.simulatedMinutes+' simulated minutes in Factorio '+evidence.gameVersion+' with only the listed raw inputs and external power. Every internal recipe ran and the finished output reached its collection point. Production construction and recipe unlocks were checked. Every electric machine, inserter and pole was connected to the big pole marked P. Optional input displays need Circuit network; their saved icons, text and Alt-mode settings were verified on import. Counts are test evidence, not a rated production speed.':
    info.kind==='power'?'Generated electricity into an isolated grid load in Factorio '+evidence.gameVersion+'.':
    evidence.simulatedMinutes+'-minute Factorio '+evidence.gameVersion+' test: delivered '+delivered+' through the saved outputs. These community references may need intermediate ingredients.';
   blueprints.push({...info,footprint:blueprintFootprint(object.blueprint,production),collection,section:info.category,isBook:false,icons:info.products.length?info.products:(object.blueprint.icons||[]).map(i=>i.signal.name),sources:[info.sourceURL,localSource,'sources/early-game/README.md'],...blueprintMaterials(object,catalog),code,analysis,starter:!legacy,legacyStarter:legacy,connectionPorts:info.ports,ports:[],researchBook:!legacy?'sources/early-game/unlocks/'+info.unlock+'.txt':undefined,validation:{status:'game-tested',kind:info.kind,note,report:'sources/early-game/'+reportFile,blueprintSha256:sha,firstOutputSeconds:test.firstOutputTick===undefined?undefined:Math.round(test.firstOutputTick/60)},preview:await starterPreview(object.blueprint,info,production)});
   if(measured){
    const record=blueprints.at(-1);
    record.blueprintSha256=sha;
    record.benchmark={...measured.throughput,gameVersion:throughput.gameVersion,report:'sources/early-game/throughput.json'};
    if(info.reviewReport)record.reviewReport=info.reviewReport;
    rateRecords.push(record);
    assets.set(info.id,{code:Buffer.from(code),native:jsonBytes({...evidence,builds:[test]}),throughput:jsonBytes({...throughput,builds:[measured]})});
    validated.set(info.id,{info,evidence,throughput});
   }
   let entries=book.blueprint_book.blueprints;
   if(!legacy){
    if(!groups.has(info.unlock)){
     const group={index:entries.length,blueprint_book:{item:'blueprint-book',label:info.category+' · raw inputs',version:562949958467584,active_index:0,blueprints:[]}};
     entries.push(group);groups.set(info.unlock,group);
    }
    entries=groups.get(info.unlock).blueprint_book.blueprints;
   }
   entries.push({index:entries.length,...object});
  }
  const filename=legacy?'community-starters.txt':'early-game.txt';
  await fs.writeFile('site/sources/collections/'+filename,encodeBlueprint(book)+'\n');
  if(!legacy){
   await fs.writeFile(root+'/book.txt',encodeBlueprint(book)+'\n');
   for(const [unlock,group]of groups)await fs.writeFile(destination+'/unlocks/'+unlock+'.txt',encodeBlueprint({blueprint_book:group.blueprint_book})+'\n');
   // Research requirements can move modules into later packs. Do not leave
   // obsolete downloads serving earlier machine tiers after reindexing.
   for(const unlock of previousUnlocks)if(!groups.has(unlock))await fs.rm(destination+'/unlocks/'+unlock+'.txt',{force:true});
  }
  await fs.copyFile(root+'/'+reportFile,destination+'/'+reportFile);
 }
 for(const file of ['README.md','research.json'])await fs.copyFile(root+'/'+file,destination+'/'+file);
 try{await fs.copyFile(root+'/REVIEW.md',destination+'/REVIEW.md');}catch(error){if(error.code!=='ENOENT')throw error;}
 if(throughput)await fs.copyFile(root+'/throughput.json',destination+'/throughput.json');
 if(rateRecords.length){
  const publication=await publishBlueprintCollection({records:rateRecords,assets,validated,sourceRoot:root,siteRoot:'site',publicationDir:'data/early-game',validateEvidence:validateRawRateEvidence,writeLatest:false,lockHeld:true});
  const revisions=new Map(publication.index.blueprints.map(entry=>[entry.id,entry.revision]));
  const published=new Map(publication.records.map(record=>[record.id,{...record,publicationRevision:revisions.get(record.id)}]));
  for(let i=0;i<blueprints.length;i++)if(published.has(blueprints[i].id))blueprints[i]=published.get(blueprints[i].id);
 }
 sources.push({id:'early-game',author:'Factorio Command Center · raw-material research modules',url:'sources/early-game/README.md'},{id:'community-starters',author:'Credited community starter references',url:'sources/early-game/README.md'});
 return {blueprints,sources,research};
}
