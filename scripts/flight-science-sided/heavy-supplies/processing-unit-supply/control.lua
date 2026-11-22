-- Native harness for processing-unit-supply (flight-science-sided heavy supplies). Built from the family's
-- tests/flight-science-sided-control.lua (import, geometry, power and productive-route checks; chests collected
-- every second; 15 + 30 minute protocol with a 5-minute collection pause, 2 minutes settling and a 3-minute
-- recovery window) with the metered feeding and fluid checks of scripts/processing-units/control.lua:
--  * each declared belt inlet gets perMinute * feedScale / 3600 items of credit per tick (capped at 8), spent one
--    item at a time on alternating lanes; the declared acid inlet gets perMinute * feedScale / 3600 per tick plus
--    what it refused before (carry capped at one second). feedScale is 1 for a qualification run;
--  * electricity through one energy interface on the power port's network; no inventory is seeded;
--  * the output chest is emptied of the product every second, except while collection is paused; once a second
--    the chest is read for any other item (wrongItemsAtOutlet);
--  * every machine whose recipe uses the declared fluid must share the acid inlet's fluid segment.
local payload=helpers.json_to_table(require('payload'))
local W=payload.warmup
local M=W+payload.measure
local B=M+payload.blocked
local S=B+payload.settle
local R=S+payload.recovery
local function check(ok,msg) if not ok then error('PROCESSING_UNIT_SUPPLY: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' end
local function is_belt(e) return e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' end
local function recipe(t,id) return t.spec[id].recipe end
local function stats(t) return t.force.get_item_production_statistics(t.surface) end
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
  if crafting(e) and e.products_finished>(t.machineBaseline[id]or 0)then
   for _,i in pairs(t.ingredients[recipe(t,id)])do if i.name==p.item then
    local route={};while unit do table.insert(route,1,byUnit[unit]);unit=previous[unit]end;return route
   end end
  end
  for _,nextUnit in ipairs(edges[unit]or {})do if previous[nextUnit]==nil then previous[nextUnit]=unit;q[#q+1]=nextUnit end end
 end
 return nil
end
local function fluid_consumers(t,p)
 local source=t.entities[p.entity];local consumers={}
 for id,e in pairs(t.entities)do if crafting(e) then
  local uses=false;for _,i in pairs(t.ingredients[recipe(t,id)])do if i.name==p.item then uses=true end end
  if uses then
   local connected=false
   for j=1,e.fluids_count do for _,c in pairs(e.get_fluid_box_pipe_connections(j)or {})do
    local pipe=c.target
    if pipe and pipe.has_fluid_segment(c.target_fluidbox_index or 1) and pipe.get_fluid_segment_id(c.target_fluidbox_index or 1)==source.get_fluid_segment_id(1) then connected=true end
   end end
   check(connected,'disconnected fluid consumer '..id..' '..p.item)
   consumers[#consumers+1]=id
  end
 end end
 return consumers
end
local function write() helpers.write_file('result.json',helpers.table_to_json(storage.report),false) end

script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={};storage.report={builds={},feedScale=payload.feedScale,feedPolicy='Metered: each declared belt inlet gets perMinute*feedScale/3600 items of credit per tick (capped at 8), inserted one at a time on alternating lanes; the declared acid inlet gets perMinute*feedScale/3600 per tick plus the refused carry (capped at one second). Electricity through one energy interface on the power port network; no inventory seeded; the product is collected only from the declared east chest every second, except while collection is paused',researchPolicy='All recipes enabled, no technologies researched, inserter stack bonus zero'}
 for index,b in ipairs(payload.builds) do
  local force=game.create_force('supply-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0
  local sw=math.ceil((b.footprint.width+24)/32)*32;local sh=math.ceil((b.footprint.height+24)/32)*32
  local s=game.create_surface('supply-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64)+1);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,entities={},measuredFed={},recoveryFed={},fed={},output={},recoveryOutput={},portOutputs={},baseline={},machineBaseline={},samples={},blockedSamples={},fluidFed={},fluidRecovery={},blockedMax={},feedCredit={},feedLane={},fluidCarry={},wrongAtOutlet={},powered=false,actualRecipeChecks=0}
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
  local first=b.entities[1];local actual=t.entities[first.entity_number];local dx=actual.position.x-first.position.x;local dy=actual.position.y-first.position.y
  t.offset={x=dx,y=dy}
  for _,saved in ipairs(b.entities)do
   local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed')
   check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
   if e.type=='inserter' then check(e.inserter_stack_size_override==(saved.override_stack_size or 0),'arm stack override changed '..saved.entity_number) end
   if saved.recipe then
    local r=e.get_recipe();check(r and r.name==saved.recipe,'recipe changed');check(e.products_finished==0,'nonempty machine')
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
  t.fluidConsumers={};for i,p in ipairs(b.fluids or {})do t.fluidConsumers[i]=fluid_consumers(t,p) end
  storage.report.builds[index]={id=b.id,importedEntities=#b.entities,externalApproachesClear=true}
 end
end)

script.on_event(defines.events.on_tick,function()
 local tick=game.tick
 if tick%3600==0 then helpers.write_file('progress.json',helpers.table_to_json{tick=tick,target=R},false) end
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index];local r=storage.report.builds[index]
  if tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0 end
  -- The only ingredient writes: the two lanes of each declared inlet belt and the declared acid inlet.
  for i,p in ipairs(b.fluids or {})do
   local rate=p.perMinute*payload.feedScale/3600
   local want=rate+(t.fluidCarry[i]or 0)
   local n=t.entities[p.entity].insert_fluid{name=p.item,amount=want}
   t.fluidCarry[i]=math.min(want-n,rate*60)
   if tick>W and tick<=M then t.fluidFed[i]=(t.fluidFed[i]or 0)+n end
   if tick>S and tick<=R then t.fluidRecovery[i]=(t.fluidRecovery[i]or 0)+n end
  end
  for i,p in ipairs(b.inputs)do
   local belt=t.entities[p.entity]
   t.feedCredit[i]=math.min((t.feedCredit[i]or 0)+p.perMinute*payload.feedScale/3600,8)
   local tries=0
   while t.feedCredit[i]>=1 and tries<2 do
    local lane=(t.feedLane[i]or 0)%2+1;t.feedLane[i]=lane;tries=tries+1
    if belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
     t.feedCredit[i]=t.feedCredit[i]-1;tries=0;t.fed[i]=(t.fed[i]or 0)+1
     if tick>W and tick<=M then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
     if tick>S and tick<=R then t.recoveryFed[i]=(t.recoveryFed[i]or 0)+1 end
    end
   end
  end
  local blocked=tick>M and tick<=B
  if tick%60==0 then
   -- Collection: the declared chest, every second, except while paused.
   for outputIndex,p in ipairs(b.outputs or {})do
    local e=t.entities[p.entity]
    for _,c in pairs(e.get_inventory(defines.inventory.chest).get_contents())do if c.name~=p.item then t.wrongAtOutlet[c.name]=math.max(t.wrongAtOutlet[c.name]or 0,c.count) end end
    local n=blocked and 0 or e.remove_item{name=p.item,count=1000000}
    if blocked then t.blockedMax[outputIndex]=math.max(t.blockedMax[outputIndex]or 0,e.get_item_count(p.item)) end
    if tick>W and tick<=M then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
    if tick>S and tick<=R then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
   end
   if tick==60 then
    check(t.pole.electric_network_id~=nil,'power network missing');t.powered=true
    for _,e in pairs(t.entities)do
     if e.type=='electric-pole' then check(e.electric_network_id==t.pole.electric_network_id,'second power network at '..e.position.x..','..e.position.y) end
     if crafting(e) or e.type=='inserter' then check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y) end
    end
   end
   for id,e in pairs(t.entities)do if crafting(e) or e.type=='inserter' then
    if crafting(e) then local active=e.get_recipe();if active then check(active.name==recipe(t,id),'wrong active recipe '..id);t.actualRecipeChecks=t.actualRecipeChecks+1 end end
    local bucket=nil
    if tick>W and tick<=M then bucket=t.samples elseif blocked then bucket=t.blockedSamples end
    if bucket then bucket[id]=bucket[id]or {};local name=status(e);bucket[id][name]=(bucket[id][name]or 0)+1 end
   end end
   -- A jam shows as an inlet belt that stops accepting: sample how full each inlet tile is.
   if tick>W then for i,p in ipairs(b.inputs)do local belt=t.entities[p.entity];local n=0;for line=1,2 do n=n+belt.get_transport_line(line).get_item_count() end;t.inletMax=t.inletMax or {};t.inletMax[i]=math.max(t.inletMax[i]or 0,n) end end
  end
  if tick==W then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t).get_output_count(p.item)end
   for _,p in ipairs(b.products)do t.baseline['made:'..p]=stats(t).get_input_count(p)end
   for id,e in pairs(t.entities)do if crafting(e)then t.machineBaseline[id]=e.products_finished end end
  end
  if tick==M then
   local minutes=payload.measure/3600
   r.powered=t.powered;r.exactRecipeChecks=t.actualRecipeChecks;r.outputsPerMinute={};r.madePerMinute={};r.consumptionPerMinute={};r.inputs={};r.outputPorts={};r.machines={};r.arms={}
   check(t.force.inserter_stack_size_bonus==0,'inserter capacity baseline drifted')
   for _,p in ipairs(b.products)do r.outputsPerMinute[p]=(t.output[p]or 0)/minutes;r.madePerMinute[p]=(stats(t).get_input_count(p)-(t.baseline['made:'..p]or 0))/minutes end
   for i,p in ipairs(b.inputs)do r.consumptionPerMinute[p.item]=(stats(t).get_output_count(p.item)-(t.baseline[p.item]or 0))/minutes;r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,perMinute=p.perMinute,acceptedDuringMeasurement=t.measuredFed[i]or 0,acceptedPerMinute=(t.measuredFed[i]or 0)/minutes,maxItemsOnInletTile=(t.inletMax or {})[i]or 0,productiveRoute=input_route(t,p)}end
   r.fluids={}
   for i,p in ipairs(b.fluids or {})do r.fluids[#r.fluids+1]={item=p.item,entity=p.entity,perMinute=p.perMinute,acceptedDuringMeasurement=t.fluidFed[i]or 0,acceptedPerMinute=(t.fluidFed[i]or 0)/minutes,sourceFluidSegment=t.entities[p.entity].get_fluid_segment_id(1),productiveConsumers=t.fluidConsumers[i]} end
   for i,p in ipairs(b.outputs or {})do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.entities)do if crafting(e)then
    r.machines[#r.machines+1]={entity=id,recipe=recipe(t,id),actualRecipe=e.get_recipe() and e.get_recipe().name or 'none',x=e.position.x-t.offset.x,y=e.position.y-t.offset.y,nativeCraftingSpeed=e.crafting_speed,nativeRecipeEnergy=e.get_recipe().energy,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],input=e.get_inventory(defines.inventory.crafter_input).get_contents(),output=e.get_inventory(defines.inventory.crafter_output).get_contents()}
   end end
   for id,e in pairs(t.entities)do if e.type=='inserter' then
    local contents={}
    local target=e.pickup_target
    if target and is_belt(target) then for line=1,2 do contents[line]=target.get_transport_line(line).get_contents() end end
    r.arms[#r.arms+1]={entity=id,name=e.name,x=e.position.x-t.offset.x,y=e.position.y-t.offset.y,status=status(e),samples=t.samples[id],pickupContents=contents}
   end end
   if payload.debugTopology then
    local ids={};for id,e in pairs(t.entities)do ids[e.unit_number]=id end
    r.transport={}
    for id,e in pairs(t.entities)do if is_belt(e) then
     local lines={};for i=1,e.get_max_transport_line_index()do lines[i]=e.get_transport_line(i).get_contents() end
     r.transport[#r.transport+1]={entity=id,x=e.position.x-t.offset.x,y=e.position.y-t.offset.y,lines=lines}
    end end
   end
   write()
  end
  if tick==B then
   local stocks={}
   for i,p in ipairs(b.outputs or {})do local e=t.entities[p.entity];stocks[#stocks+1]={item=p.item,entity=p.entity,count=e.get_item_count(p.item),maxDuringPause=t.blockedMax[i]or 0} end
   r.blocked={minutes=payload.blocked/3600,mode='collection-paused',collectionPauseStock=stocks,statusSamples=t.blockedSamples}
   write()
  end
  if tick==R then
   local minutes=payload.recovery/3600
   r.recovery={blockedMinutes=payload.blocked/3600,settlingMinutes=payload.settle/3600,measurementMinutes=minutes,outputsPerMinute={},inletsAcceptedPerMinute={}}
   for _,p in ipairs(b.products)do r.recovery.outputsPerMinute[p]=(t.recoveryOutput[p]or 0)/minutes end
   for i,p in ipairs(b.inputs)do r.recovery.inletsAcceptedPerMinute[p.item]=(t.recoveryFed[i]or 0)/minutes end
   for i,p in ipairs(b.fluids or {})do r.recovery.inletsAcceptedPerMinute[p.item]=(t.fluidRecovery[i]or 0)/minutes end
   r.wrongItemsAtOutlet=t.wrongAtOutlet
   r.finished=true
   write()
  end
 end
end)
