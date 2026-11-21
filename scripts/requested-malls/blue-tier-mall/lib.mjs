// Shared helpers for the blue-tier on-demand mall: generator, static audit, native validator and tests.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync, deflateSync } from 'node:zlib';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT = path.resolve(HERE, '../../..');
export const ID = 'blue-tier-mall';
export const PUBLISHED = path.join(PROJECT, 'blueprint-sources/requested-malls', ID);
export const sha = data => createHash('sha256').update(data).digest('hex');
export const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
export const prototypes = () => readJson(path.join(HERE, 'prototypes.json'));
export const json = value => JSON.stringify(value, null, 2) + '\n';
export const encode = object => '0' + deflateSync(JSON.stringify(object)).toString('base64');
// zlib's compressed bytes differ between builds (the Linux deploy runner and this Mac give different strings for the same JSON).
// Keep the committed string when it decodes to exactly this object, so its SHA-256 and native report stay valid on any machine.
export function encodeKeeping(object, committed) {
  const text = committed?.trim();
  try { if (text && inflateSync(Buffer.from(text.slice(1), 'base64')).toString('utf8') === JSON.stringify(object)) return text; } catch {}
  return encode(object);
}
export const decode = code => JSON.parse(inflateSync(Buffer.from(code.trim().slice(1), 'base64')));
export const vector = { 0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0] };
export const coord = p => `${p.x},${p.y}`;
export const distance = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
export const allWires = bp => [...(bp.wires || []), ...bp.entities.flatMap(e => e.wires || [])];
export function rotate([x, y], direction = 0) {
  for (let d = 0; d < direction; d += 4) [x, y] = [-y, x];
  return [x, y];
}
export function box(entity, p, field = 'collision_box') {
  const corners = p.entities[entity.name][field];
  const points = [corners[0], corners[1], [corners[0][0], corners[1][1]], [corners[1][0], corners[0][1]]].map(q => rotate(q, entity.direction));
  return { left: entity.position.x + Math.min(...points.map(q => q[0])), right: entity.position.x + Math.max(...points.map(q => q[0])), top: entity.position.y + Math.min(...points.map(q => q[1])), bottom: entity.position.y + Math.max(...points.map(q => q[1])) };
}
export const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
export function contact(arm, p, kind) {
  const delta = rotate(p.entities[arm.name][kind === 'pickup' ? 'pickup_position' : 'insert_position'], arm.direction);
  return { x: arm.position.x + delta[0], y: arm.position.y + delta[1] };
}
export const inside = (q, b) => q.x > b.left && q.x < b.right && q.y > b.top && q.y < b.bottom;
export const filters = names => ({ use_filters: true, filter_mode: 'whitelist', filters: names.map((name, i) => ({ index: i + 1, name, quality: 'normal', comparator: '=' })) });
export const condition = (name, cap) => ({ circuit_enabled: true, circuit_condition: { first_signal: { type: 'item', name, quality: 'normal' }, comparator: '<', constant: cap } });
// Selection-box envelope of every entity, in whole tiles. The published size is this rectangle.
export function envelope(entities, p) {
  const boxes = entities.map(e => box(e, p, 'selection_box'));
  const bounds = { left: Math.floor(Math.min(...boxes.map(b => b.left))), top: Math.floor(Math.min(...boxes.map(b => b.top))), right: Math.ceil(Math.max(...boxes.map(b => b.right))), bottom: Math.ceil(Math.max(...boxes.map(b => b.bottom))) };
  return { bounds, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top, area: (bounds.right - bounds.left) * (bounds.bottom - bounds.top) };
}
// Research needed to operate and to build the blueprint, in research order.
export function technologyClosure(p, products, entityNames) {
  const unlockers = recipe => Object.values(p.technologies).filter(t => t.effects?.some(e => e.type === 'unlock-recipe' && e.recipe === recipe)).map(t => t.name).sort();
  const requirements = [...new Set([...products, ...entityNames])].map(recipe => ({ recipe, enabledByDefault: p.recipes[recipe]?.enabled !== false, alternatives: unlockers(recipe) }));
  for (const r of requirements) r.selected = r.enabledByDefault ? null : (r.alternatives.includes('construction-robotics') ? 'construction-robotics' : r.alternatives[0]);
  const closure = [], visited = new Set();
  const visit = n => { if (!n || visited.has(n)) return; if (!p.technologies[n]) throw Error('Unknown technology ' + n); for (const parent of p.technologies[n].prerequisites || []) visit(parent); visited.add(n); closure.push(n); };
  for (const r of requirements) { if (!r.enabledByDefault && !r.selected) throw Error('Missing unlock ' + r.recipe); visit(r.selected); }
  return { requirements, closure };
}
// The native protocol that qualified the first published version. A full run must use exactly this.
export const PROTOCOL = Object.freeze({ seed: 21024, stockFillTicks: 54000, refillTicks: 54000, outageTicks: 18000, recoveryTicks: 54000, externalPowerWatts: 5000000, samplingTicks: 3600, targetRate: null, acceptance: 'All seven products reach their stock caps from empty, refill after complete collection, and recover after a boundary-input outage; imported blueprint unchanged.' });
