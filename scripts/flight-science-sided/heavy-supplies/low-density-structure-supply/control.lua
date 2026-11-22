-- Supply-factory qualification harness (low-density structure supply).
-- Derived from tests/flight-science-sided-control.lua (the family's supply protocol: warm-up, measured window,
-- blocked output, settling, recovery window). Differences: each inlet is fed a metered amount, exactly its panel
-- figure times the build's feed fraction, onto the two lanes of the declared inlet belt; items the belt cannot
-- take wait in a backlog of at most one second of feed (the rest is counted as refused, never injected later);
-- outlet chests are checked for foreign items; declared belt lanes are checked for foreign items.
local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('LDS_SUPPLY: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function stats(t,name) return t.force.get_item_production_statistics(t.surface).get_output_count(name) end
local endMeasure=payload.warmup+payload.measure
local function phase(tick)
 if tick<=payload.warmup then return 'warmup' end
 if tick<=endMeasure then return 'measure' end
 if not payload.recovery then return 'after' end
 local r=payload.recovery
 if tick<=endMeasure+r.pauseTicks then return 'blocked' end
 if tick<=endMeasure+r.pauseTicks+r.settleTicks then return 'settle' end
 return 'recovery'
end
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
  local force=game.create_force('supply-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0
  local sw=2^math.ceil(math.log(b.footprint.width+32)/math.log(2));local sh=2^math.ceil(math.log(b.footprint.height+32)/math.log(2))
  local s=game.create_surface('supply-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64));s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,entities={},budget={},backlogMax={},offered={},accepted={},refused={},measuredAccepted={},recoveryAccepted={},output={},recoveryOutput={},portOutputs={},foreign={},laneForeign={},baseline={},machineBaseline={},recoveryBaseline={},powered=false,samples={},blockedSamples={}}
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
  for _,e in pairs(t.entities)do if e.type=='underground-belt' then check(e.underground_belt_neighbour~=nil,'unpaired underground belt '..e.unit_number) end end
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
 local tick=game.tick;local ph=phase(tick)
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index]
  if tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0 end
  -- Metered feed: panel figure x feed fraction per minute, onto the two lanes of the declared inlet belt only.
  for i,p in ipairs(b.inputs)do
   local rate=p.perMinute*b.feedFraction/3600
   local cap=math.max(2,p.perMinute*b.feedFraction/60)
   t.budget[i]=(t.budget[i]or 0)+rate;t.offered[i]=(t.offered[i]or 0)+rate
   if t.budget[i]>cap then t.refused[i]=(t.refused[i]or 0)+(t.budget[i]-cap);t.budget[i]=cap end
   t.backlogMax[i]=math.max(t.backlogMax[i]or 0,t.budget[i])
   local belt=t.entities[p.entity]
   while t.budget[i]>=1 do
    local lane=1+((t.accepted[i]or 0)%2)
    local ok=belt.get_transport_line(lane).insert_at_back{name=p.item,count=1}
    if not ok then lane=3-lane;ok=belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} end
    if not ok then break end
    t.budget[i]=t.budget[i]-1;t.accepted[i]=(t.accepted[i]or 0)+1
    if ph=='measure' then t.measuredAccepted[i]=(t.measuredAccepted[i]or 0)+1 end
    if ph=='recovery' then t.recoveryAccepted[i]=(t.recoveryAccepted[i]or 0)+1 end
   end
  end
  if tick%60==0 then
   if tick==60 then
    check(t.pole.electric_network_id~=nil,'power network missing');t.powered=true
    for _,e in pairs(t.entities)do if e.type=='assembling-machine' or e.type=='inserter' then
     check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y)
    end end
   end
   for outputIndex,p in ipairs(b.outputs)do
    local e=t.entities[p.entity]
    for _,c in pairs(e.get_inventory(defines.inventory.chest).get_contents())do if c.name~=p.item then t.foreign[c.name]=(t.foreign[c.name]or 0)+c.count end end
    local n=ph=='blocked' and 0 or e.remove_item{name=p.item,count=1000000}
    if ph=='recovery' then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
    if ph=='measure' then t.output[p.item]=(t.output[p.item]or 0)+n;t.portOutputs[outputIndex]=(t.portOutputs[outputIndex]or 0)+n end
   end
   for _,lane in ipairs(b.laneChecks or {})do
    for _,id in ipairs(lane.entities)do
     for _,c in pairs(t.entities[id].get_transport_line(lane.line).get_contents())do
      local ok=false;for _,a in ipairs(lane.allowed)do if a==c.name then ok=true end end
      if not ok then local k=lane.name..': '..c.name;t.laneForeign[k]=(t.laneForeign[k]or 0)+1 end
     end
    end
   end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    local book=(ph=='blocked') and t.blockedSamples or t.samples
    if ph=='measure' or ph=='blocked' then book[id]=book[id]or {};local name=status(e);book[id][name]=(book[id][name]or 0)+1 end
   end end
  end
  if tick==payload.warmup then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t,p.item)end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then t.machineBaseline[id]=e.products_finished end end
  end
  if payload.recovery and tick==endMeasure+payload.recovery.pauseTicks+payload.recovery.settleTicks then
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then t.recoveryBaseline[id]=e.products_finished end end
  end
 end
 local function report()
  local out={builds={},feedPolicy='Each inlet receives exactly its panel figure times the feed fraction per minute, metered every tick onto the two lanes of the declared inlet belt; at most one second of feed waits for room, the rest is refused and counted. No internal injection. Every output chest is emptied once a second except while output is blocked.',researchPolicy='All recipes enabled, no technologies researched, inserter stack bonus zero'}
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local m=payload.measure/3600
   local r={id=t.id,variant=b.variant,feedFraction=b.feedFraction,outputsPerMinute={},consumptionPerMinute={},inputs={},outputPorts={},machines={},powered=t.powered,importedEntities=#b.entities,foreignItemsAtOutlet=t.foreign,foreignItemsOnLanes=t.laneForeign}
   for _,p in ipairs(b.products)do r.outputsPerMinute[p]=(t.output[p]or 0)/m end
   for i,p in ipairs(b.inputs)do
    r.consumptionPerMinute[p.item]=(stats(t,p.item)-(t.baseline[p.item]or 0))/m
    r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,panelPerMinute=p.perMinute,feedPerMinute=p.perMinute*b.feedFraction,acceptedDuringMeasurement=t.measuredAccepted[i]or 0,acceptedPerMinute=(t.measuredAccepted[i]or 0)/m,refusedTotal=t.refused[i]or 0,largestBacklog=t.backlogMax[i]or 0,productiveRoute=input_route(t,p)}
   end
   for i,p in ipairs(b.outputs)do r.outputPorts[#r.outputPorts+1]={item=p.item,entity=p.entity,collectedDuringMeasurement=t.portOutputs[i]or 0}end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    r.machines[#r.machines+1]={entity=id,recipe=e.get_recipe().name,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id],inventory=e.get_inventory(defines.inventory.crafter_input).get_contents()}
   end end
   table.sort(r.machines,function(a,c)return a.entity<c.entity end)
   out.builds[#out.builds+1]=r
  end
  return out
 end
 if tick==endMeasure then storage.report=report();helpers.write_file('result.json',helpers.table_to_json(storage.report),false) end
 if payload.recovery and tick==endMeasure+payload.recovery.pauseTicks+payload.recovery.settleTicks+payload.recovery.measureTicks then
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local rm=payload.recovery.measureTicks/3600
   local recovery={blockedMinutes=payload.recovery.pauseTicks/3600,settlingMinutes=payload.recovery.settleTicks/3600,measurementMinutes=rm,outputsPerMinute={},inputsPerMinute={},machinesCrafting=0,blockedStatusSamples=t.blockedSamples}
   for _,item in ipairs(b.products)do recovery.outputsPerMinute[item]=(t.recoveryOutput[item]or 0)/rm end
   for i,p in ipairs(b.inputs)do recovery.inputsPerMinute[p.item]=(t.recoveryAccepted[i]or 0)/rm end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine' and e.products_finished>(t.recoveryBaseline[id]or 0) then recovery.machinesCrafting=recovery.machinesCrafting+1 end end
   storage.report.builds[index].recovery=recovery
   storage.report.builds[index].foreignItemsAtOutlet=t.foreign
   storage.report.builds[index].foreignItemsOnLanes=t.laneForeign
  end
  helpers.write_file('result.json',helpers.table_to_json(storage.report),false)
 end
end)
