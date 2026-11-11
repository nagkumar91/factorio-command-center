// Resource availability is independent of physical factory production. Never
// rewrite a historical simulation/configuration hash to attach a newer map.
const hash=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const material=p=>`${p.type || 'item'}:${p.name}`;
export const availabilityPolicyId='flight-native-loaded-map-availability-v1';

export function validateLoadedMapEvidence(evidence,prototypeSha256){
  const {proof,mapReport,proofSha256,mapReportSha256,actualSaveSha256,actualControlSha256}=evidence || {};
  const reasons=[];
  if(!proof || proof.validationKind!=='loaded-save-runtime-state' || proof.passed!==true)reasons.push('persistent-loaded-save-observation-required');
  if(!hash(proofSha256) || !hash(mapReportSha256) || mapReport?.loadedSaveValidation?.passed!==true || mapReport?.loadedSaveValidation?.sha256!==proofSha256)reasons.push('loaded-proof-not-bound-to-map-report');
  if(!hash(proof?.saveSha256) || actualSaveSha256!==proof?.saveSha256 || mapReport?.saveSha256!==proof?.saveSha256 || mapReport?.loadedSaveValidation?.saveSha256!==proof?.saveSha256)reasons.push('loaded-save-sha256-mismatch');
  if(!hash(prototypeSha256) || proof?.prototypeSha256!==prototypeSha256 || mapReport?.prototypeSha256!==prototypeSha256)reasons.push('loaded-map-prototype-sha256-mismatch');
  if(!hash(proof?.scenarioControlSha256) || actualControlSha256!==proof?.scenarioControlSha256 || mapReport?.scenarioSha256?.['control.lua']!==proof?.scenarioControlSha256)reasons.push('loaded-map-control-sha256-mismatch');
  const amounts=Object.values(proof?.resources || {});
  if(!Number.isSafeInteger(proof?.resourceEntities) || proof.resourceEntities<=0 || !Number.isSafeInteger(proof?.maxResourcePerEntity) || proof.maxResourcePerEntity<=0 || !amounts.length || amounts.some(n=>!Number.isSafeInteger(n)||n<=0)
    || amounts.reduce((a,b)=>a+b,0)!==proof.resourceEntities*proof.maxResourcePerEntity)reasons.push('inconsistent-loaded-resource-census');
  for(const [name,minimum] of Object.entries(mapReport?.resources || {}))if(!(proof?.resources?.[name]>=minimum))reasons.push('loaded-resource-below-map-declaration:'+name);
  return {passed:reasons.length===0,reasons};
}

export function bindEnvironmentAvailability(spec,evidence,raw){
  const sources=(spec.inputs || []).flatMap(p=>(p.sources || []).filter(s=>s.kind==='seeded-resource-extraction').map(source=>({port:p,source})));
  const base={schemaVersion:1,policyId:availabilityPolicyId,nativeMeasurementsUnchanged:true,
    scope:'Scenario-seeded resource availability only; extraction, logistics from the map and player-join behavior are not production measurements.',
    historicalAvailabilityClaimsSuperseded:false};
  if(!sources.length)return {...base,status:'not-required-by-declared-boundaries',supersedes:[],verifiedResourceSources:[]};
  const check=validateLoadedMapEvidence(evidence,spec.prototypeDumpSha256 || spec.prototypeSha256);
  if((spec.surface?.name || spec.surface || 'nauvis')!=='nauvis')check.reasons.push('loaded-resource-observation-is-for-nauvis');
  check.passed=check.reasons.length===0;
  if(!check.passed)return {...base,status:'unverified',reasons:check.reasons,supersedes:[],verifiedResourceSources:[]};
  const verified=[],reasons=[];
  for(const {port,source} of sources){
    const resource=raw.resource?.[source.entity];
    const products=resource?.minable?.result?[{name:resource.minable.result}]:Object.values(resource?.minable?.results || {});
    const observed=evidence.proof.resources[source.entity];
    if(!resource || !products.some(p=>material(p)===material(port)))reasons.push('resource-does-not-yield-declared-input:'+material(port));
    if(source.renewable!==false || !(source.amount>0) || !(observed>=source.amount))reasons.push('loaded-resource-below-source-declaration:'+source.entity);
    verified.push({material:material(port),entity:source.entity,minimumAmount:source.amount,observedAmount:observed ?? 0,
      historicalEvidenceSha256:source.evidenceSha256,evidenceSha256:evidence.proofSha256,renewable:false,extractionIncluded:false});
  }
  const supersedes=[...new Set(sources.map(({source})=>source.evidenceSha256).filter(s=>s!==evidence.mapReportSha256 && s!==evidence.proofSha256))].sort();
  return {...base,status:reasons.length?'unverified':supersedes.length?'verified-after-supersession':'verified-loaded-map',reasons,supersedes,historicalAvailabilityClaimsSuperseded:supersedes.length>0,
    ...(supersedes.length?{supersessionReason:'Earlier assertions are retained as historical metadata; current availability relies on this loaded-save proof.'}:{}),
    proofPath:evidence.proofPath,proofSha256:evidence.proofSha256,mapReportPath:evidence.mapReportPath,mapReportSha256:evidence.mapReportSha256,
    saveSha256:evidence.proof.saveSha256,prototypeSha256:evidence.proof.prototypeSha256,scenarioControlSha256:evidence.proof.scenarioControlSha256,
    loadedStateValidation:{validationKind:evidence.proof.validationKind,passed:true,resourceEntities:evidence.proof.resourceEntities,resourceTypes:Object.keys(evidence.proof.resources).length,playerJoinSimulated:evidence.proof.playerJoinSimulated},
    verifiedResourceSources:verified};
}
