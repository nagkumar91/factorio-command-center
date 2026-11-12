import fs from'node:fs/promises';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{encodeBlueprint}from'../../../blueprints.mjs';
import{optimizeBlueprint}from'./optimizer.mjs';
import{constructionMetrics}from'../../../../experiments/luna-underground/construction-metrics.mjs';
import{auditUndergroundRewrite}from'../../../flight-underground-audit.mjs';

export const BASELINE_SHA='17fc28fa24029214b1aed34c100fbb8baabc4eb0821bd864d9ceb294bfc97d49';
export const OPTIMIZER_SHA='9f49e92e6d0dc8b2cb1c39653b182b9510bc137207caed0a7efd38949f9b8313';
export const OPTIMIZED_SHA='e95653789ed6178ca080a151b3c4aec09a06a96992e27d399e348475015888a8';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// Rebuild and verify the qualified baseline before applying the reviewed rewrite.
// Changes to the baseline or optimizer require a new native assessment.
export async function rewriteCompactUnderground(wrapper,baselineManifest,raw){
 const baselineCode=encodeBlueprint(wrapper);
 assert.equal(sha(baselineCode),BASELINE_SHA,'Compact baseline changed; obtain a new native protection snapshot');
 assert.equal(baselineManifest.blueprintSha256,BASELINE_SHA);
 const optimizerBytes=await fs.readFile(new URL('./optimizer.mjs',import.meta.url));assert.equal(sha(optimizerBytes),OPTIMIZER_SHA,'Reviewed optimizer changed');
 const snapshotBytes=await fs.readFile(new URL('../../../../blueprint-sources/flight-science-sided/compact/history/v2-17fc28fa/native-belt-snapshot.json',import.meta.url));
 const snapshot=JSON.parse(snapshotBytes).builds[0],plan=JSON.parse(await fs.readFile(new URL('./protection-plan.json',import.meta.url)));
 assert.equal(snapshot.blueprintSha256,sha(baselineCode),'Native component snapshot does not match source');
 assert.equal(plan.nativeReadAllBeltComponentBaselineSha256,BASELINE_SHA);assert.equal(plan.nativeSnapshotSha256,sha(snapshotBytes));
 assert.deepEqual(plan.nativeReadAllBeltComponentEntityNumbers,snapshot.readAllBeltComponentEntityNumbers);
 const result=optimizeBlueprint(wrapper,{maxDistance:7,minSpan:5,protectedEntityNumbers:plan.protectedEntityNumbers,nativeReadAllBeltComponentEntityNumbers:snapshot.readAllBeltComponentEntityNumbers,nativeReadAllBeltComponentBaselineSha256:snapshot.blueprintSha256});
 assert(!result.metrics.aborted,result.metrics.aborted);
 const pairs=result.changePairs,audit=auditUndergroundRewrite(wrapper,result.wrapper,pairs,plan.protectedEntityNumbers),code=encodeBlueprint(result.wrapper);
 assert.equal(sha(code),OPTIMIZED_SHA,'Underground rewrite differs from the qualified candidate');
 const undergroundOptimization={baselineBlueprintSha256:BASELINE_SHA,optimizerSha256:OPTIMIZER_SHA,nativeSnapshotSha256:sha(snapshotBytes),before:constructionMetrics(wrapper,raw),after:constructionMetrics(result.wrapper,raw),pairs,protectedEntityNumbers:plan.protectedEntityNumbers,nativeReadAllBeltComponentEntityNumbers:snapshot.readAllBeltComponentEntityNumbers,nativeReadAllBeltComponentBaselineSha256:BASELINE_SHA,metrics:result.metrics,rewriteAudit:audit,status:'native-verified',baselineHistory:'history/v2-17fc28fa'};
 const manifest={...baselineManifest,blueprintSha256:sha(code),construction:undergroundOptimization.after.inventory,status:'native-verified-underground',undergroundOptimization,undergroundEndpointAudit:[...snapshot.pairs.map(({entity,role,neighbour})=>({entity,role,neighbour})),...pairs.flatMap(p=>[{entity:p.inputEntityNumber,role:'input',neighbour:p.outputEntityNumber},{entity:p.outputEntityNumber,role:'output',neighbour:p.inputEntityNumber}])]};
 delete manifest.nativeEvidence;
 assert.equal(sha(await fs.readFile(new URL('./optimizer.mjs',import.meta.url))),OPTIMIZER_SHA);
 return{wrapper:result.wrapper,manifest};
}
