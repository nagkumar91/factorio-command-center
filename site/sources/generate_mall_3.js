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

const busY = 12;
const verticalBelts = [];
const pullOffs = [];

function addVerticalBelt(x, startY, targetY) {
  verticalBelts.push({ x, startY, targetY });
  if (targetY - 1 >= startY) {
    beltV(x, startY, targetY - 1, 4);
  }
}

function crosses(x, y) {
  return verticalBelts.some(vb => vb.x === x && y > vb.startY && y < vb.targetY);
}

function hasSplitter(x, y) {
  return pullOffs.some(po => po.x === x && (busY + po.laneIndex * 2 === y || busY + po.laneIndex * 2 + 1 === y));
}

function drawBusLane(y, startX, endX) {
  let x = startX;
  while (x <= endX) {
    if (crosses(x + 1, y)) {
      add('fast-underground-belt', x + 0.5, y + 0.5, { direction: 2, type: 'input' });
      let jumpEnd = x + 1;
      while (crosses(jumpEnd + 1, y)) {
        jumpEnd++;
      }
      add('fast-underground-belt', jumpEnd + 1.5, y + 0.5, { direction: 2, type: 'output' });
      x = jumpEnd + 2;
    } else {
      if (!hasSplitter(x, y)) {
        add('fast-transport-belt', x + 0.5, y + 0.5, { direction: 2 });
      }
      x++;
    }
  }
}

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
addVerticalBelt(5, 8, busY); // Iron
addVerticalBelt(15, 8, busY + 2); // Gear
addVerticalBelt(25, 8, busY + 4); // Steel
addVerticalBelt(35, 8, busY + 6); // Copper
addVerticalBelt(45, 8, busY + 8); // Copper cable
addVerticalBelt(55, 8, busY + 10); // Pipe

// Oil processing
add('oil-refinery', 65.5, 5.5, { recipe: 'advanced-oil-processing' });
add('display-panel', 59.5, 8.5, { text: 'Crude Oil', icon: { type: 'fluid', name: 'crude-oil' } });
add('pipe-to-ground', 59.5, 9.5, { direction: 4 });
pipesH(9, 60, 64);
add('pipe-to-ground', 65.5, 9.5, { direction: 12 });
add('pipe-to-ground', 67.5, 9.5, { direction: 4 });
pipesH(9, 68, 70);

add('display-panel', 59.5, 10.5, { text: 'Water', icon: { type: 'fluid', name: 'water' } });
add('pipe-to-ground', 59.5, 11.5, { direction: 4 });
pipesH(10, 60, 100);
pipesV(64, 8, 9);
pipesV(66, 8, 10);

pipesH(-1, 63, 73);
pipesH(-1, 75, 100);
pipesH(0, 65, 68);
pipesH(0, 70, 100);
pipesH(1, 67, 78);
pipesH(1, 80, 110);
pipesV(63, -1, 2);
pipesV(65, 0, 2);
pipesV(67, 1, 2);

// Lubricant
add('chemical-plant', 75.5, 5.5, { recipe: 'lubricant' });
add('pipe-to-ground', 74.5, -1.5, { direction: 8 });
add('pipe-to-ground', 74.5, 2.5, { direction: 0 });
pipesV(74, 2, 3);
pipesV(76, 7, 11);
pipesH(11, 76, 150);

// Heavy oil cracking
const tankId = add('storage-tank', 68.5, -2.5, { direction: 4 });
pipesV(68, -2, -1);
add('chemical-plant', 70.5, -7.5, { recipe: 'heavy-oil-cracking' });
const pumpId = add('pump', 67.5, -5.5, { direction: 0, control_behavior: { circuit_condition: { condition: { first_signal: { type: 'fluid', name: 'heavy-oil' }, constant: 20000, comparator: '>' } } } });
entities[pumpId - 1].connections = { 1: { green: [{ entity_id: tankId }] } };
entities[tankId - 1].connections = { 1: { green: [{ entity_id: pumpId }] } };

pipesV(67, -10, -4);
pipesH(-10, 67, 69);
pipesV(72, -10, 10);
pipesH(-10, 71, 72);
pipesV(69, -6, -3);
add('pipe-to-ground', 69.5, -2.5, { direction: 8 });
add('pipe-to-ground', 69.5, -0.5, { direction: 0 });
pipesV(69, -1, 0);

// Light oil cracking
const lightTankId = add('storage-tank', 78.5, -2.5, { direction: 4 });
pipesV(78, -1, 0);
add('chemical-plant', 80.5, -7.5, { recipe: 'light-oil-cracking' });
const lightPumpId = add('pump', 77.5, -5.5, { direction: 0, control_behavior: { circuit_condition: { condition: { first_signal: { type: 'fluid', name: 'light-oil' }, constant: 20000, comparator: '>' } } } });
entities[lightPumpId - 1].connections = { 1: { green: [{ entity_id: lightTankId }] } };
entities[lightTankId - 1].connections = { 1: { green: [{ entity_id: lightPumpId }] } };

pipesV(77, -10, -4);
pipesH(-10, 77, 79);
pipesV(82, -10, 10);
pipesH(-10, 81, 82);
pipesV(79, -6, -3);
add('pipe-to-ground', 79.5, -2.5, { direction: 8 });
add('pipe-to-ground', 79.5, 1.5, { direction: 0 });

// Sulfur
add('chemical-plant', 85.5, 5.5, { recipe: 'sulfur' });
pipesV(83, 3, 10);
pipesH(3, 83, 84);
pipesV(86, 1, 3);
add('inserter', 85.5, 8.5, { direction: 4 });
beltH(9, 85, 95, 2);

// Sulfuric Acid
add('chemical-plant', 95.5, 5.5, { recipe: 'sulfuric-acid' });
pipesV(93, 3, 10);
pipesH(3, 93, 94);
add('inserter', 95.5, 8.5, { direction: 0 });
pipesV(96, 7, 10);
pipesH(10, 96, 150); // Acid bus at y=10

// Plastic
add('chemical-plant', 105.5, 5.5, { recipe: 'plastic-bar' });
pipesV(104, 1, 3);
add('display-panel', -0.5, -12.5, { text: 'Coal', icon: { type: 'item', name: 'coal' } });
add('fast-underground-belt', -0.5, -11.5, { direction: 2, type: 'input' });
beltH(-12, 0, 105, 2);
beltV(105, -11, 0, 4);
add('fast-underground-belt', 105.5, 0.5, { direction: 4, type: 'input' });
add('fast-underground-belt', 105.5, 2.5, { direction: 4, type: 'output' });
beltV(105, 3, 3, 4);
add('inserter', 105.5, 3.5, { direction: 4 });
add('inserter', 105.5, 8.5, { direction: 4 });
addVerticalBelt(105, 9, busY + 12); // Plastic

// Battery
add('chemical-plant', 115.5, 5.5, { recipe: 'battery' });
pipesV(113, 3, 10); // Acid in from Y=10.5
pipesH(3, 113, 114);
// Iron and Copper in
add('fast-underground-belt', 115.5, busY+0.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 115.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 115.5, 7.5, { direction: 0 });
add('fast-underground-belt', 116.5, busY+6.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 116.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 116.5, 7.5, { direction: 0 });
add('inserter', 114.5, 8.5, { direction: 4 });
addVerticalBelt(114, 9, busY + 14); // Battery

// Electronic Circuit
add('assembling-machine-3', 125.5, 5.5, { recipe: 'electronic-circuit' });
add('fast-underground-belt', 124.5, busY+0.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 124.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 124.5, 7.5, { direction: 0 });
add('fast-underground-belt', 126.5, busY+8.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 126.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 126.5, 7.5, { direction: 0 });
add('inserter', 125.5, 8.5, { direction: 4 });
addVerticalBelt(125, 9, busY + 16); // EC

// Advanced Circuit
add('assembling-machine-3', 135.5, 5.5, { recipe: 'advanced-circuit' });
add('fast-underground-belt', 134.5, busY+16.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 134.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 134.5, 7.5, { direction: 0 });
add('fast-underground-belt', 135.5, busY+8.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 135.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 135.5, 7.5, { direction: 0 });
add('fast-underground-belt', 136.5, busY+12.5, { direction: 0, type: 'input' });
add('fast-underground-belt', 136.5, 8.5, { direction: 0, type: 'output' });
add('inserter', 136.5, 7.5, { direction: 0 });
add('inserter', 137.5, 5.5, { direction: 2 });
addVerticalBelt(138, 5, busY + 18); // AC

const mallY = 35;

function buildMachine(x, recipe, inputs, outputChest = true) {
  add('assembling-machine-3', x + 0.5, mallY + 0.5, { recipe });
  let i = 0;
  for (const input of inputs) {
    const laneY = busY + input * 2;
    const tileX = Math.floor(x) - 1 + i;
    
    pullOffs.push({ x: tileX, laneIndex: input });
    addVerticalBelt(tileX, laneY + 1, mallY - 1);
    
    add('inserter', tileX + 0.5, mallY - 1.5, { direction: 4 });
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
beltH(mallY + 3, 10, 25, 2);
add('inserter', 10.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 10.5, mallY + 5.5);

buildMachine(15, 'long-handed-inserter', [0, 1], false);
add('inserter', 15.5, mallY + 2.5, { direction: 0 });
add('inserter', 15.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 15.5, mallY + 5.5);

buildMachine(20, 'fast-inserter', [0, 8], false);
add('inserter', 20.5, mallY + 2.5, { direction: 0 });
add('inserter', 20.5, mallY + 4.5, { direction: 4 });
beltH(mallY + 5, 20, 25, 2);
add('inserter', 20.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 20.5, mallY + 7.5);

buildMachine(25, 'bulk-inserter', [1, 8, 9], false);
add('inserter', 25.5, mallY + 4.5, { direction: 0 });
add('inserter', 25.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 25.5, mallY + 7.5);

// Belts
buildMachine(30, 'transport-belt', [0, 1], false);
add('inserter', 30.5, mallY + 2.5, { direction: 4 });
beltH(mallY + 3, 30, 55, 2);
add('inserter', 30.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 30.5, mallY + 5.5);

buildMachine(35, 'fast-transport-belt', [1], false);
add('inserter', 35.5, mallY + 2.5, { direction: 0 });
add('inserter', 35.5, mallY + 4.5, { direction: 4 });
beltH(mallY + 5, 35, 55, 2);
add('inserter', 35.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 35.5, mallY + 7.5);

buildMachine(40, 'express-transport-belt', [1], false);
add('inserter', 40.5, mallY + 4.5, { direction: 0 });
pipesV(40, 11, mallY - 2);
add('inserter', 40.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 40.5, mallY + 7.5);

buildMachine(45, 'underground-belt', [0], false);
add('inserter', 45.5, mallY + 2.5, { direction: 0 });
add('inserter', 45.5, mallY + 4.5, { direction: 4 });
beltH(mallY + 5, 45, 55, 2);
add('inserter', 45.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 45.5, mallY + 7.5);

buildMachine(50, 'fast-underground-belt', [1], false);
add('inserter', 50.5, mallY + 4.5, { direction: 0 });
add('inserter', 50.5, mallY + 6.5, { direction: 4 });
beltH(mallY + 7, 50, 55, 2);
add('inserter', 50.5, mallY + 8.5, { direction: 4 });
add('passive-provider-chest', 50.5, mallY + 9.5);

buildMachine(55, 'express-underground-belt', [1], false);
add('inserter', 55.5, mallY + 6.5, { direction: 0 });
pipesV(55, 11, mallY - 2);
add('inserter', 55.5, mallY + 8.5, { direction: 4 });
add('passive-provider-chest', 55.5, mallY + 9.5);

buildMachine(60, 'splitter', [0, 8], false);
add('inserter', 60.5, mallY + 2.5, { direction: 0 });
add('inserter', 60.5, mallY + 4.5, { direction: 4 });
beltH(mallY + 5, 60, 70, 2);
add('inserter', 60.5, mallY + 6.5, { direction: 4 });
add('passive-provider-chest', 60.5, mallY + 7.5);

buildMachine(65, 'fast-splitter', [1, 8], false);
add('inserter', 65.5, mallY + 4.5, { direction: 0 });
add('inserter', 65.5, mallY + 6.5, { direction: 4 });
beltH(mallY + 7, 65, 70, 2);
add('inserter', 65.5, mallY + 8.5, { direction: 4 });
add('passive-provider-chest', 65.5, mallY + 9.5);

buildMachine(70, 'express-splitter', [1, 9], false);
add('inserter', 70.5, mallY + 6.5, { direction: 0 });
pipesV(70, 11, mallY - 2);
add('inserter', 70.5, mallY + 8.5, { direction: 4 });
add('passive-provider-chest', 70.5, mallY + 9.5);

buildMachine(75, 'medium-electric-pole', [2, 3]);
buildMachine(80, 'big-electric-pole', [2, 3]);
buildMachine(85, 'substation', [2, 3, 9]);
buildMachine(90, 'pipe', [0], false);
add('inserter', 90.5, mallY + 2.5, { direction: 4 });
beltH(mallY + 3, 90, 95, 2);
add('inserter', 90.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 90.5, mallY + 5.5);

buildMachine(95, 'pipe-to-ground', [0], false);
add('inserter', 95.5, mallY + 2.5, { direction: 0 });
add('inserter', 95.5, mallY + 4.5, { direction: 4 });
add('passive-provider-chest', 95.5, mallY + 5.5);

buildMachine(100, 'storage-tank', [0, 2]);
buildMachine(105, 'lamp', [0, 4, 8]);

// Pipe output chest (from bus)
pullOffs.push({ x: 103, laneIndex: 5 });
addVerticalBelt(103, busY + 5 * 2 + 1, mallY - 1);
add('inserter', 103.5, mallY - 1.5, { direction: 4 });
add('passive-provider-chest', 103.5, mallY - 0.5);

// Robots
buildMachine(110, 'engine-unit', [1, 2, 5], false);
add('inserter', 112.5, mallY + 0.5, { direction: 2 });
add('wooden-chest', 113.5, mallY + 0.5);
add('inserter', 114.5, mallY + 0.5, { direction: 2 });

buildMachine(115, 'electric-engine-unit', [8], false);
pipesV(115, 11, mallY - 2);
add('inserter', 117.5, mallY + 0.5, { direction: 2 });
add('wooden-chest', 118.5, mallY + 0.5);
add('inserter', 119.5, mallY + 0.5, { direction: 2 });

buildMachine(120, 'flying-robot-frame', [2, 7, 8], false);
add('inserter', 120.5, mallY + 2.5, { direction: 4 });
beltH(mallY + 3, 120, 130, 2);

buildMachine(125, 'logistic-robot', [9], false);
add('inserter', 125.5, mallY + 2.5, { direction: 0 });
add('inserter', 126.5, mallY + 0.5, { direction: 2 });
add('passive-provider-chest', 127.5, mallY + 0.5);

buildMachine(130, 'construction-robot', [8], false);
add('inserter', 130.5, mallY + 2.5, { direction: 0 });
add('inserter', 131.5, mallY + 0.5, { direction: 2 });
add('passive-provider-chest', 132.5, mallY + 0.5);

// Draw the bus lanes
drawBusLane(busY, 5, 150); // Iron
drawBusLane(busY + 2, 15, 150); // Gear
drawBusLane(busY + 4, 25, 150); // Steel
drawBusLane(busY + 6, 35, 150); // Copper
drawBusLane(busY + 8, 45, 150); // Copper cable
drawBusLane(busY + 10, 55, 150); // Pipe
drawBusLane(busY + 12, 105, 150); // Plastic
drawBusLane(busY + 14, 114, 150); // Battery
drawBusLane(busY + 16, 125, 150); // EC
drawBusLane(busY + 18, 138, 150); // AC

// Place splitters for pull-offs
for (const po of pullOffs) {
  const laneY = busY + po.laneIndex * 2;
  add('fast-splitter', po.x + 0.5, laneY + 1.0, { direction: 2 });
}

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
