// Shared helpers of the foundry belts and fuel mall. The blueprint helpers and the native harness (validate.mjs,
// control.lua) are the foundry mall's, imported; only what names this mall lives here.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../foundry-mall/lib.mjs';
export { sha, readJson, json, encode, encodeKeeping, decode, vector, coord, distance, allWires, rotate, box, intersects, contact, inside, envelope, technologyClosure, blueprintVersion, exists, scenarioSummary } from '../foundry-mall/lib.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../../..');
export const ID = 'foundry-belts-fuel-mall';
// FOUNDRY_FUEL_MALL_PUBLISHED lets the tests and tools look at a candidate folder instead of the published one.
export const PUBLISHED = process.env.FOUNDRY_FUEL_MALL_PUBLISHED ? path.resolve(process.env.FOUNDRY_FUEL_MALL_PUBLISHED) : path.join(PROJECT, 'blueprint-sources/requested-malls', ID);
export const prototypes = () => readJson(path.join(HERE, 'prototypes.json'));
export const FUEL = 'rocket-fuel';

// The native protocol that qualifies a published version (the foundry mall's protocol with this mall's products and
// inputs, plus the rocket fuel section's own scenarios). Times are game ticks.
export const PROTOCOL = Object.freeze({
  seed: 21024, reducedDivisor: 10, settleSeconds: 5, skipSettleSeconds: 120, fillLimitTicks: 1728000, skipLimitTicks: 1728000, skipDeadTicks: 54000,
  outageTicks: 18000, settleTicks: 36000, holdTicks: 216000, rateWarmupTicks: 54000, rateMeasureTicks: 108000, externalPowerWatts: 200000000, samplingTicks: 54000,
  capEditItems: ['express-transport-belt', 'bulk-inserter', 'rocket-fuel'],
  singleRefills: ['express-transport-belt', 'express-underground-belt', 'express-splitter', 'fast-inserter', 'bulk-inserter', 'electric-mining-drill', 'foundry', 'rocket-fuel'],
  // every outside input by its entrance key (the mall's calcite and the fuel section's calcite are two entrances)
  inputs: ['lava', 'calcite', 'plastic-bar', 'tungsten-carbide', 'lubricant', 'water', 'sulfuric-acid', 'coal', 'calcite-fuel'],
  withheldInputs: ['plastic-bar', 'tungsten-carbide', 'lubricant', 'water', 'sulfuric-acid', 'coal', 'calcite-fuel', 'calcite', 'lava'],
  fullCapScenarios: ['fill (its first phase)', 'fill:no-fuel', 'rate', 'fuel:idle', 'fuel:filling'],
  quietRoles: ['U1', 'U2', 'electronic-circuit', 'advanced-circuit', 'refined-concrete', 'rocket-fuel-1', 'rocket-fuel-2', 'rocket-fuel-3'],
  matrixCaseTicks: 160, matrixRecipes: { U2: ['iron-ore-melting', 'transport-belt', 'express-transport-belt', 'foundry'] },
  matrixNetworks: { 'caster-C': ['molten-iron', 'water'], U2: ['lubricant'] },
  matrixFluids: ['molten-iron', 'molten-copper', 'water', 'lubricant'],
  buildOrders: ['shuffle-1', 'shuffle-2', 'shuffle-3', 'pipes-first', 'machines-first', 'combinators-last', 'copper-foundry-last', 'iron-foundry-last', 'robots-25', 'robots-200'],
  buildStepTicks: 20, buildGapTicks: 36000, robotLimitTicks: 108000, latePowerTicks: 18000, blockedStoneTicks: 216000, cutTicks: 36000, stopTicks: 54000,
  thinSupply: { lava: 100, calcite: 12 }, thinTicks: 216000,
  placements: ['rot90', 'rot180', 'rot270', 'flipH', 'flipV'],
  // hand-back: the belt foundry part-loaded with the foundry recipe (tungsten carbide cut), then express belts taken; it must drop the recipe into its buffer chest and refill the belts
  handbackScenarios: ['handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt', 'handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt:10:full'],
  handbackLoadLimitTicks: 72000, handbackLimitTicks: 648000,
  // where the test stands its own things, in blueprint tiles (all outside the footprint)
  fixtures: { roboport: { x: 42, y: 12 }, robotChests: [{ x: 40.5, y: 15.5 }, { x: 41.5, y: 15.5 }, { x: 42.5, y: 15.5 }, { x: 43.5, y: 15.5 }], matrixDrivers: { x: -4.5, y: 1.5 } },
  // the rocket fuel section: its entrances at the figures on their panels, measured over thirty minutes
  fuelWindowTicks: 108000, fuelWarmupTicks: 108000, fuelTarget: 12, fuelTolerance: 0.25,
  acceptance: 'In every scenario no pipe, tank or pump ever holds a foreign fluid (every fluid segment read every tick), no fluid box of a machine is ever joined to the pipes of two fluids except through a pump, and no recipe-switching machine ever holds a recipe none of its rules asks for. At the published caps every product reaches its cap from empty, the four mall groups in list order, and keeps flowing while all chests are emptied every second; the rocket fuel section makes 12 a minute (within 0.25) over thirty minutes with coal, its calcite, sulfuric acid and water at the figures on their panels, while the mall part is full and idle and while it fills from empty, and its chest stops at exactly its cap. At reduced caps (a tenth, at least 2) the mall refills after complete collection, recovers after a five-minute outage of every input, holds full stock for an hour without a craft, follows cap edits, and with each outside input withheld from a cold start still fills every product that does not need it and the rest after the input returns; it fills every cap after being built piece by piece in ten orders (two of them by construction robots), after five minutes without power, after an hour with the stone exit blocked, after an hour of thin lava or thin calcite, after lava, calcite or either lava foundry was cut in mid-run, and when placed turned or mirrored; and no recipe change of a recipe-switching foundry puts a fluid into another network. Imported blueprint unchanged in every scenario.',
});
export const FLUID_SCENARIOS = ['ports', ...PROTOCOL.buildOrders.map(n => 'build:' + n), 'late:power', 'late:stone-exit', 'thin:lava', 'thin:calcite', 'starve:supply', 'starve:foundry', ...PROTOCOL.placements.map(n => 'place:' + n)];
export const FUEL_SCENARIOS = ['fill:no-fuel', 'fuel:idle', 'fuel:filling', 'both:emptied'];
export const QUALIFICATION = ['fill', 'rate', 'hold', 'caps', 'single', ...PROTOCOL.withheldInputs.map(n => 'skip:' + n), ...FUEL_SCENARIOS, ...FLUID_SCENARIOS, ...PROTOCOL.handbackScenarios];
