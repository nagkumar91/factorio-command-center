-- Copied into a control-only mod in .cache/flight-native. No data-stage changes.
local payload = helpers.json_to_table(require('payload'))
local builds = payload.builds or {payload}
local handlers = {}
local function install(b,index)
local handler = {id=b.id,spec=b,hasBelts=false}
for _,p in pairs(b.inputs) do if b.entityTypes[b.entities[1].name] and p.type=='item' then
  for _,e in pairs(b.entities) do if e.entity_number==p.entityNumber and b.entityTypes[e.name]=='transport-belt' then handler.hasBelts=true end end
end end
handlers[#handlers+1]=handler
local function check(ok, message) if not ok then error('FLIGHT_NATIVE: '..message) end end
local function key(p) return p.type..':'..p.name end
local function entity_description(e)
  return e and {name=e.name,position=e.position,unitNumber=e.unit_number} or nil
end
local function waste_route(arm)
  return {tick=game.tick,pickupTarget=entity_description(arm.pickup_target),dropTarget=entity_description(arm.drop_target),pickupPosition=arm.pickup_position,dropPosition=arm.drop_position}
end
local function shifted(p, t) return {x=p.x+t.dx,y=p.y+t.dy} end
local function status_name(e)
  for name,value in pairs(defines.entity_status) do if value==e.status then return name end end
  return tostring(e.status)
end
local function counts(inv)
  local out={}
  if inv and inv.valid then for _,v in pairs(inv.get_contents()) do out[v.name]=(out[v.name] or 0)+v.count end end
  return out
end
local function statistic(t,p,production)
  local stats=p.type=='fluid' and t.force.get_fluid_production_statistics(t.surface) or t.force.get_item_production_statistics(t.surface)
  if production then return stats.get_input_count(p.name) else return stats.get_output_count(p.name) end
end
local function producer_crafts(t,p)
  local n=0
  for _,id in pairs(b.outputProducerEntityIds[key(p)] or {}) do
    local e=t.entities[id];local recipe=e.get_recipe()
    check(not recipe or recipe.name==b.expectedRecipes[tostring(id)] or recipe.name==b.expectedRecipes[id],'producer recipe changed '..id)
    n=n+e.products_finished
  end
  return n
end
local function power_fixture(t)
  local pole=t.entities[b.powerPoleId]
  check(pole and pole.type=='electric-pole','declared power pole missing')
  local reach=pole.prototype.get_supply_area_distance(pole.quality)
  for radius=1,math.ceil(reach) do for dx=-radius,radius do for dy=-radius,radius do
    if math.max(math.abs(dx),math.abs(dy))==radius then
      local position={x=pole.position.x+dx,y=pole.position.y+dy}
      if t.surface.can_place_entity{name='electric-energy-interface',position=position,force=t.force} then
        local e=t.surface.create_entity{name='electric-energy-interface',position=position,force=t.force}
        if e.electric_network_id==pole.electric_network_id then
          e.electric_buffer_size=10000000000;e.power_production=10000000000;e.power_usage=0
          t.powerFixture=e;t.powerPole=pole
          t.fixtures[#t.fixtures+1]={kind='external-power',entity=e,position=e.position}
          return
        end
        e.destroy()
      end
    end
  end end end
  error('FLIGHT_NATIVE: no space in declared power pole supply area')
end
local function fluid_fixture(t,p)
  local position=shifted(p.fixturePosition,t)
  check(t.surface.can_place_entity{name='infinity-pipe',position=position,force=t.force},'blocked external fluid fixture '..key(p))
  local e=t.surface.create_entity{name='infinity-pipe',position=position,force=t.force}
  e.set_infinity_pipe_filter{name=p.name,percentage=1,mode='at-least',temperature=p.temperature or prototypes.fluid[p.name].default_temperature}
  local port=t.entities[p.entityNumber]
  local connected=false
  for i=1,#e.fluidbox do for _,c in pairs(e.fluidbox.get_pipe_connections(i)) do
    if c.target then
      check(c.target.owner==port,'fluid fixture contacts undeclared entity '..key(p))
      connected=true
    end
  end end
  check(connected,'fluid fixture does not connect to declared port '..key(p))
  t.fixtures[#t.fixtures+1]={kind='external-fluid',entity=e,port=p.entityNumber,name=p.name,position=e.position}
end
local function write_report(t, tick)
  local containers,inserters,diagnosticErrors={},{},{}
  -- Optional read-only transport diagnostics never change native inventories,
  -- filters or control behavior. Missing diagnostics remain explicitly reported.
  local diagnosticOk,diagnosticError=pcall(function()
    local byUnit={}
    for id,e in pairs(t.entities) do if e.valid then byUnit[e.unit_number]=id end end
    local function identified(e)
      local d=entity_description(e)
      if d then d.entityNumber=byUnit[e.unit_number] end
      return d
    end
    for id,e in pairs(t.entities) do
      if e.type=='container' or e.type=='logistic-container' then
        local points={}
        if e.type=='logistic-container' then for _,point in pairs(e.get_logistic_point() or {}) do
          local sections={}
          for _,s in pairs(point.sections) do sections[#sections+1]={index=s.index,active=s.active,multiplier=s.multiplier,group=s.group,filters=s.filters} end
          points[#points+1]={enabled=point.enabled,mode=point.mode,exact=point.exact,filters=point.filters,sections=sections,
            delivering=point.targeted_items_deliver,pickingUp=point.targeted_items_pickup}
        end end
        containers[#containers+1]={entityNumber=id,name=e.name,position=e.position,unitNumber=e.unit_number,status=status_name(e),
          inventory=counts(e.get_inventory(defines.inventory.chest)),logisticPoints=points}
      elseif e.type=='inserter' then
        local held=e.held_stack
        local filters={}
        for i=1,e.filter_slot_count do local f=e.get_filter(i);if f then filters[#filters+1]={index=i,filter=f} end end
        inserters[#inserters+1]={entityNumber=id,name=e.name,position=e.position,status=status_name(e),
          pickup=identified(e.pickup_target),drop=identified(e.drop_target),pickupPosition=e.pickup_position,dropPosition=e.drop_position,
          heldStack=held.valid_for_read and {name=held.name,count=held.count,quality=held.quality.name} or nil,
          heldStackPosition=e.held_stack_position,useFilters=e.use_filters,filterMode=e.inserter_filter_mode,filters=filters,stackSizeOverride=e.inserter_stack_size_override}
      end
    end
  end)
  if not diagnosticOk then diagnosticErrors[#diagnosticErrors+1]='transport-diagnostics: '..tostring(diagnosticError) end
  local machines={}
  for id,e in pairs(t.entities) do if e.type=='assembling-machine' or e.type=='furnace' then
    local recipe=e.get_recipe()
    local fluids={}
    for i=1,#e.fluidbox do
      local fluid=e.fluidbox[i]
      local connections={}
      for _,c in pairs(e.fluidbox.get_pipe_connections(i)) do
        local target=c.target and c.target.owner
        connections[#connections+1]={position=c.position,targetPosition=c.target_position,flowDirection=c.flow_direction,connectionType=c.connection_type,
          targetFluidboxIndex=c.target_fluidbox_index,targetEntity=target and {name=target.name,position=target.position,unitNumber=target.unit_number}}
      end
      fluids[#fluids+1]={index=i,name=fluid and fluid.name,amount=fluid and fluid.amount or 0,temperature=fluid and fluid.temperature,capacity=e.fluidbox.get_capacity(i),
        filter=e.fluidbox.get_filter(i),lockedFluid=e.fluidbox.get_locked_fluid(i),segmentId=e.fluidbox.get_fluid_segment_id(i),segmentContents=e.fluidbox.get_fluid_segment_contents(i),connections=connections}
    end
    local burner=e.burner
    machines[#machines+1]={entityNumber=id,name=e.name,recipe=recipe and recipe.name,position=e.position,status=status_name(e),
      productsFinished=e.products_finished,measuredCrafts=e.products_finished-(t.warmupCrafts[id] or 0),statusSeconds=t.machineSamples[id],
      fluidboxes=fluids,recipeIngredients=recipe and recipe.prototype.ingredients,recipeProducts=recipe and recipe.prototype.products,
      craftingProgress=e.crafting_progress,remainingBurningFuel=burner and burner.remaining_burning_fuel,
      inputInventory=counts(e.get_inventory(e.type=='furnace' and defines.inventory.furnace_source or defines.inventory.assembling_machine_input)),
      outputInventory=counts(e.get_output_inventory()),fuelInventory=counts(e.get_fuel_inventory())}
  end end
  local inputs={}
  for _,p in pairs(b.inputs) do
    local k=key(p)
    if not inputs[k] then
      local consumed=statistic(t,p,false)-(t.warmupConsumption[k] or 0)
      inputs[k]={acceptedItems=t.fed[k] or 0,consumed=not b.statisticsIgnoredInputs[k] and consumed or nil,consumedPerMinute=not b.statisticsIgnoredInputs[k] and consumed/(b.measurementTicks/3600) or nil,
        statisticsCount=consumed,statisticsCountsExcluded=b.statisticsIgnoredInputs[k] or false,
        measuredAcceptedItems=(t.fed[k] or 0)-(t.warmupFed[k] or 0),
        supply=p.type=='fluid' and 'external-infinity-pipe' or 'declared-boundary-chest-or-belt'}
    end
  end
  local output={}
  for k,row in pairs(t.outputs) do output[k]=row end
  local fixtures={}
  for _,row in pairs(t.fixtures) do fixtures[#fixtures+1]={kind=row.kind,port=row.port,name=row.name,position=row.position,entityName=row.entity.name} end
  local logistics={}
  for id,e in pairs(t.entities) do if e.type=='roboport' then
    local n=e.logistic_network
    logistics[#logistics+1]={entityNumber=id,robotInventory=counts(e.get_inventory(defines.inventory.roboport_robot)),
      allLogisticRobots=n and n.all_logistic_robots or 0,availableLogisticRobots=n and n.available_logistic_robots or 0}
  end end
  local report={id=b.id,blueprintSha256=b.blueprintSha256,prototypeDumpSha256=b.prototypeDumpSha256,
    configurationSha256=b.configurationSha256,specSha256=b.specSha256,gameVersion=script.active_mods.base,activeMods=script.active_mods,
    completedTick=tick,importedEntities=t.importedEntities,warmupTicks=b.warmupTicks,measurementTicks=b.measurementTicks,windows=b.windows,
    isolation={surface=t.surface.name,force=t.force.name,mapSeed=12345,blueprintOffset={x=t.dx,y=t.dy}},
    outputs=output,wasteCollected=t.wasteCollected,inputs=inputs,machines=machines,containers=containers,inserters=inserters,diagnosticErrors=diagnosticErrors,fixtures=fixtures,infrastructureSeeds=t.seeded,materialSeeds=t.materialSeeded,remainingSeedDebits=t.seedDebits,logistics=logistics,
    power=t.power,initialVisualEffects=t.initialVisualEffects,verifiedResourceSources=b.verifiedResourceSources,surfaceProperties=b.surfaceProperties,researchPolicy=b.enableAllRecipes and 'all-recipes-enabled-without-research-bonuses' or 'declared-research-closure',
    testedTechnologies=b.researchClosure or {},rejections=t.rejections,portPolicy='Declared raw boundaries only; no machine inventory or internal pipe writes.'}
  helpers.write_file('flight-native-'..b.id..'.json',helpers.table_to_json(report),false)
  log('FLIGHT_NATIVE_COMPLETE '..b.id..' tick='..tick)
end

handler.init=function()
  check(script.active_mods.base=='2.0.77','expected Factorio 2.0.77')
  local force=game.create_force('flight-native-'..index)
  if b.enableAllRecipes then force.enable_all_recipes() else
    for _,name in pairs(b.researchClosure or {}) do check(force.technologies[name]~=nil,'missing technology '..name);force.technologies[name].researched=true end
  end
  local minx,miny,maxx,maxy=0,0,0,0
  for _,e in pairs(b.entities) do minx=math.min(minx,e.position.x);miny=math.min(miny,e.position.y);maxx=math.max(maxx,e.position.x);maxy=math.max(maxy,e.position.y) end
  local halfx=math.ceil((maxx-minx+64)/64)*32+64
  local halfy=math.ceil((maxy-miny+64)/64)*32+64
  local surface=game.create_surface('flight-native-'..index,{seed=12345,width=halfx*2,height=halfy*2,default_enable_all_autoplace_controls=false,
    autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  for property,value in pairs(b.surfaceProperties) do surface.set_property(property,value) end
  surface.request_to_generate_chunks({0,0},math.ceil(math.max(halfx,halfy)/32));surface.force_generate_chunk_requests()
  for _,e in pairs(surface.find_entities()) do e.destroy() end
  local tiles={}
  for x=-halfx,halfx-1 do for y=-halfy,halfy-1 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end
  surface.set_tiles(tiles)
  local t={surface=surface,force=force,entities={},fixtures={},outputs={},wasteCollected={},fed={},seeded={},materialSeeded={},seedDebits={},machineSamples={},warmupCrafts={},
    warmupConsumption={},warmupFed={},rejections={},power={},initialVisualEffects={},importedEntities=0}
  storage.flights[b.id]=t
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'}
  check(inv[1].import_stack(b.code)==0,'blueprint import failed')
  local ghosts=inv[1].build_blueprint{surface=surface,force=force,position={0,0},build_mode=defines.build_mode.forced}
  check(#ghosts==#b.entities,'ghost count '..#ghosts..' expected '..#b.entities)
  for _,g in pairs(ghosts) do
    local id=g.tags and g.tags.flight_entity
    check(id and not t.entities[id],'missing or duplicate flight_entity tag')
    local _,e,proxy=g.revive{raise_revive=true}
    check(e~=nil,'could not revive '..tostring(id))
    check(not proxy,'unexpected preloaded item request '..tostring(id))
    t.entities[id]=e;t.importedEntities=t.importedEntities+1
  end
  local first=b.entities[1];local real=t.entities[first.entity_number]
  t.dx=real.position.x-first.position.x;t.dy=real.position.y-first.position.y
  for _,saved in pairs(b.entities) do
    local e=t.entities[saved.entity_number]
    check(e and e.name==saved.name,'entity name changed '..saved.entity_number)
    check(e.type==b.entityTypes[e.name],'entity prototype type changed '..e.name)
    check(e.position.x==saved.position.x+t.dx and e.position.y==saved.position.y+t.dy,'position changed '..saved.entity_number)
    check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
    check(e.quality.name=='normal','quality changed '..saved.entity_number)
    if saved.recipe then check(e.get_recipe() and e.get_recipe().name==saved.recipe,'recipe changed '..saved.entity_number) end
    if e.type=='assembling-machine' or e.type=='furnace' then
      local r=e.get_recipe()
      check((r and force.recipes[r.name].enabled) or (e.type=='furnace' and not r),'locked or missing recipe '..saved.entity_number)
      t.machineSamples[saved.entity_number]={}
      check(e.products_finished==0,'nonempty initial production')
    end
  end
  for _,p in pairs(b.inputs) do
    local e=t.entities[p.entityNumber];check(e~=nil,'input port missing')
    if p.type=='fluid' then fluid_fixture(t,p) end
  end
  power_fixture(t)
  for _,seed in pairs(b.infrastructureSeeds) do
    local e=t.entities[seed.entityNumber]
    for _,candidate in pairs(t.entities) do if candidate.type=='inserter' then
      check(candidate.pickup_target~=e,'inserter can extract fixture infrastructure robots')
    end end
    local n=e.get_inventory(defines.inventory.roboport_robot).insert{name=seed.item,count=seed.count,quality='normal'}
    check(n==seed.count,'infrastructure robot inventory too small')
    t.seeded[#t.seeded+1]={entityNumber=seed.entityNumber,item=seed.item,count=n,purpose='logistics-infrastructure-only'}
  end
  for _,seed in pairs(b.materialSeeds or {}) do
    local e=t.entities[seed.entityNumber]
    local n=e.get_inventory(defines.inventory.chest).insert{name=seed.name,count=seed.count,quality='normal'}
    check(n==seed.count,'declared material seed does not fit boundary chest')
    t.seedDebits[key(seed)]=(t.seedDebits[key(seed)] or 0)+n
    t.materialSeeded[#t.materialSeeded+1]={entityNumber=seed.entityNumber,type=seed.type,name=seed.name,count=n,replenished=false}
  end
  for _,p in pairs(b.outputs) do
    local k=key(p)
    if not t.outputs[k] then
      local row={warmupCollected=0,collectionEvents=0,windowCounts={},windowProduced={},windowProducerCrafts={},measuredProduced=0,measuredProducerCrafts=0,
        producerEntityIds=b.outputProducerEntityIds[k] or {},productionStatisticsIgnored=b.statisticsIgnoredOutputs[k] or false,baselineProduced=statistic(t,p,true),baselineProducerCrafts=producer_crafts(t,p)}
      for i=1,b.windows do row.windowCounts[i]=0;row.windowProduced[i]=0;row.windowProducerCrafts[i]=0 end
      t.outputs[k]=row
    end
  end
  for _,p in pairs(b.wasteOutputs or {}) do
    local arm,source,chest=t.entities[p.inserterEntityNumber],t.entities[p.sourceEntityNumber],t.entities[p.entityNumber]
    -- Revived inserters resolve their targets on the next engine tick. Check
    -- strict native identities at tick 60, before any waste is removed.
    check(arm.use_filters and arm.inserter_filter_mode=='whitelist','waste inserter is not exclusively filtered')
    local filterCount=0
    for i=1,arm.filter_slot_count do local f=arm.get_filter(i);if f then
      check(f.name==p.name and (not f.quality or f.quality=='normal') and (not f.comparator or f.comparator=='='),'unexpected waste filter')
      filterCount=filterCount+1
    end end
    check(filterCount==1,'waste inserter needs one exclusive filter')
    local row={type=p.type,name=p.name,entityNumber=p.entityNumber,sourceEntityNumber=p.sourceEntityNumber,inserterEntityNumber=p.inserterEntityNumber,
      spoiledFrom=p.spoiledFrom,nativeRoutingVerified=false,initialRoute=waste_route(arm),warmupCollected=0,measuredCollected=0,windowCounts={},collectionEvents=0,purpose='Spoilage disposal only; excluded from manufactured outputs and rate gates.'}
    for i=1,b.windows do row.windowCounts[i]=0 end
    t.wasteCollected[tostring(p.entityNumber)]=row
  end
  local expected={}
  for _,e in pairs(t.entities) do expected[e.unit_number]=true end
  for _,row in pairs(t.fixtures) do expected[row.entity.unit_number]=true end
  for _,e in pairs(surface.find_entities()) do if not expected[e.unit_number] then
    if e.type=='explosion' or e.type=='smoke-with-trigger' or e.type=='trivial-smoke' then
      t.initialVisualEffects[#t.initialVisualEffects+1]={name=e.name,type=e.type,position=e.position}
    else check(false,'unexpected initial entity '..e.name) end
  end end
  inv.destroy()
  log('FLIGHT_NATIVE_IMPORTED '..b.id..' entities='..t.importedEntities)
end

-- Supply only boundary inventories or belt entrances. Inserters, requesters and
-- pipes in the saved blueprint perform all subsequent transport and crafting.
handler.supply=function(beltsOnly)
  local t=storage.flights[b.id]
  if not t or game.tick>b.warmupTicks+b.measurementTicks then return end
  for _,p in pairs(b.inputs) do if p.type=='item' then
    local e=t.entities[p.entityNumber];local k=key(p);local added=0
    if e.type=='transport-belt' and beltsOnly then
      if not p.supplyRatePerSecond or game.tick%math.max(1,math.ceil(120/p.supplyRatePerSecond))==0 then
        for lane=1,2 do if e.get_transport_line(lane).insert_at_back{name=p.name,count=1} then added=added+1 end end
      end
    elseif e.type~='transport-belt' and not beltsOnly then
      local inventory=e.get_inventory(defines.inventory.chest)
      local capacity=p.bufferCount or prototypes.item[p.name].stack_size*10
      local missing=math.max(0,capacity-inventory.get_item_count(p.name))
      if p.supplyRatePerSecond then missing=math.min(missing,math.floor(game.tick/60*p.supplyRatePerSecond)-math.floor((game.tick/60-1)*p.supplyRatePerSecond)) end
      if missing>0 then added=inventory.insert{name=p.name,count=missing,quality='normal'} end
    end
    t.fed[k]=(t.fed[k] or 0)+added
  end end
end

handler.measure=function()
  local t=storage.flights[b.id]
  if not t or game.tick==0 or game.tick>b.warmupTicks+b.measurementTicks then return end
  if game.tick==60 then
    local network=t.powerPole.electric_network_id
    check(network~=nil and t.powerFixture.electric_network_id==network,'power fixture is disconnected')
    t.power={singleSavedBoundaryPole=b.powerPoleId,allConsumersConnected=true,connectedConsumers=0}
    for id,e in pairs(t.entities) do
      if e.type=='assembling-machine' or e.type=='furnace' then
        local recipe=e.get_recipe()
        check(not recipe or t.force.recipes[recipe.name].enabled,'research policy was reset after initialization: '..id)
      end
      if e.prototype.electric_energy_source_prototype or e.type=='electric-pole' then
        if e.electric_network_id~=network then
          t.rejections[#t.rejections+1]='disconnected-electric-entity:'..id;t.power.allConsumersConnected=false
        else t.power.connectedConsumers=t.power.connectedConsumers+1 end
      end
    end
  end
  for id,samples in pairs(t.machineSamples) do
    local e=t.entities[id];local name=status_name(e)
    if game.tick>b.warmupTicks then samples[name]=(samples[name] or 0)+1 end
    if game.tick==b.warmupTicks then t.warmupCrafts[id]=e.products_finished end
  end
  for _,p in pairs(b.outputs) do
    local row=t.outputs[key(p)];local e=t.entities[p.entityNumber];local n=0
    if p.type=='fluid' then n=e.get_fluid_count(p.name);if n>0 then n=e.remove_fluid{name=p.name,amount=n} end
    elseif e.type=='transport-belt' then
      for lane=1,2 do local line=e.get_transport_line(lane);local available=line.get_item_count(p.name);if available>0 then n=n+line.remove_item{name=p.name,count=available} end end
    else local available=e.get_item_count(p.name);if available>0 then n=e.get_inventory(defines.inventory.chest).remove{name=p.name,count=available,quality='normal'} end end
    if n>0 and (t.seedDebits[key(p)] or 0)>0 then
      local debit=math.min(n,t.seedDebits[key(p)]);n=n-debit;t.seedDebits[key(p)]=t.seedDebits[key(p)]-debit
      row.startupExcluded=(row.startupExcluded or 0)+debit
    end
    if n>0 then
      if not row.firstOutputTick then row.firstOutputTick=game.tick end
      row.lastOutputTick=game.tick;row.collectionEvents=row.collectionEvents+1
      if game.tick<=b.warmupTicks then row.warmupCollected=row.warmupCollected+n else
        local window=math.ceil((game.tick-b.warmupTicks)/(b.measurementTicks/b.windows))
        row.windowCounts[window]=row.windowCounts[window]+n
      end
    end
  end
  for _,p in pairs(b.wasteOutputs or {}) do
    local chest,arm=t.entities[p.entityNumber],t.entities[p.inserterEntityNumber]
    local row=t.wasteCollected[tostring(p.entityNumber)]
    row.lastRoute=waste_route(arm)
    check(arm.pickup_target==t.entities[p.sourceEntityNumber] and arm.drop_target==chest and arm.use_filters and arm.inserter_filter_mode=='whitelist','waste routing mismatch at '..p.entityNumber..' '..helpers.table_to_json(row.lastRoute))
    row.nativeRoutingVerified=true
    local available=chest.get_item_count(p.name)
    local n=available>0 and chest.get_inventory(defines.inventory.chest).remove{name=p.name,count=available,quality='normal'} or 0
    if n>0 then
      row.collectionEvents=row.collectionEvents+1
      if game.tick<=b.warmupTicks then row.warmupCollected=row.warmupCollected+n else
        local window=math.ceil((game.tick-b.warmupTicks)/(b.measurementTicks/b.windows))
        row.windowCounts[window]=row.windowCounts[window]+n;row.measuredCollected=row.measuredCollected+n
      end
    end
  end
  local seen={}
  for _,p in pairs(b.outputs) do local k=key(p);if not seen[k] then
    seen[k]=true
    local row=t.outputs[k]
    if game.tick==b.warmupTicks then
      row.baselineProduced=statistic(t,p,true);row.previousProduced=row.baselineProduced
      row.baselineProducerCrafts=producer_crafts(t,p);row.previousProducerCrafts=row.baselineProducerCrafts
    end
    if game.tick>b.warmupTicks and (game.tick-b.warmupTicks)%(b.measurementTicks/b.windows)==0 then
      local window=(game.tick-b.warmupTicks)/(b.measurementTicks/b.windows)
      local produced=statistic(t,p,true)
      row.windowProduced[window]=produced-row.previousProduced;row.previousProduced=produced
      row.measuredProduced=produced-row.baselineProduced
      local crafts=producer_crafts(t,p)
      row.windowProducerCrafts[window]=crafts-row.previousProducerCrafts;row.previousProducerCrafts=crafts
      row.measuredProducerCrafts=crafts-row.baselineProducerCrafts
    end
  end end
  if game.tick==b.warmupTicks then for _,p in pairs(b.inputs) do t.warmupConsumption[key(p)]=statistic(t,p,false);t.warmupFed[key(p)]=t.fed[key(p)] or 0 end end
  if game.tick%36000==0 then log('FLIGHT_NATIVE_PROGRESS '..b.id..' minutes='..game.tick/3600) end
  if game.tick==b.warmupTicks+b.measurementTicks then write_report(t,game.tick) end
end
end
for index,b in pairs(builds) do install(b,index) end
local function invoke(handler,stage,...)
  if storage.errors[handler.id] then return end
  local ok,err=pcall(handler[stage],...)
  if not ok then
    storage.errors[handler.id]=tostring(err)
    local b=handler.spec
    local invalid={};local t=storage.flights[handler.id]
    if t then for _,saved in pairs(b.entities) do
      local entity=t.entities[saved.entity_number]
      if entity and not entity.valid then invalid[#invalid+1]={entityNumber=saved.entity_number,name=saved.name,blueprintPosition=saved.position} end
    end end
    helpers.write_file('flight-native-'..b.id..'.json',helpers.table_to_json({id=b.id,error=tostring(err),phase=stage,
      stoppedTick=game.tick,invalidBlueprintEntities=invalid,partialOutputs=t and t.outputs,wasteCollected=t and t.wasteCollected,
      blueprintSha256=b.blueprintSha256,prototypeDumpSha256=b.prototypeDumpSha256,configurationSha256=b.configurationSha256,specSha256=b.specSha256}),false)
    log('FLIGHT_NATIVE_ERROR '..handler.id..' '..tostring(err))
  end
end
script.on_init(function()
  storage.flights={};storage.errors={}
  for _,handler in pairs(handlers) do invoke(handler,'init') end
end)
script.on_nth_tick(1,function()
  for _,handler in pairs(handlers) do if handler.hasBelts then invoke(handler,'supply',true) end end
end)
script.on_nth_tick(60,function()
  for _,handler in pairs(handlers) do invoke(handler,'supply',false);invoke(handler,'measure') end
end)
