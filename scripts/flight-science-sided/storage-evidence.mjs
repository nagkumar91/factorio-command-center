import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
// Optional evidence must match the selected blueprint, not merely a tier name.
export async function storageEvidence(source,m){
 const folder=`evidence/${m.tier}-storage-30`,reportFile=`${folder}/report.json`,controlFile=`${folder}/control.lua`;
 let raw,control;try{raw=await fs.readFile(path.join(source,reportFile));control=await fs.readFile(path.join(source,controlFile));}catch(e){if(e.code==='ENOENT')return null;throw e;}
 const r=JSON.parse(raw),b=r.builds?.find(b=>b.blueprintSha256===m.blueprintSha256&&b.id===m.id);
 if(!b)return null;
 const products=m.products;
 // The independently written hybrid probe records per-chest minima and per-machine
 // craft counts; normalize those observations without changing the raw report.
 const h=b.stress,c=b.recoveryCrafted;
 const hybridObserved=h&&h.chests?.length===6&&h.allChestsFullForFinalWindow&&h.allChestsFullSamples===h.finalWindowSamples&&h.chests.every(x=>x.fullSamples===h.finalWindowSamples&&x.minimumAccessibleCount===x.accessibleCapacity&&x.maximumAccessibleCount===x.accessibleCapacity&&x.finalAccessibleCount===x.accessibleCapacity&&x.fullAtPauseEnd)&&h.scienceMachineCraftsFinalWindow?.length>0&&h.scienceMachineCraftsFinalWindow.every(x=>x.craftsDuringFinalWindow===0)&&products.every(p=>h.scienceMachineCraftsFinalWindow.some(x=>x.recipe===p));
 const chest=x=>({item:x.item,full:x.fullAtPauseEnd,stored:x.finalAccessibleCount,usableCapacity:x.accessibleCapacity});
 const s=b.blockedStress||(hybridObserved?{pauseMinutes:h.pauseMinutes,zeroProductionWindowMinutes:h.finalWindowMinutes,sampleCount:h.finalWindowSamples,chestFullSamples:h.chests.map(x=>x.fullSamples),startChests:h.chests.map(chest),endChests:h.chests.map(chest),productionDelta:h.scienceProductionInFinalWindow,craftDelta:Object.fromEntries(products.map(p=>[p,h.scienceMachineCraftsFinalWindow.filter(x=>x.recipe===p).reduce((n,x)=>n+x.craftsDuringFinalWindow,0)])),allChestsFull:hybridObserved,zeroScienceProduction:h.allScienceProductionZero&&h.allScienceMachineCraftsZero}:null);
 const v=c?{...b.recovery,scienceCraftedPerMinute:c.craftedPerMinute,scienceProductionStatisticsPerMinute:c.productionStatisticsPerMinute}:b.recovery;
 const valid=r.passed&&b.passed&&b.stressPassed&&r.gameVersion==='2.1.24'&&r.short===false&&r.warmupMinutes>=15&&r.measurementMinutes>=30&&r.prototypeSha256===m.prototypeSha256&&r.harnessSha256===sha(control)&&s?.pauseMinutes===30&&s.zeroProductionWindowMinutes===2&&s.sampleCount>=120&&s.allChestsFull&&s.zeroScienceProduction&&s.chestFullSamples?.length===6&&s.chestFullSamples.every(n=>n===s.sampleCount)&&['startChests','endChests'].every(k=>s[k]?.length===6&&products.every(p=>s[k].some(c=>c.item===p&&c.full&&c.usableCapacity>0&&c.stored===c.usableCapacity)))&&products.every(p=>s.productionDelta[p]===0&&s.craftDelta[p]===0)&&v?.blockedMinutes===30&&v.settlingMinutes===2&&v.measurementMinutes===3&&products.every(p=>v.scienceCraftedPerMinute?.[p]>=60&&Math.abs(v.scienceCraftedPerMinute[p]-v.scienceProductionStatisticsPerMinute?.[p])<1e-8);
 if(!valid)throw new Error(`Invalid additional full-storage proof for ${m.id}`);
 return {reportFile,controlFile,reportSha256:sha(raw),harnessSha256:sha(control),blueprintSha256:b.blueprintSha256,prototypeSha256:r.prototypeSha256,pauseMinutes:30,zeroProductionWindowMinutes:2,settlingMinutes:2,measurementMinutes:3,craftedPerMinute:v.scienceCraftedPerMinute,collectedPerMinute:v.outputsPerMinute};
}
