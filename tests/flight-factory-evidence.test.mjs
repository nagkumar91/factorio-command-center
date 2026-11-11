import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {matchFactoryEvidence} from '../scripts/flight-factory-evidence.mjs';

function fixture() {
  const code = 'exact blueprint bytes', sha = createHash('sha256').update(code).digest('hex'), prototypeSha256 = 'exact-prototypes';
  const variant = {id: 'robot-raw', blueprintSha256: sha};
  const spec = {id: variant.id, blueprintSha256: sha, prototypeDumpSha256: prototypeSha256, expectedEntityCount: 20, warmupTicks: 60, measurementTicks: 180,
    outputs: [{type: 'item', name: 'logistic-robot', role: 'target'}]};
  const row = {measuredProduced: 6, collectionEvents: 6, windowCounts: [2, 2, 2]};
  const report = {id: variant.id, blueprintSha256: sha, prototypeDumpSha256: prototypeSha256, configurationSha256: 'config', specSha256: 'spec', functionalPassed: true, passed: true, throughputPassed: true,
    native: {blueprintSha256: sha, prototypeDumpSha256: prototypeSha256, configurationSha256: 'config', specSha256: 'spec', importedEntities: 20, completedTick: 240, outputs: {'item:logistic-robot': row}},
    outputs: {'item:logistic-robot': {stable: true, rateMet: true, functional: true, perMinute: 120, windowPerMinute: [120, 120, 120]}}};
  return {code, prototypeSha256, variant, spec, report};
}
test('evidence requires exact artifact bytes and prototypes, not import success', () => {
  const f = fixture(); assert.equal(matchFactoryEvidence(f).status, 'native-throughput');
  f.code += '\n'; assert.equal(matchFactoryEvidence(f).matched, false);
  const g = fixture(); g.report.prototypeDumpSha256 = 'vanilla'; assert.equal(matchFactoryEvidence(g).matched, false);
  const h = fixture(); delete h.report.native; assert.equal(matchFactoryEvidence(h).matched, false);
});
test('seeded logistics robots cannot count as produced target robots', () => {
  const f = fixture(); f.report.native.outputs['item:logistic-robot'].measuredProduced = 0;
  assert.equal(matchFactoryEvidence(f).matched, false);
});
test('functional production is kept separate from sustained native throughput', () => {
  const f = fixture(); f.report.throughputPassed = false; f.report.passed = false;
  assert.equal(matchFactoryEvidence(f).status, 'native-production');
  f.report.native.completedTick = 60; assert.equal(matchFactoryEvidence(f).matched, false);
});
test('stats-excluded barrel recipes require matched native craft counters plus collected output', () => {
  const f = fixture(); f.spec.machineIds = [9]; f.report.native.outputs['item:logistic-robot'].measuredProduced = 0;
  Object.assign(f.report.outputs['item:logistic-robot'], {productionStatisticsIgnored: true, productionEvidenceBasis: 'native-completed-crafts-of-matching-recipe-product', measuredProducerCrafts: 6, producerEntityIds: [9], windowProducerCrafts: [2, 2, 2]});
  assert.equal(matchFactoryEvidence(f).status, 'native-throughput');
  f.report.outputs['item:logistic-robot'].producerEntityIds = [1000]; assert.equal(matchFactoryEvidence(f).matched, false);
});
