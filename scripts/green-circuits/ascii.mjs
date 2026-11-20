// Print a tile map of a green-circuits candidate for review.
import fs from 'node:fs/promises';
import {decodeBlueprint} from '../blueprints.mjs';
const dir=process.argv[2]||'blueprint-sources/green-circuits';
const m=JSON.parse(await fs.readFile(dir+'/manifest.json'))[0];
const bp=decodeBlueprint((await fs.readFile(dir+'/'+m.file,'utf8')).trim()).blueprint;
const grid=new Map(),k=(x,y)=>x+','+y,arrow={0:'^',4:'>',8:'v',12:'<'};
for(const e of bp.entities){const x=Math.floor(e.position.x),y=Math.floor(e.position.y);
 if(e.name==='assembling-machine-2'){const c=e.recipe==='copper-cable'?'C':'E';for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)grid.set(k(Math.floor(e.position.x-.5)+dx,Math.floor(e.position.y-.5)+dy),c);}
 else if(e.name==='substation'){for(const dx of [-1,0])for(const dy of [-1,0])grid.set(k(e.position.x+dx,e.position.y+dy),'S');}
 else if(e.name==='fast-transport-belt')grid.set(k(x,y),arrow[e.direction||0]);
 else if(e.name==='fast-underground-belt')grid.set(k(x,y),e.type==='input'?'U':'u');
 else if(e.name==='bulk-inserter')grid.set(k(x,y),'b');
 else if(e.name==='fast-inserter')grid.set(k(x,y),'f');
 else if(e.name==='display-panel')grid.set(k(x,y),'D');
 else grid.set(k(x,y),'?');}
const f=m.footprint;for(let y=f.top;y<f.bottom;y++){let s=String(y).padStart(3)+' ';for(let x=f.left;x<f.right;x++)s+=(grid.get(k(x,y))||'.')+' ';console.log(s);}
console.log(m.footprint.width+'x'+m.footprint.height,'=',m.footprint.width*m.footprint.height);
