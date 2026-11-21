#!/usr/bin/env node
// Underground-belt step for the robot workshop: a frozen optimizer applied to a
// baseline string with its exact native read-all component snapshot.
// generate.mjs calls optimizeRobotBaseline() for the published version. Run as a
// script with no arguments, it reproduces the earlier 106 x 18 version (30edbea3)
// from its preserved baseline; output defaults to cache.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint, encodeBlueprint} from '../blueprints.mjs';
import {optimizeBlueprint} from '../../experiments/luna-underground/optimizer.mjs';
import {auditUndergroundRewrite} from '../flight-underground-audit.mjs';
import {constructionMetrics} from '../../experiments/luna-underground/construction-metrics.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=value=>createHash('sha256').update(value).digest('hex');
export const optimizerSha256='9f49e92e6d0dc8b2cb1c39653b182b9510bc137207caed0a7efd38949f9b8313';

/** Returns {code, wrapper, report, before, after} for the optimized string. Throws on any evidence mismatch. */
export async function optimizeRobotBaseline({code,entry,snapshot,rawBytes}){
 if(sha(await fs.readFile(path.join(project,'experiments/luna-underground/optimizer.mjs')))!==optimizerSha256) throw Error('Optimizer source differs from the reviewed frozen SHA-256');
 const codeHash=sha(code);
 if(entry.blueprintSha256!==codeHash) throw Error('Baseline source hash is absent from the supplied manifest');
 if(snapshot.blueprintSha256!==codeHash) throw Error('Native snapshot does not match the robot baseline');
 if(snapshot.prototypeSha256!==sha(rawBytes)||entry.prototypeSha256!==sha(rawBytes)) throw Error('Prototype dump hash differs from the baseline evidence');
 const raw=JSON.parse(rawBytes);
 const wrapper=decodeBlueprint(code);
 const products=new Set(entry.products||[]);
 const targetEntityNumbers=wrapper.blueprint.entities.filter(e=>products.has(e.recipe)).map(e=>e.entity_number);
 const portEntityNumbers=(entry.ports||[]).filter(p=>['input','fluid','output','power'].includes(p.kind)).flatMap(p=>[p.entity,p.displayEntity]).filter(Number.isInteger);
 const protectedEntityNumbers=[...new Set([...targetEntityNumbers,...portEntityNumbers])].sort((a,b)=>a-b);
 const result=optimizeBlueprint(wrapper,{
  maxDistance:7,
  minSpan:5,
  protectedEntityNumbers,
  nativeReadAllBeltComponentEntityNumbers:snapshot.nativeReadAllBeltComponentEntityNumbers,
  nativeReadAllBeltComponentBaselineSha256:codeHash,
 });
 if(result.metrics.aborted) throw Error(`Optimizer aborted: ${result.metrics.aborted}`);
 const audit=auditUndergroundRewrite(wrapper,result.wrapper,result.changePairs,protectedEntityNumbers);
 const outputCode=encodeBlueprint(result.wrapper);
 const before=constructionMetrics(wrapper,raw);
 const after=constructionMetrics(result.wrapper,raw);
 const report={schemaVersion:1,optimizerSha256,baselineBlueprintSha256:codeHash,candidateBlueprintSha256:sha(outputCode),prototypeSha256:sha(rawBytes),optimizer:result.metrics,structuralAudit:audit,protectedEntityNumbers,nativeReadAllBeltComponentEntityNumbers:snapshot.nativeReadAllBeltComponentEntityNumbers,before,after,pairs:result.changePairs,rejections:result.rejections};
 return {code:outputCode,wrapper:result.wrapper,report,before,after};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const baselinePath=path.resolve(process.argv[2]||path.join(project,'blueprint-sources/flight-robots/history/luna-underground-baseline-1b76c532/robots-10-roboport-1.txt'));
 const manifestPath=path.resolve(process.argv[3]||path.join(path.dirname(baselinePath),'manifest.json'));
 const snapshotPath=path.resolve(process.argv[4]||path.join(project,'blueprint-sources/flight-robots/history/luna-underground-30edbea3/native-read-all-snapshot.json'));
 const rawPath=path.resolve(process.env.FACTORIO_RAW||path.join(project,'.cache/flight-21/script-output/data-raw-dump.json'));
 const output=path.resolve(process.argv[5]||path.join(project,'.cache/luna-underground-robots/reproduced'));
 const code=(await fs.readFile(baselinePath,'utf8')).trim();
 const entry=JSON.parse(await fs.readFile(manifestPath,'utf8')).find(m=>m.blueprintSha256===sha(code));
 if(!entry) throw Error('Baseline source hash is absent from the supplied manifest');
 const snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8'));
 const {code:outputCode,report,before,after}=await optimizeRobotBaseline({code,entry,snapshot,rawBytes:await fs.readFile(rawPath)});
 await fs.mkdir(output,{recursive:true});
 await fs.writeFile(path.join(output,'robots-underground-candidate.txt'),outputCode+'\n');
 await fs.writeFile(path.join(output,'optimizer-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output,candidateBlueprintSha256:report.candidateBlueprintSha256,optimizer:report.optimizer,structuralAudit:report.structuralAudit,redTransportIron:{before:before.redBeltConstructionIronPlates,after:after.redBeltConstructionIronPlates,delta:after.redBeltConstructionIronPlates-before.redBeltConstructionIronPlates},footprint:entry.footprint},null,2));
}
