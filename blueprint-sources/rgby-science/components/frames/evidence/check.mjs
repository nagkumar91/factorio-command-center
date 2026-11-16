import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeFrames} from '../../../../../scripts/rgby-science/frames.mjs';
import {decodeBlueprint} from '../../../../../scripts/blueprints.mjs';
const raw=JSON.parse(await fs.readFile('/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json'));
const c=makeFrames(raw),saved=decodeBlueprint((await fs.readFile('blueprint-sources/rgby-science/components/frames/frames-10.txt','utf8')).trim()).blueprint;
assert.deepEqual(c.entities,saved.entities);assert.deepEqual(c.wires,saved.wires);
assert.deepEqual(c.machineCounts,{battery:2,'engine-unit':3,pipe:1,'iron-gear-wheel':1,'flying-robot-frame':5,'electric-engine-unit':3});
const grid=new Map(),ids=new Map(c.entities.map(e=>[e.entity_number,e]));
for(const e of c.entities){
 assert.equal(e.tags.flight_science_entity,e.entity_number);
 assert(!e.items && !e.request_filters);assert(!e.name.includes('logistic')&&!e.name.includes('barrel'));
 let w=['chemical-plant','assembling-machine-2'].includes(e.name)?3:e.name==='big-electric-pole'?2:1;
 let h=e.name==='fast-splitter'?2:w;
 for(let x=e.position.x-w/2;x<e.position.x+w/2;x++)for(let y=e.position.y-h/2;y<e.position.y+h/2;y++){
  const k=`${x},${y}`;assert(!grid.has(k),`Overlap ${e.entity_number} and ${grid.get(k)}`);grid.set(k,e.entity_number);
 }
}
for(const p of c.ports){const e=ids.get(p.entity);assert(e);assert.equal(p.x,e.position.x);assert.equal(p.y,e.position.y);
 if(p.kind==='power')continue;
 const [dx,dy]={west:[-1,0],east:[1,0],north:[0,-1],south:[0,1]}[p.externalSide];
 assert(!grid.has(`${p.x+dx-.5},${p.y+dy-.5}`),`Obstructed external port ${p.items[0]}`);
}
for(const [a,ac,b,bc] of c.wires){assert(ids.has(a)&&ids.has(b));const x=ids.get(a),y=ids.get(b);assert(Math.hypot(x.position.x-y.position.x,x.position.y-y.position.y)<= (ac===5?30:9)+.01,`Wire too long ${a},${b}`);}
assert.equal(new Set(c.loopControl[0].controlled).size,c.loopControl[0].controlled.length);
const code=(await fs.readFile('blueprint-sources/rgby-science/components/frames/frames-10.txt','utf8')).trim();
const report={passed:true,blueprintSha256:createHash('sha256').update(code).digest('hex'),checks:['deterministic API matches saved blueprint','15 requested production machines','no overlapping tiles','numeric identity tags','no installed modules or logistic delivery','all six material ports externally accessible','wire endpoints and reach','unique circuit controllers'],footprint:c.footprint,entityCount:c.entities.length,wireCount:c.wires.length};
await fs.writeFile('blueprint-sources/rgby-science/components/frames/static-report.json',JSON.stringify(report,null,2)+'\n');console.log(report);
