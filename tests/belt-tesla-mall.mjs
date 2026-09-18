import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const runFile=promisify(execFile);
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const root=path.resolve('.cache/belt-tesla-mall/game'),mods=path.join(root,'mods'),testMod=path.join(mods,'belt_mall_test');
const blueprint=JSON.parse(await fs.readFile('mall/compact_turbo_tesla_mall.json','utf8')).blueprint;
const code=(await fs.readFile('mall/compact_turbo_tesla_mall.txt','utf8')).trim();
const extensionCode=(await fs.readFile('mall/robot_extension_5x5.txt','utf8')).trim();
const manifest=JSON.parse(await fs.readFile('.cache/belt-tesla-mall/manifest.json','utf8'));
const ticks=Number(process.env.MALL_TEST_TICKS||324000), probe=process.env.MALL_PROBE==='1';
const restockTick = !probe && ticks >= 324000 ? ticks - 54000 : 0;
await fs.mkdir(testMod,{recursive:true});
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n`);
await fs.writeFile(path.join(mods,'mod-list.json'),JSON.stringify({mods:['base','quality','elevated-rails','space-age','belt_mall_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(path.join(testMod,'info.json'),JSON.stringify({name:'belt_mall_test',version:'1.0.0',title:'Isolated belt mall validation',author:'local',factorio_version:'2.0',dependencies:['base >= 2.0.77','space-age']}));
await fs.writeFile(path.join(testMod,'control.lua'),`
local d=helpers.json_to_table([==[${JSON.stringify({entities:blueprint.entities,...manifest})}]==])
local function check(ok,message) if not ok then error('BELT_MALL: '..message) end end
local function pos(x,y) return{x=x+storage.offset.x,y=y+storage.offset.y} end
script.on_init(function()
  local f=game.forces.player;f.research_all_technologies()
  local s=game.create_surface('belt-mall-test',{width=512,height=512,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({30,35},6);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy() end
  local tiles={};for x=-150,150 do for y=-150,150 do tiles[#tiles+1]={name='grass-1',position={x,y}} end end;s.set_tiles(tiles)
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint',count=1}
  check(inv[1].import_stack(${JSON.stringify(extensionCode)})==0,'Original extension import failed')
  local baseGhosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},force_build=true,skip_fog_of_war=true}
  check(#baseGhosts==#d.extension.entities,'Original extension placement failed')
  local minX,minY,sourceX,sourceY=math.huge,math.huge,math.huge,math.huge
  for _,g in pairs(baseGhosts)do minX=math.min(minX,g.position.x);minY=math.min(minY,g.position.y);local _,e=g.revive();check(e~=nil,'Original extension revival failed')end
  for _,def in pairs(d.extension.entities)do sourceX=math.min(sourceX,def.position.x);sourceY=math.min(sourceY,def.position.y)end
  storage.offset={x=minX-sourceX,y=minY-sourceY};storage.originalExtension={}
  for _,def in pairs(d.extension.entities)do
    local e=s.find_entity(def.name,pos(def.position.x,def.position.y));check(e~=nil,'Original extension coordinate mismatch')
    storage.originalExtension[def.entity_number]=e
  end
  check(inv[1].import_stack(${JSON.stringify(code)})==0,'Import failed')
  helpers.write_file('imported-blueprint.json',helpers.table_to_json(inv[1].get_blueprint_entities()),false)
  local ghosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},force_build=true,skip_fog_of_war=true}
  check(#ghosts==#d.entities-#d.extension.entities,'Overlay placement count '..#ghosts..'/'..(#d.entities-#d.extension.entities))
  storage.entities={};storage.surface=s
  for _,g in pairs(ghosts)do local id=g.tags.mall_id;local _,e=g.revive{raise_revive=true};check(e~=nil,'Revive failed '..id);storage.entities[id]=e end
  for originalID,newID in pairs(d.extension.entityIds)do storage.entities[newID]=storage.originalExtension[tonumber(originalID)] end
  for _,def in pairs(d.entities)do
    local e=storage.entities[def.entity_number]
    check(e.name==def.name,'Import changed entity '..def.entity_number)
    check(e.name~='requester-chest' and e.name~='medium-electric-pole','Mall must use substations and belts')
    check(e.valid and e.position.x==pos(def.position.x,def.position.y).x and e.position.y==pos(def.position.x,def.position.y).y,'Overlay moved an extension entity or shifted the mall')
    if def.recipe then check(e.get_recipe() and e.get_recipe().name==def.recipe,'Recipe lost: '..def.recipe)end
  end
  check(defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold==2,'Unexpected belt-read mode')
  local powerPos=s.find_non_colliding_position('electric-energy-interface',pos(d.powerPoint.x,d.powerPoint.y),3,.5)
  check(powerPos~=nil,'No space for external power fixture')
  local power=s.create_entity{name='electric-energy-interface',position=powerPos,force=f}
  power.power_production=1000000000;power.electric_buffer_size=1000000000
  storage.sources={}
  for _,feed in pairs(d.feeds)do
    storage.sources[#storage.sources+1]={entity=storage.entities[feed.belt],item=feed.item}
  end
  for _,input in pairs(d.fluidInputs)do
    local e=s.create_entity{name='infinity-pipe',position=pos(input.x+.5,input.y-.5),force=f}
    check(e~=nil,'Missing external fluid fixture')
    e.set_infinity_pipe_filter{name=input.fluid,percentage=1,mode='at-least'}
  end
  inv.destroy()
  log('BELT_MALL_IMPORT_PASSED: '..#ghosts..' new entities over all 110 unchanged extension entities; 0 logistic robots')
end)
local function report()
  local r={tick=game.tick,entities=#d.entities,robots=0,outputs={},recipes={},fluids={},issues={},valves={},circulating={},before_collection=storage.before_collection,robot_network=storage.networkValidation}
  local network=storage.entities[d.reader].get_circuit_network(defines.wire_connector_id.circuit_green)
  for item,_ in pairs(d.limits)do r.circulating[item]=network.get_signal{type='item',name=item,quality='normal'} end
  for _,cell in pairs(d.cells)do
    local e=storage.entities[cell.machine]
    local v=r.recipes[cell.recipe] or {crafts=0,machines=0,statuses={}}
    v.crafts=v.crafts+e.products_finished;v.machines=v.machines+1;v.statuses[tostring(e.status)]=(v.statuses[tostring(e.status)] or 0)+1;r.recipes[cell.recipe]=v
    if e.energy==0 then r.issues[#r.issues+1]='Unpowered '..cell.recipe end
    if e.get_recipe() and e.get_recipe().name~=cell.recipe then r.issues[#r.issues+1]='Wrong furnace recipe '..cell.recipe end
    if v.crafts==0 then
      local input=e.get_inventory(e.type=='furnace' and defines.inventory.furnace_source or defines.inventory.assembling_machine_input)
      v.input=input and input.get_contents() or nil;v.fluids=e.get_fluid_contents()
    end
    if cell.output then local out=storage.entities[cell.output];r.outputs[d.entities[cell.output].tags.mall_product]=out.get_inventory(defines.inventory.chest).get_item_count(d.entities[cell.output].tags.mall_product) end
  end
  for _,def in pairs(d.entities)do
    local e=storage.entities[def.entity_number]
    if def.tags.mall_fluid then for name,amount in pairs(e.get_fluid_contents())do
      if name~=def.tags.mall_fluid then r.issues[#r.issues+1]='Mixed '..def.tags.mall_net..' pipe #'..def.entity_number..' contains '..name end
      r.fluids[name]=(r.fluids[name] or 0)+amount
    end end
  end
  for _,v in pairs(d.valves)do r.valves[#r.valves+1]={fluid=v.fluid,contents=storage.entities[v.tank].get_fluid_contents(),pump_status=storage.entities[v.pump].status} end
  r.robots=storage.surface.count_entities_filtered{type={'logistic-robot','construction-robot'}}
  helpers.write_file('mall-report.json',helpers.table_to_json(r),false)
  log('BELT_MALL_REPORT: '..helpers.table_to_json(r))
  return r
end
script.on_nth_tick(10,function()
  for _,source in pairs(storage.sources)do for line=1,2 do source.entity.get_transport_line(line).insert_at_back({name=source.item,count=4},4) end end
end)
script.on_nth_tick(60,function()
  if game.tick==600 or game.tick==60000 then
    local unpowered={}
    for id,e in pairs(storage.entities)do
      if e.type=='inserter' or e.type=='furnace' or e.type=='assembling-machine' or e.type=='pump' or e.type=='roboport' then if e.energy==0 then unpowered[#unpowered+1]=e.name..' #'..id..' at '..helpers.table_to_json(d.entities[id].position) end end
    end
    check(#unpowered==0,'Unpowered: '..table.concat(unpowered,', '))
    local networkIDs={};local roboports=0
    for _,e in pairs(storage.entities)do
      if e.type=='roboport' or e.type=='logistic-container' then
        check(e.logistic_network~=nil,'Missing robot coverage at '..helpers.table_to_json(e.position))
        networkIDs[e.logistic_network.network_id]=true
        if e.type=='roboport' then roboports=roboports+1 end
      end
    end
    local networks=0;for _ in pairs(networkIDs)do networks=networks+1 end
    check(networks==1 and roboports==25,'Extension must remain one connected 25-roboport network')
    storage.networkValidation={roboports=roboports,networks=networks,substations=d.substations,unchanged_extension_entities=#d.extension.entities}
    for _,e in pairs(storage.surface.find_entities_filtered{type='inserter'})do e.active=false end
    log('BELT_MALL_POWER_PASSED: all machines and 25 roboports powered; all output chests share one robot network')
  elseif game.tick==660 or game.tick==60060 then
    local network=storage.entities[d.reader].get_circuit_network(defines.wire_connector_id.circuit_green)
    check(network~=nil,'Missing belt inventory circuit')
    local total=0
    for item,_ in pairs(d.limits)do
      local actual=0
      for _,id in pairs(d.loop)do local belt=storage.entities[id];for line=1,belt.get_max_transport_line_index() do actual=actual+belt.get_transport_line(line).get_item_count(item) end end
      local measured=network.get_signal{type='item',name=item,quality='normal'}
      check(actual==measured,'Belt counter mismatch for '..item..': '..actual..' actual, '..measured..' signaled')
      total=total+actual
    end
    check(total>0,'Input belts did not deliver items')
    for _,e in pairs(storage.surface.find_entities_filtered{type='inserter'})do e.active=true end
    log('BELT_MALL_COUNTER_PASSED: exact counts across the entire loop; '..total..' circulating items')
  end
  if game.tick>0 and game.tick%18000==0 then report() end
  if ${restockTick}>0 and game.tick==${restockTick} then
    local before=report();storage.before_collection=before.outputs
    for item,_ in pairs(d.outputs)do check((before.outputs[item] or 0)>0,'No output before collection: '..item)end
    for _,cell in pairs(d.cells)do if cell.output then storage.entities[cell.output].get_inventory(defines.inventory.chest).clear() end end
    log('BELT_MALL_COLLECTION_PASSED: all 16 product chests collected; checking replenishment')
  end
  if game.tick==${ticks} then
    local r=report();check(#r.issues==0,table.concat(r.issues,', '));check(r.robots==0,'Robots should not be used')
    if not ${probe?'true':'false'} then
      for item,_ in pairs(d.outputs)do check((r.outputs[item] or 0)>0,'No output '..item)end
      for recipe,v in pairs(r.recipes)do if recipe~='heavy-oil-cracking' then check(v.crafts>0,'Recipe never ran '..recipe)end end
      for _,v in pairs(d.valves)do if v.fluid=='heavy-oil' then storage.heavyValve=v end end
      for _,c in pairs(d.cells)do if c.recipe=='heavy-oil-cracking' then storage.heavyCracker=storage.entities[c.machine] end end
      storage.heavyCraftsBefore=storage.heavyCracker.products_finished
      storage.entities[storage.heavyValve.tank].insert_fluid{name='heavy-oil',amount=10000}
      log('BELT_MALL_REPLENISHMENT_PASSED: all 16 outputs made and replenished; starting separate heavy-overflow branch test')
    else
      log('BELT_MALL_PROBE_PASSED: all checks completed with zero robots')
    end
  elseif not ${probe?'true':'false'} and game.tick==${ticks+1200} then
    local made=storage.heavyCracker.products_finished-storage.heavyCraftsBefore
    check(made>0,'Heavy-oil overflow did not crack after a separate 10000-unit tank fill')
    storage.overflowProbe={injected_after_production_tick=${ticks},injected_heavy_oil=10000,heavy_cracking_crafts=made}
    for _,def in pairs(d.entities)do if def.tags.mall_net=='heavy-oil' then storage.entities[def.entity_number].remove_fluid{name='heavy-oil',amount=1000000} end end
  elseif not ${probe?'true':'false'} and game.tick==${ticks+1260} then
    local valve=storage.heavyValve
    local amount=storage.entities[valve.tank].get_fluid_count('heavy-oil')
    check(amount<valve.threshold,'Heavy tank did not drain for reserve test')
    check(storage.entities[valve.pump].status==defines.entity_status.disabled_by_control_behavior,'Heavy cracking pump did not close below reserve')
    storage.overflowProbe.closed_below_reserve=true
    helpers.write_file('overflow-validation.json',helpers.table_to_json(storage.overflowProbe),false)
    local port=storage.entities[d.extension.roboportIds[1]]
    check(port.get_inventory(defines.inventory.roboport_robot).insert{name='logistic-robot',count=10}==10,'Could not seed robot collection test')
    local chest=storage.surface.create_entity{name='requester-chest',position=pos(-90.5,-90.5),force=game.forces.player}
    check(chest~=nil and chest.logistic_network==port.logistic_network,'Remote collection chest is outside the extension network')
    local point=chest.get_logistic_point(defines.logistic_member_index.logistic_container)
    point.add_section().set_slot(1,{value={type='item',name='repair-pack',quality='normal',comparator='='},min=1,max=1})
    storage.collectionChest=chest
    log('BELT_MALL_OVERFLOW_PASSED: both heavy-oil valve states verified; starting remote robot collection test')
  elseif not ${probe?'true':'false'} and game.tick==${ticks+7200} then
    local delivered=storage.collectionChest.get_inventory(defines.inventory.chest).get_item_count('repair-pack')
    check(delivered>=1,'Robots did not collect a manufactured repair pack across the extension')
    local collection={robots_added_after_production=10,requester_position={x=-90.5,y=-90.5},requested_item='repair-pack',delivered=delivered,connected_roboports=#storage.collectionChest.logistic_network.cells}
    check(collection.connected_roboports==25,'Robot collection network lost a roboport')
    helpers.write_file('robot-validation.json',helpers.table_to_json(collection),false)
    log('BELT_MALL_PRODUCTION_PASSED: zero-robot production, replenishment, oil controls and delivery across the 25-roboport extension verified')
  end
end)
`);
async function run(args,name){
  try{const r=await runFile(path.join(app,'Contents/MacOS/factorio'),['--config',path.join(root,'config.ini'),'--mod-directory',mods,...args],{timeout:360000,maxBuffer:16*1024*1024});await fs.writeFile(path.join(root,name+'.log'),r.stdout+r.stderr);console.log(r.stdout.split('\n').filter(s=>/BELT_MALL_(?!REPORT)/.test(s)).join('\n'));return r.stdout;}
  catch(e){await fs.writeFile(path.join(root,name+'.log'),String(e.stdout)+String(e.stderr));throw new Error(String(e.stdout||e.message).slice(-2600));}
}
const save=path.join(root,'mall.zip');
assert.ok((await run(['--create',save],'create')).includes('BELT_MALL_IMPORT_PASSED'));
const result=await run(['--benchmark',save,'--benchmark-ticks',String(ticks+(probe?1:7201)),'--benchmark-runs','1'],'simulation');
assert.ok(result.includes(probe?'BELT_MALL_PROBE_PASSED':'BELT_MALL_PRODUCTION_PASSED'),'See simulation.log');
if (!probe) {
  const report=JSON.parse(await fs.readFile(path.join(root,'script-output/mall-report.json'),'utf8'));
  const overflowProbe=JSON.parse(await fs.readFile(path.join(root,'script-output/overflow-validation.json'),'utf8'));
  const robotCollection=JSON.parse(await fs.readFile(path.join(root,'script-output/robot-validation.json'),'utf8'));
  await fs.mkdir('test-results',{recursive:true});
  await fs.writeFile('test-results/belt-tesla-mall-validation.json',JSON.stringify({
    testedAt:new Date().toISOString(), blueprintSha256:createHash('sha256').update(code).digest('hex'),
    extensionSha256:createHash('sha256').update(extensionCode).digest('hex'),
    gameVersion:result.match(/Loading mod base ([\d.]+)/)?.[1], simulatedMinutes:ticks/3600,
    checks:['overlay placement preserves all 110 original extension entities','all machines, inserters and 25 roboports powered','one connected robot network covers every output chest','exact whole-loop circuit inventory including underground belts','all 16 finished products','all product recipes and light-oil cracking ran','fluid separation','zero robots during production',...(restockTick?['all 16 chests emptied and replenished']:[]),'separate heavy-oil overflow and reserve test','separate robot delivery across the original extension'],
    ...report, overflowProbe, robotCollection,
  },null,2)+'\n');
  await fs.copyFile('test-results/belt-tesla-mall-validation.json','mall/compact_turbo_tesla_mall.validation.json');
}
console.log('Report: '+path.join(root,'script-output/mall-report.json'));
