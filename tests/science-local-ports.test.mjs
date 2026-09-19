import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCompactRecipeBlock,checkCompactRecipeBlock} from '../scripts/science-factory/local-ports/compact-recipe-blocks.mjs';

test('a mixed ingredient/result belt requires a rear connection to prevent an automatic curve',()=>{
 const block=makeCompactRecipeBlock({
  id:'regression-piercing',machine:'assembling-machine-2',machines:2,pitch:3,inwardInputs:true,
  recipe:{id:'piercing-rounds-magazine',time:6,ingredients:[
   {id:'firearm-magazine',amount:2},{id:'steel-plate',amount:1},{id:'copper-plate',amount:2}
  ],results:[{id:'piercing-rounds-magazine',amount:2}]}
 });
 assert.doesNotThrow(()=>checkCompactRecipeBlock(block));
 const guide=block.belts.find(belt=>belt.role==='input-c-lane-guide');
 assert.ok(guide,'the native regression filled both lanes when this connection was absent');
 block.belts=block.belts.filter(belt=>belt!==guide);
 block.entities=block.entities.filter(entity=>entity.entity_number!==guide.entity);
 assert.throws(()=>checkCompactRecipeBlock(block),/curve and fill both lanes/);
});
