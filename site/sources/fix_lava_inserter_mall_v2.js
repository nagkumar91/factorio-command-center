const fs = require('fs');
const zlib = require('zlib');

const inPath = './lava_inserter_mall_v1.json';
const outJson = './lava_inserter_mall_v2.json';
const outTxt = './lava_inserter_mall_v2.txt';

const bp = JSON.parse(fs.readFileSync(inPath, 'utf8')).blueprint;
const entities = bp.entities;
let next = Math.max(...entities.map(e => e.entity_number)) + 1;

const key = (x, y) => `${x},${y}`;
const byPos = new Map(entities.map(e => [key(e.position.x, e.position.y), e]));

function add(name, x, y, extra = {}) {
  if (byPos.has(key(x, y))) return byPos.get(key(x, y)).entity_number;
  const e = { entity_number: next++, name, position: { x, y }, ...extra };
  entities.push(e);
  byPos.set(key(x, y), e);
  return e.entity_number;
}

function getByNum(num) {
  return entities.find(e => e.entity_number === num);
}

function moveEntity(num, x, y, extra = null) {
  const e = getByNum(num);
  if (!e) return;
  byPos.delete(key(e.position.x, e.position.y));
  e.position = { x, y };
  if (extra) Object.assign(e, extra);
  byPos.set(key(x, y), e);
}

function setDir(num, d) {
  const e = getByNum(num);
  if (e) e.direction = d;
}

function removeEntity(num) {
  const idx = entities.findIndex(e => e.entity_number === num);
  if (idx >= 0) {
    const e = entities[idx];
    byPos.delete(key(e.position.x, e.position.y));
    entities.splice(idx, 1);
  }
}

// 1) Move poles that block inserter pickup lanes
removeEntity(474); // blocked bulk input path

// 2) Fix missing feeder lanes for EC + inserter assemblers
for (const x of [30.5, 39.5, 40.5]) {
  add('fast-transport-belt', x, 17.5, { direction: 4 });
  add('fast-transport-belt', x, 18.5, { direction: 4 });
}

// 3) Rebuild long-handed inserter assembler cell (around #386) to guaranteed local connectivity
// Remove broken local inserters
for (const id of [387, 388, 390]) removeEntity(id);

// Keep assembler #386 and output chest #391, and place a clean output inserter
add('inserter', 52.5, 11.5, { direction: 6 }); // pick from machine west, drop east chest

// Local short input belts for long-handed assembler (three ingredients)
for (let x = 48.5; x <= 51.5; x += 1) add('fast-transport-belt', x, 13.5, { direction: 2 });
for (let x = 48.5; x <= 51.5; x += 1) add('fast-transport-belt', x, 14.5, { direction: 2 });
for (let x = 48.5; x <= 51.5; x += 1) add('fast-transport-belt', x, 15.5, { direction: 2 });

// Feeders from main lanes to local lines
add('fast-underground-belt', 47.5, 13.5, { direction: 2, type: 'input' });
add('fast-underground-belt', 48.5, 13.5, { direction: 2, type: 'output' });
add('fast-underground-belt', 47.5, 14.5, { direction: 2, type: 'input' });
add('fast-underground-belt', 48.5, 14.5, { direction: 2, type: 'output' });
add('fast-underground-belt', 47.5, 15.5, { direction: 2, type: 'input' });
add('fast-underground-belt', 48.5, 15.5, { direction: 2, type: 'output' });

// Long-handed assembler inputs (all valid pickup/drop)
add('inserter', 49.5, 13.5, { direction: 0 }); // from row 14.5 to machine
add('inserter', 50.5, 13.5, { direction: 0 }); // from row 14.5 to machine
add('long-handed-inserter', 51.5, 13.5, { direction: 0 }); // from row 15.5 to machine

// 4) Fix fast assembler input/output inserters
// #393 had no source; move to a valid pickup on inserter lane
moveEntity(393, 48.5, 16.5, { direction: 0 });
// #396 had no source; make it output from machine to chest
moveEntity(396, 52.5, 16.5, { direction: 6 });

// Ensure source belts for #393/#394/#395 exist
add('fast-transport-belt', 48.5, 17.5, { direction: 2 });
add('fast-transport-belt', 50.5, 21.5, { direction: 2 });
add('fast-transport-belt', 51.5, 20.5, { direction: 2 });

// 5) Fix bulk assembler cell connectivity
// #435 should feed machine from belt below
moveEntity(435, 58.5, 19.5, { direction: 0 });
add('fast-transport-belt', 58.5, 20.5, { direction: 2 });

// #436 keep as transfer to staging line, now pole removed so pickup is belt
setDir(436, 4);

// #437 should feed machine from belt below
moveEntity(437, 60.5, 21.5, { direction: 0 });
add('fast-transport-belt', 60.5, 22.5, { direction: 2 });

// #438 should feed machine from fast line and drop to machine side
moveEntity(438, 62.5, 18.5, { direction: 6 });
add('fast-transport-belt', 63.5, 18.5, { direction: 2 });

// #439 output to chest from machine
moveEntity(439, 62.5, 20.5, { direction: 6 });
add('passive-provider-chest', 61.5, 20.5);

// 6) Add missing pickup belts reported by checker
for (const [x, y] of [
  [57.5, 19.5],
  [61.5, 20.5],
  [63.5, 18.5],
  [60.5, 22.5]
]) add('fast-transport-belt', x, y, { direction: 2 });

// Sort and re-number deterministically
entities.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.entity_number - b.entity_number);
for (let i = 0; i < entities.length; i++) entities[i].entity_number = i + 1;

const out = { blueprint: { ...bp, label: 'Lava Inserter Mall v2 (Connected Belts)', entities } };
fs.writeFileSync(outJson, JSON.stringify(out, null, 2));
const encoded = '0' + zlib.deflateSync(Buffer.from(JSON.stringify(out))).toString('base64');
fs.writeFileSync(outTxt, encoded + '\n');

console.log('wrote', outJson, 'entities', entities.length);
console.log('wrote', outTxt);
