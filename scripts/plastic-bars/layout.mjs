// Plastic-bar supplier layouts. Pure geometry: no game data is read, so the generator runs on a clean checkout.
// Tile rows (y), the same in every layout:
//   -1      gas pipe row (top plants take petroleum gas through their north input connections)
//    0..2   top chemical plants, facing north
//    3      top arm row
//    4      product belt A (plastic, east to the exit)
//    5      coal belt B (from the west entrance)
//    6      bottom arm row            (two-row layouts only)
//    7..9   bottom chemical plants, facing south
//   10      bottom gas pipe row
// Native facts this relies on (probed 2026-11-22, see blueprint-sources/plastic-bars/README.md): with the plastic recipe
// a chemical plant has one fluid box (both north inputs merged, either connection feeds it); a pipe-to-ground's
// direction is its above-ground side; one long-handed arm from a full belt keeps a plant at full speed on coal; two
// long-handed arms keep up with its output; a filtered fast splitter passes plastic while the coal lane stays stuck.
import assert from 'node:assert/strict';

export const SIZE={'chemical-plant':[3,3],substation:[2,2],'fast-splitter':[2,1]};
// Layout rows below are in layout coordinates; the blueprint adds ORIGIN_SHIFT to every y.
export const ORIGIN_SHIFT=1;
export const ROW={pipeTop:-1,armTop:3,product:4,coal:5,armBottom:6,pipeBottom:10};
const N=0,E=4,S=8,W=12;

export const VARIANTS={
 // One row of plants above the two belts. Bulk arm drops plastic on A (south lane), one long-handed arm takes coal
 // from B over A. Substation in a two-column gap of the plant row (or at the east end when it reaches every plant).
 small:{plants:[1,4],substation:{x:6,y:1},exitX:7,rows:1},
 medium:{plants:[1,4,9,12,15],substation:{x:6,y:1},exitX:16,rows:1},
 // Two rows of five around the belt pair. Top as in the strip; bottom: one fast arm takes coal from B, two
 // long-handed arms drop plastic over B onto A (north lane). The bottom row has a one-column gap at column 6 and
 // ends at column 15, so its three arms per plant stay inside the substation's reach (columns -2..16 for arms
 // whose whole tile must be inside: 0..15). A pipe-to-ground pair down column 6 joins the two gas rows.
 // Exit lanes 600 + 600.
 'large-shared-aisle':{plants:[1,4,9,12,15],bottom:[1,4,8,11,14],substation:{x:6,y:1},riser:6,exitX:16,rows:2,bottomArms:'long'},
 // Screening alternative: bottom plants drop plastic with bulk arms on the north lane of the coal belt (coal kept
 // on its south lane by a side-load at the entrance); a filtered splitter at the east end sends plastic from both
 // belts to the exit and holds the coal lane. One column wider.
 'large-filter-splitter':{plants:[1,4,9,12,15],bottom:[2,5,9,12,15],substation:{x:6,y:1},riser:7,exitX:17,rows:2,bottomArms:'bulk',splitterX:16},
};

export function buildLayout(variantName){
 const v=VARIANTS[variantName];assert(v,'unknown variant '+variantName);
 let next=1;const entities=[],occupied=new Map(),key=(x,y)=>x+','+y;
 const place=(name,tx,ty,extra={})=>{
  let [w,h]=SIZE[name]||[1,1];const d=extra.direction||0;if(d===E||d===W)[w,h]=[h,w];
  for(let x=tx;x<tx+w;x++)for(let y=ty;y<ty+h;y++){assert(!occupied.has(key(x,y)),`collision ${name} at ${x},${y} with ${occupied.get(key(x,y))?.name}`);}
  // Blueprint positions are shifted one row down so that the top-left tile of the rectangle is (0,0).
  const e={entity_number:next++,name,position:{x:tx+w/2,y:ty+h/2+ORIGIN_SHIFT},...extra};
  for(let x=tx;x<tx+w;x++)for(let y=ty;y<ty+h;y++)occupied.set(key(x,y),e);
  entities.push(e);return e;
 };
 const at=(x,y)=>occupied.get(key(x,y));
 const roles={productArms:[],coalArms:[],plants:[]};
 const plant=(cx,cy,direction)=>{const e=place('chemical-plant',cx-1,cy-1,{direction,recipe:'plastic-bar'});roles.plants.push(e.entity_number);return e;};
 const arm=(name,x,y,direction,role)=>{const e=place(name,x,y,{direction,override_stack_size:name==='bulk-inserter'?2:1});roles[role].push(e.entity_number);return e;};
 const belt=(x,y,direction=E)=>place('fast-transport-belt',x,y,{direction});
 const pipe=(x,y)=>place('pipe',x,y);
 const ptg=(x,y,direction)=>place('pipe-to-ground',x,y,{direction}); // direction: the above-ground side
 const two=v.rows===2;

 // ---- plants ----
 for(const cx of v.plants)plant(cx,1,N);
 for(const cx of v.bottom||[])plant(cx,8,S);
 // ---- substation (2 x 2) ----
 const substation=place('substation',v.substation.x,v.substation.y);

 // ---- top arms: bulk at the plant's centre column drops plastic on A; long-handed takes coal from B ----
 // The filter-splitter variant has a dead-end stub at (0,5), so its first plant takes coal from (2,5).
 const topCoalX=cx=>v.bottomArms==='bulk'&&cx===1?cx+1:cx-1;
 for(const cx of v.plants){
  arm('bulk-inserter',cx,ROW.armTop,N,'productArms');               // picks from the plant (north), drops on (cx,4)
  arm('long-handed-inserter',topCoalX(cx),ROW.armTop,S,'coalArms'); // picks (cx-1,5), drops into the plant
 }
 // ---- bottom arms ----
 const bottomPicks=[],bottomDrops=[];
 if(two){
  const last=v.bottom[v.bottom.length-1];
  for(const cx of v.bottom){
   if(v.bottomArms==='long'){
    // fast arm takes coal from B (west column), two long-handed arms drop plastic on A over B.
    const coalX=cx-1,prodX=[cx,cx+1];
    arm('fast-inserter',coalX,ROW.armBottom,N,'coalArms');bottomPicks.push(coalX);
    for(const x of prodX){arm('long-handed-inserter',x,ROW.armBottom,S,'productArms');bottomDrops.push(x);}
   }else{
    // fast arm takes coal from B, bulk arm drops plastic on B's north lane.
    const coalX=cx,prodX=cx===last||at(cx+1,ROW.armBottom)?cx-1:cx+1;
    arm('fast-inserter',coalX,ROW.armBottom,N,'coalArms');bottomPicks.push(coalX);
    arm('bulk-inserter',prodX,ROW.armBottom,S,'productArms');bottomDrops.push(prodX);
   }
  }
 }

 // ---- belts ----
 const ports={};
 let coalEnd=Math.max(...v.plants.map(topCoalX),...bottomPicks);
 if(v.bottomArms==='bulk'){
  // Coal enters on row 6 and side-loads B at (1,5) from the south (south lane only); (0,5) is a dead-end stub
  // behind it so the join is a side-load, not a curve. B carries coal (south lane) and the bottom plants' plastic
  // (north lane) to the filtered splitter.
  ports.coal=belt(0,ROW.armBottom,E);belt(1,ROW.armBottom,N);belt(0,ROW.coal,E);
  for(let x=1;x<v.splitterX;x++)belt(x,ROW.coal,E);
  for(let x=1;x<v.splitterX;x++)belt(x,ROW.product,E);
  place('fast-splitter',v.splitterX,ROW.product,{direction:E,filter:{name:'plastic-bar',quality:'normal',comparator:'='},output_priority:'left'});
  ports.exit=belt(v.exitX,ROW.product,E);
 }else{
  // B ends at the last coal pick with empty tiles east of it: coal stops there and never reaches the exit.
  ports.coal=belt(0,ROW.coal,E);
  for(let x=1;x<=coalEnd;x++)belt(x,ROW.coal,E);
  for(let x=1;x<v.exitX;x++)belt(x,ROW.product,E);
  ports.exit=belt(v.exitX,ROW.product,E);
 }
 coalEnd=Math.max(...[...occupied.values()].filter(e=>e.name==='fast-transport-belt'&&Math.floor(e.position.y)===ROW.coal).map(e=>Math.floor(e.position.x)));

 // ---- gas ----
 // Top row: the port pipe at (0,-1) feeds the first plant's west input; a pipe-to-ground pair (1,-1) -> (3,-1)
 // leaves (2,-1) for the gas display panel; plain pipes from (4,-1) east to the last plant's input.
 const topConn=cx=>cx===4?5:cx-1; // (3,-1) is the pair's east end, so the second plant uses its east input
 ports.gas=pipe(0,ROW.pipeTop);ptg(1,ROW.pipeTop,W);ptg(3,ROW.pipeTop,E);
 const topEnd=Math.max(...v.plants.slice(1).map(topConn),v.riser??0);
 for(let x=4;x<=topEnd;x++)pipe(x,ROW.pipeTop);
 if(two){
  // Riser: pipe-to-ground (riser,0) up to the top row, underground to (riser,9) down to the bottom row.
  ptg(v.riser,0,N);ptg(v.riser,9,S);
  // One pipe run from the first plant's east input to the last plant's west input touches an input of every plant.
  const from=Math.min(v.bottom[0]+1,v.riser),to=Math.max(v.bottom[v.bottom.length-1]-1,v.riser);
  for(let x=from;x<=to;x++)pipe(x,ROW.pipeBottom);
 }

 // ---- display panels at the entrances ----
 const coalPanelAt=v.bottomArms==='bulk'?[0,7]:[0,ROW.product];
 const panels={coal:coalPanelAt,gas:[2,ROW.pipeTop]};

 // ---- checks ----
 // Substation supply area: 9 tiles each way from its centre; every arm's whole tile must lie inside.
 const sc={x:v.substation.x+1,y:v.substation.y+1+ORIGIN_SHIFT};
 for(const e of entities)if(/inserter/.test(e.name))assert(Math.abs(e.position.x-sc.x)<=8.5&&Math.abs(e.position.y-sc.y)<=8.5,'arm outside the substation reach '+e.position.x+','+e.position.y);
 for(const cx of v.plants)assert(at(topCoalX(cx),ROW.coal)?.name==='fast-transport-belt','top coal pick on B '+cx);
 for(const cx of v.plants)assert(at(cx,ROW.product)?.name==='fast-transport-belt'&&cx!==v.exitX,'top drop on A '+cx);
 for(const x of bottomPicks)assert(at(x,ROW.coal)?.name==='fast-transport-belt','bottom coal pick on B '+x);
 for(const x of bottomDrops)assert(at(x,v.bottomArms==='long'?ROW.product:ROW.coal)?.name==='fast-transport-belt'&&x!==v.exitX,'bottom drop '+x);
 return {variant:variantName,layout:v,entities,next,ports,panels,substation,roles,at,place,coalEnd};
}

// Bounding rectangle in tile coordinates.
export function footprintOf(entities){
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const e of entities){let [w,h]=SIZE[e.name]||[1,1];if(e.direction===E||e.direction===W)[w,h]=[h,w];
  left=Math.min(left,e.position.x-w/2);right=Math.max(right,e.position.x+w/2);top=Math.min(top,e.position.y-h/2);bottom=Math.max(bottom,e.position.y+h/2);}
 return {left,top,right,bottom,width:right-left,height:bottom-top};
}
