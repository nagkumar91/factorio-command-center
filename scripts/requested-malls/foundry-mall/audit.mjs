// Static audit of the foundry mall: geometry, recipes, the ring, arm contacts, pipes (one fluid per network),
// circuit nets, power, the control program, caps, chests, labels and lane room.
//   node scripts/requested-malls/foundry-mall/audit.mjs [folder]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blueprintVersion, PUBLISHED, prototypes, readJson, json, decode, vector, coord, box, intersects, contact, inside, distance } from './lib.mjs';

const COMBINATORS = ['decider-combinator', 'arithmetic-combinator', 'selector-combinator'];
const ALLOWED = ['foundry', 'assembling-machine-3', 'chemical-plant', 'electric-furnace', 'fast-inserter', 'bulk-inserter', 'long-handed-inserter', 'fast-transport-belt', 'pipe', 'pipe-to-ground', 'storage-tank', 'pump', 'substation', 'passive-provider-chest', 'steel-chest', 'display-panel', 'constant-combinator', ...COMBINATORS];
const MACHINE_CATEGORY = { foundry: 'metallurgy', 'chemical-plant': 'chemistry', 'electric-furnace': 'smelting' };

export function auditBlueprint(object, m, p) {
  const checks = [], errors = [];
  const check = (name, ok, detail = null) => { checks.push({ name, passed: !!ok, ...(detail === null ? {} : { detail }) }); if (!ok) errors.push(name); };
  const bp = object.blueprint, es = bp.entities, ids = new Map(es.map(e => [e.entity_number, e]));
  const get = id => ids.get(id);
  check('Every entity name is in the pinned prototypes and in the allowed set', es.every(e => p.entities[e.name] && ALLOWED.includes(e.name)), [...new Set(es.filter(e => !ALLOWED.includes(e.name)).map(e => e.name))]);
  if (errors.length) return { passed: false, checks, errors, checksTotal: checks.length };
  check('Unique entity IDs', ids.size === es.length);
  check(`Blueprint version is ${p.gameVersion}`, bp.version === blueprintVersion(p.gameVersion) && m.requiredGameVersion === p.gameVersion);
  check('No modules, no quality, no tiles, no custom inserter reach', es.every(e => !e.items && !e.pickup_position && !e.drop_position && (!e.quality || e.quality === 'normal')) && !bp.tiles);
  const boxes = es.map(e => box(e, p)), collisions = [];
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) if (intersects(boxes[i], boxes[j])) collisions.push([es[i].entity_number, es[j].entity_number]);
  check('Rotated collision boxes do not overlap', collisions.length === 0, collisions.slice(0, 8));
  const tileOf = new Map();
  for (const e of es) { const b = box(e, p, 'selection_box'); for (let x = Math.floor(b.left + 0.01); x < Math.ceil(b.right - 0.01); x++) for (let y = Math.floor(b.top + 0.36); y < Math.ceil(b.bottom - 0.01); y++) tileOf.set(`${x},${y}`, e); }
  const at = q => tileOf.get(`${Math.floor(q.x)},${Math.floor(q.y)}`);

  // ---- machines and recipes
  const count = name => es.filter(e => e.name === name).length;
  check('Machines: 7 foundries, 19 assembling machines 3, 1 chemical plant, 1 electric furnace', count('foundry') === 7 && count('assembling-machine-3') === 19 && count('chemical-plant') === 1 && count('electric-furnace') === 1, { foundry: count('foundry'), am3: count('assembling-machine-3') });
  const craftable = (machine, recipe) => { const r = p.recipes[recipe]; if (!r) return false; return MACHINE_CATEGORY[machine] ? r.categories.includes(MACHINE_CATEGORY[machine]) : r.categories.some(c => p.entities[machine].crafting_categories.includes(c)); };
  check('Every fixed recipe is pinned and can be crafted in its machine', m.machines.filter(v => v.recipe).every(v => get(v.entity).recipe === v.recipe && craftable(v.name, v.recipe)));
  const switching = m.machines.filter(v => v.switching || v.shadow);
  check('Every switching and shadow machine takes its recipe from the circuit network and has no fixed recipe', switching.length === 7 && switching.every(v => get(v.entity).control_behavior?.set_recipe === true && !get(v.entity).recipe));
  check('Every rule selects a pinned recipe its machine can craft', m.rules.filter(r => r.machine !== 'flag').every(r => { const mach = m.machines.find(v => v.role === r.machine); return mach && craftable(mach.name, r.recipe); }));

  // ---- the ring
  const ring = m.ring.belts.map(get), ringSet = new Set(m.ring.belts), beltAt = new Map(es.filter(e => e.name === 'fast-transport-belt').map(e => [coord(e.position), e]));
  const next = b => { const [dx, dy] = vector[b.direction || 0]; return beltAt.get(coord({ x: b.position.x + dx, y: b.position.y + dy })); };
  let closed = ring.length > 0, incoming = new Map();
  for (const b of ring) { const n = next(b); if (!n || !ringSet.has(n.entity_number)) closed = false; else incoming.set(n.entity_number, (incoming.get(n.entity_number) || 0) + 1); }
  const trace = new Set(); for (let b = ring[0]; b && !trace.has(b.entity_number); b = next(b)) trace.add(b.entity_number);
  check('The ring is one directed unbranched closed loop of red belt', closed && trace.size === ring.length && ring.every(b => incoming.get(b.entity_number) === 1), { tiles: ring.length });
  check('No belt outside the ring points into the ring', [...beltAt.values()].filter(b => !ringSet.has(b.entity_number)).every(b => { const n = next(b); return !n || !ringSet.has(n.entity_number); }));
  check('Exactly one ring belt reads the whole ring (hold); every other ring belt only carries the wire', ring.filter(b => b.control_behavior?.circuit_read_hand_contents).length === 1 && get(m.ring.reader).control_behavior.circuit_contents_read_mode === 2);

  // ---- arm contacts
  const armFaults = [];
  for (const a of m.arms) {
    const e = get(a.entity), from = at(contact(e, p, 'pickup')), to = at(contact(e, p, 'drop'));
    const okFrom = a.from ? from?.entity_number === a.from : from && (from.name === 'fast-transport-belt' || from.name.endsWith('chest'));
    const okTo = a.to ? to?.entity_number === a.to : to && (to.name === 'fast-transport-belt' || to.name.endsWith('chest') || ['assembling-machine-3', 'foundry', 'electric-furnace'].includes(to.name));
    if (!okFrom || !okTo) armFaults.push({ arm: a.entity, role: a.role, from: from?.name, to: to?.name });
    if (/ring feed|switching output|to ring/.test(a.role) && !(to && ringSet.has(to.entity_number))) armFaults.push({ arm: a.entity, role: a.role, drop: 'not the ring' });
    if (/ring input|switching input|silo input/.test(a.role) && !(from && ringSet.has(from.entity_number))) armFaults.push({ arm: a.entity, role: a.role, pickup: 'not the ring' });
  }
  check('Every arm picks up and drops where its role says', armFaults.length === 0, armFaults.slice(0, 8));
  const arms = es.filter(e => e.name.includes('inserter'));
  check('Every arm has its hand size pinned (fast 1, bulk 2, long-handed 1)', arms.every(e => e.override_stack_size === m.equipment.inserters[e.name]) && arms.length === m.arms.length);
  check('Every ring-feeding arm is gated on its item below the ring limit', m.arms.filter(a => a.ringCap).every(a => { const c = get(a.entity).control_behavior; return c.circuit_enabled && c.circuit_condition.first_signal.name === a.ringCap && c.circuit_condition.comparator === '<' && c.circuit_condition.constant === m.ringArmCaps[a.ringCap]; }));
  check('Every level-gated arm is enabled only at or below its level', m.arms.filter(a => a.level).every(a => { const c = get(a.entity).control_behavior.circuit_condition; return c.first_signal.name === 'signal-L' && c.comparator === '≤' && c.constant === a.level; }) && m.arms.filter(a => a.level).length === 6);
  for (const o of m.outputs) { const a = get(o.arm), from = at(contact(a, p, 'pickup')), to = at(contact(a, p, 'drop')); check(`Chest ${o.id}: its arm takes from the ring and drops into its chest`, from && ringSet.has(from.entity_number) && to?.entity_number === o.chest); }

  // ---- pipes: one fluid per network, no touching networks
  const fluidOf = new Map(); for (const [fluid, list] of Object.entries(m.fluids)) for (const id of list) fluidOf.set(id, fluid);
  const tile = e => ({ x: Math.floor(e.position.x), y: Math.floor(e.position.y) });
  const opposite = d => (d + 8) % 16;
  const targets = e => {
    const t = tile(e);
    if (e.name === 'pipe') return [0, 4, 8, 12].map(d => ({ x: t.x + vector[d][0], y: t.y + vector[d][1] }));
    if (e.name === 'pump') { const [dx, dy] = vector[e.direction || 0]; return [{ x: Math.floor(e.position.x + dx * 1.5), y: Math.floor(e.position.y + dy * 1.5) }, { x: Math.floor(e.position.x - dx * 1.5), y: Math.floor(e.position.y - dy * 1.5) }]; }
    if (e.name === 'storage-tank') { const cx = e.position.x - 0.5, cy = e.position.y - 0.5; return [{ x: cx - 1, y: cy - 2 }, { x: cx + 2, y: cy + 1 }, { x: cx + 1, y: cy + 2 }, { x: cx - 2, y: cy - 1 }]; }
    const d = e.direction || 0, out = [{ x: t.x + vector[d][0], y: t.y + vector[d][1] }], [ux, uy] = vector[opposite(d)];
    for (let k = 1; k <= 10; k++) { const other = tileOf.get(`${t.x + ux * k},${t.y + uy * k}`); if (other?.name === 'pipe-to-ground' && (other.direction || 0) === opposite(d)) { out.push(tile(other)); e.partner = other.entity_number; break; } }
    return out;
  };
  const fluidEntities = es.filter(e => ['pipe', 'pipe-to-ground', 'storage-tank', 'pump'].includes(e.name));
  check('Every pipe, underground pipe and tank belongs to exactly one declared fluid', fluidEntities.every(e => fluidOf.has(e.entity_number)) && fluidOf.size === fluidEntities.length);
  const reach = new Map(fluidEntities.map(e => [e.entity_number, targets(e).map(q => tileOf.get(`${q.x},${q.y}`)).filter(o => o && fluidOf.has(o.entity_number)).map(o => o.entity_number)]));
  const linked = (a, b) => reach.get(a).includes(b) && reach.get(b).includes(a);
  const mixed = []; for (const a of fluidEntities) for (const b of reach.get(a.entity_number)) if (linked(a.entity_number, b) && fluidOf.get(a.entity_number) !== fluidOf.get(b)) mixed.push([a.entity_number, b]);
  check('No pipe of one fluid connects to a pipe of another', mixed.length === 0, mixed.slice(0, 6));
  // ---- machine fluid ports. A one-fluid recipe joins a machine's two input ports (or its two output ports) into one
  // box, and a recipe change pushes what is left in a box out through any of its ports. So the ports of one kind of a
  // machine may touch the pipes of one fluid only; a second fluid reaches the machine through a pump standing on the port.
  const rot = ([x, y], d) => { for (let k = 0; k < (d || 0); k += 4) [x, y] = [-y, x]; return [x, y]; };
  const portsOf = e => (p.entities[e.name].fluid_boxes || []).flatMap((fb, i) => fb.pipe_connections.map(c => {
    const [ox, oy] = rot(c.position, e.direction), facing = ((c.direction || 0) + (e.direction || 0)) % 16;
    const at = { x: Math.floor(e.position.x + ox), y: Math.floor(e.position.y + oy) }, target = { x: at.x + vector[facing][0], y: at.y + vector[facing][1] };
    const other = tileOf.get(`${target.x},${target.y}`);
    const joined = other && fluidOf.has(other.entity_number) && targets(other).some(q => q.x === at.x && q.y === at.y) ? other : null;
    return { box: i + 1, kind: fb.production_type, tile: at, target, neighbour: joined?.entity_number ?? null, via: joined?.name ?? null, fluid: joined ? fluidOf.get(joined.entity_number) : null };
  }));
  const fluidMachines = es.filter(e => ['foundry', 'assembling-machine-3', 'chemical-plant'].includes(e.name));
  check('No machine is mirrored (its fluid ports lie as the pinned prototype says)', es.every(e => !e.mirror));
  const portTable = fluidMachines.map(e => ({ entity: e.entity_number, role: m.machines.find(v => v.entity === e.entity_number)?.role, ports: portsOf(e) })).filter(v => v.ports.some(q => q.neighbour));
  const twoFluids = [];
  for (const v of portTable) for (const kind of ['input', 'output']) {
    const direct = new Set(v.ports.filter(q => q.kind === kind && q.neighbour && q.via !== 'pump').map(q => q.fluid));
    if (direct.size > 1) twoFluids.push({ machine: v.role, entity: v.entity, kind, fluids: [...direct] });
  }
  check('No machine has two ports of one kind on pipes of different fluids (a second fluid comes through a pump on the port)', twoFluids.length === 0, twoFluids);
  const expectedPorts = { 'molten-copper': { input: ['lava'], output: ['molten-copper', 'pump:molten-copper'] }, 'molten-iron': { input: ['lava'], output: ['molten-iron'] }, 'iron-plate': { input: ['molten-iron'] }, 'caster-S': { input: ['molten-iron', 'pump:molten-copper'] },
    'caster-D': { input: ['molten-copper'] }, 'caster-G': { input: ['molten-iron', 'pump:water'] }, U2: { input: ['lubricant'] }, U1: { input: ['water'] }, 'electric-engine-unit': { input: ['lubricant'] }, 'processing-unit': { input: ['sulfuric-acid'] }, battery: { input: ['sulfuric-acid'] } };
  const portsSeen = Object.fromEntries(portTable.map(v => [v.role, Object.fromEntries(['input', 'output'].map(kind => [kind, [...new Set(v.ports.filter(q => q.kind === kind && q.neighbour).map(q => (q.via === 'pump' ? 'pump:' : '') + q.fluid))].sort()]).filter(([, list]) => list.length))]));
  check('Every machine fluid port touches the fluid it is meant to (and nothing else touches a port)', JSON.stringify(portsSeen) === JSON.stringify(Object.fromEntries(Object.keys(portsSeen).map(k => [k, Object.fromEntries(Object.entries(expectedPorts[k] || {}).map(([kind, list]) => [kind, [...list].sort()]))]))) && Object.keys(expectedPorts).every(k => portsSeen[k]), portsSeen);
  const pumps = es.filter(e => e.name === 'pump');
  check('Each pump stands directly between its source and the foundry port it feeds (nothing flows back through it)', pumps.length === (m.pumps || []).length && (m.pumps || []).every(v => { const e = get(v.entity), [dx, dy] = vector[e.direction || 0]; return e?.name === 'pump' && fluidOf.get(v.entity) === v.fluid && tileOf.get(`${Math.floor(e.position.x + dx * 1.5)},${Math.floor(e.position.y + dy * 1.5)}`)?.entity_number === v.to && tileOf.get(`${Math.floor(e.position.x - dx * 1.5)},${Math.floor(e.position.y - dy * 1.5)}`)?.entity_number === v.from; }));
  check('Every underground pipe has exactly one partner within ten tiles', fluidEntities.filter(e => e.name === 'pipe-to-ground').every(e => e.partner && get(e.partner).partner === e.entity_number));
  // a pump fed straight from a machine's port is on no pipe network of its own
  const loosePumps = new Set((m.pumps || []).filter(v => !fluidOf.has(v.from)).map(v => v.entity));
  for (const [fluid, all] of Object.entries(m.fluids)) {
    const list = all.filter(id => !loosePumps.has(id));
    const seen = new Set([list[0]]), queue = [list[0]];
    while (queue.length) { const a = queue.pop(); for (const b of reach.get(a)) if (linked(a, b) && !seen.has(b)) { seen.add(b); queue.push(b); } }
    check(`The ${fluid} pipes form one network`, seen.size === list.length, { connected: seen.size, declared: list.length });
  }

  // ---- circuit nets and wires
  const reachOf = e => (e.name === 'substation' ? p.entities.substation.maximum_wire_distance : p.entities[e.name].circuit_wire_max_distance);
  const netOf = new Map(); let netClash = 0;
  for (const [name, net] of Object.entries(m.nets)) for (const [id, connector] of net.members) { const key = `${id}:${connector}`; if (netOf.has(key) && netOf.get(key) !== name) netClash++; netOf.set(key, name); }
  check('No connector belongs to two circuit nets', netClash === 0);
  const circuit = bp.wires.filter(w => w[1] !== 5), copper = bp.wires.filter(w => w[1] === 5);
  check('Every circuit wire joins two members of the same net and is within reach', circuit.every(w => netOf.get(`${w[0]}:${w[1]}`) && netOf.get(`${w[0]}:${w[1]}`) === netOf.get(`${w[2]}:${w[3]}`) && distance(get(w[0]), get(w[2])) <= Math.min(reachOf(get(w[0])), reachOf(get(w[2])))), { wires: circuit.length });
  let split = [];
  for (const [name, net] of Object.entries(m.nets)) {
    const keys = net.members.map(([id, c]) => `${id}:${c}`), seen = new Set([keys[0]]), queue = [keys[0]];
    while (queue.length) { const a = queue.pop(); for (const w of circuit) { const u = `${w[0]}:${w[1]}`, v = `${w[2]}:${w[3]}`; const b = u === a ? v : v === a ? u : null; if (b && !seen.has(b)) { seen.add(b); queue.push(b); } } }
    if (seen.size !== new Set(keys).size) split.push(name);
  }
  check('Every circuit net is connected', split.length === 0, split);
  check('Rule deciders read loose stock on red and the control net on green', m.rules.filter(r => !r.timer).every(r => ['LOOSE', 'CAST'].includes(netOf.get(`${r.entity}:1`)) || netOf.get(`${r.entity}:1`).startsWith('SET-')) && m.rules.every(r => r.timer || netOf.get(`${r.entity}:2`) === 'GREEN'));

  // ---- power
  const subs = es.filter(e => e.name === 'substation'), area = p.entities.substation.supply_area_distance;
  const powered = e => subs.some(s => intersects(box(e, p), { left: s.position.x - area, right: s.position.x + area, top: s.position.y - area, bottom: s.position.y + area }));
  const electric = es.filter(e => p.entities[e.name].energy_source?.type === 'electric');
  check('Every powered entity stands in a substation supply area', electric.every(powered), electric.filter(e => !powered(e)).map(e => e.entity_number).slice(0, 8));
  check('Power is four substations in one copper chain, nothing else', subs.length === 4 && copper.length === 3 && copper.every(w => distance(get(w[0]), get(w[2])) <= p.entities.substation.maximum_wire_distance) && !es.some(e => /pole/.test(e.name)));

  // ---- control program
  const products = m.products.map(v => v.key);
  check('Every product has a rule or flag at its group level', m.products.every(v => m.rules.some(r => r.recipe === v.item && r.level === m.groups[v.group - 1].level)), m.products.filter(v => !m.rules.some(r => r.recipe === v.item)).map(v => v.key));
  check('Every level weight sits in its level band', m.rules.filter(r => r.level).every(r => Math.floor(r.weight / 100000) === r.level));
  check('Each switching machine has a parking recipe: an idle rule (casting foundries) or a park decider (U1, U2)', ['caster-S', 'caster-D', 'caster-G'].every(n => m.rules.some(r => r.machine === n && r.idle)) && Object.values(m.controllers).every(c => c.park && c.idleRecipe));
  check('The recipe wire of U1 and U2 is never without a recipe: "parked" is also raised on the tick a craft ends with the pick to park', Object.entries(m.controllers).every(([name, c]) => {
    const conditions = get(c.boot).control_behavior.decider_conditions.conditions, onNew = m.nets['NEW-' + name].members.some(([id, connector]) => id === c.boot && connector === 2);
    return onNew && conditions.length === 3 && conditions[1].compare_type === 'or' && conditions[1].first_signal.name === 'signal-P' && conditions[2].compare_type === 'and' && conditions[2].first_signal.type === 'recipe' && conditions[2].first_signal.name === c.idleRecipe && conditions[2].first_signal_networks.green && !conditions[2].first_signal_networks.red;
  }));
  const capsFilters = get(m.capsCombinator.entity).control_behavior.sections.sections[0].filters;
  check('The caps combinator holds every cap, the kit chest\'s fast inserters as signal K', products.every(n => capsFilters.find(f => f.name === m.capSignals[n])?.count === m.caps[n]) && m.capSignals['fast-inserter (kit)'] === 'signal-K' && capsFilters.length === products.length);
  check('Every stock has exactly one chest; only fast inserters are in two (kit chest and inserter chest)', m.stock.length === products.length && m.stock.every(s => m.outputs.find(o => o.id === s.output)?.chest === s.chest && m.outputs.find(o => o.id === s.output).items.includes(s.item)) && m.outputs.flatMap(o => o.items).length === products.length && JSON.stringify(m.stock.filter(s => s.item === 'fast-inserter').map(s => s.output)) === '["OUT-2","OUT-4"]');
  check('The kit chest reaches the control net only through its pass (fast inserters masked) and its own count Q', netOf.get(`${m.outputs[1].chest}:2`) === 'KIT-CHEST' && netOf.get(`${m.kitChest.pass}:2`) === 'KIT-CHEST' && netOf.get(`${m.kitChest.pass}:4`) === 'GREEN' && netOf.get(`${m.kitChest.need}:2`) === 'KIT-CHEST' && netOf.get(`${m.kitChest.need}:4`) === 'GREEN' && get(m.kitChest.mask).control_behavior.sections.sections[0].filters.map(f => f.name).join() === 'fast-inserter');
  check('Every chest list names exactly its declared products', m.outputs.filter(o => o.list).every(o => JSON.stringify(get(o.list).control_behavior.sections.sections[0].filters.map(f => f.name).sort()) === JSON.stringify([...o.items].sort())));
  check('Output chests are passive providers; the only other chest is the brick stock', m.outputs.every(o => get(o.chest).name === 'passive-provider-chest') && count('passive-provider-chest') === m.outputs.length && count('steel-chest') === 1 && get(m.brickChest.entity).bar === m.brickChest.stacks);

  // ---- labels
  const labelled = id => { const e = get(id); return e?.name === 'display-panel' && e.always_show && e.text?.length > 3 && e.icon; };
  check('Every entrance, the stone exit, the power connection, the caps combinator and every chest has a display panel', m.ports.every(v => labelled(v.panel)) && m.outputs.every(o => labelled(o.panel)) && labelled(m.power.panel) && labelled(m.capsCombinator.panel), { panels: count('display-panel') });

  // ---- lane room
  // An arm drops on the far lane: what is put on from outside the loop rides the inner lane, from the core the outer lane.
  check('The ring limits of each lane, all reached at once, fit that lane', m.ring.laneLimits.inner <= m.ring.laneCapacity && m.ring.laneLimits.outer <= m.ring.laneCapacity, { ...m.ring.laneLimits, laneCapacity: m.ring.laneCapacity, bound: m.ring.bound });
  check('The technology closure includes the foundry, the space platform and the selector combinator', ['foundry', 'space-platform', 'advanced-combinators', 'rocket-silo', 'logistics-3', 'automation-3', 'bulk-inserter'].every(t => m.technologyClosure.includes(t)));
  return { passed: errors.length === 0, checksTotal: checks.length, checks, errors, counts: m.footprint.counts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2] ? path.resolve(process.argv[2]) : PUBLISHED;
  const [m, p] = await Promise.all([readJson(path.join(folder, 'manifest.json')), prototypes()]);
  const audit = auditBlueprint(decode(await fs.readFile(path.join(folder, 'blueprint.txt'), 'utf8')), m, p);
  console.log(json({ passed: audit.passed, checksTotal: audit.checksTotal, errors: audit.errors, failed: audit.checks.filter(c => !c.passed) }));
  if (!audit.passed) process.exitCode = 1;
}
