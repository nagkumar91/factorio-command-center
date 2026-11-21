// Writes the three four-pack imports and their manifest. A build keeps its
// native-qualified status only when the saved native report passed for the
// exact SHA-256 generated here. RGBY_OUT and RGBY_LAYOUT are for trials only.
import fs from 'node:fs/promises';
import {buildAll, LAYOUT} from './factory.mjs';
const bytes = await fs.readFile(process.env.FACTORIO_RAW || '.cache/rgby-science/data-raw-dump.json'), raw = JSON.parse(bytes);
const root = process.env.RGBY_OUT || 'blueprint-sources/rgby-science', layout = {...LAYOUT, ...JSON.parse(process.env.RGBY_LAYOUT || '{}')};
await fs.mkdir(root, {recursive: true});
const report = await fs.readFile(root + '/native-report.json', 'utf8').then(JSON.parse).catch(() => null);
const builds = await buildAll(raw, bytes, {layout});
for (const {manifest, code} of builds) {
  if (report?.builds?.some(b => b.id === manifest.id && b.blueprintSha256 === manifest.blueprintSha256 && b.passed === true)) manifest.status = 'native-qualified';
  await fs.writeFile(root + '/' + manifest.file, code + '\n');
  console.log(manifest.id, manifest.blueprintSha256, manifest.footprint.width + ' x ' + manifest.footprint.height, manifest.status);
}
await fs.writeFile(root + '/manifest.json', JSON.stringify(builds.map(b => b.manifest), null, 2) + '\n');
