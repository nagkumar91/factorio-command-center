// Prints the tile map of a processing-unit-supply blueprint folder (default: the published one).
// Usage: node scripts/flight-science-sided/heavy-supplies/processing-unit-supply/ascii.mjs [dir]
import fs from 'node:fs';
import path from 'node:path';
import {decodeBlueprint} from '../../../blueprints.mjs';
import {id,sourceFolder} from './generate.mjs';
const dir=path.resolve(process.argv[2]||sourceFolder);
const {blueprint}=decodeBlueprint(fs.readFileSync(path.join(dir,id+'.txt'),'utf8').trim());
const arrow={0:'^',4:'>',8:'v',12:'<'},grid=new Map();
for(const e of blueprint.entities){
 const size=e.name==='assembling-machine-2'?3:e.name==='big-electric-pole'?2:1,x0=Math.round(e.position.x-size/2),y0=Math.round(e.position.y-size/2);
 const c=e.name==='assembling-machine-2'?(e.direction===4?'E':'W'):e.name==='fast-transport-belt'?arrow[e.direction||0]:e.name==='fast-inserter'?(e.use_filters?'F':'i'):e.name==='pipe'?'=':e.name==='pipe-to-ground'?'p':e.name==='steel-chest'?'C':e.name==='display-panel'?'D':e.name==='medium-electric-pole'?'o':e.name==='big-electric-pole'?'B':'?';
 for(let x=x0;x<x0+size;x++)for(let y=y0;y<y0+size;y++)grid.set(x+','+y,c);
}
const xs=[...grid.keys()].map(k=>+k.split(',')[0]),ys=[...grid.keys()].map(k=>+k.split(',')[1]);
for(let y=Math.min(...ys);y<=Math.max(...ys);y++){let line=String(y).padStart(3)+' ';for(let x=Math.min(...xs);x<=Math.max(...xs);x++)line+=grid.get(x+','+y)||'.';console.log(line);}
console.log('W/E assembling machine 2 facing west/east, i fast inserter, F filtered fast inserter, arrows red belts, = pipe, p pipe-to-ground, C steel chest, D display panel, o medium pole, B big pole');
