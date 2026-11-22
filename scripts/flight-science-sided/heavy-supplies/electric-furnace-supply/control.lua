-- Private native qualification for the heavy-ingredient supply factories (adapted from
-- tests/flight-science-sided-control.lua). Each run builds one blueprint on its own surface and force.
-- Feed: every declared inlet belt gets exactly perMinute * feedScale items per minute, alternating lanes,
-- inserted only at the back of that belt; items the belt cannot take wait in a queue (backlog) and are
-- offered again on the next tick. Collection: every output chest is emptied every second, except while
-- collection is blocked. Phases: warm-up, measurement, blocked collection, settling, recovery measurement.
local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('HEAVY_SUPPLY: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function stats(t,name) return t.force.get_item_production_statistics(t.surface).get_output_count(name) end
local W=payload.warmup;local M=W+payload.measure;local B=M+payload.blocked;local S=B+payload.settle;local R=S+payload.recovery
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
  local t={id=b.id,surface=s,force=force,entities={},credit={},lane={},fed={},measuredFed={},recoveryFed={},maxBacklog={},backlogAtMeasureEnd={},output={},recoveryOutput={},foreign={},baseline={},machineBaseline={},samples={},powered=false}
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
  check(pole.name=='big-electric-pole','power port is not the big electric pole')
  local reach=pole.prototype.get_supply_area_distance(pole.quality)
  for x=-math.ceil(reach),math.ceil(reach)do for y=-math.ceil(reach),math.ceil(reach)do
   if not t.fixture then local p={x=pole.position.x+x,y=pole.position.y+y}
    if s.can_place_entity{name='electric-energy-interface',position=p,force=force}then
     local e=s.create_entity{name='electric-energy-interface',position=p,force=force}
     if e.electric_network_id==pole.electric_network_id then e.electric_buffer_size=10000000000;e.power_production=10000000000;e.power_usage=0;t.fixture=e else e.destroy()end
    end
   end
  end end
  if not t.fixture then
   -- The power port is inside the body: connect it by copper wire to an external big pole west of the
   -- footprint (what a player does), with the energy source next to that pole.
   local x=b.footprint.left+dx-3;local y=pole.position.y
   local outside=s.create_entity{name='big-electric-pole',position={x,y},force=force};check(outside~=nil,'no external pole')
   if outside.electric_network_id~=pole.electric_network_id then outside.get_wire_connector(defines.wire_connector_id.pole_copper,true).connect_to(pole.get_wire_connector(defines.wire_connector_id.pole_copper,true),false)end
   check(outside.electric_network_id==pole.electric_network_id,'external wire failed')
   local e=s.create_entity{name='electric-energy-interface',position={x-2,y},force=force}
   check(e~=nil and e.electric_network_id==pole.electric_network_id,'external power fixture not on the port network')
   e.electric_buffer_size=10000000000;e.power_production=10000000000;e.power_usage=0;t.fixture=e;t.externalWire=true
  end
  check(t.fixture~=nil,'no power fixture')
 end
end)
script.on_event(defines.events.on_tick,function()
 local tick=game.tick
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index]
  if tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0 end
  -- Metered feed, declared inlet belts only.
  for i,p in ipairs(b.inputs)do
   t.credit[i]=(t.credit[i]or 0)+p.perMinute*b.feedScale/3600
   local belt=t.entities[p.entity]
   for _=1,2 do
    if t.credit[i]<1 then break end
    local lane=t.lane[i]or 1;local ok=belt.get_transport_line(lane).insert_at_back{name=p.item,count=1}
    if not ok then lane=3-lane;ok=belt.get_transport_line(lane).insert_at_back{name=p.item,count=1}end
    if not ok then break end
    t.credit[i]=t.credit[i]-1;t.lane[i]=3-lane;t.fed[i]=(t.fed[i]or 0)+1
    if tick>W and tick<=M then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
    if tick>S and tick<=R then t.recoveryFed[i]=(t.recoveryFed[i]or 0)+1 end
   end
   if tick>W and tick<=M then t.maxBacklog[i]=math.max(t.maxBacklog[i]or 0,math.floor(t.credit[i]))end
   if tick==M then t.backlogAtMeasureEnd[i]=math.floor(t.credit[i])end
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
    -- Anything other than the product in the outlet chest is recorded (and left there).
    for _,stack in pairs(e.get_inventory(defines.inventory.chest).get_contents())do
     if stack.name~=p.item then t.foreign[stack.name]=math.max(t.foreign[stack.name]or 0,stack.count)end
    end
    local blocked=tick>M and tick<=B
    local n=blocked and 0 or e.remove_item{name=p.item,count=1000000}
    if tick>W and tick<=M then t.output[p.item]=(t.output[p.item]or 0)+n end
    if tick>S and tick<=R then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
   end
   if tick>W and tick<=M then for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1
   end end end
  end
  if tick==W then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=stats(t,p.item)end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then t.machineBaseline[id]=e.products_finished end end
  end
  if tick==M then
   local r={id=t.id,label=b.label,feedScale=b.feedScale,outputsPerMinute={},consumptionPerMinute={},inputs={},machines={},powered=t.powered,externalPowerWire=t.externalWire==true,importedEntities=#b.entities}
   for _,p in ipairs(b.products)do r.outputsPerMinute[p]=(t.output[p]or 0)/(payload.measure/3600)end
   for i,p in ipairs(b.inputs)do
    r.consumptionPerMinute[p.item]=(stats(t,p.item)-(t.baseline[p.item]or 0))/(payload.measure/3600)
    r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,panelPerMinute=p.perMinute,offeredPerMinute=p.perMinute*b.feedScale,acceptedDuringMeasurement=t.measuredFed[i]or 0,drawPerMinute=(t.measuredFed[i]or 0)/(payload.measure/3600),maxBacklog=t.maxBacklog[i]or 0,backlogAtMeasurementEnd=t.backlogAtMeasureEnd[i]or 0,productiveRoute=input_route(t,p)}
   end
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    r.machines[#r.machines+1]={entity=id,recipe=e.get_recipe().name,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),status=status(e),statusSamples=t.samples[id]}
   end end
   t.report=r
  end
  if tick==R then
   local r=t.report
   r.recovery={blockedMinutes=payload.blocked/3600,settlingMinutes=payload.settle/3600,measurementMinutes=payload.recovery/3600,outputsPerMinute={},inputs={}}
   for _,item in ipairs(b.products)do r.recovery.outputsPerMinute[item]=(t.recoveryOutput[item]or 0)/(payload.recovery/3600)end
   for i,p in ipairs(b.inputs)do r.recovery.inputs[#r.recovery.inputs+1]={item=p.item,drawPerMinute=(t.recoveryFed[i]or 0)/(payload.recovery/3600),backlogAtEnd=math.floor(t.credit[i])}end
   r.foreignAtOutlet=t.foreign
  end
 end
 if tick==R then
  local report={builds={},feedPolicy='Each declared inlet belt fed exactly its panel figure times feedScale per minute at the back of the belt, alternating lanes, unaccepted items queued; no internal injection; output chests emptied every second except while blocked',researchPolicy='All recipes enabled, no technologies researched, inserter stack bonus zero'}
  for _,t in ipairs(storage.tests)do report.builds[#report.builds+1]=t.report end
  helpers.write_file('result.json',helpers.table_to_json(report),false)
 end
end)
