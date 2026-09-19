import fs from 'node:fs/promises';
import sharp from 'sharp';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const iconCache=new Map();
const iconPaths=fs.readFile('site/data/catalog.json','utf8').then(JSON.parse).then(c=>new Map([...c.items,...c.fluids].map(i=>[i.id,i.icon])));
async function recipeIcon(id){
 if(!iconCache.has(id))iconCache.set(id,iconPaths.then(paths=>{const file=paths.get(id);return file?fs.readFile('site/'+file).then(buffer=>'data:image/png;base64,'+buffer.toString('base64')):null;}));
 return iconCache.get(id);
}
export function blueprintFootprint(blueprint,production){
 const boxes=blueprint.entities.map(e=>{
  const size=production.entities[e.name]?.size||[[-.5,-.5],[.5,.5]];
  let w=Math.ceil(size[1][0]-size[0][0]),h=Math.ceil(size[1][1]-size[0][1]);
  if(e.name==='display-panel')w=h=1;
  if([4,12].includes(e.direction))[w,h]=[h,w];
  return {left:e.position.x-w/2,right:e.position.x+w/2,top:e.position.y-h/2,bottom:e.position.y+h/2};
 });
 return {width:Math.ceil(Math.max(...boxes.map(b=>b.right)))-Math.floor(Math.min(...boxes.map(b=>b.left))),height:Math.ceil(Math.max(...boxes.map(b=>b.bottom)))-Math.floor(Math.min(...boxes.map(b=>b.top)))};
}
export async function starterPreview(blueprint,info,production){
 const points=blueprint.entities.map(e=>{const d=production.entities[e.name],box=d?.size||[[-.4,-.4],[.4,.4]];let w=box[1][0]-box[0][0],h=box[1][1]-box[0][1];if([4,12].includes(e.direction))[w,h]=[h,w];return {...e,x:e.position.x-w/2,y:e.position.y-h/2,w,h,type:d?.type||''};});
 const minX=Math.min(...points.map(p=>p.x))-2,minY=Math.min(...points.map(p=>p.y))-2;
 const width=Math.max(...points.map(p=>p.x+p.w))-minX+2,height=Math.max(...points.map(p=>p.y+p.h))-minY+2;
 const labeled=Boolean(info.inputDisplays),areaWidth=labeled?650:900;
 const scale=Math.min(areaWidth/width,400/height),left=(labeled?280:30)+(areaWidth-width*scale)/2,top=90+(400-height*scale)/2;
 const xy=(x,y)=>[left+(x-minX)*scale,top+(y-minY)*scale];
 const colours=p=>p.name==='display-panel'?'#243e4b':/assembling|furnace|generator|boiler/.test(p.type)?'#e0a648':p.type==='electric-pole'?'#99a8d7':/pipe|pump/.test(p.type)?'#69b4cf':p.type==='container'?'#88b889':'#8b917a';
 const shapes=points.map(p=>{const[x,y]=xy(p.x,p.y);const[cx,cy]=xy(p.position.x,p.position.y);return `<rect x="${x}" y="${y}" width="${p.w*scale}" height="${p.h*scale}" rx="${Math.min(1.5,scale*.1)}" fill="${colours(p)}" stroke="#18221e" stroke-width=".7"/>${/transport-belt|inserter/.test(p.type)?`<path d="M -2 1.7 L 0 -2 L 2 1.7" transform="translate(${cx} ${cy}) rotate(${(p.direction||0)*22.5+(p.type==='inserter'?180:0)})" stroke="#1a241e" fill="none" stroke-width="1"/>`:''}`;}).join('');
 const poles=new Map(points.map(p=>[p.entity_number,p]));
 const wires=(blueprint.wires||[]).filter(w=>w[1]===5&&w[3]===5).map(w=>{const a=poles.get(w[0]),b=poles.get(w[2]);if(!a||!b)return '';const[x1,y1]=xy(a.position.x,a.position.y),[x2,y2]=xy(b.position.x,b.position.y);return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#bc914a" stroke-width=".6" opacity=".65"/>`;}).join('');
 const outputPorts=info.ports.filter(p=>['output','fluid-output'].includes(p.kind)),multipleOutputs=(info.workshop||info.scienceFactory)&&outputPorts.length>1;
 const markerRadius=p=>labeled&&!['output','fluid-output'].includes(p.kind)?Math.min(9,scale*.8):9;
 const markers=info.ports.map(p=>{const[x,y]=xy(p.x,p.y),r=markerRadius(p);const label=['output','fluid-output'].includes(p.kind)?(multipleOutputs?String(outputPorts.indexOf(p)+1):'O'):p.label.split(' · ')[0].replace('IN ','');return `<circle cx="${x}" cy="${y}" r="${r}" fill="${['output','fluid-output'].includes(p.kind)?'#88b889':'#81c3df'}" stroke="#17221b" stroke-width="1"/>${r>=6?`<text x="${x}" y="${y+r*.39}" text-anchor="middle" font-family="sans-serif" font-size="${r*1.11}" font-weight="bold" fill="#12251e">${esc(label)}</text>`:''}`;}).join('');
 const inputPorts=info.ports.filter(p=>!['output','fluid-output'].includes(p.kind));
 if(info.rawOnly)inputPorts.sort((a,b)=>a.y-b.y);
 const input=inputPorts.map(p=>p.label.replaceAll('-',' ')).join('  /  ')||'Place on the matching resource patch';
 const recipeIcons=[];
 for(const p of points){
  const recipe=production.recipes.find(r=>r.id===(p.recipe||p.tags?.production_recipe||p.tags?.mall_recipe));
  const id=p.name==='display-panel'?p.icon?.name:recipe?.results[0]?.id;
  if(!id)continue;
  const icon=await recipeIcon(id);if(!icon)continue;
  const [x,y]=xy(p.position.x,p.position.y),size=Math.min(38,Math.min(p.w,p.h)*scale*.72);
  recipeIcons.push(`<image href="${icon}" x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}"/>`);
 }
 const callouts=[];
 if(labeled)for(const [i,p]of inputPorts.entries()){
  const y=123+i*39,[px,py]=xy(p.x,p.y),end=px-markerRadius(p)-1,icon=await recipeIcon(p.kind==='power'?(poles.get(p.entity)?.name||'small-electric-pole'):p.items[0]);
  callouts.push(`<path d="M235 ${y} L${end-8} ${py} L${end} ${py}" fill="none" stroke="#81c3df" stroke-width="1" opacity=".6"/><path d="M${end-5} ${py-3}L${end} ${py}L${end-5} ${py+3}" fill="none" stroke="#81c3df"/><rect x="30" y="${y-16}" width="205" height="32" rx="5" fill="#22352f" stroke="#456270"/>${icon?`<image href="${icon}" x="39" y="${y-12}" width="24" height="24"/>`:''}<text x="72" y="${y+4}" fill="#d9e2d8" font-family="sans-serif" font-size="13">${esc(p.label)}</text>`);
 }
 const output=info.kind==='power'?'Electricity from connected small poles':info.kind==='routing'?'Items continue through the marked output belts':(info.products.length?info.products:[info.resource]).join(', ').replaceAll('-',' ');
 const lines=output.length>100?[output.slice(0,output.lastIndexOf(', ',100)),output.slice(output.lastIndexOf(', ',100)+2)]:[output];
 const outputLegend=multipleOutputs?outputPorts.map((p,i)=>`<text x="${30+(i%(outputPorts.length>3?2:3))*(outputPorts.length>3?450:310)}" y="${530+Math.floor(i/(outputPorts.length>3?2:3))*22}" fill="#b8d4ac" font-family="sans-serif" font-size="14">${i+1} · ${esc(p.items.join(', ').replaceAll('-',' '))}</text>`).join(''):null;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600"><rect width="960" height="600" fill="#17221e"/><text x="30" y="31" fill="#d9e2d8" font-family="sans-serif" font-size="19" font-weight="bold">${esc(info.name)}</text><text x="30" y="57" fill="#99c9dc" font-family="sans-serif" font-size="13">${esc(labeled?'Match each icon to its entrance. Connect belts and pipes from the left.':input)}</text>${shapes}${wires}${recipeIcons.join('')}${callouts.join('')}${markers}${outputLegend||`<text x="30" y="530" fill="#b8d4ac" font-family="sans-serif" font-size="14">O · ${esc(lines[0])}</text>${lines[1]?`<text x="55" y="551" fill="#b8d4ac" font-family="sans-serif" font-size="14">${esc(lines[1])}</text>`:''}`}<text x="30" y="582" fill="#a0aba1" font-family="sans-serif" font-size="12">${labeled?(info.loopControl?'INPUT DISPLAYS · Alt shows labels · keep circuit wires connected for belt stock control':'INPUT DISPLAYS · one tile above each entrance · Alt shows labels · optional until Circuit network'):'SCHEMATIC · saved positions and directions · blue entrances / green outputs · no robots'}</text></svg>`;
 const file='assets/blueprints/'+info.id+'.png';await fs.mkdir('site/assets/blueprints',{recursive:true});await sharp(Buffer.from(svg)).png().toFile('site/'+file);return file;
}
