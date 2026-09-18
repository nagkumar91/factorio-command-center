import { mkdir, writeFile } from 'node:fs/promises';

// Classic scripts also load from file://, so the site needs no fetch or server.
export async function writeData(name, data) {
  if (!['catalog', 'library', 'production', 'community', 'atlas'].includes(name)) throw new Error('Unknown dataset');
  await mkdir('site/data', { recursive: true });
  const json = JSON.stringify(data);
  await writeFile(`site/data/${name}.json`, json);
  await writeFile(`site/data/${name}.js`, `// Generated local data.\nglobalThis.FactorioData = globalThis.FactorioData || {};\nglobalThis.FactorioData.${name} = JSON.parse(${JSON.stringify(json)});\n`);
}
