import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {makeRingBlock} from '../rgby-science/blocks.mjs';
import {snapshot} from '../rgby-science/snapshot.mjs';

/** AM2, no modules: 16 red-circuit assemblers and three rear-fed cable assemblers. */
export function makePurpleAdvanced(raw) {
 raw={...raw,container:{...raw.container,...raw['logistic-container']}};
 const c=makeRingBlock(raw,{
  id:'purple-advanced',balanced:true,
  top:['copper-cable','advanced-circuit','advanced-circuit','copper-cable','advanced-circuit','advanced-circuit','copper-cable'],
  inside:Array(6).fill('advanced-circuit'),bottom:Array(6).fill('advanced-circuit'),
  feeds:[{item:'electronic-circuit',arms:2,perMinute:240},{item:'plastic-bar',arms:2,perMinute:240}],
  products:['advanced-circuit'],
  limits:{'electronic-circuit':48,'plastic-bar':48,'copper-cable':104,'advanced-circuit':40}
 });
 // Baseline bulk unlock capacity (three), with no later research, clears the
 // output handoff above the single fast inserter's belt-pickup throughput.
 for(const e of c.entities)if(e.name==='fast-inserter'&&e.position.x===23.5&&[7.5,9.5].includes(e.position.y)){e.name='bulk-inserter';e.override_stack_size=3;}
 // As in makeAdvanced, keep copper plates off the controlled stock loop.
 // All three wire assemblers face a common dedicated rear copper belt.
 const unused=new Set(c.entities.filter(e=>e.name==='fast-inserter'&&e.position.y===-.5&&[2.5,11.5,20.5].includes(e.position.x)).map(e=>e.entity_number));
 c.entities=c.entities.filter(e=>!unused.has(e.entity_number));
 c.wires=c.wires.filter(w=>!unused.has(w[0])&&!unused.has(w[2]));
 let next=Math.max(...c.entities.map(e=>e.entity_number))+1;
 const add=(name,x,y,extra={})=>{
  const entity_number=next++;
  const e={entity_number,name,position:{x,y},...extra,tags:{flight_science_entity:entity_number}};
  c.entities.push(e);return e;
 };
 let copper;
 for(let x=-3;x<=21;x++){const e=add('fast-transport-belt',x+.5,-5.5,{direction:4});copper??=e;}
 for(const x of[3.5,12.5,21.5])add('fast-inserter',x,-4.5,{direction:0,override_stack_size:1,use_filters:true,filters:[{index:1,name:'copper-plate',quality:'normal',comparator:'='}]});
 c.ports.unshift({kind:'input',label:'copper-plate',item:'copper-plate',items:['copper-plate'],entity:copper.entity_number,x:copper.position.x,y:copper.position.y,position:{...copper.position},direction:4,externalSide:'west',perMinute:240});
 c.footprint={...c.footprint,top:-6,height:c.footprint.bottom+6};
 return c;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW,'utf8'));
 const result=await snapshot(raw,makePurpleAdvanced(raw),'blueprint-sources/five-science/components/advanced',{'advanced-circuit':110});
 console.log(JSON.stringify({id:result.id,sha256:result.blueprintSha256,footprint:result.footprint,ports:result.ports},null,2));
}
