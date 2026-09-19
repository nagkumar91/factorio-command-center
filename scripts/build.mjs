import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { writeData } from './write-data.mjs';
import {execFileSync} from 'node:child_process';
execFileSync('python3', ['scripts/package-mod.py'], {stdio:'inherit'});
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
