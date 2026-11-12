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
local function chest_snapshot(t,p)
 local e=t.entities[p.entity];local inv=e.get_inventory(defines.inventory.chest)
 local bar=inv.get_bar();local usable=math.min(#inv,bar-1);local size=prototypes.item[p.item].stack_size
 local out={item=p.item,entity=p.entity,inventorySlots=#inv,bar=bar,usableSlots=usable,stackSize=size,usableCapacity=usable*size,stored=0,full=usable>0,slots={}}
 for i=1,usable do
  local stack=inv[i];local valid=stack.valid_for_read
  local count=valid and stack.count or 0
  out.slots[#out.slots+1]={slot=i,name=valid and stack.name or '',count=count}
  out.stored=out.stored+count
  if not valid or stack.name~=p.item or stack.quality.name~='normal' or count<size then out.full=false end
 end
 return out
end
local function production_snapshot(t,b)
 local out={statistics={},crafts={}}
 local product={};for _,item in ipairs(b.products)do product[item]=true;out.statistics[item]=t.force.get_item_production_statistics(t.surface).get_input_count(item);out.crafts[item]=0 end
 for id,e in pairs(t.entities)do if e.type=='assembling-machine' then local recipe=e.get_recipe().name;if product[recipe]then out.crafts[recipe]=out.crafts[recipe]+e.products_finished end end end
 return out
end
script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={}
 for index,b in ipairs(payload.builds) do
  local force=game.create_force('science-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0
  local sw=2^math.ceil(math.log(b.footprint.width+32)/math.log(2));local sh=2^math.ceil(math.log(b.footprint.height+32)/math.log(2))
  local s=game.create_surface('science-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64));s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
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
   check(e.quality.name=='normal','non-normal quality');
   if saved.recipe then check(e.get_recipe().name==saved.recipe,'recipe changed');check(e.products_finished==0,'nonempty machine')end
  end
  for _,p in ipairs(b.inputs)do
   local e=t.entities[p.entity]
   check(s.can_place_entity{name='fast-transport-belt',position={e.position.x-1,e.position.y},direction=defines.direction.east,force=force},'blocked west input '..p.item)
  end
  for _,p in ipairs(b.outputs)do
   local e=t.entities[p.entity]
   check(s.can_place_entity{name='fast-inserter',position={e.position.x+1,e.position.y},direction=defines.direction.west,force=force},'blocked east output '..p.item)
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
    local sample=t.loopSamples[loop.name]or {maxStock=0,capacity=loop.capacity};sample.maxStock=math.max(sample.maxStock,count);t.loopSamples[loop.name]=sample
    check(count<loop.capacity*.9,'loop overfilled '..loop.name)
   end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1
   end end
  end
  if payload.recovery then
   local pauseEnd=payload.warmup+payload.measure+payload.recovery.pauseTicks
   local proofStart=pauseEnd-7200
   if game.tick==proofStart then
    t.blockStress={pauseMinutes=payload.recovery.pauseTicks/3600,zeroProductionWindowMinutes=2,windowStartTick=proofStart,windowEndTick=pauseEnd,start=production_snapshot(t,b),startChests={},endChests={},chestFullSamples={},sampleCount=0}
    for i,p in ipairs(b.outputs)do t.blockStress.startChests[i]=chest_snapshot(t,p);t.blockStress.chestFullSamples[i]=0 end
   end
   if t.blockStress and game.tick>proofStart and game.tick<=pauseEnd and game.tick%60==0 then
    t.blockStress.sampleCount=t.blockStress.sampleCount+1
    for i,p in ipairs(b.outputs)do if chest_snapshot(t,p).full then t.blockStress.chestFullSamples[i]=t.blockStress.chestFullSamples[i]+1 end end
   end
   if game.tick==pauseEnd then
    local s=t.blockStress;s.finish=production_snapshot(t,b);s.productionDelta={};s.craftDelta={};s.allChestsFull=true;s.zeroScienceProduction=true
    for i,p in ipairs(b.outputs)do s.endChests[i]=chest_snapshot(t,p);if not s.startChests[i].full or not s.endChests[i].full or s.chestFullSamples[i]~=s.sampleCount then s.allChestsFull=false end end
    for _,item in ipairs(b.products)do s.productionDelta[item]=s.finish.statistics[item]-s.start.statistics[item];s.craftDelta[item]=s.finish.crafts[item]-s.start.crafts[item];if s.productionDelta[item]~=0 or s.craftDelta[item]~=0 then s.zeroScienceProduction=false end end
    storage.report.builds[index].blockedStress=s
    helpers.write_file('blocked-result.json',helpers.table_to_json(storage.report),false)
   end
  end
  if payload.recovery and game.tick==payload.warmup+payload.measure+payload.recovery.pauseTicks+payload.recovery.settleTicks then
   t.recoveryProductionStart=production_snapshot(t,b)
   t.recoveryMachineBaseline={};t.recoveryMachineInputs={};t.recoverySamples={}
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    t.recoveryMachineBaseline[id]=e.products_finished;t.recoveryMachineInputs[id]=e.get_inventory(defines.inventory.crafter_input).get_contents()
   end end
  end
  if t.recoverySamples and game.tick%60==0 then for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
   t.recoverySamples[id]=t.recoverySamples[id]or {};local name=status(e);t.recoverySamples[id][name]=(t.recoverySamples[id][name]or 0)+1
  end end end
  if game.tick==payload.warmup then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t,p.item)end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then t.machineBaseline[id]=e.products_finished end end
  end
 end
 if game.tick==payload.warmup+payload.measure then
  local report={builds={},feedPolicy='Declared exterior belt lanes only, no internal injection; collect every output chest every second',researchPolicy='All recipes enabled, no technologies researched, inserter stack bonus zero'}
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local r={id=t.id,outputsPerMinute={},consumptionPerMinute={},inputs={},outputPorts={},machines={},powered=t.powered,importedEntities=#b.entities,loopSamples=t.loopSamples}
   for _,p in ipairs(b.products)do r.outputsPerMinute[p]=(t.output[p]or 0)/(payload.measure/3600)end
   for i,p in ipairs(b.inputs)do r.consumptionPerMinute[p.item]=(stats(t,p.item)-(t.baseline[p.item]or 0))/(payload.measure/3600);r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.measuredFed[i]or 0,productiveRoute=input_route(t,p)}end
   for i,p in ipairs(b.outputs)do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    r.machines[#r.machines+1]={entity=id,recipe=e.get_recipe().name,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],inventory=e.get_inventory(defines.inventory.crafter_input).get_contents()}
   end end
   for _,loop in ipairs(b.loopControl or {})do
    r.loopSamples[loop.name].finalSignals=t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red)
    r.loopSamples[loop.name].controllers={}
    for _,id in ipairs(loop.controlled)do local e=t.entities[id];r.loopSamples[loop.name].controllers[#r.loopSamples[loop.name].controllers+1]={entity=id,status=status(e),held=e.held_stack.valid_for_read and e.held_stack.name or ''} end
   end
   report.builds[#report.builds+1]=r
  end
  storage.report=report
  helpers.write_file('result.json',helpers.table_to_json(report),false)
 end
 if payload.recovery and game.tick==payload.warmup+payload.measure+payload.recovery.pauseTicks+payload.recovery.settleTicks+payload.recovery.measureTicks then
  for index,t in ipairs(storage.tests)do
   local recovery={blockedMinutes=payload.recovery.pauseTicks/3600,settlingMinutes=payload.recovery.settleTicks/3600,measurementMinutes=payload.recovery.measureTicks/3600,outputsPerMinute={}}
   for _,item in ipairs(payload.builds[index].products)do recovery.outputsPerMinute[item]=(t.recoveryOutput[item]or 0)/(payload.recovery.measureTicks/3600)end
   recovery.machines={}
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then recovery.machines[#recovery.machines+1]={entity=id,recipe=e.get_recipe().name,measuredCrafts=e.products_finished-t.recoveryMachineBaseline[id],statusSamples=t.recoverySamples[id],initialInputs=t.recoveryMachineInputs[id],finalInputs=e.get_inventory(defines.inventory.crafter_input).get_contents()} end end
   recovery.scienceCraftedPerMinute={};recovery.scienceProductionStatisticsPerMinute={};recovery.scienceCraftCount={}
   local b=payload.builds[index];local finish=production_snapshot(t,b)
   for _,item in ipairs(b.products)do
    local amount=0;for _,result in ipairs(b.recipeOutputs[item])do if result.name==item then amount=result.amount end end
    local crafts=finish.crafts[item]-t.recoveryProductionStart.crafts[item]
    recovery.scienceCraftCount[item]=crafts
    recovery.scienceCraftedPerMinute[item]=crafts*amount/(payload.recovery.measureTicks/3600)
    recovery.scienceProductionStatisticsPerMinute[item]=(finish.statistics[item]-t.recoveryProductionStart.statistics[item])/(payload.recovery.measureTicks/3600)
   end
   storage.report.builds[index].recovery=recovery
  end
  helpers.write_file('result.json',helpers.table_to_json(storage.report),false)
 end

end)
