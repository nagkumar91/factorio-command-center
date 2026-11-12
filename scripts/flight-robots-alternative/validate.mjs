import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../blueprints.mjs';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const source=path.resolve(process.env.ROBOT_SOURCE||path.join(root,'.cache/flight-robots-alternative/candidate'));
const raw=JSON.parse(await fs.readFile(path.join(root,'.cache/flight-21/script-output/data-raw-dump.json')));
for(const m of JSON.parse(await fs.readFile(path.join(source,'manifest.json')))){
 const code=(await fs.readFile(path.join(source,m.file),'utf8')).trim(),bp=decodeBlueprint(code).blueprint;
 assert.equal(createHash('sha256').update(code).digest('hex'),m.blueprintSha256);
 assert.deepEqual(m.inputs.map(p=>p.item).sort(),['copper-plate','iron-plate','plastic-bar','steel-plate']);
 assert.deepEqual(m.fluids.map(p=>p.item).sort(),['lubricant','sulfuric-acid']);
 assert.equal(m.machineCounts.battery,3);assert.equal(new Set(m.outputs.map(p=>p.entity)).size,1);assert.equal(m.loopControl.length,2);
 const ids=new Set(bp.entities.map(e=>e.entity_number));assert.equal(ids.size,bp.entities.length);
 for(const e of bp.entities){assert.equal(e.tags.flight_science_entity,e.entity_number);assert(!e.items?.length);}
 for(const [a,,b]of bp.wires){assert(ids.has(a));assert(ids.has(b));}
 for(const l of m.loopControl)for(const id of [...l.controlled,...l.loop,l.reader])assert(ids.has(id));
 const boundary=new Set([...m.inputs,...m.fluids].map(p=>p.item)),required={};
 function expand(item,n){if(boundary.has(item)){required[item]=(required[item]||0)+n;return;}
  const r=raw.recipe[item],yieldAmount=r.results.find(p=>p.name===item).amount;
  for(const i of r.ingredients)expand(i.name,n*i.amount/yieldAmount);
 }
 for(const [item,n]of Object.entries(m.targets))expand(item,n);
 for(const p of [...m.inputs,...m.fluids])assert.equal(required[p.item],p.perMinute);
 assert(m.footprint.width<=120&&m.footprint.height<=120);
 console.log(JSON.stringify({id:m.id,sha256:m.blueprintSha256,footprint:m.footprint,required,valid:true}));
}
