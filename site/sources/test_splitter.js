const fs = require('fs');
const zlib = require('zlib');
const blueprint = {
  blueprint: {
    item: 'blueprint',
    version: 562949954928640,
    entities: [
      { entity_number: 1, name: 'splitter', position: { x: 0.5, y: 1 }, direction: 2 }
    ]
  }
};
console.log('0' + zlib.deflateSync(Buffer.from(JSON.stringify(blueprint))).toString('base64'));
