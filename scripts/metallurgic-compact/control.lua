-- Native harness of the compact metallurgic science pack blueprint. One scenario per game run.
-- The exact blueprint is imported on a Vulcanus surface and never repaired. Only the declared ports are touched:
--   IN-1, IN-2  requester chests: items are put into the chest (what the robot network would deliver), never more than the request
--   IN-3        molten copper: fluid put into one outside pipe at the entrance
--   OUT-1       the provider chest: packs are taken out of it (what robots would take), all, none or a per-minute figure
--   power       one energy interface on an outside substation wired to the entry substation
-- A scenario is a list of phases: a length, a feed per entrance ('generous' | per-minute figure | 'none') and a draw ('all' | 'none').
-- Per phase the harness records what went in and out per minute, the foundry status shares, the chest contents, and every second
-- checks that the foundry and pipes hold no fluid but molten copper and that the output chest never holds more than one stack.
local T = require('fixture')
local M, P, SC = T.manifest, T.protocol, T.scenario
local PER_MINUTE = 3600
local PACK, CAP = T.product, T.cap
local function require_ok(ok, message) if not ok then error('METALLURGIC: ' .. message) end end
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
local function inv(e) return e.get_inventory(defines.inventory.chest) end
local function fixture(t, name, position)
  local e = t.surface.create_entity{name = name, position = position, force = t.force}
  require_ok(e, 'fixture placement ' .. name); t.fixtures[#t.fixtures + 1] = e; return e
end
local function set_power(t, on)
  t.power.power_production = on and P.externalPowerWatts or 0
  t.power.electric_buffer_size = P.externalPowerWatts
  t.power.energy = on and P.externalPowerWatts or 0
end

-- The requests the game reports for a requester chest, as {name = count}.
local function requests_of(e)
  local out = {}
  local ok = pcall(function()
    local point = e.get_logistic_point(defines.logistic_member_index.logistic_container)
    for _, section in pairs(point.sections) do
      for _, f in pairs(section.filters) do
        if f.value then out[f.value.name] = {min = f.min, max = f.max, quality = f.value.quality, comparator = f.value.comparator} end
      end
    end
  end)
  return out, ok
end

local function after_build(t)
  local surface, force, dx, dy = t.surface, t.force, t.offset.x, t.offset.y
  local exact, count = true, 0
  for _, spec in ipairs(T.entities) do
    local e = surface.find_entity(spec.name, {spec.position.x + dx, spec.position.y + dy})
    require_ok(e, 'missing blueprint entity #' .. spec.entity_number .. ' ' .. spec.name)
    t.entities[spec.entity_number] = e; count = count + 1
    if (spec.name == 'foundry' or spec.name == 'fast-inserter') and e.direction ~= (spec.direction or 0) then exact = false; record(t, 'direction changed #' .. spec.entity_number, false, {want = spec.direction or 0, got = e.direction}) end
    if spec.name == 'display-panel' then record(t, 'display panel visible and worded #' .. spec.entity_number, e.display_panel_always_show and e.display_panel_text == spec.text, {text = e.display_panel_text}) end
  end
  record(t, 'every entity imported at its exact position and direction', exact, {entities = count})
  local found = #surface.find_entities_filtered{force = force} - #t.fixtures
  record(t, 'no entity beyond the blueprint', found == #T.entities, {found = found})
  local fo = t.entities[M.machines[1].entity]
  local recipe = fo.get_recipe()
  record(t, 'recipe preserved', recipe and recipe.name == PACK)
  record(t, 'recipe enabled by the researched closure alone', force.recipes[PACK].enabled)
  local proto = prototypes.recipe[PACK]
  record(t, 'runtime recipe ingredients match the pin', same_map(recipe_map(proto.ingredients), recipe_map(T.recipe.ingredients)))
  record(t, 'runtime recipe products match the pin', same_map(recipe_map(proto.products), recipe_map(T.recipe.results)))
  record(t, 'recipe time matches the pin', math.abs(proto.energy - T.recipe.energy) < 1e-9)
  local mods = fo.get_module_inventory()
  record(t, 'cold foundry with no modules', fo.products_finished == 0 and (mods == nil or mods.is_empty()))
  record(t, 'foundry crafting speed matches the pin', math.abs(fo.crafting_speed - T.foundrySpeed) < 1e-9, {speed = fo.crafting_speed})
  record(t, 'foundry built-in productivity matches the pin', math.abs(fo.productivity_bonus - T.foundryProductivity) < 1e-9, {bonus = fo.productivity_bonus})
  record(t, 'inserter capacity bonus is zero for this force', force.inserter_stack_size_bonus == 0)
  -- arms: every pickup and drop where the audit says
  for _, r in ipairs(M.routes) do
    local a = t.entities[r.inserter]
    record(t, r.label, contains(t.entities[r.from], a.pickup_position) and contains(t.entities[r.to], a.drop_position))
    t.routes[#t.routes + 1] = {label = r.label, inserter = r.inserter, pickup = a.pickup_position, drop = a.drop_position}
  end
  -- requester chests: the request the game reads is the one pinned; the provider chest is capped at one slot
  for _, port in ipairs(M.inputPorts) do
    if port.request then
      local chest = t.entities[port.entity]
      local got, ok = requests_of(chest)
      local r = got[port.item]
      record(t, port.id .. ' requester chest requests ' .. port.request .. ' ' .. port.item, ok and r ~= nil and r.min == port.request and (r.quality == nil or r.quality == 'normal'), got)
      record(t, port.id .. ' chest is a requester', chest.prototype.logistic_mode == 'requester', {mode = chest.prototype.logistic_mode})
    end
  end
  local out = t.entities[M.outputPorts[1].entity]
  record(t, 'OUT-1 chest is a passive provider', out.prototype.logistic_mode == 'passive-provider')
  local bar = inv(out).get_bar()
  record(t, 'OUT-1 chest limited to one slot (the game reports the first blocked slot, 2)', bar == 2, {bar = bar, slots = #inv(out)})
  t.chestBar = bar
  -- fluid ports: which connection of the foundry stands on what
  t.ports = {}
  for i = 1, fo.fluids_count do
    local list = {}
    for _, pc in pairs(fo.get_fluid_box_pipe_connections(i)) do list[#list + 1] = {flow = pc.flow_direction, target = pc.target and pc.target.name or nil, position = pc.position} end
    t.ports[i] = list
  end
  local joined = 0
  for _, list in pairs(t.ports) do for _, c in ipairs(list) do if c.target then joined = joined + 1 end end end
  record(t, 'exactly one foundry fluid port stands on a pipe (the molten copper entrance); no other port faces anything', joined == 1, t.ports)
end

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
  local force = game.create_force('metallurgic-test')
  for _, name in ipairs(T.technologyClosure) do require_ok(force.technologies[name], 'missing technology ' .. name); force.technologies[name].researched = true end
  local t = {surface = surface, force = force, begin = game.tick, checks = {}, failures = {}, entities = {}, inputs = {}, fixtures = {}, routes = {}, results = {}, phaseData = {}, phase = 1, phaseStart = 0}
  record(t, 'surface is the Vulcanus planet with its own surface properties', surface.get_property('pressure') == 4000, {pressure = surface.get_property('pressure')})
  local inventory = game.create_inventory(1)
  inventory[1].set_stack{name = 'blueprint'}
  require_ok(inventory[1].import_stack(T.blueprint) == 0, 'exact blueprint import')
  local ghosts = inventory[1].build_blueprint{surface = surface, force = force, position = {0, 0}, build_mode = defines.build_mode.forced}
  require_ok(#ghosts == #T.entities, 'blueprint ghost count ' .. #ghosts .. ' expected ' .. #T.entities)
  inventory.destroy()
  local gx, gy, sx, sy = math.huge, math.huge, math.huge, math.huge
  for _, g in pairs(ghosts) do gx = math.min(gx, g.position.x); gy = math.min(gy, g.position.y) end
  for _, spec in ipairs(T.entities) do sx = math.min(sx, spec.position.x); sy = math.min(sy, spec.position.y) end
  local dx, dy = gx - sx, gy - sy
  t.offset = {x = dx, y = dy}
  local byPlace = {}
  for _, g in pairs(ghosts) do byPlace[string.format('%s@%.1f,%.1f', g.ghost_name, g.position.x - dx, g.position.y - dy)] = g end
  t.externalPole = fixture(t, 'substation', {M.power.externalPole.x + dx, M.power.externalPole.y + dy})
  t.power = fixture(t, 'electric-energy-interface', {M.power.externalPole.x + 3 + dx, M.power.externalPole.y + dy})
  set_power(t, true)
  for _, spec in ipairs(T.entities) do
    local g = byPlace[string.format('%s@%.1f,%.1f', spec.name, spec.position.x, spec.position.y)]
    require_ok(g, 'ghost not where expected: #' .. spec.entity_number)
    local _, entity = g.revive{raise_revive = true}
    require_ok(entity, 'blueprint revival #' .. spec.entity_number)
    t.entities[spec.entity_number] = entity
  end
  local a = t.externalPole.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  local b = t.entities[M.power.entry].get_wire_connector(defines.wire_connector_id.pole_copper, true)
  a.connect_to(b)
  require_ok(a.is_connected_to(b), 'external power wire')
  -- ports
  for _, port in ipairs(M.inputPorts) do
    local in_ = {port = port, id = port.id, item = port.item, credit = 0, carry = 0}
    if port.kind == 'pipe' then in_.fixture = fixture(t, 'pipe', {port.externalContact.x + 0.5 + dx, port.externalContact.y + 0.5 + dy})
    else in_.chest = t.entities[port.entity] end
    t.inputs[#t.inputs + 1] = in_
  end
  t.out = t.entities[M.outputPorts[1].entity]
  t.foundry = t.entities[M.machines[1].entity]
  t.pipeEntity = nil
  for _, spec in ipairs(T.entities) do if spec.name == 'pipe' then t.pipeEntity = t.entities[spec.entity_number] end end
  after_build(t)
  storage.run = t
end)

local function begin_phase(t, i)
  local spec = SC.phases[i]
  local ph = {name = spec.name, fed = {}, fedSecond = {}, drawn = 0, drawnSecond = 0, minutes = {}, seconds = {}, status = {}, mixedSeconds = 0, chestMax = 0, startProducts = t.foundry.products_finished, lastFed = {}, lastDrawn = 0, noPower = 0}
  t.phaseData[i] = ph
  return ph
end

local function feed(t, in_, mode, ph)
  local added = 0
  if in_.chest then
    if mode == 'none' then return end
    local have = inv(in_.chest).get_item_count(in_.item)
    local room = in_.port.request - have
    if room <= 0 then if mode ~= 'generous' then in_.credit = math.min(in_.credit, 1) end return end
    if mode == 'generous' then added = inv(in_.chest).insert{name = in_.item, count = room}
    else
      in_.credit = in_.credit + mode / PER_MINUTE
      local n = math.min(math.floor(in_.credit), room)
      if n > 0 then added = inv(in_.chest).insert{name = in_.item, count = n}; in_.credit = in_.credit - added end
      in_.credit = math.min(in_.credit, 1)
    end
  else
    if mode == 'none' then return end
    local want = mode == 'generous' and 1000 or (mode / PER_MINUTE + in_.carry)
    added = in_.fixture.insert_fluid{name = in_.item, amount = want, temperature = T.fluidTemperature}
    if mode ~= 'generous' then in_.carry = math.min(want - added, mode / PER_MINUTE * 60) end
  end
  ph.fed[in_.id] = (ph.fed[in_.id] or 0) + added
end

local function check_mixing(t, ph)
  local bad = false
  local function look(e)
    if e and e.valid then for name in pairs(e.get_fluid_contents()) do if name ~= 'molten-copper' then bad = true end end end
  end
  look(t.foundry); look(t.pipeEntity)
  for _, in_ in ipairs(t.inputs) do look(in_.fixture) end
  if bad then ph.mixedSeconds = ph.mixedSeconds + 1; record(t, 'foreign fluid in a machine or pipe (' .. ph.name .. ')', false) end
end

local function finish_phase(t, ph, spec, rel, ended)
  local out = {name = spec.name, ticks = rel, minutes = rel / PER_MINUTE, endedBy = ended, fedPerMinute = {}, drawnPerMinute = {}, status = ph.status, mixedSeconds = ph.mixedSeconds, chestMax = ph.chestMax, chestFinal = inv(t.out).get_item_count(PACK),
    products = t.foundry.products_finished - ph.startProducts, noPowerSeconds = ph.noPower, feedModes = spec.feed}
  local from = (spec.measureFrom or 0) / PER_MINUTE
  local rows = {}
  for i = 1, #ph.minutes do if i > from then rows[#rows + 1] = ph.minutes[i] end end
  local function mean(key)
    local sum = 0
    for _, row in ipairs(rows) do sum = sum + (type(row[key]) == 'number' and row[key] or 0) end
    return #rows > 0 and sum / #rows or 0
  end
  out.drawnPerMinute = {measured = mean('drawn'), minutesMeasured = #rows}
  for id in pairs(ph.fed) do
    local s = 0; for _, row in ipairs(rows) do s = s + (row.fed[id] or 0) end
    out.fedPerMinute[id] = #rows > 0 and s / #rows or 0
  end
  out.drawnTotal = ph.drawn
  local ex = spec.expect or {}
  if ex.minDrawn then record(t, spec.name .. ': packs a minute at least ' .. ex.minDrawn, out.drawnPerMinute.measured >= ex.minDrawn - 1e-9, {measured = out.drawnPerMinute.measured}) end
  if ex.maxDrawn then record(t, spec.name .. ': packs drawn at most ' .. ex.maxDrawn .. ' in the phase', ph.drawn <= ex.maxDrawn, {drawn = ph.drawn}) end
  if ex.chestFull then record(t, spec.name .. ': output chest ends exactly full at one stack (' .. CAP .. ')', out.chestFinal == CAP, {chest = out.chestFinal}) end
  if ex.stopped then
    local ref = ph.minutes[#ph.minutes - ex.stopped]
    local stuck = ref and ref.products == t.foundry.products_finished
    record(t, spec.name .. ': foundry crafted nothing in the last ' .. ex.stopped .. ' minutes', stuck == true, {products = t.foundry.products_finished})
    record(t, spec.name .. ': foundry ended with its output full', status_name(t.foundry) == 'full_output', {status = status_name(t.foundry)})
  end
  if ex.recoverTo then
    local span, target, reached = 60, ex.recoverTo.target, nil
    for s = span, #ph.seconds do
      local sum = 0
      for k = s - span + 1, s do sum = sum + ph.seconds[k] end
      if sum >= target * ex.recoverTo.share - 1e-9 then reached = s; break end
    end
    out.recovery = {target = target, share = ex.recoverTo.share, secondsToReach = reached}
    record(t, spec.name .. ': back to ' .. (ex.recoverTo.share * 100) .. '% of ' .. target .. ' a minute within ' .. ex.recoverTo.withinSeconds .. ' s', reached ~= nil and reached <= ex.recoverTo.withinSeconds, {seconds = reached})
  end
  if ex.noMixing ~= false then record(t, spec.name .. ': no foreign fluid', ph.mixedSeconds == 0) end
  if ex.noPower ~= false then record(t, spec.name .. ': power on all the time', ph.noPower == 0, {seconds = ph.noPower}) end
  return out
end

local function finish_run(t, tick)
  local clean = #t.failures == 0
  local report = {schema = 1, passed = clean, failures = t.failures, checks = t.checks, gameVersion = script.active_mods.base, activeMods = T.activeMods,
    blueprintSha256 = T.blueprintSha256, prototypeSha256 = T.prototypeSha256, configurationSha256 = T.configurationSha256, nativeControlSha256 = T.nativeControlSha256,
    actualTicks = tick, scenario = {name = SC.name, description = SC.description}, protocol = P, phases = t.results, routeEvidence = t.routes, foundryPorts = t.ports, chestBar = t.chestBar,
    surface = {name = t.surface.name, pressure = t.surface.get_property('pressure')}, blueprintEntityCount = #T.entities, fixtureEntityCount = #t.fixtures, footprint = M.footprint, technologyClosure = T.technologyClosure}
  helpers.write_file('metallurgic-compact/native-report.json', helpers.table_to_json(report), false)
  log('METALLURGIC_RESULT ' .. helpers.table_to_json({passed = report.passed, failures = report.failures, blueprintSha256 = report.blueprintSha256}))
  t.done = true
  for _, e in pairs(t.surface.find_entities()) do if e.valid then e.destroy() end end
  storage.run = {done = true}
end

script.on_event(defines.events.on_tick, function(event)
  local t = storage.run; if not t or t.done then return end
  local tick = event.tick - t.begin
  if tick < 1 then return end
  if tick == 1 then log('METALLURGIC_START') end
  local spec = SC.phases[t.phase]
  if not spec then return end
  local ph = t.phaseData[t.phase] or begin_phase(t, t.phase)
  local rel = tick - t.phaseStart
  for _, in_ in ipairs(t.inputs) do feed(t, in_, spec.feed[in_.id] or 'none', ph) end
  -- the exit: robots would take the packs; 'all' takes every pack every four ticks, 'none' leaves them
  if spec.draw == 'all' and rel % 4 == 0 then
    local n = inv(t.out).get_item_count(PACK)
    if n > 0 then inv(t.out).remove{name = PACK, count = n}; ph.drawn = ph.drawn + n; ph.drawnSecond = ph.drawnSecond + n end
  end
  local held = inv(t.out).get_item_count(PACK)
  if held > ph.chestMax then ph.chestMax = held end
  if held > CAP then record(t, 'output chest holds more than one stack (' .. held .. ')', false) end
  if rel % 60 == 0 then
    ph.seconds[#ph.seconds + 1] = ph.drawnSecond; ph.drawnSecond = 0
    local name = status_name(t.foundry); ph.status[name] = (ph.status[name] or 0) + 1
    if name == 'no_power' or name == 'low_power' then ph.noPower = ph.noPower + 1 end
    check_mixing(t, ph)
    if rel % PER_MINUTE == 0 then
      local row = {fed = {}, drawn = ph.drawn - ph.lastDrawn, products = t.foundry.products_finished}
      for id, v in pairs(ph.fed) do row.fed[id] = v - (ph.lastFed[id] or 0) end
      ph.minutes[#ph.minutes + 1] = row
      ph.lastDrawn = ph.drawn
      for id, v in pairs(ph.fed) do ph.lastFed[id] = v end
    end
  end
  if rel == spec.ticks then
    t.results[#t.results + 1] = finish_phase(t, ph, spec, rel, 'limit')
    t.phase = t.phase + 1; t.phaseStart = tick
    if not SC.phases[t.phase] then finish_run(t, tick) end
  end
end)
