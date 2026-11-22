// Shared builder for the heavy-ingredient supply factories of the six-pack science family
// (electric-furnace-supply and productivity-module-supply). Same conventions as
// scripts/flight-science-sided/feeders.mjs: normal assembling machine 2, fast inserters with hand size 1,
// red belts, one west inlet belt per material with a display panel, a filter fast inserter into a steel
// chest (bar 2) on the east, a big electric pole as the power port placed by the family's pole helper.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../../../blueprints.mjs';
import {powerStarterLayout,starterBounds,auditConnections} from '../../../science-factory/local-ports/compact-shared-layout.mjs';

export const ROOT=path.resolve(new URL('../../../..',import.meta.url).pathname);
export const OUT_ROOT=path.join(ROOT,'blueprint-sources/flight-science-sided/heavy-supplies');
// The installed Factorio 2.1.24 "flight-save" mod profile the family validates against
// (blueprint-sources/flight-science-sided/manifest.json prototypeSha256).
export const PROTOTYPE_SHA256='33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f';
export const sha=value=>createHash('sha256').update(value).digest('hex');

/** The family's profile: FLIGHT_PROFILE, else .cache/flight-21 (family default), else .cache/heavy-supplies/flight-21. */
export async function findProfile(){
 const candidates=[process.env.FLIGHT_PROFILE,path.join(ROOT,'.cache/flight-21'),path.join(ROOT,'.cache/heavy-supplies/flight-21')].filter(Boolean);
 for(const dir of candidates){
  const file=path.join(dir,'script-output/data-raw-dump.json');
  const bytes=await fs.readFile(file).catch(()=>null);
  if(bytes&&sha(bytes)===PROTOTYPE_SHA256)return {dir,file,bytes,raw:JSON.parse(bytes)};
 }
 return null;
}

/** Recipe arithmetic: whole machines (rounded up) and per-minute inlet figures for the target. */
export function recipePlan(raw,recipeName,target){
 const recipe=raw.recipe[recipeName],machine=raw['assembling-machine']['assembling-machine-2'];
 assert(recipe&&recipe.results.length===1&&recipe.results[0].name===recipeName);
 const categories=recipe.categories||[recipe.category||'crafting'];
 assert(categories.some(c=>machine.crafting_categories.includes(c)),'assembling machine 2 cannot craft '+recipeName);
 const perCraft=recipe.results[0].amount,seconds=recipe.energy_required??.5;
 const perMachinePerMinute=60*machine.crafting_speed/seconds*perCraft;
 const machines=Math.ceil(target/perMachinePerMinute-1e-9);
 const inputs=recipe.ingredients.map(i=>({item:i.name,perMinute:+(target/perCraft*i.amount).toFixed(6)}));
 return {recipe:recipeName,seconds,craftingSpeed:machine.crafting_speed,perMachinePerMinute,exactMachines:target/perMachinePerMinute,machines,utilization:target/(machines*perMachinePerMinute),inputs};
}

/** Tile-grid builder in the style of feeders.mjs: integer tile (x,y); assemblers are placed by their centre tile. */
export function createBuilder(){
 const entities=[],ports=[],occupied=new Map(),counts={};let next=1;
 const key=(x,y)=>`${x},${y}`;
 function add(name,x,y,extra={}){
  const r=name==='assembling-machine-2'?1:0;
  for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++){assert(!occupied.has(key(a,b)),`overlap ${name} ${a},${b}`);occupied.set(key(a,b),name);}
  const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);return e;
 }
 const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
 const arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
 const machine=(recipe,x,y)=>{counts[recipe]=(counts[recipe]||0)+1;return add('assembling-machine-2',x,y,{recipe});};
 const filter=n=>({use_filters:true,filters:[{index:1,name:n,quality:'normal',comparator:'='}]});
 const panels=[];
 function input(item,x,y,perMinute,panel){const e=belt(x,y,4);ports.push({kind:'input',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute});panels.push({port:ports.at(-1),x:panel[0],y:panel[1]});return e;}
 // The outlet: a filter fast inserter into a steel chest (bar 2) on the east edge. `toward` is the side of the
 // chest the inserter stands on: 'west' as in feeders.mjs (belt end, inserter, chest in a row), or 'south'
 // where the product belt turns north at the east edge and the inserter lifts from its end into the chest.
 function output(item,x,y,perMinute,panel,toward='west'){const [cx,cy,d]=toward==='west'?[x+1,y,12]:[x,y-1,8];arm(x,y,d,filter(item));const e=add('steel-chest',cx,cy,{bar:2});ports.push({kind:'output',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,externalSide:'east',perMinute});panels.push({port:ports.at(-1),x:panel[0],y:panel[1]});return e;}
 return {entities,ports,counts,panels,add,belt,arm,machine,input,output,isFree:(x,y)=>!occupied.has(key(x,y))};
}

const countBy=entities=>{const c={};for(const e of entities)c[e.name]=(c[e.name]||0)+1;return c;};

/**
 * Panels, power, tags and manifest. Panels are placed first on explicit tiles inside the body; then the family's
 * pole helper docks the big pole (the power port) beside the west inlets and covers every consumer.
 */
export async function finish({id,product,target,plan,builder,raw,rawBytes,description,layout}){
 const {entities,ports,counts,panels,add}=builder;
 for(const p of panels){const e=add('display-panel',p.x,p.y,{icon:{type:'item',name:p.port.items[0]},text:`${p.port.kind}: ${p.port.label} ${p.port.perMinute}/min`,always_show:true});p.port.displayEntity=e.entity_number;}
 const bp={item:'blueprint',version:562954249961472,label:`${id} · ${target}/min`,entities,wires:[],icons:[{index:1,signal:{type:'item',name:product}}]};
 const power={kind:'power',label:'External electricity',items:[],entity:0,x:0,y:0};
 powerStarterLayout(bp,[...ports,power],raw);
 ports.push(power);
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 bp.description=description;
 const audit=auditConnections(bp,raw);
 const footprint=starterBounds(bp.entities,raw);
 const outDir=path.join(OUT_ROOT,id),file=id+'.txt';
 await fs.mkdir(outDir,{recursive:true});
 // Keep the committed string when it decodes to exactly this blueprint (another zlib build may compress differently).
 const committed=await fs.readFile(path.join(outDir,file),'utf8').then(t=>t.trim(),()=>null);
 const same=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
 const code=committed&&same(committed)?committed:encodeBlueprint({blueprint:bp});
 const blueprintSha256=sha(code);
 const report=JSON.parse(await fs.readFile(path.join(outDir,'native-report.json'),'utf8').catch(()=>'{}'));
 const proof=report.passed&&report.short===false&&report.builds?.find(b=>b.id===id&&b.blueprintSha256===blueprintSha256&&b.passed);
 const manifest={id,file,name:bp.label,products:[product],targetPerMinute:target,blueprintSha256,prototypeSha256:sha(rawBytes),
  ports,inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:4,perMinute:p.perMinute})),
  outputs:ports.filter(p=>p.kind==='output').map(p=>({item:product,entity:p.entity,position:{x:p.x,y:p.y},perMinute:target})),
  machineCounts:counts,footprint,tiles:footprint.width*footprint.height,loopControl:[],setupNotes:[description],
  status:proof?'native-verified':'awaiting-native-validation',construction:countBy(bp.entities),recipePlan:plan,layout,staticAudit:audit};
 if(proof)manifest.nativeEvidence={file:'native-report.json',blueprintSha256,harnessSha256:report.harnessSha256,warmupMinutes:report.warmupMinutes,measurementMinutes:report.measurementMinutes,recovery:{collectionPauseMinutes:proof.recovery.blockedMinutes,settlingMinutes:proof.recovery.settlingMinutes,measurementMinutes:proof.recovery.measurementMinutes},measuredPerMinute:proof.outputsPerMinute[product],recoveryPerMinute:proof.recovery.outputsPerMinute[product],reducedFeed:report.reducedFeed?{feedScale:report.reducedFeed.feedScale,measuredPerMinute:report.reducedFeed.builds.find(b=>b.id===id)?.outputsPerMinute[product]}:undefined};
 await fs.writeFile(path.join(outDir,file),code+'\n');
 await fs.writeFile(path.join(outDir,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');
 return {manifest,blueprint:bp,code};
}
