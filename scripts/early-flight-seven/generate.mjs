// Generator for the seven early workshops (blueprint-sources/early-flight-seven).
// Usage: node scripts/early-flight-seven/generate.mjs [--out <dir>]
//
// The production layouts are the ones published in e313389bc (kept unchanged under history/). Those strings
// imported with no working pole wires: workshops 02..07 carried wires between entity numbers that do not exist in
// the string, and 01 carried only 1.1-style `neighbours` keys, which a 2.0 string ignores. In the game every pole
// stood alone and every workshop made nothing. 01 also had its five power-trunk big poles and its P panel half a tile
// off the grid of the rest of the string, so the top trunk pole landed on the iron-ore inlet belt and was lost.
//
// This generator drops the stale wire data and writes copper wires as a minimum spanning tree over every pole within
// wire reach. In 01 it also removes the broken trunk and moves the green-science cell five tiles west, against the
// red-science cell (the five-tile gap held only the trunk); the three green inlet belts lose the five tiles that
// crossed the gap, and the cells' medium poles now reach each other, so no trunk pole is needed. The green cell's own
// big pole is the labelled grid connection, with the P panel beside it; rows 0 and 1, which held only the old P panel,
// go. Then, in every workshop but 04, it cuts out the rows and columns that carry nothing but straight belts running
// across them (see cutLines). Machines, inserters, recipes, chests, splitters and underground belts are all kept,
// in the same order, each moved only by the cuts.
//
// It needs neither the game nor the prototype dump. A re-run leaves the folder byte-identical: the manifest's
// measured fields come from native-report.json only when the report's SHA-256 equals the generated string's.
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeBlueprint, encodeBlueprint} from '../blueprints.mjs';
import {derivePorts, tilesOf, footprint} from './ports.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const args = process.argv.slice(2);
const source = 'blueprint-sources/early-flight-seven';
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : source;

// zlib's compressed bytes differ between builds (the Linux deploy runner on Node 24 gave a different string for 01 than
// this Mac on Node 20 and 26, for the same JSON). Keep the committed string when it decodes to exactly this object, so its
// SHA-256 and native report stay valid on any machine (the same pattern as scripts/early-game/generate.mjs).
function encodeKeeping(object, committedFile) {
  let committed;
  try { committed = readFileSync(committedFile, 'utf8').trim(); } catch { committed = undefined; }
  try { if (committed && inflateSync(Buffer.from(committed.slice(1), 'base64')).toString('utf8') === JSON.stringify(object)) return committed; } catch {}
  return encodeBlueprint(object);
}

// Copper wire reach (max_wire_distance in the 2.1.24 prototypes; the unit test checks these against the dump when it
// is present). Two poles can be wired when their centres are at most the smaller reach apart.
export const wireReach = {'medium-electric-pole': 9, 'big-electric-pole': 32};
const poleCopper = 5; // defines.wire_connector_id.pole_copper

export const designs = [
  {file: '01-red-green-science.txt', name: 'Red + green science', products: ['automation-science-pack', 'logistic-science-pack'], history: 'unwired-red-green-science-aac0cb15', cut: {rows: [15, 20, 27], cols: [10]}},
  {file: '02-red-belts.txt', name: 'Red belts', products: ['fast-transport-belt'], history: 'unwired-red-belts-7442ca34', cut: {cols: [1]}},
  {file: '03-red-undergrounds.txt', name: 'Red underground belts', products: ['fast-underground-belt'], history: 'unwired-red-undergrounds-ade86e78', cut: {rows: [26]}},
  {file: '04-red-splitters.txt', name: 'Red splitters', products: ['fast-splitter'], history: 'unwired-red-splitters-0d64ab9b'},
  {file: '05-assembling-machine-2.txt', name: 'Assembling machine 2', products: ['assembling-machine-2'], history: 'unwired-assembling-machine-2-9cbdae1a', cut: {rows: [9, 23, 28, 35, 41]}},
  {file: '06-medium-poles.txt', name: 'Medium electric poles', products: ['medium-electric-pole'], history: 'unwired-medium-poles-03c109a4', cut: {cols: [1]}},
  {file: '07-big-poles.txt', name: 'Big electric poles', products: ['big-electric-pole'], history: 'unwired-big-poles-6bdd5f41', cut: {cols: [1]}},
];
const bookHistory = 'unwired-book-4b9afb7e';

// Floors: the rate each published layout reached once its poles were wired by hand (screen of the history strings
// with SEVEN_REWIRE=1 under the same phases as the protocol: 240 min warm-up, 60 min measured, every inlet on a full
// belt), rounded down to two decimals. The fixed strings must reach at least these.
export const floors = {
  '01-red-green-science.txt': {'automation-science-pack': 6, 'logistic-science-pack': 5},
  '02-red-belts.txt': {'fast-transport-belt': 3.26},
  '03-red-undergrounds.txt': {'fast-underground-belt': 0.76},
  '04-red-splitters.txt': {'fast-splitter': 0.8},
  '05-assembling-machine-2.txt': {'assembling-machine-2': 0.81},
  '06-medium-poles.txt': {'medium-electric-pole': 3.11},
  '07-big-poles.txt': {'big-electric-pole': 1.29},
};

const oldEvidence = 'Assemblers were changed from AM2 to AM1; source production-rate evidence does not apply to this slower variant.';
const newEvidence = 'AM1 variant of the original AM2 cell. Native-tested in Factorio 2.1.24 with every inlet on a full yellow belt; one iron furnace sets the rate. Pole wires are part of the string.';
const oldScienceEvidence = 'Composed from the original Early Game library cells; AM1 conversion and composition have no native production-rate evidence.';
const newScienceEvidence = 'Composed from the original Early Game library cells. Native-tested in Factorio 2.1.24 with every inlet on a full yellow belt; the science assembler of each cell works all the time and sets the rate. Pole wires are part of the string.';

// The science workshop, in the string's own coordinates (its one-tile entities sit on whole numbers, so a two-by-two
// entity sits on halves). The green cell is every entity whose leftmost tile is at x >= 23; its inlet belts on rows
// y = -52, -49 and -46 cross the gap at x = 18..22.
export const scienceCompaction = {
  remove: [447, 448, 449, 450, 451, 452], // five off-grid trunk big poles and the off-grid P panel
  greenLeft: 23, shift: -5, inletRows: [-52, -49, -46], gap: [18, 22],
  panel: {name: 'display-panel', position: {x: 22, y: -53}, icon: {type: 'item', name: 'big-electric-pole'}, text: 'P · CONNECT EXTERNAL POWER HERE\nThe big pole beside this display; its wires feed both cells.', always_show: true, show_in_chart: false, tags: {flight_mall_power_label: true}},
};

// Minimum spanning tree over the poles (Kruskal; ties broken by entity numbers), at most five copper wires per pole.
export function poleWires(entities) {
  const poles = entities.filter(e => wireReach[e.name]);
  const edges = [];
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
  if (wires.length !== poles.length - 1) throw Error('Poles out of wire reach of each other');
  return wires;
}

// Cut out whole rows and columns of the rectangle that carry only straight belts running across them (a row of belts
// all heading north or south, a column of belts all heading east or west) and that no inserter picks from or drops
// onto. Every belt line through a cut row simply gets one tile shorter; nothing else changes its neighbours, and
// underground pairs that span a cut only get shorter. Rows and columns are counted from the top-left of the rectangle
// before the cut; the function refuses any line that is not pure pass-through.
const step = {0: [0, -1], 4: [1, 0], 8: [0, 1], 12: [-1, 0]};
export function passThrough(entities, axis, index) {
  const box = footprint(entities), at = axis === 'row' ? box.top + index : box.left + index;
  const across = axis === 'row' ? [0, 8] : [4, 12];
  const inLine = e => { const [x0, y0, x1, y1] = tilesOf(e); return axis === 'row' ? y0 <= at && at < y1 : x0 <= at && at < x1; };
  const line = entities.filter(inLine);
  const touched = entities.some(e => {
    if (e.name !== 'inserter') return false;
    const [x, y] = tilesOf(e), [dx, dy] = step[e.direction || 0];
    return axis === 'row' ? y + dy === at || y - dy === at : x + dx === at || x - dx === at;
  });
  return {at, line, ok: !touched && line.every(e => e.name === 'transport-belt' && across.includes(e.direction || 0))};
}
export function cutLines(entities, cut) {
  const lines = [...(cut.rows || []).map(i => ['row', i]), ...(cut.cols || []).map(i => ['col', i])];
  const removed = new Set(), at = {row: [], col: []};
  for (const [axis, i] of lines) {
    const {ok, line, at: a} = passThrough(entities, axis, i);
    if (!ok) throw Error(`Not a pass-through ${axis} ${i}`);
    for (const e of line) removed.add(e);
    at[axis].push(a);
  }
  return entities.filter(e => !removed.has(e)).map(e => {
    const [x0, y0] = tilesOf(e), dx = at.col.filter(a => a < x0).length, dy = at.row.filter(a => a < y0).length;
    return dx || dy ? {...e, position: {x: e.position.x - dx, y: e.position.y - dy}} : e;
  });
}

export async function rebuild(design) {
  const oldCode = (await fs.readFile(`${source}/history/${design.history}/${design.file}`, 'utf8')).trim();
  const object = decodeBlueprint(oldCode), bp = object.blueprint;
  let entities = bp.entities.map(e => { const {neighbours, ...rest} = e; return rest; });
  if (design.file === '01-red-green-science.txt') {
    const c = scienceCompaction;
    entities = entities.filter(e => !c.remove.includes(e.entity_number));
    const crossing = e => e.name === 'transport-belt' && c.inletRows.includes(e.position.y) && e.position.x >= c.gap[0] && e.position.x <= c.gap[1];
    const before = entities.length;
    entities = entities.filter(e => !crossing(e));
    if (bp.entities.length - c.remove.length - entities.length !== 15 || before - entities.length !== 15) throw Error('Science layout differs from the published one');
    entities = entities.map(e => tilesOf(e)[0] >= c.greenLeft ? {...e, position: {...e.position, x: e.position.x + c.shift}} : e);
    entities.push({entity_number: 0, ...c.panel});
  }
  if (design.cut) entities = cutLines(entities, design.cut);
  // Entity numbers run 1..n again in the original order; the wires below use the new numbers.
  entities = entities.map((e, i) => ({...e, entity_number: i + 1}));
  const description = bp.description.replace(oldEvidence, newEvidence).replace(oldScienceEvidence, newScienceEvidence);
  if (description === bp.description) throw Error('Evidence sentence not found in ' + design.file);
  const {wires, ...head} = bp;
  const blueprint = {...head, description, entities, wires: poleWires(entities)};
  return {blueprint: {blueprint}, code: encodeKeeping({blueprint}, `${source}/${design.file}`), oldCode};
}

async function readReport() {
  try { return JSON.parse(await fs.readFile(`${source}/native-report.json`, 'utf8')); } catch { return null; }
}
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

async function main() {
  await fs.mkdir(out, {recursive: true});
  const report = await readReport(), manifest = [], books = [];
  const oldBook = decodeBlueprint(await fs.readFile(`${source}/history/${bookHistory}/seven-workshops-book.txt`, 'utf8')).blueprint_book;
  for (const [index, design] of designs.entries()) {
    const {blueprint, code, oldCode} = await rebuild(design);
    // The published book held exactly the seven published strings; the new book holds the seven new ones.
    if (JSON.stringify(oldBook.blueprints[index].blueprint) !== JSON.stringify(decodeBlueprint(oldCode).blueprint)) throw Error('Old book differs from ' + design.file);
    books.push({index, blueprint: blueprint.blueprint});
    await fs.writeFile(`${out}/${design.file}`, code + '\n');
    const ports = derivePorts(blueprint.blueprint, design.products), hash = sha(code);
    const proof = report?.builds?.find(b => b.id === design.file && b.blueprintSha256 === hash);
    const qualified = report?.passed === true && proof?.passed === true;
    manifest.push({
      id: design.file, file: design.file, name: design.name, products: design.products,
      AM1: ports.counts.assemblingMachine1, steelFurnaces: ports.counts.steelFurnaces, entities: ports.counts.entities,
      footprint: ports.footprint, sha256: hash, blueprintSha256: hash,
      ports: {inputs: ports.inputs.map(p => ({letter: p.letter, item: p.item, side: p.side, row: p.row})), outputs: ports.outputs.map(p => ({item: p.item, column: p.column, row: p.row, stackLimit: p.bar})), power: ports.power},
      poles: {medium: ports.counts.mediumPoles, big: ports.counts.bigPoles, copperWires: blueprint.blueprint.wires.length},
      minimumPerMinute: floors[design.file],
      status: qualified ? 'native-verified' : 'native-verification-incomplete',
      nativeReport: 'native-report.json',
      ...(qualified ? {
        measuredPerMinute: Object.fromEntries(Object.entries(proof.outputsPerMinute).map(([k, v]) => [k, round(v)])),
        recoveryPerMinute: Object.fromEntries(Object.entries(proof.recovery.outputsPerMinute).map(([k, v]) => [k, round(v)])),
        oreAcceptedPerMinute: proof.inputs.map(p => ({letter: p.letter, item: p.item, row: p.row, perMinute: round(p.acceptedPerMinute, 2)})),
      } : {}),
      previous: {sha256: sha(oldCode), file: `history/${design.history}/${design.file}`},
    });
  }
  const book = {blueprint_book: {...oldBook, blueprints: books}};
  await fs.writeFile(`${out}/seven-workshops-book.txt`, encodeKeeping(book, `${source}/seven-workshops-book.txt`) + '\n');
  await fs.writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(`${out}/README.txt`, readme(manifest));
  await fs.writeFile(`${out}/index.html`, page(manifest));
  for (const m of manifest) console.log(m.file, m.footprint.join('x'), m.sha256.slice(0, 16), m.status, JSON.stringify(m.measuredPerMinute || {}));
}

const rate = m => m.measuredPerMinute ? Object.entries(m.measuredPerMinute).map(([k, v]) => `${v.toFixed(2)}/min ${k}`).join(', ') : 'not yet measured';
function readme(manifest) {
  const all = manifest.every(m => m.status === 'native-verified');
  return [
    'Seven independent raw-input blueprints. Import seven-workshops-book.txt for all seven, or import any numbered file individually.',
    'All use AM1, steel furnaces, yellow belts/undergrounds/splitters, and external electricity. Feed every labeled west inlet with its indicated raw material. No manufactured operating inputs. Red/green science remain together so lab feeds are close.',
    'Outputs: red+green science; red belts; red undergrounds; red splitters; AM2; medium poles; big poles.',
    all ? 'Native production test (Factorio 2.1.24, native-report.json, exact SHA-256 of each string): 240 min warm-up, 60 min measured with every inlet on a full yellow belt, 180 min with the output chest full (every inlet must have stopped and no machine may craft in its last 5 min), 10 min settle, 60 min recovery. Measured per minute:' : 'Native production test: not passed for these exact strings yet (see native-report.json).',
    ...manifest.map(m => `  ${m.file}: ${m.footprint.join(' x ')}, ${rate(m)}`),
    'What sets each rate: in 02 to 07 the one iron steel furnace works all the time (37.5 iron ore per minute) while every other machine waits on plates or on its full output; in 01 each cell\'s science assembler works all the time and the furnaces have spare time.',
    'Version history: the strings published on 2026-11-16 (kept in history/) imported with no working pole wires, so nothing in them was powered; the red + green science string also had its power trunk half a tile off the grid. These versions carry their own pole wires. Rows and columns that held only straight pass-through belts are cut out, and in the science workshop the green cell sits against the red one (the gap held only the broken trunk). Old sizes: 37 x 57, 18 x 16, 14 x 32, 24 x 34, 18 x 60, 25 x 19, 25 x 19.',
    '',
  ].join('\n');
}
function page(manifest) {
  const rows = manifest.map(m => `<tr><td><a href="${m.file}">${m.name}</a></td><td>${m.footprint.join(' × ')}</td><td>${m.AM1}</td><td>${m.steelFurnaces}</td><td>${m.measuredPerMinute ? Object.values(m.measuredPerMinute).map(v => v.toFixed(2)).join(' + ') : '–'}</td></tr>`).join('');
  const all = manifest.every(m => m.status === 'native-verified');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Seven Early Flight Blueprints</title><style>body{background:#17221e;color:#e5e8de;font:18px system-ui;max-width:950px;margin:3rem auto;padding:1rem}a{color:#a6d5ef}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #526152}p{line-height:1.6}</style><h1>Seven independent early workshops</h1><p><a href="seven-workshops-book.txt">Open the seven-blueprint book import string</a>, or choose an individual blueprint below. Copy the entire text into Factorio’s Import string dialog.</p><table><tr><th>Blueprint</th><th>Tiles</th><th>AM1</th><th>Steel furnaces</th><th>Measured per minute</th></tr>${rows}</table><p>Feed each labeled west inlet with its indicated raw ore or coal and connect external power. Red and green science stay together for nearby lab feeds. All use yellow belts, undergrounds and splitters, with no modules.</p><p>These are the separated layouts, preserving the original production cells. Separation lets you build each where it fits; it does not reduce their individual machine counts. ${all ? 'Each exact string passed a native Factorio 2.1.24 production test (<a href="native-report.json">report</a>): four hours of warm-up, 60 minutes measured with every inlet on a full yellow belt, then three hours with the output chest full (every inlet must stop) and 60 minutes of recovery. In the science workshop the two science assemblers set the rate; in the other six one iron furnace does.' : 'These exact strings have not passed a native production test yet.'}</p><p>The strings published on 16 November 2026 imported without working pole wires, so nothing in them was powered. These versions carry their own wires and keep every machine, inserter and chest of each cell; rows and columns that held only straight pass-through belts are cut out, and the science workshop's green cell now sits against the red one (31 × 52 instead of 37 × 57).</p></html>\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
