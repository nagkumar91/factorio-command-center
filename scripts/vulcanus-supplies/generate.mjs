// Generator of a Vulcanus supply blueprint folder. Deterministic: a re-run leaves the folder byte-identical.
//   node scripts/vulcanus-supplies/generate.mjs <id>                       writes blueprint-sources/vulcanus-supplies/<id>/
//   node scripts/vulcanus-supplies/generate.mjs <id> --out <folder>        candidate folder for exploration
// Needs only the pinned prototypes.json and fluid-slots.json beside this file; no game and no raw dump.
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, published, prototypes, fluidSlots, readJson, json, sha, box, exists, ascii } from './lib.mjs';
import { auditBlueprint } from './audit.mjs';
import { summarize } from './summary.mjs';
import { layoutSvg } from './svg.mjs';

const args = process.argv.slice(2);
const id = args[0];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = option('--out') ? path.resolve(option('--out')) : published(id);
const [p, slots] = await Promise.all([prototypes(), fluidSlots()]);
const { design } = await import(path.join(HERE, id, 'design.mjs'));
const { readme } = await import(path.join(HERE, id, 'readme.mjs')).catch(() => ({ readme: null }));
// The string already in the output folder is kept when it decodes to exactly the generated blueprint (see encodeKeeping in the shared lib).
const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256: sha(await fs.readFile(path.join(HERE, 'fluid-slots.json'))), committedCode: await fs.readFile(path.join(out, 'blueprint.txt'), 'utf8').catch(() => undefined) };
const d = design(p, slots, options);
const audit = auditBlueprint(d.blueprint, d.manifest, p, slots);

// The native report is stated only when it is for exactly this string and passed.
const report = await readJson(path.join(out, 'native-report.json')).catch(() => null);
const exact = report && report.blueprintSha256 === d.hash ? report : null;
const proven = exact && exact.passed === true ? exact : null;
if (proven) {
  d.manifest.measured = proven.measured;
  d.manifest.outputsPerMinute = proven.measured.outputsPerMinute;
  d.manifest.inputsPerMinute = proven.measured.inputsPerMinute;
}
await fs.mkdir(out, { recursive: true });
const write = (file, text) => fs.writeFile(path.join(out, file), text);
await write('blueprint.txt', d.code + '\n');
await write('manifest.json', json(d.manifest));
await write('ports.json', json({ ...d.ports, measuredInputsPerMinute: proven?.measured.inputsPerMinute, measuredOutputsPerMinute: proven?.measured.outputsPerMinute }));
await write('footprint.json', json(d.footprint));
await write('static-audit.json', json(audit));
await write('layout.svg', layoutSvg(d, p));
if (readme) await write('README.md', readme(d, audit, proven, p, exact, slots));
console.log(JSON.stringify({ out: path.relative(process.cwd(), out), candidateSha256: d.hash, size: `${d.footprint.width} x ${d.footprint.height} = ${d.footprint.area}`, counts: d.footprint.counts, staticAudit: audit.passed ? `passed ${audit.checksTotal}` : audit.errors, native: proven ? 'passed' : exact ? 'report present, not passed' : 'no report for this string' }, null, 2));
if (!audit.passed) process.exitCode = 1;
