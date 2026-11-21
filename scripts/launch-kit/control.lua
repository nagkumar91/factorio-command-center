-- Launch kit native harness (adapted from scripts/essentials-mall/control.lua and the
-- inserter-workshop refill phase). Feeds only the declared west entrances at their declared
-- per-minute supply (throttled), seeds nothing, and removes items from declared east chests
-- only in the selective-refill step. Phases: fill (from empty to a complete kit), hold,
-- selective refill, long hold.
local payload=helpers.json_to_table(require('payload'))
local B=payload.build
local PR=payload.protocol
-- Exploration only (validate.mjs LAUNCH_KIT_FIRST_LAUNCH): recipes a save without a space platform has not unlocked.
local FL=payload.firstLaunch
local RED=defines.wire_connector_id.circuit_red
local GREEN=defines.wire_connector_id.circuit_green
local CIR=defines.wire_connector_id.combinator_input_red
local CIG=defines.wire_connector_id.combinator_input_green
local COR=defines.wire_connector_id.combinator_output_red
local COG=defines.wire_connector_id.combinator_output_green

local function check(ok,msg) if not ok then error('LAUNCH_KIT_CHECK: '..msg) end end
local function status(e) for n,v in pairs(defines.entity_status) do if v==e.status then return n end end return tostring(e.status) end
local function crafting(e) return e.type=='assembling-machine' or e.type=='furnace' end
local function write() helpers.write_file('result.json',helpers.table_to_json(storage.report),false) end
local function contents(inv) local o={} for _,it in pairs(inv.get_contents()) do o[it.name]=(o[it.name] or 0)+it.count end return o end
local function minutes(t) return t/3600 end

local function ring_signals(t)
 local out={};local total=0
 for _,s in ipairs(t.reader.get_signals(RED) or {}) do if s.signal.type~='virtual' then out[s.signal.name]=s.count;total=total+s.count end end
 return out,total
end

local function stats(t,name) return t.force.get_item_production_statistics(t.surface).get_input_count(name) end

-- Breadth-first search from an entrance along belts, arms and fluid boxes to a machine that crafted with it.
local function input_route(t,p)
 local byUnit={};for id,e in pairs(t.entities) do byUnit[e.unit_number]=id end
 local edges={}
 local function link(a,b) if a and b and a.valid and b.valid and byUnit[a.unit_number] and byUnit[b.unit_number] then local k=a.unit_number;edges[k]=edges[k] or {};edges[k][#edges[k]+1]=b.unit_number end end
 for _,e in pairs(t.entities) do
  if e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter' then
   for _,n in pairs(e.belt_neighbours.outputs) do link(e,n) end
   if e.type=='underground-belt' and e.belt_to_ground_type=='input' then link(e,e.underground_belt_neighbour) end
  elseif e.type=='inserter' then
   local allowed=true
   if e.use_filters then allowed=false;for i=1,e.filter_slot_count do local f=e.get_filter(i);if f and f.name==p.item then allowed=true end end end
   if allowed then link(e.pickup_target,e.drop_target) end
  elseif e.type=='pipe' or e.type=='pipe-to-ground' then
   for _,list in pairs(e.fluidbox_neighbours) do for _,n in pairs(list) do link(e,n) end end
  end
 end
 local start=t.entities[p.entity].unit_number;local q={start};local previous={[start]=false};local head=1
 while head<=#q do local unit=q[head];head=head+1;local id=byUnit[unit];local e=t.entities[id]
  if crafting(e) and e.products_finished>0 then
   for _,i in pairs(t.ingredients[t.spec[id].recipe] or {}) do if i.name==p.item then
    local route={};while unit do table.insert(route,1,byUnit[unit]);unit=previous[unit] end;return route
   end end
  end
  for _,nextUnit in ipairs(edges[unit] or {}) do if previous[nextUnit]==nil then previous[nextUnit]=unit;q[#q+1]=nextUnit end end
 end
 return nil
end

script.on_init(function()
 check(script.active_mods.base=='2.1.24','wrong base version')
 local force=game.create_force('launchkit');force.enable_all_recipes();force.inserter_stack_size_bonus=0;force.bulk_inserter_capacity_bonus=1
 check(force.inserter_stack_size_bonus==0 and force.bulk_inserter_capacity_bonus==1,'incorrect inserter unlock baseline')
 local sw=math.ceil((B.footprint.width+24)/32)*32;local sh=math.ceil((B.footprint.height+24)/32)*32
 local s=game.create_surface('launchkit',{width=sw,height=sh,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
 s.request_to_generate_chunks({0,0},math.ceil(math.max(sw,sh)/64)+1);s.force_generate_chunk_requests()
 for _,e in pairs(s.find_entities()) do e.destroy() end
 local tiles={};for x=-sw/2,sw/2-1 do for y=-sh/2,sh/2-1 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end;s.set_tiles(tiles)
 local t={surface=s,force=force,entities={},spec={},ingredients=B.recipeIngredients,bulkMaxHand={},samples={},ringMax=0,ringItemMax={},ringViolations=0,chestMax={},chestOverCap={},actualRecipeChecks=0}
 for _,saved in ipairs(B.entities) do t.spec[saved.entity_number]=saved end
 storage.t=t
 storage.report={id=B.id,blueprintSha256=B.blueprintSha256,protocol=PR,feedPolicy='Declared west entrances only, throttled to their declared per-minute supply (belt credit capped at 8, one item at a time on alternating lanes; fluids per tick with a one-second carry); items removed only from declared east chests in the selective-refill step; no inventories seeded'}
 if FL then
  for _,n in ipairs(FL.locked) do check(force.recipes[n]~=nil,'first launch: unknown recipe '..n);force.recipes[n].enabled=false end
  local locked={};for _,n in ipairs(FL.locked) do locked[n]=force.recipes[n].enabled end
  storage.report.firstLaunch={locked=FL.locked,enabledAfterLock=locked,unlockMinute=FL.unlockTick and minutes(FL.unlockTick) or nil}
 end
 -- The manifest's rocket count rests on its inline item weights: check each against the game's own value (kg = weight / 1000).
 storage.report.weightsKg={};for name,kg in pairs(B.launch.weightKg) do local w=prototypes.item[name].weight/1000;storage.report.weightsKg[name]=w;check(math.abs(w-kg)<1e-9,'weight '..name..' game '..w..' kg, table '..kg..' kg') end
 local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(B.code)==0,'import failed')
 local ghosts=inv[1].build_blueprint{surface=s,force=force,position={0,0},build_mode=defines.build_mode.forced}
 check(#ghosts==#B.entities,'entity count '..#ghosts..' expected '..#B.entities)
 for _,g in pairs(ghosts) do
  local id=g.tags.flight_science_entity;check(id~=nil,'missing identity')
  local _,e,proxy=g.revive{raise_revive=true};check(e~=nil and not proxy,'revive failed '..id);t.entities[id]=e
 end
 inv.destroy()
 local first=B.entities[1];local actual=t.entities[first.entity_number];local dx=actual.position.x-first.position.x;local dy=actual.position.y-first.position.y
 for _,saved in ipairs(B.entities) do
  local e=t.entities[saved.entity_number];check(e.name==saved.name and e.position.x==saved.position.x+dx and e.position.y==saved.position.y+dy,'geometry changed '..saved.entity_number)
  check(e.direction==(saved.direction or 0),'direction changed '..saved.entity_number)
  if saved.recipe then
   local r=e.get_recipe();check(r and r.name==saved.recipe,'recipe changed '..saved.entity_number);check(e.products_finished==0,'nonempty machine')
   check(e.get_module_inventory()==nil or e.get_module_inventory().is_empty(),'installed modules')
   local expected={};for _,ingredient in ipairs(t.ingredients[saved.recipe]) do expected[ingredient.name]=ingredient.amount end
   local count=0;for _,ingredient in pairs(r.ingredients) do check(expected[ingredient.name]==ingredient.amount,'native ingredient mismatch '..saved.recipe..' '..ingredient.name);count=count+1 end
   check(count==#t.ingredients[saved.recipe],'native ingredient count mismatch')
  end
 end
 for _,p in ipairs(B.ports) do if p.externalSide=='west' or p.externalSide=='east' then local d=p.externalSide=='west' and -1 or 1;local e=t.entities[p.entity];for k=1,3 do check(s.can_place_entity{name='fast-transport-belt',position={e.position.x+d*k,e.position.y},force=force},'blocked exterior approach '..p.entity..' offset '..k) end end end
 local port;for _,p in ipairs(B.ports) do if p.kind=='power' then port=p end end
 local pole=t.entities[port.entity];t.pole=pole
 local reach=pole.prototype.get_supply_area_distance(pole.quality)
 for x=-math.ceil(reach)-2,math.ceil(reach)+2 do for y=-math.ceil(reach)-2,math.ceil(reach)+2 do
  if not t.fixture then local q={x=pole.position.x+x,y=pole.position.y+y}
   if s.can_place_entity{name='electric-energy-interface',position=q,force=force} then
    local e=s.create_entity{name='electric-energy-interface',position=q,force=force}
    if e.electric_network_id==pole.electric_network_id then e.electric_buffer_size=10000000000;e.power_production=10000000000;e.power_usage=0;t.fixture=e else e.destroy() end
   end
  end
 end end
 check(t.fixture~=nil,'no power fixture')
 local loop=B.loopControl[1];t.loop=loop;t.reader=t.entities[loop.reader]
 t.outputs={};for i,p in ipairs(B.outputs) do t.outputs[i]={item=p.item,cap=p.cap,chest=t.entities[p.entity],entity=p.entity} end
 t.final={};for item,ids in pairs(B.finalMachines) do t.final[item]={};for _,id in ipairs(ids) do t.final[item][#t.final[item]+1]=t.entities[id] end end
 t.machines={};for id,e in pairs(t.entities) do if crafting(e) then t.machines[id]=e end end
 t.arms={};t.bulk={};for id,e in pairs(t.entities) do if e.type=='inserter' then t.arms[id]=e;if e.name=='bulk-inserter' then t.bulk[id]=e end end end
 t.belts={};for _,p in ipairs(B.inputs) do t.belts[#t.belts+1]={item=p.item,perMinute=p.perMinute,belt=t.entities[p.entity],credit=0,lane=1,accepted=0,minute={}} end
 t.fluidPorts={};for _,p in ipairs(B.fluids) do t.fluidPorts[#t.fluidPorts+1]={item=p.item,perMinute=p.perMinute,pipe=t.entities[p.entity],carry=0,accepted=0,minute={}} end
 if payload.saturate then for _,b in ipairs(t.belts) do b.perMinute=1800 end for _,f in ipairs(t.fluidPorts) do f.perMinute=6000 end end
 t.ringProducts={};for _,item in ipairs(B.finals) do t.ringProducts[item]=true end
 storage.phase='fill';storage.phaseStart=0
end)

local function finished(list) local n=0;for _,e in ipairs(list or {}) do n=n+e.products_finished end;return n end
local function finals_snapshot(t) local o={};for item,list in pairs(t.final) do o[item]=finished(list) end;return o end

local function wiring_checks(t)
 check(t.pole.electric_network_id~=nil,'power network missing')
 for id,e in pairs(t.entities) do if crafting(e) or e.type=='inserter' or e.type=='arithmetic-combinator' or e.type=='decider-combinator' then
  check(e.is_connected_to_electric_network() and e.electric_network_id==t.pole.electric_network_id,'unpowered '..e.name..' '..e.position.x..','..e.position.y)
 end end
 local net=t.reader.get_circuit_network(RED);check(net,'ring reader disconnected')
 local ringId=net.network_id
 for _,id in ipairs(t.loop.loop) do local e=t.entities[id];local c=e.get_control_behavior();local n=e.get_circuit_network(RED)
  check(c and c.read_contents and c.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.hold and n and n.network_id==ringId,'ring tile is not a per-tile hold reader on the ring network '..id)
  check(e.get_circuit_network(GREEN)==nil,'ring tile on green '..id)
 end
 for _,id in ipairs(t.loop.controlled) do local n=t.entities[id].get_circuit_network(RED);check(n and n.network_id==ringId,'controlled arm not on ring '..id) end
 for _,r in ipairs(t.loop.reserveArms or {}) do local n=t.entities[r.entity].get_circuit_network(RED);check(n and n.network_id==ringId,'reserve arm not on ring '..r.entity) end
 for _,r in ipairs(t.loop.ringGatedInputs or {}) do local n=t.entities[r.entity].get_circuit_network(RED);check(n and n.network_id==ringId,'ring-gated input arm not on ring '..r.entity) end
 do local ap=B.stockControl.am1Pipeline;if ap.ironArm then local n=t.entities[ap.ironArm].get_circuit_network(RED);check(n and n.network_id==t.entities[ap.machines[1]].get_circuit_network(RED).network_id and t.entities[ap.ironArm].get_circuit_network(GREEN)==nil,'AM1 iron arm wiring') end end
 local sc=B.stockControl;local comb=t.entities[sc.combinator];local cn=comb.get_circuit_network(GREEN);check(cn,'cap combinator not on green')
 check(cn.network_id~=ringId,'cap network equals ring network');check(comb.get_circuit_network(RED)==nil,'cap combinator on red')
 for _,id in ipairs(sc.chests) do local e=t.entities[id];local n=e.get_circuit_network(GREEN);check(n and n.network_id==cn.network_id,'chest not on cap network '..id);check(e.get_circuit_network(RED)==nil,'chest on red '..id) end
 for _,id in ipairs(sc.arms) do local e=t.entities[id];local n=e.get_circuit_network(GREEN);check(n and n.network_id==cn.network_id,'chest arm not on cap network '..id);check(e.get_circuit_network(RED)==nil,'chest arm on red '..id) end
 for _,o in ipairs(t.outputs) do local sig=cn.get_signal({type='item',name=o.item,quality='normal'});check(sig==o.chest.get_item_count(o.item)-o.cap,'cap signal mismatch '..o.item..' '..tostring(sig)) end
 for _,g in ipairs(sc.capGatedArms) do local e=t.entities[g.entity];local n=e.get_circuit_network(GREEN);check(n and n.network_id==cn.network_id,'cap-gated arm not on cap network '..g.entity)
  local r=e.get_circuit_network(RED);if g.ring then check(r and r.network_id==ringId,'cap-gated ring arm not on ring '..g.entity) elseif g.pipeline then check(r and r.network_id~=ringId,'pipeline arm network '..g.entity) else check(r==nil,'cap-gated arm on red '..g.entity) end end
 local ap=sc.am1Pipeline;local ac=t.entities[ap.combinator];local an=t.entities[ap.machines[1]].get_circuit_network(RED)
 check(ac.get_circuit_network(CIR).network_id==an.network_id and t.entities[ap.machines[2]].get_circuit_network(RED).network_id==an.network_id and ac.get_circuit_network(COR).network_id==t.entities[ap.arm].get_circuit_network(RED).network_id and an.network_id~=ringId,'AM1 pipeline wiring')
 for _,id in ipairs(sc.greenRelays or {}) do local e=t.entities[id];check(e.get_circuit_network(RED)==nil,'green relay on red '..id);local c=e.get_control_behavior();check(not c or not c.circuit_enable_disable,'green relay has a condition '..id) end
 for _,l in ipairs(sc.exactLatches) do
  local m=t.entities[l.machine];local mc=m.get_control_behavior();check(mc and mc.circuit_read_contents and mc.include_in_crafting,'exact machine does not read contents with crafting '..l.product)
  local mn=m.get_circuit_network(RED);check(mn and mn.network_id~=ringId and mn.network_id~=cn.network_id,'exact machine network '..l.product)
  check(m.get_circuit_network(GREEN)==nil,'exact machine on green '..l.product)
  local d=t.entities[l.decider]
  local ir=d.get_circuit_network(CIR);local ig=d.get_circuit_network(CIG);local orr=d.get_circuit_network(COR)
  check(ir and ir.network_id==mn.network_id and ig and ig.network_id==cn.network_id and orr and orr.network_id==mn.network_id and d.get_circuit_network(COG)==nil,'latch decider wiring '..l.product)
  for _,a in ipairs(l.ingredientArms) do local e=t.entities[a.entity];local n=e.get_circuit_network(RED);check(n and n.network_id==mn.network_id and e.get_circuit_network(GREEN)==nil,'latch arm wiring '..a.entity) end
  local oa=t.entities[l.outputArm];local on=oa.get_circuit_network(RED);check(on and on.network_id==mn.network_id and oa.get_circuit_network(GREEN)==nil,'latch output arm wiring '..l.product)
  local oc=oa.get_control_behavior();check(oc and oc.circuit_read_hand_contents and not oc.circuit_enable_disable,'latch output arm must read its hand and be ungated '..l.product)
  local ch=t.entities[l.chest];check(ch.get_circuit_network(GREEN).network_id==cn.network_id,'latch chest network '..l.product)
 end
 local sm=t.entities[sc.siloReserves.machine].get_circuit_network(RED)
 for _,r in ipairs(sc.siloReserves.deciders) do local d=t.entities[r.decider]
  check(d.get_circuit_network(CIR).network_id==ringId and d.get_circuit_network(COR).network_id==sm.network_id and d.get_circuit_network(CIG)==nil and d.get_circuit_network(COG)==nil,'silo reserve wiring '..r.item) end
 local cg=t.entities[sc.foundationChestGate.decider]
 check(cg.get_circuit_network(CIR).network_id==t.entities[sc.foundationGate.starterPackMachine].get_circuit_network(RED).network_id and cg.get_circuit_network(CIG).network_id==cn.network_id and cg.get_circuit_network(COG).network_id==cn.network_id and cg.get_circuit_network(COR)==nil,'foundation chest gate wiring')
 local fg=sc.foundationGate;local d=t.entities[fg.decider];local spn=t.entities[fg.starterPackMachine].get_circuit_network(RED)
 check(d.get_circuit_network(CIR).network_id==spn.network_id and d.get_circuit_network(CIG).network_id==cn.network_id and d.get_circuit_network(COG).network_id==cn.network_id and d.get_circuit_network(COR)==nil,'foundation gate wiring')
 local fa=t.entities[fg.arm];check(fa.get_circuit_network(GREEN).network_id==cn.network_id and fa.get_circuit_network(RED)==nil,'foundation gate arm wiring')
 t.stockNetworksIsolated=true;t.ringNetwork=ringId;t.capNetwork=cn.network_id
end

-- Products outside their chest: on the ring, in the final machine's output, in any arm's hand.
local function outside(t,item,ring)
 local n=ring[item] or 0
 for _,m in ipairs(t.final[item] or {}) do n=n+m.get_inventory(defines.inventory.crafter_output).get_item_count(item) end
 for _,a in pairs(t.arms) do local h=a.held_stack;if h.valid_for_read and h.name==item then n=n+h.count end end
 return n
end

local function machine_report(t)
 local list={}
 for id,e in pairs(t.machines) do
  list[#list+1]={entity=id,recipe=t.spec[id].recipe,finished=e.products_finished,status=status(e),statusSamples=t.samples[id],input=contents(e.get_inventory(defines.inventory.crafter_input)),output=contents(e.get_inventory(defines.inventory.crafter_output))}
 end
 table.sort(list,function(a,b) return a.entity<b.entity end)
 return list
end

local function idle_stock(t)
 local belts={}
 for id,e in pairs(t.entities) do if e.type=='transport-belt' or e.type=='underground-belt' then
  for i=1,e.get_max_transport_line_index() do for _,it in pairs(e.get_transport_line(i).get_contents()) do belts[it.name]=(belts[it.name] or 0)+it.count end end
 end end
 local fluid={}
 for id,e in pairs(t.entities) do if e.type=='pipe' or e.type=='pipe-to-ground' or crafting(e) then
  for name,amount in pairs(e.get_fluid_contents()) do fluid[name]=(fluid[name] or 0)+amount end
 end end
 local inMachines={};local outMachines={}
 for _,e in pairs(t.machines) do
  for k,v in pairs(contents(e.get_inventory(defines.inventory.crafter_input))) do inMachines[k]=(inMachines[k] or 0)+v end
  for k,v in pairs(contents(e.get_inventory(defines.inventory.crafter_output))) do outMachines[k]=(outMachines[k] or 0)+v end
 end
 local hands={};for _,a in pairs(t.arms) do local h=a.held_stack;if h.valid_for_read then hands[h.name]=(hands[h.name] or 0)+h.count end end
 local ring=ring_signals(t)
 return {belts=belts,ring=ring,machineInputs=inMachines,machineOutputs=outMachines,hands=hands,fluids=fluid}
end

local function feed(t,tick)
 local minute=math.floor(tick/3600)
 for _,b in ipairs(t.belts) do
  b.credit=math.min(8,b.credit+b.perMinute/3600)
  while b.credit>=1 do
   local ok=false
   for k=0,1 do local lane=((b.lane+k-1)%2)+1;if b.belt.get_transport_line(lane).insert_at_back{name=b.item,count=1} then ok=true;b.lane=3-lane;break end end
   if not ok then break end
   b.credit=b.credit-1;b.accepted=b.accepted+1;b.minute[minute]=(b.minute[minute] or 0)+1
  end
 end
 for _,f in ipairs(t.fluidPorts) do
  local want=f.perMinute/3600+f.carry
  local got=f.pipe.insert_fluid{name=f.item,amount=want}
  f.accepted=f.accepted+got;f.minute[minute]=(f.minute[minute] or 0)+got
  f.carry=math.min(want-got,f.perMinute/60)
 end
end

local function accepted(t) local o={};for _,b in ipairs(t.belts) do o[b.item]=b.accepted end;for _,f in ipairs(t.fluidPorts) do o[f.item]=f.accepted end;return o end
local function peaks(t) local o={};for _,list in ipairs({t.belts,t.fluidPorts}) do for _,b in ipairs(list) do local m=0;for _,v in pairs(b.minute) do if v>m then m=v end end;o[b.item]=m end end;return o end

local function sample(t,tick)
 local ring,total=ring_signals(t)
 if total>t.ringMax then t.ringMax=total end
 for k,n in pairs(ring) do if n>(t.ringItemMax[k] or 0) then t.ringItemMax[k]=n end end
 if total>=t.loop.capacity*.9 then t.ringViolations=t.ringViolations+1 end
 local counts={}
 for _,o in ipairs(t.outputs) do local c=o.chest.get_item_count(o.item);counts[o.item]=c
  if c>(t.chestMax[o.item] or 0) then t.chestMax[o.item]=c end
  if c>o.cap then t.chestOverCap[o.item]=(t.chestOverCap[o.item] or 0)+1 end
 end
 return ring,counts
end

local function status_samples(t)
 for id,e in pairs(t.machines) do t.samples[id]=t.samples[id] or {};local n=status(e);t.samples[id][n]=(t.samples[id][n] or 0)+1
  local r=e.get_recipe();if r then check(r.name==t.spec[id].recipe,'wrong active recipe '..id);t.actualRecipeChecks=t.actualRecipeChecks+1 end end
end

local function slack_sample(t,ring,store)
 for _,o in ipairs(t.outputs) do if t.ringProducts[o.item] and B.productSlack[o.item] then
  local n=outside(t,o.item,ring);if n>(store[o.item] or 0) then store[o.item]=n end
 end end
end

local function start_phase(name,tick) storage.phase=name;storage.phaseStart=tick end

local function finish(t,tick,complete)
 local r=storage.report
 r.complete=complete
 r.ringOverall={maxStock=t.ringMax,itemMax=t.ringItemMax,violations=t.ringViolations,capacity=t.loop.capacity}
 r.chestMax=t.chestMax;r.chestOverCap=t.chestOverCap;r.endTick=tick
 r.powered=t.powered;r.importedEntities=#B.entities;r.exactRecipeChecks=t.actualRecipeChecks;r.externalApproachesClear=true;r.stockNetworksIsolated=t.stockNetworksIsolated
 r.inserterCapacityResearch={fast=t.force.inserter_stack_size_bonus,bulkUnlockBonus=t.force.bulk_inserter_capacity_bonus}
 r.bulkInserters={};for id,_ in pairs(t.bulk) do r.bulkInserters[#r.bulkInserters+1]={entity=id,observedMaxHand=t.bulkMaxHand[id] or 0} end
 r.acceptedTotal=accepted(t);r.peakMinuteDraw=peaks(t)
 r.machinesAtEnd=machine_report(t)
 write()
 storage.doneTick=tick
end

script.on_event(defines.events.on_tick,function()
 local t=storage.t;if not t then return end
 local tick=game.tick
 if storage.doneTick then if tick>=storage.doneTick+60 then error('LAUNCH_KIT_HARNESS_COMPLETE') end return end
 if tick==1 then t.force.inserter_stack_size_bonus=0;t.force.bulk_inserter_capacity_bonus=1 end
 if FL and FL.unlockTick and tick==FL.unlockTick then for _,n in ipairs(FL.locked) do t.force.recipes[n].enabled=true end;storage.report.firstLaunch.unlockedAtTick=tick end
 for id,e in pairs(t.bulk) do if e.held_stack.valid_for_read then local n=e.held_stack.count;if n>(t.bulkMaxHand[id] or 0) then t.bulkMaxHand[id]=n end end end
 feed(t,tick)
 if tick==60 then wiring_checks(t);t.powered=true end
 if tick%60~=0 or tick<60 then return end
 local r=storage.report
 local ring,counts=sample(t,tick)
 local phase=storage.phase;local elapsed=tick-storage.phaseStart
 if phase=='fill' then
  status_samples(t)
  r.fill=r.fill or {completedMinute={},order={}}
  local all=true
  for _,o in ipairs(t.outputs) do
   if counts[o.item]==o.cap and r.fill.completedMinute[o.item]==nil then r.fill.completedMinute[o.item]=minutes(tick);r.fill.order[#r.fill.order+1]=o.item end
   if counts[o.item]~=o.cap then all=false end
  end
  if tick%(5*3600)==0 then r.fill.progress=r.fill.progress or {};local mf={};for id,e in pairs(t.machines) do mf[t.spec[id].recipe..'#'..id]={e.products_finished,status(e)} end
   r.fill.progress[#r.fill.progress+1]={minute=minutes(tick),chests=counts,ring=ring,finished=finals_snapshot(t),machines=mf};write() end
  if all then
   r.fill.kitTick=tick;r.fill.kitMinutes=minutes(tick);r.fill.complete=true
   r.fill.finishedAtKit=finals_snapshot(t)
   r.fill.productionStats={}
   for _,item in ipairs({'rocket-silo','cargo-landing-pad','space-platform-starter-pack'}) do r.fill.productionStats[item]=t.force.get_item_production_statistics(t.surface).get_input_count(item) end
   r.fill.acceptedAtKit=accepted(t);r.fill.peakMinuteDraw=peaks(t)
   r.fill.idleStock=idle_stock(t);r.fill.machines=machine_report(t)
   r.routes={};for _,list in ipairs({B.inputs,B.fluids}) do for _,p in ipairs(list) do r.routes[#r.routes+1]={item=p.item,route=input_route(t,p)} end end
   storage.hold={finishedStart=finals_snapshot(t),finishedQuietStart=finals_snapshot(t),mismatches=0,samples=0,slack={}}
   start_phase('hold',tick);write()
  elseif tick>=PR.kitLimitTicks then
   r.fill.complete=false;r.fill.endChests=counts;r.fill.machines=machine_report(t);r.fill.idleStock=idle_stock(t);r.fill.acceptedAtTimeout=accepted(t)
   finish(t,tick,false)
  end
 elseif phase=='hold' or phase=='longhold' then
  local h=storage.hold
  h.samples=h.samples+1
  for _,o in ipairs(t.outputs) do if counts[o.item]~=o.cap then h.mismatches=h.mismatches+1;h.lastMismatch={item=o.item,count=counts[o.item],minute=minutes(tick)} end end
  slack_sample(t,ring,h.slack)
  local len=phase=='hold' and PR.holdTicks or PR.longHoldTicks
  local quiet=phase=='hold' and PR.holdQuietTicks or PR.longHoldQuietTicks
  if elapsed==len-quiet then h.finishedQuietStart=finals_snapshot(t) end
  if elapsed>=len then
   local endf=finals_snapshot(t);local quietCrafts={}
   for item,n in pairs(endf) do local d=n-(h.finishedQuietStart[item] or n);if d>0 then quietCrafts[item]=d end end
   local rec={minutes=len/3600,samples=h.samples,mismatches=h.mismatches,lastMismatch=h.lastMismatch,quietMinutes=quiet/3600,quietCrafts=quietCrafts,slackMax=h.slack,finished=endf,ring=ring}
   -- Exact machines: stragglers and finished products left inside.
   rec.exact={}
   for _,l in ipairs(B.stockControl.exactLatches) do local m=t.entities[l.machine]
    rec.exact[l.product]={input=contents(m.get_inventory(defines.inventory.crafter_input)),output=contents(m.get_inventory(defines.inventory.crafter_output)),finished=m.products_finished,crafting=m.is_crafting()}
   end
   if phase=='hold' then
    r.hold=rec
    -- Selective refill: remove a share of five different items at once.
    local removed={}
    for _,o in ipairs(t.outputs) do local spec=PR.refill[o.item];if spec and o.cap>0 then
     local want=spec=='half' and math.floor(o.cap/2) or math.min(spec,o.cap)
     local n=want>0 and o.chest.remove_item{name=o.item,count=want} or 0
     removed[o.item]=n
    end end
    storage.refill={removed=removed,finishedStart=finals_snapshot(t),mismatches=0,done={},samples=0}
    r.refill={removed=removed,startMinute=minutes(tick)}
    start_phase('refill',tick);write()
   else
    r.longHold=rec;finish(t,tick,true)
   end
  end
 elseif phase=='refill' then
  local f=storage.refill;f.samples=f.samples+1
  local all=true
  for _,o in ipairs(t.outputs) do
   if f.removed[o.item] then
    if counts[o.item]==o.cap then if not f.done[o.item] then f.done[o.item]=minutes(elapsed) end else all=false;f.done[o.item]=nil end
   elseif counts[o.item]~=o.cap then f.mismatches=f.mismatches+1;f.lastMismatch={item=o.item,count=counts[o.item],minute=minutes(tick)} end
  end
  if all or elapsed>=PR.refillLimitTicks then
   local endf=finals_snapshot(t);local crafts={}
   for item,n in pairs(endf) do crafts[item]=n-(f.finishedStart[item] or 0) end
   r.refill.complete=all;r.refill.minutes=minutes(elapsed);r.refill.doneMinute=f.done;r.refill.crafts=crafts;r.refill.otherChestMismatches=f.mismatches;r.refill.lastMismatch=f.lastMismatch
   r.refill.endChests=counts
   storage.hold={finishedStart=endf,finishedQuietStart=endf,mismatches=0,samples=0,slack={}}
   if all then start_phase('longhold',tick);write() else finish(t,tick,false) end
  end
 end
end)
