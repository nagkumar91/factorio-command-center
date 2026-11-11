import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {matchFactoryEvidence} from './flight-factory-evidence.mjs';
import {compareNativeEvidence} from './flight-evidence-selection.mjs';

const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}' : JSON.stringify(value);
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const within = (root, file) => {
  const resolved = path.resolve(root, file);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error(`Artifact escapes catalogue: ${file}`);
  return resolved;
};

export function selectPromotionEvidence({variant, spec, code, reports, prototypeSha256}) {
  const sourceHash = hash(canonical(spec));
  const matching = reports.map(r => r.report ? r : {report: r}).filter(({report: r}) => r.id === variant.id && r.blueprintSha256 === variant.blueprintSha256
    && r.prototypeDumpSha256 === prototypeSha256 && r.sourceSpecSha256 === sourceHash && r.status !== 'ready');
  // Choose evidence independently of its outcome: a short passing run cannot
  // conceal a longer failure on the same artifact and boundary specification.
  matching.sort(compareNativeEvidence);
  const report = matching[0]?.report;
  if (!report) throw new Error(`No exact native report for ${variant.id}`);
  const evidence = matchFactoryEvidence({variant, spec: {...spec, warmupTicks: report.configuration?.warmupTicks,
    measurementTicks: report.configuration?.measurementTicks}, report, code, prototypeSha256});
  if (evidence.status !== 'native-throughput') throw new Error(`Native throughput has not passed for ${variant.id}: ${[...(evidence.reasons || []), ...(report.failures || [])].join(', ')}`);
  return {report, evidence};
}

export async function promoteFactoryVariants({source, output = 'blueprint-sources/flight-factories', ids = [], reportsRoot = '.cache/flight-native/reports', log = console.log} = {}) {
  if (!source || !ids.length || new Set(ids).size !== ids.length) throw new Error('Promotion requires --from and unique explicit --ids.');
  const oldBytes = await fs.readFile(path.join(output, 'manifest.json')), root = JSON.parse(oldBytes);
  const candidate = await read(path.join(source, 'manifest.json'));
  const [rootSpecs, candidateSpecs] = await Promise.all([read(path.join(output, 'native-test-specs.json')), read(path.join(source, 'native-test-specs.json'))]);
  if (root.prototypeSha256 !== candidate.prototypeSha256) throw new Error('Cannot promote across prototype hashes.');
  const candidates = new Map(candidate.items.flatMap(item => Object.entries(item.variants).map(([mode, variant]) => [variant.id, {item, mode, variant}])));
  const specs = new Map(candidateSpecs.factories.map(s => [s.id, s])), reports = [];
  for (const directory of await fs.readdir(reportsRoot, {withFileTypes: true})) if (directory.isDirectory()) {
    for (const id of ids) {
      const filename = path.join(reportsRoot, directory.name, id + '.json');
      try { reports.push({filename, report: await read(filename)}); }
      catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    }
  }
  const prepared = [];
  for (const id of ids) {
    const found = candidates.get(id), spec = specs.get(id);
    if (!found || found.variant.status !== 'generated' || !spec) throw new Error(`No generated candidate ${id}`);
    const current = root.items.find(i => i.type === found.item.type && i.id === found.item.id);
    if (!current?.variants[found.mode]) throw new Error(`Candidate is outside the existing audit: ${id}`);
    const code = await fs.readFile(within(source, found.variant.blueprintFile), 'utf8');
    const planBytes = await fs.readFile(within(source, found.variant.planFile));
    const plan = JSON.parse(planBytes);
    if (plan.blueprintSha256 !== found.variant.blueprintSha256) throw new Error(`Plan hash mismatch: ${id}`);
    const {report} = selectPromotionEvidence({variant: found.variant, spec, code, reports, prototypeSha256: root.prototypeSha256});
    prepared.push({...found, current, spec, code, planBytes, report});
  }
  if (hash(await fs.readFile(path.join(output, 'manifest.json'))) !== hash(oldBytes)) throw new Error('Root catalogue changed during promotion; retry against its new state.');
  const history = path.join(output, 'history', hash(oldBytes).slice(0, 16));
  await fs.mkdir(path.join(history, 'plans'), {recursive: true});
  await fs.writeFile(path.join(history, 'manifest.json'), oldBytes);
  await fs.copyFile(path.join(output, 'native-test-specs.json'), path.join(history, 'native-test-specs.json'));
  for (const row of prepared) {
    const oldPlan = row.current.variants[row.mode].planFile;
    if (oldPlan) await fs.copyFile(within(output, oldPlan), within(history, oldPlan));
    await fs.writeFile(within(output, row.variant.blueprintFile), row.code);
    await fs.writeFile(within(output, row.variant.planFile), row.planBytes);
    row.current.variants[row.mode] = row.variant;
    row.current.status = 'generated';
    const i = rootSpecs.factories.findIndex(s => s.id === row.variant.id);
    const spec = {...row.spec, blueprintPath: path.join(output, row.variant.blueprintFile), planFile: path.join(output, row.variant.planFile)};
    if (i < 0) rootSpecs.factories.push(spec); else rootSpecs.factories[i] = spec;
  }
  const variants = root.items.flatMap(i => Object.values(i.variants));
  const counts = rows => Object.fromEntries([...new Set(rows.map(r => r.status))].sort().map(status => [status, rows.filter(r => r.status === status).length]));
  root.generatedAt = new Date().toISOString();
  const rates = new Set(variants.map(v => v.targetPerMinute).filter(Number.isFinite));
  root.targetPerMinute = rates.size === 1 ? [...rates][0] : null;
  root.summary = {...root.summary, itemStatuses: counts(root.items), variantStatuses: counts(variants), generatedBlueprints: rootSpecs.factories.length, allComplete: false};
  rootSpecs.factories.sort((a, b) => a.id.localeCompare(b.id));
  await fs.writeFile(path.join(output, 'native-test-specs.json'), json(rootSpecs));
  await fs.writeFile(path.join(output, 'manifest.json'), json(root));
  const result = {promoted: prepared.map(r => ({id: r.variant.id, blueprintSha256: r.variant.blueprintSha256, nativeRunId: r.report.runId})), previousManifestSha256: hash(oldBytes), history};
  log(json(result)); return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {}, args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') options.source = args[++i];
    else if (args[i] === '--out') options.output = args[++i];
    else if (args[i] === '--ids') options.ids = args[++i].split(',');
    else if (args[i] === '--reports') options.reportsRoot = args[++i];
    else throw new Error(`Unknown argument ${args[i]}`);
  }
  await promoteFactoryVariants(options);
}
