// Publish modded flight artifacts separately from the vanilla catalogue.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {deflateSync} from 'node:zlib';
import {blueprintPreview} from './blueprint-preview.mjs';
import {matchFactoryEvidence} from './flight-factory-evidence.mjs';
import {compareNativeEvidence} from './flight-evidence-selection.mjs';
import {readLoadedEnvironment} from './flight-native-availability.mjs';
const root=path.resolve('blueprint-sources/flight-factories');
const rawPath=path.resolve('.cache/flight-game/script-output/data-raw-dump.json');
const rawText=await fs.readFile(rawPath,'utf8'),raw=JSON.parse(rawText);
const prototypeSha256=createHash('sha256').update(rawText).digest('hex');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
const specs=JSON.parse(await fs.readFile(path.join(root,'native-test-specs.json'),'utf8'));
const specsById=new Map(specs.factories.map(s=>[s.id,s]));
if(manifest.prototypeSha256!==prototypeSha256)throw new Error('Manifest does not match installed prototype snapshot');
const nativeMap=JSON.parse(await fs.readFile('flight-map/native-report.json','utf8'));
const loadedMapBytes=await fs.readFile('flight-map/native-loaded-save-report.json');
const loadedMap=JSON.parse(loadedMapBytes);
await readLoadedEnvironment();
if(!loadedMap.passed||loadedMap.saveSha256!==nativeMap.saveSha256||loadedMap.prototypeSha256!==prototypeSha256||createHash('sha256').update(loadedMapBytes).digest('hex')!==nativeMap.loadedSaveValidation?.sha256)throw Error('Map needs matching loaded-state evidence before publication');
await fs.mkdir('site/sources/flight-map',{recursive:true});
for(const file of ['native-report.json','native-loaded-save-report.json','native-max-resources-report.json'])await fs.copyFile('flight-map/'+file,'site/sources/flight-map/'+file);

const availabilityRoot='.cache/flight-native/availability';
const availabilityDirs=(await fs.readdir(availabilityRoot,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
let availabilityManifest;
for(const dir of availabilityDirs){const candidate=JSON.parse(await fs.readFile(path.join(availabilityRoot,dir,'bindings.json'),'utf8'));if(candidate.proofSha256===nativeMap.loadedSaveValidation.sha256){availabilityManifest=candidate;break;}}
if(!availabilityManifest)throw Error('Run node scripts/flight-native-availability.mjs against the corrected loaded map before export');
const availabilityByReport=new Map(availabilityManifest.bindings.map(b=>[b.originalReportSha256,b]));
const app=path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents/data');
const mods=path.resolve('.cache/flight-game/mods');
const archives=new Map();
for(const name of await fs.readdir(mods))if(name.endsWith('.zip')){
 const entries=execFileSync('unzip',['-Z1',path.join(mods,name)],{encoding:'utf8'}).trim().split('\n');
 const infoName=entries.find(n=>n.split('/').length===2&&n.endsWith('/info.json'));
 if(!infoName)continue;
 const info=JSON.parse(execFileSync('unzip',['-p',path.join(mods,name),infoName],{encoding:'utf8'}));
 const old=archives.get(info.name);
 if(!old||info.version.localeCompare(old.version,undefined,{numeric:true})>0)archives.set(info.name,{file:path.join(mods,name),entries,version:info.version});
}
const locale={};
function parseLocale(text){let section='';for(const line of text.split(/\r?\n/)){if(line.startsWith('['))section=line.slice(1,-1);else if(line.includes('=')){const at=line.indexOf('=');locale[section+'.'+line.slice(0,at)]=line.slice(at+1);}}}
for(const mod of ['core','base','space-age','quality','elevated-rails'])for(const file of await fs.readdir(path.join(app,mod,'locale/en')).catch(()=>[]))if(file.endsWith('.cfg'))parseLocale(await fs.readFile(path.join(app,mod,'locale/en',file),'utf8'));
for(const archive of archives.values())for(const name of archive.entries.filter(n=>n.includes('/locale/en/')&&n.endsWith('.cfg')))parseLocale(execFileSync('unzip',['-p',archive.file,name],{encoding:'utf8'}));
const title=id=>id.split('-').map(s=>s[0]?.toUpperCase()+s.slice(1)).join(' ');
const nameOf=(id,p)=>locale[p?.localised_name?.[0]]||locale['item-name.'+id]||locale['fluid-name.'+id]||locale['entity-name.'+id]||title(id);
const prototypes=new Map();for(const group of Object.values(raw))for(const p of Object.values(group))if(p.stack_size!==undefined||p.type==='fluid')prototypes.set(p.name,p);
const icons={};
async function sprite(filename){const match=/^__([^_]+)__\/(.+)$/.exec(filename);if(!match)throw Error('Unsupported sprite '+filename);const[,mod,relative]=match;try{return await fs.readFile(path.join(app,mod,relative));}catch{const a=archives.get(mod),entry=a?.entries.find(n=>n.endsWith('/'+relative));if(!entry)throw Error('Missing icon '+filename);return execFileSync('unzip',['-p',a.file,entry],{maxBuffer:16*1024*1024});}}
await fs.mkdir('site/assets/flight-icons',{recursive:true});
for(const[id,p]of prototypes){const layers=p.icons||(p.icon?[{icon:p.icon,icon_size:p.icon_size}]:[]);if(!layers.length)continue;
 try{const composites=[];for(const layer of layers){const input=await sprite(layer.icon),meta=await sharp(input).metadata(),size=Math.min(layer.icon_size||p.icon_size||64,meta.width,meta.height),display=Math.max(1,Math.min(64,Math.round(size*(layer.scale??32/size)*2)));let img=sharp(input).extract({left:0,top:0,width:size,height:size}).resize(display,display).ensureAlpha();if(layer.tint){const t=layer.tint;img=img.linear([t.r??t[0]??1,t.g??t[1]??1,t.b??t[2]??1,t.a??t[3]??1],[0,0,0,0]);}const shift=layer.shift||[];composites.push({input:await img.png().toBuffer(),left:Math.max(0,Math.min(64-display,Math.round((64-display)/2+(shift[0]||shift.x||0)*2))),top:Math.max(0,Math.min(64-display,Math.round((64-display)/2+(shift[1]||shift.y||0)*2)))});}const file=`assets/flight-icons/${id}.png`;await sharp({create:{width:64,height:64,channels:4,background:'#00000000'}}).composite(composites).png().toFile('site/'+file);icons[id]=file;}catch(e){console.warn('Icon omitted:',id,e.message);}
}
// Manifest adaptation is implemented below after generation schema is finalized.
const dest=path.resolve('site/sources/flight-factories');
// This directory is generated exclusively here. Remove stale/withheld downloads.
await fs.rm(dest,{recursive:true,force:true});await fs.mkdir(dest,{recursive:true});
const rendererHash=createHash('sha256').update(await fs.readFile('scripts/blueprint-preview.mjs')).digest('hex').slice(0,8);
const entityDefs={entities:{}};for(const group of Object.values(raw))for(const p of Object.values(group))if(p.collision_box||p.selection_box)entityDefs.entities[p.name]={type:p.type,size:p.collision_box||p.selection_box};
const eligible=i=>i.eligibleRecipeProduct!==undefined?i.eligibleRecipeProduct:Boolean(i.recipeIds?.length);
const items=manifest.items.filter(eligible).map(i=>({id:i.id,type:i.type,name:nameOf(i.id,prototypes.get(i.id)),group:i.subgroup,icon:icons[i.id]}));
const localBlueprintPath=file=>path.join('site',file);
const factories=[], verifiedBlueprints=[];
for(const item of manifest.items){
 if(!eligible(item))continue;
 for(const v of Object.values(item.variants)){
  const plan=v.planFile?JSON.parse(await fs.readFile(path.join(root,v.planFile),'utf8')):null;
  const f={id:v.id,name:nameOf(item.id,prototypes.get(item.id)),product:item.id,variant:v.mode==='intermediary'?'intermediate':v.mode,
   outputPerMinute:plan?plan.target.perSecond*60:null,inputs:plan?.inputs.map(i=>({...i,perMinute:i.perSecond*60,label:i.label||nameOf(i.id,prototypes.get(i.id))}))||[],
   steps:plan?.steps.map(s=>({recipe:s.recipe,machine:s.machine,count:s.machineCount,utilization:s.utilization}))||[],status:plan?'calculated':'unavailable',reason:v.reason||(!plan?item.reason:undefined),
   assumptions:plan?.assumptions||[],warnings:plan?.warnings||[],notes:[],source:{name:'Original generated factory · installed mod recipes',author:'Factorio Command Center',url:'sources/flight-factories/manifest.json'},validation:{status:'calculated'}};
  if(plan){const planName=`${v.id}.plan.json`;await fs.writeFile(path.join(dest,planName),JSON.stringify(plan,null,2)+'\n');f.planPath=`sources/flight-factories/${planName}`;
   if(plan.requiredResearch?.length)f.notes.push('Required research: '+plan.requiredResearch.join(', '));
   if(plan.startupStock?.length)f.notes.push('Additional startup stock: '+plan.startupStock.map(i=>`${i.amount} ${i.id}`).join(', '));
   if(plan.surplus?.length)f.notes.push('Continuously export byproducts: '+plan.surplus.map(i=>`${(i.perSecond*60).toPrecision(4)}/min ${i.id}`).join(', '));
  }
  if(v.blueprintFile){const code=(await fs.readFile(path.join(root,v.blueprintFile),'utf8')).trim();if(createHash('sha256').update(code).digest('hex')!==v.blueprintSha256)throw Error('Blueprint SHA mismatch '+v.id);
   const {inflateSync}=await import('node:zlib');const decoded=JSON.parse(inflateSync(Buffer.from(code.slice(1),'base64'))).blueprint;
   const filename=path.basename(v.blueprintFile);await fs.writeFile(path.join(dest,filename),code);
   const previewId=v.id+'-'+v.blueprintSha256.slice(0,12)+'-'+rendererHash;
   const expectedPreview='assets/blueprints/'+previewId+'.png';
   const preview=await fs.stat('site/'+expectedPreview).then(()=>expectedPreview).catch(()=>blueprintPreview(decoded,previewId,entityDefs,{icons}));
   f.blueprint={path:`sources/flight-factories/${filename}`,sha256:v.blueprintSha256,preview,entities:decoded.entities.filter(e=>e.name==='display-panel')};
   f.notes.push('Requires a connected logistic network, logistic robots, requester chests, substations and external electricity. Every labeled input is a boundary feed.');
   // Evidence is attached only after exact identity and actual passing result checks.
   const reportRoots=await fs.readdir('.cache/flight-native/reports',{withFileTypes:true}).catch(()=>[]);
   const candidates=[];for(const dir of reportRoots.filter(d=>d.isDirectory())){const candidate=path.join('.cache/flight-native/reports',dir.name,v.id+'.json');if(await fs.stat(candidate).catch(()=>false))candidates.push(candidate);}
   const matching=[];
   for(const filename of candidates){const bytes=await fs.readFile(filename);const report=JSON.parse(bytes);if(report.blueprintSha256===v.blueprintSha256&&(report.prototypeSha256||report.prototypeDumpSha256)===prototypeSha256)matching.push({filename,report,reportSha256:createHash('sha256').update(bytes).digest('hex')});}
   // Prefer the longest observation, then warmup, then recency, never outcome.
   // A brief cold-start diagnostic must not erase a longer sustained run.
   matching.sort(compareNativeEvidence);
   if(matching.length>1){
    const diagnostics=matching.map(({report})=>({runId:report.runId,status:report.status,passed:report.passed,warmupMinutes:report.configuration?.warmupTicks/3600,measuredMinutes:report.configuration?.measurementTicks/3600,failures:report.failures||[]}));
    const historyFile=`${v.id}.${v.blueprintSha256}.history.json`;await fs.writeFile(path.join(dest,historyFile),JSON.stringify({selection:'Longest measurement, then longest warmup, then newest run; independent of outcome.',blueprintSha256:v.blueprintSha256,prototypeSha256,runs:diagnostics},null,2)+'\n');
    f.source.diagnosticsPath=`sources/flight-factories/${historyFile}`;
    f.notes.push('Evidence uses the longest measurement, then longest warmup, then newest matching run. '+diagnostics.filter(r=>r.passed!==true).length+' unsuccessful matching diagnostic runs are retained in the evidence history.');
   }
   for(const {report,reportSha256} of matching){
    const availability=availabilityByReport.get(reportSha256);
    if(report.passed===true&&(!availability||availability.blueprintSha256!==v.blueprintSha256||availability.configurationSha256!==report.configurationSha256||availability.environmentAvailability.status==='unverified'))throw Error('Passing report needs current loaded-map availability binding: '+v.id+'; rerun flight-native-availability.mjs');
    const publishedReport=Object.fromEntries(['id','blueprintSha256','prototypeDumpSha256','sourceSpecSha256','specSha256','configurationSha256','configuration','modSnapshotSha256','runId','passed','status','functionalPassed','throughputPassed','failures','outputs','rateBasis','implementation','nativeControlSha256','evaluation','native'].filter(k=>report[k]!==undefined).map(k=>[k,report[k]]));
    publishedReport.originalReportSha256=reportSha256;
    if(availability){publishedReport.nativeReportSha256=availability.nativeReportSha256;publishedReport.environmentAvailability=availability.environmentAvailability;}

    const reportFile=`${v.id}.${v.blueprintSha256}.native.json`;await fs.writeFile(path.join(dest,reportFile),JSON.stringify(publishedReport,null,2)+'\n');
    if(report.passed!==true){f.validation={status:'native-failed',passed:false,blueprintSha256:v.blueprintSha256,prototypeSha256,reportPath:`sources/flight-factories/${reportFile}`,failures:report.failures||['Native execution error; details retained in local validation logs.']};delete f.blueprint.path;await fs.rm(path.join(dest,path.basename(v.blueprintFile)),{force:true});f.notes.push('Blueprint download withheld: latest matching native test did not pass. '+(report.failures||['Native execution error; details retained in local validation logs.']).join('; '));break;}
    const sourceSpec=specsById.get(v.id);
    const evidence=sourceSpec&&matchFactoryEvidence({variant:v,spec:{...sourceSpec,warmupTicks:report.configuration?.warmupTicks,measurementTicks:report.configuration?.measurementTicks},report,code,prototypeSha256});
    if(!evidence?.matched||evidence.status!=='native-throughput'){f.validation={status:'native-failed',passed:false,blueprintSha256:v.blueprintSha256,prototypeSha256,reportPath:`sources/flight-factories/${reportFile}`,failures:evidence?.reasons||['Missing matching test spec']};delete f.blueprint.path;await fs.rm(path.join(dest,path.basename(v.blueprintFile)),{force:true});f.notes.push('Native evidence did not pass publication checks: '+(evidence?.reasons||['missing matching test spec']).join('; '));break;}
    f.validation={status:'native-tested',passed:true,blueprintSha256:v.blueprintSha256,prototypeSha256,reportPath:`sources/flight-factories/${reportFile}`,outputs:Object.entries(report.outputs||{}).map(([key,row])=>({id:key.split(':').slice(1).join(':'),type:key.split(':')[0],...row})),measuredMinutes:report.configuration?.measurementTicks/3600,warmupMinutes:report.configuration?.warmupTicks/3600,throughputPassed:report.throughputPassed,rateBasis:report.rateBasis};break;
   }
  }
  if(f.validation.status==='native-tested'&&f.validation.passed===true&&f.blueprint?.path){const code=await fs.readFile(localBlueprintPath(f.blueprint.path),'utf8');const {inflateSync}=await import('node:zlib');verifiedBlueprints.push({variant:f.variant,blueprint:JSON.parse(inflateSync(Buffer.from(code.slice(1),'base64'))).blueprint});}
  factories.push(f);
 }
}
await fs.writeFile(path.join(dest,'manifest.json'),JSON.stringify({...manifest,summary:{...manifest.summary,nativeVerifiedVariants:verifiedBlueprints.length},publishedEvidence:{nativeVerifiedVariants:verifiedBlueprints.length,failedVariants:factories.filter(f=>f.validation.status==='native-failed').length,calculatedVariants:factories.filter(f=>f.validation.status==='calculated'&&f.blueprint).length}},null,2)+'\n');
const data={schemaVersion:1,generatedAt:manifest.generatedAt,profile:{id:'flight-forest-20261110',name:'Flight Forest · Everything on Nauvis + EV',factorioVersion:'2.0.77',prototypeSha256,
 mods:nativeMap.mods.filter(m=>m.enabled),map:{name:'Flight Forest · Ready',saveName:nativeMap.installedSaveName,evidencePath:'sources/flight-map/native-loaded-save-report.json',seed:20261110,preview:'flight-map.svg',description:'Load '+nativeMap.installedSaveName+' in Factorio. This corrected Ready save was verified after loading. Abundant resources, a connected solar grid, normal enemies beyond a large safe start, early tree seeds, and earned robot research. Game saves and installed mods are not publicly hosted.'},
 notes:['Every resource tile/entity starts at 4,294,967,295, including future generated chunks. Mining depletes them normally.','480 solar panels and 420 accumulators; 3,616 guaranteed trees surrounding a clear building core.','Normal enemies; initial 640-tile clearance. Twice-normal crafting and research speed, with normal science costs.','Hand-mineable volcanic rocks supply starter tungsten and calcite. Marked specimens enable local agriculture/heating triggers.','Paid research-gated ground exchanges replace otherwise space-only material supply; they are manual trades, not automated raw-material recipes.','Start robot production with an intermediate-input layout and prepared parts; bootstrap its logistic network with hand-crafted robots. Large raw layouts need more logistics infrastructure.','Factory rates are calculated targets unless a matching passing native report is attached. Read startup stock, byproduct and research requirements before building.','Recipe and icon sources: Wube Factorio/Space Age; installed mod authors, including EverythingOnNauvis and EV. Exact versions listed below.']},materials:[...prototypes].map(([id,p])=>({id,name:nameOf(id,p),type:p.type==='fluid'?'fluid':'item',icon:icons[id]})),items,factories};
if(verifiedBlueprints.length){
 const books=['raw','mixed','intermediate'].map((variant,index)=>({index,blueprint_book:{item:'blueprint-book',label:variant+' inputs · verified',active_index:0,version:562949958467584,blueprints:verifiedBlueprints.filter(b=>b.variant===variant).map((b,index)=>({index,blueprint:b.blueprint}))}})).filter(b=>b.blueprint_book.blueprints.length);
 const book={blueprint_book:{item:'blueprint-book',label:'Flight factories · native verified',description:'Independent factory layouts tested against the exact installed mod profile '+prototypeSha256+'. See catalogue for feeds, research, startup stock and measured rates.',active_index:0,version:562949958467584,blueprints:books}};
 const code='0'+deflateSync(Buffer.from(JSON.stringify(book))).toString('base64');const file='verified-book.'+createHash('sha256').update(code).digest('hex').slice(0,12)+'.txt';await fs.writeFile(path.join(dest,file),code);
 data.profile.book={path:'sources/flight-factories/'+file,count:verifiedBlueprints.length,sha256:createHash('sha256').update(code).digest('hex')};
}
const usedPreviews=new Set(factories.map(f=>f.blueprint?.preview).filter(Boolean));
for(const file of await fs.readdir('site/assets/blueprints')){
 if(/^(?:item|fluid)-.+-(?:raw|mixed|intermediary)-[a-f0-9]{12}(?:-[a-f0-9]{8})?\.png$/.test(file)&&!usedPreviews.has('assets/blueprints/'+file))await fs.rm('site/assets/blueprints/'+file);
}
await fs.writeFile('site/flight-factories-data.js','// Generated installed-mod catalogue; independent from vanilla data.\nglobalThis.FLIGHT_FACTORIES = '+JSON.stringify(data)+';\n');
console.log(JSON.stringify({items:items.length,variants:factories.length,blueprints:factories.filter(f=>f.blueprint).length,native:verifiedBlueprints.length}));
