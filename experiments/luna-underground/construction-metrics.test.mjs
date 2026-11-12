import test from 'node:test';
import assert from 'node:assert/strict';
import {constructionMetrics} from './construction-metrics.mjs';
const recipe=(name,amount,ingredients)=>({results:[{name,amount}],ingredients:Object.entries(ingredients).map(([name,amount])=>({name,amount}))});
const raw={recipe:{
  'iron-gear-wheel':recipe('iron-gear-wheel',1,{'iron-plate':2}),
  'transport-belt':recipe('transport-belt',2,{'iron-plate':1,'iron-gear-wheel':1}),
  'fast-transport-belt':recipe('fast-transport-belt',1,{'transport-belt':1,'iron-gear-wheel':5}),
  'underground-belt':recipe('underground-belt',2,{'iron-plate':10,'transport-belt':5}),
  'fast-underground-belt':recipe('fast-underground-belt',2,{'underground-belt':2,'iron-gear-wheel':40}),
}};
const bp=names=>({blueprint:{entities:names.map(name=>({name}))}});
test('fewer placed red transport entities do not imply lower construction iron',()=>{
 const before=constructionMetrics(bp(Array(8).fill('fast-transport-belt')),raw);
 const after=constructionMetrics(bp(Array(2).fill('fast-underground-belt')),raw);
 assert.equal(before.placedEntities-after.placedEntities,6);
 assert.equal(before.redBeltConstructionIronPlates,92);
 assert.equal(after.redBeltConstructionIronPlates,97.5);
});
test('non-transport items count in inventory but not the labeled transport-only cost',()=>{
 const m=constructionMetrics(bp(['assembling-machine-2','fast-transport-belt']),raw);
 assert.equal(m.placedEntities,2);assert.equal(m.redBeltConstructionIronPlates,11.5);
});
