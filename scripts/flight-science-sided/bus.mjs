// Historical oversized bus experiment; not a selected design.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {makeCompactRecipeBlock} from '../science-factory/local-ports/compact-recipe-blocks.mjs';
import {routeCompactBlocks} from '../science-factory/local-ports/deterministic-main-bus.mjs';
import {powerStarterLayout,auditConnections,starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
import {addInputDisplays} from '../science-factory/local-ports/port-displays.mjs';
import {mirrorBlock} from '../flight-science/mirror.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const rawPath=process.env.FACTORIO_RAW || new URL('../../.cache/flight-21/script-output/data-raw-dump.json',import.meta.url);
const rawBytes=await fs.readFile(rawPath),raw=JSON.parse(rawBytes);
const hash=s=>createHash('sha256').update(s).digest('hex');
const out=path.resolve(process.env.SCIENCE_OUTPUT || path.join(root,'blueprint-sources/flight-science-sided/history/bus-candidates'));
await fs.mkdir(out,{recursive:true});
const manifests=JSON.parse(await fs.readFile(path.join(out,'manifest.json')).catch(()=>Buffer.from('[]'))).filter(m=>!['six-pack-compact','six-pack-hybrid'].includes(m.id));
const six=['automation-science-pack','logistic-science-pack','chemical-science-pack','military-science-pack','production-science-pack','utility-science-pack'];
const heavy=['processing-unit','low-density-structure','flying-robot-frame','electric-furnace','productivity-module'];
const configs=[
{id:'green-circuit-supply',products:['electronic-circuit'],rate:60,externals:['iron-plate','copper-plate']},
{id:'advanced-circuit-supply',products:['advanced-circuit'],rate:90,externals:['iron-plate','copper-plate','plastic-bar']},
{id:'engine-supply',products:['engine-unit'],rate:60,externals:['iron-plate','steel-plate']},
{id:'six-pack-compact',products:six,rate:60,externals:['iron-plate','copper-plate','steel-plate','sulfur','coal','stone-wall','stone','electronic-circuit','advanced-circuit','engine-unit',...heavy]},
{id:'six-pack-hybrid',products:six,rate:60,externals:['iron-plate','copper-plate','steel-plate','plastic-bar','sulfur','coal','stone-wall','stone',...heavy]}
];
for(const config of configs.filter(c=>!process.env.SCIENCE_BUILD||process.env.SCIENCE_BUILD.split(',').includes(c.id))) {
 const {products,externals,rate}=config;
 const demand={},crafts={},order=[];
 function expand(item,rate){
  demand[item]=(demand[item]||0)+rate;
  if(externals.includes(item))return;
  const r=raw.recipe[item];if(!r)throw Error('No recipe '+item);
  const count=r.results.find(v=>v.name===item).amount;
  crafts[item]=(crafts[item]||0)+rate/count;
  for(const i of r.ingredients)expand(i.name,rate/count*i.amount);
  if(!order.includes(item))order.push(item);
 }
 for(const p of products)expand(p,rate);
 // Minimum whole-machine counts; one extra cable assembler prevents shared buffer filling from starving blue science.
 const counts=Object.fromEntries(order.map(n=>[n,Math.ceil(crafts[n]*(raw.recipe[n].energy_required||.5)/45*Number(process.env.SCIENCE_HEADROOM||1.05)-1e-8)]));
 if(counts.rail)counts.rail=Math.ceil(crafts.rail*(raw.recipe.rail.energy_required||.5)/45/0.75*1.05);
 if(counts['copper-cable']&&process.env.SCIENCE_EXTRA_WIRE!=='0')counts['copper-cable']++;
 const originals=[];
 for(const id of order){
  const r=raw.recipe[id];let remaining=counts[id],part=0;
  while(remaining){
   let b,used;
   for(let size=Math.min(8,remaining);size>=1;size--){
    try{b=makeCompactRecipeBlock({id:`recipe-block-${id}-${part}`,recipe:{id,time:r.energy_required||.5,ingredients:r.ingredients.map(i=>({id:i.name,amount:i.amount})),results:r.results.map(i=>({id:i.name,amount:i.amount}))},machine:'assembling-machine-2',machines:size,maxRows:8,utilization:id==='rail'?.75:1,inwardInputs:true,pitch:3,westLanePickup:'outside'});used=size;break;}catch(e){if(size===1)throw Error(id+": "+e.message);}
   }
   originals.push(b);remaining-=used;part++;
  }
 }
 const materials=[...externals,...order];
 function layout(gap,offset,seed,colorize=true){
  // Dependency-respecting recipe order; nearby branches share and reuse bus rows.
  const selected=[];const pending=[...originals];let rnd=seed;
  const random=()=>{rnd=(Math.imul(rnd,1664525)+1013904223)>>>0;return rnd/4294967296;};
  while(pending.length){
   const available=pending.filter(b=>!b.inputs.some(i=>pending.some(other=>other.outputs.material===i.material)));
   if(!available.length)throw Error('Cyclic recipes');
   const b=available[seed?Math.floor(random()*available.length):0];selected.push(b);pending.splice(pending.indexOf(b),1);
  }
  const specs=[];
  for(const [i,b] of selected.entries()){
   let bank=i%2;
   const previousCable=specs.find(s=>s.block.outputs.material==='copper-cable');
   if(b.outputs.material==='copper-cable'&&previousCable)bank=1-previousCable.bank;
   let x=12+Math.floor(i/2)*gap+bank*offset;
   for(const previous of specs){
    if(previous.bank===bank)x=Math.max(x,previous.x+gap);
    for(const input of b.inputs)if(input.material===previous.block.outputs.material){
     // The bus travels east: every producer merge must precede every consumer takeoff.
     x=Math.max(x,previous.x+previous.block.outputs.producerPort.grid.x+3-input.routeTarget.grid.x);
    }
   }
   if(seed)x+=Math.floor(random()*8);
   specs.push({block:bank?mirrorBlock(b):b,bank,x});
  }
  let busRows=new Map(materials.map((n,i)=>[n,i*3]));
  const options=()=>{
   const bottom=Math.max(...busRows.values());
   const placements=Object.fromEntries(specs.map(s=>[s.block.id,{x:s.x,y:s.bank?bottom+4-s.block.footprint.top:-s.block.footprint.bottom-4}]));
   const right=Math.max(...specs.map(s=>s.x+s.block.footprint.right));
   return {blocks:specs.map(s=>s.block),placements,busRows,busStartX:0,busEndX:right+2,branchGap:8,inputBranchStart:0,outputBranchStart:right+8,localOutputMaterials:[],externalBusRanges:Object.fromEntries([...externals.map(n=>[n,{startX:0}]),...products.map(n=>[n,{endX:right+2}])]),trimBusRanges:true,outputMergeSplitters:false,inputBranchWestOffsets:{lane0:8,lane1:10},inputBranchEastOffset:12};
  };
  const preliminary=routeCompactBlocks(options());
  const intervals=preliminary.buses.map(b=>({material:b.material,start:b.startX-2,end:b.endX+2}));
  const colors=[];
  for(const i of intervals.sort((a,b)=>a.start-b.start||a.end-b.end)){
   let c=0;while(colors[c]?.some(o=>i.start<=o.end&&o.start<=i.end))c++;
   (colors[c]||=[]).push(i);i.color=c;
  }
  if(colorize)busRows=new Map(intervals.map(i=>[i.material,i.color*3]));
  const routed=routeCompactBlocks(options());
  const bounds=starterBounds(routed.entities,raw);
  return {routed,busRows,specs,score:bounds.width*bounds.height,parameters:{gap,offset,seed,colorize,busRows:colorize?colors.length:materials.length}};
 }
 const candidates=[],failures=[];
 for(const [gap,offset] of [[11,2],[13,5],[15,7],[21,9],[29,14]])for(let seed=0;seed<8;seed++)for(const colorize of [false]){
  try{candidates.push(layout(gap,offset,seed,colorize));}catch(e){failures.push(e.message);}
 }
 if(!candidates.length)throw Error('No route: '+failures.slice(0,5).join('\n'));
 candidates.sort((a,b)=>a.score-b.score);
 const best=candidates[0],{routed,busRows}=best;
 let entities=routed.entities,next=Math.max(...entities.map(e=>e.entity_number))+1;
 function add(name,x,y,extra={}){const e={entity_number:next++,name,position:{x,y},...extra};entities.push(e);return e;}
 const ports=[];
 for(const item of externals){
  const bus=routed.buses.find(b=>b.material===item);
  const e=entities.find(e=>e.name==='fast-transport-belt'&&e.position.x===bus.startX+.5&&e.position.y===busRows.get(item)+.5);
  if(!e)throw Error('Missing inlet '+item);
  ports.push({kind:'input',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west'});
 }
 const maxEnd=Math.max(...routed.buses.map(b=>b.endX));
 for(const product of products){
  const bus=routed.buses.find(b=>b.material===product),y=busRows.get(product)+.5;
  for(let x=bus.endX+1;x<=maxEnd;x++)add('fast-transport-belt',x+.5,y,{direction:4});
  const e=add('steel-chest',maxEnd+2.5,y,{bar:2});add('fast-inserter',maxEnd+1.5,y,{direction:12,override_stack_size:1});
  ports.push({kind:'output',label:product,items:[product],entity:e.entity_number,x:e.position.x,y:e.position.y,externalSide:'east',perMinute:rate});
 }
 ports.push({kind:'power',label:'P · External electricity',items:[],entity:0,x:.5,y:.5});
 const bp={item:'blueprint',version:562954249961472,label:`${config.id} · ${rate}/min`,entities,wires:[],icons:products.slice(0,4).map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
 const info={ports,setupNotes:['Connect external electricity. Feed each labeled material belt from the west.','All outputs are collected in labeled chests on the right. All input materials enter from the left.','AM2, fast inserters, red belts; no modules, robots, fluid inputs or inserter capacity research.']};
 const compact={}; powerStarterLayout(bp,ports,raw);
 addInputDisplays(bp,info,raw);
 for(const port of ports.filter(p=>p.kind==='output')){
  const occupied=(x,y)=>bp.entities.some(e=>Math.abs(e.position.x-x)<(e.name==='assembling-machine-2'?2:1)&&Math.abs(e.position.y-y)<(e.name==='assembling-machine-2'?2:1));
  const options=[[0,-1],[0,1],[1,0],[0,-2],[0,2]];
  const delta=options.find(([dx,dy])=>!occupied(port.x+dx,port.y+dy));if(!delta)continue;
  const id=Math.max(...bp.entities.map(e=>e.entity_number))+1;
  bp.entities.push({entity_number:id,name:'display-panel',position:{x:port.x+delta[0],y:port.y+delta[1]},icon:{type:'item',name:port.items[0]},text:`OUT: ${port.items[0]}\nTarget ${rate}/min`,always_show:true});
 }
 const audit=auditConnections(bp,raw),footprint=starterBounds(bp.entities,raw);
 bp.description=info.setupNotes.join('\n');
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 const code=encodeBlueprint({blueprint:bp});
 const id=config.id,file=id+'.txt';
 const inputs=ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:4,perMinute:demand[p.items[0]]}));
 const outputs=ports.filter(p=>p.kind==='output').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:rate}));
 const manifest={id,file,name:bp.label,blueprintSha256:hash(code),prototypeSha256:hash(rawBytes),gameVersion:'2.1.24',products,targetPerMinute:rate,inputs,outputs,ports,machineCounts:counts,recipeCraftsPerMinute:crafts,footprint,construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].sort().map(n=>[n,bp.entities.filter(e=>e.name===n).length])),setupNotes:info.setupNotes,optimization:{extraWireAssembler:process.env.SCIENCE_EXTRA_WIRE!=='0',headroom:Number(process.env.SCIENCE_HEADROOM||1.05),selected:best.parameters,validCandidates:candidates.length,rejectedCandidates:failures.length,bestBeforeCompaction:best.score,worstBeforeCompaction:candidates.at(-1).score,scope:'Bounded dependency-order, bank-spacing and bus-row-reuse search; not a global optimum'},compact,staticAudit:audit,status:'awaiting-native-validation'};
 await fs.writeFile(path.join(out,file),code+'\n');
 await fs.writeFile(path.join(out,id+'.json'),JSON.stringify({blueprint:bp},null,2)+'\n');
 manifests.push(manifest);
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifests,null,2)+'\n');
 console.log(JSON.stringify({id,footprint,counts,optimization:manifest.optimization}));
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifests,null,2)+'\n');
