// Print a tile map of each plastic-bars record in a folder: node scripts/plastic-bars/ascii.mjs [dir]
import fs from 'node:fs/promises';
import {decodeBlueprint} from '../blueprints.mjs';
const dir=process.argv[2]||'blueprint-sources/plastic-bars';
const arrow={0:'^',4:'>',8:'v',12:'<'};
for(const m of JSON.parse(await fs.readFile(dir+'/manifest.json'))){
 const bp=decodeBlueprint((await fs.readFile(dir+'/'+m.file,'utf8')).trim()).blueprint,grid=new Map(),k=(x,y)=>x+','+y;
 for(const e of bp.entities){const x=Math.floor(e.position.x),y=Math.floor(e.position.y);
  if(e.name==='chemical-plant'){for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)grid.set(k(x+dx,y+dy),'P');}
  else if(e.name==='substation'){for(const dx of [-1,0])for(const dy of [-1,0])grid.set(k(e.position.x+dx,e.position.y+dy),'S');}
  else if(e.name==='fast-splitter'){grid.set(k(x,Math.floor(e.position.y-.5)),'Z');grid.set(k(x,Math.floor(e.position.y+.5)),'Z');}
  else grid.set(k(x,y),{'fast-transport-belt':arrow[e.direction||0],'fast-underground-belt':e.type==='input'?'U':'u','bulk-inserter':'b','fast-inserter':'f','long-handed-inserter':'l','pipe':'=','pipe-to-ground':'o','display-panel':'D'}[e.name]||'?');}
 const f=m.footprint;console.log(`${m.id}  ${f.width} x ${f.height} = ${f.width*f.height} tiles`);
 for(let y=f.top;y<f.bottom;y++){let s=String(y).padStart(3)+' ';for(let x=f.left;x<f.right;x++)s+=(grid.get(k(x,y))||'.')+' ';console.log(s);}
}
