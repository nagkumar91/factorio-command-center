// Small production-science (purple pack) module: two assembling machine 2 make production science packs from six
// supplied materials (steel plate, stone brick, stone, iron plate, electronic circuits, advanced circuits) and send
// them east on one red belt. It makes its own electric furnaces, productivity modules, rails and iron sticks, and
// every one of them is handed machine to machine: nothing but the six inputs and the packs ever rides a belt.
//
// Layout (body x from 0, west strip at x -2..-1; 14 x 18):
//   row 0   adv|elec belt (advanced circuits north lane, electronic circuits south lane), east
//   row 1   steel|brick belt, coming back west from the east column (ends at x=4)
//   row 2   arms: long into the module makers from row 0; fast (steel, brick) and long (advanced) into the furnace maker
//   rows 3-5   module maker M1 (x0..2) · furnace maker F (x4..6) · module maker M2 (x8..10)
//   row 6   science packs, east, exit at the east edge (11,6)
//   row 7   long arms hand modules and furnaces down; fast arms put the packs on row 6
//   rows 8-10  science S1 (x2..4) · science S2 (x6..8): each overlaps one column of M1 / F / M2 above and of R below
//   row 11  fast arms: rails from R into S1 and S2
//   rows 12-14 rail maker R (x4..6) · iron-stick maker K (x8..10, hands sticks west into R)
//   row 15  arms: stone (fast) and steel (long) into R, iron (fast) into K
//   row 16  stone|iron belt, east
//   row 17  steel|brick belt, east, then north up the east column (under the exit) and back west on row 1
// Each shared belt is made in the west strip by side-loading two entrance belts, one per lane.
// Pure Node and reproducible. Usage: node scripts/production-science-small/generate.mjs [--out dir]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const id='production-science-small',out=flag('out',process.env.PS_OUT||'blueprint-sources/'+id);
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');

// ---------- target from the prototype dump ----------
// The size is fixed by the request: two science machines. The target is what they make at full speed.
const recipe=n=>raw.recipe[n],am2=raw['assembling-machine']['assembling-machine-2'];
const speed=am2.crafting_speed,product='production-science-pack',scienceMachines=2;
const amountOf=(list,n)=>list.find(i=>i.name===n)?.amount??0;
const energy=n=>recipe(n).energy_required??.5;
const perMachine=60*speed/energy(product)*amountOf(recipe(product).results,product);
const target=scienceMachines*perMachine;
const derivation={scienceMachines,recipeSeconds:energy(product),assemblingMachine2Speed:speed,packsPerCraft:amountOf(recipe(product).results,product),perAssemblingMachine2:perMachine,targetPerMinute:target};
const exitCap=4; // both science machines drop on the north lane of the exit belt: one lane of one tile holds 4
const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:30,settleMinutes:5,recoveryMinutes:10};

// ---------- placement with collision checks ----------
const OX=2; // body x=0 is blueprint tile 2; the west strip is tiles 0..1 (body x -2..-1)
let next=1;const entities=[],ports=[],occupied=new Map(),machineCounts={};
const key=(x,y)=>`${x},${y}`;
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function place(e){const p=protoOf(e.name);assert(p,e.name);let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x-OX},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}entities.push(e);return e;}
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+OX+.5,y:y+.5},...extra});
const N=0,E=4,S=8,W=12;
// Arms: direction = the side picked from.
const fast=(x,y,d)=>add('fast-inserter',x,y,{direction:d,override_stack_size:1});
const long=(x,y,d)=>add('long-handed-inserter',x,y,{direction:d,override_stack_size:1});
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
const dive=(x,y,d,type)=>add('fast-underground-belt',x,y,{direction:d,type});
// A machine by its top-left body tile.
const machine=(x,y,r)=>{const m=add('assembling-machine-2',x,y,{position:{x:x+1.5+OX,y:y+1.5},recipe:r});machineCounts[r]=(machineCounts[r]||0)+1;return m;};

// ---------- machines ----------
const SP=product,FU='electric-furnace',PM='productivity-module',RA='rail',ST='iron-stick';
machine(0,3,PM);machine(4,3,FU);machine(8,3,PM);
machine(2,8,SP);machine(6,8,SP);
machine(4,12,RA);machine(8,12,ST);
const roles={supply:[],handoff:[],output:[]};

// ---------- arms ----------
// Row 2: module makers take advanced and electronic circuits from row 0 (long); the furnace maker takes steel and
// brick from row 1 (two fast arms) and advanced circuits from row 0 (long).
roles.supply.push(long(1,2,N),fast(4,2,N),long(5,2,N),fast(6,2,N),long(9,2,N));
// Row 7: long arms hand modules (M1 -> S1, M2 -> S2) and furnaces (F -> S1, F -> S2) over the pack belt; fast arms
// put the packs on it.
roles.handoff.push(long(2,7,N),long(4,7,N),long(6,7,N),long(8,7,N));
roles.output.push(fast(3,7,S),fast(7,7,S));
// Row 11: rails into both science machines. Row 13: sticks into the rail maker.
roles.handoff.push(fast(4,11,S),fast(6,11,S),fast(7,13,E));
// Row 15: steel (long, row 17) and stone (fast, row 16) into the rail maker; iron (fast, row 16) into the stick maker.
roles.supply.push(long(4,15,S),fast(5,15,S),long(6,15,S),fast(9,15,S));

// ---------- belts ----------
const entrance={};
// Circuits: advanced enters (-2,0), electronic (-2,2); they side-load (-1,1) from north and south, which turns
// north at (0,1) and east at (0,0) along row 0.
entrance['advanced-circuit']=belt(-2,0,E);belt(-1,0,S);
entrance['electronic-circuit']=belt(-2,2,E);belt(-1,2,N);
belt(-1,1,E);belt(0,1,N);for(let x=0;x<=9;x++)belt(x,0,E);
// Stone and iron: stone enters (-2,11), iron (-2,13); they side-load (0,12), which turns south down column 1 and
// east along row 16.
entrance['stone']=belt(-2,11,E);belt(-1,11,E);belt(0,11,S);
entrance['iron-plate']=belt(-2,13,E);belt(-1,13,E);belt(0,13,N);
belt(0,12,E);for(let y=12;y<=15;y++)belt(1,y,S);for(let x=1;x<=9;x++)belt(x,16,E);
// Steel and brick: steel enters (-2,15), brick (-2,17); they side-load (-1,16), which turns south at (0,16) and
// east along row 17, north up column 11 (buried under the exit) and west along row 1 to the furnace maker.
entrance['steel-plate']=belt(-2,15,E);belt(-1,15,S);
entrance['stone-brick']=belt(-2,17,E);belt(-1,17,N);
belt(-1,16,E);belt(0,16,S);for(let x=0;x<=10;x++)belt(x,17,E);
for(let y=17;y>=8;y--)belt(11,y,N);dive(11,7,N,'input');dive(11,5,N,'output');for(let y=4;y>=2;y--)belt(11,y,N);
for(let x=11;x>=4;x--)belt(x,1,W);
// Packs: row 6 from the first drop tile to the exit on the east edge.
let exitBelt;for(let x=3;x<=11;x++)exitBelt=belt(x,6,E);

// ---------- recipe audit from the raw dump ----------
const boundary=new Set(['steel-plate','stone-brick','stone','iron-plate','electronic-circuit','advanced-circuit']);
const required={},crafts={};
function expand(item,n){if(boundary.has(item)){required[item]=(required[item]||0)+n;return;}const r=recipe(item);assert(r,item);const made=amountOf(r.results,item);crafts[item]=(crafts[item]||0)+n/made;for(const i of r.ingredients){assert.equal(i.type,'item','no fluids');expand(i.name,n*i.amount/made);}}
expand(product,target);
const machinesExact=Object.fromEntries(Object.entries(crafts).map(([n,c])=>[n,c/(60*speed/energy(n))]));
// The smallest whole number of machines for each recipe, and exactly that many built.
for(const [n,c] of Object.entries(machinesExact))assert.equal(machineCounts[n],Math.ceil(c-1e-9),`${n} needs ${c} machines, built ${machineCounts[n]}`);
assert.deepEqual(Object.keys(machineCounts).sort(),Object.keys(crafts).sort());

// ---------- ports and labels ----------
const port=(kind,item,e,extra)=>{const p={kind,label:item,items:[item],item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},...extra};ports.push(p);return p;};
const fmt=n=>String(Math.round(n*10)/10);
const order=['steel-plate','stone-brick','stone','iron-plate','electronic-circuit','advanced-circuit'];
const lane={'advanced-circuit':'north lane of row 0','electronic-circuit':'south lane of row 0','stone':'north lane of row 16','iron-plate':'south lane of row 16','steel-plate':'north lane of row 17','stone-brick':'south lane of row 17'};
const inputPorts=order.map(item=>port('input',item,entrance[item],{externalSide:'west',direction:4,perMinute:required[item],sharedBelt:lane[item]}));
const outputPort=port('output',product,exitBelt,{externalSide:'east',direction:4,transport:'belt',cap:exitCap});
const labelSpots={'advanced-circuit':[-2,1],'electronic-circuit':[-2,3],'stone':[-2,10],'iron-plate':[-2,12],'steel-plate':[-2,14],'stone-brick':[-2,16]};
for(const p of inputPorts){const [x,y]=labelSpots[p.item];const e=add('display-panel',x,y,{icon:{type:'item',name:p.item},text:`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min at nominal target`,always_show:true});p.displayEntity=e.entity_number;}

// ---------- power: one substation reaches every machine and arm ----------
const footprint=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
const sub=place({entity_number:next++,name:'substation',position:{x:0+OX+1,y:8+1}});
ports.push({kind:'power',label:'External electricity',items:[],entity:sub.entity_number,x:sub.position.x,y:sub.position.y,position:{...sub.position}});
assert.deepEqual(starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}}),footprint,'power must not grow the rectangle');
{const reach=raw['electric-pole'].substation.supply_area_distance;for(const e of entities.filter(e=>/assembling|inserter/.test(e.name))){const half=e.name==='assembling-machine-2'?1.5:.5;assert(Math.abs(e.position.x-sub.position.x)<reach+half&&Math.abs(e.position.y-sub.position.y)<reach+half,'outside the substation: '+e.name+' '+e.position.x+','+e.position.y);}}
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

// ---------- blueprint ----------
const description=`Official 2.1.24 Space Age; ${Object.values(machineCounts).reduce((a,b)=>a+b,0)} assembling machine 2 (${machineCounts[SP]} production science pack, ${machineCounts[PM]} productivity module, ${machineCounts[FU]} electric furnace, ${machineCounts[RA]} rail, ${machineCounts[ST]} iron stick), no modules, red belts, fast and long-handed inserters, one substation. WEST: steel plates ${fmt(required['steel-plate'])}/min, stone bricks ${fmt(required['stone-brick'])}/min, stone ${fmt(required.stone)}/min, iron plates ${fmt(required['iron-plate'])}/min, electronic circuits ${fmt(required['electronic-circuit'])}/min, advanced circuits ${fmt(required['advanced-circuit'])}/min, each on its own entrance belt (both lanes allowed); inside, every two share one belt, one per lane. EAST: one red belt exit, ${fmt(target)} production science packs/min. Furnaces, modules and rails are handed straight into the science machines, sticks straight into the rail maker. Keep the underground pair under the exit. Supply electricity at the substation.`;
const bp={item:'blueprint',version:562954249961472,label:`Production science, small · ${fmt(target)}/min`,description,entities,icons:[{index:1,signal:{type:'item',name:product}}]};
// Keep the committed string when it decodes to exactly this blueprint (another zlib build may compress the same
// JSON differently), so its SHA-256 and native report stay valid everywhere.
const committed=await fs.readFile(`blueprint-sources/${id}/${id}.txt`,'utf8').then(t=>t.trim(),()=>null);
const sameBlueprint=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
const code=committed&&sameBlueprint(committed)?committed:encodeBlueprint({blueprint:bp});
let status='unverified',measured;
try{const report=JSON.parse(await fs.readFile(out+'/native-report.json','utf8'));const r=report.builds?.find(b=>b.blueprintSha256===sha(code));
 if(r&&!report.short){status=r.passed&&report.passed?'qualified':'not-qualified';
  measured={steadyPerMinute:r.outputsPerMinute[product],recoveryPerMinute:r.recovery?.outputsPerMinute?.[product],blockedExitStock:r.blocked?.collectionPauseStock?.[0]?.count,consumptionPerMinute:r.consumptionPerMinute,reportCreatedAt:report.createdAt};
  // The 80% feed run (exploration mode, kept beside the report) is quoted on the guide page.
  const underReport=JSON.parse(await fs.readFile(out+'/underfed-report.json','utf8').catch(()=>'null')),under=underReport?.builds?.find(b=>b.blueprintSha256===sha(code));
  if(under)measured.underfed={feedScale:underReport.feedScale,steadyPerMinute:under.outputsPerMinute,recoveryPerMinute:under.recovery?.outputsPerMinute,consumptionPerMinute:under.consumptionPerMinute};}}catch{}
const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length]));
const manifest={
 id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'rate',status,...(measured?{measured}:{}),
 targetDerivation:derivation,
 products:[product],targets:{[product]:target},outputCaps:{[product]:exitCap},
 recipeAudit:{externalPerMinute:required,craftsPerMinute:crafts,machinesExact,recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,recipe(n).ingredients]))},
 inputs:ports.filter(p=>p.kind==='input'),fluids:[],outputs:ports.filter(p=>p.kind==='output'),ports,
 machineCounts,footprint,
 loopControl:[],stockControl:{mode:'belt-exit',exit:exitBelt.entity_number,cap:exitCap},
 armRoles:Object.fromEntries(Object.entries(roles).map(([k,v])=>[k,v.map(e=>e.entity_number)])),
 circuitSuppliers:{'electronic-circuit':'green-circuits','advanced-circuit':'advanced-circuits'},
 protocol,construction,
 setupNotes:[description,`Belt the exit east to the labs. The exit holds ${exitCap} packs when nothing takes them, and every machine then stops.`,'Feed every entrance at or above its panel figure; extra simply backs up at the entrances. The circuits can come from the green-circuit and advanced-circuit suppliers.'],
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/'+id+'.txt',code+'\n');
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,out,footprint,area:footprint.width*footprint.height,machineCounts,required,target,construction,entities:entities.length,status,blueprintSha256:manifest.blueprintSha256}));
