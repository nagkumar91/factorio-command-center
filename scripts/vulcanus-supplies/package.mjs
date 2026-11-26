// Turns a Layout (design.mjs of either blueprint) into the published artefacts: blueprint, manifest, ports, footprint, and the
// fixture description the native harness reads. Pure function of the pinned prototypes and the fluid-slot table.
import assert from 'node:assert/strict';
import { sha, encodeKeeping, envelope, technologyClosure, distance, box, intersects, blueprintVersion, analyzeFluids, machineBoxes, portRules, MACHINES, VEC, sizeOf, insertTiles, entityAt } from './lib.mjs';

const DIR_NAME = { 0: 'north', 4: 'east', 8: 'south', 12: 'west' };
export const sideVector = side => ({ west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] })[side];

export function assemble(d, p, slots, options = {}) {
  assert(/^2\.1\.\d+$/.test(p.gameVersion));
  const L = d.layout, entities = L.entities;
  const b = L.bounds();
  assert.equal(b.x0, 0, 'layout must start at x = 0'); assert.equal(b.y0, 0, 'layout must start at y = 0');
  // Substations are wired to each other (copper, connector 5): nearest-neighbour spanning tree within the wire reach.
  const poles = entities.filter(e => e.name === 'substation');
  const wireMax = p.entities.substation.maximum_wire_distance;
  if (poles.length > 1) {
    const reached = new Set([poles[0]]);
    while (reached.size < poles.length) {
      let best;
      for (const a of reached) for (const c of poles) if (!reached.has(c)) { const dist = distance(a, c); if (dist <= wireMax && (!best || dist < best.dist)) best = { a, c, dist }; }
      assert(best, 'Disconnected substations');
      (best.a.wires ||= []).push([best.a.entity_number, 5, best.c.entity_number, 5]); reached.add(best.c);
    }
  }
  const blueprint = { blueprint: { item: 'blueprint', label: d.label, description: d.description, version: blueprintVersion(p.gameVersion), icons: d.icons.map((name, i) => ({ index: i + 1, signal: { type: 'item', name } })), entities: L.blueprintEntities() } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const env = envelope(blueprint.blueprint.entities, p);
  const counts = Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length]));
  const footprint = { ...env, includes: d.footprintIncludes, counts, entities: entities.length };
  assert.deepEqual([env.bounds.left, env.bounds.top], [0, 0]);
  const fluid = analyzeFluids(entities, slots);
  assert.deepEqual(fluid.problems, [], 'fluid problems: ' + fluid.problems.join('; '));
  const tech = technologyClosure(p, d.products, [...new Set(entities.map(e => e.name))].concat(d.recipes));
  const power = { entry: d.power.entry.entity_number, panel: d.power.panel.entity_number, label: d.power.label, externalPole: d.power.externalPole, poles: poles.map(e => e.entity_number) };
  // Ports: entrance and exit entities with their outside contact tile and the tiles that must stay free beyond it.
  const portInfo = (kind, port) => {
    const v = sideVector(port.side), e = port.entity, t = e.tile;
    assert.equal(t.s, 1);
    const contact = { x: t.x + v[0], y: t.y + v[1] };
    const tiles = port.kind === 'pipe' ? [1, 2, 3].map(k => ({ x: contact.x + v[0] * k, y: contact.y + v[1] * k })) : [0, 1, 2].map(k => ({ x: contact.x + v[0] * k, y: contact.y + v[1] * k }));
    return { id: port.id, item: port.item, kind: port.kind, side: port.side, flow: kind === 'input' ? DIR_NAME[(({ west: 4, east: 12, north: 8, south: 0 })[port.side])] : DIR_NAME[({ west: 12, east: 4, north: 0, south: 8 })[port.side]],
      entity: e.entity_number, tile: { x: t.x, y: t.y }, externalContact: contact, vector: v, approach: tiles, panel: port.panel.entity_number, label: port.panel.text, ...(port.perMinute !== undefined ? { perMinute: port.perMinute } : {}), ...(port.extra || {}) };
  };
  const inputs = d.inputs.map(x => portInfo('input', x)), outputs = d.outputs.map(x => portInfo('output', x));
  const machines = entities.filter(e => MACHINES.includes(e.name)).map(e => ({ entity: e.entity_number, name: e.name, recipe: e.recipe, role: d.roles.get(e.entity_number) || e.recipe, tile: { x: e.tile.x, y: e.tile.y }, direction: e.direction || 0, mirror: !!e.mirror }));
  const machineBoxTable = {}, machineFluids = {};
  for (const e of entities.filter(e => MACHINES.includes(e.name))) {
    const bx = machineBoxes(e, slots);
    machineBoxTable[e.entity_number] = bx.map(bb => ({ fluid: bb.fluid, flow: bb.flow, targets: bb.ends.map(en => [en.target.x - Math.round(e.position.x - 0.5), en.target.y - Math.round(e.position.y - 0.5)]) }));
    machineFluids[e.entity_number] = [...new Set(bx.map(bb => bb.fluid))];
  }
  const fluidOf = {};
  for (const e of entities) if (e.name === 'pipe' || e.name === 'pipe-to-ground') fluidOf[e.entity_number] = fluid.fluidOf.get(e.entity_number);
  const manifest = {
    schema: 1, id: d.id, revision: 1, candidateSha256: hash, requiredGameVersion: p.gameVersion, prototypeSha256: options.prototypeSha256, fluidSlotsSha256: options.fluidSlotsSha256, ...(options.memberPrototypeSha256 ? { memberPrototypeSha256: options.memberPrototypeSha256 } : {}), ...(options.memberFluidSlotsSha256 ? { memberFluidSlotsSha256: options.memberFluidSlotsSha256 } : {}),
    intendedUse: d.intendedUse, products: d.products, targets: d.targets, equipment: d.equipment, footprint,
    inputPorts: inputs, outputPorts: outputs, power, machines, roles: Object.fromEntries(d.roles), routes: d.routes,
    machineBoxes: machineBoxTable, machineFluids, fluidOf,
    fluidComponents: fluid.components.map(c => ({ id: c.id, fluid: c.fluids[0] || null, entities: c.entities, boxes: c.boxes })),
    technologyClosure: tech.closure, requirements: tech.requirements.filter(r => !r.enabledByDefault).map(r => ({ recipe: r.recipe, technology: r.selected })),
    sizing: d.sizing,
    status: { static: 'static-audit.json', native: 'native-report.json; qualified only when that report passed for candidateSha256' },
    ...(d.extra || {}),
    // Members that state their port rules (see portRules in lib.mjs): every fluid connection of the static model as a pair of entity
    // numbers, and the tiles in front of the ports no recipe uses. The native harness compares both with what the game built.
    ...(d.fluidSafety ? { fluidEdges: fluid.edges, unusedPorts: portRules(entities, slots).unused } : {}),
  };
  return { blueprint, code, hash, manifest, footprint, ports: { candidateSha256: hash, inputs, outputs, power }, tech, fluid, layout: L, d };
}

// What the native harness needs, derived from a manifest (so a published blueprint can be re-run from its own files).
export function fixtureOf(manifest, bp, p, scenario) {
  const M = {
    id: manifest.id, machines: manifest.machines.map(m => ({ entity: m.entity, recipe: m.recipe, role: m.role })), routes: manifest.routes,
    machineBoxes: manifest.machineBoxes, machineFluids: manifest.machineFluids, fluidOf: manifest.fluidOf, fluidComponents: manifest.fluidComponents,
    inputs: manifest.inputPorts.map(x => ({ id: x.id, item: x.item, kind: x.kind === 'belt' ? 'belt' : 'pipe', entity: x.entity, externalContact: { x: x.externalContact.x + 0.5, y: x.externalContact.y + 0.5 } })),
    outputs: manifest.outputPorts.map(x => ({ id: x.id, item: x.item, kind: x.kind === 'belt' ? 'belt' : 'pipe', entity: x.entity, externalContact: { x: x.externalContact.x + 0.5, y: x.externalContact.y + 0.5 } })),
    approaches: [...manifest.inputPorts, ...manifest.outputPorts].map(x => ({ id: x.id, tiles: x.approach.map(t => ({ x: t.x + 0.5, y: t.y + 0.5 })) })),
    power: { entry: manifest.power.entry, panel: manifest.power.panel, poles: manifest.power.poles, externalPole: { x: manifest.power.externalPole.x, y: manifest.power.externalPole.y }, ...(manifest.power.externalSource ? { externalSource: manifest.power.externalSource } : {}) },
    footprint: manifest.footprint,
    ...(manifest.fluidEdges ? { fluidEdges: manifest.fluidEdges, unusedPorts: manifest.unusedPorts.map(u => ({ entity: u.entity, tiles: u.tiles.map(t => ({ x: t.x + 0.5, y: t.y + 0.5 })) })) } : {}),
  };
  return M;
}
