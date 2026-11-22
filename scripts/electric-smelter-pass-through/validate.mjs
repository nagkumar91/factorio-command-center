// Native qualification for electric-smelter-pass-through, one module variant per run.
// Runs the Steam Factorio 2.1.24 binary headless with a private config and mod directory under
// .cache/electric-smelter-pass-through/ (never the user's game data) and writes the variant's native-report.json
// (blueprint-sources/electric-smelter-pass-through/ for the main string, .../versions/<variant>/ for the others)
// for the exact blueprint SHA-256.
// Usage: node scripts/electric-smelter-pass-through/validate.mjs [--variant no-modules|efficiency|productivity-one|...]
// The main variant runs the full protocol (seven scenarios plus two informational power runs with efficiency
// modules 2 and 3 swapped in by script); the other variants run a single copy on iron ore with a blocked plate
// exit and recovery, two copies at the pitch, and a single copy on copper ore.
// SMELTER_EXPLORE=1 runs short phases (SMELTER_MINUTES, default 3 each) and writes
// .cache/electric-smelter-pass-through/explore-<variant>.json; it never touches a native report.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';
import {MAIN_VARIANT} from './shared.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const id='electric-smelter-pass-through',variant=flag('variant',MAIN_VARIANT),main=variant===MAIN_VARIANT;
const source='blueprint-sources/'+id+(main?'':'/versions/'+variant),explore=process.env.SMELTER_EXPLORE==='1';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes=await fs.readFile(rawPath);
const [m]=JSON.parse(await fs.readFile(source+'/manifest.json','utf8'));
if(m.variant!==variant)throw Error('manifest is not variant '+variant);
const code=(await fs.readFile(source+'/'+m.file,'utf8')).trim();
if(m.prototypeSha256!==sha(bytes))throw Error('Prototype SHA mismatch');
if(sha(code)!==m.blueprintSha256)throw Error('Code SHA mismatch');
const bp=decodeBlueprint(code).blueprint;
const minimum={warmupMinutes:10,measureMinutes:10,blockedMinutes:10,settleMinutes:3,recoveryMinutes:10};
if(!explore)for(const [k,v] of Object.entries(minimum))if(!(m.protocol[k]>=v))throw Error('protocol '+k+' below the minimum');
const minutes=explore?Object.fromEntries(Object.keys(minimum).map(k=>[k,Number(process.env.SMELTER_MINUTES??3)])):{...m.protocol};
const ticks=Object.fromEntries(Object.entries(minutes).map(([k,v])=>[k.replace('Minutes',''),Math.round(v*3600)]));
const total=ticks.warmup+ticks.measure+ticks.blocked+ticks.settle+ticks.recovery;
const port=kind=>m.ports.find(p=>p.kind===kind);
const FULL=[
 {name:'single-iron-red',copies:1,feed:'red',ore:'iron-ore'},
 {name:'pair-iron-red',copies:2,feed:'red',ore:'iron-ore'},
 {name:'pair-iron-yellow',copies:2,feed:'yellow',ore:'iron-ore'},
 {name:'pair-iron-red-copy1-plates-blocked',copies:2,feed:'red',ore:'iron-ore',blockPlates:true},
 {name:'single-iron-red-east-unconnected',copies:1,feed:'red',ore:'iron-ore',east:'unconnected'},
 {name:'single-copper-red',copies:1,feed:'red',ore:'copper-ore'},
 {name:'single-stone-red',copies:1,feed:'red',ore:'stone',informational:true},
 {name:'single-iron-red-efficiency-two-power',copies:1,feed:'red',ore:'iron-ore',moduleOverride:'efficiency-module-2',informational:true},
 {name:'single-iron-red-efficiency-three-power',copies:1,feed:'red',ore:'iron-ore',moduleOverride:'efficiency-module-3',informational:true},
];
const VARIANT_SET=[
 {name:'single-iron-red-plates-blocked',copies:1,feed:'red',ore:'iron-ore',blockPlates:true},
 {name:'pair-iron-red',copies:2,feed:'red',ore:'iron-ore'},
 {name:'single-copper-red',copies:1,feed:'red',ore:'copper-ore'},
];
const SCENARIOS=main?FULL:VARIANT_SET;
const payload={code,blueprintSha256:m.blueprintSha256,pitch:m.chaining.pitch,entrance:port('input').tile,exit:port('output').tile,exitEntity:port('output').entity,forward:port('forward').tile,powerEntity:port('power').entity,
 entities:bp.entities.map(e=>({entity_number:e.entity_number,name:e.name,position:e.position,direction:e.direction,output_priority:e.output_priority,items:e.items})),
 scenarios:SCENARIOS,...ticks};
const root=path.resolve(process.env.SMELTER_RUN_ROOT||'.cache/'+id+'/native-'+variant+'-'+Date.now()),app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/smelter_pass_through_test';
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','smelter_pass_through_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'smelter_pass_through_test',version:'1.0.0',title:'Private electric smelter qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile('scripts/'+id+'/control.lua',mod+'/control.lua');
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify(payload)+']====]');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,file){try{const r=await run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600000,maxBuffer:64e6});await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+(e.stdout||'').slice(-2400));}}
console.log(root);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(total+1),'--benchmark-runs','1'],'benchmark.log');
const result=JSON.parse(await fs.readFile(root+'/script-output/result.json','utf8'));

// ---------- pass checks against this variant's computed rates ----------
const T=m.expected.platesPerMinute,O=m.expected.orePerMinute,full=T*.98,red=1800;
const plateOf={'iron-ore':'iron-plate','copper-ore':'copper-plate',stone:'stone-brick'};
const drain=(phase,kind,copy)=>phase?.drains?.find(d=>d.kind===kind&&d.copy===copy);
const rate=(phase,kind,copy,item)=>drain(phase,kind,copy)?.perMinute?.[item]??0;
const only=(phase,kind,copy,item)=>Object.keys(drain(phase,kind,copy)?.items||{}).every(k=>k===item);
// Every furnace within 2% of the mean crafts of its copy (productivity bonus plates are not crafts).
const even=(phase,copy)=>{const f=phase?.furnaces?.[copy-1];return !!f&&f.furnaces===24&&f.meanCrafts>0&&f.minCrafts>=f.meanCrafts*.98&&f.maxCrafts<=f.meanCrafts*1.02+1;};
const wantModules=n=>{const want={};for(const e of bp.entities)for(const r of e.items||[])want[r.id.name]=(want[r.id.name]||0)+r.items.in_inventory.length*n;return want;};
const modulesOk=(s,sc)=>{const want=sc.moduleOverride?{[sc.moduleOverride]:48*sc.copies}:wantModules(sc.copies),got={};for(const c of s.measure?.modulesInFurnaces||[])for(const [k,v] of Object.entries(c))got[k]=(got[k]||0)+v;return JSON.stringify(Object.entries(got).sort())===JSON.stringify(Object.entries(want).sort());};
function checks(s,sc){
 const plate=plateOf[sc.ore],ms=s.measure,c={finished:!!s.finished,powered:!!s.powered&&!!s.oneElectricNetwork,modulesAsRequested:modulesOk(s,sc)};
 const forwardOk=(phase,copy)=>rate(phase,'east',copy,sc.ore)>=(red-O*sc.copies)*.98-2;
 if(['single-iron-red','single-copper-red'].includes(sc.name)){
  Object.assign(c,{fullRate:rate(ms,'plates',1,plate)>=full,everyFurnaceEven:even(ms,1),surplusOreEast:forwardOk(ms,1),onlyPlatesOnPlateBelt:only(ms,'plates',1,plate),onlyOreOnEastExit:only(ms,'east',1,sc.ore)});
  if(!main&&sc.name==='single-copper-red')c.copperStillFullLater=rate(s.recovery,'plates',1,plate)>=full;
 }else if(sc.name==='single-iron-red-plates-blocked'){
  Object.assign(c,{fullRate:rate(ms,'plates',1,plate)>=full,everyFurnaceEven:even(ms,1),surplusOreEast:forwardOk(ms,1),onlyPlatesOnPlateBelt:only(ms,'plates',1,plate),onlyOreOnEastExit:only(ms,'east',1,sc.ore),
   stoppedWhileBlocked:s.blocked?.copy1CraftsInLastMinute===0,oreAllForwardedInLastBlockedMinute:rate(s.blocked?.lastMinute,'east',1,sc.ore)>=red*.98-2,recoversToFull:rate(s.recovery,'plates',1,plate)>=full});
 }else if(sc.name==='pair-iron-red'){
  const second=Math.min(T,Math.max(0,red-O)*T/O);
  Object.assign(c,{copy1FullRate:rate(ms,'plates',1,plate)>=full,copy2GetsTheRest:rate(ms,'plates',2,plate)>=second*.98-2,everyFurnaceEven:even(ms,1)&&(second<T*.98||even(ms,2)),oneNetworkAcrossCopies:s.copperWiresBetweenCopies>=1,onlyPlates:only(ms,'plates',1,plate)&&only(ms,'plates',2,plate),onlyOreEast:only(ms,'east',2,sc.ore)});
 }else if(sc.name==='pair-iron-yellow'){
  Object.assign(c,{copy1FullRate:rate(ms,'plates',1,plate)>=full,copy1FullAfterwards:rate(s.recovery,'plates',1,plate)>=full,feedKeepsMoving:ms.fedPerMinute>=900*.98,copy2GetsTheRest:rate(ms,'plates',2,plate)+rate(ms,'east',2,sc.ore)<=ms.fedPerMinute-rate(ms,'plates',1,plate)+T*.02});
 }else if(sc.name==='pair-iron-red-copy1-plates-blocked'){
  const bl=s.blocked,rc=s.recovery;
  Object.assign(c,{bothFullBefore:rate(ms,'plates',1,plate)>=full&&rate(ms,'plates',2,plate)>=full,copy1StoppedWhileBlocked:bl?.copy1CraftsInLastMinute===0,copy2FullWhileBlocked:rate(bl,'plates',2,plate)>=full,copy1RecoversToFull:rate(rc,'plates',1,plate)>=full,copy2FullAfterRecovery:rate(rc,'plates',2,plate)>=full});
 }else if(sc.name==='single-iron-red-east-unconnected'){
  Object.assign(c,{fullRateWithEastUnconnected:rate(ms,'plates',1,plate)>=full,stillFullLater:rate(s.recovery,'plates',1,plate)>=full,everyFurnaceEven:even(ms,1)});
 }
 return c;
}
// Electric power drawn while working: the network's input statistics over the measured window (joules), single copy.
const powerKW=s=>{const d=s?.measure?.electricInputDelta;if(!d)return undefined;const total=Object.values(d).reduce((a,b)=>a+b,0);return Math.round(total/s.measure.electricInputSeconds/1000*10)/10;};
const powerByEntityKW=s=>{const d=s?.measure?.electricInputDelta||{};return Object.fromEntries(Object.entries(d).filter(([,v])=>v>0).map(([k,v])=>[k,Math.round(v/s.measure.electricInputSeconds/1000*10)/10]));};
const report={id,variant,label:m.label,gameVersion:'2.1.24',prototypeSha256:sha(bytes),blueprintSha256:m.blueprintSha256,harnessSha256:sha(await fs.readFile(mod+'/control.lua')),validatorSha256:sha(await fs.readFile('scripts/'+id+'/validate.mjs')),configurationSha256:sha(await fs.readFile(mod+'/payload.lua')),protocolMinutes:minutes,createdAt:new Date().toISOString(),runRoot:path.relative(process.cwd(),root),
 policies:{feed:result.feedPolicy,research:result.researchPolicy,modules:result.modulePolicy,power:result.powerPolicy+' Power drawn is the electric network input statistics over the measured window of a single copy (furnaces, inserters and roboports).'},
 passBar:{platesPerMinute:full,expectedPlatesPerMinute:T,expectedOrePerMinute:O,furnaceShare:'every furnace within 2% of the mean crafts of its copy'},
 footprint:m.footprint,construction:m.construction,entityCount:m.entityCount,modules:m.modules,
 scenarios:result.scenarios.map((s,i)=>{const sc=SCENARIOS[i],c=checks(s,sc);return {...s,informational:!!sc.informational,powerKW:powerKW(s),powerByEntityKW:powerByEntityKW(s),checks:c,passed:sc.informational?undefined:Object.values(c).every(Boolean)};})};
const qualifying=report.scenarios.filter(s=>!s.informational),find=name=>report.scenarios.find(s=>s.name===name);
const ironRun=find(main?'single-iron-red':'single-iron-red-plates-blocked'),copperRun=find('single-copper-red'),recoveryRun=find(main?'pair-iron-red-copy1-plates-blocked':'single-iron-red-plates-blocked');
const pm=(s,phase,kind,copy,item)=>rate(s?.[phase],kind,copy,item);
const consumed=(s,ore)=>Math.round((s.measure.fedPerMinute-pm(s,'measure','east',1,ore))*10)/10;
report.builds=[{id,variant,blueprintSha256:m.blueprintSha256,passed:qualifying.every(s=>s.passed),
 outputsPerMinute:{'iron-plate':pm(ironRun,'measure','plates',1,'iron-plate'),'copper-plate':pm(copperRun,'measure','plates',1,'copper-plate')},
 recovery:{outputsPerMinute:{'iron-plate':pm(recoveryRun,'recovery','plates',1,'iron-plate'),'copper-plate':pm(copperRun,'recovery','plates',1,'copper-plate')}},
 inputsPerMinute:{'iron-ore':consumed(ironRun,'iron-ore'),'copper-ore':consumed(copperRun,'copper-ore')},
 powerKW:powerKW(ironRun),
 summary:{ironPlatesPerMinute:pm(ironRun,'measure','plates',1,'iron-plate'),copperPlatesPerMinute:pm(copperRun,'measure','plates',1,'copper-plate'),ironOrePerMinute:consumed(ironRun,'iron-ore'),copperOrePerMinute:consumed(copperRun,'copper-ore'),
  forwardedFromFullRedBeltPerMinute:pm(ironRun,'measure','east',1,'iron-ore'),powerKW:powerKW(ironRun),powerByEntityKW:powerByEntityKW(ironRun),
  secondCopyOnRedBeltPerMinute:pm(find('pair-iron-red'),'measure','plates',2,'iron-plate'),recoveryPerMinute:pm(recoveryRun,'recovery','plates',1,'iron-plate'),
  ...(main?{stoneBricksPerMinute:pm(find('single-stone-red'),'measure','plates',1,'stone-brick'),secondCopyWhileFirstBlockedPerMinute:pm(find('pair-iron-red-copy1-plates-blocked'),'blocked','plates',2,'iron-plate'),
   efficiencyTwoPowerKW:find('single-iron-red-efficiency-two-power').powerKW,efficiencyThreePowerKW:find('single-iron-red-efficiency-three-power').powerKW,
   efficiencyTwoPlatesPerMinute:pm(find('single-iron-red-efficiency-two-power'),'measure','plates',1,'iron-plate'),efficiencyThreePlatesPerMinute:pm(find('single-iron-red-efficiency-three-power'),'measure','plates',1,'iron-plate')}:{}),
  scenariosPassed:qualifying.filter(s=>s.passed).length,scenarios:qualifying.length}}];
report.passed=report.builds[0].passed;
const out=explore?'.cache/'+id+'/explore-'+variant+'.json':source+'/native-report.json';
if(explore)report.short=true;
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,1)+'\n');
for(const s of report.scenarios)console.log(s.name,s.passed??'info',JSON.stringify(Object.fromEntries(Object.entries(s.checks).filter(([,v])=>!v))),'measure',JSON.stringify(s.measure?.drains?.map(d=>[d.kind,d.copy,d.perMinute])),'fed',s.measure?.fedPerMinute,'kW',s.powerKW,'furn',JSON.stringify(s.measure?.furnaces?.map(f=>[f.minCrafts,f.maxCrafts])));
console.log(variant,'passed',report.passed,JSON.stringify(report.builds[0].summary),'report',out);
process.exitCode=report.passed?0:1;
