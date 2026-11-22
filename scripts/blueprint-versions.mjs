// Tested versions of one design, side by side: the "versions" field of a family manifest entry.
//
// A family that keeps an earlier tested layout selectable writes, on its manifest entry (manifest.json is
// an array; the entry whose blueprintSha256 is the current string), a "versions" array, newest first:
//
//   {label, summary?, blueprintSha256, file, manifest?, report, width, height, tiles, machines,
//    outputsPerMinute: {steady: {product: n} | null, recovery: {product: n} | null}}
//
// - label: the version's name in words ("Sixteen rows"); summary: optional one-line reason to choose it.
// - file, manifest, report: paths relative to the family folder (blueprint-sources/<family>/). The first
//   entry is the current string (file = the manifest entry's own file); older ones live under history/.
// - machines: crafting machines in the blueprint (assemblers, furnaces, chemical plants, ...).
// - outputsPerMinute: copied from that version's own native report, the build whose blueprintSha256 is this
//   exact string and passed (steady = outputsPerMinute, recovery = recovery.outputsPerMinute). null means
//   "not measured"; nothing is ever estimated.
// - inputsPerMinute, powerKW: optional, present only when that build in the report records them (measured
//   operating inputs per minute, and electric power drawn while working in kW). Families whose reports have
//   neither get neither, and their pages and pickers render as before.
//
// Successive versions (the essentials mall, flight robots) are numbered in the library, oldest is Version 1.
// A family whose versions are alternatives of one layout (the electric smelter's module variants) sets
// "versionsAlternatives": true on that same manifest entry; the library picker and the guide page then name
// each option by its label alone, with no "Version N" prefix, since the order is not a history.
//
// A family generator calls familyVersions() and stores the result; the indexer (index-designed-blueprints.mjs)
// calls checkVersions() and fails the build if a stored entry no longer matches its files.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodeBlueprint} from './blueprints.mjs';

const sha = s => createHash('sha256').update(s.trim()).digest('hex');
const readJSON = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const optionalJSON = file => readJSON(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
let machineTypes;
async function crafting() {
  if (!machineTypes) {
    const production = await readJSON(new URL('../site/data/production.json', import.meta.url));
    machineTypes = new Set(Object.entries(production.entities).filter(([id, e]) => Array.isArray(e.categories) && e.categories.length && id !== 'character').map(([id]) => id));
  }
  return machineTypes;
}

/** Crafting machines in a decoded blueprint (any entity type that runs recipes, furnaces included). */
export async function countMachines(blueprint) {
  const types = await crafting();
  return (blueprint.entities || []).filter(e => types.has(e.name)).length;
}

/** The passing build for exactly this string in a native report, or undefined. */
export function passingBuild(report, blueprintSha256) {
  if (!report) return undefined;
  const builds = Array.isArray(report.builds) ? report.builds : [report];
  return builds.find(b => b?.blueprintSha256 === blueprintSha256 && b.passed === true);
}

/** Measured output per minute of one version, from its own report; null where the report has none. */
export function measuredRates(report, blueprintSha256) {
  const build = passingBuild(report, blueprintSha256);
  const steady = build?.outputsPerMinute && typeof build.outputsPerMinute === 'object' ? build.outputsPerMinute : null;
  const recovery = build?.recovery?.outputsPerMinute && typeof build.recovery.outputsPerMinute === 'object' ? build.recovery.outputsPerMinute : null;
  return {steady, recovery};
}

/** Optional measured inputs per minute and power (kW) of one version, from its own report; absent where it has none. */
export function measuredOperation(report, blueprintSha256) {
  const build = passingBuild(report, blueprintSha256);
  return {
    inputsPerMinute: build?.inputsPerMinute && typeof build.inputsPerMinute === 'object' ? build.inputsPerMinute : undefined,
    powerKW: Number.isFinite(build?.powerKW) ? build.powerKW : undefined,
  };
}

/**
 * One versions entry. familyDir is blueprint-sources/<family>; file, manifest and report are relative to it.
 * Size comes from the version's own manifest entry (footprint) when given, otherwise width/height.
 */
export async function describeVersion({familyDir, label, summary, file, manifest, report, width, height}) {
  if (typeof label !== 'string' || !label.trim() || /\d/.test(label)) throw Error(`version label must be words: ${label}`);
  const code = await fs.readFile(path.join(familyDir, file), 'utf8'), blueprintSha256 = sha(code);
  const blueprint = decodeBlueprint(code.trim())?.blueprint;
  if (!blueprint?.entities?.length) throw Error(`${file}: not a single blueprint`);
  let footprint = width && height ? {width, height} : null;
  if (manifest) {
    const entries = await readJSON(path.join(familyDir, manifest)), entry = (Array.isArray(entries) ? entries : [entries]).find(e => e.blueprintSha256 === blueprintSha256);
    if (!entry) throw Error(`${manifest}: no entry for ${blueprintSha256}`);
    footprint ??= entry.footprint;
  }
  if (!(footprint?.width > 0 && footprint?.height > 0)) throw Error(`${file}: version size unknown`);
  const nativeReport = await optionalJSON(path.join(familyDir, report)), rates = measuredRates(nativeReport, blueprintSha256);
  const {inputsPerMinute, powerKW} = measuredOperation(nativeReport, blueprintSha256);
  return {label, ...(summary ? {summary} : {}), blueprintSha256, file, ...(manifest ? {manifest} : {}), report,
    width: footprint.width, height: footprint.height, tiles: footprint.width * footprint.height, machines: await countMachines(blueprint),
    outputsPerMinute: rates, ...(inputsPerMinute ? {inputsPerMinute} : {}), ...(powerKW !== undefined ? {powerKW} : {})};
}

/** All versions of a family, newest first; list items are describeVersion arguments without familyDir. */
export async function familyVersions(familyDir, list) {
  const out = [];
  for (const item of list) out.push(await describeVersion({familyDir, ...item}));
  const shas = out.map(v => v.blueprintSha256);
  if (new Set(shas).size !== shas.length) throw Error('two versions share one string');
  return out;
}

/**
 * Indexer check: the stored versions still describe their files. Returns the versions, newest first.
 * Throws when an entry differs from what its string and report say now, or the first is not the current string.
 */
export async function checkVersions(info, familyDir) {
  const versions = info.versions;
  if (!Array.isArray(versions) || !versions.length) return [];
  if (versions[0].blueprintSha256 !== info.blueprintSha256 || versions[0].file !== info.file) throw Error(`${info.id}: versions[0] must be the current string`);
  for (const v of versions) {
    const again = await describeVersion({familyDir, label: v.label, summary: v.summary, file: v.file, manifest: v.manifest, report: v.report, width: v.width, height: v.height});
    if (JSON.stringify(again) !== JSON.stringify(v)) throw Error(`${info.id}: stored version "${v.label}" no longer matches its files; re-run the family generator`);
  }
  return versions;
}

/** True when the family's versions are alternatives of one layout rather than successive versions. */
export const versionsAreAlternatives = info => info?.versionsAlternatives === true;

/** Plain-words comparison of each version against the others, for guide pages ("which to choose"). */
export function versionChoices(versions, products, name = id => id.replaceAll('-', ' ')) {
  const fmt = n => String(Number(n.toFixed(2)));
  return versions.map((v, i) => {
    const others = versions.filter(o => o !== v), parts = [];
    const smallest = Math.min(...versions.map(o => o.tiles));
    if (v.tiles === smallest && others.some(o => o.tiles > v.tiles)) parts.push(`smallest: ${v.width} × ${v.height} = ${v.tiles} tiles`);
    else parts.push(`${v.width} × ${v.height} = ${v.tiles} tiles`);
    const faster = products.filter(p => Number.isFinite(v.outputsPerMinute.steady?.[p]) && others.every(o => Number.isFinite(o.outputsPerMinute.steady?.[p]) && v.outputsPerMinute.steady[p] > o.outputsPerMinute.steady[p]));
    if (faster.length) parts.push('faster for ' + faster.map(p => `${name(p)} (${fmt(v.outputsPerMinute.steady[p])}/min)`).join(', '));
    if (!v.outputsPerMinute.steady) parts.push('output not measured');
    return {label: v.label, recommended: i === 0, text: parts.join('; ')};
  });
}

/**
 * Guide-page section for a family with two or more versions: which to choose, one comparison row per version
 * (size, machines, steady and recovery output per minute), and each version's import string with copy and
 * download. chip(id) returns the product's heading HTML (it may be async); files are relative to the page.
 * Pair it with VERSIONS_SCRIPT on the page for the copy buttons.
 */
export async function versionsSection({versions, products, codes, chip, esc, name = id => id.replaceAll('-', ' '), alternatives = false}) {
  const num = n => Number.isFinite(n) ? String(Number(n.toFixed(2))) : 'not measured';
  const withRecovery = versions.some(v => v.outputsPerMinute.recovery);
  // Optional columns: measured inputs per minute and power, only when some version records them.
  const inputs = [...new Set(versions.flatMap(v => Object.keys(v.inputsPerMinute || {})))], withPower = versions.some(v => Number.isFinite(v.powerKW));
  const heads = await Promise.all(products.map(async id => `<th scope="col">${await chip(id)}</th>`));
  const inputHeads = await Promise.all(inputs.map(async id => `<th scope="col" data-input-item="${esc(id)}">${await chip(id)} in</th>`));
  const rows = versions.map((v, i) => `<tr data-version-row="${i}"><th scope="row">${esc(v.label)}${i === 0 ? ' · recommended' : ''}</th><td>${v.width} × ${v.height} = ${v.tiles}</td><td>${v.machines}</td>${inputs.map(id => `<td data-input-item="${esc(id)}">${num(v.inputsPerMinute?.[id])}</td>`).join('')}${products.map(id => `<td>${num(v.outputsPerMinute.steady?.[id])}${withRecovery ? `<br><small>recovery ${num(v.outputsPerMinute.recovery?.[id])}</small>` : ''}</td>`).join('')}${withPower ? `<td data-power>${Number.isFinite(v.powerKW) ? num(v.powerKW) + ' kW' : 'not measured'}</td>` : ''}</tr>`).join('');
  const choices = versionChoices(versions, products, name);
  const blocks = versions.map((v, i) => `<article class="version-card" data-version="${i}"><h3>${esc(v.label)} · ${i === 0 ? 'recommended, current version' : alternatives ? 'alternative version' : 'earlier version'}</h3><p>${v.summary ? esc(v.summary) : `${v.width} × ${v.height} = ${v.tiles} tiles.`} ${v.machines} machines.</p><div class="actions"><button data-version-copy="${i}">Copy ${esc(v.label)} import</button><a class="button${i === 0 ? ' primary' : ''}" href="${esc(v.file)}" download>Download ${esc(v.label)} import</a><a class="button" href="${esc(v.report)}">Native report</a></div><details><summary>${esc(v.label)} import string</summary><textarea id="version-code-${i}" readonly aria-label="${esc(v.label)} import string">${esc(codes[i])}</textarea></details><p class="hash">SHA-256 ${esc(v.blueprintSha256)}</p></article>`).join('');
  const count = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][versions.length] ?? String(versions.length);
  const intro = alternatives ? 'Every import string below passed its native protocol for its exact SHA-256.' : 'Both import strings passed the full native protocol for their exact SHA-256 and stay available.';
  return `<section id="versions"><h2>${count} tested versions: which to choose</h2><p>${intro} Each row is measured from that version's own native report: ${inputs.length ? 'the inputs it drew and ' : ''}the steady rate${withRecovery ? ', and below it the rate after output was blocked and resumed (recovery)' : ''}, per minute${withPower ? ', and the electric power it drew while working' : ''}.</p><ul>${choices.map(c => `<li><strong>${esc(c.label)}</strong>${c.recommended ? ' (recommended)' : ''}: ${esc(c.text)}.</li>`).join('')}</ul><div class="table-scroll"><table class="version-compare"><thead><tr><th scope="col">Version</th><th scope="col">Tiles</th><th scope="col">Machines</th>${inputHeads.join('')}${heads.join('')}${withPower ? '<th scope="col">Power</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>${blocks}<p id="version-copy-status" role="status" aria-live="polite"></p></section>`;
}
export const VERSIONS_SCRIPT = `document.querySelectorAll('[data-version-copy]').forEach(b=>b.addEventListener('click',async()=>{const t=document.getElementById('version-code-'+b.dataset.versionCopy),s=document.getElementById('version-copy-status');try{if(location.protocol==='file:'||!navigator.clipboard?.writeText)throw Error('manual');await navigator.clipboard.writeText(t.value);s.textContent='Copied';}catch{t.closest('details').open=true;t.focus();t.select();s.textContent='Import selected — press Ctrl+C or Command+C to copy';}}));`;
export const VERSIONS_STYLE = `.version-card{border:1px solid #465249;border-radius:6px;padding:4px 18px 14px;margin:18px 0;background:#1b2621}.table-scroll{overflow-x:auto;max-width:100%}.version-compare td,.version-compare th{white-space:nowrap}.version-compare small{color:#9ca99e}`;
