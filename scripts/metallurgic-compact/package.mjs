// Turns the design into the published artefacts (blueprint string, manifest, footprint) and holds the static audit.
// A pure function of the pinned prototypes and the fluid-slot table; the audit recomputes everything from the decoded string.
import assert from 'node:assert/strict';
import { sha, encodeKeeping, decode, envelope, technologyClosure, blueprintVersion, analyzeFluids, machineBoxes, unusedPorts, insertTiles, tileMap, tilesOf, powerCoverage, HAND } from '../vulcanus-circuits/lib.mjs';
import { PRODUCT, TARGET_PER_MINUTE } from './design.mjs';

const ALLOWED = ['foundry', 'fast-inserter', 'pipe', 'substation', 'display-panel', 'requester-chest', 'passive-provider-chest'];

export function assemble(d, p, slots, options = {}) {
  const L = d.layout, entities = L.entities;
  const blueprint = { blueprint: { item: 'blueprint', label: d.label, description: d.description, version: blueprintVersion(p.gameVersion), icons: d.icons.map((name, i) => ({ index: i + 1, signal: { type: 'item', name } })), entities: entities.map(e => ({ ...e })) } };
  const code = encodeKeeping(blueprint, options.committedCode), hash = sha(code);
  const env = envelope(blueprint.blueprint.entities, p);
  const counts = Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length]));
  const footprint = { ...env, includes: 'all entities: the foundry, arms, chests, pipe, substation and panels; the robot network, the molten copper supply and the outside power are not counted', counts, entities: entities.length };
  const fluid = analyzeFluids(entities, slots);
  const tech = technologyClosure(p, [PRODUCT], [...new Set(entities.map(e => e.name))]);
  const at = tileMap(entities);
  const routes = entities.filter(e => e.name === 'fast-inserter').map(e => {
    const { pickup, drop } = insertTiles(e, p), end = t => at.get(t.x + ',' + t.y)?.entity_number;
    return { inserter: e.entity_number, hand: e.override_stack_size, from: end(pickup), to: end(drop), label: L.routes.find(r => r.inserter === e.entity_number).label };
  });
  const centre = e => ({ x: Math.round(e.position.x - 0.5), y: Math.round(e.position.y - 0.5) });
  const c = centre(d.foundry);
  const tile = e => ({ x: e.tile.x, y: e.tile.y });
  const port = (x, side, extra) => ({ id: x.id, item: x.item, kind: x.kind, side, entity: x.entity.entity_number, tile: tile(x.entity), panel: x.panel.entity_number, label: x.panel.text, perMinute: x.perMinute, ...extra });
  const inputPorts = d.inputs.map(x => port(x, x.side, x.request !== undefined ? { request: x.request, stackSize: d.sizing.stackSize[x.item] } : { externalContact: { x: x.entity.tile.x, y: x.entity.tile.y + 1 } }));
  const outputPorts = d.outputs.map(x => port(x, x.side, { capStacks: x.capStacks, cap: x.cap }));
  const manifest = {
    schema: 1, family: 'metallurgic-compact', id: d.id, revision: 1, candidateSha256: hash, requiredGameVersion: p.gameVersion, surface: 'vulcanus (pressure 4000 required by the recipe)',
    prototypeSha256: options.prototypeSha256, fluidSlotsSha256: options.fluidSlotsSha256,
    intendedUse: 'metallurgic science packs from tungsten carbide, tungsten plate and molten copper, in one foundry, for the cases where the supply comes from a robot network and a pipe',
    products: [PRODUCT], product: PRODUCT, target: TARGET_PER_MINUTE,
    equipment: { machines: ['foundry'], inserters: { 'fast-inserter': HAND['fast-inserter'] }, chests: ['requester-chest', 'passive-provider-chest'], power: 'substation', modules: 0, beacons: 0, quality: 'normal', circuitNetwork: false, robotsInside: false },
    footprint, inputPorts, outputPorts,
    power: { entry: d.power.entry.entity_number, panel: d.power.panel.entity_number, label: d.power.label, externalPole: d.power.externalPole, poles: [d.power.entry.entity_number] },
    machines: [{ entity: d.foundry.entity_number, name: 'foundry', recipe: PRODUCT, role: PRODUCT, tile: tile(d.foundry), direction: d.foundry.direction || 0 }],
    routes,
    machineBoxes: { [d.foundry.entity_number]: machineBoxes(d.foundry, slots).map(bb => ({ fluid: bb.fluid, flow: bb.flow, targets: bb.ends.map(en => [en.target.x - c.x, en.target.y - c.y]) })) },
    unusedPorts: { [d.foundry.entity_number]: unusedPorts(d.foundry, slots).map(q => [q.target.x - c.x, q.target.y - c.y]) },
    fluidComponents: fluid.components.map(k => ({ id: k.id, fluid: k.fluids[0], entities: k.entities })),
    technologyClosure: tech.closure, requirements: tech.requirements.filter(r => !r.enabledByDefault).map(r => ({ recipe: r.recipe, technology: r.selected })),
    sizing: d.sizing,
    status: { static: 'static-audit.json', native: 'native-report.json, only when a run passed for candidateSha256' },
  };
  return { blueprint, code, hash, manifest, footprint, fluid, tech, layout: L, d };
}

// Static audit: everything is recomputed from the decoded string and compared with the manifest and the pinned recipe.
export function audit(code, manifest, p, slots) {
  const checks = [], errors = [];
  const check = (name, ok, detail) => { checks.push({ name, passed: !!ok, ...(detail !== undefined ? { detail } : {}) }); if (!ok) errors.push(name); };
  const bp = decode(code).blueprint, E = bp.entities;
  check('string matches the manifest hash', sha(code.trim()) === manifest.candidateSha256);
  check('only whitelisted entities (no assembling machine, module, beacon, belt, robot, circuit wire)', E.every(e => ALLOWED.includes(e.name)) && !(bp.wires?.length), [...new Set(E.map(e => e.name))]);
  check('no entity carries modules, quality or items', E.every(e => !e.items && !e.quality));
  const byName = n => E.filter(e => e.name === n);
  // recipe
  const r = p.recipes[PRODUCT], foundry = byName('foundry');
  check('recipe is metallurgy, 3 carbide + 2 plate + 200 molten copper -> 1 pack in 10 s, Vulcanus pressure 4000 only',
    r.categories.length === 1 && r.categories[0] === 'metallurgy' && r.energy_required === 10 && r.results.length === 1 && r.results[0].name === PRODUCT && r.results[0].amount === 1
    && JSON.stringify(r.ingredients.map(i => [i.type, i.name, i.amount]).sort()) === JSON.stringify([['fluid', 'molten-copper', 200], ['item', 'tungsten-carbide', 3], ['item', 'tungsten-plate', 2]])
    && r.surface_conditions?.length === 1 && r.surface_conditions[0].min === 4000 && r.surface_conditions[0].max === 4000);
  check('one foundry with the recipe saved, facing north', foundry.length === 1 && foundry[0].recipe === PRODUCT && (foundry[0].direction || 0) === 0 && !foundry[0].mirror);
  check('the foundry crafts the recipe category', p.entities.foundry.crafting_categories.includes('metallurgy'));
  // rate
  const z = manifest.sizing, craftsMax = 60 / r.energy_required * p.entities.foundry.crafting_speed, packsMax = craftsMax * 1.5;
  check('the foundry can make the target (24 crafts a minute x 1.5 = 36 packs)', packsMax >= manifest.target && manifest.target >= 15, { packsMax, target: manifest.target });
  check('per-minute figures follow the recipe at the target', Math.abs(z.perMinute['tungsten-carbide'] - 3 * manifest.target / 1.5) < 1e-9 && Math.abs(z.perMinute['tungsten-plate'] - 2 * manifest.target / 1.5) < 1e-9 && Math.abs(z.perMinute['molten-copper'] - 200 * manifest.target / 1.5) < 1e-9, z.perMinute);
  // chests
  const req = byName('requester-chest'), prov = byName('passive-provider-chest');
  check('two requester chests, each one filter at normal quality with the pinned count, nothing else', req.length === 2 && req.every(c => c.request_filters.sections.length === 1 && c.request_filters.sections[0].filters.length === 1 && c.request_filters.sections[0].filters[0].quality === 'normal' && c.request_filters.sections[0].filters[0].comparator === '=' && c.request_filters.sections[0].filters[0].count === z.request[c.request_filters.sections[0].filters[0].name]) && new Set(req.map(c => c.request_filters.sections[0].filters[0].name)).size === 2 && req.every(c => ['tungsten-carbide', 'tungsten-plate'].includes(c.request_filters.sections[0].filters[0].name)),
    req.map(c => c.request_filters.sections[0].filters[0]));
  check('requests are two minutes of use, rounded up (carbide 64, plate 43)', z.request['tungsten-carbide'] === 64 && z.request['tungsten-plate'] === 43);
  check('one passive provider chest capped at one slot (one stack)', prov.length === 1 && prov[0].bar === 1 && p.entities['passive-provider-chest'].logistic_mode === 'passive-provider' && p.entities['requester-chest'].logistic_mode === 'requester');
  // arms
  const at = tileMap(E), name = (e, t) => at.get(t.x + ',' + t.y);
  const arms = byName('fast-inserter').map(e => { const t = insertTiles(e, p); return { e, from: name(e, t.pickup), to: name(e, t.drop) }; });
  const armOf = (from, to) => arms.filter(a => a.from?.name === from.name && a.from?.entity_number === from.entity_number && a.to?.entity_number === to.entity_number);
  const fo = foundry[0];
  const carb = req.find(c => c.request_filters.sections[0].filters[0].name === 'tungsten-carbide'), plate = req.find(c => c.request_filters.sections[0].filters[0].name === 'tungsten-plate');
  check('three fast inserters: carbide chest -> foundry, plate chest -> foundry, foundry -> provider chest, one each', arms.length === 3 && armOf(carb, fo).length === 1 && armOf(plate, fo).length === 1 && armOf(fo, prov[0]).length === 1);
  check('every inserter hand size is pinned to 1 and none has a filter or circuit condition', byName('fast-inserter').every(e => e.override_stack_size === 1 && !e.use_filters && !e.control_behavior));
  // fluids
  const fl = analyzeFluids(E, slots);
  check('fluid rules: one network of molten copper, one pipe, no mixed or unconnected network', fl.problems.length === 0 && fl.components.length === 1 && fl.components[0].fluids.length === 1 && fl.components[0].fluids[0] === 'molten-copper' && byName('pipe').length === 1, fl.components);
  check('no used port left without a pipe; ports the recipe does not use face nothing', fl.stray.length === 0, fl.stray);
  const boxes = machineBoxes(fo, slots);
  check('the foundry has one molten-copper input box; both output ports and the second input port stand free', boxes.length === 1 && boxes[0].fluid === 'molten-copper' && boxes[0].flow === 'input' && unusedPorts(fo, slots).every(q => !at.get(q.target.x + ',' + q.target.y)) && boxes[0].ends.filter(en => at.get(en.target.x + ',' + en.target.y)?.name === 'pipe').length === 1);
  // power, panels, collisions
  const pw = powerCoverage(E, p);
  check('one substation covers every electric entity', pw.poles.length === 1 && pw.unpowered.length === 0, pw.unpowered);
  const seen = new Map(); let overlap = null;
  for (const e of E) for (const t of tilesOf(e)) { const k = t.x + ',' + t.y; if (seen.has(k)) overlap = k; seen.set(k, e); }
  check('no two entities share a tile', overlap === null, overlap);
  const panels = byName('display-panel'), ports = [...manifest.inputPorts, ...manifest.outputPorts];
  check('five labelled panels, always shown: three entrances, the exit, the power entry', panels.length === 5 && panels.every(e => e.always_show && e.text && e.icon));
  const numbered = E.map((e, i) => ({ e, n: i + 1 }));
  const text = n => E[n - 1].text;
  check('every port and the power entry has its panel with the per-minute figure or the label', ports.every(x => text(x.panel) === x.label && (/\/min/.test(x.label))) && text(manifest.power.panel) === manifest.power.label && /POWER/.test(manifest.power.label));
  check('IN-1 and IN-2 are requester chests and say their request; IN-3 is a pipe entrance; OUT-1 is the provider chest', manifest.inputPorts[0].kind === 'requester-chest' && manifest.inputPorts[1].kind === 'requester-chest' && manifest.inputPorts[2].kind === 'pipe' && manifest.outputPorts[0].kind === 'passive-provider-chest' && /request 64/.test(manifest.inputPorts[0].label) && /request 43/.test(manifest.inputPorts[1].label));
  check('footprint matches the entities (9 x 6, 14 entities)', manifest.footprint.width === 9 && manifest.footprint.height === 6 && manifest.footprint.area === 54 && manifest.footprint.entities === E.length && E.length === 14, manifest.footprint);
  check('the pipe entrance faces the outside: its south side is free', !at.get(`${manifest.inputPorts[2].tile.x},${manifest.inputPorts[2].tile.y + 1}`));
  void numbered;
  return { passed: errors.length === 0, errors, checksTotal: checks.length, checks };
}
