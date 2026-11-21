import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/white-pack-receiver/';
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
// The receiver is qualified by the white-platform end-to-end run; it writes this report too. Missing must fail.
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
let rawReadable=false;try{await fs.access(rawPath,fs.constants.R_OK);rawReadable=true;}catch{}
// Inline sizes (spec section 7): pad 8x8, chest 1x1, arm 1x1, substation 2x2.
const SIZE={'cargo-landing-pad':[8,8],'passive-provider-chest':[1,1],'fast-inserter':[1,1],substation:[2,2]};

test('one record; delivers packs, crafts nothing, caps and request are the spec values',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,'white-pack-receiver');assert.equal(m.file,'white-pack-receiver.txt');assert.equal(m.class,'receiver');
 assert.equal(m.name,'White-pack receiver · landing pad to chest');assert.equal(bp.label,m.name);
 assert.deepEqual(m.products,[]);assert.deepEqual(m.targets,{});assert.deepEqual(m.machineCounts,{});
 assert.deepEqual(m.deliveredItems,['space-science-pack']);assert.deepEqual(m.deliveryTarget,{'space-science-pack':60});
 assert.deepEqual(m.outputCaps,{'space-science-pack':2000});
 assert.deepEqual(m.inputs,[]);assert.deepEqual(m.fluids,[]);assert.deepEqual(m.loopControl,[]);assert.deepEqual(m.supplierLinks,[]);
 assert.equal(m.stockControl.mode,'bar');assert.equal(m.stockControl.bar,10);assert.equal(m.stockControl.cap,2000);assert.equal(m.stockControl.padRequest,1000);
 for(const [k,v] of Object.entries({warmupMinutes:60,measureMinutes:120,blockedMinutes:30,recoveryMinutes:60}))assert(m.protocol[k]>=v,k);
});

test('entities: one pad requesting 1,000 packs, one fast arm, one capped chest, one substation; nothing else',()=>{
 assert.deepEqual(entities.map(e=>e.name).sort(),['cargo-landing-pad','fast-inserter','passive-provider-chest','substation']);
 const pad=entities.find(e=>e.name==='cargo-landing-pad'),arm=entities.find(e=>e.name==='fast-inserter'),chest=entities.find(e=>e.name==='passive-provider-chest'),sub=entities.find(e=>e.name==='substation');
 assert.deepEqual(pad.position,{x:0,y:0});
 assert.deepEqual(pad.request_filters,{sections:[{index:1,filters:[{index:1,name:'space-science-pack',quality:'normal',comparator:'=',count:1000}]}],request_from_buffers:true});
 assert.equal(arm.direction,12,'the arm picks from the west (the pad)');assert.equal(arm.override_stack_size,1);assert(!arm.use_filters);
 assert.deepEqual(arm.position,{x:4.5,y:-0.5});assert.deepEqual(chest.position,{x:5.5,y:-0.5});assert.equal(chest.bar,10);
 assert(!chest.request_filters,'a passive provider chest, no requests');
 assert.deepEqual(sub.position,{x:5,y:1});
 assert.deepEqual(m.billOfMaterials.items,{'cargo-landing-pad':1,'fast-inserter':1,'passive-provider-chest':1,substation:1});
 assert.deepEqual(m.construction,m.billOfMaterials.items);
 assert.deepEqual(bp.wires,[]);
 for(const e of entities)assert.equal(e.tags?.flight_science_entity,e.entity_number);
 assert.equal(bp.version,562954249961473);assert.equal(bp.icons[0].signal.name,'space-science-pack');
});

test('ports: the east chest output and the power port at the substation',()=>{
 const out=m.ports.filter(p=>p.kind==='output');assert.equal(out.length,1);assert.deepEqual(m.outputs,out);
 const chest=byId.get(out[0].entity);assert.equal(chest.name,'passive-provider-chest');assert.equal(out[0].externalSide,'east');assert.equal(out[0].cap,2000);assert.equal(out[0].item,'space-science-pack');
 const power=m.ports.find(p=>p.kind==='power');assert.equal(byId.get(power.entity).name,'substation');
 // nothing on the three tiles east of the chest
 const tx=Math.floor(chest.position.x),ty=Math.floor(chest.position.y);
 for(const e of entities){let [w,h]=SIZE[e.name];for(let x=Math.round(e.position.x-w/2);x<Math.round(e.position.x+w/2);x++)for(let y=Math.round(e.position.y-h/2);y<Math.round(e.position.y+h/2);y++)assert(!(y===ty&&x>tx&&x<=tx+3),'east of the chest at '+x);}
 // the substation covers the arm (supply area 18 x 18)
 const sub=byId.get(power.entity),arm=entities.find(e=>e.name==='fast-inserter');assert(Math.abs(sub.position.x-arm.position.x)<9&&Math.abs(sub.position.y-arm.position.y)<9);
});

test('footprint equals the bounds of the decoded string and meets the 80-tile goal',()=>{
 const boxes=entities.map(e=>{const [w,h]=SIZE[e.name];return {l:e.position.x-w/2,r:e.position.x+w/2,t:e.position.y-h/2,b:e.position.y+h/2};});
 const f={left:Math.min(...boxes.map(b=>b.l)),top:Math.min(...boxes.map(b=>b.t)),right:Math.max(...boxes.map(b=>b.r)),bottom:Math.max(...boxes.map(b=>b.b))};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);
 assert.equal(m.areaGoal.achievedTiles,f.width*f.height);assert.equal(m.areaGoal.achievedTiles,80);assert.equal(m.areaGoal.goalTiles,80);
 // no overlap
 const used=new Set();for(const e of entities){const [w,h]=SIZE[e.name];for(let x=Math.round(e.position.x-w/2);x<Math.round(e.position.x+w/2);x++)for(let y=Math.round(e.position.y-h/2);y<Math.round(e.position.y+h/2);y++){assert(!used.has(x+','+y));used.add(x+','+y);}}
});

test('native report: hashes agree and the end-to-end run passes the receiver checks',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id);assert(r,'receiver evidence missing');
 assert.equal(hash(code),m.blueprintSha256);assert.equal(r.blueprintSha256,m.blueprintSha256,'native report is stale for blueprint');
 const [platform]=JSON.parse(await read('blueprint-sources/white-platform/manifest.json'));
 assert.equal(r.platformBlueprintSha256,platform.blueprintSha256,'qualified with the published platform');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);assert.equal(report.gameVersion,'2.1.24');
 assert(!report.short);
 assert.equal(report.harnessSha256,hash(await read('scripts/white-platform/control.lua')),'harness changed since report');
 assert.equal(report.validatorSha256,hash(await read('scripts/white-platform/validate.mjs')),'validator changed since report');
 assert.equal(m.status,'qualified');assert.equal(report.passed,true);assert.equal(r.passed,true);
 assert(Object.values(r.checks).every(Boolean));
 for(const k of ['geometry','armStackOverride','chestBar','eastClear','padRequest','onePad','powered'])assert.equal(r.receiver.importChecks[k],true,k);
 assert.equal(r.receiver.padSections.filter(s=>s.active&&s.filters.length).length,1);
 const floor=m.deliveryTarget['space-science-pack']*.95;
 assert(r.steady.collectedPerMinute>=floor);assert(r.recovery.collectedPerMinute>=floor);
 assert.equal(r.blocked.chest,2000);assert(r.blocked.chestMaxDuringBlocked<=2000);assert(r.blocked.pad>=1000);
 assert(r.firstPodSecondsAfterBuild<=m.protocol.firstPodLimitMinutes*60);
 assert(r.firstPods.length>0&&r.firstPods.every(p=>Object.keys(p.cargo).every(n=>n==='space-science-pack')));
 assert.match(report.feedPolicy,/only by the game's own cargo pods/);
});

test('generator reproduces the committed string and manifest byte for byte',{skip:rawReadable?false:'prototype dump not readable here: regenerating the string needs FACTORIO_RAW'},async()=>{
 const out=fileURLToPath(new URL('.cache/white-pack-receiver/test-regenerate/',root));
 await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
 await fs.copyFile(new URL(dir+'native-report.json',root),out+'native-report.json');
 await promisify(execFile)(process.execPath,['scripts/white-pack-receiver/generate.mjs','--out',out],{cwd:rootPath,env:{...process.env,FACTORIO_RAW:rawPath}});
 assert.equal(await fs.readFile(out+'white-pack-receiver.txt','utf8'),(await read(dir+'white-pack-receiver.txt')).toString());
 assert.equal(await fs.readFile(out+'manifest.json','utf8'),(await read(dir+'manifest.json')).toString());
});
