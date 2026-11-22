-- Native qualification harness for oil-products (Factorio 2.1.24 Space Age, headless benchmark).
-- One copy of the blueprint per scenario, each on its own surface and force. Every copy runs a list of phases
-- (payload.builds[i].phases): each phase has a length, a feed scale and a per-minute draw for every output.
-- A phase may also override one entrance's figure (feed). Writes only to the declared entrances: fluids get rate/3600 per tick plus the refused carry (capped at one
-- second of supply), the iron belt gets a credit of rate/3600 per tick (capped at 8), one plate per credit on
-- alternating lanes. Draws only from the declared outputs: fluids rate/3600 per tick plus the unmet carry (capped
-- at one second), the sulfur belt every 4 ticks up to its credit. Electricity through one energy interface on the
-- power port's network; no inventory or fluid seeded anywhere else. Once a second every output is checked for any
-- fluid or item other than its own, machine statuses are sampled and tank levels are recorded.
local payload=helpers.json_to_table(require('payload'))
local function check(ok,msg) if not ok then error('OIL_PRODUCTS: '..msg) end end
local statusName={}
for n,v in pairs(defines.entity_status) do statusName[v]=n end
local function status(e) return statusName[e.status] or tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function is_belt(e) return e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' end
local function write() helpers.write_file('result.json',helpers.table_to_json(storage.report),false) end
local function phase_at(b,tick)
 local start=0
 for i,p in ipairs(b.phases)do local stop=start+p.ticks;if tick>start and tick<=stop then return i,p,start,stop end;start=stop end
 return nil
end
local function total_ticks(b) local n=0;for _,p in ipairs(b.phases)do n=n+p.ticks end;return n end

script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={}
 storage.report={builds={},feedPolicy=payload.feedPolicy,drawPolicy=payload.drawPolicy,researchPolicy='All recipes enabled (advanced oil processing, sulfur processing, lubricant and the rest); fast inserter stack bonus zero; bulk inserter unlock-equivalent capacity bonus +1 only'}
 for index,b in ipairs(payload.builds)do
  local force=game.create_force('oil-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0;force.bulk_inserter_capacity_bonus=1
  local sw=math.ceil((b.footprint.width+24)/32)*32;local sh=math.ceil((b.footprint.height+24)/32)*32
  local s=game.create_surface('oil-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64)+1);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,entities={},spec={},phase={},credit={},lane={},carry={},drawCarry={},crafters={},tanks={},fixture=nil}
  for _,saved in ipairs(b.entities)do t.spec[saved.entity_number]=saved end
  storage.tests[index]=t
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(b.code)==0,'import failed')
  local ghosts=inv[1].build_blueprint{surface=s,force=force,position={0,0},build_mode=defines.build_mode.forced}
  check(#ghosts==#b.entities,'entity count '..#ghosts..' expected '..#b.entities)
  for _,g in pairs(ghosts)do
   local id=g.tags.flight_science_entity;check(id~=nil,'missing identity')
   local _,e,proxy=g.revive{raise_revive=true};check(e~=nil and not proxy,'revive failed '..id);t.entities[id]=e
  end
  inv.destroy()
  local first=b.entities[1];local actual=t.entities[first.entity_number]
  t.offset={x=actual.position.x-first.position.x,y=actual.position.y-first.position.y}
  local recipeChecks=0
  for _,saved in ipairs(b.entities)do
   local e=t.entities[saved.entity_number]
   check(e.name==saved.name and e.position.x==saved.position.x+t.offset.x and e.position.y==saved.position.y+t.offset.y,'geometry changed '..saved.entity_number)
   check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
   check(e.mirroring==(saved.mirror or false),'mirroring changed '..saved.entity_number)
   if e.type=='inserter' then check(e.inserter_stack_size_override==(saved.override_stack_size or 0),'arm stack override changed '..saved.entity_number) end
   if saved.recipe then
    local r=e.get_recipe();check(r and r.name==saved.recipe,'recipe changed '..saved.entity_number)
    check(e.get_module_inventory()==nil or e.get_module_inventory().is_empty(),'installed modules')
    recipeChecks=recipeChecks+1;t.crafters[saved.entity_number]=e
   end
   if e.name=='storage-tank' then t.tanks[saved.entity_number]=e end
  end
  -- external approaches: three tiles outward from every port must be buildable for a belt or pipe
  for _,p in ipairs(b.ports)do if p.externalSide then
   local d=({west={-1,0},east={1,0},north={0,-1},south={0,1}})[p.externalSide];local e=t.entities[p.entity]
   for k=1,3 do check(s.can_place_entity{name='pipe',position={e.position.x+d[1]*k,e.position.y+d[2]*k},force=force},'blocked exterior approach '..p.label..' offset '..k) end
  end end
  local pole=t.entities[b.powerEntity];t.pole=pole
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
  -- circuit control: every controlled pump keeps its condition and shares the red network with the tanks
  local controls={}
  for _,c in ipairs(b.control or {})do
   local pump=t.entities[c.pump];local cb=pump.get_control_behavior()
   check(cb and cb.circuit_enable_disable,'pump '..c.pump..' not circuit controlled')
   local cond=cb.circuit_condition;check(cond.first_signal.name==c.fluid and cond.comparator==c.comparator and cond.constant==c.threshold,'pump '..c.pump..' condition changed')
   local net=pump.get_circuit_network(defines.wire_connector_id.circuit_red);check(net,'pump '..c.pump..' has no red network')
   local tank=t.entities[c.tank];local tnet=tank.get_circuit_network(defines.wire_connector_id.circuit_red);check(tnet and tnet.network_id==net.network_id,'tank '..c.tank..' not on pump '..c.pump..' network')
   controls[#controls+1]={pump=c.pump,tank=c.tank,fluid=c.fluid,comparator=c.comparator,threshold=c.threshold,networkId=net.network_id}
  end
  storage.report.builds[index]={id=b.id,scenario=b.scenario,importedEntities=#b.entities,recipeChecks=recipeChecks,externalApproachesClear=true,controls=controls,phases={}}
 end
end)

script.on_event(defines.events.on_tick,function()
 local tick=game.tick
 if tick%3600==0 then helpers.write_file('progress.json',helpers.table_to_json{tick=tick},false) end
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index];local r=storage.report.builds[index]
  if tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0;t.force.bulk_inserter_capacity_bonus=1 end
  if tick==60 then
   check(t.pole.electric_network_id~=nil,'power network missing')
   for _,e in pairs(t.entities)do
    if e.type=='electric-pole' then check(e.electric_network_id==t.pole.electric_network_id,'second power network at '..e.position.x..','..e.position.y) end
    if crafting(e) or e.type=='inserter' or e.type=='pump' then check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y) end
   end
   r.powered=true
  end
  local pi,p,start,stop=phase_at(b,tick)
  if pi then
   local ph=t.phase[pi]
   if not ph then
    ph={fed={},drawn={},wrong={},crafts={},status={},tank={},beltWrong={}}
    for id,e in pairs(t.crafters)do ph.crafts[id]=-e.products_finished end
    t.phase[pi]=ph
   end
   -- feed
   for i,port in ipairs(b.inputs)do
    local rate=(p.feed and p.feed[port.item]) or port.perMinute*(p.feedScale or 1)
    local e=t.entities[port.entity]
    if port.transport=='pipe' then
     local per=rate/3600;local want=per+(t.carry[i]or 0)
     local n=want>0 and e.insert_fluid{name=port.item,amount=want} or 0
     t.carry[i]=math.min(want-n,per*60);ph.fed[port.item]=(ph.fed[port.item]or 0)+n
    else
     t.credit[i]=math.min(8,(t.credit[i]or 0)+rate/3600)
     while t.credit[i]>=1 do
      local lane=(t.lane[i]or 0)%2+1
      if not e.get_transport_line(lane).insert_at_back{name=port.item,count=1} then lane=lane%2+1;if not e.get_transport_line(lane).insert_at_back{name=port.item,count=1} then break end end
      t.lane[i]=lane;t.credit[i]=t.credit[i]-1;ph.fed[port.item]=(ph.fed[port.item]or 0)+1
     end
    end
   end
   -- draw
   for i,port in ipairs(b.outputs)do
    local rate=(p.draw and p.draw[port.item]) or 0
    local e=t.entities[port.entity]
    if port.transport=='pipe' then
     local per=rate/3600;local want=per+(t.drawCarry[i]or 0)
     local got=0
     if want>0 then local f=e.remove_fluid(1,want);got=(f and f.name==port.item and f.amount) or 0;check(not f or f.amount==0 or f.name==port.item,'wrong fluid drawn at '..port.item..' outlet: '..tostring(f and f.name)) end
     t.drawCarry[i]=math.min(want-got,per*60);ph.drawn[port.item]=(ph.drawn[port.item]or 0)+got
    elseif tick%4==0 then
     t.drawCarry[i]=math.min((t.drawCarry[i]or 0)+rate*4/3600,8)
     local whole=math.floor(t.drawCarry[i])
     if whole>0 then local got=0
      for line=1,2 do if got<whole then got=got+e.get_transport_line(line).remove_item{name=port.item,count=whole-got} end end
      t.drawCarry[i]=t.drawCarry[i]-got;ph.drawn[port.item]=(ph.drawn[port.item]or 0)+got
     end
    end
   end
   -- once a second: wrong-product checks, statuses, tank levels
   if tick%60==0 then
    for _,port in ipairs(b.outputs)do local e=t.entities[port.entity]
     if port.transport=='pipe' then local f=e.get_fluid_segment_fluid(1) or e.get_fluid(1);if f and f.name~=port.item then ph.wrong[port.item]=(ph.wrong[port.item]or 0)+1;ph.wrongName=f.name end
     else for line=1,2 do for _,c in pairs(e.get_transport_line(line).get_contents())do if c.name~=port.item then ph.beltWrong[c.name]=math.max(ph.beltWrong[c.name]or 0,c.count) end end end end
    end
    for id,e in pairs(t.crafters)do local st=status(e);ph.status[id]=ph.status[id]or {};ph.status[id][st]=(ph.status[id][st]or 0)+1 end
    for id,e in pairs(t.tanks)do local f=e.get_fluid(1);local v=f and f.amount or 0;local s=ph.tank[id]or {min=1e9,max=0,sum=0,n=0,fluid=f and f.name};s.min=math.min(s.min,v);s.max=math.max(s.max,v);s.sum=s.sum+v;s.n=s.n+1;if f then s.fluid=f.name end;ph.tank[id]=s end
   end
   if tick==stop then
    local minutes=p.ticks/3600
    local out={name=p.name,minutes=minutes,feedScale=p.feedScale or 1,feed=p.feed,draw=p.draw,fedPerMinute={},drawnPerMinute={},wrongFluidSeconds=ph.wrong,wrongFluidName=ph.wrongName,wrongItemsOnSulfurExit=ph.beltWrong,machines={},tanks={}}
    for k,v in pairs(ph.fed)do out.fedPerMinute[k]=v/minutes end
    for k,v in pairs(ph.drawn)do out.drawnPerMinute[k]=v/minutes end
    for id,e in pairs(t.crafters)do out.machines[#out.machines+1]={entity=id,recipe=t.spec[id].recipe,x=e.position.x-t.offset.x,y=e.position.y-t.offset.y,crafts=e.products_finished+ph.crafts[id],craftsPerMinute=(e.products_finished+ph.crafts[id])/minutes,status=status(e),statusSamples=ph.status[id]} end
    for id,s in pairs(ph.tank)do out.tanks[#out.tanks+1]={entity=id,fluid=s.fluid,min=s.min,max=s.max,mean=s.n>0 and s.sum/s.n or 0,final=(t.tanks[id].get_fluid(1) or {amount=0}).amount} end
    r.phases[#r.phases+1]=out
    if pi==#b.phases then r.finished=true end
    write()
   end
  end
 end
end)
