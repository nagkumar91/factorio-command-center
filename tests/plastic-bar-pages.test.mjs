// Plastic bar suppliers on the website: one library card with a size picker, the guide page with the three sizes side by side,
// ports, the README's pairing table, navigation and search. Run after `npm run build`. No game data needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadPlasticBars,pairingTable,ID} from '../scripts/plastic-bar-pages.mjs';
import '../site/flight-plans.js';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const read=p=>fs.readFile(p,'utf8');
const atlas=JSON.parse(await read('site/data/atlas.json'));
const family=await loadPlasticBars();
const num=n=>Number(n.toFixed(2)).toLocaleString('en-US');
const text=h=>h.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ');

test('all three sizes have exact-hash passing native evidence at the panel feed, so the page is published',()=>{
 assert.deepEqual(family.sizes.map(s=>s.size),['small','medium','large']);
 for(const s of family.sizes){assert.equal(sha(s.code),s.m.blueprintSha256,s.size);assert.ok(s.qualified,s.size+': '+s.evidence.reason);assert.equal(s.report.feedScale,1);}
 assert.ok(family.qualified);assert.deepEqual(family.versions.map(v=>v.label),['Medium','Small','Large']);
});

test('a size without a passing report keeps the page unpublished',async()=>{
 const root='.cache/plastic-pages-test';
 await fs.rm(root,{recursive:true,force:true});
 await fs.cp('blueprint-sources/plastic-bars',path.join(root,'blueprint-sources/plastic-bars'),{recursive:true});
 const file=path.join(root,'blueprint-sources/plastic-bars/native-report-large.json'),report=JSON.parse(await read(file));
 report.builds[0].passed=false;await fs.writeFile(file,JSON.stringify(report));
 const broken=await loadPlasticBars(root);
 assert.equal(broken.qualified,false);assert.equal(broken.sizes.find(s=>s.size==='large').qualified,false);assert.equal(broken.versions.length,0);
 await fs.rm(root,{recursive:true,force:true});
});

test('library: one card in the flight-plans collection with the sizes in its picker, found by product and by both inputs',()=>{
 const cards=atlas.blueprints.filter(b=>b.file?.startsWith('sources/designed-blueprints/plastic-bars/')&&b.publication);
 assert.equal(cards.length,1);const b=cards[0];
 assert.equal(b.collection,'Long game flight plans and strategies');
 assert.deepEqual(b.products,['plastic-bar']);assert.deepEqual([...b.analysis.inputs].sort(),['coal','petroleum-gas']);
 assert.equal(b.validation.status,'game-tested');assert.equal(b.blueprintSha256,family.sizes.find(s=>s.size==='medium').m.blueprintSha256,'Medium is the recommended size');
 assert.equal(b.publication.version,3);assert.equal(b.publication.history.length,2);assert.equal(b.publication.alternatives,true);
 assert.ok(b.preview);
 // Plastic bar had no recommended build: the supplier takes it, and no other record loses a recommendation to it.
 assert.deepEqual(b.recommendedProducts,['plastic-bar']);
 for(const other of atlas.blueprints.filter(x=>x!==b&&x.recommendedProducts?.includes('plastic-bar')))assert.fail('another record recommends plastic bar: '+other.id);
});

test('guide page: three sizes side by side, ports with tiles, power, the README pairing table, copy and download, native reports',async()=>{
 const html=await read(`site/${ID}/index.html`),t=text(html);
 for(const s of family.sizes){
  const {m,res=s.evidence.result}=s;
  assert.ok(t.includes(`${m.footprint.width} × ${m.footprint.height} = ${m.footprint.width*m.footprint.height}`),s.size+' size');
  assert.ok(html.includes(`<tr data-size="${s.size}">`));
  assert.ok(t.includes(`${num(res.inputs[0].acceptedPerMinute)} ${num(res.fluids[0].acceptedPerMinute)} ${num(m.targets['plastic-bar'])}`),s.size+': coal, gas and target in one row');
  assert.ok(html.includes(`href="${m.file}" download`)&&html.includes(`href="${m.reportFile}"`)&&html.includes(m.blueprintSha256),s.size+' string and report');
  assert.equal((await read(`site/${ID}/${m.file}`)).trim(),s.code);
  for(const f of [m.reportFile,`layout-${s.size}.svg`])await fs.access(`site/${ID}/${f}`);
  assert.ok(html.includes(`id="version-code-${family.versions.findIndex(v=>v.blueprintSha256===m.blueprintSha256)}"`));
 }
 const coal=family.sizes[0].m.inputs[0],gas=family.sizes[0].m.fluids[0];
 assert.match(t,/Coal Belt · west \(0, 6\) · every size/);assert.match(t,/Petroleum gas Pipe · west \(0, 0\) · every size/);
 assert.equal(`(${Math.floor(coal.x)}, ${Math.floor(coal.y)})`,'(0, 6)');assert.equal(`(${Math.floor(gas.x)}, ${Math.floor(gas.y)})`,'(0, 0)');
 assert.match(t,/Plastic bar Belt · east \(7, 5\) · small \(16, 5\) · medium and large/);
 assert.ok(t.includes('(6–7, 2–3)'),'power tiles');
 assert.ok(html.includes('tested sizes: which to choose')&&html.includes('alternative size')&&html.includes('recommended, current size'));
 // The pairing table is the README's own.
 const {head,body}=pairingTable(family.readme);
 assert.equal(body.length,17);
 for(const h of head)assert.ok(t.includes(h),h);
 for(const row of body)for(const c of row)assert.ok(t.includes(c.replace(/`/g,'')),'pairing cell: '+c);
 assert.ok(!t.includes('unpublished branch'));
});

test('pairing table: parsed from the README section; a README without it is refused',()=>{
 const md='x\n\n## Which size for which blueprint\n\n| A | B |\n| --- | ---: |\n| `one` | 1 |\n\n## Next\n';
 assert.deepEqual(pairingTable(md),{head:['A','B'],body:[['`one`','1']]});
 assert.throws(()=>pairingTable('## Other\n'),/no "Which size/);
});

test('navigation: one entry whose figures are the family manifest figures; icon exists',async()=>{
 const plan=globalThis.FlightPlans.plans.find(p=>p.id===ID);assert.ok(plan);assert.equal(plan.href,`${ID}/index.html`);
 const sizes=family.sizes;
 for(const s of sizes)assert.ok(plan.detail.includes(num(s.m.targets['plastic-bar'])),plan.detail);
 const small=sizes[0].m.footprint,large=sizes[2].m.footprint;
 assert.ok(plan.detail.includes(`${small.width} × ${small.height}`)&&plan.detail.includes(`${large.width} × ${large.height}`),plan.detail);
 await fs.access(`site/assets/icons/${plan.icon}.png`);
});

test('search aliases: the colour phrases are in the library matcher and nothing else about it changed',async()=>{
 const js=await read('site/explorer.js');
 assert.match(js,/green circuits\?.*electronic circuit.*red circuits\?.*advanced circuit.*blue circuits\?.*processing unit/s);
 // The original matcher survives as the first test: an alias can only add results.
 assert.match(js,/const matches = \(text, query\) => \{\s*if \(matchesWords\(text, query\)\) return true;/);
});
