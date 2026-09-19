export const starterMachineUpgrades={'assembling-machine-1':'assembling-machine-2','stone-furnace':'steel-furnace'};
export const starterMachineResearch={'assembling-machine-2':'automation-2','steel-furnace':'advanced-material-processing','medium-electric-pole':'electric-energy-distribution-1','big-electric-pole':'electric-energy-distribution-1'};

export function starterMachineFor(recipe,raw){
 const category=recipe.category||'crafting';
 return category==='smelting'?'steel-furnace':['assembling-machine-2','chemical-plant','oil-refinery'].find(id=>raw['assembling-machine'][id]?.crafting_categories.includes(category));
}

export function starterMachineNote(entities){
 const names=new Set(entities.map(e=>e.name)),machines=[],research=[];
 if(names.has('assembling-machine-2')){machines.push('assembling machine 2');research.push('Automation 2');}
 if(names.has('steel-furnace')){machines.push('steel furnaces');research.push('Advanced material processing');}
 return machines.length?'Production equipment: '+machines.join(' and ')+'. Research '+research.join(' and ')+' before building. '+(names.has('steel-furnace')?'Steel furnaces use the labeled coal supply.':'Power comes from the external grid.'):
  'Production equipment: chemical plants and/or oil refineries, as required by the recipe. Power comes from the external grid.';
}
