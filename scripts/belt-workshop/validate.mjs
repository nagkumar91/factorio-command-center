// Native qualification of the on-demand belt workshop: the inserter workshop's protocol for six chests.
//
//   node scripts/belt-workshop/validate.mjs
//
// Runs the installed Factorio 2.1.24 binary headless with a private configuration, mod folder, saves and
// logs under the git-ignored .cache/belt-workshop/. Probes beside the qualifying protocol:
// BELT_SUPPLY=stated offers each entrance exactly the manifest's requiredInputsPerMinute (or a JSON object of
// rates) instead of a full belt; BELT_BLOCK_MINUTES holds the full chests longer than the standard five
// minutes. A probe run writes probe-<BELT_PROBE_NAME>-report.json and never touches native-report.json or the
// manifest: only the standard protocol qualifies a blueprint. BELT_SOURCE validates a trial folder instead.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createHash} from 'node:crypto';import {decodeBlueprint} from '../blueprints.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const source=process.env.BELT_SOURCE||'blueprint-sources/belt-workshop';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json',bytes=await fs.readFile(rawPath),raw=JSON.parse(bytes);
const builds=JSON.parse(await fs.readFile(source+'/manifest.json'));
for(const b of builds){
 b.code=(await fs.readFile(source+'/'+b.file,'utf8')).trim();if(sha(b.code)!==b.blueprintSha256)throw Error('Code SHA mismatch '+b.id);
 b.entities=decodeBlueprint(b.code).blueprint.entities;
 b.recipeIngredients=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].ingredients]));
 b.recipeOutputs=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].results]));
}
const minutes=(name,fallback)=>Number(process.env[name]||fallback)*3600;
const warmup=minutes('BELT_WARMUP',10),measure=minutes('BELT_MEASURE',10);
const recovery={pauseTicks:minutes('BELT_BLOCK_MINUTES',5),settleTicks:18000,measureTicks:18000},recoveryTicks=recovery.pauseTicks+recovery.settleTicks+recovery.measureTicks;
// Five minutes for each chest's refill after half a stack is withdrawn.
const demandTicks=Math.max(...builds.map(b=>b.outputs.length))*18000;
const supplyPerMinute=!process.env.BELT_SUPPLY?undefined:process.env.BELT_SUPPLY==='stated'?builds[0].requiredInputsPerMinute:JSON.parse(process.env.BELT_SUPPLY);
const standard=warmup===36000&&measure===36000&&recovery.pauseTicks===18000&&!supplyPerMinute;
const reportFile=standard?'native-report.json':'probe-'+(process.env.BELT_PROBE_NAME||'run')+'-report.json';
const root=path.resolve(process.env.BELT_RUN_ROOT||'.cache/belt-workshop/native-'+Date.now()),app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/belt_workshop_test';
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','belt_workshop_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'belt_workshop_test',version:'1.0.0',title:'Private belt workshop qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile('scripts/belt-workshop/control.lua',mod+'/control.lua');
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({builds,warmup,measure,recovery,demandTicks,supplyPerMinute,debugTopology:process.env.BELT_DEBUG==='1'})+']====]');
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,file){
 try{
  const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:3600000,maxBuffer:8e6});
  if(process.platform==='darwin'&&task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});
  const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);
 }catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+(e.stdout||'').slice(-2400));}
}
console.log(root);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(warmup+measure+recoveryTicks+demandTicks+1),'--benchmark-runs','1'],'benchmark.log');
// Saves are large and only needed while the run lasts.
await fs.rm(root+'/test.zip',{force:true});

const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
Object.assign(report,{gameVersion:'2.1.24',relativeTargetTolerance:.05,nativeCommand:'node scripts/belt-workshop/validate.mjs',prototypeSha256:sha(bytes),
 harnessSha256:sha(await fs.readFile(mod+'/control.lua')),validatorSha256:sha(await fs.readFile('scripts/belt-workshop/validate.mjs')),configurationSha256:sha(await fs.readFile(mod+'/payload.lua')),
 warmupMinutes:warmup/3600,measurementMinutes:measure/3600,createdAt:new Date().toISOString()});
for(const r of report.builds){
 const b=builds.find(b=>b.id===r.id);delete r.transport;delete r.debugArms;delete r.buffers;r.blueprintSha256=b.blueprintSha256;r.fluids=[];
 // At rest every item on the ring is within its cap. Each arm that adds an item checks the cap before it
 // swings, so several arms released at once may overshoot by at most one hand of two each.
 const rest=r.recovery?.restAtPause,[loop]=b.loopControl;
 if(rest){rest.overCap=[];for(const [name,count] of Object.entries(rest.ringStock)){
  const adders=b.entities.filter(e=>loop.controlled.includes(e.entity_number)&&e.control_behavior?.circuit_condition?.first_signal?.name===name&&e.control_behavior.circuit_condition.comparator==='<').length;
  const bound=loop.limits[name]===undefined?0:loop.limits[name]-1+2*adders;
  if(count>bound)rest.overCap.push({item:name,count,cap:loop.limits[name],bound});
 }}
 r.checks={
  refills:r.stockReplenishment?.length===b.outputs.length&&r.stockReplenishment.every(s=>s.restored===b.outputCaps[s.item]&&s.newCrafts>0&&s.otherProvidersStayedFull),
  bulkHand:r.bulkInserters.every(a=>a.observedMaxHand<=2)&&r.bulkInserters.some(a=>a.observedMaxHand===2),
  everyMachineCrafted:r.machines.every(m=>m.measuredCrafts>0),
  powerAndApproaches:r.powered&&r.externalApproachesClear&&r.exactRecipeChecks>0&&r.stockGateChecks>0,
  inputsProductive:r.inputs.every(p=>p.productiveRoute?.length&&p.acceptedDuringMeasurement>0),
  steady:b.products.every(n=>r.outputsPerMinute[n]>=b.targets[n]*.95),
  recovery:b.products.every(n=>r.recovery.outputsPerMinute[n]>=b.targets[n]*.95),
  everyChestCollected:r.outputPorts.every(p=>p.collectedDuringMeasurement>0),
  chestsAtCapWhileHeld:r.recovery.collectionPauseStock?.length===b.outputs.length&&r.recovery.collectionPauseStock.every(s=>s.count===s.capacity),
  restWhileHeld:!!rest&&rest.machines.every(m=>m.craftsInLastMinute===0)&&rest.overCap.length===0,
 };
 r.passed=Object.values(r.checks).every(Boolean);
}
report.passed=report.builds.every(b=>b.passed);report.protocol=standard?'standard':'probe';
await fs.writeFile(source+'/'+reportFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.builds.map(r=>({id:r.id,passed:r.passed,checks:r.checks,rates:r.outputsPerMinute,recovery:r.recovery.outputsPerMinute,drawn:r.consumptionPerMinute,idle:r.machines.filter(m=>!m.measuredCrafts).map(m=>m.recipe)})),null,2));
process.exitCode=report.passed?0:1;
if(report.passed&&standard){const manifest=JSON.parse(await fs.readFile(source+'/manifest.json'));for(const b of manifest){b.status='native-verified-declared-inputs';b.nativeReport='native-report.json';}await fs.writeFile(source+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');}
