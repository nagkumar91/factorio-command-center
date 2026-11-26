-- Native port probe (see ports.mjs). Every machine of the payload is imported from its own one-entity blueprint with its recipe; a pipe is then put on
-- every tile of the ring around it, and for each pipe the game is asked whether it connected to the machine, and to which fluid box.
local payload = helpers.json_to_table(require('payload'))
local out = {}
script.on_init(function()
  local s = game.planets.vulcanus.create_surface({width=512, height=256, seed=1})
  s.request_to_generate_chunks({0,0}, 12); s.force_generate_chunk_requests()
  for _, e in pairs(s.find_entities()) do e.destroy() end
  local tiles = {}; for x=-200,200 do for y=-100,100 do tiles[#tiles+1] = {name='volcanic-ash-flats', position={x,y}} end end
  s.set_tiles(tiles)
  local f = game.forces.player; f.enable_all_recipes()
  out.ents = {}
  out.failed = {}
  -- one blueprint per machine, each built at the origin, probed and removed
  for _, code in ipairs(payload.codes) do
  local inv = game.create_inventory(1); inv[1].set_stack{name='blueprint'}
  if inv[1].import_stack(code) ~= 0 then error('probe blueprint import') end
  local ghosts = inv[1].build_blueprint{surface=s, force=f, position={0,0}, build_mode=defines.build_mode.forced}
  inv.destroy()
  for _, g in pairs(ghosts) do
    local tag = g.tags and g.tags.id
    local gp = {g.position.x, g.position.y}
    local _, e = g.revive()
    if not e then out.failed[#out.failed+1] = {tag=tag, pos=gp} goto continue end
    local half = (e.prototype.tile_width - 1) / 2
    local r = {name=e.name, tag=tag, dir=e.direction, mirror=e.mirroring, recipe=e.get_recipe() and e.get_recipe().name, fluids=e.fluids_count, boxes={}, ring={}}
    for i=1,e.fluids_count do
      local fl = e.get_fluid_filter(i)
      local c = {}
      for _, pc in pairs(e.get_fluid_box_pipe_connections(i)) do c[#c+1] = {target={pc.target_position.x-e.position.x, pc.target_position.y-e.position.y}, flow=pc.flow_direction} end
      r.boxes[#r.boxes+1] = {index=i, filter=fl and fl.name, conns=c, capacity=e.get_fluid_capacity(i)}
    end
    local pipes = {}
    for dx=-half-1,half+1 do for dy=-half-1,half+1 do
      local edge_x, edge_y = math.abs(dx) == half+1, math.abs(dy) == half+1
      if (edge_x or edge_y) and not (edge_x and edge_y) then
        local pipe = s.create_entity{name='pipe', position={e.position.x+dx, e.position.y+dy}, force=f}
        pipes[#pipes+1] = {pipe=pipe, dx=dx, dy=dy}
      end
    end end
    for _, q in ipairs(pipes) do
      for _, pc in pairs(q.pipe.get_fluid_box_pipe_connections(1)) do
        if pc.target and pc.target == e then
          local fl = e.get_fluid_filter(pc.target_fluidbox_index)
          r.ring[#r.ring+1] = {target={q.dx, q.dy}, box=pc.target_fluidbox_index, filter=fl and fl.name}
        end
      end
    end
    for _, q in ipairs(pipes) do q.pipe.destroy() end
    out.ents[#out.ents+1] = r
    e.destroy()
    ::continue::
  end
  end
  helpers.write_file('probe.json', helpers.table_to_json(out), false)
end)
