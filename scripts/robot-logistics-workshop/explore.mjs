// Exploration runner for the robot logistics workshop. It never writes blueprint-sources and is not
// the published protocol: it runs a patched copy of control.lua that can
//   - feed each belt entrance at a multiple of its panel figure (RLW_SUPPLY=1 means exactly the panels;
//     unset keeps the published saturating feed), fluids at the same multiple,
//   - hold collection closed for longer than the published 5 minutes (RLW_PAUSE_MINUTES),
//   - keep the harness's belt and arm snapshot at the end of the measured window (RLW_DEBUG=1).
// Everything else (import checks, phases, measurements, pass formula) is the published harness.
//   RLW_SUPPLY=1 node scripts/robot-logistics-workshop/explore.mjs <source folder> [run name]
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const source=process.argv[2]||'blueprint-sources/robot-logistics-workshop',name=process.argv[3]||'explore';
const supply=process.env.RLW_SUPPLY===undefined?null:Number(process.env.RLW_SUPPLY),pauseMinutes=Number(process.env.RLW_PAUSE_MINUTES||5);
const backlog=Number(process.env.RLW_BACKLOG||100); // items a real supply belt could hold waiting at the entrance
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes=await fs.readFile(rawPath),raw=JSON.parse(bytes);
const builds=JSON.parse(await fs.readFile(source+'/manifest.json'));
for(const b of builds){
 b.code=(await fs.readFile(source+'/'+b.file,'utf8')).trim();
 if(sha(b.code)!==b.blueprintSha256)throw Error('Code SHA mismatch '+b.id);
 b.entities=decodeBlueprint(b.code).blueprint.entities;
 b.recipeIngredients=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].ingredients]));
 b.recipeOutputs=Object.fromEntries(Object.keys(b.machineCounts).map(n=>[n,raw.recipe[n].results]));
 if(supply!==null)for(const p of [...b.inputs,...b.fluids])p.feedPerTick=p.perMinute*supply/3600;
}
const warmup=Number(process.env.RGBY_WARMUP||15)*3600,measure=Number(process.env.RGBY_MEASURE||30)*3600;
const recovery={pauseTicks:pauseMinutes*3600,settleTicks:18000,measureTicks:36000},recoveryTotal=recovery.pauseTicks+recovery.settleTicks+recovery.measureTicks;
let lua=await fs.readFile('scripts/robot-logistics-workshop/control.lua','utf8');
const swap=(from,to,all=false)=>{if(!lua.includes(from))throw Error('harness text changed: '+from.slice(0,60));lua=all?lua.split(from).join(to):lua.replace(from,to);};
if(supply!==null){
 swap(`local n=t.entities[p.entity].insert_fluid{name=p.item,amount=1000}`,`local n=t.entities[p.entity].insert_fluid{name=p.item,amount=p.feedPerTick}`);
 swap(`  if game.tick%4==0 then for i,p in ipairs(b.inputs)do
   local belt=t.entities[p.entity]
   for lane=1,2 do if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
    t.fed[i]=(t.fed[i]or 0)+1
    if game.tick>payload.warmup then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
   end end
  end end`,`  for i,p in ipairs(b.inputs)do
   local belt=t.entities[p.entity];t.credit=t.credit or {};t.credit[i]=math.min((t.credit[i]or 0)+p.feedPerTick,${backlog})
   local lane=1+game.tick%2
   for attempt=1,2 do if t.credit[i]>=1 and belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
    t.credit[i]=t.credit[i]-1;t.fed[i]=(t.fed[i]or 0)+1
    if game.tick>payload.warmup and game.tick<=payload.warmup+payload.measure then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
   end lane=3-lane end
  end`);
}
if(recoveryTotal!==72000)swap('72000',String(recoveryTotal),true);
const root=path.resolve('.cache/robot-logistics-workshop/'+name+'-run'),app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/rgby_test';
await fs.rm(root,{recursive:true,force:true});await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','rgby_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'rgby_test',version:'1.0.0',title:'Private workshop exploration',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.writeFile(mod+'/control.lua',lua);await fs.writeFile(mod+'/data.lua','-- no prototypes added\n');
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({builds,warmup,measure,recovery,debugTopology:process.env.RLW_DEBUG==='1'})+']====]');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,file){try{const r=await run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:1800000,maxBuffer:8e6});await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+(e.stdout||'').slice(-2400));}}
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(warmup+measure+recoveryTotal+270000+1),'--benchmark-runs','1'],'benchmark.log');
const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
report.exploration={supplyFactor:supply,pauseMinutes,backlog,note:'patched harness, not the published protocol'};report.warmupMinutes=warmup/3600;report.measurementMinutes=measure/3600;
for(const r of report.builds){
 const b=builds.find(b=>b.id===r.id);r.blueprintSha256=b.blueprintSha256;r.fluids=Array.isArray(r.fluids)?r.fluids:[];
 const floors=rates=>b.products.filter(n=>!(rates[n]>=b.targets[n]*.95));
 r.explorationChecks={steadyBelowFloor:floors(r.outputsPerMinute),recoveryBelowFloor:floors(r.recovery.outputsPerMinute),closedCapsExact:r.recovery.collectionPauseStock.every(p=>p.count===p.capacity),
  selectiveFailures:(r.independentStockCapTests||[]).filter(p=>p.finalBlockedStock!==b.outputCaps[p.blockedProduct]||Object.entries(p.outputsPerMinute).some(([item,rate])=>rate<b.targets[item]*.95)).map(p=>p.blockedProduct),
  idleMachines:r.machines.filter(m=>!m.measuredCrafts).map(m=>m.recipe)};
 const c=r.explorationChecks;r.passed=!c.steadyBelowFloor.length&&!c.recoveryBelowFloor.length&&c.closedCapsExact&&!c.selectiveFailures.length&&!c.idleMachines.length;
}
report.passed=report.builds.every(b=>b.passed);
const out='.cache/robot-logistics-workshop/'+name+'-report.json';await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');await fs.rm(root+'/test.zip',{force:true});
console.log(out,JSON.stringify(report.exploration),JSON.stringify(report.builds[0].explorationChecks));
