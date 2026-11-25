// A schematic of the layout, drawn from the entities (not an in-game screenshot).
import { box, sizeOf } from './lib.mjs';
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const COLORS = { 'oil-refinery': '#7a5a3a', 'chemical-plant': '#477196', 'assembling-machine-3': '#4f8f6f', 'fast-inserter': '#41a9d2', 'long-handed-inserter': '#d78352', 'fast-transport-belt': '#b74c41', 'fast-underground-belt': '#8a3a31', pipe: '#75bd95', 'pipe-to-ground': '#4f8f6f', substation: '#e0af60', 'display-panel': '#dac77a' };
const SHORT = { 'simple-coal-liquefaction': 'coal liq.', 'heavy-oil-cracking': 'heavy crack', 'light-oil-cracking': 'light crack', 'plastic-bar': 'plastic', lubricant: 'lubricant', carbon: 'carbon', 'tungsten-carbide': 'WC' };
export function layoutSvg(d, p) {
  const scale = 22, left = 36, top = 74, { bounds } = d.footprint;
  let shapes = '';
  for (const e of d.blueprint.blueprint.entities) {
    const b = box(e, p, 'selection_box'), x = left + (b.left - bounds.left) * scale, y = top + (b.top - bounds.top) * scale;
    shapes += `<g><title>#${e.entity_number} ${esc(e.recipe || e.text || e.name)} (${e.position.x}, ${e.position.y})</title><rect x="${x}" y="${y}" width="${(b.right - b.left) * scale}" height="${(b.bottom - b.top) * scale}" rx="2" fill="${COLORS[e.name]}" stroke="#101b29"/>`;
    const cx = left + (e.position.x - bounds.left) * scale, cy = top + (e.position.y - bounds.top) * scale;
    if (e.name.includes('belt') && !e.name.includes('underground')) shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="13">${{ 0: '↑', 4: '→', 8: '↓', 12: '←' }[e.direction || 0]}</text>`;
    if (e.name.includes('inserter')) shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="12">${{ 0: '↓', 4: '←', 8: '↑', 12: '→' }[e.direction || 0]}</text>`;
    if (e.name === 'pipe-to-ground') shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="11">${{ 0: '▴', 4: '▸', 8: '▾', 12: '◂' }[e.direction || 0]}</text>`;
    if (e.recipe) shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="11">${esc(SHORT[e.recipe] || e.recipe)}</text>`;
    shapes += '</g>';
  }
  const width = left * 2 + d.footprint.width * scale, height = top + d.footprint.height * scale + 56;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="${left}" y="30" fill="#f2f6fc" font-size="20">${esc(d.label)}</text><text x="${left}" y="54" fill="#a8bed4" font-size="13">${d.footprint.width} × ${d.footprint.height} = ${d.footprint.area} tiles · schematic from the entities</text>${shapes}<text x="${left}" y="${height - 20}" fill="#a8bed4" font-size="12">Arrows: belts point the way they run; inserters point the way they carry (drop side). Pipes green, undergrounds darker.</text></g></svg>\n`;
}
