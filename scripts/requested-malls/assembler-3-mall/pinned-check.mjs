// Compares the pinned prototypes.json with a native data-raw-dump of an installed game: every pinned recipe, entity, item and
// technology must be a subset of the dump's record (same values; the dump has more fields, e.g. graphics).
// Used by validate.mjs so a native run on a newer patch release proves it ran on the very data the design was checked against.
const subset = (pinned, actual) => {
  if (Array.isArray(pinned)) return Array.isArray(actual) && pinned.length === actual.length && pinned.every((v, i) => subset(v, actual[i]));
  if (pinned && typeof pinned === 'object') return actual && typeof actual === 'object' && Object.entries(pinned).every(([k, v]) => subset(v, actual[k]));
  return pinned === actual;
};
const ITEM_TYPES = ['item', 'module', 'tool', 'capsule', 'ammo', 'armor', 'gun', 'repair-tool', 'item-with-entity-data'];
export function comparePinned(pinned, dump) {
  const mismatches = [];
  const note = (kind, name, detail) => mismatches.push(`${kind} ${name}${detail ? ': ' + detail : ''}`);
  for (const [name, record] of Object.entries(pinned.recipes)) {
    const actual = dump.recipe?.[name];
    if (!actual) { note('recipe', name, 'missing'); continue; }
    for (const [k, v] of Object.entries(record)) if (!subset(v, actual[k])) note('recipe', name, k);
    // a recipe field the dump has and the pin lacks that changes behaviour
    for (const k of ['energy_required', 'categories', 'category', 'enabled']) if (!(k in record) && k in actual && !(k === 'enabled' && actual[k] === true) && !(k === 'category' && actual[k] === 'crafting')) note('recipe', name, 'unpinned ' + k);
  }
  for (const [name, record] of Object.entries(pinned.entities)) {
    const actual = dump[record.type]?.[name];
    if (!actual) { note('entity', name, 'missing'); continue; }
    for (const [k, v] of Object.entries(record)) if (k !== 'fluid_boxes' && !subset(v, actual[k])) note('entity', name, k);
  }
  for (const [name, record] of Object.entries(pinned.items)) {
    const actual = ITEM_TYPES.map(t => dump[t]?.[name]).find(Boolean);
    if (!actual) { note('item', name, 'missing'); continue; }
    for (const [k, v] of Object.entries(record)) if (!subset(v, actual[k])) note('item', name, k);
  }
  for (const [name, record] of Object.entries(pinned.technologies)) {
    const actual = dump.technology?.[name];
    if (!actual) { note('technology', name, 'missing'); continue; }
    for (const [k, v] of Object.entries(record)) if (!subset(v, actual[k])) note('technology', name, k);
  }
  return { mismatches, checked: { recipes: Object.keys(pinned.recipes).length, entities: Object.keys(pinned.entities).length, items: Object.keys(pinned.items).length, technologies: Object.keys(pinned.technologies).length } };
}
