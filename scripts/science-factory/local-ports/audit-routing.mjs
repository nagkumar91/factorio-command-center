import fs from 'node:fs/promises';
import {decodeBlueprint} from '../../blueprints.mjs';
import {traceConnections} from './compact-shared-layout.mjs';
const source=process.argv[2];
if(!source||!process.argv[3])throw Error('Usage: node audit-routing.mjs blueprint.txt manifest.json [report.json]');
const raw=JSON.parse(await fs.readFile('.cache/factorio-vanilla/script-output/data-raw-dump.json'));
const blueprint=decodeBlueprint(await fs.readFile(source,'utf8')).blueprint,byId=new Map(blueprint.entities.map(e=>[e.entity_number,e]));
const {contacts,graph}=traceConnections(blueprint,raw),producers=new Map(),consumers=new Map(),issues=[];
const machine=e=>e&&(raw.furnace[e.name]||raw['assembling-machine'][e.name]);
const add=(map,item,id)=>{if(!map.has(item))map.set(item,new Set());map.get(item).add(id);};
const materials=e=>new Set([e?.tags?.material,...(e?.tags?.materials||[])].filter(Boolean));
const containerMaterials=new Map();
for(const e of blueprint.entities)if(raw.inserter[e.name]){
 const pickup=byId.get(contacts.get(e.entity_number+':pickup')),drop=byId.get(contacts.get(e.entity_number+':drop'));
 if(pickup&&drop&&raw.container[drop.name])for(const item of materials(pickup))add(containerMaterials,item,drop.entity_number);
}
const transferFilters=new Map();
const carries=(e,item)=>materials(e).has(item)||containerMaterials.get(item)?.has(e?.entity_number);
for(const e of blueprint.entities)if(raw.inserter[e.name]){
 const pickup=byId.get(contacts.get(e.entity_number+':pickup')),drop=byId.get(contacts.get(e.entity_number+':drop'));
 if(!pickup||!drop){issues.push({type:'missing-inserter-contact',inserter:e.entity_number,pickup:pickup?.entity_number,drop:drop?.entity_number,pos:e.position});continue;}
 if(machine(pickup))for(const result of raw.recipe[pickup.recipe||pickup.tags?.production_recipe]?.results||[])if(result.type!=='fluid'&&carries(drop,result.name))add(producers,result.name,drop.entity_number);
 if(machine(drop))for(const ingredient of raw.recipe[drop.recipe||drop.tags?.production_recipe]?.ingredients||[])if(ingredient.type!=='fluid'&&carries(pickup,ingredient.name))add(consumers,ingredient.name,pickup.entity_number);
 if(raw.container[drop.name])for(const item of materials(pickup))add(consumers,item,pickup.entity_number);
 if(!machine(pickup)&&!machine(drop)){
  if(!graph.has(pickup.entity_number))graph.set(pickup.entity_number,new Set());
  graph.get(pickup.entity_number).add(drop.entity_number);
  if(e.use_filters)transferFilters.set(pickup.entity_number+':'+drop.entity_number,new Set((e.filters||[]).map(f=>f.name)));
 }
}
const rawItems=new Set(['iron-ore','copper-ore','coal','stone']);
const manifest=JSON.parse(await fs.readFile(process.argv[3]));
for(const port of manifest[0].ports.filter(p=>p.kind==='input'))for(const item of port.items)add(producers,item,port.entity);
for(const [id,targets] of graph){
 const a=byId.get(id);if(!materials(a).size)continue;
 for(const target of [...targets]){
  const b=byId.get(target);if(!materials(b).size)continue;
  const filter=transferFilters.get(id+':'+target);
  const unwanted=[...materials(a)].filter(item=>(!filter||filter.has(item))&&!materials(b).has(item));
  if(unwanted.length)issues.push({type:'material-crossfeed',from:id,to:target,materials:[[...materials(a)],[...materials(b)]],unwanted});
  if(a.name==='fast-transport-belt'&&b.name==='fast-transport-belt'&&Math.abs(a.position.x-b.position.x)+Math.abs(a.position.y-b.position.y)===1&&b.direction===(a.direction+8)%16){targets.delete(target);issues.push({type:'head-on-belts',from:id,to:target,material:a.tags.material,pos:a.position});}
 }
}
const unreachable=[];
for(const [item,goals] of consumers){
 const queue=[...(producers.get(item)||[])],seen=new Set(queue);
 for(let i=0;i<queue.length;i++)for(const id of graph.get(queue[i])||[])if(!seen.has(id)&&carries(byId.get(id),item)&&(!transferFilters.has(queue[i]+':'+id)||transferFilters.get(queue[i]+':'+id).has(item))){seen.add(id);queue.push(id);}
 for(const id of goals)if(!seen.has(id))unreachable.push({item,id,pos:byId.get(id).position});
}
const result={source,entities:blueprint.entities.length,issueCount:issues.length,issues,unreachableCount:unreachable.length,unreachable};
await fs.writeFile(process.argv[4]||'.cache/science-factory/local-port-routing-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,issues:issues.slice(0,10),unreachable:unreachable.slice(0,15)},null,2));
