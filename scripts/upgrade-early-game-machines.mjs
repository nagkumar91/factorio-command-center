// Upgrade saved layouts in place, preserving routes, port IDs and display signs.
import fs from 'node:fs/promises';
import {decodeBlueprint,encodeBlueprint} from './blueprints.mjs';
import {starterMachineUpgrades,starterMachineResearch,starterMachineNote} from './starter-machines.mjs';
const root='blueprint-sources/early-game';
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'.cache/factorio-vanilla/script-output/data-raw-dump.json'));
const catalog=JSON.parse(await fs.readFile('site/data/catalog.json'));
const names=new Map([...catalog.items,...catalog.fluids,...catalog.technologies].map(i=>[i.id,i.name]));
const name=id=>names.get(id)||id.replaceAll('-',' ');
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json'));
const research=JSON.parse(await fs.readFile(root+'/research.json'));
const closures=new Map();
function closure(id){
 if(closures.has(id))return closures.get(id);
 const result=new Set([id]);for(const p of raw.technology[id].prerequisites||[])for(const t of closure(p))result.add(t);
 closures.set(id,result);return result;
}
const cost=id=>[...closure(id)].reduce((sum,t)=>sum+(raw.technology[t].unit?.count||0),0);
const objects=new Map(),counts={};
for(const info of manifest){
 const object=decodeBlueprint(await fs.readFile(root+'/'+info.file,'utf8')),b=object.blueprint;
 for(const entity of b.entities){
  const upgraded=starterMachineUpgrades[entity.name];
  if(upgraded){counts[upgraded]=(counts[upgraded]||0)+1;entity.name=upgraded;}
 }
 const needed=new Set([...info.requires,...b.entities.map(e=>starterMachineResearch[e.name]).filter(Boolean)]);
 info.requires=[...needed].filter(id=>![...needed].some(other=>other!==id&&closure(other).has(id)));
 info.researchClosure=[...new Set(info.requires.flatMap(id=>[...closure(id)]))].sort();
 info.unlock=[...info.requires].sort((a,b)=>cost(b)-cost(a)||a.localeCompare(b))[0];
 info.unlockName=name(info.unlock);
 info.setupNotes=info.setupNotes.filter(n=>!n.startsWith('Production equipment: '));
 info.setupNotes.splice(1,0,starterMachineNote(b.entities));
 b.description=['Original modular early-game design for Factorio 2.0.77 / Space Age.','Unlock: '+info.requires.map(name).join(', '),...info.setupNotes].join('\n');
 objects.set(info.id,object);
}
const stages=[...new Set(manifest.map(b=>b.unlock))].sort((a,b)=>cost(a)-cost(b)||a.localeCompare(b));
manifest.sort((a,b)=>stages.indexOf(a.unlock)-stages.indexOf(b.unlock)||a.products[0].localeCompare(b.products[0]));
for(const [i,info]of manifest.entries()){
 info.order=i+1;info.category=String(stages.indexOf(info.unlock)+1).padStart(2,'0')+' · '+info.unlockName;
 await fs.writeFile(root+'/'+info.file,encodeBlueprint(objects.get(info.id))+'\n');
}
research.foundation=['automation-2','advanced-material-processing','electric-energy-distribution-1','logistics'];
research.stages=stages.map((id,i)=>({id,name:name(id),order:i+1,prerequisites:raw.technology[id].prerequisites||[],science:raw.technology[id].unit?.ingredients||[],trigger:raw.technology[id].research_trigger,modules:manifest.filter(b=>b.unlock===id).map(b=>b.id)}));
await fs.writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(root+'/research.json',JSON.stringify(research,null,2)+'\n');
console.log(JSON.stringify({upgraded:counts,modules:manifest.length,researchPacks:stages.length}));
console.log('Run native verification and index:atlas before publishing the upgraded layouts.');
