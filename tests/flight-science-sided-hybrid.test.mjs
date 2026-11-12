import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const root=new URL('../',import.meta.url);
const source=new URL('blueprint-sources/flight-science-sided/hybrid/',root);
const [m]=JSON.parse(fs.readFileSync(new URL('manifest.json',source)));
const code=fs.readFileSync(new URL(m.file,source),'utf8').trim();
const bp=decodeBlueprint(code).blueprint;
const sha=value=>createHash('sha256').update(value).digest('hex');
const byId=new Map(bp.entities.map(e=>[e.entity_number,e]));
const grid=new Map();
for(const e of bp.entities){
 const size=e.name==='assembling-machine-2'?3:e.name==='big-electric-pole'?2:1;
 for(let x=e.position.x-size/2;x<e.position.x+size/2;x++)for(let y=e.position.y-size/2;y<e.position.y+size/2;y++){
  const key=`${x},${y}`;assert(!grid.has(key),`Collision ${e.entity_number} and ${grid.get(key)?.entity_number}`);grid.set(key,e);
 }
}
test('hybrid preserves exact identities and its required ingredient boundary',()=>{
 assert.equal(sha(code),m.blueprintSha256);
 assert.equal(bp.entities.length,byId.size);
 assert.equal(m.gameVersion,'2.1.24');
 for(const e of bp.entities){assert.equal(e.tags.flight_science_entity,e.entity_number);assert(!e.items?.length,'No installed modules');assert(!e.quality||e.quality==='normal');}
 assert.deepEqual(m.inputsPerMinute,{coal:300,'copper-plate':630,'electric-furnace':20,'flying-robot-frame':20,'iron-plate':1290,'low-density-structure':60,'plastic-bar':180,'processing-unit':40,'productivity-module':20,stone:300,'stone-wall':60,'steel-plate':375,sulfur:30});
 const sum={};for(const p of m.inputs)sum[p.item]=(sum[p.item]||0)+p.perMinute;
 assert.deepEqual(sum,m.inputsPerMinute);
 assert.equal(m.products.length,6);
 for(const recipe of ['electronic-circuit','advanced-circuit','engine-unit','rail'])assert(m.machineCounts[recipe]>0);
 for(const item of ['electronic-circuit','advanced-circuit','engine-unit','rail'])assert(!m.inputs.some(p=>p.item===item));
});
test('hybrid exterior ports share left/right edges and clear approaches',()=>{
 const left=new Set(m.inputs.map(p=>p.position.x)),right=new Set(m.outputs.map(p=>p.position.x));
 assert.equal(left.size,1);assert.equal(right.size,1);
 for(const p of m.ports.filter(p=>p.kind!=='power')){
  const e=byId.get(p.entity);assert(e);assert.equal(e.position.x,p.x);assert.equal(e.position.y,p.y);
  const side=p.kind==='input'?'west':'east';assert.equal(p.externalSide,side);
  if(p.kind==='input')assert.equal(e.direction,4);
  const x=Math.floor(p.x)+(p.kind==='input'?-1:1),y=Math.floor(p.y);
  assert(!grid.has(`${x},${y}`),`Blocked ${side} approach: ${p.label}`);
 }
 assert.equal(m.outputs.length,6);
 assert.deepEqual(m.outputs.map(p=>p.item).sort(),[...m.products].sort());
});
test('hybrid component sources remain frozen and intermediate routes have real endpoints',()=>{
 const originals=JSON.parse(fs.readFileSync(new URL('components/manifest.json',source)));
 for(const component of m.components){const original=originals.find(o=>o.id===component.id);assert(original);const originalCode=fs.readFileSync(new URL('components/'+original.file,source),'utf8').trim();assert.equal(sha(originalCode),component.blueprintSha256);assert.equal(original.prototypeSha256,m.prototypeSha256);}
 assert.deepEqual(m.interconnects.map(p=>p.item).sort(),['advanced-circuit','electronic-circuit','engine-unit']);
 for(const route of m.interconnects){assert.equal(byId.get(route.sourceEntity).name,'fast-transport-belt');assert.equal(byId.get(route.consumerEntity).name,'fast-transport-belt');assert(route.route.length>0);assert(!m.inputs.some(p=>p.entity===route.consumerEntity));}
});
test('hybrid full native proof matches the exact blueprint and harness',{skip:m.status!=='native-production-verified'},()=>{
 const report=JSON.parse(fs.readFileSync(new URL('native-report.json',source)));
 assert.equal(report.short,false);assert.equal(report.passed,true);assert(report.warmupMinutes>=15);assert(report.measurementMinutes>=30);
 assert.equal(report.harnessSha256,sha(fs.readFileSync(new URL('tests/flight-science-sided-hybrid-control.lua',root))));
 assert.equal(report.prototypeSha256,m.prototypeSha256);
 const b=report.builds.find(b=>b.id===m.id);assert.equal(b.blueprintSha256,m.blueprintSha256);assert(b.passed&&b.powered);assert.equal(b.importedEntities,bp.entities.length);
 for(const item of m.products){assert(b.outputsPerMinute[item]>=59.5,`${item} below target`);assert(b.recovery?.outputsPerMinute[item]>=59.5,`${item} recovery below target`);}
 assert.equal(b.recovery.blockedMinutes,5);assert.equal(b.recovery.settlingMinutes,2);assert.equal(b.recovery.measurementMinutes,3);
 assert.equal(b.machines.length,Object.values(m.machineCounts).reduce((a,b)=>a+b,0));assert(b.machines.every(x=>x.measuredCrafts>0));
 assert.equal(b.inputs.length,m.inputs.length);assert(b.inputs.every(x=>x.acceptedDuringMeasurement>0&&x.productiveRoute?.length));
 assert.equal(b.outputPorts.length,6);assert(b.outputPorts.every(x=>x.collectedDuringMeasurement>0));
});
