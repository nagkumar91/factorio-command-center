import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {applySavedCorridorOptimization,blueprintStructureHash} from '../scripts/saved-corridor-optimizations.mjs';
const optimizations=JSON.parse(fs.readFileSync('blueprint-sources/early-game/corridor-optimizations.json')).optimizations;
const atlas=JSON.parse(fs.readFileSync('site/data/atlas.json'));
test('accepted corridor edits replay on the archived original and reject altered machinery',()=>{
 for(const optimization of optimizations){
  const current=atlas.blueprints.find(b=>b.id===optimization.id);
  const versions=[current,...current.publication.history.map(h=>JSON.parse(fs.readFileSync('site/'+h.url)))];
  const baseline=versions.map(v=>decodeBlueprint(v.code).blueprint).find(b=>blueprintStructureHash(b)===optimization.baselineStructureSha256);
  assert.ok(baseline,'Pinned original remains available: '+optimization.id);
  const expected=decodeBlueprint(fs.readFileSync('blueprint-sources/early-game/'+optimization.id+'.txt','utf8')).blueprint;
  assert.deepEqual(applySavedCorridorOptimization(baseline,optimization),expected);
  const changed=structuredClone(baseline);changed.entities.find(e=>e.name==='steel-furnace').position.x+=1;
  assert.throws(()=>applySavedCorridorOptimization(changed,optimization),/Corridor baseline changed/);
 }
});
