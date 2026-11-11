#!/usr/bin/env node
// node scripts/flight-native-run.mjs [--ids id,id] [--preflight]
// Never changes the installed configuration, source blueprints, or site data.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {sha256, configurationHash, specEntries, prepareSpec, evaluateNative} from './flight-native-lib.mjs';
import {readLoadedEnvironment} from './flight-native-availability.mjs';
import {bindEnvironmentAvailability} from './flight-native-availability-lib.mjs';

const runFile = promisify(execFile);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(project, '.cache/flight-native');
const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const binary = process.env.FACTORIO_BIN || path.join(app, 'Contents/MacOS/factorio');
const data = process.env.FACTORIO_DATA || path.join(app, 'Contents/data');
const modName = 'flight_native_test';
const flags = {};
for (let i=2; i<process.argv.length; i++) {
  const key=process.argv[i];
  if (key==='--preflight') flags.preflight=true;
  else if (['--ids','--specs','--prototype','--mods','--workers','--batch-size','--warmup-ticks','--measurement-ticks','--timeout-ms'].includes(key) && process.argv[i+1]) flags[key.slice(2)]=process.argv[++i];
  else throw new Error('Unknown or incomplete option: '+key);
}
const resolve = file => path.resolve(project,file);
const specsPath=resolve(flags.specs || 'blueprint-sources/flight-factories/native-test-specs.json');
const prototypePath=resolve(flags.prototype || '.cache/flight-game/script-output/data-raw-dump.json');
const sourceMods=resolve(flags.mods || '.cache/flight-game/mods');
const workers=Number(flags.workers || 2), timeout=Number(flags['timeout-ms'] || 1800000);
if (!Number.isInteger(workers) || workers<1 || workers>8 || !Number.isFinite(timeout) || timeout<1000) throw new Error('Invalid worker count or timeout');
const batchSize=Number(flags['batch-size'] || 16);
if(!Number.isInteger(batchSize) || batchSize<1 || batchSize>48) throw new Error('Batch size must be 1..48 (separate forces and surfaces)');
const timingOverrides=Object.fromEntries([['--warmup-ticks','warmupTicks'],['--measurement-ticks','measurementTicks']].filter(([flag])=>flags[flag.slice(2)]!==undefined).map(([flag,key])=>[key,Number(flags[flag.slice(2)])]));
const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
const runRoot=path.join(root,'runs',runId), reports=path.join(root,'reports',runId);
await fs.mkdir(reports,{recursive:true});
await fs.mkdir(runRoot,{recursive:true});
const writeJSON=async(file,value)=>{const temporary=file+'.'+process.pid+'.tmp';await fs.writeFile(temporary,JSON.stringify(value,null,2)+'\n');await fs.rename(temporary,file);};
const info={name:modName,version:'1.0.0',title:'Flight factory native boundary verification',author:'local',factorio_version:'2.0',dependencies:['base = 2.0.77']};
const harnessSource=await fs.readFile(path.join(project,'scripts/flight-native-control.lua'),'utf8');
const implementation={};
for(const name of ['flight-native-lib.mjs','flight-native-statistics.mjs','flight-native-run.mjs','flight-native-availability.mjs','flight-native-availability-lib.mjs']) implementation[name]=sha256(await fs.readFile(path.join(project,'scripts',name)));
implementation['flight-native-control.lua']=sha256(harnessSource);
let summary={schemaVersion:1,runId,createdAt:new Date().toISOString(),mode:flags.preflight?'preflight':'functional-and-steady-state',
  reportsDirectory:path.relative(project,reports),implementation,batchSize,workers,timingOverrides,builds:[]};
let stopScheduling=false;
process.on('SIGUSR1',()=>{stopScheduling=true;console.log('Stopping scheduling after active batches finish.');});
const failures=[];
async function runFactorio(directory,args,label) {
  const command=['--config',path.join(directory,'config.ini'),'--mod-directory',path.join(directory,'mods'),...args];
  try {
    const result=await runFile(binary,command,{cwd:project,timeout,maxBuffer:32*1024*1024});
    const output=result.stdout+result.stderr;
    await fs.writeFile(path.join(directory,label+'.log'),output);
    return output;
  } catch(error) {
    await fs.writeFile(path.join(directory,label+'.log'),String(error.stdout || '')+String(error.stderr || '')+'\n'+error.message);
    throw new Error(`Factorio ${label} failed; see ${path.relative(project,path.join(directory,label+'.log'))}: ${String(error.stdout || error.message).slice(-3000)}`);
  }
}
async function fileFingerprints(directory) {
  const result={};
  async function visit(base,rel='') {
    for(const ent of (await fs.readdir(base,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const next=path.join(base,ent.name), name=path.join(rel,ent.name);
      if(ent.isDirectory()) await visit(next,name);
      else if(ent.isFile() || ent.isSymbolicLink()) result[name]=sha256(await fs.readFile(next));
    }
  }
  await visit(directory);return result;
}
async function setupCase(directory,spec,commonMods) {
  await fs.mkdir(path.join(directory,'mods',modName),{recursive:true});
  for(const name of await fs.readdir(commonMods)) {
    if(name===modName) continue;
    const target=path.join(directory,'mods',name);
    if(['mod-list.json','mod-settings.dat'].includes(name)) await fs.copyFile(path.join(commonMods,name),target);
    else await fs.symlink(path.join(commonMods,name),target);
  }
  const payload=JSON.stringify(spec);let eq='==';while(payload.includes(']'+eq+']'))eq+='=';
  await writeJSON(path.join(directory,'mods',modName,'info.json'),info);
  await fs.writeFile(path.join(directory,'mods',modName,'control.lua'),harnessSource);
  await fs.writeFile(path.join(directory,'mods',modName,'payload.lua'),`return [${eq}[${payload}]${eq}]\n`);
  await fs.writeFile(path.join(directory,'config.ini'),`[path]\nread-data=${data}\nwrite-data=${directory}\n[general]\nlocale=en\n`);
  await writeJSON(path.join(directory,'map-gen-settings.json'),{seed:12345,width:64,height:64,default_enable_all_autoplace_controls:false});
}
async function resourceEvidence(source){
  if(!/^[a-f0-9]{64}$/.test(source.evidenceSha256 || ''))throw new Error('Seeded resource evidence requires an exact SHA-256');
  const declared=resolve(source.evidencePath);
  if(!declared.startsWith(project+path.sep))throw new Error('Resource evidence must be inside the project');
  const candidates=[declared,path.join(project,'flight-map/evidence',source.evidenceSha256+'.json')];
  for(const previous of await fs.readdir(path.join(root,'runs')).catch(()=>[]))candidates.push(path.join(root,'runs',previous,'resource-evidence',source.evidenceSha256+'.json'));
  for(const file of candidates){
    const bytes=await fs.readFile(file).catch(()=>null);
    if(bytes && sha256(bytes)===source.evidenceSha256)return {bytes,sha256:source.evidenceSha256,report:JSON.parse(bytes),declaredPath:source.evidencePath,resolvedFrom:path.relative(project,file)};
  }
  throw new Error('Exact resource evidence not found in live or archived files: '+source.evidenceSha256);
}
try {
  const [specBytes,prototypeBytes]=await Promise.all([fs.readFile(specsPath),fs.readFile(prototypePath)]);
  const document=JSON.parse(specBytes),raw=JSON.parse(prototypeBytes),prototypeDumpSha256=sha256(prototypeBytes);
  let loadedEnvironment;
  try{
    loadedEnvironment=await readLoadedEnvironment();
    const archive=path.join(runRoot,'environment-availability');await fs.mkdir(archive,{recursive:true});
    await fs.writeFile(path.join(archive,'loaded-save-proof.json'),loadedEnvironment.sourceBytes.proof);
    await fs.writeFile(path.join(archive,'map-report.json'),loadedEnvironment.sourceBytes.mapReport);
    summary.environmentAvailabilityProof={proofSha256:loadedEnvironment.proofSha256,mapReportSha256:loadedEnvironment.mapReportSha256,saveSha256:loadedEnvironment.proof.saveSha256};
  }catch(error){summary.environmentAvailabilityError=error.message;}
  await fs.writeFile(path.join(runRoot,'source-specs.json'),specBytes);
  const prototypeCanonicalSha256=configurationHash(raw);
  summary={...summary,specsPath:path.relative(project,specsPath),specsFileSha256:sha256(specBytes),prototypeDumpSha256,prototypeCanonicalSha256};
  let entries=specEntries(document);
  if(flags.ids) {
    const ids=new Set(flags.ids.split(','));
    for(const id of ids) if(!entries.some(e=>e.id===id)) throw new Error('Unknown selected factory id: '+id);
    entries=entries.filter(e=>ids.has(e.id));
  }
  // High-value robot line runs first, then every remaining available specification.
  const priority=id=>id==='item-logistic-robot-intermediary'?0:id==='item-logistic-robot-raw'?1:/robot/i.test(id)?2:3;
  entries.sort((a,b)=>priority(a.id)-priority(b.id));
  if(!entries.length) throw new Error('No native specs available');
  const prepared=[];
  const sourceEvidence={};
  for(const entry of entries) {
    try {
      if(entry.status==='unsupported' || entry.supported===false) throw new Error((entry.reasons || entry.unsupportedReasons || [entry.reason || 'generator-declared-unsupported']).join('; '));
      if(!entry.blueprintPath) throw new Error('blueprintPath is required');
      const code=await fs.readFile(resolve(entry.blueprintPath),'utf8');
      for(const port of entry.inputs || [])for(const source of port.sources || [])if(source.kind==='seeded-resource-extraction' && !sourceEvidence[source.evidenceSha256]){
        const evidence=await resourceEvidence(source);
        const {bytes,...metadata}=evidence;sourceEvidence[source.evidenceSha256]=metadata;
        await fs.mkdir(path.join(runRoot,'resource-evidence'),{recursive:true});
        await fs.writeFile(path.join(runRoot,'resource-evidence',evidence.sha256+'.json'),bytes);
      }
      const spec=prepareSpec({...entry,...timingOverrides},{code,raw,prototypeDumpSha256,sourceEvidence,defaults:Array.isArray(document)?{}:{...document,...document.defaults}});
      spec.sourceSpecSha256=configurationHash(entry);
      if(spec.unsupported.length) {
        const result={id:entry.id,status:'unsupported',passed:false,blueprintSha256:spec.blueprintSha256,prototypeDumpSha256,
          specSha256:spec.specSha256,configurationSha256:spec.configurationSha256,reasons:spec.unsupported};
        summary.builds.push(result);await writeJSON(path.join(reports,entry.id+'.json'),result);
        console.log(`${entry.id}: unsupported (${spec.unsupported.join(', ')})`);
      } else prepared.push(spec);
    } catch(error) {
      const result={id:entry.id,status:'unsupported',passed:false,reasons:[error.message],prototypeDumpSha256};
      summary.builds.push(result);await writeJSON(path.join(reports,entry.id+'.json'),result);
    }
  }
  summary.resourceEvidence=Object.values(sourceEvidence).map(({report,...metadata})=>metadata);
  if(flags.preflight) {
    for(const spec of prepared) summary.builds.push({id:spec.id,status:'ready',passed:false,blueprintSha256:spec.blueprintSha256,
      prototypeDumpSha256,specSha256:spec.specSha256,configurationSha256:spec.configurationSha256,entityCount:spec.entities.length,environmentAvailability:bindEnvironmentAvailability(spec,loadedEnvironment,raw)});
  } else if(prepared.length) {
    // Copy a snapshot, never symlink to the user's installation or flight-map mods.
    const beforeMods=await fileFingerprints(sourceMods);
    const commonMods=path.join(runRoot,'snapshot-mods');
    await fs.cp(sourceMods,commonMods,{recursive:true,dereference:true});
    const copied=await fileFingerprints(commonMods);
    if(configurationHash(beforeMods)!==configurationHash(copied)) throw new Error('Mod files changed while creating isolated snapshot');
    const list=JSON.parse(await fs.readFile(path.join(commonMods,'mod-list.json'),'utf8'));
    if(list.mods.some(m=>m.name===modName)) throw new Error('Source mods already include harness; use original installed snapshot');
    // EV Machines resets every force's technology effects in on_init. Load our
    // control-only test last so its explicit unlock policy survives other mods.
    info.dependencies=['base = 2.0.77',...list.mods.filter(m=>m.enabled && m.name!=='base').map(m=>m.name)];
    list.mods.push({name:modName,enabled:true});
    await writeJSON(path.join(commonMods,'mod-list.json'),list);
    summary.modSnapshot={source:path.relative(project,sourceMods),files:beforeMods,sha256:configurationHash(beforeMods)};
    const verification=path.join(runRoot,'prototype-verification');
    await setupCase(verification,prepared[0],commonMods);
    await runFactorio(verification,['--dump-data'],'dump');
    const runtimeBytes=await fs.readFile(path.join(verification,'script-output/data-raw-dump.json'));
    const runtimeHash=sha256(runtimeBytes),runtimeCanonical=configurationHash(JSON.parse(runtimeBytes));
    summary.prototypeVerification={sourceSha256:prototypeDumpSha256,runtimeSha256:runtimeHash,
      canonicalSha256:runtimeCanonical,exactBytes:runtimeHash===prototypeDumpSha256,matched:runtimeCanonical===prototypeCanonicalSha256};
    if(!summary.prototypeVerification.matched || !summary.prototypeVerification.exactBytes) throw new Error('Installed native prototypes differ from exact planning dump; refusing production evidence');
    await writeJSON(path.join(runRoot,'run-metadata.json'),summary);
    const expectedMods=list.mods.filter(m=>m.enabled).map(m=>m.name).sort();
    let cursor=0;
    async function runBatch(batch,label) {
      const directory=path.join(runRoot,label);
      let processError;
      try {
        await setupCase(directory,{builds:batch},commonMods);
        const save=path.join(directory,'factory.zip');
        const ticks=Math.max(...batch.map(s=>s.warmupTicks+s.measurementTicks));
        console.log(label+': importing '+batch.length+' factories, '+batch.reduce((n,s)=>n+s.entities.length,0)+' entities');
        await runFactorio(directory,['--create',save,'--map-gen-settings',path.join(directory,'map-gen-settings.json')],'create');
        await runFactorio(directory,['--benchmark',save,'--benchmark-ticks',String(ticks+1),'--benchmark-runs','1'],'simulation');
      } catch(error) { processError=error; }
      for(const spec of batch) {
        let native;
        let result={id:spec.id,blueprintSha256:spec.blueprintSha256,prototypeDumpSha256,specSha256:spec.specSha256,
          sourceSpecSha256:spec.sourceSpecSha256,
          configurationSha256:spec.configurationSha256,configuration:JSON.parse(JSON.stringify({...spec,code:undefined,entities:undefined,entityTypes:undefined,unsupported:undefined})),
          prototypeVerification:summary.prototypeVerification,modSnapshotSha256:summary.modSnapshot.sha256,runId,implementation,nativeControlSha256:implementation['flight-native-control.lua'],
          environmentAvailability:bindEnvironmentAvailability(spec,loadedEnvironment,raw),
          runDirectory:path.relative(project,directory)};
        try {
          native=JSON.parse(await fs.readFile(path.join(directory,'script-output','flight-native-'+spec.id+'.json'),'utf8'));
          if(native.error) throw new Error(`Native ${native.phase}: ${native.error}`);
          if(processError) throw processError;
          if(native.gameVersion!=='2.0.77') throw new Error('Native Factorio version mismatch');
          if(JSON.stringify(Object.keys(native.activeMods).sort())!==JSON.stringify(expectedMods)) throw new Error('Native active mod list differs from snapshot');
          result={...result,...evaluateNative(spec,native),native};
        } catch(error) { result={...result,status:Object.values(native?.invalidBlueprintEntities || {}).length?'failed':'error',passed:false,functionalPassed:false,throughputPassed:false,
          reasons:[processError?.message || error.message],...(native?{native}: {})}; }
        summary.builds.push(result);
        await writeJSON(path.join(reports,spec.id+'.json'),result);
        console.log(spec.id+': '+result.status+' '+JSON.stringify(Object.fromEntries(Object.entries(result.outputs || {}).map(([k,v])=>[k,v.perMinute]))));
      }
    }
    // First native robot result is available before the bounded batch queue.
    let start=0;
    if(/robot/i.test(prepared[0].id)){await runBatch([prepared[0]],'priority');start=1;}
    const batches=[];
    for(let i=start;i<prepared.length;i+=batchSize)batches.push(prepared.slice(i,i+batchSize));
    async function worker(){while(cursor<batches.length){
      if(stopScheduling || await fs.stat(path.join(runRoot,'STOP_AFTER_BATCHES')).then(()=>true,()=>false)){stopScheduling=true;return;}
      const index=cursor++;await runBatch(batches[index],'batch-'+String(index+1).padStart(4,'0'));
    }}
    await Promise.all(Array.from({length:Math.min(workers,batches.length)},()=>worker()));
    if(stopScheduling){summary.stoppedAfterActiveBatches=true;summary.pending=prepared.filter(s=>!summary.builds.some(r=>r.id===s.id)).map(s=>({id:s.id,blueprintSha256:s.blueprintSha256}));failures.push('stopped-with-pending-factories');}
    const afterMods=await fileFingerprints(sourceMods);
    summary.sourceModsPreserved=configurationHash(afterMods)===configurationHash(beforeMods);
    if(!summary.sourceModsPreserved) failures.push('source-mods-changed-during-run');
    summary.sourcePrototypePreserved=sha256(await fs.readFile(prototypePath))===prototypeDumpSha256;
    if(!summary.sourcePrototypePreserved) failures.push('source-prototype-changed-during-run');
  }
} catch(error) { failures.push(error.message);console.error(error.message); }
summary.completedAt=new Date().toISOString();summary.errors=failures;
summary.totals=Object.fromEntries(['passed','failed','unsupported','error','ready'].map(status=>[status,summary.builds.filter(b=>b.status===status).length]));
summary.passed=!flags.preflight && failures.length===0 && summary.builds.length>0 && summary.builds.every(b=>b.passed);
await writeJSON(path.join(reports,'summary.json'),summary);
await writeJSON(path.join(root,'reports','latest.json'),summary);
console.log('Native report: '+path.relative(project,path.join(reports,'summary.json')));
console.log(JSON.stringify(summary.totals));
process.exitCode=flags.preflight ? (failures.length || summary.totals.unsupported ? 1:0) : summary.passed?0:1;
