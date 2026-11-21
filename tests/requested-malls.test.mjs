// Blue-tier on-demand mall (blueprint-sources/requested-malls/blue-tier-mall).
// Needs only the pinned prototypes beside the generator; no game and no raw prototype dump.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PUBLISHED, HERE, PROTOCOL, prototypes, readJson, encode, encodeKeeping, decode, sha, envelope } from '../scripts/requested-malls/blue-tier-mall/lib.mjs';
import { design, PRODUCTS, STOCK_CAPS, INPUT_ORDER } from '../scripts/requested-malls/blue-tier-mall/design.mjs';
import { auditBlueprint } from '../scripts/requested-malls/blue-tier-mall/audit.mjs';

const FIRST = path.join(PUBLISHED, 'history/four-row-ring-6762edae');
const [p, m, reference, report, firstManifest, firstReport, firstRerun] = await Promise.all([
  prototypes(), readJson(path.join(PUBLISHED, 'manifest.json')), readJson(path.join(HERE, 'reference-review.json')),
  readJson(path.join(PUBLISHED, 'native-report.json')), readJson(path.join(FIRST, 'manifest.json')),
  readJson(path.join(FIRST, '2026-11-13T15-42-43-336Z-native-report.json')), readJson(path.join(FIRST, 'rerun-native-report.json'))]);
const code = (await fs.readFile(path.join(PUBLISHED, 'blueprint.txt'), 'utf8')).trim();
const bp = decode(code);
const firstCode = (await fs.readFile(path.join(FIRST, 'blueprint.txt'), 'utf8')).trim();

test('Candidate passes recipe, route, power and stock audits', () => assert.equal(auditBlueprint(bp, m, p).passed, true));

test('Candidate text and metadata identify the same exact blueprint', () => {
  assert.equal(sha(code), m.candidateSha256);
  // Compressed bytes depend on the zlib build, so a fresh encoding is compared by its decoded JSON text.
  assert.equal(JSON.stringify(decode(encode(bp))), JSON.stringify(bp));
  assert.equal(encodeKeeping(bp, code), code);
  const changed = structuredClone(bp); changed.blueprint.entities[0].position.x += 1;
  assert.notEqual(encodeKeeping(changed, code), code, 'a different blueprint never keeps the committed string');
});

test('The generator reproduces the published string and manifest from the pinned prototypes', async () => {
  const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))) };
  // From nothing: the fresh string encodes exactly the committed blueprint (its bytes depend on the zlib build).
  const fresh = design(p, reference, options);
  assert.equal(JSON.stringify(decode(fresh.code)), JSON.stringify(bp));
  // Beside the committed string (as in a checkout): byte-identical string, SHA-256 and manifest on any machine.
  const d = design(p, reference, { ...options, committedCode: code + '\n' });
  assert.equal(d.code, code);
  assert.equal(d.hash, m.candidateSha256);
  assert.deepEqual(JSON.parse(JSON.stringify(d.manifest)), m);
  const { candidateSha256, ...rest } = JSON.parse(JSON.stringify(fresh.manifest)), { candidateSha256: _, ...committedRest } = m;
  assert.deepEqual(rest, committedRest, 'only the string bytes can differ from a fresh run');
});

test('Native report passed the qualifying protocol for exactly this string', async () => {
  assert.equal(report.passed, true);
  assert.equal(report.blueprintSha256, m.candidateSha256);
  assert.deepEqual(report.failures, {});
  assert.deepEqual(m.nativeProtocol, { ...PROTOCOL });
  assert.deepEqual(firstManifest.nativeProtocol, { ...PROTOCOL }, 'never weaker than the protocol that qualified the first version');
  assert.equal(report.actualTicks, PROTOCOL.stockFillTicks + PROTOCOL.refillTicks + PROTOCOL.outageTicks + PROTOCOL.recoveryTicks);
  for (const phase of report.phases.filter(ph => !ph.phase.startsWith('input outage')))
    for (const name of PRODUCTS) assert.ok(phase.stock[name] >= STOCK_CAPS[name] && phase.stock[name] <= STOCK_CAPS[name] + 1, `${phase.phase} ${name} ${phase.stock[name]}`);
  const status = await readJson(path.join(PUBLISHED, 'native-status.json'));
  assert.equal(status.candidateSha256, m.candidateSha256);
  assert.equal(status.status, 'passed');
});

test('Same interface as the first version: products, caps, entrances in order and on the same sides', () => {
  assert.deepEqual(m.products, firstManifest.products);
  assert.deepEqual(m.stockCaps, firstManifest.stockCaps);
  assert.deepEqual(m.products, PRODUCTS);
  const face = ports => ports.map(port => [port.id, port.item, port.kind, port.side, port.flow]);
  assert.deepEqual(face(m.inputPorts), face(firstManifest.inputPorts));
  assert.deepEqual(m.inputPorts.filter(port => port.kind === 'item').map(port => port.item), INPUT_ORDER);
  assert.equal(m.output.label, firstManifest.output.label);
  assert.deepEqual(m.power.externalPolePosition, firstManifest.power.externalPolePosition);
  // Inputs on the north edge, lubricant on the west edge, the provider in the east end.
  const { bounds } = m.footprint;
  for (const port of m.inputPorts.filter(port => port.kind === 'item')) assert.equal(Math.floor(port.position.y), bounds.top);
  assert.equal(Math.floor(m.inputPorts.find(port => port.item === 'lubricant').position.x), bounds.left);
  assert.ok(m.output.position.x > (bounds.left + bounds.right) / 2);
});

test('Same entity kinds as the first version and no higher tiers', () => {
  const kinds = entities => [...new Set(entities.map(e => e.name))].sort();
  const first = decode(firstCode);
  assert.equal(sha(firstCode), firstManifest.candidateSha256);
  assert.deepEqual(kinds(bp.blueprint.entities), kinds(first.blueprint.entities));
  assert.equal(bp.blueprint.entities.filter(e => e.name === 'assembling-machine-2').length, 7);
});

test('24 x 9 = 216 tiles, at least 5% smaller than the first 33 x 13 = 429', () => {
  const measured = envelope(bp.blueprint.entities, p);
  assert.deepEqual([measured.width, measured.height, measured.area], [24, 9, 216]);
  assert.deepEqual([m.footprint.width, m.footprint.height, m.footprint.area], [24, 9, 216]);
  assert.deepEqual([firstManifest.footprint.width, firstManifest.footprint.height, firstManifest.footprint.area], [33, 13, 429]);
  assert.ok(measured.area <= 0.95 * firstManifest.footprint.area);
  assert.deepEqual(report.footprint.counts, m.footprint.counts);
});

test('Fills no slower than the first version measured with the same harness', () => {
  assert.equal(firstReport.blueprintSha256, firstManifest.candidateSha256);
  assert.equal(firstRerun.blueprintSha256, firstManifest.candidateSha256);
  assert.equal(firstRerun.passed, true);
  for (const phase of [1, 2, 4]) {
    const now = Object.values(report.stockTiming).find(t => t.phase === phase);
    const before = Object.values(firstRerun.stockTiming).find(t => t.phase === phase);
    assert.ok(now.allTick && before.allTick && now.allTick <= before.allTick, `phase ${phase}: ${now.allTick} vs ${before.allTick}`);
  }
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
const byId = (es, id) => es.find(e => e.entity_number === id);
reject('Reject a reversed belt that breaks circulation', es => { const b = byId(es, m.loop[10]); b.direction = (b.direction + 8) % 16; }, 'directed unbranched closed loop');
reject('Reject a reversed ingredient arm despite unchanged recipe coverage', es => { const a = byId(es, m.inputPorts[0].inserter); a.direction = (a.direction + 8) % 16; }, 'IN-1');
reject('Reject lost intermediate transfer when output stock is full', es => { byId(es, m.directTransfers[0].inserter).control_behavior = { circuit_enabled: true }; }, 'direct intermediate ignores');
reject('Reject a disconnected lubricant tap', es => { byId(es, m.pipes.at(-1)).position.y += 1; }, 'lubricant');
reject('Reject a lost product in the shared collector filters', es => { byId(es, m.output.collectors[1]).filters.pop(); }, 'Collector filters');
reject('Reject disabled whole-loop sensing', es => { byId(es, m.reader).control_behavior.circuit_contents_read_mode = 1; }, 'whole-loop contents reader');
reject('Reject erased circuit and copper wiring', es => { for (const e of es) e.wires = []; }, 'share one green circuit');
reject('Reject physically overlapping machines', es => { const a = es.filter(e => e.name === 'assembling-machine-2'); a[1].position = { ...a[0].position }; }, 'collision boxes');
reject('Reject stack-tier production slipped into the candidate', es => { es.find(e => e.name === 'assembling-machine-2').recipe = 'stack-inserter'; }, 'Exactly seven requested recipes');
reject('Reject a published size that is not the entity envelope', es => { es.find(e => e.name === 'display-panel').position.y -= 3; }, 'Published size');
