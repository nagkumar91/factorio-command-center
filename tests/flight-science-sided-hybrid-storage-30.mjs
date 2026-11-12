import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const project=path.resolve(new URL('..',import.meta.url).pathname);
const source=path.resolve(process.env.SCIENCE_SOURCE||path.join(project,'blueprint-sources/flight-science-sided/hybrid'));
const privateFolder=path.join(project,'scripts/flight-science-sided/hybrid/.cache/storage-30');
const expectedHash=process.env.EXPECTED_BLUEPRINT_SHA256||'ac9fca587c69eebf93c587406f9dd02df4b0dd124352cdce66c5a2b6f650cb3c';if(!/^[0-9a-f]{64}$/.test(expectedHash||''))throw Error('Explicit expected candidate hash required');
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const binary=path.join(app,'Contents/MacOS/factorio');
const profile=process.env.FACTORIO_PROFILE||path.join(project,'.cache/flight-21');
const raw=JSON.parse(await fs.readFile(path.join(profile,'script-output/data-raw-dump.json')));
async function protectSnapshot(){
 const files=[];
 async function walk(relative){for(const entry of (await fs.readdir(path.join(project,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.name==='.cache')continue;const next=path.join(relative,entry.name);if(entry.isDirectory())await walk(next);else files.push(next);}}
 for(const folder of ['scripts/flight-science-sided/hybrid','blueprint-sources/flight-science-sided/hybrid','site/flight-science-sided/hybrid'])await walk(folder);
 for(const file of (await fs.readdir(path.join(project,'tests'))).filter(name=>name.startsWith('flight-science-sided-hybrid')).sort())files.push('tests/'+file);
 const entries=[];for(const file of files.sort())entries.push([file,sha(await fs.readFile(path.join(project,file)))]);
 return Object.fromEntries(entries);
}
const protectedBefore=await protectSnapshot();

const short=false,warmup=3600*15,measure=3600*30;
const recovery={pauseTicks:108000,settleTicks:7200,measureTicks:10800};
const recoveryTicks=recovery?recovery.pauseTicks+recovery.settleTicks+recovery.measureTicks:0;
const root=path.join(privateFolder,'runs',Date.now().toString());
await fs.mkdir(root,{recursive:true});await fs.cp(path.join(profile,'mods'),path.join(root,'mods'),{recursive:true});
const mod=path.join(root,'mods/flight_science_test');await fs.mkdir(mod);
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'flight_science_test',version:'1.0.0',title:'Private flight science validation',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24']}));
const list=JSON.parse(await fs.readFile(path.join(root,'mods/mod-list.json')));list.mods.push({name:'flight_science_test',enabled:true});await fs.writeFile(path.join(root,'mods/mod-list.json'),JSON.stringify(list));
const builds=JSON.parse(await fs.readFile(path.join(source,'manifest.json'))).filter(b=>!process.env.SCIENCE_IDS||process.env.SCIENCE_IDS.split(',').includes(b.id));
for(const b of builds){const code=(await fs.readFile(path.join(source,b.file),'utf8')).trim();if(sha(code)!==b.blueprintSha256||b.blueprintSha256!==expectedHash)throw Error('Frozen blueprint hash mismatch');b.code=code;b.entities=decodeBlueprint(code).blueprint.entities;b.recipeOutputs=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].results]));}
await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify({builds,warmup,measure,recovery})+']====]');
await fs.copyFile(path.join(project,'tests/flight-science-sided-hybrid-storage-30-control.lua'),path.join(mod,'control.lua'));
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(path.join(root,'map.json'),JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function factorio(args,log){try{const r=await run(binary,['--config',path.join(root,'config.ini'),'--mod-directory',path.join(root,'mods'),...args],{timeout:900000,maxBuffer:8e6});await fs.writeFile(path.join(root,log),r.stdout+r.stderr);}catch(e){await fs.writeFile(path.join(root,log),(e.stdout||'')+(e.stderr||''));throw Error('Factorio failed: '+path.join(root,log)+'\n'+(e.stdout||'').slice(-2500));}}
console.log('Private native test:',root);
await factorio(['--create',path.join(root,'test.zip'),'--map-gen-settings',path.join(root,'map.json')],'create.log');
await factorio(['--benchmark',path.join(root,'test.zip'),'--benchmark-ticks',String(warmup+measure+recoveryTicks+1),'--benchmark-runs','1'],'benchmark.log');
const result=JSON.parse(await fs.readFile(path.join(root,'script-output/result.json')));
result.gameVersion='2.1.24';result.short=short;result.warmupMinutes=warmup/3600;result.measurementMinutes=measure/3600;result.prototypeSha256=sha(await fs.readFile(path.join(profile,'script-output/data-raw-dump.json')));result.harnessSha256=sha(await fs.readFile(path.join(mod,'control.lua')));result.modList=list;result.createdAt=new Date().toISOString();
for(const b of result.builds){b.blueprintSha256=builds.find(m=>m.id===b.id).blueprintSha256; b.passed=builds.find(m=>m.id===b.id).products.every(n=>(b.outputsPerMinute[n]||0)>=(builds.find(m=>m.id===b.id).targetPerMinute||60)-.5)&&b.machines.every(m=>m.measuredCrafts>0)&&b.powered&&b.inputs.every(p=>p.productiveRoute?.length&&p.acceptedDuringMeasurement>0)&&b.outputPorts.every(p=>p.collectedDuringMeasurement>0)&&(!recovery||Object.values(b.recovery.outputsPerMinute).every(n=>n>=(builds.find(m=>m.id===b.id).targetPerMinute||60)-.5));}
for(const b of result.builds){b.baselineAndRecoveryPassed=b.passed;b.stressPassed=!!(b.stress?.allChestsFullForFinalWindow&&b.stress?.allScienceProductionZero&&b.stress?.allScienceMachineCraftsZero&&b.stress?.chests.length===6&&b.stress.chests.every(c=>c.fullAtPauseEnd&&c.finalWindowSamples===121&&c.fullSamples===121&&c.finalAccessibleCount===c.accessibleCapacity));b.recoveryCraftedPassed=builds.find(m=>m.id===b.id).products.every(item=>(b.recoveryCrafted?.craftedPerMinute[item]||0)>=60);b.productionStatisticsAgree=b.recoveryCrafted?.productionStatisticsAgree===true;b.passed=b.passed&&b.stressPassed&&b.recoveryCraftedPassed&&b.productionStatisticsAgree;}
result.privateStress={label:'30-minute actual backpressure stress on frozen hybrid',pauseMinutes:30,settlingMinutes:2,recoveryMeasurementMinutes:3,finalPauseObservationMinutes:2,runnerSha256:sha(await fs.readFile(new URL(import.meta.url))),qualifiedReportSha256:protectedBefore['blueprint-sources/flight-science-sided/hybrid/native-report.json']};
const protectedAfter=await protectSnapshot();
result.protectedArtifactsUnchanged=JSON.stringify(protectedBefore)===JSON.stringify(protectedAfter);
await fs.writeFile(path.join(root,'protected-hashes-before.json'),JSON.stringify(protectedBefore,null,2)+'\n');
await fs.writeFile(path.join(root,'protected-hashes-after.json'),JSON.stringify(protectedAfter,null,2)+'\n');
result.passed=result.builds.every(b=>b.passed)&&result.protectedArtifactsUnchanged;
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(result,null,2)+'\n');

console.log(JSON.stringify({report:path.join(root,'report.json'),passed:result.passed,protectedArtifactsUnchanged:result.protectedArtifactsUnchanged,harnessSha256:result.harnessSha256,builds:result.builds.map(b=>({id:b.id,passed:b.passed,baselineAndRecoveryPassed:b.baselineAndRecoveryPassed,stressPassed:b.stressPassed,outputs:b.outputsPerMinute,recovery:b.recovery,recoveryCraftedPassed:b.recoveryCraftedPassed,craftedPerMinute:b.recoveryCrafted?.craftedPerMinute,stress:{allChestsFullForFinalWindow:b.stress.allChestsFullForFinalWindow,allScienceProductionZero:b.stress.allScienceProductionZero,allScienceMachineCraftsZero:b.stress.allScienceMachineCraftsZero,chests:b.stress.chests}}))},null,2));
process.exitCode=result.passed?0:1;
