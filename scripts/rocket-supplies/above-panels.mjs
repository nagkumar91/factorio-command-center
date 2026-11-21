// Supply above the panel figures: runs the PUBLISHED string through the full protocol (exploration
// mode, so native-report.json is never touched) with some entrances fed above their panels, and
// writes blueprint-sources/rocket-supplies/above-panels.json. "drawWithinPanels" cannot hold in
// these runs (the draw is compared with the panel, not with the overridden feed) and is ignored in
// "passedExceptDraw". Review of 2026-11-21, must-fix 2.
//
//   node scripts/rocket-supplies/above-panels.mjs
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

const run=promisify(execFile),id='rocket-supplies',dir='.cache/'+id+'/above-panels';
const sha=s=>createHash('sha256').update(s).digest('hex');
const code=(await fs.readFile('blueprint-sources/'+id+'/'+id+'.txt','utf8')).trim();
const scenarios=[
 {name:'saturated',note:'every entrance saturated',env:{RS_SATURATE:'1'}},
 {name:'circuits-plastic',note:'circuits 220 and plastic 90, everything else at its panel',feed:{'electronic-circuit':220,'plastic-bar':90}},
 {name:'circuits-360-plastic',note:'circuits 360 and plastic 90, everything else at its panel',feed:{'electronic-circuit':360,'plastic-bar':90}},
 {name:'circuits-plastic-acid',note:'circuits 220, plastic 90 and acid 50; copper at its panel (120)',feed:{'electronic-circuit':220,'plastic-bar':90,'sulfuric-acid':50}},
 {name:'circuits-plastic-copper-150',note:'circuits 220, plastic 90, copper 150',feed:{'electronic-circuit':220,'plastic-bar':90,'copper-plate':150}},
 {name:'circuits-plastic-acid-copper-150',note:'circuits 220, plastic 90, acid 50, copper 150',feed:{'electronic-circuit':220,'plastic-bar':90,'sulfuric-acid':50,'copper-plate':150}},
 {name:'circuits-plastic-copper-steel',note:'circuits 220, plastic 100, copper 240, steel 40',feed:{'electronic-circuit':220,'plastic-bar':100,'copper-plate':240,'steel-plate':40}},
 {name:'all-150-percent',note:'every entrance at 150% of its panel',feed:{'rocket-fuel':7.5,'electronic-circuit':180,'copper-plate':180,'plastic-bar':68,'steel-plate':15,'sulfuric-acid':38}},
];
await fs.rm(dir,{recursive:true,force:true});await fs.mkdir(dir,{recursive:true});
const r2=v=>Math.round(v*100)/100,round=o=>Object.fromEntries(Object.entries(o||{}).map(([k,v])=>[k,r2(v)]));
const results=await Promise.all(scenarios.map(async s=>{
 const report=dir+'/'+s.name+'-report.json';
 const env={...process.env,SPACE_EXPLORE:'1',RS_RUN_ROOT:dir+'/run-'+s.name,RS_REPORT:report,...(s.feed?{RS_FEED:JSON.stringify(s.feed)}:{}),...s.env};
 await run('node',['scripts/'+id+'/validate.mjs'],{env,maxBuffer:16e6}).catch(()=>{});
 const r=JSON.parse(await fs.readFile(report));const b=r.builds[0];
 if(b.blueprintSha256!==sha(code))throw Error('stale string in '+s.name);
 const checks=b.checks,failed=Object.keys(checks).filter(k=>!checks[k]);
 return {name:s.name,note:s.note,feed:s.feed||'saturated',
  steadyPerMinute:round(b.outputsPerMinute),recoveryPerMinute:round(b.recovery?.outputsPerMinute),
  entranceDrawPerMinute:round(Object.fromEntries([...b.inputs,...b.fluids].map(p=>[p.item,p.measuredPerMinute]))),
  blockedChestStock:Object.fromEntries(b.blocked.collectionPauseStock.map(p=>[p.item,p.count])),
  blockedChestMaximum:Object.fromEntries(b.blocked.collectionPauseStock.map(p=>[p.item,p.maxDuringBlocked])),
  machinesStoppedInLastBlockedMinute:b.blocked.machinesStoppedInLastMinute,ringMaximumStock:b.loopSamples[id].maxStock,
  failedChecks:failed,passedExceptDraw:failed.every(k=>k==='drawWithinPanels')};
}));
const protocol=JSON.parse(await fs.readFile(dir+'/'+scenarios[0].name+'-report.json')).protocolMinutes;
const out={id,blueprintSha256:sha(code),createdAt:new Date().toISOString(),protocolMinutes:protocol,floorPerMinute:4.75,scenarios:results};
await fs.writeFile('blueprint-sources/'+id+'/above-panels.json',JSON.stringify(out,null,2)+'\n');
for(const s of results)console.log(s.name.padEnd(34),s.passedExceptDraw?'pass':'FAIL '+s.failedChecks.join(','),JSON.stringify(s.steadyPerMinute),JSON.stringify(s.recoveryPerMinute),'ring',s.ringMaximumStock);
await fs.rm(dir,{recursive:true,force:true});
