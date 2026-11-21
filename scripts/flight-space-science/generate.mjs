import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';

const root=path.resolve('blueprint-sources/flight-space-science');
const entities=[];
const add=(name,x,y,direction,extra={})=>{
  const entity_number=entities.length+1;
  entities.push({entity_number,name,position:{x,y},...(direction===undefined?{}:{direction}),...extra,tags:{flight_science_entity:entity_number}});
};
// One AM2 runs this 15-second recipe in 20 seconds at 0.75 crafting speed.
add('assembling-machine-2',6.5,0.5,0,{recipe:'space-science-pack'});
// Separate, labeled raw material lanes enter from the south edge: one belt tile each, the feeder joins from the south.
const ports=[
  {item:'iron-plate',x:5.5,y:3.5,ratePerMinute:6},
  {item:'carbon',x:6.5,y:3.5,ratePerMinute:3},
  {item:'ice',x:7.5,y:3.5,ratePerMinute:3},
];
for(const p of ports){
  add('fast-inserter',p.x,2.5,8);
  add('fast-transport-belt',p.x,p.y,0);
}
// The west-facing inserter transfers finished packs directly into the platform hub.
add('fast-inserter',4.5,0.5,4);
// Two panels give 360 kW in Nauvis orbit (300% space solar) for a cell that averages about 156 kW.
// One panel (180 kW) lets the craft cadence slip in the native test; the platform's network is global, so no poles.
for(const [x,y] of [[9.5,-0.5],[9.5,2.5]])add('solar-panel',x,y);

const SIZE={'assembling-machine-2':3,'solar-panel':3};
const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity},covered=new Set();
for(const e of entities){
  const s=SIZE[e.name]||1,h=s/2,{x,y}=e.position;
  box.left=Math.min(box.left,x-h);box.right=Math.max(box.right,x+h);box.top=Math.min(box.top,y-h);box.bottom=Math.max(box.bottom,y+h);
  for(let i=0;i<s;i++)for(let j=0;j<s;j++)covered.add(`${x-h+i},${y-h+j}`);
}
const footprint={...box,width:box.right-box.left,height:box.bottom-box.top};

const blueprint={
  item:'blueprint',
  label:'Orbital Space Science · 15 packs/min cell',
  description:'Factorio 2.1.24 · one AM2 · no modules · three south inputs · packs inserted directly into platform hub. Add four cells for 60/min.',
  icons:[{signal:{type:'item',name:'space-science-pack'},index:1}],
  entities,
  tiles:[],
  version:562949955911680,
};
const json=JSON.stringify({blueprint});
// zlib's compressed bytes differ between builds (the Linux CI runner and this Mac give different strings for the same JSON).
// Keep the committed string when it decodes to exactly this blueprint, so its SHA-256 and native report stay valid everywhere.
const committed=await fs.readFile(path.join(root,'orbital-space-science-cell.txt'),'utf8').then(s=>s.trim(),()=>null);
const decodes=text=>{try{return inflateSync(Buffer.from(text.slice(1),'base64')).toString('utf8')===json;}catch{return false;}};
const code=committed&&decodes(committed)?committed:'0'+deflateSync(Buffer.from(json)).toString('base64');
await fs.mkdir(root,{recursive:true});
await fs.writeFile(path.join(root,'orbital-space-science-cell.txt'),code+'\n');
const sha256=createHash('sha256').update(code).digest('hex');
const counts=Object.fromEntries(Object.entries(entities.reduce((acc,e)=>(acc[e.name]=(acc[e.name]||0)+1,acc),{})).sort());
const manifest={
  id:'orbital-space-science-cell',
  file:'orbital-space-science-cell.txt',
  blueprintSha256:sha256,
  gameVersion:'2.1.24',
  targetPerMinute:15,
  recipe:{id:'space-science-pack',energySeconds:15,output:5,ingredients:{'iron-plate':2,carbon:1,ice:1},gravity:{min:0,max:0}},
  inputs:ports,
  output:{item:'space-science-pack',destination:'space-platform-hub',handoff:'west-facing inserter'},
  entities:counts,
  footprint,
  foundationTilesUnderEntities:covered.size,
  notes:['No chests or roboports on the orbital surface.','Connect the foundation patch to the platform hub.','The three input belts receive iron plates, carbon and ice from the asteroid-processing factory.','Two solar panels power the cell in Nauvis orbit (360 kW at 300% space solar; the cell averages about 156 kW). At a location with less space solar, add panels anywhere on the platform: its electric network is global.','Use four identical cells to reach 60 packs/min; total recipe demand is 24 iron plates, 12 carbon and 12 ice per minute.'],
};
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');

// The README states measured figures only from a committed native report for this exact string.
const report=await fs.readFile(path.join(root,'validation/native-report.json'),'utf8').then(JSON.parse).catch(()=>null);
const qualified=report?.blueprintSha256===sha256&&report.passed===true;
const runLine=(name,r)=>`- ${name}: ${r.outputsPerMinute} packs/min into the hub (${r.hubSciencePacks} in 10 minutes), crafts ${r.craftIntervalTicks.min===r.craftIntervalTicks.max?'exactly '+r.craftIntervalTicks.min:r.craftIntervalTicks.min+'-'+r.craftIntervalTicks.max} ticks apart, about ${Math.round(r.power.averageConsumedKilowatts)} kW average.`;
const readme=`# Orbital space science cell

One assembling machine 2 making space science packs on a space platform in Nauvis orbit, fed by separately built
asteroid processing. The white-platform design supersedes it for a whole platform.

- Blueprint: \`${manifest.file}\` (SHA-256 \`${sha256}\`), generated by \`node scripts/flight-space-science/generate.mjs\`.
- ${entities.length} entities: ${Object.entries(counts).map(([k,v])=>`${v} ${k}`).join(', ')}. No modules.
- Footprint ${footprint.width} x ${footprint.height} tiles; ${covered.size} foundation tiles under entities.
- Inputs on the south edge, left to right: ${ports.map(p=>`${p.item} at (${p.x}, ${p.y}) ${p.ratePerMinute}/min`).join(', ')}.
- Output: the west-facing inserter at (4.5, 0.5) puts packs straight into the platform hub on the west side.
- Power: two solar panels, 360 kW in Nauvis orbit. Add panels anywhere on the platform at locations with less space solar.

## Native qualification

${qualified?`Passed for this exact string in Factorio ${report.gameVersion} (\`validation/native-report.json\`), each run on its own zero-gravity Nauvis platform, 10 measured minutes:

${runLine('Stated feed (6 iron plates, 3 carbon, 3 ice per minute)',report)}
${runLine('Abundant feed (both lanes of every entrance belt kept full)',report.behaviour.abundant)}
${runLine('Hub full for 5 minutes, then cleared',report.behaviour.blockedHub)} Packs moved during the block: ${report.behaviour.blockedHub.packsDuringBlock}.`:'Not qualified: no passing native report for this exact string. Run `node tests/flight-space-science-platform-native.mjs --write-report`.'}

Earlier versions are kept under \`history/\`.
`;
await fs.writeFile(path.join(root,'README.md'),readme);
console.log(JSON.stringify({file:path.join(root,manifest.file),sha256,entities:entities.length,qualified,manifest},null,2));
