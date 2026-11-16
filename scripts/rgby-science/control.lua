local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('FLIGHT_SCIENCE: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function recipe(t,id) return t.spec[id].recipe or t.spec[id].tags.production_recipe end
local function stats(t,name) return t.force.get_item_production_statistics(t.surface).get_output_count(name) end
local function input_route(t,p)
 local byUnit,edges={},{}
 for id,e in pairs(t.entities)do byUnit[e.unit_number]=id end
 local function link(a,b)if a and b and byUnit[a.unit_number] and byUnit[b.unit_number]then local k=a.unit_number;edges[k]=edges[k]or {};edges[k][#edges[k]+1]=b.unit_number end end
 for _,e in pairs(t.entities)do
  if e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' then
   for _,n in pairs(e.belt_neighbours.outputs)do link(e,n)end
   if e.type=='underground-belt' and e.belt_to_ground_type=='input' then link(e,e.underground_belt_neighbour)end
  elseif e.type=='inserter'then
   local allowed=true
   if e.use_filters then local listed=false;for i=1,e.filter_slot_count do local f=e.get_filter(i);if f and f.name==p.item then listed=true end end;allowed=e.inserter_filter_mode=='blacklist' and not listed or e.inserter_filter_mode~='blacklist' and listed end
   if allowed then link(e.pickup_target,e.drop_target)end
  end
 end
 local start=t.entities[p.entity].unit_number;local q={start};local previous={[start]=false};local head=1
 while head<=#q do local unit=q[head];head=head+1;local id=byUnit[unit];local e=t.entities[id]
  if crafting(e) and e.products_finished>(t.machineBaseline[id]or 0)then
   for _,i in pairs(t.ingredients[recipe(t,id)])do if i.name==p.item then
    local route={};while unit do table.insert(route,1,byUnit[unit]);unit=previous[unit]end;return route
   end end
  end
  for _,nextUnit in ipairs(edges[unit]or {})do if previous[nextUnit]==nil then previous[nextUnit]=unit;q[#q+1]=nextUnit end end
 end
 return nil
end
script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={}
 for index,b in ipairs(payload.builds) do
  local force=game.create_force('science-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0;force.bulk_inserter_capacity_bonus=1
  check(force.inserter_stack_size_bonus==0 and force.bulk_inserter_capacity_bonus==1,'incorrect inserter unlock baseline')
  local sw=math.ceil((b.footprint.width+24)/32)*32;local sh=math.ceil((b.footprint.height+24)/32)*32
  local s=game.create_surface('science-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64)+1);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,entities={},fed={},measuredFed={},output={},baseline={},machineBaseline={},powered=false,portSamples={},portOutputs={},samples={},loopSamples={},recoveryOutput={},fluidFed={},actualRecipeChecks=0,labSamples={},bulkMaxHand={}}
  t.spec={};t.ingredients=b.recipeIngredients;for _,saved in ipairs(b.entities)do t.spec[saved.entity_number]=saved end
  storage.tests[index]=t
  if b.researchProbe then
   force.laboratory_speed_modifier=b.researchProbe.labSpeedModifier or 0
   force.laboratory_productivity_bonus=0
   check(force.add_research(b.researchProbeTechnology),'research probe could not start')
  end
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(b.code)==0,'import failed')
  local ghosts=inv[1].build_blueprint{surface=s,force=force,position={0,0},build_mode=defines.build_mode.forced}
  check(#ghosts==#b.entities,'entity count '..#ghosts..' expected '..#b.entities)
  for _,g in pairs(ghosts)do
   local id=g.tags.flight_science_entity;check(id~=nil,'missing identity')
   local _,e,proxy=g.revive{raise_revive=true};check(e~=nil and not proxy,'revive failed '..id);t.entities[id]=e
  end
  inv.destroy()
  local first=b.entities[1];local actual=t.entities[first.entity_number];local dx=actual.position.x-first.position.x;local dy=actual.position.y-first.position.y
  for _,saved in ipairs(b.entities)do
   local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed')
   check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
   if saved.recipe then check(e.get_recipe().name==saved.recipe,'recipe changed');check(e.products_finished==0,'nonempty machine')end
  end
  for _,p in ipairs(b.ports)do if p.externalSide=='west' or p.externalSide=='east' then local d=p.externalSide=='west' and -1 or 1;local e=t.entities[p.entity];for k=1,3 do check(s.can_place_entity{name='fast-transport-belt',position={e.position.x+d*k,e.position.y},force=force},'blocked exterior approach '..p.entity..' offset '..k)end end end
  local port;for _,p in ipairs(b.ports)do if p.kind=='power' then port=p end end
  local pole=t.entities[port.entity];t.pole=pole
  local reach=pole.prototype.get_supply_area_distance(pole.quality)
  for x=-math.ceil(reach),math.ceil(reach)do for y=-math.ceil(reach),math.ceil(reach)do
   if not t.fixture then local p={x=pole.position.x+x,y=pole.position.y+y}
    if s.can_place_entity{name='electric-energy-interface',position=p,force=force}then
     local e=s.create_entity{name='electric-energy-interface',position=p,force=force}
     if e.electric_network_id==pole.electric_network_id then e.electric_buffer_size=10000000000;e.power_production=10000000000;e.power_usage=0;t.fixture=e else e.destroy()end
    end
   end
  end end
  check(t.fixture~=nil,'no power fixture')
 end
end)
script.on_event(defines.events.on_tick,function()
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index]
  if game.tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0;t.force.bulk_inserter_capacity_bonus=1;check(t.force.inserter_stack_size_bonus==0 and t.force.bulk_inserter_capacity_bonus==1,'incorrect inserter unlock baseline') end
  for id,e in pairs(t.entities)do if e.name=='bulk-inserter' and e.held_stack.valid_for_read then
   t.bulkMaxHand[id]=math.max(t.bulkMaxHand[id]or 0,e.held_stack.count)
  end end
  -- The only ingredient writes are to the two lanes of the declared input belt.
  for i,p in ipairs(b.fluids or {})do local n=t.entities[p.entity].insert_fluid{name=p.item,amount=1000};if game.tick>payload.warmup and game.tick<=payload.warmup+payload.measure then t.fluidFed[i]=(t.fluidFed[i]or 0)+n end end
  if game.tick%4==0 then for i,p in ipairs(b.inputs)do
   local belt=t.entities[p.entity]
   for lane=1,2 do if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
    t.fed[i]=(t.fed[i]or 0)+1
    if game.tick>payload.warmup then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
   end end
  end end
  -- Output belt fixtures must drain continuously; a one-second sampler would
  -- artificially cap a terminal belt at its short end-segment capacity.
  if not b.researchProbe and game.tick%4==0 then for outputIndex,p in ipairs(b.outputs or {})do
   local e=t.entities[p.entity]
   if e.type=='transport-belt' or e.type=='underground-belt' then
    local stop=payload.warmup+payload.measure
    local paused=payload.recovery and game.tick>stop and game.tick<=stop+payload.recovery.pauseTicks
    local n=0;if not paused then for line=1,2 do n=n+e.get_transport_line(line).remove_item{name=p.item,count=1000000}end end
    if payload.recovery and game.tick>stop+payload.recovery.pauseTicks+payload.recovery.settleTicks then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
    if game.tick>payload.warmup then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
   end
  end end
  if game.tick%60==0 then
   if game.tick==60 then
    check(t.pole.electric_network_id~=nil,'power network missing');t.powered=true
    for _,loop in ipairs(b.loopControl or {})do
     local reader=t.entities[loop.reader];local behavior=reader.get_control_behavior()
     check(behavior.read_contents and behavior.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold,'incorrect loop reader '..loop.name)
     local network=reader.get_circuit_network(defines.wire_connector_id.circuit_red);check(network~=nil,'disconnected reader')
     for _,id in ipairs(loop.controlled)do local e=t.entities[id];local actual=e.get_circuit_network(defines.wire_connector_id.circuit_red);check(actual and actual.network_id==network.network_id,'disconnected loop controller '..id)end
    end
    for _,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' or (b.researchProbe and e.type=='lab') then
     check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y)
    end end
   end
   for outputIndex,p in ipairs(b.researchProbe and {} or b.outputs or {})do
    local e=t.entities[p.entity];local endMeasurement=payload.warmup+payload.measure
    local paused=payload.recovery and game.tick>endMeasurement and game.tick<=endMeasurement+payload.recovery.pauseTicks
    local n=0
    if not paused and e.type~='transport-belt' and e.type~='underground-belt' then n=e.remove_item{name=p.item,count=1000000} end
    if payload.recovery and game.tick>endMeasurement+payload.recovery.pauseTicks+payload.recovery.settleTicks then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
    if game.tick>payload.warmup then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
   end
   if b.researchProbe and game.tick>payload.warmup and game.tick<=payload.warmup+payload.measure then
    for id,e in pairs(t.entities)do if e.type=='lab' then
     local sample=t.labSamples[id]or {samples=0,poweredSamples=0,workingSamples=0}
     sample.samples=sample.samples+1
     if e.energy>0 and e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id then sample.poweredSamples=sample.poweredSamples+1 end
     if e.status==defines.entity_status.working then sample.workingSamples=sample.workingSamples+1 end
     t.labSamples[id]=sample
    end end
   end
   for _,loop in ipairs(b.loopControl or {})do
    local count=0;for _,signal in ipairs(t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red)or {})do count=count+signal.count end
    local sample=t.loopSamples[loop.name]or {maxStock=0,capacity=loop.capacity};sample.maxStock=math.max(sample.maxStock,count);sample.lastSignals=t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red);t.loopSamples[loop.name]=sample
    check(count<loop.capacity*.9,'loop overfilled '..loop.name)
   end
   for id,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' then
    if crafting(e) then local active=e.get_recipe();if active then check(active.name==recipe(t,id),'wrong active recipe '..id..' '..active.name);t.actualRecipeChecks=t.actualRecipeChecks+1 end end
    t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1
   end end
  end
  if not b.researchProbe and payload.recovery and game.tick==payload.warmup+payload.measure+payload.recovery.pauseTicks then
   t.collectionPauseStock={}
   for _,p in ipairs(b.outputs or {})do
    local e=t.entities[p.entity];local n=0;if e.type=='transport-belt' or e.type=='underground-belt' then for line=1,2 do n=n+e.get_transport_line(line).get_item_count(p.item) end else n=e.get_item_count(p.item) end;t.collectionPauseStock[#t.collectionPauseStock+1]={item=p.item,entity=p.entity,count=n,capacity=p.cap}
   end
  end
  -- Fill only final science chests at the start of normal blocked recovery.
  -- Intermediate buffers remain untouched; research probes have no output fixture.
  if not b.researchProbe and payload.recovery and game.tick==payload.warmup+payload.measure+1 then
   t.blockedOutputFilled={}
   for _,p in ipairs(b.outputs or {})do
    local e=t.entities[p.entity]
    if string.match(p.item,'%-science%-pack$') and (e.type=='container' or e.type=='logistic-container') then
     local n=e.insert{name=p.item,count=1000000}
     t.blockedOutputFilled[#t.blockedOutputFilled+1]={entity=p.entity,item=p.item,inserted=n}
    end
   end
  end
  if game.tick==payload.warmup then
   if b.researchProbe then
    check(t.force.current_research and t.force.current_research.name==b.researchProbeTechnology,'wrong probe research')
    t.researchBaseline=t.force.research_progress*t.force.current_research.research_unit_count
   end
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t,p.item)end
   for id,e in pairs(t.entities)do if crafting(e)then t.machineBaseline[id]=e.products_finished end end
  end
 end
 if game.tick==payload.warmup+payload.measure then
  local report={builds={},feedPolicy='Declared exterior belt lanes and declared fluid pipes only; collect science only from declared right-side chests every second',researchPolicy='All recipes enabled; optional explicit four-pack research probe only, no science injection, fast inserter stack bonus zero; bulk unlock-equivalent capacity bonus +1 only'}
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local r={id=t.id,outputsPerMinute={},consumptionPerMinute={},inputs={},outputPorts={},machines={},powered=t.powered,importedEntities=#b.entities,loopSamples=t.loopSamples,exactRecipeChecks=t.actualRecipeChecks,externalApproachesClear=true}
   check(t.force.inserter_stack_size_bonus==0 and t.force.bulk_inserter_capacity_bonus==1,'inserter capacity baseline drifted')
   r.inserterCapacityResearch={fast=t.force.inserter_stack_size_bonus,bulkUnlockBonus=t.force.bulk_inserter_capacity_bonus,
    technology='bulk-inserter unlock-equivalent baseline only; no later capacity upgrades',appliedBy='explicit force capacity properties'}
   r.bulkInserters={}
   for id,e in pairs(t.entities)do if e.name=='bulk-inserter' then r.bulkInserters[#r.bulkInserters+1]={entity=id,observedMaxHand=t.bulkMaxHand[id]or 0} end end
   if b.researchProbe then
    check(t.force.current_research and t.force.current_research.name==b.researchProbeTechnology,'probe research changed')
    local units=t.force.research_progress*t.force.current_research.research_unit_count-(t.researchBaseline or 0)
    local probe={seconds=b.researchProbe.seconds,labSpeedModifier=b.researchProbe.labSpeedModifier or 0,
     researchedUnits=units,unitsPerMinute=units/(payload.measure/3600),labCount=0,expectedLabCount=b.expectedLabCount,allPowered=true,allActive=true,labs={}}
    for id,e in pairs(t.entities)do if e.type=='lab' then
     local sample=t.labSamples[id]or {samples=0,poweredSamples=0,workingSamples=0}
     local powered=sample.samples>0 and sample.poweredSamples==sample.samples
     local active=sample.workingSamples>0
     probe.labCount=probe.labCount+1;probe.allPowered=probe.allPowered and powered;probe.allActive=probe.allActive and active
     probe.labs[#probe.labs+1]={entity=id,poweredSeen=sample.poweredSamples>0,workingSeen=active,allPowered=powered,samples=sample}
    end end
    r.researchProbe=probe
   end
   for _,p in ipairs(b.products or {})do r.outputsPerMinute[p]=(t.output[p]or 0)/(payload.measure/3600)end
   for i,p in ipairs(b.inputs)do r.consumptionPerMinute[p.item]=(stats(t,p.item)-(t.baseline[p.item]or 0))/(payload.measure/3600);r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.measuredFed[i]or 0,productiveRoute=input_route(t,p)}end
   r.fluids={}
   for fluidIndex,p in ipairs(b.fluids or {})do
    local source=t.entities[p.entity];local consumers={}
    for id,e in pairs(t.entities)do if e.type=='assembling-machine' and ((p.item=='lubricant' and recipe(t,id)=='electric-engine-unit') or (p.item=='sulfuric-acid' and (recipe(t,id)=='battery' or recipe(t,id)=='processing-unit'))) then
     local connected=false
     for j=1,e.fluids_count do for _,c in pairs(e.get_fluid_box_pipe_connections(j)or {})do
      local pipe=c.target or c.target_entity
      if pipe and pipe.has_fluid_segment(c.target_fluidbox_index or 1) and pipe.get_fluid_segment_id(c.target_fluidbox_index or 1)==source.get_fluid_segment_id(1) then connected=true end
     end end
     check(connected,'disconnected fluid consumer '..id)
     consumers[#consumers+1]=id
    end end
    r.fluids[#r.fluids+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.fluidFed[fluidIndex]or 0,sourceFluidSegment=source.get_fluid_segment_id(1),productiveConsumers=consumers}
   end
   for i,p in ipairs(b.outputs or {})do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.entities)do if crafting(e)then
    local actualRecipe=e.get_recipe() and e.get_recipe().name or 'none'
    r.machines[#r.machines+1]={entity=id,recipe=recipe(t,id),actualRecipe=actualRecipe,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],inventory=e.get_inventory(e.type=='furnace' and defines.inventory.furnace_source or defines.inventory.crafter_input).get_contents()}
   end end
   r.arms={}
   for id,e in pairs(t.entities)do if e.type=='inserter' and t.spec[id].tags and (t.spec[id].tags.role=='controlled-feed' or t.spec[id].tags.stock_item=='iron-stick' or t.spec[id].tags.stock_item=='rail') then
    local target=e.pickup_target;local contents={}
    if target and target.type=='transport-belt' then for line=1,2 do contents[line]=target.get_transport_line(line).get_contents() end end
    r.arms[#r.arms+1]={entity=id,block=t.spec[id].tags.block,filter=e.get_filter(1),status=status(e),samples=t.samples[id],pickupContents=contents,stockItem=t.spec[id].tags.stock_item,signals=e.get_signals(defines.wire_connector_id.circuit_red)}
   end end
   if payload.debugTopology then
    local ids={};for id,e in pairs(t.entities)do ids[e.unit_number]=id end
    r.transport={};r.debugArms={};r.buffers={}
    for id,e in pairs(t.entities)do
     if e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' then
      local outputs={};for _,n in pairs(e.belt_neighbours.outputs)do outputs[#outputs+1]=ids[n.unit_number] end
      local lines={};for i=1,e.get_max_transport_line_index()do lines[i]=e.get_transport_line(i).get_contents() end
      local under=e.type=='underground-belt' and e.underground_belt_neighbour
      r.transport[#r.transport+1]={entity=id,outputs=outputs,under=under and ids[under.unit_number],lines=lines}
     elseif e.type=='inserter' then
      r.debugArms[#r.debugArms+1]={entity=id,status=status(e),pickup=e.pickup_target and ids[e.pickup_target.unit_number],drop=e.drop_target and ids[e.drop_target.unit_number],hand=e.held_stack.valid_for_read and {name=e.held_stack.name,count=e.held_stack.count},signals=e.get_signals(defines.wire_connector_id.circuit_red)}
     elseif e.type=='container' or e.type=='logistic-container' then r.buffers[#r.buffers+1]={entity=id,contents=e.get_inventory(defines.inventory.chest).get_contents()} end
    end
   end
   report.builds[#report.builds+1]=r
  end
  storage.report=report
  helpers.write_file('result.json',helpers.table_to_json(report),false)
 end
 if payload.recovery and game.tick==payload.warmup+payload.measure+payload.recovery.pauseTicks+payload.recovery.settleTicks+payload.recovery.measureTicks then
  for index,t in ipairs(storage.tests)do
   local recovery={blockedMinutes=payload.recovery.pauseTicks/3600,settlingMinutes=payload.recovery.settleTicks/3600,measurementMinutes=payload.recovery.measureTicks/3600,outputsPerMinute={}}
   for _,item in ipairs(payload.builds[index].products or {})do recovery.outputsPerMinute[item]=(t.recoveryOutput[item]or 0)/(payload.recovery.measureTicks/3600)end
   recovery.pauseMode=payload.builds[index].researchProbe and 'not-applicable-research-probe' or 'final-science-chests-filled-and-collection-paused';recovery.collectionPauseStock=t.collectionPauseStock;recovery.blockedOutputFilled=t.blockedOutputFilled
   storage.report.builds[index].recovery=recovery
  end
  helpers.write_file('result.json',helpers.table_to_json(storage.report),false)
 end

end)
