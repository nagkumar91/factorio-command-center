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
  for (let x = s; x <= e; x += 1) {
    add('express-transport-belt', x + 0.5, y + 0.5, { direction: dir });
  }
}

function beltV(x, y1, y2, dir = 4) {
  const s = Math.min(y1, y2);
  const e = Math.max(y1, y2);
  for (let y = s; y <= e; y += 1) {
    add('express-transport-belt', x + 0.5, y + 0.5, { direction: dir });
  }
}

function pipesH(y, x1, x2) {
  const s = Math.min(x1, x2);
  const e = Math.max(x1, x2);
  for (let x = s; x <= e; x += 1) add('pipe', x + 0.5, y + 0.5);
}

// Molten copper input (connect from external bus)
add('pipe-to-ground', 0.5, 0.5, { direction: 4 });
pipesH(1, 0, 18);

// Three foundries casting copper cable
for (let i = 0; i < 3; i++) {
  const x = 4 + i * 7;
  add('foundry', x + 0.5, 4.5, {
    direction: 4,
    recipe: 'casting-copper-cable',
    recipe_quality: 'normal',
    items: [
      {
        id: { name: 'productivity-module-3' },
        items: {
          in_inventory: [
            { inventory: 4, stack: 0 },
            { inventory: 4, stack: 1 }
          ]
        }
      }
    ]
  });
  
  // Pipe connection
  pipesH(1, x, x + 1);
  add('pipe', x + 0.5, 2.5);
  add('pipe', x + 0.5, 3.5);
  
  // Output inserter + belt
  add('fast-inserter', x + 0.5, 7.5);
  add('express-transport-belt', x + 0.5, 8.5);
}

// Power for foundry row
add('medium-electric-pole', 1.5, 5.5);
add('medium-electric-pole', 8.5, 5.5);
add('medium-electric-pole', 15.5, 5.5);

// Cable belt lane (horizontal)
beltH(8, 0, 50, 2);

// Electronic circuit input belt (green chips from external source)
beltH(10, 0, 50, 2);

// Plastic input belt
beltH(12, 0, 50, 2);

// Advanced circuit plant rows
for (let row = 0; row < 2; row++) {
  const baseY = 16 + row * 10;
  
  for (let col = 0; col < 5; col++) {
    const x = 4 + col * 9;
    
    // EM plant
    add('electromagnetic-plant', x, baseY, {
      recipe: 'advanced-circuit',
      recipe_quality: 'normal',
      items: [
        {
          id: { name: 'productivity-module-3' },
          items: {
            in_inventory: [
              { inventory: 4, stack: 0 },
              { inventory: 4, stack: 1 },
              { inventory: 4, stack: 2 }
            ]
          }
        }
      ]
    });
    
    // Input inserters
    add('fast-inserter', x - 1.5, baseY + 1.5, { direction: 0 }); // from cable belt
    add('fast-inserter', x - 0.5, baseY + 1.5, { direction: 0 }); // from green circuit belt
    add('fast-inserter', x + 0.5, baseY + 1.5, { direction: 0 }); // from plastic belt
    
    // Belt drops to plants
    add('express-underground-belt', x - 1.5, baseY - 3.5, { type: 'input' });
    add('express-underground-belt', x - 1.5, baseY + 0.5, { type: 'output' });
    
    add('express-underground-belt', x - 0.5, baseY - 2.5, { type: 'input' });
    add('express-underground-belt', x - 0.5, baseY + 0.5, { type: 'output' });
    
    add('express-underground-belt', x + 0.5, baseY - 1.5, { type: 'input' });
    add('express-underground-belt', x + 0.5, baseY + 0.5, { type: 'output' });
    
    // Output inserter
    add('fast-inserter', x, baseY - 2, { direction: 8 });
    add('express-transport-belt', x, baseY - 3.5);
    
    // Power
    if (col % 2 === 0) {
      add('medium-electric-pole', x - 2.5, baseY);
    }
  }
  
  // Output belt lane
  beltH(baseY - 3, 0, 50, 2);
}

// Final output merge
beltH(30, 20, 50, 2);
add('express-splitter', 21, 13, { direction: 2 });
add('express-splitter', 21, 23, { direction: 2 });

const blueprint = {
  blueprint: {
    label: 'Red Chips Compact (No Beacons)',
    icons: [
      { signal: { type: 'item', name: 'advanced-circuit' }, index: 1 },
      { signal: { type: 'item', name: 'electromagnetic-plant' }, index: 2 }
    ],
    item: 'blueprint',
    version: 562949954928640,
    entities
  }
};

const outJson = './red-chip/compact_no_beacons.json';
const outTxt = './red-chip/compact_no_beacons.txt';
fs.writeFileSync(outJson, JSON.stringify(blueprint, null, 2));
const encoded = '0' + zlib.deflateSync(Buffer.from(JSON.stringify(blueprint))).toString('base64');
fs.writeFileSync(outTxt, encoded + '\n');
console.log('Wrote:', outJson);
console.log('Wrote:', outTxt);
console.log('Entities:', entities.length);
console.log('\nSetup: 3 foundries, 10 EM plants, no beacons');
console.log('Estimated output: ~25% of beaconed version');
