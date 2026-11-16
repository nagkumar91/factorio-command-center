/** Local LDS workshop: 10 unmoduled AM2s, dedicated copper, controlled stock loop. */
import assert from 'node:assert/strict';
import {powerStarterLayout, starterBounds} from '../science-factory/local-ports/compact-shared-layout.mjs';

export function makeLDS(raw) {
  const entities = [], wires = [], ports = [], loop = [], controlled = [];
  const add = (name, x, y, extra = {}) => {
    const entity_number = entities.length + 1;
    const e = {entity_number, name, position: {x: x + .5, y: y + .5}, ...extra,
      tags: {...extra.tags, flight_science_entity: entity_number}};
    entities.push(e); return e;
  };
  const belt = (x, y, direction) => add('fast-transport-belt', x, y, {direction});
  const wire = (a, b) => wires.push([a.entity_number, 1, b.entity_number, 1]);
  const filter = item => ({use_filters: true, filters: [{index: 1, name: item, quality: 'normal', comparator: '='}]});
  const arm = (x, y, direction, item) => add('fast-inserter', x, y,
    {direction, override_stack_size: 1, ...(item ? filter(item) : {})});
  const port = (kind, item, e, externalSide, perMinute) => ports.push({kind, item,
    items: item ? [item] : [], entity: e.entity_number, x: e.position.x, y: e.position.y,
    position: {...e.position}, externalSide, perMinute});
  const limits = {'steel-plate': 32, 'plastic-bar': 64, 'low-density-structure': 12};
  const control = (e, item, near) => {
    e.control_behavior = {circuit_enabled: true, circuit_condition: {
      first_signal: {type: 'item', name: item, quality: 'normal'}, comparator: '<', constant: limits[item]}};
    wire(e, near); controlled.push(e.entity_number);
  };
  const width = 20;
  for (let x = 0; x <= width; x++) loop.push(belt(x, 0, 4));
  loop.push(belt(width, 3, 12));
  for (let x = width - 1; x >= 0; x--) loop.push(belt(x, 3, x === 0 ? 0 : 12));
  for (let y = 2; y >= 1; y--) loop.push(belt(0, y, 0));
  for (let i = 0; i < loop.length; i++) wire(loop[i], loop[(i + 1) % loop.length]);
  const reader = loop[0];
  reader.control_behavior = {circuit_read_hand_contents: true, circuit_contents_read_mode: 2};
  // Split and independently side-load both lanes: avoids permanent lane starvation.
  add('fast-splitter', width + 1, 1, {position: {x: width + 1.5, y: 1}, direction: 4});
  for (const [dx, dy, d] of [[2,0,4],[3,0,8],[3,1,8],[3,2,8],[3,3,12],[2,3,12],[1,3,12],[2,1,8],[2,5,4],[3,5,0],[3,4,0]]) {
    const e = belt(width + dx, dy, d);
    wire(e, [...loop].sort((a,b) => Math.hypot(a.position.x-e.position.x,a.position.y-e.position.y)-Math.hypot(b.position.x-e.position.x,b.position.y-e.position.y))[0]);
    loop.push(e);
  }
  add('fast-underground-belt', 22, 2, {direction: 8, type: 'input', tags: {tunnel: 'loop'}});
  add('fast-underground-belt', 22, 4, {direction: 8, type: 'output', tags: {tunnel: 'loop'}});
  for (const top of [true, false]) for (let i = 0; i < 5; i++) {
    const x = 4 + i * 3, y = top ? -3 : 6, inner = top ? -1 : 4;
    add('assembling-machine-2', x, y, {recipe: 'low-density-structure'});
    arm(x - 1, inner, top ? 8 : 0); arm(x, inner, top ? 8 : 0);
    const out = arm(x + 1, inner, top ? 0 : 8, 'low-density-structure');
    control(out, 'low-density-structure', loop.find(e => e.position.x === x + 1.5 && e.position.y === (top ? .5 : 3.5)));
    arm(x, top ? -5 : 8, top ? 0 : 8, 'copper-plate');
  }
  const copper = belt(-2, -6, 4); belt(-1, -6, 4);
  add('fast-splitter', 0, -5, {position: {x: .5, y: -5}, direction: 4});
  for (let x = 1; x <= 17; x++) belt(x, -6, 4);
  belt(1, -5, 8);
  for (const [a,b] of [[-4,1],[2,8]]) {
    add('fast-underground-belt', 1, a, {direction: 8, type: 'input', tags: {tunnel: 'copper-'+a}});
    add('fast-underground-belt', 1, b, {direction: 8, type: 'output', tags: {tunnel: 'copper-'+a}});
  }
  for (let x = 1; x <= 17; x++) belt(x, 9, 4);
  port('input', 'copper-plate', copper, 'west', 600);
  const steel = belt(-2, 0, 4);
  control(arm(-1, 0, 12, 'steel-plate'), 'steel-plate', reader);
  port('input', 'steel-plate', steel, 'west', 60);
  const plastic = belt(-2, 1, 8); belt(-2, 2, 4);
  for (const y of [1, 2]) control(arm(-1, y, 12, 'plastic-bar'), 'plastic-bar', loop.find(e => e.position.x === .5 && e.position.y === y + .5));
  port('input', 'plastic-bar', plastic, 'west', 150);
  const output = add('passive-provider-chest', 25, 3, {bar: 1});
  arm(24, 3, 12, 'low-density-structure');
  port('output', 'low-density-structure', output, 'east', 30);
  ports.push({kind: 'power', item: 'electricity', items: ['electricity'], entity: 0,
    x: 0, y: 0, position: {x: 0, y: 0}, externalSide: 'north', perMinute: 0});
  const helperRaw = {...raw, container: {...raw['logistic-container'], ...raw.container}};
  const bp = {entities, wires}; powerStarterLayout(bp, ports, helperRaw); bp.wires.push(...wires);
  for (const e of bp.entities) e.tags = {...e.tags, flight_science_entity: e.entity_number};
  for (const p of ports) p.position = {x: p.x, y: p.y};
  const capacity = loop.length * 8, maximumStock = Object.values(limits).reduce((a,b) => a+b,0);
  assert(maximumStock < capacity * .75);
  return {entities: bp.entities, wires: bp.wires, ports,
    loopControl: [{name: 'LDS', reader: reader.entity_number, controlled, loop: loop.map(e => e.entity_number), limits, capacity, maximumStock, width}],
    machineCounts: {'low-density-structure': 10}, footprint: starterBounds(bp.entities, helperRaw)};
}
