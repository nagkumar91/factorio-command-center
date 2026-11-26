// Static audit of the Vulcanus science blueprint, from the decoded string, the manifest, the pinned prototypes and the native
// fluid-slot table: allowed entities, collisions, footprint and counts, fixed recipes, pinned hands, the fluid rules (one fluid
// per pipe network, every machine port on a pipe of exactly its own fluid or on nothing), arms, power, ports, chests, governors.
//   node scripts/vulcanus-science/production-utility-science/audit.mjs [folder] [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLISHED, prototypes, fluidSlots, readJson, json, decode, blueprintVersion, VEC, opposite, N, E, S, W } from './lib.mjs';
import { sizeOf } from './layout.mjs';
import { MAKER } from './bill.mjs';

export const ALLOWED = ['foundry', 'assembling-machine-3', 'chemical-plant', 'electric-furnace', 'fast-inserter', 'bulk-inserter', 'long-handed-inserter', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'express-transport-belt', 'express-underground-belt', 'express-splitter', 'pipe', 'pipe-to-ground', 'substation', 'display-panel', 'passive-provider-chest', 'constant-combinator', 'decider-combinator', 'arithmetic-combinator'];
export const MACHINES = ['foundry', 'assembling-machine-3', 'chemical-plant', 'electric-furnace'];
const HANDS = { 'fast-inserter': 1, 'bulk-inserter': 2, 'long-handed-inserter': 1 };
const REACH = { 'fast-inserter': 1, 'bulk-inserter': 1, 'long-handed-inserter': 2 };
export const tilesOf = e => { const [w, h] = sizeOf(e.name, e.direction || 0), x0 = Math.round(e.position.x - w / 2), y0 = Math.round(e.position.y - h / 2), out = []; for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) out.push([x0 + u, y0 + v]); return out; };
const k = (x, y) => x + ',' + y;
export function grid(entities) { const g = new Map(), hits = []; for (const e of entities) for (const [x, y] of tilesOf(e)) { if (g.has(k(x, y))) hits.push([g.get(k(x, y)).entity_number, e.entity_number]); g.set(k(x, y), e); } return { g, hits }; }

// ---- fluid model: only what the native probe (fluid-slots.json) shows.
//  pipe: opens on all four sides. pipe-to-ground with mouth d: opens on side d; its tunnel runs the other way and pairs with the
//  nearest pipe-to-ground on that line whose mouth points away, at most 10 tiles apart. Machines: the tiles of fluid-slots.json per
//  recipe, direction and mirroring; both tiles of a box a one-fluid recipe uses belong to that one box.
export const MAX_TUNNEL = 10;
export function machinePorts(e, slots) {
  const table = slots.slots[`${e.name}|${e.recipe}`];
  if (!table) return [];
  const boxes = table['d' + (e.direction || 0) + (e.mirror ? 'M' : '')];
  if (!boxes) throw new Error(`no fluid slots for ${e.name} ${e.recipe} d${e.direction || 0}${e.mirror ? 'M' : ''}`);
  const cx = Math.round(e.position.x - 0.5), cy = Math.round(e.position.y - 0.5);
  return boxes.flatMap((b, index) => b.targets.map(([dx, dy]) => ({ box: index, fluid: b.fluid, flow: b.flow, x: cx + dx, y: cy + dy })));
}
export function analyzeFluids(entities, slots, ports = []) {
  const { g } = grid(entities), parent = new Map(), problems = [];
  const find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const join = (a, b) => { parent.set(find(a), find(b)); };
  const pipes = entities.filter(e => e.name === 'pipe' || e.name === 'pipe-to-ground');
  for (const e of pipes) parent.set(e.entity_number, e.entity_number);
  const tile = e => [Math.floor(e.position.x), Math.floor(e.position.y)];
  const opens = (e, side) => e.name === 'pipe' || (e.name === 'pipe-to-ground' && (e.direction || 0) === side);
  for (const e of pipes) {
    const [x, y] = tile(e);
    for (const s of [N, E, S, W]) if (opens(e, s)) { const o = g.get(k(x + VEC[s][0], y + VEC[s][1])); if (o && (o.name === 'pipe' || o.name === 'pipe-to-ground') && opens(o, opposite(s))) join(e.entity_number, o.entity_number); }
    if (e.name === 'pipe-to-ground') {
      const d = opposite(e.direction || 0); let paired = false;
      for (let n = 1; n <= MAX_TUNNEL && !paired; n++) {
        const o = g.get(k(x + VEC[d][0] * n, y + VEC[d][1] * n));
        if (!o || o.name !== 'pipe-to-ground') continue;
        const od = o.direction || 0;
        if (od === d) { join(e.entity_number, o.entity_number); paired = true; } else if (od === opposite(d)) break;
      }
      if (!paired) problems.push(`pipe-to-ground #${e.entity_number} has no partner`);
    }
  }
  const fluidsOf = new Map(), machineFluids = {}, portFaults = [];
  const label = (root, fluid) => { fluidsOf.set(root, (fluidsOf.get(root) || new Set()).add(fluid)); };
  for (const e of entities) if (MACHINES.includes(e.name) && e.recipe) {
    const list = machinePorts(e, slots);
    if (list.length) machineFluids[e.entity_number] = [...new Set(list.map(v => v.fluid))];
    for (const port of list) {
      const o = g.get(k(port.x, port.y));
      if (!o || (o.name !== 'pipe' && o.name !== 'pipe-to-ground')) continue;
      if (o.name === 'pipe-to-ground') { const v = VEC[o.direction || 0], inside = g.get(k(port.x + v[0], port.y + v[1])); if (inside !== e) continue; }
      label(find(o.entity_number), port.fluid);
      port.joined = o.entity_number;
    }
    // every box the recipe uses must reach a pipe through at least one of its tiles
    for (const box of new Set(list.map(v => v.box))) if (!list.some(v => v.box === box && v.joined)) portFaults.push(`#${e.entity_number} ${e.recipe}: ${list.find(v => v.box === box).fluid} port meets no pipe`);
  }
  for (const port of ports) if (port.kind === 'pipe') label(find(port.entity), port.item);
  const networks = new Map();
  for (const e of pipes) { const r = find(e.entity_number); networks.set(r, [...(networks.get(r) || []), e.entity_number]); }
  const fluidOf = {}, list = [];
  for (const [root, members] of networks) {
    const fluids = [...(fluidsOf.get(root) || [])].sort();
    if (fluids.length !== 1) problems.push(`pipe network of #${members[0]} (${members.length} pipes) carries ${fluids.length ? fluids.join(' + ') : 'nothing'}`);
    for (const m of members) fluidOf[m] = fluids[0] || null;
    list.push({ fluid: fluids[0] || null, pipes: members.length, first: Math.min(...members) });
  }
  return { fluidOf, machineFluids, networks: list.sort((a, b) => a.first - b.first), problems: [...problems, ...portFaults] };
}

export function auditBlueprint(object, m, p, slots) {
  const checks = [], errors = [];
  const check = (name, ok, detail = null) => { checks.push({ name, passed: !!ok, ...(detail === null || ok ? {} : { detail }) }); if (!ok) errors.push(name); };
  const bp = object.blueprint, es = bp.entities, ids = new Map(es.map(e => [e.entity_number, e]));
  check('Only allowed entities: foundry, assembling machine 3, chemical plant, electric furnace, fast, bulk and long-handed inserters, fast and express belts, undergrounds and splitters, pipes, substations, panels, provider chests and the governors\' combinators', es.every(e => ALLOWED.includes(e.name)), [...new Set(es.filter(e => !ALLOWED.includes(e.name)).map(e => e.name))]);
  check('Unique entity numbers', ids.size === es.length);
  check(`Blueprint version is ${p.gameVersion}`, bp.version === blueprintVersion(p.gameVersion) && m.requiredGameVersion === p.gameVersion);
  check('No modules, no quality above normal, no tiles, no custom arm reach', es.every(e => !e.items && !e.pickup_position && !e.drop_position && (!e.quality || e.quality === 'normal')) && !bp.tiles);
  const { g, hits } = grid(es);
  check('No two entities share a tile', hits.length === 0, hits.slice(0, 10));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const key of g.keys()) { const [x, y] = key.split(',').map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  check('Published footprint is the envelope of all entities, top-left tile (0, 0)', x0 === 0 && y0 === 0 && x1 - x0 + 1 === m.footprint.width && y1 - y0 + 1 === m.footprint.height && m.footprint.area === m.footprint.width * m.footprint.height, { x0, y0, x1, y1 });
  const counts = Object.fromEntries([...new Set(es.map(e => e.name))].sort().map(n => [n, es.filter(e => e.name === n).length]));
  check('Entity counts match the manifest', JSON.stringify(counts) === JSON.stringify(m.footprint.counts) && es.length === m.footprint.entities);
  // ---- machines
  const machines = es.filter(e => MACHINES.includes(e.name));
  check('Machines are exactly the manifest list', JSON.stringify(machines.map(e => [e.entity_number, e.name, e.recipe || 'stone-brick'])) === JSON.stringify(m.machines.map(v => [v.entity, v.name, v.recipe])));
  check('Every foundry, assembling machine and chemical plant has a fixed recipe in the blueprint; the electric furnaces smelt what they are given (stone)', machines.every(e => e.name === 'electric-furnace' ? !e.recipe : p.recipes[e.recipe] && MAKER[e.recipe] === e.name));
  check('No machine has a circuit connection or a recipe set by circuit', machines.every(e => !e.control_behavior) && (bp.wires || []).every(([a, , c]) => !MACHINES.includes(ids.get(a).name) && !MACHINES.includes(ids.get(c).name)));
  const built = {}; for (const e of machines) built[e.recipe || 'stone-brick'] = (built[e.recipe || 'stone-brick'] || 0) + 1;
  check('Every recipe has at least the whole machines its arithmetic needs at the target', Object.entries(m.bill.machines).every(([r, v]) => (built[r] || 0) >= v.whole), Object.fromEntries(Object.entries(m.bill.machines).filter(([r, v]) => (built[r] || 0) < v.whole).map(([r, v]) => [r, [built[r] || 0, v.whole]])));
  check('Machine counts match the manifest', JSON.stringify(Object.entries(built).sort()) === JSON.stringify(Object.entries(m.machinesBuilt).sort()));
  // ---- arms
  const arms = es.filter(e => HANDS[e.name]);
  check('Every arm has its hand size pinned (fast 1, bulk 2, long-handed 1)', arms.every(e => e.override_stack_size === HANDS[e.name]));
  const armFaults = [];
  for (const e of arms) {
    const [x, y] = [Math.floor(e.position.x), Math.floor(e.position.y)], d = e.direction || 0, r = REACH[e.name];
    const from = g.get(k(x + VEC[d][0] * r, y + VEC[d][1] * r)), to = g.get(k(x - VEC[d][0] * r, y - VEC[d][1] * r));
    const holds = o => o && (MACHINES.includes(o.name) || /belt$/.test(o.name) || o.name === 'passive-provider-chest');
    if (!holds(from) || !holds(to) || (!MACHINES.includes(from.name) && !MACHINES.includes(to.name) && to.name !== 'passive-provider-chest')) armFaults.push(e.entity_number);
  }
  check('Every arm takes from a machine or a belt and gives to a machine, a belt or a chest', armFaults.length === 0, armFaults.slice(0, 20));
  // ---- fluids
  const fluid = analyzeFluids(es, slots, m.ports);
  check('Fluid rules: every pipe network carries exactly one fluid, every pipe-to-ground has its partner, every machine port its recipe uses meets a pipe, and no port meets a pipe of another fluid', fluid.problems.length === 0, fluid.problems.slice(0, 12));
  check('Fluid ports are plain pipes on networks of their own fluid', m.ports.filter(v => v.kind === 'pipe').every(v => ids.get(v.entity)?.name === 'pipe' && fluid.fluidOf[v.entity] === v.item));
  // ---- power
  const subs = es.filter(e => e.name === 'substation'), reach = p.entities.substation.supply_area_distance, wire = p.entities.substation.maximum_wire_distance;
  const electric = es.filter(e => p.entities[e.name]?.energy_source?.type === 'electric' || /combinator$/.test(e.name));
  const covered = e => tilesOf(e).some(([x, y]) => subs.some(s => x + 0.5 > s.position.x - reach && x + 0.5 < s.position.x + reach && y + 0.5 > s.position.y - reach && y + 0.5 < s.position.y + reach));
  check('Every machine, arm and combinator is inside a substation supply area', electric.every(covered), electric.filter(e => !covered(e)).map(e => e.entity_number).slice(0, 20));
  const copper = (bp.wires || []).filter(([, a, , c]) => a === 5 && c === 5), linked = new Set([subs[0]?.entity_number]);
  for (let pass = 0; pass < subs.length; pass++) for (const [a, , c] of copper) if (linked.has(a) || linked.has(c)) { linked.add(a); linked.add(c); }
  const dist = (a, c) => Math.hypot(a.position.x - c.position.x, a.position.y - c.position.y);
  check('Substations only, wired into one copper network within wire reach', es.every(e => !/pole/.test(e.name)) && linked.size === subs.length && copper.every(([a, , c]) => dist(ids.get(a), ids.get(c)) <= wire));
  check('One power entry: the marked substation, labelled, on the manifest list', ids.get(m.power.entry)?.name === 'substation' && ids.get(m.power.panel)?.text === m.power.label && JSON.stringify(subs.map(e => e.entity_number)) === JSON.stringify(m.power.substations));
  // ---- ports, panels, chests, governors
  const edge = v => (v.side === 'west' ? v.tile.x === 0 : v.side === 'east' ? v.tile.x === m.footprint.width - 1 : v.side === 'north' ? v.tile.y === 0 : v.tile.y === m.footprint.height - 1);
  const facing = { west: E, east: W, north: S, south: N };
  check('Every port entity stands on the footprint edge it names; entrance belts run inward, the stone exit outward', m.ports.every(v => { const e = ids.get(v.entity); return e && edge(v) && Math.floor(e.position.x) === v.tile.x && Math.floor(e.position.y) === v.tile.y && (v.kind === 'pipe' ? e.name === 'pipe' : /transport-belt$/.test(e.name) && (e.direction || 0) === (v.exit ? opposite(facing[v.side]) : facing[v.side])); }));
  check('Every port has a visible panel beside it with its item icon and per-minute figure', m.ports.every(v => { const pn = ids.get(v.panel); return pn?.name === 'display-panel' && pn.always_show === true && pn.icon?.name === v.item && pn.text === v.label && pn.text.includes(` ${v.perMinute}/min`) && dist(pn, ids.get(v.entity)) <= 2; }));
  check('The panel figures are the recipe totals at the target, rounded up', m.ports.every(v => v.exit ? v.perMinute === Math.round(m.bill.stone.surplus) : v.perMinute >= m.bill.outside[v.item] && v.perMinute <= m.bill.outside[v.item] * 1.01 + 1));
  const g0 = m.governor;
  check('Each pack has its own passive provider chest limited to five stacks (1,000 packs), filled by one filtered fast arm run by its own governor', m.outputs.length === 2 && m.outputs.every(o => { const c = ids.get(o.chest), a = ids.get(o.arm); return c?.name === 'passive-provider-chest' && c.bar === 5 && o.capacity === 1000 && a?.name === 'fast-inserter' && a.filters?.[0]?.name === o.item && a.control_behavior?.circuit_condition?.constant === g0.bias + g0.startDelay + g0.period && a.control_behavior.circuit_read_hand_contents === true && ids.get(o.governor.subtractor)?.control_behavior.arithmetic_conditions.second_constant === -g0.period && g0.period === 3600 / m.targets[o.item]; }));
  check('Circuit wires join only the governors: combinators and the two chest arms', (bp.wires || []).filter(([, a]) => a !== 5).every(([a, , c]) => [a, c].every(n => /combinator$/.test(ids.get(n).name) || m.outputs.some(o => o.arm === n))));
  check('Blueprint label, description and four icons are set', !!bp.label && !!bp.description && bp.icons.length === 4);
  return { passed: errors.length === 0, checksTotal: checks.length, checks, errors, fluidNetworks: fluid.networks };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2] && !process.argv[2].startsWith('--') ? path.resolve(process.argv[2]) : PUBLISHED;
  const [p, slots, m] = await Promise.all([prototypes(), fluidSlots(), readJson(path.join(dir, 'manifest.json'))]);
  const audit = auditBlueprint(decode(await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')), m, p, slots);
  if (process.argv.includes('--write')) await fs.writeFile(path.join(dir, 'static-audit.json'), json(audit));
  console.log(JSON.stringify({ passed: audit.passed, checks: audit.checksTotal, errors: audit.errors, detail: audit.checks.filter(c => !c.passed) }, null, 1));
  if (!audit.passed) process.exitCode = 1;
}
