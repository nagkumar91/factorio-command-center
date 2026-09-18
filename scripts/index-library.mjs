import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decodeBlueprint, encodeBlueprint, blueprintMaterials } from './blueprints.mjs';
import { PRESETS, generateCrateCommand, generateGiveCommand } from './packer.mjs';
import { writeData } from './write-data.mjs';
const catalog = JSON.parse(await fs.readFile('site/data/catalog.json', 'utf8'));
const items = new Map(catalog.items.map(i => [i.id, i]));
const files = [], blueprints = [], commands = [], errors = [];
const fingerprints = new Map();
const ignore = new Set(['.git', '.cache', 'node_modules', 'site', 'dist', 'scripts', 'tests', 'test-results', 'blueprint-sources', 'deploy']);
const projectFiles = new Set(['package.json', 'package-lock.json', 'README.md']);
const modInfo=JSON.parse(await fs.readFile('starter_initializer/info.json','utf8'));
const currentModArchive=`${modInfo.name}_${modInfo.version}.zip`;
function registerBlueprint(object, file, suffix = '') {
  const fingerprint = createHash('sha256').update(JSON.stringify(object)).digest('hex').slice(0, 12);
  if (fingerprints.has(fingerprint)) { fingerprints.get(fingerprint).sources.push(file.url); return; }
  const bp = object.blueprint || object.blueprint_book;
  const title = bp.label || (file.name.replace(/\.(txt|json|lua)$/, '').replace(/_/g, ' ').replace(/trasporter/g, 'transporter').replace(/blueprint/g, '').trim() + suffix);
  const materials = blueprintMaterials(object, catalog);
  const icons = (bp.icons || []).map(x => x.signal?.name).filter(x => items.has(x));
  const result = { id: fingerprint, name: title, file: file.path, sources: [file.url], isBook: !!object.blueprint_book, icons: icons.length ? icons : materials.entries.slice(0, 4).map(r => r.id), ...materials, code: encodeBlueprint(object) };
  blueprints.push(result);
  fingerprints.set(fingerprint, result);
}
async function walk(dir = '.') {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ignore.has(entry.name)) continue;
    const name = path.posix.join(dir, entry.name);
    if (name.endsWith('.zip') && name !== currentModArchive) continue;
    if (entry.isDirectory()) { await walk(name); continue; }
    if (projectFiles.has(name) || !/\.(md|txt|json|lua|js|cfg|zip)$/.test(name)) continue;
    const data = await fs.readFile(name);
    const file = { path: name, name: entry.name, ext: path.extname(name).slice(1), size: data.length, category: name.startsWith('starter_initializer') ? 'Starter mod' : /\.(js|lua)$/.test(name) ? 'Scripts' : /\.md$/.test(name) ? 'Notes' : 'Other', url: 'sources/' + name };
    files.push(file);
    await fs.mkdir(path.join('site/sources', path.dirname(name)), { recursive: true });
    await fs.writeFile(path.join('site/sources', name), data);
    if (/\.(json|txt)$/.test(name)) {
      try {
        const object = decodeBlueprint(data.toString());
        if (object?.blueprint || object?.blueprint_book) {
          file.category = 'Blueprints';
          registerBlueprint(object, file);
        }
      } catch (e) { errors.push({ file: name, message: e.message }); }
    }
    if (/\.(lua|md)$/.test(name)) {
      for (const [index, line] of data.toString().split(/\r?\n/).entries()) {
        if (!/^0[A-Za-z0-9+/=]+$/.test(line.trim())) continue;
        try { const object = decodeBlueprint(line); if (object?.blueprint || object?.blueprint_book) registerBlueprint(object, file, ` · line ${index + 1}`); }
        catch (e) { errors.push({ file: name + ':' + (index + 1), message: e.message }); }
      }
    }
  }
}
await walk();
// Offer tested startup stock only when the report belongs to this exact
// blueprint. Editing a layout invalidates its attached recommendations.
for (const b of blueprints) {
  const reportPath = b.file.replace(/\.(json|txt)$/, '.validation.json');
  if (reportPath === b.file) continue;
  let report;
  try { report = JSON.parse(await fs.readFile(reportPath, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') errors.push({ file: reportPath, message: e.message }); continue; }
  if (report.blueprintId !== b.id || !Array.isArray(report.startupTargets)) continue;
  const known = new Set([...catalog.items, ...catalog.fluids].map(i => i.id));
  if (!report.startupTargets.length || report.startupTargets.length > 100 || report.startupTargets.some(t => !known.has(t.id) || !Number.isSafeInteger(t.count) || t.count < 1 || t.count > 1000000)) continue;
  b.startup = { targets: report.startupTargets, note: String(report.setupNote || ''), report: 'sources/' + reportPath };
}
const iconFor = text => [...items.keys()].find(id => text.includes('"' + id + '"')) || 'constant-combinator';
const text = await fs.readFile('commands.md', 'utf8');
const lines = text.split(/\r?\n/);
let category = 'Command history', heading = '', historical = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^# /.test(line)) category = line.replace(/^# \d+\)\s*/, '').replace(/[“”]/g, '');
  if (/^#{2,3} /.test(line)) heading = line.replace(/^#{2,3}\s*(?:[A-Z]\)|\d+\))?\s*/, '');
  if (!/^`?\/c(?:\s|$)/.test(line.trim())) continue;
  const sourceLine = i + 1;
  const block = [line.trim().replace(/^`|`$/g, '')];
  while (i + 1 < lines.length && !/^\s*```|^#|^\s*`?\/c(?:\s|$)/.test(lines[i + 1])) block.push(lines[++i]);
  const code = block.join('\n').trim();
  const issues = [];
  if (code.includes('game.item_prototypes')) issues.push('Uses the retired game.item_prototypes API.');
  if (code.includes('logistic-chest-')) issues.push('Contains old logistic chest names.');
  if (/turret_ammo/.test(code) && /tank|vehicle/.test(code)) issues.push('Uses turret ammo inventory for a vehicle.');
  if (/steel-chest/.test(code)) issues.push('Steel chests cannot supply robots.');
  if (/\.destroy\(/.test(code)) issues.push('Deletes entities and their contents.');
  if (/\.insert/.test(code)) issues.push('Original insertion logic may stop or truncate when inventories fill. Use the crate builder for reliable packing.');
  commands.push({ id: 'history-' + (++historical), title: heading || category, description: issues[0] || 'Original command from your notes. Check its scope and parameters before use.', category: 'History', originalCategory: category, icon: iconFor(code), code, source: `commands.md:${sourceLine}`, url: 'sources/commands.md', status: 'Original · unverified', issues });
}
const curated = [];
const add = (id, title, description, category, icon, code, tags = []) => curated.push({ id, title, description, category, icon, code, tags, status: 'Updated for 2.0', source: 'commands.md · reviewed', url: 'sources/commands.md' });
const looseCommands = (await fs.readFile('Untitled-1.lua', 'utf8')).split(/\r?\n/).map((code, i) => ({ code: code.trim(), line: i + 1 })).filter(c => c.code.startsWith('/c '));
for (const [i, original] of looseCommands.entries()) {
  const title = ['Vulcanus factory setup kit', 'Vulcanus landing kit', 'Locate nearby calcite'][i] || 'Untitled console command';
  const rows = [...original.code.matchAll(/\{\s*"([a-z0-9-]+)"\s*,\s*(\d+)\s*\}/g)].map(m => ({ id: m[1], count: Number(m[2]), quality: 'normal' }));
  if (rows.length) {
    add('vulcanus-' + i, title, 'Recovered from your Lua notes. Updated to pack every item across robot-accessible chests.', 'Supply kits', 'foundry', generateCrateCommand(rows, catalog), ['vulcanus', 'landing', 'space age']);
    Object.assign(curated.at(-1), { source: 'Untitled-1.lua:' + original.line + ' · repaired', url: 'sources/Untitled-1.lua' });
  }
  commands.push({ id: 'lua-history-' + i, title: title + ' (original)', description: 'Original console snippet from your Lua scratch file.', category: 'History', icon: i === 2 ? 'calcite' : 'foundry', code: original.code, source: 'Untitled-1.lua:' + original.line, url: 'sources/Untitled-1.lua', status: 'Original · unverified', issues: rows.length ? ['Contains glued Lua keywords and the retired game.item_prototypes API. Use the repaired supply-kit command instead.'] : [] });
}
for (const p of PRESETS) add('kit-' + p.id, p.name + ' crates', p.description + ' Automatically splits supplies across robot-accessible chests.', 'Supply kits', p.icon, generateCrateCommand(p.entries.map(([id, count]) => ({ id, count, quality: 'normal' })), catalog), ['pack', 'chest', 'materials']);
for (const [id, title, icon] of [['advanced-material-processing-2', 'Unlock electric furnaces', 'electric-furnace'], ['electric-mining-drill', 'Unlock electric mining drills', 'electric-mining-drill'], ['automobilism', 'Unlock the car', 'car'], ['nuclear-power', 'Unlock nuclear power', 'nuclear-reactor'], ['logistic-system', 'Unlock logistics chests', 'passive-provider-chest']]) {
  if (!catalog.technologies.some(t => t.id === id)) continue;
  add('research-' + id, title, 'Research this technology and all its prerequisites.', 'Research', icon, `/c local t=game.player.force.technologies["${id}"]; if t then t.research_recursive() else game.player.print("Technology unavailable.") end`, ['research', 'technology', 'unlock']);
}
add('research-all', 'Unlock all technologies', 'Complete all research for your entire force.', 'Research', 'space-science-pack', '/c game.player.force.research_all_technologies()', ['research', 'everything']);
add('give-robots', 'Give 200 construction robots', 'Add robots to your inventory. Reports how many actually fit.', 'Player', 'construction-robot', generateGiveCommand('construction-robot', 200), ['bots', 'inventory']);
add('give-fuel', 'Give 200 solid fuel', 'Add fuel to your inventory. Reports available space.', 'Player', 'solid-fuel', generateGiveCommand('solid-fuel', 200));
add('daylight', 'Keep the current surface in daylight', 'Enable permanent daytime on the surface you are standing on.', 'World', 'solar-panel', '/c game.player.surface.always_day=true');
add('daylight-off', 'Restore the day / night cycle', 'Turn off permanent daylight on your current surface.', 'World', 'accumulator', '/c game.player.surface.always_day=false');
add('chart', 'Reveal the nearby map', 'Chart a 1,024 × 1,024 tile area around your position.', 'World', 'radar', '/c local p=game.player; p.force.chart(p.surface,{{p.position.x-512,p.position.y-512},{p.position.x+512,p.position.y+512}})');
add('stop-starter', 'Stop automatic starter supplies', 'Disable Starter Initializer auto-grants in the current save. Manual grants still work.', 'Setup', 'steel-chest', '/c if settings.global["starter-init-auto-grant-on-join"] then settings.global["starter-init-auto-grant-on-join"]={value=false}; game.player.print("Automatic starter supplies disabled for this save.") else game.player.print("Starter Initializer is not enabled.") end');
const library = { generatedAt: new Date().toISOString(), commands: [...curated, ...commands], blueprints: blueprints.sort((a, b) => a.name.localeCompare(b.name)), files: files.sort((a, b) => a.path.localeCompare(b.path)), errors };
await writeData('library', library);
console.log(`Indexed ${files.length} files, ${curated.length} reviewed commands, ${commands.length} historical commands, ${blueprints.length} distinct blueprints/books. ${errors.length} parse errors.`);
if (errors.length) console.log(errors);
