import assert from'node:assert/strict';import {makeRingBlock}from'./blocks.mjs';
export function makeRedGreen(raw){return makeRingBlock(raw,{id:'red-green',top:Array(4).fill('automation-science-pack'),inside:Array(4).fill('logistic-science-pack'),bottom:['iron-gear-wheel','transport-belt','inserter'],feeds:[{item:'iron-plate',arms:2,perMinute:210},{item:'copper-plate',perMinute:36},{item:'electronic-circuit',perMinute:30}],products:['automation-science-pack','logistic-science-pack'],limits:{'iron-plate':40,'copper-plate':12,'electronic-circuit':16,'iron-gear-wheel':24,'transport-belt':12,inserter:8,'automation-science-pack':8,'logistic-science-pack':8}});}
export function makeBlue(raw){return makeRingBlock(raw,{id:'blue',top:Array(6).fill('chemical-science-pack'),inside:[...Array(2).fill('chemical-science-pack'),...Array(4).fill('engine-unit')],bottom:[...Array(3).fill('engine-unit'),'iron-gear-wheel','pipe'],feeds:[{item:'iron-plate',arms:2,perMinute:120},{item:'steel-plate',perMinute:30},{item:'advanced-circuit',perMinute:45},{item:'sulfur',perMinute:15}],products:['chemical-science-pack'],limits:{'iron-plate':40,'steel-plate':16,'advanced-circuit':24,sulfur:8,'iron-gear-wheel':16,pipe:24,'engine-unit':24,'chemical-science-pack':12}});}
export function makeAdvanced(raw){
 // Copper has a dedicated rear feed, keeping 180 plates/min off the stock loop.
 const c=makeRingBlock(raw,{id:'advanced',balanced:true,top:['copper-cable',...Array(4).fill('advanced-circuit')],inside:[...Array(4).fill('advanced-circuit'),'copper-cable'],bottom:Array(5).fill('advanced-circuit'),feeds:[{item:'electronic-circuit',arms:2,perMinute:180},{item:'plastic-bar',arms:2,perMinute:180}],products:['advanced-circuit'],limits:{'electronic-circuit':40,'plastic-bar':40,'copper-cable':80,'advanced-circuit':24}});
 const unused=new Set(c.entities.filter(e=>e.name==='fast-inserter'&&((e.position.y===-.5&&e.position.x===2.5)||(e.position.y===1.5&&e.position.x===14.5))).map(e=>e.entity_number));
 c.entities=c.entities.filter(e=>!unused.has(e.entity_number));c.wires=c.wires.filter(w=>!unused.has(w[0])&&!unused.has(w[2]));
 // The balancer tail of this ring is wired straight to the reader up to 21 tiles away. A blueprint build drops red
 // wires beyond the 9-tile reach (native probe, 21 November 2026), so those 14 belts went unread and the stock caps
 // undercounted. Chain each tail belt to the previous one instead (the first to its nearest read ring belt).
 // With the tail counted the red-circuit product cap is 24 (16 before): the tail used to hold about 8 unseen, and with
 // an exact count at 16 the 30-lab import measured 29.58 units/min against 29.65 at 24.
 {const byId=new Map(c.entities.map(e=>[e.entity_number,e])),reader=c.loopControl[0].reader,ring=c.loopControl[0].loop,dist=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);
  const tail=new Set(c.wires.filter(w=>w[2]===reader&&ring.includes(w[0])&&dist(byId.get(w[0]),byId.get(reader))>9).map(w=>w[0])),read=ring.filter(id=>!tail.has(id)).map(id=>byId.get(id));
  for(const w of c.wires)if(w[2]===reader&&tail.has(w[0])){const e=byId.get(w[0]),near=read.reduce((a,b)=>dist(e,b)<dist(e,a)?b:a);assert(dist(e,near)<=9,'tail belt out of wire reach');w[2]=near.entity_number;read.unshift(e);}}
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
