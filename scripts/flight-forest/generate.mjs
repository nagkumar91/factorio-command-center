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
// Tile rectangle of the saved entities (tile size from the prototype's collision box).
function footprint(entities){let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const e of entities){const p=Object.values(raw).map(g=>g[e.name]).find(p=>p?.collision_box),w=Math.ceil(p.collision_box[1][0]-p.collision_box[0][0]),h=Math.ceil(p.collision_box[1][1]-p.collision_box[0][1]);left=Math.min(left,Math.round(e.position.x-w/2));top=Math.min(top,Math.round(e.position.y-h/2));right=Math.max(right,Math.round(e.position.x+w/2));bottom=Math.max(bottom,Math.round(e.position.y+h/2));}return {left,top,right,bottom,width:right-left,height:bottom-top,area:(right-left)*(bottom-top)};}
async function save(o){const code=encode(o.b);o.m.blueprintSha256=createHash('sha256').update(code).digest('hex');o.m.entities=o.b.entities;o.m.wires=o.b.wires;await fs.writeFile(out+'/'+o.m.file,code+'\n');builds.push(o.m);}
{
const o=begin('forest-kit','Forest infrastructure workshop · finished circuit inputs'),{b,m,add,arm,wire}=o;
const recipes=['iron-gear-wheel','copper-cable','iron-stick','assembling-machine-1','inserter','landfill','agricultural-tower','assembling-machine-2','fast-inserter','medium-electric-pole','steel-chest','solar-panel','accumulator','transport-belt','fast-transport-belt','display-panel','big-electric-pole'];
// Two-row ring: machines pick from the eastbound top row; inputs drop on the westbound bottom row.
// The previous ring was five rows high with three empty interior rows (history/five-row-ring-f8e87959).
const products=recipes.slice(6),W=recipes.length*4+2,H=1,loop=[];
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
for(const[i,item]of inputs.entries()){const x=2+i*7;const chest=add('steel-chest',x,H+2,{bar:4}),a=arm(x,H+1,8,{use_filters:true,filters:[{index:1,name:item}],control_behavior:condition(item,item==='stone'?60:32)});wire(a,at(x,H));m.inputs.push({item,entity:chest.entity_number});add('display-panel',x+1,H+2,{icon:signal(item),text:'IN '+(i+1)+' '+item,always_show:true});}
// Products also circulate to satisfy downstream recipes; final boxes are extracted directly from machines.
const circuit=[...b.wires];powerStarterLayout(b,[{kind:'input',x:-2,y:0},{kind:'power'}],raw);b.wires.push(...circuit);m.power=b.entities.find(e=>e.name.endsWith('electric-pole')).entity_number;
for(const e of b.entities)e.tags={flight_forest_entity:e.entity_number};m.structureFootprint=footprint(b.entities);m.previousVersion='history/five-row-ring-f8e87959/forest-kit.txt';await save(o);
}
// Agricultural tower at tiles -1..1. It plants one tree per free 3x3 cell within three cells
// (tiles -10..10); any entity inside a cell blocks that cell. The tower builds keep all machinery
// in the two cells east of the tower (tiles 2..7, rows -1..1) and all power outside the planting area.
const plantingArea={left:-10,top:-10,right:11,bottom:11};
const envelope=f=>{const left=Math.min(f.left,plantingArea.left),top=Math.min(f.top,plantingArea.top),right=Math.max(f.right,plantingArea.right),bottom=Math.max(f.bottom,plantingArea.bottom);return {width:right-left,height:bottom-top,area:(right-left)*(bottom-top)}};
// Solar fields east of the planting area (column 11 onward). Rows of panels and accumulators are
// placed so that each pole row reaches every panel and accumulator; poles stay within 9 tiles.
const fields={
 nursery:{panels:[[-9],[-2],[1],[7]].flatMap(([y])=>[11,14,17,20].map(x=>[x,y])),accumulators:[...[11,13,15,17,19,21].map(x=>[x,-6]),[11,-4],[13,-4],...[11,13,15,17,19,21].map(x=>[x,5])],poles:[[11,4],[18,4],[18,-4],[15,-4]]},
 autonomous:{panels:[-7,-1,5].flatMap(y=>[11,14].map(x=>[x,y])),accumulators:[-4,3].flatMap(y=>[11,13,15].map(x=>[x,y])),poles:[[12,2],[12,-2]]}
};
const previous={'renewable-nursery':'history/spread-solar-field-8aec7ede/renewable-nursery.txt','standing-grove':'history/east-pole-84947de0/standing-grove.txt','autonomous-forest':'history/spread-machinery-86b30086/autonomous-forest.txt'};
for(const mode of ['nursery','grove','autonomous']){
const standing=mode==='grove',autonomous=mode==='autonomous';
const o=begin(autonomous?'autonomous-forest':standing?'standing-grove':'renewable-nursery',autonomous?'Autonomous forest · solar reserve control':standing?'Standing grove · harvesting disabled':'Renewable tree nursery · solar powered'),{b,m,add,arm,wire}=o;
const tower=add('agricultural-tower',0,0,standing?{control_behavior:{enable_harvesting_condition:true,harvesting_condition:{constant:1,comparator:'>',first_signal:{type:'virtual',name:'signal-A'}}}}:{});m.tower=tower.entity_number;
if(!standing){
 // Wood: tower -> filtered arm -> wood chest (north) -> arm -> seed AM2. Seeds: AM2 -> arm -> seed chest (south) -> filtered arm -> tower.
 // The START panel sits directly below the seed chest, sharing an edge with it and touching no other chest.
 const wood=add('steel-chest',3,-1,{bar:8});arm(2,-1,12,{use_filters:true,filters:[{index:1,name:'wood'}]});arm(4,-1,12);const machine=add('assembling-machine-2',6,0,{recipe:'tree-seed'});m.machines.push(machine.entity_number);
 const seeds=add('steel-chest',3,0,{bar:10});arm(4,0,4);arm(2,0,4,{use_filters:true,filters:[{index:1,name:'tree-seed'}]});m.seedChest=seeds.entity_number;m.woodChest=wood.entity_number;
 if(autonomous){tower.control_behavior={enable_harvesting_condition:true,harvesting_condition:{first_signal:signal('tree-seed'),comparator:'<',constant:80}};wire(seeds,tower);}
 // Seed and wood buffers deliberately pause harvest when full. No seed burning or unbounded export.
 const pole=add('medium-electric-pole',4,1);m.power=pole.entity_number;
 add('display-panel',3,1,{icon:signal('tree-seed'),text:autonomous?'START: put 50 seeds once in the chest directly above (red wire to tower). Autonomous reserve; do not remove wood or seeds.':'START: put 50 seeds in the chest directly above and leave 20 there. Export surplus wood from the north chest.',always_show:true});
 const field=fields[mode];
 for(const [x,y]of field.panels)add('solar-panel',x+1,y+1);
 // 2x2 entities use integer centers.
 for(const [x,y]of field.accumulators){const e=add('accumulator',x,y);e.position.x+=.5;e.position.y+=.5;}
 const poles=[pole,...field.poles.map(([x,y])=>add('medium-electric-pole',x,y))];
 for(let i=1;i<poles.length;i++)wire(poles[i-1],poles[i],5);
 m.solarPanels=field.panels.length;m.accumulators=field.accumulators.length;
 if(autonomous){m.autonomous=true;b.label='Autonomous forest candidate · 6 solar / 6 accumulators';m.label='Autonomous forest · compact 6/6 solar reserve control';}
}else{const pole=add('medium-electric-pole',1,-2);m.power=pole.entity_number;wire(tower,pole);const seed=add('steel-chest',0,-3,{bar:10});arm(0,-2,0);m.seedChest=seed.entity_number;m.inputs=[{item:'tree-seed',entity:seed.entity_number}];add('display-panel',-1,-3,{icon:signal('tree-seed'),text:'Plant only. Supply seeds + grid power, then REMOVE tower/pole/chest after planting.',always_show:true});}
m.initialSeeds=50;m.structureFootprint=footprint(b.entities);m.plantingEnvelope=envelope(m.structureFootprint);m.previousVersion=previous[m.id];await save(o);
}
await fs.writeFile(out+'/manifest.json',JSON.stringify(builds,null,2)+'\n');
const book={blueprint_book:{item:'blueprint-book',label:'Flight forest system · nursery + standing canopy + kit',active_index:0,version:562954249961472,blueprints:[]}};
for(const[i,m]of builds.entries()){const {inflateSync}=await import('node:zlib');book.blueprint_book.blueprints.push({index:i,...JSON.parse(inflateSync(Buffer.from((await fs.readFile(out+'/'+m.file,'utf8')).trim().slice(1),'base64')))});}
await fs.writeFile(out+'/flight-forest-book.txt','0'+deflateSync(Buffer.from(JSON.stringify(book))).toString('base64')+'\n');
console.log(builds.map(b=>({id:b.id,entities:b.entities.length,sha:b.blueprintSha256,footprint:b.structureFootprint&&b.structureFootprint.width+'x'+b.structureFootprint.height+'='+b.structureFootprint.area,envelope:b.plantingEnvelope&&b.plantingEnvelope.width+'x'+b.plantingEnvelope.height+'='+b.plantingEnvelope.area})));
