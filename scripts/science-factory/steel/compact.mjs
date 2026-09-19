import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decodeBlueprint, encodeBlueprint, blueprintMaterials } from '../../../scripts/blueprints.mjs';
import { compactStarterLayout, auditConnections, starterBounds } from '../compact-shared-layout.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../../..');
const defaultRoot = path.join(repo, '.cache/science-factory/reproduce-steel');
const resolveRepoPath = value => path.isAbsolute(value) ? value : path.resolve(repo, value);
const raw = JSON.parse(await fs.readFile(process.env.FACTORIO_RAW || path.join(repo, '.cache/factorio-vanilla/script-output/data-raw-dump.json')));
const catalog = JSON.parse(await fs.readFile(path.join(repo, 'site/data/catalog.json')));
const source = resolveRepoPath(process.argv[2] || path.join(defaultRoot, 'generated/blueprint-sources/science-factories'));
const out = resolveRepoPath(process.argv[3] || path.join(defaultRoot, 'compacted'));
const info = JSON.parse(await fs.readFile(path.join(source, 'manifest.json')))[0];
const sourceCode = (await fs.readFile(path.join(source, info.file), 'utf8')).trim();
const blueprint = decodeBlueprint(sourceCode).blueprint;
const ports = info.ports || info.connectionPorts;
if (!Array.isArray(ports) || ports.length < 11) throw new Error('steel manifest must contain six inputs, four outputs, and power');

const beforeAudit = auditConnections(blueprint, raw);
const beforeBounds = starterBounds(blueprint.entities, raw);
const compaction = compactStarterLayout(blueprint, ports, raw);
const afterAudit = auditConnections(blueprint, raw);
const afterBounds = starterBounds(blueprint.entities, raw);
const materials = blueprintMaterials({ blueprint }, catalog);
const code = encodeBlueprint({ blueprint }) + '\n';
const blueprintSha256 = createHash('sha256').update(code.trim()).digest('hex');

info.ports = ports;
info.connectionPorts = ports;
info.blueprintSha256 = blueprintSha256;
info.entityCount = materials.entityCount;
info.entries = materials.entries;
info.excluded = materials.excluded;
info.footprint = { width: afterBounds.width, height: afterBounds.height };
info.layoutOptions = {
  ...(info.layoutOptions || {}),
  compaction: 'root-compact-shared-layout',
  compactionResult: compaction,
  beforeBounds,
  afterBounds,
  beforeAudit,
  afterAudit,
  internalSolidFuel: true,
  steelFurnaces: true
};

await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, info.file), code);
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify([info], null, 2) + '\n');
await fs.writeFile(path.join(out, 'compaction.json'), JSON.stringify({
  id: info.id, source, sourceSha256: createHash('sha256').update(sourceCode).digest('hex'),
  blueprintSha256, beforeBounds, afterBounds, beforeAudit, afterAudit, compaction,
  entityCount: materials.entityCount, machineCount: info.machineCount, ports
}, null, 2) + '\n');
console.log(JSON.stringify({ out, id: info.id, blueprintSha256, entityCount: materials.entityCount, beforeBounds, afterBounds, beforeAudit, afterAudit, compaction }, null, 2));
