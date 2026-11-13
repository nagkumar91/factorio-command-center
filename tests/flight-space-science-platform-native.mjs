import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const runFile=promisify(execFile);
const project=process.cwd();
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const binary=path.join(app,'Contents/MacOS/factorio');
const root=path.join(project,'.cache/flight-space-science/native',Date.now().toString());
const mod=path.join(root,'mods/space_science_orbit_test');
const code=(await fs.readFile('blueprint-sources/flight-space-science/orbital-space-science-cell.txt','utf8')).trim();
const blueprint=decodeBlueprint(code).blueprint;
const manifest=JSON.parse(await fs.readFile('blueprint-sources/flight-space-science/manifest.json','utf8'));
const sha256=createHash('sha256').update(code).digest('hex');
assert.equal(sha256,manifest.blueprintSha256,'Exact candidate hash must match the manifest');
const decoded=blueprint.entities;
const feeds=manifest.inputs.map(p=>({item:p.item,ratePerMinute:p.ratePerMinute,entity:decoded.find(e=>e.name==='fast-transport-belt'&&e.position.x===p.x&&e.position.y===7.5)?.entity_number}));
assert(feeds.every(p=>p.entity),'All three labeled belt feeds must exist');
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(path.join(root,'map.json'),JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
await fs.writeFile(path.join(root,'mods/mod-list.json'),JSON.stringify({mods:['base','quality','elevated-rails','space-age','space_science_orbit_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'space_science_orbit_test',version:'1.0.0',title:'Private orbital white science validation',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
const warmupTicks=3600,measureTicks=36000;
const payload={code,blueprint,sha256,feeds,warmupTicks,measureTicks};
await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify(payload)+']====]');
await fs.writeFile(path.join(mod,'control.lua'),`
local p=helpers.json_to_table(require('payload'))
local function check(ok,msg)if not ok then error('SPACE_SCIENCE_ORBIT: '..msg)end end
script.on_init(function()
  check(script.active_mods.base=='2.1.24','wrong Factorio base version')
  local force=game.forces.player
  force.research_all_technologies()
  force.enable_all_recipes()
  local platform=force.create_space_platform{name='White science validation',planet='nauvis',starter_pack='space-platform-starter-pack'}
  check(platform~=nil,'could not create test platform')
  platform.apply_starter_pack(true)
  local surface=platform.surface
  check(surface~=nil and surface.platform==platform,'platform surface is missing')
  check(surface.get_property('gravity')==0,'platform gravity is not zero')
  surface.request_to_generate_chunks({0,0},2);surface.force_generate_chunk_requests()
  for _,e in pairs(surface.find_entities())do if e.name~='space-platform-hub' then e.destroy()end end
  local tiles={};for x=-16,20 do for y=-12,12 do tiles[#tiles+1]={name='space-platform-foundation',position={x,y}}end end;surface.set_tiles(tiles)
  local inventory=game.create_inventory(1);inventory[1].set_stack{name='blueprint',count=1};check(inventory[1].import_stack(p.code)==0,'blueprint import failed')
  -- Blueprint placement centers on the bounding box; offset it so the saved 0,0 hub datum stays at the real hub.
  local ghosts=inventory[1].build_blueprint{surface=surface,force=force,position={10,0},build_mode=defines.build_mode.forced}
  local entities={}
  for _,e in pairs(surface.find_entities())do
    local tags=e.tags or (e.type=='entity-ghost' and e.ghost_tags)
    local id=tags and tags.flight_science_entity
    if id then
      if e.type=='entity-ghost' then local _,built,proxy=e.revive{raise_revive=true};check(built~=nil and not proxy,'failed to revive entity '..tostring(id));entities[id]=built
      else entities[id]=e end
    end
  end
  for _,saved in pairs(p.blueprint.entities)do if not entities[saved.entity_number]then
    local pos={x=saved.position.x,y=saved.position.y}
    local e=surface.create_entity{name=saved.name,position=pos,direction=saved.direction or 0,force=force,recipe=saved.recipe,raise_built=true}
    check(e~=nil,'failed to place entity '..saved.entity_number..' '..saved.name)
    e.tags={flight_science_entity=saved.entity_number};entities[saved.entity_number]=e
  end end
  inventory.destroy()
  local machine=entities[1];check(machine and machine.get_recipe() and machine.get_recipe().name=='space-science-pack','space science recipe not set')
  check(machine.is_connected_to_electric_network(),'assembler is not electrically connected')
  local hub=platform.hub;check(hub and hub.valid,'platform hub missing')
  storage.test={platform=platform,surface=surface,force=force,entities=entities,machine=machine,hub=hub,inputs={},produced=0,hubOutput=0,baseline=machine.products_finished,lastCrafts=machine.products_finished,beginTick=game.tick,measureOutputStart=nil,measureHubStart=0,craftTicks={}}
  for _,feed in pairs(p.feeds)do storage.test.inputs[feed.item]={belt=entities[feed.entity],ratePerMinute=feed.ratePerMinute,feedInterval=math.floor(3600/feed.ratePerMinute),accepted=0,measureAccepted=0}end
end)
script.on_event(defines.events.on_tick,function(e)
  local t=storage.test;if not t then return end
  local elapsed=e.tick-t.beginTick
  for item,feed in pairs(t.inputs)do if elapsed>0 and elapsed%feed.feedInterval==0 then
    local accepted=feed.belt.get_transport_line(1).insert_at_back{name=item,count=1}
    if accepted then feed.accepted=feed.accepted+1;if elapsed>p.warmupTicks then feed.measureAccepted=feed.measureAccepted+1 end end
  end end
  if t.machine.products_finished>t.lastCrafts then for _=t.lastCrafts+1,t.machine.products_finished do t.craftTicks[#t.craftTicks+1]=elapsed end;t.lastCrafts=t.machine.products_finished end
  if elapsed==p.warmupTicks then
    t.measureOutputStart=t.force.get_item_production_statistics(t.surface).get_output_count('space-science-pack')
    t.measureHubStart=t.hub.get_inventory(defines.inventory.hub_main).get_item_count('space-science-pack')
  end
  if elapsed>=p.warmupTicks and elapsed<=p.warmupTicks+p.measureTicks and elapsed%60==0 then
    t.produced=t.produced+t.machine.products_finished-t.lastCrafts
    t.lastCrafts=t.machine.products_finished
    local inv=t.hub.get_inventory(defines.inventory.hub_main);check(inv~=nil,'hub main inventory missing')
    t.hubOutput=inv.get_item_count('space-science-pack')
  end
  if elapsed==p.warmupTicks+p.measureTicks then
    local status='unknown';for k,v in pairs(defines.entity_status)do if v==t.machine.status then status=k end end
    local productTotal=t.force.get_item_production_statistics(t.surface).get_output_count('space-science-pack')
    local hubTotal=t.hub.get_inventory(defines.inventory.hub_main).get_item_count('space-science-pack')
    local hubDelta=hubTotal-t.measureHubStart
    local report={gameVersion=script.active_mods.base,platform='nauvis-orbit',gravity=t.surface.get_property('gravity'),blueprintSha256=p.sha256,simulatedMeasurementMinutes=p.measureTicks/3600,entities=#p.blueprint.entities,recipe=t.machine.get_recipe().name,recipeEnergy=t.machine.get_recipe().energy,status=status,energy=t.machine.energy,electricNetwork=t.machine.electric_network_id,craftingProgress=t.machine.crafting_progress,crafts=t.machine.products_finished-t.baseline,craftTicks=t.craftTicks,productsStatistic=productTotal,outputItems=hubDelta,outputsPerMinute=hubDelta/(p.measureTicks/3600),hubSciencePacks=hubDelta,inputs={},inserters={},panels={},machineInventories={}}
    for item,feed in pairs(t.inputs)do local lanes={};for lane=1,2 do lanes[lane]=feed.belt.get_transport_line(lane).get_contents()end;report.inputs[item]={beltEntity=feed.belt.unit_number,accepted=feed.accepted,acceptedDuringMeasurement=feed.measureAccepted,lanes=lanes}end
    for name,index in pairs(defines.inventory)do if string.find(name,'assembling')then report.machineInventories[name]=index end end
    for index=1,32 do local ok,inv=pcall(function()return t.machine.get_inventory(index)end);if ok and inv then report.machineInventories['index-'..index]={name=inv.name,contents=inv.get_contents()}end end
    for _,e in pairs(t.entities)do if e.type=='inserter'then report.inserters[#report.inserters+1]={position=e.position,direction=e.direction,pickup=e.pickup_target and {name=e.pickup_target.name,position=e.pickup_target.position},drop=e.drop_target and {name=e.drop_target.name,position=e.drop_target.position},held=e.held_stack.valid_for_read and e.held_stack.name or nil} elseif e.name=='solar-panel'then report.panels[#report.panels+1]={position=e.position,energy=e.energy,electricNetwork=e.electric_network_id}end end
    report.passed=report.gravity==0 and report.recipe=='space-science-pack' and report.outputsPerMinute>=14.9 and report.hubSciencePacks>=149 and t.machine.is_connected_to_electric_network()
    for item,feed in pairs(t.inputs)do local required=math.floor(p.measureTicks/3600*feed.ratePerMinute*.95);if feed.measureAccepted<required then report.passed=false end end
    helpers.write_file('space-science-orbit-report.json',helpers.table_to_json(report),false)
    check(report.passed,'native qualification failed: '..helpers.table_to_json(report))
    log('SPACE_SCIENCE_ORBIT_PASSED: '..helpers.table_to_json(report))
  end
end)
`);

async function factorio(args,name){
  const result=await runFile(binary,['--config',path.join(root,'config.ini'),'--mod-directory',path.join(root,'mods'),...args],{timeout:600000,maxBuffer:16*1024*1024});
  await fs.writeFile(path.join(root,name+'.log'),result.stdout+result.stderr);
  return result.stdout;
}
console.log(`Running isolated native Factorio test in ${root}`);
await factorio(['--create',path.join(root,'orbit.zip'),'--map-gen-settings',path.join(root,'map.json')],'create');
const stdout=await factorio(['--benchmark',path.join(root,'orbit.zip'),'--benchmark-ticks',String(warmupTicks+measureTicks+1),'--benchmark-runs','1'],'simulation');
console.log(stdout.split('\n').filter(line=>line.includes('SPACE_SCIENCE_ORBIT_')).join('\n'));
const report=JSON.parse(await fs.readFile(path.join(root,'script-output/space-science-orbit-report.json'),'utf8'));
report.createdAt=new Date().toISOString();
report.harnessSha256=createHash('sha256').update(await fs.readFile(path.join(mod,'control.lua'))).digest('hex');
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
assert.equal(report.passed,true,'Orbital cell must produce and load 15 packs/min into the space hub');
console.log(JSON.stringify({report:path.join(root,'report.json'),...report},null,2));
