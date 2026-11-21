// README of the blue-tier on-demand mall, written from the design, the static audit and the native report.
// Every number comes from those objects; the native result is stated only from a report for exactly this string.
import { STOCK_CAPS, PRODUCTS } from './design.mjs';

// Exploration runs made on 21 November 2026 for exactly this string. They are measurements beyond the
// qualifying protocol and are printed only while the generated string is still the one they were made on.
const EXPLORED = {
  sha: 'f537f1f1d2502cccba4da53eaeb11802bd5e23042b7270e6cb56e43f5e434bc5',
  lines: [
    'One-hour hold at full stock (`--explore --ticks stockFillTicks=216000`): the provider stayed at 30 / 10 / 5 / 5 / 5 / 5 / 6 (never more than cap + 1), at most 68 items rode the ring, and the later refill and recovery phases still passed.',
    'No advanced circuits (`--explore --withhold advanced-circuit`): the five products that do not need them still reached their caps in every phase; only express splitters and bulk inserters stayed at zero.',
    'No lubricant (`--explore --withhold lubricant`): the four inserter products still reached their caps in every phase; the three express products stayed at zero.',
  ],
};

const minutes = ticks => ticks === undefined ? 'not reached' : (ticks / 3600).toFixed(1) + ' min';
const at = q => `(${q.x}, ${q.y})`;

export function readme(d, audit, report, p, first) {
  const m = d.manifest, f = d.footprint, c = f.counts, es = d.blueprint.blueprint.entities, byId = id => es[id - 1];
  const inputCaps = m.inputPorts.filter(v => v.kind === 'item').reduce((n, v) => n + v.loopCap, 0);
  const productCaps = Object.values(STOCK_CAPS).reduce((a, b) => a + b, 0);
  const lane = audit.checks.find(k => k.name.startsWith('Capped stocks'))?.detail;
  const timing = report ? Object.fromEntries(Object.values(report.stockTiming || {}).map(t => [t.phase, t])) : null;
  const firstTiming = first?.rerun ? Object.fromEntries(Object.values(first.rerun.stockTiming || {}).map(t => [t.phase, t])) : null;
  const native = !report ? '**not run** for this string' : report.passed ? '**passed** the full protocol for this exact string' : `**failed** for this string: ${JSON.stringify(report.failures)}`;
  const out = [];
  out.push(`# Blue-tier on-demand mall

**Factorio 2.1.24 Space Age.** Seven assembling machines 2, fast inserters, red transport belts, one passive-provider output chest, no modules or beacons. It keeps a small stock of the three express belt items and the four inserters, and makes more only when stock is taken.

- **Size:** ${f.width} × ${f.height} = ${f.area} tiles (selection envelope of every entity; external supply excluded).
- **Entities:** ${f.entities}: ${c['assembling-machine-2']} machines, ${c['fast-transport-belt']} belts, ${c['fast-inserter']} inserters, ${c.pipe} pipes, ${c['medium-electric-pole']} medium poles, ${c['steel-chest']} input chests, ${c['passive-provider-chest']} provider chest, ${c['display-panel']} labels.
- **Static audit:** ${audit.checksPassed} of ${audit.checksTotal} checks pass ([static-audit.json](static-audit.json)).
- **Native test:** ${native}${report ? ' ([native-report.json](native-report.json))' : ''}.
- No items-per-minute figure is claimed. The measured times to full stock are below.

Import [blueprint.txt](blueprint.txt). See also the [layout schematic](layout.svg), the [manifest](manifest.json), the [ports](ports.json) and the [footprint](footprint.json).

Blueprint SHA-256, over the string with surrounding whitespace removed:

\`\`\`text
${d.hash}
\`\`\`
`);
  if (first) {
    const o = first.manifest.footprint, oc = o.counts;
    const row = (label, a, b) => `| ${label} | ${a} | ${b} |`;
    out.push(`## What changed from the first version

The first version (\`${first.manifest.candidateSha256.slice(0, 8)}\`, kept under [history/${first.folder}](history/${first.folder}/)) put the ring around a two-row empty middle and used two rows for lubricant. This version has the same seven products, the same stock caps, the same seven input chests in the same order on the north edge, lubricant from the west and the one provider chest at the east end.

| | First version | This version |
| --- | --- | --- |
${row('Size', `${o.width} × ${o.height} = ${o.area} tiles`, `${f.width} × ${f.height} = ${f.area} tiles (${(100 * (1 - f.area / o.area)).toFixed(1)}% fewer)`)}
${row('Machines', oc['assembling-machine-2'], c['assembling-machine-2'])}
${row('Belts / inserters / pipes / poles', `${oc['fast-transport-belt']} / ${oc['fast-inserter']} / ${oc.pipe} / ${oc['medium-electric-pole']}`, `${c['fast-transport-belt']} / ${c['fast-inserter']} / ${c.pipe} / ${c['medium-electric-pole']}`)}
${row('Entities', o.entities, f.entities)}
${firstTiming && timing ? [row('Full stock from empty', minutes(firstTiming[1]?.allTick), minutes(timing[1]?.allTick)), row('Full stock after a complete collection', minutes(firstTiming[2]?.allTick), minutes(timing[2]?.allTick)), row('Full stock after the input outage', minutes(firstTiming[4]?.allTick), minutes(timing[4]?.allTick))].join('\n') : row('Times to full stock', 'see history', 'no native report for this string')}

Both columns of times were measured with the same harness (the first version was run again on 21 November 2026; that report is in the history folder).

How the area came down: the ring is two rows tall instead of four; the lubricant runs in one row instead of two; the three express machines touch; the labels moved off the north edge row, where their selection boxes used to add a whole row; the lubricant inlet no longer sticks out two tiles on the west.

Why it also fills faster: the ring now runs counter-clockwise, so the input chests sit just upstream of the machines instead of almost a full lap away. The gear feed arm is the bottleneck of both versions. It can move about 149 gears a minute; in the first version the long trip kept the ring at its gear cap and held the arm to about 134 a minute for most of a fill, and now it runs at about 149 until the last product is full. The machines are served in the same order as before: the four inserters first, then splitters, undergrounds and belts.

The lubricant pipe is longer (${c.pipe} pipes instead of ${oc.pipe}) because the express machines moved to the east end of the row; the feed caps on the ring are lower (${inputCaps} items in total instead of ${first.manifest.inputPorts.filter(v => v.kind === 'item').reduce((n, v) => n + v.loopCap, 0)}) because the trip from chest to machine is shorter.
`);
  }
  out.push(`## Products and recipes

"Blue inserter" means \`fast-inserter\`. There is no stack inserter in scope. Each product has its own machine.

| Product | Ingredients per craft | Result per craft | Recipe seconds | Stock cap |
| --- | --- | --- | --- | --- |
${PRODUCTS.map(n => { const r = p.recipes[n]; return `| \`${n}\` | ${r.ingredients.map(v => `${v.amount} ${v.name}`).join(' + ')} | ${r.results[0].amount} | ${r.energy_required ?? 0.5} | ${STOCK_CAPS[n]} |`; }).join('\n')}

Assembling machine 2 crafting speed is ${p.entities['assembling-machine-2'].crafting_speed}. The stock cap counts the product in the provider chest plus any of it still on the ring.

## Inputs

Use normal-quality items. One steel chest (limited to one slot) per solid material on the north edge, filled by hand or by your own inserter from the north. Lubricant enters the pipe at the west edge. Coordinates are entity centres in the blueprint; north is negative y.

| Port | Material | Chest or pipe | Clear tile for your feeder | Flow | Label text | Stock kept on the ring |
| --- | --- | --- | --- | --- | --- | --- |
${m.inputPorts.map(v => `| ${v.id} | \`${v.item}\` | ${at(v.position)} | ${at(v.externalContact)} | ${v.side === 'north' ? 'North → south' : 'West → east'} | \`${v.label.replaceAll('|', '\\|')}\` | ${v.kind === 'item' ? v.loopCap : 'pipe'} |`).join('\n')}

The label of each chest is the display panel one tile east of its feed arm. The lubricant label is at the east end of the pipe, at ${at(byId(m.inputPorts.at(-1).panel).position)}. Gears, circuits, the red-tier belt items and lubricant come from outside: this is an upgrade mall, not an ore-to-product factory.

**Electricity:** any outside pole within reach of one of the ${c['medium-electric-pole']} medium poles powers the mall. The native test connects a pole at ${at(m.power.externalPolePosition)} to the pole at ${at(byId(m.power.entryPole).position)}; the pole inside the collector bend at ${at(byId(m.power.poles.at(-1)).position)} is the nearest to the north edge. The label \`${m.power.label.replaceAll('|', '\\|')}\` is at ${at(byId(m.power.panel).position)}.

**Output:** the one passive provider chest is at ${at(m.output.position)}, inside the bend at the east end, labelled \`${m.output.label.replaceAll('|', '\\|')}\`. Take items by hand or cover it with a logistics network.

## How it works

- **One ring.** ${c['fast-transport-belt']} red belt tiles form a single counter-clockwise loop two rows tall, with no splitter, side-load or underground. The westbound row passes under the seven chest feed arms; the eastbound row passes the machine arms. At the east end the loop bends north around the provider so that two collector arms reach the one chest (one arm has five filter slots, there are seven products).
- **One reader.** One belt reads the whole ring; the provider adds its contents to the same green wire.
- **Feed caps.** Each chest feed arm runs only while its material on the ring is below its cap (the last column above). The caps total ${inputCaps}.
- **Product caps.** Each machine's product arm runs only while ring plus provider hold less than the stock cap. Taking items from the provider reopens it. A product can overshoot its cap by one item in an arm's hand.
- **Three direct hand-offs,** always on, so a full stock of one inserter never starves the next recipe: yellow inserter → long-handed machine at ${at(byId(m.directTransfers[0].inserter).position)}, yellow inserter → fast machine at ${at(byId(m.directTransfers[1].inserter).position)}, fast inserter → bulk machine at ${at(byId(m.directTransfers[2].inserter).position)}.
- **Arms.** All ${c['fast-inserter']} arms are fast inserters with hand size one and whitelist filters. The splitter and underground machines have one ingredient arm each, the other five machines have two.
- **Lane room.** Everything rides the inner lane. Feed caps ${lane?.inputCaps} + product caps ${productCaps} + one item in hand for each of the ${lane?.handOvershootAllowance} capped arms = ${lane?.maxCirculating} items at the very most, against ${lane?.conservativeLaneCapacity} inner-lane places when the ${lane?.turnTiles} turn tiles are not counted at all.${report ? ` The most the native run ever saw on the ring was ${report.ringPeakTotal} items.` : ''} Raise caps only together with this check.
- Machines keep their ordinary ingredient and product buffers while idle; those are not the advertised stock.
`);
  out.push(`## Native test

Protocol (unchanged from the first version): supply only the seven chests, the outside pipe and outside power; 15 minutes to fill all stocks from empty; collect everything; 15 minutes to refill; collect; 5 minutes with the input chests emptied; collect; 15 minutes to recover. All seven products must sit at their caps at the end of each fill phase, never more than one over, and the provider may hold nothing else. The run also checks every route, recipe, circuit and power connection of the imported blueprint.
`);
  if (report) {
    const phaseRow = (label, n) => `| ${label} | ${minutes(timing[n]?.allTick)} | ${PRODUCTS.map(name => timing[n]?.reached?.[name] === undefined ? '–' : (timing[n].reached[name] / 3600).toFixed(1)).join(' / ')} |`;
    out.push(`Result for \`${report.blueprintSha256.slice(0, 8)}\`: **${report.passed ? 'passed' : 'failed'}**, ${report.checks.filter(k => k.passed).length} of ${report.checks.length} checks, ${report.actualTicks} ticks.

| Phase | All seven at cap after | Each product at cap after (minutes; belt / underground / splitter / inserter / long / fast / bulk) |
| --- | --- | --- |
${phaseRow('Fill from empty', 1)}
${phaseRow('Refill after collection', 2)}
${phaseRow('Recovery after outage', 4)}

Crafts in the run: ${PRODUCTS.map(n => `${report.crafts[n]} ${n}`).join(', ')}. Times are read once a second of game time; they are measurements, not pass limits.
`);
  } else out.push('No native report exists for this string yet. Until one does, the blueprint is not qualified.\n');
  if (d.hash === EXPLORED.sha) out.push(`Checked beyond the protocol, on this exact string (exploration runs; their reports are not kept in the repository):

${EXPLORED.lines.map(l => '- ' + l).join('\n')}
`);
  out.push(`## Technology

- **Express products:** \`logistics-3\`, which needs production science and lubricant.
- **Inserters:** \`electronics\`, \`automation\`, \`fast-inserter\` and \`bulk-inserter\`. No Gleba research is needed.
- **Building it:** \`automation-2\`, \`electric-energy-distribution-1\`, \`circuit-network\`, and \`construction-robotics\` (or \`logistic-robotics\`) for the provider chest. The chest works as a plain chest without robots.

The full prerequisite list, in research order, is \`technologyClosure\` in the manifest (${d.tech.closure.length} technologies); the native test researches exactly that list.

## Provenance

The design principle (one capped circulating belt read by one belt reader) and the seven recipe nodes come from \`mall/compact_turbo_tesla_mall.txt\` and \`scripts/generate-belt-tesla-mall.mjs\` in this repository; the manifest records their hashes under \`reference\`. Geometry, machines (assembling machine 2 instead of 3) and handling (fast inserters, red belts) are new. No performance comparison with that much larger mall is claimed.

## Reproduce

From the \`factorio-command-center\` folder:

\`\`\`sh
node scripts/requested-malls/blue-tier-mall/generate.mjs     # rewrites this folder; byte-identical on a re-run
node scripts/requested-malls/blue-tier-mall/audit.mjs        # static audit
node scripts/requested-malls/blue-tier-mall/validate.mjs     # full native protocol, about one minute
node --test tests/requested-malls.test.mjs
\`\`\`

The generator and the tests need only the pinned \`scripts/requested-malls/blue-tier-mall/prototypes.json\` (taken from the installed 2.1.24 game). The validator needs the Steam install of Factorio 2.1.24 with Space Age and runs it headless in a private profile under \`.cache/blue-tier-mall/\`; it never opens the player's saves. After a full run, run the generator again so this page states the new result.
`);
  return out.join('\n');
}
