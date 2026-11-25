-- Native protocol of the express belt mall. Import the exact blueprint and never repair it.
-- Runs only in the validator's private save. Supply: the three entrance belts (full lanes), the lubricant pipe and outside power.
-- Phases (ticks from the start): fill from empty, refill after a complete collection, a short input outage with collection,
-- recovery, then the rate phase (all three chests emptied every second: warm-up, then the measured window).
-- T.withhold exists only in exploration runs: {item = tick} leaves that input unsupplied until that tick.
local T = require('fixture')
local M, P = T.manifest, T.protocol
local A = P.stockFillTicks
local B = A + P.refillTicks
local C = B + P.outageTicks
local D = C + P.recoveryTicks
local R0 = D + P.warmupTicks
local FIN = R0 + P.measureTicks
local PER_MINUTE = 3600

local function require_ok(ok, message)
  if not ok then error('EXPRESS_BELT_MALL: ' .. message) end
end
local function record(t, name, passed, detail)
  t.checks[#t.checks + 1] = {name=name, passed=not not passed, detail=detail}
  if not passed then t.failures[#t.failures + 1] = name end
end
local function contains(entity, position)
  if not entity then return false end
  local b = entity.selection_box
  return position.x > b.left_top.x and position.x < b.right_bottom.x and position.y > b.left_top.y and position.y < b.right_bottom.y
end
local function status_name(e) for n, v in pairs(defines.entity_status) do if v == e.status then return n end end return tostring(e.status) end
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
local function product_counts(t)
  local counts = {}
  for _, name in ipairs(M.products) do counts[name] = t.chests[name].get_item_count(name) end
  return counts
end
-- Everything in a chest other than its own product is a failure; the counts are by item.
local function chest_foreign(t)
  for name, chest in pairs(t.chests) do
    for _, stack in pairs(chest.get_inventory(defines.inventory.chest).get_contents()) do
      if stack.name ~= name then return stack.name end
    end
  end
  return nil
end
local function drain(t, label)
  local counts = product_counts(t)
  for name, count in pairs(counts) do if count > 0 then t.chests[name].remove_item{name=name, count=count} end end
  t.collections[#t.collections + 1] = {phase=label, tick=game.tick - t.begin, items=counts}
end
local function stock_check(t, label)
  local counts, all, over = product_counts(t), true, false
  for name, cap in pairs(M.outputCaps) do
    if counts[name] < cap then all = false end
    if counts[name] > cap then over = true end
  end
  record(t, label .. ': every product is at one full stack in its own chest', all, counts)
  record(t, label .. ': no chest holds more than one stack', not over, counts)
  record(t, label .. ': no chest holds anything but its own product', chest_foreign(t) == nil, chest_foreign(t))
  t.phases[#t.phases + 1] = {phase=label, tick=game.tick - t.begin, stock=counts}
end
local function ring_signals(t)
  local network = t.entities[M.reader].get_circuit_network(defines.wire_connector_id.circuit_green)
  return network and network.signals or {}
end
local function machine_crafts(t)
  local crafts = {}
  for _, cell in ipairs(M.cells) do crafts[#crafts + 1] = {recipe=cell.recipe, tag=cell.tag, crafts=t.entities[cell.machine].products_finished} end
  return crafts
end

script.on_init(function()
  require_ok(script.active_mods.base == T.gameVersion, 'wrong game version')
  for name, version in pairs(T.activeMods) do require_ok(script.active_mods[name] == version, 'mod mismatch: ' .. name) end
  local surface = game.create_surface('express-belt-mall-isolated', {width=160, height=96, default_enable_all_autoplace_controls=false, autoplace_settings={entity={treat_missing_as_default=false}, decorative={treat_missing_as_default=false}}})
  surface.always_day = true
  surface.request_to_generate_chunks({0,0}, 3); surface.force_generate_chunk_requests()
  local tiles = {}; for x=-64,63 do for y=-32,31 do tiles[#tiles+1] = {name='grass-1', position={x,y}} end end
  surface.set_tiles(tiles)
  local force = game.create_force('express-belt-mall-test')
  for _, name in ipairs(T.technologyClosure) do require_ok(force.technologies[name], 'missing technology ' .. name); force.technologies[name].researched = true end
  local t = {surface=surface, force=force, begin=game.tick, checks={}, failures={}, entities={}, chests={}, collections={}, phases={}, samples={}, accepted={}, fixtures={}, routes={}, timing={}, ringPeaks={}, ringPeakTotal=0, machineSamples={}, slices={}, sliceCount={}, windowFed={}, foreign=nil, reachedAt={}}
  local inventory = game.create_inventory(1)
  inventory[1].set_stack{name='blueprint'}
  require_ok(inventory[1].import_stack(T.blueprint) == 0, 'exact blueprint import')
  local ghosts = inventory[1].build_blueprint{surface=surface, force=force, position={0,0}, build_mode=defines.build_mode.forced}
  require_ok(#ghosts == #T.entities, 'blueprint ghost count')
  for _, ghost in pairs(ghosts) do local _, entity = ghost.revive{raise_revive=true}; require_ok(entity, 'blueprint revival') end
  inventory.destroy()
  local anchor, anchorSpec
  for _, spec in ipairs(T.entities) do if spec.entity_number == M.cells[1].machine then anchorSpec = spec end end
  for _, e in pairs(surface.find_entities_filtered{type='assembling-machine', force=force}) do if e.get_recipe() and e.get_recipe().name == M.cells[1].recipe then anchor = e end end
  require_ok(anchor and anchorSpec, 'anchor recipe did not survive import')
  local dx, dy = anchor.position.x - anchorSpec.position.x, anchor.position.y - anchorSpec.position.y
  t.offset = {x=dx, y=dy}
  local exact = true
  for _, spec in ipairs(T.entities) do
    local e = surface.find_entity(spec.name, {spec.position.x + dx, spec.position.y + dy})
    require_ok(e, 'missing blueprint entity #' .. spec.entity_number)
    t.entities[spec.entity_number] = e
    if spec.name == 'fast-inserter' or spec.name == 'fast-transport-belt' or spec.name == 'fast-underground-belt' or spec.name == 'assembling-machine-2' then
      if e.direction ~= (spec.direction or 0) then exact = false; record(t, 'direction changed #' .. spec.entity_number, false) end
    end
    if spec.name == 'fast-underground-belt' and e.belt_to_ground_type ~= spec.type then exact = false; record(t, 'underground type changed #' .. spec.entity_number, false) end
    if spec.name == 'display-panel' then record(t, 'display panel visible #' .. spec.entity_number, e.display_panel_always_show and e.display_panel_text == spec.text) end
  end
  record(t, 'every entity imported at its exact position, direction and type', exact)
  for _, o in ipairs(M.outputs) do t.chests[o.item] = t.entities[o.chest] end
  record(t, 'Exactly three passive providers', #surface.find_entities_filtered{name='passive-provider-chest', force=force} == 3)
  -- Every chest takes exactly one stack of its own product and nothing else.
  for name, chest in pairs(t.chests) do
    local inv = chest.get_inventory(defines.inventory.chest)
    local inserted = chest.insert{name=name, count=100000}
    record(t, 'provider holds exactly one stack of ' .. name, inserted == M.outputCaps[name] and inv.get_item_count(name) == M.outputCaps[name], {inserted=inserted})
    record(t, 'provider is a passive provider ' .. name, chest.prototype.logistic_mode == 'passive-provider')
    chest.remove_item{name=name, count=inserted}
    record(t, 'cold empty provider ' .. name, inv.is_empty())
  end
  -- Filters, hand sizes and circuit conditions as imported.
  local filtersOk, handsOk, gateOk = true, true, true
  for _, spec in ipairs(T.entities) do if spec.name == 'fast-inserter' then
    local e = t.entities[spec.entity_number]
    if e.inserter_stack_size_override ~= 1 then handsOk = false end
    if e.inserter_filter_mode ~= 'whitelist' then filtersOk = false end
    for i, f in ipairs(spec.filters) do local actual = e.get_filter(i); if not actual or actual.name ~= f.name then filtersOk = false end end
    if spec.control_behavior and spec.control_behavior.circuit_enabled then
      local actual = e.get_control_behavior()
      local c, wanted = actual.circuit_condition, spec.control_behavior.circuit_condition
      if not (actual.circuit_enable_disable and c.first_signal.name == wanted.first_signal.name and c.comparator == wanted.comparator and c.constant == wanted.constant) then gateOk = false end
    end
  end end
  record(t, 'every arm kept its hand size, whitelist and filters', filtersOk and handsOk)
  record(t, 'every ring stock cap kept its condition', gateOk)
  local function fixture(name, position)
    local e = surface.create_entity{name=name, position=position, force=force}
    require_ok(e, 'fixture placement ' .. name); t.fixtures[#t.fixtures + 1] = e; return e
  end
  local entry = t.entities[M.power.entryPole]
  local external = fixture('medium-electric-pole', {x=M.power.externalPolePosition.x + dx, y=M.power.externalPolePosition.y + dy})
  local externalCopper = external.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  local entryCopper = entry.get_wire_connector(defines.wire_connector_id.pole_copper, true)
  -- Pole placement can create this copper connection automatically. connect_to returns false when it did not create a new wire, so accept an existing valid link.
  if not externalCopper.is_connected_to(entryCopper) then externalCopper.connect_to(entryCopper) end
  require_ok(externalCopper.is_connected_to(entryCopper), 'external power wire')
  -- The outside generator stands inside the external pole's supply area.
  t.power = fixture('electric-energy-interface', {x=M.power.externalPolePosition.x + dx - 1.5, y=M.power.externalPolePosition.y + dy - 1.5})
  t.power.power_production = P.externalPowerWatts; t.power.electric_buffer_size = P.externalPowerWatts; t.power.energy = P.externalPowerWatts
  t.inputs = {}
  for _, port in ipairs(M.inputPorts) do
    if port.kind == 'fluid' then t.fluid = fixture('pipe', {x=port.externalContact.x + dx, y=port.externalContact.y + dy})
    else t.inputs[#t.inputs + 1] = {item=port.item, belt=t.entities[port.entranceBelt]} end
  end
  -- Entrance approaches are clear for three tiles; each entrance faces east into its arm.
  for _, port in ipairs(M.inputPorts) do if port.kind == 'item' then
    for k = 1, 3 do record(t, 'clear approach ' .. port.id .. ' offset ' .. k, surface.can_place_entity{name='fast-transport-belt', position={port.entrance.x + dx - k, port.entrance.y + dy}, force=force}) end
  end end
  local function route(armId, source, dest, label)
    local a = t.entities[armId]
    record(t, label, source and dest and contains(source, a.pickup_position) and contains(dest, a.drop_position))
    t.routes[#t.routes + 1] = {label=label, inserter=armId, pickup=a.pickup_position, drop=a.drop_position}
  end
  local function ring_contact(armId, kind)
    local a = t.entities[armId]
    local position = kind == 'pickup' and a.pickup_position or a.drop_position
    for _, id in ipairs(M.loop) do if contains(t.entities[id], position) then return t.entities[id] end end
  end
  local ironSet = {}; for _, id in ipairs(M.ironBelt) do ironSet[id] = t.entities[id] end
  local function iron_contact(armId)
    local a = t.entities[armId]
    for _, id in ipairs(M.ironBelt) do if contains(t.entities[id], a.pickup_position) then return t.entities[id] end end
  end
  for _, port in ipairs(M.inputPorts) do if port.kind == 'item' then
    local source = port.item == 'iron-plate' and iron_contact(port.ringArm) or t.entities[port.entranceBelt]
    route(port.ringArm, source, ring_contact(port.ringArm, 'drop'), 'entrance ' .. port.item .. ' -> ring')
  end end
  for _, c in ipairs(M.cells) do
    local e = t.entities[c.machine]
    local recipe = e.get_recipe()
    local label = c.recipe .. (c.tag and ('/' .. c.tag) or '')
    record(t, 'recipe preserved ' .. label, recipe and recipe.name == c.recipe)
    local proto = prototypes.recipe[c.recipe]
    local expected = T.recipePrototypes[c.recipe]
    record(t, 'runtime recipe ingredients match snapshot ' .. label, same_map(recipe_map(proto.ingredients), recipe_map(expected.ingredients)))
    record(t, 'runtime recipe results match snapshot ' .. label, same_map(recipe_map(proto.products), recipe_map(expected.results)))
    record(t, 'cold machine and no modules ' .. label, e.products_finished == 0 and e.get_module_inventory().is_empty())
    for _, id in ipairs(c.ringInputArms) do route(id, ring_contact(id, 'pickup'), e, label .. ' ring input #' .. id) end
    for _, id in ipairs(c.beltInputArms) do route(id, iron_contact(id), e, label .. ' iron belt input #' .. id) end
    if c.ringOutputArm then route(c.ringOutputArm, e, ring_contact(c.ringOutputArm, 'drop'), label .. ' output to ring') end
  end
  for _, v in ipairs(M.directTransfers) do route(v.inserter, t.entities[v.source], t.entities[v.destination], 'direct ' .. v.item .. ' #' .. v.inserter) end
  for _, o in ipairs(M.outputs) do route(o.collector, ring_contact(o.collector, 'pickup'), t.chests[o.item], 'collector -> ' .. o.item .. ' chest') end
  record(t, 'cold empty ring', #ring_signals(t) == 0)
  storage.run = t
end)

local function supply(t, tick)
  -- Entrance belts: both lanes of each declared entrance, a full belt. Withheld inputs stay empty (exploration only).
  if tick % 4 == 0 then
    for _, input in ipairs(t.inputs) do
      local stop = T.withhold and T.withhold[input.item]
      if not (stop and tick < stop) then
        for lane = 1, 2 do
          if input.belt.get_transport_line(lane).insert_at_back{name=input.item, count=1} then
            t.accepted[input.item] = (t.accepted[input.item] or 0) + 1
            if tick > R0 then t.windowFed[input.item] = (t.windowFed[input.item] or 0) + 1 end
          end
        end
      end
    end
  end
  if tick % 5 == 0 then
    local stop = T.withhold and T.withhold['lubricant']
    if not (stop and tick < stop) then
      local amount = t.fluid.insert_fluid{name='lubricant', amount=100, temperature=25}
      t.accepted.lubricant = (t.accepted.lubricant or 0) + amount
      if tick > R0 then t.windowFed.lubricant = (t.windowFed.lubricant or 0) + amount end
    end
  end
end

script.on_event(defines.events.on_tick, function(event)
  local t = storage.run; if not t or t.done then return end
  local tick = event.tick - t.begin
  local outage = tick > B and tick <= C
  if tick == 1 then
    local reader = t.entities[M.reader].get_control_behavior()
    record(t, 'whole-ring reader survived blueprint import', reader.read_contents and reader.read_contents_mode == defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold)
    local network = t.entities[M.reader].get_circuit_network(defines.wire_connector_id.circuit_green)
    local all = network ~= nil
    for _, spec in ipairs(T.entities) do if spec.control_behavior and spec.control_behavior.circuit_enabled then
      local n = t.entities[spec.entity_number].get_circuit_network(defines.wire_connector_id.circuit_green)
      if not n or not network or n.network_id ~= network.network_id then all = false end
    end end
    record(t, 'every capped arm shares the actual reader circuit', all)
    -- Fluid: every express maker sits on the lubricant segment.
    local segment = t.fluid.get_fluid_segment_id(1)
    local fluidOk = segment ~= nil
    for _, c in ipairs(M.cells) do
      if c.recipe:find('express') == 1 then
        local e = t.entities[c.machine]
        local connected = false
        for j = 1, e.fluids_count do for _, conn in pairs(e.get_fluid_box_pipe_connections(j) or {}) do
          local pipe = conn.target or conn.target_entity
          if pipe and pipe.has_fluid_segment(conn.target_fluidbox_index or 1) and pipe.get_fluid_segment_id(conn.target_fluidbox_index or 1) == segment then connected = true end
        end end
        if not connected then fluidOk = false end
      end
    end
    record(t, 'the outside pipe, the inlet and all three express makers share one fluid segment', fluidOk)
    local poleDetail = {}
    for _, id in ipairs(M.power.poles) do
      local pole = t.entities[id]
      local connector = pole.get_wire_connector(defines.wire_connector_id.pole_copper, false)
      poleDetail[#poleDetail + 1] = {id=id, network=pole.electric_network_id, connections=connector and #connector.connections or 0}
    end
    record(t, 'the poles form one copper network', true, poleDetail)
    local unpowered = {}
    local entryNetwork = t.entities[M.power.entryPole].electric_network_id
    for id, e in pairs(t.entities) do if (e.type == 'inserter' or e.type == 'assembling-machine') and (not e.is_connected_to_electric_network() or e.electric_network_id ~= entryNetwork) then unpowered[#unpowered + 1] = {id=id, connected=e.is_connected_to_electric_network(), network=e.electric_network_id, x=e.position.x, y=e.position.y} end end
    record(t, 'all machines and arms have actual native power connections', #unpowered == 0, unpowered)
  end
  if not outage then supply(t, tick) end
  if tick % 60 == 0 and tick > 0 then
    -- Measurement only: when each product first sits at its cap in its chest, per phase.
    local phase = tick <= A and 1 or tick <= B and 2 or tick <= C and 3 or tick <= D and 4 or 5
    local start = ({0, A, B, C, D})[phase]
    local timing = t.timing[phase]
    if not timing then timing = {phase=phase, startTick=start, reached={}}; t.timing[phase] = timing end
    if phase ~= 5 then
      local counts, all = product_counts(t), true
      for name, cap in pairs(M.outputCaps) do
        if counts[name] >= cap then timing.reached[name] = timing.reached[name] or (tick - start) else all = false end
      end
      if all and not timing.allTick then timing.allTick = tick - start end
    end
    -- The most of each item ever riding the ring, and the ring's total.
    local total = 0
    for _, s in pairs(ring_signals(t)) do
      total = total + s.count
      if s.count > (t.ringPeaks[s.signal.name] or 0) then t.ringPeaks[s.signal.name] = s.count end
      if M.ringCaps[s.signal.name] == nil then t.foreign = t.foreign or s.signal.name end
    end
    if total > t.ringPeakTotal then t.ringPeakTotal = total end
    local foreign = chest_foreign(t)
    if foreign then t.foreignInChest = t.foreignInChest or foreign end
  end
  if tick % 15 == 0 then
    local total = 0
    for _, s in pairs(ring_signals(t)) do total = total + s.count end
    if total > t.ringPeakTotal then t.ringPeakTotal = total end
  end
  if tick % P.samplingTicks == 0 then
    local accepted = {}; for name, count in pairs(t.accepted) do accepted[name] = count end
    t.samples[#t.samples + 1] = {tick=tick, stock=product_counts(t), inputOutage=outage, accepted=accepted}
  end
  -- Held at full stock: crafts in the last minute before the fill phase ends say whether the mall is at rest.
  if tick == A - PER_MINUTE then t.restBaseline = {}; for _, c in ipairs(M.cells) do t.restBaseline[c.machine] = t.entities[c.machine].products_finished end end
  if tick == A then
    local rest = {}
    for _, c in ipairs(M.cells) do rest[#rest + 1] = {recipe=c.recipe, tag=c.tag, craftsInLastMinute=t.entities[c.machine].products_finished - (t.restBaseline and t.restBaseline[c.machine] or 0), status=status_name(t.entities[c.machine])} end
    local ring = {}; for _, s in pairs(ring_signals(t)) do ring[s.signal.name] = s.count end
    t.holdAtFirstFull = {restAtEnd=rest, ringAtEnd=ring, fullSinceTick=t.timing[1] and t.timing[1].allTick}
    stock_check(t, 'cold-start stock'); drain(t, 'first complete collection')
  end
  if tick == B then stock_check(t, 'refill after collection'); drain(t, 'second complete collection') end
  if tick == C then
    t.phases[#t.phases + 1] = {phase='input outage ended; internal buffers preserved', tick=tick, stock=product_counts(t)}
    drain(t, 'collection before recovery')
  end
  if tick == D then stock_check(t, 'recovery after input outage') end
  -- Rate phase: every chest emptied every second, counted.
  if tick > D and tick % P.collectEveryTicks == 0 then
    local measuring = tick > R0
    for _, o in ipairs(M.outputs) do
      local chest = t.chests[o.item]
      local n = chest.get_item_count(o.item)
      if n > 0 then chest.remove_item{name=o.item, count=n} end
      if measuring then
        t.rate = t.rate or {}; t.rate[o.item] = (t.rate[o.item] or 0) + n
        local slice = math.floor((tick - R0 - 1) / 18000) + 1
        t.slices[o.item] = t.slices[o.item] or {}; t.slices[o.item][slice] = (t.slices[o.item][slice] or 0) + n
      end
    end
  end
  if tick == R0 then
    t.baseline = {crafts={}, item={}, fluid=0}
    local items = t.force.get_item_production_statistics(t.surface)
    for _, name in ipairs({'iron-plate', 'copper-plate', 'plastic-bar'}) do t.baseline.item[name] = items.get_output_count(name) end
    t.baseline.fluid = t.force.get_fluid_production_statistics(t.surface).get_output_count('lubricant')
    for _, c in ipairs(M.cells) do t.baseline.crafts[c.machine] = t.entities[c.machine].products_finished end
  end
  if tick > R0 and tick <= FIN and tick % 60 == 0 then
    for _, c in ipairs(M.cells) do
      local s = t.machineSamples[c.machine] or {}
      local name = status_name(t.entities[c.machine])
      s[name] = (s[name] or 0) + 1
      t.machineSamples[c.machine] = s
    end
  end
  if tick == FIN then
    local crafts, machines = {}, {}
    for _, c in ipairs(M.cells) do
      local e = t.entities[c.machine]
      local made = e.products_finished - (t.baseline.crafts[c.machine] or 0)
      local key = c.recipe .. (c.tag and ('/' .. c.tag) or '')
      crafts[key] = e.products_finished
      machines[#machines + 1] = {recipe=c.recipe, tag=c.tag, entity=c.machine, measuredProducts=made, totalProducts=e.products_finished, statusSamples=t.machineSamples[c.machine], inputInventory=e.get_inventory(defines.inventory.crafter_input).get_contents(), outputInventory=e.get_inventory(defines.inventory.crafter_output).get_contents()}
      record(t, 'every machine crafted in the measured window ' .. key, made > 0)
      record(t, 'no module in ' .. key, e.get_module_inventory().is_empty())
    end
    local window = P.measureTicks / PER_MINUTE
    local outputs, inputs, accepted = {}, {}, {}
    for _, o in ipairs(M.outputs) do
      outputs[o.item] = (t.rate and t.rate[o.item] or 0) / window
      record(t, 'every product kept being made while all chests were emptied: ' .. o.item, (t.rate and t.rate[o.item] or 0) > 0)
      local zero = {}
      for slice = 1, math.floor(P.measureTicks / 18000) do if (t.slices[o.item] and t.slices[o.item][slice] or 0) == 0 then zero[#zero + 1] = slice end end
      record(t, 'no five-minute slice without ' .. o.item, #zero == 0, zero)
    end
    local items = t.force.get_item_production_statistics(t.surface)
    for _, name in ipairs({'iron-plate', 'copper-plate', 'plastic-bar'}) do
      inputs[name] = (items.get_output_count(name) - t.baseline.item[name]) / window
      accepted[name] = (t.windowFed[name] or 0) / window
    end
    inputs.lubricant = (t.force.get_fluid_production_statistics(t.surface).get_output_count('lubricant') - t.baseline.fluid) / window
    accepted.lubricant = (t.windowFed.lubricant or 0) / window
    record(t, 'the ring held only declared items', t.foreign == nil, t.foreign)
    record(t, 'no chest ever held a foreign item', t.foreignInChest == nil, t.foreignInChest)
    record(t, 'ring never held more than the lane-room bound', t.ringPeakTotal <= M.ringLimits.bound, {peak=t.ringPeakTotal, bound=M.ringLimits.bound})
    local peaksOk = true
    for name, peak in pairs(t.ringPeaks) do if M.ringCaps[name] and peak > M.ringCaps[name] + (M.ringLimits.adders[name] or 0) then peaksOk = false end end
    record(t, 'every ring item stayed within its cap plus one hand per arm that adds it', peaksOk, t.ringPeaks)
    local stats = t.force.get_item_production_statistics(t.surface)
    local report = {schema=1, passed=#t.failures == 0, failures=t.failures, checks=t.checks, gameVersion=script.active_mods.base, activeMods=T.activeMods, blueprintSha256=T.blueprintSha256, prototypeSha256=T.prototypeSha256, configurationSha256=T.configurationSha256, nativeControlSha256=T.nativeControlSha256, actualTicks=tick, protocol=P, withhold=T.withhold, phases=t.phases, collections=t.collections, samples=t.samples, crafts=crafts, machines=machines, measured={windowMinutes=window, outputsPerMinute=outputs, inputsPerMinute=inputs, acceptedOntoEntrancesPerMinute=accepted, perFiveMinuteSlice=t.slices, note='inputsPerMinute is what the machines consumed in the window (production statistics), the draw each entrance has to meet; accepted is what the entrance belts and the pipe took.'}, holdAtFirstFull=t.holdAtFirstFull, stockTiming=t.timing, ringPeaks=t.ringPeaks, ringPeakTotal=t.ringPeakTotal, ringBound=M.ringLimits.bound, boundaryAccepted=t.accepted, routeEvidence=t.routes, blueprintEntityCount=#T.entities, fixtureEntityCount=#t.fixtures, footprint=M.footprint}
    helpers.write_file('express-belt-mall/native-report.json', helpers.table_to_json(report), false)
    log('EXPRESS_BELT_MALL_RESULT ' .. helpers.table_to_json({passed=report.passed, failures=report.failures, blueprintSha256=report.blueprintSha256}))
    t.done = true
  end
end)
