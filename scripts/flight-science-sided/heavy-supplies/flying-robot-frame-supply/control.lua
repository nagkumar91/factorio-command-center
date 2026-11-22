-- Native qualification harness for the flying-robot-frame supply (family supply protocol, metered feed).
-- Each build is imported on its own surface and force. Every belt inlet receives exactly its panel figure times
-- the build's feed scale (items not accepted at once stay queued); every pipe inlet receives its panel figure of
-- fluid per minute the same way. Output chests are emptied every second except while collection is blocked.
local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('FRAME_SUPPLY: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
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
   if e.use_filters then local listed=false;for i=1,e.filter_slot_count do local f=e.get_filter(i);if f and f.name==p.item then listed=true end end;allowed=listed end
   if allowed then link(e.pickup_target,e.drop_target)end
  end
 end
 local start=t.entities[p.entity].unit_number;local q={start};local previous={[start]=false};local head=1
 while head<=#q do local unit=q[head];head=head+1;local id=byUnit[unit];local e=t.entities[id]
  if (e.type=='assembling-machine') and e.products_finished>(t.machineBaseline[id]or 0)then
   for _,i in pairs(e.get_recipe().ingredients)do if i.name==p.item then
    local route={};while unit do table.insert(route,1,byUnit[unit]);unit=previous[unit]end;return route
   end end
  end
  for _,nextUnit in ipairs(edges[unit]or {})do if previous[nextUnit]==nil then previous[nextUnit]=unit;q[#q+1]=nextUnit end end
 end
 return nil
end
local endMeasure=payload.warmup+payload.measure
local function phase(tick)
 if tick<=payload.warmup then return 'warmup' end
 if tick<=endMeasure then return 'measure' end
 if tick<=endMeasure+payload.recovery.pauseTicks then return 'blocked' end
 if tick<=endMeasure+payload.recovery.pauseTicks+payload.recovery.settleTicks then return 'settle' end
 return 'recovery'
end
script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={}
 for index,b in ipairs(payload.builds) do
  local force=game.create_force('frame-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0
  local sw=2^math.ceil(math.log(b.footprint.width+32)/math.log(2));local sh=2^math.ceil(math.log(b.footprint.height+32)/math.log(2))
  local s=game.create_surface('frame-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64));s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,entities={},credit={},fed={},measuredFed={},fluidFed={},measuredFluid={},maxBacklog={},output={},outletItems={},recoveryOutput={},blockedOutput={},machineBaseline={},samples={},loopSamples={},overfilled=false,lane={}}
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
   local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed '..saved.entity_number)
   check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
   if saved.recipe then check(e.get_recipe().name==saved.recipe,'recipe changed');check(e.products_finished==0,'nonempty machine')end
  end
  local pole=t.entities[b.power];t.pole=pole
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
  -- Belt inlets: only the declared inlet tile, both lanes, exactly rate*scale per minute (queued if refused).
  for i,p in ipairs(b.inputs)do
   t.credit[i]=(t.credit[i]or 0)+p.perMinute*b.feedScale/3600
   local belt=t.entities[p.entity]
   for _=1,2 do if t.credit[i]>=1 then
    t.lane[i]=((t.lane[i]or 0)%2)+1
    if belt.get_transport_line(t.lane[i]).insert_at_back{name=p.item,count=1} then
     t.credit[i]=t.credit[i]-1;t.fed[i]=(t.fed[i]or 0)+1;if ph=='measure' then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
    end
   end end
   if t.credit[i]>(t.maxBacklog[i]or 0) then t.maxBacklog[i]=t.credit[i] end
  end
  -- Pipe inlets: the fluid enters the declared inlet entity only.
  for i,p in ipairs(b.fluids)do
   local k='fluid'..i;t.credit[k]=(t.credit[k]or 0)+p.perMinute*b.feedScale/3600
   local inserted=t.credit[k]>0 and t.entities[p.entity].insert_fluid{name=p.item,amount=t.credit[k]} or 0
   t.credit[k]=t.credit[k]-inserted;t.fluidFed[i]=(t.fluidFed[i]or 0)+inserted;if ph=='measure' then t.measuredFluid[i]=(t.measuredFluid[i]or 0)+inserted end
   if t.credit[k]>(t.maxBacklog[k]or 0) then t.maxBacklog[k]=t.credit[k] end
  end
  if tick%60==0 then
   if tick==60 then
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
   for _,p in ipairs(b.outputs)do
    local chest=t.entities[p.entity]
    if ph=='blocked' then
     local n=0;for _,c in pairs(chest.get_inventory(defines.inventory.chest).get_contents())do n=n+c.count end;t.blockedOutput[#t.blockedOutput+1]=n
    else
     for _,c in pairs(chest.get_inventory(defines.inventory.chest).get_contents())do
      local n=chest.remove_item{name=c.name,count=c.count,quality=c.quality}
      t.outletItems[c.name]=(t.outletItems[c.name]or 0)+n
      if ph=='measure' then t.output[c.name]=(t.output[c.name]or 0)+n end
      if c.name==b.outputs[1].item then local minute=math.floor((tick-1)/3600)+1;t.perMinute=t.perMinute or {};t.perMinute[minute]=(t.perMinute[minute]or 0)+n end
      if ph=='recovery' then t.recoveryOutput[c.name]=(t.recoveryOutput[c.name]or 0)+n end
     end
    end
   end
   for _,loop in ipairs(b.loopControl or {})do
    local count=0;for _,signal in ipairs(t.entities[loop.reader].get_signals(defines.wire_connector_id.circuit_red)or {})do count=count+signal.count end
    local sample=t.loopSamples[loop.name]or {maxStock=0,capacity=loop.capacity};sample.maxStock=math.max(sample.maxStock,count);t.loopSamples[loop.name]=sample
    if count>=loop.capacity*.9 then t.overfilled=true end
   end
   if ph=='measure' then for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    t.samples[id]=t.samples[id]or {};local name=status(e);t.samples[id][name]=(t.samples[id][name]or 0)+1
   end end end
  end
  if tick==payload.warmup then
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then t.machineBaseline[id]=e.products_finished end end
  end
 end
 if tick==endMeasure then
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local r={}
   r.routes={};for i,p in ipairs(b.inputs)do r.routes[i]=input_route(t,p)end
   r.machines={}
   for id,e in pairs(t.entities)do if e.type=='assembling-machine'then
    r.machines[#r.machines+1]={entity=id,recipe=e.get_recipe().name,measuredCrafts=e.products_finished-(t.machineBaseline[id]or 0),statusSamples=t.samples[id]}
   end end
   t.measureReport=r
  end
 end
 if tick==endMeasure+payload.recovery.pauseTicks+payload.recovery.settleTicks+payload.recovery.measureTicks then
  local report={builds={}}
  for index,t in ipairs(storage.tests)do
   local b=payload.builds[index];local m=payload.measure/3600;local rm=payload.recovery.measureTicks/3600
   local r={id=b.id,variant=b.variant,feedScale=b.feedScale,outputsPerMinute={},recoveryPerMinute={},outletItems=t.outletItems,inputs={},fluids={},machines=t.measureReport.machines,powered=t.powered,importedEntities=#b.entities,loopSamples=t.loopSamples,overfilled=t.overfilled,blockedChestCounts=t.blockedOutput,collectedByMinute=t.perMinute}
   for name,n in pairs(t.output)do r.outputsPerMinute[name]=n/m end
   for name,n in pairs(t.recoveryOutput)do r.recoveryPerMinute[name]=n/rm end
   for i,p in ipairs(b.inputs)do r.inputs[#r.inputs+1]={item=p.item,entity=p.entity,panelPerMinute=p.perMinute,feedPerMinute=p.perMinute*b.feedScale,drawPerMinute=(t.measuredFed[i]or 0)/m,fedTotal=t.fed[i]or 0,maxBacklog=t.maxBacklog[i]or 0,finalBacklog=t.credit[i]or 0,productiveRoute=t.measureReport.routes[i]}end
   for i,p in ipairs(b.fluids)do local k='fluid'..i;r.fluids[#r.fluids+1]={fluid=p.item,entity=p.entity,panelPerMinute=p.perMinute,feedPerMinute=p.perMinute*b.feedScale,drawPerMinute=(t.measuredFluid[i]or 0)/m,fedTotal=t.fluidFed[i]or 0,maxBacklog=t.maxBacklog[k]or 0,finalBacklog=t.credit[k]or 0}end
   report.builds[#report.builds+1]=r
  end
  helpers.write_file('result.json',helpers.table_to_json(report),false)
 end
end)
