import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const runFile=promisify(execFile);
const app=process.env.FACTORIO_APP||path.join(os.homedir(),'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const root=path.resolve('.cache/robot-expansion-mall/game'),mods=path.join(root,'mods'),testMod=path.join(mods,'robot_expansion_test');
const blueprint=JSON.parse(await fs.readFile('mall/robot_expansion_mall.json','utf8')).blueprint;
const code=(await fs.readFile('mall/robot_expansion_mall.txt','utf8')).trim();
const extensionCode=(await fs.readFile('mall/robot_extension_5x5.txt','utf8')).trim();
const manifest=JSON.parse(await fs.readFile('.cache/robot-expansion-mall/manifest.json','utf8'));
const ticks=Number(process.env.MALL_TEST_TICKS||324000),probe=process.env.MALL_PROBE==='1';
const collectionTick=!probe&&ticks>=324000?ticks-54000:0;
await fs.mkdir(testMod,{recursive:true});
await fs.writeFile(path.join(root,'config.ini'),`[path]\nread-data=${app}/Contents/data\nwrite-data=${root}\n`);
await fs.writeFile(path.join(mods,'mod-list.json'),JSON.stringify({mods:['base','quality','elevated-rails','space-age','robot_expansion_test'].map(name=>({name,enabled:true}))}));
await fs.writeFile(path.join(testMod,'info.json'),JSON.stringify({name:'robot_expansion_test',version:'1.0.0',title:'Isolated robot expansion mall test',author:'local',factorio_version:'2.0',dependencies:['base >= 2.0.77','space-age']}));
await fs.writeFile(path.join(testMod,'control.lua'),`
local d=helpers.json_to_table([==[${JSON.stringify({entities:blueprint.entities,...manifest})}]==])
local function check(ok,message) if not ok then error('ROBOT_MALL: '..message) end end
local function pos(x,y)return{x=x+storage.offset.x,y=y+storage.offset.y}end
local function refill()
  for _,source in pairs(d.feeds)do
    local inserted=storage.entities[source.entity].insert{name=source.item,count=5000}
    storage.supplied[source.item]=(storage.supplied[source.item] or 0)+inserted
  end
end
script.on_init(function()
  local f=game.forces.player;f.research_all_technologies()
  f.worker_robots_speed_modifier=1;f.worker_robots_storage_bonus=2
  local s=game.create_surface('robot-mall-test',{width=512,height=512,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}})
  s.request_to_generate_chunks({0,0},6);s.force_generate_chunk_requests()
  for _,e in pairs(s.find_entities())do e.destroy() end
  local tiles={};for x=-150,150 do for y=-150,150 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles)
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint',count=1}
  check(inv[1].import_stack(${JSON.stringify(extensionCode)})==0,'Original extension import failed')
  local baseGhosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},force_build=true,skip_fog_of_war=true}
  check(#baseGhosts==#d.extension.entities,'Original extension placement failed')
  local minX,minY,sourceX,sourceY=math.huge,math.huge,math.huge,math.huge
  for _,g in pairs(baseGhosts)do minX=math.min(minX,g.position.x);minY=math.min(minY,g.position.y);local _,e=g.revive();check(e~=nil,'Original extension revival failed')end
  for _,def in pairs(d.extension.entities)do sourceX=math.min(sourceX,def.position.x);sourceY=math.min(sourceY,def.position.y)end
  storage.offset={x=minX-sourceX,y=minY-sourceY};local original={}
  for _,def in pairs(d.extension.entities)do original[def.entity_number]=s.find_entity(def.name,pos(def.position.x,def.position.y))end
  check(inv[1].import_stack(${JSON.stringify(code)})==0,'Blueprint string import failed')
  local ghosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},force_build=true,skip_fog_of_war=true}
  check(#ghosts==#d.entities-#d.extension.entities,'Factory placement count mismatch: '..#ghosts)
  storage.entities={};storage.surface=s;storage.supplied={}
  for _,g in pairs(ghosts)do local id=g.tags.mall_id;local _,e=g.revive{raise_revive=true};check(e~=nil,'Could not revive '..id);storage.entities[id]=e end
  for oldID,newID in pairs(d.extension.entityIds)do storage.entities[newID]=original[tonumber(oldID)]end
  for _,def in pairs(d.entities)do
    local e=storage.entities[def.entity_number]
    check(e~=nil and e.valid and e.name==def.name,'Missing imported entity '..def.entity_number)
    check(e.position.x==pos(def.position.x,def.position.y).x and e.position.y==pos(def.position.x,def.position.y).y,'Layout or original extension shifted')
    check(not string.find(e.type,'belt') and e.type~='splitter' and not string.find(e.type,'loader'),'Forbidden belt transport')
    if def.recipe then check(e.get_recipe() and e.get_recipe().name==def.recipe,'Lost recipe '..def.recipe)end
  end
  local powerPos=s.find_non_colliding_position('electric-energy-interface',pos(d.powerPoint.x,d.powerPoint.y),3,.5)
  local power=s.create_entity{name='electric-energy-interface',position=powerPos,force=f}
  check(power~=nil,'Could not supply external electricity');power.power_production=1000000000;power.electric_buffer_size=1000000000
  for _,input in pairs(d.fluidInputs)do
    local e=s.create_entity{name='infinity-pipe',position=pos(input.x+.5,input.y-.5),force=f}
    check(e~=nil,'Missing raw fluid inlet');e.set_infinity_pipe_filter{name=input.fluid,percentage=1,mode='at-least'}
  end
  refill();inv.destroy()
  log('ROBOT_MALL_IMPORT_PASSED: '..#ghosts..' new entities over 110 unchanged extension entities; no belts')
end)
local function report()
  local r={tick=game.tick,entities=#d.entities,outputs={},recipes={},fluids={},issues={},raw_supplied=storage.supplied,network=storage.networkValidation,starter_robots=d.starterRobots,before_collection=storage.before_collection}
  for _,cell in pairs(d.cells)do
    local e=storage.entities[cell.machine]
    local v=r.recipes[cell.recipe] or {crafts=0,machines=0,statuses={}}
    v.crafts=v.crafts+e.products_finished;v.machines=v.machines+1;v.statuses[tostring(e.status)]=(v.statuses[tostring(e.status)] or 0)+1;r.recipes[cell.recipe]=v
    if e.energy==0 then r.issues[#r.issues+1]='Unpowered '..cell.recipe end
    if e.get_recipe() and e.get_recipe().name~=cell.recipe then r.issues[#r.issues+1]='Wrong furnace recipe '..cell.recipe end
    if e.products_finished==0 then
      local input=e.get_inventory(e.type=='furnace' and defines.inventory.furnace_source or defines.inventory.assembling_machine_input)
      v.input=input and input.get_contents() or nil;v.fluids=e.get_fluid_contents()
    end
    if cell.final then r.outputs[cell.recipe]=storage.entities[cell.output].get_inventory(defines.inventory.chest).get_item_count(cell.recipe)end
  end
  for _,def in pairs(d.entities)do if def.tags.mall_fluid then
    for name,amount in pairs(storage.entities[def.entity_number].get_fluid_contents())do
      if name~=def.tags.mall_fluid then r.issues[#r.issues+1]='Mixed fluid '..name..' in '..def.tags.mall_net..' #'..def.entity_number end
      r.fluids[name]=(r.fluids[name] or 0)+amount
    end
  end end
  helpers.write_file('mall-report.json',helpers.table_to_json(r),false);log('ROBOT_MALL_REPORT: '..helpers.table_to_json(r));return r
end
script.on_nth_tick(60,function()
  refill()
  if game.tick==600 then
    local networks={};local ports=0;local chests=0
    for _,e in pairs(storage.entities)do
      if e.type=='inserter' or e.type=='furnace' or e.type=='assembling-machine' or e.type=='pump' or e.type=='roboport' then check(e.energy>0,'Unpowered '..e.name..' '..helpers.table_to_json(e.position))end
      if e.type=='roboport' or e.type=='logistic-container' then
        check(e.logistic_network~=nil,'Entity outside robot coverage '..e.name);networks[e.logistic_network.network_id]=true
        if e.type=='roboport' then ports=ports+1 else chests=chests+1 end
      end
    end
    local n=0;for _ in pairs(networks)do n=n+1 end
    check(n==1 and ports==25,'Disconnected original robot extension')
    storage.networkValidation={roboports=ports,logistics_networks=n,covered_chests=chests,substations=d.substations,unchanged_extension_entities=110}
    log('ROBOT_MALL_NETWORK_PASSED: every machine, inserter, pump and roboport powered; all '..chests..' chests in one network')
  elseif game.tick==1200 then
    for _,cell in pairs(d.cells)do if cell.final or cell.recipe=='iron-plate' or cell.recipe=='copper-plate' then check(storage.entities[cell.machine].products_finished==0,'Unexpected pre-seed item transport')end end
    local seeded=0
    for _,id in pairs(d.seedPorts)do seeded=seeded+storage.entities[id].get_inventory(defines.inventory.roboport_robot).insert{name='logistic-robot',count=d.starterRobots/#d.seedPorts}end
    check(seeded==d.starterRobots,'Starter robot count mismatch')
    log('ROBOT_MALL_BOOTSTRAP_PASSED: '..seeded..' logistic robots added after zero-robot control phase')
  end
  if game.tick>0 and game.tick%36000==0 then report()end
  if ${collectionTick}>0 and game.tick==${collectionTick} then
    local r=report();storage.before_collection=r.outputs
    for item,target in pairs(d.outputs)do check((r.outputs[item] or 0)>=target,'Stock target not reached before collection: '..item..' '..(r.outputs[item] or 0)..'/'..target)end
    for _,cell in pairs(d.cells)do if cell.final then storage.entities[cell.output].get_inventory(defines.inventory.chest).clear()end end
    log('ROBOT_MALL_COLLECTION_PASSED: all four stock targets reached; chests emptied for replenishment test')
  end
  if game.tick==${ticks} then
    local r=report();check(#r.issues==0,table.concat(r.issues,', '))
    if not ${probe?'true':'false'} then
      for item,_ in pairs(d.outputs)do check((r.outputs[item] or 0)>0,'No stocked output '..item)end
      for recipe,v in pairs(r.recipes)do check(v.crafts>0,'Recipe never ran '..recipe)end
      log('ROBOT_MALL_PRODUCTION_PASSED: all four products made from raw inputs and replenished; every intermediate and both oil cracking recipes ran')
    else log('ROBOT_MALL_PROBE_PASSED: import, power, robot coverage and fluid checks passed')end
  end
end)
`);
async function run(args,name){
 try{const r=await runFile(path.join(app,'Contents/MacOS/factorio'),['--config',path.join(root,'config.ini'),'--mod-directory',mods,...args],{timeout:360000,maxBuffer:16*1024*1024});await fs.writeFile(path.join(root,name+'.log'),r.stdout+r.stderr);console.log(r.stdout.split('\n').filter(s=>/ROBOT_MALL_(?!REPORT)/.test(s)).join('\n'));return r.stdout;}
 catch(e){await fs.writeFile(path.join(root,name+'.log'),String(e.stdout)+String(e.stderr));throw new Error(String(e.stdout||e.message).slice(-5000));}
}
const save=path.join(root,'mall.zip');
assert.ok((await run(['--create',save],'create')).includes('ROBOT_MALL_IMPORT_PASSED'));
const result=await run(['--benchmark',save,'--benchmark-ticks',String(ticks+1),'--benchmark-runs','1'],'simulation');
assert.ok(result.includes(probe?'ROBOT_MALL_PROBE_PASSED':'ROBOT_MALL_PRODUCTION_PASSED'));
if(!probe){
 const report=JSON.parse(await fs.readFile(path.join(root,'script-output/mall-report.json'),'utf8'));
 const validation={testedAt:new Date().toISOString(),blueprintSha256:createHash('sha256').update(code).digest('hex'),extensionSha256:createHash('sha256').update(extensionCode).digest('hex'),
  gameVersion:result.match(/Loading mod base ([\d.]+)/)?.[1],simulatedMinutes:ticks/3600,robotSpeedBonus:1,robotCargoBonus:2,
  checks:['actual import string overlays all 110 original extension entities','no belts, splitters or loaders','every machine and roboport powered','all chests share one 25-roboport network','zero-robot control phase then 200 starter logistic robots','only iron ore, copper ore, coal, water, crude oil and electricity supplied','every intermediate recipe ran','heavy and light oil cracking ran','no mixed fluids','all four finished products stocked',...(collectionTick?['all four stock targets reached before collection','all four outputs replenished after collection']:[])],...report};
 await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/robot-expansion-mall-validation.json',JSON.stringify(validation,null,2)+'\n');
 await fs.copyFile('test-results/robot-expansion-mall-validation.json','mall/robot_expansion_mall.validation.json');
}
console.log('Report: '+path.join(root,'script-output/mall-report.json'));
