
local builds=helpers.json_to_table(require('payload'))
script.on_init(function()
 storage.builds={}
 for i,b in ipairs(builds) do
  local s=game.create_surface('labs-'..i,{width=160,height=160,autoplace_controls={}})
  s.request_to_generate_chunks({0,0},3);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities()) do e.destroy() end
  local tiles={};for x=-60,70 do for y=-40,40 do tiles[#tiles+1]={name='lab-dark-1',position={x,y}} end end;s.set_tiles(tiles)
  local f=game.create_force('labs-'..i);f.add_research('rgby-test')
  local es={};for _,e in ipairs(b.entities) do
   assert(s.can_place_entity{name=e.name,position=e.position,force=f,direction=e.direction or 0},'collision '..e.entity_number)
   es[e.entity_number]=assert(s.create_entity{name=e.name,position=e.position,force=f,direction=e.direction or 0})
  end
  for _,w in ipairs(b.wires) do es[w[1]].get_wire_connector(defines.wire_connector_id.pole_copper,true).connect_to(es[w[3]].get_wire_connector(defines.wire_connector_id.pole_copper,true)) end
  local power=s.create_entity{name='electric-energy-interface',position={-5,3.5},force=f};power.power_production=1000000000;power.electric_buffer_size=1000000000
  local pole=s.create_entity{name='medium-electric-pole',position={-2,3.5},force=f}
  pole.get_wire_connector(defines.wire_connector_id.pole_copper,true).connect_to(es[b.powerPoleIds[1]].get_wire_connector(defines.wire_connector_id.pole_copper,true))
  local labs={};for _,l in ipairs(b.metadata.labs) do labs[#labs+1]={entity=es[l.entity],id=l.entity,seen={},working=0} end
  storage.builds[i]={entities=es,labs=labs,force=f,ports=b.ports,supplied={}}
 end
end)
script.on_event(defines.events.on_tick,function(event)
 for _,b in ipairs(storage.builds) do
  if event.tick%8==0 then for _,p in ipairs(b.ports) do for _,lane in ipairs(p.lanes) do
   if b.entities[p.entity].get_transport_line(lane.lane).insert_at_back{name=lane.item,count=1} then b.supplied[lane.item]=(b.supplied[lane.item] or 0)+1 end
  end end end
  if event.tick%60==0 then for _,l in ipairs(b.labs) do
   local inv=l.entity.get_inventory(defines.inventory.lab_input)
   for _,p in ipairs(b.ports) do for _,item in ipairs(p.items) do if inv.get_item_count(item)>0 then l.seen[item]=true end end end
   if l.entity.status==defines.entity_status.working then l.working=l.working+1 end
  end end
 end
 if event.tick==21600 then
  local report={passed=true,builds={},feedPolicy='Saturated west input lanes only; no internal inventory injection; 6 simulated minutes; 60-second research'}
  for _,b in ipairs(storage.builds) do
   local r={labs={},supplied=b.supplied,researchProgress=b.force.research_progress,passed=true}
   for _,l in ipairs(b.labs) do local n=0;for _ in pairs(l.seen) do n=n+1 end
    local ok=n==4 and l.working>0 and l.entity.energy>0
    r.labs[#r.labs+1]={entity=l.id,seen=l.seen,workingSamples=l.working,powered=l.entity.energy>0,passed=ok};r.passed=r.passed and ok
   end
   r.passed=r.passed and r.researchProgress>0;report.passed=report.passed and r.passed;report.builds[#report.builds+1]=r
  end
  helpers.write_file('report.json',helpers.table_to_json(report),false)
 end
end)
