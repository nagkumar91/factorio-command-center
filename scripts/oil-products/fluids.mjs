// Fluid-network model for the oil-products generator: which fluid boxes connect, and what fluid each network carries.
// It encodes only what native probes in Factorio 2.1.24 showed (see blueprint-sources/oil-products/README.md,
// "Mechanics proved natively"); the native run of the exact blueprint stays the judge.
//  - pipe: connects on all four sides.
//  - pipe-to-ground facing d: a normal connection on side d, an underground connection on side d+8 that pairs with
//    the nearest pipe-to-ground on that axis facing back, ends at most 10 tiles apart (11 apart does not pair).
//    A perpendicular pipe-to-ground between the ends does not interrupt or join the pair.
//  - pump facing d: 2 tiles; output on the front tile's side d, input on the back tile's side d+8.
//  - storage tank (2 directions): direction 0 connects the north-west tile north and west and the south-east tile
//    east and south; direction 4 is that turned a quarter.
//  - oil refinery and chemical plant: the connection table measured with get_fluid_box_pipe_connections (direction
//    0, unmirrored), turned by direction and flipped along the facing axis when mirrored, filtered by recipe.
const V={0:[0,-1],4:[1,0],8:[0,1],12:[-1,0]};
const rot=([x,y],d)=>{for(let i=0;i<d/4;i++)[x,y]=[-y,x];return [x,y];};
const rotDir=(d,by)=>(d+by)%16;
// Measured natively (probe p1): target tile relative to the machine centre, side, box role, for direction 0 unmirrored.
// Roles name the recipe's fluid slots: in1/in2 inputs, out1..out3 outputs (in recipe order).
const MACHINE={
 'oil-refinery':[{t:[-1,3],d:8,role:'in1'},{t:[1,3],d:8,role:'in2'},{t:[-2,-3],d:0,role:'out1'},{t:[0,-3],d:0,role:'out2'},{t:[2,-3],d:0,role:'out3'}],
 'chemical-plant':[{t:[-1,-2],d:0,role:'in1'},{t:[1,-2],d:0,role:'in2'},{t:[-1,2],d:8,role:'outA'},{t:[1,2],d:8,role:'outB'}],
};
// Recipe slot fluids exactly as the probe reported them (2.1 merges boxes when a recipe uses fewer fluids).
export const RECIPE_SLOTS={
 'advanced-oil-processing':{in1:'water',in2:'crude-oil',out1:'heavy-oil',out2:'light-oil',out3:'petroleum-gas'},
 'light-oil-cracking':{in1:'water',in2:'light-oil',outA:'petroleum-gas',outB:'petroleum-gas'},
 'heavy-oil-cracking':{in1:'water',in2:'heavy-oil',outA:'light-oil',outB:'light-oil'},
 'sulfur':{in1:'water',in2:'petroleum-gas'},
 'sulfuric-acid':{in1:'water',in2:'water',outA:'sulfuric-acid',outB:'sulfuric-acid'},
 'lubricant':{in1:'heavy-oil',in2:'heavy-oil',outA:'lubricant',outB:'lubricant'},
};
const INPUT_ROLES=new Set(['in1','in2']);
export function machineConnections(e){
 const table=MACHINE[e.name];if(!table)return [];
 const slots=RECIPE_SLOTS[e.recipe];if(!slots)throw Error('no slot table for '+e.recipe);
 const d=e.direction||0,cx=Math.floor(e.position.x),cy=Math.floor(e.position.y);
 const out=[];
 for(const c of table){
  const fluid=slots[c.role];if(!fluid)continue;
  let [tx,ty]=c.t,side=c.d;
  if(e.mirror){tx=-tx;if(side===4||side===12)side=rotDir(side,8);} // flip across the facing axis (direction 0: x flips)
  [tx,ty]=rot([tx,ty],d);side=rotDir(side,d);
  const target={x:cx+tx,y:cy+ty},[vx,vy]=V[side];
  out.push({tile:{x:target.x-vx,y:target.y-vy},side,target,fluid,role:c.role,input:INPUT_ROLES.has(c.role),box:e.recipe==='sulfuric-acid'||e.recipe==='lubricant'?(INPUT_ROLES.has(c.role)?'in':'out'):(c.role.startsWith('out')&&e.name==='chemical-plant'?'out':c.role)});
 }
 return out;
}
export function tilesOf(e,size){
 const [w0,h0]=size(e.name);let w=w0,h=h0;if([4,12].includes(e.direction))[w,h]=[h,w];
 const r=[];for(let x=Math.floor(e.position.x-w/2+.01);x<e.position.x+w/2-.01;x++)for(let y=Math.floor(e.position.y-h/2+.01);y<e.position.y+h/2-.01;y++)r.push({x,y});return r;
}
// Build connection endpoints for every fluid entity. Returns {nodes, edges, problems}.
export function fluidNetworks(entities,size){
 const key=(x,y)=>x+','+y,byTile=new Map();
 for(const e of entities)for(const t of tilesOf(e,size))byTile.set(key(t.x,t.y),e);
 const ends=[]; // {e, box, tile, side, kind:'normal'|'ug', fluid?}
 for(const e of entities){
  const tx=Math.floor(e.position.x),ty=Math.floor(e.position.y),d=e.direction||0;
  if(e.name==='pipe')for(const s of [0,4,8,12])ends.push({e,box:'p',tile:{x:tx,y:ty},side:s,kind:'normal'});
  else if(e.name==='pipe-to-ground'){ends.push({e,box:'p',tile:{x:tx,y:ty},side:d,kind:'normal'});ends.push({e,box:'p',tile:{x:tx,y:ty},side:rotDir(d,8),kind:'ug'});}
  else if(e.name==='pump'){const [vx,vy]=V[d],ts=tilesOf(e,size);const front=ts.reduce((a,b)=>(b.x*vx+b.y*vy>a.x*vx+a.y*vy?b:a)),back=ts.reduce((a,b)=>(b.x*vx+b.y*vy<a.x*vx+a.y*vy?b:a));
   ends.push({e,box:'out',tile:front,side:d,kind:'normal'});ends.push({e,box:'in',tile:back,side:rotDir(d,8),kind:'normal'});}
  else if(e.name==='storage-tank'){const cx=Math.floor(e.position.x),cy=Math.floor(e.position.y);
   const spec=d===0?[[-1,-1,0],[-1,-1,12],[1,1,4],[1,1,8]]:[[1,-1,0],[1,-1,4],[-1,1,8],[-1,1,12]];
   for(const [ox,oy,s] of spec)ends.push({e,box:'t',tile:{x:cx+ox,y:cy+oy},side:s,kind:'normal'});}
  else for(const c of machineConnections(e))ends.push({e,box:c.box,tile:c.tile,side:c.side,kind:'normal',fluid:c.fluid,input:c.input,role:c.role});
 }
 const id=end=>end.e.entity_number+':'+end.box;
 const edges=[],problems=[];
 const normalAt=new Map();for(const n of ends)if(n.kind==='normal'){const k=key(n.tile.x,n.tile.y)+':'+n.side;normalAt.set(k,[...(normalAt.get(k)||[]),n]);}
 for(const n of ends){
  if(n.kind==='normal'){const [vx,vy]=V[n.side],t={x:n.tile.x+vx,y:n.tile.y+vy};
   for(const m of normalAt.get(key(t.x,t.y)+':'+rotDir(n.side,8))||[])if(m.e!==n.e&&id(n)<id(m))edges.push([id(n),id(m),n,m]);}
  else{const [vx,vy]=V[n.side];let paired=null;
   for(let k=1;k<=10;k++){const o=byTile.get(key(n.tile.x+vx*k,n.tile.y+vy*k));if(!o||o.name!=='pipe-to-ground')continue;const od=o.direction||0;
    if(od===n.side||od===rotDir(n.side,8)){ if(od===n.side){paired=o;}else problems.push(`pipe-to-ground ${n.e.entity_number} at ${n.tile.x},${n.tile.y} meets one facing the same way at ${o.position.x-.5},${o.position.y-.5}`);break;}}
   if(!paired)problems.push(`unpaired underground of pipe-to-ground ${n.e.entity_number} at ${n.tile.x},${n.tile.y}`);
   else if(n.e.entity_number<paired.entity_number)edges.push([id(n),paired.entity_number+':p',n,null]);}
 }
 // components
 const parent=new Map(),find=a=>{while(parent.get(a)!==a){parent.set(a,parent.get(parent.get(a)));a=parent.get(a);}return a;},add=a=>{if(!parent.has(a))parent.set(a,a);};
 for(const n of ends)add(id(n));for(const [a,b] of edges){add(a);add(b);parent.set(find(a),find(b));}
 const comps=new Map();for(const n of ends){const r=find(id(n));const c=comps.get(r)||{fluids:new Set(),members:new Set(),ends:[]};c.members.add(id(n));if(n.fluid)c.fluids.add(n.fluid);c.ends.push(n);comps.set(r,c);}
 for(const c of comps.values())if(c.fluids.size>1)problems.push('mixed network: '+[...c.fluids].join(' + ')+' at '+c.ends.filter(n=>n.fluid).map(n=>n.e.name+'@'+n.tile.x+','+n.tile.y+'('+n.fluid+')').slice(0,8).join(' '));
 return {ends,edges,comps:[...comps.values()],componentOf:n=>comps.get(find(id(n))),problems,id,find};
}
