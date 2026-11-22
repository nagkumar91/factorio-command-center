import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

// The dump counts as installed only when it can be opened (a file that exists but cannot be read skips too).
const readable=p=>{try{closeSync(openSync(p,'r'));return true;}catch{return false;}};
const run=promisify(execFile);
const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/plastic-bars/';
const records=JSON.parse(await read(dir+'manifest.json'));
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const P='plastic-bar';
const decoded=new Map();for(const m of records)decoded.set(m.size,decodeBlueprint((await read(dir+m.file)).toString().trim()).blueprint);

const tile=e=>[Math.floor(e.position.x),Math.floor(e.position.y)];
const vec=d=>({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d||0];
const reach=e=>e.name==='long-handed-inserter'?2:1;
// direction is the side an arm picks from: pick = tile + v * reach, drop = tile - v * reach.
const pickTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reach(e);return[x+dx*r,y+dy*r];};
const dropTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reach(e);return[x-dx*r,y-dy*r];};
function world(entities){
 const at=new Map(),k=(x,y)=>x+','+y;
 for(const e of entities){
  const w=e.name==='chemical-plant'?3:e.name==='substation'?2:1,h=e.name==='chemical-plant'?3:e.name==='substation'||e.name==='fast-splitter'?2:1;
  for(let x=Math.round(e.position.x-w/2);x<Math.round(e.position.x+w/2);x++)for(let y=Math.round(e.position.y-h/2);y<Math.round(e.position.y+h/2);y++){assert(!at.has(k(x,y)),'overlap at '+k(x,y));at.set(k(x,y),e);}
 }
 return (x,y)=>at.get(k(x,y));
}
const isBelt=e=>e?.name==='fast-transport-belt';
// Belt flow tile to tile (plain belts and the filtered splitter of the screening variant only).
function nextBelts(at,e){
 const[x,y]=tile(e),[dx,dy]=vec(e.direction);
 if(e.name==='fast-splitter')return [at(x+1,Math.floor(e.position.y-.5)),at(x+1,Math.floor(e.position.y+.5))].filter(isBelt);
 const t=at(x+dx,y+dy);if(!t)return [];
 if(t.name==='fast-splitter')return [t];
 return isBelt(t)&&(t.direction+8)%16!==e.direction?[t]:[];
}
function reachable(at,start){const seen=new Set([start]),q=[start];while(q.length){const e=q.shift();for(const n of nextBelts(at,e))if(!seen.has(n)){seen.add(n);q.push(n);}}return seen;}

test('three records: small, medium and large; figures from the recipe (2 bars per 1 s craft from 1 coal and 20 gas)',()=>{
 assert.deepEqual(records.map(m=>m.size),['small','medium','large']);
 const plants={small:2,medium:5,large:10};
 for(const m of records){
  const n=plants[m.size];
  assert.equal(m.id,'plastic-bars-'+m.size);assert.equal(m.file,`plastic-bars-${m.size}.txt`);assert.equal(m.class,'rate');
  assert.deepEqual(m.products,[P]);assert.deepEqual(m.targets,{[P]:120*n});assert.deepEqual(m.machineCounts,{[P]:n});
  assert.deepEqual(m.recipeAudit.externalPerMinute,{coal:60*n,'petroleum-gas':1200*n});
  assert.equal(m.inputs.length,1);assert.equal(m.inputs[0].item,'coal');assert.equal(m.inputs[0].perMinute,60*n);
  assert.equal(m.fluids.length,1);assert.equal(m.fluids[0].item,'petroleum-gas');assert.equal(m.fluids[0].perMinute,1200*n);
  assert.deepEqual(m.fluids[0].tile,{x:0,y:0});assert.equal(m.footprint.left,0);assert.equal(m.footprint.top,0);assert.equal(m.fluids[0].externalSide,'west');
  assert.equal(m.outputs.length,1);assert.equal(m.outputs[0].externalSide,'east');
  for(const[k,v]of Object.entries({warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10}))assert(m.protocol[k]>=v,k);
 }
});

test('each string matches its manifest SHA-256 and footprint; no modules, beacons, robots or wires',async()=>{
 const allowed=new Set(['chemical-plant','fast-transport-belt','fast-splitter','bulk-inserter','fast-inserter','long-handed-inserter','pipe','pipe-to-ground','substation','display-panel']);
 for(const m of records){
  const code=(await read(dir+m.file)).toString().trim();assert.equal(hash(code),m.blueprintSha256,m.size);
  const bp=decoded.get(m.size);assert.equal(bp.entities.length,m.entityCount);assert(!bp.wires||bp.wires.length===0);
  for(const e of bp.entities){assert(allowed.has(e.name),e.name);assert(!e.items,'no modules');}
  const xs=bp.entities.flatMap(e=>{const w=e.name==='chemical-plant'?1.5:e.name==='substation'?1:.5;return[e.position.x-w,e.position.x+w];});
  const ys=bp.entities.flatMap(e=>{const h=e.name==='chemical-plant'?1.5:e.name==='substation'||e.name==='fast-splitter'?1:.5;return[e.position.y-h,e.position.y+h];});
  assert.equal(Math.max(...xs)-Math.min(...xs),m.footprint.width);assert.equal(Math.max(...ys)-Math.min(...ys),m.footprint.height);
  assert.equal(m.tiles,m.footprint.width*m.footprint.height);
 }
 assert.deepEqual(records.map(m=>m.footprint.width+'x'+m.footprint.height),['8x7','17x7','17x12']);
});

test('belts: coal reaches every coal arm and never the exit; every product arm drops on a belt that reaches the exit',()=>{
 for(const m of records){
  const bp=decoded.get(m.size),at=world(bp.entities),byId=new Map(bp.entities.map(e=>[e.entity_number,e]));
  const entrance=byId.get(m.inputs[0].entity),exit=byId.get(m.outputs[0].entity);
  const fromCoal=reachable(at,entrance);
  assert(!fromCoal.has(exit),m.size+': coal reaches the exit');
  for(const id of m.armRoles.coal){const a=byId.get(id),t=at(...pickTile(a));assert(fromCoal.has(t),`${m.size}: coal arm ${id} picks from a tile the coal belt reaches`);
   const d=at(...dropTile(a));assert.equal(d?.name,'chemical-plant',`${m.size}: coal arm ${id} drops into a plant`);}
  for(const id of m.armRoles.product){const a=byId.get(id),s=at(...pickTile(a)),d=at(...dropTile(a));
   assert.equal(s?.name,'chemical-plant',`${m.size}: product arm ${id} picks from a plant`);
   assert(isBelt(d)&&d!==exit&&reachable(at,d).has(exit),`${m.size}: product arm ${id} drops on a belt that reaches the exit`);}
  // Every plant has one coal arm into it and at least one product arm out of it.
  for(const p of bp.entities.filter(e=>e.name==='chemical-plant')){
   assert(m.armRoles.coal.some(id=>at(...dropTile(byId.get(id)))===p),'coal arm for plant '+p.entity_number);
   assert(m.armRoles.product.some(id=>at(...pickTile(byId.get(id)))===p),'product arm for plant '+p.entity_number);
  }
  assert.equal(at(tile(exit)[0]-1,tile(exit)[1])?.direction,4,'the exit is fed from behind');
  assert.equal(at(...tile(exit).map((v,i)=>i===0?v+1:v)),undefined);
 }
});

test('gas: one pipe network from the west port touches an input connection of every plant',()=>{
 for(const m of records){
  const bp=decoded.get(m.size),at=world(bp.entities),byId=new Map(bp.entities.map(e=>[e.entity_number,e]));
  const port=byId.get(m.fluids[0].entity);assert.equal(port.name,'pipe');assert.deepEqual(tile(port),[0,0]);
  // Connections: a pipe joins all four neighbours; a pipe-to-ground joins its above-ground side and, underground,
  // the nearest pipe-to-ground facing back within 10 tiles.
  const sides=e=>e.name==='pipe'?[0,4,8,12]:[e.direction||0];
  const links=e=>{const[x,y]=tile(e),out=[];
   for(const d of sides(e)){const[dx,dy]=vec(d),n=at(x+dx,y+dy);if(n&&(n.name==='pipe'||(n.name==='pipe-to-ground'&&(n.direction+8)%16===d)))out.push(n);}
   if(e.name==='pipe-to-ground'){const[dx,dy]=vec(((e.direction||0)+8)%16);for(let k=1;k<=10;k++){const n=at(x+dx*k,y+dy*k);if(n?.name==='pipe-to-ground'){if(n.direction===e.direction)break;if((n.direction+8)%16===e.direction){out.push(n);break;}}}}
   return out;};
  const net=new Set([port]),q=[port];while(q.length){for(const n of links(q.shift()))if(!net.has(n)){net.add(n);q.push(n);}}
  for(const p of bp.entities.filter(e=>e.name==='chemical-plant')){
   const[cx,cy]=tile(p),d=p.direction||0;
   // Input targets from the native probe: north (cx-+1,cy-2); south (cx+-1,cy+2).
   const targets=d===0?[[cx-1,cy-2],[cx+1,cy-2]]:d===8?[[cx-1,cy+2],[cx+1,cy+2]]:assert.fail('plant faces '+d);
   assert(targets.some(([x,y])=>{const e=at(x,y);return e?.name==='pipe'&&net.has(e);}),`${m.size}: plant at ${cx},${cy} has gas`);
  }
 }
});

test('display panels at the entrances carry the panel figures',()=>{
 for(const m of records){
  const bp=decoded.get(m.size),byId=new Map(bp.entities.map(e=>[e.entity_number,e]));
  const coal=byId.get(m.inputs[0].displayEntity),gas=byId.get(m.fluids[0].displayEntity);
  assert.match(coal.text,new RegExp(`IN: coal\\nWEST · ${m.inputs[0].perMinute}/min`));
  assert.match(gas.text,new RegExp(`IN: petroleum-gas \\(pipe\\)\\nWEST · ${m.fluids[0].perMinute.toLocaleString('en-US')}/min`));
 }
});

test('status comes only from a full-protocol report at the panel feed for the exact string',async()=>{
 for(const m of records){
  let report=null;try{report=JSON.parse(await read(dir+m.reportFile));}catch{}
  if(m.status==='unverified'){assert(!report||!report.builds?.some(b=>b.blueprintSha256===m.blueprintSha256&&!report.short&&report.feedScale===1));continue;}
  const r=report.builds.find(b=>b.blueprintSha256===m.blueprintSha256);assert(r&&!report.short&&report.feedScale===1);
  assert.equal(m.status,r.passed&&report.passed?'qualified':'not-qualified');
  assert.equal(report.prototypeSha256,m.prototypeSha256);
  if(m.status==='qualified'){
   assert(r.outputsPerMinute[P]>=m.targets[P]*.95&&r.recovery.outputsPerMinute[P]>=m.targets[P]*.95);
   assert.deepEqual(r.wrongItemsAtExit,{});assert(r.machines.every(x=>x.measuredCrafts>0));
   assert.equal(m.measured.steadyPerMinute,r.outputsPerMinute[P]);
  }
 }
});

test('the generator reproduces the folder byte for byte',async()=>{
 const tmp=new URL(`.cache/plastic-bars/test-${process.pid}/`,root);
 await fs.rm(tmp,{recursive:true,force:true});await fs.mkdir(tmp,{recursive:true});
 try{
  for(const f of await fs.readdir(new URL(dir,root)))await fs.copyFile(new URL(dir+f,root),new URL(f,tmp));
  await run(process.execPath,['scripts/plastic-bars/generate.mjs','--out',fileURLToPath(tmp)],{cwd:rootPath});
  for(const f of await fs.readdir(new URL(dir,root)))assert.equal((await fs.readFile(new URL(f,tmp))).toString(),(await read(dir+f)).toString(),f);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});

test('recipe and plant figures match the prototype dump',{skip:!readable(rawPath)&&'prototype dump not installed'},async()=>{
 const bytes=await fs.readFile(rawPath),raw=JSON.parse(bytes);
 assert.equal(hash(bytes),records[0].prototypeSha256);
 const r=raw.recipe[P];assert.equal(r.energy_required,1);
 assert.deepEqual(r.results.map(x=>[x.name,x.amount]),[[P,2]]);
 assert.deepEqual(Object.fromEntries(r.ingredients.map(x=>[x.name,x.amount])),{coal:1,'petroleum-gas':20});
 assert.equal(raw['assembling-machine']['chemical-plant'].crafting_speed,1);
 assert.equal(raw['underground-belt']['fast-underground-belt'].max_distance,7);
 assert.equal(raw['electric-pole'].substation.supply_area_distance,9);
});
