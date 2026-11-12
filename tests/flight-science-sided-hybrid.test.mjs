import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {auditUndergroundRewrite} from '../scripts/flight-underground-audit.mjs';
import {optimizeBlueprint} from '../scripts/flight-science-sided/hybrid/underground/optimizer.mjs';
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

test('hybrid v2 changes only two stock limits and preserves the published v1 proof',()=>{
 const priorCode=fs.readFileSync(new URL('history/first-native/'+m.file,source),'utf8').trim();
 assert.equal(sha(priorCode),'da625c002d67bfd9959e84b5ee7cc61f0fe97ea20494de5085895dd754ca7d79');
 const stockCode=fs.readFileSync(new URL('history/pre-underground-ac9fca587c69/'+m.file,source),'utf8').trim();
 assert.equal(sha(stockCode),'ac9fca587c69eebf93c587406f9dd02df4b0dd124352cdce66c5a2b6f650cb3c');
 const prior=decodeBlueprint(priorCode).blueprint,restored=decodeBlueprint(stockCode).blueprint;
 let reverted=0;for(const e of restored.entities){const c=e.control_behavior?.circuit_condition,n=c?.first_signal?.name;if(n==='sulfur'){assert.equal(c.constant,40);c.constant=24;reverted++;}if(n==='transport-belt'){assert.equal(c.constant,64);c.constant=48;reverted++;}}
 assert.equal(reverted,2);assert.deepEqual(restored,prior);
 const history=JSON.parse(fs.readFileSync(new URL('history/first-native/native-report.json',source)));assert(history.passed);assert.equal(history.builds[0].blueprintSha256,sha(priorCode));
 assert.equal(fs.readFileSync(new URL('site/flight-science-sided/hybrid/history/da625c-blueprint.txt',root),'utf8').trim(),priorCode);
 assert.deepEqual(JSON.parse(fs.readFileSync(new URL('site/flight-science-sided/hybrid/history/da625c-native-report.json',root))),history);
});
test('hybrid underground rewrite preserves protected entities and every native pair',()=>{
 const archive=new URL('history/pre-underground-ac9fca587c69/',source),original=decodeBlueprint(fs.readFileSync(new URL(m.file,archive),'utf8').trim());
 const old=JSON.parse(fs.readFileSync(new URL('pairing-report.json',archive))).builds[0],metadata=m.undergroundOptimization;
 assert.equal(old.blueprintSha256,metadata.baselineBlueprintSha256);
 assert.equal(sha(fs.readFileSync(new URL('scripts/flight-science-sided/hybrid/underground/optimizer.mjs',root))),metadata.optimizerSha256);
 const rewritten=optimizeBlueprint(original,{maxDistance:7,minSpan:5,protectedEntityNumbers:metadata.protectedEntityNumbers,nativeReadAllBeltComponentEntityNumbers:old.readAllBeltComponentEntityNumbers,nativeReadAllBeltComponentBaselineSha256:old.blueprintSha256});
 assert.deepEqual(rewritten.wrapper.blueprint,bp);assert.deepEqual(rewritten.changePairs,metadata.pairs);
 assert.deepEqual(auditUndergroundRewrite(original,{blueprint:bp},metadata.pairs,metadata.protectedEntityNumbers),metadata.rewriteAudit);
 assert.equal(metadata.before.placedEntities-metadata.after.placedEntities,385);assert.equal(metadata.after.redBeltConstructionIronPlates-metadata.before.redBeltConstructionIronPlates,638.5);assert.equal(m.footprint.width,114);assert.equal(m.footprint.height,75);
 const expected=m.undergroundEndpointAudit.map(({entity,role,neighbour})=>({entity,role,neighbour})).sort((a,b)=>a.entity-b.entity);
 assert.equal(expected.length,234);assert.equal(metadata.pairs.length,68);assert.equal(old.pairs.length,98);
 for(const pair of old.pairs)assert.deepEqual(expected.find(p=>p.entity===pair.entity),{entity:pair.entity,role:pair.role,neighbour:pair.neighbour});
 const pairing=JSON.parse(fs.readFileSync(new URL('evidence/underground/pairing-report.json',source))),qualification=JSON.parse(fs.readFileSync(new URL('native-report.json',source))),stress=JSON.parse(fs.readFileSync(new URL('evidence/storage-30/report.json',source)));
 for(const r of [pairing,qualification,stress])assert.equal(r.undergroundAuditModuleSha256,sha(fs.readFileSync(new URL('tests/flight-science-sided-hybrid-underground-audit.lua',root))));
 for(const snapshot of [pairing.builds[0],qualification.builds[0].undergroundAuditStart,qualification.builds[0].undergroundAuditEnd,stress.builds[0].undergroundAuditStart,stress.builds[0].undergroundAuditEnd]){assert(snapshot.passed);assert.equal(snapshot.blueprintSha256,m.blueprintSha256);assert(snapshot.pairs.every(p=>p.matched));assert.deepEqual(snapshot.pairs.map(({entity,role,neighbour})=>({entity,role,neighbour})),expected);assert.deepEqual(snapshot.readAllBeltComponents,old.readAllBeltComponents);}
 const svg=fs.readFileSync(new URL('site/flight-science-sided/hybrid/'+m.id+'.svg',root),'utf8');assert.equal((svg.match(/class="underground-tunnel"/g)||[]).length,68);assert(svg.indexOf('class="underground-tunnel"')<svg.indexOf('<g><title>'));
});
test('hybrid preserves ac9 qualification and full-storage history with matching controls and downloads',()=>{
 const archive=new URL('history/pre-underground-ac9fca587c69/',source),previous=fs.readFileSync(new URL(m.file,archive),'utf8').trim(),previousHash=sha(previous);
 for(const [reportFile,controlFile,download]of [['native-report.json','native-control.lua','ac9fca-native-report.json'],['storage-30-report.json','storage-30-control.lua','ac9fca-storage-stress-report.json']]){
  const bytes=fs.readFileSync(new URL(reportFile,archive)),report=JSON.parse(bytes);assert(report.passed);assert.equal(report.builds[0].blueprintSha256,previousHash);assert.equal(report.harnessSha256,sha(fs.readFileSync(new URL(controlFile,archive))));assert.deepEqual(fs.readFileSync(new URL('site/flight-science-sided/hybrid/history/'+download,root)),bytes);
 }
 assert.equal(fs.readFileSync(new URL('site/flight-science-sided/hybrid/history/ac9fca-blueprint.txt',root),'utf8').trim(),previous);
 assert.deepEqual(fs.readFileSync(new URL('evidence/storage-30/control.lua',source)),fs.readFileSync(new URL('tests/flight-science-sided-hybrid-storage-30-control.lua',root)));
});
test('hybrid storage stress proves actual production after full backpressure',()=>{
 const report=JSON.parse(fs.readFileSync(new URL('evidence/storage-30/report.json',source))),b=report.builds[0];
 assert(report.passed&&b.passed&&b.stressPassed);assert.equal(b.blueprintSha256,m.blueprintSha256);
 assert.equal(report.harnessSha256,sha(fs.readFileSync(new URL('tests/flight-science-sided-hybrid-storage-30-control.lua',root))));
 assert.equal(report.prototypeSha256,m.prototypeSha256);
 assert.equal(b.recovery.blockedMinutes,30);assert.equal(b.recovery.settlingMinutes,2);assert.equal(b.recovery.measurementMinutes,3);
 const stress=b.stress;assert(stress.allChestsFullForFinalWindow&&stress.allScienceProductionZero&&stress.allScienceMachineCraftsZero);assert.equal(stress.finalWindowSamples,121);assert.equal(stress.chests.length,6);
 for(const c of stress.chests){assert.equal(c.fullSamples,121);assert(c.fullAtPauseEnd);assert.equal(c.minimumAccessibleCount,c.accessibleCapacity);assert.equal(c.finalAccessibleCount,c.accessibleCapacity);}
 assert.equal(stress.scienceMachineCraftsFinalWindow.length,60);assert(stress.scienceMachineCraftsFinalWindow.every(x=>x.craftsDuringFinalWindow===0));
 assert(b.recoveryCrafted.productionStatisticsAgree);
 for(const item of m.products){assert.equal(stress.scienceProductionInFinalWindow[item],0);assert(b.recoveryCrafted.craftedPerMinute[item]>=60);assert.equal(b.recoveryCrafted.productionStatisticsDelta[item],b.recoveryCrafted.crafted[item]);assert.equal(b.recoveryCrafted.productionStatisticsPerMinute[item],b.recoveryCrafted.craftedPerMinute[item]);}
});
