// Native validation for the one-piece raw-input science factory.
//
// This is deliberately separate from early-game.mjs.  A science factory has
// six exterior raw ports, four continuously-collected outputs, and burner
// furnaces whose fuel source must be observed rather than filled by the test.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
import {starterConfigurationHash} from '../scripts/starter-verification.mjs';

const runFile = promisify(execFile);
const rawInputs = ['iron-ore', 'copper-ore', 'coal', 'stone', 'water', 'crude-oil'];
const products = [
  'automation-science-pack',
  'logistic-science-pack',
  'military-science-pack',
  'chemical-science-pack',
];
const rawSet = new Set(rawInputs);
const productSet = new Set(products);
const solidInputs = new Set(['iron-ore', 'copper-ore', 'coal', 'stone']);
const fluidInputs = new Set(['water', 'crude-oil']);
const beltNames = new Set(['fast-transport-belt', 'fast-underground-belt', 'fast-splitter']);
const forbiddenNames = /^(transport-belt|underground-belt|splitter|assembling-machine-[13]|burner-|electric-energy-interface|roboport|logistic-robot|construction-robot|beacon|loader|inserter-stack-size-|quality-module|speed-module|productivity-module|efficiency-module)/;
const requiredResearch = [
  'automation-2',
  'advanced-material-processing',
  'electric-energy-distribution-1',
  'logistics',
  'steel-processing',
  'oil-processing',
  'fluid-handling',
  'circuit-network',
];
const mapSeed = 12345;
const throughput = process.env.STARTER_BENCHMARK === '1';
// Negative native fixtures may deliberately exercise the full import/feed /
// power/report path while proving that a production failure is serialized as
// a report.  This opt-in only changes the process exit for that fixture; the
// normal test and benchmark commands still require a passing build.
const expectFailure = process.env.STARTER_EXPECT_FAILURE === '1';
const minutes = Number(process.env.SIMULATED_MINUTES || 45);
const warmupMinutes = throughput ? Number(process.env.WARMUP_MINUTES || 15) : 0;
const ticks = minutes * 3600;
const warmupTicks = warmupMinutes * 3600;
const root = path.resolve(process.env.STARTER_TEST_ROOT || '.cache/science-factory/privateisolated');
const mods = path.join(root, 'mods');
const mod = path.join(mods, 'science_factory_test');
const reportFile = throughput ? 'throughput.json' : 'validation.json';
const sourceRoot = path.resolve(process.env.STARTER_SOURCE_ROOT || 'blueprint-sources/science-factories');
const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');

assert.ok(Number.isInteger(minutes) && minutes > warmupMinutes, 'Science test duration must exceed warmup');
assert.equal(minutes, 45, 'Science factory evidence is intentionally fixed at 45 minutes');
assert.equal(warmupMinutes, throughput ? 15 : 0, 'Science benchmark warmup must be 15 minutes');

function manifestEntries(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.builds)) return value.builds;
  if (Array.isArray(value?.entries)) return value.entries;
  if (value && typeof value === 'object' && value.id) return [value];
  throw new Error('Science manifest must be an array, {builds:[]}, {entries:[]}, or one manifest entry');
}

function itemQuality(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.name || value.quality || 'normal';
  return 'normal';
}

function entityItems(entity) {
  const result = [];
  if (Array.isArray(entity.items)) {
    for (const request of entity.items) {
      const id = request?.id?.name || request?.id;
      if (id) result.push({id, quality: itemQuality(request?.id?.quality || request?.quality)});
      for (const slot of request?.items?.in_inventory || []) {
        if (slot?.id) result.push({id: slot.id, quality: itemQuality(slot.quality)});
      }
    }
  } else if (entity.items && typeof entity.items === 'object') {
    for (const [id, count] of Object.entries(entity.items)) if (count) result.push({id, quality: 'normal'});
  }
  return result;
}

function materialCounts(entities) {
  const counts = {};
  for (const entity of entities) {
    counts[entity.name] = (counts[entity.name] || 0) + 1;
    for (const item of entityItems(entity)) counts[item.id] = (counts[item.id] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function bounds(entities) {
  const xs = entities.map(e => e.position.x);
  const ys = entities.map(e => e.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return {minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1};
}

function staticValidate(entry, entities) {
  const rejectionReasons = [];
  const reject = message => rejectionReasons.push(message);
  const byNumber = new Map(entities.map(e => [e.entity_number, e]));
  const ports = Array.isArray(entry.ports) ? entry.ports : [];
  const rawPorts = ports.filter(p => p.kind === 'input' || p.kind === 'fluid');
  const powerPorts = ports.filter(p => p.kind === 'power');
  const outputPorts = ports.filter(p => p.kind === 'output');

  if (entry.scienceFactory !== true) reject('scienceFactory:true is required');
  if (entry.rawOnly !== true) reject('rawOnly:true is required');
  if (Number(entry.targetPerMinute || 0) !== 30) reject('targetPerMinute must be 30');
  const electric = entry.fuelPolicy?.furnaceFuel === 'electricity';
  const furnaceName = electric ? 'electric-furnace' : 'steel-furnace';
  if (!['solid-fuel', 'electricity'].includes(entry.fuelPolicy?.furnaceFuel)) reject('fuelPolicy.furnaceFuel must be solid-fuel or electricity');
  if (electric && !entry.researchClosure?.includes('advanced-material-processing-2')) reject('electric furnaces require advanced-material-processing-2');
  if (JSON.stringify(entry.products || []) !== JSON.stringify(products)) reject('products must be the four ordered science packs');
  if (JSON.stringify([...(entry.rawInputs || [])].sort()) !== JSON.stringify([...rawInputs].sort())) reject('rawInputs must be exactly the six declared raw inputs');
  if (rawPorts.length !== rawInputs.length) reject('there must be exactly six raw input ports');
  if (powerPorts.length !== 1) reject('there must be exactly one power port');
  if (outputPorts.length !== products.length) reject('there must be exactly four output ports');
  if (entry.powerNetwork?.connection !== 'big-electric-pole' || entry.powerNetwork?.externalOnly !== true) reject('powerNetwork must name an external big-electric-pole connection');
  if (!Array.isArray(entry.researchClosure) || !entry.researchClosure.length) reject('researchClosure is required');
  for (const id of requiredResearch) if (!entry.researchClosure.includes(id)) reject(`researchClosure missing ${id}`);

  const rawNames = new Set();
  for (const port of rawPorts) {
    const item = port.items?.length === 1 ? port.items[0] : undefined;
    if (!rawSet.has(item)) reject(`raw port ${port.entity} has undeclared item ${item}`);
    if (rawNames.has(item)) reject(`raw input ${item} is declared more than once`);
    rawNames.add(item);
    if (port.externalSide !== 'west') reject(`raw port ${item} is not west-facing`);
    if (port.kind === 'input' && !solidInputs.has(item)) reject(`${item} must use kind input`);
    if (port.kind === 'fluid' && !fluidInputs.has(item)) reject(`${item} must use kind fluid`);
    if (!Number.isInteger(port.entity) || !byNumber.has(port.entity)) reject(`raw port ${item} does not reference a saved entity`);
    if (!Number.isInteger(port.displayEntity) || !byNumber.has(port.displayEntity)) reject(`raw port ${item} is missing its input display`);
  }
  for (const item of rawInputs) if (!rawNames.has(item)) reject(`raw input ${item} has no port`);
  const power = powerPorts[0];
  if (power && (power.items?.length || power.entity === undefined || byNumber.get(power.entity)?.name !== 'big-electric-pole')) reject('power port must reference a saved big-electric-pole with no item');
  const outputIndexes = new Set();
  for (const port of outputPorts) {
    const product = port.items?.length === 1 ? port.items[0] : undefined;
    if (!productSet.has(product)) reject(`output port has undeclared product ${product}`);
    if (outputIndexes.has(port.index)) reject(`duplicate output port index ${port.index}`);
    outputIndexes.add(port.index);
    if (!Number.isInteger(port.index) || port.index < 1 || port.index > 4) reject(`output ${product} must have index 1..4`);
    if (!Number.isInteger(port.entity) || !byNumber.has(port.entity)) reject(`output ${product} does not reference a saved chest`);
    const chest = byNumber.get(port.entity);
    if (!chest || !['wooden-chest', 'iron-chest', 'steel-chest', 'buffer-chest', 'logistic-chest-passive'].includes(chest.name)) reject(`output ${product} must reference a chest`);
    if (chest?.tags?.science_output && chest.tags.science_output !== product) reject(`output ${product} chest tag disagrees`);
    if (port.externalSide !== 'east') reject(`output ${product} must declare east-facing externalSide`);
  }
  const productByIndex = [...outputPorts].sort((a, b) => a.index - b.index).map(p => p.items?.[0]);
  if (JSON.stringify(productByIndex) !== JSON.stringify(products)) reject('output indexes must follow products order');

  for (const entity of entities) {
    if (!entity.tags?.starter_entity) reject(`entity ${entity.entity_number} has no starter_entity tag`);
    if (forbiddenNames.test(entity.name)) reject(`forbidden entity ${entity.name}`);
    if (/(?:transport-belt|underground-belt|splitter)$/.test(entity.name) && !beltNames.has(entity.name)) reject(`transport entity must use the fast tier: ${entity.name}`);
    if (entity.name === 'assembling-machine-2' && entity.recipe === undefined) reject(`AM2 ${entity.entity_number} has no saved recipe`);
    if (entity.name !== 'assembling-machine-2' && entity.name.startsWith('assembling-machine-')) reject(`wrong assembling machine ${entity.name}`);
    if (entity.name !== furnaceName && entity.name.includes('furnace')) reject(`wrong furnace ${entity.name}`);
    if (entity.quality && itemQuality(entity.quality) !== 'normal') reject(`quality request on ${entity.name}`);
    for (const item of entityItems(entity)) {
      if (item.quality !== 'normal') reject(`quality item request ${item.id}`);
      if (/module|robot|beacon|quality/i.test(item.id)) reject(`forbidden module/robot request ${item.id}`);
    }
    if (entity.tags?.hidden_source || entity.tags?.source_entity || entity.tags?.direct_input) reject(`hidden/direct source tag on ${entity.name}`);
  }
  const machineCount = entities.filter(e => ['assembling-machine-2','steel-furnace','electric-furnace','chemical-plant','oil-refinery'].includes(e.name)).length;
  if (entry.machineCount !== undefined && Number(entry.machineCount) !== machineCount) reject(`machineCount ${entry.machineCount} disagrees with blueprint ${machineCount}`);
  if (machineCount === 0) reject('blueprint contains no production machines');
  const furnaceCount = entities.filter(e => e.name === furnaceName).length;
  const assemblerCount = entities.filter(e => e.name === 'assembling-machine-2').length;
  if (furnaceCount === 0) reject('blueprint contains no '+furnaceName);
  if (assemblerCount === 0) reject('blueprint contains no assembling-machine-2');

  const rawX = rawPorts.map(p => byNumber.get(p.entity)?.position.x ?? p.x).filter(Number.isFinite);
  const outputX = outputPorts.map(p => byNumber.get(p.entity)?.position.x ?? p.x).filter(Number.isFinite);
  if (new Set(rawX).size !== 1) reject('all raw entrances must share one west edge');
  if (new Set(outputX).size !== 1) reject('all output chests must share one east edge');
  if (rawX.length && outputX.length && Math.min(...outputX) <= Math.max(...rawX)) reject('all output chests must be east of every raw input port');
  const displays = new Map();
  for (const entity of entities.filter(e => e.name === 'display-panel')) {
    if (entity.tags?.input_display !== undefined) displays.set(entity.tags.input_display, entity);
  }
  for (const port of rawPorts) {
    const display = byNumber.get(port.displayEntity);
    if (!display || display.name !== 'display-panel' || display.tags?.input_display !== port.entity) reject(`input display for ${port.items?.[0]} is not paired with its port`);
    if (display?.icon?.name !== port.items?.[0]) reject(`input display icon mismatch for ${port.items?.[0]}`);
    if (display && display.always_show !== true) reject(`input display for ${port.items?.[0]} must always show`);
    if (display && display.show_in_chart === true) reject(`input display for ${port.items?.[0]} must not show in chart`);
    if (display?.control_behavior) reject(`input display for ${port.items?.[0]} has control behavior`);
  }
  if (entry.inputDisplays?.requiredTechnology && entry.inputDisplays.requiredTechnology !== 'circuit-network') reject('input display technology must be circuit-network');
  const displayCount = [...displays.keys()].length;
  if (displayCount !== rawPorts.length) reject(`expected ${rawPorts.length} input displays, found ${displayCount}`);

  return {
    rejectionReasons,
    machineCount,
    furnaceCount,
    assemblerCount,
    dimensions: bounds(entities),
    entityCount: entities.length,
    materialCounts: materialCounts(entities),
    ports,
    byNumber,
  };
}

const manifestValue = JSON.parse(await fs.readFile(path.join(sourceRoot, 'manifest.json'), 'utf8'));
const allEntries = manifestEntries(manifestValue);
const selectedIds = (process.env.STARTER_TEST_IDS || process.env.SCIENCE_FACTORY_ID || '').split(',').filter(Boolean);
const builds = allEntries.filter(entry => !selectedIds.length || selectedIds.includes(entry.id));
assert.equal(builds.length, 1, `Science runner requires one selected manifest entry; found ${builds.length}`);
const build = builds[0];
assert.match(build.id, /^[a-z0-9-]+$/, 'science factory manifest id must be a safe slug');
build.code = (await fs.readFile(path.join(sourceRoot, build.file), 'utf8')).trim();
const decoded = decodeBlueprint(build.code);
assert.ok(decoded?.blueprint, 'science factory source must be a blueprint string');
build.entities = decoded.blueprint.entities || [];
const staticInfo = staticValidate(build, build.entities);
const mapHalfX = Math.ceil(Math.max(staticInfo.dimensions.width / 2 + 64, Math.abs(staticInfo.dimensions.minX) + 32, Math.abs(staticInfo.dimensions.maxX) + 32) / 32) * 32;
const mapHalfY = Math.ceil(Math.max(staticInfo.dimensions.height / 2 + 64, Math.abs(staticInfo.dimensions.minY) + 32, Math.abs(staticInfo.dimensions.maxY) + 32) / 32) * 32;
build.blueprintSha256 = createHash('sha256').update(build.code).digest('hex');
build.portConfigurationSha256 = starterConfigurationHash(build);
build.forceKey = 'science-' + build.portConfigurationSha256.slice(0, 10);
build.rateInputs = rawInputs.map(name => ({name, kind: fluidInputs.has(name) ? 'fluid' : 'item'}));
build.static = {
  blueprintSha256: build.blueprintSha256,
  portConfigurationSha256: build.portConfigurationSha256,
  dimensions: staticInfo.dimensions,
  entityCount: staticInfo.entityCount,
  machineCount: staticInfo.machineCount,
  furnaceCount: staticInfo.furnaceCount,
  assemblerCount: staticInfo.assemblerCount,
  materialCounts: staticInfo.materialCounts,
};
if (staticInfo.rejectionReasons.length) {
  await fs.mkdir(root, {recursive: true});
  await fs.writeFile(path.join(root, 'static-rejection.json'), JSON.stringify({id: build.id, ...build.static, rejectionReasons: staticInfo.rejectionReasons}, null, 2) + '\n');
  throw new Error('Science factory static validation failed: ' + staticInfo.rejectionReasons.join('; '));
}

await fs.mkdir(mod, {recursive: true});
await fs.rm(path.join(root, reportFile), {force: true});
await fs.rm(path.join(root, 'script-output', reportFile), {force: true});
await fs.writeFile(path.join(root, 'map-gen-settings.json'), JSON.stringify({seed: mapSeed}));
await fs.writeFile(path.join(root, 'config.ini'), `[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n`);
await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({mods: ['base', 'quality', 'elevated-rails', 'space-age', 'science_factory_test'].map(name => ({name, enabled: true}))}));
await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({
  name: 'science_factory_test', version: '1.0.0', title: 'Raw science factory native validation', author: 'local', factorio_version: '2.0', dependencies: ['base >= 2.0.77', 'space-age'],
}));

const luaBuild = JSON.stringify({
  id: build.id,
  code: build.code,
  entities: build.entities,
  ports: build.ports,
  products: build.products,
  rawInputs: build.rawInputs,
  rateInputs: build.rateInputs,
  researchClosure: build.researchClosure,
  forceKey: build.forceKey,
  blueprintSha256: build.blueprintSha256,
  portConfigurationSha256: build.portConfigurationSha256,
  targetPerMinute: build.targetPerMinute,
  fuelPolicy: build.fuelPolicy,
  static: build.static,
});
const luaString = JSON.stringify(luaBuild).replace(/\\/g, '\\\\').replace(/`/g, '\\`');

await fs.writeFile(path.join(mod, 'control.lua'), `
local b=helpers.json_to_table([==[${luaBuild}]==])
local minutes=${minutes}
local ticks=${ticks}
local warmup_ticks=${warmupTicks}
local throughput=${throughput?'true':'false'}
local products={}
for _,name in pairs(b.products)do products[name]=true end
local raw={}
for _,name in pairs(b.rawInputs)do raw[name]=true end
local function check(ok,msg)if not ok then error('SCIENCE_FACTORY_TEST: '..msg)end end
local function status_name(e)
 for k,v in pairs(defines.entity_status)do if v==e.status then return k end end
 return 'unknown'
end
local function pos(x,y)return {x=x,y=y}end
local function contents(inv)
 if not inv then return {} end
 local result={};for _,stack in pairs(inv.get_contents())do result[stack.name]=(result[stack.name] or 0)+stack.count end;return result
end
local function add_counts(dst,src)
 for name,count in pairs(src or {})do dst[name]=(dst[name] or 0)+count end
end
local function production_snapshot(force,surface)
 local item_statistics=force.get_item_production_statistics(surface)
 local fluid_statistics=force.get_fluid_production_statistics(surface)
 return {items=item_statistics.output_counts,fluids=fluid_statistics.output_counts}
end
local function production_count(snapshot,input)
 local counts=input.kind=='fluid' and snapshot.fluids or snapshot.items
 return counts[input.name] or 0
end
local function place_power_fixture(surface,t,pole)
 local candidates={}
 for dx=-2,2 do for dy=-2,2 do
  if math.abs(dx)+math.abs(dy)>0 then candidates[#candidates+1]={dx=dx,dy=dy,distance=dx*dx+dy*dy} end
 end end
 table.sort(candidates,function(a,b)return a.distance<b.distance end)
 for _,delta in ipairs(candidates)do
  local p=pos(pole.position.x+delta.dx,pole.position.y+delta.dy)
  if surface.can_place_entity{name='electric-energy-interface',position=p,force=t.force} then
   local fixture=surface.create_entity{name='electric-energy-interface',position=p,force=t.force}
   fixture.electric_buffer_size=1000000000
   fixture.power_production=1000000000
   fixture.power_usage=0
   if fixture.electric_network_id==pole.electric_network_id then
    t.powerFixture=fixture
    return
   end
   fixture.destroy()
  end
 end
 error('No room for external electric fixture beside saved big pole')
end
local function place_fluid_fixture(surface,t,p)
 local base=pos(p.x+t.dx,p.y+t.dy)
 local candidates={
  pos(base.x-1,base.y),pos(base.x-1,base.y-1),pos(base.x-1,base.y+1),
  pos(base.x,base.y-1),pos(base.x,base.y+1),pos(base.x+1,base.y),
 }
 for _,candidate in pairs(candidates)do
  if surface.can_place_entity{name='infinity-pipe',position=candidate,force=t.force} then
   local fixture=surface.create_entity{name='infinity-pipe',position=candidate,force=t.force}
   local fluid=p.items[1]
   fixture.set_infinity_pipe_filter{name=fluid,percentage=1,mode='at-least',temperature=prototypes.fluid[fluid].default_temperature}
   t.fluidFixtures[p.entity]={entity=fixture,fluid=fluid,samples=0}
   return
  end
 end
 error('No room for infinity-pipe at raw fluid port '..tostring(p.items[1]))
end
local function inspect_furnace(t,id,e)
 local row=t.fuel[id]
 local fuel=contents(e.get_fuel_inventory())
 if e.name=='electric-furnace' and e.energy>0 then row.electricPoweredSeconds=row.electricPoweredSeconds+1 end
 local source=contents(e.get_inventory(defines.inventory.furnace_source))
 add_counts(row.inventorySamples,fuel)
 add_counts(row.sourceSamples,source)
 for name,count in pairs(fuel)do
  if name~='solid-fuel' then row.nonSolidFuel[name]=(row.nonSolidFuel[name] or 0)+count end
 end
 for name,count in pairs(source)do
  if name~='iron-ore' and name~='copper-ore' and name~='stone' and name~='iron-plate' then row.nonRawSource[name]=(row.nonRawSource[name] or 0)+count end
 end
 local burner=e.burner
 local burning=burner and burner.currently_burning
 local name=burning and burning.name or nil
 if name and type(name)~='string' then name=name.name end
 if name then
  row.burning[name]=(row.burning[name] or 0)+1
  if name=='solid-fuel' then row.solidFuelBurnSeconds=row.solidFuelBurnSeconds+1 else row.nonSolidBurn[name]=(row.nonSolidBurn[name] or 0)+1 end
 end
 row.remainingBurningFuel=burner and burner.remaining_burning_fuel or 0
end
script.on_init(function()
 storage.t={}
 local force=game.forces[b.forceKey] or game.create_force(b.forceKey)
 storage.force=force
 for _,id in pairs(b.researchClosure or {})do
  local technology=force.technologies[id]
  check(technology~=nil,'missing research prototype '..tostring(id))
  technology.researched=true
 end
 for _,id in pairs(b.researchClosure or {})do check(force.technologies[id].researched,'research not enabled '..id)end
 local surface=game.create_surface('science-factory',{seed=${mapSeed},width=${mapHalfX*2},height=${mapHalfY*2},default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
 storage.surface=surface
 surface.request_to_generate_chunks({0,0},${Math.ceil(Math.max(mapHalfX,mapHalfY)/32)});surface.force_generate_chunk_requests()
 local clear=surface.find_entities();for _,e in pairs(clear)do e.destroy()end
 local tiles={};for x=-${mapHalfX},${mapHalfX-1} do for y=-${mapHalfY},${mapHalfY-1} do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;surface.set_tiles(tiles)
 local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(b.code)==0,'blueprint import')
 local ghosts=inv[1].build_blueprint{surface=surface,force=force,position={0,0},build_mode=defines.build_mode.forced}
 check(#ghosts==#b.entities,'placement '..#ghosts..'/'..#b.entities)
 local t={entities={},force=force,surface=surface,ports={},outputs={},fluidFixtures={},furnaces={},machineSamples={},warmupProducts={},collected={},warmupCollected={},delivered={},fed={},fluidSamples={},firstProductTicks={},drainedPorts={},restartedPorts={},rejections={},inputDisplays={verified=0,total=0},power={connected=false},research={closure=b.researchClosure,enabled=true},fuel={},warmupStats=nil}
 storage.t=t
 for _,ghost in pairs(ghosts)do
  local id=ghost.tags and ghost.tags.starter_entity
  check(id~=nil,'ghost without starter_entity tag')
  local _,entity=ghost.revive{raise_revive=true};check(entity~=nil,'revive '..tostring(id));t.entities[id]=entity
 end
 local first=b.entities[1];local firstActual=t.entities[first.entity_number];check(firstActual~=nil,'first entity missing');t.dx=firstActual.position.x-first.position.x;t.dy=firstActual.position.y-first.position.y
 for _,saved in pairs(b.entities)do
  local actual=t.entities[saved.entity_number]
  check(actual~=nil,'entity missing #'..saved.entity_number)
  check(actual.name==saved.name,'changed entity '..saved.name..' #'..saved.entity_number)
  check(actual.position.x==saved.position.x+t.dx and actual.position.y==saved.position.y+t.dy,'shifted layout #'..saved.entity_number..' actual '..tostring(actual.position.x)..','..tostring(actual.position.y)..' expected '..tostring(saved.position.x+t.dx)..','..tostring(saved.position.y+t.dy))
  check(actual.direction==(saved.direction or 0),'changed direction #'..saved.entity_number)
  if saved.recipe then check(actual.get_recipe() and actual.get_recipe().name==saved.recipe,'recipe '..saved.recipe..' #'..saved.entity_number)end
  if actual.type=='inserter' and saved.use_filters then
   check(actual.use_filters,'inserter filters disabled #'..saved.entity_number)
   check(actual.inserter_filter_mode==(saved.filter_mode or 'whitelist'),'inserter filter mode #'..saved.entity_number)
   for _,filter in pairs(saved.filters or {})do
    local imported=actual.get_filter(filter.index)
    check(imported and imported.name==filter.name,'inserter item filter #'..saved.entity_number..' slot '..filter.index)
   end
  end
  local control=saved.control_behavior
  if control and (control.circuit_enabled~=nil or control.circuit_enable_disable~=nil) then
   local behavior=actual.get_control_behavior()
   local enabled=control.circuit_enabled;if enabled==nil then enabled=control.circuit_enable_disable end
   check(behavior and behavior.circuit_enable_disable==enabled,'circuit enable setting #'..saved.entity_number)
   if control.circuit_condition then
    local condition=behavior.circuit_condition
    check(condition and condition.comparator==control.circuit_condition.comparator and condition.constant==control.circuit_condition.constant,'circuit condition #'..saved.entity_number)
    check(condition.first_signal and condition.first_signal.name==control.circuit_condition.first_signal.name,'circuit input signal #'..saved.entity_number)
   end
  end
  if actual.type=='transport-belt' and control and control.circuit_read_hand_contents then
   local behavior=actual.get_control_behavior()
   check(behavior and behavior.read_contents,'belt reader #'..saved.entity_number)
   check(behavior.read_contents_mode==control.circuit_contents_read_mode,'belt read mode #'..saved.entity_number)
  end
  if actual.type=='arithmetic-combinator' and control and control.arithmetic_conditions then
   local parameters=actual.get_control_behavior().parameters
   check(parameters.operation==control.arithmetic_conditions.operation and parameters.second_constant==control.arithmetic_conditions.second_constant,'clock operation #'..saved.entity_number)
  end
  if saved.name=='display-panel' then
   local icon=actual.display_panel_icon
   check(icon and icon.name==saved.icon.name and (icon.type or 'item')==(saved.icon.type or 'item'),'input display icon #'..saved.entity_number)
   check(actual.display_panel_text==saved.text,'input display text #'..saved.entity_number)
   check(actual.display_panel_always_show,'input display Alt mode #'..saved.entity_number)
   check(not actual.display_panel_show_in_chart,'input display chart flag #'..saved.entity_number)
   local behavior=actual.get_control_behavior()
   check(not behavior or #behavior.messages==0,'input display circuit behavior #'..saved.entity_number)
  end
  if actual.type=='furnace' then
   local id=saved.entity_number;t.furnaces[id]={id=id,entity=actual,inventorySamples={},sourceSamples={},burning={},nonSolidFuel={},nonSolidBurn={},nonRawSource={},solidFuelBurnSeconds=0,electricPoweredSeconds=0,remainingBurningFuel=0}
   t.fuel[id]=t.furnaces[id]
  end
  if actual.type=='assembling-machine' or actual.type=='furnace' then
   t.machineSamples[saved.entity_number]={}
   if actual.type=='assembling-machine' or actual.type=='furnace' then t.warmupProducts[saved.entity_number]=0 end
  end
 end
 for _,p in pairs(b.ports)do
  local actual=t.entities[p.entity];check(actual~=nil,'port entity missing '..tostring(p.entity))
  t.ports[p.entity]=p
  if p.kind=='power' then check(actual.name=='big-electric-pole','power port is not big-electric-pole');t.powerPort=actual end
  if p.kind=='output' then t.outputs[p.entity]={port=p,entity=actual,count=0};check(actual.type=='container','output is not a container '..tostring(p.items[1]))end
  if p.kind=='input' then t.fed[p.items[1]]=0 end
  if p.kind=='fluid' then t.fluidSamples[p.items[1]]=0;place_fluid_fixture(surface,t,p)end
  if p.displayEntity then t.inputDisplays.total=t.inputDisplays.total+1 end
 end
 check(t.powerPort~=nil,'missing saved P big pole')
 place_power_fixture(surface,t,t.powerPort)
 check(t.powerFixture~=nil,'missing external electric fixture')
 for _,id in pairs(b.researchClosure or {})do check(force.technologies[id].researched,'research closure check '..id)end
 check(force.technologies['circuit-network'].researched,'circuit-network is required for input displays')
 for _,saved in pairs(b.entities)do
  local actual=t.entities[saved.entity_number]
  local crafting=actual.type=='assembling-machine' or actual.type=='furnace'
  local recipe=crafting and actual.get_recipe()
  if recipe then check(force.recipes[recipe.name] and force.recipes[recipe.name].enabled,'locked saved recipe '..recipe.name)end
  local construction=force.recipes[actual.name]
  if construction then check(construction.enabled,'locked saved construction '..actual.name)end
 end
 -- There must be no hidden map entities or untracked direct-input fixtures.
 local expected={};for _,e in pairs(t.entities)do expected[e.unit_number]=true end;expected[t.powerFixture.unit_number]=true
 for _,row in pairs(t.fluidFixtures)do expected[row.entity.unit_number]=true end
 for _,e in pairs(surface.find_entities())do check(expected[e.unit_number]~=nil,'unexpected non-blueprint entity '..e.name)end
 inv.destroy()
end)
-- Every solid raw port is fed on both lanes.  Fluid infinity pipes are the
-- only fluid source; no ingredient is ever inserted into machine inventories.
script.on_nth_tick(4,function()
 local t=storage.t;if not t then return end
 for _,p in pairs(b.ports)do if p.kind=='input' then
  local e=t.entities[p.entity]
  for lane=1,2 do
   local accepted=e.get_transport_line(lane).insert_at_back{name=p.items[1],count=1}
   if accepted then t.fed[p.items[1]]=t.fed[p.items[1]]+1 end
  end
 end end
end)
script.on_nth_tick(60,function()
 local t=storage.t;if not t then return end
 if game.tick==60 then
  local network=t.powerPort.electric_network_id
  check(network~=nil,'saved P has no electric network')
  check(t.powerFixture.electric_network_id==network,'external fixture is not attached to saved P network')
  t.power.networkId=network;t.power.fixtureAttached=true
  for _,e in pairs(t.entities)do
   if e.type=='electric-pole' then
    check(e.name=='big-electric-pole' or e.name=='medium-electric-pole','wrong pole tier '..e.name)
    check(e.electric_network_id==network,'disconnected pole '..e.name)
    if e.name=='big-electric-pole' then t.power.bigPoles=(t.power.bigPoles or 0)+1 else t.power.mediumPoles=(t.power.mediumPoles or 0)+1 end
   elseif e.type=='assembling-machine' or e.type=='inserter' or e.type=='pump' or e.name=='electric-furnace' then
    check(e.is_connected_to_electric_network() and e.electric_network_id==network,'unpowered consumer '..e.name..' #'..tostring(e.unit_number)..' at '..tostring(e.position.x)..','..tostring(e.position.y)..' network '..tostring(e.electric_network_id)..' expected '..tostring(network))
    t.power.connectedConsumers=(t.power.connectedConsumers or 0)+1
   end
  end
  t.power.connected=true
  for _,p in pairs(b.ports)do if p.displayEntity then
   local d=t.entities[p.displayEntity];check(d and d.name=='display-panel','missing input panel');t.inputDisplays.verified=t.inputDisplays.verified+1
  end end
 end
 for _,row in pairs(t.fluidFixtures)do
  local amount=row.entity.get_fluid_count(row.fluid);if amount>0 then row.samples=row.samples+1;t.fluidSamples[row.fluid]=t.fluidSamples[row.fluid]+1 end
 end
 for id,e in pairs(t.entities)do
  if e.type=='assembling-machine' or e.type=='furnace' then
   local name=status_name(e);local sample=t.machineSamples[id];sample[name]=(sample[name] or 0)+1
   if game.tick==warmup_ticks then t.warmupProducts[id]=e.products_finished end
   if e.type=='furnace' then inspect_furnace(t,id,e)end
  end
 end
 if throughput and game.tick==warmup_ticks then t.warmupStats=production_snapshot(t.force,t.surface) end
 if not throughput and game.tick==math.floor(ticks/2) then
  for id,row in pairs(t.outputs)do
   local n=0;for _,item in pairs(row.port.items)do n=n+row.entity.get_item_count(item)end
   row.entity.clear_items_inside();row.count=n;t.drainedPorts[id]=n
  end
 end
 for id,row in pairs(t.outputs)do
  local p=row.port
  for _,item in pairs(p.items)do
   local n=row.entity.get_item_count(item)
   if n>0 and not t.firstProductTicks[item] then t.firstProductTicks[item]=game.tick end
   if not throughput and game.tick>math.floor(ticks/2) and n>0 and t.drainedPorts[id] and not t.restartedPorts[id] then t.restartedPorts[id]=true end
   if throughput then
    local group=game.tick>warmup_ticks and t.collected or t.warmupCollected
    group[item]=(group[item] or 0)+n
    if n>0 then row.entity.remove_item{name=item,count=n};t.delivered[item]=(t.delivered[item] or 0)+n end
   else
    t.delivered[item]=math.max(t.delivered[item] or 0,n)
    row.count=math.max(row.count,n)
   end
  end
 end
 if game.tick%36000==0 then log('SCIENCE_FACTORY_PROGRESS: '..(game.tick/3600)..' simulated minutes')end
 if game.tick==ticks then
  local report={gameVersion=script.active_mods.base,mapSeed=${mapSeed},simulatedMinutes=minutes,mode=throughput and 'throughput' or 'functional',warmupMinutes=${warmupMinutes},measuredMinutes=${minutes-warmupMinutes},targetPerMinute=b.targetPerMinute,builds={}}
  local electric=b.fuelPolicy.furnaceFuel=='electricity';local allFurnacesPowered=true
  local passed=true;local machines={};local fuelRows={};local solidFuelProduced=0;local rawCoalUsers={};local allFurnacesCrafted=true;local allFurnacesBurnedSolidFuel=true
  for id,e in pairs(t.entities)do
   if e.type=='assembling-machine' or e.type=='furnace' then
    local recipe=e.get_recipe();local row={blueprintEntity=id,entity=e.unit_number,name=e.name,recipe=recipe and recipe.name or nil,position=e.position,status=status_name(e),statusSeconds=t.machineSamples[id],productsFinished=e.products_finished,inventory=contents(e.get_inventory(e.type=='furnace' and defines.inventory.furnace_source or defines.inventory.assembling_machine_input))}
    if throughput then row.warmupCrafts=t.warmupProducts[id] or 0;row.measuredCrafts=e.products_finished-(t.warmupProducts[id] or 0)end
    if e.type=='assembling-machine' then
     local recipeName=recipe and recipe.name or ''
     if recipeName=='solid-fuel-from-petroleum-gas' or recipeName=='solid-fuel-from-light-oil' or recipeName=='solid-fuel-from-heavy-oil' then solidFuelProduced=solidFuelProduced+e.products_finished end
     if recipeName=='grenade' or recipeName=='plastic-bar' then rawCoalUsers[#rawCoalUsers+1]={blueprintEntity=id,recipe=recipeName,productsFinished=e.products_finished}end
    end
    if e.products_finished==0 then passed=false;if e.type=='furnace' then allFurnacesCrafted=false end end
    machines[#machines+1]=row
   end
  end
  for id,row in pairs(t.fuel)do
   local entry={blueprintEntity=id,name=row.entity.name,electricPoweredSeconds=row.electricPoweredSeconds,inventorySamples=row.inventorySamples,sourceSamples=row.sourceSamples,burning=row.burning,nonSolidFuel=row.nonSolidFuel,nonSolidBurn=row.nonSolidBurn,nonRawSource=row.nonRawSource,solidFuelBurnSeconds=row.solidFuelBurnSeconds,remainingBurningFuel=row.remainingBurningFuel}
   fuelRows[#fuelRows+1]=entry
   if electric then
    if row.entity.name~='electric-furnace' or row.electricPoweredSeconds==0 or next(row.burning)~=nil or next(row.inventorySamples)~=nil or next(row.nonRawSource)~=nil then passed=false;allFurnacesPowered=false end
   elseif row.solidFuelBurnSeconds==0 or next(row.nonSolidFuel)~=nil or next(row.nonSolidBurn)~=nil or next(row.nonRawSource)~=nil then passed=false;allFurnacesBurnedSolidFuel=false end
  end
  local outputCounts={};local restarted=true
  for id,row in pairs(t.outputs)do outputCounts[row.port.items[1]]=row.count;if not throughput and (t.drainedPorts[id] or 0)==0 then passed=false end;if not throughput and not t.restartedPorts[id] then restarted=false;passed=false end end
  if not throughput then for _,item in pairs(b.products)do if not t.firstProductTicks[item] then passed=false end end end
  local perMinute={};local inputPerMinute={};local inputCounts={};local threshold=(b.targetPerMinute or 30)-0.2
  if throughput then
   for _,item in pairs(b.products)do perMinute[item]=(t.collected[item] or 0)/${minutes-warmupMinutes};if perMinute[item]<threshold then passed=false end end
   local finalStats=production_snapshot(t.force,t.surface)
   for _,input in pairs(b.rateInputs or {})do
    local consumed=production_count(finalStats,input)-production_count(t.warmupStats or {items={},fluids={}},input);if consumed<0 then consumed=0 end
    inputCounts[input.name]=consumed;inputPerMinute[input.name]=consumed/${minutes-warmupMinutes}
   end
  end
  for _,item in pairs(b.products)do if (t.delivered[item] or 0)==0 then passed=false end end
  if t.inputDisplays.verified~=t.inputDisplays.total or t.inputDisplays.total~=#b.rawInputs then passed=false end
  if not t.power.connected then passed=false end
  local fluidNetworks={};for _,p in pairs(b.ports)do if p.kind=='fluid' then local row=t.fluidFixtures[p.entity];fluidNetworks[p.items[1]]={samples=row.samples,fixture=row.entity.position};if row.samples==0 then passed=false end end end
  if not electric and solidFuelProduced==0 then passed=false end
  local fuel={policy=electric and 'electric-only' or 'solid-fuel-only',furnaceFuel=b.fuelPolicy.furnaceFuel,allFurnacesPowered=allFurnacesPowered,furnaces=fuelRows,allFurnacesCrafted=allFurnacesCrafted,allFurnacesBurnedSolidFuel=allFurnacesBurnedSolidFuel,solidFuelProduced=solidFuelProduced,rawCoalRecipeUsers=rawCoalUsers}
  local power={connection='big-electric-pole',externalOnly=true,fixture='electric-energy-interface',attachedToSavedP=true,networkId=t.power.networkId,bigPoles=t.power.bigPoles or 0,mediumPoles=t.power.mediumPoles or 0,connectedConsumers=t.power.connectedConsumers or 0,allConnected=t.power.connected}
  local entry={id=b.id,passed=passed,blueprintSha256=b.blueprintSha256,portConfigurationSha256=b.portConfigurationSha256,kind='production',scienceFactory=true,mapSeed=${mapSeed},dimensions=b.static.dimensions,entityCount=b.static.entityCount,machineCount=b.static.machineCount,materials=b.static.materialCounts,products=b.products,rawInputs=b.rawInputs,testedTechnologies=b.researchClosure,research={closure=b.researchClosure,allEnabled=t.research.enabled},inputDisplays=t.inputDisplays,power=power,powerNetwork=power,fuel=fuel,furnaceFuel=fuel,fluidNetworks=fluidNetworks,machines=machines,rawFeed={accepted=t.fed,fluidSamples=t.fluidSamples},inputItems=t.fed,inputCounts=inputCounts,inputPerMinute=inputPerMinute,firstProductTicks=t.firstProductTicks,outputCounts=outputCounts,drainedPorts=t.drainedPorts,restartedPorts=t.restartedPorts,restartedAfterHalf=restarted,restartedAfterCollection=restarted,rejections=t.rejections}
  if throughput then entry.throughput={warmupMinutes=${warmupMinutes},measuredMinutes=${minutes-warmupMinutes},period={startTick=warmup_ticks,endTick=ticks,warmupMinutes=${warmupMinutes},measuredMinutes=${minutes-warmupMinutes},unit='per-minute'},rateBasis='Input rates are deltas from LuaForce item/fluid production statistics output_counts/get_output_count at the warmup boundary and final tick. They report recipe and burner-fuel consumption rather than exterior belt acceptance; output rates are continuously collected after warmup.',warmupCollected=t.warmupCollected,collected=t.collected,perMinute=perMinute,inputCounts=inputCounts,inputPerMinute=inputPerMinute}end
  report.builds[#report.builds+1]=entry
  report.inputPerMinute=inputPerMinute;report.fuel=fuel;report.power=power
  log('SCIENCE_FACTORY_RESULT: '..helpers.table_to_json(entry))
  helpers.write_file('${reportFile}',helpers.table_to_json(report),false)
 end
end)
`);

async function runFactorio(args, name) {
  try {
    const result = await runFile(path.join(app, 'Contents/MacOS/factorio'), ['--config', path.join(root, 'config.ini'), '--mod-directory', mods, ...args], {timeout: 1800000, maxBuffer: 32 * 1024 * 1024});
    await fs.writeFile(path.join(root, `${name}.log`), result.stdout + result.stderr);
    return result;
  } catch (error) {
    await fs.writeFile(path.join(root, `${name}.log`), String(error.stdout || '') + String(error.stderr || error.message || error));
    throw error;
  }
}

try {
  await runFactorio(['--create', path.join(root, 'science-factory.zip'), '--map-gen-settings', path.join(root, 'map-gen-settings.json')], 'create');
  await runFactorio(['--benchmark', path.join(root, 'science-factory.zip'), '--benchmark-ticks', String(ticks + 1), '--benchmark-runs', '1'], 'simulation');
} catch (error) {
  const log = String(error.stdout || '') + String(error.stderr || error.message || error);
  await fs.writeFile(path.join(root, 'native-error.json'), JSON.stringify({id: build.id, mode: throughput ? 'throughput' : 'functional', blueprintSha256: build.blueprintSha256, portConfigurationSha256: build.portConfigurationSha256, rejectionReasons: [log.slice(-12000)]}, null, 2) + '\n');
  throw error;
}

const generatedReport = path.join(root, 'script-output', reportFile);
const report = JSON.parse(await fs.readFile(generatedReport, 'utf8'));
await fs.writeFile(path.join(root, reportFile), JSON.stringify(report, null, 2) + '\n');
const result = report.builds?.[0];
assert.ok(result, 'native science runner did not emit a build result');
assert.equal(result.blueprintSha256, build.blueprintSha256, 'native report SHA must match the tested source');
assert.equal(result.portConfigurationSha256, build.portConfigurationSha256, 'native report port SHA must match the tested manifest');
console.log(JSON.stringify({id: result.id, mode: report.mode, passed: result.passed, rates: result.throughput?.perMinute, inputPerMinute: result.inputPerMinute, firstProductTicks: result.firstProductTicks, machines: result.machines?.length, fuel: result.fuel, power: result.power}));
if (expectFailure) {
  assert.equal(result.passed, false, 'negative science fixture unexpectedly passed native validation');
  console.log('Science factory native validation emitted the expected failed report.');
} else {
  assert.equal(result.passed, true, throughput ? 'Science factory must sustain every product at >=29.8/min' : 'Science factory must refill every output after the halfway drain');
  console.log('Science factory native validation passed.');
}
