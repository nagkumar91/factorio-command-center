local PREFIX = "[Starter Initializer] "

local function ensure_global()
  storage.granted_players = storage.granted_players or {}
  storage.cache = storage.cache or {}
end

local function get_setting(name)
  local setting = settings.global[name]
  return setting and setting.value
end

local function get_recipe_prototypes()
  return prototypes.recipe
end

local function get_item_prototypes()
  return prototypes.item
end

local function get_fluid_prototypes()
  return prototypes.fluid
end

local function get_entity_prototypes()
  return prototypes.entity
end

local function trim(text)
  return (text:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function parse_custom_entries()
  local parsed_items = {}
  local parsed_fluids = {}
  local item_prototypes = get_item_prototypes()
  local fluid_prototypes = get_fluid_prototypes()
  local raw = get_setting("starter-init-custom-items") or ""
  local default_count = get_setting("starter-init-custom-default-count") or 1

  for token in string.gmatch(raw, "([^,;]+)") do
    local entry = trim(token)
    if entry ~= "" then
      local name, explicit_count = entry:match("^([^=:%s]+)%s*[:=]?%s*(%d*)$")
      if name and (item_prototypes[name] or fluid_prototypes[name]) then
        local count = tonumber(explicit_count)
        if not count then
          count = default_count
        end

        if count > 0 then
          if item_prototypes[name] then
            parsed_items[name] = count
          else
            parsed_fluids[name] = count
          end
        end
      end
    end
  end

  return parsed_items, parsed_fluids
end

local function get_all_producible_items()
  local recipe_prototypes = get_recipe_prototypes()
  local item_prototypes = get_item_prototypes()
  local entity_prototypes = get_entity_prototypes()
  local include_hidden = get_setting("starter-init-include-hidden-recipes")
  local cache_key = include_hidden and "all_items_hidden" or "all_items_visible"
  if storage.cache[cache_key] then
    return storage.cache[cache_key]
  end

  local item_set = {}

  -- Crafting-like outputs (assembling, smelting, chemistry, etc.).
  for _, recipe in pairs(recipe_prototypes) do
    if include_hidden or not recipe.hidden then
      for _, product in pairs(recipe.products) do
        if product.type == "item" and item_prototypes[product.name] then
          item_set[product.name] = true
        end
      end
    end
  end

  -- Mining outputs (ores and other minable drops that may not be recipe outputs).
  for _, entity in pairs(entity_prototypes) do
    local mineable = entity.mineable_properties
    if mineable and mineable.products then
      for _, product in pairs(mineable.products) do
        if product.type == "item" and item_prototypes[product.name] then
          item_set[product.name] = true
        end
      end
    end
  end

  local list = {}
  for name in pairs(item_set) do
    list[#list + 1] = name
  end

  table.sort(list)
  storage.cache[cache_key] = list
  return list
end

local function get_all_producible_fluids()
  local recipe_prototypes = get_recipe_prototypes()
  local fluid_prototypes = get_fluid_prototypes()
  local entity_prototypes = get_entity_prototypes()
  local include_hidden = get_setting("starter-init-include-hidden-recipes")
  local cache_key = include_hidden and "all_fluids_hidden" or "all_fluids_visible"
  if storage.cache[cache_key] then
    return storage.cache[cache_key]
  end

  local fluid_set = {}

  -- Crafting/processing outputs that are fluids.
  for _, recipe in pairs(recipe_prototypes) do
    if include_hidden or not recipe.hidden then
      for _, product in pairs(recipe.products) do
        if product.type == "fluid" and fluid_prototypes[product.name] then
          fluid_set[product.name] = true
        end
      end
    end
  end

  -- Mining outputs that are fluids (e.g. crude oil).
  for _, entity in pairs(entity_prototypes) do
    local mineable = entity.mineable_properties
    if mineable and mineable.products then
      for _, product in pairs(mineable.products) do
        if product.type == "fluid" and fluid_prototypes[product.name] then
          fluid_set[product.name] = true
        end
      end
    end
  end

  -- Include fluid prototypes so pumpable/ambient fluids are covered too.
  for name, fluid in pairs(fluid_prototypes) do
    if include_hidden or not fluid.hidden then
      fluid_set[name] = true
    end
  end

  local list = {}
  for name in pairs(fluid_set) do
    list[#list + 1] = name
  end

  table.sort(list)
  storage.cache[cache_key] = list
  return list
end

local function build_grant_map()
  local grant_items = {}
  local grant_fluids = {}
  local mode = get_setting("starter-init-mode") or "all-producible"

  if mode == "all-producible" or mode == "all-and-custom" then
    local all_item_count = get_setting("starter-init-all-item-count") or 1
    local all_fluid_amount = get_setting("starter-init-all-fluid-amount") or 1
    for _, name in ipairs(get_all_producible_items()) do
      grant_items[name] = all_item_count
    end
    for _, name in ipairs(get_all_producible_fluids()) do
      grant_fluids[name] = all_fluid_amount
    end
  end

  if mode == "custom-only" or mode == "all-and-custom" then
    local custom_items, custom_fluids = parse_custom_entries()
    for name, count in pairs(custom_items) do
      grant_items[name] = count
    end
    for name, amount in pairs(custom_fluids) do
      grant_fluids[name] = amount
    end
  end

  return grant_items, grant_fluids
end

local function create_storage_tank(surface, origin, force, attempt_index)
  local radius = math.max(20, 16 + attempt_index * 2)
  local position = surface.find_non_colliding_position("storage-tank", origin, radius, 0.5)
  if not position then
    position = surface.find_non_colliding_position("storage-tank", origin, radius * 2, 1)
  end
  if not position then
    return nil
  end

  return surface.create_entity({
    name = "storage-tank",
    position = position,
    force = force,
    create_build_effect_smoke = false
  })
end

local function create_steel_chest(surface, origin, force, attempt_index)
  if not get_entity_prototypes()["steel-chest"] then
    return nil
  end

  local radius = math.max(12, 8 + attempt_index * 2)
  local position = surface.find_non_colliding_position("steel-chest", origin, radius, 0.5)
  if not position then
    position = surface.find_non_colliding_position("steel-chest", origin, radius * 2, 1)
  end
  if not position then
    return nil
  end

  return surface.create_entity({
    name = "steel-chest",
    position = position,
    force = force,
    create_build_effect_smoke = false
  })
end

local function insert_item_into_steel_chests(surface, origin, force, item_chests, item_name, count, created_chest_count)
  local remaining = count
  local inserted_total = 0
  local placement_failures = 0

  for _, chest in pairs(item_chests) do
    if remaining <= 0 then
      break
    end

    if chest and chest.valid then
      local inserted = chest.insert({ name = item_name, count = remaining })
      if inserted and inserted > 0 then
        remaining = remaining - inserted
        inserted_total = inserted_total + inserted
      end
    end
  end

  local attempts = 0
  while remaining > 0 and attempts < 400 do
    attempts = attempts + 1
    local chest = create_steel_chest(surface, origin, force, created_chest_count + attempts)
    if not (chest and chest.valid) then
      placement_failures = placement_failures + 1
      break
    end

    item_chests[#item_chests + 1] = chest
    created_chest_count = created_chest_count + 1

    local inserted = chest.insert({ name = item_name, count = remaining })
    if inserted and inserted > 0 then
      remaining = remaining - inserted
      inserted_total = inserted_total + inserted
    else
      chest.destroy()
      item_chests[#item_chests] = nil
      created_chest_count = created_chest_count - 1
      placement_failures = placement_failures + 1
      break
    end
  end

  return remaining, inserted_total, created_chest_count, placement_failures
end

local function grant_items(player)
  if not (player and player.valid) then
    return
  end

  local grant_item_map, grant_fluid_map = build_grant_map()
  local item_type_count = 0
  local chest_item_total = 0
  local item_chests = {}
  local steel_chest_count = 0
  local steel_chest_failures = 0
  local spilled_total = 0
  local fluid_type_count = 0
  local fluid_inserted_total = 0
  local fluid_tank_count = 0
  local fluid_failures = 0

  for name, count in pairs(grant_item_map) do
    if count > 0 then
      item_type_count = item_type_count + 1
      local remaining = count
      local inserted = 0
      local chest_failures = 0
      remaining, inserted, steel_chest_count, chest_failures = insert_item_into_steel_chests(
        player.surface,
        player.position,
        player.force,
        item_chests,
        name,
        remaining,
        steel_chest_count
      )
      chest_item_total = chest_item_total + inserted
      steel_chest_failures = steel_chest_failures + chest_failures

      if remaining > 0 then
        spilled_total = spilled_total + remaining
        player.surface.spill_item_stack({
          position = player.position,
          stack = { name = name, count = remaining },
          enable_looted = true,
          force = player.force,
          allow_belts = false
        })
      end
    end
  end

  for fluid_name, amount in pairs(grant_fluid_map) do
    if amount > 0 then
      fluid_type_count = fluid_type_count + 1
      local remaining = amount
      local attempts = 0

      while remaining > 0 and attempts < 200 do
        attempts = attempts + 1
        local tank = create_storage_tank(player.surface, player.position, player.force, fluid_tank_count + attempts)
        if not (tank and tank.valid) then
          fluid_failures = fluid_failures + 1
          break
        end

        local prototype = get_fluid_prototypes()[fluid_name]
        local default_temperature = prototype and prototype.default_temperature or nil
        local inserted = tank.insert_fluid({
          name = fluid_name,
          amount = remaining,
          temperature = default_temperature
        })

        if inserted and inserted > 0 then
          remaining = remaining - inserted
          fluid_inserted_total = fluid_inserted_total + inserted
          fluid_tank_count = fluid_tank_count + 1
        else
          tank.destroy()
          fluid_failures = fluid_failures + 1
          break
        end
      end
    end
  end

  player.print(
    PREFIX
      .. "Granted "
      .. item_type_count
      .. " item types ("
      .. chest_item_total
      .. " items placed in "
      .. steel_chest_count
      .. " steel chests"
      .. (steel_chest_failures > 0 and (", " .. steel_chest_failures .. " chest placement failures") or "")
      .. (spilled_total > 0 and (", " .. spilled_total .. " spilled") or "")
      .. "). "
      .. "Fluids: "
      .. fluid_type_count
      .. " types, "
      .. fluid_inserted_total
      .. " total in "
      .. fluid_tank_count
      .. " storage tanks"
      .. (fluid_failures > 0 and (", " .. fluid_failures .. " failed placements") or "")
      .. "."
  )
end

local function maybe_grant_player(player_index, force_grant)
  ensure_global()
  if not force_grant and not get_setting("starter-init-auto-grant-on-join") then
    return
  end

  if storage.granted_players[player_index] and not force_grant then
    return
  end

  local player = game.get_player(player_index)
  if not player then
    return
  end

  grant_items(player)
  storage.granted_players[player_index] = true
end

script.on_init(function()
  -- Older installations can carry an explicitly saved `true` into new maps.
  -- Start each new map in manual-only mode, even with that saved preference.
  settings.global["starter-init-auto-grant-on-join"] = { value = false }
  ensure_global()
  for _, player in pairs(game.players) do
    maybe_grant_player(player.index, false)
  end
end)

script.on_configuration_changed(function()
  ensure_global()
  storage.cache = {}
end)

script.on_event(defines.events.on_runtime_mod_setting_changed, function(event)
  if event.setting and event.setting:find("^starter%-init%-") then
    ensure_global()
    storage.cache = {}
  end
end)

script.on_event(defines.events.on_player_created, function(event)
  maybe_grant_player(event.player_index, false)
end)

commands.add_command("starter_init_grant", "Grant starter entries (items + fluids) using current Starter Initializer settings.", function(command)
  ensure_global()

  if command.parameter and command.parameter ~= "" then
    local target = game.get_player(command.parameter)
    if not target then
      game.print(PREFIX .. "Player '" .. command.parameter .. "' not found.")
      return
    end
    maybe_grant_player(target.index, true)
    return
  end

  if command.player_index then
    maybe_grant_player(command.player_index, true)
    return
  end

  for _, player in pairs(game.players) do
    maybe_grant_player(player.index, true)
  end
  game.print(PREFIX .. "Granted starter entries to all players.")
end)
