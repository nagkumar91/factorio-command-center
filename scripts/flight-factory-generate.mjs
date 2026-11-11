import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {normalizeGame, materialKey} from './flight-factory-model.mjs';
import {planFactory, requiredResearch} from './flight-factory-planner.mjs';
import {generateFactoryBlueprint, provisionItemTransfers} from './flight-factory-layout.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
export async function generateCatalogue({rawPath = '.cache/flight-game/script-output/data-raw-dump.json', output = 'blueprint-sources/flight-factories', perMinute = 1, only = [], layouts = true, update = false, log = console.log} = {}) {
  const bytes = await fs.readFile(rawPath), prototypeSha256 = hash(bytes);
  let manualSources = [], progressionAuditSha256 = null;
  try { const audit = await fs.readFile('flight-map/progression-audit.json'); manualSources = JSON.parse(audit).exchange?.offers || []; progressionAuditSha256 = hash(audit); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let seededResources = [], nativeMapEvidenceSha256 = null;
  try {
    const evidence = await fs.readFile('flight-map/native-report.json'), report = JSON.parse(evidence);
    if (report.prototypeSha256 === prototypeSha256) {
      nativeMapEvidenceSha256 = hash(evidence);
      seededResources = Object.entries(report.resources || {}).map(([entity, amount]) => ({entity, amount, evidencePath: 'flight-map/native-report.json', evidenceSha256: nativeMapEvidenceSha256}));
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const model = normalizeGame(JSON.parse(bytes), {prototypeSha256, manualSources, seededResources});
  const previous = update ? JSON.parse(await fs.readFile(path.join(output, 'manifest.json'))) : null;
  const previousSpecs = update ? JSON.parse(await fs.readFile(path.join(output, 'native-test-specs.json'))) : null;
  if (previous && previous.prototypeSha256 !== prototypeSha256) throw new Error('Cannot merge catalogue updates across prototype hashes; regenerate the full catalogue.');
  const manifest = {schemaVersion: 1, generatedAt: new Date().toISOString(), profile: 'installed-modded-nauvis', prototypeSha256, rawPath,
    scope: only.length ? 'selected-items' : 'all-installed-items-and-fluids', targetPerMinute: perMinute, surface: model.surface, surfaceProperties: model.properties, progressionAuditSha256, nativeMapEvidenceSha256,
    source: {name: 'Original generated factories for the exact installed Factorio prototypes', generator: 'scripts/flight-factory-generate.mjs'},
    policies: {raw: 'Natural resources delivered to boundary; no extraction machinery included.', intermediary: 'Direct ingredients of a preferred installed target recipe are supplied.', mixed: 'Complex direct ingredients supplied; simple ingredients expanded to natural resources.',
      evidence: 'Calculated balance and generated blueprint are not native production evidence. All-complete requires each recipe product variant to pass matched native tests.',
      rate: 'Demand rate with rounded machine capacity. Extra capacity is not a measured output rate.'}, items: []};
  const specs = {schemaVersion: 1, prototypeSha256, prototypeDumpSha256: prototypeSha256, rawPath, factories: []};
  await fs.mkdir(path.join(output, 'blueprints'), {recursive: true}); await fs.mkdir(path.join(output, 'plans'), {recursive: true});
  const goods = [...model.goods.values()].filter(g => !only.length || only.includes(g.id) || only.includes(materialKey(g))).sort((a, b) => materialKey(a).localeCompare(materialKey(b)));
  for (const good of goods) {
    const key = materialKey(good), recipeIds = model.recipeProducts.get(key) || [];
    const excluded = model.excludedRecipes.filter(r => recipeIds.includes(r.id));
    const item = {id: good.id, type: good.type, prototypeType: good.prototypeType, subgroup: good.subgroup, hidden: good.hidden,
      recipeIds, eligibleRecipeProduct: model.eligibleProducts.has(key), eligibleRecipeIds: model.eligibleProducts.get(key) || [],
      ...(!model.eligibleProducts.has(key) ? {coverageExclusion: good.id === 'rocket-part' ? 'Internal silo process; not an exportable inventory item.' : 'No positive-net, unlocked, ordinary recipe product; natural extraction, virtual items and hidden recycling are separate.'} : {}),
      rawSources: model.rawSources.get(key) || [], obtainableFromRaw: model.reachable.has(key), excludedRecipes: excluded, status: 'unsupported', variants: {}};
    for (const mode of ['raw', 'intermediary', 'mixed']) {
      const id = `${good.type}-${good.id}-${mode}`.replace(/[^A-Za-z0-9_-]/g, '_');
      // Native breeding tests showed small spoilage-fed deliveries expiring
      // before a 100-nutrient batch accumulated. Use fresh mash in a local
      // nutrient return loop for this target; all quantities remain prototype-derived.
      // The current local return loop supports one product. A Kovarex route
      // needs a separate two-product reserve; ordinary target requesters can
      // otherwise steal its rare seed before forty U-235 accumulate.
      const exclusions = ['kovarex-enrichment-process', ...(good.type === 'item' && good.id === 'raw-fish'
        ? ['nutrients-from-spoilage', 'nutrients-from-fish', 'nutrients-from-biter-egg', 'nutrients-from-bioflux'] : [])];
      const plan = planFactory(model, good, {mode, perSecond: perMinute / 60, excludedRecipes: exclusions});
      provisionItemTransfers(model, plan);
      if (plan.steps.some(s => s.recipe === 'nutrients-from-yumako-mash') && good.id === 'raw-fish') plan.operatingPolicy = 'Fresh nutrients made locally from mash; finite nutrient burner startup stock is explicit.';
      if (plan.steps.some(s => s.recipe === 'uranium-processing' || s.recipe === 'uranium-chunk-processing')) plan.assumptions.push('Uranium-235 starts from ore processing; no enriched uranium startup seed is required.');
      const variant = {id, mode, status: plan.status, evidence: {status: 'unverified'}, ...(plan.reason ? {reason: plan.reason} : {})};
      if (plan.status === 'planned') {
        let layout = layouts ? generateFactoryBlueprint(model, plan) : {status: 'not-requested'};
        for (let attempt = 1; attempt < 4 && layout.status === 'unsupported' && /route/.test(layout.reason); attempt++) layout = generateFactoryBlueprint(model, plan, {attempt});
        variant.layoutStatus = layout.status;
        if (layout.reason) variant.reason = layout.reason;
        if (layout.status === 'generated') {
          variant.status = 'generated'; variant.blueprintSha256 = layout.blueprintSha256;
          variant.blueprintFile = `blueprints/${id}.${layout.blueprintSha256}.txt`;
          await fs.writeFile(path.join(output, variant.blueprintFile), layout.code);
          Object.assign(plan, {inputs: layout.inputs, outputs: layout.outputs, wasteOutputs: layout.wasteOutputs, logistics: layout.logistics,
            startupStock: layout.spec.startupStock, materialSeeds: layout.spec.materialSeeds, blueprintSha256: layout.blueprintSha256, entityCount: layout.blueprint.entities.length});
          plan.assumptions.push(...layout.operatingNotes);
          plan.requiredResearch = requiredResearch(model, plan.steps, [...new Set(layout.blueprint.entities.map(e => e.name))]);
          specs.factories.push({id, ...layout.spec, blueprintPath: path.join(output, variant.blueprintFile), planFile: path.join(output, `plans/${id}.json`), blueprintFile: variant.blueprintFile});
        }
        variant.planFile = `plans/${id}.json`; variant.machineCount = plan.machineCount; variant.targetPerMinute = perMinute;
        variant.rawOnly = plan.rawOnly; variant.stochastic = plan.stochastic; variant.inputCount = plan.inputs.length;
        await fs.writeFile(path.join(output, variant.planFile), json(plan));
      }
      item.variants[mode] = variant;
    }
    const variants = Object.values(item.variants);
    if (variants.some(v => v.status === 'generated')) item.status = 'generated';
    else if (variants.some(v => v.status === 'planned')) item.status = 'planned';
    else if (!item.eligibleRecipeProduct && item.rawSources.length) { item.status = 'resource-only'; item.reason = 'An extraction or harvest product, not a supported positive-net crafting recipe product.'; }
    else if (!recipeIds.length) { item.status = good.hidden || /^parameter-/.test(good.id) ? 'unobtainable' : 'unsupported-non-recipe-process'; item.reason = 'No recipe product or declared natural source in installed prototypes; launch, spoilage, script and virtual items require separate handling.'; }
    else { item.reason = excluded.length === recipeIds.length ? 'All producer recipes need unsupported processing, research, surface or hidden recycling handling.' : 'No supported balanced recipe route.'; }
    manifest.items.push(item);
    if (manifest.items.length % 20 === 0 || only.length) log(`${manifest.items.length}/${goods.length}: ${good.id}; ${specs.factories.length} generated blueprints`);
  }
  if (previous) {
    const replaced = new Set(manifest.items.map(materialKey));
    const replacedVariants = new Set(manifest.items.flatMap(i => Object.values(i.variants).map(v => v.id)));
    manifest.items = [...previous.items.filter(i => !replaced.has(materialKey(i))), ...manifest.items].sort((a, b) => materialKey(a).localeCompare(materialKey(b)));
    manifest.scope = previous.scope;
    manifest.targetPerMinute = previous.targetPerMinute === perMinute ? perMinute : null;
    specs.factories = [...previousSpecs.factories.filter(s => !replacedVariants.has(s.id)), ...specs.factories].sort((a, b) => a.id.localeCompare(b.id));
  }
  const variants = manifest.items.flatMap(i => Object.values(i.variants));
  const counts = list => Object.fromEntries([...new Set(list.map(i => i.status))].sort().map(status => [status, list.filter(i => i.status === status).length]));
  manifest.summary = {installedGoods: model.goods.size, includedGoods: manifest.items.length, recipeProductGoods: manifest.items.filter(i => i.recipeIds.length).length,
    eligibleRecipeProductGoods: manifest.items.filter(i => i.eligibleRecipeProduct).length,
    itemStatuses: counts(manifest.items), variantStatuses: counts(variants), totalVariants: variants.length, generatedBlueprints: specs.factories.length, nativeVerifiedVariants: 0, allComplete: false};
  await fs.writeFile(path.join(output, 'manifest.json'), json(manifest));
  await fs.writeFile(path.join(output, 'native-test-specs.json'), json(specs));
  log(JSON.stringify(manifest.summary));
  return {manifest, specs};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--raw') options.rawPath = args[++i];
    else if (arg === '--out') options.output = args[++i];
    else if (arg === '--per-minute') options.perMinute = Number(args[++i]);
    else if (arg === '--only') options.only = args[++i].split(',');
    else if (arg === '--plan-only') options.layouts = false;
    else if (arg === '--update') options.update = true;
    else throw new Error(`Unknown argument ${arg}`);
  }
  await generateCatalogue(options);
}
