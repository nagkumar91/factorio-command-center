import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../../../blueprints.mjs';
import {auditUndergroundRewrite} from '../../../flight-underground-audit.mjs';
import {constructionMetrics} from '../../../../experiments/luna-underground/construction-metrics.mjs';
import {optimizeBlueprint} from './optimizer.mjs';

export const BASELINE_SHA256='ac9fca587c69eebf93c587406f9dd02df4b0dd124352cdce66c5a2b6f650cb3c';
export const APPROVED_SHA256='84bf7dbccc5fd44d6fffa164f2c559d79d85ea93971c878f14a36c535f5ab473';
export const OPTIMIZER_SHA256='9f49e92e6d0dc8b2cb1c39653b182b9510bc137207caed0a7efd38949f9b8313';
export const SNAPSHOT_SHA256='09cfa29494a0d2796439882464eff193808a1d56ec03ec6200de3cded15fc6af';
const source=new URL('../../../../blueprint-sources/flight-science-sided/hybrid/',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sorted=ids=>[...new Set(ids)].sort((a,b)=>a-b);

// Regenerate only the reviewed rewrite of the exact frozen hybrid baseline.
// Native read-all membership replaces geometry guesses; its source hash is
// checked here because the optimizer validates only the hash's format.
export async function rewriteHybridUnderground(before,manifest,raw){
 assert.equal(sha(encodeBlueprint(before)),BASELINE_SHA256,'Hybrid baseline changed; new native review required');
 assert.equal(manifest.blueprintSha256,BASELINE_SHA256);
 assert.equal(sha(await fs.readFile(new URL('optimizer.mjs',import.meta.url))),OPTIMIZER_SHA256,'Frozen optimizer changed');
 const snapshotBytes=await fs.readFile(new URL('history/pre-underground-ac9fca587c69/pairing-report.json',source));
 assert.equal(sha(snapshotBytes),SNAPSHOT_SHA256,'Frozen native topology evidence changed');
 const report=JSON.parse(snapshotBytes),snapshot=report.builds.find(b=>b.id===manifest.id);
 assert(report.passed&&snapshot?.passed);assert.equal(snapshot.blueprintSha256,sha(encodeBlueprint(before)),'Native snapshot differs from caller source');assert.equal(report.prototypeSha256,manifest.prototypeSha256);
 const protectedEntityNumbers=sorted([
  ...[...manifest.ports,...manifest.inputs,...manifest.outputs,...manifest.fluids||[]].flatMap(p=>[p.entity,p.displayEntity]).filter(Number.isInteger),
  ...manifest.loopControl.flatMap(l=>[l.reader,...l.controlled]),
  ...(before.blueprint.wires||[]).flatMap(w=>[w[0],w[2]]),
  ...snapshot.readAllBeltComponentEntityNumbers,
 ]);
 const optimized=optimizeBlueprint(before,{maxDistance:7,minSpan:5,protectedEntityNumbers,nativeReadAllBeltComponentEntityNumbers:snapshot.readAllBeltComponentEntityNumbers,nativeReadAllBeltComponentBaselineSha256:snapshot.blueprintSha256});
 assert(!optimized.metrics.aborted);assert.equal(sha(encodeBlueprint(optimized.wrapper)),APPROVED_SHA256,'Rewrite differs from reviewed native artifact');
 const pairs=optimized.changePairs,rewriteAudit=auditUndergroundRewrite(before,optimized.wrapper,pairs,protectedEntityNumbers);
 const undergroundOptimization={baselineBlueprintSha256:BASELINE_SHA256,optimizerSha256:OPTIMIZER_SHA256,nativeSnapshotSha256:SNAPSHOT_SHA256,before:constructionMetrics(before,raw),after:constructionMetrics(optimized.wrapper,raw),pairs,protectedEntityNumbers,nativeReadAllBeltComponentEntityNumbers:snapshot.readAllBeltComponentEntityNumbers,metrics:optimized.metrics,rewriteAudit,draft:false};
 const nativeValidation={};
 for(const [name,file]of Object.entries({pairing:'evidence/underground/pairing-report.json',qualification:'native-report.json',storage30:'evidence/storage-30/report.json'})){
  const bytes=await fs.readFile(new URL(file,source)),evidence=JSON.parse(bytes),build=evidence.builds.find(b=>b.id===manifest.id&&b.blueprintSha256===APPROVED_SHA256);
  assert(evidence.passed&&build?.passed,'Missing exact native proof: '+name);assert.equal(evidence.prototypeSha256,manifest.prototypeSha256);
  nativeValidation[name]={file,sha256:sha(bytes),passed:true,harnessSha256:evidence.harnessSha256,undergroundAuditModuleSha256:evidence.undergroundAuditModuleSha256,runnerSha256:evidence.runnerSha256};
 }
 undergroundOptimization.nativeValidation=nativeValidation;
 return {wrapper:optimized.wrapper,manifest:{...manifest,blueprintSha256:APPROVED_SHA256,previousBlueprintSha256:BASELINE_SHA256,construction:undergroundOptimization.after.inventory,revision:{kind:'protected-underground-rewrite',baseBlueprintSha256:BASELINE_SHA256,optimizerSha256:OPTIMIZER_SHA256,newPairs:pairs.length,placedEntitiesRemoved:rewriteAudit.removedSurfaceEntities},undergroundOptimization,undergroundEndpointAudit:[...snapshot.pairs.map(({entity,role,neighbour})=>({entity,role,neighbour})),...pairs.flatMap(p=>[{entity:p.inputEntityNumber,role:'input',neighbour:p.outputEntityNumber},{entity:p.outputEntityNumber,role:'output',neighbour:p.inputEntityNumber}])],expectedReadAllBeltComponents:snapshot.readAllBeltComponents}};
}
