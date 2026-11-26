// Generator of the foundry belts and fuel mall. Deterministic: a re-run leaves the folder byte-identical.
//   node scripts/requested-malls/foundry-belts-fuel-mall/generate.mjs [--out <folder>]
// Needs only the pinned prototypes.json beside this file and the rocket fuel supply's port tables; no game, no raw dump.
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PUBLISHED, PROTOCOL, prototypes, readJson, json, sha } from './lib.mjs';
import { design, asciiMap } from './design.mjs';
import { fullBill } from './bill.mjs';
import { auditFor } from './audit.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = option('--out') ? path.resolve(option('--out')) : PUBLISHED;
const p = await prototypes();
const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), committedCode: await fs.readFile(path.join(out, 'blueprint.txt'), 'utf8').catch(() => undefined) };
const d = design(p, options);
d.manifest.nativeProtocol = JSON.parse(JSON.stringify(PROTOCOL));
d.manifest.bill = fullBill(p);
const audit = await auditFor(d.blueprint, d.manifest, p);
const report = await readJson(path.join(out, 'native-report.json')).catch(() => null);
const proven = report && report.blueprintSha256 === d.hash && report.passed === true ? report : null;
await fs.mkdir(out, { recursive: true });
const write = (file, text) => fs.writeFile(path.join(out, file), text);
await write('blueprint.txt', d.code + '\n');
await write('manifest.json', json(d.manifest));
await write('ports.json', json({ candidateSha256: d.hash, inputs: d.ports.filter(v => !v.exit), exits: d.ports.filter(v => v.exit), outputs: d.manifest.outputs, power: d.manifest.power, caps: d.manifest.capsCombinator }));
await write('footprint.json', json(d.footprint));
await write('static-audit.json', json(audit));
await write('layout.txt', asciiMap(d, p) + '\n');
const { render } = await import('./readme.mjs').catch(e => { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return { render: null }; });
if (render) for (const [file, text] of Object.entries(await render(d, audit, proven, p, report && report.blueprintSha256 === d.hash ? report : null, out))) await write(file, text);
console.log(JSON.stringify({ out: path.relative(process.cwd(), out), candidateSha256: d.hash, size: `${d.footprint.width} x ${d.footprint.height} = ${d.footprint.area}`, mallPart: `${d.footprint.mallPart.width} x ${d.footprint.mallPart.height}`, fuelPart: `${d.footprint.fuelPart.width} x ${d.footprint.fuelPart.height}`, entities: d.footprint.entities, staticAudit: audit.passed ? `passed ${audit.checksTotal}` : audit.errors, native: proven ? 'passed' : report && report.blueprintSha256 === d.hash ? 'report present, not passed' : 'no report for this string' }, null, 1));
