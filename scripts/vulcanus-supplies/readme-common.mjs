// Table and text helpers shared by the two README generators. Every number printed here comes from the manifest or the native report.
import { ascii } from './lib.mjs';
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
export const f0 = v => Math.round(v).toLocaleString('en-US');
const tile = t => `(${t.x},${t.y})`;
export const LEGEND = '`R` oil refinery, `H` heavy-oil cracker, `L` light-oil cracker, `P` plastic plant, `U` lubricant plant, `C` carbon plant, `A` assembling machine 3, `#` substation, `D` display panel, `=` pipe, `^ > v <` pipe-to-ground (the arrow is the side of its open pipe connection; its underground runs the other way), `n e s w` red belt (the way it runs), `u`/`o` underground belt in/out, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0.';
export const asciiBlock = d => '```\n' + ('   x ' + [...Array(d.footprint.width).keys()].map(i => i % 10).join('') + '\n') + ascii(d.blueprint.blueprint.entities).map((r, y) => ` y${String(y).padEnd(2)} ${r}`).join('\n') + '\n```';
export function inputsTable(d, report) {
  const th = report?.measured.phases.throttled.steady.inputsPerMinute, gen = report?.measured.phases.generous?.steady.inputsPerMinute;
  const rows = d.manifest.inputPorts.map(x => `| ${x.id} | ${x.item} | ${x.kind === 'belt' ? 'belt' : 'pipe'} | ${x.side} | ${tile(x.tile)} | \`${x.label}\` | ${f0(x.perMinute)}/min | ${th ? f1(th[x.item]) + '/min' : '-'} | ${gen ? f1(gen[x.item]) + '/min' : '-'} |`);
  return ['| Port | Material | Kind | Side | Tile | Panel text | Panel figure | Draw, throttled run | Draw, generous run |', '| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |', ...rows].join('\n');
}
export function outputsTable(d, report) {
  const th = report?.measured.phases.throttled.steady.outputsPerMinute, gen = report?.measured.phases.generous?.steady.outputsPerMinute;
  const rows = d.manifest.outputPorts.map(x => `| ${x.id} | ${x.item} | ${x.kind === 'belt' ? 'belt' : 'pipe'} | ${x.side} | ${tile(x.tile)} | \`${x.label}\` | ${f0(x.perMinute)}/min | ${th ? f1(th[x.item]) + '/min' : '-'} | ${gen ? f1(gen[x.item]) + '/min' : '-'} |`);
  return ['| Port | Product | Kind | Side | Tile | Panel text | Target | Measured, throttled run | Measured, generous run |', '| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |', ...rows].join('\n');
}
// One row per phase: what every exit gave and every entrance took per minute over the measured window, mixing seconds, recovery.
export function phasesTable(d, report, mode) {
  const outs = d.manifest.outputPorts, ins = d.manifest.inputPorts;
  const run = report.runs[mode];
  const head = ['| Phase (minutes) | Measured | ' + outs.map(o => o.item).join(' | ') + ' | ' + ins.map(i => i.item + ' in').join(' | ') + ' | Back to 95% | Foreign fluid seconds |', '| --- | ---: | ' + [...outs, ...ins].map(() => '---:').join(' | ') + ' | ---: | ---: |'];
  const rows = run.phases.map(ph => {
    const rec = ph.recovery ? Object.values(ph.recovery).map(r => r.secondsToReach === undefined ? 'never' : r.secondsToReach + ' s').join(' / ') : '';
    return `| ${ph.name} (${ph.minutes}) | last ${ph.measuredMinutes} | ${outs.map(o => f1(ph.drawnPerMinute[o.id]?.measured ?? 0)).join(' | ')} | ${ins.map(i => f1(ph.fedPerMinute[i.id]?.measured ?? 0)).join(' | ')} | ${rec} | ${ph.mixedSeconds} |`;
  });
  return [...head, ...rows].join('\n');
}
export function machinesTable(report, mode, phaseName) {
  const ph = report.runs[mode].phases.find(p => p.name === phaseName);
  const total = Object.values(ph.machines[0].statusSamples).reduce((a, b) => a + b, 0);
  const rows = ph.machines.map(m => `| ${m.role} | #${m.entity} | ${m.recipe} | ${f1(m.productsPerMinute)} | ${Object.entries(m.statusSamples).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replaceAll('_', ' ')} ${Math.round(100 * v / total)}%`).join(', ')} |`);
  return ['| Machine | Entity | Recipe | Crafts/min | Status share (one sample a second) |', '| --- | --- | --- | ---: | --- |', ...rows].join('\n');
}
export const bom = d => Object.entries(d.footprint.counts).map(([n, c]) => `${c} ${n.replaceAll('-', ' ')}`).join(', ');
