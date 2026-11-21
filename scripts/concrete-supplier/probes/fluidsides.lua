-- Probe: which side an assembling-machine-2 (concrete, rocket fuel) and a chemical plant (solid fuel from light
-- oil) take their fluid from, for each direction, with one pipe on one side's centre (or the plant's corner tiles).
local out={}
local function log(k,v) out[#out+1]={k=k,v=v} end
local s,f
script.on_init(function()
 s=game.surfaces[1];f=game.forces.player;f.enable_all_recipes()
 local tiles={};for x=-80,80 do for y=-60,60 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end;s.set_tiles(tiles)
 for _,e in pairs(s.find_entities())do e.destroy()end
 local eei=s.create_entity{name='electric-energy-interface',position={-75.5,-55.5},force=f};eei.electric_buffer_size=1e10;eei.power_production=1e10
 for x=-74,74,16 do for y=-54,54,16 do s.create_entity{name='substation',position={x,y},force=f} end end
 storage.c={}
 local dirs={north=0,east=4,south=8,west=12}
 local sides={N={0,-2},E={2,0},S={0,2},W={-2,0}}
 local row=0
 for _,spec in ipairs({{'assembling-machine-2','concrete','water'},{'assembling-machine-2','rocket-fuel','light-oil'}})do
  local col=0
  for dn,dv in pairs(dirs)do for sn,sv in pairs(sides)do
   local cx,cy=-70+col*8,-40+row*8
   local m=s.create_entity{name=spec[1],position={cx+.5,cy+.5},direction=dv,force=f,recipe=spec[2]}
   local p=s.create_entity{name='pipe',position={cx+sv[1]+.5,cy+sv[2]+.5},force=f}
   storage.c[#storage.c+1]={m=m,p=p,fluid=spec[3],tag=spec[1]..'/'..spec[2]..' dir '..dn..' pipe '..sn}
   col=col+1
  end end
  row=row+1
 end
 -- chemical plant: pipe on each of the eight edge-adjacent corner positions (x=+-1 on N/S, y=+-1 on E/W)
 local col=0
 for dn,dv in pairs(dirs)do for _,sv in ipairs({{-1,-2},{1,-2},{-1,2},{1,2},{2,-1},{2,1},{-2,-1},{-2,1}})do
  local cx,cy=-70+(col%18)*8,10+math.floor(col/18)*8
  local m=s.create_entity{name='chemical-plant',position={cx+.5,cy+.5},direction=dv,force=f,recipe='solid-fuel-from-light-oil'}
  local p=s.create_entity{name='pipe',position={cx+sv[1]+.5,cy+sv[2]+.5},force=f}
  storage.c[#storage.c+1]={m=m,p=p,fluid='light-oil',tag='chemical-plant dir '..dn..' pipe '..sv[1]..','..sv[2]}
  col=col+1
 end end
end)
script.on_event(defines.events.on_tick,function()
 for _,c in ipairs(storage.c)do c.p.insert_fluid{name=c.fluid,amount=50} end
 if game.tick==600 then
  for _,c in ipairs(storage.c)do
   local n=0;for j=1,c.m.fluids_count do local fl=c.m.get_fluid(j);if fl then n=n+fl.amount end end
   if n>0 then log(c.tag,n) end
  end
  helpers.write_file('fluidsides.json',helpers.table_to_json(out),false)
 end
end)
