// Placement helpers shared by the oil-products candidates: collision-checked entities on a tile grid, an ASCII
// render, and the fluid check from fluids.mjs. Coordinates are tile corners (x, y); a w x h entity at (x, y) covers
// x..x+w-1, y..y+h-1. Sizes come from SIZE in shared.mjs (checked against the prototype dump by the test).
import assert from 'node:assert/strict';
import {fluidNetworks,tilesOf} from './fluids.mjs';
import {SIZE} from './shared.mjs';
export const N=0,E=4,S=8,W=12;
const size=name=>{assert(SIZE[name],'no size for '+name);return SIZE[name];};
export function makeLayout(){
 const L={entities:[],wires:[],occupied:new Map(),next:1,size};
 const key=(x,y)=>x+','+y;
 L.at=(x,y)=>L.occupied.get(key(x,y));
 L.place=(name,x,y,extra={})=>{ // x,y = top-left tile
  const [w0,h0]=size(name);let w=w0,h=h0;if([E,W].includes(extra.direction))[w,h]=[h,w];
  const e={entity_number:L.next++,name,position:{x:x+w/2,y:y+h/2},...extra};
  if(!e.direction)delete e.direction;
  for(const t of tilesOf(e,size)){assert(!L.occupied.has(key(t.x,t.y)),`collision: ${name} at ${t.x},${t.y} with ${L.occupied.get(key(t.x,t.y))?.name}`);L.occupied.set(key(t.x,t.y),e);}
  L.entities.push(e);return e;
 };
 L.pipe=(x,y)=>L.place('pipe',x,y);
 L.ptg=(x,y,d)=>L.place('pipe-to-ground',x,y,{direction:d});
 L.bounds=()=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const k of L.occupied.keys()){const [x,y]=k.split(',').map(Number);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return {x0,y0,x1,y1,width:x1-x0+1,height:y1-y0+1};};
 L.check=()=>fluidNetworks(L.entities,size);
 L.ascii=()=>{const b=L.bounds();const rows=[];for(let y=b.y0;y<=b.y1;y++){let s=String(y-b.y0).padStart(3)+' ';for(let x=b.x0;x<=b.x1;x++){const e=L.at(x,y);s+=e?glyph(e):'.';}rows.push(s);}return rows.join('\n');};
 return L;
}
// One character per tile: R refinery, L/H light/heavy cracker, S sulfur, A acid, U lubricant, T tank, P pump,
// # substation, D display panel, = pipe, ^ > v < pipe-to-ground (side of its pipe connection), e/w/n/s belts,
// u/o underground belt in/out, f fast inserter.
export function glyph(e){
 const d=e.direction||0;
 switch(e.name){
  case 'pipe':return '=';
  case 'pipe-to-ground':return {0:'^',4:'>',8:'v',12:'<'}[d];
  case 'oil-refinery':return 'R';
  case 'chemical-plant':return {'light-oil-cracking':'L','heavy-oil-cracking':'H','sulfur':'S','sulfuric-acid':'A','lubricant':'U'}[e.recipe]||'C';
  case 'pump':return 'P';
  case 'storage-tank':return 'T';
  case 'substation':return '#';
  case 'fast-transport-belt':return {0:'n',4:'e',8:'s',12:'w'}[d];
  case 'fast-underground-belt':return e.type==='input'?'u':'o';
  case 'fast-inserter':return 'f';
  case 'display-panel':return 'D';
  default:return '?';
 }
}
