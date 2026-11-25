-- Native harness of the foundry mall. Imports the exact blueprint on a Vulcanus surface and never repairs it.
-- Runs only in the validator's private save. Supply: the declared entrances only (lava, calcite, water, lubricant,
-- sulfuric acid, plastic, tungsten carbide), a sink on the stone exit and outside power.
-- The run is a list of phases (T.phases), each with: mode ('until_caps' with a tick limit, or 'ticks'), the inputs
-- withheld, what is collected (at the start, every second, or one item), optional cap edits and what is measured.
local T = require('fixture')
local M = T.manifest
local PER_MINUTE = 3600
local RED, GREEN = defines.wire_connector_id.circuit_red, defines.wire_connector_id.circuit_green
local CONNECTOR = {[1]=defines.wire_connector_id.circuit_red, [2]=defines.wire_connector_id.circuit_green, [3]=defines.wire_connector_id.combinator_output_red, [4]=defines.wire_connector_id.combinator_output_green}
local COMBINATOR = {['decider-combinator']=true, ['arithmetic-combinator']=true, ['selector-combinator']=true}
local INPUTS = {'lava', 'calcite', 'water', 'lubricant', 'sulfuric-acid', 'plastic-bar', 'tungsten-carbide'}
local ITEM_INPUTS = {'calcite', 'plastic-bar', 'tungsten-carbide'}
local FLUID_INPUTS = {'lava', 'water', 'lubricant', 'sulfuric-acid'}

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
  local t = {surface=surface, force=force, begin=game.tick, checks={}, failures={}, entities={}, fixtures={}, phases={}, phase=0, caps={}, accepted={}, stone=0, ringPeaks={}, ringPeakTotal=0, violations={}, fluidFaults={}, samples={}}
  for name, cap in pairs(M.caps) do t.caps[name] = cap end
  t.chunks = chunks t.pressure = surface.get_property('pressure')
  t.bonus = {stack=force.inserter_stack_size_bonus, bulk=force.bulk_inserter_capacity_bonus}
  local inventory = game.create_inventory(1)
  inventory[1].set_stack{name='blueprint'}
  if inventory[1].import_stack(T.blueprint) ~= 0 then fail('exact blueprint import') end
  local ghosts = inventory[1].build_blueprint{surface=surface, force=force, position={0, 0}, build_mode=defines.build_mode.forced}
  record(t, 'every blueprint entity became a ghost', #ghosts == #T.entities, {ghosts=#ghosts, entities=#T.entities})
  for _, ghost in pairs(ghosts) do local _, entity = ghost.revive{raise_revive=true} if not entity then fail('blueprint revival') end end
  inventory.destroy()
  -- offset: the first lava foundry
  local anchorSpec for _, spec in ipairs(T.entities) do if spec.recipe == 'molten-iron-from-lava' then anchorSpec = spec end end
  local anchor for _, e in pairs(surface.find_entities_filtered{name='foundry', force=force}) do local r = e.get_recipe() if r and r.name == 'molten-iron-from-lava' then anchor = e end end
  if not anchor then fail('anchor foundry did not survive import') end
  local dx, dy = anchor.position.x - anchorSpec.position.x, anchor.position.y - anchorSpec.position.y
  t.offset = {x=dx, y=dy}
  local exact, missing = true, {}
  for _, spec in ipairs(T.entities) do
    local e = surface.find_entity(spec.name, {spec.position.x + dx, spec.position.y + dy})
    if not e then missing[#missing + 1] = spec.entity_number else
      t.entities[spec.entity_number] = e
      if e.direction ~= (spec.direction or 0) and spec.name ~= 'substation' and spec.name ~= 'storage-tank' and spec.name ~= 'passive-provider-chest' and spec.name ~= 'display-panel' and spec.name ~= 'constant-combinator' and spec.name ~= 'pipe' then exact = false record(t, 'direction changed #' .. spec.entity_number .. ' ' .. spec.name, false, {want=spec.direction or 0, got=e.direction}) end
      if spec.name == 'display-panel' and not (e.display_panel_always_show and e.display_panel_text == spec.text) then record(t, 'display panel text #' .. spec.entity_number, false) end
    end
  end
  record(t, 'every entity imported at its exact position and direction', exact and #missing == 0, {missing=missing})
  if #missing > 0 then fail('missing entities ' .. helpers.table_to_json(missing)) end
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
  for _, o in ipairs(M.outputs) do record(t, 'cold empty provider ' .. o.id, t.entities[o.chest].get_inventory(defines.inventory.chest).is_empty()) end
  -- fixtures
  local function fixture(name, position, direction)
    local e = surface.create_entity{name=name, position={position.x + dx, position.y + dy}, force=force, direction=direction}
    if not e then fail('fixture placement ' .. name .. ' at ' .. position.x .. ',' .. position.y) end
    t.fixtures[#t.fixtures + 1] = e return e
  end
  t.ports = {}
  for _, port in ipairs(M.ports) do
    local entry = {id=port.id, item=port.item, kind=port.kind, entity=t.entities[port.entity]}
    record(t, 'clear approach ' .. port.id, surface.can_place_entity{name=port.kind == 'fluid' and 'pipe' or 'fast-transport-belt', position={port.externalContact.x + dx, port.externalContact.y + dy}, force=force})
    if port.kind == 'fluid' then entry.pipe = fixture('pipe', port.externalContact)
    elseif port.exit then
      entry.sink = fixture('fast-transport-belt', port.externalContact, defines.direction.west)
    end
    t.ports[port.item] = entry
  end
  local entry = t.entities[M.power.entry]
  local external = fixture('substation', M.power.externalPolePosition)
  local a, b = external.get_wire_connector(defines.wire_connector_id.pole_copper, true), entry.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  if not a.is_connected_to(b) then a.connect_to(b) end
  if not a.is_connected_to(b) then fail('external power wire') end
  t.power = fixture('electric-energy-interface', {x=M.power.externalPolePosition.x - 3, y=M.power.externalPolePosition.y})
  t.power.power_production = T.externalPowerWatts / 60 t.power.electric_buffer_size = T.externalPowerWatts t.power.energy = T.externalPowerWatts
  -- the scenario's starting caps, written into the caps combinator exactly as a player would edit it
  for name, value in pairs(T.startCaps) do if not set_cap(t, name, value) then fail('no cap slot ' .. name) end end
  t.switching = {}
  for _, m in ipairs(M.machines) do if m.switching then t.switching[#t.switching + 1] = {role=m.role, entity=t.entities[m.entity]} end end
  t.gatedArms = {}
  for _, a in ipairs(M.arms) do if a.level then t.gatedArms[#t.gatedArms + 1] = {level=a.level, behavior=t.entities[a.entity].get_control_behavior()} end end
  t.levelEntity = t.entities[M.outputs[1].chest]
  storage.run = t
end)

local function withheld(t, name) return t.current and t.current.withhold and t.current.withhold[name] end
local function consumption(t)
  local items, fluids = t.force.get_item_production_statistics(t.surface), t.force.get_fluid_production_statistics(t.surface)
  local out = {}
  for _, name in ipairs(INPUTS) do
    if t.ports[name].kind == 'fluid' then out[name] = fluids.get_output_count(name) else out[name] = items.get_output_count(name) end
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
  t.current = {spec=spec, record=ph, withhold=ph.withholdSet, lastRecipe={}, lastCrafts=crafts(t)}
  if spec.collectItems then t.current.collectOnly = {} for _, n in ipairs(spec.collectItems) do t.current.collectOnly[n] = true end end
  if spec.except then t.current.skip = {} for _, n in ipairs(spec.except) do t.current.skip[n] = true end end
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
  record(t, label .. ': no chest holds a foreign item', foreign(t) == nil, foreign(t))
end

local function finish(t, tick)
  record(t, 'no chest ever held a foreign item', t.foreign == nil, t.foreign)
  record(t, 'every pipe and tank carried only its own fluid', #t.fluidFaults == 0, t.fluidFaults)
  record(t, 'the ring never held more than its lane-room bound', t.ringPeakTotal <= M.ring.bound, {peak=t.ringPeakTotal, bound=M.ring.bound})
  local gated = 0 for _, p in ipairs(t.phases) do gated = gated + p.gatedActive end
  record(t, 'no level-gated arm was enabled while a higher level was active', gated == 0, gated)
  local machines = {}
  for _, m in ipairs(M.machines) do local e = t.entities[m.entity] machines[#machines + 1] = {role=m.role, entity=m.entity, recipe=m.recipe, products=e.products_finished, status=status_name(e)} end
  local report = {schema=2, passed=#t.failures == 0, failures=t.failures, checks=t.checks, gameVersion=script.active_mods.base, activeMods=T.activeMods, surface=t.surface.name, surfaceChunks=t.chunks, pressure=t.pressure, blueprintSha256=T.blueprintSha256, prototypeSha256=T.prototypeSha256, configurationSha256=T.configurationSha256, nativeControlSha256=T.nativeControlSha256, actualTicks=tick, scenario=T.scenario, capsName=T.capsName, startCaps=T.startCaps, bonus=t.bonus, phases=t.phases, samples=t.samples, machines=machines, ringPeaks=t.ringPeaks, ringPeakTotal=t.ringPeakTotal, ringBound=M.ring.bound, boundaryAccepted=t.accepted, stoneOut=t.stone, blueprintEntityCount=#T.entities, fixtureEntityCount=#t.fixtures, caps=t.caps}
  helpers.write_file('foundry-mall/native-report.json', helpers.table_to_json(report), false)
  log('FOUNDRY_MALL_RESULT ' .. helpers.table_to_json({passed=report.passed, failures=report.failures, ticks=tick}))
  -- the benchmark has a fixed length: empty the surface so the remaining ticks cost nothing
  for _, e in pairs(t.surface.find_entities()) do if e.valid then e.destroy() end end
  storage.run = {done=true}
end

-- Every tick: only what needs tick resolution. The level is read and every level-gated arm is checked (an arm
-- that stays enabled for more than five ticks while a higher level is active is a violation).
script.on_event(defines.events.on_tick, function(event)
  local t = storage.run if not t or t.done then return end
  local tick = event.tick - t.begin
  if tick == 0 then return end
  if tick == 1 then
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
    record(t, 'cold empty ring', #ring_signals(t) == 0)
    if not begin_phase(t, 0) then fail('no phases') end
  end
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
  local t = storage.run if not t or t.done or not t.current or T.scriptMode == 'none' then return end   -- nothing is supplied before the first phase begins
  for _, name in ipairs(ITEM_INPUTS) do if not withheld(t, name) then
    local entity = t.ports[name].entity
    for lane = 1, 2 do if entity.get_transport_line(lane).insert_at_back{name=name, count=1} then t.accepted[name] = (t.accepted[name] or 0) + 1 end end
  end end
  local sink = t.ports.stone.sink
  for lane = 1, 2 do local line = sink.get_transport_line(lane) local n = line.get_item_count() if n > 0 then t.stone = t.stone + n line.clear() end end
end)
script.on_nth_tick(5, function(event)
  local t = storage.run if not t or t.done or not t.current or T.scriptMode == 'none' then return end   -- nothing is supplied before the first phase begins
  for _, name in ipairs(FLUID_INPUTS) do if not withheld(t, name) then
    t.accepted[name] = (t.accepted[name] or 0) + t.ports[name].pipe.insert_fluid{name=name, amount=500, temperature=T.fluidTemperature[name]}
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
      -- every pipe and tank carries only its own fluid
      for fluid, ids in pairs(M.fluids) do for _, id in ipairs(ids) do
        for name in pairs(t.entities[id].get_fluid_contents()) do if name ~= fluid then t.fluidFaults[#t.fluidFaults + 1] = {entity=id, expected=fluid, found=name, tick=tick} end end
      end end
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
