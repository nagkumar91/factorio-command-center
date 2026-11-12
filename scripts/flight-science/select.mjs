// Select only exact-hash candidates with full native evidence; retain comparison history.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint} from '../blueprints.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname),dest=path.join(root,'blueprint-sources/flight-science');
const dirs=process.argv.slice(2).length?process.argv.slice(2).map(d=>path.resolve(d)):[path.join(dest,'history/v1-bus'),path.join(root,'.cache/flight-science/compact')];
const candidates=[];
for(const dir of dirs){
 const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'))),report=JSON.parse(await fs.readFile(path.join(dir,'native-report.json')));
 if(report.short||report.warmupMinutes!==15||report.measurementMinutes!==30||report.gameVersion!=='2.1.24')throw Error('Invalid protocol '+dir);
 for(const m of manifest){
  const b=report.builds.find(b=>b.id===m.id);if(!b||b.blueprintSha256!==m.blueprintSha256)throw Error('Stale evidence '+m.id);
  const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim();if(createHash('sha256').update(code).digest('hex')!==m.blueprintSha256)throw Error('Hash mismatch '+m.id);
  const passed=b.passed&&m.products.every(p=>b.outputsPerMinute[p]>=59.5)&&b.machines.every(m=>m.measuredCrafts>0)&&b.inputs.every(p=>p.productiveRoute?.length&&p.acceptedDuringMeasurement>0)&&b.outputPorts.every(p=>p.collectedDuringMeasurement>0)&&b.powered;
  candidates.push({manifest:m,native:b,report,code,passed,area:m.footprint.width*m.footprint.height});
 }
}
const winners=['rgb-60','rgb-military-60'].map(id=>{const c=candidates.filter(c=>c.manifest.id===id&&c.passed).sort((a,b)=>a.area-b.area||Object.values(a.manifest.machineCounts).reduce((x,y)=>x+y,0)-Object.values(b.manifest.machineCounts).reduce((x,y)=>x+y,0));if(!c.length)throw Error('No passing candidate for '+id);return c[0];});
const comparisons=candidates.map(c=>({id:c.manifest.id,blueprintSha256:c.manifest.blueprintSha256,passed:c.passed,footprint:c.manifest.footprint,machines:Object.values(c.manifest.machineCounts).reduce((a,b)=>a+b,0),outputsPerMinute:c.native.outputsPerMinute,headroom:c.manifest.optimization.headroom??null,extraWireAssembler:c.manifest.optimization.extraWireAssembler||false,layout:c.manifest.optimization.kind||'shared-bus'}));
await fs.writeFile(path.join(dest,'comparison.json'),JSON.stringify({criterion:'Smallest full footprint among candidates delivering all colours >=59.5/min together in a full 15+30-minute native test',candidates:comparisons},null,2)+'\n');
const final=[];
for(const w of winners){
 await fs.writeFile(path.join(dest,w.manifest.file),w.code+'\n');
 const entry={...w.manifest,status:'native-verified',measuredOutputsPerMinute:w.native.outputsPerMinute,comparisonFile:'comparison.json'};
 final.push(entry);
}
await fs.writeFile(path.join(dest,'manifest.json'),JSON.stringify(final,null,2)+'\n');
const report={...winners[0].report,passed:true,builds:winners.map(w=>({...w.native,evidenceCreatedAt:w.report.createdAt,harnessSha256:w.report.harnessSha256})),selection:'Per-blueprint exact-hash selection from comparison.json'};
await fs.writeFile(path.join(dest,'native-report.json'),JSON.stringify(report,null,2)+'\n');
const book={blueprint_book:{item:'blueprint-book',label:'Flight science · 60/min · RGB and military',version:decodeBlueprint(winners[0].code).blueprint.version,active_index:0,blueprints:winners.map((w,index)=>({index,...decodeBlueprint(w.code)}))}};
await fs.writeFile(path.join(dest,'flight-science-book.txt'),encodeBlueprint(book)+'\n');
console.log(JSON.stringify(final.map(m=>({id:m.id,footprint:m.footprint,outputs:m.measuredOutputsPerMinute})),null,2));
