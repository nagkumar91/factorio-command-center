// Generates the flying-robot-frame supply factory (20/min) for the flight-science-sided family.
// Usage: node scripts/flight-science-sided/heavy-supplies/flying-robot-frame-supply/generate.mjs [--variant inner-fluids|outer-fluids] [--out dir]
// Needs the family's pinned 2.1.24 flight-save prototype dump (.cache/flight-21/script-output/data-raw-dump.json, or
// FACTORIO_RAW). Byte-identical on a re-run; keeps the committed string when a regeneration decodes to the same blueprint.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../../../blueprints.mjs';
import {build,TARGET,PRODUCT,VARIANTS} from './layout.mjs';

export const PROTOTYPE_SHA256='33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f';
const root=path.resolve(new URL('../../../..',import.meta.url).pathname);
const args=process.argv.slice(2),flag=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const id='flying-robot-frame-supply',variant=flag('variant','inner-fluids');assert(VARIANTS.includes(variant));
const out=path.resolve(root,flag('out','blueprint-sources/flight-science-sided/heavy-supplies/'+id));
const rawPath=process.env.FACTORIO_RAW||path.join(root,'.cache/flight-21/script-output/data-raw-dump.json');
const sha=s=>createHash('sha256').update(s).digest('hex');
const bytes=await fs.readFile(rawPath);assert.equal(sha(bytes),PROTOTYPE_SHA256,'not the family prototype dump');
const raw=JSON.parse(bytes);
const {bp,ports,counts,footprint,math,loop}=build(variant,raw);

const committed=await fs.readFile(path.join(out,id+'.txt'),'utf8').then(t=>t.trim(),()=>null);
const same=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
const code=committed&&same(committed)?committed:encodeBlueprint({blueprint:bp});
const blueprintSha256=sha(code);

let status='awaiting-native-validation',measured;
try{
 const report=JSON.parse(await fs.readFile(path.join(out,'native-report.json'),'utf8'));
 const full=report.builds.filter(b=>b.blueprintSha256===blueprintSha256);
 if(full.length&&report.short===false){
  status=report.passed&&full.every(b=>b.passed)?'native-verified':'native-failed';
  const at=s=>full.find(b=>b.feedScale===s);
  measured={steadyPerMinute:at(1)?.outputsPerMinute[PRODUCT],recoveryPerMinute:at(1)?.recoveryPerMinute[PRODUCT],
   underfedSteadyPerMinute:at(.8)?.outputsPerMinute[PRODUCT],underfedRecoveryPerMinute:at(.8)?.recoveryPerMinute[PRODUCT],
   drawPerMinute:Object.fromEntries([...(at(1)?.inputs||[]).map(i=>[i.item,i.drawPerMinute]),...(at(1)?.fluids||[]).map(f=>[f.fluid,f.drawPerMinute])]),
   reportCreatedAt:report.createdAt};
 }
}catch{}

const construction=Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].sort().map(n=>[n,bp.entities.filter(e=>e.name===n).length]));
const round=x=>Math.round(x*1e6)/1e6;
const manifest={
 id,file:id+'.txt',name:bp.label,products:[PRODUCT],targetPerMinute:TARGET,blueprintSha256,prototypeSha256:PROTOTYPE_SHA256,variant,
 ports,
 inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:4,perMinute:p.perMinute})),
 fluids:ports.filter(p=>p.kind==='fluid').map(p=>({fluid:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:p.perMinute})),
 outputs:ports.filter(p=>p.kind==='output').map(p=>({item:PRODUCT,entity:p.entity,position:{x:p.x,y:p.y},perMinute:TARGET})),
 machineCounts:counts,footprint,tiles:footprint.width*footprint.height,construction,
 recipeArithmetic:{craftsPerMinute:math.crafts,externalPerMinute:math.external,machinesExact:Object.fromEntries(Object.entries(math.exact).map(([k,v])=>[k,round(v)])),machines:math.machines,machineType:math.machine},
 loopControl:[loop],
 setupNotes:[bp.description,'Lubricant and sulfuric acid each enter at one labelled pipe inlet on the west side; connect a pipe to its west face.'],
 status,...(measured?{measured}:{}),
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,id+'.txt'),code+'\n');
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,variant,out:path.relative(root,out),footprint,counts,blueprintSha256,status}));
