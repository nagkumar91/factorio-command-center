import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../../blueprints.mjs';
import {Layout} from '../hybrid/layout.mjs';
import {starterBounds} from '../../science-factory/local-ports/compact-shared-layout.mjs';

class FullLayout extends Layout {
 place(e){
  let w=1,h=1;
  if(['assembling-machine-2','chemical-plant','electric-furnace'].includes(e.name))w=h=3;
  if(e.name==='fast-splitter'){w=[4,12].includes(e.direction)?1:2;h=[4,12].includes(e.direction)?2:1;}
  for(let x=e.position.x-w/2;x<e.position.x+w/2;x++)for(let y=e.position.y-h/2;y<e.position.y+h/2;y++){
   assert(Number.isInteger(x)&&Number.isInteger(y),'Noncanonical component geometry');
   const key=`${x},${y}`;assert(!this.grid.has(key),`Component collision ${e.name} at ${key}`);this.grid.set(key,e);
  }
  this.entities.push(e);
 }
}

// Component production evidence is retained separately. New port extensions are
// qualified by the final integrated factory's exact-hash native test.
export async function makeQualifiedComponent(raw,directory){
 const [m]=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'))),report=JSON.parse(await fs.readFile(path.join(directory,'native-report.json'))),code=(await fs.readFile(path.join(directory,m.file),'utf8')).trim();
 const sha=createHash('sha256').update(code).digest('hex');assert.equal(sha,m.blueprintSha256);
 assert(!report.short&&report.warmupMinutes>=15&&report.measurementMinutes>=30,'Unqualified source component');
 assert(report.builds.some(b=>b.id===m.id&&b.blueprintSha256===sha&&b.passed),'Source component lacks exact-hash passing evidence');
 const l=new FullLayout(raw),dx=5-m.footprint.left;l.import(decodeBlueprint(code).blueprint,m,dx,0);
 const inputs=l.ports.filter(p=>p.kind==='input'),rows=[],starts=new Map();
 for(const p of [...inputs].sort((a,b)=>a.y-b.y)){
  let row=Math.floor(p.y);while(rows.some(y=>Math.abs(y-row)<2))row--;
  rows.push(row);starts.set(p,l.belt(-2,row,4));
 }
 for(const p of inputs){
  const source=starts.get(p),blocked=new Set(inputs.filter(q=>q!==p).flatMap(q=>[1,2,3].map(n=>`${Math.floor(q.x)-n},${Math.floor(q.y)}`)));
  l.route(source.position,{x:p.x,y:p.y},{minX:-2,maxX:m.footprint.right+dx+12,minY:Math.min(...rows,m.footprint.top)-12,maxY:m.footprint.bottom+12,startDirection:4,endDirection:p.direction??4,blocked});
  Object.assign(p,{entity:source.entity_number,x:source.position.x,y:source.position.y,direction:4,externalSide:'west'});
 }
 assert(!l.ports.some(p=>p.kind==='fluid'),'Fluid components require explicit pipe routing');
 const machineCounts={};for(const e of l.entities){const recipe=e.recipe||e.tags?.production_recipe;if(recipe)machineCounts[recipe]=(machineCounts[recipe]||0)+1;}
 return {entities:l.entities,wires:l.wires,ports:l.ports,loops:l.loops,footprint:starterBounds(l.entities,raw),machineCounts,component:{id:m.id,blueprintSha256:sha,translation:{x:dx,y:0}}};
}
