import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {transportWorkshopConfigs} from './transport-workshop-configs.mjs';
import {encodeBlueprint} from './blueprints.mjs';
import {makeTransportLoop} from './transport-loop-layout.mjs';
import {starterBounds} from './compact-starter-layout.mjs';

const root='blueprint-sources/transport-workshops';
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'.cache/factorio-vanilla/script-output/data-raw-dump.json'));
const catalog=JSON.parse(await fs.readFile('site/data/catalog.json'));
const names=new Map([...catalog.items,...catalog.fluids,...catalog.technologies].map(i=>[i.id,i.name]));
const rawOrder=['iron-ore','copper-ore','coal','stone','wood','water','crude-oil','tungsten-ore','calcite'];
const definitions=[['Yellow','','logistics'],['Red','fast-','logistics-2'],['Blue','express-','logistics-3'],['Green','turbo-','turbo-transport-belt']];
const closures=new Map();
function closure(id){if(!closures.has(id)){const result=new Set([id]);for(const p of raw.technology[id].prerequisites||[])for(const t of closure(p))result.add(t);closures.set(id,result);}return closures.get(id);}
const unlocks=new Map();
for(const [id,t]of Object.entries(raw.technology))for(const e of t.effects||[])if(e.type==='unlock-recipe'){const list=unlocks.get(e.recipe)||[];list.push(id);unlocks.set(e.recipe,list);}
const rawSet=new Set(rawOrder),manifest=[];
await fs.mkdir(root,{recursive:true});
for(const [order,[colour,prefix,unlock]]of definitions.entries()){
 if(transportWorkshopConfigs[colour].publicationStatus==='draft')continue;
 const id='transport-'+colour.toLowerCase(),products=['transport-belt','underground-belt','splitter'].map(p=>prefix+p);
 const selected=[],seen=new Set(),active=new Set();
 const special={'heavy-oil':'advanced-oil-processing','light-oil':'advanced-oil-processing','petroleum-gas':'advanced-oil-processing'};
 function visit(item){if(rawSet.has(item))return;visitRecipe(special[item]||item);}
 function visitRecipe(id){
  if(seen.has(id))return;if(active.has(id))throw Error('Recipe cycle: '+id);active.add(id);
  const r=raw.recipe[id];if(!r)throw Error('Missing recipe '+id);
  for(const i of r.ingredients)visit(i.name);
  active.delete(id);seen.add(id);selected.push(id);
 }
 products.forEach(visit);
 if(seen.has('advanced-oil-processing')){visitRecipe('light-oil-cracking');visitRecipe('solid-fuel-from-petroleum-gas');}
 const config=transportWorkshopConfigs[colour],recipes=config.recipes;
 assert.deepEqual([...new Set(recipes)].sort(),[...selected].sort(),colour+' must include the complete recipe chain');
 const inputs=rawOrder.filter(item=>item==='coal'||recipes.some(id=>raw.recipe[id].ingredients.some(i=>i.name===item)));
 const layout=makeTransportLoop({...config,recipes,products,raw,rawInputs:inputs});
 const machineCounts={};for(const id of recipes)machineCounts[id]=(machineCounts[id]||0)+1;
 const needed=new Set([unlock,'circuit-network','fast-inserter','automation-2','advanced-material-processing','electric-energy-distribution-1']);
 for(const recipe of new Set([...recipes,...layout.blueprint.entities.map(e=>e.name)]))if(raw.recipe[recipe]?.enabled===false){
  const options=unlocks.get(recipe);if(!options?.length)throw Error('No construction/recipe unlock for '+recipe);
  needed.add([...options].sort((a,b)=>closure(a).size-closure(b).size)[0]);
 }
 const requires=[...needed].filter(id=>![...needed].some(other=>id!==other&&closure(other).has(id)));
 const researchClosure=[...new Set([...needed].flatMap(id=>[...closure(id)]))].sort();
 const sideProducts=seen.has('solid-fuel-from-petroleum-gas')?['solid-fuel']:[];
 const surface={name:colour==='Green'?'Vulcanus':'Nauvis',properties:{pressure:colour==='Green'?4000:1000}};
 const setupNotes=[
  'Connect external electricity to the big electric pole marked P. Medium electric poles power the machines and inserters.',
  'Research '+requires.map(id=>names.get(id)||id.replaceAll('-',' ')).join(', ')+'. Circuit network is required for production: keep the green wires, belt reader and item limits intact.',
  'Feed only '+inputs.map(id=>names.get(id)||id).join(', ')+' at the labeled left-side ports. All smelting and intermediate products are made inside. No robots required.',
  ...layout.setupNotes,
  'Uses assembling machine 2, steel furnaces, yellow circulating belts and filtered fast inserters.'+(colour==='Green'?' Foundries handle molten iron, tungsten plates and the green transport recipes. Place this version on Vulcanus; its pressure is required for green transport production.':''),
  'The circulating belt shares ingredients between machines. '+machineCounts['iron-plate']+' iron furnaces supply the chain. The controls limit circulating stock and reserve ingredients for other recipes.',
  'Collect the three transport products from their separate numbered wooden chests. Each chest holds one stack. Empty it or connect an output belt to continue making that item.',
  ...(sideProducts.length?['Light oil is cracked to petroleum gas. Plastic and sulfur use it first; a controlled pump sends surplus to solid fuel. Collect the solid-fuel byproduct from chest 4 as well, so a full fuel chest does not eventually stop refining.']:[]),
  ...(colour==='Yellow'?['Yellow belts also feed underground belts and splitters internally. The belt output chest fills once the circulating supply has a reserve.']:[])
 ];
 layout.blueprint.label=colour+' transport workshop · from raw materials';
 layout.blueprint.description=[layout.blueprint.label,'Outputs: '+products.map(p=>names.get(p)).join(', '),...setupNotes].join('\n');
 const footprint=starterBounds(layout.blueprint.entities,raw);
 const info={id,file:id+'.txt',name:layout.blueprint.label,colour,order,products,sideProducts,author:'Factorio Command Center',sourceURL:'sources/transport-workshops/README.md',sourceTitle:'Original transport workshops',category:colour+' transport',kind:'production',rawOnly:true,workshop:true,requires,unlock,unlockName:names.get(unlock)||unlock,researchClosure,rawInputs:inputs,surface,setupNotes,changes:['Shared smelting and a controlled circulating belt feed all three transport outputs.','Every intermediate is made inside from raw resources.'],ports:layout.ports,recipes,machineCounts,layoutOptions:{...config,recipes:undefined},machineCount:layout.machineCount,inputDisplays:layout.inputDisplays,powerNetwork:{connection:'big-electric-pole',distribution:'medium-electric-pole',research:'electric-energy-distribution-1'},loopControl:layout.loopControl,footprint:{width:footprint.width,height:footprint.height}};
 await fs.writeFile(root+'/'+info.file,encodeBlueprint({blueprint:layout.blueprint})+'\n');manifest.push(info);
 console.log(colour+': '+info.footprint.width+'×'+info.footprint.height+', '+layout.machineCount+' machines, '+layout.blueprint.entities.length+' entities');
}
await fs.writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
