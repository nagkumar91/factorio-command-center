// Deterministically remove redundant medium poles from a generated power
// workshop while preserving every non-pole entity and route.  This is a
// bounded connected-coverage optimization, not a claim of a mathematical
// minimum or a WFC result.
const poleNames = new Set(['small-electric-pole', 'medium-electric-pole', 'big-electric-pole']);

function prototypeMap(raw) {
  const map = new Map();
  for (const kind of ['assembling-machine', 'furnace', 'inserter', 'electric-pole']) {
    for (const prototype of Object.values(raw[kind] || {})) map.set(prototype.name, prototype);
  }
  return map;
}

function covers(pole, consumer, prototypes) {
  const polePrototype = prototypes.get(pole.name);
  const box = prototypes.get(consumer.name).collision_box;
  let width = (box[1][0] - box[0][0]) / 2;
  let height = (box[1][1] - box[0][1]) / 2;
  if ([4, 12].includes(consumer.direction)) [width, height] = [height, width];
  return Math.abs(pole.position.x - consumer.position.x) < polePrototype.supply_area_distance + width - 0.001
    && Math.abs(pole.position.y - consumer.position.y) < polePrototype.supply_area_distance + height - 0.001;
}

function wireReach(a, b, prototypes) {
  const distance = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
  const reach = Math.min(prototypes.get(a.name).maximum_wire_distance, prototypes.get(b.name).maximum_wire_distance);
  return distance <= reach + 0.00001;
}

function isConnected(poles, prototypes) {
  const bigIndex = poles.findIndex((pole) => pole.name === 'big-electric-pole');
  if (bigIndex < 0) return false;
  const seen = new Set([bigIndex]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < poles.length; i++) {
      if (seen.has(i)) continue;
      if ([...seen].some((j) => wireReach(poles[i], poles[j], prototypes))) {
        seen.add(i);
        changed = true;
      }
    }
  }
  return seen.size === poles.length;
}

function coversAll(poles, consumers, prototypes) {
  return consumers.every((consumer) => poles.some((pole) => covers(pole, consumer, prototypes)));
}

function poleTree(poles, prototypes) {
  const big = poles.find((pole) => pole.name === 'big-electric-pole');
  const connectedIds = new Set([big.entity_number]);
  const wires = [];
  while (connectedIds.size < poles.length) {
    const candidates = [];
    for (const a of poles) {
      if (!connectedIds.has(a.entity_number)) continue;
      for (const b of poles) {
        if (connectedIds.has(b.entity_number) || !wireReach(a, b, prototypes)) continue;
        candidates.push({
          a,
          b,
          distance: Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)
        });
      }
    }
    candidates.sort((left, right) => left.distance - right.distance
      || left.a.entity_number - right.a.entity_number
      || left.b.entity_number - right.b.entity_number);
    const edge = candidates[0];
    if (!edge) throw new Error('Cannot connect retained power poles');
    connectedIds.add(edge.b.entity_number);
    wires.push([edge.a.entity_number, 5, edge.b.entity_number, 5]);
  }
  return wires;
}

export function optimizePowerPoles(blueprint, raw) {
  const prototypes = prototypeMap(raw);
  const oldPoles = blueprint.entities.filter((entity) => poleNames.has(entity.name));
  const consumers = blueprint.entities.filter((entity) => prototypes.get(entity.name)?.energy_source?.type === 'electric');
  const big = oldPoles.find((pole) => pole.name === 'big-electric-pole');
  if (!big || oldPoles.filter((pole) => pole.name === 'big-electric-pole').length !== 1) {
    throw new Error('Expected exactly one retained big electric pole');
  }
  let poles = [...oldPoles];
  const removed = [];
  while (true) {
    const candidates = poles
      .filter((pole) => pole.name === 'medium-electric-pole')
      .map((pole) => {
        const covered = consumers.filter((consumer) => covers(pole, consumer, prototypes));
        const unique = covered.filter((consumer) => !poles.some((other) => other !== pole && covers(other, consumer, prototypes)));
        const neighbors = poles.filter((other) => other !== pole && wireReach(pole, other, prototypes)).length;
        return { pole, covered: covered.length, unique: unique.length, neighbors };
      })
      .sort((left, right) => left.unique - right.unique
        || left.covered - right.covered
        || left.neighbors - right.neighbors
        || left.pole.entity_number - right.pole.entity_number);
    let deleted = false;
    for (const candidate of candidates) {
      const next = poles.filter((pole) => pole !== candidate.pole);
      if (!coversAll(next, consumers, prototypes) || !isConnected(next, prototypes)) continue;
      poles = next;
      removed.push(candidate.pole.entity_number);
      deleted = true;
      break;
    }
    if (!deleted) break;
  }
  if (!coversAll(poles, consumers, prototypes) || !isConnected(poles, prototypes)) throw new Error('Optimized graph failed static power checks');

  const oldPoleIds = new Set(oldPoles.map((pole) => pole.entity_number));
  const nonPoleEntities = blueprint.entities.filter((entity) => !oldPoleIds.has(entity.entity_number));
  const nextEntities = [...nonPoleEntities, ...poles].sort((a, b) => a.entity_number - b.entity_number);
  const nonPoleWires = (blueprint.wires || []).filter((wire) => !oldPoleIds.has(wire[0]) && !oldPoleIds.has(wire[2]));
  const nextBlueprint = { ...blueprint, entities: nextEntities, wires: [...nonPoleWires, ...poleTree(poles, prototypes)] };
  blueprint.entities = nextBlueprint.entities;
  blueprint.wires = nextBlueprint.wires;
  return {
    oldMediumPoles: oldPoles.filter((pole) => pole.name === 'medium-electric-pole').length,
    mediumPoles: poles.filter((pole) => pole.name === 'medium-electric-pole').length,
    removed,
    consumers: consumers.length
  };
}
