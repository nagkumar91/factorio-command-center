// Decorative input signs share the port's item, position and letter. Keep this
// separate from routing so labels never alter the tested production layout.
export const inputDisplayNote='Each input has an item/fluid display directly above its belt or pipe. Connect from the left; both belt lanes take the shown material. Press Alt to see the labels. Display panels need Circuit network research: leave their ghosts unbuilt until then; production works without the signs.';

export function addInputDisplays(blueprint,info){
 const oldDisplays=new Set(blueprint.entities.filter(e=>e.name==='display-panel'&&e.tags?.input_display).map(e=>e.entity_number));
 blueprint.entities=blueprint.entities.filter(e=>!oldDisplays.has(e.entity_number));
 let next=Math.max(...blueprint.entities.map(e=>e.entity_number))+1;
 for(const port of info.ports.filter(p=>['input','fluid'].includes(p.kind))){
  if(port.items.length!==1||port.externalSide!=='west')throw Error('Input display needs a single material and a west-facing entrance');
  const entity_number=next++,position={x:port.x,y:port.y-1};
  const fluid=port.kind==='fluid';
  blueprint.entities.push({entity_number,name:'display-panel',position,
   icon:{type:fluid?'fluid':'item',name:port.items[0]},
   text:port.label+' ↓\n'+(fluid?'Connect the pipe from the left, directly below this display.':'Feed the yellow belt from the left, directly below this display. Both lanes take this material.'),
   always_show:true,show_in_chart:false,
   tags:{starter_entity:entity_number,input_display:port.entity}});
  port.displayEntity=entity_number;
 }
 info.inputDisplays={optional:true,requiredTechnology:'circuit-network'};
 info.setupNotes=info.setupNotes.filter(n=>n!==inputDisplayNote);
 info.setupNotes.splice(2,0,inputDisplayNote);
 blueprint.description=(blueprint.description||'').split('\n').filter(n=>n!==inputDisplayNote).concat(inputDisplayNote).join('\n');
 return info;
}
