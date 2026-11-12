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
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const binary=path.join(app,'Contents/MacOS/factorio');
const profile=process.env.FACTORIO_PROFILE||path.join(project,'.cache/flight-21');
const raw=JSON.parse(await fs.readFile(path.join(profile,'script-output/data-raw-dump.json')));
const short=process.env.SHORT==='1',warmup=short?3600*2:3600*15,measure=short?3600*3:3600*30;
const recovery=process.env.RECOVERY==='1'?{pauseTicks:18000,settleTicks:7200,measureTicks:10800}:null;
const recoveryTicks=recovery?recovery.pauseTicks+recovery.settleTicks+recovery.measureTicks:0;
const root=path.join(project,'scripts/flight-science-sided/hybrid/.cache/native',Date.now().toString());
await fs.mkdir(root,{recursive:true});await fs.cp(path.join(profile,'mods'),path.join(root,'mods'),{recursive:true});
const mod=path.join(root,'mods/flight_science_test');await fs.mkdir(mod);
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'flight_science_test',version:'1.0.0',title:'Private flight science validation',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24']}));
const list=JSON.parse(await fs.readFile(path.join(root,'mods/mod-list.json')));list.mods.push({name:'flight_science_test',enabled:true});await fs.writeFile(path.join(root,'mods/mod-list.json'),JSON.stringify(list));
const builds=JSON.parse(await fs.readFile(path.join(source,'manifest.json'))).filter(b=>!process.env.SCIENCE_IDS||process.env.SCIENCE_IDS.split(',').includes(b.id));
for(const b of builds){const code=(await fs.readFile(path.join(source,b.file),'utf8')).trim();if(sha(code)!==b.blueprintSha256)throw Error('Hash mismatch');b.code=code;b.entities=decodeBlueprint(code).blueprint.entities;b.recipeOutputs=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].results]));}
await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify({builds,warmup,measure,recovery})+']====]');
await fs.copyFile(path.join(project,'tests/flight-science-sided-hybrid-control.lua'),path.join(mod,'control.lua'));
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(path.join(root,'map.json'),JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function factorio(args,log){try{const r=await run(binary,['--config',path.join(root,'config.ini'),'--mod-directory',path.join(root,'mods'),...args],{timeout:900000,maxBuffer:8e6});await fs.writeFile(path.join(root,log),r.stdout+r.stderr);}catch(e){await fs.writeFile(path.join(root,log),(e.stdout||'')+(e.stderr||''));throw Error('Factorio failed: '+path.join(root,log)+'\n'+(e.stdout||'').slice(-2500));}}
console.log('Private native test:',root);
await factorio(['--create',path.join(root,'test.zip'),'--map-gen-settings',path.join(root,'map.json')],'create.log');
await factorio(['--benchmark',path.join(root,'test.zip'),'--benchmark-ticks',String(warmup+measure+recoveryTicks+1),'--benchmark-runs','1'],'benchmark.log');
const result=JSON.parse(await fs.readFile(path.join(root,'script-output/result.json')));
result.gameVersion='2.1.24';result.short=short;result.warmupMinutes=warmup/3600;result.measurementMinutes=measure/3600;result.prototypeSha256=sha(await fs.readFile(path.join(profile,'script-output/data-raw-dump.json')));result.harnessSha256=sha(await fs.readFile(path.join(mod,'control.lua')));result.modList=list;result.createdAt=new Date().toISOString();
for(const b of result.builds){b.blueprintSha256=builds.find(m=>m.id===b.id).blueprintSha256; b.passed=builds.find(m=>m.id===b.id).products.every(n=>(b.outputsPerMinute[n]||0)>=(builds.find(m=>m.id===b.id).targetPerMinute||60)-.5)&&b.machines.every(m=>m.measuredCrafts>0)&&b.powered&&b.inputs.every(p=>p.productiveRoute?.length&&p.acceptedDuringMeasurement>0)&&b.outputPorts.every(p=>p.collectedDuringMeasurement>0)&&(!recovery||Object.values(b.recovery.outputsPerMinute).every(n=>n>=(builds.find(m=>m.id===b.id).targetPerMinute||60)-.5));}
result.passed=result.builds.every(b=>b.passed);
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(result,null,2)+'\n');
if(!short){
 await fs.writeFile(path.join(source,'native-report.json'),JSON.stringify(result,null,2)+'\n');
 const manifests=JSON.parse(await fs.readFile(path.join(source,'manifest.json')));
 for(const m of manifests){const evidence=result.builds.find(b=>b.id===m.id&&b.blueprintSha256===m.blueprintSha256);if(evidence?.passed){m.status='native-production-verified';m.measuredOutputsPerMinute=evidence.outputsPerMinute;}else{m.status='awaiting-native-validation';delete m.measuredOutputsPerMinute;}}
 await fs.writeFile(path.join(source,'manifest.json'),JSON.stringify(manifests,null,2)+'\n');
}

console.log(JSON.stringify({report:path.join(root,'report.json'),passed:result.passed,builds:result.builds.map(b=>({id:b.id,passed:b.passed,outputs:b.outputsPerMinute,idle:b.machines.filter(m=>m.measuredCrafts===0)}))},null,2));
process.exitCode=result.passed?0:1;
