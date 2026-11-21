// Run the full Luna native protocol for the generated strings and keep each passing report.
// FACTORIO_RAW=<official 2.1.24 Space Age data-raw-dump.json> node scripts/recovered-workshops/qualify.mjs [id,...]
// Private config, mods, saves and logs stay under .cache/<id>/; only <id>-native.json is written to the source folder.
import fs from 'node:fs/promises';
import path from 'node:path';
import {designs, SOURCE} from './generate.mjs';
import {runLunaNative, FULL, project} from './luna-native.mjs';

const want = process.argv[2]?.split(',');
let failed = 0;
for (const d of designs().filter(d => !want || want.includes(d.id))) {
  const {report} = await runLunaNative({cacheId: d.id, spec: structuredClone(d.spec), code: d.code, timing: FULL, quiet: true});
  const rates = Object.fromEntries(Object.entries(report.outputs || {}).map(([k, v]) => [k, v.windowPerMinute]));
  console.log(d.id, report.blueprintSha256, report.passed ? 'passed' : 'FAILED', JSON.stringify(rates), JSON.stringify(report.failures || []));
  if (report.blueprintSha256 !== d.blueprintSha256) throw Error('Report SHA-256 differs from the generated string: ' + d.id);
  if (report.passed) await fs.writeFile(path.join(project, SOURCE, d.id + '-native.json'), JSON.stringify(report, null, 2) + '\n');
  else failed++;
}
process.exitCode = failed ? 1 : 0;
