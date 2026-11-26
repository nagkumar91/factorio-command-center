// Static audit of the foundry belts and fuel mall: geometry, recipes, the ring, arm contacts, pipes (one fluid per
// network), machine fluid ports (prototype geometry for the mall part, the rocket fuel supply's measured port tables
// for the fuel section), circuit nets, power, the control program, caps, chests, labels and lane room.
//   node scripts/requested-malls/foundry-belts-fuel-mall/audit.mjs [folder]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blueprintVersion, PUBLISHED, PROJECT, prototypes, readJson, json, decode, vector, coord, box, intersects, contact, distance, FUEL } from './lib.mjs';

const COMBINATORS = ['decider-combinator', 'arithmetic-combinator', 'selector-combinator'];
const ALLOWED = ['foundry', 'oil-refinery', 'assembling-machine-3', 'chemical-plant', 'electric-furnace', 'fast-inserter', 'bulk-inserter', 'fast-transport-belt', 'pipe', 'pipe-to-ground', 'storage-tank', 'pump', 'substation', 'passive-provider-chest', 'steel-chest', 'display-panel', 'constant-combinator', ...COMBINATORS];
const MACHINE_CATEGORY = { foundry: 'metallurgy', 'chemical-plant': 'chemistry', 'electric-furnace': 'smelting', 'oil-refinery': 'oil-processing' };
// The measured port tables of the rocket fuel supply (which tile a pipe must stand on for each fluid of a recipe, per
// direction and mirroring, and which ports the recipe leaves unused), read once.
const slotFiles = ['scripts/vulcanus-supplies/fluid-slots.json', 'scripts/vulcanus-supplies/rocket-fuel/fluid-slots.json'];
export const fuelSlots = async () => { const [family, member] = await Promise.all(slotFiles.map(f => readJson(path.join(PROJECT, f)))); return { slots: { ...family.slots, ...member.slots }, unusedPorts: member.unusedPorts, ports: member.ports }; };

export function auditBlueprint(object, m, p, slots) {
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
  const f = m.footprint;
  check('Footprint: 34 wide; the mall part and the fuel part are stacked rectangles with no row between them', f.width === 34 && f.mallPart.width === 34 && f.fuelPart.width === 34 && f.mallPart.bounds.bottom === f.fuelPart.bounds.top && f.mallPart.height + f.fuelPart.height === f.height && f.area === f.width * f.height, { all: `${f.width} x ${f.height}`, mall: `${f.mallPart.width} x ${f.mallPart.height}`, fuel: `${f.fuelPart.width} x ${f.fuelPart.height}` });

  // ---- machines and recipes
  const count = name => es.filter(e => e.name === name).length;
  check('Machines: 5 foundries, 9 assembling machines 3, 3 oil refineries, 5 chemical plants, 1 electric furnace', count('foundry') === 5 && count('assembling-machine-3') === 9 && count('oil-refinery') === 3 && count('chemical-plant') === 5 && count('electric-furnace') === 1, f.counts);
  const craftable = (machine, recipe) => { const r = p.recipes[recipe]; if (!r) return false; return MACHINE_CATEGORY[machine] ? r.categories.includes(MACHINE_CATEGORY[machine]) : r.categories.some(c => p.entities[machine].crafting_categories.includes(c)); };
  check('Every fixed recipe is pinned and can be crafted in its machine', m.machines.filter(v => v.recipe).every(v => get(v.entity).recipe === v.recipe && craftable(v.name, v.recipe)));
  const switching = m.machines.filter(v => v.switching || v.shadow);
  check('Every switching and shadow machine takes its recipe from the circuit network and has no fixed recipe', switching.length === 5 && switching.every(v => get(v.entity).control_behavior?.set_recipe === true && !get(v.entity).recipe));
  check('Every rule selects a pinned recipe its machine can craft', m.rules.every(r => { const mach = m.machines.find(v => v.role === r.machine); return mach && craftable(mach.name, r.recipe); }));
  check('Nothing of the assembling machine 3 line or the platform kit is left', !m.machines.some(v => /speed-module|processing-unit|engine|rocket-silo|assembling-machine-[123]$|foundation|battery|caster-S/.test(v.role)) && !m.rules.some(r => /low-density|casting-copper$|casting-pipe|silo|landing|platform|collector|crusher|solar|accumulator|combinator|chest|substation|electric-furnace/.test(r.recipe)));

  // ---- the ring
  const ring = m.ring.belts.map(get), ringSet = new Set(m.ring.belts), beltAt = new Map(es.filter(e => e.name === 'fast-transport-belt').map(e => [coord(e.position), e]));
  const next = b => { const [dx, dy] = vector[b.direction || 0]; return beltAt.get(coord({ x: b.position.x + dx, y: b.position.y + dy })); };
  let closed = ring.length > 0; const incoming = new Map();
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
    const okTo = a.to ? to?.entity_number === a.to : to && (to.name === 'fast-transport-belt' || to.name.endsWith('chest'));
    if (!okFrom || !okTo) armFaults.push({ arm: a.entity, role: a.role, from: from?.name, to: to?.name });
    if (/ring feed|switching output$|to ring/.test(a.role) && !(to && ringSet.has(to.entity_number))) armFaults.push({ arm: a.entity, role: a.role, drop: 'not the ring' });
    if (/ring input|switching input/.test(a.role) && !(from && ringSet.has(from.entity_number))) armFaults.push({ arm: a.entity, role: a.role, pickup: 'not the ring' });
    if (a.section === 'fuel' && [from, to].some(v => v && ringSet.has(v.entity_number))) armFaults.push({ arm: a.entity, role: a.role, fuel: 'touches the ring' });
  }
  check('Every arm picks up and drops where its role says; no arm of the fuel section touches the ring', armFaults.length === 0, armFaults.slice(0, 8));
  const arms = es.filter(e => e.name.includes('inserter'));
  check('Every arm has its hand size pinned (fast 1, bulk 2)', arms.every(e => e.override_stack_size === m.equipment.inserters[e.name]) && arms.length === m.arms.length);
  check('Every ring-feeding arm is gated on its item below the ring limit', m.arms.filter(a => a.ringCap).every(a => { const c = get(a.entity).control_behavior; return c.circuit_enabled && c.circuit_condition.first_signal.name === a.ringCap && c.circuit_condition.comparator === '<' && c.circuit_condition.constant === m.ringArmCaps[a.ringCap]; }));
  for (const o of m.outputs.filter(v => v.id !== 'OUT-5')) { const a = get(o.arm), from = at(contact(a, p, 'pickup')), to = at(contact(a, p, 'drop')); check(`Chest ${o.id}: its arm takes from the ring and drops into its chest`, from && ringSet.has(from.entity_number) && to?.entity_number === o.chest); }

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
  check('Every pipe, underground pipe, tank and pump belongs to exactly one declared fluid', fluidEntities.every(e => fluidOf.has(e.entity_number)) && fluidOf.size === fluidEntities.length);
  const reach = new Map(fluidEntities.map(e => [e.entity_number, targets(e).map(q => tileOf.get(`${q.x},${q.y}`)).filter(o => o && fluidOf.has(o.entity_number)).map(o => o.entity_number)]));
  const linked = (a, b) => reach.get(a).includes(b) && reach.get(b).includes(a);
  const mixed = []; for (const a of fluidEntities) for (const b of reach.get(a.entity_number)) if (linked(a.entity_number, b) && fluidOf.get(a.entity_number) !== fluidOf.get(b)) mixed.push([a.entity_number, b]);
  check('No pipe of one fluid connects to a pipe of another', mixed.length === 0, mixed.slice(0, 6));
  check('Every underground pipe has exactly one partner within ten tiles', fluidEntities.filter(e => e.name === 'pipe-to-ground').every(e => e.partner && get(e.partner).partner === e.entity_number));
  for (const [fluid, list] of Object.entries(m.fluids)) {
    const seen = new Set([list[0]]), queue = [list[0]];
    while (queue.length) { const a = queue.pop(); for (const b of reach.get(a)) if (linked(a, b) && !seen.has(b)) { seen.add(b); queue.push(b); } }
    // molten copper is two single pipes: each joins a port of the copper lava foundry to a port of the cable foundry
    check(`The ${fluid} pipes: ${fluid === 'molten-copper' ? 'two single pipes, both between the two copper foundries' : 'one network'}`, fluid === 'molten-copper' ? seen.size === 1 && list.length === 2 : seen.size === list.length, { connected: seen.size, declared: list.length });
  }

  // ---- machine fluid ports. A one-fluid recipe joins a machine's two input ports (or its two output ports) into one
  // box, and a recipe change pushes what is left in a box out through any of its ports. So the ports of one kind of a
  // machine may touch the pipes of one fluid only; a second fluid reaches the machine through a pump standing on the port.
  const rot = ([x, y], d) => { for (let k = 0; k < (d || 0); k += 4) [x, y] = [-y, x]; return [x, y]; };
  const portsOf = e => (p.entities[e.name].fluid_boxes || []).flatMap((fb, i) => fb.pipe_connections.map(c => {
    const [ox, oy] = rot(e.mirror ? [-c.position[0], c.position[1]] : c.position, e.direction), facing = ((c.direction || 0) + (e.direction || 0)) % 16;
    const spot = { x: Math.floor(e.position.x + ox), y: Math.floor(e.position.y + oy) }, target = { x: spot.x + vector[facing][0], y: spot.y + vector[facing][1] };
    const other = tileOf.get(`${target.x},${target.y}`);
    const joined = other && fluidOf.has(other.entity_number) && targets(other).some(q => q.x === spot.x && q.y === spot.y) ? other : null;
    return { box: i + 1, kind: fb.production_type, tile: spot, target, neighbour: joined?.entity_number ?? null, via: joined?.name ?? null, fluid: joined ? fluidOf.get(joined.entity_number) : null };
  }));
  const fluidMachines = es.filter(e => ['foundry', 'assembling-machine-3', 'chemical-plant', 'oil-refinery'].includes(e.name));
  const roleOf = e => m.machines.find(v => v.entity === e.entity_number)?.role;
  const portTable = fluidMachines.map(e => ({ entity: e.entity_number, role: roleOf(e), ports: portsOf(e) })).filter(v => v.ports.some(q => q.neighbour));
  check('Only the one cracker the rocket fuel supply mirrors is mirrored', JSON.stringify(es.filter(e => e.mirror).map(roleOf)) === '["heavy-cracking-1"]');
  // the crackers take two fluids on two input ports and the refineries make one fluid on one of three output ports: both by design
  const twoFluids = [];
  for (const v of portTable) for (const kind of ['input', 'output']) {
    const direct = new Set(v.ports.filter(q => q.kind === kind && q.neighbour && q.via !== 'pump').map(q => q.fluid));
    if (direct.size > 1 && !/^heavy-cracking/.test(v.role)) twoFluids.push({ machine: v.role, entity: v.entity, kind, fluids: [...direct] });
  }
  check('No machine has two ports of one kind on pipes of different fluids (the crackers apart: two fluids, two boxes, fixed recipe)', twoFluids.length === 0, twoFluids);
  const expectedPorts = { cable: { input: ['molten-copper'] }, 'molten-copper': { input: ['lava'], output: ['molten-copper'] }, 'molten-iron': { input: ['lava'], output: ['molten-iron'] }, 'caster-C': { input: ['molten-iron', 'pump:water'] }, U2: { input: ['lubricant'] }, 'refined-concrete': { input: ['water'] } };
  const mallPorts = Object.fromEntries(portTable.filter(v => !get(v.entity).recipe || !/liquefaction|cracking|solid-fuel|rocket-fuel/.test(v.role)).map(v => [v.role, Object.fromEntries(['input', 'output'].map(kind => [kind, [...new Set(v.ports.filter(q => q.kind === kind && q.neighbour).map(q => (q.via === 'pump' ? 'pump:' : '') + q.fluid))].sort()]).filter(([, list]) => list.length))]));
  check('Mall part: every machine fluid port touches the fluid it is meant to (and nothing else touches a port)', JSON.stringify(Object.keys(mallPorts).sort()) === JSON.stringify(Object.keys(expectedPorts).sort()) && Object.entries(expectedPorts).every(([k, want]) => JSON.stringify(mallPorts[k]) === JSON.stringify(Object.fromEntries(Object.entries(want).map(([kind, list]) => [kind, [...list].sort()])))), mallPorts);
  check('The water pump stands directly between the water pipe and the casting foundry port it feeds (nothing flows back through it)', m.pumps.length === 1 && count('pump') === 1 && m.pumps.every(v => { const e = get(v.entity), [dx, dy] = vector[e.direction || 0]; return fluidOf.get(v.entity) === v.fluid && tileOf.get(`${Math.floor(e.position.x + dx * 1.5)},${Math.floor(e.position.y + dy * 1.5)}`)?.entity_number === v.to && tileOf.get(`${Math.floor(e.position.x - dx * 1.5)},${Math.floor(e.position.y - dy * 1.5)}`)?.entity_number === v.from; }));
  // fuel section: by the measured tables. Every port the recipe uses has a pipe of that fluid on its tile; no pipe opening faces an unused port.
  if (slots) {
    const faults = [];
    for (const e of fluidMachines.filter(v => m.fuel.machines.includes(v.entity_number))) {
      const key = `${e.name}|${e.recipe}`, d = `d${e.direction || 0}${e.mirror ? 'M' : ''}`, cx = e.position.x - 0.5, cy = e.position.y - 0.5;
      for (const slot of slots.slots[key]?.[d] || [{ fluid: 'no table' }]) {
        const on = (slot.targets || []).map(([dx, dy]) => tileOf.get(`${cx + dx},${cy + dy}`)).filter(o => o && fluidOf.has(o.entity_number));
        if (!on.length || on.some(o => fluidOf.get(o.entity_number) !== slot.fluid)) faults.push({ machine: roleOf(e), fluid: slot.fluid, found: on.map(o => fluidOf.get(o.entity_number)) });
      }
      for (const [dx, dy] of slots.unusedPorts[key]?.[d] || []) { const o = tileOf.get(`${cx + dx},${cy + dy}`); if (o && fluidOf.has(o.entity_number) && targets(o).some(q => Math.abs(q.x - cx) <= (e.name === 'oil-refinery' ? 2 : 1) && Math.abs(q.y - cy) <= (e.name === 'oil-refinery' ? 2 : 1))) faults.push({ machine: roleOf(e), unusedPortFaces: o.name }); }
    }
    check('Fuel section: every port a recipe uses has a pipe of its fluid, and no pipe opening faces an unused port (the rocket fuel supply\'s measured tables)', faults.length === 0, faults);
  }
  // nothing but water crosses between the two parts
  const crossing = []; for (const a of fluidEntities) for (const b of reach.get(a.entity_number)) if (linked(a.entity_number, b) && (get(a.entity_number).position.y < m.fuel.row) !== (get(b).position.y < m.fuel.row)) crossing.push(fluidOf.get(a.entity_number));
  check('The only pipes that join the mall part and the fuel section carry water', crossing.length > 0 && crossing.every(v => v === 'water'), [...new Set(crossing)]);

  // ---- circuit nets and wires
  const reachOf = e => (e.name === 'substation' ? p.entities.substation.maximum_wire_distance : p.entities[e.name].circuit_wire_max_distance);
  const netOf = new Map(); let netClash = 0;
  for (const [name, net] of Object.entries(m.nets)) for (const [id, connector] of net.members) { const key = `${id}:${connector}`; if (netOf.has(key) && netOf.get(key) !== name) netClash++; netOf.set(key, name); }
  check('No connector belongs to two circuit nets', netClash === 0);
  const circuit = bp.wires.filter(w => w[1] !== 5), copper = bp.wires.filter(w => w[1] === 5);
  check('Every circuit wire joins two members of the same net and is within reach', circuit.every(w => netOf.get(`${w[0]}:${w[1]}`) && netOf.get(`${w[0]}:${w[1]}`) === netOf.get(`${w[2]}:${w[3]}`) && distance(get(w[0]), get(w[2])) <= Math.min(reachOf(get(w[0])), reachOf(get(w[2])))), { wires: circuit.length });
  const split = [];
  for (const [name, net] of Object.entries(m.nets)) {
    const keys = net.members.map(([id, c]) => `${id}:${c}`), seen = new Set([keys[0]]), queue = [keys[0]];
    while (queue.length) { const a = queue.pop(); for (const w of circuit) { const u = `${w[0]}:${w[1]}`, v = `${w[2]}:${w[3]}`; const b = u === a ? v : v === a ? u : null; if (b && !seen.has(b)) { seen.add(b); queue.push(b); } } }
    if (seen.size !== new Set(keys).size) split.push(name);
  }
  check('Every circuit net is connected', split.length === 0, split);
  check('Rule deciders read stock on red (loose stock, or the ring and the casting foundry) and the control net on green', m.rules.every(r => ['LOOSE', 'CAST'].includes(netOf.get(`${r.entity}:1`)) && netOf.get(`${r.entity}:2`) === 'GREEN'));
  // the fuel section and the list: its machines are on no circuit wire; only its four output arms and its chest are, on the control net, for the cap
  const fuelWired = es.filter(e => e.position.y > m.fuel.row && [...netOf.keys()].some(k => k.startsWith(e.entity_number + ':')));
  check('Fuel section: no machine is on a circuit wire; its chest and its four output arms read the cap, nothing else', fuelWired.every(e => e.name === 'substation' || e.entity_number === m.fuel.chest || m.fuel.arms.includes(e.entity_number)) && m.fuel.arms.every(id => { const c = get(id).control_behavior; return netOf.get(`${id}:2`) === 'GREEN' && c.circuit_enabled && c.circuit_condition.first_signal.name === FUEL && c.circuit_condition.comparator === '<' && c.circuit_condition.constant === 0; }) && netOf.get(`${m.fuel.chest}:2`) === 'GREEN' && !m.rules.some(r => r.recipe === FUEL));

  // ---- power
  const subs = es.filter(e => e.name === 'substation'), area = p.entities.substation.supply_area_distance;
  const powered = e => subs.some(s => intersects(box(e, p), { left: s.position.x - area, right: s.position.x + area, top: s.position.y - area, bottom: s.position.y + area }));
  const electric = es.filter(e => p.entities[e.name].energy_source?.type === 'electric');
  check('Every powered entity stands in a substation supply area', electric.every(powered), electric.filter(e => !powered(e)).map(e => e.entity_number).slice(0, 8));
  check('Power is five substations in one copper chain, nothing else', subs.length === 5 && copper.length === 4 && copper.every(w => distance(get(w[0]), get(w[2])) <= p.entities.substation.maximum_wire_distance) && !es.some(e => /pole/.test(e.name)));

  // ---- control program
  const listed = m.products.filter(v => !v.independent), keys = m.products.map(v => v.key);
  check('Every listed product has a rule at its group level; rocket fuel has none', listed.every(v => m.rules.some(r => r.recipe === v.item && r.level === m.groups[v.group - 1].level)) && JSON.stringify(m.independent) === JSON.stringify([FUEL]));
  check('Every level weight sits in its level band', m.rules.filter(r => r.level).every(r => Math.floor(r.weight / 100000) === r.level));
  check('Each switching machine has a parking recipe: an idle rule (the casting foundry) or a park decider (U1, U2)', m.rules.some(r => r.machine === 'caster-C' && r.idle) && Object.values(m.controllers).every(c => c.park && c.idleRecipe));
  check('The recipe wire of U1 and U2 is never without a recipe: "parked" is also raised on the tick a craft ends with the pick to park', Object.entries(m.controllers).every(([name, c]) => {
    const conditions = get(c.boot).control_behavior.decider_conditions.conditions, onNew = m.nets['NEW-' + name].members.some(([id, connector]) => id === c.boot && connector === 2);
    return onNew && conditions.length === 3 && conditions[1].compare_type === 'or' && conditions[1].first_signal.name === 'signal-P' && conditions[2].compare_type === 'and' && conditions[2].first_signal.type === 'recipe' && conditions[2].first_signal.name === c.idleRecipe && conditions[2].first_signal_networks.green && !conditions[2].first_signal_networks.red;
  }));
  const capsFilters = get(m.capsCombinator.entity).control_behavior.sections.sections[0].filters;
  check('The caps combinator holds every cap, rocket fuel included', keys.every(n => capsFilters.find(c => c.name === m.capSignals[n])?.count === m.caps[n]) && capsFilters.length === keys.length);
  check('Every stock has exactly one chest', m.stock.length === keys.length && m.stock.every(s => m.outputs.find(o => o.id === s.output)?.chest === s.chest && m.outputs.find(o => o.id === s.output).items.includes(s.item)) && m.outputs.flatMap(o => o.items).length === keys.length);
  check('Every chest list names exactly its declared products', m.outputs.filter(o => o.list).every(o => JSON.stringify(get(o.list).control_behavior.sections.sections[0].filters.map(c => c.name).sort()) === JSON.stringify([...o.items].sort())));
  check('Every output chest is a passive provider chest; the only other chest is the belt foundry\'s buffer', m.outputs.every(o => get(o.chest).name === 'passive-provider-chest') && count('passive-provider-chest') === m.outputs.length && count('steel-chest') === 1 && get(m.buffer.chest).name === 'steel-chest');
  // everything that leaves the belt foundry goes through the buffer chest, and comes out only while the ring has room for that item
  const limits = get(m.buffer.limits).control_behavior.sections.sections[0].filters, u2Rules = m.rules.filter(r => r.machine === 'U2').map(r => r.recipe);
  const u2Items = new Set(u2Rules.flatMap(r => [...p.recipes[r].ingredients.filter(v => v.type === 'item').map(v => v.name), ...p.recipes[r].results.map(v => v.name)]));
  check('Belt foundry buffer: its only output arm drops into the chest, the chest arm drops on the ring, every item the foundry can hold has a limit, and the limits fit the inner lane', (() => {
    const out = m.arms.filter(a => a.from === m.controllers.U2.machine), back = get(m.buffer.arm), c = get(m.buffer.filter).control_behavior.decider_conditions.conditions;
    return out.length === 1 && out[0].to === m.buffer.chest && at(contact(back, p, 'pickup'))?.entity_number === m.buffer.chest && ringSet.has(at(contact(back, p, 'drop'))?.entity_number) && back.control_behavior.circuit_set_filters === true
      && [...u2Items].every(n => limits.find(l => l.name === n)?.count < 0) && netOf.get(`${m.buffer.chest}:2`) === 'BUFFER-CHEST' && netOf.get(`${m.buffer.filter}:2`) === 'BUFFER-CHEST' && netOf.get(`${m.buffer.filter}:1`) === 'BUFFER-ROOM' && netOf.get(`${m.buffer.filter}:3`) === 'BUFFER-FILTER' && netOf.get(`${m.buffer.arm}:1`) === 'BUFFER-FILTER'
      && netOf.get(`${m.buffer.chestCopy}:3`) === 'LOOSE' && netOf.get(`${m.buffer.handCopy}:3`) === 'LOOSE' && c.length === 2 && c[0].comparator === '>' && c[1].comparator === '<';
  })(), { items: [...u2Items].sort(), limits: limits.length });

  // ---- labels
  const labelled = id => { const e = get(id); return e?.name === 'display-panel' && e.always_show && e.text?.length > 3 && e.icon; };
  check('Every entrance, the stone exit, the power connection, the caps combinator and every chest has a display panel', m.ports.every(v => labelled(v.panel)) && m.outputs.every(o => labelled(o.panel)) && labelled(m.power.panel) && labelled(m.capsCombinator.panel), { panels: count('display-panel') });
  check('Every entrance panel carries its per-minute figure', m.ports.filter(v => !v.exit).every(v => v.perMinute > 0 && get(v.panel).text.includes(`${v.perMinute}/min`)));
  check('Every entrance and the stone exit lies on the edge of the footprint with its outside tile free', m.ports.every(v => { const t = tile(get(v.entity)), b = f.bounds, out = { x: Math.floor(v.externalContact.x), y: Math.floor(v.externalContact.y) }; return (out.x < b.left || out.x >= b.right || out.y < b.top || out.y >= b.bottom) && Math.abs(out.x - t.x) + Math.abs(out.y - t.y) === 1; }));
  check('No display panel on the top row (it would reach over the edge)', es.filter(e => e.name === 'display-panel').every(e => e.position.y > 1));

  // ---- lane room
  check('The ring limits of each lane, all reached at once, fit that lane', m.ring.laneLimits.inner <= m.ring.laneCapacity && m.ring.laneLimits.outer <= m.ring.laneCapacity, { ...m.ring.laneLimits, laneCapacity: m.ring.laneCapacity, bound: m.ring.bound });
  check('The technology closure includes the foundry, calcite processing (coal liquefaction), rocket fuel and the selector combinator', ['foundry', 'calcite-processing', 'advanced-oil-processing', 'rocket-fuel', 'advanced-combinators', 'logistics-3', 'automation-3', 'bulk-inserter'].every(t => m.technologyClosure.includes(t)), m.technologyClosure.filter(t => /coal|rocket|foundry/.test(t)));
  return { passed: errors.length === 0, checksTotal: checks.length, checks, errors, counts: m.footprint.counts };
}
// the audit with the measured port tables loaded (what the generator, the validator and the tests call)
export const auditFor = async (object, m, p) => auditBlueprint(object, m, p, await fuelSlots());

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2] ? path.resolve(process.argv[2]) : PUBLISHED;
  const [m, p, slots] = await Promise.all([readJson(path.join(folder, 'manifest.json')), prototypes(), fuelSlots()]);
  const audit = auditBlueprint(decode(await fs.readFile(path.join(folder, 'blueprint.txt'), 'utf8')), m, p, slots);
  console.log(json({ passed: audit.passed, checksTotal: audit.checksTotal, errors: audit.errors, failed: audit.checks.filter(c => !c.passed) }));
  if (!audit.passed) process.exitCode = 1;
}
