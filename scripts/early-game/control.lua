-- Native qualification of the Early Flight science and red-belt mall (blueprint-sources/early-game/early-flight-science-mall.txt).
-- Adapted from the early-flight-seven harness that Claude Fable 5.2 wrote for the same production cells (that family's
-- scripts/early-flight-seven/control.lua), itself adapted from scripts/early-controlled-loops/control.lua. The mall is
-- 277 tiles tall, so the test surface is larger than the seven workshops need.
-- One surface and one force per workshop. The only ingredient writes are to the two lanes of the declared
-- west inlet belts; the only removals are from the declared output chests. Nothing is scanned per tick.
local payload=helpers.json_to_table(require('payload'))
local P=payload.phases
local measureEnd=P.warmup+P.measure
local holdEnd=measureEnd+P.hold
local settleEnd=holdEnd+P.settle
local finish=settleEnd+P.recovery
local function check(ok,msg) if not ok then error('EARLY_FLIGHT_MALL: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
-- Half-tile units as integers: no negative zero, no float formatting.
local function key(name,x,y) return name..'@'..math.floor(x*2+0.5)..','..math.floor(y*2+0.5) end
local function consumed(t,name) return t.force.get_item_production_statistics(t.surface).get_output_count(name) end
-- Items held by the workshop, by item and by holder type (belts, machines, chests, inserter hands). Read twice per run.
local function census(t)
 local c={}
 local function add(holder,name,n) local k=holder..' '..name;c[k]=(c[k]or 0)+n end
 for _,e in pairs(t.surface.find_entities_filtered{force=t.force})do
  if e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' then
   for i=1,e.get_max_transport_line_index()do for name,n in pairs(e.get_transport_line(i).get_contents())do if type(n)=='table' then add('belt',n.name,n.count) else add('belt',name,n) end end end
  elseif e.type=='inserter' then if e.held_stack.valid_for_read then add('hand',e.held_stack.name,e.held_stack.count)end
  else for i=1,e.get_max_inventory_index()do local inv=e.get_inventory(i);if inv then for _,it in pairs(inv.get_contents())do add(e.type,it.name,it.count)end end end end
 end
 return c
end
local function produced(t,name) return t.force.get_item_production_statistics(t.surface).get_input_count(name) end

script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={}
 for index,b in ipairs(payload.builds) do
  local force=game.create_force('mall-'..index);force.enable_all_recipes();force.inserter_stack_size_bonus=0
  local s=game.create_surface('mall-'..index,{width=256,height=448,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},7);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-128,127 do for y=-224,223 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local t={id=b.id,surface=s,force=force,byKey={},machines={},inputs={},outputs={},fed={},measuredFed={},holdTailFed={},output={},recoveryOutput={},lostGhosts={},displaced={},unpowered={},baseline={},producedBaseline={},samples={},credit={}}
  storage.tests[index]=t
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(b.code)==0,'import failed '..b.id)
  local ghosts=inv[1].build_blueprint{surface=s,force=force,position={0,0},build_mode=defines.build_mode.forced}
  check(#ghosts==#b.entities,'entity count '..#ghosts..' expected '..#b.entities..' in '..b.id)
  local minX,minY=math.huge,math.huge
  -- The translation is read from the belts alone: every workshop has them and they sit on whole tiles.
  for _,g in pairs(ghosts)do if g.ghost_name=='transport-belt' then minX=math.min(minX,g.position.x);minY=math.min(minY,g.position.y)end end
  local savedX,savedY=math.huge,math.huge
  for _,e in ipairs(b.entities)do if e.name=='transport-belt' then savedX=math.min(savedX,e.position.x);savedY=math.min(savedY,e.position.y)end end
  local dx,dy=minX-savedX,minY-savedY
  local left,top,right,bottom=math.huge,math.huge,-math.huge,-math.huge
  local described={}
  for i,g in pairs(ghosts)do described[i]=g.ghost_name..' '..g.position.x..','..g.position.y end
  for i,g in pairs(ghosts)do
   -- A ghost vanishes when an entity revived before it covers one of its tiles: two entities of the string overlap.
   if not g.valid then check(payload.tolerateLostGhosts,'overlapping entities in '..b.id..': '..described[i]..' was removed by an earlier entity');t.lostGhosts[#t.lostGhosts+1]=described[i];goto continue end
   local _,e,proxy=g.revive{raise_revive=true};check(e~=nil and not proxy,'revive failed in '..b.id..': '..described[i])
   t.byKey[key(e.name,e.position.x-dx,e.position.y-dy)]=e
   local box=e.bounding_box
   left=math.min(left,math.floor(box.left_top.x));top=math.min(top,math.floor(box.left_top.y))
   right=math.max(right,math.ceil(box.right_bottom.x));bottom=math.max(bottom,math.ceil(box.right_bottom.y))
   ::continue::
  end
  inv.destroy()
  t.boundingTiles={width=right-left,height=bottom-top}
  for _,saved in ipairs(b.entities)do
   local e=t.byKey[key(saved.name,saved.position.x,saved.position.y)]
   if e==nil and payload.tolerateLostGhosts then t.displaced[#t.displaced+1]=saved.name..' '..saved.position.x..','..saved.position.y;goto skip end
   check(e~=nil,'not built where the string puts it (off the tile grid or overlapped) '..b.id..' '..saved.name..' '..saved.position.x..','..saved.position.y)
   check(e.direction==(saved.direction or 0),'direction changed '..b.id..' '..saved.name..' '..saved.position.x..','..saved.position.y)
   if saved.recipe then check(e.get_recipe() and e.get_recipe().name==saved.recipe,'recipe changed '..b.id..' '..saved.recipe);check(e.products_finished==0,'nonempty machine')end
   if saved.name=='wooden-chest' and saved.bar then check(e.get_inventory(defines.inventory.chest).get_bar()==saved.bar+1,'chest limit changed '..b.id)end
   if e.type=='assembling-machine' or e.type=='furnace' then t.machines[#t.machines+1]={entity=e,name=saved.name,recipe=saved.recipe,x=saved.position.x,y=saved.position.y}end
   ::skip::
  end
  if payload.rewirePoles then
   -- Screen only: stand every pole again the way a player placing it by hand would, so it wires itself
   -- to the poles in reach. Measures what a string does once its missing pole wires are added by hand.
   local poles={}
   for k,e in pairs(t.byKey)do if e.type=='electric-pole' then poles[#poles+1]={k=k,name=e.name,position=e.position}end end
   for _,q in ipairs(poles)do t.byKey[q.k].destroy()end
   for _,q in ipairs(poles)do local e=s.create_entity{name=q.name,position=q.position,force=force};check(e~=nil,'pole not replaced');t.byKey[q.k]=e end
  end
  for i,p in ipairs(b.inputs)do
   local belt=t.byKey[key('transport-belt',p.position.x,p.position.y)];check(belt~=nil,'missing inlet belt '..b.id..' '..p.item..' '..p.position.x..','..p.position.y..' offset '..dx..','..dy..' lost '..#t.lostGhosts);t.inputs[i]=belt
   -- The tile west of an inlet must be outside the workshop and free, so a player belt can reach it.
   check(#s.find_entities_filtered{position={belt.position.x-1,belt.position.y}}==0,'inlet is not open to the west '..b.id..' '..p.item)
  end
  for i,p in ipairs(b.outputs)do
   local chest=t.byKey[key('wooden-chest',p.position.x,p.position.y)];check(chest~=nil,'missing output chest '..b.id..' '..p.item);t.outputs[i]=chest
  end
  local pole=t.byKey[key('big-electric-pole',b.power.position.x,b.power.position.y)]
  if not pole and payload.tolerateLostGhosts then
   -- Screen of a string whose own power pole was lost to an overlap: use the nearest big pole that was built.
   local best
   for _,e in pairs(t.byKey)do if e.name=='big-electric-pole' then
    local d=(e.position.x-dx-b.power.position.x)^2+(e.position.y-dy-b.power.position.y)^2
    if not best or d<best then best=d;pole=e end
   end end
   t.substitutePowerPole=true
  end
  check(pole~=nil,'missing power pole '..b.id);t.pole=pole
  local reach=math.ceil(pole.prototype.get_supply_area_distance(pole.quality))
  for x=-reach,reach do for y=-reach,reach do
   if not t.fixture then local p={x=pole.position.x+x,y=pole.position.y+y}
    -- The fixture must sit outside the workshop rectangle, where a player's grid connection would be.
    local outside=p.x<left-1 or p.x>right+1 or p.y<top-1 or p.y>bottom+1
    if outside and s.can_place_entity{name='electric-energy-interface',position=p,force=force}then
     local e=s.create_entity{name='electric-energy-interface',position=p,force=force}
     if e.electric_network_id==pole.electric_network_id then e.electric_buffer_size=10000000000;e.power_production=10000000000;e.power_usage=0;t.fixture=e else e.destroy()end
    end
   end
  end end
  if not t.fixture then
   -- A corner pole whose supply area lies inside the rectangle: wire a pole placed outside it instead.
   local outsidePole=s.create_entity{name='big-electric-pole',position={left-3,top-3},force=force}
   check(outsidePole~=nil,'no place for the outside pole '..b.id)
   local e=s.create_entity{name='electric-energy-interface',position={left-5,top-5},force=force}
   check(e~=nil and e.electric_network_id==pole.electric_network_id,'grid connection does not reach the power pole '..b.id)
   e.electric_buffer_size=10000000000;e.power_production=10000000000;e.power_usage=0;t.fixture=e
  end
 end
end)

script.on_event(defines.events.on_tick,function()
 local tick=game.tick
 for index,t in ipairs(storage.tests or {})do
  local b=payload.builds[index]
  if tick==1 then t.force.enable_all_recipes();t.force.inserter_stack_size_bonus=0 end
  -- Long blocked hold: the chest is left with one full stack and nothing is collected.
  if P.hold>0 and tick==measureEnd+1 then
   t.blockedFixture={}
   for i,p in ipairs(b.outputs)do
    local inv=t.outputs[i].get_inventory(defines.inventory.chest);inv.clear()
    local size=prototypes.item[p.item].stack_size;inv[1].set_stack{name=p.item,count=size}
    check(inv[1].count==size,'output fixture not full');t.blockedFixture[p.item]=size
   end
  end
  if tick%4==0 then for i,p in ipairs(b.inputs)do
   local belt=t.inputs[i];local limit=b.feedPerMinute and b.feedPerMinute[p.item]
   if limit then t.credit[i]=math.min((t.credit[i]or 0)+limit*4/3600,4) end
   for lane=1,2 do
    if (not limit or t.credit[i]>=1) and belt.get_transport_line(lane).insert_at_back{name=p.item,count=1} then
     if limit then t.credit[i]=t.credit[i]-1 end
     t.fed[i]=(t.fed[i]or 0)+1
     if tick>P.warmup and tick<=measureEnd then t.measuredFed[i]=(t.measuredFed[i]or 0)+1 end
     if P.hold>0 and tick>holdEnd-P.holdTail and tick<=holdEnd then t.holdTailFed[i]=(t.holdTailFed[i]or 0)+1 end
    end
   end
  end end
  if tick%60==0 then
   if tick==60 then
    check(t.pole.electric_network_id~=nil,'power network missing');t.powered=true
    for _,e in pairs(t.byKey)do if e.type=='assembling-machine' or e.type=='inserter' or e.type=='electric-pole' then
     local ok=e.type=='electric-pole' and e.electric_network_id==t.pole.electric_network_id or e.type~='electric-pole' and e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id
     if not ok and payload.tolerateLostGhosts then t.unpowered[#t.unpowered+1]=e.name..' '..e.position.x..','..e.position.y
     else check(ok,'unpowered '..t.id..' '..e.name..' '..e.position.x..','..e.position.y) end
    end end
   end
   local blocked=P.hold>0 and tick>measureEnd and tick<=holdEnd
   for i,p in ipairs(b.outputs)do
    local n=blocked and 0 or t.outputs[i].remove_item{name=p.item,count=1000000}
    if tick>P.warmup and tick<=measureEnd then t.output[p.item]=(t.output[p.item]or 0)+n end
    if P.hold>0 and tick>settleEnd then t.recoveryOutput[p.item]=(t.recoveryOutput[p.item]or 0)+n end
   end
   if tick>P.warmup and tick<=measureEnd then for i,m in ipairs(t.machines)do
    t.samples[i]=t.samples[i]or {};local name=status(m.entity);t.samples[i][name]=(t.samples[i][name]or 0)+1
   end end
  end
  if P.hold>0 and tick==holdEnd-P.holdTail then for _,m in ipairs(t.machines)do m.tailBaseline=m.entity.products_finished end;if payload.census then t.tailCensus=census(t)end end
  if tick==P.warmup then
   for _,p in ipairs(b.inputs)do t.baseline[p.item]=consumed(t,p.item)end
   for _,item in ipairs(b.products)do t.producedBaseline[item]=produced(t,item)end
   for _,m in ipairs(t.machines)do m.baseline=m.entity.products_finished end
  end
  if tick==measureEnd then
   local r={id=t.id,powered=t.powered or false,importedEntities=#b.entities,boundingTiles=t.boundingTiles,outputsPerMinute={},collected={},producedPerMinute={},consumptionPerMinute={},inputs={},machines={}}
   local minutes=P.measure/3600
   for _,item in ipairs(b.products)do r.collected[item]=t.output[item]or 0;r.outputsPerMinute[item]=(t.output[item]or 0)/minutes;r.producedPerMinute[item]=(produced(t,item)-(t.producedBaseline[item]or 0))/minutes end
   for i,p in ipairs(b.inputs)do
    r.consumptionPerMinute[p.item]=(consumed(t,p.item)-(t.baseline[p.item]or 0))/minutes
    r.inputs[#r.inputs+1]={letter=p.letter,item=p.item,row=p.row,acceptedDuringMeasurement=t.measuredFed[i]or 0,acceptedPerMinute=(t.measuredFed[i]or 0)/minutes}
   end
   for i,m in ipairs(t.machines)do
    local e=m.entity
    r.machines[#r.machines+1]={name=m.name,recipe=m.recipe,x=m.x,y=m.y,measuredCrafts=e.products_finished-(m.baseline or 0),status=status(e),statusSamples=t.samples[i]or {}}
   end
   r.itemsOnGround=#t.surface.find_entities_filtered{type='item-entity'}
   r.lostGhosts=t.lostGhosts;r.displaced=t.displaced;r.substitutePowerPole=t.substitutePowerPole or false;r.unpowered=t.unpowered
   t.report=r
  end
  if P.hold>0 and tick==holdEnd then
   local hold={blockedMinutes=P.hold/3600,tailMinutes=P.holdTail/3600,acceptedInTail={},chest={},working=0}
   for i,p in ipairs(b.inputs)do hold.acceptedInTail[#hold.acceptedInTail+1]={letter=p.letter,item=p.item,row=p.row,count=t.holdTailFed[i]or 0}end
   for i,p in ipairs(b.outputs)do hold.chest[p.item]=t.outputs[i].get_item_count(p.item)end
   for _,m in ipairs(t.machines)do if m.entity.type=='assembling-machine' and m.entity.status==defines.entity_status.working then hold.working=hold.working+1 end end
   -- Crafts each machine finished in the hold's tail: a blocked workshop should have none left.
   hold.tailCrafts={}
   for _,m in ipairs(t.machines)do local n=m.entity.products_finished-(m.tailBaseline or m.entity.products_finished);if n>0 then hold.tailCrafts[#hold.tailCrafts+1]=(m.recipe or m.name)..' at '..m.x..','..m.y..': '..n end end
   hold.itemsOnGround=#t.surface.find_entities_filtered{type='item-entity'}
   if payload.census then local now=census(t);hold.censusGrowth={};for k,n in pairs(now)do local d=n-(t.tailCensus[k]or 0);if d~=0 then hold.censusGrowth[k]=d end end;for k,n in pairs(t.tailCensus)do if not now[k] then hold.censusGrowth[k]=-n end end end
   t.report.hold=hold
  end
  if P.hold>0 and tick==finish then
   local rec={settlingMinutes=P.settle/3600,measurementMinutes=P.recovery/3600,outputsPerMinute={},collected={}}
   for _,item in ipairs(b.products)do rec.collected[item]=t.recoveryOutput[item]or 0;rec.outputsPerMinute[item]=(t.recoveryOutput[item]or 0)/(P.recovery/3600)end
   t.report.recovery=rec;t.report.blockedFixture=t.blockedFixture
  end
 end
 if tick==measureEnd or (P.hold>0 and tick==finish) then
  local report={builds={},feedPolicy='Declared west inlet belt lanes only, both lanes, no internal injection; every output chest is emptied once a second except during the blocked hold',researchPolicy='All recipes enabled, no technologies researched, inserter stack bonus zero'}
  for _,t in ipairs(storage.tests)do report.builds[#report.builds+1]=t.report end
  helpers.write_file('result.json',helpers.table_to_json(report),false)
 end
end)
