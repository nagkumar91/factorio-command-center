// Shared constants of the electric-smelter-pass-through family (generator, page, tests). No game data is read.
export const ID='electric-smelter-pass-through';
export const SOURCE={collection:'Autosaved',id:'autosaved-f3d991e31c13c301',name:'In-Out Electric Smelter',url:'https://autosaved.org/factorio/blueprints',file:'original/in-out-electric-smelter.txt'};
// Prototype numbers this design is sized by, from the official 2.1.24 Space Age data-raw dump (SHA-256 below).
// tests/electric-smelter-pass-through.test.mjs compares them with the dump when FACTORIO_RAW is set.
export const PROTOTYPE={
 sha256:'ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3',
 furnaceCraftingSpeed:2,
 recipeSeconds:{'iron-plate':3.2,'copper-plate':3.2,'stone-brick':3.2},
 beltItemsPerSecond:{'transport-belt':15,'fast-transport-belt':30},
 undergroundMaxDistance:{'underground-belt':5,'fast-underground-belt':7},
 substation:{wireReach:18,supplyAreaDistance:9},
 efficiencyModuleEffect:{consumption:-0.3},
 furnaceEnergyUsageKW:180,
 moduleSlots:2,
 // What turning one yellow part into its red kind costs (2.1.24 recipes: fast belt = 1 belt + 5 gears; 2 fast
 // undergrounds = 2 undergrounds + 40 gears; fast splitter = 1 splitter + 10 gears + 10 electronic circuits).
 redUpgradeExtra:{'transport-belt':{'iron-gear-wheel':5},'underground-belt':{'iron-gear-wheel':20},splitter:{'iron-gear-wheel':10,'electronic-circuit':10}},
 ironPlatesPerGear:2,
 moduleEffects:{
  'efficiency-module':{consumption:-0.3},'efficiency-module-2':{consumption:-0.4},'efficiency-module-3':{consumption:-0.5},
  'productivity-module':{productivity:0.04,consumption:0.4,pollution:0.05,speed:-0.05},
  'productivity-module-2':{productivity:0.06,consumption:0.6,pollution:0.07,speed:-0.1},
  'productivity-module-3':{productivity:0.1,consumption:0.8,pollution:0.1,speed:-0.15},
  'speed-module':{speed:0.2,consumption:0.5,quality:-0.01},'speed-module-2':{speed:0.3,consumption:0.6,quality:-0.015},'speed-module-3':{speed:0.5,consumption:0.7,quality:-0.025},
 },
};
// The module variants: the same 30 x 20 layout and ports, two modules of one kind requested in every furnace
// (or none). Every variant uses red belts, red underground belts and red splitters only (user request, 22 November
// 2026); speed variants also use fast inserters everywhere, because their plate rate passes what a basic inserter
// moves.
export const VARIANTS=[
 {id:'no-modules',label:'No modules',module:null},
 {id:'efficiency',label:'Efficiency modules',module:'efficiency-module'},
 {id:'productivity-one',label:'Productivity modules, tier one',module:'productivity-module'},
 {id:'productivity-two',label:'Productivity modules, tier two',module:'productivity-module-2'},
 {id:'productivity-three',label:'Productivity modules, tier three',module:'productivity-module-3'},
 {id:'speed-one',label:'Speed modules, tier one',module:'speed-module',fast:true},
 {id:'speed-two',label:'Speed modules, tier two',module:'speed-module-2',fast:true},
 {id:'speed-three',label:'Speed modules, tier three',module:'speed-module-3',fast:true},
];
export const MAIN_VARIANT='no-modules';
/** Computed (not measured) rates of one copy with two of `module` in each of the 24 furnaces. */
export function computedRates(module){
 const e=module?PROTOTYPE.moduleEffects[module]:{},n=module?PROTOTYPE.moduleSlots:0;
 // Factorio clamps the summed speed and consumption bonuses at -80% (20% of the base value).
 const speed=Math.max(0.2,1+n*(e.speed||0)),consumption=Math.max(0.2,1+n*(e.consumption||0)),productivity=n*(e.productivity||0);
 const craftsPerMinute=24*60*PROTOTYPE.furnaceCraftingSpeed*speed/PROTOTYPE.recipeSeconds['iron-plate'];
 const round=v=>Math.round(v*1000)/1000;
 return {speedMultiplier:round(speed),consumptionMultiplier:round(consumption),productivity:round(productivity),orePerMinute:round(craftsPerMinute),platesPerMinute:round(craftsPerMinute*(1+productivity)),
  furnacePowerKW:round(24*PROTOTYPE.furnaceEnergyUsageKW*consumption),copiesPerRedBelt:round(PROTOTYPE.beltItemsPerSecond['fast-transport-belt']*60/craftsPerMinute)};
}
// Tile sizes (width x height when facing north) of every entity in the blueprint.
export const SIZE={'electric-furnace':[3,3],substation:[2,2],roboport:[4,4],splitter:[2,1],'fast-splitter':[2,1]};
const E=4,W=12;
// Plain-text map of a blueprint's entities, one character per tile (row numbers from the top edge).
export function ascii(list){
 const A={0:'^',4:'>',8:'v',12:'<'},R={0:'A',4:'}',8:'V',12:'{'},g=new Map();
 for(const e of list){const d=e.direction||0;let [w,h]=SIZE[e.name]||[1,1];if(d===E||d===W)[w,h]=[h,w];
  const x0=Math.floor(e.position.x-w/2+.01),y0=Math.floor(e.position.y-h/2+.01);
  let c={'electric-furnace':'F',substation:'S',roboport:'R',splitter:'P','fast-splitter':'Q',inserter:'i','fast-inserter':'f'}[e.name];
  if(e.name==='transport-belt')c=A[d];if(e.name==='fast-transport-belt')c=R[d];
  if(/underground/.test(e.name))c=e.name.startsWith('fast')?(e.type==='input'?'U':'O'):(e.type==='input'?'u':'o');
  for(let i=0;i<w;i++)for(let j=0;j<h;j++)g.set((x0+i)+','+(y0+j),c);}
 const xs=[...g.keys()].map(k=>+k.split(',')[0]),ys=[...g.keys()].map(k=>+k.split(',')[1]),x0=Math.min(...xs),y0=Math.min(...ys);
 const rows=[];for(let y=y0;y<=Math.max(...ys);y++){let r='';for(let x=x0;x<=Math.max(...xs);x++)r+=g.get(x+','+y)||'.';rows.push(String(y-y0).padStart(3)+' '+r);}
 return rows.join('\n');
}
