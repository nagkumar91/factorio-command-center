// Tested versions of a design (the manifest "versions" field, scripts/blueprint-versions.mjs) and how the
// library and guide pages publish them. Run after `npm run build` (atlas and guide pages are build outputs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {checkVersions, describeVersion, familyVersions, measuredRates, versionChoices} from '../scripts/blueprint-versions.mjs';

const hash = s => createHash('sha256').update(s.trim()).digest('hex');
const read = p => fs.readFile(p, 'utf8');
const json = async p => JSON.parse(await read(p));
const atlas = await json('site/data/atlas.json');
const NEW = 'da037182c260c5bd1187c8a984fb60c2c961eb6773a41aac8e7c088d21324d85';
const OLD = 'd894c04a5adfcf2a87b54ae8d620aefee303fb195349e33ffc785c3e05d07261';
const MALL = 'blueprint-sources/essentials-mall';

// Every family manifest entry that lists versions, so a second family is covered without editing this file.
async function versionedFamilies() {
  const out = [];
  for (const family of await fs.readdir('blueprint-sources')) {
    const file = path.join('blueprint-sources', family, 'manifest.json');
    let manifest; try { manifest = await json(file); } catch { continue; }
    for (const info of Array.isArray(manifest) ? manifest : [manifest]) if (info?.versions?.length) out.push({family, dir: path.dirname(file), info});
  }
  return out;
}

test('every versions field is newest first, matches its files and names a passing report for each measured string', async () => {
  const families = await versionedFamilies();
  assert.ok(families.some(f => f.family === 'essentials-mall'), 'the essentials mall lists its versions');
  for (const {family, dir, info} of families) {
    const versions = await checkVersions(info, dir);
    assert.ok(versions.length >= 2, family + ': a versions field lists at least two versions');
    assert.equal(versions[0].blueprintSha256, info.blueprintSha256, family + ': first entry is the current string');
    for (const v of versions) {
      assert.match(v.label, /^[A-Za-z][A-Za-z ,'-]*$/, family + ': labels are words');
      for (const key of ['blueprintSha256', 'file', 'report', 'width', 'height', 'tiles', 'machines', 'outputsPerMinute']) assert.ok(v[key] !== undefined, `${family} ${v.label}: ${key}`);
      assert.equal(v.tiles, v.width * v.height);
      assert.equal(hash(await read(path.join(dir, v.file))), v.blueprintSha256, `${family} ${v.label}: string hash`);
      const report = await json(path.join(dir, v.report));
      const build = report.builds.find(b => b.blueprintSha256 === v.blueprintSha256 && b.passed === true);
      assert.ok(build, `${family} ${v.label}: passing native report for this exact string`);
      assert.deepEqual(v.outputsPerMinute.steady, build.outputsPerMinute);
      assert.deepEqual(v.outputsPerMinute.recovery, build.recovery?.outputsPerMinute ?? null);
    }
  }
});

test('the essentials mall: sixteen rows recommended, one column west kept complete and selectable', async () => {
  const [m] = await json(MALL + '/manifest.json');
  assert.deepEqual(m.versions.map(v => [v.label, v.blueprintSha256, v.width, v.height, v.tiles, v.machines]), [
    ['Sixteen rows', NEW, 23, 16, 368, 19],
    ['One column west', OLD, 23, 17, 391, 19],
  ]);
  const [now, before] = m.versions;
  assert.equal(now.file, 'essentials-mall.txt');
  assert.equal(before.file, 'history/one-column-west-d894c04a/essentials-mall.txt');
  // The trade the user accepted: smaller, a little slower on three products.
  assert.deepEqual([now.outputsPerMinute.steady['fast-transport-belt'], before.outputsPerMinute.steady['fast-transport-belt']], [13.55, 14.85]);
  assert.deepEqual([now.outputsPerMinute.recovery['fast-transport-belt'], before.outputsPerMinute.recovery['fast-transport-belt']], [13.2, 14.9]);
  assert.deepEqual([now.outputsPerMinute.steady['assembling-machine-2'], before.outputsPerMinute.steady['assembling-machine-2']], [5.75, 5.25]);
  // The earlier version is complete: its own manifest and a full-protocol report that passed for its string.
  const [oldManifest] = await json(path.join(MALL, before.manifest));
  assert.equal(oldManifest.blueprintSha256, OLD);
  assert.equal(oldManifest.variant, 'one-column-west');
  const oldReport = await json(path.join(MALL, before.report));
  assert.equal(oldReport.passed, true);
  assert.equal(oldReport.short, undefined, 'an exploration report is not a qualification');
  assert.deepEqual([oldReport.protocol.warmupMinutes, oldReport.protocol.measureMinutes, oldReport.protocol.recoveryMinutes], [10, 20, 10]);
});

test('library: the current mall record carries both versions with their own string, size, machines and rates', async () => {
  const [m] = await json(MALL + '/manifest.json');
  const record = atlas.blueprints.find(b => b.blueprintSha256 === NEW);
  assert.ok(record, 'current mall in the library');
  assert.equal(atlas.blueprints.filter(b => b.blueprintSha256 === OLD).length, 0, 'the earlier version is not a second library card');
  const p = record.publication;
  assert.equal(p.version, 2); assert.equal(p.label, 'Sixteen rows'); assert.equal(p.machines, 19);
  assert.deepEqual(p.perMinute, m.versions[0].outputsPerMinute.steady);
  assert.deepEqual(p.recoveryPerMinute, m.versions[0].outputsPerMinute.recovery);
  assert.equal(hash(await read('site/' + p.snapshots.code)), NEW);
  assert.equal(p.history.length, 1);
  const h = p.history[0];
  assert.deepEqual([h.version, h.label, h.blueprintSha256, h.footprint, h.tiles, h.machines], [1, 'One column west', OLD, {width: 23, height: 17}, 391, 19]);
  assert.deepEqual(h.perMinute, m.versions[1].outputsPerMinute.steady);
  assert.deepEqual(h.recoveryPerMinute, m.versions[1].outputsPerMinute.recovery);
  assert.equal(hash(await read('site/' + h.code)), OLD);
  const oldRecord = await json('site/' + h.url);
  assert.equal(oldRecord.id, record.id, 'the version record answers to the current id, as the picker requires');
  assert.equal(oldRecord.blueprintSha256, OLD); assert.equal(hash(oldRecord.code), OLD);
  assert.equal(oldRecord.validation.status, 'game-tested');
  assert.deepEqual(oldRecord.footprint && [oldRecord.footprint.width, oldRecord.footprint.height], [23, 17]);
  assert.deepEqual(oldRecord.measuredOutputsPerMinute, h.perMinute);
  assert.equal((await json('site/' + oldRecord.validation.report)).passed, true);
  // Search fields and coverage stay with the current record.
  assert.deepEqual([...record.products].sort(), Object.keys(m.targets).sort());
  assert.ok(record.analysis.inputs.length && record.section && record.purpose);
  for (const id of record.products) assert.ok(atlas.coverage.items.find(i => i.id === id)?.builds.includes(record.id), id + ' covered by the mall');
});

test('library: every versioned design has a size, machine count and measured or "not measured" rates for each version', () => {
  const versioned = atlas.blueprints.filter(b => b.publication?.version);
  assert.ok(versioned.filter(b => b.publication.history?.length).length >= 11, 'the earlier versioned designs are still there');
  for (const b of versioned) {
    const current = {footprint: b.footprint, machines: b.publication.machines, perMinute: b.publication.perMinute || b.benchmark?.perMinute || b.measuredOutputsPerMinute};
    for (const v of [current, ...(b.publication.history || [])]) {
      assert.ok(v.footprint?.width > 0 && v.footprint?.height > 0, b.id + ': size');
      assert.ok(Number.isInteger(v.machines) && v.machines > 0, b.id + ': machine count');
      assert.ok(v.perMinute === null || v.perMinute === undefined || Object.values(v.perMinute).every(Number.isFinite), b.id + ': rates are numbers or absent (shown as not measured)');
    }
  }
});

test('guide page: both import strings with copy and download, a comparison and which to choose', async () => {
  const [m] = await json(MALL + '/manifest.json');
  const html = await read('site/essentials-mall/index.html');
  assert.match(html, /<section id="versions"><h2>Two tested versions: which to choose<\/h2>/);
  for (const [i, v] of m.versions.entries()) {
    const code = (await read(path.join(MALL, v.file))).trim();
    assert.ok(html.includes(`id="version-code-${i}"`) && html.includes(code.slice(0, 200)), v.label + ' string on the page');
    assert.ok(html.includes(`data-version-copy="${i}"`) && html.includes(`href="${v.file}" download`), v.label + ' copy and download');
    assert.equal(hash(await read(path.join('site/essentials-mall', v.file))), v.blueprintSha256, v.label + ' download file');
    assert.ok(html.includes(`SHA-256 ${v.blueprintSha256}`));
    assert.ok(html.includes(`${v.width} × ${v.height} = ${v.tiles}`));
  }
  assert.ok(html.includes('Sixteen rows</strong> (recommended): smallest: 23 × 16 = 368 tiles'));
  assert.ok(html.includes('One column west</strong>: 23 × 17 = 391 tiles; faster for Fast transport belt (14.85/min)'));
  assert.ok(html.includes('13.55') && html.includes('recovery 14.9'));
  for (const file of ['manifest.json', 'native-report.json']) await fs.access('site/essentials-mall/history/one-column-west-d894c04a/' + file);
  const data = await json('site/essentials/data.json');
  assert.deepEqual(data.published.find(p => p.id === 'essentials-mall').versions.map(v => v.blueprintSha256), [NEW, OLD]);
});

test('helpers: missing reports read as not measured, labels must be words, a stale entry is refused', async () => {
  assert.deepEqual(measuredRates(null, NEW), {steady: null, recovery: null});
  assert.deepEqual(measuredRates({builds: [{blueprintSha256: NEW, passed: false, outputsPerMinute: {a: 1}}]}, NEW), {steady: null, recovery: null});
  const dir = '.cache/test-blueprint-versions';
  await fs.rm(dir, {recursive: true, force: true}); await fs.mkdir(dir, {recursive: true});
  await fs.copyFile(MALL + '/essentials-mall.txt', dir + '/a.txt');
  const v = await describeVersion({familyDir: dir, label: 'Only one', file: 'a.txt', report: 'missing.json', width: 23, height: 16});
  assert.deepEqual(v.outputsPerMinute, {steady: null, recovery: null});
  assert.equal(v.machines, 19);
  await assert.rejects(describeVersion({familyDir: dir, label: 'Version 2', file: 'a.txt', report: 'missing.json', width: 1, height: 1}), /words/);
  await assert.rejects(familyVersions(dir, [{label: 'One', file: 'a.txt', report: 'r.json', width: 1, height: 1}, {label: 'Two', file: 'a.txt', report: 'r.json', width: 1, height: 1}]), /share one string/);
  const [m] = await json(MALL + '/manifest.json');
  await assert.rejects(checkVersions({...m, versions: [{...m.versions[0], machines: 18}, m.versions[1]]}, MALL), /no longer matches/);
  const choices = versionChoices(m.versions, m.products);
  assert.equal(choices[0].recommended, true);
  assert.match(choices[1].text, /faster for fast transport belt \(14\.85\/min\), fast inserter \(18\.55\/min\), electric furnace \(2\.7\/min\)/);
  await fs.rm(dir, {recursive: true, force: true});
});
