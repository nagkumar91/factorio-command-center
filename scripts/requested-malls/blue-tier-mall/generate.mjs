// Generator of the blue-tier on-demand mall. Deterministic: a re-run leaves the folder byte-identical.
//   node scripts/requested-malls/blue-tier-mall/generate.mjs            writes blueprint-sources/requested-malls/blue-tier-mall/
//   node scripts/requested-malls/blue-tier-mall/generate.mjs --out <folder> [--input-caps 20,8,16,8,2,2,2]   candidate for exploration
// Needs only the pinned prototypes.json beside this file; no game and no raw dump.
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PUBLISHED, prototypes, readJson, json, sha, box } from './lib.mjs';
import { design, PRODUCTS, STOCK_CAPS, INPUT_ORDER } from './design.mjs';
import { auditBlueprint } from './audit.mjs';
import { readme } from './readme.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = option('--out') ? path.resolve(option('--out')) : PUBLISHED;
const p = await prototypes();
const reference = await readJson(path.join(HERE, 'reference-review.json'));
// The string already in the output folder is kept when it decodes to exactly the generated blueprint (see encodeKeeping in lib.mjs).
const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), committedCode: await fs.readFile(path.join(out, 'blueprint.txt'), 'utf8').catch(() => undefined) };
if (option('--input-caps')) options.inputCaps = Object.fromEntries(option('--input-caps').split(',').map((v, i) => [INPUT_ORDER[i], Number(v)]));
const d = design(p, reference, options);
const audit = auditBlueprint(d.blueprint, d.manifest, p);

// A schematic, not an in-game screenshot. Coordinates and arrows come from the entities.
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const scale = 30, left = 52, top = 95, colors = { 'fast-transport-belt': '#b74c41', 'assembling-machine-2': '#477196', 'fast-inserter': '#41a9d2', pipe: '#75bd95', 'medium-electric-pole': '#e0af60', 'steel-chest': '#8c97a7', 'passive-provider-chest': '#d78352', 'display-panel': '#dac77a' };
const { bounds } = d.footprint;
let shapes = '';
for (const e of d.blueprint.blueprint.entities) {
  const b = box(e, p, 'selection_box'), x = left + (b.left - bounds.left) * scale, y = top + (b.top - bounds.top) * scale;
  shapes += `<g><title>#${e.entity_number} ${esc(e.recipe || e.text || e.name)} (${e.position.x}, ${e.position.y})</title><rect x="${x}" y="${y}" width="${(b.right - b.left) * scale}" height="${(b.bottom - b.top) * scale}" rx="3" fill="${colors[e.name]}" stroke="#101b29"/>`;
  const cx = left + (e.position.x - bounds.left) * scale, cy = top + (e.position.y - bounds.top) * scale;
  if (e.name.includes('belt') || e.name === 'fast-inserter') {
    const actual = e.name === 'fast-inserter' ? ((e.direction || 0) + 8) % 16 : e.direction;
    shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-size="16">${{ 0: '↑', 4: '→', 8: '↓', 12: '←' }[actual]}</text>`;
  }
  if (e.recipe) shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-size="18">${PRODUCTS.indexOf(e.recipe) + 1}</text>`;
  if (e.name === 'steel-chest') shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#101b29" font-size="13">I${d.ports.find(v => v.chest === e.entity_number).id.slice(3)}</text>`;
  shapes += '</g>';
}
const width = Math.max(840, left * 2 + d.footprint.width * scale), legendTop = top + d.footprint.height * scale + 40, height = legendTop + 190;
const legend = PRODUCTS.map((n, i) => `<text x="${52 + (i > 3 ? 400 : 0)}" y="${legendTop + (i % 4) * 25}" fill="#e8eff7" font-size="16">${i + 1}. ${n} — stock ${STOCK_CAPS[n]}</text>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="52" y="38" fill="#f2f6fc" font-size="25">Blue-tier on-demand mall</text><text x="52" y="66" fill="#a8bed4" font-size="16">${d.footprint.width} × ${d.footprint.height} tiles · 7 AM2 · 1 provider · schematic</text>${shapes}${legend}<text x="52" y="${legendTop + 125}" fill="#a8bed4" font-size="14">North: 7 material chests · West: lubricant · Green circuit reads the whole ring + provider</text><text x="52" y="${legendTop + 151}" fill="#a8bed4" font-size="14">Three direct hand-offs: yellow → long / fast; fast → bulk. All handling arms are fast inserters.</text></g></svg>\n`;

await fs.mkdir(out, { recursive: true });
const write = (file, text) => fs.writeFile(path.join(out, file), text);
await write('blueprint.txt', d.code + '\n');
await write('manifest.json', json(d.manifest));
await write('ports.json', json({ candidateSha256: d.hash, inputs: d.ports, output: d.manifest.output, power: d.manifest.power }));
await write('footprint.json', json(d.footprint));
await write('static-audit.json', json(audit));
await write('layout.svg', svg);
// The README states the native result only from a committed report for exactly this string.
const report = await readJson(path.join(out, 'native-report.json')).catch(() => null);
// The first published version, kept for the comparison table.
const firstFolder = 'four-row-ring-6762edae', firstDir = path.join(PUBLISHED, 'history', firstFolder);
const firstManifest = await readJson(path.join(firstDir, 'manifest.json')).catch(() => null);
const first = firstManifest && { folder: firstFolder, manifest: firstManifest, rerun: await readJson(path.join(firstDir, 'rerun-native-report.json')).catch(() => null) };
await write('README.md', readme(d, audit, report && report.blueprintSha256 === d.hash ? report : null, p, first));
console.log(JSON.stringify({ out: path.relative(process.cwd(), out), candidateSha256: d.hash, size: `${d.footprint.width} x ${d.footprint.height} = ${d.footprint.area}`, counts: d.footprint.counts, staticAudit: audit.passed ? `passed ${audit.checksTotal}` : audit.errors, native: report && report.blueprintSha256 === d.hash ? (report.passed ? 'passed' : 'failed') : 'no report for this string' }, null, 2));
if (!audit.passed) process.exitCode = 1;
