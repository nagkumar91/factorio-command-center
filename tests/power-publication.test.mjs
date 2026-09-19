import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {starterConfigurationHash} from '../scripts/starter-verification.mjs';
import {validatePowerWorkshopEvidence} from '../scripts/index-power-workshops.mjs';

function fixture(){
 const info={id:'solar-fixture',rawOnly:true,fuelPolicy:{furnaceFuel:'electricity'},products:['solar-panel'],rawInputs:['iron-ore','copper-ore'],researchClosure:['advanced-material-processing-2'],ports:[{kind:'output',entity:1,items:['solar-panel']}]};
 const code='power fixture';
 const build={id:info.id,passed:true,blueprintSha256:createHash('sha256').update(code).digest('hex'),portConfigurationSha256:starterConfigurationHash(info),rawInputs:info.rawInputs,testedTechnologies:info.researchClosure,inputDisplays:{verified:2},machines:[{productsFinished:10}],restartedAfterCollection:true,power:{allConnected:true},fuel:{furnaceFuel:'electricity',allFurnacesPowered:true,furnaces:[{name:'electric-furnace',electricPoweredSeconds:100,burning:{},inventorySamples:{}}]}};
 const measured={...structuredClone(build),throughput:{warmupMinutes:15,measuredMinutes:30,rateBasis:'Native consumption counters',inputCounts:{'iron-ore':300,'copper-ore':300},inputPerMinute:{'iron-ore':10,'copper-ore':10},collected:{'solar-panel':30},perMinute:{'solar-panel':1}}};
 return {info,code,evidence:{builds:[build]},throughput:{builds:[measured]}};
}
const validate=f=>validatePowerWorkshopEvidence(f.info,f.code,f.evidence,f.throughput);

test('power workshop publication rejects unpowered furnaces and processed inputs',()=>{
 assert.doesNotThrow(()=>validate(fixture()));
 const unpowered=fixture();unpowered.throughput.builds[0].fuel.furnaces[0].electricPoweredSeconds=0;
 assert.throws(()=>validate(unpowered),/electricity alone/);
 const disconnected=fixture();disconnected.evidence.builds[0].power.allConnected=false;
 assert.throws(()=>validate(disconnected),/power network is incomplete/);
 const processed=fixture();processed.info.rawInputs.push('steel-plate');
 assert.throws(()=>validate(processed),/processed external input/);
});
