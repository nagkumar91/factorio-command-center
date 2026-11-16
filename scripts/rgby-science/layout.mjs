import assert from 'node:assert/strict';
import {Layout as Base} from '../flight-science-sided/hybrid/layout.mjs';
export class FactoryLayout extends Base{
 place(e){
  const type=e.name;let w=['assembling-machine-2','chemical-plant','electric-furnace','lab'].includes(type)?3:type==='big-electric-pole'?2:1,h=w;
  if(type==='fast-splitter'){w=[4,12].includes(e.direction)?1:2;h=[4,12].includes(e.direction)?2:1;}
  if(type==='arithmetic-combinator'){w=[4,12].includes(e.direction)?2:1;h=[4,12].includes(e.direction)?1:2;}
  for(let x=e.position.x-w/2;x<e.position.x+w/2;x++)for(let y=e.position.y-h/2;y<e.position.y+h/2;y++){assert(Number.isInteger(x)&&Number.isInteger(y),'grid parity '+type);const k=x+','+y;assert(!this.grid.has(k),`Collision ${type} at ${k} with ${this.grid.get(k)?.name}`);this.grid.set(k,e);}this.entities.push(e);
 }
 importComponent(c,left,top){
  const dx=left-c.footprint.left,dy=top-c.footprint.top,map=new Map();
  for(const old of c.entities.filter(e=>!e.name.endsWith('electric-pole')&&e.name!=='display-panel')){const e=structuredClone(old);map.set(old.entity_number,this.next);e.entity_number=this.next++;e.position.x+=dx;e.position.y+=dy;e.tags={...e.tags,flight_science_entity:e.entity_number,rgby_component:c.id,source_entity:old.entity_number};this.place(e);}
  for(const[a,ac,b,bc]of c.wires||[])if(map.has(a)&&map.has(b))this.wires.push([map.get(a),ac,map.get(b),bc]);
  const ports=c.ports.filter(p=>p.kind!=='power').map(p=>{const x=(p.x??p.position.x)+dx,y=(p.y??p.position.y)+dy;return{...structuredClone(p),item:p.item||p.items[0],items:p.items||[p.item],entity:map.get(p.entity),x,y,position:{x,y},component:c.id};});
  for(const old of c.loopControl||[]){const loop={...structuredClone(old),name:c.id+'/'+old.name,reader:map.get(old.reader),controlled:old.controlled.map(id=>map.get(id))};if(old.loop)loop.loop=old.loop.map(id=>map.get(id));this.loops.push(loop);}
  this.ports.push(...ports);return{...c,map,ports,translation:{x:dx,y:dy}};
 }
 outputBelt(p){const original=this.entities.find(e=>e.entity_number===p.entity);assert(original,p.component+' output missing');if(original.name.includes('belt'))return original;
  assert(original.name.includes('chest'),'Expected output chest');const x=Math.floor(p.x),y=Math.floor(p.y);this.add('fast-inserter',x+1,y,{direction:12,override_stack_size:1,use_filters:true,filters:[{index:1,name:p.item||p.items[0],quality:'normal',comparator:'='}]});return this.belt(x+2,y,4);
 }
}
