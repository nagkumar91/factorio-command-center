// Import and run the actual blueprint in the installed game on a disposable map.
// Only raw inputs, electrical power, and the documented starter robots are supplied.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const runFile = promisify(execFile);
const app = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const root = path.resolve('.cache/roboport-mall/game');
const mods = path.join(root, 'mods');
const testMod = path.join(mods, 'roboport_mall_test');
const bp = JSON.parse(await fs.readFile('mall/closed_oil_roboport_mall.json', 'utf8')).blueprint;
const code = (await fs.readFile('mall/closed_oil_roboport_mall.txt', 'utf8')).trim();
const manifest = JSON.parse(await fs.readFile('.cache/roboport-mall/manifest.json', 'utf8'));
const ticks = Number(process.env.MALL_TEST_TICKS || 324000);
await fs.mkdir(testMod, { recursive: true });
await fs.writeFile(path.join(root, 'config.ini'), `[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n`);
await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: ['base', 'quality', 'elevated-rails', 'space-age', 'roboport_mall_test'].map(name => ({ name, enabled: true })) }));
await fs.writeFile(path.join(testMod, 'info.json'), JSON.stringify({ name: 'roboport_mall_test', version: '1.0.0', title: 'Disposable mall validation', author: 'local', factorio_version: '2.0', dependencies: ['base >= 2.0.77', 'space-age'] }));
await fs.writeFile(path.join(testMod, 'control.lua'), `
local definitions = helpers.json_to_table([==[${JSON.stringify({ entities: bp.entities, wires: bp.wires, ...manifest })}]==])
local function fail(message) error('MALL_TEST: '..message) end
local function check(ok, message) if not ok then fail(message) end end
local function refill()
  for _,source in pairs(storage.sources) do
    source.entity.insert{name=source.item,count=5000}
  end
end
script.on_init(function()
  local force=game.forces.player
  force.research_all_technologies()
  force.worker_robots_speed_modifier=1
  force.worker_robots_storage_bonus=2
  local s=game.create_surface('mall-test',{width=512,height=512,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({80,30},7); s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities()) do e.destroy() end
  local tiles={}; for x=-200,200 do for y=-160,160 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end; s.set_tiles(tiles)
  local inventory=game.create_inventory(1)
  inventory[1].set_stack{name='blueprint',count=1}
  check(inventory[1].import_stack(${JSON.stringify(code)})==0,'Blueprint import failed')
  check(inventory[1].get_blueprint_entity_count()==#definitions.entities,'Import changed entity count')
  helpers.write_file('imported-blueprint.json',helpers.table_to_json(inventory[1].get_blueprint_entities()),false)
  local ghosts=inventory[1].build_blueprint{surface=s,force=force,position={0,0},force_build=true,skip_fog_of_war=true}
  check(#ghosts==#definitions.entities,'Could not place every entity: '..#ghosts..'/'..#definitions.entities)
  storage.entities={}; storage.sources={}; storage.surface=s
  for _,ghost in pairs(ghosts) do
    local id=ghost.tags.mall_id
    check(id~=nil,'Blueprint lost entity tags')
    local _,entity=ghost.revive{raise_revive=true}
    check(entity~=nil,'Could not revive entity '..id)
    storage.entities[id]=entity
  end
  local first=storage.entities[1]
  storage.offset={x=first.position.x-definitions.entities[1].position.x,y=first.position.y-definitions.entities[1].position.y}
  local function pos(x,y) return {x=x+storage.offset.x,y=y+storage.offset.y} end
  for _,def in pairs(definitions.entities) do
    local e=storage.entities[def.entity_number]
    check(e.name==def.name,'Wrong entity after import')
    if def.recipe then check(e.get_recipe() and e.get_recipe().name==def.recipe,'Recipe lost: '..def.recipe) end
    if def.tags.mall_input then storage.sources[#storage.sources+1]={entity=e,item=def.tags.mall_input} end
    if e.name=='roboport' then e.get_inventory(defines.inventory.roboport_robot).insert{name='logistic-robot',count=25} end
  end
  for _,fluid in pairs({'water','crude-oil'}) do
    local e=s.create_entity{name='infinity-pipe',position=pos(-.5,definitions.fluidRows[fluid]+.5),force=force}
    check(e~=nil,'Missing test fluid source')
    e.set_infinity_pipe_filter{name=fluid,percentage=1,mode='at-least'}
  end
  local power=s.create_entity{name='electric-energy-interface',position=pos(175,8),force=force}
  power.power_production=1000000000; power.electric_buffer_size=1000000000
  refill()
  inventory.destroy()
  log('MALL_IMPORT_PASSED: '..#ghosts..' entities imported and placed; 300 starter robots; raw ingredients only')
end)

local function report()
  local result={tick=game.tick,entities=#definitions.entities,outputs={},recipes={},fluids={},issues={}}
  for _,cell in pairs(definitions.cells) do
    local e=storage.entities[cell.machine]
    local r=result.recipes[cell.recipe] or {crafts=0,machines=0,statuses={}}
    r.crafts=r.crafts+e.products_finished; r.machines=r.machines+1
    r.statuses[tostring(e.status)]=(r.statuses[tostring(e.status)] or 0)+1
    result.recipes[cell.recipe]=r
    if e.energy==0 then result.issues[#result.issues+1]='Unpowered '..cell.recipe end
    if cell.output then
      local chest=storage.entities[cell.output]
      local def=definitions.entities[cell.output]
      local count=chest.get_inventory(defines.inventory.chest).get_item_count(def.tags.mall_product)
      if def.tags.mall_role=='output' then result.outputs[def.tags.mall_product]=(result.outputs[def.tags.mall_product] or 0)+count end
    end
  end
  for _,def in pairs(definitions.entities) do
    local e=storage.entities[def.entity_number]
    if def.tags.mall_fluid then
      for name,amount in pairs(e.get_fluid_contents()) do
        if name~=def.tags.mall_fluid then result.issues[#result.issues+1]='Wrong fluid '..name..' in '..def.tags.mall_fluid..' pipe '..def.entity_number end
        result.fluids[name]=(result.fluids[name] or 0)+amount
      end
    end
  end
  helpers.write_file('mall-report.json',helpers.table_to_json(result),false)
  log('MALL_REPORT: '..helpers.table_to_json(result))
  return result
end
script.on_nth_tick(60,function()
  refill()
  if game.tick==600 then
    local networks={}
    for _,def in pairs(definitions.entities) do
      local e=storage.entities[def.entity_number]
      if e.type=='logistic-container' then
        check(e.logistic_network~=nil,'Chest outside powered logistics network: '..def.entity_number)
        networks[e.logistic_network.network_id]=true
      end
      if e.type=='inserter' or e.type=='assembling-machine' or e.type=='furnace' or e.type=='roboport' then
        check(e.energy>0,'Unpowered '..e.name..' #'..def.entity_number)
      end
    end
    local n=0; for _ in pairs(networks) do n=n+1 end
    check(n==1,'Disconnected logistics networks: '..n)
    log('MALL_NETWORK_PASSED: every chest shares one network; all machines, inserters and roboports powered')
  end
  if game.tick>0 and game.tick%36000==0 then report() end
  if game.tick==${ticks} then
    local r=report()
    check(#r.issues==0,table.concat(r.issues,', '))
    for item,_ in pairs(definitions.outputs) do check((r.outputs[item] or 0)>0,'No stocked output: '..item) end
    for recipe,run in pairs(r.recipes) do check(run.crafts>0,'Recipe never ran: '..recipe) end
    log('MALL_PRODUCTION_PASSED: all requested outputs stocked from raw inputs; both cracking recipes ran; no mixed fluids')
  end
end)
`);

async function run(args, name) {
  try {
    const result = await runFile(path.join(app, 'Contents/MacOS/factorio'), ['--config', path.join(root, 'config.ini'), '--mod-directory', mods, ...args], { timeout: 240000, maxBuffer: 12 * 1024 * 1024 });
    await fs.writeFile(path.join(root, name + '.log'), result.stdout + result.stderr);
    console.log(result.stdout.split('\n').filter(l => /MALL_(?!REPORT)/.test(l)).join('\n'));
    return result.stdout;
  } catch (error) {
    await fs.writeFile(path.join(root, name + '.log'), String(error.stdout) + String(error.stderr));
    throw new Error(String(error.stdout || error.message).slice(-2200));
  }
}
const save = path.join(root, 'mall.zip');
const created = await run(['--create', save], 'create');
assert.ok(created.includes('MALL_IMPORT_PASSED'), 'Native import failed; see create.log');
const simulated = await run(['--benchmark', save, '--benchmark-ticks', String(ticks + 1), '--benchmark-runs', '1'], 'simulation');
assert.ok(simulated.includes('MALL_PRODUCTION_PASSED'), 'Native production validation failed; see simulation.log');
console.log('Native mall verification complete. Report: ' + path.join(root, 'script-output/mall-report.json'));
