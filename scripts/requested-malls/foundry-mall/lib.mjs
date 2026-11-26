// Shared helpers for the foundry mall: generator, static audit, native validator and tests.
// Everything that does not depend on the mall itself comes unchanged from the blue-tier mall's helpers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
export { sha, readJson, json, encode, encodeKeeping, decode, vector, coord, distance, allWires, rotate, box, intersects, contact, inside, envelope, technologyClosure } from '../blue-tier-mall/lib.mjs';
import { readJson } from '../blue-tier-mall/lib.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../../..');
export const ID = 'foundry-mall';
// FOUNDRY_MALL_PUBLISHED lets the tests and tools look at a candidate folder instead of the published one.
export const PUBLISHED = process.env.FOUNDRY_MALL_PUBLISHED ? path.resolve(process.env.FOUNDRY_MALL_PUBLISHED) : path.join(PROJECT, 'blueprint-sources/requested-malls', ID);
export const prototypes = () => readJson(path.join(HERE, 'prototypes.json'));
export const exists = file => fs.access(file).then(() => true, () => false);
// The 64-bit version number a blueprint of this game version carries (major, minor, patch, build).
export const blueprintVersion = gameVersion => { const [a, b, c] = gameVersion.split('.').map(BigInt); return Number((a << 48n) + (b << 32n) + (c << 16n)); };
export const itemSignal = name => ({ name });
export const recipeSignal = name => ({ type: 'recipe', name });
export const fluidSignal = name => ({ type: 'fluid', name });
export const virtualSignal = name => ({ type: 'virtual', name });
// The native protocol that qualifies a published version (see validate.mjs and control.lua). Times are game ticks.
// A phase ends as soon as its goal is met and has held for settleSeconds; the limits are failures, not lengths.
// The outage (five minutes), the hold (one hour, after a ten-minute settle) and the rate window are lengths by nature.
export const PROTOCOL = Object.freeze({
  seed: 21024, reducedDivisor: 10, settleSeconds: 5, skipSettleSeconds: 120, fillLimitTicks: 1728000, skipLimitTicks: 1728000, skipDeadTicks: 54000,
  outageTicks: 18000, settleTicks: 36000, holdTicks: 216000, rateWarmupTicks: 54000, rateMeasureTicks: 108000, externalPowerWatts: 200000000, samplingTicks: 54000,
  capEditItems: ['assembling-machine-3', 'express-transport-belt', 'space-platform-foundation'],
  singleRefills: ['assembling-machine-3', 'fast-inserter (kit)', 'fast-inserter', 'express-transport-belt', 'express-underground-belt', 'express-splitter', 'bulk-inserter', 'electric-mining-drill', 'foundry'],
  withheldInputs: ['plastic-bar', 'tungsten-carbide', 'sulfuric-acid', 'lubricant', 'water', 'calcite', 'lava'],
  fullCapScenarios: ['fill (its first phase)', 'rate'],
  // Fluid safety (all at reduced caps). ports: every recipe change of every recipe-switching foundry with each network
  // on its ports full or empty. build: the blueprint goes up piece by piece with supply and power already connected.
  // starve: an input, or one lava foundry, is cut in mid-run. place: the blueprint turned or mirrored.
  matrixCaseTicks: 160, matrixRecipes: { U2: ['iron-ore-melting', 'transport-belt', 'express-transport-belt', 'foundry'] },
  matrixNetworks: { 'caster-S': ['molten-iron', 'molten-copper'], 'caster-D': ['molten-copper', 'molten-iron'], 'caster-G': ['molten-iron', 'water'], U2: ['lubricant'] },
  buildOrders: ['shuffle-1', 'shuffle-2', 'shuffle-3', 'pipes-first', 'machines-first', 'combinators-last', 'copper-foundry-last', 'iron-foundry-last', 'robots-25', 'robots-200'],
  buildStepTicks: 20, buildGapTicks: 36000, robotLimitTicks: 108000, latePowerTicks: 18000, blockedStoneTicks: 216000, cutTicks: 36000, stopTicks: 54000,
  thinSupply: { lava: 100, calcite: 12 }, thinTicks: 216000,
  placements: ['rot90', 'rot180', 'rot270', 'flipH', 'flipV'],
  // Hand-back: a universal machine caught with a recipe part loaded that it cannot finish, then a higher product taken
  // (see validate.mjs for the name form). Outage: an entrance or all cut for twenty minutes with every chest emptied.
  handbackScenarios: ['handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt', 'handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt:10:full', 'handback:U2:foundry:foundry:tungsten-carbide:express-splitter',
    'handback:U2:express-underground-belt:express-underground-belt:lava:express-transport-belt', 'handback:U1:space-platform-starter-pack:space-platform-starter-pack:lava:cargo-landing-pad', 'handback:U1:asteroid-collector:asteroid-collector:plastic-bar:cargo-landing-pad:10:full'],
  outageScenarios: ['outage:all:20', 'outage:tungsten-carbide:20', 'outage:lava:20', 'outage:all:20:full'],
  handbackLoadLimitTicks: 72000, handbackLimitTicks: 648000,
  targetRate: null,
  acceptance: 'A universal machine that drops a part-loaded recipe hands it back without stopping the mall: with tungsten carbide cut and the belt foundry part-loaded with the foundry recipe, express belts or splitters taken are refilled with the carbide still cut, at reduced and at the published caps; the same for the other hand-backs listed; and after twenty minutes without an entrance or without all, with every chest emptied, every cap is reached again. In every scenario no pipe, tank or pump ever holds a foreign fluid (every fluid segment read every tick), no fluid box of a machine is ever joined to the pipes of two fluids except through a pump, and no recipe-switching machine ever holds a recipe none of its rules asks for. At reduced caps the mall fills every cap after being built piece by piece in ten orders (two of them by construction robots) with supply and power connected, after five minutes without power, after an hour with the stone exit blocked, after an hour of thin lava or thin calcite, after lava, calcite or either lava foundry was cut in mid-run, and when placed turned or mirrored; and no recipe change of a recipe-switching foundry puts a fluid into another network, whichever of its networks are empty. At the published caps every product reaches its cap from empty in list order and keeps flowing while all chests are emptied every second. At reduced caps (a tenth, at least 2) the mall refills after complete collection, recovers after a five-minute outage of every input, holds full stock for an hour without a craft and refills, follows cap edits, and with each outside input withheld from a cold start still fills every product that does not need it and the rest after the input returns. Imported blueprint unchanged in every scenario.',
});

// The scenarios of a qualifying run, by name.
export const FLUID_SCENARIOS = ['ports', ...PROTOCOL.buildOrders.map(n => 'build:' + n), 'late:power', 'late:stone-exit', 'thin:lava', 'thin:calcite', 'starve:supply', 'starve:foundry', ...PROTOCOL.placements.map(n => 'place:' + n)];
export const HANDBACK_SCENARIOS = [...PROTOCOL.handbackScenarios, ...PROTOCOL.outageScenarios];
export const QUALIFICATION = ['fill', 'rate', 'hold', 'caps', 'single', ...PROTOCOL.withheldInputs.map(n => 'skip:' + n), ...FLUID_SCENARIOS, ...HANDBACK_SCENARIOS];

// What one scenario's report says about fluids and construction, in short (an empty Lua table arrives as {}).
const list = v => (Array.isArray(v) ? v : []);
export const scenarioSummary = r => ({ passed: r.passed, crashed: r.crashed || undefined, caps: r.capsName, failures: r.failures, simulatedTicks: r.actualTicks, placement: r.placement, construction: r.construction && { ...r.construction, deferred: list(r.construction.deferred).length },
  foreignFluids: list(r.fluidFaults).map(f => ({ network: f.expected, held: f.found, firstTick: f.tick, phase: f.phase, ticks: f.ticks, peak: Math.round(f.peak), lastTick: f.lastTick, recipes: f.recipes, lavaFoundries: f.lavaFoundries, networks: f.networks })),
  joinedBoxes: list(r.portJoins).map(j => ({ machine: j.machine, recipe: j.recipe, box: j.box, joinedTo: j.joinedTo, seconds: j.seconds })), strayRecipes: list(r.strayRecipes),
  ...(r.matrix ? { matrix: { cases: r.matrix.cases, leaks: list(r.matrix.leaks).map(k => ({ machine: k.machine, from: k.from, to: k.to, empty: Object.entries(k.state).filter(([, full]) => !full).map(([n]) => n), foreign: k.foreign })), joins: list(r.matrix.joins).map(j => ({ machine: j.machine, recipe: j.recipe, box: j.box, joinedTo: j.joinedTo })) } } : {}),
  phases: list(r.phases).map(ph => ({ name: ph.name, minutes: Math.round(ph.ticks / 360) / 10, endedBy: ph.endedBy, ...(ph.holding ? { holding: Object.fromEntries(['U1', 'U2'].filter(k => ph.holding[k]).map(k => [k, ph.holding[k]])), onRing: Object.values(ph.ringAtEnd || {}).reduce((a, b) => a + b, 0) } : {}), ...(ph.emptiedByHand ? { emptiedByHand: ph.emptiedByHand } : {}), ...(ph.flushed ? { flushed: list(ph.flushed).map(v => ({ ...v, amount: Math.round(v.amount) })) } : {}), productsShort: Object.entries(ph.stock || {}).filter(([k, v]) => v < (ph.caps || r.caps)[k]).length })) });
