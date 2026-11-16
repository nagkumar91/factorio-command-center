import {makeRingBlock} from '../rgby-science/blocks.mjs';
import {starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

/** AM2 finishing block; modules are products, never installed in machines.
 * Rates at 30 science/min: iron 75, steel 250, stone 150, brick 100,
 * green circuits 50, advanced circuits 100. Six commodities enter through seven west belt ports.
 * Bulk inserters use only the native harness's unlock baseline (no later capacity upgrades).
 */
export function makePurple(raw) {
  raw = {...raw, container: {...raw.container, ...raw['logistic-container']}};
  const c = makeRingBlock(raw, {
    id: 'purple', balanced: true,
    top: Array(5).fill('production-science-pack'),
    inside: [...Array(4).fill('productivity-module'), 'iron-stick'],
    bottom: ['electric-furnace', 'electric-furnace', 'rail', 'rail'],
    feeds: [
      {item: 'steel-plate', arms: 2, perMinute: 150},
      {item: 'stone', perMinute: 150},
      {item: 'stone-brick', perMinute: 100},
      {item: 'advanced-circuit', perMinute: 100},
      {item: 'electronic-circuit', perMinute: 50},
    ],
    products: ['production-science-pack'],
    // Keep enough rails for several simultaneous 30-rail crafts, but leave
    // substantial empty loop capacity even after bulk-hand overshoot.
    limits: {
      'steel-plate': 24, stone: 12, 'stone-brick': 12,
      'advanced-circuit': 12, 'electronic-circuit': 8, 'iron-plate': 8,
      'iron-stick': 8, rail: 48, 'electric-furnace': 4,
      'productivity-module': 4, 'production-science-pack': 6,
    },
  });
  // A seventh admission uses the southwest corner without enlarging the ring.
  let next = Math.max(...c.entities.map(e => e.entity_number)) + 1;
  const add = (name, x, y, extra = {}) => {
    const e = {entity_number: next++, name, position: {x, y}, ...extra};
    e.tags = {flight_science_entity: e.entity_number};
    c.entities.push(e);
    return e;
  };
  const iron = add('fast-transport-belt', -2.5, 8.5, {direction: 4});
  for (const x of [-1.5, -.5, .5]) add('fast-transport-belt', x, 8.5, {direction: 4});
  const arm = add('fast-inserter', .5, 7.5, {
    direction: 8, use_filters: true,
    filters: [{index: 1, name: 'iron-plate', quality: 'normal', comparator: '='}],
    control_behavior: {circuit_enabled: true, circuit_condition: {
      first_signal: {type: 'item', name: 'iron-plate', quality: 'normal'},
      comparator: '<', constant: 8,
    }},
  });
  c.wires.push([arm.entity_number, 1, c.loopControl[0].reader, 1]);
  c.loopControl[0].controlled.push(arm.entity_number);
  c.ports.push({kind: 'input', label: 'iron-plate', item: 'iron-plate',
    items: ['iron-plate'], entity: iron.entity_number, ...iron.position,
    position: {...iron.position}, direction: 4, externalSide: 'west', perMinute: 75});
  // Rail assemblers consume three separate ingredients at high craft rates;
  // two pickup positions avoid a single mixed-belt inserter becoming the limit.
  for (const m of c.entities.filter(e => e.name === 'assembling-machine-2' &&
      ['rail', 'electric-furnace', 'production-science-pack', 'productivity-module', 'iron-stick'].includes(e.recipe))) {
    const y = m.position.y < 0 ? -.5 : m.position.y < 6 ? 1.5 : 7.5;
    const first = c.entities.find(e => e.name === 'fast-inserter' &&
      e.position.x === m.position.x - 1 && e.position.y === y);
    add('fast-inserter', m.position.x, y, {
      direction: first.direction, use_filters: true,
      filters: structuredClone(first.filters),
    });
  }
  for (const e of c.entities) {
    if (e.name === 'fast-inserter') {
      e.name = 'bulk-inserter';
      e.override_stack_size = 4;
    }
  }
  // Furnaces receive heavy steel directly at the rear, leaving rail steel
  // on the shared loop. This avoids downstream furnace starvation.
  const furnaceSteel = add('fast-transport-belt', -2.5, 12.5, {direction: 4});
  for (let x = -1.5; x <= 6.5; x++) add('fast-transport-belt', x, 12.5, {direction: 4});
  for (const m of c.entities.filter(e => e.recipe === 'electric-furnace')) {
    add('bulk-inserter', m.position.x, 11.5, {direction: 8, override_stack_size: 4,
      use_filters: true, filters: [{index: 1, name: 'steel-plate', quality: 'normal', comparator: '='}]});
    for (const e of c.entities.filter(e => e.position.y === 7.5 &&
        [m.position.x - 1, m.position.x].includes(e.position.x))) {
      e.filters = e.filters.filter(f => f.name !== 'steel-plate').map((f, i) => ({...f, index: i + 1}));
    }
  }
  c.ports.push({kind: 'input', label: 'furnace steel', item: 'steel-plate', items: ['steel-plate'],
    entity: furnaceSteel.entity_number, x: -2.5, y: 12.5, position: {...furnaceSteel.position},
    direction: 4, externalSide: 'west', perMinute: 100});
  // Extend the circulation runway five tiles: high-rate ingredients need
  // enough in-flight stock for the entire lap, with room for bulk overshoot.
  for (const e of c.entities) {
    if (e.position.x >= 18.5 || (e.position.x === 17.5 && e.position.y >= 7.5))
      e.position.x += 5;
  }
  for (const y of [.5, 6.5]) {
    let previous = c.entities.find(e => e.position.x === 17.5 && e.position.y === y);
    for (let x = 18.5; x <= 22.5; x++) {
      const belt = add('fast-transport-belt', x, y, {direction: y === .5 ? 4 : 12});
      c.wires.push([previous.entity_number, 1, belt.entity_number, 1]);
      c.loopControl[0].loop.push(belt.entity_number);
      previous = belt;
    }
    const end = c.entities.find(e => e.position.x === 23.5 && e.position.y === y);
    c.wires.push([previous.entity_number, 1, end.entity_number, 1]);
  }
  for (const p of c.ports) {
    const e = c.entities.find(e => e.entity_number === p.entity);
    p.x = e.position.x; p.y = e.position.y; p.position = {...e.position};
  }
  // Dedicated rail steel uses ordinary long-handed inserters at the rear;
  // two per assembler avoid requiring any capacity research upgrades.
  const loopSteelPort = c.ports.find(p => p.kind === 'input' && p.item === 'steel-plate');
  const loopSteelIds = new Set(c.entities.filter(e =>
    (e.position.x === -2.5 && e.position.y === 1.5) ||
    (e.position.x === -1.5 && [1.5, 2.5].includes(e.position.y)) ||
    (e.position.x === -.5 && [1.5, 2.5].includes(e.position.y))).map(e => e.entity_number));
  c.entities = c.entities.filter(e => !loopSteelIds.has(e.entity_number));
  c.wires = c.wires.filter(w => !loopSteelIds.has(w[0]) && !loopSteelIds.has(w[2]));
  c.loopControl[0].controlled = c.loopControl[0].controlled.filter(id => !loopSteelIds.has(id));
  const railSteel = add('fast-transport-belt', -2.5, 13.5, {direction: 4});
  for (let x = -1.5; x <= 12.5; x++) add('fast-transport-belt', x, 13.5, {direction: 4});
  Object.assign(loopSteelPort, {entity: railSteel.entity_number, x: -2.5, y: 13.5,
    position: {...railSteel.position}});
  for (const m of c.entities.filter(e => e.recipe === 'rail')) {
    for (const x of [m.position.x - 1, m.position.x]) add('long-handed-inserter', x, 11.5,
      {direction: 8, override_stack_size: 1});
    for (const e of c.entities.filter(e => e.position.y === 7.5 &&
        [m.position.x - 1, m.position.x].includes(e.position.x))) {
      e.filters = e.filters.filter(f => f.name !== 'steel-plate').map((f, i) => ({...f, index: i + 1}));
    }
  }
  const stick = c.entities.find(e => e.recipe === 'iron-stick');
  add('bulk-inserter', stick.position.x, 5.5, {direction: 8, override_stack_size: 4,
    use_filters: true, filters: [{index: 1, name: 'iron-plate', quality: 'normal', comparator: '='}]});
  // One baseline bulk arm admits about 150 stone/min, leaving no headroom.
  // Reuse the vacant upper steel row for a second admission from this port.
  c.entities.find(e => e.position.x === -1.5 && e.position.y === 3.5).direction = 0;
  add('fast-transport-belt', -1.5, 2.5, {direction: 4});
  const stoneArm = add('bulk-inserter', -.5, 2.5, {direction: 12, override_stack_size: 4,
    use_filters: true, filters: [{index: 1, name: 'stone', quality: 'normal', comparator: '='}],
    control_behavior: {circuit_enabled: true, circuit_condition: {
      first_signal: {type: 'item', name: 'stone', quality: 'normal'}, comparator: '<', constant: 64,
    }}});
  c.wires.push([stoneArm.entity_number, 1, c.loopControl[0].reader, 1]);
  c.loopControl[0].controlled.push(stoneArm.entity_number);
  const limits = {stone: 64, 'stone-brick': 64,
    'advanced-circuit': 40, 'electronic-circuit': 24, 'iron-plate': 40,
    'iron-stick': 40, 'electric-furnace': 6,
    'productivity-module': 6, 'production-science-pack': 6};
  for (const e of c.entities) {
    const condition = e.control_behavior?.circuit_condition;
    if (condition?.comparator === '<') condition.constant = limits[condition.first_signal.name];
  }
  Object.assign(c.loopControl[0], {limits, capacity: c.loopControl[0].capacity + 80,
    maximumStock: Object.values(limits).reduce((sum, n) => sum + n, 0)});
  // Rails bypass the mixed loop: rear output belt supplies the five science
  // assemblers from the north and backs up naturally when science is blocked.
  const rails = c.entities.filter(e => e.recipe === 'rail');
  const removed = new Set(rails.map(m => c.entities.find(e => e.name === 'bulk-inserter' &&
    e.position.x === m.position.x + 1 && e.position.y === 7.5).entity_number));
  c.entities = c.entities.filter(e => !removed.has(e.entity_number));
  c.wires = c.wires.filter(w => !removed.has(w[0]) && !removed.has(w[2]));
  c.loopControl[0].controlled = c.loopControl[0].controlled.filter(id => !removed.has(id));
  const railFilter = [{index: 1, name: 'rail', quality: 'normal', comparator: '='}];
  for (const m of rails) add('bulk-inserter', m.position.x + 1, 11.5,
    {direction: 0, override_stack_size: 4, use_filters: true, filters: structuredClone(railFilter)});
  for (let x = 10.5; x <= 21.5; x++) add('fast-transport-belt', x, 12.5,
    {direction: x === 21.5 ? 0 : 4});
  for (const y of [11.5, 10.5, 9.5, 4.5, 3.5, 2.5, -2.5, -3.5, -4.5])
    add('fast-transport-belt', 21.5, y, {direction: 0});
  for (const [y, type] of [[8.5, 'input'], [5.5, 'output'], [1.5, 'input'], [-1.5, 'output']])
    add('fast-underground-belt', 21.5, y, {direction: 0, type});
  for (let x = 21.5; x >= 3.5; x--) add('fast-transport-belt', x, -5.5, {direction: 12});
  for (const m of c.entities.filter(e => e.recipe === 'production-science-pack')) {
    add('bulk-inserter', m.position.x, -4.5,
      {direction: 0, override_stack_size: 4, use_filters: true, filters: structuredClone(railFilter)});
    for (const e of c.entities.filter(e => e.position.y === -.5 &&
        [m.position.x - 1, m.position.x].includes(e.position.x))) {
      e.filters = e.filters.filter(f => f.name !== 'rail').map((f, i) => ({...f, index: i + 1}));
    }
  }
  c.footprint = starterBounds(c.entities, raw);
  return c;
}
