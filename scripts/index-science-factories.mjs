import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from './blueprints.mjs';
import {starterPreview,blueprintFootprint} from './starter-preview.mjs';
import {validateRawRateEvidence} from './blueprint-rate-evidence.mjs';
import {jsonBytes,jsonRevision,publishBlueprintCollection,withTransportPublicationLock} from './transport-workshop-publication.mjs';
import '../site/lib/production.js';

const SOURCE='blueprint-sources/science-factories',DESTINATION='sources/science-factories';
const PRODUCTS=['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack'];
const RAW=['iron-ore','copper-ore','coal','stone','water','crude-oil'];
const sameSet=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
function requireEvidence(condition,info,message){if(!condition)throw Error(info.id+': '+message);}

export function validateScienceEvidence(info,code,evidence,throughput){
 requireEvidence(info.scienceFactory&&info.rawOnly&&info.targetPerMinute===30,info,'missing science factory target');
 requireEvidence(sameSet(info.products,PRODUCTS)&&sameSet(info.rawInputs,RAW),info,'science products or raw inputs differ from the required boundary');
 const inputPorts=info.ports.filter(port=>['input','fluid'].includes(port.kind));
 const outputPorts=info.ports.filter(port=>port.kind==='output');
 requireEvidence(inputPorts.length===RAW.length&&sameSet(inputPorts.flatMap(port=>port.items),RAW)&&inputPorts.every(port=>port.externalSide==='west'),info,'six separate raw input ports must be on the west side');
 requireEvidence(outputPorts.length===PRODUCTS.length&&sameSet(outputPorts.flatMap(port=>port.items),PRODUCTS)&&outputPorts.every(port=>port.externalSide==='east'),info,'four separate science output ports must be on the east side');
 const electric=info.fuelPolicy?.furnaceFuel==='electricity';
 requireEvidence(['solid-fuel','electricity'].includes(info.fuelPolicy?.furnaceFuel),info,'missing furnace fuel policy');
 const checked=validateRawRateEvidence(info,code,evidence,throughput);
 for(const build of [checked.functional,checked.measured]){
  requireEvidence(build.research?.allEnabled===true,info,'production research was not enabled');
  requireEvidence(build.power?.allConnected===true&&build.power.bigPoles===1&&build.power.mediumPoles>0,info,'power network is incomplete');
  const fuel=build.fuel;
  if(electric){
   requireEvidence(fuel?.furnaceFuel==='electricity'&&fuel.allFurnacesPowered===true&&fuel.furnaces?.length>0,info,'electric furnace power was not demonstrated');
   requireEvidence(fuel.furnaces.every(furnace=>furnace.name==='electric-furnace'&&furnace.electricPoweredSeconds>0&&!Object.keys(furnace.burning||{}).length&&!Object.keys(furnace.inventorySamples||{}).length),info,'furnace was not powered by electricity alone');
  }else{
   requireEvidence(fuel?.furnaceFuel==='solid-fuel'&&fuel.solidFuelProduced>0&&fuel.furnaces?.length>0,info,'internal solid fuel was not demonstrated');
   for(const furnace of fuel.furnaces){
    requireEvidence(furnace.solidFuelBurnSeconds>0&&!Object.keys(furnace.nonSolidFuel||{}).length&&!Object.keys(furnace.nonSolidBurn||{}).length,info,'furnace burned another fuel or never burned solid fuel');
   }
  }
 }
 for(const port of outputPorts){
  requireEvidence(port.externalSide==='east'&&checked.functional.drainedPorts?.[port.entity]>0&&checked.functional.restartedPorts?.[port.entity]===true,info,'east output did not drain and refill');
 }
 for(const raw of RAW)requireEvidence(checked.measured.throughput.inputPerMinute[raw]>0,info,'raw input was not consumed: '+raw);
 for(const product of PRODUCTS)requireEvidence(checked.measured.throughput.perMinute[product]>=29.8,info,'output below 30/min target tolerance: '+product);
 return checked;
}

async function latestFiles({records,sourceRoot,siteRoot}){
 const directory=path.join(siteRoot,DESTINATION);
 await fs.mkdir(directory,{recursive:true});
 for(const record of records)await fs.writeFile(path.join(directory,record.file),record.code+'\n');
 const book={blueprint_book:{item:'blueprint-book',label:'Raw-input science factories',version:562949958467584,active_index:0,blueprints:records.map((record,index)=>({index,...decodeBlueprint(record.code)}))}};
 await fs.mkdir(path.join(siteRoot,'sources/collections'),{recursive:true});
 await fs.writeFile(path.join(siteRoot,'sources/collections/science-factories.txt'),encodeBlueprint(book)+'\n');
 for(const file of ['manifest.json','validation.json','throughput.json','README.md','REVIEW.md']){
  try{await fs.copyFile(path.join(sourceRoot,file),path.join(directory,file));}catch(error){if(error.code!=='ENOENT')throw error;}
 }
}

export async function indexScienceFactories(catalog,production){
 let manifest;
 try{manifest=JSON.parse(await fs.readFile(SOURCE+'/manifest.json'));}catch(error){
  if(error.code!=='ENOENT')throw error;
  // The update client can check this collection before its first verified
  // factory is published without requesting a nonexistent file.
  await withTransportPublicationLock({cacheRoot:'.cache/science-factory/publication'},async()=>{
   const indexPath='site/data/science-factories/index.json';
   try{await fs.access(indexPath);return;}catch(error){if(error.code!=='ENOENT')throw error;}
   const empty={schemaVersion:1,blueprints:[]};
   await fs.mkdir(path.dirname(indexPath),{recursive:true});
   await fs.writeFile(indexPath+'.tmp',jsonBytes({...empty,revision:jsonRevision(empty)}));
   await fs.rename(indexPath+'.tmp',indexPath);
  });
  return {blueprints:[],sources:[]};
 }
 const publication=await withTransportPublicationLock({cacheRoot:'.cache/science-factory/publication'},async()=>{
  const evidence=JSON.parse(await fs.readFile(SOURCE+'/validation.json'));
  const throughput=JSON.parse(await fs.readFile(SOURCE+'/throughput.json'));
  const records=[],assets=new Map(),validated=new Map();
  for(const info of manifest){
   const code=(await fs.readFile(SOURCE+'/'+info.file,'utf8')).trim();
   const checked=validateScienceEvidence(info,code,evidence,throughput),object=decodeBlueprint(code);
   const analysis=FactorioProduction.analyzeBlueprint(object,production);
   analysis.inputs=[...new Set([...analysis.inputs,...info.rawInputs])].sort();
   requireEvidence(analysis.inputs.every(id=>RAW.includes(id)),info,'processed external input in recipe analysis');
   // Burner fuel is consumed internally even though it is not a recipe ingredient.
   analysis.outputs=analysis.outputs.filter(id=>id!=='solid-fuel');
   analysis.netOutputs=analysis.netOutputs.filter(id=>id!=='solid-fuel');
   if(info.fuelPolicy.furnaceFuel==='solid-fuel')analysis.internal=[...new Set([...analysis.internal,'solid-fuel'])].sort();
   const preview=await starterPreview(object.blueprint,info,production);
   const record={...info,author:'Factorio Command Center',collection:'Science factories',section:'Four science packs from raw materials',category:'Science',starter:false,isBook:false,icons:info.products,sources:[DESTINATION+'/'+info.file,DESTINATION+'/README.md'],...blueprintMaterials(object,catalog),code,blueprintSha256:checked.blueprintSha256,analysis,connectionPorts:info.ports,ports:[],footprint:blueprintFootprint(object.blueprint,production),preview,reviewReport:DESTINATION+'/REVIEW.md',
    validation:{status:'game-tested',kind:'production',blueprintSha256:checked.blueprintSha256,firstOutputSeconds:Math.round(Math.min(...Object.values(checked.functional.firstProductTicks))/60),report:DESTINATION+'/validation.json',note:'Passed 45 simulated minutes in Factorio '+evidence.gameVersion+' from an empty start with only the six labeled raw inputs and external electricity. All four outputs refilled after collection. '+(info.fuelPolicy.furnaceFuel==='electricity'?'Every furnace ran on external electricity.':'Every furnace burned solid fuel made inside the factory.')+' All '+(info.fuelPolicy.furnaceFuel==='electricity'?'machines':'electric machines')+' and inserters were connected to P.'},
    benchmark:{...checked.measured.throughput,gameVersion:throughput.gameVersion,report:DESTINATION+'/throughput.json'}};
   records.push(record);
   assets.set(info.id,{code:Buffer.from(code),native:jsonBytes({...evidence,builds:[checked.functional]}),throughput:jsonBytes({...throughput,builds:[checked.measured]})});
   validated.set(info.id,{info,evidence,throughput});
  }
  return publishBlueprintCollection({records,assets,validated,sourceRoot:SOURCE,siteRoot:'site',publicationDir:'data/science-factories',validateEvidence:validateScienceEvidence,writeLatest:latestFiles,lockHeld:true});
 });
 const revisions=new Map(publication.index.blueprints.map(entry=>[entry.id,entry.revision]));
 return {blueprints:publication.records.map(record=>({...record,publicationRevision:revisions.get(record.id)})),sources:[{id:'science-factories',author:'Factorio Command Center · original science factories',url:DESTINATION+'/README.md'}]};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [catalog,production]=await Promise.all(['catalog','production'].map(async id=>JSON.parse(await fs.readFile('site/data/'+id+'.json'))));
 const result=await indexScienceFactories(catalog,production);
 console.log(JSON.stringify({published:result.blueprints.map(record=>record.id)}));
}
