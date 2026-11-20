import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root = new URL('../', import.meta.url);
const read = p => fs.readFile(new URL(p, root));
const hash = v => createHash('sha256').update(v).digest('hex');
const dir = 'blueprint-sources/essentials-mall/';
const records = JSON.parse(await read(dir + 'manifest.json'));
const m = records[0];
const code = (await read(dir + m.file)).toString().trim();
const bp = decodeBlueprint(code).blueprint, entities = bp.entities;
const byId = new Map(entities.map(e => [e.entity_number, e]));
// The report must exist: a missing report fails here instead of skipping.
const report = JSON.parse(await read(dir + 'native-report.json'));
const evidence = report.builds?.find(b => b.id === m.id);
const officialSha = 'ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';

// Spec section 1 and 2.
const targets = {'assembling-machine-2': 2, 'fast-transport-belt': 8, 'fast-underground-belt': 1.5, 'fast-splitter': 1, 'fast-inserter': 6, 'bulk-inserter': 1, 'electric-furnace': 1, 'electric-mining-drill': 3};
const caps = {'assembling-machine-2': 50, 'fast-transport-belt': 200, 'fast-underground-belt': 50, 'fast-splitter': 25, 'fast-inserter': 50, 'bulk-inserter': 25, 'electric-furnace': 25, 'electric-mining-drill': 50};
const demand = {'iron-plate': 379.125, 'electronic-circuit': 84, 'steel-plate': 14, 'copper-plate': 12, 'plastic-bar': 12, 'stone-brick': 10};
const products = Object.keys(targets);
const sorted = v => [...v].sort();
const fmt = n => String(Math.round(n * 10) / 10);
const wiresOf = (id, connector) => bp.wires.filter(w => (w[0] === id && w[1] === connector) || (w[2] === id && w[3] === connector)).map(w => w[0] === id ? [w[2], w[3]] : [w[0], w[1]]);
function network(start, connector) {
  const seen = new Set([`${start}:${connector}`]), queue = [[start, connector]];
  while (queue.length) {
    const [id, c] = queue.shift();
    for (const [other, oc] of wiresOf(id, c)) { const k = `${other}:${oc}`; if (!seen.has(k)) { seen.add(k); queue.push([other, oc]); } }
  }
  return seen;
}

test('one record; string, report, prototype, harness and validator hashes agree', async () => {
  assert.equal(records.length, 1);
  assert.equal(m.id, 'essentials-mall'); assert.equal(m.file, 'essentials-mall.txt'); assert.equal(m.class, 'on-demand');
  assert.equal(hash(code), m.blueprintSha256);
  assert(evidence, 'native evidence missing');
  assert.equal(evidence.blueprintSha256, m.blueprintSha256, 'native report is stale for this string');
  assert.equal(m.prototypeSha256, officialSha); assert.equal(report.prototypeSha256, officialSha);
  assert.equal(report.gameVersion, '2.1.24');
  assert.equal(report.harnessSha256, hash(await read('scripts/essentials-mall/control.lua')), 'harness changed since the report');
  assert.equal(report.validatorSha256, hash(await read('scripts/essentials-mall/validate.mjs')), 'validator changed since the report');
  for (const field of ['dataHarnessSha256', 'configurationSha256']) assert.match(report[field], /^[a-f0-9]{64}$/);
  assert.equal(report.short, undefined, 'an exploration report is not a qualification');
  assert.deepEqual([report.protocol.warmupMinutes, report.protocol.measureMinutes, report.protocol.blockedMinutes, report.protocol.settleMinutes, report.protocol.recoveryMinutes], [10, 20, 5, 5, 10]);
  assert.deepEqual(sorted(report.protocol.capProducts), sorted(products));
});

test('products, floors, caps and recipe demand match the spec', () => {
  assert.deepEqual(m.targets, targets);
  assert.deepEqual(m.outputCaps, caps);
  assert.deepEqual(sorted(m.products), sorted(products));
  assert.deepEqual(m.recipeAudit.externalPerMinute, demand);
  for (const p of products) {
    assert.equal(m.protocol.fillLimitMinutes[p], Math.max(10, Math.ceil(2 * caps[p] / targets[p])));
    assert.equal(m.protocol.refillLimitMinutes[p], Math.max(5, Math.ceil(caps[p] / targets[p])));
  }
  assert.deepEqual(m.greenCircuitSupply, {perMinute: 84, copiesOfGreenCircuits: 1});
});

test('six labelled west entrances, one per material', () => {
  assert.deepEqual(sorted(m.inputs.map(p => p.item)), sorted(Object.keys(demand)));
  assert.deepEqual(m.fluids, []);
  assert.equal(new Set(m.inputs.map(p => p.entity)).size, 6);
  assert.equal(new Set(m.inputs.map(p => p.displayEntity)).size, 6);
  assert.equal(entities.filter(e => e.name === 'display-panel').length, 6);
  for (const p of m.inputs) {
    const e = byId.get(p.entity), panel = byId.get(p.displayEntity);
    assert.equal(e.name, 'fast-transport-belt'); assert.equal(e.direction, 4); assert.equal(p.direction, 4);
    assert.equal(p.externalSide, 'west'); assert.equal(p.perMinute, demand[p.item]);
    assert.equal(panel.name, 'display-panel'); assert.equal(panel.always_show, true);
    assert.deepEqual(panel.icon, {type: 'item', name: p.item, quality: 'normal'});
    assert.equal(panel.text, `IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min at nominal target`);
    assert(Math.hypot(panel.position.x - e.position.x, panel.position.y - e.position.y) <= 4, 'panel within 4 tiles');
    assert(!(Math.floor(panel.position.y) === Math.floor(e.position.y) && panel.position.x < e.position.x), 'panel west of its entrance');
    // Nothing of the blueprint on the three tiles west of the entrance.
    for (let k = 1; k <= 3; k++) assert(!entities.some(o => Math.floor(o.position.y) === Math.floor(e.position.y) && Math.floor(o.position.x) === Math.floor(e.position.x) - k));
  }
});

test('eight east passive-provider chests in one column, one product each, caps on one constant combinator', () => {
  assert.deepEqual(sorted(m.outputs.map(p => p.item)), sorted(products));
  const chests = m.outputs.map(p => byId.get(p.entity));
  assert(chests.every(c => c.name === 'passive-provider-chest' && c.bar === undefined));
  assert.equal(new Set(chests.map(c => c.position.x)).size, 1, 'one column');
  assert.equal(new Set(chests.map(c => c.entity_number)).size, 8);
  assert.equal(entities.filter(e => e.name === 'passive-provider-chest').length, 8);
  const eastEdge = Math.max(...entities.map(e => e.position.x));
  for (const p of m.outputs) { assert.equal(p.externalSide, 'east'); assert.equal(p.cap, caps[p.item]); assert.equal(byId.get(p.entity).position.x, eastEdge); }
  assert.equal(m.stockControl.mode, 'chest-condition');
  const comb = byId.get(m.stockControl.combinator);
  assert.equal(comb.name, 'constant-combinator');
  const filters = comb.control_behavior.sections.sections[0].filters;
  assert.deepEqual(Object.fromEntries(filters.map(f => [f.name, f.count])), Object.fromEntries(products.map(p => [p, -caps[p]])));
  const green = network(comb.entity_number, 2);
  for (const p of m.outputs) {
    assert(green.has(`${p.entity}:2`), `chest ${p.item} on the cap network`);
    const arm = byId.get(p.arm);
    assert(green.has(`${p.arm}:2`), `chest arm ${p.item} on the cap network`);
    assert.equal(wiresOf(p.arm, 1).length, 0, 'chest arms are green only');
    assert.equal(arm.override_stack_size, 1);
    assert.deepEqual(arm.filters.map(f => f.name), [p.item]);
    const reserve = m.stockControl.chestReserve?.item === p.item;
    if (reserve) assert.deepEqual(arm.control_behavior.circuit_condition, {first_signal: {type: 'virtual', name: 'signal-R'}, comparator: '>', constant: 0});
    else assert.deepEqual(arm.control_behavior.circuit_condition, {first_signal: {type: 'item', name: p.item, quality: 'normal'}, comparator: '<', constant: 0});
  }
  if (m.stockControl.chestReserve) {
    const r = m.stockControl.chestReserve, d = byId.get(r.decider), c = d.control_behavior.decider_conditions.conditions;
    assert.equal(c[0].first_signal.name, r.item); assert.equal(c[0].comparator, '<'); assert.equal(c[0].constant, 0); assert.deepEqual(c[0].first_signal_networks, {red: false, green: true});
    assert.equal(c[1].first_signal.name, r.item); assert.equal(c[1].comparator, '>'); assert.equal(c[1].constant, r.reserve); assert.deepEqual(c[1].first_signal_networks, {red: true, green: false});
    assert(green.has(`${r.decider}:2`) && green.has(`${r.decider}:4`));
    assert(r.reserve < m.loopControl[0].limits[r.item]);
  }
  for (const g of m.stockControl.capGatedArms) assert(green.has(`${g.entity}:2`) && wiresOf(g.entity, 1).length === 0);
});

test('fast-inserter feed gate: the inserter-feed arm runs while the chest is below its cap OR the ring holds too few', () => {
  const g = m.stockControl.feedGate;
  assert(g, 'feed gate missing: a full fast-inserter chest would starve the bulk-inserter machine');
  assert.equal(g.item, 'fast-inserter'); assert.equal(g.signal, 'signal-F'); assert(g.ringBelow >= 1);
  const d = byId.get(g.decider), c = d.control_behavior.decider_conditions;
  assert.equal(d.name, 'decider-combinator');
  assert.equal(c.conditions.length, 2);
  const [chest, ringTerm] = c.conditions;
  assert.deepEqual([chest.first_signal.name, chest.comparator, chest.constant, chest.first_signal_networks], ['fast-inserter', '<', 0, {red: false, green: true}]);
  assert.deepEqual([ringTerm.first_signal.name, ringTerm.comparator, ringTerm.constant, ringTerm.first_signal_networks, ringTerm.compare_type], ['fast-inserter', '<', g.ringBelow, {red: true, green: false}, 'or']);
  assert.deepEqual(c.outputs, [{signal: {type: 'virtual', name: 'signal-F'}, copy_count_from_input: false, constant: 1}]);
  const red = network(m.loopControl[0].reader, 1), green = network(m.stockControl.combinator, 2);
  assert(red.has(`${g.decider}:1`), 'decider reads the ring on red');
  assert(green.has(`${g.decider}:2`) && green.has(`${g.decider}:4`), 'decider input and output green on the cap network');
  assert(!red.has(`${g.decider}:3`) && wiresOf(g.decider, 3).length === 0, 'decider output not on red');
  // The arm is the inserter feed of the fast-inserter machine and reads the decider's output.
  const arm = byId.get(g.arm);
  assert.deepEqual(arm.filters.map(f => f.name), ['inserter']);
  assert.deepEqual(arm.control_behavior.circuit_condition, {first_signal: {type: 'virtual', name: 'signal-F'}, comparator: '>', constant: 0});
  assert(green.has(`${g.arm}:2`) && wiresOf(g.arm, 1).length === 0);
  assert(m.stockControl.capGatedArms.some(a => a.entity === g.arm && a.product === 'fast-inserter'));
  const machine = byId.get(m.finalMachines['fast-inserter'][0]);
  assert(Math.abs(arm.position.x - machine.position.x) <= 1 && Math.abs(arm.position.y - machine.position.y) === 2, 'feed arm sits at the fast-inserter machine');
  assert.match(bp.description, /fast-inserter feed decider/);
});

test('allowed entities only, arm settings, no circuit recipe, no modules, machine counts', () => {
  const allowed = new Set(['assembling-machine-2', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'fast-inserter', 'long-handed-inserter', 'bulk-inserter', 'passive-provider-chest', 'substation', 'medium-electric-pole', 'constant-combinator', 'arithmetic-combinator', 'decider-combinator', 'display-panel']);
  for (const e of entities) {
    assert(allowed.has(e.name), e.name);
    assert.equal(e.tags?.flight_science_entity, e.entity_number);
    assert(e.quality === undefined || e.quality === 'normal');
    if (e.name === 'assembling-machine-2') { assert(e.recipe); assert.equal(e.items, undefined); }
    if (e.name === 'fast-inserter' || e.name === 'long-handed-inserter') assert.equal(e.override_stack_size, 1);
    if (e.name === 'bulk-inserter') assert.equal(e.override_stack_size, 2);
    // Every arm is a whitelist-filtered arm.
    if (e.name.endsWith('inserter')) {
      assert.equal(e.use_filters, true, `arm ${e.entity_number} has no filters`);
      assert(e.filter_mode === undefined || e.filter_mode === 'whitelist', `arm ${e.entity_number} is not a whitelist`);
      assert(e.filters?.length >= 1 && e.filters.every(f => f.name && (f.comparator ?? '=') === '='), `arm ${e.entity_number} filters`);
    }
  }
  assert(entities.filter(e => e.name === 'medium-electric-pole').length <= 4);
  assert(!entities.some(e => e.recipe === 'electronic-circuit'), 'no machine makes electronic circuits');
  const counts = {};
  for (const e of entities.filter(e => e.recipe)) counts[e.recipe] = (counts[e.recipe] || 0) + 1;
  assert.deepEqual(counts, m.machineCounts);
  // The accepted machine counts: 3 gear machines, 2 advanced-circuit machines, 1 of each other recipe.
  const accepted = {'iron-gear-wheel': 3, 'advanced-circuit': 2};
  for (const r of ['transport-belt', 'underground-belt', 'splitter', 'inserter', 'assembling-machine-1', 'copper-cable', ...products]) accepted[r] = 1;
  assert.deepEqual(Object.fromEntries(Object.entries(counts).sort()), Object.fromEntries(Object.entries(accepted).sort()));
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 19);
  assert.equal(entities.filter(e => e.name === 'assembling-machine-2').length, 19);
  assert.deepEqual(Object.fromEntries(Object.entries(m.construction)), Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length])));
  assert.equal(m.ports.filter(p => p.kind === 'power').length, 1);
  assert.equal(byId.get(m.ports.find(p => p.kind === 'power').entity).name, 'substation');
});

test('footprint equals the bounds of the decoded string', () => {
  const size = {'assembling-machine-2': [3, 3], substation: [2, 2], 'fast-splitter': [2, 1], 'arithmetic-combinator': [1, 2], 'decider-combinator': [1, 2]};
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const e of entities) {
    let [w, h] = size[e.name] || [1, 1];
    if ([4, 12].includes(e.direction)) [w, h] = [h, w];
    left = Math.min(left, e.position.x - w / 2); right = Math.max(right, e.position.x + w / 2);
    top = Math.min(top, e.position.y - h / 2); bottom = Math.max(bottom, e.position.y + h / 2);
  }
  assert.deepEqual(m.footprint, {left, top, right, bottom, width: right - left, height: bottom - top});
  assert.equal(m.areaGoal.achievedTiles, m.footprint.width * m.footprint.height);
  assert.equal(m.areaGoal.goalTiles, 442); assert.equal(m.areaGoal.stretchTiles, 400);
});

test('ring: per-tile hold readers on one red network, limits under 60% of capacity, controlled arms on the ring', () => {
  assert.equal(m.loopControl.length, 1);
  const ring = m.loopControl[0];
  assert.equal(ring.readerMode, 'per-tile-hold');
  assert.equal(ring.capacity, 8 * ring.loop.length);
  assert.equal(ring.maximumStock, Object.values(ring.limits).reduce((a, b) => a + b, 0));
  assert(ring.maximumStock <= .6 * ring.capacity);
  const red = network(ring.reader, 1);
  for (const id of ring.loop) {
    const e = byId.get(id);
    assert.equal(e.name, 'fast-transport-belt');
    assert.deepEqual(e.control_behavior, {circuit_read_hand_contents: true, circuit_contents_read_mode: 1});
    assert(red.has(`${id}:1`)); assert.equal(wiresOf(id, 2).length, 0);
  }
  for (const id of ring.controlled) {
    const e = byId.get(id), c = e.control_behavior.circuit_condition;
    assert(red.has(`${id}:1`), `controlled arm ${id} on the ring`);
    assert.equal(e.control_behavior.circuit_enabled, true);
    assert.equal(c.comparator, '<'); assert.equal(c.constant, ring.limits[c.first_signal.name]);
    if (e.name === 'fast-transport-belt') {
      // A gated entrance belt: it is the declared west entrance of that item and side-loads onto the ring.
      const port = m.inputs.find(p => p.entity === id);
      assert(port && port.item === c.first_signal.name, `gated belt ${id} is the entrance for ${c.first_signal.name}`);
      assert.equal(e.direction, 4); assert(!ring.loop.includes(id));
      const next = entities.find(o => ring.loop.includes(o.entity_number) && o.position.x === e.position.x + 1 && o.position.y === e.position.y);
      assert(next && next.direction === 0, `gated belt ${id} side-loads onto the north-bound west column`);
      assert.deepEqual(m.admissions[port.item], [id]);
    } else assert.deepEqual(e.filters.map(f => f.name), [c.first_signal.name]);
  }
  // Every admission reaches the ring under its limit.
  for (const p of m.inputs) for (const id of m.admissions[p.item]) assert(ring.controlled.includes(id), `admission ${p.item} not ring-controlled`);
  for (const r of m.productionClock.reserveArms) {
    const c = byId.get(r.entity).control_behavior.circuit_condition;
    assert(red.has(`${r.entity}:1`), `reserve arm ${r.entity} on the ring`);
    assert.deepEqual([c.first_signal.name, c.comparator, c.constant], [r.item, '>', r.reserve]);
    assert(r.reserve < ring.limits[r.item]);
  }
  // The cap network never touches the ring network.
  const green = network(m.stockControl.combinator, 2);
  for (const k of red) assert(!green.has(k));
});

test('gear clock: timer, divider and phase, each windowed arm matches its recorded phases', () => {
  const c = m.productionClock, N = c.phases;
  const timer = byId.get(c.timer).control_behavior.arithmetic_conditions, divide = byId.get(c.divide).control_behavior.arithmetic_conditions, phase = byId.get(c.phase).control_behavior.arithmetic_conditions;
  assert.deepEqual([timer.operation, timer.second_constant, timer.output_signal.name], ['+', 1, 'signal-T']);
  assert.deepEqual([divide.operation, divide.second_constant, divide.output_signal.name], ['/', c.windowTicks, 'signal-U']);
  assert.deepEqual([phase.operation, phase.second_constant, phase.output_signal.name], ['%', N, 'signal-P']);
  assert(network(m.loopControl[0].reader, 1).has(`${c.phase}:3`), 'phase output on the ring network');
  const arms = new Map();
  for (const [k, list] of Object.entries(c.phaseAssignment)) for (const a of list) { if (!arms.has(a.arm)) arms.set(a.arm, []); arms.get(a.arm).push(Number(k)); }
  for (const [id, phases] of arms) {
    const cond = byId.get(id).control_behavior.circuit_condition;
    assert.equal(cond.first_signal.name, 'signal-P');
    const expect = [...Array(N).keys()].filter(p => cond.comparator === '=' ? p === cond.constant : cond.comparator === '<' ? p < cond.constant : p > cond.constant);
    assert.deepEqual(phases, expect);
    assert.equal(byId.get(id).filters[0].name, 'iron-gear-wheel');
  }
  // Every final product that uses gears has at least one gear window.
  for (const p of ['assembling-machine-2', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'bulk-inserter', 'electric-mining-drill'])
    assert([...arms.values()].length && Object.values(c.phaseAssignment).flat().some(a => a.recipe === p), 'no gear window for ' + p);
});

test('native qualification: the report passes and the pass formula holds on its numbers', () => {
  assert.equal(report.passed, true, 'report not qualified'); assert.equal(evidence.passed, true);
  assert.equal(m.status, 'qualified');
  assert.equal(evidence.complete, true);
  assert.equal(evidence.importedEntities, entities.length);
  assert.equal(evidence.powered, true); assert.equal(evidence.externalApproachesClear, true); assert.equal(evidence.stockNetworksIsolated, true); assert(evidence.exactRecipeChecks > 0);
  for (const p of products) {
    assert(evidence.outputsPerMinute[p] >= targets[p], `steady ${p} ${evidence.outputsPerMinute[p]}`);
    assert(evidence.recovery.outputsPerMinute[p] >= targets[p], `recovery ${p} ${evidence.recovery.outputsPerMinute[p]}`);
    assert(evidence.outputPorts.find(o => o.item === p).collectedDuringMeasurement > 0);
    assert(evidence.blocked.chestMax[p] <= caps[p]);
  }
  assert.deepEqual(evidence.chestOverCap, {});
  const machines = entities.filter(e => e.recipe);
  assert.equal(evidence.machines.length, machines.length);
  for (const e of machines) { const n = evidence.machines.find(n => n.entity === e.entity_number); assert(n && n.recipe === e.recipe && n.actualRecipe === e.recipe && n.measuredCrafts > 0, `machine ${e.entity_number} ${e.recipe}`); }
  for (const p of m.inputs) {
    const n = evidence.inputs.find(n => n.entity === p.entity && n.item === p.item);
    assert(n.acceptedDuringMeasurement > 0); assert(n.productiveRoute.length >= 2); assert.equal(n.productiveRoute[0], p.entity);
    assert(evidence.machines.some(q => q.entity === n.productiveRoute.at(-1) && q.measuredCrafts > 0));
  }
  assert.equal(evidence.ringOverall.violations, 0); assert(evidence.ringOverall.maxStock < .9 * m.loopControl[0].capacity);
  assert.equal(evidence.inserterCapacityResearch.fast, 0); assert.equal(evidence.inserterCapacityResearch.bulkUnlockBonus, 1);
  assert.equal(evidence.bulkInserters.length, entities.filter(e => e.name === 'bulk-inserter').length);
  for (const b of evidence.bulkInserters) assert(b.observedMaxHand <= 2);
  assert.equal(evidence.capTests.length, 8);
  assert.deepEqual(sorted(evidence.capTests.map(c => c.product)), sorted(products));
  for (const c of evidence.capTests) {
    const p = c.product;
    assert(c.filled && c.fillMinutes <= m.protocol.fillLimitMinutes[p], `${p} fill`);
    assert.equal(c.holdMismatches, 0); assert.equal(c.holdSamples, 600); assert.equal(c.holdEndStock, caps[p]);
    if (c.ringLimit != null) assert(c.holdRingMax <= c.ringLimit);
    assert(c.finalCraftsLastHalf <= (p === 'fast-inserter' ? c.consumerCraftsLastHalf : 0), `${p} final machine kept crafting`);
    for (const q of products.filter(q => q !== p)) assert(c.othersPerMinute[q] >= targets[q], `${q} during ${p} hold: ${c.othersPerMinute[q]}`);
    assert.equal(c.withdrawn, Math.floor(caps[p] / 2));
    assert(c.refilled && c.refillMinutes <= m.protocol.refillLimitMinutes[p] && c.refillCrafts > 0, `${p} refill`);
  }
});
