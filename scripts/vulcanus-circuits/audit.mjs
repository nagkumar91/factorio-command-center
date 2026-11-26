// Static audit of a Vulcanus circuit blueprint, recomputed from the decoded string: names, collisions, machines and fixed recipes,
// pinned hand sizes, the fluid rules (one fluid per pipe network; every used port on its own fluid; every unused port facing no
// pipe opening; no machine with ports on two fluids), belt lines, every arm's pickup and drop, power, ports, panels and the
// capacity arithmetic.
//   node scripts/vulcanus-circuits/audit.mjs <id> [folder] [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blueprintVersion, published, prototypes, fluidSlots, readJson, json, decode, allWires, VEC, N, E, S, W, opposite, MACHINES, BELTS, UNDERGROUNDS, HAND, isBelt, isArm, analyzeFluids, machineBoxes, unusedPorts, beltGraph, powerCoverage, envelope, distance, box, intersects, tileOf, tileMap, tilesOf } from './lib.mjs';
import { routeOf } from './package.mjs';
import { rates } from './parts.mjs';

export const ALLOWED = ['foundry', 'assembling-machine-3', 'fast-inserter', 'bulk-inserter', 'long-handed-inserter', ...BELTS, ...UNDERGROUNDS, 'pipe', 'pipe-to-ground', 'substation', 'display-panel'];
const INWARD = { west: E, east: W, north: S, south: N }, OUTWARD = { west: W, east: E, north: N, south: S };

// A string that is not the manifest's (a missing machine, an entity the manifest does not know) can leave a later check without
// what it reads; that is a failed audit, not a crash.
export function auditBlueprint(object, m, p, slots) {
  const partial = { checks: [], errors: [] };
  try { return audit(object, m, p, slots, partial); } catch (e) {
    partial.checks.push({ name: 'The audit ran to its end', passed: false, detail: String(e.message).slice(0, 300) }); partial.errors.push('The audit ran to its end');
    return { passed: false, checksTotal: partial.checks.length, checks: partial.checks, errors: partial.errors };
  }
}
function audit(object, m, p, slots, partial) {
  const { checks, errors } = partial;
  const check = (name, ok, detail = null) => { checks.push({ name, passed: !!ok, ...(detail === null ? {} : { detail }) }); if (!ok) errors.push(name); };
  const bp = object.blueprint, es = bp.entities, ids = new Map(es.map(e => [e.entity_number, e])), get = id => ids.get(id);
  check('All entity names exist in the pinned prototypes', es.every(e => p.entities[e.name]));
  if (!es.every(e => p.entities[e.name])) return { passed: false, checks, errors, checksTotal: checks.length };
  check('Unique entity IDs', ids.size === es.length);
  check(`Blueprint version is ${p.gameVersion}`, bp.version === blueprintVersion(p.gameVersion) && m.requiredGameVersion === p.gameVersion);
  check('Only the entities the brief allows: foundry, assembling machine 3, fast, bulk and long-handed inserters, belts and underground belts up to express, pipes, pipes-to-ground, substations, display panels', es.every(e => ALLOWED.includes(e.name)));
  check('No combinator, wire other than the substations\' copper, robot, chest, pump or tank', es.every(e => !/combinator|roboport|chest|pump|tank/.test(e.name)) && allWires(bp).every(w => w[1] === 5 && w[3] === 5) && !es.some(e => e.control_behavior));
  check('Power by substations only, no other pole', es.every(e => !/pole/.test(e.name)) && es.some(e => e.name === 'substation'));
  check('No modules, beacons, nonnormal quality, custom inserter reach, tiles or loose items', es.every(e => !e.items && !e.pickup_position && !e.drop_position && (!e.quality || e.quality === 'normal') && !/beacon/.test(e.name)) && !bp.tiles);
  check('Every arm has its hand size pinned (fast 1, bulk 2, long-handed 1): research cannot change what it carries', es.filter(isArm).every(e => e.override_stack_size === HAND[e.name]));
  check('Every arm filter names one item at normal quality', es.filter(isArm).every(e => !e.use_filters || (e.filter_mode === 'whitelist' && e.filters.length === 1 && e.filters[0].quality === 'normal')));
  const hit = [];
  { const boxes = es.map(e => box(e, p)); for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) if (intersects(boxes[i], boxes[j])) hit.push([es[i].entity_number, es[j].entity_number]); }
  check('Native collision boxes do not overlap', hit.length === 0, hit);
  const env = envelope(es, p);
  check('Published footprint is the selection-box envelope of all entities', env.width === m.footprint.width && env.height === m.footprint.height && env.area === m.footprint.area && env.bounds.left === 0 && env.bounds.top === 0, env);
  const counts = Object.fromEntries([...new Set(es.map(e => e.name))].sort().map(n => [n, es.filter(e => e.name === n).length]));
  check('Footprint entity counts match', JSON.stringify(counts) === JSON.stringify(m.footprint.counts) && es.length === m.footprint.entities);

  // ---- machines -----------------------------------------------------------------------------------------------------
  const machines = es.filter(e => MACHINES.includes(e.name));
  check('Machines are exactly the manifest list (entity, name, recipe, direction)', JSON.stringify(machines.map(e => [e.entity_number, e.name, e.recipe, e.direction || 0])) === JSON.stringify(m.machines.map(x => [x.entity, x.name, x.recipe, x.direction])));
  check('Every machine has a fixed recipe saved in the blueprint, one its crafting categories can make, at normal quality', machines.every(e => p.recipes[e.recipe] && p.recipes[e.recipe].categories.some(c => p.entities[e.name].crafting_categories.includes(c)) && (!e.recipe_quality || e.recipe_quality === 'normal')));
  check('No machine is mirrored or set by circuit', machines.every(e => !e.mirror && !e.control_behavior));
  const r = rates(p), z = m.sizing;
  const have = {}; for (const e of machines) have[e.recipe] = (have[e.recipe] || 0) + 1;
  const need = r.demand({ ec: z.target['electronic-circuit'] || 0, ac: z.target['advanced-circuit'] || 0, pu: z.target['processing-unit'] || 0 });
  const required = { 'molten-copper-from-lava': need.copperLavaCrafts, 'molten-iron-from-lava': need.ironLavaCrafts, 'casting-iron': need.plateCrafts, 'casting-copper-cable': need.cableCrafts, 'electronic-circuit': need.ec, 'advanced-circuit': need.ac, 'processing-unit': need.pu };
  const capacity = Object.fromEntries(Object.keys(have).map(n => [n, have[n] * (machines.find(e => e.recipe === n).name === 'foundry' ? r.foundryCrafts(n) : r.am3Crafts(n))]));
  check('Whole-machine counts: every recipe has the crafting capacity the target needs, recomputed from the pinned recipes, speeds and the foundry\'s built-in productivity', Object.entries(required).every(([n, c]) => c === 0 ? !have[n] : (capacity[n] || 0) >= c - 1e-9), { capacity, required });
  check('The sizing table in the manifest is this arithmetic', z.machines.every(row => have[row.recipe] === row.count && Math.abs(row.craftsNeeded - required[row.recipe]) < 1e-9 && Math.abs(row.craftsEach * row.count - capacity[row.recipe]) < 1e-9) && z.machines.length === Object.keys(have).length);
  check('Exactly the declared recipes are made, nothing else', JSON.stringify(Object.keys(have).sort()) === JSON.stringify(z.machines.map(row => row.recipe).sort()));

  // ---- fluids -------------------------------------------------------------------------------------------------------
  const fluid = analyzeFluids(es, slots);
  check('Fluid model: no unpaired or blocked underground pipe, no mixed network, no pipe run without a machine port, no machine port against another machine', fluid.problems.length === 0, fluid.problems);
  check('One fluid per pipe network: the networks recomputed from the string are the manifest\'s', JSON.stringify(fluid.components.map(c => ({ id: c.id, fluid: c.fluids[0], entities: c.entities, boxes: c.boxes }))) === JSON.stringify(m.fluidComponents));
  check('Every port a recipe does not use faces no pipe opening and no other machine\'s used port', fluid.stray.length === 0, fluid.stray);
  const compOf = new Map(); for (const c of fluid.components) for (const id of c.entities) compOf.set(id, c);
  // every used box: at least one of its tiles on a pipe; every tile that holds a pipe-like entity facing it is on a network of exactly its fluid
  const at = tileMap(es), badPorts = [];
  for (const e of machines) for (const b of machineBoxes(e, slots)) {
    let joined = 0;
    for (const en of b.ends) {
      const o = at.get(en.target.x + ',' + en.target.y);
      if (!o) continue;
      const facing = o.name === 'pipe' || (o.name === 'pipe-to-ground' && (o.direction || 0) === opposite(en.side));
      if (!facing) { if (o.name === 'pipe-to-ground' || MACHINES.includes(o.name)) continue; continue; }
      joined++;
      const c = compOf.get(o.entity_number);
      if (!c || c.fluids.length !== 1 || c.fluids[0] !== b.fluid) badPorts.push({ machine: e.entity_number, fluid: b.fluid, pipe: o.entity_number, network: c?.fluids });
    }
    if (!joined) badPorts.push({ machine: e.entity_number, fluid: b.fluid, joined: 0 });
  }
  check('Every used port meets exactly its own fluid, and every fluid box of every machine is on a pipe', badPorts.length === 0, badPorts);
  // no machine has two ports of one kind on the pipes of two different fluids (with one fluid per box and one fluid per network this is the same statement per box)
  const twoFluids = [];
  for (const e of machines) for (const kind of ['input', 'output']) {
    const fluids = new Set();
    for (const b of machineBoxes(e, slots).filter(b => b.flow === kind)) for (const en of b.ends) { const o = at.get(en.target.x + ',' + en.target.y); if (o && compOf.get(o.entity_number)) for (const f of compOf.get(o.entity_number).fluids) fluids.add(f); }
    for (const q of unusedPorts(e, slots)) { const o = at.get(q.target.x + ',' + q.target.y); if (o && (o.name === 'pipe' || (o.name === 'pipe-to-ground' && (o.direction || 0) === opposite(q.side))) && compOf.get(o.entity_number)) for (const f of compOf.get(o.entity_number).fluids) fluids.add(f); }
    if (fluids.size > 1) twoFluids.push({ machine: e.entity_number, kind, fluids: [...fluids] });
  }
  check('No machine has ports on the pipes of two different fluids, and no pump or tank is needed to keep them apart', twoFluids.length === 0, twoFluids);
  const fluidPorts = [...m.inputPorts, ...m.outputPorts].filter(x => x.kind === 'pipe');
  const unsourced = [];
  for (const c of fluid.components) {
    const entrance = m.inputPorts.some(x => x.kind === 'pipe' && compOf.get(x.entity) === c);
    const makes = c.boxes.some(b => b.flow === 'output'), takes = c.boxes.some(b => b.flow === 'input');
    if (!takes || !(makes || entrance) || (makes && entrance)) unsourced.push({ network: c.id, fluid: c.fluids, makes, takes, entrance });
  }
  check('Every network has exactly one kind of source (an outside entrance or machine outputs) and at least one consumer', unsourced.length === 0, unsourced);
  check('Every fluid entrance is a plain pipe on a network of exactly its own fluid, one network per entrance', fluidPorts.every(x => get(x.entity).name === 'pipe' && compOf.get(x.entity)?.fluids.length === 1 && compOf.get(x.entity).fluids[0] === x.item) && new Set(fluidPorts.map(x => compOf.get(x.entity)?.id)).size === fluidPorts.length);
  check('The manifest lists every pipe with its fluid, every machine box and every unused port as the string has them', JSON.stringify(Object.fromEntries(es.filter(e => e.name === 'pipe' || e.name === 'pipe-to-ground').map(e => [e.entity_number, fluid.fluidOf.get(e.entity_number)]))) === JSON.stringify(m.fluidOf) && machines.every(e => { const c = { x: Math.round(e.position.x - 0.5), y: Math.round(e.position.y - 0.5) }; return JSON.stringify(machineBoxes(e, slots).map(b => ({ fluid: b.fluid, flow: b.flow, targets: b.ends.map(en => [en.target.x - c.x, en.target.y - c.y]) }))) === JSON.stringify(m.machineBoxes[e.entity_number]) && JSON.stringify(unusedPorts(e, slots).map(q => [q.target.x - c.x, q.target.y - c.y])) === JSON.stringify(m.unusedPorts[e.entity_number]); }));

  // ---- belts and arms -----------------------------------------------------------------------------------------------
  const graph = beltGraph(es, p);
  check('Belts: every underground belt has its partner of the same tier within reach, nothing runs into the back of an exit or side-loads an underground', graph.problems.length === 0, graph.problems);
  check('Belt lines recomputed from the string are the manifest\'s lines, each carrying only its declared items', JSON.stringify(graph.lines) === JSON.stringify(m.beltLines.map(l => l.entities)) && m.beltLines.every(l => l.items?.length >= 1));
  const lineOfBelt = new Map(); for (const l of m.beltLines) for (const id of l.entities) lineOfBelt.set(id, l.name);
  const arms = es.filter(isArm);
  const routes = arms.map(e => routeOf(e, es, p, lineOfBelt));
  check('Every arm takes from and drops on exactly what the manifest says (a machine or a named belt line)', JSON.stringify(routes) === JSON.stringify(m.routes.map(({ label, ...rest }) => rest)), routes.filter((x, i) => JSON.stringify(x) !== JSON.stringify((({ label, ...rest }) => rest)(m.routes[i] || {}))).slice(0, 5));
  const lineItems = Object.fromEntries(m.beltLines.map(l => [l.name, l.items]));
  const recipeOf = id => p.recipes[get(id).recipe];
  const armProblems = [];
  for (const x of routes) {
    if (x.from.nothing || x.to.nothing) { armProblems.push({ arm: x.inserter, reason: 'reaches nothing' }); continue; }
    // what can come off the source, and what the destination takes
    const offered = x.from.line ? lineItems[x.from.line] : recipeOf(x.from.entity).results.filter(v => v.type === 'item').map(v => v.name);
    const carried = x.filter ? offered.filter(n => n === x.filter) : offered;
    const wanted = x.to.line ? lineItems[x.to.line] : recipeOf(x.to.entity).ingredients.filter(v => v.type === 'item').map(v => v.name);
    if (!carried.length) armProblems.push({ arm: x.inserter, reason: 'nothing to carry', offered, filter: x.filter });
    // onto a belt everything carried must belong to that line; into a machine at least one carried item must be an ingredient
    else if (x.to.line ? !carried.every(n => wanted.includes(n)) : !carried.some(n => wanted.includes(n))) armProblems.push({ arm: x.inserter, reason: 'carries what its destination does not take', carried, wanted });
  }
  check('Every arm carries only items its destination takes: nothing foreign can be put on a belt line', armProblems.length === 0, armProblems);
  const fed = {}, emptied = {};
  for (const x of routes) { if (x.to.entity) for (const item of (x.from.line ? lineItems[x.from.line] : recipeOf(x.from.entity).results.map(v => v.name))) (fed[x.to.entity] ||= new Set()).add(item); if (x.from.entity) emptied[x.from.entity] = true; }
  const starving = machines.filter(e => p.recipes[e.recipe].ingredients.filter(v => v.type === 'item').some(v => !fed[e.entity_number]?.has(v.name))).map(e => e.entity_number);
  check('Every machine gets every solid ingredient from an arm and has an arm taking its solid products away', starving.length === 0 && machines.filter(e => p.recipes[e.recipe].results.some(v => v.type === 'item')).every(e => emptied[e.entity_number]), starving);

  // ---- power --------------------------------------------------------------------------------------------------------
  const cover = powerCoverage(es, p);
  check('Every machine and arm is inside a substation supply area', cover.unpowered.length === 0, cover.unpowered);
  const wireMax = p.entities.substation.maximum_wire_distance, subs = es.filter(e => e.name === 'substation');
  const wires = allWires(bp), linked = new Set([subs[0].entity_number]);
  for (let pass = 0; pass < subs.length; pass++) for (const [a, ca, b, cb] of wires) if (ca === 5 && cb === 5 && (linked.has(a) || linked.has(b))) { linked.add(a); linked.add(b); }
  check('Substations are wired into one copper network within wire reach', linked.size === subs.length && wires.every(([a, , b]) => distance(get(a), get(b)) <= wireMax));
  const entry = get(m.power.entry), ext = m.power.externalPole;
  check('One power connection: the entry substation, labelled by its display panel, with room for an outside substation within wire reach', entry?.name === 'substation' && get(m.power.panel)?.text === m.power.label && distance(get(m.power.panel), entry) <= 3.2 && distance(entry, { position: ext }) <= wireMax && !es.some(e => intersects(box(e, p), { left: ext.x - 1, right: ext.x + 1, top: ext.y - 1, bottom: ext.y + 1 })));
  check('Substation count is the manifest list', JSON.stringify(subs.map(e => e.entity_number)) === JSON.stringify(m.power.poles));

  // ---- entrances, exits, panels --------------------------------------------------------------------------------------
  const bounds = env.bounds, ports = [...m.inputPorts, ...m.outputPorts];
  const onEdge = x => { const t = x.tile; return x.side === 'west' ? t.x === bounds.left : x.side === 'east' ? t.x === bounds.right - 1 : x.side === 'north' ? t.y === bounds.top : t.y === bounds.bottom - 1; };
  check('Every entrance and exit entity stands on the footprint edge it names, at the tile the manifest gives', ports.every(x => onEdge(x) && get(x.entity) && tileOf(get(x.entity)).x === x.tile.x && tileOf(get(x.entity)).y === x.tile.y));
  check('Entrance belts run inward and are not entered from behind; exit belts run outward to the open edge', m.inputPorts.filter(x => x.kind === 'belt').every(x => { const b = get(x.entity); return BELTS.includes(b.name) && (b.direction || 0) === INWARD[x.side] && ![...graph.next.values()].includes(b); }) && m.outputPorts.every(x => { const b = get(x.entity); return BELTS.includes(b.name) && (b.direction || 0) === OUTWARD[x.side] && !graph.next.has(b.entity_number); }));
  check('Every port belt is on the line of its own item, and exits are on lines that carry nothing else', ports.filter(x => x.kind === 'belt').every(x => { const items = lineItems[lineOfBelt.get(x.entity)]; return items && (m.outputPorts.includes(x) ? items.length === 1 && items[0] === x.item : items.includes(x.item)); }));
  check('One product exit and one stone exit, each on its own belt line', m.outputPorts.filter(x => x.product).length === 1 && m.outputPorts.filter(x => x.byproduct && x.item === 'stone').length === 1 && new Set(m.outputPorts.map(x => lineOfBelt.get(x.entity))).size === m.outputPorts.length && m.outputPorts.find(x => x.product).item === m.product);
  const panelOk = x => { const pn = get(x.panel); return pn?.name === 'display-panel' && pn.always_show === true && pn.icon?.name === x.item && pn.icon.type === (x.kind === 'pipe' ? 'fluid' : 'item') && pn.text === `${m.inputPorts.includes(x) ? 'IN' : 'OUT'}: ${x.item} ${x.perMinute}/min` && pn.text === x.label && distance(pn, get(x.entity)) <= 2.3; };
  check('Every entrance and exit has a display panel beside it with its icon, "IN:" or "OUT:", the item and the per-minute figure', ports.every(panelOk));
  check('Panel figures are the arithmetic of the target: lava, calcite, plastic and acid rounded up, stone and the product as computed', m.inputPorts.every(x => x.perMinute >= ({ lava: need.lava, calcite: need.calcite, 'plastic-bar': need.plastic, 'sulfuric-acid': need.acid })[x.item] && x.perMinute <= 1.03 * ({ lava: need.lava, calcite: need.calcite, 'plastic-bar': need.plastic, 'sulfuric-acid': need.acid })[x.item] + 1) && m.outputPorts.find(x => x.byproduct).perMinute === Math.round(need.stone) && m.outputPorts.find(x => x.product).perMinute === m.target);
  check('The approach beyond every entrance and exit is clear of blueprint entities', ports.every(x => [x.externalContact, ...x.approach].every(t => !at.has(t.x + ',' + t.y))));
  check('Blueprint label, description and icons are set', !!bp.label && !!bp.description && bp.icons.length >= 3);
  return { passed: errors.length === 0, checksTotal: checks.length, checks, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const id = process.argv[2], dir = process.argv[3] && !process.argv[3].startsWith('--') ? path.resolve(process.argv[3]) : published(id);
  const [p, slots, m] = await Promise.all([prototypes(), fluidSlots(), readJson(path.join(dir, 'manifest.json'))]);
  const audit = auditBlueprint(decode(await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')), m, p, slots);
  if (process.argv.includes('--write')) await fs.writeFile(path.join(dir, 'static-audit.json'), json(audit));
  console.log(JSON.stringify({ passed: audit.passed, checks: audit.checksTotal, errors: audit.errors, detail: audit.checks.filter(c => !c.passed) }, null, 2));
  if (!audit.passed) process.exitCode = 1;
}
