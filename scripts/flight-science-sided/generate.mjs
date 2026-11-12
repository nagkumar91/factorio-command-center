// Historical four-pack experiment; not the six-pack deliverable.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerStarterLayout,starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname),out=path.join(root,'blueprint-sources/flight-science-sided/history/four-pack-candidate');
const bytes=await fs.readFile(path.join(root,'.cache/flight-21/script-output/data-raw-dump.json')),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
const entities=[],wires=[],ports=[],occupied=new Set(),counts={};let next=1;
function add(name,x,y,extra={}){const r=name==='assembling-machine-2'?1:0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++){assert(!occupied.has(`${a},${b}`),`collision ${name} ${a},${b}`);occupied.add(`${a},${b}`);}const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);return e;}
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
const condition=(item,n,comparator='<')=>({circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator,constant:n}});
const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
const wire=(a,b)=>wires.push([a.entity_number,1,b.entity_number,1]);
const rep=(n,r)=>Array(n).fill(r);
const top=[...rep(7,'automation-science-pack'),'iron-gear-wheel','transport-belt','inserter',...rep(9,'logistic-science-pack'),...rep(7,'military-science-pack'),'iron-gear-wheel'];
const bottom=[...rep(17,'chemical-science-pack'),'iron-gear-wheel','firearm-magazine',...rep(3,'piercing-rounds-magazine'),...rep(6,'grenade')];
const W=Math.max(top.length,bottom.length)*3+5,H=12;
const limits={'copper-plate':36,'steel-plate':20,sulfur:24,coal:240,'stone-wall':40,'electronic-circuit':70,'advanced-circuit':110,'engine-unit':80,'iron-gear-wheel':140,'transport-belt':48,inserter:48,'firearm-magazine':48,'piercing-rounds-magazine':48,grenade:56,'automation-science-pack':32,'logistic-science-pack':32,'chemical-science-pack':64,'military-science-pack':32};
const loop=[];for(let x=0;x<=W;x++)loop.push(belt(x,0,x===W?8:4));for(let y=1;y<=H;y++)loop.push(belt(W,y,y===H?12:8));for(let x=W-1;x>=0;x--)loop.push(belt(x,H,x===0?0:12));for(let y=H-1;y>0;y--)loop.push(belt(0,y,0));
const at=(x,y)=>entities.find(e=>e.position.x===x+.5&&e.position.y===y+.5);
loop[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
for(const [side,recipes]of [['top',top],['bottom',bottom]])for(const [i,recipe]of recipes.entries()){const x=4+i*3,y=side==='top'?-3:H+3,ay=side==='top'?-1:H+1,dir=side==='top'?8:0;add('assembling-machine-2',x,y,{recipe});counts[recipe]=(counts[recipe]||0)+1;for(const dx of [-1,0])add('fast-inserter',x+dx,ay,{direction:dir,override_stack_size:1});const arm=add('fast-inserter',x+1,ay,{direction:(dir+8)%16,override_stack_size:1,control_behavior:condition(recipe,limits[recipe])});wire(arm,at(x+1,side==='top'?0:H));}
const feeds=[['coal',300,3],['copper-plate',90,1],['steel-plate',15,1],['sulfur',30,1],['stone-wall',60,1],['electronic-circuit',60,1],['advanced-circuit',90,1],['engine-unit',60,1]];let row=1;
for(const [item,rate,arms]of feeds){const inlet=belt(-7,row,4);for(let x=-6;x<=-3;x++)belt(x,row,4);
 add('fast-underground-belt',-2,row,{direction:4,type:'input'});add('fast-underground-belt',2,row,{direction:4,type:'output'});if(arms>1){for(let i=0;i<arms;i++)belt(3,row+i,i===arms-1?12:8);for(let i=1;i<arms;i++)belt(2,row+i,0);}
 for(let i=0;i<arms;i++){const a=add('fast-inserter',1,row+i,{direction:4,override_stack_size:1,...filter(item),control_behavior:condition(item,limits[item])});wire(a,at(0,row+i));}
 ports.push({kind:'input',label:item,items:[item],entity:inlet.entity_number,x:inlet.position.x,y:inlet.position.y,direction:4,externalSide:'west',perMinute:rate});row+=arms;
}
// A dedicated iron perimeter avoids circulating high-volume plate traffic.
const ironIn=belt(-7,-6,4),ironTurn=W-1;
for(let x=-6;x<=ironTurn;x++)belt(x,-6,x===ironTurn?8:4);
for(let y=-5;y<=-3;y++)belt(ironTurn,y,8);
add('fast-underground-belt',ironTurn,-2,{direction:8,type:'input'});add('fast-underground-belt',ironTurn,2,{direction:8,type:'output'});
for(let y=3;y<=H-3;y++)belt(ironTurn,y,8);
add('fast-underground-belt',ironTurn,H-2,{direction:8,type:'input'});add('fast-underground-belt',ironTurn,H+2,{direction:8,type:'output'});
for(let y=H+3;y<=H+6;y++)belt(ironTurn,y,y===H+6?12:8);
for(let x=ironTurn-1;x>=3;x--)belt(x,H+6,12);
for(const [side,recipes]of [['top',top],['bottom',bottom]])for(const [i,recipe]of recipes.entries())if(raw.recipe[recipe].ingredients.some(i=>i.name==='iron-plate')){const x=4+i*3,y=side==='top'?-5:H+5,d=side==='top'?0:8;for(let a=0;a<(recipe==='iron-gear-wheel'?2:1);a++)add('fast-inserter',x-a,y,{direction:d,override_stack_size:1});}
ports.unshift({kind:'input',label:'iron-plate',items:['iron-plate'],entity:ironIn.entity_number,x:ironIn.position.x,y:ironIn.position.y,direction:4,externalSide:'west',perMinute:660});
const products=['automation-science-pack','logistic-science-pack','chemical-science-pack','military-science-pack'];
for(const [i,item]of products.entries()){const y=2+i*3;add('fast-inserter',W+1,y,{direction:12,override_stack_size:1,...filter(item)});const c=add('wooden-chest',W+2,y,{bar:1});ports.push({kind:'output',label:item,items:[item],entity:c.entity_number,x:c.position.x,y:c.position.y,perMinute:60,externalSide:'east'});}
ports.push({kind:'power',label:'Power',items:[],entity:0,x:0,y:0});
const bp={item:'blueprint',version:562954249961472,label:'Four science packs · left in / right out · 60/min',entities,wires:[],icons:products.map((name,i)=>({index:i+1,signal:{type:'item',name}}))};powerStarterLayout(bp,[...ports,{kind:'input',x:-8,y:-8}],raw);bp.wires.push(...wires);
let eid=Math.max(...bp.entities.map(e=>e.entity_number))+1;for(const p of ports.filter(p=>p.kind!=='power')){const x=p.kind==='input'?p.x-1:p.x+1;bp.entities.push({entity_number:eid++,name:'display-panel',position:{x,y:p.y},icon:{type:'item',name:p.items[0]},text:`${p.kind==='input'?'IN':'OUT'} ${p.label}: ${p.perMinute}/min`,always_show:true});p.displayEntity=eid-1;}
for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};bp.description='Feed each labeled inlet from the left. Collect four chests on the right. Finished green/red circuits and engines required. AM2, fast inserters, red belts; normal quality, no modules. Keep circuit stock limits and wires.';
const code=encodeBlueprint({blueprint:bp}),footprint=starterBounds(bp.entities,raw),id='four-pack-sided-60';const manifest={id,name:bp.label,file:id+'.txt',products,blueprintSha256:sha(code),prototypeSha256:sha(bytes),ports,footprint,machineCounts:counts,inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:p.direction,perMinute:p.perMinute})),outputs:ports.filter(p=>p.kind==='output').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:60})),loopControl:[{name:'Science',reader:loop[0].entity_number,controlled:entities.filter(e=>e.control_behavior?.circuit_enabled).map(e=>e.entity_number),capacity:loop.length*8,limits}],setupNotes:[bp.description],status:'awaiting-native-validation'};
await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,id+'.txt'),code+'\n');await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');console.log({footprint,counts});
