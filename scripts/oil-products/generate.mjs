// Oil-products supplier: crude oil and water in, petroleum gas, sulfuric acid, lubricant, light oil and sulfur out.
// Sized for one standard 30-per-minute science factory plus one medium plastic supplier (see shared.mjs, design()).
// Pure Node and reproducible: no game data is needed (the prototype facts are in shared.mjs). When the 2.1.24 dump
// is readable (FACTORIO_RAW or the pinned path) every embedded fact is compared with it before anything is written.
// It keeps the committed string when a regeneration decodes to exactly the same blueprint (zlib bytes differ between
// machines), so the SHA-256 and the native report stay valid everywhere.
// Usage: node scripts/oil-products/generate.mjs [--out dir]
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
import {ID,PROTOTYPE,SIZE,TARGET,THRESHOLD,design,SURVEY,copiesNeeded} from './shared.mjs';
import {build,VARIANTS,MAIN_VARIANT} from './variants.mjs';
import {readme} from './readme.mjs';
import {verifyPrototype} from './prototype-check.mjs';

const args=process.argv.slice(2),flag=(n,f)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:f;};
const out=flag('out','blueprint-sources/'+ID);
const sha=s=>createHash('sha256').update(s).digest('hex');
const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
let rawBytes=null;try{rawBytes=readFileSync(RAW);}catch{}
if(rawBytes)verifyPrototype(rawBytes);

const D=design();
export const PROTOCOL={warmupMinutes:30,measureMinutes:60,blockedMinutes:60,settleMinutes:15,recoveryMinutes:60};
const panel={'petroleum-gas':D.gasExport,'sulfuric-acid':TARGET['sulfuric-acid'],lubricant:TARGET.lubricant,sulfur:TARGET.sulfur,'light-oil':TARGET.lightOutletScenario};
const DRAW={'petroleum-gas':D.gasExport,'sulfuric-acid':TARGET['sulfuric-acid'],lubricant:TARGET.lubricant,sulfur:TARGET.sulfur,'light-oil':0};
const FEED={'crude-oil':D.full.crude,water:D.full.water,'iron-plate':D.full.iron};
// Scenarios: one copy of the blueprint each, run side by side in one native game. Phase draws are per minute.
const w=(o,k,v)=>({...o,[k]:v}),G6=o=>({...DRAW,'petroleum-gas':TARGET.gasForPlastic,...o});
const blockedPhases=item=>[{name:'warm-up',minutes:'warmupMinutes',draw:DRAW},{name:'blocked',minutes:'blockedMinutes',draw:w(DRAW,item,0)},{name:'settle',minutes:'settleMinutes',draw:DRAW},{name:'recovery',minutes:'recoveryMinutes',draw:DRAW}];
export const SCENARIOS=[
 {id:'design',title:'Everything drawn at the design rates',phases:[{name:'warm-up',minutes:'warmupMinutes',draw:DRAW},{name:'measure',minutes:'measureMinutes',draw:DRAW}]},
 {id:'acid-blocked',title:'Sulfuric acid not drawn, then drawn again',blocked:'sulfuric-acid',phases:blockedPhases('sulfuric-acid')},
 {id:'lubricant-blocked',title:'Lubricant not drawn, then drawn again',blocked:'lubricant',phases:blockedPhases('lubricant')},
 {id:'sulfur-blocked',title:'Sulfur belt not taken, then taken again',blocked:'sulfur',phases:blockedPhases('sulfur')},
 {id:'gas-blocked',title:'Petroleum gas not drawn, then drawn again',blocked:'petroleum-gas',phases:blockedPhases('petroleum-gas')},
 {id:'light-oil-660',title:'Light oil drawn at 660/min (the rocket-fuel supplier)',phases:[{name:'warm-up',minutes:'warmupMinutes',draw:w(DRAW,'light-oil',660)},{name:'measure',minutes:'measureMinutes',draw:w(DRAW,'light-oil',660)}]},
 {id:'feed-80',title:'Crude oil, water and iron fed at 80% of the panel figures',phases:[{name:'warm-up',minutes:'warmupMinutes',feedScale:0.8,draw:DRAW},{name:'measure',minutes:'measureMinutes',feedScale:0.8,draw:DRAW}]},
 // Informational (not part of the pass). With one medium plastic supplier attached the gas export is drawn at its
 // 6,000/min, which leaves room for more sulfur, lubricant or acid; these show that headroom for the pairing table.
 // The last one pulls more gas than the copy makes, to show what an over-drawn gas export takes from.
 {id:'sulfur-30',informational:true,title:'Sulfur belt taken at 30/min, gas drawn at 6,000/min (informational)',phases:[{name:'warm-up',minutes:'warmupMinutes',draw:G6({sulfur:30})},{name:'measure',minutes:'measureMinutes',draw:G6({sulfur:30})}]},
 {id:'lubricant-300',informational:true,title:'Lubricant drawn at 300/min, gas drawn at 6,000/min (informational)',phases:[{name:'warm-up',minutes:'warmupMinutes',draw:G6({lubricant:300})},{name:'measure',minutes:'measureMinutes',draw:G6({lubricant:300})}]},
 {id:'acid-1000',informational:true,title:'Sulfuric acid drawn at 1,000/min with iron 20/min and water 13,380/min, gas drawn at 6,000/min (informational)',phases:[
  {name:'warm-up',minutes:'warmupMinutes',feed:{'iron-plate':20,water:D.full.water+500},draw:G6({'sulfuric-acid':1000})},{name:'measure',minutes:'measureMinutes',feed:{'iron-plate':20,water:D.full.water+500},draw:G6({'sulfuric-acid':1000})}]},
 {id:'gas-overdrawn',informational:true,title:'Petroleum gas pulled at 9,000/min, more than the copy makes (informational)',phases:[{name:'warm-up',minutes:'warmupMinutes',draw:DRAW},{name:'measure',minutes:'measureMinutes',draw:w(DRAW,'petroleum-gas',9000)}]},
];

const variantsOut=[];
for(const variant of [MAIN_VARIANT,...Object.keys(VARIANTS).filter(v=>v!==MAIN_VARIANT)]){
 const main=variant===MAIN_VARIANT,rel=main?'':'candidates/'+variant+'/';
 const B=build(variant),L=B.L;
 // ---- fluid networks (model of the natively proved connection rules) ----
 const net=L.check();
 assert.deepEqual(net.problems,[],'fluid model problems');
 for(const c of net.comps)assert(c.fluids.size<=1,'mixed network');
 const fluidOf=(e,box)=>{const n=net.ends.find(n=>n.e===e&&(!box||n.box===box));return n?[...net.componentOf(n).fluids][0]:undefined;};
 const portFluid={water:'water',crude:'crude-oil',gas:'petroleum-gas',acid:'sulfuric-acid',light:'light-oil',lubricant:'lubricant'};
 for(const [k,f] of Object.entries(portFluid))assert.equal(fluidOf(B.ports[k]),f,'port '+k);
 assert.equal(fluidOf(B.roles.lightTank),'light-oil');assert.equal(fluidOf(B.roles.heavyTank),'heavy-oil');
 assert.equal(fluidOf(B.roles.gasPump,'in'),'petroleum-gas');assert.equal(fluidOf(B.roles.gasPump,'out'),'petroleum-gas');
 assert.equal(fluidOf(B.roles.lightPump,'in'),'light-oil');assert.equal(fluidOf(B.roles.lightPump,'out'),'light-oil');
 // every machine fluid connection that the recipe uses ends in a network carrying its own fluid
 for(const n of net.ends.filter(n=>n.fluid)){const f=[...net.componentOf(n).fluids];assert.deepEqual(f,[n.fluid]);}
 // ---- machine counts against the arithmetic ----
 const machineCounts={};for(const e of L.entities)if(e.recipe)machineCounts[e.recipe]=(machineCounts[e.recipe]||0)+1;
 assert.equal(machineCounts['advanced-oil-processing'],D.refineries);
 for(const [r,n] of Object.entries(D.machines))if(r!=='oil-refinery')assert.equal(machineCounts[r],n,r);
 // ---- display panels (one per port, on a free tile beside it) ----
 const bounds0=L.bounds();
 const label={water:['IN','water','fluid',FEED.water,'WEST'],crude:['IN','crude-oil','fluid',FEED['crude-oil'],'WEST'],iron:['IN','iron-plate','item',FEED['iron-plate'],'WEST'],
  gas:['OUT','petroleum-gas','fluid',D.gasExport,'EAST'],acid:['OUT','sulfuric-acid','fluid',TARGET['sulfuric-acid'],'EAST'],sulfur:['OUT','sulfur','item',TARGET.sulfur,'EAST'],
  light:['OUT','light-oil','fluid',null,'NORTH'],lubricant:['OUT','lubricant','fluid',TARGET.lubricant,'NORTH']};
 const fmt=n=>Math.round(n).toLocaleString('en-US');
 const rowOf=e=>Math.floor(e.position.y)-bounds0.y0+1,colOf=e=>Math.floor(e.position.x)-bounds0.x0+1;
 const panels={};
 for(const [k,[dir,item,type,rate,side]] of Object.entries(label)){
  const [x,y]=B.panelAt[k],p=B.ports[k];
  const where=side==='NORTH'?`column ${colOf(p)} from the west`:`row ${rowOf(p)} from the top`;
  const text=rate==null?`${dir}: light oil\n${side} · ${where} · up to ${fmt(TARGET.lightOutletScenario)}/min (each 3 drawn costs 2 gas)`:`${dir}: ${item.replace(/-/g,' ')}\n${side} · ${where} · ${fmt(rate)}/min`;
  panels[k]=L.place('display-panel',x,y,{icon:{type,name:item},text,always_show:true});
 }
 const b=L.bounds();assert.deepEqual([b.width,b.height],[bounds0.width,bounds0.height],'panels must not grow the rectangle');
 // ---- shift to the blueprint origin (top-left tile 0,0) and tag every entity for the harness ----
 const entities=L.entities.map(e=>{const c={...e,position:{x:e.position.x-b.x0,y:e.position.y-b.y0}};c.tags={flight_science_entity:e.entity_number};return c;});
 const wires=L.wires.map(x=>[...x]);
 const tile=e=>({x:Math.floor(e.position.x)-b.x0,y:Math.floor(e.position.y)-b.y0});
 const sideOf=e=>{const t=tile(e);return t.x===0?'west':t.x===b.width-1?'east':t.y===0?'north':t.y===b.height-1?'south':null;};
 const P=B.ports;
 const port=(kind,k,item,transport,perMinute,extra={})=>({kind,label:item,items:[item],item,entity:P[k].entity_number,tile:tile(P[k]),position:{x:P[k].position.x-b.x0,y:P[k].position.y-b.y0},externalSide:sideOf(P[k]),transport,perMinute,displayEntity:panels[k].entity_number,...extra});
 const inputs=[port('input','water','water','pipe',FEED.water),port('input','crude','crude-oil','pipe',FEED['crude-oil']),port('input','iron','iron-plate','red belt',FEED['iron-plate'])];
 const outputs=[port('output','gas','petroleum-gas','pipe',D.gasExport,{note:`${fmt(TARGET.gasForPlastic)} for one medium plastic supplier plus ${fmt(D.gasSurplus)} surplus`}),
  port('output','acid','sulfuric-acid','pipe',TARGET['sulfuric-acid']),port('output','lubricant','lubricant','pipe',TARGET.lubricant),
  port('output','light','light-oil','pipe',0,{upTo:TARGET.lightOutletScenario,note:'undrawn in normal use; drawing light oil lowers the gas export by two thirds of it'}),
  port('output','sulfur','sulfur','red belt',TARGET.sulfur)];
 for(const p of [...inputs,...outputs])assert(p.externalSide,'port '+p.item+' is not on an edge');
 const power={kind:'power',label:'External electricity',items:[],entity:B.subs[0].entity_number};
 const control=[{pump:B.roles.gasPump.entity_number,tank:B.roles.lightTank.entity_number,fluid:'light-oil',comparator:'>',threshold:THRESHOLD['light-oil'],role:'light-oil cracking: the pump moves the crackers\' gas into the gas chain only while the light tank holds more than the threshold'},
  {pump:B.roles.lightPump.entity_number,tank:B.roles.heavyTank.entity_number,fluid:'heavy-oil',comparator:'>',threshold:THRESHOLD['heavy-oil'],role:'heavy-oil cracking: the pump moves the crackers\' light oil into the light tank only while the heavy tank holds more than the threshold'}];
 const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length]));
 const description=`Official 2.1.24 Space Age; ${D.refineries} oil refineries (advanced oil processing) and ${D.chemicalPlants} chemical plants (${D.machines['light-oil-cracking']} light-oil cracking, ${D.machines['heavy-oil-cracking']} heavy-oil cracking, sulfur, sulfuric acid, lubricant), 2 storage tanks, 2 pumps, no modules, ${B.subs.length} substations. WEST: water ${fmt(FEED.water)}/min (pipe, top row of the west edge), crude oil ${fmt(FEED['crude-oil'])}/min (pipe, second row from the bottom), iron plates ${fmt(FEED['iron-plate'])}/min (red belt, bottom row). EAST: petroleum gas ${fmt(D.gasExport)}/min (pipe), sulfuric acid ${fmt(TARGET['sulfuric-acid'])}/min (pipe), sulfur ${fmt(TARGET.sulfur)}/min (red belt, bottom row). NORTH: lubricant ${fmt(TARGET.lubricant)}/min (pipe) and light oil (pipe; undrawn in normal use, up to ${fmt(TARGET.lightOutletScenario)}/min, each 3 drawn costs 2 gas). Cracking follows the two tanks: heavy oil is cracked only while the heavy tank holds more than ${fmt(THRESHOLD['heavy-oil'])}, light oil only while the light tank holds more than ${fmt(THRESHOLD['light-oil'])}; keep the red wires and the pump conditions. Every second refinery is mirrored; keep the pipe-to-ground pairs. Supply electricity at any substation.`;
 const bp={item:'blueprint',version:562954249961472,label:'Oil products · gas, acid, lubricant, sulfur, light oil',description,
  icons:[{index:1,signal:{name:'oil-refinery'}},{index:2,signal:{type:'fluid',name:'petroleum-gas'}},{index:3,signal:{type:'fluid',name:'sulfuric-acid'}},{index:4,signal:{type:'fluid',name:'lubricant'}}],entities,wires};
 const committed=await fs.readFile(out+'/'+rel+ID+'.txt','utf8').then(t=>t.trim(),()=>null);
 const same=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
 const code=committed&&same(committed)?committed:encodeBlueprint({blueprint:bp}),blueprintSha256=sha(code);
 let report=null;try{report=JSON.parse(await fs.readFile(out+'/'+rel+'native-report.json','utf8'));}catch{}
 const rb=report&&!report.short?report.builds?.filter(x=>x.blueprintSha256===blueprintSha256):[];
 const status=rb?.length&&rb.length===SCENARIOS.length?(report.passed?'qualified':'not-qualified'):'unverified';
 const measured=status==='unverified'?undefined:summarise(report);
 const manifest={id:main?ID:ID+'-'+variant,name:main?'Oil products supplier':'Oil products supplier · '+VARIANTS[variant].label.toLowerCase(),file:ID+'.txt',variant,variantLabel:VARIANTS[variant].label,
  blueprintSha256,prototypeSha256:PROTOTYPE.sha256,class:'rate',status,...(measured?{measured,reportCreatedAt:report.createdAt}:{}),
  footprint:{width:b.width,height:b.height},tiles:b.width*b.height,entityCount:entities.length,
  products:['petroleum-gas','sulfuric-acid','lubricant','sulfur','light-oil'],targets:{...DRAW,'light-oil':0},panel,
  inputs,outputs,fluids:inputs.filter(p=>p.transport==='pipe'),ports:[...inputs,...outputs,power],powerEntity:power.entity,
  machineCounts:{'oil-refinery':machineCounts['advanced-oil-processing'],...Object.fromEntries(Object.entries(machineCounts).filter(([k])=>k!=='advanced-oil-processing'))},
  construction,control,thresholds:THRESHOLD,
  design:D,
  recipeIngredients:Object.fromEntries(Object.keys(PROTOTYPE.recipes).map(r=>[r,PROTOTYPE.recipes[r]])),
  protocol:PROTOCOL,scenarios:SCENARIOS,
  pairing:SURVEY.map(row=>({...row,...copiesNeeded(row,panel)})),
  ascii:L.ascii().split('\n'),
  setupNotes:[description,'The two fluid entrances on the west edge are 9 rows apart and the iron belt is on the bottom row, so plain pipes and a belt can be brought straight in. The light-oil and lubricant outlets are on the north edge; gas, acid and sulfur leave east.']};
 variantsOut.push({variant,main,rel,manifest,code,report,B,L,b});
}
// The published variant's manifest also lists the screened alternative.
const [mainOut,...others]=variantsOut;
mainOut.manifest.candidates=variantsOut.map(v=>({variant:v.variant,label:VARIANTS[v.variant].label,footprint:v.manifest.footprint,tiles:v.manifest.tiles,entityCount:v.manifest.entityCount,
 blueprintSha256:v.manifest.blueprintSha256,status:v.manifest.status,published:v.main,path:v.main?ID+'.txt':v.rel+ID+'.txt',...(v.manifest.measured?{measured:{design:v.manifest.measured.scenarios?.design?.drawn}}:{})}));
await fs.mkdir(out,{recursive:true});
for(const v of variantsOut){
 await fs.mkdir(out+'/'+v.rel,{recursive:true});
 await fs.writeFile(out+'/'+v.rel+ID+'.txt',v.code+'\n');
 await fs.writeFile(out+'/'+v.rel+'manifest.json',JSON.stringify([v.manifest],null,2)+'\n');
}
await fs.writeFile(out+'/README.md',readme(mainOut.manifest,mainOut.report,others.map(o=>o.manifest)));
console.log(JSON.stringify(variantsOut.map(v=>({variant:v.variant,footprint:v.manifest.footprint,tiles:v.manifest.tiles,entities:v.manifest.entityCount,status:v.manifest.status,sha:v.manifest.blueprintSha256})),null,1));

/** Per-scenario figures from a native report (exact numbers, rounded to 0.1). */
export function summarise(report){
 const r1=v=>Math.round(v*10)/10,o=x=>Object.fromEntries(Object.entries(x||{}).map(([k,v])=>[k,r1(v)]));
 const s={};
 for(const bld of report.builds){const ph=Object.fromEntries((bld.phases||[]).map(p=>[p.name,p]));const main=ph.measure||ph.blocked;
  s[bld.scenario]={passed:bld.passed,informational:!!bld.informational,drawn:o(main?.drawnPerMinute),fed:o(main?.fedPerMinute),...(ph.recovery?{recoveryDrawn:o(ph.recovery.drawnPerMinute)}:{}),
   refineryCraftsPerMinute:r1((main?.machines||[]).filter(m=>m.recipe==='advanced-oil-processing').reduce((a,m)=>a+m.craftsPerMinute,0))};}
 return {passed:report.passed,scenarios:s};
}
