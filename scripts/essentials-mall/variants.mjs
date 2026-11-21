// Layout variants for the essentials mall. Each is a complete description the
// generator turns into one blueprint string; history candidates keep their name.
const G = 'iron-gear-wheel', C = 'electronic-circuit', I = 'iron-plate';

// Ring limits (red network); spec section 6.
const limits = {
  [G]: 48, [C]: 32, [I]: 12, 'steel-plate': 12, 'stone-brick': 12, 'copper-cable': 12,
  'copper-plate': 6, 'plastic-bar': 6, 'advanced-circuit': 6, 'transport-belt': 8,
  'underground-belt': 4, inserter: 4, 'fast-inserter': 4, splitter: 2, 'assembling-machine-1': 2,
  'assembling-machine-2': 2, 'fast-underground-belt': 2, 'fast-splitter': 2, 'bulk-inserter': 2,
  'electric-furnace': 2, 'electric-mining-drill': 2,
};

// Arm plans: [dx within the 3-wide slot, kind, items, options].
// kind 'in' picks from the ring into the machine; 'out' puts the product on the
// ring under its limit; 'rear' takes iron from the rear belt (bottom row only).
const arms = {
  // Top row: inputs and output on the top belt.
  'fast-splitter': [[0, 'in', [G], {phase: 3}], [1, 'in', ['splitter', C]], [2, 'out']],
  'fast-underground-belt': [[0, 'in', [G], {phase: 1, name: 'bulk-inserter'}], [1, 'in', ['underground-belt']], [2, 'out']],
  'assembling-machine-2': [[0, 'in', [G], {phase: 2}], [1, 'in', ['steel-plate', C, 'assembling-machine-1']], [2, 'out']],
  'fast-inserter': [[0, 'in', [C, I, 'inserter']], [1, 'in', [C, I, 'inserter']], [2, 'out']],
  'bulk-inserter': [[0, 'in', [G], {phase: 3}], [1, 'in', [C, 'advanced-circuit', 'fast-inserter']], [2, 'out']],
  'fast-transport-belt': [[0, 'in', [G], {phase: 0, name: 'bulk-inserter'}], [1, 'in', ['transport-belt']]],
  // Inside row: inputs from the top belt, outputs to the bottom belt.
  'advanced-circuit': [[0, 'in', [C, 'plastic-bar', 'copper-cable']], [1, 'in', [C, 'plastic-bar', 'copper-cable']], [1, 'out']],
  'copper-cable': [[0, 'in', ['copper-plate']], [1, 'out']],
  inserter: [[0, 'in', [G], {phase: 3}], [1, 'in', [C, I]], [1, 'out']],
  'transport-belt': [[0, 'in', [G], {phase: 3}], [1, 'in', [I]], [1, 'out']],
  'electric-furnace': [[0, 'in', ['steel-plate', 'stone-brick']], [1, 'in', ['advanced-circuit'], {reserve: 1}], [1, 'out']],
  // Bottom row: front arms on the bottom belt, rear arms on the iron belt.
  splitter: [[0, 'in', [C, 'transport-belt']], [2, 'out'], [1, 'rear']],
  'underground-belt': [[0, 'in', ['transport-belt']], [2, 'out'], [1, 'rear']],
  'assembling-machine-1': [[0, 'in', [G], {phase: 2}], [1, 'in', [C]], [2, 'out'], [1, 'rear']],
  'electric-mining-drill': [[0, 'in', [G], {phase: 2}], [1, 'in', [C]], [2, 'out'], [1, 'rear']],
  [G]: [[1, 'out'], [0, 'rear'], [1, 'rear']],
};

// Intermediates (TB, inserter, AM1) are bounded by their own ring limits, so their gear arms need no clock.
const unclockedArms = {...arms,
  inserter: [[0, 'in', [G]], [1, 'in', [C, I]], [1, 'out']],
  'transport-belt': [[0, 'in', [G]], [1, 'in', [I]], [1, 'out']],
  'assembling-machine-1': [[0, 'in', [G]], [1, 'in', [C]], [2, 'out'], [1, 'rear']],
};

const reference = {
  name: 'reference',
  ringEast: 19,
  slotX: k => 3 * k - 2,
  westLeft: -3,
  top: ['fast-splitter', 'fast-underground-belt', 'assembling-machine-2', 'fast-inserter', 'bulk-inserter', 'fast-transport-belt'],
  inside: ['bay', 'advanced-circuit', 'copper-cable', 'inserter', 'transport-belt', 'electric-furnace'],
  bottom: ['splitter', 'underground-belt', 'assembling-machine-1', 'electric-mining-drill', G, G],
  eastOrder: ['assembling-machine-2', 'fast-underground-belt', 'fast-splitter', 'fast-inserter', 'bulk-inserter', 'electric-furnace', 'electric-mining-drill'],
  westFeeds: [{item: C, rows: [1, 2]}, {item: 'copper-plate', rows: [3]}, {item: 'steel-plate', rows: [4]}, {item: 'stone-brick', rows: [5]}],
  panelSpots: {
    'plastic-bar': [[-3, -3], [-3, -1], [-2, -3], [-2, -1]],
    [C]: [[-3, 0], [-2, 0], [-1, 0]],
    'copper-plate': [[-3, 2], [-3, 6]],
    'steel-plate': [[-3, 6], [-2, 6], [-1, 6]],
    'stone-brick': [[-3, 6], [-2, 6], [-1, 6], [-3, 7]],
    [I]: [[-3, 11], [-3, 10], [-2, 10]],
  },
  capCombinator: [20, -3],
  clockTiles: [[1, 1], [1, 4], [1, 5]], clockRingTile: [0, 5],
  windowTicks: 600,
  limits, arms,
};

const unclocked = {...reference, name: 'unclocked', arms: unclockedArms};

// Three gear machines on the rear iron belt; the underground-belt machine moves into
// the old bay. Eight 5-second gear windows, one final product per window
// (fast belts and fast undergrounds two each); intermediates take gears freely.
const B = 'bulk-inserter';
const threeGearArms = {...unclockedArms,
  'fast-transport-belt': [[0, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}], [1, 'in', ['transport-belt']], [2, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}]],
  'fast-underground-belt': [[0, 'in', [G], {phase: {cmp: '>', n: 5}, name: B}], [1, 'in', ['underground-belt']], [2, 'out']],
  'assembling-machine-2': [[0, 'in', [G], {phase: 2, name: B}], [1, 'in', ['steel-plate', C, 'assembling-machine-1']], [2, 'out']],
  'electric-mining-drill': [[0, 'in', [G], {phase: 3, name: B}], [1, 'in', [C]], [2, 'out'], [0, 'rear']],
  'bulk-inserter': [[0, 'in', [G], {phase: 4, name: B}], [1, 'in', [C, 'advanced-circuit', 'fast-inserter']], [2, 'out']],
  'fast-splitter': [[0, 'in', [G], {phase: 5, name: B}], [1, 'in', ['splitter', C]], [2, 'out']],
  'underground-belt': [[0, 'in', ['transport-belt', I]], [1, 'in', ['transport-belt', I]], [1, 'out']],
};
const threeGears = {...reference, name: 'three-gears',
  inside: ['underground-belt', 'advanced-circuit', 'copper-cable', 'inserter', 'transport-belt', 'electric-furnace'],
  bottom: ['splitter', 'assembling-machine-1', 'electric-mining-drill', G, G, G],
  arms: threeGearArms, phases: 8, windowTicks: 300,
  // West substation in the west zone, east one beside the chest column, one in the rear
  // band (the rear belt passes under it); two medium poles cover slots 3 and 4.
  clockTiles: [[-3, -4], [-3, -3], [-1, -3]], clockRingTile: [0, 0],
  rearGap: [8, 9],
  powerSpots: {substation: [[-2, 0], [21, -1], [9, 12]], medium: [[9, 1], [9, 5], [12, 1], [12, 5], [8, 1], [8, 5]]},
  panelSpots: {...reference.panelSpots, 'plastic-bar': [[-1, -1], [-1, -4]], [C]: [[-1, 0]], 'copper-plate': [[-3, 2]], 'steel-plate': [[-3, 6]], 'stone-brick': [[-2, 6], [-3, 7]], [I]: [[-3, 11], [-3, 10]]},
};
const threeGearsLong = {...threeGears, name: 'three-gears-long', windowTicks: 450};

// All gear-windowed finals on the top belt, ordered so each window follows one
// further downstream on the gear path (the wrap-around costs only a few seconds).
// The drill moves to the top row; fast inserters move to the bottom row where the
// inserter machine's output reaches them first.
const topDrillArms = {...threeGearArms,
  'fast-transport-belt': [[0, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}], [1, 'in', ['transport-belt']], [2, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}]],
  'bulk-inserter': [[0, 'in', [G], {phase: 2, name: B}], [1, 'in', [C, 'advanced-circuit', 'fast-inserter']], [2, 'out']],
  'electric-mining-drill': [[0, 'in', [G], {phase: 3, name: B}], [1, 'in', [C, I]], [2, 'out']],
  'assembling-machine-2': [[0, 'in', [G], {phase: 4, name: B}], [1, 'in', ['steel-plate', C, 'assembling-machine-1']], [2, 'out']],
  'fast-splitter': [[0, 'in', [G], {phase: 5, name: B}], [1, 'in', ['splitter', C]], [2, 'out']],
  'fast-underground-belt': [[0, 'in', [G], {phase: {cmp: '>', n: 5}, name: B}], [1, 'in', ['underground-belt']], [2, 'out']],
  'fast-inserter': [[0, 'in', [C, 'inserter']], [2, 'out'], [0, 'rear']],
};
const topDrill = {...threeGears, name: 'top-drill', windowTicks: 450, arms: topDrillArms,
  top: ['fast-splitter', 'fast-underground-belt', 'assembling-machine-2', 'electric-mining-drill', 'bulk-inserter', 'fast-transport-belt'],
  bottom: ['splitter', 'assembling-machine-1', 'fast-inserter', G, G, G],
  limits: {...limits, [I]: 16},
};

// Corner gear: a third gear machine at the ring's south-east corner (outside the
// six-slot rows, inside the rectangle) frees a slot for a second advanced-circuit
// machine. Fast inserters stop crafting while their chest is full (green gate on the
// inserter feed) and keep a ring reserve for the bulk-inserter machine (one decider).
const P = 'plastic-bar', CB = 'copper-cable', AC = 'advanced-circuit';
const cornerArms = {...topDrillArms,
  'fast-splitter': [[0, 'in', [G], {phase: 5, name: B}], [1, 'in', ['splitter', C], {relay: true}], [2, 'out']],
  'fast-underground-belt': [[0, 'in', [G], {phase: {cmp: '>', n: 5}, name: B}], [1, 'in', ['underground-belt'], {relay: true}], [2, 'out']],
  'assembling-machine-2': [[0, 'in', [G], {phase: 4, name: B}], [1, 'in', ['steel-plate', C, 'assembling-machine-1'], {relay: true}], [2, 'out']],
  'electric-mining-drill': [[0, 'in', [G], {phase: 3, name: B}], [1, 'in', [C, I], {relay: true}], [2, 'out']],
  'bulk-inserter': [[0, 'in', [G], {phase: 2, name: B}], [1, 'in', [C, AC, 'fast-inserter'], {relay: true}], [2, 'out']],
  'fast-transport-belt': [[0, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}], [1, 'in', ['transport-belt'], {relay: true}], [2, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}]],
  'fast-inserter@bottom': [[0, 'in', [C]], [1, 'in', ['inserter'], {capGate: 'fast-inserter'}], [2, 'out'], [0, 'rear']],
  splitter: [[0, 'in', [C, 'transport-belt']], [1, 'out'], [2, 'rear']],
  'underground-belt@bottom': [[0, 'in', ['transport-belt']], [2, 'out'], [0, 'rear']],
  'advanced-circuit@bottom': [[0, 'in', [C, P, CB], {relay: true}], [1, 'in', [C, P, CB], {relay: true}], [2, 'out']],
  'iron-gear-wheel@bottom7': [[0, 'out'], [0, 'rear'], [1, 'rear']],
};
const cornerGear = {...topDrill, name: 'corner-gear', arms: cornerArms,
  // Circuits enter through two bulk arms: the ring needs more than two fast arms deliver.
  westFeeds: [{item: C, rows: [1, 2], arm: B}, {item: 'copper-plate', rows: [3]}, {item: 'steel-plate', rows: [4]}, {item: 'stone-brick', rows: [5]}],
  top: ['fast-splitter', 'fast-underground-belt', 'assembling-machine-2', 'electric-mining-drill', 'bulk-inserter', 'fast-transport-belt'],
  inside: ['underground-belt', AC, CB, 'inserter', 'transport-belt', 'electric-furnace'],
  bottom: ['splitter', 'assembling-machine-1', G, 'fast-inserter', G, AC, G],
  limits: {...topDrill.limits, 'fast-inserter': 18},
  chestReserve: {item: 'fast-inserter', reserve: 14, at: [20, 7], ringTile: [19, 6]},
  rearGap: [11, 12],
  powerSpots: {substation: [[-1, 0], [21, -1], [12, 12]]},
  panelSpots: {...topDrill.panelSpots, 'plastic-bar': [[-3, -1], [-1, -4]], [C]: [[-3, 0]]},
};

// Narrow west: the west zone is two columns wide (24 x 17). Each entrance is a single
// belt tile its admission arm picks from; circuits get one bulk admission arm.
const narrowWest = {...cornerGear, name: 'narrow-west', westLeft: -2,
  westFeeds: [{item: C, rows: [1], arm: B}, {item: 'copper-plate', rows: [3]}, {item: 'steel-plate', rows: [4]}, {item: 'stone-brick', rows: [5]}],
  clockTiles: [[-2, -4], [-1, -4], [0, -4]], clockVertical: true, clockRingTile: [0, 0],
  panelSpots: {'plastic-bar': [[-2, 2]], [C]: [[-1, 2], [-1, 0]], 'copper-plate': [[-2, 6], [-1, 6]], 'steel-plate': [[-1, 6], [-2, 6]], 'stone-brick': [[-2, 7], [-1, 7]], [I]: [[-2, 11], [-2, 10]]},
};
// With one circuit admission arm the yellow-splitter machine (last on the circuit path)
// starved; it moves to the first inside slot and the underground-belt machine goes to the bottom row.
const narrowWestSplitter = {...narrowWest, name: 'narrow-west-splitter',
  inside: ['splitter', AC, CB, 'inserter', 'transport-belt', 'electric-furnace'],
  bottom: ['underground-belt', 'assembling-machine-1', G, 'fast-inserter', G, AC, G],
  arms: {...cornerArms,
    'splitter@inside': [[0, 'in', [C, I, 'transport-belt']], [1, 'in', [C, I, 'transport-belt']], [1, 'out']],
    'underground-belt@bottom': [[0, 'in', ['transport-belt']], [1, 'out'], [2, 'rear']],
  },
};
// The fast-inserter reserve rides the ring's outer lane: fast inserters move to the
// inside row (outputs drop on the outer lane) and transport belts to the bottom row.
const narrowWestOuter = {...narrowWestSplitter, name: 'narrow-west-outer',
  inside: ['splitter', AC, CB, 'inserter', 'fast-inserter', 'electric-furnace'],
  bottom: ['underground-belt', 'assembling-machine-1', G, 'transport-belt', G, AC, G],
  arms: {...narrowWestSplitter.arms,
    'fast-inserter@inside': [[0, 'in', [C, I]], [1, 'in', ['inserter'], {capGate: 'fast-inserter'}], [1, 'out']],
    'transport-belt@bottom': [[0, 'in', [G]], [1, 'out'], [0, 'rear']],
    // The fast-belt machine is the last gear consumer on the top belt: its second gear arm
    // takes only surplus (ring gears above 24), whatever passed every windowed consumer.
    'fast-transport-belt': [[0, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}], [1, 'in', ['transport-belt'], {relay: true}], [2, 'in', [G], {reserve: 24, name: B}]],
  },
  limits: {...narrowWest.limits, [G]: 36, 'steel-plate': 10, 'stone-brick': 10, [I]: 12},
};
// Review fix: with only the chest gate, a full fast-inserter chest stopped the fast-inserter machine
// and the bulk-inserter machine used up the ring's fast inserters (19 more, then none). One decider
// lets the inserter-feed arm run while the chest is below its cap OR the ring holds fewer than 4.
const feedGate = {item: 'fast-inserter', at: [15, 5], ringTile: [15, 6], ringBelow: 4};
const narrowWestFeed = {...narrowWestOuter, name: 'narrow-west-feed', feedGate};

// One-column west zone (23 x 17). The four single-row entrances are circuit-gated belts that
// side-load onto the ring's west column; plastic keeps its arm at (0,-1); iron runs straight into
// the rear belt and a bulk arm at (0,11) lifts ring iron onto (0,10)-(0,8) for the admission arm at
// (0,7). The clock moves to free tiles in row 5; the west substation is replaced by medium poles
// chained from the rear substation, which becomes the power port.
const oneColumnWest = {...narrowWestFeed, name: 'one-column-west', westLeft: -1, gatedEntrances: true, ironLift: true,
  westFeeds: [{item: C, rows: [1]}, {item: 'copper-plate', rows: [3]}, {item: 'steel-plate', rows: [4]}, {item: 'stone-brick', rows: [5]}],
  clockTiles: [[3, 5], [9, 5], [12, 5]], clockVertical: false, clockRingTile: [12, 6],
  powerSpots: {substation: [[21, -1], [12, 12]], medium: [[7, 5], [3, 1], [8, 1], [-1, 8]]},
  panelSpots: {'plastic-bar': [[-1, -1]], [C]: [[-1, 0]], 'copper-plate': [[-1, 2]], 'steel-plate': [[-1, 6]], 'stone-brick': [[-1, 7]], [I]: [[-1, 11]]},
};
// No rear band (23 x 15). Iron enters on a gated belt at row 2 and rides the ring's outer lane; the
// three gear machines take the first top-row slots after the north-west corner. Circuits come in
// on the inner lane through one bulk arm at the corner; plastic gets a gated belt. 18 machines:
// one advanced-circuit machine, and the corner slot stays empty.
const noRearArms = {...oneColumnWest.arms,
  [`${G}@top`]: [[0, 'in', [I], {name: B}], [1, 'in', [I], {name: B}], [2, 'out']],
  'assembling-machine-2': [[0, 'in', [G], {phase: 3, name: B}], [1, 'in', ['steel-plate', C, 'assembling-machine-1'], {relay: true}], [2, 'out']],
  'bulk-inserter': [[0, 'in', [G], {phase: 2, name: B}], [1, 'in', [C, AC, 'fast-inserter'], {relay: true}], [2, 'out']],
  'fast-transport-belt': [[0, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}], [1, 'in', ['transport-belt'], {relay: true}], [2, 'in', [G], {reserve: 24, name: B}]],
  'underground-belt@bottom': [[0, 'in', ['transport-belt', I]], [1, 'in', ['transport-belt', I]], [2, 'out']],
  'electric-mining-drill@bottom': [[0, 'in', [G], {phase: 4, name: B}], [1, 'in', [C, I]], [2, 'out']],
  'fast-splitter@bottom': [[0, 'in', [G], {phase: 5, name: B}], [1, 'in', ['splitter', C]], [2, 'out']],
  'fast-underground-belt@bottom': [[0, 'in', [G], {phase: {cmp: '>', n: 5}, name: B}], [1, 'in', ['underground-belt']], [2, 'out']],
  'assembling-machine-1@bottom': [[0, 'in', [G]], [1, 'in', [C, I]], [2, 'out']],
  'transport-belt@bottom': [[0, 'in', [G]], [1, 'in', [I]], [2, 'out']],
};
const noRear = {...oneColumnWest, name: 'no-rear', noRear: true,
  arms: noRearArms,
  top: [G, G, G, 'assembling-machine-2', 'bulk-inserter', 'fast-transport-belt'],
  inside: ['splitter', AC, CB, 'inserter', 'fast-inserter', 'electric-furnace'],
  bottom: ['underground-belt', 'electric-mining-drill', 'fast-splitter', 'fast-underground-belt', 'assembling-machine-1', 'transport-belt'],
  cornerFeed: {item: C, arm: B},
  westFeeds: [{item: 'plastic-bar', rows: [1]}, {item: I, rows: [2]}, {item: 'copper-plate', rows: [3]}, {item: 'steel-plate', rows: [4]}, {item: 'stone-brick', rows: [5]}],
  limits: {...oneColumnWest.limits, [I]: 48},
  powerSpots: undefined,
  panelSpots: {[C]: [[-1, -1]], 'plastic-bar': [[-1, 0]], [I]: [[-1, 6]], 'copper-plate': [[-1, 7]], 'steel-plate': [[-1, 8]], 'stone-brick': [[-1, 9]]},
};
// Iron enters last on the outer lane (row 1) so the small inputs merge first; fast belts take
// gears only in their two windows (the surplus arm sat upstream of every bottom-row final).
const noRearLate = {...noRear, name: 'no-rear-late-iron',
  westFeeds: [{item: I, rows: [1]}, {item: 'plastic-bar', rows: [2]}, {item: 'copper-plate', rows: [3]}, {item: 'steel-plate', rows: [4]}, {item: 'stone-brick', rows: [5]}],
  panelSpots: {[C]: [[-1, -1]], [I]: [[-1, 0]], 'plastic-bar': [[-1, 6]], 'copper-plate': [[-1, 7]], 'steel-plate': [[-1, 8]], 'stone-brick': [[-1, 9]]},
  arms: {...noRearArms, 'fast-transport-belt': [[0, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}], [1, 'in', ['transport-belt'], {relay: true}], [2, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}]]},
};
// The drill moves to the first inside slot (iron arrives there first), one bulk iron arm per gear
// machine, ten-second gear windows, ring gear limit 48 and iron 60. Closest no-rear candidate: its
// full protocol failed only AM2 1.90 < 2 during the furnace hold (AM1 short of iron on the bottom belt).
const noRearDrillInside = {...noRearLate, name: 'no-rear-drill-inside', windowTicks: 600,
  limits: {...noRearLate.limits, [G]: 48, [I]: 60},
  inside: ['electric-mining-drill', AC, CB, 'inserter', 'fast-inserter', 'electric-furnace'],
  bottom: ['underground-belt', 'splitter', 'fast-splitter', 'fast-underground-belt', 'assembling-machine-1', 'transport-belt'],
  arms: {...noRearLate.arms,
    [`${G}@top`]: [[0, 'in', [I], {name: B}], [2, 'out']],
    'electric-mining-drill@inside': [[0, 'in', [C, I]], [2, 'in', [G], {phase: 4, name: B}], [1, 'out']],
    'splitter@bottom': [[0, 'in', [C, I, 'transport-belt']], [1, 'in', [C, I, 'transport-belt']], [2, 'out']]},
};
// AM1 to the inside row (swapped with the inserter machine): AM2 4.90, but fast inserters 5.90 in
// recovery and fast undergrounds 1.40 in the furnace hold.
const noRearAm1Inside = {...noRearDrillInside, name: 'no-rear-am1-inside',
  inside: ['electric-mining-drill', AC, CB, 'assembling-machine-1', 'fast-inserter', 'electric-furnace'],
  bottom: ['underground-belt', 'splitter', 'fast-splitter', 'fast-underground-belt', 'inserter', 'transport-belt'],
  arms: {...noRearDrillInside.arms, 'assembling-machine-1@inside': [[0, 'in', [G]], [1, 'in', [C, I]], [1, 'out']], 'inserter@bottom': [[0, 'in', [G]], [1, 'in', [C, I]], [2, 'out']]},
};
// A bulk iron arm for AM1 instead: fast undergrounds fell to 1.00 steady.
const noRearAm1Bulk = {...noRearDrillInside, name: 'no-rear-am1-bulk',
  arms: {...noRearDrillInside.arms, 'assembling-machine-1@bottom': [[0, 'in', [G]], [1, 'in', [C, I], {name: B}], [2, 'out']]},
};
// Sixteen rows (23 x 16). The inside row keeps one arm row: its machines sit against the ring's
// bottom belt and both take from and deliver to the top belt, so the ring is six rows tall. The six
// ring tiles of the east column feed six chests; the drill moves to the rear corner slot and delivers
// straight down into its own chest at the foot of the chest column. The third gear machine takes the
// last bottom slot and the second advanced-circuit machine the drill's old top slot. Clock, deciders
// and poles move to free tiles in the bottom arm row and the north-east corner.
const sixteenRowsArms = {
  // Top row (arm row -1). Seven gear windows, each owned: fast belts 0-1, bulk inserters 2,
  // AM2 3, fast splitters 4, fast undergrounds 5-6; each follows one further downstream.
  'fast-splitter': [[0, 'in', [G], {phase: 4, name: B}], [1, 'in', ['splitter', C]], [2, 'out']],
  'fast-underground-belt': [[0, 'in', [G], {phase: {cmp: '>', n: 4}, name: B}], [1, 'in', ['underground-belt']], [2, 'out']],
  'assembling-machine-2': [[0, 'in', [G], {phase: 3, name: B}], [1, 'in', ['steel-plate', C, 'assembling-machine-1']], [2, 'out']],
  'advanced-circuit@top': [[0, 'in', [C, P, CB]], [1, 'in', [C, P, CB]], [2, 'out']],
  'bulk-inserter': [[0, 'in', [G], {phase: 2, name: B}], [1, 'in', [C, AC, 'fast-inserter']], [2, 'out']],
  'fast-transport-belt': [[0, 'in', [G], {phase: {cmp: '<', n: 2}, name: B}], [1, 'in', ['transport-belt']], [2, 'in', [G], {reserve: 16, name: B}]],
  // Inside row (one arm row, row 1): take from and deliver to the top belt.
  'splitter@inside': [[0, 'out'], [1, 'in', [C, I, 'transport-belt']]],
  'copper-cable': [[0, 'in', ['copper-plate']], [1, 'out']],
  'advanced-circuit@inside': [[0, 'in', [C, P, CB]], [1, 'out']],
  // The two inserter machines take circuits (and iron) only while the ring holds more than 10
  // circuits. With full supply the ring always does; with short supply they give way to the drill and
  // the AM1 machine at the end of the circuit route (fast inserters run at three times their floor).
  // Screened 8, 10, 12, 14, 16 and 24: 10 passed the whole protocol from 1.7 times the panel supply.
  'fast-inserter@inside': [[0, 'in', [C, I], {reserve: 10}], [1, 'in', ['inserter'], {capGate: 'fast-inserter'}], [2, 'out']],
  inserter: [[0, 'in', [G]], [1, 'in', [C, I], {reserve: 10}], [2, 'out']],
  // The furnace's steel and brick arm only relays the green cap wire to the fast-inserter feed arm.
  'electric-furnace': [[0, 'in', ['steel-plate', 'stone-brick'], {relay: true}], [1, 'in', [AC], {reserve: 1}], [2, 'out']],
  // Bottom row: front arms on the bottom belt (row 6), rear arms on the iron belt (row 10).
  'underground-belt@bottom': [[0, 'in', ['transport-belt']], [1, 'out'], [1, 'rear']],
  'assembling-machine-1': [[0, 'in', [G]], [1, 'in', [C]], [2, 'out'], [1, 'rear']],
  'transport-belt@bottom': [[0, 'in', [G]], [1, 'out'], [0, 'rear']],
  [G]: [[1, 'out'], [0, 'rear'], [1, 'rear']],
  'iron-gear-wheel@bottom5': [[1, 'out'], [1, 'rear'], [2, 'rear']],
  // The last gear machine also hands gears to the drill beside it over a two-tile belt behind them
  // (hardly any gear reaches the ring's south-east corner: every top-row final takes them first).
  'iron-gear-wheel@bottom6': [[1, 'out'], [0, 'rear', {name: B}], [2, 'rearOut', {}]],
  // Rear corner: one front arm on the ring's south-east corner takes circuits and iron; the gear arm
  // behind the machine stops while the drill chest is full.
  'electric-mining-drill@bottom': [[0, 'in', [C, I]], [0, 'rear', {capGate: 'electric-mining-drill', items: [G]}], [2, 'chest']],
};
// Drills never ride the ring; the drill is the last iron user on the ring, so the ring holds more iron.
const sixteenRowsLimits = {...oneColumnWest.limits, [I]: 20}; delete sixteenRowsLimits['electric-mining-drill'];
const sixteenRows = {...oneColumnWest, name: 'sixteen-rows', ringBottom: 5, insideOutTop: true,
  arms: sixteenRowsArms, limits: sixteenRowsLimits, phases: 7,
  top: ['fast-splitter', 'fast-underground-belt', 'assembling-machine-2', AC, 'bulk-inserter', 'fast-transport-belt'],
  // Inserters come out downstream of the fast-inserter machine and travel one lap to reach it, as before.
  inside: ['splitter', CB, AC, 'fast-inserter', 'inserter', 'electric-furnace'],
  bottom: ['underground-belt', 'assembling-machine-1', G, 'transport-belt', G, G, 'electric-mining-drill'],
  eastOrder: ['assembling-machine-2', 'fast-underground-belt', 'fast-splitter', 'fast-inserter', 'bulk-inserter', 'electric-furnace'],
  westFeeds: [{item: C, rows: [1]}, {item: 'copper-plate', rows: [2]}, {item: 'steel-plate', rows: [3]}, {item: 'stone-brick', rows: [4]}],
  chestReserve: {item: 'fast-inserter', reserve: 14, at: [20, 6], ringTile: [19, 5]},
  feedGate: {item: 'fast-inserter', at: [12, 6], ringTile: [13, 5], ringBelow: 4},
  clockTiles: [[19, -4, 'flat'], [19, -2, 'upright'], [15, 6, 'flat']], clockRingTile: [15, 5],
  rearGap: [12, 13],
  powerSpots: {substation: [[21, -1], [13, 11]], medium: [[3, 1], [9, 1], [7, 6], [-1, 8]]},
  panelSpots: {'plastic-bar': [[-1, -1]], [C]: [[-1, 0]], 'copper-plate': [[-1, 5]], 'steel-plate': [[-1, 6]], 'stone-brick': [[-1, 7]], [I]: [[-1, 10]]},
  // Measured for this exact layout (exploration runs with the harness's supply cap, not the qualification).
  supplyNote: "Plan supply above the entrance panels if all eight products should hold their floors at once: the panels are recipe totals at the floors, and with everything drawn every product runs above its floor. Exploration measurements with the harness's supply cap (the whole protocol with all eight cap phases, not part of the qualification): the protocol passed with every entrance capped at 1.7, 1.75, 1.8, 1.9 and 2 times its panel figure, and failed at 1.6 times (fast inserters 5.9 per minute in recovery against 6). At exactly the panel figures with all eight drawn, the drill made 0 per minute, fast inserters 2.3, furnaces 0.8, bulk inserters 0.95 and fast belts 7.95; assembling machine 2, fast undergrounds and fast splitters held their floors. With full belts the entrances took about 201 electronic circuits, 732 iron, 38 steel, 26 stone brick, 30 plastic and 30 copper per minute. With less supply the mall still fills every chest in turn: fed exactly the panel figures with nothing collected, all eight chests reached their caps; only the all-eight-at-once floors are lost.",
};
export const VARIANTS = {'sixteen-rows': sixteenRows, 'no-rear': noRear, 'no-rear-late-iron': noRearLate, 'no-rear-drill-inside': noRearDrillInside, 'no-rear-am1-inside': noRearAm1Inside, 'no-rear-am1-bulk': noRearAm1Bulk, reference, unclocked, 'three-gears': threeGears, 'three-gears-long': threeGearsLong, 'top-drill': topDrill, 'corner-gear': cornerGear, 'narrow-west': narrowWest, 'narrow-west-splitter': narrowWestSplitter, 'narrow-west-outer': narrowWestOuter, 'narrow-west-feed': narrowWestFeed, 'one-column-west': oneColumnWest};
export const PUBLISHED_VARIANT = 'sixteen-rows';
// Tested versions kept selectable on the website, newest first (the manifest's "versions" field; see
// scripts/blueprint-versions.mjs). The first is the published variant; each older one keeps its own string,
// manifest and passing native report under history/.
export const VERSIONS = [
  {variant: 'sixteen-rows', label: 'Sixteen rows', summary: 'Recommended: 23 × 16 = 368 tiles, 6% smaller; more assembling machines, fast undergrounds, bulk inserters and drills, and it holds the whole protocol from 1.7 times the panel supply.'},
  {variant: 'one-column-west', label: 'One column west', folder: 'history/one-column-west-d894c04a', summary: 'Earlier version: 23 × 17 = 391 tiles; faster for fast transport belts, fast inserters and electric furnaces, and needs 2 times the panel supply to hold the whole protocol.'},
];
