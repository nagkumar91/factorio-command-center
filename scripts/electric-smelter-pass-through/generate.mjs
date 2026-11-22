// Electric smelter pass-through: the Autosaved "In-Out Electric Smelter" (24 electric furnaces) with new ports.
// Source: Autosaved collection, id autosaved-f3d991e31c13c301, https://autosaved.org/factorio/blueprints
// (the pasted string is kept unchanged in blueprint-sources/electric-smelter-pass-through/original/).
//
// What is kept from the original: the 24 furnaces (four rows of six, each with its two efficiency-module
// requests), every inserter and fast inserter, the four ore lanes with their woven fast underground belts,
// the four substations with their wires and the two roboports, all on the same tiles relative to each other.
// What changes:
//  - Ore enters on the WEST edge on the second row and runs straight across the top (red belt, one red
//    underground under the north roboport) to the EAST edge on the same row, so a second copy placed 30 tiles
//    east (touching) receives it with no extra belts.
//  - The first tile of that ore line is a red splitter whose priority output (south) feeds the station; only
//    what the station cannot take goes on east. A full or blocked station therefore never stops the ore line,
//    and a blocked east end only sends everything into the station.
//  - The station feed comes down a red belt in the west column into the original four-way split (its first
//    splitter is a red splitter facing south; the other two are the original yellow splitters).
//  - The two plate lanes flow EAST instead of west, leave under the last furnace pair, come down two columns
//    on the east side and merge in a splitter into one yellow belt leaving the SOUTH edge in the last column.
//
// Pure Node and reproducible: no game data is read; the same source gives the same blueprint string.
// Usage: node scripts/electric-smelter-pass-through/generate.mjs [--out dir]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint,encodeBlueprint} from '../blueprints.mjs';
import {ID,SOURCE,PROTOTYPE,SIZE,VARIANTS,MAIN_VARIANT,computedRates,ascii} from './shared.mjs';
import {familyVersions} from '../blueprint-versions.mjs';

const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const out=flag('out','blueprint-sources/'+ID);
const sha=s=>createHash('sha256').update(s).digest('hex');
const N=0,E=4,S=8,W=12;

const originalText=await fs.readFile(out+'/'+SOURCE.file,'utf8');
const original=decodeBlueprint(originalText).blueprint;
assert.equal(original.label,SOURCE.name);

// ---------- what is taken from the original (original coordinates) ----------
const beltLike=e=>/belt|splitter/.test(e.name);
const at=(e,x,y)=>e.position.x===x&&e.position.y===y;
// The plate lanes (rows y=-3.5 and y=-0.5, they flowed west) and the west plate merge, the west input belt
// and the first splitter of the ore split are rebuilt; everything else stays exactly where it was.
const rebuilt=e=>beltLike(e)&&(e.position.y===-3.5||e.position.y===-0.5||(e.position.x<34&&[-2.5,-1.5].includes(e.position.y))||at(e,34.5,-1.5)||at(e,31.5,1.5)||at(e,32.5,2));
const removed=original.entities.filter(rebuilt).map(e=>e.entity_number);
assert.deepEqual(removed,[65,66,67,68,69,70,73,74,77,78,81,82,83,85,88,89,94,95,100,102,104],'unexpected set of rebuilt original entities');
const kept=original.entities.filter(e=>!rebuilt(e));

// ---------- placement with collision checks (original coordinates) ----------
const occupied=new Map(),entities=[],key=(x,y)=>x+','+y;
function tilesOf(e){const [w0,h0]=SIZE[e.name]||[1,1],[w,h]=[E,W].includes(e.direction||0)?[h0,w0]:[w0,h0],t=[];
 for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++)t.push([x,y]);return t;}
function place(e,origin){for(const [x,y] of tilesOf(e)){assert(!occupied.has(key(x,y)),`collision ${e.name} at ${x},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}e.origin=origin;entities.push(e);return e;}
for(const e of kept)place(structuredClone(e),e.entity_number);
const tile=(name,x,y,direction,extra={})=>place({name,position:{x:x+.5,y:y+.5},...(direction?{direction}:{}),...extra},'new');
const belt=(x,y,d)=>tile('transport-belt',x,y,d),red=(x,y,d)=>tile('fast-transport-belt',x,y,d);
const dive=(name,x,y,d,type)=>tile(name,x,y,d,{type});
// A splitter is given by its two tiles' top-left tile.
const splitter=(name,x,y,d,extra={})=>place({name,position:[E,W].includes(d)?{x:x+.5,y:y+1}:{x:x+1,y:y+.5},...(d?{direction:d}:{}),...extra},'new');

// Ore line: entrance splitter at (31,-11..-10), red belt east along y=-11, under the north roboport (44 -> 49).
const entrance=splitter('fast-splitter',31,-11,E,{output_priority:'right'}); // right of an east-facing splitter = south = station
for(let x=32;x<=43;x++)red(x,-11,E);
dive('fast-underground-belt',44,-11,E,'input');dive('fast-underground-belt',49,-11,E,'output');
let forward;for(let x=50;x<=60;x++)forward=red(x,-11,E);
// Station feed: the splitter's south output turns south at (32,-10) and runs down the west column to a red
// splitter at (32..33,0) facing south, which replaces the original first splitter of the four-way split.
for(let y=-10;y<=-1;y++)red(32,y,S);
const feedSplit=splitter('fast-splitter',32,0,S);
// Its east output (33,1) is the original belt into the north half (kept); its west output turns east into the
// original south splitter at (33,2..3).
belt(32,1,S);belt(32,2,E);
// Plate lane on row y=-4 (furnace rows 1 and 3 drop on it), now flowing east: a plain tile in the first gap,
// then red underground hops under each furnace pair, out at (59,-4).
belt(38,-4,E);
for(const [a,b] of [[39,46],[47,54],[55,59]]){dive('fast-underground-belt',a,-4,E,'input');dive('fast-underground-belt',b,-4,E,'output');}
// Plate lane on row y=-1 (furnace rows 2 and 4), now flowing east, out at (58,-1).
for(const [a,b] of [[35,42],[43,50],[51,58]]){dive('fast-underground-belt',a,-1,E,'input');dive('fast-underground-belt',b,-1,E,'output');}
// East columns: row -1 lane down x=59, row -4 lane down x=60; a splitter merges them on row 6 and the exit
// leaves the south edge at (60,7).
for(let y=-1;y<=5;y++)belt(59,y,S);
for(let y=-4;y<=5;y++)belt(60,y,S);
const plateMerge=splitter('splitter',59,6,S,{output_priority:'left'}); // left of a south-facing splitter = east = the exit column
const exit=belt(60,7,S);
assert(!occupied.has(key(59,7)),'the merge splitter has one output belt');
for(const [x,y] of [[59,-3],[59,-2]])assert(!occupied.has(key(x,y)),'nothing joins the row -1 column from behind');

// ---------- move to a frame whose top-left tile is (0,0) and renumber ----------
const xs=[...occupied.keys()].map(k=>+k.split(',')[0]),ys=[...occupied.keys()].map(k=>+k.split(',')[1]);
const left=Math.min(...xs),top=Math.min(...ys),footprint={width:Math.max(...xs)-left+1,height:Math.max(...ys)-top+1};
assert.deepEqual(footprint,{width:30,height:20});
const numberOf=new Map(),originToNew=new Map();
entities.forEach((e,i)=>{e.entity_number=i+1;numberOf.set(e,i+1);if(e.origin!=='new')originToNew.set(e.origin,i+1);e.position={x:e.position.x-left,y:e.position.y-top};});
const wires=original.wires.map(([a,ca,b,cb])=>[originToNew.get(a),ca,originToNew.get(b),cb]);
assert(wires.every(w=>w[0]&&w[2]),'every original wire keeps both ends');
const final=entities.map(({origin,...e})=>({...e,tags:{smelter_entity:e.entity_number}}));
const occupiedTiles=new Set([...occupied.keys()].map(k=>{const [x,y]=k.split(',').map(Number);return key(x-left,y-top);}));

const pos=e=>({x:e.position.x,y:e.position.y});

// ---------- variants: the same layout with two modules of one kind in every furnace, or none ----------
const furnaces=final.filter(e=>e.name==='electric-furnace').length;
assert.equal(furnaces,24);
assert.equal(computedRates(null).platesPerMinute,PROTOTYPE.beltItemsPerSecond['transport-belt']*60,'no modules: one full yellow belt of plates');
const originalConstruction=Object.fromEntries([...new Set(original.entities.map(e=>e.name))].sort().map(n=>[n,original.entities.filter(e=>e.name===n).length]));
// Speed variants: every yellow belt, underground belt and splitter becomes red and every basic inserter fast, on the same tiles.
const UPGRADE={inserter:'fast-inserter','transport-belt':'fast-transport-belt','underground-belt':'fast-underground-belt',splitter:'fast-splitter'};
const moduleRequest=module=>[{id:{name:module},items:{in_inventory:[{inventory:4,stack:0},{inventory:4,stack:1}]}}];
function variantEntities(v){return final.map(e=>{const x=structuredClone(e);if(v.fast&&UPGRADE[x.name])x.name=UPGRADE[x.name];if(x.name==='electric-furnace'){delete x.items;if(v.module)x.items=moduleRequest(v.module);}return x;});}
const pretty=s=>s.replaceAll('-',' ');
const moduleText=v=>v.module?`48 ${pretty(v.module)}s (2 in each furnace)`:'no modules';
const num=x=>(Math.round(x*10)/10).toLocaleString('en-US');
const readReport=async dir=>{try{return JSON.parse(await fs.readFile(dir+'/native-report.json','utf8'));}catch{return undefined;}};
const built=[];
for(const v of VARIANTS){
 const main=v.id===MAIN_VARIANT,dir=main?out:out+'/versions/'+v.id,rel=main?'':'versions/'+v.id+'/';
 const r=computedRates(v.module),list=variantEntities(v);
 const exitBelt=v.fast?'red belt':'yellow belt';
 const ports=[
  {kind:'input',label:'Ore in',items:['iron-ore','copper-ore'],item:'iron-ore',entity:entrance.entity_number,position:pos(entrance),tile:{x:0,y:1},externalSide:'west',direction:E,transport:'red belt',perMinute:r.orePerMinute,
   note:`One red belt into the west face of the splitter on row 1. The station takes ${num(r.orePerMinute)} ore per minute first; everything else continues east.`},
  {kind:'forward',label:'Ore out (forwarded)',items:['iron-ore','copper-ore'],item:'iron-ore',entity:forward.entity_number,position:pos(forward),tile:{x:29,y:1},externalSide:'east',direction:E,transport:'red belt',perMinute:Math.max(0,1800-r.orePerMinute),
   note:`The same row as the entrance; ${num(Math.max(0,1800-r.orePerMinute))} ore per minute from a full red belt. A copy placed 30 tiles east takes it with no extra belts; on the last copy it may stay unconnected.`},
  {kind:'output',label:'Plates out',items:['iron-plate','copper-plate'],item:'iron-plate',entity:exit.entity_number,position:pos(exit),tile:{x:29,y:19},externalSide:'south',direction:S,transport:exitBelt,perMinute:r.platesPerMinute,
   note:`One ${exitBelt} leaving the south edge in the last column, ${num(r.platesPerMinute)} plates per minute.`},
  {kind:'power',label:'External electricity',items:[],entity:final.find(e=>e.name==='substation').entity_number},
 ];
 for(const p of ports.filter(p=>p.tile))assert(occupiedTiles.has(key(p.tile.x,p.tile.y)),'port tile occupied by its entity');
 const construction=Object.fromEntries([...new Set(list.map(e=>e.name))].sort().map(n=>[n,list.filter(e=>e.name===n).length]));
 const copies=Math.floor(r.copiesPerRedBelt+1e-9),rest=1800-copies*r.orePerMinute;
 const description=`Official 2.1.24 Space Age. ${v.label}: 24 electric furnaces with ${moduleText(v)}, ${v.fast?'fast inserters, red belts, red underground belts and red splitters':'inserters and fast inserters, yellow belts with red underground belts'}, 4 substations, 2 roboports. Derived from the Autosaved "In-Out Electric Smelter" (${SOURCE.id}, ${SOURCE.url}). WEST: ore in on one red belt, row 1 (second row). The station takes ${num(r.orePerMinute)} ore per minute first; the rest leaves EAST on the same row, so copies placed ${footprint.width} tiles apart chain along one ore line (one red belt feeds ${copies} cop${copies===1?'y':'ies'}${rest>1?` and ${num(rest)} ore per minute more`:''}). SOUTH: ${num(r.platesPerMinute)} plates per minute on one ${exitBelt} in the last column. Iron or copper ore; a blocked plate exit or a full station never stops the ore line, and an unconnected east end does not stop the station. Supply electricity at any substation; copies placed side by side join one network.`;
 const bp={item:'blueprint',version:562954249961472,label:'Electric smelter · '+v.label.toLowerCase(),description,icons:[{index:1,signal:{name:'electric-furnace'}},{index:2,signal:{name:'iron-ore'}},{index:3,signal:{name:'iron-plate'}}],entities:list,wires};
 // zlib's compressed bytes differ between builds (the Linux CI runner and this Mac give different strings for the same JSON).
 // Keep the committed string when it decodes to exactly this blueprint, so its SHA-256 and native report stay valid everywhere.
 const committed=await fs.readFile('blueprint-sources/'+ID+'/'+rel+ID+'.txt','utf8').then(t=>t.trim(),()=>null);
 const sameBlueprint=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
 const code=committed&&sameBlueprint(committed)?committed:encodeBlueprint({blueprint:bp}),blueprintSha256=sha(code);
 let report=await readReport(dir),status='unverified',measured;
 const rb=report?.builds?.find(b=>b.blueprintSha256===blueprintSha256);
 if(rb&&!report.short){status=rb.passed&&report.passed?'qualified':'not-qualified';measured={...rb.summary,reportCreatedAt:report.createdAt};}else report=undefined;
 const manifest={
  id:ID,variant:v.id,label:v.label,name:main?'Electric smelter · ore through east, plates south':bp.label,file:ID+'.txt',blueprintSha256,prototypeSha256:PROTOTYPE.sha256,class:'rate',status,...(measured?{measured}:{}),
  modules:v.module?{module:v.module,count:48,perFurnace:2,effect:PROTOTYPE.moduleEffects[v.module]}:{module:null,count:0},
  computed:r,expected:{orePerMinute:r.orePerMinute,platesPerMinute:r.platesPerMinute},
  source:{...SOURCE,blueprintSha256:sha(originalText.trim()),fileSha256:sha(originalText),footprint:{width:28,height:20},construction:originalConstruction,entityCount:original.entities.length,
   ports:'Ore in and plates out both on the west side; no ore leaves the station, so copies cannot share one ore line without extra belts.'},
  products:['iron-plate','copper-plate'],targets:{'iron-plate':r.platesPerMinute,'copper-plate':r.platesPerMinute},
  inputs:ports.filter(p=>p.kind==='input'),fluids:[],outputs:ports.filter(p=>p.kind==='output'),forward:ports.filter(p=>p.kind==='forward'),ports,
  chaining:{pitch:footprint.width,axis:'east',touching:true,copiesPerRedBelt:r.copiesPerRedBelt,
   note:`Place the next copy ${footprint.width} tiles east (touching). One red belt (1,800 ore/min) feeds ${copies} cop${copies===1?'y':'ies'} at full rate${rest>1?` and ${num(rest)} ore per minute to the next one`:''}. The ore line inside each copy is red, so a faster belt is held to 1,800 per minute inside the first copy.`},
  footprint,construction,entityCount:list.length,
  protocol:{warmupMinutes:10,measureMinutes:10,blockedMinutes:10,settleMinutes:3,recoveryMinutes:10},
  setupNotes:[description,'Feed iron ore or copper ore, one kind per ore line. Each was tested on its own; mixed ore on one line was not tested.','Keep the splitter priorities: the entrance splitter sends ore to the station first (south output); the merge splitter sends plates to the exit column.'],
 };
 built.push({v,main,dir,rel,code,list,manifest,report});
}
const mainBuild=built.find(b=>b.main),mainPlates=mainBuild.manifest.measured?.ironPlatesPerMinute;
// A variant is offered only with a passing report for its exact string; a speed variant only if it measured more
// plates than the no-module station.
for(const b of built){
 const m=b.manifest;
 b.include=b.main||(m.status==='qualified'&&(!b.v.fast||(Number.isFinite(mainPlates)&&m.measured.ironPlatesPerMinute>mainPlates)));
 if(!b.include)b.leftOut=m.status!=='qualified'?(m.status==='unverified'?'no native report for this exact string':'its native report did not pass'):`measured ${num(m.measured.ironPlatesPerMinute)} plates per minute, not above the ${num(mainPlates)} of the no-module station`;
}
await fs.mkdir(out,{recursive:true});
for(const b of built.filter(b=>!b.main)){
 await fs.mkdir(b.dir,{recursive:true});
 await fs.writeFile(b.dir+'/'+ID+'.txt',b.code+'\n');
 await fs.writeFile(b.dir+'/manifest.json',JSON.stringify([b.manifest],null,2)+'\n');
}
await fs.writeFile(out+'/'+ID+'.txt',mainBuild.code+'\n');
const summaryOf=b=>{const m=b.manifest,s=m.measured;return s?`${m.modules.count?m.modules.count+' × '+pretty(m.modules.module):'No modules'}. Measured per copy: ${num(s.ironOrePerMinute)} ore in, ${num(s.ironPlatesPerMinute)} plates out, ${num(s.forwardedFromFullRedBeltPerMinute)} ore forwarded from a full red belt; ${num(s.powerKW)} kW.`:'';};
const versions=await familyVersions(out,built.filter(b=>b.include).map(b=>({label:b.v.label,summary:summaryOf(b)||undefined,file:b.rel+ID+'.txt',...(b.main?{width:footprint.width,height:footprint.height}:{manifest:b.rel+'manifest.json'}),report:b.rel+'native-report.json'})));
const variantTable=built.map(b=>({variant:b.v.id,label:b.v.label,blueprintSha256:b.manifest.blueprintSha256,file:b.rel+ID+'.txt',modules:b.manifest.modules,fast:!!b.v.fast,computed:b.manifest.computed,status:b.manifest.status,...(b.manifest.measured?{measured:b.manifest.measured}:{}),included:b.include,...(b.leftOut?{leftOut:b.leftOut}:{})}));
const m=mainBuild.manifest;
const manifest={...m,versions,variants:variantTable,
 efficiencyHigherTiers:{computed:['efficiency-module-2','efficiency-module-3'].map(x=>({module:x,...computedRates(x)})),
  measured:mainBuild.manifest.measured?{efficiencyTwoPowerKW:mainBuild.manifest.measured.efficiencyTwoPowerKW,efficiencyThreePowerKW:mainBuild.manifest.measured.efficiencyThreePowerKW,efficiencyTwoPlatesPerMinute:mainBuild.manifest.measured.efficiencyTwoPlatesPerMinute,efficiencyThreePlatesPerMinute:mainBuild.manifest.measured.efficiencyThreePlatesPerMinute}:undefined},
 recipeAudit:{furnaces,furnaceCraftingSpeed:PROTOTYPE.furnaceCraftingSpeed,recipeSeconds:PROTOTYPE.recipeSeconds,perFurnacePerMinute:60*PROTOTYPE.furnaceCraftingSpeed/PROTOTYPE.recipeSeconds['iron-plate'],stationPerMinute:computedRates(null).platesPerMinute,
  yellowBeltPerMinute:PROTOTYPE.beltItemsPerSecond['transport-belt']*60,redBeltPerMinute:PROTOTYPE.beltItemsPerSecond['fast-transport-belt']*60,
  stoneBrickNote:'Stone bricks take 2 stone per brick: the station would need 1,800 stone per minute for 900 bricks, more than its inserters move (stone is reported as measured, not as a pass condition).'},
 changes:[
  'Ore now runs through: a red belt along row 1 from the west edge to the east edge, starting with a red splitter whose priority output feeds the station.',
  'Plates leave on the south edge (last column) instead of the west edge: the two plate lanes now flow east and merge in a splitter on the east side.',
  'The first splitter of the ore split became a red splitter fed from above by a red belt; the other two splitters and all four ore lanes are unchanged.',
  `Same 24 furnaces, same 38 inserters and 10 fast inserters, same 4 substations and 2 roboports on the same tiles. ${footprint.width} x ${footprint.height} instead of 28 x 20: two columns more on the east side for the plate exit; the west side keeps its width (the entrance splitter stands where the old input belt was, the west plate merge is gone).`,
  'Module requests: the original asked for 2 efficiency modules in each furnace. The main string now has none; efficiency, productivity and speed versions are kept beside it.',
 ]};
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
await fs.writeFile(out+'/README.md',readme(manifest,mainBuild.report,mainBuild.list,original.entities,built));
console.log(JSON.stringify({id:ID,out,footprint,main:{sha:manifest.blueprintSha256,status:manifest.status},variants:variantTable.map(v=>[v.variant,v.blueprintSha256.slice(0,12),v.status,v.included,v.leftOut||''])}));

// ---------- README (written from the manifest and, when present, the native report for this exact string) ----------
function readme(m,report,list,originalList,built){
 const n=v=>Number.isFinite(v)?(Math.round(v*10)/10).toLocaleString('en-US'):'not measured';
 const pct=v=>Number.isFinite(v)?(Math.round(v/m.targets['iron-plate']*1000)/10)+'%':'';
 const sc=name=>report?.scenarios?.find(s=>s.name===name);
 const rate=(s,phase,kind,copy,item)=>s?.[phase]?.drains?.find(d=>d.kind===kind&&d.copy===copy)?.perMinute?.[item]??0;
 const furn=(s,phase,copy)=>{const f=s?.[phase]?.furnaces?.[copy-1];return f?`${f.minCrafts} to ${f.maxCrafts} crafts per furnace`:'';};
 const mark=s=>s?.passed===true?'pass':s?.passed===false?'FAIL':'measured only';
 const t=m.targets['iron-plate'],pm=report?.protocolMinutes;
 const lines=[];const L=s=>lines.push(s);
 L(`# ${m.name}`);L('');
 L(report?`**${m.status==='qualified'?'Qualified':'Not qualified'}.** One headless native run of the exact published string (SHA-256 \`${m.blueprintSha256}\`, Factorio 2.1.24 Space Age) passed ${report.builds[0].summary.scenariosPassed} of ${report.builds[0].summary.scenarios} scenarios: **${n(report.builds[0].summary.ironPlatesPerMinute)} iron plates and ${n(report.builds[0].summary.copperPlatesPerMinute)} copper plates per minute** (target ${t}, ${pct(report.builds[0].summary.ironPlatesPerMinute)}), every furnace crafting the same share. This main string has **no modules**; the versions with efficiency, productivity and speed modules are listed below with their own measured inputs and outputs.`:'**Not yet qualified.** No native report for this exact string.');
 L('');
 L(`A 24-furnace electric smelting station for iron or copper ore. Ore comes in on the west side and the station takes ${t} ore per minute first; whatever it does not use carries straight on and leaves on the east side on the same row, so a second copy placed directly east receives it with no extra belts. Plates leave on the south side on one yellow belt (${t} per minute is one full yellow belt, 450 per lane).`);L('');
 L(`Derived from **"${SOURCE.name}"** in the Autosaved collection (id \`${SOURCE.id}\`, ${SOURCE.url}). The pasted original is kept unchanged in \`original/in-out-electric-smelter.txt\` (SHA-256 of the trimmed string \`${m.source.blueprintSha256}\`). The furnace block, its woven ore lanes, the substations and the roboports are the original's (the original requested 2 efficiency modules per furnace; that is the "Efficiency modules" version here).`);L('');
 L('## Versions: modules, inputs and outputs');L('');
 L('Same 30 x 20 layout and ports for every version; only the module requests differ (and, for speed modules, belt and inserter tier). Figures are per copy, per minute, measured from each version\'s own native report (iron ore; copper measured the same figures). "Forwarded" is what leaves east when a full red belt (1,800 ore/min) comes in. Power is the electric network input of one working copy (furnaces, inserters, roboports), measured. Computed: from the 2.1.24 prototype numbers. Speed versions put plates out on a red belt; one red belt of ore feeds the copies shown, the last one partly.');L('');
 L('| Version | Modules | Ore in | Plates out | Forwarded from a full red belt | Copies per red belt | Power (measured) | Computed ore in / plates out | Offered |');L('| --- | --- | ---: | ---: | ---: | --- | ---: | --- | --- |');
 for(const b of built){const x=b.manifest,s=x.measured,c=x.computed,full=Math.floor(c.copiesPerRedBelt+1e-9),rest=1800-full*c.orePerMinute;
  L(`| ${b.v.label} | ${x.modules.count?x.modules.count+' × '+x.modules.module.replaceAll('-',' '):'none'} | ${s?n(s.ironOrePerMinute):'not measured'} | ${s?n(s.ironPlatesPerMinute):'not measured'} | ${s?n(s.forwardedFromFullRedBeltPerMinute):'not measured'} | ${full}${rest>1?` + ${n(rest)} ore/min`:''} | ${s?n(s.powerKW)+' kW':'not measured'} | ${n(c.orePerMinute)} / ${n(c.platesPerMinute)} | ${b.include?'yes':'no: '+b.leftOut} |`);}
 L('');
 const eff=m.efficiencyHigherTiers;
 L(`Efficiency modules 2 and 3 are not separate versions: they give the same rates as no modules and lower power. Computed from the prototype numbers, the 24 furnaces' working power is ${eff.computed.map(e=>n(e.furnacePowerKW)+' kW with '+e.module.replaceAll('-',' ')).join(' and ')} (consumption cannot fall below 20%, so tier 3 is no better than tier 2), against ${n(computedRates('efficiency-module').furnacePowerKW)} kW with efficiency modules and ${n(computedRates(null).furnacePowerKW)} kW with none; the furnaces' idle drain (measured 144 kW for 24 furnaces in every version, unchanged by modules) comes on top.${eff.measured?` Measured in the main run with the modules swapped in by script: ${n(eff.measured.efficiencyTwoPowerKW)} kW and ${n(eff.measured.efficiencyThreePowerKW)} kW for the whole copy, at ${n(eff.measured.efficiencyTwoPlatesPerMinute)} and ${n(eff.measured.efficiencyThreePlatesPerMinute)} plates per minute.`:''} Quality modules are not offered.`);
 L('');
 L('Each version\'s string, manifest and native report: the main one in this folder, the others in `versions/<name>/`.');L('');
 L('Ports of the main (no-module) string; the versions differ only in the rates and, for speed modules, a red plate belt.');L('');
 L('| Port | Side | Tile (x, y) | Belt | What |');L('| --- | --- | --- | --- | --- |');
 for(const p of [m.inputs[0],m.forward[0],m.outputs[0]])L(`| ${p.label} | ${p.externalSide} | (${p.tile.x}, ${p.tile.y}) | ${p.transport} | ${p.note} |`);
 L('');L(`Tiles count from the top-left tile (0, 0) of the ${m.footprint.width} x ${m.footprint.height} rectangle. Row 1 is the second row from the top. Electricity: any of the four substations.`);L('');
 L('## Chaining stations');L('');
 L(`- Pitch: **${m.chaining.pitch} tiles east**, touching: the west column of the next copy is the column right after the east column of this one. The forwarded ore of one copy runs straight into the entrance splitter of the next.`);
 L(`- Copies side by side share **one electric network**: the substations of neighbouring copies are 14 tiles apart and connect by themselves when the blueprint is built (measured with both copies built from the blueprint as ghosts and revived: one copper wire between the two copies, the second copy powered only through it). The roboports of neighbouring copies are 30 tiles apart and do not collide.`);
 L(`- **Red belt (1,800 ore/min): two copies at full rate.** Measured: ${n(rate(sc('pair-iron-red'),'measure','plates',1,'iron-plate'))} and ${n(rate(sc('pair-iron-red'),'measure','plates',2,'iron-plate'))} plates per minute, nothing left over at the east end.`);
 L(`- **Yellow belt (900 ore/min): one copy.** The first copy fills first and the second gets what is left (measured: ${n(rate(sc('pair-iron-yellow'),'measure','plates',1,'iron-plate'))} and ${n(rate(sc('pair-iron-yellow'),'measure','plates',2,'iron-plate'))} per minute).`);
 L(`- **Blue belt (2,700 ore/min): three copies' worth of ore, but the ore line inside each copy is red** (its entrance splitter, the row-1 belts and its one underground pair), so it passes at most 1,800 per minute: as built, a blue belt still feeds only two copies. Upgrade those parts of every copy to blue (express) to feed three. This is belt-speed arithmetic; the blue case was not run.`);
 L('');
 L('## Measured');L('');
 if(report){
  L(`Protocol per scenario: ${pm.warmupMinutes} min warm-up, then ${pm.measureMinutes} min measured, ${pm.blockedMinutes} min "blocked" phase (only scenario 4 blocks anything), ${pm.settleMinutes} min settle, ${pm.recoveryMinutes} min recovery. Ore is fed saturated on an external belt of the scenario's tier; exits run onto short belts emptied every tick. Pass bar: ${n(report.passBar.platesPerMinute)} plates per minute (98% of ${t}) and every furnace within 2% of the mean crafts of its copy. ${report.policies.modules} ${report.policies.research} ${report.policies.power}`);L('');
  L('| # | Scenario | Result | Measured (per minute) |');L('| --- | --- | --- | --- |');
  const s1=sc('single-iron-red'),s2=sc('pair-iron-red'),s3=sc('pair-iron-yellow'),s4=sc('pair-iron-red-copy1-plates-blocked'),s5=sc('single-iron-red-east-unconnected'),s6=sc('single-copper-red'),s7=sc('single-stone-red');
  L(`| 1 | One copy, red belt of iron ore | ${mark(s1)} | ${n(rate(s1,'measure','plates',1,'iron-plate'))} iron plates south (${pct(rate(s1,'measure','plates',1,'iron-plate'))}); ${furn(s1,'measure',1)}; ${n(rate(s1,'measure','east',1,'iron-ore'))} ore forwarded east; no ore on the plate belt, no plates on the ore exit |`);
  L(`| 2 | Two copies at the pitch, red belt | ${mark(s2)} | ${n(rate(s2,'measure','plates',1,'iron-plate'))} and ${n(rate(s2,'measure','plates',2,'iron-plate'))}; one electric network (${s2?.copperWiresBetweenCopies} copper wire between copies), copy 2 powered only through it |`);
  L(`| 3 | Two copies, yellow belt | ${mark(s3)} | belt accepted ${n(s3?.measure?.fedPerMinute)}; copy 1 ${n(rate(s3,'measure','plates',1,'iron-plate'))}, copy 2 ${n(rate(s3,'measure','plates',2,'iron-plate'))}; still ${n(rate(s3,'recovery','plates',1,'iron-plate'))} for copy 1 in the last 10 minutes |`);
  L(`| 4 | Copy 1's plate exit blocked | ${mark(s4)} | before: ${n(rate(s4,'measure','plates',1,'iron-plate'))} / ${n(rate(s4,'measure','plates',2,'iron-plate'))}; blocked: copy 1 made ${s4?.blocked?.copy1CraftsInLastMinute} plates in the last minute, copy 2 ${n(rate(s4,'blocked','plates',2,'iron-plate'))} with ${n(rate(s4,'blocked','east',2,'iron-ore'))} ore passing on east; after unblocking: copy 1 ${n(rate(s4,'recovery','plates',1,'iron-plate'))}, copy 2 ${n(rate(s4,'recovery','plates',2,'iron-plate'))} |`);
  L(`| 5 | East end unconnected | ${mark(s5)} | ${n(rate(s5,'measure','plates',1,'iron-plate'))} plates, ${n(rate(s5,'recovery','plates',1,'iron-plate'))} in the last 10 minutes; ${furn(s5,'measure',1)} |`);
  L(`| 6 | One copy, copper ore | ${mark(s6)} | ${n(rate(s6,'measure','plates',1,'copper-plate'))} copper plates (${pct(rate(s6,'measure','plates',1,'copper-plate'))}); ${furn(s6,'measure',1)}; ${n(rate(s6,'measure','east',1,'copper-ore'))} ore forwarded |`);
  L(`| 7 | One copy, stone (not a pass condition) | ${mark(s7)} | ${n(rate(s7,'measure','plates',1,'stone-brick'))} stone bricks (${pct(rate(s7,'measure','plates',1,'stone-brick'))} of ${t}); ${furn(s7,'measure',1)}; ${n(rate(s7,'measure','east',1,'stone'))} stone forwarded |`);
  L('');
  L(`Stone works at a reduced rate: a brick takes 2 stone, so each furnace needs 1.25 stone per second at full speed, twice what iron or copper needs, and the slowest furnaces did not get it (fewest crafts above). Expect about ${n(rate(s7,'measure','plates',1,'stone-brick'))} bricks per minute from a saturated red belt.`);
  L('');L(`Report: \`native-report.json\` (created ${report.createdAt}, run folder \`${report.runRoot}\`, git-ignored).`);
 }else L('No report yet.');
 L('');
 L('## Size, before and after');L('');
 const names=[...new Set([...Object.keys(m.construction),...Object.keys(m.source.construction)])].sort();
 L('| | Original | This station |');L('| --- | ---: | ---: |');
 L(`| Footprint | ${m.source.footprint.width} x ${m.source.footprint.height} = ${m.source.footprint.width*m.source.footprint.height} tiles | ${m.footprint.width} x ${m.footprint.height} = ${m.footprint.width*m.footprint.height} tiles |`);
 L(`| Entities | ${m.source.entityCount} | ${m.entityCount} |`);
 for(const k of names)L(`| ${k} | ${m.source.construction[k]||0} | ${m.construction[k]||0} |`);
 L('');
 L('## What changed from the original');L('');
 L(`- Original ports: ${m.source.ports}`);
 for(const c of m.changes)L('- '+c);
 L('- Tiers (no-module, efficiency and productivity versions) are unchanged except for two red (fast) splitters, the tier of the red belts and underground belts the original already used: the entrance splitter has to pass a red belt, and the first split splitter takes the full 900 ore per minute. No beacons, no bulk or stack inserters, no circuit wires, no higher-tier machines. The speed versions use the same tiles with every belt, underground belt and splitter red and every inserter fast.');
 L('');
 L('## Layout');L('');
 L('```');L(ascii(list));L('```');L('');
 L('`F` electric furnace, `S` substation, `R` roboport, `i` inserter, `f` fast inserter, `> v < ^` yellow belts, `} V { A` red belts, `U`/`O` red underground entry/exit, `u`/`o` yellow underground entry/exit, `Q` red splitter, `P` yellow splitter. Ore enters at (0,1), leaves at (29,1); plates leave at (29,19).');
 L('');L('The original, for comparison (ore in at the west on row 13, plates out at the west on row 9):');L('');
 L('```');L(ascii(originalList));L('```');L('');
 L('## Reproduce');L('');
 L('From `factorio-command-center/`:');L('');
 L('```');L(`node scripts/${ID}/generate.mjs     # writes ${ID}.txt, manifest.json and this README`);L(`node --test tests/${ID}.test.mjs`);L(`FACTORIO_RAW=<2.1.24 Space Age data-raw-dump.json> node scripts/${ID}/validate.mjs   # headless, private profile under .cache/${ID}/`);L(`node scripts/${ID}/generate.mjs     # again, to take the measured figures into the manifest and README`);L('```');
 return lines.join('\n')+'\n';
}
