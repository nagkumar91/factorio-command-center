// Static audit of the assembling-machine-3 supply mall: geometry, routes, recipes, wiring, power, lane room and the two output chests.
// node scripts/requested-malls/assembler-3-mall/audit.mjs [folder] [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLISHED, prototypes, readJson, json, sha, decode, allWires, vector, coord, box, intersects, contact, inside, distance, envelope } from './lib.mjs';

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
  const allowed = ['assembling-machine-2', 'fast-inserter', 'fast-transport-belt', 'passive-provider-chest', 'medium-electric-pole', 'display-panel'];
  check('AM2 only, fast handling inserters, red belts, medium poles, no unrelated entities', es.every(e => allowed.includes(e.name)));
  check('No modules, beacons, nonnormal quality, custom inserter reach or tile cheats', es.every(e => !e.items && !e.pickup_position && !e.drop_position && (!e.quality || e.quality === 'normal')) && !bp.tiles);
  const collisions = [];
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) if (intersects(box(es[i], p), box(es[j], p))) collisions.push([es[i].entity_number, es[j].entity_number]);
  check('Rotated native collision boxes do not overlap', collisions.length === 0, collisions);
  const machines = es.filter(e => e.name === 'assembling-machine-2');
  check('Exactly the eight requested recipes, one machine each, nothing else', JSON.stringify(machines.map(e => e.recipe).sort()) === JSON.stringify([...m.recipes].sort()) && m.recipes.length === 8 && new Set(m.recipes).size === 8);
  check('No assembling machine 1 or 3 is built; they are made, not used', !es.some(e => e.name === 'assembling-machine-3' || e.name === 'assembling-machine-1'));

  // ---- belts: one closed ring and four separate stubs --------------------------------------------------------------------------
  const belts = es.filter(e => e.name === 'fast-transport-belt'), beltByPos = new Map(belts.map(e => [coord(e.position), e]));
  const edges = new Map(), incoming = new Map();
  for (const b of belts) {
    const [dx, dy] = vector[b.direction || 0];
    const target = beltByPos.get(coord({ x: b.position.x + dx, y: b.position.y + dy }));
    if (target) { edges.set(b.entity_number, target.entity_number); incoming.set(target.entity_number, (incoming.get(target.entity_number) || 0) + 1); }
  }
  const trace = []; let id = m.loop[0];
  while (id && !trace.includes(id)) { trace.push(id); id = edges.get(id); }
  const stubIds = new Set(m.inputPorts.flatMap(v => v.stub));
  check('The ring is one directed unbranched closed loop of red belts', trace.length === m.loop.length && id === trace[0] && m.loop.every(i => trace.includes(i)) && m.loop.every(i => incoming.get(i) === 1), { ringTiles: m.loop.length, tracedTiles: trace.length });
  check('Every red belt is either a ring tile or part of exactly one entrance stub', belts.length === m.loop.length + stubIds.size && belts.every(e => m.loop.includes(e.entity_number) !== stubIds.has(e.entity_number)));
  check('No stub feeds the ring or another stub', [...stubIds].every(i => !m.loop.includes(edges.get(i)) && (!edges.has(i) || stubIds.has(edges.get(i)))));
  const loopSet = new Set(m.loop);
  const ringAt = (a, kind) => belts.find(b => loopSet.has(b.entity_number) && inside(contact(a, p, kind), box(b, p, 'selection_box')));
  const stubAt = (a, kind) => belts.find(b => stubIds.has(b.entity_number) && inside(contact(a, p, kind), box(b, p, 'selection_box')));
  const pickupDrop = (armId, sourceId, destinationId, label) => {
    const a = get(armId), s = get(sourceId), d = get(destinationId);
    const ok = !!a && !!s && !!d && inside(contact(a, p, 'pickup'), box(s, p, 'selection_box')) && inside(contact(a, p, 'drop'), box(d, p, 'selection_box'));
    check(label, ok);
    if (a && s && d) routeEvidence.push({ label, inserter: armId, source: sourceId, destination: destinationId, pickup: contact(a, p, 'pickup'), drop: contact(a, p, 'drop') });
  };
  const inserters = es.filter(e => e.name === 'fast-inserter');
  check('Every fast inserter uses hand size one and valid whitelist filters', inserters.every(e => e.override_stack_size === 1 && e.use_filters && e.filter_mode === 'whitelist' && e.filters.length > 0 && e.filters.length <= p.entities[e.name].filter_count && e.filters.every(f => p.items[f.name])));

  // ---- the four entrances ---------------------------------------------------------------------------------------------------------
  const madeInside = new Set(m.recipes.map(r => p.recipes[r].results[0].name));
  const external = new Set(m.recipes.flatMap(r => p.recipes[r].ingredients.map(v => v.name)).filter(n => !madeInside.has(n)));
  check('The four entrances are exactly the materials no machine makes: iron, steel, copper plate and plastic', m.inputPorts.length === 4 && external.size === 4 && m.inputPorts.every(v => external.has(v.item)) && new Set(m.inputPorts.map(v => v.item)).size === 4 && JSON.stringify([...external].sort()) === JSON.stringify(['copper-plate', 'iron-plate', 'plastic-bar', 'steel-plate']));
  check('No circuits, gears or machines are supplied from outside', m.inputPorts.every(v => !madeInside.has(v.item)));
  const left = envelope(es, p).bounds.left;
  for (const port of m.inputPorts) {
    const sign = get(port.panel);
    check(`${port.id} display panel shows the item icon and "IN: <material>"`, sign?.name === 'display-panel' && sign.always_show === true && sign.text === `IN: ${port.item}` && sign.text === port.label && sign.icon.name === port.item);
    const marker = { left: port.externalContact.x - 0.25, right: port.externalContact.x + 0.25, top: port.externalContact.y - 0.25, bottom: port.externalContact.y + 0.25 };
    check(`${port.id} external approach is clear`, !es.some(e => intersects(marker, box(e, p))));
    const first = get(port.stub[0]);
    check(`${port.id} entrance belt faces east on the west edge`, first.direction === 4 && Math.floor(first.position.x) === left && port.externalContact.x === first.position.x - 1);
    check(`${port.id} stub is a continuous belt ending at its own tile`, port.stub.every((sid, i) => i === port.stub.length - 1 ? edges.get(sid) === undefined : edges.get(sid) === port.stub[i + 1]) && port.stubEnd === port.stub.at(-1));
    const a = get(port.inserter), b = a && ringAt(a, 'drop');
    pickupDrop(port.inserter, port.stubEnd, b?.entity_number, `${port.id} stub end -> feed arm -> ring`);
    const c = a?.control_behavior?.circuit_condition;
    check(`${port.id} filter and circuit cap`, a?.filters.length === 1 && a.filters[0].name === port.item && a.control_behavior.circuit_enabled && c.first_signal.name === port.item && c.comparator === '<' && c.constant === port.loopCap && m.ringCaps[port.item] === port.loopCap);
  }

  // ---- machines -----------------------------------------------------------------------------------------------------------------
  const ringItems = new Set([...m.inputPorts.map(v => v.item), ...m.cells.filter(c => c.ringProduct).map(c => c.ringProduct)]);
  check('Ring caps cover exactly the entrance items and the products that ride the ring', JSON.stringify(Object.keys(m.ringCaps).sort()) === JSON.stringify([...ringItems].sort()));
  for (const cell of m.cells) {
    const machine = get(cell.machine), recipe = p.recipes[cell.recipe];
    check(`${cell.recipe} recipe and AM2 category compatibility`, machine?.recipe === cell.recipe && (recipe.categories || [recipe.category || 'crafting']).some(n => p.entities['assembling-machine-2'].crafting_categories.includes(n)));
    const supplied = new Set();
    for (const armId of cell.inputArms) {
      const a = get(armId), b = a && ringAt(a, 'pickup');
      pickupDrop(armId, b?.entity_number, cell.machine, `${cell.recipe} ring input arm #${armId}`);
      for (const f of a?.filters || []) { supplied.add(f.name); check(`${cell.recipe} ${f.name} reaches the ring from an entrance or a ring producer`, ringItems.has(f.name)); }
      check(`${cell.recipe} ring input arm #${armId} is not circuit-capped`, !a?.control_behavior);
    }
    for (const t of cell.directInputs) {
      supplied.add(t.item);
      pickupDrop(t.inserter, t.source, t.destination, `${cell.recipe} direct ${t.item}`);
      const a = get(t.inserter), src = get(t.source);
      check(`${cell.recipe} direct ${t.item} is always on and filtered to that item`, !a?.control_behavior && a?.filters.length === 1 && a.filters[0].name === t.item && (src.name === 'passive-provider-chest' || p.recipes[src.recipe].results.some(v => v.name === t.item)));
    }
    check(`${cell.recipe} complete physical ingredient coverage`, recipe.ingredients.every(v => supplied.has(v.name)) && [...supplied].every(n => recipe.ingredients.some(v => v.name === n)));
    if (cell.ringProduct) {
      const a = get(cell.outputArm), b = a && ringAt(a, 'drop');
      pickupDrop(cell.outputArm, cell.machine, b?.entity_number, `${cell.recipe} output -> ring`);
      const control = a?.control_behavior?.circuit_condition;
      check(`${cell.recipe} filtered output cap`, a?.filters.length === 1 && a.filters[0].name === cell.ringProduct && a.control_behavior.circuit_enabled && control.first_signal.name === cell.ringProduct && control.comparator === '<' && control.constant === m.ringCaps[cell.ringProduct]);
    } else check(`${cell.recipe} output never rides the ring`, cell.outputArm === null && (m.products.includes(cell.product) ? !!cell.outputChest : !cell.outputChest) && !inserters.some(a => ringAt(a, 'drop') && a.filters.some(f => f.name === cell.product)));
  }
  const handOffs = new Set(m.directTransfers.map(t => t.inserter));
  check('Direct hand-offs join touching machines and are always on', m.directTransfers.every(t => { const a = get(t.inserter), s = get(t.source), d = get(t.destination); return s.position.y === d.position.y && Math.abs(s.position.x - d.position.x) === 4 && !a.control_behavior; }));

  // ---- the two provider chests ------------------------------------------------------------------------------------------------------
  const chests = es.filter(e => e.name === 'passive-provider-chest');
  check('Exactly two passive provider chests, each limited to one slot (bar 1)', chests.length === 2 && chests.every(e => e.bar === 1) && p.entities['passive-provider-chest'].inventory_size > 1);
  check('One stack per chest holds 50 of its product', m.outputs.every(o => p.items[o.item].stack_size === 50) && m.outputs.length === 2);
  check('The chests are the manifest outputs, one per product, separate', JSON.stringify(m.outputs.map(o => o.item)) === JSON.stringify(['assembling-machine-2', 'assembling-machine-3']) && new Set(m.outputs.map(o => o.chest)).size === 2 && m.outputs.every(o => get(o.chest)?.name === 'passive-provider-chest'));
  for (const o of m.outputs) {
    pickupDrop(o.producerArm, o.producer, o.chest, `${o.item} machine -> its own provider chest`);
    const a = get(o.producerArm);
    check(`${o.item} chest arm is always on and filtered to ${o.item}`, a?.filters.length === 1 && a.filters[0].name === o.item && !a.control_behavior);
    check(`${o.item} machine makes ${o.item}`, get(o.producer).recipe === o.item);
    const sign = get(o.panel);
    check(`${o.item} chest display panel`, sign?.name === 'display-panel' && sign.always_show === true && sign.text === o.label && sign.text === `OUT: ${o.item.replaceAll('-', ' ')}` && sign.icon.name === o.item);
    // nothing but its own product can enter: every inserter that drops into this chest is the producer arm and the chest is never on a belt or circuit
    const droppers = inserters.filter(a => inside(contact(a, p, 'drop'), box(get(o.chest), p, 'selection_box')));
    check(`Only the ${o.item} machine's arm ever drops into its chest`, droppers.length === 1 && droppers[0].entity_number === o.producerArm);
    const pickers = inserters.filter(a => inside(contact(a, p, 'pickup'), box(get(o.chest), p, 'selection_box')));
    check(`Only the planned arm takes from the ${o.item} chest`, o.takenBy ? pickers.length === 1 && pickers[0].entity_number === o.takenBy.inserter : pickers.length === 0);
  }
  const am2 = m.outputs[0];
  pickupDrop(am2.takenBy.inserter, am2.chest, am2.takenBy.machine, 'assembling machine 3 takes assembling machine 2 from the AM2 chest');
  check('Machine 3 takes machine 2 with an always-on arm; machine 2 and 3 never ride the ring', !get(am2.takenBy.inserter).control_behavior && !m.cells.some(c => c.ringProduct && m.products.includes(c.ringProduct)) && !inserters.some(a => ringAt(a, 'drop') && a.filters.some(f => m.products.includes(f.name))));
  check('Each chest sits beside the two labelled machines and the circuit never touches a chest', chests.every(c => !(c.wires || []).length) && !allWires(bp).some(([a, , b]) => chests.some(c => c.entity_number === a || c.entity_number === b)));

  // ---- circuit, power -------------------------------------------------------------------------------------------------------------
  const wires = allWires(bp);
  function component(start, connector) {
    const seen = new Set([start]); let more = true;
    while (more) { more = false; for (const [a, ac, b, bc] of wires) if (ac === connector && bc === connector && (seen.has(a) || seen.has(b))) { if (!seen.has(a) || !seen.has(b)) more = true; seen.add(a); seen.add(b); } }
    return seen;
  }
  check('Wire endpoints and connector distances are legal', wires.every(([a, ac, b, bc]) => get(a) && get(b) && ac === bc && [2, 5].includes(ac) && distance(get(a), get(b)) <= Math.min(ac === 5 ? p.entities[get(a).name].maximum_wire_distance : p.entities[get(a).name].circuit_wire_max_distance, ac === 5 ? p.entities[get(b).name].maximum_wire_distance : p.entities[get(b).name].circuit_wire_max_distance)));
  const green = component(m.reader, 2), controlled = inserters.filter(e => e.control_behavior?.circuit_enabled);
  check('Whole-ring reader and every capped arm share one green circuit', controlled.every(e => green.has(e.entity_number)) && controlled.length === m.inputPorts.length + m.cells.filter(c => c.ringProduct).length);
  const readers = belts.filter(e => e.control_behavior?.circuit_read_hand_contents);
  check('Exactly one whole-ring contents reader in hold mode, on a ring tile, no other signal source', readers.length === 1 && readers[0].entity_number === m.reader && loopSet.has(m.reader) && readers[0].control_behavior.circuit_contents_read_mode === 2 && inserters.every(e => !e.control_behavior?.circuit_read_hand_contents) && !es.some(e => e.name === 'display-panel' && (e.wires || []).length));
  const poles = es.filter(e => e.name === 'medium-electric-pole'), copper = component(m.power.entryPole, 5);
  check('Explicit connected copper power grid', poles.every(e => copper.has(e.entity_number)) && poles.length === m.power.poles.length);
  const uncovered = es.filter(e => p.entities[e.name].energy_source?.type === 'electric').filter(e => !poles.some(pole => { const r = p.entities[pole.name].supply_area_distance; return intersects(box(e, p), { left: pole.position.x - r, right: pole.position.x + r, top: pole.position.y - r, bottom: pole.position.y + r }); }));
  check('Every assembler and inserter is within a pole supply area', uncovered.length === 0, uncovered.map(e => e.entity_number));
  const powerSign = get(m.power.panel);
  check('One labelled power connection at the entry pole', powerSign?.name === 'display-panel' && powerSign.text === m.power.label && get(m.power.entryPole)?.name === 'medium-electric-pole' && distance(powerSign, get(m.power.entryPole)) <= 2);

  // ---- lane room -----------------------------------------------------------------------------------------------------------------
  // Every feed and product arm inserts from outside the ring onto its far (inner) lane. Turn tiles are not counted at all.
  const caps = Object.values(m.ringCaps).reduce((a, b) => a + b, 0);
  const turns = belts.filter(b => loopSet.has(b.entity_number) && m.loop.some(a => edges.get(a) === b.entity_number && (get(a).direction || 0) !== (b.direction || 0))).length;
  const conservativeLaneCapacity = (m.loop.length - turns) * 4;
  const maxCirculating = caps + controlled.length;
  check('Caps plus one in-flight item per capped arm leave at least 25% of one lane free', maxCirculating <= conservativeLaneCapacity * 0.75, { ringCaps: caps, handOvershootAllowance: controlled.length, turnTiles: turns, conservativeLaneCapacity, maxCirculating, unusedSlots: conservativeLaneCapacity - maxCirculating, caveat: 'Static bound; liveness and actual lane behaviour still require native validation.' });
  check('The manifest lane-room figures are the ones computed here', m.laneRoom.ringCaps === caps && m.laneRoom.maxCirculating === maxCirculating && m.laneRoom.handOvershootAllowance === controlled.length);
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
