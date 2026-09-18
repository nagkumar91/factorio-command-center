import fs from 'node:fs/promises';
import sharp from 'sharp';
export async function blueprintPreview(b,id,production){
 const points=(b.entities||[]).map(e=>{const def=production.entities[e.name],box=def?.size||[[-.4,-.4],[.4,.4]];let w=box[1][0]-box[0][0],h=box[1][1]-box[0][1];if([4,12].includes(e.direction))[w,h]=[h,w];const type=def?.type||'';return{x:e.position.x-w/2,y:e.position.y-h/2,w,h,fill:/assembling|furnace|reactor|generator|boiler/.test(type)?'#efb15d':/pipe|pump|tank/.test(type)?'#6bbad0':/container|roboport/.test(type)?'#9ac97b':/solar|accumulator|electric-pole/.test(type)?'#788fc4':'#687a82'};});
 if(!points.length)return null;
 const x=Math.min(...points.map(p=>p.x))-2,y=Math.min(...points.map(p=>p.y))-2,w=Math.max(...points.map(p=>p.x+p.w))-x+2,h=Math.max(...points.map(p=>p.y+p.h))-y+2;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#17272e"/>${points.map(p=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}" stroke="#17272e" stroke-width=".12"/>`).join('')}</svg>`;
 await fs.mkdir('site/assets/blueprints',{recursive:true});const file=`assets/blueprints/${id}.png`;await sharp(Buffer.from(svg)).png().toFile('site/'+file);return file;
}
