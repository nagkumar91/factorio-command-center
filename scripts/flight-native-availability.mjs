#!/usr/bin/env node
// Separate immutable bindings: neither original reports nor their rankings,
// observations, specifications or native/configuration fingerprints are edited.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {sha256,canonicalJSON} from './flight-native-lib.mjs';
import {availabilityPolicyId,validateLoadedMapEvidence,bindEnvironmentAvailability} from './flight-native-availability-lib.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export async function readLoadedEnvironment({projectRoot=project,proofPath='flight-map/native-loaded-save-report.json',mapReportPath='flight-map/native-report.json',savePath}={}){
  const [proofBytes,mapBytes,controlBytes]=await Promise.all([fs.readFile(path.resolve(projectRoot,proofPath)),fs.readFile(path.resolve(projectRoot,mapReportPath)),fs.readFile(path.join(projectRoot,'flight-map/control.lua'))]);
  const proof=JSON.parse(proofBytes),mapReport=JSON.parse(mapBytes);
  if(!savePath && (!mapReport.installedSaveName || path.basename(mapReport.installedSaveName)!==mapReport.installedSaveName))throw new Error('Map report must identify one installed save basename');
  const saved=savePath?path.resolve(projectRoot,savePath):path.join(os.homedir(),'Library/Application Support/factorio/saves',mapReport.installedSaveName);
  const evidence={proof,mapReport,proofPath,mapReportPath,proofSha256:sha256(proofBytes),mapReportSha256:sha256(mapBytes),
    actualSaveSha256:sha256(await fs.readFile(saved)),actualControlSha256:sha256(controlBytes),sourceBytes:{proof:proofBytes,mapReport:mapBytes}};
  const validation=validateLoadedMapEvidence(evidence,proof.prototypeSha256);
  if(!validation.passed)throw new Error('Loaded map evidence failed: '+validation.reasons.join(', '));
  return evidence;
}

async function main(){
  const flags={};for(let i=2;i<process.argv.length;i+=2){const name=process.argv[i];if(!['--reports','--proof','--map-report','--save'].includes(name)||!process.argv[i+1])throw new Error('Usage: flight-native-availability.mjs [--reports DIRECTORY] [--proof FILE] [--map-report FILE] [--save FILE]');flags[name]=process.argv[i+1];}
  const evidence=await readLoadedEnvironment({proofPath:flags['--proof'],mapReportPath:flags['--map-report'],savePath:flags['--save']});
  const rawBytes=await fs.readFile(path.join(project,'.cache/flight-game/script-output/data-raw-dump.json')),raw=JSON.parse(rawBytes);
  if(sha256(rawBytes)!==evidence.proof.prototypeSha256)throw new Error('Current installed prototype dump does not match loaded map');
  const sourceRoot=path.resolve(project,flags['--reports'] || '.cache/flight-native/reports'),bindings=[];
  async function visit(directory){
    for(const ent of await fs.readdir(directory,{withFileTypes:true})){
      const file=path.join(directory,ent.name);if(ent.isDirectory()){await visit(file);continue;}
      if(!ent.isFile() || !ent.name.endsWith('.json') || ['summary.json','latest.json'].includes(ent.name))continue;
      const bytes=await fs.readFile(file),report=JSON.parse(bytes);if(!report.id || !report.configuration || !report.blueprintSha256 || !report.runDirectory)continue;
      const environmentAvailability=bindEnvironmentAvailability(report.configuration,evidence,raw);
      let nativeReportSha256;
      let nativePath=path.resolve(project,report.runDirectory,'script-output','flight-native-'+report.id+'.json');
      if(!nativePath.startsWith(path.join(project,'.cache/flight-native/runs')+path.sep))throw new Error('Native archive escaped private run directory');
      let nativeBytes=await fs.readFile(nativePath).catch(()=>null);
      // The initial single-factory harness used this fixed filename. Only an
      // exact match to the immutable report's native object can bind it.
      if(!nativeBytes){nativePath=path.join(path.dirname(nativePath),'flight-native-result.json');nativeBytes=await fs.readFile(nativePath).catch(()=>null);}
      if(report.native){
        if(!nativeBytes || canonicalJSON(JSON.parse(nativeBytes))!==canonicalJSON(report.native))throw new Error('Native report archive changed: '+file);
        nativeReportSha256=sha256(nativeBytes);
      }
      bindings.push({id:report.id,originalRunId:report.runId,originalReportPath:path.relative(project,file),originalReportSha256:sha256(bytes),nativeReportSha256,
        blueprintSha256:report.blueprintSha256,prototypeDumpSha256:report.prototypeDumpSha256,specSha256:report.specSha256,configurationSha256:report.configurationSha256,environmentAvailability});
    }
  }
  await visit(sourceRoot);
  const id='loaded-map-'+Date.now(),directory=path.join(project,'.cache/flight-native/availability',id);await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(path.join(directory,'loaded-save-proof.json'),evidence.sourceBytes.proof);
  await fs.writeFile(path.join(directory,'map-report.json'),evidence.sourceBytes.mapReport);
  const artifact={schemaVersion:1,policyId:availabilityPolicyId,createdAt:new Date().toISOString(),proofSha256:evidence.proofSha256,mapReportSha256:evidence.mapReportSha256,
    implementation:{revalidator:sha256(await fs.readFile(fileURLToPath(import.meta.url))),validator:sha256(await fs.readFile(path.join(project,'scripts/flight-native-availability-lib.mjs')))},
    unchanged:'All original native reports, counts, durations, blueprint hashes and spec/configuration fingerprints remain untouched. This binding only revalidates the explicitly declared resource supply against the corrected loaded save.',
    totals:Object.fromEntries(['verified-after-supersession','verified-loaded-map','not-required-by-declared-boundaries','unverified'].map(s=>[s,bindings.filter(b=>b.environmentAvailability.status===s).length])),bindings};
  const manifest=path.join(directory,'bindings.json');await fs.writeFile(manifest,JSON.stringify(artifact,null,2)+'\n');
  console.log(path.relative(project,manifest));console.log(artifact.totals);
  if(artifact.totals.unverified)process.exitCode=1;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
