// Write the three Luna compact strings, their native specs and their manifest rows.
// node scripts/recovered-workshops/generate.mjs
// Needs no prototype dump. Re-running leaves blueprint-sources/recovered-workshops/ byte-identical.
// The robot-ready forest rows in the manifest are kept exactly as they are.
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {encodeBlueprint} from '../blueprints.mjs';
import {circuits180, circuits360, redScience90} from './luna-designs.mjs';

export const SOURCE = 'blueprint-sources/recovered-workshops';
const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..', SOURCE);
const sha = text => createHash('sha256').update(text).digest('hex');
const SIZE = {'assembling-machine-2': 3};

/** Bounding rectangle in tiles, counting every entity including panels and poles. */
export function footprint(blueprint) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of blueprint.blueprint.entities) {
    const half = (SIZE[e.name] || 1) / 2;
    x0 = Math.min(x0, e.position.x - half); y0 = Math.min(y0, e.position.y - half);
    x1 = Math.max(x1, e.position.x + half); y1 = Math.max(y1, e.position.y + half);
  }
  return {width: x1 - x0, height: y1 - y0};
}

const ROWS = [
  {make: circuits180, name: 'Luna compact circuits · 180/min', purpose: 'Circuit production', products: ['electronic-circuit'],
    history: 'history/return-belt-35dd7204'},
  {make: circuits360, name: 'Luna compact circuits · 360/min', purpose: 'Circuit production', products: ['electronic-circuit'],
    history: 'history/return-belt-pair-bf4d6a63'},
  {make: redScience90, name: 'Luna compact red science · 90/min', purpose: 'Science production', products: ['automation-science-pack'],
    history: 'history/edge-columns-1231f0ae'},
];

// zlib's compressed bytes differ between builds (the Linux deploy runner on Node 24 and this Mac give different strings for the same JSON).
// Keep the committed string when it decodes to exactly this blueprint, so its SHA-256 and native report stay valid on any machine.
function encodeKeeping(blueprint, file) {
  let committed;
  try { committed = readFileSync(file, 'utf8').trim(); } catch { committed = undefined; }
  try { if (committed && inflateSync(Buffer.from(committed.slice(1), 'base64')).toString('utf8') === JSON.stringify(blueprint)) return committed; } catch {}
  return encodeBlueprint(blueprint);
}

export function designs() {
  return ROWS.map(row => {
    const c = row.make();
    const code = encodeKeeping(c.blueprint, path.join(folder, c.id + '.txt'));
    return {...row, id: c.id, blueprint: c.blueprint, spec: c.spec, code, blueprintSha256: sha(code), footprint: footprint(c.blueprint)};
  });
}

export function manifestRow(d) {
  return {
    id: d.id, name: d.name, file: d.id + '.txt', report: d.id + '-native.json', blueprintSha256: d.blueprintSha256,
    products: d.products, inputs: d.spec.inputs.map(p => ({item: p.name})),
    category: 'Luna compact production', purpose: d.purpose, footprint: d.footprint, previousVersion: d.history,
  };
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const all = designs();
  const manifestPath = path.join(folder, 'manifest.json');
  const old = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const forests = old.filter(row => !row.id.startsWith('luna-'));
  for (const d of all) await fs.writeFile(path.join(folder, d.id + '.txt'), d.code + '\n');
  await fs.writeFile(path.join(folder, 'luna-specs.json'), JSON.stringify(all.map(d => d.spec), null, 2) + '\n');
  await fs.writeFile(manifestPath, JSON.stringify([...all.map(manifestRow), ...forests], null, 2) + '\n');
  for (const d of all) {
    let status = 'no report';
    try {
      const r = JSON.parse(await fs.readFile(path.join(folder, d.id + '-native.json'), 'utf8'));
      status = r.blueprintSha256 === d.blueprintSha256 ? (r.passed ? 'qualified' : 'report failed') : 'report is for another string';
    } catch {}
    console.log(d.id, d.blueprintSha256, d.footprint.width + 'x' + d.footprint.height, status);
  }
}
