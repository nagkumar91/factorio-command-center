// Luna compact builds: the 180 and 360 per minute circuit cells and the 90 per minute red science cell.
// Tile coordinates are whole numbers; an entity's blueprint position is its tile centre.
// Inserter direction is the side it picks up from (0 north, 4 east, 8 south, 12 west); belts point where they move.
const VERSION = 562949954994176;
const N = 0, E = 4, S = 8, W = 12;

function board(label) {
  const entities = [], wires = [];
  const add = (name, x, y, extra = {}, size = 1) => {
    const entity_number = entities.length + 1;
    const e = {entity_number, name, position: {x: x + size / 2, y: y + size / 2}, ...extra};
    e.tags = {...e.tags, flight_entity: entity_number};
    entities.push(e);
    return e;
  };
  const tools = {
    add,
    belt: (x, y, direction, tags = {}) => add('transport-belt', x, y, {direction, tags}),
    under: (x, y, direction, type) => add('underground-belt', x, y, {direction, type}),
    arm: (x, y, direction, name = 'fast-inserter') => add(name, x, y, {direction, override_stack_size: 1}),
    machine: (x, y, recipe) => add('assembling-machine-2', x, y, {recipe}, 3),
    pole: (x, y) => add('medium-electric-pole', x, y),
    panel: (x, y, item, text) => add('display-panel', x, y, {icon: {type: 'item', name: item}, text, always_show: true, show_in_chart: true}),
    wire: (a, b) => wires.push([a.entity_number, 5, b.entity_number, 5]),
  };
  const blueprint = () => ({blueprint: {item: 'blueprint', label, version: VERSION, entities, wires}});
  return {entities, wires, blueprint, ...tools};
}
const port = (item, e) => ({type: 'item', name: item, entityNumber: e.entity_number, position: e.position});

/** One 180 per minute circuit cell drawn at column offset ox on a shared board. */
function circuitCell(b, ox, floor) {
  const inputs = [], outputs = [];
  // Copper lane along the top: three cable machines, one arm each (1.5 plates per second).
  const copper = b.belt(ox, 0, E, {flight_input: 'item:copper-plate'});
  for (let x = 1; x <= 6; x++) b.belt(ox + x, 0, E);
  b.panel(ox, 1, 'copper-plate', 'IN copper-plate\n270/min');
  for (const [x, armX] of [[0, 2], [3, 4], [6, 6]]) { b.machine(ox + x, 2, 'copper-cable'); b.arm(ox + armX, 1, N); }
  // Six hand-offs, one cable each per craft: every arm carries 1.5 cable per second and each
  // circuit machine has three of them (4.5 per second). Hand size is pinned to one so that
  // inserter capacity research cannot let one circuit machine take the middle cable machine's whole output.
  for (const x of [1, 2, 3, 5, 6, 7]) b.arm(ox + x, 5, N);
  for (const [x, ironX, outX] of [[1, 1, 3], [5, 5, 7]]) {
    b.machine(ox + x, 6, 'electronic-circuit');
    b.arm(ox + ironX, 9, S);
    b.arm(ox + outX, 9, N);
    const chest = b.add('iron-chest', ox + outX, 10, {tags: {flight_output: 'item:electronic-circuit'}});
    outputs.push({...port('electronic-circuit', chest), minPerMinute: floor});
  }
  // Iron lane along the bottom dives under the first output chest.
  const iron = b.belt(ox, 10, E, {flight_input: 'item:iron-plate'});
  b.belt(ox + 1, 10, E); b.under(ox + 2, 10, E, 'input'); b.under(ox + 4, 10, E, 'output'); b.belt(ox + 5, 10, E);
  b.panel(ox, 9, 'iron-plate', 'IN iron-plate\n180/min');
  const top = b.pole(ox + 5, 1), middle = b.pole(ox + 4, 7);
  b.wire(top, middle);
  inputs.push(port('copper-plate', copper), port('iron-plate', iron));
  return {inputs, outputs, top, middle};
}

export function circuits180() {
  const b = board('Luna compact circuits · 180/min · direct hand-off');
  const cell = circuitCell(b, 0, 180);
  return {id: 'luna-circuits-180', blueprint: b.blueprint(), spec: {id: 'luna-circuits-180', boundaryMode: 'intermediary', inputs: cell.inputs, outputs: cell.outputs, powerPoleId: cell.top.entity_number, enableAllRecipes: true}};
}

export function circuits360() {
  const b = board('Luna compact circuits · 360/min · direct hand-off pair');
  const left = circuitCell(b, 0, 360), right = circuitCell(b, 9, 360);
  b.wire(left.middle, right.middle);
  return {id: 'luna-circuits-360', blueprint: b.blueprint(), spec: {id: 'luna-circuits-360', boundaryMode: 'intermediary', inputs: [...left.inputs, ...right.inputs], outputs: [...left.outputs, ...right.outputs], powerPoleId: left.top.entity_number, enableAllRecipes: true}};
}

/** Red science 90 per minute: the qualified shared-lane layout with its two empty edge columns removed.
 * The iron entrance is the corner belt itself (still entered from the west, same row), and the
 * east pole moves into the free inserter-row tile beside the last science pair. */
export function redScience90() {
  const entities = [], wires = [];
  const add = (name, x, y, extra = {}) => {
    const entity_number = entities.length + 1;
    const e = {entity_number, name, position: {x, y}, ...extra};
    e.tags = {...e.tags, flight_entity: entity_number};
    entities.push(e);
    return e;
  };
  const belt = (x, y, direction = E, tags = {}) => add('transport-belt', x, y, {direction, tags});
  const fast = (x, y, direction) => add('fast-inserter', x, y, {direction});
  const pole = (x, y) => add('medium-electric-pole', x, y);
  const panel = (x, y, item, text) => add('display-panel', x, y, {icon: {type: 'item', name: item}, text, always_show: true, show_in_chart: true});
  const connect = (a, b) => wires.push([a.entity_number, 5, b.entity_number, 5]);
  // Shared eastbound trunk: copper side-loads from the north at x=-1.5, gears from the south at x=-3.5,
  // so the two ingredients ride opposite lanes past every science pickup.
  for (let x = -5.5; x <= 13.5; x += 1) belt(x, -0.5, E, x === -1.5 || x === -3.5 ? {flight_shared_junction: true} : {});
  const copper = belt(-1.5, -4.5, S, {flight_input: 'item:copper-plate'});
  for (const y of [-3.5, -2.5, -1.5]) belt(-1.5, y, S);
  panel(-2.5, -4.5, 'copper-plate', 'IN copper-plate\n90/min');
  // Iron enters from the west into the corner belt and climbs one tile; two bulk arms feed the gear machine.
  const iron = belt(-6.5, 4.5, N, {flight_input: 'item:iron-plate'});
  belt(-6.5, 3.5, N);
  panel(-6.5, 5.5, 'iron-plate', 'IN iron-plate\n180/min\nfrom the west');
  add('assembling-machine-2', -3.5, 4.5, {recipe: 'iron-gear-wheel'});
  add('bulk-inserter', -5.5, 4.5, {direction: W});
  add('bulk-inserter', -5.5, 3.5, {direction: W});
  fast(-3.5, 2.5, S);
  belt(-3.5, 1.5, N);
  belt(-3.5, 0.5, N);
  for (const x of [0.5, 3.5, 6.5, 9.5, 12.5]) {
    add('assembling-machine-2', x, -3.5, {recipe: 'automation-science-pack'});
    fast(x, -1.5, S);
    fast(x, -5.5, S);
    add('assembling-machine-2', x, 2.5, {recipe: 'automation-science-pack'});
    fast(x, 0.5, N);
    fast(x, 4.5, N);
  }
  for (let x = 0.5; x <= 12.5; x += 1) belt(x, -6.5);
  for (let x = 0.5; x <= 12.5; x += 1) belt(x, 5.5);
  const north = belt(13.5, -6.5, E, {flight_output: 'item:automation-science-pack'});
  const south = belt(13.5, 5.5, E, {flight_output: 'item:automation-science-pack'});
  const gearPole = pole(-5.5, 1.5);
  const mid = [2.5, 8.5, 13.5].map(x => pole(x, -1.5));
  const top = [1.5, 7.5, 13.5].map(x => pole(x, -5.5));
  const bottom = [1.5, 7.5, 13.5].map(x => pole(x, 4.5));
  connect(gearPole, mid[0]); connect(mid[0], mid[1]); connect(mid[1], mid[2]); connect(mid[2], top[2]);
  connect(top[2], top[1]); connect(top[1], top[0]); connect(mid[0], bottom[0]); connect(bottom[0], bottom[1]); connect(bottom[1], bottom[2]);
  const blueprint = {blueprint: {item: 'blueprint', label: 'Luna compact red science · 90/min · shared lane', version: VERSION, entities, wires}};
  const outputs = [north, south].map(e => ({...port('automation-science-pack', e), minPerMinute: 90}));
  return {id: 'luna-red-science-90', blueprint, spec: {id: 'luna-red-science-90', boundaryMode: 'intermediary', inputs: [port('copper-plate', copper), port('iron-plate', iron)], outputs, powerPoleId: gearPole.entity_number, enableAllRecipes: true}};
}
