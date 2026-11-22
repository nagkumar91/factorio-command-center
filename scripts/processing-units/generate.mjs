// Processing-unit supplier: 27 processing units per minute from copper plates, iron plates, plastic bars and
// sulfuric acid. It makes its own copper cable, electronic circuits and advanced circuits.
//
// Layout `twin-rows` (body 27 wide, seven machine slots per row, one-tile gaps between them):
//   G   row  C E C E C E C   electronic circuits for the supply belt (top)
//   aisle 1                 copper and iron plates for G and A1
//   A1  row  C E C E C E C   each E hands circuits straight to the processing-unit machine below it;
//                            each C hands cable to G-row style E neighbours and straight down to an R
//   inner 1                 arms and the acid header (pipe-to-ground hops under the arms)
//   B1  row  R P R P R P R   R = advanced circuit, P = processing unit (facing west: acid enters from the gap)
//   channel                 arm row, processing-unit belt, supply belt (circuits | plastic), processing-unit belt, arm row
//   B2  row  R P R P R P R
//   inner 2
//   A2  row  C E C E C E C
//   aisle 2                 the same plate belt, back westward after a turn down the east column
// Each R takes cable from the C above or below it, circuits and plastic from the supply belt (long arm), and
// hands its advanced circuits sideways to its processing-unit neighbours. Each P takes circuits from its E and
// tops up from the supply belt, so the circuit supply is shared, not fixed by hand sizes.
// West strip (three columns): entrances (iron, copper, acid, plastic), the copper splitter and the riser that
// brings the G row's circuits from the top down to the supply belt. East column: the plate belt's turn down
// (copper's second branch joins it there), the acid link between the two headers, and the exit.
//
// Published variant: shared-channel (31 x 28): the layout above with a four-row channel (one processing-unit
// belt on both lanes, then the supply belt) and the acid link down the gap at x=23. twin-rows (31 x 29, the
// five-row channel above) is the version it replaced, kept in history/twin-rows-abe14cdf/.
// Pure Node and reproducible. Usage: node scripts/processing-units/generate.mjs [--variant shared-channel|twin-rows] [--out dir]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeBlueprint,decodeBlueprint} from '../blueprints.mjs';
import {familyVersions} from '../blueprint-versions.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const id='processing-units',out=flag('out',process.env.PU_OUT||'blueprint-sources/'+id),variantName=flag('variant',process.env.PU_VARIANT||'shared-channel');
assert(['twin-rows','shared-channel'].includes(variantName),'unknown variant '+variantName);
// shared-channel: the same rows as twin-rows with a four-row channel: one processing-unit belt (row 16, both
// lanes: B1 drops by fast arm, B2 by long arm over the supply belt) and the supply belt (row 17, B1 picks by long
// arm, B2 by fast arm). One row fewer; the acid link runs down the gap at x=23 instead of the east column.
const SC=variantName==='shared-channel';
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');

// ---------- target from the prototype dump ----------
// Utility science: 30 packs per minute; rocket-supplies (published) makes 5 processing units per minute.
const recipe=n=>raw.recipe[n],am2=raw['assembling-machine']['assembling-machine-2'];
const speed=am2.crafting_speed,product='processing-unit';
const amountOf=(list,n)=>list.find(i=>i.name===n)?.amount??0;
const usp=recipe('utility-science-pack');
const utilityDemand=30/amountOf(usp.results,'utility-science-pack')*amountOf(usp.ingredients,product);
const rocketSuppliesDemand=5; // blueprint-sources/rocket-supplies/manifest.json targets['processing-unit']
const perMachine=60*speed/recipe(product).energy_required*amountOf(recipe(product).results,product);
const puMachines=Math.ceil((utilityDemand+rocketSuppliesDemand)/perMachine-1e-9);
const target=puMachines*perMachine;
assert(target>=15&&target<=60,'target outside 15..60 per minute');
const derivation={utilitySciencePerMinute:30,utilitySciencePacksPerCraft:amountOf(usp.results,'utility-science-pack'),processingUnitsPerUtilityCraft:amountOf(usp.ingredients,product),utilityDemandPerMinute:utilityDemand,rocketSuppliesDemandPerMinute:rocketSuppliesDemand,sumPerMinute:utilityDemand+rocketSuppliesDemand,perAssemblingMachine2:perMachine,processingUnitMachines:puMachines,targetPerMinute:target};
// Every processing unit reaches the exit on its south lane (both belts drop on the lane that becomes it), so the
// exit tile holds 4 when nothing takes them.
const exitCap=SC?8:4;
// Blocked 30 minutes (the rate-class minimum is 5): the two processing-unit belts hold about 200 units, and the
// westmost machines (whose drop tiles fill last) still ran at full rate after 12 blocked minutes in a screen.
const protocol={warmupMinutes:15,measureMinutes:30,blockedMinutes:30,settleMinutes:5,recoveryMinutes:10};

// ---------- placement with collision checks ----------
const OX=3; // body x=0 is blueprint tile 3; the west strip is tiles 0..2 (body x -3..-1)
let next=1;const entities=[],wires=[],ports=[],occupied=new Map(),machineCounts={};
const key=(x,y)=>`${x},${y}`;
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function place(e){const p=protoOf(e.name);assert(p,e.name);let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++){assert(!occupied.has(key(x,y)),`Collision ${e.name} ${x-OX},${y} with ${occupied.get(key(x,y))?.name}`);occupied.set(key(x,y),e);}entities.push(e);return e;}
// All coordinates below are body coordinates (x from the first machine column, y from the top row).
const add=(name,x,y,extra={})=>place({entity_number:next++,name,position:{x:x+OX+.5,y:y+.5},...extra});
const at=(x,y)=>occupied.get(key(x+OX,y));
const N=0,E=4,S=8,W=12;
const filter=item=>({use_filters:true,filters:[{index:1,name:item,quality:'normal',comparator:'='}]});
// Arms: direction = the side picked from.
const fast=(x,y,d,extra={})=>add('fast-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const bulk=(x,y,d,extra={})=>add('bulk-inserter',x,y,{direction:d,override_stack_size:2,...extra});
const long=(x,y,d,extra={})=>add('long-handed-inserter',x,y,{direction:d,override_stack_size:1,...extra});
const belt=(x,y,d)=>add('fast-transport-belt',x,y,{direction:d});
const dive=(x,y,d,type)=>add('fast-underground-belt',x,y,{direction:d,type});
const pipe=(x,y)=>add('pipe',x,y);
const ptg=(x,y,d)=>add('pipe-to-ground',x,y,{direction:d}); // d: the above-ground side
const machine=(slot,top,r,extra={})=>{const m=add('assembling-machine-2',4*slot,top,{position:{x:4*slot+1.5+OX,y:top+1.5},recipe:r,...extra});machineCounts[r]=(machineCounts[r]||0)+1;return m;};

const Y=SC?{gOut:0,gArm:1,g:2,gPlate:5,aisle1:6,a1Plate:7,a1:8,in1:11,b1:12,armB1:15,xB:16,supply:17,armB2:18,b2:19,in2:22,a2:23,a2Plate:26,aisle2:27}
 :{gOut:0,gArm:1,g:2,gPlate:5,aisle1:6,a1Plate:7,a1:8,in1:11,b1:12,armB1:15,xB:16,supply:17,xC:18,armB2:19,b2:20,in2:23,a2:24,a2Plate:27,aisle2:28};
const C='copper-cable',EC='electronic-circuit',AC='advanced-circuit',P=product;
const greenRow=[C,EC,C,EC,C,EC,C],pRow=[AC,P,AC,P,AC,P,AC];
const roles={gap:[],plate:[],handoff:[],supply:[],output:[],gOut:[]};

// ---------- machines ----------
for(const top of [Y.g,Y.a1,Y.a2])greenRow.forEach((r,k)=>machine(k,top,r));
for(const top of [Y.b1,Y.b2])pRow.forEach((r,k)=>machine(k,top,r,r===P?{direction:W}:{}));
// Cable gap arms in the three circuit rows (middle machine row): bulk at the outer cable machines, fast elsewhere.
for(const top of [Y.g,Y.a1,Y.a2]){const y=top+1;roles.gap.push(bulk(3,y,W),top===Y.g?fast(7,y,E):bulk(7,y,E),fast(11,y,W),fast(15,y,E),top===Y.g?fast(19,y,W):bulk(19,y,W),bulk(23,y,E));}
// Plate arms: one filtered fast arm per machine, in the machine's middle column.
const plateOf=r=>r===C?'copper-plate':'iron-plate';
greenRow.forEach((r,k)=>{const x=4*k+1;roles.plate.push(fast(x,Y.gPlate,S,filter(plateOf(r))),fast(x,Y.a1Plate,N,filter(plateOf(r))),fast(x,Y.a2Plate,S,filter(plateOf(r))));});
// Inner rows: C -> R (cable) and E -> P (circuits), straight down (A1 -> B1) or up (A2 -> B2).
for(const [y,d] of [[Y.in1,N],[Y.in2,S]])for(let k=0;k<7;k++)roles.handoff.push(fast(4*k+1,y,d));
// Advanced circuits sideways: R -> P in every gap of the B rows. The west gap of each P carries its acid,
// so that arm sits on the row away from the inner row; the east gap's arm sits in the middle.
for(const [top,outer] of [[Y.b1,Y.b1+2],[Y.b2,Y.b2]]){
 for(const g of [3,11,19])roles.handoff.push(fast(g,outer,W));
 for(const g of [7,15,23])roles.handoff.push(fast(g,top+1,E));
}
// Channel arm rows. R: one long arm from the supply belt. P: one fast arm out onto its processing-unit belt. Only
// the middle P tops up circuits from the supply belt (two long arms): the outer E machines get enough cable for
// a full P each (bulk arms from both neighbours), the middle E gets what is left. Topping up the outer P's as well
// lets them take supply-belt circuits meant for machines further east and stalls their own E.
// R4's arm sits on its west column (the supply belt ends there).
if(!SC)for(const [y,toB,toBelt] of [[Y.armB1,N,S],[Y.armB2,S,N]]){
 for(const k of [0,2,4,6])roles.supply.push(long(k===6?24:4*k+1,y,toBelt));
 for(const k of [1,3,5])roles.output.push(fast(4*k,y,toB));
 roles.supply.push(long(13,y,toBelt),long(14,y,toBelt));
}else{
 // B1 (arm row 15): long arms reach the supply belt (row 17), fast arms drop on the processing-unit belt (row 16).
 // B2 (arm row 18): fast arms pick from the supply belt, long arms drop over it onto row 16.
 for(const k of [0,2,4,6]){const x=k===6?24:4*k+1;roles.supply.push(long(x,Y.armB1,S),fast(x,Y.armB2,N));}
 for(const k of [1,3,5])roles.output.push(fast(4*k,Y.armB1,N),long(4*k,Y.armB2,S));
 roles.supply.push(long(13,Y.armB1,S),long(14,Y.armB1,S),fast(13,Y.armB2,N),fast(14,Y.armB2,N));
}
// G row output: its three E machines drop circuits on the G belt (row 0).
for(const x of [5,13,21])roles.gOut.push(fast(x,Y.gArm,S));

// ---------- belts ----------
const entrance={};
// G belt (row 0) westward; buried under the top-left substation; turns south at strip column -1.
belt(21,0,W);dive(20,0,W,'input');dive(14,0,W,'output');belt(13,0,W);dive(12,0,W,'input');dive(6,0,W,'output');belt(5,0,W);dive(4,0,W,'input');dive(0,0,W,'output');
// Riser (strip column -1): south, buried under the plate entrances (rows 3..8) and the acid / plastic crossings.
belt(-1,0,S);belt(-1,1,S);dive(-1,2,S,'input');dive(-1,9,S,'output');dive(-1,10,S,'input');dive(-1,16,S,'output');
// Supply belt (row 17) eastward: circuits on its south lane (from the riser), plastic side-loaded onto its
// north lane at (0,17). Buried under the two channel substations. Ends at (24,17) facing an empty tile.
belt(-1,17,E);belt(0,17,E);dive(1,17,E,'input');dive(4,17,E,'output');for(let x=5;x<=16;x++)belt(x,17,E);dive(17,17,E,'input');dive(20,17,E,'output');for(let x=21;x<=24;x++)belt(x,17,E);
// Plastic: entrance (-3,15) east to (0,15), south to (0,16): side-loads the supply belt from the north.
entrance['plastic-bar']=belt(-3,15,E);belt(-2,15,E);belt(-1,15,E);belt(0,15,S);belt(0,16,S);
// Iron: entrance (-3,3), east, then south down strip column -1: side-loads the plate belt start (-1,6) from the
// north (north lane).
entrance['iron-plate']=belt(-3,3,E);belt(-2,3,E);belt(-1,3,S);belt(-1,4,S);belt(-1,5,S);
// Copper: entrance (-3,4), south into a splitter (-3..-2,5). West branch: (-3,6) south, east along row 7,
// north at (-1,7): side-loads the plate belt start from the south (south lane). East branch: down strip column
// -2 (buried under row 7 and the plastic crossing) to row 19, east along row 19 (buried under the arms) and
// side-loads the east column at (27,19): the same copper lane, after G and A1 have taken their copper. One lane
// carries at most 900 per minute, less than the 1,080 the module needs, so the copper enters it in two places.
entrance['copper-plate']=belt(-3,4,E);belt(-2,4,S);
place({entity_number:next++,name:'fast-splitter',position:{x:-2+OX,y:5.5},direction:S});
belt(-3,6,S);belt(-3,7,E);belt(-2,7,E);belt(-1,7,N);
const cu=Y.armB2; // the row the copper's east branch crosses on (an arm row with gaps the undergrounds fit)
dive(-2,6,S,'input');dive(-2,8,S,'output');for(let y=9;y<=13;y++)belt(-2,y,S);dive(-2,14,S,'input');dive(-2,16,S,'output');for(let y=17;y<cu;y++)belt(-2,y,S);belt(-2,cu,E);belt(-1,cu,E);
for(const [i,o] of [[0,2],[3,7],[8,10],[11,15],[16,18],[19,25]]){dive(i,cu,E,'input');dive(o,cu,E,'output');}belt(26,cu,E);
for(let x=-1;x<=26;x++)belt(x,Y.aisle1,E);
// East column: down from aisle 1 to aisle 2, buried except at the copper side-load (27,19); passes under the
// exit (27,16) and the acid link (rows 11..12, 22..23).
if(!SC){belt(27,6,S);dive(27,7,S,'input');dive(27,13,S,'output');dive(27,14,S,'input');dive(27,18,S,'output');belt(27,19,S);dive(27,20,S,'input');dive(27,24,S,'output');for(let y=25;y<=27;y++)belt(27,y,S);}
else{belt(27,6,S);dive(27,7,S,'input');dive(27,13,S,'output');dive(27,14,S,'input');dive(27,17,S,'output');belt(27,18,S);dive(27,19,S,'input');dive(27,25,S,'output');belt(27,26,S);}
// Aisle 2 (row 28) westward; buried under the two bottom substations; ends at the underground exit (1,28).
{const a=Y.aisle2;belt(27,a,W);for(let x=26;x>=21;x--)belt(x,a,W);dive(20,a,W,'input');dive(17,a,W,'output');for(let x=16;x>=5;x--)belt(x,a,W);dive(4,a,W,'input');dive(1,a,W,'output');}
// Processing-unit belts: B1 drops on row 16, B2 on row 18; row 18 turns north at (26,18) and side-loads (26,16);
// the exit (27,16) is a straight tile fed from behind.
let exitBelt;
for(const y of SC?[Y.xB]:[Y.xB,Y.xC]){belt(4,y,E);dive(5,y,E,'input');dive(11,y,E,'output');belt(12,y,E);dive(13,y,E,'input');dive(20,y,E,'output');for(let x=21;x<=25;x++)belt(x,y,E);}
belt(26,Y.xB,E);exitBelt=belt(27,Y.xB,E);if(!SC){belt(26,Y.xC,N);belt(26,Y.supply,N);}
assert(!at(25,Y.supply),'the supply belt must end before the processing-unit merge');

// ---------- sulfuric acid ----------
// Entrance: a pipe-to-ground at (-3,11) (the copper branch crosses above its underground run) to (-1,11).
// Header on inner row 1 (row 11), hopping under the arms with pipe-to-ground pairs, a drop down each P's west gap;
// at the east end a pipe-to-ground pair down column 27 (under the plate belt) to inner row 2 (row 23), whose
// header runs back west.
const acidEntrance=ptg(-3,Y.in1,W);ptg(-1,Y.in1,E);
const lastGap=SC?23:27;
const header=(y,from)=>{for(const g of [3,7,11,15,19,23,27].filter(g=>g<=lastGap)){pipe(g,y);if(g<lastGap&&g>=from){ptg(g+1,y,W);ptg(g+3,y,E);}}};
ptg(0,Y.in1,W);ptg(2,Y.in1,E);header(Y.in1,3);header(Y.in2,3);
if(!SC){ptg(27,Y.in1+1,N);ptg(27,Y.in2-1,S);}else{ptg(23,Y.b1,N);ptg(23,Y.b2+2,S);}
for(const g of [3,11,19]){pipe(g,Y.b1);pipe(g,Y.b1+1);pipe(g,Y.b2+1);pipe(g,Y.b2+2);}

// ---------- recipe audit from the raw dump ----------
const boundary=new Set(['iron-plate','copper-plate','plastic-bar','sulfuric-acid']);
const required={},crafts={};
function expand(item,n){if(boundary.has(item)){required[item]=(required[item]||0)+n;return;}const r=recipe(item);assert(r,item);const made=amountOf(r.results,item);crafts[item]=(crafts[item]||0)+n/made;for(const i of r.ingredients)expand(i.name,n*i.amount/made);}
expand(product,target);
const machinesExact=Object.fromEntries(Object.entries(crafts).map(([n,c])=>[n,c/(60*speed/(recipe(n).energy_required??.5))]));
for(const [n,c] of Object.entries(machinesExact))assert(machineCounts[n]>=c-1e-9,`${n} needs ${c} machines, built ${machineCounts[n]}`);

// ---------- ports and labels ----------
const port=(kind,item,e,extra)=>{const p={kind,label:item,items:[item],item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},...extra};ports.push(p);return p;};
const fmt=n=>String(Math.round(n*10)/10);
const inputPorts=['copper-plate','iron-plate','plastic-bar'].map(item=>port('input',item,entrance[item],{externalSide:'west',direction:4,perMinute:required[item]}));
const fluidPort=port('fluid','sulfuric-acid',acidEntrance,{externalSide:'west',nominalPerMinute:required['sulfuric-acid'],perMinute:required['sulfuric-acid']});
const outputPort=port('output',product,exitBelt,{externalSide:'east',direction:4,transport:'belt',cap:exitCap});
const labelSpots={'copper-plate':[-3,8],'iron-plate':[-3,2],'sulfuric-acid':[-3,10],'plastic-bar':[-3,14]};
for(const p of [...inputPorts,fluidPort]){const [x,y]=labelSpots[p.item];const e=add('display-panel',x,y,{icon:{type:p.kind==='fluid'?'fluid':'item',name:p.item},text:`IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min at nominal target`,always_show:true});p.displayEntity=e.entity_number;}

// ---------- power: six substations in holes left by buried belts ----------
const footprint=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
const subs=[[8,0],[24,0],[2,16],[18,16],[2,Y.aisle2-1],[18,Y.aisle2-1]].map(([x,y])=>place({entity_number:next++,name:'substation',position:{x:x+OX+1,y:y+1}}));
for(const [a,b] of [[0,1],[0,2],[1,3],[2,3],[2,4],[3,5]])wires.push([subs[a].entity_number,5,subs[b].entity_number,5]);
ports.push({kind:'power',label:'External electricity',items:[],entity:subs[2].entity_number,x:subs[2].position.x,y:subs[2].position.y,position:{...subs[2].position}});
assert.deepEqual(starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}}),footprint,'power must not grow the rectangle');
for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number};

// ---------- blueprint ----------
const description=`Official 2.1.24 Space Age; ${Object.values(machineCounts).reduce((a,b)=>a+b,0)} assembling machine 2 (${machineCounts[C]} copper cable, ${machineCounts[EC]} electronic circuit, ${machineCounts[AC]} advanced circuit, ${machineCounts[P]} processing unit), no modules, red belts, fast, long-handed and bulk inserters, six substations. WEST: copper plates ${fmt(required['copper-plate'])}/min, iron plates ${fmt(required['iron-plate'])}/min, sulfuric acid ${fmt(required['sulfuric-acid'])}/min (pipe), plastic bars ${fmt(required['plastic-bar'])}/min; each belt may carry its item on both lanes. EAST: one red belt exit, ${fmt(target)} processing units/min. Cable, circuits and advanced circuits are handed machine to machine; extra circuits and plastic reach the advanced-circuit and processing-unit machines on the supply belt in the middle channel. Keep the plate filters, the underground belt and pipe-to-ground pairs and the processing-unit machines facing west (acid enters from the west gap). Supply electricity at any substation.`;
const bp={item:'blueprint',version:562954249961472,label:`Processing-unit supplier · ${fmt(target)}/min`,description,entities,wires,icons:[{index:1,signal:{type:'item',name:product}}]};
// Keep the committed string when it decodes to exactly this blueprint (another zlib build may compress the same
// JSON differently), so its SHA-256 and native report stay valid everywhere.
const committed=await fs.readFile(`blueprint-sources/${id}/${id}.txt`,'utf8').then(t=>t.trim(),()=>null);
const sameBlueprint=t=>{try{return JSON.stringify(decodeBlueprint(t))===JSON.stringify({blueprint:bp});}catch{return false;}};
const code=committed&&sameBlueprint(committed)?committed:encodeBlueprint({blueprint:bp});
let status='unverified',measured;
try{const report=JSON.parse(await fs.readFile(out+'/native-report.json','utf8'));const r=report.builds?.find(b=>b.blueprintSha256===sha(code));
 if(r&&!report.short){status=r.passed&&report.passed?'qualified':'not-qualified';const m=report.protocolMinutes.measureMinutes;
  measured={steadyPerMinute:r.outputsPerMinute[product],recoveryPerMinute:r.recovery?.outputsPerMinute?.[product],blockedExitStock:r.blocked?.collectionPauseStock?.[0]?.count,consumptionPerMinute:{...r.consumptionPerMinute,'sulfuric-acid':r.fluids?.[0]?.acceptedDuringMeasurement/m},reportCreatedAt:report.createdAt};}}catch{}
// Tested versions, newest first (scripts/blueprint-versions.mjs): the published shared-channel string and the
// twin-rows string it replaced, kept complete in history/ with its own passing report. Only when this folder holds both.
const olderDir='history/twin-rows-abe14cdf',hasOlder=await fs.access(`${out}/${olderDir}/manifest.json`).then(()=>true,()=>false);
const versions=status==='qualified'&&variantName==='shared-channel'&&hasOlder?await familyVersions(out,[
 {label:'Shared channel',summary:'Smaller and its exit holds eight: one processing-unit belt carries both rows, so the channel between the rows is four rows high.',file:id+'.txt',width:footprint.width,height:footprint.height,report:'native-report.json'},
 {label:'Twin rows',summary:'The earlier layout, replaced for size and for its exit: a processing-unit belt for each row, a five-row channel, and an exit that holds four.',file:olderDir+'/'+id+'.txt',manifest:olderDir+'/manifest.json',report:olderDir+'/native-report.json'}]):undefined;
const construction=Object.fromEntries([...new Set(entities.map(e=>e.name))].sort().map(n=>[n,entities.filter(e=>e.name===n).length]));
const manifest={
 id,name:bp.label,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'rate',status,...(measured?{measured}:{}),
 variant:variantName,targetDerivation:derivation,
 products:[product],targets:{[product]:target},outputCaps:{[product]:exitCap},
 recipeAudit:{externalPerMinute:required,craftsPerMinute:crafts,machinesExact,recipeIngredients:Object.fromEntries(Object.keys(crafts).map(n=>[n,recipe(n).ingredients]))},
 inputs:ports.filter(p=>p.kind==='input'),fluids:ports.filter(p=>p.kind==='fluid'),outputs:ports.filter(p=>p.kind==='output'),ports,
 machineCounts,footprint,
 loopControl:[],stockControl:{mode:'belt-exit',exit:exitBelt.entity_number,cap:exitCap},
 armRoles:Object.fromEntries(Object.entries(roles).map(([k,v])=>[k,v.map(e=>e.entity_number)])),
 protocol,construction,
 setupNotes:[description,`Belt the exit east to the processing-unit entrance of the consumer. The exit holds ${exitCap} processing units when nothing takes them, and every machine then stops.`,'Feed plates, plastic and acid at or above the listed rates; extra simply backs up at the entrances.'],
 ...(versions?{versions}:{}),
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/'+id+'.txt',code+'\n');
await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({id,variant:variantName,out,footprint,area:footprint.width*footprint.height,machineCounts,required,target,construction,blueprintSha256:manifest.blueprintSha256}));
