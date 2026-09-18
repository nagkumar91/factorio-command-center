import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const runFile=promisify(execFile),root=path.resolve('.cache/recipe-cell-test'),mods=path.join(root,'mods'),mod=path.join(mods,'recipe_cell_test');
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const cells=JSON.parse(await fs.readFile('blueprint-sources/generated/manifest.json','utf8'));
for(const c of cells){c.code=(await fs.readFile('blueprint-sources/generated/'+c.file,'utf8')).trim();c.entities=decodeBlueprint(c.code).blueprint.entities;c.blueprintSha256=createHash('sha256').update(c.code).digest('hex');}
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n`);
await fs.writeFile(path.join(mods,'mod-list.json'),JSON.stringify({mods:['base','quality','elevated-rails','space-age','recipe_cell_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'recipe_cell_test',version:'1.0.0',title:'Recipe cell native validation',author:'local',factorio_version:'2.0',dependencies:['base >= 2.0.77','space-age']}));
await fs.writeFile(path.join(mod,'control.lua'),`
local cells=helpers.json_to_table([==[${JSON.stringify(cells)}]==])
local function check(ok,msg)if not ok then error('CELL_TEST: '..msg)end end
local function refill(c,t)
 if c.platform then for line=1,2 do t.feed.get_transport_line(line).insert_at_back{name=c.ingredients[1].id,count=1}end
 else for _,i in pairs(c.ingredients)do local have=t.feed.get_item_count(i.id);if have<i.count*3 then t.feed.insert{name=i.id,count=i.count*3-have}end end end
end
script.on_init(function()
 local f=game.forces.player;f.research_all_technologies();f.worker_robots_speed_modifier=1;f.worker_robots_storage_bonus=2
 storage.cells={}
 for _,c in pairs(cells)do
  local s
  if c.platform then local platform=f.create_space_platform{name=c.id,planet='nauvis',starter_pack='space-platform-starter-pack'};platform.apply_starter_pack();s=platform.surface
  else s=game.create_surface(c.id,{width=64,height=64,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}}) end
  for _,v in pairs(c.conditions)do s.set_property(v.property,v.min or v.max)end
  s.request_to_generate_chunks({0,0},1);s.force_generate_chunk_requests();for _,e in pairs(s.find_entities())do if e.name~='space-platform-hub' then e.destroy()end end
  local tiles={};for x=-24,24 do for y=-24,24 do tiles[#tiles+1]={name=c.platform and 'space-platform-foundation' or 'grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint',count=1};check(inv[1].import_stack(c.code)==0,c.id..' import')
  local ghosts=inv[1].build_blueprint{surface=s,force=f,position={0,c.platform and -12 or 0},build_mode=defines.build_mode.forced,skip_fog_of_war=false}
  if #ghosts==0 then log('CELL_DEBUG: '..c.id..' platform='..tostring(s.platform~=nil)..' tile='..s.get_tile(0,-12).name..' entities='..#s.find_entities());for _,e in pairs(c.entities)do log(e.name..' can='..tostring(s.can_place_entity{name=e.name,position={e.position.x,e.position.y-12},direction=e.direction or 0}))end end
  check(#ghosts==#c.entities,c.id..' placement '..#ghosts..'/'..#c.entities)
  local t={entities={},produced=0};storage.cells[c.id]=t
  for _,g in pairs(ghosts)do local id=g.tags.cell_entity;local _,e=g.revive{raise_revive=true};check(e~=nil,c.id..' revive '..id);t.entities[id]=e end
  t.machine=t.entities[c.machineID];t.output=t.entities[c.outputID];t.input=t.entities[c.inputID]
  local m=c.entities[c.machineID];local dx=t.machine.position.x-m.position.x;local dy=t.machine.position.y-m.position.y
  for _,e in pairs(c.entities)do local built=t.entities[e.entity_number];check(built.position.x==e.position.x+dx and built.position.y==e.position.y+dy,c.id..' shifted entity');check(built.direction==(e.direction or 0),c.id..' direction');if e.recipe then check(built.get_recipe() and built.get_recipe().name==e.recipe,c.id..' saved recipe')end end
  local source=s.create_entity{name='electric-energy-interface',position={x=-8+dx,y=9+dy},force=f};check(source~=nil,c.id..' power fixture');source.power_production=1000000000;source.electric_buffer_size=1000000000
  for _,p in pairs(c.ports)do local e=s.create_entity{name='infinity-pipe',position={p.x+dx,p.y+dy},force=f};check(e~=nil,c.id..' fluid fixture');e.set_infinity_pipe_filter{name=p.fluid,percentage=p.type=='input' and 1 or 0,mode=p.type=='input' and 'at-least' or 'at-most',temperature=p.temperature}end
  if c.platform then t.feed=t.input else t.feed=s.create_entity{name='passive-provider-chest',position={-8.5+dx,1.5+dy},force=f}end
  refill(c,t);inv.destroy()
 end
 log('CELLS_IMPORTED: '..#cells)
end)
script.on_nth_tick(60,function()
 for _,c in pairs(cells)do
  local t=storage.cells[c.id];refill(c,t)
  if game.tick==600 then
   for _,e in pairs(t.entities)do if e.type=='inserter' or e.type=='roboport' or (e.type=='assembling-machine' and not e.burner) or e.type=='furnace' then check(e.energy>0,c.id..' unpowered '..e.name)end end
   if not c.platform then
    check(t.machine.products_finished==0,c.id..' produced without robots')
    local port=t.entities[c.roboportID];check(port.logistic_network and t.input.logistic_network==port.logistic_network and t.output.logistic_network==port.logistic_network and t.feed.logistic_network==port.logistic_network,c.id..' network coverage')
    check(port.get_inventory(defines.inventory.roboport_robot).insert{name='logistic-robot',count=10}==10,c.id..' startup robots')
   end
  end
  if c.platform then for line=1,2 do local belt=t.output.get_transport_line(line);t.produced=t.produced+belt.get_item_count(c.product);belt.clear()end else t.produced=math.max(t.produced,t.output.get_item_count(c.product))end
 end
 if game.tick==18000 then
  local report={gameVersion=script.active_mods.base,simulatedMinutes=5,cells={}}
  for _,c in pairs(cells)do local t=storage.cells[c.id];local status='unknown';for k,v in pairs(defines.entity_status)do if v==t.machine.status then status=k end end
   local r={id=c.id,blueprintSha256=c.blueprintSha256,produced=t.produced,crafts=t.machine.products_finished,passed=t.produced>0,finalStatus=status,routing=c.platform and 'belt-inserter' or 'robot-requester-inserter',input=not c.platform and t.input.get_inventory(defines.inventory.chest).get_contents() or {},fluids=t.machine.get_fluid_contents()};report.cells[#report.cells+1]=r
   if not r.passed then log('CELL_FAILED: '..helpers.table_to_json(r))end
  end
  helpers.write_file('cell-validation.json',helpers.table_to_json(report),false);log('CELLS_FINISHED: '..#cells)
 end
end)
`);
async function run(args,name){try{const r=await runFile(path.join(app,'Contents/MacOS/factorio'),['--config',path.join(root,'config.ini'),'--mod-directory',mods,...args],{timeout:240000,maxBuffer:16*1024*1024});await fs.writeFile(path.join(root,name+'.log'),r.stdout+r.stderr);console.log(r.stdout.split('\n').filter(l=>/CELLS_|CELL_FAILED/.test(l)).join('\n'));return r.stdout;}catch(e){await fs.writeFile(path.join(root,name+'.log'),String(e.stdout)+String(e.stderr));throw new Error(String(e.stdout||e.message).slice(-4500));}}
const save=path.join(root,'cells.zip');await run(['--create',save],'create');await run(['--benchmark',save,'--benchmark-ticks','18001','--benchmark-runs','1'],'simulation');
const report=JSON.parse(await fs.readFile(path.join(root,'script-output/cell-validation.json'),'utf8'));
await fs.writeFile('blueprint-sources/generated/validation.json',JSON.stringify(report,null,2)+'\n');
assert.equal(report.cells.length,cells.length);assert.deepEqual(report.cells.filter(c=>!c.passed).map(c=>c.id),[],'All saved cells must deliver their target product');
console.log(`All ${cells.length} cells imported and produced their target using saved transport and connections.`);
