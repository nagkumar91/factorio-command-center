// Shared helpers for the assembling-machine-3 supply mall: generator, static audit, native validator and tests.
// Everything that is not specific to this mall comes unchanged from the blue-tier mall's lib (never copied).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export {
  sha, readJson, json, encode, encodeKeeping, decode, vector, coord, distance, allWires, rotate, box, intersects, contact, inside,
  filters, condition, envelope, technologyClosure,
} from '../blue-tier-mall/lib.mjs';
import { readJson } from '../blue-tier-mall/lib.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../../..');
export const ID = 'assembler-3-mall';
// AM3_MALL_PUBLISHED lets the tests and tools look at a candidate folder instead of the published one.
export const PUBLISHED = process.env.AM3_MALL_PUBLISHED ? path.resolve(process.env.AM3_MALL_PUBLISHED) : path.join(PROJECT, 'blueprint-sources/requested-malls', ID);
export const prototypes = () => readJson(path.join(HERE, 'prototypes.json'));

// The native protocol a full run uses. Fill phases are bounded, not fixed: each ends as soon as both provider
// chests hold 50, or fails at its limit. Times are game ticks (60 per second).
export const PROTOCOL = Object.freeze({
  seed: 21024,
  sequence: ['fill', 'refill', 'outage', 'recovery', 'hold', 'resume', 'rate-both', 'rate-am3'],
  fillLimitTicks: 864000,       // 4 game hours; a full stack of 50 assembling machines 3 takes over two hours
  refillLimitTicks: 864000,
  outageTicks: 18000,           // 5 minutes without any input
  recoveryLimitTicks: 864000,
  holdTicks: 216000,            // one hour at full stock, nothing collected
  resumeTicks: 36000,           // 10 minutes after that collection
  rateWarmupTicks: 54000,       // 15 minutes
  rateMeasureTicks: 108000,     // 30 minutes
  am2FullLimitTicks: 216000,    // one hour: before the AM3-only rate phase the AM2 chest must be full again
  externalPowerWatts: 5000000,
  samplingTicks: 18000,
  targetRate: null,
  acceptance: 'Both provider chests reach 50 from empty, refill after complete collection, recover after a five-minute input outage, hold full stock for an hour without overflow and resume after collection; rates are measured, not promised. Imported blueprint unchanged.',
});
