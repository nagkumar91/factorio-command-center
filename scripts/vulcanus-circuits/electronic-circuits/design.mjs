// Electronic circuits from lava and calcite, 1,200 a minute. A pure function of the pinned prototypes and the fluid-slot table.
// West to east, 13 rows: lava block (two lava foundries per metal), iron block (six plate foundries), circuit core (three triplets
// of assembling machine 3, cable foundry, assembling machine 3, in two mirrored bands), and the exit column.
import { Layout, N, E, S, W } from '../lib.mjs';
import { rates, lavaBlock, ironBlock, plateBelt, circuitCore, trunk, MID, ARM_T, ARM_B, RECIPE } from '../parts.mjs';
import { assemble } from '../package.mjs';

export const ID = 'electronic-circuits';
export const TARGET = 1200;
export function sizing(p) {
  const r = rates(p), need = r.demand({ ec: TARGET });
  const count = { copperLava: 2, ironLava: 2, plate: 6, cable: 6, ec: 12 };
  return {
    target: { 'electronic-circuit': TARGET }, productivity: r.prod, need,
    machines: [
      { recipe: RECIPE.copperLava, count: count.copperLava, craftsNeeded: need.copperLavaCrafts, craftsEach: r.foundryCrafts(RECIPE.copperLava), why: 'one would make 5,625 molten copper a minute of the 6,000 needed' },
      { recipe: RECIPE.ironLava, count: count.ironLava, craftsNeeded: need.ironLavaCrafts, craftsEach: r.foundryCrafts(RECIPE.ironLava), why: 'one would make 5,625 molten iron a minute of the 8,000 needed' },
      { recipe: RECIPE.plate, count: count.plate, craftsNeeded: need.plateCrafts, craftsEach: r.foundryCrafts(RECIPE.plate), why: '5.33 needed' },
      { recipe: RECIPE.cable, count: count.cable, craftsNeeded: need.cableCrafts, craftsEach: r.foundryCrafts(RECIPE.cable), why: 'exactly 5 needed; the sixth is the spare, because five would have to cast without ever pausing' },
      { recipe: RECIPE.ec, count: count.ec, craftsNeeded: TARGET, craftsEach: r.am3Crafts(RECIPE.ec), why: '8 needed; each cable foundry hands its cable to two machines directly, so six foundries carry twelve, each at two thirds of its speed' },
    ],
    panel: { lava: Math.ceil(need.lava / 10) * 10, calcite: Math.ceil(need.calcite), stone: Math.round(need.stone) },
  };
}

export function design(p, slots, options = {}) {
  const z = sizing(p), L = new Layout();
  const lava = lavaBlock(L, 0, 2);
  const iron = ironBlock(L, lava.width, 3);
  const x0 = lava.width + iron.width;
  const core = circuitCore(L, x0, 3, { plateFrom: iron.drops[iron.drops.length - 1] + 1 });
  // the plate belt of the iron block, up to where the core's part begins
  plateBelt(L, iron.drops[0], iron.drops[iron.drops.length - 1], iron.junctions);
  const iSub = L.add('substation', iron.junctions[0] + 1, ARM_T);
  // exit column: both circuit belts turn into it and load the exit tile from the two sides, one lane each
  const e = core.end;
  L.run('red', 'circuits', e, 0, e, ARM_T); L.run('red', 'circuits', e, 12, e, ARM_B);
  const exit = L.belt('red', 'circuits', e, MID, E);
  // metal trunks, last (they surface only on tiles nothing else uses)
  trunk(L, ARM_T, [{ from: lava.copperStart, to: lava.copperStart }, ...core.copperStops]);
  trunk(L, ARM_B, [{ from: lava.ironStart, to: lava.ironStart }, ...iron.junctions.map(x => ({ from: x, to: x }))]);
  const inputs = [
    { id: 'IN-1', item: 'lava', kind: 'pipe', side: 'west', entity: lava.lavaEntrance, perMinute: z.panel.lava, panel: L.panel(0, 2, `IN: lava ${z.panel.lava}/min`, 'lava', 'fluid') },
    { id: 'IN-2', item: 'calcite', kind: 'belt', side: 'west', entity: lava.calciteEntrance, perMinute: z.panel.calcite, panel: L.panel(0, 5, `IN: calcite ${z.panel.calcite}/min`, 'calcite') },
  ];
  const outputs = [
    { id: 'OUT-1', item: 'electronic-circuit', kind: 'belt', side: 'east', entity: exit, perMinute: TARGET, product: true, panel: L.panel(e - 1, MID, `OUT: electronic-circuit ${TARGET}/min`, 'electronic-circuit') },
    { id: 'OUT-STONE', item: 'stone', kind: 'belt', side: 'west', entity: lava.stoneExit, perMinute: z.panel.stone, byproduct: true, panel: L.panel(0, 8, `OUT: stone ${z.panel.stone}/min`, 'stone') },
  ];
  const powerLabel = 'POWER: connect this substation';
  return assemble({
    id: ID, layout: L, label: 'Electronic circuits from lava | Vulcanus | 1,200 a minute',
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus. West: lava by pipe, calcite on a belt, stone leaves on a belt and must be carried away; connect power to the labelled substation. East: electronic circuits on one red belt. Foundries melt and cast inside. No modules, no beacons. See the README for ports and the native test.`,
    icons: ['electronic-circuit', 'foundry', 'lava', 'calcite'], iconTypes: { lava: 'fluid' },
    inputs, outputs, product: 'electronic-circuit', target: TARGET,
    power: { entry: lava.substation, panel: L.panel(0, 9, powerLabel, 'substation'), label: powerLabel, externalPole: { x: -5, y: 10 } },
    products: ['electronic-circuit'], sizing: z,
    lines: { calcite: ['calcite'], stone: ['stone'], plates: ['iron-plate'], circuits: ['electronic-circuit'] },
    exitCarries: 'a red belt carries 1,800 a minute (900 a lane); the two bands load one lane each, 600 a minute a lane at the target',
    intendedUse: 'electronic circuits on a belt from lava and calcite; molten iron and copper, plates and cable are made inside',
    text: text(z),
  }, p, slots, options);
}

const n = v => Math.round(v).toLocaleString('en-US');
function text(z) {
  const d = z.need;
  return {
    title: 'Electronic circuits from lava · 1,200 a minute', productName: 'electronic circuits',
    makes: 'Turns lava and calcite into electronic (green) circuits on one red belt, 1,200 a minute. Foundries melt the lava into molten iron and molten copper and cast iron plates and copper cable; assembling machines 3 make the circuits. It needs nothing else: no plates, no water, no coal.',
    arithmetic: `At 1,200 circuits a minute: ${n(d.plate)} iron plates and ${n(d.cable)} copper cable a minute, cast from ${n(d.moltenIron)} molten iron and ${n(d.moltenCopper)} molten copper, melted in ${(d.copperLavaCrafts + d.ironLavaCrafts).toFixed(1)} lava crafts a minute: ${n(d.lava)} lava and ${d.calcite.toFixed(1)} calcite in, ${n(d.stone)} stone out.`,
    generousNote: 'Offered more, it makes more than the target: the six plate foundries then cast without pause and set the pace.',
    supplies: [],
    how: [
      '**Lava block** (west, columns 0 to 16). Four lava foundries: two for molten copper in the top row, two for molten iron in the bottom row. Lava comes in at the west edge and reaches every foundry through the two lava columns (3 and 15, joined by one underground pipe under row 6). The column between the foundries (9) is the only place the metals come out: molten copper in its top half, molten iron in its bottom half, with the stone belt between them.',
      '**Calcite and stone share row 6.** Calcite comes in on a yellow belt and runs east underground, surfacing on one tile beside each pair of foundries; a filtered fast arm per foundry takes it there. Stone is dropped by one bulk arm per foundry onto a red belt running west, which dives under the calcite tiles and leaves by row 7. Yellow and red underground belts do not join, which is what lets the two cross.',
      '**Iron block** (columns 17 to 33). Six foundries cast iron plate, three above and three below the corridor, fed from two iron pipe columns (17 and 28). Each drops its plates with one bulk arm onto the red belt of row 6, which runs east through the circuit core; the top row loads one lane and the bottom row the other.',
      '**Circuit core** (columns 34 to 72). Three triplets, each a cable foundry between two assembling machines 3, in a top band and a mirrored bottom band: six cable foundries and twelve circuit machines. Cable never touches a belt: two bulk arms carry it from the foundry straight into each machine. Each machine takes plates from the belt of row 6 with one bulk arm and puts its circuits with one bulk arm on the belt of its band (row 0 or row 12), which dives under the cable foundries.',
      '**Metal trunks.** Molten copper travels east under row 5 and molten iron under row 7, as underground pipe wherever something stands in the way. Copper comes up under every cable foundry of the top band and crosses row 6 there on one pipe to the foundry below; iron comes up at the two iron columns.',
      '**Exit.** The two circuit belts turn into column 73 and load the exit tile from the north and from the south, one lane each.',
    ],
    limits: [
      'Connect the stone exit before anything else. Unconnected, the build makes a few hundred circuits from what is in its pipes and then stands still; it was left like that for an hour in the test and carried on within two minutes of being connected.',
      'The figures hold at the panel supply. With less lava or calcite it makes less; the cut, outage and late-input tests show it does not jam and returns to the rate when supply does.',
      'The exit belt is red and carries 1,800 a minute; at the target each lane holds 600 of its 900. Do not replace it with a yellow belt (900 a minute in all).',
      'The calcite entrance is a yellow belt; any belt can feed it. Only about 38 calcite a minute are used.',
    ],
  };
}
