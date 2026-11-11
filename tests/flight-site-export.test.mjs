import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
const root=path.resolve('site');
const context=vm.createContext({});vm.runInContext(await fs.readFile(path.join(root,'flight-factories-data.js'),'utf8'),context);
const data=context.FLIGHT_FACTORIES;
const sha=b=>createHash('sha256').update(b).digest('hex');
function local(file){assert.equal(typeof file,'string');assert.ok(!path.isAbsolute(file)&&!file.split(/[\\/]/).includes('..'));return path.join(root,file);}
test('published flight plans retain matching recipe products and balances',async()=>{
 assert.equal(data.schemaVersion,1);assert.ok(data.items.length>0);const ids=new Set(data.items.map(i=>i.id));
 for(const factory of data.factories){assert.ok(ids.has(factory.product));if(!factory.planPath)continue;
  const plan=JSON.parse(await fs.readFile(local(factory.planPath),'utf8'));
  assert.equal(plan.prototypeSha256,data.profile.prototypeSha256,factory.id);
  assert.equal(plan.target.id,factory.product,factory.id);
  assert.equal(plan.target.perSecond*60,factory.outputPerMinute,factory.id);
  assert.equal(plan.balance.passed,true,factory.id);assert.ok(plan.balance.maxResidual<1e-6,factory.id);
 }
});
test('every published blueprint download matches its SHA and labeled input panels',async()=>{
 for(const factory of data.factories){const blueprint=factory.blueprint;if(!blueprint)continue;
  if(blueprint.preview)await fs.access(local(blueprint.preview));
  if(factory.validation?.status==='native-failed')assert.ok(!blueprint.path,'Failed native build is not downloadable');
  if(!blueprint.path)continue;
  const code=await fs.readFile(local(blueprint.path),'utf8');assert.equal(sha(code),blueprint.sha256,factory.id);
  const decoded=JSON.parse(inflateSync(Buffer.from(code.slice(1),'base64'))).blueprint;
  const entities=new Map(decoded.entities.map(e=>[e.entity_number,e]));
  for(const input of factory.inputs){const panel=entities.get(input.displayEntity);assert.equal(panel?.name,'display-panel',factory.id+': '+input.id);assert.equal(panel.icon?.name,input.id);assert.equal(panel.icon?.type||'item',input.type||'item');assert.ok(panel.text?.includes(input.id));}
 }
});
test('every published native claim has real matching report and measured collection',async()=>{
 for(const factory of data.factories){const v=factory.validation;if(v?.status!=='native-tested')continue;
  assert.equal(v.passed,true);assert.equal(v.blueprintSha256,factory.blueprint.sha256);assert.equal(v.prototypeSha256,data.profile.prototypeSha256);
  const report=JSON.parse(await fs.readFile(local(v.reportPath),'utf8'));
  assert.equal(report.passed,true,factory.id);assert.equal(report.blueprintSha256,v.blueprintSha256);assert.equal(report.prototypeDumpSha256||report.prototypeSha256,v.prototypeSha256);
  assert.ok(report.native,'Native execution record is required');assert.ok(report.configuration?.measurementTicks>0);
  assert.match(report.originalReportSha256,/^[a-f0-9]{64}$/);assert.match(report.nativeReportSha256,/^[a-f0-9]{64}$/);
  const availability=report.environmentAvailability;
  assert.ok(['verified-after-supersession','verified-loaded-map','not-required-by-declared-boundaries'].includes(availability?.status),factory.id);
  assert.equal(availability.nativeMeasurementsUnchanged,true);
  if(availability.proofSha256){const proofBytes=await fs.readFile(local(data.profile.map.evidencePath));assert.equal(availability.proofSha256,sha(proofBytes));const proof=JSON.parse(proofBytes);assert.equal(availability.saveSha256,proof.saveSha256);assert.equal(availability.prototypeSha256,data.profile.prototypeSha256);}
  for(const row of v.outputs||[]){const actual=report.outputs[`${row.type}:${row.id}`];assert.ok(actual);assert.equal(row.collected,actual.collected);assert.equal(row.perMinute,actual.perMinute);assert.ok(Math.abs(row.perMinute-row.collected/(report.configuration.measurementTicks/3600))<1e-6);}
 }
});

test('published map proof binds the Ready save to its loaded resource census',async()=>{
 const bytes=await fs.readFile(local(data.profile.map.evidencePath));const proof=JSON.parse(bytes);
 const map=JSON.parse(await fs.readFile(local('sources/flight-map/native-report.json')));
 assert.equal(proof.passed,true);assert.equal(proof.validationKind,'loaded-save-runtime-state');
 assert.equal(map.loadedSaveValidation.sha256,sha(bytes));assert.equal(map.saveSha256,proof.saveSha256);
 assert.equal(map.installedSaveName,data.profile.map.saveName);assert.equal(proof.prototypeSha256,data.profile.prototypeSha256);
 assert.equal(proof.maxResourcePerEntity,4294967295);assert.equal(Object.keys(proof.resources).length,13);
 assert.equal(Object.values(proof.resources).reduce((a,b)=>a+b,0),proof.resourceEntities*4294967295);
 assert.equal(proof.treeRecipe,true);assert.equal(proof.robotResearch,false);assert.equal(proof.starterAutoGrant,false);
});

test('flight publication contract is valid JSON and describes the exported schema',async()=>{const contract=JSON.parse(await fs.readFile(path.join(root,'flight-factories-contract.json'),'utf8'));assert.equal(contract.properties.schemaVersion.const,data.schemaVersion);for(const required of contract.required)assert.ok(required in data);});
