-- Native harness of the Vulcanus science blueprint. One scenario per game. Imports the exact blueprint string on a Vulcanus
-- surface (all at once, or a few entities at a time in a given order) and never repairs it. Supplies only the declared ports
-- (belts: items put on the entrance belt; pipes: fluid put into one outside pipe), takes stone from the stone exit, packs
-- from the two chests, and gives outside power through the marked substation.
-- The run is a list of phases (T.phases): a length in ticks or a goal with a limit, what each port is offered, whether packs
-- and stone are taken, and what must hold at the end. Every few ticks every pipe and machine is checked for a foreign fluid.
local T = require('fixture')
local M = T.manifest
local PER_MINUTE = 3600
local STATUS = {} for n, v in pairs(defines.entity_status) do STATUS[v] = n end
local ROT = {[0] = function(x, y) return x, y end, [4] = function(x, y) return -y, x end, [8] = function(x, y) return -x, -y end, [12] = function(x, y) return y, -x end}
local function fail(message) error('VULCANUS_SCIENCE: ' .. message) end
local function record(t, name, passed, detail)
  t.checks[#t.checks + 1] = {name = name, passed = not not passed, detail = detail}
  if not passed then t.failures[#t.failures + 1] = name end
end
-- blueprint coordinates -> world, through the placement's rotation about the anchor entity
local function world(t, x, y)
  local rx, ry = ROT[T.rotation](x - t.anchorSpec.x, y - t.anchorSpec.y)
  return {x = t.anchorWorld.x + rx, y = t.anchorWorld.y + ry}
end
local function key(p) return string.format('%.1f,%.1f', p.x, p.y) end

local function fixture(t, name, position, direction)
  local e = t.surface.create_entity{name = name, position = position, force = t.force, direction = direction}
  if not e then fail('fixture placement ' .. name .. ' at ' .. position.x .. ',' .. position.y) end
  t.fixtures[#t.fixtures + 1] = e
  return e
end

script.on_init(function()
  if script.active_mods.base ~= T.gameVersion then fail('wrong game version') end
  game.map_settings.pollution.enabled = false
  game.map_settings.enemy_expansion.enabled = false
  local surface = game.planets[M.surface].create_surface()
  surface.request_to_generate_chunks({0, 0}, 3) surface.force_generate_chunk_requests()
  for _, e in pairs(surface.find_entities()) do if e.valid then e.destroy() end end
  local tiles = {} for x = -96, 95 do for y = -96, 95 do tiles[#tiles + 1] = {name = 'volcanic-ash-flats', position = {x, y}} end end
  surface.set_tiles(tiles)
  for _, e in pairs(surface.find_entities()) do if e.valid then e.destroy() end end
  surface.always_day = true
  for c in surface.get_chunks() do if c.x < -3 or c.x > 2 or c.y < -3 or c.y > 2 then surface.delete_chunk({c.x, c.y}) end end
  for c in game.surfaces[1].get_chunks() do game.surfaces[1].delete_chunk({c.x, c.y}) end
  local force = game.create_force('vulcanus-science-test')
  for _, name in ipairs(T.technologyClosure) do if not force.technologies[name] then fail('missing technology ' .. name) end force.technologies[name].researched = true end
  local t = {surface = surface, force = force, begin = game.tick, checks = {}, failures = {}, entities = {}, fixtures = {}, phases = {}, phase = 0, fed = {}, carry = {}, credit = {}, lane = {}, stoneOut = 0, collected = {}, fluidFaults = {}, fluidFaultCount = 0, fluidChecks = 0, built = 0}
  t.pressure = surface.get_property('pressure')
  t.bonus = {stack = force.inserter_stack_size_bonus, bulk = force.bulk_inserter_capacity_bonus}
  local inventory = game.create_inventory(1)
  inventory[1].set_stack{name = 'blueprint'}
  if inventory[1].import_stack(T.blueprint) ~= 0 then fail('exact blueprint import') end
  local ghosts = inventory[1].build_blueprint{surface = surface, force = force, position = {0, 0}, direction = T.rotation, build_mode = defines.build_mode.forced}
  inventory.destroy()
  record(t, 'every blueprint entity became a ghost', #ghosts == #T.entities, {ghosts = #ghosts, entities = #T.entities})
  -- the anchor: the one foundry that casts iron sticks
  local anchorSpec for _, spec in ipairs(T.entities) do if spec.entity_number == M.anchor then anchorSpec = spec end end
  local anchor
  for _, g in pairs(ghosts) do if g.ghost_name == 'foundry' then local r = g.get_recipe() if r and r.name == anchorSpec.recipe then anchor = g end end end
  if not anchor then fail('anchor ghost') end
  t.anchorSpec = {x = anchorSpec.position.x, y = anchorSpec.position.y}
  t.anchorWorld = {x = anchor.position.x, y = anchor.position.y}
  local byPosition = {}
  for _, g in pairs(ghosts) do byPosition[g.ghost_name .. '@' .. key(g.position)] = g end
  t.ghosts = {} t.specs = {}
  local missing = {}
  for _, spec in ipairs(T.entities) do
    local w = world(t, spec.position.x, spec.position.y)
    local g = byPosition[spec.name .. '@' .. key(w)]
    if not g then missing[#missing + 1] = spec.entity_number else t.ghosts[spec.entity_number] = g end
    t.specs[spec.entity_number] = spec
  end
  record(t, 'every ghost stands where the placement rotation puts its blueprint entity', #missing == 0, missing)
  if #missing > 0 then fail('ghosts not where expected: ' .. helpers.table_to_json(missing)) end
  -- outside fixtures: power, one pipe beyond every fluid port
  local pole = world(t, M.power.externalPole.x, M.power.externalPole.y)
  t.externalPole = fixture(t, 'substation', pole)
  local far = world(t, M.power.externalPole.x - 3, M.power.externalPole.y)
  t.power = fixture(t, 'electric-energy-interface', far)
  t.power.power_production = T.externalPowerWatts / 60 t.power.electric_buffer_size = T.externalPowerWatts t.power.energy = T.externalPowerWatts
  t.ports = {}
  for _, port in ipairs(M.ports) do
    local entry = {id = port.id, item = port.item, kind = port.kind, exit = port.exit, number = port.entity, perMinute = port.perMinute}
    if port.kind == 'pipe' then entry.pipe = fixture(t, 'pipe', world(t, port.externalContact.x, port.externalContact.y)) end
    t.ports[#t.ports + 1] = entry t.fed[port.id] = 0 t.carry[port.id] = 0 t.credit[port.id] = 0 t.lane[port.id] = 0
  end
  t.order = T.build.order t.orderIndex = 0
  storage.run = t
end)

local function revive(t, number)
  local g = t.ghosts[number]
  if not (g and g.valid) then fail('ghost gone #' .. number) end
  local _, e = g.revive{raise_revive = false}
  if not e then fail('revive #' .. number .. ' ' .. t.specs[number].name) end
  t.entities[number] = e t.ghosts[number] = nil t.built = t.built + 1
  if number == M.power.entry then
    local a, b = t.externalPole.get_wire_connector(defines.wire_connector_id.pole_copper, true), e.get_wire_connector(defines.wire_connector_id.pole_copper, true)
    if not a.is_connected_to(b) then a.connect_to(b) end
    if not a.is_connected_to(b) then fail('external power wire') end
  end
end

-- Checks made once, when every entity stands.
local function check_import(t)
  local wrong = {}
  for number, spec in pairs(t.specs) do
    local e = t.entities[number]
    local w = world(t, spec.position.x, spec.position.y)
    if not (e and e.valid and e.name == spec.name and math.abs(e.position.x - w.x) < 0.01 and math.abs(e.position.y - w.y) < 0.01) then wrong[#wrong + 1] = number
    else
      if spec.recipe then local r = e.get_recipe() if not (r and r.name == spec.recipe) then wrong[#wrong + 1] = number end end
      if spec.override_stack_size and e.inserter_stack_size_override ~= spec.override_stack_size then wrong[#wrong + 1] = number end
      if spec.name == 'display-panel' and not (e.display_panel_always_show and e.display_panel_text == spec.text) then wrong[#wrong + 1] = number end
      if spec.bar and e.get_inventory(defines.inventory.chest).get_bar() ~= spec.bar + 1 then wrong[#wrong + 1] = number end
    end
  end
  record(t, 'every entity stands at its place with its recipe, hand size, panel text and chest limit', #wrong == 0, wrong)
  record(t, 'no entity beyond the blueprint and the outside fixtures', #t.surface.find_entities_filtered{force = t.force} == #T.entities + #t.fixtures, {found = #t.surface.find_entities_filtered{force = t.force}})
  local modules, circuitRecipe = 0, 0
  for _, m in ipairs(M.machines) do
    local e = t.entities[m.entity]
    local inv = e.get_module_inventory() if inv and not inv.is_empty() then modules = modules + 1 end
    local cb = e.get_control_behavior() if cb and e.type == 'assembling-machine' and cb.circuit_set_recipe then circuitRecipe = circuitRecipe + 1 end
  end
  record(t, 'no modules and no recipe set by circuit', modules == 0 and circuitRecipe == 0, {modules = modules, circuitRecipe = circuitRecipe})
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
  -- fluid networks: one representative pipe per segment, each segment one expected fluid
  local segments, mixed = {}, {}
  t.fluidPipes = {} t.fluidMachines = {}
  for number, fluid in pairs(M.fluidOf) do
    local e = t.entities[tonumber(number)]
    t.fluidPipes[#t.fluidPipes + 1] = {e = e, fluid = fluid, number = tonumber(number)}
    local id = e.get_fluid_segment_id(1)
    if id then if segments[id] and segments[id].fluid ~= fluid then mixed[#mixed + 1] = tonumber(number) end segments[id] = segments[id] or {e = e, fluid = fluid, number = tonumber(number)} end
  end
  for number, list in pairs(M.machineFluids) do local allowed = {} for _, f in ipairs(list) do allowed[f] = true end t.fluidMachines[#t.fluidMachines + 1] = {e = t.entities[tonumber(number)], allowed = allowed, number = tonumber(number)} end
  t.segments = {} for _, s in pairs(segments) do t.segments[#t.segments + 1] = s end
  record(t, 'no pipe segment joins pipes of two fluids', #mixed == 0, mixed)
  t.segmentCount = #t.segments
  -- every machine fluid box is filtered to a fluid of its own list and joins only its own fluid's pipes
  local boxFaults = {}
  for _, m in ipairs(t.fluidMachines) do
    for i = 1, m.e.fluids_count do
      local f = m.e.get_fluid_filter(i)
      if f and not m.allowed[f.name] then boxFaults[#boxFaults + 1] = {m.number, f.name} end
      for _, pc in pairs(m.e.get_fluid_box_pipe_connections(i)) do
        if pc.target then
          local other
          for number, e in pairs(t.entities) do if e == pc.target then other = number break end end
          local of = other and M.fluidOf[tostring(other)]
          if not (f and of == f.name) then boxFaults[#boxFaults + 1] = {m.number, i, other or 'outside', of or 'none'} end
        end
      end
    end
  end
  record(t, 'every machine port joins a pipe of exactly its own fluid or nothing', #boxFaults == 0, boxFaults)
  t.complete = true t.completeTick = game.tick - t.begin
end

local function fluid_sweep(t, tick, full)
  t.fluidChecks = t.fluidChecks + 1
  local function fault(number, expected, found)
    t.fluidFaultCount = t.fluidFaultCount + 1
    if #t.fluidFaults < 12 then t.fluidFaults[#t.fluidFaults + 1] = {entity = number, expected = expected, found = found, tick = tick} end
  end
  if t.complete and not full then
    for _, s in ipairs(t.segments) do for name in pairs(s.e.get_fluid_contents()) do if name ~= s.fluid then fault(s.number, s.fluid, name) end end end
    for _, m in ipairs(t.fluidMachines) do for name in pairs(m.e.get_fluid_contents()) do if not m.allowed[name] then fault(m.number, 'own', name) end end end
  else
    for number, fluid in pairs(M.fluidOf) do local e = t.entities[tonumber(number)] if e and e.valid then for name in pairs(e.get_fluid_contents()) do if name ~= fluid then fault(tonumber(number), fluid, name) end end end end
    for number, list in pairs(M.machineFluids) do local e = t.entities[tonumber(number)] if e and e.valid then for name in pairs(e.get_fluid_contents()) do local ok = false for _, f in ipairs(list) do if f == name then ok = true end end if not ok then fault(tonumber(number), 'own', name) end end end end
  end
  for _, port in ipairs(t.ports) do if port.pipe then for name in pairs(port.pipe.get_fluid_contents()) do if name ~= port.item then fault(port.id, port.item, name) end end end end
end

local function pack_crafts(t)
  local c = {}
  for item, list in pairs(M.packMachines) do local n = 0 for _, number in ipairs(list) do local e = t.entities[number] if e then n = n + e.products_finished end end c[item] = n end
  return c
end
local function chest_counts(t)
  local c = {}
  for _, o in ipairs(M.outputs) do local e = t.entities[o.chest] c[o.item] = e and e.get_item_count(o.item) or 0 end
  return c
end
local function consumption(t)
  local items, fluids = t.force.get_item_production_statistics(t.surface), t.force.get_fluid_production_statistics(t.surface)
  return {lava = fluids.get_output_count('lava'), ['sulfuric-acid'] = fluids.get_output_count('sulfuric-acid'), lubricant = fluids.get_output_count('lubricant'), calcite = items.get_output_count('calcite'), ['plastic-bar'] = items.get_output_count('plastic-bar'),
    ['stone made'] = items.get_input_count('stone'), ['stone used'] = items.get_output_count('stone'), ['molten-iron'] = fluids.get_input_count('molten-iron'), ['molten-copper'] = fluids.get_input_count('molten-copper')}
end
local function products(t) local c = {} for _, m in ipairs(M.machines) do local e = t.entities[m.entity] c[m.entity] = e and e.products_finished or 0 end return c end

local function begin_phase(t, tick)
  t.phase = t.phase + 1
  local spec = T.phases[t.phase]
  if not spec then return false end
  local ph = {name = spec.name, start = tick, fedAtStart = {}, collected = {}, stoneAtStart = t.stoneOut, craftsAtStart = pack_crafts(t), consumedAtStart = consumption(t), productsAtStart = products(t), status = {}, faultsAtStart = t.fluidFaultCount}
  for id, n in pairs(t.fed) do ph.fedAtStart[id] = n end
  t.current = {spec = spec, record = ph, quiet = 0, lastCrafts = pack_crafts(t)}
  t.phases[#t.phases + 1] = ph
  return true
end
local function end_phase(t, tick, why)
  local ph, spec = t.current.record, t.current.spec
  ph.ticks = tick - ph.start ph.endedBy = why
  local minutes = ph.ticks / PER_MINUTE
  ph.minutes = minutes
  ph.chests = chest_counts(t)
  ph.packsPerMinute = {} ph.packCrafts = {} ph.fedPerMinute = {} ph.consumedPerMinute = {}
  local crafts = pack_crafts(t)
  for _, o in ipairs(M.outputs) do ph.packsPerMinute[o.item] = (ph.collected[o.item] or 0) / minutes ph.packCrafts[o.item] = crafts[o.item] - ph.craftsAtStart[o.item] end
  for id, n in pairs(t.fed) do ph.fedPerMinute[id] = (n - (ph.fedAtStart[id] or 0)) / minutes end
  for k, v in pairs(consumption(t)) do ph.consumedPerMinute[k] = (v - ph.consumedAtStart[k]) / minutes end
  ph.stoneOutPerMinute = (t.stoneOut - ph.stoneAtStart) / minutes
  ph.foreignFluidFaults = t.fluidFaultCount - ph.faultsAtStart
  -- per recipe: crafts per minute and the share of each status (one sample a second)
  local now, byRecipe = products(t), {}
  for _, m in ipairs(M.machines) do
    local r = byRecipe[m.role] or {machines = 0, productsPerMinute = 0, status = {}, idle = 0}
    r.machines = r.machines + 1
    local made = now[m.entity] - ph.productsAtStart[m.entity]
    r.productsPerMinute = r.productsPerMinute + made / minutes
    if made == 0 then r.idle = r.idle + 1 end
    for name, n in pairs(ph.status[m.entity] or {}) do r.status[name] = (r.status[name] or 0) + n end
    -- what the machines of this role hold at the end of the phase (inputs, outputs, fluids), summed
    r.holds = r.holds or {}
    local e = t.entities[m.entity]
    if e then
      for _, id in ipairs({defines.inventory.crafter_input, defines.inventory.crafter_output}) do local inv = e.get_inventory(id) if inv then for _, st in pairs(inv.get_contents()) do local k = (id == defines.inventory.crafter_input and 'in ' or 'out ') .. st.name r.holds[k] = (r.holds[k] or 0) + st.count end end end
      for name, amount in pairs(e.get_fluid_contents()) do r.holds['fluid ' .. name] = math.floor((r.holds['fluid ' .. name] or 0) + amount) end
    end
    byRecipe[m.role] = r
  end
  ph.byRecipe = byRecipe
  ph.fedAtStart = nil ph.craftsAtStart = nil ph.consumedAtStart = nil ph.productsAtStart = nil ph.status = nil ph.stoneAtStart = nil ph.faultsAtStart = nil
  local ex = spec.expect or {}
  if why == 'limit' then record(t, spec.name .. ': goal reached within its limit', false, {limitTicks = spec.limit}) end
  if ex.minPacksOf then for _, item in ipairs(ex.minPacksOf) do record(t, spec.name .. ': ' .. item .. ' at least ' .. ex.floor .. ' a minute', ph.packsPerMinute[item] >= ex.floor - 1e-9, ph.packsPerMinute[item]) end end
  if ex.minPacks then for _, o in ipairs(M.outputs) do record(t, spec.name .. ': ' .. o.item .. ' at least ' .. ex.minPacks .. ' a minute', ph.packsPerMinute[o.item] >= ex.minPacks - 1e-9, ph.packsPerMinute[o.item]) end end
  if ex.chestsFull then for _, o in ipairs(M.outputs) do record(t, spec.name .. ': ' .. o.item .. ' chest holds exactly ' .. o.capacity, ph.chests[o.item] == o.capacity, ph.chests[o.item]) end end
  if ex.zeroPackCrafts then for _, o in ipairs(M.outputs) do record(t, spec.name .. ': no ' .. o.item .. ' was crafted', ph.packCrafts[o.item] == 0, ph.packCrafts[o.item]) end end
  if ex.noPacks then for _, item in ipairs(ex.noPacks) do record(t, spec.name .. ': no ' .. item .. ' reached its chest', (ph.collected[item] or 0) == 0 and ph.chests[item] == 0, {collected = ph.collected[item], chest = ph.chests[item]}) end end
  record(t, spec.name .. ': no pipe or machine held a foreign fluid', ph.foreignFluidFaults == 0, ph.foreignFluidFaults)
end

local function finish(t, tick)
  record(t, 'no foreign fluid at any time (' .. t.fluidChecks .. ' sweeps)', t.fluidFaultCount == 0, t.fluidFaults)
  local report = {schema = 1, passed = #t.failures == 0, failures = t.failures, checks = t.checks, gameVersion = script.active_mods.base, activeMods = T.activeMods, surface = t.surface.name, pressure = t.pressure, bonus = t.bonus,
    blueprintSha256 = T.blueprintSha256, placedSha256 = T.placedSha256, prototypeSha256 = T.prototypeSha256, configurationSha256 = T.configurationSha256, nativeControlSha256 = T.nativeControlSha256, actualTicks = tick, scenario = T.scenario,
    rotation = T.rotation, flip = T.flip, build = {mode = T.build.mode, name = T.build.name, perStep = T.build.perStep, everyTicks = T.build.everyTicks, feedAfterBuild = T.build.feedAfterBuild, completeTick = t.completeTick},
    phases = t.phases, fluidSweeps = t.fluidChecks, fluidFaultCount = t.fluidFaultCount, fluidFaults = t.fluidFaults, segments = t.segmentCount, stoneOut = t.stoneOut, fed = t.fed, blueprintEntityCount = #T.entities, fixtureEntityCount = #t.fixtures}
  if T.debugTiles then
    report.debugTiles = {}
    for _, d in ipairs(T.debugTiles) do
      local w = world(t, d.x + 0.5, d.y + 0.5)
      local out = {x = d.x, y = d.y}
      for _, e in pairs(t.surface.find_entities_filtered{position = w}) do
        out.name = e.name
        if e.type == 'transport-belt' or e.type == 'underground-belt' or e.type == 'splitter' then out.lanes = {} for lane = 1, 2 do local c = {} for _, st in pairs(e.get_transport_line(lane).get_contents()) do c[st.name] = st.count end out.lanes[lane] = c end end
        if e.type == 'inserter' then out.held = e.held_stack.valid_for_read and e.held_stack.name or 'empty' out.status = STATUS[e.status] end
      end
      report.debugTiles[#report.debugTiles + 1] = out
    end
  end
  helpers.write_file('vulcanus-science/native-report.json', helpers.table_to_json(report), false)
  log('VULCANUS_SCIENCE_RESULT ' .. helpers.table_to_json({passed = report.passed, failures = report.failures, ticks = tick}))
  for _, e in pairs(t.surface.find_entities()) do if e.valid then e.destroy() end end
  storage.run = {done = true}
end

local function feed(t, port, mode)
  if mode == 'none' or mode == nil then return end
  local id = port.id
  if port.kind == 'pipe' then
    local want = mode == 'generous' and 2000 or (mode / PER_MINUTE + t.carry[id])
    local n = port.pipe.insert_fluid{name = port.item, amount = want, temperature = T.fluidTemperature[port.item]}
    if mode ~= 'generous' then t.carry[id] = math.min(want - n, mode / PER_MINUTE * 60) end
    t.fed[id] = t.fed[id] + n
  else
    local belt = t.entities[port.number]
    if not (belt and belt.valid) then return end
    if mode == 'generous' then
      for lane = 1, 2 do if belt.get_transport_line(lane).insert_at_back{name = port.item, count = 1} then t.fed[id] = t.fed[id] + 1 end end
    else
      t.credit[id] = math.min(8, t.credit[id] + mode / PER_MINUTE)
      while t.credit[id] >= 1 do
        local lane = t.lane[id] % 2 + 1
        local ok = belt.get_transport_line(lane).insert_at_back{name = port.item, count = 1}
        if not ok then lane = lane % 2 + 1 ok = belt.get_transport_line(lane).insert_at_back{name = port.item, count = 1} end
        if not ok then break end
        t.lane[id] = lane t.credit[id] = t.credit[id] - 1 t.fed[id] = t.fed[id] + 1
      end
    end
  end
end

script.on_event(defines.events.on_tick, function(event)
  local t = storage.run if not t or t.done then return end
  local tick = event.tick - t.begin
  if tick == 0 then return end
  if tick == 1 then log('VULCANUS_SCIENCE_START') if not begin_phase(t, 0) then fail('no phases') end end
  -- building: all at once on the first tick, or a few entities every few ticks in the given order
  if not t.complete then
    if T.build.mode == 'instant' then for _, number in ipairs(t.order) do revive(t, number) end
    elseif tick % T.build.everyTicks == 0 then for _ = 1, T.build.perStep do if t.orderIndex < #t.order then t.orderIndex = t.orderIndex + 1 revive(t, t.order[t.orderIndex]) end end end
    if t.built == #T.entities then check_import(t) end
  end
  local cur = t.current if not cur then return end
  local spec, ph = cur.spec, cur.record
  local feeding = not (T.build.feedAfterBuild and not (t.complete and tick >= t.completeTick + 3600))
  for _, port in ipairs(t.ports) do
    if port.exit then
      if spec.stone ~= false and tick % 4 == 0 then
        local belt = t.entities[port.number]
        if belt and belt.valid then for lane = 1, 2 do local line = belt.get_transport_line(lane) local n = line.get_item_count() if n > 0 then t.stoneOut = t.stoneOut + n line.clear() end end end
      end
    elseif feeding then feed(t, port, spec.feed[port.id]) end
  end
  if tick % 5 == 0 then fluid_sweep(t, tick, tick % 600 == 0) end
  if tick % 60 ~= 0 then return end
  -- once a second: collection, statuses, goals
  if spec.collect ~= false then
    for _, o in ipairs(M.outputs) do local chest = t.entities[o.chest] if chest and (not spec.collectOnly or spec.collectOnly == o.item) then local n = chest.get_item_count(o.item) if n > 0 then chest.remove_item{name = o.item, count = n} ph.collected[o.item] = (ph.collected[o.item] or 0) + n end end end
  end
  for _, m in ipairs(M.machines) do local e = t.entities[m.entity] if e then local s = ph.status[m.entity] if not s then s = {} ph.status[m.entity] = s end local name = STATUS[e.status] or 'other' s[name] = (s[name] or 0) + 1 end end
  local crafts, moved = pack_crafts(t), false
  for item, n in pairs(crafts) do if n ~= cur.lastCrafts[item] then moved = true end end
  cur.lastCrafts = crafts
  if moved then cur.quiet = 0 else cur.quiet = cur.quiet + 1 end
  local finished
  if spec.mode == 'until_rate' then
    -- goal: every pack's trailing ten minutes at or above the floor
    cur.cum = cur.cum or {}
    local n, ok = #cur.cum + 1, true
    local row = {} for _, o in ipairs(M.outputs) do row[o.item] = ph.collected[o.item] or 0 end
    cur.cum[n] = row
    if n <= 600 then ok = false else for _, o in ipairs(M.outputs) do if (row[o.item] - cur.cum[n - 600][o.item]) / 10 < spec.floor then ok = false end end end
    if ok then finished = 'goal' elseif tick - ph.start >= spec.limit then finished = 'limit' end
  elseif spec.mode == 'until' then
    local ok = cur.quiet >= spec.quietSeconds
    if ok and spec.untilChestsFull then for _, o in ipairs(M.outputs) do if t.entities[o.chest].get_item_count(o.item) < o.capacity then ok = false end end end
    if ok and tick - ph.start >= (spec.atLeast or 0) then finished = 'goal' elseif tick - ph.start >= spec.limit then finished = 'limit' end
  elseif tick - ph.start >= spec.ticks then finished = 'ticks' end
  if finished then
    if not t.complete then record(t, 'the blueprint was complete before the first phase ended', false) end
    end_phase(t, tick, finished)
    if not begin_phase(t, tick) then finish(t, tick) end
  end
end)
