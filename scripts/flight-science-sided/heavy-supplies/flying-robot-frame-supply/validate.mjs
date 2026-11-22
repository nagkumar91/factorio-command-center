// Private headless native qualification of the flying-robot-frame supply (family supply protocol: 15 min warm-up,
// 30 min measured window, 5 min blocked collection, 2 min settling, 3 min recovery window) with a metered feed:
// every inlet gets exactly its panel figure (scale 1) and, on a second surface, 80% of it (scale 0.8).
// Usage: node .../validate.mjs [--source dir ...] [--write]   (SHORT=1 for a quick screen; never written)
// Uses a copy of the family's flight-21 mod profile (FACTORIO_PROFILE, default .cache/flight-21) in a private
// --config/--mod-directory under .cache/heavy-supplies; never the live game data.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../../../blueprints.mjs';
import {PRODUCT} from './layout.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const project=path.resolve(new URL('../../../..',import.meta.url).pathname);
const here=path.dirname(new URL(import.meta.url).pathname);
const args=process.argv.slice(2);
const sources=args.flatMap((a,i)=>a==='--source'?[path.resolve(args[i+1])]:[]);
if(!sources.length)sources.push(path.join(project,'blueprint-sources/flight-science-sided/heavy-supplies/flying-robot-frame-supply'));
const write=args.includes('--write');
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const binary=path.join(app,'Contents/MacOS/factorio');
const profile=process.env.FACTORIO_PROFILE||path.join(project,'.cache/flight-21');
const dumpBytes=await fs.readFile(path.join(profile,'script-output/data-raw-dump.json'));
const short=process.env.SHORT==='1',warmup=short?3600*3:3600*15,measure=short?3600*5:3600*30;
const recovery={pauseTicks:18000,settleTicks:7200,measureTicks:10800};
const scales=[1,.8];
const runRoot=path.join(project,'.cache/heavy-supplies/frame-native',Date.now().toString());
await fs.mkdir(runRoot,{recursive:true});
await fs.cp(path.join(profile,'mods'),path.join(runRoot,'mods'),{recursive:true});
const modName='frame_supply_test',mod=path.join(runRoot,'mods',modName);await fs.mkdir(mod);
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:modName,version:'1.0.0',title:'Private frame supply validation',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24']}));
const list=JSON.parse(await fs.readFile(path.join(runRoot,'mods/mod-list.json')));list.mods.push({name:modName,enabled:true});await fs.writeFile(path.join(runRoot,'mods/mod-list.json'),JSON.stringify(list));
const builds=[],records=[];
for(const source of sources){
 for(const m of JSON.parse(await fs.readFile(path.join(source,'manifest.json')))){
  const code=(await fs.readFile(path.join(source,m.file),'utf8')).trim();if(sha(code)!==m.blueprintSha256)throw Error('Hash mismatch '+source);
  const entities=decodeBlueprint(code).blueprint.entities;records.push({source,m,entities});
  for(const feedScale of scales)builds.push({id:m.id,variant:m.variant,feedScale,blueprintSha256:m.blueprintSha256,code,entities,footprint:m.footprint,
   power:m.ports.find(p=>p.kind==='power').entity,inputs:m.inputs,fluids:m.fluids.map(f=>({item:f.fluid,entity:f.entity,perMinute:f.perMinute})),outputs:m.outputs,loopControl:m.loopControl});
 }
}
await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify({builds,warmup,measure,recovery})+']====]');
const control=await fs.readFile(path.join(here,'control.lua'));await fs.writeFile(path.join(mod,'control.lua'),control);
await fs.writeFile(path.join(runRoot,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${runRoot}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(path.join(runRoot,'map.json'),JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function factorio(a,log){try{const r=await run(binary,['--config',path.join(runRoot,'config.ini'),'--mod-directory',path.join(runRoot,'mods'),...a],{timeout:1800000,maxBuffer:8e6});await fs.writeFile(path.join(runRoot,log),r.stdout+r.stderr);}catch(e){await fs.writeFile(path.join(runRoot,log),(e.stdout||'')+(e.stderr||''));throw Error('Factorio failed: '+path.join(runRoot,log)+'\n'+(e.stdout||'').slice(-2500));}}
console.log('Private native run:',runRoot);
await factorio(['--create',path.join(runRoot,'test.zip'),'--map-gen-settings',path.join(runRoot,'map.json')],'create.log');
const total=warmup+measure+recovery.pauseTicks+recovery.settleTicks+recovery.measureTicks;
await factorio(['--benchmark',path.join(runRoot,'test.zip'),'--benchmark-ticks',String(total+1),'--benchmark-runs','1'],'benchmark.log');
const result=JSON.parse(await fs.readFile(path.join(runRoot,'script-output/result.json')));
// Criteria. At scale 1: steady and recovery output at least 95% of target, and every machine crafts in the measured
// window. At 0.8 (no jam): steady output at least 95% of the proportional 16/min over the 30-minute window, and at least
// 90% of it in the three-minute recovery window (at 16/min one frame more or less is 2% of that window and the minute
// counts vary by +-3 at both feeds; collectedByMinute records them). Both: only the product reaches the outlet,
// every belt inlet has a productive route, the ring never reaches 90% of its capacity, and each
// inlet's queue stays below one minute of its feed at the end (the factory takes what it is given).
for(const b of result.builds){
 const target=records.find(r=>r.m.id===b.id&&r.m.variant===b.variant).m.targetPerMinute,want=.95*target*b.feedScale;
 const outlet=Object.keys(b.outletItems||{});
 b.criteria={
  steady:(b.outputsPerMinute[PRODUCT]||0)>=want,recovery:(b.recoveryPerMinute[PRODUCT]||0)>=(b.feedScale<1?.9*target*b.feedScale:want),
  productOnly:outlet.length===1&&outlet[0]===PRODUCT,
  everyMachineCrafting:b.feedScale<1||b.machines.every(m=>m.measuredCrafts>0),
  routes:b.inputs.every(i=>i.productiveRoute?.length>0),
  ringBelowNinetyPercent:!b.overfilled,
  queuesBounded:[...b.inputs,...b.fluids].every(i=>i.finalBacklog<i.feedPerMinute),
  powered:b.powered===true,
 };
 b.passed=Object.values(b.criteria).every(Boolean);
 const rec=records.find(r=>r.m.id===b.id&&r.m.variant===b.variant);b.blueprintSha256=rec.m.blueprintSha256;
 b.footprint=rec.m.footprint;b.tiles=rec.m.footprint.width*rec.m.footprint.height;b.machineCounts=rec.m.machineCounts;
 b.entityCounts=Object.fromEntries([...new Set(rec.entities.map(e=>e.name))].sort().map(n=>[n,rec.entities.filter(e=>e.name===n).length]));
}
Object.assign(result,{gameVersion:'2.1.24',short,warmupMinutes:warmup/3600,measurementMinutes:measure/3600,recovery:{blockedMinutes:5,settlingMinutes:2,measurementMinutes:3},
 feedPolicy:'Metered: every belt inlet receives exactly its panel figure times the feed scale per minute at its declared inlet tile (both lanes, queued when refused); every pipe inlet receives its panel figure of fluid per minute at its declared inlet entity. No internal injection. Output chest emptied every second except during the five blocked minutes.',
 researchPolicy:'All recipes enabled, no technologies researched, inserter stack bonus zero',
 prototypeSha256:sha(dumpBytes),harnessSha256:sha(control),runnerSha256:sha(await fs.readFile(new URL(import.meta.url))),modList:list,createdAt:new Date().toISOString()});
result.passed=result.builds.every(b=>b.passed);
await fs.writeFile(path.join(runRoot,'report.json'),JSON.stringify(result,null,2)+'\n');
if(write&&!short){
 if(sources.length!==1)throw Error('--write needs exactly one source');
 await fs.writeFile(path.join(sources[0],'native-report.json'),JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify({report:path.join(runRoot,'report.json'),passed:result.passed,builds:result.builds.map(b=>({variant:b.variant,scale:b.feedScale,passed:b.passed,steady:b.outputsPerMinute[PRODUCT],recovery:b.recoveryPerMinute[PRODUCT],failed:Object.entries(b.criteria).filter(([,v])=>!v).map(([k])=>k),idle:b.machines.filter(m=>m.measuredCrafts===0).map(m=>m.recipe),ring:b.loopSamples}))},null,2));
process.exitCode=result.passed?0:1;
