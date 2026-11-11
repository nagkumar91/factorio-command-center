import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {solveLinearProgram} from '../scripts/flight-factory-solver.mjs';
import {normalizeGame} from '../scripts/flight-factory-model.mjs';
import {planFactory, auditBalance} from '../scripts/flight-factory-planner.mjs';

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
function assertOptimal({A, b, c}, result, objective) {
  assert.equal(result.status, 'optimal');
  assert.equal(result.x.length, c.length);
  assert.ok(result.x.every(value => Number.isFinite(value) && value >= 0));
  for (let i = 0; i < b.length; i++) assert.ok(dot(A[i], result.x) <= b[i] + 1e-8, `constraint ${i}`);
  assert.ok(Math.abs(dot(c, result.x) - objective) < 1e-7 * Math.max(1, Math.abs(objective)));
  assert.ok(Math.abs(result.objective - objective) < 1e-7 * Math.max(1, Math.abs(objective)));
  assert.ok(result.dual.every(value => Number.isFinite(value) && value >= -1e-9));
  for (let j = 0; j < c.length; j++) assert.ok(A.reduce((sum, row, i) => sum + row[j] * result.dual[i], 0) >= c[j] - 1e-7, `dual constraint ${j}`);
  assert.ok(Math.abs(dot(b, result.dual) - dot(c, result.x)) < 1e-7 * Math.max(1, Math.abs(objective)), 'independent primal/dual objective agreement');
}

// Sparse, deletion-minimized regressions from the installed raw dump below.
// The old tableau reported unbounded / numerical-failure or a false optimum
// despite strictly negative costs and feasible production. No game cache is required.
const regressions = [
  {
    name: 'item-bulk-inserter-raw', previous: 'unbounded', objective: -0.17181086054341865,
    rows: [
      {13: 20, 14: -100},
      {0: 20, 9: -50, 20: 100},
      {2: 300, 10: -50, 14: 10, 15: 120},
      {1: -1, 5: 1},
      {3: -6, 4: 1, 24: 5},
      {5: -1},
      {1: 4, 7: -3, 8: -2},
      {6: -3, 8: 1, 23: -12.5},
      {5: 1, 11: -1},
      {12: -1, 23: 0.000125},
      {12: 1, 13: -1},
      {15: 8, 20: -60},
      {15: -8, 16: 8},
      {16: -8, 17: 15, 18: -15, 19: -10},
      {18: 15, 19: 5, 20: 15, 21: 1, 25: -1},
      {11: 2, 17: -15, 21: -1, 23: -12.5},
      {3: 12, 22: -4},
      {23: 1},
      {3: 0.75, 4: 0.25, 24: -59.75},
      {1: 2, 4: -4.5},
    ],
    b: [0,0,0,0,0,-0.016666666666666666,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    c: [-2.085,-0.41000000000000003,-14.31,-12.16,-9.06,-0.043333333333333335,-6.05,-6.0225,-0.043333333333333335,-0.023333333333333334,-0.023333333333333334,-0.043333333333333335,-2.26,-0.07666666666666666,-0.51,-16.17,-16.17,-0.81,-30.41,-20.21,-120.21,-0.09000000000000001,-0.07666666666666666,-50.06,-120.06,-0.1],
  },
  {
    name: 'item-77-personal-laser-defense-mk3-equipment-raw', previous: 'numerical-failure', objective: -527.0907168976587,
    rows: [
      {3: -50, 9: 100},
      {3: 50, 31: -1},
      {10: 20, 11: -100},
      {19: 500, 21: 500},
      {7: 80, 14: -400, 20: -750, 21: -375},
      {0: -1, 1: 2},
      {1: -1},
      {2: -1, 24: 2, 25: -0.03, 26: 5, 27: 5},
      {4: -6, 5: 1, 22: 5},
      {2: 4, 6: -3, 8: 3, 25: -0.03},
      {18: 20},
      {2: 2, 8: -1, 17: 20, 24: 20, 26: 5},
      {9: -1, 15: 0.00025},
      {9: 1, 10: -1},
      {12: -8, 13: 15},
      {14: 20, 15: 5, 20: 50, 32: -1},
      {8: 1, 13: -15, 29: 5},
      {4: 12, 16: -4},
      {17: -1, 23: 5},
      {7: -1.5, 18: -1, 23: 5, 25: -0.01},
      {4: 0.75, 5: 0.25, 22: -59.75},
      {0: 3, 23: -1},
      {2: 2, 5: -4.5, 7: 5, 18: 5},
      {0: 30, 1: 50, 23: 20, 24: -1, 25: -0.02, 27: 5},
      {0: 10, 26: -1, 27: 4},
      {1: 20, 27: -1},
      {28: 2},
      {15: -2.5, 17: 20, 18: 2, 25: -0.04, 28: -2, 29: -1},
      {11: 1, 19: -22.5, 21: -15, 25: -0.04},
      {30: 1, 33: -1},
      {4: 15, 5: 4, 30: -2},
    ],
    b: [0,0,0,0,0,0,-0.016666666666666666,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    c: [-0.8433333333333335,-1.01,-0.41000000000000003,-0.060000000000000005,-12.16,-9.06,-6.0225,-3.1975,-0.043333333333333335,-2.26,-0.07666666666666666,-0.51,-16.17,-0.81,-8.81,-5.11,-0.07666666666666666,-1.3433333333333335,-1.01,-52.71,-15.41,-37.71,-120.06,-0.6766666666666667,-0.6766666666666667,-1.23,-1.01,-2.01,-0.09000000000000001,-0.41000000000000003,-0.07666666666666666,-0.001,-0.1,-0.1],
  },

  {
    name: 'item-electric-mining-drill-mk2-mixed', previous: 'false optimum', objective: -1.0409541501467907,
    rows: [
      {14: -100, 16: 20, 17: -100},
      {25: 500},
      {5: 10, 19: -400, 24: -750, 25: -375},
      {0: 1000, 15: 100},
      {7: 100, 12: -50, 14: 5, 17: 10},
      {1: -1, 10: 4},
      {3: -6, 4: 1, 26: 5},
      {6: 3},
      {7: -5, 8: 4},
      {10: -1},
      {1: 2, 11: -1},
      {10: 2, 29: -1},
      {2: 2, 6: -12, 8: -12, 9: -12},
      {13: -1, 21: 0.00025, 23: 0.000125},
      {14: 2, 15: -72},
      {15: 18, 17: 2, 30: -1},
      {13: 1, 16: -1},
      {2: 8, 18: 15, 20: -15},
      {5: -1.5, 10: 6},
      {19: 20, 20: 15, 21: 5, 24: 50, 31: -1},
      {11: 1, 18: -15, 23: -12.5},
      {3: 12, 22: -4},
      {22: 1, 32: -1},
      {23: 1},
      {3: 0.75, 4: 0.25, 26: -59.75},
      {1: 2, 4: -4.5},
      {2: -2, 27: 2},
      {10: 3, 21: -2.5, 27: -2},
      {28: 1, 33: -1},
      {3: 15, 4: 4, 28: -2},
    ],
    b: [0,0,0,0,0,0,0,0,0,-0.016666666666666666,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    c: [-0.26,-0.41000000000000003,-4.17,-12.16,-9.06,-3.0225,-24.17,-10.21,-24.17,-24.17,-0.5433333333333333,-0.043333333333333335,-0.023333333333333334,-2.26,-0.51,-144.17,-0.07666666666666666,-0.51,-0.81,-8.81,-30.41,-5.11,-0.07666666666666666,-50.06,-15.41,-37.71,-120.06,-0.09000000000000001,-0.07666666666666666,-0.1,-0.1,-0.1,-0.1,-0.1],
  },
];
for (const fixture of regressions) test(`recovers ${fixture.previous}: ${fixture.name}`, () => {
  const A = fixture.rows.map(row => Array.from({length: fixture.c.length}, (_, j) => row[j] || 0));
  const program = {A, b: fixture.b, c: fixture.c};
  A.forEach(Object.freeze); Object.freeze(A); Object.freeze(program.b); Object.freeze(program.c);
  const result = solveLinearProgram(A, program.b, program.c);
  assertOptimal(program, result, fixture.objective);
  assert.ok(result.attempts > 1 && result.rebuilds > 0, 'a recomputed basis replaces the invalid tableau');
  assert.deepEqual(solveLinearProgram(A, program.b, program.c), result, 'deterministic retry');
});

test('a valid fast-path optimum remains exact and needs no retry', () => {
  const program = {A: [[1, 1], [1, 0], [0, 1]], b: [4, 2, 3], c: [3, 2]};
  const result = solveLinearProgram(program.A, program.b, program.c);
  assertOptimal(program, result, 10);
  assert.deepEqual(result.x, [2, 2]);
  assert.equal(result.attempts, 1); assert.equal(result.rebuilds, 0);
});

test('small positive pivots are not certificates of unboundedness or infeasibility', () => {
  for (const sign of [1, -1]) {
    const program = {A: [[sign * 1e-10]], b: [sign], c: [sign]};
    const result = solveLinearProgram(program.A, program.b, program.c);
    assertOptimal(program, result, sign * 1e10);
    assert.deepEqual(result.x, [1e10]);
  }
});

test('tiny improving costs cannot be hidden by an absolute feasibility tolerance', () => {
  assert.equal(solveLinearProgram([], [], [1e-10]).status, 'unbounded');
  const program = {A: [[1e-10]], b: [1], c: [1e-10]};
  assertOptimal(program, solveLinearProgram(program.A, program.b, program.c), 1);
});

test('genuine unboundedness includes a feasible point and improving ray', () => {
  const A = [[-1, 0], [1, -1]], b = [-2, 0], c = [1, 1];
  const result = solveLinearProgram(A, b, c);
  assert.equal(result.status, 'unbounded');
  assert.ok(result.x.every(value => value >= 0));
  assert.ok(A.every((row, i) => dot(row, result.x) <= b[i] + 1e-9));
  assert.ok(result.ray.every(value => value >= 0));
  assert.ok(A.every(row => dot(row, result.ray) <= 0));
  assert.ok(dot(c, result.ray) > 0);
});

test('genuine infeasibility includes a Farkas witness, including constant constraints', () => {
  for (const {A, b, c} of [{A: [[1], [-1]], b: [1, -2], c: [1]}, {A: [[]], b: [-1], c: []}]) {
    const result = solveLinearProgram(A, b, c);
    assert.equal(result.status, 'infeasible');
    assert.ok(result.dual.every(value => value >= 0));
    assert.ok(c.every((_, j) => A.reduce((sum, row, i) => sum + row[j] * result.dual[i], 0) >= 0));
    assert.ok(dot(b, result.dual) < 0);
  }
  assert.equal(solveLinearProgram([], [], [-1]).status, 'optimal');
  assert.equal(solveLinearProgram([], [], [1]).status, 'unbounded');
});

test('cycling retries use Bland ordering and honor the shared pivot budget', () => {
  const program = {A: [[.5, -5.5, -2.5, 9], [.5, -1.5, -.5, 1], [1, 0, 0, 0]], b: [0, 0, 1], c: [10, -57, -9, -24]};
  const result = solveLinearProgram(program.A, program.b, program.c, {maxPivots: 1100});
  assertOptimal(program, result, 1);
  assert.ok(result.attempts > 1 && result.pivots <= 1100);
  const exhausted = solveLinearProgram(program.A, program.b, program.c, {maxPivots: 6});
  assert.equal(exhausted.status, 'numerical-failure');
  assert.equal(exhausted.pivots, 6);
  assert.match(exhausted.reason, /budget/);
});

test('rejects nonfinite data and invalid dimensions before they can pass residual checks', () => {
  for (const args of [
    [[[NaN]], [1], [1]], [[[1]], [Infinity], [1]], [[[1]], [1], [-Infinity]],
    [[[1, 2]], [1], [1]], [[], [1], [1]], [[null], [1], [1]], [[], null, []],
  ]) assert.throws(() => solveLinearProgram(...args), /finite/);
  assert.throws(() => solveLinearProgram([], [], [], {epsilon: 0}), /positive/);
  assert.throws(() => solveLinearProgram([], [], [], {maxPivots: 0}), /budget/);
});

const prototypeSha256 = '52e36bd91607c8b13aa6df0a8c259de8d4fbbf756ee46e59c45f8b032be2cd0c';
const failedVariants = [
  ['77-energy-shield-mk4-equipment', 'raw'],
  ['77-exoskeleton-mk2-equipment', 'mixed'],
  ['77-exoskeleton-mk3-equipment', 'raw'],
  ['77-exoskeleton-mk4-equipment', 'raw'],
  ['77-fission-reactor-mk2-equipment', 'raw'],
  ['77-personal-laser-defense-mk3-equipment', 'raw'],
  ['77-personal-laser-defense-mk4-equipment', 'raw'],
  ['77-personal-laser-defense-mk5-equipment', 'raw'],
  ['77-personal-roboport-mk4-equipment', 'raw'],
  ['77-power-armor-mk3', 'raw'],
  ['asteroid-collector', 'mixed'],
  ['bulk-inserter', 'raw'],
  ['centrifuge', 'raw'],
  ['centrifuge', 'mixed'],
  ['crude-oil-barrel', 'raw'],
  ['crusher', 'raw'],
  ['crusher3', 'raw'],
  ['efficiency-module', 'raw'],
  ['exoskeleton-equipment', 'raw'],
  ['heavy-oil-barrel', 'raw'],
  ['industrial-armor-mk1', 'raw'],
  ['industrial-armor-mk2', 'raw'],
  ['lubricant-barrel', 'raw'],
  ['personal-assembling-unit1-equipment', 'mixed'],
  ['personal-assembling-unit3-equipment', 'mixed'],
  ['personal-backpack-mk2-equipment', 'raw'],
  ['petroleum-gas-barrel', 'raw'],
  ['power-armor-mk2', 'raw'],
  ['production-science-pack', 'raw'],
  ['productivity-module', 'raw'],
  ['quality-module', 'raw'],
  ['speed-module', 'raw'],
  ['spidertron', 'raw'],
  ['substation', 'raw'],
  ['substation', 'mixed'],

];
test('all 35 installed eligible raw/mixed numerical failures produce balanced plans', t => {
  const rawPath = new URL('../.cache/flight-game/script-output/data-raw-dump.json', import.meta.url);
  if (!fs.existsSync(rawPath)) return t.skip('Installed flight prototype cache is optional; sparse regressions run everywhere.');
  const bytes = fs.readFileSync(rawPath);
  if (createHash('sha256').update(bytes).digest('hex') !== prototypeSha256) return t.skip('Installed prototype version differs from the audited regression set.');
  const audit = JSON.parse(fs.readFileSync(new URL('../flight-map/progression-audit.json', import.meta.url)));
  const map = JSON.parse(fs.readFileSync(new URL('../flight-map/native-report.json', import.meta.url)));
  assert.equal(map.prototypeSha256, prototypeSha256);
  const model = normalizeGame(JSON.parse(bytes), {prototypeSha256, manualSources: audit.exchange.offers,
    seededResources: Object.entries(map.resources).map(([entity, amount]) => ({entity, amount}))});
  assert.equal(failedVariants.length, 35);
  for (const [target, mode] of failedVariants) {
    const plan = planFactory(model, target, {mode});
    assert.equal(plan.status, 'planned', `${target}/${mode}: ${plan.reason}`);
    assert.equal(auditBalance(plan, model).passed, true, `${target}/${mode} material balance`);
    assert.ok(plan.steps.every(step => Number.isFinite(step.craftsPerSecond) && step.craftsPerSecond > 0));
  }
});
