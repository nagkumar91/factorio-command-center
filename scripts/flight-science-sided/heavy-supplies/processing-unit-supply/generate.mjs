// Processing-unit supply factory for the Compact six-pack tier (flight-science-sided family): 40 processing
// units per minute from supplied electronic circuits, advanced circuits and sulfuric acid. The factory holds only
// the processing-unit assembling machines (normal assembling machine 2, no modules), fast inserters, red belts,
// pipes and pipes-to-ground. One inlet per material on the west, each with a display panel; one filtered fast
// inserter into a steel chest on the east, like the family's other supply factories.
//
// Recipe figures come from the family's 2.1.24 flight-save prototype dump (the copied mod profile the family's
// own validator uses, data-raw-dump.json SHA-256 33912441...). See README.md in the blueprint folder.
//
// Variants (both natively screened; `one-row` is published):
//  one-row  (published; `one-row-wide` is the same with the first, one column wider west strip) nine machines in one row. The input belt runs along the north side (circuits on its south lane,
//           advanced circuits on its north lane); the processing units leave on a belt along the south side.
//           Machines face east and west in pairs so each pair's acid inputs meet in the gap column between them;
//           the acid header runs along the output arm row with pipe-to-ground hops under the machines' edges.
//  two-row  five machines over four, both rows facing one shared input belt in the middle (the same two lanes);
//           each row sends its processing units out on its own outer belt, the top one turns down the east side
//           and side-loads the bottom one before the chest. Each row has its own acid header in its outer arm
//           row; the two headers meet through the west gap column, under the input belt.
// Usage: node scripts/flight-science-sided/heavy-supplies/processing-unit-supply/generate.mjs [--variant one-row|two-row] [--out dir]
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../../../blueprints.mjs';
import {powerStarterLayout,starterBounds} from '../../../science-factory/local-ports/compact-shared-layout.mjs';

const project=path.resolve(new URL('../../../..',import.meta.url).pathname);
export const id='processing-unit-supply';
export const sourceFolder=path.join(project,'blueprint-sources/flight-science-sided/heavy-supplies',id);
// The family's validator reads .cache/flight-21; this work keeps its private copy of the same profile under
// .cache/heavy-supplies/flight-21. FLIGHT_RAW overrides both.
export const rawCandidates=[process.env.FLIGHT_RAW,path.join(project,'.cache/heavy-supplies/flight-21/script-output/data-raw-dump.json'),path.join(project,'.cache/flight-21/script-output/data-raw-dump.json')].filter(Boolean);
export const familyPrototypeSha256='33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f';
const sha=s=>createHash('sha256').update(s).digest('hex');

async function readRaw(){for(const file of rawCandidates){try{return {file,bytes:await fs.readFile(file)};}catch{}}throw Error('Flight 2.1.24 prototype dump not found: '+rawCandidates.join(', '));}

export async function build(variant='one-row'){
 assert(['one-row','one-row-wide','two-row'].includes(variant),'unknown variant '+variant);
 const {bytes}=await readRaw(),raw=JSON.parse(bytes);
 assert.equal(sha(bytes),familyPrototypeSha256,'not the family prototype dump');
 // ---------- figures from the prototype dump ----------
 const product='processing-unit',recipe=raw.recipe[product],am2=raw['assembling-machine']['assembling-machine-2'];
 const amount=(list,n)=>list.find(i=>i.name===n)?.amount??0;
 const target=40;
 const perMachine=60*am2.crafting_speed/recipe.energy_required*amount(recipe.results,product);
 const machines=Math.ceil(target/perMachine-1e-9);
 const crafts=target/amount(recipe.results,product);
 const perMinute=Object.fromEntries(recipe.ingredients.map(i=>[i.name,crafts*i.amount]));
 assert.deepEqual(Object.keys(perMinute).sort(),['advanced-circuit','electronic-circuit','sulfuric-acid']);
 // A red belt lane moves speed (tiles per tick) x 60 ticks x 4 items per lane-tile: 900 per minute. The circuit
 // lane carries 800 of them.
 const laneCapacityPerMinute=raw['transport-belt']['fast-transport-belt'].speed*60*4*60;
 assert(perMinute['electronic-circuit']<laneCapacityPerMinute,'circuits exceed one lane');
 const derivation={laneCapacityPerMinute,recipe:{energyRequired:recipe.energy_required,ingredients:recipe.ingredients,results:recipe.results,categories:recipe.categories},assemblingMachine2CraftingSpeed:am2.crafting_speed,perMachinePerMinute:perMachine,machinesExact:target/perMachine,machines,machineCapacityPerMinute:machines*perMachine,targetPerMinute:target,inletsPerMinute:perMinute};

 // ---------- placement with collision checks ----------
 let next=1;const entities=[],occupied=new Map(),counts={};
 const key=(x,y)=>x+','+y;
 const N=0,E=4,S=8,W=12;
 function add(name,x,y,extra={}){const r=name==='assembling-machine-2'?1:0;for(let a=x-r;a<=x+r;a++)for(let b=y-r;b<=y+r;b++){assert(!occupied.has(key(a,b)),`${variant}: ${name} at ${x},${y} overlaps ${occupied.get(key(a,b))?.name} at ${a},${b}`);occupied.set(key(a,b),{name});}const e={entity_number:next++,name,position:{x:x+.5,y:y+.5},...extra};entities.push(e);return e;}
 const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
 const arm=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra}); // d: the side picked from
 const pipe=(x,y)=>add('pipe',x,y);
 const ptg=(x,y,d)=>add('pipe-to-ground',x,y,{direction:d}); // d: the above-ground side
 const machine=(cx,cy,d)=>{counts[product]=(counts[product]||0)+1;return add('assembling-machine-2',cx,cy,{recipe:product,direction:d});};
 const filter=n=>({use_filters:true,filters:[{index:1,name:n,quality:'normal',comparator:'='}]});
 const ports=[],roles={feed:[],output:[],outlet:[]};
 const inlet=(item,x,y,rate)=>{const e=belt(x,y,E);ports.push({kind:'input',label:item,items:[item],entity:e.entity_number,x:e.position.x,y:e.position.y,direction:E,externalSide:'west',perMinute:rate});return e;};

 // A pair of machines (west one facing west, east one facing east) with its acid gap columns, as in
 // pattern  [gap] W E [gap] W E [gap] ... : every gap column feeds the two machines that face it.
 // row: {mid, inArm, inSide (side the input arm picks from), outArm, outSide, header, toHeader (rows between mid and header)}
 function machineRow(count,row){
  const centres=[];for(let k=0;k<count;k++){const pair=Math.floor(k/2),cx=1+7*pair+(k%2?4:1);centres.push(cx);machine(cx,row.mid,k%2?E:W);}
  const gaps=[];for(let g=0;g<=7*Math.floor((count-1)/2)+7;g+=7){if(g===0||centres.some(c=>c===g-2||c===g+2))gaps.push(g);}
  // A gap column is needed only where a machine faces it.
  const used=gaps.filter(g=>centres.some((c,k)=>(k%2===0&&c-2===g)||(k%2===1&&c+2===g)));
  for(const g of used){pipe(g,row.mid);for(const y of row.toHeader)pipe(g,y);if(!row.skipHeaderPipe?.includes(g))pipe(g,row.header);}
  for(let i=0;i+1<used.length;i++){ptg(used[i]+1,row.header,W);ptg(used[i+1]-1,row.header,E);}
  // Two feed arms per machine (west and east columns); row.lastFeedWest moves the last machine's east arm to its
  // middle column so the input belt can end one tile earlier.
  for(const c of centres){const east=row.lastFeedWest&&c===Math.max(...centres)?c:c+1;roles.feed.push(arm(c-1,row.inArm,row.inSide),arm(east,row.inArm,row.inSide));roles.output.push(arm(c,row.outArm,row.outSide));}
  return {centres,gaps:used};
 }

 // West strip: the input belt row `r` starts with a curve at (-2,r) fed from the south (column -2, rows r+1..r+2).
 // Advanced circuits side-load that column's west lane at (-2,r+1), which the right-hand curve turns into the
 // north lane; circuits come up column -1 and side-load the south lane at (-1,r).
 // wide (screened candidates): inlets at x=-4, acid enters through a pipe-to-ground pair from (-4,acidRow) to
 // (-1,acidRow) next to the gap column x=0.
 // narrow (published): inlets at x=-3 (the advanced-circuit inlet tile itself side-loads the column), acid enters
 // by plain pipes along acidRow into the gap column; the big pole fits in the strip under the circuit inlet.
 function westStrip(r,acidRow,narrow){
  const x0=narrow?-3:-4;
  belt(-2,r+2,N);belt(-2,r+1,N);belt(-2,r,E);
  inlet('advanced-circuit',x0,r+1,perMinute['advanced-circuit']);if(!narrow)belt(-3,r+1,E);
  inlet('electronic-circuit',x0,r+3,perMinute['electronic-circuit']);if(!narrow)belt(-3,r+3,E);belt(-2,r+3,E);belt(-1,r+3,N);belt(-1,r+2,N);belt(-1,r+1,N);
  let acid;if(narrow){acid=pipe(x0,acidRow);for(let x=x0+1;x<=0;x++)pipe(x,acidRow);}else{acid=ptg(-4,acidRow,W);ptg(-1,acidRow,E);}
  ports.push({kind:'fluid',label:'sulfuric-acid',items:['sulfuric-acid'],entity:acid.entity_number,x:acid.position.x,y:acid.position.y,externalSide:'west',perMinute:perMinute['sulfuric-acid']});
 }
 const outlet=(x,y)=>{roles.outlet.push(arm(x,y,W,filter(product)));const e=add('steel-chest',x+1,y,{bar:2});ports.push({kind:'output',label:product,items:[product],entity:e.entity_number,x:e.position.x,y:e.position.y,externalSide:'east',perMinute:target});return e;};

 let panelSpots;
 if(variant!=='two-row'){
  // rows: 0 input belt, 1 feed arms, 2..4 machines, 5 output arms + acid header, 6 processing-unit belt
  const narrow=variant==='one-row';
  // narrow: acid along row 6 west of the processing-unit belt, up the gap column at (0,6).
  westStrip(0,narrow?6:5,narrow);
  const {centres}=machineRow(machines,{mid:3,inArm:1,inSide:N,outArm:5,outSide:N,header:5,toHeader:[4]});
  const east=Math.max(...centres)+1;
  for(let x=-1;x<=east;x++)belt(x,0,E);
  for(let x=centres[0];x<east;x++)belt(x,6,E);
  outlet(east,6);
  panelSpots=narrow?{'advanced-circuit':[-3,0],'electronic-circuit':[-3,2],'sulfuric-acid':[-1,5]}:{'advanced-circuit':[-4,0],'electronic-circuit':[-4,2],'sulfuric-acid':[-4,4]};
 }else{
  // rows: 0 top processing-unit belt, 1 top output arms + header, 2..4 top machines, 5 top feed arms,
  // 6 shared input belt, 7 bottom feed arms, 8..10 bottom machines, 11 bottom output arms + header,
  // 12 bottom processing-unit belt
  const top=Math.ceil(machines/2),bottom=machines-top;
  westStrip(6,4);
  const a=machineRow(top,{mid:3,inArm:5,inSide:S,outArm:1,outSide:S,header:1,toHeader:[2],lastFeedWest:true});
  const b=machineRow(bottom,{mid:9,inArm:7,inSide:N,outArm:11,outSide:N,header:11,toHeader:[10]});
  // The west gap column joins the two headers: (0,4) meets the acid entrance, a pipe-to-ground pair crosses the
  // input belt from (0,5) to (0,7).
  pipe(0,4);ptg(0,5,N);ptg(0,7,S);pipe(0,8);
  // The input belt ends under the last top machine's middle arm, one tile short of the processing-unit belt's
  // turn column, so it cannot side-load circuits onto that column.
  const east=Math.max(...a.centres)+1;
  for(let x=-1;x<east;x++)belt(x,6,E);
  const turn=east+1;
  for(let x=a.centres[0];x<turn;x++)belt(x,0,E);belt(turn,0,S);for(let y=1;y<12;y++)belt(turn,y,S);
  for(let x=b.centres[0];x<=turn;x++)belt(x,12,E);
  outlet(turn+1,12);
  panelSpots={'advanced-circuit':[-4,8],'electronic-circuit':[-4,10],'sulfuric-acid':[-4,3]};
 }

 // ---------- power: the family's big pole (power port) and medium poles ----------
 ports.push({kind:'power',label:'External electricity',items:[],entity:0,x:0,y:0});
 const bp={item:'blueprint',version:562954249961472,label:`${id} · ${target}/min`,entities,wires:[],icons:[{index:1,signal:{type:'item',name:product}}]};
 for(const p of ports.filter(p=>p.kind!=='power')){const [x,y]=p.kind==='output'?[Math.floor(p.x),Math.floor(p.y)-1]:panelSpots[p.items[0]];add('display-panel',x,y,{tags:{temporary_port_clearance:true},_port:p});}
 const panels=bp.entities.filter(e=>e.tags?.temporary_port_clearance);
 // Reserve the panel tiles while the poles are placed, then put the real panels there.
 powerStarterLayout(bp,ports,raw);
 bp.entities=bp.entities.filter(e=>!e.tags?.temporary_port_clearance);
 let eid=Math.max(...bp.entities.map(e=>e.entity_number))+1;
 const fmt=n=>String(Math.round(n*100)/100);
 for(const q of panels){const p=q._port;if(p.kind==='output')continue;const kind=p.kind==='fluid'?'fluid':'item';bp.entities.push({entity_number:eid++,name:'display-panel',position:q.position,icon:{type:kind,name:p.items[0]},text:`input: ${p.label} ${fmt(p.perMinute)}/min${p.kind==='fluid'?' (pipe)':''}`,always_show:true});p.displayEntity=eid-1;}
 {const p=ports.find(p=>p.kind==='output');const q=panels.find(q=>q._port===p);bp.entities.push({entity_number:eid++,name:'display-panel',position:q.position,icon:{type:'item',name:product},text:`output: ${product} ${target}/min`,always_show:true});p.displayEntity=eid-1;}
 for(const e of bp.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 const powerPort=ports.find(p=>p.kind==='power');
 const description=`One inlet per material on the left: electronic circuits ${fmt(perMinute['electronic-circuit'])}/min, advanced circuits ${fmt(perMinute['advanced-circuit'])}/min (belts, either lane), sulfuric acid ${fmt(perMinute['sulfuric-acid'])}/min (pipe). Collect ${target} processing units/min from the chest on the right. ${machines} AM2, fast inserters, red belts, pipes and pipes-to-ground; no modules, no robots. Keep the machines' facing (acid enters from the gap between each pair) and the pipe-to-ground pairs. Electricity at the big pole.`;
 bp.description=description;
 const footprint=starterBounds(bp.entities,raw);
 const construction=Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].sort().map(n=>[n,bp.entities.filter(e=>e.name===n).length]));
 return {bp,ports,counts,footprint,construction,perMinute,derivation,roles,product,target,machines,rawBytes:bytes,description,powerPort};
}

export async function generate({variant='one-row',out=sourceFolder}={}){
 const r=await build(variant),{bp,ports,product,target}=r;
 // Keep the committed string when it decodes to exactly this blueprint (another zlib build may compress the same
 // JSON differently), so its SHA-256 and native report stay valid everywhere.
 const committed=await fs.readFile(path.join(out,id+'.txt'),'utf8').then(t=>t.trim(),()=>null);
 const same=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
 const code=committed&&same(committed)?committed:encodeBlueprint({blueprint:bp});
 const blueprintSha256=sha(code);
 let status='awaiting-native-validation',nativeEvidence,measured;
 try{
  const report=JSON.parse(await fs.readFile(path.join(out,'native-report.json'),'utf8'));
  const proof=report.builds?.find(b=>b.id===id&&b.blueprintSha256===blueprintSha256);
  if(proof&&report.short===false){
   status=proof.passed&&report.passed?'native-verified':'native-failed';
   nativeEvidence={file:'native-report.json',blueprintSha256,harnessSha256:report.harnessSha256,warmupMinutes:report.warmupMinutes,measurementMinutes:report.measurementMinutes,recovery:{collectionPauseMinutes:proof.recovery?.blockedMinutes,settlingMinutes:proof.recovery?.settlingMinutes,measurementMinutes:proof.recovery?.measurementMinutes}};
   measured={steadyPerMinute:proof.outputsPerMinute?.[product],recoveryPerMinute:proof.recovery?.outputsPerMinute?.[product],inletsPerMinute:Object.fromEntries([...(proof.inputs||[]).map(p=>[p.item,p.acceptedPerMinute]),...(proof.fluids||[]).map(p=>[p.item,p.acceptedPerMinute])])};
  }
 }catch{}
 const manifest={
  id,file:id+'.txt',name:bp.label,products:[product],targetPerMinute:target,blueprintSha256,prototypeSha256:sha(r.rawBytes),gameVersion:'2.1.24',variant,
  ports,
  inputs:ports.filter(p=>p.kind==='input').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},direction:p.direction,perMinute:p.perMinute})),
  fluids:ports.filter(p=>p.kind==='fluid').map(p=>({item:p.items[0],entity:p.entity,position:{x:p.x,y:p.y},perMinute:p.perMinute})),
  outputs:ports.filter(p=>p.kind==='output').map(p=>({item:product,entity:p.entity,position:{x:p.x,y:p.y},perMinute:target})),
  machineCounts:r.counts,footprint:r.footprint,construction:r.construction,
  recipeDerivation:r.derivation,
  loopControl:[],
  armRoles:Object.fromEntries(Object.entries(r.roles).map(([k,v])=>[k,v.map(e=>e.entity_number)])),
  setupNotes:[r.description],
  status,...(measured?{measured}:{}),...(nativeEvidence?{nativeEvidence}:{}),
 };
 await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,id+'.txt'),code+'\n');
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify([manifest],null,2)+'\n');
 return {manifest,code};
}

if(import.meta.url===`file://${process.argv[1]}`){
 const args=process.argv.slice(2),flag=(n,f)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:f;};
 const {manifest}=await generate({variant:flag('variant','one-row'),out:path.resolve(flag('out',sourceFolder))});
 console.log(JSON.stringify({id,variant:manifest.variant,footprint:manifest.footprint,area:manifest.footprint.width*manifest.footprint.height,machineCounts:manifest.machineCounts,construction:manifest.construction,inlets:manifest.ports.filter(p=>p.kind!=='power').map(p=>[p.kind,p.items[0],p.x,p.y,p.perMinute]),power:manifest.ports.find(p=>p.kind==='power'),status:manifest.status,blueprintSha256:manifest.blueprintSha256}));
}
