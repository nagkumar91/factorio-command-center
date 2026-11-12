import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {storageEvidence} from '../scripts/flight-science-sided/storage-evidence.mjs';
const source=new URL('../blueprint-sources/flight-science-sided/',import.meta.url);
for(const tier of ['compact','hybrid','fully-integrated'])test(`${tier} storage badge rejects backlog-only, unsaturated and altered-control evidence`,async()=>{
 const folder=`evidence/${tier}-storage-${tier==='fully-integrated'?60:30}`,raw=await fs.readFile(new URL(`${folder}/report.json`,source)),control=await fs.readFile(new URL(`${folder}/control.lua`,source)),original=JSON.parse(raw),build=original.builds[0];
 const m={id:build.id,tier,blueprintSha256:build.blueprintSha256,prototypeSha256:original.prototypeSha256,products:Object.keys(build.outputsPerMinute),...(tier==='fully-integrated'?{outputs:build.stress.chests.map(c=>({entity:c.entity,item:c.item}))}:{})};
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'science-storage-gate-'));try{
  await fs.mkdir(path.join(temp,folder),{recursive:true});await fs.writeFile(path.join(temp,folder,'control.lua'),control);
  const write=r=>fs.writeFile(path.join(temp,folder,'report.json'),JSON.stringify(r));
  await write(original);assert(await storageEvidence(temp,m));
  const backlog=structuredClone(original);if(tier==='compact')backlog.builds[0].recovery.scienceCraftedPerMinute[m.products[0]]=59;else backlog.builds[0].recoveryCrafted.craftedPerMinute[m.products[0]]=59;
  await write(backlog);await assert.rejects(storageEvidence(temp,m),/Invalid additional/);
  const incomplete=structuredClone(original);if(tier==='compact')incomplete.builds[0].blockedStress.chestFullSamples[0]--;else incomplete.builds[0].stress.chests[0].minimumAccessibleCount--;
  await write(incomplete);await assert.rejects(storageEvidence(temp,m),/Invalid additional/);
  await write(original);await fs.appendFile(path.join(temp,folder,'control.lua'),'\n-- changed\n');await assert.rejects(storageEvidence(temp,m),/Invalid additional/);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});

test('integrated extended diagnostic preserves failed fresh-production result separately',async()=>{
 const {createHash}=await import('node:crypto');
 const folder='evidence/integrated-storage-60-diagnostic/';
 const report=JSON.parse(await fs.readFile(new URL(folder+'report.json',source))),control=await fs.readFile(new URL(folder+'control.lua',source)),b=report.builds[0];
 assert.equal(createHash('sha256').update(control).digest('hex'),report.harnessSha256);
 assert.equal(b.blueprintSha256,'678b096548995153ecabf9d9d8fa6d1f7871a6870723be153cb3811dc08c9414');
 assert.equal(b.stress.pauseMinutes,60);assert.equal(b.stress.chests.length,10);
 assert.equal(b.stress.allChestsFullForFinalWindow,true);assert.equal(b.stress.allScienceMachineCraftsZero,true);
 assert.equal(b.recoveryCrafted.productionStatisticsAgree,true);
 assert.equal(b.stressPassed,false);
 assert(b.recoveryCrafted.productionStatisticsPerMinute['chemical-science-pack']<60);
 assert(b.recovery.outputsPerMinute['chemical-science-pack']>60,'collected backlog must not be mistaken for fresh production');
});
