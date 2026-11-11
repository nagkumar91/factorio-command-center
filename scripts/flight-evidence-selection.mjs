import path from 'node:path';

export function nativeEvidenceTime({report,filename=''}) {
  const explicit=Date.parse(report.reevaluatedAt||report.completedAt||'');
  if(Number.isFinite(explicit))return explicit;
  const match=/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/.exec(report.runId||path.basename(path.dirname(filename)));
  return match?Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`):0;
}
// Rank protocol strength and time only: passing outcomes never break ties.
export function compareNativeEvidence(a,b) {
  return (b.report.configuration?.measurementTicks||0)-(a.report.configuration?.measurementTicks||0)
    ||(b.report.configuration?.warmupTicks||0)-(a.report.configuration?.warmupTicks||0)
    ||nativeEvidenceTime(b)-nativeEvidenceTime(a)
    ||path.basename(path.dirname(b.filename||'')).localeCompare(path.basename(path.dirname(a.filename||'')));
}
