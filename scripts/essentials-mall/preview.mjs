// ASCII map of an essentials-mall string: node scripts/essentials-mall/preview.mjs [dir]
import fs from 'node:fs/promises';
import {decodeBlueprint} from '../blueprints.mjs';
const dir = process.argv[2] || 'blueprint-sources/essentials-mall';
const code = (await fs.readFile(dir + '/essentials-mall.txt', 'utf8')).trim();
const {entities} = decodeBlueprint(code).blueprint;
const arrows = {0: '^', 4: '>', 8: 'v', 12: '<'};
const short = {'iron-gear-wheel': 'GR', 'transport-belt': 'TB', 'underground-belt': 'UB', splitter: 'SP', inserter: 'IN', 'assembling-machine-1': 'A1',
  'copper-cable': 'CB', 'advanced-circuit': 'AC', 'assembling-machine-2': 'A2', 'fast-transport-belt': 'FB', 'fast-underground-belt': 'FU', 'fast-splitter': 'FS',
  'fast-inserter': 'FI', 'bulk-inserter': 'BI', 'electric-furnace': 'EF', 'electric-mining-drill': 'DR'};
const grid = new Map();
const put = (x, y, s) => grid.set(x + ',' + y, s);
for (const e of entities) {
  const x = Math.floor(e.position.x), y = Math.floor(e.position.y), d = e.direction || 0;
  if (e.name === 'assembling-machine-2') { for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) put(x + u, y + v, '#'); put(x - 1, y, short[e.recipe][0]); put(x, y, short[e.recipe][1]); continue; }
  if (e.name === 'fast-transport-belt') { put(x, y, arrows[d]); continue; }
  if (e.name === 'fast-underground-belt') { put(x, y, e.type === 'input' ? 'u' : 'U'); continue; }
  if (e.name === 'fast-splitter') { const [dx, dy] = d === 4 || d === 12 ? [0, 1] : [1, 0]; put(Math.floor(e.position.x - dx / 2), Math.floor(e.position.y - dy / 2), 'S'); put(Math.floor(e.position.x + dx / 2 - .01), Math.floor(e.position.y + dy / 2 - .01), 'S'); continue; }
  if (e.name.endsWith('inserter')) { put(x, y, e.name === 'bulk-inserter' ? 'b' : e.name === 'long-handed-inserter' ? 'l' : 'i'); continue; }
  if (e.name === 'passive-provider-chest') { put(x, y, 'C'); continue; }
  if (e.name === 'substation') { for (const [u, v] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) put(e.position.x + u, e.position.y + v, 'P'); continue; }
  if (e.name === 'medium-electric-pole') { put(x, y, 'p'); continue; }
  if (e.name === 'display-panel') { put(x, y, 'D'); continue; }
  if (e.name === 'constant-combinator') { put(x, y, 'K'); continue; }
  if (e.name.endsWith('combinator')) { if (d === 0 || d === 8) { put(x, Math.floor(e.position.y - .5), '='); put(x, Math.floor(e.position.y), '='); } else { put(Math.floor(e.position.x - .5), y, '='); put(Math.floor(e.position.x), y, '='); } continue; }
  put(x, y, '?');
}
const xs = [...grid.keys()].map(k => +k.split(',')[0]), ys = [...grid.keys()].map(k => +k.split(',')[1]);
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
let header = '     '; for (let x = x0; x <= x1; x++) header += String(Math.abs(x) % 10); console.log(header);
for (let y = y0; y <= y1; y++) { let row = String(y).padStart(4) + ' '; for (let x = x0; x <= x1; x++) row += grid.get(x + ',' + y) || '.'; console.log(row); }
console.log(`${x1 - x0 + 1} x ${y1 - y0 + 1} tiles`);
