// Native regression: remove material transport from the generated robot factory.
// Seeded infrastructure robots must NEVER make an idle robot factory pass.
// Run manually after generation: node tests/flight-native-negative.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {decodeBlueprint, encodeBlueprint} from '../scripts/blueprints.mjs';
import {sha256, specEntries} from '../scripts/flight-native-lib.mjs';
const run=promisify(execFile),root=path.resolve('.cache/flight-native/negative-fixture');
// Whole delivery batches can span minute boundaries. Retain the production
// gate and allow the positive control enough time for three stable windows.
const warmupTicks=18000,measurementTicks=54000;
const document=JSON.parse(await fs.readFile('blueprint-sources/flight-factories/native-test-specs.json','utf8'));
const source=specEntries(document).find(e=>e.id==='item-logistic-robot-intermediary');
assert.ok(source,'Generate item-logistic-robot-intermediary before this native regression');
const object=decodeBlueprint(await fs.readFile(source.blueprintPath,'utf8'));
const raw=JSON.parse(await fs.readFile('.cache/flight-game/script-output/data-raw-dump.json','utf8'));
object.blueprint.entities=object.blueprint.entities.filter(e=>!raw.inserter?.[e.name]);
const code=encodeBlueprint(object);
await fs.mkdir(root,{recursive:true});
const blueprintPath=path.join(root,'broken-robot.txt');
await fs.writeFile(blueprintPath,code+'\n');
const spec={...source,id:'flight-native-negative-seeded-robots',blueprintPath,blueprintSha256:sha256(code),
  expectedEntityCount:object.blueprint.entities.length,warmupTicks,measurementTicks,wasteOutputs:[]};
const rawSource=specEntries(document).find(e=>e.id==='item-logistic-robot-raw');
assert.ok(rawSource,'Generate raw robot factory before this native regression');
const seedObject=decodeBlueprint(await fs.readFile(rawSource.blueprintPath,'utf8'));
seedObject.blueprint.entities=seedObject.blueprint.entities.filter(e=>!raw.inserter?.[e.name]);
const entities=seedObject.blueprint.entities,robotPort=entities.find(e=>e.name==='roboport');
const prototypes=new Map(Object.values(raw).flatMap(group=>Object.values(group)).filter(p=>p.collision_box).map(p=>[p.name,p]));
let position;
for(let x=2.5;x<15 && !position;x++)for(let y=7.5;y<15 && !position;y++){
  if(Math.abs(x-robotPort.position.x)>24 || Math.abs(y-robotPort.position.y)>24)continue;
  const intersects=entities.some(e=>{const box=prototypes.get(e.name)?.collision_box;return box && x+.4>e.position.x+box[0][0] && x-.4<e.position.x+box[1][0] && y+.4>e.position.y+box[0][1] && y-.4<e.position.y+box[1][1];});
  if(!intersects)position={x,y};
}
assert.ok(position,'Need a free declared boundary startup chest position');
const entityNumber=Math.max(...entities.map(e=>e.entity_number))+1;
entities.push({entity_number:entityNumber,name:'passive-provider-chest',position,tags:{flight_entity:entityNumber,flight_startup:'item:logistic-robot'}});
const seedCode=encodeBlueprint(seedObject),seedPath=path.join(root,'broken-startup-robot.txt');await fs.writeFile(seedPath,seedCode+'\n');
const seedSpec={...rawSource,id:'flight-native-negative-startup-output',blueprintPath:seedPath,blueprintSha256:sha256(seedCode),
  expectedEntityCount:entities.length,warmupTicks,measurementTicks,wasteOutputs:[],boundaryMode:'raw+startup',rawOnly:false,
  materialSeeds:[{entityNumber,type:'item',name:'logistic-robot',count:20}]};
const positive={...source,id:'flight-native-positive-robot',warmupTicks,measurementTicks};
const companion={...positive,id:'flight-native-positive-batch-companion'};
const specs=path.join(root,'specs.json');await fs.writeFile(specs,JSON.stringify({factories:[positive,spec,seedSpec,companion]}));
let output='',exitCode;
try {const result=await run(process.execPath,['scripts/flight-native-run.mjs','--specs',specs],{timeout:600000,maxBuffer:8*1024*1024});output=result.stdout;exitCode=0;}
catch(error){output=error.stdout||'';exitCode=error.code;}
console.log(output.trim());
assert.equal(exitCode,1,'An idle robot factory must not pass');
const file=/Native report: (.+)/.exec(output)?.[1];assert.ok(file,'Native negative regression must produce an actual report');
const report=JSON.parse(await fs.readFile(file,'utf8')),result=report.builds.find(b=>b.id===spec.id);
assert.equal(report.builds.find(b=>b.id===positive.id)?.passed,true,'Positive control must work with current mods');
assert.equal(report.builds.find(b=>b.id===companion.id)?.passed,true,'Positive batch companion must remain independent');
assert.equal(result.status,'failed','The test must reach measurement, not fail import or preflight');
assert.equal(result.native.completedTick,warmupTicks+measurementTicks);
assert.ok(result.native.infrastructureSeeds.reduce((n,s)=>n+s.count,0)>0);
assert.equal(result.outputs['item:logistic-robot'].collected,0);
assert.equal(result.outputs['item:logistic-robot'].measuredProduced,0);
assert.equal(result.functionalPassed,false);assert.equal(result.throughputPassed,false);
const seeded=report.builds.find(b=>b.id===seedSpec.id);
assert.equal(seeded.status,'failed');
assert.equal(seeded.outputs['item:logistic-robot'].startupExcluded,20,'All delivered startup robots must be excluded from measured output');
assert.equal(seeded.outputs['item:logistic-robot'].collected,0);
assert.equal(seeded.outputs['item:logistic-robot'].measuredProduced,0);
assert.equal(seeded.native.materialSeeds[0].replenished,false);
console.log('Native negative regression passed: infrastructure robots did not count as production.');
console.log('Native startup debit and independent batch controls passed.');
