import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

// The dump counts as installed only when it can be opened (a file that exists but cannot be read skips too).
const readable=p=>{try{closeSync(openSync(p,'r'));return true;}catch{return false;}};
const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir='blueprint-sources/advanced-circuits/';
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
// A missing report must fail, not skip: read it inside the tests that need it.
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const product='advanced-circuit';
const allowed=new Set(['assembling-machine-2','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','substation','display-panel']);
const tile=e=>[Math.floor(e.position.x),Math.floor(e.position.y)];
const reachOf=e=>e.name==='long-handed-inserter'?2:1;
const vec=d=>({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d||0];
// direction is the side an arm picks from: pick = tile + v * reach, drop = tile - v * reach.
const pickTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x+dx*r,y+dy*r];};
const dropTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x-dx*r,y-dy*r];};
const isBelt=e=>!!e&&/belt/.test(e.name),dirOf=e=>e.direction||0,isArm=e=>/inserter/.test(e.name);
const beltAt=(x,y)=>entities.find(e=>isBelt(e)&&tile(e)[0]===x&&tile(e)[1]===y);
const entityAt=(x,y)=>entities.find(e=>e.name!=='assembling-machine-2'&&e.name!=='substation'&&tile(e)[0]===x&&tile(e)[1]===y);
const machineAt=(x,y)=>entities.find(e=>e.name==='assembling-machine-2'&&Math.abs(e.position.x-(x+.5))<=1.01&&Math.abs(e.position.y-(y+.5))<=1.01);
// Belt flow, tile to tile, as in tests/green-circuits.test.mjs. A belt's direction is its direction of travel. An
// underground entry hands to the nearest underground belt on its line within reach (7), which must be an exit facing
// the same way. A belt takes items from behind or from a side, never head-on; an underground entry only from behind.
function nextBelt(e){
 const[x,y]=tile(e),[dx,dy]=vec(dirOf(e));
 if(e.name==='fast-underground-belt'&&e.type==='input'){
  for(let k=1;k<=7;k++){const o=beltAt(x+dx*k,y+dy*k);if(o&&o.name==='fast-underground-belt'&&[dirOf(e),(dirOf(e)+8)%16].includes(dirOf(o))){assert(o.type==='output'&&dirOf(o)===dirOf(e),`underground entry at ${x},${y} pairs with an exit`);return o;}}
  assert.fail(`underground entry at ${x},${y} has no exit within reach`);
 }
 const t=beltAt(x+dx,y+dy);if(!t)return null;
 if(t.name==='fast-underground-belt')return t.type==='input'&&dirOf(t)===dirOf(e)?t:null;
 return (dirOf(t)+8)%16===dirOf(e)?null:t;
}
const follow=start=>{const seen=[];for(let e=start;e&&!seen.includes(e);e=nextBelt(e))seen.push(e);return seen;};
const exit=byId.get(m.outputs[0].entity);

test('one record; product, target, derivation, cap and recipe boundary',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,'advanced-circuits');assert.equal(m.file,'advanced-circuits.txt');assert.equal(m.class,'rate');
 assert.deepEqual(m.products,[product]);assert.deepEqual(m.targets,{[product]:187.5});
 assert.equal(m.name,'Advanced-circuit supplier · 187.5/min');assert.equal(m.variant,'outer-exits');
 // 30 of each ground science pack a minute needs 185 advanced circuits (chemical 45, production 100 through electric
 // furnaces and productivity modules, utility 40 through processing units): 24.7 machines, rounded up to 25.
 const d=m.targetDerivation;
 assert.equal(d.sciencePacksPerMinute,30);assert.equal(d.demandPerMinute,185);assert.equal(d.perMachinePerMinute,7.5);assert.equal(d.machines,25);
 assert.deepEqual(d.demandByChain,{'chemical-science-pack':45,'production-science-pack > electric-furnace':50,'production-science-pack > productivity-module':50,'utility-science-pack > processing-unit':40});
 assert.equal(d.machines,Math.ceil(d.demandPerMinute/d.perMachinePerMinute));assert(d.demandPerMinute>=60&&d.demandPerMinute<=240);
 assert.deepEqual(m.outputCaps,{[product]:7});
 assert.deepEqual(m.recipeAudit.externalPerMinute,{'plastic-bar':375,'copper-plate':937.5,'iron-plate':375});
 assert.deepEqual(m.recipeAudit.craftsPerMinute,{[product]:187.5,'electronic-circuit':375,'copper-cable':937.5});
 assert.deepEqual(m.machineCounts,{'copper-cable':11,'electronic-circuit':5,[product]:25});
 assert.deepEqual(m.loopControl,[]);assert.equal(m.stockControl.mode,'belt-exit');assert.equal(m.stockControl.cap,7);
 for(const[k,v]of Object.entries({warmupMinutes:15,measureMinutes:30,blockedMinutes:5,settleMinutes:5,recoveryMinutes:10}))assert(m.protocol[k]>=v,k);
});

test('blueprint, native report, prototypes, harness and validator hashes agree',async()=>{
 const report=await loadReport();
 const evidence=report.builds.find(b=>b.id===m.id);
 assert(evidence,'native build evidence missing');
 assert.equal(hash(code),m.blueprintSha256);
 assert.equal(evidence.blueprintSha256,m.blueprintSha256,'native report is stale for blueprint');
 assert.equal(m.prototypeSha256,officialSha);assert.equal(report.prototypeSha256,officialSha);
 assert.equal(report.gameVersion,'2.1.24');
 assert(!report.short,'an exploration report is not a qualification');
 assert.equal(report.harnessSha256,hash(await read('scripts/advanced-circuits/control.lua')),'native harness changed since report');
 assert.equal(report.validatorSha256,hash(await read('scripts/advanced-circuits/validate.mjs')),'validator changed since report');
 for(const field of ['dataHarnessSha256','configurationSha256'])assert.match(report[field],/^[a-f0-9]{64}$/);
 for(const[k,v]of Object.entries(m.protocol))assert.equal(report.protocolMinutes[k],v,'report protocol '+k);
 assert.match(report.feedPolicy,/throttled to the manifest perMinute/);
});

test('native report passes, recomputed from its numbers (entrances fed exactly the panel figures)',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id),minutes=m.protocol.measureMinutes;
 assert.equal(m.status,'qualified');assert.equal(report.passed,true);assert.equal(r.passed,true);
 assert(Object.values(r.checks).every(Boolean));
 const floor=m.targets[product]*.95;
 assert(r.outputsPerMinute[product]>=floor,'steady rate');assert(r.recovery.outputsPerMinute[product]>=floor,'recovery rate');
 assert.equal(m.measured.steadyPerMinute,r.outputsPerMinute[product]);assert.equal(m.measured.recoveryPerMinute,r.recovery.outputsPerMinute[product]);
 assert.equal(r.machines.length,41);assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 // Every advanced-circuit machine at full rate: at least 95% of its maximum crafts, working at 95% of the samples.
 for(const x of r.machines.filter(x=>x.recipe===product)){
  assert(x.measuredCrafts>=.95*minutes*60*x.nativeCraftingSpeed/x.nativeRecipeEnergy,'full-rate crafts '+x.entity);
  assert((x.statusSamples.working||0)>=.95*minutes*60,'working '+x.entity);
 }
 // Each entrance was fed its panel figure and took no more; every one reached a machine that used it.
 assert.equal(r.inputs.length,4);
 for(const p of r.inputs){const port=m.inputs.find(q=>q.entity===p.entity);assert.equal(p.perMinute,port.perMinute);assert(p.measuredPerMinute<=port.perMinute+1e-6);assert(p.measuredPerMinute>=.99*port.perMinute,'entrance '+p.item+' took its panel figure');assert(p.productiveRoute.length>0);}
 assert.deepEqual(m.measured.inputsPerMinute.map(p=>[p.item,p.perMinute,p.measuredPerMinute]),r.inputs.map(p=>[p.item,p.perMinute,p.measuredPerMinute]));
 const lanes=r.outputPorts[0].collectedByLane;
 assert.equal(lanes[0]+lanes[1],r.outputPorts[0].collectedDuringMeasurement);
 assert.deepEqual(m.measured.exitLanesPerMinute,{north:lanes[0]/minutes,south:lanes[1]/minutes});
 assert.deepEqual(r.exitForeignItems,[]);assert(r.exitChecks>=(m.protocol.warmupMinutes+minutes)*60,'the exit was inspected every second');
 assert(r.blocked.collectionPauseStock.every(p=>p.count===7&&p.capacity===7&&p.maxDuringBlocked<=7),'exit holds exactly 7');
 assert.equal(m.measured.blockedExitStock,7);assert(r.blocked.machinesStoppedInLastMinute,'machines stop while blocked');
 assert(r.powered&&r.externalApproachesClear&&r.exactRecipeChecks>0);
 assert.equal(r.bulkInserters.length,9);assert(r.bulkInserters.every(a=>a.observedMaxHand<=2&&a.observedMaxHand>0));
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);
 // The underfed copy (80% of every panel figure) made 80% of the target, within 95..103%, before and after blocking.
 const u=r.underfed;assert.equal(u.feedScale,.8);assert(Object.values(u.checks).every(Boolean));
 assert(u.steadyPerMinute[product]>=.95*150&&u.steadyPerMinute[product]<=1.03*150);assert(u.recoveryPerMinute[product]>=.95*150);
 assert.deepEqual(u.exitForeignItems,[]);
 assert.equal(m.measured.underfed.steadyPerMinute,u.steadyPerMinute[product]);
});

test('four west entrances with labelled display panels; one east belt exit',()=>{
 const inputs=m.ports.filter(p=>p.kind==='input');
 assert.deepEqual(inputs.map(p=>[p.item,p.x,p.y,p.perMinute]),[['copper-plate',.5,1.5,600],['iron-plate',.5,2.5,375],['plastic-bar',.5,5.5,375],['copper-plate',.5,13.5,337.5]]);
 assert.deepEqual(m.inputs,inputs);assert.deepEqual(m.fluids,[]);
 const sum={};for(const p of inputs)sum[p.item]=(sum[p.item]||0)+p.perMinute;assert.deepEqual(sum,m.recipeAudit.externalPerMinute);
 assert.equal(new Set(inputs.map(p=>p.entity)).size,4);assert.equal(entities.filter(e=>e.name==='display-panel').length,4);
 for(const p of inputs){
  const belt=byId.get(p.entity);assert.equal(belt.name,'fast-transport-belt');assert.equal(belt.direction,4);
  assert.equal(p.externalSide,'west');assert.equal(p.direction,4);assert.deepEqual(p.items,[p.item]);
  const panel=byId.get(p.displayEntity);assert.equal(panel.name,'display-panel');assert.equal(panel.always_show,true);
  assert.deepEqual(panel.icon,{type:'item',name:p.item});
  assert.equal(panel.text,`IN: ${p.item}\nWEST · ${Math.round(p.perMinute*10)/10}/min at nominal target`);
  const [px,py]=tile(belt),[lx,ly]=tile(panel);assert(Math.hypot(px-lx,py-ly)<=4,'panel within 4 tiles');assert(!(ly===py&&lx<px),'panel not west of the entrance on its row');
  assert.equal(px,m.footprint.left,'entrance on the west edge');
 }
 const outputs=m.ports.filter(p=>p.kind==='output');
 assert.equal(outputs.length,1);const o=outputs[0];
 assert.equal(o.item,product);assert.equal(o.externalSide,'east');assert.equal(o.transport,'belt');assert.equal(o.cap,7);
 assert.equal(exit.name,'fast-transport-belt');assert.equal(exit.direction,4);
 const [ex,ey]=tile(exit);
 // Fed from behind by the top collector (north lane, holds 4) and side-loaded from the south by the climbing bottom
 // collector (south lane, holds 3): 7 when blocked, measured.
 const behind=beltAt(ex-1,ey);assert(behind&&behind.direction===4&&behind.type!=='input','exit fed straight from behind');
 const south=beltAt(ex,ey+1);assert(south&&south.name==='fast-underground-belt'&&south.type==='output'&&south.direction===0,'the bottom collector side-loads the exit from the south');
 assert(!beltAt(ex,ey-1),'nothing north of the exit');
 assert.equal(Math.ceil(exit.position.x),m.footprint.right,'exit on the east edge');
 const power=m.ports.filter(p=>p.kind==='power');assert.equal(power.length,1);assert.equal(byId.get(power[0].entity).name,'substation');
 const subs=entities.filter(e=>e.name==='substation');assert.equal(subs.length,5);assert.equal(m.construction.substation,5);
 // The substations form one tree of copper wires (connector 5) and nothing else is wired.
 assert.equal((bp.wires||[]).length,subs.length-1);
 for(const w of bp.wires){assert.equal(w[1],5);assert.equal(w[3],5);assert.equal(byId.get(w[0]).name,'substation');assert.equal(byId.get(w[2]).name,'substation');}
 // Every substation stands in the aisle (rows 5..8), where the aisle belts pass under it.
 for(const s of subs){assert(s.position.y>=6&&s.position.y<=8,'substation in the aisle');}
});

test('allowed entities, arm settings and arm roles',()=>{
 for(const e of entities){
  assert(allowed.has(e.name),e.name);assert.equal(e.quality??'normal','normal');
  assert(!/-module/.test(JSON.stringify(e.items??{})),'installed module '+e.entity_number);
  if(e.name==='fast-inserter'||e.name==='long-handed-inserter')assert.equal(e.override_stack_size,1);
  if(e.name==='bulk-inserter')assert.equal(e.override_stack_size,2);
  if(e.recipe)assert.equal(e.name,'assembling-machine-2');
  assert.equal(e.tags?.flight_science_entity,e.entity_number);
 }
 const counts={};for(const e of entities)if(e.recipe)counts[e.recipe]=(counts[e.recipe]||0)+1;assert.deepEqual(counts,m.machineCounts);
 const roles=m.armRoles,all=Object.values(roles).flat().sort((a,b)=>a-b);
 assert.deepEqual(all,entities.filter(isArm).map(e=>e.entity_number).sort((a,b)=>a-b),'every arm has exactly one role');
 // Gap arms: one bulk arm from each paired cable machine into its circuit machine.
 assert.equal(roles.gap.length,5);
 for(const id of roles.gap){const a=byId.get(id);assert.equal(a.name,'bulk-inserter');assert.equal(machineAt(...pickTile(a))?.recipe,'copper-cable');assert.equal(machineAt(...dropTile(a))?.recipe,'electronic-circuit');}
 // Plate arms: filtered to one plate, from a plate belt into a machine that uses that plate.
 for(const id of roles.input){const a=byId.get(id);assert.equal(a.name,'fast-inserter');assert(a.use_filters&&a.filters.length===1);const into=machineAt(...dropTile(a));assert(isBelt(entityAt(...pickTile(a))));assert.equal(a.filters[0].name,into.recipe==='copper-cable'?'copper-plate':'iron-plate');}
 assert.equal(roles.input.length,16);
 // Output arms: one per advanced-circuit machine, onto a belt.
 assert.equal(roles.output.length,25);
 for(const id of roles.output){const a=byId.get(id);assert.equal(machineAt(...pickTile(a))?.recipe,product);assert(isBelt(entityAt(...dropTile(a))));}
 const reds=entities.filter(e=>e.recipe===product);assert.equal(new Set(roles.output.map(id=>machineAt(...pickTile(byId.get(id))))).size,reds.length);
 // Every advanced-circuit machine has two aisle arms that pick from the two aisle belts (rows 6 and 7).
 for(const r of reds){const arms=entities.filter(a=>isArm(a)&&machineAt(...dropTile(a))===r);assert.equal(arms.length,2);assert.deepEqual(arms.map(a=>pickTile(a)[1]).sort(),[6,7]);}
 assert(!entities.some(e=>/chest|combinator/.test(e.name)),'no chests or combinators');
 assert.equal(bp.version,562954249961472);assert.deepEqual(bp.icons.map(i=>i.signal.name),[product]);
});

test('belts: plates and intermediates never reach the exit; every product drop does',()=>{
 const belts=entities.filter(isBelt);
 const reach=new Map();for(const b of belts)reach.set(b,follow(b));
 const reachesExit=b=>reach.get(b).includes(exit);
 // Entrances: each reaches the arms that need it and never the exit.
 for(const p of m.inputs){
  const path=reach.get(byId.get(p.entity));assert(!path.includes(exit),p.item+' never reaches the exit');
  const fed=entities.filter(a=>isArm(a)&&path.includes(entityAt(...pickTile(a)))&&machineAt(...dropTile(a)));
  assert(fed.length>0,p.item+' feeds some machine');
 }
 // Every belt reachable from an arm drop is either on a product path (only advanced-circuit drops) or an aisle belt
 // (only cable or circuit drops); the two never share a tile.
 const productTiles=new Set(),aisleTiles=new Set();
 for(const a of entities.filter(isArm)){
  const from=machineAt(...pickTile(a)),to=entityAt(...dropTile(a));if(!from||!isBelt(to))continue;
  const path=reach.get(to);
  if(from.recipe===product){assert(reachesExit(to),'advanced circuits from '+from.entity_number+' reach the exit');path.forEach(t=>productTiles.add(t));}
  else{assert(!reachesExit(to),from.recipe+' never reaches the exit');path.forEach(t=>aisleTiles.add(t));}
 }
 for(const t of productTiles)assert(!aisleTiles.has(t),'product and intermediates share no tile');
 for(const b of belts)if(reachesExit(b))assert(productTiles.has(b),'only product belts lead to the exit: '+tile(b));
 // No arm picks anything from a product belt, and no plate arm drops on one.
 for(const a of entities.filter(isArm)){const from=entityAt(...pickTile(a));assert(!productTiles.has(from),'no arm picks from a product belt');}
 // Every aisle and plate belt ends in a dead end that does not face another belt.
 for(const b of belts){if(reachesExit(b))continue;const end=reach.get(b).at(-1);const[x,y]=tile(end),[dx,dy]=vec(dirOf(end));assert(!beltAt(x+dx,y+dy),'dead end at '+tile(end)+' faces no belt');}
 const undergrounds=belts.filter(e=>e.name==='fast-underground-belt');
 assert.equal(undergrounds.filter(e=>e.type==='input').length,undergrounds.filter(e=>e.type==='output').length);
 assert.equal(m.construction['fast-underground-belt'],undergrounds.length);assert.equal(m.construction['fast-transport-belt'],belts.length-undergrounds.length);
});

test('aisle lanes: plastic and circuits on X1, cable on X2; one plate per lane at the top-left merge',()=>{
 // X1 starts at (1,6), side-loaded from the north by the plastic entrance and held straight by the stub (1,7).
 const x1=beltAt(1,6),plastic=byId.get(m.inputs.find(p=>p.item==='plastic-bar').entity);
 assert.deepEqual(follow(plastic).slice(0,3).map(tile),[[0,5],[1,5],[1,6]]);
 assert.equal(beltAt(1,5).direction,8);assert.equal(beltAt(1,7).direction,0);assert(!beltAt(0,6),'nothing feeds X1 from behind');
 assert.equal(x1.direction,4);
 // Circuit machines drop onto X1 from the north (its south lane); nothing drops on X1 from the south.
 for(const a of entities.filter(isArm)){const t=entityAt(...dropTile(a));if(!t||tile(t)[1]!==6||!isBelt(t))continue;assert.equal(tile(a)[1],5);assert.equal(machineAt(...pickTile(a)).recipe,'electronic-circuit');}
 // Only cable is dropped on X2.
 for(const a of entities.filter(isArm)){const t=entityAt(...dropTile(a));if(!t||tile(t)[1]!==7||!isBelt(t))continue;assert.equal(machineAt(...pickTile(a)).recipe,'copper-cable');}
 // Top plate belt: copper from the west and iron from the east side-load the north-facing tile (1,1), which turns
 // east at (1,0); iron arms (filter) and copper arms both pick from row 0.
 assert.equal(beltAt(1,1).direction,0);assert.equal(beltAt(0,1).direction,4);assert.equal(beltAt(2,1).direction,12);assert.equal(beltAt(1,0).direction,4);assert(!beltAt(1,2)||beltAt(1,2).direction!==0,'nothing feeds the merge from behind');
});

test('footprint matches the decoded string',()=>{
 const size={'assembling-machine-2':[3,3],substation:[2,2]};
 const xs=[],ys=[];
 for(const e of entities){let[w,h]=size[e.name]||[1,1];xs.push(e.position.x-w/2,e.position.x+w/2);ys.push(e.position.y-h/2,e.position.y+h/2);}
 const f={left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);assert.deepEqual([f.width,f.height],[66,14]);
 assert.equal(m.tiles,924);assert.equal(m.tilesPerUnitPerMinute,4.928);
 assert.equal(m.entityCount,entities.length);
});

test('generator is reproducible: the same variant gives the same string and target',async t=>{
 if(!readable(rawPath)){t.skip('Pinned local prototype dump is not installed (set FACTORIO_RAW)');return;}
 const out='.cache/advanced-circuits/test-regenerate';
 // Start from the committed string: zlib bytes differ between platforms, and the generator keeps a committed string that
 // decodes to exactly the blueprint it builds. A fresh encoding is checked by decoding.
 await fs.rm(new URL(out,root),{recursive:true,force:true});
 const fresh=out+'-fresh';await fs.rm(new URL(fresh,root),{recursive:true,force:true});
 await promisify(execFile)(process.execPath,['scripts/advanced-circuits/generate.mjs','--variant',m.variant,'--out',fresh],{cwd:rootPath});
 assert.deepEqual(decodeBlueprint((await read(fresh+'/advanced-circuits.txt')).toString().trim()),decodeBlueprint(code),'a fresh encoding decodes to the committed blueprint');
 await fs.mkdir(new URL(out,root),{recursive:true});await fs.writeFile(new URL(out+'/advanced-circuits.txt',root),code+'\n');
 await promisify(execFile)(process.execPath,['scripts/advanced-circuits/generate.mjs','--variant',m.variant,'--out',out],{cwd:rootPath});
 const again=(await read(out+'/advanced-circuits.txt')).toString().trim();
 assert.equal(hash(again),m.blueprintSha256);
 const mm=JSON.parse(await read(out+'/manifest.json'))[0];assert.deepEqual(mm.targetDerivation,m.targetDerivation);
});
