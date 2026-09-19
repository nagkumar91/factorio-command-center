// Real Factorio import + delivery tests. Fixtures feed only declared external ports.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {starterConfigurationHash} from '../scripts/starter-verification.mjs';
const runFile=promisify(execFile),root=path.resolve(process.env.STARTER_TEST_ROOT||'.cache/power-workshops/native'),mods=path.join(root,'mods'),mod=path.join(mods,'starter_test');
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const throughput=process.env.STARTER_BENCHMARK==='1';
const minutes=Number(process.env.SIMULATED_MINUTES||45),ticks=minutes*3600;
const warmupMinutes=throughput?Number(process.env.WARMUP_MINUTES||15):0,warmupTicks=warmupMinutes*3600;
assert.ok(minutes>warmupMinutes && Number.isInteger(minutes) && warmupMinutes>=0);
const reportFile=throughput?'throughput.json':'validation.json';
const mapSeed=12345;
const sourceRoot=process.env.STARTER_SOURCE_ROOT||'blueprint-sources/power-workshops';
const allBuilds=JSON.parse(await fs.readFile(sourceRoot+'/manifest.json'));
const builds=process.env.STARTER_TEST_IDS?allBuilds.filter(b=>process.env.STARTER_TEST_IDS.split(',').includes(b.id)):allBuilds;
for(const b of builds){assert.equal(b.rawOnly,true);for(const p of b.ports.filter(p=>['input','fluid'].includes(p.kind)))for(const item of p.items)assert.ok(['iron-ore','copper-ore','coal','stone','wood','water','crude-oil','tungsten-ore','calcite'].includes(item),'Raw inputs only: '+item);}
for(const b of builds){
 b.code=(await fs.readFile(sourceRoot+'/'+b.file,'utf8')).trim();
 b.entities=decodeBlueprint(b.code).blueprint.entities;
 b.forceKey=createHash('sha256').update(JSON.stringify(b.researchClosure||[])).digest('hex').slice(0,10);
 b.blueprintSha256=createHash('sha256').update(b.code).digest('hex');
 b.portConfigurationSha256=starterConfigurationHash(b);
 // Keep the rate probe tied to the manifest's declared raw inputs.  A fluid
 // port is the authoritative classification; everything else is an item,
 // including burner fuel.  This metadata is only consumed by benchmark mode
 // and does not alter the functional validation schema or configuration hash.
 b.rateInputs=[...new Set(b.rawInputs||[])].map(name=>({name,kind:b.ports.some(p=>p.kind==='fluid'&&p.items?.includes(name))?'fluid':'item'}));
}
if(!process.env.STARTER_TEST_IDS){
 const count=Math.min(Number(process.env.STARTER_WORKERS)||8,Math.max(1,os.availableParallelism()-2),builds.length);
 const batches=Array.from({length:count},(_,i)=>builds.filter((_,index)=>index%count===i));
 const results=await Promise.allSettled(batches.map(async(batch,index)=>{
  const directory=path.join(root,'batch-'+(index+1));await fs.mkdir(directory,{recursive:true});
  await fs.rm(directory+'/'+reportFile,{force:true});
  try{
   const result=await runFile(process.execPath,[path.resolve('tests/early-game.mjs')],{env:{...process.env,STARTER_TEST_IDS:batch.map(b=>b.id).join(','),STARTER_TEST_ROOT:directory},timeout:1800000,maxBuffer:16*1024*1024});
   await fs.writeFile(directory+'/run.log',result.stdout+result.stderr);
  }catch(error){await fs.writeFile(directory+'/run.log',String(error.stdout)+String(error.stderr));}
  const report=JSON.parse(await fs.readFile(directory+'/'+reportFile));
  assert.equal(report.builds.length,batch.length);assert.equal(report.simulatedMinutes,minutes);
  for(const info of batch){const result=report.builds.find(b=>b.id===info.id);assert.equal(result?.blueprintSha256,info.blueprintSha256);assert.equal(result?.portConfigurationSha256,info.portConfigurationSha256);}
  console.log('Batch '+(index+1)+': '+report.builds.filter(b=>b.passed).length+'/'+batch.length+' passed');return report;
 }));
 const missing=results.flatMap((r,i)=>r.status==='rejected'?['Batch '+(i+1)+': '+r.reason.message]:[]);
 assert.deepEqual(missing,[],'Every isolated batch must return current evidence.');
 const report={...results[0].value,builds:results.flatMap(r=>r.value.builds).sort((a,b)=>allBuilds.findIndex(x=>x.id===a.id)-allBuilds.findIndex(x=>x.id===b.id))};
 await fs.writeFile(root+'/'+reportFile,JSON.stringify(report,null,2)+'\n');
 assert.deepEqual(report.builds.filter(b=>!b.passed).map(b=>b.id),[],'Every raw-input module must produce and replenish its output.');
 if(!throughput)await fs.writeFile(sourceRoot+'/validation.json',JSON.stringify(report,null,2)+'\n');
 console.log('All '+builds.length+' starter layouts passed native delivery checks.');process.exit(0);
}
await fs.mkdir(mod,{recursive:true});
await fs.writeFile(root+'/map-gen-settings.json',JSON.stringify({seed:mapSeed}));
await fs.writeFile(root+'/config.ini',`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n`);
await fs.writeFile(mods+'/mod-list.json',JSON.stringify({mods:['base','quality','elevated-rails','space-age','starter_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(mod+'/info.json',JSON.stringify({name:'starter_test',version:'1.0.0',title:'Early game native delivery verification',author:'local',factorio_version:'2.0',dependencies:['base >= 2.0.77','space-age']}));
await fs.writeFile(mod+'/control.lua',`
local builds=helpers.json_to_table([==[${JSON.stringify(builds)}]==])
local function check(ok,msg)if not ok then error('STARTER_TEST: '..msg)end end
local function consumption_counts(force,surface,inputs)
 local item_statistics=force.get_item_production_statistics(surface)
 local fluid_statistics=force.get_fluid_production_statistics(surface)
 local result={}
 for _,input in pairs(inputs or {})do
  local statistics=input.kind=='fluid' and fluid_statistics or item_statistics
  result[input.name]=statistics.output_counts[input.name] or statistics.get_output_count(input.name) or 0
 end
 return result
end
local function powered_fixture(s,t,consumer)
 local poles={};if t.powerPort then poles={t.entities[t.powerPort]} else for _,e in pairs(t.entities)do if e.type=='electric-pole' then poles[#poles+1]=e end end end
 if #poles==0 then return end
 local function place_near(pole)
  for dx=-1,2 do for dy=-1,2 do
   local p={x=math.floor(pole.position.x)+dx,y=math.floor(pole.position.y)+dy}
   if s.can_place_entity{name='electric-energy-interface',position=p,force=pole.force} then
    local fixture=s.create_entity{name='electric-energy-interface',position=p,force=pole.force}
    fixture.electric_buffer_size=100000000;fixture.power_production=consumer and 0 or 100000000;fixture.power_usage=consumer and 100000 or 0
    t.power=fixture;return true
   end
  end end
 end
 for _,pole in pairs(poles)do if place_near(pole) then return end end
 -- Dense layouts need one outside grid pole. Connect it to exactly one saved
 -- pole, so the fixture cannot bridge or repair gaps in the saved power grid.
 for _,pole in pairs(poles)do
  for dx=-7,7 do for dy=-7,7 do
   if dx*dx+dy*dy<=49 and math.abs(dx)+math.abs(dy)>3 then
    local p={x=pole.position.x+dx,y=pole.position.y+dy}
    if s.can_place_entity{name='small-electric-pole',position=p,force=pole.force} then
     local extra=s.create_entity{name='small-electric-pole',position=p,force=pole.force}
     local connector=extra.get_wire_connector(defines.wire_connector_id.pole_copper,true)
     connector.disconnect_all();connector.connect_to(pole.get_wire_connector(defines.wire_connector_id.pole_copper,true))
     if place_near(extra) then return end
     extra.destroy()
    end
   end
  end end
 end
 error('No room for an external power fixture on '..s.name)
end
script.on_init(function()
 storage.builds={}
 for _,b in pairs(builds)do
  local force=game.forces[b.forceKey] or game.create_force(b.forceKey)
  for _,id in pairs(b.researchClosure or {})do force.technologies[id].researched=true end
  for _,e in pairs(b.entities)do
   local display=false
   for _,p in pairs(b.ports)do if p.displayEntity==e.entity_number then
    check(e.name=='display-panel' and (p.kind=='input' or p.kind=='fluid') and e.tags.input_display==p.entity,b.id..' invalid decorative sign')
    check(b.inputDisplays.optional and b.inputDisplays.requiredTechnology=='circuit-network',b.id..' missing display research disclosure')
    check(not e.control_behavior,b.id..' input signs must be static');display=true
   end end
   local item=force.recipes[e.name];check(display or not item or item.enabled,b.id..' locked construction item '..e.name)
   local r=e.recipe or (e.tags and e.tags.production_recipe);check(not r or force.recipes[r].enabled,b.id..' locked recipe '..tostring(r))
  end
  local s=game.create_surface(b.id,{seed=${mapSeed},width=256,height=256,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  if b.surface then for property,value in pairs(b.surface.properties)do s.set_property(property,value)end end
  s.request_to_generate_chunks({0,0},3);s.force_generate_chunk_requests();for _,e in pairs(s.find_entities())do e.destroy()end
  local minx,miny,maxx,maxy=0,0,0,0
  for _,e in pairs(b.entities)do minx=math.min(minx,e.position.x);miny=math.min(miny,e.position.y);maxx=math.max(maxx,e.position.x);maxy=math.max(maxy,e.position.y)end
  local tiles={};for x=math.floor(minx)-8,math.ceil(maxx)+8 do for y=math.floor(miny)-8,math.ceil(maxy)+8 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  if b.kind=='mining' then for x=-25,25 do for y=-15,15 do s.create_entity{name=b.resource,position={x,y},amount=1000000}end end end
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(b.code)==0,b.id..' import')
  local ghosts=inv[1].build_blueprint{surface=s,force=force,position={0,0},build_mode=defines.build_mode.forced}
  check(#ghosts==#b.entities,b.id..' placement '..#ghosts..'/'..#b.entities)
  local t={entities={},force=force,surface=s,delivered={},fed={},outputPorts={},worked={},sampledEnergy=0,drained=0,restarted=false,drainedPorts={},restartedPorts={},collected={},warmupCollected={},machineSamples={},warmupProducts={},warmupCrafting={},firstProductTicks={},fuel={furnaceFuel=b.fuelPolicy and b.fuelPolicy.furnaceFuel or nil,allFurnacesPowered=true,furnaces={}},warmupInputs=${throughput&&warmupMinutes===0?'consumption_counts(force,s,b.rateInputs)':'nil'}};storage.builds[b.id]=t
  for _,g in pairs(ghosts)do local id=g.tags.starter_entity;local _,e=g.revive{raise_revive=true};check(e~=nil,b.id..' revive '..tostring(id));t.entities[id]=e end
  local first=b.entities[1];local real=t.entities[first.entity_number];t.dx=real.position.x-first.position.x;t.dy=real.position.y-first.position.y
  for _,e in pairs(b.entities)do
   local actual=t.entities[e.entity_number];check(actual.name==e.name,b.id..' changed entity '..e.name)
   check(actual.position.x==e.position.x+t.dx and actual.position.y==e.position.y+t.dy,b.id..' shifted layout '..e.name..' #'..e.entity_number)
   check(actual.direction==(e.direction or 0),b.id..' changed orientation '..e.name..' #'..e.entity_number..': '..actual.direction..' != '..(e.direction or 0))
   if e.recipe then check(actual.get_recipe() and actual.get_recipe().name==e.recipe,b.id..' recipe '..e.recipe)end
   if e.type=='furnace' and b.fuelPolicy and b.fuelPolicy.furnaceFuel=='electricity' then check(e.name=='electric-furnace',b.id..' non-electric furnace')end
   if e.name=='display-panel' then
    local icon=actual.display_panel_icon
    check(icon and icon.name==e.icon.name and (icon.type or 'item')==e.icon.type,b.id..' display icon')
    check(actual.display_panel_text==e.text,b.id..' display text')
    check(actual.display_panel_always_show,b.id..' display Alt-mode text')
    check(not actual.display_panel_show_in_chart,b.id..' display map clutter')
   end
  end
  for _,p in pairs(b.ports)do if p.kind=='power' then t.powerPort=p.entity end end
  if b.loopControl then
   local reader=t.entities[b.loopControl.reader].get_control_behavior()
   check(reader.read_contents and reader.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold,b.id..' incorrect circulating belt reader')
   check(force.technologies['circuit-network'].researched,b.id..' missing production circuit research')
  end
  if b.kind~='routing' then powered_fixture(s,t,b.kind=='power')end
  for _,p in pairs(b.ports)do
   if p.kind=='fluid' then
    local fixture=s.create_entity{name='infinity-pipe',position={x=p.x+t.dx+(p.externalSide=='west' and -1 or 0),y=p.y+t.dy+(p.externalSide=='west' and 0 or -1)},force=force};check(fixture~=nil,b.id..' water port')
    fixture.set_infinity_pipe_filter{name=p.items[1],percentage=1,mode='at-least',temperature=prototypes.fluid[p.items[1]].default_temperature}
   end
   if p.kind=='output' or p.kind=='fluid-output' then t.outputPorts[p.entity]=0 end
  end
  inv.destroy()
 end
 log('STARTERS_IMPORTED: '..#builds)
end)
${throughput||builds.some(b=>b.workshop)?`-- Workshops need their full declared raw supply, including metallurgy.
-- Feed exterior belts only; the saved inlet inserters still limit admission.
script.on_nth_tick(4,function()
 for _,b in pairs(builds)do local t=storage.builds[b.id]
  for _,p in pairs(b.ports)do if p.kind=='input' and (${throughput?'true':'b.workshop'}) then local e=t.entities[p.entity]
   for lane=1,2 do local item=p.items[math.min(lane,#p.items)];if e.get_transport_line(lane).insert_at_back{name=item,count=1} then t.fed[item]=(t.fed[item] or 0)+1 end end
  end end
 end
end)`:''}
-- Individual starter modules keep their original two-items/second fixture.
-- Sample production once per second instead of polling full belts each tick.
script.on_nth_tick(60,function()
 for _,b in pairs(builds)do local t=storage.builds[b.id]
  if game.tick==60 and b.powerNetwork then
   local network=t.entities[t.powerPort].electric_network_id;check(network~=nil,b.id..' no external power network')
   t.powerNetwork={bigPoles=0,mediumPoles=0,poweredConsumers=0,allConnected=true,networkId=network}
   for id,e in pairs(t.entities)do
    if e.type=='electric-pole' then
     check(e.name=='big-electric-pole' or e.name=='medium-electric-pole',b.id..' wrong pole tier')
     check(e.electric_network_id==network,b.id..' disconnected pole')
     local key=e.name=='big-electric-pole' and 'bigPoles' or 'mediumPoles';t.powerNetwork[key]=t.powerNetwork[key]+1
    elseif e.type=='assembling-machine' or e.type=='furnace' or e.type=='inserter' or e.type=='pump' then
     check(e.is_connected_to_electric_network() and e.electric_network_id==network,b.id..' unpowered '..e.name..' #'..e.unit_number)
     if e.type=='furnace' then
      check(not b.fuelPolicy or b.fuelPolicy.furnaceFuel~='electricity' or e.name=='electric-furnace',b.id..' non-electric furnace '..e.name)
      t.fuel.furnaces[#t.fuel.furnaces+1]={name=e.name,entity=id,electricPoweredSeconds=0,burning={},inventorySamples={},sourceSamples={}}
     end
     t.powerNetwork.poweredConsumers=t.powerNetwork.poweredConsumers+1
    end
   end
  end
  if t.fuel then
   for _,f in pairs(t.fuel.furnaces)do
    local e=t.entities[f.entity]
    if e and e.is_connected_to_electric_network() and e.electric_network_id==t.powerNetwork.networkId then
     if e.energy>0 then f.electricPoweredSeconds=f.electricPoweredSeconds+1 end
    else t.fuel.allFurnacesPowered=false end
    if e then
     local fuel=e.get_fuel_inventory();if fuel then for item,count in pairs(fuel.get_contents())do f.inventorySamples[item]=(f.inventorySamples[item] or 0)+1 end end
     local source=e.get_inventory(defines.inventory.furnace_source);if source then for item,count in pairs(source.get_contents())do f.sourceSamples[item]=(f.sourceSamples[item] or 0)+1 end end
    end
   end
  end
  if game.tick==60 and b.loopControl then
   local network=t.entities[b.loopControl.reader].get_circuit_network(defines.wire_connector_id.circuit_green)
   check(network~=nil,b.id..' no belt control network')
   for _,id in pairs(b.loopControl.controlled)do
    local entity=t.entities[id];local actual=entity.get_circuit_network(defines.wire_connector_id.circuit_green)
    check(actual and actual.network_id==network.network_id,b.id..' disconnected item limit')
    check(entity.get_control_behavior().circuit_enable_disable,b.id..' disabled stock control')
   end
   t.maxCirculating=0
  end
  if b.loopControl then
   local count=0;for _,signal in pairs(t.entities[b.loopControl.reader].get_signals(defines.wire_connector_id.circuit_green) or {})do count=count+signal.count end
   t.maxCirculating=math.max(t.maxCirculating or 0,count)
   check(count<#b.loopControl.loop*7,b.id..' circulating belt is overfilled')
  end
  if ${throughput?'true':'false'} then
   if game.tick==${warmupTicks} then t.warmupInputs=consumption_counts(t.force,t.surface,b.rateInputs) end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine' or e.type=='furnace' then
    if game.tick==${warmupTicks} then t.warmupProducts[id]=e.products_finished;t.warmupCrafting[id]=(e.crafting_progress or 0)>0 and 1 or 0 end
    if game.tick>${warmupTicks} then
     local name='unknown';for k,v in pairs(defines.entity_status)do if v==e.status then name=k end end
     t.machineSamples[id]=t.machineSamples[id] or {};t.machineSamples[id][name]=(t.machineSamples[id][name] or 0)+1
    end
   end end
  end
  if b.kind=='mining' or b.kind=='power' then for id,e in pairs(t.entities)do if (e.type=='mining-drill' or e.type=='generator') and e.status==defines.entity_status.working then t.worked[id]=true end end end
  for _,p in pairs(b.ports)do local e=t.entities[p.entity]
   if ${throughput?'false':'true'} and game.tick==${Math.floor(ticks/8)*4} and p.kind=='output' and e.type=='container' then for _,item in pairs(p.items)do local count=e.get_item_count(item);if count>0 then t.drained=t.drained+count;t.drainedPorts[p.entity]=(t.drainedPorts[p.entity] or 0)+count;e.remove_item{name=item,count=count}end end end
   if p.kind=='input' and ${throughput?'false':'not b.workshop'} then
    for lane=1,2 do local item=p.items[math.min(lane,#p.items)];if e.get_transport_line(lane).insert_at_back{name=item,count=1} then t.fed[item]=(t.fed[item] or 0)+1 end end
   elseif p.kind=='output' or p.kind=='fluid-output' then
    for _,item in pairs(p.items)do
     local n=0
     if p.kind=='fluid-output' then n=e.get_fluid_count(item);if n>0 then e.remove_fluid{name=item,amount=n}end
     elseif e.type=='container' then n=e.get_item_count(item);if ${throughput?'true':'false'} and n>0 then e.remove_item{name=item,count=n}end
     else for lane=1,2 do local line=e.get_transport_line(lane);local count=line.get_item_count(item);if count>0 then line.remove_item{name=item,count=count}end;n=n+count end end
     if n>0 and game.tick>${Math.floor(ticks/8)*4} and t.drained>0 then t.restarted=true;if t.drainedPorts[p.entity] then t.restartedPorts[p.entity]=true end end
     if n>0 and not t.firstOutputTick then t.firstOutputTick=game.tick end
     if n>0 and not t.firstProductTicks[item] then t.firstProductTicks[item]=game.tick end
     if ${throughput?'true':'false'} then
      local collected=game.tick>${warmupTicks} and t.collected or t.warmupCollected;collected[item]=(collected[item] or 0)+n
      if game.tick>${warmupTicks} then t.delivered[item]=(t.delivered[item] or 0)+n;t.outputPorts[p.entity]=t.outputPorts[p.entity]+n end
     elseif e.type=='container' then t.delivered[item]=math.max(t.delivered[item] or 0,n);t.outputPorts[p.entity]=math.max(t.outputPorts[p.entity],n)
     else t.delivered[item]=(t.delivered[item] or 0)+n;t.outputPorts[p.entity]=t.outputPorts[p.entity]+n end
    end
   end
  end
  if b.kind=='power' and game.tick>600 then t.sampledEnergy=t.sampledEnergy+t.power.energy end
 end
 if game.tick%36000==0 then log('STARTER_PROGRESS: '..(game.tick/3600)..' simulated minutes')end
 if game.tick==${ticks} then
  local report={gameVersion=script.active_mods.base,mapSeed=${mapSeed},simulatedMinutes=${minutes},fixtures='Only the declared raw materials at exterior belts/pipes and external electricity at P. Every saved pole and electric consumer is checked for connection to the P network. ${throughput?'Exterior belts receive continuous supply on both lanes, up to their saved capacity;':builds.every(b=>b.workshop)?'Workshop exterior belts are supplied continuously on both lanes, up to their saved capacity; inlet inserters are part of the tested design.':builds.some(b=>b.workshop)?'Workshop exterior belts receive continuous full supply; individual starter entrances receive up to two items per second.':'Belt fixtures supply up to two items per second per entrance;'} Fluid supply is continuous. Only the listed production research is enabled. Optional static input display panels are revived separately from their Circuit network construction unlock; their imported icons, text and Alt-mode settings are checked. No robots or direct machine inventory injection. ${throughput?'Outputs are collected each second after the warmup; reported rates use collected totals over the measurement window.':'Output chests fill naturally, are emptied halfway through, and must resume production. Outputs are sampled each second; chest counts are peak stock.'}',builds={}}
  for _,b in pairs(builds)do local t=storage.builds[b.id];local passed=true;local machines={};local recipeFluidCounts={};local recipeFluidFallbackCounts={}
   for id,e in pairs(t.entities)do
    if e.type=='assembling-machine' or e.type=='furnace' or e.type=='mining-drill' or e.type=='generator' then
     local crafting=e.type=='assembling-machine' or e.type=='furnace';local recipe=crafting and e.get_recipe()
     local status='unknown';for k,v in pairs(defines.entity_status)do if v==e.status then status=k end end
     local inventory=crafting and e.get_inventory(e.type=='furnace' and defines.inventory.furnace_source or defines.inventory.assembling_machine_input)
     local row={id=e.name,entity=e.unit_number,blueprintEntity=id,position=e.position,inventory=inventory and inventory.get_contents() or nil,recipe=recipe and recipe.name or nil,status=status,products=crafting and e.products_finished or nil,worked=t.worked[id],energy=e.energy}
     if ${throughput?'true':'false'} and crafting then
      row.measuredCrafts=e.products_finished-(t.warmupProducts[id] or 0);row.statusSeconds=t.machineSamples[id] or {}
      -- Factorio's fluid production statistics omit some crafting-with-fluid
      -- recipes (notably barreling). Keep a measured recipe boundary for that
      -- case; it is used only when the fluid counter under-reports it.
      if recipe then
       local activeDelta=((e.crafting_progress or 0)>0 and 1 or 0)-(t.warmupCrafting[id] or 0);local effectiveCrafts=row.measuredCrafts+activeDelta
       for _,ingredient in pairs(recipe.ingredients or {})do
        if ingredient.type=='fluid' and effectiveCrafts>0 then
         if ingredient.ignored_by_stats~=nil then recipeFluidCounts[ingredient.name]=(recipeFluidCounts[ingredient.name] or 0)+effectiveCrafts*ingredient.ignored_by_stats
         else recipeFluidFallbackCounts[ingredient.name]=(recipeFluidFallbackCounts[ingredient.name] or 0)+effectiveCrafts*ingredient.amount end
        end
       end
      end
     end
     machines[#machines+1]=row
     if crafting and e.products_finished==0 then passed=false end
     if (e.type=='mining-drill' or e.type=='generator') and not t.worked[id] then passed=false end
    end
   end
   for _,count in pairs(t.outputPorts)do if count==0 then passed=false end end
   for _,item in pairs(b.products)do if (t.delivered[item] or 0)==0 then passed=false end end
   if b.kind=='power' and t.sampledEnergy==0 then passed=false end
   if t.drained>0 and not t.restarted then passed=false end
   for id,_ in pairs(t.drainedPorts)do if not t.restartedPorts[id] then passed=false end end
   if b.workshop and ${throughput?'false':'true'} then for _,p in pairs(b.ports)do if p.kind=='output' and not t.restartedPorts[p.entity] then passed=false end end end
   local entry={id=b.id,blueprintSha256=b.blueprintSha256,portConfigurationSha256=b.portConfigurationSha256,kind=b.kind,passed=passed,firstOutputTick=t.firstOutputTick,testedTechnologies=b.researchClosure,rawInputs=b.rawInputs,removedAtHalfTime=t.drained,restartedAfterCollection=t.restarted,delivered=t.delivered,outputPorts=t.outputPorts,inputItems=t.fed,sampledLoadEnergy=t.sampledEnergy,machines=machines,fuel=t.fuel}
   if ${throughput?'true':'false'} then
    local finalInputs=consumption_counts(t.force,t.surface,b.rateInputs);local inputCounts={};local inputPerMinute={}
    for _,input in pairs(b.rateInputs or {})do
     local consumed=(finalInputs[input.name] or 0)-(t.warmupInputs and t.warmupInputs[input.name] or 0)
     if input.kind=='fluid' then
      consumed=consumed+(recipeFluidCounts[input.name] or 0)
      if consumed==0 and (recipeFluidFallbackCounts[input.name] or 0)>0 then consumed=recipeFluidFallbackCounts[input.name] end
     end
     if consumed<0 then consumed=0 end
     inputCounts[input.name]=consumed;inputPerMinute[input.name]=consumed/${minutes-warmupMinutes}
    end
    entry.inputPerMinute=inputPerMinute
    entry.throughput={
     warmupMinutes=${warmupMinutes},measuredMinutes=${minutes-warmupMinutes},
     period={startTick=${warmupTicks},endTick=${ticks},warmupMinutes=${warmupMinutes},measuredMinutes=${minutes-warmupMinutes},unit='per-minute'},
     rateBasis='Input rates use deltas from the consumption side (output_counts/get_output_count) of LuaForce item/fluid production statistics. For fluid ingredients marked ignored_by_stats, the measured completed-recipe boundary (products_finished delta plus active-craft boundary delta times the ignored amount) is added; an unignored fluid boundary is only a defensive fallback when its counter is absent. This records recipe ingredients and burner fuel actually consumed by the force on this surface, not belt supply or initial inventory. Output rates are continuously collected over the same post-warmup window.',
     collected=t.collected,warmupCollected=t.warmupCollected,perMinute={},inputPerMinute=inputPerMinute,inputCounts=inputCounts,recipeBoundaryInputCounts=recipeFluidCounts,recipeFallbackInputCounts=recipeFluidFallbackCounts
    }
    for item,count in pairs(t.collected)do entry.throughput.perMinute[item]=count/${minutes-warmupMinutes} end
   end
   entry.firstProductTicks=t.firstProductTicks
   entry.power=t.powerNetwork
   entry.powerNetwork=t.powerNetwork
   entry.surface=b.surface
   if b.loopControl then entry.loopControl={readerVerified=true,controlledInserters=#b.loopControl.controlled,loopBelts=#b.loopControl.loop,maxCirculating=t.maxCirculating}end
   entry.drainedPorts=t.drainedPorts;entry.restartedPorts=t.restartedPorts
   entry.inputDisplays={verified=0,optional=true,requiredTechnology='circuit-network'}
   for _,p in pairs(b.ports)do if p.displayEntity then entry.inputDisplays.verified=entry.inputDisplays.verified+1 end end
   if not passed then
    entry.transport={}
    for id,e in pairs(t.entities)do
     if e.type=='transport-belt' or e.type=='underground-belt' or e.type=='inserter' then
      entry.transport[#entry.transport+1]={id=id,name=e.name,position=e.position,direction=e.direction,pickup=e.type=='inserter' and e.pickup_position or nil,drop=e.type=='inserter' and e.drop_position or nil,items=e.type~='inserter' and {e.get_transport_line(1).get_contents(),e.get_transport_line(2).get_contents()} or nil}
     end
    end
   end
   report.builds[#report.builds+1]=entry
   log('STARTER_RESULT: '..helpers.table_to_json(entry))
  end
  if ${throughput?'true':'false'} then report.mode='throughput';report.warmupMinutes=${warmupMinutes};report.measuredMinutes=${minutes-warmupMinutes};report.period={startTick=${warmupTicks},endTick=${ticks},warmupMinutes=${warmupMinutes},measuredMinutes=${minutes-warmupMinutes},unit='per-minute'};report.rateBasis='Input rates use the consumption side (output_counts/get_output_count) of LuaForce item/fluid production statistics sampled at warmup and final tick. For fluid ingredients marked ignored_by_stats, measured completed-recipe and active-craft boundary adjustments are added; an unignored fluid boundary is only a defensive fallback when its counter is absent. Rates measure actual recipe and burner-fuel consumption rather than exterior feed acceptance; initial inventory is removed by the boundary delta. Output rates are collected continuously after warmup. Raw materials are supplied continuously to both lanes of each declared exterior belt, fluids and electricity are external, and no intermediate input, robots, direct machine inventory injection, speed modules, or extra research are used.' end
  helpers.write_file('${reportFile}',helpers.table_to_json(report),false)
 end
end)
`);
async function run(args,name){try{const r=await runFile(app+'/Contents/MacOS/factorio',['--config',root+'/config.ini','--mod-directory',mods,...args],{timeout:1800000,maxBuffer:16*1024*1024});await fs.writeFile(root+'/'+name+'.log',r.stdout+r.stderr);console.log(r.stdout.split('\n').filter(l=>l.includes('STARTERS_IMPORTED')).join('\n'));}catch(e){await fs.writeFile(root+'/'+name+'.log',String(e.stdout)+String(e.stderr));throw Error(String(e.stdout||e.message).slice(-3500));}}
await run(['--create',root+'/starter.zip','--map-gen-settings',root+'/map-gen-settings.json'],'create');await run(['--benchmark',root+'/starter.zip','--benchmark-ticks',String(ticks+1),'--benchmark-runs','1'],'simulation');
const report=JSON.parse(await fs.readFile(root+'/script-output/'+reportFile));
for(const b of report.builds)if(!Array.isArray(b.machines))b.machines=[];
await fs.writeFile(root+'/'+reportFile,JSON.stringify(report,null,2)+'\n');
for(const b of report.builds)console.log(JSON.stringify({id:b.id,passed:b.passed,delivered:b.delivered,power:b.sampledLoadEnergy,stalled:b.machines.filter(m=>m.products===0).map(m=>[m.id,m.recipe,m.status])}));
assert.equal(report.builds.length,builds.length);assert.deepEqual(report.builds.filter(b=>!b.passed).map(b=>b.id),[],'Every saved starter layout must actually deliver through all declared outputs.');
if(!throughput&&!process.env.STARTER_TEST_IDS)await fs.writeFile(sourceRoot+'/validation.json',JSON.stringify(report,null,2)+'\n');
console.log('All '+builds.length+' starter layouts passed native delivery checks.');
