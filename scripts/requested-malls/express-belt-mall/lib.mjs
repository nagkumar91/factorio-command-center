// Shared helpers for the express belt mall: generator, static audit, native validator and tests.
// Everything that does not depend on the mall itself comes unchanged from the blue-tier mall's helpers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
export { sha, readJson, json, encode, encodeKeeping, decode, vector, coord, distance, allWires, rotate, box, intersects, contact, inside, filters, condition, envelope, technologyClosure } from '../blue-tier-mall/lib.mjs';
import { readJson } from '../blue-tier-mall/lib.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../../..');
export const ID = 'express-belt-mall';
export const PUBLISHED = path.join(PROJECT, 'blueprint-sources/requested-malls', ID);
export const prototypes = () => readJson(path.join(HERE, 'prototypes.json'));
export const exists = file => fs.access(file).then(() => true, () => false);
// The native protocol that qualifies a published version. A full run must use exactly this (see validate.mjs and control.lua).
// Ticks: stock fill from empty (bounded, generous: the splitter's advanced circuits dominate), refill after a complete
// collection, input outage, recovery, then the rate phase (all three chests emptied every second).
export const PROTOCOL = Object.freeze({
  seed: 21024, stockFillTicks: 324000, refillTicks: 324000, outageTicks: 18000, recoveryTicks: 324000,
  warmupTicks: 54000, measureTicks: 108000, externalPowerWatts: 10000000, samplingTicks: 3600, collectEveryTicks: 60,
  targetRate: null,
  acceptance: 'All three express products reach one full stack in their own passive provider chest from empty, refill after complete collection, recover after a five-minute input outage, and keep being made while all three chests are emptied every second; imported blueprint unchanged.',
});
// The 64-bit version number a blueprint of this game version carries (major, minor, patch, build).
export const blueprintVersion = gameVersion => { const [a, b, c] = gameVersion.split('.').map(BigInt); return Number((a << 48n) + (b << 32n) + (c << 16n)); };
