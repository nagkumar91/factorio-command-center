import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from '../../../scripts/blueprints.mjs';
const here=path.dirname(new URL(import.meta.url).pathname);
const repo=path.resolve(here,'../../..');
const defaultRoot=path.join(repo,'.cache/science-factory/reproduce-steel');
const resolveRepoPath=value=>path.isAbsolute(value)?value:path.resolve(repo,value);
const source=resolveRepoPath(process.env.STEEL_TRIM_SOURCE||path.join(defaultRoot,'fuel-limited/blueprint-sources/science-factories'));
const out=resolveRepoPath(process.env.STEEL_TRIM_OUT||path.join(defaultRoot,'final'));
const info=JSON.parse(await fs.readFile(path.join(source,'manifest.json')))[0];
const bp=decodeBlueprint(await fs.readFile(path.join(source,info.file),'utf8')).blueprint;
const v={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]};
const blocks=new Set(bp.entities.filter(e=>e.name==='steel-furnace').map(e=>e.tags.compact_block));
const removed=[];
for(const block of blocks){
 const shared=bp.entities.filter(e=>e.tags?.compact_block===block&&e.tags.role==='input-shared');
 const xs=new Set(shared.map(e=>e.position.x));if(xs.size!==1)throw Error('Multiple shared lines');
 const x=[...xs][0];
 const pickups=bp.entities.filter(e=>e.name==='fast-inserter'&&e.tags?.compact_block===block).map(e=>({x:e.position.x+v[e.direction||0][0],y:e.position.y+v[e.direction||0][1]})).filter(p=>p.x===x);
 if(!pickups.length)throw Error('Missing actual pickup contact');
 const lastPickup=Math.max(...pickups.map(p=>p.y));
 const tail=shared.filter(e=>e.position.y>lastPickup);
 if(tail.length!==3)throw Error('Unexpected tail count '+block+':'+tail.length);
 removed.push(...tail);
}
const ids=new Set(removed.map(e=>e.entity_number));
if(bp.wires.some(([a,,b])=>ids.has(a)||ids.has(b)))throw Error('Tail carries circuit wire');
if(info.ports.some(p=>ids.has(p.entity)))throw Error('Tail is external port');
bp.entities=bp.entities.filter(e=>!ids.has(e.entity_number));
for(const e of bp.entities.filter(e=>e.tags?.branch_limit)){
 e.control_behavior.circuit_condition.constant=24;
 Object.assign(e.tags.branch_limit,{threshold:24,baseThreshold:24,safetyStock:24});
}
info.branchLimits.threshold=24;
for(const limit of info.branchLimits.limits){limit.threshold=24;limit.safetyStock=24;limit.requiredRatePerSecond=limit.machineCount*0.0075;}
info.branchLimits.fuelRateBasis='Steel furnace 90 kW / solid fuel 12 MJ; actual consumption depends on utilization.';
const finalNote='Keep the saved circuit wires and two clock combinators connected to balance intermediates and furnace fuel.';
info.setupNotes=[...(info.setupNotes||[])]
 .filter(note=>!note.startsWith('Intermediate assemblers use')&&!note.startsWith('Solid-fuel input branches use')&&!note.startsWith('Fuel branch stock limits'))
 .concat(finalNote);
info.changes=[...(info.changes||[])].map(change=>change.replace('opt-in ',''));
bp.description=(bp.description||info.name).split('\n')
 .filter(line=>!line.startsWith('Intermediate production caps:')&&!line.startsWith('Solid-fuel input branches use'))
 .concat(finalNote).join('\n');
// Preserve the research configuration used by the native steel-furnace runs.
info.researchClosure=info.researchClosure.filter(id=>id!=='advanced-material-processing-2');
info.requires=[...new Set([...info.requires.filter(id=>id!=='advanced-material-processing-2'),'advanced-material-processing'])].sort();
const code=encodeBlueprint({blueprint:bp});
info.blueprintSha256=createHash('sha256').update(code).digest('hex');
Object.assign(info,blueprintMaterials({blueprint:bp},JSON.parse(await fs.readFile(path.join(repo,'site/data/catalog.json')))));
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,info.file),code+'\n');
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([info],null,2)+'\n');
await fs.writeFile(path.join(out,'trim.json'),JSON.stringify({removed:removed.map(e=>({id:e.entity_number,block:e.tags.compact_block,position:e.position})),threshold:24,sha:info.blueprintSha256},null,2)+'\n');
console.log(JSON.stringify({out,removed:removed.length,entities:bp.entities.length,sha:info.blueprintSha256}));
