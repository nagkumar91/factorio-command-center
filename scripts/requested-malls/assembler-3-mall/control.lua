-- Native protocol of the assembling-machine-3 supply mall. Import the exact blueprint and never repair it.
-- Runs only in the validator's private save. Only the four entrance belts and outside power are supplied.
-- The run is a sequence of bounded phases (see PROTOCOL in lib.mjs); each fill phase ends as soon as both provider chests
-- hold 50, or fails at its limit. Timing, rates, ring peaks and per-machine counts are measurements, not pass limits.
local T = require('fixture')
local M, P = T.manifest, T.protocol
local AM2, AM3 = 'assembling-machine-2', 'assembling-machine-3'
local STACK = 50

local status_names = {}
for name, value in pairs(defines.entity_status) do status_names[value] = name end

local function require_ok(ok, message)
  if not ok then error('ASSEMBLER_3_MALL: ' .. message) end
end
local function record(t, name, passed, detail)
  t.checks[#t.checks + 1] = {name=name, passed=not not passed, detail=detail}
  if not passed then t.failures[#t.failures + 1] = name end
end
local function contains(entity, position)
  local b = entity.selection_box
  return position.x > b.left_top.x and position.x < b.right_bottom.x and position.y > b.left_top.y and position.y < b.right_bottom.y
end
local function recipe_map(values)
  local result = {}
  for _, v in pairs(values) do result[(v.type or 'item') .. ':' .. v.name] = v.amount end
  return result
end
local function same_map(a, b)
  for k, v in pairs(a) do if b[k] ~= v then return false end end
  for k, v in pairs(b) do if a[k] ~= v then return false end end
  return true
end
local function chest_count(t, item) return t.chest[item].get_item_count(item) end
local function chest_foreign(t, item)
  for _, stack in pairs(t.chest[item].get_inventory(defines.inventory.chest).get_contents()) do
    if stack.name ~= item then return stack.name end
  end
  return nil
end

-- Items the outside world has put on one entrance belt and has not yet been taken by the mall.
local function on_entrance_belts(t, port)
  local n = 0
  for _, e in ipairs(port.belts) do for i = 1, 2 do n = n + e.get_transport_line(i).get_item_count() end end
  return n
end
local function supply_top_up(t, port)
  local tail = port.belts[1]
  for lane = 1, 2 do
    local line = tail.get_transport_line(lane)
    for _ = 1, 8 do
      if not line.insert_at_back({name=port.item, count=1}) then break end
      port.accepted = port.accepted + 1
    end
  end
end
local function clear_entrance(t, port)
  for _, e in ipairs(port.belts) do for i = 1, 2 do e.get_transport_line(i).clear() end end
end

-- Drained: everything in a provider chest is taken, as a person or a robot would.
local function take(t, item)
  local n = chest_count(t, item)
  if n > 0 then t.chest[item].remove_item{name=item, count=n}; t.removed[item] = t.removed[item] + n end
  return n
end
local function drain(t, label)
  local taken = {[AM2]=take(t, AM2), [AM3]=take(t, AM3)}
  t.collections[#t.collections + 1] = {phase=label, tick=game.tick - t.begin, items=taken}
end

local function ring_total(t)
  local network = t.reader.get_circuit_network(defines.wire_connector_id.circuit_green)
  local total, items = 0, {}
  for _, s in pairs(network and network.signals or {}) do
    total = total + s.count; items[s.signal.name] = (items[s.signal.name] or 0) + s.count
  end
  return total, items
end

local function snapshot(t)
  local crafts, draw = {}, {}
  for _, cell in ipairs(M.cells) do crafts[cell.recipe] = t.entities[cell.machine].products_finished end
  for _, port in ipairs(t.ports) do draw[port.item] = port.accepted - on_entrance_belts(t, port) end
  return {tick=game.tick - t.begin, crafts=crafts, draw=draw, removed={[AM2]=t.removed[AM2], [AM3]=t.removed[AM3]}}
end
local function window(a, b, minutes)
  local w = {minutes=minutes, crafts={}, craftsPerMinute={}, inputsPerMinute={}, removed={}, removedPerMinute={}}
  for recipe, n in pairs(b.crafts) do w.crafts[recipe] = n - a.crafts[recipe]; w.craftsPerMinute[recipe] = (n - a.crafts[recipe]) / minutes end
  for item, n in pairs(b.draw) do w.inputsPerMinute[item] = (n - a.draw[item]) / minutes end
  for item, n in pairs(b.removed) do w.removed[item] = n - a.removed[item]; w.removedPerMinute[item] = (n - a.removed[item]) / minutes end
  return w
end

local function finish(t, tick, fatal)
  local crafts = {}
  for _, cell in ipairs(M.cells) do
    local machine = t.entities[cell.machine]
    crafts[cell.recipe] = machine.products_finished
    record(t, 'actual native crafts ' .. cell.recipe, machine.products_finished > 0 and machine.get_module_inventory().is_empty())
  end
  record(t, 'provider chests never held a foreign item', t.foreign == nil, t.foreign)
  record(t, 'provider chests never held more than one stack', t.chestPeak[AM2] <= STACK and t.chestPeak[AM3] <= STACK, t.chestPeak)
  record(t, 'ring never held more than the lane-room bound', t.ringPeakTotal <= M.laneRoom.maxCirculating, {peak=t.ringPeakTotal, bound=M.laneRoom.maxCirculating})
  local peaksOk, over = true, {}
  for item, cap in pairs(M.ringCaps) do
    if (t.ringPeaks[item] or 0) > cap + 1 then peaksOk = false; over[item] = t.ringPeaks[item] end
  end
  record(t, 'every ring item stayed within its cap plus one item in an arm', peaksOk, over)
  -- The normal-use window must show every machine crafting. The both-emptied window is an artificial worst case (the AM2 chain
  -- takes the circuits first), so its per-machine counts are reported, not required.
  local w = t.windows['rate-am3']
  if w then
    local stuck = {}
    for recipe, n in pairs(w.crafts) do if n <= 0 then stuck[#stuck + 1] = recipe end end
    record(t, 'no machine stuck during the rate-am3 window', #stuck == 0, stuck)
  end
  local items = t.force.get_item_production_statistics(t.surface)
  local report = {schema=1, passed=(#t.failures == 0 and not fatal), fatal=fatal, failures=t.failures, checks=t.checks, gameVersion=script.active_mods.base, activeMods=T.activeMods,
    blueprintSha256=T.blueprintSha256, prototypeSha256=T.prototypeSha256, configurationSha256=T.configurationSha256, nativeControlSha256=T.nativeControlSha256,
    actualTicks=tick, protocol=P, sequence=t.sequence, phases=t.phases, fillTimes=t.fillTimes, collections=t.collections, windows=t.windows, samples=t.samples,
    crafts=crafts, finalProviderStock={[AM2]=chest_count(t, AM2), [AM3]=chest_count(t, AM3)}, chestPeak=t.chestPeak, removedTotal=t.removed,
    boundaryAccepted=(function() local a = {}; for _, port in ipairs(t.ports) do a[port.item] = port.accepted end; return a end)(),
    boundaryAcceptedIsNotConsumption=true, itemProduction=items.input_counts, itemConsumption=items.output_counts,
    routeEvidence=t.routes, ringPeaks=t.ringPeaks, ringPeakTotal=t.ringPeakTotal, machineStatus=t.status, blueprintEntityCount=#T.entities, fixtureEntityCount=#t.fixtures, footprint=M.footprint}
  helpers.write_file('assembler-3-mall/native-report.json', helpers.table_to_json(report), false)
  log('ASSEMBLER_3_MALL_RESULT ' .. helpers.table_to_json({passed=report.passed, failures=report.failures, blueprintSha256=report.blueprintSha256, ticks=tick}))
  t.done = true
end

script.on_init(function()
  require_ok(script.active_mods.base == T.gameVersion, 'wrong game version')
  for name, version in pairs(T.activeMods) do require_ok(script.active_mods[name] == version, 'mod mismatch: ' .. name) end
  local surface = game.create_surface('assembler-3-mall-isolated', {width=192, height=96, default_enable_all_autoplace_controls=false, autoplace_settings={entity={treat_missing_as_default=false}, decorative={treat_missing_as_default=false}}})
  surface.always_day = true
  surface.request_to_generate_chunks({0,0}, 3); surface.force_generate_chunk_requests()
  local tiles = {}; for x=-64,95 do for y=-32,31 do tiles[#tiles+1] = {name='grass-1', position={x,y}} end end
  surface.set_tiles(tiles)
  local force = game.create_force('assembler-3-mall-test')
  for _, name in ipairs(T.technologyClosure) do require_ok(force.technologies[name], 'missing technology ' .. name); force.technologies[name].researched=true end
  local t = {surface=surface, force=force, begin=game.tick, checks={}, failures={}, entities={}, collections={}, phases={}, samples={}, fixtures={}, routes={}, ringPeaks={}, ringPeakTotal=0,
    removed={[AM2]=0, [AM3]=0}, chestPeak={[AM2]=0, [AM3]=0}, chest={}, ports={}, sequence=P.sequence, seq=0, windows={}, fillTimes={}, status={}, supply=true, drainItems={}}
  local inventory = game.create_inventory(1)
  inventory[1].set_stack{name='blueprint'}
  require_ok(inventory[1].import_stack(T.blueprint) == 0, 'exact blueprint import')
  local ghosts = inventory[1].build_blueprint{surface=surface, force=force, position={0,0}, build_mode=defines.build_mode.forced}
  require_ok(#ghosts == #T.entities, 'blueprint ghost count')
  for _, ghost in pairs(ghosts) do local _, entity = ghost.revive{raise_revive=true}; require_ok(entity, 'blueprint revival') end
  inventory.destroy()
  local anchor
  for _, e in pairs(surface.find_entities_filtered{type='assembling-machine', force=force}) do if e.get_recipe() and e.get_recipe().name == M.cells[1].recipe then anchor=e end end
  require_ok(anchor, 'anchor recipe did not survive import')
  local original
  for _, e in ipairs(T.entities) do if e.entity_number == M.cells[1].machine then original=e end end
  local dx, dy = anchor.position.x-original.position.x, anchor.position.y-original.position.y
  t.offset = {x=dx, y=dy}
  for _, spec in ipairs(T.entities) do
    local e = surface.find_entity(spec.name, {spec.position.x+dx, spec.position.y+dy})
    require_ok(e, 'missing blueprint entity #' .. spec.entity_number)
    t.entities[spec.entity_number] = e
    if spec.name == 'fast-inserter' or spec.name == 'fast-transport-belt' then require_ok(e.direction == (spec.direction or 0), 'direction changed #' .. spec.entity_number) end
    if spec.name == 'display-panel' then
      record(t, 'display panel visible #' .. spec.entity_number, e.display_panel_always_show)
      record(t, 'display panel text and icon survive import #' .. spec.entity_number, e.display_panel_text == spec.text and e.display_panel_icon and e.display_panel_icon.name == spec.icon.name)
    end
    -- every filter, hand size and circuit condition of the blueprint must survive the import
    if spec.name == 'fast-inserter' then
      local ok = e.inserter_filter_mode == 'whitelist' and e.inserter_stack_size_override == 1
      for i, f in ipairs(spec.filters) do local g = e.get_filter(i); if not g or g.name ~= f.name then ok = false end end
      record(t, 'inserter filters and hand size survive import #' .. spec.entity_number, ok)
      if spec.control_behavior and spec.control_behavior.circuit_enabled then
        local cb = e.get_control_behavior()
        local c, want = cb.circuit_condition, spec.control_behavior.circuit_condition
        record(t, 'circuit cap survives import #' .. spec.entity_number, cb.circuit_enable_disable and c.first_signal and c.first_signal.name == want.first_signal.name and c.comparator == '<' and c.constant == want.constant)
      else
        local cb = e.get_control_behavior()
        record(t, 'plain arm is not circuit controlled #' .. spec.entity_number, (not cb) or (not cb.circuit_enable_disable))
      end
    end
  end
  t.reader = t.entities[M.reader]
  record(t, 'Exactly two passive providers', #surface.find_entities_filtered{name='passive-provider-chest', force=force} == 2)
  for _, o in ipairs(M.outputs) do
    local chest = t.entities[o.chest]
    t.chest[o.item] = chest
    local inv = chest.get_inventory(defines.inventory.chest)
    record(t, 'cold empty provider chest ' .. o.item, inv.is_empty())
    local accepted = chest.insert{name=o.item, count=200}
    record(t, 'provider chest holds exactly one stack of ' .. o.item, accepted == STACK, accepted)
    inv.clear()
  end
  local function fixture(name, position)
    local e = surface.create_entity{name=name, position=position, force=force}
    require_ok(e, 'fixture placement ' .. name); t.fixtures[#t.fixtures+1] = e; return e
  end
  local entry = t.entities[M.power.entryPole]
  local external = fixture('medium-electric-pole', {x=M.power.externalPolePosition.x+dx, y=M.power.externalPolePosition.y+dy})
  local externalCopper = external.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  local entryCopper = entry.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  -- Pole placement can create this copper connection automatically. connect_to returns false when it did not create a new wire, so accept an existing valid link.
  if not externalCopper.is_connected_to(entryCopper) then externalCopper.connect_to(entryCopper) end
  require_ok(externalCopper.is_connected_to(entryCopper), 'external power wire')
  t.power = fixture('electric-energy-interface', {x=M.power.externalPolePosition.x+dx+0.5, y=M.power.externalPolePosition.y+dy-3.5})
  t.power.power_production=P.externalPowerWatts; t.power.electric_buffer_size=P.externalPowerWatts; t.power.energy=P.externalPowerWatts
  -- The four entrances: three plain belt tiles reach each stub from the west edge; the script keeps the outside belt full.
  for _, port in ipairs(M.inputPorts) do
    local first = t.entities[port.stub[1]]
    local belts = {}
    for i = 3, 1, -1 do
      belts[#belts + 1] = fixture('fast-transport-belt', {x=first.position.x - i, y=first.position.y})
      belts[#belts].direction = defines.direction.east
    end
    t.ports[#t.ports + 1] = {item=port.item, id=port.id, belts=(function() local all = {}; for _, b in ipairs(belts) do all[#all+1] = b end; for _, sid in ipairs(port.stub) do all[#all+1] = t.entities[sid] end; return all end)(), accepted=0, stub=port.stub}
    record(t, 'cold empty entrance ' .. port.item, on_entrance_belts(t, t.ports[#t.ports]) == 0)
  end
  local function loop_contact(armId, kind)
    local position = kind == 'pickup' and t.entities[armId].pickup_position or t.entities[armId].drop_position
    for _, id in ipairs(M.loop) do if contains(t.entities[id], position) then return t.entities[id] end end
  end
  local function route(armId, source, dest, label)
    local a = t.entities[armId]
    record(t, label, source and dest and contains(source, a.pickup_position) and contains(dest, a.drop_position))
    t.routes[#t.routes+1] = {label=label, inserter=armId, pickup=a.pickup_position, drop=a.drop_position}
  end
  for _, port in ipairs(M.inputPorts) do route(port.inserter, t.entities[port.stubEnd], loop_contact(port.inserter, 'drop'), 'entrance ' .. port.item .. ' stub end to ring') end
  for _, c in ipairs(M.cells) do
    local e = t.entities[c.machine]
    local recipe = e.get_recipe()
    record(t, 'recipe preserved ' .. c.recipe, recipe and recipe.name == c.recipe)
    local proto = prototypes.recipe[c.recipe]
    record(t, 'runtime recipe ingredients match snapshot ' .. c.recipe, same_map(recipe_map(proto.ingredients), recipe_map(T.recipePrototypes[c.recipe].ingredients)))
    record(t, 'runtime recipe results match snapshot ' .. c.recipe, same_map(recipe_map(proto.products), recipe_map(T.recipePrototypes[c.recipe].results)))
    record(t, 'cold machine and no modules ' .. c.recipe, e.products_finished == 0 and e.get_module_inventory().is_empty())
    for _, id in ipairs(c.inputArms) do route(id, loop_contact(id,'pickup'), e, c.recipe .. ' ring input #' .. id) end
    if c.outputArm then route(c.outputArm, e, loop_contact(c.outputArm,'drop'), c.recipe .. ' output to ring') end
    for _, v in ipairs(c.directInputs) do route(v.inserter, t.entities[v.source], t.entities[v.destination], 'direct ' .. v.item .. ' #' .. v.inserter) end
    t.status[c.recipe] = {}
  end
  for _, o in ipairs(M.outputs) do route(o.producerArm, t.entities[o.producer], t.entities[o.chest], o.item .. ' machine to its own provider chest') end
  storage.run=t
end)

local PHASES = {}
-- A fill phase: from whatever state to both chests at 50, bounded.
local function fill_phase(limit_field, label)
  return {
    begin = function(t, tick)
      t.p = {reached={}, limit=P[limit_field]}
    end,
    step = function(t, tick, elapsed)
      for _, item in ipairs({AM2, AM3}) do
        if chest_count(t, item) >= STACK and not t.p.reached[item] then t.p.reached[item] = elapsed end
      end
      if t.p.reached[AM2] and t.p.reached[AM3] then
        t.fillTimes[label] = {am2=t.p.reached[AM2], am3=t.p.reached[AM3], both=elapsed, limit=t.p.limit}
        record(t, label .. ': both provider chests reach 50', true, t.fillTimes[label])
        record(t, label .. ': neither chest holds more than 50', chest_count(t, AM2) <= STACK and chest_count(t, AM3) <= STACK)
        record(t, label .. ': provider chests contain only their own product', chest_foreign(t, AM2) == nil and chest_foreign(t, AM3) == nil)
        return true
      end
      if elapsed >= t.p.limit then
        t.fillTimes[label] = {am2=t.p.reached[AM2], am3=t.p.reached[AM3], limit=t.p.limit, timedOut=true}
        record(t, label .. ': both provider chests reach 50 within ' .. t.p.limit .. ' ticks', false, t.fillTimes[label])
        return true, true
      end
    end,
  }
end
PHASES['fill'] = fill_phase('fillLimitTicks', 'fill from empty')
PHASES['refill'] = fill_phase('refillLimitTicks', 'refill after collection')
PHASES['refill'].begin_base = PHASES['refill'].begin
PHASES['refill'].begin = function(t, tick) PHASES['refill'].begin_base(t, tick); drain(t, 'collection before refill') end
PHASES['recovery'] = fill_phase('recoveryLimitTicks', 'recovery after outage')
PHASES['recovery'].begin_base = PHASES['recovery'].begin
PHASES['recovery'].begin = function(t, tick)
  drain(t, 'collection at the end of the outage')
  t.supply = true
  PHASES['recovery'].begin_base(t, tick)
end
PHASES['outage'] = {
  begin = function(t, tick)
    drain(t, 'collection before the outage')
    t.supply = false
    for _, port in ipairs(t.ports) do clear_entrance(t, port) end
    t.p = {}
  end,
  step = function(t, tick, elapsed)
    if elapsed >= P.outageTicks then
      t.phases[#t.phases+1] = {phase='input outage ended', tick=tick, stock={[AM2]=chest_count(t, AM2), [AM3]=chest_count(t, AM3)}}
      return true
    end
  end,
}
PHASES['hold'] = {
  begin = function(t, tick) t.p = {} end,
  step = function(t, tick, elapsed)
    if elapsed >= P.holdTicks then
      record(t, 'hold at full stock: both chests still at exactly 50', chest_count(t, AM2) == STACK and chest_count(t, AM3) == STACK, {chest_count(t, AM2), chest_count(t, AM3)})
      record(t, 'hold at full stock: provider chests contain only their own product', chest_foreign(t, AM2) == nil and chest_foreign(t, AM3) == nil)
      return true
    end
  end,
}
PHASES['resume'] = {
  begin = function(t, tick) drain(t, 'collection after the hold'); t.p = {} end,
  step = function(t, tick, elapsed)
    if elapsed >= P.resumeTicks then
      local a, b = chest_count(t, AM2), chest_count(t, AM3)
      record(t, 'production resumes after collection from full stock', a > 0 and b > 0, {[AM2]=a, [AM3]=b, minutes=elapsed/3600})
      return true
    end
  end,
}
-- A rate phase: the chests are emptied every second. Optionally only the AM3 chest (the normal use), after the AM2 chest has refilled.
local function rate_phase(label, items, wait_for_am2)
  return {
    begin = function(t, tick)
      t.drainItems = {}
      for _, item in ipairs(items) do t.drainItems[item] = true end
      t.p = {stage=wait_for_am2 and 'wait' or 'warmup', stageStart=tick}
      if not wait_for_am2 then drain(t, 'collection before ' .. label) end
    end,
    step = function(t, tick, elapsed)
      local p = t.p
      if p.stage == 'wait' then
        if chest_count(t, AM2) >= STACK then
          p.stage = 'warmup'; p.stageStart = tick
          drain(t, 'collection before ' .. label)
          t.phases[#t.phases+1] = {phase=label .. ': AM2 chest full again', tick=tick - t.begin, waitedTicks=elapsed}
        elseif elapsed >= P.am2FullLimitTicks then
          record(t, label .. ': AM2 chest refills to 50', false); return true, true
        end
      elseif p.stage == 'warmup' then
        if tick - p.stageStart >= P.rateWarmupTicks then p.stage = 'measure'; p.stageStart = tick; p.first = snapshot(t); p.firstTick = tick end
      elseif p.stage == 'measure' then
        if tick - p.stageStart >= P.rateMeasureTicks then
          local w = window(p.first, snapshot(t), P.rateMeasureTicks / 3600)
          w.statusCounts = p.statusCounts
          t.windows[label] = w
          t.phases[#t.phases+1] = {phase=label, tick=tick - t.begin, assemblingMachine3PerMinute=w.removedPerMinute[AM3], assemblingMachine2PerMinute=w.removedPerMinute[AM2]}
          return true
        end
      end
    end,
  }
end
PHASES['rate-both'] = rate_phase('rate-both', {AM2, AM3}, false)
PHASES['rate-am3'] = rate_phase('rate-am3', {AM3}, true)

local function begin_next(t, tick)
  t.seq = t.seq + 1
  local name = t.sequence[t.seq]
  if not name then finish(t, tick, false); return end
  t.name, t.start = name, tick
  PHASES[name].begin(t, tick)
  t.phases[#t.phases+1] = {phase='begin ' .. name, tick=tick - t.begin, stock={[AM2]=chest_count(t, AM2), [AM3]=chest_count(t, AM3)}}
end

script.on_event(defines.events.on_tick, function(event)
  local t=storage.run; if not t or t.done then return end
  local tick=event.tick-t.begin
  if tick >= 1 and not t.started then
    t.started = true
    local reader=t.reader.get_control_behavior()
    record(t, 'whole-ring reader survived blueprint import', reader.read_contents and reader.read_contents_mode == defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold)
    local network=t.reader.get_circuit_network(defines.wire_connector_id.circuit_green)
    local all=network~=nil
    for _, spec in ipairs(T.entities) do if spec.control_behavior and spec.control_behavior.circuit_enabled then
      local n=t.entities[spec.entity_number].get_circuit_network(defines.wire_connector_id.circuit_green)
      if not n or not network or n.network_id~=network.network_id then all=false end
    end end
    record(t, 'capped arms share the actual reader circuit', all)
    local chests_clear = true
    for _, e in pairs(t.chest) do for _, id in ipairs({defines.wire_connector_id.circuit_green, defines.wire_connector_id.circuit_red}) do if e.get_circuit_network(id) then chests_clear = false end end end
    record(t, 'provider chests are on no circuit', chests_clear)
    local powered=true
    for _, e in pairs(t.entities) do if (e.type=='inserter' or e.type=='assembling-machine') and not e.is_connected_to_electric_network() then powered=false end end
    record(t, 'all machines and arms have actual native power connections', powered)
    begin_next(t, event.tick)
  end
  if t.done or not t.started then return end
  if t.supply and tick%30==0 then for _, port in ipairs(t.ports) do supply_top_up(t, port) end end
  if tick%60==0 and tick>0 then
    -- chests: never foreign, never above one stack
    for _, item in ipairs({AM2, AM3}) do
      local n = chest_count(t, item)
      if n > t.chestPeak[item] then t.chestPeak[item] = n end
      local foreign = chest_foreign(t, item)
      if foreign and not t.foreign then t.foreign = {chest=item, found=foreign, tick=tick} end
    end
    -- ring: the most of each item ever riding it
    local total, items = ring_total(t)
    if total > t.ringPeakTotal then t.ringPeakTotal = total end
    for name, count in pairs(items) do if count > (t.ringPeaks[name] or 0) then t.ringPeaks[name] = count end end
    -- people empty the chests every second in the rate phases
    for item in pairs(t.drainItems) do take(t, item) end
  end
  if tick%600==0 and tick>0 then
    local counts = t.p and t.p.stage == 'measure' and (t.p.statusCounts or {}) or nil
    if counts then t.p.statusCounts = counts end
    for _, cell in ipairs(M.cells) do
      local s = status_names[t.entities[cell.machine].status] or 'unknown'
      t.status[cell.recipe][s] = (t.status[cell.recipe][s] or 0) + 1
      if counts then counts[cell.recipe] = counts[cell.recipe] or {}; counts[cell.recipe][s] = (counts[cell.recipe][s] or 0) + 1 end
    end
  end
  if tick%36000==0 and tick>0 then
    log(string.format('ASSEMBLER_3_MALL_PROGRESS tick=%d phase=%s am2=%d am3=%d ring=%d', tick, tostring(t.name), chest_count(t, AM2), chest_count(t, AM3), ring_total(t)))
  end
  if tick%P.samplingTicks==0 and tick>0 then
    local total = ring_total(t)
    t.samples[#t.samples+1]={tick=tick, phase=t.name, stock={[AM2]=chest_count(t, AM2), [AM3]=chest_count(t, AM3)}, ring=total, inputOutage=not t.supply}
  end
  local done, fatal = PHASES[t.name].step(t, event.tick, event.tick - t.start)
  if done then
    if fatal then finish(t, tick, true) else begin_next(t, event.tick) end
  end
end)
