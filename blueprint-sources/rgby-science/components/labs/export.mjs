import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateSync, inflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {makeLabAnnex} from '../../../../scripts/rgby-science/labs.mjs';
const directory = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(directory, '../../../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const readJSON = async name => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'));
export async function verifyEvidence() {
  const proof = await readJSON('source-proof.json'), report = await readJSON('native-report.json');
  assert.equal(hash(await fs.readFile(path.join(directory, 'native-report.json'))), proof.reportSha256);
  for (const [name, expected] of Object.entries({...proof.preservedFiles, ...proof.packagingFiles}))
    assert.equal(hash(await fs.readFile(path.join(directory, name))), expected, name);
  const spec = await readJSON('native-spec.json');
  assert.equal(hash('return [====[' + JSON.stringify(spec.builds) + ']====]'), proof.originalPayloadSha256);
  assert.equal(report.passed, true);
  assert.equal(report.gameVersion, spec.gameVersion);
  for (let i = 0; i < spec.builds.length; i++) {
    const b = spec.builds[i], r = report.builds[i];
    assert.equal(hash(JSON.stringify({entities: b.entities, wires: b.wires})), report.entityWireSha256[i]);
    assert.equal(r.passed, true); assert.ok(r.researchProgress > 0);
    assert.deepEqual(r.labs.map(l => l.entity), b.metadata.labs.map(l => l.entity));
    for (const l of r.labs) {
      assert.equal(l.passed, true); assert.equal(l.powered, true); assert.ok(l.workingSamples > 0);
      for (const p of b.ports) for (const item of p.items) assert.equal(l.seen[item], true);
    }
  }
  return {proof, report, spec};
}
/** Emit both variants here; no dependencies, global build, or native run. */
export async function exportLabAnnexes(raw, {prototypeSha256} = {}) {
  const {proof, report, spec} = await verifyEvidence();
  assert.equal(hash(await fs.readFile(path.join(project, proof.generator.path))), proof.generator.sha256,
    'Generator changed since native evidence; obtain new evidence before exporting');
  if (prototypeSha256) assert.equal(prototypeSha256, report.prototypeSha256, 'Prototype dump differs from original native input');
  const manifest = [];
  for (const rows of [1, 2]) {
    const annex = makeLabAnnex(raw, {rows}), index = rows - 1;
    const entityWireSha256 = hash(JSON.stringify({entities: annex.entities, wires: annex.wires}));
    assert.equal(entityWireSha256, report.entityWireSha256[index]);
    const blueprint = {item: 'blueprint', label: `RGB + Utility lab annex — ${annex.labCount} labs`,
      version: Number((2n << 48n) | (77n << 16n)), entities: annex.entities, wires: annex.wires};
    const code = '0' + deflateSync(Buffer.from(JSON.stringify({blueprint}))).toString('base64');
    assert.deepEqual(JSON.parse(inflateSync(Buffer.from(code.slice(1), 'base64'))), {blueprint});
    const file = `labs-${annex.labCount}.txt`;
    const entry = {id: `rgby-labs-${annex.labCount}`, file, blueprintSha256: hash(code), entityWireSha256,
      entityCount: annex.entities.length, footprint: annex.footprint, ports: annex.ports,
      metadata: annex.metadata, powerPoleIds: annex.powerPoleIds,
      generator: proof.generator, prototypeSha256: report.prototypeSha256,
      nativeEvidence: {status: 'passed', report: 'native-report.json', reportSha256: proof.reportSha256,
        sourceProof: 'source-proof.json', spec: 'native-spec.json', reportBuildIndex: index,
        rows, labCount: annex.labCount, gameVersion: report.gameVersion,
        researchSeconds: spec.researchSeconds, simulatedMinutes: spec.reportTick / 3600,
        supply: spec.feedPolicy,
        scope: spec.scope,
        binding: 'Exact generated entities and wires match the directly placed native annex; exported blueprint string was round-trip decoded but was not imported in the native run.'}};
    await fs.writeFile(path.join(directory, file), code + '\n');
    await fs.writeFile(path.join(directory, `labs-${annex.labCount}.manifest.json`), JSON.stringify(entry, null, 2) + '\n');
    manifest.push(entry);
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const rawPath = process.argv[2] || process.env.RGBY_RAW;
  if (!rawPath) throw new Error('Usage: node blueprint-sources/rgby-science/components/labs/export.mjs <data-raw-dump.json>');
  const bytes = await fs.readFile(rawPath);
  console.log(JSON.stringify((await exportLabAnnexes(JSON.parse(bytes), {prototypeSha256: hash(bytes)}))
    .map(m => ({file: m.file, blueprintSha256: m.blueprintSha256, rows: m.metadata.rows, native: m.nativeEvidence.status})), null, 2));
}
