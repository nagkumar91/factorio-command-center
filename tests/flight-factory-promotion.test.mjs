import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectPromotionEvidence} from '../scripts/flight-factory-promote.mjs';
import {configurationHash} from '../scripts/flight-native-lib.mjs';

function fixture() {
  const code = 'exact-test-blueprint', blueprintSha256 = createHash('sha256').update(code).digest('hex'), prototypeSha256 = 'installed-mods';
  const variant = {id: 'item-target-raw', blueprintSha256};
  const spec = {...variant, prototypeDumpSha256: prototypeSha256, expectedEntityCount: 10, machineIds: [5],
    warmupTicks: 54000, measurementTicks: 108000, outputs: [{type: 'item', name: 'target', role: 'target'}], infrastructureSeeds: [{entityNumber: 8, item: 'logistic-robot', count: 20}]};
  const observed = {measuredProduced: 10, collectionEvents: 10, windowCounts: [3, 3, 4]};
  const report = {...variant, prototypeDumpSha256: prototypeSha256, sourceSpecSha256: configurationHash(spec),
    configurationSha256: 'config', specSha256: 'tested-spec', runId: 'first', configuration: {warmupTicks: 18000, measurementTicks: 54000},
    passed: true, functionalPassed: true, throughputPassed: true,
    native: {...variant, prototypeDumpSha256: prototypeSha256, configurationSha256: 'config', specSha256: 'tested-spec', importedEntities: 10, completedTick: 72000, outputs: {'item:target': observed}},
    outputs: {'item:target': {stable: true, rateMet: true, functional: true, perMinute: 1, windowPerMinute: [1, 1, 1]}}};
  return {variant, spec, code, prototypeSha256, reports: [report]};
}

test('promotion accepts observed timing overrides but requires the exact tested boundary and robot specification', () => {
  const f = fixture(); assert.equal(selectPromotionEvidence(f).evidence.status, 'native-throughput');
  f.spec.infrastructureSeeds[0].count++;
  assert.throws(() => selectPromotionEvidence(f), /No exact native report/);
});

test('a longer failing native run prevents promotion even when a shorter run passed', () => {
  const f = fixture(), longer = structuredClone(f.reports[0]);
  Object.assign(longer, {runId: 'second', passed: false, throughputPassed: false, failures: ['below-target:item:target']});
  longer.configuration.measurementTicks = 108000; longer.native.completedTick = 126000;
  f.reports.push(longer);
  assert.throws(() => selectPromotionEvidence(f), /Native throughput has not passed/);
});

test('newer reevaluation takes precedence at the same observed protocol strength', () => {
  const f = fixture(), old = structuredClone(f.reports[0]);
  Object.assign(old, {runId: '2026-11-11T01-00-00-000Z-1', passed: false, throughputPassed: false});
  Object.assign(f.reports[0], {runId: old.runId, reevaluatedAt: '2026-11-11T02:00:00.000Z'});
  f.reports.unshift(old);
  assert.equal(selectPromotionEvidence(f).report.reevaluatedAt, '2026-11-11T02:00:00.000Z');
});
