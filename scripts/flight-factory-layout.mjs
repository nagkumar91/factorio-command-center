import {materialKey, machinePorts, energy} from './flight-factory-model.mjs';
import {encodeBlueprint} from './blueprints.mjs';
import {createHash} from 'node:crypto';

const dirs = [[0, -1, 0], [1, 0, 4], [0, 1, 8], [-1, 0, 12]];
const key = (x, y) => `${x},${y}`;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const directBoundaryInputs = plan => new Map(plan.inputs.filter(p => p.type === 'item'
  && !plan.steps.some(s => s.results.some(r => materialKey(r) === materialKey(p)))
  && !plan.steps.some(s => s.results.length === 1 && s.results[0].type === 'item'
    && s.ingredients.some(i => materialKey(i) === materialKey(s.results[0])) && s.ingredients.some(i => materialKey(i) === materialKey(p))))
  .map(p => [materialKey(p), p]));
const perishable = (model, p) => !!model.goods.get(materialKey(p))?.spoilTicks;
const inputGroups = (model, step, direct) => {
  const parts = step.ingredients.filter(p => p.type === 'item');
  return [...parts.filter(p => direct.has(materialKey(p)) || perishable(model, p)).map(p => [p]),
    parts.filter(p => !direct.has(materialKey(p)) && !perishable(model, p))].filter(group => group.length);
};

function perishableCellPositions(model, plan, columns) {
  const parents = plan.steps.map((_, i) => i), root = i => parents[i] === i ? i : (parents[i] = root(parents[i]));
  for (let a = 0; a < plan.steps.length; a++) {
    const products = new Set(plan.steps[a].results.filter(p => perishable(model, p)).map(materialKey));
    for (let b = 0; b < plan.steps.length; b++) if (plan.steps[b].ingredients.some(p => products.has(materialKey(p)))) parents[root(b)] = root(a);
  }
  const groups = new Map();
  plan.steps.forEach((step, i) => { const k = root(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push({step, i}); });
  const available = new Set(Array.from({length: plan.machineCount}, (_, i) => i)), positions = new Map();
  const cells = group => group.flatMap(({step, i}) => Array.from({length: step.machineCount}, (_, unit) => `${i}:${unit}`));
  for (const group of [...groups.values()].filter(g => g.length > 1).sort((a, b) => cells(b).length - cells(a).length)) {
    const anchor = Math.min(...available), x = anchor % columns, y = Math.floor(anchor / columns);
    const nearby = [...available].sort((a, b) => (Math.abs(a % columns - x) + Math.abs(Math.floor(a / columns) - y))
      - (Math.abs(b % columns - x) + Math.abs(Math.floor(b / columns) - y)) || a - b);
    cells(group).forEach((id, i) => { positions.set(id, nearby[i]); available.delete(nearby[i]); });
  }
  const remaining = [...available];
  plan.steps.forEach((step, i) => { for (let unit = 0; unit < step.machineCount; unit++) if (!positions.has(`${i}:${unit}`)) positions.set(`${i}:${unit}`, remaining.shift()); });
  return positions;
}

export function provisionItemTransfers(model, plan) {
  if (plan.status !== 'planned') return;
  const arm = model.entities.get('stack-inserter');
  if (!arm?.rotation_speed || !arm.extension_speed) return;
  // Sum a full return swing and extension/retraction, even though the game
  // overlaps parts of that motion. This deliberately leaves transfer margin.
  const cycleSeconds = (1 / arm.rotation_speed + 2 / arm.extension_speed) / 60;
  const conservativePerSecond = (1 + (arm.stack_size_bonus || 0)) / cycleSeconds * .8;
  const direct = directBoundaryInputs(plan), oldCount = plan.machineCount;
  for (const step of plan.steps) {
    const outputs = step.results.filter(p => p.type === 'item');
    const groups = [...inputGroups(model, step, direct).map(parts => ({parts, slow: parts.some(p => perishable(model, p))})),
      {parts: outputs, slow: outputs.length > 1 || outputs.some(p => perishable(model, p))}];
    const transferCount = Math.ceil(Math.max(0, ...groups.map(({parts, slow}) => parts.reduce((n, p) => n + p.perSecond, 0)
      / (slow ? conservativePerSecond / (1 + (arm.stack_size_bonus || 0)) : conservativePerSecond))) - 1e-8);
    if (transferCount > step.machineCount) {
      step.machineCount = transferCount; step.utilization = step.exactMachineCount / transferCount;
      step.transportProvision = {reason: 'Conservative installed stack-inserter transfer capacity', itemsPerSecondPerArm: conservativePerSecond};
    }
  }
  plan.machineCount = plan.steps.reduce((n, s) => n + s.machineCount, 0);
  if (plan.machineCount !== oldCount) plan.assumptions.push(`Machine count includes ${plan.machineCount - oldCount} extra cells for conservative item-inserter capacity; recipe demand and external ingredients are unchanged.`);
}

class Heap {
  a = [];
  push(v) { let i = this.a.length; this.a.push(v); while (i) { const p = (i - 1) >> 1; if (this.a[p].score <= v.score) break; this.a[i] = this.a[p]; i = p; } this.a[i] = v; }
  pop() { const v = this.a[0], last = this.a.pop(); if (this.a.length) { let i = 0; while (2 * i + 1 < this.a.length) { let c = 2 * i + 1; if (c + 1 < this.a.length && this.a[c + 1].score < this.a[c].score) c++; if (this.a[c].score >= last.score) break; this.a[i] = this.a[c]; i = c; } this.a[i] = last; } return v; }
}

export function generateFactoryBlueprint(model, plan, {maxMachines = 128, attempt = 0} = {}) {
  if (plan.status !== 'planned') return {status: 'unsupported', reason: plan.reason};
  const selfCycle = step => step.results.length === 1 && step.results[0].type === 'item' && step.ingredients.some(i => i.type === 'item' && i.id === step.results[0].id);
  if (plan.startupStock.some(stock => stock.type !== 'item' || !plan.steps.some(step => selfCycle(step) && step.results[0].id === stock.id))) return {status: 'unsupported', reason: 'Startup stock requires a multi-recipe circulation layout; only local single-product seed loops are implemented.'};
  if (plan.machineCount > maxMachines) return {status: 'unsupported', reason: `Plan needs ${plan.machineCount} machines; layout limit is ${maxMachines}. Lower the target rate.`};
  const usedFluids = new Set(plan.steps.flatMap(s => [...s.ingredients, ...s.results]).filter(p => p.type === 'fluid').map(p => p.id));
  for (const id of usedFluids) {
    const products = plan.steps.flatMap(s => s.results.filter(p => p.id === id && p.type === 'fluid'));
    const temperatures = new Set(products.map(p => p.temperature ?? model.raw.fluid[id].default_temperature));
    if (temperatures.size > 1) return {status: 'unsupported', reason: `Separate temperature networks needed for ${id}.`};
    const temp = [...temperatures][0] ?? model.raw.fluid[id].default_temperature;
    if (plan.steps.some(s => s.ingredients.some(p => p.id === id && p.type === 'fluid' && (temp < (p.minimum_temperature ?? p.temperature ?? -Infinity) || temp > (p.maximum_temperature ?? p.temperature ?? Infinity))))) return {status: 'unsupported', reason: `Temperature requirements for ${id} need a dedicated thermal process.`};
  }
  const entities = [], wires = [], occupied = new Map(), reserved = new Map(), nets = new Map();
  const inputs = [], outputs = [], wasteOutputs = [], machineIds = [], roboportIds = [], powerPoleIds = [], materialSeeds = [];
  const buffers = [], pendingDisplays = [], logisticSources = [], logisticSinks = [];
  const columns = Math.max(Math.ceil(Math.sqrt(plan.machineCount)) + Math.floor(attempt / 2), Math.ceil(Math.max(plan.inputs.length + plan.startupStock.length, plan.surplus.length + 1) * 4 / 24));
  const rows = Math.ceil(plan.machineCount / columns), maxX = Math.max(48, 24 * columns + 12), maxY = 24 * rows + 52;
  const fluidExtent = model.raw['utility-constants']?.default?.default_pipeline_extent || 320;
  if (usedFluids.size && (maxX + 2 > fluidExtent || maxY + 2 > fluidExtent)) return {status: 'unsupported', reason: 'Layout would exceed the installed unpumped fluid-network extent; lower the target rate.'};
  const prototype = name => { const p = model.entities.get(name); if (!p) throw new Error(`Missing installed entity ${name}`); return p; };
  const size = name => { const p = prototype(name), b = p.collision_box || p.selection_box; return [Math.ceil(b[1][0] - b[0][0]), Math.ceil(b[1][1] - b[0][1])]; };
  const tiles = (name, x, y) => { const [w, h] = size(name), points = []; for (let tx = Math.floor(x - w / 2 + 1e-6); tx < x + w / 2 - 1e-6; tx++) for (let ty = Math.floor(y - h / 2 + 1e-6); ty < y + h / 2 - 1e-6; ty++) points.push(key(tx, ty)); return points; };
  function canPlace(name, x, y) { return tiles(name, x, y).every(k => !occupied.has(k) && !reserved.has(k)); }
  function add(name, x, y, props = {}) {
    if (!canPlace(name, x, y)) throw new Error(`Entity overlap: ${name} at ${x},${y}`);
    const entity = {entity_number: entities.length + 1, name, position: {x, y}, ...props};
    entity.tags = {...props.tags, flight_entity: entity.entity_number};
    entities.push(entity);
    for (const k of tiles(name, x, y)) occupied.set(k, {entity, fluid: props.tags?.flight_fluid});
    return entity;
  }
  const netFor = p => { const k = materialKey(p); if (!nets.has(k)) nets.set(k, {key: k, id: p.id, points: []}); return nets.get(k); };
  function reserveFixture(x, y, portX, portY, material) {
    reserved.set(key(x, y), material);
    for (const [dx, dy] of dirs) if (x + dx !== portX || y + dy !== portY) reserved.set(key(x + dx, y + dy), material);
  }
  function pipe(x, y, p, tags = {}) {
    const k = key(x, y), old = occupied.get(k);
    if (old?.fluid === materialKey(p) && old.entity.name === 'pipe') return old.entity;
    return add('pipe', x + 0.5, y + 0.5, {tags: {flight_fluid: materialKey(p), ...tags}});
  }
  const bufferCount = p => {
    const good = model.goods.get(materialKey(p)), seconds = good?.spoilTicks ? Math.min(30, good.spoilTicks / 180) : 60;
    return Math.max(2, Math.ceil(p.amount * 2), Math.ceil((p.perSecond || 0) * seconds));
  };
  const requests = parts => {
    const summed = new Map();
    for (const p of parts) { const old = summed.get(p.id) || {id: p.id, amount: 0, perSecond: 0}; old.amount += p.amount; old.perSecond += p.perSecond || 0; summed.set(p.id, old); }
    return {sections: [{index: 1, filters: [...summed.values()].map((p, i) => ({index: i + 1, name: p.id, quality: 'normal', comparator: '=', count: bufferCount({...p, type: 'item'})}))}]};
  };
  // A declared item input can feed its consuming machine directly. Split only
  // inputs with no internal producer, so shared co-products still offset imports.
  const directInputs = directBoundaryInputs(plan);
  function trackBuffer(entity, parts, spillableParts = parts) { buffers.push({entity, parts, spillableParts}); }
  function inputPort(p, entity, {amount = 1, immediateDisplay = false} = {}) {
    const port = {...p, name: p.id, label: `IN ${p.id}`, entityNumber: entity.entity_number,
      position: entity.position, ratePerSecond: p.perSecond, plannedPerSecond: p.perSecond,
      supplyPolicy: 'unlimited-external-boundary-fixture', ...(p.type === 'item' ? {bufferCount: bufferCount({...p, amount})} : {})};
    const text = `IN ${p.id}\n${(p.perSecond * 60).toPrecision(5)}/min — ${p.type === 'fluid' ? 'connect pipe below' : 'fill labeled chest'}`;
    const props = {icon: {type: p.type, name: p.id}, text, always_show: true, show_in_chart: true, tags: {flight_display_input: entity.entity_number}};
    if (immediateDisplay) port.displayEntity = add('display-panel', entity.position.x, entity.position.y - 2, props).entity_number;
    else pendingDisplays.push({entity, props, port});
    if (p.type === 'item') trackBuffer(entity, [p]);
    inputs.push(port); return port;
  }
  try {
    // A complete saved copper grid provides power without auto-connect repairs.
    const grid = new Map();
    for (let y = 0; y <= maxY; y += 12) for (let x = 0; x <= maxX; x += 12) {
      const p = add('substation', x, y); powerPoleIds.push(p.entity_number); grid.set(key(x, y), p);
      for (const neighbor of [grid.get(key(x - 12, y)), grid.get(key(x, y - 12))]) if (neighbor) wires.push([p.entity_number, 5, neighbor.entity_number, 5]);
    }
    for (let x = 20; x < maxX; x += 24) roboportIds.push(add('roboport', x, 18).entity_number);
    for (let i = 0; i < plan.inputs.length; i++) {
      const p = plan.inputs[i], x = 4 + i * 4, y = 4;
      if (directInputs.has(materialKey(p))) continue;
      const e = p.type === 'fluid' ? pipe(x, y, p, {flight_input: materialKey(p)}) : add('passive-provider-chest', x + .5, y + .5, {tags: {flight_input: materialKey(p)}});
      const port = inputPort(p, e, {amount: Math.max(1, ...plan.steps.flatMap(s => s.ingredients.filter(q => materialKey(q) === materialKey(p)).map(q => q.amount))), immediateDisplay: true});
      if (p.type === 'fluid') { port.fixturePosition = {x: x + .5, y: y - .5}; port.temperature = model.raw.fluid[p.id].default_temperature; reserveFixture(x, y - 1, x, y, materialKey(p)); netFor(p).points.push({x, y, outward: 8}); }
      else logisticSources.push({position: e.position, parts: [p]});
    }
    const productPorts = [{...plan.target, target: true}, ...plan.surplus.filter(p => materialKey(p) !== materialKey(plan.target))];
    for (let i = 0; i < productPorts.length; i++) {
      const p = productPorts[i], x = 4 + i * 4, y = 8;
      const e = p.type === 'fluid' ? pipe(x, y, p, {flight_output: materialKey(p)}) : add('requester-chest', x + .5, y + .5, {request_filters: requests([{...p, amount: Math.max(100, p.perSecond * 120)}]), tags: {flight_output: materialKey(p)}});
      const port = {...p, name: p.id, entityNumber: e.entity_number, position: e.position, ratePerSecond: p.perSecond, minPerMinute: p.target ? p.perSecond * 60 * .9 : 0, role: p.target ? 'target' : 'surplus'};
      if (p.type === 'fluid') { port.fixturePosition = {x: x + .5, y: y + 1.5}; reserveFixture(x, y + 1, x, y, materialKey(p)); netFor(p).points.push({x, y, outward: 0}); }
      else { trackBuffer(e, [p]); logisticSinks.push({position: e.position, parts: [p]}); }
      outputs.push(port);
    }
    const cellPositions = perishableCellPositions(model, plan, columns);
  const recipeById = new Map(model.recipes.map(r => [r.id, r]));
    const downstream = new Map(), producerCounts = new Map();
    for (const step of plan.steps) {
      for (const p of step.ingredients) downstream.set(materialKey(p), (downstream.get(materialKey(p)) || 0) + p.perSecond);
      if (step.results.length === 1) { const k = materialKey(step.results[0]); producerCounts.set(k, (producerCounts.get(k) || 0) + step.machineCount); }
    }
    for (let stepIndex = 0; stepIndex < plan.steps.length; stepIndex++) for (let unit = 0; unit < plan.steps[stepIndex].machineCount; unit++) {
      const step = plan.steps[stepIndex], index = cellPositions.get(`${stepIndex}:${unit}`);
      const recipe = recipeById.get(step.recipe), proto = prototype(step.machine), [w, h] = size(step.machine);
      const cx = 20 + index % columns * 24 + w % 2 / 2, cy = 40 + Math.floor(index / columns) * 24 + h % 2 / 2;
      const machine = add(step.machine, cx, cy, {...(proto.type === 'furnace' || proto.fixed_recipe ? {} : {recipe: step.recipe}), tags: {production_recipe: step.recipe}});
      machineIds.push(machine.entity_number);
      if (proto.vector_to_place_result) {
        const [dx, dy] = proto.vector_to_place_result;
        const chest = add('passive-provider-chest', Math.floor(cx + dx) + .5, Math.floor(cy + dy) + .5, {bar: Math.min(48, Math.max(2, step.results.filter(p => p.type === 'item').length * 2)), tags: {flight_direct_machine_output: machine.entity_number}});
        const parts = step.results.filter(p => p.type === 'item').map(p => ({...p, perSecond: p.perSecond / step.machineCount}));
        trackBuffer(chest, parts, [...parts, ...step.ingredients.filter(p => p.type === 'item')]); logisticSources.push({position: chest.position, parts});
      }
      const connectedMachinePorts = new Set();
      for (const p of machinePorts(proto, recipe) || []) {
        const [dx, dy] = dirs.find(d => d[2] === p.connection.direction);
        const x = Math.round(cx + p.connection.position[0] + dx - .5), y = Math.round(cy + p.connection.position[1] + dy - .5);
        connectedMachinePorts.add(key(x, y));
        for (let length = 0; length < 4; length++) pipe(x + dx * length, y + dy * length, p);
        netFor(p).points.push({x: x + dx * 3, y: y + dy * 3, outward: p.connection.direction});
      }
      // Unused physical ports can still belong to a merged recipe fluid box.
      // Keep every other fluid route away from those exposed connections.
      for (const box of Object.values(proto.fluid_boxes || {})) for (const c of Object.values(box.pipe_connections || {})) {
        const direction = dirs.find(d => d[2] === c.direction);
        if (!direction || !Array.isArray(c.position) || c.connection_type === 'linked') continue;
        const x = Math.round(cx + c.position[0] + direction[0] - .5), y = Math.round(cy + c.position[1] + direction[1] - .5);
        if (!connectedMachinePorts.has(key(x, y))) reserved.set(key(x, y), 'unused-machine-fluid-port');
      }
      // Each ingredient chest can carry every item ingredient including fuel.
      // Never inject into the machine itself in the native harness.
      const slots = [];
      for (let offset = 0; offset < Math.max(w, h); offset++) {
        const yy = cy - h / 2 + .5 + offset, xx = cx - w / 2 + .5 + offset;
        if (offset < h) slots.push({x: cx - w / 2 - .5, y: yy, d: 12}, {x: cx + w / 2 + .5, y: yy, d: 4});
        if (offset < w) slots.push({x: xx, y: cy - h / 2 - .5, d: 0}, {x: xx, y: cy + h / 2 + .5, d: 8});
      }
      function itemPort(kind, parts, direct = false) {
        if (!parts.length) return;
        const name = direct ? 'steel-chest' : kind === 'input' ? 'requester-chest' : 'passive-provider-chest';
        // A stack inserter has intrinsic extra hand capacity in the installed
        // prototypes; no research bonus is assumed by the native fixture.
        const safeToWaitForFullHand = !parts.some(p => perishable(model, p)) && (kind === 'input' || parts.length === 1);
        const arm = safeToWaitForFullHand && parts.reduce((sum, p) => sum + (p.perSecond || 0), 0) > 1.5 && model.entities.has('stack-inserter') ? 'stack-inserter' : 'bulk-inserter';
        const slot = slots.find(p => { const [dx, dy] = dirs.find(d => d[2] === p.d); return canPlace(arm, p.x, p.y) && canPlace(name, p.x + dx, p.y + dy); });
        if (!slot) throw new Error(`No item port for ${step.recipe}`);
        const [dx, dy] = dirs.find(d => d[2] === slot.d);
        const product = parts[0], k = materialKey(product);
        const limit = kind === 'output' && step.results.length === 1 && k !== materialKey(plan.target) && downstream.has(k)
          ? Math.max(Math.ceil(product.expectedAmount), Math.ceil(downstream.get(k) * 60 / producerCounts.get(k))) : null;
        const inserter = add(arm, slot.x, slot.y, {direction: kind === 'input' ? slot.d : (slot.d + 8) % 16,
          ...(limit ? {control_behavior: {circuit_enabled: true, circuit_condition: {first_signal: {type: 'item', name: product.id, quality: 'normal'}, comparator: '<', constant: limit}}} : {})});
        const bufferSlots = limit ? Math.max(1, Math.ceil(limit / model.goods.get(k).stackSize)) : Math.max(1, new Set(parts.map(p => p.id)).size * 2);
        const chest = add(name, slot.x + dx, slot.y + dy, direct ? {tags: {flight_input: k}} : kind === 'input' ? {request_filters: requests(parts)} : {bar: Math.min(48, bufferSlots), tags: {flight_output_buffer_slots: Math.min(48, bufferSlots), ...(limit ? {flight_intermediate_limit: limit, flight_intermediate_material: product.id} : {})}});
        if (direct) {
          const original = directInputs.get(k), totalDemand = downstream.get(k);
          inputPort({...original, perSecond: original.perSecond * product.perSecond / totalDemand}, chest, {amount: product.amount});
        } else {
          trackBuffer(chest, parts, kind === 'output' ? [...parts, ...step.ingredients.filter(p => p.type === 'item')] : parts);
          (kind === 'input' ? logisticSinks : logisticSources).push({position: chest.position, parts});
        }
        if (limit) wires.push([chest.entity_number, 1, inserter.entity_number, 1]);
      }
      if (selfCycle(step)) {
        if (w !== 3 || h !== 3) throw new Error(`Seed return loop currently requires a 3x3 machine: ${step.machine}`);
        const product = step.results[0], seed = step.ingredients.find(p => p.id === product.id && p.type === 'item'), reserve = Math.ceil(seed.amount * 2);
        const chest = add('requester-chest', cx - 3, cy, {request_filters: requests(step.ingredients.filter(p => p.type === 'item').map(p => ({...p, perSecond: p.perSecond / step.machineCount}))), tags: {flight_seed_reserve: reserve, flight_seed_material: product.id}});
        const inputParts = step.ingredients.filter(p => p.type === 'item').map(p => ({...p, perSecond: p.perSecond / step.machineCount}));
        trackBuffer(chest, inputParts); logisticSinks.push({position: chest.position, parts: inputParts.filter(p => p.id !== product.id)});
        add('bulk-inserter', cx - 2, cy, {direction: 12});
        add('bulk-inserter', cx + 2, cy + 1, {direction: 12});
        const belt = (x, y, direction) => add('transport-belt', x, y, {direction, tags: {flight_seed_return: product.id}});
        for (let y = cy + 1; y < cy + 4; y++) belt(cx + 3, y, 8);
        for (let x = cx + 3; x > cx - 3; x--) belt(x, cy + 4, 12);
        for (let y = cy + 4; y >= cy + 2; y--) belt(cx - 3, y, 0);
        add('bulk-inserter', cx - 3, cy + 1, {direction: 8});
        const exporter = add('bulk-inserter', cx - 4, cy, {direction: 4, override_stack_size: 1, use_filters: true, filter_mode: 'whitelist', filters: [{index: 1, name: product.id, quality: 'normal', comparator: '='}],
          control_behavior: {circuit_enabled: true, circuit_condition: {first_signal: {type: 'item', name: product.id, quality: 'normal'}, comparator: '>', constant: reserve}}});
        const provider = add('passive-provider-chest', cx - 5, cy, {bar: 2, tags: {flight_output_buffer_slots: 2}});
        const exported = {...product, perSecond: Math.max(0, product.perSecond - seed.perSecond) / step.machineCount};
        trackBuffer(provider, [product]); logisticSources.push({position: provider.position, parts: [exported]});
        wires.push([chest.entity_number, 1, exporter.entity_number, 1]);
        const stock = plan.startupStock.find(p => p.id === product.id && p.type === 'item');
        if (stock) {
          const count = Math.max(Math.ceil(seed.amount), seed.fuel ? Math.ceil(energy(proto.energy_usage) * 120 / energy(model.goods.get(materialKey(seed)).prototype.fuel_value)) : 0);
          const source = add('steel-chest', cx + 5, cy + 2, {bar: 1, tags: {flight_startup: materialKey(stock)}});
          add('bulk-inserter', cx + 4, cy + 2, {direction: 4});
          const display = add('display-panel', cx + 6, cy + 2, {icon: {type: stock.type, name: stock.id}, text: `STARTUP ${stock.id}\n${count} once → seed chest`, always_show: true, show_in_chart: true, tags: {flight_display_input: source.entity_number}});
          materialSeeds.push({type: stock.type, name: stock.id, entityNumber: source.entity_number, count, displayEntity: display.entity_number, position: source.position, sources: stock.sources});
        }
      } else {
        for (const group of inputGroups(model, step, directInputs)) itemPort('input', group.map(p => ({...p, perSecond: p.perSecond / step.machineCount})), group.length === 1 && directInputs.has(materialKey(group[0])));
        if (!proto.vector_to_place_result) itemPort('output', step.results.filter(p => p.type === 'item').map(p => ({...p, perSecond: p.perSecond / step.machineCount})));
      }
      roboportIds.push(add('roboport', 20 + index % columns * 24, 50 + Math.floor(index / columns) * 24).entity_number);
    }
    // Spoiled material must leave the same physical buffer that held the fresh
    // item. A separate steel chest cannot request or steal a useful ingredient
    // from the logistic network. These are waste boundaries, never products.
    for (const {entity, parts, spillableParts} of buffers) {
      const wanted = new Set(parts.map(p => p.id)), wastes = new Map();
      for (const p of spillableParts) {
        const result = model.goods.get(materialKey(p))?.spoilResult;
        if (!result || wanted.has(result)) continue;
        if (!wastes.has(result)) wastes.set(result, []);
        wastes.get(result).push(p.id);
      }
      for (const [name, spoiledFrom] of wastes) {
        const slot = dirs.find(([dx, dy]) => canPlace('bulk-inserter', entity.position.x + dx, entity.position.y + dy)
          && canPlace('steel-chest', entity.position.x + dx * 2, entity.position.y + dy * 2));
        if (!slot) throw new Error(`No physical spoilage drain for ${name} at ${entity.entity_number}`);
        const [dx, dy, d] = slot;
        const arm = add('bulk-inserter', entity.position.x + dx, entity.position.y + dy, {direction: (d + 8) % 16,
          use_filters: true, filter_mode: 'whitelist', filters: [{index: 1, name, quality: 'normal', comparator: '='}]});
        const chest = add('steel-chest', entity.position.x + dx * 2, entity.position.y + dy * 2, {tags: {flight_waste: `item:${name}`, flight_waste_source: entity.entity_number}});
        const port = {type: 'item', name, entityNumber: chest.entity_number, position: chest.position, sourceEntityNumber: entity.entity_number,
          inserterEntityNumber: arm.entity_number, spoiledFrom: [...new Set(spoiledFrom)], handling: 'Empty this dedicated waste chest continuously; its contents are not manufactured output.'};
        wasteOutputs.push(port);
        pendingDisplays.push({entity: chest, port, props: {icon: {type: 'item', name}, text: `WASTE ${name}\nEmpty continuously`, always_show: true, show_in_chart: true,
          tags: {flight_display_waste: chest.entity_number}}});
      }
    }
    for (const {entity, props, port} of pendingDisplays) {
      let position;
      for (let radius = 1; radius <= 5 && !position; radius++) for (const [dx, dy] of dirs) {
        const x = entity.position.x + dx * radius, y = entity.position.y + dy * radius;
        if (canPlace('display-panel', x, y)) { position = {x, y}; break; }
      }
      if (!position) throw new Error(`No input/waste display position for ${entity.entity_number}`);
      port.displayEntity = add('display-panel', position.x, position.y, props).entity_number;
    }
    const robot = prototype('logistic-robot'), portPrototype = prototype('roboport');
    const speed = robot.speed * 60, payload = robot.max_payload_size || 1;
    let robotSeconds = 0, movementWatts = 0, transfersPerSecond = 0;
    for (const sink of logisticSinks) for (const p of sink.parts) {
      if (!(p.perSecond > 0)) continue;
      const sources = logisticSources.flatMap(s => s.parts.filter(q => materialKey(q) === materialKey(p) && q.perSecond > 0).map(q => ({...s, rate: q.perSecond})));
      if (!sources.length) throw new Error(`No physical logistic source for ${materialKey(p)}`);
      const total = sources.reduce((n, s) => n + s.rate, 0);
      const length = Math.max(4, sources.reduce((n, s) => n + Math.hypot(s.position.x - sink.position.x, s.position.y - sink.position.y) * s.rate / total, 0));
      const trips = p.perSecond / payload, travelSeconds = 2 * length / speed;
      transfersPerSecond += trips;
      robotSeconds += trips * (travelSeconds + 4);
      movementWatts += trips * (2 * length * energy(robot.energy_per_move) + travelSeconds * 60 * energy(robot.energy_per_tick));
    }
    const robotCount = Math.max(roboportIds.length * 20, Math.ceil(robotSeconds * 1.8));
    const portCapacity = (portPrototype.robot_slots_count || 7) * model.goods.get('item:logistic-robot').stackSize;
    const chargingPerPort = (portPrototype.charging_offsets?.length || 4) * energy(portPrototype.charging_energy);
    const requiredPorts = Math.max(roboportIds.length, Math.ceil(robotCount / portCapacity), Math.ceil(movementWatts * 1.8 / chargingPerPort));
    for (let y = 18; y < maxY && roboportIds.length < requiredPorts; y += 24) for (let x = 8; x < maxX && roboportIds.length < requiredPorts; x += 24) {
      if (canPlace('roboport', x, y)) roboportIds.push(add('roboport', x, y).entity_number);
    }
    if (roboportIds.length < requiredPorts) throw new Error('Insufficient room for calculated logistic charging capacity.');
    const robotsPerPort = Math.max(1, Math.ceil(robotCount / roboportIds.length));
    const logistics = {robotCount: robotsPerPort * roboportIds.length, roboportCount: roboportIds.length, robotsPerPort,
      chargingSlots: roboportIds.length * (portPrototype.charging_offsets?.length || 4), chargingWatts: roboportIds.length * chargingPerPort,
      estimatedTransfersPerSecond: transfersPerSecond, estimatedMovementWatts: movementWatts,
      sizingPolicy: 'Installed base robot speed/payload, weighted producer distance, return journey, four seconds dispatch allowance and 80% capacity margin; native tests still required.'};
    const undergroundEnds = [], reach = Math.min(10, model.raw['pipe-to-ground']['pipe-to-ground'].fluid_box?.pipe_connections?.find(c => c.connection_type === 'underground')?.max_underground_distance || 10);
    function route(net, start, goals) {
      const queue = new Heap(), best = new Map(), goalPoints = new Map(goals.map(p => [key(p.x, p.y), p])), goalKeys = new Set(goalPoints.keys());
      const heuristic = p => Math.min(...goals.map(g => distance(p, g)));
      const stateKey = p => `${p.x},${p.y},${p.d},${p.jump}`;
      const initial = {...start, d: -1, jump: false, g: 0, score: heuristic(start)};
      best.set(stateKey(initial), 0); queue.push(initial);
      function usable(x, y, goalAllowed) {
        if (x < -2 || y < 1 || x > maxX || y > maxY) return false;
        const k = key(x, y), cell = occupied.get(k);
        if (reserved.has(k)) return false;
        if (cell && !(goalAllowed && goalKeys.has(k) && cell.fluid === net.key && cell.entity.name === 'pipe')) return false;
        for (const [dx, dy] of dirs) {
          const other = occupied.get(key(x + dx, y + dy));
          if (other?.fluid && other.fluid !== net.key) return false;
          const reservation = reserved.get(key(x + dx, y + dy));
          if (reservation && reservation !== net.key) return false;
        }
        return true;
      }
      function clearTunnel(p, x, y, d) {
        const ends = [...undergroundEnds];
        for (let q = p; q?.prev; q = q.prev) if (q.span > 1) ends.push({x: q.prev.x, y: q.prev.y, inward: q.d}, {x: q.x, y: q.y, inward: (q.d + 8) % 16});
        for (const a of [{x: p.x, y: p.y, inward: d}, {x, y, inward: (d + 8) % 16}]) for (const b of ends) {
          if (b.inward !== (a.inward + 8) % 16) continue;
          const [dx, dy] = dirs.find(v => v[2] === a.inward), span = (b.x - a.x) * dx + (b.y - a.y) * dy;
          if (span > 0 && span <= reach && (dx ? b.y === a.y : b.x === a.x)) return false;
        }
        return true;
      }
      let iterations = 0;
      while (queue.a.length && iterations++ < 80000) {
        const p = queue.pop(); if (p.g !== best.get(stateKey(p))) continue;
        if (goalKeys.has(key(p.x, p.y)) && (!p.jump || goalPoints.get(key(p.x, p.y)).outward === (p.d + 8) % 16)) { const path = []; for (let q = p; q; q = q.prev) path.push(q); return path.reverse(); }
        for (const [dx, dy, d] of dirs) {
          if ((p.jump && d !== p.d) || (p.d >= 0 && d === (p.d + 8) % 16)) continue;
          function push(x, y, span, jump) {
            for (let ancestor = p; ancestor; ancestor = ancestor.prev) if (ancestor.x === x && ancestor.y === y) return;
            const g = p.g + span + (span > 1 ? 3 : 0) + (p.d >= 0 && d !== p.d ? .2 : 0), q = {x, y, d, span, jump, g, score: g + heuristic({x, y}), prev: p};
            if (g < (best.get(stateKey(q)) ?? Infinity)) { best.set(stateKey(q), g); queue.push(q); }
          }
          if (usable(p.x + dx, p.y + dy, true)) push(p.x + dx, p.y + dy, 1, false);
          const leaf = !p.prev && start.outward === d && occupied.get(key(p.x, p.y))?.entity.name === 'pipe';
          if (p.jump || (!leaf && (p.d !== d || occupied.has(key(p.x, p.y))))) continue;
          for (let span = 2; span <= reach; span++) {
            const x = p.x + dx * span, y = p.y + dy * span;
            const goalLeaf = goalPoints.get(key(x, y))?.outward === (d + 8) % 16 && occupied.get(key(x, y))?.entity.name === 'pipe';
            if (!usable(x, y, goalLeaf) || !clearTunnel(p, x, y, d)) continue;
            let blocked = false;
            for (let j = 1; j < span; j++) if (!usable(p.x + dx * j, p.y + dy * j, false)) { blocked = true; break; }
            if (blocked) push(x, y, span, true);
          }
        }
      }
      throw new Error(`Could not route ${net.id} from ${start.x},${start.y}`);
    }
    for (const net of [...nets.values()].sort((a, b) => b.points.length - a.points.length || (attempt % 2 ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)))) {
      const remaining = [...new Map(net.points.map(p => [key(p.x, p.y), p])).values()], connected = [remaining.shift()];
      while (remaining.length) {
        remaining.sort((a, b) => Math.min(...connected.map(g => distance(a, g))) - Math.min(...connected.map(g => distance(b, g))));
        const start = remaining.shift(), path = route(net, start, connected);
        if (new Set(path.map(p => key(p.x, p.y))).size !== path.length) throw new Error(`Self-crossing fluid route ${net.id}`);
        for (let i = 1; i < path.length; i++) if (path[i].span > 1) {
          path[i - 1].tunnelDirection = (path[i].d + 8) % 16; path[i].tunnelDirection = path[i].d;
          const tunnel = `${net.id}:${entities.length}:${i}`; path[i - 1].tunnel = tunnel; path[i].tunnel = tunnel;
        }
        for (const p of path) {
          const existing = occupied.get(key(p.x, p.y));
          if (existing) {
            if (p.tunnel) {
              if (existing.fluid !== net.key || existing.entity.name !== 'pipe' || (p !== path[0] && p !== path.at(-1))) throw new Error('Unsafe underground conversion at a fluid junction.');
              Object.assign(existing.entity, {name: 'pipe-to-ground', direction: p.tunnelDirection});
              existing.entity.tags.flight_tunnel = p.tunnel;
              undergroundEnds.push({x: p.x, y: p.y, inward: (p.tunnelDirection + 8) % 16});
            }
            continue;
          }
          if (p.tunnel) {
            add('pipe-to-ground', p.x + .5, p.y + .5, {direction: p.tunnelDirection, tags: {flight_fluid: net.key, flight_tunnel: p.tunnel}});
            undergroundEnds.push({x: p.x, y: p.y, inward: (p.tunnelDirection + 8) % 16});
          } else { pipe(p.x, p.y, {id: net.id, type: 'fluid'}); connected.push({x: p.x, y: p.y}); }
        }
        connected.push(start);
      }
    }
    const operatingNotes = [`Add ${logistics.robotCount} logistic robots across ${logistics.roboportCount} saved roboports (${robotsPerPort} per port); ${logistics.chargingSlots} charging positions. Base robot speed and payload assumed.`,
      'Connect external electricity and supply every labeled input chest/pipe. Repeated input labels feed separate machine cells; displayed rates sum to total demand.',
      ...(wasteOutputs.length ? [`Continuously empty all ${wasteOutputs.length} labeled WASTE chests. Spoiled material is discarded separately and never counted as manufactured output.`] : [])];
    const blueprint = {item: 'blueprint', version: 562949958467584, label: `${plan.target.id} · ${plan.mode} · ${(plan.target.perSecond * 60).toPrecision(4)}/min`,
      description: ['Calculated installed-mod factory; native evidence is separate.', 'Requires researched logistic robots, requester chests, substations and display panels.',
        'Export every target and surplus output continuously.', ...operatingNotes, ...plan.assumptions, ...plan.warnings].join('\n'),
      icons: [{index: 1, signal: {type: plan.target.type, name: plan.target.id}}], entities, wires};
    const code = encodeBlueprint({blueprint}), blueprintSha256 = createHash('sha256').update(code).digest('hex');
    const spec = {prototypeSha256: model.prototypeSha256, prototypeDumpSha256: model.prototypeSha256, blueprintSha256, surface: model.surface, surfaceProperties: model.properties,
      enableAllRecipes: true, zeroResearchProductivity: true, boundaryMode: materialSeeds.length ? `${plan.mode}+startup` : plan.mode, rawOnly: plan.rawOnly, inputs, outputs, wasteOutputs, machineIds, roboportIds, powerPoleIds, powerPoleId: powerPoleIds[0], expectedEntityCount: entities.length,
      infrastructureSeeds: roboportIds.map(entityNumber => ({entityNumber, item: 'logistic-robot', count: robotsPerPort})), warmupTicks: 54000, measurementTicks: 108000, measurementWindows: 3,
      materialSeeds, startupStock: plan.startupStock.map(s => ({...s, amount: materialSeeds.filter(p => p.type === s.type && p.name === s.id).reduce((n, p) => n + p.count, 0)})), stochastic: plan.stochastic,
      stochasticSurplus: plan.stochasticSurplus, stochasticDependencyAudit: plan.stochasticDependencyAudit,
      boundaryPolicy: 'Only declared boundary chests/pipes; no direct machine or intermediate injection; drain declared outputs only. Material startup seeds supplied once at dedicated boundary chests.'};
    return {status: 'generated', code, blueprint, blueprintSha256, inputs, outputs, wasteOutputs, logistics, operatingNotes, spec};
  } catch (error) {
    return {status: 'unsupported', reason: error.message};
  }
}
