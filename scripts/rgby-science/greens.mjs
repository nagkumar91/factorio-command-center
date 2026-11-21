import fs from 'node:fs/promises';import {decodeBlueprint}from'../blueprints.mjs';import {starterBounds}from'../science-factory/local-ports/compact-shared-layout.mjs';
/** Reuse the delivered Luna360 recipe geometry, join its two raw-material lines,
 * and aggregate four circuit outputs under the iron inserters with undergrounds. */
export async function makeGreens(raw,id='greens'){
 const original=decodeBlueprint(await fs.readFile('blueprint-sources/recovered-workshops/history/return-belt-pair-bf4d6a63/luna-circuits-r7-360.txt','utf8')).blueprint;
 const entities=original.entities.filter(e=>!e.name.endsWith('electric-pole')&&e.name!=='display-panel').map(e=>({...structuredClone(e),...(e.name==='transport-belt'?{name:'fast-transport-belt'}:{})}));
 let next=Math.max(...entities.map(e=>e.entity_number))+1;const add=(name,x,y,extra={})=>{if(entities.some(e=>e.position.x===x+.5&&e.position.y===y+.5))throw Error('Green bridge overlap '+x+','+y);const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);return e;};
 for(const y of[0,13])for(const x of[11,12])add('fast-transport-belt',x,y,{direction:4});
 for(const x of[7,12,20,25])add('fast-inserter',x,11,{direction:0,override_stack_size:1});
 const underground=(x,type)=>add('fast-underground-belt',x,12,{direction:4,type});underground(7,'input');underground(11,'output');add('fast-transport-belt',12,12,{direction:4});add('fast-transport-belt',13,12,{direction:4});add('fast-transport-belt',14,12,{direction:4});underground(15,'input');underground(19,'output');underground(20,'input');underground(24,'output');for(const x of[25,26,27])add('fast-transport-belt',x,12,{direction:4});
 for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 const input=(item,id,rate)=>{const e=entities.find(e=>e.entity_number===id);return{kind:'input',item,items:[item],entity:id,x:e.position.x,y:e.position.y,position:e.position,direction:4,externalSide:'west',perMinute:rate};};const last=entities.at(-1);
 return{id,entities,wires:[],loopControl:[],machineCounts:{'copper-cable':6,'electronic-circuit':4},ports:[input('copper-plate',1,540),input('iron-plate',64,360),{kind:'output',item:'electronic-circuit',items:['electronic-circuit'],entity:last.entity_number,x:last.position.x,y:last.position.y,position:last.position,externalSide:'east',perMinute:360}],footprint:starterBounds(entities,raw),source:'Supervised Luna compact circuit trial, integrated with shared raw-input lines and underground output aggregation.'};
}
