import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from '../scripts/blueprints.mjs';
const root = path.resolve('blueprint-sources/flight-factories');
let manifest;
try { manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'))); } catch (e) { if (e.code !== 'ENOENT') throw e; }

test('coverage keeps unsupported items and all three variants without claiming native completion', {skip: !manifest}, () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(new Set(manifest.items.map(i => `${i.type}:${i.id}`)).size, manifest.items.length);
  for (const item of manifest.items) assert.deepEqual(Object.keys(item.variants).sort(), ['intermediary', 'mixed', 'raw']);
  assert.equal(manifest.summary.allComplete, false);
  assert.equal(manifest.summary.totalVariants, manifest.items.length * 3);
  if (manifest.scope === 'all-installed-items-and-fluids') assert.equal(manifest.summary.includedGoods, manifest.summary.installedGoods);
});

test('saved blueprint hashes, input display links and native boundaries match the actual artifacts', {skip: !manifest}, async () => {
  const specs = JSON.parse(await fs.readFile(path.join(root, 'native-test-specs.json')));
  const byId = new Map(specs.factories.map(s => [s.id, s]));
  for (const item of manifest.items) for (const variant of Object.values(item.variants)) if (variant.blueprintFile) {
    const code = await fs.readFile(path.join(root, variant.blueprintFile), 'utf8');
    assert.equal(createHash('sha256').update(code).digest('hex'), variant.blueprintSha256, `${variant.id}: exact file hash`);
    const bp = decodeBlueprint(code).blueprint, spec = byId.get(variant.id), entities = new Map(bp.entities.map(e => [e.entity_number, e]));
    assert.equal(spec.blueprintSha256, variant.blueprintSha256);
    assert.equal(spec.prototypeDumpSha256, manifest.prototypeSha256);
    assert.equal(spec.expectedEntityCount, entities.size);
    assert.equal(spec.boundaryMode, spec.materialSeeds?.length ? `${variant.mode}+startup` : variant.mode);
    for (const p of spec.inputs) {
      assert.equal(entities.get(p.entityNumber)?.tags.flight_input, `${p.type}:${p.name}`);
      const display = entities.get(p.displayEntity);
      assert.equal(display?.name, 'display-panel'); assert.equal(display.tags.flight_display_input, p.entityNumber);
      assert.deepEqual(display.icon, {type: p.type, name: p.name}); assert.match(display.text, /IN /);
      if (p.type === 'fluid') assert.ok(!bp.entities.some(e => e.position.x === p.fixturePosition.x && e.position.y === p.fixturePosition.y), 'fluid fixture stays external');
      if (p.type === 'fluid') for (const e of bp.entities.filter(e => ['pipe', 'pipe-to-ground', 'storage-tank'].includes(e.name))) {
        if (Math.abs(e.position.x - p.fixturePosition.x) + Math.abs(e.position.y - p.fixturePosition.y) === 1) assert.equal(e.entity_number, p.entityNumber, 'fixture cannot touch an undeclared saved pipe');
      }
    }
    for (const p of spec.outputs) assert.equal(entities.get(p.entityNumber)?.tags.flight_output, `${p.type}:${p.name}`);
    for (const e of bp.entities.filter(e => e.tags.flight_output_buffer_slots)) assert.ok(e.bar <= 48, 'intermediate buffers are bounded');
    for (const e of bp.entities.filter(e => e.tags.flight_intermediate_limit)) {
      const wire = bp.wires.find(w => w[0] === e.entity_number && w[1] === 1 && w[3] === 1);
      assert.ok(wire, 'intermediate limit is saved as a circuit connection');
      const inserter = entities.get(wire[2]); assert.equal(inserter.control_behavior.circuit_condition.constant, e.tags.flight_intermediate_limit);
      assert.equal(inserter.control_behavior.circuit_condition.comparator, '<');
    }
    for (const seed of spec.materialSeeds || []) {
      assert.equal(entities.get(seed.entityNumber)?.tags.flight_startup, `item:${seed.name}`);
      assert.equal(entities.get(seed.entityNumber)?.name, 'steel-chest', 'initial seeds are isolated from target logistic requests');
      assert.equal(spec.rawOnly, false);
      const exporters = bp.entities.filter(e => e.control_behavior?.circuit_condition?.first_signal?.name === seed.name && e.control_behavior.circuit_condition.comparator === '>');
      assert.ok(exporters.length, 'a seed cycle exports only above its retained reserve');
      for (const exporter of exporters) { assert.equal(exporter.override_stack_size, 1); assert.equal(exporter.use_filters, true); assert.equal(exporter.filters[0].name, seed.name); }
    }
    const target = spec.outputs.find(p => p.role === 'target'); assert.equal(target.name, item.id); assert.equal(target.type, item.type);
    assert.equal(bp.entities.some(e => e.name === 'infinity-pipe' || e.name === 'electric-energy-interface'), false);
  }
});
