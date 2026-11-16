import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {decodeBlueprint} from '../blueprints.mjs';
const run=promisify(execFile),source='blueprint-sources/compact-expansion-workshop';
const root=path.resolve('.cache/compact-expansion-workshop/native-'+Date.now());await fs.mkdir(root+'/mods/early_loop_test',{recursive:true});
const app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents');
const binary=app+'/MacOS/factorio';const allBuilds=JSON.parse(await fs.readFile(source+'/manifest.json'));const builds=process.env.LOOP_IDS?allBuilds.filter(b=>process.env.LOOP_IDS.split(',').includes(b.id)):allBuilds;
if(process.env.SUPPLEMENTS==='1'){for(const b of [...builds].filter(b=>b.optionalInputs.length))builds.push({...b,id:b.id+'-supplemented',baseId:b.id,supplemented:true,inputs:[...b.inputs,...b.optionalInputs.map(p=>({...p,position:{x:p.x,y:p.y}}))]});}
for(const b of builds){b.code=(await fs.readFile(source+'/'+b.file,'utf8')).trim();b.entities=decodeBlueprint(b.code).blueprint.entities;}
const warmup=36000,measure=36000,recovery={pauseTicks:18000,settleTicks:18000,measureTicks:18000};
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','early_loop_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(root+'/mods/early_loop_test/info.json',JSON.stringify({name:'early_loop_test',version:'1.0.0',title:'Private controlled-loop test',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile('scripts/early-controlled-loops/control.lua',root+'/mods/early_loop_test/control.lua');
await fs.writeFile(root+'/mods/early_loop_test/payload.lua','return [====['+JSON.stringify({builds,warmup,measure,recovery})+']====]');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,name){try{const r=await run(binary,['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:300000,maxBuffer:8e6});await fs.writeFile(root+'/'+name,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+name,(e.stdout||'')+(e.stderr||''));throw Error(root+'/'+name+'\n'+(e.stdout||'').slice(-2500));}}
console.log(root);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(warmup+measure+Object.values(recovery).reduce((a,b)=>a+b,0)+1),'--benchmark-runs','1'],'benchmark.log');
const report=JSON.parse(await fs.readFile(root+'/script-output/result.json'));
for(const r of report.builds){r.blueprintSha256=builds.find(b=>b.id===r.id).blueprintSha256;const b=builds.find(b=>b.id===r.id);r.supplemented=!!b.supplemented;r.passed=r.powered&&Object.entries(b.minimumPerMinute||{}).every(([item,floor])=>(r.outputsPerMinute[item]||0)>=floor&&(r.recovery.outputsPerMinute[item]||0)>=floor)&&Object.values(r.outputsPerMinute).every(n=>n>0)&&Object.values(r.recovery.outputsPerMinute).every(n=>n>0)&&Object.keys(r.fullOutputFixture||{}).length===b.products.length&&(b.supplemented?r.inputs.filter(i=>b.optionalInputs.some(p=>p.item===i.item)).every(i=>i.productiveRoute?.length>0&&i.acceptedDuringMeasurement>0):((b.id==='ore-feeder'||b.supplier)?Object.keys(b.machineCounts).every(recipe=>r.machines.some(m=>m.recipe===recipe&&m.measuredCrafts>0)):r.machines.every(m=>m.measuredCrafts>0))&&r.inputs.every(i=>i.productiveRoute?.length>0));}
if(process.env.LOOP_IDS){let old;try{old=JSON.parse(await fs.readFile(source+'/native-report.json'));}catch{}for(const b of allBuilds.filter(b=>!builds.some(t=>t.id===b.id))){const retained=old?.builds.filter(r=>[b.id,b.id+'-supplemented'].includes(r.id)&&r.blueprintSha256===b.blueprintSha256)||[];if(!retained.length)throw Error('No matching evidence to retain for '+b.id);report.builds.push(...retained);}}report.passed=report.builds.every(b=>b.passed);report.gameVersion='2.1.24';report.warmupMinutes=10;report.measurementMinutes=10;report.createdAt=new Date().toISOString();
report.harnessSha256=createHash('sha256').update(await fs.readFile(root+'/mods/early_loop_test/control.lua')).digest('hex');report.configurationSha256=createHash('sha256').update(await fs.readFile(root+'/mods/early_loop_test/payload.lua')).digest('hex');report.harnessSource='scripts/early-controlled-loops/control.lua';
await fs.writeFile(source+'/native-report.json',JSON.stringify(report,null,2)+'\n');
const release=JSON.parse(await fs.readFile(source+'/manifest.json'));for(const m of release){const cases=report.builds.filter(b=>b.blueprintSha256===m.blueprintSha256&&[m.id,m.id+'-supplemented'].includes(b.id));m.status=cases.length===(m.optionalInputs.length?2:1)&&cases.every(b=>b.passed)?(m.optionalInputs.length?'native-verified-required-and-supplemented':'native-verified-declared-inputs'):'native-verification-incomplete';m.nativeReport='native-report.json';}await fs.writeFile(source+'/manifest.json',JSON.stringify(release,null,2)+'\n');
console.log(JSON.stringify(report.builds.map(b=>({id:b.id,passed:b.passed,outputs:b.outputsPerMinute,recovery:b.recovery.outputsPerMinute,idle:b.machines.filter(m=>!m.measuredCrafts)})),null,2));process.exitCode=report.passed?0:1;
