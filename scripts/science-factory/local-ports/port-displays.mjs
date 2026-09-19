export function addInputDisplays(blueprint, info, raw) {
  const occupied = new Set();
  const key = (x,y) => `${x},${y}`;
  const prototypes = new Map(Object.values(raw).flatMap(group => Object.entries(group || {})));
  for (const entity of blueprint.entities) {
    const box = prototypes.get(entity.name)?.selection_box || [[-.5,-.5],[.5,.5]];
    let width = Math.ceil(box[1][0]-box[0][0]), height = Math.ceil(box[1][1]-box[0][1]);
    if ([4,12].includes(entity.direction)) [width,height]=[height,width];
    for(let x=Math.floor(entity.position.x-width/2);x<entity.position.x+width/2;x++)
      for(let y=Math.floor(entity.position.y-height/2);y<entity.position.y+height/2;y++) occupied.add(key(x,y));
  }
  for(const port of info.ports) {
    const delta={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[port.externalSide];
    if(delta) occupied.add(key(Math.floor(port.x+delta[0]),Math.floor(port.y+delta[1])));
  }
  let next=Math.max(...blueprint.entities.map(entity=>entity.entity_number))+1;
  for(const port of info.ports.filter(port=>['input','fluid'].includes(port.kind))) {
    const offsets=[[0,-1],[0,1],[1,-1],[1,1],[-1,-1],[-1,1],[0,-2],[0,2],[1,-2],[1,2],[-1,-2],[-1,2]];
    const offset=offsets.find(([dx,dy])=>!occupied.has(key(Math.floor(port.x+dx),Math.floor(port.y+dy))));
    if(!offset) throw Error('No clear input display position for '+port.label);
    const [dx,dy]=offset, entity_number=next++;
    occupied.add(key(Math.floor(port.x+dx),Math.floor(port.y+dy)));
    blueprint.entities.push({entity_number,name:'display-panel',position:{x:port.x+dx,y:port.y+dy},
      icon:{type:port.kind==='fluid'?'fluid':'item',name:port.items[0]},
      text:`${port.label} ${dy<0?'↓':'↑'}\nConnect ${port.kind==='fluid'?'pipe':'fast belt'} from the ${port.externalSide} at (${port.x}, ${port.y}).${port.kind==='input'?' Both lanes accept this material.':''}`,
      always_show:true,show_in_chart:false,tags:{starter_entity:entity_number,input_display:port.entity}});
    port.displayEntity=entity_number;
  }
  info.inputDisplays={optional:true,requiredTechnology:'circuit-network'};
  info.setupNotes.splice(2,0,'Match each input display to its nearby entrance. Connect from the indicated side; both belt lanes accept the shown raw material. Alt shows the labels.');
  return info;
}
