import assert from'node:assert/strict';import{FactoryLayout}from'../rgby-science/layout.mjs';
export class FiveLayout extends FactoryLayout{
 place(e){if(e.name!=='substation')return super.place(e);assert(Number.isInteger(e.position.x)&&Number.isInteger(e.position.y),'substation grid');for(let x=e.position.x-1;x<e.position.x+1;x++)for(let y=e.position.y-1;y<e.position.y+1;y++){const k=x+','+y;assert(!this.grid.has(k),'substation collision '+k);this.grid.set(k,e);}this.entities.push(e);}
}
export const isPole=e=>e.name.endsWith('electric-pole')||e.name==='substation';
