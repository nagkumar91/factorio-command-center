local payload = helpers.json_to_table(require('payload'))
local out = {}
script.on_init(function()
  local s = game.planets.vulcanus.create_surface({width=256, height=64, seed=1})
  s.request_to_generate_chunks({0,0}, 4); s.force_generate_chunk_requests()
  for _, e in pairs(s.find_entities()) do e.destroy() end
  local tiles = {}; for x=-100,100 do for y=-30,30 do tiles[#tiles+1] = {name='volcanic-ash-flats', position={x,y}} end end
  s.set_tiles(tiles)
  local f = game.forces.player; f.enable_all_recipes()
  local inv = game.create_inventory(1); inv[1].set_stack{name='blueprint'}
  out.import = inv[1].import_stack(payload.code)
  local ghosts = inv[1].build_blueprint{surface=s, force=f, position={0,0}, build_mode=defines.build_mode.forced}
  out.ents = {}
  for _, g in pairs(ghosts) do
    local tag = g.tags and g.tags.id
    local _, e = g.revive()
    local r = {name=e.name, tag=tag, pos={e.position.x,e.position.y}, dir=e.direction, mirror=e.mirroring, recipe=e.get_recipe() and e.get_recipe().name, boxes={}}
    for i=1,e.fluids_count do
      local b = {index=i}
      local ok, v = pcall(function() local fl = e.get_fluid_filter(i); return fl and fl.name end); b.filter = ok and v or nil
      ok, v = pcall(function() local c={}; for _,pc in pairs(e.get_fluid_box_pipe_connections(i)) do c[#c+1]={target={pc.target_position.x-e.position.x, pc.target_position.y-e.position.y}, flow=pc.flow_direction} end; return c end)
      b.conns = ok and v or ('ERR '..tostring(v))
      r.boxes[#r.boxes+1] = b
    end
    out.ents[#out.ents+1] = r
  end
  helpers.write_file('probe.json', helpers.table_to_json(out), false)
end)
