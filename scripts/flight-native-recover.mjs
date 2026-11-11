#!/usr/bin/env node
// Recover completed native files after an interrupted orchestrator. Does not run
// Factorio or promote partial simulations. Original run artifacts stay intact.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,configurationHash,evaluateNative} from './flight-native-lib.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=process.argv[2];
if(!runId || !/^[a-zA-Z0-9_-]+$/.test(runId))throw new Error('Usage: node scripts/flight-native-recover.mjs RUN_ID');
const root=path.join(project,'.cache/flight-native'),runRoot=path.join(root,'runs',runId);
const recoveryId=runId+'-recovered-'+Date.now(),reports=path.join(root,'reports',recoveryId);
await fs.mkdir(reports,{recursive:true});
const writeJSON=(file,value)=>fs.writeFile(file,JSON.stringify(value,null,2)+'\n');
const metadata=JSON.parse(await fs.readFile(path.join(runRoot,'run-metadata.json'),'utf8').catch(()=>'{"scope":"started-batches-only"}'));
const priorDirectory=path.join(root,'reports',runId);
let prior;
for(const name of await fs.readdir(priorDirectory).catch(()=>[]))if(name!=='summary.json'){
  const row=JSON.parse(await fs.readFile(path.join(priorDirectory,name),'utf8'));
  if(row.prototypeVerification){prior=row;break;}
}
const prototypeVerification=metadata.prototypeVerification || prior?.prototypeVerification;
if(!prototypeVerification?.matched || !prototypeVerification.exactBytes)throw new Error('No exact verified prototype snapshot to bind recovered evidence');
const runtime=await fs.readFile(path.join(runRoot,'prototype-verification/script-output/data-raw-dump.json'));
if(sha256(runtime)!==prototypeVerification.runtimeSha256 || configurationHash(JSON.parse(runtime))!==prototypeVerification.canonicalSha256)throw new Error('Native prototype snapshot changed');
const expectedMods=JSON.parse(await fs.readFile(path.join(runRoot,'snapshot-mods/mod-list.json'),'utf8')).mods.filter(m=>m.enabled).map(m=>m.name).sort();
const builds=[];
for(const directory of (await fs.readdir(runRoot)).filter(n=>n==='priority' || n.startsWith('batch-'))){
  const base=path.join(runRoot,directory),mod=path.join(base,'mods/flight_native_test');
  const payload=await fs.readFile(path.join(mod,'payload.lua'),'utf8');
  const match=/^return \[(=*)\[([\s\S]*)\]\1\]\s*$/.exec(payload);
  if(!match)throw new Error('Unrecognized archived payload '+directory);
  const value=JSON.parse(match[2]),specs=value.builds || [value];
  const nativeControlSha256=sha256(await fs.readFile(path.join(mod,'control.lua')));
  for(const spec of specs){
    let native;
    let result={id:spec.id,blueprintSha256:spec.blueprintSha256,prototypeDumpSha256:spec.prototypeDumpSha256,
      specSha256:spec.specSha256,sourceSpecSha256:spec.sourceSpecSha256,configurationSha256:spec.configurationSha256,
      configuration:JSON.parse(JSON.stringify({...spec,code:undefined,entities:undefined,entityTypes:undefined,unsupported:undefined})),
      runId:recoveryId,originalRunId:runId,runDirectory:path.relative(project,base),recovered:true,nativeControlSha256,
      prototypeVerification,modSnapshotSha256:metadata.modSnapshot?.sha256 || prior?.modSnapshotSha256};
    try{
      if(sha256(spec.code)!==spec.blueprintSha256 || spec.prototypeDumpSha256!==prototypeVerification.sourceSha256)throw new Error('Archived input hashes differ');
      native=JSON.parse(await fs.readFile(path.join(base,'script-output','flight-native-'+spec.id+'.json'),'utf8'));
      if(native.error)throw new Error(`Native ${native.phase}: ${native.error}`);
      if(native.gameVersion!=='2.0.77' || JSON.stringify(Object.keys(native.activeMods).sort())!==JSON.stringify(expectedMods))throw new Error('Native game/mod identity mismatch');
      result={...result,...evaluateNative(spec,native),native};
    }catch(error){result={...result,status:Object.values(native?.invalidBlueprintEntities || {}).length?'failed':'error',passed:false,functionalPassed:false,throughputPassed:false,reasons:[error.message],...(native?{native}: {})};}
    await writeJSON(path.join(reports,spec.id+'.json'),result);builds.push(result);
  }
}
const summary={schemaVersion:1,...metadata,runId:recoveryId,originalRunId:runId,recoveredAt:new Date().toISOString(),
  recovered:true,stoppedAfterActiveBatches:true,scope:'started-batches-only',passed:false,prototypeVerification,builds,
  recoveryEvaluatorSha256:sha256(await fs.readFile(path.join(project,'scripts/flight-native-lib.mjs'))),
  recoveryStatisticsSha256:sha256(await fs.readFile(path.join(project,'scripts/flight-native-statistics.mjs'))),
  totals:Object.fromEntries(['passed','failed','unsupported','error'].map(s=>[s,builds.filter(b=>b.status===s).length]))};
await writeJSON(path.join(reports,'summary.json'),summary);
console.log(path.relative(project,path.join(reports,'summary.json')));console.log(summary.totals);
