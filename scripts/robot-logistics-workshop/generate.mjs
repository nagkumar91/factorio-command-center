// Original workshop; circulation/direct cable transfers adapted from flight-robots and rgby frames.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerFiveLayout} from '../five-science/power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
const out='blueprint-sources/robot-logistics-workshop',id='robot-logistics-workshop';
const targets={'construction-robot':10,'logistic-robot':10,roboport:1,'storage-chest':4,'passive-provider-chest':4},products=Object.keys(targets);
const clockMargin={'construction-robot':1,'logistic-robot':1.08,roboport:1.15,'storage-chest':1.1,'passive-provider-chest':1.1};
const caps={'construction-robot':20,'logistic-robot':20,roboport:2,'storage-chest':10,'passive-provider-chest':10};
const limits={'iron-plate':0,'steel-plate':0,'plastic-bar':0,battery:48,'copper-cable':0,'electronic-circuit':256,'advanced-circuit':96,'iron-gear-wheel':128,pipe:0,'engine-unit':32,'electric-engine-unit':32,'flying-robot-frame':32,'steel-chest':32,...Object.fromEntries(products.map(p=>[p,p==='roboport'?2:16]))};
let next=1;const entities=[],wires=[],ports=[],occupied=new Map(),machineCounts={},loop=[],controlled=[];
const key=(x,y)=>`${x},${y}`;
function place(e){let p=Object.values(raw).map(g=>g?.[e.name]).find(p=>p?.selection_box);assert(p,e.name);let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}entities.push(e);return e;}
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra});
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
const condition=(item,n=limits[item],comparator='<')=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator,constant:n}});
const arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const wire=(a,b,ac=1,bc=1)=>wires.push([a.entity_number,ac,b.entity_number,bc]);
const slots=[];let cx=3,prev;
const top=[...Array(3).fill('battery'),...Array.from({length:4},()=>['copper-cable','electronic-circuit','copper-cable']).flat(),...Array(12).fill('advanced-circuit')];
for(const recipe of top){if(prev==='battery'&&recipe==='battery'||prev==='copper-cable'&&recipe==='electronic-circuit'||prev==='electronic-circuit'&&recipe==='copper-cable')cx++;slots.push({recipe,x:cx,y:-3});cx+=3;prev=recipe;}
const bottom=['construction-robot','logistic-robot','roboport',...Array(10).fill('flying-robot-frame'),...Array(5).fill('electric-engine-unit'),...Array(5).fill('engine-unit'),'iron-gear-wheel','pipe','steel-chest','storage-chest','passive-provider-chest'];
bottom.forEach((recipe,i)=>slots.push({recipe,x:3+3*i,y:6}));
const width=Math.max(...slots.map(s=>s.x))+3;
for(let x=0;x<=width;x++)loop.push(belt(x,0,4));loop.push(belt(width,3,12));for(let x=width-1;x>=0;x--)loop.push(belt(x,3,x===0?0:12));for(let y=2;y>=1;y--)loop.push(belt(0,y,0));
const at=(x,y)=>occupied.get(key(x,y));
for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
// Split both source lanes across two opposing side feeds, restoring an even
// lane mix before the return. Collection is AFTER this merge, never on one branch.
add('fast-splitter',width+1,0,{position:{x:width+1.5,y:1},direction:4});
for(const[dx,dy,d]of [[2,0,4],[3,0,8],[3,1,8],[3,2,8],[3,3,12],[2,3,12],[1,3,12],[2,1,8],[2,5,4],[3,5,0],[3,4,0]]){const e=belt(width+dx,dy,d);wire(e,loop.reduce((a,b)=>Math.hypot(a.position.x-e.position.x,a.position.y-e.position.y)<Math.hypot(b.position.x-e.position.x,b.position.y-e.position.y)?a:b));loop.push(e);}
add('fast-underground-belt',width+2,2,{direction:8,type:'input'});add('fast-underground-belt',width+2,4,{direction:8,type:'output'});
// Read each exposed loop tile once. Whole-belt reads can stop at branches.
for(const e of loop)e.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:1};
function control(e,item,near){e.control_behavior=condition(item);wire(e,near);controlled.push(e.entity_number);}
for(const s of slots){const top=s.y<0,ay=top?-1:4,by=top?0:3,d=top?8:0;
 add(s.recipe==='battery'?'chemical-plant':'assembling-machine-2',s.x,s.y,{recipe:s.recipe,direction:s.recipe==='electric-engine-unit'?8:0});machineCounts[s.recipe]=(machineCounts[s.recipe]||0)+1;
 for(const dx of (s.recipe==='copper-cable'?[]:s.recipe==='battery'?[0]:[-1,0])){const e=arm(s.x+dx,ay,d);}
 const e=arm(s.x+(s.recipe==='battery'?-1:1),ay,(d+8)%16);control(e,s.recipe,at(s.x+(s.recipe==='battery'?-1:1),by));
}
const upper=slots.filter(s=>s.y<0);for(let i=1;i<upper.length;i++){const a=upper[i-1],b=upper[i];if(b.x-a.x!==4||!(['copper-cable','electronic-circuit'].includes(a.recipe)&&['copper-cable','electronic-circuit'].includes(b.recipe)))continue;for(const dy of [-1,0])arm(a.x+2,-3+dy,a.recipe==='copper-cable'?12:4,filter('copper-cable'));}
function port(kind,item,e,rate,side='west'){const p={kind,label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position,externalSide:side,perMinute:rate,...(kind==='input'?{direction:4}:{})};ports.push(p);return p;}
// Exactly one west entrance per solid; iron has two admission arms behind its one entrance.
{
 const item='iron-plate',e=belt(-5,0,4);for(let x=-4;x<=-2;x++)belt(x,0,x===-2?8:4);
 port('input',item,e);
 for(const[x,t]of [[-2,'input'],[1,'output'],[3,'input'],[6,'output'],[7,'input'],[10,'output'],[11,'input'],[14,'output']])add('fast-underground-belt',x,1,{direction:4,type:t});belt(2,1,4);
 for(const s of slots.filter(s=>s.recipe==='battery'))Object.assign(at(s.x,-1),{name:'long-handed-inserter',...filter('iron-plate')});
 const gears=slots.find(s=>s.recipe==='iron-gear-wheel'),pipe=slots.find(s=>s.recipe==='pipe');
 for(let x=15;x<=gears.x-1;x++)belt(x,1,x===gears.x-1?8:4);
 for(let x=gears.x-1;x<=pipe.x;x++)belt(x,2,4);
 for(const s of slots.filter(s=>s.recipe==='electronic-circuit')){Object.assign(at(s.x-1,-1),{name:'long-handed-inserter',...filter('iron-plate')});Object.assign(at(s.x,-1),{name:'long-handed-inserter',...filter('iron-plate')});}
 for(const s of [gears,pipe])for(const dx of [-1,0])Object.assign(at(s.x+dx,4),{name:'long-handed-inserter',...filter('iron-plate')});
 const steel=belt(-5,11,4);for(let x=-4;x<=8;x++)belt(x,11,x===8?0:4);for(let x=8;x<=Math.max(...slots.filter(s=>s.y>0&&raw.recipe[s.recipe].ingredients.some(i=>i.name==='steel-plate')).map(s=>s.x));x++)belt(x,10,4);
 for(const s of slots.filter(s=>s.y>0&&raw.recipe[s.recipe].ingredients.some(i=>i.name==='steel-plate')))add('long-handed-inserter',s.x-1,8,{direction:8,override_stack_size:1,...filter('steel-plate')});const rp=slots.find(s=>s.recipe==='roboport');add('long-handed-inserter',rp.x,8,{direction:8,override_stack_size:1,...filter('steel-plate')});const sc=slots.find(s=>s.recipe==='steel-chest');add('long-handed-inserter',sc.x,8,{direction:8,override_stack_size:1,...filter('steel-plate')});belt(sc.x+1,10,0);for(const dx of [-1,0,1]){belt(sc.x+dx,9,12);if(dx!==1)Object.assign(at(sc.x+dx,8),{name:'fast-inserter'});}port('input','steel-plate',steel);
}
// Rear copper belt, one west entrance; every battery/cable machine picks up directly.
const copper=slots.filter(s=>['battery','copper-cable'].includes(s.recipe));const copperEnd=Math.max(...copper.map(s=>s.x));let copperPort;
for(let x=-5;x<=copperEnd;x++){const e=belt(x,-6,4);if(x===-5)copperPort=e;}
for(const s of copper)arm(s.x,-5,0,filter('copper-plate'));port('input','copper-plate',copperPort);
const reds=slots.filter(s=>s.recipe==='advanced-circuit'),redStart=Math.min(...reds.map(s=>s.x)),redEnd=Math.max(...reds.map(s=>s.x));let plasticPort;
for(let x=-5;x<=redStart;x++){const e=belt(x,-7,x===redStart?8:4);if(x===-5)plasticPort=e;}
for(let x=redStart;x<=redEnd;x++)belt(x,-6,4);for(const s of reds)arm(s.x,-5,0,filter('plastic-bar'));port('input','plastic-bar',plasticPort);
// Independent west fluid headers; chemical plants face north, wet AM2s south.
{
 const xs=slots.filter(s=>s.recipe==='electric-engine-unit').map(s=>s.x);let e;for(let x=-5;x<=Math.max(...xs);x++){const p=add('pipe',x,12);if(x===-5)e=p;}for(const x of xs){add('pipe-to-ground',x,8,{direction:0});add('pipe-to-ground',x,11,{direction:8});}port('fluid','lubricant',e);
 const bs=slots.filter(s=>s.recipe==='battery').map(s=>s.x-1);let acid;
 for(let x=-5;x<=Math.max(...bs);x++){const e=add('pipe',x,-9);if(x===-5)acid=e;}
 for(const x of bs){add('pipe-to-ground',x,-8,{direction:0});add('pipe-to-ground',x,-5,{direction:8});}port('fluid','sulfuric-acid',acid);

}
// Split the physical frame stream evenly between robots; front arms take only their circuits.
arm(1,4,0,filter('flying-robot-frame'));for(let y=5;y<=9;y++)belt(1,y,y===9?4:8);
add('fast-splitter',2,9,{position:{x:2.5,y:10},direction:4});
for(const[x,y,d]of [[3,9,0],[3,10,4],[4,10,4],[5,10,4],[6,10,0],[6,9,0]])belt(x,y,d);
for(const x of [3,6])arm(x,8,8,filter('flying-robot-frame'));
for(const s of slots.filter(s=>['construction-robot','logistic-robot'].includes(s.recipe)))for(const dx of [-1,0])Object.assign(at(s.x+dx,4),filter(s.recipe==='construction-robot'?'electronic-circuit':'advanced-circuit'));
// Direct internal green-circuit rail for frames, electric motors and construction robots.
// This rail bypasses red-circuit/chest demand on the circulating belt.
for(let x=2;x<=55;x++)belt(x,2,12);
for(const s of slots.filter(s=>s.recipe==='electronic-circuit')){
 const removed=at(s.x+1,1);entities.splice(entities.indexOf(removed),1);occupied.delete(key(s.x+1,1));
 Object.assign(at(s.x,1),{name:'fast-underground-belt',type:'input'});Object.assign(at(s.x+2,1),{name:'fast-underground-belt',type:'output'});
 arm(s.x+1,1,0,filter('electronic-circuit'));
}
for(const s of slots.filter(s=>['construction-robot','flying-robot-frame','electric-engine-unit'].includes(s.recipe))){
 Object.assign(at(s.x-1,4),{name:'long-handed-inserter',...filter('electronic-circuit')});
 if(s.recipe==='construction-robot')Object.assign(at(s.x,4),{name:'long-handed-inserter',...filter('electronic-circuit')});
 else {const names=s.recipe==='flying-robot-frame'?['battery','electric-engine-unit']:['engine-unit'];Object.assign(at(s.x,4),{use_filters:true,filters:names.map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))});}
}
// The eastmost motor must receive greens from its east (the rail travels west).
{const old=at(55,1);entities.splice(entities.indexOf(old),1);occupied.delete(key(55,1));Object.assign(at(54,1),{name:'fast-underground-belt',type:'input'});Object.assign(at(56,1),{name:'fast-underground-belt',type:'output'});arm(55,1,0,filter('electronic-circuit'));}
// Pipes travel directly along the engines' rear, independently of the circulating bus.
arm(75,8,0,filter('pipe'));for(let x=57;x<=75;x++)belt(x,9,12);
for(const s of slots.filter(s=>s.recipe==='engine-unit'))arm(s.x,8,8,filter('pipe'));
// A second gear assembler shares the SAME exterior iron entrance; it supplies the bus.
add('assembling-machine-2',-5,4,{recipe:'iron-gear-wheel'});machineCounts['iron-gear-wheel']++;
for(const x of [-5,-4])add('long-handed-inserter',x,2,{direction:0,override_stack_size:1,...filter('iron-plate')});
const gearOut=arm(-3,4,12,filter('iron-gear-wheel'));control(gearOut,'iron-gear-wheel',at(0,3));belt(-2,4,0);belt(-2,3,0);belt(-2,2,4);belt(-1,2,4);
// Rear cable exports share the copper belt's empty lane, then the plastic belt's empty lane.
// A dummy straight approach forces one-lane side-loading at each material merge.
const cp=ports.find(p=>p.kind==='input'&&p.items[0]==='copper-plate');ports.splice(ports.indexOf(cp),1);
const newCopper=belt(-5,-5,4);belt(-4,-5,0);port('input','copper-plate',newCopper);
for(const s of slots.filter(s=>s.recipe==='copper-cable'))arm(s.x+(s.x===55?-1:1),-5,8,filter('copper-cable'));
add('fast-splitter',56,-6,{position:{x:56.5,y:-5},direction:4,filter:'copper-cable',output_priority:'left'});belt(57,-6,4);belt(57,-5,4);
{const e=at(58,-7);entities.splice(entities.indexOf(e),1);occupied.delete(key(58,-7));at(57,-7).direction=0;belt(57,-8,4);belt(58,-8,4);arm(58,-7,0,{name:'bulk-inserter',override_stack_size:3,...filter('plastic-bar')});}

for(const s of reds){const rear=at(s.x,-5);rear.filters=['plastic-bar','copper-cable'].map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}));for(const dx of [-1,0])Object.assign(at(s.x+dx,-1),filter('electronic-circuit'));}
// Five independent product filters share one passive provider. Green network reads only chest;
// red decider outputs drive the collector filters, isolated from the loop-stock network.
const chest=add('passive-provider-chest',width-2,5);
const collector=add('bulk-inserter',width-2,4,{direction:0,override_stack_size:1,use_filters:true,control_behavior:{circuit_set_filters:true}});
for(const[i,item]of products.entries()){const e=add('decider-combinator',width+5,4+i,{tags:{stock_control:true},position:{x:width+5,y:4.5+i},direction:4,control_behavior:{decider_conditions:{conditions:[{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:caps[item]}],outputs:[{signal:{type:'item',name:item,quality:'normal'},copy_count_from_input:false,constant:1}]}}});wire(chest,e,2,2);wire(e,collector,3,1);}
// Include the collector's pending hand in the independent stock budgets.
Object.assign(collector.control_behavior,{circuit_read_hand_contents:true,circuit_hand_read_mode:1,input_networks:{red:true,green:false},output_networks:{red:false,green:true}});wire(chest,collector,2,2);
port('output','finished-products',chest,undefined,'east');ports.at(-1).items=products;ports.at(-1).caps=caps;
// Robot export tokens persist until pickup; late frames cannot lose a clock window.
// The timer input bus is chained in two-tile hops (never a too-long direct wire).
const virtual=name=>({type:'virtual',name});
const timer=add('arithmetic-combinator',88,2,{position:{x:88,y:2.5},direction:4,control_behavior:{arithmetic_conditions:{first_signal:virtual('signal-T'),operation:'+',second_constant:1,output_signal:virtual('signal-T')}}});wire(timer,timer,3,1);
const finalOutputIds=new Set(),moduloEntities={},robotTokens={},busNodes=[];let previousClockInput=timer;
for(const[i,item]of [...products.entries()].reverse()){
 const robot=item.endsWith('-robot'),signal='signal-'+String.fromCharCode(65+i),period=Math.floor(3600/(targets[item]*clockMargin[item]));
 const mod=add('arithmetic-combinator',78+2*i,2,{position:{x:78+2*i,y:2.5},direction:4,control_behavior:{arithmetic_conditions:{first_signal:virtual('signal-T'),operation:'%',second_constant:period,output_signal:virtual(signal)}}});
 wire(previousClockInput,mod,previousClockInput===timer?3:1,1);previousClockInput=mod;moduloEntities[item]=mod.entity_number;
 const station=slots.find(s=>s.recipe===item),output=at(station.x+1,4);finalOutputIds.add(output.entity_number);
 if(robot){
  const token=i===0?'signal-X':'signal-Y',reset=i===0?'signal-U':'signal-V';
  const latch=add('decider-combinator',78+2*i,1,{position:{x:78+2*i,y:1.5},direction:4,control_behavior:{decider_conditions:{conditions:[{first_signal:virtual(reset),comparator:'=',constant:0},{first_signal:virtual(signal),comparator:'=',constant:0,compare_type:'and'},{first_signal:virtual(reset),comparator:'=',constant:0,compare_type:'or'},{first_signal:virtual(token),comparator:'>',constant:0,compare_type:'and'}],outputs:[{signal:virtual(token),copy_count_from_input:false,constant:1}]}}});wire(mod,latch,3,1);wire(latch,latch,4,2);busNodes.push({entity:latch,connector:2});
  const permission=add('decider-combinator',0,5+i,{position:{x:0,y:5.5+i},direction:4,control_behavior:{decider_conditions:{conditions:[{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:limits[item]},{first_signal:virtual(token),comparator:'>',constant:0,compare_type:'and'},{first_signal:virtual(reset),comparator:'>',constant:0,compare_type:'or'}],outputs:[{signal:virtual('signal-G'),copy_count_from_input:false,constant:1}]}}});wire(permission,at(0,3));wire(permission,output,3,1);busNodes.push({entity:permission,connector:2});
  const handReset=add('arithmetic-combinator',0,7+i,{position:{x:0,y:7.5+i},direction:4,control_behavior:{arithmetic_conditions:{first_signal:{type:'item',name:item,quality:'normal'},operation:'*',second_constant:1,output_signal:virtual(reset)}}});wire(output,handReset,2,2);busNodes.push({entity:handReset,connector:4});
  output.control_behavior={circuit_enabled:true,circuit_read_hand_contents:true,circuit_hand_read_mode:1,circuit_condition:{first_signal:virtual('signal-G'),comparator:'>',constant:0}};
  robotTokens[item]={latch:latch.entity_number,permission:permission.entity_number,handReset:handReset.entity_number,output:output.entity_number,tokenSignal:token,resetSignal:reset};
 }else{
  wire(mod,at(78+2*i,3),3,1);
  const[x,y]=i===2?[9,9]:[84+(i-3)*2,1];
  const gate=add('decider-combinator',x,y,{position:{x,y:y+.5},direction:4,control_behavior:{decider_conditions:{conditions:[{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:limits[item]},{first_signal:virtual(signal),comparator:'<',constant:24,compare_type:'and'}],outputs:[{signal:virtual('signal-G'),copy_count_from_input:false,constant:1}]}}});
  wire(gate,loop.reduce((a,b)=>Math.hypot(a.position.x-x,a.position.y-y)<Math.hypot(b.position.x-x,b.position.y-y)?a:b));wire(gate,output,4,2);output.control_behavior={circuit_enabled:true,circuit_condition:{first_signal:virtual('signal-G'),comparator:'>',constant:0}};
 }
}
// Keep the token bus virtual-only: ordinary input arms relay green, without reads.
const tokenRelays=entities.filter(e=>e.name.endsWith('inserter')&&e.position.y===4.5&&!finalOutputIds.has(e.entity_number)&&!e.control_behavior?.circuit_read_hand_contents).sort((a,b)=>a.position.x-b.position.x);
for(let i=1;i<tokenRelays.length;i++)wire(tokenRelays[i-1],tokenRelays[i],2,2);
for(const node of busNodes){const near=tokenRelays.reduce((a,b)=>Math.hypot(a.position.x-node.entity.position.x,a.position.y-node.entity.position.y)<Math.hypot(b.position.x-node.entity.position.x,b.position.y-node.entity.position.y)?a:b);wire(node.entity,near,node.connector,2);}
// Final outputs have private permissions; retain those links, remove old loop wires.
const tokenPermissionPairs=new Set(Object.values(robotTokens).map(t=>`${t.permission}:${t.output}`));
for(let i=wires.length-1;i>=0;i--){const[a,ac,b,bc]=wires[i];if((finalOutputIds.has(a)&&ac===1&&!tokenPermissionPairs.has(`${b}:${a}`))||(finalOutputIds.has(b)&&bc===1&&!tokenPermissionPairs.has(`${a}:${b}`)))wires.splice(i,1);}
for(let i=controlled.length-1;i>=0;i--)if(finalOutputIds.has(controlled[i]))controlled.splice(i,1);
ports.push({kind:'power',items:[],entity:0,x:0,y:0});
// Bury only unused straight supply corridors. Every inserter pickup/drop and junction stays exposed.
const protectedCells=new Set(ports.map(p=>key(Math.floor(p.x),Math.floor(p.y))));
for(const e of entities.filter(e=>e.name.endsWith('inserter'))){const d=e.direction||0,[dx,dy]=({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d],r=e.name==='long-handed-inserter'?2:1;for(const sign of [-1,1])protectedCells.add(key(Math.floor(e.position.x)+sign*r*dx,Math.floor(e.position.y)+sign*r*dy));}
for(const e of entities.filter(e=>e.name==='fast-transport-belt'&&[4,12].includes(e.direction))){const x=Math.floor(e.position.x),y=Math.floor(e.position.y);for(const[dy,d]of [[-1,8],[1,0]]){const n=at(x,y+dy);if(n?.name.includes('belt')&&n.direction===d)protectedCells.add(key(x,y));}}
const loopIds=new Set(loop.map(e=>e.entity_number)),removed=new Set();let buriedBelts=0,buriedPipes=0;
for(const [name,span]of [['fast-transport-belt',6],['pipe',10]]){
 const byRow=new Map();for(const e of entities){const x=Math.floor(e.position.x),y=Math.floor(e.position.y);if(e.name!==name||loopIds.has(e.entity_number)||protectedCells.has(key(x,y))||name==='fast-transport-belt'&&e.direction!==4)continue;
  const above=at(x,y-1),below=at(x,y+1);if(name==='pipe'&&[above,below].some(n=>n&&['pipe','pipe-to-ground','assembling-machine-2','chemical-plant'].includes(n.name)))continue;
  if(!byRow.has(y))byRow.set(y,[]);byRow.get(y).push(e);
 }
 for(const list of byRow.values()){list.sort((a,b)=>a.position.x-b.position.x);let i=0;while(i<list.length){let j=i;while(j+1<list.length&&list[j+1].position.x===list[j].position.x+1)j++;for(let k=i;k+span<=j;k+=span+1){const a=list[k],b=list[k+span];a.name=b.name=name==='pipe'?'pipe-to-ground':'fast-underground-belt';if(name==='pipe'){a.direction=12;b.direction=4;buriedPipes++;}else{a.type='input';b.type='output';buriedBelts++;}for(let n=k+1;n<k+span;n++)removed.add(list[n].entity_number);}i=j+1;}
 }
}
const retained=entities.filter(e=>!removed.has(e.entity_number));entities.length=0;occupied.clear();for(const e of retained)place(e);
// Place one visible marker per declared material entrance before power selection.
for(const p of ports.filter(p=>p.kind==='input'||p.kind==='fluid')){
 let found=false;const px=Math.floor(p.x),py=Math.floor(p.y);
 for(const [dx,dy]of [[1,-1],[1,1],[2,1],[2,-1],[0,1],[0,-1],[3,1],[3,-1],[4,1],[4,-1],[2,2],[3,2]]){
  const x=px+dx,y=py+dy;if(occupied.has(key(x,y)))continue;
  if(ports.some(q=>q.externalSide==='west'&&Math.floor(q.y)===y&&x<q.x))continue;
  const e=add('display-panel',x,y,{icon:{type:p.kind==='fluid'?'fluid':'item',name:p.items[0]},text:`IN: ${p.items[0]}\nWEST · ${p.perMinute??''}/min at nominal target`,always_show:true});p.displayEntity=e.entity_number;found=true;break;
 }assert(found,'No display marker space '+p.label);
}
const layout={entities,wires,next,place};powerFiveLayout(layout,ports,raw);
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
const description='Official 2.1.24 Space Age; AM2, no modules, red belts, fast, bulk and long-handed inserters. Four single WEST solid entrances, two WEST fluid entrances; one shared EAST passive provider with independent caps. All circuits, engines, batteries, frames and steel chests made internally. Preserve red loop stock wires, green chest wires and five filter-decider circuits. Supply electricity at P.';
const bp={item:'blueprint',version:562954249961472,label:'Robot logistics workshop · 10/10/1/4/4 per minute',description,entities,wires,icons:products.slice(0,4).map((name,i)=>({index:i+1,signal:{type:'item',name}}))};
const required={},crafts={};const boundary=new Set(['iron-plate','copper-plate','steel-plate','plastic-bar','sulfuric-acid','lubricant']);function expand(item,n){if(boundary.has(item)){required[item]=(required[item]||0)+n;return;}const r=raw.recipe[item];assert(r,item);crafts[item]=(crafts[item]||0)+n/r.results.find(p=>p.name===item).amount;for(const i of r.ingredients)expand(i.name,n*i.amount/r.results.find(p=>p.name===item).amount);}for(const[p,n]of Object.entries(targets))expand(p,n);for(const p of ports)if(p.kind==='input'||p.kind==='fluid'){p.perMinute=required[p.items[0]];const marker=entities.find(e=>e.entity_number===p.displayEntity);if(marker)marker.text=`IN: ${p.items[0]}\nWEST · ${p.perMinute}/min at nominal target`;}
const code=encodeBlueprint({blueprint:bp}),footprint=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']},'arithmetic-combinator':{...raw['arithmetic-combinator'],...raw['decider-combinator']}}),capacity=loop.length*8,maximumStock=Object.values(limits).reduce((a,b)=>a+b,0);assert(maximumStock<capacity*.75);
const manifest={id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),products,targets,recipeAudit:{externalPerMinute:required,craftsPerMinute:crafts,recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,raw.recipe[n].ingredients]))},outputCaps:caps,ports,inputs:ports.filter(p=>p.kind==='input').map(p=>({...p,item:p.items[0]})),fluids:ports.filter(p=>p.kind==='fluid').map(p=>({...p,item:p.items[0]})),outputs:products.map(item=>({item,entity:chest.entity_number,position:chest.position,externalSide:'east',cap:caps[item]})),machineCounts,loopReturnCorner:at(0,3).entity_number,loopControl:[{name:id,reader:loop[0].entity_number,controlled,loop:loop.map(e=>e.entity_number),limits,capacity,maximumStock}],footprint,construction:Object.fromEntries([...new Set(entities.map(e=>e.name))].map(n=>[n,entities.filter(e=>e.name===n).length])),setupNotes:[description,'Leave shared chest slots unrestricted. Caps: 20 construction, 20 logistic, 2 roboports, 10 storage, 10 passive provider. Feed at least 20% above listed steady requirements while filling buffers.'],undergroundOptimization:{beltPairs:buriedBelts,pipePairs:buriedPipes,removedEntities:removed.size},productionClock:{headroom:clockMargin,timer:timer.entity_number,moduloEntities,robotTokens,periodTicks:Object.fromEntries(products.map(p=>[p,Math.floor(3600/(targets[p]*clockMargin[p]))])),pickupWindowTicks:24},stockControl:{collector:collector.entity_number,chest:chest.entity_number,caps,mode:'five deciders, independent chest item < cap; dynamic collector filters'}};
await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/'+id+'.txt',code+'\n');await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');console.log(JSON.stringify({id,footprint,machineCounts,required,blueprintSha256:manifest.blueprintSha256}));
