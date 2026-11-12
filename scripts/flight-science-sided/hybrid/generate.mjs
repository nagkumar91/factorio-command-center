import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint} from '../../blueprints.mjs';
import {Layout} from './layout.mjs';
import {rewriteHybridUnderground} from './underground/rewrite.mjs';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const out=path.join(root,'blueprint-sources/flight-science-sided/hybrid');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await fs.readFile(path.join(root,'.cache/flight-21/script-output/data-raw-dump.json'));
const raw=JSON.parse(bytes),layout=new Layout(raw);
await fs.mkdir(path.join(out,'components'),{recursive:true});
// The reviewed hybrid always uses its checked-in component snapshots.
const frozen=true;
// Preserve the first exact passing artifact before replacing any source snapshot.
try{
 const [previous]=JSON.parse(await fs.readFile(path.join(out,'manifest.json')));
 const evidence=JSON.parse(await fs.readFile(path.join(out,'native-report.json')));
 const passed=evidence.builds?.find(b=>b.id===previous.id&&b.blueprintSha256===previous.blueprintSha256&&b.passed);
 if(passed&&!evidence.short){
  const archive=path.join(out,'history/first-native');
  try{await fs.access(path.join(archive,'manifest.json'));}catch{
   await fs.mkdir(archive,{recursive:true});
   for(const file of ['manifest.json','native-report.json',previous.file,previous.id+'.json'])await fs.copyFile(path.join(out,file),path.join(archive,file));
   await fs.cp(path.join(out,'components'),path.join(archive,'components'),{recursive:true});
   await fs.copyFile(path.join(root,'tests/flight-science-sided-hybrid-control.lua'),path.join(archive,'native-control.lua'));
  }
 }
}catch(error){if(error.code!=='ENOENT')throw error;}

const componentManifest=[];
async function component(folder,id){
 const componentRoot=frozen?path.join(out,'components'):path.join(root,folder);
 const manifests=JSON.parse(await fs.readFile(path.join(componentRoot,'manifest.json')));
 const m=manifests.find(m=>m.id===id);assert(m,`Missing component ${id}`);
 const code=(await fs.readFile(path.join(componentRoot,m.file),'utf8')).trim();assert.equal(sha(code),m.blueprintSha256);
 assert.equal(m.prototypeSha256,sha(bytes),'Different prototype set');
 if(!frozen)await fs.writeFile(path.join(out,'components',id+'.txt'),code+'\n');
 componentManifest.push({...m,file:id+'.txt',sourceFolder:folder});
 return {m,b:decodeBlueprint(code).blueprint};
}
const core=await component('blueprint-sources/flight-science-sided/compact','compact-six-pack-sided-60');
const main=layout.import(core.b,core.m);
const mainPorts=main.ports;
const lower=[];
const railBlock=core.m.blocks?.find(b=>b.name==='Rail block'||b.products?.length===1&&b.products[0]==='rail');
const tailX=railBlock?railBlock.bounds.right:49;
const rightX=railBlock?95:91;
// Relocate the two long, empty-space science corridors so that the engine
// workshop can occupy the lower-right bay. Their source filters remain intact.
for(const item of ['production-science-pack','utility-science-pack']){
 const port=mainPorts.find(p=>p.kind==='output'&&p.items[0]===item),y=Math.floor(port.y);
 for(const e of [...layout.entities])if(e.position.y===port.y&&e.position.x>=tailX+.5&&e.position.x<=91.5)layout.remove(e.entity_number);
 layout.ports=layout.ports.filter(p=>p!==port);
 lower.push({item,source:{x:tailX+.5,y:port.y},outputY:item==='production-science-pack'?(railBlock?19:20):48});
}
if(rightX!==91)for(const port of [...layout.ports].filter(p=>p.kind==='output')){
 const y=Math.floor(port.y);layout.remove(port.entity);
 for(let x=91;x<=rightX-2;x++)layout.belt(x,y,4);
 layout.add('fast-inserter',rightX-1,y,{direction:12,override_stack_size:1,use_filters:true,filters:[{index:1,name:port.items[0],quality:'normal',comparator:'='}]});
 const chest=layout.add('wooden-chest',rightX,y,{bar:1});
 port.entity=chest.entity_number;port.x=chest.position.x;port.y=chest.position.y;
}
const placements=[['engine-supply',railBlock?59:55,27],['green-circuit-supply',railBlock?64:56,43],['advanced-circuit-supply',0,59]];
const feeders=[];
for(const [id,x,y]of placements){
 const original=await component('blueprint-sources/flight-science-sided',id);
 const c=structuredClone(original),changes=[];
 if(railBlock&&id==='engine-supply'){
  // The rail bay occupies four former approach-belt tiles. Shorten only the
  // straight entrance stubs; retain every machine, stock controller and tunnel.
  for(const p of c.m.ports.filter(p=>p.kind==='input')){
   const target=c.b.entities.find(e=>e.position.x===-2.5&&e.position.y===p.y);
   assert(target?.name==='fast-transport-belt');
   const removed=c.b.entities.filter(e=>e.position.y===p.y&&e.position.x>=-6.5&&e.position.x<-2.5);
   assert(removed.every(e=>e.name==='fast-transport-belt'));
   c.b.entities=c.b.entities.filter(e=>!removed.includes(e));
   changes.push({item:p.items[0],removedSourceEntities:removed.map(e=>e.entity_number),retainedSourceInlet:target.entity_number});
   p.entity=target.entity_number;p.x=target.position.x;
  }
 }
 const imported=layout.import(c.b,c.m,x,y);if(changes.length)imported.approachTrims=changes;feeders.push(imported);
}
const routeOptions={minX:-16,maxX:rightX-1,minY:-7,maxY:71};
for(const p of lower){
 p.sourceEntity=layout.belt(Math.floor(p.source.x),Math.floor(p.source.y),4);
 p.targetEntity=layout.belt(rightX-2,p.outputY,4);
 layout.add('fast-inserter',rightX-1,p.outputY,{direction:12,override_stack_size:1,use_filters:true,filters:[{index:1,name:p.item,quality:'normal',comparator:'='}]});
 const chest=layout.add('wooden-chest',rightX,p.outputY,{bar:1});
 layout.ports.push({kind:'output',label:p.item,items:[p.item],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,perMinute:60,externalSide:'east'});
}
const interconnects=[];
for(const feeder of feeders){
 const output=feeder.ports.find(p=>p.kind==='output');
 const target=mainPorts.find(p=>p.kind==='input'&&p.items[0]===output.items[0]);
 assert(target,`Missing consumer ${output.items[0]}`);
 layout.remove(output.entity);
 const source=layout.belt(Math.floor(output.x),Math.floor(output.y),4);
 layout.ports=layout.ports.filter(p=>p!==output&&p!==target);
 const route=layout.route(source.position,{x:target.x,y:target.y},{...routeOptions,startDirection:4,endDirection:4});
 interconnects.push({item:output.items[0],sourceComponent:feeder.id,sourceEntity:source.entity_number,consumerEntity:target.entity,route});
 console.log('Connected',output.items[0],route.length);
}
for(const p of lower)layout.route(p.sourceEntity.position,p.targetEntity.position,{...routeOptions,startDirection:4,endDirection:4});
// Every raw-material/heavy-item entrance is brought to one common west edge.
// Repeated plates are explicitly labeled by workshop and summed in the manifest.
const externalX=-18,usedY=new Set(),inletRoutes=[];
const rawPorts=layout.ports.filter(p=>p.kind==='input');
for(const p of rawPorts){
 let y=Math.floor(p.y);
 while(usedY.has(y)||layout.at(externalX,y))y++;
 usedY.add(y);
 p.inletEntity=layout.belt(externalX,y,4);
}
for(const p of [...rawPorts].sort((a,b)=>Number(b.component==='green-circuit-supply'&&b.items[0]==='iron-plate')-Number(a.component==='green-circuit-supply'&&a.items[0]==='iron-plate'))){
 const inlet=p.inletEntity;delete p.inletEntity;
 const route=layout.route(inlet.position,{x:p.x,y:p.y},{...routeOptions,minX:externalX,startDirection:4});
 inletRoutes.push({item:p.items[0],sourceEntity:inlet.entity_number,consumerEntity:p.entity,route});
 p.internalEntity=p.entity;p.entity=inlet.entity_number;p.x=inlet.position.x;p.y=inlet.position.y;p.direction=4;p.externalSide='west';
 p.label=`${p.items[0]} · ${p.block||p.component}`;
 console.log('Exterior',p.label,route.length);
}
const description='Six science packs at 60/min each. Green/red circuits, engines, rails and ordinary science intermediates are made inside. Import the five heavy ingredients: processing units, low-density structures, flying robot frames, electric furnaces and productivity module 1s. All labeled material entrances are on the left; all six science collection chests are on the right. Keep circuit wires and stock controls. Normal AM2, fast inserters, red belts; no installed modules or bots. Factorio 2.1.24 flight-save recipes.';
const {bp,footprint}=layout.finish('Hybrid six science packs · left in / right out · 60/min',description);
bp.icons=core.b.icons;
// Verified stock-only v2: retain every entity, recipe, wire and port from v1.
const stockTuning={sulfur:40,'transport-belt':64},stockChanges=[];
for(const e of bp.entities){const condition=e.control_behavior?.circuit_condition,item=condition?.first_signal?.name;if(item in stockTuning){stockChanges.push({entity:e.entity_number,position:e.position,item,from:condition.constant,to:stockTuning[item]});condition.constant=stockTuning[item];}}
assert.equal(stockChanges.length,2);
for(const loop of layout.loops)for(const [item,limit]of Object.entries(stockTuning))if(loop.limits[item]!==undefined)loop.limits[item]=limit;
const products=core.m.products,id='hybrid-six-pack-sided-60';
let code=encodeBlueprint({blueprint:bp});
const inputs=layout.ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:4,perMinute:p.perMinute,block:p.block||p.component}));
const inputsPerMinute=Object.fromEntries([...new Set(inputs.map(p=>p.item))].sort().map(item=>[item,inputs.filter(p=>p.item===item).reduce((n,p)=>n+p.perMinute,0)]));
assert.deepEqual(inputsPerMinute,{coal:300,'copper-plate':630,'electric-furnace':20,'flying-robot-frame':20,'iron-plate':1290,'low-density-structure':60,'plastic-bar':180,'processing-unit':40,'productivity-module':20,stone:300,'stone-wall':60,'steel-plate':375,sulfur:30});
const machineCounts={};for(const e of bp.entities)if(e.recipe)machineCounts[e.recipe]=(machineCounts[e.recipe]||0)+1;
const manifest={id,name:bp.label,file:id+'.txt',products,targetPerMinute:60,blueprintSha256:sha(code),prototypeSha256:sha(bytes),gameVersion:'2.1.24',ports:layout.ports,footprint,machineCounts,inputs,inputsPerMinute,outputs:layout.ports.filter(p=>p.kind==='output').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:60})),loopControl:layout.loops,components:layout.components.map(({map,ports,...c})=>c),interconnects,inletRoutes,setupNotes:[description,'Input rates are recipe demand at exactly 60/min per pack. Supply surplus while startup stocks fill and if operating above the target.','Multiple iron, copper and steel entrances serve separate workshops; every entrance is labeled and faces left.'],attribution:'Original local compact six-pack science design plus the parent-tested green-circuit, advanced-circuit and engine supply workshops. Frozen source components and SHA-256 identities are included. Hybrid placement and physical belt routing are new.',status:'awaiting-native-validation',stockTuning,previousBlueprintSha256:'da625c002d67bfd9959e84b5ee7cc61f0fe97ea20494de5085895dd754ca7d79',revision:{kind:'stock-limit-only',baseBlueprintSha256:'da625c002d67bfd9959e84b5ee7cc61f0fe97ea20494de5085895dd754ca7d79',changes:stockChanges}};
const rewritten=await rewriteHybridUnderground({blueprint:bp},manifest,raw);
Object.assign(manifest,rewritten.manifest);
code=encodeBlueprint(rewritten.wrapper);
try{
 const previous=JSON.parse(await fs.readFile(path.join(out,'native-report.json')));
 const evidence=previous.builds?.find(b=>b.id===id&&b.blueprintSha256===manifest.blueprintSha256&&b.passed);
 if(evidence&&!previous.short){manifest.status='native-production-verified';manifest.measuredOutputsPerMinute=evidence.outputsPerMinute;}
}catch(error){if(error.code!=='ENOENT')throw error;}
await fs.writeFile(path.join(out,'components/manifest.json'),JSON.stringify(componentManifest,null,2)+'\n');
await fs.writeFile(path.join(out,id+'.txt'),code+'\n');
await fs.writeFile(path.join(out,id+'.json'),JSON.stringify(rewritten.wrapper,null,2)+'\n');
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,footprint,area:footprint.width*footprint.height,machines:Object.values(machineCounts).reduce((a,b)=>a+b,0),entities:rewritten.wrapper.blueprint.entities.length,blueprintSha256:manifest.blueprintSha256},null,2));
