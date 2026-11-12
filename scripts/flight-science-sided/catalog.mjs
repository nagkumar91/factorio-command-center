import fs from 'node:fs/promises';import path from 'node:path';import{createHash}from'node:crypto';
const root=path.resolve(new URL('../..',import.meta.url).pathname),source=path.join(root,'blueprint-sources/flight-science-sided'),sha=s=>createHash('sha256').update(s).digest('hex');
const entries=[],pending=[];
for(const [folder,tier]of [['','supplies'],['full','fully-integrated'],['hybrid','hybrid'],['compact','compact']]){
const dir=path.join(source,folder);let manifests,report;try{manifests=JSON.parse(await fs.readFile(path.join(dir,'manifest.json')));report=JSON.parse(await fs.readFile(path.join(dir,'native-report.json')));}catch(e){if(e.code!=='ENOENT')throw e;pending.push(tier);continue;}
for(const m of manifests){if(!folder&&!m.id.endsWith('-supply'))continue;const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim(),hash=sha(code),proof=report.builds?.find(b=>b.id===m.id&&b.blueprintSha256===hash);const target=m.targetPerMinute||60;
if(hash!==m.blueprintSha256||!proof?.passed||report.short||report.warmupMinutes<15||report.measurementMinutes<30||!m.products.every(n=>proof.outputsPerMinute[n]>=target-.5)){pending.push(m.id);continue;}
entries.push({...m,tier,sourceFile:path.join(folder,m.file),evidenceFile:path.join(folder,'native-report.json'),measuredOutputsPerMinute:proof.outputsPerMinute,native:{gameVersion:report.gameVersion,warmupMinutes:report.warmupMinutes,measurementMinutes:report.measurementMinutes,harnessSha256:report.harnessSha256,prototypeSha256:report.prototypeSha256,createdAt:report.createdAt,recovery:proof.recovery},verified:true});}
}
const complete=['fully-integrated','hybrid','compact'].every(t=>entries.some(e=>e.tier===t))&&['green-circuit-supply','advanced-circuit-supply','engine-supply'].every(id=>entries.some(e=>e.id===id));
await fs.writeFile(path.join(source,'catalog-manifest.json'),JSON.stringify({complete,entries,pending,generatedAt:new Date().toISOString()},null,2)+'\n');console.log({complete,verified:entries.map(e=>e.id),pending});
