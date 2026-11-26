// Generator of a Vulcanus circuit blueprint folder. Deterministic: a re-run leaves the folder byte-identical.
//   node scripts/vulcanus-circuits/generate.mjs <id>                       writes blueprint-sources/vulcanus-circuits/<id>/
//   node scripts/vulcanus-circuits/generate.mjs <id> --out <folder>        candidate folder for exploration
// Needs only the pinned prototypes.json and fluid-slots.json beside this file; no game and no raw dump.
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, published, prototypes, fluidSlots, readJson, json, sha, ascii } from './lib.mjs';
import { auditBlueprint } from './audit.mjs';

const args = process.argv.slice(2), id = args[0];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = option('--out') ? path.resolve(option('--out')) : published(id);
const [p, slots] = await Promise.all([prototypes(), fluidSlots()]);
const { design } = await import(path.join(HERE, id, 'design.mjs'));
// The string already in the output folder is kept when it decodes to exactly the generated blueprint (see encodeKeeping in the shared lib).
const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256: sha(await fs.readFile(path.join(HERE, 'fluid-slots.json'))), committedCode: await fs.readFile(path.join(out, 'blueprint.txt'), 'utf8').catch(() => undefined) };
const d = design(p, slots, options);
const { PROTOCOL } = await import('./scenario.mjs').catch(() => ({ PROTOCOL: null }));
if (PROTOCOL) d.manifest.nativeProtocol = JSON.parse(JSON.stringify(PROTOCOL));
const audit = auditBlueprint(d.blueprint, d.manifest, p, slots);
// The native report is stated only when it is for exactly this string and passed.
const report = await readJson(path.join(out, 'native-report.json')).catch(() => null);
const exact = report && report.blueprintSha256 === d.hash ? report : null, proven = exact && exact.passed === true ? exact : null;
if (proven) d.manifest.measured = proven.measured;
await fs.mkdir(out, { recursive: true });
const write = (file, text) => fs.writeFile(path.join(out, file), text);
await write('blueprint.txt', d.code + '\n');
await write('manifest.json', json(d.manifest));
await write('ports.json', json({ ...d.ports, measured: proven ? { generous: proven.measured.generous, throttled: proven.measured.throttled } : undefined }));
await write('footprint.json', json(d.footprint));
await write('static-audit.json', json(audit));
const { layoutSvg } = await import('./svg.mjs').catch(() => ({ layoutSvg: null }));
if (layoutSvg) await write('layout.svg', layoutSvg(d, p));
const { readme } = await import('./readme.mjs').catch(e => { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return { readme: null }; });
if (readme) await write('README.md', readme(d, audit, proven, p, exact));
console.log(JSON.stringify({ out: path.relative(process.cwd(), out), candidateSha256: d.hash, size: `${d.footprint.width} x ${d.footprint.height} = ${d.footprint.area}`, entities: d.footprint.entities, staticAudit: audit.passed ? `passed ${audit.checksTotal}` : audit.checks.filter(c => !c.passed), native: proven ? 'passed' : exact ? 'report present, not passed' : 'no report for this string' }, null, 1));
if (!audit.passed) process.exitCode = 1;
