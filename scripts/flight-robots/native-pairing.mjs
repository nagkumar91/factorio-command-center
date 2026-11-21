#!/usr/bin/env node
// Native read-all belt snapshot and underground pairing audit for one exact
// robot-workshop string. Runs headless in a private profile copy under .cache.
//   node scripts/flight-robots/native-pairing.mjs <blueprint.txt> <manifest.json> <output.json> [optimizer-report.json]
// With an optimizer report, every planned pair must form natively (expectedPairsChecked).
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../blueprints.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const here=path.dirname(fileURLToPath(import.meta.url)),project=path.resolve(here,'../..');
const [blueprintPath,manifestPath,outputPath,optimizerPath]=process.argv.slice(2);
if(!blueprintPath||!manifestPath||!outputPath)throw Error('usage: native-pairing.mjs <blueprint.txt> <manifest.json> <output.json> [optimizer-report.json]');
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const binary=path.join(app,'Contents/MacOS/factorio');
const profile=process.env.FACTORIO_PROFILE||path.join(project,'.cache/flight-21');
const code=(await fs.readFile(blueprintPath,'utf8')).trim(),blueprintSha256=sha(code);
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const entry=manifest.find(m=>m.blueprintSha256===blueprintSha256)||manifest[0];
const readerSeeds=[...new Set((entry.loopControl||[]).map(l=>l.reader))].sort((a,b)=>a-b);
if(!readerSeeds.length)throw Error('manifest has no loop reader');
let expectedPairs=[];
if(optimizerPath){
 const optimizer=JSON.parse(await fs.readFile(optimizerPath,'utf8'));
 if(optimizer.candidateBlueprintSha256!==blueprintSha256)throw Error('optimizer report is for a different candidate');
 expectedPairs=optimizer.pairs.map(p=>({inputEntityNumber:p.inputEntityNumber,outputEntityNumber:p.outputEntityNumber}));
}
const entityCount=decodeBlueprint(code).blueprint.entities.length;
const root=path.join(project,'.cache/flight-robots/pairing',Date.now().toString());
await fs.mkdir(root,{recursive:true});await fs.cp(path.join(profile,'mods'),path.join(root,'mods'),{recursive:true});
const mod=path.join(root,'mods/robot_pairing_audit');await fs.mkdir(mod);
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'robot_pairing_audit',version:'1.0.0',title:'Private robot belt audit',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24']}));
const list=JSON.parse(await fs.readFile(path.join(root,'mods/mod-list.json')));list.mods.push({name:'robot_pairing_audit',enabled:true});await fs.writeFile(path.join(root,'mods/mod-list.json'),JSON.stringify(list));
await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify({builds:[{id:entry.id,code,entityCount,readerSeeds,expectedPairs}]})+']====]');
await fs.copyFile(path.join(here,'pairing-control.lua'),path.join(mod,'control.lua'));
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(path.join(root,'map.json'),JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function factorio(args,log){try{const r=await run(binary,['--config',path.join(root,'config.ini'),'--mod-directory',path.join(root,'mods'),...args],{timeout:600000,maxBuffer:8e6});await fs.writeFile(path.join(root,log),r.stdout+r.stderr);}catch(e){await fs.writeFile(path.join(root,log),(e.stdout||'')+(e.stderr||''));throw Error('Factorio failed: '+path.join(root,log)+'\n'+(e.stdout||'').slice(-2500));}}
await factorio(['--create',path.join(root,'test.zip'),'--map-gen-settings',path.join(root,'map.json')],'create.log');
await factorio(['--benchmark',path.join(root,'test.zip'),'--benchmark-ticks','3','--benchmark-runs','1'],'benchmark.log');
const [native]=JSON.parse(await fs.readFile(path.join(root,'script-output/pairing.json'),'utf8')).builds;
const asObject=v=>Array.isArray(v)?Object.fromEntries(v.map(k=>[k,true])):v||{};
const report={schemaVersion:1,gameVersion:'2.1.24',blueprintSha256,readerSeeds:native.readerSeeds,components:native.components,nativeReadAllBeltComponentEntityNumbers:native.nativeReadAllBeltComponentEntityNumbers,undergroundInputPairs:native.undergroundInputPairs||[],unpairedUndergroundInputs:asObject(native.unpairedUndergroundInputs),expectedPairsChecked:native.expectedPairsChecked,passed:native.passed,prototypeSha256:sha(await fs.readFile(path.join(profile,'script-output/data-raw-dump.json'))),harnessSha256:sha(await fs.readFile(path.join(here,'pairing-control.lua'))),createdAt:new Date().toISOString()};
await fs.mkdir(path.dirname(path.resolve(outputPath)),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
if(process.env.KEEP_RUN!=='1')await fs.rm(root,{recursive:true,force:true});
console.log(JSON.stringify({output:outputPath,blueprintSha256,passed:report.passed,pairs:report.undergroundInputPairs.length,expectedPairsChecked:report.expectedPairsChecked,readAllEntities:report.nativeReadAllBeltComponentEntityNumbers.length}));
process.exitCode=report.passed?0:1;
