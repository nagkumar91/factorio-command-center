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
 // The published string is the underground-belt rewrite of the pair-swapped baseline (one cable assembler fewer, gear and pipe at the bottom row's east end).
 const u=m.undergroundOptimization;assert.ok(u,'published version records its underground step');
 assert.equal(m.id,'robots-10-roboport-1');assert.equal(m.file,'robots-10-roboport-1.txt');
 assert.equal(m.nativeEvidence.buildId,'robots-10-roboport-1');assert.equal(report.builds.length,1);
 assert.deepEqual({width:m.footprint.width,height:m.footprint.height},{width:96,height:18});
 assert.equal(Object.values(m.machineCounts).reduce((a,b)=>a+b,0),48);assert.equal(m.machineCounts['copper-cable'],7);assert.equal(m.machineCounts.battery,3);
 assert.equal(u.baselineBlueprintSha256,'0512b42657485fad93bd0ee47e5999eba11e9f80c58ddc83a29a3035c4677add');
 const baseDir=new URL(u.baselineFolder+'/',dir),[bm]=JSON.parse(fs.readFileSync(new URL('manifest.json',baseDir)));
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL(bm.file,baseDir),'utf8').trim()).digest('hex'),u.baselineBlueprintSha256);assert.equal(bm.blueprintSha256,u.baselineBlueprintSha256);
 const baseReport=JSON.parse(fs.readFileSync(new URL('native-report.json',baseDir))),bn=baseReport.builds.find(b=>b.blueprintSha256===u.baselineBlueprintSha256);
 assert.ok(bn?.passed&&baseReport.short===false&&baseReport.harnessSha256===report.harnessSha256,'baseline has its own passing full report under the same harness');
 assert.equal(u.before.placedEntities-u.after.placedEntities,15);assert.equal(u.before.redBelts-u.after.redBelts,21);
 assert.equal(u.after.redUndergroundEndpoints-u.before.redUndergroundEndpoints,6);
 assert.equal(u.after.redBeltConstructionIronPlates-u.before.redBeltConstructionIronPlates,51);assert.equal(u.pairs.length,3);
 const pair=JSON.parse(fs.readFileSync(new URL('native-pairing-report.json',dir)));
 assert.equal(pair.blueprintSha256,m.blueprintSha256);assert.equal(pair.expectedPairsChecked,u.pairs.length);assert.equal(pair.passed,true);
 assert.equal(pair.undergroundInputPairs.length,6);assert.equal(Object.keys(pair.unpairedUndergroundInputs).length,0);
 for(const p of u.pairs)assert.ok(pair.undergroundInputPairs.some(n=>n.inputEntityNumber===p.inputEntityNumber&&n.outputEntityNumber===p.outputEntityNumber),'declared pair formed natively');
 const snapshot=JSON.parse(fs.readFileSync(new URL('native-read-all-snapshot.json',dir)));assert.equal(snapshot.blueprintSha256,u.baselineBlueprintSha256);
 const proof=JSON.parse(fs.readFileSync(new URL('underground-proof.json',dir)));assert.equal(proof.status,'passed');assert.equal(proof.candidateBlueprintSha256,m.blueprintSha256);assert.ok(proof.assertions.every(a=>a.passed));
 for(const [file,hash]of [[m.nativeEvidence.pairedReportFile,m.nativeEvidence.pairedReportSha256],[m.nativeEvidence.pairingReportFile,m.nativeEvidence.pairingReportSha256],[m.nativeEvidence.qualificationSummaryFile,m.nativeEvidence.qualificationSummarySha256]])
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,dir))).digest('hex'),hash,'evidence hash '+file);
});
test('both qualified versions are listed newest first with their own measured rates (shared versions convention)',()=>{
 const [m]=JSON.parse(fs.readFileSync(new URL('manifest.json',dir)));
 assert.ok(Array.isArray(m.versions));
 assert.deepEqual(m.versions.map(v=>[v.label,v.blueprintSha256,v.width,v.height,v.tiles,v.machines]),[
  ['Smaller, pair swapped','120a56b5bf85f2f8b50414f0575e28cc7e036fbb13f83cbd7209539d298ca5d6',96,18,1728,48],
  ['Earlier, one more assembler','30edbea366140a650cf0aedaaef9ef6e35f8d52c9d72161b3c935173b2374386',106,18,1908,49]]);
 const [current,earlier]=m.versions;
 assert.equal(current.blueprintSha256,m.blueprintSha256);assert.equal(current.file,m.file);assert.equal(current.report,'native-report.json');
 assert.equal(earlier.file,'history/luna-underground-30edbea3/robots-10-roboport-1.txt');assert.equal(earlier.manifest,'history/luna-underground-30edbea3/selected-manifest.json');
 const crafts={};
 for(const v of m.versions){
  assert.deepEqual(Object.keys(v).sort(),['blueprintSha256','file','height','label','machines','outputsPerMinute','report','summary','tiles','width',...(v.manifest?['manifest']:[])].sort(),'only the convention keys '+v.label);
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL(v.file,dir),'utf8').trim()).digest('hex'),v.blueprintSha256,'version file hash '+v.label);
  const own=v.manifest?JSON.parse(fs.readFileSync(new URL(v.manifest,dir))).find(e=>e.blueprintSha256===v.blueprintSha256):m;assert.ok(own,'version manifest '+v.label);
  assert.deepEqual([v.width,v.height],[own.footprint.width,own.footprint.height]);
  assert.equal(v.machines,Object.values(own.machineCounts).reduce((a,b)=>a+b,0));
  const vr=JSON.parse(fs.readFileSync(new URL(v.report,dir))),vb=vr.builds.find(b=>b.blueprintSha256===v.blueprintSha256&&b.passed===true);
  assert.ok(vb&&vr.short===false&&vr.measurementMinutes===30&&vr.prototypeSha256===m.prototypeSha256,'exact-hash passing full report for '+v.label);
  assert.deepEqual(v.outputsPerMinute,{steady:vb.outputsPerMinute,recovery:vb.recovery.outputsPerMinute});
  for(const [item,target]of Object.entries(m.targets)){assert.ok(vb.outputsPerMinute[item]>=target-.05);assert.ok(vb.recovery.outputsPerMinute[item]>=target-.05);}
  const count=(rates,minutes)=>Object.fromEntries(Object.entries(rates).map(([k,r])=>[k,Math.round(r*minutes)]));
  crafts[v.label]={steady:count(vb.outputsPerMinute,vr.measurementMinutes),recovery:count(vb.recovery.outputsPerMinute,vb.recovery.measurementMinutes)};
 }
 // Accepted trade (user decision 2026-11-21): one machine fewer and >=5% fewer tiles, measured crafts at most three per window below the earlier version.
 assert.equal(current.machines,earlier.machines-1);assert.ok(current.tiles<=earlier.tiles*.95);
 assert.deepEqual(crafts[current.label].steady,{'construction-robot':303,'logistic-robot':304,roboport:30});
 assert.deepEqual(crafts[earlier.label].steady,{'construction-robot':304,'logistic-robot':304,roboport:32});
 for(const item of Object.keys(m.targets))for(const window of ['steady','recovery'])assert.ok(crafts[current.label][window][item]>=crafts[earlier.label][window][item]-3,`${item} ${window} crafts`);
 const note=fs.readFileSync(new URL(earlier.file.replace(/[^/]+$/,'NOTE.md'),dir),'utf8');assert.match(note,/earlier/i);
});
