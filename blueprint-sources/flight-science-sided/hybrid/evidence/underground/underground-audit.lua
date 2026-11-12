local function check(ok,msg) if not ok then error('HYBRID_UNDERGROUND: '..msg) end end
local function isbelt(e) return e and (e.type=='transport-belt' or e.type=='underground-belt' or e.type=='splitter') end
local function sortedkeys(set) local ids={};for id in pairs(set)do ids[#ids+1]=id end;table.sort(ids);return ids end
local function sameids(a,b,label) check(#a==#b,label..' count');for i,id in ipairs(a)do check(id==b[i],label..' membership '..id)end end
return function(t,b,detailed)
 local byUnit,nodes,pairRecords={},{},{}
 for id,e in pairs(t.entities)do byUnit[e.unit_number]=id end
 local function idof(e) if not e then return false end;local id=byUnit[e.unit_number];check(id~=nil,'native belt neighbour outside blueprint');return id end
 local function neighbours(list) local set={};for _,e in pairs(list)do set[idof(e)]=true end;return sortedkeys(set)end
 local expectedById={};for _,entry in ipairs(b.undergroundEndpointAudit or {})do check(not expectedById[entry.entity],'duplicate expected endpoint');expectedById[entry.entity]=entry end
 for id,e in pairs(t.entities)do if isbelt(e)then
  local node={entity=id,name=e.name,direction=e.direction,position=e.position,inputs=neighbours(e.belt_neighbours.inputs),outputs=neighbours(e.belt_neighbours.outputs)}
  if e.type=='underground-belt'then
   local neighbour=idof(e.underground_belt_neighbour)
   node.underground=neighbour;node.role=e.belt_to_ground_type
   if b.undergroundEndpointAudit then
    local expected=expectedById[id];check(expected~=nil,'unexpected underground endpoint '..id)
    check(expected.role==node.role,'changed role '..id);check(expected.neighbour==neighbour,'changed native pair '..id);expectedById[id]=nil
   end
   pairRecords[#pairRecords+1]={entity=id,role=node.role,neighbour=neighbour,name=e.name,direction=e.direction,matched=b.undergroundEndpointAudit~=nil}
  end
  nodes[id]=node
 end end
 check(next(expectedById)==nil,'missing expected underground endpoint')
 table.sort(pairRecords,function(a,z)return a.entity<z.entity end)
 local readers={};for _,loop in ipairs(b.loopControl or {})do readers[loop.reader]=true end
 for _,spec in ipairs(b.entities)do if spec.control_behavior and spec.control_behavior.circuit_contents_read_mode==2 then readers[spec.entity_number]=true end end
 local protected,components={},{}
 for _,reader in ipairs(sortedkeys(readers))do
  local e=t.entities[reader];check(isbelt(e),'reader is not a belt '..reader)
  local behavior=e.get_control_behavior()
  check(behavior and behavior.read_contents and behavior.read_contents_mode==defines.control_behavior.transport_belt.content_read_mode.entire_belt_hold,'incorrect actual read-all mode '..reader)
  local visited={[reader]=true};local queue={reader};local head=1
  local function visit(id)if id then check(nodes[id]~=nil,'missing belt node '..id);if not visited[id]then visited[id]=true;queue[#queue+1]=id end end end
  while head<=#queue do local node=nodes[queue[head]];head=head+1
   for _,id in ipairs(node.inputs)do visit(id)end
   for _,id in ipairs(node.outputs)do visit(id)end
   visit(node.underground)
  end
  for id in pairs(visited)do protected[id]=true end
  components[#components+1]={reader=reader,entityNumbers=sortedkeys(visited),actualReadContents=true,actualReadMode='entire_belt_hold'}
 end
 local ids=sortedkeys(protected)
 if b.expectedReadAllBeltComponents then
  check(#components==#b.expectedReadAllBeltComponents,'reader component count changed')
  for i,component in ipairs(components)do local expected=b.expectedReadAllBeltComponents[i];check(component.reader==expected.reader,'reader changed');sameids(component.entityNumbers,expected.entityNumbers,'reader '..component.reader)end
 end
 local result={id=b.id,blueprintSha256=b.blueprintSha256,tick=game.tick,passed=true,pairs=pairRecords,readAllBeltComponents=components,readAllBeltComponentEntityNumbers=ids,beltNodeCount=0}
 for _ in pairs(nodes)do result.beltNodeCount=result.beltNodeCount+1 end
 if detailed then result.beltNodes={};for _,id in ipairs(sortedkeys(nodes))do result.beltNodes[#result.beltNodes+1]=nodes[id]end end
 return result
end
