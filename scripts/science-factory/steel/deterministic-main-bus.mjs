// Deterministic main-bus router for compact recipe blocks.
//
// The router deliberately has no search.  Blocks are translated first, each
// material gets one eastbound bus row, and every vertical branch crosses other
// bus rows with a direction-preserving fast underground pair.  Crossing
// columns alternate by one tile, so the output of one pair and the input of
// the next pair are diagonal rather than adjacent collinear endpoints.  That
// makes Factorio's nearest-underground pairing deterministic.

const EAST = 4;
const NORTH = 0;
const SOUTH = 8;
const WEST = 12;
const BELT = 'fast-transport-belt';
const UNDERGROUND = 'fast-underground-belt';
const SPLITTER = 'fast-splitter';
const GRID_DIRECTIONS = Object.freeze({ north: NORTH, east: EAST, south: SOUTH, west: WEST });
const vector = direction => ({ [NORTH]: [0, -1], [EAST]: [1, 0], [SOUTH]: [0, 1], [WEST]: [-1, 0] }[direction]);
const key = (x, y) => `${x},${y}`;
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const eq = (a, b) => a.x === b.x && a.y === b.y;

function fail(message) {
  throw new Error(`deterministic main bus: ${message}`);
}

function integer(value, label) {
  if (!Number.isInteger(value)) fail(`${label} must be an integer`);
  return value;
}

function blockId(block, index) {
  return block?.id || `block-${index + 1}`;
}

function blockBodyCells(block) {
  const cells = [];
  for (const row of block.rows || []) {
    const width = row.machine.geometry.width;
    const height = row.machine.geometry.height;
    const center = row.machine.centre;
    const left = Math.floor(center.x - width / 2 + 1e-9);
    const top = Math.floor(center.y - height / 2 + 1e-9);
    for (let x = left; x < left + width; x++) for (let y = top; y < top + height; y++) cells.push({ x, y });
  }
  return cells;
}

function localBlockCells(block) {
  const cells = new Map();
  const claim = (cell, owner) => {
    const k = key(cell.x, cell.y);
    if (cells.has(k)) fail(`${block.id || 'block'} overlaps itself at ${k}: ${cells.get(k)} / ${owner}`);
    cells.set(k, owner);
  };
  for (const belt of block.belts || []) claim(belt.grid, `belt:${belt.id}`);
  for (const row of block.rows || []) {
    for (const cell of blockBodyCells({ rows: [row] })) claim(cell, `machine:${row.index}`);
    for (const arm of [...(row.machine.inputArms || []), ...(row.machine.outputArms || [])]) claim(arm.grid, `inserter:${arm.entity}`);
  }
  return cells;
}

function translateBlock(block, placement, id, state) {
  const localCells = localBlockCells(block);
  const offset = { x: integer(placement.x, `${id}.placement.x`), y: integer(placement.y, `${id}.placement.y`) };
  const localToGlobal = cell => ({ x: cell.x + offset.x, y: cell.y + offset.y });
  const localEntityIds = new Map();
  for (const saved of block.entities || []) {
    const entityNumber = state.nextEntity++;
    localEntityIds.set(saved.entity_number, entityNumber);
    state.entities.push({
      ...saved,
      entity_number: entityNumber,
      position: { x: saved.position.x + offset.x, y: saved.position.y + offset.y },
      tags: { ...(saved.tags || {}), deterministic_bus_block: id, starter_entity: entityNumber }
    });
  }
  for (const [cell, owner] of localCells) {
    const [x, y] = cell.split(',').map(Number);
    state.claim({ x: x + offset.x, y: y + offset.y }, `block:${id}:${owner}`);
  }
  // Keep an index of ordinary block belts.  Route construction must be able
  // to distinguish a legal terminal join from a foreign belt that merely
  // happens to occupy an intermediate tile.
  for (const belt of block.belts || []) {
    const entityNumber = localEntityIds.get(belt.entity);
    const entity = state.entities.find(candidate => candidate.entity_number === entityNumber);
    if (entity?.name === BELT) state.beltsByCell.set(key(belt.grid.x + offset.x, belt.grid.y + offset.y), entity);
  }
  const inputPorts = (block.inputs || []).map((input, index) => ({
    index,
    material: input.material,
    blockId: id,
    side: input.side,
    lane: input.lane,
    grid: localToGlobal(input.routeTarget.grid),
    direction: input.routeTarget.direction,
    sourceGrid: localToGlobal(input.routeTarget.sideLoad?.grid || input.routeTarget.grid),
    sourceDirection: input.routeTarget.sideLoad?.direction || input.routeTarget.direction,
    localGrid: { ...input.routeTarget.grid }
  }));
  const outputPort = {
    blockId: id,
    material: block.outputs.material,
    grid: localToGlobal(block.outputs.producerPort.grid),
    direction: block.outputs.producerPort.direction,
    localGrid: { ...block.outputs.producerPort.grid }
  };
  state.blocks.push({ id, block, placement: offset, inputPorts, outputPort, localEntityIds });
  return state.blocks.at(-1);
}

function topoSort(blocks) {
  const producers = new Map();
  for (const record of blocks) {
    const material = record.outputPort.material;
    const list = producers.get(material) || [];
    list.push(record.id);
    producers.set(material, list);
  }
  const edges = new Map(blocks.map(record => [record.id, new Set()]));
  const indegree = new Map(blocks.map(record => [record.id, 0]));
  for (const record of blocks) {
    for (const ingredient of record.block.recipe.ingredients || []) {
      for (const producer of producers.get(ingredient.id) || []) {
        if (producer === record.id || edges.get(producer).has(record.id)) continue;
        edges.get(producer).add(record.id);
        indegree.set(record.id, indegree.get(record.id) + 1);
      }
    }
  }
  const pending = blocks.filter(record => indegree.get(record.id) === 0).map(record => record.id);
  const order = [];
  while (pending.length) {
    const id = pending.shift();
    order.push(blocks.find(record => record.id === id));
    for (const next of edges.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) pending.push(next);
    }
  }
  if (order.length !== blocks.length) fail('block recipe graph contains a cycle');
  return order;
}

function addEntity(state, name, grid, props = {}, footprint = [{ x: 0, y: 0 }]) {
  for (const delta of footprint) state.claim({ x: grid.x + delta.x, y: grid.y + delta.y }, `${name}:${state.nextEntity}`);
  const entity = {
    entity_number: state.nextEntity++,
    name,
    position: { x: grid.x + 0.5, y: grid.y + 0.5 },
    ...props,
    tags: { ...(props.tags || {}), starter_entity: state.nextEntity - 1, deterministic_bus: true }
  };
  state.entities.push(entity);
  return entity;
}

function addBelt(state, grid, direction, tags = {}) {
  const entity = addEntity(state, BELT, grid, { direction, tags });
  state.beltsByCell.set(key(grid.x, grid.y), entity);
  return entity;
}

function addSplitter(state, grid, direction, tags = {}) {
  // Factorio rotates the splitter's 2-tile body perpendicular to its flow:
  // east/west flow occupies two north/south cells, while north/south flow
  // occupies two east/west cells.  `grid` is always the first occupied tile.
  const perpendicular = direction === EAST || direction === WEST;
  const footprint = perpendicular ? [{ x: 0, y: 0 }, { x: 0, y: 1 }] : [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  // `grid` is the first occupied tile.  Blueprint splitter coordinates are
  // the centre of the two-tile body, so preserve the half-tile offset on the
  // short axis and the full tile offset on the long axis.
  const position = perpendicular ? { x: grid.x + 0.5, y: grid.y + 1 } : { x: grid.x + 1, y: grid.y + 0.5 };
  for (const delta of footprint) state.claim({ x: grid.x + delta.x, y: grid.y + delta.y }, `${SPLITTER}:${state.nextEntity}`);
  const entity = {
    entity_number: state.nextEntity++,
    name: SPLITTER,
    position,
    direction,
    tags: { ...tags, starter_entity: state.nextEntity - 1, deterministic_bus: true, deterministic_bus_grid: { ...grid } }
  };
  state.entities.push(entity);
  return entity;
}

function addUndergroundPair(state, input, output, direction, material, id) {
  const [dx, dy] = vector(direction);
  const span = Math.abs(output.x - input.x) + Math.abs(output.y - input.y);
  if (span < 2 || span > 7 || (dx && input.y !== output.y) || (dy && input.x !== output.x)) fail(`underground pair ${id} has invalid span ${span}`);
  const tag = `det-bus-${id}`;
  const inEntity = addEntity(state, UNDERGROUND, input, { direction, type: 'input', tags: { material, tunnel: tag, route: id } });
  const outEntity = addEntity(state, UNDERGROUND, output, { direction, type: 'output', tags: { material, tunnel: tag, route: id } });
  state.tunnels.push({ id, material, direction, input: { ...input }, output: { ...output }, inputEntity: inEntity.entity_number, outputEntity: outEntity.entity_number, span });
  return { input: inEntity, output: outEntity, tunnelId: id };
}

function beltCarries(entity, material) {
  return entity?.tags?.material === material
    || entity?.tags?.materials?.includes?.(material)
    || Object.values(entity?.tags?.lane_materials || {}).includes(material);
}

function turnOwnedBelt(state, grid, direction, routeId) {
  const belt = state.beltsByCell.get(key(grid.x, grid.y));
  if (!belt) return;
  if (belt.tags?.route !== routeId) return;
  belt.direction = direction;
}

function addStraight(state, from, to, direction, material, routeId) {
  const [dx, dy] = vector(direction);
  const startingBelt = state.beltsByCell.get(key(from.x, from.y));
  if (startingBelt && !beltCarries(startingBelt, material)) {
    fail(`${routeId} starts on foreign ${key(from.x, from.y)} belt`);
  }
  // Segment turns are represented by changing the owned ordinary belt at the
  // segment's origin.  Underground outputs and shared block/bus belts are
  // intentionally left untouched.
  turnOwnedBelt(state, from, direction, routeId);
  let current = { ...from };
  const cells = [];
  while (!eq(current, to)) {
    current = { x: current.x + dx, y: current.y + dy };
    const occupied = state.claimed.get(key(current.x, current.y));
    if (occupied) {
      const existing = state.beltsByCell.get(key(current.x, current.y));
      // A route may terminate on an existing same-material belt (for example
      // a vertical collector entering an eastbound bus).  Passing through an
      // occupied belt, or joining a foreign material, is always a geometry
      // error and must be diagnosed instead of silently skipped.
      if (eq(current, to) && existing && beltCarries(existing, material)) break;
      fail(`${routeId} crosses occupied ${key(current.x, current.y)} (${occupied})`);
    }
    addBelt(state, current, direction, { material, route: routeId });
    cells.push({ ...current, direction });
  }
  return cells;
}

function addHorizontal(state, from, to, direction, material, routeId) {
  if (from.y !== to.y) fail('horizontal segment endpoints must share y');
  return addStraight(state, from, to, direction, material, routeId);
}

// Horizontal block approaches can meet a producer's vertical collector.  A
// two-tile fast underground pair lets the approach cross that corridor while
// keeping both belt directions intact.  The caller supplies all reserved
// vertical columns; the branch's own starting column is naturally skipped.
function addHorizontalAcrossColumns(state, from, to, direction, material, routeId) {
  if (from.y !== to.y) fail('horizontal crossing endpoints must share y');
  const [dx] = vector(direction);
  const columns = [...(state.verticalColumns || [])]
    .filter(column => (dx > 0 ? column > from.x && column < to.x : column < from.x && column > to.x)
      && state.claimed.has(key(column, from.y)))
    .sort((a, b) => dx > 0 ? a - b : b - a);
  let current = { ...from };
  const addOpenLine = endpoint => {
    const next = { x: endpoint.x - dx, y: endpoint.y };
    // If the current belt is already immediately beside the tunnel input,
    // there is no ordinary tile to add.  This guard is also direction-aware:
    // for a westbound branch `next` lies east of an adjacent current tile and
    // must not send addStraight into an infinite loop.
    const forward = (next.x - current.x) * dx;
    if (forward > 0) addStraight(state, current, next, direction, material, routeId);
  };
  for (const column of columns) {
    const input = { x: column - dx, y: from.y };
    const output = { x: column + dx, y: from.y };
    addOpenLine(input);
    addUndergroundPair(state, input, output, direction, material, `${routeId}-branch-cross-${column}`);
    current = output;
  }
  if (!eq(current, to)) addStraight(state, current, to, direction, material, routeId);
  return current;
}

function addVertical(state, from, to, direction, material, routeId) {
  if (from.x !== to.x) fail('vertical segment endpoints must share x');
  return addStraight(state, from, to, direction, material, routeId);
}

function crossRows(state, { from, toY, direction, material, routeId, rows, x }) {
  const ascending = direction === SOUTH;
  // Condensed rows may share a y coordinate when their safe x intervals are
  // disjoint.  Cross each physical row once; treating the same y as two
  // independent rows would create a duplicate underground pair.
  const crossed = [...new Set(rows)].filter(y => ascending ? y > from.y && y < toY : y < from.y && y > toY).sort((a, b) => ascending ? a - b : b - a);
  let current = { ...from };
  const column = x;
  const segments = [];
  const tunnelIds = [];
  for (const row of crossed) {
    const input = { x: column, y: ascending ? row - 1 : row + 1 };
    const output = { x: column, y: ascending ? row + 1 : row - 1 };
    const pre = { x: column, y: ascending ? input.y - 1 : input.y + 1 };
    if (!eq(current, pre)) {
      segments.push(...addVertical(state, current, pre, direction, material, routeId));
    }
    const pair = addUndergroundPair(state, input, output, direction, material, `${routeId}-cross-${row}`);
    tunnelIds.push(pair.tunnelId);
    segments.push({ ...output, direction, underground: true });
    current = { x: column, y: output.y };
  }
  const final = { x: column, y: toY };
  if (!eq(current, final)) segments.push(...addVertical(state, current, final, direction, material, routeId));
  return { current: final, column, crossed, segments, tunnelIds };
}

function routeInput(state, record, port, bus, branchIndex, allRows, options) {
  const routeId = `input:${record.id}:${port.index}`;
  state.currentRoute = routeId;
  // The branch starts at a dedicated local column.  A is the clear west
  // edge, B uses a farther west overhead neck, and C approaches from the
  // west above the block; these rows are kept distinct by the block helper.
  const column = port.branchColumn;
  if (column !== bus.tapX) fail(`${routeId} fanout column ${bus.tapX} is not aligned with ${column}`);
  const first = { x: column, y: bus.y - 1 };
  // The bus builder reserved this fanout splitter before routes were
  // emitted.  Reusing it is essential: placing another splitter here would
  // overlap the main-bus junction and would also make the branch ambiguous
  // to Factorio's splitter pairing rules.
  const splitter = { entity_number: bus.tapSplitterEntity, position: { x: bus.tapX - 0.5, y: bus.y } };
  if (!splitter.entity_number) fail(`${routeId} has no reserved fanout splitter`);
  // The splitter's north output is a distinct tile above its footprint.  Its
  // logical edge is recorded explicitly; this keeps the bus itself continuous
  // while preventing a second entity from occupying the splitter tile.
  addBelt(state, first, NORTH, { material: port.material, route: routeId, role: 'splitter-output' });
  const approachY = port.side === 'west' && port.lane === 0
    ? port.grid.y
    : port.side === 'west'
      ? port.grid.y - 1
      : port.grid.y - 2;
  const crossing = crossRows(state, { from: first, toY: approachY, direction: NORTH, material: port.material, routeId, rows: allRows, x: column });
  const approach = crossing.current;
  if (port.side === 'west' && port.lane === 0) {
    if (approach.x !== port.grid.x) {
      if (approach.x > port.grid.x) fail(`${routeId} lane A branch is east of its target`);
      addHorizontalAcrossColumns(state, approach, { x: port.grid.x, y: approach.y }, EAST, port.material, routeId);
    }
    // The northbound spine necessarily placed the final tile facing north.
    // A's side-load contract is east-facing, so retag that existing tile (or
    // create it when an external route ended one tile short).
    const target = state.entities.find(entity => entity.name === BELT
      && entity.tags?.route === routeId
      && Math.floor(entity.position.x) === port.grid.x
      && Math.floor(entity.position.y) === port.grid.y);
    if (target) {
      target.direction = port.direction;
      target.tags = { ...(target.tags || {}), role: 'input-target' };
    } else {
      addBelt(state, port.grid, port.direction, { material: port.material, route: routeId, role: 'input-target' });
    }
  } else if (port.side === 'west') {
    if (approach.x > port.grid.x) fail(`${routeId} lane B branch is east of its target`);
    addHorizontalAcrossColumns(state, approach, { x: port.grid.x, y: approach.y }, EAST, port.material, routeId);
    // The B neck turns down into the dedicated target tile before that tile
    // turns west toward the inserter.  Without this owned-belt turn the
    // overhead eastbound belt simply runs past the target.
    turnOwnedBelt(state, { x: port.grid.x, y: approach.y }, SOUTH, routeId);
    // The final B target intentionally retains its west-facing direction.
    addBelt(state, port.grid, port.direction, { material: port.material, route: routeId, role: 'input-target' });
  } else {
    if (approach.x > port.grid.x) fail(`${routeId} C branch is east of its target`);
    addHorizontalAcrossColumns(state, approach, { x: port.grid.x, y: approach.y }, EAST, port.material, routeId);
    addVertical(state, { x: port.grid.x, y: approach.y }, port.grid, SOUTH, port.material, routeId);
  }
  const end = state.addRouteNode(port.grid, port.material, routeId, 'input-target', port.direction);
  state.routes.push({ id: routeId, kind: 'input-fanout', blockId: record.id, material: port.material, source: { splitter: splitter.entity_number, bus: { ...bus } }, target: end, branchColumn: column, crossedRows: crossing.crossed, tunnelIds: crossing.tunnelIds });
}

function routeOutput(state, record, bus, branchIndex, allRows, options) {
  const routeId = `output:${record.id}`;
  state.currentRoute = routeId;
  const source = record.outputPort.grid;
  if (record.outputPort.routeMode === 'south') {
    // This is an existing adapter output belt.  Its saved endpoint is already
    // directed south, so continue from the adjacent tile instead of adding an
    // eastbound belt on top of the adapter's endpoint.  The adjacent join is
    // owned by this router so the static reachability proof can start there;
    // the saved adapter belt is one tile north and has the same direction.
    const branchColumn = bus.x;
    if (branchColumn !== source.x) fail(`south output junction for ${record.id} is not aligned with its saved port`);
    addBelt(state, source, SOUTH, { material: record.outputPort.material, route: routeId, role: 'adapter-source' });
    const crossing = crossRows(state, {
      from: { ...source }, toY: bus.y, direction: SOUTH,
      material: record.outputPort.material, routeId, rows: allRows, x: branchColumn
    });
    const final = { x: crossing.column, y: bus.y };
    if (!state.claimed.has(key(final.x, final.y))) addBelt(state, final, EAST, { material: record.outputPort.material, route: routeId, role: 'adapter-merge' });
    const end = state.addRouteNode(final, record.outputPort.material, routeId, 'bus-merge', EAST);
    state.routes.push({ id: routeId, kind: 'output-merge', blockId: record.id, material: record.outputPort.material,
      source: { ...source }, target: end, branchColumn, crossedRows: crossing.crossed,
      tunnelIds: crossing.tunnelIds, splitter: bus.mergeSplitterEntity, adapter: true });
    return;
  }
  // Output junctions are reserved on the bus row itself.  Keep this branch
  // in the same column all the way through the row crossings so it reaches
  // the reserved merge splitter rather than creating an unpaired splitter at
  // a drifting column.  Input branches still alternate columns because they
  // fan out to independent block targets; output branches have one dedicated
  // merge column per producing block.
  const branchColumn = bus.x;
  if (branchColumn !== source.x + 1) fail(`output junction for ${record.id} is not aligned with its producer port`);
  // The block helper leaves its producer port empty.  Continue the collector
  // one tile east before turning south into a private clear corridor.  The
  // turn happens before the shared east route so another block's north/south
  // input neck cannot be crossed by an output belt.
  addBelt(state, source, EAST, { material: record.outputPort.material, route: routeId, role: 'producer-port' });
  const turnX = source.x + 1;
  addBelt(state, { x: turnX, y: source.y }, SOUTH, { material: record.outputPort.material, route: routeId, role: 'producer-turn' });
  const crossing = crossRows(state, { from: { x: turnX, y: source.y }, toY: bus.y, direction: SOUTH, material: record.outputPort.material, routeId, rows: allRows, x: branchColumn });
  const final = { x: crossing.column, y: bus.y };
  // The bus builder already placed the east-facing splitter at
  // {x: bus.x + 1, y: bus.y}; the tile immediately west ({x: bus.x,
  // y: bus.y}) is the splitter's input belt.  Reuse those entities instead
  // of placing a second splitter on top of a main-bus belt.
  if (!state.claimed.has(key(final.x, final.y))) addBelt(state, final, EAST, { material: record.outputPort.material, route: routeId, role: 'producer-merge' });
  const end = state.addRouteNode({ x: final.x, y: final.y }, record.outputPort.material, routeId, 'bus-merge', EAST);
  state.routes.push({ id: routeId, kind: 'output-merge', blockId: record.id, material: record.outputPort.material, source: { ...source }, target: end, branchColumn, turn: { x: turnX, y: source.y }, crossedRows: crossing.crossed, tunnelIds: crossing.tunnelIds, splitter: bus.mergeSplitterEntity });
}

function makeState() {
  const state = {
    entities: [],
    routes: [],
    tunnels: [],
    buses: [],
    blocks: [],
    claimed: new Map(),
    beltsByCell: new Map(),
    nextEntity: 1,
    claim(cell, owner) {
      const k = key(cell.x, cell.y);
      if (this.claimed.has(k)) fail(`geometry overlap at ${k}: ${this.claimed.get(k)} / ${owner} (route ${this.currentRoute || 'none'})`);
      this.claimed.set(k, owner);
    },
    addRouteNode(grid, material, route, role, direction) {
      return { grid: { ...grid }, material, route, role, direction };
    }
  };
  return state;
}

function validateRows(busRows) {
  const entries = busRows instanceof Map ? [...busRows.entries()] : Object.entries(busRows || {});
  if (!entries.length) fail('busRows must define at least one material row');
  const rows = entries.map(([material, y]) => {
    integer(y, `busRows.${material}`);
    return { material, y };
  }).sort((a, b) => a.y - b.y);
  const uniqueRows = [...new Set(rows.map(row => row.y))].sort((a, b) => a - b);
  for (let i = 1; i < uniqueRows.length; i++) if (uniqueRows[i] - uniqueRows[i - 1] < 3) fail(`bus rows at y=${uniqueRows[i - 1]}/${uniqueRows[i]} need three tiles of spacing`);
  return rows;
}

function entityCells(entities) {
  const cells = new Map();
  for (const entity of entities) {
    const taggedGrid = entity.tags?.deterministic_bus_grid;
    const x = taggedGrid ? taggedGrid.x : Math.floor(entity.position.x);
    const y = taggedGrid ? taggedGrid.y : Math.floor(entity.position.y);
    const footprint = entity.name === SPLITTER && (entity.direction === EAST || entity.direction === WEST)
      ? [{ x: 0, y: 0 }, { x: 0, y: 1 }]
      : entity.name === SPLITTER
        ? [{ x: 0, y: 0 }, { x: 1, y: 0 }]
        : [{ x: 0, y: 0 }];
    for (const d of footprint) {
      const k = key(x + d.x, y + d.y);
      if (cells.has(k)) fail(`final entity overlap at ${k}`);
      cells.set(k, entity.entity_number);
    }
  }
  return cells;
}

function beltGrid(entity) {
  const tagged = entity.tags?.deterministic_bus_grid;
  return tagged ? { x: tagged.x, y: tagged.y } : { x: Math.floor(entity.position.x), y: Math.floor(entity.position.y) };
}

function beltMaterial(entity, material) {
  return beltCarries(entity, material);
}

/**
 * Follow the directed edges of the emitted belt entities, including the
 * underground pairs.  This is deliberately separate from the route metadata
 * audit: a route can have a plausible list of waypoints while a saved belt
 * still points the wrong way at a turn.
 */
export function auditEntityRouteReachability(result) {
  const beltEntities = result.entities.filter(entity => entity.name === BELT || entity.name === UNDERGROUND);
  const byCell = new Map();
  for (const entity of beltEntities) {
    const grid = beltGrid(entity);
    const cell = key(grid.x, grid.y);
    if (byCell.has(cell)) return { ok: false, failures: [{ type: 'duplicate-belt-cell', cell }] };
    byCell.set(cell, entity);
  }
  const byId = new Map(beltEntities.map(entity => [entity.entity_number, entity]));
  const graph = new Map();
  const edge = (from, to) => {
    if (!from || !to) return;
    const targets = graph.get(from.entity_number) || new Set();
    targets.add(to.entity_number);
    graph.set(from.entity_number, targets);
  };
  const tunnels = new Map((result.tunnels || []).map(tunnel => [tunnel.id, tunnel]));
  const tunnelByInput = new Map(), tunnelByOutput = new Map();
  for (const tunnel of tunnels.values()) {
    tunnelByInput.set(tunnel.inputEntity, tunnel.outputEntity);
    tunnelByOutput.set(tunnel.outputEntity, tunnel);
  }
  for (const entity of beltEntities) {
    if (entity.name === UNDERGROUND && entity.type === 'input') {
      const output = byId.get(tunnelByInput.get(entity.entity_number));
      if (output && beltMaterial(output, entity.tags?.material)) edge(entity, output);
      continue;
    }
    const [dx, dy] = vector(entity.direction);
    const grid = beltGrid(entity);
    const next = byCell.get(key(grid.x + dx, grid.y + dy));
    if (next && beltMaterial(next, entity.tags?.material || entity.tags?.materials?.[0])) edge(entity, next);
  }
  const reachable = (start, goal) => {
    if (!start || !goal) return false;
    const pending = [start.entity_number], seen = new Set(pending);
    for (let index = 0; index < pending.length; index++) {
      const id = pending[index];
      if (id === goal.entity_number) return true;
      for (const next of graph.get(id) || []) if (!seen.has(next)) {
        seen.add(next);
        pending.push(next);
      }
    }
    return false;
  };
  const failures = [];
  for (const route of result.routes || []) {
    const start = route.kind === 'input-fanout'
      ? beltEntities.find(entity => entity.tags?.route === route.id && entity.tags?.role === 'splitter-output')
      : beltEntities.find(entity => entity.tags?.route === route.id && entity.tags?.role === 'producer-port')
        || (route.adapter ? byCell.get(key(route.source.x, route.source.y)) : null);
    const targetGrid = route.target?.grid;
    const target = targetGrid ? byCell.get(key(targetGrid.x, targetGrid.y)) : null;
    if (!start || !target || !reachable(start, target)) failures.push({ type: 'unreachable-route', route: route.id, start: start?.entity_number, target: target?.entity_number, targetGrid });
  }
  return { ok: failures.length === 0, routes: (result.routes || []).length, beltEntities: beltEntities.length, failures };
}

export function auditDeterministicBus(result) {
  if (!result || result.schemaVersion !== 1) fail('result schemaVersion must be 1');
  const cells = entityCells(result.entities);
  const tunnelEnds = new Map();
  for (const tunnel of result.tunnels) {
    const pair = tunnelEnds.get(tunnel.id);
    if (pair) fail(`duplicate tunnel id ${tunnel.id}`);
    tunnelEnds.set(tunnel.id, tunnel);
    if (tunnel.input.direction !== tunnel.output.direction) fail(`tunnel ${tunnel.id} changes direction`);
    if (tunnel.span < 2 || tunnel.span > 7) fail(`tunnel ${tunnel.id} span ${tunnel.span}`);
    const inputKey = key(tunnel.input.x, tunnel.input.y), outputKey = key(tunnel.output.x, tunnel.output.y);
    if (inputKey === outputKey || cells.get(inputKey) === undefined || cells.get(outputKey) === undefined) fail(`tunnel ${tunnel.id} has missing endpoints`);
  }
  for (let i = 0; i < result.tunnels.length; i++) for (let j = i + 1; j < result.tunnels.length; j++) {
    const a = result.tunnels[i], b = result.tunnels[j];
    for (const ea of [a.input, a.output]) for (const eb of [b.input, b.output]) {
      if (ea.x === eb.x && ea.y === eb.y) fail(`underground endpoint overlap ${a.id}/${b.id}`);
    }
  }
  // Factorio pairs underground belts by direction and nearest compatible
  // endpoint.  Adjacent opposite-facing endpoints from consecutive vertical
  // crossings are legal, so reject only a true nearest-pair steal or a
  // reverse-facing candidate.
  const endpointCandidates = (endpoint, wantType, direction) => {
    const [dx, dy] = vector(direction);
    return result.tunnels.flatMap(tunnel => {
      if (tunnel.direction !== direction) return [];
      const candidate = tunnel[wantType];
      if (candidate === endpoint) return [];
      const vx = candidate.x - endpoint.x;
      const vy = candidate.y - endpoint.y;
      const span = Math.abs(vx) + Math.abs(vy);
      if (dx && vy !== 0 || dy && vx !== 0 || vx * dx + vy * dy <= 0 || span < 2 || span > 7) return [];
      return [{ tunnel, candidate, span }];
    }).sort((a, b) => a.span - b.span);
  };
  for (const tunnel of result.tunnels) {
    const outputCandidates = endpointCandidates(tunnel.input, 'output', tunnel.direction);
    if (!outputCandidates.length || outputCandidates[0].tunnel.id !== tunnel.id) fail(`underground input ${tunnel.id} would pair with ${outputCandidates[0]?.tunnel.id || 'nothing'}`);
    // For an output endpoint, the compatible input lies behind it.  Reuse the
    // same direction helper by reversing the candidate vector check locally.
    const [dx, dy] = vector(tunnel.direction);
    const reverseCandidates = result.tunnels.flatMap(other => {
      if (other.direction !== tunnel.direction) return [];
      const candidate = other.input;
      const vx = candidate.x - tunnel.output.x;
      const vy = candidate.y - tunnel.output.y;
      const span = Math.abs(vx) + Math.abs(vy);
      if (dx && vy !== 0 || dy && vx !== 0 || vx * dx + vy * dy >= 0 || span < 2 || span > 7) return [];
      return [{ tunnel: other, span }];
    }).sort((a, b) => a.span - b.span);
    if (!reverseCandidates.length || reverseCandidates[0].tunnel.id !== tunnel.id) fail(`underground output ${tunnel.id} would pair with ${reverseCandidates[0]?.tunnel.id || 'nothing'}`);
  }
  const rows = new Map(result.buses.map(bus => [bus.material, bus]));
  const rowYs = new Set(result.buses.map(bus => bus.y));
  for (const route of result.routes) {
    if (!rows.has(route.material)) fail(`${route.id} has no material bus`);
    if (!route.crossedRows.every(row => rowYs.has(row))) fail(`${route.id} references an unknown crossing row`);
    if (!Array.isArray(route.tunnelIds) || route.tunnelIds.some(id => !tunnelEnds.has(id))) fail(`${route.id} references a missing tunnel`);
    if (route.kind === 'input-fanout' && route.target.direction === undefined) fail(`${route.id} has no directed target`);
    if (route.kind === 'output-merge' && route.target.role !== 'bus-merge') fail(`${route.id} has no directed bus merge`);
  }
  const reachability = auditEntityRouteReachability(result);
  if (!reachability.ok) fail(`entity route reachability failed: ${JSON.stringify(reachability.failures)}`);
  return { ok: true, entities: result.entities.length, routes: result.routes.length, tunnels: result.tunnels.length, buses: result.buses.length, claimedCells: result.claimedCells, reachability };
}

/**
 * Route compact recipe blocks onto deterministic eastbound material buses.
 *
 * `placements` is an object keyed by block id with integer `{x,y}` offsets
 * applied to the block's local tile coordinates.  `busRows` maps every
 * intermediate/output material to an absolute y coordinate; rows must be at
 * least three tiles apart.  Blocks must sit north of every bus row.
 */
export function routeCompactBlocks({ blocks = [], placements = {}, busRows, busStartX = -64, busEndX = 128, branchGap = 8, inputBranchStart, outputBranchStart, externalInputs = [], externalOutputs = [], trimBusRanges = false, externalBusRanges = {}, outputMergeSplitters = false, inputBranchWestOffsets = { lane0: 8, lane1: 10 }, inputBranchEastOffset = 8 } = {}) {
  if (!Array.isArray(blocks) || !blocks.length) fail('blocks must be a non-empty array');
  integer(busStartX, 'busStartX'); integer(busEndX, 'busEndX');
  if (busEndX <= busStartX + 12) fail('busEndX leaves no routing space');
  if (typeof trimBusRanges !== 'boolean') fail('trimBusRanges must be boolean');
  if (typeof outputMergeSplitters !== 'boolean') fail('outputMergeSplitters must be boolean');
  if (!Number.isInteger(inputBranchWestOffsets?.lane0) || !Number.isInteger(inputBranchWestOffsets?.lane1) || inputBranchWestOffsets.lane0 < 4 || inputBranchWestOffsets.lane1 < 4) fail('inputBranchWestOffsets must define integer lane0/lane1 values at least four');
  if (!Number.isInteger(inputBranchEastOffset) || inputBranchEastOffset < 4) fail('inputBranchEastOffset must be an integer at least four');
  if (!Number.isInteger(branchGap) || branchGap < 4) fail('branchGap must be at least four tiles');
  const rows = validateRows(busRows);
  const state = makeState();
  const seenIds = new Set();
  for (const [index, block] of blocks.entries()) {
    const id = blockId(block, index);
    if (seenIds.has(id)) fail(`duplicate block id ${id}`);
    seenIds.add(id);
    if (!placements[id]) fail(`missing placement for ${id}`);
    translateBlock(block, placements[id], id, state);
  }
  const ordered = topoSort(state.blocks);
  const externalInputRecords = externalInputs.map((port, index) => ({
    id: port.id || `external-input-${index + 1}`,
    inputPort: {
      index: 0,
      material: port.material,
      side: port.side || 'west',
      lane: port.lane || 0,
      grid: { ...port.grid },
      direction: port.direction ?? EAST,
      branchColumn: port.branchColumn ?? port.grid.x
    }
  }));
  const externalOutputRecords = externalOutputs.map((port, index) => ({
    id: port.id || `external-output-${index + 1}`,
    outputPort: {
      material: port.material,
      grid: { ...port.grid },
      direction: port.direction ?? EAST,
      // Adapter outputs can already be a directed southbound belt.  In that
      // case the route starts at the saved port and continues straight down
      // into the material bus; it must not insert the normal eastward turn
      // used by compact recipe blocks.
      routeMode: port.routeMode || 'east'
    }
  }));
  const outputRecords = [...ordered, ...externalOutputRecords];
  const rowByMaterial = new Map(rows.map(row => [row.material, row]));
  const maxBlockRight = Math.max(...state.blocks.map(record => record.placement.x + record.block.footprint.right));
  const minBlockLeft = Math.min(...state.blocks.map(record => record.placement.x + record.block.footprint.left));
  const maxBlockBottom = Math.max(...state.blocks.map(record => record.placement.y + record.block.footprint.bottom));
  const minBusY = Math.min(...rows.map(row => row.y));
  if (rows.some(row => row.y <= maxBlockBottom + 2)) fail('all bus rows need a three-tile clearance below every block');
  const inputStart = inputBranchStart ?? minBlockLeft - 4;
  const outputStart = outputBranchStart ?? maxBlockRight + 4;
  if (inputStart >= minBlockLeft - 1) fail('input branch columns must remain west of blocks');
  if (outputStart <= maxBlockRight + 1) fail('output branch columns must remain east of blocks');
  const allRowYs = rows.map(row => row.y);
  state.inputBranchStart = inputStart;
  state.outputBranchStart = outputStart;
  // Give every producing block a distinct merge column on the east side of
  // the bus.  The old implementation allocated merge columns from the west
  // edge by material and then let output branches drift while crossing rows;
  // that eventually placed a second splitter over an existing belt.  These
  // columns are deterministic, reserved before any route is emitted, and are
  // reused by routeOutput.
  // Each compact block's producer collector has a clear tile immediately to
  // its east.  Use that tile as the vertical output corridor and reserve its
  // matching merge junction on every material bus.  This avoids horizontal
  // output branches crossing one another while retaining deterministic,
  // one-column-per-producer routing.
  const outputColumnByBlock = new Map(outputRecords.map(record => [record.id,
    record.outputPort.routeMode === 'south' ? record.outputPort.grid.x : record.outputPort.grid.x + 1]));
  const inputBranchColumn = (record, port) => {
    if (port.side === 'east') return record.placement.x - inputBranchEastOffset;
    // Keep the lane-zero outside pickup column clear of its own vertical
    // branch; the compact block may place that pickup two tiles farther west
    // than the machine-side lane-one inserter.
    return record.placement.x - (port.lane === 0 ? inputBranchWestOffsets.lane0 : inputBranchWestOffsets.lane1);
  };
  const inputJunctionsByMaterial = new Map();
  for (const record of ordered) for (const port of record.inputPorts) {
    const list = inputJunctionsByMaterial.get(port.material) || [];
    // Place each fanout directly under the block's clear outside column.  A
    // west lane uses the tile immediately left of the footprint; an east C
    // lane uses the tile immediately right.  This keeps its vertical branch
    // out of the inserter rows and makes its final horizontal neck local.
    list.push({ x: inputBranchColumn(record, port), kind: 'fanout', blockId: record.id, portIndex: port.index });
    inputJunctionsByMaterial.set(port.material, list);
  }
  for (const record of externalInputRecords) {
    const port = record.inputPort;
    const list = inputJunctionsByMaterial.get(port.material) || [];
    list.push({ x: port.branchColumn, kind: 'fanout', blockId: record.id, portIndex: 0 });
    inputJunctionsByMaterial.set(port.material, list);
  }
  const rangePlans = [];
  const requestedExternalRange = material => externalBusRanges instanceof Map
    ? externalBusRanges.get(material)
    : externalBusRanges?.[material];
  for (const row of rows) {
    const materialOutputRecords = outputRecords.filter(record => record.outputPort.material === row.material);
    const materialMergeCount = materialOutputRecords.length;
    const materialInputCount = ordered.reduce((sum, record) => sum + record.inputPorts.filter(port => port.material === row.material).length, 0);
    const junctions = [];
    for (const record of materialOutputRecords) junctions.push({ x: outputColumnByBlock.get(record.id), kind: 'merge', blockId: record.id });
    for (const junction of inputJunctionsByMaterial.get(row.material) || []) junctions.push(junction);
    let rowStartX = busStartX;
    let rowEndX = busEndX;
    if (trimBusRanges && junctions.length) {
      // Leave one bus cell before a fanout splitter and two cells after a
      // merge splitter.  The extra margin keeps the splitter body and its
      // directed terminal belt inside the row even when a row has only one
      // junction.  Raw/output edge anchors can extend this local interval.
      rowStartX = Math.max(busStartX, Math.min(...junctions.map(junction => junction.x - 2)));
      rowEndX = Math.min(busEndX, Math.max(...junctions.map(junction => junction.x + 3)));
      const externalRange = requestedExternalRange(row.material);
      if (externalRange) {
        if (externalRange.startX !== undefined) rowStartX = Math.min(rowStartX, integer(externalRange.startX, `${row.material}.externalBusRanges.startX`));
        if (externalRange.endX !== undefined) rowEndX = Math.max(rowEndX, integer(externalRange.endX, `${row.material}.externalBusRanges.endX`));
      }
      rowStartX = Math.max(busStartX, rowStartX);
      rowEndX = Math.min(busEndX, rowEndX);
    }
    if (rowEndX <= rowStartX) fail(`${row.material} bus range is empty (${rowStartX}..${rowEndX})`);
    rangePlans.push({ material: row.material, startX: rowStartX, endX: rowEndX, junctions: junctions.map(junction => ({ ...junction })) });
    const reserved = new Set(junctions.flatMap(junction => junction.kind === 'fanout'
      ? [junction.x - 1]
      : outputMergeSplitters ? [junction.x + 1] : []).map(x => key(x, row.y)));
    const busEntities = [];
    for (let x = rowStartX; x <= rowEndX; x++) {
      if (reserved.has(key(x, row.y))) continue;
      busEntities.push(addBelt(state, { x, y: row.y }, EAST, { material: row.material, role: 'main-bus', bus: row.material }));
    }
    for (const junction of junctions) {
      if (junction.kind === 'fanout' || outputMergeSplitters) {
        const splitterGrid = junction.kind === 'fanout' ? { x: junction.x - 1, y: row.y - 1 } : { x: junction.x + 1, y: row.y };
        const splitterDirection = EAST;
        const splitter = addSplitter(state, splitterGrid, splitterDirection, { material: row.material, role: junction.kind, bus: row.material });
        junction.splitterEntity = splitter.entity_number;
        busEntities.push(splitter);
      }
    }
    state.buses.push({ material: row.material, y: row.y, startX: rowStartX, endX: rowEndX, junctions, entities: busEntities.map(entity => entity.entity_number) });
  }
  state.verticalColumns = new Set([
    ...outputColumnByBlock.values(),
    ...[...inputJunctionsByMaterial.values()].flat().map(junction => junction.x),
    // A tighter block pitch can put a branch neck beside a neighboring
    // compact block's vertical input/collector belt.  Treat those existing
    // vertical belts as crossing columns so the branch uses a fast
    // underground pair instead of silently crossing the block belt.
    ...state.blocks.flatMap(record => (record.block.belts || [])
      .filter(belt => belt.direction === NORTH || belt.direction === SOUTH)
      .map(belt => belt.grid.x + record.placement.x))
  ]);
  const busIndex = new Map(state.buses.map(bus => [bus.material, bus]));
  const mergeCursor = new Map(state.buses.map(bus => [bus.material, 0]));
  const inputCursor = new Map(state.buses.map(bus => [bus.material, 0]));
  for (let i = 0; i < outputRecords.length; i++) {
    const record = outputRecords[i];
    const outputBus = busIndex.get(record.outputPort.material);
    if (!outputBus) fail(`${record.id} output ${record.outputPort.material} has no bus row`);
    const outputIndex = mergeCursor.get(outputBus.material);
    const outputJunction = outputBus.junctions.filter(junction => junction.kind === 'merge')[outputIndex];
    mergeCursor.set(outputBus.material, outputIndex + 1);
    routeOutput(state, record, { ...outputBus, x: outputJunction.x, bus: outputBus, mergeSplitterEntity: outputJunction.splitterEntity }, i, allRowYs, { branchGap, outputBranchStart: outputStart, clearY: maxBlockBottom + 2 });
    for (const port of record.inputPorts || []) {
      const inputBus = busIndex.get(port.material);
      if (!inputBus) fail(`${record.id} input ${port.material} has no bus row`);
      const inputIndex = inputCursor.get(inputBus.material);
      const inputJunction = inputBus.junctions.filter(junction => junction.kind === 'fanout')[inputIndex];
      if (!inputJunction) fail(`no fanout junction left for ${port.material}`);
      inputCursor.set(inputBus.material, inputIndex + 1);
      routeInput(state, record, { ...port, branchColumn: inputBranchColumn(record, port) }, { ...inputBus, tapX: inputJunction.x, tapSplitterEntity: inputJunction.splitterEntity }, inputIndex, allRowYs, { branchGap, inputBranchStart: inputStart });
    }
  }
  for (const record of externalInputRecords) {
    const port = record.inputPort;
    const inputBus = busIndex.get(port.material);
    if (!inputBus) fail(`${record.id} input ${port.material} has no bus row`);
    const inputIndex = inputCursor.get(inputBus.material);
    const inputJunction = inputBus.junctions.filter(junction => junction.kind === 'fanout')[inputIndex];
    if (!inputJunction) fail(`no fanout junction left for ${port.material}`);
    inputCursor.set(inputBus.material, inputIndex + 1);
    routeInput(state, record, { ...port }, { ...inputBus, tapX: inputJunction.x, tapSplitterEntity: inputJunction.splitterEntity }, inputIndex, allRowYs, { branchGap, inputBranchStart: inputStart });
  }
  const claimedCoordinates = [...state.claimed.keys()].map(cell => cell.split(',').map(Number));
  const afterDimensions = {
    left: Math.min(...claimedCoordinates.map(([x]) => x)),
    right: Math.max(...claimedCoordinates.map(([x]) => x)),
    top: Math.min(...claimedCoordinates.map(([, y]) => y)),
    bottom: Math.max(...claimedCoordinates.map(([, y]) => y))
  };
  const busEntityIds = new Set(state.buses.flatMap(bus => bus.entities));
  const busEntities = state.entities.filter(entity => busEntityIds.has(entity.entity_number));
  const afterBusBelts = busEntities.filter(entity => entity.name === BELT).length;
  const afterBelts = state.entities.filter(entity => entity.name === BELT).length;
  let baselineBusBelts = 0;
  let baselineBusEntities = 0;
  let globalBusLeft = busStartX;
  let globalBusRight = busEndX;
  for (const plan of rangePlans) {
    const reserved = new Set(plan.junctions.flatMap(junction => junction.kind === 'fanout'
      ? [key(junction.x - 1, 0)]
      : outputMergeSplitters ? [key(junction.x + 1, 0)] : []));
    const reservedInGlobal = [...reserved].filter(cell => {
      const [x] = cell.split(',').map(Number);
      return x >= busStartX && x <= busEndX;
    }).length;
    baselineBusBelts += busEndX - busStartX + 1 - reservedInGlobal;
    for (const junction of plan.junctions) {
      const left = junction.kind === 'fanout' ? junction.x - 1 : outputMergeSplitters ? junction.x + 1 : junction.x;
      const right = junction.kind === 'fanout' ? junction.x : outputMergeSplitters ? junction.x + 2 : junction.x;
      globalBusLeft = Math.min(globalBusLeft, left);
      globalBusRight = Math.max(globalBusRight, right);
    }
  }
  // One ordinary belt occupies each non-reserved global row cell, plus one
  // splitter per junction.  Keep this explicit so the report is inspectable
  // in fixture JSON.
  baselineBusEntities = baselineBusBelts + rangePlans.reduce((sum, plan) => sum + plan.junctions.filter(junction => junction.kind === 'fanout' || outputMergeSplitters).length, 0);
  const nonBusEntities = state.entities.length - busEntities.length;
  const nonBusBelts = afterBelts - afterBusBelts;
  const beforeDimensions = {
    left: Math.min(afterDimensions.left, globalBusLeft),
    right: Math.max(afterDimensions.right, globalBusRight),
    top: afterDimensions.top,
    bottom: afterDimensions.bottom
  };
  const area = dimensions => (dimensions.right - dimensions.left + 1) * (dimensions.bottom - dimensions.top + 1);
  const trimReport = {
    enabled: trimBusRanges,
    ranges: rangePlans.map(plan => ({ material: plan.material, startX: plan.startX, endX: plan.endX, junctions: plan.junctions })),
    before: {
      entities: nonBusEntities + baselineBusEntities,
      belts: nonBusBelts + baselineBusBelts,
      dimensions: beforeDimensions,
      area: area(beforeDimensions)
    },
    after: {
      entities: state.entities.length,
      belts: afterBelts,
      dimensions: afterDimensions,
      area: area(afterDimensions)
    },
    saved: {
      entities: nonBusEntities + baselineBusEntities - state.entities.length,
      belts: nonBusBelts + baselineBusBelts - afterBelts,
      area: area(beforeDimensions) - area(afterDimensions)
    },
    reachability: null
  };
  const audit = auditDeterministicBus({ schemaVersion: 1, entities: state.entities, routes: state.routes, tunnels: state.tunnels, buses: state.buses, claimedCells: state.claimed.size });
  trimReport.reachability = audit.reachability;
  return {
    schemaVersion: 1,
    entities: state.entities,
    blocks: state.blocks.map(record => ({ id: record.id, placement: record.placement, inputPorts: record.inputPorts, outputPort: record.outputPort })),
    buses: state.buses,
    routes: state.routes,
    tunnels: state.tunnels,
    ports: state.blocks.flatMap(record => record.inputPorts.map(port => ({ ...port, externalSide: 'west' }))).concat(state.blocks.map(record => ({ ...record.outputPort, externalSide: 'east' }))).concat(externalInputRecords.map(record => ({ ...record.inputPort, externalSide: 'west' }))).concat(externalOutputRecords.map(record => ({ ...record.outputPort, externalSide: 'east' }))),
    dimensions: afterDimensions,
    trimReport,
    audit
  };
}

export const deterministicBusConstants = Object.freeze({ EAST, NORTH, SOUTH, WEST, BELT, UNDERGROUND, SPLITTER, GRID_DIRECTIONS });
