#!/usr/bin/env node
// Qualification summary for the published robot string: checks the committed
// optimizer report, native pairing report and full native report against each
// other and against the preserved baseline, then writes underground-proof.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {optimizerSha256} from './underground-optimize.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),family=path.join(project,'blueprint-sources/flight-robots');
const sha=v=>createHash('sha256').update(v).digest('hex');
const read=async f=>JSON.parse(await fs.readFile(path.join(family,f),'utf8'));
const [m]=await read('manifest.json'),u=m.undergroundOptimization;
const optimizer=await read('optimizer-report.json'),snapshot=await read('native-read-all-snapshot.json'),pairing=await read('native-pairing-report.json'),report=await read('native-report.json');
const baselineManifest=(await read(u.baselineFolder+'/manifest.json'))[0],baselineReport=await read(u.baselineFolder+'/native-report.json');
const code=(await fs.readFile(path.join(family,m.file),'utf8')).trim();
const candidate=report.builds.find(b=>b.blueprintSha256===m.blueprintSha256),baseline=baselineReport.builds.find(b=>b.blueprintSha256===u.baselineBlueprintSha256);
const assertions=[];const check=(name,passed,details)=>assertions.push({name,passed:!!passed,details});
check('frozen optimizer hash',optimizer.optimizerSha256===optimizerSha256&&u.optimizerSha256===optimizerSha256&&sha(await fs.readFile(path.join(project,'experiments/luna-underground/optimizer.mjs')))===optimizerSha256,{optimizerSha:optimizer.optimizerSha256,expectedOptimizer:optimizerSha256});
check('published string hash',sha(code)===m.blueprintSha256&&optimizer.candidateBlueprintSha256===m.blueprintSha256&&optimizer.baselineBlueprintSha256===u.baselineBlueprintSha256,{file:sha(code),manifest:m.blueprintSha256,optimizer:optimizer.candidateBlueprintSha256});
check('15-minute warmup / 30-minute measurement',!report.short&&report.warmupMinutes===15&&report.measurementMinutes===30&&!baselineReport.short&&baselineReport.measurementMinutes===30,{passed:report.passed,warmupMinutes:report.warmupMinutes,measurementMinutes:report.measurementMinutes});
check('exact prototype snapshot',new Set([report.prototypeSha256,baselineReport.prototypeSha256,snapshot.prototypeSha256,pairing.prototypeSha256,m.prototypeSha256,baselineManifest.prototypeSha256,optimizer.prototypeSha256]).size===1,{native:report.prototypeSha256,snapshot:snapshot.prototypeSha256,baseline:baselineManifest.prototypeSha256});
check('same production harness for baseline and candidate',report.harnessSha256===baselineReport.harnessSha256,{candidate:report.harnessSha256,baseline:baselineReport.harnessSha256});
check('baseline and candidate exact-hash runs passed',candidate?.passed&&baseline?.passed&&report.passed&&baselineReport.passed,{baselineHash:baseline?.blueprintSha256,candidateHash:candidate?.blueprintSha256});
check('45-minute output block and recovery',candidate&&candidate.recovery.blockedMinutes===45&&candidate.recovery.settlingMinutes===2&&candidate.recovery.measurementMinutes===3&&Object.entries(m.targets).every(([k,t])=>candidate.outputsPerMinute[k]>=t-.05&&candidate.recovery.outputsPerMinute[k]>=t-.05),{recovery:candidate?.recovery,targets:m.targets});
const caps=Object.fromEntries(m.outputs.map(o=>[o.item,o.cap]));
check('all shared output caps reached exactly',candidate&&Object.entries(caps).every(([k,c])=>candidate.recovery.blockedStock[k]===c),{expected:caps,actual:candidate?.recovery.blockedStock});
check('no idle machine',candidate?.machines.every(x=>x.measuredCrafts>0),{machines:candidate?.machines.length});
const key=p=>p.inputEntityNumber+'>'+p.outputEntityNumber,nativeKeys=new Set(pairing.undergroundInputPairs.map(key));
check('native snapshot is for the exact baseline',snapshot.blueprintSha256===u.baselineBlueprintSha256&&snapshot.passed,{snapshot:snapshot.blueprintSha256,baseline:u.baselineBlueprintSha256});
check('all original underground pairs retained exactly',snapshot.undergroundInputPairs.every(p=>nativeKeys.has(key(p))),{original:snapshot.undergroundInputPairs,candidate:pairing.undergroundInputPairs.map(({inputEntityNumber,outputEntityNumber})=>({inputEntityNumber,outputEntityNumber}))});
check('all declared new pairs match native neighbours exactly',pairing.blueprintSha256===m.blueprintSha256&&pairing.passed&&pairing.expectedPairsChecked===u.pairs.length&&u.pairs.every(p=>nativeKeys.has(key(p))),{declared:u.pairs.map(({inputEntityNumber,outputEntityNumber})=>({inputEntityNumber,outputEntityNumber})),native:pairing.undergroundInputPairs});
check('no unpaired or undeclared tunnel inputs',Object.keys(pairing.unpairedUndergroundInputs).length===0&&pairing.undergroundInputPairs.length===snapshot.undergroundInputPairs.length+u.pairs.length,{unpairedCount:Object.keys(pairing.unpairedUndergroundInputs).length,baselinePairs:snapshot.undergroundInputPairs.length,newPairs:u.pairs.length,nativePairs:pairing.undergroundInputPairs.length});
const passed=assertions.every(a=>a.passed);
const proof={schemaVersion:1,createdAt:new Date().toISOString(),status:passed?'passed':'failed',optimizerSha256,baselineBlueprintSha256:u.baselineBlueprintSha256,candidateBlueprintSha256:m.blueprintSha256,prototypeSha256:report.prototypeSha256,assertions,
 production:{baseline:{outputsPerMinute:baseline?.outputsPerMinute,recovery:baseline?.recovery.outputsPerMinute,report:u.baselineFolder+'/native-report.json'},candidate:{outputsPerMinute:candidate?.outputsPerMinute,recovery:candidate?.recovery.outputsPerMinute,report:'native-report.json',buildId:candidate?.id}},
 topology:{readAllBeltEntities:snapshot.nativeReadAllBeltComponentEntityNumbers.length,nativePairs:pairing.undergroundInputPairs.length,newPairs:u.pairs.length},
 construction:{before:u.before,after:u.after}};
await fs.writeFile(path.join(family,'underground-proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({status:proof.status,failed:assertions.filter(a=>!a.passed).map(a=>a.name)}));
process.exitCode=passed?0:1;
