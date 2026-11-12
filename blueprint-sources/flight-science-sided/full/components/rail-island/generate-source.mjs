import fs from 'node:fs/promises';import path from 'node:path';import{fileURLToPath}from'node:url';import assert from 'node:assert/strict';import {createHash}from'node:crypto';
import{encodeBlueprint}from'../../../../../scripts/blueprints.mjs';import{powerStarterLayout,starterBounds}from'../../../../../scripts/science-factory/local-ports/compact-shared-layout.mjs';
const project=fileURLToPath(new URL('../../../../../',import.meta.url)),out=path.resolve(process.env.RAIL_OUTPUT||path.join(project,'.cache/rail-island-reproduction')),bytes=await fs.readFile(path.join(project,'.cache/flight-21/script-output/data-raw-dump.json')),raw=JSON.parse(bytes),sha=v=>createHash('sha256').update(v).digest('hex');
await fs.mkdir(out,{recursive:true});
const entities=[],ports=[],taken=new Set();let id=1;
function add(name,x,y,extra={}){const r=name==='assembling-machine-2'?1:0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++){const k=a+','+b;assert(!taken.has(k),'Collision '+name+' '+k);taken.add(k);}const e={entity_number:id++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);return e;}
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
const arm=(x,y,d,item)=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...(item?filter(item):{})});
function input(item,x,y,rate){const e=belt(x,y,4);ports.push({kind:'input',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:4,externalSide:'west',perMinute:rate});}
for(let x=-2;x<=7;x++)belt(x,-3,4);
input('stone',-3,-5,100);for(let x=-2;x<=1;x++)belt(x,-5,x===1?8:4);belt(1,-4,8);
input('steel-plate',-3,-1,100);belt(-2,-1,4);belt(-1,-1,0);belt(-1,-2,0);
for(const x of[3,6]){add('assembling-machine-2',x,0,{recipe:'rail'});arm(x-1,-2,0,'stone');arm(x,-2,0,'steel-plate');arm(x-1,2,8,'iron-stick');arm(x+1,2,0,'rail');}
for(let x=1;x<=8;x++)belt(x,3,x===8?8:4);belt(8,4,8);belt(8,5,8);
add('assembling-machine-2',3,6,{recipe:'iron-stick'});arm(2,4,8,'iron-stick');arm(3,8,8,'iron-plate');input('iron-plate',-3,9,50);for(let x=-2;x<=3;x++)belt(x,9,4);
for(const y of[3,5]){arm(9,y,12,'rail');const e=add('wooden-chest',10,y,{bar:1});ports.push({kind:'output',label:'rail',items:['rail'],entity:e.entity_number,x:e.position.x,y:e.position.y,externalSide:'east',perMinute:100});}
ports.push({kind:'power',label:'External electricity',items:[],entity:0,x:0,y:0});
const bp={item:'blueprint',version:562954249961472,label:'Private rail island · 200/min',description:'Two rail AM2s and one stick AM2. Front belt: stone/steel on separate lanes. Rear belt: sticks north, rails south. Normal quality, fast inserters, red belts, no modules/bots/circuit controls. Demand at 200 rails/min: stone100, steel100, iron50.',entities,wires:[],icons:[{index:1,signal:{type:'item',name:'rail'}}]};powerStarterLayout(bp,ports,raw);for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
const code=encodeBlueprint({blueprint:bp}),name='rail-island-200';const m={id:name,name:bp.label,file:name+'.txt',products:['rail'],targetPerMinute:200,blueprintSha256:sha(code),prototypeSha256:sha(bytes),gameVersion:'2.1.24',ports,footprint:starterBounds(bp.entities,raw),machineCounts:{rail:2,'iron-stick':1},inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:4,perMinute:p.perMinute})),outputs:ports.filter(p=>p.kind==='output').map(p=>({item:'rail',entity:p.entity,position:{x:p.x,y:p.y},perMinute:100})),loopControl:[],setupNotes:[bp.description],privateCandidate:true};
await fs.writeFile(path.join(out,name+'.txt'),code+'\n');await fs.writeFile(path.join(out,name+'.json'),JSON.stringify({blueprint:bp},null,2)+'\n');await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([m],null,2)+'\n');console.log(JSON.stringify({hash:m.blueprintSha256,footprint:m.footprint,entities:bp.entities.length},null,2));
