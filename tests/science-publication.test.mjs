import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {starterConfigurationHash} from '../scripts/starter-verification.mjs';
import {validateScienceEvidence} from '../scripts/index-science-factories.mjs';

function fixture(){
 const products=['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack'];
 const rawInputs=['iron-ore','copper-ore','coal','stone','water','crude-oil'];
 const info={id:'science-fixture',scienceFactory:true,rawOnly:true,targetPerMinute:30,fuelPolicy:{furnaceFuel:'solid-fuel'},products,rawInputs,researchClosure:['automation-2'],ports:[
  ...rawInputs.map((id,index)=>({kind:index<4?'input':'fluid',items:[id],entity:index+1,externalSide:'west'})),
  ...products.map((id,index)=>({kind:'output',items:[id],entity:index+20,externalSide:'east'}))
 ]};
 const code='fixture code';
 const build={id:info.id,passed:true,blueprintSha256:createHash('sha256').update(code).digest('hex'),portConfigurationSha256:starterConfigurationHash(info),rawInputs,testedTechnologies:info.researchClosure,research:{allEnabled:true},inputDisplays:{verified:6},machines:[{productsFinished:20}],power:{allConnected:true,bigPoles:1,mediumPoles:5},fuel:{furnaceFuel:'solid-fuel',solidFuelProduced:100,furnaces:[{solidFuelBurnSeconds:100,nonSolidFuel:{},nonSolidBurn:{}}]},restartedAfterCollection:true,drainedPorts:Object.fromEntries(info.ports.filter(p=>p.kind==='output').map(p=>[p.entity,50])),restartedPorts:Object.fromEntries(info.ports.filter(p=>p.kind==='output').map(p=>[p.entity,true]))};
 const measured={...structuredClone(build),throughput:{warmupMinutes:15,measuredMinutes:30,rateBasis:'Native consumption counters',inputCounts:Object.fromEntries(rawInputs.map(id=>[id,300])),inputPerMinute:Object.fromEntries(rawInputs.map(id=>[id,10])),collected:Object.fromEntries(products.map(id=>[id,900])),perMinute:Object.fromEntries(products.map(id=>[id,30]))}};
 return {info,code,evidence:{builds:[build]},throughput:{builds:[measured]}};
}
const validate=f=>validateScienceEvidence(f.info,f.code,f.evidence,f.throughput);

test('science publication requires every simultaneous output and solid fuel in each native run',()=>{
 assert.doesNotThrow(()=>validate(fixture()));
 const slow=fixture();slow.throughput.builds[0].throughput.collected['chemical-science-pack']=600;slow.throughput.builds[0].throughput.perMinute['chemical-science-pack']=20;
 assert.throws(()=>validate(slow),/below 30\/min.*chemical-science-pack/);
 const coal=fixture();coal.evidence.builds[0].fuel.furnaces[0].nonSolidBurn.coal=1;
 assert.throws(()=>validate(coal),/burned another fuel/);
 const unlit=fixture();unlit.throughput.builds[0].fuel.furnaces[0].solidFuelBurnSeconds=0;
 assert.throws(()=>validate(unlit),/never burned solid fuel/);
 const noRefill=fixture();noRefill.evidence.builds[0].restartedPorts[23]=false;
 assert.throws(()=>validate(noRefill),/did not drain and refill/);
 const disconnected=fixture();disconnected.throughput.builds[0].power.allConnected=false;
 assert.throws(()=>validate(disconnected),/power network is incomplete/);
});

test('science publication requires all six raw entrances and four science exits on their specified sides',()=>{
 for(const kind of ['input','output']){
  const missing=fixture();missing.info.ports.splice(missing.info.ports.findIndex(p=>p.kind===kind),1);
  assert.throws(()=>validate(missing),/separate.*ports/);
 }
 const wrongSide=fixture();wrongSide.info.ports[0].externalSide='north';
 assert.throws(()=>validate(wrongSide),/west side/);
 const unused=fixture();unused.throughput.builds[0].throughput.inputCounts['crude-oil']=0;unused.throughput.builds[0].throughput.inputPerMinute['crude-oil']=0;
 assert.throws(()=>validate(unused),/was not consumed: crude-oil/);
});


test('electric science publication requires observed powered electric furnaces in both runs',()=>{
 const f=fixture();f.info.fuelPolicy={furnaceFuel:'electricity'};
 for(const build of [f.evidence.builds[0],f.throughput.builds[0]]){
  build.portConfigurationSha256=starterConfigurationHash(f.info);
  build.fuel={furnaceFuel:'electricity',allFurnacesPowered:true,furnaces:[{name:'electric-furnace',electricPoweredSeconds:100,burning:{},inventorySamples:{}}]};
 }
 assert.doesNotThrow(()=>validate(f));
 f.throughput.builds[0].fuel.furnaces[0].electricPoweredSeconds=0;
 assert.throws(()=>validate(f),/electricity alone/);
});
