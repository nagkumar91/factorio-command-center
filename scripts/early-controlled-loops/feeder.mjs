import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeTransportLoop} from '../transport-loop-layout.mjs';
import {starterBounds,powerStarterLayout} from '../compact-starter-layout.mjs';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
const out='blueprint-sources/early-controlled-loops';
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json'));
for(const r of Object.values(raw.recipe))r.category=r.category||r.categories?.[0]||'crafting';
const recipes=[...Array(9).fill('iron-plate'),...Array(3).fill('copper-plate'),'copper-cable','electronic-circuit','copper-plate',...Array(9).fill('steel-plate')];
const products=['iron-plate','copper-plate','steel-plate','electronic-circuit'];
const limits={'iron-ore':160,'copper-ore':64,coal:64,'iron-plate':200,'copper-plate':64,'steel-plate':32,'copper-cable':64,'electronic-circuit':32};
const layout=makeTransportLoop({recipes,products,raw,rawInputs:['iron-ore','copper-ore','coal'],columns:5,pitch:6,limitOverrides:limits,inputInserterCounts:{'iron-ore':2},inputReserveByRecipe:{'steel-plate':{'iron-plate':120},'electronic-circuit':{'iron-plate':24},'copper-cable':{'copper-plate':12}}});
const bp=layout.blueprint;
for(const e of bp.entities)if(e.name==='assembling-machine-2')e.name='assembling-machine-1';
// Aggregate output from the shared loop instead of taking only the first furnace.
for(const p of layout.ports.filter(p=>p.kind==='output')){
 const chest=bp.entities.find(e=>e.entity_number===p.entity),arm=bp.entities.find(e=>e.name==='fast-inserter'&&e.position.x===chest.position.x&&e.position.y===chest.position.y-1);
 if(!arm)throw Error('Missing output collector '+p.items[0]);
 const old={...chest.position};chest.position={...arm.position};chest.name='iron-chest';arm.position=old;arm.direction=8;arm.use_filters=true;arm.filters=[{index:1,name:p.items[0],quality:'normal',comparator:'='}];arm.control_behavior={circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:p.items[0],quality:'normal'},comparator:'≥',constant:Math.floor(limits[p.items[0]]/2)}};if(!layout.loopControl.controlled.includes(arm.entity_number))layout.loopControl.controlled.push(arm.entity_number);p.x=chest.position.x;p.y=chest.position.y;
}
// Add a third controlled ore-loading arm so the shared plant can feed nine iron furnaces.
bp.entities=bp.entities.filter(e=>!['medium-electric-pole','big-electric-pole','small-electric-pole'].includes(e.name));
let next=Math.max(...bp.entities.map(e=>e.entity_number))+1;
const second=bp.entities.find(e=>e.name==='transport-belt'&&e.position.x===-1.5&&e.position.y===3.5);if(!second)throw Error('Missing iron feed turn');second.direction=8;
for(const pos of [{x:-1.5,y:4.5},{x:-.5,y:4.5}])if(bp.entities.some(e=>e.position.x===pos.x&&e.position.y===pos.y))throw Error('Blocked extra ore loader');
bp.entities.push({entity_number:next++,name:'transport-belt',position:{x:-1.5,y:4.5},direction:4});
const extra={entity_number:next++,name:'fast-inserter',position:{x:-.5,y:4.5},direction:12,override_stack_size:1,use_filters:true,filters:[{index:1,name:'iron-ore',quality:'normal',comparator:'='}],control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:'iron-ore',quality:'normal'},comparator:'<',constant:160}}};bp.entities.push(extra);layout.loopControl.controlled.push(extra.entity_number);
// Steel and circuits were terminal recipes in the source template; return them to
// the loop too, so all four export collectors can draw the aggregated production.
for(const machine of [...bp.entities]){
 const recipe=machine.tags?.production_recipe;if(!['steel-plate','electronic-circuit'].includes(recipe))continue;
 const position=machine.name==='steel-furnace'?{x:machine.position.x+.5,y:machine.position.y-1.5}:{x:machine.position.x+1,y:machine.position.y-2};
 const arm={entity_number:next++,name:'fast-inserter',position,direction:8,override_stack_size:1,control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:recipe,quality:'normal'},comparator:'<',constant:limits[recipe]}}};bp.entities.push(arm);layout.loopControl.controlled.push(arm.entity_number);
}
// Isolated export belts cross under the stock loop and end in four aligned chests.
function add(name,position,extra={}){if(bp.entities.some(e=>e.position.x===position.x&&e.position.y===position.y))throw Error('Blocked export at '+JSON.stringify(position));const e={entity_number:next++,name,position,...extra};bp.entities.push(e);return e;}
for(const p of layout.ports.filter(p=>p.kind==='output')){
 const buffer=bp.entities.find(e=>e.entity_number===p.entity),y=buffer.position.y,item=p.items[0];
 add('fast-inserter',{x:buffer.position.x+1,y},{direction:12,override_stack_size:1});
 for(let x=buffer.position.x+2;x<34.5;x++)add('transport-belt',{x,y},{direction:4});
 add('underground-belt',{x:34.5,y},{direction:4,type:'input'});add('underground-belt',{x:36.5,y},{direction:4,type:'output'});add('transport-belt',{x:37.5,y},{direction:4});
 add('fast-inserter',{x:38.5,y},{direction:12,override_stack_size:1,use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
 const chest=add('iron-chest',{x:39.5,y},{bar:1});add('display-panel',{x:39.5,y:y-1},{icon:{type:'item',name:item},text:'OUT: '+item+' →',always_show:true});
 p.bufferEntity=buffer.entity_number;p.entity=chest.entity_number;p.x=chest.position.x;p.y=chest.position.y;p.externalSide='east';
}
// Rebuild power after relocating the collectors, then connect the stock circuit.
const poles=powerStarterLayout(bp,layout.ports,raw),stockWires=[],degree=new Map();
const red=(a,b)=>{stockWires.push([a.entity_number,1,b.entity_number,1]);for(const e of [a,b])degree.set(e.entity_number,(degree.get(e.entity_number)||0)+1);};
const byId=new Map(bp.entities.map(e=>[e.entity_number,e]));for(const [a,,b]of bp.wires)red(byId.get(a),byId.get(b));
const reached=new Set(poles),pending=new Set([layout.loopControl.reader,...layout.loopControl.controlled].map(id=>byId.get(id)));
while(pending.size){let best;for(const a of reached)for(const b of pending){const d=Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);if(d<=9&&(degree.get(a.entity_number)||0)<5&&(!best||d<best.d))best={a,b,d};}if(!best)throw Error('Cannot connect feeder stock controller');red(best.a,best.b);reached.add(best.b);pending.delete(best.b);}
bp.wires.push(...stockWires);
for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
bp.label='Early Flight · Raw ore + coal feeder · Plates, steel, green circuits';bp.description='Shared supplier for the three controlled loops. Feed iron ore, copper ore and coal at the three west ports, and connect electricity at P. Steel furnaces make plates and steel; AM1s make cable and green circuits. Four filtered output chests collect from the shared stock-controlled loop, preserving internal reserves. No manufactured operating inputs. Fast inserters, yellow belts, AM1 and steel furnaces. Circuit network required. Output chests can be upgraded to passive providers after research.';
const code=encodeBlueprint({blueprint:bp}),id='ore-feeder';await fs.writeFile(`${out}/${id}.txt`,code+'\n');
const construction=Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length]));
const machineCounts={};for(const r of recipes)machineCounts[r]=(machineCounts[r]||0)+1;
const loop={name:id,...layout.loopControl,capacity:layout.loopControl.loop.length*8,maximumStock:Object.values(layout.loopControl.limits).reduce((a,b)=>a+b,0)};
const m={id,name:'Raw ore + coal feeder',file:id+'.txt',blueprintSha256:createHash('sha256').update(code).digest('hex'),products,inputs:layout.ports.filter(p=>p.kind==='input').map(p=>({...p,item:p.items[0],position:{x:p.x,y:p.y}})),optionalInputs:[],outputs:layout.ports.filter(p=>p.kind==='output').map(p=>({...p,item:p.items[0]})),ports:layout.ports,machineCounts,footprint:starterBounds(bp.entities,raw),construction,loopControl:[loop],status:'candidate-native-validation-pending'};
const manifest=JSON.parse(await fs.readFile(out+'/manifest.json'));const updated=[m,...manifest.filter(m=>m.id!==id)];await fs.writeFile(out+'/manifest.json',JSON.stringify(updated,null,2)+'\n');
const book={blueprint_book:{item:'blueprint-book',version:bp.version,label:'Early Flight · Raw feeder and three controlled loops',active_index:0,blueprints:[]}};for(const m of updated)book.blueprint_book.blueprints.push({index:book.blueprint_book.blueprints.length,blueprint:decodeBlueprint(await fs.readFile(out+'/'+m.file,'utf8')).blueprint});await fs.writeFile(out+'/controlled-loops-book.txt',encodeBlueprint(book)+'\n');
console.log(JSON.stringify({id,footprint:m.footprint,construction},null,2));
