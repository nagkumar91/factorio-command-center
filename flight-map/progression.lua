-- Grounded progression for the installed Factorio 2.0.77 / EverythingOnNauvis set.
-- Scenario code, not a mod: no prototype edits or recipe/research blanket unlocks.
-- Wire init(surface, force) AFTER the map's core clearing/resource placement, and
-- forward on_research_finished and on_tick from control.lua. This module does not
-- register events. State survives saves in storage.flight_progression, independently
-- of storage.flight. One designed surface/force is supported; init is idempotent.
-- Costs, all 29 trigger routes, bootstrap arithmetic and exceptions are recorded in
-- progression-audit.json. Market purchases are manual, repeatable scripted exchanges,
-- not native recipes or an automated source with a promised items/second rate.
local M = {}
local CHECK_INTERVAL = 300
local MARKET_POSITION = {240, 100}

-- The ONLY research assignments allowed. Science purchases, robotics, crafting,
-- mining and capturing remain earned. Check both the live trigger and prerequisites.
local SPACE_TRIGGERS = {
  {name = "space-platform", type = "create-space-platform", prerequisite = "rocket-silo"},
  {name = "space-science-pack", type = "build-entity", entity = "asteroid-collector", prerequisite = "space-platform"}
}

local OFFERS = {
  {gate = "tungsten-carbide", item = "tungsten-ore", count = 10,
    price = {{name = "steel-plate", count = 10}}},
  {gate = "calcite-processing", item = "calcite", count = 10,
    price = {{name = "stone", count = 50}}},
  {gate = "biochamber", item = "pentapod-egg", count = 1,
    price = {{name = "steel-plate", count = 20}, {name = "nutrients", count = 20}}},
  {gate = "biter-egg-handling", item = "biter-egg", count = 5,
    price = {{name = "bioflux", count = 20}, {name = "steel-plate", count = 5}}},
  {gate = "space-platform", item = "metallic-asteroid-chunk", count = 1,
    price = {{name = "iron-plate", count = 50}}},
  {gate = "space-platform", item = "carbonic-asteroid-chunk", count = 1,
    price = {{name = "coal", count = 50}}},
  {gate = "space-platform", item = "oxide-asteroid-chunk", count = 1,
    price = {{name = "stone", count = 50}}},
  {gate = "promethium-science-pack", item = "promethium-asteroid-chunk", count = 25,
    price = {{name = "quantum-processor", count = 1}, {name = "tungsten-plate", count = 100}, {name = "superconductor", count = 20}}}
}

-- Initial specimens do not spoil while on the ground. If harvested prematurely,
-- restore a specimen when its prerequisites are earned, until its native trigger
-- completes. Never simulate a mine-entity trigger by inserting an item into a chest.
-- Main must prepare walkable wetland pads for the two stromatolites: they collide
-- with ground_tile grass. The map supplies 3x3 wetland-light-green-slime pads centered
-- at 230,110 and 236,110. Lithium stays on grass. This module never changes tiles.
local SPECIMENS = {
  {name = "iron-stromatolite", technology = "agriculture", position = {230, 110}},
  {name = "copper-stromatolite", technology = "heating-tower", position = {236, 110}},
  {name = "lithium-iceberg-big", technology = "lithium-processing", position = {244, 110}}
}
-- Every installed volcanic rock yields at least 2 tungsten ore and 2 calcite.
-- 80 rocks guarantee 160 ore: the first foundry (50 carbide) plus first big drill
-- (20 carbide) need 140 ore before any productivity, leaving 20 ore in reserve.
local ROCK_POSITIONS = {}
for row = 0, 7 do
  for column = 0, 9 do ROCK_POSITIONS[#ROCK_POSITIONS + 1] = {226 + column * 3, 124 + row * 3} end
end
local CAPTURE_POSITION = {254, 112}

local function researched(force, name)
  local technology = force.technologies[name]
  return technology ~= nil and technology.researched
end

local function prerequisites_ready(technology)
  if not technology or not technology.enabled then return false end
  for _, prerequisite in pairs(technology.prerequisites) do
    if not prerequisite.researched then return false end
  end
  return true
end

local function create_on_clear_pad(surface, name, position, force, state)
  local parameters = {name = name, position = position, force = force}
  if not surface.can_place_entity(parameters) then
    if not state.blocked_pads[name] then
      game.forces[state.force_index].print("Ground progression: clear the " .. name .. " pad at " .. position[1] .. "," .. position[2] .. ".")
    end
    state.blocked_pads[name] = true
    return nil
  end
  -- Do not destroy blockers, change tiles, move players or create outside the pads.
  local entity = surface.create_entity(parameters)
  if entity then state.blocked_pads[name] = nil end
  return entity
end

local function unlock_space_triggers(force, state)
  for _, rule in ipairs(SPACE_TRIGGERS) do
    local technology = force.technologies[rule.name]
    local trigger = technology and technology.prototype.research_trigger
    local entity = trigger and trigger.entity
    if type(entity) == "table" then entity = entity.name end
    if technology and not technology.researched and trigger and trigger.type == rule.type
      and (not rule.entity or entity == rule.entity)
      and researched(force, rule.prerequisite) and prerequisites_ready(technology) then
      technology.researched = true
      state.automatic_unlocks[rule.name] = game.tick
      force.print("Ground progression: " .. rule.name .. " completed after its prerequisites. Paid ground chunk exchanges replace the space-only trigger.")
    end
  end
end

local function update_market(surface, force, state)
  if not state.market or not state.market.valid then
    state.market = create_on_clear_pad(surface, "market", MARKET_POSITION, force, state)
    if not state.market then return end
    state.market.minable_flag = false
    state.market.destructible = false
    state.offer_signature = nil
  end
  local available, signature = {}, {}
  for _, offer in ipairs(OFFERS) do
    if researched(force, offer.gate) then
      available[#available + 1] = offer
      signature[#signature + 1] = offer.item
    end
  end
  signature = table.concat(signature, ",")
  if signature == state.offer_signature then return end
  state.market.clear_market_items()
  for _, offer in ipairs(available) do
    state.market.add_market_item{
      price = offer.price,
      offer = {type = "give-item", item = offer.item, count = offer.count, quality = "normal"}
    }
  end
  -- Native market transactions charge the displayed costs atomically. Eggs exist
  -- only when purchased, so no early stockpile can spoil while awaiting research.
  -- After purchase their ORIGINAL spoil/hatch timers apply; there is no freezing.
  state.offer_signature = signature
end

local function update_specimens(surface, force, state, initial)
  for _, specimen in ipairs(SPECIMENS) do
    local technology = force.technologies[specimen.technology]
    local entity = state.specimens[specimen.name]
    if technology and not technology.researched and (initial or prerequisites_ready(technology))
      and (not entity or not entity.valid) then
      state.specimens[specimen.name] = create_on_clear_pad(surface, specimen.name, specimen.position, "neutral", state)
    end
  end
  -- Captivity is still researched with science, and the player must craft/fire a
  -- capture rocket. Supply a dormant enemy target only once that research is earned.
  -- No startup enemies or free eggs; do not disable the captured spawner that replaces
  -- it. A destroyed target can be retried until the genuine capture trigger completes.
  if researched(force, "captivity") and not researched(force, "biter-egg-handling") then
    if not state.capture_target or not state.capture_target.valid then
      state.capture_target = create_on_clear_pad(surface, "biter-spawner", CAPTURE_POSITION, "enemy", state)
      if state.capture_target then state.capture_target.disabled_by_script = true end
    end
  end
end

local function update(state, initial)
  if state.updating then return end -- Research writes can cause reentrant events.
  local surface = game.surfaces[state.surface_index]
  local force = game.forces[state.force_index]
  if not surface or not surface.valid or not force or not force.valid then return end
  state.updating = true
  unlock_space_triggers(force, state)
  update_market(surface, force, state)
  update_specimens(surface, force, state, initial)
  state.updating = false
end

function M.init(surface, force)
  assert(surface and surface.valid and force and force.valid, "Ground progression needs a valid surface and force")
  local state = storage.flight_progression
  if state then
    assert(state.surface_index == surface.index and state.force_index == force.index,
      "Ground progression already belongs to another surface/force")
    update(state, false)
    return state
  end
  state = {version = 1, surface_index = surface.index, force_index = force.index,
    specimens = {}, rocks = {}, blocked_pads = {}, automatic_unlocks = {}}
  storage.flight_progression = state
  for _, position in ipairs(ROCK_POSITIONS) do
    local rock = create_on_clear_pad(surface, "big-volcanic-rock", position, "neutral", state)
    assert(rock, "Ground progression needs a clear volcanic rock field at 226..253,124..145")
    state.rocks[#state.rocks + 1] = rock
  end
  update(state, true)
  assert(state.market and state.market.valid, "Ground progression market pad must be clear at 240,100")
  for _, specimen in ipairs(SPECIMENS) do
    local technology = assert(force.technologies[specimen.technology], "Missing installed technology " .. specimen.technology)
    if not technology.researched then
      local entity = state.specimens[specimen.name]
      assert(entity and entity.valid, "Ground progression could not place required starter " .. specimen.name)
    end
  end
  force.add_chart_tag(surface, {position = MARKET_POSITION, text = "Ground exchange: paid supplies, research gated; open market for costs", icon = {type = "item", name = "tungsten-ore"}})
  for _, specimen in ipairs(SPECIMENS) do
    force.add_chart_tag(surface, {position = specimen.position, text = "Mine " .. specimen.name .. " for " .. specimen.technology .. "; keep pad clear for retries"})
  end
  force.add_chart_tag(surface, {position = CAPTURE_POSITION, text = "Captivity field station: dormant capture target after earned research"})
  force.add_chart_tag(surface, {position = {240, 136}, text = "80 volcanic rocks: at least 160 tungsten ore and 160 calcite; enough for first foundry and big drill", icon = {type = "item", name = "tungsten-ore"}})
  force.print("Ground progression exchange at 240,100. Research unlocks paid supplies; open the market to see costs. Volcanic rocks provide starter tungsten/calcite. Mine the marked specimens after their prerequisites; keep pads clear. Eggs are fresh on purchase, then spoil normally. Space victory still requires a spaceship.")
  return state
end

function M.on_research_finished(event)
  local state = storage.flight_progression
  if state and event and event.research and event.research.valid
    and event.research.force.index == state.force_index then update(state, false) end
end

function M.on_tick(event)
  local state = storage.flight_progression
  if state and event.tick % CHECK_INTERVAL == 0 then update(state, false) end
end

return M
