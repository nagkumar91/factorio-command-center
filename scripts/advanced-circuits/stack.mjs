// Compaction screen (2026-11-22), not published: two halves of advanced-circuits stacked back to back so that their
// bottom rows share one outer row (row 13): its west part is the copper belt of both halves' bottom cable machines,
// its east part one collector that both bottom rows drop on (north half from above, south half from below) and that
// ends at the exit (last,13). The south half is the north layout mirrored about row 13 (rows 13..26). Each half's top
// collector climbs to the exit along the last column and side-loads it (north from above, south from below).
// Usage: node scripts/advanced-circuits/stack.mjs --north stack-half-north --south stack-half-south --out <dir>
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {powerWithinLayout} from './power.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
const RAW=process.env.FACTORIO_RAW||'/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';

const args=process.argv.slice(2),flag=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const out=flag('out','.cache/advanced-circuits/cand-stack'),cap=Number(flag('cap',8));
const bytes=await fs.readFile(RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
const half=async v=>{const f='.cache/advanced-circuits/'+v+'.json';await promisify(execFile)(process.execPath,['scripts/advanced-circuits/generate.mjs','--variant',v,'--module-out',f]);return JSON.parse(await fs.readFile(f));};
const north=await half(flag('north','stack-half-north')),south=await half(flag('south','stack-half-south'));
assert.equal(north.width,south.width);
const flip=d=>({0:8,8:0}[d??0]??d);
// Mirror about row 13: a tile at row r goes to 26 - r, so a centre y goes to 27 - y.
const mirror=e=>({...e,position:{x:e.position.x,y:27-e.position.y},...(e.direction!==undefined||/inserter|belt/.test(e.name)?{direction:flip(e.direction)}:{})});
const rowOf=e=>Math.floor(e.position.y);
const shared=e=>!/assembling|inserter/.test(e.name)&&rowOf(e)===13;
const sig=e=>[e.name,e.position.x,e.position.y,e.direction??0,e.type??''].join(' ');
const northShared=north.entities.filter(shared).map(sig).sort(),southShared=south.entities.filter(shared).map(mirror).map(sig).sort();
assert.deepEqual(southShared,northShared,'both halves must build the same shared row');
let next=1;const entities=[],renum=new Map();
for(const [h,tag,map] of [[north,'n',e=>e],[south,'s',mirror]])for(const e0 of h.entities){
 if(tag==='s'&&shared(e0))continue;
 const e={...map(e0),entity_number:next++};delete e.tags;renum.set(tag+e0.entity_number,e.entity_number);entities.push(e);
}
const id=k=>renum.get(k);
// Ports: north entrances as published (rows 1, 2, 5), the shared copper entrance (0,13), south entrances mirrored
// (rows 25, 24, 21). Panels next to each.
const ports=[],fmt=n=>String(Math.round(n*10)/10);
const byId=new Map(entities.map(e=>[e.entity_number,e]));
const port=(kind,item,eid,extra)=>{const e=byId.get(eid);const p={kind,label:item,items:[item],item,entity:eid,x:e.position.x,y:e.position.y,position:{...e.position},...extra};ports.push(p);return p;};
const specs=[[id('n'+north.entrances['copper-plate:upper']),'copper-plate',north.upperCopper,[0,0]],[id('n'+north.entrances['iron-plate']),'iron-plate',north.required['iron-plate'],[0,3]],[id('n'+north.entrances['plastic-bar']),'plastic-bar',north.required['plastic-bar'],[0,4]],
 [id('n'+north.entrances['copper-plate:lower']),'copper-plate',north.lowerCopper+south.lowerCopper,[0,12]],
 [id('s'+south.entrances['plastic-bar']),'plastic-bar',south.required['plastic-bar'],[0,22]],[id('s'+south.entrances['iron-plate']),'iron-plate',south.required['iron-plate'],[0,23]],[id('s'+south.entrances['copper-plate:upper']),'copper-plate',south.upperCopper,[0,26]]];
const occupied=new Set();for(const e of entities){if(e.name==='assembling-machine-2'){for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)occupied.add((Math.floor(e.position.x)+dx)+','+(Math.floor(e.position.y)+dy));}else occupied.add(Math.floor(e.position.x)+','+Math.floor(e.position.y));}
for(const [eid,item,perMinute,[x,y]] of specs){
 const p=port('input',item,eid,{externalSide:'west',direction:4,perMinute});assert(!occupied.has(x+','+y),'panel spot taken '+x+','+y);
 const e={entity_number:next++,name:'display-panel',position:{x:x+.5,y:y+.5},icon:{type:'item',name:item},text:`IN: ${item}\nWEST · ${fmt(perMinute)}/min at nominal target`,always_show:true};entities.push(e);p.displayEntity=e.entity_number;
}
const exitId=id('n'+north.exit);port('output','advanced-circuit',exitId,{externalSide:'east',direction:4,transport:'belt',cap});
ports.push({kind:'power',label:'External electricity',items:[]});
const occ=new Map();
const protoOf=name=>Object.values(raw).map(g=>g?.[name]).find(p=>p?.selection_box);
function place(e){const p=protoOf(e.name);let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);if(e.name==='display-panel')w=h=1;if([4,12].includes(e.direction))[w,h]=[h,w];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++){assert(!occ.has(x+','+y),'collision '+e.name+' '+x+','+y);occ.set(x+','+y,e);}if(!entities.includes(e))entities.push(e);return e;}
for(const e of entities)place(e);
const wires=[];
const before=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
const power=powerWithinLayout({entities,wires,next,place},ports,raw,{within:before});
const footprint=starterBounds(entities,{...raw,container:{...raw.container,...raw['logistic-container']}});
assert.deepEqual(footprint,before);assert.equal(power.mediumPoles,0);
for(const e of entities)e.tags={flight_science_entity:e.entity_number};
const machineCounts={};for(const e of entities)if(e.recipe)machineCounts[e.recipe]=(machineCounts[e.recipe]||0)+1;
const target=north.target+south.target;
const bp={item:'blueprint',version:562954249961472,label:`Advanced-circuit supplier stack screen · ${fmt(target)}/min`,description:'Compaction screen, not published.',entities,wires,icons:[{index:1,signal:{type:'item',name:'advanced-circuit'}}]};
const code=encodeBlueprint({blueprint:bp});
const manifest={id:'advanced-circuits',name:bp.label,file:'advanced-circuits.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),class:'rate',status:'unverified',variant:'stack '+north.variant+' + '+south.variant,
 products:['advanced-circuit'],targets:{'advanced-circuit':target},outputCaps:{'advanced-circuit':cap},inputs:ports.filter(p=>p.kind==='input'),fluids:[],outputs:ports.filter(p=>p.kind==='output'),ports,machineCounts,footprint,tiles:footprint.width*footprint.height,
 loopControl:[],stockControl:{mode:'belt-exit',exit:exitId,cap},protocol:{warmupMinutes:15,measureMinutes:30,blockedMinutes:10,settleMinutes:5,recoveryMinutes:10},substations:power.substations};
await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/advanced-circuits.txt',code+'\n');await fs.writeFile(out+'/manifest.json',JSON.stringify([manifest],null,2)+'\n');
console.log(JSON.stringify({out,footprint,tiles:manifest.tiles,machineCounts,target,substations:power.substations,inputs:manifest.inputs.map(p=>[p.item,p.y,p.perMinute])}));
