import fs from 'node:fs/promises';
import path from 'node:path';
import {decodeBlueprint} from '../../blueprints.mjs';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const source=path.join(root,'blueprint-sources/flight-science-sided/compact');
const out=path.join(root,'site/flight-science-sided/compact');
await fs.mkdir(out,{recursive:true});
const [m]=JSON.parse(await fs.readFile(path.join(source,'manifest.json')));
const code=(await fs.readFile(path.join(source,m.file),'utf8')).trim();
const {blueprint}=decodeBlueprint(code);
const report=JSON.parse(await fs.readFile(path.join(source,'native-report.json')));
const native=report.builds.find(b=>b.id===m.id&&b.blueprintSha256===m.blueprintSha256);
const verified=Boolean(native?.passed&&!report.short&&report.warmupMinutes===15&&report.measurementMinutes===30);
const catalogue=JSON.parse(await fs.readFile(path.join(root,'site/data/catalog.json')));
const icons=new Map(catalogue.items.map(item=>[item.id,item.icon]));
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const images=new Map();
async function icon(name){
 if(!images.has(name))images.set(name,icons.get(name)?'data:image/png;base64,'+(await fs.readFile(path.join(root,'site',icons.get(name)))).toString('base64'):'');
 return images.get(name);
}
const shapes=[];
for(const e of blueprint.entities){
 const size=e.recipe?3:e.name==='big-electric-pole'?2:1;
 const color=e.recipe?'#bb8640':e.name.includes('inserter')?'#44b6ed':e.name.includes('pole')?'#c9a774':e.name.includes('chest')?'#67c08c':e.name==='display-panel'?'#74d4d2':e.name.includes('underground')?'#8d4055':'#824f49';
 shapes.push(`<g><title>${esc(e.recipe||e.name)} · (${e.position.x}, ${e.position.y})</title><rect x="${e.position.x-size/2}" y="${e.position.y-size/2}" width="${size}" height="${size}" rx=".08" fill="${color}" stroke="#12202c" stroke-width=".08"/>`);
 if(e.name.includes('belt')||e.name.includes('inserter'))shapes.push(`<path d="M-.22 .16L0 -.2L.22 .16" transform="translate(${e.position.x} ${e.position.y}) rotate(${(e.direction||0)*22.5+(e.name.includes('inserter')?180:0)})" fill="none" stroke="#f2e8cc" stroke-width=".09"/>`);
 const src=await icon(e.recipe||e.icon?.name);
 if(src)shapes.push(`<image href="${src}" x="${e.position.x-size*.38}" y="${e.position.y-size*.38}" width="${size*.76}" height="${size*.76}"/>`);
 shapes.push('</g>');
}
for(const [i,p]of m.ports.entries())shapes.push(`<circle cx="${p.x}" cy="${p.y}" r=".7" fill="${p.kind==='output'?'#67c08c':'#94d9ff'}" stroke="#12202c" stroke-width=".1"/><text x="${p.x}" y="${p.y+.22}" text-anchor="middle" font-size=".6" font-family="sans-serif" font-weight="bold" fill="#12202c">${i+1}</text>`);
const {left,top,width,height}=m.footprint;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${(width+4)*16}" height="${(height+4)*16}" viewBox="${left-2} ${top-2} ${width+4} ${height+4}"><rect x="${left-2}" y="${top-2}" width="${width+4}" height="${height+4}" fill="#172733"/>${shapes.join('')}</svg>`;
await fs.writeFile(path.join(out,m.id+'.svg'),svg);
for(const file of [m.file,'manifest.json','native-report.json'])await fs.copyFile(path.join(source,file),path.join(out,file));
const colours={'automation-science-pack':'Red','logistic-science-pack':'Green','military-science-pack':'Black','chemical-science-pack':'Blue','production-science-pack':'Purple','utility-science-pack':'Yellow'};
const outputRows=m.products.map(item=>`<tr><td>${colours[item]}</td><td>60</td><td>${native?.outputsPerMinute[item]?.toFixed(2)??'—'}</td><td>${native?.recovery?.outputsPerMinute[item]?.toFixed(2)??'—'}</td></tr>`).join('');
const inputRows=Object.entries(m.inputsPerMinute).map(([name,rate])=>`<tr><td>${esc(name)}</td><td>${rate}</td></tr>`).join('');
const ports=m.ports.map((p,i)=>`<li><b>${i+1}.</b> ${esc(p.label)} — ${p.kind==='input'?'feed from left':p.kind==='output'?'collect on right':'connect electricity'} (${p.x}, ${p.y})${p.perMinute?`, ${p.perMinute}/min`:''}</li>`).join('');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Compact six-pack science · 60/min</title><style>body{margin:0;background:#101b24;color:#e4edf2;font:16px/1.5 system-ui}main{max-width:1200px;margin:auto;padding:24px}h1,h2{line-height:1.2}a{color:#86d7ff}.eyebrow{color:#80cdbc;letter-spacing:.08em;font-size:13px;text-transform:uppercase}.lead{max-width:850px}.status{padding:14px 18px;border:1px solid #4e806e;background:#18322d;border-radius:8px}.map{max-height:75vh;overflow:auto;margin-top:20px;border:1px solid #395767}.map img{display:block;max-width:100%;height:auto;margin:auto}.map.detail img{max-width:none;width:1664px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:32px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px 12px 8px 0;border-bottom:1px solid #294451}li{margin:7px 0;list-style:none}ol{padding:0}textarea{box-sizing:border-box;width:100%;height:90px;background:#172733;color:#dcecf3}button{background:#234457;color:#e4edf2;border:1px solid #56788a;border-radius:5px;padding:8px 14px;cursor:pointer}details{margin:16px 0}code{overflow-wrap:anywhere;font-size:12px}section{margin-top:24px}@media(max-width:700px){main{padding:16px}.columns{grid-template-columns:1fr}table{font-size:14px}}</style><main><p class="eyebrow">Factorio 2.1.24 · Flight-save recipes</p><h1>Compact six-pack science</h1><p class="lead">Red, green, black, blue, purple and yellow science at 60/min each. All material inputs enter from the left. All six science collection chests are on the right.</p><p>${width} × ${height} tiles · ${width*height} tiles² · ${Object.values(m.machineCounts).reduce((a,b)=>a+b,0)} assembling machine 2s · fast inserters · red belts</p><p class="status">${verified?'Native verified: all six packs passed sustained production and recovery after a collection pause.':'Candidate: complete native validation has not passed for this exact blueprint.'}</p><p><a href="${m.file}" download>Download blueprint string</a> · <a href="${m.id}.svg">Full-size layout</a> · <a href="native-report.json">Exact-hash evidence</a></p><details><summary>Copy import string</summary><textarea readonly aria-label="Blueprint import string">${code}</textarea></details><p><button data-view="fit">Fit layout</button> <button data-view="detail">Tile detail</button></p><div class="map"><img src="${m.id}.svg" alt="Exact six-pack blueprint entities with numbered input and output ports"></div><p>The schematic is generated from the saved blueprint. Numbers match the port legend below. Keep all red wires and stock controls when importing.</p><section><h2>Measured output</h2><table><thead><tr><th>Science</th><th>Target/min</th><th>Steady/min</th><th>Recovery/min</th></tr></thead><tbody>${outputRows}</tbody></table><p>Native test: empty start, 15 minutes warmup and 30 minutes simultaneous collection. Recovery: five minutes with collection paused, two minutes settling, then three minutes measured. Only declared boundary belts receive materials.</p></section><div class="columns"><section><h2>External ingredients</h2><p>Finished green/red circuits, engines and five heavy ingredients are supplied from upstream factories. This footprint excludes those factories. Productivity modules enter as purple-science ingredients; no modules are installed in machines.</p><table><thead><tr><th>Material</th><th>Items/min</th></tr></thead><tbody>${inputRows}</tbody></table><p>These are recipe rates at exactly 60/min per pack. Supply extra for startup and for the higher measured production rates. Iron and steel each have two separately labeled entrances. No oil, water, robots or quality bonuses.</p></section><section><h2>Port legend</h2><ol>${ports}</ol></section></div><section><h2>Design and evidence</h2><p>Original local layout derived from the project four-pack sided generator, with separate purple/yellow and rail-production loops. The coal and rail routes keep high-volume ingredients away from the other science inputs. This is a compact validated design; no global minimum footprint is claimed.</p><p>Blueprint SHA-256: <code>${m.blueprintSha256}</code></p><p><a href="manifest.json">Manifest and exact connection coordinates</a> · <a href="../index.html">Science tier overview</a></p></section></main><script>document.addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)document.querySelector('.map').classList.toggle('detail',button.dataset.view==='detail');});</script></html>`;
await fs.writeFile(path.join(out,'index.html'),html);
console.log(path.join(out,'index.html'));
