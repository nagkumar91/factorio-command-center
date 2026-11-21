import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{decodeBlueprint}from'../scripts/blueprints.mjs';
const dir=new URL('../blueprint-sources/rgby-science/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir))),report=JSON.parse(fs.readFileSync(new URL('native-report.json',dir)));
for(const m of manifest)test(m.id+' preserves its native qualified operating boundary',()=>{
 const code=fs.readFileSync(new URL(m.file,dir),'utf8').trim(),sha=createHash('sha256').update(code).digest('hex'),b=decodeBlueprint(code).blueprint,native=report.builds.find(b=>b.blueprintSha256===sha&&b.id===m.id);
 assert.equal(m.blueprintSha256,sha);assert(native?.passed,'matching passing native qualification required');assert(b.entities.every(e=>Object.keys(e.items||{}).length===0),'no modules');assert(b.entities.filter(e=>e.recipe&&e.name.startsWith('assembling-machine')).every(e=>e.name==='assembling-machine-2'));
 assert(m.inputs.every(p=>p.externalSide==='west'));assert(m.fluids.every(p=>p.externalSide==='west'));assert.equal(m.underground.existingUnpairedEndpoints.length,0);
 if(m.researchProbe){assert.equal(b.entities.filter(e=>e.name==='lab').length,m.expectedLabCount);assert(native.researchProbe.unitsPerMinute>=29.5);assert(native.researchProbe.allPowered&&native.researchProbe.allActive);}else{assert(m.outputs.every(p=>p.externalSide==='east'&&b.entities.find(e=>e.entity_number===p.entity)?.name==='passive-provider-chest'));for(const p of m.products){assert(native.outputsPerMinute[p]>=29.5);assert(native.recovery.outputsPerMinute[p]>=29.5);}assert.equal(native.recovery.blockedOutputFilled.length,4);}
});

// The compacted release of 21 November 2026. Sizes are pinned so a drift in the router, the compactor or the placement shows up here.
const released={'rgby-science-30':{size:[124,61],before:[132,70],old:'b8568d00'},'rgby-science-30-labs-15':{size:[130,73],before:[137,82],old:'2cd4f071'},'rgby-science-30-labs-30':{size:[130,76],before:[137,85],old:'be242304'}};
const tiers=['assembling-machine-2','big-electric-pole','bulk-inserter','chemical-plant','display-panel','fast-inserter','fast-splitter','fast-transport-belt','fast-underground-belt','iron-chest','lab','long-handed-inserter','medium-electric-pole','passive-provider-chest','pipe','pipe-to-ground','steel-chest'];
const machines={'copper-cable':14,'electronic-circuit':8,'advanced-circuit':13,'processing-unit':5,battery:2,'engine-unit':10,pipe:2,'iron-gear-wheel':3,'flying-robot-frame':5,'electric-engine-unit':3,'low-density-structure':10,'chemical-science-pack':8,'utility-science-pack':5,'automation-science-pack':4,'logistic-science-pack':4,'transport-belt':1,inserter:1};
// Every wire survives a blueprint build: red wires within 9 tiles, copper within the reach of both poles.
// The red-circuit ring reads its whole loop and caps its product at 24 (the replaced strings saved 14 tail wires 20-21 tiles long, which a build drops).
for(const m of manifest)test(m.id+' saves every wire within reach and reads the whole red-circuit ring',()=>{
 const b=decodeBlueprint(fs.readFileSync(new URL(m.file,dir),'utf8').trim()).blueprint,byId=new Map(b.entities.map(e=>[e.entity_number,e])),reach={'medium-electric-pole':9,'big-electric-pole':32};
 for(const[a,ac,z,zc]of b.wires){const p=byId.get(a),q=byId.get(z),d=Math.hypot(p.position.x-q.position.x,p.position.y-q.position.y);assert.ok(d<=(ac===5&&zc===5?Math.min(reach[p.name],reach[q.name]):9)+1e-6,`wire ${a}-${z} is ${d.toFixed(2)} long`);}
 const ring=m.loopControl.find(l=>l.name.startsWith('advanced')),net=new Map();for(const[a,ac,z,zc]of b.wires)if(ac===1&&zc===1){for(const[x,y]of[[a,z],[z,a]]){if(!net.has(x))net.set(x,new Set());net.get(x).add(y);}}
 const seen=new Set([ring.reader]),queue=[ring.reader];while(queue.length)for(const n of net.get(queue.pop())||[])if(!seen.has(n)){seen.add(n);queue.push(n);}
 for(const id of ring.loop)assert.ok(seen.has(id),'ring belt '+id+' is not on the reader network');
 assert.equal(ring.limits['advanced-circuit'],24);
});
for(const m of manifest)test(m.id+' is the compacted layout with the interface of the version it replaced',()=>{
 const want=released[m.id];assert.ok(want,'unexpected build '+m.id);
 const b=decodeBlueprint(fs.readFileSync(new URL(m.file,dir),'utf8').trim()).blueprint,byId=new Map(b.entities.map(e=>[e.entity_number,e]));
 assert.deepEqual([m.footprint.width,m.footprint.height],want.size);
 assert.ok(want.size[0]*want.size[1]<=want.before[0]*want.before[1]*.95,'at least 5% fewer tiles than the replaced rectangle');
 // Same machines and the same entity tiers as before: no modules, beacons, substations or faster belts.
 assert.deepEqual(m.machineCounts,machines);assert.equal(m.construction['assembling-machine-2'],96);assert.equal(m.construction['chemical-plant'],2);
 for(const name of Object.keys(m.construction))assert.ok(tiers.includes(name),'unexpected entity '+name);
 for(const e of b.entities)assert.ok(!e.quality||e.quality==='normal');
 // Six belt entrances then two fluid entrances, top to bottom in one column on the west edge, in the old order.
 const west=[...m.inputs,...m.fluids];assert.deepEqual(west.map(p=>p.item),['iron-plate','copper-plate','copper-plate','steel-plate','plastic-bar','sulfur','sulfuric-acid','lubricant']);
 for(const[i,p]of west.entries()){const e=byId.get(p.entity);assert.deepEqual([e.position.x,e.position.y],[p.x,p.y]);assert.equal(p.x,m.footprint.left+.5);if(i)assert.ok(p.y>west[i-1].y);
  assert.equal(e.name,p.kind==='fluid'?'pipe':'fast-transport-belt');for(let k=1;k<=3;k++)assert.ok(!b.entities.some(o=>o.position.y===p.y&&o.position.x===p.x-k));}
 // Four pack chests, red green blue yellow from the top; one column on the factory alone, where they are the exits.
 assert.deepEqual(m.outputs.map(p=>p.item),['automation-science-pack','logistic-science-pack','chemical-science-pack','utility-science-pack']);
 for(const[i,p]of m.outputs.entries()){const e=byId.get(p.entity);assert.deepEqual([e.name,e.bar,e.position.x,e.position.y],['passive-provider-chest',1,p.x,p.y]);if(!m.researchProbe)assert.equal(p.x,m.outputs[0].x);if(i)assert.ok(p.y>m.outputs[i-1].y);}
 if(!m.researchProbe)for(const p of m.outputs)assert.equal(p.x,m.footprint.right-.5,'exits stay on the east edge');
 // The replaced string is kept with a note.
 const kept=new URL('history/',dir),folder=fs.readdirSync(kept).find(n=>n.endsWith('-'+want.old));assert.ok(folder,'history folder for '+want.old);
 const old=fs.readFileSync(new URL('history/'+folder+'/'+m.file,dir),'utf8').trim();assert.ok(createHash('sha256').update(old).digest('hex').startsWith(want.old));assert.ok(fs.readFileSync(new URL('history/'+folder+'/NOTE.md',dir),'utf8').trim().length>20);
});
// Needs the machine-local prototype dump: the generator must reproduce every published string.
test('the generator reproduces the three published imports',{skip:!process.env.FACTORIO_RAW||!fs.existsSync(process.env.FACTORIO_RAW),timeout:600000},async()=>{
 const{buildAll}=await import('../scripts/rgby-science/factory.mjs'),bytes=fs.readFileSync(process.env.FACTORIO_RAW),builds=await buildAll(JSON.parse(bytes),bytes);
 assert.deepEqual(builds.map(b=>[b.manifest.id,b.manifest.blueprintSha256]),manifest.map(m=>[m.id,m.blueprintSha256]));
 for(const[i,b]of builds.entries())assert.equal(b.code,fs.readFileSync(new URL(manifest[i].file,dir),'utf8').trim());
});
