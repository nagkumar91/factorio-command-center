-- Native belt audit for the robot workshop: builds each exact blueprint in a
-- private headless game, then records the belt component every read-all reader
-- sees and every underground pair Factorio actually formed.
local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('ROBOT_PAIRING: '..msg) end end
local function isbelt(e) return e and (e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter') end
local function sortedkeys(set) local ids={};for id in pairs(set)do ids[#ids+1]=id end;table.sort(ids);return ids end
local steps={[0]={0,-1},[4]={1,0},[8]={0,1},[12]={-1,0}}
script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={}
 for index,b in ipairs(payload.builds)do
  local force=game.create_force('robots-'..index)
  local s=game.create_surface('robots-'..index,{width=256,height=128,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},4);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-128,127 do for y=-64,63 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={entities={}};storage.tests[index]=t
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(b.code)==0,'import failed')
  local ghosts=inv[1].build_blueprint{surface=s,force=force,position={0,0},build_mode=defines.build_mode.forced}
  check(#ghosts==b.entityCount,'entity count '..#ghosts..' expected '..b.entityCount)
  for _,g in pairs(ghosts)do
   local id=g.tags.flight_science_entity;check(id~=nil,'missing identity')
   local _,e,proxy=g.revive{raise_revive=true};check(e~=nil and not proxy,'revive failed '..id);t.entities[id]=e
  end
  inv.destroy()
 end
end)
script.on_event(defines.events.on_tick,function()
 if game.tick~=1 then return end
 local result={builds={}}
 for index,t in ipairs(storage.tests)do
  local b=payload.builds[index]
  local byUnit,nodes={},{}
  for id,e in pairs(t.entities)do byUnit[e.unit_number]=id end
  local function idof(e) if not e then return nil end;local id=byUnit[e.unit_number];check(id~=nil,'belt neighbour outside blueprint');return id end
  local inputs,outputs={},{}
  for id,e in pairs(t.entities)do if isbelt(e)then
   local node={inputs={},outputs={}}
   for _,n in pairs(e.belt_neighbours.inputs)do node.inputs[#node.inputs+1]=idof(n)end
   for _,n in pairs(e.belt_neighbours.outputs)do node.outputs[#node.outputs+1]=idof(n)end
   if e.type=='underground-belt'then
    node.underground=idof(e.underground_belt_neighbour)
    if e.belt_to_ground_type=='input'then inputs[#inputs+1]=id else outputs[#outputs+1]=id end
   end
   nodes[id]=node
  end end
  table.sort(inputs)
  local pairsFound,unpaired={},{}
  for _,id in ipairs(inputs)do
   local e,other=t.entities[id],nodes[id].underground
   if other then
    local o=t.entities[other];local step=steps[e.direction]
    local distance=(o.position.x-e.position.x)*step[1]+(o.position.y-e.position.y)*step[2]
    pairsFound[#pairsFound+1]={inputEntityNumber=id,outputEntityNumber=other,distance=distance}
   else unpaired[tostring(id)]=true end
  end
  local components,protected={},{}
  for _,reader in ipairs(b.readerSeeds)do
   local e=t.entities[reader];check(isbelt(e),'reader is not a belt '..reader)
   local behavior=e.get_control_behavior()
   check(behavior and behavior.read_contents and behavior.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold,'reader is not in read-all mode '..reader)
   local visited={[reader]=true};local queue={reader};local head=1
   local function visit(id) if id and not visited[id] then visited[id]=true;queue[#queue+1]=id end end
   while head<=#queue do local node=nodes[queue[head]];head=head+1
    for _,id in ipairs(node.inputs)do visit(id)end
    for _,id in ipairs(node.outputs)do visit(id)end
    visit(node.underground)
   end
   for id in pairs(visited)do protected[id]=true end
   components[#components+1]={readerEntityNumber=reader,entityNumbers=sortedkeys(visited)}
  end
  local checked,passed=0,next(unpaired)==nil
  for _,expected in ipairs(b.expectedPairs or {})do
   checked=checked+1;local found=false
   for _,p in ipairs(pairsFound)do if p.inputEntityNumber==expected.inputEntityNumber and p.outputEntityNumber==expected.outputEntityNumber then found=true end end
   if not found then passed=false end
  end
  result.builds[#result.builds+1]={id=b.id,readerSeeds=b.readerSeeds,components=components,nativeReadAllBeltComponentEntityNumbers=sortedkeys(protected),undergroundInputPairs=pairsFound,unpairedUndergroundInputs=unpaired,expectedPairsChecked=checked,passed=passed}
 end
 helpers.write_file('pairing.json',helpers.table_to_json(result),false)
end)
