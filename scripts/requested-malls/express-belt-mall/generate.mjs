// Generator of the express belt mall. Deterministic: a re-run leaves the folder byte-identical.
//   node scripts/requested-malls/express-belt-mall/generate.mjs            writes blueprint-sources/requested-malls/express-belt-mall/
//   node scripts/requested-malls/express-belt-mall/generate.mjs --out <folder> [--caps iron-plate=16,iron-gear-wheel=24]   candidate for exploration
// Needs only the pinned prototypes.json beside this file; no game and no raw dump.
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PUBLISHED, prototypes, readJson, json, sha, box, exists } from './lib.mjs';
import { design, PRODUCTS } from './design.mjs';
import { auditBlueprint } from './audit.mjs';
import { readme, loadExplorations } from './readme.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = option('--out') ? path.resolve(option('--out')) : PUBLISHED;
const p = await prototypes();
// The string already in the output folder is kept when it decodes to exactly the generated blueprint (see encodeKeeping in lib.mjs).
const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), committedCode: await fs.readFile(path.join(out, 'blueprint.txt'), 'utf8').catch(() => undefined) };
if (option('--caps')) options.ringCaps = Object.fromEntries(option('--caps').split(',').map(v => { const [k, n] = v.split('='); return [k, Number(n)]; }));
const d = design(p, options);
const audit = auditBlueprint(d.blueprint, d.manifest, p);

// The native report is stated only when it is for exactly this string and passed.
const report = await readJson(path.join(out, 'native-report.json')).catch(() => null);
const proven = report && report.blueprintSha256 === d.hash && report.passed === true ? report : null;
if (proven?.measured) {
  d.manifest.measured = proven.measured;
  d.manifest.requiredInputsPerMinute = proven.measured.inputsPerMinute;
  d.manifest.outputsPerMinute = proven.measured.outputsPerMinute;
}

// A schematic, not an in-game screenshot. Coordinates and arrows come from the entities.
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const scale = 24, left = 40, top = 78;
const colors = { 'fast-transport-belt': '#b74c41', 'fast-underground-belt': '#8a3a31', 'assembling-machine-2': '#477196', 'fast-inserter': '#41a9d2', pipe: '#75bd95', 'medium-electric-pole': '#e0af60', 'passive-provider-chest': '#d78352', 'display-panel': '#dac77a' };
const short = { 'iron-gear-wheel': 'gear', 'copper-cable': 'cable', 'electronic-circuit': 'green', 'advanced-circuit': 'red', 'transport-belt': 'belt', 'underground-belt': 'ug', splitter: 'split', 'fast-transport-belt': 'fast belt', 'fast-underground-belt': 'fast ug', 'fast-splitter': 'fast split', 'express-transport-belt': 'EXPRESS belt', 'express-underground-belt': 'EXPRESS ug', 'express-splitter': 'EXPRESS split' };
const { bounds } = d.footprint;
let shapes = '';
for (const e of d.blueprint.blueprint.entities) {
  const b = box(e, p, 'selection_box'), x = left + (b.left - bounds.left) * scale, y = top + (b.top - bounds.top) * scale;
  shapes += `<g><title>#${e.entity_number} ${esc(e.recipe || e.text || e.name)} (${e.position.x}, ${e.position.y})</title><rect x="${x}" y="${y}" width="${(b.right - b.left) * scale}" height="${(b.bottom - b.top) * scale}" rx="2" fill="${colors[e.name]}" stroke="#101b29"/>`;
  const cx = left + (e.position.x - bounds.left) * scale, cy = top + (e.position.y - bounds.top) * scale;
  if (e.name.includes('belt') || e.name === 'fast-inserter') {
    const actual = e.name === 'fast-inserter' ? ((e.direction || 0) + 8) % 16 : e.direction;
    shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="13">${{ 0: '↑', 4: '→', 8: '↓', 12: '←' }[actual]}</text>`;
  }
  if (e.recipe) shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="11">${esc(short[e.recipe])}</text>`;
  shapes += '</g>';
}
const width = left * 2 + d.footprint.width * scale, height = top + d.footprint.height * scale + 70;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="${left}" y="32" fill="#f2f6fc" font-size="22">Express belt mall</text><text x="${left}" y="56" fill="#a8bed4" font-size="14">${d.footprint.width} × ${d.footprint.height} tiles · 15 AM2 · 3 provider chests · schematic</text>${shapes}<text x="${left}" y="${height - 36}" fill="#a8bed4" font-size="13">West: iron (row 3), copper (row 0), plastic (row 1) belts · South: lubricant pipe · North east: three provider chests</text><text x="${left}" y="${height - 14}" fill="#a8bed4" font-size="13">Gear makers hand gears straight to their neighbours; cable never rides the ring; everything else rides one capped ring.</text></g></svg>\n`;

await fs.mkdir(out, { recursive: true });
const write = (file, text) => fs.writeFile(path.join(out, file), text);
await write('blueprint.txt', d.code + '\n');
await write('manifest.json', json(d.manifest));
await write('ports.json', json({ candidateSha256: d.hash, inputs: d.ports, outputs: d.manifest.outputs, power: d.manifest.power }));
await write('footprint.json', json(d.footprint));
await write('static-audit.json', json(audit));
await write('layout.svg', svg);
await write('README.md', readme(d, audit, proven, p, report && report.blueprintSha256 === d.hash ? report : null, await loadExplorations(out)));
console.log(JSON.stringify({ out: path.relative(process.cwd(), out), candidateSha256: d.hash, size: `${d.footprint.width} x ${d.footprint.height} = ${d.footprint.area}`, counts: d.footprint.counts, staticAudit: audit.passed ? `passed ${audit.checksTotal}` : audit.errors, native: proven ? 'passed' : report && report.blueprintSha256 === d.hash ? 'report present, not passed' : 'no report for this string' }, null, 2));
if (!audit.passed) process.exitCode = 1;
