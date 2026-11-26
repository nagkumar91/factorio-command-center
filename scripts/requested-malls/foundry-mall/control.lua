-- Native harness of the foundry mall. Imports the exact blueprint on a Vulcanus surface and never repairs it.
-- Runs only in the validator's private save. Supply: the declared entrances only (lava, calcite, water, lubricant,
-- sulfuric acid, plastic, tungsten carbide; a mall of the family may declare others), a sink on the stone exit and
-- outside power. An entrance is named by its key: the item, or the port's own key where one item has two entrances.
-- The run is a list of phases (T.phases), each with: mode ('until_caps' with a tick limit, or 'ticks'), the inputs
-- withheld, what is collected (at the start, every second, or one item), optional cap edits and what is measured.
local T = require('fixture')
local M = T.manifest
local PER_MINUTE = 3600
local RED, GREEN = defines.wire_connector_id.circuit_red, defines.wire_connector_id.circuit_green
local CONNECTOR = {[1]=defines.wire_connector_id.circuit_red, [2]=defines.wire_connector_id.circuit_green, [3]=defines.wire_connector_id.combinator_output_red, [4]=defines.wire_connector_id.combinator_output_green}
local COMBINATOR = {['decider-combinator']=true, ['arithmetic-combinator']=true, ['selector-combinator']=true}
local INPUTS, ITEM_INPUTS, FLUID_INPUTS, INPUT_ITEM = {}, {}, {}, {}
for _, port in ipairs(M.ports) do if not port.exit then
  local key = port.key or port.item
  INPUTS[#INPUTS + 1] = key INPUT_ITEM[key] = port.item
  if port.kind == 'fluid' then FLUID_INPUTS[#FLUID_INPUTS + 1] = key else ITEM_INPUTS[#ITEM_INPUTS + 1] = key end
end end

local function fail(message) error('FOUNDRY_MALL: ' .. message) end
local function record(t, name, passed, detail)
  t.checks[#t.checks + 1] = {name=name, passed=not not passed, detail=detail}
  if not passed then t.failures[#t.failures + 1] = name end
end
local STATUS = {} for n, v in pairs(defines.entity_status) do STATUS[v] = n end
local function status_name(e) return STATUS[e.status] or tostring(e.status) end
local function connector_of(e, id)
  if COMBINATOR[e.name] then
    if id == 1 then return defines.wire_connector_id.combinator_input_red elseif id == 2 then return defines.wire_connector_id.combinator_input_green end
  end
  return CONNECTOR[id]
end
local function network(e, id) return e.get_circuit_network(connector_of(e, id)) end
local function signal_value(net, kind, name)
  if not net then return 0 end
  return net.get_signal({type=kind, name=name}) or 0
end
local function stock(t)
  local counts = {}
  -- one count per stock, each in its own chest (fast inserters are two stocks: the kit chest's and the inserter chest's)
  for _, s in ipairs(M.stock) do counts[s.key] = t.entities[s.chest].get_item_count(s.item) end
  return counts
end
local function foreign(t)
  for _, o in ipairs(M.outputs) do
    local allowed = {} for _, name in ipairs(o.items) do allowed[name] = true end
    for _, s in pairs(t.entities[o.chest].get_inventory(defines.inventory.chest).get_contents()) do if not allowed[s.name] then return o.id .. ':' .. s.name end end
  end
end
local function collect(t, only)
  local taken = {}
  for _, s in ipairs(M.stock) do if not only or only[s.key] then
    local chest = t.entities[s.chest]
    local n = chest.get_item_count(s.item)
    if n > 0 then chest.remove_item{name=s.item, count=n} taken[s.key] = n end
  end end
  return taken
end
local function set_cap(t, name, value)
  local section = t.entities[M.capsCombinator.entity].get_control_behavior().get_section(1)
  for i = 1, section.filters_count do
    local slot = section.get_slot(i)
    if slot.value and slot.value.name == M.capSignals[name] then section.set_slot(i, {value=slot.value, min=value}) t.caps[name] = value return true end
  end
  return false
end
local function at_caps(t, counts, skip)
  for name, cap in pairs(t.caps) do if not (skip and skip[name]) and counts[name] < cap then return false end end
  return true
end
local function ring_signals(t)
  local net = t.entities[M.ring.reader].get_circuit_network(RED)
  return net and net.signals or {}
end
local SIGNAL_L = {type='virtual', name='signal-L'}
local function level(t) return t.levelEntity.get_signal(SIGNAL_L, GREEN) end
local function machine_key(m) return m.role .. '#' .. m.entity end

-- Fluid watch: one reading per fluid segment of the blueprint's pipes and tanks, and one per pump, every tick.
-- A segment holds one fluid, so one member speaks for all of it. The list is rebuilt whenever the piping changes.
local construct, matrix_begin, matrix_step, after_build, register, set_power, place_key
local function build_fluid_watch(t)
  local watch, seen = {}, {}
  for fluid, ids in pairs(M.fluids) do for _, id in ipairs(ids) do
    local e = t.entities[id]
    if e and e.valid then for i = 1, e.fluids_count do
      local segment = e.has_fluid_segment(i)
      local key = segment and ('s' .. e.get_fluid_segment_id(i)) or ('e' .. id .. ':' .. i)
      if not seen[key] then seen[key] = true watch[#watch + 1] = {entity=e, id=id, index=i, expected=fluid, segment=segment} end
    end end
  end end
  t.watch = watch
  local fluidOf, numberOf = {}, {}
  for fluid, ids in pairs(M.fluids) do for _, id in ipairs(ids) do local e = t.entities[id] if e and e.valid then fluidOf[e.unit_number] = fluid numberOf[e.unit_number] = id end end end
  t.fluidOf, t.numberOf = fluidOf, numberOf
end
local function switching_recipes(t)
  local out = {}
  for _, s in ipairs(t.switching or {}) do if s.entity.valid then local r = s.entity.get_recipe() out[s.role] = r and r.name or 'none' end end
  return out
end
local function check_fluids(t, tick)
  for _, w in ipairs(t.watch) do
    local e = w.entity
    if e.valid then
      local f = w.segment and e.get_fluid_segment_fluid(w.index) or e.get_fluid(w.index)
      if f and f.name ~= w.expected then
        local key = w.expected .. ' network holds ' .. f.name
        local fault = t.fluidFaultIndex[key]
        if not fault then
          fault = {entity=w.id, expected=w.expected, found=f.name, tick=tick, amount=f.amount, phase=t.current and t.current.spec.name or (t.building and 'construction' or 'before the first phase'), recipes=switching_recipes(t), ticks=0, peak=0, lavaFoundries={}, networks={}}
          -- what the two lava foundries were doing and how full every network was at that moment
          for _, m in ipairs(M.machines) do if m.role:find('^molten') and t.entities[m.entity] then fault.lavaFoundries[m.role] = status_name(t.entities[m.entity]) end end
          for _, v in ipairs(t.watch) do if v.segment and v.entity.valid then local sf = v.entity.get_fluid_segment_fluid(v.index) fault.networks[v.expected .. ' #' .. v.id] = {holds=sf and sf.name or 'nothing', amount=sf and math.floor(sf.amount) or 0, capacity=v.entity.get_fluid_segment_capacity(v.index)} end end
          t.fluidFaultIndex[key] = fault t.fluidFaults[#t.fluidFaults + 1] = fault
          log('FOUNDRY_MALL_FLUID ' .. helpers.table_to_json(fault))
        end
        fault.ticks = fault.ticks + 1 fault.lastTick = tick
        if f.amount > fault.peak then fault.peak = f.amount end
      end
    end
  end
end

local UNDIRECTED = {substation=true, ['storage-tank']=true, ['passive-provider-chest']=true, ['display-panel']=true, ['constant-combinator']=true, pipe=true, ['steel-chest']=true}

place_key = function(name, x, y) return string.format('%s@%.1f,%.1f', name, x, y) end
set_power = function(t, on)
  t.power.power_production = on and T.externalPowerWatts / 60 or 0
  t.power.electric_buffer_size = T.externalPowerWatts
  t.power.energy = on and T.externalPowerWatts or 0
  t.powerOn = on
end
-- An entity of the blueprint now stands (revived by the script, or built by a robot): remember it by its number.
register = function(t, e)
  local number = t.byPlace[place_key(e.name, e.position.x - t.offset.x, e.position.y - t.offset.y)]
  if type(number) ~= 'number' then return end
  t.entities[number] = e t.built = t.built + 1
  if number == M.power.entry then
    local a, b = t.externalPole.get_wire_connector(defines.wire_connector_id.pole_copper, true), e.get_wire_connector(defines.wire_connector_id.pole_copper, true)
    if not a.is_connected_to(b) then a.connect_to(b) end
    if not a.is_connected_to(b) then fail('external power wire') end
  end
  return number
end
-- Everything stands: the import checks, then the run may begin.
after_build = function(t)
  local surface, force, dx, dy = t.surface, t.force, t.offset.x, t.offset.y
  t.entities = {}
  local exact, missing = true, {}
  for _, spec in ipairs(T.entities) do
    local e = surface.find_entity(spec.name, {spec.position.x + dx, spec.position.y + dy})
    if not e then missing[#missing + 1] = spec.entity_number else
      t.entities[spec.entity_number] = e
      -- (a turned machine without fluid ports reports no direction)
      if e.direction ~= (spec.direction or 0) and not UNDIRECTED[spec.name] and not (T.place and (spec.name == 'electric-furnace' or (spec.name == 'assembling-machine-3' and e.fluids_count == 0))) then exact = false record(t, 'direction changed #' .. spec.entity_number .. ' ' .. spec.name, false, {want=spec.direction or 0, got=e.direction}) end
      if (spec.name == 'foundry' or spec.name == 'chemical-plant' or spec.name == 'oil-refinery') and e.mirroring ~= (spec.mirror == true) then exact = false record(t, 'mirroring changed #' .. spec.entity_number, false, {want=spec.mirror == true, got=e.mirroring}) end
      if spec.name == 'display-panel' and not (e.display_panel_always_show and e.display_panel_text == spec.text) then record(t, 'display panel text #' .. spec.entity_number, false) end
    end
  end
  record(t, 'every entity imported at its exact position and direction', exact and #missing == 0, {missing=missing})
  if #missing > 0 then fail('missing entities ' .. helpers.table_to_json(missing)) end
  local entry = t.entities[M.power.entry]
  local a, b = t.externalPole.get_wire_connector(defines.wire_connector_id.pole_copper, true), entry.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  if not a.is_connected_to(b) then a.connect_to(b) end
  if not a.is_connected_to(b) then fail('external power wire') end
  -- recipes and recipe control
  for _, m in ipairs(M.machines) do
    local e = t.entities[m.entity]
    if m.recipe then
      local r = e.get_recipe()
      record(t, 'recipe preserved ' .. machine_key(m), r and r.name == m.recipe, r and r.name)
    end
    if m.switching or m.shadow then
      local cb = e.get_control_behavior()
      record(t, 'recipe is set by circuit ' .. machine_key(m), cb and cb.circuit_set_recipe == true)
    end
    if e.type == 'assembling-machine' or e.type == 'furnace' then record(t, 'no modules ' .. machine_key(m), e.get_module_inventory().is_empty()) end
  end
  for name, expected in pairs(T.recipePrototypes) do
    local proto = prototypes.recipe[name]
    local ok = proto ~= nil
    if ok then
      local have = {} for _, v in pairs(proto.ingredients) do have[v.name] = v.amount end
      for _, v in pairs(expected.ingredients) do if have[v.name] ~= v.amount then ok = false end have[v.name] = nil end
      if next(have) then ok = false end
    end
    if not ok then record(t, 'runtime recipe matches the pinned snapshot ' .. name, false) end
  end
  record(t, 'runtime recipes compared with the pinned snapshot', true, {recipes=table_size(T.recipePrototypes)})
  -- arms: hand size, filters, conditions
  local armsOk, armFaults = true, {}
  for _, spec in ipairs(T.entities) do if spec.name:find('inserter') then
    local e = t.entities[spec.entity_number]
    local ok = e.inserter_stack_size_override == spec.override_stack_size
    if spec.filters then for i, f in ipairs(spec.filters) do local actual = e.get_filter(i) if not actual or actual.name ~= f.name then ok = false end end end
    if spec.filter_mode and e.inserter_filter_mode ~= spec.filter_mode then ok = false end
    local cb, want = e.get_control_behavior(), spec.control_behavior
    if want then
      if not cb then ok = false else
        if want.circuit_enabled then local c = cb.circuit_condition if not (cb.circuit_enable_disable and c and c.first_signal and c.first_signal.name == want.circuit_condition.first_signal.name and c.comparator == want.circuit_condition.comparator and c.constant == want.circuit_condition.constant) then ok = false end end
        if want.circuit_set_filters and not cb.circuit_set_filters then ok = false end
        if want.circuit_read_hand_contents and not cb.circuit_read_hand_contents then ok = false end
      end
    end
    if not ok then armsOk = false armFaults[#armFaults + 1] = spec.entity_number end
  end end
  record(t, 'every arm kept its hand size, filters, filter mode and circuit settings', armsOk, armFaults)
  -- combinators: parameters round-trip (compared as JSON of what the game reports for the same blueprint written back)
  local combinators = 0
  for _, spec in ipairs(T.entities) do if COMBINATOR[spec.name] then
    combinators = combinators + 1
    local cb = t.entities[spec.entity_number].get_control_behavior()
    if spec.name == 'decider-combinator' then
      local want = spec.control_behavior.decider_conditions
      local got = cb.parameters
      if #got.conditions ~= #want.conditions or #got.outputs ~= #want.outputs then record(t, 'decider conditions and outputs #' .. spec.entity_number, false, {conditions=#got.conditions, outputs=#got.outputs}) end
      for i, c in ipairs(want.conditions) do
        local g = got.conditions[i]
        if not (g.first_signal and g.first_signal.name == c.first_signal.name and g.comparator == c.comparator and (c.constant == nil or g.constant == c.constant) and (c.second_signal == nil or (g.second_signal and g.second_signal.name == c.second_signal.name)) and ((c.compare_type or 'or') == (g.compare_type or 'or'))) then record(t, 'decider condition ' .. i .. ' #' .. spec.entity_number, false, g) end
      end
      for i, o in ipairs(want.outputs) do
        local g = got.outputs[i]
        if not (g.signal.name == o.signal.name and g.copy_count_from_input == (o.copy_count_from_input ~= false) and (o.copy_count_from_input ~= false or (g.constant or 1) == o.constant)) then record(t, 'decider output ' .. i .. ' #' .. spec.entity_number, false, g) end
      end
    elseif spec.name == 'selector-combinator' then
      local g = cb.parameters
      if not (g.operation == 'select' and g.select_max == true and g.index_constant == 0) then record(t, 'selector parameters #' .. spec.entity_number, false, g) end
    else
      local g, w = cb.parameters, spec.control_behavior.arithmetic_conditions
      if not (g.operation == w.operation and g.first_signal.name == w.first_signal.name and g.output_signal.name == w.output_signal.name and (w.second_constant == nil or g.second_constant == w.second_constant)) then record(t, 'arithmetic parameters #' .. spec.entity_number, false, g) end
    end
  end end
  record(t, 'every combinator kept its parameters', true, {combinators=combinators})
  -- caps combinator
  local section = t.entities[M.capsCombinator.entity].get_control_behavior().get_section(1)
  local capsOk = true
  for name, cap in pairs(M.caps) do local found = false for i = 1, section.filters_count do local s = section.get_slot(i) if s.value and s.value.name == M.capSignals[name] and s.min == cap then found = true end end if not found then capsOk = false end end
  record(t, 'the caps combinator holds every cap', capsOk)
  -- chests
  record(t, 'exactly ' .. #M.outputs .. ' passive provider chests', #surface.find_entities_filtered{name='passive-provider-chest', force=force} == #M.outputs)
  if not t.construction then for _, o in ipairs(M.outputs) do record(t, 'cold empty provider ' .. o.id, t.entities[o.chest].get_inventory(defines.inventory.chest).is_empty()) end end
  -- what was made at the blueprint's own caps while it was being built is taken out before the scenario's caps are written
  if t.construction then t.construction.collected = collect(t) end
  -- the scenario's starting caps, written into the caps combinator exactly as a player would edit it
  for name, value in pairs(T.startCaps) do if not set_cap(t, name, value) then fail('no cap slot ' .. name) end end
  t.switching = {}
  -- the recipes each recipe-switching machine can be asked for: its rules and its parking recipe
  t.ruleRecipes, t.strays, t.strayIndex = {}, {}, {}
  for _, m in ipairs(M.machines) do if m.switching then t.ruleRecipes[m.role] = {none=true} end end
  for _, rule in ipairs(M.rules) do if t.ruleRecipes[rule.machine] then t.ruleRecipes[rule.machine][rule.recipe] = true end end
  for role, c in pairs(M.controllers) do t.ruleRecipes[role][c.idleRecipe] = true end
  for _, m in ipairs(M.machines) do if m.switching then t.switching[#t.switching + 1] = {role=m.role, entity=t.entities[m.entity]} end end
  t.gatedArms = {}
  for _, a in ipairs(M.arms) do if a.level then t.gatedArms[#t.gatedArms + 1] = {level=a.level, behavior=t.entities[a.entity].get_control_behavior()} end end
  t.levelEntity = t.entities[M.outputs[1].chest]
  build_fluid_watch(t)
  t.building = nil t.ready = true
end

script.on_init(function()
  if script.active_mods.base ~= T.gameVersion then fail('wrong game version') end
  -- The real planet surface, kept as small as the test needs: the game's per-tick cost grows with the number of
  -- generated chunks, so only the nine chunks around the blueprint are generated. Flat ground, nothing else on it.
  game.map_settings.pollution.enabled = false
  game.map_settings.enemy_expansion.enabled = false
  local surface = game.planets[M.surface].create_surface()
  surface.request_to_generate_chunks({0, 0}, 1) surface.force_generate_chunk_requests()
  for _, e in pairs(surface.find_entities()) do if e.valid then e.destroy() end end
  local tiles = {} for x = -32, 31 do for y = -32, 31 do tiles[#tiles + 1] = {name='volcanic-ash-flats', position={x, y}} end end
  surface.set_tiles(tiles)
  for _, e in pairs(surface.find_entities()) do if e.valid then e.destroy() end end
  surface.always_day = true
  -- keep the four chunks the blueprint and its fixtures stand on; delete every other chunk, here and on the unused default surface
  for c in surface.get_chunks() do if c.x < -1 or c.x > 0 or c.y < -1 or c.y > 0 then surface.delete_chunk({c.x, c.y}) end end
  for c in game.surfaces[1].get_chunks() do game.surfaces[1].delete_chunk({c.x, c.y}) end
  local chunks = 0 for _ in surface.get_chunks() do chunks = chunks + 1 end
  local force = game.create_force('foundry-mall-test')
  for _, name in ipairs(T.technologyClosure) do if not force.technologies[name] then fail('missing technology ' .. name) end force.technologies[name].researched = true end
  if T.bonus then force.inserter_stack_size_bonus = T.bonus.stack force.bulk_inserter_capacity_bonus = T.bonus.bulk end
  local t = {surface=surface, force=force, begin=game.tick, checks={}, failures={}, entities={}, fixtures={}, phases={}, phase=0, caps={}, accepted={}, stone=0, ringPeaks={}, ringPeakTotal=0, violations={}, fluidFaults={}, fluidFaultIndex={}, joins={}, joinIndex={}, samples={}, watch={}, fluidOf={}, numberOf={}, credit={}}
  for name, cap in pairs(M.caps) do t.caps[name] = cap end
  t.chunks = chunks t.pressure = surface.get_property('pressure')
  t.bonus = {stack=force.inserter_stack_size_bonus, bulk=force.bulk_inserter_capacity_bonus}
  local inventory = game.create_inventory(1)
  inventory[1].set_stack{name='blueprint'}
  if inventory[1].import_stack(T.blueprint) ~= 0 then fail('exact blueprint import') end
  -- T.entities, the ports and the power pole are given as they lie in the placement under test (the runner turns or
  -- mirrors them); the game itself turns the blueprint (build direction), a mirror image is its own string
  local ghosts = inventory[1].build_blueprint{surface=surface, force=force, position={0, 0}, build_mode=defines.build_mode.forced, direction=T.place and T.place.direction or defines.direction.north}
  record(t, 'every blueprint entity became a ghost', #ghosts == #T.entities, {ghosts=#ghosts, entities=#T.entities})
  inventory.destroy()
  -- offset: the brick furnace (the only electric furnace)
  local anchorSpec for _, spec in ipairs(T.entities) do if spec.name == 'electric-furnace' then anchorSpec = spec end end
  local anchor for _, g in pairs(ghosts) do if g.ghost_name == 'electric-furnace' then anchor = g end end
  if not anchor then fail('anchor ghost missing') end
  local dx, dy = anchor.position.x - anchorSpec.position.x, anchor.position.y - anchorSpec.position.y
  t.offset = {x=dx, y=dy}
  t.ghosts, t.byPlace, t.deferred, t.built = {}, {}, {}, 0
  for _, g in pairs(ghosts) do t.byPlace[place_key(g.ghost_name, g.position.x - dx, g.position.y - dy)] = g end
  local unplaced = {}
  for _, spec in ipairs(T.entities) do
    local key = place_key(spec.name, spec.position.x, spec.position.y)
    local g = t.byPlace[key]
    if g then t.ghosts[spec.entity_number] = g t.byPlace[key] = spec.entity_number else unplaced[#unplaced + 1] = spec.entity_number end
  end
  record(t, 'every ghost lies where the placement under test expects it', #unplaced == 0, unplaced)
  if #unplaced > 0 then fail('ghosts not where expected ' .. helpers.table_to_json(unplaced)) end
  -- fixtures: a pipe on every fluid entrance, a sink belt on the stone exit, outside power
  local function fixture(name, position, direction)
    local e = surface.create_entity{name=name, position={position.x + dx, position.y + dy}, force=force, direction=direction}
    if not e then fail('fixture placement ' .. name .. ' at ' .. position.x .. ',' .. position.y) end
    t.fixtures[#t.fixtures + 1] = e return e
  end
  t.ports = {}
  for _, port in ipairs(M.ports) do
    local entry = {id=port.id, item=port.item, kind=port.kind, entityId=port.entity}
    record(t, 'clear approach ' .. port.id, surface.can_place_entity{name=port.kind == 'fluid' and 'pipe' or 'fast-transport-belt', position={port.externalContact.x + dx, port.externalContact.y + dy}, force=force})
    if port.kind == 'fluid' then entry.pipe = fixture('pipe', port.externalContact)
    elseif port.exit then
      entry.sink = fixture('fast-transport-belt', port.externalContact, port.sinkDirection or defines.direction.west)
    end
    t.ports[port.key or port.item] = entry
    if port.exit then t.stoneSink = entry.sink end
  end
  t.externalPole = fixture('substation', M.power.externalPolePosition)
  t.power = fixture('electric-energy-interface', M.power.externalSourcePosition or {x=M.power.externalPolePosition.x - 3, y=M.power.externalPolePosition.y})
  set_power(t, true)
  storage.run = t
  if T.robots then
    -- real construction robots build the ghosts: a roboport outside the footprint, the parts in storage chests beside it
    local port = fixture('roboport', T.robots.roboport)
    port.insert{name='construction-robot', count=T.robots.count}
    local need = {} for _, spec in ipairs(T.entities) do need[spec.name] = (need[spec.name] or 0) + 1 end
    local chests = {} for _, pos in ipairs(T.robots.chests) do chests[#chests + 1] = fixture('storage-chest', pos) end
    local at = 1
    for name, count in pairs(need) do
      local left = count
      while left > 0 do
        local put = chests[at].insert{name=name, count=left}
        left = left - put
        if left > 0 then at = at + 1 if not chests[at] then fail('robot parts do not fit the storage chests') end end
      end
    end
    t.building = {mode='robots', limit=T.robots.limit, parts=need}
  elseif T.build then
    t.building = {mode='script', order=T.build.order, at=1, wait=0}
  else
    for _, ghost in pairs(ghosts) do local _, entity = ghost.revive{raise_revive=true} if not entity then fail('blueprint revival') end end
    after_build(t)
  end
end)


local function withheld(t, name) return t.current and t.current.withhold and t.current.withhold[name] end
local function throttle(t, name) return t.current and t.current.spec.thin and t.current.spec.thin[name] end
-- an entrance held to a figure a minute (the figure on its panel) for the phase
local function metered(t, name) return t.current and t.current.spec.supply and t.current.spec.supply[name] end
local function consumption(t)
  local items, fluids = t.force.get_item_production_statistics(t.surface), t.force.get_fluid_production_statistics(t.surface)
  local out = {}
  for _, name in ipairs(INPUTS) do
    if t.ports[name].kind == 'fluid' then out[name] = fluids.get_output_count(INPUT_ITEM[name]) else out[name] = items.get_output_count(INPUT_ITEM[name]) end
  end
  out['molten-iron'] = fluids.get_input_count('molten-iron') out['molten-copper'] = fluids.get_input_count('molten-copper')
  out['stone made'] = items.get_input_count('stone') out['stone used'] = items.get_output_count('stone')
  return out
end
local function crafts(t) local c = {} for _, m in ipairs(M.machines) do c[machine_key(m)] = t.entities[m.entity].products_finished end return c end

local function begin_phase(t, tick)
  t.phase = t.phase + 1
  local spec = T.phases[t.phase]
  if not spec then return false end
  local ph = {name=spec.name, mode=spec.mode, start=tick, reached={}, levelTicks={}, recipeTicks={}, switches={}, statusSamples={}, craftsByLevel={}, collected={}, withhold=spec.withhold, peak=0, gatedActive=0, groupCrafts={}}
  if spec.withhold then ph.withholdSet = {} for _, name in ipairs(spec.withhold) do ph.withholdSet[name] = true end end
  ph.supply = spec.supply
  t.current = {spec=spec, record=ph, withhold=ph.withholdSet, lastRecipe={}, lastCrafts=crafts(t)}
  if spec.collectItems then t.current.collectOnly = {} for _, n in ipairs(spec.collectItems) do t.current.collectOnly[n] = true end end
  if spec.except then t.current.skip = {} for _, n in ipairs(spec.except) do t.current.skip[n] = true end end
  set_power(t, not (ph.withholdSet and ph.withholdSet.power))
  if spec.stop then ph.stopped = spec.stop for _, m in ipairs(M.machines) do for _, role in ipairs(spec.stop) do if m.role == role then t.entities[m.entity].disabled_by_script = true end end end end
  -- what the flush button of a pipe does, for every pipe run that holds a fluid not its own (used to test the first-aid steps on an earlier string)
  if spec.flush then ph.flushed = {} for _, w in ipairs(t.watch) do if w.segment and w.entity.valid then local f = w.entity.get_fluid_segment_fluid(w.index) if f and f.name ~= w.expected then ph.flushed[#ph.flushed + 1] = {network=w.expected, held=f.name, amount=f.amount} w.entity.clear_fluid_segment_fluid(w.index) end end end end
  if spec.setCaps then for name, value in pairs(spec.setCaps) do if not set_cap(t, name, value) then record(t, 'cap edit found ' .. name, false) end end ph.setCaps = spec.setCaps end
  if spec.collectAtStart == true then ph.collectedAtStart = collect(t) elseif type(spec.collectAtStart) == 'table' then local only = {} for _, n in ipairs(spec.collectAtStart) do only[n] = true end ph.collectedAtStart = collect(t, only) end
  ph.stockAtStart = stock(t)
  ph.caps = {} for name, cap in pairs(t.caps) do ph.caps[name] = cap end
  ph.acceptedAtStart = {} for k, v in pairs(t.accepted) do ph.acceptedAtStart[k] = v end
  ph.consumedAtStart = consumption(t) ph.craftsAtStart = crafts(t) ph.stoneAtStart = t.stone
  t.phases[#t.phases + 1] = ph
  return true
end
local function end_phase(t, tick, why)
  local ph, spec = t.current.record, t.current.spec
  ph.finish = tick ph.ticks = tick - ph.start ph.endedBy = why
  if spec.stop then for _, m in ipairs(M.machines) do for _, role in ipairs(spec.stop) do if m.role == role then t.entities[m.entity].disabled_by_script = false end end end end
  ph.stock = stock(t)
  -- finished products that are not in a chest: on the ring, or made by a machine beyond its cap
  ph.ringAtEnd = {} for _, sg in pairs(ring_signals(t)) do ph.ringAtEnd[sg.signal.name] = sg.count end
  local minutes = ph.ticks / PER_MINUTE
  ph.accepted = {} for _, name in ipairs(INPUTS) do ph.accepted[name] = (t.accepted[name] or 0) - (ph.acceptedAtStart[name] or 0) end
  local now = consumption(t) ph.consumed = {} for k, v in pairs(now) do ph.consumed[k] = v - (ph.consumedAtStart[k] or 0) end
  ph.stoneOut = t.stone - ph.stoneAtStart
  ph.crafts = {} local c = crafts(t) for k, v in pairs(c) do ph.crafts[k] = v - ph.craftsAtStart[k] end
  ph.acceptedAtStart = nil ph.consumedAtStart = nil ph.craftsAtStart = nil ph.stoneAtStart = nil ph.withholdSet = nil
  if spec.measure and minutes > 0 then
    ph.perMinute = {consumed={}, collected={}, stoneOut=ph.stoneOut / minutes}
    for k, v in pairs(ph.consumed) do ph.perMinute.consumed[k] = v / minutes end
    for k, v in pairs(ph.collected) do ph.perMinute.collected[k] = v / minutes end
  end
  local label = spec.name
  if spec.expect == 'caps' then
    local all, over = true, false
    for name, cap in pairs(t.caps) do if ph.stock[name] < cap then all = false end if ph.stock[name] > cap then over = true end end
    record(t, label .. ': every product is at its cap', all, ph.stock)
    record(t, label .. ': no product is above its cap', not over)
  elseif spec.expect == 'caps_except' then
    local skip = {} for _, n in ipairs(spec.except) do skip[n] = true end
    local all, blocked = true, true
    for name, cap in pairs(t.caps) do
      if skip[name] then if ph.stock[name] >= cap then blocked = false end elseif ph.stock[name] < cap then all = false end
    end
    record(t, label .. ': every product that does not need the withheld input is at its cap', all, ph.stock)
    ph.dependentsBelowCap = blocked
    record(t, label .. ': no product that needs the withheld input reached its cap', blocked, ph.stock)
  end
  if spec.untouched then
    -- only the collected stock may have moved: every other count is what it was when the phase began
    local moved = {}
    for name, n in pairs(ph.stockAtStart) do if not (ph.collectedAtStart and ph.collectedAtStart[name]) and ph.stock[name] ~= n then moved[#moved + 1] = name end end
    record(t, label .. ': no other stock moved', #moved == 0, moved)
  end
  if spec.expect == 'never' then
  elseif spec.expect == 'nothing' then
    local none = true for _, n in pairs(ph.stock) do if n > 0 then none = false end end
    record(t, label .. ': nothing was made', none, ph.stock)
  elseif spec.expect == 'unchanged' then
    local same = true for name, n in pairs(ph.stockAtStart) do if ph.stock[name] ~= n then same = false end end
    record(t, label .. ': no chest changed', same, ph.stock)
    local finals = 0 for _, m in ipairs(M.machines) do if spec.quietRoles[m.role] then finals = finals + ph.crafts[machine_key(m)] end end
    ph.finalCrafts = finals
    record(t, label .. ': no final machine crafted', finals == 0, finals)
  elseif spec.expect == 'produced' then
    local any = false for name, n in pairs(ph.stock) do if n > (ph.stockAtStart[name] or 0) then any = true end end
    record(t, label .. ': production resumed', any, ph.stock)
  elseif spec.expect == 'rate' then
    local total = 0 for _, name in ipairs(spec.rateItems) do total = total + (ph.collected[name] or 0) end
    record(t, label .. ': the collected group kept being made', total > 0, ph.collected)
  end
  -- a product collected through the phase must have come at a rate inside its bounds (a minute)
  if spec.rateBounds then for name, bounds in pairs(spec.rateBounds) do
    local rate = (ph.collected[name] or 0) / minutes
    record(t, label .. ': ' .. name .. ' a minute between ' .. bounds.min .. ' and ' .. bounds.max, rate >= bounds.min and rate <= bounds.max, rate)
  end end
  record(t, label .. ': no chest holds a foreign item', foreign(t) == nil, foreign(t))
end

local function finish(t, tick)
  record(t, 'no chest ever held a foreign item', t.foreign == nil, t.foreign)
  record(t, 'no pipe, tank or pump ever held a foreign fluid (every fluid segment read every tick)', #t.fluidFaults == 0, {faults=t.fluidFaults, segmentsWatched=#t.watch})
  record(t, 'no fluid box of a machine was ever joined to the pipes of two fluids except through a pump (read every second)', #t.joins == 0, t.joins)
  if t.matrix then
    record(t, 'port matrix: all ' .. #T.matrix.cases .. ' cases ran and the foundry took the recipe asked for', #t.matrix.results == #T.matrix.cases and #t.matrix.unchanged == 0, {ran=#t.matrix.results, unchanged=t.matrix.unchanged})
    record(t, 'port matrix: no recipe change put a fluid into another network', #t.matrix.leaks == 0, t.matrix.leaks)
    record(t, 'port matrix: no fluid box of a recipe-switching foundry is joined to the pipes of two fluids', #t.matrix.joins == 0, t.matrix.joins)
  end
  if not T.matrix then record(t, 'no recipe-switching machine ever held a recipe none of its rules asks for (read every 10 ticks)', #t.strays == 0, t.strays) end
  record(t, 'the ring never held more than its lane-room bound', t.ringPeakTotal <= M.ring.bound, {peak=t.ringPeakTotal, bound=M.ring.bound})
  local gated = 0 for _, p in ipairs(t.phases) do gated = gated + p.gatedActive end
  record(t, 'no level-gated arm was enabled while a higher level was active', gated == 0, gated)
  local machines = {}
  for _, m in ipairs(M.machines) do local e = t.entities[m.entity] machines[#machines + 1] = {role=m.role, entity=m.entity, recipe=m.recipe, products=e.products_finished, status=status_name(e)} end
  local report = {schema=2, passed=#t.failures == 0, failures=t.failures, checks=t.checks, gameVersion=script.active_mods.base, activeMods=T.activeMods, surface=t.surface.name, surfaceChunks=t.chunks, pressure=t.pressure, blueprintSha256=T.blueprintSha256, prototypeSha256=T.prototypeSha256, configurationSha256=T.configurationSha256, nativeControlSha256=T.nativeControlSha256, actualTicks=tick, scenario=T.scenario, capsName=T.capsName, startCaps=T.startCaps, bonus=t.bonus, phases=t.phases, samples=t.samples, machines=machines, ringPeaks=t.ringPeaks, ringPeakTotal=t.ringPeakTotal, ringBound=M.ring.bound, boundaryAccepted=t.accepted, stoneOut=t.stone, construction=t.construction, placement=T.place, strayRecipes=t.strays, fluidFaults=t.fluidFaults, portJoins=t.joins, matrix=t.matrix and {cases=#T.matrix.cases, leaks=t.matrix.leaks, joins=t.matrix.joins, results=t.matrix.results} or nil, segmentsWatched=#t.watch, blueprintEntityCount=#T.entities, fixtureEntityCount=#t.fixtures, caps=t.caps}
  helpers.write_file('foundry-mall/native-report.json', helpers.table_to_json(report), false)
  log('FOUNDRY_MALL_RESULT ' .. helpers.table_to_json({passed=report.passed, failures=report.failures, ticks=tick}))
  -- the benchmark has a fixed length: empty the surface so the remaining ticks cost nothing
  for _, e in pairs(t.surface.find_entities()) do if e.valid then e.destroy() end end
  storage.run = {done=true}
end


-- Piecemeal construction. Script mode: the runner's order, one entity every few ticks (a negative entry is a pause of
-- that many ticks); an entity the game will not build yet is recorded and tried again. Robot mode: the game's own
-- construction robots. Supply and power are connected from the first tick, as they would be under a ghost blueprint.
construct = function(t, tick)
  local b = t.building
  if b.mode == 'script' then
    if b.wait > 0 then b.wait = b.wait - 1 return end
    if tick % T.build.stepTicks ~= 0 then return end
    local changed = false
    for _ = 1, T.build.perStep do
      local number = b.order[b.at]
      if not number then break end
      b.at = b.at + 1
      if number < 0 then b.wait = -number break end
      local g = t.ghosts[number]
      local _, e = g.revive{raise_revive=true}
      if e then register(t, e) changed = true
      else t.deferred[#t.deferred + 1] = {entity=number, tick=tick} b.order[#b.order + 1] = number if #t.deferred > 5000 then fail('an entity could never be built: #' .. number) end end
    end
    if changed then build_fluid_watch(t) end
    if not b.order[b.at] and b.wait == 0 then t.construction = {mode='script', order=T.build.name, ticks=tick, deferred=t.deferred} after_build(t) end
  else
    if tick % 30 ~= 0 then return end
    build_fluid_watch(t)
    local left = t.surface.count_entities_filtered{name='entity-ghost', force=t.force}
    if left == 0 then t.construction = {mode='robots', robots=T.robots.count, ticks=tick} after_build(t)
    elseif tick >= b.limit then
      local names = {} for _, g in pairs(t.surface.find_entities_filtered{name='entity-ghost', force=t.force, limit=12}) do names[#names + 1] = g.ghost_name .. '@' .. (g.position.x - t.offset.x) .. ',' .. (g.position.y - t.offset.y) end
      fail('robots did not finish the blueprint: ' .. left .. ' ghosts left, first ' .. helpers.table_to_json(names))
    end
  end
end
script.on_event(defines.events.on_robot_built_entity, function(event)
  local t = storage.run if not t or t.done or not t.building then return end
  if event.entity.valid then register(t, event.entity) end
end)

-- One fluid box of a machine joined to the pipes of two different fluids (a pump in between does not count: nothing
-- flows back through it). This is the opening: the box fills from one network and, when its recipe is taken away,
-- empties into whichever of the two will take it.
local function port_joins(t, m, into)
  local e = t.entities[m.entity]
  if not (e and e.valid) then return end
  for i = 1, e.fluids_count do
    local filter = e.get_fluid_filter(i)
    if filter then
      local first, firstId
      for _, c in ipairs(e.get_fluid_box_pipe_connections(i)) do
        local target = c.target
        if target and target.type ~= 'pump' then
          local other = t.fluidOf[target.unit_number]
          if other and not first then first, firstId = other, t.numberOf[target.unit_number]
          elseif other and other ~= first then
            local r = e.get_recipe()
            into[#into + 1] = {machine=m.role, entity=m.entity, recipe=r and r.name or 'none', box=filter.name, joinedTo=other == filter.name and first or other, neighbour=other == filter.name and firstId or t.numberOf[target.unit_number]}
          end
        end
      end
    end
  end
end

-- Port matrix. Every recipe change a recipe-switching foundry can make, with each of the networks on its ports full
-- or empty, on the imported blueprint. The recipe is asked for the way the mall asks: by a recipe signal on the
-- foundry's red wire. For the matrix that wire is taken off the mall's selector and put on a test combinator, so the
-- test decides the recipe (a recipe set by a script call discards the leftover fluid; the circuit path pushes it back
-- out, and that is the path a player gets). After each change every fluid segment is read every tick; then
-- everything is emptied for the next case.
matrix_begin = function(t)
  t.matrix = {at=0, results={}, leaks={}, joins={}, joinIndex={}, unchanged={}}
  t.byRole = {}
  for _, m in ipairs(M.machines) do t.byRole[m.role] = m end
  t.matrix.drivers = {}
  local at = 0
  for _, m in ipairs(M.machines) do if T.matrix.machines[m.role] then
    local e = t.entities[m.entity]
    local wire = e.get_wire_connector(RED, true)
    wire.disconnect_all()
    at = at + 1
    local driver = t.surface.create_entity{name='constant-combinator', position={T.matrix.drivers.x + t.offset.x, T.matrix.drivers.y + at + t.offset.y}, force=t.force}
    if not driver then fail('matrix driver placement') end
    t.fixtures[#t.fixtures + 1] = driver
    driver.get_wire_connector(RED, true).connect_to(wire, false)
    t.matrix.drivers[m.role] = driver
  end end
end
local function ask(t, role, recipe)
  local section = t.matrix.drivers[role].get_or_create_control_behavior().get_section(1)
  section.set_slot(1, {value={type='recipe', name=recipe, quality='normal'}, min=1})
end
local function set_network(t, fluid, full)
  for _, w in ipairs(t.watch) do if w.expected == fluid and w.entity.valid then
    local e = w.entity
    if w.segment then
      e.clear_fluid_segment_fluid(w.index)
      if full then e.set_fluid_segment_fluid(w.index, {name=fluid, amount=e.get_fluid_segment_capacity(w.index), temperature=T.fluidTemperature[fluid]}) end
    else
      e.clear_fluid(w.index)
      if full then e.set_fluid(w.index, {name=fluid, amount=e.get_fluid_capacity(w.index), temperature=T.fluidTemperature[fluid]}) end
    end
  end end
end
local function empty_machine(e)
  e.clear_fluids()
  for _, id in ipairs{defines.inventory.crafter_input, defines.inventory.crafter_output, defines.inventory.assembling_machine_dump} do local inv = e.get_inventory(id) if inv then inv.clear() end end
end
matrix_step = function(t, tick)
  local x = t.matrix
  local step = (tick - x.start0) % T.matrix.caseTicks
  if not x.case or step == 0 then
    if x.case then
      local was = t.entities[t.byRole[x.case.machine].entity].get_recipe()
      x.results[#x.results + 1] = {machine=x.case.machine, from=x.case.from, to=x.case.to, state=x.case.state, foreign=x.found, held=x.held, changed=was ~= nil and was.name == x.case.to}
      if #x.found > 0 then x.leaks[#x.leaks + 1] = x.results[#x.results] end
      if not (was and was.name == x.case.to) then x.unchanged[#x.unchanged + 1] = x.results[#x.results] end
    end
    x.at = x.at + 1
    x.case = T.matrix.cases[x.at]
    if not x.case then t.matrix.done = true x.case = nil return end
    x.found, x.foundIndex = {}, {}
    if T.matrix.fluids then for _, fluid in ipairs(T.matrix.fluids) do set_network(t, fluid, false) end
    else for fluid in pairs(M.fluids) do if fluid ~= 'lava' and fluid ~= 'sulfuric-acid' then set_network(t, fluid, false) end end end
    for _, m in ipairs(M.machines) do if m.switching or m.role:find('^molten') then empty_machine(t.entities[m.entity]) end end
    ask(t, x.case.machine, x.case.from)
    for fluid, full in pairs(x.case.state) do set_network(t, fluid, full) end
    return
  end
  local e = t.entities[t.byRole[x.case.machine].entity]
  for _, id in ipairs{defines.inventory.crafter_output, defines.inventory.assembling_machine_dump} do local inv = e.get_inventory(id) if inv then inv.clear() end end
  if step == 30 then
    for fluid, full in pairs(x.case.state) do set_network(t, fluid, full) end
    x.held = e.get_fluid_contents()
  elseif step == 39 or step == T.matrix.caseTicks - 2 then
    local joins = {} port_joins(t, t.byRole[x.case.machine], joins)
    for _, j in ipairs(joins) do local key = j.machine .. '|' .. j.recipe .. '|' .. j.box .. '|' .. j.joinedTo if not x.joinIndex[key] then x.joinIndex[key] = true x.joins[#x.joins + 1] = j end end
  elseif step == 40 then
    ask(t, x.case.machine, x.case.to)
  end
  if step > 0 then for _, w in ipairs(t.watch) do
    local w_e = w.entity
    local f = w.segment and w_e.get_fluid_segment_fluid(w.index) or w_e.get_fluid(w.index)
    if f and f.name ~= w.expected then
      local key = w.expected .. '|' .. f.name
      local hit = x.foundIndex[key]
      if not hit then hit = {network=w.expected, found=f.name, amount=f.amount, afterTicks=step - 40, entity=w.id} x.foundIndex[key] = hit x.found[#x.found + 1] = hit end
      if f.amount > hit.amount then hit.amount = f.amount end
    end
  end end
end

-- Every tick: only what needs tick resolution. The level is read and every level-gated arm is checked (an arm
-- that stays enabled for more than five ticks while a higher level is active is a violation).
script.on_event(defines.events.on_tick, function(event)
  local t = storage.run if not t or t.done then return end
  local tick = event.tick - t.begin
  if tick == 0 then return end
  if t.building then construct(t, tick) end
  check_fluids(t, tick)
  if t.ready and not t.started then
    t.started = true
    log('FOUNDRY_MALL_START')
    -- circuit nets as built: every member of a net shares one network; different nets differ
    local ids, netsOk, faults = {}, true, {}
    for name, net in pairs(M.nets) do
      local id
      for _, member in ipairs(net.members) do
        local n = network(t.entities[member[1]], member[2])
        if not n then netsOk = false faults[#faults + 1] = name .. ' #' .. member[1] elseif id and n.network_id ~= id then netsOk = false faults[#faults + 1] = name .. ' split at #' .. member[1] else id = n.network_id end
      end
      if id then if ids[id] and ids[id] ~= name then netsOk = false faults[#faults + 1] = name .. ' merged with ' .. ids[id] end ids[id] = name end
    end
    record(t, 'every circuit net is one network and no two nets are joined', netsOk, faults)
    local entryNetwork, unpowered = t.entities[M.power.entry].electric_network_id, {}
    for id, e in pairs(t.entities) do
      if e.prototype.electric_energy_source_prototype and (not e.is_connected_to_electric_network() or e.electric_network_id ~= entryNetwork) then unpowered[#unpowered + 1] = id end
    end
    record(t, 'every powered entity is on the one electric network of the marked substation', #unpowered == 0, unpowered)
    if not t.construction then record(t, 'cold empty ring', #ring_signals(t) == 0) end
    if T.matrix then matrix_begin(t) t.matrix.start0 = tick end
    if not begin_phase(t, tick - 1) then fail('no phases') end
  end
  if T.matrix and t.matrix then matrix_step(t, tick) end
  if T.scriptMode then return end
  local cur = t.current if not cur then return end
  local L = level(t)
  cur.level = L
  local lt = cur.record.levelTicks local key = tostring(L)
  lt[key] = (lt[key] or 0) + 1
  local now = false
  for _, g in ipairs(t.gatedArms) do if L > g.level and not g.behavior.disabled then now = true end end
  if now then cur.gated = (cur.gated or 0) + 1 if cur.gated > 5 then cur.record.gatedActive = cur.record.gatedActive + 1 end else cur.gated = 0 end
end)

-- Supply: entrance belts every 4 ticks (both lanes, a full red belt), the stone sink with them, fluids every 5 ticks.
script.on_nth_tick(4, function(event)
  local t = storage.run if not t or t.done or not (t.current or t.building) or T.scriptMode == 'none' then return end   -- nothing is supplied before the first phase begins, except under construction
  for _, name in ipairs(ITEM_INPUTS) do if not withheld(t, name) then
    local entity = t.entities[t.ports[name].entityId]
    local thin = throttle(t, name)   -- items a minute, one lane, when the phase thins this entrance
    local meter = metered(t, name)
    local what = INPUT_ITEM[name]
    if entity and entity.valid then
      if meter then
        -- exactly the figure: credit builds up a 900th of it every call and is spent one item at a time
        local credit = math.min((t.credit[name] or 0) + meter / 900, 4)
        while credit >= 1 do
          if entity.get_transport_line(1).insert_at_back{name=what, count=1} or entity.get_transport_line(2).insert_at_back{name=what, count=1} then t.accepted[name] = (t.accepted[name] or 0) + 1 credit = credit - 1 else break end
        end
        t.credit[name] = credit
      elseif thin then
        if event.tick % (4 * math.max(1, math.floor(900 / thin))) == 0 and entity.get_transport_line(1).insert_at_back{name=what, count=1} then t.accepted[name] = (t.accepted[name] or 0) + 1 end
      else for lane = 1, 2 do if entity.get_transport_line(lane).insert_at_back{name=what, count=1} then t.accepted[name] = (t.accepted[name] or 0) + 1 end end end
    end
  end end
  local sink = t.stoneSink
  if not withheld(t, 'stone exit') then for lane = 1, 2 do local line = sink.get_transport_line(lane) local n = line.get_item_count() if n > 0 then t.stone = t.stone + n line.clear() end end end
end)
script.on_nth_tick(5, function(event)
  local t = storage.run if not t or t.done or not (t.current or t.building) or T.scriptMode == 'none' then return end   -- nothing is supplied before the first phase begins, except under construction
  for _, name in ipairs(FLUID_INPUTS) do if not withheld(t, name) then
    local thin = throttle(t, name)   -- units a second when the phase thins this entrance
    local meter = metered(t, name)   -- units a minute
    t.accepted[name] = (t.accepted[name] or 0) + t.ports[name].pipe.insert_fluid{name=INPUT_ITEM[name], amount=meter and meter / 720 or thin and thin / 12 or 500, temperature=T.fluidTemperature[INPUT_ITEM[name]]}
  end end
end)
-- Every 10 ticks: which recipe each recipe-switching machine runs.
script.on_nth_tick(10, function(event)
  local t = storage.run if not t or t.done or T.scriptMode then return end
  local cur = t.current if not cur then return end
  local ph = cur.record
  for _, s in ipairs(t.switching) do
    local r = s.entity.get_recipe() local rn = r and r.name or 'none'
    local times = ph.recipeTicks[s.role] if not times then times = {} ph.recipeTicks[s.role] = times end
    times[rn] = (times[rn] or 0) + 10
    if cur.lastRecipe[s.role] ~= rn then ph.switches[s.role] = (ph.switches[s.role] or 0) + 1 cur.lastRecipe[s.role] = rn end
    if not t.ruleRecipes[s.role][rn] and not t.strayIndex[s.role .. rn] then t.strayIndex[s.role .. rn] = true t.strays[#t.strays + 1] = {machine=s.role, recipe=rn, tick=event.tick - t.begin, phase=cur.spec.name} log('FOUNDRY_MALL_STRAY ' .. s.role .. ' ' .. rn .. ' ' .. (event.tick - t.begin)) end
  end
end)
-- Exploration only (T.trace = {role=..., item=..., fromTick=..., untilTick=..., every=...}): one switching machine,
-- one line each time its state changes.
if T.trace then script.on_nth_tick(T.trace.every or 7, function(event)
  local t = storage.run if not t or t.done or event.tick > T.trace.untilTick or event.tick < (T.trace.fromTick or 0) then return end
  for _, s in ipairs(t.switching) do if s.role == T.trace.role then
    local e = s.entity local r = e.get_recipe()
    local function inv(id) local o = {} local i = e.get_inventory(id) if i then for _, st in pairs(i.get_contents()) do o[#o + 1] = st.name .. '=' .. st.count end end return table.concat(o, ' ') end
    local set = {} local n = e.get_circuit_network(RED) if n and n.signals then for _, sg in pairs(n.signals) do if sg.signal.type == 'recipe' then set[#set + 1] = sg.signal.name .. '=' .. sg.count end end end
    local hands, load = {}, {}
    local c = M.controllers[s.role]
    if c then for _, id in ipairs(c.inputArms) do
      local a = t.entities[id] hands[#hands + 1] = a.held_stack.valid_for_read and (a.held_stack.name .. 'x' .. a.held_stack.count) or '-'
      local ln = a.get_circuit_network(RED) load = {} if ln and ln.signals then for _, sg in pairs(ln.signals) do load[#load + 1] = sg.signal.name end end
    end end
    local function netline(id, connector) local o = {} local nn = t.entities[id].get_circuit_network(connector) if nn and nn.signals then for _, sg in pairs(nn.signals) do o[#o + 1] = sg.signal.name .. '=' .. sg.count end end return table.concat(o, ',') end
    local held, new = '', ''
    if c then new = netline(c.take, defines.wire_connector_id.combinator_input_green) end
    local line = (r and r.name or 'none') .. ' | ' .. status_name(e) .. ' | set ' .. table.concat(set, ',') .. ' | in ' .. inv(defines.inventory.crafter_input) .. ' | out ' .. inv(defines.inventory.crafter_output) .. ' | dump ' .. inv(defines.inventory.assembling_machine_dump) .. ' | hands ' .. table.concat(hands, ',') .. ' | blocked ' .. table.concat(load, ',') .. ' | fin ' .. e.products_finished .. ' | HELD ' .. held .. ' | NEW ' .. new
    do
      local probe = t.entities[M.rules[#M.rules - 3].entity].get_circuit_network(defines.wire_connector_id.combinator_input_red)
      local gprobe = t.entities[M.rules[#M.rules - 3].entity].get_circuit_network(defines.wire_connector_id.combinator_input_green)
      line = line .. ' | W' .. (n and n.get_signal({type='virtual', name='signal-W'}) or 0) .. ' P' .. (n and n.get_signal({type='virtual', name='signal-P'}) or 0) .. ' pend' .. (probe and probe.get_signal({type='recipe', name=T.trace.item}) or 0) .. ' loose' .. (probe and probe.get_signal({type='item', name=T.trace.item}) or 0) .. ' green' .. (gprobe and gprobe.get_signal({type='item', name=T.trace.item}) or 0)
    end
    if line ~= storage.traceLine then storage.traceLine = line log('TRACE ' .. event.tick .. ' ' .. line) end
  end end
end) end
-- Exploration only (T.fluidDebug): the first tick a foreign fluid sits in the water tank, and what the machines on that network hold.
if T.fluidDebug then script.on_nth_tick(3, function(event)
  local t = storage.run if not t or t.done or storage.fluidSeen then return end
  local tank = t.entities[M.tanks.water]
  for name, amount in pairs(tank.get_fluid_contents()) do if name ~= 'water' then
    storage.fluidSeen = true
    local out = {tick=event.tick, found=name, amount=amount}
    for _, m in ipairs(M.machines) do if m.role == 'caster-G' or m.role == 'U1' then
      local e = t.entities[m.entity] local r = e.get_recipe() local boxes = {}
      for i = 1, e.fluids_count do local f = e.get_fluid(i) local c = e.get_fluid_box_pipe_connections(i) boxes[i] = {fluid=f and f.name, amount=f and f.amount, at=c[1] and c[1].target_position} end
      out[m.role] = {recipe=r and r.name or 'none', boxes=boxes}
    end end
    log('FLUID ' .. helpers.table_to_json(out))
  end end
end) end
-- Every 15 ticks: what the ring holds (peak per item and in total).
script.on_nth_tick(15, function(event)
  local t = storage.run if not t or t.done or T.scriptMode then return end
  local cur = t.current if not cur then return end
  local total = 0
  for _, s in pairs(ring_signals(t)) do total = total + s.count if s.count > (t.ringPeaks[s.signal.name] or 0) then t.ringPeaks[s.signal.name] = s.count end end
  if total > t.ringPeakTotal then t.ringPeakTotal = total end
  if total > cur.record.peak then cur.record.peak = total end
end)
-- Every second: collection, stock, first time at cap, foreign items, crafts by level, machine status, phase goal and limit.
script.on_nth_tick(60, function(event)
  local t = storage.run if not t or t.done then return end
  local tick = event.tick - t.begin
  local cur = t.current if not cur or tick < 60 then return end
  local ph, spec = cur.record, cur.spec
  local finished
  if not T.scriptMode then
    if spec.collectEvery then
      local taken = collect(t, cur.collectOnly)
      for name, n in pairs(taken) do ph.collected[name] = (ph.collected[name] or 0) + n end
    end
    local counts = stock(t)
    for name, cap in pairs(t.caps) do if counts[name] >= cap and not ph.reached[name] then ph.reached[name] = tick - ph.start end end
    local f = foreign(t) if f then t.foreign = t.foreign or f end
    local joins = {} for _, m in ipairs(M.machines) do port_joins(t, m, joins) end
    for _, j in ipairs(joins) do
      local key = j.machine .. '|' .. j.recipe .. '|' .. j.box .. '|' .. j.joinedTo
      local known = t.joinIndex[key]
      if not known then known = j j.tick = tick j.seconds = 0 t.joinIndex[key] = j t.joins[#t.joins + 1] = j end
      known.seconds = known.seconds + 1
    end
    local L, now = tostring(cur.level or 0), crafts(t)
    for _, m in ipairs(M.machines) do
      local k = machine_key(m) local d = now[k] - cur.lastCrafts[k]
      if d > 0 then local by = ph.craftsByLevel[k] if not by then by = {} ph.craftsByLevel[k] = by end by[L] = (by[L] or 0) + d end
      local st = status_name(t.entities[m.entity])
      local samples = ph.statusSamples[k] if not samples then samples = {} ph.statusSamples[k] = samples end
      samples[st] = (samples[st] or 0) + 1
    end
    cur.lastCrafts = now
    if spec.mode == 'until_caps' then
      if at_caps(t, counts, cur.skip) then cur.full = (cur.full or 0) + 1 else cur.full = 0 end
      if cur.full >= (spec.settleSeconds or 5) then finished = 'caps' end
    end
    if tick % 600 == 0 then
      if tick % T.samplingTicks == 0 then
        local ring = {} for _, s in pairs(ring_signals(t)) do ring[s.signal.name] = s.count end
        t.samples[#t.samples + 1] = {tick=tick, phase=spec.name, level=cur.level, stock=counts, ring=ring}
      end
    end
  end
  if not finished then
    local limit = spec.mode == 'ticks' and spec.ticks or spec.limit
    if tick - ph.start >= limit then finished = spec.mode == 'ticks' and 'ticks' or 'limit' end
  end
  if finished then
    if finished == 'limit' then record(t, spec.name .. ': finished within its tick limit', false, {limit=spec.limit, stock=stock(t)}) end
    end_phase(t, tick, finished)
    if not begin_phase(t, tick) then finish(t, tick) end
  end
end)
