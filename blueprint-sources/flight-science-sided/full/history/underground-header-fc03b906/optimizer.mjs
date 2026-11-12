// Conservative, deterministic underground conversion for straight surface-belt runs.
// Pinned from .cache/flight-21/script-output/data-raw-dump.json (Factorio 2.1):
// fast-underground-belt.max_distance = 7.
export const PINNED_MAX_DISTANCE = 7;
export const UNDERGROUND_BELT_NAME = 'fast-underground-belt';

const STEP = new Map([[0, [0, -1]], [4, [1, 0]], [8, [0, 1]], [12, [-1, 0]]]);
const transportBeltName = name => /^(?:transport-belt|fast-transport-belt|express-transport-belt|turbo-transport-belt)$/.test(name || '');
const eligibleBeltName = name => name === 'fast-transport-belt';
const undergroundName = name => /^(?:underground-belt|fast-underground-belt|express-underground-belt|turbo-underground-belt)$/.test(name || '');
const splitterName = name => /^(?:splitter|fast-splitter|express-splitter|turbo-splitter)$/.test(name || '');
const posKey = (x, y) => `${x},${y}`;
const coord = e => [Number.isFinite(e.position?.x) ? e.position.x : NaN, Number.isFinite(e.position?.y) ? e.position.y : NaN];
const idOf = e => e.entity_number;
const splitterCells = e => {
  const [x,y]=coord(e); if(!splitterName(e.name)) return [[x,y]];
  const across = e.direction === 0 || e.direction === 8 ? [1,0] : [0,1];
  return [[x-across[0]*0.5,y-across[1]*0.5],[x+across[0]*0.5,y+across[1]*0.5]];
};

function allEntityReferences(blueprint) {
  const refs = new Set();
  const seen = new Set();
  function walk(value, key = '') {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      if ((k === 'entity_id' || k === 'entity_number') && Number.isInteger(v)) refs.add(v);
      walk(v, k);
    }
  }
  for (const w of blueprint.wires || []) if (Array.isArray(w)) { if (Number.isInteger(w[0])) refs.add(w[0]); if (Number.isInteger(w[2])) refs.add(w[2]); }
  for (const e of blueprint.entities || []) walk(e.connections || []);
  return refs;
}

function circuitLinkedIds(blueprint, nativeComponentIds) {
  const graph = new Map();
  const link = (a, b) => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) return;
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a).add(b); graph.get(b).add(a);
  };
  const wires = blueprint.wires || [];
  for (const w of wires) if (Array.isArray(w)) link(w[0], w[2]);
  function scanConnections(owner, value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const v of value) scanConnections(owner, v); return; }
    if (Number.isInteger(value.entity_id)) link(owner, value.entity_id);
    for (const v of Object.values(value)) scanConnections(owner, v);
  }
  for (const e of blueprint.entities || []) scanConnections(idOf(e), e.connections);
  const byId = new Map((blueprint.entities || []).map(e => [idOf(e), e]));
  const seeds = new Set();
  for (const e of blueprint.entities || []) {
    const cb = e.control_behavior || {};
    const readsBelt = Object.keys(cb).some(k => /read.*(?:belt|hand|contents)|(?:belt|hand).*read/i.test(k)) ||
      Object.entries(cb).some(([k, v]) => /read/i.test(k) && v === true);
    if (readsBelt || (e.tags && /read.?all.?belt/i.test(JSON.stringify(e.tags)))) seeds.add(idOf(e));
  }
  const protectedIds = new Set(seeds);
  const stack = [...seeds];
  while (stack.length) for (const n of graph.get(stack.pop()) || []) if (!protectedIds.has(n)) { protectedIds.add(n); stack.push(n); }

  // Without an exact caller-supplied native component, conservatively protect the
  // whole physically adjacent belt network. Native mode replaces only this broad
  // approximation; reader and wire graph anchors above remain protected.
  const beltAt = new Map();
  for (const e of blueprint.entities || []) if (transportBeltName(e.name) || undergroundName(e.name) || splitterName(e.name)) {
    const [x, y] = coord(e); if (Number.isFinite(x) && Number.isFinite(y)) beltAt.set(posKey(x, y), e);
  }
  const beltQueue = [...protectedIds].map(n => byId.get(n)).filter(e => {
    return e && (transportBeltName(e.name) || undergroundName(e.name) || splitterName(e.name));
  });
  const visited = new Set(beltQueue.map(idOf));
  const cellsToEntity = new Map();
  for(const e of blueprint.entities||[]) if(transportBeltName(e.name)||undergroundName(e.name)||splitterName(e.name)) for(const [x,y] of splitterCells(e)) cellsToEntity.set(posKey(x,y),e);
  const undergroundLinks = new Map();
  for(const a of blueprint.entities||[]) if(undergroundName(a.name)&&a.type==='input') {
    const [x,y]=coord(a), [dx,dy]=STEP.get(a.direction)||[]; if(dx===undefined)continue;
    const max=7;
    for(let n=1;n<=max;n++){const b=cellsToEntity.get(posKey(x+dx*n,y+dy*n));if(b&&undergroundName(b.name)&&b.name===a.name&&b.direction===a.direction&&b.type==='output'){undergroundLinks.set(idOf(a),b);undergroundLinks.set(idOf(b),a);break;}}
  }
  while (nativeComponentIds === undefined && beltQueue.length) {
    const e = beltQueue.pop();
    const cells=splitterCells(e);
    const candidates=[];
    for(const [x,y] of cells) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {const n=cellsToEntity.get(posKey(x+dx,y+dy));if(n)candidates.push(n);}
    const mate=undergroundLinks.get(idOf(e));if(mate)candidates.push(mate);
    for(const n of candidates) {
      if (!visited.has(idOf(n))) { visited.add(idOf(n)); beltQueue.push(n); }
    }
  }
  return new Set([...protectedIds, ...(nativeComponentIds === undefined ? visited : nativeComponentIds)]);
}

function tagIsPort(tags = {}) {
  return Object.keys(tags).some(k => /(?:^|_)(?:flight_)?(?:input|output|external_port|port)(?:_|$)/i.test(k)) ||
    Object.entries(tags).some(([k, v]) => /(?:input|output|external.?port)/i.test(k) && v !== false && v != null);
}

function inserterOffsets(name) {
  // Values pinned to the 2.1 raw dump: standard pickup (0,-1), drop (0,1.2);
  // long-handed pickup (0,-2), drop (0,2.2). Other/custom inserters are opaque.
  if (['inserter','fast-inserter','bulk-inserter','stack-inserter','burner-inserter'].includes(name)) return [[0,-1],[0,1.2]];
  if (name === 'long-handed-inserter') return [[0,-2],[0,2.2]];
  return null;
}
function entityInserterOffsets(e) {
  const pickup=e.pickup_position, drop=e.drop_position||e.insert_position;
  if((pickup!==undefined&&!Array.isArray(pickup))||(drop!==undefined&&!Array.isArray(drop)))return null;
  if(Array.isArray(pickup)&&Array.isArray(drop)) return [pickup,drop];
  if(pickup!==undefined||drop!==undefined) {
    const defaults=inserterOffsets(e.name); if(!defaults)return null;
    return [pickup||defaults[0],drop||defaults[1]];
  }
  return inserterOffsets(e.name);
}
function rotateOffset([x, y], direction) {
  const turns = direction / 4, a = turns * Math.PI / 2;
  return [Math.round(x * Math.cos(a) - y * Math.sin(a)), Math.round(x * Math.sin(a) + y * Math.cos(a))];
}

function addReason(reasons, entity, reason) {
  if (!reasons.has(idOf(entity))) reasons.set(idOf(entity), new Set());
  reasons.get(idOf(entity)).add(reason);
}

function isTaggedReader(e) {
  const cb = e.control_behavior || {};
  return Object.keys(cb).some(k => /read.*(?:belt|hand|contents)|(?:belt|hand).*read/i.test(k)) ||
    Object.entries(cb).some(([k,v]) => /read/i.test(k) && v === true) ||
    (e.tags && /circulation|read.?all.?belt/i.test(JSON.stringify(e.tags)));
}

function analyze(blueprint, protectedEntityNumbers, nativeComponentIds) {
  const entities = blueprint.entities || [];
  const reasons = new Map();
  const byId = new Map(entities.map(e => [idOf(e), e]));
  const beltAt = new Map();
  for (const e of entities) if (transportBeltName(e.name) || undergroundName(e.name) || splitterName(e.name)) {
    const [x,y] = coord(e); if (Number.isFinite(x) && Number.isFinite(y)) beltAt.set(posKey(x,y), e);
  }
  for (const id of protectedEntityNumbers) if (byId.has(id)) addReason(reasons, byId.get(id), 'explicitly-protected');
  const refIds = allEntityReferences(blueprint);
  for (const id of refIds) if (byId.has(id)) addReason(reasons, byId.get(id), 'blueprint-reference-or-wire');

  const circuitIds = circuitLinkedIds(blueprint,nativeComponentIds);
  for (const id of circuitIds) if (byId.has(id) && (transportBeltName(byId.get(id).name) || undergroundName(byId.get(id).name) || splitterName(byId.get(id).name)))
    addReason(reasons, byId.get(id), 'circuit-reader-network');

  for (const e of entities) {
    if (tagIsPort(e.tags)) addReason(reasons, e, 'explicit-external-port');
    if (transportBeltName(e.name) && e.control_behavior && Object.keys(e.control_behavior).length) addReason(reasons, e, 'belt-control-behavior');
    const offsets = entityInserterOffsets(e);
    if (offsets) {
      const [x,y] = coord(e); const direction = e.direction ?? 0; const d = STEP.get(direction);
      if (d && Number.isFinite(x) && Number.isFinite(y)) for (const off of offsets) {
        const [dx,dy] = rotateOffset(off,direction);
        const tile = beltAt.get(posKey(x+dx,y+dy)); if (tile) addReason(reasons,tile,'inserter-pickup-or-drop-tile');
      }
    }
    if (splitterName(e.name)) {
      for(const [x,y] of splitterCells(e)) for (let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) { const tile=beltAt.get(posKey(x+dx,y+dy)); if(tile)addReason(reasons,tile,'splitter-contact-zone'); }
    }
  }
  for (const e of entities) if (transportBeltName(e.name) && e.tags?.role && /branch|side.?load|turn|port|tap/i.test(String(e.tags.role))) addReason(reasons,e,'tagged-branch-turn-or-port');

  const underground = entities.filter(e => undergroundName(e.name));
  const forbiddenTunnelCells = new Set();
  for (const u of underground) {
    const [x,y] = coord(u), d = STEP.get(u.direction);
    if (!d) continue;
    // Reserve both directions up to the maximum reach. This avoids changing the
    // game's nearest-compatible-endpoint selection around any existing endpoint.
    for (let n=-PINNED_MAX_DISTANCE;n<=PINNED_MAX_DISTANCE;n++) forbiddenTunnelCells.add(posKey(x+d[0]*n,y+d[1]*n));
    addReason(reasons,u,'existing-underground-pair-interference');
  }
  return {reasons, beltAt, forbiddenTunnelCells, entities};
}

/**
 * Optimize a Factorio blueprint wrapper. Returns a detached wrapper and its inner
 * blueprint, deterministic metrics, exact endpoint pair plans, and rejection reasons.
 */
export function optimizeBlueprint(wrapper, { maxDistance = PINNED_MAX_DISTANCE, minSpan = 5, protectedEntityNumbers = [], nativeReadAllBeltComponentEntityNumbers, nativeReadAllBeltComponentBaselineSha256 } = {}) {
  if (!wrapper || typeof wrapper !== 'object') throw new TypeError('wrapper must be an object');
  if (!Number.isInteger(maxDistance) || maxDistance < 2 || maxDistance > PINNED_MAX_DISTANCE) throw new RangeError(`maxDistance must be an integer from 2 to ${PINNED_MAX_DISTANCE}`);
  if (!Number.isInteger(minSpan) || minSpan < 2 || minSpan > maxDistance) throw new RangeError(`minSpan must be an integer from 2 to maxDistance (${maxDistance})`);
  if (!Array.isArray(protectedEntityNumbers) || protectedEntityNumbers.some(n => !Number.isInteger(n))) throw new TypeError('protectedEntityNumbers must be an array of integer entity numbers');
  const outWrapper = structuredClone(wrapper);
  const path = outWrapper.blueprint ? ['blueprint'] : outWrapper.blueprint_book ? null : [];
  if (path === null) throw new TypeError('blueprint books are not supported; pass one blueprint wrapper');
  const blueprint = path.length ? outWrapper.blueprint : outWrapper;
  if (!Array.isArray(blueprint.entities)) throw new TypeError('wrapper must contain blueprint.entities');
  const originalUnderground=blueprint.entities.filter(e=>undergroundName(e.name)).map(e=>structuredClone(e));
  const entityById=new Map(blueprint.entities.map(e=>[idOf(e),e]));
  let nativeIds;
  if(nativeReadAllBeltComponentEntityNumbers!==undefined) {
    if(!Array.isArray(nativeReadAllBeltComponentEntityNumbers)||nativeReadAllBeltComponentEntityNumbers.some(n=>!Number.isInteger(n))) throw new TypeError('nativeReadAllBeltComponentEntityNumbers must be an array of integer entity numbers');
    if(typeof nativeReadAllBeltComponentBaselineSha256!=='string'||! /^[a-f0-9]{64}$/.test(nativeReadAllBeltComponentBaselineSha256)) throw new TypeError('native exact component IDs require nativeReadAllBeltComponentBaselineSha256');
    nativeIds=new Set(nativeReadAllBeltComponentEntityNumbers);
    const unknown=[...nativeIds].filter(id=>!entityById.has(id)||!(transportBeltName(entityById.get(id).name)||undergroundName(entityById.get(id).name)||splitterName(entityById.get(id).name)));
    const readerSeeds=blueprint.entities.filter(e=>{const cb=e.control_behavior||{};return Object.keys(cb).some(k=>/read.*(?:belt|hand|contents)|(?:belt|hand).*read/i.test(k))||Object.entries(cb).some(([k,v])=>/read/i.test(k)&&v===true)||(e.tags&&/read.?all.?belt/i.test(JSON.stringify(e.tags)));}).map(idOf);
    const missingReaders=readerSeeds.filter(id=>!nativeIds.has(id));
    if(unknown.length||missingReaders.length) return {wrapper:outWrapper,blueprint,metrics:{entityCountBefore:blueprint.entities.length,entityCountAfter:blueprint.entities.length,placedEntitySavings:0,surfaceBeltsRemoved:0,undergroundEndpointsAdded:0,undergroundPairs:0,maxDistance,minSpan,prototypeMaxDistance:PINNED_MAX_DISTANCE,aborted:'invalid-native-read-all-component',readAllProtectionMode:'native-exact'},changePairs:[],preservedExistingPairs:[],rejections:[...unknown.map(entityNumber=>({entityNumber,reason:'unknown-native-component-entity'})),...missingReaders.map(entityNumber=>({entityNumber,reason:'native-component-missing-reader'}))]};
  }
  const {reasons,beltAt,forbiddenTunnelCells,entities} = analyze(blueprint, protectedEntityNumbers,nativeIds);
  const unknownInserters=entities.filter(e=>/inserter/i.test(e.name||'') && !entityInserterOffsets(e));
  if(unknownInserters.length) return {wrapper:outWrapper,blueprint,metrics:{entityCountBefore:entities.length,entityCountAfter:entities.length,placedEntitySavings:0,surfaceBeltsRemoved:0,undergroundEndpointsAdded:0,undergroundPairs:0,maxDistance,prototypeMaxDistance:PINNED_MAX_DISTANCE,aborted:'unknown-inserter-geometry'},changePairs:[],rejections:unknownInserters.map(e=>({entityNumber:idOf(e),reason:'unknown-inserter-geometry'}))};
  const removed = new Set(), pairs = [], acceptedCells = new Set();
  const rejected = [];
  const starts = entities.filter(e => eligibleBeltName(e.name) && STEP.has(e.direction)).sort((a,b)=>idOf(a)-idOf(b));
  const visitedSegments = new Set();

  for (const start of starts) {
    const [sx,sy]=coord(start), [dx,dy]=STEP.get(start.direction);
    const prev=beltAt.get(posKey(sx-dx,sy-dy));
    if (prev && eligibleBeltName(prev.name) && prev.direction===start.direction && prev.name===start.name) continue;
    const run=[]; let cur=start, x=sx, y=sy;
    while(cur && eligibleBeltName(cur.name) && cur.name===start.name && cur.direction===start.direction) {
      const sig=`${idOf(cur)}`; if(visitedSegments.has(sig))break; visitedSegments.add(sig);run.push(cur);
      x+=dx;y+=dy;cur=beltAt.get(posKey(x,y));
    }
    // Mark only actual contact tiles. Parallel neighboring belts remain eligible.
    for(let i=0;i<run.length;i++) {
      const [x0,y0]=coord(run[i]);
      for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const n=beltAt.get(posKey(x0+ax,y0+ay)); if(!n || n===run[i])continue;
        const parallel = n.direction===start.direction;
        if(!parallel) { addReason(reasons,run[i],'branch-turn-or-side-contact'); addReason(reasons,n,'branch-turn-or-side-contact'); }
      }
    }

    let i=0;
    while(i<run.length) {
      if(reasons.has(idOf(run[i]))) { i++; continue; }
      let end=i;
      while(end+1<run.length && !reasons.has(idOf(run[end+1]))) end++;
      // Dynamic programming selects disjoint spans with maximum total interior
      // removals, then the fewest pairs, then the lexicographically longest spans.
      const n=end-i+1, dp=Array(n+1); dp[n]={removed:0,pairs:[],lengths:[]};
      for(let k=n-1;k>=0;k--) {
        let best={...dp[k+1],pairs:[...dp[k+1].pairs],lengths:[...dp[k+1].lengths]};
        for(let j=k+minSpan;j<n&&j<=k+maxDistance;j++) {
          const span=run.slice(i+k,i+j+1);
          if(span.some(e=>forbiddenTunnelCells.has(posKey(...coord(e)))||acceptedCells.has(posKey(...coord(e)))))continue;
          const tail=dp[j+1], candidate={removed:j-k-1+tail.removed,pairs:[[i+k,i+j],...tail.pairs],lengths:[j-k,...tail.lengths]};
          if(candidate.removed>best.removed||(candidate.removed===best.removed&&candidate.pairs.length<best.pairs.length)||(candidate.removed===best.removed&&candidate.pairs.length===best.pairs.length&&candidate.lengths.join(',')>best.lengths.join(',')))best=candidate;
        }
        dp[k]=best;
      }
      for(const [aIndex,bIndex] of dp[0].pairs) {
        const a=run[aIndex],b=run[bIndex],axy=coord(a),bxy=coord(b),interior=run.slice(aIndex+1,bIndex);
        a.type='input'; b.type='output'; a.name=UNDERGROUND_BELT_NAME; b.name=UNDERGROUND_BELT_NAME;
        for(const e of interior)removed.add(idOf(e));
        for(const e of run.slice(aIndex,bIndex+1))acceptedCells.add(posKey(...coord(e)));
        pairs.push({inputEntityNumber:idOf(a),outputEntityNumber:idOf(b),inputPosition:{x:axy[0],y:axy[1]},outputPosition:{x:bxy[0],y:bxy[1]},direction:a.direction,endpointDistance:bIndex-aIndex,removedInteriorEntityNumbers:interior.map(idOf)});
      }
      i=end+1;
    }
  }
  blueprint.entities=entities.filter(e=>!removed.has(idOf(e)));
  const before=entities.length, after=blueprint.entities.length;
  const preservedExistingPairs=[];
  for(const a of originalUnderground) if(a.type==='input') {
    const [x,y]=coord(a), [dx,dy]=STEP.get(a.direction)||[]; let mate;
    if(dx!==undefined) for(let n=1;n<=PINNED_MAX_DISTANCE;n++){const b=originalUnderground.find(candidate=>candidate.name===a.name&&candidate.direction===a.direction&&candidate.type==='output'&&candidate.position.x===x+dx*n&&candidate.position.y===y+dy*n);if(b){mate=b;break;}}
    preservedExistingPairs.push({inputEntityNumber:idOf(a),outputEntityNumber:mate?idOf(mate):null,endpointDistance:mate?Math.abs(mate.position.x-a.position.x)+Math.abs(mate.position.y-a.position.y):null});
  }
  const metrics={entityCountBefore:before,entityCountAfter:after,placedEntitySavings:before-after,surfaceBeltsRemoved:removed.size,undergroundEndpointsAdded:pairs.length*2,undergroundPairs:pairs.length,preservedExistingUndergroundPairs:preservedExistingPairs.length,preservedExistingUndergroundEndpoints:originalUnderground.length,maxDistance,minSpan,prototypeMaxDistance:PINNED_MAX_DISTANCE,readAllProtectionMode:nativeIds?'native-exact':'conservative-physical'};
  return {wrapper:outWrapper,blueprint,metrics,changePairs:pairs,preservedExistingPairs,preservedExistingEntityNumbers:originalUnderground.map(idOf),rejections:rejected.sort((a,b)=>a.entityNumber-b.entityNumber||a.reason.localeCompare(b.reason))};
}
