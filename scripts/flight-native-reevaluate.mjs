#!/usr/bin/env node
// Apply an explicitly versioned analysis policy to immutable native observations.
// This does not run Factorio, change configs, or replace the original reports.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,canonicalJSON,configurationHash,evaluateNative} from './flight-native-lib.mjs';
import {stochasticPolicyId,stochasticDependencyAudit} from './flight-native-statistics.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [originalRunId,...args]=process.argv.slice(2);
if(!originalRunId || !/^[a-zA-Z0-9_-]+$/.test(originalRunId))throw new Error('Usage: node scripts/flight-native-reevaluate.mjs RUN_ID [--ids id,id]');
const selected=args.length?new Set(args[0]==='--ids' && args[1]?args[1].split(','):[]):null;
if(selected && (!selected.size || args.length!==2))throw new Error('Only --ids id,id is supported');
const root=path.join(project,'.cache/flight-native'),runRoot=path.join(root,'runs',originalRunId),originalReports=path.join(root,'reports',originalRunId);
const metadata=JSON.parse(await fs.readFile(path.join(runRoot,'run-metadata.json')));
const rawBytes=await fs.readFile(path.join(runRoot,'prototype-verification/script-output/data-raw-dump.json')),raw=JSON.parse(rawBytes);
if(!metadata.prototypeVerification?.matched || !metadata.prototypeVerification.exactBytes || sha256(rawBytes)!==metadata.prototypeVerification.runtimeSha256 || configurationHash(raw)!==metadata.prototypeVerification.canonicalSha256)throw new Error('Archived prototype verification mismatch');
const expectedMods=JSON.parse(await fs.readFile(path.join(runRoot,'snapshot-mods/mod-list.json'))).mods.filter(m=>m.enabled).map(m=>m.name).sort();
const evaluation={policyId:stochasticPolicyId,originalRunId,
  evaluatorSha256:sha256(await fs.readFile(path.join(project,'scripts/flight-native-lib.mjs'))),
  statisticsSha256:sha256(await fs.readFile(path.join(project,'scripts/flight-native-statistics.mjs'))),
  reevaluatorSha256:sha256(await fs.readFile(fileURLToPath(import.meta.url))),
  scope:'Reanalysis of identical recorded native observations; no new simulation and no changed input/configuration fingerprints.'};
const runId=originalRunId+'-reevaluated-'+Date.now(),reports=path.join(root,'reports',runId),builds=[];
const writeJSON=(file,value)=>fs.writeFile(file,JSON.stringify(value,null,2)+'\n');
for(const directory of (await fs.readdir(runRoot)).filter(n=>n==='priority' || n.startsWith('batch-')).sort()){
  const base=path.join(runRoot,directory),mod=path.join(base,'mods/flight_native_test');
  const payload=await fs.readFile(path.join(mod,'payload.lua'),'utf8'),match=/^return \[(=*)\[([\s\S]*)\]\1\]\s*$/.exec(payload);
  if(!match)throw new Error('Malformed archived payload '+directory);
  const parsed=JSON.parse(match[2]),specs=parsed.builds || [parsed];
  const controlSha256=sha256(await fs.readFile(path.join(mod,'control.lua')));
  if(controlSha256!==metadata.implementation['flight-native-control.lua'])throw new Error('Archived control differs from run fingerprint');
  for(const spec of specs){
    if(selected?!selected.has(spec.id):spec.stochastic!==true)continue;
    selected?.delete(spec.id);
    const bytes=await fs.readFile(path.join(originalReports,spec.id+'.json')),original=JSON.parse(bytes);
    const nativeBytes=await fs.readFile(path.join(base,'script-output','flight-native-'+spec.id+'.json')),native=JSON.parse(nativeBytes);
    if(sha256(spec.code)!==spec.blueprintSha256 || spec.prototypeDumpSha256!==metadata.prototypeVerification.sourceSha256)throw new Error('Archived source mismatch '+spec.id);
    if(original.native && canonicalJSON(native)!==canonicalJSON(original.native))throw new Error('Original report differs from archived native measurements '+spec.id);
    if(!original.native && original.status!=='error')throw new Error('Original evaluated report lacks native measurements '+spec.id);
    for(const key of ['blueprintSha256','prototypeDumpSha256','configurationSha256','specSha256'])if(original[key]!==spec[key] || native[key]!==spec[key])throw new Error('Original fingerprint mismatch '+spec.id+':'+key);
    const audit=stochasticDependencyAudit(spec,raw);
    const provenance={...evaluation,originalReportSha256:sha256(bytes),nativeReportSha256:sha256(nativeBytes),nativeControlSha256:controlSha256,stochasticDependencyAudit:audit};
    let result={...original,runId,originalRunId,evaluation:provenance,reevaluatedAt:new Date().toISOString()};
    if(native.error || original.status==='error' || original.reasons?.length){result.evaluation={...provenance,evaluated:false,reason:'Original native or process error preserved'};}
    else{
      if(native.gameVersion!=='2.0.77' || canonicalJSON(Object.keys(native.activeMods).sort())!==canonicalJSON(expectedMods))throw new Error('Native game/mod mismatch '+spec.id);
      result={...result,...evaluateNative(spec,native,{stochasticDependencyAudit:audit})};
      result.evaluation.evaluated=true;
    }
    builds.push(result);
    console.log(spec.id+': '+original.status+' -> '+result.status+' '+JSON.stringify(Object.fromEntries(Object.entries(result.outputs || {}).filter(([,o])=>o.required).map(([k,o])=>[k,{rate:o.perMinute,p:o.stabilityTest?.pValue,failures:result.failures}]))));
  }
}
if(selected?.size)throw new Error('Selected ids not present in archived batches: '+[...selected]);
await fs.mkdir(reports,{recursive:true});
for(const result of builds)await writeJSON(path.join(reports,result.id+'.json'),result);
const summary={schemaVersion:1,runId,originalRunId,createdAt:new Date().toISOString(),mode:'archived-native-reevaluation',evaluation,builds,
  prototypeVerification:metadata.prototypeVerification,implementation:metadata.implementation,
  totals:Object.fromEntries(['passed','failed','unsupported','error'].map(s=>[s,builds.filter(b=>b.status===s).length]))};
await writeJSON(path.join(reports,'summary.json'),summary);
console.log(path.relative(project,path.join(reports,'summary.json')));console.log(summary.totals);
