import fs from 'node:fs/promises';
/** A manifest entry is native-qualified only while the report beside it holds a
 * passing run for the same id and the exact generated blueprint SHA-256. A
 * regenerated string that the report has not seen goes back to pending. */
export async function qualifiedStatus(dir, manifest) {
  let report;
  try { report = JSON.parse(await fs.readFile(dir + '/native-report.json', 'utf8')); } catch { report = null; }
  const run = report?.builds?.find(b => b.id === manifest.id && b.blueprintSha256 === manifest.blueprintSha256);
  return run?.passed === true ? 'native-qualified' : 'candidate-native-validation-pending';
}
