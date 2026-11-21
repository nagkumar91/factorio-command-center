// Unit checks for the orbital space science cell. No game data or prototype dump needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const dir='blueprint-sources/flight-space-science';
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
const code=(await fs.readFile(path.join(dir,manifest.file),'utf8')).trim();
const report=JSON.parse(await fs.readFile(path.join(dir,'validation/native-report.json'),'utf8'));
const entities=decodeBlueprint(code).blueprint.entities;
const sha=text=>createHash('sha256').update(text).digest('hex');
const at=(name,x,y)=>entities.find(e=>e.name===name&&e.position.x===x&&e.position.y===y);
const SIZE={'assembling-machine-2':3,'solar-panel':3};

test('string, manifest and native report describe the same qualified cell',()=>{
 assert.equal(sha(code),manifest.blueprintSha256);
 assert.equal(report.blueprintSha256,manifest.blueprintSha256);
 assert.equal(report.passed,true);
 assert.equal(report.gameVersion,'2.1.24');
 assert.equal(report.gravity,0);
 assert.equal(report.entities,entities.length);
 for(const r of [report,report.behaviour.abundant,report.behaviour.blockedHub]){
  assert.equal(r.passed,true);
  assert.ok(r.outputsPerMinute>=manifest.targetPerMinute);
  assert.equal(r.craftIntervalTicks.min,1200);assert.equal(r.craftIntervalTicks.max,1200);
 }
 assert.equal(report.behaviour.blockedHub.packsDuringBlock,0);
 for(const p of manifest.inputs)assert.ok(report.inputs[p.item].acceptedDuringMeasurement>=Math.floor(10*p.ratePerMinute*.95),p.item);
});

test('one AM2, no modules, three south entrances in order, packs handed west into the hub',()=>{
 const counts={};for(const e of entities)counts[e.name]=(counts[e.name]||0)+1;
 assert.deepEqual(counts,manifest.entities);
 assert.deepEqual(manifest.entities,{'assembling-machine-2':1,'fast-inserter':4,'fast-transport-belt':3,'solar-panel':2});
 assert.ok(entities.every(e=>!e.items&&!e.modules),'no modules');
 const machine=at('assembling-machine-2',6.5,0.5);assert.equal(machine.recipe,'space-science-pack');
 assert.deepEqual(manifest.inputs.map(p=>p.item),['iron-plate','carbon','ice']);
 assert.deepEqual(manifest.inputs.map(p=>p.x),[5.5,6.5,7.5]);
 for(const p of manifest.inputs){
  assert.equal(at('fast-transport-belt',p.x,p.y)?.direction??0,0,p.item+' belt runs north');
  assert.equal(at('fast-inserter',p.x,p.y-1)?.direction,8,p.item+' inserter picks from the belt to its south');
 }
 // The entrances are the southern edge of the cell.
 assert.ok(manifest.inputs.every(p=>p.y+0.5===manifest.footprint.bottom));
 assert.equal(at('fast-inserter',4.5,0.5)?.direction,4,'output inserter picks from the machine to its east and drops west into the hub');
 assert.equal(manifest.footprint.left,4);
});

test('footprint and foundation follow from the entities; smaller than the replaced version',async()=>{
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;const covered=new Set();
 for(const e of entities){const s=SIZE[e.name]||1,h=s/2,{x,y}=e.position;left=Math.min(left,x-h);right=Math.max(right,x+h);top=Math.min(top,y-h);bottom=Math.max(bottom,y+h);for(let i=0;i<s;i++)for(let j=0;j<s;j++)covered.add(`${x-h+i},${y-h+j}`);}
 assert.deepEqual(manifest.footprint,{left,right,top,bottom,width:right-left,height:bottom-top});
 assert.deepEqual([manifest.footprint.width,manifest.footprint.height],[7,6]);
 assert.equal(manifest.foundationTilesUnderEntities,covered.size);
 assert.equal(covered.size,34);
 const old=path.join(dir,'history/eight-panels-91f74e8d');
 const oldCode=(await fs.readFile(path.join(old,'orbital-space-science-cell.txt'),'utf8')).trim();
 assert.equal(sha(oldCode),'91f74e8dd607141946d9e7df6dd5edd51692db44bde4e733ed5be34653ed889e');
 assert.equal(JSON.parse(await fs.readFile(path.join(old,'native-report.json'),'utf8')).passed,true);
 assert.match(await fs.readFile(path.join(old,'NOTE.md'),'utf8'),/replaced/);
 assert.equal(decodeBlueprint(oldCode).blueprint.entities.length,28);
});

test('generator reproduces the committed folder byte for byte',async()=>{
 const work=path.resolve('.cache/flight-space-science-unit',String(process.pid));
 await fs.rm(work,{recursive:true,force:true});
 await fs.mkdir(path.join(work,dir,'validation'),{recursive:true});
 await fs.copyFile(path.join(dir,'validation/native-report.json'),path.join(work,dir,'validation/native-report.json'));
 await promisify(execFile)(process.execPath,[path.resolve('scripts/flight-space-science/generate.mjs')],{cwd:work});
 for(const file of [manifest.file,'manifest.json','README.md'])assert.equal(await fs.readFile(path.join(work,dir,file),'utf8'),await fs.readFile(path.join(dir,file),'utf8'),file);
 assert.match(await fs.readFile(path.join(dir,'README.md'),'utf8'),/Passed for this exact string/);
 await fs.rm(work,{recursive:true,force:true});
});
