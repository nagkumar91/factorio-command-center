// Test the user's unchanged import and the website's crate Lua in a disposable save.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {decodeBlueprint,blueprintMaterials} from '../scripts/blueprints.mjs';
import {generateCrateCommand} from '../scripts/packer.mjs';
const runFile=promisify(execFile),root=path.resolve('.cache/fusion-reactor-test'),mods=path.join(root,'mods'),mod=path.join(mods,'fusion_blueprint_test');
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const code=(await fs.readFile('power/fusion_reactor_1_2gw.txt','utf8')).trim();
const object=decodeBlueprint(code),b=object.blueprint,catalog=JSON.parse(await fs.readFile('site/data/catalog.json','utf8'));
const materials=blueprintMaterials(object,catalog);
const crate=generateCrateCommand(materials.entries,catalog,'passive-provider-chest');
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n`);
await fs.writeFile(path.join(mods,'mod-list.json'),JSON.stringify({mods:['base','quality','elevated-rails','space-age','fusion_blueprint_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'fusion_blueprint_test',version:'1.0.0',title:'Isolated fusion blueprint test',author:'local',factorio_version:'2.0',dependencies:['base >= 2.0.77','space-age']}));
await fs.writeFile(path.join(mod,'data.lua'),`local load=table.deepcopy(data.raw['electric-energy-interface']['electric-energy-interface'])
load.name='fusion-test-load'
load.energy_source={type='electric',buffer_capacity='1GJ',usage_priority='secondary-input',input_flow_limit='1100MW',output_flow_limit='0W'}
load.energy_production='0W';load.energy_usage='1100MW'
data:extend{load}
`);
await fs.writeFile(path.join(mod,'control.lua'),`
local d=helpers.json_to_table([==[${JSON.stringify(b.entities)}]==])
local function check(ok,msg)if not ok then error('FUSION_TEST: '..msg)end end
script.on_init(function()
 local f=game.forces.player;f.research_all_technologies()
 local s=game.create_surface('fusion-test',{width=256,height=256,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
 s.request_to_generate_chunks({0,0},4);s.force_generate_chunk_requests()
 for _,e in pairs(s.find_entities())do e.destroy()end
 local tiles={};for x=-100,100 do for y=-100,100 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
 local test_player={surface=s,force=f,position={x=-70,y=-70},print=function(msg)log(msg)end}
 do local run=function() ${crate.replace(/^\/c\s*/,'').replaceAll('game.player','test_player')} end;run()end
 local crates=s.find_entities_filtered{name='passive-provider-chest'};check(#crates==1,'Construction crate count')
 ${materials.entries.map(r=>`check(crates[1].get_item_count{name=${JSON.stringify(r.id)},quality='normal'}==${r.count},'Crate count for ${r.id}')`).join('\n ')}
 check(#crates[1].get_inventory(defines.inventory.chest).get_contents()==8,'Unexpected crate materials')
 log('FUSION_CRATE_PASSED: all 152 normal-quality items in one passive provider')
 crates[1].destroy()
 local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint',count=1};check(inv[1].import_stack(${JSON.stringify(code)})==0,'Import failed')
 local ghosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},force_build=true,skip_fog_of_war=true}
 check(#ghosts==152,'Not all 152 ghosts placed')
 local gx,gy,sx,sy=math.huge,math.huge,math.huge,math.huge
 for _,e in pairs(ghosts)do gx=math.min(gx,e.position.x);gy=math.min(gy,e.position.y)end
 for _,e in pairs(d)do sx=math.min(sx,e.position.x);sy=math.min(sy,e.position.y)end
 for _,g in pairs(ghosts)do local _,e=g.revive{raise_revive=true};check(e~=nil,'Ghost did not revive')end
 storage.entities={};storage.surface=s
 for _,e in pairs(d)do local built=s.find_entity(e.name,{e.position.x+gx-sx,e.position.y+gy-sy});check(built~=nil,'Missing entity '..e.entity_number);storage.entities[e.entity_number]=built;check(built.direction==(e.direction or 0),'Direction mismatch');if e.recipe then check(built.get_recipe().name==e.recipe,'Recipe mismatch')end end
 local poles=s.find_entities_filtered{name='substation'};local p=poles[1].position
 -- Separate test fixtures connect to the original substation wiring.
 local ext=s.create_entity{name='substation',position={x=p.x-28,y=p.y},force=f}
 ext.get_wire_connector(defines.wire_connector_id.pole_copper,true).connect_to(poles[1].get_wire_connector(defines.wire_connector_id.pole_copper,true),false)
 storage.source=s.create_entity{name='electric-energy-interface',position={x=p.x-32,y=p.y},force=f}
 storage.source.power_production=1000000000;storage.source.electric_buffer_size=1000000000
 storage.load=s.create_entity{name='fusion-test-load',position={x=p.x-28,y=p.y-4},force=f}
 storage.generators=s.find_entities_filtered{name='fusion-generator'};storage.reactors=s.find_entities_filtered{name='fusion-reactor'};storage.coolers=s.find_entities_filtered{name='cryogenic-plant'}
 storage.initialFuel=0;for _,e in pairs(s.find_entities_filtered{name='requester-chest'})do storage.initialFuel=storage.initialFuel+e.insert{name='fusion-power-cell',count=5}end
 storage.initialCoolant=0;for _,e in pairs(storage.reactors)do storage.initialCoolant=storage.initialCoolant+e.insert_fluid{name='fluoroketone-cold',amount=1000,temperature=-150}end
 check(storage.initialCoolant==4000,'Initial coolant charge')
 storage.samples={};log('FUSION_IMPORT_PASSED: exact 152-entity import, saved rotations and recipes')
end)
script.on_event(defines.events.on_tick,function()
 if game.tick==1200 then storage.source.destroy();log('FUSION_BOOTSTRAP_REMOVED: external electricity disconnected after 20 seconds')end
 if game.tick>0 and game.tick%3600==0 then
  local cold,hot,plasma=0,0,0
  for _,e in pairs(storage.entities)do
   for i=1,#e.fluidbox do local f=e.fluidbox[i];if f then if f.name=='fluoroketone-cold' then cold=cold+f.amount elseif f.name=='fluoroketone-hot' then hot=hot+f.amount elseif f.name=='fusion-plasma' then plasma=plasma+f.amount end end end
  end
  local crafts={};for _,e in pairs(storage.coolers)do crafts[#crafts+1]=e.products_finished end
  local states={};for _,e in pairs(storage.generators)do local label='unknown';for k,v in pairs(defines.entity_status)do if v==e.status then label=k end end;states[label]=(states[label]or 0)+1 end
  local row={tick=game.tick,loadEnergy=storage.load.energy,cold=cold,hot=hot,plasma=plasma,coolingCrafts=crafts,generatorStates=states}
  storage.samples[#storage.samples+1]=row;log('FUSION_SAMPLE: '..helpers.table_to_json(row))
 end
 if game.tick==36000 then
  local r={entities=152,constructionItems=152,chests=1,initialFuel=storage.initialFuel,initialColdCoolant=storage.initialCoolant,externalPowerSeconds=20,loadMW=1100,simulatedMinutes=10,samples=storage.samples}
  helpers.write_file('fusion-validation.json',helpers.table_to_json(r),false)
  for _,e in pairs(storage.coolers)do check(e.products_finished>0,'Cooler never ran')end
  for _,e in pairs(storage.reactors)do check(e.energy>0,'Reactor lost power')end
  for _,row in pairs(storage.samples)do if row.tick>=7200 then check(row.loadEnergy>1000000,'Load lost power at tick '..row.tick)end end
  log('FUSION_OPERATION_PASSED: 10 minutes with 1100 MW load and a single coolant charge; external power only for startup')
 end
end)
`);
async function run(args,name){
 try{const r=await runFile(path.join(app,'Contents/MacOS/factorio'),['--config',path.join(root,'config.ini'),'--mod-directory',mods,...args],{timeout:180000,maxBuffer:16*1024*1024});await fs.writeFile(path.join(root,name+'.log'),r.stdout+r.stderr);console.log(r.stdout.split('\n').filter(s=>s.includes('FUSION_')).join('\n'));return r.stdout;}
 catch(e){await fs.writeFile(path.join(root,name+'.log'),String(e.stdout)+String(e.stderr));throw new Error(String(e.stdout||e.message).slice(-6000));}
}
const save=path.join(root,'fusion.zip');
assert.match(await run(['--create',save],'create'),/FUSION_IMPORT_PASSED/);
const output=await run(['--benchmark',save,'--benchmark-ticks','36001','--benchmark-runs','1'],'simulation');
assert.match(output,/FUSION_OPERATION_PASSED/);
const result=JSON.parse(await fs.readFile(path.join(root,'script-output/fusion-validation.json'),'utf8'));
for (const sample of result.samples.filter(s=>s.tick>=7200)) {
  assert.ok(sample.loadEnergy >= 1100e6/60*0.999, 'The full 1100 MW load must be supplied');
  assert.equal(sample.generatorStates.working,24);
}
await fs.writeFile('power/fusion_reactor_1_2gw.validation.json',JSON.stringify({blueprintId:createHash('sha256').update(JSON.stringify(object)).digest('hex').slice(0,12),startupTargets:[{id:'fusion-power-cell',count:20},{id:'fluoroketone-cold',count:4000}],setupNote:'Tested for 10 simulated minutes with a 1.1 GW load, 20 fuel cells (5 per requester chest), and 4,000 units of cold coolant charged across the four reactors. External power was disconnected after 20 seconds. Continue replenishing fuel; keep coolant circulating. The 1.2 GW label is retained from the supplied blueprint.',testedAt:new Date().toISOString(),gameVersion:output.match(/Loading mod base ([\d.]+)/)?.[1],blueprintSha256:createHash('sha256').update(code).digest('hex'),...result},null,2)+'\n');
