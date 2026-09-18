import fs from 'node:fs/promises';
import {encodeBlueprint} from './blueprints.mjs';
import {blueprintCoverage} from './blueprint-coverage.mjs';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [catalog,production,library,community,atlas,raw]=await Promise.all(['site/data/catalog.json','site/data/production.json','site/data/library.json','site/data/community.json','site/data/atlas.json',process.env.FACTORIO_RAW||'.cache/factorio-vanilla/script-output/data-raw-dump.json'].map(read));
const builds=[...library.blueprints.map(b=>({...b,analysis:community.local[b.id]})),...community.blueprints,...atlas.blueprints.filter(b=>b.collection!=='Recipe cells')];
const gaps=blueprintCoverage(catalog,production,builds).missing;
const prototypes=new Map();for(const type of Object.values(raw))for(const p of Object.values(type))if(p.selection_box)prototypes.set(p.name,p);
const names=new Map(catalog.items.map(i=>[i.id,i.name]));
const out='blueprint-sources/generated';await fs.mkdir(out,{recursive:true});const manifest=[];
for(const product of gaps){
 const choices=production.recipes.filter(r=>r.results.some(p=>p.id===product));
 const recipe=choices.find(r=>r.id===production.defaults[product])||choices.find(r=>!r.ingredients.some(i=>i.id===product))||choices[0];
 if(!recipe)throw new Error('No recipe for '+product);
 const machine=['assembling-machine-3','electric-furnace','chemical-plant','electromagnetic-plant','cryogenic-plant','biochamber','captive-biter-spawner','crusher','recycler','foundry'].find(n=>prototypes.get(n)?.crafting_categories?.includes(recipe.category));
 if(!machine)throw new Error('No machine for '+recipe.id);
 const proto=prototypes.get(machine),conditions=[...(raw.recipe[recipe.id].surface_conditions||[]),...(proto.surface_conditions||[])];
 const platform=conditions.some(c=>c.property==='gravity'&&c.max===0);
 const width=Math.round(proto.selection_box[1][0]-proto.selection_box[0][0]),height=Math.round(proto.selection_box[1][1]-proto.selection_box[0][1]);
 const cx=width%2/2,cy=height%2/2,left=cx-width/2,right=cx+width/2,top=cy-height/2,bottom=cy+height/2;
 const entities=[],ports=[];const add=(name,x,y,props={})=>{const id=entities.length+1;entities.push({entity_number:id,name,position:{x,y},...props,tags:{cell_entity:id,...props.tags}});return id;};
 const machineID=add(machine,cx,cy,{...(proto.type==='furnace'||proto.fixed_recipe?{}:{recipe:recipe.id}),tags:{production_recipe:recipe.id}});
 const ingredients=recipe.ingredients.filter(i=>i.type==='item').map(i=>({id:i.id,count:Math.max(10,Math.ceil(i.amount*2))}));
 const fuel=proto.energy_source?.fuel_categories?.includes('food')?'bioflux':proto.energy_source?.fuel_categories?.includes('nutrients')?'nutrients':null;
 if(fuel){const old=ingredients.find(i=>i.id===fuel);if(old)old.count+=50;else ingredients.push({id:fuel,count:50});}
 if(product==='holmium-ore')ingredients.find(i=>i.id==='scrap').count=200;
 const inputID=add(platform?'turbo-transport-belt':'requester-chest',left-1.5,top+.5,platform?{direction:4}:{request_filters:{sections:[{index:1,filters:ingredients.map((i,index)=>({index:index+1,name:i.id,quality:'normal',comparator:'=',count:i.count}))}]}});
 add('bulk-inserter',left-.5,top+.5,{direction:12});
 let outputID;
 if(machine==='recycler')outputID=add('passive-provider-chest',cx-.5,top-.5);
 else{add('bulk-inserter',right+.5,bottom-.5,{direction:12});outputID=add(platform?'turbo-transport-belt':'passive-provider-chest',right+1.5,bottom-.5,platform?{direction:4}:{});}
 const substationID=add('substation',-5,5),roboportID=platform?null:add('roboport',0,7);
 for(const type of ['input','output']){
  const fluids=(type==='input'?recipe.ingredients:recipe.results).filter(i=>i.type==='fluid');
  const boxes=(proto.fluid_boxes||[]).filter(b=>b.production_type===type);
  fluids.forEach((fluid,index)=>{const port=boxes[index]?.pipe_connections[0];if(!port)throw new Error('No port '+machine+' '+fluid.id);const [dx,dy]=({0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]})[port.direction];const x=cx+port.position[0]+dx,y=cy+port.position[1]+dy;
   const entity=add('pipe',x,y,{tags:{fluid:fluid.id}});ports.push({entity,fluid:fluid.id,type,x:x+dx,y:y+dy,temperature:raw.fluid[fluid.id]?.default_temperature});
  });
 }
 const setupNotes=[platform?'Space platform cell: robots cannot deliver here. Connect the left turbo belt to your asteroid supply and the right turbo belt to your product collection. Containers and robots cannot operate on a platform.':'Join a powered robot network or put at least 10 logistic robots in the included roboport. Put ingredients in provider chests; the saved requester filters and inserters feed the machine.',
 'This cell makes one recipe from the listed ingredients. Use “Plan operating supplies” to trace the upstream recipes. Connect external electricity to the substation.',
 ...(ports.length?['Connect each marked fluid inlet to its listed fluid. Keep different fluids separate.']:[]),
 ...(fuel?[`Keep ${fuel} available as machine fuel.`]:[]),
 ...(conditions.length?[`Surface requirements: ${conditions.map(c=>`${c.property} ${c.min??'−∞'} to ${c.max??'∞'}`).join('; ')}. Research requirements still apply.`]:[]),
 ...(product==='holmium-ore'?['Feed scrap. Holmium ore is a random 1% recycling yield; remove the other recycled products so output can continue.']:[]),
 ...(recipe.results.some(p=>p.probability<1)?['Results include random yields. Keep all byproducts moving; this is not a guaranteed output per craft.']:[]),
 ...(product==='biter-egg'?['Requires a captive spawner on Nauvis. Keep bioflux delivery running; use the eggs before they spoil.']:[]),
 'Supply heating on Aquilo. The cell does not include planet transport, heating, or power generation.'];
 const id='cell-'+product,file=product+'.txt';
 const blueprint={blueprint:{item:'blueprint',label:`${names.get(product)||product} · ${platform?'Platform':'Robot'} production cell`,description:setupNotes.join('\n'),version:562949958467584,icons:[{index:1,signal:{type:'item',name:product}}],entities}};
 await fs.writeFile(out+'/'+file,encodeBlueprint(blueprint)+'\n');
 manifest.push({id,file,product,recipe:recipe.id,machine,category:platform?'Platform recipe cells':'Robot recipe cells',setupNotes,ingredients,ports,conditions,platform,machineID,inputID,outputID,substationID,roboportID,entityCount:entities.length});
}
await fs.writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(out+'/README.md',`# Compact production cells\n\n${manifest.length} original single-recipe blueprints fill gaps in the imported library. Recipes use normal-quality Factorio 2.0 / Space Age machines. Each ground cell includes requesters, bulk inserters, a provider output, a substation, and a roboport. Platform cells use turbo belts and inserters because robots and storage chests cannot operate there.\n\nSupply intermediate ingredients, electricity, robots and the marked fluids. These are recipe modules, not complete factories from raw ore. The website's operating-supply planner shows the upstream chain. Surface, research, heating, spoilage and byproduct requirements remain in effect. Each blueprint description records its particular setup.\n\nNative test results in validation.json are tied to the exact blueprint strings by SHA-256. The test imports the strings into a disposable vanilla Space Age save, delivers items through saved chests and inserters (robots on ground cells), supplies fluids through the saved pipes, and checks actual output. Test electricity and external supplies are fixtures and are not part of the blueprint.\n\nRegenerate with npm run generate:cells after indexing the community collections. Revalidate with npm run test:cells before publishing.\n`);
console.log(`Generated ${manifest.length} cells.`);
