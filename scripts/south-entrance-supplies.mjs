/** "South entrance supplies" block of the flight-science-sided guide (site/flight-science-sided/index.html, next to the
 * family's supply factories, reached from the Compact section). One row per south entrance of the compact six-pack tier
 * (the purple/yellow block's five heavy ingredients, read from the compact manifest): the factory that feeds it, with rate,
 * inputs per minute, size, machines, copy and download and native evidence; an entrance with no factory yet reads
 * "in progress" without links. Factories are every folder under blueprint-sources/flight-science-sided/heavy-supplies/ with a
 * manifest, so a later factory needs no edit here. Figures come from the manifests and reports.
 * The block sits between marker comments, so a rebuild replaces it instead of adding another.
 * CLI: node scripts/south-entrance-supplies.mjs   (run from factorio-command-center/; no game data needed)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from './blueprints.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const FAMILY='flight-science-sided';
export const BLOCK_START='<!-- south-entrance-supplies:start -->',BLOCK_END='<!-- south-entrance-supplies:end -->';
export const LINK_START='<!-- south-entrance-link:start -->',LINK_END='<!-- south-entrance-link:end -->';
const hash=s=>createHash('sha256').update(s).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words=s=>s.replaceAll('-',' ');
const num=n=>Number.isFinite(n)?Number(n.toFixed(2)).toLocaleString('en-US'):'—';
const readJSON=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const strip=(html,start,end)=>{const a=html.indexOf(start),b=html.indexOf(end);return a>=0&&b>a?html.slice(0,a)+html.slice(b+end.length):html;};

/** The five south entrances of the compact tier, in order from the top, and the qualified factories of the heavy-supplies folder. */
export async function loadSouthEntrances(root=ROOT){
 const base=path.join(root,'blueprint-sources',FAMILY),[compact]=await readJSON(path.join(base,'compact/manifest.json'));
 const entrances=compact.inputs.filter(p=>p.block==='Purple/yellow block').sort((a,b)=>a.position.y-b.position.y);
 const dir=path.join(base,'heavy-supplies'),factories=[];
 for(const id of (await fs.readdir(dir).catch(()=>[])).sort()){
  const mf=path.join(dir,id,'manifest.json');if(!await fs.access(mf).then(()=>true,()=>false))continue;
  const [m]=await readJSON(mf),code=(await fs.readFile(path.join(dir,id,m.file),'utf8')).trim(),report=await readJSON(path.join(dir,id,'native-report.json')).catch(()=>null);
  const build=report?.builds?.find(b=>b.blueprintSha256===m.blueprintSha256&&b.passed===true);
  const qualified=!!(build&&report.short!==true&&m.blueprintSha256===hash(code)&&m.status==='native-verified'&&decodeBlueprint(code)?.blueprint?.entities?.length);
  factories.push({id,dir:path.join(dir,id),m,code,report,build,qualified});
 }
 return {compact,entrances,factories};
}

/** The block's HTML and the files it links (published beside the guide under heavy-supplies/<id>/). */
export async function southSuppliesBlock(root=ROOT){
 const {entrances,factories}=await loadSouthEntrances(root),rows=[],details=[],files={};
 const made=new Map(factories.filter(f=>f.qualified).map(f=>[f.m.products[0],f]));
 for(const [i,e] of entrances.entries()){
  const item=e.item,f=made.get(item),where=`South entrance ${i+1} of ${entrances.length} · ${esc(words(item))} · ${num(e.perMinute)}/min · (${e.position.x}, ${e.position.y})`;
  if(!f){rows.push(`<tr data-entrance="${esc(item)}"><td>${where}</td><td><strong>In progress</strong></td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`);continue;}
  const {m,build,report,id}=f,p=`heavy-supplies/${id}/`,rate=build.outputsPerMinute[item],rec=build.recovery?.outputsPerMinute?.[item];
  const inputs=m.inputs.map(x=>`${esc(words(x.item))} ${num(x.perMinute)}`).join('; ');
  const machines=Object.entries(m.machineCounts).map(([k,n])=>`${n} ${esc(words(k))}`).join(', ');
  rows.push(`<tr data-entrance="${esc(item)}" data-factory="${esc(id)}"><td>${where}</td><td>${esc(id)}<br><small>${m.footprint.width} × ${m.footprint.height} tiles</small></td><td>${num(rate)}<br><small>recovery ${num(rec)}</small></td><td>${inputs}</td><td>${machines}</td><td><a href="${p}${esc(m.file)}" download>Download</a> · <button data-south-copy="${esc(id)}">Copy import</button><br><a href="${p}native-report.json">Native report</a> · <a href="${p}manifest.json">Manifest</a> · <a href="${p}README.md">Notes</a></td></tr>`);
  details.push(`<details><summary>${esc(id)} import string</summary><pre id="south-code-${esc(id)}" class="south-import" tabindex="0" aria-label="${esc(id)} import string" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:12em;overflow:auto;user-select:all">${esc(f.code)}</pre><p class="muted">Blueprint SHA-256 ${esc(m.blueprintSha256)}</p></details>`);
  for(const [name,value] of [[m.file,f.code+'\n'],['manifest.json',JSON.stringify([m],null,2)+'\n'],['native-report.json',JSON.stringify(report,null,2)+'\n']])files[p+name]=value;
  files[p+'README.md']=await fs.readFile(path.join(f.dir,'README.md'),'utf8');
 }
 const profile=factories.find(f=>f.qualified)?.report?.profile;
 const html=`${BLOCK_START}<div id="south-entrance-supplies" class="south-entrance-supplies"><h3>South entrance supplies</h3><p>The compact tier's ${entrances.length} south entrances (the purple and yellow packs' heavy ingredients) each get a factory of their own: it makes one ingredient from the plates, steel, plastic and circuits listed, and its output belt joins that entrance. Inputs and rates are per minute; recovery is the rate after the output was blocked and released. An entrance marked in progress has no factory yet.</p><div class="table-scroll"><table><thead><tr><th>Entrance it feeds</th><th>Factory · size</th><th>Measured / min</th><th>Inputs / min</th><th>Machines</th><th>Blueprint · evidence</th></tr></thead><tbody>${rows.join('')}</tbody></table></div><p class="muted">Each factory passed its full native protocol for its exact SHA-256 on the family's own flight-save profile (not the vanilla catalogue).</p>${details.join('')}<p id="south-copy-status" role="status" aria-live="polite"></p><script>document.querySelectorAll('[data-south-copy]').forEach(b=>b.addEventListener('click',async()=>{const t=document.getElementById('south-code-'+b.dataset.southCopy),s=document.getElementById('south-copy-status');try{if(location.protocol==='file:'||!navigator.clipboard?.writeText)throw Error('manual');await navigator.clipboard.writeText(t.textContent);s.textContent='Copied';}catch{t.closest('details').open=true;t.focus();const r=document.createRange();r.selectNodeContents(t);const g=getSelection();g.removeAllRanges();g.addRange(r);s.textContent='Import selected — press Ctrl+C or Command+C to copy';}}));</script></div>${BLOCK_END}`;
 return {html,files,count:{entrances:entrances.length,built:made.size},profile};
}

/** Insert (or replace) the block after the supply factories and a pointer to it in the Compact section's introduction. */
export async function injectSouthSupplies({root=ROOT}={}){
 const page=path.join(root,'site',FAMILY,'index.html');let html=await fs.readFile(page,'utf8');
 const {html:block,files,count}=await southSuppliesBlock(root);
 html=strip(strip(html,BLOCK_START,BLOCK_END),LINK_START,LINK_END);
 const after='</section><section id="compare">',intro='Pair this with the supply factories below.</p>';
 if(html.split(after).length!==2||html.split(intro).length!==2)throw Error('flight-science-sided page: anchors for the south entrance supplies not found');
 html=html.replace(after,block+after).replace(intro,`Pair this with the supply factories below.${LINK_START} The five south entrances have supply factories of their own: <a href="#south-entrance-supplies">South entrance supplies</a>.${LINK_END}</p>`);
 await fs.writeFile(page,html);
 const out=path.join(root,'site',FAMILY);
 await fs.rm(path.join(out,'heavy-supplies'),{recursive:true,force:true});
 for(const [file,value] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(out,file)),{recursive:true});await fs.writeFile(path.join(out,file),value);}
 return count;
}
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url))console.log(JSON.stringify(await injectSouthSupplies(),null,2));
