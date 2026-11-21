// Native qualification for white-platform and white-pack-receiver: one end-to-end run (a real platform from a starter
// pack in Nauvis orbit, the receiver on Nauvis, natural chunks, no scripted transfer) and one rocket-delivery check
// (a real silo launches the starter pack and the platform's request). Report and hash structure follow
// scripts/green-circuits/validate.mjs. The full protocol (phase lengths from the platform manifest's protocol) writes
// the same report to blueprint-sources/white-platform/native-report.json and blueprint-sources/white-pack-receiver/.
// SPACE_EXPLORE=1 runs shorter phases (WP_WARMUP, WP_MEASURE, WP_BLOCKED, WP_HOLD, WP_RECOVERY, WP_RECOVERY_MEASURED
// minutes; WP_SEED map seed; WP_SKIP_ROCKETS=1 skips the rocket check) and writes .cache/white-platform/explore-report.json
// with short: true; it never touches a native-report.json.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createHash} from 'node:crypto';import {decodeBlueprint} from '../blueprints.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const id='white-platform',receiverId='white-pack-receiver';
const source=process.env.WP_SOURCE||'blueprint-sources/'+id,receiverSource=process.env.WR_SOURCE||'blueprint-sources/'+receiverId;
const explore=process.env.SPACE_EXPLORE==='1';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json',bytes=await fs.readFile(rawPath);
const minimum={warmupMinutes:60,measureMinutes:120,blockedMinutes:30,recoveryMinutes:60};
async function load(dir){const [m]=JSON.parse(await fs.readFile(dir+'/manifest.json'));m.code=(await fs.readFile(dir+'/'+m.file,'utf8')).trim();
 if(m.prototypeSha256!==sha(bytes))throw Error('Prototype SHA mismatch '+m.id);if(sha(m.code)!==m.blueprintSha256)throw Error('Code SHA mismatch '+m.id);m.bp=decodeBlueprint(m.code).blueprint;return m;}
const platform=await load(source),receiver=await load(receiverSource);
if(!explore)for(const[k,v]of Object.entries(minimum))if(!(platform.protocol[k]>=v))throw Error(`protocol ${k} below the platform-class minimum`);
const protocol=platform.protocol;
const env=(k,d)=>Number(process.env[k]??d);
const minutes=explore?{...protocol,warmupMinutes:env('WP_WARMUP',10),measureMinutes:env('WP_MEASURE',20),blockedMinutes:env('WP_BLOCKED',0),holdMinutes:env('WP_HOLD',0),recoveryMinutes:env('WP_RECOVERY',0),recoveryMeasuredMinutes:env('WP_RECOVERY_MEASURED',0)}:{...protocol};
const tick=m=>Math.round(m*3600);
const ticks={buildLimit:tick(minutes.buildLimitMinutes),warmup:tick(minutes.warmupMinutes),measure:tick(minutes.measureMinutes),blocked:tick(minutes.blockedMinutes),hold:tick(minutes.holdMinutes),recovery:tick(minutes.recoveryMinutes),recoveryMeasured:tick(minutes.recoveryMeasuredMinutes),rocketLimit:tick(minutes.rocketDeliveryLimitMinutes)};
const seed=env('WP_SEED',12345);

// ---------- what the harness checks on the built platform: every entity by name and position ----------
const roleOf={};for(const [role,list] of Object.entries(platform.stockControl.armRoles))for(const n of list)roleOf[n]=role;
const gated=new Set(Object.values(platform.productionClock.gates).map(g=>g.arm));
const expected=platform.bp.entities.filter(e=>e.name!=='space-platform-hub').map(e=>{
 const x={entity:e.entity_number,name:e.name,x:e.position.x,y:e.position.y};
 if(['fast-inserter','crusher','asteroid-collector','decider-combinator','arithmetic-combinator'].includes(e.name))x.direction=e.direction??0;
 if(e.recipe)x.recipe=e.recipe;
 if(e.name==='fast-inserter'){x.role=roleOf[e.entity_number];if(e.use_filters)x.filter=e.filters[0].name;
  const c=e.control_behavior?.circuit_condition;if(c)x.cond={signal:c.first_signal.name,comparator:c.comparator??'<',constant:c.constant,network:gated.has(e.entity_number)?'gate':'hub'};}
 if(e.name==='asteroid-collector')x.role='collector-entity';
 if(e.name==='decider-combinator'){const d=e.control_behavior.decider_conditions;x.conditions=d.conditions.length;x.outputs=d.outputs.map(o=>(o.signal.type||'item')+':'+o.signal.name);x.conditionConstants=d.conditions.map(c=>c.constant);}
 if(e.name==='crusher'&&e.control_behavior?.set_recipe)x.setRecipe=true;
 if(e.name==='accumulator'&&e.control_behavior?.output_signal)x.readsCharge=e.control_behavior.output_signal.name;
 if(e.name==='constant-combinator')x.signals=Object.fromEntries(e.control_behavior.sections.sections[0].filters.map(f=>[(f.type||'item')+':'+f.name,f.count]));
 if(e.name==='arithmetic-combinator'){const a=e.control_behavior.arithmetic_conditions;x.arithmetic={operation:a.operation,secondConstant:a.second_constant,first:a.first_signal.name,output:a.output_signal.name};}
 return x;
});
// The collector arms carry role 'collector' (used to find each collector's arm); collectors themselves are found by name.
for(const x of expected)if(x.role==='collector-entity')delete x.role;
const roleByTag={[receiver.stockControl.pad]:'pad',[receiver.stockControl.arm]:'arm',[receiver.stockControl.chest]:'chest'};
const receiverExpected=receiver.bp.entities.map(e=>({entity:e.entity_number,name:e.name,x:e.position.x,y:e.position.y,direction:e.name==='fast-inserter'?e.direction:undefined,role:roleByTag[e.entity_number]||(e.name==='substation'?'substation':e.name)}));
const common={weights:platform.billOfMaterials.weightKg,platform:{code:platform.code,platformRequest:platform.billOfMaterials.platformRequest,foundationTiles:platform.foundationTiles,newFoundationTiles:platform.newFoundationTiles,entityCount:expected.length,expected},receiver:{code:receiver.code,expected:receiverExpected,bar:receiver.stockControl.bar,request:receiver.stockControl.padRequest},ticks,seed};

const runRoot=path.resolve(process.env.WP_RUN_ROOT||'.cache/'+id+'/native-'+Date.now());
const app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents');
async function game(root,args,file){try{const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600000,maxBuffer:64e6});if(process.platform==='darwin'&&task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+(e.stdout||'').slice(-2400));}}
const hashes={};
async function runMode(mode,benchmarkTicks){
 const root=runRoot+'/'+mode,mod=root+'/mods/white_platform_test';
 await fs.mkdir(mod,{recursive:true});
 await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','white_platform_test'].map(name=>({name,enabled:true}))}));
 await fs.writeFile(mod+'/info.json',JSON.stringify({name:'white_platform_test',version:'1.0.0',title:'Private white-platform qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
 await fs.copyFile('scripts/white-platform/control.lua',mod+'/control.lua');
 await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({mode,...common})+']====]');
 await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
 await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
 await fs.writeFile(root+'/map.json',JSON.stringify({seed,width:64,height:64,default_enable_all_autoplace_controls:false}));
 const version=(await run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods','--version'])).stdout;if(!/Version: 2\.1\.24 /.test(version))throw Error('Factorio 2.1.24 required: '+version.split('\n')[0]);
 await game(root,['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
 const t0=Date.now();await game(root,['--benchmark',root+'/test.zip','--benchmark-ticks',String(benchmarkTicks),'--benchmark-runs','1'],'benchmark.log');
 hashes[mode]={harness:sha(await fs.readFile(mod+'/control.lua')),data:sha(await fs.readFile(mod+'/data.lua')),payload:sha(await fs.readFile(mod+'/payload.lua'))};
 const result=JSON.parse(await fs.readFile(root+'/script-output/result.json'));result.wallSeconds=(Date.now()-t0)/1000;return result;
}
console.log(runRoot);
const endTicks=ticks.buildLimit+ticks.warmup+ticks.measure+ticks.blocked+ticks.recovery+120;
const skipRockets=explore&&process.env.WP_SKIP_ROCKETS==='1';
const [e2e,rockets]=await Promise.all([runMode('endtoend',endTicks),skipRockets?null:runMode('rockets',ticks.rocketLimit+120)]);

// ---------- derived measurements ----------
const mk=e2e.marks||{};const perMin=(a,b,k,mins)=>mk[a]&&mk[b]?(mk[b][k]-mk[a][k])/mins:null;
const posKey=(x,y)=>x+','+y;
const recipeAt=new Map(platform.machines.map(m=>{const e=platform.bp.entities[m.entity-1];return [posKey(e.position.x,e.position.y),m.recipe];}));
const machines=(mk.measured?.machines||[]).map((m,i)=>({name:m.name,recipe:recipeAt.get(posKey(m.x,m.y)),x:m.x,y:m.y,measuredCrafts:m.finished-(mk.warm?.machines?.[i]?.finished??0),craftsInHold:mk.blocked&&mk.holdStart?mk.blocked.machines[i].finished-mk.holdStart.machines[i].finished:null,recoveryCrafts:mk.recovered&&mk.recoveryMeasureStart?mk.recovered.machines[i].finished-mk.recoveryMeasureStart.machines[i].finished:null}));
const collectors=(mk.measured?.collectorDelivered||[]).map((v,i)=>({deliveredDuringMeasurement:v-(mk.warm?.collectorDelivered?.[i]??0)}));
const steady={collectedPerMinute:perMin('warm','measured','collected',minutes.measureMinutes),madePerMinute:perMin('warm','measured','made',minutes.measureMinutes),icePerMinute:perMin('warm','measured','madeIce',minutes.measureMinutes),orePerMinute:perMin('warm','measured','madeOre',minutes.measureMinutes),carbonPerMinute:perMin('warm','measured','madeCarbon',minutes.measureMinutes),platePerMinute:perMin('warm','measured','madePlate',minutes.measureMinutes)};
const recovery={minutes:minutes.recoveryMeasuredMinutes,collectedPerMinute:perMin('recoveryMeasureStart','recovered','collected',minutes.recoveryMeasuredMinutes),madePerMinute:perMin('recoveryMeasureStart','recovered','made',minutes.recoveryMeasuredMinutes)};
const blocked=mk.blocked?{chest:mk.blocked.chest,pad:mk.blocked.pad,hubPacks:mk.blocked.hub['space-science-pack']||0,chestMaxDuringBlocked:e2e.stocks?.chestMaxDuringBlocked,scienceCraftsInHold:machines.filter(m=>m.recipe==='space-science-pack').reduce((a,m)=>a+(m.craftsInHold??0),0)}:null;
const firstPodSecondsAfterBuild=e2e.firstPodTick!=null&&e2e.builtTick!=null?(e2e.firstPodTick-e2e.builtTick)/60:null;
const markList=Object.values(mk);
const loss={entityCounts:Object.fromEntries(Object.entries(mk).map(([k,v])=>[k,v.playerEntities])),cargoPodsOnPlatform:Object.fromEntries(Object.entries(mk).map(([k,v])=>[k,v.cargoPodsOnPlatform])),unexpectedEntities:Object.fromEntries(Object.entries(mk).map(([k,v])=>[k,v.unexpectedEntities])),damagedEntities:Math.max(0,...markList.map(m=>m.damagedEntities)),damagedTiles:Math.max(0,...markList.map(m=>m.damagedTiles)),asteroidsSeen:Math.max(e2e.asteroidsSeen??0,...markList.map(m=>m.asteroids)),chunksAfloat:Object.fromEntries(Object.entries(mk).map(([k,v])=>[k,v.chunksAfloat]))};
const floor=platform.targets['space-science-pack']*.95;
const rate=v=>v!=null&&v>=floor;
const caps=platform.stockControl.caps,ceilings=platform.stockControl.ceilings;
// Blocked and recovery checks apply whenever those phases ran (always in the full protocol).
const fullRun=minutes.blockedMinutes>0&&minutes.recoveryMeasuredMinutes>0;
const platformChecks={
 finished:!!e2e.finished&&!e2e.buildFailed,
 forceSetup:!!e2e.zeroProductivity&&!!e2e.weightsMatch&&e2e.force?.inserterStackBonus===0&&e2e.force?.bulkCapacityBonus===1,
 starterPlatform:!!e2e.start?.ok,
 onlyPlatformRequestInserted:!!e2e.insertComplete,
 ghostCounts:e2e.importResult===0&&!!e2e.ghosts?.ok,
 builtAsBlueprinted:!!e2e.build?.ok&&e2e.build.seconds<=minutes.buildLimitMinutes*60,
 steadyCollected:rate(steady.collectedPerMinute),
 steadyMade:rate(steady.madePerMinute),
 everyMachineCrafted:machines.length===Object.values(platform.machineCounts).reduce((a,n)=>a+n,0)&&machines.every(m=>m.measuredCrafts>0),
 everyCollectorDelivered:collectors.length===platform.collectors.length&&collectors.every(c=>c.deliveredDuringMeasurement>0),
 blockedHubAtCap:fullRun?blocked!=null&&blocked.hubPacks>=caps['space-science-pack']&&blocked.hubPacks<=ceilings['space-science-pack']:true,
 scienceStoppedInHold:fullRun?blocked!=null&&blocked.scienceCraftsInHold===0:true,
 stocksUnderCeilings:!!e2e.stocks&&Object.entries(ceilings).every(([n,c])=>(e2e.stocks.maximum[n]??0)<=c),
 freeSlots:!!e2e.stocks&&e2e.stocks.lowestFreeSlots>=protocol.minimumFreeSlots,
 recoveryRates:fullRun?rate(recovery.madePerMinute)&&rate(recovery.collectedPerMinute):true,
 noLowPower:e2e.power?.lowPowerTicks===0,
 noEntityLost:markList.length>0&&new Set(markList.map(m=>m.playerEntities)).size===1&&markList[0].playerEntities===expected.length+1&&markList.every(m=>Object.keys(m.unexpectedEntities||{}).length===0),
 noDamage:loss.damagedEntities===0&&loss.damagedTiles===0&&loss.asteroidsSeen===0,
 rocketDelivery:null,
};
let rocketDelivery=null;
if(rockets){
 const bill=platform.billOfMaterials,launches=rockets.launches||[];
 const construction=Object.keys(bill.platformRequest);
 rocketDelivery={launches,builtMinutes:rockets.builtMinutes,timedOut:!!rockets.timedOut,leftInChests:rockets.leftInChests,hubAfterBuild:rockets.hubAfterBuild,siloAutomaticRequestsDefault:rockets.siloAutomaticRequestsDefault,feedPolicy:rockets.feedPolicy,notes:rockets.notes,
  checks:{launches:launches.length===bill.totalRockets,starterPackFirst:launches.length>0&&JSON.stringify(launches[0].cargo)===JSON.stringify({'space-platform-starter-pack':1}),fullRockets:launches.slice(1).every(l=>l.weightKg===bill.rocketLiftKg),built:!!rockets.finished&&!rockets.timedOut&&rockets.builtTick!=null,kitChestsEmpty:!!rockets.leftInChests&&Object.keys(rockets.leftInChests).length===0,hubHoldsNoConstructionItem:!!rockets.hubAfterBuild&&construction.every(n=>!rockets.hubAfterBuild[n]),cargoMatchesRequest:(()=>{const sum={};for(const l of launches.slice(1))for(const[k,v]of Object.entries(l.cargo))sum[k]=(sum[k]||0)+v;return JSON.stringify(Object.keys(sum).sort().map(k=>[k,sum[k]]))===JSON.stringify(Object.keys(bill.platformRequest).sort().map(k=>[k,bill.platformRequest[k]]));})()}};
 rocketDelivery.passed=Object.values(rocketDelivery.checks).every(Boolean);
 platformChecks.rocketDelivery=rocketDelivery.passed;
}else platformChecks.rocketDelivery=false;
const rr=e2e.receiver||{};
const receiverChecks={
 finished:platformChecks.finished,
 importChecks:!!rr.importChecks&&rr.importResult===0&&['geometry','armStackOverride','chestBar','eastClear','padRequest','onePad','powered'].every(k=>rr.importChecks[k]===true),
 steadyCollected:rate(steady.collectedPerMinute),
 recoveryCollected:fullRun?rate(recovery.collectedPerMinute):true,
 blockedChestExact:fullRun?blocked!=null&&blocked.chest===receiver.outputCaps['space-science-pack']&&blocked.chestMaxDuringBlocked<=receiver.outputCaps['space-science-pack']:true,
 blockedPadFull:fullRun?blocked!=null&&blocked.pad>=receiver.stockControl.padRequest:true,
 firstPodInTime:firstPodSecondsAfterBuild!=null&&firstPodSecondsAfterBuild<=receiver.protocol.firstPodLimitMinutes*60,
 noScriptedTransfer:typeof e2e.feedPolicy==='string',
};
const platformBuild={id,blueprintSha256:platform.blueprintSha256,receiverBlueprintSha256:receiver.blueprintSha256,checks:platformChecks,passed:Object.values(platformChecks).every(Boolean),steady,recovery,blocked,build:e2e.build,ghosts:e2e.ghosts,start:e2e.start,inserted:e2e.inserted,machines,collectors,power:e2e.power,stocks:e2e.stocks,loss,firstPodSecondsAfterBuild,weights:e2e.weights,force:e2e.force,failures:e2e.failures};
const receiverBuild={id:receiverId,blueprintSha256:receiver.blueprintSha256,platformBlueprintSha256:platform.blueprintSha256,checks:receiverChecks,passed:Object.values(receiverChecks).every(Boolean),steady:{collectedPerMinute:steady.collectedPerMinute},recovery:{collectedPerMinute:recovery.collectedPerMinute,minutes:recovery.minutes},blocked:blocked&&{chest:blocked.chest,pad:blocked.pad,chestMaxDuringBlocked:blocked.chestMaxDuringBlocked},firstPodSecondsAfterBuild,receiver:rr,firstPods:(Array.isArray(e2e.pods)?e2e.pods:[]).slice(0,100)};
const report={
 gameVersion:'2.1.24',prototypeSha256:sha(bytes),harnessSha256:hashes.endtoend.harness,dataHarnessSha256:hashes.endtoend.data,validatorSha256:sha(await fs.readFile('scripts/white-platform/validate.mjs')),
 configurationSha256:sha(hashes.endtoend.payload+(hashes.rockets?.payload||'')),protocolMinutes:minutes,createdAt:new Date().toISOString(),runRoot:path.relative(process.cwd(),runRoot),seed,
 platform:'white-platform (real platform built from the blueprint string)',feedPolicy:e2e.feedPolicy,
 builds:[platformBuild,receiverBuild],rocketDelivery,
 series:e2e.series,wallSeconds:{endtoend:e2e.wallSeconds,rockets:rockets?.wallSeconds},
};
report.passed=report.builds.every(b=>b.passed);
const targets=explore?['.cache/'+id+'/explore-report.json']:[source+'/native-report.json',receiverSource+'/native-report.json'];
if(explore){report.short=true;report.source=source;}
for(const t of targets){await fs.mkdir(path.dirname(t),{recursive:true});await fs.writeFile(t,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:report.passed,platform:{failed:Object.entries(platformChecks).filter(([,v])=>!v).map(([k])=>k),steady,recovery,blocked,build:e2e.build&&{seconds:e2e.build.seconds,ok:e2e.build.ok,mismatches:e2e.build.mismatches},power:e2e.power,stocks:e2e.stocks,loss,firstPodSecondsAfterBuild,failures:e2e.failures,machines:machines.map(m=>m.recipe+'='+m.measuredCrafts+'/'+m.craftsInHold),collectors},receiver:{failed:Object.entries(receiverChecks).filter(([,v])=>!v).map(([k])=>k),importChecks:rr.importChecks,chestBarRaw:rr.chestBarRaw},rockets:rocketDelivery&&{passed:rocketDelivery.passed,checks:rocketDelivery.checks,builtMinutes:rocketDelivery.builtMinutes,launches:rocketDelivery.launches.map(l=>l.weightKg)},wall:report.wallSeconds},null,1));
console.log('report: '+targets.join(', '));
process.exitCode=report.passed?0:1;
