// Run from the project root. Only this advanced snapshot is regenerated.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {makeAdvanced} from '../../../../../scripts/rgby-science/components.mjs';
import {snapshot} from '../../../../../scripts/rgby-science/snapshot.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const folder=fileURLToPath(new URL('.',import.meta.url));
process.env.RGBY_SOURCE=folder;process.env.RGBY_IDS='advanced';
process.env.FACTORIO_RAW??='/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json';
const raw=JSON.parse(await fs.readFile(process.env.FACTORIO_RAW));
raw.container={...raw.container,...raw['logistic-container']};
await snapshot(raw,makeAdvanced(raw),folder,{'advanced-circuit':75});
const original=await fs.readFile('scripts/rgby-science/validate.mjs','utf8');
let effective=original.replace("from'../blueprints.mjs'",'from'+JSON.stringify(pathToFileURL(path.resolve('scripts/blueprints.mjs')).href));
// Factorio rejects data:extend({}); standalone advanced has no research probe.
// Guard only the generated private data-stage fixture, leaving parent files intact.
const needle="'data:extend('+luaLiteral(probeTechnologies)+')\\n'";
const guard="probeTechnologies.length?'data:extend('+luaLiteral(probeTechnologies)+')\\n':'-- No research-probe prototypes\\n'";
const guarded=effective.includes(needle);effective=effective.replace(needle,guard);
await import('data:text/javascript;base64,'+Buffer.from(effective).toString('base64'));
const report=JSON.parse(await fs.readFile(folder+'/native-report.json'));
report.standaloneExecution={sourceValidatorSha256:sha(original),effectiveValidatorSha256:sha(effective),emptyPrototypeGuard:guarded,qualificationScriptSha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),scope:'advanced only; parent generator, validator and control unchanged'};
await fs.writeFile(folder+'/native-report.json',JSON.stringify(report,null,2)+'\n');
