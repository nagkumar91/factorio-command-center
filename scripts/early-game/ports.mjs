// Operating ports, footprint and machine counts of the Early Flight mall, read from the blueprint string itself.
// Copied from the early-flight-seven family's ports.mjs (written by Claude Fable 5.2 for the same production cells).
// The same reading serves the generator, the native validator and the unit tests, so a version that moves an inlet
// off the west edge or loses its panel fails all three.
export const tileSize = {
  'assembling-machine-1': [3, 3], 'steel-furnace': [2, 2], 'big-electric-pole': [2, 2], 'splitter': [2, 1],
  'transport-belt': [1, 1], 'underground-belt': [1, 1], 'inserter': [1, 1], 'medium-electric-pole': [1, 1],
  'wooden-chest': [1, 1], 'display-panel': [1, 1],
};
export const inletItems = {'Iron ore': 'iron-ore', 'Copper ore': 'copper-ore', 'Coal': 'coal'};

// Tiles an entity covers: [left, top, right, bottom], right and bottom exclusive.
export function tilesOf(e) {
  const size = tileSize[e.name];
  if (!size) throw Error('Entity outside the family tier list: ' + e.name);
  let [w, h] = size;
  if (e.name === 'splitter' && ((e.direction || 0) === 4 || (e.direction || 0) === 12)) [w, h] = [h, w];
  const left = Math.round(e.position.x - w / 2), top = Math.round(e.position.y - h / 2);
  return [left, top, left + w, top + h];
}

export function footprint(entities) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const e of entities) { const [x0, y0, x1, y1] = tilesOf(e); l = Math.min(l, x0); t = Math.min(t, y0); r = Math.max(r, x1); b = Math.max(b, y1); }
  return {left: l, top: t, width: r - l, height: b - t, tiles: (r - l) * (b - t)};
}

// The machine a one-tile inserter takes from or drops into.
function occupant(entities, x, y) {
  return entities.find(e => { const [x0, y0, x1, y1] = tilesOf(e); return x >= x0 && x < x1 && y >= y0 && y < y1; });
}
const step = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};

export function derivePorts(blueprint, products) {
  const entities = blueprint.entities, box = footprint(entities);
  const at = (x, y) => occupant(entities, Math.floor(x), Math.floor(y));
  const inputs = [];
  for (const panel of entities.filter(e => e.name === 'display-panel')) {
    const match = /^([A-Z]) · (Iron ore|Copper ore|Coal) ↓/.exec(panel.text || '');
    if (!match) continue;
    const [px, py] = tilesOf(panel), belt = at(px, py + 1);
    if (!belt || belt.name !== 'transport-belt' || (belt.direction || 0) !== 4) throw Error('Inlet panel without an east-running belt below it: ' + panel.text);
    if (px !== box.left) throw Error('Inlet is not on the west edge: ' + panel.text);
    inputs.push({letter: match[1], item: inletItems[match[2]], side: 'west', row: py + 1 - box.top, position: belt.position, panel: panel.position});
  }
  inputs.sort((a, b) => a.row - b.row);
  const outputs = [];
  for (const chest of entities.filter(e => e.name === 'wooden-chest')) {
    const [cx, cy] = tilesOf(chest);
    let item;
    for (const ins of entities.filter(e => e.name === 'inserter')) {
      const [ix, iy] = tilesOf(ins), [dx, dy] = step[ins.direction || 0];
      // An inserter's direction names the side it picks up from; it drops on the opposite side.
      if (ix - dx === cx && iy - dy === cy) item = occupant(entities, ix + dx, iy + dy)?.recipe;
    }
    if (!item || !products.includes(item)) throw Error('Output chest without a product machine feeding it');
    outputs.push({item, column: cx - box.left, row: cy - box.top, position: chest.position, bar: chest.bar ?? null});
  }
  outputs.sort((a, b) => products.indexOf(a.item) - products.indexOf(b.item));
  const bigPoles = entities.filter(e => e.name === 'big-electric-pole');
  const powerPanel = entities.find(e => e.name === 'display-panel' && /^P · /.test(e.text || ''));
  const distance = e => powerPanel ? Math.hypot(e.position.x - powerPanel.position.x, e.position.y - powerPanel.position.y) : Math.hypot(e.position.x - box.left, e.position.y - box.top);
  const power = [...bigPoles].sort((a, b) => distance(a) - distance(b))[0];
  if (!power) throw Error('No big pole to connect grid power to');
  const count = name => entities.filter(e => e.name === name).length;
  const recipes = {};
  for (const e of entities) if (e.recipe) recipes[e.recipe] = (recipes[e.recipe] || 0) + 1;
  return {
    footprint: [box.width, box.height], tiles: box.tiles, origin: [box.left, box.top], inputs, outputs,
    power: {position: power.position, column: tilesOf(power)[0] - box.left, row: tilesOf(power)[1] - box.top},
    counts: {assemblingMachine1: count('assembling-machine-1'), steelFurnaces: count('steel-furnace'), inserters: count('inserter'), belts: count('transport-belt'), undergroundBelts: count('underground-belt'), splitters: count('splitter'), mediumPoles: count('medium-electric-pole'), bigPoles: count('big-electric-pole'), entities: entities.length},
    recipes,
  };
}
