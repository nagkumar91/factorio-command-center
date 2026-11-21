-- Native protocol of the blue-tier on-demand mall. Import the exact blueprint and never repair it.
-- Runs only in the validator's private save. Checks are those that qualified the first version;
-- the timing and ring-peak records below are measurements, not pass criteria. T.withhold exists only in
-- exploration runs (one input left unsupplied); a full run never sets it.
local T = require('fixture')
local M, P = T.manifest, T.protocol
local A = P.stockFillTicks
local B = A + P.refillTicks
local C = B + P.outageTicks
local FIN = C + P.recoveryTicks

local function require_ok(ok, message)
  if not ok then error('BLUE_TIER_MALL: ' .. message) end
end
local function record(t, name, passed, detail)
  t.checks[#t.checks + 1] = {name=name, passed=not not passed, detail=detail}
  if not passed then t.failures[#t.failures + 1] = name end
end
local function close(a, b) return math.abs(a-b) < 0.001 end
local function contains(entity, position)
  local b = entity.selection_box
  return position.x > b.left_top.x and position.x < b.right_bottom.x and position.y > b.left_top.y and position.y < b.right_bottom.y
end
local function inventory_counts(entity)
  local result = {}
  for _, name in ipairs(M.products) do result[name] = entity.get_item_count(name) end
  return result
end
local function recipe_map(values)
  local result = {}
  for _, v in pairs(values) do result[(v.type or 'item') .. ':' .. v.name] = v.amount end
  return result
end
local function same_map(a, b)
  for k,v in pairs(a) do if b[k] ~= v then return false end end
  for k,v in pairs(b) do if a[k] ~= v then return false end end
  return true
end
local function drain(t, label)
  local counts = inventory_counts(t.provider)
  for name, count in pairs(counts) do if count > 0 then t.provider.remove_item{name=name, count=count} end end
  t.collections[#t.collections+1] = {phase=label, tick=game.tick-t.begin, items=counts}
end
local function stock_check(t, label)
  local counts, all, bounded = inventory_counts(t.provider), true, true
  for name, cap in pairs(M.stockCaps) do
    if counts[name] < cap then all = false end
    if counts[name] > cap+1 then bounded = false end
  end
  record(t, label .. ': every product reaches its stock cap', all, counts)
  record(t, label .. ': output overshoot is at most one item per product', bounded, counts)
  local actual = t.provider.get_inventory(defines.inventory.chest).get_contents()
  local allowed = {}; for _, name in ipairs(M.products) do allowed[name] = true end
  local clean = true
  for _, stack in pairs(actual) do if not allowed[stack.name] then clean = false end end
  record(t, label .. ': provider contains only requested products', clean)
  t.phases[#t.phases+1] = {phase=label, tick=game.tick-t.begin, stock=counts}
end

script.on_init(function()
  require_ok(script.active_mods.base == T.gameVersion, 'wrong game version')
  for name, version in pairs(T.activeMods) do require_ok(script.active_mods[name] == version, 'mod mismatch: ' .. name) end
  local surface = game.create_surface('blue-tier-mall-isolated', {width=160, height=96, default_enable_all_autoplace_controls=false, autoplace_settings={entity={treat_missing_as_default=false}, decorative={treat_missing_as_default=false}}})
  surface.always_day = true
  surface.request_to_generate_chunks({0,0}, 3); surface.force_generate_chunk_requests()
  local tiles = {}; for x=-64,63 do for y=-32,31 do tiles[#tiles+1] = {name='grass-1', position={x,y}} end end
  surface.set_tiles(tiles)
  local force = game.create_force('blue-tier-mall-test')
  for _, name in ipairs(T.technologyClosure) do require_ok(force.technologies[name], 'missing technology ' .. name); force.technologies[name].researched=true end
  local t = {surface=surface, force=force, begin=game.tick, checks={}, failures={}, entities={}, collections={}, phases={}, samples={}, acceptedInputs={}, fixtures={}, routes={}, timing={}, ringPeaks={}, ringPeakTotal=0}
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
    if spec.name == 'display-panel' then record(t, 'display panel visible #' .. spec.entity_number, e.display_panel_always_show) end
  end
  t.provider = t.entities[M.output.chest]
  record(t, 'Exactly one passive provider', #surface.find_entities_filtered{name='passive-provider-chest', force=force} == 1)
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
  t.power = fixture('electric-energy-interface', {x=dx, y=dy-6})
  t.power.power_production=P.externalPowerWatts; t.power.electric_buffer_size=P.externalPowerWatts; t.power.energy=P.externalPowerWatts
  for _, port in ipairs(M.inputPorts) do
    if port.kind == 'fluid' then t.fluid = fixture('pipe', {x=port.externalContact.x+dx, y=port.externalContact.y+dy}) end
  end
  local function route(armId, source, dest, label)
    local a = t.entities[armId]
    record(t, label, source and dest and contains(source, a.pickup_position) and contains(dest, a.drop_position))
    t.routes[#t.routes+1] = {label=label, inserter=armId, pickup=a.pickup_position, drop=a.drop_position}
  end
  local function loop_contact(armId, kind)
    local position = kind == 'pickup' and t.entities[armId].pickup_position or t.entities[armId].drop_position
    for _, id in ipairs(M.loop) do if contains(t.entities[id], position) then return t.entities[id] end end
  end
  for _, port in ipairs(M.inputPorts) do if port.kind == 'item' then
    route(port.inserter, t.entities[port.chest], loop_contact(port.inserter, 'drop'), 'input port ' .. port.item)
    record(t, 'cold empty input ' .. port.item, t.entities[port.chest].get_inventory(defines.inventory.chest).is_empty())
  end end
  for _, c in ipairs(M.cells) do
    local e = t.entities[c.machine]
    local recipe = e.get_recipe()
    record(t, 'recipe preserved ' .. c.recipe, recipe and recipe.name == c.recipe)
    local proto = prototypes.recipe[c.recipe]
    record(t, 'runtime recipe ingredients match snapshot ' .. c.recipe, same_map(recipe_map(proto.ingredients), recipe_map(T.recipePrototypes[c.recipe].ingredients)))
    record(t, 'runtime recipe results match snapshot ' .. c.recipe, same_map(recipe_map(proto.products), recipe_map(T.recipePrototypes[c.recipe].results)))
    record(t, 'cold machine and no modules ' .. c.recipe, e.products_finished == 0 and e.get_module_inventory().is_empty())
    for _, id in ipairs(c.inputArms) do route(id, loop_contact(id,'pickup'), e, c.recipe .. ' input #' .. id) end
    route(c.outputArm, e, loop_contact(c.outputArm,'drop'), c.recipe .. ' output')
  end
  for _, v in ipairs(M.directTransfers) do route(v.inserter, t.entities[v.source], t.entities[v.destination], 'direct ' .. v.item .. ' #' .. v.inserter) end
  for _, id in ipairs(M.output.collectors) do route(id, loop_contact(id,'pickup'), t.provider, 'shared provider collector #' .. id) end
  record(t, 'empty provider cold start', t.provider.get_inventory(defines.inventory.chest).is_empty())
  storage.run=t
end)

script.on_event(defines.events.on_tick, function(event)
  local t=storage.run; if not t or t.done then return end
  local tick=event.tick-t.begin
  local outage=tick>B and tick<=C
  if tick == 1 then
    local reader=t.entities[M.reader].get_control_behavior()
    record(t, 'whole-loop reader survived blueprint import', reader.read_contents and reader.read_contents_mode == defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold)
    local network=t.entities[M.reader].get_circuit_network(defines.wire_connector_id.circuit_green)
    local all=network~=nil
    for _, spec in ipairs(T.entities) do if spec.entity_number==M.output.chest or (spec.control_behavior and spec.control_behavior.circuit_enabled) then
      local n=t.entities[spec.entity_number].get_circuit_network(defines.wire_connector_id.circuit_green)
      if not n or not network or n.network_id~=network.network_id then all=false end
    end end
    record(t, 'provider and capped arms share the actual reader circuit', all)
    local powered=true
    for _, e in pairs(t.entities) do if (e.type=='inserter' or e.type=='assembling-machine') and not e.is_connected_to_electric_network() then powered=false end end
    record(t, 'all machines and arms have actual native power connections', powered)
  end
  if tick%30==0 and not outage then
    for _, port in ipairs(M.inputPorts) do if port.kind=='item' and not (T.withhold and T.withhold[port.item]) then
      local chest=t.entities[port.chest]
      local count=math.max(0, math.min(100,T.inputStackSizes[port.item])-chest.get_item_count(port.item))
      if count > 0 then
        local accepted=chest.insert{name=port.item,count=count}
        t.acceptedInputs[port.item]=(t.acceptedInputs[port.item] or 0)+accepted
      end
    end end
    if not (T.withhold and T.withhold.lubricant) then
      local amount=t.fluid.insert_fluid{name='lubricant',amount=1000,temperature=25}
      t.acceptedInputs.lubricant=(t.acceptedInputs.lubricant or 0)+amount
    end
  end
  if tick%60==0 and tick>0 then
    -- Measurement only: when each product first sits at its cap in the provider, per phase.
    local phase = tick<=A and 1 or tick<=B and 2 or tick<=C and 3 or 4
    local start = ({0, A, B, C})[phase]
    local timing = t.timing[phase]
    if not timing then timing = {phase=phase, startTick=start, reached={}}; t.timing[phase] = timing end
    local counts, all = inventory_counts(t.provider), true
    for name, cap in pairs(M.stockCaps) do
      if counts[name] >= cap then timing.reached[name] = timing.reached[name] or (tick-start) else all = false end
    end
    if all and not timing.allTick then timing.allTick = tick-start end
    -- Measurement only: the most of each item ever riding the ring (circuit total minus the provider).
    local network = t.entities[M.reader].get_circuit_network(defines.wire_connector_id.circuit_green)
    local total = 0
    for _, s in pairs(network and network.signals or {}) do
      local onRing = s.count - t.provider.get_item_count(s.signal.name)
      total = total + onRing
      if onRing > (t.ringPeaks[s.signal.name] or 0) then t.ringPeaks[s.signal.name] = onRing end
    end
    if total > t.ringPeakTotal then t.ringPeakTotal = total end
  end
  if tick%P.samplingTicks==0 then
    local accepted = {}; for name, count in pairs(t.acceptedInputs) do accepted[name] = count end
    t.samples[#t.samples+1]={tick=tick,stock=inventory_counts(t.provider),inputOutage=outage,boundaryAccepted=accepted}
  end
  if tick==A then stock_check(t,'cold-start stock'); drain(t,'first complete collection') end
  if tick==B then
    stock_check(t,'refill after collection'); drain(t,'second complete collection')
    for _, port in ipairs(M.inputPorts) do if port.kind=='item' then t.entities[port.chest].get_inventory(defines.inventory.chest).clear() end end
  end
  if tick==C then
    t.phases[#t.phases+1]={phase='input outage ended; internal buffers preserved',tick=tick,stock=inventory_counts(t.provider)}
    drain(t,'collection before recovery')
  end
  if tick==FIN then
    stock_check(t,'recovery after input outage')
    local crafts={}
    for _, cell in ipairs(M.cells) do
      local machine=t.entities[cell.machine]
      crafts[cell.recipe]=machine.products_finished
      record(t,'actual native crafts ' .. cell.recipe,machine.products_finished>0 and machine.get_module_inventory().is_empty())
    end
    local items=t.force.get_item_production_statistics(t.surface)
    local fluids=t.force.get_fluid_production_statistics(t.surface)
    local report={schema=1,passed=#t.failures==0,failures=t.failures,checks=t.checks,gameVersion=script.active_mods.base,activeMods=T.activeMods,blueprintSha256=T.blueprintSha256,prototypeSha256=T.prototypeSha256,configurationSha256=T.configurationSha256,nativeControlSha256=T.nativeControlSha256,actualTicks=tick,protocol=P,productionClaims='On-demand functional stock/refill/recovery only; no items/min target',phases=t.phases,collections=t.collections,samples=t.samples,crafts=crafts,finalProviderStock=inventory_counts(t.provider),boundaryAcceptedInputs=t.acceptedInputs,boundaryAcceptedIsNotConsumption=true,itemProduction=items.input_counts,itemConsumption=items.output_counts,fluidProduction=fluids.input_counts,fluidConsumption=fluids.output_counts,routeEvidence=t.routes,stockTiming=t.timing,ringPeaks=t.ringPeaks,ringPeakTotal=t.ringPeakTotal,blueprintEntityCount=#T.entities,fixtureEntityCount=#t.fixtures,footprint=M.footprint}
    helpers.write_file('blue-tier-mall/native-report.json',helpers.table_to_json(report),false)
    log('BLUE_TIER_MALL_RESULT ' .. helpers.table_to_json({passed=report.passed,failures=report.failures,blueprintSha256=report.blueprintSha256}))
    t.done=true
  end
end)
