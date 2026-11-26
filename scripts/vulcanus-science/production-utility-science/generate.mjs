// Generator of the Vulcanus science blueprint folder. Deterministic: a re-run leaves the folder byte-identical.
//   node scripts/vulcanus-science/production-utility-science/generate.mjs [--out <folder>]
// Needs only the pinned prototypes.json and fluid-slots.json beside this file; no game and no raw dump.
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PUBLISHED, prototypes, fluidSlots, readJson, json, sha } from './lib.mjs';
import { design } from './design.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = option('--out') ? path.resolve(option('--out')) : PUBLISHED;
const [p, slots] = await Promise.all([prototypes(), fluidSlots()]);
const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), fluidSlotsSha256: sha(await fs.readFile(path.join(HERE, 'fluid-slots.json'))), committedCode: await fs.readFile(path.join(out, 'blueprint.txt'), 'utf8').catch(() => undefined) };
const d = design(p, slots, options);
const { PROTOCOL } = await import('./protocol.mjs').catch(() => ({ PROTOCOL: null }));
if (PROTOCOL) d.manifest.nativeProtocol = JSON.parse(JSON.stringify(PROTOCOL));
const { auditBlueprint } = await import('./audit.mjs').catch(() => ({ auditBlueprint: null }));
const audit = auditBlueprint ? auditBlueprint(d.blueprint, d.manifest, p, slots) : { passed: false, checksTotal: 0, errors: ['audit.mjs is not written yet'] };
const report = await readJson(path.join(out, 'native-report.json')).catch(() => null);
const exact = report && report.blueprintSha256 === d.hash ? report : null, proven = exact && exact.passed === true ? exact : null;
await fs.mkdir(out, { recursive: true });
const write = (file, text) => fs.writeFile(path.join(out, file), text);
await write('blueprint.txt', d.code + '\n');
await write('manifest.json', json(d.manifest));
await write('ports.json', json({ candidateSha256: d.hash, inputs: d.ports.filter(v => !v.exit), exits: d.ports.filter(v => v.exit), outputs: d.manifest.outputs, power: d.manifest.power, measured: proven?.measured?.ports }));
await write('footprint.json', json(d.footprint));
await write('static-audit.json', json(audit));
const { render } = await import('./readme.mjs').catch(() => ({ render: null }));
if (render) for (const [file, text] of Object.entries(await render(d, audit, proven, p, exact))) await write(file, text);
console.log(JSON.stringify({ out: path.relative(process.cwd(), out), candidateSha256: d.hash, size: `${d.footprint.width} x ${d.footprint.height} = ${d.footprint.area}`, entities: d.footprint.entities, substations: d.footprint.counts.substation, staticAudit: audit.passed ? `passed ${audit.checksTotal}` : audit.errors, native: proven ? 'passed' : exact ? 'report present, not passed' : 'no report for this string' }, null, 1));
