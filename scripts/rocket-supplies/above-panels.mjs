// Supply above the panel figures: runs the PUBLISHED string through the full protocol (exploration
// mode, so native-report.json is never touched) with some entrances fed above their panels, and
// writes blueprint-sources/rocket-supplies/above-panels.json. An overridden entrance is compared
// with its own feed, so "drawWithinPanels" fails only when every entrance is saturated or when the
// harness's small feed credit carries one item into the measured window; it is ignored in
// "passedExceptDraw". Review of 2026-11-21, must-fix 2; widened by the design review of 2026-11-21
// (circuits alone, plastic at its panel, steel above its panel).
//
//   node scripts/rocket-supplies/above-panels.mjs
//   RS_ABOVE_SOURCE=<folder with a string and manifest> RS_ABOVE_OUT=<file> node scripts/rocket-supplies/above-panels.mjs
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

const run=promisify(execFile),id='rocket-supplies';
const source=process.env.RS_ABOVE_SOURCE||'blueprint-sources/'+id,out=process.env.RS_ABOVE_OUT||source+'/above-panels.json';
const sha=s=>createHash('sha256').update(s).digest('hex');
const dir='.cache/'+id+'/above-panels-'+sha(source).slice(0,8);
const code=(await fs.readFile(source+'/'+id+'.txt','utf8')).trim();
const CIRCUITS='electronic-circuit',PLASTIC='plastic-bar',COPPER='copper-plate',STEEL='steel-plate',ACID='sulfuric-acid';
const scenarios=[
 {name:'saturated',note:'every entrance saturated',env:{RS_SATURATE:'1'}},
 {name:'all-150-percent',note:'every entrance at 150% of its panel',feed:{'rocket-fuel':7.5,[CIRCUITS]:180,[COPPER]:180,[PLASTIC]:68,[STEEL]:15,[ACID]:38}},
 {name:'all-105-percent',note:'every entrance at 105% of its panel (the contract\'s starting figures)',feed:{'rocket-fuel':5.3,[CIRCUITS]:126,[COPPER]:126,[PLASTIC]:48,[STEEL]:11,[ACID]:27}},
 // Circuits above the panel (a split green-circuit belt), the others at their panels unless named.
 {name:'circuits',note:'circuits 220, everything else at its panel',feed:{[CIRCUITS]:220}},
 {name:'circuits-acid',note:'circuits 220 and acid 50, everything else at its panel',feed:{[CIRCUITS]:220,[ACID]:50}},
 {name:'circuits-130-acid',note:'circuits 130 and acid 50, everything else at its panel',feed:{[CIRCUITS]:130,[ACID]:50}},
 {name:'circuits-acid-steel',note:'circuits 220, acid 50 and steel 40; copper and plastic at their panels',feed:{[CIRCUITS]:220,[ACID]:50,[STEEL]:40}},
 {name:'circuits-acid-copper-150',note:'circuits 220, acid 50 and copper 150; plastic at its panel (45)',feed:{[CIRCUITS]:220,[ACID]:50,[COPPER]:150}},
 {name:'all-but-plastic',note:'circuits 220, acid 50, steel 40 and copper 240; plastic at its panel (45)',feed:{[CIRCUITS]:220,[ACID]:50,[STEEL]:40,[COPPER]:240}},
 {name:'all-but-copper',note:'circuits 220, acid 50, steel 40 and plastic 90; copper at its panel (120)',feed:{[CIRCUITS]:220,[ACID]:50,[STEEL]:40,[PLASTIC]:90}},
 {name:'circuits-plastic',note:'circuits 220 and plastic 90, everything else at its panel',feed:{[CIRCUITS]:220,[PLASTIC]:90}},
 {name:'circuits-360-plastic',note:'circuits 360 and plastic 90, everything else at its panel',feed:{[CIRCUITS]:360,[PLASTIC]:90}},
 {name:'circuits-plastic-acid',note:'circuits 220, plastic 90 and acid 50; copper at its panel (120)',feed:{[CIRCUITS]:220,[PLASTIC]:90,[ACID]:50}},
 {name:'circuits-plastic-copper-150',note:'circuits 220, plastic 90, copper 150',feed:{[CIRCUITS]:220,[PLASTIC]:90,[COPPER]:150}},
 {name:'circuits-plastic-acid-copper-150',note:'circuits 220, plastic 90, acid 50, copper 150',feed:{[CIRCUITS]:220,[PLASTIC]:90,[ACID]:50,[COPPER]:150}},
 {name:'circuits-plastic-copper-steel',note:'circuits 220, plastic 100, copper 240, steel 40',feed:{[CIRCUITS]:220,[PLASTIC]:100,[COPPER]:240,[STEEL]:40}},
 // A little more than the panel of one shared item, everything else well above.
 {name:'plastic-50-rest-high',note:'plastic 50; circuits 220, acid 50, steel 40, copper 240',feed:{[CIRCUITS]:220,[ACID]:50,[STEEL]:40,[COPPER]:240,[PLASTIC]:50}},
 {name:'copper-130-rest-high',note:'copper 130; circuits 220, acid 50, steel 40, plastic 90',feed:{[CIRCUITS]:220,[ACID]:50,[STEEL]:40,[COPPER]:130,[PLASTIC]:90}},
 // One entrance alone above its panel.
 {name:'acid',note:'acid 50, everything else at its panel',feed:{[ACID]:50}},
 {name:'steel',note:'steel 40, everything else at its panel',feed:{[STEEL]:40}},
 {name:'plastic',note:'plastic 90, everything else at its panel',feed:{[PLASTIC]:90}},
 {name:'copper',note:'copper 240, everything else at its panel',feed:{[COPPER]:240}},
];
await fs.rm(dir,{recursive:true,force:true});await fs.mkdir(dir,{recursive:true});
const r2=v=>Math.round(v*100)/100,round=o=>Object.fromEntries(Object.entries(o||{}).map(([k,v])=>[k,r2(v)]));
async function one(s){
 const report=dir+'/'+s.name+'-report.json';
 const env={...process.env,SPACE_EXPLORE:'1',RS_SOURCE:source,RS_RUN_ROOT:dir+'/run-'+s.name,RS_REPORT:report,...(s.feed?{RS_FEED:JSON.stringify(s.feed)}:{}),...s.env};
 await run('node',['scripts/'+id+'/validate.mjs'],{env,maxBuffer:16e6}).catch(()=>{});
 await fs.rm(dir+'/run-'+s.name,{recursive:true,force:true});
 const r=JSON.parse(await fs.readFile(report));const b=r.builds[0];
 if(b.blueprintSha256!==sha(code))throw Error('stale string in '+s.name);
 const checks=b.checks,failed=Object.keys(checks).filter(k=>!checks[k]);
 return {name:s.name,note:s.note,feed:s.feed||'saturated',
  steadyPerMinute:round(b.outputsPerMinute),recoveryPerMinute:round(b.recovery?.outputsPerMinute),
  entranceDrawPerMinute:round(Object.fromEntries([...b.inputs,...b.fluids].map(p=>[p.item,p.measuredPerMinute]))),
  blockedChestStock:Object.fromEntries(b.blocked.collectionPauseStock.map(p=>[p.item,p.count])),
  blockedChestMaximum:Object.fromEntries(b.blocked.collectionPauseStock.map(p=>[p.item,p.maxDuringBlocked])),
  machinesStoppedInLastBlockedMinute:b.blocked.machinesStoppedInLastMinute,ringMaximumStock:b.loopSamples[id].maxStock,
  // Share of the measured seconds in which the ring held both reserves (the paced machines ran free).
  ...(b.pacing?{pacingFreeShare:r2(b.pacing.measurement.free/b.pacing.measurement.samples)}:{}),
  failedChecks:failed,passedExceptDraw:failed.every(k=>k==='drawWithinPanels'),protocolMinutes:r.protocolMinutes};
}
// Eight games at a time.
const results=[];
for(let i=0;i<scenarios.length;i+=8)results.push(...await Promise.all(scenarios.slice(i,i+8).map(one)));
const protocol=results[0].protocolMinutes;
for(const s of results){if(JSON.stringify(s.protocolMinutes)!==JSON.stringify(protocol))throw Error('protocol differs in '+s.name);delete s.protocolMinutes;}
const result={id,blueprintSha256:sha(code),createdAt:new Date().toISOString(),protocolMinutes:protocol,floorPerMinute:4.75,scenarios:results};
await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
for(const s of results)console.log(s.name.padEnd(34),s.passedExceptDraw?'pass':'FAIL '+s.failedChecks.join(','),JSON.stringify(s.steadyPerMinute),JSON.stringify(s.recoveryPerMinute),'ring',s.ringMaximumStock);
await fs.rm(dir,{recursive:true,force:true});
