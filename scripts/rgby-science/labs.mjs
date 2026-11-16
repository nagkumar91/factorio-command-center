/** Compact, local-coordinate RGB + utility lab consumer. No supply fixtures. */
export function makeLabAnnex(raw, {
  columns = 15, rows = 2, sciencePerMinute = 30,
  researchSeconds = rows === 1 ? 30 : 60, researchSpeed = 1,
} = {}) {
  if (!Number.isInteger(columns) || columns < 1 || ![1, 2].includes(rows))
    throw new RangeError('columns must be a positive integer; rows must be 1 or 2');
  for (const value of [sciencePerMinute, researchSeconds, researchSpeed])
    if (!Number.isFinite(value) || value <= 0) throw new RangeError('Research parameters must be positive finite numbers');
  for (const [type, name] of [['lab', 'lab'], ['transport-belt', 'fast-transport-belt'],
    ['inserter', 'fast-inserter'], ['inserter', 'long-handed-inserter'], ['electric-pole', 'medium-electric-pole']])
    if (!raw?.[type]?.[name]) throw new Error(`Missing prototype: ${name}`);
  const entities = [], wires = [], ports = [], labs = [], poleRows = [];
  const add = (name, x, y, extra = {}) => {
    const entity_number = entities.length + 1;
    const e = {entity_number, name, position: {x, y}, ...extra,
      tags: {...extra.tags, flight_science_entity: entity_number}};
    entities.push(e); return e;
  };
  const width = columns * 3, height = rows === 2 ? 10 : 6;
  const pairs = [['automation-science-pack', 'logistic-science-pack'],
    ['chemical-science-pack', 'utility-science-pack']];
  for (let belt = 0; belt < 2; belt++) {
    const y = 4.5 + belt;
    let first;
    for (let x = 0; x < width; x++) {
      const e = add('fast-transport-belt', x + 0.5, y, {direction: 4});
      first ||= e;
    }
    ports.push({kind: 'input', label: belt === 0 ? 'Red / green mixed lanes' : 'Blue / yellow mixed lanes',
      entity: first.entity_number, entityNumber: first.entity_number,
      x: 0.5, y, position: {x: 0.5, y}, direction: 4, externalSide: 'west',
      items: [...pairs[belt]], mixedLanes: true,
      // Factorio transport line 1 is left/north when travelling east.
      lanes: pairs[belt].map((item, i) => ({lane: i + 1, side: i === 0 ? 'north' : 'south', item, perMinute: sciencePerMinute})),
      perMinute: sciencePerMinute * 2});
  }
  for (let row = 0; row < rows; row++) {
    const y = row === 0 ? 1.5 : 8.5, armY = row === 0 ? 3.5 : 6.5;
    for (let col = 0; col < columns; col++) {
      const x = 1.5 + col * 3;
      const lab = add('lab', x, y);
      const fast = add('fast-inserter', x - 1, armY, {direction: row === 0 ? 8 : 0});
      const long = add('long-handed-inserter', x, armY, {direction: row === 0 ? 8 : 0});
      labs.push({entity: lab.entity_number, row, column: col,
        inserters: [fast.entity_number, long.entity_number],
        beltPorts: ports.map(p => p.entity), mixedLanes: true,
        fastBelt: row === 0 ? 1 : 2, longHandedBelt: row === 0 ? 2 : 1});
    }
    const poles = [];
    // One pole per two labs, in the unoccupied third inserter column.
    for (let col = 0; col < columns; col += 2) poles.push(add('medium-electric-pole', 2.5 + col * 3, armY));
    for (let i = 1; i < poles.length; i++) wires.push([poles[i - 1].entity_number, 5, poles[i].entity_number, 5]);
    poleRows.push(poles);
  }
  if (rows === 2) for (let i = 0; i < poleRows[0].length; i++)
    wires.push([poleRows[0][i].entity_number, 5, poleRows[1][i].entity_number, 5]);
  const metadata = {columns, rows, labCount: columns * rows, quality: 'normal', modules: false,
    mixedLanes: true, beltPairs: ports.map(p => ({entity: p.entity, lanes: p.lanes})), labs,
    powerPoleIds: poleRows.flat().map(p => p.entity_number),
    research: {sciencePerMinute, researchSeconds, researchSpeed,
      fullyFedLabCount: Math.floor(sciencePerMinute * researchSeconds / (60 * researchSpeed)),
      formula: 'floor(SPM * time / (60 * research speed))',
      note: 'Assumes one of each pack per research unit and normal labs; speed upgrades lower the fully-fed count.'}};
  return {entities, wires, ports, footprint: {left: 0, top: 0, right: width, bottom: height, width, height},
    metadata, labCount: metadata.labCount, powerPoleIds: metadata.powerPoleIds};
}
