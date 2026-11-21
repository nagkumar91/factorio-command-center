-- Native harness for rocket-supplies. Copied from scripts/robot-essentials/control.lua and adapted
-- for the space-launch contract (section 11, rate class):
--  * throttled feeding: each declared belt entrance gets a credit of perMinute/3600 per tick
--    (capped at 8) and one item per credit on alternating lanes; each declared fluid entrance gets
--    perMinute/3600 per tick plus what was refused before (carry capped at one second's worth);
--  * collection removes only the declared item from each declared east chest once per second,
--    except during the blocked phase;
--  * per-second sampling only (machine status, ring stock, chest stock); no per-tick entity scans.
--  * pacing (manifest.pacing): wiring and settings of the clock, the logic and the paced machines are
--    read back at import; the clock is read tick by tick for two periods; afterwards the logic's
--    inputs are read on the second and its output one and two ticks later.
-- Phases: warm-up W, steady measurement M, blocked B, settle S, recovery R.
local payload=helpers.json_to_table(require('payload'))
local P=payload.protocol
local W,M,B,S,R=P.warmup,P.measure,P.blocked,P.settle,P.recovery
local STOPWIN=P.stopWindow
local MEASURE_END=W+M
local BLOCK_END=MEASURE_END+B
local RECOVERY_START=BLOCK_END+S
local FINAL=RECOVERY_START+R
local function check(ok,msg) if not ok then error('FLIGHT_SCIENCE: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function recipe(t,id) return t.spec[id].recipe end
local function phase(tick)
 if tick<=W then return 'warmup' elseif tick<=MEASURE_END then return 'measure' elseif tick<=BLOCK_END then return 'blocked' elseif tick<=RECOVERY_START then return 'settle' else return 'recovery' end
end
-- Breadth-first search from an entrance over belts, undergrounds and allowed arms to a machine that
-- crafted with the item during measurement, or (pass-through) to the declared chest of that item.
local function input_route(t,p,chestTarget)
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
  local reached=false
  if chestTarget then reached=(id==chestTarget)
  elseif crafting(e) and e.products_finished>(t.machineBaseline[id]or 0)then
   for _,i in pairs(t.ingredients[recipe(t,id)])do if i.name==p.item then reached=true end end
  end
  if reached then local route={};while unit do table.insert(route,1,byUnit[unit]);unit=previous[unit]end;return route end
  for _,nextUnit in ipairs(edges[unit]or {})do if previous[nextUnit]==nil then previous[nextUnit]=unit;q[#q+1]=nextUnit end end
 end
 return nil
end
-- Every machine whose recipe uses the fluid must share the entrance's fluid segment.
local function fluid_consumers(t,p)
 local source=t.entities[p.entity];local consumers={}
 for id,e in pairs(t.entities)do if crafting(e) then
  local uses=false;for _,i in pairs(t.ingredients[recipe(t,id)])do if i.name==p.item then uses=true end end
  if uses then
   local connected=false
   for j=1,e.fluids_count do for _,c in pairs(e.get_fluid_box_pipe_connections(j)or {})do
    local pipe=c.target or c.target_entity
    if pipe and pipe.has_fluid_segment(c.target_fluidbox_index or 1) and pipe.get_fluid_segment_id(c.target_fluidbox_index or 1)==source.get_fluid_segment_id(1) then connected=true end
   end end
   check(connected,'disconnected fluid consumer '..id..' '..p.item)
   consumers[#consumers+1]=id
  end
 end end
 return consumers
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
  local t={id=b.id,surface=s,force=force,entities={},credit={},carry={},lane={},fed={},output={},recoveryOutput={},baseline={},machineBaseline={},machineMeasureEnd={},machineBlockedLastMinute={},powered=false,portOutputs={},samples={},missing={},loopSamples={},ringItemMax={},actualRecipeChecks=0,bulkMaxHand={},chestMax={},chestSeries={},ringSeries={}}
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
    check(e.get_module_inventory()==nil or e.get_module_inventory().is_empty(),'installed modules')
    local expected={};for _,ingredient in ipairs(t.ingredients[saved.recipe])do expected[ingredient.name]=ingredient.amount end
    local count=0;for _,ingredient in pairs(actual.ingredients)do check(expected[ingredient.name]==ingredient.amount,'native ingredient mismatch '..saved.recipe..' '..ingredient.name);count=count+1 end
    check(count==#t.ingredients[saved.recipe],'native ingredient count mismatch')
   end
   if saved.name=='passive-provider-chest' then
    local inventory=e.get_inventory(defines.inventory.chest)
    check(inventory.get_bar()-1==saved.bar,'chest bar changed '..saved.entity_number..' '..(inventory.get_bar()-1))
    check(inventory.is_empty(),'seeded chest')
   end
   if saved.name=='fast-inserter' then
    check(e.inserter_stack_size_override==1,'fast arm stack override '..saved.entity_number)
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
 local hold=defines.control_behavior.transport_belt.content_read_mode.hold
 t.ringNetworks={}
 for _,loop in ipairs(b.loopControl or {})do
  local reader=t.entities[loop.reader]
  local network=reader.get_circuit_network(defines.wire_connector_id.circuit_red);check(network~=nil,'disconnected reader')
  t.ringNetworks[network.network_id]=true
  for _,id in ipairs(loop.loop)do local e=t.entities[id];local c=e.get_control_behavior();local n=e.get_circuit_network(defines.wire_connector_id.circuit_red);check(c and c.read_contents and c.read_contents_mode==hold and n and n.network_id==network.network_id,'missing individual tile stock reader '..id)
   check(e.get_circuit_network(defines.wire_connector_id.circuit_green)==nil,'green wire on ring tile '..id)
  end
  -- Every entity with a saved circuit condition (entrance gates, product arms, product-gated
  -- ingredient arms) reads the ring network and keeps its condition.
  local conditioned=0
  local paced={};for _,id in ipairs(b.pacing and b.pacing.machines or {})do paced[id]=true end
  for id,saved in pairs(t.spec)do local cb=saved.control_behavior;if cb and cb.circuit_condition and not paced[id] then
   local e=t.entities[id];local n=e.get_circuit_network(defines.wire_connector_id.circuit_red);check(n and n.network_id==network.network_id,'conditioned entity off the ring network '..id)
   local c=e.get_control_behavior()
   check(c.circuit_enable_disable and c.circuit_condition.first_signal.name==cb.circuit_condition.first_signal.name and c.circuit_condition.comparator==cb.circuit_condition.comparator and c.circuit_condition.constant==cb.circuit_condition.constant,'ring condition changed '..id)
   conditioned=conditioned+1
  end end
  local listed=#loop.controlled+#(loop.productGated or {})
  check(conditioned==listed,'conditioned entities '..conditioned..' listed '..listed)
 end
 -- Pacing of the processing-unit line: a clock decider wired output to input on green, a logic
 -- decider that reads the clock (green) and the ring (red), and the paced machines, which read
 -- only the logic output (green, possibly relayed through other machines).
 if b.pacing then
  local pc,cid=b.pacing,defines.wire_connector_id
  local clock,logic=t.entities[pc.clock],t.entities[pc.logic]
  check(clock.name=='decider-combinator' and logic.name=='decider-combinator' and #pc.machines>0,'pacing entities changed')
  local function net(e,c) local n=e.get_circuit_network(c);return n and n.network_id end
  local clockNet=net(clock,cid.combinator_output_green)
  check(clockNet~=nil and net(clock,cid.combinator_input_green)==clockNet,'clock is not wired output to input')
  check(net(clock,cid.combinator_input_red)==nil and net(clock,cid.combinator_output_red)==nil,'red wire on the clock')
  check(net(logic,cid.combinator_input_green)==clockNet,'logic does not read the clock')
  local ringNet=net(logic,cid.combinator_input_red);check(ringNet~=nil and t.ringNetworks[ringNet],'logic does not read the ring')
  local enableNet=net(logic,cid.combinator_output_green)
  check(enableNet~=nil and enableNet~=clockNet,'logic output is missing or joined the clock')
  check(net(logic,cid.combinator_output_red)==nil,'red wire on the logic output')
  local member={[pc.clock]=true,[pc.logic]=true}
  local machines={}
  for _,id in ipairs(pc.machines)do local machine=t.entities[id];member[id]=true;machines[#machines+1]=machine
   check(crafting(machine) and net(machine,cid.circuit_green)==enableNet and net(machine,cid.circuit_red)==nil,'paced machine does not read only the logic output '..id)
   local mc=machine.get_control_behavior()
   check(mc~=nil and mc.circuit_enable_disable and mc.circuit_condition.first_signal.name==pc.enableSignal and mc.circuit_condition.comparator=='>' and mc.circuit_condition.constant==0,'paced machine condition changed '..id)
   check(machine.get_recipe().name==pc.recipe,'paced machine recipe '..id)
  end
  -- Every machine of the paced recipe is paced.
  for id,e in pairs(t.entities)do if crafting(e) and recipe(t,id)==pc.recipe then check(member[id],'unpaced machine of the paced recipe '..id) end end
  for _,id in ipairs(pc.relays or {})do local e=t.entities[id];member[id]=true;check(crafting(e) and net(e,cid.circuit_green)==enableNet and net(e,cid.circuit_red)==nil,'pacing relay '..id) end
  -- Nothing else touches the clock or the enable network.
  for id,e in pairs(t.entities)do if not member[id] then
   check(e.type~='decider-combinator' and e.type~='arithmetic-combinator' and e.type~='constant-combinator','unexpected combinator '..id)
   check(net(e,cid.circuit_green)==nil,'green wire on '..e.name..' '..id)
  end end
  local cp=clock.get_control_behavior().parameters
  check(#cp.conditions==1 and cp.conditions[1].first_signal.name==pc.clockSignal and cp.conditions[1].comparator=='<' and cp.conditions[1].constant==pc.periodTicks-1,'clock condition changed')
  check(#cp.outputs==2 and cp.outputs[1].signal.name==pc.clockSignal and cp.outputs[2].signal.name==pc.clockSignal,'clock outputs changed')
  local copies,ones=0,0
  for _,o in ipairs(cp.outputs)do if o.copy_count_from_input then copies=copies+1 elseif (o.constant or 1)==1 then ones=ones+1 end end
  check(copies==1 and ones==1,'clock must output its count plus one')
  local lp=logic.get_control_behavior().parameters
  local reserves=0;for _ in pairs(pc.reserves)do reserves=reserves+1 end
  check(#lp.conditions==1+reserves,'logic condition count changed')
  local first=lp.conditions[1]
  check(first.first_signal.name==pc.clockSignal and first.comparator=='<' and first.constant==pc.windowTicks and first.first_signal_networks.green and not first.first_signal_networks.red,'logic window condition changed')
  for i=2,#lp.conditions do local c=lp.conditions[i]
   check(pc.reserves[c.first_signal.name]==c.constant and (c.comparator=='≥' or c.comparator=='>=') and c.first_signal_networks.red and not c.first_signal_networks.green,'logic reserve condition changed '..i)
   check(c.compare_type==(i==2 and 'or' or 'and'),'logic reserve join changed '..i)
  end
  check(#lp.outputs==1 and lp.outputs[1].signal.name==pc.enableSignal and not lp.outputs[1].copy_count_from_input and (lp.outputs[1].constant or 1)==1,'logic output changed')
  t.pacing={clock=clock,logic=logic,machines=machines,steps=0,wraps=0,bad=0,samples=0,window=0,free=0,mismatch1=0,mismatch2=0,foreign=0,measure={samples=0,window=0,free=0,enabled=0}}
 end
 -- Chests carry no circuit network at all (caps are chest bars).
 for _,p in ipairs(b.outputs)do local e=t.entities[p.entity];check(e.get_circuit_network(defines.wire_connector_id.circuit_red)==nil and e.get_circuit_network(defines.wire_connector_id.circuit_green)==nil,'wired output chest '..p.entity)end
 t.stockNetworksIsolated=true
 for _,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' or e.type=='arithmetic-combinator' or e.type=='decider-combinator' then
  check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y)
 end end
 t.importFluids={}
 for _,p in ipairs(b.fluids or {})do t.importFluids[#t.importFluids+1]={item=p.item,consumers=fluid_consumers(t,p)} end
end
local function count_phase(store,tick,n)
 local ph=phase(tick);store[ph]=(store[ph]or 0)+n
 if tick>BLOCK_END-STOPWIN and tick<=BLOCK_END then store.blockedStopWindow=(store.blockedStopWindow or 0)+n end
 if tick>BLOCK_END-3600 and tick<=BLOCK_END then store.blockedLastMinute=(store.blockedLastMinute or 0)+n end
end
script.on_event(defines.events.on_tick,function()
 local tick=game.tick
 if tick%3600==0 then helpers.write_file('progress.json',helpers.table_to_json{tick=tick,target=FINAL},false) end
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index]
  if tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0;t.force.bulk_inserter_capacity_bonus=1;check(t.force.inserter_stack_size_bonus==0 and t.force.bulk_inserter_capacity_bonus==1,'incorrect inserter unlock baseline') end
  for id,e in pairs(t.bulkEntities)do if e.held_stack.valid_for_read then t.bulkMaxHand[id]=math.max(t.bulkMaxHand[id]or 0,e.held_stack.count) end end
  -- The only writes: fluid into declared fluid entrances, items onto the lanes of declared entrance belts.
  for i,p in ipairs(b.fluids or {})do
   local rate=(payload.saturate and 6000 or p.perMinute)/3600
   local want=rate+(t.carry[i]or 0)
   local n=want>0 and t.entities[p.entity].insert_fluid{name=p.item,amount=want} or 0
   t.carry[i]=math.min(want-n,rate*60)
   t.fed['fluid'..i]=t.fed['fluid'..i]or {};count_phase(t.fed['fluid'..i],tick,n)
  end
  for i,p in ipairs(b.inputs)do
   local rate=(payload.saturate and 1800 or p.perMinute)/3600
   t.credit[i]=math.min((t.credit[i]or 0)+rate,8)
   local belt=t.entities[p.entity]
   local tries=0
   while t.credit[i]>=1 and tries<2 do
    local lane=(t.lane[i]or 0)%2+1;t.lane[i]=lane;tries=tries+1
    if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
     t.credit[i]=t.credit[i]-1;tries=0
     t.fed[i]=t.fed[i]or {};count_phase(t.fed[i],tick,1)
    end
   end
  end
  if t.pacing then
   local pc,q,cid=b.pacing,t.pacing,defines.wire_connector_id
   local T={type='virtual',name=pc.clockSignal}
   -- Clock: two full periods read tick by tick right after the import checks.
   if tick>60 and tick<=62+2*pc.periodTicks then
    local v=q.clock.get_signal(T,cid.combinator_output_green) or 0
    if q.last~=nil then
     if v==q.last+1 and v<=pc.periodTicks-1 then q.steps=q.steps+1
     elseif v==0 and q.last==pc.periodTicks-1 then q.wraps=q.wraps+1;if q.wrapTick then q.measuredPeriod=tick-q.wrapTick end;q.wrapTick=tick
     else q.bad=q.bad+1 end
    end
    q.last=v
   end
   -- Logic: inputs read on the second, the output one and two ticks later.
   if tick>120 then
    local m=tick%60
    if m==0 then
     local v=q.clock.get_signal(T,cid.combinator_output_green) or 0
     local free=true;for name,reserve in pairs(pc.reserves)do if (q.logic.get_signal({type='item',name=name},cid.combinator_input_red) or 0)<reserve then free=false end end
     q.expectWindow=v<pc.windowTicks;q.expectFree=free;q.expect=(q.expectWindow or free)
     q.samples=q.samples+1;if q.expectWindow then q.window=q.window+1 end;if free then q.free=q.free+1 end
     if phase(tick)=='measure' then local s=q.measure;s.samples=s.samples+1;if q.expectWindow then s.window=s.window+1 end;if free then s.free=s.free+1 end;if q.machines[1].status~=defines.entity_status.disabled_by_control_behavior then s.enabled=s.enabled+1 end end
     local signals=q.logic.get_signals(cid.combinator_output_green)or {}
     for _,sg in ipairs(signals)do if sg.signal.name~=pc.enableSignal or sg.count~=1 then q.foreign=q.foreign+1 end end
    elseif (m==1 or m==2) and q.expect~=nil then
     local on=(q.logic.get_signal({type='virtual',name=pc.enableSignal},cid.combinator_output_green) or 0)>0
     if on~=q.expect then if m==1 then q.mismatch1=q.mismatch1+1 else q.mismatch2=q.mismatch2+1 end end
    end
   end
  end
  if tick%60==0 then
   if tick==60 then import_checks(t,b) end
   local ph=phase(tick)
   for outputIndex,p in ipairs(b.outputs)do
    local e=t.entities[p.entity]
    if ph=='blocked' then
     local n=e.get_item_count(p.item);t.chestMax[p.item]=math.max(t.chestMax[p.item]or 0,n)
     if tick>MEASURE_END+120 then check(n<=p.cap,'closed chest cap exceeded '..p.item) end
     if tick%(5*3600)==0 then t.chestSeries[p.item]=t.chestSeries[p.item]or {};local q=t.chestSeries[p.item];q[#q+1]={minute=(tick-MEASURE_END)/3600,count=n} end
    else
     local n=e.remove_item{name=p.item,count=1000000}
     if ph=='measure' then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
     if ph=='recovery' then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
    end
   end
   for _,loop in ipairs(b.loopControl or {})do
    local signals=t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red)or {}
    local count=0;for _,signal in ipairs(signals)do if signal.signal.type~='virtual' then count=count+signal.count;t.ringItemMax[signal.signal.name]=math.max(t.ringItemMax[signal.signal.name]or 0,signal.count) end end
    local sample=t.loopSamples[loop.name]or {maxStock=0,capacity=loop.capacity};sample.maxStock=math.max(sample.maxStock,count);sample.lastSignals=signals;t.loopSamples[loop.name]=sample
    check(count<loop.capacity*.9,'loop overfilled '..loop.name)
    if tick%(5*3600)==0 then local s={minute=tick/3600,total=count};for _,signal in ipairs(signals)do if signal.signal.type~='virtual' then s[signal.signal.name]=signal.count end end;t.ringSeries[#t.ringSeries+1]=s end
   end
   for id,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' then
    if crafting(e) then local active=e.get_recipe();if active then check(active.name==recipe(t,id),'wrong active recipe '..id..' '..active.name);t.actualRecipeChecks=t.actualRecipeChecks+1 end end
    if ph=='measure' then t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1
     if crafting(e) and e.status==defines.entity_status.item_ingredient_shortage then
      local inv=e.get_inventory(defines.inventory.crafter_input);t.missing[id]=t.missing[id]or {}
      for _,i in pairs(t.ingredients[recipe(t,id)])do if i.type~='fluid' and inv.get_item_count(i.name)<i.amount then t.missing[id][i.name]=(t.missing[id][i.name]or 0)+1 end end
     end
    end
   end end
  end
  if tick==W then
   for id,e in pairs(t.entities)do if crafting(e)then t.machineBaseline[id]=e.products_finished end end
  end
  if tick==MEASURE_END then for id,e in pairs(t.entities)do if crafting(e)then t.machineMeasureEnd[id]=e.products_finished end end end
  if B>0 and tick==BLOCK_END-3600 then for id,e in pairs(t.entities)do if crafting(e)then t.machineBlockedLastMinute[id]=e.products_finished end end end
  if B>0 and tick==BLOCK_END then
   t.collectionPauseStock={};t.machinesAtBlockEnd={}
   for _,p in ipairs(b.outputs)do local n=t.entities[p.entity].get_item_count(p.item);t.collectionPauseStock[#t.collectionPauseStock+1]={item=p.item,entity=p.entity,count=n,capacity=p.cap,maxDuringBlocked=t.chestMax[p.item]or 0}end
   for id,e in pairs(t.entities)do if crafting(e)then t.machinesAtBlockEnd[#t.machinesAtBlockEnd+1]={entity=id,recipe=recipe(t,id),craftsInLastMinute=e.products_finished-(t.machineBlockedLastMinute[id]or 0),status=status(e),output=e.get_inventory(defines.inventory.crafter_output).get_contents(),input=e.get_inventory(defines.inventory.crafter_input).get_contents()}end end
   t.ringAtBlockEnd=t.entities[b.loopControl[1].reader].get_signals(defines.wire_connector_id.circuit_red)
  end
 end
 if tick==MEASURE_END then
  local report={builds={},feedPolicy='Throttled: each declared belt entrance gets perMinute/3600 items of credit per tick (capped at 8) inserted one at a time on alternating lanes; each declared fluid entrance gets perMinute/3600 per tick plus the refused carry (capped at one second). Electricity through one energy interface on the power port network. Declared items collected from the declared east chests once per second, except while blocked.',researchPolicy='All recipes enabled; fast inserter stack bonus zero; bulk unlock-equivalent capacity bonus +1 only'}
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local r={id=t.id,outputsPerMinute={},inputs={},fluids={},outputPorts={},machines={},powered=t.powered,importedEntities=#b.entities,exactRecipeChecks=t.actualRecipeChecks,externalApproachesClear=true,stockNetworksIsolated=t.stockNetworksIsolated}
   check(t.force.inserter_stack_size_bonus==0 and t.force.bulk_inserter_capacity_bonus==1,'inserter capacity baseline drifted')
   r.inserterCapacityResearch={fast=t.force.inserter_stack_size_bonus,bulkUnlockBonus=t.force.bulk_inserter_capacity_bonus}
   for item,_ in pairs(b.targets)do r.outputsPerMinute[item]=(t.output[item]or 0)/(M/3600)end
   for i,p in ipairs(b.inputs)do
    local chest=nil;for _,o in ipairs(b.outputs)do if o.item==p.item then chest=o.entity end end
    local fed=t.fed[i]or {}
    r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,perMinute=p.perMinute,acceptedDuringMeasurement=fed.measure or 0,measuredPerMinute=(fed.measure or 0)/(M/3600),productiveRoute=input_route(t,p,chest),passThrough=chest~=nil}
   end
   for i,p in ipairs(b.fluids or {})do
    local fed=t.fed['fluid'..i]or {}
    r.fluids[#r.fluids+1]={item=p.item,entity=p.entity,perMinute=p.perMinute,acceptedDuringMeasurement=fed.measure or 0,measuredPerMinute=(fed.measure or 0)/(M/3600),sourceFluidSegment=t.entities[p.entity].get_fluid_segment_id(1),productiveConsumers=fluid_consumers(t,p)}
   end
   for i,p in ipairs(b.outputs)do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.entities)do if crafting(e)then
    r.machines[#r.machines+1]={entity=id,recipe=recipe(t,id),actualRecipe=e.get_recipe().name,nativeCraftingSpeed=e.crafting_speed,nativeRecipeEnergy=e.get_recipe().energy,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],missing=t.missing[id],inventory=e.get_inventory(defines.inventory.crafter_input).get_contents(),output=e.get_inventory(defines.inventory.crafter_output).get_contents()}
   end end
   r.arms={}
   for id,e in pairs(t.entities)do if e.type=='inserter' then r.arms[#r.arms+1]={entity=id,statusSamples=t.samples[id]} end end
   report.builds[#report.builds+1]=r
  end
  storage.report=report
  helpers.write_file('result.json',helpers.table_to_json(report),false)
 end
 if tick==FINAL and storage.report then
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local r=storage.report.builds[index]
   r.recovery={settleMinutes=S/3600,measurementMinutes=R/3600,outputsPerMinute={}}
   for item,_ in pairs(b.targets)do r.recovery.outputsPerMinute[item]=(t.recoveryOutput[item]or 0)/(math.max(R,1)/3600)end
   r.blocked={minutes=B/3600,collectionPauseStock=t.collectionPauseStock,machinesAtBlockEnd=t.machinesAtBlockEnd,chestSeries=t.chestSeries,ringAtBlockEnd=t.ringAtBlockEnd,stopWindowMinutes=STOPWIN/3600,entranceAcceptance={}}
   local stopped=true
   for _,m in ipairs(t.machinesAtBlockEnd or {})do if m.craftsInLastMinute>0 then stopped=false end end
   r.blocked.machinesStoppedInLastMinute=(t.machinesAtBlockEnd~=nil) and stopped
   for i,p in ipairs(b.inputs)do local fed=t.fed[i]or {};r.blocked.entranceAcceptance[#r.blocked.entranceAcceptance+1]={item=p.item,blocked=fed.blocked or 0,inStopWindow=fed.blockedStopWindow or 0,inLastMinute=fed.blockedLastMinute or 0} end
   for i,p in ipairs(b.fluids or {})do local fed=t.fed['fluid'..i]or {};r.blocked.entranceAcceptance[#r.blocked.entranceAcceptance+1]={item=p.item,blocked=fed.blocked or 0,inStopWindow=fed.blockedStopWindow or 0,inLastMinute=fed.blockedLastMinute or 0} end
   for i,inp in ipairs(r.inputs)do local fed=t.fed[i]or {};inp.acceptedDuringRecovery=fed.recovery or 0;inp.acceptedTotal=(fed.warmup or 0)+(fed.measure or 0)+(fed.blocked or 0)+(fed.settle or 0)+(fed.recovery or 0) end
   for i,f in ipairs(r.fluids)do local fed=t.fed['fluid'..i]or {};f.acceptedDuringRecovery=fed.recovery or 0 end
   r.loopSamples=t.loopSamples;r.ringItemMax=t.ringItemMax;r.ringSeries=t.ringSeries
   if t.pacing then local q=t.pacing
    r.pacing={clockPeriodTicks=q.measuredPeriod,clockSteps=q.steps,clockWraps=q.wraps,clockBadSteps=q.bad,logicSamples=q.samples,logicWindowSamples=q.window,logicFreeSamples=q.free,
     logicMismatchOneTickLater=q.mismatch1,logicMismatchTwoTicksLater=q.mismatch2,foreignSignalsOnEnableNetwork=q.foreign,measurement=q.measure,wiringVerified=true}
   end
   r.bulkInserters={}
   for id,_ in pairs(t.bulkEntities)do r.bulkInserters[#r.bulkInserters+1]={entity=id,observedMaxHand=t.bulkMaxHand[id]or 0} end
   r.complete=true
  end
  helpers.write_file('result.json',helpers.table_to_json(storage.report),false)
 end
end)
