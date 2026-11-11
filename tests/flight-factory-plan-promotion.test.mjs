import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGame} from '../scripts/flight-factory-model.mjs';
import {planFactory} from '../scripts/flight-factory-planner.mjs';
import {retainCalculatedPlan} from '../scripts/flight-factory-promote-plans.mjs';

function fixture() {
  const model = normalizeGame({item: {ore: {name: 'ore', stack_size: 100}, target: {name: 'target', stack_size: 100}},
    resource: {ore: {name: 'ore', autoplace: {}, minable: {result: 'ore'}}},
    recipe: {target: {name: 'target', ingredients: [{name: 'ore', amount: 2}], results: [{name: 'target', amount: 1}]}},
    'assembling-machine': {assembler: {name: 'assembler', type: 'assembling-machine', crafting_categories: ['crafting'], crafting_speed: 1, collision_box: [[-1, -1], [1, 1]], energy_source: {type: 'electric'}}}}, {prototypeSha256: 'exact'});
  const plan = planFactory(model, 'target');
  const currentVariant = {id: 'item-target-raw', mode: 'raw', status: 'unsupported'};
  const variant = {...currentVariant, status: 'generated', blueprintSha256: 'untested', blueprintFile: 'candidate.txt', evidence: {status: 'unverified'}};
  return {currentVariant, variant, plan: {...plan, blueprintSha256: 'untested'}, model, prototypeSha256: 'exact'};
}

test('calculated promotion strips unpublished layout claims and never replaces a supported variant', () => {
  const f = fixture(), promoted = retainCalculatedPlan(f);
  assert.equal(promoted.variant.status, 'planned'); assert.equal(promoted.variant.blueprintFile, undefined);
  assert.equal(promoted.variant.blueprintSha256, undefined); assert.equal(promoted.plan.blueprintSha256, undefined);
  assert.equal(promoted.variant.evidence.status, 'unverified'); assert.equal(promoted.plan.balance.passed, true);
  f.currentVariant.status = 'generated'; assert.equal(retainCalculatedPlan(f), null);
});

test('calculated promotion recomputes prototype balance instead of trusting a stored passed flag', () => {
  const f = fixture(); f.plan.inputs[0].perSecond *= 2; f.plan.balance.passed = true;
  assert.throws(() => retainCalculatedPlan(f), /Calculated balance failed/);
  const mismatch = fixture(); mismatch.plan.prototypeSha256 = 'different';
  assert.throws(() => retainCalculatedPlan(mismatch), /identity\/status mismatch/);
});
