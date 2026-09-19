// Reproducible, inexpensive adaptations of the credited public starter layouts.
import fs from 'node:fs/promises';
import {decodeBlueprint,encodeBlueprint} from './blueprints.mjs';
const root='blueprint-sources/early-game';
const originals=JSON.parse(await fs.readFile(root+'/originals/sources.json'));
const manifest=[];
const specs=[
 {id:'steam',name:'Starter steam power',category:'01 · Power and mining',kind:'power',order:1,requires:['steam-power','electronics'],notes:['Connect an offshore pump to both water pipe entrances at the top. One pump can supply both through a branched pipe.','Feed coal into the bottom of the central belt. Burner inserters start the boilers without an existing power supply.','Connect the small poles to your factory. Four boilers and eight engines; no offshore pump is included.']},
 {id:'mining',name:'Small electric mining strip',category:'01 · Power and mining',kind:'mining',order:2,requires:['electric-mining-drill'],notes:['Place the drills over iron ore, copper ore, coal, or stone and connect electricity. The test uses an iron-ore patch.','The output belt leaves the right edge. Connect it to the matching smelter or coal supply.']},
 ...[['iron','iron-ore','iron-plate'],['copper','copper-ore','copper-plate'],['bricks','stone','stone-brick']].map(([suffix,input,product],i)=>({id:'smelting-'+suffix,source:'smelting',name:{iron:'Iron plates from ore',copper:'Copper plates from ore',bricks:'Stone bricks from stone'}[suffix],category:'02 · Smelting',kind:'production',order:3+i,requires:['logistics'],input,products:[product],notes:['Feed coal into entrance A on the left and the labeled ore or stone into entrance B just below it. Use separate full belts.','The middle belt carries finished plates or bricks out of the right edge. Connect the small poles to electricity for the inserters.','Uses eight stone furnaces. Place the same layout again for another material; do not mix iron, copper, or stone in one smelting line.']})),
 {id:'steel',name:'Steel from iron ore',category:'02 · Smelting',kind:'production',order:6,requires:['logistics','steel-processing'],products:['steel-plate'],notes:['Feed coal into left entrance A and iron ore into entrance B below it. Connect electricity.','The left furnace bank makes iron plates; the right bank turns those plates into steel. The output leaves the right edge.','Steel takes longer to start than ordinary plates. Uses eight furnaces for iron and eight for steel, shortened from the source’s 48-furnace layout.']},
 {id:'circuits',name:'Green circuits from plates',category:'03 · Parts and building supplies',kind:'production',order:7,requires:['automation','logistics','fast-inserter'],products:['electronic-circuit'],notes:['Feed copper plates into the two outer bottom entrances A and B, and iron plates into the two inner bottom entrances C and D.','Collect green circuits from the two center bottom output belts. Copper cable is made and inserted directly inside the layout.','Uses basic assembling machines. The source design’s faster-machine production rate does not apply.']},
 {id:'belts-inserters',name:'Tiny belt and inserter workshop',category:'03 · Parts and building supplies',kind:'production',order:8,requires:['automation','logistics'],products:['transport-belt','inserter'],notes:['Feed iron plates into the upper-right entrance A, and copper plates into the lower-right entrance B. Connect electricity.','Gears, cable, and green circuits are made inside. Collect belts and inserters from the two wooden chests on the left.','Output chests are limited to one stack to avoid using all your plates. Increase the red inventory limit when you need a larger stock.']},
 {id:'starter-mall',name:'Starter building supplies mall',category:'03 · Parts and building supplies',kind:'production',order:9,requires:['automation','logistics','fast-inserter'],products:['assembling-machine-1','fast-inserter','inserter','long-handed-inserter','underground-belt','transport-belt','splitter'],notes:['Feed iron plates into the left-middle entrance A and copper plates into the lower-left entrance B. Connect electricity.','Makes its own gears, cable, and green circuits. Seven limited wooden output chests hold assemblers, belts, splitters, underground belts, and three inserter types.','Start with the tiny workshop if resources are tight. This larger mall needs Fast inserter research, which uses red science.']},
 {id:'red-science',name:'Red science with gears included',category:'04 · Research',kind:'production',order:10,requires:['automation','logistics','fast-inserter'],products:['automation-science-pack'],notes:['Feed copper plates into top entrance A and iron plates into top-right entrance B. The gear assembler is included.','Red science leaves the top-left output. Connect that belt to your labs and connect electricity.','Basic assembling machines replace the source’s faster machines. No modules, robots, or advanced belts are needed.']},
 {id:'green-science',name:'Green science with belts and inserters',category:'04 · Research',kind:'production',order:11,requires:['automation','logistics','fast-inserter','logistic-science-pack'],products:['logistic-science-pack'],notes:['Feed green circuits into top entrance A and iron plates into top-right entrance B. Use the green-circuit build upstream.','Gears, belts, and inserters are made inside. Green science leaves the top-left output; connect it to your labs.','Connect electricity. All assemblers are basic tier 1; the original source’s nominal production rate does not apply.']},
 {id:'split-1-2',name:'Split one yellow belt into two',category:'05 · Simple belt helpers',kind:'routing',order:12,requires:['logistics'],notes:['Input from the bottom, outputs at the top. Both item types and belt lanes are preserved.','No power required. This splits an existing item stream; it does not manufacture belts.']},
 {id:'balance-2-2',name:'Two-belt yellow balancer',category:'05 · Simple belt helpers',kind:'routing',order:13,requires:['logistics'],notes:['Input from the two bottom belts and collect from the two top belts.','No power required. Tested for delivery through both outputs; this is not a maximum-throughput certification.']},
 {id:'balance-4-4',name:'Four-belt yellow balancer',category:'05 · Simple belt helpers',kind:'routing',order:14,requires:['logistics'],notes:['Input from the four bottom belts and collect from the four top belts.','Uses only yellow belts, yellow underground belts, and splitters. No electricity or robots are needed.','Tested for delivery through every output; maximum throughput and blocked-output behavior are not certified.']},
];
for(const spec of specs){
 const source=originals.find(s=>s.id===(spec.source||spec.id));
 const b=decodeBlueprint(await fs.readFile(root+'/originals/'+source.normalizedFile,'utf8')).blueprint;
 const changes=['Migrated the original blueprint through Factorio 2.0.77.'];
 if(b.entities.some(e=>e.name==='small-lamp'||e.name==='constant-combinator'))changes.push('Removed optional lamps and recipe-label combinators; connection labels are shown in the website preview.');
 if(b.entities.some(e=>e.name==='assembling-machine-2'))changes.push('Replaced assembling machine 2 with assembling machine 1 for a cheaper start; throughput is lower.');
 if(b.entities.some(e=>e.name==='infinity-chest'))changes.push('Replaced editor-only output chests with ordinary wooden chests.');
 if(b.entities.some(e=>e.name==='iron-chest'))changes.push('Replaced iron output chests with wooden chests.');
 b.entities=b.entities.filter(e=>!['small-lamp','constant-combinator'].includes(e.name));
 for(const e of b.entities){
  if(e.name==='assembling-machine-2')e.name='assembling-machine-1';
  if(['infinity-chest','iron-chest'].includes(e.name)){e.name='wooden-chest';e.bar=1;delete e.infinity_settings;}
  if(spec.id==='steam'&&e.name==='inserter')e.name='burner-inserter';
  if(e.name==='stone-furnace')e.tags={...e.tags,production_recipe:spec.id==='steel'?(e.position.x<0?'iron-plate':'steel-plate'):spec.products[0]};
 }
 if(spec.id.startsWith('smelting-')){
  b.entities=b.entities.filter(e=>e.position.x<=-2.5);
  changes.push('Shortened the original 24-furnace line to eight furnaces for a compact, inexpensive start.');
 }
 if(spec.id==='steel'){
  b.entities=b.entities.filter(e=>e.position.x<=-24||e.position.x>=-8||(e.name==='small-electric-pole'&&e.position.x===-8.5));
  for(const e of b.entities)if(e.position.x<=-24)e.position.x+=16;
  b.entities=b.entities.filter(e=>e.position.x<=10.5);
  b.wires.push([271,5,298,5]);
  changes.push('Shortened both furnace banks from 24 to eight furnaces each and reconnected the shortened power grid.');
 }
 if(spec.id==='steam')changes.push('Used burner inserters so coal feeding can start before the grid has power.');
 let next=Math.max(...b.entities.map(e=>e.entity_number))+1;
 if(spec.id==='mining'){
  const bridge=next++;b.entities.push({entity_number:bridge,name:'small-electric-pole',position:{x:-11.5,y:.5}});
  b.wires||=[];b.wires.push([bridge,5,1,5],[bridge,5,40,5]);
  changes.push('Joined the two drill rows with one small pole so a single grid connection powers every drill.');
 }
 if(spec.id==='circuits'){
  const bridge=next++;b.entities.push({entity_number:bridge,name:'small-electric-pole',position:{x:.5,y:-6.5}});
  b.wires||=[];b.wires.push([bridge,5,3,5],[bridge,5,11,5]);
  changes.push('Joined the original left and right power networks with one small pole so a single grid connection powers the whole build.');
 }
 const ports=[];
 const port=(kind,label,x,y,direction,items,type='transport-belt')=>{
  let entity=b.entities.find(e=>e.position.x===x&&e.position.y===y);
  if(!entity){entity={entity_number:next++,name:type,position:{x,y},direction};b.entities.push(entity);}
  if(entity.name!==type)throw Error(spec.id+' port collision '+label);
  ports.push({kind,label,entity:entity.entity_number,items:items||[]});return entity;
 };
 const existingPort=(kind,label,id,items)=>{if(!b.entities.some(e=>e.entity_number===id))throw Error('Missing port '+id);ports.push({kind,label,entity:id,items});};
 if(spec.id==='steam'){
  existingPort('input','A · Coal',36,['coal']);
  port('fluid','B · Water',11.5,-.5,0,['water'],'pipe');port('fluid','C · Water',15.5,-.5,0,['water'],'pipe');
 }else if(spec.id==='mining')port('output','OUT · Ore',11.5,.5,4,['iron-ore']);
 else if(spec.id.startsWith('smelting-')||spec.id==='steel'){
  const x=spec.id==='steel'?-12.5:-15.5;
  port('input','A · Coal',x,-.5,4,['coal']);port('input','B · '+(spec.input||'iron-ore'),x,1.5,4,[spec.input||'iron-ore']);
  existingPort('output','OUT · '+spec.products[0],spec.id==='steel'?212:76,spec.products);
 }else if(spec.id==='circuits'){
  port('input','A · Copper',-12.5,5.5,0,['copper-plate']);port('input','B · Copper',12.5,5.5,0,['copper-plate']);
  port('input','C · Iron',-1.5,7.5,0,['iron-plate']);port('input','D · Iron',1.5,7.5,0,['iron-plate']);
  port('output','OUT · Circuits',-.5,7.5,8,spec.products);port('output','OUT · Circuits',.5,7.5,8,spec.products);
 }else if(spec.id==='belts-inserters'){
  existingPort('input','A · Iron',22,['iron-plate']);existingPort('input','B · Copper',78,['copper-plate']);
  existingPort('output','OUT · Belts',10,['transport-belt']);existingPort('output','OUT · Inserters',31,['inserter']);
 }else if(spec.id==='starter-mall'){
  existingPort('input','A · Iron',50,['iron-plate']);existingPort('input','B · Copper',207,['copper-plate']);
  for(const [id,item]of [[25,'assembling-machine-1'],[175,'fast-inserter'],[181,'inserter'],[188,'underground-belt'],[189,'long-handed-inserter'],[194,'transport-belt'],[201,'splitter']])existingPort('output','OUT · '+item,id,[item]);
 }else if(spec.id==='red-science'){
  port('input','A · Copper',6.5,-6.5,8,['copper-plate']);port('input','B · Iron',9.5,-6.5,8,['iron-plate']);
  port('output','OUT · Red science',-9.5,-6.5,0,spec.products);
 }else if(spec.id==='green-science'){
  port('input','A · Circuits',2.5,-10.5,8,['electronic-circuit']);port('input','B · Iron',7.5,-10.5,8,['iron-plate']);
  port('output','OUT · Green science',-3.5,-10.5,0,spec.products);
 }else{
  const n=spec.id==='balance-4-4'?4:2,y=n===4?4.5:1.5;
  const starts=b.entities.filter(e=>e.name==='transport-belt'&&e.position.y===y);
  const ends=b.entities.filter(e=>e.name==='transport-belt'&&e.position.y===(n===4?-4.5:-.5));
  starts.forEach((e,i)=>existingPort('input','IN '+(i+1),e.entity_number,['iron-plate']));ends.forEach((e,i)=>existingPort('output','OUT '+(i+1),e.entity_number,['iron-plate']));
 }
 // Recenter with integer translation so all entity grid alignments are retained.
 const dx=Math.round((Math.min(...b.entities.map(e=>e.position.x))+Math.max(...b.entities.map(e=>e.position.x)))/2);
 const dy=Math.round((Math.min(...b.entities.map(e=>e.position.y))+Math.max(...b.entities.map(e=>e.position.y)))/2);
 for(const e of b.entities){e.position={x:e.position.x-dx,y:e.position.y-dy};e.tags={...e.tags,starter_entity:e.entity_number};}
 for(const p of ports){const e=b.entities.find(e=>e.entity_number===p.entity);Object.assign(p,{x:e.position.x,y:e.position.y,direction:e.direction||0});}
 delete b.tiles;delete b.schedules;
 if(b.wires){const ids=new Set(b.entities.map(e=>e.entity_number));b.wires=b.wires.filter(w=>ids.has(w[0])&&ids.has(w[2]));}
 b.label=spec.name;b.description=[`Adapted from ${source.author}: ${source.sourceURL}`,...spec.notes,...changes].join('\n');
 const id='early-'+spec.id,file=id+'.txt';await fs.writeFile(root+'/'+file,encodeBlueprint({blueprint:b})+'\n');
 manifest.push({id,file,name:spec.name,sourceId:source.id,author:source.id==='steam'?'Nilaus · book curated by '+source.author:source.author,sourceURL:source.sourceURL,sourceTitle:source.sourceTitle,category:spec.category,kind:spec.kind,order:spec.order,requires:spec.requires,products:spec.products||[],setupNotes:spec.notes,changes,ports,resource:spec.kind==='mining'?'iron-ore':undefined});
}
await fs.writeFile(root+'/community-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared '+manifest.length+' affordable starter layouts; native validation is required before indexing.');
