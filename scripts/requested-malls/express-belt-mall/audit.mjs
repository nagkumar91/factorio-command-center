// Static audit of the express belt mall: geometry, routes, recipes, wiring, power, lane room and the output rule.
//   node scripts/requested-malls/express-belt-mall/audit.mjs [folder] [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blueprintVersion, PUBLISHED, prototypes, readJson, json, sha, decode, allWires, vector, coord, box, intersects, contact, inside, rotate, distance, envelope } from './lib.mjs';

const EXPECTED_RECIPES = ['advanced-circuit', 'copper-cable', 'electronic-circuit', 'express-splitter', 'express-transport-belt', 'express-underground-belt', 'fast-splitter', 'fast-transport-belt', 'fast-underground-belt', 'iron-gear-wheel', 'iron-gear-wheel', 'iron-gear-wheel', 'splitter', 'transport-belt', 'underground-belt'];

export function auditBlueprint(object, m, p) {
  const checks = [], errors = [], routeEvidence = [];
  const check = (name, ok, detail = null) => { checks.push({ name, passed: !!ok, ...(detail === null ? {} : { detail }) }); if (!ok) errors.push(name); };
  const bp = object.blueprint, es = bp.entities, ids = new Map(es.map(e => [e.entity_number, e]));
  const get = id => ids.get(id);
  const supported = es.every(e => p.entities[e.name]);
  check('All construction entity names exist in pinned prototypes', supported);
  if (!supported) return { passed: false, checks, errors };
  check('Unique entity IDs', ids.size === es.length);
  check(`Blueprint version is ${p.gameVersion}`, bp.version === blueprintVersion(p.gameVersion) && m.requiredGameVersion === p.gameVersion);
  const allowed = ['assembling-machine-2', 'fast-inserter', 'fast-transport-belt', 'fast-underground-belt', 'passive-provider-chest', 'medium-electric-pole', 'pipe', 'display-panel'];
  check('AM2, fast handling inserters, red belts and undergrounds, no unrelated production entities', es.every(e => allowed.includes(e.name)));
  check('No modules, beacons, nonnormal quality, custom inserter reach or tile cheats', es.every(e => !e.items && !e.pickup_position && !e.drop_position && (!e.quality || e.quality === 'normal')) && !bp.tiles);
  const collisions = [];
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) if (intersects(box(es[i], p), box(es[j], p))) collisions.push([es[i].entity_number, es[j].entity_number]);
  check('Rotated native collision boxes do not overlap', collisions.length === 0, collisions);
  const machines = es.filter(e => e.name === 'assembling-machine-2');
  check('Exactly the 15 machines of the design: three gear machines and one for every other recipe, no steel, no stack recipes', JSON.stringify(machines.map(e => e.recipe).sort()) === JSON.stringify(EXPECTED_RECIPES) && machines.length === 15);

  // ---- belts: one closed unbranched ring; the three entrance belts and the iron belt are separate lines ----
  const belts = es.filter(e => e.name === 'fast-transport-belt'), unders = es.filter(e => e.name === 'fast-underground-belt');
  const beltByPos = new Map(belts.map(e => [coord(e.position), e]));
  const ringBelts = m.loop.map(get);
  const edges = new Map(), incoming = new Map();
  for (const b of ringBelts) {
    const [dx, dy] = vector[b.direction || 0];
    const target = beltByPos.get(coord({ x: b.position.x + dx, y: b.position.y + dy }));
    if (target) { edges.set(b.entity_number, target.entity_number); incoming.set(target.entity_number, (incoming.get(target.entity_number) || 0) + 1); }
  }
  const trace = []; let id = m.loop[0];
  while (id && !trace.includes(id)) { trace.push(id); id = edges.get(id); }
  check('The ring is one directed unbranched closed loop of red belt with no underground, splitter or side-load', ringBelts.length === m.loop.length && trace.length === m.loop.length && id === trace[0] && ringBelts.every(e => incoming.get(e.entity_number) === 1) && ringBelts.every(e => e.name === 'fast-transport-belt'), { ringTiles: m.loop.length });
  const ringSet = new Set(m.loop);
  const otherBelts = belts.filter(e => !ringSet.has(e.entity_number));
  // No other belt may feed the ring or take from it.
  check('No belt outside the ring points into the ring or out of it', otherBelts.every(b => { const [dx, dy] = vector[b.direction || 0]; const t = beltByPos.get(coord({ x: b.position.x + dx, y: b.position.y + dy })); return !t || !ringSet.has(t.entity_number); }) && ringBelts.every(b => edges.has(b.entity_number)));

  const beltAtContact = (a, kind) => [...belts, ...unders].find(b => inside(contact(a, p, kind), box(b, p, 'selection_box')));
  const pickupDrop = (armId, source, destination, label) => {
    const a = get(armId);
    const ok = !!a && !!source && !!destination && inside(contact(a, p, 'pickup'), box(source, p, 'selection_box')) && inside(contact(a, p, 'drop'), box(destination, p, 'selection_box'));
    check(label, ok);
    if (a && source && destination) routeEvidence.push({ label, inserter: armId, source: source.entity_number, destination: destination.entity_number, pickup: contact(a, p, 'pickup'), drop: contact(a, p, 'drop') });
    return ok;
  };
  const inserters = es.filter(e => e.name === 'fast-inserter');
  check('Every fast inserter uses hand size one and valid whitelist filters', inserters.every(e => e.override_stack_size === 1 && e.use_filters && e.filter_mode === 'whitelist' && e.filters.length > 0 && e.filters.length <= p.entities[e.name].filter_count && e.filters.every(f => p.items[f.name])));

  // ---- the iron belt ----
  const ironChain = m.ironBelt.map(get);
  let chainOk = ironChain.length > 0;
  for (let i = 0; i + 1 < ironChain.length; i++) {
    const a = ironChain[i], b = ironChain[i + 1], [dx, dy] = vector[a.direction || 0];
    const step = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
    const direct = Math.abs(a.position.x + dx - b.position.x) < 1e-9 && Math.abs(a.position.y + dy - b.position.y) < 1e-9;
    const underground = a.name === 'fast-underground-belt' && a.type === 'input' && b.name === 'fast-underground-belt' && b.type === 'output' && a.direction === b.direction && step <= p.entities['fast-underground-belt'].max_distance && Math.abs(Math.abs(b.position.x - a.position.x) * Math.abs(dy) + Math.abs(b.position.y - a.position.y) * Math.abs(dx)) < 1e-9;
    if (!direct && !underground) chainOk = false;
  }
  check('The iron belt is one chain from its entrance tile to its last tile; its only underground pair is a legal hop in line', chainOk && unders.length === 2 && unders.every(e => m.ironBelt.includes(e.entity_number)));
  const ironPort = m.inputPorts.find(v => v.item === 'iron-plate');
  check('The iron entrance is the first tile of the iron belt and faces east', ironChain[0]?.entity_number === ironPort.entranceBelt && ironChain[0].direction === 4);

  // ---- entrances and panels ----
  for (const port of m.inputPorts) {
    const sign = get(port.panel);
    check(`${port.id} display panel identifies the material and carries its icon`, sign?.name === 'display-panel' && sign.always_show === true && sign.text === port.label && port.label === `IN: ${port.item}` && sign.icon.name === port.item && sign.icon.type === (port.kind === 'fluid' ? 'fluid' : 'item'));
    const marker = { left: port.externalContact.x - 0.25, right: port.externalContact.x + 0.25, top: port.externalContact.y - 0.25, bottom: port.externalContact.y + 0.25 };
    check(`${port.id} external approach is clear`, !es.some(e => intersects(marker, box(e, p))));
    if (port.kind === 'item') {
      const tile = get(port.entranceBelt);
      check(`${port.id} entrance is a belt tile on the west edge facing east`, tile?.name === 'fast-transport-belt' && tile.direction === 4 && tile.position.x === Math.min(...es.map(e => e.position.x)));
      const a = get(port.ringArm), c = a?.control_behavior?.circuit_condition;
      const target = beltAtContact(a, 'drop');
      check(`${port.id} arm lifts onto the ring`, !!target && ringSet.has(target.entity_number));
      const source = a && beltAtContact(a, 'pickup');
      check(`${port.id} arm takes the material from the iron belt or its entrance tile`, !!source && (port.item === 'iron-plate' ? m.ironBelt.includes(source.entity_number) : source.entity_number === port.entranceBelt));
      check(`${port.id} filter and circuit input cap`, a?.filters.length === 1 && a.filters[0].name === port.item && a.control_behavior?.circuit_enabled && c?.first_signal.name === port.item && c.comparator === '<' && c.constant === port.loopCap);
    }
  }

  // ---- machines: recipes, supply and what is made where ----
  const ringAdders = new Map(), ringTakers = new Map();
  const note = (map, item, id) => map.set(item, [...(map.get(item) || []), id]);
  for (const a of inserters) {
    const drop = beltAtContact(a, 'drop'), pick = beltAtContact(a, 'pickup');
    if (drop && ringSet.has(drop.entity_number)) for (const f of a.filters) note(ringAdders, f.name, a.entity_number);
    if (pick && ringSet.has(pick.entity_number)) for (const f of a.filters) note(ringTakers, f.name, a.entity_number);
  }
  const gearHeavy = [];
  for (const cell of m.cells) {
    const machine = get(cell.machine), recipe = p.recipes[cell.recipe];
    const label = cell.tag ? `${cell.recipe} (${cell.tag})` : cell.recipe;
    check(`${label} recipe and AM2 category compatibility`, machine?.recipe === cell.recipe && recipe.categories.some(n => p.entities['assembling-machine-2'].crafting_categories.includes(n)));
    const supplied = new Set();
    for (const armId of cell.ringInputArms) {
      const a = get(armId), b = a && beltAtContact(a, 'pickup');
      pickupDrop(armId, b, machine, `${label} ring input #${armId}`);
      for (const f of a?.filters || []) {
        supplied.add(f.name);
        check(`${label} ring input ${f.name} is an ingredient`, recipe.ingredients.some(v => v.name === f.name));
        check(`${label} ${f.name} on the ring has a producer that adds it`, (ringAdders.get(f.name) || []).length > 0);
      }
    }
    for (const armId of cell.beltInputArms) {
      const a = get(armId), b = a && beltAtContact(a, 'pickup');
      pickupDrop(armId, b && m.ironBelt.includes(b.entity_number) ? b : null, machine, `${label} iron belt input #${armId}`);
      for (const f of a?.filters || []) supplied.add(f.name);
    }
    for (const t of cell.directInputs) {
      supplied.add(t.item);
      pickupDrop(t.inserter, get(t.source), get(t.destination), `${label} direct ${t.item} #${t.inserter}`);
      const a = get(t.inserter);
      check(`${label} direct ${t.item} is always on, single filter, made by its source`, !a?.control_behavior && a?.filters.length === 1 && a.filters[0].name === t.item && p.recipes[get(t.source).recipe].results.some(v => v.name === t.item) && recipe.ingredients.some(v => v.name === t.item));
    }
    check(`${label} complete physical solid ingredient coverage`, recipe.ingredients.filter(v => v.type === 'item').every(v => supplied.has(v.name)) && [...supplied].every(n => recipe.ingredients.some(v => v.type === 'item' && v.name === n)));
    if (cell.ringOutputArm) {
      const a = get(cell.ringOutputArm), b = a && beltAtContact(a, 'drop'), control = a?.control_behavior?.circuit_condition;
      const item = recipe.results[0].name;
      pickupDrop(cell.ringOutputArm, machine, b, `${label} output -> ring`);
      check(`${label} filtered output arm with ring cap`, !!b && ringSet.has(b.entity_number) && a?.filters.length === 1 && a.filters[0].name === item && a.control_behavior?.circuit_enabled && control?.first_signal.name === item && control.comparator === '<' && control.constant === m.ringCaps[item]);
    } else {
      const outs = es.filter(e => e.name === 'fast-inserter' && inside(contact(e, p, 'pickup'), box(machine, p, 'selection_box')) && ringSet.has(beltAtContact(e, 'drop')?.entity_number));
      check(`${label} puts nothing on the ring`, outs.length === 0);
    }
  }
  // Every item on the ring is made or lifted by someone and used by someone.
  const ringItems = [...new Set([...ringAdders.keys(), ...ringTakers.keys()])];
  check('Every item on the ring has an adder and a taker, and every adder is capped', ringItems.every(n => (ringAdders.get(n) || []).length && (ringTakers.get(n) || []).length) && [...ringAdders.values()].flat().every(id => get(id).control_behavior?.circuit_enabled && get(id).control_behavior.circuit_condition?.comparator === '<'), { items: ringItems.sort() });
  // Gear machines.
  for (const cell of m.cells.filter(c => c.recipe === 'iron-gear-wheel')) check(`Gear machine ${cell.tag} has three iron arms from the iron belt`, cell.beltInputArms.length === 3);
  // ---- outputs ----
  check('Exactly three passive-provider chests, one per express product, each limited to one slot', es.filter(e => e.name === 'passive-provider-chest').length === 3 && m.outputs.length === 3 && JSON.stringify(m.outputs.map(o => o.item)) === JSON.stringify(m.products) && m.outputs.every(o => get(o.chest)?.name === 'passive-provider-chest' && get(o.chest).bar === 1));
  const intoChest = new Map();
  for (const a of inserters) for (const o of m.outputs) if (inside(contact(a, p, 'drop'), box(get(o.chest), p, 'selection_box'))) note(intoChest, o.chest, a.entity_number);
  for (const o of m.outputs) {
    const a = get(o.collector), b = a && beltAtContact(a, 'pickup');
    pickupDrop(o.collector, b && ringSet.has(b.entity_number) ? b : null, get(o.chest), `Collector #${o.collector} feeds the ${o.item} chest from the ring`);
    check(`${o.item} chest: one collector, one filter, its own product, no other arm drops into it, no control`, JSON.stringify(intoChest.get(o.chest)) === JSON.stringify([o.collector]) && a?.filters.length === 1 && a.filters[0].name === o.item && !a.control_behavior);
    const panel = get(o.panel);
    check(`${o.item} chest label`, panel?.name === 'display-panel' && panel.always_show === true && panel.text === o.label && o.label === `OUT: ${o.item}` && panel.icon.name === o.item);
    check(`${o.item} chest holds exactly one stack`, o.cap === p.items[o.item].stack_size * o.slots && o.slots === 1 && get(o.chest).bar === 1 && p.entities['passive-provider-chest'].inventory_size >= 1);
  }
  check('Express products are only ever dropped on the ring or into their own chest', es.filter(e => e.name === 'fast-inserter' && e.filters.some(f => m.products.includes(f.name))).every(a => { const drop = beltAtContact(a, 'drop'); return (drop && ringSet.has(drop.entity_number)) || m.outputs.some(o => o.collector === a.entity_number); }));
  // ---- lubricant ----
  const pipes = es.filter(e => e.name === 'pipe'), pipeIds = new Set(pipes.map(e => e.entity_number));
  const fluidPort = m.inputPorts.find(v => v.kind === 'fluid'), reachablePipes = new Set([fluidPort.pipe]);
  let changed = true;
  while (changed) { changed = false; for (const a of pipes) if (reachablePipes.has(a.entity_number)) for (const b of pipes) if (!reachablePipes.has(b.entity_number) && Math.abs(a.position.x - b.position.x) + Math.abs(a.position.y - b.position.y) === 1) { reachablePipes.add(b.entity_number); changed = true; } }
  check('One continuous lubricant network with no disconnected pipes', pipeIds.size === reachablePipes.size && pipeIds.size === m.pipes.length);
  const inlet = get(fluidPort.pipe);
  check('The inlet pipe is the south end of the stub and its outside neighbour is free', !pipes.some(e => e.position.x === inlet.position.x && e.position.y === inlet.position.y + 1) && fluidPort.externalContact.y === inlet.position.y + 1);
  for (const cell of m.cells.filter(c => p.recipes[c.recipe].ingredients.some(v => v.type === 'fluid'))) {
    const machine = get(cell.machine), connection = p.entities[machine.name].fluid_boxes.find(b => b.production_type === 'input').pipe_connections[0];
    const [x, y] = rotate(connection.position, machine.direction), [dx, dy] = vector[(connection.direction + machine.direction) % 16];
    const target = { x: machine.position.x + x + dx, y: machine.position.y + y + dy };
    check(`${cell.recipe} lubricant reaches the rotated AM2 fluid input`, pipes.some(e => reachablePipes.has(e.entity_number) && coord(e.position) === coord(target)), { connection: target });
  }
  check('Only the three express makers use lubricant', m.cells.filter(c => p.recipes[c.recipe].ingredients.some(v => v.type === 'fluid')).map(c => c.recipe).sort().join() === [...m.products].sort().join());
  // ---- circuits ----
  const wires = allWires(bp);
  function component(start, connector) {
    const seen = new Set([start]); let more = true;
    while (more) { more = false; for (const [a, ac, b, bc] of wires) if (ac === connector && bc === connector && (seen.has(a) || seen.has(b))) { if (!seen.has(a) || !seen.has(b)) more = true; seen.add(a); seen.add(b); } }
    return seen;
  }
  check('Wire endpoints and connector distances are legal', wires.every(([a, ac, b, bc]) => get(a) && get(b) && ac === bc && [2, 5].includes(ac) && distance(get(a), get(b)) <= Math.min(ac === 5 ? p.entities[get(a).name].maximum_wire_distance : p.entities[get(a).name].circuit_wire_max_distance, ac === 5 ? p.entities[get(b).name].maximum_wire_distance : p.entities[get(b).name].circuit_wire_max_distance)));
  const green = component(m.reader, 2), gatedAll = inserters.filter(e => e.control_behavior?.circuit_enabled), gatedTakers = gatedAll.filter(e => m.gatedArms.includes(e.entity_number)), controlled = gatedAll.filter(e => !m.gatedArms.includes(e.entity_number));
  check('The whole-ring reader and every gated arm share one green circuit, and nothing else is on it', gatedAll.every(e => green.has(e.entity_number)) && green.size === gatedAll.length + 1);
  check('The only gated taker is the express underground maker\'s gear arm: it works only while the ring holds more than the reserve', gatedTakers.length === 1 && gatedTakers[0].filters.length === 1 && gatedTakers[0].filters[0].name === 'iron-gear-wheel' && gatedTakers[0].control_behavior.circuit_condition.comparator === '>' && gatedTakers[0].control_behavior.circuit_condition.constant === m.gearReserve && gatedTakers[0].control_behavior.circuit_condition.first_signal.name === 'iron-gear-wheel' && m.gearReserve < m.ringCaps['iron-gear-wheel'] - 4 && m.cells.find(c => c.recipe === 'express-underground-belt').ringInputArms.includes(gatedTakers[0].entity_number));
  const readers = belts.filter(e => e.control_behavior?.circuit_read_hand_contents);
  check('Exactly one whole-ring contents reader in hold mode, no additional signal sources', readers.length === 1 && readers[0].entity_number === m.reader && ringSet.has(m.reader) && readers[0].control_behavior.circuit_contents_read_mode === 2 && inserters.every(e => !e.control_behavior?.circuit_read_hand_contents));
  check('Every arm that adds an item to the ring is capped, and nothing else is', controlled.length === [...ringAdders.values()].flat().length && controlled.every(e => { const d = beltAtContact(e, 'drop'); return d && ringSet.has(d.entity_number); }), { capped: controlled.length });
  // ---- power ----
  const poles = es.filter(e => e.name === 'medium-electric-pole'), copper = component(m.power.entryPole, 5);
  check('Explicit connected copper power grid', poles.every(e => copper.has(e.entity_number)));
  const uncovered = es.filter(e => p.entities[e.name].energy_source?.type === 'electric').filter(e => !poles.some(pole => { const r = p.entities[pole.name].supply_area_distance; return intersects(box(e, p), { left: pole.position.x - r, right: pole.position.x + r, top: pole.position.y - r, bottom: pole.position.y + r }); }));
  check('Every assembler and inserter is within a pole supply area', uncovered.length === 0, uncovered.map(e => e.entity_number));
  const powerPanel = get(m.power.panel);
  check('One labelled power connection', powerPanel?.text === m.power.label && powerPanel.always_show === true && get(m.power.entryPole)?.name === 'medium-electric-pole');
  // ---- lane room ----
  const ringCapTotal = ringItems.reduce((n, item) => n + (m.ringCaps[item] || 0), 0);
  const turns = ringBelts.filter(b => ringBelts.some(a => edges.get(a.entity_number) === b.entity_number && (a.direction || 0) !== (b.direction || 0))).length;
  const conservativeLaneCapacity = (ringBelts.length - turns) * 4;
  const maxCirculating = ringCapTotal + controlled.length;
  check('Ring stock caps plus one in-flight item per capped arm leave at least 25% of one lane free', maxCirculating <= conservativeLaneCapacity * 0.75, { ringCaps: ringCapTotal, handOvershootAllowance: controlled.length, turnTiles: turns, conservativeLaneCapacity, maxCirculating, unusedSlots: conservativeLaneCapacity - maxCirculating, caveat: 'Static capacity bound; liveness and actual lane behaviour still require native validation.' });
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
