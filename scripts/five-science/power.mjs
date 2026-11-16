/** Add power after production/export structures and before new routing.
 * Requires a pole-free layout with place(entity), entities, wires and next.
 * place must register integer-centred 2x2 substations in the routing grid.
 * Only new poles/copper wires and the single power port are written.
 */
export function powerFiveLayout(layout, ports, raw) {
  const prototypes = new Map();
  for (const group of Object.values(raw)) for (const p of Object.values(group || {}))
    if (p && typeof p === 'object' && p.name && p.selection_box) prototypes.set(p.name, p);
  const proto = name => { const p = prototypes.get(name); if (!p) throw Error(`Missing prototype: ${name}`); return p; };
  const poleTypes = raw['electric-pole'] || {};
  for (const name of ['substation', 'medium-electric-pole']) {
    const p = proto(name);
    if (!(p.supply_area_distance > 0 && p.maximum_wire_distance > 0)) throw Error(`Invalid pole prototype: ${name}`);
  }
  if (layout.entities.some(e => poleTypes[e.name]) || (layout.wires || []).some(w => w[1] === 5 || w[3] === 5))
    throw Error('powerFiveLayout requires poles and copper wires stripped first');
  const powerPorts = ports.filter(p => p.kind === 'power');
  if (powerPorts.length > 1) throw Error('Expected a single power port');
  const key = (x, y) => `${x},${y}`;
  const box = e => {
    const b = proto(e.name).selection_box;
    let w = Math.ceil(b[1][0] - b[0][0]), h = Math.ceil(b[1][1] - b[0][1]);
    if (e.name === 'display-panel') w = h = 1;
    if ([4, 12].includes(e.direction)) [w, h] = [h, w];
    return {left:e.position.x-w/2, right:e.position.x+w/2, top:e.position.y-h/2, bottom:e.position.y+h/2};
  };
  const cells = e => {
    const b = box(e), result = [];
    for (let x = Math.floor(b.left); x < b.right - 1e-6; x++)
      for (let y = Math.floor(b.top); y < b.bottom - 1e-6; y++) result.push(key(x,y));
    return result;
  };
  const occupied = new Set(layout.entities.flatMap(cells)), reserved = new Set();
  for (const p of ports) {
    if (p.kind === 'power') continue;
    const x = p.x ?? p.position?.x, y = p.y ?? p.position?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Port position required');
    let side = p.externalSide;
    if (!side && ['input','fluid','fluid-output','output'].includes(p.kind)) {
      const d = (p.direction ?? 4) / 4;
      side = (p.kind === 'input' || p.kind === 'fluid') ? ['south','west','north','east'][d] : ['north','east','south','west'][d];
    }
    const v = {west:[-1,0],east:[1,0],north:[0,-1],south:[0,1]}[side];
    if (v) for (let n = 0; n <= 3; n++) reserved.add(key(Math.floor(x)+v[0]*n, Math.floor(y)+v[1]*n));
  }
  const free = e => cells(e).every(k => !occupied.has(k) && !reserved.has(k));
  const consumers = layout.entities.filter(e => proto(e.name).energy_source?.type === 'electric');
  const covers = (p, e) => {
    const b = proto(e.name).collision_box;
    if (!b) throw Error(`Missing collision box: ${e.name}`);
    let w = (b[1][0]-b[0][0])/2, h = (b[1][1]-b[0][1])/2;
    if ([4,12].includes(e.direction)) [w,h] = [h,w];
    const r = proto(p.name).supply_area_distance;
    return Math.abs(p.position.x-e.position.x) < r+w-.001 && Math.abs(p.position.y-e.position.y) < r+h-.001;
  };
  const distance = (a,b) => Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);
  const reachable = (a,b) => distance(a,b) <= Math.min(proto(a.name).maximum_wire_distance,proto(b.name).maximum_wire_distance)+1e-6;
  const bounds = layout.entities.map(box);
  const margin = Math.ceil(proto('substation').maximum_wire_distance);
  const left = Math.floor((bounds.length ? Math.min(...bounds.map(b=>b.left)) : 0))-margin;
  const right = Math.ceil((bounds.length ? Math.max(...bounds.map(b=>b.right)) : 0))+margin;
  const top = Math.floor((bounds.length ? Math.min(...bounds.map(b=>b.top)) : 0))-margin;
  const bottom = Math.ceil((bounds.length ? Math.max(...bounds.map(b=>b.bottom)) : 0))+margin;
  const candidates = [];
  for (const name of ['substation','medium-electric-pole']) {
    const offset = name === 'substation' ? 0 : .5;
    for (let x=left+offset; x<=right; x++) for (let y=top+offset; y<=bottom; y++) {
      const e={name,position:{x,y}};
      if (free(e)) candidates.push({e,covered:consumers.map((c,i)=>covers(e,c)?i:-1).filter(i=>i>=0)});
    }
  }
  let next = Math.max(layout.next || 1, ...layout.entities.map(e=>e.entity_number+1));
  const poles=[];
  const add = candidate => {
    const e={...candidate,position:{...candidate.position},entity_number:next++,tags:{five_science_power:true}};
    poles.push(e); for (const k of cells(e)) occupied.add(k); return e;
  };
  const uncovered=new Set(consumers.map((_,i)=>i));
  const target=powerPorts[0];
  const dockPoint={position:{x:target?.x ?? left+margin,y:target?.y ?? top+margin}};
  while (uncovered.size || !poles.length) {
    let best;
    for (const name of ['substation','medium-electric-pole']) {
      for (const c of candidates) {
        if (c.e.name!==name || !free(c.e)) continue;
        const gain=c.covered.reduce((n,i)=>n+uncovered.has(i),0);
        if (!gain && poles.length) continue;
        const near=poles.length?Math.min(...poles.map(p=>distance(p,c.e))):distance(dockPoint,c.e);
        const score=gain*10000+c.covered.length-near;
        if (!best || score>best.score) best={...c,score};
      }
      if (best) break; // Medium poles only when no substation can cover the remaining cells.
    }
    if (!best) throw Error(`No power placement for consumers: ${[...uncovered].map(i=>consumers[i].entity_number)}`);
    add(best.e); for (const i of best.covered) uncovered.delete(i);
  }
  // The nearest chosen substation is the sole external electricity marker.
  poles.sort((a,b)=>Number(b.name==='substation')-Number(a.name==='substation') || distance(a,dockPoint)-distance(b,dockPoint));
  const tree = list => {
    const seen=new Set([list[0]]),degree=new Map(),wires=[];
    while(seen.size<list.length) {
      let best;
      for(const a of seen) if((degree.get(a)||0)<5) for(const b of list) if(!seen.has(b)&&reachable(a,b)) {
        const d=distance(a,b); if(!best||d<best.d)best={a,b,d};
      }
      if(!best)break;
      const {a,b}=best;seen.add(b);degree.set(a,(degree.get(a)||0)+1);degree.set(b,1);
      wires.push([a.entity_number,5,b.entity_number,5]);
    }
    return {seen,degree,wires};
  };
  let bridges=0;
  for (;;) {
    const t=tree(poles); if(t.seen.size===poles.length)break;
    const wired=[...t.seen].filter(p=>(t.degree.get(p)||0)<5), unwired=poles.filter(p=>!t.seen.has(p));
    const old=Math.min(...wired.flatMap(a=>unwired.map(b=>distance(a,b))));
    let best;
    for(const name of ['substation','medium-electric-pole']) {
      for(const c of candidates) {
        if(c.e.name!==name||!free(c.e)||!wired.some(a=>reachable(a,c.e)))continue;
        const d=Math.min(...unwired.map(b=>distance(c.e,b)));
        if(d>=old-.001)continue;
        if(!best||d<best.d)best={...c,d};
      }
      if(best)break;
    }
    if(!best || bridges++ > candidates.length)throw Error('Cannot bridge power grid with five links per pole');
    add(best.e);
  }
  // Prune only our planned poles, before touching the caller's layout.
  for(let i=poles.length-1;i>0;i--) {
    const rest=poles.filter((_,j)=>j!==i);
    if(consumers.every(e=>rest.some(p=>covers(p,e)))&&tree(rest).seen.size===rest.length)poles.splice(i,1);
  }
  const t=tree(poles);
  if(t.seen.size!==poles.length||!consumers.every(e=>poles.some(p=>covers(p,e))))throw Error('Power verification failed');
  const dock=poles[0]; dock.tags.five_science_power_dock=true;
  for(const p of poles)layout.place(p);
  layout.next=next; layout.wires ??=[]; layout.wires.push(...t.wires);
  const power=target || {kind:'power',label:'External electricity'};
  Object.assign(power,{entity:dock.entity_number,x:dock.position.x,y:dock.position.y,position:{...dock.position}});
  if(!target)ports.push(power);
  return {substations:poles.filter(p=>p.name==='substation').length,mediumPoles:poles.filter(p=>p.name==='medium-electric-pole').length,
    totalPoles:poles.length,bridges,copperWires:t.wires.length,consumers:consumers.length,coveredConsumers:consumers.length,
    connected:true,maxCopperDegree:Math.max(0,...t.degree.values()),dock:dock.entity_number,poles,wires:t.wires};
}
