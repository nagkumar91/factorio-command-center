// Native qualification runner for robot-essentials. Copied from
// scripts/robot-logistics-workshop/validate.mjs and adapted: protocol minutes come from
// the manifest, exploration runs (ESSENTIALS_EXPLORE=1) write only
// .cache/robot-essentials/explore-report.json, and the pass formula follows the
// essentials contract (section 11, rate class with selective phases). Full-stack caps (50 / 50 / 10 / 50 / 50): the closed hold
// and each selective settle are 30 minutes, and capsReachedInTime requires every cap reached inside them.
//
//   node scripts/robot-essentials/validate.mjs                  full protocol, writes native-report.json
//   RE_PANEL_SUPPLY=1 node scripts/robot-essentials/validate.mjs full protocol with every entrance fed at exactly
//                                                               its panel figure, writes panel-supply-report.json
//   RE_IMPORT_ONLY=1 node scripts/robot-essentials/validate.mjs  import, wiring, fluids, power (61 ticks)
//   ESSENTIALS_EXPLORE=1 RE_WARMUP=10 RE_MEASURE=10 [RE_BLOCKED=0 RE_SETTLE=0 RE_RECOVERY=0 RE_PHASES=0] ...
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';

const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const id='robot-essentials';
const source=process.env.RE_SOURCE||'blueprint-sources/'+id;
const explore=process.env.ESSENTIALS_EXPLORE==='1',importOnly=process.env.RE_IMPORT_ONLY==='1',panelSupply=process.env.RE_PANEL_SUPPLY==='1'&&!explore&&!importOnly;
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/clawd/workspaces/.claude/tmp-robot-requester-product/dump/write/script-output/data-raw-dump.json';
const bytes=await fs.readFile(rawPath),raw=JSON.parse(bytes);
if(source!=='blueprint-sources/'+id&&!explore&&!importOnly)throw Error('A full run publishes only blueprint-sources/'+id+'; use ESSENTIALS_EXPLORE=1 for other sources');
const builds=JSON.parse(await fs.readFile(source+'/manifest.json'));
for(const b of builds){
 b.code=(await fs.readFile(source+'/'+b.file,'utf8')).trim();
 if(b.prototypeSha256!==sha(bytes))throw Error('Prototype SHA mismatch '+b.id);
 if(sha(b.code)!==b.blueprintSha256)throw Error('Code SHA mismatch '+b.id);
 b.entities=decodeBlueprint(b.code).blueprint.entities;
 b.recipeIngredients=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].ingredients]));
}
const p=builds[0].protocol;
const minutes=(name,env)=>explore&&process.env[env]!==undefined?Number(process.env[env]):p[name];
const protocol={
 warmup:minutes('warmupMinutes','RE_WARMUP')*3600,measure:minutes('measureMinutes','RE_MEASURE')*3600,
 blocked:minutes('blockedMinutes','RE_BLOCKED')*3600,settle:minutes('settleMinutes','RE_SETTLE')*3600,recovery:minutes('recoveryMinutes','RE_RECOVERY')*3600,
 phase:(p.selectiveSettleMinutes+p.selectiveMeasureMinutes)*3600,phaseSettle:p.selectiveSettleMinutes*3600,phases:minutes('selectivePhases','RE_PHASES')};
if(!explore&&!importOnly){
 const min={warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10};
 for(const[k,v]of Object.entries(min))if(!(p[k]>=v))throw Error('protocol '+k+' below the contract minimum');
 if(p.selectivePhases!==builds[0].products.length||p.selectiveSettleMinutes<5||p.selectiveMeasureMinutes<10)throw Error('selective phases below the spec');
}
const ticks=importOnly?61:protocol.warmup+protocol.measure+protocol.blocked+protocol.settle+protocol.recovery+protocol.phases*protocol.phase+1;
const root=path.resolve(process.env.RE_RUN_ROOT||'.cache/'+id+'/native-'+Date.now());
const app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/robot_essentials_test';
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','robot_essentials_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'robot_essentials_test',version:'1.0.0',title:'Private robot essentials qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.25','space-age']}));
await fs.copyFile('scripts/'+id+'/control.lua',mod+'/control.lua');
// Supply-limited feeding (control.lua, payload.supply). The published panel-supply run feeds
// every belt and fluid entrance at exactly its panel figure. Exploration: RE_SUPPLY=1 feeds each
// belt entrance at that multiple of its panel figure, RE_FLUID_SUPPLY=1 the two fluids,
// RE_SUPPLY_ITEMS='{"steel-plate":1}' single entrances, RE_SUPPLY_BACKLOG the belt backlog in
// items; RE_RING_SERIES=1 records ring stock every second.
const supplyEnv={...(process.env.RE_SUPPLY?{belt:Number(process.env.RE_SUPPLY)}:{}),...(process.env.RE_FLUID_SUPPLY?{fluid:Number(process.env.RE_FLUID_SUPPLY)}:{}),...(process.env.RE_SUPPLY_ITEMS?{items:JSON.parse(process.env.RE_SUPPLY_ITEMS)}:{}),...(process.env.RE_SUPPLY_BACKLOG?{backlog:Number(process.env.RE_SUPPLY_BACKLOG)}:{})};
const supply=panelSupply?{belt:1,fluid:1}:explore&&Object.keys(supplyEnv).length?supplyEnv:undefined;
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({builds,protocol,debugTopology:process.env.RE_DEBUG==='1',...(supply?{supply}:{}),...(explore&&process.env.RE_RING_SERIES==='1'?{ringSeries:true}:{})})+']====]');
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,file){
 try{
  const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600*1000,maxBuffer:8e6});
  if(process.platform==='darwin'&&task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});
  const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);
  if(/FLIGHT_SCIENCE/.test(r.stdout+r.stderr))throw Object.assign(Error('harness check failed'),{stdout:r.stdout,stderr:r.stderr});
 }catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+((e.stdout||'')+(e.stderr||'')).split('\n').filter(l=>/FLIGHT_SCIENCE|Error|error/.test(l)).slice(-12).join('\n'));}
}
console.log(root,JSON.stringify(protocol),'ticks',ticks);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(ticks),'--benchmark-runs','1'],'benchmark.log');
if(importOnly){console.log('Native import geometry, wiring, gates, fluid segments, external approaches and power passed.');process.exit(0);}

const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
Object.assign(report,{gameVersion:'2.1.25',prototypeSha256:sha(bytes),harnessSha256:sha(await fs.readFile(mod+'/control.lua')),dataHarnessSha256:sha(await fs.readFile(mod+'/data.lua')),validatorSha256:sha(await fs.readFile('scripts/'+id+'/validate.mjs')),configurationSha256:sha(await fs.readFile(mod+'/payload.lua')),
 ...(supply?{supply}:{}),protocolMinutes:Object.fromEntries(Object.entries(protocol).map(([k,v])=>[k,k==='phases'?v:v/3600])),warmupMinutes:protocol.warmup/3600,measurementMinutes:protocol.measure/3600,createdAt:new Date().toISOString(),short:explore});
for(const r of report.builds){
 const b=builds.find(b=>b.id===r.id);r.blueprintSha256=b.blueprintSha256;r.fluids=Array.isArray(r.fluids)?r.fluids:[];
 const floor=item=>b.targets[item]*.95,loop=b.loopControl[0],sample=r.loopSamples?.[loop.name];
 const checks={
  steady:b.products.every(n=>r.outputsPerMinute[n]>=floor(n)),
  recovery:protocol.recovery>0&&b.products.every(n=>r.recovery?.outputsPerMinute?.[n]>=floor(n)),
  everyMachineCrafted:r.machines.length===b.entities.filter(e=>e.recipe).length&&r.machines.every(m=>m.measuredCrafts>0),
  entrancesProductive:r.inputs.length===b.inputs.length&&r.inputs.every(p=>p.productiveRoute?.length&&p.acceptedDuringMeasurement>0),
  fluidsProductive:r.fluids.length===b.fluids.length&&r.fluids.every(p=>p.acceptedDuringMeasurement>0&&p.productiveConsumers?.length&&p.productiveConsumers.every(id=>r.machines.some(m=>m.entity===id&&m.measuredCrafts>0))),
  outputsDelivered:r.outputPorts.every(p=>p.collectedDuringMeasurement>0),
  blockedCapsExact:protocol.blocked>0&&r.recovery?.collectionPauseStock?.length===b.products.length&&r.recovery.collectionPauseStock.every(p=>p.count===p.capacity&&p.capacity===b.outputCaps[p.item]),
  ringBelow90:!!sample&&sample.maxStock<0.9*loop.capacity,
  wiringAndPower:r.powered===true&&r.externalApproachesClear===true&&r.stockNetworksIsolated===true&&r.exactRecipeChecks>0,
  bulkHandAtMostTwo:r.bulkInserters.every(x=>x.observedMaxHand<=2),
  selective:protocol.phases===b.products.length&&r.independentStockCapTests?.length===b.products.length&&r.independentStockCapTests.every(t=>t.finalBlockedStock===b.outputCaps[t.blockedProduct]&&Object.entries(t.outputsPerMinute).every(([item,rate])=>rate>=floor(item))),
  // Full-stack caps: each blocked product must reach its cap before the measurement window of the other four starts
  // (selective settle), and every product within the closed hold, so the others are always measured with it stocked.
  capsReachedInTime:protocol.blocked>0&&b.products.every(n=>r.recovery?.capReachedMinute?.[n]<=protocol.blocked/3600)&&(protocol.phases===0||r.independentStockCapTests.every(t=>t.capReachedMinute<=protocol.phaseSettle/3600)),
 };
 // Two-speed clock: with saturated entrances the measured rates must be the boosted ones.
 const gate=b.productionClock?.supplyGate;
 if(gate&&!supply)checks.clockBoostedWhenSaturated=r.supplyGateSamples?.samples>0&&r.supplyGateSamples.boosted>=0.9*r.supplyGateSamples.samples;
 // Supply-limited run: the harness never fed an entrance more than its stated multiple.
 if(supply){
  const within=(p,kind)=>{const k=supply.items?.[p.item]??supply[kind];if(k===undefined)return true;const port=[...b.inputs,...b.fluids].find(x=>x.item===p.item);return p.acceptedDuringMeasurement/(protocol.measure/3600)<=port.perMinute*k*1.001+0.05;};
  checks.fedWithinStatedSupply=r.inputs.every(p=>within(p,'belt'))&&r.fluids.every(p=>within(p,'fluid'));
 }
 r.checks=checks;r.passed=Object.values(checks).every(Boolean);
}
report.passed=report.builds.every(b=>b.passed);
const target=explore?(process.env.RE_REPORT||'.cache/'+id+'/explore-report.json'):source+(panelSupply?'/panel-supply-report.json':'/native-report.json');
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.writeFile(target,JSON.stringify(report,null,2)+'\n');
const r=report.builds[0];
console.log(JSON.stringify({passed:report.passed,checks:r.checks,capReached:{closed:r.recovery?.capReachedMinute,selective:r.independentStockCapTests?.map(t=>t.blockedProduct+':'+t.capReachedMinute)},steady:r.outputsPerMinute,recovery:r.recovery?.outputsPerMinute,pause:r.recovery?.collectionPauseStock?.map(p=>p.item+':'+p.count),selective:r.independentStockCapTests?.map(t=>({blocked:t.blockedProduct,stock:t.finalBlockedStock,rates:t.outputsPerMinute})),ringMax:r.loopSamples,idle:r.machines.filter(m=>!m.measuredCrafts).map(m=>m.recipe)},null,1));
process.exitCode=report.passed?0:1;
