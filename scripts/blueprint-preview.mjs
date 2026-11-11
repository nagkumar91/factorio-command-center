import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textLines=(text,length=34)=>{
 const lines=[];
 for(const line of String(text).split('\n')){
  const words=line.split(/\s+/).flatMap(word=>word.match(new RegExp('.{1,'+length+'}','gu'))||[]);let current='';
  for(const word of words){if((current+' '+word).trim().length>length&&current){lines.push(current);current='';}current+=(current?' ':'')+word;}
  if(current)lines.push(current);
 }
 return lines.length?lines:['Display panel'];
};
async function loadIcons(icons){
 if(icons)return icons;
 try{const catalog=JSON.parse(await fs.readFile('site/data/catalog.json','utf8'));return Object.fromEntries([...catalog.items,...catalog.fluids].map(item=>[item.id,item.icon]));}catch{return {};}
}
async function embedIcon(file){
 if(typeof file!=='string'||!file||path.isAbsolute(file)||file.split(/[\\/]/).some(p=>p==='..')||!/^assets\/.+\.png$/i.test(file))return null;
 try{return 'data:image/png;base64,'+(await fs.readFile(path.join('site',file))).toString('base64');}catch{return null;}
}
// Dense repaired factories have many local feed and waste displays. Their map
// keeps its own height; a four-column legend follows below instead of centering
// the map beside a several-thousand-pixel column of labels.
function denseBlueprintSvg(points,panels,labels,{x,y,w,h}){
 const width=1440,padding=28,gap=20,columns=4,mapTop=58;
 const scale=Math.min((width-padding*2)/w,900/h),mapHeight=h*scale;
 const left=padding+(width-padding*2-w*scale)/2;
 const xy=(px,py)=>[left+(px-x)*scale,mapTop+(py-y)*scale];
 const colour=p=>/^WASTE\b/.test(p.text||'')?'#e4af92':/^STARTUP\b/.test(p.text||'')?'#e9c779':'#a8dae3';
 const offsets=[],radius=Math.ceil(Math.sqrt(panels.length))+8;
 for(let row=-radius;row<=radius;row++)for(let col=-radius;col<=radius;col++)offsets.push({x:col*23,y:row*23,distance:row*row+col*col});
 offsets.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
 const markers=[];
 for(const p of panels){
  const[cx,cy]=xy(p.position.x,p.position.y);
  const candidate=offsets.map(o=>({x:cx+14+o.x,y:cy-14+o.y})).find(m=>m.x>=padding+10&&m.x<=width-padding-10&&m.y>=mapTop+4&&m.y<=mapTop+mapHeight+16&&markers.every(old=>Math.hypot(m.x-old.x,m.y-old.y)>=21));
  if(!candidate)throw Error('Cannot place readable display callouts for this dense layout');
  markers.push(candidate);
 }
 const shapes=points.map(p=>{
  const[px,py]=xy(p.x,p.y),panel=p.name==='display-panel';
  return `<rect x="${px}" y="${py}" width="${p.w*scale}" height="${p.h*scale}" fill="${panel?'#234653':p.fill}" stroke="${panel?colour(p):'#17272e'}" stroke-width="${panel?1.4:.7}"/>`;
 }).join('');
 const callouts=labels.map((label,i)=>{
  const p=label.panel,[cx,cy]=xy(p.position.x,p.position.y),marker=markers[i],size=Math.min(24,scale*.8);
  return `<g data-display-entity="${esc(p.entity_number)}" data-display-number="${label.index}"><title>${esc(p.text||p.icon?.name)}</title><path data-panel-anchor="${esc(p.entity_number)}" d="M${marker.x} ${marker.y}L${cx} ${cy}" stroke="${colour(p)}" stroke-width="1" opacity=".85"/>${label.icon?`<image href="${label.icon}" x="${cx-size/2}" y="${cy-size/2}" width="${size}" height="${size}"/>`:''}<circle cx="${marker.x}" cy="${marker.y}" r="9" fill="${colour(p)}"/><text x="${marker.x}" y="${marker.y+4}" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#142a34">${label.index}</text></g>`;
 }).join('');
 const cells=labels.map(label=>{
  const signal=label.panel.icon?.name||'';
  const signalAlreadyNamed=label.lines.join(' ').replaceAll('-',' ').toLowerCase().includes(signal.replaceAll('-',' ').toLowerCase());
  const signalLines=signal&&!signalAlreadyNamed?label.signal:[];
  return {...label,signalLines,height:Math.max(52,20+label.lines.length*17+signalLines.length*14)};
 });
 const legendTop=mapTop+Math.ceil(mapHeight)+44,cellWidth=(width-padding*2-gap*(columns-1))/columns;
 let rowY=legendTop+34;
 const legend=[];
 for(let start=0;start<cells.length;start+=columns){
  const row=cells.slice(start,start+columns),rowHeight=Math.max(...row.map(c=>c.height));
  for(const [column,cell]of row.entries()){
   const cellX=padding+column*(cellWidth+gap),textX=cellX+68;
   legend.push(`<g data-display-label="${esc(cell.panel.entity_number)}" data-display-number="${cell.index}"><rect x="${cellX}" y="${rowY}" width="${cellWidth}" height="${rowHeight}" rx="4" fill="#1b3039" stroke="#31505c"/><circle cx="${cellX+16}" cy="${rowY+20}" r="10" fill="${colour(cell.panel)}"/><text x="${cellX+16}" y="${rowY+24}" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#142a34">${cell.index}</text>${cell.icon?`<image href="${cell.icon}" x="${cellX+34}" y="${rowY+7}" width="26" height="26"/>`:''}<text x="${textX}" y="${rowY+20}" font-family="sans-serif" font-size="12" fill="#e1f1f2">${cell.lines.map((line,i)=>`<tspan x="${textX}" dy="${i?17:0}">${esc(line)}</tspan>`).join('')}</text>${cell.signalLines.length?`<text x="${textX}" y="${rowY+21+cell.lines.length*17}" font-family="sans-serif" font-size="11" fill="#9dbdc7">${cell.signalLines.map((line,i)=>`<tspan x="${textX}" dy="${i?14:0}">${esc(line)}</tspan>`).join('')}</text>`:''}</g>`);
  }
  rowY+=rowHeight+10;
 }
 const height=Math.ceil(rowY+padding-10);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-display-layout="dense"><rect width="${width}" height="${height}" fill="#17272e"/><text x="${padding}" y="27" font-family="sans-serif" font-size="15" fill="#c7e0e5">SAVED BLUEPRINT · numbered callouts point to the actual display positions</text><g data-dense-map="true">${shapes}${callouts}</g><path d="M${padding} ${legendTop-18}H${width-padding}" stroke="#36535f"/><text x="${padding}" y="${legendTop+9}" font-family="sans-serif" font-size="15" font-weight="bold" fill="#a8dae3">DISPLAY PANEL LABELS · ${panels.length} displays · feeds, startup and waste</text><g data-dense-legend="true">${legend.join('')}</g></svg>`;
}
/** Pure SVG output enables inspecting panel labels without writing public assets.
 * Pass modded icon paths in options.icons; unknown signals keep their text label.
 */
export async function blueprintPreviewSvg(b,production,{icons}={}){
 const points=(b.entities||[]).filter(e=>Number.isFinite(e.position?.x)&&Number.isFinite(e.position?.y)).map(e=>{const def=production.entities?.[e.name],box=def?.size||[[-.4,-.4],[.4,.4]];let w=box[1][0]-box[0][0],h=box[1][1]-box[0][1];if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];const type=def?.type||'';return{...e,x:e.position.x-w/2,y:e.position.y-h/2,w,h,fill:/assembling|furnace|reactor|generator|boiler/.test(type)?'#efb15d':/pipe|pump|tank/.test(type)?'#6bbad0':/container|roboport/.test(type)?'#9ac97b':/solar|accumulator|electric-pole/.test(type)?'#788fc4':'#687a82'};});
 if(!points.length)return null;
 const x=Math.min(...points.map(p=>p.x))-2,y=Math.min(...points.map(p=>p.y))-2,w=Math.max(...points.map(p=>p.x+p.w))-x+2,h=Math.max(...points.map(p=>p.y+p.h))-y+2;
 const panels=points.filter(p=>p.name==='display-panel');
 // Preserve the established thumbnail for layouts without display panels.
 if(!panels.length)return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#17272e"/>${points.map(p=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}" stroke="#17272e" stroke-width=".12"/>`).join('')}</svg>`;
 const paths=await loadIcons(icons),iconCache=new Map();
 for(const p of panels)if(!iconCache.has(p.icon?.name))iconCache.set(p.icon?.name,await embedIcon(paths[p.icon?.name]));
 const labels=panels.map((p,i)=>{
  const text=(p.text||p.icon?.name||'Display panel').replace(/\[(?:item|fluid|virtual-signal)=([^\]]+)\]/g,(_,id)=>id.replaceAll('-',' '));
  return{panel:p,index:i+1,lines:textLines(text),signal:textLines(p.icon?.name||'No signal icon',36),icon:iconCache.get(p.icon?.name)};
 });
 if(panels.length>12)return denseBlueprintSvg(points,panels,labels,{x,y,w,h});
 const canvasHeight=Math.max(480,100+labels.reduce((sum,label)=>sum+Math.max(76,label.lines.length*17+label.signal.length*14+36),0));
 const scale=Math.min(590/w,(canvasHeight-80)/h),left=22+(590-w*scale)/2,top=45+(canvasHeight-80-h*scale)/2;
 const xy=(px,py)=>[left+(px-x)*scale,top+(py-y)*scale];
 const markers=[];
 for(const panel of panels){
  const[cx,cy]=xy(panel.position.x,panel.position.y),size=Math.max(8,scale*.8);
  let mx=Math.max(32,Math.min(598,cx+size/2+3)),my=Math.max(45,cy-size/2-8);
  while(markers.some(m=>Math.abs(mx-m.x)<18&&Math.abs(my-m.y)<18)){mx+=18;if(mx>598){mx=32;my+=18;}}
  markers.push({x:mx,y:my});
 }
 const shapes=points.map(p=>{
  const [px,py]=xy(p.x,p.y),panel=p.name==='display-panel',icon=iconCache.get(p.icon?.name),index=panels.indexOf(p)+1;
  const size=Math.max(8,scale*.8),[cx,cy]=xy(p.position.x,p.position.y),marker=markers[index-1];
  return `<g${panel?` data-display-entity="${esc(p.entity_number)}"`:''}><title>${esc(panel?p.text||p.icon?.name:p.name)}</title>${panel?`<path d="M${marker.x} ${marker.y+7}L${cx} ${cy}" stroke="#a8dae3" stroke-width=".7" opacity=".8"/>`:''}<rect x="${px}" y="${py}" width="${p.w*scale}" height="${p.h*scale}" fill="${panel?'#234653':p.fill}" stroke="${panel?'#b4e7ed':'#17272e'}" stroke-width="${panel?1.4:.7}"/>${panel?`${icon?`<image href="${icon}" x="${cx-size/2}" y="${cy-size/2}" width="${size}" height="${size}"/>`:''}<circle cx="${marker.x}" cy="${marker.y}" r="7" fill="#a8dae3"/><text x="${marker.x}" y="${marker.y+3}" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="#142a34">${index}</text>`:''}</g>`;
 }).join('');
 let offset=58;
 const legend=labels.map(label=>{
  const y=offset;offset+=Math.max(76,label.lines.length*17+label.signal.length*14+36);
  return `<g data-display-label="${esc(label.panel.entity_number)}"><circle cx="647" cy="${y+9}" r="10" fill="#a8dae3"/><text x="647" y="${y+13}" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#142a34">${label.index}</text>${label.icon?`<image href="${label.icon}" x="665" y="${y-4}" width="26" height="26"/>`:''}<text x="${label.icon?699:665}" y="${y+5}" font-family="sans-serif" font-size="11" fill="#9dbdc7">${label.signal.map((line,i)=>`<tspan x="${label.icon?699:665}" dy="${i?14:0}">${esc(line)}</tspan>`).join('')}</text><text x="665" y="${y+27+label.signal.length*14}" font-family="sans-serif" font-size="12" fill="#e1f1f2">${label.lines.map((line,i)=>`<tspan x="665" dy="${i?17:0}">${esc(line)}</tspan>`).join('')}</text></g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${canvasHeight}" viewBox="0 0 960 ${canvasHeight}"><rect width="960" height="${canvasHeight}" fill="#17272e"/><text x="22" y="25" font-family="sans-serif" font-size="13" fill="#c7e0e5">SAVED BLUEPRINT · display panels marked at their actual positions</text>${shapes}<path d="M620 42V${canvasHeight-22}" stroke="#36535f"/><text x="636" y="29" font-family="sans-serif" font-size="13" font-weight="bold" fill="#a8dae3">DISPLAY PANEL LABELS</text>${legend}</svg>`;
}
export async function blueprintPreview(b,id,production,options){
 if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Invalid blueprint preview id');
 const svg=await blueprintPreviewSvg(b,production,options);if(!svg)return null;
 await fs.mkdir('site/assets/blueprints',{recursive:true});const file=`assets/blueprints/${id}.png`;await sharp(Buffer.from(svg)).png().toFile('site/'+file);return file;
}
