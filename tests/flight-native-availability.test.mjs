import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLoadedMapEvidence,bindEnvironmentAvailability} from '../scripts/flight-native-availability-lib.mjs';
function fixture(){
  const proofSha256='1'.repeat(64),mapReportSha256='2'.repeat(64),save='3'.repeat(64),control='4'.repeat(64),proto='5'.repeat(64);
  const proof={validationKind:'loaded-save-runtime-state',passed:true,saveSha256:save,prototypeSha256:proto,scenarioControlSha256:control,resources:{scrap:200},resourceEntities:2,maxResourcePerEntity:100,playerJoinSimulated:false};
  const mapReport={saveSha256:save,prototypeSha256:proto,scenarioSha256:{'control.lua':control},resources:{scrap:100},loadedSaveValidation:{passed:true,sha256:proofSha256,saveSha256:save}};
  const evidence={proof,mapReport,proofSha256,mapReportSha256,actualSaveSha256:save,actualControlSha256:control};
  const spec={surface:'nauvis',prototypeDumpSha256:proto,configurationSha256:'unchanged',inputs:[{type:'item',name:'scrap',sources:[{kind:'seeded-resource-extraction',entity:'scrap',amount:150,renewable:false,evidenceSha256:'a'.repeat(64)}]}]};
  const raw={resource:{scrap:{minable:{result:'scrap'}}}};return {evidence,spec,raw,proto};
}
test('an initial map report or clean reload exit is not persistent loaded-resource evidence',()=>{
  const {evidence,proto}=fixture();assert.equal(validateLoadedMapEvidence(evidence,proto).passed,true);
  evidence.proof={...evidence.mapReport,reloadValidation:{passed:true},passed:true};
  assert.ok(validateLoadedMapEvidence(evidence,proto).reasons.includes('persistent-loaded-save-observation-required'));
});
test('availability is bound to exact loaded save, prototype, control and resource census',()=>{
  for(const change of [e=>e.actualSaveSha256='0'.repeat(64),e=>e.proof.prototypeSha256='0'.repeat(64),e=>e.actualControlSha256='0'.repeat(64),e=>e.proof.resources.scrap=199,e=>e.mapReport.loadedSaveValidation.sha256='0'.repeat(64)]){
    const {evidence,proto}=fixture();change(evidence);assert.equal(validateLoadedMapEvidence(evidence,proto).passed,false);
  }
});
test('supersession uses actual loaded totals and never rewrites historical spec hashes',()=>{
  const {evidence,spec,raw}=fixture(),before=structuredClone(spec),r=bindEnvironmentAvailability(spec,evidence,raw);
  assert.equal(r.status,'verified-after-supersession');assert.equal(r.nativeMeasurementsUnchanged,true);
  assert.equal(r.verifiedResourceSources[0].observedAmount,200);assert.equal(r.verifiedResourceSources[0].minimumAmount,150);
  assert.deepEqual(r.supersedes,['a'.repeat(64)]);assert.deepEqual(spec,before);
  spec.inputs[0].sources[0].amount=201;assert.equal(bindEnvironmentAvailability(spec,evidence,raw).status,'unverified');
});
test('resource products and planet must match; ordinary intermediary boundaries make no map availability claim',()=>{
  const {evidence,spec,raw}=fixture();raw.resource.scrap.minable.result='iron-ore';assert.equal(bindEnvironmentAvailability(spec,evidence,raw).status,'unverified');
  raw.resource.scrap.minable.result='scrap';spec.surface='fulgora';assert.equal(bindEnvironmentAvailability(spec,evidence,raw).status,'unverified');
  spec.inputs[0].sources=[];assert.equal(bindEnvironmentAvailability(spec,undefined,raw).status,'not-required-by-declared-boundaries');
});
