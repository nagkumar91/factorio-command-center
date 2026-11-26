-- Probe behind the design figures in rates.json: what one arm moves per minute at the pinned hand sizes (fast 1, bulk 2,
-- long-handed 1) between chests, from a belt and onto a belt, and how much product a machine holds before it stops when nothing
-- is taken from it. Research: the blueprint's technology closure only. Each rig is fed and emptied by script.
local payload = helpers.json_to_table(require('payload'))
local N, E, S, W = defines.direction.north, defines.direction.east, defines.direction.south, defines.direction.west
script.on_init(function()
  local s = game.planets.vulcanus.create_surface()
  s.request_to_generate_chunks({0, 0}, 4) s.force_generate_chunk_requests()
  for _, e in pairs(s.find_entities()) do e.destroy() end
  local tiles = {} for x = -120, 120 do for y = -120, 120 do tiles[#tiles + 1] = {name = 'volcanic-ash-flats', position = {x, y}} end end
  s.set_tiles(tiles)
  for _, e in pairs(s.find_entities()) do if e.valid then e.destroy() end end
  local f = game.create_force('probe')
  for _, name in ipairs(payload.technologies) do f.technologies[name].researched = true end
  local function put(name, x, y, extra)
    local t = {name = name, position = {x, y}, force = f}
    for k, v in pairs(extra or {}) do t[k] = v end
    local e = s.create_entity(t) if not e then error('PROBE place ' .. name .. ' ' .. x .. ',' .. y) end
    return e
  end
  local rigs = {}
  local y = -90
  local function arm(kind, x, yy, from, hand) local a = put(kind, x, yy, {direction = from}) a.inserter_stack_size_override = hand return a end
  local hands = {['fast-inserter'] = 1, ['bulk-inserter'] = 2, ['long-handed-inserter'] = 1}
  local function pole(x, yy) put('substation', x, yy) local eei = put('electric-energy-interface', x, yy - 2) eei.power_production = 1e8 eei.electric_buffer_size = 1e9 eei.energy = 1e9 end
  -- arms: chest to chest, belt to chest, chest to belt. The arm stands at x = 0 and carries west to east.
  for _, kind in ipairs({'fast-inserter', 'bulk-inserter', 'long-handed-inserter'}) do
    local reach = kind == 'long-handed-inserter' and 2 or 1
    for _, mode in ipairs({'chest-chest', 'belt-chest', 'chest-belt', 'belt-chest-sparse'}) do
      local x0 = -60
      local r = {name = kind .. ' ' .. mode, moved = 0}
      pole(x0 + 8.0, y)
      r.arm = arm(kind, x0 + 0.5, y + 0.5, W, hands[kind])
      if mode == 'chest-chest' or mode == 'chest-belt' then r.source = put('steel-chest', x0 - reach + 0.5, y + 0.5) else
        r.belts = {} for k = -3, 3 do r.belts[#r.belts + 1] = put('fast-transport-belt', x0 - reach + 0.5, y + 0.5 + k, {direction = S}) end
        r.sparse = mode == 'belt-chest-sparse'
      end
      if mode == 'chest-belt' then r.out = {} for k = -3, 3 do r.out[#r.out + 1] = put('fast-transport-belt', x0 + reach + 0.5, y + 0.5 + k, {direction = S}) end
      else r.sink = put('steel-chest', x0 + reach + 0.5, y + 0.5) end
      rigs[#rigs + 1] = r
      y = y + 9
    end
  end
  -- machines that are fed and never emptied
  local mrigs = {}
  local mx = -20
  local function machine_rig(name, recipe, feeds, fluids)
    local size = name == 'foundry' and 5 or 3
    local half = (size - 1) / 2
    local cx, cy = mx + 0.5, -80.5
    pole(mx, -88)
    local dir = (name == 'foundry' or not fluids) and N or S
    local m = put(name, cx, cy, recipe and {recipe = recipe, direction = dir} or {direction = dir})
    local r = {name = name .. ' ' .. (recipe or 'smelting'), machine = m, chests = {}, feeds = feeds}
    for i, item in ipairs(feeds) do
      local c = put('steel-chest', cx - 1 + (i - 1), cy - half - 2)
      arm('bulk-inserter', cx - 1 + (i - 1), cy - half - 1, N, 2)
      r.chests[#r.chests + 1] = {chest = c, item = item}
    end
    for i, fl in ipairs(fluids or {}) do
      local px = cx + (i == 1 and -1 or 1)
      if name == 'assembling-machine-3' then px = cx end
      local p = put('infinity-pipe', px, cy + half + 1)
      p.set_infinity_pipe_filter({name = fl, percentage = 1, mode = 'at-least'})
    end
    mrigs[#mrigs + 1] = r
    mx = mx + 9
  end
  machine_rig('assembling-machine-3', 'electronic-circuit', {'iron-plate', 'copper-cable'})
  machine_rig('assembling-machine-3', 'advanced-circuit', {'electronic-circuit', 'plastic-bar', 'copper-cable'})
  machine_rig('assembling-machine-3', 'productivity-module', {'electronic-circuit', 'advanced-circuit'})
  machine_rig('assembling-machine-3', 'rail', {'stone', 'steel-plate', 'iron-stick'})
  machine_rig('assembling-machine-3', 'processing-unit', {'electronic-circuit', 'advanced-circuit'}, {'sulfuric-acid'})
  machine_rig('chemical-plant', 'battery', {'iron-plate', 'copper-plate'}, {'sulfuric-acid'})
  machine_rig('assembling-machine-3', 'electric-furnace', {'steel-plate', 'advanced-circuit', 'stone-brick'})
  machine_rig('assembling-machine-3', 'production-science-pack', {'electric-furnace', 'productivity-module', 'rail'})
  machine_rig('assembling-machine-3', 'utility-science-pack', {'low-density-structure', 'processing-unit', 'flying-robot-frame'})
  machine_rig('assembling-machine-3', 'flying-robot-frame', {'electric-engine-unit', 'battery', 'steel-plate'})
  machine_rig('assembling-machine-3', 'engine-unit', {'steel-plate', 'iron-gear-wheel', 'pipe'})
  machine_rig('electric-furnace', nil, {'stone'})
  machine_rig('foundry', 'casting-copper-cable', {}, {'molten-copper'})
  machine_rig('foundry', 'casting-iron', {}, {'molten-iron'})
  machine_rig('foundry', 'casting-steel', {}, {'molten-iron'})
  machine_rig('foundry', 'casting-iron-stick', {}, {'molten-iron'})
  machine_rig('foundry', 'casting-pipe', {}, {'molten-iron'})
  machine_rig('foundry', 'casting-low-density-structure', {'plastic-bar'}, {'molten-iron', 'molten-copper'})
  machine_rig('foundry', 'molten-iron-from-lava', {'calcite'}, {'lava'})
  storage.rigs = rigs storage.mrigs = mrigs storage.bonus = {stack = f.inserter_stack_size_bonus, bulk = f.bulk_inserter_capacity_bonus}
end)
local WARM, MEASURE = 600, 3600
script.on_event(defines.events.on_tick, function(ev)
  local t = ev.tick
  for _, r in ipairs(storage.rigs) do
    if r.source then r.source.insert{name = 'iron-plate', count = 20} end
    if r.belts then
      local line = r.belts[1].get_transport_line(1)
      if r.sparse then if t % 8 == 0 then line.insert_at_back{name = 'iron-plate', count = 1} end else line.insert_at_back{name = 'iron-plate', count = 1} end
      -- what passes the arm is removed at the end of the belt
      local last = r.belts[#r.belts] for lane = 1, 2 do local l = last.get_transport_line(lane) if #l > 2 then l.clear() end end
    end
    if r.sink then local n = r.sink.get_item_count('iron-plate') if n > 0 then r.sink.remove_item{name = 'iron-plate', count = n} if t > WARM then r.moved = r.moved + n end end end
    if r.out then local last = r.out[#r.out] for lane = 1, 2 do local l = last.get_transport_line(lane) local n = l.get_item_count() if n > 0 then l.clear() if t > WARM then r.moved = r.moved + n end end end end
  end
  for _, r in ipairs(storage.mrigs) do for _, c in ipairs(r.chests) do if c.chest.get_item_count(c.item) < 100 then c.chest.insert{name = c.item, count = 50} end end end
  if t == WARM + MEASURE then
    local out = {bonus = storage.bonus, arms = {}, machines = {}}
    for _, r in ipairs(storage.rigs) do out.arms[r.name] = r.moved end
    helpers.write_file('probe.json', helpers.table_to_json(out), false)
  end
  if t == 36000 then
    local out = {machines = {}}
    for _, r in ipairs(storage.mrigs) do
      local m = r.machine
      local names = {} for n, v in pairs(defines.entity_status) do names[v] = n end
      local o = {status = names[m.status], bonus = m.bonus_progress, finished = m.products_finished, input = {}, output = {}, fluids = m.get_fluid_contents()}
      for _, id in ipairs({defines.inventory.crafter_input, defines.inventory.crafter_output}) do local inv = m.get_inventory(id) if inv then for _, st in pairs(inv.get_contents()) do (id == defines.inventory.crafter_input and o.input or o.output)[st.name] = st.count end end end
      out.machines[r.name] = o
    end
    helpers.write_file('probe-machines.json', helpers.table_to_json(out), false)
  end
end)
