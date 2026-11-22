// Native qualification for processing-unit-supply on the family's Factorio 2.1.24 flight-save profile.
// Like tests/flight-science-sided-native.mjs: the copied mod profile (.cache/heavy-supplies/flight-21 or
// FACTORIO_PROFILE) plus a private test mod, a private --config and write-data folder, headless --benchmark.
// Mod zips are hard-linked from the profile, not copied. Protocol: 15 min warm-up, 30 min measured, collection
// paused 5 min, 2 min settling, 3 min recovery. Every inlet is metered to its panel figure (control.lua).
// A qualification run writes <source>/native-report.json. PUS_EXPLORE=1 runs shorter phases (PUS_WARMUP,
// PUS_MEASURE, PUS_BLOCKED, PUS_SETTLE, PUS_RECOVERY minutes) or other feeds (PUS_FEED_SCALE, exploration only)
// and writes PUS_REPORT (default .cache/heavy-supplies/processing-unit-supply/explore-report.json).
// PUS_SOURCE=<dir> validates a candidate in another folder.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile}from'node:child_process';import{promisify}from'node:util';import{createHash}from'node:crypto';import{decodeBlueprint}from'../../../blueprints.mjs';
import {id,sourceFolder} from './generate.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const here=path.dirname(new URL(import.meta.url).pathname),project=path.resolve(here,'../../../..');
const source=path.resolve(process.env.PUS_SOURCE||sourceFolder),explore=process.env.PUS_EXPLORE==='1';
const profile=path.resolve(process.env.FACTORIO_PROFILE||path.join(project,'.cache/heavy-supplies/flight-21'));
const dump=path.join(profile,'script-output/data-raw-dump.json'),bytes=await fs.readFile(dump),raw=JSON.parse(bytes);
const builds=JSON.parse(await fs.readFile(path.join(source,'manifest.json')));
for(const b of builds){
 b.code=(await fs.readFile(path.join(source,b.file),'utf8')).trim();
 if(b.prototypeSha256!==sha(bytes))throw Error('Prototype SHA mismatch '+b.id);
 if(sha(b.code)!==b.blueprintSha256)throw Error('Code SHA mismatch '+b.id);
 b.entities=decodeBlueprint(b.code).blueprint.entities;
 b.recipeIngredients=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].ingredients]));
 b.targets=Object.fromEntries(b.products.map(p=>[p,b.targetPerMinute]));
}
const feedScale=Number(process.env.PUS_FEED_SCALE??1);
if(feedScale!==1&&!explore)throw Error('PUS_FEED_SCALE is for exploration runs only (set PUS_EXPLORE=1)');
const family={warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:2,recoveryMinutes:3};
const minutes=explore?{warmupMinutes:Number(process.env.PUS_WARMUP??15),measureMinutes:Number(process.env.PUS_MEASURE??30),blockedMinutes:Number(process.env.PUS_BLOCKED??5),settleMinutes:Number(process.env.PUS_SETTLE??2),recoveryMinutes:Number(process.env.PUS_RECOVERY??3)}:family;
const ticks=Object.fromEntries(Object.entries(minutes).map(([k,v])=>[k.replace('Minutes',''),Math.round(v*3600)]));
const total=ticks.warmup+ticks.measure+ticks.blocked+ticks.settle+ticks.recovery;
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const root=path.resolve(process.env.PUS_RUN_ROOT||path.join(project,'.cache/heavy-supplies',id,'native-'+Date.now()));
const mods=path.join(root,'mods'),mod=path.join(mods,'processing_unit_supply_test');
await fs.mkdir(mod,{recursive:true});
for(const f of await fs.readdir(path.join(profile,'mods'))){if(f.endsWith('.zip')||f==='mod-settings.dat')await fs.link(path.join(profile,'mods',f),path.join(mods,f));}
const list=JSON.parse(await fs.readFile(path.join(profile,'mods/mod-list.json')));list.mods.push({name:'processing_unit_supply_test',enabled:true});
await fs.writeFile(path.join(mods,'mod-list.json'),JSON.stringify(list));
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'processing_unit_supply_test',version:'1.0.0',title:'Private processing-unit supply validation',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24']}));
await fs.copyFile(path.join(here,'control.lua'),path.join(mod,'control.lua'));
// The payload (and so configurationSha256) leaves out the manifest fields the generator rewrites from this report.
const payloadBuilds=builds.map(({status,measured,nativeEvidence,...b})=>b);
await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify({builds:payloadBuilds,warmup:ticks.warmup,measure:ticks.measure,blocked:ticks.blocked,settle:ticks.settle,recovery:ticks.recovery,feedScale,debugTopology:process.env.PUS_DEBUG==='1'})+']====]');
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(path.join(root,'map.json'),JSON.stringify({seed:12345,width:64,height:64,default_enable_all_autoplace_controls:false}));
async function game(args,file){try{const r=await run(path.join(app,'Contents/MacOS/factorio'),['--config',path.join(root,'config.ini'),'--mod-directory',mods,...args],{timeout:4*3600000,maxBuffer:32e6});await fs.writeFile(path.join(root,file),r.stdout+r.stderr);}catch(e){await fs.writeFile(path.join(root,file),(e.stdout||'')+(e.stderr||''));throw Error(path.join(root,file)+'\n'+(e.stdout||'').slice(-2400));}}
console.log('Private native test:',root);
await game(['--create',path.join(root,'test.zip'),'--map-gen-settings',path.join(root,'map.json')],'create.log');
await game(['--benchmark',path.join(root,'test.zip'),'--benchmark-ticks',String(total+1),'--benchmark-runs','1'],'benchmark.log');
const report=JSON.parse(await fs.readFile(path.join(root,'script-output/result.json')));
Object.assign(report,{gameVersion:'2.1.24',short:explore,prototypeSha256:sha(bytes),harnessSha256:sha(await fs.readFile(path.join(mod,'control.lua'))),validatorSha256:sha(await fs.readFile(new URL(import.meta.url))),configurationSha256:sha(await fs.readFile(path.join(mod,'payload.lua'))),protocolMinutes:minutes,warmupMinutes:minutes.warmupMinutes,measurementMinutes:minutes.measureMinutes,modList:list,createdAt:new Date().toISOString(),runRoot:path.relative(project,root)});
export function passChecks(r,b){
 const bar=p=>b.targets[p]*.95,machines=Object.values(b.machineCounts).reduce((a,n)=>a+n,0);
 return {
  finished:!!r.finished,
  steadyRates:b.products.every(p=>r.outputsPerMinute?.[p]>=bar(p)),
  recoveryRates:b.products.every(p=>r.recovery?.outputsPerMinute?.[p]>=bar(p)),
  everyMachineCrafted:(r.machines||[]).length===machines&&r.machines.every(m=>m.measuredCrafts>0),
  everyInletProductive:(r.inputs||[]).length===b.inputs.length&&r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute?.length>0),
  everyAcidConsumerOnInletSegment:(r.fluids||[]).length===(b.fluids||[]).length&&r.fluids.every(p=>p.acceptedDuringMeasurement>0&&(p.productiveConsumers||[]).length===machines),
  onlyProductAtOutlet:!!r.wrongItemsAtOutlet&&Object.keys(r.wrongItemsAtOutlet).length===0,
  everyOutputDelivered:(r.outputPorts||[]).length===b.outputs.length&&r.outputPorts.every(p=>p.collectedDuringMeasurement>0),
  powerAndGeometry:!!r.powered&&!!r.externalApproachesClear&&r.exactRecipeChecks>0&&r.importedEntities===b.entities.length,
 };
}
for(const r of report.builds){
 const b=builds.find(b=>b.id===r.id);delete r.transport;r.blueprintSha256=b.blueprintSha256;r.fluids=Array.isArray(r.fluids)?r.fluids:[];
 r.checks=passChecks(r,b);r.passed=Object.values(r.checks).every(Boolean);
}
report.passed=report.builds.every(b=>b.passed);
const target=explore?path.resolve(process.env.PUS_REPORT||path.join(project,'.cache/heavy-supplies',id,'explore-report.json')):path.join(source,'native-report.json');
if(explore){report.source=path.relative(project,source);report.feedScale=feedScale;}
await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.builds.map(r=>({id:r.id,passed:r.passed,steady:r.outputsPerMinute,made:r.madePerMinute,recovery:r.recovery?.outputsPerMinute,inlets:r.inputs?.map(p=>[p.item,p.acceptedPerMinute,p.maxItemsOnInletTile]),use:r.consumptionPerMinute,acid:r.fluids?.map(f=>[f.acceptedPerMinute,f.productiveConsumers?.length]),wrong:r.wrongItemsAtOutlet,blocked:r.blocked?.collectionPauseStock,failed:Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k),crafts:r.machines.map(m=>m.x+','+m.y+'='+m.measuredCrafts).sort()})),null,1));
console.log('report: '+target);
// Delete the run folder's save and mod links unless asked to keep them (the logs and result stay).
if(process.env.PUS_KEEP!=='1'){await fs.rm(mods,{recursive:true,force:true});await fs.rm(path.join(root,'test.zip'),{force:true});}
process.exitCode=report.passed?0:1;
