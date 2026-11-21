-- Probe: which belt lane a long-handed arm fills, and which lane any arm fills on a belt that runs towards it.
-- Each case reads [left, right] item counts (transport lines 1 and 2) once the belts have backed up.
local out={}
local function log(k,v) out[#out+1]={k=k,v=v} end
local s,f
local cases={}
local function ent(name,x,y,extra) local t={name=name,position={x,y},force=f};for k,v in pairs(extra or {})do t[k]=v end;local e=s.create_entity(t);assert(e,'could not place '..name..' at '..x..','..y);return e end
local function src(x,y) local c=ent('infinity-chest',x+.5,y+.5);c.set_infinity_container_filter(1,{name='concrete',count=50,mode='exactly'});return c end
local function belt(x,y,d) return ent('fast-transport-belt',x+.5,y+.5,{direction=d}) end
local function arm(x,y,d,name) return ent(name or 'fast-inserter',x+.5,y+.5,{direction=d}) end
local function lanes(e) return {e.get_transport_line(1).get_item_count(),e.get_transport_line(2).get_item_count()} end
script.on_init(function()
 s=game.surfaces[1];f=game.forces.player;f.enable_all_recipes()
 local tiles={};for x=-60,60 do for y=-40,40 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end;s.set_tiles(tiles)
 for _,e in pairs(s.find_entities())do e.destroy()end
 local eei=ent('electric-energy-interface',-55.5,-35.5);eei.electric_buffer_size=1e10;eei.power_production=1e10
 for x=-54,54,16 do for y=-34,34,16 do ent('substation',x,y) end end
 local d=defines.direction
 -- case longNorth (the published 5 x 6): a long-handed arm two tiles north of an east belt, a panel under its swing.
 do local ox,oy=-40,-30;src(ox+2,oy-4);arm(ox+2,oy-2,d.north,'long-handed-inserter');ent('display-panel',ox+2.5,oy-.5)
  for x=2,4 do belt(ox+x,oy,d.east)end;cases.longNorth={exit=s.find_entity('fast-transport-belt',{ox+4.5,oy+.5})} end
 -- case fastToward: a fast arm west of a single belt tile that runs west, towards the arm (a dead end).
 do local ox,oy=-30,-30;src(ox,oy);arm(ox+1,oy,d.west);cases.fastToward={exit=belt(ox+2,oy,d.west)} end
 -- case longToward (the 8 x 4 candidate): a long-handed arm drops over a south-running column onto a belt that runs
 -- west, towards the arm, into that column; the column turns east on the row below and runs two more tiles.
 do local ox,oy=-20,-30;src(ox,oy);arm(ox+2,oy,d.west,'long-handed-inserter')
  cases.longTowardDrop={exit=belt(ox+4,oy,d.west)};belt(ox+3,oy,d.south);belt(ox+3,oy+1,d.east);belt(ox+4,oy+1,d.east)
  cases.longToward={exit=belt(ox+5,oy+1,d.east)} end
 -- case longTowardPair (the 8 x 4 candidate, both arms): the same, plus a fast arm west of the corner tile.
 do local ox,oy=-10,-30;src(ox,oy);arm(ox+2,oy,d.west,'long-handed-inserter');src(ox+1,oy+1);arm(ox+2,oy+1,d.west)
  belt(ox+4,oy,d.west);belt(ox+3,oy,d.south);belt(ox+3,oy+1,d.east)
  cases.longTowardPair={exit=belt(ox+4,oy+1,d.east)} end
 -- case fiveBySixPair (the published 5 x 6, both arms): long-handed arm onto the first exit-row belt from the north,
 -- fast arm onto a one-tile stub that side-loads the second; the third tile is the exit.
 do local ox,oy=0,-30;src(ox,oy-4);arm(ox,oy-2,d.north,'long-handed-inserter');ent('display-panel',ox+.5,oy-.5)
  src(ox+1,oy-3);arm(ox+1,oy-2,d.north);belt(ox+1,oy-1,d.south)
  belt(ox,oy,d.east);belt(ox+1,oy,d.east);cases.fiveBySixPair={exit=belt(ox+2,oy,d.east)} end
 storage.cases=cases
end)
script.on_event(defines.events.on_tick,function()
 local t=game.tick;local c=storage.cases
 if t==3600 or t==3600*5 then
  local tag=t==3600 and 'm1' or 'm5'
  for _,k in ipairs({'longNorth','fastToward','longTowardDrop','longToward','longTowardPair','fiveBySixPair'})do log(tag..':'..k,lanes(c[k].exit)) end
  helpers.write_file('reach.json',helpers.table_to_json(out),false)
 end
end)
