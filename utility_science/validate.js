const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./utility_science/no_beacons.json', 'utf-8'));

console.log('Valid JSON: YES');
console.log('Blueprint:', data.blueprint.label);
console.log('Entities:', data.blueprint.entities.length);

// Verify no beacons
const hasBeacon = data.blueprint.entities.some(e => e.name === 'beacon');
const hasLegendary = data.blueprint.entities.some(e => e.quality === 'legendary');
const hasStack = data.blueprint.entities.some(e => e.name === 'stack-inserter');
const hasTurbo = data.blueprint.entities.some(e => e.name && e.name.includes('turbo'));

console.log('No beacons:', !hasBeacon);
console.log('No legendary:', !hasLegendary);
console.log('No stack-inserters:', !hasStack);
console.log('No turbo belts:', !hasTurbo);
