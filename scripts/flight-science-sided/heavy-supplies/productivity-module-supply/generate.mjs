// productivity-module-supply: 20 productivity modules (tier 1) per minute for the south entrance of the compact
// six-pack tier. Advanced circuits and electronic circuits (from the family's circuit supplies) arrive on one
// west inlet belt each. Machines and inlet figures come from the flight-save prototype data (recipePlan).
//
// Layout (x to the right, y down; assemblers 3 x 3):
//   row 0   red | green circuit belt (red north lane, green south lane) -------------------->
//   row 1   one fast inserter per assembler, belt to assembler
//   rows 2-4  seven assemblers (productivity module)
//   row 5   one output inserter per assembler
//   row 6   product belt ---> turns north at the east edge; a filter inserter lifts modules from its end
//           into the chest above it.
// West: red circuits side-load a short riser from the west, green circuits from the east; the riser turns
// east into row 0, so each material keeps its own lane. The big electric pole (power port) sits in the
// south-west corner. Shared builder: ../electric-furnace-supply/supply-kit.mjs.
// Usage: node scripts/flight-science-sided/heavy-supplies/productivity-module-supply/generate.mjs
import {findProfile,recipePlan,createBuilder,finish} from '../electric-furnace-supply/supply-kit.mjs';

export const ID='productivity-module-supply',PRODUCT='productivity-module',TARGET=20;
const profile=await findProfile();
if(!profile)throw Error('Needs the flight-save prototype dump (SHA-256 33912441...): set FLIGHT_PROFILE or build .cache/flight-21');
const {raw,bytes}=profile,plan=recipePlan(raw,PRODUCT,TARGET);
const rate=Object.fromEntries(plan.inputs.map(i=>[i.item,i.perMinute]));
const b=createBuilder(),{belt,arm,machine,input,output}=b;
const N=0,E=4,W=12,last=plan.machines*3-2;
// Red circuits: one inlet tile side-loading the riser at (-3,1) from the west.
input('advanced-circuit',-4,1,rate['advanced-circuit'],[-4,0]);
for(const y of [3,2,1])belt(-3,y,N);
for(let x=-3;x<=last;x++)belt(x,0,E);
// Green circuits: east, up two tiles, then west into the riser's east side at (-3,2).
input('electronic-circuit',-4,4,rate['electronic-circuit'],[-4,3]);belt(-3,4,E);belt(-2,4,N);belt(-2,3,N);belt(-2,2,W);
for(let x=0;x<=last;x++)belt(x,6,E);
for(let i=0;i<plan.machines;i++){
 const cx=3*i;machine(PRODUCT,cx,3);
 arm(cx,1,N);                          // both circuits, picked from row 0
 arm(cx,5,N);                          // product onto row 6
}
belt(last+1,6,N);belt(last+1,5,N);output(PRODUCT,last+1,4,TARGET,[last+1,2],'south');
const description=`One inlet per material on the left (advanced circuits ${rate['advanced-circuit']}/min, electronic circuits ${rate['electronic-circuit']}/min); collect ${TARGET} productivity modules/min from the chest on the right. ${plan.machines} assembling machine 2 (productivity module, ${plan.perMachinePerMinute}/min each), fast inserters, red belts, no modules, no circuit controls.`;
const {manifest}=await finish({id:ID,product:PRODUCT,target:TARGET,plan,builder:b,raw,rawBytes:bytes,description,layout:'Seven assemblers in one row between a red|green circuit lane-split belt (north) and a product belt (south).'});
console.log(JSON.stringify({id:ID,footprint:manifest.footprint,machines:manifest.machineCounts,inputs:manifest.inputs.map(i=>[i.item,i.perMinute]),construction:manifest.construction,blueprintSha256:manifest.blueprintSha256,status:manifest.status}));
