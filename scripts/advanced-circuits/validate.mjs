// Native qualification for advanced-circuits (rate class, belt exit), adapted from scripts/concrete-supplier/validate.mjs.
// Full protocol (phase lengths from manifest.protocol) writes <source>/native-report.json. One game runs two copies of
// the exact string side by side on separate surfaces: the qualification copy with every entrance throttled to its
// panel figure (perMinute), and an underfed copy (id "<id>-underfed", feedScale 0.8) fed 80% of every panel figure.
// AC_EXPLORE=1 runs shorter phases (AC_WARMUP, AC_MEASURE, AC_BLOCKED, AC_SETTLE, AC_RECOVERY minutes; AC_SATURATE=1
// saturates the entrances; AC_DEBUG=1 adds belt contents) and writes .cache/advanced-circuits/explore-report.json with
// short: true; it never touches native-report.json. AC_SOURCE picks another source folder (a candidate generated with
// --out). AC_IMPORT_ONLY=1 stops after the import checks.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile}from'node:child_process';import{promisify}from'node:util';import{createHash}from'node:crypto';import{decodeBlueprint}from'../blueprints.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const id='advanced-circuits',here='scripts/'+id,source=process.env.AC_SOURCE||'blueprint-sources/'+id,explore=process.env.AC_EXPLORE==='1';
const underfedScale=.8;
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
if(!explore&&process.env.AC_SATURATE==='1')throw Error('saturated feeding is for exploration runs only');
const protocol=builds[0].protocol;
const env=(k,d)=>Number(process.env['AC_'+k]??d);
const minutes=explore?{warmupMinutes:env('WARMUP',5),measureMinutes:env('MEASURE',5),blockedMinutes:env('BLOCKED',3),settleMinutes:env('SETTLE',1),recoveryMinutes:env('RECOVERY',3)}:{...protocol};
const ticks=Object.fromEntries(Object.entries(minutes).map(([k,v])=>[k.replace('Minutes',''),Math.round(v*3600)]));
const total=ticks.warmup+ticks.measure+ticks.blocked+ticks.settle+ticks.recovery;
const root=path.resolve(process.env.AC_RUN_ROOT||'.cache/'+id+'/native-'+Date.now()),app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),modName='advanced_circuits_test',mod=root+'/mods/'+modName;
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age',modName].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:modName,version:'1.0.0',title:'Private advanced-circuit qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile(here+'/control.lua',mod+'/control.lua');
// The payload (and so configurationSha256) leaves out the manifest fields the generator rewrites from this
// report (status, measured), so the hash can be reproduced from the committed manifest.
const payloadBuilds=builds.flatMap(({status,measured,...b})=>[b,{...b,id:b.id+'-underfed',feedScale:underfedScale}]);
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({builds:payloadBuilds,warmup:ticks.warmup,measure:ticks.measure,blocked:ticks.blocked,settle:ticks.settle,recovery:ticks.recovery,saturate:explore&&process.env.AC_SATURATE==='1',debugTopology:process.env.AC_DEBUG==='1'})+']====]');
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,file){try{const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600000,maxBuffer:32e6});if(process.platform==='darwin'&&task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+(e.stdout||'').slice(-2400));}}
console.log(root);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(process.env.AC_IMPORT_ONLY==='1'?61:total+1),'--benchmark-runs','1'],'benchmark.log');
if(process.env.AC_IMPORT_ONLY==='1'){console.log('Native import geometry, recipes, arm settings, external approaches and power coverage passed for '+builds.length+' build(s).');process.exit(0);}
const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
Object.assign(report,{gameVersion:'2.1.24',prototypeSha256:sha(bytes),harnessSha256:sha(await fs.readFile(mod+'/control.lua')),dataHarnessSha256:sha(await fs.readFile(mod+'/data.lua')),validatorSha256:sha(await fs.readFile(here+'/validate.mjs')),configurationSha256:sha(await fs.readFile(mod+'/payload.lua')),protocolMinutes:minutes,protocol:minutes,warmupMinutes:minutes.warmupMinutes,measurementMinutes:minutes.measureMinutes,createdAt:new Date().toISOString(),runRoot:path.relative(process.cwd(),root)});
for(const r of report.builds){for(const k of ['fluids','inputs','bulkInserters','machines','outputPorts','exitForeignItems'])r[k]=Array.isArray(r[k])?r[k]:[];if(r.blocked&&!Array.isArray(r.blocked.stillCrafting))r.blocked.stillCrafting=[];delete r.transportDebug;}
const main=report.builds.filter(r=>!r.id.endsWith('-underfed')),underfed=report.builds.filter(r=>r.id.endsWith('-underfed'));
// The pass formula of CONTRACT section 11 (rate class), with the entrances throttled to the panel figures, plus:
// every advanced-circuit machine working at least 95% of the measured seconds (the intermediate machines only need to
// craft: with plates fed at exactly the panel figures the westmost producers take their full share first, and the
// spare capacity of eleven cable machines for 10.4 needed lands on the last ones), and nothing but the product ever
// at the exit.
export function passChecks(r,b){
 const target=p=>b.targets[p]*.95;
 const measured=r.inputs,entrances=b.inputs||[];
 return {
  finished:!!r.finished,
  steadyRates:b.products.every(p=>r.outputsPerMinute?.[p]>=target(p)),
  recoveryRates:b.products.every(p=>r.recovery?.outputsPerMinute?.[p]>=target(p)),
  everyMachineCrafted:(r.machines||[]).length===Object.values(b.machineCounts).reduce((a,n)=>a+n,0)&&r.machines.every(m=>m.measuredCrafts>0),
  productMachinesWorking:r.machines.filter(m=>m.recipe===b.products[0]).every(m=>(m.statusSamples?.working||0)>=.95*minutes.measureMinutes*60),
  everyEntranceProductive:measured.length===entrances.length&&measured.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute?.length>0),
  entranceDrawWithinPanel:measured.length===entrances.length&&measured.every(p=>p.measuredPerMinute<=entrances.find(e=>e.entity===p.entity).perMinute+1e-6),
  everyOutputDelivered:(r.outputPorts||[]).length===b.outputs.length&&r.outputPorts.every(p=>p.collectedDuringMeasurement>0),
  onlyProductAtExit:r.exitForeignItems.length===0&&!!r.exitChecks,
  blockedStockExact:(r.blocked?.collectionPauseStock||[]).length===b.outputs.length&&r.blocked.collectionPauseStock.every(p=>p.count===p.capacity&&p.maxDuringBlocked<=p.capacity),
  machinesStoppedWhileBlocked:!!r.blocked?.machinesStoppedInLastMinute,
  ringBelowNinetyPercent:Object.values(r.loopSamples||{}).every(s=>s.maxStock<s.capacity*.9)&&!!r.ringWiringChecked,
  powerAndGeometry:!!r.powered&&!!r.externalApproachesClear&&r.exactRecipeChecks>0&&r.importedEntities===b.entities.length,
  bulkHandAtMostTwo:(r.bulkInserters||[]).length===b.entities.filter(e=>e.name==='bulk-inserter').length&&r.bulkInserters.every(a=>a.observedMaxHand<=2),
 };
}
// Fed 80% of every panel figure: it makes proportionally less (at least 95% and at most 103% of 80% of the target), is back at that rate after the blocked phase (it does not jam), and nothing but the product leaves.
export function underfedChecks(u,b){
 const scale=u.feedScale,floor=p=>b.targets[p]*scale*.95;
 return {
  finished:!!u.finished,
  steadyProportional:b.products.every(p=>u.outputsPerMinute?.[p]>=floor(p)&&u.outputsPerMinute[p]<=b.targets[p]*scale*1.03),
  recoveryProportional:b.products.every(p=>u.recovery?.outputsPerMinute?.[p]>=floor(p)),
  drawWithinScaledPanel:u.inputs.length===(b.inputs||[]).length&&u.inputs.every(p=>p.measuredPerMinute<=p.perMinute*scale+1e-6),
  onlyProductAtExit:u.exitForeignItems.length===0&&!!u.exitChecks,
  blockedStockExact:(u.blocked?.collectionPauseStock||[]).length===b.outputs.length&&u.blocked.collectionPauseStock.every(p=>p.count===p.capacity&&p.maxDuringBlocked<=p.capacity),
 };
}
for(const r of main){
 const b=builds.find(b=>b.id===r.id),u=underfed.find(u=>u.id===r.id+'-underfed');
 r.blueprintSha256=b.blueprintSha256;r.checks=passChecks(r,b);
 r.underfed=u?{feedScale:u.feedScale,steadyPerMinute:u.outputsPerMinute,recoveryPerMinute:u.recovery?.outputsPerMinute,madePerMinute:u.madePerMinute,inputs:u.inputs.map(p=>({item:p.item,entity:p.entity,perMinute:p.perMinute,measuredPerMinute:p.measuredPerMinute})),blocked:u.blocked&&{collectionPauseStock:u.blocked.collectionPauseStock,machinesStoppedInLastMinute:u.blocked.machinesStoppedInLastMinute},exitForeignItems:u.exitForeignItems,exitChecks:u.exitChecks,checks:underfedChecks(u,b)}:null;
 r.checks.underfedProportional=!!r.underfed&&Object.values(r.underfed.checks).every(Boolean);
 r.passed=Object.values(r.checks).every(Boolean);
}
report.builds=main;report.passed=main.length===builds.length&&main.every(b=>b.passed);
const target=explore?'.cache/'+id+'/explore-report.json':source+'/native-report.json';
if(explore){report.short=true;report.source=source;report.saturated=process.env.AC_SATURATE==='1';}
await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(report,null,2)+'\n');
const summary=r=>({id:r.id,passed:r.passed,steady:r.outputsPerMinute,made:r.madePerMinute,recovery:r.recovery?.outputsPerMinute,lanes:r.outputPorts?.map(p=>p.collectedByLane),entrances:r.inputs.map(p=>p.item+' '+p.measuredPerMinute?.toFixed(2)+'/'+p.perMinute),blocked:r.blocked?.collectionPauseStock,stopped:r.blocked?.machinesStoppedInLastMinute,underfed:r.underfed&&{steady:r.underfed.steadyPerMinute,recovery:r.underfed.recoveryPerMinute,failed:Object.entries(r.underfed.checks).filter(([,v])=>!v).map(([k])=>k)},failed:Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k),machines:r.machines.map(m=>m.recipe+'@'+m.x+','+m.y+'='+m.measuredCrafts+' '+JSON.stringify(m.statusSamples)).sort()});
console.log(JSON.stringify(report.builds.map(summary),null,1));
console.log('report: '+target);
process.exitCode=report.passed?0:1;
