import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from './blueprints.mjs';
import {starterPreview,blueprintFootprint} from './starter-preview.mjs';
import {starterConfigurationHash} from './starter-verification.mjs';
import {validateConsumptionRates} from './blueprint-rate-evidence.mjs';
import '../site/lib/production.js';

export const TRANSPORT_SOURCE_ROOT='blueprint-sources/transport-workshops';
export const TRANSPORT_SITE_ROOT='site';
export const TRANSPORT_PUBLICATION_DIR='data/transport-workshops';
export const TRANSPORT_PUBLICATION_INDEX=TRANSPORT_PUBLICATION_DIR+'/index.json';
export const TRANSPORT_PUBLICATION_CACHE='.cache/transport-workshops';

const HASH=/^[0-9a-f]{64}$/;
const ID=/^[a-z0-9-]+$/;

export function jsonBytes(value){return Buffer.from(JSON.stringify(value,null,2)+'\n');}
export function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
export function jsonRevision(value){return sha256(jsonBytes(value));}

function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function safeId(id){return typeof id==='string'&&ID.test(id);}
function filePath(root,url){
 if(typeof url!=='string'||url.startsWith('/')||url.split('/').includes('..'))throw Error('Unsafe site URL: '+url);
 return path.join(root,...url.split('/'));
}
async function readJSON(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function readOptional(file){try{return await fs.readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}

function fail(id,message){throw Error(id+': '+message);}

/**
 * Validate the two reports against the exact source code and manifest setup.
 * This is shared by atlas indexing and the per-blueprint publisher so a
 * publication cannot accidentally use a stale or failed native run.
 */
export function validateTransportEvidence(info,code,evidence,throughput){
 const id=info.id, codeSha=sha256(code), configuration=starterConfigurationHash(info);
 const functional=evidence?.builds?.find(build=>build.id===id);
 if(!functional)fail(id,'missing functional evidence');
 if(functional.blueprintSha256!==codeSha)fail(id,'functional evidence blueprint SHA does not match source');
 if(functional.portConfigurationSha256!==configuration)fail(id,'functional evidence configuration SHA does not match manifest');
 if(functional.passed!==true)fail(id,'functional evidence is failed');
 if(!same(functional.rawInputs,info.rawInputs))fail(id,'functional raw inputs do not match manifest');
 if(!same(functional.testedTechnologies,info.researchClosure))fail(id,'functional research closure does not match manifest');
 if(functional.powerNetwork?.bigPoles!==1||!(functional.powerNetwork?.mediumPoles>0))fail(id,'functional power network is incomplete');
 if(functional.loopControl?.readerVerified!==true||functional.loopControl.controlledInserters!==info.loopControl.controlled.length)fail(id,'functional circuit loop evidence is incomplete');
 if(functional.inputDisplays?.verified!==info.rawInputs.length)fail(id,'functional input-display evidence is incomplete');
 if(functional.restartedAfterCollection!==true)fail(id,'functional output collection did not restart');
 for(const port of info.ports.filter(port=>port.kind==='output')){
  if(!(functional.drainedPorts?.[port.entity]>0))fail(id,'functional output port was not drained: '+port.entity);
  if(functional.restartedPorts?.[port.entity]!==true)fail(id,'functional output port did not restart: '+port.entity);
 }
 for(const machine of functional.machines||[])if(machine.products<=0)fail(id,'functional machine produced nothing: '+(machine.recipe||machine.id));

 const measured=throughput?.builds?.find(build=>build.id===id);
 if(!measured)fail(id,'missing throughput evidence');
 if(measured.blueprintSha256!==codeSha)fail(id,'throughput evidence blueprint SHA does not match source');
 if(measured.portConfigurationSha256!==configuration)fail(id,'throughput evidence configuration SHA does not match manifest');
 if(measured.passed!==true)fail(id,'throughput evidence is failed');
 if(!same(measured.rawInputs,info.rawInputs))fail(id,'throughput raw inputs do not match manifest');
 if(!same(measured.testedTechnologies,info.researchClosure))fail(id,'throughput research closure does not match manifest');
 if(measured.powerNetwork?.bigPoles!==1||!(measured.powerNetwork?.mediumPoles>0))fail(id,'throughput power network is incomplete');
 if(measured.loopControl?.readerVerified!==true||measured.loopControl.controlledInserters!==info.loopControl.controlled.length)fail(id,'throughput circuit loop evidence is incomplete');
 if(measured.inputDisplays?.verified!==info.rawInputs.length)fail(id,'throughput input-display evidence is incomplete');
 const measurement=measured.throughput;
 if(measurement?.inputPerMinute)validateConsumptionRates(info,measurement);
 if(!measurement||!(measurement.measuredMinutes>=20)||!(measurement.warmupMinutes>=10))fail(id,'throughput measurement window is too short');
 for(const product of [...info.products,...(info.sideProducts||[])]){
  const collected=measurement.collected?.[product],rate=measurement.perMinute?.[product];
  if(!(collected>0))fail(id,'throughput collected no '+product);
  if(rate!==collected/measurement.measuredMinutes)fail(id,'throughput rate does not match collected count for '+product);
 }
 for(const machine of measured.machines||[])if(machine.products<=0)fail(id,'throughput machine produced nothing: '+(machine.recipe||machine.id));
 return {blueprintSha256:codeSha,portConfigurationSha256:configuration,functional,measured};
}

function firstOutputSeconds(info,checked){
 const ticks=info.products.map(id=>checked.functional.firstProductTicks?.[id]??checked.functional.firstOutputTick).filter(Number.isFinite);
 return ticks.length?Math.round(Math.min(...ticks)/60):undefined;
}

async function buildOneTransportRecord(info,code,checked,evidenceReport,throughputReport,catalog,production,previewWriter,previewRoot){
 const object=decodeBlueprint(code);
 const analysis=FactorioProduction.analyzeBlueprint(object,production);
 analysis.inputs=[...new Set([...analysis.inputs,...info.rawInputs])].sort();
 if(analysis.inputs.some(id=>!info.rawInputs.includes(id)))fail(info.id,'intermediate operating supply');
 const localSource='sources/transport-workshops/'+info.file;
 const preview=await previewWriter(object.blueprint,info,production);
 const record={...info,collection:'Transport workshops',section:info.name,isBook:false,icons:info.products,sources:[localSource,info.sourceURL],...blueprintMaterials(object,catalog),code,blueprintSha256:checked.blueprintSha256,analysis,starter:false,connectionPorts:info.ports,ports:[],footprint:blueprintFootprint(object.blueprint,production),reviewReport:'sources/transport-workshops/REVIEW.md',
  validation:{status:'game-tested',kind:'production',blueprintSha256:checked.blueprintSha256,report:'sources/transport-workshops/validation.json',firstOutputSeconds:firstOutputSeconds(info,checked),note:'Passed '+evidenceReport.simulatedMinutes+' simulated minutes in Factorio '+evidenceReport.gameVersion+' with only the labeled raw materials and electricity at P. Every recipe ran and each transport output reached its own chest. Each emptied output chest replenished. All poles, electric machines and inserters were connected to P; input display icons and text were verified.'},
  benchmark:{...checked.measured.throughput,gameVersion:throughputReport.gameVersion,report:'sources/transport-workshops/throughput.json'},
  preview};
 const previewFile=filePath(previewRoot,preview);
 const previewBytes=await fs.readFile(previewFile);
 return {record,assets:{code:Buffer.from(code),preview:previewBytes}};
}

/**
 * Build ordinary atlas records for the selected transport entries.  This
 * does not publish immutable versions; callers can use publishTransportWorkshops
 * after the records have been built.
 */
export async function buildTransportWorkshopRecords(catalog,production,{sourceRoot=TRANSPORT_SOURCE_ROOT,previewRoot=TRANSPORT_SITE_ROOT,ids,previewWriter=starterPreview}={}){
 const manifest=await readJSON(path.join(sourceRoot,'manifest.json'));
 const publishable=manifest.filter(info=>info.publicationStatus!=='draft');
 let selected;
 if(ids?.length){
  const wanted=new Set(ids);
  const unknown=ids.filter(id=>!manifest.some(info=>info.id===id));
  if(unknown.length)throw Error('Unknown transport workshop: '+unknown.join(', '));
  const drafts=ids.filter(id=>manifest.find(info=>info.id===id)?.publicationStatus==='draft');
  if(drafts.length)throw Error('Transport workshop is draft: '+drafts.join(', '));
  selected=publishable.filter(info=>wanted.has(info.id));
 }else selected=publishable;
 const evidence=await readJSON(path.join(sourceRoot,'validation.json'));
 const throughput=await readJSON(path.join(sourceRoot,'throughput.json'));
 const records=[],assets=new Map(),validated=new Map();
 for(const info of selected){
  if(!safeId(info.id))throw Error('Unsafe transport workshop id: '+info.id);
  const code=(await fs.readFile(path.join(sourceRoot,info.file),'utf8')).trim();
  const checked=validateTransportEvidence(info,code,evidence,throughput);
  const built=await buildOneTransportRecord(info,code,checked,evidence,throughput,catalog,production,previewWriter,previewRoot);
  built.assets.native=jsonBytes({...evidence,builds:evidence.builds.filter(build=>build.id===info.id)});
  built.assets.throughput=jsonBytes({...throughput,builds:throughput.builds.filter(build=>build.id===info.id)});
  records.push(built.record);assets.set(info.id,built.assets);
  validated.set(info.id,{info,evidence,throughput});
 }
 return {records,assets,validated,manifest,sourceRoot,previewRoot};
}

async function writeAtomic(file,bytes){
 const absolute=path.resolve(file),directory=path.dirname(absolute);
 await fs.mkdir(directory,{recursive:true});
 const temporary=absolute+'.tmp-'+process.pid+'-'+crypto.randomBytes(6).toString('hex');
 try{await fs.writeFile(temporary,bytes,{flag:'wx'});await fs.rename(temporary,absolute);}finally{await fs.rm(temporary,{force:true});}
}

async function writeImmutable(file,bytes){
 const absolute=path.resolve(file),directory=path.dirname(absolute);
 await fs.mkdir(directory,{recursive:true});
 try{
  const current=await fs.readFile(absolute);
  if(!current.equals(bytes))throw Error('Immutable publication path collision: '+file);
  return;
 }catch(error){if(error.code!=='ENOENT')throw error;}
 const temporary=absolute+'.tmp-'+process.pid+'-'+crypto.randomBytes(6).toString('hex');
 try{
  await fs.writeFile(temporary,bytes,{flag:'wx'});
  try{await fs.rename(temporary,absolute);}catch(error){
   if(error.code!=='EEXIST')throw error;
   const current=await fs.readFile(absolute);if(!current.equals(bytes))throw Error('Immutable publication path collision: '+file);
  }
 }finally{await fs.rm(temporary,{force:true});}
}

async function acquireLock(lockPath,timeoutMs=120000){
 const absolute=path.resolve(lockPath),directory=path.dirname(absolute),started=Date.now();
 await fs.mkdir(directory,{recursive:true});
 while(true){
  try{
   const handle=await fs.open(absolute,'wx');
   await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})+'\n');
   return async()=>{try{await fs.rm(absolute,{force:true});}finally{await handle.close();}};
  }catch(error){
   if(error.code!=='EEXIST')throw error;
   // Age alone cannot distinguish a crashed owner from a long publication.
   // Never unlink another owner's lock; recovery must first confirm it stopped.
   if(Date.now()-started>=timeoutMs)throw Error('Timed out waiting for transport publication lock: '+lockPath);
   await new Promise(resolve=>setTimeout(resolve,75));
  }
 }
}

/** Serialize preview generation together with publication for callers that
 * build records before handing them to publishTransportWorkshops. */
export async function withTransportPublicationLock({cacheRoot=TRANSPORT_PUBLICATION_CACHE,lockPath=path.join(cacheRoot,'publish.lock')}={},work){
 if(typeof work!=='function')throw Error('Transport publication lock requires a callback');
 const release=await acquireLock(lockPath);
 try{return await work();}finally{await release();}
}

function snapshotURL(directory,id,kind,hash,extension){return directory+'/snapshots/'+id+'/'+kind+'/'+hash+'.'+extension;}
function recordURL(directory,id,revision){return directory+'/records/'+id+'/'+revision+'.json';}

async function assetBytes(record,assets,siteRoot){
 const supplied=assets?.get?.(record.id)||assets?.[record.id]||{};
 const code=supplied.code||Buffer.from(record.code);
 const preview=supplied.preview||await fs.readFile(filePath(siteRoot,record.preview));
 const native=supplied.native||await fs.readFile(filePath(siteRoot,record.validation.report));
 const throughput=supplied.throughput||await fs.readFile(filePath(siteRoot,record.benchmark.report));
 return {code:Buffer.from(code),preview:Buffer.from(preview),native:Buffer.from(native),throughput:Buffer.from(throughput)};
}

function ensureRecordInput(record){
 if(!record||!safeId(record.id))throw Error('Invalid indexed transport record id');
 if(record.validation?.status!=='game-tested')throw Error(record.id+': record is not game-tested');
 if(!record.benchmark?.perMinute)throw Error(record.id+': record has no measured throughput');
 const codeSha=sha256(record.code||'');
 if(record.blueprintSha256&&record.blueprintSha256!==codeSha)throw Error(record.id+': record code SHA does not match its code');
 return codeSha;
}

function validateRecordRates(record,checked){
 const measured=checked.measured.throughput;
 for(const key of ['warmupMinutes','measuredMinutes','collected','perMinute','inputCounts','inputPerMinute','rateBasis']){
  if(Object.hasOwn(measured,key)&&!same(record.benchmark[key],measured[key]))fail(record.id,'displayed '+key+' differs from native throughput evidence');
 }
}

async function snapshotRecord(record,assets,siteRoot,info,validateEvidence,publicationDir){
 const codeSha=ensureRecordInput(record),bytes=await assetBytes(record,assets,siteRoot);
 if(sha256(bytes.code)!==codeSha)throw Error(record.id+': supplied code snapshot does not match record');
 let native,throughput;
 try{native=JSON.parse(bytes.native.toString('utf8'));throughput=JSON.parse(bytes.throughput.toString('utf8'));}
 catch(error){throw Error(record.id+': supplied evidence snapshots are not JSON ('+error.message+')');}
 validateRecordRates(record,validateEvidence(info,record.code,native,throughput));
 for(const [report,label] of [[native,'functional'],[throughput,'throughput']]){
  if(!Array.isArray(report.builds)||report.builds.length!==1||report.builds[0].id!==info.id)throw Error(record.id+': '+label+' snapshot must contain only its selected build');
 }
 const hashes={code:sha256(bytes.code),preview:sha256(bytes.preview),native:sha256(bytes.native),throughput:sha256(bytes.throughput)};
 const urls={code:snapshotURL(publicationDir,record.id,'code',hashes.code,'txt'),preview:snapshotURL(publicationDir,record.id,'preview',hashes.preview,'png'),native:snapshotURL(publicationDir,record.id,'native',hashes.native,'json'),throughput:snapshotURL(publicationDir,record.id,'throughput',hashes.throughput,'json')};
 await writeImmutable(filePath(siteRoot,urls.code),bytes.code);
 await writeImmutable(filePath(siteRoot,urls.preview),bytes.preview);
 await writeImmutable(filePath(siteRoot,urls.native),bytes.native);
 await writeImmutable(filePath(siteRoot,urls.throughput),bytes.throughput);
 const published=JSON.parse(JSON.stringify(record));
 published.preview=urls.preview;
 published.validation={...published.validation,report:urls.native};
 published.benchmark={...published.benchmark,report:urls.throughput};
 published.sources=[...new Set([...(published.sources||[]).filter(source=>!(source.startsWith('sources/')&&source.endsWith('/'+record.file))),urls.code])];
 published.publication={schemaVersion:1,snapshots:urls,snapshotSha256:hashes};
 return published;
}

async function validatePublishedRecord(record,siteRoot){
 const codeSha=ensureRecordInput(record);
 if(record.validation.blueprintSha256!==codeSha)throw Error(record.id+': validation does not name record code SHA');
 const snapshots=record.publication?.snapshots;
 if(!snapshots||!['code','preview','native','throughput'].every(kind=>typeof snapshots[kind]==='string'))throw Error(record.id+': immutable snapshots are missing');
 const snapshotHashes=record.publication?.snapshotSha256;
 if(!snapshotHashes||!['code','preview','native','throughput'].every(kind=>typeof snapshotHashes[kind]==='string'&&HASH.test(snapshotHashes[kind])))throw Error(record.id+': immutable snapshot hashes are missing');
 if(snapshotHashes.code!==codeSha)throw Error(record.id+': code snapshot hash does not match record code');
 for(const kind of ['code','preview','native','throughput']){
  const snapshot=await readOptional(filePath(siteRoot,snapshots[kind]));
  if(!snapshot)throw Error(record.id+': missing '+kind+' snapshot');
  if(sha256(snapshot)!==snapshotHashes[kind])throw Error(record.id+': '+kind+' snapshot hash mismatch');
 }
 if(record.preview!==snapshots.preview||record.validation.report!==snapshots.native||record.benchmark.report!==snapshots.throughput)throw Error(record.id+': record does not reference its immutable snapshots');
 for(const kind of ['native','throughput']){
  const report=await readJSON(filePath(siteRoot,snapshots[kind]));
  const build=report.builds?.find(build=>build.id===record.id);
  if(!build?.passed||build.blueprintSha256!==codeSha)throw Error(record.id+': historical '+kind+' evidence is failed or mismatched');
 }
 return codeSha;
}

function versionDescriptor(record,descriptor,number){
 return {version:number,blueprintSha256:record.blueprintSha256,revision:descriptor.revision,url:descriptor.url,code:record.publication.snapshots.code,preview:record.preview,native:record.validation.report,throughput:record.benchmark.report,...(record.footprint?{footprint:record.footprint}:{}),...(Number.isFinite(record.entityCount)?{entityCount:record.entityCount}:{}),perMinute:record.benchmark.perMinute};
}

/** Archive tested layouts, not every metadata refresh of the same string. */
async function versionHistory(record,previous,siteRoot,publicationDir){
 let history=[],version;
 if(previous?.record.publication?.version){
  const old=previous.record;
  history=[...(old.publication.history||[])];
  if(old.blueprintSha256===record.blueprintSha256)version=old.publication.version;
  else{
   history.push(versionDescriptor(old,previous.descriptor,old.publication.version));
   const reused=history.find(entry=>entry.blueprintSha256===record.blueprintSha256);
   version=reused?.version??Math.max(0,...history.map(entry=>entry.version))+1;
   history=history.filter(entry=>entry.blueprintSha256!==record.blueprintSha256);
  }
 }else{
  // Recover earlier immutable publications when upgrading an existing site.
  const directory=filePath(siteRoot,publicationDir+'/records/'+record.id);
  let names=[];try{names=await fs.readdir(directory);}catch(error){if(error.code!=='ENOENT')throw error;}
  const layouts=new Map();
  for(const name of names.filter(name=>/^[a-f0-9]{64}\.json$/.test(name))){
   const file=path.join(directory,name),bytes=await fs.readFile(file);
   if(sha256(bytes)!==name.slice(0,-5))throw Error(record.id+': historical record hash mismatch');
   const old=JSON.parse(bytes);
   await validatePublishedRecord(old,siteRoot);
   const time=(await fs.stat(file)).mtimeMs,seen=layouts.get(old.blueprintSha256);
   const entry={record:old,descriptor:{url:publicationDir+'/records/'+record.id+'/'+name,revision:name.slice(0,-5)},first:Math.min(time,seen?.first??Infinity),last:time};
   if(seen&&seen.last>time){seen.first=entry.first;continue;}
   layouts.set(old.blueprintSha256,entry);
  }
  const ordered=[...layouts.values()].sort((a,b)=>a.first-b.first||a.record.blueprintSha256.localeCompare(b.record.blueprintSha256));
  for(const [index,old]of ordered.entries()){
   if(old.record.blueprintSha256===record.blueprintSha256)version=index+1;
   else history.push(versionDescriptor(old.record,old.descriptor,index+1));
  }
  version??=ordered.length+1;
 }
 return {version,history:history.sort((a,b)=>a.version-b.version)};
}

async function readExistingPublication(siteRoot,indexPath){
 let bytes;try{bytes=await fs.readFile(indexPath);}catch(error){if(error.code==='ENOENT')return {index:null,entries:[]};throw error;}
 const index=JSON.parse(bytes);
 if(index.schemaVersion!==1||!Array.isArray(index.blueprints)||typeof index.revision!=='string'||!HASH.test(index.revision))throw Error('Invalid transport publication index');
 if(index.revision!==jsonRevision({schemaVersion:1,blueprints:index.blueprints}))throw Error('Transport publication index revision is invalid');
 const entries=[];const seen=new Set();
 for(const descriptor of index.blueprints){
  if(!safeId(descriptor.id)||seen.has(descriptor.id))throw Error('Duplicate or invalid transport publication id: '+descriptor.id);seen.add(descriptor.id);
  if(typeof descriptor.url!=='string'||!HASH.test(descriptor.revision)||typeof descriptor.blueprintSha256!=='string'||!HASH.test(descriptor.blueprintSha256))throw Error('Invalid transport publication descriptor: '+descriptor.id);
  const recordBytes=await fs.readFile(filePath(siteRoot,descriptor.url));
  if(sha256(recordBytes)!==descriptor.revision)throw Error('Transport publication record revision mismatch: '+descriptor.id);
  const record=JSON.parse(recordBytes);
  if(record.id!==descriptor.id||record.name!==descriptor.name||record.colour!==descriptor.colour||record.blueprintSha256!==descriptor.blueprintSha256)throw Error('Transport publication descriptor does not match record: '+descriptor.id);
  await validatePublishedRecord(record,siteRoot);
  entries.push({descriptor,record,recordBytes});
 }
 return {index,entries};
}

function combinedBook(records){
 const book={blueprint_book:{item:'blueprint-book',label:'Transport workshops · raw inputs',version:562949958467584,active_index:0,blueprints:[]}};
 for(const record of records)book.blueprint_book.blueprints.push({index:book.blueprint_book.blueprints.length,...decodeBlueprint(record.code)});
 return encodeBlueprint(book)+'\n';
}

/** Write the current aliases used by the atlas/site and regenerate the book. */
export async function writeLatestTransportWorkshopFiles({records,sourceRoot=TRANSPORT_SOURCE_ROOT,siteRoot=TRANSPORT_SITE_ROOT}={}){
 const sourceDirectory=path.join(siteRoot,'sources/transport-workshops');
 for(const record of records)await writeAtomic(path.join(sourceDirectory,record.file),Buffer.from(record.code.trim()+'\n'));
 await writeAtomic(path.join(siteRoot,'sources/collections/transport-workshops.txt'),Buffer.from(combinedBook(records)));
 for(const file of ['README.md','REVIEW.md','manifest.json','validation.json','throughput.json']){
  const bytes=await readOptional(path.join(sourceRoot,file));
  if(bytes)await writeAtomic(path.join(sourceDirectory,file),bytes);
 }
}

/**
 * Publish selected ordinary indexed records.  Existing descriptors are read
 * from the immutable index and preserved unless their id is selected again.
 * The index rename is deliberately the final filesystem mutation.
 */
function validatedEntry(validated,id){return validated?.get?.(id)||validated?.[id];}

function validateSelectedRecord(record,validated,validateEvidence){
 const entry=validatedEntry(validated,record.id);
 if(!entry?.info||!entry.evidence||!entry.throughput)fail(record.id,'missing validated functional/throughput evidence');
 const checked=validateEvidence(entry.info,record.code,entry.evidence,entry.throughput);
 validateRecordRates(record,checked);
 if(record.blueprintSha256!==checked.blueprintSha256||record.validation?.blueprintSha256!==checked.blueprintSha256)fail(record.id,'record code SHA does not match validated evidence');
 return checked;
}

async function publishTransportWorkshopsLocked({records,assets=new Map(),validated,sourceRoot=TRANSPORT_SOURCE_ROOT,siteRoot=TRANSPORT_SITE_ROOT,publicationDir=TRANSPORT_PUBLICATION_DIR,indexPath=path.join(siteRoot,publicationDir,'index.json'),validateEvidence=validateTransportEvidence,writeLatest=true}={}){
 if(!Array.isArray(records)||!records.length)throw Error('No transport workshop records selected for publication');
 if(typeof validateEvidence!=='function')throw Error('A native evidence validator is required');
 filePath(siteRoot,publicationDir);
 const existing=await readExistingPublication(siteRoot,indexPath),selected=new Map();
 const oldById=new Map(existing.entries.map(entry=>[entry.descriptor.id,entry]));
 for(const record of records){
  if(selected.has(record.id))throw Error('Duplicate selected transport workshop: '+record.id);
  validateSelectedRecord(record,validated,validateEvidence);
  selected.set(record.id,record);
 }
 const published=new Map();
 for(const record of records){
  const entry=validatedEntry(validated,record.id);
  const version=await snapshotRecord(record,assets,siteRoot,entry.info,validateEvidence,publicationDir);
  Object.assign(version.publication,await versionHistory(version,oldById.get(record.id),siteRoot,publicationDir));
  const recordBytes=jsonBytes(version),revision=sha256(recordBytes),url=recordURL(publicationDir,version.id,revision);
  await writeImmutable(filePath(siteRoot,url),recordBytes);
  published.set(version.id,{record:version,descriptor:{id:version.id,name:version.name,colour:version.colour,revision,url,blueprintSha256:version.blueprintSha256},recordBytes});
 }
 const merged=[];
 for(const entry of existing.entries){if(published.has(entry.descriptor.id))merged.push(published.get(entry.descriptor.id));else merged.push(entry);}
 for(const record of records)if(!oldById.has(record.id))merged.push(published.get(record.id));
 merged.sort((a,b)=>{
  const ai=a.record.order??Number.MAX_SAFE_INTEGER,bi=b.record.order??Number.MAX_SAFE_INTEGER;
  return ai-bi||a.record.id.localeCompare(b.record.id);
 });
 const mergedRecords=merged.map(entry=>entry.record),blueprints=merged.map(entry=>entry.descriptor);
 if(typeof writeLatest==='function')await writeLatest({records:mergedRecords,sourceRoot,siteRoot});
 else if(writeLatest)await writeLatestTransportWorkshopFiles({records:mergedRecords,sourceRoot,siteRoot});
 const index={schemaVersion:1,revision:jsonRevision({schemaVersion:1,blueprints}),blueprints};
 await writeAtomic(indexPath,jsonBytes(index));
 return {index,records:mergedRecords,blueprints};
}

export async function publishBlueprintCollection(options={}){
 const {lockHeld=false,lockPath=path.join(options.cacheRoot||TRANSPORT_PUBLICATION_CACHE,'publish.lock')}=options;
 if(lockHeld)return publishTransportWorkshopsLocked(options);
 const release=await acquireLock(lockPath);
 try{return await publishTransportWorkshopsLocked(options);}finally{await release();}
}

export const publishTransportWorkshops=publishBlueprintCollection;
