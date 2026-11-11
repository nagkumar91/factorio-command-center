-- Embedded scenario: only the installed mods are needed to load the resulting save.
local map_settings=require("map-settings")
local progression=require("progression")
local MAX_RESOURCE_AMOUNT=4294967295
local function maximize_resources(surface,area)
  local count=0
  for _,entity in pairs(surface.find_entities_filtered{type='resource',area=area}) do
    entity.amount=MAX_RESOURCE_AMOUNT
    if entity.initial_amount then entity.initial_amount=MAX_RESOURCE_AMOUNT end
    assert(entity.amount==MAX_RESOURCE_AMOUNT,'Resource amount did not retain uint32 maximum')
    count=count+1
  end
  return count
end
script.on_event(defines.events.on_chunk_generated,function(event)
  if event.surface.name=='nauvis' then maximize_resources(event.surface,event.area) end
end)
local function label(surface, name, position, icon)
  game.forces.player.add_chart_tag(surface,{position=position,text=name,icon=icon})
end
script.on_init(function()
  local s=game.surfaces.nauvis
  local f=game.forces.player
  -- The generator supplies the full mod-aware map settings in map-settings.lua.
  -- Do not call surface.clear here: its deferred clear can erase the prepared
  -- entities on the first tick after the scenario is converted to a save.
  s.map_gen_settings=map_settings
  s.request_to_generate_chunks({0,0},20);s.force_generate_chunk_requests()
  local chunks={};for x=-20,20 do for y=-20,20 do chunks[#chunks+1]={x=x,y=y} end end
  s.set_territory_for_chunks(chunks,nil)
  for _,e in pairs(s.find_entities_filtered{area={{-640,-640},{640,640}},force='enemy'}) do e.destroy() end
  -- Clear only the designed core; preserve the wilderness outside it.
  for _,e in pairs(s.find_entities_filtered{area={{-300,-280},{300,280}}}) do if e.valid then e.destroy() end end
  local tiles={};for x=-300,299 do for y=-280,279 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end;s.set_tiles(tiles)
  local function patch(name,cx,cy,radius)
    local total=0
    for x=-radius,radius do for y=-radius,radius do
      if x*x+y*y<=radius*radius then
        local amount=MAX_RESOURCE_AMOUNT
        local e=s.create_entity{name=name,position={cx+x,cy+y},amount=amount}
        if e then total=total+amount end
      end
    end end
    assert(total>0,'Missing resource '..name)
    label(s,name,{cx,cy},{type='item',name=(name=='scrap' and 'scrap' or name)})
    return total
  end
  local resources={}
  for _,p in ipairs({{'iron-ore',-110,-90,22},{'copper-ore',-110,0,22},{'coal',-110,90,18},{'stone',-210,90,16},{'uranium-ore',210,180,16},{'calcite',-210,-170,16},{'tungsten-ore',-110,-190,18},{'holmium-ore',10,-190,16},{'scrap',110,-190,16}}) do resources[p[1]]=patch(table.unpack(p)) end
  for i,name in ipairs({'crude-oil','sulfuric-acid-geyser','lithium-brine','fluorine-vent'}) do
    local cx=-240+(i-1)*140
    for j=0,5 do assert(s.create_entity{name=name,position={cx+(j%3)*10,230+math.floor(j/3)*10},amount=MAX_RESOURCE_AMOUNT}) end
    resources[name]=6*MAX_RESOURCE_AMOUNT;label(s,name,{cx+10,230})
  end
  local function lake(name,cx,cy,w,h)
    local t={};for x=cx,cx+w-1 do for y=cy,cy+h-1 do t[#t+1]={name=name,position={x,y}} end end;s.set_tiles(t)
    label(s,name,{cx+w/2,cy+h/2})
  end
  lake('water',40,90,45,25);lake('lava',140,-120,35,25);lake('ammoniacal-ocean',200,-120,35,25)
  local fish=0
  for x=44,76,8 do for y=94,110,8 do assert(s.create_entity{name='fish',position={x,y}});fish=fish+1 end end
  for i,v in ipairs({{'natural-yumako-soil','yumako-tree'},{'natural-jellynut-soil','jellystem'}}) do
    local x0=120+(i-1)*65;local t={};for x=x0,x0+44 do for y=15,59 do t[#t+1]={name=v[1],position={x,y}} end end;s.set_tiles(t)
    for x=x0+3,x0+41,6 do for y=18,56,6 do s.create_entity{name=v[2],position={x,y}} end end
    label(s,v[2],{x0+22,37})
  end
  -- Guaranteed green belt, leaving cardinal corridors and the factory core open.
  local trees=0
  for x=-295,295,4 do for y=-275,275,4 do
    if (math.abs(x)>260 or math.abs(y)>255) and math.abs(x)>12 and math.abs(y)>12 and s.can_place_entity{name='tree-01',position={x,y}} then
      s.create_entity{name='tree-01',position={x,y}};trees=trees+1
    end
  end end
  -- 480 solar panels and 420 accumulators, connected by a substation grid.
  for bx=0,5 do for by=0,4 do
    local x=bx*18-45;local y=by*18-110
    assert(s.create_entity{name='substation',position={x,y},force=f})
    for _,dx in ipairs({-6,-3,3,6}) do for _,dy in ipairs({-6,-3,3,6}) do
      assert(s.can_place_entity{name='solar-panel',position={x+dx,y+dy},force=f})
      assert(s.create_entity{name='solar-panel',position={x+dx,y+dy},force=f})
    end end
    for _,d in ipairs({-7,-5,-3,3,5,7}) do for _,p in ipairs({{x,y+d},{x+d,y}}) do
      assert(s.can_place_entity{name='accumulator',position=p,force=f})
      local e=assert(s.create_entity{name='accumulator',position=p,force=f});e.energy=5000000
    end end
  end end
  for bx=0,4 do
    local x=bx*18-45;local y=-20
    assert(s.create_entity{name='substation',position={x,y},force=f})
    for _,dx in ipairs({-6,-4,-2,2,4,6}) do for _,dy in ipairs({-4,4}) do
      local p={x+dx,y+dy};assert(s.can_place_entity{name='accumulator',position=p,force=f})
      local e=assert(s.create_entity{name='accumulator',position=p,force=f});e.energy=5000000
    end end
  end
  label(s,'Solar power — connect your factory here',{0,-75},{type='item',name='solar-panel'})
  local kit={['iron-plate']=2000,['copper-plate']=1000,['steel-plate']=200,['electronic-circuit']=300,['electric-mining-drill']=32,['stone-furnace']=48,['assembling-machine-1']=24,['inserter']=100,['transport-belt']=800,['underground-belt']=40,['splitter']=20,['small-electric-pole']=100,['medium-electric-pole']=50,['lab']=12,['pipe']=100,['pipe-to-ground']=30,['offshore-pump']=4,['coal']=500,['wood']=300,['firearm-magazine']=200,['gun-turret']=16,['repair-pack']=50,['tree-seed']=200}
  local names={};for n in pairs(kit) do names[#names+1]=n end;table.sort(names)
  for i,n in ipairs(names) do local e=assert(s.create_entity{name='steel-chest',position={-18+(i-1)%12*3,18+math.floor((i-1)/12)*3},force=f});assert(e.insert{name=n,count=kit[n]}==kit[n]) end
  label(s,'Starter supplies — robots remain yours to research',{0,18},{type='item',name='steel-chest'})
  -- Stromatolites need walkable wetland; ordinary grass blocks their ground_tile mask.
  local specimen_tiles={}
  for _,cx in ipairs({230,236}) do for x=cx-1,cx+1 do for y=109,111 do
    specimen_tiles[#specimen_tiles+1]={name='wetland-light-green-slime',position={x,y}}
  end end end
  s.set_tiles(specimen_tiles)
  local progression_state=progression.init(s,f)
  for _,name in ipairs({'iron-stromatolite','copper-stromatolite','lithium-iceberg-big'}) do
    assert(progression_state.specimens[name] and progression_state.specimens[name].valid,'Missing progression specimen '..name)
  end
  f.recipes['wood-processing'].enabled=true
  f.manual_crafting_speed_modifier=1
  f.laboratory_speed_modifier=1
  f.set_spawn_position({0,6},s);f.chart(s,{{-320,-300},{320,300}})
  assert(not f.technologies['construction-robotics'].researched)
  assert(not f.technologies['logistic-robotics'].researched)
  local grid_id
  for _,e in pairs(s.find_entities_filtered{name='substation',force=f}) do
    grid_id=grid_id or e.electric_network_id
    assert(e.electric_network_id==grid_id,'Disconnected substation grid')
  end
  for _,e in pairs(s.find_entities_filtered{name={'solar-panel','accumulator'},force=f}) do
    assert(e.is_connected_to_electric_network(),'Unpowered solar/accumulator entity')
  end
  assert(s.count_entities_filtered{name='solar-panel',force=f}==480)
  assert(s.count_entities_filtered{name='accumulator',force=f}==420)
  assert(s.count_entities_filtered{area={{-630,-630},{630,630}},force='enemy'}==0)
  local maxed_resources=maximize_resources(s)
  storage.flight={maxResourcePerEntity=MAX_RESOURCE_AMOUNT,resourceEntitiesMaxed=maxed_resources,futureChunksMaxed=true,resources=resources,trees=trees,fish=fish,starterVolcanicRocks=#progression_state.rocks,progressionSpecimens=3,solarPanels=480,accumulators=420,robotResearch=false,treeRecipe=true,peacefulMode=s.peaceful_mode,enemyFreeRadius=640,craftingSpeedMultiplier=2,laboratorySpeedMultiplier=2}
  helpers.write_file('flight-map-report.json',helpers.table_to_json(storage.flight),false)
  storage.flight_bootstrap_pending=true
  log('FLIGHT_MAP_VALIDATED')
end)
script.on_event(defines.events.on_research_finished,progression.on_research_finished)
script.on_event(defines.events.on_tick,function(event)
  if storage.flight_bootstrap_pending and event.tick>0 then
    -- Some installed mods reset recipe effects during initialization. Apply the
    -- one authorized early recipe after all initialization handlers have run.
    local f=game.forces.player;local s=game.surfaces.nauvis
    f.recipes['wood-processing'].enabled=true
    assert(not f.technologies['construction-robotics'].researched)
    assert(not f.technologies['logistic-robotics'].researched)
    assert(s.count_entities_filtered{name='solar-panel',force=f}==480)
    assert(s.count_entities_filtered{name='accumulator',force=f}==420)
    assert(s.count_entities_filtered{type='resource'}>0)
    assert(settings.global['starter-init-auto-grant-on-join'].value==false)
    storage.flight_bootstrap_pending=false
    helpers.write_file('flight-map-loaded-report.json',helpers.table_to_json({passed=true,tick=event.tick,treeRecipe=f.recipes['wood-processing'].enabled,robotResearch=false,solarPanels=480,accumulators=420,resourceEntities=s.count_entities_filtered{type='resource'},starterAutoGrant=false}),false)
  end
  progression.on_tick(event)
end)
script.on_event(defines.events.on_player_created,function(event)
  local p=game.get_player(event.player_index)
  if not p.character then p.create_character() end
  p.teleport({0,6},game.surfaces.nauvis)
  p.insert{name='pistol',count=1}
  p.insert{name='firearm-magazine',count=20}
  p.print('Welcome to Flight Forest! Starter chests south, solar grid north. Robots are yours to research. Wood processing and tree seeds are available now. Normal enemies live beyond the safe starting area.')
end)
