import { inflateSync, deflateSync } from 'node:zlib';

export function decodeBlueprint(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  if (!/^0[A-Za-z0-9+/=]+$/.test(trimmed)) return null;
  return JSON.parse(inflateSync(Buffer.from(trimmed.slice(1), 'base64'), { maxOutputLength: 32 * 1024 * 1024 }).toString());
}

export function encodeBlueprint(object) {
  return '0' + deflateSync(JSON.stringify(object)).toString('base64');
}

export function blueprintMaterials(object, catalog) {
  const known = new Set(catalog.items.map(i => i.id));
  const rows = new Map();
  const excluded = new Set();
  let entityCount = 0, tileCount = 0, blueprintCount = 0;
  const add = (id, count = 1, quality = 'normal') => {
    if (!known.has(id)) { excluded.add(id); return; }
    const key = id + ':' + quality;
    const old = rows.get(key) || { id, count: 0, quality };
    old.count += count;
    rows.set(key, old);
  };
  function walk(node) {
    if (node.blueprint_book) for (const child of node.blueprint_book.blueprints || []) walk(child);
    if (!node.blueprint) return;
    blueprintCount++;
    for (const e of node.blueprint.entities || []) {
      entityCount++;
      add(catalog.entityItems[e.name] || e.name, catalog.entityCosts?.[e.name] || 1, typeof e.quality === 'object' ? e.quality.name : e.quality || 'normal');
      if (Array.isArray(e.items)) {
        for (const request of e.items) {
          const count = (request.items?.in_inventory || []).reduce((n, slot) => n + (slot.count ?? 1), 0) + (request.items?.grid_count || 0);
          if (count) add(request.id.name, count, request.id.quality || 'normal');
        }
      } else for (const [id, count] of Object.entries(e.items || {})) add(id, count);
    }
    for (const tile of node.blueprint.tiles || []) { tileCount++; add(catalog.tileItems[tile.name] || tile.name); }
  }
  walk(object);
  return { entries: [...rows.values()].sort((a, b) => b.count - a.count), excluded: [...excluded], entityCount, tileCount, blueprintCount };
}
