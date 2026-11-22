// Native qualification for oil-products (rate class). Runs every scenario of manifest.scenarios as its own copy of
// the exact committed string, side by side in one headless Factorio 2.1.24 game with a private config and mod
// directory under .cache/oil-products/ (never the user's game data), and writes <source>/native-report.json.
// OIL_VARIANT=east-wing-four-substations validates the screened alternative in candidates/ instead.
// OIL_EXPLORE=1 shortens every phase (OIL_MINUTES="warm,measure,blocked,settle,recovery", default 10,10,10,5,10) and
// writes .cache/oil-products/explore-report.json with short: true; it never touches native-report.json.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';
import {ID,PROTOTYPE,design} from './shared.mjs';
const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const variant=process.env.OIL_VARIANT||'east-wing',explore=process.env.OIL_EXPLORE==='1';
const source='blueprint-sources/'+ID+(variant==='east-wing'?'':'/candidates/'+variant);
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes=await fs.readFile(rawPath);if(sha(bytes)!==PROTOTYPE.sha256)throw Error('prototype dump SHA-256 mismatch');
const [m]=JSON.parse(await fs.readFile(source+'/manifest.json'));
const code=(await fs.readFile(source+'/'+m.file,'utf8')).trim();
if(sha(code)!==m.blueprintSha256)throw Error('blueprint SHA-256 mismatch');
const entities=decodeBlueprint(code).blueprint.entities;
const minimum={warmupMinutes:15,measureMinutes:30,blockedMinutes:30,settleMinutes:5,recoveryMinutes:30};
if(!explore)for(const [k,v] of Object.entries(minimum))if(!(m.protocol[k]>=v))throw Error('protocol '+k+' below the minimum');
const minutes=explore?Object.fromEntries(Object.keys(minimum).map((k,i)=>[k,Number((process.env.OIL_MINUTES||'10,10,10,5,10').split(',')[i])])):{...m.protocol};
const builds=m.scenarios.map(s=>({id:s.id,scenario:s.id,informational:!!s.informational,code,entities,footprint:m.footprint,ports:m.ports.filter(p=>p.kind!=='power'),
 inputs:m.inputs.map(p=>({item:p.item,entity:p.entity,perMinute:p.perMinute,transport:p.transport==='pipe'?'pipe':'belt'})),
 outputs:m.outputs.map(p=>({item:p.item,entity:p.entity,transport:p.transport==='pipe'?'pipe':'belt'})),powerEntity:m.powerEntity,
 control:m.control.map(({pump,tank,fluid,comparator,threshold})=>({pump,tank,fluid,comparator,threshold})),
 phases:s.phases.map(p=>({name:p.name,ticks:Math.round(minutes[p.minutes]*3600),feedScale:p.feedScale,feed:p.feed,draw:p.draw}))}));
const feedPolicy='Declared west entrances only, at the panel figures (scaled or overridden only where a scenario says so): fluids get perMinute/3600 per tick plus what they refused before (carry capped at one second of supply); the iron belt gets a credit of perMinute/3600 per tick (capped at 8), one plate per credit on alternating lanes. Nothing else is seeded.';
const drawPolicy='Declared outputs only, at the scenario figure: fluids remove perMinute/3600 per tick plus the unmet carry (capped at one second) from the outlet pipe; the sulfur belt is emptied every 4 ticks up to its credit. Once a second every outlet is checked for any other fluid (or, on the belt, any other item).';
const root=path.resolve(process.env.OIL_RUN_ROOT||'.cache/'+ID+'/native-'+variant+'-'+Date.now()),app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/oil_products_test';
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','oil_products_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'oil_products_test',version:'1.0.0',title:'Private oil-products qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile('scripts/'+ID+'/control.lua',mod+'/control.lua');
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify({builds,feedPolicy,drawPolicy})+']====]');
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
const total=Math.max(...builds.map(b=>b.phases.reduce((a,p)=>a+p.ticks,0)));
async function game(args,file){try{const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600000,maxBuffer:64e6});if(process.platform==='darwin'&&task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+file+'\n'+(e.stdout||'').slice(-2400));}}
console.log(root);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(total+1),'--benchmark-runs','1'],'benchmark.log');
const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
Object.assign(report,{gameVersion:'2.1.24',variant,prototypeSha256:PROTOTYPE.sha256,harnessSha256:sha(await fs.readFile(mod+'/control.lua')),dataHarnessSha256:sha(await fs.readFile(mod+'/data.lua')),
 validatorSha256:sha(await fs.readFile('scripts/'+ID+'/validate.mjs')),configurationSha256:sha(await fs.readFile(mod+'/payload.lua')),protocolMinutes:minutes,createdAt:new Date().toISOString(),runRoot:path.relative(process.cwd(),root)});
const D=design();
for(const r of report.builds){
 const b=builds.find(b=>b.id===r.id);r.blueprintSha256=m.blueprintSha256;r.informational=b.informational;
 r.checks=passChecks(r,b,m,D);r.passed=Object.values(r.checks).every(Boolean);
}
report.passed=report.builds.filter(r=>!r.informational).every(r=>r.passed);
/** Pass formula per scenario (task brief, sections 1-5); informational scenarios are reported but not required. */
export function passChecks(r,b,m,D){
 const ph=Object.fromEntries((r.phases||[]).map(p=>[p.name,p]));
 const at=(p,item,figure)=>(p?.drawnPerMinute?.[item]||0)>=figure*0.95;
 const T=m.targets,crafters=m.entityCount&&Object.values(m.machineCounts).reduce((a,n)=>a+n,0);
 const allCrafted=p=>(p?.machines||[]).length===crafters&&p.machines.every(x=>x.crafts>0);
 const clean=(r.phases||[]).every(p=>Object.keys(p.wrongFluidSeconds||{}).length===0&&Object.keys(p.wrongItemsOnSulfurExit||{}).length===0);
 const base={finished:!!r.finished,powered:!!r.powered,geometry:r.importedEntities===m.entityCount&&r.externalApproachesClear===true&&r.recipeChecks===crafters,
  tankControl:(r.controls||[]).length===2,noProductAtAWrongOutlet:clean};
 const main=['petroleum-gas','sulfuric-acid','lubricant','sulfur'];
 switch(b.scenario){
  case 'design':return {...base,ratesAtLeast95Percent:main.every(i=>at(ph.measure,i,T[i])),everyRefineryAndPlantWorking:allCrafted(ph.measure)};
  case 'acid-blocked':case 'lubricant-blocked':case 'sulfur-blocked':{const x=b.phases.find(p=>p.name==='blocked').draw;const blocked=Object.keys(x).find(k=>x[k]===0&&T[k]>0);
   return {...base,othersAtLeast95PercentWhileBlocked:main.filter(i=>i!==blocked).every(i=>at(ph.blocked,i,T[i])),recoveryAtLeast95Percent:main.every(i=>at(ph.recovery,i,T[i])),everyMachineWorkingInRecovery:allCrafted(ph.recovery)};}
  case 'gas-blocked':return {...base,acidLubricantSulfurContinueWhileBlocked:['sulfuric-acid','lubricant','sulfur'].every(i=>at(ph.blocked,i,T[i])),recoveryAtLeast95Percent:main.every(i=>at(ph.recovery,i,T[i])),everyMachineWorkingInRecovery:allCrafted(ph.recovery)};
  case 'light-oil-660':return {...base,lightOilAtLeast95Percent:at(ph.measure,'light-oil',660),othersAtLeast95Percent:['sulfuric-acid','lubricant','sulfur'].every(i=>at(ph.measure,i,T[i])),gasAtLeast95PercentOfComputed:at(ph.measure,'petroleum-gas',D.lightOutlet.gasExport),everyRefineryAndPlantWorking:allCrafted(ph.measure)};
  case 'feed-80':{const e=D.feed80.outputs;return {...base,noJamEveryMachineWorking:allCrafted(ph.measure),outputsAtLeast95PercentOfComputed:main.every(i=>at(ph.measure,i,e[i]))};}
  default:return {...base,finishedMeasure:!!ph.measure};
 }
}
const target=explore?'.cache/'+ID+'/explore-report.json':source+'/native-report.json';
if(explore)report.short=true;
await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(report,null,1)+'\n');
const r1=v=>Math.round(v*10)/10;
for(const r of report.builds){console.log(r.id.padEnd(18),r.passed?'pass':'FAIL',Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k).join(' '));
 for(const p of r.phases)console.log('   ',p.name.padEnd(9),JSON.stringify(Object.fromEntries(Object.entries(p.drawnPerMinute).map(([k,v])=>[k,r1(v)]))),'fed',JSON.stringify(Object.fromEntries(Object.entries(p.fedPerMinute).map(([k,v])=>[k,r1(v)]))));}
console.log('report: '+target,'passed',report.passed);
process.exitCode=report.passed?0:1;
