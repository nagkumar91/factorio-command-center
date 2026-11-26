// Vulcanus circuit blueprints (blueprint-sources/vulcanus-circuits/<member>): circuits from lava and calcite with foundries inside.
// Needs only the pinned prototypes and fluid slots beside the generators and the committed files; no game and no raw prototype dump.
// The one check against the raw dump runs only when FACTORIO_RAW points at one, and is skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, IDS, published, prototypes, fluidSlots, readJson, json, encode, encodeKeeping, decode, sha, envelope, exists, analyzeFluids, beltGraph, machineBoxes, unusedPorts, allPorts, powerCoverage, insertTiles, tileMap, tileOf, isArm, isBelt, HAND, MACHINES, BELTS, UNDERGROUNDS } from '../scripts/vulcanus-circuits/lib.mjs';
import { auditBlueprint, ALLOWED } from '../scripts/vulcanus-circuits/audit.mjs';
import { summarize } from '../scripts/vulcanus-circuits/summary.mjs';
import { PROTOCOL, scenarios, scenarioNames } from '../scripts/vulcanus-circuits/scenario.mjs';
import { rates } from '../scripts/vulcanus-circuits/parts.mjs';
import { readme } from '../scripts/vulcanus-circuits/readme.mjs';
import { layoutSvg } from '../scripts/vulcanus-circuits/svg.mjs';

const [p, slots] = await Promise.all([prototypes(), fluidSlots()]);
const prototypeSha256 = sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256 = sha(await fs.readFile(path.join(HERE, 'fluid-slots.json')));
const byId = (list, id) => list.find(e => e.entity_number === id);
const TARGETS = { 'electronic-circuits': ['electronic-circuit', 1200], 'advanced-circuits': ['advanced-circuit', 240], 'processing-units': ['processing-unit', 60] };
const INPUTS = { 'electronic-circuits': ['lava', 'calcite'], 'advanced-circuits': ['lava', 'calcite', 'plastic-bar'], 'processing-units': ['lava', 'calcite', 'plastic-bar', 'sulfuric-acid'] };

test('The published members are a prefix of the three requested, in the order they were asked for', () => {
  assert.deepEqual(IDS, Object.keys(TARGETS).slice(0, IDS.length));
  assert.ok(IDS.length >= 1);
});

for (const id of IDS) {
  const dir = published(id);
  const [m, report, status] = await Promise.all([readJson(path.join(dir, 'manifest.json')), readJson(path.join(dir, 'native-report.json')), readJson(path.join(dir, 'native-status.json'))]);
  const code = (await fs.readFile(path.join(dir, 'blueprint.txt'), 'utf8')).trim();
  const bp = decode(code), es = bp.blueprint.entities;
  const { design } = await import(`../scripts/vulcanus-circuits/${id}/design.mjs`);
  const product = m.outputPorts.find(o => o.product), stone = m.outputPorts.find(o => o.byproduct);

  test(`${id}: makes the requested product at the requested rate from the requested inputs`, () => {
    assert.deepEqual([m.product, m.target], TARGETS[id]);
    assert.deepEqual(m.inputPorts.map(x => x.item), INPUTS[id]);
    assert.deepEqual(m.inputPorts.map(x => x.kind), INPUTS[id].map(n => (p.fluids[n] ? 'pipe' : 'belt')));
    assert.equal(product.item, m.product); assert.equal(product.perMinute, m.target); assert.equal(stone.item, 'stone');
    assert.equal(m.outputPorts.length, 2, 'one product exit and one stone exit');
  });

  test(`${id}: passes the static audit (names, collisions, recipes, hand sizes, fluid rules, belt lines, routes, power, ports, panels, capacity)`, () => {
    const audit = auditBlueprint(bp, m, p, slots);
    assert.equal(audit.passed, true, JSON.stringify(audit.errors));
    assert.ok(audit.checksTotal >= 40);
  });

  test(`${id}: string, manifest and pinned data identify the same exact blueprint`, () => {
    assert.equal(sha(code), m.candidateSha256);
    assert.equal(m.prototypeSha256, prototypeSha256);
    assert.equal(m.fluidSlotsSha256, fluidSlotsSha256);
    // Compressed bytes depend on the zlib build, so a fresh encoding is compared by its decoded JSON text.
    assert.equal(JSON.stringify(decode(encode(bp))), JSON.stringify(bp));
    assert.equal(encodeKeeping(bp, code), code);
    const changed = structuredClone(bp); changed.blueprint.entities[0].position.x += 1;
    assert.notEqual(encodeKeeping(changed, code), code, 'a different blueprint never keeps the committed string');
  });

  test(`${id}: the generator reproduces the published string and every published file from the pinned data`, async () => {
    const options = { prototypeSha256, fluidSlotsSha256 };
    const fresh = design(p, slots, options);
    assert.equal(JSON.stringify(decode(fresh.code)), JSON.stringify(bp));
    const d = design(p, slots, { ...options, committedCode: code + '\n' });
    assert.equal(d.code, code); assert.equal(d.hash, m.candidateSha256);
    d.manifest.nativeProtocol = JSON.parse(JSON.stringify(PROTOCOL));
    d.manifest.measured = report.measured;
    assert.equal(json(d.manifest), await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'), 'manifest.json is the generator output');
    const audit = auditBlueprint(d.blueprint, d.manifest, p, slots);
    assert.equal(json(audit), await fs.readFile(path.join(dir, 'static-audit.json'), 'utf8'));
    assert.equal(json(d.footprint), await fs.readFile(path.join(dir, 'footprint.json'), 'utf8'));
    assert.equal(json({ ...d.ports, measured: { generous: report.measured.generous, throttled: report.measured.throttled } }), await fs.readFile(path.join(dir, 'ports.json'), 'utf8'));
    assert.equal(layoutSvg(d, p), await fs.readFile(path.join(dir, 'layout.svg'), 'utf8'));
    const text = await fs.readFile(path.join(dir, 'README.md'), 'utf8');
    assert.ok(text.includes(m.candidateSha256) && text.includes('**Qualified**'));
    assert.equal(text, readme(d, audit, report, p, report), 'README is the generator output');
  });

  test(`${id}: the native report passed every scenario of the protocol for exactly this string`, () => {
    assert.equal(report.passed, true);
    assert.equal(report.exploration, undefined, 'a qualifying report, not an exploration');
    assert.equal(report.blueprintSha256, m.candidateSha256);
    assert.equal(report.prototypeSha256, m.prototypeSha256);
    assert.equal(report.fluidSlotsSha256, m.fluidSlotsSha256);
    assert.equal(report.gameVersion, m.requiredGameVersion);
    assert.deepEqual(report.failures, []);
    const want = scenarios(m);
    assert.deepEqual(Object.keys(report.scenarios), scenarioNames(m), 'every scenario of the protocol, nothing else');
    assert.equal(report.scenarioSha256, sha(JSON.stringify(want)), 'the scenarios the report ran are the scenarios the code defines now');
    assert.deepEqual(report.protocol, JSON.parse(JSON.stringify(PROTOCOL)));
    assert.deepEqual(m.nativeProtocol, JSON.parse(JSON.stringify(PROTOCOL)));
    for (const [name, run] of Object.entries(report.scenarios)) {
      assert.equal(run.passed, true, name);
      assert.deepEqual(run.failures, [], name);
      assert.equal(run.blueprintSha256, m.candidateSha256, name);
      assert.equal(run.scenario, name);
      assert.equal(run.surface.planet, 'vulcanus', name);
      assert.equal(run.surface.pressure, p.planets.vulcanus.surface_properties.pressure, name);
      assert.ok(run.checks.length >= 20 && run.checks.every(c => c.passed), name);
      assert.equal(run.blueprintEntityCount, es.length, name);
      assert.equal(run.sabotage, undefined, name);
      // fluids: nothing foreign, ever; and the watch really ran every tick
      assert.deepEqual(run.fluidFaults, [], `${name} held a foreign fluid`);
      assert.deepEqual(run.portJoins, [], `${name} joined a machine box to another fluid`);
      assert.deepEqual(run.lineFaults, [], `${name} carried a foreign item`);
      assert.ok(run.segmentsWatched >= m.fluidComponents.length, name);
      assert.ok(run.segmentReadings >= run.actualTicks * m.fluidComponents.length * 0.9, `${name}: every segment every tick`);
      assert.equal(run.phases.length, want[name].phases.length, name);
      run.phases.forEach((ph, i) => assert.equal(ph.name, want[name].phases[i].name));
      // every wait for the rate ended by reaching it
      for (const ph of run.phases.filter(ph => ph.mode === 'until_rate')) assert.equal(ph.endedBy, 'rate', `${name}/${ph.name}`);
      if (want[name].place) { assert.equal(run.placement.name, want[name].place); assert.equal(run.placement.mirrored, want[name].place.startsWith('flip')); assert.equal(run.placedBlueprintSha256 === m.candidateSha256, !want[name].place.startsWith('flip')); } else assert.equal(run.placement, undefined);
      if (want[name].build) { assert.equal(run.construction.order, want[name].build); assert.equal(run.construction.entities, es.length); } else assert.equal(run.construction, undefined);
      assert.deepEqual(run.bonus, want[name].bonus || { stack: 0, bulk: 1 }, `${name}: research`);
    }
    assert.deepEqual(report.technologyClosure, m.technologyClosure);
    assert.equal(status.candidateSha256, m.candidateSha256);
    assert.equal(status.status, 'passed');
    assert.equal(JSON.stringify(summarize(report.scenarios, m)), JSON.stringify(report.measured), 'the summary is computed from the scenario reports');
    assert.deepEqual(m.measured, report.measured);
  });

  test(`${id}: 95% of the target or more over 30 minutes, both generous and at the panel figures; draws and stone measured`, () => {
    const floor = 0.95 * m.target;
    for (const mode of ['generous', 'throttled']) {
      const v = report.measured[mode];
      assert.equal(v.measuredMinutes, 30);
      assert.ok(v.productPerMinute >= floor, `${mode}: ${v.productPerMinute}`);
      assert.ok(v.stonePerMinute > 0);
      const steady = report.scenarios['rate:' + mode].phases[1], warm = report.scenarios['rate:' + mode].phases[0];
      assert.equal(warm.ticks, 15 * 3600); assert.equal(steady.ticks, 30 * 3600);
      // every machine crafts; with exactly the panel supply a member may declare spare machines that then stand idle
      const idle = mode === 'throttled' ? m.sizing.idleAtPanelSupply : null;
      for (const [name, g] of Object.entries(steady.groups)) if (!idle || idle.group !== name) assert.ok(g.least > 0, `${mode}: every ${name} machine crafted`);
      // (the declared spares must be a known group with machines to spare, and they do craft when more is offered: the generous pass above)
      if (idle) assert.ok(m.groups[idle.group].length - idle.machines >= m.sizing.machines.find(row => row.recipe === m.machines.find(v => v.group === idle.group).recipe).craftsNeeded / m.sizing.machines.find(row => row.recipe === m.machines.find(v => v.group === idle.group).recipe).craftsEach);
      assert.equal(scenarios(m)['rate:' + mode].phases[1].expect.allMachinesCraft, !idle);
    }
    const th = report.scenarios['rate:throttled'];
    for (const x of m.inputPorts) {
      for (const ph of th.phases) assert.ok(ph.fedPerMinute[x.id].phase <= x.perMinute * 1.0001 + 0.01, `${x.item}: never offered more than the panel figure`);
      assert.equal(scenarios(m)['rate:throttled'].phases[1].feed[x.id], x.perMinute, 'the throttled run is offered exactly the panel figure');
      assert.ok(Math.abs(report.measured.throttled.drawPerMinute[x.item] - x.perMinute) <= 0.02 * x.perMinute, `${x.item}: took ${report.measured.throttled.drawPerMinute[x.item]}, panel ${x.perMinute}`);
      assert.equal(byId(es, x.panel).text, `IN: ${x.item} ${x.perMinute}/min`);
    }
    assert.equal(byId(es, product.panel).text, `OUT: ${m.product} ${m.target}/min`);
    assert.equal(byId(es, stone.panel).text, `OUT: stone ${stone.perMinute}/min`);
    assert.ok(Math.abs(report.measured.throttled.stonePerMinute - stone.perMinute) <= 0.03 * stone.perMinute, 'stone at the target is the panel figure');
  });

  test(`${id}: both exits blocked stop it cleanly and it restarts; outage, late inputs, late power and the unconnected stone exit recover`, () => {
    const b = report.scenarios.blocks.phases, ph = n => b.find(x => x.name === n);
    assert.equal(ph('product exit blocked').stoppedCleanly, true);
    assert.equal(ph('product exit blocked').drawnPerMinute[product.id].measured, 0);
    assert.equal(ph('stone exit blocked').stoppedCleanly, true);
    assert.equal(ph('stone exit blocked').drawnPerMinute[stone.id].phase, 0);
    for (const n of ['product exit released', 'stone exit released', 'recovery after the outage']) assert.equal(ph(n).endedBy, 'rate');
    assert.equal(ph('five-minute outage of every input').ticks, 5 * 3600);
    for (const x of m.inputPorts) {
      const cold = report.scenarios['cold:' + x.item].phases;
      assert.equal(cold[0].ticks, 20 * 3600);
      assert.equal(cold[0].fedPerMinute[x.id].phase, 0, 'withheld');
      assert.equal(cold[0].drawnPerMinute[product.id].phase, 0, 'nothing can be made without ' + x.item);
      assert.equal(cold[1].endedBy, 'rate');
    }
    const late = report.scenarios['late:stone-exit'].phases;
    assert.equal(late[0].ticks, 60 * 3600); assert.equal(late[0].stoppedCleanly, true); assert.equal(late[1].endedBy, 'rate');
    assert.equal(report.scenarios['late:power'].phases[0].drawnPerMinute[product.id].phase, 0);
    for (const run of Object.values(report.scenarios)) { const hold = run.phases.find(x => x.name === 'ten measured minutes at the rate'); if (hold) assert.ok(hold.drawnPerMinute[product.id].measured >= 0.95 * m.target); }
  });

  test(`${id}: counts, footprint and ports recomputed from the decoded string`, () => {
    const env = envelope(es, p);
    assert.deepEqual([env.width, env.height, env.area], [m.footprint.width, m.footprint.height, m.footprint.area]);
    assert.deepEqual([env.bounds.left, env.bounds.top], [0, 0]);
    const counts = {}; for (const e of es) counts[e.name] = (counts[e.name] || 0) + 1;
    assert.deepEqual(Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))), m.footprint.counts);
    assert.equal(es.length, m.footprint.entities);
    assert.ok(es.every(e => ALLOWED.includes(e.name)), 'only allowed entities');
    assert.ok(es.every(e => !e.items && !e.control_behavior && (!e.quality || e.quality === 'normal')), 'no modules, no circuit control, normal quality');
    for (const e of es.filter(isArm)) assert.equal(e.override_stack_size, HAND[e.name], 'hand size pinned');
    const machines = es.filter(e => MACHINES.includes(e.name));
    assert.ok(machines.every(e => p.recipes[e.recipe]), 'every machine has a fixed recipe');
    assert.deepEqual(machines.map(e => [e.entity_number, e.recipe]), m.machines.map(x => [x.entity, x.recipe]));
    // machine counts are what the arithmetic of the pinned recipes needs, and the README's table is that arithmetic
    const r = rates(p), need = r.demand({ ec: m.sizing.target['electronic-circuit'] || 0, ac: m.sizing.target['advanced-circuit'] || 0, pu: m.sizing.target['processing-unit'] || 0 });
    const have = n => machines.filter(e => e.recipe === n).length;
    assert.ok(have('casting-copper-cable') * r.foundryCrafts('casting-copper-cable') >= need.cableCrafts);
    assert.ok(have('casting-iron') * r.foundryCrafts('casting-iron') >= need.plateCrafts);
    assert.ok(have('molten-copper-from-lava') * r.foundryCrafts('molten-copper-from-lava') >= need.copperLavaCrafts);
    assert.ok(have('molten-iron-from-lava') * r.foundryCrafts('molten-iron-from-lava') >= need.ironLavaCrafts);
    assert.ok(have('electronic-circuit') * r.am3Crafts('electronic-circuit') >= need.ec);
    assert.equal(r.prod, 1.5);
    // ports: on the edge they name, belts running the right way, panels beside them
    const at = tileMap(es);
    for (const x of [...m.inputPorts, ...m.outputPorts]) {
      const e = byId(es, x.entity), t = tileOf(e);
      assert.deepEqual(t, x.tile);
      assert.ok(x.side === 'west' ? t.x === 0 : x.side === 'east' ? t.x === env.width - 1 : x.side === 'north' ? t.y === 0 : t.y === env.height - 1, `${x.id} on the ${x.side} edge`);
      assert.ok(!at.has(x.externalContact.x + ',' + x.externalContact.y));
      assert.equal(x.kind === 'pipe' ? e.name === 'pipe' : BELTS.includes(e.name), true);
    }
    assert.equal(byId(es, m.power.entry).name, 'substation');
    assert.equal(byId(es, m.power.panel).text, m.power.label);
    assert.deepEqual(powerCoverage(es, p).unpowered, []);
    assert.ok(es.every(e => !/pole/.test(e.name)));
  });

  test(`${id}: the fluid rules recomputed statically from the string`, () => {
    const fl = analyzeFluids(es, slots);
    assert.deepEqual(fl.problems, []);
    assert.deepEqual(fl.stray, [], 'no unused port faces a pipe opening');
    assert.ok(fl.components.every(c => c.fluids.length === 1), 'one fluid per pipe network');
    const fluidOf = new Map(); for (const c of fl.components) for (const n of c.entities) fluidOf.set(n, c.fluids[0]);
    const at = tileMap(es);
    for (const e of es.filter(e => MACHINES.includes(e.name))) {
      const touching = new Set();
      for (const b of machineBoxes(e, slots)) {
        let joined = 0;
        for (const en of b.ends) { const o = at.get(en.target.x + ',' + en.target.y); if (o && fluidOf.has(o.entity_number) && (o.name === 'pipe' || o.name === 'pipe-to-ground')) { if (o.name === 'pipe' || (o.direction || 0) === (en.side + 8) % 16) { assert.equal(fluidOf.get(o.entity_number), b.fluid, `#${e.entity_number}: a ${b.fluid} port on a ${fluidOf.get(o.entity_number)} pipe`); joined++; touching.add(b.fluid + ':' + b.flow); } } }
        assert.ok(joined >= 1, `#${e.entity_number}: ${b.fluid} box on no pipe`);
      }
      // every port of the prototype is either used by the recipe or faces nothing that opens toward it
      for (const q of unusedPorts(e, slots)) { const o = at.get(q.target.x + ',' + q.target.y); assert.ok(!o || !(o.name === 'pipe' || (o.name === 'pipe-to-ground' && (o.direction || 0) === (q.side + 8) % 16)), `#${e.entity_number}: unused port faces a pipe`); }
      assert.equal(allPorts(e).length, e.name === 'foundry' ? 4 : 2);
    }
    assert.ok(!es.some(e => /pump|tank/.test(e.name)), 'no pump or tank is needed');
    const g = beltGraph(es, p);
    assert.deepEqual(g.problems, []);
    assert.deepEqual(g.lines, m.beltLines.map(l => l.entities));
  });

  test(`${id}: the index registers it only from its own passing native report`, async () => {
    const text = await fs.readFile(new URL('../scripts/index-designed-blueprints.mjs', import.meta.url), 'utf8');
    assert.ok(text.includes(`'blueprint-sources/vulcanus-circuits/'+id`) && text.includes(`'${id}'`));
    assert.ok(text.includes(`proof.passed!==true||proof.blueprintSha256!==m.candidateSha256){console.warn('Not registered (no exact-hash passing native report): vulcanus-circuits/'+id);continue;}`));
    assert.ok(text.includes("category:'Supplies · Vulcanus circuits'"));
  });

  const mutate = (name, edit, expected) => test(`${id}: audit rejects ${name}`, () => {
    const copy = structuredClone(bp);
    edit(copy.blueprint.entities, copy);
    const audit = auditBlueprint(copy, m, p, slots);
    assert.equal(audit.passed, false);
    assert.ok(audit.errors.some(e => e.includes(expected)), JSON.stringify(audit.errors));
  });
  const next = list => Math.max(...list.map(e => e.entity_number)) + 1;
  const ironPipe = list => list.find(e => e.name === 'pipe' && m.fluidOf[e.entity_number] === 'molten-iron');
  mutate('a missing substation', list => { list.splice(list.findIndex(e => e.name === 'substation' && e.entity_number !== m.power.entry), 1); }, 'Substation');
  mutate('a reversed entrance belt', list => { const b = byId(list, m.inputPorts.find(x => x.kind === 'belt').entity); b.direction = ((b.direction || 0) + 8) % 16; }, 'run inward');
  mutate('a turned arm', list => { const a = list.find(isArm); a.direction = ((a.direction || 0) + 8) % 16; }, 'takes from and drops on');
  mutate('an arm without its pinned hand size', list => { delete list.find(e => e.name === 'bulk-inserter').override_stack_size; }, 'hand size pinned');
  mutate('an altered panel text', list => { byId(list, m.inputPorts[0].panel).text = 'IN: nothing'; }, 'display panel');
  mutate('a machine with another recipe', list => { const e = list.find(e => e.recipe === 'casting-iron'); e.recipe = 'casting-copper-cable'; }, 'Machines are exactly');
  mutate('a removed machine', list => { list.splice(list.findIndex(e => e.recipe === 'casting-copper-cable'), 1); }, 'Machines are exactly');
  mutate('a module in a machine', list => { list.find(e => e.name === 'foundry').items = [{ id: { name: 'speed-module' }, items: { in_inventory: [{ inventory: 4, stack: 0 }] } }]; }, 'No modules');
  mutate('a stack inserter', list => { list.find(isArm).name = 'stack-inserter'; }, 'entity names');
  mutate('a beacon-free rule broken by quality', list => { list.find(e => e.name === 'foundry').quality = 'legendary'; }, 'No modules');
  mutate('a missing pipe in the molten iron network', list => { list.splice(list.indexOf(ironPipe(list)), 1); }, 'networks recomputed from the string');
  mutate('molten iron pipes joined to molten copper pipes', list => {
    // the metal column of the lava block holds molten copper above the belt row and molten iron below it: one pipe on the tile between joins them
    const at = tileMap(list), copper = list.filter(e => e.name === 'pipe' && m.fluidOf[e.entity_number] === 'molten-copper').map(tileOf);
    const gap = copper.map(t => ({ x: t.x, y: t.y + 1 })).find(t => { const below = at.get(t.x + ',' + (t.y + 1)); return below && m.fluidOf[below.entity_number] === 'molten-iron'; });
    assert.ok(gap, 'the layout has a tile between the two metals');
    const old = at.get(gap.x + ',' + gap.y);
    if (old) list.splice(list.indexOf(old), 1);
    list.push({ entity_number: next(list), name: 'pipe', position: { x: gap.x + 0.5, y: gap.y + 0.5 } });
  }, 'Fluid model');
  mutate('a pipe laid against an unused port of a casting foundry', list => {
    const f = list.find(e => e.recipe === 'casting-copper-cable'), q = unusedPorts(f, slots)[0], at = tileMap(list), old = at.get(q.target.x + ',' + q.target.y);
    if (old) list.splice(list.indexOf(old), 1);
    list.push({ entity_number: next(list), name: 'pipe', position: { x: q.target.x + 0.5, y: q.target.y + 0.5 } });
  }, 'does not use faces no pipe opening');
  mutate('a mirrored foundry', list => { list.find(e => e.name === 'foundry').mirror = true; }, 'mirrored');
}

test('The fluid-slot table is the probe of every machine, recipe and direction the family uses, and the port geometry contains it', () => {
  assert.equal(slots.gameVersion, p.gameVersion);
  assert.deepEqual(slots.notes, [], 'no box without a filter joined a pipe');
  for (const [key, inert] of Object.entries(slots.unfilteredBoxesInert)) assert.equal(inert, true, key);
  for (const [key, table] of Object.entries(slots.slots)) {
    const [name, recipe] = key.split('|');
    const noFluid = Object.values(table).every(b => b.length === 0);
    assert.equal(Object.keys(table).length, noFluid ? 2 : 8, key);   // a machine without a fluid recipe has no ports to turn and reports north
    for (const [dk, boxes] of Object.entries(table)) {
      const e = { name, recipe, position: { x: 0.5, y: 0.5 }, direction: Number(/\d+/.exec(dk)[0]), ...(dk.endsWith('M') ? { mirror: true } : {}) };
      const all = new Set(allPorts(e).map(q => q.target.x + ',' + q.target.y));
      for (const b of boxes) { assert.ok(b.fluid && b.targets.length >= 1 && b.joined.every(Boolean), key); for (const t of b.targets) assert.ok(all.has(t.join(',')), `${key} ${dk}: ${t}`); }
      // a one-fluid foundry recipe uses both ports of a side as one box
      if (name === 'foundry') for (const b of boxes) assert.equal(b.targets.length, 2, key);
      assert.equal(unusedPorts(e, slots).length, allPorts(e).length - boxes.reduce((n, b) => n + b.targets.length, 0));
    }
  }
  // the fault that stuck a released blueprint, as measured: leftover fluid goes into the empty pipe on the other port when the fed pipe is full
  const full = slots.leftover.filter(v => v.fedPipeKeptFull);
  assert.equal(full.length, 2);
  for (const v of full) assert.ok(Object.values(v.emptyPipeAfter)[0] > 0 && Object.keys(v.emptyPipeBefore).length === 0, v.recipe);
  // a lava foundry gives its metal by both output ports
  const both = slots.output.find(v => v.pipesOnBothOutputPorts);
  assert.ok(Object.values(both.westPipe)[0] > 0 && Object.values(both.eastPipe)[0] > 0);
  assert.deepEqual(slots.research, { technologies: slots.research.technologies, inserterStackSizeBonus: 0, bulkInserterCapacityBonus: 1 });
});

test('Recipe arithmetic from the pinned prototypes: the three targets and what each needs', () => {
  const r = rates(p);
  assert.equal(r.prod, 1.5);
  assert.deepEqual([r.cablePerFoundry, r.platePerFoundry, r.moltenPerLavaFoundry], [720, 225, 5625]);
  const ec = r.demand({ ec: 1200 }), ac = r.demand({ ac: 240 }), pu = r.demand({ pu: 60 });
  assert.deepEqual([ec.cable, ec.plate, Math.round(ec.lava), Math.round(ec.stone)], [3600, 1200, 18667, 680]);
  assert.deepEqual([ac.ec, ac.cable, ac.plate, ac.plastic], [480, 2400, 480, 480]);
  assert.deepEqual([pu.ec, pu.ac, pu.cable, pu.plate, pu.plastic, pu.acid], [1440, 120, 4800, 1440, 240, 300]);
  assert.deepEqual(p.rocket, { processingUnitsPerPart: 1, partsPerRocket: 50 });
});

test('Pinned prototypes equal the raw dump (runs only when FACTORIO_RAW is set and readable)', async t => {
  const rawPath = process.env.FACTORIO_RAW;
  if (!rawPath || !(await exists(rawPath))) return t.skip('no FACTORIO_RAW dump');
  const dump = JSON.parse(await fs.readFile(rawPath, 'utf8'));
  assert.equal(sha(await fs.readFile(rawPath)), p.provenance.rawSha256);
  for (const [name, r] of Object.entries(p.recipes)) {
    assert.deepEqual(r.ingredients, dump.recipe[name].ingredients.map(v => ({ type: v.type, name: v.name, amount: v.amount })), name);
    assert.deepEqual(r.results, dump.recipe[name].results.map(v => ({ type: v.type, name: v.name, amount: v.amount })), name);
    assert.equal(r.energy_required, dump.recipe[name].energy_required ?? 0.5, name);
  }
  assert.equal(dump['assembling-machine'].foundry.effect_receiver.base_effect.productivity, 0.5);
  assert.equal(dump['assembling-machine'].foundry.crafting_speed, p.entities.foundry.crafting_speed);
});

test('Other published blueprint folders are untouched by this family (checked through git when available)', async t => {
  const { execFileSync } = await import('node:child_process');
  let out;
  try { out = execFileSync('git', ['status', '--porcelain', '--', 'blueprint-sources/requested-malls', 'blueprint-sources/vulcanus-supplies', 'blueprint-sources/green-circuits', 'blueprint-sources/advanced-circuits', 'blueprint-sources/processing-units'], { encoding: 'utf8' }); } catch { return t.skip('no git checkout'); }
  assert.equal(out.trim(), '');
});
