// Reproduce the selected, exact-hash underground rewrite after the layout generator.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint} from '../../blueprints.mjs';
import {optimizeBlueprint} from '../../../experiments/luna-underground/optimizer.mjs';
import {constructionMetrics} from '../../../experiments/luna-underground/construction-metrics.mjs';
import {auditUndergroundRewrite} from '../../flight-underground-audit.mjs';
export async function applySelectedUnderground(root,out){
 const sha=x=>createHash('sha256').update(x).digest('hex'),provenance=path.join(out,'underground-provenance');
 const config=JSON.parse(await fs.readFile(path.join(provenance,'selection.json'))),snapshot=JSON.parse(await fs.readFile(path.join(provenance,'baseline-pairing-report.json'))).builds[0];
 const [manifest]=JSON.parse(await fs.readFile(path.join(out,'manifest.json'))),code=(await fs.readFile(path.join(out,manifest.file),'utf8')).trim();
 assert.equal(sha(code),config.baselineBlueprintSha256);assert.equal(snapshot.blueprintSha256,sha(code));
 assert.equal(sha(await fs.readFile(path.join(root,'experiments/luna-underground/optimizer.mjs'))),config.optimizerSha256);
 const protectedIds=[...new Set([...manifest.inputs,...manifest.outputs,...manifest.fluids,...manifest.ports].flatMap(p=>[p.entity,p.displayEntity]).filter(Number.isInteger).concat(snapshot.readAllBeltComponentEntityNumbers))];
 const before=decodeBlueprint(code),result=optimizeBlueprint(before,{maxDistance:7,protectedEntityNumbers:protectedIds,nativeReadAllBeltComponentEntityNumbers:snapshot.readAllBeltComponentEntityNumbers,nativeReadAllBeltComponentBaselineSha256:snapshot.blueprintSha256});
 const audit=auditUndergroundRewrite(before,result.wrapper,result.changePairs,protectedIds),encoded=encodeBlueprint(result.wrapper);assert.equal(sha(encoded),config.selectedBlueprintSha256);
 const raw=JSON.parse(await fs.readFile(path.join(root,'.cache/flight-21/script-output/data-raw-dump.json'))),metadata={baselineBlueprintSha256:sha(code),optimizerSha256:config.optimizerSha256,before:constructionMetrics(before,raw),after:constructionMetrics(result.wrapper,raw),pairs:result.changePairs,protectedEntityNumbers:protectedIds,metrics:result.metrics,rewriteAudit:audit,overallBaseline:config.overallBaseline};
 manifest.blueprintSha256=sha(encoded);manifest.construction=metadata.after.inventory;manifest.undergroundOptimization=metadata;delete manifest.nativeEvidence;manifest.status='candidate-awaiting-exact-hash-native-validation';
 const report=JSON.parse(await fs.readFile(path.join(out,'native-report.json'))),build=report.builds.find(b=>b.id===manifest.id&&b.blueprintSha256===manifest.blueprintSha256);
 if(report.passed&&build?.passed){manifest.status='native-verified';manifest.nativeEvidence={file:'native-report.json',blueprintSha256:manifest.blueprintSha256,harnessSha256:report.harnessSha256,warmupMinutes:15,measurementMinutes:30,recovery:{collectionPauseMinutes:5,settlingMinutes:2,measurementMinutes:3}};}
 await fs.writeFile(path.join(out,manifest.file),encoded+'\n');await fs.writeFile(path.join(out,manifest.id+'.json'),JSON.stringify(result.wrapper,null,2)+'\n');await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');
 return manifest;
}
