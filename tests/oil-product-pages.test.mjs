// Oil products supplier on the website: library record, guide page, navigation and cross-links. Run after `npm run build`.
// No game data needed. The second layout in candidates/ is evidence only and is not published.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadOil,ID} from '../scripts/oil-product-pages.mjs';
import '../site/flight-plans.js';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const read=p=>fs.readFile(p,'utf8');
const atlas=JSON.parse(await read('site/data/atlas.json'));
const oil=await loadOil();
const m=oil.m;
const num=n=>Number(n.toFixed(2)).toLocaleString('en-US');
const text=h=>h.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ');
const PRODUCTS=['petroleum-gas','sulfuric-acid','lubricant','light-oil','sulfur'];

test('exact-hash evidence: the report passes for this string and every required scenario passed',()=>{
 assert.equal(sha(oil.code),m.blueprintSha256);assert.ok(oil.qualified,oil.reason);
 assert.equal(oil.report.passed,true);assert.ok(oil.builds.length>=11&&oil.builds.every(b=>b.blueprintSha256===m.blueprintSha256));
 assert.equal(m.scenarios.filter(s=>!s.informational).length,7);
});

test('a failing scenario keeps the page unpublished',async()=>{
 const root='.cache/oil-pages-test';
 await fs.rm(root,{recursive:true,force:true});
 await fs.cp('blueprint-sources/oil-products',path.join(root,'blueprint-sources/oil-products'),{recursive:true});
 const file=path.join(root,'blueprint-sources/oil-products/native-report.json'),report=JSON.parse(await read(file));
 report.builds.find(b=>b.scenario==='gas-blocked').passed=false;await fs.writeFile(file,JSON.stringify(report));
 assert.equal((await loadOil(root)).qualified,false);
 await fs.rm(root,{recursive:true,force:true});
});

test('library: one card, the five products and three inputs searchable; the second layout is neither a version nor registered',async()=>{
 const cards=atlas.blueprints.filter(b=>b.file?.startsWith('sources/designed-blueprints/oil-products/'));
 assert.equal(cards.length,1,'only the published string is a record');
 const b=cards[0];
 assert.equal(b.collection,'Long game flight plans and strategies');assert.deepEqual([...b.products].sort(),[...PRODUCTS].sort());
 assert.deepEqual([...b.analysis.inputs].sort(),['crude-oil','iron-plate','water']);
 assert.equal(b.blueprintSha256,m.blueprintSha256);assert.equal(b.validation.status,'game-tested');assert.equal(b.publication,undefined,'no picker');
 assert.ok(b.preview&&await fs.access('site/'+b.preview).then(()=>true,()=>false));
 assert.ok(!atlas.blueprints.some(x=>x.blueprintSha256===m.candidates.find(c=>!c.published).blueprintSha256),'the candidate string is not in the library');
 await fs.access('blueprint-sources/oil-products/'+m.candidates.find(c=>!c.published).path);
 await assert.rejects(fs.access('site/oil-products/candidates'));
 // No product had a recommended build, so this one takes them; nothing else loses one.
 assert.deepEqual([...b.recommendedProducts].sort(),[...PRODUCTS].sort());
 for(const other of atlas.blueprints.filter(x=>x!==b&&x.recommendedProducts?.some(p=>PRODUCTS.includes(p))))assert.fail('another record recommends an oil product: '+other.id);
 // The rates shown are the design run's measured draw at each outlet.
 assert.deepEqual(b.measuredOutputsPerMinute,{'petroleum-gas':7140,'sulfuric-acid':500,lubricant:150,sulfur:15});
});

test('guide page: inputs and outputs with connection type, side, tile and rate; the two north outlets are marked',async()=>{
 const html=await read(`site/${ID}/index.html`),t=text(html);
 assert.equal(sha(await read(`site/${ID}/${m.file}`)),m.blueprintSha256);
 for(const f of ['layout.svg','manifest.json','native-report.json','README.md'])await fs.access(`site/${ID}/${f}`);
 assert.ok(html.includes('id="copy-import"')&&html.includes(`href="${m.file}" download`)&&html.includes('href="native-report.json"'));
 for(const p of m.inputs){
  const kind=p.transport==='pipe'?'Pipe':'Red belt';
  assert.ok(t.includes(`${kind} ${p.externalSide} · (${p.tile.x}, ${p.tile.y}) ${num(p.perMinute)} ${num(m.measured.scenarios.design.fed[p.item])}`),'input '+p.item);
 }
 for(const p of m.outputs){
  const kind=p.transport==='pipe'?'Pipe':'Red belt',side=p.externalSide==='north'?'NORTH':p.externalSide;
  assert.ok(t.includes(`${kind} ${side} · (${p.tile.x}, ${p.tile.y}) ${num(m.panel[p.item])}`),'output '+p.item);
 }
 const north=m.outputs.filter(p=>p.externalSide==='north');
 assert.deepEqual(north.map(p=>p.item).sort(),['light-oil','lubricant']);
 assert.equal((html.match(/class="north-outlet"/g)||[]).length,2,'two highlighted rows');
 assert.match(t,/Two outlets are on the north edge, not the east: lubricant at \(13, 0\) and light oil at \(30, 0\)/);
 assert.ok(t.includes(`${m.footprint.width} × ${m.footprint.height} = ${m.tiles} tiles`)&&t.includes(`${m.machineCounts['oil-refinery']} oil refineries`));
});

test('measured scenarios: every scenario of the report is a row with its figures; light oil at 660 and the 80% feed are stated',async()=>{
 const html=await read(`site/${ID}/index.html`),t=text(html);
 for(const s of m.scenarios){assert.ok(t.includes(s.title),s.title);const sc=m.measured.scenarios[s.id];assert.ok(t.includes(`${num(sc.refineryCraftsPerMinute)}`));}
 assert.equal((html.match(/<td>informational<\/td>/g)||[]).length,4,'four informational probes');
 const light=m.measured.scenarios['light-oil-660'],feed=m.measured.scenarios['feed-80'],design=m.measured.scenarios.design;
 assert.ok(t.includes(`light oil ${num(light.drawn['light-oil'])}, so petroleum gas falls from ${num(design.drawn['petroleum-gas'])} to ${num(light.drawn['petroleum-gas'])}`));
 assert.ok(t.includes(`Feed at 80% (crude oil ${num(feed.fed['crude-oil'])}, water ${num(feed.fed.water)}, iron ${num(feed.fed['iron-plate'])}): petroleum gas ${num(feed.drawn['petroleum-gas'])}`));
 for(const id of ['acid-blocked','lubricant-blocked','sulfur-blocked','gas-blocked'])assert.ok(t.includes(`the refineries run at ${num(m.measured.scenarios[id].refineryCraftsPerMinute)} crafts per minute`),id);
});

test('copies needed: every pairing row of the manifest (the README table) with its copies; consumers with a guide link to it',async()=>{
 const html=await read(`site/${ID}/index.html`),t=text(html);
 assert.equal(m.pairing.length,17);
 for(const p of m.pairing){
  const name=p.name.replace(/ \(designed in parallel\)| \(unpublished branch\)/g,'').replace(/^Plastic supplier/,'Plastic bar supplier');
  assert.ok(t.includes(name+' '),name);
  if(p.copies!==null)assert.ok(t.includes(`${name} `),name);
 }
 assert.ok(!t.includes('designed in parallel')&&!t.includes('unpublished branch'));
 for(const dirName of ['five-science','rgby-science','six-science','robot-essentials','launch-kit','rocket-supplies','rocket-fuel-supplier','processing-units','plastic-bars','robot-logistics-workshop'])assert.ok(html.includes(`href="../${dirName}/index.html"`),dirName);
 // 2 copies for the integrated six-pack factory, 1 for the 30-per-minute factories, 2 for the large plastic supplier.
 const copies=Object.fromEntries(m.pairing.map(p=>[p.family+'/'+p.id,p.copies]));
 assert.equal(copies['flight-science-sided/full/six-pack-integrated-60'],2);assert.equal(copies['five-science/five-science-30'],1);assert.equal(copies['plastic-supplier/large'],2);
});

test('joining the plastic bar supplier: gas port to gas port, tiles from both manifests; the plastic guide says where its gas comes from',async()=>{
 const t=text(await read(`site/${ID}/index.html`));
 const [plastic]=JSON.parse(await read('blueprint-sources/plastic-bars/manifest.json')).filter(e=>e.size==='medium');
 const gas=m.outputs.find(p=>p.item==='petroleum-gas').tile,inlet=plastic.fluids[0].tile;
 assert.ok(t.includes(`petroleum gas outlet at (${gas.x}, ${gas.y}) (east edge) to the plastic supplier's petroleum gas inlet at (${inlet.x}, ${inlet.y}) (west edge, top-left corner) with pipe, gas port to gas port`));
 assert.ok(t.includes('feeds a small (240 bars) or a medium (600 bars) plastic bar supplier; 2 copies feed a large (1,200 bars)'));
 assert.ok(text(await read('site/plastic-bars/index.html')).includes('One copy feeds a small or a medium size; 2 copies feed a large.'));
});

test('navigation: one entry whose figures are the manifest figures; the Suppliers line lists five guides on every one',async()=>{
 const plan=globalThis.FlightPlans.plans.find(p=>p.id===ID);assert.ok(plan);assert.equal(plan.href,`${ID}/index.html`);
 for(const i of ['petroleum-gas','sulfuric-acid','lubricant','sulfur'])assert.ok(plan.detail.includes(num(m.targets[i])),plan.detail);
 assert.ok(plan.detail.includes(`${m.footprint.width} × ${m.footprint.height} tiles`));
 await fs.access(`site/assets/icons/${plan.icon}.png`);
 for(const id of ['green-circuits','advanced-circuits','processing-units','plastic-bars','oil-products']){
  const html=await read(`site/${id}/index.html`);
  assert.equal((html.match(/data-supplier="/g)||[]).length,5,id+': five links');
  assert.ok(html.includes('data-supplier="oil-products"'),id);
 }
});
