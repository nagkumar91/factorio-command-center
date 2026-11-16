import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { decodeBlueprint } from './blueprints.mjs';

const root = process.cwd();
const base = 'experiments/blueprint-evolution/autosaved-derivatives';
const ledger = JSON.parse(await fs.readFile(path.join(base, 'validation-ledger.json'), 'utf8'));
const inventory = JSON.parse(await fs.readFile(path.join(base, 'inventory.json'), 'utf8'));
const interfaceRevisions = JSON.parse(await fs.readFile(path.join(base, 'interface-revision-queue.json'), 'utf8'));
const byId = new Map(inventory.entries.map(entry => [entry.sourceId, entry]));
const revisionsById = new Map(interfaceRevisions.revisions.map(entry => [entry.sourceId, entry]));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const previewSvg = (code, label) => {
  const decoded = decodeBlueprint(code)?.blueprint || decodeBlueprint(code);
  const entities = decoded.entities || [];
  const size = name => /roboport/.test(name) ? [4, 4]
    : /assembling-machine|electric-furnace|chemical-plant|oil-refinery/.test(name) ? [3, 3]
      : /storage-tank/.test(name) ? [3, 3] : [1, 1];
  const points = entities.map(entity => {
    let [width, height] = size(entity.name);
    if ([4, 12].includes(entity.direction || 0)) [width, height] = [height, width];
    return { ...entity, width, height, left: entity.position.x - width / 2, top: entity.position.y - height / 2 };
  });
  const minX = Math.min(...points.map(point => point.left)) - 1;
  const minY = Math.min(...points.map(point => point.top)) - 1;
  const width = Math.max(...points.map(point => point.left + point.width)) - minX + 1;
  const height = Math.max(...points.map(point => point.top + point.height)) - minY + 1;
  const shapes = points.map(point => {
    const name = point.name || '';
    const color = /assembling-machine|electric-furnace|chemical-plant|oil-refinery/.test(name) ? '#c88e35'
      : /belt/.test(name) ? '#62777b' : /inserter/.test(name) ? '#d89c37'
        : /electric-pole|substation/.test(name) ? '#75b6c2' : /chest/.test(name) ? '#7b9c70' : '#52605e';
    if (/electric-pole|substation/.test(name)) return `<circle cx="${point.position.x}" cy="${point.position.y}" r=".35" fill="${color}" stroke="#d1e0d7" stroke-width=".08"><title>${name}</title></circle>`;
    return `<g><title>${name}${point.recipe ? ` · ${point.recipe}` : ''}</title><rect x="${point.left}" y="${point.top}" width="${point.width}" height="${point.height}" rx=".12" fill="${color}" fill-opacity=".82" stroke="#d5ccb1" stroke-opacity=".42" stroke-width=".08"/></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="Schematic blueprint layout preview: ${label}"><title>${label} layout · ${entities.length} entities</title><rect x="${minX}" y="${minY}" width="${width}" height="${height}" rx=".4" fill="#171c1e"/><path d="M${minX} ${minY}h${width}M${minX} ${minY + height}h${width}M${minX} ${minY}v${height}M${minX + width} ${minY}v${height}" stroke="#384448" stroke-width=".08"/>${shapes}</svg>`;
};
const destination = path.join(root, 'site/autosaved-derivatives');
const blueprintDir = path.join(destination, 'blueprints');
const previewDir = path.join(destination, 'previews');
const evidenceDir = path.join(destination, 'evidence');
await fs.rm(blueprintDir, { recursive: true, force: true });
await fs.rm(previewDir, { recursive: true, force: true });
await fs.rm(evidenceDir, { recursive: true, force: true });
await fs.mkdir(blueprintDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(evidenceDir, { recursive: true });

const entries = [];
const copiedEvidence = new Set();
for (const validation of ledger.entries) {
  const record = byId.get(validation.sourceId);
  if (!record || record.sourceBlueprintSha256 !== validation.sourceBlueprintSha256) throw new Error(`Inventory source mismatch: ${validation.sourceId}`);
  const candidatePath = path.resolve(validation.candidateFile);
  const candidate = (await fs.readFile(candidatePath, 'utf8')).trim();
  if (hash(candidate) !== validation.candidateBlueprintSha256) throw new Error(`Candidate hash mismatch: ${validation.sourceId}`);
  const candidateBlueprint = decodeBlueprint(candidate)?.blueprint || decodeBlueprint(candidate);
  for (const port of validation.ports || []) {
    if (port.role !== 'output') continue;
    const entity = candidateBlueprint.entities?.find(item => item.entity_number === port.entity);
    const chestPort = /chest/.test(port.prototype || '') || /chest/.test(entity?.name || '');
    if (chestPort && (port.prototype !== 'passive-provider-chest' || entity?.name !== 'passive-provider-chest')) {
      throw new Error(`Output chest must be a passive-provider-chest: ${validation.sourceId} port ${port.entity}`);
    }
  }
  let candidateCase;
  let evidenceFile;
  let evidenceLinks = [];
  if (validation.validation.nativeReport) {
    const reportPath = path.resolve(validation.validation.nativeReport);
    const evidence = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    if (validation.validation.nativeReportFormat === 'candidate-only-v1') {
      candidateCase = evidence.cases.find(test => test.sourceId === validation.sourceId && test.variant === 'candidate');
      if (evidence.sourceBlueprintSha256 !== validation.sourceBlueprintSha256
        || candidateCase?.blueprintHash !== validation.candidateBlueprintSha256) {
        throw new Error(`Candidate-only native hash mismatch: ${validation.sourceId}`);
      }
      evidenceFile = validation.validation.nativeReportFile || `evidence/${validation.sourceId}-native-candidate.json`;
      if (!copiedEvidence.has(evidenceFile)) {
        await fs.mkdir(path.dirname(path.join(destination, evidenceFile)), { recursive: true });
        await fs.copyFile(reportPath, path.join(destination, evidenceFile));
        copiedEvidence.add(evidenceFile);
      }
      evidenceLinks.push({ label: 'Exact-hash native candidate production report (source comparison unavailable)', file: evidenceFile });
    } else if (validation.validation.nativeReportFormat === 'edge-ports-v2') {
      candidateCase = evidence.cases.find(test => test.sourceId === validation.sourceId && test.variant === validation.validation.candidateVariant);
      if (candidateCase?.candidateHash !== validation.candidateBlueprintSha256) throw new Error(`Native candidate hash mismatch: ${validation.sourceId}`);
      evidenceFile = 'evidence/core-edge-ports-v2/native-compatibility.v2.json';
      const recordFile = `evidence/core-edge-ports-v2/${path.basename(validation.validation.routeRecord)}`;
      for (const [relativeFile, absoluteFile] of [[evidenceFile, reportPath], [recordFile, path.resolve(validation.validation.routeRecord)]]) {
        if (!copiedEvidence.has(relativeFile)) {
          await fs.mkdir(path.dirname(path.join(destination, relativeFile)), { recursive: true });
          await fs.copyFile(absoluteFile, path.join(destination, relativeFile));
          copiedEvidence.add(relativeFile);
        }
      }
      evidenceLinks.push({ label: 'Physical ports, lane routes, and power proof', file: recordFile });
    } else {
      const sourceCase = evidence.cases.find(test => test.sourceId === validation.sourceId && test.variant === 'source');
      candidateCase = evidence.cases.find(test => test.sourceId === validation.sourceId && test.variant === 'candidate');
      if (sourceCase?.blueprintHash !== validation.sourceBlueprintSha256 || candidateCase?.blueprintHash !== validation.candidateBlueprintSha256) throw new Error(`Native hash mismatch: ${validation.sourceId}`);
      evidenceFile = validation.validation.nativeReportFile || 'evidence/native-paired.v1.json';
      if (!copiedEvidence.has(evidenceFile)) {
        await fs.mkdir(path.dirname(path.join(destination, evidenceFile)), { recursive: true });
        await fs.copyFile(reportPath, path.join(destination, evidenceFile));
        copiedEvidence.add(evidenceFile);
      }
      if (validation.validation.nativeReportFile) {
        evidenceLinks.push({ label: 'Exact-hash native source and candidate production report', file: evidenceFile });
      }
    }
  } else {
    const sourcePath = path.resolve(validation.validation.nativeSourceReport);
    const candidateReportPath = path.resolve(validation.validation.nativeCandidateReport);
    const sourceReport = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
    const candidateReport = JSON.parse(await fs.readFile(candidateReportPath, 'utf8'));
    const sourceCase = sourceReport.builds.find(test => test.sha256 === validation.sourceBlueprintSha256);
    candidateCase = candidateReport.builds.find(test => test.sha256 === validation.candidateBlueprintSha256);
    if (!sourceCase || !candidateCase || sourceCase.perMinute !== candidateCase.perMinute
      || sourceReport.game !== validation.validation.runtimeVersion || candidateReport.game !== validation.validation.runtimeVersion
      || sourceReport.measuredMinutes !== validation.validation.measuredMinutes || candidateReport.measuredMinutes !== validation.validation.measuredMinutes) {
      throw new Error(`Split native reports do not match: ${validation.sourceId}`);
    }
    const evidenceDirectory = 'evidence/green-circuit-twelve';
    const sourceReportFile = `${evidenceDirectory}/${path.basename(sourcePath)}`;
    const candidateReportFile = `${evidenceDirectory}/${path.basename(candidateReportPath)}`;
    const evidenceSpecs = [
      [sourceReportFile, sourcePath, 'Source native run'],
      [candidateReportFile, candidateReportPath, 'Candidate native run'],
      [`${evidenceDirectory}/family-validation.json`, path.resolve(validation.validation.familyValidation), 'Family hash and rate checks'],
      [`${evidenceDirectory}/${path.basename(validation.validation.routePowerEvidence)}`, path.resolve(validation.validation.routePowerEvidence), 'Route and power evidence'],
      [`${evidenceDirectory}/${path.basename(validation.validation.laneGraphEvidence)}`, path.resolve(validation.validation.laneGraphEvidence), 'Belt lane graph'],
    ];
    for (const [relativeFile, absoluteFile, label] of evidenceSpecs) {
      if (!copiedEvidence.has(relativeFile)) {
        await fs.mkdir(path.dirname(path.join(destination, relativeFile)), { recursive: true });
        await fs.copyFile(absoluteFile, path.join(destination, relativeFile));
        copiedEvidence.add(relativeFile);
      }
      evidenceLinks.push({ label, file: relativeFile });
    }
    evidenceFile = `${evidenceDirectory}/family-validation.json`;
  }
  const svgPath = path.join(previewDir, `${validation.sourceId}.svg`);
  const sourceMatchedComparison = validation.validation.sourceMatchedComparison ?? !validation.validation.sourceFixtureNote;
  await fs.copyFile(candidatePath, path.join(blueprintDir, `${validation.sourceId}.txt`));
  let renderedPreview = null;
  if (candidatePath.endsWith('.blueprint.txt')) {
    const candidatePreviewPath = candidatePath.slice(0, -'.blueprint.txt'.length) + '.svg';
    try {
      const candidatePreview = await fs.readFile(candidatePreviewPath, 'utf8');
      if (/^\s*<svg\b/.test(candidatePreview)) renderedPreview = candidatePreview;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (renderedPreview) {
    await fs.writeFile(svgPath, renderedPreview);
  } else {
    await fs.writeFile(svgPath, previewSvg(candidate, record.name));
  }
  entries.push({
    id: validation.sourceId,
    name: record.name,
    category: record.category,
    section: record.section,
    attribution: 'Autosaved Factorio blueprints',
    sourceUrl: record.sourceUrl,
    sourceBlueprintSha256: validation.sourceBlueprintSha256,
    candidateBlueprintSha256: validation.candidateBlueprintSha256,
    blueprintCode: candidate,
    status: validation.status,
    inputs: record.inputs,
    outputs: record.outputs,
    sourceModuleRequests: record.moduleRequests,
    candidateModules: 0,
    inputDisplayRevisionRequired: revisionsById.has(validation.sourceId),
    missingInputDisplays: revisionsById.get(validation.sourceId)?.missingInputDisplays || [],
    sourceAreaTiles: validation.footprint.sourceAreaTiles,
    candidateAreaTiles: validation.footprint.candidateAreaTiles,
    areaDeltaTiles: validation.footprint.deltaTiles,
    runtimeVersion: validation.validation.runtimeVersion,
    catalogueTarget: validation.validation.catalogueTarget,
    catalogueTargetStatus: validation.validation.catalogueTargetStatus,
    warmupMinutes: validation.validation.warmupMinutes,
    measuredMinutes: validation.validation.measuredMinutes,
    sourceFixtureNote: validation.validation.sourceFixtureNote || null,
    ports: validation.ports || [],
    evidenceLinks,
    products: validation.products.map(product => {
      const output = candidateCase.outputs?.find(item => item.material === product.item);
      const measuredCandidateRate = validation.validation.nativeReportFormat === 'edge-ports-v2'
        ? candidateCase.measuredGearsPerSecond * 60 : candidateCase.perMinute;
      return {
        ...product,
        sourceToCandidateRateRatio: sourceMatchedComparison ? product.sourceToCandidateRateRatio : null,
        candidateItemsPerMinute: output ? output.observedItemsPerSecond * 60 : product.candidateItemsPerMinute || measuredCandidateRate || 0,
      };
    }),
    sourceMatchedComparison,
    blueprintFile: `blueprints/${validation.sourceId}.txt`,
    previewFile: `previews/${validation.sourceId}.svg`,
    evidenceFile,
  });
}
const inputLabelCompliantCount = entries.filter(entry => !entry.inputDisplayRevisionRequired).length;
const data = {
  schemaVersion: 1,
  recipeBearingSourceCount: inventory.recipeBearingEntryCount,
  integratedValidatedCount: inputLabelCompliantCount,
  nativeValidatedCount: entries.length,
  inputDisplayRevisionCount: revisionsById.size,
  entries,
};
const safeJson = JSON.stringify(data).replaceAll('<', '\\u003c');
await fs.writeFile(path.join(destination, 'data.js'), `globalThis.AutosavedDerivatives = ${safeJson};\n`);
console.log(`Indexed ${entries.length} native-validated module-free derivatives from ${inventory.recipeBearingEntryCount} recipe-bearing sources.`);
