// ASCII preview of the generated blueprint: node scripts/robot-essentials/preview.mjs [dir]
import fs from 'node:fs/promises';
import {decodeBlueprint} from '../blueprints.mjs';
const dir=process.argv[2]||'blueprint-sources/robot-essentials';
const m=JSON.parse(await fs.readFile(dir+'/manifest.json'))[0];
const bp=decodeBlueprint((await fs.readFile(dir+'/'+m.file,'utf8')).trim()).blueprint;
const grid=new Map(),key=(x,y)=>x+','+y;
const arrows={0:'^',4:'>',8:'v',12:'<'};
const size={'assembling-machine-2':3,'chemical-plant':3,substation:2};
const letter={'battery':'B','steel-chest':'S','copper-cable':'C','advanced-circuit':'A','flying-robot-frame':'F','construction-robot':'R','logistic-robot':'L','storage-chest':'H','electric-engine-unit':'E','iron-gear-wheel':'G',pipe:'P','engine-unit':'N',roboport:'O','passive-provider-chest':'V','requester-chest':'Q'};
for(const e of bp.entities){
 const n=size[e.name]||1;let w=n,h=n;
 if(/combinator/.test(e.name)){w=1;h=2;if([4,12].includes(e.direction))[w,h]=[2,1];}
 const ch=e.recipe?letter[e.recipe]:e.name==='fast-transport-belt'?arrows[e.direction||0]:e.name==='fast-underground-belt'?(e.type==='input'?'u':'U'):e.name==='fast-inserter'?'i':e.name==='bulk-inserter'?'b':e.name==='long-handed-inserter'?'l':e.name==='pipe'?'=':e.name==='pipe-to-ground'?'#':e.name==='substation'?'$':e.name==='display-panel'?'d':e.name==='passive-provider-chest'?'@':/decider/.test(e.name)?'D':/arithmetic/.test(e.name)?'+':/constant/.test(e.name)?'K':'?';
 for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++)grid.set(key(x,y),ch);
}
const f=m.footprint;
for(let y=f.top;y<f.bottom;y++){let s=String(y).padStart(3)+' ';for(let x=f.left;x<f.right;x++)s+=grid.get(key(x,y))||'.';console.log(s);}
console.log(`${f.width} x ${f.height} = ${f.width*f.height} tiles`);
