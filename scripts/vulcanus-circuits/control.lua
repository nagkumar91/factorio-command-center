-- Native harness of the Vulcanus circuit blueprints (electronic-circuits, advanced-circuits, processing-units). One scenario per
-- game. Imports the exact blueprint on a Vulcanus surface and never repairs it. Runs only in the validator's private save.
-- Supply: only the declared entrances (belts: items put on the entrance belt; pipes: fluid put into one outside pipe) and outside
-- power (an energy interface on an outside substation wired to the labelled one). Removal: only from a belt placed beyond each
-- declared exit, the way a player would connect one.
-- A scenario is a list of phases. A phase is a fixed length ('ticks') or ends when the product leaves at the target share
-- ('until_rate', with a limit that is a failure). Per phase: what each entrance took and each exit gave, what was consumed, what
-- every machine crafted. Every tick every fluid segment is read; every five ticks every machine fluid box: a foreign fluid
-- anywhere at any time fails the run.
local T = require('fixture')
local M, SC, P = T.manifest, T.scenario, T.protocol
local PER_MINUTE = 3600
local STATUS = {} for n, v in pairs(defines.entity_status) do STATUS[v] = n end
local function status_name(e) return STATUS[e.status] or tostring(e.status) end
local function fail(message) error('VULCANUS_CIRCUITS: ' .. message) end
local function record(t, name, passed, detail)
  t.checks[#t.checks + 1] = {name = name, passed = not not passed, detail = detail}
  if not passed then t.failures[#t.failures + 1] = name end
end
local function place_key(name, x, y) return string.format('%s@%.1f,%.1f', name, x, y) end
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
local UNDIRECTED = {pipe = true, substation = true, ['display-panel'] = true}
local IS_UNDERGROUND = {['underground-belt'] = true, ['fast-underground-belt'] = true, ['express-underground-belt'] = true}

-- ---------------------------------------------------------------------------------------------------------------------------
-- Fluid watch: one reading per fluid segment of the blueprint's pipes (a segment holds one fluid, so one member speaks for
-- all of it), rebuilt whenever the piping changes; and every fluid box of every machine.
local function build_fluid_watch(t)
  local watch, seen, fluidOf, numberOf = {}, {}, {}, {}
  for id, fluid in pairs(M.fluidOf) do
    local e = t.entities[tonumber(id)]
    if e and e.valid then
      fluidOf[e.unit_number] = fluid numberOf[e.unit_number] = tonumber(id)
      for i = 1, e.fluids_count do
        local segment = e.has_fluid_segment(i)
        local key = segment and ('s' .. e.get_fluid_segment_id(i)) or ('e' .. id .. ':' .. i)
        if not seen[key] then seen[key] = true watch[#watch + 1] = {entity = e, id = tonumber(id), index = i, expected = fluid, segment = segment} end
      end
    end
  end
  for _, f in ipairs(t.fixturePipes) do
    fluidOf[f.pipe.unit_number] = f.fluid
    watch[#watch + 1] = {entity = f.pipe, id = 'fixture ' .. f.id, index = 1, expected = f.fluid, segment = f.pipe.has_fluid_segment(1)}
  end
  t.watch, t.fluidOf, t.numberOf = watch, fluidOf, numberOf
  local boxes = {}
  for _, m in ipairs(M.machines) do
    local e = t.entities[m.entity]
    if e and e.valid and e.fluids_count > 0 then
      local allowed = {}
      for _, b in ipairs(M.machineBoxes[tostring(m.entity)] or {}) do allowed[b.fluid] = true end
      boxes[#boxes + 1] = {entity = e, id = m.entity, role = m.role, allowed = allowed, count = e.fluids_count}
    end
  end
  t.machineWatch = boxes
end
local function fault(t, tick, where, expected, found, amount)
  local key = where .. '|' .. expected .. '|' .. found
  local f = t.fluidFaultIndex[key]
  if not f then
    f = {where = where, expected = expected, found = found, tick = tick, amount = amount, phase = t.current and t.current.spec.name or (t.building and 'construction' or 'before the first phase'), ticks = 0, peak = 0}
    t.fluidFaultIndex[key] = f t.fluidFaults[#t.fluidFaults + 1] = f
    log('VULCANUS_CIRCUITS_FLUID ' .. helpers.table_to_json(f))
  end
  f.ticks = f.ticks + 1 f.lastTick = tick
  if amount > f.peak then f.peak = amount end
end
local function check_segments(t, tick)
  for _, w in ipairs(t.watch) do
    local e = w.entity
    if e.valid then
      local f = w.segment and e.get_fluid_segment_fluid(w.index) or e.get_fluid(w.index)
      if f and f.name ~= w.expected then fault(t, tick, 'pipes #' .. w.id, w.expected, f.name, f.amount) end
    end
  end
  t.segmentReadings = t.segmentReadings + #t.watch
end
local function check_machines(t, tick)
  for _, w in ipairs(t.machineWatch) do
    local e = w.entity
    if e.valid then for i = 1, w.count do
      local f = e.get_fluid(i)
      if f and not w.allowed[f.name] then fault(t, tick, w.role .. ' #' .. w.id, 'its recipe fluids', f.name, f.amount) end
    end end
  end
  t.machineReadings = t.machineReadings + #t.machineWatch
end
-- A fluid box of a machine joined to a pipe that belongs to another fluid's network (read once a second).
local function check_joins(t, tick)
  for _, w in ipairs(t.machineWatch) do
    local e = w.entity
    if e.valid then for i = 1, w.count do
      local filter = e.get_fluid_filter(i)
      for _, c in ipairs(e.get_fluid_box_pipe_connections(i)) do
        local target = c.target
        if target then
          local other = t.fluidOf[target.unit_number]
          if (not filter) or (other and other ~= filter.name) or (not other) then
            local key = w.id .. '|' .. i
            if not t.joinIndex[key] then t.joinIndex[key] = true t.joins[#t.joins + 1] = {machine = w.role, entity = w.id, box = filter and filter.name or 'no filter', joinedTo = other or target.name, tick = tick} end
          end
        end
      end
    end end
  end
end

-- ---------------------------------------------------------------------------------------------------------------------------
local function set_power(t, on)
  t.power.power_production = on and P.externalPowerWatts / 60 or 0
  t.power.electric_buffer_size = P.externalPowerWatts
  t.power.energy = on and P.externalPowerWatts or 0
  t.powerOn = on
end
local function connect_power(t, entry)
  local a, b = t.externalPole.get_wire_connector(defines.wire_connector_id.pole_copper, true), entry.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  if not a.is_connected_to(b) then a.connect_to(b) end
  if not a.is_connected_to(b) then fail('external power wire') end
end
-- An entity of the blueprint now stands: remember it by its number.
local function register(t, e)
  local number = t.byPlace[place_key(e.name, e.position.x - t.offset.x, e.position.y - t.offset.y)]
  if type(number) ~= 'number' then return end
  t.entities[number] = e t.built = t.built + 1
  if number == M.power.entry then connect_power(t, e) end
  return number
end

-- Everything stands: the import checks, then the run may begin.
local function after_build(t)
  local surface, force, dx, dy = t.surface, t.force, t.offset.x, t.offset.y
  t.entities = {}
  local exact, missing = true, {}
  for _, spec in ipairs(T.entities) do
    local e = surface.find_entity(spec.name, {spec.position.x + dx, spec.position.y + dy})
    if not e then missing[#missing + 1] = spec.entity_number else
      t.entities[spec.entity_number] = e
      -- (a machine without a fluid recipe has no ports to turn and reports no direction)
      local directed = not UNDIRECTED[spec.name] and not (spec.name == 'assembling-machine-3' and e.fluids_count == 0)
      if directed and e.direction ~= (spec.direction or 0) then exact = false record(t, 'direction changed #' .. spec.entity_number .. ' ' .. spec.name, false, {want = spec.direction or 0, got = e.direction}) end
      if spec.name == 'foundry' and (e.mirroring or false) ~= (spec.mirror == true) then exact = false record(t, 'mirroring changed #' .. spec.entity_number, false, {want = spec.mirror == true, got = e.mirroring}) end
      if IS_UNDERGROUND[spec.name] and e.belt_to_ground_type ~= spec.type then exact = false record(t, 'underground belt type changed #' .. spec.entity_number, false) end
      if spec.name == 'display-panel' and not (e.display_panel_always_show and e.display_panel_text == spec.text) then exact = false record(t, 'display panel text #' .. spec.entity_number, false) end
    end
  end
  record(t, 'every entity imported at its exact position, direction, mirroring, underground type and panel text', exact and #missing == 0, {missing = missing, entities = #T.entities})
  if #missing > 0 then fail('missing entities ' .. helpers.table_to_json(missing)) end
  record(t, 'no entity of the test force beyond the blueprint and the outside fixtures', #surface.find_entities_filtered{force = force} == #T.entities + #t.fixtures, {found = #surface.find_entities_filtered{force = force}, blueprint = #T.entities, fixtures = #t.fixtures})
  connect_power(t, t.entities[M.power.entry])
  -- machines: fixed recipe, no modules, speed and built-in productivity as pinned, runtime recipe equal to the pin
  local machinesOk, detail = true, {}
  t.machines = {}
  for _, m in ipairs(M.machines) do
    local e = t.entities[m.entity]
    local r = e.get_recipe()
    local ok = r and r.name == m.recipe and e.get_module_inventory().is_empty() and math.abs(e.crafting_speed - T.machineSpeed[e.name]) < 1e-9 and math.abs(e.productivity_bonus - T.machineProductivity[e.name]) < 1e-9 and force.recipes[m.recipe].enabled
    local cb = e.get_control_behavior()
    if cb and cb.circuit_set_recipe then ok = false end
    if not ok then machinesOk = false detail[#detail + 1] = {entity = m.entity, recipe = r and r.name, speed = e.crafting_speed, productivity = e.productivity_bonus} end
    t.machines[#t.machines + 1] = {entity = m.entity, role = m.role, group = m.group, recipe = m.recipe, e = e}
  end
  record(t, 'every machine kept its fixed recipe, has no modules, the pinned crafting speed and the pinned built-in productivity; every recipe is enabled by the researched closure', machinesOk, detail)
  local recipesOk, rdetail = true, {}
  for name, expected in pairs(T.recipePrototypes) do
    local proto = prototypes.recipe[name]
    if not (proto and same_map(recipe_map(proto.ingredients), recipe_map(expected.ingredients)) and same_map(recipe_map(proto.products), recipe_map(expected.results)) and math.abs(proto.energy - expected.energy) < 1e-9) then recipesOk = false rdetail[#rdetail + 1] = name end
  end
  record(t, 'runtime recipes (ingredients, products, time) equal the pinned snapshot', recipesOk, rdetail)
  -- arms: hand size, filter, and the entities they take from and drop on
  local armsOk, armFaults = true, {}
  for _, r in ipairs(M.routes) do
    local a = t.entities[r.inserter]
    local ok = a.inserter_stack_size_override == r.hand
    if r.filter then local f = a.get_filter(1) if not (a.use_filters and f and f.name == r.filter) then ok = false end elseif a.use_filters then ok = false end
    local source = t.entities[r.from.entity or r.from.belt]
    local dest = t.entities[r.to.entity or r.to.belt]
    if not (contains(source, a.pickup_position) and contains(dest, a.drop_position)) then ok = false end
    if not ok then armsOk = false armFaults[#armFaults + 1] = r.inserter end
  end
  record(t, 'every arm kept its pinned hand size and filter and reaches exactly the entities of its route', armsOk, armFaults)
  -- fluids: every machine box has the connection tiles of the static model, joined to the pipes of the static model
  local boxesOk, bdetail = true, {}
  for _, m in ipairs(M.machines) do
    local e = t.entities[m.entity]
    local want = M.machineBoxes[tostring(m.entity)] or {}
    local actual = {}
    for i = 1, e.fluids_count do
      local filter = e.get_fluid_filter(i)
      local targets = {}
      for _, pc in pairs(e.get_fluid_box_pipe_connections(i)) do targets[#targets + 1] = string.format('%d,%d', math.floor(pc.target_position.x - e.position.x + 0.5), math.floor(pc.target_position.y - e.position.y + 0.5)) end
      table.sort(targets)
      if filter then actual[#actual + 1] = {fluid = filter.name, targets = table.concat(targets, ' ')} end
    end
    if #actual ~= #want then boxesOk = false bdetail[#bdetail + 1] = {entity = m.entity, boxes = #actual, wanted = #want} end
    for _, w in ipairs(want) do
      local targets = {}
      for _, q in ipairs(w.targets) do targets[#targets + 1] = string.format('%d,%d', q[1], q[2]) end
      table.sort(targets)
      local found = false
      for _, a in ipairs(actual) do if a.fluid == w.fluid and a.targets == table.concat(targets, ' ') then found = true end end
      if not found then boxesOk = false bdetail[#bdetail + 1] = {entity = m.entity, wanted = w.fluid .. ' ' .. table.concat(targets, ' ')} end
    end
    -- a port the recipe does not use must be joined to nothing
    for i = 1, e.fluids_count do if not e.get_fluid_filter(i) then for _, pc in pairs(e.get_fluid_box_pipe_connections(i)) do if pc.target then boxesOk = false bdetail[#bdetail + 1] = {entity = m.entity, unusedPortJoined = pc.target.name} end end end end
  end
  record(t, 'every machine fluid box has exactly the connection tiles of the static model and no unused port is joined to anything', boxesOk, bdetail)
  build_fluid_watch(t)
  -- each static network is one native segment, and two networks never share a segment
  local segmentOf, segOk, sdetail = {}, true, {}
  for _, comp in ipairs(M.fluidComponents) do
    local ids, n = {}, 0
    for _, id in ipairs(comp.entities) do
      local e = t.entities[id]
      if e.type == 'pipe' or e.type == 'pipe-to-ground' then
        local seg = e.get_fluid_segment_id(1)
        if seg then
          if segmentOf[seg] and segmentOf[seg] ~= comp.id then segOk = false sdetail[#sdetail + 1] = {segment = seg, networks = {segmentOf[seg], comp.id}} end
          segmentOf[seg] = comp.id
          if not ids[seg] then ids[seg] = true n = n + 1 end
        end
      end
    end
    if n ~= 1 then segOk = false sdetail[#sdetail + 1] = {network = comp.id, fluid = comp.fluid, segments = n} end
  end
  record(t, 'the pipes form exactly the static fluid networks: one native segment each, no two networks joined', segOk, sdetail)
  local fixOk = true
  for _, f in ipairs(t.fixturePipes) do
    local entrance = t.entities[f.entity]
    if not (f.pipe.get_fluid_segment_id(1) and f.pipe.get_fluid_segment_id(1) == entrance.get_fluid_segment_id(1)) then fixOk = false end
  end
  record(t, 'every outside pipe joins the segment of its entrance pipe', fixOk)
  t.lineWatch = {}
  for _, line in ipairs(M.beltLines) do
    local allowed = {} for _, name in ipairs(line.items) do allowed[name] = true end
    for _, id in ipairs(line.entities) do t.lineWatch[#t.lineWatch + 1] = {entity = t.entities[id], id = id, line = line.name, allowed = allowed} end
  end
  t.building = nil t.ready = true
end

script.on_init(function()
  if script.active_mods.base ~= T.gameVersion then fail('wrong game version') end
  for name, version in pairs(T.activeMods) do if script.active_mods[name] ~= version then fail('mod mismatch ' .. name) end end
  game.map_settings.pollution.enabled = false
  game.map_settings.enemy_expansion.enabled = false
  -- The real planet surface, kept as small as the test needs: the game's per-tick cost grows with the number of generated
  -- chunks, so only the chunks the blueprint and its fixtures stand on are kept. Flat ground, nothing else on it.
  local surface = game.planets[M.surface].create_surface()
  local cx, cy = math.ceil((T.half.x + 14) / 32), math.ceil((T.half.y + 14) / 32)
  surface.request_to_generate_chunks({0, 0}, math.max(cx, cy)) surface.force_generate_chunk_requests()
  for _, e in pairs(surface.find_entities()) do if e.valid then e.destroy() end end
  local tiles = {} for x = -cx * 32, cx * 32 - 1 do for y = -cy * 32, cy * 32 - 1 do tiles[#tiles + 1] = {name = 'volcanic-ash-flats', position = {x, y}} end end
  surface.set_tiles(tiles)
  for _, e in pairs(surface.find_entities()) do if e.valid then e.destroy() end end
  surface.always_day = true
  for c in surface.get_chunks() do if c.x < -cx or c.x > cx - 1 or c.y < -cy or c.y > cy - 1 then surface.delete_chunk({c.x, c.y}) end end
  for c in game.surfaces[1].get_chunks() do game.surfaces[1].delete_chunk({c.x, c.y}) end
  local chunks = 0 for _ in surface.get_chunks() do chunks = chunks + 1 end
  local force = game.create_force('vulcanus-circuits-test')
  -- only the technology closure is researched; nothing else is enabled
  for _, name in ipairs(T.technologyClosure) do if not force.technologies[name] then fail('missing technology ' .. name) end force.technologies[name].researched = true end
  if T.bonus then force.inserter_stack_size_bonus = T.bonus.stack force.bulk_inserter_capacity_bonus = T.bonus.bulk end
  local t = {surface = surface, force = force, begin = game.tick, checks = {}, failures = {}, entities = {}, fixtures = {}, fixturePipes = {}, phases = {}, phase = 0,
    fluidFaults = {}, fluidFaultIndex = {}, joins = {}, joinIndex = {}, lineFaults = {}, lineFaultIndex = {}, watch = {}, machineWatch = {}, fluidOf = {}, numberOf = {}, segmentReadings = 0, machineReadings = 0, seconds = {}, exitForeign = {}}
  t.chunks = chunks
  t.bonus = {stack = force.inserter_stack_size_bonus, bulk = force.bulk_inserter_capacity_bonus}
  record(t, 'surface is the Vulcanus planet with its own surface properties', surface.planet and surface.planet.name == 'vulcanus' and surface.get_property('pressure') == T.planet.pressure, {pressure = surface.get_property('pressure'), gravity = surface.get_property('gravity')})
  local inventory = game.create_inventory(1)
  inventory[1].set_stack{name = 'blueprint'}
  if inventory[1].import_stack(T.blueprint) ~= 0 then fail('exact blueprint import') end
  -- T.entities, the ports and the power pole are given as they lie in the placement under test (the runner turns or mirrors
  -- them); the game itself turns the blueprint (build direction), a mirror image is its own string
  local ghosts = inventory[1].build_blueprint{surface = surface, force = force, position = {0, 0}, build_mode = defines.build_mode.forced, direction = T.place and T.place.direction or defines.direction.north}
  record(t, 'every blueprint entity became a ghost', #ghosts == #T.entities, {ghosts = #ghosts, entities = #T.entities})
  inventory.destroy()
  -- offset: the one translation under which every ghost lies on a blueprint entity of the same name
  local anchorSpec = T.entities[T.anchor]
  local ghostAt = {}
  for _, g in pairs(ghosts) do ghostAt[place_key(g.ghost_name, g.position.x, g.position.y)] = g end
  local dx, dy
  for _, g in pairs(ghosts) do if g.ghost_name == anchorSpec.name and not dx then
    local ox, oy = g.position.x - anchorSpec.position.x, g.position.y - anchorSpec.position.y
    local all = true
    for _, spec in ipairs(T.entities) do if not ghostAt[place_key(spec.name, spec.position.x + ox, spec.position.y + oy)] then all = false break end end
    if all then dx, dy = ox, oy end
  end end
  record(t, 'every ghost lies where the placement under test expects it', dx ~= nil)
  if not dx then fail('ghosts not where expected') end
  t.offset = {x = dx, y = dy}
  t.ghosts, t.byPlace, t.deferred, t.built = {}, {}, {}, 0
  for _, spec in ipairs(T.entities) do
    t.ghosts[spec.entity_number] = ghostAt[place_key(spec.name, spec.position.x + dx, spec.position.y + dy)]
    t.byPlace[place_key(spec.name, spec.position.x, spec.position.y)] = spec.entity_number
  end
  -- fixtures: a pipe on every fluid entrance, a sink belt beyond every exit, outside power
  local function fixture(name, position, direction)
    local e = surface.create_entity{name = name, position = {position.x + dx, position.y + dy}, force = force, direction = direction}
    if not e then fail('fixture placement ' .. name .. ' at ' .. position.x .. ',' .. position.y) end
    t.fixtures[#t.fixtures + 1] = e return e
  end
  t.inputs, t.outputs = {}, {}
  for _, port in ipairs(M.inputs) do
    local clear = true
    for _, q in ipairs(port.approach) do if not surface.can_place_entity{name = 'pipe', position = {q.x + dx, q.y + dy}, force = force} then clear = false end end
    record(t, 'clear approach ' .. port.id, clear)
    local in_ = {id = port.id, item = port.item, kind = port.kind, entityId = port.entity, credit = 0, carry = 0, lane = 0}
    if port.kind == 'pipe' then in_.pipe = fixture('pipe', port.contact) t.fixturePipes[#t.fixturePipes + 1] = {id = port.id, pipe = in_.pipe, fluid = port.item, entity = port.entity} end
    t.inputs[#t.inputs + 1] = in_
  end
  for _, port in ipairs(M.outputs) do
    local clear = true
    for _, q in ipairs(port.approach) do if not surface.can_place_entity{name = 'pipe', position = {q.x + dx, q.y + dy}, force = force} then clear = false end end
    record(t, 'clear approach ' .. port.id, clear)
    t.outputs[#t.outputs + 1] = {id = port.id, item = port.item, product = port.product, entityId = port.entity, sink = fixture('express-transport-belt', port.contact, port.sinkDirection)}
    if port.product then t.productOut = t.outputs[#t.outputs] end
  end
  t.externalPole = fixture('substation', M.power.externalPole)
  t.power = fixture('electric-energy-interface', M.power.externalSource)
  set_power(t, true)
  storage.run = t
  if T.build then
    t.building = {order = T.build.order, at = 1, wait = 0}
  else
    for _, ghost in pairs(ghosts) do local _, entity = ghost.revive{raise_revive = true} if not entity then fail('blueprint revival') end end
    after_build(t)
  end
end)

-- Piecemeal construction: the runner's order, a few entities every few ticks (a negative entry is a pause of that many ticks).
-- An entity the game will not build yet is recorded and tried again at the end. Supply and power are connected from the first
-- tick, as they would be under a ghost blueprint.
local function construct(t, tick)
  local b = t.building
  if b.wait > 0 then b.wait = b.wait - 1 return end
  if tick % T.build.stepTicks ~= 0 then return end
  local changed = false
  for _ = 1, T.build.perStep do
    local number = b.order[b.at]
    if not number then break end
    b.at = b.at + 1
    if number < 0 then b.wait = -number break end
    local _, e = t.ghosts[number].revive{raise_revive = true}
    if e then register(t, e) changed = true
    else t.deferred[#t.deferred + 1] = {entity = number, tick = tick} b.order[#b.order + 1] = number if #t.deferred > 5000 then fail('an entity could never be built: #' .. number) end end
  end
  if changed then build_fluid_watch(t) end
  if not b.order[b.at] and b.wait == 0 then t.construction = {order = T.build.name, ticks = tick, entities = t.built, deferred = #t.deferred} after_build(t) end
end

-- ---------------------------------------------------------------------------------------------------------------------------
local function produced(t)
  local items, fluids = t.force.get_item_production_statistics(t.surface), t.force.get_fluid_production_statistics(t.surface)
  local out = {made = {}, used = {}}
  for _, name in ipairs(T.trackedItems) do out.made[name] = items.get_input_count(name) out.used[name] = items.get_output_count(name) end
  for _, name in ipairs(T.trackedFluids) do out.made[name] = fluids.get_input_count(name) out.used[name] = fluids.get_output_count(name) end
  return out
end
local function crafts(t) local c = {} for _, m in ipairs(t.machines) do c[m.entity] = m.e.products_finished end return c end
-- Electric energy the blueprint's network has consumed so far (joules), from the network's own statistics.
local function consumed_energy(t)
  local total = 0
  local ok = pcall(function() for _, v in pairs(t.entities[M.power.entry].electric_network_statistics.output_counts) do total = total + v end end)
  return ok and total or nil
end

local function begin_phase(t, tick)
  t.phase = t.phase + 1
  local spec = SC.phases[t.phase]
  if not spec then return false end
  local ph = {name = spec.name, mode = spec.mode, start = tick, fed = {}, fedMeasured = {}, drawn = {}, drawnMeasured = {}, status = {}, productMinutes = {}, minuteCount = 0}
  t.current = {spec = spec, record = ph, statsAtStart = produced(t), craftsAtStart = crafts(t), energyAtStart = consumed_energy(t), trail = {}, second = 0}
  ph.lanes = {}
  set_power(t, spec.power ~= false)
  if spec.stop then for _, m in ipairs(t.machines) do for _, group in ipairs(spec.stop) do if m.group == group then m.e.disabled_by_script = true end end end end
  t.phases[#t.phases + 1] = ph
  return true
end

local function end_phase(t, tick, why)
  local cur = t.current
  local ph, spec = cur.record, cur.spec
  ph.ticks = tick - ph.start ph.endedBy = why ph.minutes = ph.ticks / PER_MINUTE
  if spec.stop then for _, m in ipairs(t.machines) do for _, group in ipairs(spec.stop) do if m.group == group then m.e.disabled_by_script = false end end end end
  local from = spec.measureFrom or 0
  local window = (ph.ticks - from) / PER_MINUTE
  ph.measuredMinutes = window
  ph.fedPerMinute, ph.drawnPerMinute = {}, {}
  for _, in_ in ipairs(t.inputs) do ph.fedPerMinute[in_.id] = {phase = (ph.fed[in_.id] or 0) / ph.minutes, measured = window > 0 and (ph.fedMeasured[in_.id] or 0) / window or 0} end
  for _, o in ipairs(t.outputs) do ph.drawnPerMinute[o.id] = {phase = (ph.drawn[o.id] or 0) / ph.minutes, measured = window > 0 and (ph.drawnMeasured[o.id] or 0) / window or 0} end
  local now = produced(t)
  ph.madePerMinute, ph.usedPerMinute = {}, {}
  for k, v in pairs(now.made) do ph.madePerMinute[k] = (v - cur.statsAtStart.made[k]) / ph.minutes end
  for k, v in pairs(now.used) do ph.usedPerMinute[k] = (v - cur.statsAtStart.used[k]) / ph.minutes end
  local energy = consumed_energy(t)
  if energy and cur.energyAtStart and ph.ticks > 0 then ph.averageMegawatts = (energy - cur.energyAtStart) / (ph.ticks / 60) / 1e6 end
  local c = crafts(t)
  ph.groups = {}
  local idle, still, busy = {}, {}, {}
  for _, m in ipairs(t.machines) do
    local made = c[m.entity] - cur.craftsAtStart[m.entity]
    local g = ph.groups[m.group] if not g then g = {machines = 0, crafts = 0, least = made, most = made, statusSeconds = {}} ph.groups[m.group] = g end
    g.machines = g.machines + 1 g.crafts = g.crafts + made
    if made < g.least then g.least = made end if made > g.most then g.most = made end
    for name, n in pairs(ph.status[m.entity] or {}) do g.statusSeconds[name] = (g.statusSeconds[name] or 0) + n end
    if made <= 0 then idle[#idle + 1] = m.entity end
    if cur.craftsTail and c[m.entity] - cur.craftsTail[m.entity] > 0 then still[#still + 1] = {entity = m.entity, role = m.role, crafts = c[m.entity] - cur.craftsTail[m.entity]} end
    if status_name(m.e) == 'working' then busy[#busy + 1] = m.entity end
  end
  for _, g in pairs(ph.groups) do g.craftsPerMinute = g.crafts / ph.minutes end
  ph.status = nil
  local ex = spec.expect or {}
  local product = t.productOut.id
  if ex.minProduct then record(t, spec.name .. ': at least ' .. ex.minProduct .. ' ' .. M.product .. ' a minute left by the exit', ph.drawnPerMinute[product].measured >= ex.minProduct - 1e-9, {measured = ph.drawnPerMinute[product].measured, floor = ex.minProduct, minutes = window}) end
  if ex.maxProduct then record(t, spec.name .. ': at most ' .. ex.maxProduct .. ' ' .. M.product .. ' a minute left by the exit', ph.drawnPerMinute[product].measured <= ex.maxProduct + 1e-9, {measured = ph.drawnPerMinute[product].measured}) end
  if ex.stopped then
    record(t, spec.name .. ': no machine crafted in the last ' .. ex.stopped .. ' minutes', #still == 0, still)
    record(t, spec.name .. ': no machine working at the end', #busy == 0, busy)
    ph.stoppedCleanly = #still == 0 and #busy == 0
  end
  if ex.allMachinesCraft then record(t, spec.name .. ': every machine crafted', #idle == 0, idle) end
  if spec.mode == 'until_rate' then
    ph.reachedSeconds = why == 'rate' and math.floor(ph.ticks / 60) or nil
    record(t, spec.name .. ': the exit reached ' .. (spec.share * 100) .. '% of ' .. M.target .. ' a minute (trailing minute) within ' .. (spec.limit / PER_MINUTE) .. ' minutes', why == 'rate', {seconds = ph.reachedSeconds, best = cur.best})
  end
end

local function finish(t, tick)
  record(t, 'no pipe ever held a fluid other than its network\'s (every fluid segment read every tick)', #t.fluidFaults == 0, {faults = t.fluidFaults, segmentsWatched = #t.watch, readings = t.segmentReadings})
  record(t, 'no machine fluid box was ever joined to a pipe of another fluid, and no unused port to anything (read once a second)', #t.joins == 0, t.joins)
  record(t, 'no belt line ever carried an item it does not declare (every belt read every five seconds)', #t.lineFaults == 0, t.lineFaults)
  record(t, 'no exit ever gave anything but its own item', next(t.exitForeign) == nil, t.exitForeign)
  local machines = {}
  for _, m in ipairs(t.machines) do machines[#machines + 1] = {entity = m.entity, role = m.role, group = m.group, recipe = m.recipe, products = m.e.products_finished, status = status_name(m.e)} end
  local report = {schema = 1, passed = #t.failures == 0, failures = t.failures, checks = t.checks, gameVersion = script.active_mods.base, activeMods = T.activeMods,
    surface = {name = t.surface.name, planet = t.surface.planet and t.surface.planet.name, pressure = t.surface.get_property('pressure'), gravity = t.surface.get_property('gravity'), chunks = t.chunks},
    blueprintSha256 = T.blueprintSha256, placedBlueprintSha256 = T.place and T.place.blueprintSha256 or T.blueprintSha256, prototypeSha256 = T.prototypeSha256, configurationSha256 = T.configurationSha256, nativeControlSha256 = T.nativeControlSha256,
    actualTicks = tick, scenario = T.scenarioName, description = SC.description, length = SC.length, bonus = t.bonus, phases = t.phases, machines = machines,
    construction = t.construction, placement = T.place, sabotage = t.sabotaged, fluidFaults = t.fluidFaults, portJoins = t.joins, lineFaults = t.lineFaults,
    segmentsWatched = #t.watch, segmentReadings = t.segmentReadings, machineBoxReadings = t.machineReadings, blueprintEntityCount = #T.entities, fixtureEntityCount = #t.fixtures}
  helpers.write_file('vulcanus-circuits/native-report.json', helpers.table_to_json(report), false)
  log('VULCANUS_CIRCUITS_RESULT ' .. helpers.table_to_json({passed = report.passed, failures = report.failures, ticks = tick}))
  -- the benchmark has a fixed length: empty the surface so the remaining ticks cost nothing
  for _, e in pairs(t.surface.find_entities()) do if e.valid then e.destroy() end end
  storage.run = {done = true}
end

-- ---------------------------------------------------------------------------------------------------------------------------
local function feed(t, ph, spec, measured)
  for _, in_ in ipairs(t.inputs) do
    local mode = spec and (spec.feed[in_.id] or 'none') or 'generous'
    if mode ~= 'none' then
      local added = 0
      if in_.kind == 'belt' then
        local belt = t.entities[in_.entityId]
        if belt and belt.valid then
          if mode == 'generous' then
            for lane = 1, 2 do if belt.get_transport_line(lane).insert_at_back{name = in_.item, count = 1} then added = added + 1 end end
          else
            in_.credit = math.min(8, in_.credit + mode / PER_MINUTE)
            while in_.credit >= 1 do
              local lane = in_.lane % 2 + 1
              local ok = belt.get_transport_line(lane).insert_at_back{name = in_.item, count = 1}
              if not ok then lane = lane % 2 + 1 ok = belt.get_transport_line(lane).insert_at_back{name = in_.item, count = 1} end
              if not ok then break end
              in_.lane = lane in_.credit = in_.credit - 1 added = added + 1
            end
          end
        end
      else
        local want = mode == 'generous' and 1000 or (mode / PER_MINUTE + in_.carry)
        local n = in_.pipe.insert_fluid{name = in_.item, amount = want, temperature = T.fluidTemperature[in_.item]}
        if mode ~= 'generous' then in_.carry = math.min(want - n, mode / 60) end
        added = n
      end
      if ph and added > 0 then
        ph.fed[in_.id] = (ph.fed[in_.id] or 0) + added
        if measured then ph.fedMeasured[in_.id] = (ph.fedMeasured[in_.id] or 0) + added end
      end
    end
  end
end
local function drain(t, cur, measured)
  local ph, spec = cur.record, cur.spec
  for _, o in ipairs(t.outputs) do if (spec.draw[o.id] or 'none') == 'all' then
    local got = 0
    for lane = 1, 2 do
      local line = o.sink.get_transport_line(lane)
      local n = line.get_item_count()
      if n > 0 then
        for _, c in pairs(line.get_contents()) do if c.name ~= o.item then t.exitForeign[o.id .. ':' .. c.name] = true end end
        got = got + n line.clear()
        if o.product and measured then ph.lanes[lane] = (ph.lanes[lane] or 0) + n end
      end
    end
    if got > 0 then
      ph.drawn[o.id] = (ph.drawn[o.id] or 0) + got
      if measured then ph.drawnMeasured[o.id] = (ph.drawnMeasured[o.id] or 0) + got end
      if o.product then cur.second = cur.second + got end
    end
  end end
end

script.on_event(defines.events.on_tick, function(event)
  local t = storage.run if not t or t.done then return end
  local tick = event.tick - t.begin
  if tick == 0 then return end
  if t.building then construct(t, tick) end
  check_segments(t, tick)
  if tick % 5 == 0 then check_machines(t, tick) end
  if t.ready and not t.started then
    t.started = true
    log('VULCANUS_CIRCUITS_START')
    t.chunks = 0 for _ in t.surface.get_chunks() do t.chunks = t.chunks + 1 end   -- (chunk deletion takes effect after the tick that asked for it)
    local entryNetwork, unpowered = t.entities[M.power.entry].electric_network_id, {}
    for id, e in pairs(t.entities) do
      if e.prototype.electric_energy_source_prototype and (not e.is_connected_to_electric_network() or e.electric_network_id ~= entryNetwork) then unpowered[#unpowered + 1] = id end
    end
    record(t, 'every powered entity is on the one electric network of the labelled substation', #unpowered == 0, unpowered)
    if not begin_phase(t, tick - 1) then fail('no phases') end
  end
  -- Self-test of the fluid watch (exploration only; a qualifying run never carries T.sabotage): a foreign fluid is put into one
  -- pipe network by script, and the run must fail on it.
  if T.sabotage and tick == T.sabotage.tick then
    for _, w in ipairs(t.watch) do if w.expected == T.sabotage.network and w.segment and not t.sabotaged then
      t.sabotaged = {network = w.expected, fluid = T.sabotage.fluid, tick = tick}
      w.entity.clear_fluid_segment_fluid(w.index)
      w.entity.set_fluid_segment_fluid(w.index, {name = T.sabotage.fluid, amount = 50, temperature = T.fluidTemperature[T.sabotage.fluid]})
    end end
  end
  local cur = t.current
  if not cur then
    if t.building then feed(t, nil, nil, false) end   -- under construction the entrances are live
    return
  end
  local ph, spec = cur.record, cur.spec
  local rel = tick - ph.start
  local measured = rel > (spec.measureFrom or 0)
  feed(t, ph, spec, measured)
  if tick % 4 == 0 then drain(t, cur, measured) end
  if rel % 60 ~= 0 then return end
  -- once a second
  check_joins(t, tick)
  local trail = cur.trail
  trail[#trail + 1] = cur.second cur.second = 0
  local n, sum = #trail, 0
  for k = math.max(1, n - 59), n do sum = sum + trail[k] end
  if n >= 60 and sum > (cur.best or 0) then cur.best = sum end
  ph.minuteCount = ph.minuteCount + trail[n]
  if rel % PER_MINUTE == 0 then ph.productMinutes[#ph.productMinutes + 1] = ph.minuteCount ph.minuteCount = 0 end
  for _, m in ipairs(t.machines) do
    local s = ph.status[m.entity] if not s then s = {} ph.status[m.entity] = s end
    local name = status_name(m.e) s[name] = (s[name] or 0) + 1
  end
  if rel % 300 == 0 then
    for _, w in ipairs(t.lineWatch) do if w.entity.valid then for lane = 1, 2 do
      local line = w.entity.get_transport_line(lane)
      if line.get_item_count() > 0 then for _, c in pairs(line.get_contents()) do if not w.allowed[c.name] then
        local key = w.line .. '|' .. c.name
        if not t.lineFaultIndex[key] then t.lineFaultIndex[key] = true t.lineFaults[#t.lineFaults + 1] = {line = w.line, item = c.name, belt = w.id, tick = tick, phase = spec.name} end
      end end end
    end end end
  end
  local ex = spec.expect
  if ex and ex.stopped and rel == (spec.ticks - ex.stopped * PER_MINUTE) then cur.craftsTail = crafts(t) end
  local finished
  if spec.mode == 'until_rate' then
    if n >= 60 and sum >= spec.share * M.target - 1e-9 then finished = 'rate'
    elseif rel >= spec.limit then finished = 'limit' end
  elseif rel >= spec.ticks then finished = 'ticks' end
  if finished then
    end_phase(t, tick, finished)
    if not begin_phase(t, tick) then finish(t, tick) end
  end
end)
