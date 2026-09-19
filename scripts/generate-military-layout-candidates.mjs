// Bounded scratch search over the existing raw-layout generator. This keeps
// the layout engine unchanged and only emits isolated candidates for native
// review; it never writes the canonical early-game source.
import fs from 'node:fs/promises';
import path from 'node:path';
import {encodeBlueprint} from './blueprints.mjs';
import {recipeChain,makeRawLayout} from './raw-starter-layout.mjs';
import {addInputDisplays} from './starter-input-displays.mjs';
import {starterMachineFor,starterMachineResearch} from './starter-machines.mjs';
import {compactStarterLayout} from './compact-starter-layout.mjs';

const cwd=process.cwd();
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'/Users/nagkumar/clawd/workspaces/factorio-command-center/.cache/factorio-vanilla/script-output/data-raw-dump.json'));
const product='military-science-pack';
const rawInputs=new Set(['iron-ore','copper-ore','coal','stone','wood','water','crude-oil']);
const science=new Set(['automation-science-pack','logistic-science-pack']);
const consumerPriority=product==='military-science-pack'?{'iron-plate':['grenade','steel-plate','firearm-magazine']}:undefined;
const baseline=JSON.parse(await fs.readFile('/Users/nagkumar/clawd/workspaces/factorio-command-center/blueprint-sources/early-game/manifest.json','utf8')).find(x=>x.id==='early-raw-military-science-pack');
const rawNames=Object.fromEntries(Object.values(raw.item||{}).map(x=>[x.name,x.name]));
const reachable=new Set();
for(let pass=0;pass<100;pass++)for(const t of Object.values(raw.technology||{})){
 if(t.hidden||(t.prerequisites||[]).some(id=>!reachable.has(id)))continue;
 if(t.unit&&Object.values(t.unit.ingredients||{}).some(i=>!science.has(i[0]||i.name)))continue;
 reachable.add(t.name);
}
const closures=new Map();
function closure(id){
 if(closures.has(id))return closures.get(id);
 const result=new Set([id]);
 for(const p of raw.technology[id]?.prerequisites||[])for(const t of closure(p))result.add(t);
 closures.set(id,result);return result;
}
const cost=id=>[...closure(id)].reduce((n,t)=>n+(raw.technology[t]?.unit?.count||0),0);
const unlocks=new Map();
for(const id of reachable)for(const e of raw.technology[id]?.effects||[])if(e.type==='unlock-recipe'){
 const list=unlocks.get(e.recipe)||[];list.push(id);unlocks.set(e.recipe,list.sort((a,b)=>cost(a)-cost(b)||a.localeCompare(b)));
}
const available=r=>r&&!r.hidden&&!r.parameter&&(r.enabled!==false||unlocks.has(r.name));
const special={'petroleum-gas':'basic-oil-processing','solid-fuel':'solid-fuel-from-petroleum-gas'};
function selectRecipe(item){
 const r=raw.recipe[special[item]||item];
 return available(r)&&Object.values(r.results||{}).some(p=>p.name===item)?r:undefined;
}
const nodes=recipeChain(product,raw,rawInputs,selectRecipe);
const extraIron=process.env.EXTRA_IRON==='1';
const layoutNodes=extraIron?(()=>{const iron=nodes.find(n=>n.item==='iron-plate');return [iron,{...iron},...nodes.filter(n=>n!==iron)];})():nodes;
const needed=new Set([nodes.every(n=>n.recipe.category==='smelting')?'electronics':'automation','electric-energy-distribution-1']);
const primary=unlocks.get(selectRecipe(product).name)?.[0]||'automation';
for(const n of nodes)if(n.recipe.enabled===false)needed.add(unlocks.get(n.recipe.name)?.find(id=>closure(primary).has(id))||unlocks.get(n.recipe.name)?.[0]);
const consumers=new Map();
for(const n of nodes)for(const i of Object.values(n.recipe.ingredients||{}))if(i.type!=='fluid'&&!rawInputs.has(i.name))consumers.set(i.name,(consumers.get(i.name)||0)+1);
if([...consumers.values()].some(count=>count>1))needed.add('logistics');
for(const node of nodes){const technology=starterMachineResearch[starterMachineFor(node.recipe,raw)];if(technology)needed.add(technology);}
const technologies=new Set();for(const id of needed)for(const t of closure(id))technologies.add(t);

const outRoot=path.resolve(cwd,process.env.OUT_ROOT||'.cache/military-layout-candidates');
await fs.rm(outRoot,{recursive:true,force:true});await fs.mkdir(outRoot,{recursive:true});
const itemByPlace=new Map(Object.values(raw.item||{}).filter(x=>x.place_result).map(x=>[x.place_result,x.name]));
const costMemo=new Map();
function ingredientList(recipe){
 const list=recipe?.ingredients||[];
 return Array.isArray(list)?list:Object.entries(list).map(([name,amount])=>({name,amount,type:'item'}));
}
function itemCost(item,active=new Set()){
 if(costMemo.has(item))return costMemo.get(item);
 if(active.has(item))return {[item]:1};
 const recipe=raw.recipe[item];if(!recipe){const out={[item]:1};costMemo.set(item,out);return out;}
 const out={},resultAmount=(recipe.results||[]).find(r=>r.type==='item'&&r.name===item)?.amount||1;active.add(item);
  for(const i of ingredientList(recipe)){
    const amount=i.amount??i.amount_min??0;
  if(i.type==='fluid'){out[i.name]=(out[i.name]||0)+amount/resultAmount;continue;}
  for(const [name,count]of Object.entries(itemCost(i.name,active)))out[name]=(out[name]||0)+count*amount/resultAmount;
 }
 active.delete(item);costMemo.set(item,out);return out;
}
function routeCost(entities){
 const counts={};for(const e of entities){if(!['transport-belt','underground-belt','splitter'].includes(e.name))continue;const item=itemByPlace.get(e.name)||e.name;for(const [name,count]of Object.entries(itemCost(item)))counts[name]=(counts[name]||0)+count;}
 return {counts,total:Object.values(counts).reduce((n,v)=>n+v,0)};
}
function metrics(blueprint,compaction,ports,attempt,pitch){
 const byName={};for(const e of blueprint.entities)byName[e.name]=(byName[e.name]||0)+1;
 const tagged={};for(const e of blueprint.entities)if(e.tags?.material)tagged[e.tags.material]=(tagged[e.tags.material]||0)+1;
 const routeCostData=routeCost(blueprint.entities);
 return {attempt,pitch,entities:blueprint.entities.length,bounds:compaction.after,compaction,byName,tagged,routeCost:routeCostData,ports:ports.map(({entity,kind,items,x,y,direction,externalSide})=>({entity,kind,items,x,y,direction,externalSide}))};
}
const attempts=process.env.STARTER_ATTEMPTS?process.env.STARTER_ATTEMPTS.split(',').map(Number):Array.from({length:192},(_,i)=>i);
const successes=[],failures=[];
for(const attempt of attempts){
 try{
  const layout=makeRawLayout({product,nodes:layoutNodes,raw,technologies,attempt,consumerPriority});
  const displayLabels=new Map((baseline.ports||[]).filter(p=>p.kind==='input'||p.kind==='fluid').map(p=>[p.items?.[0],p.label]));
  for(const port of layout.ports)if(['input','fluid'].includes(port.kind))port.label=displayLabels.get(port.items?.[0])||port.items?.[0];
  addInputDisplays(layout.blueprint,{ports:layout.ports,setupNotes:[]});
  const compaction=compactStarterLayout(layout.blueprint,layout.ports,raw);
  layout.blueprint.label=`Military science pack · raw layout candidate ${attempt}`;
  layout.blueprint.description=`Scratch candidate from makeRawLayout attempt ${attempt}; all intermediates are internal and all raw ports remain west-facing.`;
  const m=metrics(layout.blueprint,compaction,layout.ports,attempt,layout.pitch);
  const dir=path.join(outRoot,`attempt-${String(attempt).padStart(3,'0')}`),sourceDir=path.join(dir,'blueprint-sources/early-game');
  await fs.mkdir(sourceDir,{recursive:true});
  const file='military-candidate.txt';
  await fs.writeFile(path.join(sourceDir,file),encodeBlueprint({blueprint:layout.blueprint})+'\n');
  const info={...baseline,file,name:layout.blueprint.label,ports:layout.ports,recipes:layoutNodes.map(n=>n.recipe.name),machineCount:layout.machines,compaction,changes:[...(baseline.changes||[]),`Scratch generator candidate attempt ${attempt}${extraIron?' with one duplicated iron-plate furnace':''}; emitted for native compaction review.`]};
  await fs.writeFile(path.join(sourceDir,'manifest.json'),JSON.stringify([info],null,2)+'\n');
  await fs.writeFile(path.join(dir,'metrics.json'),JSON.stringify(m,null,2)+'\n');
  successes.push({...m,dir:`${outRoot}/attempt-${String(attempt).padStart(3,'0')}`});
 }catch(error){failures.push({attempt,error:String(error?.message||error)});}
}
const ranked=[...successes].sort((a,b)=>a.bounds.width*a.bounds.height-b.bounds.width*b.bounds.height||a.routeCost.total-b.routeCost.total||a.entities-b.entities);
await fs.writeFile(path.join(outRoot,'index.json'),JSON.stringify({product,nodes:layoutNodes.map(n=>n.recipe.name),technologies:[...technologies].sort(),attempts,extraIron,successes:successes.length,failures,ranked},null,2)+'\n');
console.log(JSON.stringify({successes:successes.length,failures:failures.length,top:ranked.slice(0,12).map(x=>({attempt:x.attempt,dir:x.dir,entities:x.entities,area:x.bounds.width*x.bounds.height,bounds:x.bounds,transport:x.byName['transport-belt']||0,underground:x.byName['underground-belt']||0,totalRouteCost:x.routeCost.total,routeCost:x.routeCost.counts}))},null,2));
