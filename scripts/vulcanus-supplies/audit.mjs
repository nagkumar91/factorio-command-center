// Static audit of a Vulcanus supply blueprint: names, collisions, machines and recipes, fluid networks (one fluid each, a source and a sink for
// every box), belts and lane merges, every inserter's pickup and drop, power, entrances and exits, panels and the capacity arithmetic.
//   node scripts/vulcanus-supplies/audit.mjs <id> [folder] [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blueprintVersion, published, prototypes, fluidSlots, readJson, json, sha, decode, allWires, VEC, N, E, S, W, opposite, sizeOf, MACHINES, analyzeFluids, portRules, collisions, insertTiles, entityAt, powerCoverage, envelope, distance, box, intersects } from './lib.mjs';

const ALLOWED = ['oil-refinery', 'chemical-plant', 'assembling-machine-3', 'fast-inserter', 'long-handed-inserter', 'fast-transport-belt', 'fast-underground-belt', 'pipe', 'pipe-to-ground', 'substation', 'display-panel'];

// ---- belt tracing -------------------------------------------------------------------------------------------------------
const tileOf = e => ({ x: Math.floor(e.position.x), y: Math.floor(e.position.y) });
const keyOf = (x, y) => x + ',' + y;
export function beltGraph(entities) {
  const belts = entities.filter(e => e.name === 'fast-transport-belt' || e.name === 'fast-underground-belt');
  const at = new Map(belts.map(b => [keyOf(...Object.values(tileOf(b))), b]));
  const front = b => { const t = tileOf(b), v = VEC[b.direction || 0]; return keyOf(t.x + v[0], t.y + v[1]); };
  const feeders = new Map();
  for (const b of belts) {
    if (b.name === 'fast-underground-belt' && b.type === 'output') { /* exits feed forward like a belt */ }
    const target = b.name === 'fast-underground-belt' && b.type === 'input' ? null : front(b);
    if (target) feeders.set(target, [...(feeders.get(target) || []), b]);
  }
  // Underground input -> output pairing: the nearest output on that axis facing the same way within 7 tiles.
  const pair = new Map();
  for (const b of belts.filter(e => e.name === 'fast-underground-belt' && e.type === 'input')) {
    const t = tileOf(b), v = VEC[b.direction || 0];
    for (let k = 1; k <= 7; k++) {
      const o = at.get(keyOf(t.x + v[0] * k, t.y + v[1] * k));
      if (o && o.name === 'fast-underground-belt' && (o.direction || 0) === (b.direction || 0)) { if (o.type === 'output') pair.set(b.entity_number, o); break; }
    }
    if (!pair.has(b.entity_number)) pair.set(b.entity_number, null);
  }
  for (const [id, o] of pair) if (o) { const t = tileOf(o), v = VEC[o.direction || 0], k = keyOf(t.x + v[0], t.y + v[1]); feeders.set(k, [...(feeders.get(k) || []), o]); }
  return { belts, at, feeders, pair };
}
// Follow a belt from its first tile: the tiles it passes, and how it ends (open end, or joining another belt from the side).
export function traceBelt(graph, start) {
  const tiles = [], seen = new Set();
  let cur = start;
  for (;;) {
    if (seen.has(cur.entity_number)) return { tiles, end: 'loop' };
    seen.add(cur.entity_number); tiles.push(cur);
    let from = cur;
    if (cur.name === 'fast-underground-belt' && cur.type === 'input') {
      const out = graph.pair.get(cur.entity_number);
      if (!out) return { tiles, end: 'unpaired underground' };
      seen.add(out.entity_number); tiles.push(out); from = out;
    }
    const t = tileOf(from), v = VEC[from.direction || 0], next = graph.at.get(keyOf(t.x + v[0], t.y + v[1]));
    if (!next) return { tiles, end: 'open' };
    const nd = next.direction || 0, fd = from.direction || 0;
    if (nd === opposite(fd)) return { tiles, end: 'head-on' };
    if (next.name === 'fast-underground-belt' && next.type === 'output') return { tiles, end: 'into an underground exit' };
    if (nd === fd) { cur = next; continue; }
    // A perpendicular belt: a curve when this is its only feeder, otherwise a side-load.
    const feeders = graph.feeders.get(keyOf(tileOf(next).x, tileOf(next).y)) || [];
    if (feeders.length === 1 && next.name === 'fast-transport-belt') { cur = next; continue; }
    return { tiles, end: 'side-load', joins: next };
  }
}

export function auditBlueprint(object, m, p, slots) {
  const checks = [], errors = [];
  const check = (name, ok, detail = null) => { checks.push({ name, passed: !!ok, ...(detail === null ? {} : { detail }) }); if (!ok) errors.push(name); };
  const bp = object.blueprint, es = bp.entities, ids = new Map(es.map(e => [e.entity_number, e]));
  const get = id => ids.get(id);
  check('All entity names exist in the pinned prototypes', es.every(e => p.entities[e.name]));
  if (!es.every(e => p.entities[e.name])) return { passed: false, checks, errors, checksTotal: checks.length };
  check('Unique entity IDs', ids.size === es.length);
  check(`Blueprint version is ${p.gameVersion}`, bp.version === blueprintVersion(p.gameVersion) && m.requiredGameVersion === p.gameVersion);
  check('Only the entities the brief allows: oil refinery, chemical plant, assembling machine 3, fast and long-handed inserters, red belts and undergrounds, pipes, pipes-to-ground, substations, display panels', es.every(e => ALLOWED.includes(e.name)));
  check('Power by substations only, no other pole', es.every(e => !/pole/.test(e.name)) && es.some(e => e.name === 'substation'));
  check('No modules, beacons, nonnormal quality, custom inserter reach, tiles or loose items', es.every(e => !e.items && !e.pickup_position && !e.drop_position && (!e.quality || e.quality === 'normal') && !e.override_stack_size) && !bp.tiles);
  check('Not a stack inserter, no bulk inserter', es.every(e => !/stack-inserter|bulk-inserter/.test(e.name)));
  const hit = collisions(es, p);
  check('Native collision boxes do not overlap', hit.length === 0, hit);
  const env = envelope(es, p);
  check('Published footprint is the selection-box envelope of all entities', env.width === m.footprint.width && env.height === m.footprint.height && env.area === m.footprint.area && env.bounds.left === 0 && env.bounds.top === 0, env);
  check('Footprint entity counts match', JSON.stringify(Object.fromEntries([...new Set(es.map(e => e.name))].sort().map(n => [n, es.filter(e => e.name === n).length]))) === JSON.stringify(m.footprint.counts));

  // ---- machines -----------------------------------------------------------------------------------------------------
  const machines = es.filter(e => MACHINES.includes(e.name));
  check('Machines are exactly the manifest list (entity, name, recipe, direction, mirroring)', JSON.stringify(machines.map(e => [e.entity_number, e.name, e.recipe, e.direction || 0, !!e.mirror])) === JSON.stringify(m.machines.map(x => [x.entity, x.name, x.recipe, x.direction, x.mirror])));
  check('Every machine runs a pinned recipe its crafting categories can make', machines.every(e => p.recipes[e.recipe] && p.recipes[e.recipe].categories.some(c => p.entities[e.name].crafting_categories.includes(c))));
  const speed = e => p.entities[e.name].crafting_speed;
  const capacity = {};
  for (const e of machines) { const r = p.recipes[e.recipe]; capacity[e.recipe] = (capacity[e.recipe] || 0) + 60 * speed(e) / (r.energy_required ?? 0.5); }
  const need = m.sizing.requiredCraftsPerMinute || {};
  check('Every recipe has the crafting capacity the targets need (crafts per minute, all machines at speed 1 module-free)', Object.entries(need).every(([r, n]) => (capacity[r] || 0) + 1e-9 >= n), { capacity, need });
  check('Exactly the declared recipes are made, nothing else', JSON.stringify([...new Set(machines.map(e => e.recipe))].sort()) === JSON.stringify(Object.keys(need).sort()));

  // ---- fluids -------------------------------------------------------------------------------------------------------
  const graph0 = beltGraph(es);
  const fluid = analyzeFluids(es, slots);
  check('No unpaired underground pipe and no mixed network in the static model', fluid.problems.length === 0, fluid.problems);
  check('Fluid networks equal the manifest', JSON.stringify(fluid.components.map(c => ({ id: c.id, fluid: c.fluids[0] || null, entities: c.entities, boxes: c.boxes }))) === JSON.stringify(m.fluidComponents));
  const compOf = new Map(); for (const c of fluid.components) for (const id of c.entities) compOf.set(id, c);
  const boxEnds = (c, flow) => c.boxes.filter(b => b.flow === flow);
  const fluidPorts = [...m.inputPorts, ...m.outputPorts].filter(x => x.kind === 'pipe');
  const unsourced = [], unsunk = [];
  for (const c of fluid.components) {
    if (!c.fluids.length) continue;
    const entrance = m.inputPorts.some(x => x.kind === 'pipe' && compOf.get(x.entity) === c), exit = m.outputPorts.some(x => x.kind === 'pipe' && compOf.get(x.entity) === c);
    if (boxEnds(c, 'input').length && !boxEnds(c, 'output').length && !entrance) unsourced.push(c.id);
    if (boxEnds(c, 'output').length && !boxEnds(c, 'input').length && !exit) unsunk.push(c.id);
    if (entrance && boxEnds(c, 'output').length) unsourced.push('entrance and machine output share network ' + c.id);
  }
  check('Every network with a machine input has a source (an outside entrance or a machine output) and every output reaches a consumer or an exit', unsourced.length === 0 && unsunk.length === 0, { unsourced, unsunk });
  check('Every fluid entrance and exit pipe is on a network of exactly its own fluid, and no two ports share a network', fluidPorts.every(x => compOf.get(x.entity)?.fluids.length === 1 && compOf.get(x.entity).fluids[0] === x.item) && new Set(fluidPorts.map(x => compOf.get(x.entity)?.id)).size === fluidPorts.length);
  // ---- port rules (members whose manifest states its fluid connections and unused ports) ---------------------------------
  if (m.fluidEdges) {
    const rules = portRules(es, slots);
    check('Every port a recipe uses meets an opening of exactly its own fluid or nothing, and every fluid box of every machine is connected', rules.wrong.length === 0 && rules.unconnected.length === 0, { wrong: rules.wrong, unconnected: rules.unconnected });
    check('No pipe, pipe-to-ground opening or machine port faces a port the recipe does not use', rules.faced.length === 0, rules.faced);
    check('Fluid connections and unused-port tiles equal the manifest', JSON.stringify(rules.edges) === JSON.stringify(m.fluidEdges) && JSON.stringify(rules.unused) === JSON.stringify(m.unusedPorts), { connections: rules.edges.length, unusedPortTiles: rules.unused.reduce((n, u) => n + u.tiles.length, 0) });
    const side = m.exitBelt;
    if (side) {
      const row = side.row.map(get), column = side.column.map(get), exit = get(side.exit), ahead = b => { const t = tileOf(b), v = VEC[b.direction || 0]; return graph0.at.get(keyOf(t.x + v[0], t.y + v[1])); };
      const line = list => list.every((b, i) => ahead(b) === (list[i + 1] || exit));
      check('The exit belt is two unbranched lines that meet on the exit tile, one from behind and one from the side', line(row) && line(column) && (graph0.feeders.get(keyOf(tileOf(exit).x, tileOf(exit).y)) || []).length === 2 && [row, column].every(list => (graph0.feeders.get(keyOf(tileOf(list[0]).x, tileOf(list[0]).y)) || []).length === 0));
    }
  }

  // ---- belts and inserters -------------------------------------------------------------------------------------------
  const graph = beltGraph(es);
  const beltInputs = m.inputPorts.filter(x => x.kind === 'belt');
  const traces = beltInputs.map(x => ({ port: x, trace: traceBelt(graph, get(x.entity)) }));
  check('Every entrance belt flows inward and is not entered from behind by another belt', traces.every(t => (graph.feeders.get(keyOf(t.port.tile.x, t.port.tile.y)) || []).length === 0));
  const merge = m.sizing.laneMerge;
  if (merge) {
    const mergeTile = get(merge.tile);
    const sideLoaders = traces.map(t => t.trace).filter(t => t.end === 'side-load' && t.joins === mergeTile);
    const f = graph.feeders.get(keyOf(tileOf(mergeTile).x, tileOf(mergeTile).y)) || [];
    const opp = f.length === 2 && ((f[0].direction || 0) === opposite(f[1].direction || 0)) && f.every(b => (b.direction || 0) !== (mergeTile.direction || 0) && (b.direction || 0) !== opposite(mergeTile.direction || 0));
    check('Two entrance belts side-load onto the first tile of one belt from opposite sides, nothing feeds it from behind: one lane each', sideLoaders.length === merge.feeders && opp, { sideLoaders: sideLoaders.length, feeders: f.map(b => b.entity_number) });
    const main = traceBelt(graph, mergeTile);
    check('The merged belt is one unbranched line to its open end', main.end === 'open' && main.tiles.length === merge.length, { end: main.end, length: main.tiles.length });
    graph.mainIds = new Set(main.tiles.map(t => t.entity_number));
  }
  const exits = m.outputPorts.filter(x => x.kind === 'belt');
  check('Every belt exit is fed only from behind or by its own arm and ends open at the footprint edge', exits.every(x => { const b = get(x.entity), t = tileOf(b), v = VEC[b.direction || 0]; return !graph.at.get(keyOf(t.x + v[0], t.y + v[1])); }));
  const routes = m.routes, byInserter = new Map(routes.map(r => [r.inserter, r]));
  const inserters = es.filter(e => /inserter/.test(e.name));
  check('Every inserter has exactly one declared route', inserters.length === routes.length && inserters.every(e => byInserter.has(e.entity_number)));
  const routeProblems = [];
  for (const e of inserters) {
    const r = byInserter.get(e.entity_number); if (!r) continue;
    const { pickup, drop } = insertTiles(e, p);
    const src = entityAt(es, p, pickup), dst = entityAt(es, p, drop);
    const okSrc = r.sourceEntity ? src?.entity_number === r.sourceEntity : r.sourceBelts ? r.sourceBelts.includes(src?.entity_number) : false;
    const okDst = r.destEntity ? dst?.entity_number === r.destEntity : r.destBelts ? r.destBelts.includes(dst?.entity_number) : false;
    if (!okSrc || !okDst) routeProblems.push({ inserter: e.entity_number, label: r.label, pickup: src && [src.entity_number, src.name], drop: dst && [dst.entity_number, dst.name] });
  }
  check('Every inserter picks up from and drops onto exactly the entities of its route', routeProblems.length === 0, routeProblems);
  // Inserter reach: a fast inserter touches the next tile, a long-handed one the second tile; neither crosses a machine.
  check('Every inserter takes from the entity it should: machines, the merged belt or the exit belt only (never an entrance feeder or a pipe)', routes.every(r => !r.sourceBelts || !graph.mainIds || r.sourceBelts.every(id => graph.mainIds.has(id))));

  // ---- power --------------------------------------------------------------------------------------------------------
  const cover = powerCoverage(es, p);
  check('Every machine and inserter is inside a substation supply area', cover.unpowered.length === 0, cover.unpowered);
  const wireMax = p.entities.substation.maximum_wire_distance;
  const subs = es.filter(e => e.name === 'substation');
  const wires = allWires(bp), linked = new Set([subs[0].entity_number]);
  for (let pass = 0; pass < subs.length; pass++) for (const [a, ca, b, cb] of wires) if (ca === 5 && cb === 5) { if (linked.has(a) || linked.has(b)) { linked.add(a); linked.add(b); } }
  check('Substations are wired into one copper network within wire reach', linked.size === subs.length && wires.every(([a, , b]) => distance(get(a), get(b)) <= wireMax));
  const entry = get(m.power.entry), ext = m.power.externalPole;
  check('One power connection: the entry substation, labelled by its display panel, with room for the outside substation within wire reach', entry?.name === 'substation' && get(m.power.panel)?.text === m.power.label && distance(entry, { position: ext }) <= wireMax && !es.some(e => intersects(box(e, p), { left: ext.x - 1, right: ext.x + 1, top: ext.y - 1, bottom: ext.y + 1 })) && !es.some(e => intersects(box(e, p), { left: ext.x + 1, right: ext.x + 3, top: ext.y - 1, bottom: ext.y + 1 })));
  check('Substation count is the manifest list', JSON.stringify(subs.map(e => e.entity_number)) === JSON.stringify(m.power.poles));

  // ---- entrances, exits, panels --------------------------------------------------------------------------------------
  const sides = new Set(beltInputs.map(x => x.side));
  check('All solid entrances are on one side', sides.size === 1, [...sides]);
  const bounds = env.bounds;
  const onEdge = (x, side) => { const t = x.tile; return side === 'west' ? t.x === bounds.left : side === 'east' ? t.x === bounds.right - 1 : side === 'north' ? t.y === bounds.top : t.y === bounds.bottom - 1; };
  check('Every entrance and exit entity stands on the footprint edge it names', [...m.inputPorts, ...m.outputPorts].every(x => onEdge(x, x.side)));
  const freeTile = t => !es.some(e => inside1(e, t, p));
  check('Every entrance and exit has its outside contact tile and the approach beyond it clear of blueprint entities, and an outside pipe touches only its own port', [...m.inputPorts, ...m.outputPorts].every(x => x.approach.every(freeTile) && freeTile(x.externalContact) && (x.kind !== 'pipe' || [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => { const n = { x: x.externalContact.x + a, y: x.externalContact.y + b }; return (n.x === x.tile.x && n.y === x.tile.y) || freeTile(n); }))));
  check('Entrance entities face inward and exit belts face outward', beltInputs.every(x => { const b = get(x.entity); return b.name === 'fast-transport-belt' && (b.direction || 0) === ({ west: E, east: W, north: S, south: N })[x.side]; }) && exits.every(x => (get(x.entity).direction || 0) === ({ west: W, east: E, north: N, south: S })[x.side]));
  check('Fluid entrances and exits are plain pipes (they connect on all sides)', fluidPorts.every(x => get(x.entity).name === 'pipe'));
  const panelOk = x => { const pn = get(x.panel); return pn?.name === 'display-panel' && pn.always_show === true && pn.icon?.name === x.item && pn.icon.type === (x.kind === 'pipe' ? 'fluid' : 'item') && pn.text.startsWith((m.inputPorts.includes(x) ? 'IN: ' : 'OUT: ') + x.item) && (x.perMinute === undefined || pn.text.endsWith(` ${x.perMinute}/min`)) && distance(pn, get(x.entity)) <= 3.2; };
  check('Every entrance and exit has a display panel with its item icon, "IN:"/"OUT:" text, the per-minute figure, within three tiles', [...m.inputPorts, ...m.outputPorts].every(panelOk));
  check('Blueprint label and description are set, four icons', !!bp.label && !!bp.description && bp.icons.length >= 3);
  return { passed: errors.length === 0, checksTotal: checks.length, checks, errors };
}
const inside1 = (e, t, p) => { const b = box(e, p); return t.x + 0.5 > b.left && t.x + 0.5 < b.right && t.y + 0.5 > b.top && t.y + 0.5 < b.bottom; };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const id = process.argv[2], dir = process.argv[3] && !process.argv[3].startsWith('--') ? path.resolve(process.argv[3]) : published(id);
  const [p, slots, m] = await Promise.all([prototypes(id), fluidSlots(id), readJson(path.join(dir, 'manifest.json'))]);
  const audit = auditBlueprint(decode(await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')), m, p, slots);
  if (process.argv.includes('--write')) await fs.writeFile(path.join(dir, 'static-audit.json'), json(audit));
  console.log(JSON.stringify({ passed: audit.passed, checks: audit.checksTotal, errors: audit.errors }, null, 2));
  if (!audit.passed) process.exitCode = 1;
}
