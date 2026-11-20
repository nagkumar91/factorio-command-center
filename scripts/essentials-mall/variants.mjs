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
export const VARIANTS = {'no-rear': noRear, 'no-rear-late-iron': noRearLate, 'no-rear-drill-inside': noRearDrillInside, 'no-rear-am1-inside': noRearAm1Inside, 'no-rear-am1-bulk': noRearAm1Bulk, reference, unclocked, 'three-gears': threeGears, 'three-gears-long': threeGearsLong, 'top-drill': topDrill, 'corner-gear': cornerGear, 'narrow-west': narrowWest, 'narrow-west-splitter': narrowWestSplitter, 'narrow-west-outer': narrowWestOuter, 'narrow-west-feed': narrowWestFeed, 'one-column-west': oneColumnWest};
export const PUBLISHED_VARIANT = 'one-column-west';
