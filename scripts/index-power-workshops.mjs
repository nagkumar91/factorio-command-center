import fs from 'node:fs/promises';
import path from 'node:path';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from './blueprints.mjs';
import {starterPreview,blueprintFootprint} from './starter-preview.mjs';
import {validateRawRateEvidence} from './blueprint-rate-evidence.mjs';
import {jsonBytes,jsonRevision,publishBlueprintCollection,withTransportPublicationLock} from './transport-workshop-publication.mjs';
import '../site/lib/production.js';

const SOURCE='blueprint-sources/power-workshops',DESTINATION='sources/power-workshops';
const RAW=new Set(['iron-ore','copper-ore','coal','stone','water','crude-oil']);

export function validatePowerWorkshopEvidence(info,code,evidence,throughput){
 const requireEvidence=(condition,message)=>{if(!condition)throw Error(info.id+': '+message);};
 requireEvidence(info.rawOnly&&info.fuelPolicy?.furnaceFuel==='electricity','raw inputs and electric furnaces are required');
 requireEvidence(info.rawInputs?.length&&info.rawInputs.every(id=>RAW.has(id)),'processed external input in manifest');
 const checked=validateRawRateEvidence(info,code,evidence,throughput);
 for(const build of [checked.functional,checked.measured]){
  requireEvidence(build.power?.allConnected===true,'power network is incomplete');
  const fuel=build.fuel;
  requireEvidence(fuel?.furnaceFuel==='electricity'&&fuel.allFurnacesPowered===true&&fuel.furnaces?.length>0,'electric furnace power was not demonstrated');
  requireEvidence(fuel.furnaces.every(furnace=>furnace.name==='electric-furnace'&&furnace.electricPoweredSeconds>0&&!Object.keys(furnace.burning||{}).length&&!Object.keys(furnace.inventorySamples||{}).length),'furnace was not powered by electricity alone');
 }
 return checked;
}

async function writeLatest({records,sourceRoot,siteRoot}){
 const directory=path.join(siteRoot,DESTINATION);
 await fs.mkdir(directory,{recursive:true});
 for(const record of records)await fs.writeFile(path.join(directory,record.file),record.code+'\n');
 const book={blueprint_book:{item:'blueprint-book',label:'Electric power workshops · raw inputs',version:562949958467584,active_index:0,blueprints:records.map((record,index)=>({index,...decodeBlueprint(record.code)}))}};
 await fs.mkdir(path.join(siteRoot,'sources/collections'),{recursive:true});
 await fs.writeFile(path.join(siteRoot,'sources/collections/power-workshops.txt'),encodeBlueprint(book)+'\n');
 for(const file of ['manifest.json','validation.json','throughput.json','README.md','REVIEW.md']){
  try{await fs.copyFile(path.join(sourceRoot,file),path.join(directory,file));}catch(error){if(error.code!=='ENOENT')throw error;}
 }
}

export async function indexPowerWorkshops(catalog,production){
 return withTransportPublicationLock({cacheRoot:'.cache/power-workshops/publication'},async()=>{
  let manifest;
  try{manifest=JSON.parse(await fs.readFile(SOURCE+'/manifest.json'));}catch(error){
   if(error.code!=='ENOENT')throw error;
   const indexPath='site/data/power-workshops/index.json';
   try{await fs.access(indexPath);}catch(error){
    if(error.code!=='ENOENT')throw error;
    const empty={schemaVersion:1,blueprints:[]};
    await fs.mkdir(path.dirname(indexPath),{recursive:true});
    await fs.writeFile(indexPath+'.tmp',jsonBytes({...empty,revision:jsonRevision(empty)}));
    await fs.rename(indexPath+'.tmp',indexPath);
   }
   return {blueprints:[],sources:[]};
  }
  const evidence=JSON.parse(await fs.readFile(SOURCE+'/validation.json'));
  const throughput=JSON.parse(await fs.readFile(SOURCE+'/throughput.json'));
  const records=[],assets=new Map(),validated=new Map();
  for(const info of manifest){
   const code=(await fs.readFile(SOURCE+'/'+info.file,'utf8')).trim();
   const checked=validatePowerWorkshopEvidence(info,code,evidence,throughput),object=decodeBlueprint(code);
   const analysis=FactorioProduction.analyzeBlueprint(object,production);
   analysis.inputs=[...new Set([...analysis.inputs,...info.rawInputs])].sort();
   if(analysis.inputs.some(id=>!RAW.has(id)))throw Error(info.id+': processed external input in recipe analysis');
   const firstTick=checked.functional.firstOutputTick??Math.min(...Object.values(checked.functional.firstProductTicks||{}));
   const record={...info,author:info.sourceId?'Factorio Command Center · adapted from Autosaved':'Factorio Command Center',collection:'Electric power workshops',section:'Power equipment from raw materials',category:info.category||'Power equipment',starter:false,isBook:false,icons:info.products,sources:[...new Set([DESTINATION+'/'+info.file,DESTINATION+'/README.md',...(info.sourceURL?[info.sourceURL]:[])])],...blueprintMaterials(object,catalog),code,blueprintSha256:checked.blueprintSha256,analysis,connectionPorts:info.ports,ports:[],footprint:blueprintFootprint(object.blueprint,production),preview:await starterPreview(object.blueprint,info,production),reviewReport:DESTINATION+'/REVIEW.md',
    validation:{status:'game-tested',kind:'production',blueprintSha256:checked.blueprintSha256,firstOutputSeconds:Number.isFinite(firstTick)?Math.round(firstTick/60):undefined,report:DESTINATION+'/validation.json',note:'Tested in Factorio '+evidence.gameVersion+' from an empty start using only the labeled raw inputs and external electricity. Every internal recipe produced items, output resumed after collection, and every electric furnace was powered. No robots, modules or furnace fuel are needed.'},
    benchmark:{...checked.measured.throughput,gameVersion:throughput.gameVersion,report:DESTINATION+'/throughput.json'}};
   records.push(record);
   assets.set(info.id,{code:Buffer.from(code),native:jsonBytes({...evidence,builds:[checked.functional]}),throughput:jsonBytes({...throughput,builds:[checked.measured]})});
   validated.set(info.id,{info,evidence,throughput});
  }
  const publication=await publishBlueprintCollection({records,assets,validated,sourceRoot:SOURCE,siteRoot:'site',publicationDir:'data/power-workshops',validateEvidence:validatePowerWorkshopEvidence,writeLatest,lockHeld:true});
  const revisions=new Map(publication.index.blueprints.map(entry=>[entry.id,entry.revision]));
  return {blueprints:publication.records.map(record=>({...record,publicationRevision:revisions.get(record.id)})),sources:[{id:'power-workshops',author:'Factorio Command Center · original electric power workshops',url:DESTINATION+'/README.md'}]};
 });
}
