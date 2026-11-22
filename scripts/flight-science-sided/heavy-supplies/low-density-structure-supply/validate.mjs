// Native qualification of the low-density structure supply (Factorio 2.1.24, the family's flight-save profile).
// node scripts/flight-science-sided/heavy-supplies/low-density-structure-supply/validate.mjs [--source dir] [--fractions 1,0.8]
// SHORT=1 shortens every window (screening only; such a report never qualifies and is not written to --source).
// Runs headless with a private --config and --mod-directory under .cache/heavy-supplies; never touches the
// user's game data or process.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {decodeBlueprint} from '../../../blueprints.mjs';
import {buildBlueprint,id,product,familyPrototypeSha256} from './layout.mjs';
import {resolveProfile} from './profile.mjs';

const run=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const here=path.dirname(new URL(import.meta.url).pathname);
const project=path.resolve(here,'../../../..');
const arg=name=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:undefined;};
const source=path.resolve(project,arg('--source')||`blueprint-sources/flight-science-sided/heavy-supplies/${id}`);
const fractions=(arg('--fractions')||'1,0.8').split(',').map(Number);
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const binary=path.join(app,'Contents/MacOS/factorio');
const profile=await resolveProfile(project);
const rawBytes=await fs.readFile(profile.raw),raw=JSON.parse(rawBytes);
assert.equal(sha(rawBytes),familyPrototypeSha256,'not the family flight-save prototype dump');
const short=process.env.SHORT==='1';
const warmup=short?3600*5:3600*15,measure=short?3600*5:3600*30;
const recovery={pauseTicks:18000,settleTicks:7200,measureTicks:10800};
const root=path.join(project,'.cache/heavy-supplies/low-density-structure/native',new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(root,{recursive:true});
await fs.cp(profile.mods,path.join(root,'mods'),{recursive:true});
const mod=path.join(root,'mods/lds_supply_test');await fs.mkdir(mod);
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'lds_supply_test',version:'1.0.0',title:'Private supply validation',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24']}));
const list=JSON.parse(await fs.readFile(path.join(root,'mods/mod-list.json')));list.mods.push({name:'lds_supply_test',enabled:true});await fs.writeFile(path.join(root,'mods/mod-list.json'),JSON.stringify(list));
const manifest=JSON.parse(await fs.readFile(path.join(source,'manifest.json')))[0];
const code=(await fs.readFile(path.join(source,manifest.file),'utf8')).trim();
assert.equal(sha(code),manifest.blueprintSha256,'string does not match manifest SHA-256');
const decoded=decodeBlueprint(code);
const rebuilt=buildBlueprint(raw,manifest.variant||'twin-rows');
assert.equal(JSON.stringify(decoded),JSON.stringify({blueprint:rebuilt.bp}),'string is not the generator output for this variant');
const builds=fractions.map(f=>({...manifest,code,entities:decoded.blueprint.entities,feedFraction:f,laneChecks:rebuilt.laneChecks}));
await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify({builds,warmup,measure,recovery})+']====]');
const control=path.join(here,'control.lua');
await fs.copyFile(control,path.join(mod,'control.lua'));
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(path.join(root,'map.json'),JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
async function factorio(args,log){try{const r=await run(binary,['--config',path.join(root,'config.ini'),'--mod-directory',path.join(root,'mods'),...args],{timeout:3600000,maxBuffer:8e6});await fs.writeFile(path.join(root,log),r.stdout+r.stderr);}catch(e){await fs.writeFile(path.join(root,log),(e.stdout||'')+(e.stderr||''));throw Error('Factorio failed: '+path.join(root,log)+'\n'+(e.stdout||'').slice(-2500));}}
console.log('Private native test:',root);
const ticks=warmup+measure+recovery.pauseTicks+recovery.settleTicks+recovery.measureTicks+1;
await factorio(['--create',path.join(root,'test.zip'),'--map-gen-settings',path.join(root,'map.json')],'create.log');
await factorio(['--benchmark',path.join(root,'test.zip'),'--benchmark-ticks',String(ticks),'--benchmark-runs','1'],'benchmark.log');
// Drop the copied mod zips once the run is over; the report keeps the mod list.
for(const f of await fs.readdir(path.join(root,'mods')))if(f.endsWith('.zip'))await fs.rm(path.join(root,'mods',f));
const result=JSON.parse(await fs.readFile(path.join(root,'script-output/result.json')));
const target=manifest.targetPerMinute,machines=Object.values(manifest.machineCounts).reduce((a,b)=>a+b,0);
Object.assign(result,{gameVersion:'2.1.24',short,warmupMinutes:warmup/3600,measurementMinutes:measure/3600,prototypeSha256:sha(rawBytes),harnessSha256:sha(await fs.readFile(control)),modList:list,profile:path.relative(project,profile.dir),createdAt:new Date().toISOString(),
 criteria:{steadyAndRecoveryAtFullFeed:`>= 95% of ${target}/min`,reducedFeed:'output >= 95% of the fed share of the target, inlets draw >= 95% of their feed, recovery >= 95% of the fed share',everyAssemblerCrafts:'at full feed, in the measured and the recovery window (at reduced feed the count is recorded)',outletCarriesOnlyTheProduct:true,laneContentsAsDeclared:true}});
for(const b of result.builds){
 b.blueprintSha256=manifest.blueprintSha256;b.footprint=manifest.footprint;b.tiles=manifest.footprint.width*manifest.footprint.height;
 b.entityCounts={};for(const e of decoded.blueprint.entities)b.entityCounts[e.name]=(b.entityCounts[e.name]||0)+1;b.entities=decoded.blueprint.entities.length;b.assemblers=machines;
 const want=target*b.feedFraction*.95,o=b.outputsPerMinute[product]||0,rec=b.recovery?.outputsPerMinute?.[product]||0;
 const empty=v=>!v||Object.keys(v).length===0;
 b.checks={steady:o>=want,recovery:rec>=want,inletsDrawFeed:b.inputs.every(p=>p.acceptedPerMinute>=p.feedPerMinute*.95),inletsRouted:b.inputs.every(p=>p.productiveRoute?.length>0),
  assemblerCount:b.machines.length===machines,everyAssemblerCrafts:b.feedFraction<1||b.machines.every(m=>m.measuredCrafts>0),recoveryEveryAssemblerCrafts:b.feedFraction<1||b.recovery?.machinesCrafting===machines,
  outletOnlyProduct:empty(b.foreignItemsAtOutlet),lanesClean:empty(b.foreignItemsOnLanes),powered:b.powered===true,outletCollects:b.outputPorts.every(p=>p.collectedDuringMeasurement>0)};
 b.assemblersCrafting=b.machines.filter(m=>m.measuredCrafts>0).length;
 b.passed=Object.values(b.checks).every(Boolean);
}
result.passed=result.builds.every(b=>b.passed);
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(result,null,2)+'\n');
if(!short)await fs.writeFile(path.join(source,'native-report.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({report:path.join(root,'report.json'),passed:result.passed,builds:result.builds.map(b=>({feed:b.feedFraction,passed:b.passed,crafting:b.assemblersCrafting,recoveryCrafting:b.recovery?.machinesCrafting,checks:b.checks,steady:b.outputsPerMinute,recovery:b.recovery?.outputsPerMinute,inlets:b.inputs.map(p=>[p.item,p.acceptedPerMinute,p.refusedTotal]),foreign:[b.foreignItemsAtOutlet,b.foreignItemsOnLanes]}))},null,2));
process.exitCode=result.passed?0:1;
