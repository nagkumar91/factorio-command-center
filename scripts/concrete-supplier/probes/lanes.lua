-- Probe: which belt lane an arm drops on in the supplier layouts; which chemical-plant input the
-- solid-fuel recipe uses; how much a crafter puts in its output before it stops.
local out={}
local function log(k,v) out[#out+1]={k=k,v=v} end
local function write() helpers.write_file('lanes.json',helpers.table_to_json(out),false) end
local s,f
local cases={}
local function ent(name,x,y,extra) local t={name=name,position={x,y},force=f};for k,v in pairs(extra or {})do t[k]=v end;local e=s.create_entity(t);assert(e,'could not place '..name..' at '..x..','..y);return e end
local function src(x,y,item) local c=ent('infinity-chest',x+.5,y+.5);c.set_infinity_container_filter(1,{name=item,count=50,mode='exactly'});return c end
local function belt(x,y,d,extra) return ent('fast-transport-belt',x+.5,y+.5,{direction=d}) end
local function arm(x,y,d,name) local a=ent(name or 'fast-inserter',x+.5,y+.5,{direction=d});return a end
local function lanes(e) return {e.get_transport_line(1).get_item_count(),e.get_transport_line(2).get_item_count()} end
script.on_init(function()
 s=game.surfaces[1];f=game.forces.player;f.enable_all_recipes()
 local tiles={};for x=-60,60 do for y=-40,40 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end;s.set_tiles(tiles)
 for _,e in pairs(s.find_entities())do e.destroy()end
 -- power: an energy interface and a grid of substations
 local eei=ent('electric-energy-interface',-55.5,-35.5);eei.electric_buffer_size=1e10;eei.power_production=1e10
 for x=-54,54,16 do for y=-34,34,16 do ent('substation',x,y) end end
 local d=defines.direction
 -- case away: arm west of an east belt drops on (2,0), belt runs to (4,0)
 do local ox,oy=-40,-30;src(ox,oy,'concrete');arm(ox+1,oy,d.west);for x=2,4 do belt(ox+x,oy,d.east)end;cases.away={exit=s.find_entity('fast-transport-belt',{ox+4.5,oy+.5})} end
 -- case curve: belt from north turns east at (2,0); arm west of the curve drops on it
 do local ox,oy=-30,-30;src(ox,oy,'concrete');arm(ox+1,oy,d.west);belt(ox+2,oy-1,d.south);for x=2,4 do belt(ox+x,oy,d.east)end;cases.curve={exit=s.find_entity('fast-transport-belt',{ox+4.5,oy+.5})} end
 -- case column: arm west of a south belt at (2,-1) that curves east at (2,0)
 do local ox,oy=-20,-30;src(ox,oy-1,'concrete');arm(ox+1,oy-1,d.west);belt(ox+2,oy-1,d.south);for x=2,4 do belt(ox+x,oy,d.east)end;cases.column={exit=s.find_entity('fast-transport-belt',{ox+4.5,oy+.5})} end
 -- case concrete4: column arm at (1,-1)->(2,-1) south, curve arm at (1,0)->(2,0) curve; exit (3,0)
 do local ox,oy=-10,-30;src(ox,oy-1,'concrete');src(ox,oy,'concrete');arm(ox+1,oy-1,d.west);arm(ox+1,oy,d.west);belt(ox+2,oy-1,d.south);belt(ox+2,oy,d.east);belt(ox+3,oy,d.east);cases.concrete4={exit=s.find_entity('fast-transport-belt',{ox+3.5,oy+.5})} end
 -- case north: arm north of an east belt drops south onto it
 do local ox,oy=0,-30;src(ox+2,oy-2,'concrete');arm(ox+2,oy-1,d.north);for x=2,4 do belt(ox+x,oy,d.east)end;cases.north={exit=s.find_entity('fast-transport-belt',{ox+4.5,oy+.5})} end
 -- case sideload: arm north of (2,0) east belt (south lane); stub (4,-1) south side-loads (4,0) fed from behind
 do local ox,oy=10,-30;src(ox+2,oy-2,'concrete');arm(ox+2,oy-1,d.north)
  for x=2,6 do belt(ox+x,oy,d.east)end;src(ox+4,oy-3,'concrete');arm(ox+4,oy-2,d.north);belt(ox+4,oy-1,d.south)
  cases.sideload={exit=s.find_entity('fast-transport-belt',{ox+6.5,oy+.5})} end
 -- chemical plants: pipe only at the west north input, only at the east north input
 for i,px in ipairs({-1,1}) do local cx,cy=-40+i*10,0
  local p=ent('chemical-plant',cx+.5,cy+.5,{direction=d.north});p.set_recipe('solid-fuel-from-light-oil')
  local pipe=ent('pipe',cx+px+.5,cy-2+.5);cases['plant'..i]={plant=p,pipe=pipe,side=px}
 end
 -- crafters with ingredients inserted by script and no output arm: how many products before they stop
 do local p=ent('assembling-machine-2',-10.5,10.5);p.set_recipe('concrete');cases.amConcrete={m=p} end
 do local p=ent('assembling-machine-2',-0.5,10.5);p.set_recipe('rocket-fuel');cases.amFuel={m=p} end
 do local p=ent('chemical-plant',10.5,10.5);p.set_recipe('solid-fuel-from-light-oil');cases.cpFuel={m=p} end
 -- assembler fluid: water pipe touching the concrete machine's output (south) connection
 do local p=ent('assembling-machine-2',20.5,10.5,{direction=d.west});p.set_recipe('concrete');local pipe=ent('pipe',18.5,10.5);cases.amWest={m=p,pipe=pipe} end
 storage.cases=cases
end)
script.on_event(defines.events.on_tick,function()
 local t=game.tick;local c=storage.cases
 for i=1,2 do local k=c['plant'..i];if k then k.pipe.insert_fluid{name='light-oil',amount=100} end end
 c.amWest.pipe.insert_fluid{name='water',amount=100}
 if t%60==0 then
  for _,k in ipairs({'amConcrete','amFuel'})do local m=c[k].m;local inv=m.get_inventory(defines.inventory.crafter_input)
   if k=='amConcrete' then inv.insert{name='stone-brick',count=10};inv.insert{name='iron-ore',count=2};m.insert_fluid{name='water',amount=200}
   else inv.insert{name='solid-fuel',count=20};m.insert_fluid{name='light-oil',amount=20} end end
  c.cpFuel.m.insert_fluid{name='light-oil',amount=100}
  c.amWest.m.get_inventory(defines.inventory.crafter_input).insert{name='stone-brick',count=10};c.amWest.m.get_inventory(defines.inventory.crafter_input).insert{name='iron-ore',count=2}
 end
 if t==3600 or t==3600*12 then
  local tag=t==3600 and 'm1' or 'm12'
  for _,k in ipairs({'away','curve','column','concrete4','north','sideload'})do log(tag..':'..k,lanes(c[k].exit)) end
  for i=1,2 do local k=c['plant'..i];local fb={};for j=1,k.plant.fluids_count do fb[j]=k.plant.get_fluid(j) or 'empty' end
   log(tag..':plant side '..k.side,{finished=k.plant.products_finished,fluidbox=fb,status=k.plant.status}) end
  for _,k in ipairs({'amConcrete','amFuel','cpFuel','amWest'})do local m=c[k].m;local fb={};for j=1,m.fluids_count do fb[j]=m.get_fluid(j) or 'empty' end
   log(tag..':'..k,{finished=m.products_finished,out=m.get_inventory(defines.inventory.crafter_output).get_contents(),status=m.status,fluidbox=fb}) end
  local st={};for n,v in pairs(defines.entity_status)do st[v]=n end;log('statusNames',st)
  write()
 end
end)
