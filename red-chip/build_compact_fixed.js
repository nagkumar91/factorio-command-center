const fs = require('fs');
const zlib = require('zlib');

let n = 1;
const entities = [];

function add(name, x, y, extra = {}) {
  entities.push({ entity_number: n++, name, position: { x, y }, ...extra });
}

function modules(count, moduleType = 'productivity-module-3') {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({ inventory: 4, stack: i });
  }
  return [{
    id: { name: moduleType },
    items: { in_inventory: items }
  }];
}

// Layout: input belts very close to plants
// Cable lane x-position (1.5 tiles left of plant center)
const cableX = 8.5;
// Green chip lane x-position (1 tile left of plant center)
const greenX = 9;
// Plastic lane x-position (0.5 tiles left of plant center)
const plasticX = 9.5;
// EM plant center x-position
const plantX = 10;
// Output lane x-position (1.5 tiles right of plant center)
const outputX = 11.5;

// Foundries for cable (top section)
for (let i = 0; i < 3; i++) {
  const y = -10 + i * 6;
  
  add('foundry', 10, y, {
    direction: 4,
    recipe: 'casting-copper-cable',
    recipe_quality: 'normal',
    items: modules(2)
  });
  
  // Output inserter - place onto cable belt at x=8.5
  add('fast-inserter', 9.25, y, { direction: 4 });
  
  // Molten copper input (from left)
  add('pipe', 5.5, y);
  add('pipe', 6.5, y);
  add('pipe', 7.5, y);
}

// Input pipes for molten copper
add('pipe-to-ground', 5.5, -11, { direction: 0 });
for (let y = -10; y < 5; y++) {
  add('pipe', 5.5, y + 0.5);
}

// Power poles for foundries
add('medium-electric-pole', 10, -13);
add('medium-electric-pole', 10, -1);

// Create continuous vertical belt lanes first (no gaps)
for (let y = -10; y <= 54; y++) {
  add('express-transport-belt', cableX, y + 0.5);
  add('express-transport-belt', greenX, y + 0.5);
  add('express-transport-belt', plasticX, y + 0.5);
  add('express-transport-belt', outputX, y + 0.5, { direction: 8 });
}

// EM Plants (vertical arrangement)
for (let i = 0; i < 10; i++) {
  const y = 0 + i * 6;
  
  add('electromagnetic-plant', plantX, y, {
    recipe: 'advanced-circuit',
    recipe_quality: 'normal',
    items: modules(3)
  });
  
  // Input inserters (picking from left side belt lanes and placing into plant)
  // Cable inserter - pick from cable belt at x=8.5, feed into plant
  add('fast-inserter', 9.25, y - 1.5, { direction: 4 });
  add('fast-inserter', 9.25, y - 0.5, { direction: 4 });
  
  // Green chip inserter - pick from green belt at x=9
  add('fast-inserter', 9.5, y - 1.5, { direction: 4 });
  add('fast-inserter', 9.5, y - 0.5, { direction: 4 });
  
  // Plastic inserter - pick from plastic belt at x=9.5
  add('fast-inserter', 9.75, y - 1.5, { direction: 4 });
  
  // Output inserters (picking from plant and placing to right side belt lane at x=11.5)
  add('fast-inserter', 10.5, y - 1, { direction: 4 });
  add('fast-inserter', 10.5, y, { direction: 4 });
  
  // Power poles every other plant
  if (i % 2 === 0) {
    add('medium-electric-pole', plantX - 4, y);
    add('medium-electric-pole', plantX + 5, y);
  }
}

// Input belt connections (top) - underground belts to bring inputs in
add('express-underground-belt', cableX, -10.5, { type: 'input' });
add('express-underground-belt', greenX, -10.5, { type: 'input' });
add('express-underground-belt', plasticX, -10.5, { type: 'input' });

// Output belt collection (bottom)
add('express-underground-belt', outputX, 54.5, { type: 'output' });

const blueprint = {
  blueprint: {
    label: 'Red Chips Compact Fixed',
    icons: [
      { signal: { type: 'item', name: 'advanced-circuit' }, index: 1 },
      { signal: { type: 'item', name: 'electromagnetic-plant' }, index: 2 }
    ],
    item: 'blueprint',
    version: 562949954928640,
    entities
  }
};

const outJson = './red-chip/compact_fixed.json';
const outTxt = './red-chip/compact_fixed.txt';
fs.writeFileSync(outJson, JSON.stringify(blueprint, null, 2));
const encoded = '0' + zlib.deflateSync(Buffer.from(JSON.stringify(blueprint))).toString('base64');
fs.writeFileSync(outTxt, encoded + '\n');
console.log('Wrote:', outJson);
console.log('Wrote:', outTxt);
console.log('Entities:', entities.length);
console.log('\nCompact with vertical belt lanes like original');
console.log('3 foundries, 10 EM plants, vertical input/output lanes');
