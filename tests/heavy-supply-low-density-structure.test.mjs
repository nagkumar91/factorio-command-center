import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {findProfile} from '../scripts/flight-science-sided/heavy-supplies/low-density-structure-supply/profile.mjs';

// Low-density structure supply factory (flight-save 2.1.24 recipes), one of the heavy supplies for the
// south entrances of the compact six-pack tier.
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'blueprint-sources/flight-science-sided/heavy-supplies/low-density-structure-supply');
const scripts=path.join(root,'scripts/flight-science-sided/heavy-supplies/low-density-structure-supply');
const sha=v=>createHash('sha256').update(v).digest('hex');
const [m]=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim();
const bp=decodeBlueprint(code).blueprint;
const report=JSON.parse(await fs.readFile(path.join(dir,'native-report.json'),'utf8'));
const product='low-density-structure';

test('string, manifest and size',()=>{
 assert.equal(sha(code),m.blueprintSha256);
 assert.equal(m.id,'low-density-structure-supply');assert.equal(m.targetPerMinute,60);assert.deepEqual(m.products,[product]);
 assert.equal(m.prototypeSha256,'33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f');
 assert.deepEqual({width:m.footprint.width,height:m.footprint.height},{width:34,height:13});
 assert.deepEqual(m.machineCounts,{[product]:20});
 assert.equal(m.status,'native-verified');
});

test('family conventions: entity tiers, no modules, one west inlet per material, one east outlet chest',()=>{
 const allowed=new Set(['fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','assembling-machine-2','steel-chest','display-panel','medium-electric-pole','big-electric-pole']);
 for(const e of bp.entities){assert(allowed.has(e.name),e.name);assert(!e.items,'no modules or item requests');}
 const machines=bp.entities.filter(e=>e.name==='assembling-machine-2');
 assert.equal(machines.length,20);assert(machines.every(e=>e.recipe===product));
 assert(bp.entities.filter(e=>e.name==='fast-inserter').every(e=>e.override_stack_size===1));
 assert.deepEqual(m.inputs.map(p=>p.item).sort(),['copper-plate','plastic-bar','steel-plate']);
 assert.deepEqual(Object.fromEntries(m.inputs.map(p=>[p.item,p.perMinute])),{'copper-plate':1200,'steel-plate':120,'plastic-bar':300});
 const left=Math.min(...bp.entities.map(e=>e.position.x)),right=Math.max(...bp.entities.map(e=>e.position.x));
 for(const p of m.ports.filter(p=>p.kind==='input')){
  assert.equal(p.externalSide,'west');assert.equal(p.x,left);
  const belt=bp.entities.find(e=>e.entity_number===p.entity);assert.equal(belt.name,'fast-transport-belt');assert.equal(belt.direction,4);
 }
 const outs=m.ports.filter(p=>p.kind==='output');assert.equal(outs.length,1);assert.equal(outs[0].externalSide,'east');
 const chest=bp.entities.find(e=>e.entity_number===outs[0].entity);assert.equal(chest.name,'steel-chest');assert.equal(chest.position.x,right);
 for(const p of m.ports.filter(p=>p.kind!=='power')){
  const panel=bp.entities.find(e=>e.entity_number===p.displayEntity);
  assert.equal(panel.name,'display-panel');assert.equal(panel.text,`${p.kind}: ${p.label} ${p.perMinute}/min`);
  assert(Math.abs(panel.position.x-p.x)<=1&&Math.abs(panel.position.y-p.y)<=1,'panel beside its port');
 }
 assert.equal(bp.entities.filter(e=>e.name==='display-panel').length,4);
 assert.equal(bp.entities.filter(e=>e.name==='big-electric-pole').length,1);
 assert.deepEqual(m.loopControl,[]);
});

test('native qualification for the exact SHA-256: full feed and 80% feed',()=>{
 assert.equal(report.passed,true);assert.equal(report.short,false);
 assert.equal(report.warmupMinutes,15);assert.equal(report.measurementMinutes,30);
 assert.equal(report.prototypeSha256,m.prototypeSha256);
 for(const fraction of [1,0.8]){
  const b=report.builds.find(b=>b.feedFraction===fraction);
  assert(b?.passed,`feed ${fraction}`);assert.equal(b.blueprintSha256,m.blueprintSha256);
  assert(b.outputsPerMinute[product]>=60*fraction*.95);assert(b.recovery.outputsPerMinute[product]>=60*fraction*.95);
  assert.deepEqual([b.recovery.blockedMinutes,b.recovery.settlingMinutes,b.recovery.measurementMinutes],[5,2,3]);
  for(const p of b.inputs)assert(p.acceptedPerMinute>=p.panelPerMinute*fraction*.95,p.item);
  assert.deepEqual(b.foreignItemsAtOutlet,{});assert.deepEqual(b.foreignItemsOnLanes,{});
  if(fraction===1){assert(b.machines.every(x=>x.measuredCrafts>0));assert.equal(b.recovery.machinesCrafting,20);}
 }
});

test('harness in the report is the committed control.lua',async()=>{
 assert.equal(report.harnessSha256,sha(await fs.readFile(path.join(scripts,'control.lua'))));
});

const profile=findProfile(root);
test('recipe arithmetic from the flight-save prototype data',{skip:profile?false:'flight-save prototype dump not installed here (.cache/flight-21 or FLIGHT_PROFILE)'},async()=>{
 const {recipeFigures}=await import('../scripts/flight-science-sided/heavy-supplies/low-density-structure-supply/layout.mjs');
 const f=recipeFigures(JSON.parse(await fs.readFile(profile.raw)));
 assert.equal(f.perMachine,3);assert.equal(f.machines,20);
 assert.deepEqual(f.inputs,{'steel-plate':120,'copper-plate':1200,'plastic-bar':300});
 assert.equal(f.lanePerMinute,900);
});

test('generator reproduces the committed string and manifest byte for byte',{skip:profile?false:'flight-save prototype dump not installed here (.cache/flight-21 or FLIGHT_PROFILE)'},async()=>{
 const out=path.join(root,'.cache/heavy-supplies/low-density-structure/regeneration-test');
 await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
 for(const f of [m.file,'native-report.json'])await fs.copyFile(path.join(dir,f),path.join(out,f));
 const run=()=>promisify(execFile)(process.execPath,[path.join(scripts,'generate.mjs'),'--out',out],{cwd:root,env:{...process.env,FLIGHT_PROFILE:profile.dir}});
 for(let i=0;i<2;i++){
  await run();
  assert.equal(await fs.readFile(path.join(out,m.file),'utf8'),await fs.readFile(path.join(dir,m.file),'utf8'));
  assert.equal(await fs.readFile(path.join(out,'manifest.json'),'utf8'),await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 }
 await fs.rm(out,{recursive:true,force:true});
});
