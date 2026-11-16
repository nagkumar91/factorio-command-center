import {makeRingBlock}from'./blocks.mjs';
export function makeRedGreen(raw){return makeRingBlock(raw,{id:'red-green',top:Array(4).fill('automation-science-pack'),inside:Array(4).fill('logistic-science-pack'),bottom:['iron-gear-wheel','transport-belt','inserter'],feeds:[{item:'iron-plate',arms:2,perMinute:210},{item:'copper-plate',perMinute:36},{item:'electronic-circuit',perMinute:30}],products:['automation-science-pack','logistic-science-pack'],limits:{'iron-plate':40,'copper-plate':12,'electronic-circuit':16,'iron-gear-wheel':24,'transport-belt':12,inserter:8,'automation-science-pack':8,'logistic-science-pack':8}});}
export function makeBlue(raw){return makeRingBlock(raw,{id:'blue',top:Array(6).fill('chemical-science-pack'),inside:[...Array(2).fill('chemical-science-pack'),...Array(4).fill('engine-unit')],bottom:[...Array(3).fill('engine-unit'),'iron-gear-wheel','pipe'],feeds:[{item:'iron-plate',arms:2,perMinute:120},{item:'steel-plate',perMinute:30},{item:'advanced-circuit',perMinute:45},{item:'sulfur',perMinute:15}],products:['chemical-science-pack'],limits:{'iron-plate':40,'steel-plate':16,'advanced-circuit':24,sulfur:8,'iron-gear-wheel':16,pipe:24,'engine-unit':24,'chemical-science-pack':12}});}
export function makeAdvanced(raw){
 // Copper has a dedicated rear feed, keeping 180 plates/min off the stock loop.
 const c=makeRingBlock(raw,{id:'advanced',balanced:true,top:['copper-cable',...Array(4).fill('advanced-circuit')],inside:[...Array(4).fill('advanced-circuit'),'copper-cable'],bottom:Array(5).fill('advanced-circuit'),feeds:[{item:'electronic-circuit',arms:2,perMinute:180},{item:'plastic-bar',arms:2,perMinute:180}],products:['advanced-circuit'],limits:{'electronic-circuit':40,'plastic-bar':40,'copper-cable':80,'advanced-circuit':16}});
 const unused=new Set(c.entities.filter(e=>e.name==='fast-inserter'&&((e.position.y===-.5&&e.position.x===2.5)||(e.position.y===1.5&&e.position.x===14.5))).map(e=>e.entity_number));
 c.entities=c.entities.filter(e=>!unused.has(e.entity_number));c.wires=c.wires.filter(w=>!unused.has(w[0])&&!unused.has(w[2]));
 let next=Math.max(...c.entities.map(e=>e.entity_number))+1;
 const add=(name,x,y,extra={})=>{const entity_number=next++,e={entity_number,name,position:{x,y},...extra,tags:{flight_science_entity:entity_number}};c.entities.push(e);return e;};
 let copper;
 for(let x=-3;x<=18;x++){const e=add('fast-transport-belt',x+.5,-5.5,{direction:x===18?8:4});copper??=e;}
 for(let y=-5;y<=-2;y++)add('fast-transport-belt',18.5,y+.5,{direction:8});
 add('fast-underground-belt',18.5,-.5,{direction:8,type:'input'});
 add('fast-underground-belt',18.5,2.5,{direction:8,type:'output'});
 add('fast-transport-belt',18.5,3.5,{direction:8});
 for(const[x,y,d]of[[3.5,-4.5,0],[17.5,3.5,4]])add('fast-inserter',x,y,{direction:d,override_stack_size:1,use_filters:true,filters:[{index:1,name:'copper-plate',quality:'normal',comparator:'='}]});
 c.ports.unshift({kind:'input',label:'copper-plate',item:'copper-plate',items:['copper-plate'],entity:copper.entity_number,x:copper.position.x,y:copper.position.y,position:{...copper.position},direction:4,externalSide:'west',perMinute:180});
 c.footprint={...c.footprint,top:-6,height:c.footprint.bottom+6};
 return c;
}
export function makeUtility(raw){return makeRingBlock(raw,{id:'utility',top:Array(2).fill('utility-science-pack'),inside:Array(2).fill('utility-science-pack'),bottom:['utility-science-pack'],feeds:[{item:'low-density-structure',perMinute:30},{item:'processing-unit',perMinute:20},{item:'flying-robot-frame',perMinute:10}],products:['utility-science-pack'],limits:{'low-density-structure':24,'processing-unit':16,'flying-robot-frame':12,'utility-science-pack':12}});}
