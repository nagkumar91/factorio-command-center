import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const dir=new URL('../blueprint-sources/flight-science/',import.meta.url);
test('compact science saves at least 70% of area with verified independent stock-control networks',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir))),old=JSON.parse(fs.readFileSync(new URL('history/v1-bus/manifest.json',dir))),report=JSON.parse(fs.readFileSync(new URL('native-report.json',dir)));
 for(const m of manifest){
  const prev=old.find(p=>p.id===m.id),native=report.builds.find(p=>p.id===m.id);assert.ok(m.footprint.width*m.footprint.height<prev.footprint.width*prev.footprint.height*.3);
  assert.equal(m.loopControl.length,m.products.length===3?3:4);
  const b=decodeBlueprint(fs.readFileSync(new URL(m.file,dir),'utf8').trim()).blueprint;
  const ids=new Map(b.entities.map(e=>[e.entity_number,e]));
  for(const p of m.ports.filter(p=>p.kind==='input'))assert.equal(ids.get(p.displayEntity)?.icon.name,p.items[0]);
  const adjacency=new Map();for(const [a,ac,z,zc]of b.wires.filter(w=>w[1]===1&&w[3]===1)){assert.ok(ids.has(a)&&ids.has(z));(adjacency.get(a)||adjacency.set(a,new Set()).get(a)).add(z);(adjacency.get(z)||adjacency.set(z,new Set()).get(z)).add(a);}
  const nets=[];
  for(const loop of m.loopControl){
   const seen=new Set([loop.reader]),q=[loop.reader];for(let i=0;i<q.length;i++)for(const n of adjacency.get(q[i])||[])if(!seen.has(n)){seen.add(n);q.push(n);}
   assert.ok(loop.controlled.every(id=>seen.has(id)));assert.ok(loop.loop.every(id=>seen.has(id)));assert.ok(nets.every(net=>![...seen].some(id=>net.has(id))));nets.push(seen);
   assert.equal(ids.get(loop.reader).control_behavior.circuit_contents_read_mode,2);
   assert.ok(native.loopSamples[loop.name].maxStock<loop.capacity*.9);
  }
  assert.equal(native.recovery.blockedMinutes,5);for(const rate of Object.values(native.recovery.outputsPerMinute))assert.ok(rate>=59.5);
 }
});
test('revised compact science replaces the first compact version in place with less area and fewer assemblers',()=>{
 const history=new URL('history/compact-loops-8c30528a-d9842cff/',dir);
 const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir))),previous=JSON.parse(fs.readFileSync(new URL('manifest.json',history))),previousReport=JSON.parse(fs.readFileSync(new URL('native-report.json',history)));
 const sha=s=>createHash('sha256').update(s).digest('hex');
 const total=m=>Object.values(m.machineCounts).reduce((a,b)=>a+b,0);
 const entrances=m=>m.inputs.map(p=>({item:p.item,block:p.block,perMinute:p.perMinute,side:m.ports.find(q=>q.entity===p.entity).externalSide,x:p.position.x})).sort((a,b)=>a.block.localeCompare(b.block)||a.side.localeCompare(b.side)||a.x-b.x).map(({x,...rest})=>rest);
 assert.deepEqual(previous.map(m=>m.id),manifest.map(m=>m.id));
 for(const m of manifest){
  const old=previous.find(p=>p.id===m.id);
  assert.equal(sha(fs.readFileSync(new URL(old.file,history),'utf8').trim()),old.blueprintSha256);
  const oldNative=previousReport.builds.find(b=>b.id===m.id);assert.equal(oldNative.blueprintSha256,old.blueprintSha256);assert.equal(oldNative.passed,true);
  assert.deepEqual(m.products,old.products);
  assert.deepEqual(entrances(m),entrances(old));
  assert.deepEqual(m.outputs.map(p=>p.item).sort(),old.outputs.map(p=>p.item).sort());
  assert.ok(m.footprint.width*m.footprint.height<=old.footprint.width*old.footprint.height*.95,`${m.id} area`);
  assert.equal(m.footprint.height,old.footprint.height);
  assert.ok(total(m)<total(old),`${m.id} assemblers`);
  assert.equal(m.machineCounts['copper-cable'],9);assert.equal(m.machineCounts['electronic-circuit'],4);
  for(const [recipe,count]of Object.entries(old.machineCounts))if(!['copper-cable','electronic-circuit'].includes(recipe))assert.equal(m.machineCounts[recipe],count,recipe);
 }
 assert.deepEqual(manifest.map(m=>[m.footprint.width,m.footprint.height,total(m)]),[[86,30,80],[101,30,97]]);
 assert.ok(fs.readFileSync(new URL('NOTE.md',history),'utf8').trim().length>0);
});
