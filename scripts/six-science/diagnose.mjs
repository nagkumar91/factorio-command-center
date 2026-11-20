// Summarize a native report: pack rates, crafts per recipe against need,
// machine statuses, ring stock, entrance acceptance. Usage: node diagnose.mjs [report.json]
import fs from 'node:fs';
const file = process.argv[2] || '.cache/six-science/explore-report.json';
const report = JSON.parse(fs.readFileSync(file));
const [m] = JSON.parse(fs.readFileSync('blueprint-sources/six-science/manifest.json'));
const r = report.builds[0], minutes = report.protocol.measureMinutes;
console.log('protocol', JSON.stringify(report.protocol), 'wall', report.wallSeconds, 's');
console.log('checks', JSON.stringify(r.checks));
console.log('steady', JSON.stringify(r.outputsPerMinute));
if (r.recovery) console.log('recovery', JSON.stringify(r.recovery.outputsPerMinute), 'pause stock', JSON.stringify(r.recovery.collectionPauseStock?.map(p => p.item.split('-')[0] + ':' + p.count + '/' + p.maxDuringBlocked)));
const byRecipe = {};
for (const x of r.machines) {
  const b = byRecipe[x.recipe] ??= {n: 0, crafts: 0, idle: 0, statuses: {}};
  b.n++; b.crafts += x.measuredCrafts; if (!x.measuredCrafts) b.idle++;
  for (const [s, c] of Object.entries(x.statusSamples || {})) b.statuses[s] = (b.statuses[s] || 0) + c;
}
console.log('\nrecipe                     n  crafts/min  need/min  idle  statuses');
for (const [recipe, b] of Object.entries(byRecipe).sort()) {
  const total = Object.values(b.statuses).reduce((a, c) => a + c, 0) || 1;
  const st = Object.entries(b.statuses).sort((a, c) => c[1] - a[1]).map(([s, c]) => s + ' ' + Math.round(100 * c / total) + '%').join(', ');
  console.log(recipe.padEnd(26), String(b.n).padStart(2), (b.crafts / minutes).toFixed(1).padStart(10), String(m.recipeAudit.craftsPerMinute[recipe]).padStart(9), String(b.idle).padStart(5), ' ', st);
}
console.log('\nrings (max / limit sum / capacity) and last signals');
for (const [name, s] of Object.entries(r.loopSamplesFinal || r.loopSamples)) console.log(name.padEnd(22), s.maxStock, '/', s.limitSum, '/', s.capacity, ' ', (s.lastSignals || []).map(x => x.signal.name.replace(/-science-pack|-plate/, '') + ':' + x.count).join(' '));
console.log('\nentrances (accepted/min vs nominal)');
for (const p of r.inputs) console.log(p.item.padEnd(20), p.acceptedPerMinute?.toFixed(1).padStart(8), String(m.recipeAudit.externalPerMinute[p.item]).padStart(8), p.productiveRoute ? 'route ok' : 'NO ROUTE');
for (const p of r.fluids) console.log(p.item.padEnd(20), (p.acceptedDuringMeasurement / minutes).toFixed(1).padStart(8), String(m.recipeAudit.externalPerMinute[p.item]).padStart(8), 'consumers', p.productiveConsumers.length);
if (process.argv.includes('--machines')) for (const x of r.machines.sort((a, b) => a.recipe.localeCompare(b.recipe) || a.x - b.x)) console.log(x.recipe, x.x, x.y, x.measuredCrafts, x.status, JSON.stringify(x.inventory), JSON.stringify(x.statusSamples));
