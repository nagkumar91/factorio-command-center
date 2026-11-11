import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import sharp from 'sharp';
import {blueprintPreviewSvg} from '../scripts/blueprint-preview.mjs';
import {fixture, entities, randomOutput} from './flight-catalogue-fixture.mjs';

const context = vm.createContext({URL, Intl});
vm.runInContext(await fs.readFile(new URL('../site/flight-factories-model.js', import.meta.url), 'utf8'), context);
const M = context.FlightFactories;
const clone = value => JSON.parse(JSON.stringify(value));
const data = M.normalize(fixture);

test('native badge requires passing exact blueprint and profile evidence plus local downloadable artifacts', () => {
  const original = clone(data.factories[0]);
  assert.equal(M.evidence(original, data.profile).id, 'native-tested');
  for (const change of [
    f => { f.validation.passed = false; },
    f => { delete f.validation.passed; },
    f => { f.validation.blueprintSha256 = 'a'.repeat(64); },
    f => { f.validation.blueprintSha256 = 'bad'; f.blueprint.sha256 = 'bad'; },
    f => { f.validation.prototypeSha256 = 'd'.repeat(64); },
    f => { delete f.validation.prototypeSha256; },
    f => { f.validation.reportPath = 'https://example.com/report.json'; },
    f => { delete f.validation.reportPath; },
    f => { delete f.blueprint.path; }
  ]) {
    const changed = clone(original); change(changed);
    assert.equal(M.evidence(changed, data.profile).id, 'unverified');
  }
  const recipeOnly = clone(original); recipeOnly.validation.status = 'recipe-checked';
  assert.equal(M.evidence(recipeOnly, data.profile).id, 'calculated');
});

test('coverage counts unique recipe products, separates plans/downloads/tests, and excludes constructed entities and blocked plans', () => {
  const result = M.coverage(data);
  assert.equal(result.total, 6);
  assert.equal(result.planned, 3);
  assert.equal(result.downloadable, 2);
  assert.equal(result.tested, 1);
  assert.equal(result.rows.find(r => r.id === 'assembling-machine-3').builds.length, 0);
  assert.equal(result.rows.find(r => r.id === 'unknown-modded-product').builds.length, 0);
  assert.equal(result.rows.find(r => r.id === 'iron-gear-wheel').builds.length, 2);
});

test('factory search understands product IDs, input names, and all three input boundaries', () => {
  assert.equal(M.filterFactories(data, {query: 'iron gear', variant: 'raw'}).length, 1);
  assert.equal(M.filterFactories(data, {query: 'water'}).length, 1);
  assert.equal(M.filterFactories(data, {query: 'iron-plate', variant: 'mixed'}).length, 1);
  assert.equal(M.filterFactories(data, {variant: 'intermediate'}).length, 2);
  assert.equal(M.filterFactories(data, {status: 'native-tested'}).length, 1);
  assert.equal(M.filterFactories(data, {status: 'unavailable'}).length, 1);
});

test('material icon/name metadata supports raw feeds without inflating product coverage', () => {
  const withMaterials = M.normalize({...fixture, materials: [{id: 'raw-mod-ore', name: 'Flight crystal', type: 'item', icon: 'assets/flight-icons/raw-mod-ore.png'}], factories: [{...fixture.factories[1], inputs: [{id: 'raw-mod-ore', type: 'item', perMinute: 1}]}]});
  assert.equal(M.filterFactories(withMaterials, {query: 'flight crystal'}).length, 1);
  assert.equal(M.coverage(withMaterials).total, fixture.items.length);
});

test('measured output is gated by identity and actual collection over a known interval, never by the calculated target', () => {
  const native = clone(fixture.factories[0]);
  const measured = M.measurement(native, fixture.profile);
  assert.equal(measured.rows[0].perMinute, .8);
  assert.equal(native.outputPerMinute, 1);
  assert.equal(measured.minutes, 30); assert.equal(measured.warmupMinutes, 10);
  assert.equal(measured.throughputPassed, false);
  native.validation.blueprintSha256 = 'e'.repeat(64);
  assert.equal(M.measurement(native, fixture.profile), null);
  const invalid = clone(fixture.factories[0]); delete invalid.validation.measuredMinutes;
  assert.equal(M.measurement(invalid, fixture.profile), null);
  invalid.validation.measuredMinutes = 30;
  invalid.validation.outputs = [{id: 'iron-gear-wheel', type: 'item', collected: 24, perMinute: 1}];
  assert.equal(M.measurement(invalid, fixture.profile), null);
  invalid.validation.outputs = {'item:iron-gear-wheel': {collected: 24, perMinute: .8}};
  assert.equal(M.measurement(invalid, fixture.profile).rows[0].id, 'iron-gear-wheel');
});

test('known native failures keep their explicit status and withhold downloads even if an adapter retains the file path', () => {
  const failed = clone(fixture.factories[0]);
  failed.validation.status = 'native-failed'; failed.validation.passed = false;
  assert.equal(M.evidence(failed, fixture.profile).id, 'native-failed');
  assert.equal(M.downloadable(failed), false);
  assert.equal(M.measurement(failed, fixture.profile), null);
  const failedData = M.normalize({...fixture, factories: [failed]});
  assert.equal(M.coverage(failedData).planned, 1);
  assert.equal(M.coverage(failedData).downloadable, 0);
  assert.equal(M.coverage(failedData).tested, 0);
  assert.equal(M.filterFactories(failedData, {status: 'native-failed'}).length, 1);
});

test('random-yield annotations require the audited stochastic marker and valid supplied statistical fields', () => {
  const random = M.randomYieldEvidence(randomOutput);
  assert.equal(random.interval.lowerPerMinute, 7.02);
  assert.equal(random.interval.upperPerMinute, 9.08);
  assert.equal(random.stability.pValue, .54);
  assert.equal(M.randomYieldEvidence({...randomOutput, stabilityMethod: 'deterministic-range'}), null, 'Deterministic co-products must not inherit the random-yield label.');
  assert.equal(M.randomYieldEvidence({...randomOutput, rateConfidenceInterval: {...randomOutput.rateConfidenceInterval, confidence: 2}}).interval, null);
  assert.equal(M.randomYieldEvidence({...randomOutput, rateConfidenceInterval: {...randomOutput.rateConfidenceInterval, upperPerMinute: 1}}).interval, null);
  assert.equal(M.randomYieldEvidence({...randomOutput, stabilityTest: {...randomOutput.stabilityTest, pValue: -1}}).stability, null);
  const failed = clone(fixture.factories[0]);
  failed.validation.outputs = [randomOutput]; failed.validation.status = 'native-failed';
  assert.equal(M.measurement(failed, fixture.profile), null, 'Intervals cannot make failed native evidence publishable.');
});

test('public links stay within the local site; source attribution permits explicit HTTP links', () => {
  for (const value of ['../save.zip', '/etc/passwd', '//example.com/a', 'javascript:alert(1)', 'assets/../../a', 'assets/%2e%2e/a', 'assets/a%5cb', 'assets/.secret', 'a\nb', 'https://example.com/a', 'assets/%00a']) assert.equal(M.localPath(value), '');
  assert.equal(M.localPath('sources/flight/gear.txt'), 'sources/flight/gear.txt');
  assert.equal(M.sourceUrl('https://example.com/credit'), 'https://example.com/credit');
  assert.equal(M.sourceUrl('javascript:alert(1)'), '');
  assert.match(M.esc('<img onerror="bad">'), /&lt;img/);
  assert.equal(M.formatRate(NaN), '—');
  assert.equal(M.formatRate(.001), '<0.01');
});

test('display preview renders item/fluid signals, readable label legends, actual positions, and safe text', async () => {
  const input = clone(entities); input[3].text += '\n<unsafe>&"';
  const svg = await blueprintPreviewSvg({entities: input}, {entities: {}}, {icons: {'iron-plate': 'assets/icons/iron-plate.png', water: 'assets/icons/fluid-water.png'}});
  assert.match(svg, /data-display-entity="4"/);
  assert.match(svg, /data-display-label="5"/);
  assert.match(svg, /IN A · iron plate ↓/);
  assert.match(svg, /Connect water to the pipe/);
  assert.match(svg, /data:image\/png;base64,/);
  assert.match(svg, /&lt;unsafe&gt;&amp;&quot;/);
  assert.doesNotMatch(svg, /<unsafe>/);
  const output = await sharp(Buffer.from(svg)).png().toBuffer({resolveWithObject: true});
  assert.equal(output.info.width, 960); assert.ok(output.info.height >= 480);
});

test('unknown modded display icons keep their labels; layouts without panels retain the established thumbnail', async () => {
  const svg = await blueprintPreviewSvg({entities: [{entity_number: 9, name: 'display-panel', position: {x: -40, y: 500}, icon: {type: 'item', name: 'unknown-mod-item'}, text: 'Input X · modded material'}]}, {entities: {}}, {icons: {}});
  assert.match(svg, /unknown-mod-item/); assert.match(svg, /Input X · modded material/);
  assert.equal(await blueprintPreviewSvg({entities: []}, {entities: {}}), null);
  const vanilla = await blueprintPreviewSvg({entities: [entities[0]]}, {entities: {}});
  assert.match(vanilla, /width="640" height="400"/); assert.doesNotMatch(vanilla, /DISPLAY PANEL LABELS/);
});
