Below is a **single, consolidated “command history”** from this conversation, with **what each command does**, and notes about **when it’s correct / when it failed**. Everything is formatted so you can copy/paste easily.

> All commands are meant to be pasted into the Factorio console (opened with `~` / backquote) and start with `/c`.

---

# 1) Tech unlock commands

### Unlock Electric Furnace tech (only that tech)

```lua
/c game.player.force.technologies["advanced-material-processing-2"].researched = true
```

**Use:** Marks the Electric Furnace tech researched (does **not** auto-research prerequisites).

### Unlock Electric Furnace tech + prerequisites (recommended)

```lua
/c game.player.force.technologies["advanced-material-processing-2"].research_recursive()
```

**Use:** Researches that tech and all prerequisites.

### Unlock everything needed up to Electric Mining Drill (prereqs included)

```lua
/c game.player.force.technologies["electric-mining-drill"].research_recursive()
```

**Use:** Researches electric-mining-drill and prerequisites.

### Unlock only Electric Mining Drill tech (no prereqs)

```lua
/c game.player.force.technologies["electric-mining-drill"].researched = true
```

### Unlock everything needed up to the Car (Automobilism)

```lua
/c game.player.force.technologies["automobilism"].research_recursive()
```

**Use:** Researches automobilism and prerequisites.

### Unlock everything needed up to Nuclear Power

```lua
/c game.player.force.technologies["nuclear-power"].research_recursive()
```

**Use:** Researches nuclear-power and prerequisites.

### Unlock EVERYTHING (all technologies)

```lua
/c game.player.force.research_all_technologies()
```

**Use:** Researches all technologies for your force.

---

# 2) Simple “give items to player” commands

### Add 200 solid fuel to your character

```lua
/c game.player.insert{name="solid-fuel", count=200}
```

### Give yourself Electric Mining Drills (example)

```lua
/c game.player.insert{name="electric-mining-drill", count=20}
```

### Give flamethrower ammo (inventory)

```lua
/c game.player.insert{name="flamethrower-ammo", count=2000}
```

### Big “combat kit” (weapons, ammo, capsules, turrets, walls, etc.)

```lua
/c local p=game.player; p.insert{name="modular-armor",count=1}; p.insert{name="personal-roboport-equipment",count=1}; p.insert{name="battery-equipment",count=2}; p.insert{name="solar-panel-equipment",count=4}; p.insert{name="construction-robot",count=50}; p.insert{name="submachine-gun",count=1}; p.insert{name="piercing-rounds-magazine",count=800}; p.insert{name="shotgun",count=1}; p.insert{name="piercing-shotgun-shell",count=200}; p.insert{name="grenade",count=200}; p.insert{name="poison-capsule",count=50}; p.insert{name="slowdown-capsule",count=50}; p.insert{name="distractor-capsule",count=50}; p.insert{name="rocket-launcher",count=1}; p.insert{name="rocket",count=200}; p.insert{name="land-mine",count=200}; p.insert{name="stone-wall",count=400}; p.insert{name="gun-turret",count=40}; p.insert{name="piercing-rounds-magazine",count=800}; p.insert{name="repair-pack",count=200}; p.insert{name="raw-fish",count=100}
```

**Use:** “Wipe a nest” starter kit.

### Give huge bot counts

```lua
/c local p=game.player; p.insert{name="construction-robot",count=2000}; p.insert{name="logistic-robot",count=2000}
```

### Give armor + lasers + power (for tank driving + lasers)

```lua
/c local p=game.player; p.insert{name="power-armor-mk2",count=1}; p.insert{name="personal-laser-defense-equipment",count=8}; p.insert{name="fusion-reactor-equipment",count=2}; p.insert{name="battery-mk2-equipment",count=6}; p.insert{name="exoskeleton-equipment",count=2}; p.insert{name="personal-roboport-mk2",count=2}; p.insert{name="construction-robot",count=50}; p.insert{name="repair-pack",count=200}; p.print("Armor + equipment added. Open armor grid and place them.")
```

**Use:** Equip grid manually, then lasers melt biters while you drive.

---

# 3) “Unlocked craftable items into chests” commands

## A) One stack of every item you can currently craft (enabled recipes)

### Multi-line version (original)

```lua
/c
local p = game.player
local f = p.force
local s = p.surface
local origin = p.position

local CHEST = "steel-chest"
local STACKS_PER_ITEM = 1

local function tsize(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

local chests = {}
local function new_chest(i)
  local dx = 2 + (i % 10)
  local dy = math.floor(i / 10)
  local ent = s.create_entity{ name = CHEST, position = {origin.x + dx, origin.y + dy}, force = f }
  chests[#chests+1] = ent
  return ent.get_inventory(defines.inventory.chest)
end

local chest_i = 0
local inv = new_chest(chest_i)

local added = {}

for _, recipe in pairs(f.recipes) do
  if recipe.enabled then
    for _, prod in pairs(recipe.products) do
      if prod.type == "item" then
        local name = prod.name
        if not added[name] and game.item_prototypes[name] then
          added[name] = true

          local stack = game.item_prototypes[name].stack_size * STACKS_PER_ITEM
          local remaining = stack

          while remaining > 0 do
            local inserted = inv.insert{ name = name, count = remaining }
            remaining = remaining - inserted
            if remaining > 0 then
              chest_i = chest_i + 1
              inv = new_chest(chest_i)
            end
          end
        end
      end
    end
  end
end

p.print("Spawned " .. #chests .. " chest(s) with " .. tsize(added) .. " unlocked craftable item types.")
```

### One-line version (old API) — caused multiline issues for you

```lua
/c local p=game.player; local f=p.force; local s=p.surface; local o=p.position; local CHEST="steel-chest"; local STACKS_PER_ITEM=1; local function tsize(t) local n=0; for _ in pairs(t) do n=n+1 end; return n end; local function new_chest(i) local dx=2+(i%10); local dy=math.floor(i/10); local e=s.create_entity{name=CHEST,position={o.x+dx,o.y+dy},force=f}; return e.get_inventory(defines.inventory.chest) end; local added={}; local chest_i=0; local inv=new_chest(chest_i); for _,r in pairs(f.recipes) do if r.enabled then for _,prod in pairs(r.products) do if prod.type=="item" then local name=prod.name; if (not added[name]) and game.item_prototypes[name] then added[name]=true; local remaining=game.item_prototypes[name].stack_size*STACKS_PER_ITEM; while remaining>0 do local ins=inv.insert{name=name,count=remaining}; remaining=remaining-ins; if remaining>0 then chest_i=chest_i+1; inv=new_chest(chest_i); end end end end end end end; p.print("Chests: "..(chest_i+1).." | Item types: "..tsize(added))
```

**Note:** You hit `LuaGameScript does not contain key item_prototypes` on Factorio 2.0+.

### Fixed one-liner for Factorio 2.0+ (uses `prototypes.item`)

```lua
/c local p=game.player; local f=p.force; local s=p.surface; local o=p.position; local CHEST="steel-chest"; local STACKS_PER_ITEM=1; local function tsize(t) local n=0; for _ in pairs(t) do n=n+1 end; return n end; local function get_stack(name) local ip=nil; if prototypes and prototypes.item then ip=prototypes.item[name] end; if (not ip) and game.item_prototypes then ip=game.item_prototypes[name] end; return (ip and ip.stack_size) or 1 end; local function new_chest(i) local dx=2+(i%10); local dy=math.floor(i/10); local e=s.create_entity{name=CHEST,position={o.x+dx,o.y+dy},force=f}; return e.get_inventory(defines.inventory.chest) end; local added={}; local chest_i=0; local inv=new_chest(chest_i); for _,r in pairs(f.recipes) do if r.enabled then for _,prod in pairs(r.products) do if prod.type=="item" then local name=prod.name; if not added[name] then added[name]=true; local remaining=get_stack(name)*STACKS_PER_ITEM; while remaining>0 do local ins=inv.insert{name=name,count=remaining}; remaining=remaining-ins; if remaining>0 then chest_i=chest_i+1; inv=new_chest(chest_i); end end end end end end end; p.print("Chests: "..(chest_i+1).." | Item types: "..tsize(added))
```

---

# 4) Car / Tank spawning + loading commands

## A) Spawn a car and fill trunk with unlocked craftable items (enabled recipes)

```lua
/c local p=game.player; local f=p.force; local s=p.surface; local pos=s.find_non_colliding_position("car",{p.position.x+2,p.position.y},5,0.5) or {p.position.x+2,p.position.y}; local car=s.create_entity{name="car",position=pos,force=f,raise_built=true}; if not car then p.print("Couldn't place car here."); return end; local trunk=car.get_inventory(defines.inventory.car_trunk); local fuel=car.get_inventory(defines.inventory.fuel); if fuel then fuel.insert{name="solid-fuel",count=200} end; local function stack_size(name) local ip=(prototypes and prototypes.item and prototypes.item[name]) or (game.item_prototypes and game.item_prototypes[name]); return (ip and ip.stack_size) or 1 end; local added=0; local seen={}; for _,r in pairs(f.recipes) do if r.enabled then for _,prod in pairs(r.products) do if prod.type=="item" then local name=prod.name; if not seen[name] then seen[name]=true; local cnt=stack_size(name); local ins=trunk.insert{name=name,count=cnt}; if ins>0 then added=added+1 else p.print("Trunk full after "..added.." item types."); return end end end end end end; p.print("Loaded "..added.." item types into the car trunk.")
```

## B) Spawn tank (initial versions) + load ammo

### Spawn tank with ammo/fuel (earlier attempt; mixed inventories)

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local pos=s.find_non_colliding_position("tank",{p.position.x+3,p.position.y},8,0.5) or {p.position.x+3,p.position.y}; local t=s.create_entity{name="tank",position=pos,force=f,raise_built=true}; if t then local fu=t.get_inventory(defines.inventory.fuel); if fu then fu.insert{name="rocket-fuel",count=200} end; local a=t.get_inventory(defines.inventory.turret_ammo); if a then a.insert{name="uranium-rounds-magazine",count=2000} end; local c=t.get_inventory(defines.inventory.turret_ammo); if c then c.insert{name="explosive-cannon-shell",count=200} end; p.print("Tank spawned + loaded.") else p.print("Couldn't place tank here.") end
```

**Note:** This was not compatible in your game (wrong inventory target).

### Give ammo to player inventory (for manual reload)

```lua
/c local p=game.player; p.insert{name="uranium-rounds-magazine",count=2000}; p.insert{name="explosive-cannon-shell",count=200}; p.insert{name="explosive-rocket",count=200}; p.insert{name="repair-pack",count=200}
```

### Fill trunk/ammo while in tank (first trunk loader; compatibility issues)

```lua
/c local p=game.player; local v=p.vehicle; if not (v and v.valid) then p.print("Get into your tank first."); return end; local inv=v.get_inventory(defines.inventory.car_trunk); if not inv then p.print("No trunk inventory found for this vehicle."); return end; inv.insert{name="uranium-rounds-magazine",count=20000}; inv.insert{name="explosive-cannon-shell",count=2000}; inv.insert{name="explosive-rocket",count=5000}; inv.insert{name="rocket-fuel",count=2000}; inv.insert{name="repair-pack",count=1000}; inv.insert{name="raw-fish",count=500}; p.print("Loaded trunk with lots of ammo/supplies.")
```

### Top off “ammo + fuel” while in tank (earlier attempt)

```lua
/c local p=game.player; local v=p.vehicle; if not (v and v.valid) then p.print("Get into your tank first."); return end; local ammo=v.get_inventory(defines.inventory.turret_ammo); if ammo then ammo.insert{name="uranium-rounds-magazine",count=2000}; ammo.insert{name="explosive-cannon-shell",count=200} end; local fuel=v.get_inventory(defines.inventory.fuel); if fuel then fuel.insert{name="rocket-fuel",count=200} end; p.print("Topped off tank ammo + fuel.")
```

**Note:** In your setup, using `turret_ammo` was wrong for tank weapons.

## C) Corrected: spawn a NEW tank and try to load using `car_ammo`

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local pos=s.find_non_colliding_position("tank",{p.position.x+3,p.position.y},10,0.5) or {p.position.x+3,p.position.y}; local t=s.create_entity{name="tank",position=pos,force=f,raise_built=true}; if not t then p.print("Couldn't place tank here."); return end; local ammo=t.get_inventory(defines.inventory.car_ammo); local trunk=t.get_inventory(defines.inventory.car_trunk); local fuel=t.get_inventory(defines.inventory.fuel); local function put(inv,name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count}; return true end; return false end; if fuel then put(fuel,"rocket-fuel",200) end; if ammo then put(ammo,"uranium-rounds-magazine",2000); put(ammo,"explosive-uranium-cannon-shell",200); if not ammo.is_full() then put(ammo,"explosive-cannon-shell",200) end end; if trunk then put(trunk,"rocket-fuel",5000); put(trunk,"repair-pack",2000); put(trunk,"uranium-rounds-magazine",50000); put(trunk,"explosive-uranium-cannon-shell",10000); put(trunk,"uranium-cannon-shell",5000); put(trunk,"explosive-cannon-shell",5000); put(trunk,"explosive-rocket",20000); end; p.print("New tank spawned + loaded (ammo slots, trunk, fuel). Get in and go.")
```

## D) Spawn NEW tank loaded including flamethrower ammo

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local pos=s.find_non_colliding_position("tank",{p.position.x+3,p.position.y},10,0.5) or {p.position.x+3,p.position.y}; local t=s.create_entity{name="tank",position=pos,force=f,raise_built=true}; if not t then p.print("Couldn't place tank here."); return end; local ammo=t.get_inventory(defines.inventory.car_ammo); local trunk=t.get_inventory(defines.inventory.car_trunk); local fuel=t.get_inventory(defines.inventory.fuel); local function put(inv,name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count}; return true end; p.print("Not compatible / no space: "..name); return false end; put(fuel,"rocket-fuel",500); put(ammo,"flamethrower-ammo",500); put(ammo,"explosive-uranium-cannon-shell",200); put(ammo,"uranium-rounds-magazine",2000); put(trunk,"flamethrower-ammo",5000); put(trunk,"explosive-uranium-cannon-shell",2000); put(trunk,"uranium-rounds-magazine",20000); put(trunk,"rocket-fuel",5000); put(trunk,"repair-pack",2000); p.print("New tank spawned + loaded (includes flamethrower ammo).")
```

---

# 5) Robot network: place roboports + grids + supply

## A) Give yourself “robot builder gear” (armor grid kit)

```lua
/c local p=game.player; p.insert{name="power-armor-mk2",count=1}; p.insert{name="personal-roboport-mk2",count=4}; p.insert{name="battery-mk2-equipment",count=6}; p.insert{name="fusion-reactor-equipment",count=2}; p.insert{name="exoskeleton-equipment",count=2}; p.insert{name="construction-robot",count=200}; p.insert{name="logistic-robot",count=200}; p.insert{name="repair-pack",count=200}
```

## B) Build a roboport grid around you, load each roboport with bots + some materials

```lua
/c local p=game.player; local f=p.force; local s=p.surface; local cx,cy=p.position.x,p.position.y; local R=2; local SPACING=50; local BOTS_C=100; local BOTS_L=100; local function place(name,x,y) return s.create_entity{name=name,position={x,y},force=f,raise_built=true} end; for gx=-R,R do for gy=-R,R do local x=cx+gx*SPACING; local y=cy+gy*SPACING; local rp=place("roboport",x,y); if rp then local rpinv=rp.get_inventory(defines.inventory.roboport_robot); if rpinv then rpinv.insert{name="construction-robot",count=BOTS_C}; rpinv.insert{name="logistic-robot",count=BOTS_L}; end; local mat=rp.get_inventory(defines.inventory.roboport_material); if mat then mat.insert{name="repair-pack",count=200}; mat.insert{name="construction-robot",count=0}; mat.insert{name="transport-belt",count=2000}; mat.insert{name="inserter",count=200}; mat.insert{name="electric-mining-drill",count=50}; mat.insert{name="electric-furnace",count=48}; mat.insert{name="assembling-machine-2",count=40}; mat.insert{name="medium-electric-pole",count=200}; mat.insert{name="pipe",count=400}; mat.insert{name="substation",count=50}; end; end; place("substation",x+18,y); end end; p.print("Built roboport grid radius "..R.." (total "..((2*R+1)*(2*R+1))..")")
```

---

# 6) “Everything in the game” crates

## A) Crates containing **every item prototype** (spills into many chests)

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local CHEST_NAME="steel-chest"; local STACKS_PER_ITEM=1; local GRID_W=10; local SPACING=1; local function new_chest(i) local dx=2+(i%GRID_W)*SPACING; local dy=math.floor(i/GRID_W)*SPACING; local e=s.create_entity{name=CHEST_NAME,position={o.x+dx,o.y+dy},force=f,raise_built=true}; return e and e.get_inventory(defines.inventory.chest) or nil end; local function tsize(t) local n=0; for _ in pairs(t) do n=n+1 end; return n end; local seen={}; local chest_i=0; local inv=new_chest(chest_i); if not inv then p.print("Failed to create chest: "..CHEST_NAME); return end; local added=0; for name,proto in pairs(prototypes.item) do if not seen[name] then seen[name]=true; local remaining=(proto.stack_size or 1)*STACKS_PER_ITEM; while remaining>0 do local ins=inv.insert{name=name,count=remaining}; remaining=remaining-ins; if ins==0 then chest_i=chest_i+1; inv=new_chest(chest_i); if not inv then p.print("Failed creating chest #"..chest_i); return end end end; added=added+1 end end; p.print("Spawned "..(chest_i+1).." crate(s) containing "..added.." item types.")
```

**Use:** “I want everything, sorted into as many crates as required.”

---

# 7) Solar farm supply crates (and fixes)

## A) First “huge solar farm supply” crates (overfilled; later inserts could silently fail)

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local CHEST="steel-chest"; local GRID_W=8; local SPACING=1; local function chest(i) local x=o.x+2+(i%GRID_W)*SPACING; local y=o.y+math.floor(i/GRID_W)*SPACING; local e=s.create_entity{name=CHEST,position={x,y},force=f,raise_built=true}; return e and e.get_inventory(defines.inventory.chest) end; local i=0; local function add(list) local inv=chest(i); if not inv then p.print("Failed to place chest."); return end; for _,it in ipairs(list) do inv.insert{name=it[1],count=it[2]} end; i=i+1; end; add({{"solar-panel",20000},{"accumulator",20000}}); add({{"substation",1200},{"big-electric-pole",400},{"medium-electric-pole",800},{"power-switch",50}}); add({{"roboport",300},{"construction-robot",2000},{"logistic-chest-passive-provider",200},{"logistic-chest-storage",200},{"repair-pack",2000}}); add({{"concrete",50000},{"hazard-concrete",10000},{"landfill",10000}}); add({{"stone-wall",20000},{"gate",200},{"gun-turret",100},{"laser-turret",400}}); add({{"small-lamp",2000},{"radar",100},{"artillery-turret",20},{"artillery-shell",200}}); p.print("Spawned "..i.." supply crates for a huge, walled, well-lit solar farm (near you).")
```

**Note:** This is the one that led to “crates don’t have concrete/walls/etc” because too many different items were competing for chest slots.

## B) Fixed: dedicated crates so nothing gets squeezed out

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local CHEST="steel-chest"; local GRID_W=6; local SPACING=1; local idx=0; local function mk() local x=o.x+2+(idx%GRID_W)*SPACING; local y=o.y+math.floor(idx/GRID_W)*SPACING; idx=idx+1; local e=s.create_entity{name=CHEST,position={x,y},force=f,raise_built=true}; return e and e.get_inventory(defines.inventory.chest) end; local function fill(list) local inv=mk(); if not inv then p.print("Failed to place chest."); return end; for _,it in ipairs(list) do inv.insert{name=it[1],count=it[2]} end end; fill({{"concrete",20000},{"hazard-concrete",5000},{"landfill",5000}}); fill({{"stone-wall",20000},{"gate",200}}); fill({{"small-lamp",2000},{"radar",100},{"repair-pack",2000}}); fill({{"solar-panel",20000}}); fill({{"accumulator",20000}}); fill({{"substation",800},{"big-electric-pole",300},{"medium-electric-pole",800},{"power-switch",50}}); fill({{"roboport",200},{"construction-robot",1500},{"logistic-chest-passive-provider",100},{"logistic-chest-storage",100}}); fill({{"laser-turret",300},{"artillery-turret",10},{"artillery-shell",100}}); p.print("Spawned "..idx.." supply crates (concrete/walls/lamps/solar/accu/power/robots/defense).")
```

**Note:** Later you discovered your logistic chest item names differ; see Section 11 for the corrected chest names.

## C) Single crate of repair packs

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local e=s.create_entity{name="steel-chest",position={o.x+2,o.y},force=f,raise_built=true}; if e then e.get_inventory(defines.inventory.chest).insert{name="repair-pack",count=5000}; p.print("Repair-pack crate spawned.") else p.print("Couldn't place chest here.") end
```

---

# 8) Auto-place perimeter + lamps + roboports (REAL entities, huge area)

## A) Place a massive perimeter with lamps/poles/roboports (not ghosts)

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local cx,cy=p.position.x,p.position.y; local HALF_W=512; local HALF_H=512; local WALL="stone-wall"; local LAMP="small-lamp"; local POLE="big-electric-pole"; local ROBO="roboport"; local LAMP_STEP=12; local POLE_STEP=30; local ROBO_STEP=50; local function can(name,x,y) return s.can_place_entity{name=name,position={x,y},force=f} end; local function place(name,x,y) if can(name,x,y) then return s.create_entity{name=name,position={x,y},force=f,raise_built=true} end end; local x1=math.floor(cx-HALF_W); local x2=math.floor(cx+HALF_W); local y1=math.floor(cy-HALF_H); local y2=math.floor(cy+HALF_H); local walls,lamps,poles,robos=0,0,0,0; for x=x1,x2 do if place(WALL,x,y1) then walls=walls+1 end; if place(WALL,x,y2) then walls=walls+1 end end; for y=y1+1,y2-1 do if place(WALL,x1,y) then walls=walls+1 end; if place(WALL,x2,y) then walls=walls+1 end end; local lx1,ly1,lx2,ly2=x1+1,y1+1,x2-1,y2-1; for x=lx1,lx2,LAMP_STEP do if place(LAMP,x,ly1) then lamps=lamps+1 end; if place(LAMP,x,ly2) then lamps=lamps+1 end end; for y=ly1,ly2,LAMP_STEP do if place(LAMP,lx1,y) then lamps=lamps+1 end; if place(LAMP,lx2,y) then lamps=lamps+1 end end; local px1,py1,px2,py2=x1+2,y1+2,x2-2,y2-2; for x=px1,px2,POLE_STEP do if place(POLE,x,py1) then poles=poles+1 end; if place(POLE,x,py2) then poles=poles+1 end end; for y=py1,py2,POLE_STEP do if place(POLE,px1,y) then poles=poles+1 end; if place(POLE,px2,y) then poles=poles+1 end end; local rx1,ry1,rx2,ry2=x1+ROBO_STEP/2,y1+ROBO_STEP/2,x2-ROBO_STEP/2,y2-ROBO_STEP/2; for x=rx1,rx2,ROBO_STEP do for y=ry1,ry2,ROBO_STEP do if place(ROBO,x,y) then robos=robos+1 end end end; p.print("Placed perimeter: walls="..walls..", lamps="..lamps..", poles="..poles..", roboports="..robos..". (Size ~"..(HALF_W*2).."x"..(HALF_H*2)..")")
```

---

# 9) Perimeter as GHOSTS + crates on perimeter + gates in midpoints

## A) “Ghost perimeter + mid-wall gates + lamps + poles + roboports + supply crates”

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local cx,cy=p.position.x,p.position.y; local HALF_W=512; local HALF_H=512; local WALL="stone-wall"; local GATE="gate"; local LAMP="small-lamp"; local POLE="big-electric-pole"; local SUB="substation"; local ROBO="roboport"; local CHEST="steel-chest"; local LAMP_STEP=12; local POLE_STEP=30; local ROBO_STEP=50; local function can_real(name,x,y) return s.can_place_entity{name=name,position={x,y},force=f} end; local function place_real(name,x,y) if can_real(name,x,y) then return s.create_entity{name=name,position={x,y},force=f,raise_built=true} end end; local function ghost(name,x,y) return s.create_entity{name="entity-ghost",inner_name=name,position={x,y},force=f} end; local x1=math.floor(cx-HALF_W); local x2=math.floor(cx+HALF_W); local y1=math.floor(cy-HALF_H); local y2=math.floor(cy+HALF_H); local mx=math.floor((x1+x2)/2); local my=math.floor((y1+y2)/2); local walls,gates,lamps,poles,subs,robos=0,0,0,0,0,0; for x=x1,x2 do if x~=mx then if ghost(WALL,x,y1) then walls=walls+1 end; if ghost(WALL,x,y2) then walls=walls+1 end end end; for y=y1+1,y2-1 do if y~=my then if ghost(WALL,x1,y) then walls=walls+1 end; if ghost(WALL,x2,y) then walls=walls+1 end end end; if ghost(GATE,mx,y1) then gates=gates+1 end; if ghost(GATE,mx,y2) then gates=gates+1 end; if ghost(GATE,x1,my) then gates=gates+1 end; if ghost(GATE,x2,my) then gates=gates+1 end; local lx1,ly1,lx2,ly2=x1+1,y1+1,x2-1,y2-1; for x=lx1,lx2,LAMP_STEP do if ghost(LAMP,x,ly1) then lamps=lamps+1 end; if ghost(LAMP,x,ly2) then lamps=lamps+1 end end; for y=ly1,ly2,LAMP_STEP do if ghost(LAMP,lx1,y) then lamps=lamps+1 end; if ghost(LAMP,lx2,y) then lamps=lamps+1 end end; local px1,py1,px2,py2=x1+2,y1+2,x2-2,y2-2; for x=px1,px2,POLE_STEP do if ghost(POLE,x,py1) then poles=poles+1 end; if ghost(POLE,x,py2) then poles=poles+1 end end; for y=py1,py2,POLE_STEP do if ghost(POLE,px1,y) then poles=poles+1 end; if ghost(POLE,px2,y) then poles=poles+1 end end; if ghost(SUB,mx,y1+6) then subs=subs+1 end; if ghost(SUB,mx,y2-6) then subs=subs+1 end; if ghost(SUB,x1+6,my) then subs=subs+1 end; if ghost(SUB,x2-6,my) then subs=subs+1 end; local rx1,ry1,rx2,ry2=x1+ROBO_STEP/2,y1+ROBO_STEP/2,x2-ROBO_STEP/2,y2-ROBO_STEP/2; for x=rx1,rx2,ROBO_STEP do for y=ry1,ry2,ROBO_STEP do if ghost(ROBO,x,y) then robos=robos+1 end end end; local function mkcrate(x,y,items) local e=place_real(CHEST,x,y); if not e then return false end; local inv=e.get_inventory(defines.inventory.chest); for _,it in ipairs(items) do inv.insert{name=it[1],count=it[2]} end; return true end; local crates=0; crates=crates+(mkcrate(mx,y1+3,{{"stone-wall",20000},{"gate",400},{"repair-pack",1000}}) and 1 or 0); crates=crates+(mkcrate(mx,y2-3,{{"small-lamp",3000},{"big-electric-pole",800},{"substation",600}}) and 1 or 0); crates=crates+(mkcrate(x1+3,my,{{"roboport",300},{"construction-robot",2000},{"logistic-chest-storage",200},{"logistic-chest-passive-provider",200}}) and 1 or 0); crates=crates+(mkcrate(x2-3,my,{{"solar-panel",20000},{"accumulator",20000}}) and 1 or 0); crates=crates+(mkcrate(mx+6,y1+3,{{"concrete",50000},{"hazard-concrete",10000},{"landfill",10000}}) and 1 or 0); p.print("GHOSTS placed: walls="..walls..", gates="..gates..", lamps="..lamps..", poles="..poles..", substations="..subs..", roboports="..robos..". Supply crates placed="..crates..".")
```

**Note:** This failed in your game because the logistic chest names differed.

---

# 10) “Correct the logistic chest names” + alternatives

## A) Supply crates without any logistic chests (safe fallback)

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local function mk(x,y,items) local e=s.create_entity{name="active-provider-chest",position={o.x+x,o.y+y},force=f,raise_built=true}; if not e then p.print("Couldn't place chest."); return end; local inv=e.get_inventory(defines.inventory.chest); for _,it in ipairs(items) do inv.insert{name=it[1],count=it[2]} end end; mk(1,0,{{"stone-wall",2000},{"gate",400}}); mk(2,0,{{"small-lamp",100},{"substation",600}}); mk(3,0,{{"solar-panel",2000},{"accumulator",200}}); mk(4,0,{{"concrete",5000},{"hazard-concrete",1000},{"landfill",100}}); p.print("Supply crates spawned (robots/walls/lamps/solar/concrete).")
```

## B) “Discover provider chest names” (you ran this and found yours)

```lua
/c for name,_ in pairs(prototypes.item) do if string.find(name,"provider") then game.player.print(name) end end
```

## C) “Discover storage chest names”

```lua
/c for name,_ in pairs(prototypes.item) do if string.find(name,"storage") then game.player.print(name) end end
```

## D) Blueprint kit chest with your wall/solar requirements

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local target={p.position.x+2,p.position.y}; local chest=s.create_entity{name="active-provider-chest",position=target,force=f,raise_built=true}; if not chest then p.print("Couldn't place active-provider-chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Not enough space for "..name); end end; add("stone-wall",405); add("solar-panel",156); add("accumulator",66); add("gate",154); add("small-lamp",55); add("big-electric-pole",20); add("substation",200); p.print("Active provider chest filled for the blueprint kit.")

## E) Fill storage chest with nuclear fuel

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="storage-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place logistic storage chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Storage chest full before "..name); return end end; local kit={{"uranium-fuel-cell",2000},{"nuclear-fuel",1000}}; for _,item in ipairs(kit) do add(item[1],item[2]) end; p.print("Filled logistic storage chest with nuclear fuel.")
```
```

---

# 11) Your actual provider chest names (working commands)

You reported:

* `active-provider-chest`
* `passive-provider-chest`

## A) Fill character inventory for 1k solar + chests (using your names)

```lua
/c local p=game.player; local function give(n,c) p.insert{name=n,count=c} end; give("solar-panel",1000); give("accumulator",840); give("substation",60); give("big-electric-pole",40); give("medium-electric-pole",100); give("roboport",10); give("construction-robot",400); give("repair-pack",400); give("small-lamp",80); give("passive-provider-chest",30); give("active-provider-chest",10); p.print("Added 1k-solar kit + provider chests (passive/active).")
```
```lua
/c local p=game.player; local function give(n,c) p.insert{name=n,count=c} end; give("storage-chest",30); give("buffer-chest",10); give("requester-chest",10); 
```

## B) Place roboport + 6 passive provider chests + move materials from your inventory into them

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local rp=s.create_entity{name="roboport",position={o.x+2,o.y+2},force=f,raise_built=true}; if not rp then p.print("Couldn't place roboport here."); return end; local ch={}; for i=0,5 do local e=s.create_entity{name="passive-provider-chest",position={o.x+4+i,o.y+2},force=f,raise_built=true}; if e then ch[#ch+1]=e.get_inventory(defines.inventory.chest) end end; local ci=1; local function put(name,count) local left=count; local removed=p.remove_item{name=name,count=count}; left=removed; while left>0 and ci<=#ch do local ins=ch[ci].insert{name=name,count=left}; left=left-ins; if ins==0 then ci=ci+1 end end; if left>0 then p.insert{name=name,count=left}; p.print("Not enough chest space for "..name..", returned "..left) end end; put("solar-panel",1000); put("accumulator",840); put("substation",60); put("big-electric-pole",40); put("medium-electric-pole",100); put("small-lamp",80); put("repair-pack",400); local rbot=rp.get_inventory(defines.inventory.roboport_robot); if rbot then local b=p.remove_item{name="construction-robot",count=400}; rbot.insert{name="construction-robot",count=b} end; p.print("Placed roboport + provider chests, moved materials + bots. Make sure roboport has power.")
```

## C) Passive provider chest loaded with nuclear components

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="passive-provider-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place passive-provider-chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Chest full before "..name); return false end; return true end; local kit={{"heat-exchanger",32},{"steam-turbine",21},{"heat-pipe",13},{"pump",5},{"pipe",4},{"pipe-to-ground",3},{"nuclear-reactor",2},{"centrifuge",2},{"uranium-fuel-cell",2},{"processing-unit",1}}; for _,item in ipairs(kit) do if not add(item[1],item[2]) then break end end; p.print("Passive provider chest loaded with the components from the screenshot.")
```

## D) Place 1k solar farm ghosts (40×25 solar, 42×20 accumulators, with substations)

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local cx,cy=math.floor(p.position.x),math.floor(p.position.y); local function g(name,x,y) s.create_entity{name="entity-ghost",inner_name=name,position={x,y},force=f} end; local SOL_W,SOL_H=40,25; local SOL_STEP=3; local startx,starty=cx+10,cy-40; local count=0; for ix=0,SOL_W-1 do for iy=0,SOL_H-1 do g("solar-panel",startx+ix*SOL_STEP,starty+iy*SOL_STEP); count=count+1 end end; local ACC_W,ACC_H=42,20; local ACC_STEP=2; local accx,accy=startx+SOL_W*SOL_STEP+12,starty; local accc=0; for ix=0,ACC_W-1 do for iy=0,ACC_H-1 do g("accumulator",accx+ix*ACC_STEP,accy+iy*ACC_STEP); accc=accc+1 end end; local SUB_STEP=18; local subc=0; for x=startx+6,startx+SOL_W*SOL_STEP-6,SUB_STEP do for y=starty+6,starty+SOL_H*SOL_STEP-6,SUB_STEP do g("substation",x,y); subc=subc+1 end end; for x=accx+6,accx+ACC_W*ACC_STEP-6,SUB_STEP do for y=accy+6,accy+ACC_H*ACC_STEP-6,SUB_STEP do g("substation",x,y); subc=subc+1 end end; p.print("Ghosts placed: solar="..count..", accumulators="..accc..", substations="..subc..".")
```

---

# 12) Debugging “missing materials” and “logistic storage full”

## A) Print which items are required by nearby ghosts (within radius)

```lua
/c local p=game.player; local s=p.surface; local ghosts=s.find_entities_filtered{position=p.position, radius=300, name="entity-ghost"}; local need={}; for _,g in pairs(ghosts) do local proto=g.ghost_prototype; if proto and proto.items_to_place_this then for name,count in pairs(proto.items_to_place_this) do need[name]=(need[name] or 0)+count end end end; p.print("Ghosts in radius: "..#ghosts); for name,count in pairs(need) do p.print(name..": "..count) end
```

**Use:** Find exactly what’s missing.

## B) Place extra passive-provider chests and over-supply common missing items

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local function mk(dx,dy) local e=s.create_entity{name="passive-provider-chest",position={o.x+dx,o.y+dy},force=f,raise_built=true}; if not e then e=s.create_entity{name="steel-chest",position={o.x+dx,o.y+dy},force=f,raise_built=true} end; return e.get_inventory(defines.inventory.chest) end; local inv1=mk(2,0); local inv2=mk(3,0); local inv3=mk(4,0); local inv4=mk(5,0); local function put(inv,name,count) if inv then inv.insert{name=name,count=count} end end; put(inv1,"solar-panel",2000); put(inv1,"accumulator",2000); put(inv2,"substation",200); put(inv2,"big-electric-pole",200); put(inv2,"medium-electric-pole",400); put(inv3,"small-lamp",400); put(inv3,"repair-pack",1000); put(inv4,"roboport",30); put(inv4,"construction-robot",1000); p.print("Extra supply chests placed + loaded (solar/accu/substations/poles/lamps/repairs/roboports/bots).")
```

## C) If you get “not enough logistic network storage space available”

### (1) Find storage chest item name(s)

```lua
/c for name,_ in pairs(prototypes.item) do if string.find(name,"storage") then game.player.print(name) end end
```

### (2) Place 100 storage chests (replace name)

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local STORAGE_NAME="REPLACE_ME"; local placed=0; for i=0,99 do local x=o.x+2+(i%10); local y=o.y+6+math.floor(i/10); if s.can_place_entity{name=STORAGE_NAME,position={x,y},force=f} then s.create_entity{name=STORAGE_NAME,position={x,y},force=f,raise_built=true}; placed=placed+1 end end; p.print("Placed storage chests: "..placed)
```

### (3) “Blunt fix”: delete active providers near you (only if you want them gone)

```lua
/c local p=game.player; local s=p.surface; local n=0; for _,e in pairs(s.find_entities_filtered{position=p.position, radius=200, name="active-provider-chest"}) do e.destroy(); n=n+1 end; p.print("Destroyed active-provider-chests near you: "..n)
```

---

# 13) “Minimal Step-3 build kit in a new tank trunk”

```lua
``/c local p=game.player; local s=p.surface; local f=p.force; local pos=s.find_non_colliding_position("tank",{p.position.x+3,p.position.y},10,0.5) or {p.position.x+3,p.position.y}; local t=s.create_entity{name="tank",position=pos,force=f,raise_built=true}; if not t then p.print("Couldn't place tank here."); return end; local trunk=t.get_inventory(defines.inventory.car_trunk); local fuel=t.get_inventory(defines.inventory.fuel); if fuel then fuel.insert{name="rocket-fuel",count=200} end; local function put(name,count) if trunk and trunk.can_insert{name=name,count=1} then trunk.insert{name=name,count=count} else p.print("No space / can't insert: "..name) end end; put("roboport",20); put("construction-robot",600);put("repair-pack",500); put("substation",80); put("big-electric-pole",80); put("medium-electric-pole",150); put("solar-panel",600); put("accumulator",400); put("concrete",500); put("stone-wall",200); put("gate",40); put("small-lamp",200); p.print("New tank spawned with a minimal Step-3 build kit in trunk.")``
```

**Note:** This one uses the **old chest names** and will need swapping to your names:

* Replace `logistic-chest-passive-provider` → `passive-provider-chest`
* Replace `logistic-chest-storage` → whatever your storage chest item is (use the storage discovery command).

---

## If you want, I can also give you one “clean master pack”

A single set of commands that is **fully consistent with your modded chest names** (`passive-provider-chest`, `active-provider-chest`, and your actual storage chest name) and builds the **1k solar** farm end-to-end without triggering “storage space” errors.


```lua
/c local p=game.player; local s=p.surface; local f=p.force; local o=p.position; local e=s.create_entity{name="passive-provider-chest",position={o.x+2,o.y},force=f,raise_built=true}; if not e then p.print("Couldn't place chest here."); return end; local inv=e.get_inventory(defines.inventory.chest); inv.insert{name="stone-wall",count=600}; inv.insert{name="gate",count=800}; inv.insert{name="repair-pack",count=500}; inv.insert{name="substation",count=100}; inv.insert{"small-lamp",count=50}; inv.insert{name="big-electric-pole", count=100}; p.print("Iron mining & smelting supply chest placed.")
```


```lua
/c local p=game.player; p.insert{name="logistic-robot",count=2000}
```

```lua
`/c for name,_ in pairs(prototypes.item) do if string.find(name,"transport-belt") then game.player.print(name) end end`
`/c game.player.insert({name="active-provider-chest",count=100})`
/c game.player.insert({name="requester-chest",count=100})

```


```lua
/c local p=game.player; local v=p.vehicle; if not (v and v.valid) then p.print("Get into a vehicle first."); return end; local trunk=v.get_inventory(defines.inventory.car_trunk); if not trunk then p.print("This vehicle has no trunk inventory."); return end; local function put(name,count) if trunk.can_insert{name=name,count=1} then trunk.insert{name=name,count=count} else p.print("Trunk full; stopped while inserting "..name); return false end; return true end; local kit={ {name="gate",count=50}, {name="substation",count=50}, {name="small-lamp",count=60}, {name="automation-science-pack",count=200}, {name="logistic-science-pack",count=200}, {name="chemical-science-pack",count=200}, {name="production-science-pack",count=200}, {name="utility-science-pack",count=100} }; for _,item in ipairs(kit) do if not put(item.name,item.count) then break end end; p.print("Trunk loaded with nuclear-power build kit.")
```

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="passive-provider-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place logistic storage chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Storage chest full before "..name); return end end; local kit={{"logistic-robot",1000},{"roboport",300}}; for _,item in ipairs(kit) do add(item[1],item[2]) end;s
```

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="passive-provider-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place passive-provider-chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Chest full before "..name); return false end; return true end; local kit={{"express-transport-belt",800},{"bulk-inserter",400},{"electric-furnace",400},{"electric-mining-drill",400},{"passive-provider-chest",400},{"requester-chest",400},{"storage-chest",400}}; for _,item in ipairs(kit) do if not add(item[1],item[2]) then break end end; p.print("Passive provider chest loaded with the components from the screenshot.")
```

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="passive-provider-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place passive-provider-chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Chest full before "..name); return false end; return true end; local kit={{"express-underground-belt",800},{"stack-inserter",400},{"steel-furnace",400},{"repair-pack",400},{"solar-panel",400},{"accumulator",400},{"substation", 400}}; for _,item in ipairs(kit) do if not add(item[1],item[2]) then break end end; 
```

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="passive-provider-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place passive-provider-chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Chest full before "..name); return false end; return true end; local kit={{"substation", 400},{"big-electric-pole",400},{"pipe",600},{"pipe-to-ground",400},{"pump",400}}; for _,item in ipairs(kit) do if not add(item[1],item[2]) then break end end; 
```
```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="passive-provider-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place passive-provider-chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Chest full before "..name); return false end; return true end; local kit={{"offshore-pump",400}}; for _,item in ipairs(kit) do if not add(item[1],item[2]) then break end end; 
```
```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="passive-provider-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place passive-provider-chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) if inv and inv.can_insert{name=name,count=1} then inv.insert{name=name,count=count} else p.print("Chest full before "..name); return false end; return true end; local kit={{"electric-furnace",1000},{"electric-mining-drill",800},{"assembling-machine-3",800},{"requester-chest",400}}; for _,item in ipairs(kit) do if not add(item[1],item[2]) then break end end; p.print("Passive provider chest loaded with the components from the screenshot.")
```

## 13) Legendary transport platform chest kit (from `space_trasporter_blueprint_legendary.txt`)

```lua
/c local p=game.player; local s=p.surface; local f=p.force; local chest=s.create_entity{name="passive-provider-chest",position={p.position.x+2,p.position.y},force=f,raise_built=true}; if not chest then p.print("Couldn't place passive-provider-chest nearby."); return end; local inv=chest.get_inventory(defines.inventory.chest); local function add(name,count) local inserted=inv.insert{name=name,count=count,quality="legendary"}; if inserted<count then p.print("Chest space ran out at "..name.." (inserted "..inserted.."/"..count..")"); return false end; return true end; local kit={{"space-platform-foundation",964},{"fast-transport-belt",150},{"bulk-inserter",42},{"stone-wall",24},{"pipe",24},{"solar-panel",20},{"efficiency-module",18},{"pipe-to-ground",17},{"fast-underground-belt",16},{"accumulator",16},{"gun-turret",13},{"display-panel",11},{"small-lamp",11},{"asteroid-collector",8},{"long-handed-inserter",5},{"speed-module",4},{"chemical-plant",4},{"storage-tank",4},{"thruster",3},{"crusher",3},{"constant-combinator",2},{"decider-combinator",2},{"cargo-bay",2},{"electric-furnace",1},{"assembling-machine-2",1},{"medium-electric-pole",1},{"space-platform-hub",1}}; for _,item in ipairs(kit) do if not add(item[1],item[2]) then break end end; p.print("Passive provider chest loaded with legendary transport-platform items.")
```

---

# 14) Large build kit into multiple passive-provider chests

## A) Massive build kit (auto-spawns multiple chests as needed)

```lua
/c local p=game.player;local s=p.surface;local f=p.force;local base=p.position;local ccount=0;local missing={};local function newc(hint)local pos=s.find_non_colliding_position("passive-provider-chest",hint,128,1);if not pos then return nil end;ccount=ccount+1;return s.create_entity{name="passive-provider-chest",position=pos,force=f} end;local c=newc({x=base.x+2,y=base.y});if not c then p.print("No space for passive-provider chest.");return end;local items={{"express-transport-belt",2378},{"stone-wall",1279},{"concrete",678},{"express-underground-belt",624},{"fast-inserter",596},{"land-mine",525},{"bulk-inserter",377},{"solar-panel",372},{"laser-turret",321},{"accumulator",214},{"pipe",174},{"pipe-to-ground",173},{"long-handed-inserter",147},{"biochamber",139},{"medium-electric-pole",126},{"express-splitter",108},{"requester-chest",102},{"substation",96},{"assembling-machine-3",90},{"beacon",90},{"storage-chest",82},{"rocket-turret",81},{"inserter",79},{"fast-transport-belt",74},{"stack-inserter",50},{"fast-underground-belt",43},{"roboport",41},{"steam-turbine",39},{"buffer-chest",39},{"steel-chest",38},{"electric-furnace",37},{"constant-combinator",37},{"decider-combinator",36},{"teslaee-turret",31},{"artillery-turret",27},{"burner-inserter",25},{"heat-exchanger",24},{"cargo-bay",22},{"heating-tower",22},{"heat-pipe",16},{"gate",16},{"display-panel",16},{"gun-turret",15},{"programmable-speaker",11},{"small-lamp",10},{"arithmetic-combinator",7},{"active-provider-chest",7},{"fast-loader",6},{"chemical-plant",5},{"passive-provider-chest",5},{"rocket-silo",4},{"infinity-chest",3},{"storage-tank",3},{"fast-splitter",2},{"cargo-landing-pad",1},{"centrifuge",1},{"express-loader",1},{"infinity-pipe",1},{"productivity-module-2",531},{"speed-module-2",410},{"efficiency-module-2",166}};for _,it in ipairs(items) do if game.item_prototypes[it[1]] then local left=it[2];while left>0 do local n=c.insert{name=it[1],count=left};left=left-n;if left>0 then c=newc({x=c.position.x+2,y=c.position.y});if not c then p.print("Out of space while inserting "..it[1]..", "..left.." left.");return end end end else missing[#missing+1]=it[1] end end;p.print("Spawned "..ccount.." passive-provider chest(s) and inserted requested items.");if #missing>0 then p.print("Missing item prototypes: "..table.concat(missing,", ")) end
```

**Use:** Creates as many passive-provider chests as needed to hold all items. Includes belts, inserters, power, defense, modules, and much more.

## B) Massive build kit with pcall error handling (safer version)

```lua
/c local p=game.player;local s=p.surface;local f=p.force;local base=p.position;local ccount=0;local missing={};local missset={};local function add_missing(n) if not missset[n] then missset[n]=true;missing[#missing+1]=n end end;local function newc(hint)local pos=s.find_non_colliding_position("passive-provider-chest",hint,128,1);if not pos then return nil end;ccount=ccount+1;return s.create_entity{name="passive-provider-chest",position=pos,force=f} end;local c=newc({x=base.x+2,y=base.y});if not c then p.print("No space for passive-provider chest.");return end;local items={{"express-transport-belt",2378},{"stone-wall",1279},{"concrete",678},{"express-underground-belt",624},{"fast-inserter",596},{"land-mine",525},{"bulk-inserter",377},{"solar-panel",372},{"laser-turret",321},{"accumulator",214},{"pipe",174},{"pipe-to-ground",173},{"long-handed-inserter",147},{"biochamber",139},{"medium-electric-pole",126},{"express-splitter",108},{"requester-chest",102},{"substation",96},{"assembling-machine-3",90},{"beacon",90},{"storage-chest",82},{"rocket-turret",81},{"inserter",79},{"fast-transport-belt",74},{"stack-inserter",50},{"fast-underground-belt",43},{"roboport",41},{"steam-turbine",39},{"buffer-chest",39},{"steel-chest",38},{"electric-furnace",37},{"constant-combinator",37},{"decider-combinator",36},{"tesla-turret",31},{"artillery-turret",27},{"burner-inserter",25},{"heat-exchanger",24},{"cargo-bay",22},{"heating-tower",22},{"heat-pipe",16},{"gate",16},{"display-panel",16},{"gun-turret",15},{"programmable-speaker",11},{"small-lamp",10},{"arithmetic-combinator",7},{"active-provider-chest",7},{"fast-loader",6},{"chemical-plant",5},{"passive-provider-chest",5},{"rocket-silo",4},{"infinity-chest",3},{"storage-tank",3},{"fast-splitter",2},{"cargo-landing-pad",1},{"centrifuge",1},{"express-loader",1},{"infinity-pipe",1},{"productivity-module-2",531},{"speed-module-2",410},{"efficiency-module-2",166}};for _,it in ipairs(items) do local name,count=it[1],it[2];local left=count;while left>0 do local ok,n=pcall(function() return c.insert{name=name,count=left} end);if not ok then add_missing(name);break end;left=left-n;if left>0 then c=newc({x=c.position.x+2,y=c.position.y});if not c then p.print("Out of space while inserting "..name..", "..left.." left.");return end end end end;p.print("Spawned "..ccount.." passive-provider chest(s) and inserted requested items.");if #missing>0 then p.print("Skipped invalid/missing items: "..table.concat(missing,", ")) end
```

```
6073	land-mine
5525	turbo-transport-belt
1692	stone-wall
1200	turbo-underground-belt
790	bulk-inserter
789	pipe
750	stack-inserter
728	fast-inserter
610	pipe-to-ground
336	medium-electric-pole
308	beacon
271	laser-turret
265	biochamber
202	long-handed-inserter
176	substation
168	requester-chest
160	tesla-turret
156	turbo-splitter
	155	rocket-turret
	129	steel-chest
	126	storage-chest
	111	assembling-machine-3
93	refined-hazard-concrete-left
	90	express-transport-belt
	90	express-underground-belt
	86	roboport
	80	foundry
	73	inserter
	63	fast-underground-belt
	58	fusion-generator
	56	gun-aturret
	56	buffer-chest
	55	decider-combinator
	53	fast-transport-belt
52	small-lamp
	37	electromagnetic-plant
	33	solar-panel
	32	gate
29	heat-pipe
28	accumulator
27	artillery-turret
	26	heating-tower
	23	passive-provider-chest
	21	constant-combinator
	20	display-panel
	18	cargo-bay
	12	storage-tank
	11	chemical-plant
	10	rocket-silo
	9	programmable-speaker
	9	turbo-loader
	8	infinity-chest
	7	fusion-reactor
	7	arithmetic-combinator
	6	electric-furnace
	5	recycler
	4	steam-turbine
	4	infinity-pipe
	3	active-provider-chest
	3	express-splitter
adar	3	radar
2	electric-energy-interface
	2	cryogenic-plant
	2	heat-exchanger
	1	cargo-landing-pad
	1	power-switch
	1581	productivity-module-3
745	speed-module-3`
100	efficiency-module-3
98	efficiency-module-2
26	quality-module-3

**Use:** Same as above but uses `pcall` for better error handling. Won't crash if an item doesn't exist - just skips it and continues.

## C) Raw materials & intermediates for production (passive-storage-chest)

```lua
/c local p=game.player;local s=p.surface;local f=p.force;local base=p.position;local ccount=0;local function newc(hint)local pos=s.find_non_colliding_position("passive-provider-chest",hint,128,1);if not pos then return nil end;ccount=ccount+1;return s.create_entity{name="passive-provider-chest",position=pos,force=f} end;local c=newc({x=base.x+2,y=base.y});if not c then p.print("No space for passive-storage chest.");return end;local items={{"iron-plate",50000},{"copper-plate",50000},{"steel-plate",30000},{"stone",20000},{"stone-brick",10000},{"plastic-bar",20000},{"sulfur",5000},{"battery",10000},{"electronic-circuit",30000},{"advanced-circuit",20000},{"processing-unit",10000},{"low-density-structure",5000},{"solid-fuel",10000},{"rocket-fuel",5000},{"uranium-fuel-cell",500},{"nuclear-fuel",1000},{"lubricant-barrel",1000},{"holmium-plate",5000},{"superconductor",2000},{"supercapacitor",2000},{"quantum-processor",1000},{"uranium-235",500},{"uranium-238",5000},{"tungsten-plate",5000},{"tungsten-carbide",3000},{"carbon-fiber",3000},{"lithium-plate",3000},{"calcite",5000},{"refined-concrete",10000},{"ice",5000},{"crude-oil-barrel",1000},{"heavy-oil-barrel",1000},{"light-oil-barrel",1000},{"petroleum-gas-barrel",1000},{"water-barrel",1000},{"sulfuric-acid-barrel",1000},{"fluoroketone-cold-barrel",1000},{"electrolyte-barrel",1000},{"molten-iron-barrel",1000},{"molten-copper-barrel",1000}};for _,it in ipairs(items) do local name,count=it[1],it[2];local left=count;while left>0 do local ok,n=pcall(function() return c.insert{name=name,count=left} end);if not ok then break end;left=left-n;if left>0 then c=newc({x=c.position.x+2,y=c.position.y});if not c then p.print("Out of space while inserting "..name..", "..left.." left.");return end end end end
```

**Use:** Spawns passive-provider-chest(s) with essential raw materials, plates, circuits, fluids (barreled), and Space Age intermediates needed to manufacture the items in the build kit above.

## D) Nuclear power operation tank (fully loaded)

```lua
/c local p=game.player;local s=p.surface;local f=p.force;local pos=s.find_non_colliding_position("tank",{p.position.x+3,p.position.y},10,0.5)or{p.position.x+3,p.position.y};local t=s.create_entity{name="tank",position=pos,force=f,raise_built=true};if not t then p.print("Couldn't place tank here.");return end;local trunk=t.get_inventory(defines.inventory.car_trunk);local fuel=t.get_inventory(defines.inventory.fuel);local ammo=t.get_inventory(defines.inventory.car_ammo);local function put(inv,name,count)if inv and inv.can_insert{name=name,count=1}then inv.insert{name=name,count=count}end end;put(fuel,"rocket-fuel",500);put(ammo,"uranium-rounds-magazine",2000);put(ammo,"explosive-uranium-cannon-shell",500);put(ammo,"explosive-cannon-shell",500);local items={{"uranium-fuel-cell",5000},{"nuclear-fuel",3000},{"heat-exchanger",200},{"steam-turbine",150},{"heat-pipe",100},{"nuclear-reactor",20},{"pump",50},{"pipe",1000},{"pipe-to-ground",500},{"storage-tank",100},{"accumulator",500},{"substation",200},{"big-electric-pole",300},{"medium-electric-pole",400},{"electric-furnace",50},{"assembling-machine-3",50},{"roboport",30},{"construction-robot",500},{"logistic-robot",500},{"repair-pack",1000},{"processing-unit",500},{"advanced-circuit",1000},{"electronic-circuit",2000},{"copper-cable",5000},{"iron-plate",10000},{"copper-plate",5000},{"steel-plate",5000},{"uranium-ore",1000},{"uranium-235",500},{"uranium-238",2000}};local current_inv=nil;local inv_idx=0;local function get_chest()if not current_inv or not current_inv.valid then inv_idx=inv_idx+1;local chest_pos=s.find_non_colliding_position("passive-provider-chest",{pos.x+2+inv_idx*2,pos.y},5,0.5);if not chest_pos then p.print("No space for more chests at index "..inv_idx);return nil end;local chest=s.create_entity{name="passive-provider-chest",position=chest_pos,force=f};if not chest then return nil end;current_inv=chest.get_inventory(defines.inventory.chest)end;return current_inv end;put(trunk,"nuclear-fuel",1000);put(trunk,"uranium-fuel-cell",2000);put(trunk,"heat-exchanger",100);put(trunk,"steam-turbine",75);put(trunk,"nuclear-reactor",10);put(trunk,"repair-pack",500);for _,it in ipairs(items)do local name,count=it[1],it[2];local left=count;while left>0 do local inv=get_chest();if not inv then p.print("Couldn't place more chests for "..name);break end;local inserted=inv.insert{name=name,count=left};left=left-inserted;if left>0 then current_inv=nil end end end;p.print("Nuclear power tank spawned with full trunk + nuclear materials in adjacent passive-provider chest(s). Tank is ready to run a massive nuclear operation!")
```

**Use:** Spawns a fully loaded tank with fuel, ammunition, and creates passive-provider chests with all nuclear power infrastructure and materials (reactors, turbines, heat exchangers, fuel cells, pipes, power grid, robots, and raw materials).

## E) Blueprint scanner and material supplier (one-liner)

```lua
/c local p=game.player;local s=p.cursor_stack;if not(s and s.valid_for_read and(s.is_blueprint or s.is_blueprint_book))then p.print("Hold the blueprint or blueprint book in cursor first.");return end;local need={};local function add(n,c)if n and c and c>0 then need[n]=(need[n]or 0)+c end end;local function add_ent(n,m)local pr=(prototypes and prototypes.entity and prototypes.entity[n])or(game.entity_prototypes and game.entity_prototypes[n])if pr and pr.items_to_place_this then for it,c in pairs(pr.items_to_place_this)do local iname,cnt=nil,1;if type(it)=="string"then iname=it;cnt=c or 1 elseif type(c)=="table"then iname=c.name or(c.id and(type(c.id)=="string"and c.id or c.id.name));cnt=c.count or c.value or 1 end;if iname then add(iname,cnt*m)end end end end;local function add_tile(n,m)local pr=(prototypes and prototypes.tile and prototypes.tile[n])or(game.tile_prototypes and game.tile_prototypes[n])if pr and pr.items_to_place_this then for it,c in pairs(pr.items_to_place_this)do local iname,cnt=nil,1;if type(it)=="string"then iname=it;cnt=c or 1 elseif type(c)=="table"then iname=c.name or(c.id and(type(c.id)=="string"and c.id or c.id.name));cnt=c.count or c.value or 1 end;if iname then add(iname,cnt*m)end end end end;local function scan(bp,m)local ents=bp.get_blueprint_entities()or{}for _,e in pairs(ents)do add_ent(e.name,m)if e.items then for k,v in pairs(e.items)do if type(k)=="string"then add(k,v*m)elseif type(v)=="table"then add(v.name or(v.id and(type(v.id)=="string"and v.id or v.id.name)),(v.count or v.value or 1)*m)end end end end;local tiles=bp.get_blueprint_tiles()or{}for _,t in pairs(tiles)do add_tile(t.name,m)end end;local function walk(st,m)if st.is_blueprint then scan(st,m)elseif st.is_blueprint_book then local inv=st.get_inventory(defines.inventory.item_main)for i=1,#inv do local it=inv[i]if it.valid_for_read then walk(it,m)end end end end;walk(s,1);local rows={}for n,c in pairs(need)do rows[#rows+1]={n=n,c=math.ceil(c)}end;table.sort(rows,function(a,b)return a.n<b.n end);p.print("Blueprint components: "..#rows.." item types");for _,r in ipairs(rows)do p.print(r.n..": "..r.c)end;local surf=p.surface;local pos={x=math.floor(p.position.x)+2,y=math.floor(p.position.y)};local chest=surf.create_entity{name="passive-provider-chest",position=pos,force=p.force};for _,r in ipairs(rows)do local left=r.c;while left>0 do local ins=chest.insert{name=r.n,count=left};if ins<=0 then pos.x=pos.x+1;chest=surf.create_entity{name="passive-provider-chest",position=pos,force=p.force}else left=left-ins end end end;p.print("Created passive-provider chest line with all required build materials.")
```

**Use:** Hold a blueprint or blueprint book in cursor, run command. Scans ALL blueprints recursively, calculates exact materials needed to place the entire blueprint, prints the list, then creates a line of passive-provider chests filled with all required items. Perfect for any sized blueprint.

