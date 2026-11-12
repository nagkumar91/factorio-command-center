// A local guard for explicitly single-material belts. Untagged/mixed lanes still
// require the native route and production tests; this is not a full flow solver.
export function singleMaterialSpills(blueprint){
 const entities=blueprint.entities||[],grid=new Map(entities.map(e=>[`${e.position.x},${e.position.y}`,e])),directions={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]},spills=[];
 for(const e of entities){
  if(e.name!=='fast-transport-belt'||typeof e.tags?.material!=='string')continue;
  const [dx,dy]=directions[e.direction||0],next=grid.get(`${e.position.x+dx},${e.position.y+dy}`);
  if(next?.name==='fast-transport-belt'&&typeof next.tags?.material==='string'&&next.tags.material!==e.tags.material)spills.push({from:e.entity_number,material:e.tags.material,to:next.entity_number,otherMaterial:next.tags.material});
 }
 return spills;
}
