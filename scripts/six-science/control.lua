-- Six-pack science native harness. Adapted from scripts/robot-logistics-workshop/control.lua:
-- same private import, revive, exterior feeding, energy fixture and once-per-second sampling;
-- robot-specific token, clock and selective-phase checks removed; per-tile ring checks per
-- declared reader mode; diagnostics per machine, arm, ring and entrance.
-- payload.supply (item -> per minute), when present, limits every entrance to that rate (the
-- panel-supply run of the qualification); without it every entrance is offered a full belt.
-- The pack governor declared in the manifest is checked part by part: power, the three networks,
-- the arms' conditions and pulse reading.
local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('SIX_SCIENCE: '..msg) end end
local statusName={}
for n,v in pairs(defines.entity_status) do statusName[v]=n end
local function status(e) return statusName[e.status] or tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function recipe(t,id) return t.spec[id].recipe end
local function stats(t,name) return t.force.get_item_production_statistics(t.surface).get_output_count(name) end
local P=payload.phases
local W=P.warmup
local M=W+P.measure
local B=M+P.blocked
local S=B+P.settle
local R=S+P.recovery
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
local function ringCount(t,loop)
 local count=0;local signals=t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red)or {}
 for _,signal in ipairs(signals)do if signal.signal.type~='virtual' then count=count+signal.count end end
 return count,signals
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
  local t={id=b.id,surface=s,force=force,entities={},fed={},measuredFed={},recoveryFed={},output={},recoveryOutput={},baseline={},machineBaseline={},machineAtBlocked={},powered=false,portOutputs={},samples={},loopSamples={},fluidFed={},actualRecipeChecks=0,bulkMaxHand={},chestMax={}}
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
  for _,saved in ipairs(b.entities)do
   local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed '..saved.entity_number)
   check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
   if saved.recipe then
    local active=e.get_recipe();check(active and active.name==saved.recipe,'recipe changed '..saved.entity_number);check(e.products_finished==0,'nonempty machine')
    check(e.get_module_inventory().is_empty(),'installed modules')
    local expected={};for _,ingredient in ipairs(t.ingredients[saved.recipe])do expected[ingredient.name]=ingredient.amount end
    local count=0;for _,ingredient in pairs(active.ingredients)do check(expected[ingredient.name]==ingredient.amount,'native ingredient mismatch '..saved.recipe..' '..ingredient.name);count=count+1 end
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
 end
end)
local function writeReport() helpers.write_file('result.json',helpers.table_to_json(storage.report),false) end
script.on_event(defines.events.on_tick,function()
 local tick=game.tick
 if tick%3600==0 then helpers.write_file('progress.json',helpers.table_to_json{tick=tick,target=R},false) end
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index]
  if tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0;t.force.bulk_inserter_capacity_bonus=1 end
  for id,e in pairs(t.bulkEntities)do if e.held_stack.valid_for_read then
   local c=e.held_stack.count;if c>(t.bulkMaxHand[id]or 0)then t.bulkMaxHand[id]=c end
  end end
  -- The only writes: fluid into declared fluid entrances, items onto both lanes of declared entrance belts.
  local blocked=tick>M and tick<=B
  -- payload.supply (item -> per minute) limits an entrance to that rate: a credit grows by rate/3600 each
  -- tick and is capped at a few items, so supply that the entrance refuses is not banked for later.
  local supply=payload.supply;t.credit=t.credit or {}
  for i,p in ipairs(b.fluids or {})do
   local amount=1000
   if supply then local c=math.min((t.credit[p.item]or 0)+supply[p.item]/3600,100);t.credit[p.item]=c;amount=c end
   local n=amount>0 and t.entities[p.entity].insert_fluid{name=p.item,amount=amount} or 0
   if supply then t.credit[p.item]=t.credit[p.item]-n end
   if tick>W and tick<=M then t.fluidFed[i]=(t.fluidFed[i]or 0)+n end
   if tick>S and tick<=R then t.recoveryFluidFed=t.recoveryFluidFed or {};t.recoveryFluidFed[i]=(t.recoveryFluidFed[i]or 0)+n end
  end
  if supply then for _,p in ipairs(b.inputs)do t.credit[p.item]=math.min((t.credit[p.item]or 0)+supply[p.item]/3600,8) end end
  if tick%4==0 then for i,p in ipairs(b.inputs)do
   local belt=t.entities[p.entity]
   for lane=1,2 do if (not supply or t.credit[p.item]>=1) and belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
    if supply then t.credit[p.item]=t.credit[p.item]-1 end
    t.fed[i]=(t.fed[i]or 0)+1
    if tick>W and tick<=M then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
    if tick>S and tick<=R then t.recoveryFed[i]=(t.recoveryFed[i]or 0)+1 end
   end end
  end end
  if tick%60==0 then
   if tick==60 then
    check(t.pole.electric_network_id~=nil,'power network missing');t.powered=true
    local ringNetworks={}
    for _,loop in ipairs(b.loopControl or {})do
     local reader=t.entities[loop.reader];local network=reader.get_circuit_network(defines.wire_connector_id.circuit_red);check(network~=nil,'disconnected reader '..loop.name)
     for _,id in ipairs(loop.loop)do local e=t.entities[id];local c=e.get_control_behavior();local n=e.get_circuit_network(defines.wire_connector_id.circuit_red)
      check(c and c.read_contents and c.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.hold and n and n.network_id==network.network_id,'ring tile is not a per-tile hold reader on the ring network '..loop.name..' '..id)
      check(e.get_circuit_network(defines.wire_connector_id.circuit_green)==nil,'green wire on ring tile '..id)
     end
     for _,id in ipairs(loop.controlled)do local e=t.entities[id];local actual=e.get_circuit_network(defines.wire_connector_id.circuit_red);check(actual and actual.network_id==network.network_id,'disconnected loop controller '..id)end
     check(ringNetworks[network.network_id]==nil,'two rings share one red network '..loop.name);ringNetworks[network.network_id]=loop.name
    end
    for _,p in ipairs(b.outputs)do local chest=t.entities[p.entity]
     check(chest.get_circuit_network(defines.wire_connector_id.circuit_red)==nil and chest.get_circuit_network(defines.wire_connector_id.circuit_green)==nil,'output chest is wired '..p.item)
     t.chestBars=t.chestBars or {};t.chestBars[p.item]=chest.get_inventory(defines.inventory.chest).get_bar()
    end
    t.stockNetworksIsolated=true
    for _,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' or e.type=='decider-combinator' or e.type=='arithmetic-combinator' then
     check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y)
    end end
    local g=b.governor
    if g then
     local id=defines.wire_connector_id
     local function net(e,connector,what) local n=e.get_circuit_network(connector);check(n~=nil,'governor: no network on '..what);return n.network_id end
     local constant,counter,memory,subtractor=t.entities[g.constant],t.entities[g.counter],t.entities[g.memory],t.entities[g.subtractor]
     check(constant.name=='constant-combinator' and counter.name=='decider-combinator' and memory.name=='arithmetic-combinator' and subtractor.name=='arithmetic-combinator','governor parts changed')
     local tokens=net(constant,id.circuit_green,'the constant')
     local pulses=net(subtractor,id.combinator_input_red,'the subtractor input')
     local loop=net(memory,id.combinator_input_red,'the memory input')
     check(net(counter,id.combinator_input_green,'the counter input')==tokens and net(memory,id.combinator_output_green,'the memory output')==tokens,'governor: token network broken')
     check(net(counter,id.combinator_output_red,'the counter output')==loop and net(memory,id.combinator_output_red,'the memory loop')==loop and net(subtractor,id.combinator_output_red,'the subtractor output')==loop,'governor: memory loop broken')
     check(counter.get_circuit_network(id.combinator_input_red)==nil and memory.get_circuit_network(id.combinator_input_green)==nil and subtractor.get_circuit_network(id.combinator_input_green)==nil,'governor: extra wire on a combinator input')
     check(tokens~=pulses and tokens~=loop and pulses~=loop,'governor networks merged')
     for networkId in pairs(ringNetworks)do check(networkId~=tokens and networkId~=pulses and networkId~=loop,'governor network joined a ring') end
     check(#g.arms==#b.outputs,'one governed arm per output chest')
     for index,a in ipairs(g.arms)do
      local e=t.entities[a.arm];local c=e.get_control_behavior()
      check(a.item==b.outputs[index].item and e.drop_target==t.entities[b.outputs[index].entity],'governed arm does not feed the chest of '..a.item)
      check(net(e,id.circuit_green,'arm '..a.item)==tokens and net(e,id.circuit_red,'arm '..a.item)==pulses,'governed arm off its networks '..a.item)
      check(c and c.circuit_enable_disable and c.circuit_read_hand_contents and c.circuit_hand_read_mode==defines.control_behavior.inserter.hand_read_mode.pulse,'governed arm must be enabled by circuit and read its hand as a pulse '..a.item)
      local condition=c.circuit_condition
      check(condition and condition.first_signal and condition.first_signal.name==a.item and condition.constant==g.enableAt,'governed arm condition changed '..a.item)
      check(e.inserter_stack_size_override==1,'governed arm must move one pack per swing '..a.item)
     end
     t.governorChecked=true
    end
   end
   -- Collect declared products from declared chests once per second, except while blocked.
   for outputIndex,p in ipairs(b.outputs or {})do
    local e=t.entities[p.entity];local n=0
    if not blocked then
     -- payload.collectPerMinute (exploration only) takes at most that many packs per minute from each chest.
     local want=1000000
     if payload.collectPerMinute then t.collectCredit=t.collectCredit or {};local c=math.min((t.collectCredit[p.item]or 0)+payload.collectPerMinute/60,10);want=math.floor(c);t.collectCredit[p.item]=c end
     if want>0 then n=e.remove_item{name=p.item,count=want} end
     if payload.collectPerMinute then t.collectCredit[p.item]=t.collectCredit[p.item]-n end
    end
    if tick>W and tick<=M then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
    if tick>S and tick<=R then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
    if blocked then local c=e.get_item_count(p.item);if c>(t.chestMax[p.item]or 0)then t.chestMax[p.item]=c end;check(c<=p.cap,'closed chest cap exceeded '..p.item) end
   end
   for _,loop in ipairs(b.loopControl or {})do
    local count,signals=ringCount(t,loop)
    local sample=t.loopSamples[loop.name]or {maxStock=0,capacity=loop.capacity,limitSum=loop.maximumStock}
    if count>sample.maxStock then sample.maxStock=count;sample.maxSignals=signals end
    sample.lastSignals=signals;t.loopSamples[loop.name]=sample
    check(count<loop.capacity*.9,'loop overfilled '..loop.name..' '..count..'/'..loop.capacity)
   end
   if tick>W and tick<=M then
    for id,e in pairs(t.crafters)do
     local active=e.get_recipe();if active then check(active.name==recipe(t,id),'wrong active recipe '..id);t.actualRecipeChecks=t.actualRecipeChecks+1 end
     t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1
    end
    if tick%600==0 then for id,e in pairs(t.arms)do t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1 end end
   end
  end
  if tick==W then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t,p.item)end
   for id,e in pairs(t.crafters)do t.machineBaseline[id]=e.products_finished end
  end
  if tick==M then
   for id,e in pairs(t.crafters)do t.machineAtBlocked[id]=e.products_finished end
  end
  if tick==B then
   t.collectionPauseStock={}
   for _,p in ipairs(b.outputs or {})do
    local n=t.entities[p.entity].get_item_count(p.item)
    t.collectionPauseStock[#t.collectionPauseStock+1]={item=p.item,entity=p.entity,count=n,capacity=p.cap,maxDuringBlocked=t.chestMax[p.item]or 0}
   end
  end
 end
 if tick==M then
  local feed=payload.supply and 'Declared exterior belt lanes and declared fluid entrances only, each limited to its declared per-minute figure (a credit of rate/3600 per tick, at most 8 items or 100 fluid banked, one item per lane every 4 ticks at most)' or 'Declared exterior belt lanes (one item per lane every 4 ticks) and declared fluid entrances (every tick) only'
  local report={builds={},feedPolicy=feed..'; electricity through one energy interface on the power port network; declared products collected from declared east chests once per second',researchPolicy='All recipes enabled; fast inserter stack bonus zero; bulk unlock-equivalent capacity bonus +1 only'}
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local r={id=t.id,blueprintSha256=b.blueprintSha256,outputsPerMinute={},consumptionPerMinute={},inputs={},outputPorts={},machines={},powered=t.powered,importedEntities=#b.entities,loopSamples=t.loopSamples,exactRecipeChecks=t.actualRecipeChecks,externalApproachesClear=true,stockNetworksIsolated=t.stockNetworksIsolated}
   check(t.force.inserter_stack_size_bonus==0 and t.force.bulk_inserter_capacity_bonus==1,'inserter capacity baseline drifted')
   r.inserterCapacityResearch={fast=t.force.inserter_stack_size_bonus,bulkUnlockBonus=t.force.bulk_inserter_capacity_bonus}
   r.bulkInserters={};local maxHand=0
   for id,e in pairs(t.bulkEntities)do local h=t.bulkMaxHand[id]or 0;if h>maxHand then maxHand=h end;r.bulkInserters[#r.bulkInserters+1]={entity=id,observedMaxHand=h} end
   r.observedMaxHand=maxHand;r.chestBars=t.chestBars
   for _,p in ipairs(b.products or {})do r.outputsPerMinute[p]=(t.output[p]or 0)/(P.measure/3600)end
   for i,p in ipairs(b.inputs)do r.consumptionPerMinute[p.item]=(stats(t,p.item)-(t.baseline[p.item]or 0))/(P.measure/3600);r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.measuredFed[i]or 0,acceptedPerMinute=(t.measuredFed[i]or 0)/(P.measure/3600),productiveRoute=input_route(t,p)}end
   r.fluids={}
   for fluidIndex,p in ipairs(b.fluids or {})do
    local source=t.entities[p.entity];local consumers={}
    for id,e in pairs(t.crafters)do local rc=recipe(t,id);if (p.item=='lubricant' and rc=='electric-engine-unit') or (p.item=='sulfuric-acid' and (rc=='battery' or rc=='processing-unit')) then
     local connected=false
     for j=1,e.fluids_count do for _,c in pairs(e.get_fluid_box_pipe_connections(j)or {})do
      local pipe=c.target or c.target_entity
      if pipe and pipe.has_fluid_segment(c.target_fluidbox_index or 1) and pipe.get_fluid_segment_id(c.target_fluidbox_index or 1)==source.get_fluid_segment_id(1) then connected=true end
     end end
     check(connected,'disconnected fluid consumer '..id)
     if e.products_finished>(t.machineBaseline[id]or 0) then consumers[#consumers+1]=id end
    end end
    r.fluids[#r.fluids+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.fluidFed[fluidIndex]or 0,sourceFluidSegment=source.get_fluid_segment_id(1),productiveConsumers=consumers}
   end
   for i,p in ipairs(b.outputs or {})do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.crafters)do
    local active=e.get_recipe()
    r.machines[#r.machines+1]={entity=id,recipe=recipe(t,id),block=t.spec[id].tags and t.spec[id].tags.block,x=t.spec[id].position.x,y=t.spec[id].position.y,actualRecipe=active and active.name or 'none',measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],inventory=e.get_inventory(defines.inventory.crafter_input).get_contents(),output=e.get_inventory(defines.inventory.crafter_output).get_contents(),modules=e.get_module_inventory().get_contents()}
   end
   r.arms={}
   for id,e in pairs(t.arms)do local tags=t.spec[id].tags or {}
    if tags.role=='controlled-feed' or tags.role=='lane-export' or tags.role=='output' or tags.role=='rear-feed' then
     r.arms[#r.arms+1]={entity=id,block=tags.block,role=tags.role,item=tags.stock_item,x=t.spec[id].position.x,y=t.spec[id].position.y,status=status(e),samples=t.samples[id]}
    end
   end
   if b.governor then
    local signals=t.entities[b.governor.memory].get_signals(defines.wire_connector_id.combinator_output_green)or {}
    -- The timer network carries the memory plus the constant's bias; an arm runs at enableAt and above.
    local timers={};for _,x in ipairs(signals)do timers[x.signal.name]=x.count end
    r.governor={checked=t.governorChecked==true,periodTicks=b.governor.periodTicks,enableAt=b.governor.enableAt,counterStopsAt=b.governor.counterStopsAt,timerNetworkAtMeasureEnd=timers}
   end
   if payload.supply then r.supplyPerMinute=payload.supply end
   if payload.debugTopology then
    r.belts={}
    for id,e in pairs(t.entities)do if e.type=='transport-belt' or e.type=='underground-belt' then
     local lines={};for i=1,2 do lines[i]=e.get_transport_line(i).get_contents() end
     r.belts[#r.belts+1]={entity=id,x=t.spec[id].position.x,y=t.spec[id].position.y,lines=lines}
    end end
   end
   report.builds[#report.builds+1]=r
  end
  storage.report=report
  writeReport()
 end
 if tick==R then
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index]
   local recovery={blockedMinutes=P.blocked/3600,settlingMinutes=P.settle/3600,measurementMinutes=P.recovery/3600,outputsPerMinute={},inputs={}}
   for _,item in ipairs(b.products or {})do recovery.outputsPerMinute[item]=P.recovery>0 and (t.recoveryOutput[item]or 0)/(P.recovery/3600) or 0 end
   for i,p in ipairs(b.inputs)do recovery.inputs[#recovery.inputs+1]={item=p.item,acceptedPerMinute=P.recovery>0 and (t.recoveryFed[i]or 0)/(P.recovery/3600) or 0} end
   recovery.fluids={}
   for i,p in ipairs(b.fluids or {})do recovery.fluids[#recovery.fluids+1]={item=p.item,acceptedPerMinute=P.recovery>0 and ((t.recoveryFluidFed or {})[i]or 0)/(P.recovery/3600) or 0} end
   recovery.pauseMode='natural-stocking-collection-paused-no-product-fixtures';recovery.collectionPauseStock=t.collectionPauseStock
   local br=storage.report.builds[index];br.recovery=recovery;br.loopSamplesFinal=t.loopSamples
   local blockedCrafts={}
   for id,e in pairs(t.crafters)do local rc=recipe(t,id);blockedCrafts[rc]=(blockedCrafts[rc]or 0)+(e.products_finished-(t.machineAtBlocked[id]or 0)) end
   br.craftsAfterMeasurement=blockedCrafts
  end
  writeReport()
 end
end)
