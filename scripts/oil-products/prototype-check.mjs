// Compares the prototype facts embedded in shared.mjs with the official 2.1.24 data-raw dump (bytes passed in).
// Used by generate.mjs (when the dump is readable) and by tests/oil-products.test.mjs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PROTOTYPE,SIZE} from './shared.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function verifyPrototype(bytes){
 assert.equal(sha(bytes),PROTOTYPE.sha256,'prototype dump SHA-256');
 const raw=JSON.parse(bytes);
 for(const [m,v] of Object.entries(PROTOTYPE.craftingSpeed))assert.equal(raw['assembling-machine'][m].crafting_speed,v,m);
 for(const [name,r] of Object.entries(PROTOTYPE.recipes)){const d=raw.recipe[name];assert.equal(d.energy_required??0.5,r.seconds,name);
  assert.deepEqual(Object.fromEntries(d.ingredients.map(i=>[i.name,i.amount])),r.in,name);assert.deepEqual(Object.fromEntries(d.results.map(i=>[i.name,i.amount])),r.out,name);}
 assert.equal(raw['storage-tank']['storage-tank'].fluid_box.volume,PROTOTYPE.storageTankVolume);
 assert.equal(raw.pump.pump.pumping_speed,PROTOTYPE.pumpPerTick);
 assert.equal(raw['pipe-to-ground']['pipe-to-ground'].fluid_box.pipe_connections.find(c=>c.connection_type==='underground').max_underground_distance,PROTOTYPE.pipeToGroundMaxDistance);
 assert.equal(raw['underground-belt']['fast-underground-belt'].max_distance,PROTOTYPE.fastUndergroundBeltMaxDistance);
 assert.equal(raw.pump.pump.circuit_wire_max_distance,PROTOTYPE.circuitWireReach.pump);assert.equal(raw['storage-tank']['storage-tank'].circuit_wire_max_distance,PROTOTYPE.circuitWireReach['storage-tank']);
 assert.equal(raw['electric-pole'].substation.maximum_wire_distance,PROTOTYPE.substation.wireReach);assert.equal(raw['electric-pole'].substation.supply_area_distance,PROTOTYPE.substation.supplyAreaDistance);
 for(const [n,kw] of Object.entries(PROTOTYPE.energyUsageKW)){const p=Object.values(raw).map(g=>g?.[n]).find(p=>p?.energy_usage);assert.equal(parseFloat(p.energy_usage),kw,n);}
 for(const [n,[w,h]] of Object.entries(SIZE)){if(n==='display-panel')continue;const p=Object.values(raw).map(g=>g?.[n]).find(p=>p?.selection_box);
  assert.deepEqual([Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),Math.ceil(p.selection_box[1][1]-p.selection_box[0][1])],[w,h],n);}
}
