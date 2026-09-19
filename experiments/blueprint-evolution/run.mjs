import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import os from 'node:os';
import {decodeBlueprint,encodeBlueprint} from '../../scripts/blueprints.mjs';
import {findCorridors,applyCorridors,spatialIndex} from './corridors.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const id=process.env.OPTIMIZE_ID||'early-raw-military-science-pack';
const source=process.env.OPTIMIZE_SOURCE||'blueprint-sources/early-game';
const code=(await fs.readFile(path.join(source,id+'.txt'),'utf8')).trim();
const manifest=JSON.parse(await fs.readFile(path.join(source,'manifest.json'))),info=manifest.find(b=>b.id===id);
if(!info)throw Error('Unknown baseline '+id);
const out=path.resolve(process.env.OPTIMIZE_OUT||`.cache/blueprint-evolution/${id}-${sha(code).slice(0,12)}`);
await fs.mkdir(out,{recursive:true});
const rawBytes=await fs.readFile('.cache/factorio-vanilla/script-output/data-raw-dump.json'),raw=JSON.parse(rawBytes);
const implementationFiles=['wfc.mjs','corridors.mjs','run.mjs','worker.mjs'];
const implementationBytes=await Promise.all(implementationFiles.map(name=>fs.readFile(new URL(name,import.meta.url))));
const implementationSha256=sha(Buffer.concat(implementationBytes));
await fs.mkdir(path.join(out,'implementation'),{recursive:true});
for(let i=0;i<implementationFiles.length;i++)await fs.writeFile(path.join(out,'implementation',implementationFiles[i]),implementationBytes[i]);
const blueprint=decodeBlueprint(code).blueprint;
const config={seed:12345,population:12,generations:10,maxBranches:500};
const models=findCorridors(blueprint,info,raw,{maxCells:240,padding:3}).slice(0,Number(process.env.OPTIMIZE_REGIONS||12));
const snapshot={id,baselineSha256:sha(code),prototypeSha256:sha(rawBytes),implementationSha256,gameVersion:'2.0.77',model:'ordinary directed belt corridors; fixed machinery, ports, inserter contacts, fluids, underground endpoints, power',config,regions:models.map(m=>({id:m.id,material:m.material,cells:m.cells.length,belts:m.removedCount,shortestPathSaving:m.heuristicSaving})),protocol:{functionalMinutes:45,warmupMinutes:15,measuredMinutes:30,seed:12345}};
await fs.writeFile(path.join(out,'baseline.txt'),code+'\n');
await fs.writeFile(path.join(out,'baseline-manifest.json'),JSON.stringify([info],null,2)+'\n');
await fs.writeFile(path.join(out,'experiment.json'),JSON.stringify(snapshot,null,2)+'\n');
for(const kind of ['validation','throughput']){
 const saved=JSON.parse(await fs.readFile(path.join(source,kind+'.json')));saved.builds=saved.builds.filter(b=>b.id===id);
 await fs.writeFile(path.join(out,'baseline-'+kind+'.json'),JSON.stringify(saved,null,2)+'\n');
}
console.log(JSON.stringify({out,regions:snapshot.regions}));
const results=[];
let cursor=0;
const workers=Math.min(models.length,Math.max(1,os.availableParallelism()-3),Number(process.env.OPTIMIZE_WORKERS||8));
async function next(){
 while(cursor<models.length){
  const model=models[cursor++],file=path.join(out,model.id+'.json'),cacheKey=sha(JSON.stringify({model,config,implementationSha256,prototypeSha256:snapshot.prototypeSha256}));
  let result;
  try{const cached=JSON.parse(await fs.readFile(file));if(cached.cacheKey===cacheKey)result=cached.result;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!result)result=await new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{model,config}});
   worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code)reject(Error('Search worker exited '+code));});
  });
  await fs.writeFile(file,JSON.stringify({cacheKey,model,result},null,2)+'\n');
  results.push({model,result});
  console.log(JSON.stringify({region:model.id,baseline:model.removedCount,heuristic:model.removedCount-model.heuristicSaving,best:result.archive[0]?.score,unique:result.archive.length,evaluations:result.evaluations}));
 }
}
await Promise.all(Array.from({length:workers},next));
const changes=[],accepted=[];let candidate=blueprint;
const bounds=b=>{const points=[...spatialIndex(b,raw).grid.keys()].map(k=>k.split(',').map(Number));return {left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};};
const originalBounds=bounds(blueprint);
for(const {model,result} of results.sort((a,b)=>a.model.id.localeCompare(b.model.id))){
 const best=result.archive.find(a=>a.score<model.removedCount);if(!best)continue;
 try{
  const proposed=applyCorridors(blueprint,[...changes,{model,choice:best.choice}],raw),bb=bounds(proposed);
  if(Object.keys(bb).some(k=>k==='left'||k==='top'?bb[k]<originalBounds[k]:bb[k]>originalBounds[k]))throw Error('Footprint expands');
  changes.push({model,choice:best.choice});candidate=proposed;accepted.push({id:model.id,removed:model.removedCount,added:best.score,saved:model.removedCount-best.score,method:best.kind});
 }catch(error){console.log(JSON.stringify({region:model.id,rejectedCombination:error.message}));}
}
const candidateCode=encodeBlueprint({blueprint:candidate});
const report={...snapshot,workers,accepted,baselineEntities:blueprint.entities.length,candidateEntities:candidate.entities.length,beltsSaved:blueprint.entities.length-candidate.entities.length,candidateSha256:sha(candidateCode),nativePassed:false,claim:'Static candidate only; WFC and GA results are compared with a deterministic shortest-path control. Native testing is required before publication.'};
await fs.writeFile(path.join(out,'comparison.json'),JSON.stringify(report,null,2)+'\n');
if(changes.length){
 const sources=path.join(out,'source');await fs.mkdir(sources,{recursive:true});
 await fs.writeFile(path.join(sources,info.file),candidateCode+'\n');
 await fs.writeFile(path.join(sources,'manifest.json'),JSON.stringify([info],null,2)+'\n');
}
console.log(JSON.stringify({out,accepted,beltsSaved:report.beltsSaved,candidateSha256:report.candidateSha256,nativePassed:false},null,2));
