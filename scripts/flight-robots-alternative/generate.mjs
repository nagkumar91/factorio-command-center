// Local, separately controlled circulating belts. No global intermediate bus.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerStarterLayout,starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname),out=path.resolve(process.env.ROBOT_OUTPUT||path.join(root,'.cache/flight-robots-alternative/candidate'));
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
 function block({name,x,y,top,bottom,feeds,limits,exports=[],products=[]}){
  const slots=[];
  for(const [side,recipes]of [['top',top],['bottom',bottom]]){
   const gaps=feeds.filter(f=>f.side===side).map(f=>f.column);let left=name==='Circuits'?20:10;
   for(const recipe of recipes){while(gaps.some(c=>c>=left&&c<=left+2))left++;
    slots.push({recipe,cx:left+1,cy:side==='top'?-3:6,side});left+=name==='Circuits'&&side==='top'?4:3;
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
   const m=add(s.recipe==='battery'?'chemical-plant':'assembling-machine-2',x+s.cx,y+s.cy,{recipe:s.recipe,tags:{compact_block:name}});counts[s.recipe]=(counts[s.recipe]||0)+1;if(s.recipe==='electric-engine-unit')m.direction=8;
   const ay=s.side==='top'?-1:4,inputD=s.side==='top'?8:0;
   for(const dx of [-1,0])add('fast-inserter',x+s.cx+dx,y+ay,{direction:inputD,override_stack_size:1});
   const output=add('fast-inserter',x+s.cx+1,y+ay,{direction:(inputD+8)%16,override_stack_size:1,control_behavior:condition(s.recipe,limits[s.recipe])});
   assert(Number.isFinite(limits[s.recipe]),'Missing stock limit '+s.recipe);
   wire(output,occupied.get(key(x+s.cx+1,y+(s.side==='top'?0:3))));
  }
  const inlets={};
  for(const f of feeds){
   if(name==='Circuits'&&f.item==='iron-plate'){
    for(let yy=-5;yy<=-3;yy++)belt(x+f.column,y+yy,8);
    for(let a=0;a<=f.arms;a++)belt(x+f.column+a,y-2,4);
    for(let a=1;a<=f.arms;a++){
     const arm=add('fast-inserter',x+f.column+a,y-1,{direction:0,override_stack_size:1,...filter(f.item),control_behavior:condition(f.item,limits[f.item])});
     wire(arm,occupied.get(key(x+f.column+a,y)));
    }
    const e=occupied.get(key(x+f.column,y-5));
    const p={kind:'input',label:f.item,items:[f.item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:8,externalSide:'north',perMinute:f.rate,block:name};inlets[f.item]=p;ports.push(p);continue;
   }
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
  assert(stock<capacity*.85,`${name} loop overcommitted: ${stock}/${capacity}`);
  const controlled=entities.filter(e=>e.name==='fast-inserter'&&e.control_behavior&&e.position.x>=x-1&&e.position.x<=x+width+2&&e.position.y>=y-1&&e.position.y<=y+4).map(e=>e.entity_number);
  const result={name,x,y,width,slots,inlets,outlets,limits,controlled,reader:loop[0].entity_number,loop:loop.map(e=>e.entity_number),capacity,maximumStock:stock};blocks.push(result);return result;
 }
 const circuits=block({name:'Circuits',x:0,y:0,
  top:Array.from({length:4},()=>['copper-cable','electronic-circuit','copper-cable']).flat(),
  bottom:['copper-cable',...repeat('advanced-circuit',3),'copper-cable',...repeat('advanced-circuit',4),'copper-cable',...repeat('advanced-circuit',3)],
  feeds:[{item:'iron-plate',side:'top',column:2,arms:3,rate:460},{item:'copper-plate',side:'top',column:10,arms:5,rate:545},{item:'plastic-bar',side:'bottom',column:17,arms:2,rate:130}],
  limits:{'iron-plate':96,'copper-plate':240,'plastic-bar':128,'copper-cable':160,'electronic-circuit':96,'advanced-circuit':64},
  exports:[{item:'electronic-circuit',side:'right',row:1,reserve:24},{item:'advanced-circuit',side:'left',row:2,reserve:4}]});
 // Dedicated cable-to-green transfers bypass the circulating product lane.
 for(let i=0;i<12;i+=3){
  const [l,g,r]=circuits.slots.filter(s=>s.side==='top').slice(i,i+3);
  for(const dx of [-1,0])Object.assign(occupied.get(key(g.cx+dx,-1)),filter('iron-plate'));
  for(const [a,d] of [[l,12],[r,4]]){
   const ox=a.cx+1,old=occupied.get(key(ox,-1));entities.splice(entities.indexOf(old),1);occupied.delete(key(ox,-1));
   for(let j=wires.length-1;j>=0;j--)if(wires[j][0]===old.entity_number||wires[j][2]===old.entity_number)wires.splice(j,1);
   circuits.controlled=circuits.controlled.filter(id=>id!==old.entity_number);
   const ax=(a.cx+g.cx)/2;
   for(const yy of [-4,-3])add('fast-inserter',ax,yy,{direction:d,override_stack_size:1,...filter('copper-cable')});
  }
 }
 const mech=block({name:'Mechanical',x:-4,y:18,
  top:[...repeat('battery',3),'iron-gear-wheel','pipe',...repeat('engine-unit',6)],
  bottom:['construction-robot','logistic-robot','roboport',...repeat('flying-robot-frame',10),...repeat('electric-engine-unit',6)],
  feeds:[{item:'advanced-circuit',side:'top',column:2,arms:1,rate:65,internal:true},{item:'iron-plate',side:'top',column:10,arms:3,rate:210,internal:true},{item:'copper-plate',side:'top',column:20,arms:1,rate:40,internal:true},{item:'electronic-circuit',side:'top',column:circuits.width+6,arms:2,rate:120,internal:true},{item:'steel-plate',side:'bottom',column:8,arms:1,rate:85}],
  limits:{'iron-plate':96,'copper-plate':64,'steel-plate':64,'advanced-circuit':128,'electronic-circuit':128,battery:48,'iron-gear-wheel':64,pipe:48,'engine-unit':24,'electric-engine-unit':24,'flying-robot-frame':64,'construction-robot':8,'logistic-robot':8,roboport:2}});
 // Preserve red circuits for the downstream logistic assembler.
 const robo=entities.find(e=>e.recipe==='roboport');
 for(const [i,dx]of [-1,0].entries()){
  const arm=occupied.get(key(Math.floor(robo.position.x)+dx,22));
  if(i===0){Object.assign(arm,filter('advanced-circuit'));arm.control_behavior=condition('advanced-circuit',64,'>');
   wires.push([arm.entity_number,1,occupied.get(key(Math.floor(arm.position.x),21)).entity_number,1]);}
  else Object.assign(arm,{use_filters:true,filters:['steel-plate','iron-gear-wheel'].map((name,index)=>({index:index+1,name,quality:'normal',comparator:'='}))});
 }
 // Stop the steel feeder before the adjacent iron underground outlet.
 occupied.get(key(5,19)).direction=8;
 // Continue each raw feeder after its circuit-loop taps, under the bottom row.
 for(const [col,arms,item] of [[2,3,'iron-plate'],[10,5,'copper-plate']]){
  const xx=col+arms+1;
  const start=item==='iron-plate'?-2:2,end=start+6;
  add('fast-underground-belt',xx,start,{direction:8,type:'input'});
  add('fast-underground-belt',xx,end,{direction:8,type:'output'});
  const dest=mech.inlets[item];assert(Math.floor(dest.x)===xx);
  for(let yy=end+1;yy<Math.floor(dest.y);yy++)belt(xx,yy,8);
 }
 for(const item of ['electronic-circuit','advanced-circuit']){
  const a=circuits.outlets[item],b=mech.inlets[item];assert(a.x===Math.floor(b.x));
  for(let yy=a.y+1;yy<Math.floor(b.y);yy++)belt(a.x,yy,8);
 }
 // Three internal battery plants; independent acid and lubricant headers.
 for(const [recipe,item,rate] of [['battery','sulfuric-acid',800],['electric-engine-unit','lubricant',300]]){
  const wet=entities.filter(e=>e.recipe===recipe),offset=recipe==='battery'?-1:0,py=recipe==='battery'?13:26;
  const xs=wet.map(e=>Math.floor(e.position.x)+offset);
  for(let xx=Math.min(...xs);xx<=Math.max(...xs);xx++)add('pipe',xx,py);
  const e=add('pipe',Math.min(...xs),py+(recipe==='battery'?-1:1));
  ports.push({kind:'fluid',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,perMinute:rate});
 }
 // Shared chest at the left end of the mechanical loop.
 const products=['construction-robot','logistic-robot','roboport'],caps=[200,200,20];
 const chest=add('steel-chest',1,27);
 for(const [i,item]of products.entries()){
  const xx=-1+2*i;
  add('fast-inserter',xx,22,{direction:0,override_stack_size:1,...filter(item)});
  for(let yy=23;yy<=(i===1?25:27);yy++)belt(xx,yy,i===0&&yy===27?4:i===2&&yy===27?12:8);
  const arm=add('fast-inserter',i===0?0:i===1?1:2,i===1?26:27,{direction:i===0?12:i===1?0:4,override_stack_size:1,...filter(item),control_behavior:condition(item,caps[i])});
  wires.push([chest.entity_number,1,arm.entity_number,1]);
 }
 ports.push({kind:'output',label:'Shared robot chest',items:products,entity:chest.entity_number,x:chest.position.x,y:chest.position.y,caps});
 // Continuous, mechanically balanced frame delivery to the two rear inputs.
 const frameArm=add('fast-inserter',5,22,{direction:0,override_stack_size:1,...filter('flying-robot-frame')});
 for(let yy=23;yy<=27;yy++)belt(5,yy,yy===27?4:8);
 const split=add('fast-splitter',6,27,{direction:4,position:{x:6.5,y:28}});assert(!occupied.has(key(6,28)));occupied.set(key(6,28),split);
 belt(7,27,0);
 for(let xx=7;xx<=10;xx++)belt(xx,28,xx===10?0:4);
 belt(10,27,0);
 for(const [recipe,item]of [['construction-robot','electronic-circuit'],['logistic-robot','advanced-circuit']]){
  const m=entities.find(e=>e.recipe===recipe),xx=Math.floor(m.position.x);
  assert([7,10].includes(xx));
  for(const dx of [-1,0])Object.assign(occupied.get(key(xx+dx,22)),filter(item));
  add('fast-inserter',xx,26,{direction:8,override_stack_size:1,...filter('flying-robot-frame')});
 }
 const id='robots-two-loop';ports.push({kind:'power',label:'External power',items:[],entity:0,x:0,y:0});
 const bp={item:'blueprint',version:562954249961472,label:'Two-loop robots 10 + 10 + 1/min',entities,wires:[],icons:products.map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
 powerStarterLayout(bp,[...ports,{kind:'input',x:-8,y:-8}],raw);bp.wires.push(...wires);
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 bp.description='Independent two-loop robot workshop. One exterior inlet each iron/copper/steel/plastic, acid and lubricant. Cable directly inserted into green circuits. AM2, red belts, fast inserters; no modules.';
 const code=encodeBlueprint({blueprint:bp}),footprint=starterBounds(bp.entities,raw);
 const manifest={id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(rawBytes),products,targets:{'construction-robot':10,'logistic-robot':10,roboport:1},
 inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:p.direction,perMinute:p.perMinute,block:p.block})),
 fluids:ports.filter(p=>p.kind==='fluid').map(p=>({item:p.items[0],entity:p.entity,perMinute:p.perMinute})),
 outputs:products.map((item,i)=>({item,entity:chest.entity_number,position:chest.position,cap:caps[i]})),ports,footprint,machineCounts:counts,
 construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length])),
 loopControl:blocks.map(({inlets,outlets,slots,...b})=>b),setupNotes:[bp.description],status:'awaiting-exact-hash-native-validation'};
 assert(manifest.inputs.length===4);assert(new Set(manifest.inputs.map(p=>p.item)).size===4);
 await fs.writeFile(path.join(out,id+'.txt'),code+'\n');await fs.writeFile(path.join(out,id+'.json'),JSON.stringify({blueprint:bp},null,2)+'\n');entries.push(manifest);
 console.log(JSON.stringify({id,footprint,machineCounts:counts,sha256:manifest.blueprintSha256}));
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(entries,null,2)+'\n');
