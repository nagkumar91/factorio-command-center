import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {makeCompactRecipeBlock} from '../science-factory/local-ports/compact-recipe-blocks.mjs';
import {routeCompactBlocks} from '../science-factory/local-ports/deterministic-main-bus.mjs';
import {compactStarterLayout,auditConnections,starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
import {addInputDisplays} from '../science-factory/local-ports/port-displays.mjs';
import {mirrorBlock} from './mirror.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const rawPath=process.env.FACTORIO_RAW || new URL('../../.cache/flight-21/script-output/data-raw-dump.json',import.meta.url);
const rawBytes=await fs.readFile(rawPath),raw=JSON.parse(rawBytes);
const hash=s=>createHash('sha256').update(s).digest('hex');
const out=path.resolve(process.env.SCIENCE_OUTPUT || path.join(root,'blueprint-sources/flight-science'));
await fs.mkdir(out,{recursive:true});
const manifests=process.env.SCIENCE_ONLY==='military'?JSON.parse(await fs.readFile(path.join(out,'manifest.json'))).filter(m=>m.id==='rgb-60'):[];
for(const military of (process.env.SCIENCE_ONLY==='military'||process.env.SCIENCE_MODULE==='military'?[true]:[false,true])) {
 const products=process.env.SCIENCE_MODULE==='military'?['military-science-pack']:['automation-science-pack','logistic-science-pack','chemical-science-pack',...(military?['military-science-pack']:[])];
 const externals=process.env.SCIENCE_MODULE==='military'?['iron-plate','copper-plate','steel-plate','stone-wall','coal']:['iron-plate','copper-plate','steel-plate','plastic-bar','sulfur',...(military?['stone-wall','coal']:[])];
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
 for(const p of products)expand(p,60);
 // Minimum whole-machine counts; one extra cable assembler prevents shared buffer filling from starving blue science.
 const counts=Object.fromEntries(order.map(n=>[n,Math.ceil(crafts[n]*(raw.recipe[n].energy_required||.5)/45*Number(process.env.SCIENCE_HEADROOM||1)-1e-8)]));
 if(counts['copper-cable']&&process.env.SCIENCE_EXTRA_WIRE!=='0')counts['copper-cable']++;
 const originals=[];
 for(const id of order){
  const r=raw.recipe[id];let remaining=counts[id],part=0;
  while(remaining){
   let b,used;
   for(let size=Math.min(8,remaining);size>=1;size--){
    try{b=makeCompactRecipeBlock({id:`recipe-block-${id}-${part}`,recipe:{id,time:r.energy_required||.5,ingredients:r.ingredients.map(i=>({id:i.name,amount:i.amount})),results:r.results.map(i=>({id:i.name,amount:i.amount}))},machine:'assembling-machine-2',machines:size,maxRows:8,utilization:1,inwardInputs:true,pitch:3,westLanePickup:'outside'});used=size;break;}catch(e){if(size===1)throw e;}
   }
   if(products.includes(id)){
    const top=b.outputs.collector.top;
    for(const belt of b.belts.filter(e=>e.role==='output-collector')) {belt.direction=belt.grid.y===top?4:0;b.entities.find(e=>e.entity_number===belt.entity).direction=belt.direction;}
    b.outputs.producerPort.grid.y=top;b.outwardOutput=true;
   }
   originals.push(b);remaining-=used;part++;
  }
 }
 const materials=[...externals,...order.filter(n=>!products.includes(n))];
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
   return {blocks:specs.map(s=>s.block),placements,busRows,busStartX:0,busEndX:right+2,branchGap:8,inputBranchStart:0,outputBranchStart:right+8,localOutputMaterials:products,trimBusRanges:true,outputMergeSplitters:false,inputBranchWestOffsets:{lane0:8,lane1:10},inputBranchEastOffset:12};
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
 for(const [gap,offset] of [[11,2],[13,5],[15,7],[21,9],[29,14]])for(let seed=0;seed<30;seed++)for(const colorize of [true]){
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
 for(const product of products){
  // Multiple blocks for one product have separate labeled collectors, measured together.
  for(const route of routed.routes.filter(r=>r.kind==='local-output'&&r.material===product)){
   const t=route.target.grid;
   const e=add('wooden-chest',t.x+2.5,t.y+.5,{bar:1});
   add('fast-inserter',t.x+1.5,t.y+.5,{direction:12});
   ports.push({kind:'output',label:product,items:[product],entity:e.entity_number,x:e.position.x,y:e.position.y,externalSide:'north'});
  }
 }
 ports.push({kind:'power',label:'P · External electricity',items:[],entity:0,x:.5,y:.5});
 const bp={item:'blueprint',version:562954249961472,label:`Flight science · ${military?'RGB + military':'RGB'} · 60/min each`,entities,wires:[],icons:products.map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
 const info={ports,setupNotes:['Connect external electricity. Feed each labeled material belt from the west.','Outputs are labeled local chests; collect every science colour continuously.','AM2, fast inserters, red belts; no modules, robots, fluid inputs or inserter capacity research.']};
 const compact=compactStarterLayout(bp,ports,raw);
 addInputDisplays(bp,info,raw);
 for(const port of ports.filter(p=>p.kind==='output')){
  const occupied=(x,y)=>bp.entities.some(e=>Math.abs(e.position.x-x)<(e.name==='assembling-machine-2'?2:1)&&Math.abs(e.position.y-y)<(e.name==='assembling-machine-2'?2:1));
  const options=[[0,-1],[0,1],[1,0],[0,-2],[0,2]];
  const delta=options.find(([dx,dy])=>!occupied(port.x+dx,port.y+dy));if(!delta)continue;
  const id=Math.max(...bp.entities.map(e=>e.entity_number))+1;
  bp.entities.push({entity_number:id,name:'display-panel',position:{x:port.x+delta[0],y:port.y+delta[1]},icon:{type:'item',name:port.items[0]},text:`OUT: ${port.items[0]}\nCombined target 60/min across all matching chests`,always_show:true});
 }
 const audit=auditConnections(bp,raw),footprint=starterBounds(bp.entities,raw);
 bp.description=info.setupNotes.join('\n');
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 const code=encodeBlueprint({blueprint:bp});
 const id=process.env.SCIENCE_MODULE==='military'?'military-module-60':military?'rgb-military-60':'rgb-60',file=id+'.txt';
 const inputs=ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:4,perMinute:demand[p.items[0]]}));
 const outputs=ports.filter(p=>p.kind==='output').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:60}));
 const manifest={id,file,name:bp.label,blueprintSha256:hash(code),prototypeSha256:hash(rawBytes),gameVersion:'2.1.24',products,targetPerMinute:60,inputs,outputs,ports,machineCounts:counts,recipeCraftsPerMinute:crafts,footprint,construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].sort().map(n=>[n,bp.entities.filter(e=>e.name===n).length])),setupNotes:info.setupNotes,optimization:{extraWireAssembler:process.env.SCIENCE_EXTRA_WIRE!=='0',headroom:Number(process.env.SCIENCE_HEADROOM||1),selected:best.parameters,validCandidates:candidates.length,rejectedCandidates:failures.length,bestBeforeCompaction:best.score,worstBeforeCompaction:candidates.at(-1).score,scope:'Bounded dependency-order, bank-spacing and bus-row-reuse search; not a global optimum'},compact,staticAudit:audit,status:'awaiting-native-validation'};
 await fs.writeFile(path.join(out,file),code+'\n');
 await fs.writeFile(path.join(out,id+'.json'),JSON.stringify({blueprint:bp},null,2)+'\n');
 manifests.push(manifest);
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifests,null,2)+'\n');
 console.log(JSON.stringify({id,footprint,counts,inputs,optimization:manifest.optimization}));
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifests,null,2)+'\n');
