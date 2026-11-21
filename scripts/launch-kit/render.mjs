// ASCII view of a generated launch-kit blueprint (development aid).
// Usage: node scripts/launch-kit/render.mjs [blueprint-sources/launch-kit]
import fs from 'node:fs';
import {decodeBlueprint} from '../blueprints.mjs';
const dir = process.argv[2] || 'blueprint-sources/launch-kit';
const [m] = JSON.parse(fs.readFileSync(dir + '/manifest.json', 'utf8'));
const bp = decodeBlueprint(fs.readFileSync(dir + '/' + m.file, 'utf8').trim()).blueprint;
const size = {'assembling-machine-2': 3, 'chemical-plant': 3, substation: 2};
const grid = new Map();
const arrow = {0: '^', 4: '>', 8: 'v', 12: '<'};
const letter = {'iron-gear-wheel': 'g', 'engine-unit': 'e', 'electric-engine-unit': 'E', 'assembling-machine-1': '1', 'assembling-machine-2': '2', inserter: 'i', 'fast-inserter': 'f',
  'steel-chest': 'c', 'passive-provider-chest': 'P', battery: 'b', accumulator: 'a', 'solar-panel': 's', 'electric-furnace': 'F', 'decider-combinator': 'D', 'arithmetic-combinator': 'A',
  'constant-combinator': 'K', 'low-density-structure': 'L', 'space-platform-foundation': 'T', 'copper-cable': 'w', 'advanced-circuit': 'R', 'processing-unit': 'U', substation: 'S', pipe: 'p',
  'rocket-silo': 'Z', crusher: 'C', 'asteroid-collector': 'O', 'space-platform-starter-pack': 'X', 'cargo-landing-pad': 'Y'};
for (const e of bp.entities) {
  const s = size[e.name] || 1;
  let ch;
  if (e.recipe) ch = letter[e.recipe] || 'M';
  else if (e.name === 'fast-transport-belt') ch = arrow[e.direction || 0];
  else if (e.name === 'fast-underground-belt') ch = e.type === 'input' ? 'u' : 'o';
  else if (e.name === 'fast-inserter') ch = 'i';
  else if (e.name === 'long-handed-inserter') ch = 'l';
  else if (e.name === 'pipe') ch = '=';
  else if (e.name === 'pipe-to-ground') ch = '#';
  else if (e.name === 'passive-provider-chest') ch = '@';
  else if (e.name === 'display-panel') ch = '!';
  else if (e.name === 'substation') ch = '$';
  else if (e.name === 'medium-electric-pole') ch = '|';
  else if (e.name.endsWith('combinator')) ch = e.name[0].toUpperCase() === 'C' ? 'k' : e.name === 'decider-combinator' ? 'd' : 'a';
  else ch = '?';
  let w = s, h = s;
  if (e.name.endsWith('combinator') && e.name !== 'constant-combinator') { if ([4, 12].includes(e.direction)) { w = 2; h = 1; } else { w = 1; h = 2; } }
  for (let x = Math.floor(e.position.x - w / 2 + .01); x < e.position.x + w / 2 - .01; x++)
    for (let y = Math.floor(e.position.y - h / 2 + .01); y < e.position.y + h / 2 - .01; y++) grid.set(x + ',' + y, ch);
}
const f = m.footprint;
let out = '    ' + Array.from({length: f.width}, (_, i) => String((f.left + i) % 10)).join('') + '\n';
for (let y = f.top; y < f.bottom; y++) { let row = String(y).padStart(3) + ' '; for (let x = f.left; x < f.right; x++) row += grid.get(x + ',' + y) || '.'; out += row + '\n'; }
console.log(out);
console.log(JSON.stringify(m.footprint), 'area', m.areaGoal.achievedTiles, 'machines', Object.values(m.machineCounts).reduce((a, b) => a + b, 0));
