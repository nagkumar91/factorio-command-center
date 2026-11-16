import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {optimizeUnderground} from '../scripts/rgby-science/underground.mjs';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const belt=(id,x,y=0,direction=4,extra={})=>({entity_number:id,name:'fast-transport-belt',position:{x:x+.5,y:y+.5},direction,tags:{flight_science_entity:id},...extra});
const line=(length,y=0,first=1,d=4)=>Array.from({length},(_,x)=>belt(first+x,x,y,d));
const ug=(id,x,y,type,direction=4)=>({...belt(id,x,y,direction),name:'fast-underground-belt',type});
const byId=(bp,id)=>bp.entities.find(e=>e.entity_number===id);
// Independent transport reachability oracle, including physical side feeds and
// nearest legal red underground outputs. It does not use optimizer internals.
function reachable(bp,start,end) {
 const at=new Map(bp.entities.map(e=>[`${e.position.x},${e.position.y}`,e])),by=new Map(bp.entities.map(e=>[e.entity_number,e]));
 const steps={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]},seen=new Set(),queue=[start];
 while(queue.length){const id=queue.shift();if(id===end)return true;if(seen.has(id))continue;seen.add(id);const e=by.get(id);if(!e)continue;const [dx,dy]=steps[e.direction??0];
  if(e.name==='fast-underground-belt'&&e.type==='input'){
   for(let span=1;span<=7;span++){const n=at.get(`${e.position.x+span*dx},${e.position.y+span*dy}`);if(n?.name==='fast-underground-belt'&&n.type==='output'&&n.direction===e.direction){queue.push(n.entity_number);break;}}
  }else{const n=at.get(`${e.position.x+dx},${e.position.y+dy}`);if(n)queue.push(n.entity_number);}
 }
 return false;
}

test('long red run saves entities, preserves endpoint IDs/tags and physical delivery',()=>{
 const bp={entities:line(30),wires:[],description:'keep'},before=structuredClone(bp);
 const r=optimizeUnderground(bp);
 assert(r.saved>0);assert.equal(r.saved,r.before.entities-r.after.entities);
 assert.equal(r.after.redUndergroundBelts,r.pairs.length*2);assert(reachable(bp,1,30));assert.equal(bp.description,'keep');
 for(const p of r.pairs){assert(p.span>=4&&p.span<=7);assert.equal(p.removed.length,p.span-1);for(const [id,type] of [[p.input,'input'],[p.output,'output']]){
  const old=before.entities.find(e=>e.entity_number===id),now=byId(bp,id);assert.deepEqual(now,{...old,name:'fast-underground-belt',type});
 }for(const id of p.removed)assert(!byId(bp,id));}
 assert.deepEqual(bp.wires,[]);
});

test('north, south, and west tunnels retain direction and legal endpoint span',()=>{
 for(const d of [0,8,12]){const [dx,dy]=({0:[0,-1],8:[0,1],12:[-1,0]})[d];const bp={entities:Array.from({length:25},(_,i)=>belt(i+1,i*dx,i*dy,d))};const r=optimizeUnderground(bp);assert(r.saved>0);assert(reachable(bp,1,25));for(const p of r.pairs)assert(p.span<=7);}
});

test('component belts, controlled readers, and wired endpoints stay byte-for-byte intact',()=>{
 const bp={entities:line(50),wires:[[12,1,40,1]]};
 for(let i=0;i<10;i++)bp.entities[i].tags.rgby_component='local-loop';
 bp.entities[19].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
 bp.entities[29].connections={'1':{red:[{entity_id:35}]}};
 const keep=[1,2,3,4,5,6,7,8,9,10,12,20,30,35,40].map(id=>structuredClone(byId(bp,id))),wires=structuredClone(bp.wires);
 const r=optimizeUnderground(bp);assert(r.saved>0);for(const e of keep)assert.deepEqual(byId(bp,e.entity_number),e);assert.deepEqual(bp.wires,wires);
});

test('turns and both sides of a side feed survive while distant straight runs shrink',()=>{
 const bp={entities:line(40)};
 const turn=byId(bp,40);turn.direction=8;
 bp.entities.push(belt(41,39,1,8),belt(42,39,2,8),belt(100,19,-1,8),belt(101,19,-2,8));
 const keep=[19,20,21,39,40,41,42,100,101].map(id=>structuredClone(byId(bp,id)));
 assert(reachable(bp,101,42));const r=optimizeUnderground(bp);assert(r.saved>0);
 for(const e of keep)assert.deepEqual(byId(bp,e.entity_number),e);
 assert(reachable(bp,1,42));assert(reachable(bp,101,42));
});

test('all port entities and three approach tiles remain surface belts; ports unchanged',()=>{
 const bp={entities:line(40)},ports=[{kind:'input',entity:1,x:.5,y:.5,direction:4},{kind:'output',entity:40,position:{x:39.5,y:.5}}],old=structuredClone(ports);
 const r=optimizeUnderground({blueprint:bp},ports);assert(r.saved>0);assert.deepEqual(ports,old);
 for(const id of [1,2,3,4,37,38,39,40])assert.equal(byId(bp,id).name,'fast-transport-belt');
});

test('inserter pickup/drop surroundings and splitter joins are preserved',()=>{
 const bp={entities:line(55)};
 bp.entities.push({entity_number:100,name:'fast-inserter',position:{x:15.5,y:1.5},direction:0});
 bp.entities.push({entity_number:101,name:'fast-splitter',position:{x:30.5,y:2},direction:4});
 // Adjacent splitter exit joins the surface line via a north-facing tile.
 bp.entities.push(belt(102,31,1,0));
 const ids=[13,14,15,16,17,18,19,30,31,32,33,100,101,102],keep=ids.map(id=>structuredClone(byId(bp,id)));
 const r=optimizeUnderground(bp);assert(r.saved>0);for(const e of keep)assert.deepEqual(byId(bp,e.entity_number),e);
});

test('existing legal red tunnel is unchanged and new tunnels are reciprocally paired',()=>{
 const bp={entities:[...line(30),ug(100,0,5,'input'),ug(101,7,5,'output')]},old=structuredClone(bp.entities.slice(-2));
 const r=optimizeUnderground(bp);assert(r.saved>0);for(const e of old)assert.deepEqual(byId(bp,e.entity_number),e);
 const ends=bp.entities.filter(e=>e.name==='fast-underground-belt');
 for(const input of ends.filter(e=>e.type==='input')){
  const candidates=ends.filter(e=>e.type==='output'&&e.direction===input.direction&&e.position.y===input.position.y&&e.position.x>input.position.x&&e.position.x-input.position.x<=7).sort((a,b)=>a.position.x-b.position.x);
  assert(candidates.length);const output=candidates[0];
  const reverse=ends.filter(e=>e.type==='input'&&e.direction===output.direction&&e.position.y===output.position.y&&e.position.x<output.position.x&&output.position.x-e.position.x<=7).sort((a,b)=>b.position.x-a.position.x);
  assert.equal(reverse[0].entity_number,input.entity_number);
 }
});

test('existing orphan remains unpaired, and ambiguous existing undergrounds abort atomically',()=>{
 const orphan=ug(100,0,5,'input'),bp={entities:[...line(30),orphan]};
 const r=optimizeUnderground(bp);assert(!r.aborted);assert(r.saved>0);assert.deepEqual(r.existingUnpairedEndpoints,[100]);assert.deepEqual(byId(bp,100),orphan);
 const bad={entities:[...line(30),ug(100,0,5,'input'),ug(101,2,5,'input'),ug(102,7,5,'output')]},old=structuredClone(bad);
 const rejected=optimizeUnderground(bad);assert(rejected.aborted);assert.equal(rejected.saved,0);assert.deepEqual(bad,old);
});

test('short stretches do not change, other belt tiers are untouched, second pass is idempotent',()=>{
 const short={entities:line(6)},old=structuredClone(short);assert.equal(optimizeUnderground(short).saved,0);assert.deepEqual(short,old);
 const other={entities:line(30).map(e=>({...e,name:'express-transport-belt'}))},oldOther=structuredClone(other);assert.equal(optimizeUnderground(other).saved,0);assert.deepEqual(other,oldOther);
 const bp={entities:line(50)};assert(optimizeUnderground(bp).saved>0);const once=structuredClone(bp);assert.equal(optimizeUnderground(bp).saved,0);assert.deepEqual(bp,once);
});

test('missing target port aborts without removing or changing entities',()=>{
 const bp={entities:line(30)},old=structuredClone(bp);assert(optimizeUnderground(bp,[{entity:999,x:0,y:0}]).aborted);assert.deepEqual(bp,old);
});

test('current RGBY source: preserve every tagged component, wire, target port and original entity ID',async()=>{
 const code=await fs.readFile(new URL('../blueprint-sources/rgby-science/rgby-science-30.txt',import.meta.url),'utf8');
 const bp=decodeBlueprint(code.trim()).blueprint;
 const [manifest]=JSON.parse(await fs.readFile(new URL('../blueprint-sources/rgby-science/manifest.json',import.meta.url),'utf8'));
 const old=structuredClone(bp),protectedEntities=old.entities.filter(e=>Object.hasOwn(e.tags??{},'rgby_component'));
 const r=optimizeUnderground(bp,manifest.ports);assert(!r.aborted,r.aborted);assert.equal(r.saved,0);assert(manifest.underground.saved>0);assert.deepEqual(bp,old);
 const after=new Map(bp.entities.map(e=>[e.entity_number,e]));
 for(const e of protectedEntities)assert.deepEqual(after.get(e.entity_number),e);
 for(const p of manifest.ports)assert.deepEqual(after.get(p.entity),old.entities.find(e=>e.entity_number===p.entity));
 assert.deepEqual(bp.wires,old.wires);const oldIds=new Set(old.entities.map(e=>e.entity_number));assert(bp.entities.every(e=>oldIds.has(e.entity_number)));
 for(const p of r.pairs)for(const id of p.removed)assert.equal(old.entities.find(e=>e.entity_number===id).tags?.rgby_component,undefined);
 console.log(`RGBY in-memory only: ${r.before.entities} -> ${r.after.entities}; ${r.saved} saved, ${r.pairs.length} legal red underground pairs`);
});
