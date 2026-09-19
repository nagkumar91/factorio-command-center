import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from '../../blueprints.mjs';
const here=path.dirname(new URL(import.meta.url).pathname);
const repo=path.resolve(here,'../../..');
const resolveRepoPath=value=>path.isAbsolute(value)?value:path.resolve(repo,value);
const source=resolveRepoPath(process.argv[2]||'.cache/science-factory/reproduce-electric-v2/generated/blueprint-sources/science-factories');
const out=resolveRepoPath(process.argv[3]||'.cache/science-factory/reproduce-electric-v2/capped');
const raw=JSON.parse(await fs.readFile(path.join(repo,'.cache/factorio-vanilla/script-output/data-raw-dump.json')));
const catalog=JSON.parse(await fs.readFile(path.join(repo,'site/data/catalog.json')));
const info=JSON.parse(await fs.readFile(path.join(source,'manifest.json')))[0];
const bp=decodeBlueprint((await fs.readFile(path.join(source,info.file),'utf8')).trim()).blueprint;
const capTable=JSON.parse(await fs.readFile(path.join(here,'headroom-caps.json')));
const targets={...capTable.targetsPerMinute};
const proto=new Map(Object.values(raw).flatMap(group=>Object.entries(group||{})));
const occupied=new Set();
const key=(x,y)=>`${x},${y}`;
for(const e of bp.entities){
 const b=proto.get(e.name)?.collision_box||[[-.4,-.4],[.4,.4]];
 let l=b[0][0],t=b[0][1],r=b[1][0],d=b[1][1];
 if([4,12].includes(e.direction)){[l,t,r,d]=[t,l,d,r];}
 for(let x=Math.floor(e.position.x+l+1e-6);x<=Math.floor(e.position.x+r-1e-6);x++)for(let y=Math.floor(e.position.y+t+1e-6);y<=Math.floor(e.position.y+d-1e-6);y++)occupied.add(key(x,y));
}
const poles=bp.entities.filter(e=>e.name==='medium-electric-pole');
let next=Math.max(...bp.entities.map(e=>e.entity_number))+1;
function clockPart(near){
 for(const pole of poles)for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
  const x=Math.floor(pole.position.x)+dx,y=Math.floor(pole.position.y)+dy;
  if(near&&Math.hypot(x+.5-near.position.x,y+1-near.position.y)>8)continue;
  if(occupied.has(key(x,y))||occupied.has(key(x,y+1)))continue;
  occupied.add(key(x,y));occupied.add(key(x,y+1));
  const e={entity_number:next++,name:'arithmetic-combinator',position:{x:x+.5,y:y+1},direction:0,tags:{starter_entity:next-1,science_rate_clock:true}};
  bp.entities.push(e);return {e,pole};
 }
 throw Error('No clock location');
}
const a=clockPart(),b=clockPart(a.e);
if(Math.hypot(a.e.position.x-b.e.position.x,a.e.position.y-b.e.position.y)>9)throw Error('Clock parts too far apart');
const signal={type:'virtual',name:'signal-T'};
a.e.control_behavior={arithmetic_conditions:{first_signal:signal,second_constant:1,operation:'+',output_signal:signal}};
b.e.control_behavior={arithmetic_conditions:{first_signal:signal,second_constant:1000,operation:'%',output_signal:signal}};
bp.wires.push([a.e.entity_number,3,b.e.entity_number,1],[b.e.entity_number,3,a.e.entity_number,1],[b.e.entity_number,4,b.pole.entity_number,2]);
for(const [e,c,f,d] of [...bp.wires])if(c===5&&d===5)bp.wires.push([e,2,f,2]);
const caps=[];
for(const [recipe,target] of Object.entries(targets)){
 const machines=bp.entities.filter(e=>['assembling-machine-2','chemical-plant','electric-furnace','steel-furnace'].includes(e.name)&&(e.recipe||e.tags?.production_recipe)===recipe),r=raw.recipe[recipe];
 const amount=r.results.find(x=>x.type==='item')?.amount||1;
 const max=machines.reduce((sum,e)=>sum+(e.name.includes('furnace')?2:e.name==='chemical-plant'?1:.75),0)*60/(r.energy_required||.5)*amount;
 const threshold=Math.min(1000,Math.ceil(target/max*1000)+10);
 if(threshold>=1000)continue;
 for(const e of machines){
  e.control_behavior={...(e.control_behavior||{}),circuit_enabled:true,circuit_condition:{first_signal:signal,comparator:'<',constant:threshold}};
  const p=[...poles].sort((x,y)=>Math.hypot(e.position.x-x.position.x,e.position.y-x.position.y)-Math.hypot(e.position.x-y.position.x,e.position.y-y.position.y))[0];
  if(Math.hypot(e.position.x-p.position.x,e.position.y-p.position.y)>9)throw Error('Machine circuit out of range');
  bp.wires.push([p.entity_number,2,e.entity_number,2]);
 }
 caps.push({recipe,target,max,threshold});
}
info.setupNotes.push('Intermediate assemblers use a shared circuit clock to limit excess production during startup.');
bp.description+='\nIntermediate production caps: shared clock.';
const code=encodeBlueprint({blueprint:bp});
info.blueprintSha256=createHash('sha256').update(code).digest('hex');
const materials=blueprintMaterials({blueprint:bp},catalog);
info.entityCount=materials.entityCount;
info.entries=materials.entries;
info.excluded=materials.excluded;
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,info.file),code+'\n');
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([info],null,2)+'\n');
await fs.writeFile(path.join(out,'caps.json'),JSON.stringify(caps,null,2)+'\n');
console.log(JSON.stringify({out,sha:info.blueprintSha256,caps}));
