/**
 * Small, deterministic recipe blocks for the combined science factory.
 *
 * This file intentionally has no dependency on the science router.  It emits
 * a local geometry/template and explicit connection metadata; a later router
 * can consume the empty route targets and the producer port.  Coordinates in
 * the `grid` fields are tile coordinates.  A one-tile entity is emitted at
 * `{x: gridX + .5, y: gridY + .5}`.  Machine centres remain the blueprint
 * coordinates requested by the layout design (AM2/electric furnace at x=.5,
 * steel furnace at x=0).
 */

const DIRECTIONS = Object.freeze({ north: 0, east: 4, south: 8, west: 12 });
const DIR_VECTOR = Object.freeze({
  0: [0, -1],
  4: [1, 0],
  8: [0, 1],
  12: [-1, 0]
});
const BELT = 'fast-transport-belt';
const UNDERGROUND = 'fast-underground-belt';
const INSERTER = 'fast-inserter';
const RED_LANE_ITEMS_PER_SECOND = 15;
const FAST_INSERTER_ITEMS_PER_SECOND = 2.3;
const MAX_ROWS = 9;
const DEFAULT_SPEEDS = Object.freeze({
  'assembling-machine-2': 0.75,
  'electric-furnace': 2,
  'steel-furnace': 2
});

const round = (n, places = 6) => {
  const scale = 10 ** places;
  return Math.round(n * scale) / scale;
};
const cellKey = (x, y) => `${x},${y}`;
const clone = value => JSON.parse(JSON.stringify(value));

function fail(message) {
  throw new Error(`compact recipe block: ${message}`);
}

function itemIngredients(recipe) {
  if (!recipe || typeof recipe !== 'object') fail('recipe is required');
  const ingredients = (recipe.ingredients || []).map(i => ({
    id: i.id ?? i.name,
    type: i.type || 'item',
    amount: Number(i.amount),
    probability: i.probability ?? 1
  }));
  if (!ingredients.length) fail(`${recipe.id || recipe.name || '(unnamed)'} has no ingredients`);
  if (ingredients.some(i => !i.id || i.type !== 'item')) fail('only pure-item ingredients are supported');
  if (ingredients.some(i => !Number.isFinite(i.amount) || i.amount <= 0 || i.probability !== 1)) fail('ingredients must have deterministic positive amounts');
  const seen = new Set();
  for (const ingredient of ingredients) {
    if (seen.has(ingredient.id)) fail(`duplicate ingredient ${ingredient.id} is ambiguous for lane assignment`);
    seen.add(ingredient.id);
  }
  return ingredients;
}

function itemResults(recipe) {
  const results = (recipe.results || []).map(i => ({
    id: i.id ?? i.name,
    type: i.type || 'item',
    amount: Number(i.amount),
    probability: i.probability ?? 1
  }));
  if (results.length !== 1 || results.some(i => !i.id || i.type !== 'item' || !Number.isFinite(i.amount) || i.amount <= 0 || i.probability !== 1)) {
    fail('exactly one deterministic item result is required');
  }
  return results[0];
}

function machineGeometry(machine) {
  if (machine === 'assembling-machine-2' || machine === 'electric-furnace') {
    return { kind: machine === 'electric-furnace' ? 'electric-furnace' : 'assembling-machine', width: 3, height: 3 };
  }
  if (machine === 'steel-furnace') return { kind: 'steel-furnace', width: 2, height: 2 };
  fail(`unsupported machine ${machine}; use assembling-machine-2, electric-furnace, or steel-furnace`);
}

function normalizeRecipe(recipe) {
  if (!recipe || !(recipe.id ?? recipe.name)) fail('recipe id is required');
  const ingredients = itemIngredients(recipe);
  const result = itemResults(recipe);
  const time = Number(recipe.time ?? recipe.energy_required);
  if (!Number.isFinite(time) || time <= 0) fail('recipe time must be positive seconds');
  return { id: recipe.id ?? recipe.name, category: recipe.category || 'crafting', time, ingredients, result };
}

function machineRate(recipe, machine, speed) {
  const craftsPerSecond = speed / recipe.time;
  const inputs = Object.fromEntries(recipe.ingredients.map(i => [i.id, round(i.amount * craftsPerSecond)]));
  return {
    craftsPerSecond: round(craftsPerSecond),
    outputPerSecond: round(recipe.result.amount * craftsPerSecond),
    inputs
  };
}

function scaleRate(rate, utilization) {
  return {
    craftsPerSecond: round(rate.craftsPerSecond * utilization),
    outputPerSecond: round(rate.outputPerSecond * utilization),
    inputs: Object.fromEntries(Object.entries(rate.inputs).map(([id, value]) => [id, round(value * utilization)]))
  };
}

function armCount(rate, { smelting = false } = {}) {
  if (smelting) return 1;
  return Math.max(1, Math.ceil((rate - 1e-9) / FAST_INSERTER_ITEMS_PER_SECOND));
}

function centreFor(machine, row) {
  return machine === 'steel-furnace' ? { x: 0, y: row } : { x: 0.5, y: row + 0.5 };
}

function bodyCells(machine, row) {
  if (machine === 'steel-furnace') return [-1, 0].flatMap(x => [-1, 0].map(y => ({ x, y: row + y })));
  return [-1, 0, 1].flatMap(x => [-1, 0, 1].map(y => ({ x, y: row + y })));
}

function entityPosition(gridX, gridY) {
  return { x: gridX + 0.5, y: gridY + 0.5 };
}

function laneName(index) {
  return index === 0 ? 'near' : index === 1 ? 'far' : `lane-${index}`;
}

function beltDescriptor({ id, gridX, gridY, direction, materials, laneMaterials, role, row, laneRate = {} }) {
  return {
    id,
    role,
    row,
    grid: { x: gridX, y: gridY },
    position: entityPosition(gridX, gridY),
    direction,
    materials: [...materials],
    laneMaterials: { ...laneMaterials },
    laneRate: { ...laneRate },
    entityName: BELT
  };
}

function addEntity(state, name, position, props = {}) {
  const entity = { entity_number: state.nextId++, name, position: { ...position }, ...props };
  state.entities.push(entity);
  return entity;
}

function addCell(state, cell, owner) {
  const key = cellKey(cell.x, cell.y);
  if (state.cells.has(key)) fail(`geometry overlap at ${key} (${owner} and ${state.cells.get(key)})`);
  state.cells.set(key, owner);
}

function rateOf(result, machine, speed, recipe) {
  return machineRate(recipe, machine, speed);
}

function assignIngredients(recipe, machine, rate) {
  const smelting = machine === 'steel-furnace' || machine === 'electric-furnace';
  if (smelting && recipe.ingredients.length > 2) fail('a smelting block accepts ore plus optional solid-fuel only');
  if (machine === 'electric-furnace' && recipe.ingredients.length !== 1) fail('an electric-furnace block accepts one ore/stone ingredient and no fuel lane');
  if (!smelting && recipe.ingredients.length > 3) fail('an assembling block accepts at most three solid ingredients');
  const inputs = recipe.ingredients.map((ingredient, index) => ({
    material: ingredient.id,
    amountPerCraft: ingredient.amount,
    perMachineRate: rate.inputs[ingredient.id],
    smelting,
    armCount: armCount(rate.inputs[ingredient.id], { smelting }),
    index,
    side: 'west',
    lane: null,
    beltId: null,
    slot: null
  }));
  if (smelting) {
    if (machine === 'steel-furnace') {
      const ore = inputs[0];
      // Steel furnaces require fuel even when the production recipe itself
      // only declares ore.  Keep fuel as an explicit zero-rate lane in this
      // layout contract; the native furnace consumes the supplied solid
      // fuel, while recipe accounting remains ore-only.
      if (inputs.length === 1) {
        inputs.push({
          material: 'solid-fuel',
          amountPerCraft: 0,
          perMachineRate: 0,
          smelting: true,
          armCount: 0,
          index: 1,
          side: 'west',
          lane: 1,
          beltId: 'west-shared-0',
          slot: 0,
          dualLane: true,
          implicitFuel: true
        });
      }
      ore.dualLane = true;
      ore.lane = 0;
      ore.beltId = 'west-shared-0';
      ore.slot = 0;
      if (inputs[1]) {
        inputs[1].material = inputs[1].material || 'solid-fuel';
        if (inputs[1].material !== 'solid-fuel') fail('steel furnace fuel lane must use solid-fuel');
        inputs[1].lane = 1;
        inputs[1].beltId = 'west-shared-0';
        inputs[1].slot = 0;
        inputs[1].dualLane = true;
        inputs[1].implicitFuel = inputs[1].material === 'solid-fuel';
      }
      // The steel furnace deliberately has one physical arm.  The two-lane
      // bus feeds the same pickup point; a native furnace test must confirm
      // its actual fuel/ore pickup order.
      inputs.forEach(input => { input.armCount = 1; input.side = 'west'; });
    } else {
      inputs[0].lane = 0;
      inputs[0].beltId = 'west-shared-0';
      inputs[0].slot = 0;
    }
    return inputs;
  }
  const west = inputs.slice(0, Math.min(2, inputs.length));
  west.forEach((input, index) => {
    input.lane = index;
    input.beltId = 'west-shared-0';
    input.slot = index;
    input.side = 'west';
  });
  if (inputs[2]) {
    inputs[2].side = 'east';
    inputs[2].lane = 0;
    inputs[2].beltId = 'east-c';
    inputs[2].slot = 0;
  }
  const totalWestArms = west.reduce((sum, input) => sum + input.armCount, 0);
  if (totalWestArms > 3) fail(`west input arms require ${totalWestArms}; the compact block caps them at three`);
  return inputs;
}

function rateByLane(recipe, machine, rows, speed, assignments) {
  const rate = machineRate(recipe, machine, speed);
  const laneRate = {};
  for (const input of assignments) {
    const key = `${input.beltId}:${input.lane}`;
    laneRate[key] = round((laneRate[key] || 0) + input.perMachineRate * rows);
  }
  const outputRate = round(rate.outputPerSecond * rows);
  return { rate, laneRate, outputRate };
}

function addMachineRow(state, { machine, recipe, rate, row, assignments, outputArms, blockId }) {
  const centre = centreFor(machine, row);
  const geometry = machineGeometry(machine);
  const machineEntity = addEntity(state, machine, centre, {
    recipe: recipe.id,
    tags: { compact_block: blockId, production_recipe: recipe.id, row }
  });
  for (const cell of bodyCells(machine, row)) addCell(state, cell, `machine:${machineEntity.entity_number}`);

  const inputArms = [];
  const sideArmOffsets = { west: 0, east: 0 };
  for (const input of assignments) {
    // A steel furnace exposes one physical west inserter.  Its pickup is
    // backed by the two lane ore/fuel bus; retain both lanes in metadata but
    // do not place a second inserter on the same tile.
    if (machine === 'steel-furnace' && input.implicitFuel) continue;
    const slots = input.armCount;
    for (let arm = 0; arm < slots; arm++) {
      let gridX, gridY, direction;
      if (input.side === 'west') {
        gridX = -2;
        // Allocate all west arms from the three machine-edge tiles in order;
        // using the ingredient slot as an offset would overlap when the first
        // ingredient needs two arms.
        gridY = row - 1 + sideArmOffsets.west++;
        direction = DIRECTIONS.west;
      } else {
        gridX = 2;
        gridY = row - 1 + sideArmOffsets.east++;
        direction = DIRECTIONS.east;
      }
      const inserter = addEntity(state, INSERTER, entityPosition(gridX, gridY), {
        direction,
        tags: {
          compact_block: blockId,
          role: 'input',
          material: input.material,
          lane: input.lane,
          belt_id: input.beltId,
          row
        }
      });
      const [dx, dy] = DIR_VECTOR[direction];
      inputArms.push({
        entity: inserter.entity_number,
        material: input.material,
        materials: machine === 'steel-furnace'
          ? assignments.map(assignment => assignment.material)
          : [input.material],
        side: input.side,
        lane: input.lane,
        beltId: input.beltId,
        row,
        grid: { x: gridX, y: gridY },
        pickup: { x: gridX + dx, y: gridY + dy },
        drop: { x: gridX - dx, y: gridY - dy },
        rate: input.perMachineRate / slots,
        dualLane: machine === 'steel-furnace'
      });
    }
  }

  const output = recipe.result;
  const outputGridY = row - 2;
  const outputXs = machine === 'steel-furnace' ? [0] : [-1, 0, 1];
  const outputArmsMeta = [];
  for (let arm = 0; arm < outputArms; arm++) {
    const gridX = outputXs[arm % outputXs.length];
    const gridY = outputGridY;
    const inserter = addEntity(state, INSERTER, entityPosition(gridX, gridY), {
      direction: DIRECTIONS.south,
      tags: {
        compact_block: blockId,
        role: 'output',
        material: output.id,
        row,
        arm
      }
    });
    const [dx, dy] = DIR_VECTOR[DIRECTIONS.south];
    outputArmsMeta.push({
      entity: inserter.entity_number,
      material: output.id,
      row,
      grid: { x: gridX, y: gridY },
      pickup: { x: gridX + dx, y: gridY + dy },
      drop: { x: gridX - dx, y: gridY - dy },
      rate: rate.outputPerSecond / outputArms
    });
  }
  return { machine: machineEntity.entity_number, centre, geometry, inputArms, outputArms: outputArmsMeta, outputGridY };
}

function addBeltEntity(state, descriptor, { type = BELT, direction = descriptor.direction, tags = {} } = {}) {
  const entity = addEntity(state, type, descriptor.position, {
    direction,
    ...(type === UNDERGROUND ? { type: tags.type } : {}),
    tags: { compact_block: state.blockId, ...tags }
  });
  addCell(state, descriptor.grid, `belt:${descriptor.id}`);
  descriptor.entity = entity.entity_number;
  return entity;
}

function addVerticalBelt(state, { id, gridX, gridY, materials, laneMaterials, role, row, laneRate, direction = DIRECTIONS.south }) {
  const descriptor = beltDescriptor({ id, gridX, gridY, direction, materials, laneMaterials, role, row, laneRate });
  state.belts.push(descriptor);
  addBeltEntity(state, descriptor, { direction, tags: { role, materials, lane_materials: laneMaterials } });
  return descriptor;
}

function inputBus(state, { id, gridX, top, bottom, materials, laneRates, role }) {
  const laneMaterials = Object.fromEntries(materials.map((material, lane) => [laneName(lane), material]));
  const laneRate = Object.fromEntries(materials.map((material, lane) => [laneName(lane), laneRates[material] ?? 0]));
  const cells = [];
  for (let gridY = top; gridY <= bottom; gridY++) {
    const descriptor = addVerticalBelt(state, {
      id: `${id}-${gridY}`,
      gridX,
      gridY,
      materials,
      laneMaterials,
      role,
      row: null,
      laneRate,
      direction: DIRECTIONS.south
    });
    cells.push(descriptor);
  }
  return { id, gridX, top, bottom, materials, laneMaterials, cells, laneRates, role };
}

function outputPath(state, { row, hasC, collectorX, blockId, result }) {
  // Output arms sit at row - 2 and point south.  Their drop tile is row - 3,
  // so the head belt must occupy that tile to keep the machine body clear.
  const gridY = row - 3;
  const horizontal = [];
  const end = hasC ? 1 : 2;
  for (let gridX = -2; gridX <= end; gridX++) {
    if (hasC && gridX === 2) continue;
    const id = `output-${row}-${gridX}`;
    const descriptor = beltDescriptor({
      id,
      gridX,
      gridY,
      direction: DIRECTIONS.east,
      materials: [result.id],
      laneMaterials: { near: result.id },
      role: 'output-head',
      row,
      laneRate: { near: result.rate }
    });
    state.belts.push(descriptor);
    addBeltEntity(state, descriptor, { direction: DIRECTIONS.east, tags: { role: 'output-head', material: result.id, row } });
    horizontal.push(descriptor);
  }
  let tunnel = null;
  let sideLoad = { from: { x: end, y: gridY }, to: { x: collectorX, y: gridY }, direction: DIRECTIONS.east };
  if (hasC) {
    const tag = `${blockId}-output-${row}`;
    const input = beltDescriptor({ id: `output-ug-in-${row}`, gridX: 2, gridY, direction: DIRECTIONS.east, materials: [result.id], laneMaterials: { near: result.id }, role: 'output-underground-input', row, laneRate: { near: result.rate } });
    const output = beltDescriptor({ id: `output-ug-out-${row}`, gridX: 5, gridY, direction: DIRECTIONS.east, materials: [result.id], laneMaterials: { near: result.id }, role: 'output-underground-output', row, laneRate: { near: result.rate } });
    state.belts.push(input, output);
    addBeltEntity(state, input, { type: UNDERGROUND, direction: DIRECTIONS.east, tags: { type: 'input', role: input.role, material: result.id, tunnel: tag, row } });
    addBeltEntity(state, output, { type: UNDERGROUND, direction: DIRECTIONS.east, tags: { type: 'output', role: output.role, material: result.id, tunnel: tag, row } });
    tunnel = { input, output, tag, reach: 7 };
    sideLoad = { from: { x: 5, y: gridY }, to: { x: collectorX, y: gridY }, direction: DIRECTIONS.east };
  }
  return { row, gridY, horizontal, tunnel, sideLoad, collectorX, result: result.id };
}

function cellsForBeltRange(start, end) {
  const out = [];
  for (let y = start; y <= end; y++) out.push(y);
  return out;
}

/**
 * Build one compact, identical-recipe block.
 *
 * `rows` is capped at eight and is additionally capped by the 15 items/s
 * single-red-lane budget.  Pass `machines` to request an exact row count; an
 * over-capacity request throws instead of silently producing an underfed
 * block.  `machine` is one of AM2, electric-furnace, or steel-furnace.
 */
export function makeCompactRecipeBlock({
  id,
  recipe,
  machine = 'assembling-machine-2',
  machines = 1,
  speed = DEFAULT_SPEEDS[machine],
  utilization = 1,
  beltCapacity = RED_LANE_ITEMS_PER_SECOND,
  inserterCapacity = FAST_INSERTER_ITEMS_PER_SECOND,
  pitch = 6,
  maxRows = MAX_ROWS
} = {}) {
  if (!id || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) fail('id must be a stable slug');
  if (!Number.isInteger(machines) || machines < 1) fail('machines must be a positive integer');
  if (!Number.isFinite(speed) || speed <= 0) fail('speed must be positive');
  if (!Number.isFinite(utilization) || utilization <= 0 || utilization > 1) fail('utilization must be greater than zero and at most one');
  if (!Number.isFinite(beltCapacity) || beltCapacity <= 0) fail('belt capacity must be positive');
  if (beltCapacity > RED_LANE_ITEMS_PER_SECOND) fail(`belt capacity cannot exceed ${RED_LANE_ITEMS_PER_SECOND} items/s`);
  if (!Number.isFinite(inserterCapacity) || inserterCapacity <= 0) fail('inserter capacity must be positive');
  const minimumPitch = machine === 'steel-furnace' ? 4 : 5;
  if (!Number.isInteger(pitch) || pitch < minimumPitch) fail(`${machine} pitch must be at least ${minimumPitch}; tighter spacing needs a new geometry proof`);
  const normalized = normalizeRecipe(recipe);
  const geometry = machineGeometry(machine);
  const smelting = machine === 'steel-furnace' || machine === 'electric-furnace';
  const capacityRate = machineRate(normalized, machine, speed);
  const perMachine = scaleRate(capacityRate, utilization);
  const maxByLane = Math.min(...normalized.ingredients.map(i => Math.floor((beltCapacity + 1e-9) / perMachine.inputs[i.id])));
  const maxByOutput = Math.floor((beltCapacity + 1e-9) / perMachine.outputPerSecond);
  const allowedRows = Math.max(0, Math.min(MAX_ROWS, maxRows, maxByLane, maxByOutput));
  if (machines > allowedRows) fail(`${normalized.id} at ${machines} machines needs a lane above ${beltCapacity}/s; maximum is ${allowedRows}`);

  const assignments = assignIngredients(normalized, machine, perMachine);
  // Honour a caller's custom inserter capacity in the emitted arm plan.
  for (const input of assignments) input.armCount = input.implicitFuel ? 0 : smelting ? 1 : Math.max(1, Math.ceil((input.perMachineRate - 1e-9) / inserterCapacity));
  const totalWestArms = assignments.filter(i => i.side === 'west' && !i.implicitFuel).reduce((sum, i) => sum + i.armCount, 0);
  if (!smelting && totalWestArms > 3) fail(`west input arms require ${totalWestArms}; the compact block caps them at three`);
  const totalEastArms = assignments.filter(i => i.side === 'east' && !i.implicitFuel).reduce((sum, i) => sum + i.armCount, 0);
  if (!smelting && totalEastArms > 3) fail(`east input arms require ${totalEastArms}; the compact block caps them at three`);
  const outputArms = smelting ? 1 : Math.max(1, Math.ceil((perMachine.outputPerSecond - 1e-9) / inserterCapacity));
  if (outputArms > 3) fail(`output requires ${outputArms} arms; the compact row has three north slots`);

  const state = { nextId: 1, blockId: id, entities: [], belts: [], cells: new Map() };
  const rows = [];
  const inputRows = machines * pitch;
  const top = -3;
  const bottom = (machines - 1) * pitch + 2;
  const westMaterials = assignments.filter(i => i.side === 'west').map(i => i.material);
  const eastAssignment = assignments.find(i => i.side === 'east');
  const westBus = inputBus(state, {
    id: 'west-shared-0',
    gridX: -3,
    top,
    bottom,
    materials: westMaterials,
    laneRates: Object.fromEntries(assignments.filter(i => i.side === 'west').map(i => [i.material, round(i.perMachineRate * machines)])),
    role: 'input-shared'
  });
  const westLaneRate = Object.fromEntries(westMaterials.map((material, lane) => [laneName(lane), round((assignments.find(input => input.material === material)?.perMachineRate || 0) * machines)]));
  const westNeck = beltDescriptor({
    id: 'west-input-neck',
    gridX: -3,
    gridY: top - 1,
    direction: DIRECTIONS.south,
    materials: westMaterials,
    laneMaterials: Object.fromEntries(westMaterials.map((material, lane) => [laneName(lane), material])),
    role: 'input-neck',
    row: null,
    laneRate: westLaneRate
  });
  state.belts.push(westNeck);
  addBeltEntity(state, westNeck, { direction: DIRECTIONS.south, tags: { role: 'input-neck', materials: westMaterials, lane_materials: westNeck.laneMaterials } });
  const eastBus = eastAssignment ? inputBus(state, {
    id: 'east-c',
    gridX: 3,
    top,
    bottom,
    materials: [eastAssignment.material],
    laneRates: { [eastAssignment.material]: round(eastAssignment.perMachineRate * machines) },
    role: 'input-c'
  }) : null;

  // A vertical collector is deliberately one material and one lane.  The
  // horizontal row may side-load into it, but no two materials share a lane.
  const collectorX = eastAssignment ? 6 : 3;
  const outputRows = Array.from({ length: machines }, (_, index) => index * pitch);
  const outputGridRows = outputRows.map(row => row - 3);
  const collectorTop = Math.min(...outputGridRows);
  const collectorBottom = Math.max(...outputGridRows) + 1;
  const collectorCells = [];
  for (const gridY of cellsForBeltRange(collectorTop, collectorBottom)) {
    const direction = gridY === collectorBottom ? DIRECTIONS.east : DIRECTIONS.south;
    const descriptor = beltDescriptor({ id: `collector-${gridY}`, gridX: collectorX, gridY, direction, materials: [normalized.result.id], laneMaterials: { near: normalized.result.id }, role: 'output-collector', row: null, laneRate: { near: perMachine.outputPerSecond * machines } });
    state.belts.push(descriptor);
    addBeltEntity(state, descriptor, { direction, tags: { role: 'output-collector', material: normalized.result.id, lane_rate: round(perMachine.outputPerSecond * machines) } });
    collectorCells.push(descriptor);
  }

  for (let index = 0; index < machines; index++) {
    const row = index * pitch;
    const rowAssignments = assignments.map(input => ({ ...input }));
    const rowInfo = addMachineRow(state, { machine, recipe: normalized, rate: perMachine, row, assignments: rowAssignments, outputArms, blockId: id });
    const path = outputPath(state, { row, hasC: Boolean(eastAssignment), collectorX, blockId: id, result: { ...normalized.result, rate: perMachine.outputPerSecond } });
    rows.push({ index, row, machine: rowInfo, output: path });
  }

  const inputs = assignments.map(input => ({
    material: input.material,
    side: input.side,
    beltId: input.beltId,
    lane: input.lane,
    laneName: laneName(input.lane),
    routeTarget: input.side === 'west'
      ? {
        grid: { x: input.lane === 0 ? -4 : -2, y: top - 1 },
        material: input.material,
        lane: input.lane,
        empty: true,
        direction: input.lane === 0 ? DIRECTIONS.east : DIRECTIONS.west,
        sideLoad: { grid: { x: -3, y: top - 1 }, direction: input.lane === 0 ? DIRECTIONS.east : DIRECTIONS.west, beltId: westNeck.id }
        }
      : {
          grid: { x: 3, y: top - 1 },
          material: input.material,
          lane: input.lane,
          empty: true,
          direction: DIRECTIONS.south
        },
    perMachineRate: input.perMachineRate,
    totalRate: round(input.perMachineRate * machines),
    armCountPerMachine: input.implicitFuel ? 0 : input.armCount,
    sharedPhysicalArm: Boolean(input.implicitFuel),
    dualLane: Boolean(input.dualLane)
  }));
  const outputs = {
    material: normalized.result.id,
    totalRate: round(perMachine.outputPerSecond * machines),
    collector: {
      gridX: collectorX,
      top: collectorTop,
      bottom: collectorBottom,
      material: normalized.result.id,
      lane: 'near'
    },
    producerPort: {
      grid: { x: collectorX + 1, y: collectorBottom },
      material: normalized.result.id,
      rate: round(perMachine.outputPerSecond * machines),
      empty: true,
      direction: DIRECTIONS.east
    }
  };
  const stateBounds = [...state.cells.keys()].map(k => k.split(',').map(Number));
  const left = Math.min(...stateBounds.map(([x]) => x));
  const right = Math.max(...stateBounds.map(([x]) => x));
  const topCell = Math.min(...stateBounds.map(([, y]) => y));
  const bottomCell = Math.max(...stateBounds.map(([, y]) => y));
  const block = {
    schemaVersion: 1,
    id,
    recipe: clone(normalized),
    machine,
    machines,
    pitch,
    utilization,
    proof: { beltLaneCapacityPerSecond: beltCapacity, fastInserterCapacityPerSecond: inserterCapacity, maxRows: allowedRows, utilization },
    capacityRate,
    machineRate: perMachine,
    rows,
    entities: state.entities,
    belts: state.belts,
    inputs,
    outputs,
    footprint: { left, top: Math.min(topCell, top - 1), right, bottom: Math.max(bottomCell, outputs.producerPort.grid.y), width: right - left + 1, height: Math.max(bottomCell, outputs.producerPort.grid.y) - Math.min(topCell, top - 1) + 1 },
    constraints: {
      rawOnly: true,
      allowedMachines: ['assembling-machine-2', 'electric-furnace', 'steel-furnace'],
      forbidden: ['robots', 'modules', 'beacons', 'quality'],
      sharedLaneMaterials: westMaterials,
      noMixedFullBelts: true,
      routeTargetsAreEmpty: true,
      collectorProducerPort: 'east',
      portClearances: inputs.map(input => ({ material: input.material, routeTarget: input.routeTarget.grid, sideLoad: input.routeTarget.sideLoad?.grid || null }))
    }
  };
  checkCompactRecipeBlock(block);
  return block;
}

function entityAt(block, grid) {
  return block.entities.find(entity => Math.abs(entity.position.x - (grid.x + 0.5)) < 1e-9 && Math.abs(entity.position.y - (grid.y + 0.5)) < 1e-9);
}

/** Static geometry, lane, and connection checks. No Factorio simulation. */
export function checkCompactRecipeBlock(block) {
  if (!block || block.schemaVersion !== 1) fail('block schemaVersion must be 1');
  const ids = new Set();
  for (const entity of block.entities) {
    if (ids.has(entity.entity_number)) fail(`duplicate entity number ${entity.entity_number}`);
    ids.add(entity.entity_number);
    if (entity.name === 'transport-belt' || entity.name === 'underground-belt') fail('ordinary belts are not permitted');
    if (entity.name === INSERTER && entity.name !== INSERTER) fail('unexpected inserter');
  }
  const materialNames = new Set(block.recipe.ingredients.map(i => i.id).concat(block.recipe.result.id));
  if (block.machine === 'steel-furnace') materialNames.add('solid-fuel');
  for (const belt of block.belts) {
    if (![BELT, UNDERGROUND].includes(belt.entityName)) fail(`non-red belt ${belt.entityName}`);
    if (!belt.materials.length || belt.materials.some(material => !materialNames.has(material))) fail(`unknown belt material on ${belt.id}`);
    if (new Set(belt.materials).size !== belt.materials.length) fail(`duplicate lane material on ${belt.id}`);
    for (const material of belt.materials) {
      const lane = Object.entries(belt.laneMaterials).find(([, value]) => value === material)?.[0];
      if (!lane) fail(`material ${material} has no lane on ${belt.id}`);
      if ((belt.laneRate?.[lane] ?? 0) > RED_LANE_ITEMS_PER_SECOND + 1e-6) fail(`lane ${lane} on ${belt.id} exceeds 15 items/s`);
    }
    if (belt.entityName === UNDERGROUND && belt.role === 'output-underground-input') {
      const match = block.belts.find(other => other.role === 'output-underground-output' && other.row === belt.row);
      if (!match || match.direction !== belt.direction || Math.abs(match.grid.x - belt.grid.x) > 7) fail(`bad underground output pair for row ${belt.row}`);
    }
  }
  const occupied = new Map();
  const inserterCells = new Map();
  for (const belt of block.belts) {
    const key = cellKey(belt.grid.x, belt.grid.y);
    if (occupied.has(key)) fail(`belt overlap at ${key}`);
    occupied.set(key, `belt:${belt.id}`);
  }
  for (const row of block.rows) {
    for (const cell of bodyCells(block.machine, row.row)) {
      const key = cellKey(cell.x, cell.y);
      if (occupied.has(key)) fail(`machine/belt overlap at ${key}`);
      occupied.set(key, `machine:${row.index}`);
    }
    for (const arm of row.machine.inputArms) {
      const armKey = cellKey(arm.grid.x, arm.grid.y);
      if (occupied.has(armKey) || inserterCells.has(armKey)) fail(`input inserter overlap at ${armKey}`);
      inserterCells.set(armKey, `input:${row.index}`);
      const pickup = block.inputs.find(input => input.material === arm.material);
      if (!pickup) fail(`input arm references unknown ${arm.material}`);
      const armMaterials = arm.materials?.length ? arm.materials : [arm.material];
      const beltCell = cellKey(arm.pickup.x, arm.pickup.y);
      for (const material of armMaterials) {
        const belt = block.belts.find(candidate => candidate.grid && cellKey(candidate.grid.x, candidate.grid.y) === beltCell && candidate.materials.includes(material));
        // An outside lane-zero inserter deliberately picks the router-owned
        // vertical branch one tile beyond the compact block's local belt.
        // The full routed blueprint supplies that branch at every machine
        // row; the standalone block has no room to duplicate it locally.
        if (!belt) fail(`input ${material} row ${row.row} has no lane at ${beltCell}`);
      }
      if (arm.side === 'west' && arm.lane !== pickup.lane) fail(`west lane mismatch for ${arm.material}`);
      if (arm.side === 'east' && arm.lane !== 0) fail(`east lane mismatch for ${arm.material}`);
    }
    for (const arm of row.machine.outputArms) {
      const armKey = cellKey(arm.grid.x, arm.grid.y);
      if (occupied.has(armKey) || inserterCells.has(armKey)) fail(`output inserter overlap at ${armKey}`);
      inserterCells.set(armKey, `output:${row.index}`);
      const belt = block.belts.find(candidate => candidate.grid && cellKey(candidate.grid.x, candidate.grid.y) === cellKey(arm.drop.x, arm.drop.y) && candidate.materials.includes(arm.material));
      if (!belt) fail(`output row ${row.row} has no belt at ${cellKey(arm.drop.x, arm.drop.y)}`);
    }
    const path = row.output;
    if (path.sideLoad.to.x !== block.outputs.collector.gridX || path.sideLoad.to.y !== path.gridY) fail(`output row ${row.row} does not join collector`);
    if (path.tunnel && path.tunnel.input.grid.x !== 2) fail(`output row ${row.row} tunnel starts away from x=2`);
    if (path.tunnel && path.tunnel.output.grid.x !== 5) fail(`output row ${row.row} tunnel ends away from x=5`);
  }
  const routeCoordinates = new Set();
  for (const input of block.inputs) {
    const route = input.routeTarget.grid;
    const routeKey = cellKey(route.x, route.y);
    if (routeCoordinates.has(routeKey)) fail(`route targets are not unique at ${routeKey}`);
    routeCoordinates.add(routeKey);
    if (entityAt(block, route)) fail(`route target for ${input.material} is occupied`);
    if (input.side === 'west') {
      const sideLoad = input.routeTarget.sideLoad;
      if (!sideLoad || sideLoad.direction !== input.routeTarget.direction) fail(`west route for ${input.material} is missing its side-load direction`);
      const neck = block.belts.find(belt => belt.id === sideLoad.beltId && belt.role === 'input-neck' && belt.grid.x === sideLoad.grid.x && belt.grid.y === sideLoad.grid.y && belt.materials.includes(input.material));
      if (!neck) fail(`route target for ${input.material} has no owned side-load neck`);
    } else if (!block.belts.some(belt => belt.grid.x === route.x && belt.grid.y === route.y + 1 && belt.materials.includes(input.material))) {
      fail(`route target for ${input.material} is not before its belt`);
    }
  }
  if (entityAt(block, block.outputs.producerPort.grid)) fail('producer port is occupied');
  const collector = block.belts.filter(belt => belt.role === 'output-collector').sort((a, b) => a.grid.y - b.grid.y);
  if (!collector.length || collector.at(-1).direction !== DIRECTIONS.east) fail('collector must turn east at its final tile');
  if (collector.slice(0, -1).some(belt => belt.direction !== DIRECTIONS.south)) fail('collector must remain south-facing before its final tile');
  if (block.outputs.producerPort.grid.x !== collector.at(-1).grid.x + 1 || block.outputs.producerPort.grid.y !== collector.at(-1).grid.y || block.outputs.producerPort.direction !== DIRECTIONS.east) fail('producer port must be the east continuation of the final collector tile');
  const resultRate = block.outputs.totalRate;
  if (resultRate > RED_LANE_ITEMS_PER_SECOND + 1e-6) fail(`collector exceeds 15 items/s (${resultRate})`);
  const west = block.inputs.filter(input => input.side === 'west');
  if (west.length >= 2 && new Set(west.map(input => input.lane)).size !== west.length) fail('two west ingredients must use opposite lanes');
  if (block.constraints.noMixedFullBelts && west.length >= 2 && block.constraints.sharedLaneMaterials.length !== west.length) fail('shared belt lane material declaration is incomplete');
  if (block.machine === 'steel-furnace') {
    if (block.rows.some(row => row.machine.inputArms.length !== 1)) fail('steel furnace requires one west input arm');
    if (!block.inputs.some(input => input.material === 'solid-fuel' || input.dualLane)) fail('steel furnace must declare its dual ore/fuel lane');
    for (const row of block.rows) {
      const arm = row.machine.inputArms[0];
      if (arm.side !== 'west' || !arm.dualLane) fail('steel furnace dual lane must use its single west arm');
      for (const input of block.inputs.filter(input => input.side === 'west')) {
        if (!arm.materials?.includes(input.material)) fail(`steel dual arm omits ${input.material}`);
      }
    }
  }
  if (block.machine !== 'steel-furnace' && block.machine !== 'electric-furnace' && west.reduce((sum, input) => sum + input.armCountPerMachine, 0) > 3) fail('assembling block has more than three west arms');
  return { ok: true, entities: block.entities.length, belts: block.belts.length, footprint: block.footprint };
}

export const compactRecipeBlockConstants = Object.freeze({
  DIRECTIONS,
  RED_LANE_ITEMS_PER_SECOND,
  FAST_INSERTER_ITEMS_PER_SECOND,
  MAX_ROWS,
  DEFAULT_SPEEDS
});
