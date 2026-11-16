import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildWorkshopGuides,exactNativeEvidence,groupPorts,nominalDemand,recipeUnlocks} from '../scripts/workshop-guides.mjs';
import {encodeBlueprint,decodeBlueprint} from '../scripts/blueprints.mjs';
const root=new URL('../',import.meta.url),sha=s=>createHash('sha256').update(s).digest('hex');
const load=async f=>JSON.parse(await fs.readFile(new URL(f,root),'utf8'));
const prototypeSha256='a'.repeat(64),code='exact code';
const m={id:'fixture',products:['inserter','bulk-inserter'],targets:{inserter:15,'bulk-inserter':5},blueprintSha256:sha(code),prototypeSha256,status:'tested'};
const result={id:m.id,blueprintSha256:m.blueprintSha256,passed:true,outputsPerMinute:{inserter:15,'bulk-inserter':5},recovery:{outputsPerMinute:{inserter:15,'bulk-inserter':5}}};
const report={passed:true,prototypeSha256,builds:[result]};
test('native label requires exact code, passing result, complete product/recovery evidence and prototype',()=>{
 assert.equal(exactNativeEvidence(m,' '+code+'\n',report).passed,true);
 const reject=(manifest,r,c=code)=>assert.equal(exactNativeEvidence(manifest,c,r).passed,false);
 reject(m,null);reject(m,report,code+'changed');reject({...m,blueprintSha256:'0'.repeat(64)},report);reject({...m,prototypeSha256:undefined},{builds:[result]});
 for(const patch of [{prototypeSha256:'b'.repeat(64)},{short:true},{passed:false},{passed:undefined}])reject(m,{...report,...patch});
 reject(m,{...report,builds:[{...result,outputsPerMinute:{inserter:14.24,'bulk-inserter':5}}]});
 reject(m,{...report,builds:[{...result,recovery:{outputsPerMinute:{inserter:15,'bulk-inserter':4.74}}}]});
 assert.equal(exactNativeEvidence(m,code,{...report,builds:[{...result,outputsPerMinute:{inserter:14.25,'bulk-inserter':4.75},recovery:{outputsPerMinute:{inserter:14.25,'bulk-inserter':4.75}}}]}).passed,true);
 for(const patch of [{id:'sibling'},{blueprintSha256:'b'.repeat(64)},{prototypeSha256:'b'.repeat(64)},{passed:false},{short:true},{outputsPerMinute:{inserter:15}},{recovery:{outputsPerMinute:{inserter:15}}},{outputsPerMinute:{inserter:NaN,'bulk-inserter':5}}])reject(m,{...report,builds:[{...result,...patch}]});
});
test('five robot products share one physical receiver marker with all product identities',()=>{
 const products=['construction-robot','logistic-robot','roboport','storage-chest','passive-provider-chest'];
 const ports=groupPorts([{kind:'input',entity:1,item:'iron-plate'},...products.map(item=>({kind:'output',entity:99,item})),{kind:'power',entity:100}]);
 assert.equal(ports.length,3);assert.equal(ports[1].marker,'2');assert.deepEqual(ports[1].items,products);assert.equal(ports[1].products.length,5);assert.equal(ports[2].marker,'P');
});
test('exact recipe recursion computes declared nominal targets without inferred science gates',async()=>{
 const model=await load('blueprint-sources/workshop-preview-model.json');
 const robot={products:['construction-robot','logistic-robot','roboport','storage-chest','passive-provider-chest'],targets:{'construction-robot':10,'logistic-robot':10,roboport:1,'storage-chest':5,'passive-provider-chest':5},inputs:['iron-plate','copper-plate','steel-plate','plastic-bar'].map(item=>({item})),fluids:['sulfuric-acid','lubricant'].map(item=>({item}))};
 assert.deepEqual(nominalDemand(robot,model),{'steel-plate':165,'iron-plate':510,lubricant:300,'copper-plate':640,'sulfuric-acid':800,'plastic-bar':150});
 const inserter={products:['inserter','long-handed-inserter','fast-inserter','bulk-inserter'],targets:{inserter:15,'long-handed-inserter':15,'fast-inserter':15,'bulk-inserter':5},inputs:['iron-plate','copper-plate','plastic-bar'].map(item=>({item}))};
 assert.deepEqual(nominalDemand(inserter,model),{'iron-plate':560,'copper-plate':272.5,'plastic-bar':10});
 assert.deepEqual(nominalDemand({...inserter,targets:{...inserter.targets,'bulk-inserter':2.5}},model),{'iron-plate':422.5,'copper-plate':192.5,'plastic-bar':5});
 assert.deepEqual(nominalDemand({...inserter,targets:Object.fromEntries(Object.entries(inserter.targets).map(([id,n])=>[id,n*2]))},model),{'iron-plate':1120,'copper-plate':545,'plastic-bar':20});
 const bp={entities:[{recipe:'bulk-inserter'},{recipe:'copper-cable'},{recipe:'bulk-inserter'}]};
 assert.deepEqual(recipeUnlocks(bp,model).map(r=>r.recipe),['bulk-inserter','copper-cable']);assert(recipeUnlocks(bp,model)[0].technologies.includes('bulk-inserter'));assert.throws(()=>recipeUnlocks({entities:[{recipe:'absent'}]},model));
});
test('generator builds from a relocated root without game install or network, preserving exact geometry and offline assets',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'workshop-guide-test-'));
 try{
 await fs.mkdir(path.join(temp,'site/data'),{recursive:true});await fs.mkdir(path.join(temp,'blueprint-sources'),{recursive:true});
 await fs.copyFile(new URL('site/data/catalog.json',root),path.join(temp,'site/data/catalog.json'));
 await fs.cp(new URL('site/assets/icons/',root),path.join(temp,'site/assets/icons'),{recursive:true});
 const model=await load('blueprint-sources/workshop-preview-model.json');await fs.writeFile(path.join(temp,'blueprint-sources/workshop-preview-model.json'),JSON.stringify(model));
 const id='robot-logistics-workshop',source=path.join(temp,'blueprint-sources',id);await fs.mkdir(source);
 const products=['construction-robot','logistic-robot','roboport','storage-chest','passive-provider-chest'];
 const bp={entities:[{entity_number:1,name:'assembling-machine-2',recipe:'construction-robot',position:{x:1.5,y:1.5}},{entity_number:2,name:'passive-provider-chest',position:{x:5.5,y:1.5}},{entity_number:3,name:'substation',position:{x:1,y:5}},{entity_number:4,name:'display-panel',position:{x:5.5,y:-.5}}],wires:[[2,1,3,1]]};
 const text=encodeBlueprint({blueprint:bp}),manifest={id,name:'Fixture robot workshop',file:id+'.txt',blueprintSha256:sha(text),prototypeSha256:model.prototypeSha256,products,targets:Object.fromEntries(products.map(p=>[p,1])),inputs:['iron-plate','copper-plate','steel-plate','plastic-bar','sulfuric-acid','lubricant'].map(item=>({item})),outputs:products.map(item=>({kind:'output',item,entity:2,cap:10})),ports:products.map(item=>({kind:'output',item,entity:2})),construction:{'assembling-machine-2':1,'passive-provider-chest':1,substation:1,'display-panel':1},footprint:{left:0,top:-1,right:6,bottom:6,width:6,height:7},outputCaps:{'construction-robot':23}};
 await fs.writeFile(path.join(source,manifest.file),text);await fs.writeFile(path.join(source,'manifest.json'),JSON.stringify([manifest]));
 const built=await buildWorkshopGuides({root:temp,rawPath:null});assert.equal(built.built.length,1);assert.deepEqual(built.skipped,['inserter-workshop']);assert.equal(built.built[0].evidence.passed,false);
 const out=path.join(temp,'site',id),svg=await fs.readFile(path.join(out,'layout.svg'),'utf8'),html=await fs.readFile(path.join(out,'index.html'),'utf8');
 assert.equal((svg.match(/data-port-entity="2"/g)||[]).length,1);assert(svg.includes('data:image/png;base64,'));assert(!/(?:href|src)="(?:https?:|\.\.\/)/.test(svg));assert(svg.includes('x="0" y="0" width="3" height="3"'));assert(svg.includes('class="wire"'));
 assert(html.includes('data-page="robot-logistics-workshop"'));assert(html.includes('Native proof pending'));assert(!html.includes('Native production tested'));assert(html.includes('Insert the manufactured'));assert(html.includes('independent per-product caps'));assert(html.includes('<td>23</td>'));assert(html.includes("location.protocol==='file:'"));assert(!html.includes('/Users/'));assert.equal((await fs.readFile(path.join(out,manifest.file),'utf8')).trim(),text);
 manifest.blueprintSha256='0'.repeat(64);await fs.writeFile(path.join(source,'manifest.json'),JSON.stringify([manifest]));await assert.rejects(buildWorkshopGuides({root:temp,rawPath:null}),/SHA mismatch/);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
