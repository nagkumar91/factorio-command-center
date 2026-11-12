import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const dir=new URL('../blueprint-sources/flight-robots/',import.meta.url);
test('robot workshop has unique inlets, one shared capped chest and matching native evidence',()=>{
 const [m]=JSON.parse(fs.readFileSync(new URL('manifest.json',dir)));
 const code=fs.readFileSync(new URL(m.file,dir),'utf8').trim();
 assert.equal(createHash('sha256').update(code).digest('hex'),m.blueprintSha256);
 const bp=decodeBlueprint(code).blueprint,ids=new Map(bp.entities.map(e=>[e.entity_number,e]));
 assert.equal(new Set(m.inputs.map(p=>p.item)).size,m.inputs.length);
 assert.equal(new Set(m.outputs.map(p=>p.entity)).size,1);
 assert.equal(bp.entities.filter(e=>e.name.includes('chest')).length,1);
 assert.ok(bp.entities.filter(e=>e.recipe).every(e=>['assembling-machine-2','chemical-plant'].includes(e.name)&&!e.items));
 assert.equal(m.fluids.length,2);assert.equal(m.fluids[0].item,'lubricant');
 for(const p of m.ports.filter(p=>['input','fluid'].includes(p.kind)))assert.equal(ids.get(p.displayEntity)?.icon.name,p.items[0]);
 for(const p of m.ports.filter(p=>['input','fluid'].includes(p.kind))){
  const y=p.y+(p.externalSide==='north'?-1:1);
  assert.ok(!bp.entities.some(e=>{const half=['chemical-plant','assembling-machine-2'].includes(e.name)?1.5:e.name==='big-electric-pole'?1:.5;return Math.abs(e.position.x-p.x)<half&&Math.abs(e.position.y-y)<half;}),'blocked exterior approach: '+p.items[0]);
 }
 const graph=new Map();for(const [a,ac,b,bc]of bp.wires.filter(w=>w[1]===1&&w[3]===1)){(graph.get(a)||graph.set(a,new Set()).get(a)).add(b);(graph.get(b)||graph.set(b,new Set()).get(b)).add(a);}
 const connected=id=>{const q=[id],seen=new Set(q);for(let i=0;i<q.length;i++)for(const n of graph.get(q[i])||[])if(!seen.has(n)){seen.add(n);q.push(n);}return seen;};
 const stockNetwork=connected(m.loopControl[0].reader),chestNetwork=connected(m.outputs[0].entity);
 assert.ok(![...chestNetwork].some(id=>stockNetwork.has(id)));
 for(const p of m.outputs){const arm=[...chestNetwork].map(id=>ids.get(id)).find(e=>e.name==='fast-inserter'&&e.filters?.[0].name===p.item);assert.equal(arm.control_behavior.circuit_condition.constant,p.cap);}
 const report=JSON.parse(fs.readFileSync(new URL('native-report.json',dir))),testedBuildId=m.nativeEvidence?.buildId||m.id,n=report.builds.find(b=>b.id===testedBuildId&&b.blueprintSha256===m.blueprintSha256);
 assert.ok(n,'missing exact-hash native build '+testedBuildId);
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL('flight-robots-control.lua',import.meta.url))).digest('hex'),report.harnessSha256);assert.equal(report.prototypeSha256,m.prototypeSha256);assert.equal(report.short,false);assert.equal(report.measurementMinutes,30);assert.equal(n.blueprintSha256,m.blueprintSha256);assert.equal(n.passed,true);assert.equal(n.powered,true);
 for(const [item,target]of Object.entries(m.targets)){assert.ok(n.outputsPerMinute[item]>=target-.05);assert.ok(n.recovery.outputsPerMinute[item]>=target-.05);assert.equal(n.recovery.blockedStock[item],m.outputs.find(p=>p.item===item).cap);}
 assert.ok(n.inputs.every(p=>p.productiveRoute.length&&p.acceptedDuringMeasurement>0));assert.ok(n.machines.every(p=>p.measuredCrafts>0));assert.equal(n.fluids[0].productiveConsumers.length,m.machineCounts['electric-engine-unit']);
 if(m.undergroundOptimization){
  const u=m.undergroundOptimization;
  assert.equal(m.id,'robots-10-roboport-1');assert.equal(m.file,'robots-10-roboport-1.txt');
  assert.equal(m.nativeEvidence.buildId,'robots-underground-candidate');assert.equal(report.builds.length,2);
  assert.equal(u.baselineBlueprintSha256,'1b76c53283330f3660e258e08e74b2a0c42a762f92ee37b4e9e439214c1d77b2');
  assert.equal(u.before.placedEntities-u.after.placedEntities,20);assert.equal(u.before.redBelts-u.after.redBelts,28);
  assert.equal(u.after.redBeltConstructionIronPlates-u.before.redBeltConstructionIronPlates,68);assert.equal(u.pairs.length,4);
  const pair=JSON.parse(fs.readFileSync(new URL('native-pairing-report.json',dir)));
  assert.equal(pair.blueprintSha256,m.blueprintSha256);assert.equal(pair.expectedPairsChecked,u.pairs.length);assert.equal(pair.passed,true);
  assert.equal(pair.undergroundInputPairs.length,7);assert.equal(pair.unpairedUndergroundInputs.length??Object.keys(pair.unpairedUndergroundInputs||{}).length,0);
  const proof=JSON.parse(fs.readFileSync(new URL('underground-proof.json',dir)));assert.equal(proof.status,'passed');assert.equal(proof.candidateBlueprintSha256,m.blueprintSha256);
 }
});
