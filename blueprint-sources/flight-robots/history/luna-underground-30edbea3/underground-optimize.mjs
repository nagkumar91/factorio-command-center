#!/usr/bin/env node
// Reproduce the reviewed underground-belt candidate from a frozen robot source
// and its exact native read-all component snapshot. Output defaults to cache.
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
const optimizerSha256='9f49e92e6d0dc8b2cb1c39653b182b9510bc137207caed0a7efd38949f9b8313';
if(sha(await fs.readFile(path.join(project,'experiments/luna-underground/optimizer.mjs')))!==optimizerSha256) throw Error('Optimizer source differs from the reviewed frozen SHA-256');
const baselinePath=path.resolve(process.argv[2]||path.join(project,'blueprint-sources/flight-robots/history/luna-underground-baseline-1b76c532/robots-10-roboport-1.txt'));
const manifestPath=path.resolve(process.argv[3]||path.join(path.dirname(baselinePath),'manifest.json'));
const snapshotPath=path.resolve(process.argv[4]||path.join(project,'blueprint-sources/flight-robots/history/luna-underground-30edbea3/native-read-all-snapshot.json'));
const rawPath=path.resolve(process.env.FACTORIO_RAW||path.join(project,'.cache/flight-21/script-output/data-raw-dump.json'));
const output=path.resolve(process.argv[5]||path.join(project,'.cache/luna-underground-robots/reproduced'));

const code=(await fs.readFile(baselinePath,'utf8')).trim();
const codeHash=sha(code);
const wrapper=decodeBlueprint(code);
const baselineManifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const entry=baselineManifest.find(m=>m.blueprintSha256===codeHash);
if(!entry) throw Error('Baseline source hash is absent from the supplied manifest');
const snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8'));
if(snapshot.blueprintSha256!==codeHash) throw Error('Native snapshot does not match the frozen robot baseline');
const rawBytes=await fs.readFile(rawPath);
const raw=JSON.parse(rawBytes);
if(snapshot.prototypeSha256!==sha(rawBytes)||entry.prototypeSha256!==sha(rawBytes)) throw Error('Prototype dump hash differs from the baseline evidence');

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
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'robots-underground-candidate.txt'),outputCode+'\n');
await fs.writeFile(path.join(output,'optimizer-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,candidateBlueprintSha256:report.candidateBlueprintSha256,optimizer:report.optimizer,structuralAudit:audit,redTransportIron:{before:before.redBeltConstructionIronPlates,after:after.redBeltConstructionIronPlates,delta:after.redBeltConstructionIronPlates-before.redBeltConstructionIronPlates},footprint:entry.footprint},null,2));
