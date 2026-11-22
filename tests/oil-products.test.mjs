import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {ID,PROTOTYPE,SIZE,TARGET,THRESHOLD,design} from '../scripts/oil-products/shared.mjs';
import {fluidNetworks} from '../scripts/oil-products/fluids.mjs';
import {verifyPrototype} from '../scripts/oil-products/prototype-check.mjs';

// The dump counts as installed only when it can be opened; the one test that needs it skips otherwise.
const readable=p=>{try{closeSync(openSync(p,'r'));return true;}catch{return false;}};
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/'+ID+'/';
const [m]=JSON.parse(await read(dir+'manifest.json'));
const code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const size=name=>SIZE[name];
const tiles=e=>{const [w0,h0]=SIZE[e.name],[w,h]=[4,12].includes(e.direction||0)?[h0,w0]:[w0,h0],t=[];
 for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++)t.push([x,y]);return t;};
const grid=new Map();for(const e of entities)for(const [x,y] of tiles(e)){assert.ok(!grid.has(x+','+y),`overlap at ${x},${y}`);grid.set(x+','+y,e);}
const at=(x,y)=>grid.get(x+','+y);
const byNumber=new Map(entities.map(e=>[e.entity_number,e]));

test('the import string is the manifest string: 43 x 15, 7 refineries, 11 chemical plants',()=>{
 assert.equal(hash(code),m.blueprintSha256);
 assert.equal(m.prototypeSha256,PROTOTYPE.sha256);
 const xs=[...grid.keys()].map(k=>+k.split(',')[0]),ys=[...grid.keys()].map(k=>+k.split(',')[1]);
 assert.deepEqual([Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)],[0,42,0,14]);
 assert.deepEqual(m.footprint,{width:43,height:15});assert.equal(m.tiles,645);assert.equal(m.entityCount,entities.length);
 const count=r=>entities.filter(e=>e.recipe===r).length;
 assert.deepEqual([count('advanced-oil-processing'),count('light-oil-cracking'),count('heavy-oil-cracking'),count('sulfur'),count('sulfuric-acid'),count('lubricant')],[7,6,2,1,1,1]);
 const names={};for(const e of entities)names[e.name]=(names[e.name]||0)+1;assert.deepEqual(names,m.construction);
});

test('only the allowed tiers: no modules, beacons or robots; fast inserters, red belts, substations',()=>{
 const allowed=new Set(['oil-refinery','chemical-plant','storage-tank','pump','pipe','pipe-to-ground','fast-transport-belt','fast-underground-belt','fast-inserter','substation','display-panel']);
 for(const e of entities){assert.ok(allowed.has(e.name),'unexpected '+e.name);assert.equal(e.items,undefined,'no module requests');}
 for(const e of entities.filter(e=>e.name==='fast-inserter'))assert.equal(e.override_stack_size,1);
 assert.ok((bp.wires||[]).every(w=>(w[1]===5&&w[3]===5)||(w[1]===1&&w[3]===1)),'copper power wires and red circuit wires only');
});

test('the arithmetic: 6.03 refineries rounded up to 7, inputs and exports as published',()=>{
 const D=design();
 assert.deepEqual(m.design,D);
 assert.ok(D.refineriesExact>6&&D.refineriesExact<6.1);assert.equal(D.refineries,7);
 assert.deepEqual(D.machines,{'oil-refinery':7,'heavy-oil-cracking':2,'light-oil-cracking':6,sulfur:1,'sulfuric-acid':1,lubricant:1});
 assert.deepEqual([D.full.crude,D.full.water,D.full.iron],[8400,12880,10]);
 assert.deepEqual([D.gasExport,D.gasSurplus,D.lightOutlet.gasExport,D.lightOutlet.gasLost],[7140,1140,6700,440]);
 assert.deepEqual(Object.fromEntries(m.inputs.map(p=>[p.item,p.perMinute])),{water:12880,'crude-oil':8400,'iron-plate':10});
 assert.deepEqual(Object.fromEntries(m.outputs.map(p=>[p.item,p.perMinute])),{'petroleum-gas':7140,'sulfuric-acid':500,lubricant:150,'light-oil':0,sulfur:15});
});

test('ports: inputs west, gas, acid and sulfur east, lubricant and light oil north, each on its own tile',()=>{
 const sides=Object.fromEntries([...m.inputs,...m.outputs].map(p=>[p.item,p.externalSide]));
 assert.deepEqual(sides,{water:'west','crude-oil':'west','iron-plate':'west','petroleum-gas':'east','sulfuric-acid':'east',lubricant:'north','light-oil':'north',sulfur:'east'});
 for(const p of [...m.inputs,...m.outputs]){
  const e=byNumber.get(p.entity);assert.equal(at(p.tile.x,p.tile.y),e,p.item);
  if(p.externalSide==='west')assert.equal(p.tile.x,0);if(p.externalSide==='east')assert.equal(p.tile.x,42);if(p.externalSide==='north')assert.equal(p.tile.y,0);
  assert.ok(byNumber.get(p.displayEntity)?.name==='display-panel','display panel for '+p.item);
 }
 assert.ok(m.inputs.find(p=>p.item==='crude-oil').tile.y-m.inputs.find(p=>p.item==='water').tile.y>=2,'fluid entrances not on adjacent rows');
 // the iron belt ends at the acid plant's iron arm and never runs on to the sulfur belt
 const iron=m.inputs.find(p=>p.item==='iron-plate'),sulfur=m.outputs.find(p=>p.item==='sulfur');
 assert.equal(iron.tile.y,sulfur.tile.y);for(let x=37;x<=39;x++)assert.equal(at(x,14),undefined,'gap between the iron belt and the sulfur belt at '+x);
});

test('the fluid model: every network carries one fluid and every port reaches its own',()=>{
 const net=fluidNetworks(entities,size);
 assert.deepEqual(net.problems,[]);
 for(const c of net.comps)assert.ok(c.fluids.size<=1,[...c.fluids].join('+'));
 const fluidOf=n=>{const end=net.ends.find(x=>x.e.entity_number===n);return [...net.componentOf(end).fluids][0];};
 for(const p of [...m.inputs,...m.outputs].filter(p=>p.transport==='pipe'))assert.equal(fluidOf(p.entity),p.item,p.item);
 for(const c of m.control)assert.equal(fluidOf(c.tank),c.fluid);
});

test('control: every second refinery mirrored; two pumps gated by the tanks on one red network',()=>{
 const refineries=entities.filter(e=>e.name==='oil-refinery').sort((a,b)=>a.position.x-b.position.x);
 assert.deepEqual(refineries.map(e=>!!e.mirror),[false,true,false,true,false,true,false]);
 assert.equal(m.control.length,2);
 for(const c of m.control){const pump=byNumber.get(c.pump);assert.equal(pump.name,'pump');assert.equal(byNumber.get(c.tank).name,'storage-tank');
  assert.deepEqual(pump.control_behavior,{circuit_enabled:true,circuit_condition:{first_signal:{type:'fluid',name:c.fluid},comparator:'>',constant:THRESHOLD[c.fluid]}});}
 // pumps and tanks are joined by red wires (directly or through substations)
 const red=(bp.wires||[]).filter(w=>w[1]===1),adj=new Map();for(const [a,,b] of red){adj.set(a,[...(adj.get(a)||[]),b]);adj.set(b,[...(adj.get(b)||[]),a]);}
 const reach=s=>{const seen=new Set([s]),q=[s];while(q.length){const u=q.shift();for(const v of adj.get(u)||[])if(!seen.has(v)){seen.add(v);q.push(v);}}return seen;};
 const net=reach(m.control[0].pump);for(const c of m.control){assert.ok(net.has(c.pump));assert.ok(net.has(c.tank));}
});

test('native report: qualified for this exact string, every required scenario passed',async()=>{
 const report=JSON.parse(await read(dir+'native-report.json'));
 assert.equal(report.passed,true);assert.equal(report.short,undefined);assert.equal(report.gameVersion,'2.1.24');assert.equal(report.prototypeSha256,PROTOTYPE.sha256);
 assert.equal(m.status,'qualified');
 for(const k of ['warmupMinutes','measureMinutes','blockedMinutes','recoveryMinutes'])assert.ok(report.protocolMinutes[k]>=30,k);
 assert.deepEqual(report.builds.map(b=>b.scenario),m.scenarios.map(s=>s.id));
 for(const b of report.builds){assert.equal(b.blueprintSha256,m.blueprintSha256);if(!b.informational){assert.equal(b.passed,true,b.scenario);assert.ok(Object.values(b.checks).every(Boolean),b.scenario);}}
 const design=report.builds.find(b=>b.scenario==='design').phases.find(p=>p.name==='measure');
 for(const item of ['petroleum-gas','sulfuric-acid','lubricant','sulfur'])assert.ok(design.drawnPerMinute[item]>=m.targets[item]*0.95,item);
 for(const p of report.builds.flatMap(b=>b.phases)){assert.deepEqual(p.wrongFluidSeconds,{});assert.deepEqual(p.wrongItemsOnSulfurExit,{});}
 const [alt]=JSON.parse(await read(dir+'candidates/east-wing-four-substations/manifest.json'));
 const altReport=JSON.parse(await read(dir+'candidates/east-wing-four-substations/native-report.json'));
 assert.equal(alt.status,'qualified');assert.ok(altReport.builds.every(b=>b.blueprintSha256===alt.blueprintSha256));assert.deepEqual(alt.footprint,{width:44,height:15});
});

test('the generator is reproducible: a re-run gives the same files',async()=>{
 const out='.cache/'+ID+'/test-generate-'+process.pid;
 await fs.rm(new URL(out,root),{recursive:true,force:true});
 await fs.mkdir(new URL(out+'/candidates/east-wing-four-substations',root),{recursive:true});
 for(const f of [m.file,'native-report.json','candidates/east-wing-four-substations/'+m.file,'candidates/east-wing-four-substations/native-report.json'])await fs.copyFile(new URL(dir+f,root),new URL(out+'/'+f,root));
 try{
  await promisify(execFile)(process.execPath,['scripts/'+ID+'/generate.mjs','--out',out],{cwd:rootPath});
  for(const f of [m.file,'manifest.json','README.md','candidates/east-wing-four-substations/'+m.file,'candidates/east-wing-four-substations/manifest.json'])assert.equal((await read(out+'/'+f)).toString(),(await read(dir+f)).toString(),f);
 }finally{await fs.rm(new URL(out,root),{recursive:true,force:true});}
});

test('the prototype facts match the official 2.1.24 dump',{skip:!readable(rawPath)&&'prototype dump not installed'},async()=>{
 verifyPrototype(await fs.readFile(rawPath));
 assert.equal(TARGET['sulfuric-acid'],500);
});
