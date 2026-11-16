import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
import {powerFiveLayout} from '../five-science/power.mjs';
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json'));
// Power-layout geometry helper indexes ordinary containers; include logistic containers in that geometry view.
raw.container={...raw.container,...raw['logistic-container']};
const root='blueprint-sources/inserter-workshop',id='inserter-workshop',width=18,height=6;
const products=['inserter','long-handed-inserter','fast-inserter','bulk-inserter'];
const feeds=['iron-plate','copper-plate','plastic-bar'];
const limits={'iron-plate':24,'copper-plate':32,'plastic-bar':2,'iron-gear-wheel':20,'copper-cable':16,'electronic-circuit':32,'advanced-circuit':2,inserter:12,'long-handed-inserter':4,'fast-inserter':8,'bulk-inserter':4};
let next=1;const entities=[],wires=[],occupied=new Set(),ports=[],loop=[],controlled=[],machines=[];
function add(name,x,y,extra={}){
 const pos=extra.position||{x:x+.5,y:y+.5};const p=Object.values(raw).map(g=>g[name]).find(p=>p?.selection_box);assert(p,name);let[[a,b],[c,d]]=p.selection_box;if(name==='display-panel')[a,b,c,d]=[-.5,-.5,.5,.5];if([4,12].includes(extra.direction))[a,b,c,d]=[b,a,d,c];
 for(let u=Math.floor(pos.x+a+.01);u<pos.x+c-.01;u++)for(let v=Math.floor(pos.y+b+.01);v<pos.y+d-.01;v++){assert(!occupied.has(u+','+v),name+' collision '+u+','+v);occupied.add(u+','+v);}
 const e={entity_number:next++,name,position:pos,...extra};entities.push(e);return e;
}
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
const arm=(x,y,d,extra={})=>add('bulk-inserter',x,y,{direction:d,override_stack_size:2,...extra});
const wire=(a,b)=>{if(b.name==='fast-underground-belt')b=entities.filter(e=>e.name==='fast-transport-belt').sort((u,v)=>Math.hypot(u.position.x-b.position.x,u.position.y-b.position.y)-Math.hypot(v.position.x-b.position.x,v.position.y-b.position.y))[0];wires.push([a.entity_number,1,b.entity_number,1]);};
const filter=items=>({use_filters:true,filters:items.map((name,i)=>({index:i+1,name,quality:'normal',comparator:'='}))});
const below=item=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator:'<',constant:limits[item]}});
for(let x=0;x<=width;x++)loop.push(belt(x,0,x===width?8:4));for(let y=1;y<=height;y++)loop.push(belt(width,y,y===height?12:8));for(let x=width-1;x>=0;x--)loop.push(belt(x,height,x===0?0:12));for(let y=height-1;y>=1;y--)loop.push(belt(0,y,0));
const at=(x,y)=>loop.find(e=>e.position.x===x+.5&&e.position.y===y+.5),reader=loop[0];reader.control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
function station(recipe,col,row){
 const cx=3+3*col,cy=row==='top'?-3:row==='inside'?3:9,m=add('assembling-machine-2',cx,cy,{recipe});machines.push({recipe,entity:m.entity_number});
 const ingredients=raw.recipe[recipe].ingredients.map(i=>typeof i==='object'&&i.name?i.name:i[0]);
 const ay=row==='top'?-1:row==='inside'?1:7,by=row==='bottom'?6:0,d=row==='top'?8:0;
 const positions=['inserter','long-handed-inserter','fast-inserter','bulk-inserter','electronic-circuit','iron-gear-wheel'].includes(recipe)?[-1,0]:[-1];
 for(const dx of positions){const phase={inserter:2,'long-handed-inserter':0,'fast-inserter':0}[recipe];const e=arm(cx+dx,ay,d,{...filter(recipe==='bulk-inserter'?(dx===-1?['iron-gear-wheel']:ingredients.filter(n=>n!=='iron-gear-wheel')):ingredients),...(phase===undefined?{}:{control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'virtual',name:'signal-P'},comparator:recipe==='inserter'?'<':recipe==='fast-inserter'?'>':'=',constant:phase}}})});wire(e,at(cx+dx,by));if(phase!==undefined)controlled.push(e.entity_number);}
 const oy=row==='inside'?5:ay,dropDirection=row==='inside'?0:(d+8)%16,targetY=row==='inside'?6:by;
 const e=arm(cx+1,oy,dropDirection,{...filter([recipe]),control_behavior:below(recipe)});wire(e,at(cx+1,targetY));controlled.push(e.entity_number);
 if(recipe==='copper-cable'){const extra=arm(cx,oy,dropDirection,{...filter([recipe]),control_behavior:below(recipe)});wire(extra,at(cx,targetY));controlled.push(extra.entity_number);}
}
// Bridge the loop below the red-circuit assembler; feed its cable directly across it.
for(const [x,type] of [[14,'input'],[16,'output']])Object.assign(at(x,0),{name:'fast-underground-belt',type,direction:4});
const bridge=at(15,0);entities.splice(entities.indexOf(bridge),1);loop.splice(loop.indexOf(bridge),1);occupied.delete('15,0');
for(let i=wires.length-1;i>=0;i--)if(wires[i][0]===bridge.entity_number||wires[i][2]===bridge.entity_number)wires.splice(i,1);wire(at(13,0),at(17,0));
add('long-handed-inserter',15,0,{direction:8,use_filters:true,filters:[{index:1,name:'copper-cable',quality:'normal',comparator:'='}]});
['inserter','long-handed-inserter','fast-inserter','bulk-inserter','advanced-circuit'].forEach((r,i)=>station(r,i,'top'));
[['copper-cable',0],['electronic-circuit',4/3],['electronic-circuit',8/3],['copper-cable',4]].forEach(([r,i])=>station(r,i,'inside'));
arm(5,3,12,filter(['copper-cable']));arm(13,3,4,filter(['copper-cable']));
arm(7,5,8,filter(['iron-plate']));arm(11,5,8,filter(['iron-plate']));
[['copper-cable',0],['iron-gear-wheel',1],['copper-cable',8/3],['iron-gear-wheel',4]].forEach(([r,i])=>station(r,i,'bottom'));
for(const[i,item]of feeds.entries()){
 const y=i===0?1:i===1?3:5;const external=belt(item==='iron-plate'?-4:-3,y,4),near=belt(-2,y,item!=='plastic-bar'?8:4);
 if(item==='iron-plate')add('fast-splitter',-3,1,{position:{x:-2.5,y:2},direction:4});
 const e=arm(-1,y,12,{...filter([item]),control_behavior:below(item)});wire(e,at(0,y));controlled.push(e.entity_number);
 if(item!=='plastic-bar'){belt(-2,y+1,4);const more=arm(-1,y+1,12,{...filter([item]),control_behavior:below(item)});wire(more,at(0,y+1));controlled.push(more.entity_number);}
 add('display-panel',item==='plastic-bar'?-4:1,item==='plastic-bar'?7:y,{icon:{type:'item',name:item},text:`IN ${i+1}: ${item}\nWEST entrance, row ${y}. ${item==='iron-plate'?'Both iron admission arms share this one entrance.':''}`,always_show:true});
 ports.push({kind:'input',item,items:[item],entity:external.entity_number,x:external.position.x,y:external.position.y,position:external.position,direction:4,externalSide:'west'});
}
for(const [x,type] of [[10,'input'],[12,'output']])Object.assign(at(x,6),{name:'fast-underground-belt',type,direction:12});
// Westbound loop: eastern end is INPUT, western end OUTPUT, preserving native underground directions.
at(10,6).type='output';at(12,6).type='input';
const rearBridge=at(11,6);entities.splice(entities.indexOf(rearBridge),1);loop.splice(loop.indexOf(rearBridge),1);occupied.delete('11,6');
for(const w of wires)for(const i of [0,2])if(w[i]===rearBridge.entity_number)w[i]=at(13,6).entity_number;wire(at(9,6),at(13,6));
add('long-handed-inserter',11,6,{direction:8,use_filters:true,filters:[{index:1,name:'copper-cable',quality:'normal',comparator:'='}]});
const copperPort=ports.find(p=>p.item==='copper-plate');const copperEntrance=belt(-5,3,4);Object.assign(copperPort,{entity:copperEntrance.entity_number,x:-4.5,y:3.5,position:copperEntrance.position});add('fast-splitter',-4,3,{position:{x:-3.5,y:4},direction:4});add('fast-underground-belt',-3,4,{direction:8,type:'input'});add('fast-underground-belt',-3,10,{direction:8,type:'output'});belt(-3,11,8);belt(-3,12,4);
const ironBranch=entities.find(e=>e.position.x===-1.5&&e.position.y===2.5);Object.assign(ironBranch,{name:'fast-underground-belt',direction:8,type:'input'});
add('fast-underground-belt',-2,8,{direction:8,type:'output'});
for(let y=9;y<=12;y++)belt(-2,y,y===12?4:8);
for(const [x,type] of [[-1,'input'],[2,'output'],[3,'input'],[5,'output'],[7,'input'],[10,'output'],[12,'input'],[14,'output']])add('fast-underground-belt',x,12,{direction:4,type});belt(6,12,4);belt(11,12,4);belt(15,12,4);
for(const x of [5,6,14,15])arm(x,11,8,filter(['iron-plate']));for(const x of [2,11])arm(x,11,8,filter(['copper-plate']));
for(const[i,item]of products.entries()){
 const y=i+1,reserve={inserter:2,'fast-inserter':2}[item]||0;
 const e=arm(width+1,y,12,{...filter([item]),control_behavior:reserve?{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator:'>',constant:reserve}}:undefined});wire(e,at(width,y));
 const chest=add('passive-provider-chest',width+2,y,{bar:1});
 // A separate one-slot provider gives each product a physical 50-item stock cap.
 // One accessible stack bounds storage; the red condition preserves upgrade stock.
 delete e.control_behavior?.connect_to_logistic_network;
 ports.push({kind:'output',item,items:[item],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,position:chest.position,externalSide:'east',cap:50,reserve});
}
const sig=name=>({type:'virtual',name});
const comb=(x,y,op,first,out,k)=>add('arithmetic-combinator',x,y,{position:{x:x+1,y:y+.5},direction:4,control_behavior:{arithmetic_conditions:{first_signal:sig(first),second_constant:k,operation:op,output_signal:sig(out)}}});
const timer=comb(8,8,'+','signal-T','signal-T',1),divide=comb(8,9,'/','signal-T','signal-U',600),phase=comb(8,10,'%','signal-U','signal-P',3);
wires.push([timer.entity_number,3,timer.entity_number,1],[timer.entity_number,3,divide.entity_number,1],[divide.entity_number,3,phase.entity_number,1],[phase.entity_number,3,at(12,6).entity_number,1]);
ports.push({kind:'power',items:[],entity:0,x:0,y:0});
const version=decodeBlueprint(await fs.readFile('blueprint-sources/early-controlled-loops/science-fast-loop.txt','utf8')).blueprint.version;
const bp={item:'blueprint',version,label:'On-demand inserter workshop · four arms',description:'WEST iron/copper plates and plastic. EAST four capped passive providers. Internal gears, wire, green/red circuits; AM2, red belts, bulk arms at unlock capacity 2. Preserve stock circuits and upgrade reserves.',icons:products.map((name,i)=>({index:i+1,signal:{type:'item',name}})),entities,wires:[]};
const layout={entities,wires:bp.wires,next,place(e){entities.push(e);}};powerFiveLayout(layout,ports,raw);
// Keep power inside the production rectangle: replace the protruding top pole
// with two substations in the existing free side margins, preserving the dock.
const protruding=entities.find(e=>e.name==='substation'&&e.position.y< -3);
if(protruding){protruding.position={x:1,y:-2};const extra={entity_number:Math.max(...entities.map(e=>e.entity_number))+1,name:'substation',position:{x:18,y:-2},tags:{five_science_power:true}};entities.push(extra);const poles=[entities.find(e=>e.name==='substation'&&e.position.x===1&&e.position.y===8),protruding,extra,entities.find(e=>e.name==='substation'&&e.position.x===18&&e.position.y===8)];assert(poles.every(Boolean));bp.wires=bp.wires.filter(w=>w[1]!==5);for(let i=1;i<poles.length;i++)bp.wires.push([poles[i-1].entity_number,5,poles[i].entity_number,5]);}
bp.wires.push(...wires);for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
for(const w of bp.wires)for(const i of [0,2]){const e=entities.find(e=>e.entity_number===w[i]);if(e?.name==='fast-underground-belt'){const near=entities.filter(n=>n.name==='fast-transport-belt').sort((a,b)=>Math.hypot(a.position.x-e.position.x,a.position.y-e.position.y)-Math.hypot(b.position.x-e.position.x,b.position.y-e.position.y))[0];w[i]=near.entity_number;}}
const code=encodeBlueprint({blueprint:bp});await fs.mkdir(root,{recursive:true});await fs.writeFile(root+'/'+id+'.txt',code+'\n');
const record={id,name:bp.label,file:id+'.txt',blueprintSha256:createHash('sha256').update(code).digest('hex'),products,inputMapping:Object.fromEntries(ports.filter(p=>p.kind==='input').map(p=>[p.item,p.entity])),outputMapping:Object.fromEntries(ports.filter(p=>p.kind==='output').map(p=>[p.item,p.entity])),outputCaps:Object.fromEntries(products.map(n=>[n,50])),requiredInputsPerMinute:{'iron-plate':422.5,'copper-plate':192.5,'plastic-bar':5},requestedTargets:{inserter:15,'long-handed-inserter':15,'fast-inserter':15,'bulk-inserter':5},requestedInputsPerMinute:{'iron-plate':560,'copper-plate':272.5,'plastic-bar':10},inputs:ports.filter(p=>p.kind==='input'),optionalInputs:[],outputs:ports.filter(p=>p.kind==='output'),ports,machines,machineCounts:machines.reduce((counts,m)=>(counts[m.recipe]=(counts[m.recipe]||0)+1,counts),{}),construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length])),footprint:starterBounds(bp.entities,raw),loopControl:[{name:id,reader:reader.entity_number,controlled,clock:{timer:timer.entity_number,divide:divide.entity_number,phase:phase.entity_number,periodTicks:1800,windowTicks:600,normalPhases:[0,1],longPhases:[0],fastPhases:[1,2],bulkPhases:[0,1,2]},loop:loop.map(e=>e.entity_number),capacity:loop.length*8,maximumStock:Object.values(limits).reduce((a,b)=>a+b,0),limits}],targets:{inserter:15,'long-handed-inserter':15,'fast-inserter':15,'bulk-inserter':2.5},notes:['Explicit compact on-demand alternative: bulk 2.5/min, not the requested continuous 5/min. Keep the 26x17 loop and rear feeds instead of extending the transport and admitting more shared-belt traffic. Native 5/min bulk attempt did not qualify; all four independent selective stock replenishments do qualify.','Direct cable into both green assemblers, extra rear cable into the second green assembler, and local long-arm cable feed into red circuits; filtered two-lane rear iron/copper feed.','Independent one-stack provider caps: 50 each; normal reserve 2 and fast reserve 2 on loop before export.','No intermediate injection; baseline bulk hand 2, fast bonus zero.'],prototypeSha256:createHash('sha256').update(await fs.readFile(process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json')).digest('hex'),status:'native-validation-pending'};
assert(record.loopControl[0].maximumStock<loop.length*8*.85,'stock needs lane headroom');await fs.writeFile(root+'/manifest.json',JSON.stringify([record],null,2)+'\n');console.log(JSON.stringify({footprint:record.footprint,construction:record.construction,stock:record.loopControl[0]},null,2));
