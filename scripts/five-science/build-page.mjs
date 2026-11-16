/** Portable guide generator. Writes site/five-science/. Optional FACTORIO_RAW
 * refreshes the small tracked preview-model.json; normal builds need no game install. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {decodeBlueprint} from '../blueprints.mjs';
import {blueprintPreviewSvg} from '../blueprint-preview.mjs';
import {renderFlightPlanPage} from '../flight-plan-shell.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sha = value => createHash('sha256').update(value).digest('hex');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const packs = [
  ['automation-science-pack','Red','Automation','#ff7970'],
  ['logistic-science-pack','Green','Logistic','#8cd877'],
  ['chemical-science-pack','Blue','Chemical','#70c5ff'],
  ['utility-science-pack','Yellow','Utility','#f5d965'],
  ['production-science-pack','Purple','Production','#cf9cff'],
];
const nominal = {'iron-plate':1350,'copper-plate':2370,'steel-plate':360,'plastic-bar':520,sulfur:15,'sulfuric-acid':500,lubricant:150,stone:150,'stone-brick':100};
const pretty = id => id.replaceAll('-', ' ').replace(/^./, c => c.toUpperCase());
async function optional(file) {try {return await fs.readFile(file);} catch(e) {if(e.code==='ENOENT') return null; throw e;}}
function safeFile(file) {if(typeof file!=='string'||!file||path.basename(file)!==file||!/^[\w.-]+$/.test(file))throw Error(`Unsafe blueprint filename: ${file}`);return file;}

/** Manifest status strings never grant a native production claim. */
export function exactNativeEvidence(manifest, code, report) {
  const actual = sha(code.trim());
  const cases = report?.builds ?? (report?.blueprintSha256 ? [report] : []);
  const matching = cases.filter(r => r.blueprintSha256 === actual && (!r.id || r.id === manifest.id));
  const candidate = matching.find(r => {
    if(r.passed !== true)return false;
    if(!packs.every(([id])=>manifest.products?.includes(id)))return false;
    if(!manifest.researchProbe)return packs.every(([id])=>Number.isFinite(r.outputsPerMinute?.[id]) && r.outputsPerMinute[id]>=(manifest.targets?.[id]??manifest.targetPerMinute??30)-.5);
    const p=r.researchProbe,expected=manifest.labCount??manifest.expectedLabCount??manifest.metadata?.labCount??manifest.construction?.lab;
    const target=Math.min(...Object.values(manifest.targets||{all:manifest.targetPerMinute||30}));
    return p && Number.isFinite(p.unitsPerMinute) && p.unitsPerMinute>=target-.5 &&
      p.labCount===expected && expected>0 && p.allActive===true && p.allPowered===true &&
      p.seconds===manifest.researchProbe.seconds &&
      (p.labSpeedModifier??0)===(manifest.researchProbe.labSpeedModifier??0);
  });
  const passed = manifest.blueprintSha256 === actual && report?.short !== true &&
    candidate !== undefined &&
    (!manifest.prototypeSha256 || report?.prototypeSha256 === manifest.prototypeSha256);
  return {passed, blueprintSha256: actual,
    reason: passed ? 'Passing native report matches this exact import.' :
      !report ? 'Native validation pending: no factory report supplied.' :
      !matching.length ? 'Native evidence does not match this import SHA-256.' :
      'Matching native evidence is failed, incomplete, or has a different prototype hash.',
    ...(passed ? {result:candidate} : {})};
}

/** Paired research consumes packs internally: zero exported packs is expected. */
export function nativeResultText(manifest, result) {
  if(manifest.researchProbe) {
    const p=result.researchProbe;
    return `Measured research: ${Number(p.unitsPerMinute).toFixed(2)} research units/min · ${p.labCount} connected labs · ${1+(p.labSpeedModifier??0)}× effective lab speed · ${p.seconds} seconds/unit · all labs active.`;
  }
  return 'Measured pack collection: '+Object.entries(result.outputsPerMinute||{})
    .map(([name,rate])=>pretty(name)+': '+Number(rate).toFixed(2)+'/min').join(' · ')+'.';
}

export async function buildPage() {
  const source = path.join(ROOT,'blueprint-sources/five-science'), out = path.join(ROOT,'site/five-science');
  const manifests = JSON.parse(await fs.readFile(path.join(source,'manifest.json')));
  if(!Array.isArray(manifests)||manifests.length!==3||['five-science-30','five-science-30-labs-15','five-science-30-labs-30'].some(id=>!manifests.some(m=>m.id===id)))throw Error('Five-science manifest must contain the three complete factory imports');
  const reportBytes = await optional(path.join(source,'native-report.json'));
  const report = reportBytes ? JSON.parse(reportBytes) : null;
  const catalog = JSON.parse(await fs.readFile(path.join(ROOT,'site/data/catalog.json')));
  const catalogIcons = new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.icon]));
  const inputs=[];
  for(const m of manifests) {
    safeFile(m.file);safeFile(m.id);
    const code=(await fs.readFile(path.join(source,m.file),'utf8')).trim();
    if(sha(code)!==m.blueprintSha256)throw Error(`Source changed: import SHA does not match ${m.id}; regenerate its manifest before the guide`);
    const blueprint=decodeBlueprint(code)?.blueprint;
    if(!blueprint?.entities?.length)throw Error(`Empty blueprint: ${m.id}`);
    inputs.push({kind:m.researchProbe?'paired':'factory',m,code,blueprint});
  }
  const modelFile=path.join(source,'preview-model.json');
  let model;
  if(process.env.FACTORIO_RAW) {
    const rawBytes=await fs.readFile(process.env.FACTORIO_RAW),raw=JSON.parse(rawBytes);
    for(const m of manifests)if(m.prototypeSha256 && m.prototypeSha256!==sha(rawBytes))
      throw Error(`Prototype SHA does not match ${m.id}`);
    const prototypes=new Map(Object.values(raw).flatMap(group=>Object.values(group)).filter(p=>p.selection_box).map(p=>[p.name,p]));
    const entities={},iconMetadata={},names=new Set(),signals=new Set(packs.map(p=>p[0]));
    for(const {blueprint,m}of inputs) {
      for(const e of blueprint.entities){names.add(e.name);if(e.recipe)signals.add(e.recipe);if(e.icon?.name)signals.add(e.icon.name);}
      for(const p of m.ports||[])for(const id of p.items||[])signals.add(id);
    }
    for(const name of [...names].sort()) {
      const p=prototypes.get(name);if(!p)throw Error(`Missing raw geometry: ${name}`);
      entities[name]={type:p.type,size:p.selection_box};
    }
    for(const id of [...signals,'lab','substation','passive-provider-chest','chemical-plant','assembling-machine-3','substation'].sort()) {
      const p=raw.item?.[id]||raw.fluid?.[id]||raw.recipe?.[id];
      const canonical=`assets/icons/${id}.png`;
      const file=await optional(path.join(ROOT,'site',canonical))?canonical:catalogIcons.get(id);
      if(!file)throw Error(`Missing repository icon: ${id}`);
      iconMetadata[id]={file,iconSize:p?.icon_size??64};
    }
    model={schemaVersion:1,gameVersion:manifests[0].gameVersion||report?.gameVersion||'2.1.24',
      prototypeSha256:sha(rawBytes),entities,icons:iconMetadata};
    await fs.writeFile(modelFile,JSON.stringify(model,null,2)+'\n');
  } else {
    const bytes=await optional(modelFile);
    if(!bytes)throw Error('Missing preview-model.json; refresh once with FACTORIO_RAW pointing to the exact prototype dump');
    model=JSON.parse(bytes);
  }
  if(model.schemaVersion!==1 || !model.entities || !model.icons)throw Error('Invalid Five-science preview model');
  for(const m of manifests)if(m.prototypeSha256 && m.prototypeSha256!==model.prototypeSha256)
    throw Error(`Preview model prototype SHA does not match ${m.id}; refresh with FACTORIO_RAW`);
  const production={entities:model.entities};
  const overviewIcons=Object.fromEntries(Object.entries(model.icons).map(([id,p])=>[id,p.file]));
  const icons=new Map();
  async function icon(id) {
    if(!icons.has(id)) {
      const metadata=model.icons[id];
      const file=metadata?.file||catalogIcons.get(id)||`assets/icons/${id}.png`;
      if(!/^assets\/(?:icons|flight-icons)\/[\w.-]+\.png$/.test(file))throw Error(`Invalid repository icon path: ${id}`);
      const image=await fs.readFile(path.join(ROOT,'site',file));
      const info=await sharp(image).metadata(),size=Math.min(metadata?.iconSize??64,info.width,info.height);
      // Existing assets may retain a horizontal mipmap sheet: embed frame one.
      const png=await sharp(image).extract({left:0,top:0,width:size,height:size}).png().toBuffer();
      icons.set(id,'data:image/png;base64,'+png.toString('base64'));
    }
    return icons.get(id);
  }
  function bounds(bp) {
    const boxes=bp.entities.map(e=>{
      const box=production.entities[e.name]?.size;
      if(!box)throw Error(`Missing snapshot geometry (refresh FACTORIO_RAW): ${e.name}`);
      let w=Math.ceil(box[1][0]-box[0][0]),h=Math.ceil(box[1][1]-box[0][1]);
      if([4,12].includes(e.direction))[w,h]=[h,w];
      return {l:e.position.x-w/2,r:e.position.x+w/2,t:e.position.y-h/2,b:e.position.y+h/2};
    });
    const left=Math.floor(Math.min(...boxes.map(b=>b.l))),right=Math.ceil(Math.max(...boxes.map(b=>b.r)));
    const top=Math.floor(Math.min(...boxes.map(b=>b.t))),bottom=Math.ceil(Math.max(...boxes.map(b=>b.b)));
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  async function layout(bp, f, ports) {
    const shapes=[],symbols=new Map();
    for(const e of bp.entities){
      const box=production.entities[e.name].size;
      let w=Math.ceil(box[1][0]-box[0][0]),h=Math.ceil(box[1][1]-box[0][1]);
      if([4,12].includes(e.direction))[w,h]=[h,w];
      const {x,y}=e.position;
      const fill=e.recipe?'#345c68':/inserter/.test(e.name)?'#75a8bd':/belt|splitter/.test(e.name)?'#96564b':/pipe/.test(e.name)?'#789d96':/chest/.test(e.name)?'#738b4d':'#665a46';
      shapes.push(`<g data-entity="${e.entity_number}"><title>${esc(e.name)}${e.recipe?' · '+esc(e.recipe):''} · (${x}, ${y})</title><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" fill="${fill}" stroke="#172025" stroke-width=".07"/>`);
      // Game icons identify recipes and entities; arrows describe saved direction.
      if(e.recipe || ['lab','substation','passive-provider-chest','chemical-plant','assembling-machine-3','substation'].includes(e.name)) {
        const id=e.recipe||e.name,size=Math.min(w,h)*.72;
        if(!symbols.has(id))symbols.set(id,`<symbol id="icon-${esc(id)}" viewBox="0 0 1 1"><image href="${await icon(id)}" width="1" height="1"/></symbol>`);
        shapes.push(`<use href="#icon-${esc(id)}" x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}"/>`);
      }
      if(/belt|splitter|inserter/.test(e.name))shapes.push(`<path d="M-.2 .14L0 -.18L.2 .14" transform="translate(${x} ${y}) rotate(${(e.direction||0)*22.5+(/inserter/.test(e.name)?180:0)})" fill="none" stroke="#fff4dc" stroke-width=".08"/>`);
      shapes.push('</g>');
    }
    const tunnels=bp.entities.filter(e=>e.name==='fast-underground-belt'&&e.type==='input').map(a=>{const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][(a.direction||0)/4];const candidates=bp.entities.filter(b=>b.name===a.name&&b.type==='output'&&(b.direction||0)===(a.direction||0)).map(b=>({b,d:(b.position.x-a.position.x)*dx+(b.position.y-a.position.y)*dy})).filter(o=>o.d>0&&o.d<=7&&(o.b.position.x-a.position.x)*dy===(o.b.position.y-a.position.y)*dx).sort((a,b)=>a.d-b.d);const b=candidates[0]?.b;return b?`<path d="M${a.position.x} ${a.position.y}L${b.position.x} ${b.position.y}" fill="none" stroke="#d48d81" stroke-width=".08" stroke-dasharray=".24 .18" opacity=".7"/>`:'';}).join('');
    const byId=new Map(bp.entities.map(e=>[e.entity_number,e]));
    const wires=(bp.wires||[]).filter(w=>w[1]===w[3]&&[1,5].includes(w[1])).map(([a,connector,b])=>{const p=byId.get(a)?.position,q=byId.get(b)?.position;return p&&q?`<path d="M${p.x} ${p.y}L${q.x} ${q.y}" fill="none" stroke="${connector===5?'#e6b96c':'#ff7772'}" stroke-width=".04" opacity=".4"/>`:'';}).join('');
    const markers=ports.map((p,i)=>{const pos=byId.get(p.entity)?.position || p.position || p;const label=p.kind==='power'?'P':i+1;return `<g><title>${esc(p.item||p.label||p.items?.join(' / '))}</title><circle cx="${pos.x}" cy="${pos.y}" r=".46" fill="${p.kind==='buffer'?'#f5d965':p.kind==='output'?'#9cda87':'#8ed9fa'}" stroke="#14252a" stroke-width=".06"/><text x="${pos.x}" y="${pos.y+.16}" text-anchor="middle" font-family="sans-serif" font-size=".45" font-weight="bold" fill="#14252a">${label}</text></g>`;}).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${(f.width+4)*24}" height="${(f.height+4)*24}" viewBox="${f.left-2} ${f.top-2} ${f.width+4} ${f.height+4}"><rect x="${f.left-2}" y="${f.top-2}" width="${f.width+4}" height="${f.height+4}" fill="#17252a"/><defs>${[...symbols.values()].join('')}</defs>${tunnels}${shapes.join('')}${wires}${markers}</svg>`;
  }
  const builds=[];
  for(const {kind,m,code,blueprint}of inputs){
    const measuredBounds=bounds(blueprint),footprint=m.footprint??measuredBounds;
    const actualLabs=blueprint.entities.filter(e=>e.name==='lab').length;
    if(m.researchProbe && actualLabs!==(m.labCount??m.expectedLabCount??m.metadata?.labCount??m.construction?.lab))throw Error(`Saved lab count differs from manifest: ${m.id}`);
    if(!packs.every(([id])=>m.products?.includes(id)))throw Error(`All five science products required: ${m.id}`);
    for(const key of ['left','top','right','bottom','width','height'])if(footprint[key]!==measuredBounds[key])
      throw Error(`Manifest footprint differs from exact import: ${m.id} ${key}`);
    const evidence=exactNativeEvidence(m,code,report);
    const displayPorts=(m.ports||[]).map(p=>kind==='paired'&&p.kind==='output'
      ? {...p,kind:'buffer',externalSide:undefined,label:`${pretty(p.item||p.items[0])} internal lab-feed buffer`} : p);
    const construction={};for(const e of blueprint.entities)construction[e.name]=(construction[e.name]||0)+1;
    if(m.construction && JSON.stringify(Object.entries(m.construction).sort())!==JSON.stringify(Object.entries(construction).sort()))throw Error(`Construction counts differ from saved import: ${m.id}`);
    const modules=blueprint.entities.some(e=>e.items && (Array.isArray(e.items)?e.items.length:Object.keys(e.items).length));
    builds.push({kind,manifest:m,code,blueprint,footprint,evidence,construction,modules,displayPorts,
      file:m.file,preview:m.id+'.svg',overview:m.id+'-overview.svg'});
  }
  await fs.mkdir(out,{recursive:true});
  for(const b of builds){
    await fs.writeFile(path.join(out,b.file),b.code+'\n');
    await fs.writeFile(path.join(out,b.preview),await layout(b.blueprint,b.footprint,b.displayPorts));
    const overview=await blueprintPreviewSvg(b.blueprint,production,{icons:overviewIcons});
    await fs.writeFile(path.join(out,b.overview),overview);
  }
  await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifests,null,2)+'\n');
  if(reportBytes)await fs.writeFile(path.join(out,'native-report.json'),reportBytes);
  else await fs.rm(path.join(out,'native-report.json'),{force:true});
  const data={schemaVersion:1,nominalInputsPerMinute:nominal,rootNativeReport:report,
    builds:builds.map(({blueprint,...b})=>b)};
  await fs.writeFile(path.join(out,'data.json'),JSON.stringify(data,null,2)+'\n');
  const packChips=(await Promise.all(packs.map(async([id,color,name,tint])=>`<span class="pack" style="--pack:${tint}"><img src="${await icon(id)}" alt="">${color} · ${name}<strong>30/min</strong></span>`))).join('');
  function card(b,index){
    const m=b.manifest,id=m.id,f=b.footprint,paired=b.kind==='paired';
    const label=(b.evidence.passed
      ?paired?'Native research tested · exact import SHA passed':'Native production tested · exact import SHA passed'
      :paired?'Connected-lab candidate · exact native proof pending':'Factory candidate · native proof pending');
    const name=m.name||m.id;
    const anomalies=Object.entries(b.construction).filter(([n])=>/^assembling-machine-/.test(n)&&n!=='assembling-machine-2');
    const byId=new Map(b.blueprint.entities.map(e=>[e.entity_number,e]));
    const ports=b.displayPorts.map((p,i)=>{
      const entity=byId.get(p.entity);
      const pos=entity?.position||p.position||p;
      const cap=entity?.name==='passive-provider-chest'
        ?` Passive provider; ${entity.bar===undefined?'inventory uncapped':entity.bar+' usable inventory slot'+(entity.bar===1?'':'s')+' (bar '+entity.bar+')'}.`:'';
      const bank=p.kind==='input'||p.kind==='fluid' ? ` · ${p.bank||'Upper original core'}` : '';
      const purpose=p.kind==='buffer'?'internal lab-feed buffer; keep connected to the included labs'
        :p.kind==='output'?'east external science collection':p.kind==='power'?'external electricity':(p.externalSide||'external')+' supply';
      return `<li><b>${p.kind==='power'?'P':i+1} · ${esc(p.item?pretty(p.item):p.label||p.items.join(' / '))}</b> — ${esc(purpose)}${esc(bank)}, (${pos.x}, ${pos.y}).${cap}${p.lanes?' '+p.lanes.map(l=>`${esc(l.side)} lane: ${esc(pretty(l.item))}`).join('; ')+'.':''}</li>`;
    }).join('');
    const proof=b.evidence.passed
      ?`<p class="measured-result">${esc(nativeResultText(m,b.evidence.result))} <a href="native-report.json">Native report</a>.</p>`:'';
    const configuration=paired?`<p class="lab-configuration">${b.construction.lab} connected labs · ${1+(m.researchProbe.labSpeedModifier??0)}× effective lab speed · ${m.researchProbe.seconds}-second research configuration. Packs flow into research through the included belts; east chests are internal buffers.</p>`:'';
    const storage=`<p class="storage-note">${paired
      ?'East passive-provider chests are internal lab-feed buffers, not external output ports. Each saved bar:1 cap permits one usable inventory slot (one stack). Do not drain them or send their packs to another consumer while feeding the included labs.'
      :'Five east passive-provider chests collect science. Their saved bar:1 setting allows one usable inventory slot (one stack) per chest. Empty them for continuous factory production; full storage pauses production.'} Preserve the saved chest caps. Passive providers offer their contents to logistic robots; ${paired?'avoid logistic requests that compete with the labs.':'robots need logistic-network coverage, while manual or belt collection also works.'}</p>`;
    return `<article id="${esc(id)}" class="build" data-build-kind="${b.kind}"><div class="section-label">${paired?'FACTORY + CONNECTED LABS':'FACTORY ALONE'}</div><h3>${esc(name)}</h3><p class="evidence ${b.evidence.passed?'matched':'pending'}" data-evidence="${b.evidence.passed?'matched':'pending'}">${label}</p><p>${f.width} × ${f.height} tiles · ${b.blueprint.entities.length} entities · ${b.construction['assembling-machine-2']||0} AM2 + ${b.construction['chemical-plant']||0} chemical plants · ${b.construction.substation||0} substations · ${b.modules?'contains item requests; inspect modules':'no modules'}</p>${configuration}${anomalies.length?`<p class="notice">Current import also contains ${anomalies.map(([n,c])=>c+' '+esc(pretty(n))).join(', ')}. This summary follows the actual saved entities.</p>`:''}<p>${esc(b.evidence.reason)}</p>${proof}${storage}<div class="actions"><a class="button primary" href="${esc(b.file)}" download>Download ${paired?'factory + '+b.construction.lab+' labs':'factory alone'}</a><button data-copy="import-${index}">Copy import</button><a class="button" href="${b.preview}">Full-size layout</a><a class="button" href="${b.overview}">Shared-renderer overview</a></div><p class="copy-status" id="status-${index}" role="status" aria-live="polite"></p><div class="map-controls"><button data-zoom="fit" data-map="map-${index}">Fit layout</button><button data-zoom="detail" data-map="map-${index}">Tile detail</button></div><div class="layout-map" id="map-${index}" tabindex="0" aria-label="Scrollable ${esc(name)} layout"><img src="${b.preview}" loading="${index?'lazy':'eager'}" alt="Exact saved ${esc(name)} geometry with recipe icons, direction arrows and numbered ports"></div><p class="muted">Schematic of exact import positions, repository game icons and saved directions. Dashed lines connect underground belts; gold lines show power connections; red lines show stock-control wiring. Numbers match the connection list; this is a layout preview, not a native game screenshot.</p><details><summary>Connections and import string</summary><ol class="ports">${ports}</ol><textarea id="import-${index}" readonly aria-label="${esc(name)} import string" spellcheck="false">${esc(b.code)}</textarea></details><details><summary>Exact identity and construction</summary><p class="hash">SHA-256 ${b.evidence.blueprintSha256||m.blueprintSha256}</p><pre>${esc(JSON.stringify(b.construction,null,2))}</pre></details></article>`;
  }
  const main=builds.find(b=>b.kind==='factory');
  const paired=builds.filter(b=>b.kind==='paired');
  const flight=paired.find(b=>b.construction.lab===15 && b.manifest.researchProbe.labSpeedModifier===1);
  const normal=paired.find(b=>b.construction.lab===30 && (b.manifest.researchProbe.labSpeedModifier??0)===0);
  const recommendation=`<section id="choose"><h2>Choose your import</h2><ul><li><strong>Flight map at effective 2× lab speed, 60-second research: choose ${flight?`<a href="#${flight.manifest.id}">factory + 15 connected labs</a>`:'factory + 15 connected labs'}.</strong>${flight?` ${flight.footprint.width} × ${flight.footprint.height} tiles.`:''}</li><li><strong>Normal effective 1× lab speed, 60-second research: choose ${normal?`<a href="#${normal.manifest.id}">factory + 30 connected labs</a>`:'factory + 30 connected labs'}.</strong>${normal?` ${normal.footprint.width} × ${normal.footprint.height} tiles.`:''}</li><li><a href="#${main.manifest.id}">Factory alone</a> — ${main.footprint.width} × ${main.footprint.height} tiles; collect packs or connect your own labs.</li></ul><p>These recommendations size the labs for an approximately 30/min supply; each import’s exact native status appears on its card.</p></section>`;
  const rateNote=main.evidence.passed?`<p class="notice" id="rate-headroom"><strong>Approximately 30/min per colour is the target.</strong> The exact factory-alone proof measured ${packs.map(([id,color])=>color.toLowerCase()+' '+Number(main.evidence.result.outputsPerMinute?.[id]??0).toFixed(2)+'/min').join(', ')}. Continuous research follows the slowest supplied pack. Each connected-lab import needs its own matching research proof. This design is not claimed to be an absolute optimum.</p>`:'<p class="notice">Approximately 30/min per colour is a design target, not a tested rate until the exact import passes native validation. This design is not claimed to be an absolute optimum.</p>';
  const rows=Object.entries(nominal).map(([id,rate])=>`<tr><th scope="row">${esc(pretty(id))}</th><td>${rate.toLocaleString('en-US')}</td><td>${id==='copper-plate'?'Three west copper ports across the upper core and lower purple bank; total demand across all three.':id==='sulfuric-acid'||id==='lubricant'?'Dedicated west fluid connection.':'Feed every shown west entrance, including duplicate material feeds in both banks.'}</td></tr>`).join('');
  const html=`<!doctype html><html lang="en"><head><title>Five-pack science · 30/min</title><style>
  .five-guide{max-width:1200px;margin:auto}.five-guide h1{font-size:clamp(2rem,4vw,3.1rem);line-height:1.1;max-width:850px}.five-guide p{max-width:900px;line-height:1.65}.five-guide .lede{font-size:1.1rem;color:#b9cbc7}.section-label{font-size:.75rem;letter-spacing:.13em;color:#a8c1b9;font-weight:700;margin-top:28px}.packs,.actions,.map-controls,.facts{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.pack{display:flex;align-items:center;gap:8px;border:1px solid var(--pack);border-left-width:4px;padding:10px 14px;border-radius:6px;color:var(--pack);background:#20312e}.pack img{width:30px;height:30px}.pack strong{color:#e3eee6;margin-left:8px}.facts span,.notice,.lab-note{background:#26342f;border:1px solid #58604b;border-radius:6px;padding:13px 16px}.notice,.pending{color:#f0d18e}.evidence{padding:12px;border:1px solid #746746;border-radius:5px;background:#302e24}.matched{color:#a4dfb2;border-color:#476951;background:#22372b}.build{border-top:1px solid #465249;padding:10px 0 30px;scroll-margin-top:24px}.build h3{font-size:1.5rem}.five-guide button,.five-guide .button{cursor:pointer;background:#2e443c;color:#e9f2e9;border:1px solid #6a8073;border-radius:5px;padding:9px 13px;font:inherit;text-decoration:none}.five-guide .primary{background:#547449;border-color:#97b68b}.five-guide button:focus-visible,.five-guide a:focus-visible{outline:3px solid #8ed9fa;outline-offset:3px}.layout-map{overflow:auto;max-height:70vh;border:1px solid #56665c;border-radius:6px;background:#17252a}.layout-map img{display:block;width:100%;height:auto}.layout-map.detail img{width:auto;max-width:none;max-height:none}.muted{color:#b3c1b9;font-size:.9rem}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #465249;vertical-align:top}.five-guide h2{margin-top:38px;font-size:1.6rem}.five-guide li{margin:8px 0;line-height:1.55}.five-guide textarea{width:100%;box-sizing:border-box;min-height:100px;margin:15px 0;color:#e0e9df;background:#192720;border:1px solid #657761;border-radius:5px;padding:10px}.hash{overflow-wrap:anywhere;font-size:.8rem}pre{overflow:auto}.copy-status{min-height:1em}.lab-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.lab-grid .actions{align-items:start}.five-guide code{white-space:normal;overflow-wrap:anywhere}@media(max-width:760px){.lab-grid{grid-template-columns:1fr}.five-guide h1{font-size:2rem}th,td{padding:8px}.pack{width:100%;box-sizing:border-box}.pack strong{margin-left:auto}.actions>*{max-width:100%;box-sizing:border-box}}
  </style></head><body><aside><a href="#choose">Choose import</a><a href="#factory">Factory alone</a><a href="#paired">Connected labs</a><a href="#inputs">Supply</a><a href="#labs">Lab sizing</a><a href="#research">Research gates</a></aside><main><div class="five-guide"><div class="section-label">FIVE COLOURS · ONE PLATE-FED FACTORY</div><h1>Red, green, blue, yellow &amp; purple.<br>About 30 of each per minute.</h1><p class="lede">All circuits, gears, engines, batteries, frames, processing units, low-density structures, productivity modules, electric furnaces and rails are made inside. Supply plates, plastic, sulfur, stone, bricks and two fluids. Choose external pack collection or a complete factory with connected labs.</p><div class="packs">${packChips}</div><div class="facts"><span>${main.footprint.width} × ${main.footprint.height} tiles · current factory</span><span>AM2 · red belts · fast + bulk inserters · no installed modules</span><span>Factorio ${esc(manifests[0].gameVersion||model.gameVersion)} recipes</span></div><p class="notice">30/min per colour is the design target. ${main.evidence.passed?'The factory import below has matching passing native evidence.':'The current factory import is still a candidate: native production validation is pending. Component or lab evidence does not verify the complete factory.'}</p>${rateNote}<p class="notice"><strong>Keeping the four-pack factory?</strong> <a href="../rgby-science/index.html">Open the original red, green, blue &amp; yellow guide</a>.</p>${recommendation}<p>These five-pack research fixtures use red automation, green logistic, blue chemical, yellow utility and purple production packs, one of each per unit. Black military science is outside this factory’s outputs. Check each technology’s ingredient list; other technologies can require additional colours.</p><section id="factory"><h2>Factory alone · external pack collection</h2><ol><li>Download or copy the factory import. In Factorio, choose Import string and place the complete blueprint.</li><li>Build every machine, power pole, inserter, belt and pipe. Preserve filters, red wires, whole-belt readers and stock limits.</li><li>Connect the west supplies below, in <strong>both banks: upper original core and lower purple bank. Feed all shown entrances, including all three copper ports</strong>. Connect external power at P.</li><li>For the factory-alone import, collect the five packs from the east providers or route them to your own labs. Keep output storage clear while measuring production.</li></ol>${builds.filter(b=>b.kind==='factory').map(b=>card(b,builds.indexOf(b))).join('')}</section><section id="paired"><h2>Factory + connected labs</h2><p>These complete imports include the factory, routed science belts, powered labs and east chest buffers. Build the complete import and select a technology using these five packs. Science is consumed by the included labs; research units/min is the paired performance measure. There is no additional external science feed or external pack collection.</p>${paired.map(b=>card(b,builds.indexOf(b))).join('')}</section><section id="inputs"><h2>Supply the west edge</h2><p>Nominal continuous consumption at 30/min of each pack. Item rates are items/min; fluid rates are units/min. Allow extra supply while belts and machine buffers fill.</p><div class="table-scroll"><table><thead><tr><th>Material</th><th>Nominal / min</th><th>Connection</th></tr></thead><tbody>${rows}</tbody></table></div><p class="notice">Feed both west banks: the upper original core and the lower purple bank. Repeated material labels are separate required feeds, not alternatives. Copper needs 2,370/min total across three ports; one red belt carries only 1,800/min. Feed all three copper entrances and every other shown entrance. Rates in this table are combined totals, not the rate per port.</p><p>Deliver finished plates, plastic, sulfur, stone and stone bricks. Circuits, gears, engines, frames, processing units, low-density structures, productivity modules, electric furnaces and rails stay internal; no external delivery of these intermediates is needed.</p></section><section id="labs"><h2>How many labs can 30/min feed?</h2><p>For a technology consuming one of each available pack per research unit:</p><p class="lab-note"><code>floor(SPM × research seconds / (60 × effective lab speed))</code></p><div class="table-scroll"><table id="lab-capacity"><thead><tr><th>Research time / unit</th><th>Normal labs · 1× speed</th><th>Effective 2× speed</th></tr></thead><tbody>${[30,60,120].map(t=>`<tr><th scope="row">${t} seconds</th><td>${Math.floor(30*t/60)}</td><td>${Math.floor(30*t/120)}</td></tr>`).join('')}</tbody></table></div><p><strong>Research-speed upgrades reduce the number of labs that the same science supply can continuously feed.</strong> Your flight map may already run at effective 2× lab speed: use the right-hand column. This is lab research speed, not the game simulation speed setting. More labs can be placed, but they will share the available packs and run intermittently.</p><p>Effective speed includes the lab’s base research speed and your force’s laboratory speed modifier. With these normal, module-free labs, 2× means twice the base research rate. If the technology uses different pack quantities, divide each supply by its per-unit quantity before applying the bottleneck rate.</p></section><section id="research"><h2>Research gates &amp; first startup</h2><p>This factory supplies red, green, blue, yellow and purple packs. Technologies requiring military, space or planetary packs also need those packs supplied separately.</p><ul><li>Start with red and green science. Blue science unlocks the advanced recipes needed for yellow inputs: processing units, electric engines, flying robot frames and low-density structures. Unlock the ingredient recipes before enabling the complete yellow chain.</li><li>Purple science also needs the productivity-module, electric-furnace and rail recipes. Productivity modules are manufactured ingredients for purple science; no modules are installed in machines or labs. Substations are permitted; each card reports actual saved power-pole counts.</li><li>Research Automation 2, Logistics 2, Fast inserters, Advanced electronics, Circuit network, oil processing and the sulfuric-acid/lubricant chains, plus their prerequisites. Passive-provider chests need Logistic robotics.</li><li><strong>Bulk inserter baseline:</strong> the bulk-inserter unlock itself grants +1 capacity in the source game version, giving a two-item hand. Build the marked bulk arms and research that unlock; merely enabling the recipe on an otherwise unresearched force is insufficient. No later inserter-capacity upgrade is assumed anywhere in this factory.</li><li>Let all five colours reach the farthest labs and let the internal inventories fill before judging the rate. The connected variants use a longer priming period in their native tests. If a colour stops, check power, all three copper feeds in both supply banks, the two fluids, all recipes unlocked, stock-control wiring and blocked east storage.</li></ul></section><details><summary>Source history, evidence and machine-readable data</summary><p>This five-pack extension preserves the original <a href="../rgby-science/index.html">four-pack factory and guide</a>. Baseline import SHA-256: <span class="hash">${esc(main.manifest.baseline?.blueprintSha256||'See source manifest')}</span>. The manifest retains component identities, material calculations, setup notes and power-network facts.</p><p>Each import is copied from its current source code and hashed. A production-tested label requires a passing result for that exact import and prototype SHA. Factory-alone and paired results are evaluated individually: paired research additionally requires the declared lab count, speed, research duration and all labs active and powered. Each fixture consumes one of all five packs per research unit. A failed sibling variant does not invalidate a passing factory-alone result.</p><p><a href="manifest.json">Factory manifest</a> · <a href="data.json">Complete embedded-data export</a>${reportBytes?' · <a href="native-report.json">Factory native report</a>':''}</p></details></div></main><script type="application/json" id="five-data">${json(data)}</script><script>
  document.addEventListener('click',async event=>{const copy=event.target.closest('[data-copy]');if(copy){const t=document.getElementById(copy.dataset.copy);const index=copy.dataset.copy.split('-').pop();const status=document.getElementById('status-'+index);try{if(location.protocol==='file:'||!navigator.clipboard?.writeText)throw Error('Manual offline copy');await navigator.clipboard.writeText(t.value);status.textContent='Blueprint copied';}catch{t.closest('details').open=true;t.focus();t.select();status.textContent='Import selected — press Ctrl+C or Command+C to copy';}}const zoom=event.target.closest('[data-zoom]');if(zoom)document.getElementById(zoom.dataset.map).classList.toggle('detail',zoom.dataset.zoom==='detail');});
  </script></body></html>`;
  await fs.writeFile(path.join(out,'index.html'),renderFlightPlanPage(html,{page:'five-science',rootPrefix:'../'}));
  return {out,builds:builds.map(b=>({id:b.manifest.id,kind:b.kind,footprint:b.footprint,
    evidence:{passed:b.evidence.passed,blueprintSha256:b.evidence.blueprintSha256||b.manifest.blueprintSha256,reason:b.evidence.reason}}))};
}
if(process.argv[1] && await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url)) {
  // The shared overview helper resolves repository icon paths from cwd.
  process.chdir(ROOT);
  console.log(JSON.stringify(await buildPage(),null,2));
}
