// Runs generated Lua inside the actual installed game, using disposable maps.
// Headless maps cannot create LuaPlayers. A small player adapter supplies the
// real surface, force, and position; inventories and all placement APIs are real.
// The copied starter mod exposes its existing handler through remote.call.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { generateCrateCommand, planCrates, PRESETS } from '../scripts/packer.mjs';
const catalog = JSON.parse(await fs.readFile('site/data/catalog.json', 'utf8'));
const library = JSON.parse(await fs.readFile('site/data/library.json', 'utf8'));
const game = process.env.FACTORIO_APP || path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const root = path.resolve('.cache/game-test');
const mods = path.join(root, 'mods');
await fs.mkdir(mods, { recursive: true });
const installedMods = path.join(os.homedir(), 'Library/Application Support/factorio/mods');
for (const name of await fs.readdir(installedMods)) {
  if (name.endsWith('.zip') && !name.startsWith('starter_initializer_')) await fs.copyFile(path.join(installedMods, name), path.join(mods, name));
}
await fs.writeFile(path.join(root, 'config.ini'), `[path]\nread-data=${game}/Contents/data\nwrite-data=${root}\n`);
await fs.writeFile(path.join(mods, 'mod-list.json'), JSON.stringify({ mods: [...catalog.mods.filter(m => m.enabled), { name: 'command_center_test', enabled: true }] }));
const starter = path.join(mods, 'starter_initializer');
await fs.cp('starter_initializer', starter, { recursive: true });
const control = await fs.readFile(path.join(starter, 'control.lua'), 'utf8');
const settingSource = await fs.readFile(path.join(starter, 'settings.lua'), 'utf8');
// Emulate an old installation that still carries true as its new-map preference.
await fs.writeFile(path.join(starter, 'settings.lua'), settingSource.replace(/(name = "starter-init-auto-grant-on-join",\s*setting_type = "runtime-global",\s*default_value = )false/, '$1true'));
await fs.writeFile(path.join(starter, 'control.lua'), `local registered_grant\nlocal supplied_player\nlocal get_game=function() return game end\nlocal game=setmetatable({get_player=function(id) return supplied_player end},{__index=function(_,key) return get_game()[key] end})\nlocal real_commands=commands\nlocal commands={add_command=function(name,help,handler) real_commands.add_command(name,help,handler); if name=="starter_init_grant" then registered_grant=handler end end}\n` + control + `\nremote.add_interface("starter_test_adapter", { grant=function(index) registered_grant({player_index=index}) end, try_auto=function(surface_name) supplied_player={index=1,valid=true,surface=get_game().surfaces[surface_name],force=get_game().forces.player,position={x=0,y=0},print=function(message) log(message) end}; maybe_grant_player(1,false) end, configure=function() settings.global["starter-init-mode"]={value="custom-only"}; settings.global["starter-init-custom-items"]={value="iron-plate=100"} end, enable_auto=function() settings.global["starter-init-auto-grant-on-join"]={value=true} end })\n`);
const testMod = path.join(mods, 'command_center_test');
await fs.mkdir(testMod, { recursive: true });
await fs.writeFile(path.join(testMod, 'info.json'), JSON.stringify({ name: 'command_center_test', version: '1.0.0', title: 'Isolated command tests', author: 'local', factorio_version: '2.0', dependencies: ['base', 'space-age', 'starter_initializer >= 0.2.5'] }));
const cases = [
  { name: 'single chest exact capacity', rows: [{ id: 'iron-plate', count: 4800 }] },
  { name: 'overflow preserves partial stacks', rows: [{ id: 'iron-plate', count: 12001 }, { id: 'copper-plate', count: 42 }] },
  { name: 'mixed qualities remain separate', rows: [{ id: 'iron-plate', count: 101 }, { id: 'iron-plate', count: 101, quality: 'legendary' }, { id: 'speed-module-3', count: 75, quality: 'rare' }] },
  ...catalog.chests.map(c => ({ name: 'chest type ' + c.id, chest: c.id, rows: [{ id: 'iron-plate', count: 5001 }] })),
  ...PRESETS.map(p => ({ name: 'preset ' + p.id, rows: p.entries.map(([id, count]) => ({ id, count })) })),
  { name: 'one stack of every visible game item', rows: catalog.items.map(i => ({ id: i.id, count: i.stack })) },
  { name: 'legendary blueprint loadout', rows: library.blueprints.find(b => b.file.includes('legendary') && b.entries.some(r => r.quality === 'legendary')).entries }
];
function adapt(code) { return code.replace(/^\/c\s*/, '').replaceAll('game.player', 'test_player'); }
let tests = '';
for (const i of catalog.items) tests += `assert(prototypes.item[${JSON.stringify(i.id)}].stack_size==${i.stack},${JSON.stringify('Stack size differs: ' + i.id)});\n`;
for (const c of cases) {
  const plan = planCrates(c.rows, catalog, c.chest);
  const code = generateCrateCommand(c.rows, catalog, c.chest);
  tests += `\nclear_chests(); do local run=function() ${adapt(code)} end; run() end\n`;
  tests += `local chests=surface.find_entities_filtered{type={"container","logistic-container"}}; assert(#chests==${plan.chests}, ${JSON.stringify(c.name + ': wrong chest count')});\n`;
  for (const r of plan.rows) tests += `assert(count_item(${JSON.stringify(r.id)},${JSON.stringify(r.quality)})==${r.count},${JSON.stringify(c.name + ': missing ' + r.id + ' ' + r.quality)});\n`;
  tests += `log("COMMAND_CENTER_PASS: ${c.name}")\n`;
}
const invalid = generateCrateCommand([{ id: 'iron-plate', count: 100 }], catalog).replace('name="iron-plate"', 'name="not-a-real-item"');
const blocked = generateCrateCommand([{ id: 'iron-plate', count: 100 }], catalog);
await fs.writeFile(path.join(testMod, 'control.lua'), `
script.on_init(function()
  assert(settings.global["starter-init-auto-grant-on-join"].value==false,"Auto grant must default to false")
  local surface=game.create_surface("command-center-test",{width=256,height=256,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  surface.request_to_generate_chunks({0,0},3); surface.force_generate_chunk_requests()
  for _,e in pairs(surface.find_entities()) do if e.valid then e.destroy() end end
  local tiles={}; for x=-80,80 do for y=-80,80 do tiles[#tiles+1]={name="grass-1",position={x,y}} end end; surface.set_tiles(tiles)
  local test_player={surface=surface,force=game.forces.player,position={x=0,y=0},print=function(message) log(message) end}
  local function clear_chests() for _,e in pairs(surface.find_entities_filtered{type={"container","logistic-container","storage-tank"}}) do e.destroy() end end
  local function count_item(name,quality) local n=0; for _,e in pairs(surface.find_entities_filtered{type={"container","logistic-container"}}) do n=n+e.get_inventory(defines.inventory.chest).get_item_count{name=name,quality=quality} end; return n end
  remote.call("starter_test_adapter","try_auto",surface.name)
  assert(#surface.find_entities_filtered{type={"container","logistic-container","storage-tank"}}==0,"Unexpected starter supplies")
  assert(#game.surfaces.nauvis.find_entities_filtered{name={"steel-chest","storage-tank"}}==0,"Unexpected supplies on Nauvis")
  log("COMMAND_CENTER_PASS: automatic grant path creates no supplies")
  remote.call("starter_test_adapter","configure")
  remote.call("starter_test_adapter","grant",1)
  assert(count_item("iron-plate","normal")==100,"Manual grant did not work")
  log("COMMAND_CENTER_PASS: original manual grant handler still works")
  ${tests}
  clear_chests(); do local run=function() ${adapt(invalid)} end; run() end
  assert(#surface.find_entities_filtered{type={"container","logistic-container"}}==0,"Invalid items must not create chests")
  log("COMMAND_CENTER_PASS: invalid runtime item fails before creating chests")
  tiles={}; for x=-80,80 do for y=-80,80 do tiles[#tiles+1]={name="water",position={x,y}} end end; surface.set_tiles(tiles)
  do local run=function() ${adapt(blocked)} end; run() end
  assert(#surface.find_entities_filtered{type={"container","logistic-container"}}==0,"Blocked terrain must not create chests")
  log("COMMAND_CENTER_PASS: blocked terrain stops cleanly")
  log("COMMAND_CENTER_ALL_TESTS_PASSED")
end)
`);
function run(args, logName) {
  try {
    const output = execFileSync(path.join(game, 'Contents/MacOS/factorio'), ['--config', path.join(root, 'config.ini'), '--mod-directory', mods, ...args], { encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    return fs.writeFile(path.join(root, logName), output).then(() => output);
  } catch (error) { throw new Error(String(error.stdout || error.message).slice(-4000)); }
}
const output = await run(['--create', path.join(root, 'commands.zip')], 'commands.log');
assert.match(output, /COMMAND_CENTER_ALL_TESTS_PASSED/);
console.log(output.split('\n').filter(line => line.includes('COMMAND_CENTER_')).join('\n'));

// Verify an actual 0.2.5 save retains true, then migrates to false on upgrade.
const info = JSON.parse(await fs.readFile(path.join(starter, 'info.json'), 'utf8'));
await fs.writeFile(path.join(starter, 'info.json'), JSON.stringify({ ...info, version: '0.2.5' }));
await fs.rename(path.join(starter, 'migrations/0.2.6.lua'), path.join(root, 'migration-0.2.6.lua'));
await fs.writeFile(path.join(testMod, 'control.lua'), `script.on_init(function() remote.call("starter_test_adapter","enable_auto"); assert(settings.global["starter-init-auto-grant-on-join"].value==true); log("OLD_SAVE_SETTING_TRUE") end)`);
const old = await run(['--create', path.join(root, 'old-save.zip')], 'old-save.log');
assert.match(old, /OLD_SAVE_SETTING_TRUE/);
await fs.writeFile(path.join(starter, 'info.json'), JSON.stringify(info));
await fs.rename(path.join(root, 'migration-0.2.6.lua'), path.join(starter, 'migrations/0.2.6.lua'));
await fs.writeFile(path.join(testMod, 'control.lua'), `script.on_configuration_changed(function() assert(settings.global["starter-init-auto-grant-on-join"].value==false,"Migration must disable saved true value"); log("COMMAND_CENTER_MIGRATION_PASSED") end)`);
const migrated = await run(['--benchmark', path.join(root, 'old-save.zip'), '--benchmark-ticks', '1', '--benchmark-runs', '1'], 'migration.log');
assert.match(migrated, /COMMAND_CENTER_MIGRATION_PASSED/);
console.log('COMMAND_CENTER_MIGRATION_PASSED: existing save setting true -> false');
