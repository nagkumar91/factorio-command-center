// Usage (from the factorio-command-center folder): node scripts/concrete-supplier/probes/run-probe.mjs <lanes|fluidsides> <ticks>
// Runs <probe-name>.lua as control.lua in a private headless game under .cache/concrete-supplier/probes/ (copied from the planner's plan/probe.mjs).
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile);
const [name,ticks,payloadFile]=process.argv.slice(2);
const here=path.dirname(new URL(import.meta.url).pathname);
const cache=path.resolve('.cache/concrete-supplier/probes');
const root=path.join(cache,name+'-'+(process.env.TAG||'run'));
await fs.rm(root,{recursive:true,force:true});
const app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/supplier_probe';
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','supplier_probe'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'supplier_probe',version:'1.0.0',title:'Private space plan probe',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile(path.join(here,name+'.lua'),mod+'/control.lua');
const payload=payloadFile?await fs.readFile(payloadFile,'utf8'):'{}';
await fs.writeFile(mod+'/payload.lua','return [====['+payload+']====]');
await fs.writeFile(mod+'/data.lua','-- No prototypes added.\n');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:Number(process.env.SEED||12345),width:64,height:64,default_enable_all_autoplace_controls:false}));
async function game(args,file){const t0=Date.now();try{const task=run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:4*3600000,maxBuffer:64e6});if(task.child?.pid)await run('/usr/bin/taskpolicy',['-B','-p',String(task.child.pid)]).catch(()=>{});const r=await task;await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(root+'/'+file,(e.stdout||'')+(e.stderr||''));console.log('FAILED '+file+'\n'+(e.stdout||'').slice(-3000));process.exit(1);}console.log(file+' '+((Date.now()-t0)/1000).toFixed(1)+'s');}
console.log(root);
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(ticks),'--benchmark-runs','1'],'benchmark.log');
const out=root+'/script-output';
for(const f of await fs.readdir(out).catch(()=>[])){const dest=path.join(here,'results',f);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(out,f),dest);console.log('result: '+dest);}
