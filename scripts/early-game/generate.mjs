// Generator for the Early Flight science and red-belt mall (blueprint-sources/early-game/early-flight-science-mall.txt).
// Usage: node scripts/early-game/generate.mjs [--out <dir>]
//
// The production cells are the ones published in e313389bc (kept unchanged under history/). That string imported
// with no working pole wires: it carried only 1.1-style `neighbours` keys, which a 2.0 string ignores, so every pole
// stood alone and the mall made nothing. Its 23 power-trunk big poles and its P panel were also half a tile off the
// grid the rest of the string uses, so the game moved every one of them and the top one landed on the logistic-science
// iron inlet belt and was lost. (The same defects were found by Claude Fable 5.2 in the seven separate workshops that
// these cells also make up; see blueprint-sources/early-flight-seven.)
//
// This generator keeps every production entity of every cell (machines, recipes, belts, inserters, chests and their
// limits, inlet panels) in the same place relative to its own cell, and changes:
// - power: the off-grid trunk goes; copper wires are written as a minimum spanning tree over the cells' own poles,
//   with on-grid big poles added only where two cells are out of wire reach of each other (one in this layout);
// - packing: the cells keep their order from north to south, but stand directly below one another instead of six or
//   seven empty rows apart; the logistic-science cell moves five tiles west, beside the automation cell, so its three
//   feed belts from the west edge are five tiles shorter. A check in the generator (crossings) refuses any layout in
//   which an inserter, belt end, splitter or underground of one cell would reach another cell. A full-protocol run of
//   the looser packing (one empty row and column between cells: logisticShift 4, gaps 1, 33 x 241, SHA-256 f872e3a2)
//   passed with the same rates as this one (32 x 235).
// Every inlet stays on the west edge in the same order; every output chest keeps its one-stack limit.
//
// It needs neither the game nor the prototype dump. A re-run leaves the folder byte-identical: the manifest's
// measured fields come from the native report only when the report's SHA-256 equals the generated string's.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeBlueprint, encodeBlueprint} from '../blueprints.mjs';
import {derivePorts, tilesOf, footprint} from './ports.mjs';
import {protocol} from './protocol.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
export const source = 'blueprint-sources/early-game';
export const file = 'early-flight-science-mall.txt';
export const manifestFile = 'early-flight-science-mall.json';
export const reportFile = 'early-flight-science-mall-native-report.json';
export const history = 'history/unwired-tall-b5051d53';

// Copper wire reach and supply-area half width (maximum_wire_distance and supply_area_distance in the 2.1.24
// prototypes; the unit test checks these against the dump when it is present).
export const wireReach = {'medium-electric-pole': 9, 'big-electric-pole': 32};
export const supplyDistance = {'medium-electric-pole': 3.5, 'big-electric-pole': 2};
const poleCopper = 5; // defines.wire_connector_id.pole_copper

// Floors: the rate each product reached in the published layout once its poles were wired by hand (screen of the
// history string with MALL_REWIRE=1 and MALL_TOLERATE=1 under the protocol's 240 min warm-up and 60 min measurement,
// every inlet on a full belt), rounded down to two decimals. The new string must reach at least these.
export const floors = {
  'automation-science-pack': 6, 'logistic-science-pack': 5, 'fast-transport-belt': 3.26, 'fast-underground-belt': 0.76,
  'fast-splitter': 0.8, 'assembling-machine-2': 0.81, 'medium-electric-pole': 3.11, 'big-electric-pole': 1.29,
};

export const layout = {logisticShift: 5, scienceGap: 0, cellGap: 0};
const trunkTag = 'flight_mall_power_trunk', feedTag = 'flight_mall_raw_feed';

// Bands of tile rows that hold entities, separated by empty rows: the science pair, then the six item cells.
function bands(entities) {
  const rows = new Set();
  for (const e of entities) { const [, y0, , y1] = tilesOf(e); for (let y = y0; y < y1; y++) rows.add(y); }
  const sorted = [...rows].sort((a, b) => a - b), out = [];
  for (const y of sorted) { const last = out.at(-1); if (last && y === last[1]) last[1] = y + 1; else out.push([y, y + 1]); }
  return out;
}
const move = (e, dx, dy) => ({...e, position: {x: e.position.x + dx, y: e.position.y + dy}});

// Empty tiles between each pair of cells (Chebyshev distance between their tiles minus one); 0 means they touch.
export function cellGaps(entities, cellOf) {
  const tiles = new Map();
  for (const e of entities) {
    const cell = cellOf.get(e.entity_number);
    if (!cell) continue;
    if (!tiles.has(cell)) tiles.set(cell, []);
    const [x0, y0, x1, y1] = tilesOf(e);
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) tiles.get(cell).push([x, y]);
  }
  const cells = [...tiles.keys()].sort(), pairs = {};
  let min = Infinity, where = '';
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    let d = Infinity;
    for (const [ax, ay] of tiles.get(cells[i])) for (const [bx, by] of tiles.get(cells[j])) d = Math.min(d, Math.max(Math.abs(ax - bx), Math.abs(ay - by)) - 1);
    pairs[cells[i] + '|' + cells[j]] = d;
    if (d < min) { min = d; where = cells[i] + ' and ' + cells[j]; }
  }
  return {min, where, pairs};
}

// Places where one cell would act on another: an inserter picking up or dropping on another cell's tile, a belt,
// splitter or underground exit pushing onto another cell's tile, or an underground entrance or exit with another
// cell's underground of the same heading within tunnel reach in line. Empty when the cells only stand side by side.
const heading = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};
export const tunnelReach = 5; // max_distance of the yellow underground belt in the 2.1.24 prototypes
export function crossings(entities, cellOf) {
  const owner = new Map();
  for (const e of entities) { const [x0, y0, x1, y1] = tilesOf(e); for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) owner.set(x + ',' + y, e); }
  const out = [], foreign = (e, x, y) => { const o = owner.get(x + ',' + y); return o && cellOf.get(o.entity_number) && cellOf.get(o.entity_number) !== cellOf.get(e.entity_number) ? o : null; };
  for (const e of entities) {
    if (!cellOf.get(e.entity_number)) continue;
    const [dx, dy] = heading[e.direction || 0], [x0, y0, x1, y1] = tilesOf(e);
    const targets = [];
    if (e.name === 'inserter') targets.push([x0 + dx, y0 + dy], [x0 - dx, y0 - dy]);
    if (e.name === 'transport-belt' || (e.name === 'underground-belt' && e.type === 'output')) targets.push([x0 + dx, y0 + dy]);
    if (e.name === 'splitter') for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) targets.push([x + dx, y + dy]);
    if (e.name === 'underground-belt') {
      const s = e.type === 'input' ? 1 : -1;
      for (let k = 1; k <= tunnelReach; k++) { const o = foreign(e, x0 + s * k * dx, y0 + s * k * dy); if (o?.name === 'underground-belt' && (o.direction || 0) === (e.direction || 0)) out.push(`${e.name} ${e.position.x},${e.position.y} in line with ${o.name} ${o.position.x},${o.position.y}`); }
    }
    for (const [x, y] of targets) { const o = foreign(e, x, y); if (o) out.push(`${e.name} ${e.position.x},${e.position.y} acts on ${o.name} ${o.position.x},${o.position.y}`); }
  }
  return out;
}

// Minimum spanning tree over the poles (Kruskal; ties broken by entity numbers), at most five copper wires per pole.
// Two poles can be wired when their centres are at most the smaller of their reaches apart.
export function poleWires(entities) {
  const poles = entities.filter(e => wireReach[e.name]), edges = [];
  for (let i = 0; i < poles.length; i++) for (let j = i + 1; j < poles.length; j++) {
    const a = poles[i], b = poles[j], d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
    if (d <= Math.min(wireReach[a.name], wireReach[b.name])) edges.push({a: a.entity_number, b: b.entity_number, d});
  }
  edges.sort((x, y) => x.d - y.d || x.a - y.a || x.b - y.b);
  const parent = new Map(poles.map(p => [p.entity_number, p.entity_number])), degree = new Map();
  const find = n => { while (parent.get(n) !== n) n = parent.get(n); return n; };
  const wires = [];
  for (const {a, b} of edges) {
    const ra = find(a), rb = find(b);
    if (ra === rb || (degree.get(a) || 0) >= 5 || (degree.get(b) || 0) >= 5) continue;
    parent.set(ra, rb); degree.set(a, (degree.get(a) || 0) + 1); degree.set(b, (degree.get(b) || 0) + 1);
    wires.push([a, poleCopper, b, poleCopper]);
  }
  const components = new Set(poles.map(p => find(p.entity_number))).size;
  return {wires, components};
}

// Electric machines and inserters outside every pole's supply area.
export function unsupplied(entities) {
  const poles = entities.filter(e => supplyDistance[e.name]);
  return entities.filter(e => e.name === 'assembling-machine-1' || e.name === 'inserter').filter(e => {
    const [x0, y0, x1, y1] = tilesOf(e);
    return !poles.some(p => { const r = supplyDistance[p.name]; return x0 < p.position.x + r && x1 > p.position.x - r && y0 < p.position.y + r && y1 > p.position.y - r; });
  });
}

// On-grid big poles where the cells' own poles leave the mall in more than one electric network. Each added pole
// stands inside the rectangle, on free tiles, and joins the network of the power pole to the nearest other one.
function bridgePoles(entities, next) {
  const added = [];
  const box = footprint(entities), taken = new Set();
  for (const e of entities) { const [x0, y0, x1, y1] = tilesOf(e); for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) taken.add(x + ',' + y); }
  // Tile-grid offset: one-tile entities sit on whole numbers here, so a two-by-two pole sits on halves.
  for (let guard = 0; guard < 20; guard++) {
    const all = [...entities, ...added], {components} = poleWires(all);
    if (components === 1) return added;
    const poles = all.filter(e => wireReach[e.name]);
    // Networks by union-find over every reachable pair (not only tree edges).
    const parent = new Map(poles.map(p => [p.entity_number, p.entity_number])), find = n => { while (parent.get(n) !== n) n = parent.get(n); return n; };
    for (const a of poles) for (const b of poles) if (a.entity_number < b.entity_number && Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) <= Math.min(wireReach[a.name], wireReach[b.name])) parent.set(find(a.entity_number), find(b.entity_number));
    const topPole = [...poles].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)[0], home = find(topPole.entity_number);
    let best = null;
    for (let y = box.top; y + 2 <= box.top + box.height; y++) for (let x = box.left; x + 2 <= box.left + box.width; x++) {
      if ([[0, 0], [1, 0], [0, 1], [1, 1]].some(([dx, dy]) => taken.has((x + dx) + ',' + (y + dy)))) continue;
      const position = {x: x + 0.5, y: y + 0.5}, reach = new Set();
      for (const p of poles) if (Math.hypot(p.position.x - position.x, p.position.y - position.y) <= Math.min(32, wireReach[p.name])) reach.add(find(p.entity_number));
      if (!reach.has(home)) continue;
      // Prefer a pole that joins the most networks, then the one reaching furthest south (fewest poles in all).
      const score = [reach.size, position.y, -position.x];
      if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && (score[1] > best.score[1] || (score[1] === best.score[1] && score[2] > best.score[2])))) best = {position, score};
    }
    if (!best || best.score[0] < 2) throw Error('No on-grid place for a big pole that joins two networks');
    const pole = {entity_number: next + added.length, name: 'big-electric-pole', position: best.position, tags: {[trunkTag]: 'cell link'}};
    added.push(pole);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) taken.add((best.position.x - 0.5 + dx) + ',' + (best.position.y - 0.5 + dy));
  }
  throw Error('Too many link poles');
}

export function rebuild(oldCode) {
  const object = decodeBlueprint(oldCode), bp = object.blueprint;
  const trunk = bp.entities.filter(e => e.name === 'big-electric-pole' && e.neighbours && (e.position.x === 19 || e.position.x === 28.5));
  const powerPanel = bp.entities.find(e => e.name === 'display-panel' && /^P · /.test(e.text || ''));
  if (trunk.length !== 23 || !powerPanel) throw Error('Old trunk not found');
  const drop = new Set([...trunk, powerPanel].map(e => e.entity_number));
  let entities = bp.entities.filter(e => !drop.has(e.entity_number)).map(e => { const {neighbours, ...rest} = e; return rest; });
  const cellBands = bands(entities);
  if (cellBands.length !== 7) throw Error('Expected seven bands of cells, found ' + cellBands.length);
  // Science pair: the logistic cell is everything at x >= 21 plus its tagged feed belts and panels north of the
  // automation cell; its feed belts lose their easternmost logisticShift tiles and the cell moves as far west.
  const [scienceTop, scienceBottom] = cellBands[0];
  const inScience = e => e.position.y >= scienceTop - 0.5 && e.position.y < scienceBottom;
  const shift = layout.logisticShift, cellOf = new Map();
  for (const e of entities) {
    const [, y0] = tilesOf(e);
    cellOf.set(e.entity_number, inScience(e) ? (e.position.x >= 21 || e.tags?.[feedTag] || y0 < -12 ? 'logistic' : 'automation') : 'item ' + cellBands.findIndex(([top, end]) => y0 >= top && y0 < end));
  }
  entities = entities.filter(e => !(e.tags?.[feedTag] && e.position.x >= 21 - shift)).map(e => inScience(e) && e.position.x >= 21 ? move(e, -shift, 0) : e);
  // Item cells: each one moves north to stand cellGap empty rows below the cell above it.
  let bottom = scienceBottom;
  const dy = new Map();
  for (const [top, end] of cellBands.slice(1)) { const d = bottom + layout.cellGap - top; dy.set(top, d); bottom = end + d; }
  entities = entities.map(e => {
    const [, y0] = tilesOf(e), band = cellBands.slice(1).find(([top, end]) => y0 >= top && y0 < end);
    return band ? move(e, 0, dy.get(band[0])) : e;
  });
  // Cells may stand side by side but no cell may act on another: an inserter, belt end, splitter or underground at a
  // cell's edge reaches only its own cell or empty ground, as it did in the original layout.
  const gap = cellGaps(entities, cellOf), cross = crossings(entities, cellOf);
  if (gap.min < 0) throw Error('Two cells overlap: ' + gap.where);
  if (cross.length) throw Error('One cell acts on another: ' + cross.join('; '));
  if (gap.pairs['automation|logistic'] !== layout.scienceGap) throw Error('The science cells stand ' + gap.pairs['automation|logistic'] + ' columns apart, expected ' + layout.scienceGap);
  // Power: the P panel stands beside the logistic cell's north big pole, the pole nearest the top-right corner.
  const box = footprint(entities);
  const northPole = entities.filter(e => e.name === 'big-electric-pole').sort((a, b) => a.position.y - b.position.y || b.position.x - a.position.x)[0];
  const next = Math.max(...entities.map(e => e.entity_number)) + 1;
  const panel = {entity_number: next, name: 'display-panel', position: {x: northPole.position.x + 1.5, y: northPole.position.y - 0.5}, tags: {flight_mall_power_label: true}, text: 'P · CONNECT EXTERNAL POWER HERE\nThe big pole beside this display; its wires feed every cell.', icon: {type: 'item', name: 'big-electric-pole'}, always_show: true, show_in_chart: false};
  if (panel.position.y !== box.top) throw Error('P panel is not on the top row');
  entities.push(panel);
  entities.push(...bridgePoles(entities, next + 1));
  // Renumber in order so the string carries no gaps, and remap nothing else (no circuit wires in this design).
  const numbers = new Map(entities.map((e, i) => [e.entity_number, i + 1]));
  entities = entities.map(e => ({...e, entity_number: numbers.get(e.entity_number)}));
  const {wires, components} = poleWires(entities);
  if (components !== 1) throw Error('Poles out of wire reach of each other');
  const dark = unsupplied(entities);
  if (dark.length) throw Error('Outside every supply area: ' + dark.map(e => e.name + ' ' + e.position.x + ',' + e.position.y).join('; '));
  const description = bp.description.replace('Power: connect one external grid at P; the internal big-pole trunk links all cells.', 'Power: connect one external grid at the big pole beside P; the pole wires in this string link all cells.');
  if (description === bp.description) throw Error('Power sentence not found in the old description');
  const blueprint = {...bp, description, entities, wires};
  return {blueprint, code: encodeBlueprint({blueprint})};
}

async function readJson(p) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; } }
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

async function main() {
  const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : source;
  // Screens only: --layout '{"logisticShift":5,"scienceGap":0,"cellGap":0}' with --out writes a candidate elsewhere.
  if (args.includes('--layout')) { if (out === source) throw Error('A candidate layout goes to --out, never over the published files'); Object.assign(layout, JSON.parse(args[args.indexOf('--layout') + 1])); }
  const oldCode = (await fs.readFile(`${source}/${history}/${file}`, 'utf8')).trim();
  const oldManifest = await readJson(`${source}/${history}/${manifestFile}`);
  const {blueprint, code} = rebuild(oldCode), hash = sha(code);
  await fs.mkdir(out, {recursive: true});
  await fs.writeFile(`${out}/${file}`, code + '\n');
  const report = await readJson(`${source}/${reportFile}`);
  const proof = report?.builds?.find(b => b.blueprintSha256 === hash);
  const qualified = report?.passed === true && proof?.passed === true;
  const ports = derivePorts(blueprint, oldManifest.outputs), old = derivePorts(decodeBlueprint(oldCode).blueprint, oldManifest.outputs);
  const counts = {};
  for (const e of blueprint.entities) counts[e.name] = (counts[e.name] || 0) + 1;
  const manifest = {
    name: oldManifest.name, blueprintFile: file, sourceModules: oldManifest.sourceModules, sourceGameVersion: oldManifest.sourceGameVersion,
    equipment: oldManifest.equipment, rawInputs: oldManifest.rawInputs, outputs: oldManifest.outputs,
    inputPorts: ports.inputs.map(p => ({letter: p.letter, item: p.item, side: p.side, row: p.row})),
    outputPorts: ports.outputs.map(p => ({item: p.item, column: p.column, row: p.row, stackLimit: p.bar})),
    power: {column: ports.power.column, row: ports.power.row, externalConnectors: 1, bigPoles: counts['big-electric-pole'], mediumPoles: counts['medium-electric-pole'], linkPoles: blueprint.entities.filter(e => e.tags?.[trunkTag]).length, copperWires: blueprint.wires.length},
    entities: blueprint.entities.length, entityCounts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    footprint: ports.footprint, tiles: ports.tiles,
    sha256: hash, blueprintSha256: hash,
    minimumPerMinute: floors, protocol,
    status: qualified ? 'native-verified' : 'native-verification-incomplete', nativeReport: reportFile,
    ...(qualified ? {
      measuredPerMinute: Object.fromEntries(oldManifest.outputs.map(k => [k, round(proof.outputsPerMinute[k])])),
      recoveryPerMinute: Object.fromEntries(oldManifest.outputs.map(k => [k, round(proof.recovery.outputsPerMinute[k])])),
      oreAcceptedPerMinute: proof.inputs.map(p => ({letter: p.letter, item: p.item, row: p.row, perMinute: round(p.acceptedPerMinute, 2)})),
    } : {}),
    previous: {sha256: sha(oldCode), file: `${history}/${file}`, footprint: old.footprint, tiles: old.tiles, entities: decodeBlueprint(oldCode).blueprint.entities.length, note: 'Imported unpowered: no 2.0 pole wires, and its 23 trunk poles and P panel were off the tile grid.'},
  };
  await fs.writeFile(`${out}/${manifestFile}`, JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(`${out}/early-flight-science-mall.md`, readme(manifest));
  console.log(file, manifest.footprint.join('x'), manifest.tiles, 'tiles, was', old.footprint.join('x'), old.tiles, hash.slice(0, 16), manifest.status, JSON.stringify(manifest.measuredPerMinute || {}));
}

const names = {
  'automation-science-pack': 'automation science', 'logistic-science-pack': 'logistic science', 'fast-transport-belt': 'fast transport belt',
  'fast-underground-belt': 'fast underground belt', 'fast-splitter': 'fast splitter', 'assembling-machine-2': 'assembling machine 2',
  'medium-electric-pole': 'medium electric pole', 'big-electric-pole': 'big electric pole',
};
function readme(m) {
  const c = m.entityCounts, rates = m.measuredPerMinute;
  const science = m.outputPorts.filter(p => p.item.endsWith('science-pack')), others = m.outputPorts.filter(p => !p.item.endsWith('science-pack'));
  return `# Early Flight science and red-belt mall

Blueprint import string: [\`early-flight-science-mall.txt\`](early-flight-science-mall.txt)

One narrow stamp composes eight raw-input cells from the Early Game library:

- Automation and logistic science packs, with their output chests on the same row for lab feeds.
- Fast (red) transport belt, fast underground belt and fast splitter.
- Assembling machine 2, medium electric pole and big electric pole.

The cells use assembling machine 1, steel furnaces, yellow belts, yellow underground belts and yellow splitters. No modules are installed. Steel furnaces use the coal feed. Raw operating inputs are iron ore, copper ore and coal; power is external. Each labeled inlet is on the west edge. Several cells have their own labeled inlet for the same raw resource, so feed every matching inlet. A short set of yellow belts carries the logistic-science feeds from the west edge.

Connect external power to the big pole beside the top \`P\` panel. The pole wires in the string connect every production cell. Each output chest stands just east of its product assembler and is limited to one stack; empty them or belt the products out to resume crafting. Display panels can be skipped until Circuit network is researched.

Build the complete stamp after researching Automation, Logistics, Automation 2, Logistics 2, Advanced material processing, and Electric energy distribution 1. Earlier in the run, place only the ghosts for entities already unlocked.

## Size and composition

The blueprint covers ${m.footprint[0]} × ${m.footprint[1]} tiles (${m.tiles} tiles). The cells are stacked directly below one another (no cell's inserters, belts or undergrounds reach into another) and do not share smelters or intermediate-production machines. The two science outputs sit on the same row, ${science[1].column - science[0].column} tiles apart. The other six finished-item chests are in columns ${Math.min(...others.map(p => p.column))} to ${Math.max(...others.map(p => p.column))} from the west edge, each just east of its own cell's product assembler.

It contains ${c['assembling-machine-1']} assembling machine 1s, ${c['steel-furnace']} steel furnaces, ${c['transport-belt']} yellow belts, ${c['underground-belt']} underground-belt endpoints, ${c['splitter']} yellow splitters, ${c['inserter']} inserters and ${c['wooden-chest']} one-stack wooden output chests. Power is ${c['big-electric-pole']} big and ${c['medium-electric-pole']} medium electric poles joined by ${m.power.copperWires} copper wires in the string${m.power.linkPoles ? ` (${m.power.linkPoles === 1 ? 'one big pole only links' : m.power.linkPoles + ' big poles only link'} cells that are out of wire reach of each other)` : ''}. The blueprint has ${m.inputPorts.length} labeled raw-material inlets across the independent cells.

## Native test

${rates ? `This exact string (SHA-256 \`${m.blueprintSha256.slice(0, 16)}…\`) passed a native Factorio 2.1.24 production test ([report](${m.nativeReport})): ${protocol.warmupMinutes} minutes of warm-up, ${protocol.measureMinutes} minutes measured with every inlet on a full yellow belt, then ${protocol.blockedMinutes} minutes with every output chest full (every inlet must stop and no machine may craft in the last ${protocol.blockedTailMinutes}), ${protocol.settleMinutes} minutes to settle and ${protocol.recoveryMinutes} minutes of recovery. Measured per minute:

${m.outputs.map(k => `- ${names[k]}: ${rates[k].toFixed(2)} (after the blocked hold ${m.recoveryPerMinute[k].toFixed(2)})`).join('\n')}

In each science cell the science assembler works all the time and sets the rate; in each item cell the one iron furnace works all the time (37.5 iron ore per minute) and every other machine waits on plates or on its full output.` : 'This exact string has not passed the native production test yet; no rates are claimed.'}

## Version history

The string published on 2026-11-16 (kept in [\`${history}/\`](${history}/)) imported unpowered: it had no 2.0 pole wires, and its 23 power-trunk big poles and its P panel were half a tile off the tile grid, so the game moved them and the top one landed on an inlet belt. It covered ${m.previous.footprint[0]} × ${m.previous.footprint[1]} tiles (${m.previous.tiles}). This version keeps every production entity of every cell where it was inside its cell (only the logistic-science feed belts are ${layout.logisticShift} tiles shorter), carries its own pole wires, stacks the cells directly below one another instead of six or seven empty rows apart and moves the logistic-science cell ${layout.logisticShift} tiles west beside the automation cell, so it covers ${Math.round((1 - m.tiles / m.previous.tiles) * 100)}% fewer tiles.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
