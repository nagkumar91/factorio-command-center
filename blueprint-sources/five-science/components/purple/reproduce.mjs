// Run from the repository root with FACTORIO_RAW set to the installed raw dump.
import fs from 'node:fs/promises';
import {makePurple} from '../../../../scripts/five-science/purple.mjs';
import {snapshot} from '../../../../scripts/rgby-science/snapshot.mjs';
if (!process.env.FACTORIO_RAW) throw Error('Set FACTORIO_RAW to the installed data-raw-dump.json');
const source = 'blueprint-sources/five-science/components/purple';
const raw = JSON.parse(await fs.readFile(process.env.FACTORIO_RAW));
const component = makePurple(raw);
if (component.entities.some(e => /^(express|turbo)-/.test(e.name))) throw Error('Only red belts allowed');
if (component.entities.some(e => e.items?.length)) throw Error('Installed modules forbidden');
await snapshot(raw, component, source, {'production-science-pack': 30});
if (!process.argv.includes('--generate-only')) {
  process.env.RGBY_SOURCE = source;
  // Relocate only private run storage. Keep the shared validator and Lua intact.
  let validator = await fs.readFile('scripts/rgby-science/validate.mjs', 'utf8');
  const root = "'.cache/rgby-science/native-'";
  if (!validator.includes(root)) throw Error('Validator run-root format changed');
  validator = validator.replace(root, "'.cache/five-science/purple/native-'")
    .replace("'../blueprints.mjs'", JSON.stringify(new URL('../../../../scripts/blueprints.mjs', import.meta.url).href));
  await import('data:text/javascript;base64,' + Buffer.from(validator).toString('base64'));
  const report = JSON.parse(await fs.readFile(source + '/native-report.json'));
  const build = report.builds[0];
  if (!report.passed || build.outputsPerMinute['production-science-pack'] < 30 ||
      build.recovery.outputsPerMinute['production-science-pack'] < 30)
    throw Error('Purple requires strict >=30/min in both steady and recovery windows');
}
