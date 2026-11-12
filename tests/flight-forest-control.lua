local p=helpers.json_to_table(require('payload'))
local function check(ok,msg)if not ok then error('FOREST: '..msg)end end
script.on_init(function()
 storage.tests={}
 for i,b in ipairs(p.builds)do
  local f=game.create_force('forest-'..i);f.enable_all_recipes();f.inserter_stack_size_bonus=0
  local s=game.create_surface('forest-'..i,{width=128,height=128,seed=12345,default_enable_all_autoplace_controls=false,autoplace_settings={entity={treat_missing_as_default=false},decorative={treat_missing_as_default=false}}});s.request_to_generate_chunks({0,0},3);s.force_generate_chunk_requests();for _,e in pairs(s.find_entities())do e.destroy()end
  local tiles={};for x=-64,63 do for y=-64,63 do tiles[#tiles+1]={name='grass-1',position={x,y}}end end;s.set_tiles(tiles);s.daytime=0
  local t={id=b.id,s=s,f=f,entities={},samples={},exports={},seedCrafts=0};storage.tests[i]=t
  local inv=game.create_inventory(1);inv[1].set_stack{name='blueprint'};check(inv[1].import_stack(b.code)==0,'import');local ghosts=inv[1].build_blueprint{surface=s,force=f,position={0,0},build_mode=defines.build_mode.forced};check(#ghosts==#b.entities,'ghost count '..b.id..' '..#ghosts..'/'..#b.entities)
  for _,g in pairs(ghosts)do local id=g.tags.flight_forest_entity;local _,e=g.revive{raise_revive=true};check(e,'revive '..id);t.entities[id]=e end;inv.destroy()
  for _,saved in ipairs(b.entities)do local e=t.entities[saved.entity_number];check(e.name==saved.name,'identity');if saved.recipe then check(e.get_recipe().name==saved.recipe,'recipe')end end
  if b.id~='renewable-nursery' and not b.autonomous then local pole=t.entities[b.power];for x=-3,3 do for y=-3,3 do if not t.power then local pos={pole.position.x+x,pole.position.y+y};if s.can_place_entity{name='electric-energy-interface',position=pos}then local e=s.create_entity{name='electric-energy-interface',position=pos,force=f};if e.electric_network_id==pole.electric_network_id then e.electric_buffer_size=1e10;e.power_production=1e10;e.power_usage=0;t.power=e else e.destroy()end end end end end;check(t.power,'power fixture')end
  if b.seedChest then check(t.entities[b.seedChest].insert{name='tree-seed',count=b.initialSeeds}==b.initialSeeds,'initial seeds')end
 end
end)
script.on_event(defines.events.on_tick,function()
 for i,t in ipairs(storage.tests or {})do local b=p.builds[i]
  if game.tick==1 then t.f.enable_all_recipes()end
  if b.autonomous and game.tick%60==0 then
   t.maintenance=t.maintenance or {destroyed=0,recovered={},onSeconds=0,offSeconds=0,onPollution=0,offPollution=0,offEnergyMax=0,onPowerFailures=0}
   local a=t.maintenance;local stats=game.get_pollution_statistics(t.s)
   local emitted=stats.get_input_count('agricultural-tower')+stats.get_input_count('assembling-machine-2')
   if game.tick>=30*3600 then
    -- Background pollution is a test stimulus only. No item or electricity injection occurs.
    local chunks={};for _,tree in pairs(t.s.find_entities_filtered{name='tree-plant'})do local x=math.floor(tree.position.x/32)*32+16;local y=math.floor(tree.position.y/32)*32+16;chunks[x..','..y]={x,y}end
    for _,pos in pairs(chunks)do local level=t.s.get_pollution(pos);if level<20 then t.s.pollute(pos,20-level)end end
   end
   if game.tick==60*3600 then a.baselineEmitted=emitted;a.baselineAbsorbed=stats.get_output_count('tree-proxy');a.baselineTower=stats.get_input_count('agricultural-tower');a.baselineAssembler=stats.get_input_count('assembling-machine-2')end
   if game.tick>60*3600 then
    local delta=emitted-(a.previousEmitted or emitted)
    if delta>0.000001 then a.onSeconds=a.onSeconds+1;a.onPollution=a.onPollution+delta
    else a.offSeconds=a.offSeconds+1;a.offPollution=a.offPollution+delta end
    if t.entities[b.tower].energy==0 then a.onPowerFailures=a.onPowerFailures+1 end
   end
   a.previousEmitted=emitted
   if game.tick==95*3600 or game.tick==135*3600 then
    local trees=t.s.find_entities_filtered{name='tree-plant'};if not a.beforeDamageTrees then a.beforeDamageTrees=#trees;a.beforeDamageCrafts=t.entities[b.machines[1]].products_finished;a.beforeDamageSeeds=t.entities[b.seedChest].get_item_count('tree-seed')end
    local n=math.min(12,#trees);for j=1,n do trees[j].destroy()end;a.destroyed=a.destroyed+n;a.lastDamageTick=game.tick
   end
   if a.lastDamageTick and t.s.count_entities_filtered{name='tree-plant'}>=a.beforeDamageTrees then
    a.recovered[#a.recovered+1]={damageMinute=a.lastDamageTick/3600,recoveryMinute=game.tick/3600};a.lastDamageTick=nil
   end
   if game.tick==p.ticks then
    a.emitted=emitted-(a.baselineEmitted or 0);a.absorbed=stats.get_output_count('tree-proxy')-(a.baselineAbsorbed or 0);a.netRemovalPerMinute=(a.absorbed-a.emitted)/((p.ticks-60*3600)/3600)
    a.towerEmitted=stats.get_input_count('agricultural-tower')-(a.baselineTower or 0);a.assemblerEmitted=stats.get_input_count('assembling-machine-2')-(a.baselineAssembler or 0)
    a.finalSeeds=t.entities[b.seedChest].get_item_count('tree-seed');a.finalCrafts=t.entities[b.machines[1]].products_finished;a.pollutionInputs=stats.input_counts;a.pollutionOutputs=stats.output_counts
   end
  end
  if game.tick%60==0 then
   if b.id=='forest-kit'then for _,input in ipairs(b.inputs)do local e=t.entities[input.entity];if e.get_item_count(input.item)<100 then e.insert{name=input.item,count=100}end end
    for _,output in ipairs(b.outputs)do t.exports[output.item]=t.entities[output.entity].get_item_count(output.item)end
   elseif b.id=='renewable-nursery' then
    -- Only export surplus wood, keep a 100-wood reserve; no seeds/wood injected after startup.
    local chest=t.entities[b.woodChest];local n=chest.get_item_count('wood');if n>100 then t.exports.wood=(t.exports.wood or 0)+chest.remove_item{name='wood',count=n-100}end
   end
  end
  if game.tick%3600==0 and b.tower then
   local trees=t.s.count_entities_filtered{name='tree-plant'};local tower=t.entities[b.tower];local seeds=t.entities[b.seedChest].get_item_count('tree-seed');local crafts=b.machines[1]and t.entities[b.machines[1]].products_finished or 0
   t.samples[#t.samples+1]={minute=game.tick/3600,trees=trees,seeds=seeds,seedCrafts=crafts,woodExport=t.exports.wood or 0,towerEnergy=tower.energy,pollution={tower=game.get_pollution_statistics(t.s).get_input_count('agricultural-tower'),assembler=game.get_pollution_statistics(t.s).get_input_count('assembling-machine-2'),trees=game.get_pollution_statistics(t.s).get_output_count('tree-proxy')}}
  end
 end
 if game.tick==p.ticks then
  local r={passed=true,builds={}};for i,t in ipairs(storage.tests)do local b=p.builds[i];local powered=true;local machines={}
   for _,e in pairs(t.entities)do if e.type=='inserter'or e.type=='assembling-machine'or e.type=='agricultural-tower'then powered=powered and e.is_connected_to_electric_network()end end
   for _,id in ipairs(b.machines)do local e=t.entities[id];machines[#machines+1]={recipe=e.get_recipe().name,crafts=e.products_finished}end
   local passed=powered;if b.id=='forest-kit'then for _,o in ipairs(b.outputs)do passed=passed and (t.exports[o.item]or 0)>0 end;for _,m in ipairs(machines)do passed=passed and m.crafts>0 end
   elseif b.id=='renewable-nursery'then passed=passed and machines[1].crafts>100 and (t.exports.wood or 0)>0 and t.samples[#t.samples].trees>0 and t.samples[#t.samples].seedCrafts>t.samples[#t.samples-10].seedCrafts
   elseif b.autonomous then local a=t.maintenance;passed=passed and a.destroyed==24 and #a.recovered==2 and a.finalCrafts-a.beforeDamageCrafts>=24 and a.finalSeeds>=70 and a.netRemovalPerMinute>0 and a.offSeconds>0 and a.onSeconds>0 and a.onPowerFailures==0
   else passed=passed and t.samples[#t.samples].trees>30 and t.samples[#t.samples].trees==t.samples[#t.samples-10].trees end
   r.builds[#r.builds+1]={id=b.id,passed=passed,powered=powered,machines=machines,pollution={inputs=game.get_pollution_statistics(t.s).input_counts,outputs=game.get_pollution_statistics(t.s).output_counts},maintenance=t.maintenance,exports=t.exports,outputMode=b.id=='forest-kit' and 'Stored finished items; stocking test, not continuous throughput' or 'Surplus wood collected; 100-wood reserve retained',samples=t.samples};r.passed=r.passed and passed
  end;helpers.write_file('result.json',helpers.table_to_json(r),false)
 end
end)
