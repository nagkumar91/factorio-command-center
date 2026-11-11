import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const audit = read('flight-map/progression-audit.json');
const modulePath = path.join(root, 'flight-map/progression.lua');
const moduleSource = fs.readFileSync(modulePath, 'utf8');
const rawPath = process.env.FLIGHT_RAW_DUMP || path.join(root, audit.provenance.rawDump);
const rawBytes = fs.existsSync(rawPath) ? fs.readFileSync(rawPath) : null;
const raw = rawBytes ? JSON.parse(rawBytes) : null;
const select = (object, keys) => Object.fromEntries(keys.filter(key => key in object).map(key => [key, object[key]]));
const lua = value => value === null ? 'nil' : Array.isArray(value) ? `{${value.map(lua).join(',')}}`
  : typeof value === 'object' ? `{${Object.entries(value).map(([k, v]) => `[${lua(k)}]=${lua(v)}`).join(',')}}`
    : typeof value === 'string' ? JSON.stringify(value) : String(value);

// Print only this function with --print-native-audit. Main can embed/call it AFTER
// progression.init in a DISPOSABLE native scenario. Never apply it to the deliverable
// save: finish() simulates earned prerequisites. This tests real APIs/handlers, not
// production rates, actual research cost payment, market clicks or real capture.
const nativeAudit = String.raw`local progression = require("progression")
return function(surface, force, report_path)
  local state = assert(storage.flight_progression)
  local report = {kind = "synthetic-native-api-milestones", native_production_proof = false, checks = {}}
  local function check(value, message)
    assert(value, "FLIGHT_PROGRESSION: " .. message)
    report.checks[#report.checks + 1] = message
  end
  local function update()
    progression.on_tick{tick = 300}
  end
  local function offers()
    local result = {}
    for _, offer in ipairs(state.market.get_market_items() or {}) do result[offer.offer.item] = offer end
    return result
  end
  local function finish(name)
    local technology = assert(force.technologies[name], name)
    if technology.researched then return end
    for _, prerequisite in pairs(technology.prerequisites) do finish(prerequisite.name) end
    technology.researched = true -- TEST FIXTURE ONLY: never part of progression.lua.
    progression.on_research_finished{research = technology}
  end
  for name, technology in pairs(force.technologies) do
    check(not technology.researched, "startup unresearched: " .. name)
  end
  check(state.market.valid and state.market.name == "market", "market exists")
  check(not state.market.minable_flag and not state.market.destructible, "market protected")
  check(next(offers()) == nil, "no unearned starter offers")
  check(#state.rocks == 80, "80 starter volcanic rocks")
  for _, rock in ipairs(state.rocks) do check(rock.valid and rock.name == "big-volcanic-rock", "native volcanic rock") end
  for _, name in ipairs{"iron-stromatolite", "copper-stromatolite", "lithium-iceberg-big"} do
    local specimen = state.specimens[name]
    check(specimen and specimen.valid and specimen.name == name, "native initial specimen: " .. name)
    specimen.destroy()
  end
  update()
  check(not state.specimens["iron-stromatolite"].valid, "no unearned specimen respawn")
  check(not state.capture_target, "no startup capture enemy")
  finish("landfill"); finish("steel-processing"); update()
  check(state.specimens["iron-stromatolite"].valid, "agriculture specimen restored at earned gate")
  check(not force.technologies.agriculture.researched, "agriculture remains a native mining trigger")
  finish("concrete"); update()
  check(state.specimens["copper-stromatolite"].valid, "heating specimen restored at concrete")
  check(not force.technologies["heating-tower"].researched, "heating remains a native mining trigger")
  finish("calcite-processing"); finish("tungsten-carbide")
  check(offers()["tungsten-ore"].offer.count == 10 and offers().calcite.offer.count == 10, "paid hard ore recovery")
  check(not force.technologies.foundry.researched, "foundry remains earned")
  check(not force.technologies.recycling.researched, "recycling remains earned")
  check(not offers()["pentapod-egg"] and not offers()["promethium-asteroid-chunk"], "eggs and promethium still gated")
  finish("biochamber")
  check(offers()["pentapod-egg"].offer.count == 1, "fresh pentapod offer after earned biology")
  check(not offers()["biter-egg"], "biter eggs require capture")
  finish("rocket-silo"); update()
  check(force.technologies["space-platform"].researched, "space platform bridge after rocket silo")
  check(force.technologies["space-science-pack"].researched, "collector bridge after platform")
  check(offers()["oxide-asteroid-chunk"] and offers()["carbonic-asteroid-chunk"] and offers()["metallic-asteroid-chunk"], "three ground chunk exchanges")
  local automatic_count = 0
  for name in pairs(state.automatic_unlocks) do
    check(name == "space-platform" or name == "space-science-pack", "only allowlisted automatic research")
    automatic_count = automatic_count + 1
  end
  check(automatic_count == 2, "exactly two automatic technologies")
  check(not force.technologies["construction-robotics"].researched, "construction robots not gifted by bridge")
  check(not force.technologies["space-platform-thruster"].researched, "thruster science not gifted")
  finish("captivity"); update()
  check(state.capture_target.valid and state.capture_target.name == "biter-spawner", "native capture target after captivity")
  check(state.capture_target.force.name == "enemy" and state.capture_target.disabled_by_script, "target dormant and capturable enemy")
  check(not force.technologies["biter-egg-handling"].researched and not offers()["biter-egg"], "target does not fake capture research")
  for _, prerequisite in pairs(force.technologies["lithium-processing"].prerequisites) do finish(prerequisite.name) end
  update()
  check(state.specimens["lithium-iceberg-big"].valid, "late lithium specimen restored")
  check(not force.technologies["lithium-processing"].researched, "lithium mine trigger remains earned")
  finish("promethium-science-pack"); update()
  local final_offers = offers()
  check(final_offers["biter-egg"].offer.count == 5, "biter egg recovery gated behind handling")
  check(final_offers["promethium-asteroid-chunk"].offer.count == 25, "earned promethium exchange")
  local expected = __OFFERS__
  local offer_count = 0
  for _ in pairs(final_offers) do offer_count = offer_count + 1 end
  check(offer_count == #expected, "exact offer count")
  for _, expected_offer in ipairs(expected) do
    local actual = assert(final_offers[expected_offer.item])
    check(actual.offer.count == expected_offer.count, "native offer quantity: " .. expected_offer.item)
    local prices = {}
    for _, price in ipairs(actual.price) do prices[price.name] = price.count end
    for _, price in ipairs(expected_offer.price) do check(prices[price.name] == price.count, "native price: " .. expected_offer.item .. "/" .. price.name) end
  end
  local market = state.market
  progression.init(surface, force); update()
  check(state.market == market and #state.rocks == 80, "idempotent init preserves facility and one-time stocks")
  report.automatic_unlocks = state.automatic_unlocks
  report.offers = state.market.get_market_items()
  helpers.write_file(report_path or "flight-progression-native.json", helpers.table_to_json(report), false)
  log("FLIGHT_PROGRESSION_NATIVE_API_VALIDATED")
  return report
end
`.replace('__OFFERS__', lua(audit.exchange.offers));

if (process.argv.includes('--print-native-audit')) {
  process.stdout.write(nativeAudit);
  process.exit(0);
}

test('ground audit covers every trigger and names the only two research exceptions', () => {
  assert.equal(audit.triggerCount, 29);
  assert.equal(audit.triggers.length, audit.triggerCount);
  assert.equal(new Set(audit.triggers.map(t => t.technology)).size, 29);
  assert.deepEqual(audit.policy.automaticTechnologies, ['space-platform', 'space-science-pack']);
  assert.deepEqual(audit.triggers.filter(t => t.handling !== 'native-trigger').map(t => t.technology), audit.policy.automaticTechnologies);
  for (const trigger of audit.triggers) assert.ok(trigger.groundedRoute.trim(), trigger.technology);
  assert.equal(audit.policy.robotsRemainEarned, true);
  assert.equal(audit.policy.victoryOnGround, false);
  assert.ok(audit.unsupportedEndpoints.some(x => x.includes('solar-system-edge victory')));
});

test('starter rocks guarantee the first foundry and hard drill without gifted machines', () => {
  const rocks = audit.starterSupplies.volcanicRocks;
  const recipes = audit.installedFacts.recipes;
  const ingredient = (name, item) => recipes[name].ingredients.find(i => i.name === item).amount;
  const carbide = ingredient('foundry', 'tungsten-carbide') + ingredient('big-mining-drill', 'tungsten-carbide');
  assert.equal(carbide * ingredient('tungsten-carbide', 'tungsten-ore'), 140);
  for (const product of audit.installedFacts.simpleEntityMining['big-volcanic-rock']) {
    assert.equal(rocks.minimumYield[product.name], rocks.count * (product.amount ?? product.amount_min));
  }
  assert.ok(rocks.minimumYield['tungsten-ore'] >= 140);
  assert.ok(recipes['molten-iron-from-lava'].results.find(i => i.name === 'molten-iron').amount >= ingredient('big-mining-drill', 'molten-iron'));
  assert.deepEqual(audit.installedFacts.characterMiningCategories, ['basic-solid']);
  for (const [name, categories] of Object.entries(audit.installedFacts.drillCategories)) {
    if (name.startsWith('electric-mining-drill')) assert.ok(!categories.includes('hard-solid'), name);
  }
  assert.ok(audit.installedFacts.drillCategories['big-mining-drill'].includes('hard-solid'));
  const positions = [];
  for (let y = 0; y < rocks.grid.rows; y++) for (let x = 0; x < rocks.grid.columns; x++) {
    positions.push([rocks.grid.origin[0] + x * rocks.grid.spacing, rocks.grid.origin[1] + y * rocks.grid.spacing]);
  }
  assert.equal(positions.length, rocks.count);
  positions.push(audit.integration.marketPosition, audit.starterSupplies.captureTarget.position, ...audit.starterSupplies.specimens.map(s => s.position));
  for (const [x, y] of positions) {
    assert.ok(x > -300 && x < 300 && y > -280 && y < 280);
    assert.ok(x >= 224 && x <= 258 && y >= 98 && y <= 148, 'only reserved supply pads');
  }
  for (let i = 0; i < positions.length; i++) for (let j = 0; j < i; j++) {
    assert.ok(Math.hypot(positions[i][0] - positions[j][0], positions[i][1] - positions[j][1]) >= 3, 'distinct non-overlapping pads');
  }
});

test('heating and Fulgora recycling retain the exact installed earned requirements', () => {
  const heating = audit.triggers.find(t => t.technology === 'heating-tower');
  assert.deepEqual(heating.trigger, {type: 'mine-entity', entity: 'copper-stromatolite'});
  assert.deepEqual(heating.prerequisites, ['concrete']);
  assert.equal(heating.handling, 'native-trigger');
  const recycling = audit.installedFacts.nativeResearch.recycling;
  assert.deepEqual(recycling.prerequisites, ['processing-unit', 'production-science-pack']);
  assert.equal(recycling.research_trigger, undefined);
  assert.equal(recycling.unit.count, 100);
  assert.deepEqual(recycling.unit.ingredients.map(([name]) => name), ['automation-science-pack', 'logistic-science-pack', 'chemical-science-pack', 'production-science-pack']);
});

test('exchange prices and perishable acquisition are explicit and never free', () => {
  const offers = audit.exchange.offers;
  assert.equal(offers.length, 8);
  assert.equal(new Set(offers.map(o => o.item)).size, offers.length);
  for (const offer of offers) {
    assert.ok(offer.gate && offer.count > 0 && offer.price.length);
    assert.equal(offer.quality, 'normal');
    for (const p of offer.price) assert.ok(Number.isSafeInteger(p.count) && p.count > 0 && p.name !== offer.item);
    assert.ok(!/robot|drill|foundry|science-pack/.test(offer.item), 'only missing feedstocks are exchanged');
  }
  assert.deepEqual(offers.find(o => o.item === 'promethium-asteroid-chunk'), {
    gate: 'promethium-science-pack', item: 'promethium-asteroid-chunk', count: 25, quality: 'normal',
    price: [{name: 'quantum-processor', count: 1}, {name: 'tungsten-plate', count: 100}, {name: 'superconductor', count: 20}]
  });
  for (const name of ['metallic', 'carbonic', 'oxide']) assert.equal(offers.find(o => o.item === `${name}-asteroid-chunk`).gate, 'space-platform');
  assert.equal(offers.find(o => o.item === 'pentapod-egg').gate, 'biochamber');
  assert.equal(offers.find(o => o.item === 'biter-egg').gate, 'biter-egg-handling');
  assert.match(audit.exchange.eggSemantics, /Native spoil\/hatch timers apply/);
  assert.equal(audit.exchange.manual, true);
  assert.equal(audit.exchange.normalRecipe, false);
  assert.equal(audit.exchange.automatedThroughputClaim, false);
});

test('scenario module owns no global handlers, prototype edits, mining statistics or blanket research', () => {
  const code = moduleSource.replace(/--[^\n]*/g, '');
  for (const exported of ['init', 'on_tick', 'on_research_finished']) assert.ok(code.includes(`function M.${exported}(`));
  assert.equal((code.match(/\.researched\s*=\s*true/g) || []).length, 1);
  assert.doesNotMatch(code, /research_all|research_recursive|\.enabled\s*=|data\.raw|script\.on_|set_game_state|create_space_platform|item_production_statistics|spoil_percent\s*=/);
  assert.doesNotMatch(code, /\.destroy\(|set_tiles\(|insert\s*[{(]/);
  assert.match(code, /storage\.flight_progression/);
  assert.doesNotMatch(code, /storage\.flight\s*=/);
});

test('audit matches installed raw technologies, resources, recipes and mod source exactly', {skip: !raw && 'installed flight raw dump not present'}, () => {
  assert.equal(createHash('sha256').update(rawBytes).digest('hex'), audit.provenance.rawDumpSha256, 'dump drift requires a new audit');
  const triggerNames = Object.entries(raw.technology).filter(([, t]) => t.research_trigger).map(([n]) => n).sort();
  assert.deepEqual(audit.triggers.map(t => t.technology), triggerNames);
  for (const row of audit.triggers) {
    assert.deepEqual(row.trigger, raw.technology[row.technology].research_trigger);
    assert.deepEqual(row.prerequisites, raw.technology[row.technology].prerequisites || []);
  }
  assert.deepEqual(audit.resources.map(r => r.name), Object.keys(raw.resource).sort());
  for (const row of audit.resources) {
    assert.equal(row.category, raw.resource[row.name].category || 'basic-solid');
    assert.deepEqual(row.minable, select(raw.resource[row.name].minable, ['result', 'count', 'results', 'required_fluid', 'fluid_amount']));
  }
  for (const [name, evidence] of Object.entries(audit.installedFacts.nativeResearch)) assert.deepEqual(evidence, select(raw.technology[name], ['prerequisites', 'unit', 'research_trigger', 'effects']), name);
  for (const [name, evidence] of Object.entries(audit.installedFacts.recipes)) assert.deepEqual(evidence, select(raw.recipe[name], ['category', 'enabled', 'ingredients', 'results']), name);
  for (const [name, products] of Object.entries(audit.installedFacts.simpleEntityMining)) assert.deepEqual(products, raw['simple-entity'][name].minable.results);
  const wetland = raw.tile[audit.starterSupplies.specimenPads.tile].collision_mask.layers;
  assert.ok(wetland.water_tile && !wetland.ground_tile && !wetland.player, 'walkable wetland is required, not ordinary grass');
  for (const name of ['iron-stromatolite', 'copper-stromatolite']) assert.equal(raw['simple-entity'][name].collision_mask.layers.ground_tile, true);
  assert.equal(Object.values(raw).flatMap(group => Object.values(group)).filter(p => p.surface_conditions?.length).length, 0);
  const archive = path.join(path.dirname(path.dirname(rawPath)), 'mods/EverythingOnNauvis_0.1.8.zip');
  if (fs.existsSync(archive)) assert.equal(createHash('sha256').update(fs.readFileSync(archive)).digest('hex'), audit.provenance.everythingOnNauvis.archiveSha256);
});

test('native API evidence matches this exact module and stays separate from production proof', {skip: !fs.existsSync(path.join(root, 'flight-map/native-api-report.json')) && 'main-owned native API report not present'}, () => {
  const evidence = audit.validation.nativeApiEvidence;
  const bytes = fs.readFileSync(path.join(root, evidence.report));
  const report = JSON.parse(bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.reportSha256);
  const moduleHash = createHash('sha256').update(moduleSource).digest('hex');
  assert.equal(report.progressionLuaSha256, moduleHash, 'rerun native milestone validation after module changes');
  assert.equal(evidence.progressionLuaSha256, moduleHash);
  assert.equal(report.prototypeSha256, audit.provenance.rawDumpSha256);
  assert.equal(report.kind, 'synthetic-native-api-milestones');
  assert.equal(report.native_production_proof, false);
  assert.equal(evidence.nativeProductionProof, false);
  assert.equal(report.checks.length, evidence.passedChecks);
  assert.deepEqual(Object.keys(report.automatic_unlocks).sort(), audit.policy.automaticTechnologies);
  for (const name of ['iron-stromatolite', 'copper-stromatolite', 'lithium-iceberg-big']) assert.ok(report.checks.includes(`native initial specimen: ${name}`));
  assert.ok(report.checks.includes('exact offer count'));
});

// A qualitative closure over ACTUAL installed recipes, equipment categories, science
// ingredients and triggers. No starter machines or researched technology are seeded.
// This is deliberately not a numeric material/energy/throughput or native-game proof.
function groundClosure({exchange = true, bridge = true, volcanic = true} = {}) {
  const technology = new Set(), available = new Set(), crafted = new Set(), mined = new Set();
  const categories = new Set(raw.character.character.crafting_categories);
  const mining = new Set(raw.character.character.mining_categories);
  const fluidMining = new Set();
  const recipes = new Set(Object.entries(raw.recipe).filter(([, r]) => r.enabled !== false).map(([n]) => n));
  const items = Object.fromEntries(Object.values(raw).flatMap(group => Object.entries(group)).filter(([, p]) => p.stack_size));
  const entities = Object.fromEntries(Object.values(raw).flatMap(group => Object.entries(group)).filter(([, p]) => p.crafting_categories || p.resource_categories));
  const key = p => `${p.type || 'item'}:${p.name}`;
  const has = p => available.has(key(p));
  const addProducts = m => {
    if (m.result) available.add(`item:${m.result}`);
    for (const p of Object.values(m.results || {})) if ((p.probability ?? 1) > 0 && (p.amount ?? p.amount_max ?? 1) > 0) available.add(key(p));
  };
  const natural = ['tree-01', 'yumako-tree', 'jellystem', ...audit.mapOwnedSources.wildlife.map(s => s.entity), ...audit.starterSupplies.specimens.map(s => s.entity), ...(volcanic ? ['big-volcanic-rock'] : [])];
  for (const name of natural) {
    const entity = Object.values(raw).map(group => group[name]).find(p => p?.minable);
    assert.ok(entity, name);
    addProducts(entity.minable); mined.add(name);
  }
  let previous = -1;
  while (previous !== available.size + technology.size + recipes.size + categories.size + mining.size + crafted.size + mined.size) {
    previous = available.size + technology.size + recipes.size + categories.size + mining.size + crafted.size + mined.size;
    for (const [name, resource] of Object.entries(raw.resource)) {
      const category = resource.category || 'basic-solid';
      if (mining.has(category) && (!resource.minable.required_fluid || (fluidMining.has(category) && available.has(`fluid:${resource.minable.required_fluid}`)))) {
        addProducts(resource.minable); mined.add(name);
      }
    }
    if (available.has('item:offshore-pump')) for (const fluid of Object.values(audit.mapOwnedSources.tiles)) available.add(`fluid:${fluid}`);
    if (available.has('item:boiler') && available.has('fluid:water') && available.has('item:coal')) available.add('fluid:steam');
    for (const [name, item] of Object.entries(items)) {
      if (!available.has(`item:${name}`)) continue;
      if (item.spoil_result) available.add(`item:${item.spoil_result}`);
      const entity = entities[item.place_result];
      if (entity) {
        // Biochambers need nutrients to run, not just construction materials.
        if (item.place_result === 'biochamber' && !available.has('item:nutrients')) continue;
        for (const category of entity.crafting_categories || []) categories.add(category);
        for (const category of entity.resource_categories || []) mining.add(category);
        if (entity.input_fluid_box) for (const category of entity.resource_categories || []) fluidMining.add(category);
      }
    }
    if (technology.has('captivity') && available.has('item:capture-robot-rocket') && available.has('item:bioflux')) categories.add('captive-spawner-process');
    if (exchange) for (const offer of audit.exchange.offers) {
      if (technology.has(offer.gate) && offer.price.every(has)) available.add(`item:${offer.item}`);
    }
    for (const name of recipes) {
      const recipe = raw.recipe[name];
      if (!categories.has(recipe.category || 'crafting') || !Object.values(recipe.ingredients || {}).every(has)) continue;
      addProducts(recipe);
      for (const p of Object.values(recipe.results || {})) if ((p.type || 'item') === 'item' && (p.probability ?? 1) > 0) crafted.add(p.name);
    }
    for (const [name, t] of Object.entries(raw.technology)) {
      if (technology.has(name) || t.hidden || t.enabled === false || !(t.prerequisites || []).every(p => technology.has(p))) continue;
      let ready;
      const trigger = t.research_trigger;
      if (!trigger) ready = available.has('item:lab') && (t.unit?.ingredients || []).every(i => available.has(`item:${i[0] || i.name}`));
      else if (bridge && audit.policy.automaticTechnologies.includes(name)) ready = true;
      else if (trigger.type === 'craft-item') ready = crafted.has(trigger.item);
      else if (trigger.type === 'mine-entity') ready = mined.has(trigger.entity);
      else if (trigger.type === 'capture-spawner') ready = categories.has('captive-spawner-process');
      if (ready) {
        technology.add(name);
        for (const effect of t.effects || []) if (effect.type === 'unlock-recipe') recipes.add(effect.recipe);
      }
    }
  }
  return {technology, available, crafted, mined};
}

test('installed recipe closure reaches every native trigger and science without space or gifted machines', {skip: !raw && 'installed flight raw dump not present'}, () => {
  const closure = groundClosure();
  const missing = audit.triggers.filter(t => !closure.technology.has(t.technology)).map(t => t.technology);
  assert.deepEqual(missing, [], 'unresolved native trigger dependencies');
  const inaccessibleResearch = Object.entries(raw.technology).filter(([name, t]) => !t.hidden && t.enabled !== false && !closure.technology.has(name)).map(([name]) => name);
  assert.deepEqual(inaccessibleResearch, [], 'visible technology prerequisites or science remain circular');
  for (const name of ['space-science-pack', 'metallurgic-science-pack', 'agricultural-science-pack', 'electromagnetic-science-pack', 'cryogenic-science-pack', 'promethium-science-pack']) assert.ok(closure.crafted.has(name), `${name} not craftable on ground`);
  assert.ok(closure.technology.has('research-productivity'));
  assert.ok(closure.available.has('item:big-mining-drill'));
  const noImports = groundClosure({exchange: false});
  assert.ok(!noImports.available.has('item:promethium-asteroid-chunk'), 'promethium cannot bootstrap from recycling');
  assert.ok(!noImports.available.has('item:biochamber'), 'egg/chamber bootstrap really needs a seed source');
  const noBridge = groundClosure({bridge: false});
  assert.ok(!noBridge.technology.has('space-platform'));
  assert.ok(!noBridge.crafted.has('space-science-pack'));
  const exchangeRecovery = groundClosure({volcanic: false});
  assert.ok(exchangeRecovery.crafted.has('big-mining-drill'), 'paid hard-ore supplies recover lost volcanic stocks');
});

const luaBinary = [process.env.FLIGHT_LUA, 'lua5.2', 'lua', 'lua5.4', 'luajit'].filter(Boolean).find(binary => spawnSync(binary, ['-v'], {encoding: 'utf8'}).status === 0);
function runLua(body) {
  const result = spawnSync(luaBinary, ['-'], {input: body, encoding: 'utf8', cwd: root, timeout: 15_000});
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
}

test('Lua handlers preserve earned research, gate costs, recover specimens and survive reloads', {skip: !luaBinary && 'set FLIGHT_LUA to execute Lua behavioral harness'}, () => {
  runLua(`
local audit = ${lua(audit)}
storage = {flight = {sentinel = true}}
local created, tags, messages, blocked, tiles = {}, {}, {}, {}, {}
-- The map owner, not progression.lua, supplies the two valid wetland pads.
for _, area in ipairs(audit.starterSupplies.specimenPads.areas) do
  for x = area[1][1], area[2][1] do for y = area[1][2], area[2][2] do
    tiles[x .. "," .. y] = audit.starterSupplies.specimenPads.tile
  end end
end
local force = {index = 1, valid = true, technologies = {}}
force.print = function(message) messages[#messages + 1] = message end
force.add_chart_tag = function(_, tag) tags[#tags + 1] = tag; return {valid = true} end
local function technology(name)
  if not force.technologies[name] then
    force.technologies[name] = {name = name, valid = true, enabled = true, researched = false, prerequisites = {}, force = force, prototype = {}}
  end
  return force.technologies[name]
end
for _, row in ipairs(audit.triggers) do
  local t = technology(row.technology); t.prototype.research_trigger = row.trigger
  for _, name in ipairs(row.prerequisites) do t.prerequisites[name] = technology(name) end
end
for name in pairs(audit.installedFacts.nativeResearch) do technology(name) end
for _, row in ipairs(audit.exchange.offers) do technology(row.gate) end
local surface = {index = 1, valid = true}
surface.set_tiles = function() error("Map terrain is owned by the main scenario") end
surface.can_place_entity = function(p)
  if p.name == "iron-stromatolite" or p.name == "copper-stromatolite" then
    for x = -1, 0 do for y = -1, 0 do
      if tiles[(p.position[1] + x) .. "," .. (p.position[2] + y)] ~= audit.starterSupplies.specimenPads.tile then return false end
    end end
  end
  return not blocked[p.name]
end
surface.create_entity = function(p)
  assert(p.position[1] >= 224 and p.position[1] <= 258 and p.position[2] >= 98 and p.position[2] <= 148)
  local e = {name = p.name, position = p.position, force = p.force, valid = true, offers = {}}
  e.clear_market_items = function() e.offers = {} end
  e.add_market_item = function(offer) e.offers[#e.offers + 1] = offer end
  e.get_market_items = function() if #e.offers > 0 then return e.offers end end
  created[#created + 1] = e
  return e
end
game = {tick = 0, surfaces = {[1] = surface}, forces = {[1] = force}}
local progression = dofile(${lua(modulePath)})
progression.on_tick{tick = 300}; progression.on_research_finished{}
local state = progression.init(surface, force)
assert(storage.flight.sentinel and storage.flight_progression == state)
assert(#state.rocks == 80 and #created == 84 and #state.market.offers == 0)
assert(not state.market.minable_flag and not state.market.destructible and not state.capture_target)
for _, t in pairs(force.technologies) do assert(not t.researched, t.name) end
local before, tagCount = #created, #tags
assert(progression.init(surface, force) == state)
assert(#created == before and #tags == tagCount)
local function update() progression.on_tick{tick = 300} end
local function earned(name)
  technology(name).researched = true
  progression.on_research_finished{research = technology(name)}
end
local function available(item)
  for _, offer in ipairs(state.market.offers) do if offer.offer.item == item then return offer end end
end
local function unchangedNormal(action)
  local baseline = {}
  for name,t in pairs(force.technologies) do baseline[name] = t.researched end
  action()
  for name,t in pairs(force.technologies) do
    if name ~= "space-platform" and name ~= "space-science-pack" then assert(t.researched == baseline[name], "unexpected research: " .. name) end
  end
end
state.specimens["iron-stromatolite"].valid = false
earned("landfill"); update()
assert(not state.specimens["iron-stromatolite"].valid)
blocked["iron-stromatolite"] = true; earned("steel-processing"); update()
assert((not state.specimens["iron-stromatolite"] or not state.specimens["iron-stromatolite"].valid) and state.blocked_pads["iron-stromatolite"])
blocked["iron-stromatolite"] = nil; unchangedNormal(update)
assert(state.specimens["iron-stromatolite"].valid and not technology("agriculture").researched)
earned("agriculture"); state.specimens["iron-stromatolite"].valid = false; update()
assert(not state.specimens["iron-stromatolite"].valid, "stop free specimen replacement after trigger")
state.specimens["copper-stromatolite"].valid = false; earned("concrete")
assert(state.specimens["copper-stromatolite"].valid and not technology("heating-tower").researched)
earned("tungsten-carbide"); earned("calcite-processing")
assert(available("tungsten-ore") and available("calcite") and not technology("foundry").researched)
assert(not technology("recycling").researched and not available("pentapod-egg"))
earned("biochamber"); assert(available("pentapod-egg") and not available("biter-egg"))
-- A foreign-force research callback must not update this force's market.
technology("biochamber").researched = false
progression.on_research_finished{research = {valid = true, force = {index = 99}}}
assert(available("pentapod-egg")); update(); assert(not available("pentapod-egg"))
earned("biochamber")
-- Live added prerequisites and wrong trigger shapes fail closed.
technology("space-platform").prerequisites.extra = technology("extra")
earned("rocket-silo"); assert(not technology("space-platform").researched)
earned("extra"); assert(technology("space-platform").researched and technology("space-science-pack").researched)
assert(available("metallic-asteroid-chunk") and available("carbonic-asteroid-chunk") and available("oxide-asteroid-chunk"))
assert(not technology("construction-robotics").researched and not technology("logistic-robotics").researched)
technology("space-science-pack").researched = false
technology("space-science-pack").prototype.research_trigger.entity = "assembler"
update(); assert(not technology("space-science-pack").researched)
technology("space-science-pack").prototype.research_trigger.entity = {name = "asteroid-collector"}
technology("space-science-pack").enabled = false; update(); assert(not technology("space-science-pack").researched)
technology("space-science-pack").enabled = true; unchangedNormal(update)
assert(technology("space-science-pack").researched)
earned("captivity")
assert(state.capture_target and state.capture_target.force == "enemy" and state.capture_target.disabled_by_script)
assert(not technology("biter-egg-handling").researched and not available("biter-egg"))
state.capture_target.valid = false; update(); assert(state.capture_target.valid)
earned("biter-egg-handling"); state.capture_target.valid = false; update()
assert(not state.capture_target.valid and available("biter-egg"))
assert(not available("promethium-asteroid-chunk")); earned("promethium-science-pack")
assert(#state.market.offers == #audit.exchange.offers)
for _, expected in ipairs(audit.exchange.offers) do
  local actual = assert(available(expected.item))
  assert(actual.offer.type == "give-item" and actual.offer.count == expected.count and actual.offer.quality == expected.quality)
  assert(#actual.price == #expected.price)
  for i, price in ipairs(expected.price) do assert(actual.price[i].name == price.name and actual.price[i].count == price.count) end
end
-- Persisted LuaEntity refs work after module reload; lost market is rebuilt safely.
before = #created
progression = dofile(${lua(modulePath)}); progression.init(surface, force)
assert(#created == before and #state.rocks == 80)
state.market.valid = false; blocked.market = true; update(); assert(not state.market or not state.market.valid)
blocked.market = nil; update(); assert(state.market.valid and #state.market.offers == 8)
assert(#state.rocks == 80 and #created == before + 1)
technology("promethium-science-pack").researched = false; update(); assert(not available("promethium-asteroid-chunk"))
local previous = #created; progression.on_tick{tick = 301}; assert(#created == previous)
surface.valid = false; unchangedNormal(update); surface.valid = true
assert(not pcall(function() progression.init({index = 2, valid = true}, force) end))
assert(storage.flight.sentinel)
-- A fresh map with ordinary grass must fail generation, not silently omit a trigger.
storage.flight_progression = nil; tiles = {}
for _, t in pairs(force.technologies) do t.researched = false end
local ok, message = pcall(progression.init, surface, force)
assert(not ok and string.find(message, "required starter iron-stromatolite", 1, true), message)
print("LUA_PROGRESSION_BEHAVIOR_PASSED")
`);
});

test('native milestone helper loads dependencies at parse time and labels synthetic prerequisites', {skip: !luaBinary && 'set FLIGHT_LUA to parse native milestone helper'}, () => {
  assert.match(nativeAudit, /synthetic-native-api-milestones/);
  assert.match(nativeAudit, /native_production_proof = false/);
  runLua(`
local required = false
require = function(name) assert(name == "progression"); required = true; return {} end
local helper = assert(load(${lua(nativeAudit)}))()
assert(type(helper) == "function" and required, "Factorio requires dependencies during control.lua parsing")
storage = {flight_progression = {
  market = {valid = true, name = "market", minable_flag = false, destructible = false, get_market_items = function() return nil end},
  rocks = {}, specimens = {}
}}
for i = 1, 80 do storage.flight_progression.rocks[i] = {valid = true, name = "big-volcanic-rock"} end
for _, name in ipairs{"iron-stromatolite", "copper-stromatolite", "lithium-iceberg-big"} do
  local specimen = {valid = true, name = name}
  specimen.destroy = function() specimen.valid = false end
  storage.flight_progression.specimens[name] = specimen
end
require = function()
  return {on_tick = function() error("PASSED_NIL_EMPTY_MARKET_CHECKS") end}
end
helper = assert(load(${lua(nativeAudit)}))()
local ok, message = pcall(helper, {}, {technologies = {}})
assert(not ok and string.find(message, "PASSED_NIL_EMPTY_MARKET_CHECKS", 1, true), message)
`);
});
