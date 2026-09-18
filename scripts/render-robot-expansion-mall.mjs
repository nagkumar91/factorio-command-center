import fs from 'node:fs/promises';
import sharp from 'sharp';
const bp=JSON.parse(await fs.readFile('mall/robot_expansion_mall.json','utf8')).blueprint;
const d=JSON.parse(await fs.readFile('.cache/robot-expansion-mall/manifest.json','utf8'));
const raw=JSON.parse(await fs.readFile('.cache/factorio/script-output/data-raw-dump.json','utf8'));
const catalog=JSON.parse(await fs.readFile('site/data/catalog.json','utf8'));
const proto=new Map(Object.values(raw).flatMap(Object.values).filter(p=>p.selection_box).map(p=>[p.name,p]));
const items=new Map([...catalog.items,...catalog.fluids].map(p=>[p.id,p]));
const byID=new Map(bp.entities.map(e=>[e.entity_number,e])),icons=new Map();
const color={water:'#64bce7','crude-oil':'#b4a38c','heavy-oil':'#e99050','light-oil':'#e1c663','petroleum-gas':'#c5beda',lubricant:'#9dcf5c','sulfuric-acid':'#eddd70'};
const vectors={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function box(e){let [[a,b],[c,d]]=proto.get(e.name).selection_box;if([4,12].includes(e.direction))[a,b,c,d]=[b,a,d,c];return{x:e.position.x+a,y:e.position.y+b,w:c-a,h:d-b};}
async function render(overview=false){
 const scale=overview?4.6:12,min=overview?-102:-2,maxX=overview?152:102,maxY=overview?152:52,ox=100-min*scale,oy=170-min*scale;
 const X=x=>ox+x*scale,Y=y=>oy+y*scale,H=overview?1540:1040,parts=[];
 const text=(x,y,s,size=16,fill='#dce6df',extra='')=>parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`);
 const rect=(x,y,w,h,fill,stroke='none',extra='')=>parts.push(`<rect x="${X(x)}" y="${Y(y)}" width="${w*scale}" height="${h*scale}" fill="${fill}" stroke="${stroke}" ${extra}/>`);
 const line=(x,y,u,v,stroke,width=1,extra='')=>parts.push(`<line x1="${X(x)}" y1="${Y(y)}" x2="${X(u)}" y2="${Y(v)}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`);
 async function icon(name,x,y,size){const item=items.get(name);if(!item?.icon)return;if(!icons.has(name))icons.set(name,(await fs.readFile('site/'+item.icon)).toString('base64'));parts.push(`<image href="data:image/png;base64,${icons.get(name)}" x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}"/>`);}
 parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="${H}" viewBox="0 0 1800 ${H}"><rect width="1800" height="${H}" fill="#162521"/><g font-family="Arial, sans-serif">`);
 text(48,52,overview?'ROBOT EXTENSION + RAW-INPUT MALL':'ROBOT EXPANSION MALL',30,'#f4cf7c','font-weight="700"');
 text(48,89,overview?'All 25 roboports and 85 big poles preserved · Original 50-tile grid · Full blueprint: 252 × 252 tiles':'98 × 45 tile factory · 66 machines · 13 substations · No belts',20);
 text(48,123,overview?'The highlighted 100 × 50 strip contains the factory. Align the blueprint with the original roboports.':'Iron ore + copper ore + coal + water + crude oil → roboports, both robot types and big electric poles',17,'#a9c5b3');
 parts.push(`<defs><clipPath id="map"><rect x="${X(min)}" y="${Y(min)}" width="${(maxX-min)*scale}" height="${(maxY-min)*scale}"/></clipPath></defs><g clip-path="url(#map)">`);
 if(!overview){for(let x=0;x<=100;x++)line(x,0,x,50,'#2b3c33',.5);for(let y=0;y<=50;y++)line(0,y,100,y,'#2b3c33',.5);}
 for(let x=-100;x<150;x+=50)for(let y=-100;y<150;y+=50)rect(x,y,50,50,'#294b35','#699773','fill-opacity=".12" stroke-dasharray="6 5"');
 if(overview)rect(0,0,100,50,'#baa66a','#f4cf7c','fill-opacity=".15" stroke-width="3"');
 for(const [a,ca,b]of bp.wires)if(ca===5){const p=byID.get(a).position,q=byID.get(b).position;line(p.x,p.y,q.x,q.y,'#cda253',overview?1.2:.85,'opacity=".55"');}
 const plumbing=bp.entities.filter(e=>['pipe','pipe-to-ground'].includes(e.name));
 const at=new Map(plumbing.map(e=>[`${e.position.x},${e.position.y}`,e]));
 if(!overview)for(const e of plumbing.filter(e=>e.name==='pipe-to-ground')){
  const {x,y}=e.position,[dx,dy]=vectors[e.direction||0];
  for(let n=2;n<=10;n++){const f=at.get(`${x-dx*n},${y-dy*n}`);if(f?.name==='pipe-to-ground'&&f.direction===((e.direction||0)+8)%16){if(e.entity_number<f.entity_number)line(x,y,f.position.x,f.position.y,color[e.tags.mall_fluid],1.2,'opacity=".55" stroke-dasharray="4 4"');break;}}
 }
 for(const c of d.cells){const e=byID.get(c.machine),b=box(e);rect(b.x,b.y,b.w,b.h,c.final?'#536c3b':'#3b473b',c.final?'#f1d180':'#8d9f81','rx="3"');if(!overview)await icon(raw.recipe[c.recipe].results[0].name,X(e.position.x),Y(e.position.y),Math.min(b.w*scale-5,33));}
 for(const e of bp.entities.filter(e=>e.name==='stack-inserter')){const p=e.position,[dx,dy]=vectors[e.direction||0];line(p.x+dx*.8,p.y+dy*.8,p.x-dx*.8,p.y-dy*.8,'#f0d58e',overview?.8:2);rect(p.x-.18,p.y-.18,.36,.36,'#fff0c0');}
 for(const e of bp.entities.filter(e=>['passive-provider-chest','requester-chest'].includes(e.name))){const p=e.position,final=e.tags?.mall_role==='output',supply=e.tags?.mall_input;rect(p.x-.43,p.y-.43,.86,.86,final?'#f3cf70':supply?'#aecd78':e.name==='requester-chest'?'#70bce2':'#c87874',final?'#fff3b9':'#d4e4d0');}
 for(const e of plumbing){const {x,y}=e.position,fill=color[e.tags.mall_fluid];parts.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="${overview?1.1:2.7}" fill="${fill}"/>`);if(!overview)for(const face of e.name==='pipe-to-ground'?[e.direction||0]:[0,4,8,12]){const [dx,dy]=vectors[face],f=at.get(`${x+dx},${y+dy}`);if(f?.tags.mall_net===e.tags.mall_net)line(x,y,x+dx,y+dy,fill,2);}}
 for(const e of bp.entities.filter(e=>['substation','big-electric-pole','roboport','pump','storage-tank'].includes(e.name))){const b=box(e),port=e.name==='roboport',sub=e.name==='substation';rect(b.x,b.y,b.w,b.h,port?'#265b75':sub?'#35576b':'#364f43',port?'#89dced':sub?'#aacffa':'#c9a35c','rx="2"');if(!overview||port)await icon(e.tags.mall_fluid||e.name,X(e.position.x),Y(e.position.y),Math.min(b.w*scale-2,36));}
 parts.push('</g>');
 for(let n=overview?-100:0;n<=(overview?150:100);n+=50)text(X(n),158,n,12,'#a5bead','text-anchor="middle"');
 for(let n=overview?-100:0;n<=(overview?150:50);n+=50)text(87,Y(n)+4,n,12,'#a5bead','text-anchor="end"');
 if(!overview){
  for(const [item,x]of [['iron-ore',39.5],['copper-ore',47.5],['coal',53.5]])text(X(x),Y(27),items.get(item).name,12,'#d6e6c9','text-anchor="middle"');
  for(const input of d.fluidInputs)text(X(input.x+.5),Y(input.y)-25,items.get(input.fluid).name,12,color[input.fluid],input.fluid==='water'?'text-anchor="end"':'');
  text(X(25),Y(30.5),'STARTER ROBOTS',12,'#9fdcea','text-anchor="middle"');
 }
 const side=1400;
 text(side,194,overview?'PRESERVED INFRASTRUCTURE':'FOUR FINISHED OUTPUTS',18,'#f4cf7c','font-weight="700"');
 if(overview){
  for(const [i,t]of ['25 original roboports','85 original big electric poles','Original 50-tile snapping','13 new substations','All chests in one robot network','','Factory: 98 × 45 tiles','Fits two adjacent grid cells','Full import: 252 × 252 tiles'].entries())text(side,238+i*32,t,17);
  text(side,612,'HOW TO START',18,'#f4cf7c','font-weight="700"');
  for(const [i,t]of ['Supply the three marked solids.','Connect water, crude oil and power.','Seed the two nearby roboports','with 200 logistic robots total.','','The factory makes every intermediate.','Finished robots are stocked in chests.'].entries())text(side,654+i*30,t,16);
 }else{
  for(const [i,[name,target]]of Object.entries(d.outputs).entries()){await icon(name,side+17,237+i*51,33);text(side+45,233+i*51,items.get(name).name,17);text(side+45,253+i*51,`Stock target: ${target}`,13,'#adc4b4');}
  text(side,478,'SOLID MATERIAL FLOW',18,'#f4cf7c','font-weight="700"');
  for(const [i,t]of ['Provider chest → logistic robot','→ requester chest → inserter','→ machine → provider chest'].entries())text(side,514+i*28,t,16);
  text(side,628,'COLOR KEY',18,'#f4cf7c','font-weight="700"');
  for(const [i,t,c]of [[0,'Blue chests: ingredient requests','#83c6e7'],[1,'Red chests: internal supplies','#dc9e99'],[2,'Gold chests: finished outputs','#f4cf7c'],[3,'Blue structures: roboports / substations','#abd8f1']])text(side,665+i*29,t,15,c);
  text(48,879,'STARTUP: add 200 logistic robots to the two nearby roboports. All five raw inputs and electricity must be supplied.',18);
  text(48,914,'Heavy oil → lubricant + surplus cracking. Light oil → petroleum. Every intermediate is made inside the mall.',17,'#bad1c1');
 }
 text(48,H-56,'Exact blueprint positions. The complete original 5 × 5 extension is included. Place in an empty matching bay.',17);
 text(48,H-22,'Normal-quality ingredients and equipment. Factorio 2.0 + Space Age. Construction materials and starter robots are separate from operating inputs.',15,'#9fbaaa');
 parts.push('</g></svg>');
 const svg=parts.join(''),file='mall/robot_expansion_mall'+(overview?'.overview':'');
 await fs.writeFile(file+'.svg',svg);await sharp(Buffer.from(svg)).png().toFile(file+'.png');
}
await render();await render(true);
console.log('Rendered robot mall close-up and complete extension overview.');
