(() => {
'use strict';

const MAX_CHESTS = 500;
const CHEST_HELP = {
  'passive-provider-chest': 'Robots take supplies when needed. Best for building blueprints.',
  'storage-chest': 'Robots can take supplies and store items here. Shares space with returned items.',
  'active-provider-chest': 'Robots immediately empty these into available storage. Needs free network storage.',
  'buffer-chest': 'Supplies construction robots and eligible requester chests. No requests are set by this command.',
  'requester-chest': 'Receives deliveries. Robots do not take these contents to build or supply other chests.',
  'steel-chest': 'Ordinary storage. Robots cannot take items from this chest.'
};

function normalizeEntries(entries, catalog) {
  const byId = new Map(catalog.items.map(i => [i.id, i]));
  const qualities = new Set(catalog.qualities.map(q => q.id));
  const merged = new Map();
  if (!Array.isArray(entries) || entries.length > 2000) throw new Error('Invalid loadout. Choose up to 2,000 item types.');
  for (const row of entries) {
    if (!row || !byId.has(row.id)) throw new Error(`Unknown item: ${row?.id || '(empty)'}`);
    const count = Number(row.count);
    const quality = row.quality || 'normal';
    if (!Number.isSafeInteger(count) || count < 1 || count > 1000000) throw new Error('Amounts must be whole numbers from 1 to 1,000,000.');
    if (!qualities.has(quality)) throw new Error(`Unknown quality: ${quality}`);
    const key = `${row.id}:${quality}`;
    if (merged.has(key)) merged.get(key).count += count;
    else merged.set(key, { id: row.id, count, quality });
    if (merged.get(key).count > 1000000) throw new Error('An item and quality combination cannot exceed 1,000,000.');
  }
  return [...merged.values()];
}

function planCrates(entries, catalog, chestId = 'passive-provider-chest') {
  const rows = normalizeEntries(entries, catalog);
  const chest = catalog.chests.find(c => c.id === chestId);
  if (!chest) throw new Error('Select a supported chest.');
  const items = new Map(catalog.items.map(i => [i.id, i]));
  const slots = rows.reduce((n, row) => n + Math.ceil(row.count / items.get(row.id).stack), 0);
  return { rows, chest, slots, chests: Math.ceil(slots / chest.slots), count: rows.reduce((n, r) => n + r.count, 0), capacity: Math.ceil(slots / chest.slots) * chest.slots };
}

function crateSlots(plan, catalog, page = 0) {
  const byId = new Map(catalog.items.map(i => [i.id, i]));
  const start = page * plan.chest.slots;
  const end = start + plan.chest.slots;
  const result = [];
  let offset = 0;
  for (const row of plan.rows) {
    const item = byId.get(row.id);
    const used = Math.ceil(row.count / item.stack);
    for (let slot = Math.max(start, offset); slot < Math.min(end, offset + used); slot++) {
      result.push({ ...row, count: Math.min(item.stack, row.count - (slot - offset) * item.stack) });
    }
    offset += used;
    if (offset >= end) break;
  }
  return result;
}

const lua = value => JSON.stringify(value);
function generateCrateCommand(entries, catalog, chestId = 'passive-provider-chest') {
  const plan = planCrates(entries, catalog, chestId);
  if (!plan.rows.length) return '';
  if (plan.chests > MAX_CHESTS) throw new Error(`This loadout needs ${plan.chests} chests. Split it into batches of ${MAX_CHESTS} or fewer.`);
  const kit = plan.rows.map(r => `{name=${lua(r.id)},count=${r.count},quality=${lua(r.quality)}}`).join(',');
  return `/c local p=game.player; if not p then return end; local s=p.surface; local kit={${kit}}; local chest_name=${lua(chestId)}; if not prototypes.entity[chest_name] then p.print("Chest unavailable: "..chest_name); return end; for _,it in ipairs(kit) do if not prototypes.item[it.name] then p.print("Item unavailable: "..it.name); return end; if not prototypes.quality[it.quality] then p.print("Quality unavailable: "..it.quality); return end end; local inv=nil; local made=0; local total=0; for _,it in ipairs(kit) do local left=it.count; while left>0 do if not inv then if made>=${MAX_CHESTS} then p.print("Stopped at ${MAX_CHESTS} chests. Inserted "..total.." items; remaining items were not created."); return end; local target={p.position.x+4+(made%10)*2,p.position.y+math.floor(made/10)*2}; local pos=s.find_non_colliding_position(chest_name,target,32,0.5); if not pos then p.print("No clear chest position. Inserted "..total.." items; stopped at "..it.name.." ("..left.." remaining, later items not created)."); return end; local e=s.create_entity{name=chest_name,position=pos,force=p.force,quality="normal",create_build_effect_smoke=false}; if not e then p.print("Chest placement failed after "..total.." items."); return end; made=made+1; inv=e.get_inventory(defines.inventory.chest); if not inv then p.print("Chest has no inventory."); return end end; local empty=inv.is_empty(); local ok,n=pcall(function() return inv.insert{name=it.name,count=left,quality=it.quality} end); if not ok then p.print("Insertion failed for "..it.name..": "..tostring(n)); return end; left=left-n; total=total+n; if left>0 then if n==0 and empty then p.print("Empty chest cannot accept "..it.name..". Stopped after "..total.." items."); return end; inv=nil end end end; p.print("Packed "..total.." items into "..made.." ${chestId}. Place them in a powered robot network.")`;
}

function generateGiveCommand(item, count, quality = 'normal') {
  if (!/^[a-zA-Z0-9_-]+$/.test(item) || !/^[a-zA-Z0-9_-]+$/.test(quality) || !Number.isSafeInteger(count) || count < 1 || count > 1000000) throw new Error('Choose an item and a valid whole-number amount.');
  return `/c local p=game.player; local name=${lua(item)}; local q=${lua(quality)}; if not prototypes.item[name] or not prototypes.quality[q] then p.print("Item or quality unavailable."); return end; local n=p.insert{name=name,count=${count},quality=q}; p.print("Added "..n.." / ${count}. Remaining: "..(${count}-n))`;
}

const PRESETS = [
  { id: 'construction', name: 'Robot construction', description: 'A ready-to-build logistics kit.', icon: 'construction-robot', entries: [['construction-robot', 200], ['logistic-robot', 100], ['roboport', 10], ['passive-provider-chest', 30], ['storage-chest', 20], ['substation', 20], ['repair-pack', 200]] },
  { id: 'solar', name: '1k solar farm', description: 'Panels, accumulators, and power distribution.', icon: 'solar-panel', entries: [['solar-panel', 1000], ['accumulator', 840], ['substation', 60], ['big-electric-pole', 40], ['roboport', 10], ['construction-robot', 400], ['repair-pack', 400], ['small-lamp', 80]] },
  { id: 'nuclear', name: 'Nuclear power', description: 'The reactor kit from your command history.', icon: 'nuclear-reactor', entries: [['nuclear-reactor', 2], ['heat-exchanger', 32], ['steam-turbine', 21], ['heat-pipe', 13], ['pump', 5], ['pipe', 40], ['pipe-to-ground', 30], ['centrifuge', 2], ['uranium-fuel-cell', 200]] },
  { id: 'production', name: 'Factory essentials', description: 'Start a new production line.', icon: 'assembling-machine-3', entries: [['assembling-machine-3', 50], ['electric-furnace', 50], ['electric-mining-drill', 50], ['express-transport-belt', 500], ['express-underground-belt', 100], ['bulk-inserter', 100], ['substation', 20]] },
  { id: 'materials', name: 'Raw materials', description: 'Plates, circuits, and intermediates.', icon: 'iron-plate', entries: [['iron-plate', 1000], ['copper-plate', 1000], ['steel-plate', 500], ['electronic-circuit', 500], ['advanced-circuit', 200], ['processing-unit', 100], ['plastic-bar', 500]] },
  { id: 'defense', name: 'Perimeter supplies', description: 'Walls, turrets, and repairs.', icon: 'gun-turret', entries: [['stone-wall', 600], ['gate', 40], ['gun-turret', 30], ['laser-turret', 30], ['uranium-rounds-magazine', 1000], ['repair-pack', 200], ['small-lamp', 60], ['big-electric-pole', 40]] }
];

Object.assign(globalThis, { FactorioPacker: { MAX_CHESTS, CHEST_HELP, PRESETS, normalizeEntries, planCrates, crateSlots, generateCrateCommand, generateGiveCommand } });
})();
