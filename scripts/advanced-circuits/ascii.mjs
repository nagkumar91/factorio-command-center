// Print a tile map of an advanced-circuits candidate for review.
// C copper cable, E electronic circuit, R advanced circuit, S substation, f fast arm, l long-handed arm, b bulk arm,
// U/u underground entry/exit, D display panel, arrows are belts.
import fs from 'node:fs/promises';
import {decodeBlueprint} from '../blueprints.mjs';
const dir=process.argv[2]||'blueprint-sources/advanced-circuits';
const m=JSON.parse(await fs.readFile(dir+'/manifest.json'))[0];
const bp=decodeBlueprint((await fs.readFile(dir+'/'+m.file,'utf8')).trim()).blueprint;
const grid=new Map(),k=(x,y)=>x+','+y,arrow={0:'^',4:'>',8:'v',12:'<'},letter={'copper-cable':'C','electronic-circuit':'E','advanced-circuit':'R'};
for(const e of bp.entities){const x=Math.floor(e.position.x),y=Math.floor(e.position.y);
 if(e.name==='assembling-machine-2'){for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)grid.set(k(Math.floor(e.position.x-.5)+dx,Math.floor(e.position.y-.5)+dy),letter[e.recipe]||'?');}
 else if(e.name==='substation'){for(const dx of [-1,0])for(const dy of [-1,0])grid.set(k(e.position.x+dx,e.position.y+dy),'S');}
 else if(e.name==='fast-transport-belt')grid.set(k(x,y),arrow[e.direction||0]);
 else if(e.name==='fast-underground-belt')grid.set(k(x,y),e.type==='input'?'U':'u');
 else if(e.name==='bulk-inserter')grid.set(k(x,y),'b');
 else if(e.name==='fast-inserter')grid.set(k(x,y),'f');
 else if(e.name==='long-handed-inserter')grid.set(k(x,y),'l');
 else if(e.name==='display-panel')grid.set(k(x,y),'D');
 else grid.set(k(x,y),'?');}
const f=m.footprint;
console.log('    '+Array.from({length:f.width},(_,x)=>String(x%10)).join(''));
for(let y=f.top;y<f.bottom;y++){let s=String(y).padStart(3)+' ';for(let x=f.left;x<f.right;x++)s+=(grid.get(k(x,y))||'.');console.log(s);}
console.log(m.footprint.width+'x'+m.footprint.height,'=',m.footprint.width*m.footprint.height);
