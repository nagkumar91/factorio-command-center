import assert from 'node:assert/strict';
const steps=new Map([[0,[0,-1]],[4,[1,0]],[8,[0,1]],[12,[-1,0]]]);
/** Validate the declared rewrite exactly; native pairing/production tests remain required. */
export function auditUndergroundRewrite(before, after, pairs, protectedIds=[]) {
  const original=before.blueprint||before, candidate=after.blueprint||after;
  const oldById=new Map(original.entities.map(e=>[e.entity_number,e]));
  const newById=new Map(candidate.entities.map(e=>[e.entity_number,e]));
  assert.equal(oldById.size,original.entities.length,'Duplicate original ID');
  assert.equal(newById.size,candidate.entities.length,'Duplicate candidate ID');
  const removed=new Set(), endpoints=new Set(), protectedSet=new Set(protectedIds);
  for(const p of pairs){
    const a=oldById.get(p.inputEntityNumber), b=oldById.get(p.outputEntityNumber);
    assert(a&&b,'Missing original endpoint');
    assert.equal(a.name,'fast-transport-belt');assert.equal(b.name,a.name);
    const d=a.direction||0, step=steps.get(d);assert(step,'Invalid direction');assert.equal(b.direction||0,d);
    const dx=b.position.x-a.position.x,dy=b.position.y-a.position.y;
    const distance=dx*step[0]+dy*step[1];
    assert(Number.isInteger(distance)&&distance>=2&&distance<=7,'Invalid red underground reach');
    assert.equal(dx,step[0]*distance);assert.equal(dy,step[1]*distance);
    const inside=p.removedInteriorEntityNumbers;
    assert.equal(inside.length,distance-1,'Interior count differs from span');
    for(const [i,id]of inside.entries()){
      const e=oldById.get(id);assert(e,'Missing removed belt');
      assert(!removed.has(id)&&!endpoints.has(id)&&!protectedSet.has(id),'Duplicate/protected removal');
      assert.equal(e.name,'fast-transport-belt');assert.equal(e.direction||0,d);
      assert.deepEqual(e.position,{x:a.position.x+step[0]*(i+1),y:a.position.y+step[1]*(i+1)});
      assert(!newById.has(id),'Interior entity retained');removed.add(id);
    }
    for(const [e,type]of [[a,'input'],[b,'output']]){
      const id=e.entity_number;
      assert(!endpoints.has(id)&&!removed.has(id)&&!protectedSet.has(id),'Duplicate/protected endpoint');
      assert.deepEqual(newById.get(id),{...e,name:'fast-underground-belt',type},'Endpoint changed beyond name/type');
      endpoints.add(id);
    }
  }
  assert.equal(candidate.entities.length,original.entities.length-removed.size);
  for(const e of original.entities)if(!removed.has(e.entity_number)&&!endpoints.has(e.entity_number))assert.deepEqual(newById.get(e.entity_number),e,'Unrelated entity changed');
  for(const e of candidate.entities)assert(oldById.has(e.entity_number),'Unexpected new entity');
  const omitEntities=b=>Object.fromEntries(Object.entries(b).filter(([k])=>!['entities','label','description'].includes(k)));
  assert.deepEqual(omitEntities(candidate),omitEntities(original),'Blueprint settings/wires/tiles changed');
  return {passed:true,pairs:pairs.length,removedSurfaceEntities:removed.size,retainedEntities:candidate.entities.length};
}
