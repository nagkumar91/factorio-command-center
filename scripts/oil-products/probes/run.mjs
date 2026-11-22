// Native probes behind the oil-products layout (Factorio 2.1.24, headless, private config and mod directory under
// .cache/oil-products/probe-<name>; never the user's game data). Run from the factorio-command-center folder:
//   node scripts/oil-products/probes/run.mjs mirror-and-fluid-boxes|tank-pump-and-draw|pipe-to-ground
// Each prints the probe's result.json. What they showed is summarised in blueprint-sources/oil-products/README.md.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';
import {encodeBlueprint} from '../../blueprints.mjs';
const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const name=process.argv[2];
const bp=entities=>encodeBlueprint({blueprint:{item:'blueprint',version:562954249961472,entities:entities.e,wires:entities.w||[]}});
const builders={
 // Refineries and chemical plants in every direction, unmirrored and mirrored (blueprint field mirror: true).
 'mirror-and-fluid-boxes':()=>{const e=[];let n=1,x=0;const add=(name,px,py,extra={})=>e.push({entity_number:n++,name,position:{x:px,y:py},...extra,tags:{probe:n-1}});
  for(const mirror of [false,true])for(const d of [0,4,8,12]){add('oil-refinery',x+0.5,0.5,{direction:d,recipe:'advanced-oil-processing',...(mirror?{mirror:true}:{})});x+=7;}
  x=0;for(const r of ['light-oil-cracking','heavy-oil-cracking','sulfur','sulfuric-acid','lubricant'])for(const mirror of [false,true])for(const d of [0,4]){add('chemical-plant',x+0.5,10.5,{direction:d,recipe:r,...(mirror?{mirror:true}:{})});x+=5;}
  return {code:bp({e}),count:e.length,ticks:5};},
 // A tank on a pipe run, a pump wired to it (heavy oil > 5000), and three ways to draw fluid from a pipe.
 'tank-pump-and-draw':()=>{const e=[],w=[];let n=1;const add=(name,x,y,extra={})=>{const o={entity_number:n++,name,position:{x,y},...extra};o.tags={probe:o.entity_number};e.push(o);return o;};
  const src=add('pipe',0.5,-0.5);add('pipe',1.5,-0.5);add('pipe',2.5,-0.5);const tank=add('storage-tank',4.5,0.5,{direction:0});add('pipe',6.5,1.5);
  const pump=add('pump',8,1.5,{direction:4,control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'fluid',name:'heavy-oil'},comparator:'>',constant:5000}}});
  let out;for(let x=9;x<=12;x++)out=add('pipe',x+0.5,1.5);w.push([tank.entity_number,1,pump.entity_number,1]);
  const lines=[];for(const y of [5,7,9]){const l=[];for(let x=0;x<5;x++)l.push(add('pipe',x+0.5,y+0.5).entity_number);lines.push(l);}
  return {code:bp({e,w}),src:src.entity_number,tank:tank.entity_number,pump:pump.entity_number,out:out.entity_number,lines,ticks:4201};},
 // Pipe-to-ground pairs 1, 9, 10, 11 and 12 tiles apart; a pair crossing a perpendicular pair; a pair under a refinery.
 'pipe-to-ground':()=>{const e=[];let n=1;const tests=[];const add=(name,x,y,extra={})=>{const o={entity_number:n++,name,position:{x:x+.5,y:y+.5},...extra};o.tags={probe:o.entity_number};e.push(o);return o.entity_number;};
  const ptg=(x,y,d)=>add('pipe-to-ground',x,y,{direction:d});let y=0;
  for(const g of [0,8,9,10,11]){const a=add('pipe',-1,y);ptg(0,y,12);ptg(g+1,y,4);const b=add('pipe',g+2,y);tests.push({kind:'span',gap:g,src:a,dst:b});y+=3;}
  {const a=add('pipe',-1,y);ptg(0,y,12);ptg(7,y,4);const b=add('pipe',8,y);const c=add('pipe',3,y+1);ptg(3,y,8);ptg(3,y-1,0);const d=add('pipe',3,y-2);const s=add('pipe',5,y);tests.push({kind:'cross',src:a,dst:b,vsrc:c,vdst:d,surface:s});y+=5;}
  {const top=add('pipe',2,y-1);ptg(2,y,0);add('oil-refinery',2,y+3,{direction:0,recipe:'advanced-oil-processing'});const p6=add('pipe',2,y+6);add('pipe',2,y+7);ptg(2,y+8,8);const bot=add('pipe',2,y+9);tests.push({kind:'under-refinery',src:bot,dst:top,surface:p6});}
  return {code:bp({e}),tests,ticks:121};},
};
if(!builders[name])throw Error('probe name: '+Object.keys(builders).join(', '));
const payload=builders[name]();
const root=path.resolve('.cache/oil-products/probe-'+name),app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents'),mod=root+'/mods/oil_probe';
await fs.rm(root,{recursive:true,force:true});await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/mods/mod-list.json',JSON.stringify({mods:['base','elevated-rails','quality','recycler','space-age','oil_probe'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'oil_probe',version:'1.0.0',title:'probe',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
await fs.copyFile(path.join(here,name+'.lua'),mod+'/control.lua');
await fs.writeFile(mod+'/payload.lua','return [====['+JSON.stringify(payload)+']====]');
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(root+'/map.json',JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function game(args,file){const r=await run(app+'/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',root+'/mods',...args],{timeout:600000,maxBuffer:64e6});await fs.writeFile(root+'/'+file,r.stdout+r.stderr);}
await game(['--create',root+'/test.zip','--map-gen-settings',root+'/map.json'],'create.log');
await game(['--benchmark',root+'/test.zip','--benchmark-ticks',String(payload.ticks),'--benchmark-runs','1'],'benchmark.log');
console.log(await fs.readFile(root+'/script-output/result.json','utf8'));
