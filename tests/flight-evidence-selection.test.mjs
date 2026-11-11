import test from 'node:test';
import assert from 'node:assert/strict';
import {compareNativeEvidence,nativeEvidenceTime} from '../scripts/flight-evidence-selection.mjs';
const row=(runId,measurementTicks,warmupTicks,passed,extra={})=>({filename:`reports/${runId}/item-example.json`,report:{runId,configuration:{measurementTicks,warmupTicks},passed,...extra}});
test('native evidence ranks duration then warmup then actual time independently of outcome',()=>{
 const old=row('2026-11-11T04-03-05-643Z-56431',432000,54000,true);
 const newer=row('2026-11-11T05-03-05-643Z-56432',54000,54000,false);
 assert.equal([newer,old].sort(compareNativeEvidence)[0],old);
 const warm=row('2026-11-11T03-03-05-643Z-56430',432000,108000,false);
 assert.equal([old,warm].sort(compareNativeEvidence)[0],warm);
 const reevaluated=row(old.report.runId+'-reevaluated-1794370995112',432000,54000,false,{reevaluatedAt:'2026-11-11T05:10:00.000Z'});
 assert.equal([old,reevaluated].sort(compareNativeEvidence)[0],reevaluated);
 assert.equal(nativeEvidenceTime(old),Date.parse('2026-11-11T04:03:05.643Z'));
});
