// Generator of blueprint-sources/metallurgic-compact/. Deterministic: a re-run leaves the folder byte-identical (the committed string
// is kept when it decodes to exactly the generated blueprint).
//   node scripts/metallurgic-compact/generate.mjs [--out <folder>]
// Needs only the pinned prototypes.json and fluid-slots.json beside this file; no game.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha, readJson, json, ascii, tilesOf } from '../vulcanus-circuits/lib.mjs';
import { design } from './design.mjs';
import { assemble, audit } from './package.mjs';
import { readme } from './readme.mjs';
import { layoutSvg } from './svg.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../..');
export const OUT = path.join(PROJECT, 'blueprint-sources/metallurgic-compact');
export const pins = async () => ({ p: await readJson(path.join(HERE, 'prototypes.json')), slots: await readJson(path.join(HERE, 'fluid-slots.json')), prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256: sha(await fs.readFile(path.join(HERE, 'fluid-slots.json'))) });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), i = args.indexOf('--out');
  const out = i >= 0 ? path.resolve(args[i + 1]) : OUT;
  const { p, slots, prototypeSha256, fluidSlotsSha256 } = await pins();
  const committedCode = await fs.readFile(path.join(out, 'blueprint.txt'), 'utf8').catch(() => undefined);
  const d = assemble(design(p, slots), p, slots, { prototypeSha256, fluidSlotsSha256, committedCode });
  const result = audit(d.code, d.manifest, p, slots);
  // The native report is stated only when it is for exactly this string and passed.
  const report = await readJson(path.join(out, 'native-report.json')).catch(() => null);
  const proven = report && report.blueprintSha256 === d.hash && report.passed === true ? report : null;
  if (proven) d.manifest.measured = proven.measured;
  await fs.mkdir(out, { recursive: true });
  const write = (file, text) => fs.writeFile(path.join(out, file), text);
  await write('blueprint.txt', d.code + '\n');
  await write('manifest.json', json(d.manifest));
  await write('footprint.json', json(d.footprint));
  await write('static-audit.json', json(result));
  await write('layout.svg', layoutSvg(d, p));
  await write('README.md', readme(d, result, proven, ascii(d.layout.entities)));
  console.log(JSON.stringify({ out: path.relative(process.cwd(), out), candidateSha256: d.hash, size: `${d.footprint.width} x ${d.footprint.height} = ${d.footprint.area}`, entities: d.footprint.entities, counts: d.footprint.counts, staticAudit: result.passed ? `passed ${result.checksTotal}` : result.errors, native: proven ? 'passed' : report ? 'report present, not for this string or not passed' : 'no report' }, null, 2));
  if (!result.passed) process.exitCode = 1;
}

