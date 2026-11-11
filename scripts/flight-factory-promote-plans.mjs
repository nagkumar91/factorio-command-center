import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {normalizeGame, materialKey} from './flight-factory-model.mjs';
import {auditBalance} from './flight-factory-planner.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const within = (root, file) => { const result = path.resolve(root, file); if (!result.startsWith(path.resolve(root) + path.sep)) throw new Error('Plan path escapes catalogue.'); return result; };

export function retainCalculatedPlan({currentVariant, variant, plan, model, prototypeSha256}) {
  if (currentVariant.status !== 'unsupported') return null;
  if (variant.id !== currentVariant.id || plan.mode !== currentVariant.mode || plan.prototypeSha256 !== prototypeSha256
    || plan.status !== 'planned' || !['planned', 'generated'].includes(variant.status)) throw new Error('Calculated plan identity/status mismatch.');
  if (!(plan.target.perSecond > 0) || !Number.isFinite(plan.target.perSecond)
    || !plan.steps.length || plan.steps.some(s => !(s.craftsPerSecond > 0) || !Number.isFinite(s.craftsPerSecond))
    || [...plan.inputs, ...plan.surplus].some(p => !(p.perSecond >= 0) || !Number.isFinite(p.perSecond))) throw new Error('Calculated plan has invalid physical rates.');
  const balance = auditBalance(plan, model);
  if (!balance.passed) throw new Error(`Calculated balance failed: ${balance.maxResidual}`);
  const clean = structuredClone(plan), ports = new Map();
  for (const p of plan.inputs) {
    const k = materialKey(p), old = ports.get(k);
    if (old) old.perSecond += p.perSecond;
    else ports.set(k, {id: p.id || p.name, type: p.type, perSecond: p.perSecond, source: p.source, sources: p.sources || [], obtainableFromRaw: p.obtainableFromRaw});
  }
  clean.inputs = [...ports.values()]; clean.balance = balance;
  for (const key of ['blueprintSha256', 'entityCount', 'outputs', 'wasteOutputs', 'materialSeeds', 'logistics']) delete clean[key];
  clean.assumptions = clean.assumptions.filter(s => !/^Add \d+ logistic robots|^Connect external electricity|^Continuously empty all/.test(s));
  clean.warnings.push('Calculated balance only. No blueprint or native production claim is published for this variant.');
  const retained = {...variant, status: 'planned', layoutStatus: 'not-published', evidence: {status: 'unverified'},
    reason: variant.status === 'planned' ? variant.reason : 'Balanced plan retained; candidate layout awaits exact native verification.', inputCount: clean.inputs.length};
  delete retained.blueprintSha256; delete retained.blueprintFile;
  return {variant: retained, plan: clean};
}

export async function promoteCalculatedPlans({source, output = 'blueprint-sources/flight-factories', ids = [], rawPath = '.cache/flight-game/script-output/data-raw-dump.json', log = console.log} = {}) {
  if (!source || !ids.length || new Set(ids).size !== ids.length) throw new Error('Use --from and unique explicit --ids.');
  const oldBytes = await fs.readFile(path.join(output, 'manifest.json')), root = JSON.parse(oldBytes), candidate = await read(path.join(source, 'manifest.json'));
  const rawBytes = await fs.readFile(rawPath), prototypeSha256 = hash(rawBytes);
  if (root.prototypeSha256 !== prototypeSha256 || candidate.prototypeSha256 !== prototypeSha256) throw new Error('Prototype hash mismatch.');
  const model = normalizeGame(JSON.parse(rawBytes), {prototypeSha256}), byId = new Map(candidate.items.flatMap(item => Object.entries(item.variants).map(([mode, variant]) => [variant.id, {item, mode, variant}])));
  const prepared = [], skipped = [];
  for (const id of ids) {
    const row = byId.get(id), item = row && root.items.find(i => i.id === row.item.id && i.type === row.item.type), currentVariant = item?.variants[row?.mode];
    if (!row || !currentVariant) throw new Error(`Unknown existing variant ${id}`);
    if (currentVariant.status !== 'unsupported') { skipped.push({id, reason: 'Existing supported variant preserved.'}); continue; }
    if (!row.variant.planFile || !['planned', 'generated'].includes(row.variant.status)) { skipped.push({id, reason: 'No recovered balanced plan.'}); continue; }
    const plan = await read(within(source, row.variant.planFile));
    if (materialKey(plan.target) !== materialKey(item)) throw new Error(`Wrong plan product: ${id}`);
    const retained = retainCalculatedPlan({currentVariant, variant: row.variant, plan, model, prototypeSha256});
    prepared.push({...retained, item, mode: row.mode, currentVariant});
  }
  if (!prepared.length) { log(json({promoted: [], skipped})); return {promoted: [], skipped}; }
  if (hash(await fs.readFile(path.join(output, 'manifest.json'))) !== hash(oldBytes)) throw new Error('Root changed during plan validation; retry.');
  const history = path.join(output, 'history', hash(oldBytes).slice(0, 16));
  await fs.mkdir(path.join(history, 'plans'), {recursive: true});
  await fs.writeFile(path.join(history, 'manifest.json'), oldBytes);
  await fs.copyFile(path.join(output, 'native-test-specs.json'), path.join(history, 'native-test-specs.json'));
  for (const row of prepared) {
    if (row.currentVariant.planFile) await fs.copyFile(within(output, row.currentVariant.planFile), within(history, row.currentVariant.planFile));
    await fs.writeFile(within(output, row.variant.planFile), json(row.plan)); row.item.variants[row.mode] = row.variant;
    row.item.status = Object.values(row.item.variants).some(v => v.status === 'generated') ? 'generated' : 'planned';
  }
  const variants = root.items.flatMap(i => Object.values(i.variants));
  const counts = rows => Object.fromEntries([...new Set(rows.map(r => r.status))].sort().map(s => [s, rows.filter(r => r.status === s).length]));
  root.generatedAt = new Date().toISOString();
  root.summary = {...root.summary, itemStatuses: counts(root.items), variantStatuses: counts(variants), allComplete: false};
  await fs.writeFile(path.join(output, 'manifest.json'), json(root));
  const result = {promoted: prepared.map(r => r.variant.id), skipped, history, evidence: 'calculated-only'}; log(json(result)); return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {}, args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') options.source = args[++i];
    else if (args[i] === '--out') options.output = args[++i];
    else if (args[i] === '--ids') options.ids = args[++i].split(',');
    else if (args[i] === '--raw') options.rawPath = args[++i];
    else throw new Error(`Unknown argument ${args[i]}`);
  }
  await promoteCalculatedPlans(options);
}
