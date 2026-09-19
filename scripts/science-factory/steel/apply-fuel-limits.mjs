import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decodeBlueprint, encodeBlueprint, blueprintMaterials } from '../../../scripts/blueprints.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../../..');
const defaultRoot = path.join(repo, '.cache/science-factory/reproduce-steel');
const resolveRepoPath = value => path.isAbsolute(value) ? value : path.resolve(repo, value);
const sourceRoot = resolveRepoPath(process.env.BRANCH_LIMIT_SOURCE || path.join(defaultRoot, 'capped'));
const outRoot = resolveRepoPath(process.env.BRANCH_LIMIT_OUT || path.join(defaultRoot, 'fuel-limited'));
const raw = JSON.parse(await fs.readFile(process.env.FACTORIO_RAW || path.join(repo, '.cache/factorio-vanilla/script-output/data-raw-dump.json')));
const catalog = JSON.parse(await fs.readFile(path.join(repo, 'site/data/catalog.json')));
const sourceInfo = JSON.parse(await fs.readFile(path.join(sourceRoot, 'manifest.json')));
if (!Array.isArray(sourceInfo) || sourceInfo.length !== 1) throw new Error('Frozen source manifest must contain exactly one build');
const info = structuredClone(sourceInfo[0]);
const code = (await fs.readFile(path.join(sourceRoot, info.file), 'utf8')).trim();
const decoded = decodeBlueprint(code);
if (!decoded?.blueprint) throw new Error('Frozen source is not a blueprint string');
const blueprint = structuredClone(decoded.blueprint);
blueprint.entities = [...(blueprint.entities || [])];
blueprint.wires = [...(blueprint.wires || [])];

const rawItems = new Set(['iron-ore', 'copper-ore', 'coal', 'stone']);
const machineNames = new Set(['assembling-machine-2', 'electric-furnace', 'steel-furnace', 'chemical-plant', 'oil-refinery']);
const proto = new Map(Object.values(raw).flatMap(group => Object.values(group || {})).filter(value => value?.collision_box).map(value => [value.name, value]));
const key = (x, y) => `${x},${y}`;
const vector = { 0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0] };

function entityCells(entity) {
  const prototype = proto.get(entity.name);
  if (!prototype) throw new Error(`Missing collision prototype for ${entity.name}`);
  let [[left, top], [right, bottom]] = prototype.collision_box;
  if ([4, 12].includes(entity.direction || 0)) [left, top, right, bottom] = [top, left, bottom, right];
  const cells = [];
  for (let x = Math.floor(entity.position.x + left + 1e-6); x <= Math.floor(entity.position.x + right - 1e-6); x++) {
    for (let y = Math.floor(entity.position.y + top + 1e-6); y <= Math.floor(entity.position.y + bottom - 1e-6); y++) cells.push({ x, y });
  }
  return cells;
}

const occupied = new Map();
for (const entity of blueprint.entities) for (const cell of entityCells(entity)) {
  const cellKey = key(cell.x, cell.y);
  if (occupied.has(cellKey)) throw new Error(`Frozen blueprint overlap at ${cellKey}`);
  occupied.set(cellKey, entity);
}

function routeEntities(route) {
  return blueprint.entities.filter(entity => {
    const candidate = entity.tags?.route;
    return candidate === route || candidate?.startsWith(`${route}-cross-`);
  }).sort((a, b) => a.entity_number - b.entity_number);
}

function routeLength(route, head) {
  const entities = routeEntities(route);
  let length = 0;
  let previous = head;
  for (const entity of entities) {
    if (entity === head) continue;
    length += Math.abs(entity.position.x - previous.position.x) + Math.abs(entity.position.y - previous.position.y);
    previous = entity;
  }
  return Math.max(1, length);
}

function blockDemand(blockId, material) {
  const machines = blueprint.entities.filter(entity => entity.tags?.compact_block === blockId && machineNames.has(entity.name));
  if (!machines.length) return { ratePerSecond: 0, machineCount: 0, recipe: null };
  const recipeId = machines[0].recipe || machines[0].tags?.production_recipe;
  const recipe = raw.recipe[recipeId];
  const ingredient = recipe?.ingredients?.find(value => value.type !== 'fluid' && value.name === material);
  const speed = raw['assembling-machine']?.[machines[0].name]?.crafting_speed
    ?? raw.furnace?.[machines[0].name]?.crafting_speed
    ?? 1;
  const perMachine = ingredient ? Number(ingredient.amount) * speed / Number(recipe.energy_required || 0.5) : 0;
  return { ratePerSecond: perMachine * machines.length, machineCount: machines.length, recipe: recipeId };
}

function safetyStock(ratePerSecond) {
  if (ratePerSecond <= 2) return 32;
  if (ratePerSecond <= 8) return 64;
  if (ratePerSecond <= 16) return 96;
  return 128;
}

const beltSpeed = raw['transport-belt']?.['fast-transport-belt']?.speed;
if (!Number.isFinite(beltSpeed) || beltSpeed <= 0) throw new Error('Missing fast belt speed');
const beltTilesPerSecond = beltSpeed * 60;
const highTierBlocks = new Set();
const highTierMultiplier = 1;
const fuelThreshold = Number(process.env.BRANCH_LIMIT_FUEL_THRESHOLD || 16);
if (!Number.isFinite(fuelThreshold) || fuelThreshold < 1) throw new Error('BRANCH_LIMIT_FUEL_THRESHOLD must be positive');
const heads = blueprint.entities.filter(entity => entity.name === 'fast-transport-belt'
  && entity.tags?.role === 'splitter-output'
  && entity.tags?.route?.startsWith('input:')
  && entity.tags.material === 'solid-fuel');
if (!heads.length) throw new Error('No intermediate input branch heads found');

const existingWires = new Set(blueprint.wires.map(([a, ca, b, cb]) => `${a}:${ca}:${b}:${cb}`));
const limits = [];
let nextEntity = Math.max(...blueprint.entities.map(entity => entity.entity_number)) + 1;
const passiveOffsets = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
  { x: 2, y: 0 }, { x: -2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: -2 },
];

function passivePosition(head) {
  const headGrid = { x: Math.floor(head.position.x), y: Math.floor(head.position.y) };
  for (const offset of passiveOffsets) {
    const grid = { x: headGrid.x + offset.x, y: headGrid.y + offset.y };
    const candidate = { name: 'fast-transport-belt', position: { x: grid.x + 0.5, y: grid.y + 0.5 }, direction: 8 };
    if (entityCells(candidate).some(cell => occupied.has(key(cell.x, cell.y)))) continue;
    return candidate;
  }
  throw new Error(`No passive belt cell near branch head #${head.entity_number}`);
}

for (const head of heads) {
  if (head.direction !== 0) throw new Error(`Branch head #${head.entity_number} is not a north belt`);
  const route = head.tags.route;
  const blockId = route.slice('input:'.length, route.lastIndexOf(':'));
  const material = head.tags.material;
  const demand = blockDemand(blockId, material);
  const pathTiles = routeLength(route, head);
  const latencySeconds = pathTiles / beltTilesPerSecond;
  const safety = fuelThreshold;
  const baseThreshold = Math.max(safety, Math.ceil(demand.ratePerSecond * latencySeconds + safety));
  const threshold = fuelThreshold;
  const passive = passivePosition(head);
  const passiveEntity = {
    entity_number: nextEntity++,
    name: passive.name,
    position: passive.position,
    direction: passive.direction,
    tags: { starter_entity: nextEntity - 1, branch_limit_passive: true, branch_limit_for: head.entity_number }
  };
  blueprint.entities.push(passiveEntity);
  for (const cell of entityCells(passiveEntity)) occupied.set(key(cell.x, cell.y), passiveEntity);
  head.control_behavior = {
    ...(head.control_behavior || {}),
    circuit_read_hand_contents: true,
    circuit_contents_read_mode: 2,
    circuit_enabled: true,
    circuit_condition: {
      first_signal: { type: 'item', name: material, quality: 'normal' },
      comparator: '<',
      constant: threshold
    }
  };
  head.tags = { ...(head.tags || {}), branch_limit: { material, threshold, baseThreshold, highTierMultiplier: highTierBlocks.has(blockId) ? highTierMultiplier : 1, pathTiles, latencySeconds, requiredRatePerSecond: demand.ratePerSecond, safetyStock: safety, blockId, recipe: demand.recipe } };
  const wire = [head.entity_number, 2, passiveEntity.entity_number, 2];
  if (!existingWires.has(wire.join(':'))) blueprint.wires.push(wire);
  limits.push({
    headEntity: head.entity_number,
    passiveEntity: passiveEntity.entity_number,
    route,
    blockId,
    material,
    recipe: demand.recipe,
    machineCount: demand.machineCount,
    requiredRatePerSecond: demand.ratePerSecond,
    pathTiles,
    beltTilesPerSecond,
    latencySeconds,
    safetyStock: safety,
    threshold,
    headPosition: head.position,
    passivePosition: passiveEntity.position,
    wire
  });
}

// The branch head is separated from the block's mixed input lane by the
// deliberately long underground run.  Underground belts have no circuit
// connector, so a direct wire would silently exceed the 9-tile circuit range.
// Put one read-only whole-line reader on the first input-shared belt and use a
// sparse belt relay around the underground run.  This keeps each block's
// branch gates on the same local green network without changing item flow.
const relayForbidden = new Set();
for (const entity of blueprint.entities) {
  for (const cell of entityCells(entity)) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) relayForbidden.add(key(cell.x + dx, cell.y + dy));
  }
}
const relayEntities = new Map();
const sharedReaders = [];
const blockHeads = new Map();
for (const head of heads) {
  const blockId = head.tags.route.slice('input:'.length, head.tags.route.lastIndexOf(':'));
  if (!blockHeads.has(blockId)) blockHeads.set(blockId, []);
  blockHeads.get(blockId).push(head);
}

function addWire(a, b) {
  const forward = `${a.entity_number}:2:${b.entity_number}:2`;
  const reverse = `${b.entity_number}:2:${a.entity_number}:2`;
  if (existingWires.has(forward) || existingWires.has(reverse)) return [a.entity_number, 2, b.entity_number, 2];
  const wire = [a.entity_number, 2, b.entity_number, 2];
  blueprint.wires.push(wire);
  existingWires.add(forward);
  existingWires.add(reverse);
  return wire;
}

function gridPosition(entity) {
  return { x: Math.floor(entity.position.x), y: Math.floor(entity.position.y) };
}

function distance(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
}

class MinHeap {
  #items = [];
  get length() { return this.#items.length; }
  push(item) {
    const a = this.#items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.#items;
    if (!a.length) return undefined;
    const result = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        let best = i;
        if (l < a.length && a[l].f < a[best].f) best = l;
        if (r < a.length && a[r].f < a[best].f) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]];
        i = best;
      }
    }
    return result;
  }
}

function relayPath(startEntity, goalEntity, blockId, allowedRelayKeys, relaxed = false) {
  const start = gridPosition(startEntity);
  const goal = gridPosition(goalEntity);
  const minX = Math.min(start.x, goal.x) - 42;
  const maxX = Math.max(start.x, goal.x) + 42;
  const minY = Math.min(start.y, goal.y) - 8;
  const maxY = Math.max(start.y, goal.y) + 8;
  const nodeKey = (x, y) => `${x},${y}`;
  const isFree = (x, y) => {
    const k = nodeKey(x, y);
    return (x === start.x && y === start.y) || (x === goal.x && y === goal.y)
      || allowedRelayKeys.has(k)
      || (!occupied.has(k) && (relaxed || !relayForbidden.has(k)));
  };
  const heuristic = (x, y) => Math.hypot(x - goal.x, y - goal.y) / 8;
  const open = new MinHeap();
  const best = new Map([[nodeKey(start.x, start.y), 0]]);
  const previous = new Map();
  open.push({ x: start.x, y: start.y, g: 0, f: heuristic(start.x, start.y) });
  let expansions = 0;
  while (open.length) {
    const current = open.pop();
    if (++expansions > 100000) throw new Error(`relay path search bound exceeded for ${blockId} ${start.x},${start.y}->${goal.x},${goal.y}`);
    if (current.x === goal.x && current.y === goal.y) {
      const path = [{ x: current.x, y: current.y }];
      let k = nodeKey(current.x, current.y);
      while (previous.has(k)) {
        const prior = previous.get(k);
        path.push({ x: prior.x, y: prior.y });
        k = nodeKey(prior.x, prior.y);
      }
      return path.reverse();
    }
    for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++) {
      if (dx === 0 && dy === 0) continue;
      const x = current.x + dx, y = current.y + dy;
      if (x < minX || x > maxX || y < minY || y > maxY || Math.hypot(dx, dy) > 8.01 || !isFree(x, y)) continue;
      const k = nodeKey(x, y);
      const g = current.g + 1;
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      previous.set(k, { x: current.x, y: current.y });
      open.push({ x, y, g, f: g + heuristic(x, y) });
    }
  }
  throw new Error(`no relay path for ${blockId} ${start.x},${start.y}->${goal.x},${goal.y}; expanded ${expansions}`);
}

const sharedByBlock = new Map();
for (const entity of blueprint.entities.filter(entity => entity.name === 'fast-transport-belt' && entity.tags?.role === 'input-shared')) {
  const blockId = entity.tags.compact_block;
  if (!blockId) continue;
  const grid = gridPosition(entity);
  const keyForLine = `${blockId}:${grid.x}`;
  const current = sharedByBlock.get(keyForLine);
  if (!current || grid.y < gridPosition(current).y) sharedByBlock.set(keyForLine, entity);
}

const useRelay = process.env.BRANCH_LIMIT_RELAYS !== '0';
const useSharedWires = process.env.BRANCH_LIMIT_SHARED_WIRES !== '0';
const requestedSharedBlocks = process.env.BRANCH_LIMIT_SHARED_BLOCKS?.split(',').map(value => value.trim()).filter(Boolean);
const sharedBlockFilter = requestedSharedBlocks?.length ? new Set(requestedSharedBlocks) : null;
for (const [blockId, blockBranchHeads] of blockHeads) {
  if (sharedBlockFilter && !sharedBlockFilter.has(blockId)) continue;
  const sharedCandidates = [...sharedByBlock.entries()].filter(([keyForLine]) => keyForLine.startsWith(`${blockId}:`)).map(([, entity]) => entity);
  if (sharedCandidates.length !== 1) throw new Error(`expected one input-shared line for ${blockId}, found ${sharedCandidates.length}`);
  const shared = sharedCandidates[0];
  shared.control_behavior = { ...(shared.control_behavior || {}), circuit_read_hand_contents: true, circuit_contents_read_mode: 2 };
  shared.tags = { ...(shared.tags || {}), branch_limit_shared_reader: true, branch_limit_block: blockId };
  const sharedRecord = { entity: shared.entity_number, blockId, position: shared.position, branchHeads: blockBranchHeads.map(head => head.entity_number), relayEntities: [], wires: [] };
  const allowedRelayKeys = new Set();
  if (!useRelay) {
    if (useSharedWires) for (const head of blockBranchHeads) sharedRecord.wires.push(addWire(shared, head));
    sharedReaders.push(sharedRecord);
    continue;
  }
  for (const head of blockBranchHeads) {
    let pathNodes;
    let relayClearance = 'guarded';
    try {
      pathNodes = relayPath(shared, head, blockId, allowedRelayKeys);
    } catch (error) {
      // A prior block can consume the only guarded approach around a shared
      // bus crossing.  Retry without the one-cell belt-adjacency margin, but
      // still reject every actual collision; this is a bounded fallback and
      // is recorded for review rather than silently changing the layout.
      pathNodes = relayPath(shared, head, blockId, allowedRelayKeys, true);
      relayClearance = 'collision-only-fallback';
    }
    for (const node of pathNodes.slice(1, -1)) {
      const relayKey = key(node.x, node.y);
      let relay = relayEntities.get(`${blockId}:${relayKey}`);
      if (!relay) {
        relay = {
          entity_number: nextEntity++,
          name: 'fast-transport-belt',
          position: { x: node.x + 0.5, y: node.y + 0.5 },
          direction: 0,
          tags: { starter_entity: nextEntity - 1, branch_limit_relay: true, branch_limit_block: blockId }
        };
        if (entityCells(relay).some(cell => occupied.has(key(cell.x, cell.y)))) throw new Error(`relay collision at ${relay.position.x},${relay.position.y}`);
        blueprint.entities.push(relay);
        for (const cell of entityCells(relay)) occupied.set(key(cell.x, cell.y), relay);
        relayEntities.set(`${blockId}:${relayKey}`, relay);
        sharedRecord.relayEntities.push(relay.entity_number);
      }
      allowedRelayKeys.add(relayKey);
    }
    const pathEntities = [shared];
    for (const node of pathNodes.slice(1, -1)) pathEntities.push(relayEntities.get(`${blockId}:${node.x},${node.y}`));
    pathEntities.push(head);
    if (useSharedWires) for (let i = 1; i < pathEntities.length; i++) sharedRecord.wires.push(addWire(pathEntities[i - 1], pathEntities[i]));
    sharedRecord.relayClearance = relayClearance;
  }
  sharedReaders.push(sharedRecord);
}

const sourceNote = `Solid-fuel input branches use isolated whole-belt readers (mode 2) with a ${fuelThreshold}-item stock limit; all other item branches, raw ports, and oil geometry are unchanged.`;
info.setupNotes = [...(info.setupNotes || []), sourceNote];
info.changes = [...(info.changes || []), 'Added seven opt-in solid-fuel branch-head stock gates; each reader is wired to a passive nearby red belt.', 'Added one read-only mixed-input line reader per steel-fuel block and bounded circuit relays so gates include shared-lane fuel stock.'];
info.branchLimits = { mode: 'whole-belt-read-mode-2', fuelOnly: true, threshold: fuelThreshold, count: limits.length, limits, sharedReaders, relayCount: relayEntities.size, circuitWireRange: 9, highTierBlocks: [], highTierMultiplier: 1 };
blueprint.description = `${blueprint.description || info.name}\n${sourceNote}`;
const encoded = encodeBlueprint({ blueprint }) + '\n';
const blueprintSha256 = createHash('sha256').update(encoded.trim()).digest('hex');
const materials = blueprintMaterials({ blueprint }, catalog);
info.blueprintSha256 = blueprintSha256;
info.entityCount = materials.entityCount;
info.entries = materials.entries;
info.excluded = materials.excluded;
const out = path.join(outRoot, 'blueprint-sources/science-factories');
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, info.file), encoded);
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify([info], null, 2) + '\n');
await fs.writeFile(path.join(out, 'branch-limits.json'), JSON.stringify({ source: sourceRoot, sourceBlueprintSha256: createHash('sha256').update(code).digest('hex'), blueprintSha256, count: limits.length, beltTilesPerSecond, limits, sharedReaders, relayCount: relayEntities.size, highTierBlocks: [...highTierBlocks], highTierMultiplier }, null, 2) + '\n');
console.log(JSON.stringify({ out, blueprintSha256, entityCount: materials.entityCount, controlledBranches: limits.length, sharedReaders: sharedReaders.length, relays: relayEntities.size, highTierMultiplier, beltTilesPerSecond, limits }, null, 2));
