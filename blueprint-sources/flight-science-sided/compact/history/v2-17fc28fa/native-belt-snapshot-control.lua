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
 if game.tick~=1 then return end
 local result={passed=true,builds={},snapshotPolicy='Native belt_neighbours inputs and outputs plus underground_belt_neighbour; all endpoints including unpaired recorded; actual read-entire-belt components protected'}
 for index,t in ipairs(storage.tests)do
  local b=payload.builds[index];local byUnit,records,nodes,nodeById,readerSet={},{},{},{},{}
  for id,e in pairs(t.entities)do byUnit[e.unit_number]=id end
  local expectedById={};for _,entry in ipairs(b.undergroundEndpointAudit or {})do expectedById[entry.entity]=entry end
  for _,block in ipairs(b.loopControl or {})do readerSet[block.reader]=true end
  for _,spec in ipairs(b.entities)do if spec.control_behavior and spec.control_behavior.circuit_contents_read_mode==2 then readerSet[spec.entity_number]=true end end
  local function ids(neighbours)
   local result={};for _,e in pairs(neighbours or {})do local id=byUnit[e.unit_number];check(id~=nil,'belt neighbour outside blueprint');result[#result+1]=id end;table.sort(result);return result
  end
  for id,e in pairs(t.entities)do if e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' then
   local neighbours=e.belt_neighbours
   local n={entity=id,name=e.name,direction=e.direction,inputs=ids(neighbours.inputs),outputs=ids(neighbours.outputs),undergroundNeighbour=false}
   if e.type=='underground-belt' then
    local neighbour=e.underground_belt_neighbour;local actual=neighbour and byUnit[neighbour.unit_number] or false
    check(not neighbour or actual,'underground neighbour outside blueprint');n.undergroundNeighbour=actual;n.role=e.belt_to_ground_type
    if b.undergroundEndpointAudit then local expected=expectedById[id];check(expected~=nil,'unexpected underground endpoint '..id);check(expected.neighbour==actual,'changed underground neighbour '..id);check(expected.role==e.belt_to_ground_type,'changed underground role '..id);expectedById[id]=nil end
    records[#records+1]={entity=id,role=e.belt_to_ground_type,neighbour=actual,matched=b.undergroundEndpointAudit~=nil}
   end
   local behavior=e.get_control_behavior()
   if behavior and behavior.read_contents and behavior.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold then readerSet[id]=true end
   if readerSet[id] then check(behavior and behavior.read_contents and behavior.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold,'declared reader is not native read-entire-belt '..id)end
   nodes[#nodes+1]=n;nodeById[id]=n
  end end
  if b.undergroundEndpointAudit then check(next(expectedById)==nil,'missing expected underground endpoint')end
  table.sort(records,function(a,z)return a.entity<z.entity end);table.sort(nodes,function(a,z)return a.entity<z.entity end)
  local components,componentById={},{}
  for _,seed in ipairs(nodes)do if not componentById[seed.entity]then
   local component,queue={index=#components+1,entities={},readers={}},{seed.entity};componentById[seed.entity]=component.index;local head=1
   while head<=#queue do
    local id=queue[head];head=head+1;component.entities[#component.entities+1]=id;if readerSet[id]then component.readers[#component.readers+1]=id end
    local n=nodeById[id];local function visit(nextId)if nextId and not componentById[nextId]then check(nodeById[nextId]~=nil,'missing connected belt node');componentById[nextId]=component.index;queue[#queue+1]=nextId end end
    for _,nextId in ipairs(n.inputs)do visit(nextId)end;for _,nextId in ipairs(n.outputs)do visit(nextId)end;visit(n.undergroundNeighbour)
   end
   table.sort(component.entities);table.sort(component.readers);components[#components+1]=component
  end end
  local protected,readerComponents,readers={},{},{}
  for _,c in ipairs(components)do if #c.readers>0 then readerComponents[#readerComponents+1]=c;for _,id in ipairs(c.entities)do protected[#protected+1]=id end;for _,id in ipairs(c.readers)do readers[#readers+1]=id end end end
  table.sort(protected);table.sort(readers)
  result.builds[#result.builds+1]={id=b.id,blueprintSha256=b.blueprintSha256,pairs=records,beltNodes=nodes,beltComponents=components,readAllReaderEntityNumbers=readers,readAllBeltComponents=readerComponents,readAllBeltComponentEntityNumbers=protected,passed=true}
 end
 helpers.write_file('pairing-audit.json',helpers.table_to_json(result),false)
end)
