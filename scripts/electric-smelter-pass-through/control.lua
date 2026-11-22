-- Native harness for electric-smelter-pass-through (one headless protocol, every scenario on its own surface).
-- Each scenario builds one or two copies of the exact blueprint from its import string (build_blueprint, then
-- revive), puts the two requested efficiency modules into every furnace by script (the item requests are
-- removed), and powers copy 1 only, through one electric energy interface north of the footprint (copy 2 is
-- powered only through the substations' own connection). Ore is fed on an external belt of the scenario's tier
-- (red or yellow) ending at the west entrance; the back tile of that belt is refilled every tick on both lanes.
-- The plate exit of every copy and the east end of the last copy run onto short external belts whose last tile
-- is emptied every tick (items counted by name). A scenario may leave the east end without a belt, or stop
-- emptying copy 1's plate belt during the blocked phase.
-- Phases (ticks from payload): warm-up, measure (A), blocked (B), settle, recovery (C).
local payload=helpers.json_to_table(require('payload'))
local W=payload.warmup
local A=W+payload.measure
local B=A+payload.blocked
local S=B+payload.settle
local R=S+payload.recovery
local function check(ok,msg) if not ok then error('SMELTER: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function phase(tick) if tick>W and tick<=A then return 'measure' elseif tick>A and tick<=B then return 'blocked' elseif tick>S and tick<=R then return 'recovery' end return nil end
local function write() helpers.write_file('result.json',helpers.table_to_json(storage.report),false) end
local function bump(t,k,n) t[k]=(t[k] or 0)+n end

local function drain(e,counts,item_filter,extra)
 local n=0
 for line=1,2 do
  local tl=e.get_transport_line(line)
  for _,c in pairs(tl.get_contents()) do
   local k=tl.remove_item{name=c.name,count=c.count}
   if counts and k>0 then bump(counts,c.name,k) end
   if extra and k>0 then bump(extra,c.name,k) end
   n=n+k
  end
 end
 return n
end

script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 storage.tests={}
 storage.report={scenarios={},blueprintSha256=payload.blueprintSha256,feedPolicy='External belt of the scenario tier ending at the west entrance; its back tile refilled every tick on both lanes (saturated). Exits drained from the last tile of short external belts every tick.',researchPolicy='No research: inserter hand size 1 (force inserter_stack_size_bonus 0).',modulePolicy='The modules the string requests (two per furnace, or none) inserted into every furnace by script; item-request proxies removed; module inventories read back at the end of the measured window.',powerPolicy='One electric energy interface north of copy 1 only.'}
 for index,sc in ipairs(payload.scenarios) do
  local force=game.create_force('smelter-'..index);force.inserter_stack_size_bonus=0
  local sw=192;local sh=96
  local s=game.create_surface('smelter-'..index,{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},4);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities()) do e.destroy() end
  local tiles={} for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end
  s.set_tiles(tiles)
  local t={name=sc.name,surface=s,force=force,copies={},drains={},feed=nil,fed={},powered=false}
  storage.tests[index]=t
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(payload.code)==0,'import failed')
  local modules=0;local moduleKinds={}
  for k=1,sc.copies do
   local ghosts=inv[1].build_blueprint{surface=s,force=force,position={-40+(k-1)*payload.pitch,0},build_mode=defines.build_mode.forced}
   check(#ghosts==#payload.entities,'entity count '..#ghosts..' expected '..#payload.entities)
   local copy={entities={},furnaces={},baseline={}}
   for _,g in pairs(ghosts) do
    local id=g.tags and g.tags.smelter_entity;check(id~=nil,'missing identity')
    local _,e,proxy=g.revive{raise_revive=true};check(e~=nil,'revive failed '..id);copy.entities[id]=e
    if proxy and proxy.valid then proxy.destroy() end
   end
   for _,p in pairs(s.find_entities_filtered{name='item-request-proxy'}) do p.destroy() end
   local first=payload.entities[1];local actual=copy.entities[first.entity_number]
   copy.offset={x=actual.position.x-first.position.x,y=actual.position.y-first.position.y}
   for _,saved in ipairs(payload.entities) do
    local e=copy.entities[saved.entity_number]
    check(e.name==saved.name and e.position.x==saved.position.x+copy.offset.x and e.position.y==saved.position.y+copy.offset.y,'geometry changed '..saved.entity_number)
    check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
    if saved.output_priority then check(e.splitter_output_priority==saved.output_priority,'splitter priority changed '..saved.entity_number) end
    if e.name=='electric-furnace' then
     -- Modules come from the string's own requests (an informational scenario may override them).
     local mi=e.get_module_inventory();check(mi and mi.is_empty(),'furnace modules before insert')
     local want={}
     if sc.moduleOverride then want[sc.moduleOverride]=2 else for _,req in ipairs(saved.items or {}) do want[req.id.name]=(want[req.id.name] or 0)+#req.items.in_inventory end end
     for name,count in pairs(want) do local n=mi.insert{name=name,count=count};check(n==count,'module insert '..name);modules=modules+n;moduleKinds[name]=(moduleKinds[name] or 0)+n end
     copy.furnaces[#copy.furnaces+1]={id=saved.entity_number,e=e}
    end
   end
   if k>1 then check(copy.offset.x==t.copies[1].offset.x+payload.pitch*(k-1) and copy.offset.y==t.copies[1].offset.y,'copies not at the pitch') end
   t.copies[k]=copy
  end
  inv.destroy()
  local o=t.copies[1].offset
  local function world(c,x,y) local off=t.copies[c].offset return {x=x+.5+off.x,y=y+.5+off.y} end
  -- Feed: four tiles west of the entrance (row 1), tier of the scenario.
  local feedBelt=sc.feed=='yellow' and 'transport-belt' or 'fast-transport-belt'
  for x=-4,-1 do local e=s.create_entity{name=feedBelt,position=world(1,x,payload.entrance.y),direction=defines.direction.east,force=force};check(e,'feed belt');if x==-4 then t.feed=e end end
  -- Plate drains under every copy's exit.
  for c=1,sc.copies do
   local last
   -- The drain belt is the exit's own belt tier.
   local exitName=t.copies[c].entities[payload.exitEntity].name
   for y=payload.exit.y+1,payload.exit.y+3 do last=s.create_entity{name=exitName,position=world(c,payload.exit.x,y),direction=defines.direction.south,force=force};check(last,'plate belt') end
   t.drains[#t.drains+1]={kind='plates',copy=c,e=last,counts={}}
  end
  -- East drain after the last copy, unless the scenario leaves it unconnected.
  if sc.east~='unconnected' then
   local last
   for x=payload.forward.x+1,payload.forward.x+3 do last=s.create_entity{name='fast-transport-belt',position=world(sc.copies,x,payload.forward.y),direction=defines.direction.east,force=force};check(last,'east belt') end
   t.drains[#t.drains+1]={kind='east',copy=sc.copies,e=last,counts={}}
  end
  -- Power: one interface north of copy 1 (2 x 2 centered on a tile corner) inside the first substation's area.
  local pole=t.copies[1].entities[payload.powerEntity]
  local p={x=pole.position.x,y=o.y-2}
  check(s.can_place_entity{name='electric-energy-interface',position=p,force=force},'interface spot')
  local ei=s.create_entity{name='electric-energy-interface',position=p,force=force}
  ei.electric_buffer_size=1e10;ei.power_production=1e10;ei.power_usage=0
  check(ei.electric_network_id==pole.electric_network_id,'interface not on the station network')
  t.fixture=ei
  storage.report.scenarios[index]={name=sc.name,copies=sc.copies,feed=sc.feed,ore=sc.ore,east=sc.east or 'drained',blockCopy1PlatesDuringBlocked=sc.blockPlates or false,modulesInserted=modules,modulesByName=moduleKinds,moduleOverride=sc.moduleOverride,importedEntitiesPerCopy=#payload.entities,offsets={}}
  for c=1,sc.copies do storage.report.scenarios[index].offsets[c]=t.copies[c].offset end
 end
end)

local function modulesNow(t)
 local res={}
 for c,copy in ipairs(t.copies) do local m={} for _,f in ipairs(copy.furnaces) do for _,it in pairs(f.e.get_module_inventory().get_contents()) do m[it.name]=(m[it.name] or 0)+it.count end end res[c]=m end
 return res
end
local function power(t)
 local stats=t.copies[1].entities[payload.powerEntity].electric_network_statistics
 local res={} for name,v in pairs(stats.input_counts) do res[name]=v end
 return res
end
local function snapshot(t)
 local snap={}
 for c,copy in ipairs(t.copies) do snap[c]={} for _,f in ipairs(copy.furnaces) do snap[c][f.id]=f.e.products_finished end end
 return snap
end

local function furnaceStats(t,from,to,minutes)
 local res={}
 for c,copy in ipairs(t.copies) do
  local list={};local mn=math.huge;local mx=0;local sum=0
  for _,f in ipairs(copy.furnaces) do local n=to[c][f.id]-from[c][f.id];list[#list+1]={entity=f.id,crafts=n,status=status(f.e),recipe=f.e.get_recipe() and f.e.get_recipe().name or 'none'};mn=math.min(mn,n);mx=math.max(mx,n);sum=sum+n end
  res[c]={furnaces=#list,minCrafts=mn,maxCrafts=mx,meanCrafts=sum/#list,totalCrafts=sum,craftsPerMinute=sum/minutes,list=list}
 end
 return res
end

local function phaseRecord(t,ph,minutes)
 local rec={minutes=minutes,drains={},fedPerMinute=(t.fed[ph] or 0)/minutes}
 for _,d in ipairs(t.drains) do
  local perMinute={} for k,v in pairs(d.counts[ph] or {}) do perMinute[k]=v/minutes end
  rec.drains[#rec.drains+1]={kind=d.kind,copy=d.copy,items=d.counts[ph] or {},perMinute=perMinute}
 end
 return rec
end

script.on_event(defines.events.on_tick,function()
 local tick=game.tick
 if tick%3600==0 then helpers.write_file('progress.json',helpers.table_to_json{tick=tick,target=R},false) end
 local ph=phase(tick)
 for index,t in ipairs(storage.tests or {}) do
  local sc=payload.scenarios[index];local r=storage.report.scenarios[index]
  if tick==1 then t.force.inserter_stack_size_bonus=0 end
  for line=1,2 do if t.feed.get_transport_line(line).insert_at_back{name=sc.ore,count=1} then if ph then bump(t.fed,ph,1) end end end
  for _,d in ipairs(t.drains) do
   local hold=sc.blockPlates and d.kind=='plates' and d.copy==1 and ph=='blocked'
   if not hold then local counts=nil;if ph then d.counts[ph]=d.counts[ph] or {};counts=d.counts[ph] end
    local n0=nil;if ph=='blocked' and tick>B-3600 then n0={} end
    drain(d.e,counts,nil,n0)
    if n0 then d.counts.blockedLastMinute=d.counts.blockedLastMinute or {};for k,v in pairs(n0) do bump(d.counts.blockedLastMinute,k,v) end end end
  end
  if tick==60 then
   local net=t.copies[1].entities[payload.powerEntity].electric_network_id
   check(net~=nil,'no network')
   local subs=0;local crossCopper=0
   for c,copy in ipairs(t.copies) do for id,e in pairs(copy.entities) do
    if e.type=='electric-pole' then subs=subs+1;check(e.electric_network_id==net,'second network: copy '..c..' pole '..id)
     for _,conn in pairs(e.get_wire_connector(defines.wire_connector_id.pole_copper,true).connections) do
      local other=conn.target.owner
      if other.type=='electric-pole' then for c2,copy2 in ipairs(t.copies) do if c2~=c then for _,e2 in pairs(copy2.entities) do if e2==other then crossCopper=crossCopper+1 end end end end end
     end
    end
    if e.type=='furnace' or e.type=='inserter' or e.type=='roboport' then check(e.is_connected_to_electric_network() and e.electric_network_id==net,'unpowered '..e.name..' copy '..c..' '..id) end
   end end
   r.powered=true;r.oneElectricNetwork=true;r.substations=subs;r.copperWiresBetweenCopies=crossCopper/2
  end
  if tick==W then t.snapW=snapshot(t);t.powerW=power(t) end
  if tick==A then t.snapA=snapshot(t);r.measure=phaseRecord(t,'measure',payload.measure/3600);r.measure.furnaces=furnaceStats(t,t.snapW,t.snapA,payload.measure/3600);r.measure.modulesInFurnaces=modulesNow(t)
   local pa=power(t);local d={} for name,v in pairs(pa) do d[name]=v-(t.powerW[name] or 0) end;r.measure.electricInputDelta=d;r.measure.electricInputSeconds=payload.measure/60;write() end
  if tick==B then t.snapB=snapshot(t);r.blocked=phaseRecord(t,'blocked',payload.blocked/3600);r.blocked.lastMinute=phaseRecord(t,'blockedLastMinute',1);r.blocked.furnaces=furnaceStats(t,t.snapA,t.snapB,payload.blocked/3600)
   if sc.blockPlates then local held=0;for _,d in ipairs(t.drains) do if d.kind=='plates' and d.copy==1 then for line=1,2 do held=held+d.e.get_transport_line(line).get_item_count() end end end;r.blocked.copy1PlateBeltHeld=held
    local mark=t.snapB1m;if mark then local still=0;for _,f in ipairs(t.copies[1].furnaces) do still=still+(t.snapB[1][f.id]-mark[1][f.id]) end;r.blocked.copy1CraftsInLastMinute=still end end
   write() end
  if tick==B-3600 then t.snapB1m=snapshot(t) end
  if tick==S then t.snapS=snapshot(t) end
  if tick==R then t.snapR=snapshot(t);r.recovery=phaseRecord(t,'recovery',payload.recovery/3600);r.recovery.furnaces=furnaceStats(t,t.snapS,t.snapR,payload.recovery/3600);r.finished=true;write() end
 end
end)
