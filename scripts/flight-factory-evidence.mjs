import {createHash} from 'node:crypto';

// Accept native evidence only for the actual supplied artifact and prototype set.
// Import success and recipe calculations never imply measured production.
export function matchFactoryEvidence({variant, spec, report, code, prototypeSha256}) {
  const reasons = [], reject = value => reasons.push(value);
  const actual = createHash('sha256').update(code).digest('hex');
  if (actual !== variant.blueprintSha256 || actual !== spec.blueprintSha256 || actual !== report?.blueprintSha256) reject('blueprint-sha256-mismatch');
  if (spec.prototypeDumpSha256 !== prototypeSha256 || report?.prototypeDumpSha256 !== prototypeSha256) reject('prototype-sha256-mismatch');
  if (report?.id !== variant.id || spec.id !== variant.id) reject('factory-id-mismatch');
  const native = report?.native;
  if (!native) reject('missing-native-observations');
  else {
    if (native.blueprintSha256 !== actual || native.prototypeDumpSha256 !== prototypeSha256) reject('native-artifact-mismatch');
    if (!report.configurationSha256 || native.configurationSha256 !== report.configurationSha256 || !report.specSha256 || native.specSha256 !== report.specSha256) reject('native-configuration-mismatch');
    if (native.importedEntities !== spec.expectedEntityCount) reject('incomplete-placement');
    if ((native.rejections || []).length) reject('native-fixture-or-placement-rejection');
    if (native.completedTick !== spec.warmupTicks + spec.measurementTicks) reject('incomplete-simulation');
  }
  const targets = spec.outputs.filter(p => p.role === 'target');
  if (!targets.length) reject('missing-target-port');
  for (const target of targets) {
    const key = `${target.type}:${target.name}`, observed = native?.outputs?.[key];
    // Infrastructure robot seeds are not production. Both physical collection
    // and positive game production statistics must independently exist.
    const evaluated = report?.outputs?.[key];
    const craftProof = evaluated?.productionStatisticsIgnored === true
      && evaluated.productionEvidenceBasis === 'native-completed-crafts-of-matching-recipe-product'
      && evaluated.measuredProducerCrafts > 0 && evaluated.producerEntityIds?.length > 0
      && evaluated.producerEntityIds.every(id => spec.machineIds?.includes(id))
      && evaluated.windowProducerCrafts?.length >= 3 && evaluated.windowProducerCrafts.every(n => Number.isFinite(n) && n > 0);
    if (!observed || (!(observed.measuredProduced > 0) && !craftProof) || !(observed.collectionEvents >= 2) || !observed.windowCounts?.some(n => n > 0)) reject(`no-native-target-production:${key}`);
  }
  if (!report?.functionalPassed) reject('native-production-not-passed');
  if (reasons.length) return {status: 'unverified', matched: false, reasons};
  const throughput = report.passed === true && report.throughputPassed === true && targets.every(p => {
    const row = report.outputs?.[`${p.type}:${p.name}`];
    return row?.stable === true && row?.rateMet === true && row?.functional === true && row.windowPerMinute?.length >= 3 && row.windowPerMinute.every(n => Number.isFinite(n) && n > 0);
  });
  return {status: throughput ? 'native-throughput' : 'native-production', matched: true, blueprintSha256: actual, prototypeSha256,
    configurationSha256: report.configurationSha256, runId: report.runId,
    targets: Object.fromEntries(targets.map(p => { const key = `${p.type}:${p.name}`; return [key, {perMinute: report.outputs?.[key]?.perMinute, windowPerMinute: report.outputs?.[key]?.windowPerMinute}]; })),
    limitations: throughput ? [] : ['Native production observed; sustained balanced throughput has not passed.']};
}
