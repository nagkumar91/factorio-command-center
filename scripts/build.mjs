import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { writeData } from './write-data.mjs';
import {execFileSync} from 'node:child_process';
execFileSync('python3', ['scripts/package-mod.py'], {stdio:'inherit'});
execFileSync('node', ['scripts/index-autosaved-derivatives.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/compact-expansion-workshop/preview.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/rgby-science/build-page.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/five-science/build-page.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/workshop-guides.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/index-designed-blueprints.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/todays-flight-builds.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/essentials-pages.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/space-launch-pages.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/circuit-supplier-pages.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/plastic-bar-pages.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/oil-product-pages.mjs'], {stdio:'inherit'});
execFileSync('node', ['scripts/electric-smelter-pass-through/page.mjs'], {stdio:'inherit'});
const mod=JSON.parse(await readFile('starter_initializer/info.json','utf8'));
await cp(`${mod.name}_${mod.version}.zip`,`site/sources/${mod.name}_${mod.version}.zip`);
for (const name of ['catalog', 'library', 'production', 'community', 'atlas']) {
  await writeData(name, JSON.parse(await readFile(`site/data/${name}.json`, 'utf8')));
}
// Removed source downloads must not survive in a later deployment artifact.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('site', 'dist', { recursive: true });
console.log('Static website ready. Open index.html directly, or copy dist/ anywhere and open its index.html.');
