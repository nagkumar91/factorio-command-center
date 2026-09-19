import fs from 'node:fs/promises';
import {encodeBlueprint} from './blueprints.mjs';
import {recipeChain,makeRawLayout} from './raw-starter-layout.mjs';
import {addInputDisplays} from './starter-input-displays.mjs';
import {starterMachineFor,starterMachineResearch,starterMachineNote} from './starter-machines.mjs';
import {compactStarterLayout,starterBounds,starterPowerNote,starterConnectionNote} from './compact-starter-layout.mjs';
import {applySavedCorridorOptimization} from './saved-corridor-optimizations.mjs';
const root=process.env.EARLY_GAME_OUTPUT_ROOT||'blueprint-sources/early-game';
await fs.mkdir(root,{recursive:true});
let corridorOptimizations=[];
try{corridorOptimizations=JSON.parse(await fs.readFile(process.env.EARLY_GAME_CORRIDOR_OPTIMIZATIONS||'blueprint-sources/early-game/corridor-optimizations.json')).optimizations;}catch(error){if(error.code!=='ENOENT')throw error;}
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'.cache/factorio-vanilla/script-output/data-raw-dump.json'));
const catalog=JSON.parse(await fs.readFile('site/data/catalog.json'));
const names=new Map([...catalog.items,...catalog.fluids,...catalog.technologies].map(i=>[i.id,i.name]));
const name=id=>names.get(id)||id.replaceAll('-',' ');
const rawInputs=new Set(['iron-ore','copper-ore','coal','stone','wood','water','crude-oil']);
const science=new Set(['automation-science-pack','logistic-science-pack']);
const reachable=new Set();
for(let pass=0;pass<100;pass++)for(const t of Object.values(raw.technology)){
 if(t.hidden||(t.prerequisites||[]).some(id=>!reachable.has(id)))continue;
 if(t.unit&&Object.values(t.unit.ingredients).some(i=>!science.has(i[0]||i.name)))continue;
 reachable.add(t.name);
}
const closures=new Map();
function closure(id){
 if(closures.has(id))return closures.get(id);
 const result=new Set([id]);for(const p of raw.technology[id].prerequisites||[])for(const t of closure(p))result.add(t);
 closures.set(id,result);return result;
}
const cost=id=>[...closure(id)].reduce((n,id)=>n+(raw.technology[id].unit?.count||0),0);
const unlocks=new Map();
for(const id of reachable)for(const e of raw.technology[id].effects||[])if(e.type==='unlock-recipe'){
 const list=unlocks.get(e.recipe)||[];list.push(id);unlocks.set(e.recipe,list.sort((a,b)=>cost(a)-cost(b)||a.localeCompare(b)));
}
const available=r=>r&&!r.hidden&&!r.parameter&&(r.enabled!==false||unlocks.has(r.name));
const special={'petroleum-gas':'basic-oil-processing','solid-fuel':'solid-fuel-from-petroleum-gas'};
function selectRecipe(item){
 const r=raw.recipe[special[item]||item];
 return available(r)&&Object.values(r.results||{}).some(p=>p.name===item)?r:undefined;
}
const products=[...new Set([...catalog.items.map(i=>i.id),'petroleum-gas','sulfuric-acid'])].filter(id=>!rawInputs.has(id)&&selectRecipe(id));
const candidates=[],excluded=[];
for(const product of products){
 try{
  const nodes=recipeChain(product,raw,rawInputs,selectRecipe);
  const needed=new Set([nodes.every(n=>n.recipe.category==='smelting')?'electronics':'automation']);
  needed.add('electric-energy-distribution-1');
  const primary=unlocks.get(selectRecipe(product).name)?.[0]||'automation';
  for(const n of nodes)if(n.recipe.enabled===false)needed.add(unlocks.get(n.recipe.name).find(id=>closure(primary).has(id))||unlocks.get(n.recipe.name)[0]);
  const consumers=new Map();
  for(const n of nodes)for(const i of Object.values(n.recipe.ingredients||{}))if(i.type!=='fluid'&&!rawInputs.has(i.name))consumers.set(i.name,(consumers.get(i.name)||0)+1);
  if([...consumers.values()].some(count=>count>1))needed.add('logistics');
  for(const node of nodes){const technology=starterMachineResearch[starterMachineFor(node.recipe,raw)];if(technology)needed.add(technology);}
  const technology=new Set();for(const id of needed)for(const t of closure(id))technology.add(t);
  const stage=[...needed].sort((a,b)=>cost(b)-cost(a))[0];
  candidates.push({product,nodes,needed,technology,stage});
 }catch(e){excluded.push({product,reason:e.message});}
}
const stages=[...new Set(candidates.map(c=>c.stage))].sort((a,b)=>cost(a)-cost(b)||a.localeCompare(b));
const manifest=[];
const failures=[];
const only=process.env.STARTER_PRODUCTS?.split(',');
// Military's three-way iron-plate fanout needs a recipe-aware first outlet;
// keep all other modules on the original attempt order and routing defaults.
for(const c of candidates.sort((a,b)=>stages.indexOf(a.stage)-stages.indexOf(b.stage)||a.product.localeCompare(b.product))){
 if(only&&!only.includes(c.product))continue;
 const militaryPriority=c.product==='military-science-pack'?{'iron-plate':['grenade','steel-plate','firearm-magazine']}:undefined;
 let layout,error,extraLogistics=false;
 // This dense, four-ingredient chain needs wider routing lanes. Start at its
 // known working placement, then retain the normal deterministic fallbacks.
 const attempts=[...(c.product==='bulk-inserter'?[199]:[]),...(c.product==='military-science-pack'?[186]:Array.from({length:192},(_,i)=>i))];
 for(const attempt of attempts){
  try{layout=makeRawLayout({...c,raw,technologies:c.technology,attempt,consumerPriority:militaryPriority});break;}catch(e){error=e.message;}
 }
 if(!layout&&!c.technology.has('logistics')){
  for(const t of closure('logistics'))c.technology.add(t);c.needed.add('logistics');extraLogistics=true;
  for(const attempt of attempts){try{layout=makeRawLayout({...c,raw,technologies:c.technology,attempt,consumerPriority:militaryPriority});break;}catch(e){error=e.message;}}
 }
 if(!layout){failures.push({product:c.product,error});console.error('FAILED '+c.product+': '+error);continue;}
 c.stage=[...c.needed].sort((a,b)=>cost(b)-cost(a))[0];
 const stageNumber=stages.indexOf(c.stage)+1;
 const id='early-raw-'+c.product,file=id+'.txt';
 const inputs=layout.ports.filter(p=>p.kind==='input'||p.kind==='fluid').map(p=>p.items[0]);
 for(const port of layout.ports)if(['input','fluid'].includes(port.kind))port.label=String.fromCharCode(65+[...rawInputs].indexOf(port.items[0]))+' · '+name(port.items[0]);
 const requires=[...c.needed].filter(id=>![...c.needed].some(other=>other!==id&&closure(other).has(id)));
 const setupNotes=[
  starterPowerNote,
  starterMachineNote(layout.blueprint.entities),
  'Feed only '+inputs.map(name).join(', ')+' into the labeled entrances on the left. Solid inputs use separate yellow belts; fluids use the marked pipe entrances.',
  raw.fluid[c.product]?'Collect '+name(c.product)+' from the marked output pipe. Keep the output flowing or connect your own storage.':'Collect '+name(c.product)+' from the marked wooden output chest. Its one-stack limit stops production when full; empty it or attach a belt to resume.',
  'Place another independent module after its listed research unlock. Keep its raw feeds and power supplied; no plates, circuits, gears, robots, or advanced-quality equipment are external inputs.',
  starterConnectionNote,
  ...(inputs.includes('wood')?['Wood is a raw input for this recipe; bring it from trees.']:[]),
  ...(inputs.includes('crude-oil')?['This oil-stage module takes raw crude oil and includes basic refining.']:[]),
  ...(extraLogistics?['Also unlock Logistics for the yellow underground belt crossings in this compact layout.']:[])
 ];
 if(c.product!=='military-science-pack'){
  layout.blueprint.label=name(c.product)+' · from raw materials';
  layout.blueprint.description=['Original modular early-game design for Factorio 2.0.77 / Space Age.','Unlock: '+requires.map(name).join(', '),...setupNotes].join('\n');
 }
 const displays=addInputDisplays(layout.blueprint,{ports:layout.ports,setupNotes});
 if(c.product==='military-science-pack'){
  layout.blueprint.label='Military science pack · raw layout candidate 186';
  layout.blueprint.description='Scratch candidate from makeRawLayout attempt 186; all intermediates are internal and all raw ports remain west-facing.';
 }
 const compaction=compactStarterLayout(layout.blueprint,layout.ports,raw);
 const corridorOptimization=corridorOptimizations.find(entry=>entry.id===id);
 layout.blueprint=applySavedCorridorOptimization(layout.blueprint,corridorOptimization);
 // Saved corridor edits can remove a complete edge row after the normal
 // compaction pass. Keep the published footprint metadata tied to the final
 // tested entity geometry.
 if(corridorOptimization){
  const finalBounds=starterBounds(layout.blueprint.entities,raw);
  compaction.after={width:finalBounds.width,height:finalBounds.height};
 }
 await fs.writeFile(root+'/'+file,encodeBlueprint({blueprint:layout.blueprint})+'\n');
 manifest.push({id,file,name:layout.blueprint.label,author:'Factorio Command Center',sourceURL:'sources/early-game/README.md',sourceTitle:'Original raw-material research modules',category:String(stageNumber).padStart(2,'0')+' · '+name(c.stage),kind:'production',order:manifest.length+1,requires,unlock:c.stage,unlockName:name(c.stage),researchClosure:[...c.technology].sort(),products:[c.product],rawInputs:inputs,rawOnly:true,setupNotes,changes:['Original layout generated from the installed vanilla recipes and research tree.','All intermediates are manufactured inside. One dedicated output keeps each module independent.'],ports:layout.ports,recipes:c.nodes.map(n=>n.recipe.name),machineCount:layout.machines});
 Object.assign(manifest.at(-1),{inputDisplays:displays.inputDisplays,setupNotes:displays.setupNotes,compaction,powerNetwork:{connection:'big-electric-pole',distribution:'medium-electric-pole',research:'electric-energy-distribution-1'}});
 if(corridorOptimization){
  manifest.at(-1).changes.push(`Verified belt-corridor revision removes ${corridorOptimization.beltsSaved} yellow belts while preserving machines, ports, underground endpoints and power.`);
  manifest.at(-1).reviewReport='sources/early-game/REVIEW.md';
 }
 console.log(c.product+': '+layout.machines+' machines, '+layout.blueprint.entities.length+' entities'+(extraLogistics?' (+Logistics)':''));
}
manifest.sort((a,b)=>stages.indexOf(a.unlock)-stages.indexOf(b.unlock)||a.products[0].localeCompare(b.products[0]));
manifest.forEach((entry,i)=>entry.order=i+1);
await fs.mkdir('.cache/early-game',{recursive:true});
await fs.writeFile('.cache/early-game/generation.json',JSON.stringify({manifest,failures},null,2)+'\n');
if(failures.length)throw Error(failures.length+' layouts still need routes: '+failures.map(f=>f.product).join(', '));
await fs.writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const research={version:catalog.version,scope:'Nauvis recipes reachable with red and green science; later science requirements are excluded. Crude oil and wood are raw inputs where needed. Power is always external.',rawInputs:[...rawInputs],expectedProducts:candidates.map(c=>c.product).sort(),foundation:['automation-2','advanced-material-processing','electric-energy-distribution-1','logistics'],stages:stages.map((id,i)=>({id,name:name(id),order:i+1,prerequisites:raw.technology[id].prerequisites||[],science:raw.technology[id].unit?.ingredients||[],trigger:raw.technology[id].research_trigger,modules:manifest.filter(b=>b.unlock===id).map(b=>b.id)})),excluded,statOnly:[...reachable].filter(id=>!(raw.technology[id].effects||[]).some(e=>e.type==='unlock-recipe')).map(id=>({id,name:name(id)}))};
await fs.writeFile(root+'/research.json',JSON.stringify(research,null,2)+'\n');
console.log('Prepared '+manifest.length+' independent raw-input modules across '+stages.length+' research stages.');
