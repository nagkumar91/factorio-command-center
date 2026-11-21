/** Connected-lab variants: the factory plus a lab annex standing along its east edge.
 *
 * The annex from labs.mjs is turned so its belts run north and sits beside the four-pack
 * core, above the five science exits (rows 41 to 49). Its feed stage (two mixed-lane belts,
 * each side-loaded once from the west and once from the east) is directly below it, so every
 * science belt is a few tiles long and nothing is added below the factory: the 15-lab
 * variant is 141 x 92 and the 30-lab variant 149 x 92 (two columns of substations on its far side), against 141 x 112 and 141 x 119 for
 * the earlier annex under the purple bank. Every belt here is placed by hand; no router.
 */
import fs from'node:fs/promises';import{createHash}from'node:crypto';
import{decodeBlueprint,encodeBlueprint}from'../blueprints.mjs';
import{starterBounds}from'../science-factory/local-ports/compact-shared-layout.mjs';
import{optimizeUnderground}from'../rgby-science/underground.mjs';
import{FiveLayout,isPole}from'./layout.mjs';import{makeFiveLabs}from'./labs.mjs';import{powerFiveLayout}from'./power.mjs';
import{buryPlainRuns}from'./bury.mjs';import{qualifiedStatus}from'./status.mjs';
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW)),dir=process.env.FIVE_DIR||'blueprint-sources/five-science';
const[factory]=JSON.parse(await fs.readFile(dir+'/manifest.json')),source=decodeBlueprint((await fs.readFile(dir+'/'+factory.file,'utf8')).trim()).blueprint;
raw.container={...raw.container,...raw['logistic-container']};raw['assembling-machine'].lab=raw.lab.lab;
const N=0,E=4,S=8,W=12,packs=factory.products;
// Annex-local east becomes north and annex-local south becomes west (a turn plus a mirror), so the two
// shared belts end up on the side nearest the factory.
const turn={[E]:N,[S]:W,[N]:E,[W]:S},STAGE_TOP=32;
const result=[factory];
for(const rows of[1,2]){
 const l=new FiveLayout(raw);for(const e of structuredClone(source.entities).filter(e=>!isPole(e)))l.place(e);
 l.next=Math.max(...l.entities.map(e=>e.entity_number))+1;l.wires=structuredClone(source.wires.filter(w=>w[1]!==5&&w[3]!==5));
 const firstNew=l.next,originX=rows===1?113:119,cellX=y=>originX-y,cellY=x=>STAGE_TOP-1-x;
 const annex=makeFiveLabs(raw,{rows}),map=new Map();
 for(const e of structuredClone(annex.entities)){
  map.set(e.entity_number,l.next);e.entity_number=l.next++;
  e.position={x:originX+1-e.position.y,y:STAGE_TOP-e.position.x};if(e.name!=='lab')e.direction=turn[e.direction??N];
  e.tags={...e.tags,flight_science_entity:e.entity_number,rgby_component:'five-pack-labs'};l.place(e);
 }
 const labPorts=annex.ports.map(p=>{const e=l.entities.find(e=>e.entity_number===map.get(p.entity));return{...p,entity:e.entity_number,x:e.position.x,y:e.position.y,position:{...e.position},direction:N,externalSide:undefined};});
 const local=(name,x,y,d,extra={})=>l.add(name,cellX(y),cellY(x),{direction:turn[d],...extra});
 // Feed stage, in annex-local tiles: rear stubs keep each side-loaded tile straight, and the first belt
 // tunnels under the second belt's two feeders.
 for(let x=-9;x<=-6;x++)local('fast-transport-belt',x,4,E);
 local('fast-underground-belt',-5,4,E,{type:'input'});local('fast-underground-belt',-1,4,E,{type:'output'});
 for(let x=-5;x<=-1;x++)local('fast-transport-belt',x,5,E);
 const feeders=[[-2,6,N],[-6,5,N],[-8,3,S],[-4,4,S]].map(([x,y,d])=>local('fast-transport-belt',x,y,d));
 const exit=(pack,x,y,d)=>l.add('fast-inserter',x,y,{direction:d,override_stack_size:1,use_filters:true,filters:[{index:1,name:pack,quality:'normal',comparator:'='}]});
 const run=(x0,y0,x1,y1,d)=>{for(let x=x0,y=y0;;x+=Math.sign(x1-x0),y+=Math.sign(y1-y0)){l.belt(x,y,d);if(x===x1&&y===y1)break;}};
 const chest=Object.fromEntries(factory.outputs.map(p=>[p.item,{x:Math.floor(p.x),y:Math.floor(p.y)}]));
 const[red,green,blue,yellow,purple]=packs.map(p=>chest[p]),side=red.x+1,lane=red.x+2;
 for(const[pack,c]of[[packs[1],green],[packs[2],blue],[packs[3],yellow],[packs[4],purple]])exit(pack,side,c.y,W);
 const west=[feeders[0],feeders[1]].map(e=>({x:Math.floor(e.position.x),y:Math.floor(e.position.y)})),east=[feeders[2],feeders[3]].map(e=>({x:Math.floor(e.position.x),y:Math.floor(e.position.y)}));
 const purpleNorth=labPorts.find(p=>/north/.test(p.label)),purpleX=Math.floor(purpleNorth.x);
 if(rows===1){
  // Red leaves its chest northwards and comes down the free column beside the chests to the west feeder
  // of the outer shared belt; green climbs the column the other exits drop on.
  exit(packs[0],red.x,red.y-1,S);run(red.x,red.y-2,red.x,west[0].y+1,N);run(red.x,west[0].y,west[0].x-1,west[0].y,E);
  run(lane,green.y,lane,west[1].y+1,N);
  run(lane,blue.y,east[0].x,blue.y,E);run(east[0].x+1,blue.y,east[0].x+1,east[0].y+1,N);l.belt(east[0].x+1,east[0].y,W);
  run(lane,yellow.y,east[0].x+1,yellow.y,E);run(east[0].x+2,yellow.y,east[0].x+2,east[1].y+1,N);run(east[0].x+2,east[1].y,east[1].x+1,east[1].y,W);
 }else{
  exit(packs[0],side,red.y,W);
  run(lane,red.y,west[0].x-1,red.y,E);run(west[0].x,red.y,west[0].x,west[0].y+1,N);
  run(lane,green.y,west[1].x-1,green.y,E);run(west[1].x,green.y,west[1].x,west[1].y+1,N);
  run(lane,blue.y,east[0].x-1,blue.y,E);run(east[0].x,blue.y,east[0].x,east[0].y+1,N);
  run(lane,yellow.y,east[0].x,yellow.y,E);run(east[0].x+1,yellow.y,east[0].x+1,east[1].y+1,N);run(east[0].x+1,east[1].y,east[1].x+1,east[1].y,W);
 }
 run(lane,purple.y,purpleX-1,purple.y,E);run(purpleX,purple.y,purpleX,STAGE_TOP,N);
 if(rows===2){
  // One purple belt serves both lab rows: up the east side, across the top and down the west side.
  const south=labPorts.find(p=>/south/.test(p.label)),top=STAGE_TOP-46,westX=Math.floor(south.x);
  run(purpleX,top,westX+1,top,W);l.belt(westX,top,S);
  for(const e of l.entities)if(e.name==='fast-transport-belt'&&Math.floor(e.position.x)===westX&&e.tags?.rgby_component==='five-pack-labs')e.direction=S;
 }
 const ports=structuredClone(factory.ports.filter(p=>p.kind!=='power')).map(p=>p.kind==='output'?{...p,externalSide:undefined}:p),powerPort={kind:'power',items:[],entity:0,x:-24,y:-14};ports.push(powerPort);
 // Only the west entrances are exterior here; the science chests feed the annex.
 // Substations stay inside the factory's own rows; the 30-lab annex is too wide to be reached from the
 // factory side alone, so it may use two more columns on its far side.
 const reach=starterBounds(l.entities,raw),power=powerFiveLayout(l,[...ports.filter(p=>p.kind!=='output'),powerPort].filter((p,i,a)=>a.indexOf(p)===i),raw,{within:{left:factory.footprint.left,top:factory.footprint.top,right:reach.right+(rows===2?2:0),bottom:factory.footprint.bottom}});
 for(const e of l.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
 const id='five-science-30-labs-'+rows*15,name=`Five-pack science · 30/min · ${rows*15} connected labs · substations`;
 const bp={...source,label:name,description:source.description+' All five packs feed connected labs directly. '+(rows===1?'15 labs for 60-second research at 2× effective speed.':'30 labs for 60-second research at 1× effective speed.'),entities:l.entities,wires:l.wires};
 const keep=[...ports,...labPorts,...feeders.map(e=>({entity:e.entity_number,x:e.position.x,y:e.position.y}))];
 const underground=optimizeUnderground(bp,keep),second=buryPlainRuns(bp,{eligible:e=>e.entity_number>=firstNew&&!e.tags?.rgby_component,keep:keep.map(p=>p.entity)});underground.secondPass={pairs:second.pairs.length,removed:second.removed};
 const code=encodeBlueprint({blueprint:bp});
 const m={...factory,id,name,file:id+'.txt',blueprintSha256:createHash('sha256').update(code).digest('hex'),ports,outputs:ports.filter(p=>p.kind==='output'),footprint:starterBounds(bp.entities,raw),underground,power:{...power,poles:undefined,wires:undefined},expectedLabCount:rows*15,researchProbe:{seconds:60,labSpeedModifier:rows===1?1:0,packs},labAnnex:{labCount:rows*15,side:'east',beltsRun:'north',origin:{x:originX,y:STAGE_TOP},packCount:5},construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length])),setupNotes:[bp.description]};
 m.status=await qualifiedStatus(dir,m);
 await fs.writeFile(dir+'/'+m.file,code+'\n');result.push(m);console.log(id,m.footprint,m.construction.substation,JSON.stringify(underground.secondPass));
}
await fs.writeFile(dir+'/manifest.json',JSON.stringify(result,null,2)+'\n');
