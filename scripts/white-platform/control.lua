-- Native qualification harness for white-platform and white-pack-receiver (one end-to-end run qualifies both),
-- adapted from the planner's probes (plan/probes/endtoend.lua, platform.lua, rockets.lua).
-- payload.mode = 'endtoend': a real platform from a starter pack in Nauvis orbit; platformRequest inserted into the
--   hub (the only inventory write, standing for the rockets); the blueprint pasted as ghosts and built by the hub;
--   chunks arrive naturally; the receiver blueprint built on Nauvis is the only way packs leave the hub; packs are
--   collected only from the receiver chest, once per second, never during the blocked phase.
-- payload.mode = 'rockets': a rocket silo with automatic requests, a robot network and passive provider chests holding
--   exactly one starter pack and platformRequest; the game launches the rockets and the platform builds itself. The
--   harness keeps the silo's three rocket-part ingredients stocked (declared) and writes nothing else.
local P=helpers.json_to_table(require('payload'))
local PACK='space-science-pack'
local function write() helpers.write_file('result.json',helpers.table_to_json(storage.r),false) end
local function contents(inv) local t={} if not inv then return t end for _,i in ipairs(inv.get_contents()) do t[i.name]=(t[i.name] or 0)+i.count end return t end
local function fail(r,msg) r.failures[#r.failures+1]=msg end
local function close(a,b) return math.abs(a-b)<0.01 end

local function setupForce(r)
 local f=game.forces.player
 f.enable_all_recipes() f.inserter_stack_size_bonus=0 f.bulk_inserter_capacity_bonus=1
 r.force={inserterStackBonus=f.inserter_stack_size_bonus,bulkCapacityBonus=f.bulk_inserter_capacity_bonus,productivity={}}
 for _,n in ipairs{'oxide-asteroid-crushing','metallic-asteroid-crushing','carbonic-asteroid-crushing',PACK,'iron-plate','rocket-part'} do r.force.productivity[n]=f.recipes[n].productivity_bonus end
 r.zeroProductivity=true for _,v in pairs(r.force.productivity) do if v~=0 then r.zeroProductivity=false end end
 -- the inline weight table of the generator, re-checked against the game
 r.weights={} r.weightsMatch=true
 for name,kg in pairs(P.weights) do local w=prototypes.item[name].weight/1000 r.weights[name]=w if not close(w,kg) then r.weightsMatch=false fail(r,'weight '..name..' game '..w..' kg, table '..kg..' kg') end end
 return f
end

local function nauvisGround(radius)
 local n=game.surfaces.nauvis
 n.request_to_generate_chunks({0,0},radius) n.force_generate_chunk_requests()
 for _,e in pairs(n.find_entities()) do e.destroy() end
 local tl={} local lim=radius*32 for x=-lim,lim-1 do for y=-lim,lim-1 do tl[#tl+1]={name='grass-1',position={x,y}} end end n.set_tiles(tl)
 return n
end

-- ---------- receiver (ground) ----------
local function buildReceiver(r,f)
 local n=nauvisGround(2)
 local R=P.receiver local rr={importChecks={}} r.receiver=rr
 local bp=game.create_inventory(1) bp[1].set_stack{name='blueprint'}
 rr.importResult=bp[1].import_stack(R.code)
 local ghosts=bp[1].build_blueprint{surface=n,force=f,position={0,0},build_mode=defines.build_mode.forced}
 bp.destroy()
 rr.ghosts=#ghosts
 local byTag={}
 for _,g in pairs(ghosts) do local tag=g.tags and g.tags.flight_science_entity local _,e=g.revive{raise_revive=true} if e and tag then byTag[tag]=e end end
 storage.recv={}
 local geometry=true
 for _,x in ipairs(R.expected) do
  local e=byTag[x.entity]
  if not(e and e.valid and e.name==x.name and close(e.position.x,x.x) and close(e.position.y,x.y) and (x.direction==nil or e.direction==x.direction)) then geometry=false fail(r,'receiver geometry '..x.name) end
  if e then storage.recv[x.role]=e end
 end
 rr.importChecks.geometry=geometry
 local arm,chest,pad,sub=storage.recv.arm,storage.recv.chest,storage.recv.pad,storage.recv.substation
 rr.importChecks.armStackOverride=arm and arm.inserter_stack_size_override==1 or false
 rr.chestBarRaw=chest and chest.get_inventory(defines.inventory.chest).get_bar()
 rr.importChecks.chestBar=rr.chestBarRaw==R.bar+1
 -- three clear tiles east of the output chest (before the energy interface is placed)
 local clear=true
 for k=1,3 do if not n.can_place_entity{name='iron-chest',position={chest.position.x+k,chest.position.y},force=f} then clear=false end end
 rr.importChecks.eastClear=clear
 -- the pad's request, as imported from the string
 local secs=pad.get_logistic_sections() rr.padSections={}
 local active,ok=0,false
 for i,sec in ipairs(secs.sections) do
  local fl={} for j,fi in ipairs(sec.filters) do fl[j]={name=fi.value and fi.value.name,min=fi.min} end
  rr.padSections[i]={active=sec.active,filters=fl}
  if sec.active and #fl>0 then active=active+1 if #fl==1 and fl[1].name==PACK and fl[1].min==R.request then ok=true end end
 end
 rr.importChecks.padRequest=ok and active==1
 rr.padLimit=f.cargo_landing_pad_limit
 rr.padsOnNauvis=n.count_entities_filtered{name='cargo-landing-pad',force=f}
 rr.importChecks.onePad=rr.padLimit>=1 and rr.padsOnNauvis==1
 local eei=n.create_entity{name='electric-energy-interface',position={sub.position.x+2,sub.position.y+1},force=f}
 eei.electric_buffer_size=1e10 eei.power_production=1e10 eei.power_usage=0
 storage.eei=eei
end
local function receiverPowerCheck(r)
 local rr=r.receiver local a,s=storage.recv.arm,storage.recv.substation
 rr.importChecks.powered=a.energy>0 and a.status~=defines.entity_status.no_power and a.electric_network_id~=nil and a.electric_network_id==s.electric_network_id and storage.eei.electric_network_id==s.electric_network_id
end

-- ---------- platform ----------
local function hubInv() return storage.p.hub.get_inventory(defines.inventory.hub_main) end
local function createPlatform(r,f)
 local p=f.create_space_platform{name='white',planet='nauvis',starter_pack='space-platform-starter-pack'}
 p.apply_starter_pack() storage.p=p
 local inv=hubInv()
 r.start={tiles=p.surface.count_tiles_filtered{name='space-platform-foundation'},hub=contents(inv),paused=p.paused,slots=#inv}
 r.start.ok=r.start.tiles==100 and (r.start.hub['space-platform-foundation'] or 0)==10
 -- the only inventory write of the run: the kit's platform items, as five rockets would deliver them
 r.inserted={} r.insertComplete=true
 for name,count in pairs(P.platform.platformRequest) do local got=inv.insert{name=name,count=count} r.inserted[name]=got if got~=count then r.insertComplete=false fail(r,'insert '..name) end end
 local bp=game.create_inventory(1) bp[1].set_stack{name='blueprint'}
 r.importResult=bp[1].import_stack(P.platform.code)
 local ghosts=bp[1].build_blueprint{surface=p.surface,force=f,position={0,0},build_mode=defines.build_mode.forced}
 bp.destroy()
 r.ghosts={returned=#ghosts,entity=p.surface.count_entities_filtered{type='entity-ghost'},tile=p.surface.count_entities_filtered{type='tile-ghost'}}
 r.ghosts.ok=r.ghosts.entity==P.platform.entityCount and r.ghosts.tile==P.platform.newFoundationTiles
 r.requestMissingAfterPaste=p.hub.request_missing_construction_materials
end

local function signalName(s) return s and s.name end
local function checkBuilt(r)
 local p=storage.p local s=p.surface local f=p.force local hub=p.hub local inv=hubInv()
 local b={tick=game.tick,seconds=game.tick/60,mismatches={}}
 local function bad(msg) b.mismatches[#b.mismatches+1]=msg end
 local hubRed=hub.get_circuit_network(defines.wire_connector_id.circuit_red)
 local constantGreen
 local found={} storage.byRole={}
 for _,x in ipairs(P.platform.expected) do
  local e=s.find_entity(x.name,{x.x,x.y})
  if not(e and close(e.position.x,x.x) and close(e.position.y,x.y)) then bad('missing '..x.name..' '..x.x..','..x.y) else
   found[#found+1]=e
   if x.direction and e.direction~=x.direction then bad('direction '..x.name..' '..x.x..','..x.y) end
   if x.recipe then local rc=e.get_recipe() if not rc or rc.name~=x.recipe then bad('recipe '..x.name..' '..x.x..','..x.y) end end
   if x.name=='fast-inserter' then
    if e.inserter_stack_size_override~=1 then bad('stack override '..x.x..','..x.y) end
    if x.filter then local fi=e.get_filter(1) if not(e.use_filters and fi and fi.name==x.filter) then bad('filter '..x.x..','..x.y) end elseif e.use_filters then bad('unexpected filter '..x.x..','..x.y) end
    local cb=e.get_control_behavior()
    if x.cond then
     local c=cb and cb.circuit_condition
     if not(cb and cb.circuit_enable_disable and c and signalName(c.first_signal)==x.cond.signal and c.comparator==x.cond.comparator and c.constant==x.cond.constant) then bad('condition '..x.x..','..x.y) end
     local red=e.get_circuit_network(defines.wire_connector_id.circuit_red)
     if x.cond.network=='hub' and not(red and hubRed and red.network_id==hubRed.network_id) then bad('arm not on the hub network '..x.x..','..x.y) end
     if x.cond.network=='gate' and not(red and hubRed and red.network_id~=hubRed.network_id) then bad('gate arm network '..x.x..','..x.y) end
    elseif cb and cb.circuit_enable_disable then bad('unexpected condition '..x.x..','..x.y) end
   end
   if x.name=='asteroid-collector' then local cb=e.get_control_behavior() if not(cb and cb.set_filter) then bad('collector filters by circuit '..x.x..','..x.y) end end
   if x.name=='decider-combinator' then local cb=e.get_control_behavior() local pr=cb and cb.parameters
    if not(pr and #pr.conditions==x.conditions and #pr.outputs==#x.outputs) then bad('decider '..x.x..','..x.y) else
     for i,o in ipairs(pr.outputs) do local sg=o.signal if not(sg and ((sg.type or 'item')..':'..sg.name)==x.outputs[i]) then bad('decider output '..x.x..','..x.y) end end
     for i,c in ipairs(pr.conditions) do if c.constant~=x.conditionConstants[i] then bad('decider constant '..x.x..','..x.y) end end
    end
   end
   if x.setRecipe then local cb=e.get_control_behavior()
    if not(cb and cb.circuit_set_recipe) then bad('crusher set recipe '..x.x..','..x.y) end
    -- the recipe network: not the hub's red network and no green wire (item signals could select a recipe)
    local red=e.get_circuit_network(defines.wire_connector_id.circuit_red) local green=e.get_circuit_network(defines.wire_connector_id.circuit_green)
    if not(red and hubRed and red.network_id~=hubRed.network_id) or green then bad('crusher recipe network '..x.x..','..x.y) end
   end
   if x.name=='constant-combinator' then constantGreen=e.get_circuit_network(defines.wire_connector_id.circuit_green)
    local cb=e.get_control_behavior() local sec=cb and cb.get_section(1) local got={} local n=0
    if sec then for _,fi in pairs(sec.filters) do if fi.value then got[(fi.value.type or 'item')..':'..fi.value.name]=fi.min n=n+1 end end end
    local want=0 for k,v in pairs(x.signals) do want=want+1 if got[k]~=v then bad('constant '..k) end end
    if n~=want then bad('constant signal count') end
   end
   if x.name=='arithmetic-combinator' then local cb=e.get_control_behavior() local pr=cb and cb.parameters local a=x.arithmetic
    if not(pr and pr.operation==a.operation and pr.second_constant==a.secondConstant and pr.first_signal and pr.first_signal.name==a.first and pr.output_signal and pr.output_signal.name==a.output) then bad('arithmetic '..x.x..','..x.y) end
   end
   if x.readsCharge then local cb=e.get_control_behavior()
    if not(cb and cb.read_charge and cb.output_signal and cb.output_signal.name==x.readsCharge) then bad('accumulator charge reading '..x.x..','..x.y) end
    storage.chargeReader=e
   end
   if x.role then storage.byRole[x.role]=storage.byRole[x.role] or {} table.insert(storage.byRole[x.role],e) end
  end
 end
 if storage.chargeReader then local g=storage.chargeReader.get_circuit_network(defines.wire_connector_id.circuit_green) if not(g and constantGreen and g.network_id==constantGreen.network_id) then bad('charge reader not on the collection network') end end
 for _,c in ipairs(s.find_entities_filtered{name='asteroid-collector',force=f}) do local g=c.get_circuit_network(defines.wire_connector_id.circuit_green) if not(g and constantGreen and g.network_id==constantGreen.network_id) then bad('collector not on the collection network') end end
 b.entitiesFound=#found
 b.playerEntities=s.count_entities_filtered{force=f}
 b.foundationTiles=s.count_tiles_filtered{name='space-platform-foundation'}
 b.hubAfterBuild=contents(inv)
 local leftover={} for name,_ in pairs(P.platform.platformRequest) do local c=inv.get_item_count(name) if c>0 then leftover[name]=c end end
 b.leftoverConstructionItems=leftover
 b.requestMissing=hub.request_missing_construction_materials
 local hcb=hub.get_control_behavior() b.hubReadContents=hcb and hcb.read_contents or false
 b.ok=#b.mismatches==0 and #found==#P.platform.expected and b.playerEntities==#P.platform.expected+1 and b.foundationTiles==P.platform.foundationTiles and next(leftover)==nil and b.requestMissing==true and b.hubReadContents==true
 r.build=b
 storage.machines=s.find_entities_filtered{type={'assembling-machine','furnace'},force=f}
 storage.accs=s.find_entities_filtered{name='accumulator',force=f}
 storage.collectors=s.find_entities_filtered{name='asteroid-collector',force=f}
 storage.collectorArms={} for i,c in ipairs(storage.collectors) do
  for _,a in ipairs(storage.byRole.collector or {}) do if a.pickup_target==c then storage.collectorArms[i]=a end end
 end
 storage.collectorLast={} storage.collectorDelivered={} storage.collectorHeld={} for i=1,#storage.collectors do storage.collectorLast[i]=0 storage.collectorDelivered[i]=0 storage.collectorHeld[i]=false end
end

local tracked={PACK,'iron-ore','carbon','ice','iron-plate','metallic-asteroid-chunk','carbonic-asteroid-chunk','oxide-asteroid-chunk'}
local function snapshot(r,name)
 local p=storage.p local s=p.surface local f=p.force local st=f.get_item_production_statistics(s)
 local e={tick=game.tick,t=game.tick-storage.built,collected=storage.collected,made=st.get_input_count(PACK),madeIce=st.get_input_count('ice'),madeOre=st.get_input_count('iron-ore'),madeCarbon=st.get_input_count('carbon'),madePlate=st.get_input_count('iron-plate'),hub=contents(hubInv()),freeSlots=hubInv().count_empty_stacks(),chest=storage.recv.chest.get_item_count(PACK),pad=storage.recv.pad.get_item_count(PACK),pods=storage.pods,machines={},collectorDelivered={}}
 for i,m in ipairs(storage.machines) do e.machines[i]={name=m.name,x=m.position.x,y=m.position.y,finished=m.products_finished} end
 for i,v in ipairs(storage.collectorDelivered) do e.collectorDelivered[i]=v end
 -- Platform entities: every player-force entity except cargo pods in flight (a pod leaving the hub is briefly an
 -- entity on the platform surface). Anything else that is not a blueprint entity is named.
 local damaged=0 local count=0 local pods=0 local other={}
 for _,x in pairs(s.find_entities_filtered{force=f}) do
  if x.type=='cargo-pod' then pods=pods+1 else count=count+1
   if not storage.expectedNames[x.name] then other[x.name]=(other[x.name] or 0)+1 end
   if x.health and x.max_health and x.health<x.max_health then damaged=damaged+1 end end
 end
 e.playerEntities=count e.cargoPodsOnPlatform=pods e.unexpectedEntities=other
 e.damagedEntities=damaged e.damagedTiles=#p.damaged_tiles e.asteroids=s.count_entities_filtered{type='asteroid'} e.chunksAfloat=#p.find_asteroid_chunks_filtered{}
 storage.r.marks[name]=e write()
end

local function startEndToEnd(r)
 local f=setupForce(r)
 createPlatform(r,f)
 buildReceiver(r,f)
 storage.collected=0 storage.pods=0 r.pods={} r.series={} r.marks={}
 storage.expectedNames={['space-platform-hub']=true} for _,x in ipairs(P.platform.expected) do storage.expectedNames[x.name]=true end
 r.feedPolicy='One inventory write: billOfMaterials.platformRequest inserted into the hub at tick 0 (standing for the cargo rockets). No chunk spawned, no other inventory, belt or fluid box written. Packs leave the hub only by the game\'s own cargo pods to the receiver pad; the harness removes space science packs only from the receiver chest, once per second, never during the blocked phase.'
 write()
end

-- ---------- rocket-delivery check ----------
local function startRockets(r)
 local f=setupForce(r)
 local n=nauvisGround(3)
 r.launches={} r.events={} r.notes={}
 local silo=n.create_entity{name='rocket-silo',position={0,0},force=f}
 n.create_entity{name='substation',position={8,8},force=f} n.create_entity{name='substation',position={8,-6},force=f}
 local eei=n.create_entity{name='electric-energy-interface',position={11,9},force=f}
 eei.electric_buffer_size=1e10 eei.power_production=1e10 eei.power_usage=0
 local port=n.create_entity{name='roboport',position={12,0},force=f}
 port.insert{name='logistic-robot',count=50}
 storage.silo=silo
 r.siloAutomaticRequestsDefault=silo.use_transitional_requests
 silo.use_transitional_requests=true -- the one click the player makes ("automatic requests from space platforms")
 local kit={} for k,v in pairs(P.platform.platformRequest) do kit[k]=v end kit['space-platform-starter-pack']=1
 r.kit=kit storage.kitChests={}
 local cx,cy=16,-8
 for name,count in pairs(kit) do local left=count
  while left>0 do local c=n.create_entity{name='passive-provider-chest',position={cx+0.5,cy+0.5},force=f} local put=c.insert{name=name,count=left} left=left-put storage.kitChests[#storage.kitChests+1]=c cy=cy+1 if cy>8 then cy=-8 cx=cx+1 end end
 end
 local p=f.create_space_platform{name='white',planet='nauvis',starter_pack='space-platform-starter-pack'}
 storage.p=p r.stateAfterCreate=p.state
 r.feedPolicy='Kit chests hold exactly one starter pack and billOfMaterials.platformRequest; the silo\'s automatic requests are switched on (the player\'s one click); the harness keeps 20 each of processing units, low density structures and rocket fuel in the silo input (declared: this check is about cargo, not part supply) and writes nothing else.'
 write()
end

script.on_init(function()
 local r={failures={},mode=P.mode} storage.r=r
 if P.mode=='rockets' then startRockets(r) else startEndToEnd(r) end
end)

script.on_event(defines.events.on_cargo_pod_finished_descending,function(ev)
 local r=storage.r if P.mode~='endtoend' then return end
 local pod=ev.cargo_pod if not(pod and pod.valid and pod.surface.name=='nauvis') then return end
 storage.pods=(storage.pods or 0)+1
 if not storage.firstPod then storage.firstPod=ev.tick end
 if #r.pods<100 then r.pods[#r.pods+1]={tick=ev.tick,cargo=contents(pod.get_inventory(defines.inventory.cargo_unit))} end
end)

script.on_event(defines.events.on_rocket_launch_ordered,function(ev)
 local r=storage.r if P.mode~='rockets' then return end
 local pod=ev.rocket and ev.rocket.valid and ev.rocket.attached_cargo_pod
 local cargo=pod and pod.valid and contents(pod.get_inventory(defines.inventory.cargo_unit)) or {}
 local w=0 for name,c in pairs(cargo) do w=w+prototypes.item[name].weight*c end
 r.launches[#r.launches+1]={tick=ev.tick,cargo=cargo,weightKg=w/1000}
 write()
end)

local function rocketsTick()
 local tick=game.tick local r=storage.r local p=storage.p local silo=storage.silo
 if r.finished then return end
 if tick%30==0 then local inp=silo.get_inventory(defines.inventory.crafter_input) for _,nme in ipairs{'processing-unit','low-density-structure','rocket-fuel'} do if inp.get_item_count(nme)<20 then inp.insert{name=nme,count=20-inp.get_item_count(nme)} end end end
 if tick%60~=0 then return end
 if p.valid and p.hub and not storage.ghosted then
  storage.ghosted=tick r.hubTick=tick
  r.hubAtArrival=contents(p.hub.get_inventory(defines.inventory.hub_main))
  local bp=game.create_inventory(1) bp[1].set_stack{name='blueprint'} bp[1].import_stack(P.platform.code)
  local ghosts=bp[1].build_blueprint{surface=p.surface,force=p.force,position={0,0},build_mode=defines.build_mode.forced}
  r.ghosts=#ghosts bp.destroy()
  r.requestMissingAfterPaste=p.hub.request_missing_construction_materials
 end
 if storage.ghosted then
  local s=p.surface local tg=s.count_entities_filtered{type='tile-ghost'} local eg=s.count_entities_filtered{type='entity-ghost'}
  if tick%3600==0 then r.notes[#r.notes+1]={minute=tick/3600,tileGhosts=tg,entityGhosts=eg,launches=#r.launches} write() end
  if tg==0 and eg==0 then
   r.builtTick=tick r.builtMinutes=tick/3600 r.hubAfterBuild=contents(p.hub.get_inventory(defines.inventory.hub_main))
   local left={} for _,c in ipairs(storage.kitChests) do for k,v in pairs(contents(c.get_inventory(defines.inventory.chest))) do left[k]=(left[k] or 0)+v end end
   r.leftInChests=left r.finished=true write() return
  end
 end
 if tick>=P.ticks.rocketLimit then r.timedOut=true r.finished=true
  if p.valid and p.surface then r.ghostsLeft={tile=p.surface.count_entities_filtered{type='tile-ghost'},entity=p.surface.count_entities_filtered{type='entity-ghost'}} end
  write() end
end

local LOW=defines.entity_status.low_power
local function endToEndTick()
 local tick=game.tick local r=storage.r local p=storage.p
 if r.finished then return end
 if tick==120 then receiverPowerCheck(r) end
 if not storage.built then
  if tick%60==0 then
   local s=p.surface
   if s.count_entities_filtered{type='tile-ghost'}==0 and s.count_entities_filtered{type='entity-ghost'}==0 then
    storage.built=tick checkBuilt(r) r.builtTick=tick
    storage.lowPower=0 storage.lowPowerFirst=nil storage.peakKw=0 storage.sumKw=0 storage.nKw=0 storage.max={} storage.minFree=1e9 storage.chestMaxBlocked=0
    storage.asteroidsSeen=0
    snapshot(r,'built')
   elseif tick>=P.ticks.buildLimit then r.buildFailed=true r.finished=true
    r.stuck={} for _,g in pairs(s.find_entities_filtered{type={'entity-ghost','tile-ghost'},limit=40}) do r.stuck[#r.stuck+1]={g.ghost_name,g.position.x,g.position.y} end
    r.hubAtFailure=contents(hubInv()) write()
   end
  end
  return
 end
 local t=tick-storage.built local T=P.ticks
 local W=T.warmup local M=W+T.measure local B=M+T.blocked local R=B+T.recovery
 -- every tick: low-power status over the cached crafting machines; lowest accumulator charge after 10 minutes
 for _,m in ipairs(storage.machines) do if m.status==LOW then storage.lowPower=storage.lowPower+1 if not storage.lowPowerFirst then storage.lowPowerFirst=t end end end
 if t>36000 then for _,a in ipairs(storage.accs) do if not storage.accMin or a.energy<storage.accMin then storage.accMin=a.energy end end end
 if t%60~=0 then return end
 local blocked=t>M and t<=B
 local chest=storage.recv.chest
 if not blocked then local got=chest.remove_item{name=PACK,count=100000} storage.collected=storage.collected+got
 else local c=chest.get_item_count(PACK) if c>storage.chestMaxBlocked then storage.chestMaxBlocked=c end end
 local c=contents(hubInv())
 for _,n in ipairs(tracked) do local v=c[n] or 0 if v>(storage.max[n] or 0) then storage.max[n]=v end end
 local free=hubInv().count_empty_stacks() if free<storage.minFree then storage.minFree=free end
 -- power: one-second average demand from the surface's global electric network statistics
 local stats=p.surface.global_electric_network_statistics local total=0 for _,v in pairs(stats.input_counts) do total=total+v end
 if storage.lastIn then local kw=(total-storage.lastIn)/1000 if kw>storage.peakKw then storage.peakKw=kw end storage.sumKw=storage.sumKw+kw storage.nKw=storage.nKw+1 end
 storage.lastIn=total
 for i,col in ipairs(storage.collectors) do
  local n=col.get_inventory(defines.inventory.asteroid_collector_output).get_item_count() if n>storage.collectorLast[i] then storage.collectorDelivered[i]=storage.collectorDelivered[i]+n-storage.collectorLast[i] end storage.collectorLast[i]=n
  -- a chunk taken from the collector between two samples still shows as a new chunk in its arm's hand
  local a=storage.collectorArms[i] local held=a and a.held_stack.valid_for_read or false
  if held and not storage.collectorHeld[i] then storage.collectorDelivered[i]=storage.collectorDelivered[i]+1 end storage.collectorHeld[i]=held
 end
 if t%3600==0 then
  local st=p.force.get_item_production_statistics(p.surface)
  local ast=p.surface.count_entities_filtered{type='asteroid'} if ast>storage.asteroidsSeen then storage.asteroidsSeen=ast end
  r.series[#r.series+1]={m=t/3600,collected=storage.collected,made=st.get_input_count(PACK),chest=chest.get_item_count(PACK),pad=storage.recv.pad.get_item_count(PACK),hub=c[PACK] or 0,ore=c['iron-ore'] or 0,plate=c['iron-plate'] or 0,carbon=c.carbon or 0,ice=c.ice or 0,mc=c['metallic-asteroid-chunk'] or 0,cc=c['carbonic-asteroid-chunk'] or 0,oc=c['oxide-asteroid-chunk'] or 0,free=free,pods=storage.pods,lowPower=storage.lowPower,avgKw=storage.nKw>0 and storage.sumKw/storage.nKw or 0}
 end
 if t==W then snapshot(r,'warm') end
 if t==M then snapshot(r,'measured') end
 if t==B-T.hold then snapshot(r,'holdStart') end
 if t==B then snapshot(r,'blocked') end
 if t==R-T.recoveryMeasured then snapshot(r,'recoveryMeasureStart') end
 if t==R then
  snapshot(r,'recovered')
  r.power={lowPowerTicks=storage.lowPower,firstLowPowerTick=storage.lowPowerFirst,averageKw=storage.nKw>0 and storage.sumKw/storage.nKw or 0,peakKw=storage.peakKw,lowestAccumulatorMJ=storage.accMin and storage.accMin/1e6 or nil,accumulators=#storage.accs}
  r.stocks={maximum=storage.max,lowestFreeSlots=storage.minFree,chestMaxDuringBlocked=storage.chestMaxBlocked}
  r.asteroidsSeen=storage.asteroidsSeen r.firstPodTick=storage.firstPod
  r.finished=true write()
 end
end

script.on_event(defines.events.on_tick,function()
 if P.mode=='rockets' then rocketsTick() else endToEndTick() end
end)
