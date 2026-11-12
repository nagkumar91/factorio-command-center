import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
import {constructionMetrics} from '../../experiments/luna-underground/construction-metrics.mjs';
import {auditUndergroundRewrite} from '../flight-underground-audit.mjs';

const optimizerSha256='9f49e92e6d0dc8b2cb1c39653b182b9510bc137207caed0a7efd38949f9b8313';
const baselineFolder='history/suppliers-before-underground';
const selectedFolder='history/suppliers-underground-9f49e92e';
const sha=value=>createHash('sha256').update(value).digest('hex');
const array=value=>{assert(Array.isArray(value)||value&&typeof value==='object'&&Object.keys(value).length===0,'Unexpected native array encoding');return Array.isArray(value)?value:[];};

/** Reproduce only the reviewed supplier rewrites from their native-audited baseline. */
export async function selectSupplierUnderground({root,source,manifest,blueprint,raw}) {
 const read=async(folder,file)=>fs.readFile(path.join(source,folder,file));
 const json=async(folder,file)=>JSON.parse(await read(folder,file));
 const beforeCode=encodeBlueprint({blueprint}),beforeSha=sha(beforeCode);
 const baseline=(await json(baselineFolder,'manifest.json')).find(m=>m.id===manifest.id);
 assert(baseline,'Missing frozen supplier baseline');
 assert.deepEqual(manifest,baseline,'Supplier generation changed outside the reviewed rewrite');
 assert.equal(beforeSha,baseline.blueprintSha256,'Generated supplier differs from the qualified baseline');
 assert.equal(sha((await read(baselineFolder,baseline.file)).toString().trim()),beforeSha);
 const nativeBytes=await read(baselineFolder,'pairing-report.json'),native=JSON.parse(nativeBytes);
 assert(native.passed);assert.equal(native.prototypeSha256,manifest.prototypeSha256);
 assert.equal(native.harnessSha256,sha(await read(baselineFolder,'pairing-control.lua')));
 const snapshot=native.builds.find(b=>b.id===manifest.id);
 assert(snapshot?.passed);assert.equal(snapshot.blueprintSha256,beforeSha,'Native component snapshot is for a different blueprint');
 const optimizerFile=path.join(source,selectedFolder,'optimizer.mjs');
 assert.equal(sha(await fs.readFile(optimizerFile)),optimizerSha256,'Frozen optimizer changed');
 const {optimizeBlueprint}=await import(pathToFileURL(optimizerFile).href);
 const nativeIds=array(snapshot.readAllBeltComponentEntityNumbers);
 const protectedIds=[...new Set([...manifest.inputs,...manifest.outputs,...manifest.ports,...(manifest.fluids||[])].flatMap(p=>[p.entity,p.displayEntity]).filter(Number.isInteger).concat(nativeIds,(manifest.loopControl||[]).flatMap(l=>[l.reader,...(l.controlled||[])]),(blueprint.wires||[]).flatMap(w=>[w[0],w[2]])))].sort((a,b)=>a-b);
 const optimized=optimizeBlueprint({blueprint},{maxDistance:7,protectedEntityNumbers:protectedIds,nativeReadAllBeltComponentEntityNumbers:nativeIds,nativeReadAllBeltComponentBaselineSha256:beforeSha});
 assert(!optimized.metrics.aborted);
 const audit=auditUndergroundRewrite({blueprint},optimized.wrapper,optimized.changePairs,protectedIds);
 const selected=(await json(selectedFolder,'manifest.json')).find(m=>m.id===manifest.id);
 if(!selected){
  assert.equal(optimized.changePairs.length,0,'Unreviewed supplier rewrite');
  assert.equal(encodeBlueprint(optimized.wrapper),beforeCode,'Unreviewed supplier changed');
  return {code:beforeCode,manifest};
 }
 const code=encodeBlueprint(optimized.wrapper);
 assert.equal(sha(code),selected.blueprintSha256,'Rewrite does not reproduce the selected blueprint');
 assert.equal(code,(await read(selectedFolder,selected.file)).toString().trim());
 const metadata=selected.undergroundOptimization;
 assert.equal(metadata.optimizerSha256,optimizerSha256);assert.equal(metadata.baselineBlueprintSha256,beforeSha);
 assert.equal(metadata.nativeBaselineAuditSha256,sha(nativeBytes));
 assert.deepEqual(protectedIds,metadata.protectedEntityNumbers);
 assert.deepEqual(optimized.changePairs,metadata.pairs);
 assert.deepEqual(constructionMetrics(decodeBlueprint(beforeCode),raw),metadata.before);
 assert.deepEqual(constructionMetrics(optimized.wrapper,raw),metadata.after);
 assert.deepEqual(audit,metadata.rewriteAudit);
 const pairing=await json(selectedFolder,'pairing-report.json'),actual=pairing.builds.find(b=>b.id===manifest.id);
 assert(pairing.passed&&actual?.passed);assert.equal(actual.blueprintSha256,selected.blueprintSha256);
 assert.equal(pairing.prototypeSha256,manifest.prototypeSha256);
 assert.equal(pairing.harnessSha256,sha(await read(selectedFolder,'pairing-control.lua')));
 assert.deepEqual(array(actual.readAllBeltComponentEntityNumbers),nativeIds);
 assert.deepEqual(array(actual.pairs).map(({entity,role,neighbour,matched})=>{assert(matched);return {entity,role,neighbour};}),selected.undergroundEndpointAudit.toSorted((a,b)=>a.entity-b.entity));
 const qualification=await json(selectedFolder,'native-report.json'),proof=qualification.builds.find(b=>b.id===manifest.id);
 assert(qualification.passed&&!qualification.short&&proof?.passed);
 assert.equal(qualification.prototypeSha256,manifest.prototypeSha256);
 assert.equal(qualification.harnessSha256,sha(await read(selectedFolder,'qualification-control.lua')));
 assert.equal(qualification.harnessSha256,sha(await fs.readFile(path.join(root,'tests/flight-science-sided-control.lua'))));
 assert.equal(proof.blueprintSha256,selected.blueprintSha256);
 assert.equal(qualification.warmupMinutes,15);assert.equal(qualification.measurementMinutes,30);
 assert.equal(proof.recovery.blockedMinutes,5);assert.equal(proof.recovery.settlingMinutes,2);assert.equal(proof.recovery.measurementMinutes,3);
 assert(manifest.products.every(n=>proof.outputsPerMinute[n]>=manifest.targetPerMinute-.5&&proof.recovery.outputsPerMinute[n]>=manifest.targetPerMinute-.5));
 assert(proof.machines.every(m=>m.measuredCrafts>0));
 const result=structuredClone(selected);
 result.undergroundOptimization.baselineFile=path.join(baselineFolder,baseline.file);
 result.undergroundOptimization.optimizerFile=path.join(selectedFolder,'optimizer.mjs');
 result.undergroundOptimization.nativeBaselinePairingEvidence={file:path.join(baselineFolder,'pairing-report.json'),controlFile:path.join(baselineFolder,'pairing-control.lua'),reportSha256:sha(nativeBytes),harnessSha256:native.harnessSha256};
 result.undergroundOptimization.nativePairingEvidence={...result.undergroundOptimization.nativePairingEvidence,file:path.join(selectedFolder,'pairing-report.json'),controlFile:path.join(selectedFolder,'pairing-control.lua')};
 return {code,manifest:result};
}
