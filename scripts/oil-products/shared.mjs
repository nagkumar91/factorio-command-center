// Shared constants of the oil-products family (generator, validator, tests). No game data is read here.
export const ID='oil-products';
// Prototype facts the design is sized and laid out by, from the official 2.1.24 Space Age data-raw dump (SHA-256
// below). tests/oil-products.test.mjs compares every one of them with the dump when it is installed; the generator
// does the same before it writes anything when the dump is readable.
export const PROTOTYPE={
 sha256:'ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3',
 craftingSpeed:{'oil-refinery':1,'chemical-plant':1},
 recipes:{
  'advanced-oil-processing':{seconds:5,in:{water:50,'crude-oil':100},out:{'heavy-oil':25,'light-oil':45,'petroleum-gas':55}},
  'heavy-oil-cracking':{seconds:2,in:{water:30,'heavy-oil':40},out:{'light-oil':30}},
  'light-oil-cracking':{seconds:2,in:{water:30,'light-oil':30},out:{'petroleum-gas':20}},
  'sulfur':{seconds:1,in:{water:30,'petroleum-gas':30},out:{sulfur:2}},
  'sulfuric-acid':{seconds:1,in:{sulfur:5,'iron-plate':1,water:100},out:{'sulfuric-acid':50}},
  'lubricant':{seconds:1,in:{'heavy-oil':10},out:{lubricant:10}},
 },
 storageTankVolume:25000,
 pumpPerTick:20,
 pipeToGroundMaxDistance:10,
 fastUndergroundBeltMaxDistance:7,
 circuitWireReach:{pump:9,'storage-tank':9},
 substation:{wireReach:18,supplyAreaDistance:9},
 energyUsageKW:{'oil-refinery':420,'chemical-plant':210,pump:29},
};
// Tile size (width x height facing north) of every entity used.
export const SIZE={'oil-refinery':[5,5],'chemical-plant':[3,3],'storage-tank':[3,3],pump:[1,2],substation:[2,2],pipe:[1,1],'pipe-to-ground':[1,1],
 'fast-transport-belt':[1,1],'fast-underground-belt':[1,1],'fast-inserter':[1,1],'display-panel':[1,1]};
// The size the planner chose: one copy serves one standard 30-per-minute science factory and its medium plastic
// supplier at the same time.
export const TARGET={'sulfuric-acid':500,lubricant:150,sulfur:15,gasForPlastic:6000,lightOutletScenario:660};
// Tank levels that gate cracking (pumps wired to the tanks): heavy oil is cracked only above this level in the heavy
// tank (protects lubricant), light oil only above this level in the light tank (protects the light-oil outlet).
export const THRESHOLD={'heavy-oil':10000,'light-oil':10000};
const R=PROTOTYPE.recipes;
const perMachine=(recipe,machine)=>60*PROTOTYPE.craftingSpeed[machine]/R[recipe].seconds; // crafts per minute
/** Flows of N refineries running flat out with all spare heavy and light oil cracked, every output drawn.
 * lightDrawn: light oil taken at the light outlet (not cracked); feedScale scales crude, water and iron together.
 * The acid figure follows the iron fed (one plate per 50 acid); lubricant and the sulfur belt keep their figures. */
export function flows(N,{lightDrawn=0,feedScale=1}={}){
 const r=N*perMachine('advanced-oil-processing','oil-refinery')*feedScale;
 const aop=R['advanced-oil-processing'],hc=R['heavy-oil-cracking'],lc=R['light-oil-cracking'],su=R.sulfur,sa=R['sulfuric-acid'],lu=R.lubricant;
 const acid=TARGET['sulfuric-acid']*feedScale,acidCrafts=acid/sa.out['sulfuric-acid'];
 const sulfur=acidCrafts*sa.in.sulfur+TARGET.sulfur,sulfurCrafts=sulfur/su.out.sulfur;
 const lubeCrafts=TARGET.lubricant/lu.out.lubricant,heavyForLube=lubeCrafts*lu.in['heavy-oil'];
 const heavy=r*aop.out['heavy-oil'],hcCrafts=(heavy-heavyForLube)/hc.in['heavy-oil'];
 const light=r*aop.out['light-oil']+hcCrafts*hc.out['light-oil'],lcCrafts=(light-lightDrawn)/lc.in['light-oil'];
 const gas=r*aop.out['petroleum-gas']+lcCrafts*lc.out['petroleum-gas'],gasForSulfur=sulfurCrafts*su.in['petroleum-gas'];
 const water=r*aop.in.water+hcCrafts*hc.in.water+lcCrafts*lc.in.water+sulfurCrafts*su.in.water+acidCrafts*sa.in.water;
 return {refineryCraftsPerMinute:r,crude:r*aop.in['crude-oil'],water,iron:acidCrafts*sa.in['iron-plate'],
  heavy,light,gas,heavyForLube,gasForSulfur,sulfurMade:sulfur,
  crafts:{'advanced-oil-processing':r,'heavy-oil-cracking':hcCrafts,'light-oil-cracking':lcCrafts,sulfur:sulfurCrafts,'sulfuric-acid':acidCrafts,lubricant:lubeCrafts},
  machinesExact:{'heavy-oil-cracking':hcCrafts/perMachine('heavy-oil-cracking','chemical-plant'),'light-oil-cracking':lcCrafts/perMachine('light-oil-cracking','chemical-plant'),
   sulfur:sulfurCrafts/perMachine('sulfur','chemical-plant'),'sulfuric-acid':acidCrafts/perMachine('sulfuric-acid','chemical-plant'),lubricant:lubeCrafts/perMachine('lubricant','chemical-plant')},
  outputs:{'petroleum-gas':gas-gasForSulfur,'sulfuric-acid':acid,lubricant:TARGET.lubricant,sulfur:TARGET.sulfur,'light-oil':lightDrawn}};
}
const round=(v,d=3)=>Math.round(v*10**d)/10**d;
const roundAll=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,typeof v==='number'?round(v):v&&typeof v==='object'?roundAll(v):v]));
/** The sizing arithmetic: refineries needed (exact and rounded up), machine counts, inputs, exports and trades. */
export function design(){
 const zero=flows(0),one=flows(1),need=TARGET.gasForPlastic+zero.gasForSulfur;
 const refineriesExact=(need-zero.gas)/(one.gas-zero.gas),refineries=Math.ceil(refineriesExact-1e-9);
 const full=flows(refineries),light=flows(refineries,{lightDrawn:TARGET.lightOutletScenario}),feed80=flows(refineries,{feedScale:0.8});
 const machines={'oil-refinery':refineries};for(const [k,v] of Object.entries(full.machinesExact))machines[k]=Math.ceil(v-1e-9);
 return roundAll({gasPerRefineryWithCracking:one.gas-zero.gas,gasOffsetPerCopy:zero.gas,gasNeeded:need,refineriesExact,refineries,machines,
  chemicalPlants:Object.entries(machines).filter(([k])=>k!=='oil-refinery').reduce((a,[,v])=>a+v,0),
  full,gasExport:full.outputs['petroleum-gas'],gasSurplus:full.outputs['petroleum-gas']-TARGET.gasForPlastic,
  lightOutlet:{lightDrawn:TARGET.lightOutletScenario,gasExport:light.outputs['petroleum-gas'],gasLost:full.outputs['petroleum-gas']-light.outputs['petroleum-gas'],water:light.water},
  feed80:{crude:feed80.crude,water:feed80.water,iron:feed80.iron,outputs:feed80.outputs}});
}
// What the library takes per minute (read-only survey of the library, 2026-11-22, .claude/tmp-factorio-fluids/demand-survey.json):
// pipes for acid, lubricant and light oil, a belt for sulfur; plastic suppliers take 10 petroleum gas per bar.
export const SURVEY=[
 {family:'flight-science-sided/full',id:'six-pack-integrated-60',name:'Six-pack science, fully integrated, 60/min each',acid:1000,lubricant:300,sulfur:30},
 {family:'flight-robots',id:'robots-10-roboport-1',name:'Robots 10/min + roboport 1/min',acid:800,lubricant:300,mode:'capped'},
 {family:'robot-logistics-workshop',id:'robot-logistics-workshop',name:'Robot logistics workshop',acid:800,lubricant:300,mode:'capped'},
 {family:'rgby-science',id:'rgby-science-30',name:'Four-pack science 30/min each (and the 15- and 30-lab versions)',acid:500,lubricant:150,sulfur:15},
 {family:'five-science',id:'five-science-30',name:'Five-pack science 30/min each (and the 15- and 30-lab versions)',acid:500,lubricant:150,sulfur:15},
 {family:'six-science',id:'six-science',name:'Six-pack science 30/min each (from supplied circuits)',acid:500,lubricant:150,sulfur:15},
 {family:'robot-essentials',id:'robot-essentials',name:'Robot essentials (half-rate robot workshop)',acid:400,lubricant:150,mode:'capped'},
 {family:'processing-units',id:'processing-units',name:'Processing-unit supplier (unpublished branch)',acid:135},
 {family:'launch-kit',id:'launch-kit',name:'Space launch kit (one-off)',acid:38,lubricant:82,mode:'capped'},
 {family:'rocket-supplies',id:'rocket-supplies',name:'Rocket supplies',acid:25},
 {family:'flight-science',id:'rgb-60',name:'Science RGB 60/min (and RGB + military)',sulfur:30},
 {family:'flight-science-sided/hybrid',id:'hybrid-six-pack-sided-60',name:'Six-pack science, hybrid and compact sided, 60/min each',sulfur:30},
 {family:'rocket-fuel-supplier',id:'rocket-fuel-supplier',name:'Rocket-fuel supplier',light:660},
 {family:'requested-malls/blue-tier-mall',id:'blue-tier-mall',name:'Blue-tier mall (on demand, no figure published)',lubricant:null,mode:'capped'},
 {family:'plastic-supplier',id:'small',name:'Plastic supplier, 240 bars/min (designed in parallel)',gas:2400},
 {family:'plastic-supplier',id:'medium',name:'Plastic supplier, 600 bars/min (designed in parallel)',gas:6000},
 {family:'plastic-supplier',id:'large',name:'Plastic supplier, 1,200 bars/min (designed in parallel)',gas:12000},
];
/** Copies of this supplier a consumer needs at the panel figures of one copy. */
export function copiesNeeded(row,panel){
 const need=[['acid','sulfuric-acid'],['lubricant','lubricant'],['sulfur','sulfur'],['gas','petroleum-gas'],['light','light-oil']]
  .filter(([k])=>row[k]>0).map(([k,item])=>({item,perMinute:row[k],copies:Math.ceil(row[k]/panel[item]-1e-9)}));
 return {by:need,copies:need.length?Math.max(...need.map(n=>n.copies)):null};
}
