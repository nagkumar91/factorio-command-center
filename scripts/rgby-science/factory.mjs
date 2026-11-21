// Builds the three published four-pack imports from one routed assembly:
// the factory alone, and the factory with 15 or 30 connected labs.
// Each import is routed, compacted (compact.mjs), then has its long plain
// belt runs buried (underground.mjs). Nothing here reads or writes files.
import {createHash} from 'node:crypto';
import {encodeBlueprint} from '../blueprints.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';
import {assembleFactory} from './assemble.mjs';
import {compactLayout} from './compact.mjs';
import {FactoryLayout} from './layout.mjs';
import {makeLabAnnex} from './labs.mjs';
import {optimizeUnderground} from './underground.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
/**
 * Placement of the nine workshops. `lift` raises all of them by that many rows,
 * so they start level with the entrance headers instead of below them; `blocks`
 * moves single workshops (left, top, before the lift). Every change of placement
 * reroutes the factory and needs a fresh native qualification of all three imports:
 * blue science, green science and low-density structures have no spare machine
 * time, so a new routing can miss the 29.5/min gate (see the README).
 */
export const LAYOUT = {lift: 10, blocks: {}};

// Compacts the routed layout, refreshes every port position, then buries belts.
function settle(bp, ports, extraPorts = []) {
  const tile = new Map(bp.entities.map(e => [e.position.x + ',' + e.position.y, e]));
  const west = ports.filter(p => p.externalSide === 'west').map(p => p.entity), east = ports.filter(p => p.externalSide === 'east').map(p => p.entity), ties = [];
  for (const p of ports) {
    if (p.kind === 'input' && p.displayEntity) ties.push([p.entity, p.displayEntity, 'near']);
    if (p.kind === 'fluid') { const sign = tile.get((p.x + 1) + ',' + (p.y + 1)); if (sign?.name === 'display-panel') ties.push([p.entity, sign.entity_number, 'rigid']); }
  }
  const compaction = compactLayout(bp, {west, east, ties, fixed: extraPorts.map(p => p.entity)});
  const byId = new Map(bp.entities.map(e => [e.entity_number, e]));
  for (const p of [...ports, ...extraPorts]) { const e = byId.get(p.entity); if (e) { p.x = e.position.x; p.y = e.position.y; p.position = {...e.position}; } }
  const underground = optimizeUnderground(bp, [...ports, ...extraPorts]);
  return {compaction, underground};
}
const construction = entities => Object.fromEntries([...new Set(entities.map(e => e.name))].map(n => [n, entities.filter(e => e.name === n).length]));

function finishFactory(raw, prototypeSha256, a) {
  const bp = structuredClone(a.bp), ports = structuredClone(a.ports), {compaction, underground} = settle(bp, ports);
  const id = 'rgby-science-30', code = encodeBlueprint({blueprint: bp}), machineCounts = {};
  for (const e of bp.entities) if (e.recipe) machineCounts[e.recipe] = (machineCounts[e.recipe] || 0) + 1;
  const manifest = {id, name: bp.label, file: id + '.txt', blueprintSha256: sha(code), prototypeSha256, products: a.products, targetPerMinute: 30,
    targets: Object.fromEntries(a.products.map(n => [n, 30])), inputs: ports.filter(p => p.kind === 'input'), fluids: ports.filter(p => p.kind === 'fluid'),
    outputs: ports.filter(p => p.kind === 'output'), ports, machineCounts, footprint: starterBounds(bp.entities, raw), loopControl: a.loops, compaction, underground,
    requirements: a.requirement, components: a.components, construction: construction(bp.entities), setupNotes: [bp.description], status: 'candidate-native-validation-pending'};
  return {manifest, code};
}

function finishLabs(raw, a, factory, rows, {lift = 0, labX = 62, exportX = 104, exportRow = 41}) {
  const source = structuredClone(a.bp), l = new FactoryLayout(raw);
  for (const e of structuredClone(source.entities)) l.place(e);
  l.next = Math.max(...l.entities.map(e => e.entity_number)) + 1; l.wires = structuredClone(source.wires);
  const annex = makeLabAnnex(raw, {rows}), map = new Map(), top = 60 - lift;
  for (const e of structuredClone(annex.entities)) { map.set(e.entity_number, l.next); e.entity_number = l.next++; e.position.x += labX; e.position.y += top; e.tags = {flight_science_entity: e.entity_number, rgby_component: 'lab-annex'}; l.place(e); }
  for (const [p, pc, q, qc] of annex.wires) l.wires.push([map.get(p), pc, map.get(q), qc]);
  // Two independent sideloaders put exactly one pack on each lane.
  for (let x = labX - 9; x <= labX - 6; x++) l.belt(x, top + 4, 4);
  l.add('fast-underground-belt', labX - 5, top + 4, {direction: 4, type: 'input'}); l.add('fast-underground-belt', labX - 1, top + 4, {direction: 4, type: 'output'});
  for (let x = labX - 5; x <= labX - 1; x++) l.belt(x, top + 5, 4);
  const feeds = [[labX - 8, top + 3, 8], [labX - 6, top + 5, 0], [labX - 4, top + 4, 8], [labX - 2, top + 6, 0]].map(([x, y, d]) => l.belt(x, y, d));
  const exits = structuredClone(a.ports.filter(p => p.kind === 'output')), inputs = a.ports.filter(p => p.kind === 'input');
  const starts = exits.map(p => l.outputBelt(p));
  for (const [i, e] of starts.entries()) {
    const target = feeds[i], blocked = new Set();
    for (const q of feeds.filter(q => q !== target)) { const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][q.direction / 4]; for (let k = 1; k <= 3; k++) blocked.add((Math.floor(q.position.x) - dx * k) + ',' + (Math.floor(q.position.y) - dy * k)); }
    for (const q of inputs) for (let k = 1; k <= 3; k++) blocked.add((Math.floor(q.x) - k) + ',' + Math.floor(q.y));
    for (const p of starts.filter(p => p !== e)) for (let k = 1; k <= 2; k++) blocked.add((Math.floor(p.position.x) + k) + ',' + Math.floor(p.position.y));
    l.route(e.position, target.position, {minX: -27, maxX: 120, minY: -15, maxY: 82 - lift, startDirection: 4, endDirection: target.direction, blocked});
  }
  const degree = new Map();
  for (const [p, pc, q, qc] of l.wires) if (pc === 5 && qc === 5) { degree.set(p, (degree.get(p) || 0) + 1); degree.set(q, (degree.get(q) || 0) + 1); }
  const sourceIds = new Set(source.entities.map(e => e.entity_number)), isAnnex = e => e.tags?.rgby_component === 'lab-annex', isPole = e => e.name.endsWith('electric-pole');
  // Power the four new export arms, then bridge the lab poles to the factory grid.
  let uncovered = l.entities.filter(e => e.name === 'fast-inserter' && !sourceIds.has(e.entity_number) && !isAnnex(e));
  while (uncovered.length) {
    let best;
    for (let x = exportX - 2; x <= exportX + 8; x++) for (let y = exportRow - 3 - lift; y <= exportRow + 10 - lift; y++) {
      if (l.at(x, y)) continue;
      const covered = uncovered.filter(e => Math.abs(e.position.x - (x + .5)) <= 3 && Math.abs(e.position.y - (y + .5)) <= 3);
      if (!covered.length) continue;
      const distance = e => Math.hypot(e.position.x - x - .5, e.position.y - y - .5);
      const near = l.entities.filter(e => isPole(e) && !isAnnex(e) && (degree.get(e.entity_number) || 0) < 5 && distance(e) <= 9).sort((p, q) => distance(p) - distance(q))[0];
      if (near && (!best || covered.length > best.covered.length)) best = {x, y, covered, near};
    }
    if (!best) throw Error('No export inserter power');
    const pole = l.add('medium-electric-pole', best.x, best.y);
    l.wires.push([best.near.entity_number, 5, pole.entity_number, 5]); degree.set(best.near.entity_number, (degree.get(best.near.entity_number) || 0) + 1); degree.set(pole.entity_number, 1);
    uncovered = uncovered.filter(e => !best.covered.includes(e));
  }
  const oldPoles = l.entities.filter(e => isPole(e) && !isAnnex(e) && (degree.get(e.entity_number) || 0) < 5), labPoles = l.entities.filter(e => isPole(e) && isAnnex(e));
  const gap = (p, q) => Math.hypot(p.position.x - q.position.x, p.position.y - q.position.y);
  let closest;
  for (const p of oldPoles) for (const q of labPoles) { const d = gap(p, q); if (!closest || d < closest.d) closest = {a: p, b: q, d}; }
  let from = closest.a;
  while (gap(from, closest.b) > 9) {
    let best;
    for (let x = Math.floor(from.position.x - 8); x <= from.position.x + 8; x++) for (let y = Math.floor(from.position.y - 8); y <= from.position.y + 8; y++) {
      if (l.at(x, y) || Math.hypot(x + .5 - from.position.x, y + .5 - from.position.y) > 9) continue;
      const d = Math.hypot(x + .5 - closest.b.position.x, y + .5 - closest.b.position.y);
      if (!best || d < best.d) best = {x, y, d};
    }
    if (!best || best.d >= gap(from, closest.b)) throw Error('No lab power bridge');
    const next = l.add('medium-electric-pole', best.x, best.y);
    l.wires.push([from.entity_number, 5, next.entity_number, 5]); from = next;
  }
  l.wires.push([from.entity_number, 5, closest.b.entity_number, 5]);
  for (const e of l.entities) e.tags = {...e.tags, flight_science_entity: e.entity_number};
  const id = 'rgby-science-30-labs-' + rows * 15, label = `Four-pack science · 30/min · ${rows * 15} connected labs`;
  const bp = {...source, label, entities: l.entities, wires: l.wires, description: source.description + ' Four pack outputs feed the connected lab belts directly. ' + (rows === 1 ? '15 labs match 60-second research at 2× lab speed.' : '30 labs match 60-second research at normal lab speed.')};
  const ports = structuredClone(a.ports).map(p => p.kind === 'output' ? {...p, externalSide: undefined} : p);
  const feedPorts = feeds.map(e => ({entity: e.entity_number, x: e.position.x, y: e.position.y}));
  const {compaction, underground} = settle(bp, ports, feedPorts), code = encodeBlueprint({blueprint: bp});
  const lab = bp.entities.filter(e => e.name === 'lab'), origin = {x: Math.min(...lab.map(e => e.position.x)) - 1.5, y: Math.min(...bp.entities.filter(e => e.tags?.rgby_component === 'lab-annex').map(e => e.position.y - (e.name === 'lab' ? 1.5 : .5)))};
  const manifest = {...factory, id, name: label, file: id + '.txt', blueprintSha256: sha(code), inputs: ports.filter(p => p.kind === 'input'), fluids: ports.filter(p => p.kind === 'fluid'), ports, outputs: ports.filter(p => p.kind === 'output'),
    footprint: starterBounds(bp.entities, raw), compaction, underground, expectedLabCount: rows * 15, researchProbe: {seconds: 60, labSpeedModifier: rows === 1 ? 1 : 0},
    labAnnex: {labCount: rows * 15, position: origin, beltPairs: annex.metadata.beltPairs, feedEntities: feedPorts.map(p => p.entity)}, construction: construction(bp.entities), status: 'candidate-native-validation-pending'};
  return {manifest, code};
}

/** Returns [{manifest, code}] for the factory alone, 15 labs and 30 labs. */
export async function buildAll(raw, prototypeBytes, {layout = LAYOUT, log = () => {}, only} = {}) {
  raw['assembling-machine'].lab = raw.lab.lab;
  const a = await assembleFactory(raw, {log, ...layout}), prototypeSha256 = sha(prototypeBytes);
  const factory = finishFactory(raw, prototypeSha256, a);
  if (only === 'factory') return [factory];
  return [factory, ...[1, 2].map(rows => finishLabs(raw, a, factory.manifest, rows, layout))];
}
