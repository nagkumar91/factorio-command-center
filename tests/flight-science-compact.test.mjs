import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const dir=new URL('../blueprint-sources/flight-science/',import.meta.url);
test('compact science saves at least 70% of area with verified independent stock-control networks',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir))),old=JSON.parse(fs.readFileSync(new URL('history/v1-bus/manifest.json',dir))),report=JSON.parse(fs.readFileSync(new URL('native-report.json',dir)));
 for(const m of manifest){
  const prev=old.find(p=>p.id===m.id),native=report.builds.find(p=>p.id===m.id);assert.ok(m.footprint.width*m.footprint.height<prev.footprint.width*prev.footprint.height*.3);
  assert.equal(m.loopControl.length,m.products.length===3?3:4);
  const b=decodeBlueprint(fs.readFileSync(new URL(m.file,dir),'utf8').trim()).blueprint;
  const ids=new Map(b.entities.map(e=>[e.entity_number,e]));
  for(const p of m.ports.filter(p=>p.kind==='input'))assert.equal(ids.get(p.displayEntity)?.icon.name,p.items[0]);
  const adjacency=new Map();for(const [a,ac,z,zc]of b.wires.filter(w=>w[1]===1&&w[3]===1)){assert.ok(ids.has(a)&&ids.has(z));(adjacency.get(a)||adjacency.set(a,new Set()).get(a)).add(z);(adjacency.get(z)||adjacency.set(z,new Set()).get(z)).add(a);}
  const nets=[];
  for(const loop of m.loopControl){
   const seen=new Set([loop.reader]),q=[loop.reader];for(let i=0;i<q.length;i++)for(const n of adjacency.get(q[i])||[])if(!seen.has(n)){seen.add(n);q.push(n);}
   assert.ok(loop.controlled.every(id=>seen.has(id)));assert.ok(loop.loop.every(id=>seen.has(id)));assert.ok(nets.every(net=>![...seen].some(id=>net.has(id))));nets.push(seen);
   assert.equal(ids.get(loop.reader).control_behavior.circuit_contents_read_mode,2);
   assert.ok(native.loopSamples[loop.name].maxStock<loop.capacity*.9);
  }
  assert.equal(native.recovery.blockedMinutes,5);for(const rate of Object.values(native.recovery.outputsPerMinute))assert.ok(rate>=59.5);
 }
});
