// Bridge completed workshops and preserved design versions into the main offline explorer.
// Operating ports are authoritative; construction materials are never production outputs.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint,blueprintMaterials} from './blueprints.mjs';
import {blueprintPreview,blueprintPreviewSvg} from './blueprint-preview.mjs';
import sharp from 'sharp';
import {blueprintCoverage} from './blueprint-coverage.mjs';
import {writeData} from './write-data.mjs';
import '../site/lib/production.js';
import {kitBillProblems} from './space-launch-pages.mjs';
import {checkVersions,countMachines,passingBuild} from './blueprint-versions.mjs';
const hash=s=>createHash('sha256').update(s.trim()).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [catalog,production,library,community,atlas]=await Promise.all(['catalog','production','library','community','atlas'].map(n=>read(`site/data/${n}.json`)));
const entries=[],seen=new Map(),audit=[];
const collection='Long game flight plans and strategies';
const releaseGroup='flight-workshops-20261117';
const todayFolders=new Set(['compact-expansion-workshop','rgby-science','five-science','robot-logistics-workshop','inserter-workshop']);
// Essentials round (21 November 2026): its own release group; the "today" group stays at nine.
const essentialsGroup='essentials-20261121';
const essentialsFolders=new Set(['green-circuits','essentials-mall','robot-essentials','six-science']);
// Space launch round (21 November 2026): its own release group, shown by ?collection=space-launch.
const spaceLaunchGroup='space-launch-20261121';
const spaceLaunchFolders=new Set(['concrete-supplier','rocket-fuel-supplier','launch-kit','rocket-supplies','white-platform','white-pack-receiver']);
// BEGIN workshop recommendation promotion
function promoteWorkshop(entries,entry,products=entry.products){
 if(entry.validation?.status!=='game-tested'||entry.validation.blueprintSha256!==entry.blueprintSha256)throw Error('Workshop promotion requires exact-hash native qualification');
 const promoted=new Set(products);
 // Only earlier recommendations for these products are superseded. Keep the
 // records, other recommendations and all source/version history intact.
 for(const earlier of entries.slice(0,entries.indexOf(entry))){
  if(earlier.recommendedProducts)earlier.recommendedProducts=earlier.recommendedProducts.filter(id=>!promoted.has(id));
 }
 entry.recommendedProducts=[...products];
}
// END workshop recommendation promotion
const destination='sources/designed-blueprints';
// A platform blueprint is mostly foundation: draw its tiles under the entities in the library thumbnail.
async function tiledPreview(b,id){
 const svg=await blueprintPreviewSvg(b,production);if(!svg)return undefined;
 const tiles=(b.tiles||[]).map(t=>`<rect x="${t.position.x}" y="${t.position.y}" width="1" height="1" fill="#46525a" stroke="#17272e" stroke-width=".04"/>`).join('');
 const out=svg.replace(/(<svg\b[^>]*>\s*<rect\b[^>]*\/>)/,'$1'+tiles);
 await fs.mkdir('site/assets/blueprints',{recursive:true});const file=`assets/blueprints/${id}.png`;await sharp(Buffer.from(out)).png().toFile('site/'+file);return file;
}
await fs.mkdir('site/'+destination,{recursive:true});
const unique=a=>[...new Set(a.filter(Boolean))];
async function copySource(file){const to=destination+'/'+file.replace(/^blueprint-sources\//,'');await fs.mkdir(path.dirname('site/'+to),{recursive:true});await fs.copyFile(file,'site/'+to);return to;}
async function register(options){
 const {file,info={},category,purpose,page,proof,report,version='2.1.24',inputs,outputs,setup=[],archive=false,preview,sourceCollection=collection,sourceAuthor='Factorio Command Center',sourceURL,profile,operatingBoundary,coverageExcluded=false,consumedProducts=[],versionOf}=options;
 const code=(await fs.readFile(file,'utf8')).trim(),sha=hash(code),object=decodeBlueprint(code);if(!object.blueprint)return;
 if(info.blueprintSha256&&info.blueprintSha256!==sha)throw Error('Manifest SHA mismatch: '+file);
 if(!versionOf&&seen.has(sha)&&sourceCollection!=='Autosaved · optimized v2'){seen.get(sha).alternateSources.push(file.replace(/^blueprint-sources\//,''));return;}
 const b=object.blueprint,analysis=FactorioProduction.analyzeBlueprint(object,production);
 const productIds=unique(outputs??info.products??info.outputs?.map(p=>p.item)??analysis.outputs);
 const inputIds=unique(inputs??[...(info.inputs||[]),...(info.fluids||[])].map(p=>p.item));
 const verified=proof?.blueprintSha256===sha&&(proof.passed===true||proof.boundaryAudit?.passed===true||((proof.perMinute||proof.outputsPerMinute)&&proof.unpowered===0&&proof.allRecipeMachinesCrafted===true));
 const recordId=versionOf?.id||info.catalogueId||'designed-'+sha.slice(0,16),localSource=file.startsWith('site/')?file.slice(5):await copySource(file);
 let reportURL=report?(report.startsWith('site/')?report.slice(5):await copySource(report)):null;
 const measured=verified?(proof.outputsPerMinute&&typeof proof.outputsPerMinute==='object'?proof.outputsPerMinute:proof.perMinute):null;
 const title=info.name||info.label||b.label||path.basename(file,'.txt');
 const notes=[...setup,...(info.setupNotes||[]),...(info.notes||[]),`Game profile: Factorio ${version}${profile?' · '+profile:''}.`,...(info.optionalInputs?.length?['Optional supplements (not required): '+unique(info.optionalInputs.map(p=>p.item)).join(', ')+'.']:[])];
 if(info.initialSeeds)notes.push(`Bootstrap with ${info.initialSeeds} tree seeds. Seeds already circulating inside the nursery are retained for replanting; they are not a continuous imported ingredient.`);
 if(file.includes('solid-science-complete'))notes.push('Supply only iron ore, copper ore and finished solid fuel plus electricity. Leave the inherited east gear tap unused; it is not a supported input for the complete factory.');
 if(archive)notes.unshift('Preserved earlier design. Use a current workshop for new construction; this version is not promoted as a verified optimization.');
 const consumedIds=unique(consumedProducts);
 if(consumedIds.length)notes.push(`Makes ${consumedIds.join(', ')} inside; the connected labs use every pack, so nothing is exported.`);
 const releaseFolder=file.replace(/^blueprint-sources\//,'').split('/')[0];
 const entry={...(todayFolders.has(releaseFolder)?{releaseGroup}:essentialsFolders.has(releaseFolder)?{releaseGroup:essentialsGroup}:spaceLaunchFolders.has(releaseFolder)?{releaseGroup:spaceLaunchGroup}:{}),id:recordId,name:title,collection:sourceCollection,category,section:category,purpose,designedCollection:true,lifecycle:archive?'archive':'current',gameVersion:version,profile:profile||'Space Age',...(operatingBoundary?{operatingBoundary}:{}),coverageExcluded:coverageExcluded||archive,author:sourceAuthor,sourceURL:sourceURL||page||localSource,file:localSource,isBook:false,icons:unique([...(b.icons||[]).map(i=>i.signal?.name),...productIds]).slice(0,4),...blueprintMaterials(object,catalog),code,products:productIds,...(consumedIds.length?{consumedProducts:consumedIds}:{}),analysis:{...analysis,kind:purpose,inputs:inputIds,outputs:productIds,netOutputs:productIds,internal:analysis.internal.filter(id=>!productIds.includes(id)&&!inputIds.includes(id)),serviceInputs:unique([...(analysis.serviceInputs||[]),...(info.initialSeeds?['Initial tree seeds']:[])]),serviceOutputs:category==='Forestry'&&info.id!=='forest-kit'?['Tree planting and pollution absorption']:analysis.serviceOutputs,notes:unique([...(analysis.notes||[]),...notes])},setupNotes:notes,operatingPorts:{inputs:info.inputs||[],fluids:info.fluids||[],outputs:info.outputs||[],optional:info.optionalInputs||[]},blueprintSha256:sha,validation:{status:verified?'game-tested':'untested',note:verified?`Exact blueprint SHA-256 matched native Factorio ${version} evidence. ${measured?'Measured delivery: '+Object.entries(measured).map(([id,n])=>id+' '+Number(n).toFixed(2)+'/min').join('; ')+'.':'Operational behavior tested; no manufacturing throughput claim.'}`:'Preserved design; no matching native production qualification is published for this exact version. Recipe/layout analysis does not establish connected routing or sustained output.',blueprintSha256:sha,...(reportURL?{report:reportURL}:{})},...(measured?{measuredOutputsPerMinute:measured}:{}),sources:unique([localSource,page,reportURL,sourceURL]),alternateSources:[],preview:preview||await blueprintPreview(b,versionOf?'designed-'+sha.slice(0,16):recordId,production),...(info.footprint&&!Array.isArray(info.footprint)?{footprint:info.footprint}:{})};
 // An earlier tested version is a full record under the current id, reached only through the version picker.
 if(versionOf)return entry;
 if(info.versions?.length>1)entry.publication=await versionPublication(entry,options);
 entries.push(entry);seen.set(sha,entry);audit.push({id:recordId,name:title,blueprintSha256:sha,file:localSource,collection:sourceCollection,section:category,purpose,inputs:inputIds,outputs:productIds,...(consumedIds.length?{consumedProducts:consumedIds}:{}),validation:entry.validation.status,report:reportURL,gameVersion:version,lifecycle:entry.lifecycle,...(entry.publication?{versions:[entry.publication.label,...entry.publication.history.map(h=>h.label).reverse()]}:{})});
}
// Tested versions from the family manifest's "versions" field (scripts/blueprint-versions.mjs), newest first.
// The current record carries publication.version/label/history, the shape site/explorer.js already reads for
// its version picker; each older version is written as its own full record (same id) next to its string.
// Optional measured inputs per minute and power (kW), only for versions whose reports record them.
const operation=v=>({...(v.inputsPerMinute?{inputsPerMinute:v.inputsPerMinute}:{}),...(Number.isFinite(v.powerKW)?{powerKW:v.powerKW}:{})});
async function versionPublication(entry,options){
 const {file,info}=options,dir=path.dirname(file),versions=await checkVersions(info,dir);
 const keep=rates=>rates&&entry.products.length?Object.fromEntries(Object.entries(rates).filter(([id])=>entry.products.includes(id))):rates;
 const [current,...older]=versions,history=[];
 for(const [index,v] of older.entries()){
  const number=versions.length-1-index,report=await read(path.join(dir,v.report)),build=passingBuild(report,v.blueprintSha256);
  const own=v.manifest?(await read(path.join(dir,v.manifest))).find(e=>e.blueprintSha256===v.blueprintSha256):null;
  const record=await register({...options,file:path.join(dir,v.file),info:{...(own||info),versions:undefined,catalogueId:undefined,blueprintSha256:v.blueprintSha256,footprint:{...(own?.footprint||{}),width:v.width,height:v.height}},proof:build?{...build,outputsPerMinute:keep(v.outputsPerMinute.steady)}:undefined,report:path.join(dir,v.report),preview:undefined,versionOf:entry});
  if(record.validation.status!=='game-tested')throw Error(`${info.id}: version "${v.label}" has no passing native report for its exact string`);
  const url=destination+'/'+dir.replace(/^blueprint-sources\//,'')+'/versions/'+v.blueprintSha256.slice(0,16)+'.json';
  await fs.mkdir(path.dirname('site/'+url),{recursive:true});await fs.writeFile('site/'+url,JSON.stringify({...record,publication:{version:number,label:v.label}},null,1)+'\n');
  history.push({version:number,label:v.label,...(v.summary?{summary:v.summary}:{}),blueprintSha256:v.blueprintSha256,url,code:record.file,native:record.validation.report,footprint:{width:v.width,height:v.height},tiles:v.tiles,machines:v.machines,entityCount:record.entityCount,perMinute:keep(v.outputsPerMinute.steady),recoveryPerMinute:keep(v.outputsPerMinute.recovery),...operation(v)});
 }
 return {version:versions.length,label:current.label,...(current.summary?{summary:current.summary}:{}),snapshots:{code:entry.file},machines:current.machines,perMinute:keep(current.outputsPerMinute.steady),recoveryPerMinute:keep(current.outputsPerMinute.recovery),...operation(current),history:history.reverse()};
}
// Records versioned by the immutable publication (transport, early game, science, power) gain machine counts
// for their version comparison: the current string and each archived string, counted the same way.
async function versionMachines(record){
 if(!record.publication?.version||record.designedCollection)return;
 record.publication.machines=await countMachines(decodeBlueprint(record.code).blueprint);
 for(const h of record.publication.history||[])h.machines=await countMachines(decodeBlueprint((await fs.readFile('site/'+h.code,'utf8')).trim()).blueprint);
}
const specs=[
 ['compact-expansion-workshop','Malls · building expansion','Production','compact-expansion-workshop/index.html'],
 ['early-controlled-loops','Early game · controlled loops','Production','early-controlled-loops/index.html'],
 ['flight-science','Science · three and four packs','Science production','flight-science/index.html'],
 ['flight-robots','Robots and logistics','Robot production','flight-robots/index.html'],
 ['flight-forest','Forestry','Forestry','flight-forest/index.html'],
 ['flight-science-sided','Science · intermediate suppliers','Intermediate production','flight-science-sided/index.html'],
 ['flight-science-sided/full','Science · six packs integrated','Science production','flight-science-sided/index.html#fully-integrated'],
 ['flight-science-sided/hybrid','Science · six packs hybrid','Science production','flight-science-sided/index.html#hybrid'],
 ['flight-science-sided/compact','Science · six packs compact','Science production','flight-science-sided/index.html#compact']
];
for(const [folder,category,purpose,page]of specs){
 const dir='blueprint-sources/'+folder,manifest=await read(dir+'/manifest.json'),reportFile=dir+'/native-report.json',report=await read(reportFile);
 for(const info of manifest){const proof=report.builds?.find(b=>b.blueprintSha256===info.blueprintSha256&&b.passed);
 if(folder==='compact-expansion-workshop'&&(!report.passed||!proof))throw Error('Compact expansion workshop requires exact-hash passing native production proof.');
 let outputs=info.products||info.outputs?.map(p=>p.item);if(folder==='flight-forest'&&info.id!=='forest-kit')outputs=[]; // Standing trees are services, not exported recipe products.
 await register({file:dir+'/'+info.file,info,category,purpose:folder==='early-controlled-loops'?(info.id.includes('feeder')?'Smelting and intermediates':info.products.some(p=>p.endsWith('science-pack'))?'Science production':'Production'):purpose,page,proof,report:reportFile,outputs,version:report.gameVersion||'2.1.24',setup:folder==='flight-forest'?['Keep the planting area clear and on suitable terrain; preserve the seed reserve and harvesting controls. Open the forestry guide for seed-loop and pollution-sizing instructions.']:[]});}
 if(folder==='compact-expansion-workshop'){const entry=entries.at(-1);entry.recommendedProducts=[...entry.products];entry.recommendation='Latest compact shared workshop';entry.setupNotes.push('Five west inputs: iron plates, copper plates, steel plates, stone bricks and plastic. Five east output passive providers. All circuits, gears and yellow transport components are made inside. Keep the transport phase clock, stock-control wires and chest bars. This is an on-demand shared building workshop; see the guide for measured rates.');}
 // Keep the existing detailed pages available for the offline collection too.
 if(folder==='early-controlled-loops'){await fs.cp(dir,'site/early-controlled-loops',{recursive:true});}
}
// Plate-fed four-pack workshop and physically connected research variants.
const rgbyDir='blueprint-sources/rgby-science',rgbyManifest=await read(rgbyDir+'/manifest.json'),rgbyReportFile=rgbyDir+'/native-report.json',rgbyReport=await read(rgbyReportFile);
for(const info of rgbyManifest){
 const native=rgbyReport.builds.find(b=>b.blueprintSha256===info.blueprintSha256&&b.passed);if(!native)throw Error('Four-pack workshop requires matching passing native evidence: '+info.id);
 const research=!!info.researchProbe,proof=research?{...native,outputsPerMinute:undefined}:native;
 await register({file:rgbyDir+'/'+info.file,info:{...info,outputs:research?[]:info.outputs},category:'Science · four packs from plates',purpose:research?'Science research':'Science production',page:'rgby-science/index.html',proof,report:rgbyReportFile,outputs:research?[]:info.products,...(research?{consumedProducts:info.products}:{}),coverageExcluded:research,version:rgbyReport.gameVersion,setup:['Plate-fed red, green, blue and yellow science. All circuits, engines, batteries, robot frames, processors and low-density structures are made inside. Supply both copper entrances, preserve stock-control wires and output chest limits.',research?'Four packs feed the connected labs directly; lab count depends on technology research time and effective lab speed. See guide for the formula.':'Four finished science packs collect at adjacent east passive providers.']});
 if(!research){entries.at(-1).recommendedProducts=[...info.products];entries.at(-1).recommendation='Latest plate-fed four-pack science workshop';}
}
// Five-pack progression preserves the separately qualified four-pack workshop.
const fiveDir='blueprint-sources/five-science',fiveManifest=await read(fiveDir+'/manifest.json'),fiveReportFile=fiveDir+'/native-report.json',fiveReport=await read(fiveReportFile);
for(const info of fiveManifest){
 const native=fiveReport.builds.find(b=>b.blueprintSha256===info.blueprintSha256&&b.passed);if(!native)throw Error('Five-pack workshop requires matching passing native evidence: '+info.id);
 const research=!!info.researchProbe,proof=research?{...native,outputsPerMinute:undefined}:native;
 await register({file:fiveDir+'/'+info.file,info:{...info,outputs:research?[]:info.outputs},category:'Science · five packs from plates',purpose:research?'Science research':'Science production',page:'five-science/index.html',proof,report:fiveReportFile,outputs:research?[]:info.products,...(research?{consumedProducts:info.products}:{}),coverageExcluded:research,version:fiveReport.gameVersion,setup:['Plate-fed red, green, blue, yellow and purple science. Supply every labeled west input in both banks, including stone and stone bricks for purple. All circuits, engines, batteries, frames, processors, rails, furnaces and productivity modules are manufactured inside. Substations distribute electricity; no modules are installed.',research?'Five packs feed the connected labs directly. Effective lab speed and technology time determine continuously supported lab count; see guide.':'Five adjacent east passive-provider chests collect science; preserve chest limits and isolated stock-control wiring.']});
 if(!research){entries.at(-1).recommendedProducts=['production-science-pack'];entries.at(-1).recommendation='Latest five-pack science workshop with substations';}
}
// New workshops are admitted only after exact-code native qualification. Never infer
// manufacturing coverage from their construction inventory or intermediate recipes.
const SPACE_SUPPLY='Supply every labeled operating input, including fluids where listed, at or above its panel figure, and external electricity. Preserve stock controls, circuit wires and passive-provider chest limits. Construction materials are not operating inputs.';
const KIT_ITEMS=['rocket-silo','cargo-landing-pad','space-platform-starter-pack','space-platform-foundation','asteroid-collector','crusher','assembling-machine-2','electric-furnace','fast-inserter','solar-panel','accumulator','constant-combinator','arithmetic-combinator','decider-combinator','passive-provider-chest','substation'];
const supplierName={'green-circuits':'green-circuit supplier','concrete-supplier':'concrete supplier','rocket-fuel-supplier':'rocket-fuel supplier'};
for(const [folder,category,purpose,expected,opts={}] of [
 ['robot-logistics-workshop','Robots and logistics','Robot production',['construction-robot','logistic-robot','roboport','passive-provider-chest','storage-chest']],
 ['inserter-workshop','Inserters','Production',['inserter','long-handed-inserter','fast-inserter','bulk-inserter']],
 // Essentials round, promoted in this order so each leads coverage for its own products.
 ['green-circuits','Circuits','Circuit production',['electronic-circuit']],
 ['essentials-mall','Building essentials','Production',['assembling-machine-2','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','bulk-inserter','electric-furnace','electric-mining-drill']],
 ['robot-essentials','Robots and logistics','Robot production',['construction-robot','logistic-robot','roboport','storage-chest','passive-provider-chest']],
 ['six-science','Science · six packs from supplied circuits','Science production',['automation-science-pack','logistic-science-pack','military-science-pack','chemical-science-pack','production-science-pack','utility-science-pack']],
 // Space launch round, promoted in this order. Each option says what differs from a rate workshop:
 // outputs (the kit lists its 16 chest items, not its intermediates), recommend (the kit leads only
 // its space items), inputs (the platform has none: its collectors catch chunks in orbit), and the
 // receiver crafts nothing, so it is searchable by its delivered packs but excluded from coverage.
 ['concrete-supplier','Space launch · suppliers','Production',['concrete'],{setup:[SPACE_SUPPLY]}],
 ['rocket-fuel-supplier','Space launch · suppliers','Production',['rocket-fuel'],{setup:[SPACE_SUPPLY]}],
 ['launch-kit','Space launch · kit','Production',KIT_ITEMS,{outputs:info=>Object.keys(info.outputCaps),recommend:['rocket-silo','cargo-landing-pad','space-platform-starter-pack','space-platform-foundation','asteroid-collector','crusher'],setup:[SPACE_SUPPLY,'On demand: the kit has no rate. Its native run measured the time to a complete kit from empty; take items out of a chest and exactly those are made again.','Robot network: leave the starter pack and the platform parts in the kit\'s passive provider chests, inside one roboport network with logistic robots that also covers the rocket silo. With "Automatic requests from space platforms" on, the silo takes its cargo from that network and refuses cargo put in by hand. The kit makes no roboports or robots.','First launch: in a save that has never created a space platform, the asteroid collector and crusher recipes unlock only when the first platform is created, so the kit fills 14 of its 16 chests and waits (blueprint-sources/launch-kit/history/first-launch-order). Place the silo and create the platform as soon as the silo and the starter pack are ready; the kit then makes the crusher and the four collectors by itself and the last cargo rocket waits for them. The measured kit time applies to a save where a platform already exists.'],supplierCopies:true}],
 ['rocket-supplies','Space launch · rocket supplies','Production',['processing-unit','low-density-structure'],{setup:[SPACE_SUPPLY,'Rocket fuel passes straight through to its own chest; it is supplied, not made here.'],supplierCopies:true}],
 ['white-platform','Space science · orbital platform','Science production',['space-science-pack'],{inputs:[],rates:b=>({'space-science-pack':b.steady.madePerMinute}),setup:['Space platform blueprint: no supplied inputs. Its four asteroid collectors catch chunks in Nauvis orbit; the crusher, furnace and assemblers make the packs inside. Paste it with its hub on a platform made from one starter pack; it snaps to the real hub and keeps the hub\'s "request missing construction materials" setting on.']}],
 ['white-pack-receiver','Space science · ground receiver','Science production',['space-science-pack'],{outputs:()=>['space-science-pack'],inputs:['space-science-pack'],recommend:[],coverageExcluded:true,rates:b=>({'space-science-pack':b.steady.collectedPerMinute}),setup:['Receives space science packs from the platform in orbit by cargo pod and delivers them to a passive provider chest; it crafts nothing. A planet allows one cargo landing pad: if one already exists, add the space science pack request to it and build only the arm, chest and substation.']}],
 // Electric smelter pass-through (22 November 2026), derived from the Autosaved "In-Out Electric Smelter"
 // (autosaved-f3d991e31c13c301): ore in west, unused ore out east on the same row, plates out south.
 ['electric-smelter-pass-through','Smelting · electric furnaces','Smelting',['iron-plate','copper-plate'],{inputs:['iron-ore','copper-ore'],sourceAuthor:'Autosaved (In-Out Electric Smelter, autosaved-f3d991e31c13c301); ports redesigned by Factorio Command Center',sourceURL:'https://autosaved.org/factorio/blueprints',setup:['Feed iron ore or copper ore on one red belt at the west entrance (row 1, the second row) and supply electricity at any substation. Plates leave south on one yellow belt; ore the station does not use leaves east on the same row, so the next copy placed 30 tiles east takes it with no extra belts. One red belt feeds two copies at 900 plates per minute each.']}]
]){
 const dir='blueprint-sources/'+folder,manifest=await read(dir+'/manifest.json'),reportFile=dir+'/native-report.json',report=await read(reportFile);
 if(manifest.length!==1)throw Error('Expected one current workshop: '+folder);
 for(const info of manifest){
  const sha=hash(await fs.readFile(dir+'/'+info.file,'utf8'));
  const proof=report.builds?.find(b=>b.blueprintSha256===sha&&b.passed===true);
  const unqualified=report.passed!==true||!proof||info.blueprintSha256!==sha;
  // An essentials or space-launch blueprint that did not qualify is left out of the library; its landing page names it.
  if(unqualified&&(essentialsFolders.has(folder)||spaceLaunchFolders.has(folder))){console.warn('Not registered (no exact-hash passing native report): '+folder);continue;}
  if(unqualified)throw Error('Workshop requires exact-hash passing native production proof: '+folder);
  // The kit is published only with the exact platform and receiver strings its bill was made from.
  if(folder==='launch-kit'){const problems=kitBillProblems(await read('scripts/launch-kit/bill.json'),(await read('blueprint-sources/white-platform/manifest.json'))[0],(await read('blueprint-sources/white-pack-receiver/manifest.json'))[0],info);if(problems.length){console.warn('Not registered (kit bill does not match the published platform): '+problems.join('; '));continue;}}
  const outputs=opts.outputs?opts.outputs(info):info.products;
  if(JSON.stringify([...outputs].sort())!==JSON.stringify([...expected].sort()))throw Error('Unexpected workshop products: '+folder);
  const supply=info.greenCircuitSupply?['Needs supplied electronic circuits: '+info.greenCircuitSupply.perMinute+' per minute at the targets; '+info.greenCircuitSupply.copiesOfGreenCircuits+' green-circuit supplier cop'+(info.greenCircuitSupply.copiesOfGreenCircuits===1?'y':'ies')+' (360 per minute each) cover'+(info.greenCircuitSupply.copiesOfGreenCircuits===1?'s':'')+' it.']:[];
  // Supplier copies for the space-launch consumers come from the manifest's supplierLinks.
  if(opts.supplierCopies)for(const l of info.supplierLinks||[])if(l.supplier)supply.push(`Needs supplied ${l.item.replaceAll('-',' ')}: ${l.perMinute} per minute at the panel figure; ${l.copies} ${supplierName[l.supplier]||l.supplier} cop${l.copies===1?'y':'ies'} cover${l.copies===1?'s':''} it.${l.note?' '+l.note:''}`);
  // Measured rates are the products' own; the rocket-fuel pass-through and the kit (no rate) report none.
  const rates=opts.rates?opts.rates(proof):spaceLaunchFolders.has(folder)&&proof.outputsPerMinute?Object.fromEntries(Object.entries(proof.outputsPerMinute).filter(([id])=>outputs.includes(id))):proof.outputsPerMinute;
  const platformPreview=folder==='white-platform'?await tiledPreview(decodeBlueprint(await fs.readFile(dir+'/'+info.file,'utf8')).blueprint,'designed-'+sha.slice(0,16)):undefined;
  await register({file:dir+'/'+info.file,info,category,purpose,page:folder+'/index.html',proof:{...proof,outputsPerMinute:rates},report:reportFile,outputs,...(opts.inputs?{inputs:opts.inputs}:{}),...(opts.sourceAuthor?{sourceAuthor:opts.sourceAuthor,sourceURL:opts.sourceURL}:{}),coverageExcluded:opts.coverageExcluded,preview:platformPreview,version:report.gameVersion,setup:[...(opts.setup||['Supply every labeled operating input, including fluids where listed, and external electricity. Preserve stock controls, circuit wires and passive-provider chest limits. Intermediates are manufactured inside; construction materials are not operating inputs.']),...supply]});
  const entry=entries.at(-1);
  promoteWorkshop(entries,entry,opts.recommend??outputs);entry.recommendation='Latest qualified '+folder.replaceAll('-',' ');
 }
}
const space=await read('blueprint-sources/flight-space-science/manifest.json'),spaceReport='blueprint-sources/flight-space-science/validation/native-report.json',spaceProof=await read(spaceReport);
await register({file:'blueprint-sources/flight-space-science/'+space.file,info:space,category:'Space science · orbital cell',purpose:'Science production',page:'flight-space-science/index.html',proof:{...spaceProof,passed:spaceProof.outputItems>0&&spaceProof.hubSciencePacks>0},report:spaceReport,outputs:[space.output.item],setup:['Zero-gravity surface required. Attach the foundation to a space-platform hub. Feed iron plates, carbon and ice from separate asteroid-processing equipment; the cell does not collect or process asteroids. Science is transferred into the hub and requested down to Nauvis.']});
const sevenReportFile='blueprint-sources/early-flight-seven/native-report.json',sevenReport=await read(sevenReportFile);
const sevenDraw=info=>{const t=new Map();for(const p of info.oreAcceptedPerMinute||[])t.set(p.item,(t.get(p.item)||0)+p.perMinute);return [...t].map(([item,n])=>item+' '+Number(n.toFixed(2))+'/min').join(', ');};
for(const info of await read('blueprint-sources/early-flight-seven/manifest.json'))await register({file:'blueprint-sources/early-flight-seven/'+info.file,info:{...info,id:info.file},category:'Early game · seven separate workshops',purpose:info.products.some(x=>x.endsWith('science-pack'))?'Science production':'Production',page:'early-flight-seven/index.html',inputs:unique([...FactorioProduction.analyzeBlueprint(decodeBlueprint(await fs.readFile('blueprint-sources/early-flight-seven/'+info.file,'utf8')),production).inputs,'coal']),outputs:info.products,archive:true,proof:sevenReport.passed===true?sevenReport.builds.find(b=>b.blueprintSha256===info.blueprintSha256):undefined,report:sevenReportFile,setup:['Earlier AM1/steel-furnace design with yellow belts. Supply electricity separately. Feed each labelled west inlet with its raw material.',...(info.oreAcceptedPerMinute?.length?['Measured draw with every inlet on a full belt (native test): '+sevenDraw(info)+'.']:[])]});
await fs.cp('blueprint-sources/early-flight-seven','site/early-flight-seven',{recursive:true});
const mall=await read('blueprint-sources/early-game/early-flight-science-mall.json'),mallReportFile='blueprint-sources/early-game/early-flight-science-mall-native-report.json',mallReport=await read(mallReportFile);await register({file:'blueprint-sources/early-game/early-flight-science-mall.txt',info:mall,category:'Early game · original combined mall',purpose:'Production',inputs:mall.rawInputs,outputs:mall.outputs,archive:true,proof:mallReport.passed===true?mallReport.builds.find(b=>b.blueprintSha256===mall.blueprintSha256):undefined,report:mallReportFile});
// Preserve exact source attribution for the Autosaved-derived science experiments.
for(const folder of ['core-production-pilot','core-production-batch']){
 const dir='blueprint-sources/'+folder,evidence=await read(dir+'/evidence.json'),designs=evidence.derivatives||evidence.designs,native=[];
 for(const file of await fs.readdir(dir)){if(!/native.*\.json$|native-validation\.json$/.test(file))continue;const r=await read(dir+'/'+file);for(const c of r.cases||[])if(c.role==='candidate')native.push({proof:c,report:dir+'/'+file,version:r.gameVersion});}
 for(const design of designs){const file=design.file||design.name+'.txt';if(!(await fs.stat(dir+'/'+file).catch(()=>null)))continue;const sha=hash(await fs.readFile(dir+'/'+file,'utf8')),test=native.find(x=>x.proof.blueprintSha256===sha);
 await register({file:dir+'/'+file,info:{name:design.sourceName||design.name,products:design.requiredOutputs},category:'Science · Autosaved-derived versions',purpose:'Science production',sourceCollection:'Science design versions · 2.1',inputs:design.requiredInputs||design.edgeIngress?.map(p=>p.item),outputs:design.requiredOutputs,proof:test?.proof,report:test?.report,version:test?.version||'2.1.24',archive:!test,sourceAuthor:'Autosaved; adaptation by Factorio Command Center',sourceURL:'https://autosaved.org/factorio/blueprints',setup:['No modules. Earlier source and comparison evidence are preserved. Recipe capacity is distinct from measured delivery; these native tests used Factorio 2.1.24, not the vanilla 2.0.77 catalogue.']});}
 // Unselected versions remain accessible without being presented as the current optimized design.
 for(const file of (await fs.readdir(dir)).filter(f=>f.endsWith('.txt'))){const sha=hash(await fs.readFile(dir+'/'+file,'utf8'));if(seen.has(sha))continue;const test=native.find(x=>x.proof.blueprintSha256===sha),object=decodeBlueprint(await fs.readFile(dir+'/'+file,'utf8')),a=FactorioProduction.analyzeBlueprint(object,production);
 await register({file:dir+'/'+file,info:{name:object.blueprint.label||file.replace('.txt','')},category:'Science · earlier candidates',purpose:'Science production',sourceCollection:'Design archive',inputs:a.inputs,outputs:a.outputs,proof:test?.proof,report:test?.report,archive:true,sourceAuthor:'Autosaved; adaptation by Factorio Command Center',sourceURL:'https://autosaved.org/factorio/blueprints'});}
}
// User-requested malls: expose the qualified blue tier and clearly archive the unfinished shopping draft.
for(const name of ['early-shopping','blue-tier-mall']){
 const dir='blueprint-sources/requested-malls/'+name,m=await read(dir+'/manifest.json'),blue=name==='blue-tier-mall';
 const reportFile=blue?dir+'/native-report.json':undefined,proof=blue?await read(reportFile):undefined;
 const ports=blue?m.inputPorts:(await read(dir+'/port-map.json')).inputs;
 const inputIds=blue?ports.map(p=>p.item):m.inputs;
 await register({file:dir+'/blueprint.txt',info:{name:blue?'Blue-tier mall · on-demand':'Early Shopping · 46 products · draft',blueprintSha256:m.candidateSha256,inputs:ports.map(p=>({item:p.item,entity:p.chest||p.pipe||p.entity})),footprint:blue?proof.footprint:undefined},category:blue?'Malls · belts and inserters':'Malls · unfinished drafts',purpose:'Mall production',sourceCollection:blue?collection:'Design archive',inputs:inputIds,outputs:blue?m.products:m.outputs,proof,report:reportFile,version:blue?'2.1.24':m.gameVersion,archive:!blue,setup:blue?['On-demand stock-capped production. Supplies red belts, red undergrounds and red splitters as finished inputs, plus gears, plates, green/red circuits and lubricant. All seven products collect in one passive-provider chest. Native test verified initial stocking, collection/refill and recovery from input outage; it does not claim a fixed output rate.']:['Draft only: static checks passed; native production was not run. Retains all 46 requested finished products and declared item/fluid entrances. Do not treat this draft as a qualified compact mall.']});
}

// Recover the delivered Luna compact trials and robot-serviced forestry versions from other threads.
for(const info of await read('blueprint-sources/recovered-workshops/manifest.json')){
 const dir='blueprint-sources/recovered-workshops',reportFile=dir+'/'+info.report,r=await read(reportFile);
 let proof=r.builds?.find(b=>b.blueprintSha256===info.blueprintSha256)||r;
 if(info.id.startsWith('luna-'))proof={...proof,outputsPerMinute:Object.fromEntries(Object.entries(r.outputs||{}).map(([id,value])=>[id.replace(/^(item|fluid):/,''),value.perMinute]))};
 await register({file:dir+'/'+info.file,info,category:info.category,purpose:info.purpose,page:info.category==='Forestry'?'flight-forest/index.html':undefined,proof,report:reportFile,inputs:info.inputs.map(p=>p.item),outputs:info.products,sourceAuthor:info.id.startsWith('luna-')?'Factorio Command Center; supervised Luna compact trials':'Factorio Command Center',setup:info.id.startsWith('luna-')?['Inputs are finished iron and copper plates. Cable/gears are made inside. No modules. Supply external power; mining and smelting are external.']:[]});
}

// This exporter checks every ledger/code/native SHA and passive-provider output before registration.
const optimizedContext={};vm.createContext(optimizedContext);vm.runInContext(await fs.readFile('site/autosaved-derivatives/data.js','utf8'),optimizedContext);
for(const f of optimizedContext.AutosavedDerivatives.entries){
 const inputPorts=f.ports.filter(p=>p.role==='input'||p.role==='fluid');
 const file='site/autosaved-derivatives/'+f.blueprintFile;
 const proof={passed:true,blueprintSha256:f.candidateBlueprintSha256,outputsPerMinute:Object.fromEntries(f.products.map(p=>[p.item,p.candidateItemsPerMinute]))};
 await register({file,info:{catalogueId:'optimized-'+f.id,name:f.name+' · module-free v2',blueprintSha256:f.candidateBlueprintSha256,inputs:inputPorts.map(p=>({item:p.material,entity:p.entity,side:p.side})),outputs:f.ports.filter(p=>p.role==='output').map(p=>({item:p.material,entity:p.entity,side:p.side}))},category:f.section||f.category||'Production',purpose:'Production',sourceCollection:'Autosaved · optimized v2',inputs:inputPorts.length?inputPorts.map(p=>p.material):f.inputs,outputs:f.products.map(p=>p.item),proof,report:'site/autosaved-derivatives/'+f.evidenceFile,version:f.runtimeVersion,page:'autosaved-derivatives/index.html',preview:'autosaved-derivatives/'+f.previewFile,sourceAuthor:f.attribution+'; adaptation by Factorio Command Center',sourceURL:f.sourceUrl,setup:['Module-free redesign with native production evidence for this exact blueprint. Original community version remains in the Autosaved collection. Output chests are passive providers.',...(f.ports.length?['Connect the labeled exterior input ports and collect at the recorded output side; preserve circuit and power connections.']:[]),...(f.sourceFixtureNote?[f.sourceFixtureNote]:[]),'The catalogue targets '+f.catalogueTarget+'; native runtime verification was performed on '+f.runtimeVersion+'.']});
}

// Published mod-profile factories keep their exact historical environment and evidence.
// They are searchable here, but never contribute to vanilla recipe coverage.
const context={};vm.createContext(context);vm.runInContext(await fs.readFile('site/flight-factories-data.js','utf8'),context);const flight=context.FLIGHT_FACTORIES;
for(const f of flight.factories.filter(f=>f.blueprint?.path)){
 const file='site/'+f.blueprint.path,code=await fs.readFile(file,'utf8');if(hash(code)!==f.blueprint.sha256)throw Error('Published flight code SHA mismatch: '+f.id);
 const plan=await read('site/'+f.planPath),v=f.validation,verified=v?.passed&&v.blueprintSha256===f.blueprint.sha256;
 await register({file,info:{name:f.name+' · '+f.variant,blueprintSha256:f.blueprint.sha256,inputs:f.inputs.map(p=>({item:p.id,entity:p.entityNumber})),outputs:(plan.outputs||[]).map(p=>({item:p.id,entity:p.entityNumber}))},category:f.variant==='raw'?'From raw resources':'From supplied intermediates',purpose:'Mod-profile production',sourceCollection:'Flight factories · historical mod profile',inputs:f.inputs.map(p=>p.id),outputs:(plan.outputs||[]).map(p=>p.id),proof:{...v,passed:verified,outputsPerMinute:Object.fromEntries((v?.outputs||[]).filter(p=>p.collected>0).map(p=>[p.id,p.perMinute]))},report:v?.reportPath?'site/'+v.reportPath:undefined,version:flight.profile.factorioVersion,profile:flight.profile.name,operatingBoundary:f.variant==='raw'?'raw':'parts',coverageExcluded:true,page:'flight-factories.html',preview:f.blueprint.preview,setup:['Historical mod-profile blueprint. Requires the exact mods and recipes listed in the Flight factories guide; it is not qualified for vanilla or the replacement 2.1 Nauvis mod.',...(f.notes||[]),...(f.warnings||[])]});
}
// Generated pages contain useful books, including raw-feeder + loop and solid-fuel variants.
const books=[];for(const folder of ['early-controlled-loops','early-flight-seven'])for(const file of(await fs.readdir('blueprint-sources/'+folder)).filter(f=>f.endsWith('book.txt'))){books.push({name:file.replace('.txt',''),url:await copySource('blueprint-sources/'+folder+'/'+file)});}
atlas.blueprints=[...atlas.blueprints.filter(b=>!b.designedCollection),...entries];
for(const record of atlas.blueprints)await versionMachines(record);
const all=[...library.blueprints.map(b=>({...b,analysis:community.local[b.id]})),...community.blueprints,...atlas.blueprints];atlas.coverage=blueprintCoverage(catalog,production,all);atlas.designedCollections={collection,count:entries.length,books,audit:destination+'/catalogue-audit.json'};
await fs.writeFile('site/'+destination+'/catalogue-audit.json',JSON.stringify({schemaVersion:1,entries:audit,books},null,2)+'\n');await writeData('atlas',atlas);
console.log(JSON.stringify({indexed:entries.length,collections:Object.fromEntries(unique(entries.map(x=>x.collection)).map(c=>[c,entries.filter(b=>b.collection===c).length])),native:entries.filter(b=>b.validation.status==='game-tested').length,archive:entries.filter(b=>b.lifecycle==='archive').length},null,2));
