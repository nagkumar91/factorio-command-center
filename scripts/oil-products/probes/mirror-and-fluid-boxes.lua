local payload=helpers.json_to_table(require('payload'))
local out={}
script.on_init(function()
 local s=game.create_surface('p',{width=256,height=64,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
 s.request_to_generate_chunks({0,0},4);s.force_generate_chunk_requests()
 for _,e in pairs(s.find_entities())do e.destroy()end
 local f=game.forces.player;f.enable_all_recipes()
 local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};out.import=inv[1].import_stack(payload.code)
 local ghosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},build_mode=defines.build_mode.forced}
 out.ghosts=#ghosts;out.ents={}
 for _,g in pairs(ghosts)do local _,e=g.revive();
  local r={name=e.name,pos=e.position,dir=e.direction,mirroring=e.mirroring,recipe=e.get_recipe() and e.get_recipe().name,boxes={}}
  for i=1,e.fluids_count do
   local b={index=i}
   local ok,v=pcall(function() local f=e.get_fluid_filter(i);return f and f.name end);b.filter=ok and v or ('ERR '..tostring(v))
   b.locked=nil
   ok,v=pcall(function() local p=e.get_fluid_box_prototype(i);if p.object_name then return p.production_type end;local t={};for _,q in pairs(p)do t[#t+1]=q.production_type end;return table.concat(t,'+') end);b.ptype=ok and v or ('ERR '..tostring(v))
   ok,v=pcall(function() local c={};for _,pc in pairs(e.get_fluid_box_pipe_connections(i))do c[#c+1]={pos={pc.position.x-e.position.x,pc.position.y-e.position.y},target={pc.target_position.x-e.position.x,pc.target_position.y-e.position.y},flow=pc.flow_direction,type=pc.connection_type} end return c end)
   b.conns=ok and v or ('ERR '..tostring(v))
   r.boxes[#r.boxes+1]=b
  end
  out.ents[#out.ents+1]=r
 end
 helpers.write_file('result.json',helpers.table_to_json(out),false)
end)
