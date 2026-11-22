// electric-furnace-supply: 20 electric furnaces per minute for the south entrance of the compact six-pack tier.
// Steel plates, stone bricks and advanced circuits (from the family's red-circuit supply) arrive on one west
// inlet belt each. Machines and inlet figures come from the flight-save prototype data (recipePlan).
//
// Layout (x to the right, y down; assemblers 3 x 3):
//   row 0   steel | brick belt (steel north lane, brick south lane) ----------------------->
//   row 1   two fast inserters per assembler, belt to assembler
//   rows 2-4  three assemblers (electric furnace)
//   row 5   one inserter (red circuits, belt to assembler) and one output inserter per assembler
//   row 6   red circuits (north lane) | electric furnaces (south lane) ---> turns north at the east edge;
//           a filter inserter lifts furnaces from its end into the chest above it (rows 4-5 / 3).
// West: steel side-loads a short riser from the west, brick from the east; the riser turns east into row 0,
// so each material keeps its own lane. Red circuits side-load row 6 from the north. The two free columns
// between the west strip and the first assembler hold the big electric pole (power port).
// Usage: node scripts/flight-science-sided/heavy-supplies/electric-furnace-supply/generate.mjs
import {findProfile,recipePlan,createBuilder,finish} from './supply-kit.mjs';

export const ID='electric-furnace-supply',PRODUCT='electric-furnace',TARGET=20;
const profile=await findProfile();
if(!profile)throw Error('Needs the flight-save prototype dump (SHA-256 33912441...): set FLIGHT_PROFILE or build .cache/flight-21');
const {raw,bytes}=profile,plan=recipePlan(raw,PRODUCT,TARGET);
const rate=Object.fromEntries(plan.inputs.map(i=>[i.item,i.perMinute]));
const b=createBuilder(),{belt,arm,machine,input,output}=b;
const N=0,E=4,S=8,W=12,last=plan.machines*3;
// Steel: one inlet tile side-loading the riser at (-3,1) from the west.
input('steel-plate',-4,1,rate['steel-plate'],[-4,0]);
for(const y of [3,2,1])belt(-3,y,N);
for(let x=-3;x<=last;x++)belt(x,0,E);
// Brick: east, up two tiles, then west into the riser's east side at (-3,2).
input('stone-brick',-4,4,rate['stone-brick'],[-4,3]);belt(-3,4,E);belt(-2,4,N);belt(-2,3,N);belt(-2,2,W);
// Red circuits: east, then south into the north side of row 6 (the tile behind it makes this a side-load).
input('advanced-circuit',-4,5,rate['advanced-circuit'],[-4,6]);belt(-3,5,E);belt(-2,5,S);
for(let x=-3;x<=last;x++)belt(x,6,E);
for(let i=0;i<plan.machines;i++){
 const cx=2+3*i;machine(PRODUCT,cx,3);
 arm(cx-1,1,N);arm(cx,1,N);           // steel and brick, picked from row 0
 arm(cx-1,5,S);                        // red circuits, picked from row 6
 arm(cx+1,5,N);                        // product onto row 6's south lane
}
belt(last+1,6,N);belt(last+1,5,N);output(PRODUCT,last+1,4,TARGET,[last+1,2],'south');
const description=`One inlet per material on the left (steel ${rate['steel-plate']}/min, stone brick ${rate['stone-brick']}/min, advanced circuits ${rate['advanced-circuit']}/min); collect ${TARGET} electric furnaces/min from the chest on the right. ${plan.machines} assembling machine 2 (electric furnace, ${plan.perMachinePerMinute}/min each), fast inserters, red belts, no modules, no circuit controls.`;
const {manifest}=await finish({id:ID,product:PRODUCT,target:TARGET,plan,builder:b,raw,rawBytes:bytes,description,layout:'Three assemblers in one row between a steel|brick lane-split belt (north) and a red-circuit|product belt (south).'});
console.log(JSON.stringify({id:ID,footprint:manifest.footprint,machines:manifest.machineCounts,inputs:manifest.inputs.map(i=>[i.item,i.perMinute]),construction:manifest.construction,blueprintSha256:manifest.blueprintSha256,status:manifest.status}));
