import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

// Flying-robot-frame supply (20/min) for the Compact six-pack tier's south entrance.
const dir=new URL('../blueprint-sources/flight-science-sided/heavy-supplies/flying-robot-frame-supply/',import.meta.url);
const sha=v=>createHash('sha256').update(v).digest('hex');
const [m]=JSON.parse(fs.readFileSync(new URL('manifest.json',dir)));
const code=fs.readFileSync(new URL(m.file,dir),'utf8').trim();
const bp=decodeBlueprint(code).blueprint;
const report=JSON.parse(fs.readFileSync(new URL('native-report.json',dir)));
const size=e=>['assembling-machine-2','chemical-plant'].includes(e.name)?3:e.name==='big-electric-pole'?2:1;

test('exact string, footprint and machine counts match the manifest',()=>{
 assert.equal(sha(code),m.blueprintSha256);
 const tiles=new Map();
 for(const e of bp.entities){const s=size(e);for(let x=e.position.x-s/2;x<e.position.x+s/2;x++)for(let y=e.position.y-s/2;y<e.position.y+s/2;y++){const k=x+','+y;assert(!tiles.has(k),'overlap '+k);tiles.set(k,e);}}
 const xs=[...tiles.keys()].map(k=>+k.split(',')[0]),ys=[...tiles.keys()].map(k=>+k.split(',')[1]);
 assert.equal(Math.max(...xs)-Math.min(...xs)+1,m.footprint.width);
 assert.equal(Math.max(...ys)-Math.min(...ys)+1,m.footprint.height);
 assert.deepEqual([m.footprint.width,m.footprint.height],[31,15]);
 const counts={};for(const e of bp.entities.filter(e=>e.recipe))counts[e.recipe]=(counts[e.recipe]||0)+1;
 assert.deepEqual(counts,m.machineCounts);
 assert.deepEqual(m.machineCounts,{'flying-robot-frame':9,'electric-engine-unit':5,'engine-unit':5,'iron-gear-wheel':1,pipe:1,battery:3});
 assert(bp.entities.filter(e=>e.recipe==='battery').every(e=>e.name==='chemical-plant'));
 assert(bp.entities.filter(e=>e.recipe&&e.recipe!=='battery').every(e=>e.name==='assembling-machine-2'));
});

test('family conventions: entity tiers, no modules, one west inlet per material with a panel, east chest outlet',()=>{
 const allowed=new Set(['assembling-machine-2','chemical-plant','fast-inserter','fast-transport-belt','fast-underground-belt','pipe','pipe-to-ground','steel-chest','display-panel','medium-electric-pole','big-electric-pole']);
 assert(bp.entities.every(e=>allowed.has(e.name)),[...new Set(bp.entities.map(e=>e.name))].join());
 assert(bp.entities.every(e=>!e.items));
 const machines=bp.entities.filter(e=>e.recipe),west=Math.min(...machines.map(e=>e.position.x-1.5)),east=Math.max(...machines.map(e=>e.position.x+1.5));
 const inlets=m.ports.filter(p=>['input','fluid'].includes(p.kind));
 assert.deepEqual(inlets.map(p=>p.items[0]).sort(),['copper-plate','electronic-circuit','iron-plate','lubricant','steel-plate','sulfuric-acid']);
 assert(inlets.every(p=>p.externalSide==='west'&&p.x<west&&p.x===inlets[0].x));
 const want={'iron-plate':120,'copper-plate':40,'steel-plate':40,'electronic-circuit':100,lubricant:300,'sulfuric-acid':800};
 for(const p of inlets){assert.equal(p.perMinute,want[p.items[0]]);const panel=bp.entities.find(e=>e.entity_number===p.displayEntity);assert.equal(panel.name,'display-panel');assert(panel.text.includes(p.items[0])&&panel.text.includes(p.perMinute+'/min'));
  const e=bp.entities.find(e=>e.entity_number===p.entity);assert.equal(e.name,p.kind==='fluid'?'pipe-to-ground':'fast-transport-belt');}
 const [out]=m.ports.filter(p=>p.kind==='output');assert.equal(out.externalSide,'east');assert(out.x>east);
 assert.equal(bp.entities.find(e=>e.entity_number===out.entity).name,'steel-chest');
 assert.equal(m.loopControl.length,1);assert(m.loopControl[0].controlled.length>0);
});

test('native qualification for the exact SHA-256',()=>{
 assert.equal(report.passed,true);assert.equal(report.short,false);assert.equal(report.warmupMinutes,15);assert.equal(report.measurementMinutes,30);
 assert.equal(report.prototypeSha256,m.prototypeSha256);
 const at=s=>report.builds.find(b=>b.blueprintSha256===m.blueprintSha256&&b.feedScale===s);
 for(const s of [1,.8]){const b=at(s);assert(b?.passed,'scale '+s);assert.deepEqual(Object.keys(b.outletItems),['flying-robot-frame']);
  assert(b.outputsPerMinute['flying-robot-frame']>=.95*20*s&&b.recoveryPerMinute['flying-robot-frame']>=(s<1?.9:.95)*20*s);}
 assert(at(1).machines.every(x=>x.measuredCrafts>0));
 assert.equal(m.status,'native-verified');
});

test('generator reproduces the committed blueprint',async t=>{
 const raw=new URL('../.cache/flight-21/script-output/data-raw-dump.json',import.meta.url);
 if(!fs.existsSync(raw)){t.skip('Pinned local prototype dump is not installed');return;}
 const bytes=fs.readFileSync(raw);if(sha(bytes)!==m.prototypeSha256){t.skip('Installed prototype dump is not the pinned one');return;}
 const {build}=await import('../scripts/flight-science-sided/heavy-supplies/flying-robot-frame-supply/layout.mjs');
 const built=build(m.variant,JSON.parse(bytes));
 assert.equal(JSON.stringify({blueprint:built.bp}),JSON.stringify(decodeBlueprint(code)));
});
