// A schematic of the layout, drawn from the entities (not an in-game screenshot).
import { box } from '../vulcanus-circuits/lib.mjs';
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const COLORS = { foundry: '#7a5a3a', 'fast-inserter': '#41a9d2', pipe: '#d98a4e', substation: '#e0af60', 'display-panel': '#dac77a', 'requester-chest': '#5d8fd6', 'passive-provider-chest': '#c0564f' };
export function layoutSvg(d, p) {
  const scale = 40, left = 30, top = 70, { bounds } = d.footprint;
  let shapes = '';
  for (const e of d.blueprint.blueprint.entities) {
    const b = box(e, p, 'selection_box'), x = left + (b.left - bounds.left) * scale, y = top + (b.top - bounds.top) * scale;
    const cx = left + (e.position.x - bounds.left) * scale, cy = top + (e.position.y - bounds.top) * scale;
    shapes += `<g><title>#${e.entity_number} ${esc(e.recipe || e.text || e.name)} (${e.position.x}, ${e.position.y})</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${((b.right - b.left) * scale).toFixed(1)}" height="${((b.bottom - b.top) * scale).toFixed(1)}" rx="3" fill="${COLORS[e.name]}" stroke="#101b29"/>`;
    if (e.name === 'fast-inserter') shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-size="16">${{ 0: '↓', 4: '←', 8: '↑', 12: '→' }[e.direction || 0]}</text>`;
    if (e.name === 'foundry') shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-size="14">foundry: metallurgic pack</text>`;
    if (e.name === 'requester-chest') shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-size="11">req</text>`;
    if (e.name === 'passive-provider-chest') shapes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#fff" font-size="11">out</text>`;
    shapes += '</g>';
  }
  const width = left * 2 + d.footprint.width * scale, height = top + d.footprint.height * scale + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101b29"/><g font-family="Arial,sans-serif"><text x="${left}" y="30" fill="#f2f6fc" font-size="20">${esc(d.d.label)}</text><text x="${left}" y="54" fill="#a8bed4" font-size="13">${d.footprint.width} × ${d.footprint.height} = ${d.footprint.area} tiles · ${d.footprint.entities} entities · schematic from the entities</text>${shapes}<text x="${left}" y="${height - 14}" fill="#a8bed4" font-size="12">Arrows: inserters point the way they carry. The orange pipe at the south edge is the molten copper entrance.</text></g></svg>\n`;
}
