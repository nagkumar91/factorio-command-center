import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const root=new URL('..',import.meta.url),source=new URL('blueprint-sources/flight-science-sided/full/',root),sha=s=>createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',source)));
const expected={'iron-plate':2970,'copper-plate':4770,'steel-plate':735,'plastic-bar':1040,sulfur:30,coal:300,'stone-wall':60,stone:700,'sulfuric-acid':1000,lubricant:300};
function cells(e){let w=1,h=1;if(['assembling-machine-2','chemical-plant','electric-furnace'].includes(e.name))w=h=3;if(e.name==='big-electric-pole')w=h=2;if(e.name==='fast-splitter'){w=[4,12].includes(e.direction)?1:2;h=[4,12].includes(e.direction)?2:1;}const out=[];for(let x=e.position.x-w/2;x<e.position.x+w/2;x++)for(let y=e.position.y-h/2;y<e.position.y+h/2;y++)out.push(`${x},${y}`);return out;}
for(const m of manifest){
 const code=(await fs.readFile(new URL(m.file,source),'utf8')).trim(),bp=decodeBlueprint(code).blueprint;
 test(`${m.id}: exact normal-quality blueprint, ingredients and clear sided ports`,()=>{
  assert.equal(sha(code),m.blueprintSha256);assert.equal(m.gameVersion,'2.1.24');assert.equal(m.products.length,6);
  const byId=new Map(bp.entities.map(e=>[e.entity_number,e])),grid=new Map();
  for(const e of bp.entities){assert.equal(e.tags.flight_science_entity,e.entity_number);assert(!e.items?.length,'No installed modules');assert(!e.quality||e.quality==='normal');assert(!e.name.includes('roboport')&&!e.name.includes('logistic-chest')&&!e.name.includes('beacon'));for(const c of cells(e)){assert(!grid.has(c),`Overlap at ${c}`);grid.set(c,e);}}
  const incoming=[...m.inputs,...m.fluids],totals={};for(const p of incoming)totals[p.item]=(totals[p.item]||0)+p.perMinute;
  for(const [n,r]of Object.entries(expected)){assert(Math.abs(totals[n]-r)<1e-6,`${n} demand`);assert(Math.abs(m.externalInputsPerMinute[n]-r)<1e-6);}
  assert.deepEqual(Object.keys(totals).sort(),Object.keys(expected).sort());assert.equal(m.machineCounts['stone-brick'],6);assert.equal(bp.entities.filter(e=>e.name==='chemical-plant').length,m.machineCounts.battery);
  const machinery=bp.entities.filter(e=>['assembling-machine-2','chemical-plant','electric-furnace'].includes(e.name)),left=Math.min(...machinery.map(e=>e.position.x-1.5)),right=Math.max(...machinery.map(e=>e.position.x+1.5));
  for(const p of m.ports.filter(p=>p.kind!=='power')){const e=byId.get(p.entity);assert.equal(e.position.x,p.x);assert.equal(e.position.y,p.y);assert.equal(byId.get(p.displayEntity)?.name,'display-panel');assert.equal(p.externalSide,p.kind==='output'?'east':'west');assert(p.kind==='output'?p.x>right:p.x<left);for(let i=1;i<=3;i++)assert(!grid.has(`${Math.floor(p.x)+(p.kind==='output'?i:-i)},${Math.floor(p.y)}`),`Blocked approach ${p.label}`);}
  for(const p of m.products)assert(Math.abs(m.outputs.filter(o=>o.item===p).reduce((a,o)=>a+o.perMinute,0)-60)<1e-8);
  for(const w of bp.wires)assert(byId.has(w[0])&&byId.has(w[2]),'Dangling wire');
 });
 test(`${m.id}: full native evidence matches the saved blueprint and harness`,async()=>{
  const report=JSON.parse(await fs.readFile(new URL('native-report.json',source))),b=report.builds.find(b=>b.id===m.id);
  assert(report.passed&&b.passed);assert(!report.short);assert.equal(report.warmupMinutes,15);assert.equal(report.measurementMinutes,30);assert.equal(report.prototypeSha256,m.prototypeSha256);assert.equal(report.harnessSha256,sha(await fs.readFile(new URL('tests/flight-science-sided-full-control.lua',root))));assert.equal(b.blueprintSha256,m.blueprintSha256);
  assert(b.powered&&b.externalApproachesClear);assert.equal(b.importedEntities,bp.entities.length);assert(b.exactRecipeChecks>0);
  for(const product of m.products){assert(b.outputsPerMinute[product]>=59.5,product);assert(b.recovery.outputsPerMinute[product]>=59.5,product+' recovery');}
  assert.equal(b.recovery.blockedMinutes,5);assert.equal(b.recovery.settlingMinutes,2);assert.equal(b.recovery.measurementMinutes,3);
  assert(b.inputs.every(p=>p.acceptedDuringMeasurement>0&&p.productiveRoute?.length));assert(b.fluids.every(p=>p.acceptedDuringMeasurement>0&&p.productiveConsumers?.length));assert(b.machines.every(p=>p.measuredCrafts>0));assert(b.outputPorts.every(p=>p.collectedDuringMeasurement>0));
 });
 test(`${m.id}: offline map and import string represent this exact blueprint`,async()=>{
  const site=new URL('site/flight-science-sided/full/',root),svg=await fs.readFile(new URL(m.id+'.svg',site),'utf8');assert(svg.includes(m.blueprintSha256));assert.equal((svg.match(/data-entity=/g)||[]).length,bp.entities.length);assert.equal((await fs.readFile(new URL(m.file,site),'utf8')).trim(),code);assert(!svg.includes('https://'));
 });
}
