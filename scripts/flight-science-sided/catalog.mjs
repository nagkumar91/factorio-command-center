import fs from 'node:fs/promises';import path from 'node:path';import{createHash}from'node:crypto';
const root=path.resolve(new URL('../..',import.meta.url).pathname),source=path.join(root,'blueprint-sources/flight-science-sided'),sha=s=>createHash('sha256').update(s).digest('hex');
const currentPrototypeSha256=sha(await fs.readFile(path.join(root,'.cache/flight-21/script-output/data-raw-dump.json'))),entries=[],pending=[],rejectionReasons={};
for(const [folder,tier]of [['','supplies'],['full','fully-integrated'],['hybrid','hybrid'],['compact','compact']]){
const dir=path.join(source,folder),harnessFile=`tests/flight-science-sided${folder?'-'+folder:''}-control.lua`;let manifests,report,harnessSha256;
try{manifests=JSON.parse(await fs.readFile(path.join(dir,'manifest.json')));report=JSON.parse(await fs.readFile(path.join(dir,'native-report.json')));harnessSha256=sha(await fs.readFile(path.join(root,harnessFile)));}catch(e){if(e.code!=='ENOENT')throw e;pending.push(tier);rejectionReasons[tier]=['Manifest, native report or harness not yet present'];continue;}
for(const m of manifests){if(!folder&&!m.id.endsWith('-supply'))continue;const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim(),hash=sha(code),proof=report.builds?.find(b=>b.id===m.id&&b.blueprintSha256===hash),target=m.targetPerMinute||60,errors=[];
if(hash!==m.blueprintSha256)errors.push('Blueprint text differs from manifest hash');
if(report.prototypeSha256!==m.prototypeSha256||m.prototypeSha256!==currentPrototypeSha256)errors.push('Prototype identity differs from manifest or installed flight profile');
if(report.harnessSha256!==harnessSha256)errors.push('Native control harness changed after validation');
if(report.gameVersion!=='2.1.24'||report.short!==false||report.warmupMinutes<15||report.measurementMinutes<30)errors.push('Full 2.1.24 native timing/version requirement not met');
if(!proof?.passed)errors.push('Exact-hash native build did not pass');
if(!proof?.powered||!proof?.machines?.length||!proof.machines.every(p=>p.measuredCrafts>0)||!proof.inputs?.every(p=>p.productiveRoute?.length&&p.acceptedDuringMeasurement>0)||!proof.outputPorts?.every(p=>p.collectedDuringMeasurement>0))errors.push('Power, machine activity, input routes or output collection missing');
if(!m.products.every(n=>(proof?.outputsPerMinute?.[n]??-1)>=target-.5))errors.push('Steady output below target floor');
const recovery=proof?.recovery;
if(!recovery||recovery.blockedMinutes<5||recovery.settlingMinutes!==2||recovery.measurementMinutes<3||!m.products.every(n=>(recovery.outputsPerMinute?.[n]??-1)>=target-.5))errors.push('Original blockage/recovery protocol or output floor not met');
if(m.fluids?.length&&(!proof?.fluids||proof.fluids.length!==m.fluids.length||!proof.fluids.every(p=>p.productiveConsumers?.length&&p.productiveConsumers.every(id=>proof.machines.some(machine=>machine.entity===id&&machine.measuredCrafts>0)))))errors.push('Productive fluid connectivity proof missing');
if(errors.length){pending.push(m.id);rejectionReasons[m.id]=errors;continue;}
entries.push({...m,tier,sourceFile:path.join(folder,m.file),evidenceFile:path.join(folder,'native-report.json'),harnessFile,measuredOutputsPerMinute:proof.outputsPerMinute,native:{gameVersion:report.gameVersion,warmupMinutes:report.warmupMinutes,measurementMinutes:report.measurementMinutes,harnessSha256:report.harnessSha256,prototypeSha256:report.prototypeSha256,createdAt:report.createdAt,recovery},verified:true});}
}
const complete=['fully-integrated','hybrid','compact'].every(t=>entries.some(e=>e.tier===t))&&['green-circuit-supply','advanced-circuit-supply','engine-supply'].every(id=>entries.some(e=>e.id===id));
await fs.writeFile(path.join(source,'catalog-manifest.json'),JSON.stringify({complete,currentPrototypeSha256,entries,pending,rejectionReasons,generatedAt:new Date().toISOString()},null,2)+'\n');console.log({complete,verified:entries.map(e=>e.id),pending,rejectionReasons});
