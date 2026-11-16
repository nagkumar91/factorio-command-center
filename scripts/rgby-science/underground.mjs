// Mutates only blueprint.entities, after a complete candidate safety check.
// Accepts a blueprint body or {blueprint: body}; does not read/write artifacts.
const STEP = new Map([[0,[0,-1]],[4,[1,0]],[8,[0,1]],[12,[-1,0]]]);
const SURFACE = 'fast-transport-belt', UNDERGROUND = 'fast-underground-belt';
const MAX_SPAN = 7, MIN_SPAN = 4;
const key = (x,y) => `${x},${y}`;
const direction = e => e.direction ?? 0;
const isSurface = e => /^(?:(?:fast|express|turbo)-)?transport-belt$/.test(e.name);
const isUnderground = e => /^(?:(?:fast|express|turbo)-)?underground-belt$/.test(e.name);
const isSplitter = e => /^(?:(?:fast|express|turbo)-)?splitter$/.test(e.name);
const isTransport = e => isSurface(e) || isUnderground(e) || isSplitter(e);
function cells(e) {
 const {x,y}=e.position;
 if(!isSplitter(e)) return [[x,y]];
 return [0,8].includes(direction(e)) ? [[x-.5,y],[x+.5,y]] : [[x,y-.5],[x,y+.5]];
}
function references(bp) {
 const refs = new Set();
 for(const w of bp.wires ?? []) { if(Array.isArray(w)){refs.add(w[0]);refs.add(w[2]);} }
 function scan(v) {
  if(!v || typeof v!=='object') return;
  for(const [k,n] of Object.entries(v)) {
   if((k==='entity_id'||k==='entity_number') && Number.isInteger(n)) refs.add(n);
   else scan(n);
  }
 }
 for(const e of bp.entities) {
  if(e.connections || e.wires || e.neighbours) refs.add(e.entity_number);
  scan(e.connections);scan(e.wires);
  for(const n of e.neighbours ?? []) refs.add(n);
 }
 return refs;
}
// Endpoint matching is reciprocal. Preserve existing orphan endpoints as null;
// reject ambiguous matches instead of repairing somebody else's geometry.
function pairings(entities) {
 const ends=entities.filter(e=>e.name===UNDERGROUND), pairs=new Map();
 for(const e of ends) {
  const step=STEP.get(direction(e));
  if(!step || !['input','output'].includes(e.type)) return null;
  const sign=e.type==='input'?1:-1;
  let nearest, distance=Infinity;
  for(const other of ends) {
   if(other===e || other.type===e.type || direction(other)!==direction(e)) continue;
   const dx=other.position.x-e.position.x,dy=other.position.y-e.position.y;
   const span=(dx*step[0]+dy*step[1])*sign;
   if(dx*step[1]!==dy*step[0] || !Number.isInteger(span) || span<1 || span>MAX_SPAN) continue;
   if(span<distance){nearest=other;distance=span;}
  }
  pairs.set(e.entity_number,nearest?.entity_number ?? null);
 }
 for(const [a,b] of pairs) if(b!==null && pairs.get(b)!==a) return null;
 return pairs;
}
function counts(entities) {
 return {entities:entities.length,redSurfaceBelts:entities.filter(e=>e.name===SURFACE).length,redUndergroundBelts:entities.filter(e=>e.name===UNDERGROUND).length};
}

/**
 * optimizeUnderground(blueprint, ports=[]) -> report
 * Edits blueprint.entities in place, preserving all other blueprint fields and
 * all supplied ports. On unsafe pre-existing geometry it returns aborted and
 * makes no changes. Endpoint IDs/tags survive; wires are never removed/changed.
 * before/after count placed entities and both red belt types; saved is the
 * number of removed middle entities. Native qualification belongs to caller.
 */
export function optimizeUnderground(blueprint, ports=[]) {
 const bp=blueprint.blueprint ?? blueprint;
 if(!Array.isArray(bp.entities)) throw new TypeError('Expected blueprint entities');
 if(!Array.isArray(ports)) throw new TypeError('Expected ports array');
 const before=counts(bp.entities),report={before,after:{...before},saved:0,maxEndpointSpan:MAX_SPAN,minEndpointSpan:MIN_SPAN,pairs:[],protectedEntities:0,nativeValidationRequired:true};
 const abort=reason=>({...report,aborted:reason});
 const byId=new Map(),at=new Map();
 for(const e of bp.entities) {
  if(!Number.isInteger(e.entity_number)||byId.has(e.entity_number)||!Number.isFinite(e.position?.x)||!Number.isFinite(e.position?.y))return abort('Invalid or duplicate entity identity/position');
  byId.set(e.entity_number,e);
  if(isTransport(e)) {
   if(!STEP.has(direction(e)))return abort('Unsupported transport direction');
   for(const [x,y] of cells(e)) {const k=key(x,y);if(at.has(k))return abort('Overlapping transport geometry');at.set(k,e);}
  }
 }
 const oldPairs=pairings(bp.entities);
 if(!oldPairs) return abort('Existing red underground endpoints are invalid or ambiguous');
 report.existingUnpairedEndpoints=[...oldPairs].filter(([,partner])=>partner===null).map(([id])=>id);
 const protectedIds=references(bp);
 const protect=(e)=>{if(e)protectedIds.add(e.entity_number);};
 function protectAround(x,y,radius) {
  for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)protect(at.get(key(x+dx,y+dy)));
 }
 for(const p of ports) {
  const id=p.entity ?? p.entityNumber ?? p.entity_number;
  if(id!==undefined && !byId.has(id))return abort('Port references a missing entity');
  protect(byId.get(id));
  const position=p.position ?? byId.get(id)?.position;
  const x=p.x ?? position?.x,y=p.y ?? position?.y;
  if(!Number.isFinite(x)||!Number.isFinite(y))return abort('Port has no usable position');
  protectAround(x,y,3);
 }
 for(const e of bp.entities) {
  if(Object.hasOwn(e.tags ?? {},'rgby_component') || e.control_behavior || e.connections || e.wires || e.items)protect(e);
  if(isSplitter(e)||isUnderground(e))for(const [x,y] of cells(e))protectAround(x,y,1);
  if(/inserter$/.test(e.name)) {
   // Covers ordinary and long-handed pickups/drops plus their adjacent tiles.
   protectAround(e.position.x,e.position.y,3);
   for(const field of ['pickup_position','drop_position','insert_position'])if(e[field]) {
    const p=e[field],x=p.x ?? p[0],y=p.y ?? p[1];
    if(Number.isFinite(x)&&Number.isFinite(y)) {
     protectAround(x,y,1); // absolute custom vectors
     for(const [dx,dy] of [[x,y],[-y,x],[-x,-y],[y,-x]])protectAround(e.position.x+dx,e.position.y+dy,1);
    }
   }
  }
 }
 // Protect turns, missing neighbours, side-loading sources and destinations.
 // A candidate tile must have matching surface neighbours before AND after it;
 // it must have exactly one incoming edge, from its straight predecessor.
 for(const e of bp.entities.filter(isSurface)) {
  const [dx,dy]=STEP.get(direction(e)),{x,y}=e.position;
  const behind=at.get(key(x-dx,y-dy)),ahead=at.get(key(x+dx,y+dy));
  if(!behind||!ahead||!isSurface(behind)||!isSurface(ahead)||direction(behind)!==direction(e)||direction(ahead)!==direction(e))protectAround(x,y,1);
  for(const [sx,sy] of STEP.values()) {
   const neighbour=at.get(key(x+sx,y+sy));
   if(!neighbour || !isTransport(neighbour))continue;
   const [nx,ny]=STEP.get(direction(neighbour));
   const emits=!isUnderground(neighbour)||neighbour.type==='output';
   if(emits && nx===-sx && ny===-sy && (sx!==-dx||sy!==-dy)) {
    protectAround(x,y,1);protect(neighbour);
   }
  }
 }
 report.protectedEntities=protectedIds.size;
 const eligible=e=>e?.name===SURFACE && !protectedIds.has(e.entity_number);
 const handled=new Set(),removed=new Set();
 let working=bp.entities;
 for(const start of bp.entities) {
  if(!eligible(start)||handled.has(start.entity_number))continue;
  const [dx,dy]=STEP.get(direction(start));
  // Visit each maximal straight run once, in transport direction.
  let first=start;
  while(true) {const prev=at.get(key(first.position.x-dx,first.position.y-dy));if(!eligible(prev)||direction(prev)!==direction(start))break;first=prev;}
  const run=[];
  for(let e=first;eligible(e)&&direction(e)===direction(start)&&!handled.has(e.entity_number);e=at.get(key(e.position.x+dx,e.position.y+dy))) {run.push(e);handled.add(e.entity_number);}
  for(let i=0;i+MIN_SPAN<run.length;) {
   let accepted=false;
   for(let span=Math.min(MAX_SPAN,run.length-1-i);span>=MIN_SPAN;span--) {
    const segment=run.slice(i,i+span+1),a=segment[0],b=segment.at(-1);
    const input={...a,name:UNDERGROUND,type:'input'},output={...b,name:UNDERGROUND,type:'output'};
    const middle=new Set(segment.slice(1,-1).map(e=>e.entity_number));
    const candidate=working.filter(e=>!middle.has(e.entity_number)).map(e=>e.entity_number===a.entity_number?input:e.entity_number===b.entity_number?output:e);
    const [vx,vy]=STEP.get(direction(a));
    if(working.some(e=>e.name===UNDERGROUND&&direction(e)===(direction(a)+8)%16&&(e.position.x-a.position.x)*vy===(e.position.y-a.position.y)*vx&&Math.min(Math.abs((e.position.x-a.position.x)*vx+(e.position.y-a.position.y)*vy),Math.abs((e.position.x-b.position.x)*vx+(e.position.y-b.position.y)*vy))<=MAX_SPAN))continue;
    const pairs=pairings(candidate);
    if(!pairs || pairs.get(a.entity_number)!==b.entity_number || [...oldPairs].some(([id,partner])=>pairs.get(id)!==partner))continue;
    // All previously accepted new pairs must also retain their exact partners.
    if(report.pairs.some(p=>pairs.get(p.input)!==p.output||pairs.get(p.output)!==p.input))continue;
    working=candidate;
    for(const id of middle)removed.add(id);
    report.pairs.push({input:a.entity_number,output:b.entity_number,direction:direction(a),span,removed:[...middle]});
    i+=span+1;accepted=true;break;
   }
   if(!accepted)i++;
  }
 }
 if(report.pairs.length)bp.entities=working;
 report.after=counts(bp.entities);report.saved=removed.size;
 return report;
}
