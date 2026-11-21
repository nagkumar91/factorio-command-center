import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeTransportLoop} from '../transport-loop-layout.mjs';
import {starterBounds,powerStarterLayout} from '../compact-starter-layout.mjs';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
import {qualification} from './qualification.mjs';
const out='blueprint-sources/early-controlled-loops';
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW||'.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json'));
for(const r of Object.values(raw.recipe))r.category=r.category||r.categories?.[0]||'crafting';
const recipes=[...Array(9).fill('iron-plate'),...Array(4).fill('copper-plate'),'copper-cable','electronic-circuit'];
const products=['iron-plate','copper-plate','electronic-circuit'];
const limits={'iron-ore':160,'copper-ore':64,coal:16,'iron-plate':120,'copper-plate':96,'copper-cable':96,'electronic-circuit':32};
const layout=makeTransportLoop({recipes,products:[],raw,rawInputs:['iron-ore','copper-ore','coal'],columns:4,pitch:6,limitOverrides:limits,inputInserterCounts:{'iron-ore':2},inputReserveByRecipe:{'electronic-circuit':{'iron-plate':8},'copper-cable':{'copper-plate':12}}});
const bp=layout.blueprint;

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
 const recipe=machine.tags?.production_recipe;if(recipe!=='electronic-circuit')continue;
 const position=machine.name==='steel-furnace'?{x:machine.position.x+.5,y:machine.position.y-1.5}:{x:machine.position.x+1,y:machine.position.y-2};
 const arm={entity_number:next++,name:'fast-inserter',position,direction:8,override_stack_size:1,control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:recipe,quality:'normal'},comparator:'<',constant:limits[recipe]}}};bp.entities.push(arm);layout.loopControl.controlled.push(arm.entity_number);
}
// Two plate collectors provide the throughput a single inserter cannot.
function add(name,position,extra={}){if(bp.entities.some(e=>e.position.x===position.x&&e.position.y===position.y))throw Error('Blocked export at '+JSON.stringify(position));const e={entity_number:next++,name,position,...extra};bp.entities.push(e);return e;}
for(const [item,y,reserve]of [['iron-plate',1,32],['iron-plate',3,32],['copper-plate',15,64],['electronic-circuit',17,0]]){
 const arm=add('fast-inserter',{x:30.5,y:y+.5},{direction:12,override_stack_size:1,use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}],control_behavior:{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:item,quality:'normal'},comparator:'>',constant:reserve}}});layout.loopControl.controlled.push(arm.entity_number);
 const chest=add('iron-chest',{x:31.5,y:y+.5},{bar:1});add('display-panel',{x:31.5,y:y-.5},{icon:{type:'item',name:item},text:'OUT: '+item+' →',always_show:true});
 layout.ports.push({kind:'output',label:item,items:[item],entity:chest.entity_number,x:chest.position.x,y:chest.position.y,externalSide:'east'});
}
for(const e of bp.entities)if(e.name==='transport-belt')e.name='fast-transport-belt';
// Rebuild power after relocating the collectors, then connect the stock circuit.
const poles=powerStarterLayout(bp,layout.ports,raw),stockWires=[],degree=new Map();
const red=(a,b)=>{stockWires.push([a.entity_number,1,b.entity_number,1]);for(const e of [a,b])degree.set(e.entity_number,(degree.get(e.entity_number)||0)+1);};
const byId=new Map(bp.entities.map(e=>[e.entity_number,e]));for(const [a,,b]of bp.wires)red(byId.get(a),byId.get(b));
const reached=new Set(poles),pending=new Set([layout.loopControl.reader,...layout.loopControl.controlled].map(id=>byId.get(id)));
while(pending.size){let best;for(const a of reached)for(const b of pending){const d=Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);if(d<=9&&(degree.get(a.entity_number)||0)<5&&(!best||d<best.d))best={a,b,d};}if(!best)throw Error('Cannot connect feeder stock controller');red(best.a,best.b);reached.add(best.b);pending.delete(best.b);}
bp.wires.push(...stockWires);
for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
bp.label='Fast red + green science · Dedicated ore feeder';bp.icons=products.map((name,i)=>({index:i+1,signal:{type:'item',name}}));bp.description='Dedicated iron ore + copper ore + coal supplier for the 30/min red/green science loop. Steel furnaces, AM2 circuit production, red belts and fast inserters; no modules. Four east output chests: TWO iron-plate chests (merge both output belts), one copper-plate chest, one green-circuit chest. Circuit network required; preserve all stock wires. Connect power at P.';
const code=encodeBlueprint({blueprint:bp}),id='science-ore-feeder';await fs.writeFile(`${out}/${id}.txt`,code+'\n');
const construction=Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length]));
const machineCounts={};for(const r of recipes)machineCounts[r]=(machineCounts[r]||0)+1;
const loop={name:id,...layout.loopControl,capacity:layout.loopControl.loop.length*8,maximumStock:Object.values(layout.loopControl.limits).reduce((a,b)=>a+b,0)};
const m={id,name:'30/min science · Dedicated ore feeder',file:id+'.txt',blueprintSha256:createHash('sha256').update(code).digest('hex'),products,inputs:layout.ports.filter(p=>p.kind==='input').map(p=>({...p,item:p.items[0],position:{x:p.x,y:p.y}})),optionalInputs:[],outputs:layout.ports.filter(p=>p.kind==='output').map(p=>({...p,item:p.items[0]})),ports:layout.ports,machineCounts,footprint:starterBounds(bp.entities,raw),supplier:true,minimumPerMinute:{'iron-plate':209,'copper-plate':36,'electronic-circuit':30},construction,loopControl:[loop],status:'candidate-native-validation-pending'};Object.assign(m,await qualification(out,m));
const manifest=JSON.parse(await fs.readFile(out+'/manifest.json'));const updated=[m,...manifest.filter(m=>m.id==='science-fast-loop'),...manifest.filter(m=>![id,'science-fast-loop'].includes(m.id))];await fs.writeFile(out+'/manifest.json',JSON.stringify(updated,null,2)+'\n');
const book={blueprint_book:{item:'blueprint-book',version:bp.version,label:'Early Flight · Raw feeder and three controlled loops',active_index:0,blueprints:[]}};for(const m of updated)book.blueprint_book.blueprints.push({index:book.blueprint_book.blueprints.length,blueprint:decodeBlueprint(await fs.readFile(out+'/'+m.file,'utf8')).blueprint});await fs.writeFile(out+'/controlled-loops-book.txt',encodeBlueprint(book)+'\n');
console.log(JSON.stringify({id,footprint:m.footprint,construction},null,2));

const scienceBook={blueprint_book:{item:'blueprint-book',version:bp.version,label:'Red + green science upgrade · 30/min · Ore feeder + science loop',active_index:0,blueprints:[]}};for(const m of updated.filter(m=>['science-ore-feeder','science-fast-loop'].includes(m.id)))scienceBook.blueprint_book.blueprints.push({index:scienceBook.blueprint_book.blueprints.length,blueprint:decodeBlueprint(await fs.readFile(out+'/'+m.file,'utf8')).blueprint});await fs.writeFile(out+'/fast-red-green-book.txt',encodeBlueprint(scienceBook)+'\n');
