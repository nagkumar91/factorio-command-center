// Copy of scripts/essentials-mall/power.mjs (itself a copy of scripts/five-science/power.mjs restricted to a production rectangle).
// Candidates must lie fully inside `bounds` ({left, top, right, bottom} in tile
// edges), so power never grows the footprint. Medium poles are fill-ins only.
// `allow` optionally whitelists positions: {substation: [[x, y], ...], medium: [[x, y], ...]}
// (substation positions are integer centres, medium positions tile corners).
export function powerInsideLayout(layout, ports, raw, bounds, {maxMediumPoles = 4, allow} = {}) {
  const prototypes = new Map();
  for (const group of Object.values(raw)) for (const p of Object.values(group || {}))
    if (p && typeof p === 'object' && p.name && p.selection_box) prototypes.set(p.name, p);
  const proto = name => { const p = prototypes.get(name); if (!p) throw Error(`Missing prototype: ${name}`); return p; };
  const poleTypes = raw['electric-pole'] || {};
  if (layout.entities.some(e => poleTypes[e.name]) || (layout.wires || []).some(w => w[1] === 5 || w[3] === 5))
    throw Error('powerInsideLayout requires poles and copper wires stripped first');
  const powerPorts = ports.filter(p => p.kind === 'power');
  if (powerPorts.length > 1) throw Error('Expected a single power port');
  const key = (x, y) => `${x},${y}`;
  const box = e => {
    const b = proto(e.name).selection_box;
    let w = Math.ceil(b[1][0] - b[0][0]), h = Math.ceil(b[1][1] - b[0][1]);
    if (e.name === 'display-panel') w = h = 1;
    if ([4, 12].includes(e.direction)) [w, h] = [h, w];
    return {left: e.position.x - w / 2, right: e.position.x + w / 2, top: e.position.y - h / 2, bottom: e.position.y + h / 2};
  };
  const cells = e => {
    const b = box(e), result = [];
    for (let x = Math.floor(b.left); x < b.right - 1e-6; x++)
      for (let y = Math.floor(b.top); y < b.bottom - 1e-6; y++) result.push(key(x, y));
    return result;
  };
  const occupied = new Set(layout.entities.flatMap(cells)), reserved = new Set();
  for (const p of ports) {
    if (p.kind === 'power') continue;
    const v = {west: [-1, 0], east: [1, 0]}[p.externalSide];
    if (v) for (let n = 0; n <= 3; n++) reserved.add(key(Math.floor(p.x) + v[0] * n, Math.floor(p.y) + v[1] * n));
  }
  const inside = e => { const b = box(e); return b.left >= bounds.left - 1e-6 && b.right <= bounds.right + 1e-6 && b.top >= bounds.top - 1e-6 && b.bottom <= bounds.bottom + 1e-6; };
  const free = e => inside(e) && cells(e).every(k => !occupied.has(k) && !reserved.has(k));
  const consumers = layout.entities.filter(e => proto(e.name).energy_source?.type === 'electric');
  const covers = (p, e) => {
    const b = proto(e.name).collision_box;
    let w = (b[1][0] - b[0][0]) / 2, h = (b[1][1] - b[0][1]) / 2;
    if ([4, 12].includes(e.direction)) [w, h] = [h, w];
    const r = proto(p.name).supply_area_distance;
    return Math.abs(p.position.x - e.position.x) < r + w - .001 && Math.abs(p.position.y - e.position.y) < r + h - .001;
  };
  const distance = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
  const reachable = (a, b) => distance(a, b) <= Math.min(proto(a.name).maximum_wire_distance, proto(b.name).maximum_wire_distance) + 1e-6;
  const candidates = [];
  for (const name of ['substation', 'medium-electric-pole']) {
    const offset = name === 'substation' ? 0 : .5;
    for (let x = bounds.left + offset; x <= bounds.right; x++) for (let y = bounds.top + offset; y <= bounds.bottom; y++) {
      const e = {name, position: {x, y}};
      const list = allow?.[name === 'substation' ? 'substation' : 'medium'];
      if (list && !list.some(([ax, ay]) => ax + offset === x && ay + offset === y)) continue;
      if (free(e)) candidates.push({e, covered: consumers.map((c, i) => covers(e, c) ? i : -1).filter(i => i >= 0)});
    }
  }
  let next = Math.max(layout.next || 1, ...layout.entities.map(e => e.entity_number + 1));
  const poles = [];
  const add = candidate => {
    const e = {...candidate, position: {...candidate.position}, entity_number: next++, tags: {five_science_power: true}};
    poles.push(e); for (const k of cells(e)) occupied.add(k); return e;
  };
  const uncovered = new Set(consumers.map((_, i) => i));
  while (uncovered.size) {
    let best;
    for (const name of ['substation', 'medium-electric-pole']) {
      for (const c of candidates) {
        if (c.e.name !== name || !free(c.e)) continue;
        const gain = c.covered.reduce((n, i) => n + uncovered.has(i), 0);
        if (!gain) continue;
        const near = poles.length ? Math.min(...poles.map(p => distance(p, c.e))) : 0;
        const score = gain * 10000 + c.covered.length - near;
        if (!best || score > best.score) best = {...c, score};
      }
      if (best) break;
    }
    if (!best) throw Error(`No power placement inside the rectangle for consumers: ${[...uncovered].map(i => consumers[i].entity_number)}`);
    add(best.e); for (const i of best.covered) uncovered.delete(i);
  }
  const tree = list => {
    const seen = new Set([list[0]]), degree = new Map(), wires = [];
    while (seen.size < list.length) {
      let best;
      for (const a of seen) if ((degree.get(a) || 0) < 5) for (const b of list) if (!seen.has(b) && reachable(a, b)) {
        const d = distance(a, b); if (!best || d < best.d) best = {a, b, d};
      }
      if (!best) break;
      const {a, b} = best; seen.add(b); degree.set(a, (degree.get(a) || 0) + 1); degree.set(b, (degree.get(b) || 0) + 1);
      wires.push([a.entity_number, 5, b.entity_number, 5]);
    }
    return {seen, degree, wires};
  };
  let bridges = 0;
  for (;;) {
    const t = tree(poles); if (t.seen.size === poles.length) break;
    const wired = [...t.seen], unwired = poles.filter(p => !t.seen.has(p));
    const old = Math.min(...wired.flatMap(a => unwired.map(b => distance(a, b))));
    let best;
    for (const name of ['substation', 'medium-electric-pole']) {
      for (const c of candidates) {
        if (c.e.name !== name || !free(c.e) || !wired.some(a => reachable(a, c.e))) continue;
        const d = Math.min(...unwired.map(b => distance(c.e, b)));
        if (d >= old - .001) continue;
        if (!best || d < best.d) best = {...c, d};
      }
      if (best) break;
    }
    if (!best || bridges++ > candidates.length) throw Error('Cannot bridge power grid inside the rectangle');
    add(best.e);
  }
  for (let i = poles.length - 1; i >= 0; i--) {
    const rest = poles.filter((_, j) => j !== i);
    if (rest.length && consumers.every(e => rest.some(p => covers(p, e))) && tree(rest).seen.size === rest.length) poles.splice(i, 1);
  }
  const t = tree(poles);
  if (t.seen.size !== poles.length || !consumers.every(e => poles.some(p => covers(p, e)))) throw Error('Power verification failed');
  const mediumPoles = poles.filter(p => p.name === 'medium-electric-pole').length;
  if (mediumPoles > maxMediumPoles) throw Error(`Power needs ${mediumPoles} medium poles; at most ${maxMediumPoles} allowed`);
  // The westmost substation is the single external electricity marker.
  poles.sort((a, b) => Number(b.name === 'substation') - Number(a.name === 'substation') || a.position.x - b.position.x || a.position.y - b.position.y);
  const dock = poles[0]; dock.tags.five_science_power_dock = true;
  for (const p of poles) layout.place(p);
  layout.next = next; layout.wires.push(...t.wires);
  const power = powerPorts[0] || {kind: 'power', label: 'External electricity'};
  Object.assign(power, {entity: dock.entity_number, x: dock.position.x, y: dock.position.y, position: {...dock.position}});
  if (!powerPorts.length) ports.push(power);
  return {substations: poles.length - mediumPoles, mediumPoles, poles, wires: t.wires, dock: dock.entity_number};
}
