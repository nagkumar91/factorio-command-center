local payload=helpers.json_to_table(require('payload'))
local out
local E
script.on_init(function() storage.E={};E=storage.E;storage.out_={log={}};out=storage.out_
 local s=game.create_surface('p',{width=128,height=64,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
 s.request_to_generate_chunks({0,0},3);s.force_generate_chunk_requests()
 for _,e in pairs(s.find_entities())do e.destroy()end
 local f=game.forces.player
 local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};out.import=inv[1].import_stack(payload.code)
 local ghosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},build_mode=defines.build_mode.forced}
 for _,g in pairs(ghosts)do local id=g.tags.probe;local _,e=g.revive();E[id]=e end
 local p=E[payload.pump];local cb=p.get_control_behavior()
 out.pumpCB={enable=cb and cb.circuit_enable_disable,cond=cb and cb.circuit_condition}
 out.pumpRate=p.prototype.get_pumping_speed and p.prototype.get_pumping_speed() or nil
 -- power: energy interface
 local ei=s.create_entity{name='electric-energy-interface',position={20,20},force=f};ei.power_production=1e9;ei.electric_buffer_size=1e10
 local sub=s.create_entity{name='substation',position={6,4},force=f}
 local sub2=s.create_entity{name='substation',position={14,14},force=f}
 local sub3=s.create_entity{name='substation',position={20,18},force=f}
 storage.drawn={0,0,0};storage.fed=0;storage.out=0
 -- fill the three lines with water
 for i,l in ipairs(payload.lines)do local e=E[l[1]];out['fill'..i]=e.insert_fluid{name='water',amount=500} end
end)
script.on_event(defines.events.on_tick,function(ev) E=storage.E;out=storage.out_
 local t=ev.tick
 if t==1 then end
 local src=E[payload.src];storage.fed=storage.fed+src.insert_fluid{name='heavy-oil',amount=5}
 local o=E[payload.out];local r=o.remove_fluid(1,1000);if r then storage.out=storage.out+(r.amount or 0) end
 -- draw methods on lines: 1 remove_fluid on last pipe, 2 remove_fluid_segment_fluid, 3 extract_fluid
 local l1=E[payload.lines[1][5]];local l2=E[payload.lines[2][5]];local l3=E[payload.lines[3][5]]
 if t<=50 then
  local a=l1.remove_fluid(1,3);storage.drawn[1]=storage.drawn[1]+((a and a.amount) or 0)
  local b=l2.remove_fluid_segment_fluid(1,3);storage.drawn[2]=storage.drawn[2]+((b and b.amount) or 0)
  local c=l3.extract_fluid{name='water',amount=3};storage.drawn[3]=storage.drawn[3]+(c or 0)
 end
 if t%300==0 then
  local tank=E[payload.tank];local p=E[payload.pump]
  local sig=tank.get_signal({type='fluid',name='heavy-oil'},defines.wire_connector_id.circuit_red)
  local pumpSig=p.get_signal({type='fluid',name='heavy-oil'},defines.wire_connector_id.circuit_red)
  local seg=tank.get_fluid_segment_fluid(1)
  out.log[#out.log+1]={t=t,fed=storage.fed,out=storage.out,tank=tank.get_fluid_count('heavy-oil'),seg=seg and seg.amount,segcap=tank.get_fluid_segment_capacity(1),tankSig=sig,pumpSig=pumpSig,pumpStatus=p.status,pumpActive=p.status==defines.entity_status.working,srcSeg=E[payload.src].get_fluid_segment_id(1),tankSeg=tank.get_fluid_segment_id(1),pipeCount=E[payload.src].get_fluid_count('heavy-oil'),drawn={storage.drawn[1],storage.drawn[2],storage.drawn[3]},l1=l1.get_fluid_segment_fluid(1),l2=l2.get_fluid_segment_fluid(1),l3=l3.get_fluid_segment_fluid(1)}
  helpers.write_file('result.json',helpers.table_to_json(out),false)
 end
end)
