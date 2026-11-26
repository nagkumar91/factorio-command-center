// A supply blueprint as it lies when placed turned or mirrored, and the orders in which it can be built piece by piece.
// Turned: the game turns the blueprint itself (build direction); the entities are turned here the same way only so the harness knows
// where to look. Mirrored: the game has no script call that flips a blueprint, so the mirror image is written here as its own string
// (positions and directions mirrored, the mirror flag set on the machines whose fluid ports are not symmetric) and that string is built.
// Either way the fluid model is computed again from the placed entities with the native slot tables: the placed blueprint must have the
// same networks, the same connections and the same unused ports as the published one.
import assert from 'node:assert/strict';
import { analyzeFluids, machineBoxes, portRules, MACHINES, encode, sha } from './lib.mjs';
import { fixtureOf } from './package.mjs';

export const PLACEMENTS = { north: { turns: 0 }, rot90: { turns: 1 }, rot180: { turns: 2 }, rot270: { turns: 3 }, flipH: { turns: 0, flip: 'h' }, flipV: { turns: 0, flip: 'v' } };
const MIRRORED = ['oil-refinery', 'chemical-plant'];   // an assembling machine 3 has its two ports on its axis: turning covers it
const zero = v => (v === 0 ? 0 : v);

export function placed(bp, manifest, p, slots, kind = 'north') {
  const spec = PLACEMENTS[kind];
  assert(spec, 'unknown placement ' + kind);
  const { turns: k, flip } = spec;
  // centre coordinates (x east, y south): a quarter turn clockwise is (x, y) -> (-y, x)
  const pos = ({ x, y }) => { if (flip === 'h') x = -x; if (flip === 'v') y = -y; for (let i = 0; i < k; i++) [x, y] = [-y, x]; return { x: zero(x), y: zero(y) }; };
  const dir = d => { d = d || 0; if (flip === 'h') d = (16 - d) % 16; if (flip === 'v') d = (24 - d) % 16; return (d + 4 * k) % 16; };
  const entities = bp.blueprint.entities.map(e => {
    const out = { ...e, position: pos(e.position) };
    if (e.direction !== undefined || k || flip) { const d = dir(e.direction); if (d || e.direction !== undefined) out.direction = d; }
    if (['pipe', 'substation', 'display-panel'].includes(e.name)) delete out.direction;
    if (flip && MIRRORED.includes(e.name)) { if (e.mirror) delete out.mirror; else out.mirror = true; }
    return out;
  });
  if (kind === 'north') return { kind, entities: bp.blueprint.entities, fixture: fixtureOf(manifest, bp, p), blueprint: null, place: null };
  // the fluid model of the placed entities
  const fluid = analyzeFluids(entities, slots), rules = portRules(entities, slots);
  assert.deepEqual(fluid.problems, [], `${kind}: fluid problems`);
  const shape = list => JSON.stringify(list.map(c => [c.fluid ?? c.fluids?.[0] ?? null, [...c.entities].sort((a, b) => a - b)]).sort((a, b) => a[1][0] - b[1][0]));
  assert.equal(shape(fluid.components), shape(manifest.fluidComponents), `${kind}: the placed blueprint has the networks of the published one`);
  assert.deepEqual([rules.wrong, rules.unconnected, rules.faced], [[], [], []], `${kind}: port rules`);
  if (manifest.fluidEdges) assert.equal(JSON.stringify(rules.edges), JSON.stringify(manifest.fluidEdges), `${kind}: the placed blueprint has the connections of the published one`);
  const tile = t => { const c = pos({ x: t.x + 0.5, y: t.y + 0.5 }); return { x: Math.floor(c.x), y: Math.floor(c.y) }; };
  const port = x => ({ ...x, externalContact: tile(x.externalContact), approach: x.approach.map(tile) });
  const byNumber = new Map(entities.map(e => [e.entity_number, e]));
  const machineBoxTable = {};
  for (const e of entities.filter(v => MACHINES.includes(v.name))) machineBoxTable[e.entity_number] = machineBoxes(e, slots).map(b => ({ fluid: b.fluid, flow: b.flow, targets: b.ends.map(en => [en.target.x - Math.round(e.position.x - 0.5), en.target.y - Math.round(e.position.y - 0.5)]) }));
  const pole = manifest.power.externalPole;
  const view = { ...manifest,
    machines: manifest.machines.map(m => ({ ...m, direction: byNumber.get(m.entity).direction || 0, mirror: !!byNumber.get(m.entity).mirror })),
    machineBoxes: machineBoxTable, inputPorts: manifest.inputPorts.map(port), outputPorts: manifest.outputPorts.map(port),
    power: { ...manifest.power, externalPole: pos(pole), externalSource: pos({ x: pole.x + 2, y: pole.y }) },
    ...(manifest.fluidEdges ? { unusedPorts: rules.unused } : {}) };
  const blueprint = flip ? encode({ blueprint: { ...bp.blueprint, entities } }) : null;
  return { kind, entities, fixture: fixtureOf(view, bp, p), blueprint,
    place: { name: kind, direction: flip ? 0 : 4 * k, mirrored: !!flip, ...(flip ? { builtStringSha256: sha(blueprint), note: 'mirror image written by the runner as its own string' } : { note: 'the published string, turned by the game' }) } };
}

// ---- piecemeal construction orders (seeded, so a run can be repeated)
export function shuffled(list, seed) {
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out;
}
export function buildOrder(bp, name) {
  const all = bp.blueprint.entities, ids = list => list.map(e => e.entity_number);
  const PIPES = ['pipe', 'pipe-to-ground'], BUILDINGS = [...MACHINES, 'substation'];
  const split = test => [...shuffled(ids(all.filter(test)), 11), ...shuffled(ids(all.filter(e => !test(e))), 12)];
  if (name.startsWith('shuffle-')) return shuffled(ids(all), Number(name.slice(8)));
  if (name === 'pipes-first') return split(e => PIPES.includes(e.name));
  if (name === 'machines-first') return split(e => BUILDINGS.includes(e.name));
  assert.fail('unknown build order ' + name);
}
