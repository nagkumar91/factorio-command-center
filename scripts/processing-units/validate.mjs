// Native qualification for processing-units (rate class), adapted from scripts/green-circuits/validate.mjs.
// Every entrance (belts and the acid pipe) is throttled to its panel figure (manifest perMinute); a
// qualification run always feeds exactly the panel figures. Full protocol (phase lengths from manifest.protocol)
// writes <source>/native-report.json.
// PU_EXPLORE=1 runs shorter phases (PU_WARMUP, PU_MEASURE, PU_BLOCKED, PU_SETTLE, PU_RECOVERY minutes) and writes
// .cache/processing-units/explore-report.json with short: true; it never touches native-report.json.
// Exploration only: PU_FEED_SCALE=0.8 feeds every entrance at 80% of its panel figure.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile}from'node:child_process';import{promisify}from'node:util';import{createHash}from'node:crypto';import{decodeBlueprint}from'../blueprints.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const id='processing-units',source=process.env.PU_SOURCE||'blueprint-sources/'+id,explore=process.env.PU_EXPLORE==='1';
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
const feedScale=Number(process.env.PU_FEED_SCALE??1);
if(feedScale!==1&&!explore)throw Error('PU_FEED_SCALE is for exploration runs only (set PU_EXPLORE=1)');
const protocol=builds[0].protocol;
const minutes=explore?{warmupMinutes:Number(process.env.PU_WARMUP??3),measureMinutes:Number(process.env.PU_MEASURE??5),blockedMinutes:Number(process.env.PU_BLOCKED??2),settleMinutes:Number(process.env.PU_SETTLE??1),recoveryMinutes:Number(process.env.PU_RECOVERY??2)}:{...protocol};
const ticks=Object.fromEntries(Object.entries(minutes).map(([k,v])=>[k.replace('Minutes',''),Math.round(v*3600)]));
const total=ticks.warmup+ticks.measure+ticks.blocked+ticks.settle+ticks.recovery;
const root=path.resolve(process.env.PU_RUN_ROOT||'.cache/'+id+'/native-'+Date.now()),app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/processing_units_test';
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','processing_units_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'processing_units_test',version:'1.0.0',title:'Private processing-unit qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile('scripts/processing-units/control.lua',mod+'/control.lua');
// The payload (and so configurationSha256) leaves out the manifest fields the generator rewrites from this
// report (status, measured), so the hash can be reproduced from the committed manifest.
const payloadBuilds=builds.map(({status,measured,...b})=>b);
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({builds:payloadBuilds,warmup:ticks.warmup,measure:ticks.measure,blocked:ticks.blocked,settle:ticks.settle,recovery:ticks.recovery,feedScale,debugTopology:process.env.PU_DEBUG==='1'})+']====]');
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:64,height:64,default_enable_all_autoplace_controls:false}));
async function game(args,file){try{const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600000,maxBuffer:32e6});if(process.platform==='darwin'&&task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+(e.stdout||'').slice(-2400));}}
console.log(root);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(process.env.PU_IMPORT_ONLY==='1'?61:total+1),'--benchmark-runs','1'],'benchmark.log');
if(process.env.PU_IMPORT_ONLY==='1'){console.log('Native import geometry, recipes, arm settings, external approaches and power coverage passed for '+builds.length+' build(s).');process.exit(0);}
const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
Object.assign(report,{gameVersion:'2.1.24',prototypeSha256:sha(bytes),harnessSha256:sha(await fs.readFile(mod+'/control.lua')),dataHarnessSha256:sha(await fs.readFile(mod+'/data.lua')),validatorSha256:sha(await fs.readFile('scripts/processing-units/validate.mjs')),configurationSha256:sha(await fs.readFile(mod+'/payload.lua')),protocolMinutes:minutes,warmupMinutes:minutes.warmupMinutes,measurementMinutes:minutes.measureMinutes,createdAt:new Date().toISOString(),runRoot:path.relative(process.cwd(),root)});
for(const r of report.builds){
 const b=builds.find(b=>b.id===r.id);delete r.transport;r.blueprintSha256=b.blueprintSha256;r.fluids=Array.isArray(r.fluids)?r.fluids:[];
 r.checks=passChecks(r,b);r.passed=Object.values(r.checks).every(Boolean);
}
report.passed=report.builds.every(b=>b.passed);
// The pass formula of CONTRACT section 11 (rate class) plus spec section 7 (machines stop while blocked).
export function passChecks(r,b){
 const target=p=>b.targets[p]*.95;
 return {
  finished:!!r.finished,
  steadyRates:b.products.every(p=>r.outputsPerMinute?.[p]>=target(p)),
  recoveryRates:b.products.every(p=>r.recovery?.outputsPerMinute?.[p]>=target(p)),
  everyMachineCrafted:(r.machines||[]).length===Object.values(b.machineCounts).reduce((a,n)=>a+n,0)&&r.machines.every(m=>m.measuredCrafts>0),
  everyEntranceProductive:(r.inputs||[]).length===b.inputs.length&&r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute?.length>0),
  everyFluidProductive:r.fluids.length===(b.fluids||[]).length&&r.fluids.every(p=>p.acceptedDuringMeasurement>0&&(p.productiveConsumers||[]).length===b.machineCounts[b.products[0]]),
  noWrongItemsAtExit:!!r.wrongItemsAtExit&&Object.keys(r.wrongItemsAtExit).length===0,
  everyOutputDelivered:(r.outputPorts||[]).length===b.outputs.length&&r.outputPorts.every(p=>p.collectedDuringMeasurement>0),
  blockedStockExact:(r.blocked?.collectionPauseStock||[]).length===b.outputs.length&&r.blocked.collectionPauseStock.every(p=>p.count===p.capacity&&p.maxDuringBlocked<=p.capacity),
  machinesStoppedWhileBlocked:!!r.blocked?.machinesStoppedInLastMinute,
  ringBelowNinetyPercent:Object.values(r.loopSamples||{}).every(s=>s.maxStock<s.capacity*.9)&&!!r.ringWiringChecked,
  powerAndGeometry:!!r.powered&&!!r.externalApproachesClear&&r.exactRecipeChecks>0&&r.importedEntities===b.entities.length,
  bulkHandAtMostTwo:(r.bulkInserters||[]).length===b.entities.filter(e=>e.name==='bulk-inserter').length&&r.bulkInserters.every(a=>a.observedMaxHand<=2),
 };
}
const target=explore?'.cache/'+id+'/explore-report.json':source+'/native-report.json';
if(explore){report.short=true;report.source=source;report.feedScale=feedScale;}
await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.builds.map(r=>({id:r.id,passed:r.passed,steady:r.outputsPerMinute,made:r.madePerMinute,recovery:r.recovery?.outputsPerMinute,lanes:r.outputPorts?.map(p=>p.collectedByLane),use:r.consumptionPerMinute,acid:r.fluids?.map(f=>f.acceptedPerMinute),wrong:r.wrongItemsAtExit,blocked:r.blocked?.collectionPauseStock,stopped:r.blocked?.machinesStoppedInLastMinute,failed:Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k),crafts:r.machines.map(m=>m.recipe.split('-').map(w=>w[0]).join('')+'@'+m.x+','+m.y+'='+m.measuredCrafts).sort()})),null,1));
console.log('report: '+target);
process.exitCode=report.passed?0:1;
