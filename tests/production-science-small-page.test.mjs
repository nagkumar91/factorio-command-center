// Small production science on the website: library record, guide page, navigation entry and the line naming the
// supplier blueprints its circuits can come from. Run after `npm run build` (atlas and guide pages are build outputs).
// No game data needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadSuppliers} from '../scripts/circuit-supplier-pages.mjs';
import {ID,circuitSourcesLine} from '../scripts/production-science-small/page.mjs';
import '../site/flight-plans.js';

const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const read=p=>fs.readFile(p,'utf8');
const atlas=JSON.parse(await read('site/data/atlas.json'));
const [r]=await loadSuppliers(undefined,[ID]);
const record=atlas.blueprints.find(b=>b.file==='sources/designed-blueprints/'+ID+'/'+ID+'.txt');
const num=n=>String(Number(n.toFixed(2)));
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const P='production-science-pack';

test('exact-hash passing native evidence, so it is published',()=>{
 assert.equal(r.id,ID);assert.equal(sha(r.code),r.m.blueprintSha256);assert.ok(r.qualified,r.reason);
 assert.ok(r.report.builds.some(b=>b.blueprintSha256===r.m.blueprintSha256&&b.passed===true));
});

test('an unqualified copy gets no page: a failing report is refused',async()=>{
 const root='.cache/production-science-page-test';
 await fs.rm(root,{recursive:true,force:true});
 await fs.cp('blueprint-sources/'+ID,path.join(root,'blueprint-sources',ID),{recursive:true});
 const file=path.join(root,'blueprint-sources',ID,'native-report.json'),report=JSON.parse(await read(file));
 report.builds[0].passed=false;await fs.writeFile(file,JSON.stringify(report));
 const [copy]=await loadSuppliers(root,[ID]);assert.equal(copy.qualified,false);
 await fs.rm(root,{recursive:true,force:true});
});

test('library: one card in the flight-plans collection, product and the six inputs searchable; five-pack science keeps its recommendation',async()=>{
 assert.ok(record,'in the library');
 assert.equal(record.collection,'Long game flight plans and strategies');
 assert.equal(record.name,r.m.name);assert.equal(record.purpose,'Science production');
 assert.deepEqual(record.products,[P]);
 assert.deepEqual([...record.analysis.inputs].sort(),['advanced-circuit','electronic-circuit','iron-plate','steel-plate','stone','stone-brick']);
 assert.equal(record.validation.status,'game-tested');assert.equal(record.blueprintSha256,r.m.blueprintSha256);
 assert.ok(record.preview&&await fs.access('site/'+record.preview).then(()=>true,()=>false),'preview image');
 assert.deepEqual(record.recommendedProducts,[]);
 assert.ok(atlas.blueprints.some(b=>b!==record&&b.recommendedProducts?.includes(P)),'another build keeps the production-science recommendation');
 assert.equal(atlas.blueprints.filter(x=>x.file?.startsWith('sources/designed-blueprints/'+ID+'/')).length,1,'one card');
});

test('guide page: rate, inputs table, output, size, machines, power, circuit sources and native evidence, all from the family files',async()=>{
 const {m}=r,res=r.evidence.result;
 const html=await read(`site/${ID}/index.html`),main=decode(html.match(/<main\b[\s\S]*<\/main>/)[0]),text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 assert.ok(html.includes(`data-page="${ID}"`));
 assert.ok(main.includes(`${num(m.targets[P])} production science packs per minute (measured ${num(res.outputsPerMinute[P])})`),'target and measured rate');
 assert.ok(main.includes(`${m.footprint.width} × ${m.footprint.height} = ${m.footprint.width*m.footprint.height} tiles`),'size');
 assert.ok(main.includes(`${r.bp.entities.length} entities`));
 for(const [recipe,list] of Object.entries(Object.groupBy(r.bp.entities.filter(e=>e.recipe),e=>e.recipe)))assert.ok(html.includes(`<tr><th>${recipe.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase())}</th><td>${list.length}</td></tr>`),'machines for '+recipe);
 // One row per entrance, with its tile and panel figure.
 assert.equal(m.inputs.length,6);
 for(const p of m.inputs){
  assert.match(text,new RegExp(`${p.item.replaceAll('-',' ')}[\\s\\S]{0,80}?west · \\(${Math.floor(p.x)}, ${Math.floor(p.y)}\\)`,'i'),'entrance '+p.item);
  assert.ok(html.includes(`<td>${num(p.perMinute)}</td>`),'panel figure '+p.perMinute);
 }
 const exit=m.outputs[0];assert.ok(main.includes(`(${Math.floor(exit.x)}, ${Math.floor(exit.y)})`),'exit tile');
 assert.ok(main.includes('The blueprint holds 1 substation'),'power');
 // The circuit sources: the green-circuit and advanced-circuit supplier guides, with this module's need and their rate.
 assert.ok(html.includes(await circuitSourcesLine(m)));
 assert.match(main.replace(/<[^>]+>/g,''),/Circuits from: electronic circuits \(21\.4 per minute\) from the Green-circuit supplier, which makes 360 per minute; advanced circuits \(42\.9 per minute\) from the Advanced-circuit supplier, which makes 187\.5 per minute\./);
 for(const id of ['green-circuits','advanced-circuits']){assert.ok(html.includes(`href="../${id}/index.html" data-circuit-source="${id}"`));await fs.access(`site/${id}/index.html`);}
 assert.ok(!html.includes('data-suppliers'),'not a supplier: no Suppliers line');
 // The 80% feed run is quoted from the manifest.
 assert.ok(main.includes(`Fed 80% of every panel figure, the same string made ${num(m.measured.underfed.steadyPerMinute[P])} per minute.`));
 assert.ok(html.includes('id="copy-import"')&&html.includes(`href="${m.file}" download`));
 assert.ok(html.includes('href="native-report.json"')&&html.includes(m.blueprintSha256));
 assert.equal((await read(`site/${ID}/${m.file}`)).trim(),r.code);
 for(const f of ['layout.svg','manifest.json','native-report.json','README.md'])await fs.access(`site/${ID}/${f}`);
 assert.equal(sha(await read(`site/${ID}/native-report.json`)),sha(JSON.stringify(r.report,null,2).replaceAll('<','\\u003c')+'\n'));
});

test('navigation: one entry, every figure in its words is the manifest figure, icon exists',async()=>{
 const plans=globalThis.FlightPlans.plans,plan=plans.find(p=>p.id===ID);
 assert.ok(plan);assert.equal(plan.href,`${ID}/index.html`);
 const m=r.m;
 assert.ok(plan.detail.includes(`${String(Math.round(m.targets[P]*10)/10)} production science packs per minute`),plan.detail);
 assert.ok(plan.detail.includes(`${m.footprint.width} × ${m.footprint.height} tiles`),plan.detail);
 assert.ok(plan.detail.includes(`(${m.targetDerivation.scienceMachines===2?'two':m.targetDerivation.scienceMachines} science machines)`),plan.detail);
 await fs.access(`site/assets/icons/${plan.icon}.png`);
 assert.equal(new Set(plans.map(p=>p.id)).size,plans.length);
});

test('wording: stone is said without a plural and a full exit pauses "the module" here, "the supplier" on the supplier guides',async()=>{
 const html=decode(await read(`site/${ID}/index.html`));
 assert.ok(r.m.inputs.some(p=>p.item==='stone'),'the module takes stone');
 assert.match(html,/from steel plates, stone bricks, stone, iron plates, electronic circuits and advanced circuits,/);
 assert.ok(!/stones/.test(html));
 assert.ok(html.includes('A full exit pauses the module on purpose.')&&!html.includes('pauses the supplier'));
 for(const id of ['advanced-circuits','processing-units'])assert.ok((await read(`site/${id}/index.html`)).includes('A full exit pauses the supplier on purpose.'),id+' keeps its wording');
});
