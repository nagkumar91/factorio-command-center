import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';

const root = new URL('../', import.meta.url);
const read = p => fs.readFile(new URL(p, root));
const hash = v => createHash('sha256').update(v).digest('hex');
const dir = 'blueprint-sources/launch-kit/';
const records = JSON.parse(await read(dir + 'manifest.json'));
const m = records[0];
const code = (await read(dir + m.file)).toString().trim();
const bp = decodeBlueprint(code).blueprint, entities = bp.entities;
const byId = new Map(entities.map(e => [e.entity_number, e]));
// The report must exist: a missing report fails here instead of skipping.
const report = JSON.parse(await read(dir + 'native-report.json'));
const evidence = report.builds?.[0];
const bill = JSON.parse(await read('scripts/launch-kit/bill.json'));
const officialSha = 'ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3';
const RAW = process.env.FACTORIO_RAW || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
let haveDump = false; try { fsSync.accessSync(RAW, fsSync.constants.R_OK); haveDump = true; } catch {}

// launch-kit.md section 2: the fixed item list and the largest cap the layout supports for each. Counts and spares
// are read from scripts/launch-kit/bill.json, never written here.
const MAX = {
  'rocket-silo': 1, 'cargo-landing-pad': 1, 'space-platform-starter-pack': 1, 'space-platform-foundation': 330, 'asteroid-collector': 8, crusher: 6,
  'assembling-machine-2': 10, 'electric-furnace': 4, 'fast-inserter': 50, 'solar-panel': 30, accumulator: 10, 'constant-combinator': 10,
  'arithmetic-combinator': 10, 'decider-combinator': 10, 'passive-provider-chest': 10, substation: 10};
const ITEMS = Object.keys(MAX);
// Planning values (launch-kit.md sections 2 and 3), asserted only while both bill sources still say "planning".
const PLANNING = Object.values(bill.sources).every(v => v === 'planning');
const PLANNING_COUNTS = {'rocket-silo': [1, 0], 'cargo-landing-pad': [1, 0], 'space-platform-starter-pack': [1, 0], 'space-platform-foundation': [173, 18], 'asteroid-collector': [4, 0],
  crusher: [3, 0], 'assembling-machine-2': [4, 0], 'electric-furnace': [1, 0], 'fast-inserter': [21, 3], 'solar-panel': [10, 0], accumulator: [1, 0], 'constant-combinator': [1, 0],
  'arithmetic-combinator': [1, 0], 'decider-combinator': [4, 0], 'passive-provider-chest': [1, 0], substation: [1, 0]};
const PLANNING_PER_KIT = {concrete: 1200, 'steel-plate': 6723, 'copper-plate': 6405, 'plastic-bar': 1722, 'iron-plate': 1391, 'stone-brick': 10, 'electronic-circuit': 6822, lubricant: 3930, 'sulfuric-acid': 1350};
const EXACT = ['rocket-silo', 'cargo-landing-pad', 'space-platform-starter-pack', 'asteroid-collector', 'crusher'];
// Stack sizes (from the game) for the chest-capacity rule: every chest holds its max cap in 48 slots.
const STACK = {'rocket-silo': 1, 'cargo-landing-pad': 1, 'space-platform-starter-pack': 1, 'space-platform-foundation': 100, 'asteroid-collector': 10, crusher: 10, 'assembling-machine-2': 50, 'electric-furnace': 50,
  'fast-inserter': 50, 'solar-panel': 50, accumulator: 50, 'constant-combinator': 50, 'arithmetic-combinator': 50, 'decider-combinator': 50, 'passive-provider-chest': 50, substation: 50};
// launch-kit.md section 3: the nine entrance materials (fixed).
const MATERIALS = ['concrete', 'steel-plate', 'copper-plate', 'plastic-bar', 'iron-plate', 'stone-brick', 'electronic-circuit', 'lubricant', 'sulfuric-acid'];
const FLUIDS = ['lubricant', 'sulfuric-acid'];
// The supply rule of scripts/launch-kit/generate.mjs, restated: roundUp(headroom x perKit / designMinutes), at least the minimum.
const supplyRule = (item, perKit, r) => { const v = (FLUIDS.includes(item) ? r.fluidHeadroom : r.solidHeadroom) * perKit / r.designMinutes;
  return Math.max(r.minimum, v >= 10 ? Math.ceil(v - 1e-9) : Math.ceil(v * 10 - 1e-9) / 10); };
const sorted = v => [...v].sort();
const arr = x => Array.isArray(x) ? x : Object.values(x || {});
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
  assert.equal(m.id, 'launch-kit'); assert.equal(m.file, 'launch-kit.txt'); assert.equal(m.class, 'kit');
  assert.equal(m.name, 'Space launch kit · silo, pad, starter pack and platform parts'); assert.equal(bp.label, m.name);
  assert.equal(bp.version, 562954249961473);
  assert.equal(hash(code), m.blueprintSha256);
  assert(evidence, 'native evidence missing');
  assert.equal(evidence.blueprintSha256, m.blueprintSha256, 'native report is stale for this string');
  assert.equal(m.prototypeSha256, officialSha); assert.equal(report.prototypeSha256, officialSha);
  assert.equal(report.gameVersion, '2.1.24');
  assert.equal(report.harnessSha256, hash(await read('scripts/launch-kit/control.lua')), 'harness changed since the report');
  assert.equal(report.validatorSha256, hash(await read('scripts/launch-kit/validate.mjs')), 'validator changed since the report');
  for (const field of ['dataHarnessSha256', 'configurationSha256']) assert.match(report[field], /^[a-f0-9]{64}$/);
  assert.equal(report.short, undefined, 'an exploration report is not a qualification');
  assert.equal(report.protocol.throttled, true, 'the qualifying run feeds every entrance at its panel figure');
  assert(report.protocol.kitLimitMinutes >= 90 && report.protocol.holdMinutes >= 15 && report.protocol.refillLimitMinutes >= 30 && report.protocol.longHoldMinutes >= 30);
  assert.deepEqual([report.protocol.kitLimitMinutes, report.protocol.holdMinutes, report.protocol.refillLimitMinutes, report.protocol.longHoldMinutes],
    [m.protocol.kitLimitMinutes, m.protocol.holdMinutes, m.protocol.refillLimitMinutes, m.protocol.longHoldMinutes]);
});

test('bill: the fixed item list, counts only in bill.json, caps within range and every chest can hold its max', () => {
  assert.equal(bill.schema, 1);
  assert.deepEqual(sorted(bill.items.map(r => r.item)), sorted(ITEMS));
  for (const r of bill.items) {
    assert.equal(r.max, MAX[r.item], `${r.item} max cap`);
    assert(Number.isInteger(r.count) && Number.isInteger(r.spare) && r.count >= 0 && r.spare >= 0, r.item);
    const cap = r.count + r.spare;
    assert(cap >= 0 && cap <= r.max, `${r.item} cap ${cap} within 0..${r.max}`);
    assert.equal(m.outputCaps[r.item], cap);
    const shares = Object.fromEntries(['platform', 'receiver'].filter(k => r[k] != null).map(k => [k, r[k]]));
    assert.deepEqual(m.bill.items.find(b => b.item === r.item), {item: r.item, count: r.count, spare: r.spare, cap, max: r.max, ...shares}, 'manifest bill follows bill.json');
    assert(Math.ceil(r.max / STACK[r.item]) <= 48, `${r.item} max ${r.max} fits a 48-slot chest`);
    if (PLANNING) assert.deepEqual([r.count, r.spare], PLANNING_COUNTS[r.item], `${r.item}: planning bill (launch-kit.md section 2)`);
  }
  assert.deepEqual(m.bill.sources, bill.sources);
  // Spare rule: 10% rounded up on fast inserters and foundation, zero elsewhere.
  for (const r of bill.items) assert.equal(r.spare, ['fast-inserter', 'space-platform-foundation'].includes(r.item) ? Math.ceil(r.count / 10) : 0);
  // No count is written into the code: the cap combinator carries -cap for each item.
  const comb = byId.get(m.stockControl.combinator);
  assert.equal(comb.name, 'constant-combinator');
  assert.deepEqual(Object.fromEntries(comb.control_behavior.sections.sections[0].filters.map(f => [f.name, f.count])), Object.fromEntries(bill.items.map(r => [r.item, -(r.count + r.spare)])));
  assert.deepEqual(m.targets, {});
});

// Contract section 2: item weights in kg (game value / 1000). The qualifying run re-checks each against the game.
const WEIGHT_KG = {'space-platform-foundation': 20, 'asteroid-collector': 100, crusher: 100, 'assembling-machine-2': 20, 'electric-furnace': 20, 'fast-inserter': 20,
  'solar-panel': 20, accumulator: 20, 'constant-combinator': 20, 'arithmetic-combinator': 20, 'decider-combinator': 20, 'space-platform-starter-pack': 1000};

test('bill sources and shares: counted from named strings, platform + receiver = count, rockets lift the platform part', () => {
  for (const [k, v] of Object.entries(bill.sources)) assert(v === 'planning' || /^[a-f0-9]{64}$/.test(v), `${k} source is "planning" or a blueprint SHA-256`);
  if (PLANNING) return;
  // Once counted from real strings, every item says where its count goes; the silo and starter pack are for the launch.
  for (const r of bill.items) {
    if (['rocket-silo', 'space-platform-starter-pack'].includes(r.item)) { assert.equal(r.count, 1); assert.equal(r.platform ?? 0, 0); assert.equal(r.receiver ?? 0, 0); continue; }
    assert.equal((r.platform ?? 0) + (r.receiver ?? 0), r.count, `${r.item}: platform + receiver shares = count`);
  }
  const request = Object.fromEntries(bill.items.filter(r => r.platform > 0).map(r => [r.item, r.platform]));
  const kg = Object.entries(request).reduce((a, [n, c]) => a + WEIGHT_KG[n] * c, 0);
  assert.equal(kg % 1000, 0, 'the platform request is a whole number of 1,000 kg rockets (rockets leave only full)');
  assert.deepEqual(m.launch.platformRequest, request);
  assert.deepEqual([m.launch.platformRequestKg, m.launch.cargoRockets, m.launch.starterPackRockets, m.launch.totalRockets, m.launch.wholeRockets], [kg, kg / 1000, 1, kg / 1000 + 1, true]);
  for (const [n, w] of Object.entries(m.launch.weightKg)) assert.equal(w, WEIGHT_KG[n], `${n} weight`);
  assert.deepEqual(evidence.weightsKg, m.launch.weightKg, 'the qualifying run read the same weights from the game');
  const readme = fsSync.readFileSync(new URL(dir + 'README.md', root), 'utf8');
  assert.match(readme, new RegExp(`\\*\\*${kg.toLocaleString('en-US')} kg\\*\\*`));
  assert.match(readme, new RegExp(`\\*\\*${kg / 1000 + 1} launches in all\\.\\*\\*`));
});

test('nine labelled west entrances, one per material; concrete northernmost, circuits southernmost', () => {
  const ports = [...m.inputs, ...m.fluids];
  assert.deepEqual(sorted(ports.map(p => p.item)), sorted(MATERIALS));
  assert.deepEqual(sorted(m.fluids.map(p => p.item)), sorted(FLUIDS));
  assert.equal(new Set(ports.map(p => p.entity)).size, 9);
  assert.equal(new Set(ports.map(p => p.displayEntity)).size, 9);
  assert.equal(entities.filter(e => e.name === 'display-panel').length, 9);
  for (const p of ports) {
    const e = byId.get(p.entity), panel = byId.get(p.displayEntity), fluid = FLUIDS.includes(p.item);
    if (fluid) { assert.equal(e.name, 'pipe'); assert.equal(p.kind, 'fluid'); }
    else { assert.equal(e.name, 'fast-transport-belt'); assert.equal(e.direction, 4); assert.equal(p.direction, 4); assert.equal(p.kind, 'input'); }
    assert.equal(p.externalSide, 'west');
    assert.equal(Math.floor(e.position.x), m.footprint.left, 'entrance on the west edge');
    // perKit comes from the recipe audit of this bill (recomputed from the dump in the regeneration test).
    assert.equal(p.perKit, Math.round(m.recipeAudit.externalPerKit[p.item] ?? 0), `${p.item} perKit follows the recipe audit`);
    if (PLANNING) assert.equal(p.perKit, PLANNING_PER_KIT[p.item], `${p.item}: planning demand (launch-kit.md section 3)`);
    assert(p.perMinute > 0 && Math.round(p.perMinute * 10) === p.perMinute * 10, 'per-minute supply with at most one decimal');
    assert.equal(p.perMinute, supplyRule(p.item, m.recipeAudit.externalPerKit[p.item] ?? 0, m.supplyRule), `${p.item} panel figure follows the supply rule`);
    if (fluid) assert(p.staticStorage > .15 * p.perKit, `${p.item} declares its pipe and box volume`);
    assert.equal(panel.name, 'display-panel'); assert.equal(panel.always_show, true);
    assert.deepEqual(panel.icon, {type: fluid ? 'fluid' : 'item', name: p.item});
    assert.equal(panel.text, `IN: ${p.item}\nWEST · ${fmt(p.perMinute)}/min · ${p.perKit} per kit`);
    assert(Math.hypot(panel.position.x - e.position.x, panel.position.y - e.position.y) <= 4, 'panel within 4 tiles');
    assert(!(Math.floor(panel.position.y) === Math.floor(e.position.y) && panel.position.x < e.position.x), 'panel west of its entrance');
    for (let k = 1; k <= 3; k++) assert(!entities.some(o => Math.floor(o.position.y) === Math.floor(e.position.y) && Math.floor(o.position.x) === Math.floor(e.position.x) - k));
  }
  const rows = ports.map(p => [p.item, Math.floor(p.y)]).sort((a, b) => a[1] - b[1]);
  assert.equal(rows[0][0], 'concrete', 'concrete is the northernmost entrance');
  assert.equal(rows.at(-1)[0], 'electronic-circuit', 'electronic circuits are the southernmost entrance');
  const circuitRow = rows.at(-1)[1];
  assert(!rows.slice(0, -1).some(([, y]) => y >= circuitRow - 5), 'five clear rows north of the circuit entrance');
  // Supplier links (contract section 13).
  const top = m.footprint.top;
  assert.deepEqual(m.supplierLinks.map(l => [l.supplier, l.item, l.copies, l.entranceRowFromTop]), [['concrete-supplier', 'concrete', 1, rows[0][1] - top], ['green-circuits', 'electronic-circuit', 1, circuitRow - top]]);
  for (const l of m.supplierLinks) assert.equal(l.perMinute, ports.find(p => p.item === l.item).perMinute);
});

test('sixteen east passive provider chests, one per item, chest arms on the green cap network', () => {
  assert.deepEqual(sorted(m.outputs.map(p => p.item)), sorted(ITEMS));
  const chests = m.outputs.map(p => byId.get(p.entity));
  assert(chests.every(c => c.name === 'passive-provider-chest' && c.bar === undefined));
  assert.equal(new Set(chests.map(c => c.position.x)).size, 1, 'one column');
  assert.equal(entities.filter(e => e.name === 'passive-provider-chest').length, 16);
  const eastEdge = Math.max(...entities.map(e => e.position.x));
  assert.equal(chests[0].position.x, eastEdge);
  for (const p of m.outputs) {
    assert.equal(p.externalSide, 'east'); assert.equal(p.cap, m.outputCaps[p.item]);
    for (let k = 1; k <= 3; k++) assert(!entities.some(o => Math.floor(o.position.y) === Math.floor(p.y) && Math.floor(o.position.x) === Math.floor(p.x) + k));
  }
  assert.equal(m.stockControl.mode, 'chest-condition');
  const green = network(m.stockControl.combinator, 2);
  const exactOut = new Set(m.stockControl.exactLatches.map(l => l.outputArm));
  for (const p of m.outputs) {
    assert(green.has(`${p.entity}:2`), `chest ${p.item} on the cap network`);
    const arm = byId.get(p.arm);
    assert.equal(arm.override_stack_size, 1);
    assert.deepEqual(arm.filters.map(f => f.name), [p.item]);
    if (exactOut.has(p.arm)) continue;
    assert(green.has(`${p.arm}:2`), `chest arm ${p.item} on the cap network`);
    assert.equal(wiresOf(p.arm, 1).length, 0, 'chest arms are green only');
    const expect = p.item === 'space-platform-foundation' ? {first_signal: {type: 'virtual', name: 'signal-C'}, comparator: '>', constant: 0} : {first_signal: {type: 'item', name: p.item, quality: 'normal'}, comparator: '<', constant: 0};
    assert.deepEqual(arm.control_behavior.circuit_condition, expect);
  }
  for (const g of m.stockControl.capGatedArms) assert(green.has(`${g.entity}:2`), `cap-gated arm ${g.entity} on the cap network`);
});

test('exact latches: each expensive final loads one craft at a time behind a decider, next to its own chest', () => {
  const ls = m.stockControl.exactLatches;
  assert.deepEqual(sorted(ls.map(l => l.product)), sorted(EXACT));
  const green = network(m.stockControl.combinator, 2), ring = network(m.loopControl[0].reader, 1);
  for (const l of ls) {
    const machine = byId.get(l.machine), d = byId.get(l.decider), out = byId.get(l.outputArm), chest = byId.get(l.chest);
    assert.equal(machine.recipe, l.product);
    assert.deepEqual(machine.control_behavior, {read_contents: true});
    const local = network(l.machine, 1);
    assert(!ring.has(`${l.machine}:1`) && !green.has(`${l.machine}:2`));
    assert(local.has(`${l.decider}:1`) && local.has(`${l.decider}:3`) && green.has(`${l.decider}:2`) && wiresOf(l.decider, 4).length === 0);
    const c = d.control_behavior.decider_conditions;
    assert.deepEqual([c.conditions[0].first_signal.name, c.conditions[0].comparator, c.conditions[0].constant ?? 0], [l.product, '≥', 0]);
    assert.deepEqual(sorted(c.outputs.map(o => o.signal.name)), sorted(l.ingredientArms.map(a => a.item)));
    assert(c.outputs.every(o => o.constant === l.block && o.copy_count_from_input === false));
    for (const a of l.ingredientArms) {
      const e = byId.get(a.entity);
      assert(local.has(`${a.entity}:1`) && wiresOf(a.entity, 2).length === 0);
      assert.deepEqual(e.filters.map(f => f.name), [a.item]);
      assert.deepEqual([e.control_behavior.circuit_condition.first_signal.name, e.control_behavior.circuit_condition.comparator, e.control_behavior.circuit_condition.constant], [a.item, '<', a.amount]);
    }
    assert(local.has(`${l.outputArm}:1`) && wiresOf(l.outputArm, 2).length === 0);
    assert.deepEqual(out.control_behavior, {circuit_read_hand_contents: true, circuit_hand_read_mode: 1});
    assert.equal(Math.abs(out.position.y - chest.position.y), 0); assert.equal(chest.position.x - out.position.x, 1);
    assert(Math.abs(machine.position.x - out.position.x) === 2, 'machine, arm, chest on the east edge');
  }
  // The silo's reserve deciders read the ring and block the silo's PU and EE arms.
  const r = m.stockControl.siloReserves;
  assert.deepEqual(sorted(r.deciders.map(d => d.item)), ['electric-engine-unit', 'processing-unit']);
  const siloLocal = network(r.machine, 1);
  for (const d of r.deciders) {
    assert(ring.has(`${d.decider}:1`) && siloLocal.has(`${d.decider}:3`) && wiresOf(d.decider, 2).length === 0 && wiresOf(d.decider, 4).length === 0);
    assert(d.reserve < m.loopControl[0].limits[d.item]);
  }
  // Foundation: the machine crafts while its chest is short or the starter pack still lacks foundation; the
  // starter pack gets its 60 first.
  const fg = m.stockControl.foundationGate, cg = m.stockControl.foundationChestGate, spLocal = network(fg.starterPackMachine, 1);
  for (const id of [fg.decider, cg.decider]) assert(spLocal.has(`${id}:1`) && green.has(`${id}:2`) && green.has(`${id}:4`) && wiresOf(id, 3).length === 0);
  assert.equal(fg.starterPackFoundation, 60);
  assert.equal(byId.get(fg.arm).control_behavior.circuit_condition.first_signal.name, 'signal-F');
  assert.equal(byId.get(cg.arm).control_behavior.circuit_condition.first_signal.name, 'signal-C');
});

test('allowed entities only, arm settings, no circuit or concrete recipe, no modules, machine counts', () => {
  const allowed = new Set(['assembling-machine-2', 'chemical-plant', 'fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'fast-inserter', 'long-handed-inserter', 'bulk-inserter', 'pipe', 'pipe-to-ground', 'passive-provider-chest', 'substation', 'medium-electric-pole', 'constant-combinator', 'arithmetic-combinator', 'decider-combinator', 'display-panel']);
  for (const e of entities) {
    assert(allowed.has(e.name), e.name);
    assert.equal(e.tags?.flight_science_entity, e.entity_number);
    assert(e.quality === undefined || e.quality === 'normal');
    if (e.name === 'chemical-plant') assert.equal(e.recipe, 'battery');
    if (e.recipe) assert.equal(e.items, undefined, 'no modules');
    if (e.name === 'fast-inserter' || e.name === 'long-handed-inserter') assert.equal(e.override_stack_size, 1);
    if (e.name === 'bulk-inserter') assert.equal(e.override_stack_size, 2);
    if (e.name.endsWith('inserter')) {
      assert.equal(e.use_filters, true, `arm ${e.entity_number} has no filters`);
      assert(e.filter_mode === undefined || e.filter_mode === 'whitelist');
      assert(e.filters?.length >= 1 && e.filters.every(f => f.name && (f.comparator ?? '=') === '='));
    }
  }
  assert(entities.filter(e => e.name === 'medium-electric-pole').length <= 4);
  for (const r of ['electronic-circuit', 'concrete', 'rocket-fuel']) assert(!entities.some(e => e.recipe === r), 'no machine makes ' + r);
  const counts = {};
  for (const e of entities.filter(e => e.recipe)) counts[e.recipe] = (counts[e.recipe] || 0) + 1;
  assert.deepEqual(counts, m.machineCounts);
  // Every kit item has its own final machine.
  for (const item of ITEMS) assert.equal(counts[item], 1, item);
  assert.equal(entities.filter(e => e.name === 'chemical-plant').length, 1);
  assert.deepEqual(m.construction, Object.fromEntries([...new Set(entities.map(e => e.name))].sort().map(n => [n, entities.filter(e => e.name === n).length])));
  assert.deepEqual(m.billOfMaterials.items, m.construction, 'bill of materials = every entity by the item that places it (no tiles on the ground)');
  assert.equal(m.ports.filter(p => p.kind === 'power').length, 1);
  assert.equal(byId.get(m.ports.find(p => p.kind === 'power').entity).name, 'substation');
});

test('footprint equals the bounds of the decoded string', () => {
  const size = {'assembling-machine-2': [3, 3], 'chemical-plant': [3, 3], substation: [2, 2], 'fast-splitter': [2, 1], 'arithmetic-combinator': [1, 2], 'decider-combinator': [1, 2]};
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const e of entities) {
    let [w, h] = size[e.name] || [1, 1];
    if ([4, 12].includes(e.direction)) [w, h] = [h, w];
    left = Math.min(left, e.position.x - w / 2); right = Math.max(right, e.position.x + w / 2);
    top = Math.min(top, e.position.y - h / 2); bottom = Math.max(bottom, e.position.y + h / 2);
  }
  assert.deepEqual(m.footprint, {left, top, right, bottom, width: right - left, height: bottom - top});
  assert.equal(m.areaGoal.achievedTiles, m.footprint.width * m.footprint.height);
  assert.deepEqual([m.areaGoal.goalTiles, m.areaGoal.stretchTiles, m.areaGoal.fallbackTiles], [900, 780, 1250]);
  assert(m.areaGoal.achievedTiles <= 1250, 'within the fallback');
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
  // The ring is one closed loop: each tile feeds the next.
  const step = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};
  for (let i = 0; i < ring.loop.length; i++) {
    const a = byId.get(ring.loop[i]), b = byId.get(ring.loop[(i + 1) % ring.loop.length]), [dx, dy] = step[a.direction ?? 0];
    assert.deepEqual([b.position.x - a.position.x, b.position.y - a.position.y], [dx, dy], `ring tile ${a.entity_number} feeds ${b.entity_number}`);
  }
  for (const id of ring.controlled) {
    const e = byId.get(id), c = e.control_behavior.circuit_condition;
    assert(red.has(`${id}:1`), `controlled arm ${id} on the ring`);
    assert.equal(e.control_behavior.circuit_enabled, true);
    assert.equal(c.comparator, '<'); assert.equal(c.constant, ring.limits[c.first_signal.name]);
    assert.deepEqual(e.filters.map(f => f.name), [c.first_signal.name]);
  }
  for (const r of ring.reserveArms) {
    const c = byId.get(r.entity).control_behavior.circuit_condition;
    assert(red.has(`${r.entity}:1`));
    assert.deepEqual([c.first_signal.name, c.comparator, c.constant], [r.item, '>', r.reserve]);
    assert(r.reserve < ring.limits[r.item]);
  }
  for (const g of ring.ringGatedInputs) {
    const c = byId.get(g.entity).control_behavior.circuit_condition;
    assert(red.has(`${g.entity}:1`));
    assert.deepEqual([c.first_signal.name, c.comparator, c.constant], [g.item, '<', ring.limits[g.item]]);
  }
  // The AM1 machine takes its iron one craft at a time on the machines' own red network.
  const ap = m.stockControl.am1Pipeline, ironArm = byId.get(ap.ironArm);
  assert.deepEqual(ironArm.filters.map(f => f.name), ['iron-plate']);
  assert.deepEqual([ironArm.control_behavior.circuit_condition.first_signal.name, ironArm.control_behavior.circuit_condition.comparator, ironArm.control_behavior.circuit_condition.constant], ['iron-plate', '<', ap.ironPerCraft]);
  assert(network(ap.machines[0], 1).has(`${ap.ironArm}:1`) && !red.has(`${ap.ironArm}:1`) && wiresOf(ap.ironArm, 2).length === 0);
  for (const p of m.inputs) for (const id of m.admissions[p.item] || []) assert(ring.controlled.includes(id), `admission ${p.item} not ring-controlled`);
  // The cap network never touches the ring network.
  const green = network(m.stockControl.combinator, 2);
  for (const k of red) assert(!green.has(k));
});

test('native qualification: the report passes and the kit pass formula holds on its numbers', () => {
  assert.equal(report.passed, true, 'report not qualified'); assert.equal(evidence.passed, true);
  assert.equal(m.status, 'qualified');
  assert.equal(evidence.complete, true);
  assert.equal(evidence.importedEntities, entities.length);
  assert.equal(evidence.powered, true); assert.equal(evidence.externalApproachesClear, true); assert.equal(evidence.stockNetworksIsolated, true); assert(evidence.exactRecipeChecks > 0);
  const f = evidence.fill, caps = m.outputCaps;
  assert.equal(f.complete, true); assert(f.kitMinutes <= m.protocol.kitLimitMinutes);
  assert.equal(m.measured.kitMinutes, Math.round(f.kitMinutes * 100) / 100);
  for (const item of ['rocket-silo', 'cargo-landing-pad', 'space-platform-starter-pack']) { assert.equal(f.finishedAtKit[item], caps[item]); assert.equal(f.productionStats[item], caps[item]); }
  for (const item of EXACT) assert.equal(f.finishedAtKit[item], caps[item]);
  for (const [item, cap] of Object.entries(caps)) {
    if (cap > 0) assert(f.finishedAtKit[item] > 0, item);
    else if (item === 'space-platform-foundation' && caps['space-platform-starter-pack'] > 0) assert((f.finishedAtKit[item] ?? 0) <= 60 * caps['space-platform-starter-pack'] + m.productSlack[item], item);
    else assert(!f.finishedAtKit[item], item);
  }
  assert.equal(arr(f.order).length, 16);
  for (const e of evidence.entrances) {
    const p = [...m.inputs, ...m.fluids].find(q => q.item === e.item);
    assert.equal(e.perKit, p.perKit); assert.equal(e.perMinute, p.perMinute);
    assert(e.averageDrawPerMinute <= p.perMinute + 1e-9, `${e.item} drew more than its panel figure`);
    if (!(p.perKit > 0)) continue;
    const ruled = (m.protocol.perKitTolerance - 1) * p.perKit < (p.staticStorage || 0) ? e.consumedPerKit : e.measuredPerKit;
    assert.equal(e.rule, ruled === e.consumedPerKit && (m.protocol.perKitTolerance - 1) * p.perKit < (p.staticStorage || 0) ? 'consumed' : 'accepted', `${e.item} rule`);
    assert(ruled <= m.protocol.perKitTolerance * p.perKit, `${e.item} ${ruled} > ${m.protocol.perKitTolerance} x ${p.perKit}`);
    assert(e.measuredPerKit > 0);
  }
  assert.equal(evidence.entrances.length, 9);
  for (const r of arr(evidence.routes)) assert(arr(r.route).length >= 2, `entrance ${r.item} has a productive route`);
  for (const [name, h, quiet] of [['hold', evidence.hold, m.protocol.holdQuietMinutes], ['long hold', evidence.longHold, m.protocol.longHoldQuietMinutes]]) {
    assert.equal(h.mismatches, 0, name); assert.equal(h.quietMinutes, quiet); assert.deepEqual(h.quietCrafts, {}, name);
    for (const [item, n] of Object.entries(h.slackMax)) assert(n <= m.productSlack[item], `${name} ${item}`);
  }
  for (const x of Object.values(evidence.hold.exact)) assert(!x.crafting && Object.keys(x.output).length === 0);
  const g = evidence.refill;
  assert.equal(g.complete, true); assert(g.minutes <= m.protocol.refillLimitMinutes); assert.equal(g.otherChestMismatches, 0);
  assert.deepEqual(sorted(Object.keys(g.removed)), sorted(Object.keys(m.protocol.refill)));
  for (const [item, n] of Object.entries(g.crafts)) { if (item in g.removed) assert(n >= 1, item); else assert.equal(n, 0, item); }
  assert.equal(g.crafts['cargo-landing-pad'], 1);
  assert.deepEqual(evidence.chestOverCap, {});
  assert.equal(evidence.ringOverall.violations, 0); assert(evidence.ringOverall.maxStock < .9 * m.loopControl[0].capacity);
  assert.equal(evidence.inserterCapacityResearch.fast, 0); assert.equal(evidence.inserterCapacityResearch.bulkUnlockBonus, 1);
});

test('the generator reproduces the published string and manifest byte for byte', {skip: haveDump ? false : 'prototype dump not readable: regeneration needs FACTORIO_RAW'}, async () => {
  const {build, loadBill, kitDemand} = await import('../scripts/launch-kit/generate.mjs');
  const raw = JSON.parse(await fs.readFile(RAW));
  const out = build(raw, loadBill());
  assert.equal(out.code, code);
  assert.equal(out.manifest.blueprintSha256, m.blueprintSha256);
  const strip = ({status, measured, nativeReport, prototypeSha256, ...rest}) => JSON.parse(JSON.stringify(rest));
  assert.deepEqual(strip(out.manifest), strip(m), 'manifest regenerates identically (apart from the report-derived fields)');
  const demand = kitDemand(raw, loadBill()).externalPerKit;
  assert.deepEqual(m.recipeAudit.externalPerKit, demand, 'recipe audit recomputed from the dump');
  for (const p of [...m.inputs, ...m.fluids]) assert.equal(p.perKit, Math.round(demand[p.item] ?? 0), p.item);
  if (PLANNING) for (const [item, n] of Object.entries(PLANNING_PER_KIT)) assert.equal(Math.round(demand[item]), n, item);
});
