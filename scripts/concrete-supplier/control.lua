-- Native rate-class harness for the space-launch suppliers (concrete-supplier, rocket-fuel-supplier), adapted
-- from scripts/green-circuits/control.lua with the fluid entrances of scripts/six-science/control.lua and the
-- throttle of CONTRACT section 11 item 4. Feeds only the declared west entrances at their declared per-minute
-- figure (belts: a credit of perMinute/3600 per tick capped at 8, one item per credit on alternating lanes;
-- fluids: perMinute/3600 per tick plus the refused carry, capped at one second's worth), powers the build
-- through one energy interface on the power port's network, seeds no inventory, and collects only declared
-- products from the declared belt exit every 4 ticks. Phases: warm-up, measure, blocked (collection stopped,
-- entrances still fed), settle, recovery measure. Samples once per second; no per-tick entity scan.
local payload=helpers.json_to_table(require('payload'))
local W=payload.warmup
local M=W+payload.measure
local B=M+payload.blocked
local S=B+payload.settle
local R=S+payload.recovery
local function check(ok,msg) if not ok then error('SPACE_SUPPLIER: '..msg) end end
local statusName={}
for n,v in pairs(defines.entity_status) do statusName[v]=n end
local function status(e) return statusName[e.status] or tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function is_belt(e) return e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' end
local function recipe(t,id) return t.spec[id].recipe end
local function stats(t) return t.force.get_item_production_statistics(t.surface) end
local function output_count(t,p)
 local e=t.entities[p.entity]
 if is_belt(e) then local n=0;for line=1,2 do n=n+e.get_transport_line(line).get_item_count(p.item) end;return n end
 return e.get_item_count(p.item)
end
local function lane_counts(e,item) return {e.get_transport_line(1).get_item_count(item),e.get_transport_line(2).get_item_count(item)} end
local function uses(t,id,item) for _,i in pairs(t.ingredients[recipe(t,id)] or {})do if i.name==item then return true end end return false end
-- Belt entrances: breadth-first over belts and arms (respecting filters) to a machine that crafted with the item.
local function input_route(t,p)
 local byUnit,edges={},{}
 for id,e in pairs(t.entities)do byUnit[e.unit_number]=id end
 local function link(a,b)if a and b and byUnit[a.unit_number] and byUnit[b.unit_number]then local k=a.unit_number;edges[k]=edges[k]or {};edges[k][#edges[k]+1]=b.unit_number end end
 for _,e in pairs(t.entities)do
  if is_belt(e) then
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
  if crafting(e) and e.products_finished>(t.machineBaseline[id]or 0) and uses(t,id,p.item) then
   local route={};while unit do table.insert(route,1,byUnit[unit]);unit=previous[unit]end;return route
  end
  for _,nextUnit in ipairs(edges[unit]or {})do if previous[nextUnit]==nil then previous[nextUnit]=unit;q[#q+1]=nextUnit end end
 end
 return nil
end
-- Fluid entrances: every machine whose recipe uses the fluid must share the entrance pipe's fluid segment.
local function fluid_consumers(t,p)
 local source=t.entities[p.entity];local segment=source.get_fluid_segment_id(1);local connected,productive,disconnected={},{},{}
 for id,e in pairs(t.crafters)do if uses(t,id,p.item) then
  local ok=false
  for j=1,e.fluids_count do for _,c in pairs(e.get_fluid_box_pipe_connections(j)or {})do
   local pipe=c.target or c.target_entity
   if pipe and pipe.has_fluid_segment(c.target_fluidbox_index or 1) and pipe.get_fluid_segment_id(c.target_fluidbox_index or 1)==segment then ok=true end
  end end
  if ok then connected[#connected+1]=id;if e.products_finished>(t.machineBaseline[id]or 0) then productive[#productive+1]=id end else disconnected[#disconnected+1]=id end
 end end
 return {segment=segment,connected=connected,productive=productive,disconnected=disconnected}
end
local function write() helpers.write_file('result.json',helpers.table_to_json(storage.report),false) end

script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={};storage.report={builds={},feedPolicy=payload.saturate and 'EXPLORATION ONLY: declared entrances saturated (belt lanes every 4 ticks, fluids 1000 per tick)' or 'Declared west entrances only, throttled to the manifest perMinute: belts get a credit of perMinute/3600 per tick (capped at 8) and one item per credit, alternating lanes; fluids get perMinute/3600 per tick plus the refused carry (capped at one second of supply); electricity through one energy interface on the power port network; no inventory seeded; declared products collected from the declared east belt exit every 4 ticks',researchPolicy='All recipes enabled; fast inserter stack bonus zero; bulk inserter unlock-equivalent capacity bonus +1 only; no technologies researched'}
 for index,b in ipairs(payload.builds) do
  local force=game.create_force('supplier-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0;force.bulk_inserter_capacity_bonus=1
  check(force.inserter_stack_size_bonus==0 and force.bulk_inserter_capacity_bonus==1,'incorrect inserter unlock baseline')
  local sw=math.ceil((b.footprint.width+24)/32)*32;local sh=math.ceil((b.footprint.height+24)/32)*32
  local s=game.create_surface('supplier-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64)+1);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,entities={},credit={},lane={},fluidCarry={},fed={},measuredFed={},recoveryFed={},fluidFed={},fluidMeasured={},fluidRecovery={},output={},recoveryOutput={},portOutputs={},baseline={},machineBaseline={},samples={},blockedSamples={},loopSamples={},blockedMax={},bulkMaxHand={},powered=false,actualRecipeChecks=0}
  t.spec={};t.ingredients=b.recipeIngredients;for _,saved in ipairs(b.entities)do t.spec[saved.entity_number]=saved end
  storage.tests[index]=t
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(b.code)==0,'import failed')
  local ghosts=inv[1].build_blueprint{surface=s,force=force,position={0,0},build_mode=defines.build_mode.forced}
  check(#ghosts==#b.entities,'entity count '..#ghosts..' expected '..#b.entities)
  for _,g in pairs(ghosts)do
   local id=g.tags.flight_science_entity;check(id~=nil,'missing identity')
   local _,e,proxy=g.revive{raise_revive=true};check(e~=nil and not proxy,'revive failed '..id);t.entities[id]=e
  end
  inv.destroy()
  t.bulkEntities={};t.crafters={};t.arms={}
  for id,e in pairs(t.entities)do
   if e.name=='bulk-inserter' then t.bulkEntities[id]=e end
   if crafting(e) then t.crafters[id]=e end
   if e.type=='inserter' then t.arms[id]=e end
  end
  local first=b.entities[1];local actual=t.entities[first.entity_number];local dx=actual.position.x-first.position.x;local dy=actual.position.y-first.position.y
  t.offset={x=dx,y=dy}
  for _,saved in ipairs(b.entities)do
   local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed '..saved.entity_number)
   check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
   if e.type=='inserter' then check(e.inserter_stack_size_override==(saved.override_stack_size or 0),'arm stack override changed '..saved.entity_number) end
   if saved.recipe then
    local r=e.get_recipe();check(r and r.name==saved.recipe,'recipe changed '..saved.entity_number);check(e.products_finished==0,'nonempty machine')
    check(e.get_module_inventory()==nil or e.get_module_inventory().is_empty(),'installed modules')
    local expected={};for _,ingredient in ipairs(t.ingredients[saved.recipe])do expected[ingredient.name]=ingredient.amount end
    local count=0;for _,ingredient in pairs(r.ingredients)do check(expected[ingredient.name]==ingredient.amount,'native ingredient mismatch '..saved.recipe..' '..ingredient.name);count=count+1 end
    check(count==#t.ingredients[saved.recipe],'native ingredient count mismatch')
   end
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
  storage.report.builds[index]={id=b.id,importedEntities=#b.entities,externalApproachesClear=true}
 end
end)

script.on_event(defines.events.on_tick,function()
 local tick=game.tick
 if tick%3600==0 then helpers.write_file('progress.json',helpers.table_to_json{tick=tick,target=R},false) end
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index];local r=storage.report.builds[index]
  if tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0;t.force.bulk_inserter_capacity_bonus=1 end
  -- The one per-tick scan: bulk hands over a cached list (empty in these designs).
  for id,e in pairs(t.bulkEntities)do if e.held_stack.valid_for_read then t.bulkMaxHand[id]=math.max(t.bulkMaxHand[id]or 0,e.held_stack.count) end end
  local measuring=tick>W and tick<=M
  local recovering=tick>S and tick<=R
  -- The only ingredient writes: declared fluid entrances and the two lanes of declared entrance belts.
  for i,p in ipairs(b.fluids or {})do
   local per=p.perMinute/3600
   local want=payload.saturate and 1000 or per+(t.fluidCarry[i]or 0)
   local n=t.entities[p.entity].insert_fluid{name=p.item,amount=want}
   if not payload.saturate then t.fluidCarry[i]=math.min(want-n,per*60) end
   t.fluidFed[i]=(t.fluidFed[i]or 0)+n
   if measuring then t.fluidMeasured[i]=(t.fluidMeasured[i]or 0)+n end
   if recovering then t.fluidRecovery[i]=(t.fluidRecovery[i]or 0)+n end
  end
  for i,p in ipairs(b.inputs)do
   local belt=t.entities[p.entity]
   if payload.saturate then
    if tick%4==0 then for lane=1,2 do if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
     t.fed[i]=(t.fed[i]or 0)+1;if measuring then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end;if recovering then t.recoveryFed[i]=(t.recoveryFed[i]or 0)+1 end
    end end end
   else
    t.credit[i]=math.min(8,(t.credit[i]or 0)+p.perMinute/3600)
    while t.credit[i]>=1 do
     local lane=(t.lane[i]or 0)%2+1
     if not belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
      lane=lane%2+1
      if not belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then break end
     end
     t.lane[i]=lane;t.credit[i]=t.credit[i]-1
     t.fed[i]=(t.fed[i]or 0)+1;if measuring then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end;if recovering then t.recoveryFed[i]=(t.recoveryFed[i]or 0)+1 end
    end
   end
  end
  local blocked=tick>M and tick<=B
  -- Collection: the belt exit every 4 ticks (a once-per-second drain would cap a terminal belt).
  for outputIndex,p in ipairs(b.outputs or {})do
   local e=t.entities[p.entity]
   if tick%4==0 then
    local n=0
    if not blocked then for line=1,2 do n=n+e.get_transport_line(line).remove_item{name=p.item,count=1000000} end end
    if measuring then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
    if recovering then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
   end
  end
  if tick%60==0 then
   if tick==60 then
    check(t.pole.electric_network_id~=nil,'power network missing');t.powered=true
    for _,e in pairs(t.entities)do
     if e.type=='electric-pole' then check(e.electric_network_id==t.pole.electric_network_id,'second power network at '..e.position.x..','..e.position.y) end
     if crafting(e) or e.type=='inserter' then check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y) end
    end
    for _,loop in ipairs(b.loopControl or {})do check(false,'these suppliers declare no ring') end
    r.ringWiringChecked=true
    -- A declared exit gate (rocket-fuel-supplier): the exit tile reads its contents in hold mode and every gated
    -- arm is circuit-enabled on the same red network, with the declared item and cap.
    local gate=b.stockControl and b.stockControl.gate
    if type(gate)=='table' then
     local reader=t.entities[gate.reader];local c=reader.get_control_behavior()
     check(c and c.read_contents and c.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.hold,'gate reader is not a hold-mode reader')
     local net=reader.get_circuit_network(defines.wire_connector_id.circuit_red);check(net~=nil,'gate reader not wired')
     for _,id in ipairs(gate.arms)do
      local a=t.entities[id];local n=a.get_circuit_network(defines.wire_connector_id.circuit_red);local cb=a.get_control_behavior()
      check(n and n.network_id==net.network_id,'gated arm not on the reader network '..id)
      check(cb and cb.circuit_enable_disable and cb.circuit_condition.first_signal.name==b.products[1] and cb.circuit_condition.comparator=='<' and cb.circuit_condition.constant==b.outputs[1].cap,'gated arm condition '..id)
     end
     r.gateWiringChecked=true
    end
   end
   for id,e in pairs(t.crafters)do local active=e.get_recipe();if active then check(active.name==recipe(t,id),'wrong active recipe '..id);t.actualRecipeChecks=t.actualRecipeChecks+1 end end
   local bucket=nil
   if measuring then bucket=t.samples elseif blocked then bucket=t.blockedSamples end
   if bucket then
    for id,e in pairs(t.crafters)do bucket[id]=bucket[id]or {};local name=status(e);bucket[id][name]=(bucket[id][name]or 0)+1 end
    if tick%600==0 then for id,e in pairs(t.arms)do bucket[id]=bucket[id]or {};local name=status(e);bucket[id][name]=(bucket[id][name]or 0)+1 end end
   end
   if blocked then for i,p in ipairs(b.outputs or {})do t.blockedMax[i]=math.max(t.blockedMax[i]or 0,output_count(t,p)) end end
  end
  if tick==W then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t).get_output_count(p.item)end
   for _,p in ipairs(b.products)do t.baseline['made:'..p]=stats(t).get_input_count(p)end
   for id,e in pairs(t.crafters)do t.machineBaseline[id]=e.products_finished end
  end
  if tick==M then
   local minutes=payload.measure/3600
   r.powered=t.powered;r.loopSamples=t.loopSamples;r.exactRecipeChecks=t.actualRecipeChecks;r.outputsPerMinute={};r.madePerMinute={};r.consumptionPerMinute={};r.inputs={};r.fluids={};r.outputPorts={};r.machines={};r.arms={}
   check(t.force.inserter_stack_size_bonus==0 and t.force.bulk_inserter_capacity_bonus==1,'inserter capacity baseline drifted')
   r.inserterCapacityResearch={fast=t.force.inserter_stack_size_bonus,bulkUnlockBonus=t.force.bulk_inserter_capacity_bonus,technology='bulk-inserter unlock-equivalent baseline only; no later capacity upgrades',appliedBy='explicit force capacity properties'}
   for _,p in ipairs(b.products)do r.outputsPerMinute[p]=(t.output[p]or 0)/minutes;r.madePerMinute[p]=(stats(t).get_input_count(p)-(t.baseline['made:'..p]or 0))/minutes end
   for i,p in ipairs(b.inputs)do
    local n=t.measuredFed[i]or 0
    r.consumptionPerMinute[p.item]=(stats(t).get_output_count(p.item)-(t.baseline[p.item]or 0))/minutes
    r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,perMinute=p.perMinute,acceptedDuringMeasurement=n,acceptedPerMinute=n/minutes,measuredPerMinute=n/minutes,productiveRoute=input_route(t,p),entranceLanes=lane_counts(t.entities[p.entity],p.item)}
   end
   for i,p in ipairs(b.fluids or {})do
    local n=t.fluidMeasured[i]or 0;local c=fluid_consumers(t,p)
    r.fluids[#r.fluids+1]={item=p.item,entity=p.entity,perMinute=p.perMinute,acceptedDuringMeasurement=n,acceptedPerMinute=n/minutes,measuredPerMinute=n/minutes,sourceFluidSegment=c.segment,connectedConsumers=c.connected,productiveConsumers=c.productive,disconnectedConsumers=c.disconnected,entranceFluid=t.entities[p.entity].get_fluid_count(p.item)}
   end
   for i,p in ipairs(b.outputs or {})do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.crafters)do
    local fluids={};for j=1,e.fluids_count do local f=e.get_fluid(j);if f then fluids[#fluids+1]={name=f.name,amount=f.amount} end end
    r.machines[#r.machines+1]={entity=id,recipe=recipe(t,id),actualRecipe=e.get_recipe() and e.get_recipe().name or 'none',x=e.position.x-t.offset.x,y=e.position.y-t.offset.y,nativeCraftingSpeed=e.crafting_speed,nativeRecipeEnergy=e.get_recipe().energy,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],input=e.get_inventory(defines.inventory.crafter_input).get_contents(),output=e.get_inventory(defines.inventory.crafter_output).get_contents(),fluids=fluids}
   end
   for id,e in pairs(t.arms)do
    r.arms[#r.arms+1]={entity=id,name=e.name,x=e.position.x-t.offset.x,y=e.position.y-t.offset.y,status=status(e),samples=t.samples[id]}
   end
   if payload.debugTopology then
    r.transport={}
    for id,e in pairs(t.entities)do if is_belt(e) then
     local lines={};for i=1,e.get_max_transport_line_index()do lines[i]=e.get_transport_line(i).get_contents() end
     r.transport[#r.transport+1]={entity=id,name=e.name,x=e.position.x-t.offset.x,y=e.position.y-t.offset.y,lines=lines}
    end end
   end
   write()
  end
  if tick==B-3600 then t.blockedCraftsMark={};for id,e in pairs(t.crafters)do t.blockedCraftsMark[id]=e.products_finished end end
  if tick==B then
   local stocks={};local stopped=true;local still={}
   for i,p in ipairs(b.outputs or {})do stocks[#stocks+1]={item=p.item,entity=p.entity,count=output_count(t,p),lanes=lane_counts(t.entities[p.entity],p.item),capacity=p.cap,maxDuringBlocked=t.blockedMax[i]or 0} end
   local machinesAtEnd={}
   for id,e in pairs(t.crafters)do
    local n=e.products_finished-(t.blockedCraftsMark[id]or 0);if n>0 then stopped=false;still[#still+1]={entity=id,recipe=recipe(t,id),craftsInLastMinute=n} end
    machinesAtEnd[#machinesAtEnd+1]={entity=id,recipe=recipe(t,id),status=status(e),output=e.get_inventory(defines.inventory.crafter_output).get_contents()}
   end
   r.blocked={minutes=payload.blocked/3600,mode='natural-production-only-collection-stopped-entrances-still-fed',collectionPauseStock=stocks,machinesStoppedInLastMinute=stopped,stillCrafting=still,machinesAtEnd=machinesAtEnd,statusSamples=t.blockedSamples}
   write()
  end
  if tick==R then
   local minutes=payload.recovery/3600
   r.recovery={blockedMinutes=payload.blocked/3600,settlingMinutes=payload.settle/3600,measurementMinutes=minutes,outputsPerMinute={},inputs={},fluids={}}
   for _,p in ipairs(b.products)do r.recovery.outputsPerMinute[p]=(t.recoveryOutput[p]or 0)/minutes end
   for i,p in ipairs(b.inputs)do r.recovery.inputs[#r.recovery.inputs+1]={item=p.item,acceptedPerMinute=(t.recoveryFed[i]or 0)/minutes} end
   for i,p in ipairs(b.fluids or {})do r.recovery.fluids[#r.recovery.fluids+1]={item=p.item,acceptedPerMinute=(t.fluidRecovery[i]or 0)/minutes} end
   r.bulkInserters={}
   for id,_ in pairs(t.bulkEntities)do r.bulkInserters[#r.bulkInserters+1]={entity=id,observedMaxHand=t.bulkMaxHand[id]or 0} end
   r.finished=true
   write()
  end
 end
end)
