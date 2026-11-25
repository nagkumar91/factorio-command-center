// Assembling-machine-3 supply mall (blueprint-sources/requested-malls/assembler-3-mall).
// Needs only the pinned prototypes beside the generator; no game and no raw prototype dump. The one test that compares the pin with a
// native dump of an installed game is skipped when no dump is at hand (CI has no Factorio).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PUBLISHED, HERE, PROTOCOL, prototypes, readJson, encode, encodeKeeping, decode, sha, envelope } from '../scripts/requested-malls/assembler-3-mall/lib.mjs';
import { design, PRODUCTS, RECIPES, rawPerProduct } from '../scripts/requested-malls/assembler-3-mall/design.mjs';
import { auditBlueprint } from '../scripts/requested-malls/assembler-3-mall/audit.mjs';
import { comparePinned } from '../scripts/requested-malls/assembler-3-mall/pinned-check.mjs';

const [p, m, report, status] = await Promise.all([
  prototypes(), readJson(path.join(PUBLISHED, 'manifest.json')), readJson(path.join(PUBLISHED, 'native-report.json')), readJson(path.join(PUBLISHED, 'native-status.json'))]);
const code = (await fs.readFile(path.join(PUBLISHED, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code);
const es = bp.blueprint.entities;

test('Candidate passes recipe, route, power, circuit and output-chest audits', () => assert.equal(auditBlueprint(bp, m, p).passed, true));

test('Candidate text and metadata identify the same exact blueprint', () => {
  assert.equal(sha(code), m.candidateSha256);
  // Compressed bytes depend on the zlib build, so a fresh encoding is compared by its decoded JSON text.
  assert.equal(JSON.stringify(decode(encode(bp))), JSON.stringify(bp));
  assert.equal(encodeKeeping(bp, code), code);
  const changed = structuredClone(bp); changed.blueprint.entities[0].position.x += 1;
  assert.notEqual(encodeKeeping(changed, code), code, 'a different blueprint never keeps the committed string');
});

test('The generator reproduces the published string and manifest from the pinned prototypes', async () => {
  const options = { arrangement: m.arrangement, prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))) };
  // From nothing: the fresh string encodes exactly the committed blueprint (its bytes depend on the zlib build).
  const fresh = design(p, options);
  assert.equal(JSON.stringify(decode(fresh.code)), JSON.stringify(bp));
  // Beside the committed string (as in a checkout): byte-identical string and SHA-256 on any machine.
  const d = design(p, { ...options, committedCode: code + '\n' });
  assert.equal(d.code, code);
  assert.equal(d.hash, m.candidateSha256);
  const { arrangementTrial, ...published } = m;
  assert.deepEqual(JSON.parse(JSON.stringify(d.manifest)), published);
  assert.equal(arrangementTrial[m.arrangement].published, true);
});

test('Native report passed the full protocol for exactly this string', () => {
  assert.equal(report.passed, true);
  assert.equal(report.fatal, false);
  assert.equal(report.blueprintSha256, m.candidateSha256);
  assert.deepEqual(report.failures, {});
  assert.deepEqual(m.nativeProtocol, { ...PROTOCOL });
  const { targetRate, ...protocolInReport } = PROTOCOL; // the game's JSON writer leaves null out
  assert.equal(targetRate, null);
  assert.deepEqual(report.protocol, protocolInReport);
  assert.deepEqual(report.sequence, PROTOCOL.sequence);
  assert.equal(status.candidateSha256, m.candidateSha256);
  assert.equal(status.status, 'passed');
  assert.equal(report.checks.every(c => c.passed), true);
  // the installed game ran on the very records the design was checked against
  assert.deepEqual(report.installedGame.mismatches, []);
  assert.equal(report.installedGame.pinnedVersion, '2.1.24');
});

test('Native evidence: both chests fill to exactly 50 from empty, after collection and after an outage', () => {
  for (const key of ['fill from empty', 'refill after collection', 'recovery after outage']) {
    const t = report.fillTimes[key];
    assert.ok(t && !t.timedOut && t.am2 > 0 && t.am3 > 0 && t.both <= t.limit, key + ' ' + JSON.stringify(t));
  }
  assert.equal(report.fillTimes['fill from empty'].limit, 864000, 'four game hours were allowed');
  assert.deepEqual(report.chestPeak, { 'assembling-machine-2': 50, 'assembling-machine-3': 50 });
  assert.ok(report.checks.some(c => c.name === 'provider chest holds exactly one stack of assembling-machine-3' && c.passed));
  assert.ok(report.checks.some(c => c.name === 'provider chests never held a foreign item' && c.passed));
  assert.ok(report.ringPeakTotal <= m.laneRoom.maxCirculating);
  for (const [item, peak] of Object.entries(report.ringPeaks)) assert.ok(peak <= m.ringCaps[item] + 1, `${item} ${peak}`);
  const hold = report.checks.filter(c => c.name.startsWith('hold at full stock'));
  assert.equal(hold.length, 2); assert.ok(hold.every(c => c.passed));
  assert.ok(report.checks.find(c => c.name.startsWith('production resumes'))?.passed);
});

test('Native rates are measured, not invented: the normal-use window is the published figure', () => {
  const normal = report.windows['rate-am3'], both = report.windows['rate-both'];
  assert.equal(normal.minutes, 30); assert.equal(both.minutes, 30);
  // Measured window figures are internally consistent: items removed over 30 minutes.
  assert.ok(Math.abs(normal.removedPerMinute['assembling-machine-3'] - normal.removed['assembling-machine-3'] / 30) < 1e-9);
  assert.ok(normal.removedPerMinute['assembling-machine-3'] > 0.25 && normal.removedPerMinute['assembling-machine-3'] <= 0.42, 'one advanced-circuit machine allows 0.375 a minute');
  assert.equal(normal.removed['assembling-machine-2'], 0, 'the AM2 chest was left alone in normal use');
  for (const recipe of RECIPES) assert.ok(normal.crafts[recipe] > 0, 'machine crafted in the normal-use window: ' + recipe);
  for (const recipe of RECIPES) assert.ok(report.crafts[recipe] > 0, 'machine crafted during the run: ' + recipe);
  // inputs drawn match the recipe bill at the measured rate (the belts hold some slack, so a few percent)
  const bill = rawPerProduct(p);
  const crafts = normal.craftsPerMinute['assembling-machine-3'];
  for (const [item, perMachine] of Object.entries(bill)) assert.ok(Math.abs(normal.inputsPerMinute[item] - perMachine * crafts) <= 0.15 * perMachine * crafts + 1, `${item} ${normal.inputsPerMinute[item]} vs ${perMachine * crafts}`);
});

test('Interface: four labelled belt entrances on the west edge, plastic included', () => {
  const { bounds } = m.footprint;
  assert.deepEqual(m.inputPorts.map(v => v.item).sort(), ['copper-plate', 'iron-plate', 'plastic-bar', 'steel-plate']);
  for (const port of m.inputPorts) {
    const first = es.find(e => e.entity_number === port.stub[0]);
    assert.equal(Math.floor(first.position.x), bounds.left, port.id + ' starts on the west edge');
    assert.equal(first.direction, 4, port.id + ' faces east');
    assert.equal(port.externalContact.x, first.position.x - 1);
    const sign = es.find(e => e.entity_number === port.panel);
    assert.equal(sign.text, `IN: ${port.item}`); assert.equal(sign.icon.name, port.item); assert.equal(sign.always_show, true);
  }
  assert.equal(m.power.label.startsWith('POWER:'), true);
});

test('Interface: assembling machine 2 only, no modules or beacons, one provider chest per product, one slot each', () => {
  assert.equal(es.filter(e => e.name === 'assembling-machine-2').length, 8);
  assert.deepEqual(es.filter(e => e.recipe).map(e => e.recipe).sort(), [...RECIPES].sort());
  assert.ok(!es.some(e => e.items || ['assembling-machine-3', 'beacon', 'steel-chest', 'iron-chest'].includes(e.name)));
  const chests = es.filter(e => e.name === 'passive-provider-chest');
  assert.equal(chests.length, 2);
  assert.ok(chests.every(e => e.bar === 1));
  assert.deepEqual(m.outputs.map(o => o.item), PRODUCTS);
  assert.deepEqual(m.outputs.map(o => es.find(e => e.entity_number === o.panel).text), ['OUT: assembling machine 2', 'OUT: assembling machine 3']);
  assert.deepEqual(new Set(es.filter(e => e.name === 'fast-inserter').map(e => e.override_stack_size)), new Set([1]));
});

test('Assembling machine 3 costs 130 iron, 148 copper, 4 steel and 40 plastic, from the recipes', () => {
  assert.deepEqual(rawPerProduct(p), { 'iron-plate': 130, 'copper-plate': 148, 'steel-plate': 4, 'plastic-bar': 40 });
  assert.deepEqual(p.recipes['assembling-machine-3'].ingredients.map(v => [v.name, v.amount]), [['assembling-machine-2', 2], ['speed-module', 4]]);
});

test('Published size is the smaller arrangement and equals the entity envelope', () => {
  const measured = envelope(es, p);
  assert.deepEqual([measured.width, measured.height, measured.area], [m.footprint.width, m.footprint.height, m.footprint.area]);
  assert.deepEqual(measured.bounds, m.footprint.bounds);
  const areas = Object.entries(m.arrangementTrial);
  assert.equal(areas.length, 2);
  assert.equal(m.arrangementTrial[m.arrangement].area, measured.area);
  assert.ok(areas.every(([name, t]) => name === m.arrangement || t.area >= measured.area), 'the published arrangement has the smallest envelope');
  assert.deepEqual(report.footprint.counts, m.footprint.counts);
  // The other arrangement still builds and passes the static audit from the same data.
  const other = Object.keys(m.arrangementTrial).find(n => n !== m.arrangement);
  const trial = design(p, { arrangement: other, prototypeSha256: m.prototypeSha256 });
  assert.equal(auditBlueprint(trial.blueprint, trial.manifest, p).passed, true);
  assert.equal(trial.footprint.area, m.arrangementTrial[other].area);
});

test('Prototype pin: matching dump passes, a changed recipe or box is found', () => {
  // A dump made from the pin itself (what a native dump would hold) matches; changing any pinned value is caught.
  const dump = { recipe: structuredClone(p.recipes), technology: structuredClone(p.technologies) };
  for (const e of Object.values(p.entities)) (dump[e.type] ||= {})[e.name] = structuredClone(e);
  for (const i of Object.values(p.items)) (dump.item ||= {})[i.name] = structuredClone(i);
  assert.deepEqual(comparePinned(p, dump).mismatches, []);
  dump.recipe['speed-module'].ingredients[0].amount = 6;
  dump['logistic-container']['passive-provider-chest'].inventory_size = 1;
  dump.item['assembling-machine-3'].stack_size = 20;
  assert.deepEqual(comparePinned(p, dump).mismatches, ['recipe speed-module: ingredients', 'entity passive-provider-chest: inventory_size', 'item assembling-machine-3: stack_size']);
});

// Compares the pin with a native dump of an installed game; skipped when none is available (set FACTORIO_DUMP to a data-raw-dump.json).
const dumpPath = process.env.FACTORIO_DUMP || '/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const haveDump = await fs.access(dumpPath).then(() => true, () => false);
test('Prototype pin equals the native 2.1.24 dump it was made from', { skip: haveDump ? false : 'no game dump here (CI has no Factorio)' }, async () => {
  const dump = JSON.parse(await fs.readFile(dumpPath, 'utf8'));
  assert.equal(sha(await fs.readFile(dumpPath)), p.provenance.rawSha256);
  assert.deepEqual(comparePinned(p, dump).mismatches, []);
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
const am2Chest = m.outputs[0], am3Chest = m.outputs[1];
reject('Reject a reversed ring belt that breaks circulation', list => { const b = byId(list, m.loop[10]); b.direction = (b.direction + 8) % 16; }, 'closed loop');
reject('Reject a reversed entrance arm', list => { const a = byId(list, m.inputPorts[0].inserter); a.direction = (a.direction + 8) % 16; }, 'IN-1');
reject('Reject a mislabelled entrance panel', list => { list.find(e => e.name === 'display-panel' && e.text === 'IN: iron-plate').text = 'IN: iron'; }, 'IN-1 display panel');
reject('Reject a hand-off that is circuit controlled', list => { byId(list, m.directTransfers[0].inserter).control_behavior = { circuit_enabled: true }; }, 'always on');
reject('Reject a second filter on the AM3 chest arm (a foreign item could enter)', list => { byId(list, am3Chest.producerArm).filters.push({ index: 2, name: 'assembling-machine-2', quality: 'normal', comparator: '=' }); }, 'filtered to assembling-machine-3');
reject('Reject a chest arm turned off by a circuit condition', list => { byId(list, am2Chest.producerArm).control_behavior = { circuit_enabled: true }; }, 'always on');
reject('Reject a provider chest without the one-slot limit', list => { delete byId(list, am3Chest.chest).bar; }, 'one slot');
reject('Reject a second inserter dropping into a provider chest', list => {
  const spare = byId(list, m.directTransfers[0].inserter), chest = byId(list, am2Chest.chest);
  spare.position = { x: chest.position.x, y: chest.position.y - 1 }; spare.direction = 0;
}, 'ever drops into its chest');
reject('Reject the chest on a circuit', list => { byId(list, am2Chest.chest).wires = [[am2Chest.chest, 2, m.reader, 2]]; }, 'circuit never touches a chest');
reject('Reject an AM3 machine that is not fed assembling machines 2 from the chest', list => { byId(list, am2Chest.takenBy.inserter).direction = (byId(list, am2Chest.takenBy.inserter).direction + 8) % 16; }, 'takes assembling machine 2');
reject('Reject a lost ingredient arm of the circuit machine', list => { byId(list, m.cells.find(c => c.recipe === 'electronic-circuit').inputArms[0]).filters[0].name = 'copper-plate'; }, 'electronic-circuit');
reject('Reject disabled whole-ring sensing', list => { byId(list, m.reader).control_behavior.circuit_contents_read_mode = 1; }, 'whole-ring contents reader');
reject('Reject erased circuit and copper wiring', list => { for (const e of list) e.wires = []; }, 'share one green circuit');
reject('Reject physically overlapping machines', list => { const a = list.filter(e => e.name === 'assembling-machine-2'); a[1].position = { ...a[0].position }; }, 'collision boxes');
reject('Reject an assembling machine 3 slipped into the design', list => { list.find(e => e.name === 'assembling-machine-2').name = 'assembling-machine-3'; }, 'construction entity names');
reject('Reject a published size that is not the entity envelope', list => { list.find(e => e.name === 'display-panel').position.y -= 3; }, 'Published size');
