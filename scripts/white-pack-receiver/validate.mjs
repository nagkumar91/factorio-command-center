// The white-pack receiver is qualified by the white-platform end-to-end run (white-platform.md section 8, run one):
// one native run builds the platform in Nauvis orbit and this receiver on Nauvis and writes both native reports.
// This wrapper runs that harness (scripts/white-platform/validate.mjs and control.lua) and then fails if the
// receiver's report is missing, stale for the current string, or not passed.
// Usage: node scripts/white-pack-receiver/validate.mjs   (SPACE_EXPLORE=1 is passed through and checks nothing here)
import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const source=process.env.WR_SOURCE||'blueprint-sources/white-pack-receiver';
const run=spawnSync(process.execPath,['scripts/white-platform/validate.mjs'],{stdio:'inherit',env:process.env});
if(process.env.SPACE_EXPLORE==='1')process.exit(run.status??1);
const [m]=JSON.parse(await fs.readFile(source+'/manifest.json'));
const code=(await fs.readFile(source+'/'+m.file,'utf8')).trim();
let report;try{report=JSON.parse(await fs.readFile(source+'/native-report.json'));}catch{console.error('receiver native report missing');process.exit(1);}
const r=report.builds?.find(b=>b.id===m.id);
const problems=[];
if(!r)problems.push('no receiver build in the report');
else{if(r.blueprintSha256!==sha(code))problems.push('report is stale for the receiver string');if(!r.passed)problems.push('receiver checks failed: '+Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k).join(', '));}
if(report.short)problems.push('exploration report is not a qualification');
if(!report.passed)problems.push('end-to-end run did not pass');
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
console.log('white-pack-receiver qualified by the end-to-end run of '+report.createdAt+' (platform '+r.platformBlueprintSha256+')');
console.log('Regenerate the manifests: node scripts/white-platform/generate.mjs && node scripts/white-pack-receiver/generate.mjs');
