// Generator of the assembling-machine-3 supply mall. Deterministic: a re-run leaves the folder byte-identical.
//   node scripts/requested-malls/assembler-3-mall/generate.mjs            writes blueprint-sources/requested-malls/assembler-3-mall/
//   node scripts/requested-malls/assembler-3-mall/generate.mjs --out <folder> [--caps iron-plate=12,steel-plate=4,...] [--arrangement one-row]
// Needs only the pinned prototypes.json beside this file; no game and no raw dump.
import fs from 'node:fs/promises';
import path from 'node:path';
import { HERE, PUBLISHED, prototypes, readJson, json, sha, box } from './lib.mjs';
import { design, RECIPES } from './design.mjs';
import { auditBlueprint } from './audit.mjs';
import { readme } from './readme.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = option('--out') ? path.resolve(option('--out')) : PUBLISHED;
const p = await prototypes();
// The string already in the output folder is kept when it decodes to exactly the generated blueprint (see encodeKeeping in lib.mjs).
const options = { prototypeSha256: sha(await fs.readFile(path.join(HERE, 'prototypes.json'))), committedCode: await fs.readFile(path.join(out, 'blueprint.txt'), 'utf8').catch(() => undefined) };
if (option('--caps')) options.caps = Object.fromEntries(option('--caps').split(',').map(v => { const [k, n] = v.split('='); return [k, Number(n)]; }));
// Both arrangements are built; the smaller selection envelope is published unless one is named.
const trials = Object.fromEntries(['two-row', 'one-row'].map(arrangement => { const d = design(p, { ...options, arrangement }); return [arrangement, { d, audit: auditBlueprint(d.blueprint, d.manifest, p) }]; }));
const arrangement = option('--arrangement') || Object.keys(trials).sort((a, b) => trials[a].d.footprint.area - trials[b].d.footprint.area)[0];
const { d, audit } = trials[arrangement];
d.manifest.arrangementTrial = Object.fromEntries(Object.entries(trials).map(([name, t]) => [name, { width: t.d.footprint.width, height: t.d.footprint.height, area: t.d.footprint.area, entities: t.d.footprint.entities, staticAudit: t.audit.passed ? `passed ${t.audit.checksTotal}` : t.audit.errors, published: name === arrangement }]));

// A schematic, not an in-game screenshot. Coordinates and arrows come from the entities.
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const scale = 32, left = 40, top = 100, colors = { 'fast-transport-belt': '#b74c41', 'assembling-machine-2': '#477196', 'fast-inserter': '#41a9d2', 'medium-electric-pole': '#e0af60', 'passive-provider-chest': '#d78352', 'display-panel': '#dac77a' };
const { bounds } = d.footprint;
const number = recipe => RECIPES.indexOf(recipe) + 1;
let shapes = '';
for (const e of d.blueprint.blueprint.entities) {
  const b = box(e, p, 'selection_box'), x = left + (b.left - bounds.left) * scale, y = top + (b.top - bounds.top) * scale;
  const label = e.recipe || e.text || e.name;
  shapes += `<g><title>#${e.entity_number} ${esc(label)} (${e.position.x}, ${e.position.y})</title><rect x="${x}" y="${y}" width="${(b.right - b.left) * scale}" height="${(b.bottom - b.top) * scale}" rx="3" fill="${colors[e.name]}" stroke="#101b29"/>`;
  const cx = left + (e.position.x - bounds.left) * scale, cy = top + (e.position.y - bounds.top) * scale;
  if (e.name.includes('belt') || e.name === 'fast-inserter') {
    const actual = e.name === 'fast-inserter' ? ((e.direction || 0) + 8) % 16 : e.direction;
    shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-size="16">${{ 0: '↑', 4: '→', 8: '↓', 12: '←' }[actual]}</text>`;
  }
  if (e.recipe) shapes += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#fff" font-size="20">${number(e.recipe)}</text>`;
  if (e.name === 'passive-provider-chest') shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#101b29" font-size="13">${d.manifest.outputs.find(o => o.chest === e.entity_number).item.endsWith('3') ? '3' : '2'}</text>`;
  if (e.name === 'display-panel') shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#101b29" font-size="12">D</text>`;
  shapes += '</g>';
}
const width = Math.max(1000, left * 2 + d.footprint.width * scale), legendTop = top + d.footprint.height * scale + 40, height = legendTop + 200;
const legend = RECIPES.map((n, i) => `<text x="${40 + (i > 3 ? 380 : 0)}" y="${legendTop + (i % 4) * 25}" fill="#e8eff7" font-size="16">${i + 1}. ${n}</text>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="40" y="38" fill="#f2f6fc" font-size="25">Assembling machine 3 supply mall</text><text x="40" y="66" fill="#a8bed4" font-size="16">${d.footprint.width} × ${d.footprint.height} tiles · 8 AM2 · 2 provider chests · schematic</text>${shapes}${legend}<text x="40" y="${legendTop + 125}" fill="#a8bed4" font-size="14">West: four belt entrances (iron, steel, copper, plastic) · D = display panels · amber = provider chests (2 = AM2, 3 = AM3)</text><text x="40" y="${legendTop + 151}" fill="#a8bed4" font-size="14">Always-on direct hand-offs: cable → circuit, cable → advanced circuit, advanced circuit → speed module, gear → AM1 and AM2, AM2 → chest → AM3.</text><text x="40" y="${legendTop + 177}" fill="#a8bed4" font-size="14">Green circuit reads the whole ring; every feed arm and ring product arm is capped by it. All arms are fast inserters.</text></g></svg>\n`;

await fs.mkdir(out, { recursive: true });
const write = (file, text) => fs.writeFile(path.join(out, file), text);
await write('blueprint.txt', d.code + '\n');
await write('manifest.json', json(d.manifest));
await write('ports.json', json({ candidateSha256: d.hash, inputs: d.ports, outputs: d.manifest.outputs, power: d.manifest.power }));
await write('footprint.json', json(d.footprint));
await write('static-audit.json', json(audit));
await write('layout.svg', svg);
// The README states the native result only from a committed report for exactly this string.
const report = await readJson(path.join(out, 'native-report.json')).catch(() => null);
await write('README.md', readme(d, audit, report && report.blueprintSha256 === d.hash ? report : null, p));
console.log(JSON.stringify({ out: path.relative(process.cwd(), out), arrangement, candidateSha256: d.hash, size: `${d.footprint.width} x ${d.footprint.height} = ${d.footprint.area}`, trial: d.manifest.arrangementTrial, counts: d.footprint.counts, staticAudit: audit.passed ? `passed ${audit.checksTotal}` : audit.errors, native: report && report.blueprintSha256 === d.hash ? (report.passed ? 'passed' : 'failed') : 'no report for this string' }, null, 2));
if (!audit.passed) process.exitCode = 1;
