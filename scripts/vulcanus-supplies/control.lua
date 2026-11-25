-- Native harness of the Vulcanus supply blueprints (coal-plastic-lubricant, tungsten-carbide). One scenario per game run.
-- Import the exact blueprint on a Vulcanus surface and never repair it. Supply only the declared entrances (belts: items put on the
-- entrance belt; pipes: fluid put into one outside pipe) and outside power (one energy interface on an outside substation wired to the
-- declared power connection). Take only from the declared exits (belt exit tile; one outside pipe beyond the exit pipe).
-- The scenario is a list of phases: each has a length, a feed per entrance ('generous' | per-minute figure | 'none') and a draw per exit
-- ('all' | per-minute figure | 'none'). Per phase the harness records what each entrance took and each exit gave per minute, what every
-- machine crafted and its status shares, and once a second it checks that no pipe, machine or exit holds a foreign fluid or item.
local T = require('fixture')
local M, P, SC = T.manifest, T.protocol, T.scenario
local PER_MINUTE = 3600
local MACHINESET = {['oil-refinery'] = true, ['chemical-plant'] = true, ['assembling-machine-3'] = true}

local function require_ok(ok, message) if not ok then error('VULCANUS_SUPPLY: ' .. message) end end
local function record(t, name, passed, detail)
  t.checks[#t.checks + 1] = {name = name, passed = not not passed, detail = detail}
  if not passed then t.failures[#t.failures + 1] = name end
end
local status_names = {}
for n, v in pairs(defines.entity_status) do status_names[v] = n end
local function status_name(e) return status_names[e.status] or tostring(e.status) end
local function contains(entity, position)
  if not entity then return false end
  local b = entity.selection_box
  return position.x > b.left_top.x and position.x < b.right_bottom.x and position.y > b.left_top.y and position.y < b.right_bottom.y
end
local function recipe_map(values)
  local result = {}
  for _, v in pairs(values) do result[(v.type or 'item') .. ':' .. v.name] = v.amount end
  return result
end
local function same_map(a, b)
  for k, v in pairs(a) do if b[k] ~= v then return false end end
  for k, v in pairs(b) do if a[k] ~= v then return false end end
  return true
end
local function segment_of(e, i)
  if not e.has_fluid_segment(i) then return nil end
  return e.get_fluid_segment_id(i)
end
local function sorted_keys(map) local keys = {}; for k in pairs(map) do keys[#keys + 1] = k end; table.sort(keys); return keys end

-- Phase table: absolute start and stop tick (relative to the run start) of every phase.
local phases, total = {}, 0
for i, ph in ipairs(SC.phases) do phases[i] = {spec = ph, start = total, stop = total + ph.ticks}; total = total + ph.ticks end

script.on_init(function()
  require_ok(script.active_mods.base == T.gameVersion, 'wrong game version')
  for name, version in pairs(T.activeMods) do require_ok(script.active_mods[name] == version, 'mod mismatch: ' .. name) end
  local surface = game.planets.vulcanus.create_surface({width = 192, height = 128, seed = P.seed})
  require_ok(surface.planet and surface.planet.name == 'vulcanus', 'not a Vulcanus surface')
  surface.request_to_generate_chunks({0, 0}, 4); surface.force_generate_chunk_requests()
  for _, e in pairs(surface.find_entities()) do e.destroy() end
  local tiles = {}
  for x = -80, 79 do for y = -56, 55 do tiles[#tiles + 1] = {name = 'volcanic-ash-flats', position = {x, y}} end end
  surface.set_tiles(tiles)
  local force = game.create_force('vulcanus-supply-test')
  -- Only the technology closure is researched; nothing else is enabled.
  for _, name in ipairs(T.technologyClosure) do require_ok(force.technologies[name], 'missing technology ' .. name); force.technologies[name].researched = true end
  local t = {surface = surface, force = force, begin = game.tick, checks = {}, failures = {}, entities = {}, inputs = {}, outputs = {}, phaseData = {}, fixtures = {}, routes = {}, machines = {}, perSecond = {}, sinks = {}, mixing = {}, foreign = {}}
  record(t, 'surface is the Vulcanus planet with its own surface properties', surface.get_property('pressure') == 4000, {pressure = surface.get_property('pressure'), gravity = surface.get_property('gravity')})
  local inventory = game.create_inventory(1)
  inventory[1].set_stack{name = 'blueprint'}
  require_ok(inventory[1].import_stack(T.blueprint) == 0, 'exact blueprint import')
  local ghosts = inventory[1].build_blueprint{surface = surface, force = force, position = {0, 0}, build_mode = defines.build_mode.forced}
  require_ok(#ghosts == #T.entities, 'blueprint ghost count ' .. #ghosts .. ' expected ' .. #T.entities)
  for _, ghost in pairs(ghosts) do local _, entity = ghost.revive{raise_revive = true}; require_ok(entity, 'blueprint revival') end
  inventory.destroy()
  -- The anchor is the one display panel whose text is the power label; every entity is then looked up at its exact position.
  local anchorSpec, anchor
  for _, spec in ipairs(T.entities) do if spec.name == 'display-panel' and spec.entity_number == M.power.panel then anchorSpec = spec end end
  for _, e in pairs(surface.find_entities_filtered{name = 'display-panel', force = force}) do if e.display_panel_text == anchorSpec.text then anchor = e end end
  require_ok(anchor and anchorSpec, 'anchor panel did not survive import')
  local dx, dy = anchor.position.x - anchorSpec.position.x, anchor.position.y - anchorSpec.position.y
  t.offset = {x = dx, y = dy}
  local exact, count = true, 0
  for _, spec in ipairs(T.entities) do
    local e = surface.find_entity(spec.name, {spec.position.x + dx, spec.position.y + dy})
    require_ok(e, 'missing blueprint entity #' .. spec.entity_number .. ' ' .. spec.name)
    t.entities[spec.entity_number] = e; count = count + 1
    if spec.name ~= 'display-panel' and spec.name ~= 'pipe' and spec.name ~= 'substation' then
      if e.direction ~= (spec.direction or 0) then exact = false; record(t, 'direction changed #' .. spec.entity_number, false) end
    end
    if MACHINESET[spec.name] and (e.mirroring or false) ~= (spec.mirror or false) then exact = false; record(t, 'mirroring changed #' .. spec.entity_number, false) end
    if (spec.name == 'fast-underground-belt') and e.belt_to_ground_type ~= spec.type then exact = false; record(t, 'underground type changed #' .. spec.entity_number, false) end
    if spec.name == 'display-panel' then record(t, 'display panel visible #' .. spec.entity_number, e.display_panel_always_show and e.display_panel_text == spec.text) end
  end
  record(t, 'every entity imported at its exact position, direction, mirroring and type', exact, {entities = count})
  record(t, 'no entity beyond the blueprint', #surface.find_entities_filtered{force = force} == #T.entities, {found = #surface.find_entities_filtered{force = force}})
  -- Machines: recipe, no modules, runtime recipe equals the pinned one, cold.
  for _, m in ipairs(M.machines) do
    local e = t.entities[m.entity]
    local recipe = e.get_recipe()
    record(t, 'recipe preserved #' .. m.entity .. ' ' .. m.recipe, recipe and recipe.name == m.recipe)
    record(t, 'recipe enabled by the researched closure alone ' .. m.recipe, force.recipes[m.recipe].enabled)
    local proto = prototypes.recipe[m.recipe]
    local expected = T.recipePrototypes[m.recipe]
    record(t, 'runtime recipe ingredients match the pin ' .. m.recipe, same_map(recipe_map(proto.ingredients), recipe_map(expected.ingredients)))
    record(t, 'runtime recipe products match the pin ' .. m.recipe, same_map(recipe_map(proto.products), recipe_map(expected.results)))
    record(t, 'recipe time matches the pin ' .. m.recipe, math.abs(proto.energy - expected.energy) < 1e-9)
    record(t, 'cold machine and no modules #' .. m.entity, e.products_finished == 0 and (e.get_module_inventory() == nil or e.get_module_inventory().is_empty()))
    record(t, 'crafting speed matches the pin #' .. m.entity, math.abs(e.crafting_speed - T.machineSpeed[e.name]) < 1e-9, {speed = e.crafting_speed})
    t.machines[#t.machines + 1] = {entity = m.entity, role = m.role, recipe = m.recipe, e = e}
  end
  -- Inserter hands, filters and routes as imported: no stack bonus, every pickup and drop where the audit says.
  record(t, 'inserter capacity bonus is zero for this force', force.inserter_stack_size_bonus == 0)
  local function route(armId, source, dest, label)
    local a = t.entities[armId]
    record(t, label, source and dest and contains(source, a.pickup_position) and contains(dest, a.drop_position))
    t.routes[#t.routes + 1] = {label = label, inserter = armId, pickup = a.pickup_position, drop = a.drop_position}
  end
  for _, r in ipairs(M.routes) do
    local source = r.sourceEntity and t.entities[r.sourceEntity] or nil
    local dest = r.destEntity and t.entities[r.destEntity] or nil
    if r.sourceBelts then
      local a = t.entities[r.inserter]; source = nil
      for _, id in ipairs(r.sourceBelts) do if contains(t.entities[id], a.pickup_position) then source = t.entities[id] end end
    end
    if r.destBelts then
      local a = t.entities[r.inserter]; dest = nil
      for _, id in ipairs(r.destBelts) do if contains(t.entities[id], a.drop_position) then dest = t.entities[id] end end
    end
    route(r.inserter, source, dest, r.label)
  end
  -- Fluids: every fluid box of every machine has the connection tiles of the static model, and the pipes form exactly the static networks.
  local boxesOk, detail = true, {}
  for _, m in ipairs(M.machines) do
    local e = t.entities[m.entity]
    local want = M.machineBoxes[tostring(m.entity)]
    if want then
      local actual = {}
      for i = 1, e.fluids_count do
        local filter = e.get_fluid_filter(i)
        local targets = {}
        for _, pc in pairs(e.get_fluid_box_pipe_connections(i)) do targets[#targets + 1] = string.format('%d,%d', math.floor(pc.target_position.x - e.position.x + 0.5), math.floor(pc.target_position.y - e.position.y + 0.5)) end
        table.sort(targets)
        actual[#actual + 1] = {fluid = filter and filter.name, targets = table.concat(targets, ' ')}
      end
      for _, w in ipairs(want) do
        local targets = {}
        for _, p in ipairs(w.targets) do targets[#targets + 1] = string.format('%d,%d', p[1], p[2]) end
        table.sort(targets)
        local found = false
        for _, a in ipairs(actual) do if a.fluid == w.fluid and a.targets == table.concat(targets, ' ') then found = true end end
        if not found then boxesOk = false; detail[#detail + 1] = {entity = m.entity, wanted = w.fluid .. ' ' .. table.concat(targets, ' ')} end
      end
    end
  end
  record(t, 'every machine fluid box has exactly the connection tiles of the static model', boxesOk, detail)
  t.fluidEntities = {}
  for id, fluid in pairs(M.fluidOf) do local e = t.entities[tonumber(id)]; t.fluidEntities[#t.fluidEntities + 1] = {id = tonumber(id), e = e, fluid = fluid} end
  for id, list in pairs(M.machineFluids) do local e = t.entities[tonumber(id)]; t.fluidEntities[#t.fluidEntities + 1] = {id = tonumber(id), e = e, machine = list} end
  -- External fixtures.
  local function fixture(name, position)
    local e = surface.create_entity{name = name, position = position, force = force}
    require_ok(e, 'fixture placement ' .. name); t.fixtures[#t.fixtures + 1] = e; return e
  end
  local entry = t.entities[M.power.entry]
  local external = fixture('substation', {M.power.externalPole.x + dx, M.power.externalPole.y + dy})
  local externalCopper = external.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  local entryCopper = entry.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  if not externalCopper.is_connected_to(entryCopper) then externalCopper.connect_to(entryCopper) end
  require_ok(externalCopper.is_connected_to(entryCopper), 'external power wire')
  t.power = fixture('electric-energy-interface', {M.power.externalPole.x + dx + 2, M.power.externalPole.y + dy})
  t.power.power_production = P.externalPowerWatts; t.power.electric_buffer_size = P.externalPowerWatts; t.power.energy = P.externalPowerWatts
  for _, port in ipairs(M.inputs) do
    local in_ = {port = port, id = port.id, item = port.item, kind = port.kind, credit = 0, carry = 0, lane = 0}
    if port.kind == 'pipe' then in_.fixture = fixture('pipe', {port.externalContact.x + dx, port.externalContact.y + dy}); in_.entity = t.entities[port.entity]
    else in_.entity = t.entities[port.entity] end
    t.inputs[#t.inputs + 1] = in_
  end
  for _, port in ipairs(M.outputs) do
    local out = {port = port, id = port.id, item = port.item, kind = port.kind, carry = 0}
    if port.kind == 'pipe' then out.fixture = fixture('pipe', {port.externalContact.x + dx, port.externalContact.y + dy}); out.entity = t.entities[port.entity]
    else out.entity = t.entities[port.entity] end
    t.outputs[#t.outputs + 1] = out
  end
  -- Approaches: the three tiles beyond every entrance and exit must be buildable (the fixture pipes are already placed and not counted).
  for _, port in ipairs(M.approaches) do
    local ok = true
    for _, tile in ipairs(port.tiles) do
      if not surface.can_place_entity{name = 'pipe', position = {tile.x + dx, tile.y + dy}, force = force} then ok = false end
    end
    record(t, 'clear approach ' .. port.id, ok)
  end
  storage.run = t
end)

-- ---------------------------------------------------------------------------------------------------------------------------
local function feed(t, in_, mode, tick, ph)
  if mode == 'none' then return end
  local added = 0
  if in_.kind == 'belt' then
    local belt = in_.entity
    if mode == 'generous' then
      for lane = 1, 2 do for _ = 1, 2 do if belt.get_transport_line(lane).insert_at_back{name = in_.item, count = 1} then added = added + 1 end end end
    else
      in_.credit = math.min(8, in_.credit + mode / PER_MINUTE)
      while in_.credit >= 1 do
        local lane = in_.lane % 2 + 1
        local ok = belt.get_transport_line(lane).insert_at_back{name = in_.item, count = 1}
        if not ok then lane = lane % 2 + 1; ok = belt.get_transport_line(lane).insert_at_back{name = in_.item, count = 1} end
        if not ok then break end
        in_.lane = lane; in_.credit = in_.credit - 1; added = added + 1
      end
    end
  else
    local fluid = T.fluids[in_.item]
    local want = mode == 'generous' and 1000 or (mode / PER_MINUTE + in_.carry)
    local n = in_.fixture.insert_fluid{name = in_.item, amount = want, temperature = fluid.default_temperature}
    if mode ~= 'generous' then in_.carry = math.min(want - n, mode / PER_MINUTE * 60) end
    added = n
  end
  ph.fed[in_.id] = (ph.fed[in_.id] or 0) + added
  ph.fedSecond[in_.id] = (ph.fedSecond[in_.id] or 0) + added
end

local function drain(t, out, mode, tick, ph)
  if mode == 'none' then return 0 end
  local got = 0
  if out.kind == 'belt' then
    if tick % 4 ~= 0 then return 0 end
    local want = nil
    if mode ~= 'all' then out.carry = math.min(8, out.carry + mode * 4 / PER_MINUTE); want = math.floor(out.carry) end
    for lane = 1, 2 do
      local line = out.entity.get_transport_line(lane)
      for _, c in pairs(line.get_contents()) do
        if c.name ~= out.item then ph.foreign[#ph.foreign + 1] = c.name end
        local n = want and math.min(c.count, want - got) or c.count
        if n > 0 then got = got + line.remove_item{name = c.name, count = n} end
      end
    end
    if want then out.carry = out.carry - got end
  else
    local fixture = out.fixture
    local contents = fixture.get_fluid_contents()
    for name in pairs(contents) do if name ~= out.item then ph.foreign[#ph.foreign + 1] = name end end
    local available = contents[out.item] or 0
    local want = mode == 'all' and available or math.min(available, mode / PER_MINUTE + out.carry)
    if want > 0 then local f = fixture.remove_fluid(1, want); got = f and f.name == out.item and f.amount or 0 end
    if mode ~= 'all' then out.carry = math.min(math.max(0, mode / PER_MINUTE + out.carry - got), mode / PER_MINUTE * 60) end
  end
  ph.drawn[out.id] = (ph.drawn[out.id] or 0) + got
  ph.drawnSecond[out.id] = (ph.drawnSecond[out.id] or 0) + got
  return got
end

local function snapshot_machines(t)
  local s = {}
  for _, m in ipairs(t.machines) do s[m.entity] = m.e.products_finished end
  return s
end
local function stats(t, kind, name)
  local st = kind == 'fluid' and t.force.get_fluid_production_statistics(t.surface) or t.force.get_item_production_statistics(t.surface)
  return st.get_output_count(name)
end

local function begin_phase(t, index)
  local def = phases[index]
  local ph = {index = index, name = def.spec.name, ticks = def.spec.ticks, fed = {}, drawn = {}, fedSecond = {}, drawnSecond = {}, foreign = {}, status = {}, minutes = {}, seconds = {}, mixed = {}, craftsAtStart = snapshot_machines(t), consumedAtStart = {}, started = game.tick - t.begin}
  for _, in_ in ipairs(t.inputs) do ph.consumedAtStart[in_.id] = stats(t, in_.kind == 'pipe' and 'fluid' or 'item', in_.item) end
  for _, out in ipairs(t.outputs) do ph.seconds[out.id] = {} end
  t.phaseData[index] = ph
  return ph
end

local function mix_check(t, ph)
  for _, fe in ipairs(t.fluidEntities) do
    local contents = fe.e.get_fluid_contents()
    for name in pairs(contents) do
      local ok = false
      if fe.machine then for _, f in ipairs(fe.machine) do if f == name then ok = true end end
      else ok = (name == fe.fluid) end
      if not ok then ph.mixed[#ph.mixed + 1] = {entity = fe.id, expected = fe.fluid or table.concat(fe.machine, '/'), found = name, tick = game.tick - t.begin} end
    end
  end
end

local function finish_phase(t, ph, def)
  local spec = def.spec
  local minutes = spec.ticks / PER_MINUTE
  local from = spec.measureFrom or 0
  local window = (spec.ticks - from) / PER_MINUTE
  local out = {name = spec.name, minutes = minutes, measuredFromMinute = from / PER_MINUTE, measuredMinutes = window, feed = spec.feed, draw = spec.draw, fedPerMinute = {}, drawnPerMinute = {}, consumedPerMinute = {}, perMinute = ph.minutes, machines = {}, mixedSeconds = #ph.mixed, mixedDetail = {}, foreign = ph.foreign}
  for i, m in ipairs(ph.mixed) do if i <= 5 then out.mixedDetail[#out.mixedDetail + 1] = m end end
  -- Whole-phase totals and the measured window (from the per-minute rows).
  for _, in_ in ipairs(t.inputs) do
    local total, w = 0, 0
    for i, row in ipairs(ph.minutes) do total = total + (row.fed[in_.id] or 0); if (i - 1) * PER_MINUTE >= from then w = w + (row.fed[in_.id] or 0) end end
    out.fedPerMinute[in_.id] = {phase = total / minutes, measured = w / window}
    local consumed = stats(t, in_.kind == 'pipe' and 'fluid' or 'item', in_.item) - ph.consumedAtStart[in_.id]
    out.consumedPerMinute[in_.id] = consumed / minutes
  end
  for _, o in ipairs(t.outputs) do
    local total, w = 0, 0
    for i, row in ipairs(ph.minutes) do total = total + (row.drawn[o.id] or 0); if (i - 1) * PER_MINUTE >= from then w = w + (row.drawn[o.id] or 0) end end
    out.drawnPerMinute[o.id] = {phase = total / minutes, measured = w / window}
  end
  for _, m in ipairs(t.machines) do
    local made = m.e.products_finished - ph.craftsAtStart[m.entity]
    local tail = m.e.products_finished - (ph.craftsTail and ph.craftsTail[m.entity] or ph.craftsAtStart[m.entity])
    out.machines[#out.machines + 1] = {entity = m.entity, role = m.role, recipe = m.recipe, products = made, productsPerMinute = made / minutes, productsInLastMinutes = tail, statusSamples = ph.status[m.entity] or {}, statusAtEnd = status_name(m.e)}
  end
  -- Expectations written into the scenario: each is a check in the report.
  local ex = spec.expect or {}
  for id, floor in pairs(ex.minDrawn or {}) do
    local got = out.drawnPerMinute[id] and out.drawnPerMinute[id].measured or 0
    record(t, spec.name .. ': ' .. id .. ' at least ' .. floor .. ' per minute', got >= floor - 1e-9, {measured = got, floor = floor})
  end
  for id, ceiling in pairs(ex.maxDrawn or {}) do
    local got = out.drawnPerMinute[id] and out.drawnPerMinute[id].measured or 0
    record(t, spec.name .. ': ' .. id .. ' at most ' .. ceiling .. ' per minute', got <= ceiling + 1e-9, {measured = got, ceiling = ceiling})
  end
  if ex.noMixing ~= false then record(t, spec.name .. ': no pipe, underground or machine ever held a fluid other than its network\'s', #ph.mixed == 0, out.mixedDetail) end
  record(t, spec.name .. ': no exit ever held anything but its own product', #ph.foreign == 0, ph.foreign)
  if ex.stopped then
    local still = {}
    for _, m in ipairs(out.machines) do if m.productsInLastMinutes > 0 then still[#still + 1] = {entity = m.entity, recipe = m.recipe, crafts = m.productsInLastMinutes} end end
    record(t, spec.name .. ': no machine crafted in the last ' .. ex.stopped .. ' minutes', #still == 0, still)
    local busy = {}
    for _, m in ipairs(out.machines) do if m.statusAtEnd == 'working' then busy[#busy + 1] = m.entity end end
    record(t, spec.name .. ': no machine working at the end', #busy == 0, busy)
    for _, in_ in ipairs(t.inputs) do
      local tail = 0
      local rows = ph.minutes
      for i = #rows - ex.stopped + 1, #rows do if rows[i] then tail = tail + (rows[i].fed[in_.id] or 0) end end
      out['tailFed_' .. in_.id] = tail
    end
  end
  if ex.recoverTo then
    -- Time (seconds into the phase) when each product's trailing minute first reaches the given share of its target.
    out.recovery = {}
    for id, target in pairs(ex.recoverTo.targets) do
      local seconds = ph.seconds[id] or {}
      local reached
      for s = 60, #seconds do
        local sum = 0
        for k = s - 59, s do sum = sum + seconds[k] end
        if sum >= target * ex.recoverTo.share - 1e-9 then reached = s; break end
      end
      out.recovery[id] = {target = target, share = ex.recoverTo.share, secondsToReach = reached}
      record(t, spec.name .. ': ' .. id .. ' back to ' .. (ex.recoverTo.share * 100) .. '% of ' .. target .. ' within ' .. ex.recoverTo.withinSeconds .. ' s', reached ~= nil and reached <= ex.recoverTo.withinSeconds, {seconds = reached})
    end
  end
  -- Machines that must have crafted in the measured window (rate phases).
  if ex.allMachinesCraft then
    local idle = {}
    for _, m in ipairs(out.machines) do if m.products <= 0 then idle[#idle + 1] = {entity = m.entity, recipe = m.recipe} end end
    record(t, spec.name .. ': every machine crafted', #idle == 0, idle)
  end
  return out
end

script.on_event(defines.events.on_tick, function(event)
  local t = storage.run; if not t or t.done then return end
  local tick = event.tick - t.begin
  if tick == 1 then
    -- Power and fluid networks as the static model says.
    local entryNetwork = t.entities[M.power.entry].electric_network_id
    local unpowered = {}
    for id, e in pairs(t.entities) do
      if (e.type == 'inserter' or e.type == 'assembling-machine') and (not e.is_connected_to_electric_network() or e.electric_network_id ~= entryNetwork) then unpowered[#unpowered + 1] = {id = id, x = e.position.x, y = e.position.y} end
    end
    record(t, 'all machines and arms have actual native power connections on the one network of the power connection', #unpowered == 0, unpowered)
    local poleNetworks = {}
    for _, id in ipairs(M.power.poles) do poleNetworks[t.entities[id].electric_network_id or -1] = true end
    local n = 0; for _ in pairs(poleNetworks) do n = n + 1 end
    record(t, 'the substations form one copper network', n == 1)
    -- Fluid segments: each static network is one native segment, and different networks are different segments.
    local seen, segmentOf, ok = {}, {}, true
    local detail = {}
    for _, comp in ipairs(M.fluidComponents) do
      local ids = {}
      for _, id in ipairs(comp.entities) do
        local e = t.entities[id]
        local list = {}
        if e.type == 'pipe' or e.type == 'pipe-to-ground' then list = {1} else for i = 1, e.fluids_count do local f = e.get_fluid_filter(i); if f and f.name == comp.fluid then list[#list + 1] = i end end end
        for _, i in ipairs(list) do
          local seg = segment_of(e, i)
          if seg then
            if comp.fluid then
              local already = segmentOf[seg]
              if already and already ~= comp.id then ok = false; detail[#detail + 1] = {segment = seg, components = {already, comp.id}} end
              segmentOf[seg] = comp.id
            end
            ids[seg] = true
          end
        end
      end
      local segs = 0; for _ in pairs(ids) do segs = segs + 1 end
      -- A component is one segment unless it holds only machine boxes joined through undergrounds the game reports as one.
      if segs > 1 then ok = false; detail[#detail + 1] = {component = comp.id, fluid = comp.fluid, segments = segs} end
    end
    record(t, 'the pipes, undergrounds and machine boxes form exactly the static fluid networks, one fluid each', ok, detail)
    local fixtureOk = true
    for _, in_ in ipairs(t.inputs) do
      if in_.kind == 'pipe' then
        local seg = segment_of(in_.fixture, 1)
        local ref = segment_of(in_.entity, 1)
        if not seg or seg ~= ref then fixtureOk = false end
      end
    end
    for _, out in ipairs(t.outputs) do
      if out.kind == 'pipe' then
        local seg = segment_of(out.fixture, 1)
        local ref = segment_of(out.entity, 1)
        if not seg or seg ~= ref then fixtureOk = false end
      end
    end
    record(t, 'every outside fixture pipe joins the segment of its entrance or exit pipe', fixtureOk)
  end
  -- Which phase are we in?
  local index
  for i, def in ipairs(phases) do if tick > def.start and tick <= def.stop then index = i end end
  if index then
    local def = phases[index]
    local ph = t.phaseData[index] or begin_phase(t, index)
    local rel = tick - def.start
    for _, in_ in ipairs(t.inputs) do feed(t, in_, def.spec.feed[in_.id] or 'none', tick, ph) end
    for _, out in ipairs(t.outputs) do drain(t, out, def.spec.draw[out.id] or 'none', tick, ph) end
    if rel % 60 == 0 then
      -- One row per second: what went in and out, machine statuses, mixing and exit contents.
      for _, out in ipairs(t.outputs) do local s = ph.seconds[out.id]; s[#s + 1] = ph.drawnSecond[out.id] or 0 end
      for _, m in ipairs(t.machines) do local name = status_name(m.e); local s = ph.status[m.entity] or {}; s[name] = (s[name] or 0) + 1; ph.status[m.entity] = s end
      mix_check(t, ph)
      ph.drawnSecond = {}
      if rel % PER_MINUTE == 0 then
        local row = {fed = {}, drawn = {}}
        for id, v in pairs(ph.fed) do row.fed[id] = v - (ph.lastFed and ph.lastFed[id] or 0) end
        for id, v in pairs(ph.drawn) do row.drawn[id] = v - (ph.lastDrawn and ph.lastDrawn[id] or 0) end
        ph.minutes[#ph.minutes + 1] = row
        ph.lastFed, ph.lastDrawn = {}, {}
        for id, v in pairs(ph.fed) do ph.lastFed[id] = v end
        for id, v in pairs(ph.drawn) do ph.lastDrawn[id] = v end
      end
    end
    local tailMinutes = def.spec.expect and def.spec.expect.stopped
    if tailMinutes and rel == def.spec.ticks - tailMinutes * PER_MINUTE then ph.craftsTail = snapshot_machines(t) end
    if rel == def.spec.ticks then
      t.results = t.results or {}
      t.results[#t.results + 1] = finish_phase(t, ph, def)
    end
  end
  if tick == total then
    local clean = #t.failures == 0
    local report = {schema = 1, passed = clean, failures = t.failures, checks = t.checks, gameVersion = script.active_mods.base, activeMods = T.activeMods,
      blueprintSha256 = T.blueprintSha256, prototypeSha256 = T.prototypeSha256, configurationSha256 = T.configurationSha256, nativeControlSha256 = T.nativeControlSha256,
      actualTicks = tick, scenario = {name = SC.name, description = SC.description}, protocol = P, phases = t.results, routeEvidence = t.routes,
      surface = {name = t.surface.name, pressure = t.surface.get_property('pressure'), gravity = t.surface.get_property('gravity')},
      blueprintEntityCount = #T.entities, fixtureEntityCount = #t.fixtures, footprint = M.footprint, technologyClosure = T.technologyClosure}
    helpers.write_file('vulcanus-supplies/native-report.json', helpers.table_to_json(report), false)
    log('VULCANUS_SUPPLY_RESULT ' .. helpers.table_to_json({passed = report.passed, failures = report.failures, blueprintSha256 = report.blueprintSha256}))
    t.done = true
  end
end)
