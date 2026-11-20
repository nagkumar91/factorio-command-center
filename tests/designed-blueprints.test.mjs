import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const atlas=JSON.parse(await fs.readFile('site/data/atlas.json'));
const entries=atlas.blueprints.filter(b=>b.designedCollection);
test('designed catalogue retains explicit boundaries, attribution and exact downloadable layouts',async()=>{
 assert.ok(entries.length>=1000);assert.equal(new Set(atlas.blueprints.map(b=>b.id)).size,atlas.blueprints.length);
 for(const b of entries){assert.ok(b.collection&&b.section&&b.purpose&&b.author&&b.gameVersion,b.name);assert.deepEqual(b.analysis.outputs,b.products);assert.equal(b.isBook,false);assert.ok(b.sources.length);assert.ok(b.analysis.inputs.every(x=>typeof x==='string'));const code=(await fs.readFile('site/'+b.file,'utf8')).trim();assert.equal(createHash('sha256').update(code).digest('hex'),b.blueprintSha256);assert.ok(decodeBlueprint(code).blueprint);await fs.access('site/'+b.preview);if(b.validation.status==='game-tested'){assert.ok(b.validation.report,b.id);await fs.access('site/'+b.validation.report);assert.equal(b.validation.blueprintSha256,b.blueprintSha256);}}
});
test('all 125 qualified Autosaved revisions are searchable alongside their original versions',()=>{
 const e=entries.filter(b=>b.collection==='Autosaved · optimized v2');assert.equal(e.length,125);assert.ok(e.every(b=>b.validation.status==='game-tested'&&b.name.includes('v2')));assert.ok(e.every(b=>decodeBlueprint(b.code).blueprint.entities.every(e=>!JSON.stringify(e.items||[]).includes('module'))));
});
test('solid-fuel feeder and complete science publish actual raw-only native boundary',()=>{
 const complete=entries.find(b=>b.file.endsWith('/solid-science-complete.txt'));assert.deepEqual([...complete.analysis.inputs].sort(),['copper-ore','iron-ore','solid-fuel']);assert.equal(complete.measuredOutputsPerMinute['logistic-science-pack'],30);assert.equal(complete.measuredOutputsPerMinute['automation-science-pack'],36);assert.ok(!complete.analysis.inputs.includes('coal'));assert.ok(complete.setupNotes.some(s=>s.includes('gear tap unused')));
 const feeder=entries.find(b=>b.file.endsWith('/science-solid-feeder.txt'));assert.equal(feeder.footprint.width,29);assert.equal(feeder.footprint.height,16);assert.deepEqual(feeder.products,['iron-plate','copper-plate','electronic-circuit']);
});
test('forestry is a service and archived/mod-profile builds cannot inflate vanilla coverage',()=>{
 for(const b of entries.filter(b=>b.category==='Forestry'&&!b.file.endsWith('/forest-kit.txt'))){assert.deepEqual(b.products,[]);assert.ok(b.analysis.serviceOutputs.includes('Tree planting and pollution absorption'));}
 const excluded=entries.filter(b=>b.coverageExcluded);assert.ok(excluded.length>=898);for(const b of excluded)assert.ok(!atlas.coverage.items.some(i=>i.builds.includes(b.id)),b.name);
});
test('lab-connected science and forestry flight plans are findable by output search fields without becoming products',async()=>{
 const plans=entries.filter(b=>b.collection==='Long game flight plans and strategies');assert.ok(plans.length>0);
 for(const b of plans)assert.ok(b.products.length||b.consumedProducts?.length||b.analysis.serviceOutputs?.length,b.name);
 const manifests=[...JSON.parse(await fs.readFile('blueprint-sources/rgby-science/manifest.json')),...JSON.parse(await fs.readFile('blueprint-sources/five-science/manifest.json'))];
 const research=entries.filter(b=>b.purpose==='Science research');assert.equal(research.length,4);
 for(const b of research){const info=manifests.find(m=>m.blueprintSha256===b.blueprintSha256);assert.ok(info?.researchProbe,b.name);
  assert.deepEqual([...b.consumedProducts].sort(),[...new Set(info.products)].sort(),b.name);assert.ok(b.consumedProducts.every(id=>id.endsWith('science-pack')),b.name);
  assert.deepEqual(b.products,[]);assert.deepEqual(b.analysis.outputs,[]);assert.deepEqual(b.analysis.netOutputs,[]);assert.ok(b.setupNotes.some(n=>/inside.*nothing is exported/.test(n)),b.name);
  assert.ok(!atlas.coverage.items.some(i=>i.builds.includes(b.id)),b.name);}
 for(const b of entries.filter(b=>b.purpose!=='Science research'))assert.ok(!('consumedProducts' in b),b.name);
});
