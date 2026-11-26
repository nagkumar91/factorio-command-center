-- Probe behind fluid-slots.json: every machine and fixed recipe the circuit blueprints use, in every direction, unmirrored and
-- mirrored, on a Vulcanus surface. Per fluid box: its filter, its pipe connections (target tile from the machine centre, flow) and,
-- with a pipe on every tile around the machine, which of those pipes the box really joins. Then the behaviour the layouts rely on:
--   leftover: a one-fluid casting foundry is filled from one port, its recipe is taken away, and what arrives in an empty pipe on
--             its other port is read (the fault that stuck a released blueprint);
--   output:   a lava foundry with a pipe on one output port only, and with pipes on both;
--   flips:    the direction and mirroring LuaEntity.flip leaves each machine with.
local payload = require('fixture')
local out = {ents = {}, flips = {}, leftover = {}, belts = {}}
local function boxes_of(e)
  local list = {}
  for i = 1, e.fluids_count do
    local b = {index = i}
    local f = e.get_fluid_filter(i) b.filter = f and f.name or nil
    b.conns = {}
    for _, pc in pairs(e.get_fluid_box_pipe_connections(i)) do
      b.conns[#b.conns + 1] = {target = {pc.target_position.x - e.position.x, pc.target_position.y - e.position.y}, flow = pc.flow_direction, connected = pc.target and pc.target.name or nil}
    end
    list[#list + 1] = b
  end
  return list
end
script.on_init(function()
  local s = game.planets.vulcanus.create_surface()
  s.request_to_generate_chunks({0, 0}, 8) s.force_generate_chunk_requests()
  for _, e in pairs(s.find_entities()) do e.destroy() end
  local tiles = {} for x = -250, 250 do for y = -100, 100 do tiles[#tiles + 1] = {name = 'volcanic-ash-flats', position = {x, y}} end end
  s.set_tiles(tiles)
  for _, e in pairs(s.find_entities()) do if e.valid then e.destroy() end end
  local f = game.create_force('probe')
  for _, name in ipairs(payload.technologies) do f.technologies[name].researched = true end
  out.bonus = {stack = f.inserter_stack_size_bonus, bulk = f.bulk_inserter_capacity_bonus}
  out.pressure = s.get_property('pressure')
  local inv = game.create_inventory(1) inv[1].set_stack{name = 'blueprint'}
  out.import = inv[1].import_stack(payload.code)
  local ghosts = inv[1].build_blueprint{surface = s, force = f, position = {0, 0}, build_mode = defines.build_mode.forced}
  out.ghosts = #ghosts
  for _, g in pairs(ghosts) do
    local tag = g.tags and g.tags.id
    local _, e = g.revive()
    local half = math.floor(e.prototype.tile_width / 2) + 1
    local r = {name = e.name, tag = tag, dir = e.direction, mirror = e.mirroring, recipe = e.get_recipe() and e.get_recipe().name, before = boxes_of(e), fluidsCount = e.fluids_count}
    for a = -half + 1, half - 1 do for _, q in ipairs({{a, -half}, {a, half}, {-half, a}, {half, a}}) do s.create_entity{name = 'pipe', position = {e.position.x + q[1], e.position.y + q[2]}, force = f} end end
    r.boxes = boxes_of(e)
    -- every pipe of the ring that has any fluid-box neighbour that is the machine
    r.ringJoined = {}
    for _, p in pairs(s.find_entities_filtered{name = 'pipe', area = {{e.position.x - half - 0.5, e.position.y - half - 0.5}, {e.position.x + half + 0.5, e.position.y + half + 0.5}}}) do
      for _, c in pairs(p.get_fluid_box_pipe_connections(1)) do if c.target and c.target.unit_number == e.unit_number then r.ringJoined[#r.ringJoined + 1] = {p.position.x - e.position.x, p.position.y - e.position.y} end end
      p.destroy()
    end
    out.ents[#out.ents + 1] = r
    for _, horizontal in ipairs({true, false}) do
      local ok = e.flip{horizontal = horizontal}
      out.flips[#out.flips + 1] = {name = e.name, recipe = r.recipe, dir = r.dir, mirror = r.mirror, horizontal = horizontal, ok = ok, toDir = e.direction, toMirror = e.mirroring}
      e.flip{horizontal = horizontal}
      if not (e.direction == r.dir and e.mirroring == r.mirror) then e.direction = r.dir e.mirroring = r.mirror end
    end
  end
  inv.destroy()
  -- Behaviour rigs, built by script far from the grid.
  local function put(name, x, y, extra) local t = {name = name, position = {x, y}, force = f} for k, v in pairs(extra or {}) do t[k] = v end local e = s.create_entity(t) if not e then error('PROBE place ' .. name) end return e end
  local rigs = {}
  -- leftover: foundry (north, inputs south) casting cable; pipe A on its west input port holds molten copper, pipe B on its east input port is empty
  local x0 = 0
  for _, case in ipairs({{recipe = 'casting-copper-cable', fluid = 'molten-copper'}, {recipe = 'casting-iron', fluid = 'molten-iron'}}) do
    local m = put('foundry', x0 + 0.5, 60.5, {recipe = case.recipe, direction = defines.direction.north})
    local a = put('pipe', x0 - 0.5, 63.5) local b = put('pipe', x0 + 1.5, 63.5)
    rigs[#rigs + 1] = {kind = 'leftover', case = case, machine = m, a = a, b = b, keepFull = true}
    x0 = x0 + 12
    -- the same with the fed pipe left empty when the recipe goes (both pipes will take the leftover)
    local m2 = put('foundry', x0 + 0.5, 60.5, {recipe = case.recipe, direction = defines.direction.north})
    local a2 = put('pipe', x0 - 0.5, 63.5) local b2 = put('pipe', x0 + 1.5, 63.5)
    a2.insert_fluid{name = case.fluid, amount = 100, temperature = 1500}
    rigs[#rigs + 1] = {kind = 'leftover', case = case, machine = m2, a = a2, b = b2, keepFull = false}
    x0 = x0 + 12
  end
  -- output: lava foundry (inputs south, outputs north) with a pipe on one output port, and one with pipes on both; lava by infinity pipe, calcite by hand
  for _, both in ipairs({false, true}) do
    local m = put('foundry', x0 + 0.5, 60.5, {recipe = 'molten-copper-from-lava', direction = defines.direction.north})
    local lava = put('infinity-pipe', x0 - 0.5, 63.5) lava.set_infinity_pipe_filter({name = 'lava', percentage = 1, mode = 'at-least'})
    local pole = put('substation', x0 + 5, 66) local eei = put('electric-energy-interface', x0 + 8, 66) eei.power_production = 1e8 eei.electric_buffer_size = 1e9 eei.energy = 1e9
    local a = put('storage-tank', x0 - 1.5, 55.5) -- tank: connections at its corners; one touches the west output port tile column
    local west = put('pipe', x0 - 0.5, 57.5) local east = both and put('pipe', x0 + 1.5, 57.5) or nil
    m.insert{name = 'calcite', count = 50}
    rigs[#rigs + 1] = {kind = 'output', both = both, machine = m, west = west, east = east, tank = a}
    x0 = x0 + 16
  end
  storage.rigs = rigs storage.out = out
end)
script.on_event(defines.events.on_tick, function(ev)
  local t = ev.tick
  local out = storage.out if not out then return end
  if t < 120 then for _, r in ipairs(storage.rigs) do if r.kind == 'leftover' and r.keepFull then r.a.insert_fluid{name = r.case.fluid, amount = 100, temperature = 1500} end end end
  if t == 120 then
    for _, r in ipairs(storage.rigs) do if r.kind == 'leftover' then
      r.heldBefore = r.machine.get_fluid_contents() r.aBefore = r.a.get_fluid_contents() r.bBefore = r.b.get_fluid_contents()
      r.joined = boxes_of(r.machine)
      -- the recipe is taken away the way a player does it (and the way a circuit does): not by a script call that discards the fluid
      r.machine.set_recipe(nil)
    end end
  end
  if t == 240 then
    for _, r in ipairs(storage.rigs) do
      if r.kind == 'leftover' then
        out.leftover[#out.leftover + 1] = {recipe = r.case.recipe, fedPipeKeptFull = r.keepFull, heldBefore = r.heldBefore, pipeABefore = r.aBefore, pipeBBefore = r.bBefore, heldAfter = r.machine.get_fluid_contents(), pipeAAfter = r.a.get_fluid_contents(), pipeBAfter = r.b.get_fluid_contents(), boxes = r.joined}
      end
    end
  end
  if t == 3600 then
    out.output = {}
    for _, r in ipairs(storage.rigs) do if r.kind == 'output' then
      out.output[#out.output + 1] = {both = r.both, finished = r.machine.products_finished, held = r.machine.get_fluid_contents(), west = r.west.get_fluid_contents(), east = r.east and r.east.get_fluid_contents() or nil, stone = r.machine.get_inventory(defines.inventory.crafter_output).get_contents(), boxes = boxes_of(r.machine)}
    end end
    helpers.write_file('probe.json', helpers.table_to_json(out), false)
    storage.out = nil
  end
end)
