local payload=helpers.json_to_table(require('payload'))
script.on_init(function()
 storage.E={}
 local s=game.create_surface('p',{width=128,height=128,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
 s.request_to_generate_chunks({0,0},3);s.force_generate_chunk_requests()
 for _,e in pairs(s.find_entities())do e.destroy()end
 local f=game.forces.player;f.enable_all_recipes()
 local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};storage.import=inv[1].import_stack(payload.code)
 local ghosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},build_mode=defines.build_mode.forced}
 storage.ghosts=#ghosts
 for _,g in pairs(ghosts)do local id=g.tags.probe;local _,e=g.revive();storage.E[id]=e end
end)
script.on_event(defines.events.on_tick,function(ev)
 local E=storage.E
 for _,t in ipairs(payload.tests)do
  E[t.src].insert_fluid{name='water',amount=50}
  if t.vsrc then E[t.vsrc].insert_fluid{name='crude-oil',amount=50} end
 end
 if ev.tick==120 then
  local out={import=storage.import,ghosts=storage.ghosts,tests={}}
  local function f(id) local e=E[id];local x=e.get_fluid_segment_fluid(1);return {seg=e.get_fluid_segment_id(1),fluid=x and x.name,amount=x and x.amount} end
  for _,t in ipairs(payload.tests)do local r={kind=t.kind,gap=t.gap,src=f(t.src),dst=f(t.dst)}
   if t.vsrc then r.vsrc=f(t.vsrc);r.vdst=f(t.vdst) end
   if t.surface then r.surface=f(t.surface) end
   out.tests[#out.tests+1]=r end
  helpers.write_file('result.json',helpers.table_to_json(out),false)
 end
end)
