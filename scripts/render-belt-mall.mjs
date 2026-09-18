import fs from 'node:fs/promises';
import sharp from 'sharp';

const bp = JSON.parse(await fs.readFile('mall/compact_turbo_tesla_mall.json', 'utf8')).blueprint;
const manifest = JSON.parse(await fs.readFile('.cache/belt-tesla-mall/manifest.json', 'utf8'));
const raw = JSON.parse(await fs.readFile('.cache/factorio/script-output/data-raw-dump.json', 'utf8'));
const catalog = JSON.parse(await fs.readFile('site/data/catalog.json', 'utf8'));
const prototypes = new Map(Object.values(raw).flatMap(Object.values).filter(p => p.selection_box).map(p => [p.name, p]));
const items = new Map([...catalog.items, ...catalog.fluids].map(p => [p.id, p]));
const byID = new Map(bp.entities.map(e => [e.entity_number, e]));
const colors = { water: '#63bde7', 'crude-oil': '#b2a495', 'heavy-oil': '#df8c50', 'light-oil': '#e0c45b', 'petroleum-gas': '#bcbbd4', lubricant: '#85c754', 'sulfuric-acid': '#ecdf77', electrolyte: '#d485df', 'holmium-solution': '#ed91b6' };
const directions = { 0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0] };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const iconData = new Map();
function box(e) {
  let [[a, b], [c, d]] = prototypes.get(e.name).selection_box;
  if ([4, 12].includes(e.direction)) [a, b, c, d] = [b, a, d, c];
  return { x: e.position.x + a, y: e.position.y + b, w: c - a, h: d - b };
}
const bounds = manifest.factoryBounds, factoryWidth = bounds.maxX - bounds.minX, factoryHeight = bounds.maxY - bounds.minY;
async function render(overview = false) {
  const scale = overview ? 4.7 : 12, minimum = overview ? -102 : -2, maximum = overview ? 152 : 102;
  const ox = 110 - minimum * scale, oy = 160 - minimum * scale;
  const X = x => ox + x * scale, Y = y => oy + y * scale;
  const parts = [];
  const line = (x1, y1, x2, y2, color, width = 1, extra = '') => parts.push(`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${color}" stroke-width="${width}" ${extra}/>`);
  const rect = (x, y, w, h, fill, stroke = 'none', radius = 0, extra = '') => parts.push(`<rect x="${X(x)}" y="${Y(y)}" width="${w * scale}" height="${h * scale}" fill="${fill}" stroke="${stroke}" rx="${radius}" ${extra}/>`);
  const text = (x, y, value, size = 16, color = '#e2e9e6', extra = '') => parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(value)}</text>`);
  async function icon(name, x, y, size) {
    const p = items.get(name); if (!p?.icon) return;
    if (!iconData.has(name)) iconData.set(name, (await fs.readFile('site/' + p.icon)).toString('base64'));
    parts.push(`<image href="data:image/png;base64,${iconData.get(name)}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"/>`);
  }
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1540" viewBox="0 0 1800 1540"><rect width="1800" height="1540" fill="#172321"/><g font-family="Arial, sans-serif">');
  text(48, 52, overview ? 'YOUR 5 × 5 ROBOT EXTENSION + MALL' : 'SUBSTATION TURBO MALL', 30, '#f3ce7c', 'font-weight="700"');
  text(48, 87, overview ? 'All 25 roboports and 85 big poles preserved · Original 50-tile snapping · Full footprint 252 × 252 tiles' : `${factoryWidth} × ${factoryHeight} tile factory · 22 substations · Fits four cells of your 50-tile robot grid`, 19);
  text(48, 117, overview ? 'The highlighted 100 × 100 bay contains the factory. This entire extension is included in the import string.' : 'Exact blueprint positions. Recipe icons identify machines; the blue structures are your existing roboports.', 15, '#a7bbb2');
  parts.push(`<defs><clipPath id="map"><rect x="${X(minimum)}" y="${Y(minimum)}" width="${(maximum-minimum)*scale}" height="${(maximum-minimum)*scale}"/></clipPath></defs><g clip-path="url(#map)">`);
  if (!overview) {
    for (let x = 0; x <= 100; x++) line(x, 0, x, 100, '#243630', .55);
    for (let y = 0; y <= 100; y++) line(0, y, 100, y, '#243630', .55);
  }
  for (let y = -100; y < 150; y += 50) for (let x = -100; x < 150; x += 50) {
    rect(x, y, 50, 50, '#224637', '#6d9d79', 0, 'fill-opacity=".13" stroke-dasharray="6 5" stroke-opacity=".6"');
  }
  if (overview) rect(0, 0, 100, 100, '#bfaa5d', '#f3ce7c', 0, 'fill-opacity=".12" stroke-width="3"');
  for (const [a, ca, b] of bp.wires || []) if (ca === 5) {
    const p = byID.get(a).position, q = byID.get(b).position;
    line(p.x, p.y, q.x, q.y, '#d6a04f', overview ? 1.3 : .8, 'opacity=".5"');
  }
  const fluidEntities = bp.entities.filter(e => e.tags?.mall_net && ['pipe', 'pipe-to-ground'].includes(e.name));
  const at = new Map(fluidEntities.map(e => [`${e.position.x},${e.position.y}`, e]));
  if (!overview) for (const e of fluidEntities) {
    const { x, y } = e.position, color = colors[e.tags.mall_fluid];
    if (e.name !== 'pipe-to-ground') continue;
    const [dx, dy] = directions[e.direction || 0];
    for (let n = 2; n <= 10; n++) {
      const f = at.get(`${x - dx * n},${y - dy * n}`);
      if (f?.name === 'pipe-to-ground' && f.direction === ((e.direction || 0) + 8) % 16) {
        if (e.entity_number < f.entity_number) line(x, y, f.position.x, f.position.y, color, 1.2, 'stroke-dasharray="4 4" opacity=".5"');
        break;
      }
    }
  }
  const undergrounds = bp.entities.filter(e => e.name === 'turbo-underground-belt');
  for (const e of undergrounds.filter(e => e.type === 'input')) {
    const [dx, dy] = directions[e.direction], p = e.position;
    const f = undergrounds.find(q => q.type === 'output' && q.direction === e.direction && q.position.y === p.y && (q.position.x - p.x) * dx > 0 && Math.abs(q.position.x - p.x) <= 11);
    if (f) line(p.x, p.y, f.position.x, f.position.y, '#9bdd9e', overview ? 2 : 4, 'stroke-dasharray="5 4"');
  }
  for (const e of bp.entities.filter(e => ['turbo-transport-belt', 'turbo-underground-belt'].includes(e.name))) {
    const { x, y } = e.position;
    rect(x - .48, y - .48, .96, .96, e.type ? '#4e976a' : '#235c4b', '#40876b');
    if (!overview) parts.push(`<path d="M -3 -2 L 0 1 L 3 -2" fill="none" stroke="#aad59e" stroke-width="1.2" transform="translate(${X(x)} ${Y(y)}) rotate(${(e.direction || 0) * 22.5 + 180})"/>`);
  }
  for (const e of bp.entities.filter(e => e.tags?.mall_recipe)) {
    const b = box(e), final = e.tags.mall_role === 'output';
    rect(b.x, b.y, b.w, b.h, e.name === 'electromagnetic-plant' ? '#3f334f' : final ? '#2a4538' : '#3d4138', final ? '#a9c881' : '#828b71', overview ? 1 : 4);
    if (!overview) await icon(raw.recipe[e.tags.mall_recipe].results[0].name, X(e.position.x), Y(e.position.y), Math.min(b.w * scale - 7, 33));
  }
  for (const e of bp.entities.filter(e => e.name === 'stack-inserter')) {
    const { x, y } = e.position, [dx, dy] = directions[e.direction || 0];
    line(x + dx * .75, y + dy * .75, x - dx * .75, y - dy * .75, '#e0cc8e', overview ? .8 : 2);
    rect(x - .2, y - .2, .4, .4, '#f5e5b6');
  }
  for (const e of bp.entities.filter(e => e.tags?.mall_product)) rect(e.position.x - .4, e.position.y - .4, .8, .8, '#b0c97c', '#edfacb', 1);
  for (const e of fluidEntities) {
    const { x, y } = e.position, color = colors[e.tags.mall_fluid];
    parts.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="${overview ? 1.1 : 2.6}" fill="${color}"/>`);
    if (!overview) for (const face of e.name === 'pipe-to-ground' ? [e.direction || 0] : [0, 4, 8, 12]) {
      const [dx, dy] = directions[face], f = at.get(`${x + dx},${y + dy}`);
      if (f && f.tags.mall_net === e.tags.mall_net) line(x, y, x + dx, y + dy, color, 2);
    }
  }
  for (const e of bp.entities.filter(e => ['storage-tank', 'pump', 'substation', 'roboport', 'big-electric-pole'].includes(e.name))) {
    const b = box(e), port = e.name === 'roboport', sub = e.name === 'substation', pole = e.name === 'big-electric-pole';
    rect(b.x, b.y, b.w, b.h, port ? '#205e70' : sub ? '#315771' : '#314843', port ? '#7ed9e6' : sub ? '#a8d6ff' : pole ? '#d6a04f' : '#869e8f', 2, port ? 'stroke-width="2"' : '');
    if (!overview || port) await icon(e.tags?.mall_fluid || e.name, X(e.position.x), Y(e.position.y), Math.min(b.w * scale - 2, port ? 38 : 29));
  }
  parts.push('</g>');
  for (let n = overview ? -100 : 0; n <= (overview ? 150 : 100); n += 50) {
    text(X(n), 149, n, 12, '#9caf9f', 'text-anchor="middle"');
    text(99, Y(n) + 4, n, 12, '#9caf9f', 'text-anchor="end"');
  }
  if (!overview) {
    for (const feed of manifest.feeds) text(X(feed.x), Y(feed.y) - 11, items.get(feed.item).name, 12, '#d3e3d8');
    for (const input of manifest.fluidInputs) text(X(input.x + .5), Y(input.y) - 28, items.get(input.fluid).name, 12, colors[input.fluid], input.fluid === 'water' ? 'text-anchor="end"' : '');
  }
  const side = 1410;
  if (overview) {
    text(side, 189, 'ALIGN WITH YOUR EXTENSION', 18, '#f3ce7c', 'font-weight="700"');
    for (const [i, value] of ['25 roboports: original positions', '85 big poles: original positions', '22 new substations for the mall', '50-tile grid and origin preserved', '', 'Place over the matching roboports.', 'Existing infrastructure is reused.', 'The factory occupies four cells.', '', 'Power: connect any original big pole.', 'Robots can collect finished products.', 'Production uses belts and inserters.'].entries()) text(side, 232 + i * 31, value, 16);
    text(side, 684, 'FACTORY INPUTS', 18, '#f3ce7c', 'font-weight="700"');
    for (const [i, value] of ['Iron ore · Copper ore · Coal', 'Holmium ore · Stone', 'Water · Crude oil · Electricity'].entries()) text(side, 725 + i * 31, value, 16);
    text(side, 893, `${factoryWidth} × ${factoryHeight} tile factory`, 23, '#f3ce7c');
    text(side, 930, '252 × 252 full blueprint', 23, '#c7ded6');
    text(side, 980, 'See the close-up for recipe locations.', 15, '#a7bbb2');
  } else {
    text(side, 189, 'FINISHED OUTPUTS', 18, '#f3ce7c', 'font-weight="700"');
    for (const [i, e] of bp.entities.filter(e => e.tags?.mall_product).entries()) {
      const id = e.tags.mall_product, yy = 227 + i * 36;
      await icon(id, side + 15, yy - 5, 27);
      text(side + 40, yy, items.get(id).name, 16);
    }
    text(side, 853, 'OIL ROUTING', 18, '#f3ce7c', 'font-weight="700"');
    for (const [i, value] of ['Light oil → superconductors', 'Surplus light → petroleum', 'Heavy oil → electrolyte / lubricant', 'Surplus heavy → cracking'].entries()) text(side, 893 + i * 28, value, 15, '#c5d8cc');
    text(side, 1048, 'Blue structures: original roboports', 15, '#9edceb');
    text(side, 1078, 'Blue small squares: new substations', 15, '#b8dfff');
    text(side, 1108, 'Gold lines: electrical connections', 15, '#dfbe8a');
    text(side, 1138, 'Gold arms: stack inserters', 15, '#e0cc8e');
    text(side, 1168, 'Green boxes: output chests', 15, '#c5d8cc');
    text(side, 1198, 'Dashed green: underground belts', 15, '#a1dba2');
    text(side, 1258, 'No logistic robots needed to produce.', 15, '#c5d8cc');
    text(side, 1288, 'All outputs have robot coverage.', 15, '#c5d8cc');
  }
  text(48, 1460, 'Import includes your complete robot extension. Align its roboports and keep the original orientation when overlaying.', 18);
  text(48, 1500, 'Schematic from actual blueprint coordinates. Normal quality. Factorio 2.0 + Space Age. Keep the belt loop and green wires intact.', 16, '#a7bbb2');
  parts.push('</g></svg>');
  const svg = parts.join(''), name = 'mall/compact_turbo_tesla_mall' + (overview ? '.overview' : '');
  await fs.writeFile(name + '.svg', svg);
  await sharp(Buffer.from(svg)).png().toFile(name + '.png');
}
await render();
await render(true);
console.log(`Rendered ${factoryWidth} × ${factoryHeight} factory close-up and full 5 × 5 extension overview.`);
