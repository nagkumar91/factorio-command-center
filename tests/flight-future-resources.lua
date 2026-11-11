-- Disposable test only: generate distant new chunks after save creation/reload.
script.on_nth_tick(1,function(event)
  local s=game.surfaces.nauvis
  if event.tick==1 then
    s.request_to_generate_chunks({2048,0},4);s.force_generate_chunk_requests()
    s.request_to_generate_chunks({-2048,0},4);s.force_generate_chunk_requests()
  elseif event.tick==2 then
    local count=0;local by_type={}
    for _,area in ipairs({{{1920,-128},{2176,128}},{{-2176,-128},{-1920,128}}}) do
      for _,e in pairs(s.find_entities_filtered{type='resource',area=area}) do
        assert(e.amount==4294967295,'New chunk resource below maximum: '..e.name..' '..e.amount)
        if e.initial_amount then assert(e.initial_amount==4294967295) end
        count=count+1;by_type[e.name]=(by_type[e.name] or 0)+1
      end
    end
    assert(count>0,'No test resources generated')
    helpers.write_file('flight-max-resource-report.json',helpers.table_to_json({passed=true,maxAmount=4294967295,futureChunkResourceEntities=count,byType=by_type}),false)
    log('FLIGHT_FUTURE_RESOURCES_MAX_VALIDATED')
    script.on_nth_tick(1,nil)
  end
end)
