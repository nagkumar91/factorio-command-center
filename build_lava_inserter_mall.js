const fs = require('fs');
const zlib = require('zlib');

let n = 1;
const entities = [];

function add(name, x, y, extra = {}) {
  entities.push({ entity_number: n++, name, position: { x, y }, ...extra });
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

// Input belts (calcite + plastic)
beltH(0, 0, 70, 2);
add('fast-underground-belt', 28.5, 0.5, { direction: 2, type: 'input' });
add('fast-underground-belt', 33.5, 0.5, { direction: 2, type: 'output' });

// Lava pipe bus
add('pipe-to-ground', 0.5, 2.5, { direction: 4 });
pipesH(2, 1, 25);
add('pipe-to-ground', 26.5, 2.5, { direction: 12 });

// Molten foundries (lava -> molten)
add('foundry', 7.5, 6.5, { direction: 8, recipe: 'molten-iron-from-lava' });
add('foundry', 17.5, 6.5, { direction: 8, recipe: 'molten-copper-from-lava' });

// Calcite inserters
add('inserter', 6.5, 3.5, { direction: 4 });
add('inserter', 16.5, 3.5, { direction: 4 });

// Lava connections to foundries
pipesV(6, 2, 4);
pipesV(8, 2, 4);
pipesV(16, 2, 4);
pipesV(18, 2, 4);

// Molten manifolds down to casting
pipesV(7, 8, 10);
pipesV(17, 8, 10);
pipesH(10, 4, 13); // iron branch
pipesH(10, 14, 18); // copper branch

// Casting foundries
add('foundry', 4.5, 13.5, { direction: 8, recipe: 'casting-iron' });
add('foundry', 10.5, 13.5, { direction: 8, recipe: 'casting-iron-gear-wheel' });
add('foundry', 16.5, 13.5, { direction: 8, recipe: 'casting-copper-cable' });

// Fluid hookups to casting foundries (north-side inputs for direction 8)
pipesV(4, 10, 11);
pipesV(10, 10, 11);
pipesV(16, 10, 11);

// Intermediate output chests + pickup belts
add('inserter', 7.5, 13.5, { direction: 2 });
add('passive-provider-chest', 8.5, 13.5); // iron
add('inserter', 9.5, 13.5, { direction: 2 });

add('inserter', 13.5, 13.5, { direction: 2 });
add('passive-provider-chest', 14.5, 13.5); // gear
add('inserter', 15.5, 13.5, { direction: 2 });

add('inserter', 19.5, 13.5, { direction: 2 });
add('passive-provider-chest', 20.5, 13.5); // cable
add('inserter', 21.5, 13.5, { direction: 2 });

// Main intermediate belt lanes
beltH(13, 10, 68, 2); // iron lane
beltH(14, 16, 68, 2); // gear lane
beltH(15, 22, 68, 2); // cable lane

// A_electronic-circuit
add('assembling-machine-3', 30.5, 13.5, { recipe: 'electronic-circuit' });
add('inserter', 28.5, 13.5, { direction: 2 }); // iron in from lane
add('long-handed-inserter', 30.5, 16.5, { direction: 0 }); // cable in
add('inserter', 32.5, 13.5, { direction: 2 }); // out
add('passive-provider-chest', 33.5, 13.5); // ec chest (intermediate)
add('inserter', 34.5, 13.5, { direction: 2 });

// EC lane
beltH(13, 35, 68, 2);

// A_inserter
add('assembling-machine-3', 40.5, 13.5, { recipe: 'inserter' });
add('inserter', 38.5, 13.5, { direction: 2 }); // ec in
add('long-handed-inserter', 40.5, 16.5, { direction: 0 }); // gear in
add('long-handed-inserter', 39.5, 16.5, { direction: 0 }); // iron in
add('inserter', 42.5, 13.5, { direction: 2 }); // out
add('passive-provider-chest', 43.5, 13.5); // inserter chest (intermediate+final)
add('inserter', 44.5, 13.5, { direction: 2 });

// Inserter lane
beltH(13, 45, 68, 2);

// A_long-handed-inserter
add('assembling-machine-3', 50.5, 11.5, { recipe: 'long-handed-inserter' });
add('long-handed-inserter', 50.5, 14.5, { direction: 0 }); // inserter in
add('long-handed-inserter', 49.5, 14.5, { direction: 0 }); // iron in
add('inserter', 51.5, 14.5, { direction: 0 }); // gear in
add('inserter', 52.5, 11.5, { direction: 2 });
add('passive-provider-chest', 53.5, 11.5); // final

// A_fast-inserter
add('assembling-machine-3', 50.5, 16.5, { recipe: 'fast-inserter' });
add('inserter', 48.5, 16.5, { direction: 2 }); // inserter in
add('long-handed-inserter', 50.5, 19.5, { direction: 0 }); // ec in
add('inserter', 51.5, 19.5, { direction: 0 }); // iron in
add('inserter', 52.5, 16.5, { direction: 2 });
add('passive-provider-chest', 53.5, 16.5); // fast chest (intermediate+final)
add('inserter', 54.5, 16.5, { direction: 2 });

// Fast lane
beltH(16, 55, 68, 2);

// A_advanced-circuit
add('assembling-machine-3', 60.5, 13.5, { recipe: 'advanced-circuit' });
add('inserter', 58.5, 13.5, { direction: 2 }); // ec in
add('long-handed-inserter', 60.5, 16.5, { direction: 0 }); // cable in
add('inserter', 61.5, 3.5, { direction: 4 }); // plastic from top input belt
beltV(61, 4, 10, 4);
beltH(16, 59, 61, 2);
add('inserter', 62.5, 13.5, { direction: 2 });
add('passive-provider-chest', 63.5, 13.5); // advanced chest (intermediate)
add('inserter', 64.5, 13.5, { direction: 2 });

// Advanced lane
beltH(13, 65, 68, 2);

// A_bulk-inserter
add('assembling-machine-3', 60.5, 19.5, { recipe: 'bulk-inserter' });
add('inserter', 58.5, 19.5, { direction: 2 }); // gear in
add('inserter', 60.5, 17.5, { direction: 4 }); // ec in
add('inserter', 60.5, 21.5, { direction: 0 }); // adv in
add('inserter', 62.5, 18.5, { direction: 6 }); // fast in
add('inserter', 62.5, 20.5, { direction: 2 }); // out
add('passive-provider-chest', 63.5, 20.5); // final bulk output

// Minimal feeder belts around bulk
beltH(18, 56, 62, 2);
beltH(17, 58, 61, 2);
beltH(21, 58, 61, 2);

// Side buffers for intermediates near lanes (explicit storage)
add('passive-provider-chest', 36.5, 14.5);
add('passive-provider-chest', 46.5, 14.5);
add('passive-provider-chest', 56.5, 14.5);

// Power poles
for (const x of [4.5, 12.5, 20.5, 28.5, 36.5, 44.5, 52.5, 60.5, 68.5]) {
  add('medium-electric-pole', x, 9.5);
  add('medium-electric-pole', x, 16.5);
}

// A few underground segments for lane crossings / compactness
add('fast-underground-belt', 27.5, 13.5, { direction: 2, type: 'input' });
add('fast-underground-belt', 29.5, 13.5, { direction: 2, type: 'output' });
add('fast-underground-belt', 47.5, 13.5, { direction: 2, type: 'input' });
add('fast-underground-belt', 49.5, 13.5, { direction: 2, type: 'output' });

const blueprint = {
  blueprint: {
    label: 'Lava Inserter Mall v1 (Hybrid Belts + Buffers)',
    icons: [
      { signal: { type: 'item', name: 'bulk-inserter' }, index: 1 },
      { signal: { type: 'item', name: 'fast-inserter' }, index: 2 },
      { signal: { type: 'item', name: 'foundry' }, index: 3 }
    ],
    item: 'blueprint',
    version: 562949954928640,
    entities
  }
};

const outJson = './lava_inserter_mall_v1.json';
const outTxt = './lava_inserter_mall_v1.txt';
fs.writeFileSync(outJson, JSON.stringify(blueprint, null, 2));
const encoded = '0' + zlib.deflateSync(Buffer.from(JSON.stringify(blueprint))).toString('base64');
fs.writeFileSync(outTxt, encoded + '\n');
console.log('Wrote:', outJson);
console.log('Wrote:', outTxt);
console.log('Entities:', entities.length);
