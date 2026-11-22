// Plastic-bar suppliers in three sizes: small (2 chemical plants, 240/min), medium (5, 600/min), large (10, 1,200/min).
// Coal on one belt from the west, petroleum gas through one pipe on the west edge of the top row, plastic out east on
// one red belt. Geometry is in layout.mjs; this file adds the panels, ports, manifest records and strings.
//
// Pure Node and reproducible: no game data is needed (recipe and machine figures are constants, checked against the
// prototype dump when it is readable). A re-run leaves blueprint-sources/plastic-bars/ byte-identical, and a committed
// string is kept whenever it decodes to the same blueprint (another zlib build may compress it differently).
// Usage: node scripts/plastic-bars/generate.mjs                       all three sizes into blueprint-sources/plastic-bars
//        node scripts/plastic-bars/generate.mjs --size large --variant large-filter-splitter --out <dir>   one screening candidate
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint} from '../blueprints.mjs';
import {buildLayout,footprintOf,VARIANTS} from './layout.mjs';
import {familyVersions} from '../blueprint-versions.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
export const PROTOTYPE_SHA256='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
// From the 2.1.24 Space Age dump: recipe plastic-bar = 20 petroleum gas + 1 coal -> 2 plastic bars in 1 s;
// chemical plant crafting speed 1. So one plant makes 120 bars, takes 60 coal and 1,200 gas per minute.
export const RECIPE={energy:1,coal:1,gas:20,bars:2,plantSpeed:1};
export const SIZES={
 small:{variant:'small',plants:2,covers:'every blueprint that takes 180 per minute or less'},
 medium:{variant:'medium',plants:5,covers:'520, 375 and 320 per minute'},
 large:{variant:'large-shared-aisle',plants:10,covers:'1,040 per minute (measured draw 1,190.8)'},
};
const id='plastic-bars',product='plastic-bar';
const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10};
const sha=s=>createHash('sha256').update(s).digest('hex');
const fmt=n=>{const r=Math.round(n*10)/10;return String(r).replace(/\B(?=(\d{3})+(?!\d))/g,',');};

// Check the constants against the dump when it can be read (a clean checkout or CI runner has none).
let rawBytes=null;try{rawBytes=await fs.readFile(RAW);}catch{}
if(rawBytes){
 assert.equal(sha(rawBytes),PROTOTYPE_SHA256,'prototype dump changed');
 const raw=JSON.parse(rawBytes),r=raw.recipe[product],cp=raw['assembling-machine']['chemical-plant'];
 assert.equal(r.energy_required,RECIPE.energy);assert.equal(cp.crafting_speed,RECIPE.plantSpeed);
 assert.deepEqual(r.ingredients.map(i=>[i.name,i.amount]).sort(),[['coal',RECIPE.coal],['petroleum-gas',RECIPE.gas]]);
 assert.deepEqual(r.results.map(i=>[i.name,i.amount]),[[product,RECIPE.bars]]);
 // Input connections of the plant facing north: (-1,-1) and (1,-1), both pointing north (layout.mjs relies on it).
 assert.deepEqual(cp.fluid_boxes.filter(b=>b.production_type==='input').map(b=>b.pipe_connections.map(c=>[c.direction,...c.position])).flat(),[[0,-1,-1],[0,1,-1]]);
}
export const perPlant={bars:60*RECIPE.plantSpeed/RECIPE.energy*RECIPE.bars,coal:60*RECIPE.plantSpeed/RECIPE.energy*RECIPE.coal,gas:60*RECIPE.plantSpeed/RECIPE.energy*RECIPE.gas};

export async function generate(size,{variant,out}={}){
 const spec=SIZES[size];assert(spec,'unknown size '+size);variant=variant||spec.variant;out=out||'blueprint-sources/'+id;
 const L=buildLayout(variant),{entities}=L,v=VARIANTS[variant];
 // A blocked exit tile holds 4 bars per lane in use: one lane in the one-row sizes, two in the large.
 const exitCap=v.rows===2?8:4;
 const plants=entities.filter(e=>e.name==='chemical-plant').length;assert.equal(plants,spec.plants,'plant count');
 const target=plants*perPlant.bars,coal=plants*perPlant.coal,gas=plants*perPlant.gas;
 // ---- ports and panels ----
 const ports=[],tileOf=e=>({x:Math.floor(e.position.x),y:Math.floor(e.position.y)});
 const port=(kind,item,e,extra)=>{const p={kind,label:item,items:[item],item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},...extra};ports.push(p);return p;};
 const coalPort=port('input','coal',L.ports.coal,{externalSide:'west',direction:4,perMinute:coal,tile:tileOf(L.ports.coal)});
 const gasPort=port('fluid','petroleum-gas',L.ports.gas,{externalSide:'west',transport:'pipe',nominalPerMinute:gas,perMinute:gas,tile:tileOf(L.ports.gas),connection:'the pipe on the top-left corner tile; a straight pipe from the west along the top row joins it'});
 const exitPort=port('output',product,L.ports.exit,{externalSide:'east',direction:4,transport:'belt',cap:exitCap,tile:tileOf(L.ports.exit)});
 const add=(name,x,y,extra)=>L.place(name,x,y,extra);
 for(const [p,icon,where] of [[coalPort,'item',L.panels.coal],[gasPort,'fluid',L.panels.gas]]){
  const text=p.kind==='fluid'?`IN: ${p.item} (pipe)\nWEST · ${fmt(p.perMinute)}/min at nominal target`:`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min at nominal target`;
  const e=add('display-panel',where[0],where[1],{icon:{type:icon,name:p.item},text,always_show:true});p.displayEntity=e.entity_number;
 }
 ports.push({kind:'power',label:'External electricity',items:[],entity:L.substation.entity_number,x:L.substation.position.x,y:L.substation.position.y});
 for(const e of entities)e.tags={flight_science_entity:e.entity_number};
 const footprint=footprintOf(entities);
 // ---- blueprint ----
 const lanes=v.rows===2?`${fmt(target/2)} on each lane`:`all on the south lane`;
 const arms=v.rows===1?'bulk and long-handed inserters':v.bottomArms==='long'?'fast, long-handed and bulk inserters':'fast, long-handed and bulk inserters, one filtered fast splitter';
 const description=`Official 2.1.24 Space Age; ${plants} chemical plants (plastic bar), no modules, red belts, ${arms}, pipes and pipe-to-ground, one substation. WEST: coal ${fmt(coal)}/min on the belt at (${coalPort.tile.x},${coalPort.tile.y}) (either lane); petroleum gas ${fmt(gas)}/min into the pipe at (${gasPort.tile.x},${gasPort.tile.y}), the top-left corner, from the west. EAST: one red belt exit at (${exitPort.tile.x},${exitPort.tile.y}), ${fmt(target)} plastic bars/min (${lanes}). Supply electricity at the substation.`;
 const label=`Plastic bar supplier · ${size} · ${fmt(target)}/min`;
 const bp={item:'blueprint',version:562954249961472,label,description,entities,icons:[{index:1,signal:{type:'item',name:product}}]};
 const file=`${id}-${size}.txt`,reportFile=`native-report-${size}.json`;
 const committed=await fs.readFile(out+'/'+file,'utf8').then(t=>t.trim(),()=>null);
 const sameBlueprint=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
 const code=committed&&sameBlueprint(committed)?committed:encodeBlueprint({blueprint:bp});
 // Status only from a full-protocol report for this exact string.
 let status='unverified',measured;
 try{const report=JSON.parse(await fs.readFile(out+'/'+reportFile,'utf8'));const r=report.builds?.find(b=>b.blueprintSha256===sha(code));
  if(r&&!report.short&&report.feedScale===1){status=r.passed&&report.passed?'qualified':'not-qualified';const m=report.protocolMinutes.measureMinutes;
   measured={steadyPerMinute:r.outputsPerMinute[product],recoveryPerMinute:r.recovery?.outputsPerMinute?.[product],coalPerMinute:r.inputs?.[0]?.acceptedPerMinute,gasPerMinute:r.fluids?.[0]?.acceptedPerMinute,exitLanesPerMinute:r.outputPorts?.[0]?.collectedByLane?.map(n=>n/m),blockedExitStock:r.blocked?.collectionPauseStock?.[0]?.count,reportCreatedAt:report.createdAt};}}catch{}
 const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length]));
 const area=footprint.width*footprint.height;
 const manifest={
  id:`${id}-${size}`,family:id,size,name:label,file,reportFile,blueprintSha256:sha(code),prototypeSha256:PROTOTYPE_SHA256,class:'rate',status,...(measured?{measured}:{}),
  variant,layout:v,covers:spec.covers,
  products:[product],targets:{[product]:target},outputCaps:{[product]:exitCap},
  recipeAudit:{perPlantPerMinute:perPlant,externalPerMinute:{coal,'petroleum-gas':gas},craftsPerMinute:{[product]:target/RECIPE.bars},machinesExact:{[product]:target/perPlant.bars},recipeIngredients:{[product]:[{type:'fluid',name:'petroleum-gas',amount:RECIPE.gas},{type:'item',name:'coal',amount:RECIPE.coal}]}},
  inputs:ports.filter(p=>p.kind==='input'),fluids:ports.filter(p=>p.kind==='fluid'),outputs:ports.filter(p=>p.kind==='output'),ports,
  machineCounts:{[product]:plants},footprint,tiles:area,tilesPerBarPerMinute:Math.round(area/target*1000)/1000,
  exitLanes:v.rows===2?{north:target/2,south:target/2}:{north:0,south:target},
  loopControl:[],stockControl:{mode:'belt-exit',exit:L.ports.exit.entity_number,cap:exitCap},
  armRoles:{product:L.roles.productArms,coal:L.roles.coalArms},
  protocol,construction,entityCount:entities.length,
  setupNotes:[description,`Belt the exit east to the plastic entrances of the consumers. The exit tile holds ${exitCap} bars when nothing takes them (4 per lane in use), and every plant then stops.`,`Feed coal and gas at or above the panel figures; extra coal backs up on the entrance belt and extra gas stays in the pipes.`],
 };
 await fs.mkdir(out,{recursive:true});
 await fs.writeFile(out+'/'+file,code+'\n');
 return manifest;
}

if(import.meta.url===`file://${process.argv[1]}`){
 const args=process.argv.slice(2),flag=n=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:undefined;};
 const out=flag('out')||'blueprint-sources/'+id,sizes=flag('size')?[flag('size')]:Object.keys(SIZES);
 assert(!(flag('size')||flag('variant'))||flag('out'),'--size and --variant write a screening candidate: give --out (the published folder always holds all three sizes)');
 const records=[];for(const size of sizes)records.push(await generate(size,{variant:flag('variant'),out}));
 await fs.writeFile(out+'/manifest.json',JSON.stringify(records,null,2)+'\n');
 // The library shows the three sizes as one entry with a size picker: the medium record (recommended) lists the
 // three sizes as alternatives (scripts/blueprint-versions.mjs), each read from its own manifest record and report;
 // the per-size inputs (coal on a belt, petroleum gas by pipe) come from the report's entrance lists. Only for the
 // published folder with all three sizes qualified.
 if(!flag('size')&&!flag('variant')&&records.every(m=>m.status==='qualified')){
  const by=Object.fromEntries(records.map(m=>[m.size,m])),pick=(size,label)=>({label,summary:`Covers ${by[size].covers}.`,file:by[size].file,manifest:'manifest.json',report:by[size].reportFile,inputsFromBuild:true});
  const medium=by.medium;
  medium.versions=await familyVersions(out,[pick('medium','Medium'),pick('small','Small'),pick('large','Large')]);
  medium.versionsAlternatives=true;
  await fs.writeFile(out+'/manifest.json',JSON.stringify(records,null,2)+'\n');
 }
 for(const m of records)console.log(JSON.stringify({id:m.id,variant:m.variant,size:m.footprint.width+'x'+m.footprint.height,tiles:m.tiles,target:m.targets[product],status:m.status,entities:m.entityCount,sha:m.blueprintSha256.slice(0,12)}));
}
