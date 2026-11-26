// Vulcanus foundry builds page (scripts/vulcanus-foundry-builds.mjs, site/vulcanus-foundry-builds/): the page exists, is one entry of the
// left menu, shows exactly the committed strings and hashes, takes every figure from the blueprint folders' manifests, ports and
// native reports, and follows the data when a blueprint is re-released. Needs neither the game nor a prototype dump.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {BUILDS,GROUPS,ID,TITLE,SUPPLIED_BY,loadBuilds,verifyBuild,describe,renderPage,peakDraw,fmt,readmeLines} from '../scripts/vulcanus-foundry-builds.mjs';
import '../site/flight-plans.js';

const read=p=>fs.readFile(p,'utf8');
const sha=s=>createHash('sha256').update(s.trim()).digest('hex');
const catalog=JSON.parse(await read('site/data/catalog.json'));
const names=new Map([...catalog.items,...catalog.fluids].map(i=>[i.id,i.name]));
const builds=await loadBuilds();
const html=await read(`site/${ID}/index.html`);
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const text=h=>decode(h.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ');
/** The label the page gives an item id; a suffixed stock such as "fast-inserter (kit)" is its base item's catalog name plus the bracketed suffix. */
const label=id=>{const q=id.match(/^(.*?)\s*\((.*)\)$/);return q?`${names.get(q[1])} (${q[2]})`:names.get(id);};
/** The "What it makes" rows of the foundry mall as {item,cap,rate,group,chest}, undoing the rowspans. */
const placed=card=>{let group,chest;return rows(card.split('<h3>What it makes</h3>')[1].split('</table>')[0]).slice(1).map(r=>{
 if(r.length===6){group=r[1];chest=r[5];return {item:r[2],cap:r[3],rate:r[4],group,chest};}
 return {item:r[0],cap:r[1],rate:r[2],group,chest:r.length===4?r[3]:chest};});};
const by=key=>builds.find(b=>b.spec.key===key);
const nav=()=>globalThis.FlightPlans.links('../',ID);
/** Table rows of one html string as arrays of cell text. */
const rows=h=>[...h.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r=>[...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c=>text(c[1]).trim()));
const section=(h,id)=>h.split(`<article class="today-card vulcanus-card" id="${id}"`)[1].split('</article>')[0];

test('the page exists, is the first entry of the left menu with an existing icon, and marks itself as the current page',async()=>{
 const plan=globalThis.FlightPlans.plans.find(p=>p.id===ID);
 assert.ok(plan);assert.equal(plan.href,`${ID}/index.html`);assert.equal(plan.label,TITLE);assert.equal(TITLE,'Vulcanus foundry builds');
 await fs.access(`site/assets/icons/${plan.icon}.png`);
 assert.equal(new Set(globalThis.FlightPlans.plans.map(p=>p.id)).size,globalThis.FlightPlans.plans.length);
 assert.match(globalThis.FlightPlans.links('',''),new RegExp(`href="${ID}/index.html"`));
 assert.ok(html.includes(`aria-current="page" href="../${ID}/index.html"`),'the sidebar of the page marks itself');
 assert.ok(html.includes('href="../index.html"'),'back to the Command Center');
 assert.ok(html.includes(nav()),'the sidebar is the shared FlightPlans list, unchanged');
 assert.doesNotMatch(html,/https?:\/\//,'no network');
 assert.equal(ID.match(/\d/),null,'no letter-number codes in the page id');
});

test('order: the foundry mall, then its smaller alternative (foundry belts and fuel mall) in the same group, then the two supplies under a heading that says they feed it, then science from lava, then circuits from lava, then the rocket fuel supply under its own heading, then the two plate-fed malls as their own group',()=>{
 const at=k=>html.indexOf(`id="${k}"`),g=k=>html.indexOf(`id="g-${k}"`);
 assert.deepEqual(BUILDS.map(b=>b.key),['foundry-mall','foundry-belts-fuel-mall','coal-plastic-lubricant','tungsten-carbide','production-utility-science','electronic-circuits','advanced-circuits','processing-units','rocket-fuel','assembler-3-mall','express-belt-mall']);
 assert.deepEqual(Object.keys(GROUPS),['foundry','supplies','science','circuits','rockets','plates']);
 assert.ok(at('foundry-mall')<at('foundry-belts-fuel-mall')&&at('foundry-belts-fuel-mall')<at('coal-plastic-lubricant')&&at('coal-plastic-lubricant')<at('tungsten-carbide')&&at('tungsten-carbide')<at('production-utility-science')&&at('production-utility-science')<at('electronic-circuits')&&at('electronic-circuits')<at('advanced-circuits')&&at('advanced-circuits')<at('processing-units')&&at('processing-units')<at('rocket-fuel')&&at('rocket-fuel')<at('assembler-3-mall')&&at('assembler-3-mall')<at('express-belt-mall'));
 assert.ok(g('foundry')<at('foundry-mall')&&at('foundry-belts-fuel-mall')<g('supplies')&&g('supplies')<at('coal-plastic-lubricant')&&at('tungsten-carbide')<g('science')&&g('science')<at('production-utility-science')&&at('production-utility-science')<g('circuits')&&g('circuits')<at('electronic-circuits')&&at('processing-units')<g('rockets')&&g('rockets')<at('rocket-fuel')&&at('rocket-fuel')<g('plates')&&g('plates')<at('assembler-3-mall'));
 assert.equal(GROUPS.foundry.label,'The foundry malls');assert.match(GROUPS.science.label,/Science from lava/);assert.equal(GROUPS.circuits.label,'Circuits from lava');assert.match(GROUPS.rockets.label,/Rocket supplies/);
 assert.equal(SUPPLIED_BY['rocket-fuel'],undefined,'rocket fuel is not a foundry mall input');for(const k of ['electronic-circuits','advanced-circuits','processing-units'])assert.equal(SUPPLIED_BY[k],undefined,k+' is not a foundry mall input');
 const links=html.split('<ul class="toc">')[1].split('</ul>')[0];assert.ok(links.includes('The foundry malls')&&links.includes('href="#foundry-mall"')&&links.includes('href="#foundry-belts-fuel-mall"')&&links.includes('Rocket supplies')&&links.includes('href="#rocket-fuel"')&&links.includes('Science from lava')&&links.includes('href="#production-utility-science"')&&links.includes('Circuits from lava'),'the list of links at the top');
 for(const k of ['electronic-circuits','advanced-circuits','processing-units'])assert.ok(links.includes(`href="#${k}"`),k+' is in the list of links at the top');
 assert.ok(text(html).includes(`${BUILDS.length} blueprints for Vulcanus`),'the intro count follows the data');
 assert.match(GROUPS.supplies.label,/feed the foundry mall/);assert.match(GROUPS.plates.label,/not on the foundry chain/);
 assert.ok(html.indexOf('id="how-they-connect"')<g('foundry'),'the connection table is near the top, before the builds');
});

test('every string shown equals the committed blueprint.txt, every hash shown equals the manifest and the string; layouts are the committed pictures',async()=>{
 assert.equal((html.match(/<textarea /g)||[]).length,BUILDS.length);assert.equal((html.match(/data-copy="/g)||[]).length,BUILDS.length);
 assert.equal(BUILDS.length,11);
 for(const b of builds){
  const dir=`blueprint-sources/${b.spec.dir}`,code=(await read(`${dir}/blueprint.txt`)).trim(),card=section(html,b.spec.key);
  assert.equal(b.code,code);assert.equal(b.hash,b.m.candidateSha256);assert.equal(sha(code),b.m.candidateSha256);
  const shown=decode(card.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1]);
  assert.equal(shown,code,b.spec.key+': the string on the page');
  assert.equal((await read(`site/${ID}/${b.spec.key}.txt`)).trim(),code,b.spec.key+': the linked string file');
  assert.ok(card.includes(`href="${b.spec.key}.txt"`)&&card.includes(`data-copy="${b.spec.key}"`));
  assert.deepEqual(card.match(/Blueprint SHA-256: <code>([0-9a-f]{64})<\/code>/)?.[1],b.m.candidateSha256,b.spec.key+': the hash on the page');
  assert.equal(await read(`site/${ID}/${b.spec.key}-layout.svg`),await read(`${dir}/layout.svg`),b.spec.key+': layout picture');
  assert.ok(card.includes(`src="${b.spec.key}-layout.svg"`));
  assert.equal(b.report.passed,true);assert.equal(b.report.blueprintSha256,b.m.candidateSha256,'the native report is for exactly this string');
 }
});

test('evidence gate: a changed string, a failed report or a report for another string stops the build',()=>{
 const b=by('tungsten-carbide'),parts=()=>structuredClone({m:b.m,ports:b.ports,report:b.report,code:b.code});
 assert.equal(verifyBuild(b.spec,parts()),b.m.candidateSha256);
 assert.throws(()=>verifyBuild(b.spec,{...parts(),code:b.code+'x'}),/does not match the manifest hash/);
 const failed=parts();failed.report.passed=false;assert.throws(()=>verifyBuild(b.spec,failed),/no passing native report/);
 const stale=parts();stale.report.blueprintSha256='0'.repeat(64);assert.throws(()=>verifyBuild(b.spec,stale),/no passing native report/);
 const wrong=parts();wrong.m.id='other';assert.throws(()=>verifyBuild(b.spec,wrong),/unexpected manifest/);
 assert.throws(()=>readmeLines('# t\n\n## One\nx\n','Missing'),/no "Missing" section/);
});

test('size, test version and fill time on every card come from the manifest and the native report',()=>{
 for(const b of builds){
  const card=text(section(html,b.spec.key)),fp=b.m.footprint;
  assert.ok(card.includes(`${fp.width} × ${fp.height} tiles (${fmt(fp.area)} tiles), ${fmt(fp.entities)} entities`),b.spec.key);
  assert.ok(card.includes(`Natively in Factorio ${b.report.gameVersion}`),b.spec.key);
  assert.ok(card.includes(`${b.m.equipment.quality} quality items, no modules, no beacons`),b.spec.key);
 }
 const small=by('foundry-belts-fuel-mall').report.scenarios.fill.phases[0].ticks/3600;assert.ok(text(section(html,'foundry-belts-fuel-mall')).includes(`${fmt(small)} minutes`));
 const fill=(by('foundry-mall').report.scenarios.fill.phases[0].ticks/3600),am3=by('assembler-3-mall').report.fillTimes['fill from empty'].both/3600,ex=by('express-belt-mall').report.stockTiming[0].allTick/3600;
 assert.ok(text(section(html,'foundry-mall')).includes(`${fmt(fill)} minutes`));assert.ok(text(section(html,'assembler-3-mall')).includes(`${fmt(am3)} minutes`));assert.ok(text(section(html,'express-belt-mall')).includes(`${fmt(ex)} minutes`));
});

test('foundry mall: the caps table is the manifest caps (every key, grouped in list order, in its chest); no cap list is typed in the script',async()=>{
 const b=by('foundry-mall'),card=section(html,'foundry-mall'),table=rows(card.split('<h3>What it makes</h3>')[1].split('</table>')[0]);
 for(const [item,cap] of Object.entries(b.m.caps)){
  const name=label(item);assert.ok(name&&!name.includes('undefined'),item+' has a label');
  const row=table.find(r=>r.includes(name)&&r[r.indexOf(name)+1]===fmt(cap));
  assert.ok(row,`${item} ${cap} is in the table`);
 }
 for(const g of b.m.groups)assert.ok(text(card).includes(g.name));
 // every item sits in its own group and in the chest that holds most of that group, once, with its own cap: the kit's fast inserters
 // (a suffixed key of caps and of the kit group's products) and the plain fast inserters (inserter group, inserter chest)
 const rowsOf=placed(card);assert.equal(rowsOf.length,Object.keys(b.m.caps).length,'one row per cap, no double counting');
 for(const g of b.m.groups)for(const item of g.products){
  const r=rowsOf.filter(x=>x.item===label(item));assert.equal(r.length,1,item+' once');
  assert.equal(r[0].group,g.name,item+' group');assert.equal(r[0].cap,fmt(b.m.caps[item]),item+' cap');
  const home=b.ports.outputs.map(o=>[o,g.products.filter(i=>o.items.includes(i.replace(/\s*\(.*\)$/,''))).length]).sort((x,y)=>y[1]-x[1])[0][0];
  assert.ok(r[0].chest.startsWith(home.label),`${item} in ${home.label}, not ${r[0].chest}`);
 }
 if('fast-inserter (kit)' in b.m.caps){
  const kit=rowsOf.find(x=>x.item==='Fast inserter (kit)'),plain=rowsOf.find(x=>x.item==='Fast inserter');
  assert.match(kit.group,/kit/);assert.match(kit.chest,/platform kit/);assert.match(plain.group,/inserters/);assert.match(plain.chest,/fast \+ bulk inserter/);
  const made=key=>{const v=b.report.scenarios.rate.phases.filter(p=>p.perMinute&&p.perMinute.collected[key]>0).map(p=>p.perMinute.collected[key]);return v.length?fmt(v.at(-1)):'—';};
  assert.equal(kit.rate,made('fast-inserter (kit)'),'the kit stock shows its own measured rate');assert.equal(plain.rate,made('fast-inserter'),'the plain stock shows its own, not the kit\'s');assert.notEqual(kit.rate,plain.rate);
 }
 // every chest tile is the output position relative to the footprint's top-left corner
 for(const o of b.ports.outputs){const col=Math.floor(o.position.x-b.m.footprint.bounds.left),row=Math.floor(o.position.y-b.m.footprint.bounds.top);assert.ok(text(card).includes(`${o.label} tile (${col}, ${row})`),o.label);}
 const src=await read('scripts/vulcanus-foundry-builds.mjs');
 for(const hard of [/\b151\b/,/\b19\b/,/ac47881a/,/molten/,/electric-mining-drill/,/space-platform-foundation/])assert.ok(!hard.test(src),hard+' is not typed into the generator');
 assert.ok(!/\b(7116|14\.2|202\.4|333\.9)\b/.test(src));
});

test('foundry belts and fuel mall: the smaller alternative has the big mall\'s card content, from its own manifest, ports and report; its sentence names what it leaves out and the fuel section',async()=>{
 const b=by('foundry-belts-fuel-mall'),big=by('foundry-mall'),card=section(html,'foundry-belts-fuel-mall'),flat=text(card),t=rows(card);
 assert.equal(b.spec.kind,'foundry');assert.equal(b.spec.group,'foundry');assert.equal(b.spec.smallerOf,'foundry-mall');
 assert.ok(card.includes('<div class="eyebrow">The foundry malls</div>'));assert.ok(card.includes('<h2>Foundry belts and fuel mall</h2>'));
 assert.ok(html.indexOf('id="foundry-mall"')<html.indexOf('id="foundry-belts-fuel-mall"'),'after the big mall');
 // caps and chests: every cap of the manifest once, in its group (the fuel in its own section) and in the chest that holds it, with its own cap
 const rowsOf=placed(card);assert.equal(rowsOf.length,Object.keys(b.m.caps).length,'one row per cap');
 for(const [item,cap] of Object.entries(b.m.caps)){const r=rowsOf.filter(x=>x.item===label(item));assert.equal(r.length,1,item+' once');assert.equal(r[0].cap,fmt(cap),item+' cap');
  const home=b.ports.outputs.find(o=>o.items.includes(item));assert.ok(r[0].chest.startsWith(home.label),`${item} in ${home.label}, not ${r[0].chest}`);
  const col=Math.floor(home.position.x-b.m.footprint.bounds.left),row=Math.floor(home.position.y-b.m.footprint.bounds.top);assert.ok(r[0].chest.includes(`tile (${col}, ${row})`),item+' chest tile');}
 for(const g of b.m.groups)for(const item of g.products){const r=rowsOf.find(x=>x.item===label(item));assert.equal(r.group,g.name,item+' group');}
 const own=rowsOf.find(x=>x.item===label(b.m.independent[0]));assert.match(own.group,/outside the order/);assert.ok(text(card).includes('outside this order'));
 assert.deepEqual(b.m.independent,['rocket-fuel']);assert.ok(b.m.caps['rocket-fuel']>0);
 assert.equal(rowsOf.find(x=>x.item===label('foundry')).group,'foundry','the foundry group');
 // entrances: the nine of ports.json, at their tiles, with the peak at the entrance of the rate windows (accepted / minutes); two calcite entrances stay apart
 assert.equal(b.ports.inputs.length,9);assert.equal(b.ports.inputs.filter(p=>p.item==='calcite').length,2);
 const windows=b.report.scenarios.rate.phases.filter(p=>p.perMinute),ins=t.filter(r=>r[0]==='In');assert.equal(ins.length,b.ports.inputs.length);
 b.ports.inputs.forEach((p,n)=>{
  const peak=Math.max(...windows.map(w=>(w.accepted[p.key]??0)/(w.ticks/3600)));
  const col=Math.floor(p.position.x-b.m.footprint.bounds.left),rw=Math.floor(p.position.y-b.m.footprint.bounds.top);
  assert.equal(ins[n][1],names.get(p.item),p.id);assert.ok(ins[n][3].startsWith(`${p.side} edge, tile (${col}, ${rw})`)&&ins[n][3].includes(p.label),p.id+': '+ins[n][3]);assert.ok(ins[n][4].startsWith(fmt(peak)),`${p.id} ${ins[n][4]} vs ${fmt(peak)}`);
 });
 const fuelCalcite=ins[b.ports.inputs.findIndex(p=>p.key==='calcite-fuel')],mallCalcite=ins[b.ports.inputs.findIndex(p=>p.key==='calcite')];assert.notEqual(fuelCalcite[3],mallCalcite[3]);assert.notEqual(fuelCalcite[4],mallCalcite[4],'the two calcite entrances show their own draws');
 assert.ok(card.includes('Per minute (peak at the entrance)'));
 const stone=b.ports.exits[0],sr=t.find(r=>r[0]==='Out');assert.equal(b.ports.exits.length,1);assert.equal(sr[1],names.get('stone'));assert.equal(sr[4],fmt(Math.max(...windows.map(w=>w.perMinute.stoneOut))));
 assert.ok(sr[3].startsWith(`${stone.side} edge, tile (${Math.floor(stone.position.x-b.m.footprint.bounds.left)}, ${Math.floor(stone.position.y-b.m.footprint.bounds.top)})`));
 // size, equipment, measured fill time, the power line and the README caveats
 assert.ok(flat.includes(`${b.m.footprint.width} × ${b.m.footprint.height} tiles (${fmt(b.m.footprint.area)} tiles), ${fmt(b.m.footprint.entities)} entities`));
 assert.ok(flat.includes(`${fmt(b.report.scenarios.fill.phases[0].ticks/3600)} minutes (measured)`));assert.ok(flat.includes(b.ports.power.label));
 const readme=await read('blueprint-sources/requested-malls/foundry-belts-fuel-mall/README.md');
 assert.ok(flat.includes('Calcite has two entrances')&&flat.includes('One foundry casts all five iron products'),'caveats read from the README');
 assert.ok(readme.includes('One foundry casts all five iron products'));assert.ok(!flat.includes('Panel figures.'),'the long panel-figure bullet is not quoted');
 // the sentence: what it leaves out (the groups of the big manifest it does not have, with their item counts), what it adds, and that the stand-alone fuel blueprint is not needed
 const gone=big.m.groups.filter(g=>!b.m.groups.some(x=>x.name===g.name));assert.ok(gone.length>=2);
 for(const g of gone)assert.ok(flat.includes(`the ${g.name} group (${g.products.length} ${g.products.length===1?'item':'items'})`),g.name);
 for(const g of b.m.groups)assert.ok(!flat.includes(`the ${g.name} group (`),g.name+' is not left out');
 assert.ok(flat.includes('The smaller alternative to the foundry mall'));assert.ok(card.includes('href="#foundry-mall"'));
 assert.ok(flat.includes(`${b.m.footprint.width} × ${b.m.footprint.height} tiles against ${big.m.footprint.width} × ${big.m.footprint.height}`));
 assert.ok(flat.includes(`rocket fuel section (${fmt(b.m.panelFigures['rocket-fuel'])} a minute at its panel figure, into its own chest, cap ${fmt(b.m.caps['rocket-fuel'])})`));
 assert.ok(flat.includes('so the stand-alone rocket fuel blueprint is not needed with it'));
 assert.ok(!text(section(html,'foundry-mall')).includes('The smaller alternative'),'the big mall carries no such sentence');
 // the big mall's connection table is the big mall's alone: it says so, names the smaller mall's supplied inputs, and none of the smaller mall's figures or entrances are in it
 const conn=html.split('id="how-they-connect"')[1].split('</section>')[0],lead=text(conn.split('<table')[0]);
 assert.ok(lead.includes('This table is for the big foundry mall only')&&lead.includes('smaller foundry mall takes its plastic bar, tungsten carbide and lubricant from the same supplies'));
 assert.ok(!conn.includes('Coal</td><td>Your own')&&!/coal/i.test(rows(conn.split('What the two supplies')[0]).map(r=>r[0]).join(' ')),'the fuel section\'s entrances are not rows of the big mall\'s table');
 assert.equal(rows(conn.split('What the two supplies')[0]).filter(r=>r[0]==='Calcite').length,1,'one calcite row');
 const bigCalcite=rows(conn).find(r=>r[0]==='Calcite');assert.ok(bigCalcite[2].startsWith(fmt(peakDraw(big.report).drawn.calcite)));
 // the string, the .txt and the hash are covered with every card above; here also the numbers that must not be typed in the script
 const src=await read('scripts/vulcanus-foundry-builds.mjs');for(const hard of [/afbef0f1/,/\b200\b/,/\b918\b/,/\b179\.8\b/,/\b2070\b/])assert.ok(!hard.test(src),hard+' is not typed into the generator');
 // a re-release changes the card with the data: a new fuel cap, a new calcite draw at the fuel entrance, a new string, a new group
 const live=structuredClone(builds),f=live.find(x=>x.spec.key==='foundry-belts-fuel-mall');
 f.m.caps['rocket-fuel']=240;f.m.panelFigures['rocket-fuel']=15;f.report.scenarios.rate.phases.find(p=>p.perMinute&&p.accepted['calcite-fuel']).accepted['calcite-fuel']=999000;f.code+='X';f.m.groups.push({group:5,name:'steel',level:0,products:['steel-plate']});
 const page=renderPage(live.map(x=>describe(x,names)),nav()),c2=section(page,'foundry-belts-fuel-mall'),t2=rows(c2);
 assert.ok(placed(c2).some(x=>x.item==='Rocket fuel'&&x.cap===fmt(240)));assert.ok(text(c2).includes('15 a minute at its panel figure, into its own chest, cap 240'));
 assert.ok(t2.find(r=>r[0]==='In'&&r[3].includes('west edge, tile (0, 25)'))[4].startsWith(fmt(999000/30)));assert.ok(c2.includes('<textarea readonly aria-label="Foundry belts and fuel mall import string">'+f.code));
 assert.deepEqual(rows(page.split('id="how-they-connect"')[1].split('</section>')[0]).slice(1,9),rows(conn).slice(1,9),'the big mall table does not move');
});
test('foundry mall draws: peak per input over the measured rate windows, the derivation the library registers; entrances at the tiles of ports.json',async()=>{
 const b=by('foundry-mall'),{drawn,stone}=peakDraw(b.report);
 // independent derivation: the largest consumed-per-minute among the windows that have one
 const windows=b.report.scenarios.rate.phases.filter(p=>p.perMinute);assert.ok(windows.length>=6);
 for(const p of b.ports.inputs){
  const peak=Math.max(...windows.map(w=>w.perMinute.consumed[p.item]??0));assert.equal(drawn[p.item],peak,p.item);
  const row=rows(section(html,'foundry-mall')).find(r=>r[0]==='In'&&r[1]===names.get(p.item));assert.ok(row,p.item+' row');
  const col=Math.floor((p.position??p.tile).x-b.m.footprint.bounds.left),rw=Math.floor((p.position??p.tile).y-b.m.footprint.bounds.top);
  assert.ok(row[3].includes(`tile (${col}, ${rw})`)&&row[3].includes(p.label),p.item+': '+row[3]);assert.ok(row[4].startsWith(fmt(peak)),p.item+': '+row[4]);
 }
 assert.equal(stone,Math.max(...windows.map(w=>w.perMinute.stoneOut)));
 const atlas=JSON.parse(await read('site/data/atlas.json')),rec=atlas.blueprints.find(r=>r.blueprintSha256===b.m.candidateSha256);
 if(rec)for(const p of rec.operatingPorts.inputs)assert.equal(p.perMinute,Number((drawn[p.item]||0).toFixed(1)),'same figure as the library registration: '+p.item);
});

test('how they connect: every mall input, its source, the peak draw and the supply covered; the supplies own feeds; the stone exit',()=>{
 const b=by('foundry-mall'),{drawn,stone}=peakDraw(b.report),conn=html.split('id="how-they-connect"')[1].split('</section>')[0],t=rows(conn);
 for(const p of b.ports.inputs){
  const row=t.find(r=>r[0]===names.get(p.item));assert.ok(row,p.item);
  assert.ok(row[2].startsWith(fmt(drawn[p.item])),`${p.item} peak ${row[2]}`);
  const maker=SUPPLIED_BY[p.item];
  if(maker){
   const out=by(maker).report.measured.steady.throttled.outputsPerMinute[p.item];
   assert.ok(row[1].includes(by(maker).m.id.replaceAll('-',' ').slice(0,4)||'')||conn.includes(`href="#${maker}"`));
   assert.ok(row[3].includes(`makes ${fmt(out)} a minute`)&&row[3].includes(drawn[p.item]<=out?'one copy covers it':'copies needed'),p.item+': '+row[3]);
  }else assert.match(row[1],/no blueprint/i,p.item);
 }
 // the supply figures behind the sentence: 60 plastic and 300 lubricant from the coal blueprint, 60 carbide from the tungsten carbide blueprint
 const coal=by('coal-plastic-lubricant').report.measured.steady.throttled,tung=by('tungsten-carbide').report.measured.steady.throttled;
 assert.deepEqual([coal.outputsPerMinute['plastic-bar'],coal.outputsPerMinute.lubricant,tung.outputsPerMinute['tungsten-carbide']],[60,300,60]);
 const stoneRow=t.find(r=>r[0].startsWith('Stone'));assert.ok(stoneRow&&stoneRow[1].includes('lava')&&stoneRow[2]===fmt(stone));
 // what the supplies need themselves: coal, calcite, acid, water; coal, tungsten ore, acid, and the sum
 const feed=rows(conn.split('What the two supplies need themselves')[1]);
 assert.ok(!conn.includes('rocket-fuel')&&!conn.includes('Rocket fuel'),'rocket fuel is not in the connection table or the sums');
 for(const k of ['electronic-circuits','advanced-circuits','processing-units'])assert.ok(!conn.includes(k)&&!conn.includes(by(k).m.id.replaceAll('-',' ')),k+' is not in the connection table or the sums');
 assert.equal(conn.split('What the two supplies need themselves')[1].match(/<th /g).length,4,'item, two supplies, both together');
 for(const item of ['coal','calcite','sulfuric-acid','water','tungsten-ore']){
  const row=feed.find(r=>r[0]===names.get(item));assert.ok(row,item);
  const a=coal.inputsPerMinute[item],c=tung.inputsPerMinute[item];
  assert.deepEqual(row.slice(1),[a===undefined?'—':fmt(a),c===undefined?'—':fmt(c),fmt((a??0)+(c??0))],item);
 }
});

test('supplies and plate-fed malls: products, caps, draws, entrances and exits are the report and port figures',()=>{
 for(const key of ['coal-plastic-lubricant','tungsten-carbide','rocket-fuel']){
  const b=by(key),th=b.report.measured.steady.throttled,card=section(html,key),t=rows(card);
  for(const o of b.m.outputPorts){const r=t.find(x=>x[0]===names.get(o.item));assert.deepEqual(r.slice(1,3),[fmt(th.outputsPerMinute[o.item]),fmt(b.m.targets[o.item])],key+' '+o.item);}
  for(const p of b.ports.inputs){const r=t.find(x=>x[0]==='In'&&x[1]===names.get(p.item));assert.ok(r[3].startsWith(`${p.side} edge, tile (${p.tile.x}, ${p.tile.y})`)&&r[4]===fmt(th.inputsPerMinute[p.item]),key+' '+p.item);}
  for(const p of b.ports.outputs){const r=t.find(x=>x[0]==='Out'&&x[1]===names.get(p.item));assert.ok(r[3].startsWith(`${p.side} edge, tile (${p.tile.x}, ${p.tile.y})`)&&r[4]===fmt(th.outputsPerMinute[p.item]),key+' out '+p.item);}
 }
 const am3=by('assembler-3-mall'),w=am3.report.windows['rate-am3'],t3=rows(section(html,'assembler-3-mall'));
 for(const o of am3.ports.outputs){const r=t3.find(x=>x[0]===names.get(o.item));assert.deepEqual(r.slice(1,3),[fmt(am3.report.chestPeak[o.item]),fmt(w.removedPerMinute[o.item])],o.item);}
 for(const p of am3.ports.inputs){const r=t3.find(x=>x[0]==='In'&&x[1]===names.get(p.item));assert.equal(r[4],fmt(w.inputsPerMinute[p.item]),p.item);}
 const ex=by('express-belt-mall'),t4=rows(section(html,'express-belt-mall'));
 for(const o of ex.m.outputs){const r=t4.find(x=>x[0]===names.get(o.item));assert.deepEqual(r.slice(1,3),[fmt(o.cap),fmt(ex.report.measured.outputsPerMinute[o.item])],o.item);}
 for(const p of ex.ports.inputs){const r=t4.find(x=>x[0]==='In'&&x[1]===names.get(p.item));assert.equal(r[4],fmt(ex.report.measured.inputsPerMinute[p.item]),p.item);}
 for(const b of builds)assert.ok(describe(b,names).caveats.length>=2,b.spec.key+' has caveats from its README');
});

test('science from lava: rates, targets, draws, port tiles, the stone that leaves and the supply copies are the report, manifest and README figures',()=>{
 const b=by('production-utility-science'),card=section(html,'production-utility-science'),t=rows(card),th=b.report.measured.ports.throttled,rate=b.report.measured.rates.throttled;
 assert.equal(b.m.outputs.length,2);
 for(const o of b.m.outputs){const r=t.find(x=>x[0]===names.get(o.item));assert.deepEqual(r.slice(1,3),[fmt(rate[o.item]),fmt(b.m.targets[o.item])],o.item);assert.ok(rate[o.item]>=b.m.passFloor);assert.ok(text(card).includes(`tile (${o.tile.x}, ${o.tile.y})`),o.item+' chest tile');}
 assert.ok(text(card).includes(fmt(b.m.outputs[0].capacity)+' packs'));
 assert.equal(b.ports.inputs.length,5);
 for(const p of b.ports.inputs){const r=t.find(x=>x[0]==='In'&&x[1]===names.get(p.item));assert.ok(r,p.item);assert.ok(r[3].startsWith(`${p.side} edge, tile (${p.tile.x}, ${p.tile.y})`)&&r[3].includes(p.label),p.item+': '+r[3]);assert.equal(r[4],fmt(th[p.item]),p.item);assert.ok(th[p.item]<=p.perMinute+0.05,p.item+' within its panel figure');}
 const stone=b.ports.exits[0],sr=t.find(x=>x[0]==='Out'&&x[1]===names.get('stone'));assert.equal(b.ports.exits.length,1);assert.ok(sr[3].startsWith(`${stone.side} edge, tile (${stone.tile.x}, ${stone.tile.y})`));assert.equal(sr[4],fmt(th.stone));
 // the copies of the coal supply, from that supply's own measured plastic
 const supply=by('coal-plastic-lubricant').report.measured.steady.throttled.outputsPerMinute,copies=Math.ceil(b.m.bill.outside['plastic-bar']/supply['plastic-bar']-1e-9);
 assert.ok(copies>1);assert.ok(text(card).includes(`${copies} copies`),'copies of the plastic supply');
 assert.ok(text(card).includes(`${fmt(b.m.footprint.width)} × ${fmt(b.m.footprint.height)} tiles`));
 assert.ok(Object.keys(b.report.scenarios).length>=27);for(const sc of Object.values(b.report.scenarios)){assert.equal(sc.passed,true);assert.equal(sc.fluidFaultCount,0);}
 // a re-release changes the card with the data
 const live=structuredClone(builds),f=live.find(x=>x.spec.key==='production-utility-science');f.report.measured.rates.throttled['utility-science-pack']=58.25;f.report.measured.ports.throttled.lava=61234.5;
 const again=rows(section(renderPage(live.map(x=>describe(x,names)),nav()),'production-utility-science'));
 assert.equal(again.find(x=>x[0]===names.get('utility-science-pack'))[1],fmt(58.25));assert.equal(again.find(x=>x[0]==='In'&&x[1]===names.get('lava'))[4],fmt(61234.5));
});

test('circuits from lava: product rate and target, entrance draws, tiles and sides, stone exit, caveats and the copies of the plastic supply are the manifest, ports and report figures',()=>{
 const supply=by('coal-plastic-lubricant').report.measured.steady.throttled.outputsPerMinute;
 const want={'electronic-circuits':['electronic-circuit',['lava','calcite']],'advanced-circuits':['advanced-circuit',['lava','calcite','plastic-bar']],'processing-units':['processing-unit',['lava','calcite','plastic-bar','sulfuric-acid']]};
 for(const [key,[product,inputs]] of Object.entries(want)){
  const b=by(key),card=section(html,key),t=rows(card),th=b.report.measured.throttled;
  assert.equal(b.spec.kind,'circuits');assert.equal(b.spec.group,'circuits');assert.equal(b.m.product,product);assert.deepEqual(b.ports.inputs.map(p=>p.item),inputs);
  assert.ok(card.includes(`<div class="eyebrow">Circuits from lava</div>`),key+' eyebrow');
  assert.deepEqual(t.find(x=>x[0]===names.get(product)).slice(1,3),[fmt(th.productPerMinute),fmt(b.m.target)],key+' product, measured and target');
  for(const p of b.ports.inputs){
   const r=t.find(x=>x[0]==='In'&&x[1]===names.get(p.item));assert.ok(r,key+' '+p.item);
   assert.ok(r[3].startsWith(`${p.side} edge, tile (${p.tile.x}, ${p.tile.y})`)&&r[3].includes(p.label),key+' '+p.item+': '+r[3]);
   assert.equal(r[2],p.kind);assert.equal(r[4],fmt(th.drawPerMinute[p.item]),key+' draw of '+p.item);assert.ok(th.drawPerMinute[p.item]<=p.perMinute+0.05,'within its panel figure');
  }
  assert.equal(b.ports.outputs.length,2);
  const prod=b.ports.outputs.find(o=>o.product),stone=b.ports.outputs.find(o=>o.byproduct);
  const pr=t.find(x=>x[0]==='Out'&&x[1]===names.get(product)),sr=t.find(x=>x[0]==='Out'&&x[1]===names.get('stone'));
  assert.ok(pr[3].startsWith(`${prod.side} edge, tile (${prod.tile.x}, ${prod.tile.y})`)&&pr[4]===fmt(th.productPerMinute),key+' product exit');
  assert.ok(sr[3].startsWith(`${stone.side} edge, tile (${stone.tile.x}, ${stone.tile.y})`)&&sr[4]===fmt(th.stonePerMinute),key+' stone exit');
  assert.ok(text(card).includes('must be carried away'),key+': the stone caveat from the README');
  assert.ok(describe(b,names).caveats.length>=3,key+' caveats');
  assert.ok(Object.values(b.report.scenarios).every(sc=>sc.passed===true),key+' every native scenario passed');
  // plastic: the copies of the coal supply, the way the foundry mall's table counts them (measured draw over the supply's measured output)
  const sup=card.includes('<h3>Supply it needs</h3>')?text(card.split('<h3>Supply it needs</h3>')[1].split('<h3>')[0]):'';
  if(inputs.includes('plastic-bar')){
   const need=th.drawPerMinute['plastic-bar'],copies=Math.ceil(need/supply['plastic-bar']);
   assert.ok(copies>1);assert.ok(sup.includes(`${fmt(need)} a minute`)&&sup.includes(`One copy makes ${fmt(supply['plastic-bar'])} a minute: ${copies} copies needed`),key+': '+sup);
   assert.equal(copies,Math.ceil(b.ports.inputs.find(p=>p.item==='plastic-bar').perMinute/supply['plastic-bar']),'the panel figure gives the same count');
   assert.ok(card.includes('href="#coal-plastic-lubricant"'));
  }else assert.equal(sup,'',key+' takes no plastic and shows no supply note');
 }
 // the three differ: more plastic, more copies; no typed figure decides it
 const copies=k=>Math.ceil(by(k).report.measured.throttled.drawPerMinute['plastic-bar']/supply['plastic-bar']);
 assert.ok(copies('advanced-circuits')>copies('processing-units'));
 // a re-release changes the cards with the data: a new rate, a new plastic draw, a new stone figure, a stronger supply
 const live=structuredClone(builds),a=live.find(x=>x.spec.key==='advanced-circuits'),pu=live.find(x=>x.spec.key==='processing-units'),cp=live.find(x=>x.spec.key==='coal-plastic-lubricant');
 a.report.measured.throttled.productPerMinute=251.5;a.report.measured.throttled.drawPerMinute['plastic-bar']=481;a.report.measured.throttled.stonePerMinute=390.25;
 pu.report.measured.throttled.drawPerMinute['plastic-bar']=240;cp.report.measured.steady.throttled.outputsPerMinute['plastic-bar']=120;
 const page=renderPage(live.map(x=>describe(x,names)),nav()),ar=rows(section(page,'advanced-circuits')),pr=section(page,'processing-units');
 assert.equal(ar.find(x=>x[0]==='Advanced circuit')[1],fmt(251.5));assert.equal(ar.find(x=>x[0]==='In'&&x[1]==='Plastic bar')[4],fmt(481));assert.equal(ar.find(x=>x[0]==='Out'&&x[1]==='Stone')[4],fmt(390.25));
 assert.ok(text(section(page,'advanced-circuits')).includes('One copy makes 120 a minute: 5 copies needed'));assert.ok(text(pr).includes('One copy makes 120 a minute: 2 copies needed'));
 cp.report.measured.steady.throttled.outputsPerMinute['plastic-bar']=500;
 assert.ok(text(section(renderPage(live.map(x=>describe(x,names)),nav()),'processing-units')).includes('one copy covers it'));
 // the foundry mall's sums do not move when a circuits blueprint changes
 assert.equal(rows(page.split('id="how-they-connect"')[1].split('</section>')[0]).length,rows(html.split('id="how-they-connect"')[1].split('</section>')[0]).length);
});

for(const shape of ['kit stock inside the kit group (the released shape)','kit stock only a key of caps (earlier shape)'])test('a re-release changes the page with the data: new caps, a separate kit stock, a new peak, a second copy of a supply, a new string; '+shape,async()=>{
 const live=structuredClone(builds),f=live.find(b=>b.spec.key==='foundry-mall');
 f.m.caps['assembling-machine-3']=77;f.m.caps['fast-inserter (kit)']=19;
 const kitIn=f.m.groups.find(g=>g.name.includes('kit'));
 if(shape.includes('only'))kitIn.products=kitIn.products.filter(i=>i!=='fast-inserter (kit)');else if(!kitIn.products.includes('fast-inserter (kit)'))kitIn.products.push('fast-inserter (kit)');
 for(const ph of f.report.scenarios.rate.phases.filter(p=>p.perMinute))ph.perMinute.consumed['plastic-bar']=Math.min(ph.perMinute.consumed['plastic-bar'],10);
 f.report.scenarios.rate.phases.find(p=>p.perMinute).perMinute.consumed['plastic-bar']=130.04;
 f.code=f.code+'X';
 const views=live.map(b=>describe(b,names)),page=renderPage(views,nav()),card=section(page,'foundry-mall'),t=rows(card.split('<h3>What it makes</h3>')[1].split('</table>')[0]);
 assert.ok(t.some(r=>r.includes('Assembling machine 3')&&r.includes('77')),'new cap');
 const kit=t.find(r=>r.includes('Fast inserter (kit)'));assert.ok(kit&&kit.includes('19'),'kit stock listed with its own cap');
 const kitGroup=f.m.groups.find(g=>g.name.includes('kit')),kitChest=f.ports.outputs.find(o=>o.items.includes(kitGroup.products[0]));
 assert.ok(text(card).includes(kitChest.label),'in the kit chest');
 assert.ok(t.some(r=>r.includes('Fast inserter')&&r.includes('50')),'the inserter stock keeps its own cap');
 const rowsOf=placed(card),pk=rowsOf.filter(x=>x.item==='Fast inserter (kit)'),pp=rowsOf.filter(x=>x.item==='Fast inserter');
 assert.equal(pk.length,1);assert.equal(pp.length,1);assert.match(pk[0].group,/kit/);assert.match(pk[0].chest,/platform kit/);assert.match(pp[0].group,/inserters/);assert.match(pp[0].chest,/fast \+ bulk inserter/);assert.notEqual(pk[0].rate,pp[0].rate);
 assert.ok(card.includes('<textarea readonly aria-label="Foundry mall import string">'+f.code.replace(/&/g,'&amp;')),'new string');
 const conn=rows(page.split('id="how-they-connect"')[1]);
 const plastic=conn.find(r=>r[0]==='Plastic bar');assert.ok(plastic[2].startsWith('130'),plastic[2]);assert.ok(plastic[3].includes('3 copies needed'),plastic[3]);
 assert.ok(page.includes(String(fmt(130.04))));
});

test('every relative link and picture of the page exists (site, and dist when it has been built); anchors point at ids on the page',async()=>{
 for(const root of ['site','dist']){
  const file=path.join(root,ID,'index.html');
  if(root==='dist'&&!(await fs.access(file).then(()=>true,()=>false)))continue;
  const page=await read(file),ids=new Set([...page.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1])),targets=[...page.matchAll(/\s(?:href|src)="([^"]*)"/g)].map(m=>m[1]);
  assert.ok(targets.length>20);
  for(const t of targets){
   if(/^[a-z]+:/i.test(t))assert.fail('absolute link '+t);
   if(t.startsWith('#')){assert.ok(ids.has(t.slice(1)),root+' anchor '+t);continue;}
   const target=path.join(root,ID,t.split('#')[0].split('?')[0]);
   await fs.access(target).catch(()=>assert.fail(`${root}: ${t} does not exist`));
  }
 }
});

test('the committed page is what the generator writes from the current data (rebuild after a re-release)',async()=>{
 const fresh=renderPage(builds.map(b=>describe(b,names)),nav());
 assert.equal(html,fresh,'run npm run build (or node scripts/vulcanus-foundry-builds.mjs) and commit site/'+ID);
 const context={};vm.createContext(context);vm.runInContext(await read('site/flight-plans.js'),context);
 assert.ok(context.FlightPlans.plans.some(p=>p.id===ID));
});
