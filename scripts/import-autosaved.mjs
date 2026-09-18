// Maintenance only. The finished site never makes a network request.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { decodeBlueprint, encodeBlueprint, blueprintMaterials } from './blueprints.mjs';
import { writeData } from './write-data.mjs';
import '../site/lib/production.js';

const source = 'https://autosaved.org/factorio/blueprints';
const bookURL = 'https://autosaved.org/files/factorio/AllBlueprints.txt';
await fs.mkdir('.cache/autosaved', { recursive: true });
async function cached(name, url) {
  if (!process.argv.includes('--refresh')) {
    try { return await fs.readFile(`.cache/autosaved/${name}`, 'utf8'); } catch {}
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  const content = await response.text();
  await fs.writeFile(`.cache/autosaved/${name}`, content);
  return content;
}
const [html, masterText, catalogText, dataText, libraryText] = await Promise.all([
  cached('page.html', source), cached('AllBlueprints.txt', bookURL),
  fs.readFile('site/data/catalog.json', 'utf8'), fs.readFile('site/data/production.json', 'utf8'), fs.readFile('site/data/library.json', 'utf8'),
]);
const catalog = JSON.parse(catalogText), production = JSON.parse(dataText), library = JSON.parse(libraryText);
const { analyzeBlueprint } = globalThis.FactorioProduction;
const clean = s => s.replace(/<[^>]*>/g, '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;|&#x27;/g, "'").replace(/&nbsp;/g, ' ').trim();
const hash = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
function signature(b) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
  const { label, description, icons, version, ...layout } = b;
  return hash(canonical(layout));
}
function leaves(node, parents = [], result = []) {
  if (node.blueprint_book) for (const child of node.blueprint_book.blueprints || []) leaves(child, [...parents, clean(node.blueprint_book.label || 'Book')], result);
  if (node.blueprint) result.push({ blueprint: node.blueprint, path: parents });
  return result;
}
const pageBlueprints = [], metadata = new Map();
let category = 'Miscellaneous', section = '';
for (const match of html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>|<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi)) {
  if (match[1] === '2') { category = clean(match[2]); section = ''; }
  else if (match[1] === '3') section = clean(match[2]);
  else {
    const text = clean(match[3]);
    if (!text.startsWith('0')) continue;
    const decoded = decodeBlueprint(text);
    if (!decoded) continue;
    for (const leaf of leaves(decoded)) {
      const info = { category, section, ...leaf };
      pageBlueprints.push(info);
      metadata.set(signature(leaf.blueprint), info);
    }
  }
}
const masterLeaves = leaves(decodeBlueprint(masterText));
const collection = masterLeaves.map(leaf => ({ ...leaf, ...metadata.get(signature(leaf.blueprint)), blueprint: leaf.blueprint, path: leaf.path, edition: metadata.has(signature(leaf.blueprint)) ? 'Book + web page' : 'Book variant' }));
const seen = new Set(masterLeaves.map(b => signature(b.blueprint)));
for (const leaf of pageBlueprints) if (!seen.has(signature(leaf.blueprint))) { collection.push({ ...leaf, edition: 'Web page variant' }); seen.add(signature(leaf.blueprint)); }
await fs.mkdir('site/assets/blueprints', { recursive: true });
await fs.mkdir('site/sources/Autosaved', { recursive: true });
await fs.writeFile('site/sources/Autosaved/AllBlueprints.txt', masterText);

const palette = type => /assembling|furnace|reactor|generator|boiler/.test(type) ? '#efb15d' : /pipe|pump|tank/.test(type) ? '#6bbad0' : /container|roboport/.test(type) ? '#9ac97b' : /solar|accumulator|electric-pole/.test(type) ? '#788fc4' : /rail|train/.test(type) ? '#b4bfc6' : '#687a82';
async function preview(b, id) {
  const entities = b.entities || [];
  if (!entities.length) return null;
  const points = entities.map(e => {
    const def = production.entities[e.name], box = def?.size || [[-.4, -.4], [.4, .4]];
    let w = box[1][0] - box[0][0], h = box[1][1] - box[0][1];
    if ([4, 12].includes(e.direction)) [w, h] = [h, w];
    return { x: e.position.x - w / 2, y: e.position.y - h / 2, w, h, fill: palette(def?.type || '') };
  });
  const x = Math.min(...points.map(p => p.x)) - 2, y = Math.min(...points.map(p => p.y)) - 2;
  const w = Math.max(...points.map(p => p.x + p.w)) - x + 2, h = Math.max(...points.map(p => p.y + p.h)) - y + 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#17272e"/>${points.map(p => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}" stroke="#17272e" stroke-width=".12"/>`).join('')}</svg>`;
  const filename = `assets/blueprints/${id}.png`;
  await sharp(Buffer.from(svg)).png().toFile('site/' + filename);
  return filename;
}
const blueprints = [];
for (const [i, leaf] of collection.entries()) {
  const b = leaf.blueprint, id = 'autosaved-' + hash([i, b]);
  const category = leaf.category || leaf.path[1] || 'Miscellaneous';
  const section = leaf.section || clean(b.label || category);
  const analysis = analyzeBlueprint({ blueprint: b }, production);
  const material = blueprintMaterials({ blueprint: b }, catalog);
  blueprints.push({ id, name: clean(b.label || section).replace(/\[(?:item|fluid|entity)=[^\]]*\]/g, '').trim() || section,
    category, section, collection: 'Autosaved', edition: leaf.edition, file: leaf.path.slice(1).concat(section).join(' / '), sources: [source], sourceURL: source,
    isBook: false, icons: (b.icons || []).map(i => i.signal?.name).filter(Boolean), ...material,
    code: encodeBlueprint({ blueprint: b }), analysis, preview: await preview(b, id),
  });
}
const local = {};
for (const b of library.blueprints) {
  try { local[b.id] = analyzeBlueprint(decodeBlueprint(b.code), production); }
  catch { local[b.id] = { kind: 'Unresolved', inputs: [], outputs: [], internal: [], seeds: [], recipes: [], missing: [], serviceInputs: [], serviceOutputs: [], notes: ['This blueprint could not be analyzed. Review its original source.'] }; }
}
await writeData('community', { source, bookURL, importedAt: new Date().toISOString(), masterCount: masterLeaves.length, pageCount: pageBlueprints.length, blueprints, local });
// Remove obsolete generated previews after matching/re-indexing changes.
const previews = new Set(blueprints.map(b => b.preview?.split('/').pop()));
for (const file of await fs.readdir('site/assets/blueprints')) if (/^autosaved-[a-f0-9]+\.png$/.test(file) && !previews.has(file)) await fs.unlink('site/assets/blueprints/' + file);
console.log(`Imported ${blueprints.length} blueprints (${masterLeaves.length} master-book entries plus webpage-only layouts). Analyzed ${Object.keys(local).length} local builds.`);
