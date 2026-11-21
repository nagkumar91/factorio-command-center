import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
// Reads only committed files: runs without the Factorio prototype dump.
const dir='blueprint-sources/early-controlled-loops';
const read=async file=>JSON.parse(await fs.readFile(dir+'/'+file));
const manifest=await read('manifest.json'),report=await read('native-report.json');
const sha=text=>createHash('sha256').update(text.trim()).digest('hex');
const byId=id=>manifest.find(m=>m.id===id);
const ids=['solid-science-complete','science-solid-feeder','science-fast-loop','science-ore-feeder','ore-feeder','science-loop','transport-loop','machines-poles-loop'];
const portShape=m=>m.ports.map(p=>[p.kind,(p.items||[]).join(),p.externalSide||'',!!p.optional]);

test('every design is qualified by an exact-hash passing native case',async()=>{
 assert.deepEqual(manifest.map(m=>m.id),ids);assert.equal(report.passed,true);assert.equal(report.gameVersion,'2.1.24');
 for(const m of manifest){
  assert.equal(sha(await fs.readFile(dir+'/'+m.file,'utf8')),m.blueprintSha256,m.id);
  const cases=report.builds.filter(b=>[m.id,m.id+'-supplemented'].includes(b.id));
  assert.equal(cases.length,m.optionalInputs.length?2:1,m.id);
  for(const b of cases){assert.equal(b.blueprintSha256,m.blueprintSha256,b.id);assert.equal(b.passed,true,b.id);
   for(const [item,floor]of Object.entries(m.minimumPerMinute||{})){assert.ok(b.outputsPerMinute[item]>=floor,b.id+' '+item);assert.ok(b.recovery.outputsPerMinute[item]>=floor,b.id+' recovery '+item);}}
  assert.equal(m.status,m.optionalInputs.length?'native-verified-required-and-supplemented':'native-verified-raw-inputs',m.id);
 }
});

test('complete factory and fast loop keep 36 red / 30 green from the declared inputs',()=>{
 for(const id of ['solid-science-complete','science-fast-loop']){const b=report.builds.find(b=>b.id===id);
  assert.ok(b.outputsPerMinute['automation-science-pack']>=36,id);assert.ok(b.outputsPerMinute['logistic-science-pack']>=30,id);}
 assert.deepEqual(byId('solid-science-complete').inputs.map(p=>p.item),['iron-ore','copper-ore','solid-fuel']);
 assert.deepEqual(byId('science-fast-loop').inputs.map(p=>p.item),['iron-plate','copper-plate','electronic-circuit']);
 assert.deepEqual(byId('science-fast-loop').optionalInputs.map(p=>p.item),['iron-gear-wheel']);
});

test('two-belt entrance stubs: smaller footprints, same interface as the replaced versions',async()=>{
 const expected={'solid-science-complete':[60,17,66],'science-solid-feeder':[27,16,29],'science-fast-loop':[28,17,32],'science-loop':[19,17,23],'machines-poles-loop':[22,17,26]};
 const history=await fs.readdir(dir+'/history');
 for(const [id,[width,height,oldWidth]]of Object.entries(expected)){
  const m=byId(id);assert.deepEqual([m.footprint.width,m.footprint.height],[width,height],id);
  const old=(await Promise.all(history.map(async f=>({f,m:JSON.parse(await fs.readFile(dir+'/history/'+f+'/manifest.json'))[0]})))).find(x=>x.m.id===id);
  assert.ok(old,id+' history');assert.equal(old.f,'four-belt-stubs-'+old.m.blueprintSha256.slice(0,8));
  assert.equal(sha(await fs.readFile(dir+'/history/'+old.f+'/'+old.m.file,'utf8')),old.m.blueprintSha256,id);
  assert.ok((await fs.readFile(dir+'/history/'+old.f+'/NOTE.md','utf8')).trim().length>20,id);
  assert.deepEqual([old.m.footprint.width,old.m.footprint.height],[oldWidth,height],id);
  assert.ok(width*height<=old.m.footprint.width*old.m.footprint.height*.95,id+' at least 5% smaller');
  assert.deepEqual(portShape(m),portShape(old.m),id+' ports');
  assert.deepEqual(m.machineCounts,old.m.machineCounts,id+' machines');
  for(const [name,n]of Object.entries(m.construction))if(name!=='transport-belt'&&name!=='fast-transport-belt')assert.ok(n<=(old.m.construction[name]||0),id+' '+name);
  // Each west entrance is the outermost belt: one belt between it and the inserter column.
  const bp=decodeBlueprint(await fs.readFile(dir+'/'+m.file,'utf8')).blueprint;
  for(const p of m.inputs.filter(p=>p.externalSide==='west')){
   assert.ok(bp.entities.some(e=>e.name.endsWith('transport-belt')&&e.position.x===p.x&&e.position.y===p.y),id+' entrance');
   assert.ok(!bp.entities.some(e=>e.name.endsWith('transport-belt')&&e.position.x===p.x-1&&e.position.y===p.y),id+' stub longer than two belts');
  }
 }
});

test('unchanged designs keep their qualified strings',async()=>{
 const kept={'science-ore-feeder':'2c520ad7dff560a0f11cd898e720b315f80440efdf8815f7cc0c7481235f6920','ore-feeder':'52346531f895b0fdd2d8adbff3ea51bdde98a6c452c61d73df318c7210ae7d47','transport-loop':'d7eb92fb628a2762098d62210d53d2605dddc99c33e23dd0420039ff9fed9a17'};
 for(const [id,hash]of Object.entries(kept))assert.equal(byId(id).blueprintSha256,hash,id);
 // The red belt loop keeps four-belt stubs; two-belt stubs shifted its phase clock and lost fast splitters.
 assert.equal(byId('transport-loop').inputs[0].x,-4.5);
});

test('connected factory books contain the current strings',async()=>{
 const book=decodeBlueprint(await fs.readFile(dir+'/controlled-loops-book.txt','utf8')).blueprint_book;
 assert.equal(book.blueprints.length,8);
 const solid=decodeBlueprint(await fs.readFile(dir+'/fast-science-solid-fuel-book.txt','utf8')).blueprint_book;
 assert.deepEqual(solid.blueprints.map(b=>b.blueprint.label),await Promise.all(['solid-science-complete','science-solid-feeder','science-fast-loop'].map(async id=>decodeBlueprint(await fs.readFile(dir+'/'+byId(id).file,'utf8')).blueprint.label)));
});
