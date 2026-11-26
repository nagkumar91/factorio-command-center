-- Probe behind fluid-slots.json: every machine and fixed recipe of the build, in every direction, unmirrored and mirrored, on a
-- Vulcanus surface. For every fluid box: its filter, its pipe connections (target tile from the machine centre, flow), and, with a
-- pipe standing on every candidate tile around the machine, which of those pipes the box really connects to. Also the game's own
-- flip rule for each machine (LuaEntity.flip, both axes): the direction and mirroring it ends with.
local payload = helpers.json_to_table(require('payload'))
local out = {ents = {}, flips = {}, bonus = {}}
local function boxes_of(e)
  local list = {}
  for i = 1, e.fluids_count do
    local b = {index = i}
    local f = e.get_fluid_filter(i) b.filter = f and f.name or nil
    b.conns = {}
    for _, pc in pairs(e.get_fluid_box_pipe_connections(i)) do
      b.conns[#b.conns + 1] = {target = {pc.target_position.x - e.position.x, pc.target_position.y - e.position.y}, flow = pc.flow_direction, connected = pc.target and pc.target.name or nil, kind = pc.connection_type}
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
  local inv = game.create_inventory(1) inv[1].set_stack{name = 'blueprint'}
  out.import = inv[1].import_stack(payload.code)
  local ghosts = inv[1].build_blueprint{surface = s, force = f, position = {0, 0}, build_mode = defines.build_mode.forced}
  out.ghosts = #ghosts
  out.chunks = 0 for _ in s.get_chunks() do out.chunks = out.chunks + 1 end
  out.sample = {}
  for _, g in pairs(ghosts) do
    if #out.sample < 200 then out.sample[#out.sample + 1] = {g.position.x, g.position.y, g.tags and g.tags.id} end
    local tag = g.tags and g.tags.id
    local _, e = g.revive()
    local half = math.floor(e.prototype.tile_width / 2) + 1
    local r = {name = e.name, tag = tag, dir = e.direction, mirror = e.mirroring, recipe = e.get_recipe() and e.get_recipe().name, before = boxes_of(e)}
    -- a ring of pipes on every tile that touches the machine's sides (not the corners)
    for a = -half + 1, half - 1 do for _, q in ipairs({{a, -half}, {a, half}, {-half, a}, {half, a}}) do s.create_entity{name = 'pipe', position = {e.position.x + q[1], e.position.y + q[2]}, force = f} end end
    r.boxes = boxes_of(e)
    for _, p in pairs(s.find_entities_filtered{name = 'pipe', area = {{e.position.x - half - 0.5, e.position.y - half - 0.5}, {e.position.x + half + 0.5, e.position.y + half + 0.5}}}) do p.destroy() end
    out.ents[#out.ents + 1] = r
    -- the game's own flip of this machine, on each axis (flipped, read, flipped back)
    for _, horizontal in ipairs({true, false}) do
      local ok = e.flip{horizontal = horizontal}
      out.flips[#out.flips + 1] = {name = e.name, recipe = r.recipe, dir = r.dir, mirror = r.mirror, horizontal = horizontal, ok = ok, toDir = e.direction, toMirror = e.mirroring, boxes = boxes_of(e)}
      e.flip{horizontal = horizontal}
      out.flips[#out.flips].back = (e.direction == r.dir and e.mirroring == r.mirror)
      if not out.flips[#out.flips].back then e.direction = r.dir e.mirroring = r.mirror end
    end
  end
  helpers.write_file('probe.json', helpers.table_to_json(out), false)
end)
