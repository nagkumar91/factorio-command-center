// Reviewer experiment: bury straight surface runs that nothing touches.
// A tile may be buried or become an end only if it is a plain fast belt with no control behaviour,
// no wire, no arm picking from or dropping on it, no side input, a straight predecessor and a straight successor.
const STEP = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};
export function buryStraightRuns(bp, ports, {maxSpan = 7, minTiles = 4} = {}) {
  const fx = e => Math.floor(e.position.x), fy = e => Math.floor(e.position.y), key = (x, y) => x + ',' + y;
  const at = new Map();
  for (const e of bp.entities) {
    const d = e.direction ?? 0;
    if (e.name === 'fast-splitter') { const cells = d === 0 || d === 8 ? [[e.position.x - 1, e.position.y - .5], [e.position.x, e.position.y - .5]] : [[e.position.x - .5, e.position.y - 1], [e.position.x - .5, e.position.y]]; for (const [x, y] of cells) at.set(key(x, y), e); }
    else if (/belt/.test(e.name)) at.set(key(fx(e), fy(e)), e);
  }
  const wired = new Set(bp.wires.flatMap(w => [w[0], w[2]]));
  const touched = new Set(ports.map(p => p.entity));
  for (const a of bp.entities) if (a.name.endsWith('inserter')) { const [dx, dy] = STEP[a.direction ?? 0], r = a.name === 'long-handed-inserter' ? 2 : 1;
    for (const s of [1, -1]) { const t = at.get(key(fx(a) + s * dx * r, fy(a) + s * dy * r)); if (t) touched.add(t.entity_number); } }
  const emitsInto = (n, x, y) => { // does transport entity n push items into tile (x, y)?
    if (!n) return false; const d = n.direction ?? 0, [dx, dy] = STEP[d];
    if (n.name === 'fast-underground-belt' && n.type === 'input') return false;
    if (n.name === 'fast-splitter') { for (const [k, v] of at) if (v === n) { const [cx, cy] = k.split(',').map(Number); if (cx + dx === x && cy + dy === y) return true; } return false; }
    return fx(n) + dx === x && fy(n) + dy === y;
  };
  const plain = e => e && e.name === 'fast-transport-belt' && !e.control_behavior && !wired.has(e.entity_number) && !touched.has(e.entity_number);
  const ok = e => {
    if (!plain(e)) return false;
    const d = e.direction ?? 0, [dx, dy] = STEP[d], x = fx(e), y = fy(e);
    const behind = at.get(key(x - dx, y - dy)), ahead = at.get(key(x + dx, y + dy));
    if (!behind || behind.name !== 'fast-transport-belt' || (behind.direction ?? 0) !== d) return false;
    if (!ahead || ahead.name !== 'fast-transport-belt' || (ahead.direction ?? 0) !== d) return false;
    for (const [sx, sy] of Object.values(STEP)) { if (sx === -dx && sy === -dy) continue; if (emitsInto(at.get(key(x + sx, y + sy)), x, y)) return false; }
    return true;
  };
  const pairing = () => { // game-like pairing: nearest same-axis underground ahead must be a same-direction output
    const ug = new Map(); for (const e of bp.entities) if (e.name === 'fast-underground-belt' && !remove.has(e.entity_number)) ug.set(key(fx(e), fy(e)), e);
    const out = new Map();
    for (const e of ug.values()) { const d = e.direction ?? 0, [dx, dy] = STEP[d], s = e.type === 'input' ? 1 : -1; let partner = null;
      for (let k = 1; k <= maxSpan; k++) { const o = ug.get(key(fx(e) + s * dx * k, fy(e) + s * dy * k)); if (!o || (o.direction ?? 0) % 8 !== d % 8) continue; if ((o.direction ?? 0) === d && o.type !== e.type) partner = o.entity_number; break; }
      out.set(e.entity_number, partner); }
    return out;
  };
  const remove = new Set(), pairs = [], seen = new Set();
  const expected = pairing();
  const same = () => { const now = pairing(); for (const [id, p] of expected) if (now.get(id) !== p) return false; return now.size === expected.size; };
  for (const start of [...bp.entities]) {
    if (seen.has(start.entity_number) || !ok(start)) continue;
    const d = start.direction ?? 0, [dx, dy] = STEP[d];
    let first = start;
    for (;;) { const p = at.get(key(fx(first) - dx, fy(first) - dy)); if (p && (p.direction ?? 0) === d && ok(p)) first = p; else break; }
    const run = [];
    for (let e = first; e && (e.direction ?? 0) === d && ok(e) && !seen.has(e.entity_number); e = at.get(key(fx(e) + dx, fy(e) + dy))) { run.push(e); seen.add(e.entity_number); }
    for (let i = 0; run.length - i >= minTiles;) {
      let n = Math.min(maxSpan + 1, run.length - i), done = false;
      for (; n >= minTiles; n--) {
        const seg = run.slice(i, i + n);
        const mid = seg.slice(1, -1), a = seg[0], b = seg.at(-1);
        a.name = 'fast-underground-belt'; a.type = 'input'; b.name = 'fast-underground-belt'; b.type = 'output';
        for (const e of mid) remove.add(e.entity_number);
        expected.set(a.entity_number, b.entity_number); expected.set(b.entity_number, a.entity_number);
        if (!same()) { a.name = b.name = 'fast-transport-belt'; delete a.type; delete b.type; for (const e of mid) remove.delete(e.entity_number); expected.delete(a.entity_number); expected.delete(b.entity_number); continue; }
        pairs.push([a.entity_number, b.entity_number, n]);
        i += n; done = true; break;
      }
      if (!done) i++;
    }
  }
  bp.entities = bp.entities.filter(e => !remove.has(e.entity_number));
  return {saved: remove.size, pairs: pairs.length};
}
