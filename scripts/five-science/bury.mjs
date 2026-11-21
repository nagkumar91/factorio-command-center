/** Second tunnelling pass for the connecting belts this family adds.
 *
 * The shared first pass (rgby-science/underground.mjs) leaves a belt on the
 * surface when any splitter, tunnel end or inserter is within one to three
 * tiles, even in a neighbouring row that never touches it. A connecting belt
 * that runs beside the four-pack core's own tunnels therefore stayed on the
 * surface for its whole length. This pass buries those runs. A tile is buried
 * only when it is a plain carrier: fed by the belt straight behind it, feeding
 * the belt straight ahead, with no belt pointing into its side, no inserter
 * picking from it or dropping on it, and no circuit wire.
 *
 * buryPlainRuns(bp, {eligible, keep}) edits bp.entities in place and returns
 * {pairs, removed}. Only red belts for which `eligible(entity)` holds are
 * considered (the callers pass their own connecting belts, never the core or
 * an imported block); `keep` lists entity numbers that must stay as they are
 * (ports, route ends).
 */
const STEP = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};
const BELT = 'fast-transport-belt', TUNNEL = 'fast-underground-belt', SPLITTER = 'fast-splitter';
const MAX_SPAN = 7, MIN_SPAN = 4;
const key = (x, y) => x + ',' + y;
const dir = e => e.direction ?? 0;
const cell = e => [Math.floor(e.position.x), Math.floor(e.position.y)];

function transportCells(e) {
  if (e.name !== SPLITTER) return [cell(e)];
  const {x, y} = e.position;
  return [0, 8].includes(dir(e)) ? [[x - 1, y - .5], [x, y - .5]] : [[x - .5, y - 1], [x - .5, y]];
}

/** The game's pairing: an entrance takes the first same-line tunnel end ahead. */
function partners(entities) {
  const ends = new Map();
  for (const e of entities) if (e.name === TUNNEL) ends.set(key(...cell(e)), e);
  const result = new Map();
  for (const e of ends.values()) {
    if (e.type !== 'input') continue;
    const [dx, dy] = STEP[dir(e)], [x, y] = cell(e);
    let partner = null;
    for (let n = 1; n <= MAX_SPAN; n++) {
      const other = ends.get(key(x + dx * n, y + dy * n));
      if (!other || dir(other) % 8 !== dir(e) % 8) continue;
      if (dir(other) !== dir(e)) return null;          // opposed ends in reach: never create these
      partner = other.type === 'output' ? other.entity_number : null;
      break;
    }
    result.set(e.entity_number, partner);
  }
  return result;
}

export function buryPlainRuns(bp, {eligible = () => true, keep = []} = {}) {
  const at = new Map(), kept = new Set(keep), blockedTiles = new Set();
  for (const e of bp.entities) {
    if (![BELT, TUNNEL, SPLITTER].includes(e.name)) continue;
    for (const [x, y] of transportCells(e)) at.set(key(x, y), e);
  }
  for (const w of bp.wires ?? []) { kept.add(w[0]); kept.add(w[2]); }
  for (const e of bp.entities) {
    if (e.control_behavior) kept.add(e.entity_number);
    if (!/inserter$/.test(e.name)) continue;
    const reach = e.name === 'long-handed-inserter' ? 2 : 1, [dx, dy] = STEP[dir(e)], [x, y] = cell(e);
    blockedTiles.add(key(x + dx * reach, y + dy * reach));
    blockedTiles.add(key(x - dx * reach, y - dy * reach));
  }
  const surface = (e, d) => e?.name === BELT && dir(e) === d;
  const plain = e => {
    if (e?.name !== BELT || !eligible(e) || kept.has(e.entity_number)) return false;
    const d = dir(e), [dx, dy] = STEP[d], [x, y] = cell(e);
    if (blockedTiles.has(key(x, y))) return false;
    if (!surface(at.get(key(x - dx, y - dy)), d) || !surface(at.get(key(x + dx, y + dy)), d)) return false;
    for (const [sx, sy] of [[-dy, dx], [dy, -dx]]) {
      const side = at.get(key(x + sx, y + sy));
      if (!side || side.name === TUNNEL && side.type === 'input') continue;
      const [fx, fy] = STEP[dir(side)];
      if (fx === -sx && fy === -sy) return false;       // a belt, tunnel exit or splitter feeds this side
    }
    return true;
  };
  const before = partners(bp.entities);
  if (!before) return {pairs: [], removed: 0, aborted: 'opposed tunnel ends already in reach'};
  const handled = new Set(), pairs = [];
  let working = bp.entities;
  for (const start of bp.entities) {
    if (handled.has(start.entity_number) || !plain(start)) continue;
    const d = dir(start), [dx, dy] = STEP[d];
    let first = start;
    for (;;) {
      const [x, y] = cell(first), behind = at.get(key(x - dx, y - dy));
      if (!plain(behind) || dir(behind) !== d) break;
      first = behind;
    }
    const run = [];
    for (let e = first; plain(e) && dir(e) === d && !handled.has(e.entity_number);) {
      run.push(e); handled.add(e.entity_number);
      const [x, y] = cell(e); e = at.get(key(x + dx, y + dy));
    }
    for (let i = 0; i + MIN_SPAN < run.length;) {
      let accepted = false;
      for (let span = Math.min(MAX_SPAN, run.length - 1 - i); span >= MIN_SPAN && !accepted; span--) {
        const a = run[i], b = run[i + span], middle = new Set(run.slice(i + 1, i + span).map(e => e.entity_number));
        const candidate = working.filter(e => !middle.has(e.entity_number)).map(e =>
          e === a ? {...a, name: TUNNEL, type: 'input'} : e === b ? {...b, name: TUNNEL, type: 'output'} : e);
        const after = partners(candidate);
        if (!after || after.get(a.entity_number) !== b.entity_number) continue;
        if ([...before].some(([id, partner]) => after.get(id) !== partner)) continue;
        if (pairs.some(p => after.get(p.input) !== p.output)) continue;
        // Later candidates are built from the replaced objects, so keep the run in step.
        run[i] = candidate.find(e => e.entity_number === a.entity_number);
        run[i + span] = candidate.find(e => e.entity_number === b.entity_number);
        working = candidate;
        pairs.push({input: a.entity_number, output: b.entity_number, direction: d, span, removed: [...middle]});
        i += span + 1; accepted = true;
      }
      if (!accepted) i++;
    }
  }
  if (pairs.length) bp.entities = working;
  return {pairs, removed: pairs.reduce((n, p) => n + p.removed.length, 0)};
}
