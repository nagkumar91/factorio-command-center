// Native qualification of the orbital space science cell on real zero-gravity Nauvis platforms.
//
// Protocol (the "stated" run is the one that qualified the first version; nothing in it is weaker):
//   stated     feed exactly the manifest rates on the entrance belts, 1 minute warm-up, 10 minutes measured:
//              at least 149 packs in the hub (14.9/min), at least 95% of every feed accepted,
//              and (added) every craft in the window exactly one recipe time apart, so power never dipped.
//   abundant   (added) both lanes of every entrance belt kept full: same output and cadence, nothing jams.
//   blockedHub (added) stated feed, hub filled for 5 minutes, then cleared: the next 10 minutes deliver 149+.
// Each run has its own platform, hub and electric network. The exact blueprint string is imported and built.
//
// Usage: node tests/flight-space-science-platform-native.mjs [--write-report]
//   FLIGHT_SPACE_SCIENCE_SOURCE=<folder with manifest.json and the string> screens a candidate from another folder.
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
const source=path.resolve(process.env.FLIGHT_SPACE_SCIENCE_SOURCE||'blueprint-sources/flight-space-science');
const manifest=JSON.parse(await fs.readFile(path.join(source,'manifest.json'),'utf8'));
const cache=path.join(project,'.cache',manifest.id,'native');
// Only the newest run folder is kept.
await fs.rm(cache,{recursive:true,force:true});
const root=path.join(cache,Date.now().toString());
const mod=path.join(root,'mods/space_science_orbit_test');
const code=(await fs.readFile(path.join(source,manifest.file),'utf8')).trim();
const blueprint=decodeBlueprint(code).blueprint;
const sha256=createHash('sha256').update(code).digest('hex');
assert.equal(sha256,manifest.blueprintSha256,'Exact candidate hash must match the manifest');
const decoded=blueprint.entities;
// Every lane is fed at its entrance: the southernmost belt of the labeled column.
const feeds=manifest.inputs.map(p=>({item:p.item,ratePerMinute:p.ratePerMinute,entity:decoded.filter(e=>e.name==='fast-transport-belt'&&e.position.x===p.x).sort((a,b)=>b.position.y-a.position.y)[0]?.entity_number}));
assert(feeds.every(p=>p.entity),'All three labeled belt feeds must exist');
for(const p of manifest.inputs)if(p.y!==undefined)assert.equal(decoded.find(e=>e.entity_number===feeds.find(f=>f.item===p.item).entity).position.y,p.y,p.item+' entrance row');
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
await fs.writeFile(path.join(root,'map.json'),JSON.stringify({seed:12345,width:32,height:32,default_enable_all_autoplace_controls:false}));
await fs.writeFile(path.join(root,'mods/mod-list.json'),JSON.stringify({mods:['base','quality','elevated-rails','space-age','space_science_orbit_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(path.join(mod,'info.json'),JSON.stringify({name:'space_science_orbit_test',version:'1.0.0',title:'Private orbital white science validation',author:'local',factorio_version:'2.1',dependencies:['base = 2.1.24','space-age']}));
const warmupTicks=3600,measureTicks=36000,blockTicks=18000;
const recipeTicks=Math.round(manifest.recipe.energySeconds/0.75*60);
const payload={code,blueprint,sha256,feeds,warmupTicks,measureTicks,blockTicks,recipeTicks};
await fs.writeFile(path.join(mod,'payload.lua'),'return [====['+JSON.stringify(payload)+']====]');
await fs.writeFile(path.join(mod,'control.lua'),`
local p=helpers.json_to_table(require('payload'))
local function check(ok,msg)if not ok then error('SPACE_SCIENCE_ORBIT: '..msg)end end
local runs={
  {name='stated',feed='stated',measureStart=p.warmupTicks},
  {name='abundant',feed='abundant',measureStart=p.warmupTicks},
  {name='blockedHub',feed='stated',blockStart=p.warmupTicks,measureStart=p.warmupTicks+p.blockTicks},
}
local lastTick=0;for _,r in pairs(runs)do lastTick=math.max(lastTick,r.measureStart+p.measureTicks)end

local function build(platform,force)
  local surface=platform.surface
  check(surface~=nil and surface.platform==platform,'platform surface is missing')
  check(surface.get_property('gravity')==0,'platform gravity is not zero')
  surface.request_to_generate_chunks({0,0},2);surface.force_generate_chunk_requests()
  for _,e in pairs(surface.find_entities())do if e.name~='space-platform-hub' then e.destroy()end end
  local tiles={};for x=-16,20 do for y=-12,12 do tiles[#tiles+1]={name='space-platform-foundation',position={x,y}}end end;surface.set_tiles(tiles)
  local inventory=game.create_inventory(1);inventory[1].set_stack{name='blueprint',count=1};check(inventory[1].import_stack(p.code)==0,'blueprint import failed')
  -- Blueprint placement centers on the bounding box. Build once, read where the first entity landed,
  -- and build again shifted so the saved 0,0 hub datum is the real hub. Every position is then checked.
  local function place(position)
    inventory[1].build_blueprint{surface=surface,force=force,position=position,build_mode=defines.build_mode.forced}
    local found={}
    for _,e in pairs(surface.find_entities())do
      local tags=e.tags or (e.type=='entity-ghost' and e.ghost_tags)
      local id=tags and tags.flight_science_entity
      if id then found[id]=e end
    end
    return found
  end
  local first=p.blueprint.entities[1]
  local trial={10,0} -- east of the hub, clear of it for any cell that fits the paved test area
  local found=place(trial)
  check(found[first.entity_number]~=nil,'blueprint did not place its first entity')
  local dx,dy=found[first.entity_number].position.x-first.position.x,found[first.entity_number].position.y-first.position.y
  if dx~=0 or dy~=0 then for _,e in pairs(found)do e.destroy()end;found=place({trial[1]-dx,trial[2]-dy})end
  local entities={}
  for _,saved in pairs(p.blueprint.entities)do
    local e=found[saved.entity_number]
    check(e~=nil,'blueprint did not place entity '..saved.entity_number..' '..saved.name)
    if e.type=='entity-ghost' then local _,built,proxy=e.revive{raise_revive=true};check(built~=nil and not proxy,'failed to revive entity '..saved.entity_number);e=built end
    check(e.name==saved.name and e.position.x==saved.position.x and e.position.y==saved.position.y,'entity '..saved.entity_number..' is not at its saved position')
    entities[saved.entity_number]=e
  end
  inventory.destroy()
  local machine=entities[1];check(machine and machine.get_recipe() and machine.get_recipe().name=='space-science-pack','space science recipe not set')
  check(machine.is_connected_to_electric_network(),'assembler is not electrically connected')
  local hub=platform.hub;check(hub and hub.valid,'platform hub missing')
  return surface,entities,machine,hub
end

script.on_init(function()
  check(script.active_mods.base=='2.1.24','wrong Factorio base version')
  local force=game.forces.player
  force.research_all_technologies()
  force.enable_all_recipes()
  storage.tests={};storage.beginTick=game.tick
  for _,run in pairs(runs)do
    local platform=force.create_space_platform{name='White science validation '..run.name,planet='nauvis',starter_pack='space-platform-starter-pack'}
    check(platform~=nil,'could not create test platform')
    platform.apply_starter_pack(true)
    local surface,entities,machine,hub=build(platform,force)
    local t={run=run,platform=platform,surface=surface,force=force,entities=entities,machine=machine,hub=hub,inputs={},lastCrafts=machine.products_finished,baseline=machine.products_finished,craftTicks={},measureHubStart=0,blockedPacks=0}
    for _,feed in pairs(p.feeds)do t.inputs[feed.item]={belt=entities[feed.entity],ratePerMinute=feed.ratePerMinute,feedInterval=math.floor(3600/feed.ratePerMinute),accepted=0,measureAccepted=0}end
    storage.tests[run.name]=t
  end
end)

local function packs(t)return t.hub.get_inventory(defines.inventory.hub_main).get_item_count('space-science-pack')end

local function report_run(t)
  local run=t.run
  local status='unknown';for k,v in pairs(defines.entity_status)do if v==t.machine.status then status=k end end
  local hubDelta=packs(t)-t.measureHubStart
  local minutes=p.measureTicks/3600
  local intervals={count=0}
  local previous=nil
  for _,tick in pairs(t.craftTicks)do
    if previous and previous>=run.measureStart then local d=tick-previous;intervals.count=intervals.count+1;intervals.min=math.min(intervals.min or d,d);intervals.max=math.max(intervals.max or d,d)end
    previous=tick
  end
  local stats=t.surface.global_electric_network_statistics
  local consumed,generated=0,0
  for _,n in pairs(stats.input_counts)do consumed=consumed+n end
  for _,n in pairs(stats.output_counts)do generated=generated+n end
  local seconds=(run.measureStart+p.measureTicks)/60
  local r={feed=run.feed,measureStartTick=run.measureStart,simulatedMeasurementMinutes=minutes,status=status,crafts=t.machine.products_finished-t.baseline,craftTicks=t.craftTicks,craftIntervalTicks=intervals,recipeTicks=p.recipeTicks,
    packsMade=t.force.get_item_production_statistics(t.surface).get_input_count('space-science-pack'),outputItems=hubDelta,outputsPerMinute=hubDelta/minutes,hubSciencePacks=hubDelta,packsDuringBlock=t.blockedPacks,
    power={globalNetwork=t.surface.has_global_electric_network,solarPercent=t.platform.space_location and t.platform.space_location.solar_power_in_space,surfaceSolarMultiplier=t.surface.solar_power_multiplier,panels=0,averageConsumedKilowatts=consumed/seconds/1000,averageGeneratedKilowatts=generated/seconds/1000},
    inputs={},inserters={},panels={},machineInventories={}}
  for item,feed in pairs(t.inputs)do local lanes={};for lane=1,2 do lanes[lane]=feed.belt.get_transport_line(lane).get_contents()end;r.inputs[item]={beltEntity=feed.belt.unit_number,position=feed.belt.position,accepted=feed.accepted,acceptedDuringMeasurement=feed.measureAccepted,lanes=lanes}end
  for index=1,32 do local ok,inv=pcall(function()return t.machine.get_inventory(index)end);if ok and inv then r.machineInventories['index-'..index]={name=inv.name,contents=inv.get_contents()}end end
  for _,e in pairs(t.entities)do if e.type=='inserter'then r.inserters[#r.inserters+1]={position=e.position,direction=e.direction,pickup=e.pickup_target and {name=e.pickup_target.name,position=e.pickup_target.position},drop=e.drop_target and {name=e.drop_target.name,position=e.drop_target.position},held=e.held_stack.valid_for_read and e.held_stack.name or nil} elseif e.name=='solar-panel'then r.power.panels=r.power.panels+1;r.panels[#r.panels+1]={position=e.position,energy=e.energy,electricNetwork=e.electric_network_id}end end
  r.passed=t.surface.get_property('gravity')==0 and t.machine.get_recipe().name=='space-science-pack' and r.outputsPerMinute>=14.9 and r.hubSciencePacks>=149 and t.machine.is_connected_to_electric_network()
    and intervals.count>=28 and intervals.min==p.recipeTicks and intervals.max==p.recipeTicks
  if run.feed=='stated' and not run.blockStart then for _,feed in pairs(t.inputs)do local required=math.floor(minutes*feed.ratePerMinute*.95);if feed.measureAccepted<required then r.passed=false end end end
  if run.blockStart and t.blockedPacks~=0 then r.passed=false end
  return r
end

script.on_event(defines.events.on_tick,function(e)
  if not storage.tests then return end
  local elapsed=e.tick-storage.beginTick
  for _,t in pairs(storage.tests)do
    local run=t.run
    local finish=run.measureStart+p.measureTicks
    if elapsed<=finish then
      for item,feed in pairs(t.inputs)do
        if run.feed=='abundant' then
          for lane=1,2 do local line=feed.belt.get_transport_line(lane);if line.can_insert_at_back()then line.insert_at_back{name=item,count=1};feed.accepted=feed.accepted+1 end end
        elseif elapsed>0 and elapsed%feed.feedInterval==0 then
          local accepted=feed.belt.get_transport_line(1).insert_at_back{name=item,count=1}
          if accepted then feed.accepted=feed.accepted+1;if elapsed>run.measureStart then feed.measureAccepted=feed.measureAccepted+1 end end
        end
      end
      if t.machine.products_finished>t.lastCrafts then for _=t.lastCrafts+1,t.machine.products_finished do t.craftTicks[#t.craftTicks+1]=elapsed end;t.lastCrafts=t.machine.products_finished end
      if run.blockStart and elapsed==run.blockStart then
        -- Fill every free hub slot so the hand-off inserter has nowhere to put packs.
        local inv=t.hub.get_inventory(defines.inventory.hub_main)
        t.filler=inv.insert{name='stone',count=1000000}
        t.fillerPacks=inv.insert{name='space-science-pack',count=1000000} -- tops up the partly filled pack stack
        t.blockHubStart=packs(t)
        check(inv.insert{name='space-science-pack',count=1}==0,'hub was not full after filling')
      end
      if run.blockStart and elapsed==run.measureStart then
        t.blockedPacks=packs(t)-t.blockHubStart
        local inv=t.hub.get_inventory(defines.inventory.hub_main)
        check(inv.remove{name='stone',count=t.filler}==t.filler,'could not clear the hub')
        if t.fillerPacks>0 then inv.remove{name='space-science-pack',count=t.fillerPacks}end
      end
      if elapsed==run.measureStart then t.measureHubStart=packs(t)end
      if elapsed==finish then t.report=report_run(t)end
    end
  end
  if elapsed==lastTick then
    local stated=storage.tests.stated
    local report=stated.report
    report.gameVersion=script.active_mods.base;report.platform='nauvis-orbit';report.gravity=stated.surface.get_property('gravity');report.blueprintSha256=p.sha256
    report.entities=#p.blueprint.entities;report.recipe=stated.machine.get_recipe().name;report.recipeEnergy=stated.machine.get_recipe().energy
    report.electricNetwork=stated.machine.electric_network_id
    report.behaviour={abundant=storage.tests.abundant.report,blockedHub=storage.tests.blockedHub.report}
    report.statedPassed=report.passed
    report.passed=report.statedPassed and report.behaviour.abundant.passed and report.behaviour.blockedHub.passed
    helpers.write_file('space-science-orbit-report.json',helpers.table_to_json(report),false)
    log('SPACE_SCIENCE_ORBIT_'..(report.passed and 'PASSED' or 'FAILED')..': stated '..report.outputsPerMinute..'/min, abundant '..report.behaviour.abundant.outputsPerMinute..'/min, after blocked hub '..report.behaviour.blockedHub.outputsPerMinute..'/min')
  end
end)
`);

async function factorio(args,name){
  const result=await runFile(binary,['--config',path.join(root,'config.ini'),'--mod-directory',path.join(root,'mods'),...args],{timeout:600000,maxBuffer:16*1024*1024}).catch(error=>error);
  await fs.writeFile(path.join(root,name+'.log'),String(result.stdout)+String(result.stderr));
  if(result instanceof Error)throw new Error(`Factorio ${name} failed; see ${path.join(root,name+'.log')}\n`+String(result.stdout).split('\n').filter(line=>/Error|SPACE_SCIENCE_ORBIT/.test(line)).join('\n'));
  return result.stdout;
}
console.log(`Running isolated native Factorio test in ${root}`);
await factorio(['--create',path.join(root,'orbit.zip'),'--map-gen-settings',path.join(root,'map.json')],'create');
const stdout=await factorio(['--benchmark',path.join(root,'orbit.zip'),'--benchmark-ticks',String(warmupTicks+blockTicks+measureTicks+1),'--benchmark-runs','1'],'simulation');
console.log(stdout.split('\n').filter(line=>line.includes('SPACE_SCIENCE_ORBIT')).join('\n'));
const report=JSON.parse(await fs.readFile(path.join(root,'script-output/space-science-orbit-report.json'),'utf8'));
report.createdAt=new Date().toISOString();
report.harnessSha256=createHash('sha256').update(await fs.readFile(path.join(mod,'control.lua'))).digest('hex');
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
const brief=r=>({passed:r.passed,outputsPerMinute:r.outputsPerMinute,hubSciencePacks:r.hubSciencePacks,craftIntervalTicks:r.craftIntervalTicks,status:r.status,power:r.power,accepted:Object.fromEntries(Object.entries(r.inputs).map(([k,v])=>[k,v.acceptedDuringMeasurement||v.accepted]))});
console.log(JSON.stringify({report:path.join(root,'report.json'),blueprintSha256:report.blueprintSha256,entities:report.entities,passed:report.passed,stated:brief(report),abundant:brief(report.behaviour.abundant),blockedHub:{...brief(report.behaviour.blockedHub),packsDuringBlock:report.behaviour.blockedHub.packsDuringBlock}},null,2));
if(process.argv.includes('--write-report')){
  assert.equal(report.passed,true,'Only a passing run is written as the committed report');
  assert.equal(process.env.FLIGHT_SPACE_SCIENCE_SOURCE,undefined,'The committed report is written only for the committed source folder');
  await fs.mkdir(path.join(source,'validation'),{recursive:true});
  await fs.writeFile(path.join(source,'validation/native-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Wrote '+path.join(source,'validation/native-report.json'));
}
assert.equal(report.passed,true,'Orbital cell must produce and load 15 packs/min into the space hub in every run');
