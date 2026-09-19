import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { encodeBlueprint, blueprintMaterials } from '../../blueprints.mjs';
import { addInputDisplays } from './port-displays.mjs';
import { makeCompactRecipeBlock } from './compact-recipe-blocks.mjs';
import { routeCompactBlocks } from './deterministic-main-bus.mjs';
import { compactStarterLayout, auditConnections } from './compact-shared-layout.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../../..');
const outputRootArg = process.env.SCIENCE_FACTORY_OUTPUT || path.join(repo, '.cache/science-factory/reproduce-electric-v3/generated');
const outputRoot = path.isAbsolute(outputRootArg) ? outputRootArg : path.resolve(repo, outputRootArg);
const raw = JSON.parse(await fs.readFile(process.env.FACTORIO_RAW || path.join(repo, '.cache/factorio-vanilla/script-output/data-raw-dump.json')));
const catalog = JSON.parse(await fs.readFile(path.join(repo, 'site/data/catalog.json')));
const products = ['automation-science-pack', 'logistic-science-pack', 'military-science-pack', 'chemical-science-pack'];
const rawInputs = ['iron-ore', 'copper-ore', 'coal', 'stone', 'water', 'crude-oil'];
const counts = {
  'advanced-oil-processing': 2, 'heavy-oil-cracking': 1, 'light-oil-cracking': 1,
  'iron-plate': 23, 'copper-plate': 9, 'steel-plate': 6, 'stone-brick': 5,
  'plastic-bar': 1, sulfur: 1, 'copper-cable': 4, 'iron-gear-wheel': 2,
  'electronic-circuit': 2, pipe: 1, 'firearm-magazine': 1,
  'piercing-rounds-magazine': 2, grenade: 4, 'stone-wall': 1, inserter: 1,
  'transport-belt': 1, 'engine-unit': 7, 'advanced-circuit': 7,
  'automation-science-pack': 4, 'logistic-science-pack': 5,
  'military-science-pack': 4, 'chemical-science-pack': 9
};
const recipe = id => raw.recipe[id] || (() => { throw new Error(`Missing recipe ${id}`); })();
const nodes = [];
for (const [id, count] of Object.entries(counts)) for (let i = 0; i < count; i++) {
  const r = recipe(id), result = r.results.find(v => v.type === 'item') || r.results.find(v => v.type === 'fluid');
  nodes.push({ item: result?.name || id, resultType: result?.type || 'item', recipe: r });
}

const closureCache = new Map();
function closure(id) {
  if (closureCache.has(id)) return closureCache.get(id);
  const result = new Set([id]); closureCache.set(id, result);
  for (const p of raw.technology[id]?.prerequisites || []) for (const t of closure(p)) result.add(t);
  return result;
}
const unlocks = new Map();
for (const [id, tech] of Object.entries(raw.technology || {})) for (const effect of tech.effects || []) if (effect.type === 'unlock-recipe') {
  const list = unlocks.get(effect.recipe) || []; list.push(id); unlocks.set(effect.recipe, list);
}
const required = new Set(['automation-2', 'advanced-material-processing-2', 'electric-energy-distribution-1', 'fast-inserter', 'logistics-2', 'circuit-network']);
for (const id of Object.keys(counts)) {
  const options = unlocks.get(id) || [];
  if (options.length) required.add([...options].sort((a, b) => closure(a).size - closure(b).size || a.localeCompare(b))[0]);
}
for (const id of ['fast-transport-belt', 'fast-underground-belt', 'fast-splitter', 'big-electric-pole', 'medium-electric-pole', 'display-panel', 'electric-furnace']) {
  const options = unlocks.get(id) || [];
  if (options.length) required.add([...options].sort((a, b) => closure(a).size - closure(b).size || a.localeCompare(b))[0]);
}
const researchClosure = [...new Set([...required].flatMap(id => [...closure(id)]))].sort();

const groups = new Map();
for (const [index, node] of nodes.entries()) {
  const group = groups.get(node.recipe.name) || { recipe: node.recipe, indices: [] };
  group.indices.push(index); groups.set(node.recipe.name, group);
}
const blockSpecs = [], blockNodeIndices = new Set();
for (const group of groups.values()) {
  const ingredients = Object.values(group.recipe.ingredients || {});
  const results = Object.values(group.recipe.results || {}).filter(result => result.type === 'item');
  if (results.length !== 1 || !ingredients.length || ingredients.some(ingredient => ingredient.type === 'fluid')) continue;
  const blockRecipe = {
    id: group.recipe.name, category: group.recipe.category || 'crafting',
    time: group.recipe.energy_required || 0.5,
    ingredients: ingredients.map(ingredient => ({ id: ingredient.name, amount: ingredient.amount })),
    results: [{ id: results[0].name, amount: results[0].amount }]
  };
  let offset = 0, chunk = 0;
  while (offset < group.indices.length) {
    const maxRows = group.recipe.name === 'chemical-science-pack' ? 9 : 8;
    let size = Math.min(maxRows, group.indices.length - offset), block, lastError;
    for (const utilization of [1, 0.9, 0.75, 0.667, 0.5]) {
      try {
        block = makeCompactRecipeBlock({
          id: `recipe-block-${group.recipe.name}-${chunk}`,
          recipe: blockRecipe,
          machine: group.recipe.category === 'smelting' ? 'electric-furnace' : 'assembling-machine-2',
          machines: size, utilization, maxRows, inwardInputs: true, pitch: 3, westLanePickup: 'outside'
        });
        break;
      } catch (error) { lastError = error; }
    }
    if (!block) {
      if (size === 1) throw new Error(`Cannot build ${group.recipe.name}: ${lastError?.message || 'unknown error'}`);
      throw new Error(`Block failed: ${group.recipe.name}: ${lastError?.message}`);
    }
    const selected = group.indices.slice(offset, offset + size);
    selected.forEach(index => blockNodeIndices.add(index));
    blockSpecs.push({ block, indices: selected });
    offset += size; chunk++;
  }
}

// Science collectors run outward so completed packs never return to the bus.
for (const {block} of blockSpecs) if (products.includes(block.outputs.material)) {
  const top = block.outputs.collector.top;
  for (const belt of block.belts.filter(belt => belt.role === 'output-collector')) {
    belt.direction = belt.grid.y === top ? 4 : 0;
    block.entities.find(entity => entity.entity_number === belt.entity).direction = belt.direction;
  }
  block.outputs.producerPort.grid.y = top;
  block.outwardOutput = true;
}

const mirrorDirection = direction => direction === 0 ? 8 : direction === 8 ? 0 : direction;
const mirrorGrid = grid => grid ? { ...grid, y: -grid.y } : grid;
const mirrorPosition = position => position ? { ...position, y: 1 - position.y } : position;
const mirrorArm = arm => arm ? { ...arm, grid: mirrorGrid(arm.grid), pickup: mirrorGrid(arm.pickup), drop: mirrorGrid(arm.drop), direction: mirrorDirection(arm.direction) } : arm;
const mirrorDescriptor = belt => belt ? { ...belt, grid: mirrorGrid(belt.grid), position: mirrorPosition(belt.position), direction: mirrorDirection(belt.direction) } : belt;
const mirrorBlock = original => {
  const block = JSON.parse(JSON.stringify(original));
  block.mirrored = true;
  block.entities = block.entities.map(entity => ({ ...entity, position: mirrorPosition(entity.position), direction: mirrorDirection(entity.direction) }));
  block.belts = block.belts.map(mirrorDescriptor);
  block.rows = block.rows.map(row => ({
    ...row,
    row: -row.row,
    machine: {
      ...row.machine,
      centre: mirrorPosition(row.machine.centre),
      inputArms: row.machine.inputArms.map(mirrorArm),
      outputArms: row.machine.outputArms.map(mirrorArm), outputTransferArms: row.machine.outputTransferArms?.map(mirrorArm)
    },
    output: row.output ? {
      ...row.output,
      gridY: -row.output.gridY,
      horizontal: row.output.horizontal.map(mirrorDescriptor),
      tunnel: row.output.tunnel ? { ...row.output.tunnel, input: mirrorDescriptor(row.output.tunnel.input), output: mirrorDescriptor(row.output.tunnel.output) } : null,
      sideLoad: row.output.sideLoad ? { ...row.output.sideLoad, from: mirrorGrid(row.output.sideLoad.from), to: mirrorGrid(row.output.sideLoad.to), direction: mirrorDirection(row.output.sideLoad.direction) } : row.output.sideLoad
    } : row.output
  }));
  block.inputs = block.inputs.map(input => ({
    ...input,
    routeTarget: {
      ...input.routeTarget,
      grid: mirrorGrid(input.routeTarget.grid),
      direction: mirrorDirection(input.routeTarget.direction),
      sideLoad: input.routeTarget.sideLoad ? { ...input.routeTarget.sideLoad, grid: mirrorGrid(input.routeTarget.sideLoad.grid), direction: mirrorDirection(input.routeTarget.sideLoad.direction) } : input.routeTarget.sideLoad
    }
  }));
  block.outputs = {
    ...block.outputs,
    collector: { ...block.outputs.collector, top: -block.outputs.collector.bottom, bottom: -block.outputs.collector.top },
    producerPort: { ...block.outputs.producerPort, grid: mirrorGrid(block.outputs.producerPort.grid), direction: mirrorDirection(block.outputs.producerPort.direction) }
  };
  block.footprint = { ...block.footprint, top: -original.footprint.bottom, bottom: -original.footprint.top };
  if (block.constraints?.portClearances) block.constraints = { ...block.constraints, portClearances: block.constraints.portClearances.map(port => ({ ...port, routeTarget: mirrorGrid(port.routeTarget), sideLoad: mirrorGrid(port.sideLoad) })) };
  return block;
};

const itemSet = new Set(rawInputs.filter(item => !raw.fluid[item]));
for (const node of nodes) {
  if (node.resultType === 'item') itemSet.add(node.item);
  for (const ingredient of Object.values(node.recipe.ingredients || {})) if (ingredient.type !== 'fluid') itemSet.add(ingredient.name);
  for (const result of Object.values(node.recipe.results || {})) if (result.type !== 'fluid') itemSet.add(result.name);
}
const itemRawInputs = rawInputs.filter(item => !raw.fluid[item]);
const itemOrder = [...new Set([...itemRawInputs, ...[...itemSet].filter(item => !itemRawInputs.includes(item) && !products.includes(item)).sort()])];
// Two deterministic banks share the same eastbound material rows.  Alternate
// recipe blocks are mirrored into the south bank, so a vertical branch never
// has to pass through the body of its opposite-bank block.
const requestedBlockColumnGap = 11;
const blockColumnGap = requestedBlockColumnGap;
const oppositeBankOffset = Number(process.env.BANK_OFFSET || 2);
const blockColumnGapRejection = { requested: requestedBlockColumnGap, selected: blockColumnGap, reason: 'fixed GA-selected plan, two banks with direct bus-facing inputs', failures: [] };
const gridColumns = 2;
const gridRowStep = 0;
const gridStagger = oppositeBankOffset;
const requestedBlockBaseX = 70;
const blockBaseX = requestedBlockBaseX;
const blockBaseY = -40;
const bankPlanPath = process.env.BANK_PLAN
  ? (path.isAbsolute(process.env.BANK_PLAN) ? process.env.BANK_PLAN : path.resolve(repo, process.env.BANK_PLAN))
  : path.join(here, 'bank-plan.json');
const bankPlan = JSON.parse(await fs.readFile(bankPlanPath));
const specById = new Map(blockSpecs.map(spec => [spec.block.id, spec]));
const bankSpecs = bankPlan.order.map((id, index) => {
  const spec = specById.get(id);
  if (!spec) throw new Error(`bank plan references missing block ${id}`);
  const bank = bankPlan.positions[id].bank === 1 ? 'south' : 'north';
  return { ...spec, block: bank === 'south' ? mirrorBlock(spec.block) : spec.block, bank, originalIndex: index, plannedX: bankPlan.positions[id].x };
});
const initialBusRows = new Map(itemOrder.map((item, index) => [item, index * 3]));
const bankBottom = Math.max(...initialBusRows.values());
const buildPlacements = busBottom => Object.fromEntries(bankSpecs.map((spec, index) => {
  const bankIndex = bankSpecs.slice(0, index + 1).filter(candidate => candidate.bank === spec.bank).length - 1;
  const y = spec.bank === 'north'
    ? -(spec.block.footprint.bottom + 4)
    : busBottom + 4 - spec.block.footprint.top;
  return [spec.block.id, { x: spec.plannedX, y }];
}));
let placements = buildPlacements(bankBottom);
if (process.env.DEBUG_BANKS) console.error(JSON.stringify(bankSpecs.map(spec => ({ id: spec.block.id, bank: spec.bank, placement: placements[spec.block.id], footprint: spec.block.footprint })), null, 2));
const busStartX = 0;
let maxBlockRight = Math.max(...bankSpecs.map(spec => placements[spec.block.id].x + spec.block.footprint.right));
let busEndX = maxBlockRight + 2;
// Reserve a short receiving neck after the last intermediate producer.
// Finished science is collected locally and never joins these bus rows.
const requestedBusEndMargin = 2;
const busEndMargin = 2;
const externalInputPorts = [{
  id: 'oil-coal', material: 'coal',
  // The adapter's saved coal belt is one tile north of this join tile.
  grid: { x: 10, y: -9 }, direction: 0, side: 'west', lane: 0, branchColumn: 10
}];
const externalOutputPorts = [
  // The adapter's saved final belt is at grid y=-10.  Start the router on
  // the adjacent south tile so its own directed belt is present in the
  // static route proof, then join that belt to the saved adapter tail.
  { id: 'oil-plastic', material: 'plastic-bar', grid: { x: 54, y: -9 }, direction: 8, routeMode: 'south' },
  { id: 'oil-sulfur', material: 'sulfur', grid: { x: 56, y: -9 }, direction: 8, routeMode: 'south' }
];
const externalBusRanges = Object.fromEntries([
  ...itemRawInputs.filter(item => item === 'coal').map(item => [item, { startX: busStartX }]),
  ['plastic-bar', { startX: 54 }],
  ['sulfur', { startX: 56 }]
]);
const routeOptions = busRows => ({
  blocks: bankSpecs.map(spec => spec.block), placements, busRows,
  busStartX, busEndX,
  branchGap: 8,
  inputBranchStart: Math.min(...Object.values(placements).map(p => p.x)) - 6,
  outputBranchStart: maxBlockRight + 8,
  externalInputs: externalInputPorts,
  externalOutputs: externalOutputPorts,
  localOutputMaterials: products,
  trimBusRanges: true,
  externalBusRanges,
  outputMergeSplitters: false,
  inputBranchWestOffsets: { lane0: 8, lane1: 10 },
  inputBranchEastOffset: 12
});
const preliminary = routeCompactBlocks(routeOptions(initialBusRows));
const overlap = (a, b) => a.start <= b.end && b.start <= a.end;
const intervals = preliminary.buses.map(bus => ({
  material: bus.material,
  start: bus.startX - 2,
  end: bus.endX + 2
}));
const colors = [];
for (const interval of [...intervals].sort((a, b) => a.start - b.start || a.end - b.end || a.material.localeCompare(b.material))) {
  let color = 0;
  while (colors[color]?.some(other => overlap(interval, other))) color++;
  (colors[color] ||= []).push(interval);
  interval.color = color;
}
const colorByMaterial = new Map(intervals.map(interval => [interval.material, interval.color]));
const coloredBusRows = new Map(itemOrder.map(item => [item, (colorByMaterial.get(item) ?? 0) * 3]));
placements = buildPlacements(Math.max(...coloredBusRows.values()));
maxBlockRight = Math.max(...bankSpecs.map(spec => placements[spec.block.id].x + spec.block.footprint.right));
busEndX = maxBlockRight + busEndMargin;
const routed = routeCompactBlocks(routeOptions(coloredBusRows));
const condensation = {
  requestedBlockColumnGap,
  blockColumnGap,
  blockColumnGapRejected: requestedBlockColumnGap !== blockColumnGap,
  blockColumnGapRejection,
  blockBaseX,
  requestedBlockBaseX,
  blockBaseY,
  gridColumns,
  gridRowStep,
  gridStagger,
  bottomAligned: true,
  busEndMargin,
  requestedBusEndMargin,
  inputBranchWestOffsets: { lane0: 8, lane1: 10 },
  inputBranchEastOffset: 12,
  baselineRows: initialBusRows.size,
  coloredRows: colors.length,
  intervals,
  colors: colors.map(color => color.map(interval => interval.material)),
  preliminary: {
    entities: preliminary.entities.length,
    buses: preliminary.buses.length,
    dimensions: preliminary.dimensions,
    audit: preliminary.audit
  },
  final: {
    entities: routed.entities.length,
    buses: routed.buses.length,
    dimensions: routed.dimensions,
    audit: routed.audit
  }
};

let entities = routed.entities;
let nextEntity = Math.max(...entities.map(entity => entity.entity_number)) + 1;
// Factorio does not serialize a furnace recipe in a blueprint reliably: on
// import it selects the smelting recipe from the first valid input.  Keep the
// recipe contract in tags for audit/accounting, as the proven power sources
// do, and leave AM2/chemical/refinery recipe fields intact.
for (const entity of entities) {
  if (entity.name === 'electric-furnace' && entity.recipe) {
    entity.tags = { ...(entity.tags || {}), production_recipe: entity.recipe };
    delete entity.recipe;
  }
}
function add(name, x, y, props = {}) {
  const entity = { entity_number: nextEntity++, name, position: { x, y }, ...props };
  entity.tags = { ...(props.tags || {}), starter_entity: entity.entity_number };
  entities.push(entity); return entity;
}

// The oil block is a separately native-tested component.  Keep its machine
// and pipe geometry intact, remove only its local poles, and translate its
// saved belt/pipe interface so its fluid ports sit on x=0.5 and its coal and
// product tails sit ten tiles above the first material bus.
const adapterPath = path.join(repo, 'blueprint-sources/science-factories/components/oil-electric-bus.json');
const adapter = JSON.parse(await fs.readFile(adapterPath));
const adapterPoleNames = new Set(['small-electric-pole', 'medium-electric-pole', 'big-electric-pole']);
const adapterDx = 49, adapterDy = -30;
const adapterIdMap = new Map();
for (const saved of adapter.blueprint.entities) {
  if (adapterPoleNames.has(saved.name)) continue;
  const entity_number = nextEntity++;
  adapterIdMap.set(saved.entity_number, entity_number);
  const position = { x: saved.position.x + adapterDx, y: saved.position.y + adapterDy };
  entities.push({
    ...saved,
    entity_number,
    position,
    tags: { ...(saved.tags || {}), starter_entity: entity_number, science_oil_adapter: true }
  });
}
const adapterPort = label => {
  const saved = adapter.ports.find(port => port.label === label);
  if (!saved) throw new Error(`missing oil adapter port ${label}`);
  const entity_number = adapterIdMap.get(saved.entity);
  if (!entity_number) throw new Error(`oil adapter port ${label} was removed`);
  return {
    ...saved,
    entity: entity_number,
    x: saved.x + adapterDx,
    y: saved.y + adapterDy,
    displayEntity: undefined
  };
};
const ports = [];
for (const item of itemRawInputs) {
  const y = coloredBusRows.get(item), startX = routed.buses.find(bus => bus.material === item).startX, belt = entities.find(entity => entity.name === 'fast-transport-belt' && Math.abs(entity.position.x - (startX + 0.5)) < 1e-9 && Math.abs(entity.position.y - (y + 0.5)) < 1e-9);
  if (!belt) throw new Error(`missing raw item bus ${item}`);
  ports.push({ kind: 'input', label: item, entity: belt.entity_number, items: [item], x: belt.position.x, y: belt.position.y, direction: 4, externalSide: 'west' });
}
for (const label of ['water', 'crude-oil']) {
  const adapterFluid = adapterPort(label);
  // The compact bus starts at x=0, the same west edge as the translated oil
  // adapter's proven fluid entrances at x=0.5.
  ports.push({ ...adapterFluid, externalSide: 'west' });
}

// Terminal science packs use the short local belts emitted by the router.
// Keep each indexed chest beside its producer instead of extending a product
// bus across the whole factory.
for (const [index, product] of products.entries()) {
  const outputBlock = routed.blocks.find(block => block.outputPort.material === product);
  const route = routed.routes.find(candidate => candidate.kind === 'local-output' && candidate.material === product);
  if (!outputBlock || !route) throw new Error(`missing local science output route ${product}`);
  const target = route.target.grid;
  const chest = add('wooden-chest', target.x + 2.5, target.y + 0.5, { bar: 1, tags: { science_output: product } });
  add('fast-inserter', target.x + 1.5, target.y + 0.5, { direction: 12, tags: { science_output: product } });
  ports.push({ kind: 'output', index: index + 1, label: `OUT ${index + 1} · ${product}`, entity: chest.entity_number, items: [product], x: chest.position.x, y: chest.position.y, externalSide: bankSpecs.find(spec => spec.block.id === outputBlock.id).bank === 'south' ? 'south' : 'north' });
}
const adapterPower = { kind: 'power', label: 'P · External power', items: [], entity: 0, x: busStartX + 1.5, y: 0.5 };
ports.push(adapterPower);

const blueprint = { item: 'blueprint', version: 562949958467584, entities, wires: [], icons: products.map((name, index) => ({ index: index + 1, signal: { type: 'item', name } })) };
const info = {
  id: 'science-four-pack-30-electric', file: 'science-four-pack-30-electric.txt', name: 'Electric science factory · 30/min each',
  category: 'Science factory', kind: 'production', rawOnly: true, scienceFactory: true, workshop: false,
  products, rawInputs, portPolicy: 'distributed', surface: { name: 'Nauvis', properties: { pressure: 1000 } },
  requires: researchClosure.filter(id => !researchClosure.some(other => other !== id && closure(other).has(id))),
  researchClosure, recipes: [...new Set(Object.keys(counts))], machineCounts: counts, machineCount: nodes.length, targetPerMinute: 30,
  fuelPolicy: { furnaceFuel: 'electricity', furnaceEntities: ['electric-furnace'], coalAllowedFor: ['grenade', 'plastic-bar'], internalProduction: false, externalFuelInjection: false },
  inputDisplays: { optional: true, requiredTechnology: 'circuit-network' },
  powerNetwork: { connection: 'big-electric-pole', distribution: 'medium-electric-pole', research: 'electric-energy-distribution-1', externalOnly: true },
  ports, connectionPorts: ports,
  setupNotes: ['Feed iron ore, copper ore, coal, stone, water and crude oil at the six labeled input ports.', 'Each of the four science output chests is beside the outer end of its science block on a short local belt.', 'All smelting uses electric furnaces and electricity is external; no solid-fuel plant or furnace fuel route is included.', 'Fast transport belts, fast underground belts and fast splitters are used; no robots, modules, beacons or quality are included.'],
  changes: ['Pure item recipes use deterministic compact blocks and one eastbound bus per material.', 'Electric furnaces replace steel furnaces and remove the solid-fuel branch.']
};
// Route the one coal adapter input and its plastic/sulfur outputs into the
// global buses.  The adapter port itself is retained as the south-facing
// output/input endpoint; the router adds only the adjacent bus-side belts.
const compactReport = compactStarterLayout(blueprint, ports, raw);
addInputDisplays(blueprint, info, raw);
entities = blueprint.entities;
blueprint.label = info.name; blueprint.description = [blueprint.label, ...info.setupNotes].join('\n');
const staticConnectionAudit = auditConnections(blueprint, raw);
const code = encodeBlueprint({ blueprint }) + '\n';
const blueprintSha256 = createHash('sha256').update(code.trim()).digest('hex');
const materials = blueprintMaterials({ blueprint }, catalog);
const xs = entities.map(entity => entity.position.x), ys = entities.map(entity => entity.position.y);
const footprint = { width: Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)), height: Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)) };
info.setupNotes.push('Connect the labeled raw inputs near their processing blocks. Science leaves at local north/south chests. Intermediate routes end after their last consumer.');
info.changes = ['Finished science leaves from local north/south chests; the four science output buses are removed.', 'Raw inputs are near their processing blocks, and shared routes terminate at their last consumer.', 'Three-ingredient rows use three-tile machine spacing, filtered result extraction and lane guides; adjacent crossings share longer underground pairs.', 'One extra logistic-science assembler provides recovery capacity within the existing footprint; production controls keep science near the balanced target.'];
condensation.inputBranchMode = 'direct bus-facing ports';
condensation.inputPortOffsets = { A: -4, B: -2, C: 3 };
delete condensation.inputBranchWestOffsets;
delete condensation.inputBranchEastOffset;
const manifest = { ...info, blueprintSha256, entityCount: materials.entityCount, entries: materials.entries, excluded: materials.excluded, condensation, compactReport, staticConnectionAudit, bankPlan: { width: bankPlan.width, height: bankPlan.height, rows: bankPlan.rows, order: bankPlan.order, positions: bankPlan.positions }, layoutOptions: { kind: 'two-bank-local-ports-mixed-lanes', branchGap: 8, busSpacing: 3, transportTier: 'fast', electricFurnaces: true, requestedBlockColumnGap, blockColumnGap, gridColumns, gridRowStep, blockColumnGapRejected: requestedBlockColumnGap !== blockColumnGap, blockColumnGapRejection, blockBaseX, bottomAligned: true, busEndMargin, baselineRows: initialBusRows.size, coloredRows: colors.length } };
const out = path.join(outputRoot, 'blueprint-sources/science-factories');
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, info.file), code);
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify([manifest], null, 2) + '\n');
await fs.writeFile(path.join(out, 'layout-summary.json'), JSON.stringify({ id: info.id, blueprintSha256, footprint, entityCount: materials.entityCount, machineCount: nodes.length, ports, blockCount: blockSpecs.length, blocks: routed.blocks, buses: routed.buses, audit: routed.audit, compactReport, staticConnectionAudit, bankPlan: { width: bankPlan.width, height: bankPlan.height, rows: bankPlan.rows, order: bankPlan.order, positions: bankPlan.positions }, busRows: Object.fromEntries(coloredBusRows), researchClosure, machineCounts: counts }, null, 2) + '\n');
await fs.writeFile(path.join(outputRoot, 'condensed-baseline.json'), JSON.stringify({
  id: info.id,
  targetPerMinute: info.targetPerMinute,
  parameters: { requestedBlockColumnGap, blockColumnGap, gridColumns, gridRowStep, gridStagger, blockColumnGapRejected: requestedBlockColumnGap !== blockColumnGap, blockColumnGapRejection, blockBaseX, blockBaseY, bottomAligned: true, busStartX, busEndX, busEndMargin, baselineRows: initialBusRows.size, coloredRows: colors.length },
  placements,
  itemOrder,
  condensation,
  blueprintSha256,
  entityCount: materials.entityCount,
  footprint,
  ports
}, null, 2) + '\n');
console.log(JSON.stringify({ id: info.id, blueprintSha256, footprint, entityCount: materials.entityCount, machineCount: nodes.length, blocks: blockSpecs.length, buses: routed.buses.length, ports: ports.length, audit: routed.audit }, null, 2));
