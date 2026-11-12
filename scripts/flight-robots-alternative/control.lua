local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('FLIGHT_SCIENCE: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
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
  if e.type=='assembling-machine' and e.products_finished>(t.machineBaseline[id]or 0)then
   for _,i in pairs(e.get_recipe().ingredients)do if i.name==p.item then
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
  local force=game.create_force('science-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0
  local s=game.create_surface('science-'..index,{width=128,height=128,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},3);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-64,63 do for y=-64,63 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,entities={},fed={},measuredFed={},output={},baseline={},machineBaseline={},powered=false,portSamples={},portOutputs={},samples={},loopSamples={},recoveryOutput={}}
  storage.tests[index]=t
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
  if game.tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0 end
  -- The only ingredient writes are to the two lanes of the declared input belt.
  for i,p in ipairs(b.fluids or {})do t.entities[p.entity].insert_fluid{name=p.item,amount=1000}end
  if game.tick%4==0 then for i,p in ipairs(b.inputs)do
   local belt=t.entities[p.entity]
   for lane=1,2 do if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
    t.fed[i]=(t.fed[i]or 0)+1
    if game.tick>payload.warmup then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
   end end
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
    for _,e in pairs(t.entities)do if e.type=='assembling-machine' or e.type=='inserter' then
     check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y)
    end end
   end
   for outputIndex,p in ipairs(b.outputs)do
    local e=t.entities[p.entity];local endMeasurement=payload.warmup+payload.measure
    local paused=payload.recovery and game.tick>endMeasurement and game.tick<=endMeasurement+payload.recovery.pauseTicks
    local n=paused and 0 or e.remove_item{name=p.item,count=1000000}
    if payload.recovery and game.tick>endMeasurement+payload.recovery.pauseTicks+payload.recovery.settleTicks then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
    if game.tick>payload.warmup then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
   end
   for _,loop in ipairs(b.loopControl or {})do
    local count=0;for _,signal in ipairs(t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red)or {})do count=count+signal.count end
    local sample=t.loopSamples[loop.name]or {maxStock=0,capacity=loop.capacity};sample.maxStock=math.max(sample.maxStock,count);sample.lastSignals=t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red);t.loopSamples[loop.name]=sample
    check(count<loop.capacity*.9,'loop overfilled '..loop.name)
   end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1
   end end
  end
  if payload.recovery and game.tick==payload.warmup+payload.measure+payload.recovery.pauseTicks then
   t.blockedStock={}
   for _,p in ipairs(b.outputs)do
    local n=t.entities[p.entity].get_item_count(p.item);t.blockedStock[p.item]=n
    check(n==p.cap,'shared chest did not stop at cap for '..p.item..': '..n)
   end
  end
  if game.tick==payload.warmup then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t,p.item)end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then t.machineBaseline[id]=e.products_finished end end
  end
 end
 if game.tick==payload.warmup+payload.measure then
  local report={builds={},feedPolicy='Declared exterior belt lanes and declared fluid pipes only; collect each product from the shared chest every second',researchPolicy='All recipes enabled, no technologies researched, inserter stack bonus zero'}
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local r={id=t.id,outputsPerMinute={},consumptionPerMinute={},inputs={},outputPorts={},machines={},powered=t.powered,importedEntities=#b.entities,loopSamples=t.loopSamples}
   for _,p in ipairs(b.products)do r.outputsPerMinute[p]=(t.output[p]or 0)/(payload.measure/3600)end
   for i,p in ipairs(b.inputs)do r.consumptionPerMinute[p.item]=(stats(t,p.item)-(t.baseline[p.item]or 0))/(payload.measure/3600);r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.measuredFed[i]or 0,productiveRoute=input_route(t,p)}end
   r.fluids={}
   for _,p in ipairs(b.fluids or {})do
    local source=t.entities[p.entity];local consumers={}
    for id,e in pairs(t.entities)do if e.type=='assembling-machine' and ((p.item=='lubricant' and e.get_recipe().name=='electric-engine-unit') or (p.item=='sulfuric-acid' and e.get_recipe().name=='battery')) then
     local connected=false
     for j=1,e.fluids_count do for _,c in pairs(e.get_fluid_box_pipe_connections(j)or {})do
      local pipe=c.target or c.target_entity
      if pipe and pipe.has_fluid_segment(c.target_fluidbox_index or 1) and pipe.get_fluid_segment_id(c.target_fluidbox_index or 1)==source.get_fluid_segment_id(1) then connected=true end
     end end
     check(connected,'disconnected fluid consumer '..id)
     consumers[#consumers+1]=id
    end end
    r.fluids[#r.fluids+1]={item=p.item,entity=p.entity,productiveConsumers=consumers}
   end
   for i,p in ipairs(b.outputs)do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    r.machines[#r.machines+1]={entity=id,recipe=e.get_recipe().name,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],inventory=e.get_inventory(defines.inventory.crafter_input).get_contents()}
   end end
   report.builds[#report.builds+1]=r
  end
  storage.report=report
  helpers.write_file('result.json',helpers.table_to_json(report),false)
 end
 if payload.recovery and game.tick==payload.warmup+payload.measure+payload.recovery.pauseTicks+payload.recovery.settleTicks+payload.recovery.measureTicks then
  for index,t in ipairs(storage.tests)do
   local recovery={blockedMinutes=payload.recovery.pauseTicks/3600,settlingMinutes=payload.recovery.settleTicks/3600,measurementMinutes=payload.recovery.measureTicks/3600,outputsPerMinute={}}
   for _,item in ipairs(payload.builds[index].products)do recovery.outputsPerMinute[item]=(t.recoveryOutput[item]or 0)/(payload.recovery.measureTicks/3600)end
   recovery.blockedStock=t.blockedStock
   storage.report.builds[index].recovery=recovery
  end
  helpers.write_file('result.json',helpers.table_to_json(storage.report),false)
 end

end)
