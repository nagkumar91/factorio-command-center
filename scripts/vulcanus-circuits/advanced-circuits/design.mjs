// Advanced circuits from lava, calcite and plastic, 240 a minute. A pure function of the pinned prototypes and the fluid-slot table.
// West to east, 13 rows: lava block (one lava foundry per metal), iron block (four plate foundries), circuit core (four cable
// foundries, each with one electronic circuit machine and one cable tap), advanced circuit block (twenty machines), ports.
import { Layout, N, E, S, W } from '../lib.mjs';
import { rates, lavaBlock, ironBlock, plateBelt, tapCore, acBlock, trunk, MID, ARM_T, ARM_B, TOP, RECIPE } from '../parts.mjs';
import { assemble } from '../package.mjs';

export const ID = 'advanced-circuits';
export const TARGET = 240;
export const PLASTIC_PER_COPY = 60;   // what one copy of the coal-plastic-lubricant blueprint gives a minute
export function sizing(p) {
  const r = rates(p), need = r.demand({ ac: TARGET });
  const count = { copperLava: 1, ironLava: 1, plate: 4, cable: 4, ec: 4, ac: 20 };
  return {
    target: { 'advanced-circuit': TARGET }, productivity: r.prod, need,
    machines: [
      { recipe: RECIPE.copperLava, count: count.copperLava, craftsNeeded: need.copperLavaCrafts, craftsEach: r.foundryCrafts(RECIPE.copperLava), why: '0.71 needed' },
      { recipe: RECIPE.ironLava, count: count.ironLava, craftsNeeded: need.ironLavaCrafts, craftsEach: r.foundryCrafts(RECIPE.ironLava), why: '0.57 needed' },
      { recipe: RECIPE.plate, count: count.plate, craftsNeeded: need.plateCrafts, craftsEach: r.foundryCrafts(RECIPE.plate), why: '2.13 needed, so three would do; the fourth is a spare that keeps the plate foundries in pairs above and below the belt' },
      { recipe: RECIPE.cable, count: count.cable, craftsNeeded: need.cableCrafts, craftsEach: r.foundryCrafts(RECIPE.cable), why: '3.33 needed' },
      { recipe: RECIPE.ec, count: count.ec, craftsNeeded: need.ec, craftsEach: r.am3Crafts(RECIPE.ec), why: '3.2 needed' },
      { recipe: RECIPE.ac, count: count.ac, craftsNeeded: TARGET, craftsEach: r.am3Crafts(RECIPE.ac), why: '19.2 needed' },
    ],
    panel: { lava: Math.ceil(need.lava / 10) * 10, calcite: Math.ceil(need.calcite), stone: Math.round(need.stone), 'plastic-bar': Math.ceil(need.plastic) },
    plasticCopies: Math.ceil(need.plastic / PLASTIC_PER_COPY),
  };
}

export function design(p, slots, options = {}) {
  const z = sizing(p), L = new Layout();
  const lava = lavaBlock(L, 0, 1);
  const iron = ironBlock(L, lava.width, 2);
  const x0 = lava.width + iron.width;
  // the plate belt of the iron block ends one tile past its last pipe column (it dives under it)
  const plateEnd = Math.max(iron.drops[iron.drops.length - 1], iron.junctions[iron.junctions.length - 1] + 1);
  plateBelt(L, iron.drops[0], plateEnd, iron.junctions);
  const core = tapCore(L, x0, 2, { plateFrom: plateEnd + 1 });
  L.add('substation', iron.junctions[0] + 1, ARM_T);
  const ac = acBlock(L, core.end, 5, [0, 2]);
  L.add('substation', ac.east, TOP);
  for (const [y, line] of [[0, 'feed-top'], [12, 'feed-bottom']]) for (let x = core.end; x <= ac.feedEnd; x++) L.belt('red', line, x, y, E);
  trunk(L, ARM_T, [{ from: lava.copperStart, to: lava.copperStart }, ...core.copperStops]);
  trunk(L, ARM_B, [{ from: lava.ironStart, to: lava.ironStart }, ...iron.junctions.map(x => ({ from: x, to: x }))]);
  const e = ac.end - 1;
  const inputs = [
    { id: 'IN-1', item: 'lava', kind: 'pipe', side: 'west', entity: lava.lavaEntrance, perMinute: z.panel.lava, panel: L.panel(0, 2, `IN: lava ${z.panel.lava}/min`, 'lava', 'fluid') },
    { id: 'IN-2', item: 'calcite', kind: 'belt', side: 'west', entity: lava.calciteEntrance, perMinute: z.panel.calcite, panel: L.panel(0, 5, `IN: calcite ${z.panel.calcite}/min`, 'calcite') },
    { id: 'IN-3', item: 'plastic-bar', kind: 'belt', side: 'east', entity: ac.entrance, perMinute: z.panel['plastic-bar'], panel: L.panel(e, ARM_T, `IN: plastic-bar ${z.panel['plastic-bar']}/min`, 'plastic-bar') },
  ];
  const outputs = [
    { id: 'OUT-1', item: 'advanced-circuit', kind: 'belt', side: 'east', entity: ac.exit, perMinute: TARGET, product: true, panel: L.panel(e, ARM_B + 1, `OUT: advanced-circuit ${TARGET}/min`, 'advanced-circuit') },
    { id: 'OUT-STONE', item: 'stone', kind: 'belt', side: 'west', entity: lava.stoneExit, perMinute: z.panel.stone, byproduct: true, panel: L.panel(0, 8, `OUT: stone ${z.panel.stone}/min`, 'stone') },
  ];
  const powerLabel = 'POWER: connect this substation';
  return assemble({
    id: ID, layout: L, label: 'Advanced circuits from lava | Vulcanus | 240 a minute',
    description: `Factorio ${p.gameVersion} Space Age, Vulcanus. West: lava by pipe, calcite on a belt, stone leaves on a belt and must be carried away; connect power to the labelled substation. East: plastic bars in on a belt, advanced circuits out on the red belt below it. Cable and electronic circuits are made inside. No modules, no beacons. See the README for ports and the native test.`,
    icons: ['advanced-circuit', 'foundry', 'lava', 'plastic-bar'], iconTypes: { lava: 'fluid' },
    inputs, outputs, product: 'advanced-circuit', target: TARGET,
    power: { entry: lava.substation, panel: L.panel(0, 9, powerLabel, 'substation'), label: powerLabel, externalPole: { x: -5, y: 10 } },
    products: ['advanced-circuit'], sizing: z,
    lines: { calcite: ['calcite'], stone: ['stone'], plates: ['iron-plate'], 'feed-top': ['electronic-circuit', 'copper-cable'], 'feed-bottom': ['electronic-circuit', 'copper-cable'], plastic: ['plastic-bar'], advanced: ['advanced-circuit'] },
    exitCarries: 'a red belt carries 1,800 a minute; the top machines load one lane and the bottom machines the other, 120 a minute a lane at the target',
    intendedUse: 'advanced circuits on a belt from lava, calcite and plastic bars; molten metal, plates, cable and electronic circuits are made inside',
    text: text(z),
  }, p, slots, options);
}

const n = v => Math.round(v).toLocaleString('en-US');
function text(z) {
  const d = z.need;
  return {
    title: 'Advanced circuits from lava · 240 a minute', productName: 'advanced circuits',
    makes: 'Turns lava, calcite and plastic bars into advanced (red) circuits on one red belt, 240 a minute. Foundries melt the lava and cast iron plates and copper cable; the electronic circuits the recipe needs are made inside as well. The only item to bring besides lava and calcite is plastic.',
    arithmetic: `At 240 advanced circuits a minute: ${n(d.ec)} electronic circuits, ${n(d.plastic)} plastic bars and ${n(d.cable)} copper cable a minute (${n(d.ec * 3)} of it for the electronic circuits), ${n(d.plate)} iron plates; ${n(d.moltenIron)} molten iron and ${n(d.moltenCopper)} molten copper from ${(d.copperLavaCrafts + d.ironLavaCrafts).toFixed(1)} lava crafts a minute: ${n(d.lava)} lava and ${d.calcite.toFixed(1)} calcite in, ${n(d.stone)} stone out.`,
    generousNote: 'Offered more, it makes a little more than the target: the twenty advanced circuit machines can do 250 a minute between them.',
    supplies: [
      `**Plastic**: ${n(z.panel['plastic-bar'])} bars a minute at the target, two per circuit. The coal-to-plastic blueprint (\`vulcanus-supplies/coal-plastic-lubricant\`) gives ${PLASTIC_PER_COPY} a minute a copy, so this needs **${z.plasticCopies} copies** of it (or any other source of ${n(z.panel['plastic-bar'])} a minute). A yellow belt carries 900 a minute; the entrance is one.`,
    ],
    how: [
      '**Lava block** (west, columns 0 to 10). Two lava foundries, molten copper above and molten iron below, both fed from the lava column (3). Their metal comes out in column 9: molten copper in its top half, molten iron in its bottom half. Calcite comes in on a yellow belt on row 6 and surfaces beside the foundries; stone leaves on a red belt by row 7.',
      '**Iron block** (columns 11 to 22). Four foundries cast iron plate and drop it on the red belt of row 6, which runs east to the electronic circuit machines.',
      '**Circuit core** (columns 23 to 44). Two units, each in a top band and a mirrored bottom band: an assembling machine 3 making electronic circuits, a cable foundry beside it handing it cable with two bulk arms, and on the foundry\'s other side one bulk arm that puts cable on a three-tile belt. Four cable foundries and four electronic circuit machines.',
      '**Feed belts** (rows 0 and 12). Each electronic circuit machine drops its circuits on the feed belt of its band; they land on the outer lane. Each cable belt joins the same feed belt from the inner side, so the cable lands on the inner lane. The belt carries both east, one lane each, and ends at the last advanced circuit machine.',
      '**Advanced circuit block** (columns 45 to 78). Twenty assembling machines 3, ten above and ten below. One bulk arm takes electronic circuits and cable from the feed belt; one fast arm takes plastic from the yellow belt of row 6; one fast arm puts the finished circuit on the red belt of row 6. That row is two belts braided: plastic runs west from the east edge and is on the surface for two tiles in every pair of machines, and the red product belt dives under those tiles on its way east.',
      '**Metal trunks.** Molten copper travels east under row 5 to the four cable foundries, molten iron under row 7 to the two iron columns.',
    ],
    limits: [
      'Connect the stone exit before anything else; with it unconnected the build stops within minutes and waits.',
      'The two eastern ports are on neighbouring rows: plastic comes in on row 6 (yellow belt, running west), advanced circuits leave on row 7 (red belt, running east).',
      'The figures hold at the panel supply. With less plastic, lava or calcite it makes less; the cut, outage and late-input tests show it does not jam and returns to the rate when supply does.',
      'Electronic circuits and cable are made only as fast as the advanced circuit machines take them: both ride the feed belts, which fill and stop the machines behind them.',
    ],
  };
}
