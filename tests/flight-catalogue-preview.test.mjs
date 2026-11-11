import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {blueprintPreviewSvg} from '../scripts/blueprint-preview.mjs';

const production = {entities: {'assembling-machine-3': {type: 'assembling-machine', size: [[-1.4, -1.4], [1.4, 1.4]]}}};
function blueprint(count) {
  const entities = [{entity_number: 1, name: 'assembling-machine-3', position: {x: 3, y: 2}}];
  for (let i = 0; i < count; i++) entities.push({entity_number: i + 2, name: 'display-panel', position: {x: (i % 4) * 3, y: Math.floor(i / 4) * 3 + 10}, icon: {type: i % 2 ? 'fluid' : 'item', name: i % 2 ? 'water' : 'iron-plate'}, text: 'IN ' + i + ' · ' + (i % 2 ? '[fluid=water]' : '[item=iron-plate]') + ' ↓\nConnect the marked entrance.'});
  return {entities};
}

// Captured before the dense-layout change (renderer SHA prefix 49ecbf27).
// The ordinary branch must remain byte-identical, including all twelve cutoff cases.
const ordinaryHashes = [
  '4528b7bb8424b97e102ee6f3a087a48d67b43eb0eb955b068120501af91c75e4',
  'f3f747b89e6b3a8017b385027ddee6b883a8ee77eb624da952edeb78960c4199',
  'e6f7e40cb33e2afd8b929338e9705c2eb2ddae438dee065bbc083da91f286044',
  '9c523126d16c25beaf241f3fa35639cef5440b47b261fb9f3616a5db01abcce7',
  'c595dc22a7841c9ecce7aefe6057f834e117ad09c25d513daec7e73e9bb747fb',
  'ce8c8d0cccf7787cf98bb1c8be87a34ec398be170f5864e9514ac37009173366',
  '0fba29b7d465c33c456475e13ce4dc0ef1568051ff29dbc14cb719e393288227',
  '78cf968d12ed85706941c4d0a5adbf40359e6110058160873cee72874ffe4798',
  '7f29759acf883b3efb05cdbaaa9f3594f0e4ced1c0fbeca5b264592a71d96ecb',
  '61550fb0beb3b400ce2e4d2d0b6de4223e2ba85b4be82454d9ea2241e32cb952',
  'd5f4eefb3fd7a86368f912092e6f937d515fddde0686fef3bf1e36e21ba06a3c',
  '0a51798c0d9c36cbff1ae709f517730eb1fcaecd43bb2c0d36679900c001f0ff',
  'bcea7b378be643f78351b119066d4068ec771fed8a6b482f4130fbc3d24551c5'
];
test('zero through twelve display panels preserve every byte of the ordinary preview', async () => {
  for (let count = 0; count <= 12; count++) {
    const svg = await blueprintPreviewSvg(blueprint(count), production, {icons: {}});
    assert.equal(createHash('sha256').update(svg).digest('hex'), ordinaryHashes[count], `${count}-panel SVG changed`);
    assert.doesNotMatch(svg, /data-display-layout="dense"/);
  }
});

test('dense displays retain every saved position and readable numbered labels in a compact legend below the map', async () => {
  for (const count of [13, 49, 80]) {
    const b = blueprint(count);
    b.entities[2].text = 'STARTUP iron-plate\n1 once → seed chest';
    b.entities.at(-1).text = 'WASTE spoilage\nEmpty continuously <&>';
    const svg = await blueprintPreviewSvg(b, production, {icons: {}});
    assert.match(svg, /data-display-layout="dense"/);
    assert.match(svg, /STARTUP iron-plate/);
    assert.match(svg, /WASTE spoilage/);
    assert.match(svg, /Empty continuously &lt;&amp;&gt;/);
    const map = [...svg.matchAll(/<g data-display-entity="(\d+)" data-display-number="(\d+)">([\s\S]*?)<\/g>/g)].map(match => {
      const anchor = match[3].match(/data-panel-anchor="\d+" d="M[^L]+L([^ ]+) ([^"]+)"/);
      const marker = match[3].match(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/);
      return {entity: Number(match[1]),number: Number(match[2]),x: Number(anchor[1]),y: Number(anchor[2]),markerX: Number(marker[1]),markerY: Number(marker[2]),radius: Number(marker[3])};
    });
    const legend = [...svg.matchAll(/<g data-display-label="(\d+)" data-display-number="(\d+)"><rect x="([^"]+)" y="([^"]+)"/g)].map(m => ({entity: Number(m[1]),number: Number(m[2]),x: Number(m[3]),y: Number(m[4])}));
    assert.equal(map.length, count); assert.equal(legend.length, count);
    assert.deepEqual(map.map(p => [p.entity, p.number]), legend.map(p => [p.entity, p.number]));
    assert.equal(new Set(legend.map(p => p.x)).size, 4);
    assert.ok(Math.min(...legend.map(p => p.y)) > Math.max(...map.map(p => p.markerY + p.radius)), 'Legend must follow the complete map.');
    assert.ok(Number(svg.match(/data-dense-map="true"><rect x="[^"]+" y="([^"]+)"/)[1]) < 150, 'Map must start near the top independently of legend length.');
    const scaleX = (map[1].x - map[0].x) / 3, scaleY = (map[4].y - map[0].y) / 3;
    assert.ok(Math.abs(scaleX - scaleY) < 1e-8, 'Saved geometry must not be stretched.');
    for (const [i, point] of map.entries()) {
      const original = b.entities[i + 1];
      assert.equal(point.entity, original.entity_number);
      assert.ok(Math.abs(point.x - map[0].x - original.position.x * scaleX) < 1e-8);
      assert.ok(Math.abs(point.y - map[0].y - (original.position.y - 10) * scaleY) < 1e-8);
      for (const other of map.slice(0, i)) assert.ok(Math.hypot(point.markerX - other.markerX, point.markerY - other.markerY) >= point.radius + other.radius + 2, 'Numbered callouts must not overlap.');
    }
    const png = await sharp(Buffer.from(svg)).png().toBuffer({resolveWithObject: true});
    assert.equal(png.info.width, 1440);
    assert.ok(png.info.height < 3000, 'Dense legend must avoid a long single-column poster.');
  }
});
