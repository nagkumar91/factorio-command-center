// Coverage means an identified recipe product, not merely an item used to build a layout.
export const productsOf = b => [...new Set([...(b.analysis?.outputs||[]),...(b.analysis?.netOutputs||[]),...(b.products||[])])];
export function blueprintCoverage(catalog,production,builds){
 const items=[...catalog.items,{id:'rocket-part',name:'Rocket part',icon:'assets/icons/rocket-silo.png',group:'Intermediate products',internal:true}];
 const recipesFor=id=>production.recipes.filter(r=>r.results.some(p=>p.type==='item'&&p.id===id&&p.amount*p.probability>0));
 const eligible=builds.filter(b=>!b.isBook&&!b.parameterized&&!b.analysis?.missing.length&&!(b.excluded||[]).some(id=>id!=='space-platform-hub'));
 const entries=items.filter(i=>recipesFor(i.id).length).map(i=>{
  const matches=eligible.filter(b=>productsOf(b).includes(i.id)).sort((a,b)=>(a.validation?.status==='game-tested'?-1:0)-(b.validation?.status==='game-tested'?-1:0)||a.entityCount-b.entityCount);
  return {...i,recipes:recipesFor(i.id).map(r=>r.id),builds:matches.map(b=>b.id),status:matches.length?'covered':'missing',note:i.internal?'Rocket parts are made and retained in a silo; they cannot be packed into an item crate.':recipesFor(i.id).every(r=>r.results.some(p=>p.id===i.id&&p.probability<1))?'Production involves random yields.':''};
 });
 return {gameVersion:catalog.version,total:entries.length,covered:entries.filter(i=>i.builds.length).length,missing:entries.filter(i=>!i.builds.length).map(i=>i.id),items:entries,nonCraftable:items.filter(i=>!recipesFor(i.id).length).map(i=>({id:i.id,name:i.name,icon:i.icon,reason:'No crafting recipe in the indexed game. Obtain through extraction, harvesting, scenario rewards, or the blueprint/planner tools.'}))};
}
