// A schematic of the layout, drawn from the entities (not an in-game screenshot).
import { box, BELTS, UNDERGROUNDS } from './lib.mjs';
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const BELT_COLOR = { 'transport-belt': '#c9a23a', 'fast-transport-belt': '#b74c41', 'express-transport-belt': '#3d7fb8', 'underground-belt': '#8f7426', 'fast-underground-belt': '#8a3a31', 'express-underground-belt': '#2a5a85' };
const COLORS = { foundry: '#7a5a3a', 'assembling-machine-3': '#4f8f6f', 'fast-inserter': '#41a9d2', 'bulk-inserter': '#4fbf6a', 'long-handed-inserter': '#d78352', pipe: '#9aa7b5', 'pipe-to-ground': '#6c7a89', substation: '#e0af60', 'display-panel': '#dac77a', ...BELT_COLOR };
const FLUID = { lava: '#e2552d', 'molten-iron': '#8fb0c9', 'molten-copper': '#d98a4e', 'sulfuric-acid': '#d6d03c' };
const SHORT = { 'molten-copper-from-lava': 'lava → Cu', 'molten-iron-from-lava': 'lava → Fe', 'casting-iron': 'iron plate', 'casting-copper-cable': 'cable', 'electronic-circuit': 'green', 'advanced-circuit': 'red', 'processing-unit': 'blue' };
export function layoutSvg(d, p) {
  const scale = 18, left = 30, top = 70, { bounds } = d.footprint;
  let shapes = '';
  for (const e of d.blueprint.blueprint.entities) {
    const b = box(e, p, 'selection_box'), x = left + (b.left - bounds.left) * scale, y = top + (b.top - bounds.top) * scale;
    const fluid = d.manifest.fluidOf[e.entity_number];
    shapes += `<g><title>#${e.entity_number} ${esc(e.recipe || e.text || e.name)}${fluid ? ' (' + fluid + ')' : ''} (${e.position.x}, ${e.position.y})</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${((b.right - b.left) * scale).toFixed(1)}" height="${((b.bottom - b.top) * scale).toFixed(1)}" rx="2" fill="${fluid ? FLUID[fluid] : COLORS[e.name]}" stroke="#101b29"/>`;
    const cx = left + (e.position.x - bounds.left) * scale, cy = top + (e.position.y - bounds.top) * scale;
    if (BELTS.includes(e.name) || UNDERGROUNDS.includes(e.name)) shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="11">${{ 0: '↑', 4: '→', 8: '↓', 12: '←' }[e.direction || 0]}</text>`;
    if (/inserter/.test(e.name)) shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="10">${{ 0: '↓', 4: '←', 8: '↑', 12: '→' }[e.direction || 0]}</text>`;
    if (e.name === 'pipe-to-ground') shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#101b29" font-size="10">${{ 0: '▴', 4: '▸', 8: '▾', 12: '◂' }[e.direction || 0]}</text>`;
    if (e.recipe) shapes += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#fff" font-size="10">${esc(SHORT[e.recipe] || e.recipe)}</text>`;
    shapes += '</g>';
  }
  const width = left * 2 + d.footprint.width * scale, height = top + d.footprint.height * scale + 70;
  const legend = Object.entries(FLUID).filter(([f]) => Object.values(d.manifest.fluidOf).includes(f)).map(([f, c], i) => `<rect x="${left + i * 150}" y="${height - 52}" width="12" height="12" fill="${c}"/><text x="${left + i * 150 + 18}" y="${height - 42}" fill="#a8bed4" font-size="12">${f} pipes</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="${left}" y="30" fill="#f2f6fc" font-size="20">${esc(d.label)}</text><text x="${left}" y="54" fill="#a8bed4" font-size="13">${d.footprint.width} × ${d.footprint.height} = ${d.footprint.area} tiles · schematic from the entities</text>${shapes}${legend}<text x="${left}" y="${height - 16}" fill="#a8bed4" font-size="12">Arrows: belts point the way they run; arms point the way they carry. Yellow, red and blue belts; underground pieces darker. Pipes are coloured by the one fluid of their network.</text></g></svg>\n`;
}
