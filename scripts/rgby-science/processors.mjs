/** Local processor workshop: five normal AM2s, rear acid manifold, stock loop.
 * Coordinates are tile centers. No construction supplies or native test fixtures.
 * Bulk inserters are used ONLY for the two green-circuit admissions; all other
 * arms are fast inserters. Requires the bulk-inserter unlock (base hand capacity 2), no later capacity upgrades.
 */
export function makeProcessors(raw) {
  for (const [type, name] of [
    ['assembling-machine', 'assembling-machine-2'], ['inserter', 'fast-inserter'],
    ['inserter', 'bulk-inserter'], ['transport-belt', 'fast-transport-belt'],
    ['pipe', 'pipe'], ['logistic-container', 'passive-provider-chest'],
    ['electric-pole', 'medium-electric-pole'],
  ]) if (!raw?.[type]?.[name]) throw new Error(`Missing prototype: ${name}`);
  const recipe = raw.recipe?.['processing-unit'];
  const output = recipe?.results?.find(p => p.name === 'processing-unit');
  const speed = raw['assembling-machine']['assembling-machine-2'].crafting_speed;
  if (!(recipe?.energy_required > 0 && output?.amount > 0 && speed > 0))
    throw new Error('Missing processing-unit recipe rates');
  const capacityPerMinute = 5 * 60 * speed * output.amount / recipe.energy_required;
  const demand = Object.fromEntries(recipe.ingredients.map(i => [i.name, capacityPerMinute * i.amount / output.amount]));
  const entities = [], wires = [], ports = [], loop = [], controlled = [], occupied = new Set();
  const add = (name, x, y, extra = {}) => {
    const size = name === 'assembling-machine-2' ? 3 : 1;
    for (let dx = -(size >> 1); dx <= size >> 1; dx++) for (let dy = -(size >> 1); dy <= size >> 1; dy++) {
      const key = `${x + dx},${y + dy}`;
      if (occupied.has(key)) throw new Error(`Processor collision at ${key}`);
      occupied.add(key);
    }
    const entity_number = entities.length + 1;
    const e = {entity_number, name, position: {x: x + 0.5, y: y + 0.5}, ...extra,
      tags: {flight_science_entity: entity_number}};
    entities.push(e); return e;
  };
  const belt = (x, y, direction) => add('fast-transport-belt', x, y, {direction});
  const red = (a, b) => wires.push([a.entity_number, 1, b.entity_number, 1]);
  const limits = {'electronic-circuit': 96, 'advanced-circuit': 16, 'processing-unit': 8};
  const filter = item => ({use_filters: true, filters: [{index: 1, name: item, quality: 'normal', comparator: '='}]});
  const control = (e, item, near) => {
    e.control_behavior = {circuit_enabled: true, circuit_condition: {
      first_signal: {type: 'item', name: item, quality: 'normal'}, comparator: '<', constant: limits[item]}};
    red(e, near); controlled.push(e.entity_number);
  };
  const port = (kind, item, entity, externalSide, perMinute) => {
    ports.push({kind, item, items: [item], entity: entity.entity_number,
      x: entity.position.x, y: entity.position.y, position: {...entity.position},
      externalSide, perMinute, ...(kind === 'input' ? {direction: 4} : {})});
  };
  // Clockwise top, anticlockwise bottom; return travels north on the west edge.
  for (let x = 0; x <= 17; x++) loop.push(belt(x, 0, x === 17 ? 8 : 4));
  for (let y = 1; y <= 3; y++) loop.push(belt(17, y, y === 3 ? 12 : 8));
  for (let x = 16; x >= 0; x--) loop.push(belt(x, 3, x === 0 ? 0 : 12));
  for (let y = 2; y >= 1; y--) loop.push(belt(0, y, 0));
  const at = (x, y) => loop.find(e => e.position.x === x + 0.5 && e.position.y === y + 0.5);
  for (let i = 0; i < loop.length; i++) red(loop[i], loop[(i + 1) % loop.length]);
  const reader = loop[0];
  reader.control_behavior = {circuit_read_hand_contents: true, circuit_contents_read_mode: 2};
  for (const x of [3, 6, 9, 12, 15]) {
    add('assembling-machine-2', x, -3, {recipe: 'processing-unit', direction: 0});
    for (const dx of [-1, 0]) add('fast-inserter', x + dx, -1, {direction: 8});
    const arm = add('fast-inserter', x + 1, -1, {direction: 0, ...filter('processing-unit')});
    control(arm, 'processing-unit', at(x + 1, 0));
  }
  // One west input branches to two independent bulk admissions, without upgrades.
  const green = belt(-4, 2, 4); belt(-3, 2, 4); belt(-2, 2, 0); belt(-2, 1, 0);
  const greenAdmission = [];
  for (const y of [1, 2]) {
    const arm = add('bulk-inserter', -1, y, {direction: 12, ...filter('electronic-circuit')});
    control(arm, 'electronic-circuit', at(0, y)); greenAdmission.push(arm.entity_number);
  }
  port('input', 'electronic-circuit', green, 'west', demand['electronic-circuit']);
  const advanced = belt(-4, 3, 4); belt(-3, 3, 4); belt(-2, 3, 4);
  const redArm = add('fast-inserter', -1, 3, {direction: 12, ...filter('advanced-circuit')});
  control(redArm, 'advanced-circuit', at(0, 3));
  port('input', 'advanced-circuit', advanced, 'west', demand['advanced-circuit']);
  let acid;
  for (let x = -4; x <= 15; x++) {
    const pipe = add('pipe', x, -5); if (x === -4) acid = pipe;
  }
  port('fluid', 'sulfuric-acid', acid, 'west', demand['sulfuric-acid']);
  add('fast-inserter', 18, 1, {direction: 12, ...filter('processing-unit')});
  const chest = add('passive-provider-chest', 19, 1, {bar: 1});
  port('output', 'processing-unit', chest, 'east', capacityPerMinute);
  const poles = [1, 5, 9, 13, 16].map(x => add('medium-electric-pole', x, 1));
  for (let i = 1; i < poles.length; i++) wires.push([poles[i - 1].entity_number, 5, poles[i].entity_number, 5]);
  return {
    entities, wires, ports,
    loopControl: [{name: 'Processors', reader: reader.entity_number, controlled,
      loop: loop.map(e => e.entity_number), limits, capacity: loop.length * 8,
      maximumStock: Object.values(limits).reduce((a, b) => a + b, 0), width: 17, height: 3,
      admission: {item: 'electronic-circuit', inserter: 'bulk-inserter', entities: greenAdmission,
        baseHandCapacity: 1 + (raw.technology?.['bulk-inserter']?.effects ?? []).filter(e => e.type === 'bulk-inserter-capacity-bonus').reduce((n, e) => n + e.modifier, 0),
        requiredTechnology: 'bulk-inserter', laterCapacityUpgrades: false,
        note: 'The bulk-inserter unlock itself grants +1 capacity in installed 2.1.24; two items per hand, with no later capacity upgrades.'}}],
    machineCounts: {'processing-unit': 5},
    footprint: {left: -4, top: -5, right: 20, bottom: 4, width: 24, height: 9},
    capacityPerMinute, powerPoleIds: poles.map(e => e.entity_number),
  };
}
