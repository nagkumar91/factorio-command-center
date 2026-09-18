// Read the locally installed game in an isolated Factorio data directory.
// Nothing is written to the user's game, saves, or active mod configuration.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { writeData } from './write-data.mjs';

const home = os.homedir();
const game = process.env.FACTORIO_APP || path.join(home, 'Library/Application Support/Steam/steamapps/common/Factorio/factorio.app');
const dataPath = process.env.FACTORIO_DATA || path.join(game, 'Contents/data');
const binary = process.env.FACTORIO_BIN || path.join(game, 'Contents/MacOS/factorio');
const userMods = process.env.FACTORIO_MODS || path.join(home, 'Library/Application Support/factorio/mods');
const vanilla = process.argv.includes('--vanilla');
const cache = path.resolve(vanilla ? '.cache/factorio-vanilla' : '.cache/factorio');
await fs.mkdir(path.join(cache, 'mods'), { recursive: true });
await fs.mkdir('site/assets/icons', { recursive: true });
await fs.mkdir('site/assets/fonts', { recursive: true });
for (const name of ['Lato-Regular.ttf', 'Lato-Bold.ttf', 'TitilliumWeb-SemiBold.ttf']) {
  await fs.copyFile(path.join(dataPath, 'core/fonts', name), path.join('site/assets/fonts', name));
}
await fs.mkdir('site/data', { recursive: true });
await fs.writeFile(path.join(cache, 'config.ini'), `[path]\nread-data=${dataPath}\nwrite-data=${cache}\n[general]\nlocale=en\n`);
const modFiles = vanilla ? [] : await fs.readdir(userMods);
for (const name of modFiles) {
  if (name.endsWith('.zip') || ['mod-list.json', 'mod-settings.dat'].includes(name)) {
    await fs.copyFile(path.join(userMods, name), path.join(cache, 'mods', name));
  }
}
if (vanilla) await fs.writeFile(path.join(cache,'mods/mod-list.json'),JSON.stringify({mods:['base','quality','elevated-rails','space-age'].map(name=>({name,enabled:true}))}));
const dump = path.join(cache, 'script-output/data-raw-dump.json');
// --cached is useful when re-indexing the same installed version.
if (!process.argv.includes('--cached')) {
  execFileSync(binary, ['--config', path.join(cache, 'config.ini'), '--mod-directory', path.join(cache, 'mods'), '--dump-data'], { stdio: 'pipe' });
}
const raw = JSON.parse(await fs.readFile(dump, 'utf8'));
const locale = {};
for (const mod of ['core', 'base', 'elevated-rails', 'quality', 'space-age']) {
  const dir = path.join(dataPath, mod, 'locale/en');
  for (const file of await fs.readdir(dir).catch(() => [])) {
    if (!file.endsWith('.cfg')) continue;
    let section = '';
    for (const line of (await fs.readFile(path.join(dir, file), 'utf8')).split(/\r?\n/)) {
      if (line.startsWith('[')) section = line.slice(1, -1);
      else if (line.includes('=')) { const at = line.indexOf('='); locale[section + '.' + line.slice(0, at)] = line.slice(at + 1); }
    }
  }
}
const titleCase = name => name.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
function localName(p) {
  const key = Array.isArray(p.localised_name) && p.localised_name[0];
  let name = locale[key] || locale['item-name.' + p.name] || locale['fluid-name.' + p.name] || locale['entity-name.' + p.name] || locale['technology-name.' + p.name] || titleCase(p.name);
  return name.replace(/__ITEM__([^_]+)__/g, (_, n) => locale['item-name.' + n] || titleCase(n)).replace(/\[.*?\]/g, '').replace(/__\d+__/g, '').trim();
}
async function spriteBuffer(filename) {
  const [, mod, relative] = filename.match(/^__([^_]+)__\/(.+)$/) || [];
  if (!mod) throw new Error('Invalid sprite path: ' + filename);
  try { return await fs.readFile(path.join(dataPath, mod, relative)); }
  catch {
    const archive = modFiles.find(f => f.startsWith(mod + '_') && f.endsWith('.zip'));
    if (!archive) throw new Error('No sprite archive for ' + filename);
    const entries = execFileSync('unzip', ['-Z1', path.join(userMods, archive)], { encoding: 'utf8' }).split('\n');
    const sprite = entries.find(n => n.endsWith('/' + relative));
    if (!sprite) throw new Error('Missing sprite in mod: ' + filename);
    return execFileSync('unzip', ['-p', path.join(userMods, archive), sprite]);
  }
}
async function makeIcon(p, prefix = '') {
  const name = prefix + p.name;
  const layers = p.icons || (p.icon ? [{ icon: p.icon, icon_size: p.icon_size }] : []);
  if (!layers.length) return null;
  const composites = [];
  for (const layer of layers) {
    const input = await spriteBuffer(layer.icon);
    const meta = await sharp(input).metadata();
    const size = Math.min(layer.icon_size || p.icon_size || 64, meta.width, meta.height);
    const displaySize = Math.max(1, Math.min(64, Math.round(size * (layer.scale ?? 32 / size) * 2)));
    let img = sharp(input).extract({ left: 0, top: 0, width: size, height: size }).resize(displaySize, displaySize).ensureAlpha();
    if (layer.tint) {
      const t = layer.tint;
      img = img.linear([t.r ?? t[0] ?? 1, t.g ?? t[1] ?? 1, t.b ?? t[2] ?? 1, t.a ?? t[3] ?? 1], [0, 0, 0, 0]);
    }
    const shift = layer.shift || [0, 0];
    composites.push({ input: await img.png().toBuffer(), left: Math.max(0, Math.min(64 - displaySize, Math.round((64 - displaySize) / 2 + (shift[0] || shift.x || 0) * 2))), top: Math.max(0, Math.min(64 - displaySize, Math.round((64 - displaySize) / 2 + (shift[1] || shift.y || 0) * 2))) });
  }
  await sharp({ create: { width: 64, height: 64, channels: 4, background: '#00000000' } }).composite(composites).png().toFile(`site/assets/icons/${name}.png`);
  return `assets/icons/${name}.png`;
}
const categories = { logistics: 'Logistics', production: 'Production', 'intermediate-products': 'Materials', combat: 'Combat', space: 'Space', other: 'Tools' };
const items = [];
const entityItems = {};
const entityCosts = {};
const tileItems = {};
for (const type of Object.values(raw)) for (const p of Object.values(type)) {
  if (!p.stack_size || p.hidden || p.parameter || p.flags?.includes('hidden')) continue;
  const subgroup = raw['item-subgroup'][p.subgroup];
  const group = subgroup?.group || 'other';
  const item = { id: p.name, name: localName(p), type: p.type, stack: p.stack_size, group: p.subgroup === 'science-pack' ? 'Science' : categories[group] || 'Tools', subgroup: p.subgroup, order: (raw['item-group'][group]?.order || 'z') + '/' + (subgroup?.order || '') + '/' + (p.order || ''), icon: await makeIcon(p), expansion: JSON.stringify(p.icon || p.icons || '').includes('__space-age__'), spoilable: !!p.spoil_ticks };
  items.push(item);
  if (p.place_result) entityItems[p.place_result] = p.name;
  if (p.place_as_tile) tileItems[p.place_as_tile.result] = p.name;
  if (p.rails) for (const rail of p.rails) entityItems[typeof rail === 'string' ? rail : rail.name] = p.name;
  if (p.support) entityItems[p.support] = p.name;
}
items.sort((a, b) => a.order.localeCompare(b.order) || a.id.localeCompare(b.id));
for (const type of Object.values(raw)) for (const p of Object.values(type)) {
  if (p.placeable_by) {
    const placement = Array.isArray(p.placeable_by) ? p.placeable_by[0] : p.placeable_by;
    if (placement?.item && items.some(i => i.id === placement.item)) {
      entityItems[p.name] = placement.item;
      entityCosts[p.name] = placement.count || 1;
    }
  }
}
// Rotated hazard-concrete tiles share the same placement item.
for (const p of Object.values(raw.tile || {})) {
  if (p.minable?.result && items.some(i => i.id === p.minable.result)) tileItems[p.name] = p.minable.result;
}
// These pre-2.0 names still occur in the user's hand-edited blueprints.
for (const suffix of ['passive-provider', 'active-provider', 'storage', 'buffer', 'requester']) {
  const current = suffix + '-chest';
  if (items.some(i => i.id === current)) entityItems['logistic-chest-' + suffix] = current;
}
const chests = [];
for (const id of ['passive-provider-chest', 'storage-chest', 'active-provider-chest', 'buffer-chest', 'requester-chest', 'steel-chest']) {
  const p = raw['logistic-container']?.[id] || raw.container?.[id];
  if (p) chests.push({ id, name: localName(p), slots: p.inventory_size, mode: p.logistic_mode || null, icon: `assets/icons/${id}.png` });
}
const qualities = [];
for (const p of Object.values(raw.quality)) {
  if (p.hidden || p.name === 'quality-unknown') continue;
  qualities.push({ id: p.name, name: titleCase(p.name), level: p.level, icon: await makeIcon(p, 'quality-') });
}
qualities.sort((a, b) => a.level - b.level);
const technologies = [];
for (const p of Object.values(raw.technology)) {
  if (p.hidden) continue;
  technologies.push({ id: p.name, name: localName(p), icon: await makeIcon(p, 'tech-') });
}
const version = JSON.parse(await fs.readFile(path.join(dataPath, 'base/info.json'), 'utf8')).version;
const fluids = [];
for (const p of Object.values(raw.fluid || {})) {
  if (!p.hidden && !p.parameter) fluids.push({ id: p.name, name: localName(p), type: 'fluid', icon: await makeIcon(p, 'fluid-') });
}
const mods = JSON.parse(await fs.readFile(path.join(cache, 'mods/mod-list.json'), 'utf8')).mods;
await writeData('catalog', { version, extractedAt: new Date().toISOString(), dataSource:vanilla?'vanilla-space-age':'installed-game', mods, items, fluids, chests, qualities, technologies, entityItems, entityCosts, tileItems });
console.log(`Indexed Factorio ${version}: ${items.length} items, ${technologies.length} technologies, ${chests.length} chests, original game icons.`);
