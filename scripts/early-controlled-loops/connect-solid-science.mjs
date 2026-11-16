import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint} from '../blueprints.mjs';import {starterBounds} from '../compact-starter-layout.mjs';
const root='blueprint-sources/early-controlled-loops',raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json'));
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json'));const sourceIds=['science-solid-feeder','science-fast-loop'];
let next=1;const entities=[],wires=[],loops=[],inputs=[],outputs=[],optionalInputs=[],ports=[],polesByPart=[],machineCounts={};let power;
const shifts=[0,34];let version;
for(const [index,id]of sourceIds.entries()){
 const m=manifest.find(m=>m.id===id),bp=decodeBlueprint(await fs.readFile(root+'/'+m.file,'utf8')).blueprint;version=bp.version;
 const map=new Map(bp.entities.map(e=>[e.entity_number,next++]));
 for(const saved of bp.entities){const e=structuredClone(saved);e.entity_number=map.get(saved.entity_number);e.position.x+=shifts[index];e.tags={...e.tags,flight_science_entity:e.entity_number};for(const key of ['starter_entity','input_display'])if(map.has(e.tags[key]))e.tags[key]=map.get(e.tags[key]);entities.push(e);}
 for(const [a,ac,b,bc]of bp.wires||[])wires.push([map.get(a),ac,map.get(b),bc]);
 for(const l of m.loopControl)loops.push({...l,reader:map.get(l.reader),controlled:l.controlled.map(id=>map.get(id)),loop:l.loop.map(id=>map.get(id))});
 const translate=p=>({...p,entity:map.get(p.entity),x:p.x+shifts[index],position:{x:p.x+shifts[index],y:p.y}});
 if(index===0){for(const p of m.inputs)inputs.push(translate(p));power=translate(m.ports.find(p=>p.kind==='power'));}
 else{for(const p of m.outputs)outputs.push(translate(p));/* Complete factory supports raw-only feeds; leave the inherited gear tap unused. */}
 polesByPart.push(bp.entities.filter(e=>e.name.endsWith('electric-pole')).map(e=>({entity:map.get(e.entity_number),name:e.name,position:{x:e.position.x+shifts[index],y:e.position.y}})));
 for(const [r,n]of Object.entries(m.machineCounts))machineCounts[r]=(machineCounts[r]||0)+n;
}
function add(name,x,y,extra={}){assert(!entities.some(e=>e.position.x===x&&e.position.y===y),'Bridge collision '+x+','+y);const e={entity_number:next++,name,position:{x,y},...extra,tags:{flight_science_entity:next-1}};entities.push(e);return e;}
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
for(const y of [1.5,3.5,5.5,7.5])add('fast-inserter',24.5,y,{direction:12,override_stack_size:1});
belt(25.5,1.5,4);belt(26.5,1.5,4);belt(25.5,3.5,4);belt(26.5,3.5,0);belt(26.5,2.5,4);add('fast-splitter',27.5,2,{direction:4,output_priority:'left'});belt(28.5,1.5,4);
for(const [sourceY,targetY]of [[5.5,4.5],[7.5,6.5]]){belt(25.5,sourceY,4);belt(26.5,sourceY,0);for(const x of [26.5,27.5,28.5])belt(x,targetY,4);}
const transferPole=add('medium-electric-pole',24.5,4.5);wires.push([transferPole.entity_number,5,polesByPart[0].find(p=>p.position.x===19.5&&p.position.y===2.5).entity,5]);
const bridge=add('big-electric-pole',27,11);
for(const poles of polesByPart){const candidates=poles.map(p=>({...p,d:Math.hypot(p.position.x-27,p.position.y-11)})).filter(p=>p.d<=Math.min(30,raw['electric-pole'][p.name].maximum_wire_distance));candidates.sort((a,b)=>a.d-b.d);assert(candidates.length,'Power bridge cannot reach a part');wires.push([bridge.entity_number,5,candidates[0].entity,5]);}
ports.push(...inputs,...optionalInputs,...outputs,power);
const id='solid-science-complete',bp={item:'blueprint',version,label:'Complete compact science · Ore + solid fuel → 30/min red + green',description:'Connected compact solid-fuel feeder and faster science loop. Supply only iron ore, copper ore and solid fuel at the west entrances, plus grid electricity at P. Two adjacent output chests contain red and green science. All plate/circuit transfer inserters, red belts, iron merger and the shared power connection are included. Internal intermediate chests must stay connected. Preserve both separate red stock-control networks. No modules.',icons:[{index:1,signal:{type:'item',name:'automation-science-pack'}},{index:2,signal:{type:'item',name:'logistic-science-pack'}}],entities,wires};
const code=encodeBlueprint({blueprint:bp});await fs.writeFile(root+'/'+id+'.txt',code+'\n');
const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].map(n=>[n,entities.filter(e=>e.name===n).length]));
const m={id,name:'Complete connected science · Ore + solid fuel',file:id+'.txt',blueprintSha256:createHash('sha256').update(code).digest('hex'),products:['automation-science-pack','logistic-science-pack'],inputs,optionalInputs,outputs,ports,machineCounts,footprint:starterBounds(entities,raw),supplier:true,completeChain:true,minimumPerMinute:{'automation-science-pack':29.5,'logistic-science-pack':29.5},construction,loopControl:loops,status:'candidate-native-validation-pending'};
const updated=[m,...manifest.filter(m=>m.id!==id)];await fs.writeFile(root+'/manifest.json',JSON.stringify(updated,null,2)+'\n');
for(const [file,selected,label]of [['controlled-loops-book.txt',updated,'Compact science and controlled-loop collection'],['fast-science-solid-fuel-book.txt',updated.filter(m=>[id,...sourceIds].includes(m.id)),'Compact solid-fuel science · Complete factory and separate parts']]){const contents=[];for(const m of selected)contents.push({index:contents.length,blueprint:decodeBlueprint(await fs.readFile(root+'/'+m.file,'utf8')).blueprint});await fs.writeFile(root+'/'+file,encodeBlueprint({blueprint_book:{item:'blueprint-book',version,label,active_index:0,blueprints:contents}})+'\n');}
console.log(JSON.stringify({id,footprint:m.footprint,construction},null,2));
