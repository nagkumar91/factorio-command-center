// rocket-fuel-supplier: manifest, string, native report and layout rules (CONTRACT sections 3-13, rocket-fuel-supplier.md).
// Published layout: 7 x 7 "seven-square-buried" (design review of 11-21), which replaced the 7 x 8 "ell" in place.
// Runs without the prototype dump: sizes and items come from inline tables; only the regeneration test needs the dump.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const id='rocket-fuel-supplier';
const root=new URL('../',import.meta.url),rootPath=fileURLToPath(root);
const read=p=>fs.readFile(new URL(p,root));
const hash=v=>createHash('sha256').update(v).digest('hex');
const dir=`blueprint-sources/${id}/`;
const records=JSON.parse(await read(dir+'manifest.json'));
const m=records[0],code=(await read(dir+m.file)).toString().trim();
const bp=decodeBlueprint(code).blueprint,entities=bp.entities;
const byId=new Map(entities.map(e=>[e.entity_number,e]));
// A missing or stale report must fail, not skip: read it inside the tests that need it.
const loadReport=async()=>JSON.parse(await read(dir+'native-report.json'));
const officialSha='ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const rawPath=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const allowed=new Set(['assembling-machine-2','chemical-plant','fast-transport-belt','fast-underground-belt','fast-splitter','fast-inserter','long-handed-inserter','bulk-inserter','pipe','pipe-to-ground','passive-provider-chest','substation','medium-electric-pole','constant-combinator','arithmetic-combinator','decider-combinator','display-panel']);
// Selection-box sizes (1x1 unless listed), rotated for east/west; the item that places each entity is its own name.
const size={'assembling-machine-2':[3,3],'chemical-plant':[3,3],substation:[2,2],'decider-combinator':[1,2],'arithmetic-combinator':[1,2]};
const tile=e=>[Math.floor(e.position.x),Math.floor(e.position.y)];
const vec=d=>({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[d||0];
const reachOf=e=>e.name==='long-handed-inserter'?2:1;
// direction is the side an arm picks from: pick = tile + v * reach, drop = tile - v * reach.
const pickTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x+dx*r,y+dy*r];};
const dropTile=e=>{const[x,y]=tile(e),[dx,dy]=vec(e.direction),r=reachOf(e);return[x-dx*r,y-dy*r];};
const box=e=>{let[w,h]=size[e.name]||[1,1];if([4,12].includes(e.direction))[w,h]=[h,w];return{left:e.position.x-w/2,right:e.position.x+w/2,top:e.position.y-h/2,bottom:e.position.y+h/2};};
const covers=(e,x,y)=>{const b=box(e);return x+.5>b.left&&x+.5<b.right&&y+.5>b.top&&y+.5<b.bottom;};
const entityAt=(x,y)=>entities.find(e=>covers(e,x,y));
const fmt=n=>String(Math.round(n*10)/10);

test('one record; product, target, cap, nominal demand and machines are the spec values',()=>{
 assert.equal(records.length,1);
 assert.equal(m.id,id);assert.equal(m.file,id+'.txt');assert.equal(m.class,'rate');assert.equal(m.name,'Rocket-fuel supplier · 6/min');assert.equal(bp.label,m.name);
 assert.deepEqual(m.products,['rocket-fuel']);assert.deepEqual(m.targets,{'rocket-fuel':6});assert.deepEqual(m.outputCaps,{'rocket-fuel':8});
 assert.deepEqual(m.recipeAudit.externalPerMinute,{'light-oil':660});
 assert.deepEqual(m.recipeAudit.craftsPerMinute,{'rocket-fuel':6,'solid-fuel-from-light-oil':60});
 assert.deepEqual(m.machineCounts,{'rocket-fuel':2,'solid-fuel-from-light-oil':1});
 assert.deepEqual(m.loopControl,[]);assert.equal(m.stockControl.mode,'belt-exit');assert.equal(m.stockControl.exit,m.outputs[0].entity);
 assert.deepEqual(m.protocol,{warmupMinutes:15,measureMinutes:30,blockedMinutes:10,settleMinutes:5,recoveryMinutes:10});
 assert.equal(bp.version,562954249961473);assert.deepEqual(bp.icons.map(i=>i.signal.name),['rocket-fuel']);
 assert(['qualified','native-validation-pending'].includes(m.status));
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
 assert.equal(report.harnessSha256,hash(await read(`scripts/${id}/control.lua`)),'native harness changed since report');
 assert.equal(report.validatorSha256,hash(await read(`scripts/${id}/validate.mjs`)),'validator changed since report');
 for(const field of ['dataHarnessSha256','configurationSha256'])assert.match(report[field],/^[a-f0-9]{64}$/);
 for(const[k,v]of Object.entries(m.protocol))assert.equal(report.protocolMinutes[k],v,'report protocol '+k);
});

test('native report passes the rate-class formula, recomputed from its numbers',async()=>{
 const report=await loadReport();
 const r=report.builds.find(b=>b.id===m.id);
 assert.equal(m.status,'qualified');assert.equal(report.passed,true);assert.equal(r.passed,true);
 assert(Object.values(r.checks).every(Boolean),'every named check passed');
 const floor=m.targets['rocket-fuel']*.95;
 assert(r.outputsPerMinute['rocket-fuel']>=floor,'steady rate');assert(r.recovery.outputsPerMinute['rocket-fuel']>=floor,'recovery rate');
 assert.equal(r.machines.length,3);assert.equal(r.gateWiringChecked,true,'exit gate wiring checked natively');assert(r.machines.every(x=>x.measuredCrafts>0),'every machine crafted');
 for(const x of r.machines)assert(x.measuredCrafts>=.95*m.protocol.measureMinutes*60*x.nativeCraftingSpeed/x.nativeRecipeEnergy,'full-rate crafts '+x.entity);
 assert.equal(r.inputs.length,0);
 assert.equal(r.fluids.length,1);assert(r.fluids.every(p=>p.acceptedDuringMeasurement>0&&p.productiveConsumers.length===3&&p.connectedConsumers.length===3),'light oil reaches and feeds all three machines');
 assert(r.outputPorts.every(p=>p.collectedDuringMeasurement>0),'output delivered');
 assert(r.blocked.collectionPauseStock.every(p=>p.count===8&&p.capacity===8&&p.maxDuringBlocked<=8),'exit holds exactly 8');
 assert(r.blocked.collectionPauseStock.every(p=>p.lanes[0]===4&&p.lanes[1]===4),'4 per lane');
 assert(r.blocked.machinesStoppedInLastMinute,'machines stop while blocked');
 assert(r.powered&&r.externalApproachesClear&&r.exactRecipeChecks>0&&r.importedEntities===entities.length);
 assert.equal(r.inserterCapacityResearch.fast,0);assert.equal(r.inserterCapacityResearch.bulkUnlockBonus,1);
 // Throttled feeding: every entrance drew at most its panel figure.
 for(const p of [...r.inputs,...r.fluids]){const port=m.ports.find(q=>q.entity===p.entity);assert(p.measuredPerMinute<=port.perMinute+1e-6,'draw within panel '+p.item);}
 assert.equal(m.measured.steadyPerMinute,r.outputsPerMinute['rocket-fuel']);
});

test('one west light-oil pipe entrance with its panel; one east belt exit on the bottom row',()=>{
 const inputs=m.ports.filter(p=>p.kind==='input'),fluids=m.ports.filter(p=>p.kind==='fluid');
 assert.deepEqual(inputs,[]);assert.deepEqual(fluids.map(p=>p.item),['light-oil']);
 assert.deepEqual(m.inputs,inputs);assert.deepEqual(m.fluids,fluids);
 assert.equal(entities.filter(e=>e.name==='display-panel').length,1);
 for(const p of fluids){
  const e=byId.get(p.entity);assert.equal(e.name,'pipe');assert.equal(p.direction,undefined);
  assert.equal(p.externalSide,'west');assert.deepEqual(p.items,[p.item]);
  assert.equal(p.nominalPerMinute,660);assert.equal(p.nominalPerMinute,m.recipeAudit.externalPerMinute[p.item]);assert(p.perMinute>=p.nominalPerMinute,'supply at or above nominal');
  const panel=byId.get(p.displayEntity);assert.equal(panel.name,'display-panel');assert.equal(panel.always_show,true);
  assert.deepEqual(panel.icon,{type:'fluid',name:p.item});
  assert.equal(panel.text,`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min`);
  const [px,py]=tile(e),[lx,ly]=tile(panel);assert(Math.hypot(px-lx,py-ly)<=4,'panel within 4 tiles');assert(!(ly===py&&lx<px),'panel not west of the entrance on its row');
  for(let k=1;k<=3;k++)assert(!entityAt(px-k,py),'west approach clear');
  assert.equal(px,m.footprint.left,'entrance on the west edge');
 }
 const outputs=m.ports.filter(p=>p.kind==='output');assert.equal(outputs.length,1);assert.deepEqual(m.outputs,outputs);
 const o=outputs[0];assert.equal(o.item,'rocket-fuel');assert.equal(o.externalSide,'east');assert.equal(o.transport,'belt');assert.equal(o.cap,8);assert.equal(o.direction,4);
 const exit=byId.get(o.entity);assert.equal(exit.name,'fast-transport-belt');assert.equal(exit.direction,4);
 const [ex,ey]=tile(exit);
 const behind=entityAt(ex-1,ey);assert(behind&&behind.name==='fast-transport-belt'&&behind.direction===4,'exit fed straight from behind');
 for(const y of [ey-1,ey+1]){const side=entityAt(ex,y);assert(!(side&&/belt/.test(side.name)&&side.direction===(y<ey?8:0)),'nothing side-loads the exit');}
 for(let k=1;k<=3;k++)assert(!entityAt(ex+k,ey),'east approach clear');
 assert.equal(ex+1,m.footprint.right,'exit on the east edge');assert.equal(ey,m.footprint.bottom-1,'exit on the bottom row');
 assert.deepEqual(m.supplierLinks,[{consumer:'rocket-supplies',item:'rocket-fuel',exitRowFromTop:ey-m.footprint.top,perMinute:6}]);
 const power=m.ports.filter(p=>p.kind==='power');assert.equal(power.length,1);assert.equal(byId.get(power[0].entity).name,'substation');
 assert.equal(entities.filter(e=>e.name==='substation').length,1);
 // The only wires: red, from the exit tile (hold reader) to the two solid-fuel arms, each span at most 8 tiles.
 const gate=m.stockControl.gate;assert.equal(gate.reader,o.entity);assert.equal(gate.readerMode,'per-tile-hold');
 assert.deepEqual(exit.control_behavior,{circuit_read_hand_contents:true,circuit_contents_read_mode:1});
 assert.equal(bp.wires.length,2);const net=new Set([o.entity]);
 for(const w of bp.wires){assert.equal(w[1],1);assert.equal(w[3],1);const a=byId.get(w[0]),b=byId.get(w[2]);assert(Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y)<=8,'wire span');net.add(w[0]);net.add(w[2]);}
 assert.deepEqual([...net].sort((a,b)=>a-b),[o.entity,...gate.arms].sort((a,b)=>a-b));
 for(const armId of gate.arms){const arm=byId.get(armId);assert.deepEqual(arm.control_behavior,{circuit_enabled:true,circuit_condition:{first_signal:{type:'item',name:'rocket-fuel',quality:'normal'},comparator:'<',constant:8}});}
});

test('allowed entities, arm settings, machines, hand-offs and the lanes of the two output arms',()=>{
 for(const e of entities){
  assert(allowed.has(e.name),e.name);assert.equal(e.quality??'normal','normal');
  assert(!/-module/.test(JSON.stringify(e.items??{})),'installed module '+e.entity_number);
  if(e.name==='fast-inserter'||e.name==='long-handed-inserter')assert.equal(e.override_stack_size,1);
  if(e.name==='bulk-inserter')assert.equal(e.override_stack_size,2);
  if(e.name==='chemical-plant')assert.equal(e.recipe,'solid-fuel-from-light-oil');
  if(e.recipe==='rocket-fuel')assert.equal(e.name,'assembling-machine-2');
  assert.equal(e.tags?.flight_science_entity,e.entity_number);
 }
 assert(!entities.some(e=>e.recipe&&!['rocket-fuel','solid-fuel-from-light-oil'].includes(e.recipe)),'no other recipe (no circuits, no concrete)');
 assert(!entities.some(e=>/chest|combinator|medium-electric-pole/.test(e.name)),'no chests, combinators or medium poles');
 const counts={};for(const e of entities)if(e.recipe)counts[e.recipe]=(counts[e.recipe]||0)+1;assert.deepEqual(counts,m.machineCounts);
 const plant=entities.find(e=>e.name==='chemical-plant'),fuel=entities.filter(e=>e.recipe==='rocket-fuel');
 // Hand-offs: each gated arm picks from the plant and drops into a different rocket-fuel machine.
 assert.deepEqual(m.armRoles.handOff,m.stockControl.gate.arms);
 const fed=m.armRoles.handOff.map(i=>byId.get(i)).map(a=>{assert.equal(a.name,'fast-inserter');assert.equal(entityAt(...pickTile(a)),plant);return entityAt(...dropTile(a));});
 assert.deepEqual(new Set(fed),new Set(fuel));
 // Output arms, both lanes reaching the exit tile from behind (lane rules measured natively, lane probe):
 // - the east machine's arm stands north of it and drops on a west-running belt on the top row from the south
 //   (far lane = right lane); that belt turns south, enters an underground belt at once, passes under the
 //   machine and comes up one tile above the corner (right lane = the exit's south lane);
 // - the south machine's arm drops onto the corner tile from the west (inner lane = north lane).
 assert.equal(m.armRoles.output.length,2);
 const outs=m.armRoles.output.map(i=>byId.get(i)).map(a=>{assert.equal(a.name,'fast-inserter');assert.equal(a.control_behavior,undefined,'output arms are not gated');const from=entityAt(...pickTile(a));assert(fuel.includes(from));return{arm:a,from,to:entityAt(...dropTile(a))};});
 assert.notEqual(outs[0].from,outs[1].from,'one output arm per machine');
 const top=outs.find(d=>d.arm.direction===8&&d.to.direction===12),corner=outs.find(d=>d.arm.direction===12&&d.to.direction===4);
 assert(top&&corner,'one drop on the top-row belt from the south, one drop on the corner from the west');
 for(const d of outs)assert.equal(d.to.name,'fast-transport-belt','no arm drops on an underground belt end');
 const exit=byId.get(m.outputs[0].entity),[ex,ey]=tile(exit);
 for(const d of outs)assert.notEqual(d.to,exit,'no arm drops on the exit tile itself (it would then hold 7)');
 const [tx,ty]=tile(top.to);assert.equal(ty,m.footprint.top,'east machine output on the top row');
 const turn=entityAt(tx-1,ty);assert(turn.name==='fast-transport-belt'&&turn.direction===8,'top-row belt turns south');
 assert(!entityAt(tx+1,ty)||!/belt/.test(entityAt(tx+1,ty).name),'nothing feeds the top-row belt from behind');
 const under=entities.filter(e=>e.name==='fast-underground-belt');assert.equal(under.length,2);
 const down=under.find(e=>e.type==='input'),up=under.find(e=>e.type==='output');
 assert.deepEqual(tile(down),[tx-1,ty+1],'underground entrance straight below the turn, fed from behind');assert.equal(down.direction,8);assert.equal(up.direction,8);
 const [ux,uy]=tile(up);assert.equal(ux,tx-1);assert(uy-(ty+1)-1>=1&&uy-(ty+1)-1<=6,'1 to 6 tiles between the underground ends (red reach)');
 for(let y=ty+2;y<uy;y++)assert(!entityAt(ux,y)||!/belt/.test(entityAt(ux,y).name),'no belt between the underground ends');
 const buriedMachine=fuel.filter(f=>{for(let y=ty+2;y<uy;y++)if(entityAt(ux,y)===f)return true;return false;});assert.deepEqual(buriedMachine,[top.from],'the belt runs under the machine it serves');
 for(const e of under){const [x,y]=tile(e);for(const [dx,dy,dir] of [[-1,0,4],[1,0,12]]){const side=entityAt(x+dx,y+dy);assert(!(side&&/belt/.test(side.name)&&side.direction===dir),'nothing side-loads an underground end');}}
 const [cx,cy]=tile(corner.to);assert.deepEqual([cx,cy],[ux,uy+1],'the underground exit feeds the corner from the north');
 assert.equal(entityAt(cx-1,cy),corner.arm,'nothing feeds the corner from behind: it is a curve');
 assert.deepEqual([cx+1,cy],[ex,ey],'the corner is the tile behind the exit');assert.equal(cy,m.footprint.bottom-1,'corner on the exit row');
 // Light oil: both rocket-fuel machines and the plant face a pipe (or the open end of the pipe-to-ground pair).
 const faces=e=>({0:[0,-2],4:[2,0],8:[0,2],12:[-2,0]})[e.direction||0];
 for(const f of fuel){const [fx,fy]=tile(f),[dx,dy]=faces(f),feed=entityAt(fx+dx,fy+dy);assert(feed&&['pipe','pipe-to-ground'].includes(feed.name),'light oil at the faced side of '+f.entity_number);
  if(feed.name==='pipe-to-ground')assert.equal(feed.direction,(f.direction+8)%16,'the pipe-to-ground opens into the machine');}
 assert.equal(plant.direction,8);const [px,py]=tile(plant);assert.equal(entityAt(px-1,py+2).name,'pipe','the entrance pipe is under the plant\'s south-west input');
 assert.equal(entityAt(px-1,py+2),byId.get(m.fluids[0].entity));
});

test('footprint, area goal and bill of materials recomputed from the decoded string',()=>{
 const bs=entities.map(box);
 const f={left:Math.min(...bs.map(b=>b.left)),top:Math.min(...bs.map(b=>b.top)),right:Math.max(...bs.map(b=>b.right)),bottom:Math.max(...bs.map(b=>b.bottom))};f.width=f.right-f.left;f.height=f.bottom-f.top;
 assert.deepEqual(m.footprint,f);
 assert.equal(m.areaGoal.achievedTiles,f.width*f.height);
 assert.deepEqual({goal:m.areaGoal.goalTiles,stretch:m.areaGoal.stretchTiles,fallback:m.areaGoal.fallbackTiles},{goal:78,stretch:66,fallback:110});
 assert(m.areaGoal.achievedTiles<=m.areaGoal.stretchTiles,'meets the stretch goal');
 assert.deepEqual([f.width,f.height],[7,7],'7 x 7 (design review of 11-21; the replaced layout was 7 x 8)');
 const bill={};for(const e of entities)bill[e.name]=(bill[e.name]||0)+1;
 assert.deepEqual(m.billOfMaterials.items,bill);
 assert.deepEqual(bill,{pipe:3,'pipe-to-ground':2,'chemical-plant':1,'assembling-machine-2':2,'fast-inserter':4,'fast-transport-belt':4,'fast-underground-belt':2,'display-panel':1,substation:1});assert.equal(entities.length,20);assert.deepEqual(m.construction,Object.fromEntries(Object.entries(bill).sort()));
 assert.equal(bp.tiles,undefined,'no tiles');
});

test('history: the replaced 7 x 8 version and the rejected direct-drop 7 x 7 keep their own passing reports',async()=>{
 const load=async folder=>{const h=dir+'history/'+folder+'/';const [c]=JSON.parse(await read(h+'manifest.json')),cCode=(await read(h+c.file)).toString().trim(),cReport=JSON.parse(await read(h+'native-report.json'));
  const cb=cReport.builds.find(b=>b.id===c.id);
  assert.equal(hash(cCode),c.blueprintSha256,folder);assert.equal(cb.blueprintSha256,c.blueprintSha256,folder);assert.notEqual(c.blueprintSha256,m.blueprintSha256,folder);
  assert(!cReport.short&&cReport.passed===true&&cb.passed===true,'full protocol passed for '+folder);assert.equal(cReport.prototypeSha256,officialSha);
  assert((await read(h+'NOTE.md')).toString().trim().length>0,'note says why '+folder+' is not the published version');
  return {c,cb,ce:decodeBlueprint(cCode).blueprint.entities};};
 // The version this one replaced in place: same interface, seven more tiles.
 const old=await load('ell-seven-by-eight-5e86373d');
 assert.equal(old.c.blueprintSha256,'5e86373d041a07540f2b52e3beba12326c760d45920d515e989377cabcdf79fb');
 assert.deepEqual([old.c.footprint.width,old.c.footprint.height],[7,8]);
 assert(m.areaGoal.achievedTiles<=.95*old.c.areaGoal.achievedTiles,'at least 5% fewer tiles than the replaced version');
 for(const k of ['products','targets','outputCaps','machineCounts','protocol'])assert.deepEqual(m[k],old.c[k],'same '+k+' as the replaced version');
 assert.deepEqual(m.recipeAudit.externalPerMinute,old.c.recipeAudit.externalPerMinute);
 const iface=x=>x.ports.filter(p=>p.kind!=='power').map(p=>[p.kind,p.item,p.externalSide,p.perMinute??null,p.cap??null,p.transport??null]);
 assert.deepEqual(iface(m),iface(old.c),'same entrances and exits, same sides, same order, same figures');
 const names=x=>[...new Set(x.map(e=>e.name))];
 for(const n of names(entities))assert(names(old.ce).includes(n)||n==='fast-underground-belt','no entity kind the replaced version lacked, except the red underground belt: '+n);
 assert(m.measured.steadyPerMinute>=old.c.measured.steadyPerMinute&&m.measured.recoveryPerMinute>=old.c.measured.recoveryPerMinute,'rates not lower than the replaced version');
 // Why no arm may drop on the exit tile: the 7 x 7 that does holds 4 + 3 = 7 when blocked.
 const direct=await load('seven-square-substation-exit-holds-seven');
 const dExit=direct.ce.find(e=>e.entity_number===direct.c.outputs[0].entity),[dx,dy]=tile(dExit);
 assert.equal(direct.c.armRoles.output.map(i=>direct.ce.find(e=>e.entity_number===i)).filter(a=>{const[x,y]=dropTile(a);return x===dx&&y===dy;}).length,1);
 assert.deepEqual(direct.cb.blocked.collectionPauseStock.map(p=>[p.count,p.lanes]),[[7,[4,3]]]);
});

test('layout search: no 7 x 7 without an underground belt; with one, exactly the published layout',async()=>{
 // Pure Node (no dump, no game). The sweep of every rectangle of 53 tiles or fewer is described in the README.
 const search=async(...flags)=>{const out=(await promisify(execFile)(process.execPath,[`scripts/${id}/layout-search.mjs`,'7x7','--show','2',...flags],{cwd:rootPath})).stdout.trim().split('\n');return{...JSON.parse(out[0]),pictures:out.slice(1).join('\n')};};
 const plain=await search();assert.equal(plain.tiles,49);assert(plain.stats.withBelts>0,'belt routes with a substation exist');assert.equal(plain.found,0,'none of them can also be piped');
 const buried=await search('--underground-belts');assert.equal(buried.found,1);
 // The one layout found is the published string: compare machine, arm, belt, pipe and substation tiles.
 const rows=buried.pictures.split('\n').filter(r=>[...r].length===7).slice(0,7);assert.equal(rows.length,7);
 const want=name=>new Set(entities.filter(e=>name.includes(e.name)).flatMap(e=>{const b=box(e),r=[];for(let x=Math.floor(b.left+.01);x<b.right-.01;x++)for(let y=Math.floor(b.top+.01);y<b.bottom-.01;y++)r.push(x+','+y);return r;}));
 const got=chars=>new Set(rows.flatMap((r,y)=>[...r].map((c,x)=>chars.includes(c)?x+','+y:null).filter(Boolean)));
 assert.deepEqual(got('C'),want(['chemical-plant']));assert.deepEqual(got('AB'),want(['assembling-machine-2']));assert.deepEqual(got('S'),want(['substation']));
 assert.deepEqual(got('^>v<nesw'),want(['fast-inserter']));assert.deepEqual(got('↑→↓←E∩∪'),want(['fast-transport-belt','fast-underground-belt']));assert.deepEqual(got('∩∪'),want(['fast-underground-belt']));
 assert.deepEqual(got('#=U'),want(['pipe','pipe-to-ground']));assert.deepEqual(got('U'),want(['pipe-to-ground']));
});

test('generator is reproducible and leaves the published folder byte-identical',async t=>{
 // Skip only when the dump cannot be opened (a machine without it, or the dump made unreadable).
 if(!await fs.open(rawPath,'r').then(h=>h.close().then(()=>true),()=>false)){t.skip('Pinned local prototype dump is not readable here (set FACTORIO_RAW); regeneration not checked');return;}
 const out=`.cache/${id}/test-regenerate`;
 await fs.mkdir(new URL(out+'/',root),{recursive:true});
 await fs.copyFile(new URL(dir+'native-report.json',root),new URL(out+'/native-report.json',root));
 await promisify(execFile)(process.execPath,[`scripts/${id}/generate.mjs`,'--variant',m.variant,'--supply',m.supply,'--out',out],{cwd:rootPath});
 assert.equal((await read(out+'/'+id+'.txt')).toString(),(await read(dir+id+'.txt')).toString());
 assert.equal((await read(out+'/manifest.json')).toString(),(await read(dir+'manifest.json')).toString());
});
