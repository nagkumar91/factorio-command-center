import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {ID,SOURCE,PROTOTYPE,SIZE,VARIANTS,MAIN_VARIANT,computedRates} from '../scripts/electric-smelter-pass-through/shared.mjs';

// The dump counts as installed only when it can be opened; tests that need it skip otherwise.
const readable=p=>{try{closeSync(openSync(p,'r'));return true;}catch{return false;}};
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/'+ID+'/';
const [m]=JSON.parse(await read(dir+'manifest.json'));
const code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const E=4,W=12;
function tiles(e,dx=0){const [w0,h0]=SIZE[e.name]||[1,1],[w,h]=[E,W].includes(e.direction||0)?[h0,w0]:[w0,h0],t=[];
 for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++)t.push([x+dx,y]);return t;}
const occupied=(list,dx=0)=>{const map=new Map();for(const e of list)for(const [x,y] of tiles(e,dx)){assert.ok(!map.has(x+','+y),`overlap at ${x},${y}`);map.set(x+','+y,e);}return map;};
const grid=occupied(entities);
const at=(x,y)=>grid.get(x+','+y);

test('the main import string is the manifest string, sized 30 x 20 with the original 24 furnaces and no modules',()=>{
 assert.equal(hash(code),m.blueprintSha256);
 assert.deepEqual(m.footprint,{width:30,height:20});
 const xs=[...grid.keys()].map(k=>+k.split(',')[0]),ys=[...grid.keys()].map(k=>+k.split(',')[1]);
 assert.deepEqual([Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)],[0,29,0,19]);
 const furnaces=entities.filter(e=>e.name==='electric-furnace');
 assert.equal(furnaces.length,24);
 for(const f of furnaces)assert.equal(f.items,undefined,'no module requests in the main string');
 assert.equal(m.variant,MAIN_VARIANT);assert.deepEqual(m.modules,{module:null,count:0});
 assert.equal(entities.length,m.entityCount);
});

test('only the original tiers: no beacons, bulk or stack inserters, circuit wires or higher-tier machines',()=>{
 const allowed=new Set(['electric-furnace','inserter','fast-inserter','transport-belt','fast-transport-belt','underground-belt','fast-underground-belt','splitter','fast-splitter','substation','roboport']);
 for(const e of entities)assert.ok(allowed.has(e.name),'unexpected entity '+e.name);
 assert.ok((bp.wires||[]).every(w=>w[1]===5&&w[3]===5),'copper power wires only');
 assert.deepEqual({inserter:m.construction.inserter,fast:m.construction['fast-inserter'],sub:m.construction.substation,robo:m.construction.roboport},{inserter:38,fast:10,sub:4,robo:2});
 assert.deepEqual([m.construction['fast-transport-belt'],m.construction['fast-underground-belt'],m.construction['fast-splitter']],[97,32,5],'red belts, undergrounds and splitters');
});

test('ports: ore in west and forwarded east on the same row, plates out south in the last column',()=>{
 const port=kind=>m.ports.find(p=>p.kind===kind);
 const entrance=port('input'),forward=port('forward'),exit=port('output');
 assert.deepEqual([entrance.externalSide,forward.externalSide,exit.externalSide],['west','east','south']);
 assert.equal(entrance.tile.y,forward.tile.y,'entrance and forwarded ore on one row');
 assert.equal(entrance.tile.x,0);assert.equal(forward.tile.x,m.footprint.width-1);assert.equal(exit.tile.y,m.footprint.height-1);
 const split=entities.find(e=>e.entity_number===entrance.entity);
 assert.equal(split.name,'fast-splitter');assert.equal(split.direction,E);assert.equal(split.output_priority,'right','priority to the south output: the station');
 assert.equal(at(entrance.tile.x,entrance.tile.y),split);
 const last=at(forward.tile.x,forward.tile.y);assert.equal(last.name,'fast-transport-belt');assert.equal(last.direction,E);
 const plates=at(exit.tile.x,exit.tile.y);assert.equal(plates.name,'fast-transport-belt');assert.equal(plates.direction,8);
 // The ore row is red all the way across: belts, one red underground pair, nothing else.
 for(let x=1;x<m.footprint.width;x++){const e=at(x,entrance.tile.y);if(e?.name==='roboport')continue;assert.ok(/^fast-(transport|underground)-belt$/.test(e?.name),'ore row tile '+x);assert.equal(e.direction,E);}
 const merge=entities.find(e=>e.name==='fast-splitter'&&e.direction===8&&e.position.y===m.footprint.height-1.5);
 assert.ok(merge,'plate merge splitter above the exit');assert.equal(merge.output_priority,'left','left of a south-facing splitter is the exit column (east)');
});

test('underground pairs are within reach and every input has its output',()=>{
 for(const a of entities.filter(e=>/underground/.test(e.name)&&e.type==='input')){
  const v={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]}[a.direction||0],reach=PROTOTYPE.undergroundMaxDistance[a.name];
  let found;for(let d=1;d<=reach&&!found;d++){const e=at(Math.floor(a.position.x)+v[0]*d,Math.floor(a.position.y)+v[1]*d);if(e?.name===a.name)found=e;}
  assert.ok(found&&found.type==='output'&&found.direction===a.direction,`underground ${a.entity_number} has a paired output within ${reach}`);
 }
});

test('copies at the stated pitch touch without overlapping, share power and keep roboports apart',()=>{
 assert.equal(m.chaining.pitch,m.footprint.width);
 occupied([...entities,...entities.map(e=>({...e,position:{x:e.position.x+m.chaining.pitch,y:e.position.y}}))]);
 const subs=entities.filter(e=>e.name==='substation'),reach=PROTOTYPE.substation.wireReach;
 const near=subs.some(a=>subs.some(b=>Math.hypot(b.position.x+m.chaining.pitch-a.position.x,b.position.y-a.position.y)<=reach));
 assert.ok(near,'a substation of the next copy is within wire reach');
 // Every powered entity lies in some substation's supply area.
 const area=PROTOTYPE.substation.supplyAreaDistance;
 for(const e of entities.filter(e=>/furnace|inserter|roboport/.test(e.name)))assert.ok(subs.some(s=>tiles(e).some(([x,y])=>Math.abs(x+.5-s.position.x)<area&&Math.abs(y+.5-s.position.y)<area)),'powered '+e.entity_number);
});

test('the Autosaved original is kept and credited',async()=>{
 const original=(await read(dir+SOURCE.file)).toString();
 assert.equal(m.source.id,'autosaved-f3d991e31c13c301');assert.equal(m.source.url,'https://autosaved.org/factorio/blueprints');
 assert.equal(hash(original.trim()),m.source.blueprintSha256);assert.equal(hash(original),m.source.fileSha256);
 assert.ok(m.source.fileSha256.startsWith('0f5fc271'));
 const o=decodeBlueprint(original).blueprint;assert.equal(o.label,'In-Out Electric Smelter');assert.equal(o.entities.length,m.source.entityCount);
 const readme=(await read(dir+'README.md')).toString();
 for(const s of ['autosaved-f3d991e31c13c301','https://autosaved.org/factorio/blueprints','What changed from the original'])assert.ok(readme.includes(s),'README mentions '+s);
});

test('the native report passes for this exact string and the manifest carries its figures',async()=>{
 const report=await loadReport();
 assert.equal(report.blueprintSha256,m.blueprintSha256);assert.equal(report.prototypeSha256,PROTOTYPE.sha256);assert.equal(report.short,undefined);
 assert.equal(report.passed,true);assert.equal(m.status,'qualified');
 const build=report.builds.find(b=>b.blueprintSha256===m.blueprintSha256);assert.equal(build.passed,true);
 for(const k of ['warmupMinutes','measureMinutes','blockedMinutes','recoveryMinutes'])assert.ok(report.protocolMinutes[k]>=10,k);
 const names=report.scenarios.map(s=>s.name);
 assert.deepEqual(names,['single-iron-red','pair-iron-red','pair-iron-yellow','pair-iron-red-copy1-plates-blocked','single-iron-red-east-unconnected','single-copper-red','single-stone-red','single-iron-red-efficiency-two-power','single-iron-red-efficiency-three-power']);
 for(const s of report.scenarios.filter(s=>!s.moduleOverride))assert.deepEqual(s.measure.modulesInFurnaces.map(c=>Object.keys(c).length),Array(s.copies).fill(0),'the no-module string really runs empty: '+s.name);
 for(const s of report.scenarios.filter(s=>!s.informational)){assert.equal(s.passed,true,s.name);assert.ok(Object.values(s.checks).every(Boolean),s.name);}
 for(const id of m.products){assert.ok(build.outputsPerMinute[id]>=m.targets[id]*.98,id);assert.ok(build.recovery.outputsPerMinute[id]>=m.targets[id]*.98,id);}
 assert.deepEqual(m.measured,{...build.summary,reportCreatedAt:report.createdAt});
});

test('the generator is reproducible: a re-run gives the same files',async()=>{
 const out='.cache/'+ID+'/test-generate-'+process.pid;
 await fs.rm(new URL(out,root),{recursive:true,force:true});
 await fs.mkdir(new URL(out+'/original',root),{recursive:true});
 await fs.copyFile(new URL(dir+SOURCE.file,root),new URL(out+'/'+SOURCE.file,root));
 await fs.copyFile(new URL(dir+'native-report.json',root),new URL(out+'/native-report.json',root));
 for(const v of VARIANTS.filter(v=>v.id!==MAIN_VARIANT)){await fs.mkdir(new URL(out+'/versions/'+v.id,root),{recursive:true});await fs.copyFile(new URL(dir+'versions/'+v.id+'/native-report.json',root),new URL(out+'/versions/'+v.id+'/native-report.json',root));}
 try{
  await promisify(execFile)(process.execPath,['scripts/'+ID+'/generate.mjs','--out',out],{cwd:rootPath});
  for(const f of [m.file,'manifest.json','README.md',...VARIANTS.filter(v=>v.id!==MAIN_VARIANT).flatMap(v=>['versions/'+v.id+'/'+m.file,'versions/'+v.id+'/manifest.json'])])assert.equal((await read(out+'/'+f)).toString(),(await read(dir+f)).toString(),f);
 }finally{await fs.rm(new URL(out,root),{recursive:true,force:true});}
});

test('the prototype numbers match the official 2.1.24 dump',{skip:!readable(rawPath)&&'prototype dump not installed'},async()=>{
 const bytes=await fs.readFile(rawPath),raw=JSON.parse(bytes);
 assert.equal(hash(bytes),PROTOTYPE.sha256);
 assert.equal(raw.furnace['electric-furnace'].crafting_speed,PROTOTYPE.furnaceCraftingSpeed);
 for(const [r,s] of Object.entries(PROTOTYPE.recipeSeconds))assert.equal(raw.recipe[r].energy_required,s,r);
 for(const [b,n] of Object.entries(PROTOTYPE.beltItemsPerSecond))assert.equal(raw['transport-belt'][b].speed*60*8,n,b);
 for(const [u,d] of Object.entries(PROTOTYPE.undergroundMaxDistance))assert.equal(raw['underground-belt'][u].max_distance,d,u);
 assert.equal(raw['electric-pole'].substation.maximum_wire_distance,PROTOTYPE.substation.wireReach);
 assert.equal(raw['electric-pole'].substation.supply_area_distance,PROTOTYPE.substation.supplyAreaDistance);
 assert.deepEqual(raw.module['efficiency-module'].effect,PROTOTYPE.efficiencyModuleEffect);
 for(const [name,effect] of Object.entries(PROTOTYPE.moduleEffects))assert.deepEqual(raw.module[name].effect,effect,name);
 assert.equal(raw.furnace['electric-furnace'].module_slots,PROTOTYPE.moduleSlots);assert.equal(raw.furnace['electric-furnace'].energy_usage,PROTOTYPE.furnaceEnergyUsageKW+'kW');
 assert.equal(raw.recipe['iron-plate'].allow_productivity,true);
 for(const [name,[w,h]] of Object.entries(SIZE)){const p=Object.values(raw).map(g=>g?.[name]).find(p=>p?.collision_box);const box=p.selection_box;assert.deepEqual([Math.ceil(box[1][0]-box[0][0]),Math.ceil(box[1][1]-box[0][1])],[w,h],name);}
});

test('the library lists it as game-tested, findable by its ores, plates and electric furnaces',async()=>{
 const atlas=JSON.parse(await read('site/data/atlas.json'));
 const e=atlas.blueprints.find(b=>b.blueprintSha256===m.blueprintSha256);
 assert.ok(e,'registered');assert.equal(e.collection,'Long game flight plans and strategies');
 assert.equal(e.validation.status,'game-tested');assert.equal(e.validation.blueprintSha256,m.blueprintSha256);
 assert.deepEqual(e.products,['iron-plate','copper-plate']);assert.deepEqual(e.analysis.inputs,['iron-ore','copper-ore']);
 assert.ok(/smelter/i.test(e.name));assert.ok(e.entries.some(r=>r.id==='electric-furnace'));
 assert.ok(/autosaved-f3d991e31c13c301/.test(e.author));
 assert.equal(e.publication.history.length,m.versions.length-1,'every module version is selectable');
 assert.ok(e.publication.inputsPerMinute&&Number.isFinite(e.publication.powerKW));for(const h of e.publication.history)assert.ok(h.inputsPerMinute&&Number.isFinite(h.powerKW),h.label);
 const page=(await read('site/'+ID+'/index.html')).toString();
 assert.ok(page.includes(m.blueprintSha256)&&page.includes('autosaved-f3d991e31c13c301'));
});

test('module versions: same layout, two modules of one kind per furnace, each with a passing report for its exact string',async()=>{
 assert.equal(m.versions[0].blueprintSha256,m.blueprintSha256);assert.equal(m.versions[0].label,'No modules');
 const UP={inserter:'fast-inserter','transport-belt':'fast-transport-belt','underground-belt':'fast-underground-belt',splitter:'fast-splitter'};
 for(const v of VARIANTS.filter(v=>v.id!==MAIN_VARIANT)){
  const d=dir+'versions/'+v.id+'/',[vm]=JSON.parse(await read(d+'manifest.json')),vcode=(await read(d+vm.file)).toString().trim(),vbp=decodeBlueprint(vcode).blueprint;
  assert.equal(hash(vcode),vm.blueprintSha256);assert.equal(vm.variant,v.id);
  assert.equal(vbp.entities.length,entities.length);
  vbp.entities.forEach((e,i)=>{const base=entities[i];assert.deepEqual(e.position,base.position);assert.equal(e.direction,base.direction);assert.equal(e.name,v.fast?(UP[base.name]||base.name):base.name);
   if(e.name==='electric-furnace')assert.deepEqual(e.items,[{id:{name:v.module},items:{in_inventory:[{inventory:4,stack:0},{inventory:4,stack:1}]}}]);});
  assert.deepEqual(vm.expected,{orePerMinute:computedRates(v.module).orePerMinute,platesPerMinute:computedRates(v.module).platesPerMinute});
  const report=JSON.parse(await read(d+'native-report.json')),build=report.builds.find(b=>b.blueprintSha256===vm.blueprintSha256);
  assert.equal(report.passed,true,v.id);assert.equal(build.passed,true,v.id);assert.equal(vm.status,'qualified');
  for(const s of report.scenarios)assert.deepEqual(s.measure.modulesInFurnaces.map(c=>c[v.module]),Array(s.copies).fill(48),'modules really in the furnaces: '+v.id+' '+s.name);
  assert.ok(build.outputsPerMinute['iron-plate']>=vm.expected.platesPerMinute*.98,v.id);
  assert.ok(Number.isFinite(build.powerKW)&&build.inputsPerMinute['iron-ore']>0,v.id);
  const listed=m.versions.find(x=>x.blueprintSha256===vm.blueprintSha256),row=m.variants.find(x=>x.variant===v.id);
  assert.equal(!!listed,row.included,v.id);
  if(v.fast)assert.equal(row.included,build.outputsPerMinute['iron-plate']>m.measured.ironPlatesPerMinute,'a speed version is offered only when it beats no modules');
  if(listed){assert.deepEqual(listed.inputsPerMinute,build.inputsPerMinute);assert.equal(listed.powerKW,build.powerKW);}
 }
});

test('red belts only: no yellow belt, underground belt or splitter in any offered version; yellow strings kept in history',async()=>{
 const yellow=new Set(['transport-belt','underground-belt','splitter']);
 for(const v of m.versions){const vb=decodeBlueprint((await read(dir+v.file)).toString()).blueprint;assert.ok(vb.entities.every(e=>!yellow.has(e.name)),v.label);}
 assert.deepEqual(m.redBeltBuild.yellowPartsMadeRed,{'transport-belt':64,'underground-belt':6,splitter:3});
 assert.deepEqual(m.redBeltBuild.extraCostPerCopy,{'iron-gear-wheel':470,'electronic-circuit':30,'iron-plate':940});
 for(const h of m.redBeltBuild.history){
  const [hm]=JSON.parse(await read(dir+h+'manifest.json')),hcode=(await read(dir+h+hm.file)).toString().trim();
  assert.equal(hash(hcode),hm.blueprintSha256);assert.ok(decodeBlueprint(hcode).blueprint.entities.some(e=>yellow.has(e.name)),h+' is the yellow string');
  assert.ok(!m.versions.some(v=>v.blueprintSha256===hm.blueprintSha256),h+' is not offered');
  assert.equal(JSON.parse(await read(dir+h+'native-report.json')).passed,true);await read(dir+h+'NOTE.md');
 }
 // The speed strings did not change with the red-belt round.
 const speed={'speed-one':'56b17478ff1699ff4dbc57c5c9d8ac8167d220873ab4e362adc83f7008cdce18','speed-two':'a4eb07abac1f80a6938e46d77c6f1ceca10b9035c2c229b848299f08f006f3e6','speed-three':'bcfe2ab13244575f2ca2e4315a40d4f2bf8ac295a97700d68eb9b1e98a188be6'};
 for(const [id,sha] of Object.entries(speed))assert.equal(hash((await read(dir+'versions/'+id+'/'+m.file)).toString().trim()),sha,id);
});

test('red upgrade costs match the official 2.1.24 recipes',{skip:!readable(rawPath)&&'prototype dump not installed'},async()=>{
 const raw=JSON.parse(await fs.readFile(rawPath));
 for(const [yellow,extra] of Object.entries(PROTOTYPE.redUpgradeExtra)){const r=raw.recipe['fast-'+yellow],made=r.results[0].amount;
  const per=Object.fromEntries(r.ingredients.filter(i=>i.name!==yellow).map(i=>[i.name,i.amount/made]));assert.deepEqual(per,extra,yellow);
  assert.equal(r.ingredients.find(i=>i.name===yellow).amount/made,1,yellow+': one yellow part per red part');}
 assert.equal(raw.recipe['iron-gear-wheel'].ingredients[0].amount,PROTOTYPE.ironPlatesPerGear);
});
