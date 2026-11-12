import fs from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {powerStarterLayout} from '../science-factory/local-ports/compact-shared-layout.mjs';
const raw=JSON.parse(await fs.readFile('.cache/flight-21/script-output/data-raw-dump.json'));
const out='blueprint-sources/flight-forest';await fs.mkdir(out,{recursive:true});
const encode=b=>'0'+deflateSync(Buffer.from(JSON.stringify({blueprint:b}))).toString('base64');
const builds=[];
function begin(id,label){const b={item:'blueprint',label,version:562954249961472,entities:[],wires:[]};const m={id,label,file:id+'.txt',inputs:[],outputs:[],machines:[]};
 const add=(name,x,y,extra={})=>{const e={entity_number:b.entities.length+1,name,position:{x:x+.5,y:y+.5},...extra};e.tags={flight_forest_entity:e.entity_number};b.entities.push(e);return e};
 const arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
 const wire=(a,c,color=1)=>b.wires.push([a.entity_number,color,c.entity_number,color]);
 return {b,m,add,arm,wire};}
const signal=name=>({type:'item',name,quality:'normal'});
const condition=(name,constant)=>({circuit_enabled:true,circuit_condition:{first_signal:signal(name),comparator:'<',constant}});
async function save(o){const code=encode(o.b);o.m.blueprintSha256=createHash('sha256').update(code).digest('hex');o.m.entities=o.b.entities;o.m.wires=o.b.wires;await fs.writeFile(out+'/'+o.m.file,code+'\n');builds.push(o.m);}
{
const o=begin('forest-kit','Forest infrastructure workshop · finished circuit inputs'),{b,m,add,arm,wire}=o;
const recipes=['iron-gear-wheel','copper-cable','iron-stick','assembling-machine-1','inserter','landfill','agricultural-tower','assembling-machine-2','fast-inserter','medium-electric-pole','steel-chest','solar-panel','accumulator','transport-belt','fast-transport-belt','display-panel','big-electric-pole'];
const products=recipes.slice(6),W=recipes.length*4+2,H=4,loop=[];
for(let x=0;x<=W;x++)loop.push(add('fast-transport-belt',x,0,{direction:x===W?8:4}));
for(let y=1;y<=H;y++)loop.push(add('fast-transport-belt',W,y,{direction:y===H?12:8}));
for(let x=W-1;x>=0;x--)loop.push(add('fast-transport-belt',x,H,{direction:x===0?0:12}));
for(let y=H-1;y>0;y--)loop.push(add('fast-transport-belt',0,y,{direction:0}));
loop[0].control_behavior={circuit_read_hand_contents:true,circuit_contents_read_mode:2};for(let i=0;i<loop.length;i++)wire(loop[i],loop[(i+1)%loop.length]);
const at=(x,y)=>loop.find(e=>e.position.x===x+.5&&e.position.y===y+.5);
for(const [i,r]of recipes.entries()){let x=2+i*4;const machine=add('assembling-machine-2',x,-3,{recipe:r});m.machines.push(machine.entity_number);arm(x-1,-1,8);arm(x,-1,8);
 if(recipes.some(n=>raw.recipe[n].ingredients.some(v=>v.name===r))){const output=arm(x+1,-1,0,{control_behavior:condition(raw.recipe[r].results[0].name,24)});wire(output,at(x+1,0));}
 if(products.includes(r)){const chest=add('steel-chest',x,-6,{bar:1});const take=arm(x,-5,8);m.outputs.push({item:r,entity:chest.entity_number});}
}
const inputs=['iron-plate','copper-plate','steel-plate','electronic-circuit','spoilage','stone','battery'];
for(const[i,item]of inputs.entries()){const x=2+i*7;const chest=add('steel-chest',x,6,{bar:4}),a=arm(x,5,8,{use_filters:true,filters:[{index:1,name:item}],control_behavior:condition(item,item==='stone'?60:32)});wire(a,at(x,4));m.inputs.push({item,entity:chest.entity_number});add('display-panel',x+1,6,{icon:signal(item),text:'IN '+(i+1)+' '+item,always_show:true});}
// Products also circulate to satisfy downstream recipes; final boxes are extracted directly from machines.
const circuit=[...b.wires];powerStarterLayout(b,[{kind:'input',x:-2,y:0},{kind:'power'}],raw);b.wires.push(...circuit);m.power=b.entities.find(e=>e.name.endsWith('electric-pole')).entity_number;
for(const e of b.entities)e.tags={flight_forest_entity:e.entity_number};await save(o);
}
for(const mode of ['nursery','grove','autonomous']){
const standing=mode==='grove',autonomous=mode==='autonomous';
const o=begin(autonomous?'autonomous-forest':standing?'standing-grove':'renewable-nursery',autonomous?'Autonomous forest · solar reserve control':standing?'Standing grove · harvesting disabled':'Renewable tree nursery · solar powered'),{b,m,add,arm,wire}=o;
const tower=add('agricultural-tower',0,0,standing?{control_behavior:{enable_harvesting_condition:true,harvesting_condition:{constant:1,comparator:'>',first_signal:{type:'virtual',name:'signal-A'}}}}:{});m.tower=tower.entity_number;
if(!standing){
 const wood=add('steel-chest',3,0,{bar:8});arm(2,0,12,{use_filters:true,filters:[{index:1,name:'wood'}]});arm(4,0,12);const machine=add('assembling-machine-2',6,0,{recipe:'tree-seed'});m.machines.push(machine.entity_number);
 const seeds=add('steel-chest',6,-3,{bar:10});arm(6,-2,8);m.seedChest=seeds.entity_number;m.woodChest=wood.entity_number;
 if(autonomous){tower.control_behavior={enable_harvesting_condition:true,harvesting_condition:{first_signal:signal('tree-seed'),comparator:'<',constant:80}};wire(seeds,tower);}
 arm(5,-3,4);for(let x=4;x>=0;x--)add('fast-transport-belt',x,-3,{direction:12});arm(0,-2,0,{use_filters:true,filters:[{index:1,name:'tree-seed'}]});
 // Seed and wood buffers deliberately pause harvest when full. No seed burning or unbounded export.
 const poleA=add('medium-electric-pole',3,2),poleB=add('medium-electric-pole',3,-2);wire(poleA,poleB,5);m.power=poleA.entity_number;
 add('display-panel',7,-3,{icon:signal('tree-seed'),text:autonomous?'START: 50 seeds only. Autonomous reserve; do not remove wood or seeds.':'START: 50 seeds. Leave 20 seeds here. Export surplus wood from chest.',always_show:true});
 const bridge=add('medium-electric-pole',10,2);wire(poleA,bridge,5);
 const poles=[];for(const x of [9,17,25])for(const y of [-9,-1,7,15])poles.push(add('medium-electric-pole',x,y));for(const p of poles)for(const q of poles)if(p.entity_number<q.entity_number&&Math.hypot(p.position.x-q.position.x,p.position.y-q.position.y)<=9)wire(p,q,5);if(bridge)wire(bridge,poles.find(p=>p.position.x===9.5&&p.position.y===7.5),5);
 if(autonomous){m.autonomous=true;m.initialSeeds=50;}

 for(let x=0;x<4;x++)for(let y=0;y<4;y++)add('solar-panel',15+x*4,-7+y*4);
 // 2x2 entities use integer centers.
 for(let x=0;x<7;x++)for(let y=0;y<2;y++){const e=add('accumulator',14+x*2,10+y*2);e.position.x+=.5;e.position.y+=.5;}
 m.solarPanels=16;m.accumulators=14;
}else{const pole=add('medium-electric-pole',3,0);m.power=pole.entity_number;wire(tower,pole);const seed=add('steel-chest',0,-3,{bar:10});arm(0,-2,0);m.seedChest=seed.entity_number;m.inputs=[{item:'tree-seed',entity:seed.entity_number}];add('display-panel',2,-3,{icon:signal('tree-seed'),text:'Plant only. Supply seeds + grid power, then REMOVE tower/pole/chest after planting.',always_show:true});}
m.initialSeeds=50;await save(o);
}
await fs.writeFile(out+'/manifest.json',JSON.stringify(builds,null,2)+'\n');
const book={blueprint_book:{item:'blueprint-book',label:'Flight forest system · nursery + standing canopy + kit',active_index:0,version:562954249961472,blueprints:[]}};
for(const[i,m]of builds.entries()){const {inflateSync}=await import('node:zlib');book.blueprint_book.blueprints.push({index:i,...JSON.parse(inflateSync(Buffer.from((await fs.readFile(out+'/'+m.file,'utf8')).trim().slice(1),'base64')))});}
await fs.writeFile(out+'/flight-forest-book.txt','0'+deflateSync(Buffer.from(JSON.stringify(book))).toString('base64')+'\n');
console.log(builds.map(b=>({id:b.id,entities:b.entities.length,sha:b.blueprintSha256})));
