import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {powerFiveLayout} from '../scripts/five-science/power.mjs';

const prototype=(name,size,extra={})=>({name,selection_box:[[-size/2,-size/2],[size/2,size/2]],collision_box:[[-size/2+.15,-size/2+.15],[size/2-.15,size/2-.15]],...extra});
const raw={
 'electric-pole':{substation:prototype('substation',2,{supply_area_distance:9,maximum_wire_distance:18}),
 'medium-electric-pole':prototype('medium-electric-pole',1,{supply_area_distance:3.5,maximum_wire_distance:9})},
 machine:{machine:prototype('machine',3,{energy_source:{type:'electric'}}),arm:prototype('arm',1,{energy_source:{type:'electric'}}),wall:prototype('wall',1)},
};
// Models the parent's substation-capable place() and routing grid contract.
class Layout {
 constructor(prototypes=raw){this.prototypes=new Map(Object.values(prototypes).flatMap(g=>Object.values(g)).filter(p=>p?.name&&p.selection_box).map(p=>[p.name,p]));this.raw=prototypes;this.entities=[];this.wires=[];this.grid=new Map();this.next=1;}
 place(e){
  const p=this.prototypes.get(e.name);
  let w=Math.ceil(p.selection_box[1][0]-p.selection_box[0][0]),h=Math.ceil(p.selection_box[1][1]-p.selection_box[0][1]);
  if(e.name==='display-panel')w=h=1;
  if([4,12].includes(e.direction))[w,h]=[h,w];
  for(let x=e.position.x-w/2;x<e.position.x+w/2;x++)for(let y=e.position.y-h/2;y<e.position.y+h/2;y++){
   assert(Number.isInteger(x)&&Number.isInteger(y));assert(!this.grid.has(`${x},${y}`));this.grid.set(`${x},${y}`,e);
  }
  this.entities.push(e);this.next=Math.max(this.next,e.entity_number+1);
 }
 add(name,x,y,extra={}){const e={entity_number:this.next++,name,position:{x,y},...extra};this.place(e);return e;}
}
function verify(l,ports,before,result){
 assert.deepEqual(l.entities.filter(e=>!e.tags?.five_science_power),before.entities);
 assert.deepEqual(l.wires.filter(w=>w[1]!==5),before.wires);
 const poles=l.entities.filter(e=>e.tags?.five_science_power),by=new Map(poles.map(e=>[e.entity_number,e]));
 const prototypes=new Map(Object.values(l.raw).flatMap(g=>Object.values(g)).filter(p=>p?.name&&p.selection_box).map(p=>[p.name,p]));
 const proto=n=>prototypes.get(n);
 const graph=new Map(poles.map(p=>[p.entity_number,[]]));
 for(const[a,ac,b,bc]of l.wires.filter(w=>w[1]===5)){
  assert.equal(ac,5);assert.equal(bc,5);assert(by.has(a)&&by.has(b));
  assert(Math.hypot(by.get(a).position.x-by.get(b).position.x,by.get(a).position.y-by.get(b).position.y)<=Math.min(proto(by.get(a).name).maximum_wire_distance,proto(by.get(b).name).maximum_wire_distance)+1e-6);
  graph.get(a).push(b);graph.get(b).push(a);
 }
 const dock=ports.find(p=>p.kind==='power');assert(by.has(dock.entity));assert.equal(by.get(dock.entity).name,'substation');assert.deepEqual({x:dock.x,y:dock.y},by.get(dock.entity).position);
 assert.equal(poles.filter(p=>p.tags.five_science_power_dock).length,1);
 const seen=new Set([dock.entity]),q=[dock.entity];for(const a of q)for(const b of graph.get(a))if(!seen.has(b)){seen.add(b);q.push(b);}
 assert.equal(seen.size,poles.length);for(const ns of graph.values())assert(ns.length<=5);
 for(const e of before.entities.filter(e=>proto(e.name).energy_source?.type==='electric')){
  let [w,h]=[0,1].map(i=>(proto(e.name).collision_box[1][i]-proto(e.name).collision_box[0][i])/2);
  if([4,12].includes(e.direction))[w,h]=[h,w];
  assert(poles.some(p=>Math.abs(p.position.x-e.position.x)<proto(p.name).supply_area_distance+w-.001&&Math.abs(p.position.y-e.position.y)<proto(p.name).supply_area_distance+h-.001),`uncovered ${e.entity_number}`);
 }
 assert.equal(result.totalPoles,poles.length);assert.equal(result.copperWires,poles.length-1);
}
const saved=l=>structuredClone({entities:l.entities,wires:l.wires});
test('greedy substations cover collision-box edges and preserve structures and red wires',()=>{
 const l=new Layout();l.add('machine',1.5,1.5);l.add('machine',20.5,1.5);l.wires.push([1,1,2,1]);
 const ports=[{kind:'power',x:10,y:2}],before=saved(l),r=powerFiveLayout(l,ports,raw);
 verify(l,ports,before,r);assert.equal(r.substations,1);assert.equal(r.mediumPoles,0);
});
test('three exterior tiles remain clear on all four sides',()=>{
 const l=new Layout();l.add('machine',10.5,10.5);
 const ports=[['west',0.5,10.5],['east',20.5,10.5],['north',10.5,.5],['south',10.5,20.5]].map(([externalSide,x,y])=>({kind:'input',externalSide,x,y}));
 const before=saved(l),r=powerFiveLayout(l,ports,raw);verify(l,ports,before,r);
 for(const p of ports.filter(p=>p.externalSide)){const[dx,dy]={west:[-1,0],east:[1,0],north:[0,-1],south:[0,1]}[p.externalSide];for(let n=1;n<=3;n++)assert(!l.grid.has(`${Math.floor(p.x)+dx*n},${Math.floor(p.y)+dy*n}`));}
});
test('distant clusters get bridges with prototype reach and bounded copper degree',()=>{
 const l=new Layout();for(const[x,y]of[[0,0],[75,0],[0,75],[75,75],[35,35],[110,35]])l.add('machine',x+1.5,y+1.5);
 const ports=[],before=saved(l),r=powerFiveLayout(l,ports,raw);verify(l,ports,before,r);assert(r.bridges>0);assert.equal(r.mediumPoles,0);
});
test('medium fallback covers a narrow cell inaccessible to substations',()=>{
 const l=new Layout();
 // A solid square admits only a single 1x1 pole next to the consumer.
 for(let x=-12;x<=12;x++)for(let y=-12;y<=12;y++)if(!(x===0&&y===0)&&!(x===1&&y===0))l.add('wall',x+.5,y+.5);
 l.add('arm',.5,.5);
 // Shorten only the fixture reach requirement: the fallback must still bridge
 // out of the square through an existing one-tile corridor.
 for(let x=2;x<=12;x++){const e=l.grid.get(`${x},0`);l.entities.splice(l.entities.indexOf(e),1);l.grid.delete(`${x},0`);}
 const ports=[],before=saved(l),r=powerFiveLayout(l,ports,raw);verify(l,ports,before,r);assert(r.mediumPoles>0);
});
test('uses supplied supply radii and wire reaches rather than vanilla constants',()=>{
 const custom=structuredClone(raw);
 Object.assign(custom['electric-pole'].substation,{supply_area_distance:4,maximum_wire_distance:7});
 Object.assign(custom['electric-pole']['medium-electric-pole'],{supply_area_distance:2,maximum_wire_distance:5});
 const l=new Layout(custom);for(const x of[1.5,15.5,29.5])l.add('machine',x,1.5);
 const ports=[],before=saved(l),r=powerFiveLayout(l,ports,custom);verify(l,ports,before,r);assert(r.substations>=5);
});
test('rotated rectangular consumers use their rotated collision extents',()=>{
 const custom=structuredClone(raw);
 custom.machine.arm={...custom.machine.arm,collision_box:[[-.35,-2.35],[.35,2.35]],selection_box:[[-.5,-2.5],[.5,2.5]]};
 const l=new Layout(custom);l.add('arm',2.5,2.5,{direction:4});l.add('arm',23.5,2.5,{direction:4});
 const ports=[],before=saved(l),r=powerFiveLayout(l,ports,custom);verify(l,ports,before,r);assert.equal(r.substations,1);
});
test('rejects old power rather than deleting it',()=>{
 const l=new Layout();l.add('medium-electric-pole',.5,.5);const before=saved(l);
 assert.throws(()=>powerFiveLayout(l,[],raw),/stripped/);assert.deepEqual(saved(l),before);
});
const nativePath=process.env.FACTOIO_RAW || process.env.FACTORIO_RAW;
test('frozen four-pack geometry: fewer poles than its original 80, same consumers and wires',{skip:!nativePath},async t=>{
 const native=JSON.parse(await fs.readFile(nativePath,'utf8'));
 // Five-science is built on the four-pack factory as qualified on 16 November 2026, pinned in rgby-science history.
 const root=new URL('../blueprint-sources/rgby-science/history/routed-before-compaction-b8568d00/',import.meta.url);
 const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8')).find(m=>m.id==='rgby-science-30');
 const code=(await fs.readFile(new URL(manifest.file,root),'utf8')).trim();
 assert.equal(createHash('sha256').update(code).digest('hex'),manifest.blueprintSha256);
 const bp=decodeBlueprint(code).blueprint,old=bp.entities.filter(e=>native['electric-pole'][e.name]),ids=new Set(old.map(e=>e.entity_number));
 assert.equal(old.filter(e=>e.name==='medium-electric-pole').length,80);
 assert.equal(old.filter(e=>e.name==='big-electric-pole').length,1);
 const l=new Layout(native);for(const e of structuredClone(bp.entities).filter(e=>!ids.has(e.entity_number)))l.place(e);
 l.wires=structuredClone(bp.wires).filter(w=>w[1]!==5&&w[3]!==5&&!ids.has(w[0])&&!ids.has(w[2]));
 const ports=structuredClone(manifest.ports),before=saved(l),r=powerFiveLayout(l,ports,native);verify(l,ports,before,r);
 assert(r.totalPoles<80);t.diagnostic(JSON.stringify({original:old.length,substations:r.substations,mediumPoles:r.mediumPoles,totalPoles:r.totalPoles,consumers:r.consumers,bridges:r.bridges,copperWires:r.copperWires,maxCopperDegree:r.maxCopperDegree}));
});
