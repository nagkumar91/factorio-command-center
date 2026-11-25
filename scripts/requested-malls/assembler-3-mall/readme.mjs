// README of the assembling-machine-3 supply mall, written from the design, the static audit and the native report.
// Every number comes from those objects; the native result is stated only from a report for exactly this string.
import { RECIPES, rawPerProduct } from './design.mjs';
import { box } from './lib.mjs';

const at = q => `(${q.x}, ${q.y})`;
const tile = q => `[${Math.floor(q.x)}, ${Math.floor(q.y)}]`;
const minutes = ticks => ticks === undefined || ticks === null ? 'not reached' : (ticks / 3600).toFixed(1) + ' min';
const hours = ticks => ticks === undefined || ticks === null ? 'not reached' : (ticks / 216000).toFixed(2) + ' h';
const n2 = v => Number(v).toFixed(2);
const cell = text => String(text).replaceAll('|', '\\|');

// A character map from the entities: machines by number, arrows for belts, lower-case n/e/s/w for the side an arm drops on.
export function asciiMap(d, p) {
  const { bounds } = d.footprint, grid = {}, arrows = { 0: '^', 4: '>', 8: 'v', 12: '<' };
  for (const e of d.blueprint.blueprint.entities) {
    const b = box(e, p, 'selection_box');
    for (let y = Math.round(b.top); y < Math.round(b.bottom); y++) for (let x = Math.round(b.left); x < Math.round(b.right); x++) {
      grid[`${x},${y}`] = e.name === 'fast-transport-belt' ? arrows[e.direction]
        : e.name === 'fast-inserter' ? 'nesw'[((((e.direction || 0) + 8) % 16) / 4)]
        : e.name === 'assembling-machine-2' ? String(RECIPES.indexOf(e.recipe) + 1)
        : e.name === 'passive-provider-chest' ? 'C' : e.name === 'medium-electric-pole' ? 'p' : e.name === 'display-panel' ? 'D' : '?';
    }
  }
  const width = bounds.right - bounds.left;
  let out = '     ' + Array.from({ length: width }, (_, i) => (bounds.left + i) % 10).join('') + '   x (west to east), y down\n';
  for (let y = bounds.top; y < bounds.bottom; y++) out += String(y).padStart(4) + ' ' + Array.from({ length: width }, (_, i) => grid[`${bounds.left + i},${y}`] || '.').join('') + '\n';
  return out;
}

export function readme(d, audit, report, p) {
  const m = d.manifest, f = d.footprint, c = f.counts, es = d.blueprint.blueprint.entities, byId = id => es[id - 1];
  const lane = audit.checks.find(k => k.name.startsWith('Caps plus'))?.detail;
  const raw = rawPerProduct(p);
  const native = !report ? '**not run** for this string' : report.passed ? '**passed** the full protocol for this exact string' : `**failed** for this string: ${JSON.stringify(report.failures)}`;
  const normal = report?.windows?.['rate-am3'], both = report?.windows?.['rate-both'];
  const am3 = m.outputs[1], am2 = m.outputs[0];
  const trial = m.arrangementTrial;
  const out = [];
  out.push(`# Assembling machine 3 supply mall

**Factorio 2.1.24 Space Age.** Eight assembling machines 2, fast inserters, red transport belts and medium poles make **assembling machine 2** and **assembling machine 3** from smelted plates. Each product drops into its **own passive provider chest** (one stack of 50 each). The user supplies four materials on four labelled belts: iron plate, steel plate, copper plate and **plastic bar**. Plastic is not smelted; it is the one input that has to come from a chemical plant. Everything else (cable, green and red circuits, gears, assembling machine 1, speed modules) is made inside.

- **Size:** ${f.width} × ${f.height} = ${f.area} tiles (selection envelope of every entity; the four outside belts and outside power excluded).
- **Entities:** ${f.entities}: ${c['assembling-machine-2']} machines, ${c['fast-transport-belt']} belts, ${c['fast-inserter']} inserters, ${c['medium-electric-pole']} medium poles, ${c['passive-provider-chest']} provider chests, ${c['display-panel']} display panels.
- **Static audit:** ${audit.checksPassed} of ${audit.checksTotal} checks pass ([static-audit.json](static-audit.json)).
- **Native test:** ${native}${report ? ' ([native-report.json](native-report.json))' : ''}.
${normal ? `- **Measured rate, normal use** (only the AM3 chest emptied): **${n2(normal.removedPerMinute['assembling-machine-3'])} assembling machines 3 per minute**; the limit is one advanced-circuit machine, 7.5 per minute, 20 per assembling machine 3.\n` : '- No rate is claimed until a native report exists for this string.\n'}
Import [blueprint.txt](blueprint.txt). See also the [layout schematic](layout.svg), the [manifest](manifest.json), the [ports](ports.json) and the [footprint](footprint.json).

Blueprint SHA-256, over the string with surrounding whitespace removed:

\`\`\`text
${d.hash}
\`\`\`
`);
  out.push(`## Layout

Tile coordinates are blueprint-relative, x east and y south, the top-left tile of the envelope at (0, -4). Machine numbers: ${RECIPES.map((r, i) => `${i + 1} ${r}`).join(', ')}. \`C\` = provider chest, \`D\` = display panel, \`p\` = medium pole; \`n e s w\` = an inserter and the side it drops on; \`> < ^ v\` = red belts.

\`\`\`text
${asciiMap(d, p)}\`\`\`

Rows ${f.bounds.top} to ${f.bounds.top + 2}: north machines. Row -1: their arms. Rows 0 and 1: the ring (westbound on row 0, eastbound on row 1). Row 2: arms of the south machines. Rows 3 to 5: south machines and the gap that holds the two provider chests.
`);
  out.push(`## What it costs: one assembling machine 3

Expanded from the recipes in \`prototypes.json\` (assembling machine 3 = 2 assembling machine 2 + 4 speed modules; the 2.1 recipe needs 4 modules):

| Material (entrance) | Per assembling machine 3 | At the measured rate, per minute |
| --- | ---: | ---: |
${m.inputPorts.map(v => `| \`${v.item}\` (${v.id}) | ${raw[v.item]} | ${normal ? n2(normal.inputsPerMinute[v.item]) : 'not measured'} |`).join('\n')}

An assembling machine 2 on its own (what the first chest stocks): 2 steel plate, 35 iron plate (9 for the machine 1, 20 for 10 gears, 6 for 6 circuits) and 9 copper plate. The AM2 chest feeds the AM3 machine, so assembling machine 2 surplus is about zero in normal use; stock builds up to 50 when nothing is taken from the AM3 chest.
`);
  out.push(`## Inputs: four belts on the west edge

Each entrance is a short red belt stub that ends next to a capped feed arm, which lifts the plate onto the ring. Bring your own belt to the **external tile** (it must end facing east on that tile; the first stub tile is the next one). The belt can be any speed; the arm moves about 2.3 items a second. Each label is a display panel with the item icon and \`IN: <material>\`.

| Port | Material | External tile (end your belt here) | Stub tiles (x, y) | Feed arm | Label panel | Cap on ring |
| --- | --- | --- | --- | --- | --- | ---: |
${m.inputPorts.map(v => `| ${v.id} | \`${v.item}\` | ${tile(v.externalContact)} | ${v.stub.map(id => tile(byId(id).position)).join(' ')} | ${tile(byId(v.inserter).position)} | ${tile(byId(v.panel).position)} \`${cell(v.label)}\` | ${v.loopCap} |`).join('\n')}

Both north entrances reach the ring on its westbound row, both south entrances on its eastbound row. The tiles listed are centres rounded down to the tile; entity centres are in [ports.json](ports.json).

**Electricity:** one labelled connection. Any outside medium pole within reach of the entry pole at ${tile(byId(m.power.entryPole).position)} powers the mall (${m.power.poles.length} medium poles in all, all inside the rectangle). The panel \`${cell(m.power.label)}\` is at ${tile(byId(m.power.panel).position)}. The native test connects an outside pole at ${at(m.power.externalPolePosition)}.
`);
  out.push(`## Outputs: one provider chest each

| Product | Chest tile | Label panel | How it gets there |
| --- | --- | --- | --- |
${m.outputs.map(o => `| \`${o.item}\` | ${tile(o.position)} | ${tile(byId(o.panel).position)} \`${cell(o.label)}\` | A filtered, always-on fast inserter at ${tile(byId(o.producerArm).position)} from the machine that makes it. Nothing else ever drops into this chest. |`).join('\n')}

Both chests are limited to one slot (bar 1), so each holds at most one stack of 50. They are on no belt and no circuit. The AM3 machine takes its assembling machines 2 from the AM2 chest with an always-on arm at ${tile(byId(am2.takenBy.inserter).position)}, so the AM2 chest both stocks up for you and feeds the AM3 machine. Assembling machine 2 and 3 never ride the ring.
`);
  out.push(`## How it works

- **One ring.** ${m.loop.length} red belt tiles form a single counter-clockwise loop two rows tall, with no splitter, side-load or underground. Machines sit on both sides of it. The four entrance stubs are separate belts that end at an arm; none of them feeds the ring directly.
- **One reader.** One ring belt reads the whole ring in hold mode, at ${at(byId(m.reader).position)}. Every feed arm and every product arm that puts something on the ring is enabled only while its own item on the ring is below its cap.
- **Capped on the ring:** ${Object.entries(m.ringCaps).map(([k, v]) => `\`${k}\` ${v}`).join(', ')}. The caps total ${lane?.ringCaps}.
- **Direct hand-offs,** always on, so these high-volume items stay off the ring: ${m.directTransfers.map(t => `${byId(t.source).recipe} → ${byId(t.destination).recipe}`).join('; ')}; and the AM2 chest → AM3 machine.
- **Arms.** All ${c['fast-inserter']} arms are fast inserters with hand size one and whitelist filters. A machine's ring arms only take what its recipe still needs from the ring.
- **Lane room.** Everything rides the inner lane. Ring caps ${lane?.ringCaps} + one item in hand for each of the ${lane?.handOvershootAllowance} capped arms = ${lane?.maxCirculating} items at the very most, against ${lane?.conservativeLaneCapacity} inner-lane places when the ${lane?.turnTiles} turn tiles are not counted at all.${report ? ` The most the native run ever saw on the ring was ${report.ringPeakTotal} items.` : ''} Raise caps only together with this check.
- Machines keep their ordinary ingredient and product buffers while idle; those are not stock.

### Why this arrangement

Both a one-row arrangement (all eight machines on one side of the ring) and a two-row arrangement (machines on both sides) were built from the same data and passed the same static audit:

| Arrangement | Size | Area | Entities |
| --- | --- | ---: | ---: |
${Object.entries(trial).map(([name, t]) => `| ${name}${t.published ? ' (published)' : ''} | ${t.width} × ${t.height} | ${t.area} | ${t.entities} |`).join('\n')}

The one-row version was only checked statically; it was not run natively.

**A second advanced-circuit machine (estimate, not built):** one advanced-circuit machine limits the mall to 7.5 per minute, 0.375 assembling machines 3 a minute. A second one east of the speed-module machine would widen the rectangle by two columns (about 23 × 10 = 230 tiles, 10% more), but one copper-cable machine makes 180 cables a minute and each assembling machine 3 needs 296, so the second machine alone would lift the rate to about 0.6 a minute, not 0.75. A full doubling also needs a second cable machine.
`);
  out.push(`## Native test

Protocol: supply only the four entrance belts (kept full by the test) and outside power. All phases are bounded; a fill phase ends when both chests hold 50.

1. Fill from empty to 50 + 50 (limit 4 game hours; a full stack of assembling machines 3 takes over two hours).
2. Collect everything, refill to 50 + 50.
3. Collect everything, a 5-minute outage of all four entrances (belts emptied), collect, recover to 50 + 50.
4. One hour at full stock, nothing collected; then collect and check production resumes (10 minutes).
5. Both chests emptied every second: 15 minutes warm-up, 30 minutes measured.
6. Only the AM3 chest emptied every second (the AM2 chest refilled first and left full): 15 minutes warm-up, 30 minutes measured.

The run also checks every route, recipe, filter, hand size, circuit condition and power connection of the imported blueprint, that both chests accept exactly one stack, that no chest ever holds a foreign item or more than 50, that the ring never exceeds the lane-room bound and that no ring item exceeds its cap by more than the one item in an arm's hand.
`);
  if (report) {
    const ft = report.fillTimes || {};
    const row = (label, k) => `| ${label} | ${minutes(ft[k]?.am2)} | ${minutes(ft[k]?.am3)} | ${minutes(ft[k]?.both)} (${hours(ft[k]?.both)}) |`;
    out.push(`Result for \`${report.blueprintSha256.slice(0, 8)}\`: **${report.passed ? 'passed' : 'failed'}**, ${report.checks.filter(k => k.passed).length} of ${report.checks.length} checks, ${report.actualTicks} ticks (${hours(report.actualTicks)} of game time).

| Phase | AM2 chest at 50 after | AM3 chest at 50 after | Both |
| --- | --- | --- | --- |
${row('Fill from empty', 'fill from empty')}
${row('Refill after collection', 'refill after collection')}
${row('Recovery after the 5-minute outage', 'recovery after outage')}
`);
    const resume = report.checks.find(k => k.name.startsWith('production resumes'));
    const hold = report.checks.filter(k => k.name.startsWith('hold at full stock'));
    out.push(`- **Hold at full stock, one hour:** ${hold.every(k => k.passed) ? 'both chests stayed at exactly 50 and held only their own product' : 'FAILED: ' + hold.filter(k => !k.passed).map(k => k.name).join('; ')}. After the collection, ${resume?.passed ? `production resumed: ${resume.detail['assembling-machine-2']} AM2 and ${resume.detail['assembling-machine-3']} AM3 in the chests ${resume.detail.minutes} minutes later` : 'production did NOT resume'}.
- **Ring:** at most ${report.ringPeakTotal} items on the ring at any one second (bound ${m.laneRoom.maxCirculating}); per item: ${Object.entries(report.ringPeaks).map(([k, v]) => `${k} ${v}`).join(', ')}.
- **Provider chests:** peak ${report.chestPeak['assembling-machine-2']} AM2 and ${report.chestPeak['assembling-machine-3']} AM3; never a foreign item.
`);
    const windowRows = (w) => RECIPES.map(r => `| \`${r}\` | ${w.crafts[r]} | ${n2(w.craftsPerMinute[r])} |`).join('\n');
    if (normal) out.push(`### Normal use: only the AM3 chest emptied (30 measured minutes)

- **Assembling machine 3 taken: ${n2(normal.removedPerMinute['assembling-machine-3'])} per minute** (${normal.removed['assembling-machine-3']} in 30 minutes); assembling machine 2 taken by the user side: ${n2(normal.removedPerMinute['assembling-machine-2'])} per minute (the AM3 machine uses them all).
- Drawn from the entrances, per minute: ${Object.entries(normal.inputsPerMinute).map(([k, v]) => `${k} ${n2(v)}`).join(', ')}.

| Machine | Crafts in the window | Per minute |
| --- | ---: | ---: |
${windowRows(normal)}
`);
    if (both) out.push(`### Both chests emptied every second (30 measured minutes)

An artificial worst case: the AM2 chest never holds a machine for the AM3 machine to take, and the AM2 chain (which makes assembling machine 2 as fast as iron allows) uses the circuits first.

- Taken: **${n2(both.removedPerMinute['assembling-machine-3'])} assembling machine 3 and ${n2(both.removedPerMinute['assembling-machine-2'])} assembling machine 2 per minute**.
- Drawn from the entrances, per minute: ${Object.entries(both.inputsPerMinute).map(([k, v]) => `${k} ${n2(v)}`).join(', ')}.

| Machine | Crafts in the window | Per minute |
| --- | ---: | ---: |
${windowRows(both)}
`);
    out.push(`Crafts over the whole run: ${RECIPES.map(r => `${report.crafts[r]} ${r}`).join(', ')}. Times are read once a second of game time; they are measurements, not pass limits.
`);
    if (report.installedGame) out.push(`**Game version.** The pinned data in \`prototypes.json\` and the blueprint version are Factorio ${report.installedGame.pinnedVersion}. The native run used the installed ${report.installedGame.version}; before the run the harness dumped the installed game's prototypes and checked all ${report.installedGame.pinnedRecordsChecked.recipes} recipes, ${report.installedGame.pinnedRecordsChecked.entities} entities, ${report.installedGame.pinnedRecordsChecked.items} items and ${report.installedGame.pinnedRecordsChecked.technologies} technologies this design reads against the pin: ${report.installedGame.mismatches.length ? 'MISMATCHES ' + JSON.stringify(report.installedGame.mismatches) : 'no difference'}.
`);
  } else out.push('No native report exists for this string yet. Until one does, the blueprint is not qualified.\n');
  const closure = d.tech.closure;
  out.push(`## Technology

- **Assembling machine 3:** \`automation-3\` (needs \`speed-module\`, \`production-science-pack\`, \`electric-engine\`). Assembling machine 2: \`automation-2\`.
- **Circuits and gears:** \`electronics\`, \`advanced-circuit\`, \`speed-module\`; the plastic comes from \`plastics\`.
- **Building it:** \`electric-energy-distribution-1\` (medium pole), \`fast-inserter\`, \`logistics-2\` (red belts), \`circuit-network\`, and \`construction-robotics\` (or \`logistic-robotics\`) for the provider chests. The chests work as plain chests without robots.

The full prerequisite list, in research order, is \`technologyClosure\` in the manifest (${closure.length} technologies); the native test researches exactly that list.

## Reproduce

From the \`factorio-command-center\` folder:

\`\`\`sh
node scripts/requested-malls/assembler-3-mall/generate.mjs     # rewrites this folder; byte-identical on a re-run
node scripts/requested-malls/assembler-3-mall/audit.mjs        # static audit
node scripts/requested-malls/assembler-3-mall/validate.mjs     # full native protocol, about fifteen to twenty minutes
node --test tests/assembler-3-mall.test.mjs
\`\`\`

The generator and the tests need only the pinned \`scripts/requested-malls/assembler-3-mall/prototypes.json\` (written by \`snapshot.mjs\` from a native \`--dump-data\`). The validator needs the Steam install of Factorio with Space Age and runs it headless in a private profile under \`.cache/assembler-3-mall/\`; it never opens the player's saves. After a full run, run the generator again so this page states the new result.
`);
  return out.join('\n');
}
