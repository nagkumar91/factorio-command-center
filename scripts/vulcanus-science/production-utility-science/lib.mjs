// Shared helpers of the Vulcanus science blueprint (production and utility science packs from lava and calcite): generator,
// static audit, native validator, README and tests. What is not specific to it comes unchanged from the blue-tier mall's helpers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
export { sha, readJson, json, encode, encodeKeeping, decode, vector, coord, distance, allWires, rotate, box, intersects, contact, inside, envelope, technologyClosure } from '../../requested-malls/blue-tier-mall/lib.mjs';
import { readJson } from '../../requested-malls/blue-tier-mall/lib.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../../..');
export const ID = 'production-utility-science';
// VULCANUS_SCIENCE_PUBLISHED lets the tests and tools look at a candidate folder instead of the published one.
export const PUBLISHED = process.env.VULCANUS_SCIENCE_PUBLISHED ? path.resolve(process.env.VULCANUS_SCIENCE_PUBLISHED) : path.join(PROJECT, 'blueprint-sources/vulcanus-science', ID);
export const prototypes = () => readJson(path.join(HERE, 'prototypes.json'));
export const fluidSlots = () => readJson(path.join(HERE, 'fluid-slots.json'));
export const exists = file => fs.access(file).then(() => true, () => false);
// The 64-bit version number a blueprint of this game version carries (major, minor, patch, build).
export const blueprintVersion = gameVersion => { const [a, b, c] = gameVersion.split('.').map(BigInt); return Number((a << 48n) + (b << 32n) + (c << 16n)); };
export const N = 0, E = 4, S = 8, W = 12;
export const VEC = { 0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0] };
export const opposite = d => (d + 8) % 16;
