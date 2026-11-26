/** Space launch round guides: one offline page per qualified blueprint plus site/space-launch/index.html.
 * CLI: node scripts/space-launch-pages.mjs   (run after index-designed-blueprints.mjs)
 * Only a blueprint whose native report passes for its exact SHA-256 gets a page, a place in the book and a
 * library record; the others are named on the landing page with the reason. FACTORIO_RAW optionally refreshes
 * the tracked snapshot scripts/space-launch-pages/preview-model.json (entity sizes and the rocket-part facts);
 * normal builds only read it, so the build needs neither the game nor the prototype dump.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {decodeBlueprint,encodeBlueprint} from './blueprints.mjs';
import {renderFlightPlanPage} from './flight-plan-shell.mjs';
import {exactNativeEvidence,groupPorts,footprint,counts,refreshSnapshot,prototypeMatches,preview,table,STYLE,SCRIPT} from './workshop-guides.mjs';
import {dedupeIcons} from './essentials-pages.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const SPACE_IDS=['concrete-supplier','rocket-fuel-supplier','launch-kit','rocket-supplies','white-platform','white-pack-receiver'];
export const SPACE_RELEASE='space-launch-20261121';
export const CIRCUITS='green-circuits';
/** Book order from the contract: the existing circuit supplier first, then the round's six. */
export const BOOK_ORDER=[CIRCUITS,...SPACE_IDS];
const MODEL='scripts/space-launch-pages/preview-model.json';
const hash=s=>createHash('sha256').update(s).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=s=>String(s).replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
const json=s=>JSON.stringify(s,null,2).replaceAll('<','\\u003c');
const one=n=>Number.isFinite(n)?String(Math.round(n*10)/10):'—';
const num=n=>Number.isFinite(n)?String(Number(n.toFixed(2))):'—';
const thousands=n=>Number.isFinite(n)?Number(n.toFixed(2)).toLocaleString('en-US'):'—';
const SHORT={'green-circuits':'green-circuit supplier','concrete-supplier':'concrete supplier','rocket-fuel-supplier':'rocket-fuel supplier','launch-kit':'launch kit','rocket-supplies':'rocket supplies','white-platform':'white-pack platform','white-pack-receiver':'white-pack receiver'};
/** "50 × processing unit, 37 × space platform foundation": counts without guessing plurals. */
const amounts=o=>Object.entries(o).map(([id,n])=>`${thousands(n)} × ${pretty(id).toLowerCase()}`).join(', ');
const ICON_ALIAS={'solid-fuel-from-light-oil':'solid-fuel','rocket-part':'rocket-silo'};
const LEDE={
 'concrete-supplier':'Makes 45 concrete per minute from stone bricks, iron ore and water in one assembling machine 2, on a red belt leaving the bottom row of the east side. One copy covers the launch kit.',
 'rocket-fuel-supplier':'Makes 6 rocket fuel per minute from light oil: one chemical plant makes solid fuel and two assembling machine 2 make rocket fuel, on a red belt leaving the bottom row of the east side. One copy covers rocket supplies.',
 'launch-kit':'Builds one complete space launch kit and stops: the rocket silo, the cargo landing pad, the space platform starter pack, every part the white-science platform asks rockets for and the receiver\'s parts, each in its own capped chest on the east side. Take items out and exactly those are made again.',
 'rocket-supplies':'Makes processing units and low density structures at 5 per minute each and passes supplied rocket fuel through, so the three rocket ingredients wait side by side in three chests of 400 on the east side.',
 'white-platform':'A space platform blueprint for Nauvis orbit: four asteroid collectors, one crusher, one electric furnace and four assembling machine 2 make 60 space science packs per minute and keep them in the hub. Paste it on a platform made from one starter pack; the platform asks rockets for exactly its own parts.',
 'white-pack-receiver':'One cargo landing pad that requests space science packs, one fast inserter and one passive provider chest: the white-science platform drops pods by itself and the packs collect in the chest.'
};

/** Exact-hash native evidence for every class of this round. A rate blueprint uses the shared rule
 * (products and recovery at 95% of target); the kit, platform and receiver have their own pass formula,
 * read from their own report, and always need a full-protocol pass for the exact string and prototype. */
export function spaceEvidence(m,code,report){
 const actual=hash(code.trim()),fail=reason=>({passed:false,blueprintSha256:actual,reason});
 if(m.blueprintSha256!==actual)return fail('The manifest SHA-256 does not match the import string.');
 if(!report)return fail('There is no native report.');
 if(!/^[a-f0-9]{64}$/.test(m.prototypeSha256||'')||report.prototypeSha256!==m.prototypeSha256)return fail('The native report was made with another prototype dump.');
 if(report.passed!==true||report.short===true)return fail('The native report did not pass the full protocol.');
 if(m.class==='rate')return exactNativeEvidence(m,code,report);
 const b=report.builds?.find(x=>x.id===m.id&&x.blueprintSha256===actual&&x.passed===true&&x.short!==true);
 if(!b)return fail('The native report has no passing build for this exact SHA-256.');
 let ok=false;
 if(m.class==='kit')ok=b.complete===true&&b.fill?.complete===true&&b.fill.kitMinutes<=m.protocol.kitLimitMinutes&&b.hold?.mismatches===0&&b.longHold?.mismatches===0&&b.refill?.complete===true&&Object.keys(m.outputCaps).every(id=>b.refill.endChests?.[id]===m.outputCaps[id]);
 if(m.class==='platform'){const floor=.95*m.targets['space-science-pack'],d=report.rocketDelivery;
  ok=b.steady?.collectedPerMinute>=floor&&b.steady.madePerMinute>=floor&&b.recovery?.madePerMinute>=floor&&b.power?.lowPowerTicks===0&&d?.passed===true&&d.launches?.length===m.billOfMaterials.totalRockets;}
 if(m.class==='receiver'){const floor=.95*m.deliveryTarget['space-science-pack'];
  ok=b.steady?.collectedPerMinute>=floor&&b.recovery?.collectedPerMinute>=floor&&b.blocked?.chest===m.outputCaps['space-science-pack']&&b.blocked.chestMaxDuringBlocked<=m.outputCaps['space-science-pack'];}
 return ok?{passed:true,blueprintSha256:actual,reason:'Passing full-protocol evidence matches this exact import and prototype.',result:b}:fail(`The ${m.class} pass formula is not met by the report's numbers.`);
}

/** The kit's bill must be built from the exact platform and receiver strings being published, and cover them. */
export function kitBillProblems(bill,platform,receiver,kit){
 const problems=[];
 if(bill?.sources?.['white-platform']!==platform?.blueprintSha256)problems.push('bill.json names another white-platform string');
 if(bill?.sources?.['white-pack-receiver']!==receiver?.blueprintSha256)problems.push('bill.json names another white-pack-receiver string');
 const request=platform?.billOfMaterials?.platformRequest||{},ground=receiver?.billOfMaterials?.items||{},items=new Map((bill?.items||[]).map(i=>[i.item,i]));
 for(const [id,n] of Object.entries(request))if((items.get(id)?.platform??0)!==n)problems.push(`${id}: platform share ${items.get(id)?.platform??0}, platform asks for ${n}`);
 for(const [id,n] of Object.entries(ground))if((items.get(id)?.receiver??0)!==n)problems.push(`${id}: receiver share ${items.get(id)?.receiver??0}, receiver needs ${n}`);
 for(const i of items.values()){const need=(i.platform||0)+(i.receiver||0);if(i.count<need)problems.push(`${i.item}: count ${i.count} below ${need}`);
  if(kit&&kit.outputCaps?.[i.item]!==i.count+i.spare)problems.push(`${i.item}: chest cap ${kit.outputCaps?.[i.item]} is not count + spare ${i.count+i.spare}`);}
 if(kit&&Object.keys(kit.outputCaps||{}).sort().join()!==[...items.keys()].sort().join())problems.push('kit chests and bill items differ');
 return problems;
}

/** Read the six sources and the circuit supplier. Each record says whether it may be published. */
export async function loadSpaceLaunch(root=ROOT){
 const records=[];
 for(const id of BOOK_ORDER){
  const dir=path.join(root,'blueprint-sources',id),[m]=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  if(m?.id!==id)throw Error(`${id}: unexpected manifest`);
  const code=(await fs.readFile(path.join(dir,m.file),'utf8')).trim(),bp=decodeBlueprint(code)?.blueprint;
  if(!bp?.entities?.length)throw Error(`${id}: empty blueprint`);
  const report=JSON.parse(await fs.readFile(path.join(dir,'native-report.json'),'utf8').catch(()=>'null'));
  const evidence=spaceEvidence(m,code,report);
  const qualified=evidence.passed&&m.status==='qualified';
  records.push({id,m,code,bp,report,evidence,qualified,reason:qualified?'':(evidence.passed?'The manifest status is not "qualified".':evidence.reason)});
 }
 const by=Object.fromEntries(records.map(r=>[r.id,r])),platform=by['white-platform'],receiver=by['white-pack-receiver'],kit=by['launch-kit'];
 // One end-to-end run qualifies the platform and the receiver together: each build names the other's string.
 if(platform.qualified&&receiver.qualified&&(platform.evidence.result.receiverBlueprintSha256!==receiver.m.blueprintSha256||receiver.evidence.result.platformBlueprintSha256!==platform.m.blueprintSha256))
  for(const r of [platform,receiver])Object.assign(r,{qualified:false,reason:'The platform and receiver reports name different strings.'});
 const bill=JSON.parse(await fs.readFile(path.join(root,'scripts/launch-kit/bill.json'),'utf8'));
 const problems=kitBillProblems(bill,platform.m,receiver.m,kit.m);
 if(kit.qualified&&(problems.length||!platform.qualified||!receiver.qualified))Object.assign(kit,{qualified:false,reason:problems.length?'Kit bill: '+problems.join('; '):'The kit is built for a platform or receiver that is not qualified.'});
 return Object.assign(records,{bill});
}

/** Rockets from the platform's rocket-delivery check and its bill; rocket-part needs from the dump snapshot. */
export function rocketPlan(platform,facts,weights={}){
 const bom=platform.m.billOfMaterials,kg={...weights,...bom.weightKg},launches=platform.report?.rocketDelivery?.launches||[];
 const perRocket=Object.fromEntries(facts.rocketPart.ingredients.map(i=>[i.name,i.amount*facts.rocketPartsRequired]));
 return {
  rockets:bom.rocketCargo.map((cargo,i)=>({rocket:i+1,cargo,weightKg:Object.entries(cargo).reduce((a,[id,n])=>a+n*kg[id],0),measured:launches[i]?.cargo,measuredKg:launches[i]?.weightKg})),
  requestedWeightKg:bom.requestedWeightKg,rocketLiftKg:bom.rocketLiftKg,cargoRockets:bom.cargoRockets,totalRockets:bom.totalRockets,
  measuredLaunches:launches.length,builtMinutes:platform.report?.rocketDelivery?.builtMinutes,
  partsPerRocket:facts.rocketPartsRequired,perRocket,campaign:Object.fromEntries(Object.entries(perRocket).map(([id,n])=>[id,n*bom.totalRockets]))
 };
}

const rowOf=(m,p)=>Math.floor((p.position?.y??p.y)-m.footprint.top);
/** Which supplier exit feeds which entrance, with copies and the placement rule of contract section 13. */
export function interfaces(records){
 const by=Object.fromEntries(records.map(r=>[r.id,r])),rows=[];
 for(const consumer of records.filter(r=>r.qualified))for(const l of consumer.m.supplierLinks||[]){
  if(!l.supplier)continue;const supplier=by[l.supplier];if(!supplier)continue;
  const exit=supplier.m.outputs.find(o=>o.item===l.item),exitRow=supplier.m.supplierLinks?.find(x=>x.consumer===consumer.id)?.exitRowFromTop??rowOf(supplier.m,exit);
  const kitEntrance=consumer.evidence.result?.entrances?.find(e=>e.item===l.item),rateEntrance=[...(consumer.evidence.result?.inputs||[]),...(consumer.evidence.result?.fluids||[])].find(e=>e.item===l.item);
  const offset=l.entranceRowFromTop-exitRow;
  rows.push({supplier:l.supplier,supplierName:supplier.m.name,supplierQualified:supplier.qualified,consumer:consumer.id,consumerName:consumer.m.name,item:l.item,copies:l.copies,
   supplierPerMinute:supplier.m.targets?.[l.item],supplierMeasured:supplier.evidence.result?.outputsPerMinute?.[l.item],panelPerMinute:l.perMinute,
   measuredPerMinute:kitEntrance?kitEntrance.peakMinuteDraw:rateEntrance?.measuredPerMinute,measuredKind:kitEntrance?'peak minute':'steady',
   entranceRowFromTop:l.entranceRowFromTop,exitRowFromTop:exitRow,offset,note:l.note||'',
   placement:l.note&&/cannot sit directly west/.test(l.note)?l.note:`Place the ${SHORT[l.supplier]||l.supplier}'s top row ${offset===0?'level with':Math.abs(offset)+' row'+(Math.abs(offset)===1?'':'s')+(offset>0?' below':' above')} the ${SHORT[consumer.id]||consumer.id}'s top row, any distance west, and join exit to entrance with a straight red belt.`});
 }
 return rows;
}

export async function refreshModel(root,rawPath,records){
 const model=await refreshSnapshot(root,rawPath,records),raw=JSON.parse(await fs.readFile(rawPath,'utf8'));
 const part=raw.recipe['rocket-part'],silo=raw['rocket-silo']['rocket-silo'];
 model.facts={rocketPart:{ingredients:part.ingredients.map(i=>({name:i.name,amount:i.amount})),results:part.results},rocketPartsRequired:silo.rocket_parts_required};
 return model;
}

/** The platform footprint is its foundation rectangle; ground blueprints use the entity bounds. */
function tileBounds(bp){const xs=bp.tiles.map(t=>t.position.x),ys=bp.tiles.map(t=>t.position.y);const left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs)+1,bottom=Math.max(...ys)+1;return {left,top,right,bottom,width:right-left,height:bottom-top};}
async function layoutSvg(bp,model,ports,icon){
 let svg=await preview(bp,model,ports,icon);
 if(bp.tiles?.length){
  // Widen the view to the foundation, then draw the tiles under every entity.
  const f=footprint(bp,model),t=tileBounds(bp),left=Math.min(f.left,t.left),top=Math.min(f.top,t.top),right=Math.max(f.right,t.right),bottom=Math.max(f.bottom,t.bottom),w=right-left+4,h=bottom-top+4;
  const tiles=bp.tiles.map(x=>`<rect class="tile" x="${x.position.x}" y="${x.position.y}" width="1" height="1" fill="#3e4a50" stroke="#2c373c" stroke-width=".05"/>`).join('');
  svg=svg.replace(/<svg ([^>]*?)width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`<svg $1width="${w*28}" height="${h*28}" viewBox="${left-2} ${top-2} ${w} ${h}"`).replace(/(<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" fill="#17252a"\/>)/,`<rect x="${left-2}" y="${top-2}" width="${w}" height="${h}" fill="#17252a"/>${tiles}`);
 }
 return dedupeIcons(svg);
}

// First launch: in a save that has never created a space platform the asteroid-collector and crusher recipes are locked
// (trigger technology space-platform). Numbers come only from the committed exploration runs of the exact kit string.
export async function firstLaunchEvidence(root,kit){
 try{
  const dir=path.join(root,'blueprint-sources/launch-kit/history/first-launch-order');
  const [l,u]=await Promise.all(['locked-throughout','unlocked-at-minute-75'].map(async n=>JSON.parse(await fs.readFile(path.join(dir,n+'.json'),'utf8'))));
  const lb=l.builds[0],ub=u.builds[0];
  if(lb.blueprintSha256!==kit.m.blueprintSha256||ub.blueprintSha256!==kit.m.blueprintSha256||u.passed!==true||!Number.isFinite(u.firstLaunch?.unlockMinute))return null;
  const caps=kit.m.outputCaps,end=lb.fill.endChests||{},items=Object.keys(caps),done=ub.fill.completedMinute;
  return {full:items.filter(k=>end[k]===caps[k]).length,total:items.length,starter:lb.fill.completedMinute['space-platform-starter-pack'],silo:lb.fill.completedMinute['rocket-silo'],unlock:u.firstLaunch.unlockMinute,crusher:done.crusher,collectors:done['asteroid-collector']};
 }catch{return null;}
}
const ROBOT_PAGES='<a href="../robot-essentials/index.html">robot essentials</a> or the <a href="../robot-logistics-workshop/index.html">robot logistics workshop</a>';

export async function buildSpaceLaunchPages({root=ROOT,rawPath=process.env.FACTORIO_RAW}={}){
 const records=await loadSpaceLaunch(root),by=Object.fromEntries(records.map(r=>[r.id,r]));
 const published=records.filter(r=>r.qualified&&r.id!==CIRCUITS),missing=records.filter(r=>!r.qualified&&r.id!==CIRCUITS);
 const modelFile=path.join(root,MODEL);let model;
 if(rawPath){model=await refreshModel(root,rawPath,records);await fs.mkdir(path.dirname(modelFile),{recursive:true});await fs.writeFile(modelFile,json(model)+'\n');}
 else model=JSON.parse(await fs.readFile(modelFile,'utf8'));
 const catalog=JSON.parse(await fs.readFile(path.join(root,'site/data/catalog.json'),'utf8')),iconPaths=new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.icon])),cache=new Map();
 const exists=f=>fs.access(f).then(()=>true,()=>false);
 async function icon(name){const id=ICON_ALIAS[name]||name;if(!cache.has(id)){let file=`assets/icons/${id}.png`;if(!await exists(path.join(root,'site',file)))file=iconPaths.get(id);if(!/^assets\/(?:icons|flight-icons)\/[\w.-]+\.png$/.test(file||''))throw Error(`Missing repository icon: ${id}`);const bytes=await fs.readFile(path.join(root,'site',file)),info=await sharp(bytes).metadata(),s=Math.min(64,info.width,info.height);cache.set(id,'data:image/png;base64,'+(await sharp(bytes).extract({left:0,top:0,width:s,height:s}).png().toBuffer()).toString('base64'));}return cache.get(id);}
 const chip=async id=>`<img class="item-icon" src="${await icon(id)}" alt=""> ${esc(pretty(id))}`;
 const firstLaunch=by['launch-kit'].qualified?await firstLaunchEvidence(root,by['launch-kit']):null;
 const links=interfaces(records),plan=by['white-platform'].qualified?rocketPlan(by['white-platform'],model.facts,by['launch-kit'].m.launch?.weightKg):null,built=[];
 const measuredIn=(r,p)=>{const res=r.evidence.result;return [...(res?.inputs||[]),...(res?.fluids||[])].find(x=>x.item===p.item)?.measuredPerMinute;};
 const linkRows=r=>links.filter(l=>l.consumer===r.id||l.supplier===r.id);
 const linkTable=rows=>table(['Supplier exit','Consumer entrance','Copies','Placement'],rows.map(l=>`<tr><th><a href="../${esc(l.supplier)}/index.html">${esc(l.supplierName)}</a></th><td>${esc(pretty(l.item))} → <a href="../${esc(l.consumer)}/index.html">${esc(l.consumerName)}</a> (row ${l.entranceRowFromTop} from its top)</td><td>${esc(l.copies)}</td><td>${esc(l.placement)}</td></tr>`));

 for(const r of published){
  const {m,code,bp,report,evidence}=r,res=evidence.result,platform=m.class==='platform';
  if(!prototypeMatches(m,model))throw Error(`${m.id}: preview prototype mismatch`);
  const f=platform?tileBounds(bp):footprint(bp,model);for(const key of ['left','top','right','bottom','width','height'])if(m.footprint?.[key]!==f[key])throw Error(`${m.id}: footprint mismatch ${key}`);
  const construction=counts(bp.entities.map(e=>e.name)),machines=counts(bp.entities.map(e=>e.recipe).filter(Boolean));
  if(JSON.stringify(Object.entries(construction).sort())!==JSON.stringify(Object.entries(m.construction||{}).sort()))throw Error(`${m.id}: construction mismatch`);
  const ports=groupPorts(m.ports||[...(m.inputs||[]),...(m.fluids||[]),...(m.outputs||[])]),marker=new Map(ports.map(p=>[p.entity,p.marker]));
  for(const p of ports)if(!bp.entities.some(e=>e.entity_number===p.entity))throw Error(`${m.id}: port references missing entity ${p.entity}`);
  const pos=p=>{const e=bp.entities.find(e=>e.entity_number===p.entity);return e?.position||p.position||p;};
  const svg=await layoutSvg(bp,model,ports,icon),out=path.join(root,'site',m.id);await fs.mkdir(out,{recursive:true});
  const pr=m.protocol||{},area=`${f.width} × ${f.height} = ${f.width*f.height} tiles`;
  let size,steps,inputs,outputs,protocol,extra='',reproduce;
  const machinesLine=`${construction['assembling-machine-2']||0} assembling machine 2${construction['chemical-plant']?` · ${construction['chemical-plant']} chemical plant${construction['chemical-plant']===1?'':'s'}`:''}`;
  reproduce=['export FACTORIO_RAW=<Factorio 2.1.24 Space Age data-raw-dump.json>',`node scripts/${m.id}/generate.mjs        # writes blueprint-sources/${m.id}/${m.file} and manifest.json`,`node --test tests/${m.id}.test.mjs`,`node scripts/${m.id}/validate.mjs        # full native protocol; needs a local Factorio 2.1.24 install, run headless with a private profile under .cache/${m.id}/`];
  if(m.class==='rate'||m.class==='kit'){
   size=`${area} · ${bp.entities.length} entities · ${machinesLine} · ${construction.substation||0} substation${construction.substation===1?'':'s'} · red transport · no modules`;
   steps=`<ol><li>Copy the import string, then use Factorio’s Import string.</li><li>Build every saved entity; keep filters, circuit wires, stock caps and chest settings as saved.</li><li>Feed each numbered entrance on the west with its labelled material at or above its panel figure, and connect electricity at P.</li><li>${m.class==='kit'?`Leave the kit in its sixteen east chests (passive provider chests) and cover them with the same roboport network as the rocket silo; the kit makes no roboports or logistic robots (see the ${ROBOT_PAGES}). Take out by hand only what you build on the ground: the rocket silo and the white-pack receiver's parts. The silo's robots take the starter pack and the platform parts from the chests. Each chest stops at its cap; take items out and exactly those are made again.</li><li>First launch: in a save that has never created a space platform, the asteroid collector and crusher recipes are locked until the first platform is created, so the kit fills ${firstLaunch?`${firstLaunch.full} of its ${firstLaunch.total}`:'all but those two of its'} chests and waits. Do not wait for a complete kit: place the silo and create the platform as soon as the silo and the starter pack are ready. The kit then makes the crusher and the four collectors by itself, and the last cargo rocket waits for them. The measured kit time below applies to a save where a platform already exists.`:m.outputs[0]?.transport==='belt'?'Run the east exit belt straight to its consumer. When the consumer stops taking, the exit holds 8 and the machines stop by themselves.':'Collect from the east chests. A full chest pauses that product on purpose.'}</li></ol>`;
  }
  if(m.class==='rate'){
   inputs=`<p>The panel figure is the supply this blueprint was qualified at: the native run fed every entrance at exactly that rate. Measured is what each entrance took during the ${esc(pr.measureMinutes)}-minute steady window.</p>`+table(['#','Material','Entrance','Side · position','Panel / min','Measured / min'],await Promise.all([...m.inputs,...(m.fluids||[])].map(async p=>`<tr><th>${esc(marker.get(p.entity)??'')}</th><td>${await chip(p.item)}</td><td>${p.kind==='fluid'?'Pipe':'Belt'}</td><td>${esc(p.externalSide||'west')} · (${pos(p).x}, ${pos(p).y})</td><td>${num(p.perMinute)}</td><td>${num(measuredIn(r,p))}</td></tr>`)));
   outputs=table(['Output','Exit or chest · position','Cap','Target / min','Measured / min','Recovery / min'],await Promise.all(m.outputs.map(async o=>`<tr><td>${await chip(o.item)}${m.products.includes(o.item)?'':' <span class="muted">(passes through)</span>'}</td><td>${esc(marker.get(o.entity)??'')} · ${o.transport==='belt'?'belt exit':'chest'} · (${pos(o).x}, ${pos(o).y})</td><td>${esc(m.outputCaps?.[o.item]??o.cap)}</td><td>${num(m.targets?.[o.item])}</td><td>${num(res.outputsPerMinute?.[o.item])}</td><td>${num(res.recovery?.outputsPerMinute?.[o.item])}</td></tr>`)));
   protocol=`${esc(pr.warmupMinutes)} min warm-up, ${esc(pr.measureMinutes)} min measured, ${esc(pr.blockedMinutes)} min blocked (collection stopped, entrances still fed), ${esc(pr.settleMinutes)} min settle, ${esc(pr.recoveryMinutes)} min recovery. Every entrance was fed at its panel figure, not saturated. Blocked: ${m.outputs.map(o=>`${pretty(o.item).toLowerCase()} ${o.transport==='belt'?'exit':'chest'} held exactly ${esc(o.cap)}`).join(', ')}, and no machine crafted in the last minute.`;
  }
  if(m.class==='kit'){
   const ent=new Map(res.entrances.map(e=>[e.item,e]));
   inputs=`<p>The kit has no rate. Its native run fed every entrance at its panel figure and measured how much of each material one whole kit took. <em>Per kit</em> is the recipe demand of one kit; <em>accepted</em> is what the entrance took from empty to a complete kit; <em>consumed</em> leaves out what still sat on belts, the ring and in pipes when the kit was done. Stone brick, sulfuric acid and lubricant are judged on consumed, because their entrance belt or pipes alone hold more than 15% of one kit.</p>`+table(['#','Material','Entrance · position','Panel / min','Per kit','Accepted per kit','Consumed per kit','Peak minute','Judged on'],await Promise.all([...m.inputs,...(m.fluids||[])].map(async p=>{const e=ent.get(p.item)||{};return `<tr><th>${esc(marker.get(p.entity)??'')}</th><td>${await chip(p.item)}</td><td>${p.kind==='fluid'?'Pipe':'Belt'} · (${pos(p).x}, ${pos(p).y})</td><td>${num(p.perMinute)}</td><td>${thousands(p.perKit)}</td><td>${thousands(e.measuredPerKit)} (${num(e.ratio)}×)</td><td>${thousands(e.consumedPerKit)} (${num(e.consumedRatio)}×)</td><td>${num(e.peakMinuteDraw)}</td><td>${esc(e.rule)}</td></tr>`;})));
   const billItems=new Map(records.bill.items.map(i=>[i.item,i]));
   outputs=`<p class="evidence matched">Kit complete from empty in <strong>${num(res.fill.kitMinutes)} minutes</strong> (limit ${esc(pr.kitLimitMinutes)}; every recipe unlocked, as in a save where a space platform already exists). Refill after removing ${esc(amounts(res.refill.removed))}: ${num(res.refill.minutes)} minutes. Holds of ${esc(pr.holdMinutes)} and ${esc(pr.longHoldMinutes)} minutes: ${res.hold.mismatches+res.longHold.mismatches} chest mismatches.</p>`+table(['Item','Chest · position','Cap','For the platform','For the receiver','Spare','Complete at minute'],await Promise.all(m.outputs.map(async o=>{const b=billItems.get(o.item)||{};return `<tr><td>${await chip(o.item)}</td><td>${esc(marker.get(o.entity)??'')} · (${pos(o).x}, ${pos(o).y})</td><td>${esc(m.outputCaps[o.item])}</td><td>${esc(b.platform??'—')}</td><td>${esc(b.receiver??'—')}</td><td>${esc(b.spare)}</td><td>${num(res.fill.completedMinute?.[o.item])}</td></tr>`;})));
   protocol=`Fill from empty within ${esc(pr.kitLimitMinutes)} minutes under throttled entrances; hold ${esc(pr.holdMinutes)} minutes (no craft in the last ${esc(pr.holdQuietMinutes)}); remove part of the kit and refill within ${esc(pr.refillLimitMinutes)} minutes; long hold ${esc(pr.longHoldMinutes)} minutes (no craft in the last ${esc(pr.longHoldQuietMinutes)}). The rocket silo, landing pad and starter pack were each crafted exactly once by the blueprint's own machines. Per-kit rule: ${esc(pr.perKitRule)}`;
  }
  if(m.class==='platform'){
   size=`${f.width} × ${f.height} rectangle · ${m.foundationTiles} foundation tiles (${m.newFoundationTiles} beyond the starter square) · ${bp.entities.length} entities including the hub · ${construction['asteroid-collector']} asteroid collectors · ${construction.crusher} crusher · ${construction['electric-furnace']} electric furnace · ${construction['assembling-machine-2']} assembling machine 2 · ${construction['solar-panel']} solar panels · ${construction.accumulator} accumulators · no modules`;
   steps=`<ol><li>Build the rocket silo inside a roboport network with logistic robots, and keep the starter pack and the platform parts in passive provider chests in that network (the <a href="../launch-kit/index.html">launch kit</a>'s chests are). Tick “Automatic requests from space platforms” on the silo once: it then takes its cargo from the logistic network, and cargo cannot be put in by hand while it is on.</li><li>On the silo click “Build new space platform”; in “New space platform” choose Nauvis as the planet and the space platform starter pack, then Create. The starter pack flies first.</li><li>Copy the import string and paste it anywhere on the platform. It contains the hub, so it snaps to the real hub. Do not use grid snapping.</li><li>Keep the hub’s “request missing construction materials” on (the blueprint sets it). The platform then asks rockets for exactly ${thousands(m.billOfMaterials.requestedWeightKg)} kg and builds itself. In a save that has never created a platform, the asteroid collector and crusher recipes unlock only now, so the last cargo rocket waits until the kit has made them.</li><li>Build the <a href="../white-pack-receiver/index.html">white-pack receiver</a> on Nauvis; packs come down with no click.</li></ol>`;
   inputs=`<p>No supplied inputs. The four asteroid collectors catch chunks in Nauvis orbit, which sends only chunks, never asteroids, so the platform needs no defence. The crusher's recipe is set by the circuit clock (oxide, metallic, carbonic in turn). Steady flows inside, measured: ${num(res.steady.orePerMinute)} iron ore, ${num(res.steady.carbonPerMinute)} carbon, ${num(res.steady.icePerMinute)} ice and ${num(res.steady.platePerMinute)} iron plates per minute.</p><p>Power: ${esc(m.power?.solarPanels)} solar panels and ${esc(m.power?.accumulators)} accumulators. Measured average ${num(res.power.averageKw)} kW, peak ${num(res.power.peakKw)} kW, lowest accumulator ${num(res.power.lowestAccumulatorMJ)} of 5 MJ, ${res.power.lowPowerTicks} low-power ticks.</p>`;
   const hub=m.outputs[0];
   outputs=table(['Output','Where','Cap','Target / min','Made / min','Collected / min','Recovery made / min'],[`<tr><td>${await chip('space-science-pack')}</td><td>Hub · (${hub.x}, ${hub.y})</td><td>${esc(hub.cap)} (ceiling ${esc(hub.ceiling)})</td><td>${num(m.targets['space-science-pack'])}</td><td>${num(res.steady.madePerMinute)}</td><td>${num(res.steady.collectedPerMinute)}</td><td>${num(res.recovery.madePerMinute)}</td></tr>`])+`<p>Collected is what reached the receiver's chest on Nauvis. With the chest not emptied, the chest stopped at ${esc(res.blocked.chest)}, the pad at ${esc(res.blocked.pad)} and the hub at ${esc(res.blocked.hubPacks)} packs, and no pack was crafted in the hold. Built from ghosts in ${num(res.build.seconds)} s; first pod ${num(res.firstPodSecondsAfterBuild)} s after the build.</p>`;
   protocol=`One end-to-end run on map seed ${esc(report.seed)}: a real platform from a starter pack in Nauvis orbit, only the platform request placed in the hub, the blueprint pasted as ghosts and built by the hub, natural chunks only. ${esc(pr.warmupMinutes)} min warm-up, ${esc(pr.measureMinutes)} min measured, ${esc(pr.blockedMinutes)} min blocked with a ${esc(pr.holdMinutes)}-minute hold, ${esc(pr.recoveryMinutes)} min recovery (last ${esc(pr.recoveryMeasuredMinutes)} measured). A second run, the rocket-delivery check, used a real silo with chests holding exactly the starter pack and the platform request.`;
   extra=`<section id="rockets"><h2>Rockets</h2><p>The platform asks for exactly ${thousands(plan.requestedWeightKg)} kg: ${plan.cargoRockets} full cargo rockets after the starter pack's own rocket, ${plan.totalRockets} launches in all. Rockets leave only when full (${thousands(plan.rocketLiftKg)} kg). The rocket-delivery check measured ${plan.measuredLaunches} launches and a finished platform ${num(plan.builtMinutes)} minutes after an empty start.</p>${rocketTable(plan)}<p>Each rocket takes ${plan.partsPerRocket} rocket parts: ${esc(amounts(plan.perRocket))}. The whole campaign uses ${esc(amounts(plan.campaign))}.</p></section>`;
   reproduce=['export FACTORIO_RAW=<Factorio 2.1.24 Space Age data-raw-dump.json>','node scripts/white-platform/generate.mjs        # writes the platform string and manifest','node scripts/white-pack-receiver/generate.mjs','node --test tests/white-platform.test.mjs tests/white-pack-receiver.test.mjs','node scripts/white-platform/validate.mjs        # one end-to-end run qualifies the platform and the receiver; needs a local Factorio 2.1.24 install, headless with a private profile under .cache/white-platform/'];
  }
  if(m.class==='receiver'){
   size=`${area} · ${bp.entities.length} entities: ${esc(amounts(construction))}`;
   steps=`<ol><li>Copy the import string and build it on Nauvis, under the <a href="../white-platform/index.html">white-pack platform</a>.</li><li>A planet allows one cargo landing pad. If you already have one, add a request for 1,000 space science packs to it and build only the inserter, chest and substation next to it.</li><li>Connect electricity at P. The platform drops a cargo pod every 30 seconds with what the pad lacks; no click is needed.</li><li>Take packs from the chest (robots or by hand). It stops at its cap and everything resumes when packs are taken.</li></ol>`;
   inputs=`<p>Space science packs from the platform in orbit, by cargo pod. The pad requests ${esc(m.stockControl?.padRequest)} packs. No belt or pipe entrance.</p>`;
   const chest=m.outputs[0];
   outputs=table(['Output','Where','Cap','Target / min','Collected / min','Recovery / min'],[`<tr><td>${await chip('space-science-pack')}</td><td>${esc(marker.get(chest.entity)??'')} · chest · (${pos(chest).x}, ${pos(chest).y})</td><td>${esc(chest.cap)}</td><td>${num(m.deliveryTarget['space-science-pack'])}</td><td>${num(res.steady.collectedPerMinute)}</td><td>${num(res.recovery.collectedPerMinute)}</td></tr>`])+`<p>Recovery is higher than 60 while the backlog held in the pad and hub drains. With the chest not emptied it stopped at exactly ${esc(res.blocked.chest)} (never above) and the pad at ${esc(res.blocked.pad)}. First pod ${num(res.firstPodSecondsAfterBuild)} s after the platform was built.</p>`;
   protocol=`Qualified by the same end-to-end run as the <a href="../white-platform/index.html">white-pack platform</a> (map seed ${esc(report.seed)}): no scripted transfer, the pad's request read back after import, one pad on Nauvis. ${esc(pr.measureMinutes)} min measured, ${esc(pr.blockedMinutes)} min blocked, ${esc(pr.recoveryMinutes)} min recovery.`;
   reproduce=['export FACTORIO_RAW=<Factorio 2.1.24 Space Age data-raw-dump.json>','node scripts/white-pack-receiver/generate.mjs','node --test tests/white-pack-receiver.test.mjs','node scripts/white-pack-receiver/validate.mjs        # runs the white-platform end-to-end harness and checks this report'];
  }
  const rel=linkRows(r);
  if(rel.length)extra+=`<section id="links"><h2>Supplier links</h2>${linkTable(rel)}</section>`;
  const filesExtra={};
  if(m.id==='rocket-supplies'&&await exists(path.join(root,'blueprint-sources/rocket-supplies/above-panels.json'))){filesExtra['above-panels.json']=await fs.readFile(path.join(root,'blueprint-sources/rocket-supplies/above-panels.json'),'utf8');extra+=`<p>Runs above the panel figures on the same string: <a href="above-panels.json">above-panels.json</a>.</p>`;}
  const notes=(m.setupNotes||[]).map(n=>`<li>${esc(n)}</li>`).join('');
  const html=`<html><head><title>${esc(m.name)}</title><style>${STYLE}${EXTRA}</style></head><body><aside><a href="#import">Import &amp; layout</a><a href="#inputs">Inputs</a><a href="#outputs">Outputs &amp; measured</a>${plan&&platform?'<a href="#rockets">Rockets</a>':''}${rel.length?'<a href="#links">Supplier links</a>':''}<a href="#reproduce">Reproduce</a></aside><main><div class="workshop-guide" data-page="${esc(m.id)}"><p class="eyebrow">SPACE LAUNCH · 21 NOVEMBER 2026 · EXACT SAVED LAYOUT</p><h1>${esc(m.name)}</h1><p class="lede">${esc(LEDE[m.id])}</p><p class="evidence matched" data-evidence="matched">Native ${m.class==='rate'?'production':m.class} test passed · ${esc(evidence.reason)}</p><p>${size}</p><p><a href="../space-launch/index.html">← Space launch path</a> · <a href="../index.html?collection=space-launch#blueprints">Open in the library</a></p><section id="import"><h2>Import &amp; build</h2>${steps}<div class="actions"><a class="button primary" href="${esc(m.file)}" download>Download import</a><button id="copy-import">Copy import</button><a class="button" href="layout.svg">Full-size SVG</a><button data-zoom="fit">Fit layout</button><button data-zoom="detail">Tile detail</button></div><p id="copy-status" role="status" aria-live="polite"></p><div class="layout-map" tabindex="0"><img src="layout.svg" alt="Exact saved ${esc(m.name)} layout with numbered connections"></div><p class="muted">Schematic of the saved entity positions${platform?' on their foundation tiles (grey squares)':''}. Arrows show direction, dashed pale lines join underground belts, gold lines are power wires and red/green lines are circuit wires. Blue markers are entrances, green markers are outputs, P is electricity.</p><details id="import-details"><summary>Complete import string · manual offline copy</summary><textarea id="import-code" readonly aria-label="Complete blueprint import string">${esc(code)}</textarea></details></section><section id="inputs"><h2>Inputs</h2>${inputs}</section><section id="outputs"><h2>Outputs &amp; measured results</h2>${outputs}<p>Protocol: ${protocol}</p><h3>Setup notes</h3><ul>${notes}</ul></section>${extra}<section id="reproduce"><h2>Reproduce</h2><p>From <code>factorio-command-center/</code> in the source repository:</p><pre><code>${reproduce.map(esc).join('\n')}</code></pre></section><details><summary>Construction, machines &amp; exact identity</summary><h3>Construction materials · entity counts</h3>${table(['Entity','Count'],[...Object.entries(construction).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`),...(bp.tiles?.length?[`<tr><th>Space platform foundation (tiles)</th><td>${bp.tiles.length}</td></tr>`]:[])])}<h3>Machines per saved recipe</h3>${table(['Recipe','Machines'],Object.entries(machines).sort().map(([id,n])=>`<tr><th>${esc(pretty(id))}</th><td>${n}</td></tr>`))}<p class="hash">Blueprint SHA-256: ${esc(m.blueprintSha256)}<br>Prototype SHA-256: ${esc(m.prototypeSha256)}</p><p><a href="manifest.json">Source manifest</a> · <a href="native-report.json">Native report</a> · <a href="README.md">Offline notes</a></p></details></div></main><script>${SCRIPT}</script></body></html>`;
  const files={'index.html':renderFlightPlanPage(html,{page:'space-launch',rootPrefix:'../'}),'layout.svg':svg,[m.file]:code+'\n','manifest.json':json([m])+'\n','native-report.json':json(report)+'\n',...filesExtra,'README.md':`# ${m.name}\n\nOpen index.html from disk; it needs only the parent site's styles.css, flight-plans.css, flight-plans.js and assets. No network or game install is needed.\n\nRegenerate: node scripts/space-launch-pages.mjs (from factorio-command-center/).\n\nBlueprint SHA-256 ${m.blueprintSha256}; native report passed for this exact string.\n`};
  for(const [file,value] of Object.entries(files))await fs.writeFile(path.join(out,file),value);
  built.push({id:m.id,footprint:f});
 }

 // Landing page: the path, the interfaces, the kit list, the rocket plan and one book.
 const bookRecords=BOOK_ORDER.map(id=>by[id]).filter(r=>r.qualified);
 const book={blueprint_book:{item:'blueprint-book',label:'Space launch · '+bookRecords.length+' builds',active_index:0,version:bookRecords[0]?.bp.version,blueprints:bookRecords.map((r,index)=>({index,blueprint:r.bp}))}};
 const bookCode=encodeBlueprint(book),landing=path.join(root,'site/space-launch');await fs.mkdir(landing,{recursive:true});
 const copyBox=r=>`<div class="actions"><button data-copy="${esc(r.id)}">Copy import</button><a class="button primary" href="../${esc(r.id)}/index.html">Guide</a><a class="button" href="../${esc(r.id)}/native-report.json">Native report</a></div><details><summary>Import string</summary><textarea id="code-${esc(r.id)}" readonly aria-label="${esc(r.m.name)} import string">${esc(r.code)}</textarea></details><p class="hash">SHA-256 ${esc(r.m.blueprintSha256)}</p>`;
 const notQualified=id=>`<p class="evidence pending">${esc(by[id].m.name)} is not qualified in this round: ${esc(by[id].reason)} Its import string is not published.</p>`;
 const ent=async r=>{const res=r.evidence.result;
  if(r.m.class==='kit'){const e=new Map(res.entrances.map(x=>[x.item,x]));return table(['Entrance','Row','Panel / min','Peak minute draw','Per kit','Accepted per kit'],await Promise.all([...r.m.inputs,...(r.m.fluids||[])].map(async p=>`<tr><td>${await chip(p.item)}</td><td>${rowOf(r.m,p)}</td><td>${num(p.perMinute)}</td><td>${num(e.get(p.item)?.peakMinuteDraw)}</td><td>${thousands(p.perKit)}</td><td>${thousands(e.get(p.item)?.measuredPerKit)}</td></tr>`)));}
  return table(['Entrance','Row','Panel / min','Measured / min'],await Promise.all([...r.m.inputs,...(r.m.fluids||[])].map(async p=>`<tr><td>${await chip(p.item)}</td><td>${rowOf(r.m,p)}</td><td>${num(p.perMinute)}</td><td>${num(measuredIn(r,p))}</td></tr>`)));};
 const outRate=async r=>{const res=r.evidence.result;return table(['Output','Cap','Target / min','Measured / min','Recovery / min'],await Promise.all(r.m.outputs.map(async o=>`<tr><td>${await chip(o.item)}${r.m.products.includes(o.item)?'':' (passes through)'}</td><td>${esc(o.cap)}${o.transport==='belt'?' on the exit belt':''}</td><td>${num(r.m.targets?.[o.item])}</td><td>${num(res.outputsPerMinute?.[o.item])}</td><td>${num(res.recovery?.outputsPerMinute?.[o.item])}</td></tr>`)));};
 const card=async (r,body='')=>r.qualified?`<article class="essentials-card" id="${esc(r.id)}" data-build-id="${esc(r.id)}"><h3>${esc(r.m.name)}</h3><p>${r.m.footprint.width} × ${r.m.footprint.height} = ${r.m.footprint.width*r.m.footprint.height} tiles${r.m.class==='platform'?` rectangle, ${r.m.foundationTiles} of them foundation`:''}</p>${body}${copyBox(r)}</article>`:notQualified(r.id);
 const step=(n,id,title,body)=>`<section class="step" id="${id}"><h2><span class="step-number">${n}</span> ${title}</h2>${body}</section>`;
 const circuits=by[CIRCUITS],concrete=by['concrete-supplier'],fuel=by['rocket-fuel-supplier'],kit=by['launch-kit'],supplies=by['rocket-supplies'],platform=by['white-platform'],receiver=by['white-pack-receiver'];
 const interfaceTable=`<p>Every link is one straight red belt. Rows count from each blueprint's own top row (0 is the top row). Supplier: target and measured per minute. Consumer: panel figure and measured draw per minute (the kit's is its busiest minute).</p>`+table(['Supplier exit','Consumer entrance','Supplier / min','Consumer / min','Copies','Placement'],links.map(l=>`<tr><th>${l.supplierQualified?`<a href="../${esc(l.supplier)}/index.html">${esc(SHORT[l.supplier])}</a>`:esc(SHORT[l.supplier])}, row ${l.exitRowFromTop}</th><td>${esc(SHORT[l.consumer])}: ${esc(pretty(l.item).toLowerCase())}, row ${l.entranceRowFromTop}</td><td class="nowrap">${num(l.supplierPerMinute)} / ${num(l.supplierMeasured)}</td><td class="nowrap">${num(l.panelPerMinute)} / ${num(l.measuredPerMinute)}</td><td>${esc(l.copies)}</td><td>${esc(l.placement)}</td></tr>`));
 const circuitDemand=links.filter(l=>l.supplier===CIRCUITS).reduce((a,l)=>a+l.panelPerMinute,0),circuitCopies=Math.ceil(circuitDemand/(circuits.m.targets['electronic-circuit']||360));
 const billRows=await Promise.all(records.bill.items.map(async i=>`<tr><td>${await chip(i.item)}</td><td>${esc(i.platform??'—')}</td><td>${esc(i.receiver??'—')}</td><td>${esc(i.count)}</td><td>${esc(i.spare)}</td><td>${esc(kit.m.outputCaps?.[i.item])}</td></tr>`));
 const kitRes=kit.qualified?kit.evidence.result:null;
 const s1=step(1,'suppliers','Build the suppliers',`<p>One green-circuit supplier, one concrete supplier and one rocket-fuel supplier. Each ends in a red belt exit on its east side that holds 8 and stops the machines when its consumer stops taking.</p>${circuits.qualified?`<article class="essentials-card" id="${CIRCUITS}"><h3>${esc(circuits.m.name)} <span class="muted">(essentials round)</span></h3><p>${circuits.m.footprint.width} × ${circuits.m.footprint.height} tiles · exit on row ${rowOf(circuits.m,circuits.m.outputs[0])} · ${num(circuits.evidence.result?.outputsPerMinute?.['electronic-circuit'])} circuits per minute measured. One copy covers the launch kit (${num(links.find(l=>l.supplier===CIRCUITS&&l.consumer==='launch-kit')?.panelPerMinute)} per minute) and rocket supplies (${num(links.find(l=>l.supplier===CIRCUITS&&l.consumer==='rocket-supplies')?.panelPerMinute)} per minute) together: ${num(circuitDemand)} of ${num(circuits.m.targets['electronic-circuit'])}. Split its exit belt between them.</p>${copyBox(circuits)}</article>`:notQualified(CIRCUITS)}${await card(concrete,concrete.qualified?(await ent(concrete))+(await outRate(concrete)):'')}${await card(fuel,fuel.qualified?(await ent(fuel))+(await outRate(fuel)):'')}<h3>How they connect</h3>${interfaceTable}`);
 const s2=step(2,'factories','Build the launch kit and rocket supplies',`<p>Connect the supplier belts from step 1, the other belts and pipes at their panel figures, and electricity at each substation marked P on the guides.</p>${await card(kit,kit.qualified?`<p class="evidence matched">Measured: a complete kit from empty in <strong>${num(kitRes.fill.kitMinutes)} minutes</strong>, fed at the panel figures, in a save where a space platform already exists. On a first launch the kit cannot finish before the platform exists; see step 3. What one kit consumes:</p>${await ent(kit)}`:'')}${await card(supplies,supplies.qualified?(await ent(supplies))+(await outRate(supplies))+`<p>${esc(supplies.m.setupNotes.find(n=>/copper at 150/.test(n))||'')}</p>`:'')}`);
 const groundParts=records.bill.items.filter(i=>i.receiver>0).map(i=>`${i.receiver} ${pretty(i.item).toLowerCase()}`).join(', ');
 const firstLaunchNote=kit.qualified?`<p class="evidence pending" id="first-launch"><strong>First launch.</strong> In a save that has never created a space platform, the asteroid collector and crusher recipes are still locked: creating the first platform unlocks them. The kit then fills ${firstLaunch?`${firstLaunch.full} of its ${firstLaunch.total} chests and waits (in an exploration run of this string the starter pack was ready at ${one(firstLaunch.starter)} minutes and the rocket silo, last, at ${one(firstLaunch.silo)} minutes)`:'every chest but those two and waits'}. Do not wait for a complete kit: go on to steps 4 and 5 as soon as the silo and the starter pack are in their chests. Once the platform is created the kit makes the crusher and the four collectors by itself${firstLaunch?` (in a second run with the recipes unlocked at minute ${num(firstLaunch.unlock)}, the crusher was done ${Math.round((firstLaunch.crusher-firstLaunch.unlock)*60)} seconds later and the fourth collector ${one(firstLaunch.collectors-firstLaunch.unlock)} minutes later)`:''}, and the last cargo rocket waits for them. The ${num(kitRes.fill.kitMinutes)} minutes in step 2 is for a save where a platform already exists.</p>`:'';
 const s3=step(3,'kit','Take the ground parts from the kit',kit.qualified?`<p>Sixteen passive provider chests on the kit's east side, one item each, filled to the cap and then stopped. The counts come from the qualified platform and receiver strings (SHA-256 ${esc(records.bill.sources['white-platform'].slice(0,12))}… and ${esc(records.bill.sources['white-pack-receiver'].slice(0,12))}…). ${esc(records.bill.spareRule)}.</p><p><strong>Take out only what you build on the ground:</strong> the rocket silo and the receiver's parts (${esc(groundParts)}). Leave the starter pack and the platform parts in the kit's chests; the silo's robots collect them from there (step 4). Whatever you take out, the kit makes again.</p>${firstLaunchNote}${table(['Item','For the platform','For the receiver','Count','Spare','Chest cap'],billRows)}<p>The starter pack itself brings ${esc(platform.m.billOfMaterials.starterPackProvides?.['space-platform-foundation'])} foundation (100 placed and 10 in the hub), so the platform asks for ${esc(platform.m.billOfMaterials.platformRequest['space-platform-foundation'])} more.</p>`:notQualified('launch-kit'));
 const s4=step(4,'silo','Place the rocket silo',`<p>Place the silo from the kit and tick <strong>“Automatic requests from space platforms”</strong> on it once; it is off by default. With it on, the silo takes its cargo from the local logistic network, so <strong id="robot-network">the rocket silo and the kit's chests must be inside one roboport network with logistic robots</strong>. The kit makes no roboports, logistic robots or requester chests: build them first, for example from the ${ROBOT_PAGES}. Cargo cannot be put into the silo by hand while the setting is on.</p><p>Feed the silo from the three rocket-supplies chests: with robots (a requester chest and an inserter for each, with the rocket-supplies chests in the same network) or by hand.${plan?` One rocket takes ${plan.partsPerRocket} rocket parts: ${esc(amounts(plan.perRocket))}.`:''} The chests hold 400 of each, so they can stock the campaign before the silo is built.</p>`);
 const s5=step(5,'platform','Create the space platform',`<p>On the silo, click <strong>“Build new space platform”</strong>. In “New space platform” choose Nauvis as the planet and the space platform starter pack, then <strong>Create</strong>. The silo's robots bring the starter pack from the kit's chest and the silo launches it first, in its own rocket. Creating the first platform unlocks the asteroid collector and crusher recipes: on a first launch the kit makes them now, and the last cargo rocket waits for them.</p>`);
 const s6=step(6,'paste','Paste the white-science platform',platform.qualified?`${await card(platform,`<p>Paste it anywhere on the platform: it contains the hub and snaps to the real hub. Keep the hub's “request missing construction materials” on. The platform asks for exactly ${thousands(plan.requestedWeightKg)} kg, so rockets launch full and nothing is left over.</p>${rocketTable(plan)}<p><strong>${plan.totalRockets} rockets in all</strong> (the starter pack's rocket and ${plan.cargoRockets} cargo rockets), measured in the rocket-delivery check: ${plan.measuredLaunches} launches and a finished platform ${num(plan.builtMinutes)} minutes after an empty start. The campaign uses ${esc(amounts(plan.campaign))}. Nothing flies after that: the packs come down in cargo pods, not rockets.</p>`)}`:notQualified('white-platform'));
 const s7=step(7,'receiver','Build the white-pack receiver',receiver.qualified?await card(receiver,`<p>On Nauvis. A planet allows one cargo landing pad: if you already have one, add a request for 1,000 space science packs to it and build only the inserter, chest and substation.</p>`):notQualified('white-pack-receiver'));
 const pr=platform.qualified?platform.evidence.result:null,rr=receiver.qualified?receiver.evidence.result:null;
 const s8=step(8,'packs','Packs arrive',pr&&rr?`<p class="evidence matched">Measured over ${esc(platform.m.protocol.measureMinutes)} minutes: <strong>${num(rr.steady.collectedPerMinute)} space science packs per minute</strong> into the receiver's chest (${num(pr.steady.madePerMinute)} made in orbit). First pod ${num(rr.firstPodSecondsAfterBuild)} s after the platform was built. With the chest not emptied it stops at ${esc(rr.blocked.chest)}, the pad at ${esc(rr.blocked.pad)} and the hub at ${esc(pr.blocked.hubPacks)} (cap ${esc(platform.m.outputs[0].cap)}, ceiling ${esc(platform.m.outputs[0].ceiling)}); no pack is crafted while it holds, and everything resumes by itself when packs are taken.</p>`:`<p class="evidence pending">No measured delivery: the platform or the receiver is not qualified in this round.</p>`);
 const landingHtml=`<html><head><title>Space launch builds</title><style>${STYLE}${EXTRA}</style></head><body><aside><a href="#book">Blueprint book</a><a href="#suppliers">1 · Suppliers</a><a href="#factories">2 · Kit and rocket supplies</a><a href="#kit">3 · Ground parts</a><a href="#silo">4 · Rocket silo</a><a href="#platform">5 · Create the platform</a><a href="#paste">6 · Paste the platform</a><a href="#receiver">7 · Receiver</a><a href="#packs">8 · Packs arrive</a></aside><main><div class="workshop-guide" data-page="space-launch"><p class="eyebrow">SPACE LAUNCH · 21 NOVEMBER 2026</p><h1>Space launch builds</h1><p class="lede">From the ground to ${pr?num(pr.steady.madePerMinute):'—'} space science packs a minute in Nauvis orbit, in eight steps. ${published.length===SPACE_IDS.length?'All six':WORDS[published.length]} blueprint${published.length===1?'':'s'} of this round passed the full native protocol for ${published.length===1?'its':'their'} exact SHA-256, plus the green-circuit supplier from the <a href="../essentials/index.html">essentials round</a>.</p><p><a class="button primary" href="../index.html?collection=space-launch#blueprints">Open the space launch builds in the library →</a></p><section id="book"><h2>Blueprint book</h2><p>One book with ${bookRecords.length} imports in this order: ${bookRecords.map(r=>esc(SHORT[r.id])).join(', ')}. Each page is the same string as its standalone import.</p><div class="actions"><button data-copy="book">Copy book</button><a class="button" href="space-launch-book.txt" download>Download book</a></div><details><summary>Book import string</summary><textarea id="code-book" readonly aria-label="Space launch blueprint book import string">${esc(bookCode)}</textarea></details><p id="copy-status" role="status" aria-live="polite"></p></section>${s1}${s2}${s3}${s4}${s5}${s6}${s7}${s8}${missing.length?`<section id="not-qualified"><h2>Not qualified in this round</h2><ul>${missing.map(r=>`<li>${esc(r.m.name)}: ${esc(r.reason)}</li>`).join('')}</ul></section>`:''}</div></main><script>${LANDING_SCRIPT}</script></body></html>`;
 await fs.writeFile(path.join(landing,'index.html'),renderFlightPlanPage(landingHtml,{page:'space-launch',rootPrefix:'../'}));
 await fs.writeFile(path.join(landing,'space-launch-book.txt'),bookCode+'\n');
 const data={releaseGroup:SPACE_RELEASE,published:published.map(r=>({id:r.id,name:r.m.name,class:r.m.class,blueprintSha256:r.m.blueprintSha256,footprint:r.m.footprint,page:r.id+'/index.html'})),notPublished:missing.map(r=>({id:r.id,reason:r.reason})),interfaces:links.map(({supplier,consumer,item,copies,panelPerMinute,measuredPerMinute,entranceRowFromTop,exitRowFromTop,placement})=>({supplier,consumer,item,copies,panelPerMinute,measuredPerMinute,entranceRowFromTop,exitRowFromTop,placement})),greenCircuits:{demandPerMinute:circuitDemand,copies:circuitCopies},kit:kit.qualified?{minutes:kitRes.fill.kitMinutes,items:records.bill.items}:null,rocketPlan:plan,book:{file:'space-launch/space-launch-book.txt',sha256:hash(bookCode),blueprints:bookRecords.map(r=>r.id)}};
 await fs.writeFile(path.join(landing,'data.json'),json(data)+'\n');
 return {built,notPublished:data.notPublished,greenCircuits:data.greenCircuits,rockets:plan&&{total:plan.totalRockets,campaign:plan.campaign},bookSha256:hash(bookCode)};
}
const rocketTable=plan=>table(['#','Cargo, as launched in the rocket-delivery check','kg'],plan.rockets.map(x=>`<tr><th>${x.rocket}</th><td>${esc(amounts(x.measured||x.cargo))}</td><td class="nowrap">${thousands(x.measuredKg??x.weightKg)}</td></tr>`));
const WORDS=['No','One','Two','Three','Four','Five','Six'];
const EXTRA=`.essentials-card{border:1px solid #465249;border-radius:6px;padding:4px 18px 14px;margin:24px 0;background:#1b2621}pre{overflow:auto;background:#192720;padding:12px;border-radius:5px}.nowrap{white-space:nowrap}#suppliers .table-scroll th:first-child{min-width:8.5em}.step h2{display:flex;gap:12px;align-items:center}.step-number{display:inline-grid;place-items:center;min-width:1.6em;height:1.6em;border-radius:50%;background:#547449;font-size:.9em}`;
const LANDING_SCRIPT=`document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const t=document.getElementById('code-'+b.dataset.copy),s=document.getElementById('copy-status');try{if(location.protocol==='file:'||!navigator.clipboard?.writeText)throw Error('manual');await navigator.clipboard.writeText(t.value);s.textContent='Copied';}catch{t.closest('details').open=true;t.focus();t.select();s.textContent='Import selected — press Ctrl+C or Command+C to copy';}}));`;
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildSpaceLaunchPages(),null,2));
