-- Essentials mall native harness (adapted from scripts/robot-logistics-workshop/control.lua
-- and the inserter-workshop replenish phase). Feeds only the declared west entrance
-- belts, collects only declared products from declared east chests, seeds nothing.
local payload=helpers.json_to_table(require('payload'))
local B=payload.build
local P=payload.phases
local W=P.warmup
local M=W+P.measure
local BL=M+P.blocked
local ST=BL+P.settle
local RC=ST+P.recovery

local function check(ok,msg) if not ok then error('ESSENTIALS_CHECK: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function write(t) helpers.write_file('result.json',helpers.table_to_json(storage.report),false) end
local RED=defines.wire_connector_id.circuit_red
local GREEN=defines.wire_connector_id.circuit_green

local function recipe_of(t,id) return t.spec[id].recipe end
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
   if allowed then
    link(e.pickup_target,e.drop_target)
    -- An arm that drops on a belt continues along that belt.
   end
  end
 end
 local start=t.entities[p.entity].unit_number;local q={start};local previous={[start]=false};local head=1
 while head<=#q do local unit=q[head];head=head+1;local id=byUnit[unit];local e=t.entities[id]
  if crafting(e) and e.products_finished>(t.machineBaseline[id]or 0)then
   for _,i in pairs(t.ingredients[recipe_of(t,id)])do if i.name==p.item then
    local route={};while unit do table.insert(route,1,byUnit[unit]);unit=previous[unit]end;return route
   end end
  end
  for _,nextUnit in ipairs(edges[unit]or {})do if previous[nextUnit]==nil then previous[nextUnit]=unit;q[#q+1]=nextUnit end end
 end
 return nil
end

local function ring_signals(t)
 local out={};local total=0
 for _,s in ipairs(t.reader.get_signals(RED)or {})do if s.signal.type~='virtual' then out[s.signal.name]=s.count;total=total+s.count end end
 return out,total
end

script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 local force=game.create_force('essentials');force.enable_all_recipes();force.inserter_stack_size_bonus=0;force.bulk_inserter_capacity_bonus=1
 check(force.inserter_stack_size_bonus==0 and force.bulk_inserter_capacity_bonus==1,'incorrect inserter unlock baseline')
 local sw=math.ceil((B.footprint.width+24)/32)*32;local sh=math.ceil((B.footprint.height+24)/32)*32
 local s=game.create_surface('essentials',{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
 s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64)+1);s.force_generate_chunk_requests()
 for _,e in pairs(s.find_entities())do e.destroy()end
 local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
 local t={surface=s,force=force,entities={},spec={},ingredients=B.recipeIngredients,machineBaseline={},bulkMaxHand={},fed={},steadyFed={},
  collected={},steadyOut={},recoveryOut={},samples={},ringMax=0,ringItemMax={},ringViolations=0,chestMax={},chestOverCap={},blockedRingMax=0,blockedChestMax={},
  fluids={},actualRecipeChecks=0}
 for _,saved in ipairs(B.entities)do t.spec[saved.entity_number]=saved end
 storage.t=t
 storage.report={id=B.id,blueprintSha256=B.blueprintSha256,protocol=P,feedPolicy='Declared west entrance belt lanes only, one item per lane every 4 ticks; declared products removed only from declared east chests once per second; no inventories seeded'}
 local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(B.code)==0,'import failed')
 local ghosts=inv[1].build_blueprint{surface=s,force=force,position={0,0},build_mode=defines.build_mode.forced}
 check(#ghosts==#B.entities,'entity count '..#ghosts..' expected '..#B.entities)
 for _,g in pairs(ghosts)do
  local id=g.tags.flight_science_entity;check(id~=nil,'missing identity')
  local _,e,proxy=g.revive{raise_revive=true};check(e~=nil and not proxy,'revive failed '..id);t.entities[id]=e
 end
 inv.destroy()
 t.bulk={};for id,e in pairs(t.entities)do if e.name=='bulk-inserter' then t.bulk[id]=e end end
 local first=B.entities[1];local actual=t.entities[first.entity_number];local dx=actual.position.x-first.position.x;local dy=actual.position.y-first.position.y
 for _,saved in ipairs(B.entities)do
  local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed '..saved.entity_number)
  check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
  if saved.recipe then
   local r=e.get_recipe();check(r and r.name==saved.recipe,'recipe changed '..saved.entity_number);check(e.products_finished==0,'nonempty machine')
   check(e.get_module_inventory().is_empty(),'installed modules')
   local expected={};for _,ingredient in ipairs(t.ingredients[saved.recipe])do expected[ingredient.name]=ingredient.amount end
   local count=0;for _,ingredient in pairs(r.ingredients)do check(expected[ingredient.name]==ingredient.amount,'native ingredient mismatch '..saved.recipe..' '..ingredient.name);count=count+1 end
   check(count==#t.ingredients[saved.recipe],'native ingredient count mismatch')
  end
 end
 for _,p in ipairs(B.ports)do if p.externalSide=='west' or p.externalSide=='east' then local d=p.externalSide=='west' and -1 or 1;local e=t.entities[p.entity];for k=1,3 do check(s.can_place_entity{name='fast-transport-belt',position={e.position.x+d*k,e.position.y},force=force},'blocked exterior approach '..p.entity..' offset '..k)end end end
 local port;for _,p in ipairs(B.ports)do if p.kind=='power' then port=p end end
 local pole=t.entities[port.entity];t.pole=pole
 local reach=pole.prototype.get_supply_area_distance(pole.quality)
 for x=-math.ceil(reach)-2,math.ceil(reach)+2 do for y=-math.ceil(reach)-2,math.ceil(reach)+2 do
  if not t.fixture then local q={x=pole.position.x+x,y=pole.position.y+y}
   if s.can_place_entity{name='electric-energy-interface',position=q,force=force}then
    local e=s.create_entity{name='electric-energy-interface',position=q,force=force}
    if e.electric_network_id==pole.electric_network_id then e.electric_buffer_size=10000000000;e.power_production=10000000000;e.power_usage=0;t.fixture=e else e.destroy()end
   end
  end
 end end
 check(t.fixture~=nil,'no power fixture')
 local loop=B.loopControl[1];t.loop=loop;t.reader=t.entities[loop.reader]
 t.outputs={};for i,p in ipairs(B.outputs)do t.outputs[i]={item=p.item,cap=p.cap,chest=t.entities[p.entity],entity=p.entity} end
 t.final={};for item,ids in pairs(B.finalMachines)do t.final[item]={};for _,id in ipairs(ids)do t.final[item][#t.final[item]+1]=t.entities[id] end end
end)

local function finished(list) local n=0;for _,e in ipairs(list)do n=n+e.products_finished end;return n end

local function wiring_checks(t)
 check(t.pole.electric_network_id~=nil,'power network missing')
 for id,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' or e.type=='arithmetic-combinator' or e.type=='decider-combinator' then
  check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y)
 end end
 local net=t.reader.get_circuit_network(RED);check(net,'ring reader disconnected')
 local ringId=net.network_id
 for _,id in ipairs(t.loop.loop)do local e=t.entities[id];local c=e.get_control_behavior();local n=e.get_circuit_network(RED)
  check(c and c.read_contents and c.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.hold and n and n.network_id==ringId,'ring tile is not a per-tile hold reader on the ring network '..id)
  check(e.get_circuit_network(GREEN)==nil,'ring tile on green '..id)
 end
 for _,id in ipairs(t.loop.controlled)do local n=t.entities[id].get_circuit_network(RED);check(n and n.network_id==ringId,'controlled arm not on ring '..id)end
 for _,arms in pairs(B.productionClock.phaseAssignment)do for _,a in ipairs(arms)do local n=t.entities[a.arm].get_circuit_network(RED);check(n and n.network_id==ringId,'clock arm not on ring '..a.arm)end end
 local timerOut=t.entities[B.productionClock.timer].get_circuit_network(defines.wire_connector_id.combinator_output_red)
 local divideIn=t.entities[B.productionClock.divide].get_circuit_network(defines.wire_connector_id.combinator_input_red)
 local phaseOut=t.entities[B.productionClock.phase].get_circuit_network(defines.wire_connector_id.combinator_output_red)
 check(timerOut and divideIn and timerOut.network_id==divideIn.network_id,'clock timer wiring')
 check(phaseOut and phaseOut.network_id==ringId,'clock phase not on ring')
 local sc=B.stockControl;local comb=t.entities[sc.combinator];local cn=comb.get_circuit_network(GREEN);check(cn,'cap combinator not on green')
 check(cn.network_id~=ringId,'cap network equals ring network')
 check(comb.get_circuit_network(RED)==nil,'cap combinator on red')
 for _,id in ipairs(sc.chests)do local e=t.entities[id];local n=e.get_circuit_network(GREEN);check(n and n.network_id==cn.network_id,'chest not on cap network '..id);check(e.get_circuit_network(RED)==nil,'chest on red '..id)end
 for _,id in ipairs(sc.arms)do local e=t.entities[id];local n=e.get_circuit_network(GREEN);check(n and n.network_id==cn.network_id,'chest arm not on cap network '..id);check(e.get_circuit_network(RED)==nil,'chest arm on red '..id)end
 for _,o in ipairs(t.outputs)do local sig=cn.get_signal({type='item',name=o.item,quality='normal'});check(sig==o.chest.get_item_count(o.item)-o.cap,'cap signal mismatch '..o.item..' '..tostring(sig))end
 for _,g in ipairs(sc.capGatedArms or {})do local e=t.entities[g.entity];local n=e.get_circuit_network(GREEN);check(n and n.network_id==cn.network_id and e.get_circuit_network(RED)==nil,'cap-gated arm wiring '..g.entity)end
 for _,id in ipairs(sc.greenRelays or {})do local e=t.entities[id];check(e.get_circuit_network(RED)==nil,'green relay on red '..id);local c=e.get_control_behavior();check(not c or not c.circuit_enable_disable,'green relay has a condition '..id)end
 if sc.chestReserve then
  local d=t.entities[sc.chestReserve.decider]
  local ir=d.get_circuit_network(defines.wire_connector_id.combinator_input_red);local ig=d.get_circuit_network(defines.wire_connector_id.combinator_input_green);local og=d.get_circuit_network(defines.wire_connector_id.combinator_output_green)
  check(ir and ir.network_id==ringId and ig and ig.network_id==cn.network_id and og and og.network_id==cn.network_id and d.get_circuit_network(defines.wire_connector_id.combinator_output_red)==nil,'reserve decider wiring')
 end
 if sc.feedGate then
  local d=t.entities[sc.feedGate.decider]
  local ir=d.get_circuit_network(defines.wire_connector_id.combinator_input_red);local ig=d.get_circuit_network(defines.wire_connector_id.combinator_input_green);local og=d.get_circuit_network(defines.wire_connector_id.combinator_output_green)
  check(ir and ir.network_id==ringId and ig and ig.network_id==cn.network_id and og and og.network_id==cn.network_id and d.get_circuit_network(defines.wire_connector_id.combinator_output_red)==nil,'feed decider wiring')
  local a=t.entities[sc.feedGate.arm];local n=a.get_circuit_network(GREEN);check(n and n.network_id==cn.network_id and a.get_circuit_network(RED)==nil,'feed arm wiring')
  local c=a.get_control_behavior();check(c and c.circuit_enable_disable and c.circuit_condition.first_signal.name==sc.feedGate.signal,'feed arm condition')
 end
 t.stockNetworksIsolated=true;t.ringNetwork=ringId;t.capNetwork=cn.network_id
end

local function cap_state(t) return storage.cap end

local function collect(t,tick)
 local blocked=tick>M and tick<=BL
 local cs=storage.cap
 for i,o in ipairs(t.outputs)do
  local paused=blocked or (cs and cs.active and cs.item==o.item and cs.state~='settle')
  local n=0
  if not paused then n=o.chest.remove_item{name=o.item,count=1000000} end
  t.collected[o.item]=(t.collected[o.item]or 0)+n
  if tick>W and tick<=M then t.steadyOut[o.item]=(t.steadyOut[o.item]or 0)+n end
  if tick>ST and tick<=RC then t.recoveryOut[o.item]=(t.recoveryOut[o.item]or 0)+n end
  if cs and cs.active and cs.state=='hold' and o.item~=cs.item then cs.others[o.item]=(cs.others[o.item]or 0)+n end
  local c=o.chest.get_item_count(o.item)
  t.chestMax[o.item]=math.max(t.chestMax[o.item]or 0,c)
  if c>o.cap then t.chestOverCap[o.item]=(t.chestOverCap[o.item]or 0)+1 end
  if blocked then t.blockedChestMax[o.item]=math.max(t.blockedChestMax[o.item]or 0,c) end
 end
end

local function machine_report(t,from)
 local list={}
 for id,e in pairs(t.entities)do if crafting(e)then
  local r=e.get_recipe()
  list[#list+1]={entity=id,recipe=recipe_of(t,id),actualRecipe=r and r.name or 'none',nativeCraftingSpeed=e.crafting_speed,nativeRecipeEnergy=r and r.energy,nativeIngredients=r and r.ingredients,
   measuredCrafts=e.products_finished-((from or t.machineBaseline)[id]or 0),status=status(e),statusSamples=t.samples[id],
   input=e.get_inventory(defines.inventory.crafter_input).get_contents(),output=e.get_inventory(defines.inventory.crafter_output).get_contents()}
 end end
 table.sort(list,function(a,b)return a.entity<b.entity end)
 return list
end

local function steady_report(t)
 local r=storage.report
 r.outputsPerMinute={};for _,p in ipairs(B.products)do r.outputsPerMinute[p]=(t.steadyOut[p]or 0)/(P.measure/3600)end
 r.inputs={};r.consumptionPerMinute={}
 for i,p in ipairs(B.inputs)do r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,acceptedDuringMeasurement=t.steadyFed[i]or 0,acceptedPerMinute=(t.steadyFed[i]or 0)/(P.measure/3600),productiveRoute=input_route(t,p)};r.consumptionPerMinute[p.item]=(stats(t,p.item)-(t.statBaseline[p.item]or 0))/(P.measure/3600) end
 r.fluids={}
 r.outputPorts={};for _,o in ipairs(t.outputs)do r.outputPorts[#r.outputPorts+1]={item=o.item,entity=o.entity,collectedDuringMeasurement=t.steadyOut[o.item]or 0}end
 r.machines=machine_report(t)
 r.arms={}
 for id,e in pairs(t.entities)do if e.type=='inserter' then r.arms[#r.arms+1]={entity=id,name=e.name,x=e.position.x,y=e.position.y,status=status(e),samples=t.samples[id],hand=e.held_stack.valid_for_read and {name=e.held_stack.name,count=e.held_stack.count} or nil}end end
 table.sort(r.arms,function(a,b)return a.entity<b.entity end)
 local sig,total=ring_signals(t)
 r.ring={name=t.loop.name,capacity=t.loop.capacity,maxStock=t.ringMax,itemMax=t.ringItemMax,lastSignals=sig,lastTotal=total,violations=t.ringViolations}
 r.powered=t.powered;r.importedEntities=#B.entities;r.exactRecipeChecks=t.actualRecipeChecks;r.externalApproachesClear=true;r.stockNetworksIsolated=t.stockNetworksIsolated
 r.inserterCapacityResearch={fast=t.force.inserter_stack_size_bonus,bulkUnlockBonus=t.force.bulk_inserter_capacity_bonus}
 r.bulkInserters={};for id,_ in pairs(t.bulk)do r.bulkInserters[#r.bulkInserters+1]={entity=id,observedMaxHand=t.bulkMaxHand[id]or 0}end
 table.sort(r.bulkInserters,function(a,b)return a.entity<b.entity end)
 if payload.debugTopology then
  local ids={};for id,e in pairs(t.entities)do ids[e.unit_number]=id end
  r.transport={}
  for id,e in pairs(t.entities)do if e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' then
   local lines={};for i=1,e.get_max_transport_line_index()do lines[i]=e.get_transport_line(i).get_contents() end
   r.transport[#r.transport+1]={entity=id,x=e.position.x,y=e.position.y,lines=lines}
  end end
 end
end

local function start_cap(t,index,tick)
 local item=payload.capProducts[index]
 local o;for _,q in ipairs(t.outputs)do if q.item==item then o=q end end
 storage.cap={active=true,index=index,item=item,output=o,state='fill',stateStart=tick,others={},holdSamples=0,holdMismatches=0,holdRingMax=0}
 local rec={product=item,cap=o.cap,fillLimitMinutes=payload.fillLimitTicks[item]/3600,refillLimitMinutes=payload.refillLimitTicks[item]/3600,ringLimit=B.ringLimitFor[item],startTick=tick,startStock=o.chest.get_item_count(item)}
 storage.report.capTests=storage.report.capTests or {}
 storage.report.capTests[index]=rec
 storage.cap.rec=rec
end

local function cap_step(t,tick)
 local cs=storage.cap;if not cs or not cs.active then return end
 local rec=cs.rec;local o=cs.output;local c=o.chest.get_item_count(o.item);local elapsed=tick-cs.stateStart
 if cs.state=='fill' then
  if c==o.cap then rec.filled=true;rec.fillMinutes=elapsed/3600;cs.state='hold';cs.stateStart=tick;cs.others={};cs.finalAtHold=finished(t.final[o.item]);
   if o.item=='fast-inserter' then cs.consumerAtHold=finished(t.final['bulk-inserter']) end
  elseif c>o.cap or elapsed>=payload.fillLimitTicks[o.item] then rec.filled=false;rec.fillMinutes=elapsed/3600;rec.fillEndStock=c;rec.machinesAtFillTimeout=machine_report(t,{});cs.state='settle';cs.stateStart=tick end
 elseif cs.state=='hold' then
  cs.holdSamples=cs.holdSamples+1;if c~=o.cap then cs.holdMismatches=cs.holdMismatches+1 end
  local sig=ring_signals(t);local n=sig[o.item]or 0;if n>cs.holdRingMax then cs.holdRingMax=n end
  if elapsed==payload.holdTicks/2 then cs.finalAtHalf=finished(t.final[o.item]);if o.item=='fast-inserter' then cs.consumerAtHalf=finished(t.final['bulk-inserter']) end end
  if elapsed>=payload.holdTicks then
   rec.holdSamples=cs.holdSamples;rec.holdMismatches=cs.holdMismatches;rec.holdRingMax=cs.holdRingMax;rec.holdEndStock=c
   rec.finalCraftsLastHalf=finished(t.final[o.item])-(cs.finalAtHalf or 0)
   if o.item=='fast-inserter' then rec.consumerCraftsLastHalf=finished(t.final['bulk-inserter'])-(cs.consumerAtHalf or 0) end
   rec.othersPerMinute={};for _,q in ipairs(t.outputs)do if q.item~=o.item then rec.othersPerMinute[q.item]=(cs.others[q.item]or 0)/(payload.holdTicks/3600) end end
   rec.holdRingSignals=ring_signals(t)
   local removed=o.chest.remove_item{name=o.item,count=math.floor(o.cap/2)}
   t.collected[o.item]=(t.collected[o.item]or 0)+removed
   rec.withdrawn=removed;cs.finalAtWithdraw=finished(t.final[o.item]);cs.state='refill';cs.stateStart=tick
  end
 elseif cs.state=='refill' then
  local crafts=finished(t.final[o.item])-cs.finalAtWithdraw
  if c==o.cap and crafts>0 then rec.refilled=true;rec.refillMinutes=elapsed/3600;rec.refillCrafts=crafts;cs.state='settle';cs.stateStart=tick
  elseif c>o.cap or elapsed>=payload.refillLimitTicks[o.item] then rec.refilled=false;rec.refillMinutes=elapsed/3600;rec.refillEndStock=c;rec.refillCrafts=crafts;cs.state='settle';cs.stateStart=tick end
 elseif cs.state=='settle' then
  if elapsed>=payload.resumeSettleTicks then
   rec.endTick=tick
   write(t)
   if cs.index<#payload.capProducts then start_cap(t,cs.index+1,tick) else cs.active=false;storage.doneTick=tick;storage.report.complete=true end
  end
 end
end

script.on_event(defines.events.on_tick,function()
 local t=storage.t;if not t then return end
 local tick=game.tick
 if tick==1 then t.force.inserter_stack_size_bonus=0;t.force.bulk_inserter_capacity_bonus=1 end
 for id,e in pairs(t.bulk)do if e.held_stack.valid_for_read then local n=e.held_stack.count;if n>(t.bulkMaxHand[id]or 0)then t.bulkMaxHand[id]=n end end end
 if tick%4==0 then for i,p in ipairs(B.inputs)do
  local belt=t.entities[p.entity]
  for lane=1,2 do if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
   t.fed[i]=(t.fed[i]or 0)+1
   if tick>W and tick<=M then t.steadyFed[i]=(t.steadyFed[i]or 0)+1 end
  end end
 end end
 if tick==60 then wiring_checks(t);t.powered=true end
 if tick==W then
  t.statBaseline={};for _,p in ipairs(B.inputs)do t.statBaseline[p.item]=stats(t,p.item)end
  for id,e in pairs(t.entities)do if crafting(e)then t.machineBaseline[id]=e.products_finished end end
 end
 if tick%60==0 then
  collect(t,tick)
  local sig,total=ring_signals(t)
  if total>t.ringMax then t.ringMax=total end
  for k,n in pairs(sig)do if n>(t.ringItemMax[k]or 0)then t.ringItemMax[k]=n end end
  if total>=t.loop.capacity*.9 then t.ringViolations=t.ringViolations+1 end
  if tick>M and tick<=BL and total>t.blockedRingMax then t.blockedRingMax=total end
  if tick>W and tick<=M then
   for id,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' then
    if crafting(e) then local a=e.get_recipe();if a then check(a.name==recipe_of(t,id),'wrong active recipe '..id);t.actualRecipeChecks=t.actualRecipeChecks+1 end end
    t.samples[id]=t.samples[id]or {};local n=status(e);t.samples[id][n]=(t.samples[id][n]or 0)+1
   end end
  end
  if tick>RC then cap_step(t,tick) end
 end
 if tick==M then
  steady_report(t);write(t)
 end
 if tick==BL then
  local r=storage.report;r.blocked={minutes=P.blocked/3600,chestMax=t.blockedChestMax,ringMax=t.blockedRingMax,endStock={}}
  for _,o in ipairs(t.outputs)do r.blocked.endStock[o.item]=o.chest.get_item_count(o.item) end
  write(t)
 end
 if tick==RC then
  local r=storage.report;r.recovery={blockedMinutes=P.blocked/3600,settlingMinutes=P.settle/3600,measurementMinutes=P.recovery/3600,outputsPerMinute={},machines=machine_report(t,{})}
  for _,p in ipairs(B.products)do r.recovery.outputsPerMinute[p]=P.recovery>0 and (t.recoveryOut[p]or 0)/(P.recovery/3600) or 0 end
  write(t)
  if #payload.capProducts>0 then start_cap(t,1,tick) else storage.doneTick=tick;storage.report.complete=true end
 end
 if storage.doneTick and tick==storage.doneTick then
  local r=storage.report
  r.ringOverall={maxStock=t.ringMax,itemMax=t.ringItemMax,violations=t.ringViolations,capacity=t.loop.capacity}
  r.chestMax=t.chestMax;r.chestOverCap=t.chestOverCap;r.collectedTotal=t.collected;r.endTick=tick
  r.bulkInserters={};for id,_ in pairs(t.bulk)do r.bulkInserters[#r.bulkInserters+1]={entity=id,observedMaxHand=t.bulkMaxHand[id]or 0}end
  table.sort(r.bulkInserters,function(a,b)return a.entity<b.entity end)
  write(t)
 end
 if storage.doneTick and tick==storage.doneTick+120 then error('ESSENTIALS_HARNESS_COMPLETE') end
end)
