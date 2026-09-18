import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint,blueprintMaterials} from '../scripts/blueprints.mjs';
import {blueprintCoverage,productsOf} from '../scripts/blueprint-coverage.mjs';
import '../site/lib/production.js';
const read=n=>JSON.parse(fs.readFileSync(`site/data/${n}.json`));
const catalog=read('catalog'),production=read('production'),library=read('library'),community=read('community'),atlas=read('atlas');
const all=[...library.blueprints.map(b=>({...b,analysis:community.local[b.id]})),...community.blueprints,...atlas.blueprints];
test('every craftable inventory item has an eligible production output',()=>{
 const report=blueprintCoverage(catalog,production,all);
 assert.deepEqual(report.missing,[]);assert.equal(report.covered,report.total);assert.deepEqual(report,atlas.coverage);
 for(const item of report.items)for(const id of item.builds){const b=all.find(b=>b.id===id);assert.ok(!b.isBook&&!b.parameterized);assert.ok(productsOf(b).includes(item.id));}
 for(const id of ['repair-pack','tesla-turret','roboport','construction-robot','logistic-robot','big-electric-pole','rocket-part'])assert.ok(report.items.find(i=>i.id===id)?.builds.length,id);
});
test('generated cells have native production evidence tied to the exact saved string',()=>{
 const validation=JSON.parse(fs.readFileSync('blueprint-sources/generated/validation.json'));
 const cells=atlas.blueprints.filter(b=>b.collection==='Recipe cells');assert.ok(cells.length>=50);
 for(const b of cells){const object=decodeBlueprint(b.code),analysis=FactorioProduction.analyzeBlueprint(object,production);
  assert.ok([...analysis.outputs,...analysis.netOutputs].includes(b.product),b.id+' must really produce its advertised product');
  assert.deepEqual(blueprintMaterials(object,catalog).excluded,[]);
  const hash=createHash('sha256').update(b.code).digest('hex');const v=validation.cells.find(c=>c.id===b.id&&c.blueprintSha256===hash);
  assert.ok(v?.passed&&v.produced>0,b.id);assert.equal(b.validation.status,'game-tested');
  assert.ok(object.blueprint.entities.some(e=>e.name==='substation'));
  assert.ok(object.blueprint.entities.some(e=>e.name==='bulk-inserter'));
  assert.equal(object.blueprint.entities.some(e=>e.name==='roboport'),!b.platform);
 }
});
test('coverage excludes unknown and parameterized layouts but permits automatic platform hubs',()=>{
 const base={id:'test',entityCount:1,analysis:{outputs:['steel-chest'],missing:[]},excluded:[]};
 const count=b=>blueprintCoverage(catalog,production,[b]).items.find(i=>i.id==='steel-chest').builds.length;
 assert.equal(count({...base,parameterized:true}),0);assert.equal(count({...base,excluded:['unknown-machine']}),0);assert.equal(count({...base,excluded:['space-platform-hub']}),1);
});
test('breeding surplus and fixed captive-spawner recipes count as production',()=>{
 const fish=FactorioProduction.analyzeBlueprint({blueprint:{entities:[{name:'biochamber',recipe:'fish-breeding'}]}},production);
 assert.ok(fish.netOutputs.includes('raw-fish'));assert.ok(fish.seeds.includes('raw-fish'));
 const eggs=FactorioProduction.analyzeBlueprint({blueprint:{entities:[{name:'captive-biter-spawner'}]}},production);
 assert.ok(eggs.outputs.includes('biter-egg'));assert.ok(eggs.inputs.includes('bioflux'));
});
test('silo rocket parts can be planned without becoming a crate inventory item',()=>{
 const plan=FactorioProduction.planProduction([{id:'rocket-part',count:50}],production);
 assert.ok(plan.steps.some(r=>r.id==='rocket-part'));
 assert.ok(!catalog.items.some(i=>i.id==='rocket-part'));
});
