local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('FLIGHT_SCIENCE: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function recipe(t,id) return t.spec[id].recipe or t.spec[id].tags.production_recipe end
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
script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={}
 for index,b in ipairs(payload.builds) do
  local force=game.create_force('science-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0
  local sw=math.ceil((b.footprint.width+24)/32)*32;local sh=math.ceil((b.footprint.height+24)/32)*32
  local s=game.create_surface('science-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64)+1);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,entities={},fed={},measuredFed={},output={},baseline={},machineBaseline={},powered=false,portSamples={},portOutputs={},samples={},loopSamples={},recoveryOutput={},fluidFed={},actualRecipeChecks=0}
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
  for _,saved in ipairs(b.entities)do
   local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed')
   check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
   if saved.recipe then check(e.get_recipe().name==saved.recipe,'recipe changed');check(e.products_finished==0,'nonempty machine')end
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
script.on_event(defines.events.on_tick,function()
 if game.tick~=1 then return end
 local result={passed=true,builds={}}
 for index,t in ipairs(storage.tests)do
  local b=payload.builds[index];local records={};local byUnit={};local expected=b.undergroundEndpointAudit
  for id,e in pairs(t.entities)do byUnit[e.unit_number]=id end
  local expectedById={};for _,entry in ipairs(expected or {})do expectedById[entry.entity]=entry end
  for id,e in pairs(t.entities)do if e.type=='underground-belt' then
   local neighbour=e.underground_belt_neighbour;local actual=neighbour and byUnit[neighbour.unit_number] or false
   check(not neighbour or actual,'underground neighbour outside blueprint')
   if expected then
    local entry=expectedById[id];check(entry~=nil,'unexpected underground endpoint '..id)
    check(entry.neighbour==actual,'changed underground neighbour '..id)
    check(entry.role==e.belt_to_ground_type,'changed underground role '..id)
    expectedById[id]=nil
   end
   records[#records+1]={entity=id,role=e.belt_to_ground_type,neighbour=actual,matched=expected~=nil}
  end end
  if expected then check(next(expectedById)==nil,'missing expected underground endpoint')end
  table.sort(records,function(a,z)return a.entity<z.entity end)
  local protected,queue={},{}
  local function protect(e)if e and (e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter') then local id=byUnit[e.unit_number];if id and not protected[id] then protected[id]=true;queue[#queue+1]=e end end end
  for _,block in ipairs(b.loopControl or {})do protect(t.entities[block.reader])end
  for id,spec in pairs(t.spec)do if spec.control_behavior and spec.control_behavior.circuit_contents_read_mode==2 then protect(t.entities[id])end end
  local head=1;while head<=#queue do local e=queue[head];head=head+1
   for _,n in pairs(e.belt_neighbours.inputs)do protect(n)end
   for _,n in pairs(e.belt_neighbours.outputs)do protect(n)end
   if e.type=='underground-belt' then protect(e.underground_belt_neighbour)end
  end
  local protectedIds={};for id in pairs(protected)do protectedIds[#protectedIds+1]=id end;table.sort(protectedIds)
  result.builds[#result.builds+1]={id=b.id,blueprintSha256=b.blueprintSha256,pairs=records,readAllBeltComponentEntityNumbers=protectedIds,passed=true}
 end
 helpers.write_file('pairing-audit.json',helpers.table_to_json(result),false)
end)
