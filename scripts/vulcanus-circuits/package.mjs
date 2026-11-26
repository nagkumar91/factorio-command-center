// Turns a Layout (design.mjs of a member) into the published artefacts: blueprint, manifest, ports, footprint, and the fixture
// description the native harness reads. A pure function of the pinned prototypes and the fluid-slot table.
import assert from 'node:assert/strict';
import { sha, encodeKeeping, envelope, technologyClosure, distance, blueprintVersion, analyzeFluids, machineBoxes, unusedPorts, beltGraph, insertTiles, tileMap, tileOf, MACHINES, VEC, isBelt, isArm, HAND, DIR_NAME, E, W, N, S } from './lib.mjs';

export const sideVector = side => ({ west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] })[side];
const INWARD = { west: E, east: W, north: S, south: N }, OUTWARD = { west: W, east: E, north: N, south: S };

// What an arm takes from and drops on, as the audit and the native harness check it: a machine, or a belt line by name.
export function routeOf(e, entities, p, lineOfBelt) {
  const { pickup, drop } = insertTiles(e, p), at = tileMap(entities);
  const end = t => { const o = at.get(t.x + ',' + t.y); if (!o) return { nothing: true }; if (isBelt(o)) return { line: lineOfBelt.get(o.entity_number), belt: o.entity_number }; return { entity: o.entity_number }; };
  return { inserter: e.entity_number, kind: e.name, hand: e.override_stack_size, filter: e.filters?.[0]?.name, from: end(pickup), to: end(drop) };
}

export function assemble(d, p, slots, options = {}) {
  assert(/^2\.1\.\d+$/.test(p.gameVersion));
  const L = d.layout, entities = L.entities, b = L.bounds();
  assert.equal(b.x0, 0, 'layout must start at x = 0'); assert.equal(b.y0, 0, 'layout must start at y = 0');
  // Substations are wired to each other (copper, connector 5): nearest-neighbour spanning tree within the wire reach.
  const poles = entities.filter(e => e.name === 'substation'), wireMax = p.entities.substation.maximum_wire_distance, wires = [];
  const reached = new Set([poles[0]]);
  while (reached.size < poles.length) {
    let best;
    for (const a of reached) for (const c of poles) if (!reached.has(c)) { const dist = distance(a, c); if (dist <= wireMax && (!best || dist < best.dist)) best = { a, c, dist }; }
    assert(best, 'Disconnected substations');
    wires.push([best.a.entity_number, 5, best.c.entity_number, 5]); reached.add(best.c);
  }
  const blueprint = { blueprint: { item: 'blueprint', label: d.label, description: d.description, version: blueprintVersion(p.gameVersion), icons: d.icons.map((name, i) => ({ index: i + 1, signal: { type: d.iconTypes?.[name] || 'item', name } })), entities: entities.map(e => ({ ...e })), wires } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const env = envelope(blueprint.blueprint.entities, p);
  assert.deepEqual([env.bounds.left, env.bounds.top], [0, 0]);
  const counts = Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length]));
  const footprint = { ...env, includes: 'all entities: machines, arms, belts, pipes, substations and panels; the outside supply and the belts and pipes a player connects are not counted', counts, entities: entities.length };
  const fluid = analyzeFluids(entities, slots);
  assert.deepEqual(fluid.problems, [], 'fluid problems: ' + fluid.problems.join('; '));
  assert.deepEqual(fluid.stray, [], 'unused ports: ' + fluid.stray.join('; '));
  const graph = beltGraph(entities, p);
  assert.deepEqual(graph.problems, [], 'belt problems: ' + graph.problems.join('; '));
  // belt lines: the connected lines of the string must be exactly the lines the design named
  const nameOf = new Map(); for (const [name, list] of L.lines) for (const e of list) nameOf.set(e.entity_number, name);
  const beltLines = graph.lines.map(ids => { const names = [...new Set(ids.map(id => nameOf.get(id)))]; assert.equal(names.length, 1, 'belt lines joined: ' + names.join(' + ')); return { name: names[0], items: d.lines[names[0]], entities: ids }; });
  assert.equal(new Set(beltLines.map(l => l.name)).size, beltLines.length, 'a named belt line is in two pieces: ' + beltLines.map(l => l.name).join(', '));
  const lineOfBelt = new Map(); for (const l of beltLines) for (const id of l.entities) lineOfBelt.set(id, l.name);
  const labels = new Map(L.routes.map(r => [r.inserter, r.label]));
  const routes = entities.filter(isArm).map(e => ({ ...routeOf(e, entities, p, lineOfBelt), label: labels.get(e.entity_number) }));
  for (const r of routes) assert(!r.from.nothing && !r.to.nothing, `arm #${r.inserter} (${r.label}) reaches nothing`);
  const tech = technologyClosure(p, d.products, [...new Set(entities.map(e => e.name))].concat(d.sizing.machines.map(m => m.recipe)));
  // Ports: entrance and exit entities with their outside contact tile and the tiles that must stay free beyond it.
  const portInfo = (kind, port) => {
    const v = sideVector(port.side), e = port.entity, t = e.tile;
    const contact = { x: t.x + v[0], y: t.y + v[1] };
    return { id: port.id, item: port.item, kind: port.kind, side: port.side, flow: DIR_NAME[kind === 'input' ? INWARD[port.side] : OUTWARD[port.side]], entity: e.entity_number, tile: { x: t.x, y: t.y }, externalContact: contact, vector: v,
      approach: [1, 2].map(k => ({ x: contact.x + v[0] * k, y: contact.y + v[1] * k })), panel: port.panel.entity_number, label: port.panel.text, perMinute: port.perMinute,
      ...(port.product ? { product: true } : {}), ...(port.byproduct ? { byproduct: true } : {}) };
  };
  const inputs = d.inputs.map(x => portInfo('input', x)), outputs = d.outputs.map(x => portInfo('output', x));
  const machineEntities = entities.filter(e => MACHINES.includes(e.name));
  const machines = machineEntities.map(e => ({ entity: e.entity_number, name: e.name, recipe: e.recipe, role: L.roles.get(e.entity_number).role, group: L.roles.get(e.entity_number).group, tile: { x: e.tile.x, y: e.tile.y }, direction: e.direction || 0 }));
  const centre = e => ({ x: Math.round(e.position.x - 0.5), y: Math.round(e.position.y - 0.5) });
  const machineBoxTable = {}, unused = {};
  for (const e of machineEntities) {
    const c = centre(e);
    machineBoxTable[e.entity_number] = machineBoxes(e, slots).map(bb => ({ fluid: bb.fluid, flow: bb.flow, targets: bb.ends.map(en => [en.target.x - c.x, en.target.y - c.y]) }));
    unused[e.entity_number] = unusedPorts(e, slots).map(q => [q.target.x - c.x, q.target.y - c.y]);
  }
  const fluidOf = {};
  for (const e of entities) if (e.name === 'pipe' || e.name === 'pipe-to-ground') fluidOf[e.entity_number] = fluid.fluidOf.get(e.entity_number);
  const manifest = {
    schema: 1, family: 'vulcanus-circuits', id: d.id, revision: 1, candidateSha256: hash, requiredGameVersion: p.gameVersion, surface: 'vulcanus', prototypeSha256: options.prototypeSha256, fluidSlotsSha256: options.fluidSlotsSha256,
    intendedUse: d.intendedUse, products: d.products, product: d.product, target: d.target, exitCarries: d.exitCarries,
    equipment: { machines: ['foundry', 'assembling-machine-3'], inserters: HAND, power: 'substation', modules: 0, beacons: 0, quality: 'normal', circuitNetwork: false },
    footprint, inputPorts: inputs, outputPorts: outputs,
    power: { entry: d.power.entry.entity_number, panel: d.power.panel.entity_number, label: d.power.label, externalPole: d.power.externalPole, poles: poles.map(e => e.entity_number) },
    machines, groups: Object.fromEntries([...new Set(machines.map(m => m.group))].map(g => [g, machines.filter(m => m.group === g).map(m => m.entity)])),
    routes, beltLines, machineBoxes: machineBoxTable, unusedPorts: unused, fluidOf,
    fluidComponents: fluid.components.map(c => ({ id: c.id, fluid: c.fluids[0], entities: c.entities, boxes: c.boxes })),
    technologyClosure: tech.closure, requirements: tech.requirements.filter(r => !r.enabledByDefault).map(r => ({ recipe: r.recipe, technology: r.selected })),
    sizing: d.sizing,
    status: { static: 'static-audit.json', native: 'native-report.json; qualified only when that report passed for candidateSha256' },
  };
  return { blueprint, code, hash, manifest, footprint, ports: { candidateSha256: hash, inputs, outputs, power: manifest.power }, tech, fluid, layout: L, d, label: d.label };
}
