import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConsumptionRates} from '../scripts/blueprint-rate-evidence.mjs';

const info={id:'measured-module',rawInputs:['iron-ore','coal','water'],products:['military-science-pack']};
function measurement(){return {
 warmupMinutes:15,measuredMinutes:30,
 rateBasis:'Native consumption counters after warmup, including burner fuel.',
 inputCounts:{'iron-ore':1200,coal:90,water:2400},
 inputPerMinute:{'iron-ore':40,coal:3,water:80},
 collected:{'military-science-pack':150},perMinute:{'military-science-pack':5}
};}
test('operating rates require each raw input, including burner fuel and fluids',()=>{
 assert.doesNotThrow(()=>validateConsumptionRates(info,measurement()));
 const missingFuel=measurement();delete missingFuel.inputCounts.coal;
 assert.throws(()=>validateConsumptionRates(info,missingFuel),/consumption for coal/);
 const mismatchedFluid=measurement();mismatchedFluid.inputPerMinute.water=2400;
 assert.throws(()=>validateConsumptionRates(info,mismatchedFluid),/input rate differs.*water/);
 const wrongOutput=measurement();wrongOutput.perMinute['military-science-pack']=150;
 assert.throws(()=>validateConsumptionRates(info,wrongOutput),/output rate differs/);
 const noMethod=measurement();delete noMethod.rateBasis;
 assert.throws(()=>validateConsumptionRates(info,noMethod),/measurement method is missing/);
});
