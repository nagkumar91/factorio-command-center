const fs = require('fs');

// Read the with_beacons.json file
const data = JSON.parse(fs.readFileSync('./utility_science/with_beacons.json', 'utf-8'));

// Process entities
const filteredEntities = data.blueprint.entities.filter(entity => {
  // Remove beacons
  if (entity.name === 'beacon') {
    return false;
  }
  
  // Remove entities with quality: legendary
  if (entity.quality === 'legendary') {
    return false;
  }
  
  return true;
});

// Replace inserter and belt types, re-number sequentially
const processedEntities = filteredEntities.map((entity, index) => {
  const newEntity = JSON.parse(JSON.stringify(entity)); // deep copy
  
  // Update entity number
  newEntity.entity_number = index + 1;
  
  // Replace stack-inserter with bulk-inserter
  if (newEntity.name === 'stack-inserter') {
    newEntity.name = 'bulk-inserter';
  }
  
  // Replace turbo-underground-belt with express-underground-belt
  if (newEntity.name === 'turbo-underground-belt') {
    newEntity.name = 'express-underground-belt';
  }
  
  // Replace turbo-transport-belt with express-transport-belt
  if (newEntity.name === 'turbo-transport-belt') {
    newEntity.name = 'express-transport-belt';
  }
  
  return newEntity;
});

// Create new blueprint with processed entities
const newBlueprint = {
  blueprint: {
    description: data.blueprint.description,
    'snap-to-grid': data.blueprint['snap-to-grid'],
    icons: data.blueprint.icons,
    entities: processedEntities,
    item: data.blueprint.item,
    label: data.blueprint.label,
    version: data.blueprint.version
  }
};

// Write to no_beacons.json
const outPath = './utility_science/no_beacons.json';
fs.writeFileSync(outPath, JSON.stringify(newBlueprint, null, 2));

console.log('Processed blueprint saved to:', outPath);
console.log('Original entities:', data.blueprint.entities.length);
console.log('Processed entities:', processedEntities.length);
console.log('Removed:', data.blueprint.entities.length - processedEntities.length);
console.log('\nRemovals:');
console.log('- Beacons');
console.log('- Legendary quality items');
console.log('\nReplacements:');
console.log('- stack-inserter → bulk-inserter');
console.log('- turbo-underground-belt → express-underground-belt');
console.log('- turbo-transport-belt → express-transport-belt');
