import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';

const root=path.resolve('blueprint-sources/flight-space-science');
const entities=[];
const add=(name,x,y,direction,extra={})=>{
  const entity_number=entities.length+1;
  entities.push({entity_number,name,position:{x,y},...(direction===undefined?{}:{direction}),...extra,tags:{flight_science_entity:entity_number}});
};
// One AM2 runs this 15-second recipe in 20 seconds at 0.75 crafting speed.
add('assembling-machine-2',6.5,0.5,0,{recipe:'space-science-pack'});
// Separate, labeled raw material lanes enter from the south edge.
const ports=[
  {item:'iron-plate',x:5.5,ratePerMinute:6},
  {item:'carbon',x:6.5,ratePerMinute:3},
  {item:'ice',x:7.5,ratePerMinute:3},
];
for(const p of ports){
  add('fast-inserter',p.x,2.5,8);
  for(const y of [3.5,4.5,5.5,6.5,7.5])add('fast-transport-belt',p.x,y,0);
}
// The west-facing inserter transfers finished packs directly into the platform hub.
add('fast-inserter',4.5,0.5,4);
// Eight panels provide power headroom for the assembler and four fast inserters.
for(const [x,y] of [[10.5,-5.5],[14.5,-5.5],[10.5,-1.5],[14.5,-1.5],[10.5,2.5],[14.5,2.5],[10.5,6.5],[14.5,6.5]])add('solar-panel',x,y);

const blueprint={
  item:'blueprint',
  label:'Orbital Space Science · 15 packs/min cell',
  description:'Factorio 2.1.24 · one AM2 · no modules · three south inputs · packs inserted directly into platform hub. Add four cells for 60/min.',
  icons:[{signal:{type:'item',name:'space-science-pack'},index:1}],
  entities,
  tiles:[],
  version:562949955911680,
};
const code='0'+deflateSync(Buffer.from(JSON.stringify({blueprint}))).toString('base64');
await fs.mkdir(root,{recursive:true});
await fs.writeFile(path.join(root,'orbital-space-science-cell.txt'),code+'\n');
const sha256=createHash('sha256').update(code).digest('hex');
const manifest={
  id:'orbital-space-science-cell',
  file:'orbital-space-science-cell.txt',
  blueprintSha256:sha256,
  gameVersion:'2.1.24',
  targetPerMinute:15,
  recipe:{id:'space-science-pack',energySeconds:15,output:5,ingredients:{'iron-plate':2,carbon:1,ice:1},gravity:{min:0,max:0}},
  inputs:ports,
  output:{item:'space-science-pack',destination:'space-platform-hub',handoff:'west-facing inserter'},
  entities:Object.fromEntries(Object.entries(entities.reduce((acc,e)=>(acc[e.name]=(acc[e.name]||0)+1,acc),{})).sort()),
  footprint:{left:2.5,top:-7,bottom:8,width:14,height:15},
  notes:['No chests or roboports on the orbital surface.','Connect the foundation patch to the platform hub.','The three input belts receive iron plates, carbon and ice from the asteroid-processing factory.','Use four identical cells to reach 60 packs/min; total recipe demand is 24 iron plates, 12 carbon and 12 ice per minute.'],
};
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({file:path.join(root,manifest.file),sha256,entities:entities.length,manifest},null,2));
