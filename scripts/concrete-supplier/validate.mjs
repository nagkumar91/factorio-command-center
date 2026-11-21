// Native qualification for concrete-supplier (rate class, belt exit), adapted from scripts/green-circuits/validate.mjs.
// Full protocol (phase lengths from manifest.protocol, entrances throttled to their perMinute) writes
// <source>/native-report.json. SPACE_EXPLORE=1 runs shorter phases (SUPPLIER_WARMUP, _MEASURE, _BLOCKED, _SETTLE,
// _RECOVERY minutes; SUPPLIER_SATURATE=1 saturates the entrances, SUPPLIER_DEBUG=1 adds belt topology) and writes
// .cache/concrete-supplier/explore-report.json with short: true; it never touches native-report.json.
// SUPPLIER_SOURCE picks another source folder (a candidate generated with --out).
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile}from'node:child_process';import{promisify}from'node:util';import{createHash}from'node:crypto';import{decodeBlueprint}from'../blueprints.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const id='concrete-supplier',here='scripts/'+id,source=process.env.SUPPLIER_SOURCE||'blueprint-sources/'+id,explore=process.env.SPACE_EXPLORE==='1';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json',bytes=await fs.readFile(rawPath),raw=JSON.parse(bytes);
const builds=JSON.parse(await fs.readFile(source+'/manifest.json'));
const minimum={warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10};
for(const b of builds){
 b.code=(await fs.readFile(source+'/'+b.file,'utf8')).trim();
 if(b.prototypeSha256!==sha(bytes))throw Error('Prototype SHA mismatch '+b.id);
 if(sha(b.code)!==b.blueprintSha256)throw Error('Code SHA mismatch '+b.id);
 b.entities=decodeBlueprint(b.code).blueprint.entities;
 b.recipeIngredients=Object.fromEntries(Object.keys(b.machineCounts||{}).map(n=>[n,raw.recipe[n].ingredients]));
 if(!explore)for(const[k,v]of Object.entries(minimum))if(!(b.protocol?.[k]>=v))throw Error(`protocol ${k} below the rate-class minimum`);
}
if(!explore&&process.env.SUPPLIER_SATURATE==='1')throw Error('saturated feeding is for exploration runs only');
const protocol=builds[0].protocol;
const env=(k,d)=>Number(process.env['SUPPLIER_'+k]??d);
const minutes=explore?{warmupMinutes:env('WARMUP',3),measureMinutes:env('MEASURE',5),blockedMinutes:env('BLOCKED',protocol.blockedMinutes),settleMinutes:env('SETTLE',1),recoveryMinutes:env('RECOVERY',2)}:{...protocol};
const ticks=Object.fromEntries(Object.entries(minutes).map(([k,v])=>[k.replace('Minutes',''),Math.round(v*3600)]));
const total=ticks.warmup+ticks.measure+ticks.blocked+ticks.settle+ticks.recovery;
const root=path.resolve(process.env.SUPPLIER_RUN_ROOT||'.cache/'+id+'/native-'+Date.now()),app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),modName='space_supplier_test',mod=root+'/mods/'+modName;
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age',modName].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:modName,version:'1.0.0',title:'Private space-launch supplier qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile(here+'/control.lua',mod+'/control.lua');
// The payload (and so configurationSha256) leaves out the manifest fields the generator rewrites from this
// report (status, measured), so the hash can be reproduced from the committed manifest.
const payloadBuilds=builds.map(({status,measured,...b})=>b);
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({builds:payloadBuilds,warmup:ticks.warmup,measure:ticks.measure,blocked:ticks.blocked,settle:ticks.settle,recovery:ticks.recovery,saturate:explore&&process.env.SUPPLIER_SATURATE==='1',debugTopology:process.env.SUPPLIER_DEBUG==='1'})+']====]');
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,file){try{const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600000,maxBuffer:32e6});if(process.platform==='darwin'&&task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+(e.stdout||'').slice(-2400));}}
console.log(root);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(process.env.SUPPLIER_IMPORT_ONLY==='1'?61:total+1),'--benchmark-runs','1'],'benchmark.log');
if(process.env.SUPPLIER_IMPORT_ONLY==='1'){console.log('Native import geometry, recipes, arm settings, external approaches and power coverage passed for '+builds.length+' build(s).');process.exit(0);}
const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
Object.assign(report,{gameVersion:'2.1.24',prototypeSha256:sha(bytes),harnessSha256:sha(await fs.readFile(mod+'/control.lua')),dataHarnessSha256:sha(await fs.readFile(mod+'/data.lua')),validatorSha256:sha(await fs.readFile(here+'/validate.mjs')),configurationSha256:sha(await fs.readFile(mod+'/payload.lua')),protocolMinutes:minutes,protocol:minutes,warmupMinutes:minutes.warmupMinutes,measurementMinutes:minutes.measureMinutes,createdAt:new Date().toISOString(),runRoot:path.relative(process.cwd(),root)});
for(const r of report.builds){
 const b=builds.find(b=>b.id===r.id);delete r.transport;r.blueprintSha256=b.blueprintSha256;for(const k of ['fluids','inputs','bulkInserters','machines','outputPorts'])r[k]=Array.isArray(r[k])?r[k]:[];if(r.blocked&&!Array.isArray(r.blocked.stillCrafting))r.blocked.stillCrafting=[];
 r.checks=passChecks(r,b);r.passed=Object.values(r.checks).every(Boolean);
}
report.passed=report.builds.every(b=>b.passed);
// The pass formula of CONTRACT section 11 (rate class).
export function passChecks(r,b){
 const target=p=>b.targets[p]*.95;
 const entrances=[...(b.inputs||[]),...(b.fluids||[])];
 const measured=[...r.inputs,...r.fluids];
 return {
  finished:!!r.finished,
  steadyRates:b.products.every(p=>r.outputsPerMinute?.[p]>=target(p)),
  recoveryRates:b.products.every(p=>r.recovery?.outputsPerMinute?.[p]>=target(p)),
  everyMachineCrafted:(r.machines||[]).length===Object.values(b.machineCounts).reduce((a,n)=>a+n,0)&&r.machines.every(m=>m.measuredCrafts>0),
  everyEntranceProductive:r.inputs.length===(b.inputs||[]).length&&r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute?.length>0),
  everyFluidProductive:r.fluids.length===(b.fluids||[]).length&&r.fluids.every(p=>p.acceptedDuringMeasurement>0&&p.productiveConsumers?.length>0&&!(p.disconnectedConsumers||[]).length),
  entranceDrawWithinPanel:measured.length===entrances.length&&measured.every(p=>p.measuredPerMinute<=entrances.find(e=>e.entity===p.entity).perMinute+1e-6),
  everyOutputDelivered:(r.outputPorts||[]).length===b.outputs.length&&r.outputPorts.every(p=>p.collectedDuringMeasurement>0),
  blockedStockExact:(r.blocked?.collectionPauseStock||[]).length===b.outputs.length&&r.blocked.collectionPauseStock.every(p=>p.count===p.capacity&&p.maxDuringBlocked<=p.capacity),
  machinesStoppedWhileBlocked:!!r.blocked?.machinesStoppedInLastMinute,
  ringBelowNinetyPercent:Object.values(r.loopSamples||{}).every(s=>s.maxStock<s.capacity*.9)&&!!r.ringWiringChecked,
  powerAndGeometry:!!r.powered&&!!r.externalApproachesClear&&r.exactRecipeChecks>0&&r.importedEntities===b.entities.length,
  bulkHandAtMostTwo:(r.bulkInserters||[]).length===b.entities.filter(e=>e.name==='bulk-inserter').length&&r.bulkInserters.every(a=>a.observedMaxHand<=2),
 };
}
const target=explore?'.cache/'+id+'/explore-report.json':source+'/native-report.json';
if(explore){report.short=true;report.source=source;report.saturated=process.env.SUPPLIER_SATURATE==='1';}
await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(report,null,2)+'\n');
const summary=r=>({id:r.id,passed:r.passed,steady:r.outputsPerMinute,made:r.madePerMinute,recovery:r.recovery?.outputsPerMinute,entrances:[...r.inputs,...r.fluids].map(p=>p.item+' '+p.measuredPerMinute?.toFixed(2)+'/'+p.perMinute),blocked:r.blocked?.collectionPauseStock,stopped:r.blocked?.machinesStoppedInLastMinute,still:r.blocked?.stillCrafting,failed:Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k),machines:r.machines.map(m=>m.recipe+'@'+m.x+','+m.y+'='+m.measuredCrafts+' '+JSON.stringify(m.statusSamples)).sort()});
console.log(JSON.stringify(report.builds.map(summary),null,1));
console.log('report: '+target);
process.exitCode=report.passed?0:1;
