import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const dir=new URL('../blueprint-sources/flight-science/',import.meta.url);
const manifests=JSON.parse(fs.readFileSync(new URL('manifest.json',dir)));
test('science pair has the agreed materials, rates, equipment and source identity',()=>{
 assert.equal(manifests.length,2);
 for(const m of manifests){
  const military=m.id.includes('military');
  const expected={'iron-plate':military?1140:870,'copper-plate':military?630:600,'steel-plate':military?75:60,'plastic-bar':180,sulfur:30,...(military?{'stone-wall':60,coal:300}:{})};
  assert.deepEqual(m.inputs.reduce((a,p)=>(a[p.item]=(a[p.item]||0)+p.perMinute,a),{}),expected);
  assert.equal(m.targetPerMinute,60);
  const code=fs.readFileSync(new URL(m.file,dir),'utf8').trim();
  assert.equal(createHash('sha256').update(code).digest('hex'),m.blueprintSha256);
  const b=decodeBlueprint(code).blueprint;
  const allowed=new Set(['assembling-machine-2','fast-inserter','fast-transport-belt','fast-underground-belt','fast-splitter','wooden-chest','medium-electric-pole','big-electric-pole','display-panel']);
  for(const e of b.entities){assert.ok(allowed.has(e.name),e.name);assert.ok(!e.items?.length);}
  for(const p of [...m.inputs,...m.outputs]){
   const e=b.entities.find(e=>e.entity_number===p.entity);assert.ok(e);assert.deepEqual(e.position,p.position);
  }
  const actual={};for(const e of b.entities.filter(e=>e.recipe))actual[e.recipe]=(actual[e.recipe]||0)+1;
  assert.deepEqual(actual,m.machineCounts);
  assert.deepEqual(new Set(m.outputs.map(p=>p.item)),new Set(m.products));
 }
});
test('published science strings have matching full native evidence at every port',()=>{
 const r=JSON.parse(fs.readFileSync(new URL('native-report.json',dir)));
 assert.equal(r.short,false);assert.equal(r.passed,true);assert.equal(r.warmupMinutes,15);assert.equal(r.measurementMinutes,30);
 for(const m of manifests){const b=r.builds.find(b=>b.id===m.id);assert.ok(b);assert.equal(b.blueprintSha256,m.blueprintSha256);assert.equal(b.passed,true);assert.equal(b.powered,true);
  for(const p of m.products)assert.ok(b.outputsPerMinute[p]>=59.5,`${m.id} ${p}`);
  for(const p of b.inputs){assert.ok(p.acceptedDuringMeasurement>0);assert.ok(p.productiveRoute.length>1);}
  for(const p of b.outputPorts)assert.ok(p.collectedDuringMeasurement>0);
  for(const machine of b.machines)assert.ok(machine.measuredCrafts>0);
 }
 const book=decodeBlueprint(fs.readFileSync(new URL('flight-science-book.txt',dir),'utf8').trim()).blueprint_book;
 assert.equal(book.blueprints.length,2);
 for(const b of book.blueprints)assert.equal(b.blueprint.entities.filter(e=>e.name==='assembling-machine-2').length,Object.values(manifests[b.index].machineCounts).reduce((a,b)=>a+b,0));
});
