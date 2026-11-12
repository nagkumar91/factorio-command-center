import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeBlueprint, PINNED_MAX_DISTANCE } from './optimizer.mjs';

function line({length=13,direction=4,x=0.5,y=0.5,name='fast-transport-belt',tags=true}={}) {
  const [dx,dy]=new Map([[0,[0,-1]],[4,[1,0]],[8,[0,1]],[12,[-1,0]]]).get(direction);
  return Array.from({length},(_,i)=>({entity_number:i+1,name,position:{x:x+dx*i,y:y+dy*i},direction,...(tags?{tags:{flight_science_entity:i+1,keep:{a:1}}}:{})}));
}
const wrap = entities => ({blueprint:{item:'blueprint',label:'fixture',version:123,entities,wires:[],icons:[{index:1,signal:{type:'item',name:'iron-plate'}}],custom_metadata:{preserve:['x',2]}}});

test('uses pinned reach 7, preserves endpoint IDs, removes only interior IDs and maintains metadata',()=>{
  assert.equal(PINNED_MAX_DISTANCE,7);
  const input=wrap(line({length:8}));const before=structuredClone(input.blueprint.entities);
  const result=optimizeBlueprint(input);
  assert.equal(result.changePairs.length,1);
  const p=result.changePairs[0];
  assert.equal(p.endpointDistance,7);
  assert.deepEqual(p.inputPosition,{x:0.5,y:0.5});
  assert.deepEqual(p.outputPosition,{x:7.5,y:0.5});
  assert.deepEqual(p.removedInteriorEntityNumbers,[2,3,4,5,6,7]);
  assert.equal(result.blueprint.entities.length,2);
  assert.equal(result.metrics.placedEntitySavings,6);
  assert.equal(result.blueprint.entities.find(e=>e.entity_number===1).type,'input');
  assert.equal(result.blueprint.entities.find(e=>e.entity_number===8).type,'output');
  assert.deepEqual(result.blueprint.entities.find(e=>e.entity_number===1).tags,before[0].tags);
  assert.deepEqual(result.wrapper.blueprint.icons,input.blueprint.icons);
  assert.deepEqual(result.wrapper.blueprint.custom_metadata,input.blueprint.custom_metadata);
  assert.equal(input.blueprint.entities.length,8,'input must not be mutated');
});

test('only fast belts are converted and short spans are left alone by the default minSpan',()=>{
  assert.equal(optimizeBlueprint(wrap(line({name:'express-transport-belt'}))).metrics.placedEntitySavings,0);
  assert.equal(optimizeBlueprint(wrap(line({length:5}))).metrics.placedEntitySavings,0);
});

test('protects standard inserter pickup and drop tiles using default direction zero',()=>{
  const entities=line({length:13});
  entities.push({entity_number:100,name:'inserter',position:{x:3.5,y:1.5}});
  const result=optimizeBlueprint(wrap(entities));
  assert.equal(result.changePairs.some(p=>p.inputEntityNumber===4||p.outputEntityNumber===4),false);
  assert.equal(result.blueprint.entities.some(e=>e.entity_number===4),true);
});

test('protects long-handed inserter contact tiles',()=>{
  const entities=line({length:13});
  entities.push({entity_number:100,name:'long-handed-inserter',position:{x:3.5,y:2.5},direction:0});
  const result=optimizeBlueprint(wrap(entities));
  assert.equal(result.blueprint.entities.some(e=>e.entity_number===4),true);
});

test('honors custom inserter pickup and drop position overrides',()=>{
  const entities=line({length:13});
  entities.push({entity_number:100,name:'modded-inserter',position:{x:3.5,y:3.5},direction:0,pickup_position:[0,-3],drop_position:[0,3]});
  const result=optimizeBlueprint(wrap(entities));
  assert.equal(result.metrics.aborted,undefined);
  assert.equal(result.blueprint.entities.some(e=>e.entity_number===4),true);
});

test('unknown custom inserter geometry aborts safely without changing the blueprint',()=>{
  const input=wrap([...line(),{entity_number:100,name:'modded-inserter',position:{x:3.5,y:1.5},direction:0}]);
  const result=optimizeBlueprint(input);
  assert.equal(result.metrics.aborted,'unknown-inserter-geometry');
  assert.deepEqual(result.wrapper,input);
  assert.equal(result.metrics.placedEntitySavings,0);
});

test('a branch/contact protects its junction tile while safe subsegments still convert',()=>{
  const entities=line();
  entities.push({entity_number:100,name:'express-transport-belt',position:{x:6.5,y:1.5},direction:0});
  const result=optimizeBlueprint(wrap(entities));
  assert.equal(result.blueprint.entities.some(e=>e.entity_number===7),true);
  assert.ok(result.metrics.placedEntitySavings>0);
});

test('all surface-belt tiers participate in branch and circuit topology',()=>{
  const entities=line();
  entities.push({entity_number:100,name:'express-transport-belt',position:{x:6.5,y:1.5},direction:0});
  const branch=optimizeBlueprint(wrap(entities));
  assert.equal(branch.blueprint.entities.some(e=>e.entity_number===7),true);
});

test('a parallel neighboring belt does not invalidate the straight corridor',()=>{
  const entities=line();
  entities.push({entity_number:100,name:'fast-transport-belt',position:{x:4.5,y:1.5},direction:4});
  const result=optimizeBlueprint(wrap(entities));
  assert.ok(result.metrics.placedEntitySavings>0);
});

test('splitter half-tile footprint protects intersecting belt cells',()=>{
  const entities=line();
  entities.push({entity_number:100,name:'fast-splitter',position:{x:6.5,y:1},direction:4});
  const result=optimizeBlueprint(wrap(entities));
  assert.equal(result.blueprint.entities.some(e=>e.entity_number===7),true);
});

test('circuit-reader component traverses its connected physical belt network',()=>{
  const entities=line();
  entities[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
  const result=optimizeBlueprint(wrap(entities));
  assert.equal(result.metrics.placedEntitySavings,0);
  assert.equal(result.blueprint.entities.length,13);
});

test('direct wire endpoints are protected even when the wire is not a reader',()=>{
  const input=wrap(line());input.blueprint.wires=[[3,1,99,1]];
  const result=optimizeBlueprint(input);
  assert.equal(result.blueprint.entities.some(e=>e.entity_number===3),true);
  assert.equal(result.changePairs.some(p=>p.removedInteriorEntityNumbers.includes(3)),false);
});

test('preserves the existing underground pair graph and avoids its interference zone',()=>{
  const entities=line();
  const oldInput={entity_number:100,name:'fast-underground-belt',position:{x:15.5,y:0.5},direction:4,type:'input',tags:{keep:'input'}};
  const oldOutput={entity_number:101,name:'fast-underground-belt',position:{x:21.5,y:0.5},direction:4,type:'output',tags:{keep:'output'}};
  entities.push(oldInput,oldOutput);
  const result=optimizeBlueprint(wrap(entities));
  assert.equal(result.preservedExistingPairs.length,1);
  assert.deepEqual(result.preservedExistingPairs[0],{inputEntityNumber:100,outputEntityNumber:101,endpointDistance:6});
  assert.deepEqual(result.blueprint.entities.find(e=>e.entity_number===100),oldInput);
  assert.deepEqual(result.blueprint.entities.find(e=>e.entity_number===101),oldOutput);
  assert.equal(result.changePairs.some(p=>p.inputEntityNumber>=100||p.outputEntityNumber>=100),false);
  assert.ok(result.changePairs.every(p=>p.endpointDistance<=7));
});

test('interval DP finds two disjoint useful spans in a 12-tile run',()=>{
  const result=optimizeBlueprint(wrap(line({length:12})));
  assert.equal(result.changePairs.length,2);
  assert.deepEqual(result.changePairs.map(p=>p.endpointDistance),[5,5]);
  assert.equal(result.metrics.surfaceBeltsRemoved,8);
  assert.equal(result.metrics.placedEntitySavings,8);
});

test('interval DP maximizes removals over a 13-tile run',()=>{
  const result=optimizeBlueprint(wrap(line({length:13})));
  assert.equal(result.changePairs.length,2);
  assert.deepEqual(result.changePairs.map(p=>p.endpointDistance),[6,5]);
  assert.equal(result.metrics.surfaceBeltsRemoved,9);
});

test('native exact reader component avoids approximate parallel-network overprotection',()=>{
  const primary=line();
  primary[0].control_behavior={circuit_read_hand_contents:true};
  const parallel=line({length:13,y:1.5}).map(e=>({...e,entity_number:e.entity_number+100}));
  const input=wrap([...primary,...parallel]);
  const component=primary.map(e=>e.entity_number);
  const result=optimizeBlueprint(input,{nativeReadAllBeltComponentEntityNumbers:component,nativeReadAllBeltComponentBaselineSha256:'a'.repeat(64)});
  assert.equal(result.metrics.readAllProtectionMode,'native-exact');
  assert.equal(result.changePairs.length,2);
  assert.ok(result.changePairs.every(p=>p.inputEntityNumber>100));
  assert.ok(result.metrics.placedEntitySavings>0);
});

test('native exact component refuses to run when a reader seed is missing',()=>{
  const entities=line();entities[0].control_behavior={circuit_read_hand_contents:true};
  const input=wrap(entities);
  const result=optimizeBlueprint(input,{nativeReadAllBeltComponentEntityNumbers:[2],nativeReadAllBeltComponentBaselineSha256:'a'.repeat(64)});
  assert.equal(result.metrics.aborted,'invalid-native-read-all-component');
  assert.deepEqual(result.wrapper,input);
});

test('supports all four cardinal Factorio belt directions',()=>{
  for(const direction of [0,4,8,12]) {
    const result=optimizeBlueprint(wrap(line({length:8,direction})));
    assert.equal(result.changePairs[0].direction,direction);
    assert.equal(result.changePairs[0].endpointDistance,7);
  }
});
