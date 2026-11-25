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
  targetRate: null,
  acceptance: 'At the published caps every product reaches its cap from empty in list order and keeps flowing while all chests are emptied every second. At reduced caps (a tenth, at least 2) the mall refills after complete collection, recovers after a five-minute outage of every input, holds full stock for an hour without a craft and refills, follows cap edits, and with each outside input withheld from a cold start still fills every product that does not need it and the rest after the input returns. Imported blueprint unchanged in every scenario.',
});
