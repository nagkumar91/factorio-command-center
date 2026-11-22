// Tested versions of a design (the manifest "versions" field, scripts/blueprint-versions.mjs) and how the
// library and guide pages publish them. Run after `npm run build` (atlas and guide pages are build outputs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {checkVersions, describeVersion, familyVersions, measuredRates, measuredOperation, versionChoices, versionsAreAlternatives, acceptedInputs, versionsSection} from '../scripts/blueprint-versions.mjs';

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

test('flight robots: pair swapped (96 x 18) recommended, the 106 x 18 version kept complete, one library card, shared guide section', async () => {
  const ROBOTS = 'blueprint-sources/flight-robots', CUR = '120a56b5bf85f2f8b50414f0575e28cc7e036fbb13f83cbd7209539d298ca5d6', PREV = '30edbea366140a650cf0aedaaef9ef6e35f8d52c9d72161b3c935173b2374386';
  const [m] = await json(ROBOTS + '/manifest.json');
  assert.deepEqual(m.versions.map(v => [v.label, v.blueprintSha256, v.width, v.height, v.tiles, v.machines]), [
    ['Smaller, pair swapped', CUR, 96, 18, 1728, 48],
    ['Earlier, one more assembler', PREV, 106, 18, 1908, 49],
  ]);
  const [now, before] = m.versions;
  assert.deepEqual(now.outputsPerMinute.steady, {'construction-robot': 10.1, 'logistic-robot': 10.133333333333333, roboport: 1});
  assert.deepEqual(before.outputsPerMinute.steady, {'construction-robot': 10.133333333333333, 'logistic-robot': 10.133333333333333, roboport: 1.0666666666666667});
  assert.deepEqual([now.outputsPerMinute.recovery['construction-robot'], before.outputsPerMinute.recovery['construction-robot']], [13.666666666666666, 11.333333333333334]);
  // Library: one card under the new id, found by each product, with the earlier version in its history.
  const record = atlas.blueprints.find(b => b.blueprintSha256 === CUR);
  assert.equal(record?.id, 'designed-120a56b5bf85f2f8');
  assert.equal(atlas.blueprints.filter(b => b.blueprintSha256 === PREV).length, 0, 'the earlier version is not a second library card');
  assert.deepEqual([...record.products].sort(), ['construction-robot', 'logistic-robot', 'roboport']);
  assert.ok(record.analysis.inputs.length && record.section === 'Robots and logistics' && record.purpose === 'Robot production');
  for (const id of record.products) assert.ok(atlas.coverage.items.find(i => i.id === id)?.builds.includes(record.id), id + ' covered by flight robots');
  const p = record.publication;
  assert.deepEqual([p.version, p.label, p.machines], [2, 'Smaller, pair swapped', 48]);
  assert.deepEqual(p.recoveryPerMinute, now.outputsPerMinute.recovery);
  const [h] = p.history;
  assert.deepEqual([p.history.length, h.version, h.label, h.blueprintSha256, h.footprint, h.tiles, h.machines], [1, 1, 'Earlier, one more assembler', PREV, {width: 106, height: 18}, 1908, 49]);
  assert.equal(hash(await read('site/' + h.code)), PREV);
  const oldRecord = await json('site/' + h.url);
  assert.equal(oldRecord.id, record.id); assert.equal(oldRecord.validation.status, 'game-tested');
  // Guide page: the shared versions section replaces the family's own table.
  const html = await read('site/flight-robots/index.html');
  assert.match(html, /<section id="versions"><h2>Two tested versions: which to choose<\/h2>/);
  assert.ok(!html.includes('<section class="versions">'), 'one versions presentation');
  for (const [i, v] of m.versions.entries()) {
    assert.ok(html.includes(`data-version-copy="${i}"`) && html.includes(`href="${v.file}" download`) && html.includes(`href="${v.report}"`), v.label + ' copy, download and report');
    assert.equal(hash(await read(path.join('site/flight-robots', v.file))), v.blueprintSha256, v.label + ' download file');
    assert.ok(html.includes((await read(path.join(ROBOTS, v.file))).trim().slice(0, 200)), v.label + ' string on the page');
  }
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

test('optional inputs and power: the electric smelter records them per version; families without them are unchanged', async () => {
  const SMELTER = 'blueprint-sources/electric-smelter-pass-through';
  const [m] = await json(SMELTER + '/manifest.json');
  assert.deepEqual(m.versions.map(v => v.label), ['No modules', 'Efficiency modules', 'Productivity modules, tier one', 'Productivity modules, tier two', 'Productivity modules, tier three', 'Speed modules, tier one', 'Speed modules, tier two', 'Speed modules, tier three']);
  for (const v of m.versions) {
    const build = (await json(path.join(SMELTER, v.report))).builds.find(b => b.blueprintSha256 === v.blueprintSha256 && b.passed === true);
    assert.deepEqual(v.inputsPerMinute, build.inputsPerMinute, v.label);
    assert.equal(v.powerKW, build.powerKW, v.label);
    assert.ok(v.inputsPerMinute['iron-ore'] > 0 && v.powerKW > 0, v.label);
  }
  // Other families keep exactly their earlier shape: no inputsPerMinute or powerKW keys, no new columns.
  for (const family of ['essentials-mall', 'flight-robots']) {
    const [f] = await json(`blueprint-sources/${family}/manifest.json`);
    for (const v of f.versions) assert.ok(!('inputsPerMinute' in v) && !('powerKW' in v), family + ' ' + v.label);
    const html = await read(`site/${family}/index.html`);
    assert.ok(!html.includes('data-input-item') && !html.includes('data-power'), family + ': guide table unchanged');
    const record = atlas.blueprints.find(b => b.blueprintSha256 === f.blueprintSha256);
    assert.ok(!('inputsPerMinute' in record.publication) && record.publication.history.every(h => !('inputsPerMinute' in h) && !('powerKW' in h)), family + ': library record unchanged');
  }
  assert.deepEqual(measuredOperation(null, NEW), {inputsPerMinute: undefined, powerKW: undefined});
  assert.deepEqual(measuredOperation({builds: [{blueprintSha256: NEW, passed: true, inputsPerMinute: {a: 2}, powerKW: 5}]}, NEW), {inputsPerMinute: {a: 2}, powerKW: 5});
  // Library and guide page carry them.
  const record = atlas.blueprints.find(b => b.blueprintSha256 === m.blueprintSha256);
  assert.deepEqual(record.publication.inputsPerMinute, m.versions[0].inputsPerMinute);
  assert.equal(record.publication.powerKW, m.versions[0].powerKW);
  for (const h of record.publication.history) { const v = m.versions.find(v => v.blueprintSha256 === h.blueprintSha256); assert.deepEqual(h.inputsPerMinute, v.inputsPerMinute); assert.equal(h.powerKW, v.powerKW); }
  const html = await read('site/electric-smelter-pass-through/index.html');
  assert.match(html, /<section id="versions"><h2>Eight tested versions: which to choose<\/h2>/);
  assert.equal((html.match(/<td data-input-item="iron-ore">/g) || []).length, 8);
  assert.equal((html.match(/<td data-power>/g) || []).length, 8);
  assert.ok(html.includes('alternative version') && !html.includes('earlier version'));
});

test('alternatives flag: only the smelter (module variants) and the plastic bar sizes set it; successive-version families and the processing-unit supplier do not', async () => {
  assert.equal(versionsAreAlternatives(undefined), false);
  assert.equal(versionsAreAlternatives({}), false);
  assert.equal(versionsAreAlternatives({versionsAlternatives: true}), true);
  const families = await versionedFamilies();
  const flagged = families.filter(f => versionsAreAlternatives(f.info)).map(f => f.family);
  assert.deepEqual(flagged.sort(), ['electric-smelter-pass-through', 'plastic-bars']);
  for (const family of ['essentials-mall', 'flight-robots', 'processing-units']) assert.ok(families.some(f => f.family === family), family + ' lists versions');
  for (const {family, info} of families) {
    const record = atlas.blueprints.find(b => b.blueprintSha256 === info.blueprintSha256);
    assert.ok(record?.publication, family + ' has a library record with versions');
    // The library picker drops the "Version N" prefix only where the flag is set.
    assert.equal('alternatives' in record.publication, versionsAreAlternatives(info), family);
    if (versionsAreAlternatives(info)) assert.equal(record.publication.alternatives, true, family);
    const html = await read(`site/${family}/index.html`);
    assert.equal(/alternative (version|size)/.test(html), versionsAreAlternatives(info), family + ': guide card wording');
    assert.equal(html.includes('earlier version'), !versionsAreAlternatives(info), family + ': guide card wording');
  }
  // The picker's naming itself is covered in a browser by tests/blueprint-versions-browser.mjs; here the source is checked once.
  const explorer = await read('site/explorer.js');
  assert.match(explorer, /publication\?\.alternatives && v\.label \? v\.label : `Version \$\{v\.version\}/);
});

test('processing units: the replaced 31 x 29 layout is the second, selectable version, complete with its own passing report', async () => {
  const [m] = await json('blueprint-sources/processing-units/manifest.json');
  assert.deepEqual(m.versions.map(v => [v.label, v.width, v.height]), [['Shared channel', 31, 28], ['Twin rows', 31, 29]]);
  assert.equal(m.versions[0].blueprintSha256, m.blueprintSha256);
  assert.equal(m.versions[1].blueprintSha256, 'abe14cdfcda0bf7a336bdc53ea1c535f444c809ddf38fa04f0834fff4023b512');
  await checkVersions(m, 'blueprint-sources/processing-units');
  assert.ok(m.versions[0].outputsPerMinute.steady['processing-unit'] > m.versions[1].outputsPerMinute.steady['processing-unit']);
  const html = await read('site/processing-units/index.html');
  assert.match(html, /<section id="versions"><h2>Two tested versions: which to choose<\/h2>/);
  assert.ok(html.includes('href="history/twin-rows-abe14cdf/processing-units.txt"'));
  await fs.access('site/processing-units/history/twin-rows-abe14cdf/native-report.json');
});

test('plastic bar sizes: one library entry, three alternatives (Medium recommended) with coal and petroleum gas in per size', async () => {
  const PB = 'blueprint-sources/plastic-bars', entries = await json(PB + '/manifest.json');
  const medium = entries.find(e => e.size === 'medium');
  assert.equal(entries.filter(e => e.versions).length, 1, 'only the recommended record lists the sizes');
  assert.deepEqual(medium.versions.map(v => v.label), ['Medium', 'Small', 'Large']);
  assert.equal(medium.versionsAlternatives, true);
  await checkVersions(medium, PB);
  for (const v of medium.versions) {
    const own = entries.find(e => e.blueprintSha256 === v.blueprintSha256), build = (await json(path.join(PB, v.report))).builds.find(b => b.blueprintSha256 === v.blueprintSha256 && b.passed === true);
    assert.equal(v.inputsFromBuild, true);
    assert.deepEqual(v.inputsPerMinute, {coal: build.inputs[0].acceptedPerMinute, 'petroleum-gas': build.fluids[0].acceptedPerMinute}, v.label + ': coal by belt and gas by pipe, from its own report');
    assert.deepEqual(v.inputsPerMinute, {coal: own.inputs[0].perMinute, 'petroleum-gas': own.fluids[0].perMinute}, v.label + ': equals the panel figures');
    assert.deepEqual([v.width, v.height], [own.footprint.width, own.footprint.height], v.label + ': its own size');
    assert.equal(v.outputsPerMinute.steady['plastic-bar'], own.targets['plastic-bar']);
  }
  assert.deepEqual(medium.versions.map(v => v.width * v.height), [119, 56, 204], 'sizes differ per alternative');
  // One card; the others live in its picker history, each a full record under the same id.
  const cards = atlas.blueprints.filter(b => b.file?.startsWith('sources/designed-blueprints/plastic-bars/') && b.publication);
  assert.equal(cards.length, 1);
  const card = cards[0];
  assert.equal(card.blueprintSha256, medium.blueprintSha256);
  assert.equal(card.name, 'Plastic bar supplier · three sizes');
  assert.equal(card.publication.alternatives, true);
  assert.deepEqual(card.publication.inputsPerMinute, medium.versions[0].inputsPerMinute);
  assert.deepEqual(card.publication.history.map(h => h.label).sort(), ['Large', 'Small']);
  for (const h of card.publication.history) assert.deepEqual(h.inputsPerMinute, medium.versions.find(v => v.blueprintSha256 === h.blueprintSha256).inputsPerMinute);
  assert.deepEqual([...card.analysis.inputs].sort(), ['coal', 'petroleum-gas']);
  assert.deepEqual(card.products, ['plastic-bar']);
});

test('inputsFromBuild is opt-in and reads belts then fluids; the noun of the guide section is a word that defaults to version', async () => {
  const report = {builds: [{blueprintSha256: NEW, passed: true, inputs: [{item: 'coal', entity: 1, acceptedPerMinute: 120}], fluids: [{item: 'petroleum-gas', entity: 2, acceptedPerMinute: 2400}]}]};
  assert.deepEqual(acceptedInputs(report, NEW), {coal: 120, 'petroleum-gas': 2400});
  assert.equal(acceptedInputs(report, OLD), undefined, 'only the passing build of that exact string');
  assert.equal(acceptedInputs({builds: [{blueprintSha256: NEW, passed: true}]}, NEW), undefined);
  // Families without the flag keep their shape: the mall's reports list entrances but its versions carry no inputsPerMinute.
  const [mall] = await json(MALL + '/manifest.json');
  for (const v of mall.versions) assert.ok(!('inputsFromBuild' in v) && !('inputsPerMinute' in v), v.label);
  const v = {label: 'A', blueprintSha256: NEW, file: 'a.txt', report: 'a.json', width: 2, height: 2, tiles: 4, machines: 1, outputsPerMinute: {steady: {x: 1}, recovery: null}};
  const args = {versions: [v, {...v, label: 'B', blueprintSha256: OLD}], products: ['x'], codes: ['c', 'd'], chip: id => id, esc: x => x};
  const plain = await versionsSection({...args, alternatives: true}), sized = await versionsSection({...args, alternatives: true, noun: 'size'});
  assert.match(plain, /Two tested versions: which to choose/);
  assert.ok(plain.includes('alternative version') && plain.includes('recommended, current version') && plain.includes('<th scope="col">Version</th>'));
  assert.match(sized, /Two tested sizes: which to choose/);
  assert.ok(sized.includes('alternative size') && sized.includes('recommended, current size') && sized.includes('<th scope="col">Size</th>') && !sized.includes('version'.concat(' ')));
});
