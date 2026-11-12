import fs from 'node:fs/promises';
import path from 'node:path';
import {decodeBlueprint} from '../blueprints.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const source=path.resolve(process.env.SCIENCE_SOURCE||path.join(root,'blueprint-sources/flight-science'));
const out=path.resolve(process.env.SCIENCE_PREVIEW_OUTPUT||path.join(root,'site/flight-science'));await fs.mkdir(out,{recursive:true});
const manifests=JSON.parse(await fs.readFile(path.join(source,'manifest.json')));
const catalog=JSON.parse(await fs.readFile(path.join(root,'site/data/catalog.json')));
const icons=new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.icon]));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const images=new Map();async function image(n){if(!images.has(n)){const f=icons.get(n);images.set(n,f?'data:image/png;base64,'+(await fs.readFile(path.join(root,'site',f))).toString('base64'):'');}return images.get(n);}
const reports=JSON.parse(await fs.readFile(path.join(source,'native-report.json')).catch(()=>Buffer.from('null')));
let history='';
try{await fs.mkdir(path.join(out,'history'),{recursive:true});await fs.copyFile(path.join(source,'history/v1-bus/flight-science-book.txt'),path.join(out,'history/v1-bus-book.txt'));history='<p>Previous version: <a href="history/v1-bus-book.txt" download>download the original bus-layout book</a> (140 × 85 and 181 × 91 tiles).</p>';}catch(error){if(error.code!=='ENOENT')throw error;}
const cards=[];
try{await fs.copyFile(path.join(source,'flight-science-book.txt'),path.join(out,'flight-science-book.txt'));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const m of manifests){
 const {blueprint:b}=decodeBlueprint((await fs.readFile(path.join(source,m.file),'utf8')).trim());
 const f=m.footprint,shapes=[];
 for(const e of b.entities){
  let w=1,h=1;if(e.name==='assembling-machine-2')w=h=3;
  if(e.name==='big-electric-pole')w=h=2;
  if(e.name==='fast-splitter'){w=[4,12].includes(e.direction)?1:2;h=[4,12].includes(e.direction)?2:1;}
  const x=e.position.x,y=e.position.y;
  const color=e.recipe?'#bb8640':e.name.includes('inserter')?'#44b6ed':e.name.includes('pole')?'#c9a774':e.name.includes('chest')?'#67c08c':e.name==='display-panel'?'#74d4d2':e.name.includes('underground')?'#8d4055':'#824f49';
  shapes.push(`<g><title>${esc(e.recipe||e.name)} · (${x}, ${y})</title><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx=".08" fill="${color}" stroke="#12202c" stroke-width=".08"/>`);
  if(e.name.includes('belt')||e.name.includes('splitter')||e.name.includes('inserter')){
   const angle=(e.direction||0)*22.5+(e.name.includes('inserter')?180:0);
   shapes.push(`<path d="M-.22 .16L0 -.2L.22 .16" transform="translate(${x} ${y}) rotate(${angle})" fill="none" stroke="#f2e8cc" stroke-width=".09"/>`);
  }
  const icon=await image(e.recipe||e.icon?.name);if(icon)shapes.push(`<image href="${icon}" x="${x-w*.38}" y="${y-h*.38}" width="${w*.76}" height="${h*.76}"/>`);
  shapes.push('</g>');
 }
 for(const [i,p] of m.ports.entries())shapes.push(`<circle cx="${p.x}" cy="${p.y}" r=".75" fill="${p.kind==='output'?'#67c08c':'#94d9ff'}" stroke="#12202c" stroke-width=".12"/><text x="${p.x}" y="${p.y+.25}" text-anchor="middle" font-size=".7" font-family="sans-serif" font-weight="bold" fill="#12202c">${i+1}</text>`);
 const byId=new Map(b.entities.map(e=>[e.entity_number,e]));
 const circuitWires=(b.wires||[]).filter(w=>w[1]===1&&w[3]===1).map(w=>{const a=byId.get(w[0]),z=byId.get(w[2]);return a&&z?`<path d="M${a.position.x} ${a.position.y}L${z.position.x} ${z.position.y}" stroke="#fb7971" stroke-width=".06" opacity=".5"/>`:'';}).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${(f.width+4)*16}" height="${(f.height+4)*16}" viewBox="${f.left-2} ${f.top-2} ${f.width+4} ${f.height+4}"><rect x="${f.left-2}" y="${f.top-2}" width="${f.width+4}" height="${f.height+4}" fill="#172733"/>${shapes.join('')}${circuitWires}</svg>`;
 await fs.writeFile(path.join(out,m.id+'.svg'),svg);
 await fs.copyFile(path.join(source,m.file),path.join(out,m.file));
 const code=(await fs.readFile(path.join(source,m.file),'utf8')).trim();
 const native=reports?.builds?.find(b=>b.id===m.id&&b.blueprintSha256===m.blueprintSha256);
 const verified=native?.passed&&!reports.short;
 const rows=m.inputs.map(p=>`<tr><td>${esc(p.item)}</td><td>${p.perMinute}</td><td>${esc(p.block||'Main')}</td></tr>`).join('');
 const legend=m.ports.map((p,i)=>`<li><b>${i+1}</b> ${esc(p.label)} — ${p.kind==='input'?'feed from '+(p.externalSide||'west'):p.kind==='output'?'collect from chest':'connect power'} (${p.x}, ${p.y})</li>`).join('');
 cards.push(`<article id="${m.id}"><h2>${esc(m.name)}</h2><p>${f.width} × ${f.height} tiles · ${f.width*f.height} tiles² · ${Object.values(m.machineCounts).reduce((a,b)=>a+b,0)} AM2s</p><p>${m.loopControl?'Circuit network research required. Keep the red wires and stock controls intact. Iron and copper have separate labeled entrances for each block.':''}</p><p class="status">${verified?'Native verified: '+Object.entries(native.outputsPerMinute).map(([n,r])=>n.replace('-science-pack','')+' '+r.toFixed(2)+'/min').join(' · '):'Candidate — native validation pending or failed. Do not treat the target as measured output.'}</p><a href="${m.file}" download>Download blueprint string</a> · <a href="${m.id}.svg" target="_blank">Open full-size rendering</a><details><summary>Copy import string</summary><textarea readonly aria-label="${m.id} import string">${code}</textarea></details><p><button data-view="fit">Fit whole layout</button> <button data-view="detail">Tile detail</button></p><div class="map"><img src="${m.id}.svg" alt="${esc(m.name)} entity layout with numbered input and output ports"></div><p>Schematic of exact saved entities. Belt arrows show travel; blue inserter arrows show delivery. Scroll the map to inspect it at tile level.</p><div class="columns"><section><h3>External inputs at 60/min each</h3><table><thead><tr><th>Material</th><th>Items/min</th><th>Block</th></tr></thead><tbody>${rows}</tbody></table><p>Rates exclude initial belt and machine inventory filling. Supply extra during startup. No oil or water.</p></section><section><h3>Port legend</h3><ol>${legend}</ol></section></div><details><summary>Machine counts and design comparison</summary><pre>${esc(JSON.stringify({machines:m.machineCounts,optimization:m.optimization},null,2))}</pre></details></article>`);
}
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Flight science · 60 packs per minute</title><style>body{margin:0;background:#101b24;color:#e4edf2;font:16px/1.5 system-ui}main{max-width:1400px;margin:auto;padding:24px}h1,h2{line-height:1.2}a{color:#86d7ff}article{border-top:1px solid #365363;margin-top:32px;padding-top:24px}.map{max-height:75vh;overflow:auto;margin-top:20px;border:1px solid #395767}.map img{display:block;max-width:100%;max-height:70vh;width:auto;height:auto;margin:auto}.map.detail img{max-width:none;max-height:none}button{background:#234457;color:#e4edf2;border:1px solid #56788a;border-radius:5px;padding:7px 12px;cursor:pointer}.columns{display:grid;grid-template-columns:1fr 1fr;gap:32px}td,th{text-align:left;padding:6px 24px 6px 0}li{margin:5px 0}textarea{width:100%;height:90px}pre{overflow:auto}.status{color:#f3cf85}@media(max-width:700px){main{padding:16px}.columns{grid-template-columns:1fr}}</style><main><h1>Flight science</h1><p>Factorio 2.1.24 · your flight-save recipes.</p><p>60 packs/minute of each colour, simultaneously. Finished-material inputs · AM2 · fast inserters · red belts · no modules or robots.</p><p><a href="flight-science-book.txt" download>Download both blueprints as one book</a></p><nav><a href="#rgb-60">Red, green and blue</a> · <a href="#rgb-military-60">With military science</a></nav>${cards.join('')}${history}${reports?`<details><summary>Native validation report</summary><pre>${esc(JSON.stringify(reports,null,2))}</pre></details>`:''}</main><script>document.addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)button.closest('article').querySelector('.map').classList.toggle('detail',button.dataset.view==='detail');});</script></html>`);
console.log(out+'/index.html');
