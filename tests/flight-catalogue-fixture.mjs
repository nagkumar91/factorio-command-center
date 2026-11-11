import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';

export const entities = [
  {entity_number: 1, name: 'assembling-machine-3', position: {x: 3, y: 2}, size: [3, 3], recipe: 'iron-gear-wheel'},
  {entity_number: 2, name: 'transport-belt', position: {x: 0, y: 2}, size: [1, 1]},
  {entity_number: 3, name: 'pipe', position: {x: 0, y: 5}, size: [1, 1]},
  {entity_number: 4, name: 'display-panel', position: {x: 0, y: 1}, text: 'IN A · [item=iron-plate] ↓\nFeed the belt from the left.', icon: {type: 'item', name: 'iron-plate'}, always_show: true},
  {entity_number: 5, name: 'display-panel', position: {x: 0, y: 4}, text: 'IN B · [fluid=water] ↓\nConnect water to the pipe.', icon: {type: 'fluid', name: 'water'}, always_show: true}
];
export const blueprintCode = '0' + deflateSync(JSON.stringify({blueprint: {item: 'blueprint', version: 562949958467584, label: 'Browser test fixture only', entities}})).toString('base64');
export const blueprintSha256 = createHash('sha256').update(blueprintCode).digest('hex');
export const prototypeSha256 = 'b'.repeat(64);
export const randomOutput = {
  id: 'iron-gear-wheel', type: 'item', collected: 240, perMinute: 8,
  stabilityMethod: 'conditional-poisson',
  rateConfidenceInterval: {method: 'Garwood exact Poisson', confidence: .95, lowerPerMinute: 7.02, upperPerMinute: 9.08, count: 240, minutes: 30, assumption: 'Independent Poisson arrivals at a constant rate; recipe, transport and spoilage correlations can violate this model.'},
  stabilityTest: {method: 'Conditional Poisson homogeneity', alpha: .05, chiSquare: 1.23, degreesOfFreedom: 2, pValue: .54, expectedCountPerWindow: 80, accepted: true, interpretation: 'Variation is consistent with stationary random output; not proof of stationarity.', assumptions: ['Assumes independent Poisson arrivals; transport and recipe correlations can violate this.']}
};
export const fixture = {
  schemaVersion: 1,
  generatedAt: '2026-11-10T00:00:00Z',
  profile: {id: 'flight-test', name: 'Flight browser test fixture', factorioVersion: '2.0.77', prototypeSha256, mods: [{name: 'everything-on-nauvis', version: '0.1.8'}], notes: ['Fixture data only; this is not a published production claim.']},
  items: [
    {id: 'iron-gear-wheel', name: 'Iron gear wheel', type: 'item', group: 'Intermediate products', icon: 'assets/icons/iron-gear-wheel.png'},
    {id: 'iron-plate', name: 'Iron plate', type: 'item', group: 'Intermediate products', icon: 'assets/icons/iron-plate.png'},
    {id: 'water', name: 'Water', type: 'fluid', icon: 'assets/icons/fluid-water.png', reason: 'Extracted resource, fixture gap.'},
    {id: 'copper-cable', name: 'Copper cable', type: 'item', icon: 'assets/icons/copper-cable.png'},
    {id: 'unknown-modded-product', name: 'Unknown modded product', type: 'item', reason: 'No supported machine in this recipe snapshot.'},
    {id: 'assembling-machine-3', name: 'Assembling machine 3', type: 'item', icon: 'assets/icons/assembling-machine-3.png'}
  ],
  factories: [
    {
      id: 'gear-raw', name: 'Iron gear wheel', product: 'iron-gear-wheel', variant: 'raw', outputPerMinute: 1,
      inputs: [{id: 'iron-plate', type: 'item', perMinute: 2, label: 'IN A · Iron plate ↓', displayEntity: 4}, {id: 'water', type: 'fluid', perMinute: 20, label: 'IN B · Water ↓', displayEntity: 5}],
      steps: [{recipe: 'iron-gear-wheel', machine: 'assembling-machine-3', count: 1, utilization: .025}],
      blueprint: {path: 'flight-catalogue-fixture.txt', sha256: blueprintSha256, entities},
      validation: {status: 'native-tested', passed: true, blueprintSha256, prototypeSha256, reportPath: 'flight-catalogue-fixture-report.json', measuredMinutes: 30, warmupMinutes: 10, throughputPassed: false, outputs: [{id: 'iron-gear-wheel', type: 'item', collected: 24, perMinute: .8}, {id: 'water', type: 'fluid', collected: 150, perMinute: 5}]},
      source: {name: 'Synthetic browser fixture', url: 'https://example.com/fixture', diagnosticsPath: 'flight-catalogue-fixture-history.json'},
      notes: ['Test fixture: no real production evidence is implied.']
    },
    {id: 'gear-mixed', name: 'Iron gear wheel', product: 'iron-gear-wheel', variant: 'mixed', outputPerMinute: 1, inputs: [{id: 'iron-plate', type: 'item', perMinute: 2}], steps: [], planPath: 'flight-catalogue-fixture-plan.json', validation: {status: 'calculated'}},
    {id: 'plate-intermediate', name: 'Iron plate', product: 'iron-plate', variant: 'intermediary', outputPerMinute: 60, inputs: [], steps: [], validation: {status: 'calculated'}},
    {id: 'cable-stale', name: 'Copper cable', product: 'copper-cable', variant: 'intermediate', outputPerMinute: 2, inputs: [], steps: [], blueprint: {path: 'flight-catalogue-fixture.txt', sha256: blueprintSha256}, validation: {status: 'native-tested', passed: true, blueprintSha256: 'c'.repeat(64), prototypeSha256, reportPath: 'flight-catalogue-fixture-report.json'}},
    {id: 'unknown-raw', name: 'Unknown modded product', product: 'unknown-modded-product', variant: 'raw', status: 'unavailable', reason: 'No supported machine in this recipe snapshot.', inputs: [], steps: []}
  ]
};
