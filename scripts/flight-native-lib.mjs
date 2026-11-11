// Flight-only native evidence. This module never reads or writes the public site.
import {createHash} from 'node:crypto';
import {decodeBlueprint} from './blueprints.mjs';
import {stochasticDependencyAudit,stochasticWindowTest,poissonRateInterval} from './flight-native-statistics.mjs';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonicalJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export const configurationHash = value => sha256(canonicalJSON(value));
export const materialKey = p => `${p.type || 'item'}:${p.name || p.id}`;
const values = value => Object.values(value || {});
const positive = value => Number.isFinite(value) && value > 0;
const finitePosition = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);

export function specEntries(document) {
  const result = Array.isArray(document) ? document : document.builds || document.factories || document.entries || document.specs;
  if (!Array.isArray(result)) throw new Error('Expected native specs array or {builds:[],prototypeDumpSha256}');
  const ids = new Set();
  for (const row of result) {
    if (!row.id || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(row.id) || ids.has(row.id)) throw new Error(`Invalid or duplicate factory id: ${row.id}`);
    ids.add(row.id);
  }
  return result;
}

export function prototypeIndex(raw, surface = 'nauvis') {
  const entities = new Map(), goods = new Map(), natural = new Set();
  for (const [type, group] of Object.entries(raw)) for (const p of values(group)) {
    if (p.collision_box || p.selection_box) entities.set(p.name, p);
    if (p.stack_size !== undefined) goods.set(`item:${p.name}`, p);
    if (type === 'fluid') goods.set(`fluid:${p.name}`, p);
  }
  const map = raw.planet?.[surface]?.map_gen_settings;
  const entitySettings = map?.autoplace_settings?.entity?.settings;
  for (const type of ['resource', 'tree', 'plant', 'fish', 'simple-entity']) for (const p of values(raw[type])) {
    if (!p.autoplace || (type === 'resource' && entitySettings && !Object.hasOwn(entitySettings, p.name))) continue;
    const products = p.minable?.result ? [{name:p.minable.result}] : values(p.minable?.results);
    for (const product of products) natural.add(materialKey(product));
  }
  const tileSettings = map?.autoplace_settings?.tile?.settings;
  for (const p of values(raw.tile)) if (p.fluid && (!tileSettings || Object.hasOwn(tileSettings, p.name))) natural.add(`fluid:${p.fluid}`);
  return {entities, goods, natural};
}

function normalizedPort(p) {
  return {...p, type:p.type || (p.kind === 'fluid' ? 'fluid' : 'item'), name:p.name || p.id,
    entityNumber:p.entityNumber ?? p.entity, position:p.position || (Number.isFinite(p.x) ? {x:p.x,y:p.y} : undefined)};
}

// Fail closed on unsupported mechanics rather than quietly repairing a layout.
export function prepareSpec(entry, {code, raw, prototypeDumpSha256, defaults = {}, sourceEvidence = {}}) {
  const unsupported = [], reject = message => unsupported.push(message);
  const actualSha = sha256(code.trim());
  const expectedPrototype = entry.prototypeDumpSha256 || entry.prototypeSha256 || defaults.prototypeDumpSha256 || defaults.prototypeSha256;
  if (!entry.blueprintSha256 || actualSha !== entry.blueprintSha256) reject('blueprint-sha256-mismatch');
  if (!expectedPrototype || expectedPrototype !== prototypeDumpSha256) reject('prototype-dump-sha256-mismatch');
  let blueprint;
  try { blueprint = decodeBlueprint(code)?.blueprint; } catch (error) { reject('blueprint-decode: ' + error.message); }
  if (!blueprint?.entities?.length) reject('one-nonempty-blueprint-required');
  const entities = blueprint?.entities || [];
  const surface = entry.surface?.name || entry.surface || defaults.surface || 'nauvis';
  if (typeof surface !== 'string' || !raw.planet?.[surface]) reject('unknown-surface');
  const index = prototypeIndex(raw, surface);
  // This historical field binds declarations to the source evidence recorded
  // in the original spec. Current persistent map availability is an independent
  // environmentAvailability binding; an old reload/initialization report alone
  // must never be presented as current loaded-save resource proof.
  const verifiedResourceSources=[];
  for(const p of entry.inputs || [])for(const source of p.sources || [])if(source.kind==='seeded-resource-extraction'){
    const evidence=sourceEvidence[source.evidenceSha256] || sourceEvidence[source.evidencePath],resource=raw.resource?.[source.entity];
    const products=resource?.minable?.result?[{name:resource.minable.result}]:values(resource?.minable?.results);
    if(evidence?.sha256!==source.evidenceSha256 || evidence?.report?.prototypeSha256!==prototypeDumpSha256 || evidence?.report?.reloadValidation?.passed!==true
      || !(evidence?.report?.resources?.[source.entity]>0) || !positive(source.amount) || source.amount>evidence.report.resources[source.entity]
      || source.renewable!==false || !products.some(r=>materialKey(r)===materialKey(p))){reject(`invalid-seeded-resource-evidence:${materialKey(p)}`);continue;}
    index.natural.add(materialKey(p));verifiedResourceSources.push({material:materialKey(p),entity:source.entity,amount:source.amount,observedAmount:evidence.report.resources[source.entity],evidencePath:source.evidencePath,evidenceSha256:source.evidenceSha256,renewable:false,extractionIncluded:false});
  }
  const byId = new Map(), craftProducts = new Set(), outputProducerEntityIds = {}, expectedRecipes = {}, statisticsIgnoredInputs = {},statisticsIgnoredOutputs = {},unsafeCraftCounterOutputs = {};
  for (const e of entities) {
    const p = index.entities.get(e.name);
    if (!p) reject(`missing-entity-prototype:${e.name}`);
    if (!Number.isInteger(e.entity_number) || byId.has(e.entity_number)) reject(`duplicate-or-invalid-entity-number:${e.entity_number}`);
    byId.set(e.entity_number, e);
    if (!finitePosition(e.position)) reject(`invalid-entity-position:${e.entity_number}`);
    if (e.tags?.flight_entity !== e.entity_number) reject(`missing-stable-flight-entity-tag:${e.entity_number}`);
    if (e.quality && e.quality !== 'normal') reject(`unsupported-quality:${e.entity_number}`);
    if (e.items && values(e.items).length) reject(`unsupported-preloaded-items-or-modules:${e.entity_number}`);
    if (/infinity|loader/.test(e.name) || p?.type === 'electric-energy-interface') reject(`fixture-inside-blueprint:${e.name}`);
    if (['linked-container','linked-belt','proxy-container','cargo-landing-pad','rocket-silo','agricultural-tower','mining-drill','offshore-pump'].includes(p?.type)) reject(`unsupported-entity-type:${p.type}`);
    if (p && ['assembling-machine','furnace'].includes(p.type)) {
      const recipe = raw.recipe?.[e.recipe || p.fixed_recipe || e.tags?.production_recipe];
      if (!recipe) reject(`explicit-recipe-required:${e.entity_number}`);
      if(recipe)expectedRecipes[e.entity_number]=recipe.name;
      for(const ingredient of values(recipe?.ingredients))if(ingredient.ignored_by_stats>0)statisticsIgnoredInputs[materialKey(ingredient)]=true;
      for (const r of recipe?.result ? [{name:recipe.result}] : values(recipe?.results)) {
        const k=materialKey(r);craftProducts.add(k);(outputProducerEntityIds[k] ||= []).push(e.entity_number);
        if(r.ignored_by_stats>0){
          statisticsIgnoredOutputs[k]=true;
          if((r.probability ?? 1)!==1 || (r.amount ?? r.amount_min ?? 1)<=0)unsafeCraftCounterOutputs[k]=true;
        }
      }
    }
  }
  if (blueprint?.tiles?.length) reject('blueprint-tiles-not-supported');
  if (entry.expectedEntityCount !== undefined && entry.expectedEntityCount !== entities.length) reject('entity-count-mismatch');
  const inputs = (entry.inputs || []).map(normalizedPort), outputs = (entry.outputs || []).map(normalizedPort);
  if (!inputs.length || !outputs.length) reject('explicit-boundary-inputs-and-outputs-required');
  if (!outputs.some(p => p.role !== 'surplus')) reject('at-least-one-target-output-required');
  const portIds = new Set();
  for (const [role, ports] of [['input', inputs], ['output', outputs]]) for (const p of ports) {
    const saved = byId.get(p.entityNumber), proto = index.entities.get(saved?.name), key = materialKey(p);
    if (!['item','fluid'].includes(p.type) || !index.goods.has(key)) reject(`missing-port-prototype:${key}`);
    if (!saved) reject(`missing-${role}-port-entity:${p.entityNumber}`);
    if (portIds.has(p.entityNumber)) reject(`overlapping-boundary-ports:${p.entityNumber}`);
    portIds.add(p.entityNumber);
    if (p.position && (!finitePosition(p.position) || p.position.x !== saved?.position.x || p.position.y !== saved?.position.y)) reject(`port-position-mismatch:${p.entityNumber}`);
    if (saved?.tags?.[`flight_${role}`] !== key) reject(`port-tag-mismatch:${p.entityNumber}:${key}`);
    if (p.type === 'item' && !['container','logistic-container','transport-belt'].includes(proto?.type)) reject(`not-a-boundary-chest-or-belt:${p.entityNumber}`);
    if (p.type === 'fluid' && !['pipe','pipe-to-ground','storage-tank'].includes(proto?.type)) reject(`not-a-boundary-pipe-or-tank:${p.entityNumber}`);
    if (p.type === 'fluid' && role === 'input' && !finitePosition(p.fixturePosition)) reject(`external-fluid-fixture-position-required:${p.entityNumber}`);
    const boundaryMode = entry.mode || entry.boundaryMode || 'raw';
    if (!['raw','mixed','intermediary','raw+startup','mixed+startup','intermediary+startup'].includes(boundaryMode)) reject(`unknown-boundary-mode:${boundaryMode}`);
    if (role === 'input' && (['raw','raw+startup'].includes(boundaryMode) || entry.rawOnly === true) && !index.natural.has(key)) reject(`non-raw-boundary-input:${key}`);
    if (role === 'output' && !craftProducts.has(key)) reject(`output-not-a-saved-recipe-product:${key}`);
    if (role === 'output' && p.role!=='surplus' && unsafeCraftCounterOutputs[key]) reject(`unsupported-random-product-excluded-from-native-statistics:${key}`);
    if (role === 'output' && inputs.some(i => materialKey(i) === key)) reject(`input-output-overlap:${key}`);
    if (p.ratePerSecond !== undefined && !positive(p.ratePerSecond)) reject(`invalid-input-rate:${key}`);
    if (p.supplyRatePerSecond !== undefined && (p.type !== 'item' || !positive(p.supplyRatePerSecond))) reject(`unsupported-supply-rate:${key}`);
    if (p.minPerMinute !== undefined && (!Number.isFinite(p.minPerMinute) || p.minPerMinute < 0)) reject(`invalid-output-target:${key}`);
  }
  const wasteOutputs=(entry.wasteOutputs || []).map(normalizedPort),wasteArms=new Set();
  for(const p of wasteOutputs){
    const chest=byId.get(p.entityNumber),source=byId.get(p.sourceEntityNumber),arm=byId.get(p.inserterEntityNumber),key=materialKey(p);
    const sourceProto=index.entities.get(source?.name),armProto=index.entities.get(arm?.name);
    if(p.type!=='item' || !index.goods.has(key) || chest?.name!=='steel-chest' || chest?.tags?.flight_waste!==key || chest?.tags?.flight_waste_source!==p.sourceEntityNumber)reject(`invalid-dedicated-waste-chest:${p.entityNumber}`);
    if(portIds.has(p.entityNumber) || p.sourceEntityNumber===p.entityNumber)reject(`overlapping-waste-port:${p.entityNumber}`);
    portIds.add(p.entityNumber);
    if(!finitePosition(p.position) || p.position.x!==chest?.position.x || p.position.y!==chest?.position.y)reject(`waste-position-mismatch:${p.entityNumber}`);
    if(!['container','logistic-container'].includes(sourceProto?.type))reject(`waste-source-must-be-chest:${p.sourceEntityNumber}`);
    if(!Array.isArray(p.spoiledFrom) || !p.spoiledFrom.length || p.spoiledFrom.some(n=>index.goods.get('item:'+n)?.spoil_result!==p.name))reject(`waste-not-a-prototype-spoil-result:${p.entityNumber}`);
    if([...inputs,...outputs].some(q=>q.entityNumber===p.sourceEntityNumber && materialKey(q)===key))reject(`waste-source-is-declared-product:${p.sourceEntityNumber}`);
    if(values(source?.request_filters?.sections).some(section=>values(section.filters).some(f=>f.name===p.name)))reject(`waste-source-requests-waste:${p.sourceEntityNumber}`);
    const filters=values(arm?.filters);
    if(armProto?.type!=='inserter' || arm?.use_filters!==true || arm?.filter_mode!=='whitelist' || filters.length!==1 || filters[0]?.name!==p.name || (filters[0]?.quality && filters[0].quality!=='normal') || (filters[0]?.comparator && filters[0].comparator!=='='))reject(`waste-requires-exclusive-filtered-inserter:${p.inserterEntityNumber}`);
    if(wasteArms.has(p.inserterEntityNumber))reject(`shared-waste-inserter:${p.inserterEntityNumber}`);wasteArms.add(p.inserterEntityNumber);
    for(const [vector,target] of [[armProto?.pickup_position,source],[armProto?.insert_position,chest]]){
      const x=vector?.x ?? vector?.[0],y=vector?.y ?? vector?.[1];
      const rotated=({0:[x,y],4:[-y,x],8:[-x,-y],12:[y,-x]})[arm?.direction || 0];
      const box=index.entities.get(target?.name)?.collision_box;
      const px=arm?.position.x+(rotated?.[0] ?? NaN),py=arm?.position.y+(rotated?.[1] ?? NaN);
      if(!box || !(px>=target.position.x+box[0][0] && px<=target.position.x+box[1][0] && py>=target.position.y+box[0][1] && py<=target.position.y+box[1][1]))reject(`waste-inserter-route-mismatch:${p.inserterEntityNumber}`);
    }
  }
  const powerPoleId = entry.powerPoleId ?? entry.powerPoleIds?.[0];
  if (index.entities.get(byId.get(powerPoleId)?.name)?.type !== 'electric-pole') reject('explicit-saved-power-pole-required');
  const seeds = entry.infrastructureSeeds || [];
  for (const seed of seeds) {
    if (index.entities.get(byId.get(seed.entityNumber)?.name)?.type !== 'roboport' || seed.item !== 'logistic-robot' || !Number.isInteger(seed.count) || seed.count < 1) reject('unsupported-infrastructure-seed');
    // Infrastructure robots are never injected into a material inventory. Native
    // item production deltas separately prove any robot outputs were crafted.
  }
  // A roboport inventory is not a logistic provider. Forbid pickup arms aimed
  // into seeded roboports so fixture robots cannot become exported product.
  for(const e of entities){
    const p=index.entities.get(e.name);if(p?.type!=='inserter')continue;
    if(e.pickup_position || e.drop_position){reject(`unsupported-custom-inserter-vectors:${e.entity_number}`);continue;}
    const vector=p.pickup_position;if(!vector)continue;
    const x=vector.x ?? vector[0],y=vector.y ?? vector[1];
    const rotated=({0:[x,y],4:[-y,x],8:[-x,-y],12:[y,-x]})[e.direction || 0];
    if(!rotated){reject(`unsupported-inserter-direction:${e.entity_number}`);continue;}
    const target={x:e.position.x+rotated[0],y:e.position.y+rotated[1]};
    for(const seed of seeds){
      const port=byId.get(seed.entityNumber),proto=index.entities.get(port?.name),box=proto?.selection_box || proto?.collision_box;
      if(box && target.x>=port.position.x+box[0][0] && target.x<=port.position.x+box[1][0] && target.y>=port.position.y+box[0][1] && target.y<=port.position.y+box[1][1])reject(`infrastructure-robot-extraction-not-supported:${e.entity_number}`);
    }
  }
  const materialSeeds=entry.materialSeeds || [];
  if (entry.startupStock?.length && !materialSeeds.length) reject('startup-stock-needs-explicit-boundary-seeds');
  if (materialSeeds.length && (entry.rawOnly !== false || !['raw+startup','mixed+startup','intermediary+startup'].includes(entry.boundaryMode))) reject('startup-seeds-need-explicit-raw-plus-startup-mode');
  for (const seed of materialSeeds) {
    const saved=byId.get(seed.entityNumber),p=index.entities.get(saved?.name);
    if (seed.type !== 'item' || !index.goods.has(materialKey(seed)) || !Number.isInteger(seed.count) || seed.count<1) reject('invalid-material-seed');
    if (!(p?.type === 'container' || (p?.type==='logistic-container' && p.logistic_mode === 'passive-provider')) || saved?.tags?.flight_startup !== materialKey(seed) || portIds.has(seed.entityNumber)) reject('startup-seed-needs-dedicated-declared-boundary-chest');
    portIds.add(seed.entityNumber);
  }
  const warmupTicks = entry.warmupTicks ?? defaults.warmupTicks ?? 15 * 3600;
  const measurementTicks = entry.measurementTicks ?? defaults.measurementTicks ?? 30 * 3600;
  const windows = entry.windows ?? entry.measurementWindows ?? defaults.windows ?? defaults.measurementWindows ?? 3;
  if (!Number.isInteger(warmupTicks) || warmupTicks < 60 || warmupTicks % 60) reject('warmup-must-be-positive-whole-seconds');
  if (!Number.isInteger(windows) || windows < 3 || windows > 20 || !Number.isInteger(measurementTicks) || measurementTicks < windows * 60 || measurementTicks % (windows * 60)) reject('measurement-must-contain-at-least-three-equal-whole-second-windows');
  const surfaceProperties = {...Object.fromEntries(values(raw['surface-property']).map(p => [p.name,p.default_value])), ...(raw.planet?.[surface]?.surface_properties || {})};
  if (entry.surfaceProperties && canonicalJSON({...surfaceProperties,...entry.surfaceProperties}) !== canonicalJSON(surfaceProperties)) reject('surface-properties-differ-from-installed-planet');
  if (entry.enableAllRecipes !== true && !entry.researchClosure?.length) reject('explicit-research-policy-required');
  for (const name of entry.researchClosure || []) if (!raw.technology?.[name]) reject(`missing-research:${name}`);
  const config = {...entry, inputs, outputs, wasteOutputs,infrastructureSeeds:seeds, materialSeeds, powerPoleId, warmupTicks, measurementTicks, windows,outputProducerEntityIds,expectedRecipes,statisticsIgnoredInputs,statisticsIgnoredOutputs,unsafeCraftCounterOutputs,verifiedResourceSources,
    stochasticDependencyAudit:stochasticDependencyAudit({...entry,entities,outputs,expectedRecipes},raw),
    surface, surfaceProperties, blueprintSha256:actualSha, prototypeDumpSha256,
    maxRelativeSpread:entry.maxRelativeSpread ?? defaults.maxRelativeSpread ?? 0.25,
    rateToleranceFraction:entry.rateToleranceFraction ?? defaults.rateToleranceFraction ?? 0.10,
    minimumObservedCount:entry.minimumObservedCount ?? (entry.stochastic ? 100 : 2)};
  if (!Number.isFinite(config.maxRelativeSpread) || config.maxRelativeSpread < 0 || config.maxRelativeSpread > 1) reject('invalid-stability-tolerance');
  if (!Number.isFinite(config.rateToleranceFraction) || config.rateToleranceFraction < 0 || config.rateToleranceFraction > 0.25) reject('invalid-rate-tolerance');
  if (!Number.isInteger(config.minimumObservedCount) || config.minimumObservedCount<2) reject('invalid-minimum-observations');
  return {...config, specSha256:configurationHash(entry), configurationSha256:configurationHash(config), code:code.trim(), entities,
    entityTypes:Object.fromEntries([...index.entities].filter(([name]) => entities.some(e => e.name === name)).map(([name,p]) => [name,p.type])),
    unsupported:[...new Set(unsupported)]};
}

// Rates always come from collected physical output; plans supply thresholds only.
export function evaluateNative(spec, native, evaluation = {}) {
  const failures = [];
  for (const field of ['blueprintSha256','prototypeDumpSha256','configurationSha256','specSha256']) if (native[field] !== spec[field]) failures.push(`native-${field}-mismatch`);
  if (native.completedTick !== spec.warmupTicks + spec.measurementTicks) failures.push('incomplete-simulation');
  if (native.importedEntities !== spec.entities.length) failures.push('native-import-count-mismatch');
  for (const rejection of Object.values(native.rejections || {})) failures.push(rejection);
  const output = {};
  let functional = true, steady = true;
  for (const p of spec.outputs) {
    const key = materialKey(p), row = native.outputs?.[key] || {};
    const counts = row.windowCounts || [];
    const minutes = spec.measurementTicks / 3600, windowMinutes = minutes / spec.windows;
    const valid = counts.length === spec.windows && counts.every(n => Number.isFinite(n) && n >= 0);
    const collected = valid ? counts.reduce((a,b) => a + b, 0) : 0;
    const perMinute = collected / minutes;
    const windowPerMinute = counts.map(n => n / windowMinutes);
    const quantization = p.type === 'item' ? 1 / windowMinutes : 0.01;
    const spread = valid ? Math.max(...windowPerMinute) - Math.min(...windowPerMinute) : Infinity;
    const audit=evaluation.stochasticDependencyAudit || spec.stochasticDependencyAudit;
    const stochastic=spec.stochastic===true && audit?.declaredStochastic===true && audit.eligibleOutputKeys.includes(key) && p.type!=='fluid';
    const stabilityTest=stochastic?stochasticWindowTest(counts,{minimumObservedCount:spec.minimumObservedCount}):null;
    const stable = stochastic?stabilityTest.accepted:valid && counts.every(n => n > 0) && spread <= Math.max(perMinute * spec.maxRelativeSpread, 2 * quantization);
    const target = p.minPerMinute ?? null;
    const rateMet = target === null || (valid && windowPerMinute.every(n => n + quantization >= target * (1-spec.rateToleranceFraction)));
    const crafted = Number(row.measuredProduced || 0);
    const nativeProduction = row.windowProduced || [];
    const nativeCrafts=row.windowProducerCrafts || [];
    const producerIdsMatch=canonicalJSON(row.producerEntityIds || [])===canonicalJSON(spec.outputProducerEntityIds?.[key] || []) && (row.producerEntityIds || []).length>0;
    const canUseCraftCounter=spec.statisticsIgnoredOutputs?.[key]===true && row.productionStatisticsIgnored===true && !spec.unsafeCraftCounterOutputs?.[key];
    const craftEvidence=canUseCraftCounter && producerIdsMatch && nativeCrafts.length===spec.windows && nativeCrafts.every(n=>Number.isFinite(n) && n>0);
    const statsEvidence = nativeProduction.length === spec.windows && nativeProduction.every(n => Number.isFinite(n) && n > 0);
    const producedEveryWindow = statsEvidence || craftEvidence;
    const required = p.role !== 'surplus';
    const passedFunctional = row.collectionEvents >= 2 && row.firstOutputTick > 0 && row.firstOutputTick <= spec.warmupTicks + spec.measurementTicks && (crafted > 0 || (canUseCraftCounter && producerIdsMatch && row.measuredProducerCrafts>0)) && collected > 0;
    if (required && !passedFunctional) functional = false;
    const minimumObservedCount=stochastic?Math.max(100,spec.minimumObservedCount):spec.minimumObservedCount;
    const sufficient = collected >= minimumObservedCount;
    if (required && (!stable || !rateMet || !producedEveryWindow || !sufficient)) steady = false;
    output[key] = {...row, collected, perMinute, windowPerMinute, targetPerMinute:target, required,productionEvidenceBasis:statsEvidence?'native-production-statistics':craftEvidence?'native-completed-crafts-of-matching-recipe-product':'insufficient',minimumObservedCount,sufficientObservations:sufficient,stable:stable && producedEveryWindow, rateMet, functional:passedFunctional,
      stabilityMethod:stochastic?'conditional-poisson':'relative-spread-with-count-quantization',
      ...(stochastic?{stabilityTest,rateConfidenceInterval:valid && Number.isSafeInteger(collected)?poissonRateInterval(collected,minutes):null}: {})};
    if (required && !passedFunctional) failures.push(`no-repeat-native-production:${key}`);
    if (required && (!stable || !producedEveryWindow)) failures.push(`not-steady:${key}`);
    if (required && !rateMet) failures.push(`below-declared-rate:${key}`);
    if (required && !sufficient) failures.push(`insufficient-observations:${key}`);
  }
  const functionalFailures=failures.filter(f=>!['not-steady:','below-declared-rate:','insufficient-observations:'].some(prefix=>f.startsWith(prefix)));
  return {passed:failures.length === 0, status:failures.length ? 'failed' : 'passed', functionalPassed:functional && functionalFailures.length===0, throughputPassed:steady && functional && failures.length===0,
    failures, outputs:output, rateBasis:'Physical items/fluids removed only at declared output ports after warmup, less any startup stock. Per-window native statistics or completed crafts of exact recipe-product machines prove production; no theoretical rate is reported as measured.'};
}
