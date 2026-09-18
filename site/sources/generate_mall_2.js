const fs = require('fs');
const zlib = require('zlib');

let n = 1;
const entities = [];

function add(name, x, y, extra = {}) {
  entities.push({ entity_number: n++, name, position: { x, y }, ...extra });
  return n - 1;
}

function beltH(y, x1, x2, dir = 2) {
  const s = Math.min(x1, x2);
  const e = Math.max(x1, x2);
  for (let x = s; x <= e; x += 1) add('fast-transport-belt', x + 0.5, y + 0.5, { direction: dir });
}

function beltV(x, y1, y2, dir = 4) {
  const s = Math.min(y1, y2);
  const e = Math.max(y1, y2);
  for (let y = s; y <= e; y += 1) add('fast-transport-belt', x + 0.5, y + 0.5, { direction: dir });
}

function pipesH(y, x1, x2) {
  const s = Math.min(x1, x2);
  const e = Math.max(x1, x2);
  for (let x = s; x <= e; x += 1) add('pipe', x + 0.5, y + 0.5);
}

function pipesV(x, y1, y2) {
  const s = Math.min(y1, y2);
  const e = Math.max(y1, y2);
  for (let y = s; y <= e; y += 1) add('pipe', x + 0.5, y + 0.5);
}

// We will build a compact mall.
// Inputs: Molten Iron, Molten Copper, Crude Oil, Water, Coal.
// We will use a linear layout.

// 1. Foundries for basic materials
add('foundry', 5.5, 5.5, { direction: 8, recipe: 'iron-plate' });
add('foundry', 15.5, 5.5, { direction: 8, recipe: 'iron-gear-wheel' });
add('foundry', 25.5, 5.5, { direction: 8, recipe: 'steel-plate' });
add('foundry', 35.5, 5.5, { direction: 8, recipe: 'copper-plate' });
add('foundry', 45.5, 5.5, { direction: 8, recipe: 'copper-cable' });
add('foundry', 55.5, 5.5, { direction: 8, recipe: 'pipe' });

// Molten Iron pipe
add('display-panel', 0.5, 0.5, { text: 'Molten Iron', icon: { type: 'fluid', name: 'molten-iron' } });
add('pipe-to-ground', 0.5, 1.5, { direction: 4 });
pipesH(1, 1, 60);
pipesV(5, 1, 2);
pipesV(15, 1, 2);
pipesV(25, 1, 2);
pipesV(55, 1, 2);

// Molten Copper pipe
add('display-panel', 0.5, 2.5, { text: 'Molten Copper', icon: { type: 'fluid', name: 'molten-copper' } });
add('pipe-to-ground', 0.5, 3.5, { direction: 4 });
pipesH(2, 1, 4);
add('pipe-to-ground', 4.5, 2.5, { direction: 12 });
add('pipe-to-ground', 6.5, 2.5, { direction: 4 });
pipesH(2, 7, 14);
add('pipe-to-ground', 14.5, 2.5, { direction: 12 });
add('pipe-to-ground', 16.5, 2.5, { direction: 4 });
pipesH(2, 17, 24);
add('pipe-to-ground', 24.5, 2.5, { direction: 12 });
add('pipe-to-ground', 26.5, 2.5, { direction: 4 });
pipesH(2, 27, 50);
pipesV(35, 2, 2);
pipesV(45, 2, 2);

// Output belts from foundries
beltV(5, 8, 10, 4);
beltV(15, 8, 10, 4);
beltV(25, 8, 10, 4);
beltV(35, 8, 10, 4);
beltV(45, 8, 10, 4);
beltV(55, 8, 10, 4);

// Main bus
const busY = 12;
beltH(busY, 5, 150, 2); // Iron plate
beltH(busY+1, 15, 150, 2); // Gear
beltH(busY+2, 25, 150, 2); // Steel
beltH(busY+3, 35, 150, 2); // Copper plate
beltH(busY+4, 45, 150, 2); // Copper cable
beltH(busY+5, 55, 150, 2); // Pipe

// Oil processing
add('oil-refinery', 65.5, 5.5, { recipe: 'advanced-oil-processing' });
// Inputs: Crude Oil, Water (bottom of refinery)
add('display-panel', 59.5, 8.5, { text: 'Crude Oil', icon: { type: 'fluid', name: 'crude-oil' } });
add('pipe-to-ground', 59.5, 9.5, { direction: 4 });
pipesH(9, 60, 64); // Crude Oil
add('pipe-to-ground', 65.5, 9.5, { direction: 12 });
add('pipe-to-ground', 67.5, 9.5, { direction: 4 });
pipesH(9, 68, 70); // Crude Oil

add('display-panel', 59.5, 10.5, { text: 'Water', icon: { type: 'fluid', name: 'water' } });
add('pipe-to-ground', 59.5, 11.5, { direction: 4 });
pipesH(10, 60, 100); // Water
pipesV(64, 8, 9); // Crude oil to 64.5, 8.5
pipesV(66, 8, 10); // Water to 66.5, 8.5

// Outputs: Heavy, Light, Gas (top of refinery)
pipesH(-1, 63, 73); // Heavy
pipesH(-1, 75, 100); // Heavy
pipesH(0, 65, 68); // Light
pipesH(0, 70, 100); // Light
pipesH(1, 67, 78); // Gas
pipesH(1, 80, 110); // Gas
pipesV(63, -1, 2); // Heavy from 63.5, 2.5
pipesV(65, 0, 2); // Light from 65.5, 2.5
pipesV(67, 1, 2); // Gas from 67.5, 2.5

// Lubricant
add('chemical-plant', 75.5, 5.5, { recipe: 'lubricant' });
add('pipe-to-ground', 74.5, -1.5, { direction: 8 }); // Heavy in from Y=-1.5
add('pipe-to-ground', 74.5, 2.5, { direction: 0 }); // Jump over light and gas
pipesV(74, 2, 3); // Connect to 74.5, 3.5
pipesV(76, 7, 11); // Lube out from 76.5, 7.5 to Y=11.5
pipesH(11, 76, 150); // Lube bus

// Heavy oil cracking
const tankId = add('storage-tank', 68.5, -2.5, { direction: 4 }); // Tank for heavy oil
pipesV(68, -2, -1); // Connect tank to heavy oil bus (Y=-1.5)
add('chemical-plant', 70.5, -7.5, { recipe: 'heavy-oil-cracking' });
const pumpId = add('pump', 67.5, -5.5, { direction: 0, control_behavior: { circuit_condition: { condition: { first_signal: { type: 'fluid', name: 'heavy-oil' }, constant: 20000, comparator: '>' } } } });
// Wire pump to tank
entities[pumpId - 1].connections = { 1: { green: [{ entity_id: tankId }] } };
entities[tankId - 1].connections = { 1: { green: [{ entity_id: pumpId }] } };

pipesV(67, -10, -4); // Heavy oil from tank (67.5, -3.5) to pump (67.5, -4.5) and pump out (67.5, -6.5) to top
pipesH(-10, 67, 69); // Connect to chemical plant top-left (69.5, -9.5)
pipesV(72, -10, 10); // Water from Y=10.5 to 72.5, -9.5
pipesH(-10, 71, 72); // Connect to 71.5, -9.5 (top right)
pipesV(69, -6, -3); // Light oil out from 69.5, -5.5 to Y=-2.5
add('pipe-to-ground', 69.5, -2.5, { direction: 8 }); // Jump over heavy oil
add('pipe-to-ground', 69.5, -0.5, { direction: 0 }); // Connect to light oil bus
pipesV(69, -1, 0); // Connect to Y=0.5

// Light oil cracking
const lightTankId = add('storage-tank', 78.5, -2.5, { direction: 4 }); // Tank for light oil
pipesV(78, -1, 0); // Connect tank to light oil bus (Y=0.5)
add('chemical-plant', 80.5, -7.5, { recipe: 'light-oil-cracking' });
const lightPumpId = add('pump', 77.5, -5.5, { direction: 0, control_behavior: { circuit_condition: { condition: { first_signal: { type: 'fluid', name: 'light-oil' }, constant: 20000, comparator: '>' } } } });
// Wire pump to tank
entities[lightPumpId - 1].connections = { 1: { green: [{ entity_id: lightTankId }] } };
entities[lightTankId - 1].connections = { 1: { green: [{ entity_id: lightPumpId }] } };

pipesV(77, -10, -4); // Light oil from tank to pump and pump out to top
pipesH(-10, 77, 79); // Connect to chemical plant top-left (79.5, -9.5)
pipesV(82, -10, 10); // Water from Y=10.5 to 82.5, -9.5
pipesH(-10, 81, 82); // Connect to 81.5, -9.5 (top right)
pipesV(79, -6, -3); // Gas out from 79.5, -5.5 to Y=-2.5
add('pipe-to-ground', 79.5, -2.5, { direction: 8 }); // Jump over heavy and light oil
add('pipe-to-ground', 79.5, 1.5, { direction: 0 }); // Connect to gas bus

// Sulfur
add('chemical-plant', 85.5, 5.5, { recipe: 'sulfur' });
pipesV(83, 3, 10); // Water in from Y=10.5 to Y=3.5
pipesH(3, 83, 84); // Connect to 84.5, 3.5 (top left)
pipesV(86, 1, 3); // Gas in from Y=1.5 to 86.5, 3.5 (top right)
add('inserter', 85.5, 8.5, { direction: 4 }); // Sulfur out
beltH(9, 85, 95, 2); // Sulfur belt to sulfuric acid

// Sulfuric Acid
add('chemical-plant', 95.5, 5.5, { recipe: 'sulfuric-acid' });
pipesV(93, 3, 10); // Water in from Y=10.5 to Y=3.5
pipesH(3, 93, 94); // Connect to 94.5, 3.5 (top left)
add('inserter', 95.5, 8.5, { direction: 0 }); // Sulfur in
pipesV(96, 7, 12); // Acid out from 96.5, 7.5 to Y=12.5
pipesH(12, 96, 150); // Acid bus

// Plastic
add('chemical-plant', 105.5, 5.5, { recipe: 'plastic-bar' });
pipesV(104, 1, 3); // Gas in from Y=1.5 to 104.5, 3.5
// Coal in
add('display-panel', -0.5, -12.5, { text: 'Coal', icon: { type: 'item', name: 'coal' } });
add('fast-underground-belt', -0.5, -11.5, { direction: 2, type: 'input' });
beltH(-12, 0, 105, 2); // Coal bus
beltV(105, -11, 0, 4);
add('fast-underground-belt', 105.5, 0.5, { direction: 4, type: 'input' });
add('fast-underground-belt', 105.5, 2.5, { direction: 4, type: 'output' });
beltV(105, 3, 3, 4);
add('inserter', 105.5, 3.5, { direction: 4 });
// Plastic out
add('inserter', 105.5, 8.5, { direction: 4 });
beltV(105, 9, busY+6, 4);
beltH(busY+6, 105, 150, 2); // Plastic bus

// Battery
add('chemical-plant', 115.5, 5.5, { recipe: 'battery' });
pipesV(113, 3, 12); // Acid in from Y=12.5 to Y=3.5
pipesH(3, 113, 114); // Connect to 114.5, 3.5
// Iron and Copper in
add('fast-underground-belt', 115.5, busY+0.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 115.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 115.5, 7.5, { direction: 0 });
add('fast-underground-belt', 116.5, busY+3.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 116.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 116.5, 7.5, { direction: 0 });
// Battery out
add('inserter', 114.5, 8.5, { direction: 4 });
beltV(114, 9, busY+7, 4);
beltH(busY+7, 114, 150, 2); // Battery bus

// Electronic Circuit
add('assembling-machine-3', 125.5, 5.5, { recipe: 'electronic-circuit' });
add('fast-underground-belt', 124.5, busY+0.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 124.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 124.5, 7.5, { direction: 0 });
add('fast-underground-belt', 126.5, busY+4.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 126.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 126.5, 7.5, { direction: 0 });
add('inserter', 125.5, 8.5, { direction: 4 });
beltV(125, 9, busY+8, 4);
beltH(busY+8, 125, 150, 2); // EC bus

// Advanced Circuit
add('assembling-machine-3', 135.5, 5.5, { recipe: 'advanced-circuit' });
add('fast-underground-belt', 134.5, busY+8.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 134.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 134.5, 7.5, { direction: 0 });
add('fast-underground-belt', 135.5, busY+4.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 135.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 135.5, 7.5, { direction: 0 });
add('fast-underground-belt', 136.5, busY+6.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 136.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 136.5, 7.5, { direction: 0 });
add('inserter', 137.5, 5.5, { direction: 2 });
beltV(138, 5, busY+9, 4);
beltH(busY+9, 138, 150, 2); // AC bus

// Now we have all intermediates on the bus.
// Bus lanes:
// busY+0: Iron plate
// busY+1: Gear
// busY+2: Steel
// busY+3: Copper plate
// busY+4: Copper cable
// busY+5: Pipe
// busY+6: Plastic
// busY+7: Battery
// busY+8: EC
// busY+9: AC
// Fluids:
// 11: Lube
// 12: Acid

// Let's build the mall machines below the bus.
const mallY = 30;

function buildMachine(x, recipe, inputs, outputChest = true) {
  add('assembling-machine-3', x + 0.5, mallY + 0.5, { recipe });
  let i = 0;
  for (const input of inputs) {
    const lane = busY + input + 0.5;
    add('fast-underground-belt', x - 0.5 + i, lane, { direction: 4, type: 'input' });
    add('fast-underground-belt', x - 0.5 + i, mallY - 2.5, { direction: 4, type: 'output' });
    add('inserter', x - 0.5 + i, mallY - 1.5, { direction: 4 });
    i++;
  }
  if (outputChest) {
    add('inserter', x + 0.5, mallY + 2.5, { direction: 4 });
    add('passive-provider-chest', x + 0.5, mallY + 3.5);
  }
}

// Inserters
buildMachine(10, 'inserter', [0, 1, 8], false);
add('inserter', 10.5, mallY + 2.5, { direction: 4 });
beltH(mallY + 3, 10, 25, 2); // Inserter belt
add('inserter', 10.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 10.5, mallY + 5.5);

buildMachine(15, 'long-handed-inserter', [0, 1], false);
add('inserter', 15.5, mallY + 2.5, { direction: 0 }); // Pick up inserter
add('inserter', 15.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 15.5, mallY + 5.5);

buildMachine(20, 'fast-inserter', [0, 8], false);
add('inserter', 20.5, mallY + 2.5, { direction: 0 }); // Pick up inserter
add('inserter', 20.5, mallY + 4.5, { direction: 4 });
beltH(mallY + 5, 20, 25, 2); // Fast inserter belt
add('inserter', 20.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 20.5, mallY + 7.5);

buildMachine(25, 'bulk-inserter', [1, 8, 9], false);
add('inserter', 25.5, mallY + 4.5, { direction: 0 }); // Pick up fast inserter
add('inserter', 25.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 25.5, mallY + 7.5);

// Belts
buildMachine(30, 'transport-belt', [0, 1], false);
add('inserter', 30.5, mallY + 2.5, { direction: 4 });
beltH(mallY + 3, 30, 55, 2); // Transport belt belt
add('inserter', 30.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 30.5, mallY + 5.5);

buildMachine(35, 'fast-transport-belt', [1], false);
add('inserter', 35.5, mallY + 2.5, { direction: 0 }); // Pick up transport belt
add('inserter', 35.5, mallY + 4.5, { direction: 4 });
beltH(mallY + 5, 35, 55, 2); // Fast transport belt belt
add('inserter', 35.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 35.5, mallY + 7.5);

buildMachine(40, 'express-transport-belt', [1], false);
add('inserter', 40.5, mallY + 4.5, { direction: 0 }); // Pick up fast transport belt
pipesV(40, 11, mallY - 2); // Lube
add('inserter', 40.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 40.5, mallY + 7.5);

buildMachine(45, 'underground-belt', [0], false);
add('inserter', 45.5, mallY + 2.5, { direction: 0 }); // Pick up transport belt
add('inserter', 45.5, mallY + 4.5, { direction: 4 });
beltH(mallY + 5, 45, 55, 2); // Underground belt belt
add('inserter', 45.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 45.5, mallY + 7.5);

buildMachine(50, 'fast-underground-belt', [1], false);
add('inserter', 50.5, mallY + 4.5, { direction: 0 }); // Pick up underground belt
add('inserter', 50.5, mallY + 6.5, { direction: 4 });
beltH(mallY + 7, 50, 55, 2); // Fast underground belt belt
add('inserter', 50.5, mallY + 8.5, { direction: 4 });
add('passive-provider-chest', 50.5, mallY + 9.5);

buildMachine(55, 'express-underground-belt', [1], false);
add('inserter', 55.5, mallY + 6.5, { direction: 0 }); // Pick up fast underground belt
pipesV(55, 11, mallY - 2); // Lube
add('inserter', 55.5, mallY + 8.5, { direction: 4 });
add('passive-provider-chest', 55.5, mallY + 9.5);

buildMachine(60, 'splitter', [0, 8], false);
add('inserter', 60.5, mallY + 2.5, { direction: 0 }); // Pick up transport belt
add('inserter', 60.5, mallY + 4.5, { direction: 4 });
beltH(mallY + 5, 60, 70, 2); // Splitter belt
add('inserter', 60.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 60.5, mallY + 7.5);

buildMachine(65, 'fast-splitter', [1, 8], false);
add('inserter', 65.5, mallY + 4.5, { direction: 0 }); // Pick up splitter
add('inserter', 65.5, mallY + 6.5, { direction: 4 });
beltH(mallY + 7, 65, 70, 2); // Fast splitter belt
add('inserter', 65.5, mallY + 8.5, { direction: 4 });
add('passive-provider-chest', 65.5, mallY + 9.5);

buildMachine(70, 'express-splitter', [1, 9], false);
add('inserter', 70.5, mallY + 6.5, { direction: 0 }); // Pick up fast splitter
pipesV(70, 11, mallY - 2); // Lube
add('inserter', 70.5, mallY + 8.5, { direction: 4 });
add('passive-provider-chest', 70.5, mallY + 9.5);

// Power & Pipes
buildMachine(75, 'medium-electric-pole', [2, 3]);
buildMachine(80, 'big-electric-pole', [2, 3]);
buildMachine(85, 'substation', [2, 3, 9]);
buildMachine(90, 'pipe', [0], false);
add('inserter', 90.5, mallY + 2.5, { direction: 4 });
beltH(mallY + 3, 90, 95, 2); // Pipe belt
add('inserter', 90.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 90.5, mallY + 5.5);

buildMachine(95, 'pipe-to-ground', [0], false);
add('inserter', 95.5, mallY + 2.5, { direction: 0 }); // Pick up pipe
add('inserter', 95.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 95.5, mallY + 5.5);

buildMachine(100, 'storage-tank', [0, 2]);
buildMachine(105, 'lamp', [0, 4, 8]);

// Pipe output chest (from bus)
add('fast-underground-belt', 103.5, busY+5.5, { direction: 4, type: 'input' });
add('fast-underground-belt', 103.5, mallY - 2.5, { direction: 4, type: 'output' });
add('inserter', 103.5, mallY - 1.5, { direction: 4 });
add('passive-provider-chest', 103.5, mallY - 0.5);

// Robots
buildMachine(110, 'engine-unit', [1, 2, 5], false);
add('inserter', 112.5, mallY + 0.5, { direction: 2 }); // Output engine unit to chest
add('wooden-chest', 113.5, mallY + 0.5);
add('inserter', 114.5, mallY + 0.5, { direction: 2 }); // Take engine unit from chest

buildMachine(115, 'electric-engine-unit', [8], false); // Needs engine unit, lube
pipesV(115, 11, mallY - 2); // Lube from busY-1 (11) to top of machine
add('inserter', 117.5, mallY + 0.5, { direction: 2 }); // Output electric engine unit to chest
add('wooden-chest', 118.5, mallY + 0.5);
add('inserter', 119.5, mallY + 0.5, { direction: 2 }); // Direct insert to flying robot frame

buildMachine(120, 'flying-robot-frame', [2, 7, 8], false); // Needs electric engine unit
// Output flying robot frame to a belt
add('inserter', 120.5, mallY + 2.5, { direction: 4 });
beltH(mallY + 3, 120, 130, 2);

// Logistic robot
buildMachine(125, 'logistic-robot', [9], false); // Needs flying robot frame
add('inserter', 125.5, mallY + 2.5, { direction: 0 }); // Take flying robot frame from belt
add('inserter', 126.5, mallY + 0.5, { direction: 2 }); // Output
add('passive-provider-chest', 127.5, mallY + 0.5);

// Construction robot
buildMachine(130, 'construction-robot', [8], false); // Needs flying robot frame
add('inserter', 130.5, mallY + 2.5, { direction: 0 }); // Take flying robot frame from belt
add('inserter', 131.5, mallY + 0.5, { direction: 2 }); // Output
add('passive-provider-chest', 132.5, mallY + 0.5);

const blueprint = {
  blueprint: {
    label: '2.0 Mall',
    icons: [{ signal: { type: 'item', name: 'fast-inserter' }, index: 1 }],
    item: 'blueprint',
    version: 562949954928640,
    entities
  }
};

fs.writeFileSync('mall.json', JSON.stringify(blueprint, null, 2));
const encoded = '0' + zlib.deflateSync(Buffer.from(JSON.stringify(blueprint))).toString('base64');
fs.writeFileSync('mall.txt', encoded + '\n');
