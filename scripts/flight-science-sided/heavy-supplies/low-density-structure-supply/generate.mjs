// node scripts/flight-science-sided/heavy-supplies/low-density-structure-supply/generate.mjs [--variant twin-rows|stacked-rows] [--out dir]
// Writes the blueprint string and manifest.json. Needs the family's flight-save prototype dump (SHA-256 33912441...).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../../../blueprints.mjs';
import {buildBlueprint,manifestFor,id,familyPrototypeSha256} from './layout.mjs';
import {resolveProfile} from './profile.mjs';

const root=path.resolve(new URL('../../../..',import.meta.url).pathname);
const arg=name=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:undefined;};
const variant=arg('--variant')||'twin-rows';
const out=path.resolve(root,arg('--out')||`blueprint-sources/flight-science-sided/heavy-supplies/${id}`);
const sha=s=>createHash('sha256').update(s).digest('hex');
const profile=await resolveProfile(root);
const bytes=await fs.readFile(profile.raw),raw=JSON.parse(bytes);
if(sha(bytes)!==familyPrototypeSha256)throw Error('Prototype dump is not the family flight-save dump: '+profile.raw);
const built=buildBlueprint(raw,variant);
const wrapper={blueprint:built.bp};
// Keep the committed string when it decodes to exactly this blueprint: another zlib build may compress the
// same JSON differently, and the native report is bound to the committed string's SHA-256.
const committed=await fs.readFile(path.join(out,id+'.txt'),'utf8').then(t=>t.trim(),()=>null);
const same=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify(wrapper);}catch{return false;}};
const code=committed&&same(committed)?committed:encodeBlueprint(wrapper);
const manifest=manifestFor(built,code,sha,familyPrototypeSha256);
manifest.variant=variant;
try{
 const report=JSON.parse(await fs.readFile(path.join(out,'native-report.json'),'utf8'));
 const proof=report.builds?.find(b=>b.id===id&&b.feedFraction===1&&b.blueprintSha256===manifest.blueprintSha256);
 if(proof&&report.short===false)manifest.status=report.passed&&proof.passed?'native-verified':'native-failed';
 if(proof)manifest.nativeEvidence={file:'native-report.json',createdAt:report.createdAt,passed:report.passed,steadyPerMinute:proof.outputsPerMinute[manifest.products[0]],recoveryPerMinute:proof.recovery?.outputsPerMinute?.[manifest.products[0]],inletsPerMinute:Object.fromEntries(proof.inputs.map(p=>[p.item,p.acceptedPerMinute]))};
}catch{}
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,id+'.txt'),code+'\n');
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({variant,out:path.relative(root,out),footprint:built.footprint,tiles:built.footprint.width*built.footprint.height,counts:built.counts,entities:built.bp.entities.length,inputs:manifest.inputs.map(p=>[p.item,p.perMinute,p.position]),blueprintSha256:manifest.blueprintSha256,status:manifest.status}));
