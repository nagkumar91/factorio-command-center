import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeBlueprint} from '../scripts/blueprints.mjs';
import {canonicalJSON, configurationHash, sha256, specEntries, prepareSpec, evaluateNative} from '../scripts/flight-native-lib.mjs';

const entity=(type,name)=>({type,name,collision_box:[[-.4,-.4],[.4,.4]]});
const raw={planet:{nauvis:{surface_properties:{pressure:1000}}},'surface-property':{},
  item:Object.fromEntries(['iron-ore','iron-plate','logistic-robot'].map(name=>[name,{name,stack_size:100}])),
  resource:{'iron-ore':{name:'iron-ore',autoplace:{},minable:{result:'iron-ore'}}},
  container:{chest:entity('container','chest')},'assembling-machine':{machine:entity('assembling-machine','machine')},
  'electric-pole':{pole:entity('electric-pole','pole')},roboport:{roboport:entity('roboport','roboport')},
  recipe:{plate:{name:'plate',ingredients:[{name:'iron-ore',amount:1}],results:[{name:'iron-plate',amount:1}]}},technology:{}};
function fixture() {
  const entities=[
    {entity_number:1,name:'chest',position:{x:0,y:0},tags:{flight_entity:1,flight_input:'item:iron-ore'}},
    {entity_number:2,name:'machine',recipe:'plate',position:{x:3,y:0},tags:{flight_entity:2}},
    {entity_number:3,name:'chest',position:{x:6,y:0},tags:{flight_entity:3,flight_output:'item:iron-plate'}},
    {entity_number:4,name:'pole',position:{x:0,y:4},tags:{flight_entity:4}}];
  const code=encodeBlueprint({blueprint:{item:'blueprint',entities}});
  const prototypeDumpSha256=sha256(JSON.stringify(raw));
  const entry={id:'raw-plate',blueprintPath:'plate.txt',blueprintSha256:sha256(code),prototypeDumpSha256,enableAllRecipes:true,powerPoleId:4,
    inputs:[{type:'item',name:'iron-ore',entityNumber:1}],outputs:[{type:'item',name:'iron-plate',entityNumber:3,minPerMinute:10}],warmupTicks:3600,measurementTicks:10800};
  return {entry,code,raw,prototypeDumpSha256};
}
function native(spec) {
  return {blueprintSha256:spec.blueprintSha256,prototypeDumpSha256:spec.prototypeDumpSha256,configurationSha256:spec.configurationSha256,specSha256:spec.specSha256,
    completedTick:14400,importedEntities:4,rejections:[],outputs:{'item:iron-plate':{collectionEvents:90,firstOutputTick:60,measuredProduced:30,windowCounts:[10,10,10],windowProduced:[10,10,10]}}};
}
test('canonical fingerprints ignore only object key order',()=>{
  assert.equal(configurationHash({b:2,a:1}),configurationHash({a:1,b:2}));
  assert.notEqual(configurationHash([1,2]),configurationHash([2,1]));
  assert.equal(canonicalJSON({z:[{b:1,a:2}]}),'{"z":[{"a":2,"b":1}]}');
});
test('spec collection rejects duplicates and path-like ids',()=>{
  assert.equal(specEntries({factories:[{id:'a'}]}).length,1);
  assert.throws(()=>specEntries([{id:'a'},{id:'a'}]),/duplicate/);
  assert.throws(()=>specEntries([{id:'..\/oops'}]),/Invalid/);
});
test('valid declared raw boundaries retain exact source and config hashes',()=>{
  const f=fixture(),s=prepareSpec(f.entry,f);assert.deepEqual(s.unsupported,[]);
  assert.equal(s.blueprintSha256,sha256(f.code));
  const next=prepareSpec({...f.entry,warmupTicks:7200},f);
  assert.notEqual(s.configurationSha256,next.configurationSha256);
  assert.equal(s.blueprintSha256,next.blueprintSha256);
});
test('blueprint and prototype mismatches cannot produce evidence',()=>{
  const f=fixture();f.entry.blueprintSha256='0'.repeat(64);f.entry.prototypeDumpSha256='f'.repeat(64);
  assert.deepEqual(prepareSpec(f.entry,f).unsupported,['blueprint-sha256-mismatch','prototype-dump-sha256-mismatch']);
});
test('raw factories reject manufactured inputs and direct machine feed ports',()=>{
  const f=fixture();f.entry.inputs=[{type:'item',name:'iron-plate',entityNumber:2}];
  const reasons=prepareSpec(f.entry,f).unsupported;
  assert.ok(reasons.includes('non-raw-boundary-input:item:iron-plate'));
  assert.ok(reasons.includes('not-a-boundary-chest-or-belt:2'));
});
test('explicit intermediary boundary mode permits manufactured ingredients only at declared ports',()=>{
  const f=fixture();f.entry.inputs[0].name='logistic-robot';f.entry.boundaryMode='intermediary';
  const object={blueprint:{item:'blueprint',entities:prepareSpec(f.entry,f).entities}};
  object.blueprint.entities[0].tags.flight_input='item:logistic-robot';f.code=encodeBlueprint(object);f.entry.blueprintSha256=sha256(f.code);
  assert.deepEqual(prepareSpec(f.entry,f).unsupported,[]);
  f.entry.rawOnly=true;assert.ok(prepareSpec(f.entry,f).unsupported.includes('non-raw-boundary-input:item:logistic-robot'));
});
test('robot infrastructure cannot seed output chests or machine inventories',()=>{
  const f=fixture();f.entry.infrastructureSeeds=[{entityNumber:3,item:'logistic-robot',count:20}];
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('unsupported-infrastructure-seed'));
});
test('saved inserters cannot export seeded infrastructure robots',()=>{
  const f=fixture();f.raw=structuredClone(raw);f.raw.roboport.roboport.selection_box=[[-2,-2],[2,2]];
  f.raw.inserter={arm:{...entity('inserter','arm'),pickup_position:[0,-1]}};
  const entities=prepareSpec(f.entry,f).entities;
  entities.push({entity_number:5,name:'roboport',position:{x:10,y:0},tags:{flight_entity:5}},
    {entity_number:6,name:'arm',position:{x:10,y:2},tags:{flight_entity:6}});
  f.code=encodeBlueprint({blueprint:{item:'blueprint',entities}});f.entry.blueprintSha256=sha256(f.code);
  f.entry.infrastructureSeeds=[{entityNumber:5,item:'logistic-robot',count:20}];
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('infrastructure-robot-extraction-not-supported:6'));
});
test('measured rates are physical delivery divided by measured time',()=>{
  const f=fixture(),s=prepareSpec(f.entry,f),r=evaluateNative(s,native(s));
  assert.equal(r.passed,true);assert.equal(r.outputs['item:iron-plate'].perMinute,10);
});
test('stochastic policy preserves native production, observation and rate-floor gates',()=>{
  const f=fixture();f.raw=structuredClone(raw);f.raw.recipe.plate.results[0].probability=.1;
  f.entry.stochastic=true;f.entry.outputs[0].minPerMinute=30;
  const s=prepareSpec(f.entry,f),n=native(s),row=n.outputs['item:iron-plate'];
  row.windowCounts=[35,46,36];row.windowProduced=[35,46,36];row.measuredProduced=117;
  let r=evaluateNative(s,n);assert.equal(r.passed,true);assert.equal(r.outputs['item:iron-plate'].perMinute,39);
  assert.ok(r.outputs['item:iron-plate'].rateConfidenceInterval.lowerPerMinute<39);
  const raised={...s,outputs:[{...s.outputs[0],minPerMinute:50}]};
  assert.ok(evaluateNative(raised,n).failures.includes('below-declared-rate:item:iron-plate'));
  row.windowProduced=[35,0,36];assert.ok(evaluateNative(s,n).failures.includes('not-steady:item:iron-plate'));
  row.windowProduced=[35,46,36];row.windowCounts=[10,40,100];assert.ok(evaluateNative(s,n).failures.includes('not-steady:item:iron-plate'));
  const deterministic={...s,stochastic:false};assert.equal(evaluateNative(deterministic,n).outputs['item:iron-plate'].stabilityMethod,'relative-spread-with-count-quantization');
});
function wasteFixture(){
  const f=fixture();f.raw=structuredClone(raw);f.raw.item['iron-ore'].spoil_result='spoilage';f.raw.item.spoilage={name:'spoilage',stack_size:100};
  f.raw.container['steel-chest']=entity('container','steel-chest');
  f.raw.inserter={arm:{...entity('inserter','arm'),pickup_position:[0,-1],insert_position:[0,1]}};
  const entities=prepareSpec(f.entry,f).entities;
  entities.push({entity_number:5,name:'arm',position:{x:0,y:1},use_filters:true,filter_mode:'whitelist',filters:[{index:1,name:'spoilage'}],tags:{flight_entity:5}},
    {entity_number:6,name:'steel-chest',position:{x:0,y:2},tags:{flight_entity:6,flight_waste:'item:spoilage',flight_waste_source:1}});
  f.code=encodeBlueprint({blueprint:{item:'blueprint',entities}});f.entry.blueprintSha256=sha256(f.code);
  f.entry.wasteOutputs=[{type:'item',name:'spoilage',entityNumber:6,position:{x:0,y:2},sourceEntityNumber:1,inserterEntityNumber:5,spoiledFrom:['iron-ore']}];
  return f;
}
test('spoilage disposal needs a separate exact chest/inserter route and real spoil-result',()=>{
  const f=wasteFixture(),s=prepareSpec(f.entry,f);assert.deepEqual(s.unsupported,[]);assert.equal(s.outputs.length,1);assert.equal(s.wasteOutputs.length,1);
  f.entry.wasteOutputs[0].spoiledFrom=['iron-plate'];assert.ok(prepareSpec(f.entry,f).unsupported.includes('waste-not-a-prototype-spoil-result:6'));
  f.entry.wasteOutputs[0].spoiledFrom=['iron-ore'];f.entry.wasteOutputs[0].sourceEntityNumber=2;
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('waste-source-must-be-chest:2'));
});
test('unfiltered or misrouted waste extraction cannot become a hidden sink',()=>{
  const f=wasteFixture(),s=prepareSpec(f.entry,f);s.entities.find(e=>e.entity_number===5).use_filters=false;
  f.code=encodeBlueprint({blueprint:{item:'blueprint',entities:s.entities}});f.entry.blueprintSha256=sha256(f.code);
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('waste-requires-exclusive-filtered-inserter:5'));
  s.entities.find(e=>e.entity_number===5).use_filters=true;s.entities.find(e=>e.entity_number===5).direction=4;
  f.code=encodeBlueprint({blueprint:{item:'blueprint',entities:s.entities}});f.entry.blueprintSha256=sha256(f.code);
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('waste-inserter-route-mismatch:5'));
});
test('first-run output or infrastructure stock cannot masquerade as steady production',()=>{
  const f=fixture(),s=prepareSpec(f.entry,f),n=native(s);
  n.outputs['item:iron-plate'].windowProduced=[0,0,0];n.outputs['item:iron-plate'].measuredProduced=0;
  const r=evaluateNative(s,n);assert.equal(r.passed,false);assert.equal(r.functionalPassed,false);
  assert.ok(r.failures.includes('not-steady:item:iron-plate'));
});
test('a burst followed by a stall fails despite an adequate average',()=>{
  const f=fixture(),s=prepareSpec(f.entry,f),n=native(s);n.outputs['item:iron-plate'].windowCounts=[30,0,0];
  assert.equal(evaluateNative(s,n).passed,false);
});
test('stale or truncated native reports fail closed',()=>{
  const f=fixture(),s=prepareSpec(f.entry,f),n=native(s);n.configurationSha256='stale';n.completedTick=60;
  const r=evaluateNative(s,n);assert.equal(r.passed,false);assert.ok(r.failures.includes('incomplete-simulation'));
});
test('three equal measurement windows are mandatory',()=>{
  const f=fixture();assert.ok(prepareSpec({...f.entry,windows:1},f).unsupported.length>0);
  assert.ok(prepareSpec({...f.entry,measurementTicks:10001},f).unsupported.length>0);
});
test('stochastic output with too few observations is not steady evidence',()=>{
  const f=fixture();f.entry.stochastic=true;const s=prepareSpec(f.entry,f),r=evaluateNative(s,native(s));
  assert.equal(r.passed,false);assert.equal(r.functionalPassed,true);
  assert.ok(r.failures.includes('insufficient-observations:item:iron-plate'));
});
test('startup stock is never silently injected or replenished',()=>{
  const f=fixture();f.entry.startupStock=[{type:'item',name:'iron-plate',count:1}];
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('startup-stock-needs-explicit-boundary-seeds'));
  f.entry.materialSeeds=[{type:'item',name:'iron-plate',entityNumber:3,count:1}];
  const reasons=prepareSpec(f.entry,f).unsupported;
  assert.ok(reasons.includes('startup-seeds-need-explicit-raw-plus-startup-mode'));
  assert.ok(reasons.includes('startup-seed-needs-dedicated-declared-boundary-chest'));
});
test('empty Lua rejection tables are accepted but nonempty ones fail',()=>{
  const f=fixture(),s=prepareSpec(f.entry,f),n=native(s);n.rejections={};
  assert.equal(evaluateNative(s,n).passed,true);n.rejections={1:'disconnected-electric-entity:4'};
  assert.equal(evaluateNative(s,n).passed,false);
  assert.equal(evaluateNative(s,n).functionalPassed,false);
});
test('statistics-excluded products require matching native producer crafts, never inferred rates',()=>{
  const f=fixture();f.raw=structuredClone(raw);f.raw.recipe.plate.results[0].ignored_by_stats=1;
  const s=prepareSpec(f.entry,f),n=native(s),row=n.outputs['item:iron-plate'];row.productionStatisticsIgnored=true;
  row.windowProduced=[0,0,0];row.measuredProduced=0;row.producerEntityIds=[2];row.windowProducerCrafts=[10,10,10];row.measuredProducerCrafts=30;
  const r=evaluateNative(s,n);assert.equal(r.passed,true);assert.equal(r.outputs['item:iron-plate'].perMinute,10);
  row.producerEntityIds=[1];assert.equal(evaluateNative(s,n).passed,false);
});
test('normal-statistics products cannot use attempted crafts to cover zero native production',()=>{
  const f=fixture(),s=prepareSpec(f.entry,f),n=native(s),row=n.outputs['item:iron-plate'];
  row.windowProduced=[0,0,0];row.measuredProduced=0;row.producerEntityIds=[2];row.windowProducerCrafts=[10,10,10];row.measuredProducerCrafts=30;
  assert.equal(evaluateNative(s,n).functionalPassed,false);assert.equal(evaluateNative(s,n).passed,false);
  row.productionStatisticsIgnored=true;assert.equal(evaluateNative(s,n).passed,false,'Native flag alone cannot override actual prototype statistics');
});
test('a random product excluded from native statistics cannot infer successful yields from craft attempts',()=>{
  const f=fixture();f.raw=structuredClone(raw);f.raw.recipe.plate.results[0]={name:'iron-plate',amount:1,probability:.1,ignored_by_stats:1};
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('unsupported-random-product-excluded-from-native-statistics:item:iron-plate'));
});
test('finite map resources require exact map-report hash, prototype match and at least the declared amount',()=>{
  const f=fixture();f.raw=structuredClone(raw);delete f.raw.resource['iron-ore'].autoplace;
  const evidencePath='flight-map/native-report.json',evidenceSha256='a'.repeat(64);
  f.entry.inputs[0].sources=[{kind:'seeded-resource-extraction',entity:'iron-ore',amount:123,renewable:false,evidencePath,evidenceSha256}];
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('invalid-seeded-resource-evidence:item:iron-ore'));
  f.sourceEvidence={[evidencePath]:{sha256:evidenceSha256,report:{prototypeSha256:f.prototypeDumpSha256,reloadValidation:{passed:true},resources:{'iron-ore':123}}}};
  assert.deepEqual(prepareSpec(f.entry,f).unsupported,[]);
  f.sourceEvidence[evidencePath].report.resources['iron-ore']=124;
  assert.deepEqual(prepareSpec(f.entry,f).unsupported,[]);
  f.sourceEvidence[evidencePath].report.resources['iron-ore']=122;
  assert.ok(prepareSpec(f.entry,f).unsupported.includes('invalid-seeded-resource-evidence:item:iron-ore'));
});
