import {createHash} from 'node:crypto';
import {starterConfigurationHash} from './starter-verification.mjs';

function fail(id,message){throw Error(id+': '+message);}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function validateConsumptionRates(info,measurement){
 if(!measurement||!(measurement.measuredMinutes>=20)||!(measurement.warmupMinutes>=10))fail(info.id,'rate measurement window is too short');
 if(typeof measurement.rateBasis!=='string'||!measurement.rateBasis)fail(info.id,'input consumption measurement method is missing');
 for(const id of info.rawInputs){
  const count=measurement.inputCounts?.[id],rate=measurement.inputPerMinute?.[id];
  if(!Number.isFinite(count)||count<0||!Number.isFinite(rate)||rate<0)fail(info.id,'missing or invalid measured consumption for '+id);
  if(Math.abs(rate-count/measurement.measuredMinutes)>1e-8)fail(info.id,'input rate differs from measured count for '+id);
 }
 for(const id of [...info.products,...(info.sideProducts||[])]){
  const count=measurement.collected?.[id],rate=measurement.perMinute?.[id];
  if(!(count>0)||!Number.isFinite(rate)||rate<=0)fail(info.id,'no collected output for '+id);
  if(Math.abs(rate-count/measurement.measuredMinutes)>1e-8)fail(info.id,'output rate differs from collected count for '+id);
 }
}

/** Reject stale or failed native evidence before attaching operating rates. */
export function validateRawRateEvidence(info,code,evidence,throughput){
 const blueprintSha256=createHash('sha256').update(code).digest('hex');
 const portConfigurationSha256=starterConfigurationHash(info);
 const functional=evidence?.builds?.find(build=>build.id===info.id);
 const measured=throughput?.builds?.find(build=>build.id===info.id);
 for(const [build,label] of [[functional,'functional'],[measured,'throughput']]){
  if(!build)fail(info.id,'missing '+label+' evidence');
  if(build.blueprintSha256!==blueprintSha256)fail(info.id,label+' evidence blueprint SHA does not match source');
  if(build.portConfigurationSha256!==portConfigurationSha256)fail(info.id,label+' evidence configuration SHA does not match manifest');
  if(build.passed!==true)fail(info.id,label+' evidence is failed');
  if(!same(build.rawInputs,info.rawInputs))fail(info.id,label+' raw inputs differ from manifest');
  if(!same(build.testedTechnologies||build.research?.closure,info.researchClosure))fail(info.id,label+' research differs from manifest');
  if(build.inputDisplays?.verified!==info.rawInputs.length)fail(info.id,label+' input display verification is incomplete');
  if(!build.machines?.length||build.machines.some(machine=>!((machine.products??machine.productsFinished)>0)))fail(info.id,label+' includes a machine that produced nothing');
 }
 if(info.ports.some(port=>port.kind==='output')&&!(functional.restartedAfterCollection||functional.restartedAfterHalf))fail(info.id,'functional outputs did not restart after collection');
 validateConsumptionRates(info,measured.throughput);
 return {blueprintSha256,portConfigurationSha256,functional,measured};
}
