import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
// The dump counts as installed only when it can be opened (a file that exists but cannot be read skips too).
const readable=p=>{try{closeSync(openSync(p,'r'));return true;}catch{return false;}};
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/processing-units/';
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const P='processing-unit';
const tile=e=>[Math.floor(e.position.x),Math.floor(e.position.y)];
const vec=d=>({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d||0];
const isBelt=e=>!!e&&/belt|splitter/.test(e.name),dirOf=e=>e.direction||0;
const beltAt=(x,y)=>entities.find(e=>isBelt(e)&&e.name!=='fast-splitter'&&tile(e)[0]===x&&tile(e)[1]===y);
const reachOf=e=>e.name==='long-handed-inserter'?2:1;
// direction is the side an arm picks from: pick = tile + v * reach, drop = tile - v * reach.
const pickTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x+dx*r,y+dy*r];};
const dropTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x-dx*r,y-dy*r];};
const machineAt=(x,y)=>entities.find(e=>e.name==='assembling-machine-2'&&Math.abs(e.position.x-(x+.5))<=1.01&&Math.abs(e.position.y-(y+.5))<=1.01);
// Belt flow tile to tile (no splitter on the routes followed here). An underground entry hands to the nearest
// underground belt on its line within 7 tiles, which must be an exit facing the same way.
function nextBelt(e){
 const[x,y]=tile(e),[dx,dy]=vec(dirOf(e));
 if(e.name==='fast-underground-belt'&&e.type==='input'){
  for(let k=1;k<=7;k++){const o=beltAt(x+dx*k,y+dy*k);if(o&&o.name==='fast-underground-belt'&&[dirOf(e),(dirOf(e)+8)%16].includes(dirOf(o))){assert(o.type==='output'&&dirOf(o)===dirOf(e),`underground entry at ${x},${y} pairs with an exit`);return o;}}
  assert.fail(`underground entry at ${x},${y} has no exit within reach`);
 }
 const t=beltAt(x+dx,y+dy);if(!t)return null;
 if(t.name==='fast-underground-belt')return t.type==='input'&&dirOf(t)===dirOf(e)?t:null;
 return (dirOf(t)+8)%16===dirOf(e)?null:t;
}
const follow=start=>{const seen=[];for(let e=start;e&&!seen.includes(e);e=nextBelt(e))seen.push(e);return seen;};

test('one record; product, target, recipe boundary and machine counts come from the prototype figures',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,'processing-units');assert.equal(m.file,'processing-units.txt');assert.equal(m.class,'rate');
 assert.deepEqual(m.products,[P]);assert.deepEqual(m.targets,{[P]:27});
 // 30 utility packs/min = 10 crafts x 2 processing units = 20/min; rocket-supplies makes 5/min; 25/min needs
 // 5.56 assembling machine 2 at 4.5/min each, rounded up to 6 machines = 27/min.
 assert.deepEqual(m.targetDerivation,{utilitySciencePerMinute:30,utilitySciencePacksPerCraft:3,processingUnitsPerUtilityCraft:2,utilityDemandPerMinute:20,rocketSuppliesDemandPerMinute:5,sumPerMinute:25,perAssemblingMachine2:4.5,processingUnitMachines:6,targetPerMinute:27});
 assert.deepEqual(m.recipeAudit.externalPerMinute,{'copper-plate':1080,'iron-plate':648,'plastic-bar':108,'sulfuric-acid':135});
 assert.deepEqual(m.machineCounts,{'copper-cable':12,'electronic-circuit':9,'advanced-circuit':8,'processing-unit':6});
 for(const[n,c]of Object.entries(m.recipeAudit.machinesExact))assert(m.machineCounts[n]>=c-1e-9,n);
 assert.deepEqual(m.outputCaps,{[P]:8});assert.equal(m.variant,'shared-channel');assert.deepEqual(m.loopControl,[]);assert.equal(m.stockControl.mode,'belt-exit');
 for(const[k,v]of Object.entries({warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10}))assert(m.protocol[k]>=v,k);
});

test('blueprint, native report, prototypes, harness and validator hashes agree',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id);assert(r,'native build evidence missing');
 assert.equal(hash(code),m.blueprintSha256);assert.equal(r.blueprintSha256,m.blueprintSha256,'native report is stale for blueprint');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);assert.equal(report.gameVersion,'2.1.24');
 assert(!report.short,'an exploration report is not a qualification');assert.equal(report.feedScale,1,'qualification feeds exactly the panel figures');
 assert.equal(report.harnessSha256,hash(await read('scripts/processing-units/control.lua')),'native harness changed since report');
 assert.equal(report.validatorSha256,hash(await read('scripts/processing-units/validate.mjs')),'validator changed since report');
 for(const[k,v]of Object.entries(m.protocol))assert.equal(report.protocolMinutes[k],v,'report protocol '+k);
});

test('native report passes the rate-class formula, recomputed from its numbers',async()=>{
 const report=await loadReport(),r=report.builds.find(b=>b.id===m.id);
 assert.equal(m.status,'qualified');assert.equal(report.passed,true);assert.equal(r.passed,true);
 const t=m.targets[P]*.95;
 assert(r.outputsPerMinute[P]>=t,'steady rate');assert(r.recovery.outputsPerMinute[P]>=t,'recovery rate');
 assert.equal(m.measured.steadyPerMinute,r.outputsPerMinute[P]);assert.equal(m.measured.recoveryPerMinute,r.recovery.outputsPerMinute[P]);
 assert.equal(r.machines.length,35);assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 // Fed exactly the panel figures: no entrance took more than its panel.
 for(const p of r.inputs){assert(p.acceptedDuringMeasurement>0&&p.productiveRoute?.length>0,'productive '+p.item);assert(p.acceptedPerMinute<=m.recipeAudit.externalPerMinute[p.item]+1e-9,'within panel '+p.item);}
 assert.equal(r.fluids.length,1);assert.equal(r.fluids[0].item,'sulfuric-acid');
 assert(r.fluids[0].acceptedPerMinute<=135+1e-9&&r.fluids[0].acceptedPerMinute>0);
 assert.equal(r.fluids[0].productiveConsumers.length,6,'every processing-unit machine on the entrance acid segment');
 assert.deepEqual(r.wrongItemsAtExit,{},'nothing but processing units at the exit');
 assert(r.blocked.collectionPauseStock.every(p=>p.count===8&&p.capacity===8&&p.maxDuringBlocked<=8),'exit holds exactly 8');
 const lanes=r.outputPorts[0].collectedByLane;assert(lanes.length===2&&lanes.every(n=>n>0)&&lanes[0]+lanes[1]===r.outputPorts[0].collectedDuringMeasurement,'both exit lanes carry processing units');
 assert(r.blocked.machinesStoppedInLastMinute,'machines stop while blocked');
 assert(r.powered&&r.externalApproachesClear&&r.exactRecipeChecks>0);
 assert(r.bulkInserters.length===10&&r.bulkInserters.every(a=>a.observedMaxHand<=2&&a.observedMaxHand>0));
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);
});

test('entrances on the west with display panels; acid by one pipe; one east belt exit',()=>{
 const f=m.footprint;
 assert.deepEqual(m.inputs.map(p=>p.item),['copper-plate','iron-plate','plastic-bar']);
 for(const p of [...m.inputs,...m.fluids]){
  const e=byId.get(p.entity);assert.equal(tile(e)[0],f.left,'entrance on the west edge '+p.item);assert.equal(p.externalSide,'west');
  const d=byId.get(p.displayEntity);assert.equal(d.name,'display-panel');assert.match(d.text,new RegExp(p.item));
  for(let k=1;k<=3;k++)assert(!entities.some(o=>tile(o)[0]===f.left-k&&tile(o)[1]===tile(e)[1]),'west approach clear');
 }
 for(const p of m.inputs)assert.equal(byId.get(p.entity).name,'fast-transport-belt');
 assert.equal(m.fluids.length,1);assert.equal(m.fluids[0].item,'sulfuric-acid');assert.match(byId.get(m.fluids[0].entity).name,/^pipe/);
 assert.equal(m.outputs.length,1);const ex=byId.get(m.outputs[0].entity);
 assert.equal(ex.name,'fast-transport-belt');assert.equal(ex.direction,4);assert.equal(tile(ex)[0],f.right-1,'exit on the east edge');
 const [x,y]=tile(ex),behind=beltAt(x-1,y);assert(behind&&behind.direction===4&&behind.type!=='input','exit fed straight from behind');
 assert.equal(m.ports.filter(p=>p.kind==='power').length,1);
});

test('allowed entities, machines, recipes and arm settings',()=>{
 const allowed=new Set(['assembling-machine-2','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','pipe','pipe-to-ground','substation','display-panel']);
 for(const e of entities){assert(allowed.has(e.name),e.name);assert(!/-module/.test(JSON.stringify(e.items??{})),'module '+e.entity_number);}
 const machines=entities.filter(e=>e.name==='assembling-machine-2');
 assert.equal(machines.length,35);
 for(const e of machines.filter(e=>e.recipe===P))assert.equal(e.direction,12,'processing-unit machines face west (acid from the west gap)');
 for(const e of entities.filter(e=>/inserter/.test(e.name)))assert.equal(e.override_stack_size,e.name==='bulk-inserter'?2:1);
 const roles=Object.values(m.armRoles).flat().sort((a,b)=>a-b);
 assert.deepEqual(roles,entities.filter(e=>/inserter/.test(e.name)).map(e=>e.entity_number).sort((a,b)=>a-b),'every arm has a role');
 // Every arm picks from a belt or a machine and drops into a belt or a machine.
 for(const e of entities.filter(e=>/inserter/.test(e.name))){
  const from=beltAt(...pickTile(e))||machineAt(...pickTile(e)),to=beltAt(...dropTile(e))||machineAt(...dropTile(e));
  assert(from&&to,'arm '+e.entity_number+' has a source and a target');
 }
});

test('the processing-unit belts reach the exit; the supply belt and the plate belt never do',()=>{
 const ex=byId.get(m.outputs[0].entity);
 const outArms=m.armRoles.output.map(id=>byId.get(id));
 assert.equal(outArms.length,6);
 for(const a of outArms){const b=beltAt(...dropTile(a));assert(b,'output arm drops on a belt');assert(follow(b).includes(ex),'processing units from arm '+a.entity_number+' reach the exit');}
 for(const id of m.armRoles.supply){const b=beltAt(...pickTile(byId.get(id)));assert(b,'supply arm picks from a belt');assert(!follow(b).includes(ex),'the supply belt does not reach the exit');}
 for(const id of m.armRoles.plate){const b=beltAt(...pickTile(byId.get(id)));assert(b,'plate arm picks from a belt');assert(!follow(b).includes(ex),'the plate belt does not reach the exit');}
});

test('footprint matches the decoded string',()=>{
 const xs=entities.map(e=>e.position.x),ys=entities.map(e=>e.position.y);
 assert.equal(m.footprint.width,31);assert.equal(m.footprint.height,28);
 assert(Math.min(...xs)>=m.footprint.left&&Math.max(...xs)<=m.footprint.right&&Math.min(...ys)>=m.footprint.top&&Math.max(...ys)<=m.footprint.bottom);
});

test('generator is reproducible: the same string from the same dump',async t=>{
 if(!readable(rawPath)){t.skip('Pinned local prototype dump is not installed (set FACTORIO_RAW)');return;}
 const out='.cache/processing-units/test-regenerate';
 await promisify(execFile)(process.execPath,['scripts/processing-units/generate.mjs','--out',out],{cwd:rootPath});
 const again=(await read(out+'/processing-units.txt')).toString().trim();
 assert.equal(hash(again),m.blueprintSha256);
});

test('the replaced 31 x 29 version is kept byte for byte under history/',async()=>{
 const h=dir+'history/twin-rows-abe14cdf/';
 const hm=JSON.parse(await read(h+'manifest.json'))[0],hcode=(await read(h+'processing-units.txt')).toString().trim(),hr=JSON.parse(await read(h+'native-report.json'));
 assert.equal(hm.variant,'twin-rows');assert.equal(hash(hcode),hm.blueprintSha256);assert.equal(hm.blueprintSha256,'abe14cdfcda0bf7a336bdc53ea1c535f444c809ddf38fa04f0834fff4023b512');
 assert.equal(hr.builds[0].blueprintSha256,hm.blueprintSha256);assert.equal(hr.passed,true);assert.equal(hm.status,'qualified');
 assert.match((await read(h+'NOTE.md')).toString(),/replaced/);
});

test('the replaced version regenerates to the same string',async t=>{
 if(!readable(rawPath)){t.skip('Pinned local prototype dump is not installed (set FACTORIO_RAW)');return;}
 const out='.cache/processing-units/test-regenerate-twin-rows';
 await promisify(execFile)(process.execPath,['scripts/processing-units/generate.mjs','--variant','twin-rows','--out',out],{cwd:rootPath});
 assert.equal(hash((await read(out+'/processing-units.txt')).toString().trim()),'abe14cdfcda0bf7a336bdc53ea1c535f444c809ddf38fa04f0834fff4023b512');
});
