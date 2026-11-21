// Runs the full native protocol for the three published imports and writes the
// combined native-report.json. The factory and the connected-lab imports run
// as two separate games (validate.mjs), exactly as the first qualification did:
// the lab run adds the research-probe technologies, the factory run does not.
// A build is marked native-qualified only when its exact SHA-256 passed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run = promisify(execFile), source = 'blueprint-sources/rgby-science';
const manifest = JSON.parse(await fs.readFile(source + '/manifest.json'));
const work = path.resolve('.cache/rgby-science/qualify-' + Date.now());
const groups = [{id: 'factory-output', builds: manifest.filter(m => !m.researchProbe).map(m => m.id)}, {id: 'connected-labs', builds: manifest.filter(m => m.researchProbe).map(m => m.id)}].filter(g => g.builds.length);
async function group(g) {
  const dir = path.join(work, g.id); await fs.mkdir(dir, {recursive: true});
  await fs.writeFile(dir + '/manifest.json', JSON.stringify(manifest));
  for (const m of manifest) await fs.copyFile(source + '/' + m.file, dir + '/' + m.file);
  // validate.mjs exits 1 when a build fails; the report it wrote is still read below.
  const game = path.join(work, g.id + '-game');
  await run(process.execPath, ['scripts/rgby-science/validate.mjs'], {env: {...process.env, RGBY_SOURCE: dir, RGBY_IDS: g.builds.join(','), RGBY_GAME_ROOT: game, RGBY_TIMEOUT_MS: process.env.RGBY_TIMEOUT_MS || '1800000'}, maxBuffer: 64e6}).catch(e => { if (e.code !== 1) throw e; });
  return JSON.parse(await fs.readFile(dir + '/native-report.json'));
}
const reports = await Promise.all(groups.map(group));
const report = {schemaVersion: 1, gameVersion: reports[0].gameVersion, prototypeSha256: reports[0].prototypeSha256, passed: reports.every(r => r.passed), runs: [], builds: []};
for (const [i, r] of reports.entries()) {
  const {builds, passed, ...meta} = r;
  report.runs.push({...meta, id: groups[i].id, builds: builds.map(b => b.id)});
  for (const b of builds) report.builds.push({...b, evidenceRun: groups[i].id});
}
report.builds.sort((a, b) => manifest.findIndex(m => m.id === a.id) - manifest.findIndex(m => m.id === b.id));
await fs.writeFile(source + '/native-report.json', JSON.stringify(report, null, 2) + '\n');
for (const m of manifest) m.status = report.builds.some(b => b.id === m.id && b.blueprintSha256 === m.blueprintSha256 && b.passed === true) ? 'native-qualified' : 'candidate-native-validation-pending';
await fs.writeFile(source + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
for (const b of report.builds) console.log(b.id, b.blueprintSha256, b.passed ? 'passed' : 'FAILED', JSON.stringify(b.researchProbe ? {unitsPerMinute: b.researchProbe.unitsPerMinute} : {rates: b.outputsPerMinute, recovery: b.recovery?.outputsPerMinute}));
await fs.rm(work, {recursive: true, force: true});
process.exitCode = report.passed ? 0 : 1;
