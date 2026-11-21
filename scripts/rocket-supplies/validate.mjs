// Native qualification runner for rocket-supplies. Copied from scripts/robot-essentials/validate.mjs
// and adapted to the space-launch contract (section 11, rate class): throttled entrances at the
// manifest's perMinute, phases from manifest.protocol, the spec's extra blocked-phase checks, and
// exploration runs (SPACE_EXPLORE=1) that write only .cache/rocket-supplies/explore-report.json.
//
//   node scripts/rocket-supplies/validate.mjs                     full protocol, writes native-report.json
//   RS_IMPORT_ONLY=1 node scripts/rocket-supplies/validate.mjs     import, wiring, fluids, power (61 ticks)
//   SPACE_EXPLORE=1 RS_SOURCE=.cache/rocket-supplies/candidate RS_WARMUP=10 RS_MEASURE=10 \
//     [RS_BLOCKED=0 RS_SETTLE=0 RS_RECOVERY=0 RS_SATURATE=1 RS_DEBUG=1] node scripts/rocket-supplies/validate.mjs
//   Exploration only: RS_FEED='{"electronic-circuit":220}' feeds the named entrances at those figures
//   instead of their panels; RS_REPORT=<file> writes the exploration report there.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';

const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const id='rocket-supplies';
const source=process.env.RS_SOURCE||'blueprint-sources/'+id;
const explore=process.env.SPACE_EXPLORE==='1',importOnly=process.env.RS_IMPORT_ONLY==='1';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes=await fs.readFile(rawPath),raw=JSON.parse(bytes);
if(source!=='blueprint-sources/'+id&&!explore&&!importOnly)throw Error('A full run publishes only blueprint-sources/'+id+'; use SPACE_EXPLORE=1 for other sources');
if(!explore&&(process.env.RS_SATURATE||process.env.RS_DEBUG||process.env.RS_FEED||process.env.RS_REPORT))throw Error('Saturated or overridden feed, debug topology and report paths are exploration-only');
const feed=explore&&process.env.RS_FEED?JSON.parse(process.env.RS_FEED):{};
const builds=JSON.parse(await fs.readFile(source+'/manifest.json'));
for(const b of builds){
 b.code=(await fs.readFile(source+'/'+b.file,'utf8')).trim();
 if(b.prototypeSha256!==sha(bytes))throw Error('Prototype SHA mismatch '+b.id);
 if(sha(b.code)!==b.blueprintSha256)throw Error('Code SHA mismatch '+b.id);
 b.entities=decodeBlueprint(b.code).blueprint.entities;
 b.recipeIngredients=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].ingredients]));
 // The configuration hash leaves out the fields the generator rewrites from the report.
 delete b.status;delete b.measured;
 for(const q of [...b.inputs,...b.fluids])if(feed[q.item]!==undefined)q.perMinute=feed[q.item];
}
const p=builds[0].protocol;
const minutes=(name,env)=>explore&&process.env[env]!==undefined?Number(process.env[env]):p[name];
const protocol={warmup:minutes('warmupMinutes','RS_WARMUP')*3600,measure:minutes('measureMinutes','RS_MEASURE')*3600,
 blocked:minutes('blockedMinutes','RS_BLOCKED')*3600,settle:minutes('settleMinutes','RS_SETTLE')*3600,recovery:minutes('recoveryMinutes','RS_RECOVERY')*3600,
 stopWindow:p.stopAcceptingWindowMinutes*3600};
if(!explore&&!importOnly){
 const min={warmupMinutes:15,measureMinutes:30,blockedMinutes:95,settleMinutes:5,recoveryMinutes:10};
 for(const[k,v]of Object.entries(min))if(!(p[k]>=v))throw Error('protocol '+k+' below the spec minimum');
 if(!(p.stopAcceptingWindowMinutes>=1))throw Error('stop-accepting window missing');
}
const ticks=importOnly?61:protocol.warmup+protocol.measure+protocol.blocked+protocol.settle+protocol.recovery+1;
const root=path.resolve(process.env.RS_RUN_ROOT||'.cache/'+id+'/native-'+Date.now());
await fs.rm(root,{recursive:true,force:true});
const app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/rocket_supplies_test';
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','rocket_supplies_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'rocket_supplies_test',version:'1.0.0',title:'Private rocket supplies qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile('scripts/'+id+'/control.lua',mod+'/control.lua');
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({builds,protocol,saturate:process.env.RS_SATURATE==='1'})+']====]');
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,file){
 try{
  const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600*1000,maxBuffer:16e6});
  if(process.platform==='darwin'&&task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});
  const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);
  if(!/Factorio 2\.1\.24/.test(r.stdout+r.stderr))throw Object.assign(Error('not Factorio 2.1.24'),{stdout:r.stdout,stderr:r.stderr});
  if(/FLIGHT_SCIENCE/.test(r.stdout+r.stderr))throw Object.assign(Error('harness check failed'),{stdout:r.stdout,stderr:r.stderr});
 }catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+((e.stdout||'')+(e.stderr||'')).split('\n').filter(l=>/FLIGHT_SCIENCE|Error|error|not Factorio/.test(l)).slice(-12).join('\n')+'\n'+e.message);}
}
console.log(root,JSON.stringify(protocol),'ticks',ticks);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(ticks),'--benchmark-runs','1'],'benchmark.log');
if(importOnly){console.log('Native import geometry, wiring, conditions, chest bars, fluid segments, external approaches and power passed.');process.exit(0);}

const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
Object.assign(report,{gameVersion:'2.1.24',prototypeSha256:sha(bytes),harnessSha256:sha(await fs.readFile(mod+'/control.lua')),dataHarnessSha256:sha(await fs.readFile(mod+'/data.lua')),validatorSha256:sha(await fs.readFile('scripts/'+id+'/validate.mjs')),configurationSha256:sha(await fs.readFile(mod+'/payload.lua')),
 protocolMinutes:{warmupMinutes:protocol.warmup/3600,measureMinutes:protocol.measure/3600,blockedMinutes:protocol.blocked/3600,settleMinutes:protocol.settle/3600,recoveryMinutes:protocol.recovery/3600,stopAcceptingWindowMinutes:protocol.stopWindow/3600},
 createdAt:new Date().toISOString(),...(explore?{short:true,saturated:process.env.RS_SATURATE==='1',...(Object.keys(feed).length?{feedOverride:feed}:{})}:{})});
for(const r of report.builds){
 const b=builds.find(b=>b.id===r.id);r.blueprintSha256=b.blueprintSha256;
 for(const k of ['inputs','fluids','machines','outputPorts','bulkInserters'])r[k]=Array.isArray(r[k])?r[k]:[];
 const items=Object.keys(b.targets),floor=item=>b.targets[item]*.95,loop=b.loopControl[0],sample=r.loopSamples?.[loop.name];
 const rf=b.passThrough[0],rfAcceptance=r.blocked?.entranceAcceptance?.find(a=>a.item===rf);
 const checks={
  complete:r.complete===true,
  steady:items.every(n=>r.outputsPerMinute[n]>=floor(n)),
  recovery:protocol.recovery>0&&items.every(n=>r.recovery?.outputsPerMinute?.[n]>=floor(n)),
  everyMachineCrafted:r.machines.length===b.entities.filter(e=>e.recipe).length&&r.machines.every(m=>m.measuredCrafts>0),
  entrancesProductive:r.inputs.length===b.inputs.length&&r.inputs.every(p=>p.productiveRoute?.length&&p.acceptedDuringMeasurement>0),
  fluidsProductive:r.fluids.length===b.fluids.length&&r.fluids.every(p=>p.acceptedDuringMeasurement>0&&p.productiveConsumers?.length&&p.productiveConsumers.every(id=>r.machines.some(m=>m.entity===id&&m.measuredCrafts>0))),
  drawWithinPanels:[...r.inputs,...r.fluids].every(p=>p.measuredPerMinute<=p.perMinute+1e-9),
  outputsDelivered:r.outputPorts.length===b.outputs.length&&r.outputPorts.every(p=>p.collectedDuringMeasurement>0),
  blockedCapsExact:protocol.blocked>0&&r.blocked?.collectionPauseStock?.length===b.outputs.length&&r.blocked.collectionPauseStock.every(p=>p.count===p.capacity&&p.capacity===b.outputCaps[p.item]&&p.maxDuringBlocked<=p.capacity),
  machinesStoppedInLastBlockedMinute:r.blocked?.machinesStoppedInLastMinute===true,
  rocketFuelEntranceStopped:!!rfAcceptance&&rfAcceptance.inStopWindow===0&&rfAcceptance.blocked>0,
  ringBelow90:!!sample&&sample.maxStock<0.9*loop.capacity,
  wiringAndPower:r.powered===true&&r.externalApproachesClear===true&&r.stockNetworksIsolated===true&&r.exactRecipeChecks>0,
  bulkHandAtMostTwo:r.bulkInserters.every(x=>x.observedMaxHand<=2),
 };
 r.checks=checks;r.passed=Object.values(checks).every(Boolean);
}
report.passed=report.builds.every(b=>b.passed);
const target=explore?(process.env.RS_REPORT||'.cache/'+id+'/explore-report.json'):source+'/native-report.json';
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.writeFile(target,JSON.stringify(report,null,2)+'\n');
const r=report.builds[0];
console.log(JSON.stringify({passed:report.passed,checks:r.checks,steady:r.outputsPerMinute,recovery:r.recovery?.outputsPerMinute,pause:r.blocked?.collectionPauseStock?.map(p=>p.item+':'+p.count),ringMax:r.loopSamples?.[id]?.maxStock,idle:r.machines.filter(m=>!m.measuredCrafts).map(m=>m.recipe)},null,1));
if(!process.env.RS_KEEP_RUN)await fs.rm(root+'/test.zip',{force:true});
process.exitCode=report.passed?0:1;
