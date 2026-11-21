// Plain-text map of a rocket-supplies string: node scripts/rocket-supplies/ascii.mjs [source folder]
import fs from 'node:fs/promises';
import {decodeBlueprint} from '../blueprints.mjs';
const dir=process.argv[2]||'blueprint-sources/rocket-supplies';
const code=(await fs.readFile(dir+'/rocket-supplies.txt','utf8')).trim();
const es=decodeBlueprint(code).blueprint.entities;
const size={'assembling-machine-2':[3,3],substation:[2,2],'decider-combinator':[1,2]};
const arrow={0:'^',4:'>',8:'v',12:'<'};
const grid=new Map();
for(const e of es){
 const[w,h]=size[e.name]||[1,1];
 const x0=Math.round(e.position.x-w/2),y0=Math.round(e.position.y-h/2);
 for(let x=x0;x<x0+w;x++)for(let y=y0;y<y0+h;y++){
  let c='?';
  if(e.name==='assembling-machine-2')c={'processing-unit':'P','advanced-circuit':'A','copper-cable':'C','low-density-structure':'L'}[e.recipe];
  else if(e.name==='substation')c='#';
  else if(e.name==='fast-transport-belt')c=e.control_behavior?.circuit_enabled?'G':arrow[e.direction||0];
  else if(e.name==='fast-underground-belt')c=e.type==='input'?'u':'U';
  else if(e.name==='fast-inserter')c=e.control_behavior?.circuit_enabled?'i':'I';
  else if(e.name==='pipe')c='=';
  else if(e.name==='pipe-to-ground')c='o';
  else if(e.name==='passive-provider-chest')c='B';
  else if(e.name==='display-panel')c='d';
  else if(e.name==='decider-combinator')c=e.control_behavior?.decider_conditions?.conditions?.length>1?'E':'T';
  grid.set(x+','+y,c);
 }
}
const xs=[...grid.keys()].map(k=>+k.split(',')[0]),ys=[...grid.keys()].map(k=>+k.split(',')[1]);
for(let y=Math.min(...ys);y<=Math.max(...ys);y++){let s=String(y).padStart(2)+' ';for(let x=Math.min(...xs);x<=Math.max(...xs);x++)s+=grid.get(x+','+y)||'.';console.log(s);}
