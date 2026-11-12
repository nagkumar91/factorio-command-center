import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const source=new URL('../blueprint-sources/flight-science-sided/compact/',import.meta.url);
const bytes=fs.readFileSync(new URL('manifest.json',source));
const [manifest]=JSON.parse(bytes);
const code=fs.readFileSync(new URL(manifest.file,source),'utf8').trim();
const blueprint=decodeBlueprint(code).blueprint;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack','production-science-pack','utility-science-pack'];
const tiles=new Map();
for(const entity of blueprint.entities){
 const size=entity.name==='assembling-machine-2'?3:entity.name==='big-electric-pole'?2:1;
 for(let x=entity.position.x-size/2;x<entity.position.x+size/2;x++)for(let y=entity.position.y-size/2;y<entity.position.y+size/2;y++){
  const key=`${x},${y}`;assert(!tiles.has(key),`Overlap: ${entity.name} at ${key}`);tiles.set(key,entity);
 }
}

test('compact tier contains the exact six-pack blueprint, within the declared footprint',()=>{
 assert.equal(sha(code),manifest.blueprintSha256);
 assert.deepEqual(manifest.products,expected);
 assert.equal(blueprint.entities.length,new Set(blueprint.entities.map(e=>e.entity_number)).size);
 assert(blueprint.entities.every(e=>e.tags.flight_science_entity===e.entity_number));
 const xs=[...tiles.keys()].map(k=>Number(k.split(',')[0])),ys=[...tiles.keys()].map(k=>Number(k.split(',')[1]));
 assert.equal(Math.max(...xs)-Math.min(...xs)+1,manifest.footprint.width);
 assert.equal(Math.max(...ys)-Math.min(...ys)+1,manifest.footprint.height);
 assert(manifest.footprint.width*manifest.footprint.height<6000);
});

test('every material enters from the left and every collection chest is on the right with open approaches',()=>{
 const machines=blueprint.entities.filter(e=>e.recipe);
 assert.equal(new Set(manifest.inputs.map(p=>p.position.x)).size,1);
 assert.equal(new Set(manifest.outputs.map(p=>p.position.x)).size,1);
 for(const p of manifest.inputs){
  assert(p.position.x<Math.min(...machines.map(e=>e.position.x)));
  assert(!tiles.has(`${p.position.x-1.5},${p.position.y-.5}`),`Blocked west approach for ${p.item}`);
 }
 for(const p of manifest.outputs){
  assert(p.position.x>Math.max(...machines.map(e=>e.position.x)));
  assert(!tiles.has(`${p.position.x+.5},${p.position.y-.5}`),`Blocked east approach for ${p.item}`);
 }
 assert.deepEqual(manifest.outputs.map(p=>p.item),expected);
 assert(manifest.ports.filter(p=>p.kind!=='power').every(p=>blueprint.entities.some(e=>e.entity_number===p.displayEntity&&e.name==='display-panel')));
});

test('finished-material boundary includes all five heavy ingredients and the exact 60/min recipe demand',()=>{
 const totals={};for(const p of manifest.inputs)totals[p.item]=(totals[p.item]||0)+p.perMinute;
 assert.deepEqual(totals,{
  coal:300,'copper-plate':90,'steel-plate':315,sulfur:30,'stone-wall':60,
  'electronic-circuit':60,'advanced-circuit':90,'engine-unit':60,'iron-plate':810,
  'electric-furnace':20,'productivity-module':20,'low-density-structure':60,
  'processing-unit':40,'flying-robot-frame':20,stone:300,
 });
 for(const [item,count]of Object.entries(manifest.inputs.reduce((a,p)=>(a[p.item]=(a[p.item]||0)+1,a),{})))assert.equal(count,['iron-plate','steel-plate'].includes(item)?2:1);
 for(const name of ['rail','iron-stick','iron-gear-wheel','firearm-magazine','piercing-rounds-magazine','grenade','transport-belt','inserter'])assert(manifest.machineCounts[name]>0);
});

test('all equipment is normal AM2, fast inserters, red belts and no installed modules or bots',()=>{
 assert(blueprint.entities.filter(e=>e.recipe).every(e=>e.name==='assembling-machine-2'));
 assert(blueprint.entities.filter(e=>e.name.includes('inserter')).every(e=>e.name==='fast-inserter'));
 assert(blueprint.entities.filter(e=>e.name.includes('belt')).every(e=>e.name.startsWith('fast-')));
 assert(blueprint.entities.every(e=>!e.items&&(!e.quality||e.quality==='normal')&&!/roboport|logistic-chest|beacon/.test(e.name)));
 assert.equal(manifest.loopControl.length,3);
});

test('native proof matches the exact manifest, blueprint, runner and harness and includes sustained six-pack output and recovery',()=>{
 const report=JSON.parse(fs.readFileSync(new URL('native-report.json',source)));
 assert.equal(report.gameVersion,'2.1.24');assert.equal(report.short,false);
 assert.equal(report.warmupMinutes,15);assert.equal(report.measurementMinutes,30);
 assert.equal(report.manifestSha256,sha(bytes));
 assert.equal(report.prototypeSha256,manifest.prototypeSha256);
 assert.equal(report.harnessSha256,sha(fs.readFileSync(new URL('flight-science-sided-compact-control.lua',import.meta.url))));
 assert.equal(report.runnerSha256,sha(fs.readFileSync(new URL('flight-science-sided-compact-native.mjs',import.meta.url))));
 assert.match(report.configurationSha256,/^[a-f0-9]{64}$/);
 const native=report.builds.find(b=>b.id===manifest.id);
 assert.equal(native.blueprintSha256,manifest.blueprintSha256);
 assert(report.passed&&native.passed&&native.powered);
 assert.equal(native.importedEntities,blueprint.entities.length);
 assert(expected.every(item=>native.outputsPerMinute[item]>=60),JSON.stringify(native.outputsPerMinute));
 assert.equal(native.machines.length,Object.values(manifest.machineCounts).reduce((a,b)=>a+b,0));
 assert(native.machines.every(m=>m.measuredCrafts>0));
 assert.equal(native.inputs.length,manifest.inputs.length);
 assert(native.inputs.every(p=>p.productiveRoute?.length&&p.acceptedDuringMeasurement>0));
 assert(native.outputPorts.every(p=>p.collectedDuringMeasurement>0));
 assert(native.recovery&&expected.every(item=>native.recovery.outputsPerMinute[item]>=59.5));
});
