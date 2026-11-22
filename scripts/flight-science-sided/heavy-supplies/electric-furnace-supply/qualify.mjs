// Native qualification core for the heavy-ingredient supply factories. One headless Factorio 2.1.24 run on a
// private copy of the family's flight-save mod profile (prototype SHA-256 33912441...), with a private
// --config and --mod-directory under .cache/heavy-supplies/. Never touches the user's game data.
// The run builds the committed blueprint twice: fed at exactly its panel figures (feedScale 1) and at 80%.
// Protocol (the family's supply protocol): 15 min warm-up, 30 min measured, 5 min output blocked, 2 min
// settling, 3 min recovery measured. Writes <source>/native-report.json unless HEAVY_EXPLORE=1 (shorter phases
// from HEAVY_MINUTES="w,m,b,s,r", report kept under .cache only).
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {decodeBlueprint} from '../../../blueprints.mjs';
import {ROOT,OUT_ROOT,sha,findProfile} from './supply-kit.mjs';

const run=promisify(execFile);
export const PROTOCOL={warmupMinutes:15,measurementMinutes:30,blockedMinutes:5,settlingMinutes:2,recoveryMinutes:3};
export const REDUCED_FEED=.8;

/** Pass rules. Full feed: steady and recovery output >= 95% of target, every assembler crafted, every inlet
 * productive, nothing but the product in the outlet. Reduced feed: output >= 95% of the reduced target and no
 * jam (each inlet took >= 99% of what was offered in the measured window and the queue was empty afterwards). */
export function checks(r,m,scale,measureMinutes=PROTOCOL.measurementMinutes){
 const target=m.targetPerMinute*scale,product=m.products[0];
 const machines=Object.values(m.machineCounts).reduce((a,b)=>a+b,0);
 const c={
  powered:!!r.powered,
  steadyRate:r.outputsPerMinute[product]>=.95*target,
  recoveryRate:r.recovery?.outputsPerMinute?.[product]>=.95*target,
  onlyProductAtOutlet:Object.keys(r.foreignAtOutlet||{}).length===0,
  everyInletProductive:r.inputs.length===m.inputs.length&&r.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute?.length>0),
  noJam:r.inputs.every(p=>p.acceptedDuringMeasurement>=.99*p.offeredPerMinute*measureMinutes&&p.backlogAtMeasurementEnd<=1)&&r.recovery.inputs.every(p=>p.backlogAtEnd<=1),
 };
 if(scale===1)c.everyAssemblerCrafted=r.machines.length===machines&&r.machines.every(x=>x.measuredCrafts>0);
 return c;
}

export async function qualify(id){
 const explore=process.env.HEAVY_EXPLORE==='1';
 const profile=await findProfile();
 if(!profile)throw Error('Needs the flight-save profile (mods + data-raw-dump.json, SHA-256 33912441...): set FLIGHT_PROFILE');
 const source=path.join(OUT_ROOT,id);
 const [m]=JSON.parse(await fs.readFile(path.join(source,'manifest.json'),'utf8'));
 const code=(await fs.readFile(path.join(source,m.file),'utf8')).trim();
 if(sha(code)!==m.blueprintSha256)throw Error('Blueprint SHA-256 differs from the manifest');
 if(m.prototypeSha256!==sha(profile.bytes))throw Error('Prototype SHA-256 differs from the manifest');
 const entities=decodeBlueprint(code).blueprint.entities;
 const minutes=explore?Object.fromEntries(Object.keys(PROTOCOL).map((k,i)=>[k,Number((process.env.HEAVY_MINUTES||'3,5,2,1,2').split(',')[i])])):PROTOCOL;
 const ticks=Object.fromEntries(Object.entries(minutes).map(([k,v])=>[k,Math.round(v*3600)]));
 const total=ticks.warmupMinutes+ticks.measurementMinutes+ticks.blockedMinutes+ticks.settlingMinutes+ticks.recoveryMinutes;
 const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
 const root=path.join(ROOT,'.cache/heavy-supplies/native',id+'-'+Date.now());
 await fs.mkdir(root,{recursive:true});
 // Mod archives are linked (read-only) from the profile; the list and settings are copied.
 await fs.mkdir(path.join(root,'mods'));
 for(const f of (await fs.readdir(path.join(profile.dir,'mods'))).sort()){
  const from=path.join(profile.dir,'mods',f),to=path.join(root,'mods',f);
  if(f.endsWith('.zip'))await fs.symlink(from,to);else await fs.copyFile(from,to);
 }
 const mod=path.join(root,'mods/heavy_supply_test');await fs.mkdir(mod);
 await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'heavy_supply_test',version:'1.0.0',title:'Private heavy supply qualification',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24']}));
 const list=JSON.parse(await fs.readFile(path.join(root,'mods/mod-list.json')));list.mods.push({name:'heavy_supply_test',enabled:true});
 await fs.writeFile(path.join(root,'mods/mod-list.json'),JSON.stringify(list));
 const runs=[1,REDUCED_FEED].map(feedScale=>({id,label:`${id} feed ${feedScale}`,feedScale,code,entities,ports:m.ports,inputs:m.inputs,outputs:m.outputs,products:m.products,footprint:m.footprint}));
 await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify({builds:runs,warmup:ticks.warmupMinutes,measure:ticks.measurementMinutes,blocked:ticks.blockedMinutes,settle:ticks.settlingMinutes,recovery:ticks.recoveryMinutes})+']====]');
 const harness=new URL('./control.lua',import.meta.url).pathname;
 await fs.copyFile(harness,path.join(mod,'control.lua'));
 await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
 await fs.writeFile(path.join(root,'map.json'),JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
 const factorio=async(args,log)=>{
  try{const r=await run(path.join(app,'Contents/MacOS/factorio'),['--config',path.join(root,'config.ini'),'--mod-directory',path.join(root,'mods'),...args],{timeout:3600000,maxBuffer:32e6});await fs.writeFile(path.join(root,log),r.stdout+r.stderr);}
  catch(e){await fs.writeFile(path.join(root,log),(e.stdout||'')+(e.stderr||''));throw Error('Factorio failed: '+path.join(root,log)+'\n'+(e.stdout||'').slice(-2500));}
 };
 console.log('Private native run:',root);
 await factorio(['--create',path.join(root,'test.zip'),'--map-gen-settings',path.join(root,'map.json')],'create.log');
 await factorio(['--benchmark',path.join(root,'test.zip'),'--benchmark-ticks',String(total+1),'--benchmark-runs','1'],'benchmark.log');
 const result=JSON.parse(await fs.readFile(path.join(root,'script-output/result.json')));
 const [full,reduced]=result.builds;
 const fullBuilds=result.builds.filter(b=>b.feedScale===1),reducedBuilds=result.builds.filter(b=>b.feedScale===REDUCED_FEED);
 if(fullBuilds.length!==1||reducedBuilds.length!==1)throw Error('Unexpected run list');
 const shape={width:m.footprint.width,height:m.footprint.height,tiles:m.footprint.width*m.footprint.height,machines:Object.values(m.machineCounts).reduce((a,b)=>a+b,0),entities:entities.length,construction:m.construction};
 for(const [r,scale] of [[full,1],[reduced,REDUCED_FEED]]){
  r.blueprintSha256=m.blueprintSha256;r.inputs.forEach((p,i)=>{p.tile=m.inputs[i].position;});
  if(Array.isArray(r.foreignAtOutlet))r.foreignAtOutlet={};
  r.checks=checks(r,m,scale,minutes.measurementMinutes);r.passed=Object.values(r.checks).every(Boolean);Object.assign(r,{shape});
 }
 const report={gameVersion:'2.1.24',short:explore,protocol:minutes,warmupMinutes:minutes.warmupMinutes,measurementMinutes:minutes.measurementMinutes,
  feedPolicy:result.feedPolicy,researchPolicy:result.researchPolicy,prototypeSha256:sha(profile.bytes),
  harnessSha256:sha(await fs.readFile(harness)),qualifySha256:sha(await fs.readFile(new URL(import.meta.url).pathname)),modList:list,createdAt:new Date().toISOString(),
  targetPerMinute:m.targetPerMinute,builds:[full],reducedFeed:{feedScale:REDUCED_FEED,builds:[reduced]},passed:full.passed&&reduced.passed};
 await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(!explore)await fs.writeFile(path.join(source,'native-report.json'),JSON.stringify(report,null,2)+'\n');
 const summary=r=>({feedScale:r.feedScale,passed:r.passed,checks:r.checks,outputs:r.outputsPerMinute,recovery:r.recovery.outputsPerMinute,draw:Object.fromEntries(r.inputs.map(p=>[p.item,+p.drawPerMinute.toFixed(2)])),crafts:r.machines.map(x=>x.measuredCrafts)});
 console.log(JSON.stringify({id,report:path.join(root,'report.json'),passed:report.passed,full:summary(full),reduced:summary(reduced)},null,1));
 return report;
}
