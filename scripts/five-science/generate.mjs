import fs from'node:fs/promises';
import{writeFileSync}from'node:fs';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{decodeBlueprint,encodeBlueprint}from'../blueprints.mjs';
import{starterBounds}from'../science-factory/local-ports/compact-shared-layout.mjs';
import{makeGreens}from'../rgby-science/greens.mjs';
import{optimizeUnderground}from'../rgby-science/underground.mjs';
import{FiveLayout,isPole}from'./layout.mjs';
import{makePurple}from'./purple.mjs';
import{makePurpleAdvanced}from'./advanced.mjs';
import{powerFiveLayout}from'./power.mjs';
import{calculateRequirements}from'./requirements.mjs';
import{buryPlainRuns}from'./bury.mjs';
import{qualifiedStatus}from'./status.mjs';
const bytes=await fs.readFile(process.env.FACTORIO_RAW),raw=JSON.parse(bytes),sha=s=>createHash('sha256').update(s).digest('hex');
raw.container={...raw.container,...raw['logistic-container']};raw['assembling-machine'].lab=raw.lab.lab;
const dir=process.env.FIVE_DIR||'blueprint-sources/five-science';await fs.mkdir(dir,{recursive:true});await fs.mkdir('.cache/five-science',{recursive:true});
// The purple bank starts on the row directly under the four-pack core (its last row is 55) and every
// connecting belt stays inside the rows the three purple blocks already occupy: 132 x 92 instead of 132 x 100.
const BANK_TOP=56,BANK_BOTTOM=77;
// Built on the four-pack factory as qualified on 16 November 2026 (b8568d00), pinned in rgby-science history.
const baseDir='rgby-science/history/routed-before-compaction-b8568d00/';
const [base]=JSON.parse(await fs.readFile('blueprint-sources/'+baseDir+'manifest.json'));
const source=decodeBlueprint((await fs.readFile('blueprint-sources/'+baseDir+base.file,'utf8')).trim()).blueprint;
const l=new FiveLayout(raw);for(const e of structuredClone(source.entities).filter(e=>!isPole(e)))l.place(e);
l.next=Math.max(...l.entities.map(e=>e.entity_number))+1;l.wires=structuredClone(source.wires.filter(w=>w[1]!==5&&w[3]!==5));l.loops=structuredClone(base.loopControl);
const bankFirst=l.next;
const additions=[];for(const[c,x,y]of[[await makeGreens(raw,'purple-greens'),0,BANK_TOP+4],[{...makePurpleAdvanced(raw),id:'purple-advanced'},35,BANK_TOP+2],[{...makePurple(raw),id:'purple-finishing'},72,BANK_TOP+2]])additions.push(l.importComponent(c,x,y));
const internalInputs=l.ports.filter(p=>p.kind==='input'),internalOutputs=l.ports.filter(p=>p.kind==='output');
const sourcePorts=internalOutputs.map(p=>{const e=l.outputBelt(p);return{...p,entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position};});
const globalPorts=structuredClone(base.ports.filter(p=>p.kind!=='power')).map(p=>({...p,bank:'Four-pack core'})),newInputs=[];
const vectors=[[0,-1],[1,0],[0,1],[-1,0]],routeOptions={minX:-27,maxX:115,minY:BANK_TOP-1,maxY:BANK_BOTTOM,startDirection:4,endDirection:4};
function reserved(p,s){const blocked=new Set();for(const q of internalInputs.filter(q=>q!==p))for(let k=1;k<=2;k++)blocked.add((Math.floor(q.x)-k)+','+Math.floor(q.y));for(const q of sourcePorts.filter(q=>q.entity!==s?.entity))for(let k=1;k<=2;k++)blocked.add((Math.floor(q.x)+k)+','+Math.floor(q.y));for(const q of globalPorts.filter(q=>q.externalSide==='east'))for(let k=1;k<=3;k++)blocked.add((Math.floor(q.x)+k)+','+Math.floor(q.y));return blocked;}
function connect(s,p,extra={}){console.log('route',s.item,s.x,s.y,'→',p.component||p.item,p.x,p.y);try{return l.route(s,p,{...routeOptions,...extra,blocked:reserved(p,s)});}catch(e){writeFileSync('.cache/five-science/route-failure.json',JSON.stringify({entities:l.entities,start:s,target:p,blocked:[...reserved(p,s)]}));throw e;}}
const green=sourcePorts.find(p=>p.item==='electronic-circuit'),greenTargets=internalInputs.filter(p=>p.item==='electronic-circuit');
const gx=Math.floor(green.x)+1,gy=Math.floor(green.y);// Green circuits go to the advanced-circuit block first (the north exit); the finishing block takes the rest.
// An even split filled the long finishing branch before the advanced ring had its share and delayed the first purple packs.
l.add('fast-splitter',gx,gy,{position:{x:gx+.5,y:gy+1},direction:4,output_priority:'left'});
const greenBranches=greenTargets.map((p,i)=>{const e=l.belt(gx+1,gy+i,4);return{item:'electronic-circuit',entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position};});sourcePorts.push(...greenBranches);
function allocateTaps(ports,x,top){const used=[];return [...ports].sort((a,b)=>b.y-a.y).map(p=>{const want=Math.max(top+2,Math.floor(p.y));let row;for(let d=0;d<15&&row===undefined;d++)for(const y of d?[want+d,want-d]:[want])if(y>=top+2&&used.every(v=>Math.abs(v-y)>=2)&&!internalInputs.some(q=>{const near=x+1>=Math.floor(q.x)-3&&x+1<Math.floor(q.x);return near&&(Math.floor(q.y)===y-1||q!==p&&Math.floor(q.y)===y);})){row=y;break;}assert(row!==undefined,'raw tap '+p.item);used.push(row);return{p,row};});}
const channels=['iron-plate','copper-plate','steel-plate','plastic-bar','stone','stone-brick'].map((item,i)=>({item,x:-4-i*3,header:BANK_TOP+i,ports:internalInputs.filter(p=>p.item===item)}));
for(const c of channels){
 c.taps=allocateTaps(c.ports,c.x,c.header);const rows=new Set(c.taps.map(t=>t.row-1));
 for(let y=c.header+1;y<=Math.max(...c.taps.map(t=>t.row));y++)if(rows.has(y))l.add('fast-splitter',c.x,y,{position:{x:c.x+1,y:y+.5},direction:8});else l.belt(c.x,y,8);
 for(const t of c.taps){const e=l.belt(c.x+1,t.row,4);t.source={item:c.item,entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position};sourcePorts.push(t.source);}
 const e=l.belt(-25,c.header,4);l.add('fast-underground-belt',-24,c.header,{direction:4,type:'input'});l.add('fast-underground-belt',-20,c.header,{direction:4,type:'output'});for(let x=-19;x<=c.x;x++)l.belt(x,c.header,x===c.x?8:4);
 const sign=l.add('display-panel',-22,c.header,{icon:{type:'item',name:c.item},text:'IN '+c.item+' · purple science bank',always_show:true});
 const p={kind:'input',item:c.item,items:[c.item],entity:e.entity_number,x:e.position.x,y:e.position.y,position:e.position,direction:4,externalSide:'west',displayEntity:sign.entity_number,bank:'Purple science extension'};globalPorts.push(p);newInputs.push(p);
}
const end=l.belt(104,49,4);l.add('fast-inserter',105,49,{direction:12,use_filters:true,filters:[{index:1,name:'production-science-pack',quality:'normal',comparator:'='}]});const out=l.add('passive-provider-chest',106,49,{bar:1});globalPorts.push({kind:'output',item:'production-science-pack',items:['production-science-pack'],entity:out.entity_number,x:out.position.x,y:out.position.y,position:out.position,externalSide:'east'});
const powerPort={kind:'power',items:[],entity:0,x:-24,y:-14},power=powerFiveLayout(l,[...globalPorts,...internalInputs,...sourcePorts.map(p=>({...p,kind:'output',externalSide:'east'})),powerPort],raw);
for(const t of channels.flatMap(c=>c.taps).sort((a,b)=>a.p.x-b.p.x||b.p.y-a.p.y))connect(t.source,t.p);
for(const[i,p]of greenTargets.entries())connect(greenBranches[i],p);
connect(sourcePorts.find(p=>p.item==='advanced-circuit'),internalInputs.find(p=>p.item==='advanced-circuit'));
connect(sourcePorts.find(p=>p.item==='production-science-pack'),{item:'production-science-pack',x:end.position.x,y:end.position.y},{minY:46});
const ports=[...globalPorts,powerPort],products=[...base.products,'production-science-pack'],id='five-science-30',name='Five-pack science from plates · 30/min · substations';
for(const e of l.entities)e.tags={...e.tags,flight_science_entity:e.entity_number};
const bp={...source,label:name,description:'Red, green, blue, yellow and purple science from plates, steel, plastic, sulfur, acid, lubricant, stone and bricks. All intermediate circuits, engines, frames, processors, rails, furnaces and productivity modules are made inside; no modules are installed. Supply every labeled west port in both input banks. Five east passive providers collect science. Preserve stock-control wiring, output chest limits and substation copper connections.',icons:products.slice(0,4).map((name,i)=>({index:i+1,signal:{type:'item',name}})),entities:l.entities,wires:l.wires};
const underground=optimizeUnderground(bp,ports),second=buryPlainRuns(bp,{eligible:e=>e.entity_number>=bankFirst&&!e.tags?.rgby_component,keep:[...ports,...internalInputs,...sourcePorts].map(p=>p.entity)});underground.secondPass={pairs:second.pairs.length,removed:second.removed};
const code=encodeBlueprint({blueprint:bp}),machineCounts={};for(const e of bp.entities)if(e.recipe)machineCounts[e.recipe]=(machineCounts[e.recipe]||0)+1;
const m={id,name,file:id+'.txt',blueprintSha256:sha(code),prototypeSha256:sha(bytes),products,targetPerMinute:30,targets:Object.fromEntries(products.map(p=>[p,30])),ports,inputs:ports.filter(p=>p.kind==='input'),fluids:ports.filter(p=>p.kind==='fluid'),outputs:ports.filter(p=>p.kind==='output'),footprint:starterBounds(bp.entities,raw),machineCounts,loopControl:l.loops,requirements:calculateRequirements(raw),construction:Object.fromEntries([...new Set(bp.entities.map(e=>e.name))].map(n=>[n,bp.entities.filter(e=>e.name===n).length])),underground,power:{...power,poles:undefined,wires:undefined},components:additions.map(c=>({id:c.id,translation:c.translation,footprint:c.footprint,sourceEntityWireSha256:sha(JSON.stringify({entities:c.entities,wires:c.wires}))})),baseline:{file:'../'+baseDir+base.file,blueprintSha256:base.blueprintSha256},setupNotes:[bp.description]};m.status=await qualifiedStatus(dir,m);
await fs.writeFile(dir+'/'+m.file,code+'\n');await fs.writeFile(dir+'/manifest.json',JSON.stringify([m],null,2)+'\n');console.log(JSON.stringify({footprint:m.footprint,construction:m.construction,power:m.power,undergroundSaved:underground.saved},null,2));
