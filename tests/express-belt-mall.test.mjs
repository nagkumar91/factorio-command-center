// Express belt mall (blueprint-sources/requested-malls/express-belt-mall).
// Needs only the pinned prototypes beside the generator and the committed files; no game and no raw prototype dump.
// The one check against the raw dump runs only when FACTORIO_RAW points at one, and is skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PUBLISHED, HERE, PROTOCOL, prototypes, readJson, encode, encodeKeeping, decode, sha, envelope, exists } from '../scripts/requested-malls/express-belt-mall/lib.mjs';
import { design, PRODUCTS, OUTPUT_CAPS, RING_CAPS } from '../scripts/requested-malls/express-belt-mall/design.mjs';
import { auditBlueprint } from '../scripts/requested-malls/express-belt-mall/audit.mjs';
import { readme, loadExplorations } from '../scripts/requested-malls/express-belt-mall/readme.mjs';

const [p, m, report, status] = await Promise.all([prototypes(), readJson(path.join(PUBLISHED, 'manifest.json')), readJson(path.join(PUBLISHED, 'native-report.json')), readJson(path.join(PUBLISHED, 'native-status.json'))]);
const code = (await fs.readFile(path.join(PUBLISHED, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code);
const es = bp.blueprint.entities;

test('Candidate passes recipe, route, power, circuit, output and lane-room audits', () => assert.equal(auditBlueprint(bp, m, p).passed, true));

test('Candidate text and metadata identify the same exact blueprint', () => {
  assert.equal(sha(code), m.candidateSha256);
  // Compressed bytes depend on the zlib build, so a fresh encoding is compared by its decoded JSON text.
  assert.equal(JSON.stringify(decode(encode(bp))), JSON.stringify(bp));
  assert.equal(encodeKeeping(bp, code), code);
  const changed = structuredClone(bp); changed.blueprint.entities[0].position.x += 1;
  assert.notEqual(encodeKeeping(changed, code), code, 'a different blueprint never keeps the committed string');
});

test('The generator reproduces the published string, manifest and README from the pinned prototypes', async () => {
  const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))) };
  const fresh = design(p, options);
  assert.equal(JSON.stringify(decode(fresh.code)), JSON.stringify(bp));
  const d = design(p, { ...options, committedCode: code + '\n' });
  assert.equal(d.code, code);
  assert.equal(d.hash, m.candidateSha256);
  const { measured, requiredInputsPerMinute, outputsPerMinute, ...rest } = m;
  assert.deepEqual(JSON.parse(JSON.stringify(d.manifest)), rest);
  assert.deepEqual(measured, report.measured);
  assert.deepEqual(outputsPerMinute, report.measured.outputsPerMinute);
  assert.deepEqual(requiredInputsPerMinute, report.measured.inputsPerMinute);
  const text = await fs.readFile(path.join(PUBLISHED, 'README.md'), 'utf8');
  assert.ok(text.includes(m.candidateSha256));
  assert.ok(text.includes('IN: iron-plate') && text.includes('IN: lubricant'));
  for (const name of PRODUCTS) assert.ok(text.includes(report.measured.outputsPerMinute[name].toFixed(2)), 'README states the measured ' + name + ' rate');
  assert.equal(text, readme(d, auditBlueprint(d.blueprint, d.manifest, p), report, p, report, await loadExplorations(PUBLISHED)), 'README is the generator output');
});


test('Native report passed the qualifying protocol for exactly this string', () => {
  assert.equal(report.passed, true);
  assert.equal(report.blueprintSha256, m.candidateSha256);
  assert.equal(Object.keys(report.failures).length, 0, 'an empty Lua table is written as {}');
  assert.deepEqual(m.nativeProtocol, { ...PROTOCOL });
  { const { targetRate, ...rest } = PROTOCOL; assert.deepEqual(report.protocol, rest, 'the report keeps every protocol field (a nil target rate is absent in Lua)'); }
  assert.equal(report.actualTicks, PROTOCOL.stockFillTicks + PROTOCOL.refillTicks + PROTOCOL.outageTicks + PROTOCOL.recoveryTicks + PROTOCOL.warmupTicks + PROTOCOL.measureTicks);
  assert.equal(report.prototypeSha256, m.prototypeSha256);
  assert.equal(report.gameVersion, m.requiredGameVersion);
  for (const phase of report.phases.filter(ph => !ph.phase.startsWith('input outage')))
    for (const name of PRODUCTS) assert.equal(phase.stock[name], OUTPUT_CAPS[name], `${phase.phase} ${name}`);
  assert.equal(status.candidateSha256, m.candidateSha256);
  assert.equal(status.status, 'passed');
  // The three recorded fill times, one per product, and the one-stack caps are the stack sizes of the prototypes.
  for (const name of PRODUCTS) { assert.equal(OUTPUT_CAPS[name], p.items[name].stack_size); assert.ok(report.stockTiming.find(t => t.phase === 1).reached[name] > 0); }
});

test('Measured rates, draw, ring load and machine activity back every published figure', () => {
  const meas = report.measured;
  for (const name of PRODUCTS) assert.ok(meas.outputsPerMinute[name] > 0, name);
  for (const name of ['iron-plate', 'copper-plate', 'plastic-bar', 'lubricant']) assert.ok(meas.inputsPerMinute[name] > 0, name);
  assert.ok(report.ringPeakTotal <= m.ringLimits.bound);
  assert.equal(report.ringBound, m.ringLimits.bound);
  assert.equal(report.machines.length, 15);
  for (const mm of report.machines) assert.ok(mm.measuredProducts > 0, mm.recipe);
  for (const name of PRODUCTS) assert.ok(Object.values(meas.perFiveMinuteSlice[name]).every(n => n > 0), 'no five-minute slice without ' + name);
  assert.ok(report.checks.every(c => c.passed) && report.checks.length > 150);
});

test('Interface: three one-stack provider chests, belt entrances on the west edge, one lubricant pipe, one power label', () => {
  assert.deepEqual(m.products, PRODUCTS);
  assert.deepEqual(m.outputCaps, OUTPUT_CAPS);
  const chests = es.filter(e => e.name === 'passive-provider-chest');
  assert.equal(chests.length, 3);
  assert.ok(chests.every(c => c.bar === 1));
  assert.deepEqual(m.outputs.map(o => o.item), PRODUCTS);
  for (const o of m.outputs) assert.equal(es.find(e => e.entity_number === o.panel).text, `OUT: ${o.item}`);
  const west = Math.min(...es.map(e => e.position.x));
  const solids = m.inputPorts.filter(v => v.kind === 'item');
  assert.deepEqual(solids.map(v => v.item), ['iron-plate', 'copper-plate', 'plastic-bar']);
  for (const v of solids) { assert.equal(v.entrance.x, west); assert.equal(v.side, 'west'); assert.equal(es.find(e => e.entity_number === v.panel).text, `IN: ${v.item}`); }
  const lub = m.inputPorts.filter(v => v.kind === 'fluid');
  assert.equal(lub.length, 1); assert.equal(lub[0].item, 'lubricant');
  assert.equal(es.find(e => e.entity_number === lub[0].panel).text, 'IN: lubricant');
  assert.equal(es.find(e => e.entity_number === m.power.panel).text, m.power.label);
  // No steel, no gears or circuits from outside: the only solid inputs are the three.
  assert.deepEqual(m.inputPorts.map(v => v.item).sort(), ['copper-plate', 'iron-plate', 'lubricant', 'plastic-bar']);
});

test('Machines: assembling machine 2 only, one per recipe, three for gears, nothing above the yellow and red tier below express', () => {
  const machines = es.filter(e => e.name === 'assembling-machine-2').map(e => e.recipe).sort();
  assert.deepEqual(machines, ['advanced-circuit', 'copper-cable', 'electronic-circuit', 'express-splitter', 'express-transport-belt', 'express-underground-belt', 'fast-splitter', 'fast-transport-belt', 'fast-underground-belt', 'iron-gear-wheel', 'iron-gear-wheel', 'iron-gear-wheel', 'splitter', 'transport-belt', 'underground-belt']);
  assert.ok(es.every(e => !e.items && !(e.name === 'assembling-machine-2' && e.recipe === 'steel-plate')));
  assert.deepEqual([...new Set(es.map(e => e.name))].sort(), ['assembling-machine-2', 'display-panel', 'fast-inserter', 'fast-transport-belt', 'fast-underground-belt', 'medium-electric-pole', 'passive-provider-chest', 'pipe']);
});

test('Published size is the entity envelope; ring caps leave lane room', () => {
  const measured = envelope(es, p);
  assert.deepEqual([measured.width, measured.height, measured.area], [m.footprint.width, m.footprint.height, m.footprint.area]);
  assert.deepEqual(report.footprint.counts, m.footprint.counts);
  assert.deepEqual(m.ringCaps, RING_CAPS);
  const total = Object.values(m.ringCaps).reduce((a, b) => a + b, 0) + es.filter(e => e.control_behavior?.circuit_enabled).length;
  assert.ok(total <= m.ringLimits.bound);
});

test('Exploration reports kept beside the blueprint are for this string and never hand-edited summaries', async () => {
  for (const { file, report: r } of await loadExplorations(PUBLISHED)) {
    assert.equal(r.exploration, true, file);
    assert.equal(r.blueprintSha256, m.candidateSha256, file);
    assert.equal(r.runnerSha256 && r.nativeControlSha256 && r.configurationSha256 && true, true, file);
    assert.ok(r.ringPeakTotal <= m.ringLimits.bound, file);
  }
});

test('Pinned prototypes equal the raw dump (runs only when FACTORIO_RAW is set and readable)', async t => {
  const rawPath = process.env.FACTORIO_RAW;
  if (!rawPath || !(await exists(rawPath))) return t.skip('no FACTORIO_RAW dump');
  const dump = JSON.parse(await fs.readFile(rawPath, 'utf8'));
  for (const [name, r] of Object.entries(p.recipes)) {
    assert.deepEqual(r.ingredients, dump.recipe[name].ingredients, name);
    assert.deepEqual(r.results, dump.recipe[name].results, name);
  }
});

test('The index registers the mall only from its own passing native report', async () => {
  const text = await fs.readFile(new URL('../scripts/index-designed-blueprints.mjs', import.meta.url), 'utf8');
  assert.ok(text.includes("blueprint-sources/requested-malls/express-belt-mall"));
  assert.ok(text.includes("proof.blueprintSha256!==m.candidateSha256"));
});

function reject(name, mutate, expected) {
  test(name, () => {
    const copy = structuredClone(bp);
    mutate(copy.blueprint.entities, copy);
    const audit = auditBlueprint(copy, m, p);
    assert.equal(audit.passed, false);
    assert.ok(audit.errors.some(e => e.includes(expected)), JSON.stringify(audit.errors));
  });
}
const byId = (list, id) => list.find(e => e.entity_number === id);
const chestOf = item => m.outputs.find(o => o.item === item);
reject('Reject a reversed ring belt that breaks circulation', list => { const b = byId(list, m.loop[10]); b.direction = (b.direction + 8) % 16; }, 'closed loop');
reject('Reject a second filter on a collector (a foreign item could reach a chest)', list => { byId(list, chestOf('express-splitter').collector).filters.push({ index: 2, name: 'iron-plate', quality: 'normal', comparator: '=' }); }, 'its own product');
reject('Reject a chest without its one-slot limit', list => { delete byId(list, chestOf('express-transport-belt').chest).bar; }, 'three passive-provider chests');
reject('Reject a collector that is circuit controlled', list => { byId(list, chestOf('express-underground-belt').collector).control_behavior = { circuit_enabled: true }; }, 'its own product');
reject('Reject a lost direct gear hand-off', list => { byId(list, m.directTransfers[0].inserter).control_behavior = { circuit_enabled: true }; }, 'always on');
reject('Reject a disconnected lubricant stub', list => { byId(list, m.pipes.at(-1)).position.y += 1; }, 'lubricant');
reject('Reject disabled whole-ring sensing', list => { byId(list, m.reader).control_behavior.circuit_contents_read_mode = 1; }, 'whole-ring contents reader');
reject('Reject erased circuit and copper wiring', list => { for (const e of list) e.wires = []; }, 'share one green circuit');
reject('Reject physically overlapping machines', list => { const a = list.filter(e => e.name === 'assembling-machine-2'); a[1].position = { ...a[0].position }; }, 'collision boxes');
reject('Reject a steel recipe slipped into the candidate', list => { list.find(e => e.name === 'assembling-machine-2' && e.recipe === 'splitter').recipe = 'steel-plate'; }, 'Exactly the 15 machines');
reject('Reject an uncapped entrance arm', list => { delete byId(list, m.inputPorts.find(v => v.item === 'plastic-bar').ringArm).control_behavior; }, 'IN-3');
reject('Reject a lost display label', list => { byId(list, m.inputPorts[1].panel).text = 'IN: gold'; }, 'IN-2');
reject('Reject a published size that is not the entity envelope', list => { list.find(e => e.name === 'display-panel').position.y -= 4; }, 'Published size');
reject('Reject a hand size above one', list => { list.find(e => e.name === 'fast-inserter').override_stack_size = 2; }, 'hand size one');
