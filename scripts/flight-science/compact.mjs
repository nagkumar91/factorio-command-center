// Local, separately controlled circulating belts. No global intermediate bus.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerStarterLayout,starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname),out=path.resolve(process.env.SCIENCE_OUTPUT||path.join(root,'.cache/flight-science/compact'));
const rawBytes=await fs.readFile(process.env.FACTORIO_RAW||path.join(root,'.cache/flight-21/script-output/data-raw-dump.json')),raw=JSON.parse(rawBytes);
const sha=s=>createHash('sha256').update(s).digest('hex');
await fs.mkdir(out,{recursive:true});
const old=JSON.parse(await fs.readFile(path.join(root,'blueprint-sources/flight-science/history/v1-bus/manifest.json')));
const entries=[];
for(const military of [false,true]){
 let next=1;const entities=[],wires=[],ports=[],blocks=[],occupied=new Map(),counts={};
 const key=(x,y)=>`${x},${y}`;
 function add(name,x,y,extra={}){
  const size=name==='assembling-machine-2'?3:1;
  for(let a=x-(size-1)/2;a<=x+(size-1)/2;a++)for(let b=y-(size-1)/2;b<=y+(size-1)/2;b++)assert(!occupied.has(key(a,b)),`${name} at ${x},${y} overlaps ${occupied.get(key(a,b))?.name} at ${a},${b}`);
  const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);
  for(let a=x-(size-1)/2;a<=x+(size-1)/2;a++)for(let b=y-(size-1)/2;b<=y+(size-1)/2;b++)occupied.set(key(a,b),e);
  return e;
 }
 const belt=(x,y,d,extra={})=>add('fast-transport-belt',x,y,{direction:d,...extra});
 const condition=(item,constant,comparator='<')=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator,constant}});
 const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
 const repeat=(recipe,n)=>Array(n).fill(recipe);
 function block({name,x,y,top,bottom,feeds,limits,exports=[],products=[]}){
  const slots=[];
  for(const [side,recipes]of [['top',top],['bottom',bottom]]){
   const gaps=feeds.filter(f=>f.side===side).map(f=>f.column);let left=2;
   for(const recipe of recipes){while(gaps.some(c=>c>=left&&c<=left+2))left++;
    slots.push({recipe,cx:left+1,cy:side==='top'?-3:6,side});left+=3;
   }
  }
  const width=Math.max(...slots.map(s=>s.cx+1),...feeds.map(f=>f.column+f.arms))+2;
  const loop=[];
  for(let a=0;a<=width;a++)loop.push(belt(x+a,y,a===width?8:4,{tags:{compact_block:name}}));
  for(let b=1;b<=3;b++)loop.push(belt(x+width,y+b,b===3?12:8,{tags:{compact_block:name}}));
  for(let a=width-1;a>=0;a--)loop.push(belt(x+a,y+3,a===0?0:12,{tags:{compact_block:name}}));
  for(let b=2;b>=1;b--)loop.push(belt(x,y+b,0,{tags:{compact_block:name}}));
  loop[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};
  const wire=(a,b)=>wires.push([a.entity_number,1,b.entity_number,1]);
  for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
  for(const s of slots){
   const m=add('assembling-machine-2',x+s.cx,y+s.cy,{recipe:s.recipe,tags:{compact_block:name}});counts[s.recipe]=(counts[s.recipe]||0)+1;
   const ay=s.side==='top'?-1:4,inputD=s.side==='top'?8:0;
   for(const dx of [-1,0])add('fast-inserter',x+s.cx+dx,y+ay,{direction:inputD,override_stack_size:1});
   const output=add('fast-inserter',x+s.cx+1,y+ay,{direction:(inputD+8)%16,override_stack_size:1,control_behavior:condition(s.recipe,limits[s.recipe])});
   assert(Number.isFinite(limits[s.recipe]),'Missing stock limit '+s.recipe);
   wire(output,occupied.get(key(x+s.cx+1,y+(s.side==='top'?0:3))));
  }
  const inlets={};
  for(const f of feeds){
   const mapY=v=>y+(f.side==='top'?v:3-v),d=f.side==='top'?8:0;
   for(let b=-5;b<=-3;b++)belt(x+f.column,mapY(b),d);
   add('fast-underground-belt',x+f.column,mapY(-2),{direction:d,type:'input'});
   add('fast-underground-belt',x+f.column,mapY(1),{direction:d,type:'output'});
   for(let a=0;a<=f.arms;a++)belt(x+f.column+a,mapY(2),4);
   for(let a=1;a<=f.arms;a++){
    const arm=add('fast-inserter',x+f.column+a,mapY(1),{direction:d,override_stack_size:1,...filter(f.item),control_behavior:condition(f.item,limits[f.item])});
    wire(arm,occupied.get(key(x+f.column+a,mapY(0))));
   }
   const e=occupied.get(key(x+f.column,mapY(-5)));
   const p={kind:'input',label:`${name} · ${f.item}`,items:[f.item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:d,externalSide:f.side==='top'?'north':'south',perMinute:f.rate,block:name};
   inlets[f.item]=p;if(!f.internal)ports.push(p);
  }
  const outlets={};
  for(const spec of exports){
   const right=spec.side==='right',ex=x+(right?width:0),ey=y+spec.row;
   const arm=add('fast-inserter',ex+(right?1:-1),ey,{direction:right?12:4,override_stack_size:1,...filter(spec.item),control_behavior:condition(spec.item,spec.reserve,'>')});
   wire(arm,occupied.get(key(ex,ey)));
   const b=belt(ex+(right?2:-2),ey,8);outlets[spec.item]={x:Math.floor(b.position.x),y:Math.floor(b.position.y)};
  }
  for(const [i,item]of products.entries()){
   const columns=name==='Science'?[28,width-3,8]:[11];
   const a=x+columns[i],bottomOutput=name==='Science'&&item==='chemical-science-pack';
   add('fast-inserter',a,y+(bottomOutput?2:1),{direction:bottomOutput?8:0,override_stack_size:1,...filter(item)});
   const chest=add('wooden-chest',a,y+(bottomOutput?1:2),{bar:1});
   ports.push({kind:'output',label:item,items:[item],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,block:name});
  }
  const capacity=loop.length*8,stock=Object.values(limits).reduce((a,b)=>a+b,0);
  assert(stock<capacity*.75,`${name} loop overcommitted: ${stock}/${capacity}`);
  const controlled=entities.filter(e=>e.name==='fast-inserter'&&e.control_behavior&&e.position.x>=x-1&&e.position.x<=x+width+2&&e.position.y>=y-1&&e.position.y<=y+4).map(e=>e.entity_number);
  const result={name,x,y,width,inlets,outlets,limits,controlled,reader:loop[0].entity_number,loop:loop.map(e=>e.entity_number),capacity,maximumStock:stock};blocks.push(result);return result;
 }
 const circuits=block({name:'Circuits',x:0,y:0,
  top:['copper-cable','electronic-circuit','copper-cable','advanced-circuit','copper-cable','advanced-circuit','electronic-circuit','copper-cable','advanced-circuit','advanced-circuit','copper-cable','advanced-circuit','advanced-circuit','electronic-circuit'],
  bottom:['copper-cable','advanced-circuit','electronic-circuit','copper-cable','advanced-circuit','copper-cable','advanced-circuit','advanced-circuit','electronic-circuit','copper-cable','advanced-circuit','advanced-circuit','copper-cable','advanced-circuit'],
  feeds:[{item:'copper-plate',side:'top',column:2,arms:5,rate:540},{item:'iron-plate',side:'top',column:22,arms:3,rate:240},{item:'plastic-bar',side:'bottom',column:32,arms:2,rate:180}],
  limits:{'copper-plate':120,'iron-plate':64,'plastic-bar':48,'copper-cable':140,'electronic-circuit':80,'advanced-circuit':48},
  exports:[{item:'electronic-circuit',side:'right',row:1,reserve:30},{item:'advanced-circuit',side:'left',row:2,reserve:8}]});
 const engines=block({name:'Engines',x:circuits.width+8,y:0,top:['iron-gear-wheel',...repeat('engine-unit',7),'pipe'],bottom:['pipe',...repeat('engine-unit',7)],
  feeds:[{item:'iron-plate',side:'top',column:2,arms:3,rate:240},{item:'steel-plate',side:'bottom',column:16,arms:1,rate:60}],
  limits:{'iron-plate':64,'steel-plate':30,'iron-gear-wheel':24,pipe:40,'engine-unit':30},exports:[{item:'engine-unit',side:'left',row:2,reserve:4}]});
 const scienceX=-4,scienceY=16;
 const science=block({name:'Science',x:scienceX,y:scienceY,
  top:[...repeat('automation-science-pack',7),'iron-gear-wheel','transport-belt','inserter',...repeat('logistic-science-pack',9)],
  bottom:['iron-gear-wheel',...repeat('chemical-science-pack',17)],
  feeds:[{item:'advanced-circuit',side:'top',column:2,arms:1,rate:90,internal:true},{item:'iron-plate',side:'top',column:15,arms:4,rate:390},{item:'copper-plate',side:'top',column:30,arms:1,rate:60},{item:'electronic-circuit',side:'top',column:circuits.width+6,arms:1,rate:60,internal:true},{item:'engine-unit',side:'top',column:engines.x+2,arms:1,rate:60,internal:true},{item:'sulfur',side:'bottom',column:40,arms:1,rate:30}],
  limits:{'iron-plate':200,'copper-plate':64,sulfur:24,'iron-gear-wheel':80,'transport-belt':24,inserter:24,'electronic-circuit':64,'advanced-circuit':60,'engine-unit':40,'automation-science-pack':32,'logistic-science-pack':32,'chemical-science-pack':32},
  products:['automation-science-pack','logistic-science-pack','chemical-science-pack']});
 for(const [source,item]of [[circuits,'electronic-circuit'],[circuits,'advanced-circuit'],[engines,'engine-unit']]){
  const a=source.outlets[item],b=science.inlets[item];assert(a.x===Math.floor(b.x),'unaligned bridge '+item);
  for(let y=a.y+1;y<Math.floor(b.y);y++)belt(a.x,y,8);
 }
 if(military)block({name:'Military',x:science.x+science.width+6,y:scienceY,
  top:['firearm-magazine',...repeat('piercing-rounds-magazine',3),...repeat('grenade',5)],bottom:['grenade',...repeat('military-science-pack',7)],
  feeds:[{item:'iron-plate',side:'top',column:2,arms:3,rate:270},{item:'coal',side:'top',column:15,arms:3,rate:300},{item:'copper-plate',side:'bottom',column:8,arms:1,rate:30},{item:'steel-plate',side:'bottom',column:22,arms:1,rate:15},{item:'stone-wall',side:'bottom',column:27,arms:1,rate:60}],
  limits:{'iron-plate':48,'copper-plate':20,'steel-plate':16,'stone-wall':24,coal:64,'firearm-magazine':24,'piercing-rounds-magazine':24,grenade:24,'military-science-pack':16},products:['military-science-pack']});
 const id=military?'rgb-military-60':'rgb-60',products=['automation-science-pack','logistic-science-pack','chemical-science-pack',...(military?['military-science-pack']:[])];
 ports.push({kind:'power',label:'P · External electricity',items:[],entity:0,x:0,y:0});
 const bp={item:'blueprint',version:562954249961472,label:`Compact flight science · ${military?'RGB + military':'RGB'} · 60/min`,entities,wires:[],icons:products.map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
 // Search the full occupied width: local entrances can sit east of the leftmost consumers.
 powerStarterLayout(bp,[...ports,{kind:'input',x:Math.floor(Math.min(...entities.map(e=>e.position.x)))-1,y:-8}],raw);bp.wires.push(...wires);
 // Signs are placed after power so no decorative entity displaces a necessary pole.
 let displayId=Math.max(...bp.entities.map(e=>e.entity_number))+1;
 function freeSign(x,y){return !bp.entities.some(e=>Math.abs(e.position.x-x)<(e.name==='assembling-machine-2'?2:e.name==='big-electric-pole'?1.5:1)&&Math.abs(e.position.y-y)<(e.name==='assembling-machine-2'?2:e.name==='big-electric-pole'?1.5:1));}
 for(const p of ports.filter(p=>p.kind!=='power')){
  const candidates=[[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1],[2,0],[-2,0]];
  const delta=candidates.find(([dx,dy])=>freeSign(p.x+dx,p.y+dy));if(!delta)continue;
  const e={entity_number:displayId++,name:'display-panel',position:{x:p.x+delta[0],y:p.y+delta[1]},icon:{type:'item',name:p.items[0]},text:p.kind==='input'?`${p.label}\nFeed from ${p.externalSide}: ${p.perMinute}/min at target`:`OUT: ${p.label}`,always_show:true};bp.entities.push(e);p.displayEntity=e.entity_number;
 }
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 bp.description='60/min each colour. AM2, fast inserters and red belts. Circuit network REQUIRED: keep red wires and belt stock controls intact. Separate labeled local plate entrances. No modules, robots, oil or water. Collect all science chests.';
 const code=encodeBlueprint({blueprint:bp}),footprint=starterBounds(bp.entities,raw);
 const manifest={...old.find(m=>m.id===id),id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(rawBytes),products,inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:p.direction,perMinute:p.perMinute,block:p.block})),outputs:ports.filter(p=>p.kind==='output').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:60})),ports,footprint,machineCounts:counts,construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length])),loopControl:blocks.map(({inlets,outlets,...b})=>b),setupNotes:[bp.description],optimization:{kind:'local-stock-controlled-loops',baselineArea:old.find(m=>m.id===id).footprint.width*old.find(m=>m.id===id).footprint.height,area:footprint.width*footprint.height},status:'awaiting-native-validation'};
 delete manifest.measuredOutputsPerMinute;delete manifest.compact;delete manifest.staticAudit;delete manifest.comparisonFile;
 await fs.writeFile(path.join(out,id+'.txt'),code+'\n');await fs.writeFile(path.join(out,id+'.json'),JSON.stringify({blueprint:bp},null,2)+'\n');entries.push(manifest);
 console.log(JSON.stringify({id,footprint,machines:Object.values(counts).reduce((a,b)=>a+b,0),blocks:blocks.map(b=>({name:b.name,width:b.width,stock:b.maximumStock,capacity:b.capacity}))}));
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(entries,null,2)+'\n');
