// Generate the raw-input electric-furnace power collection.  The three
// blueprint entries share the same compact raw production approach.  The two
// solar entries retain the three-product Solar (AM2)/(AM3) scope from the
// existing community blueprints: accumulator, solar panel and substation.
import fs from 'node:fs/promises';
import path from 'node:path';
import {decodeBlueprint,encodeBlueprint} from './blueprints.mjs';
import {addInputDisplays} from './starter-input-displays.mjs';
import {makePowerLayout} from './power-workshop-layout.mjs';

const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'.cache/factorio-vanilla/script-output/data-raw-dump.json'));
const catalog=JSON.parse(await fs.readFile('site/data/catalog.json'));
const outRoot=path.resolve(process.cwd(),process.env.POWER_WORKSHOP_OUT||'.cache/power-workshops/blueprint-sources/power-workshops');
await fs.rm(outRoot,{recursive:true,force:true});await fs.mkdir(outRoot,{recursive:true});

const powerProducts=['medium-electric-pole','big-electric-pole','substation'];
// Substations force these two raw inputs: vanilla advanced circuits require
// coal and petroleum gas, and petroleum gas requires crude oil.  Omitting
// either would import a processed intermediate, so the manifest calls this
// out explicitly rather than hiding it in the source.
const powerRawInputs=new Set(['iron-ore','copper-ore','coal','crude-oil']);
const specialRecipe={ 'petroleum-gas':'basic-oil-processing' };
const selectRecipe=item=>raw.recipe[specialRecipe[item]||item];
function recipeChainMany(products,rawInputs){
 const nodes=[],seen=new Set(),active=new Set();
 function visit(item){
  if(rawInputs.has(item)||seen.has(item))return;
  if(active.has(item))throw Error('Recipe cycle: '+item);
  const recipe=selectRecipe(item);if(!recipe)throw Error('No recipe: '+item);
  active.add(item);for(const i of Object.values(recipe.ingredients||{}))visit(i.name);
  active.delete(item);seen.add(item);nodes.push({item,recipe});
 }
 for(const product of products)visit(product);
 return nodes;
}
function closure(id,seen=new Set()){
 if(seen.has(id))return seen;seen.add(id);
 for(const pre of raw.technology?.[id]?.prerequisites||[])closure(pre,seen);
 return seen;
}
const powerRoots=['electric-energy-distribution-2','advanced-material-processing-2','automation-2','logistics','circuit-network','oil-processing','plastics','advanced-circuit'];
const powerTech=new Set();for(const id of powerRoots)for(const t of closure(id))powerTech.add(t);
const powerNodes=recipeChainMany(powerProducts,powerRawInputs);
const powerSetup=[
 'Connect external electricity to the big electric pole marked P. Medium poles distribute power to every electric furnace, assembler, inserter, refinery and chemical plant.',
 'Feed Iron ore, Copper ore, Coal and Crude oil into the labeled west entrances. Coal and crude oil are required by the vanilla advanced-circuit chain used for substations; no plates, circuits, gears or plastic are imported.',
 'All smelting uses electric furnaces. The three output chests are independent: Medium electric pole, Big electric pole and Substation.',
 'Input display panels are static optional signs and require Circuit network research to build. Empty each output chest when full so production can resume.'
];
const displayLabels=new Map([['iron-ore','A · Iron ore'],['copper-ore','B · Copper ore'],['coal','C · Coal'],['crude-oil','D · Crude oil']]);
function bounds(entities){
 const xs=entities.map(e=>e.position.x),ys=entities.map(e=>e.position.y);
 return {width:Math.max(...xs)-Math.min(...xs)+1,height:Math.max(...ys)-Math.min(...ys)+1};
}
function portLabels(ports){for(const p of ports)if(p.kind==='input'||p.kind==='fluid')p.label=displayLabels.get(p.items[0])||p.items[0];}
function powerInfo(entities){return {connection:'big-electric-pole',distribution:'medium-electric-pole',research:'electric-energy-distribution-1',bigPoles:entities.filter(e=>e.name==='big-electric-pole').length,mediumPoles:entities.filter(e=>e.name==='medium-electric-pole').length};}
function prototypeFor(name){for(const type of ['electric-pole','furnace','assembling-machine','chemical-plant','oil-refinery','inserter','pipe','pipe-to-ground','transport-belt','underground-belt','splitter','container'])if(raw[type]?.[name])return raw[type][name];return null;}
function boxAt(entity,name=entity.name){const p=prototypeFor(name),box=p?.collision_box||p?.selection_box;return box&&[[entity.position.x+box[0][0],entity.position.y+box[0][1]],[entity.position.x+box[1][0],entity.position.y+box[1][1]]];}
function overlaps(a,b){const aa=boxAt(a),bb=boxAt(b);return aa&&bb&&aa[0][0]<bb[1][0]&&aa[1][0]>bb[0][0]&&aa[0][1]<bb[1][1]&&aa[1][1]>bb[0][1];}
function promotePoleGrid(layout){
 const entities=layout.blueprint.entities,saved=entities.filter(e=>e.name==='small-electric-pole');
 if(saved.length<2)throw Error('Power layout needs a big and medium pole');
 for(const pole of saved)pole.name='medium-electric-pole';
 const candidate=saved.find(p=>{const moved={...p,name:'big-electric-pole',position:{x:Math.round(p.position.x),y:Math.round(p.position.y)}};return !entities.some(e=>e!==p&&overlaps(moved,e));});
 if(!candidate)throw Error('No collision-free integer position for big electric pole');
 candidate.name='big-electric-pole';candidate.position.x=Math.round(candidate.position.x);candidate.position.y=Math.round(candidate.position.y);
 const port=layout.ports.find(p=>p.kind==='power');port.x=candidate.position.x;port.y=candidate.position.y;port.entity=candidate.entity_number;
 return candidate;
}
function sourceInfo({id,file,name,products,rawInputs,ports,entities,recipes,researchClosure,requires,setupNotes,changes,compaction,fuelPolicy}){
 return {id,file,name,author:'Factorio Command Center',sourceURL:'sources/power-workshops/README.md',sourceTitle:'Raw-input electric power workshops',category:'Power workshops',kind:'production',workshop:true,rawOnly:true,order:id==='power-poles-substation'?1:id==='solar-raw-am2'?2:3,requires,unlock:requires[0],unlockName:requires[0],researchClosure,products,rawInputs,rawOnly:true,setupNotes,changes,ports,recipes,machineCount:entities.filter(e=>['electric-furnace','assembling-machine-2','assembling-machine-3','chemical-plant','oil-refinery'].includes(e.name)).length,inputDisplays:{optional:true,requiredTechnology:'circuit-network'},compaction,powerNetwork:powerInfo(entities),fuelPolicy};
}

let powerLayout,powerAttempt,error;
const powerAttempts=process.env.POWER_ATTEMPT?[Number(process.env.POWER_ATTEMPT)]:Array.from({length:192},(_,i)=>i);
for(const attempt of powerAttempts){try{powerLayout=makePowerLayout({products:powerProducts,nodes:powerNodes,raw,technologies:powerTech,attempt});powerAttempt=attempt;break;}catch(e){error=e.message;}}
if(!powerLayout)throw Error('No power layout candidate: '+error);
// The layout helper uses small poles while searching. Promote the saved grid
// to the required tiers after routing; its wire graph stays unchanged.
promotePoleGrid(powerLayout);
const rawPorts=powerLayout.ports.filter(p=>p.kind==='input'||p.kind==='fluid').sort((a,b)=>a.y-b.y);
powerLayout.ports=[...rawPorts,...powerLayout.ports.filter(p=>p.kind==='power'||p.kind==='output')];
portLabels(powerLayout.ports);const powerDisplays=addInputDisplays(powerLayout.blueprint,{ports:powerLayout.ports,setupNotes:powerSetup});
powerLayout.blueprint.label='Raw electric power poles and substation';
powerLayout.blueprint.description=`Compact raw-input workshop, placement attempt ${powerAttempt}. Electric furnaces smelt all plates; substations include the internal coal/crude advanced-circuit chain.`;
const powerEntities=powerLayout.blueprint.entities;
const powerBounds=bounds(powerEntities);
const powerInfoEntry=sourceInfo({id:'power-poles-substation',file:'power-poles-substation.txt',name:powerLayout.blueprint.label,products:powerProducts,rawInputs:[...powerRawInputs],ports:powerLayout.ports,entities:powerEntities,recipes:powerNodes.map(n=>specialRecipe[n.item]||n.recipe.name),researchClosure:[...powerTech].sort(),requires:powerRoots,setupNotes:powerDisplays.setupNotes,changes:['One shared compact layout makes medium poles, big poles and substations from raw inputs.','Electric furnaces replace burner fuel; coal and crude remain explicit raw ports because vanilla plastic requires both.'],compaction:{before:powerBounds,after:powerBounds,cuts:{columns:0,rows:0}},fuelPolicy:{furnaceFuel:'electricity'}});
await fs.writeFile(path.join(outRoot,powerInfoEntry.file),encodeBlueprint({blueprint:powerLayout.blueprint})+'\n');

// The website's original Solar entries are deliberately looked up by stable
// ID rather than by name.  This preserves provenance even though the raw
// versions are regenerated as a self-contained workshop.
const community=JSON.parse(await fs.readFile('site/data/community.json'));
const originalSolars={
 am2:community.blueprints.find(x=>x.id==='autosaved-614f2f4c2ed1acc9'),
 am3:community.blueprints.find(x=>x.id==='autosaved-7ebdfc78270f2c20')
};
for(const [tier,original] of Object.entries(originalSolars))if(!original)throw Error(`Missing community Solar ${tier}`);
const solarProducts=['accumulator','solar-panel','substation'];
// Battery/sulfuric-acid production adds water. Coal and crude oil are also
// required: advanced circuits need plastic, and vanilla plastic needs both.
const solarRawInputs=new Set(['iron-ore','copper-ore','coal','water','crude-oil']);
const solarRoots=['solar-energy','electric-energy-accumulators','advanced-material-processing-2','electric-energy-distribution-2','automation-2','circuit-network','logistics','oil-processing','plastics','advanced-circuit','battery'];
const solarNodes=recipeChainMany(solarProducts,solarRawInputs);
const solarTech=new Set();for(const id of solarRoots)for(const t of closure(id))solarTech.add(t);
const solarSetup=[
 'Connect external electricity to P. The saved medium poles distribute power to every electric furnace, assembler, inserter, refinery and chemical plant.',
 'Feed Iron ore, Copper ore, Coal, Water and Crude oil into the labeled west entrances. Water, coal and crude are required by the internal battery/plastic/advanced-circuit chains; no plates, circuits, batteries or plastic are imported.',
 'The three output chests are independent: Accumulator, Solar panel and Substation. Empty each chest when full so production can resume.',
 'This is a raw-input regeneration of Solar (AM2)/(AM3), preserving their three-output product scope and recipe families while using electric furnaces.'
];
function solarVariant(tier){
 const assembler=tier==='am3'?'assembling-machine-3':'assembling-machine-2';
 const variantTech=new Set(solarTech);if(tier==='am3')for(const t of closure('automation-3'))variantTech.add(t);
 const attempts=process.env.POWER_ATTEMPT?[Number(process.env.POWER_ATTEMPT)]:Array.from({length:192},(_,i)=>i);
 let layout,attempt,error;
 for(const candidate of attempts){try{layout=makePowerLayout({products:solarProducts,nodes:solarNodes,raw,technologies:variantTech,attempt:candidate,assembler,intermediateAssembler:assembler});attempt=candidate;break;}catch(e){error=e.message;}}
 if(!layout)throw Error(`No Solar ${tier} layout candidate: ${error}`);
 promotePoleGrid(layout);
 const ports=layout.ports.filter(p=>p.kind==='input'||p.kind==='fluid').sort((a,b)=>a.y-b.y);
 layout.ports=[...ports,...layout.ports.filter(p=>p.kind==='power'||p.kind==='output')];
 portLabels(layout.ports);const displays=addInputDisplays(layout.blueprint,{ports:layout.ports,setupNotes:solarSetup.slice()});
 const blueprint=layout.blueprint;
 blueprint.label=`${originalSolars[tier].name} · raw electric workshop`;
 blueprint.description=`Raw-input copy of ${originalSolars[tier].name}; accumulator, solar panel and substation outputs are made internally from ore, fluids and coal. Electric furnaces replace all imported plate/burner supply. Source: ${originalSolars[tier].sourceURL}.`;
 const entities=blueprint.entities,bb=bounds(entities),id=`solar-raw-${tier}`,file=`${id}.txt`;
 const original=originalSolars[tier];
 const originalDecoded=decodeBlueprint(original.code).blueprint;
 const originalCounts={};for(const e of originalDecoded.entities||[])originalCounts[e.name]=(originalCounts[e.name]||0)+1;
 const changes=[
  `Copied product scope and recipe family from ${original.name} (${original.id}) at ${original.sourceURL}.`,
  'Regenerated the layout as a raw-input workshop with ore, coal, water and crude-oil entrances; processed plates, circuits, batteries, plastic and sulfuric acid are internal.',
  'Replaced every smelting stage with electric-furnace production and removed burner-fuel assumptions.',
  tier==='am3'?'Kept assembling-machine-3 for final and intermediate assembly stages.':'Kept assembling-machine-2 for final and intermediate assembly stages.',
  `Original imported entity profile: ${JSON.stringify(originalCounts)}.`
 ];
 const requires=tier==='am3'?[...solarRoots,'automation-3'] : solarRoots;
 const info=sourceInfo({id,file,name:blueprint.label,products:solarProducts,rawInputs:[...solarRawInputs],ports:layout.ports,entities,recipes:solarNodes.map(n=>specialRecipe[n.item]||n.recipe.name),researchClosure:[...variantTech].sort(),requires,setupNotes:displays.setupNotes,changes,compaction:{before:{width:Math.max(...originalDecoded.entities.map(e=>e.position.x))-Math.min(...originalDecoded.entities.map(e=>e.position.x))+1,height:Math.max(...originalDecoded.entities.map(e=>e.position.y))-Math.min(...originalDecoded.entities.map(e=>e.position.y))+1,entities:originalDecoded.entities.length},after:bb,cuts:{columns:0,rows:0},originalId:original.id},fuelPolicy:{furnaceFuel:'electricity'}});
 info.sourceURL=original.sourceURL;info.sourceTitle=`${original.name} · ${original.sourceURL}`;info.sourceId=original.id;info.inputDisplays={optional:true,requiredTechnology:'circuit-network'};info.powerNetwork=powerInfo(entities);info.powerAttempt=attempt;info.originalProductScope=solarProducts;
 return {blueprint,info,file};
}
const solarVariants=['am2','am3'].map(solarVariant);
for(const variant of solarVariants)await fs.writeFile(path.join(outRoot,variant.file),encodeBlueprint({blueprint:variant.blueprint})+'\n');
const entries=[powerInfoEntry,...solarVariants.map(x=>x.info)];
await fs.writeFile(path.join(outRoot,'manifest.json'),JSON.stringify(entries,null,2)+'\n');
await fs.writeFile(path.join(outRoot,'README.md'),'# Raw electric power workshops\n\nGenerated by `scripts/generate-power-workshops.mjs`. The pole/substation entry exposes coal and crude oil because vanilla plastic is needed for advanced circuits. Solar AM2 and Solar AM3 retain the original three-product scope (accumulator, solar panel, substation), with water, coal and crude oil exposed for their internal battery/plastic chains. All smelting entities are electric furnaces and all processed ingredients are made inside the blueprint.\n');
console.log(JSON.stringify(entries.map(e=>({id:e.id,file:e.file,products:e.products,rawInputs:e.rawInputs,entities:e.machineCount,footprint:e.compaction.after,ports:e.ports.length})),null,2));
