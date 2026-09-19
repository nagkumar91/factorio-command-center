import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {encodeBlueprint} from '../scripts/blueprints.mjs';
import {starterConfigurationHash} from '../scripts/starter-verification.mjs';
import {jsonBytes,jsonRevision,publishTransportWorkshops,sha256,withTransportPublicationLock} from '../scripts/transport-workshop-publication.mjs';

const output='widget';

function fixture(id,colour,order){
 const info={
  id,kind:'production',rawOnly:true,
  products:[output],sideProducts:[],rawInputs:['iron-ore'],researchClosure:['automation'],
  ports:[{kind:'output',entity:9,index:1,items:[output]}],
  loopControl:{controlled:[{entity:1}]}
 };
 const code=encodeBlueprint({blueprint:{item:'blueprint',label:id,version:562949958467584,entities:[],icons:[]}});
 const blueprintSha256=sha256(code),portConfigurationSha256=starterConfigurationHash(info);
 const common={id,blueprintSha256,portConfigurationSha256,passed:true,rawInputs:info.rawInputs,testedTechnologies:info.researchClosure,
  powerNetwork:{bigPoles:1,mediumPoles:1},loopControl:{readerVerified:true,controlledInserters:1},inputDisplays:{verified:1},
  restartedAfterCollection:true,drainedPorts:{9:1},restartedPorts:{9:true},machines:[{recipe:'widget',products:1}],firstProductTicks:{[output]:60}};
 const evidence={gameVersion:'2.0.77',mapSeed:12345,simulatedMinutes:45,builds:[common]};
 const throughput={gameVersion:'2.0.77',mapSeed:12345,simulatedMinutes:45,warmupMinutes:15,measuredMinutes:30,builds:[{...common,
  throughput:{warmupMinutes:15,measuredMinutes:30,collected:{[output]:30},perMinute:{[output]:1}}}]};
 const record={
  ...info,file:id+'.txt',name:id+' workshop',colour,order,blueprintSha256,code,
  sources:['sources/transport-workshops/'+id+'.txt'],preview:'assets/blueprints/'+id+'.png',
  validation:{status:'game-tested',kind:'production',blueprintSha256,report:'sources/transport-workshops/validation.json'},
  benchmark:{...throughput.builds[0].throughput,gameVersion:'2.0.77',report:'sources/transport-workshops/throughput.json'}
 };
 const assets={code:Buffer.from(code),preview:Buffer.from('preview-'+id),native:jsonBytes(evidence),throughput:jsonBytes(throughput)};
 return {info,evidence,throughput,record,assets,validated:new Map([[id,{info,evidence,throughput}]])};
}

async function isolated(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'transport-publication-'));
 return {root,siteRoot:path.join(root,'site'),sourceRoot:path.join(root,'source'),cacheRoot:path.join(root,'cache'),indexPath:path.join(root,'site/data/transport-workshops/index.json')};
}

async function readPublication(paths){
 return JSON.parse(await fs.readFile(paths.indexPath,'utf8'));
}

const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

test('publishes immutable records, preserves other colours, and keeps stable revisions',async()=>{
 const paths=await isolated();
 try{
  const yellow=fixture('transport-yellow','Yellow',0),red=fixture('transport-red','Red',1);
  const first=await publishTransportWorkshops({...paths,records:[yellow.record,red.record],assets:new Map([[yellow.record.id,yellow.assets],[red.record.id,red.assets]]),validated:new Map([...yellow.validated,...red.validated])});
  const firstIndexBytes=await fs.readFile(paths.indexPath),firstRed=first.index.blueprints.find(entry=>entry.id===red.record.id),firstYellow=first.index.blueprints.find(entry=>entry.id===yellow.record.id);
  assert.deepEqual(first.index.blueprints.map(entry=>entry.id),['transport-yellow','transport-red']);
  assert.equal(first.index.revision,jsonRevision({schemaVersion:1,blueprints:first.index.blueprints}));
  assert.equal(firstRed.blueprintSha256,yellow.record.id===firstRed.id?yellow.record.blueprintSha256:red.record.blueprintSha256);

  const stable=await publishTransportWorkshops({...paths,records:[yellow.record],assets:new Map([[yellow.record.id,yellow.assets]]),validated:yellow.validated});
  assert.equal(stable.index.revision,first.index.revision);
  assert.deepEqual(await fs.readFile(paths.indexPath),firstIndexBytes);
  assert.deepEqual(stable.index.blueprints.find(entry=>entry.id==='transport-red'),firstRed);

  const oldRedBytes=await fs.readFile(path.join(paths.siteRoot,firstRed.url));
  const changedEvidence={...red.evidence,reportRevision:'v2'};
  const changedThroughput={...red.throughput,reportRevision:'v2'};
  const changedRed={...red.assets,native:jsonBytes(changedEvidence),throughput:jsonBytes(changedThroughput)};
  const updated=await publishTransportWorkshops({...paths,records:[red.record],assets:new Map([[red.record.id,changedRed]]),validated:red.validated});
  const updatedRed=updated.index.blueprints.find(entry=>entry.id===red.record.id),updatedYellow=updated.index.blueprints.find(entry=>entry.id===yellow.record.id);
  assert.notEqual(updatedRed.revision,firstRed.revision);
  assert.deepEqual(updatedYellow,firstYellow);
  assert.deepEqual(await fs.readFile(path.join(paths.siteRoot,firstRed.url)),oldRedBytes);
  assert.notEqual(updatedRed.url,firstRed.url);
  for(const url of Object.values(JSON.parse(oldRedBytes).publication.snapshots))assert.ok(await fs.stat(path.join(paths.siteRoot,url)));

  const publication=await readPublication(paths);
  assert.equal(publication.revision,jsonRevision({schemaVersion:1,blueprints:publication.blueprints}));
  for(const descriptor of publication.blueprints){
   const bytes=await fs.readFile(path.join(paths.siteRoot,descriptor.url));
   const record=JSON.parse(bytes);
   assert.equal(sha256(bytes),descriptor.revision);
   assert.equal(record.id,descriptor.id);
   assert.equal(record.blueprintSha256,descriptor.blueprintSha256);
   assert.equal(record.validation.status,'game-tested');
   assert.equal(record.preview,record.publication.snapshots.preview);
   assert.equal(record.validation.report,record.publication.snapshots.native);
   assert.equal(record.benchmark.report,record.publication.snapshots.throughput);
   for(const [kind,url] of Object.entries(record.publication.snapshots)){
    const snapshot=await fs.readFile(path.join(paths.siteRoot,url));
    assert.equal(sha256(snapshot),record.publication.snapshotSha256[kind]);
   }
  }
 }finally{await fs.rm(paths.root,{recursive:true,force:true});}
});

test('rejects failed and mismatched functional or throughput evidence',async()=>{
 const paths=await isolated();
 try{
  const yellow=fixture('transport-yellow','Yellow',0);
  const misleadingRecord=structuredClone(yellow.record);misleadingRecord.benchmark.perMinute[output]=900;
  await assert.rejects(
   publishTransportWorkshops({...paths,records:[misleadingRecord],assets:new Map([[yellow.record.id,yellow.assets]]),validated:yellow.validated}),
   /displayed perMinute differs from native throughput evidence/
  );
  const failed=structuredClone(yellow.evidence);failed.builds[0].passed=false;
  await assert.rejects(
   publishTransportWorkshops({...paths,records:[yellow.record],assets:new Map([[yellow.record.id,yellow.assets]]),validated:new Map([[yellow.record.id,{info:yellow.info,evidence:failed,throughput:yellow.throughput}]])}),
   /functional evidence is failed/
  );
  const mismatched=structuredClone(yellow.throughput);mismatched.builds[0].blueprintSha256='0'.repeat(64);
  await assert.rejects(
   publishTransportWorkshops({...paths,records:[yellow.record],assets:new Map([[yellow.record.id,yellow.assets]]),validated:new Map([[yellow.record.id,{info:yellow.info,evidence:yellow.evidence,throughput:mismatched}]])}),
   /throughput evidence blueprint SHA does not match source/
  );
  const staleNative=structuredClone(yellow.evidence);staleNative.builds[0].blueprintSha256='0'.repeat(64);
  await assert.rejects(
   publishTransportWorkshops({...paths,records:[yellow.record],assets:new Map([[yellow.record.id,{...yellow.assets,native:jsonBytes(staleNative)}]]),validated:yellow.validated}),
   /functional evidence blueprint SHA does not match source/
  );
  assert.equal(await fs.stat(paths.indexPath).then(()=>true).catch(error=>error.code==='ENOENT'),true);
 }finally{await fs.rm(paths.root,{recursive:true,force:true});}
});

test('a changed tested layout increments its version and keeps the old download and evidence',async()=>{
 const paths=await isolated();
 try{
  const original=fixture('transport-yellow','Yellow',0);
  const publish=value=>publishTransportWorkshops({...paths,records:[value.record],assets:new Map([[value.record.id,value.assets]]),validated:value.validated});
  const first=await publish(original);
  assert.equal(first.records[0].publication.version,1);
  const next=structuredClone({...original,validated:undefined});
  const code=encodeBlueprint({blueprint:{item:'blueprint',label:'Improved layout',version:562949958467584,entities:[],icons:[]}});
  const sha=sha256(code);
  next.record.code=code;next.record.blueprintSha256=sha;next.record.validation.blueprintSha256=sha;
  next.evidence.builds[0].blueprintSha256=sha;next.throughput.builds[0].blueprintSha256=sha;
  next.assets={...original.assets,code:Buffer.from(code),native:jsonBytes(next.evidence),throughput:jsonBytes(next.throughput)};
  next.validated=new Map([[next.info.id,{info:next.info,evidence:next.evidence,throughput:next.throughput}]]);
  const updated=await publish(next),record=updated.records[0];
  assert.equal(record.publication.version,2);
  assert.equal(record.publication.history.length,1);
  const old=record.publication.history[0];
  assert.equal(old.version,1);assert.equal(old.blueprintSha256,original.record.blueprintSha256);
  assert.equal(await fs.readFile(path.join(paths.siteRoot,old.code),'utf8'),original.record.code);
  assert.equal(JSON.parse(await fs.readFile(path.join(paths.siteRoot,old.native))).builds[0].passed,true);
  const repeated=await publish(next);
  assert.equal(repeated.records[0].publication.version,2);
  assert.deepEqual(repeated.records[0].publication.history,record.publication.history);
 }finally{await fs.rm(paths.root,{recursive:true,force:true});}
});

test('separate blueprint collections keep independent indexes and immutable paths',async()=>{
 const paths=await isolated();
 try{
  const yellow=fixture('transport-yellow','Yellow',0),science=fixture('science-four-pack-30',undefined,0);
  await publishTransportWorkshops({...paths,records:[yellow.record],assets:new Map([[yellow.record.id,yellow.assets]]),validated:yellow.validated});
  const transportBytes=await fs.readFile(paths.indexPath);
  const scienceIndex=path.join(paths.siteRoot,'data/science-factories/index.json');
  const published=await publishTransportWorkshops({...paths,indexPath:scienceIndex,publicationDir:'data/science-factories',records:[science.record],assets:new Map([[science.record.id,science.assets]]),validated:science.validated,writeLatest:false});
  assert.deepEqual(await fs.readFile(paths.indexPath),transportBytes);
  assert.deepEqual(published.index.blueprints.map(entry=>entry.id),['science-four-pack-30']);
  assert.match(published.index.blueprints[0].url,/^data\/science-factories\/records\//);
  for(const url of Object.values(published.records[0].publication.snapshots))assert.match(url,/^data\/science-factories\/snapshots\//);
 }finally{await fs.rm(paths.root,{recursive:true,force:true});}
});

test('does not evict a live publication lock whose mtime is old',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'transport-lock-')),lockPath=path.join(root,'publish.lock');
 let releaseA,enteredA=false,enteredB=false,b;
 const held=new Promise(resolve=>{releaseA=resolve;});
 const a=withTransportPublicationLock({lockPath},async()=>{enteredA=true;await held;});
 try{
  while(!enteredA)await delay(5);
  b=withTransportPublicationLock({lockPath},async()=>{enteredB=true;});
  await delay(100);
  const old=new Date(Date.now()-11*60*1000);
  await fs.utimes(lockPath,old,old);
  await delay(200);
  assert.equal(enteredB,false,'a live owner must retain the lock even with an old mtime');
  releaseA();
  await Promise.all([a,b]);
  assert.equal(enteredB,true,'the waiter should enter after the owner releases');
 }finally{
  releaseA();
  await Promise.allSettled([a]);
  if(b)await Promise.allSettled([b]);
  await fs.rm(root,{recursive:true,force:true});
 }
});
