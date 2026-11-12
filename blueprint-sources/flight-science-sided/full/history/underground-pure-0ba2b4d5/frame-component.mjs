import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../../blueprints.mjs';
import {Layout} from '../hybrid/layout.mjs';
import {starterBounds} from '../../science-factory/local-ports/compact-shared-layout.mjs';

class FactoryLayout extends Layout {
 place(e){
  let w=1,h=1;
  if(['assembling-machine-2','chemical-plant','electric-furnace'].includes(e.name))w=h=3;
  if(e.name==='fast-splitter'){w=[4,12].includes(e.direction)?1:2;h=[4,12].includes(e.direction)?2:1;}
  for(let x=e.position.x-w/2;x<e.position.x+w/2;x++)for(let y=e.position.y-h/2;y<e.position.y+h/2;y++){
   const key=`${x},${y}`;assert(!this.grid.has(key),`Frame component collision ${e.name} at ${key}`);this.grid.set(key,e);
  }
  this.entities.push(e);
 }
}

export async function makeFrameComponent(raw,root,out){
 const directory=path.join(out,'components/frames'),[m]=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'))),code=(await fs.readFile(path.join(directory,m.file),'utf8')).trim();
 assert.equal(createHash('sha256').update(code).digest('hex'),m.blueprintSha256);
 const l=new FactoryLayout(raw),component=l.import(decodeBlueprint(code).blueprint,m,5,12);
 const inputs=l.ports.filter(p=>p.kind==='input'),rows={'copper-plate':-1,'iron-plate':1,'steel-plate':24};
 for(const p of inputs){
  const source=l.belt(-2,rows[p.items[0]],4);
  l.route(source.position,{x:p.x,y:p.y},{minX:-2,maxX:85,minY:-4,maxY:30,startDirection:4,endDirection:p.direction});
  Object.assign(p,{entity:source.entity_number,x:source.position.x,y:source.position.y,direction:4,externalSide:'west'});
 }
 const acid=l.ports.find(p=>p.kind==='fluid'&&p.items[0]==='sulfuric-acid');
 for(let x=-2;x<=8;x++)l.add('pipe',x,-3);
 l.add('pipe-to-ground',8,-2,{direction:0});l.add('pipe-to-ground',8,2,{direction:8});
 for(let y=3;y<6;y++)l.add('pipe',8,y);
 const acidSource=l.at(-2,-3);Object.assign(acid,{entity:acidSource.entity_number,x:acidSource.position.x,y:acidSource.position.y,externalSide:'west'});
 const lube=l.ports.find(p=>p.kind==='fluid'&&p.items[0]==='lubricant');
 for(let y=22;y<28;y++)l.add('pipe',48,y);
 for(let x=-2;x<=48;x++)l.add('pipe',x,28);
 const lubeSource=l.at(-2,28);Object.assign(lube,{entity:lubeSource.entity_number,x:lubeSource.position.x,y:lubeSource.position.y,externalSide:'west'});
 const output=l.ports.find(p=>p.kind==='output');l.remove(output.entity);
 // Boundary storage becomes a belt. Internal recipe stock controls stay intact.
 const extractor=l.entities.find(e=>e.name==='fast-inserter'&&e.position.x===14.5&&e.position.y===21.5);assert(extractor);delete extractor.control_behavior;
 for(let y=21;y<=26;y++)l.belt(15,y,y===26?12:8);
 for(let x=14;x>=-2;x--)l.belt(x,26,12);
 const outputBelt=l.at(-2,26);Object.assign(output,{entity:outputBelt.entity_number,x:outputBelt.position.x,y:outputBelt.position.y,direction:12,perMinute:20,internal:true});delete output.externalSide;
 const machineCounts={};for(const e of l.entities)if(e.recipe)machineCounts[e.recipe]=(machineCounts[e.recipe]||0)+1;
 return {entities:l.entities,wires:l.wires,ports:l.ports,loops:l.loops,footprint:starterBounds(l.entities,raw),machineCounts,component:{id:m.id,blueprintSha256:m.blueprintSha256,translation:component.translation}};
}
