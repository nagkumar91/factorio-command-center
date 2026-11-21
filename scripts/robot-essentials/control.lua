-- Native harness for robot-essentials. Copied from scripts/robot-logistics-workshop/control.lua
-- and adapted: phase lengths come from the payload protocol, robot-specific checks are
-- conditional on the manifest, gate belts and fluid segments are checked at import, and
-- exploration diagnostics (token and ring samples) are added. Feeding and collection are
-- unchanged: declared entrance lanes, declared fluid pipes, electricity; collection only
-- from the declared output chest.
local payload=helpers.json_to_table(require('payload'))
local P=payload.protocol
local W,M,B,S,R,PH,PS,NP=P.warmup,P.measure,P.blocked,P.settle,P.recovery,P.phase,P.phaseSettle,P.phases
local MEASURE_END=W+M
local SELECTIVE_START=W+M+B+S+R
local FINAL=SELECTIVE_START+NP*PH
local function check(ok,msg) if not ok then error('FLIGHT_SCIENCE: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function recipe(t,id) return t.spec[id].recipe or (t.spec[id].tags or {}).production_recipe end
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
local function fluid_consumers(t,b,p)
 local source=t.entities[p.entity];local consumers={}
 for id,e in pairs(t.entities)do if e.type=='assembling-machine' and ((p.item=='lubricant' and recipe(t,id)=='electric-engine-unit') or (p.item=='sulfuric-acid' and (recipe(t,id)=='battery' or recipe(t,id)=='processing-unit'))) then
  local connected=false
  for j=1,e.fluids_count do for _,c in pairs(e.get_fluid_box_pipe_connections(j)or {})do
   local pipe=c.target or c.target_entity
   if pipe and pipe.has_fluid_segment(c.target_fluidbox_index or 1) and pipe.get_fluid_segment_id(c.target_fluidbox_index or 1)==source.get_fluid_segment_id(1) then connected=true end
  end end
  check(connected,'disconnected fluid consumer '..id..' '..p.item)
  consumers[#consumers+1]=id
 end end
 return consumers
end
local function signal_count(signals,name)
 for _,s in ipairs(signals or {})do if s.signal.name==name then return s.count end end
 return 0
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
  local t={id=b.id,surface=s,force=force,entities={},fed={},measuredFed={},output={},baseline={},machineBaseline={},powered=false,portSamples={},portOutputs={},samples={},loopSamples={},recoveryOutput={},fluidFed={},actualRecipeChecks=0,bulkMaxHand={},tokenSamples={},ringItemMax={}}
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
  t.bulkEntities={}
  for id,e in pairs(t.entities)do if e.name=='bulk-inserter' then t.bulkEntities[id]=e end end
  local first=b.entities[1];local actual=t.entities[first.entity_number];local dx=actual.position.x-first.position.x;local dy=actual.position.y-first.position.y
  for _,saved in ipairs(b.entities)do
   local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed')
   check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
   if saved.recipe then
    local actual=e.get_recipe();check(actual.name==saved.recipe,'recipe changed');check(e.products_finished==0,'nonempty machine')
    check(e.get_module_inventory().is_empty(),'installed modules')
    local expected={};for _,ingredient in ipairs(t.ingredients[saved.recipe])do expected[ingredient.name]=ingredient.amount end
    local count=0;for _,ingredient in pairs(actual.ingredients)do check(expected[ingredient.name]==ingredient.amount,'native ingredient mismatch '..saved.recipe..' '..ingredient.name);count=count+1 end
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
local function import_checks(t,b)
 check(t.pole.electric_network_id~=nil,'power network missing');t.powered=true
 for _,loop in ipairs(b.loopControl or {})do
  local reader=t.entities[loop.reader];local behavior=reader.get_control_behavior()
  local hold=defines.control_behavior.transport_belt.content_read_mode.hold
  local whole=defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold
  local network=reader.get_circuit_network(defines.wire_connector_id.circuit_red);check(network~=nil,'disconnected reader')
  if loop.readerMode=='entire-belt-hold' then
   check(behavior.read_contents and behavior.read_contents_mode==whole,'incorrect loop reader '..loop.name)
  else
   check(behavior.read_contents and behavior.read_contents_mode==hold,'incorrect loop reader '..loop.name)
   for _,id in ipairs(loop.loop)do local e=t.entities[id];local c=e.get_control_behavior();local n=e.get_circuit_network(defines.wire_connector_id.circuit_red);check(c and c.read_contents and c.read_contents_mode==hold and n and n.network_id==network.network_id,'missing individual tile stock reader '..id)end
  end
  for _,id in ipairs(loop.controlled)do local e=t.entities[id];local actual=e.get_circuit_network(defines.wire_connector_id.circuit_red);check(actual and actual.network_id==network.network_id,'disconnected loop controller '..id)
   local saved=t.spec[id].control_behavior;local c=e.get_control_behavior()
   check(saved and saved.circuit_condition and c.circuit_enable_disable and c.circuit_condition.first_signal.name==saved.circuit_condition.first_signal.name and c.circuit_condition.comparator==saved.circuit_condition.comparator and c.circuit_condition.constant==saved.circuit_condition.constant,'loop limit changed '..id)
  end
  for _,r in ipairs(loop.reserves or {})do local e=t.entities[r.entity];local actual=e.get_circuit_network(defines.wire_connector_id.circuit_red);check(actual and actual.network_id==network.network_id,'disconnected reserve arm '..r.entity)
   local c=e.get_control_behavior();check(c.circuit_enable_disable and c.circuit_condition.first_signal.name==r.item and c.circuit_condition.comparator=='>' and c.circuit_condition.constant==r.reserve,'reserve changed '..r.entity)
  end
 end
 local c=b.stockControl
 if c and c.collector then
  local chest=t.entities[c.chest];local collector=t.entities[c.collector]
  check(collector.get_control_behavior().circuit_set_filters,'collector dynamic filters disabled')
  local cn=chest.get_circuit_network(defines.wire_connector_id.circuit_green)
  local fn=collector.get_circuit_network(defines.wire_connector_id.circuit_red)
  local ln=t.entities[b.loopControl[1].reader].get_circuit_network(defines.wire_connector_id.circuit_red)
  check(cn and fn and ln and cn.network_id~=fn.network_id and fn.network_id~=ln.network_id and cn.network_id~=ln.network_id,'chest/filter/loop networks not isolated')
  for id,e in pairs(t.entities)do if e.type=='decider-combinator' and (t.spec[id].tags or {}).stock_control then
   local input=e.get_circuit_network(defines.wire_connector_id.combinator_input_green)
   local output=e.get_circuit_network(defines.wire_connector_id.combinator_output_red)
   check(input and input.network_id==cn.network_id and output and output.network_id==fn.network_id,'stock decider disconnected')
  end end
  t.chestNetwork=cn.network_id
 end
 if b.loopReturnCorner then check(#t.entities[b.loopReturnCorner].belt_neighbours.inputs==1,'return corner must preserve both circulating lanes') end
 if b.productionClock then
  local clockNetwork=t.entities[b.productionClock.timer].get_circuit_network(defines.wire_connector_id.combinator_output_red)
  for _,id in pairs(b.productionClock.moduloEntities)do local n=t.entities[id].get_circuit_network(defines.wire_connector_id.combinator_input_red);check(n and n.network_id==clockNetwork.network_id,'timer input wire missing '..id)end
  local gate=b.productionClock.supplyGate
  if gate then
   local e=t.entities[gate.entity];local ring=t.entities[b.loopControl[1].reader].get_circuit_network(defines.wire_connector_id.circuit_red)
   local input=e.get_circuit_network(defines.wire_connector_id.combinator_input_red);check(input and input.network_id==ring.network_id,'supply gate does not read the ring')
   local output=e.get_circuit_network(defines.wire_connector_id.combinator_output_red);check(output and output.network_id==clockNetwork.network_id,'supply gate does not drive the timer')
   local seen=0
   for _,c in ipairs(e.get_control_behavior().parameters.conditions)do check(c.comparator=='>' and gate.thresholds[c.first_signal.name]==c.constant,'supply gate threshold changed '..c.first_signal.name);seen=seen+1 end
   check(seen==table_size(gate.thresholds),'supply gate condition count')
   local out=e.get_control_behavior().parameters.outputs
   check(#out==1 and out[1].signal.name==gate.signal and out[1].copy_count_from_input==false and (out[1].constant or 1)==gate.boost,'supply gate output changed')
   local timer=t.entities[b.productionClock.timer].get_control_behavior().parameters
   check(timer.operation=='+' and timer.second_constant==b.productionClock.unitsPerTick.nominal and timer.first_signal.name==gate.signal and timer.output_signal.name==gate.signal,'timer step changed')
   t.supplyGate=e
  end
  for _,token in pairs(b.productionClock.robotTokens or {})do
   local arm=t.entities[token.output];local behavior=arm.get_control_behavior();check(behavior.circuit_read_hand_contents and behavior.circuit_hand_read_mode==defines.control_behavior.inserter.hand_read_mode.hold,'robot pickup reset must hold hand contents')
   local private=t.entities[token.handReset].get_circuit_network(defines.wire_connector_id.combinator_input_green);local hand=arm.get_circuit_network(defines.wire_connector_id.circuit_green);check(private and hand and private.network_id==hand.network_id,'robot hand reset disconnected')
   local bus=t.entities[token.latch].get_circuit_network(defines.wire_connector_id.combinator_output_green);local permission=t.entities[token.permission].get_circuit_network(defines.wire_connector_id.combinator_input_green);check(bus and permission and bus.network_id==permission.network_id and bus.network_id~=hand.network_id and bus.network_id~=t.chestNetwork,'robot token bus disconnected or mixed with item counts')
   t.tokenBus=bus
  end
 end
 t.stockNetworksIsolated=true
 for _,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' or e.type=='arithmetic-combinator' or e.type=='decider-combinator' then
  check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y)
 end end
 t.importFluids={}
 for _,p in ipairs(b.fluids or {})do t.importFluids[#t.importFluids+1]={item=p.item,consumers=fluid_consumers(t,b,p)} end
end
script.on_event(defines.events.on_tick,function()
 if game.tick%3600==0 then helpers.write_file('progress.json',helpers.table_to_json{tick=game.tick,target=FINAL},false) end
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index]
  if game.tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0;t.force.bulk_inserter_capacity_bonus=1;check(t.force.inserter_stack_size_bonus==0 and t.force.bulk_inserter_capacity_bonus==1,'incorrect inserter unlock baseline') end
  for id,e in pairs(t.bulkEntities)do if e.held_stack.valid_for_read then
   t.bulkMaxHand[id]=math.max(t.bulkMaxHand[id]or 0,e.held_stack.count)
  end end
  -- payload.supply: feed entrances at a multiple of their panel figures instead of saturating
  -- them. belt and fluid are the multiples for all belt and fluid entrances, items overrides one
  -- entrance by name; an entrance without a multiple is saturated as in the plain protocol.
  -- Supply the workshop does not take waits as a backlog (belts: `backlog` items, default 16,
  -- about two belt tiles; fluids: two seconds) and is lost beyond that, like a supplier that
  -- stalls on a full belt.
  local supply=payload.supply or {}
  local function multiple(p,kind)local k=supply.items and supply.items[p.item];if k==nil then k=supply[kind] end;return k end
  for i,p in ipairs(b.fluids or {})do
   local k=multiple(p,'fluid');local amount=1000
   if k then t.fluidCredit=t.fluidCredit or {};local rate=p.perMinute*k/3600;t.fluidCredit[i]=math.min((t.fluidCredit[i]or 0)+rate,rate*120);amount=t.fluidCredit[i] end
   local n=amount>0 and t.entities[p.entity].insert_fluid{name=p.item,amount=amount} or 0
   if k then t.fluidCredit[i]=t.fluidCredit[i]-n end
   if game.tick>W and game.tick<=MEASURE_END then t.fluidFed[i]=(t.fluidFed[i]or 0)+n end
  end
  for i,p in ipairs(b.inputs)do
   local k=multiple(p,'belt');local belt=t.entities[p.entity]
   if k then
    t.beltCredit=t.beltCredit or {};t.beltLane=t.beltLane or {}
    t.beltCredit[i]=math.min((t.beltCredit[i]or 0)+p.perMinute*k/3600,supply.backlog or 16)
    if t.beltCredit[i]>=1 then
     local first=t.beltLane[i]or 1
     for step=0,1 do local lane=(first+step-1)%2+1
      if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
       t.beltCredit[i]=t.beltCredit[i]-1;t.beltLane[i]=lane%2+1
       t.fed[i]=(t.fed[i]or 0)+1
       if game.tick>W and game.tick<=MEASURE_END then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
       break
      end
     end
    end
   elseif game.tick%4==0 then
    -- The only ingredient writes are to the two lanes of the declared input belt.
    for lane=1,2 do if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
     t.fed[i]=(t.fed[i]or 0)+1
     if game.tick>W and game.tick<=MEASURE_END then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
    end end
   end
  end
  -- Selective stocking is natural: stop collecting one product, inject none.
  if NP>0 and game.tick>SELECTIVE_START and (game.tick-SELECTIVE_START)%PH==0 then
   local phase=(game.tick-SELECTIVE_START)/PH
   local p=b.outputs[phase];t.selectiveStocks=t.selectiveStocks or {}
   t.selectiveStocks[phase]=t.entities[p.entity].get_item_count(p.item)
   storage.report.builds[index].selectiveProgress=storage.report.builds[index].selectiveProgress or {}
   storage.report.builds[index].selectiveProgress[phase]={blockedProduct=p.item,count=t.selectiveStocks[phase],cap=p.cap,passed=t.selectiveStocks[phase]==p.cap}
   local progress=storage.report.builds[index].selectiveProgress[phase];progress.loopSignals=t.entities[b.loopControl[1].reader].get_signals(defines.wire_connector_id.circuit_red);progress.robotMachines={}
   for id,e in pairs(t.entities)do if crafting(e) and (recipe(t,id)=='construction-robot' or recipe(t,id)=='logistic-robot' or recipe(t,id)=='roboport' or recipe(t,id)=='storage-chest' or recipe(t,id)=='passive-provider-chest' or recipe(t,id)=='flying-robot-frame')then progress.robotMachines[#progress.robotMachines+1]={entity=id,recipe=recipe(t,id),status=status(e),productsFinished=e.products_finished,input=e.get_inventory(defines.inventory.crafter_input).get_contents()}end end
   helpers.write_file('result.json',helpers.table_to_json(storage.report),false)
  end
  if game.tick%60==0 then
   if game.tick==60 then import_checks(t,b) end
   for outputIndex,p in ipairs(b.outputs or {})do
    local e=t.entities[p.entity]
    local paused=game.tick>MEASURE_END and game.tick<=MEASURE_END+B
    local selectiveIndex=(NP>0 and game.tick>SELECTIVE_START) and math.floor((game.tick-SELECTIVE_START-1)/PH)+1 or 0
    local selected=selectiveIndex>0 and b.products[selectiveIndex] or nil
    if selected==p.item then paused=true end
    local n=0
    if not paused then n=e.remove_item{name=p.item,count=1000000} end
    if selected and (game.tick-SELECTIVE_START-1)%PH>=PS then t.selectiveCounts=t.selectiveCounts or {};t.selectiveCounts[selectiveIndex]=t.selectiveCounts[selectiveIndex]or {};local q=t.selectiveCounts[selectiveIndex];q[p.item]=(q[p.item]or 0)+n end
    if game.tick>MEASURE_END+B+S and game.tick<=SELECTIVE_START then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
    if game.tick>W and game.tick<=MEASURE_END then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
   end
   for _,loop in ipairs(b.loopControl or {})do
    local signals=t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red)or {}
    local count=0;for _,signal in ipairs(signals)do if signal.signal.type~='virtual' then count=count+signal.count;t.ringItemMax[signal.signal.name]=math.max(t.ringItemMax[signal.signal.name]or 0,signal.count) end end
    local sample=t.loopSamples[loop.name]or {maxStock=0,capacity=loop.capacity};sample.maxStock=math.max(sample.maxStock,count);sample.lastSignals=signals;t.loopSamples[loop.name]=sample
    if payload.ringSeries and game.tick>W and game.tick<=MEASURE_END then
     t.ringSeries=t.ringSeries or {}
     for item in pairs(loop.limits)do local list=t.ringSeries[item]or {};list[#list+1]=signal_count(signals,item);t.ringSeries[item]=list end
    end
    check(count<loop.capacity*.9,'loop overfilled '..loop.name)
   end
   if t.tokenBus and game.tick>W and game.tick<=MEASURE_END then
    local bus=t.tokenBus.signals
    for item,token in pairs(b.productionClock.robotTokens)do
     local s=t.tokenSamples[item]or {tokenHeld=0,holding=0,samples=0};s.samples=s.samples+1
     if signal_count(bus,token.tokenSignal)>0 then s.tokenHeld=s.tokenHeld+1 end
     if signal_count(bus,token.resetSignal)>0 then s.holding=s.holding+1 end
     t.tokenSamples[item]=s
    end
    if t.supplyGate then
     t.supplySamples=t.supplySamples or {boosted=0,samples=0};t.supplySamples.samples=t.supplySamples.samples+1
     if signal_count(t.supplyGate.get_control_behavior().signals_last_tick,b.productionClock.supplyGate.signal)>0 then t.supplySamples.boosted=t.supplySamples.boosted+1 end
    end
   end
   for id,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' then
    if crafting(e) then local active=e.get_recipe();if active then check(active.name==recipe(t,id),'wrong active recipe '..id..' '..active.name);t.actualRecipeChecks=t.actualRecipeChecks+1 end end
    if game.tick>W and game.tick<=MEASURE_END then t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1
     if crafting(e) and e.status==defines.entity_status.item_ingredient_shortage then
      local inv=e.get_inventory(defines.inventory.crafter_input);t.missing=t.missing or {};t.missing[id]=t.missing[id]or {}
      for _,i in pairs(t.ingredients[recipe(t,id)])do if i.type~='fluid' and inv.get_item_count(i.name)<i.amount then t.missing[id][i.name]=(t.missing[id][i.name]or 0)+1 end end
     end
    end
   end end
  end
  if B>0 and game.tick>MEASURE_END+120 and game.tick<=MEASURE_END+B and game.tick%60==0 then
   for _,p in ipairs(b.outputs)do check(t.entities[p.entity].get_item_count(p.item)<=p.cap,'closed chest cap exceeded '..p.item)end
  end
  if B>0 and game.tick==MEASURE_END+B then
   t.collectionPauseStock={}
   for _,p in ipairs(b.outputs or {})do
    local n=t.entities[p.entity].get_item_count(p.item);t.collectionPauseStock[#t.collectionPauseStock+1]={item=p.item,entity=p.entity,count=n,capacity=p.cap}
   end
  end
  if B>0 and game.tick==MEASURE_END+1 then
   t.blockedOutputFilled={}
   for _,p in ipairs(b.outputs or {})do t.blockedOutputFilled[#t.blockedOutputFilled+1]={entity=p.entity,item=p.item,inserted=0,mode='natural-production-only'} end
  end
  if game.tick==W then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t,p.item)end
   for id,e in pairs(t.entities)do if crafting(e)then t.machineBaseline[id]=e.products_finished end end
  end
 end
 if game.tick==MEASURE_END then
  local report={builds={},feedPolicy='Declared exterior belt lanes and declared fluid pipes only; collect products only from the declared east chest every second',researchPolicy='All recipes enabled; fast inserter stack bonus zero; bulk unlock-equivalent capacity bonus +1 only'}
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local r={id=t.id,outputsPerMinute={},consumptionPerMinute={},inputs={},outputPorts={},machines={},powered=t.powered,importedEntities=#b.entities,loopSamples=t.loopSamples,ringItemMax=t.ringItemMax,ringSeries=t.ringSeries,tokenSamples=t.tokenSamples,supplyGateSamples=t.supplySamples,exactRecipeChecks=t.actualRecipeChecks,externalApproachesClear=true,stockNetworksIsolated=t.stockNetworksIsolated}
   check(t.force.inserter_stack_size_bonus==0 and t.force.bulk_inserter_capacity_bonus==1,'inserter capacity baseline drifted')
   r.inserterCapacityResearch={fast=t.force.inserter_stack_size_bonus,bulkUnlockBonus=t.force.bulk_inserter_capacity_bonus,technology='bulk-inserter unlock-equivalent baseline only; no later capacity upgrades',appliedBy='explicit force capacity properties'}
   r.bulkInserters={}
   for id,e in pairs(t.entities)do if e.name=='bulk-inserter' then r.bulkInserters[#r.bulkInserters+1]={entity=id,observedMaxHand=t.bulkMaxHand[id]or 0} end end
   for _,p in ipairs(b.products or {})do r.outputsPerMinute[p]=(t.output[p]or 0)/(M/3600)end
   for i,p in ipairs(b.inputs)do r.consumptionPerMinute[p.item]=(stats(t,p.item)-(t.baseline[p.item]or 0))/(M/3600);r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.measuredFed[i]or 0,productiveRoute=input_route(t,p)}end
   r.fluids={}
   for fluidIndex,p in ipairs(b.fluids or {})do
    local source=t.entities[p.entity]
    r.fluids[#r.fluids+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.fluidFed[fluidIndex]or 0,sourceFluidSegment=source.get_fluid_segment_id(1),productiveConsumers=fluid_consumers(t,b,p)}
   end
   for i,p in ipairs(b.outputs or {})do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.entities)do if crafting(e)then
    local actualRecipe=e.get_recipe() and e.get_recipe().name or 'none'
    r.machines[#r.machines+1]={entity=id,recipe=recipe(t,id),actualRecipe=actualRecipe,nativeCraftingSpeed=e.crafting_speed,nativeRecipeEnergy=e.get_recipe().energy,nativeIngredients=e.get_recipe().ingredients,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],missing=(t.missing or {})[id],inventory=e.get_inventory(defines.inventory.crafter_input).get_contents(),output=e.get_inventory(defines.inventory.crafter_output).get_contents()}
   end end
   if payload.debugTopology then
    local ids={};for id,e in pairs(t.entities)do ids[e.unit_number]=id end
    r.transport={};r.debugArms={}
    for id,e in pairs(t.entities)do
     if e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' then
      local lines={};for i=1,e.get_max_transport_line_index()do lines[i]=e.get_transport_line(i).get_contents() end
      r.transport[#r.transport+1]={entity=id,lines=lines}
     elseif e.type=='inserter' then
      r.debugArms[#r.debugArms+1]={entity=id,status=status(e),samples=t.samples[id],hand=e.held_stack.valid_for_read and {name=e.held_stack.name,count=e.held_stack.count}}
     end
    end
   end
   report.builds[#report.builds+1]=r
  end
  storage.report=report
  helpers.write_file('result.json',helpers.table_to_json(report),false)
 end
 if game.tick==SELECTIVE_START and storage.report then
  for index,t in ipairs(storage.tests)do
   local recovery={blockedMinutes=B/3600,settlingMinutes=S/3600,measurementMinutes=R/3600,outputsPerMinute={}}
   for _,item in ipairs(payload.builds[index].products or {})do recovery.outputsPerMinute[item]=(t.recoveryOutput[item]or 0)/(math.max(R,1)/3600)end
   recovery.pauseMode='natural-five-product-stocking-collection-paused-no-product-fixtures';recovery.collectionPauseStock=t.collectionPauseStock;recovery.blockedOutputFilled=t.blockedOutputFilled
   storage.report.builds[index].recovery=recovery
  end
  helpers.write_file('result.json',helpers.table_to_json(storage.report),false)
 end
 if NP>0 and game.tick==FINAL and storage.report then
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local phases={}
   for i,item in ipairs(b.products)do
    local phase={blockedProduct=item,settlingMinutes=PS/3600,measurementMinutes=(PH-PS)/3600,outputsPerMinute={}}
    for _,other in ipairs(b.products)do if other~=item then phase.outputsPerMinute[other]=((t.selectiveCounts[i]or {})[other]or 0)/((PH-PS)/3600) end end
    phase.finalBlockedStock=t.selectiveStocks[i]
    phases[#phases+1]=phase
   end
   storage.report.builds[index].independentStockCapTests=phases
  end
  helpers.write_file('result.json',helpers.table_to_json(storage.report),false)
 end
end)
