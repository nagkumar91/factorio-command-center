import test from 'node:test';
import assert from 'node:assert/strict';
import {chiSquareSurvival,chiSquareQuantile,poissonRateInterval,stochasticWindowTest,stochasticDependencyAudit} from '../scripts/flight-native-statistics.mjs';

test('gamma survival matches df=2 analytic probability and NIST critical values',()=>{
  for(const x of [.001,.2,2,5.991464547,30,100])assert.ok(Math.abs(chiSquareSurvival(x,2)-Math.exp(-x/2))<1e-12);
  // https://www.itl.nist.gov/div898/handbook/eda/section3/eda3674.htm
  for(const [df,value] of [[1,3.841],[2,5.991],[3,7.815],[4,9.488],[10,18.307],[19,30.144]]){
    assert.ok(Math.abs(chiSquareSurvival(value,df)-.05)<.00003);
    assert.ok(Math.abs(chiSquareQuantile(.95,df)-value)<.00051);
  }
});
test('Garwood Poisson bounds include exact zero-event upper bound and known count limits',()=>{
  const zero=poissonRateInterval(0,1);assert.equal(zero.lowerPerMinute,0);assert.ok(Math.abs(zero.upperPerMinute+Math.log(.025))<1e-12);
  const one=poissonRateInterval(1,1);assert.ok(Math.abs(one.lowerPerMinute+.5*2*Math.log(.975))<1e-12);
  assert.ok(Math.abs(one.upperPerMinute-5.5716433909389)<1e-10);
  const many=poissonRateInterval(1000,120);assert.ok(many.lowerPerMinute<1000/120 && many.upperPerMinute>1000/120);
});
test('native holmium variation is accepted without altering any observed counts',()=>{
  for(const counts of [[35,46,36],[33,43,49],[33,52,43]]){
    const before=[...counts],r=stochasticWindowTest(counts);assert.equal(r.accepted,true);assert.ok(r.pValue>.05);assert.deepEqual(counts,before);
  }
});
test('small samples, empty windows, non-integer counts and gross trends fail',()=>{
  for(const counts of [[1,1,1],[33,33,33],[100,100,0],[10,40,100],[100.1,100,100],[100,100]])assert.equal(stochasticWindowTest(counts).accepted,false,JSON.stringify(counts));
  assert.equal(stochasticWindowTest([34,33,33]).accepted,true);
  assert.equal(stochasticWindowTest([34,33,33],{minimumObservedCount:101}).accepted,false);
});
test('random surplus does not relabel deterministic products; declared downstream randomness has a dependency witness',()=>{
  const raw={recipe:{fruit:{name:'fruit',ingredients:[{name:'fruit'}],results:[{name:'pulp',amount:10},{name:'seed',amount:1,probability:.02}]},
    pulp:{name:'pulp',ingredients:[{name:'pulp'}],results:[{name:'fish',amount:1}]},
    seeds:{name:'seeds',ingredients:[{name:'seed'}],results:[{name:'seedling',amount:1}]}}};
  const spec={stochastic:true,entities:[{recipe:'fruit'},{recipe:'pulp'},{recipe:'seeds'}],outputs:[{type:'item',name:'fish'},{type:'item',name:'seedling'}]};
  const audit=stochasticDependencyAudit(spec,raw);assert.deepEqual(audit.eligibleOutputKeys,['item:seedling']);
  assert.deepEqual(audit.variableMaterials.find(x=>x.material==='item:seedling').dependsOn,['item:seed']);
  assert.deepEqual(stochasticDependencyAudit({...spec,stochastic:false},raw).eligibleOutputKeys,[]);
});
