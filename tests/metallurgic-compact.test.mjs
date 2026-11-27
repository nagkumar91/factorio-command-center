// Compact metallurgic science pack blueprint (blueprint-sources/metallurgic-compact). Needs only the committed files and the pinned data; no game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sha, readJson, decode, ascii } from '../scripts/vulcanus-circuits/lib.mjs';
import { design } from '../scripts/metallurgic-compact/design.mjs';
import { assemble, audit } from '../scripts/metallurgic-compact/package.mjs';
import { readme } from '../scripts/metallurgic-compact/readme.mjs';
import { layoutSvg } from '../scripts/metallurgic-compact/svg.mjs';
import { HERE, OUT, pins } from '../scripts/metallurgic-compact/generate.mjs';

const { p, slots, prototypeSha256, fluidSlotsSha256 } = await pins();
const code = (await fs.readFile(path.join(OUT, 'blueprint.txt'), 'utf8')).trim();
const [manifest, footprint, report] = await Promise.all(['manifest.json', 'footprint.json', 'native-report.json'].map(f => readJson(path.join(OUT, f)).catch(() => null)));
const bp = decode(code).blueprint, E = bp.entities;

test('recipe in the pinned 2.1.25 data: 3 carbide + 2 plate + 200 molten copper, 10 s, metallurgy, foundry only', () => {
  const r = p.recipes['metallurgic-science-pack'];
  assert.equal(p.gameVersion, '2.1.25');
  assert.deepEqual(r.categories, ['metallurgy']);
  assert.equal(r.energy_required, 10);
  assert.deepEqual(r.ingredients.map(i => `${i.name}:${i.amount}`).sort(), ['molten-copper:200', 'tungsten-carbide:3', 'tungsten-plate:2']);
  assert.deepEqual(p.entities.foundry.crafting_categories, ['metallurgy']);
  assert.ok(!E.some(e => /^assembling-machine/.test(e.name)), 'no assembling machine can craft the metallurgy category');
});

test('the string, manifest and footprint agree: 14 entities, 9 x 6, target at least 15 a minute', () => {
  assert.equal(sha(code), manifest.candidateSha256);
  assert.equal(manifest.prototypeSha256, prototypeSha256);
  assert.equal(manifest.fluidSlotsSha256, fluidSlotsSha256);
  assert.equal(E.length, 14);
  assert.ok(E.length < 110);
  assert.deepEqual([footprint.width, footprint.height, footprint.area, footprint.entities], [9, 6, 54, 14]);
  assert.ok(manifest.target >= 15 && manifest.sizing.maxPacksPerMinute >= manifest.target);
});

test('no belts, modules, beacons or robots; two requester chests with the pinned counts; one provider chest; one substation; five panels', () => {
  const n = name => E.filter(e => e.name === name);
  assert.ok(!E.some(e => /belt|splitter|beacon|roboport|inserter-bulk/.test(e.name)) && !E.some(e => e.items));
  const req = n('requester-chest').map(e => e.request_filters.sections[0].filters[0]).sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(req.map(f => [f.name, f.count]), [['tungsten-carbide', 64], ['tungsten-plate', 43]]);
  assert.equal(n('passive-provider-chest').length, 1);
  assert.equal(n('substation').length, 1);
  assert.equal(n('display-panel').length, 5);
  assert.equal(n('foundry')[0].recipe, 'metallurgic-science-pack');
  for (const e of n('display-panel')) assert.ok(e.always_show && e.text && e.icon);
});

test('static audit passes on the committed string', () => {
  const a = audit(code, manifest, p, slots);
  assert.equal(a.passed, true, JSON.stringify(a.errors));
  assert.ok(a.checksTotal >= 20);
});

test('generator reproduces every committed file from the pinned data', async () => {
  const d = assemble(design(p, slots), p, slots, { prototypeSha256, fluidSlotsSha256, committedCode: code });
  assert.equal(d.code, code);
  const result = audit(d.code, d.manifest, p, slots);
  const proven = report && report.blueprintSha256 === d.hash && report.passed === true ? report : null;
  if (proven) d.manifest.measured = proven.measured;
  assert.deepEqual(JSON.parse(JSON.stringify(d.manifest)), manifest);
  assert.equal(await fs.readFile(path.join(OUT, 'README.md'), 'utf8'), readme(d, result, proven, ascii(d.layout.entities)));
  assert.equal(await fs.readFile(path.join(OUT, 'layout.svg'), 'utf8'), layoutSvg(d, p));
});

test('a native report, if present, is for exactly this string and passed; otherwise the README says static only', async () => {
  const text = await fs.readFile(path.join(OUT, 'README.md'), 'utf8');
  if (report) {
    assert.equal(report.blueprintSha256, sha(code));
    assert.equal(report.passed, true);
    assert.ok(text.includes(sha(code)));
  } else assert.match(text, /static only/i);
});
