import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {makeLabAnnex} from '../scripts/rgby-science/labs.mjs';
const rawPath = process.env.RGBY_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
// Portable fixture; use exact dump for native and optional prototype-based checks.
const fixture = {lab: {lab: {}}, 'transport-belt': {'fast-transport-belt': {}},
  inserter: {'fast-inserter': {}, 'long-handed-inserter': {}}, 'electric-pole': {'medium-electric-pole': {}}};
const raw = await fs.readFile(rawPath, 'utf8').then(JSON.parse).catch(() => fixture);
for (const rows of [1, 2]) test(`${rows * 15} labs: mixed belts, inserter reach, collision-free footprint and connected power`, () => {
  const a = makeLabAnnex(raw, {rows}), byId = new Map(a.entities.map(e => [e.entity_number, e]));
  assert.equal(a.labCount, rows * 15);
  assert.deepEqual([a.footprint.width, a.footprint.height], [45, rows === 1 ? 6 : 10]);
  assert.equal(a.metadata.research.fullyFedLabCount, rows * 15);
  assert.deepEqual(a.ports.map(p => p.lanes.map(l => l.item)), [
    ['automation-science-pack', 'logistic-science-pack'], ['chemical-science-pack', 'utility-science-pack']]);
  const occupied = new Set();
  for (const e of a.entities) {
    assert.equal(e.tags.flight_science_entity, e.entity_number);
    assert.ok(!e.items && !e.modules);
    assert.ok(['lab', 'fast-transport-belt', 'fast-inserter', 'long-handed-inserter', 'medium-electric-pole'].includes(e.name));
    const size = e.name === 'lab' ? 3 : 1;
    for (let x = e.position.x - size / 2; x < e.position.x + size / 2; x++)
      for (let y = e.position.y - size / 2; y < e.position.y + size / 2; y++) {
        assert.ok(x >= 0 && x < a.footprint.width && y >= 0 && y < a.footprint.height);
        const key = `${x},${y}`; assert.ok(!occupied.has(key), key); occupied.add(key);
      }
  }
  for (const p of a.ports) {
    assert.equal(p.externalSide, 'west'); assert.equal(p.direction, 4); assert.equal(p.mixedLanes, true);
    for (let x = 0.5; x < 45; x++) assert.ok(a.entities.some(e => e.name === 'fast-transport-belt' && e.position.x === x && e.position.y === p.y && e.direction === 4));
  }
  for (const l of a.metadata.labs) for (const id of l.inserters) {
    const arm = byId.get(id), lab = byId.get(l.entity), reach = arm.name === 'fast-inserter' ? 1 : 2;
    const dy = arm.direction === 8 ? 1 : -1;
    assert.ok(a.entities.some(e => e.name === 'fast-transport-belt' && e.position.x === arm.position.x && e.position.y === arm.position.y + dy * reach));
    assert.ok(Math.abs(arm.position.y - dy * (reach + 0.2) - lab.position.y) <= 1.2 + 1e-8);
    assert.ok(Math.abs(arm.position.x - lab.position.x) <= 1.2);
  }
  const poles = a.powerPoleIds.map(id => byId.get(id)), seen = new Set([poles[0].entity_number]);
  for (const [id, connector, other, connector2] of a.wires) {
    assert.equal(connector, 5); assert.equal(connector2, 5);
    const p = byId.get(id).position, q = byId.get(other).position;
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) <= 9);
  }
  for (let i = 0; i < poles.length; i++) for (const [a1, , b] of a.wires) {
    if (seen.has(a1)) seen.add(b); if (seen.has(b)) seen.add(a1);
  }
  assert.equal(seen.size, poles.length);
  for (const e of a.entities.filter(e => /lab|inserter/.test(e.name))) {
    const half = e.name === 'lab' ? 1.2 : 0.15;
    assert.ok(poles.some(p => Math.abs(p.position.x - e.position.x) < 3.5 + half && Math.abs(p.position.y - e.position.y) < 3.5 + half));
  }
});
test('dimensions and research parameter validation', () => {
  for (const options of [{rows: 3}, {columns: 0}, {columns: 1.5}, {sciencePerMinute: 0}, {researchSpeed: NaN}])
    assert.throws(() => makeLabAnnex(raw, options), RangeError);
  assert.throws(() => makeLabAnnex({}), /Missing prototype/);
  assert.equal(makeLabAnnex(raw, {researchSpeed: 2}).metadata.research.fullyFedLabCount, 15);
  assert.equal(makeLabAnnex(raw, {columns: 1}).labCount, 2);
});

// Opt-in isolated game harness. All generated files stay below this task's cache.
test('native: every lab receives all four packs from west belt lanes and researches',
  {skip: process.env.RGBY_LABS_NATIVE !== '1', timeout: 240000}, async () => {
    const root = path.resolve('.cache/rgby-labs', `native-${Date.now()}`);
    const app = process.env.FACTORIO_APP || '/Users/nagkumar/Library/Application Support/Steam/steamapps/common/Factorio/factorio.app';
    const binary = path.join(app, 'Contents/MacOS/factorio'), run = promisify(execFile);
    const versionText = (await run(binary, ['--version'])).stdout;
    const version = versionText.match(/Version: (\d+\.\d+\.\d+)/)[1];
    const mod = path.join(root, 'mods/rgby_lab_test_1.0.0');
    await fs.mkdir(mod, {recursive: true});
    const builds = [1, 2].map(rows => makeLabAnnex(raw, {rows}));
    await fs.writeFile(path.join(mod, 'info.json'), JSON.stringify({name: 'rgby_lab_test', version: '1.0.0',
      title: 'Isolated lab annex test', author: 'local', factorio_version: version.split('.').slice(0, 2).join('.'), dependencies: [`base = ${version}`]}));
    await fs.writeFile(path.join(root, 'mods/mod-list.json'), JSON.stringify({mods: [{name: 'base', enabled: true}, {name: 'rgby_lab_test', enabled: true}]}));
    await fs.writeFile(path.join(mod, 'data.lua'), `data:extend{{type='technology',name='rgby-test',icon='__base__/graphics/technology/automation.png',icon_size=256,unit={count=100000,time=60,ingredients={{'automation-science-pack',1},{'logistic-science-pack',1},{'chemical-science-pack',1},{'utility-science-pack',1}}},effects={}}}`);
    await fs.writeFile(path.join(mod, 'payload.lua'), `return [====[${JSON.stringify(builds)}]====]`);
    await fs.writeFile(path.join(mod, 'control.lua'), `
local builds=helpers.json_to_table(require('payload'))
script.on_init(function()
 storage.builds={}
 for i,b in ipairs(builds) do
  local s=game.create_surface('labs-'..i,{width=160,height=160,autoplace_controls={}})
  s.request_to_generate_chunks({0,0},3);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities()) do e.destroy() end
  local tiles={};for x=-60,70 do for y=-40,40 do tiles[#tiles+1]={name='lab-dark-1',position={x,y}} end end;s.set_tiles(tiles)
  local f=game.create_force('labs-'..i);f.add_research('rgby-test')
  local es={};for _,e in ipairs(b.entities) do
   assert(s.can_place_entity{name=e.name,position=e.position,force=f,direction=e.direction or 0},'collision '..e.entity_number)
   es[e.entity_number]=assert(s.create_entity{name=e.name,position=e.position,force=f,direction=e.direction or 0})
  end
  for _,w in ipairs(b.wires) do es[w[1]].get_wire_connector(defines.wire_connector_id.pole_copper,true).connect_to(es[w[3]].get_wire_connector(defines.wire_connector_id.pole_copper,true)) end
  local power=s.create_entity{name='electric-energy-interface',position={-5,3.5},force=f};power.power_production=1000000000;power.electric_buffer_size=1000000000
  local pole=s.create_entity{name='medium-electric-pole',position={-2,3.5},force=f}
  pole.get_wire_connector(defines.wire_connector_id.pole_copper,true).connect_to(es[b.powerPoleIds[1]].get_wire_connector(defines.wire_connector_id.pole_copper,true))
  local labs={};for _,l in ipairs(b.metadata.labs) do labs[#labs+1]={entity=es[l.entity],id=l.entity,seen={},working=0} end
  storage.builds[i]={entities=es,labs=labs,force=f,ports=b.ports,supplied={}}
 end
end)
script.on_event(defines.events.on_tick,function(event)
 for _,b in ipairs(storage.builds) do
  if event.tick%8==0 then for _,p in ipairs(b.ports) do for _,lane in ipairs(p.lanes) do
   if b.entities[p.entity].get_transport_line(lane.lane).insert_at_back{name=lane.item,count=1} then b.supplied[lane.item]=(b.supplied[lane.item] or 0)+1 end
  end end end
  if event.tick%60==0 then for _,l in ipairs(b.labs) do
   local inv=l.entity.get_inventory(defines.inventory.lab_input)
   for _,p in ipairs(b.ports) do for _,item in ipairs(p.items) do if inv.get_item_count(item)>0 then l.seen[item]=true end end end
   if l.entity.status==defines.entity_status.working then l.working=l.working+1 end
  end end
 end
 if event.tick==21600 then
  local report={passed=true,builds={},feedPolicy='Saturated west input lanes only; no internal inventory injection; 6 simulated minutes; 60-second research'}
  for _,b in ipairs(storage.builds) do
   local r={labs={},supplied=b.supplied,researchProgress=b.force.research_progress,passed=true}
   for _,l in ipairs(b.labs) do local n=0;for _ in pairs(l.seen) do n=n+1 end
    local ok=n==4 and l.working>0 and l.entity.energy>0
    r.labs[#r.labs+1]={entity=l.id,seen=l.seen,workingSamples=l.working,powered=l.entity.energy>0,passed=ok};r.passed=r.passed and ok
   end
   r.passed=r.passed and r.researchProgress>0;report.passed=report.passed and r.passed;report.builds[#report.builds+1]=r
  end
  helpers.write_file('report.json',helpers.table_to_json(report),false)
 end
end)
`);
    await fs.writeFile(path.join(root, 'config.ini'), `[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n[general]\nlocale=en\n[other]\nupdate-runner-threads-count=1\n`);
    await fs.writeFile(path.join(root, 'map.json'), JSON.stringify({seed: 12345, width: 32, height: 32, default_enable_all_autoplace_controls: false}));
    async function factorio(args, log) {
      try {
        const r = await run(binary, ['--config', path.join(root, 'config.ini'), '--mod-directory', path.join(root, 'mods'), ...args], {timeout: 110000, maxBuffer: 8e6});
        await fs.writeFile(path.join(root, log), r.stdout + r.stderr);
      } catch (e) {
        await fs.writeFile(path.join(root, log), (e.stdout || '') + (e.stderr || ''));
        throw new Error(`Native failure: ${root}/${log}\n${(e.stdout || '').slice(-2500)}`);
      }
    }
    await factorio(['--create', path.join(root, 'test.zip'), '--map-gen-settings', path.join(root, 'map.json')], 'create.log');
    await factorio(['--benchmark', path.join(root, 'test.zip'), '--benchmark-ticks', '21601', '--benchmark-runs', '1'], 'benchmark.log');
    const report = JSON.parse(await fs.readFile(path.join(root, 'script-output/report.json')));
    report.gameVersion = version;
    report.prototypeSha256 = createHash('sha256').update(await fs.readFile(rawPath)).digest('hex');
    report.entityWireSha256 = builds.map(b => createHash('sha256').update(JSON.stringify({entities: b.entities, wires: b.wires})).digest('hex'));
    await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Isolated native lab report: ${root}/report.json (${version})`);
    assert.equal(report.passed, true);
  });
