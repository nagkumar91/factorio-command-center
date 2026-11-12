// Local, separately controlled circulating belts. No global intermediate bus.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../../../../../scripts/blueprints.mjs';
import {powerStarterLayout,starterBounds} from '../../../../../scripts/science-factory/local-ports/compact-shared-layout.mjs';
const root=fileURLToPath(new URL('../../../../../',import.meta.url)),out=path.resolve(process.env.ROBOT_OUTPUT||path.join(root,'.cache/frame-workshop/candidate'));
const rawBytes=await fs.readFile(process.env.FACTORIO_RAW||path.join(root,'.cache/flight-21/script-output/data-raw-dump.json')),raw=JSON.parse(rawBytes);
const sha=s=>createHash('sha256').update(s).digest('hex');
await fs.mkdir(out,{recursive:true});

const entries=[];
{
 let next=1;const entities=[],wires=[],ports=[],blocks=[],occupied=new Map(),counts={};
 const key=(x,y)=>`${x},${y}`;
 function add(name,x,y,extra={}){
  const size=['assembling-machine-2','chemical-plant'].includes(name)?3:1;
  for(let a=x-(size-1)/2;a<=x+(size-1)/2;a++)for(let b=y-(size-1)/2;b<=y+(size-1)/2;b++)assert(!occupied.has(key(a,b)),`${name} at ${x},${y} overlaps ${occupied.get(key(a,b))?.name} at ${a},${b}`);
  const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);
  for(let a=x-(size-1)/2;a<=x+(size-1)/2;a++)for(let b=y-(size-1)/2;b<=y+(size-1)/2;b++)occupied.set(key(a,b),e);
  return e;
 }
 const belt=(x,y,d,extra={})=>add('fast-transport-belt',x,y,{direction:d,...extra});
 const condition=(item,constant,comparator='<')=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator,constant}});
 const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
 const repeat=(recipe,n)=>Array(n).fill(recipe);
 function block({name,x,y,top,bottom,feeds,limits}){
  const slots=[];
  for(const [side,recipes]of [['top',top],['bottom',bottom]]){
   const gaps=feeds.filter(f=>f.side===side).map(f=>f.column);let left=side==='bottom'?15:10;
   let previous;
   for(const recipe of recipes){if(side==='top'&&((previous==='battery'&&recipe==='battery')||(previous==='copper-cable'&&recipe==='electronic-circuit')||(previous==='electronic-circuit'&&recipe==='copper-cable')))left++;while(gaps.some(c=>c>=left&&c<=left+2))left++;
    slots.push({recipe,cx:left+1,cy:side==='top'?-3:6,side});left+=3;previous=recipe;
   }
  }
  const width=Math.max(...slots.map(s=>s.cx+1),...feeds.map(f=>f.column+f.arms))+2;
  const loop=[];
  for(let a=0;a<=width;a++)loop.push(belt(x+a,y,4,{tags:{compact_block:name}}));
  loop.push(belt(x+width,y+3,12,{tags:{compact_block:name}}));
  for(let a=width-1;a>=0;a--)loop.push(belt(x+a,y+3,a===0?0:12,{tags:{compact_block:name}}));
  for(let b=2;b>=1;b--)loop.push(belt(x,y+b,0,{tags:{compact_block:name}}));
  loop[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
  const wire=(a,b)=>wires.push([a.entity_number,1,b.entity_number,1]);
  for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
  // Rebalance both lanes at the end: split the stream, then side-load each lane.
  const splitter=add('fast-splitter',x+width+1,y,{position:{x:x+width+1.5,y:y+1},direction:4});
  assert(!occupied.has(key(x+width+1,y+1)));occupied.set(key(x+width+1,y+1),splitter);
  const extraBelt=(dx,dy,d)=>{const e=belt(x+width+dx,y+dy,d,{tags:{compact_block:name}});const nearest=[...loop].sort((a,b)=>Math.hypot(a.position.x-e.position.x,a.position.y-e.position.y)-Math.hypot(b.position.x-e.position.x,b.position.y-e.position.y))[0];wire(e,nearest);loop.push(e);return e;};
  for(const [dx,dy,d]of [[2,0,4],[3,0,8],[3,1,8],[3,2,8],[3,3,12],[2,3,12],[1,3,12],[4,3,12],[2,1,8],[2,5,4],[3,5,0],[3,4,0]].filter(([dx])=>process.env.ROBOT_BALANCER_DUMMY==='1'||dx!==4))extraBelt(dx,dy,d);
  add('fast-underground-belt',x+width+2,y+2,{direction:8,type:'input'});
  add('fast-underground-belt',x+width+2,y+4,{direction:8,type:'output'});

  for(const s of slots){
   const m=add(s.recipe==='battery'?'chemical-plant':'assembling-machine-2',x+s.cx,y+s.cy,{recipe:s.recipe,tags:{compact_block:name}});counts[s.recipe]=(counts[s.recipe]||0)+1;
   if(s.recipe==='electric-engine-unit'){m.tags.lubricant=true;m.direction=8;}
   if(s.recipe==='battery')m.direction=8;
   const ay=s.side==='top'?-1:4,inputD=s.side==='top'?8:0;
   for(const dx of (s.recipe==='battery'?[0]:s.recipe==='copper-cable'?[]:[-1,0]))add('fast-inserter',x+s.cx+dx,y+ay,{direction:inputD,override_stack_size:1});
   const outputDx=s.recipe==='battery'?-1:1;
   const output=add('fast-inserter',x+s.cx+outputDx,y+ay,{direction:(inputD+8)%16,override_stack_size:1,control_behavior:condition(s.recipe,limits[s.recipe])});
   assert(Number.isFinite(limits[s.recipe]),'Missing stock limit '+s.recipe);
   wire(output,occupied.get(key(x+s.cx+outputDx,y+(s.side==='top'?0:3))));
   if(s.recipe==='roboport')for(const dx of [-1,0]){
    const arm=occupied.get(key(x+s.cx+dx,y+ay));arm.control_behavior=condition('advanced-circuit',24,'>');wire(arm,occupied.get(key(x+s.cx+dx,y+(s.side==='top'?0:3))));
   }

  }
  // Direct copper-wire transfers keep high-volume cable off the circulation belt.
  const upper=slots.filter(s=>s.side==='top');
  for(let i=1;i<upper.length;i++){
   const a=upper[i-1],b=upper[i];if(b.cx-a.cx!==4)continue;
   if(!((a.recipe==='copper-cable'&&b.recipe==='electronic-circuit')||(a.recipe==='electronic-circuit'&&b.recipe==='copper-cable')))continue;
   for(const dy of [-1,0])add('fast-inserter',x+a.cx+2,y+a.cy+dy,{direction:a.recipe==='copper-cable'?12:4,override_stack_size:1,...filter('copper-cable')});
  }
  const inlets={};
  for(const f of feeds){
   const mapY=v=>y+(f.side==='top'?v:3-v),d=f.side==='top'?8:0;
   for(let b=-5;b<=-3;b++)belt(x+f.column,mapY(b),d);
   if(f.inner){
    for(let a=0;a<=f.arms;a++)belt(x+f.column+a,mapY(-2),4);
    for(let a=1;a<=f.arms;a++){
     const arm=add('fast-inserter',x+f.column+a,mapY(-1),{direction:(d+8)%16,override_stack_size:1,...filter(f.item),control_behavior:condition(f.item,limits[f.item])});
     wire(arm,occupied.get(key(x+f.column+a,mapY(0))));
    }
   }else{
   add('fast-underground-belt',x+f.column,mapY(-2),{direction:d,type:'input'});
   add('fast-underground-belt',x+f.column,mapY(1),{direction:d,type:'output'});
   for(let a=0;a<=f.arms;a++)belt(x+f.column+a,mapY(2),4);
   for(let a=1;a<=f.arms;a++){
    const arm=add('fast-inserter',x+f.column+a,mapY(1),{direction:d,override_stack_size:1,...filter(f.item),control_behavior:condition(f.item,limits[f.item])});
    wire(arm,occupied.get(key(x+f.column+a,mapY(0))));
   }
   }
   const e=occupied.get(key(x+f.column,mapY(-5)));
   const p={kind:'input',label:`${name} · ${f.item}`,items:[f.item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:d,externalSide:f.side==='top'?'north':'south',perMinute:f.rate,block:name};
   inlets[f.item]=p;if(!f.internal)ports.push(p);
  }
  const capacity=loop.length*8,stock=Object.values(limits).reduce((a,b)=>a+b,0);
  assert(stock<capacity*.75,`${name} loop overcommitted: ${stock}/${capacity}`);
  const controlled=entities.filter(e=>e.name==='fast-inserter'&&e.control_behavior&&e.position.x>=x-1&&e.position.x<=x+width+2&&e.position.y>=y-1&&e.position.y<=y+4).map(e=>e.entity_number);
  const result={name,x,y,width,inlets,limits,controlled,reader:loop[0].entity_number,loop:loop.map(e=>e.entity_number),capacity,maximumStock:stock};blocks.push(result);return result;
 }
 const workshop=block({name:'Robots',x:0,y:0,
  top:[...repeat('battery',3),...Array.from({length:2},()=>['copper-cable','electronic-circuit','copper-cable']).flat(),'iron-gear-wheel','pipe'],
  bottom:[...repeat('flying-robot-frame',Number(process.env.ROBOT_FRAMES||9)),...repeat('electric-engine-unit',Number(process.env.ROBOT_MOTORS||5)),...repeat('engine-unit',Number(process.env.ROBOT_ENGINES||5))],
  feeds:[{item:'iron-plate',side:'top',column:2,arms:4,rate:220},{item:'steel-plate',side:'bottom',column:7,arms:1,rate:40}],
  limits:{'iron-plate':160,'plastic-bar':64,'steel-plate':64,battery:48,'copper-cable':80,'electronic-circuit':224,'advanced-circuit':80,'iron-gear-wheel':32,pipe:24,'engine-unit':24,'electric-engine-unit':24,'flying-robot-frame':16,'construction-robot':8,'logistic-robot':8,roboport:2}});
 // Independent acid header north of batteries and lubricant south of motors.
 for(const [recipe,item,rate]of [['electric-engine-unit','lubricant',300]]){
  const wet=entities.filter(e=>e.recipe===recipe),xs=wet.map(e=>Math.floor(e.position.x));
  // AM2 takes fluid at centre; chemical plant input is one tile left of centre.
  const offset=recipe==='battery'?-1:0,py=recipe==='battery'?-5:8;
  for(let x=Math.min(...xs)+offset;x<=Math.max(...xs)+offset;x++)add('pipe',x,py);
  const fluid=add('pipe',Math.min(...xs)+offset,py+(py<0?-1:1));
  ports.push({kind:'fluid',label:item+' · '+rate+'/min at target',items:[item],entity:fluid.entity_number,x:fluid.position.x,y:fluid.position.y,externalSide:py<0?'north':'south',perMinute:rate});
 }
 // Copper has a dedicated rear belt: it does not compete with iron/plastic
 // for one circulating lane. Each copper consumer receives plates directly.
 const copperMachines=entities.filter(e=>['battery','copper-cable'].includes(e.recipe));
 const copperPort=belt(9,-7,8);
 for(let x=9;x<=Math.max(...copperMachines.map(e=>Math.floor(e.position.x)));x++)belt(x,-6,4);
 for(const m of copperMachines)add('fast-inserter',Math.floor(m.position.x),-5,{direction:0,override_stack_size:1,...filter('copper-plate')});
 ports.push({kind:'input',label:'Copper plates · dedicated supply belt',items:['copper-plate'],entity:copperPort.entity_number,x:copperPort.position.x,y:copperPort.position.y,direction:8,externalSide:'north',perMinute:190,block:'Copper supply'});
 // South-facing battery fluid ports pass underneath the loop into one acid header.
 const batteryColumns=entities.filter(e=>e.recipe==='battery').map(e=>Math.floor(e.position.x)+1);
 for(const x of batteryColumns){add('pipe-to-ground',x,-1,{direction:0});add('pipe-to-ground',x,1,{direction:8});}
 for(let x=Math.min(...batteryColumns);x<=Math.max(...batteryColumns);x++)add('pipe',x,2);
 // The narrow gap between battery plants provides an exterior acid connection.
 add('pipe-to-ground',13,-1,{direction:0});add('pipe-to-ground',13,1,{direction:8});
 for(let y=-5;y<=-2;y++)add('pipe',13,y);
 add('pipe-to-ground',12,-5,{direction:4});add('pipe-to-ground',4,-5,{direction:12});add('pipe',3,-5);
 const acid=add('pipe',3,-6);
 ports.push({kind:'fluid',label:'Sulfuric acid · 800/min at target',items:['sulfuric-acid'],entity:acid.entity_number,x:acid.position.x,y:acid.position.y,externalSide:'north',perMinute:800});
 // One shared chest, three filtered collection arms, each with its own stock cap.
 const products=['flying-robot-frame'];
 const chest=add('steel-chest',10,9),caps=[200,200,20];
 for(const [i,item]of products.entries()){
  const x=8+i*2;
  add('fast-inserter',x,4,{direction:0,override_stack_size:1,...filter(item)});
  for(let y=5;y<=(i===1?7:9);y++)belt(x,y,i===0&&y===9?4:i===2&&y===9?12:8);
  const arm=add('fast-inserter',i===0?9:i===1?10:11,i===1?8:9,{direction:i===0?12:i===1?0:4,override_stack_size:1,...filter(item),control_behavior:condition(item,caps[i])});
  wires.push([chest.entity_number,1,arm.entity_number,1]);
  if(i===0)ports.push({kind:'output',label:'Output chest · 200 flying robot frames',items:products,entity:chest.entity_number,x:chest.position.x,y:chest.position.y,caps});
 }
 const id='frames-20';
 ports.push({kind:'power',label:'P · External electricity',items:[],entity:0,x:0,y:0});
 const bp={item:'blueprint',version:562954249961472,label:'Compact flying robot frames · 20/min',entities,wires:[],icons:products.map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
 // Search the full occupied width: local entrances can sit east of the leftmost consumers.
 powerStarterLayout(bp,[...ports,{kind:'input',x:Math.floor(Math.min(...entities.map(e=>e.position.x)))-1,y:-8}],raw);bp.wires.push(...wires);
 // Signs are placed after power so no decorative entity displaces a necessary pole.
 let displayId=Math.max(...bp.entities.map(e=>e.entity_number))+1;
 function freeSign(x,y){return !bp.entities.some(e=>Math.abs(e.position.x-x)<(['assembling-machine-2','chemical-plant'].includes(e.name)?2:e.name==='big-electric-pole'?1.5:1)&&Math.abs(e.position.y-y)<(['assembling-machine-2','chemical-plant'].includes(e.name)?2:e.name==='big-electric-pole'?1.5:1));}
 for(const p of ports.filter(p=>p.kind!=='power')){
  const candidates=[[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1],[2,0],[-2,0]];
  const delta=candidates.find(([dx,dy])=>freeSign(p.x+dx,p.y+dy));if(!delta)continue;
  const e={entity_number:displayId++,name:'display-panel',position:{x:p.x+delta[0],y:p.y+delta[1]},icon:{type:p.kind==='fluid'?'fluid':'item',name:p.items[0]},text:['input','fluid'].includes(p.kind)?`${p.label}\nFeed from ${p.externalSide}: ${p.perMinute}/min at target`:`OUT: ${p.label}`,always_show:true};bp.entities.push(e);p.displayEntity=e.entity_number;
 }
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 bp.description='Experimental dedicated flying robot frame workshop. Target20/min. Feed iron220, copper190, steel40, acid800 and lubricant300 per minute. AM2, fast inserters, red belts; no modules. Preserve stock-control wires.';
 const required={};const boundary=new Set(ports.filter(p=>['input','fluid'].includes(p.kind)).map(p=>p.items[0]));
 function expand(item,amount){if(boundary.has(item)){required[item]=(required[item]||0)+amount;return;}const r=raw.recipe[item];assert(r,'missing intermediate recipe '+item);const yieldAmount=r.results.find(p=>p.name===item).amount;for(const i of r.ingredients)expand(i.name,amount*i.amount/yieldAmount);}
 expand('flying-robot-frame',20);
 for(const p of ports.filter(p=>['input','fluid'].includes(p.kind)))assert(Math.abs(required[p.items[0]]-p.perMinute)<1e-6,'incorrect input rate '+p.items[0]);
 const code=encodeBlueprint({blueprint:bp}),footprint=starterBounds(bp.entities,raw);
 const manifest={id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(rawBytes),products,targets:{'flying-robot-frame':20},inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:p.direction,perMinute:p.perMinute,block:p.block})),fluids:ports.filter(p=>p.kind==='fluid').map(p=>({item:p.items[0],entity:p.entity,perMinute:p.perMinute})),outputs:ports.filter(p=>p.kind==='output').flatMap(p=>p.items.map((item,i)=>({item,entity:p.entity,position:{x:p.x,y:p.y},cap:p.caps[i]}))),ports,footprint,machineCounts:counts,construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length])),loopControl:blocks.map(({inlets,...b})=>b),setupNotes:[bp.description],status:'see-exact-hash-native-report'};
 await fs.writeFile(path.join(out,id+'.txt'),code+'\n');await fs.writeFile(path.join(out,id+'.json'),JSON.stringify({blueprint:bp},null,2)+'\n');entries.push(manifest);
 console.log(JSON.stringify({id,footprint,machines:Object.values(counts).reduce((a,b)=>a+b,0),blocks:blocks.map(b=>({name:b.name,width:b.width,stock:b.maximumStock,capacity:b.capacity}))}));
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(entries,null,2)+'\n');
