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
const dir='blueprint-sources/production-science-small/';
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const P='production-science-pack';
const near=(a,b)=>Math.abs(a-b)<1e-9;
const tile=e=>[Math.floor(e.position.x),Math.floor(e.position.y)];
const vec=d=>({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d||0];
const isBelt=e=>!!e&&/belt/.test(e.name),dirOf=e=>e.direction||0;
const beltAt=(x,y)=>entities.find(e=>isBelt(e)&&tile(e)[0]===x&&tile(e)[1]===y);
const reachOf=e=>e.name==='long-handed-inserter'?2:1;
// direction is the side an arm picks from: pick = tile + v * reach, drop = tile - v * reach.
const pickTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x+dx*r,y+dy*r];};
const dropTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x-dx*r,y-dy*r];};
const machineAt=(x,y)=>entities.find(e=>e.name==='assembling-machine-2'&&Math.abs(e.position.x-(x+.5))<=1.01&&Math.abs(e.position.y-(y+.5))<=1.01);
// Belt flow tile to tile. An underground entry hands to the nearest underground belt on its line within 7 tiles.
function nextBelt(e){
 const[x,y]=tile(e),[dx,dy]=vec(dirOf(e));
 if(e.name==='fast-underground-belt'&&e.type==='input'){
  for(let k=1;k<=7;k++){const o=beltAt(x+dx*k,y+dy*k);if(o&&o.name==='fast-underground-belt'){assert(o.type==='output'&&dirOf(o)===dirOf(e),`underground entry at ${x},${y} pairs with an exit`);return o;}}
  assert.fail(`underground entry at ${x},${y} has no exit within reach`);
 }
 const t=beltAt(x+dx,y+dy);if(!t)return null;
 if(t.name==='fast-underground-belt')return t.type==='input'&&dirOf(t)===dirOf(e)?t:null;
 return (dirOf(t)+8)%16===dirOf(e)?null:t;
}
const follow=start=>{const seen=[];for(let e=start;e&&!seen.includes(e);e=nextBelt(e))seen.push(e);return seen;};

test('one record; target is what two science machines make; recipe boundary and machine counts from the prototype figures',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,'production-science-small');assert.equal(m.file,'production-science-small.txt');assert.equal(m.class,'rate');
 assert.deepEqual(m.products,[P]);
 // 21 s per craft at speed 0.75 = 28 s for 3 packs = 6.43 per minute per machine; two machines = 90/7 per minute.
 assert(near(m.targets[P],90/7));
 assert.equal(m.targetDerivation.scienceMachines,2);assert.equal(m.targetDerivation.recipeSeconds,21);assert.equal(m.targetDerivation.packsPerCraft,3);
 const want={'steel-plate':750/7,'stone-brick':300/7,'stone':450/7,'iron-plate':225/7,'electronic-circuit':150/7,'advanced-circuit':300/7};
 assert.deepEqual(Object.keys(m.recipeAudit.externalPerMinute).sort(),Object.keys(want).sort());
 for(const[k,v]of Object.entries(want))assert(near(m.recipeAudit.externalPerMinute[k],v),k);
 assert.deepEqual(m.machineCounts,{'productivity-module':2,'electric-furnace':1,'production-science-pack':2,'rail':1,'iron-stick':1});
 for(const[n,c]of Object.entries(m.recipeAudit.machinesExact))assert.equal(m.machineCounts[n],Math.ceil(c-1e-9),n+' is the smallest whole number');
 assert.deepEqual(m.outputCaps,{[P]:4});assert.deepEqual(m.loopControl,[]);assert.equal(m.stockControl.mode,'belt-exit');assert.deepEqual(m.fluids,[]);
 assert.deepEqual(m.circuitSuppliers,{'electronic-circuit':'green-circuits','advanced-circuit':'advanced-circuits'});
 for(const[k,v]of Object.entries({warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10}))assert(m.protocol[k]>=v,k);
});

test('blueprint, native report, prototypes, harness and validator hashes agree',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id);assert(r,'native build evidence missing');
 assert.equal(hash(code),m.blueprintSha256);assert.equal(r.blueprintSha256,m.blueprintSha256,'native report is stale for blueprint');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);assert.equal(report.gameVersion,'2.1.24');
 assert(!report.short,'an exploration report is not a qualification');assert.equal(report.feedScale,1,'qualification feeds exactly the panel figures');
 assert.equal(report.harnessSha256,hash(await read('scripts/production-science-small/control.lua')),'native harness changed since report');
 assert.equal(report.validatorSha256,hash(await read('scripts/production-science-small/validate.mjs')),'validator changed since report');
 for(const[k,v]of Object.entries(m.protocol))assert.equal(report.protocolMinutes[k],v,'report protocol '+k);
});

test('native report passes the rate-class formula, recomputed from its numbers',async()=>{
 const report=await loadReport(),r=report.builds.find(b=>b.id===m.id);
 assert.equal(m.status,'qualified');assert.equal(report.passed,true);assert.equal(r.passed,true);
 const t=m.targets[P]*.95;
 assert(r.outputsPerMinute[P]>=t,'steady rate');assert(r.recovery.outputsPerMinute[P]>=t,'recovery rate');
 assert.equal(m.measured.steadyPerMinute,r.outputsPerMinute[P]);assert.equal(m.measured.recoveryPerMinute,r.recovery.outputsPerMinute[P]);
 assert.equal(r.machines.length,7);assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 // Fed exactly the panel figures: no entrance took more than its panel, plus the at most 8 items of feed credit
 // (control.lua caps it at 8) that can carry into the window.
 assert.equal(r.inputs.length,6);
 for(const p of r.inputs){assert(p.acceptedDuringMeasurement>0&&p.productiveRoute?.length>0,'productive '+p.item);assert(p.acceptedPerMinute<=m.recipeAudit.externalPerMinute[p.item]+8/report.protocolMinutes.measureMinutes+1e-9,'within panel '+p.item);}
 assert.deepEqual(r.wrongItemsAtExit,{},'nothing but production science packs at the exit');
 assert(r.blocked.collectionPauseStock.every(p=>p.count===4&&p.capacity===4&&p.maxDuringBlocked<=4),'exit holds exactly 4');
 assert(r.blocked.machinesStoppedInLastMinute,'machines stop while blocked');
 assert(r.powered&&r.externalApproachesClear&&r.exactRecipeChecks>0);
 assert.deepEqual(r.bulkInserters,[]);
 assert.equal(r.inserterCapacityResearch.fast,0);
});

test('the 80% feed run (exploration, full phase lengths) makes proportionally less and does not jam',async()=>{
 const u=JSON.parse(await read(dir+'underfed-report.json')),r=u.builds[0];
 assert.equal(u.short,true);assert.equal(u.feedScale,.8);assert.equal(r.blueprintSha256,m.blueprintSha256);
 for(const[k,v]of Object.entries(m.protocol))assert.equal(u.protocolMinutes[k],v,'full phase '+k);
 const t=m.targets[P]*.8;
 assert(r.outputsPerMinute[P]>=t*.95&&r.outputsPerMinute[P]<=m.targets[P]*.85,'about 80% of the target');
 assert(r.recovery.outputsPerMinute[P]>=t*.95,'recovers');
 assert(r.machines.every(x=>x.measuredCrafts>0));assert.deepEqual(r.wrongItemsAtExit,{});
 assert(r.blocked.machinesStoppedInLastMinute);
 assert.deepEqual(m.measured.underfed.steadyPerMinute,r.outputsPerMinute);
});

test('six entrances on the west edge with display panels; one east belt exit',()=>{
 const f=m.footprint;
 assert.deepEqual(m.inputs.map(p=>p.item),['steel-plate','stone-brick','stone','iron-plate','electronic-circuit','advanced-circuit']);
 for(const p of m.inputs){
  const e=byId.get(p.entity);assert.equal(e.name,'fast-transport-belt');assert.equal(tile(e)[0],f.left,'entrance on the west edge '+p.item);assert.equal(p.externalSide,'west');
  const d=byId.get(p.displayEntity);assert.equal(d.name,'display-panel');assert.match(d.text,new RegExp(p.item));assert.match(d.text,new RegExp(String(Math.round(p.perMinute*10)/10)));
  for(let k=1;k<=3;k++)assert(!entities.some(o=>tile(o)[0]===f.left-k&&tile(o)[1]===tile(e)[1]),'west approach clear');
 }
 assert.equal(m.outputs.length,1);const ex=byId.get(m.outputs[0].entity);
 assert.equal(ex.name,'fast-transport-belt');assert.equal(ex.direction,4);assert.equal(tile(ex)[0],f.right-1,'exit on the east edge');
 assert.equal(m.ports.filter(p=>p.kind==='power').length,1);
});

test('allowed entities: red belts only, assembling machine 2 without modules, fast and long arms, one substation',()=>{
 const allowed=new Set(['assembling-machine-2','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','substation','display-panel']);
 for(const e of entities){assert(allowed.has(e.name),e.name);assert(!e.items,'nothing preinstalled '+e.entity_number);}
 assert.equal(entities.filter(e=>e.name==='assembling-machine-2').length,7);
 assert.equal(entities.filter(e=>e.name==='substation').length,1);
 assert(!bp.wires?.length,'no circuit logic');
 for(const e of entities.filter(e=>/inserter/.test(e.name)))assert.equal(e.override_stack_size,1);
 const roles=Object.values(m.armRoles).flat().sort((a,b)=>a-b);
 assert.deepEqual(roles,entities.filter(e=>/inserter/.test(e.name)).map(e=>e.entity_number).sort((a,b)=>a-b),'every arm has a role');
});

test('hand-offs are machine to machine: furnaces, modules and rails straight into the science machines, sticks into the rail maker',()=>{
 const arm=e=>[machineAt(...pickTile(e))?.recipe,machineAt(...dropTile(e))?.recipe];
 const pairs=m.armRoles.handoff.map(id=>arm(byId.get(id)).join(' > ')).sort();
 assert.deepEqual(pairs,['electric-furnace > production-science-pack','electric-furnace > production-science-pack','iron-stick > rail','productivity-module > production-science-pack','productivity-module > production-science-pack','rail > production-science-pack','rail > production-science-pack']);
 // Each science machine gets its own module maker, the furnace maker and the rail maker.
 for(const s of entities.filter(e=>e.recipe===P)){const into=m.armRoles.handoff.map(id=>byId.get(id)).filter(a=>machineAt(...dropTile(a))===s).map(a=>machineAt(...pickTile(a)).recipe).sort();assert.deepEqual(into,['electric-furnace','productivity-module','rail']);}
 // Supply arms pick from a belt and drop into a machine; output arms take packs from a science machine onto a belt that reaches the exit.
 const ex=byId.get(m.outputs[0].entity);
 for(const id of m.armRoles.supply){const a=byId.get(id),b=beltAt(...pickTile(a));assert(b&&machineAt(...dropTile(a)),'supply arm '+id);assert(!follow(b).includes(ex),'a supply belt never reaches the exit');}
 assert.equal(m.armRoles.output.length,2);
 for(const id of m.armRoles.output){const a=byId.get(id);assert.equal(machineAt(...pickTile(a)).recipe,P);assert(follow(beltAt(...dropTile(a))).includes(ex),'packs reach the exit');}
});

test('footprint matches the decoded string',()=>{
 const xs=entities.map(e=>e.position.x),ys=entities.map(e=>e.position.y);
 assert.equal(m.footprint.width,14);assert.equal(m.footprint.height,18);
 assert(Math.min(...xs)>=m.footprint.left&&Math.max(...xs)<=m.footprint.right&&Math.min(...ys)>=m.footprint.top&&Math.max(...ys)<=m.footprint.bottom);
});

test('generator is reproducible: the same string from the same dump',async t=>{
 if(!readable(rawPath)){t.skip('Pinned local prototype dump is not installed (set FACTORIO_RAW)');return;}
 const out='.cache/production-science-small/test-regenerate';
 await promisify(execFile)(process.execPath,['scripts/production-science-small/generate.mjs','--out',out],{cwd:rootPath});
 const again=(await read(out+'/production-science-small.txt')).toString().trim();
 assert.equal(hash(again),m.blueprintSha256);
});
