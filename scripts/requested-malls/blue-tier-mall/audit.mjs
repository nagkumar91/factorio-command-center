// Static audit of the blue-tier on-demand mall: geometry, routes, recipes, wiring, power and lane capacity.
// node scripts/requested-malls/blue-tier-mall/audit.mjs [folder] [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLISHED, prototypes, readJson, json, sha, decode, allWires, vector, coord, box, intersects, contact, inside, rotate, distance, envelope } from './lib.mjs';

export function auditBlueprint(object, m, p) {
  const checks = [], errors = [], routeEvidence = [];
  const check = (name, ok, detail = null) => { checks.push({ name, passed: !!ok, ...(detail === null ? {} : { detail }) }); if (!ok) errors.push(name); };
  const bp = object.blueprint, es = bp.entities, ids = new Map(es.map(e => [e.entity_number, e]));
  const get = id => ids.get(id);
  const supported = es.every(e => p.entities[e.name]);
  check('All construction entity names exist in pinned prototypes', supported);
  if (!supported) return { passed: false, checks, errors };
  check('Unique entity IDs', ids.size === es.length);
  check('Blueprint version is 2.1.24', bp.version === Number((2n << 48n) + (1n << 32n) + (24n << 16n)));
  const allowed = ['assembling-machine-2', 'fast-inserter', 'fast-transport-belt', 'steel-chest', 'passive-provider-chest', 'medium-electric-pole', 'pipe', 'display-panel'];
  check('AM2, fast handling inserters, red belts, no unrelated production entities', es.every(e => allowed.includes(e.name)));
  check('No modules, beacons, nonnormal quality, custom inserter reach or tile cheats', es.every(e => !e.items && !e.pickup_position && !e.drop_position && (!e.quality || e.quality === 'normal')) && !bp.tiles);
  const collisions = [];
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) if (intersects(box(es[i], p), box(es[j], p))) collisions.push([es[i].entity_number, es[j].entity_number]);
  check('Rotated native collision boxes do not overlap', collisions.length === 0, collisions);
  check('One passive-provider chest', es.filter(e => e.name === 'passive-provider-chest').length === 1 && get(m.output.chest)?.name === 'passive-provider-chest');
  check('Exactly seven requested recipes and no stack-tier recipes', JSON.stringify(es.filter(e => e.recipe).map(e => e.recipe).sort()) === JSON.stringify([...m.products].sort()) && m.products.length === 7 && !m.products.some(n => n.includes('stack')));
  const belts = es.filter(e => e.name === 'fast-transport-belt'), beltByPos = new Map(belts.map(e => [coord(e.position), e]));
  const edges = new Map(), incoming = new Map();
  for (const b of belts) {
    const [dx, dy] = vector[b.direction || 0];
    const target = beltByPos.get(coord({ x: b.position.x + dx, y: b.position.y + dy }));
    if (target) { edges.set(b.entity_number, target.entity_number); incoming.set(target.entity_number, (incoming.get(target.entity_number) || 0) + 1); }
  }
  const trace = []; let id = m.loop[0];
  while (id && !trace.includes(id)) { trace.push(id); id = edges.get(id); }
  check('Every red belt belongs to one directed unbranched closed loop', belts.length === m.loop.length && trace.length === belts.length && id === trace[0] && belts.every(e => incoming.get(e.entity_number) === 1), { beltCount: belts.length, tracedCount: trace.length });
  const loopSet = new Set(trace);
  const beltAtContact = (a, kind) => belts.find(b => inside(contact(a, p, kind), box(b, p, 'selection_box')));
  const pickupDrop = (armId, sourceId, destinationId, label) => {
    const a = get(armId), s = get(sourceId), d = get(destinationId);
    const ok = !!a && !!s && !!d && inside(contact(a, p, 'pickup'), box(s, p, 'selection_box')) && inside(contact(a, p, 'drop'), box(d, p, 'selection_box'));
    check(label, ok);
    if (a && s && d) routeEvidence.push({ label, inserter: armId, source: sourceId, destination: destinationId, pickup: contact(a, p, 'pickup'), drop: contact(a, p, 'drop') });
  };
  check('Every fast inserter uses hand size one and valid whitelist filters', es.filter(e => e.name === 'fast-inserter').every(e => e.override_stack_size === 1 && e.use_filters && e.filter_mode === 'whitelist' && e.filters.length > 0 && e.filters.length <= p.entities[e.name].filter_count && e.filters.every(f => p.items[f.name])));
  const ingredientSet = new Set(m.cells.flatMap(c => p.recipes[c.recipe].ingredients.map(v => v.name)).filter(n => !m.products.includes(n)));
  check('Boundary matches external recipe dependency closure, with no duplicate entrances', m.inputPorts.length === ingredientSet.size && new Set(m.inputPorts.map(v => v.item)).size === m.inputPorts.length && m.inputPorts.every(v => ingredientSet.has(v.item)));
  for (const port of m.inputPorts) {
    const sign = get(port.panel);
    check(`${port.id} display panel identifies material and direction`, sign?.name === 'display-panel' && sign.always_show === true && sign.text === port.label && sign.icon.name === port.item);
    const marker = { left: port.externalContact.x - 0.25, right: port.externalContact.x + 0.25, top: port.externalContact.y - 0.25, bottom: port.externalContact.y + 0.25 };
    check(`${port.id} external approach is clear`, !es.some(e => intersects(marker, box(e, p))));
    if (port.kind === 'item') {
      const a = get(port.inserter), b = a && beltAtContact(a, 'drop');
      pickupDrop(port.inserter, port.chest, b?.entity_number, `${port.id} chest -> inserter -> circulating belt`);
      const c = a?.control_behavior?.circuit_condition;
      check(`${port.id} filter and circuit input cap`, a?.filters.length === 1 && a.filters[0].name === port.item && a.control_behavior.circuit_enabled && c.first_signal.name === port.item && c.comparator === '<' && c.constant === port.loopCap);
    }
  }
  for (const cell of m.cells) {
    const machine = get(cell.machine), recipe = p.recipes[cell.recipe];
    check(`${cell.recipe} recipe and AM2 category compatibility`, machine?.recipe === cell.recipe && (recipe.categories || [recipe.category || 'crafting']).some(n => p.entities['assembling-machine-2'].crafting_categories.includes(n)));
    const supplied = new Set();
    for (const armId of cell.inputArms) {
      const a = get(armId), b = a && beltAtContact(a, 'pickup');
      pickupDrop(armId, b?.entity_number, cell.machine, `${cell.recipe} input contact #${armId}`);
      for (const f of a?.filters || []) { supplied.add(f.name); check(`${cell.recipe} ${f.name} originates at one input port`, m.inputPorts.some(v => v.item === f.name && v.kind === 'item')); }
    }
    for (const t of cell.directInputs) {
      supplied.add(t.item);
      pickupDrop(t.inserter, t.source, t.destination, `${cell.recipe} direct ${t.item}`);
      const a = get(t.inserter);
      check(`${cell.recipe} direct intermediate ignores output stock cap`, !a?.control_behavior && a?.filters.length === 1 && a.filters[0].name === t.item && p.recipes[get(t.source).recipe].results.some(v => v.name === t.item));
    }
    check(`${cell.recipe} complete physical solid ingredient coverage`, recipe.ingredients.filter(v => v.type === 'item').every(v => supplied.has(v.name)) && [...supplied].every(n => recipe.ingredients.some(v => v.type === 'item' && v.name === n)));
    const a = get(cell.outputArm), b = a && beltAtContact(a, 'drop');
    pickupDrop(cell.outputArm, cell.machine, b?.entity_number, `${cell.recipe} output -> shared loop`);
    const control = a?.control_behavior?.circuit_condition;
    check(`${cell.recipe} filtered output stock cap`, a?.filters.length === 1 && a.filters[0].name === cell.product && a.control_behavior.circuit_enabled && control.first_signal.name === cell.product && control.comparator === '<' && control.constant === m.stockCaps[cell.product]);
  }
  const collected = [];
  for (const armId of m.output.collectors) {
    const a = get(armId), b = a && beltAtContact(a, 'pickup');
    pickupDrop(armId, b?.entity_number, m.output.chest, `Collector #${armId} feeds the one provider`);
    if (a) collected.push(...a.filters.map(f => f.name));
  }
  check('Collector filters include all seven products and no ingredients', JSON.stringify(collected.sort()) === JSON.stringify([...m.products].sort()));
  const pipes = es.filter(e => e.name === 'pipe'), pipeIds = new Set(pipes.map(e => e.entity_number));
  const fluidPort = m.inputPorts.find(v => v.kind === 'fluid'), reachablePipes = new Set([fluidPort.pipe]);
  let changed = true;
  while (changed) { changed = false; for (const a of pipes) if (reachablePipes.has(a.entity_number)) for (const b of pipes) if (!reachablePipes.has(b.entity_number) && Math.abs(a.position.x - b.position.x) + Math.abs(a.position.y - b.position.y) === 1) { reachablePipes.add(b.entity_number); changed = true; } }
  check('One continuous lubricant network with no disconnected pipes', pipeIds.size === reachablePipes.size);
  for (const cell of m.cells.filter(c => p.recipes[c.recipe].ingredients.some(v => v.type === 'fluid'))) {
    const machine = get(cell.machine), connection = p.entities[machine.name].fluid_boxes.find(b => b.production_type === 'input').pipe_connections[0];
    const [x, y] = rotate(connection.position, machine.direction), [dx, dy] = vector[(connection.direction + machine.direction) % 16];
    const target = { x: machine.position.x + x + dx, y: machine.position.y + y + dy };
    check(`${cell.recipe} lubricant reaches rotated AM2 fluid input`, pipes.some(e => reachablePipes.has(e.entity_number) && coord(e.position) === coord(target)), { connection: target, recipeFluid: 'lubricant' });
  }
  const wires = allWires(bp);
  function component(start, connector) {
    const seen = new Set([start]); let more = true;
    while (more) { more = false; for (const [a, ac, b, bc] of wires) if (ac === connector && bc === connector && (seen.has(a) || seen.has(b))) { if (!seen.has(a) || !seen.has(b)) more = true; seen.add(a); seen.add(b); } }
    return seen;
  }
  check('Wire endpoints and connector distances are legal', wires.every(([a, ac, b, bc]) => get(a) && get(b) && ac === bc && [2, 5].includes(ac) && distance(get(a), get(b)) <= Math.min(ac === 5 ? p.entities[get(a).name].maximum_wire_distance : p.entities[get(a).name].circuit_wire_max_distance, ac === 5 ? p.entities[get(b).name].maximum_wire_distance : p.entities[get(b).name].circuit_wire_max_distance)));
  const green = component(m.reader, 2), controlled = es.filter(e => e.name === 'fast-inserter' && e.control_behavior?.circuit_enabled);
  check('Whole-loop reader, provider and every capped inserter share one green circuit', green.has(m.output.chest) && controlled.every(e => green.has(e.entity_number)));
  const readers = es.filter(e => e.name === 'fast-transport-belt' && e.control_behavior?.circuit_read_hand_contents);
  check('Exactly one whole-loop contents reader, no additional signal sources', readers.length === 1 && readers[0].entity_number === m.reader && readers[0].control_behavior.circuit_contents_read_mode === 2 && es.filter(e => e.name === 'fast-inserter').every(e => !e.control_behavior?.circuit_read_hand_contents));
  const poles = es.filter(e => e.name === 'medium-electric-pole'), copper = component(m.power.entryPole, 5);
  check('Explicit connected copper power grid', poles.every(e => copper.has(e.entity_number)));
  const uncovered = es.filter(e => p.entities[e.name].energy_source?.type === 'electric').filter(e => !poles.some(pole => { const r = p.entities[pole.name].supply_area_distance; return intersects(box(e, p), { left: pole.position.x - r, right: pole.position.x + r, top: pole.position.y - r, bottom: pole.position.y + r }); }));
  check('Every assembler and inserter is within a pole supply area', uncovered.length === 0, uncovered.map(e => e.entity_number));
  // Every feed/output inserts from the outside into the loop's inner lane.
  // Discard every turn tile entirely for a conservative lane capacity bound.
  const rawCaps = m.inputPorts.filter(v => v.kind === 'item').reduce((n, v) => n + v.loopCap, 0);
  const productCaps = Object.values(m.stockCaps).reduce((a, b) => a + b, 0);
  const turns = belts.filter(b => belts.some(a => edges.get(a.entity_number) === b.entity_number && (a.direction || 0) !== (b.direction || 0))).length;
  const conservativeLaneCapacity = (belts.length - turns) * 4;
  const maxCirculating = rawCaps + productCaps + controlled.length;
  check('Capped stocks plus one in-flight item per producer leave at least 25% of one lane free', maxCirculating <= conservativeLaneCapacity * 0.75, { inputCaps: rawCaps, productCaps, handOvershootAllowance: controlled.length, turnTiles: turns, conservativeLaneCapacity, maxCirculating, unusedSlots: conservativeLaneCapacity - maxCirculating, caveat: 'Static capacity bound; liveness and actual lane behavior still require native validation.' });
  const maxSlots = m.products.reduce((n, name) => n + Math.ceil((m.stockCaps[name] + 1) / p.items[name].stack_size), 0);
  check('All finished product caps fit together in the shared provider', maxSlots <= p.entities['passive-provider-chest'].inventory_size && !get(m.output.chest).bar, { maxSlots, availableSlots: p.entities['passive-provider-chest'].inventory_size });
  check('No production rate target is implied', m.nativeProtocol.targetRate === null);
  const measured = envelope(es, p);
  check('Published size equals the selection envelope of the entities', JSON.stringify(measured.bounds) === JSON.stringify(m.footprint.bounds) && measured.width === m.footprint.width && measured.height === m.footprint.height && measured.area === m.footprint.area && m.footprint.entities === es.length, measured);
  return { schema: 1, candidateSha256: m.candidateSha256, gameVersion: p.gameVersion, passed: errors.length === 0, checksPassed: checks.filter(c => c.passed).length, checksTotal: checks.length, errors, checks, routeEvidence, nativeEvidence: 'Structural and recipe evidence only; native evidence is native-report.json', unsupportedClaims: ['throughput guarantees', 'absolute minimum footprint', '2.0.77 import compatibility'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = process.argv.slice(2).find(a => !a.startsWith('--'));
  const dir = folder ? path.resolve(folder) : PUBLISHED;
  const [p, m] = await Promise.all([prototypes(), readJson(path.join(dir, 'manifest.json'))]);
  const code = (await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')).trim();
  if (sha(code) !== m.candidateSha256) throw new Error('Candidate hash mismatch');
  const result = auditBlueprint(decode(code), m, p);
  if (process.argv.includes('--write')) await fs.writeFile(path.join(dir, 'static-audit.json'), json(result));
  console.log(JSON.stringify({ passed: result.passed, checks: result.checksTotal, errors: result.errors, candidateSha256: result.candidateSha256 }, null, 2));
  if (!result.passed) process.exitCode = 1;
}
