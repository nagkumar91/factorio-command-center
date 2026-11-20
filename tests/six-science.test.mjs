import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root = new URL('../', import.meta.url);
const read = p => fs.readFile(new URL(p, root));
const hash = v => createHash('sha256').update(v).digest('hex');
const dir = 'blueprint-sources/six-science/';
const records = JSON.parse(await read(dir + 'manifest.json'));
const m = records[0];
const code = (await read(dir + m.file)).toString().trim();
const bp = decodeBlueprint(code).blueprint, entities = bp.entities;
const byId = new Map(entities.map(e => [e.entity_number, e]));
const report = JSON.parse(await read(dir + 'native-report.json'));
const evidence = report.builds?.find(b => b.id === m.id);
const officialSha = 'ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const products = ['automation-science-pack', 'logistic-science-pack', 'military-science-pack', 'chemical-science-pack', 'production-science-pack', 'utility-science-pack'];
const demand = {'copper-plate': 1035, 'electronic-circuit': 900, 'iron-plate': 585, 'plastic-bar': 520, 'steel-plate': 367.5, 'stone-brick': 250, coal: 150, stone: 150, sulfur: 15, 'sulfuric-acid': 500, lubricant: 150};
const solids = ['copper-plate', 'electronic-circuit', 'iron-plate', 'plastic-bar', 'steel-plate', 'stone-brick', 'coal', 'stone', 'sulfur'];
const fluids = ['sulfuric-acid', 'lubricant'];
const minimum = {'automation-science-pack': 4, 'logistic-science-pack': 4, inserter: 1, 'transport-belt': 1, 'military-science-pack': 4, 'piercing-rounds-magazine': 1, 'firearm-magazine': 1,
  grenade: 3, 'stone-wall': 1, 'chemical-science-pack': 8, 'engine-unit': 10, pipe: 1, 'iron-gear-wheel': 2, 'advanced-circuit': 26, 'copper-cable': 5, 'production-science-pack': 5,
  'electric-furnace': 2, 'productivity-module': 4, rail: 2, 'iron-stick': 1, 'utility-science-pack': 5, 'low-density-structure': 10, 'processing-unit': 5, 'flying-robot-frame': 5,
  'electric-engine-unit': 3, battery: 2};
const allowed = new Set(['assembling-machine-2', 'chemical-plant', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'fast-inserter', 'long-handed-inserter', 'bulk-inserter',
  'pipe', 'pipe-to-ground', 'passive-provider-chest', 'substation', 'medium-electric-pole', 'constant-combinator', 'arithmetic-combinator', 'decider-combinator', 'display-panel']);
const sorted = v => [...v].sort();

test('one manifest record whose string, report, prototypes, harness and validator agree', async () => {
  assert.equal(records.length, 1);
  assert.equal(m.id, 'six-science');
  assert.equal(m.file, 'six-science.txt');
  assert.equal(hash(code), m.blueprintSha256, 'manifest SHA does not match the string');
  assert(evidence, 'native report has no build for six-science');
  assert.equal(evidence.blueprintSha256, m.blueprintSha256, 'native report is stale for this string');
  assert.equal(m.prototypeSha256, officialSha);
  assert.equal(report.prototypeSha256, officialSha);
  assert.equal(report.gameVersion, '2.1.24');
  assert.equal(report.harnessSha256, hash(await read('scripts/six-science/control.lua')), 'harness changed since the report');
  assert.equal(report.validatorSha256, hash(await read('scripts/six-science/validate.mjs')), 'validator changed since the report');
  for (const field of ['dataHarnessSha256', 'configurationSha256']) assert.match(report[field], /^[a-f0-9]{64}$/);
  assert.notEqual(report.short, true, 'published report must come from a full-protocol run');
  assert.equal(m.status, 'qualified', 'manifest status must come from the validator run');
});

test('the full-protocol pass formula holds on the report numbers', () => {
  const p = report.protocol;
  assert(p.warmupMinutes >= 15 && p.measureMinutes >= 30 && p.blockedMinutes >= 10 && p.settleMinutes >= 5 && p.recoveryMinutes >= 10, 'protocol too short');
  assert.deepEqual(p, {warmupMinutes: m.protocol.warmupMinutes, measureMinutes: m.protocol.measureMinutes, blockedMinutes: m.protocol.blockedMinutes, settleMinutes: m.protocol.settleMinutes, recoveryMinutes: m.protocol.recoveryMinutes});
  for (const item of products) {
    assert(evidence.outputsPerMinute[item] >= 28.5, `steady ${item} ${evidence.outputsPerMinute[item]}`);
    assert(evidence.recovery.outputsPerMinute[item] >= 28.5, `recovery ${item} ${evidence.recovery.outputsPerMinute[item]}`);
  }
  assert(evidence.machines.length === Object.values(m.machineCounts).reduce((a, b) => a + b, 0));
  for (const x of evidence.machines) assert(x.measuredCrafts > 0, `idle machine ${x.recipe} at ${x.x},${x.y}`);
  for (const x of evidence.inputs) assert(x.acceptedDuringMeasurement > 0 && x.productiveRoute?.length, `entrance ${x.item}`);
  assert.equal(evidence.fluids.length, 2);
  for (const x of evidence.fluids) assert(x.acceptedDuringMeasurement > 0 && x.productiveConsumers.length > 0, `fluid ${x.item}`);
  for (const x of evidence.outputPorts) assert(x.collectedDuringMeasurement > 0, `output ${x.item}`);
  assert.equal(evidence.recovery.collectionPauseStock.length, 6);
  for (const x of evidence.recovery.collectionPauseStock) { assert.equal(x.count, 200, `cap ${x.item}`); assert(x.maxDuringBlocked <= 200); }
  for (const [name, s] of Object.entries(evidence.loopSamplesFinal)) assert(s.maxStock < .9 * s.capacity, `ring ${name} reached ${s.maxStock}/${s.capacity}`);
  assert(evidence.observedMaxHand <= 2);
  assert(evidence.powered && evidence.stockNetworksIsolated && evidence.externalApproachesClear && evidence.exactRecipeChecks > 0);
  assert.equal(report.passed, true);
  assert.equal(evidence.passed, true);
});

test('products, targets, caps and the external demand table are the spec values', () => {
  assert.equal(m.class, 'rate');
  assert.deepEqual(m.products, products);
  assert.deepEqual(m.targets, Object.fromEntries(products.map(p => [p, 30])));
  assert.deepEqual(m.outputCaps, Object.fromEntries(products.map(p => [p, 200])));
  assert.deepEqual(m.recipeAudit.externalPerMinute, demand);
  assert.deepEqual(m.greenCircuitSupply, {perMinute: 900, copiesOfGreenCircuits: 3});
});

test('eleven labelled west entrances, one per material', () => {
  assert.deepEqual(sorted(m.inputs.map(p => p.item)), sorted(solids));
  assert.deepEqual(sorted(m.fluids.map(p => p.item)), sorted(fluids));
  const material = [...m.inputs, ...m.fluids];
  assert.equal(new Set(material.map(p => p.entity)).size, 11);
  assert.equal(new Set(material.map(p => p.displayEntity)).size, 11);
  assert.equal(entities.filter(e => e.name === 'display-panel').length, 11);
  for (const p of material) {
    const e = byId.get(p.entity);
    assert.equal(p.externalSide, 'west');
    assert.equal(p.perMinute, demand[p.item]);
    if (m.inputs.includes(p)) { assert.equal(e.name, 'fast-transport-belt'); assert.equal(e.direction, 4); assert.equal(p.direction, 4); }
    else assert.equal(e.name, 'pipe');
    const panel = byId.get(p.displayEntity);
    assert.equal(panel.name, 'display-panel');
    assert.equal(panel.always_show, true);
    assert.deepEqual(panel.icon, {type: fluids.includes(p.item) ? 'fluid' : 'item', name: p.item});
    assert.equal(panel.text, `IN: ${p.item}\nWEST · ${Math.round(p.perMinute * 10) / 10}/min at nominal target`);
    assert(Math.max(Math.abs(panel.position.x - e.position.x), Math.abs(panel.position.y - e.position.y)) <= 4, 'panel too far from ' + p.item);
    assert(!(panel.position.y === e.position.y && panel.position.x < e.position.x), 'panel on the entrance row west of ' + p.item);
    for (const q of entities) if (q !== e && Math.floor(q.position.y) === Math.floor(e.position.y)) assert(q.position.x > e.position.x, `entity west of entrance ${p.item}`);
  }
});

test('six east output chests in one column, adjacent rows, table order', () => {
  assert.deepEqual(m.outputs.map(p => p.item), products);
  const xs = new Set(m.outputs.map(p => p.x));
  assert.equal(xs.size, 1);
  m.outputs.forEach((p, i) => {
    assert.equal(byId.get(p.entity).name, 'passive-provider-chest');
    assert.equal(byId.get(p.entity).bar, 1);
    assert.equal(p.externalSide, 'east');
    assert.equal(p.cap, 200);
    assert.equal(p.y, m.outputs[0].y + i);
    for (const q of entities) if (q !== byId.get(p.entity) && Math.floor(q.position.y) === Math.floor(p.y)) assert(q.position.x < p.x, 'entity east of an output chest');
  });
  assert.equal(m.stockControl.mode, 'bar');
  for (const c of m.stockControl.chests) {
    const arm = byId.get(c.arm);
    assert.equal(arm.name, 'fast-inserter');
    assert.equal(arm.use_filters, true);
    assert.deepEqual(arm.filters.map(f => f.name), [c.item]);
  }
});

test('only the allowed entities, arm settings, recipes, no modules', () => {
  for (const e of entities) {
    assert(allowed.has(e.name), 'entity not allowed: ' + e.name);
    if (e.recipe) assert.equal(e.name, e.recipe === 'battery' ? 'chemical-plant' : 'assembling-machine-2');
    if (e.name === 'chemical-plant') assert.equal(e.recipe, 'battery');
    if (e.name.endsWith('inserter')) {
      assert.equal(e.override_stack_size, e.name === 'bulk-inserter' ? 2 : 1, 'stack override ' + e.entity_number);
      assert.equal(e.use_filters, true, 'every arm here is filtered ' + e.entity_number);
    }
    assert.equal(e.items, undefined, 'items on ' + e.entity_number);
    assert.notEqual(e.recipe, 'electronic-circuit');
    assert.equal(e.tags?.flight_science_entity, e.entity_number);
  }
  const counts = {};
  for (const e of entities) if (e.recipe) counts[e.recipe] = (counts[e.recipe] || 0) + 1;
  assert.deepEqual(counts, m.machineCounts);
  for (const [recipe, n] of Object.entries(minimum)) assert((counts[recipe] || 0) >= n, `${recipe}: ${counts[recipe] || 0} < ${n}`);
  assert(entities.filter(e => e.name === 'medium-electric-pole').length <= 4);
  assert.equal(m.ports.filter(p => p.kind === 'power').length, 1);
  const construction = {};
  for (const e of entities) construction[e.name] = (construction[e.name] || 0) + 1;
  assert.deepEqual(construction, m.construction);
});

test('every tap splitter has an output priority', () => {
  const splitters = entities.filter(e => e.name === 'fast-splitter');
  assert(splitters.length > 0);
  for (const s of splitters) assert(['left', 'right'].includes(s.output_priority), 'splitter without priority ' + s.entity_number);
});

test('acid and lubricant pipes never touch', () => {
  const at = new Map();
  for (const e of entities) if (e.name === 'pipe' || e.name === 'pipe-to-ground') at.set(Math.floor(e.position.x) + ',' + Math.floor(e.position.y), e);
  const fluid = e => e.tags?.six_fluid || e.tags?.rgby_fluid;
  for (const [k, e] of at) {
    const [x, y] = k.split(',').map(Number);
    assert(fluid(e), 'untagged pipe ' + e.entity_number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = at.get((x + dx) + ',' + (y + dy)); if (n) assert.equal(fluid(n), fluid(e), `acid next to lubricant at ${k}`); }
  }
});

test('footprint and area goal', async () => {
  const {starterBounds} = await import('../scripts/science-factory/local-ports/compact-shared-layout.mjs');
  const dump = JSON.parse(await fs.readFile(process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json').catch(() => 'null'));
  if (dump) {
    dump.container = {...dump.container, ...dump['logistic-container']};
    assert.deepEqual(starterBounds(entities, dump), m.footprint);
  } else {
    // Without the dump, recompute from tile cells (all entities here are 1x1, 2x2 or 3x3).
    const size = e => ['assembling-machine-2', 'chemical-plant'].includes(e.name) ? 3 : e.name === 'substation' ? 2 : 1;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const e of entities) { const s = size(e) / 2; const w = e.name === 'fast-splitter' ? ([0, 8].includes(e.direction) ? 1 : .5) : s, h = e.name === 'fast-splitter' ? ([0, 8].includes(e.direction) ? .5 : 1) : s;
      l = Math.min(l, e.position.x - w); r = Math.max(r, e.position.x + w); t = Math.min(t, e.position.y - h); b = Math.max(b, e.position.y + h); }
    assert.deepEqual({left: l, top: t, right: r, bottom: b, width: r - l, height: b - t}, m.footprint);
  }
  assert.equal(m.areaGoal.achievedTiles, m.footprint.width * m.footprint.height);
  assert.equal(m.areaGoal.goalTiles, 4400);
  assert.equal(m.areaGoal.stretchTiles, 3600);
  assert(m.areaGoal.achievedTiles <= 6600, 'above the 6,600 tile ceiling');
});

test('ring conventions: per-tile hold readers, limits under 60%, controlled arms wired to their ring', () => {
  assert(m.loopControl.length >= 1);
  const red = new Map();
  for (const [a, ca, b, cb] of bp.wires) if (ca === 1 && cb === 1) { (red.get(a) || red.set(a, new Set()).get(a)).add(b); (red.get(b) || red.set(b, new Set()).get(b)).add(a); }
  const component = start => { const seen = new Set([start]), q = [start]; while (q.length) for (const n of red.get(q.pop()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); } return seen; };
  const networks = [];
  for (const loop of m.loopControl) {
    assert.equal(loop.readerMode, 'per-tile-hold');
    assert.equal(loop.capacity, 8 * loop.loop.length);
    assert.equal(loop.maximumStock, Object.values(loop.limits).reduce((a, b) => a + b, 0));
    assert(loop.maximumStock <= .6 * loop.capacity, loop.name + ' limit sum above 60%');
    const net = component(loop.reader);
    for (const id of loop.loop) {
      const e = byId.get(id);
      assert.equal(e.name, 'fast-transport-belt');
      assert.deepEqual(e.control_behavior, {circuit_read_hand_contents: true, circuit_contents_read_mode: 1});
      assert(net.has(id), 'ring tile off the ring network ' + id);
    }
    for (const id of loop.controlled) {
      assert(net.has(id), 'controlled arm not wired to its ring ' + id);
      const c = byId.get(id).control_behavior?.circuit_condition;
      assert(c && ['<', '>'].includes(c.comparator));
      if (c.comparator === '<') assert.equal(c.constant, loop.limits[c.first_signal.name], 'limit mismatch on ' + id);
    }
    for (const other of networks) assert(!net.has(other), 'two rings share a red network');
    networks.push(loop.reader);
  }
  assert(bp.wires.every(([, ca, , cb]) => ca !== 2 && cb !== 2), 'no green wires are used');
  for (const [a, ca, b, cb] of bp.wires) if (ca !== 5) { const ea = byId.get(a), eb = byId.get(b); assert(Math.hypot(ea.position.x - eb.position.x, ea.position.y - eb.position.y) <= 8, 'circuit wire longer than 8 tiles'); }
});

test('underground pipe runs of different fluids never share a line', () => {
  const ptg = entities.filter(e => e.name === 'pipe-to-ground').map(e => ({e, x: Math.floor(e.position.x), y: Math.floor(e.position.y), d: e.direction ?? 0, fluid: e.tags?.six_fluid || e.tags?.rgby_fluid}));
  const step = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};
  const runs = [];
  for (const a of ptg) {
    const [ux, uy] = step[(a.d + 8) % 16]; // underground side is opposite the above-ground connection
    for (let k = 1; k <= 10; k++) {
      const b = ptg.find(p => p.x === a.x + ux * k && p.y === a.y + uy * k);
      if (b) { if (b.d === (a.d + 8) % 16) { assert.equal(b.fluid, a.fluid, 'pipe-to-ground pair of mixed fluids'); runs.push({a, b}); } break; }
    }
  }
  assert(runs.length > 0);
  for (const r of runs) for (const s of runs) {
    if (r === s || r.a.fluid === s.a.fluid) continue;
    const sameRow = r.a.y === r.b.y && s.a.y === s.b.y && r.a.y === s.a.y, sameCol = r.a.x === r.b.x && s.a.x === s.b.x && r.a.x === s.a.x;
    if (!sameRow && !sameCol) continue;
    const [r0, r1] = sameRow ? [Math.min(r.a.x, r.b.x), Math.max(r.a.x, r.b.x)] : [Math.min(r.a.y, r.b.y), Math.max(r.a.y, r.b.y)];
    const [s0, s1] = sameRow ? [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)] : [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)];
    assert(r1 < s0 || s1 < r0, 'acid and lubricant underground runs overlap on one line');
  }
});

test('no straight surface belt run is left that the bury pass could still tunnel', async () => {
  const {buryStraightRuns} = await import('../scripts/six-science/bury.mjs');
  const copy = JSON.parse(JSON.stringify(bp));
  copy.wires ||= [];
  const left = buryStraightRuns(copy, m.ports);
  assert.equal(left.pairs, 0, `${left.pairs} more runs could be buried (${left.saved} belts)`);
  assert(m.underground.straightRunsPairs > 0, 'manifest does not record the bury pass');
});
