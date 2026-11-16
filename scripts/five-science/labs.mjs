import{makeLabAnnex}from'../rgby-science/labs.mjs';
/** Two mixed-pair belts and one purple line on each lab row's outside edge. */
export function makeFiveLabs(raw,{rows=2,columns=15}={}){
 const a=makeLabAnnex(raw,{rows,columns}),entities=a.entities.filter(e=>!e.name.endsWith('electric-pole'));let next=Math.max(...a.entities.map(e=>e.entity_number))+1;
 const add=(name,x,y,extra={})=>{const e={entity_number:next++,name,position:{x,y},...extra,tags:{rgby_component:'five-pack-labs'}};entities.push(e);return e;};
 const ports=[...a.ports];for(let row=0;row<rows;row++){const y=row===0?-1.5:11.5;for(let x=0;x<columns*3;x++)add('fast-transport-belt',x+.5,y,{direction:4});
  const belt=entities.find(e=>e.name==='fast-transport-belt'&&e.position.x===.5&&e.position.y===y);for(let col=0;col<columns;col++)add('fast-inserter',1.5+3*col,row===0?-.5:10.5,{direction:row===0?0:8,use_filters:true,filters:[{index:1,name:'production-science-pack',quality:'normal',comparator:'='}]});
  ports.push({kind:'input',item:'production-science-pack',items:['production-science-pack'],label:row===0?'Purple · north lab row':'Purple · south lab row',entity:belt.entity_number,x:.5,y,position:{x:.5,y},direction:4,externalSide:'west'});
 }
 for(const e of entities)e.tags={...e.tags,flight_science_entity:e.entity_number,rgby_component:'five-pack-labs'};return{...a,entities,wires:[],ports,footprint:{left:0,top:-2,right:columns*3,bottom:rows===1?6:12,width:columns*3,height:rows===1?8:14},metadata:{...a.metadata,packCount:5,thirdBelt:'Production science, outer edge of each lab row'}};
}
