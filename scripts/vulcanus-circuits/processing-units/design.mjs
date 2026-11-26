// Processing units from lava, calcite, plastic and sulfuric acid, 60 a minute. A pure function of the pinned prototypes and the
// fluid-slot table. West to east, 13 rows: lava block (two lava foundries per metal), iron block (eight plate foundries), circuit
// core (three triplets and one unit with cable taps: eight cable foundries, fourteen electronic circuit machines), advanced
// circuit block (twelve machines), the plastic column, processing unit block (ten machines), ports.
import { Layout, N, E, S, W } from '../lib.mjs';
import { rates, lavaBlock, ironBlock, plateBelt, circuitCore, tapCore, acBlock, plasticBelt, puBlock, trunk, MID, ARM_T, ARM_B, RECIPE } from '../parts.mjs';
import { assemble } from '../package.mjs';

export const ID = 'processing-units';
export const TARGET = 60;
export const PLASTIC_PER_COPY = 60;   // what one copy of the coal-plastic-lubricant blueprint gives a minute
// Each feed belt carries 720 electronic circuits a minute on one lane, and the plate belt 720 plates a minute on each lane. A red
// lane holds 900, and with red belts the arms could put no more than about 790 on a lane (measured: 65.6 processing units a
// minute at most, 70 with express belts, where the lava foundries set the pace). Express lanes hold 1,350.
const FEED = 'blue', PLATE = 'blue';
export function sizing(p) {
  const r = rates(p), need = r.demand({ pu: TARGET });
  const count = { copperLava: 2, ironLava: 2, plate: 8, cable: 8, ec: 14, ac: 12, pu: 10 };
  return {
    target: { 'processing-unit': TARGET }, productivity: r.prod, need,
    machines: [
      { recipe: RECIPE.copperLava, count: count.copperLava, craftsNeeded: need.copperLavaCrafts, craftsEach: r.foundryCrafts(RECIPE.copperLava), why: '1.42 needed' },
      { recipe: RECIPE.ironLava, count: count.ironLava, craftsNeeded: need.ironLavaCrafts, craftsEach: r.foundryCrafts(RECIPE.ironLava), why: '1.71 needed' },
      { recipe: RECIPE.plate, count: count.plate, craftsNeeded: need.plateCrafts, craftsEach: r.foundryCrafts(RECIPE.plate), why: '6.4 needed, so seven would do; the eighth is a spare that keeps the plate foundries in pairs above and below the belt' },
      { recipe: RECIPE.cable, count: count.cable, craftsNeeded: need.cableCrafts, craftsEach: r.foundryCrafts(RECIPE.cable), why: '6.67 needed, so seven would do; the eighth is a spare that keeps the two bands alike' },
      { recipe: RECIPE.ec, count: count.ec, craftsNeeded: need.ec, craftsEach: r.am3Crafts(RECIPE.ec), why: '9.6 needed; a cable foundry hands its cable to the machines beside it, and seven of the eight foundries have two, one has one and a cable tap' },
      { recipe: RECIPE.ac, count: count.ac, craftsNeeded: need.ac, craftsEach: r.am3Crafts(RECIPE.ac), why: '9.6 needed; they stand in pairs above and below the belt, so twelve' },
      { recipe: RECIPE.pu, count: count.pu, craftsNeeded: TARGET, craftsEach: r.am3Crafts(RECIPE.pu), why: 'exactly 8 needed; nine is the first count with a reserve, the tenth keeps the two bands alike' },
    ],
    panel: { lava: Math.ceil(need.lava / 10) * 10, calcite: Math.ceil(need.calcite), stone: Math.round(need.stone), 'plastic-bar': Math.ceil(need.plastic), 'sulfuric-acid': Math.ceil(need.acid) },
    plasticCopies: Math.ceil(need.plastic / PLASTIC_PER_COPY), rocket: p.rocket,
    idleAtPanelSupply: { group: 'advanced-circuit', machines: 2, why: 'twelve advanced circuit machines stand where 9.6 are needed; plastic comes from the east, the ten machines nearest to it take all of it at the panel figure, and the pair furthest west waits' },
  };
}

export function design(p, slots, options = {}) {
  const z = sizing(p), L = new Layout();
  const lava = lavaBlock(L, 0, 2);
  const iron = ironBlock(L, lava.width, 4, { substations: true });
  const x0 = lava.width + iron.width;
  const plateEnd = Math.max(iron.drops[iron.drops.length - 1], iron.junctions[iron.junctions.length - 1] + 1);
  plateBelt(L, iron.drops[0], plateEnd, iron.crossings, PLATE);
  L.add('substation', iron.junctions[0] + 1, ARM_T);
  const core = circuitCore(L, x0, 3, { plateFrom: plateEnd + 1, lines: ['feed-top', 'feed-bottom'], plateOn: true, productTier: FEED, plateTier: PLATE });
  const tap = tapCore(L, core.end, 1, { plateFrom: core.end, tier: FEED, plateTier: PLATE });
  const ac = acBlock(L, tap.end, 3, [0, 2], { ports: false });
  // between the two blocks: the advanced circuit belt dives east into the processing unit block, plastic comes down one column
  // from the north edge and turns west into the advanced circuit block
  const e0 = ac.east, c = e0 + 2;
  L.dive('red', 'advanced', e0, MID, e0 + 5, MID);
  const plastic = L.run('yellow', 'plastic', c, 0, c, ARM_T)[0];
  L.belt('yellow', 'plastic', c, MID, W);
  plasticBelt(L, ac.yellow, e0 + 1);
  const pu = puBlock(L, e0 + 3, 2);
  // feed belts: on from the core to the last processing unit machine; the top one dives under the plastic entrance
  for (const [y, line] of [[0, 'feed-top'], [12, 'feed-bottom']]) for (let x = tap.end; x <= pu.feedEnd; x++) {
    if (y === 0 && x === c - 1) { L.dive(FEED, line, c - 1, y, c + 1, y); x = c + 1; } else L.belt(FEED, line, x, y, E);
  }
  // trunks, last: molten copper under row 5, molten iron under row 7, sulfuric acid under rows 1 and 11
  trunk(L, ARM_T, [{ from: lava.copperStart, to: lava.copperStart }, ...core.copperStops, ...tap.copperStops]);
  trunk(L, ARM_B, [{ from: lava.ironStart, to: lava.ironStart }, ...iron.junctions.map(x => ({ from: x, to: x }))]);
  const q = pu.acidColumn;
  trunk(L, 1, [...pu.acidStops.map(x => ({ from: x, to: x })), { from: q, to: q + 2 }]);
  trunk(L, 11, [...pu.acidStops.map(x => ({ from: x, to: x })), { from: q, to: q }]);
  const e = pu.end - 1;
  const inputs = [
    { id: 'IN-1', item: 'lava', kind: 'pipe', side: 'west', entity: lava.lavaEntrance, perMinute: z.panel.lava, panel: L.panel(0, 2, `IN: lava ${z.panel.lava}/min`, 'lava', 'fluid') },
    { id: 'IN-2', item: 'calcite', kind: 'belt', side: 'west', entity: lava.calciteEntrance, perMinute: z.panel.calcite, panel: L.panel(0, 5, `IN: calcite ${z.panel.calcite}/min`, 'calcite') },
    { id: 'IN-3', item: 'plastic-bar', kind: 'belt', side: 'north', entity: plastic, perMinute: z.panel['plastic-bar'], panel: L.panel(c - 1, 1, `IN: plastic-bar ${z.panel['plastic-bar']}/min`, 'plastic-bar') },
    { id: 'IN-4', item: 'sulfuric-acid', kind: 'pipe', side: 'east', entity: pu.acidEntrance, perMinute: z.panel['sulfuric-acid'], panel: L.panel(e, 2, `IN: sulfuric-acid ${z.panel['sulfuric-acid']}/min`, 'sulfuric-acid', 'fluid') },
  ];
  const outputs = [
    { id: 'OUT-1', item: 'processing-unit', kind: 'belt', side: 'east', entity: pu.exit, perMinute: TARGET, product: true, panel: L.panel(e, ARM_B, `OUT: processing-unit ${TARGET}/min`, 'processing-unit') },
    { id: 'OUT-STONE', item: 'stone', kind: 'belt', side: 'west', entity: lava.stoneExit, perMinute: z.panel.stone, byproduct: true, panel: L.panel(0, 8, `OUT: stone ${z.panel.stone}/min`, 'stone') },
  ];
  const powerLabel = 'POWER: connect this substation';
  return assemble({
    id: ID, layout: L, label: 'Processing units from lava | Vulcanus | 60 a minute',
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus. West: lava by pipe, calcite on a belt, stone leaves on a belt and must be carried away; connect power to the labelled substation. North: plastic bars in on a belt. East: sulfuric acid in by pipe, processing units out on a belt. Cable, electronic and advanced circuits are made inside. No modules, no beacons. See the README for ports and the native test.`,
    icons: ['processing-unit', 'foundry', 'lava', 'sulfuric-acid'], iconTypes: { lava: 'fluid', 'sulfuric-acid': 'fluid' },
    inputs, outputs, product: 'processing-unit', target: TARGET,
    power: { entry: lava.substation, panel: L.panel(0, 9, powerLabel, 'substation'), label: powerLabel, externalPole: { x: -5, y: 10 } },
    products: ['processing-unit'], sizing: z,
    lines: { calcite: ['calcite'], stone: ['stone'], plates: ['iron-plate'], 'feed-top': ['electronic-circuit', 'copper-cable'], 'feed-bottom': ['electronic-circuit', 'copper-cable'], plastic: ['plastic-bar'], advanced: ['advanced-circuit'], product: ['processing-unit'] },
    exitCarries: 'a yellow belt carries 900 a minute; the top machines load one lane and the bottom machines the other, 30 a minute a lane at the target',
    intendedUse: 'processing units on a belt from lava, calcite, plastic bars and sulfuric acid; molten metal, plates, cable, electronic and advanced circuits are made inside',
    text: text(z),
  }, p, slots, options);
}

const n = v => Math.round(v).toLocaleString('en-US');
function text(z) {
  const d = z.need;
  return {
    title: 'Processing units from lava · 60 a minute', productName: 'processing units',
    makes: `Turns lava, calcite, plastic bars and sulfuric acid into processing units (blue circuits) on one belt, 60 a minute. Foundries melt the lava and cast iron plates and copper cable; the electronic and advanced circuits the recipe needs are made inside. A rocket needs ${z.rocket.partsPerRocket * z.rocket.processingUnitsPerPart} processing units (${z.rocket.processingUnitsPerPart} in each of its ${z.rocket.partsPerRocket} parts), so this makes one rocket's worth in ${Math.round(z.rocket.partsPerRocket * z.rocket.processingUnitsPerPart / TARGET * 60)} seconds; the rocket's low density structures and fuel are not part of it.`,
    arithmetic: `At 60 processing units a minute: ${n(d.ec)} electronic circuits (${n(60 * 20)} for the processing units, ${n(d.ac * 2)} for the advanced circuits), ${n(d.ac)} advanced circuits, ${n(d.plastic)} plastic bars, ${n(d.acid)} sulfuric acid, ${n(d.cable)} copper cable and ${n(d.plate)} iron plates a minute; ${n(d.moltenIron)} molten iron and ${n(d.moltenCopper)} molten copper from ${(d.copperLavaCrafts + d.ironLavaCrafts).toFixed(1)} lava crafts a minute: ${n(d.lava)} lava and ${d.calcite.toFixed(1)} calcite in, ${n(d.stone)} stone out.`,
    generousNote: 'Offered more, it makes more than the target: the ten processing unit machines can do 75 a minute between them, and everything before them has the reserve for it.',
    supplies: [
      `**Plastic**: ${n(z.panel['plastic-bar'])} bars a minute at the target (two for each of the ${n(d.ac)} advanced circuits). The coal-to-plastic blueprint (\`vulcanus-supplies/coal-plastic-lubricant\`) gives ${PLASTIC_PER_COPY} a minute a copy, so this needs **${z.plasticCopies} copies** of it (or any other source of ${n(z.panel['plastic-bar'])} a minute).`,
      `**Sulfuric acid**: ${n(z.panel['sulfuric-acid'])} a minute at the target, five per processing unit. On Vulcanus acid comes from the acid geysers; this draw is small beside what the plastic copies take (each copy of the coal-to-plastic blueprint is labelled 750 a minute).`,
    ],
    how: [
      '**Lava block** (west, columns 0 to 16). Four lava foundries: molten copper in the top row, molten iron in the bottom row, with the lava columns (3 and 15) outside them and the metal column (9) between them. Calcite comes in on a yellow belt on row 6 and surfaces beside each pair; stone leaves on a red belt by row 7.',
      '**Iron block** (columns 17 to 39). Eight foundries cast iron plate onto the red belt of row 6, which runs east past every electronic circuit machine.',
      '**Circuit core** (columns 40 to 89). Three triplets (a cable foundry between two electronic circuit machines) and one unit with a cable tap (an electronic circuit machine, a cable foundry and one bulk arm that puts cable on a three-tile belt), each in a top band and a mirrored bottom band: eight cable foundries, fourteen electronic circuit machines. Cable reaches the circuit machines by bulk arm, never by belt.',
      '**Feed belts** (rows 0 and 12). The electronic circuit machines drop their circuits on the feed belt of their band (outer lane); the cable tap joins it from inside (inner lane). The belt runs east past the advanced circuit machines, which take both, and on past the processing unit machines, which take only circuits; it ends at the last of them. The cable lane beyond the advanced circuit block just stands full.',
      '**Advanced circuit block** (columns 90 to 111). Twelve assembling machines 3. Each takes circuits and cable from its feed belt with one bulk arm, plastic from the yellow belt of row 6 with a fast arm, and puts its advanced circuit on the red belt of row 6. Plastic comes down column 114 from the north edge and runs west; the red belt runs east and dives under it.',
      '**Processing unit block** (columns 115 to 133). Ten assembling machines 3. Each takes electronic circuits from its feed belt with one bulk arm and advanced circuits from the red belt of row 6 with a fast arm, and puts its processing unit on the yellow belt of row 6, which leaves at the east edge. The machines stand in pairs facing each other; the acid pipe stands between them and reaches both. Acid comes in at the east edge and travels west under row 1 (and row 11 for the bottom band); the two are joined by the pipe column 134.',
      '**Metal trunks.** Molten copper travels east under row 5 to the eight cable foundries, molten iron under row 7 to the three iron columns.',
    ],
    limits: [
      'Connect the stone exit before anything else; with it unconnected the build stops within minutes and waits.',
      'Ports are on three sides: lava, calcite, stone and power on the west; plastic on the north edge at column 114; acid (row 1) and the product (row 6) on the east.',
      'The figures hold at the panel supply. With less of any input it makes less; the cut, outage and late-input tests show it does not jam and returns to the rate when supply does.',
      'The product belt is yellow: 60 a minute is a fifteenth of what it carries.',
      'At exactly the panel supply two of the twelve advanced circuit machines stand idle: plastic comes from the east, the ten machines nearest to it take all 240 bars, and the pair furthest west (column 90) waits. Offered more plastic they work too.',
      'The feed belts and the plate belt are express belts: each feed belt carries 720 electronic circuits a minute on one lane and the plate belt 720 plates a lane, more than arms can reliably put on a red lane (900). The other belts are red and yellow.',
    ],
  };
}
